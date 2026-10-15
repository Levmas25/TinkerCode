import { maskSource } from './source.mjs';

// Recognize ordinary free-function declarations/definitions at sketch scope.
// This deliberately leaves templates, class methods, and function pointers out.
export function scanFunctions(source, code = maskSource(source)) {
  const functions = [];
  let depth = 0;
  let boundary = 0;
  for (let index=0; index<code.length; index++) {
    const char=code[index];
    if (char === '{') {depth++; continue;}
    if (char === '}') {depth--; if (depth===0) boundary=index+1; continue;}
    if (depth !== 0) continue;
    if (char === ';') {boundary=index+1; continue;}
    if (char !== '(') continue;
    const head=code.slice(boundary,index).trim();
    const declaration=head.match(/^(.+?)([A-Za-z_]\w*)$/);
    if (!declaration || !/[\s*&]$/.test(declaration[1])) continue;
    const name=declaration[2];
    const returnType=declaration[1].trim();
    if (!/^(?:[A-Za-z_]\w*(?:::[A-Za-z_]\w*)*\s+)*[A-Za-z_]\w*(?:::[A-Za-z_]\w*)*\s*[*&]*$/.test(returnType)) continue;
    let end=index+1;
    let nesting=1;
    for (;end<code.length;end++) {
      if (code[end]==='(') nesting++;
      else if (code[end]===')' && --nesting===0) break;
    }
    const tail = code.slice(end+1).match(/^\s*(?:noexcept\s*)?([;{])/);
    if (nesting || !tail) continue;
    const raw=code.slice(index+1,end).trim();
    const params=splitParameters(raw);
    if (!params) continue;
    const parsed=[];
    let valid=true;
    for (const [position,param] of params.entries()) {
      const withoutDefault=param.split('=')[0].trim();
      if (!withoutDefault || /[()<>{}]/.test(withoutDefault)) {valid=false;break;}
      // Named ordinary, pointer/reference, or array parameters.
      let named=withoutDefault.match(/^(.+?[\s*&])([A-Za-z_]\w*)(\s*\[[^\]]*\])?$/);
      if (named && /^(?:void|bool|boolean|byte|word|int|char|short|long|float|double|signed|unsigned|const|volatile|String|size_t|u?int(?:8|16|32|64)_t)$/.test(named[2])) named=null;
      const type=named ? (named[1]+(named[3] ?? '')).trim() : withoutDefault;
      if (!/^[\w\s:*&\[\]0-9]+$/.test(type)) {valid=false;break;}
      const argument=named ? named[2] : `arg${position+1}`;
      parsed.push({argument,type,label:withoutDefault.replace(/\s+/g,' ')});
    }
    if (!valid) continue;
    const key=name+'('+parsed.map(p=>p.type.replace(/\s+/g,' ')).join(',')+')';
    functions.push({
      key,
      parameterStart:index+1,
      parameterEnd:end,
      bodyStart:tail[1]==='{' ? end+1+tail[0].lastIndexOf('{') : null,
      item:{
        text:name,
        displayText:`${name}(${parsed.map(p=>p.label).join(', ')})`,
        callText:`${name}(${parsed.map(p=>p.argument).join(', ')})`,
        description:`Sketch function. Returns ${returnType}.`,
        kind:'function',
      },
    });
    index=end;
  }
  return functions;
}
function splitParameters(text) {
  if (!text || text==='void') return [];
  const result=[];
  let start=0;
  let depth=0;
  for (let index=0;index<text.length;index++) {
    if ('([{'.includes(text[index])) depth++;
    else if (')]}'.includes(text[index])) depth--;
    if (depth<0) return null;
    if (text[index]===',' && depth===0) {result.push(text.slice(start,index).trim());start=index+1;}
  }
  if (depth) return null;
  result.push(text.slice(start).trim());
  return result;
}


export function functionSuggestions(declarations) {
  const seen = new Set();
  return declarations.filter(fn=> {
    if (seen.has(fn.key)) return false;
    seen.add(fn.key);return true;
  }).map(fn=>fn.item);
}
export function collectFunctions(source) {
  return functionSuggestions(scanFunctions(source));
}
