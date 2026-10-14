// A declaration scanner for common Arduino types, not a full C++ parser.
export function collectVariables(source) {
  const code = source.replace(/\/\*[\s\S]*?(?:\*\/|$)|\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g,
    token => token.replace(/[^\n]/g, ' ')).replace(/^\s*#.*$/gm, '');
  const type = /\b(?:(?:const|constexpr|static|volatile|extern|register|signed|unsigned)\s+)*(?:(?:long\s+)?(?:int|char|short|long|float|double|bool|boolean|byte|word|String|size_t|u?int(?:8|16|32|64)_t|auto)|unsigned|signed)\b\s*/g;
  const names = new Set();
  for (const match of code.matchAll(type)) {
    let offset = match.index + match[0].length;
    // Do not mistake identifiers containing a type word for declarations.
    if (match.index > 0 && /[\w.]/.test(code[match.index - 1])) continue;
    while (offset < code.length) {
      const declaration = code.slice(offset).match(/^\s*[*&]*\s*([A-Za-z_]\w*)\s*/);
      if (!declaration) break;
      const name = declaration[1];
      offset += declaration[0].length;
      if (code[offset] === '(') break; // Function declaration / direct initialization.
      if (!/[=,;\[){}]/.test(code[offset] ?? '') && offset !== code.length) break;
      names.add(name);
      // Skip an initializer or array dimensions, respecting nested commas.
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
  return [...names];
}

export function createVariableIndex(editor) {
  let names = collectVariables(editor.getValue());
  let timer;
  editor.on('changes', () => {
    clearTimeout(timer);
    timer = setTimeout(() => { names = collectVariables(editor.getValue()); }, 120);
  });
  return () => names;
}
