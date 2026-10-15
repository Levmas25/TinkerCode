import { maskSource } from './source.mjs';
import { scanFunctions, functionSuggestions } from './functions.mjs';
import { buildScopes, createScopeLookup, visibleVariables } from './scopes.mjs';

// Common Arduino declarations, with source positions for scope lookup.
export function collectVariableDeclarations(source, code = maskSource(source)) {
  const type = /\b(?:(?:const|constexpr|static|volatile|extern|register|signed|unsigned)\s+)*(?:(?:long\s+)?(?:int|char|short|long|float|double|bool|boolean|byte|word|String|size_t|u?int(?:8|16|32|64)_t|auto)|unsigned|signed)\b\s*/g;
  const declarations = [];
  for (const match of code.matchAll(type)) {
    let offset = match.index + match[0].length;
    if (match.index > 0 && /[\w.]/.test(code[match.index - 1])) continue;
    while (offset < code.length) {
      const declaration = code.slice(offset).match(/^\s*[*&]*\s*([A-Za-z_]\w*)\s*/);
      if (!declaration) break;
      const name = declaration[1];
      const nameOffset = offset + declaration[0].indexOf(name);
      offset += declaration[0].length;
      if (code[offset] === '(') break;
      if (!/[=,;:\[){}]/.test(code[offset] ?? '') && offset !== code.length) break;
      declarations.push({name, offset:nameOffset, end:nameOffset+name.length, type:match[0].trim()});
      let depth = 0;
      while (offset < code.length) {
        const char = code[offset];
        if ('([{'.includes(char)) depth++;
        else if (')]}'.includes(char)) {
          if (depth === 0) break;
          depth--;
        }
        if (depth === 0 && (char === ',' || char === ';')) break;
        offset++;
      }
      if (code[offset] !== ',') break;
      offset++;
    }
  }
  return declarations;
}
export function collectVariables(source) {
  return [...new Set(collectVariableDeclarations(source).map(item=>item.name))];
}
export function collectSketch(source) {
  const code = maskSource(source);
  const functions = scanFunctions(source, code);
  const scopes = buildScopes(source, code);
  const scopesAt = createScopeLookup(scopes);
  const bodyScopes = new Map(scopes.filter(scope => scope.open != null).map(scope => [scope.open, scope]));
  let functionIndex = 0;
  const declarations = collectVariableDeclarations(source, code).sort((a, b) => a.offset - b.offset).map(item=> {
    while (functionIndex < functions.length && functions[functionIndex].parameterEnd <= item.offset) functionIndex++;
    const fn = functions[functionIndex];
    const parameter = fn && item.offset >= fn.parameterStart && item.offset < fn.parameterEnd ? fn : null;
    // Prototype parameters belong to no executable scope.
    const scope = parameter ? bodyScopes.get(parameter.bodyStart) : scopesAt(item.offset)[0];
    return {...item, scope:scope ?? null};
  });
  return {functions:functionSuggestions(functions), variablesAt:offset=>visibleVariables(declarations,offset)};
}
export function createSketchIndex(editor) {
  let symbols = collectSketch(editor.getValue());
  let dirty = false;
  let timer;
  function refresh() {
    if (!dirty) return;
    symbols = collectSketch(editor.getValue());
    dirty = false;
  }
  editor.on('changes', () => {
    dirty = true;
    clearTimeout(timer);
    timer=setTimeout(refresh,120);
  });
  return () => {
    // Refresh once per changed document before using offsets; cursor-only
    // requests share the cache. This avoids stale scope boundaries after edits.
    refresh();
    return symbols;
  };
}
