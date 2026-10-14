import { defaults } from '../src/shortcuts.mjs';
import { functionHintAt, attachFunctionHover } from '../src/hover.mjs';
import { toggleComments, duplicateLines, moveLines, attachHotkeys } from '../src/hotkeys.mjs';
import { createHintProvider } from '../src/hints.mjs';
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
  assert.equal(cm.getValue(), 'digitalWrite(13, HIGH);');
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
  assert.equal(cm.getValue(), item.displayText + ';');
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




for (const prefix of ['h', 'H', 'hi', 'HI', 'high']) {
  test(`constant completion inside a snippet preserves navigation: ${prefix}`, t => {
    const {cm, snippets, key} = setup(t);
    cm.replaceSelection('13', 'end', '+input');
    key('Tab');
    cm.replaceSelection(prefix, 'end', '+input');
    const hint = createHintProvider(snippets);
    assert.equal(hint(cm).list[0].text, 'HIGH');
    cm.showHint({hint, completeSingle:false});
    key('Tab'); // Accept suggestion before advancing the snippet.
    assert.equal(cm.getValue(), 'digitalWrite(13, HIGH);');
    assert.equal(snippets.active(), true);
    key('Shift-Tab');
    assert.equal(cm.getSelection(), '13');
    key('Tab');
    assert.equal(cm.getSelection(), 'HIGH');
    key('Tab');
    assert.equal(snippets.active(), false);
    assert.equal(cm.getCursor().ch, cm.getValue().length);
  });
}
test('Escape dismisses a constant suggestion without ending the snippet', t => {
  const {cm, snippets, key} = setup(t);
  cm.replaceSelection('13', 'end', '+input');
  key('Tab');
  cm.replaceSelection('lo', 'end', '+input');
  const hint = createHintProvider(snippets);
  assert.equal(hint(cm).list[0].text, 'LOW');
  cm.showHint({hint, completeSingle:false});
  key('Esc');
  assert.equal(snippets.active(), true);
  key('Tab');
  assert.equal(snippets.active(), false);
});

test('declared variables complete inside placeholders without ending navigation', t => {
  const {cm, snippets, key} = setup(t);
  // Add a declaration before starting a fresh snippet.
  cm.setValue('const int ledPin = 13;\ndigitalW');
  cm.setCursor({line:1,ch:8});
  snippets.insert(item, {from:{line:1,ch:0}, to:{line:1,ch:8}});
  cm.replaceSelection('led', 'end', '+input');
  const hint = createHintProvider(snippets);
  assert.equal(hint(cm).list[0].text, 'ledPin');
  cm.showHint({hint, completeSingle:false});
  key('Tab');
  assert.equal(snippets.active(), true);
  key('Tab');
  assert.equal(cm.getSelection(), 'value');
  assert.equal(cm.getLine(1), 'digitalWrite(ledPin, value);');
});

test('variable index updates after declarations are renamed or removed', async t => {
  const {cm, snippets} = setup(t);
  cm.setValue('int oldPin;\nold');
  cm.setCursor({line:1,ch:3});
  const hint = createHintProvider(snippets);
  assert.equal(hint(cm).list[0].text, 'oldPin');
  cm.setValue('int newPin;\nnew');
  cm.setCursor({line:1,ch:3});
  await new Promise(resolve => setTimeout(resolve, 160));
  assert.equal(hint(cm).list[0].text, 'newPin');
  cm.setValue('old');
  cm.setCursor({line:0,ch:3});
  await new Promise(resolve => setTimeout(resolve, 160));
  assert.equal(hint(cm), null);
});

test('function descriptions are rendered separately from insertion text', t => {
  const {cm, snippets} = setup(t);
  cm.setValue('analogW');
  cm.setCursor({line:0,ch:7});
  const hint = createHintProvider(snippets);
  const completion = hint(cm).list[0];
  assert.equal(completion.text, 'analogWrite');
  assert.equal(completion.displayText, 'analogWrite(pin, value)');
  assert.match(completion.description, /PWM/);
  cm.showHint({hint, completeSingle:false});
  const row = document.querySelector('.CodeMirror-hints .CodeMirror-hint');
  assert.equal(row.querySelector('.tinkercode-signature').textContent, completion.displayText);
  assert.equal(row.title, completion.description);
  assert.equal(row.textContent, completion.displayText);
  assert.equal(row.querySelector('.tinkercode-description'), null);
  cm.state.completionActive.pick(cm.state.completionActive.data, 0);
  assert.equal(cm.getValue(), 'analogWrite(pin, value);');
  assert.equal(cm.getSelection(), 'pin');
});


// Editor interactions use the same real CodeMirror instance as snippet tests.

test('hover identifies written function calls and Serial methods', t => {
  const {cm} = setup(t);
  cm.setValue('digitalWrite(1, 1);\nSerial.println(42);\nother.digitalWrite(1, 1);');
  assert.match(functionHintAt(cm, {line:0,ch:4}), /digitalWrite\(pin, value\).*\nSet a digital/s);
  assert.match(functionHintAt(cm, {line:1,ch:9}), /Serial.println/);
  assert.equal(functionHintAt(cm, {line:0,ch:15}), null);
  assert.equal(functionHintAt(cm, {line:2,ch:10}), null);
  const original = cm.getTokenAt;
  cm.getTokenAt = () => ({type:'comment'});
  assert.equal(functionHintAt(cm, {line:0,ch:4}), null);
  cm.getTokenAt = () => ({type:'string'});
  assert.equal(functionHintAt(cm, {line:0,ch:4}), null);
  cm.getTokenAt = original;
});
test('hover tooltip clears on mouse leave', t => {
  const {cm} = setup(t);
  cm.setValue('digitalWrite(1, 1);');
  cm.coordsChar = () => ({line:0,ch:3});
  attachFunctionHover(cm);
  const token = cm.getWrapperElement().querySelector('.CodeMirror-line span');
  token.dispatchEvent(new window.MouseEvent('mousemove', {bubbles:true}));
  assert.match(token.title, /digitalWrite/);
  cm.getWrapperElement().dispatchEvent(new window.MouseEvent('mouseleave'));
  assert.equal(token.hasAttribute('title'), false);
});
test('comment shortcut toggles selected lines with indentation and one-step undo', t => {
  const {cm, key} = setup(t);
  attachHotkeys(cm);
  cm.setValue('  first();\n  second();\nthird();');
  cm.setSelection({line:0,ch:0},{line:2,ch:0});
  key('Ctrl-/');
  assert.equal(cm.getValue(), '  // first();\n  // second();\nthird();');
  key('Ctrl-/');
  assert.equal(cm.getValue(), '  first();\n  second();\nthird();');
  cm.undo();
  assert.equal(cm.getValue(), '  // first();\n  // second();\nthird();');
});
test('duplicate and move shortcuts preserve blocks and cursor position', t => {
  const {cm,key} = setup(t);
  attachHotkeys(cm);
  cm.setValue('one\ntwo\nthree');
  cm.setCursor({line:1,ch:2});
  key('Shift-Alt-Down');
  assert.equal(cm.getValue(), 'one\ntwo\ntwo\nthree');
  assert.deepEqual({...cm.getCursor()}, {line:2,ch:2});
  key('Alt-Down');
  assert.equal(cm.getValue(), 'one\ntwo\nthree\ntwo');
  key('Alt-Up');
  assert.equal(cm.getValue(), 'one\ntwo\ntwo\nthree');
  cm.undo();
  assert.equal(cm.getValue(), 'one\ntwo\nthree\ntwo');
});
test('line operations respect selections, document boundaries, and read-only mode', t => {
  const {cm} = setup(t);
  cm.setValue('a\nb\nc\nd');
  cm.setSelection({line:1,ch:0},{line:3,ch:0});
  moveLines(cm,-1);
  assert.equal(cm.getValue(),'b\nc\na\nd');
  moveLines(cm,-1);
  assert.equal(cm.getValue(),'b\nc\na\nd');
  duplicateLines(cm);
  assert.equal(cm.getValue(),'b\nc\nb\nc\na\nd');
  cm.setOption('readOnly',true);
  toggleComments(cm); duplicateLines(cm); moveLines(cm,1);
  assert.equal(cm.getValue(),'b\nc\nb\nc\na\nd');
});



test('Alt+Shift+Up duplicates above and keeps the selection on the new copy', t => {
  const {cm,key} = setup(t);
  attachHotkeys(cm);
  cm.setValue('a\nb\nc\nd');
  cm.setSelection({line:1,ch:0},{line:3,ch:0});
  key('Shift-Alt-Up');
  assert.equal(cm.getValue(), 'a\nb\nc\nb\nc\nd');
  assert.equal(cm.getSelection(), 'b\nc\n');
  assert.equal(cm.getCursor('from').line, 1);
  cm.undo();
  assert.equal(cm.getValue(), 'a\nb\nc\nd');
  cm.setCursor({line:0,ch:1});
  key('Shift-Alt-Up');
  assert.equal(cm.getValue(), 'a\na\nb\nc\nd');
  assert.equal(cm.getCursor().line, 0);
});

test('updating shortcut settings removes old bindings and applies new ones', t => {
  const {cm,key} = setup(t);
  attachHotkeys(cm);
  cm.setValue('a\nb'); cm.setCursor({line:0,ch:0});
  let invoked=0;
  attachHotkeys(cm,{...defaults,comment:'Ctrl-K',duplicateUp:'',complete:'Alt-Space'},()=>invoked++);
  key('Ctrl-K');
  assert.equal(cm.getLine(0),'// a');
  key('Alt-Space');
  assert.equal(invoked,1);
  assert.ok(!cm.state.keyMaps.some(map => map['Ctrl-/']));
  assert.ok(!cm.state.keyMaps.some(map => map['Shift-Alt-Up']));
  attachHotkeys(cm,defaults);
  assert.ok(!cm.state.keyMaps.some(map => map['Ctrl-K']));
  key('Ctrl-/');
  assert.equal(cm.getLine(0),'a');
});
