// {{...}} marks a selectable field; {{}} marks an empty body stop.
export const controlTemplates = {
  for: 'for ({{int i = 0}}; {{i < count}}; {{i++}}) {\n\t{{}}\n}',
  if: 'if ({{condition}}) {\n\t{{}}\n}',
  ifelse: 'if ({{condition}}) {\n\t{{}}\n} else {\n\t{{}}\n}',
  else: 'else {\n\t{{}}\n}',
  while: 'while ({{condition}}) {\n\t{{}}\n}',
  switch: 'switch ({{expression}}) {\n\tcase {{value}}:\n\t\t{{}}\n\t\tbreak;\n\tdefault:\n\t\t{{}}\n\t\tbreak;\n}',
};
export function planControl(name, indentation, indentUnit) {
  const template = controlTemplates[name].split('\n').map((line,index) =>
    (index ? indentation : '') + line.replace(/^\t+/, tabs => indentUnit.repeat(tabs.length))).join('\n');
  const fields = [];
  let text = '';
  let offset = 0;
  for (const match of template.matchAll(/\{\{([^{}]*)\}\}/g)) {
    text += template.slice(offset, match.index);
    const start = text.length;
    text += match[1];
    fields.push({start,end:text.length});
    offset = match.index + match[0].length;
  }
  text += template.slice(offset);
  return {text,fields};
}
