import { renderHint } from './descriptions.mjs';
import { createVariableIndex } from './variables.mjs';
import { complete } from './completions.mjs';

export function createHintProvider(snippets) {
  const indexes = new WeakMap();
  return function hint(editor) {
    if (editor.getOption('readOnly') || editor.somethingSelected()) return null;
    const pos = editor.getCursor();
    if (/comment|string/.test(editor.getTokenAt(pos).type ?? '')) return null;
    if (!indexes.has(editor)) indexes.set(editor, createVariableIndex(editor));
    const result = complete(editor.getLine(pos.line), pos.ch, indexes.get(editor)());
    if (!result) return null;
    // Nested function snippets are not supported; constants keep the current session.
    const matches = result.list.filter(item => !snippets.active() || !item.displayText.includes('('));
    if (!matches.length) return null;
    return {
      list: matches.map(item => ({...item, render: renderHint, hint: (_cm, data, completion) => snippets.insert(completion, data)})),
      from: {line: pos.line, ch: result.start},
      to: {line: pos.line, ch: result.end},
    };
  };
}


