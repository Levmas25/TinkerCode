import { descriptions } from './descriptions.mjs';
import { entries } from './completions.mjs';
const signatures = new Map(entries);

export function functionHintAt(cm, pos) {
  return functionHintRangeAt(cm, pos)?.hint ?? null;
}

function functionHintRangeAt(cm, pos) {
  const line = cm.getLine(pos.line);
  for (const match of line.matchAll(/[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*/g)) {
    if (pos.ch < match.index || pos.ch >= match.index + match[0].length) continue;
    const name = match[0];
    if (!Object.hasOwn(descriptions, name) || !/^\s*\(/.test(line.slice(match.index + name.length))) return null;
    if (/[\w.>]/.test(line[match.index - 1] ?? '')) return null;
    const type = cm.getTokenAt({line: pos.line, ch: match.index + 1}).type ?? '';
    if (/comment|string/.test(type)) return null;
    return {line:pos.line, from:match.index, to:match.index + name.length,
      hint:`${signatures.get(name)}\n${descriptions[name]}`};
  }
  return null;
}

export function attachFunctionHover(cm) {
  const wrapper = cm.getWrapperElement();
  const view = wrapper.ownerDocument.defaultView;
  let target = null;
  let previousTitle = null;
  let frame = null;
  let pending = null;
  let cached = null;
  function clear() {
    if (target) {
      if (previousTitle === null) target.removeAttribute('title');
      else target.setAttribute('title', previousTitle);
    }
    target = null;
  }
  function reset() {
    if (frame !== null) view.cancelAnimationFrame(frame);
    frame = null;
    pending = null;
    cached = null;
    clear();
  }
  function update() {
    frame = null;
    const {element, left, top} = pending;
    pending = null;
    const pos = cm.coordsChar({left, top}, 'window');
    if (!cached || cached.line !== pos.line || pos.ch < cached.from || pos.ch >= cached.to) {
      cached = functionHintRangeAt(cm, pos) ?? {line:pos.line, from:pos.ch, to:pos.ch+1, hint:null};
    }
    const hint = cached.hint;
    if (!hint) { clear(); return; }
    if (target !== element) {
      clear();
      target = element;
      previousTitle = element.getAttribute('title');
    }
    if (target.title !== hint) target.title = hint;
  }
  wrapper.addEventListener('mousemove', event => {
    const element = event.target;
    if (!(element instanceof view.Element) || !element.closest('.CodeMirror-line')) { reset(); return; }
    pending = {element, left:event.clientX, top:event.clientY};
    if (frame === null) frame = view.requestAnimationFrame(update);
  });
  wrapper.addEventListener('mouseleave', reset);
  cm.on('scroll', reset);
  cm.on('changes', reset);
}
