import { maskSource } from './source.mjs';
import { scanFunctions, functionSuggestions } from './functions.mjs';
import { buildScopes, createScopeLookup, createVariableLookup } from './scopes.mjs';

// Changing these tokens can alter declarations or control-statement scopes.
const structuralWord = /^(?:const|constexpr|static|volatile|extern|register|signed|unsigned|int|char|short|long|float|double|bool|boolean|byte|word|String|size_t|u?int(?:8|16|32|64)_t|auto|void|if|else|for|while|do|switch|catch|noexcept)$/;

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
  const functionBodies = new Set(functions.map(fn => fn.bodyStart).filter(offset => offset !== null));
  const variablesAt = createVariableLookup(declarations, scopesAt);
  return {
    functions:functionSuggestions(functions),
    variablesAt,
    canReuseIdentifier(start, end, replacement) {
      const original = code.slice(start, end);
      if (!/^[A-Za-z_]\w*$/.test(original) || structuralWord.test(original) || structuralWord.test(replacement)) return false;
      let from = 0, to = declarations.length;
      while (from < to) {
        const middle = (from+to) >>> 1;
        if (declarations[middle].offset < end) from = middle+1;
        else to = middle;
      }
      if (from && declarations[from-1].end > start) return false;
      // Only reference edits inside an executable function body are safe.
      return scopesAt(start).some(scope => functionBodies.has(scope.open));
    },
  };
}
export function createSketchIndex(editor) {
  let symbols = collectSketch(editor.getValue());
  let dirty = false;
  let timer;
  let edits = [];
  let pendingReference = false;
  // Reuse the parsed revision for reference-only edits, mapping live cursor
  // positions back to it. Structural edits always rebuild before a lookup.
  function originalOffset(offset) {
    for (let index = edits.length - 1; index >= 0; index--) {
      const edit = edits[index];
      if (offset >= edit.from + edit.length) offset += edit.to - edit.from - edit.length;
      else if (offset > edit.from) offset = edit.from + Math.min(offset - edit.from, edit.to - edit.from);
    }
    return offset;
  }
  function refresh() {
    if (!dirty) return;
    symbols = collectSketch(editor.getValue());
    edits = [];
    dirty = false;
  }
  editor.on('beforeChange', (_editor, change) => {
    // Multiple changes in one operation are conservatively rebuilt: their
    // beforeChange callbacks may precede all corresponding change events.
    if (pendingReference) dirty = true;
    pendingReference = false;
    if (dirty) return;
    dirty = true;
    if (edits.length >= 64 || change.from.line !== change.to.line || change.text.length !== 1) return;
    const line = editor.getLine(change.from.line);
    const start = change.from.ch - (line.slice(0, change.from.ch).match(/\w*$/)?.[0].length ?? 0);
    const end = change.to.ch + (line.slice(change.to.ch).match(/^\w*/)?.[0].length ?? 0);
    const oldWord = line.slice(start, end);
    const newWord = line.slice(start, change.from.ch) + change.text[0] + line.slice(change.to.ch, end);
    if (!/^[A-Za-z_]\w*$/.test(oldWord) || !/^[A-Za-z_]\w*$/.test(newWord)) return;
    const base = editor.indexFromPos({line:change.from.line, ch:0});
    if (!symbols.canReuseIdentifier(originalOffset(base + start), originalOffset(base + end), newWord)) return;
    pendingReference = {from:base + change.from.ch, to:base + change.to.ch, length:change.text[0].length};
    dirty = false;
  });
  editor.on('change', () => {
    if (pendingReference && !dirty) edits.push(pendingReference);
    else dirty = true;
    pendingReference = false;
  });
  editor.on('changes', () => {
    clearTimeout(timer);
    if (dirty) timer=setTimeout(refresh,120);
  });
  return () => {
    // Refresh once per changed document before using offsets; cursor-only
    // requests share the cache. This avoids stale scope boundaries after edits.
    refresh();
    return {functions:symbols.functions, variablesAt:offset=>symbols.variablesAt(originalOffset(offset))};
  };
}
