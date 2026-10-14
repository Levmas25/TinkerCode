import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createSnippets } from '../src/snippets.mjs';
import { installHints } from '../src/hint-addon.js';
const dom = new JSDOM('<!doctype html><body></body>', {pretendToBeVisual:true});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', {value: dom.window.navigator, configurable:true});
const rect = () => ({left:0,right:0,top:0,bottom:0,width:0,height:0});
dom.window.Range.prototype.getBoundingClientRect = rect;
dom.window.Range.prototype.getClientRects = () => [];
const {default: CodeMirror} = await import('codemirror');
installHints(CodeMirror);
const item = {text:'digitalWrite', displayText:'digitalWrite(pin, value)'};
function setup(t) {
  const host = document.body.appendChild(document.createElement('div'));
  const cm = CodeMirror(host, {value:'digitalW'});
  cm.setCursor({line:0,ch:8});
  const snippets = createSnippets(cm);
  // Exercise the actual completion pick path, including its operation and cursor events.
  cm.showHint({completeSingle:false, hint: () => ({
    list:[{...item, hint:(_cm,data,completion) => snippets.insert(completion,data)}],
    from:{line:0,ch:0}, to:{line:0,ch:8},
  })});
  cm.state.completionActive.pick(cm.state.completionActive.data, 0);
  t.after(() => { cm.getInputField().blur(); host.remove(); });
  const key = name => { for (const map of cm.state.keyMaps) { if (CodeMirror.lookupKey(name, map, handler => {handler(cm); return true;}) === 'handled') return; } throw new Error('Unbound key: ' + name); };
  return {cm,snippets,key};
}
test('completion creates editable placeholders and tracks their changed lengths', t => {
  const {cm,snippets,key} = setup(t);
  assert.equal(cm.getSelection(), 'pin');
  cm.replaceSelection('13', 'end', '+input');
  assert.equal(snippets.active(), true);
  key('Tab');
  assert.equal(cm.getSelection(), 'value');
  cm.replaceSelection('HIGH', 'end', '+input');
  key('Shift-Tab');
  assert.equal(cm.getSelection(), '13');
  key('Tab');
  assert.equal(cm.getSelection(), 'HIGH');
  key('Tab');
  assert.equal(snippets.active(), false);
  assert.equal(cm.getValue(), 'digitalWrite(13, HIGH)');
  assert.equal(cm.getCursor().ch, cm.getValue().length);
});
test('empty arguments retain a Tab stop', t => {
  const {cm,snippets,key} = setup(t);
  cm.replaceSelection('', 'end', '+delete');
  key('Tab');
  assert.equal(cm.getSelection(), 'value');
  key('Shift-Tab');
  assert.equal(snippets.active(), true);
  cm.replaceSelection('7', 'end', '+input');
  key('Tab');
  assert.equal(cm.getSelection(), 'value');
});
test('Escape preserves code and removes snippet navigation', t => {
  const {cm,snippets,key} = setup(t);
  key('Esc');
  assert.equal(snippets.active(), false);
  assert.equal(cm.getValue(), item.displayText);
});
test('undo exits snippet mode and restores original input', t => {
  const {cm,snippets} = setup(t);
  cm.undo();
  assert.equal(snippets.active(), false);
  assert.equal(cm.getValue(), 'digitalW');
});
test('moving outside the active placeholder exits snippet mode', t => {
  const {cm,snippets} = setup(t);
  cm.setCursor({line:0,ch:0});
  assert.equal(snippets.active(), false);
});
test.after(() => dom.window.close());


