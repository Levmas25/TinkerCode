import { complete } from './completions.mjs';

export function createHintProvider(snippets) {
  return function hint(editor) {
    if (editor.getOption('readOnly') || editor.somethingSelected()) return null;
    const pos = editor.getCursor();
    if (/comment|string/.test(editor.getTokenAt(pos).type ?? '')) return null;
    const result = complete(editor.getLine(pos.line), pos.ch);
    if (!result) return null;
    // Nested function snippets are not supported; constants keep the current session.
    const matches = result.list.filter(item => !snippets.active() || !item.displayText.includes('('));
    if (!matches.length) return null;
    return {
      list: matches.map(item => ({...item, hint: (_cm, data, completion) => snippets.insert(completion, data)})),
      from: {line: pos.line, ch: result.start},
      to: {line: pos.line, ch: result.end},
    };
  };
}
