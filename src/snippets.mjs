// Produce insertion text and argument ranges without depending on the editor.
export function planSnippet(item, followingText, standalone = false) {
  const signature = item.displayText;
  const open = signature.indexOf('(');
  if (open < 0 || /^\s*\(/.test(followingText)) {
    return { text: item.text, fields: [] };
  }
  const fields = [];
  const argumentsText = signature.slice(open + 1, -1);
  const pattern = /[^,\s][^,]*/g;
  for (const match of argumentsText.matchAll(pattern)) {
    const label = match[0].trimEnd();
    fields.push({ start: open + 1 + match.index, end: open + 1 + match.index + label.length });
  }
  const terminator = standalone && /^\s*(?:\/\/.*)?$/.test(followingText) ? ';' : '';
  return { text: signature + terminator, fields };
}

export function createSnippets(cm) {
  let session = null;
  function stop() {
    if (!session) return;
    const old = session;
    session = null;
    cm.removeKeyMap(old.keys);
    old.fields.forEach(mark => mark.clear());
    old.end.clear();
    cm.off('beforeChange', beforeChange);
    cm.off('cursorActivity', cursorActivity);
    cm.off('blur', stop);
  }
  function inside(pos, range) {
    return pos.line === range.from.line && pos.line === range.to.line &&
      pos.ch >= range.from.ch && pos.ch <= range.to.ch;
  }
  function beforeChange(_cm, change) {
    const range = session?.fields[session.index].find();
    if (!range || change.origin === 'undo' || change.origin === 'redo' ||
      change.text.length !== 1 || !inside(change.from, range) || !inside(change.to, range)) stop();
  }
  function cursorActivity() {
    if (!session) return;
    const range = session.fields[session.index].find();
    const selections = cm.listSelections();
    if (!range || selections.length !== 1 ||
      !inside(selections[0].anchor, range) || !inside(selections[0].head, range)) stop();
  }
  function select(index) {
    if (!session) return;
    if (index >= session.fields.length) {
      const end = session.end.find();
      stop();
      if (end) cm.setCursor(end);
      return;
    }
    session.index = Math.max(0, index);
    const range = session.fields[session.index].find();
    if (!range) return stop();
    cm.setSelection(range.from, range.to);
  }
  return {
    active: () => !!session,
    insert(item, data) {
      const from = item.from || data.from;
      const to = item.to || data.to;
      if (session && !item.displayText.includes('(')) {
        cm.operation(() => {
          cm.replaceRange(item.text, from, to, 'complete');
          cm.setCursor({line: from.line, ch: from.ch + item.text.length});
        });
        return;
      }
      stop();
      const plan = planSnippet(item, cm.getLine(to.line).slice(to.ch), isStatementStart(cm.getRange({line: 0, ch: 0}, from)));
      cm.operation(() => {
        cm.replaceRange(plan.text, from, to, 'complete');
        const pos = offset => ({ line: from.line, ch: from.ch + offset });
        const end = pos(plan.text.length);
        if (!plan.fields.length) { cm.setCursor(end); return; }
        const fields = plan.fields.map(field => cm.markText(pos(field.start), pos(field.end), {
          inclusiveLeft: true, inclusiveRight: true, clearWhenEmpty: false,
        }));
        const keys = {
          Tab: () => select(session.index + 1),
          'Shift-Tab': () => select(session.index - 1),
          Esc: stop,
        };
        session = { fields, end: cm.setBookmark(end, { insertLeft: true }), keys, index: 0 };
        cm.addKeyMap(keys);
        select(0);
        cm.on('beforeChange', beforeChange);
        cm.on('cursorActivity', cursorActivity);
        cm.on('blur', stop);
      });
    },
  };
}

// Conservative statement detection, run only when a completion is accepted.
export function isStatementStart(source) {
  const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, token =>
    token.startsWith('/') ? ' ' : 'literal');
  let parentheses = 0;
  let brackets = 0;
  for (const char of code) {
    if (char === '(') parentheses++;
    if (char === ')') parentheses--;
    if (char === '[') brackets++;
    if (char === ']') brackets--;
  }
  return parentheses === 0 && brackets === 0 && /(?:^|[;{}])\s*$/.test(code);
}


