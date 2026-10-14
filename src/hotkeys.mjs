function selectedLines(cm) {
  if (cm.listSelections().length !== 1 || cm.getOption('readOnly')) return null;
  const from = cm.getCursor('from');
  const to = cm.getCursor('to');
  return {start: from.line, end: to.line > from.line && to.ch === 0 ? to.line - 1 : to.line};
}
export function toggleComments(cm) {
  const range = selectedLines(cm);
  if (!range) return;
  const lines = [];
  for (let line = range.start; line <= range.end; line++) {
    if (cm.getLine(line).trim()) lines.push(line);
  }
  if (!lines.length) return;
  const uncomment = lines.every(line => /^\s*\/\//.test(cm.getLine(line)));
  cm.operation(() => {
    for (const line of lines.reverse()) {
      const text = cm.getLine(line);
      const ch = text.match(/^\s*/)[0].length;
      if (uncomment) {
        const length = text.slice(ch).startsWith('// ') ? 3 : 2;
        cm.replaceRange('', {line,ch}, {line,ch:ch + length}, 'tinkercode-comment');
      } else cm.replaceRange('// ', {line,ch}, {line,ch}, 'tinkercode-comment');
    }
  });
}
export function duplicateLines(cm, direction = 1) {
  const range = selectedLines(cm);
  if (!range) return;
  const {anchor, head} = cm.listSelections()[0];
  const text = cm.getRange({line:range.start,ch:0}, {line:range.end,ch:cm.getLine(range.end).length});
  const count = range.end - range.start + 1;
  cm.operation(() => {
    if (direction < 0) cm.replaceRange(text + '\n', {line:range.start,ch:0}, undefined, 'tinkercode-duplicate');
    else cm.replaceRange('\n' + text, {line:range.end,ch:cm.getLine(range.end).length}, undefined, 'tinkercode-duplicate');
    const offset = direction < 0 ? 0 : count;
    cm.setSelection({line:anchor.line + offset,ch:anchor.ch}, {line:head.line + offset,ch:head.ch});
  });
}
export function moveLines(cm, direction) {
  const range = selectedLines(cm);
  if (!range || (direction < 0 && range.start === 0) ||
      (direction > 0 && range.end === cm.lastLine())) return;
  const {anchor, head} = cm.listSelections()[0];
  const start = direction < 0 ? range.start - 1 : range.start;
  const end = direction < 0 ? range.end : range.end + 1;
  const lines = [];
  for (let line = start; line <= end; line++) lines.push(cm.getLine(line));
  if (direction < 0) lines.push(lines.shift());
  else lines.unshift(lines.pop());
  cm.operation(() => {
    cm.replaceRange(lines.join('\n'), {line:start,ch:0}, {line:end,ch:cm.getLine(end).length}, 'tinkercode-move');
    cm.setSelection({line:anchor.line + direction,ch:anchor.ch}, {line:head.line + direction,ch:head.ch});
  });
}
export function attachHotkeys(cm) {
  cm.addKeyMap({
    'Ctrl-/': toggleComments,
    'Shift-Alt-Up': editor => duplicateLines(editor, -1),
    'Shift-Alt-Down': editor => duplicateLines(editor, 1),
    'Alt-Up': editor => moveLines(editor, -1),
    'Alt-Down': editor => moveLines(editor, 1),
  });
}



