import { descriptions } from './descriptions.mjs';
import { entries } from './completions.mjs';
const signatures = new Map(entries);

export function functionHintAt(cm, pos) {
  const line = cm.getLine(pos.line);
  for (const match of line.matchAll(/[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*/g)) {
    if (pos.ch < match.index || pos.ch >= match.index + match[0].length) continue;
    const name = match[0];
    if (!Object.hasOwn(descriptions, name) || !/^\s*\(/.test(line.slice(match.index + name.length))) return null;
    if (/[\w.>]/.test(line[match.index - 1] ?? '')) return null;
    const type = cm.getTokenAt({line: pos.line, ch: match.index + 1}).type ?? '';
    if (/comment|string/.test(type)) return null;
    return `${signatures.get(name)}\n${descriptions[name]}`;
  }
  return null;
}

export function attachFunctionHover(cm) {
  const wrapper = cm.getWrapperElement();
  let target = null;
  let previousTitle = null;
  function clear() {
    if (target) {
      if (previousTitle === null) target.removeAttribute('title');
      else target.setAttribute('title', previousTitle);
    }
    target = null;
  }
  wrapper.addEventListener('mousemove', event => {
    const element = event.target;
    if (!(element instanceof wrapper.ownerDocument.defaultView.Element) ||
        !element.closest('.CodeMirror-line')) { clear(); return; }
    const pos = cm.coordsChar({left: event.clientX, top: event.clientY}, 'window');
    const hint = functionHintAt(cm, pos);
    if (!hint) { clear(); return; }
    if (target !== element) {
      clear();
      target = element;
      previousTitle = element.getAttribute('title');
    }
    if (target.title !== hint) target.title = hint;
  });
  wrapper.addEventListener('mouseleave', clear);
  cm.on('scroll', clear);
  cm.on('changes', clear);
}
