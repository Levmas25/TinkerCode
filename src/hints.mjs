import { renderHint } from './descriptions.mjs';
import { createSketchIndex } from './variables.mjs';
import { complete, completionPrefix } from './completions.mjs';

export function showCompletion(editor, hint) {
  const initial = hint(editor);
  if (!initial) return;
  let first = true;
  editor.showHint({completeSingle:false, hint:cm => {
    if (!first) return hint(cm);
    first = false;
    return initial;
  }});
}

export function createHintProvider(snippets) {
  const indexes = new WeakMap();
  return function hint(editor) {
    if (editor.getOption('readOnly') || editor.somethingSelected()) return null;
    const pos = editor.getCursor();
    const line = editor.getLine(pos.line);
    if (!completionPrefix(line, pos.ch)) return null;
    if (/comment|string/.test(editor.getTokenAt(pos).type ?? '')) return null;
    if (!indexes.has(editor)) indexes.set(editor, createSketchIndex(editor));
    const symbols = indexes.get(editor)();
    const result = complete(line, pos.ch, symbols.variablesAt(editor.indexFromPos(pos)), symbols.functions);
    if (!result) return null;
    // Nested function snippets are not supported; constants keep the current session.
    const matches = result.list.filter(item => !snippets.active() || (item.kind !== 'control' && !item.displayText.includes('(')));
    if (!matches.length) return null;
    return {
      list: matches.map(item => ({...item, render: renderHint, hint: (_cm, data, completion) => snippets.insert(completion, data)})),
      from: {line: pos.line, ch: result.start},
      to: {line: pos.line, ch: result.end},
    };
  };
}
