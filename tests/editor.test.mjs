import { defaults } from '../src/shortcuts.mjs';
import { functionHintAt, attachFunctionHover } from '../src/hover.mjs';
import { toggleComments, duplicateLines, moveLines, attachHotkeys } from '../src/hotkeys.mjs';
import { createHintProvider, showCompletion } from '../src/hints.mjs';
import { createSketchIndex, collectSketch } from '../src/variables.mjs';
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

test('for snippet navigates header fields and indented body', t => {
  const {cm,snippets,key} = setup(t);
  cm.setOption('indentUnit', 2);
  cm.setValue('void loop() {\n  for\n}');
  cm.setCursor({line:1,ch:5});
  const hint=createHintProvider(snippets);
  cm.showHint({hint,completeSingle:false});
  key('Tab');
  assert.equal(cm.getValue(),'void loop() {\n  for (int i = 0; i < count; i++) {\n    \n  }\n}');
  assert.equal(cm.getSelection(),'int i = 0');
  cm.replaceSelection('int n = 1','end','+input');
  key('Tab'); assert.equal(cm.getSelection(),'i < count');
  cm.replaceSelection('n < 10','end','+input');
  key('Tab'); assert.equal(cm.getSelection(),'i++');
  cm.replaceSelection('n++','end','+input');
  key('Tab'); assert.equal(cm.getCursor().line,2); assert.equal(cm.getCursor().ch,4);
  cm.replaceSelection('delay(100);','end','+input');
  key('Shift-Tab'); assert.equal(cm.getSelection(),'n++');
  key('Tab'); assert.equal(cm.getSelection(),'delay(100);');
  key('Tab'); assert.equal(snippets.active(),false); assert.equal(cm.getCursor().line,3);
});
test('for completion preserves an existing opening parenthesis', t => {
  const {cm,snippets} = setup(t);
  cm.setValue('fo (int i=0; i<3; i++) {}');
  snippets.insert({text:'for',displayText:'for (initialization; condition; increment)'},{from:{line:0,ch:0},to:{line:0,ch:2}});
  assert.equal(cm.getValue(),'for (int i=0; i<3; i++) {}');
  assert.equal(snippets.active(),false);
});

test('for snippet respects tab indentation and undoes as one insertion', t => {
  const {cm,snippets,key} = setup(t);
  cm.setOption('indentWithTabs',true);
  cm.setValue('void loop() {\n\tFOR\n}');
  cm.setCursor({line:1,ch:4});
  const hint=createHintProvider(snippets);
  cm.showHint({hint,completeSingle:false});
  key('Enter');
  assert.equal(cm.getValue(),'void loop() {\n\tfor (int i = 0; i < count; i++) {\n\t\t\n\t}\n}');
  cm.undo();
  assert.equal(cm.getValue(),'void loop() {\n\tFOR\n}');
  assert.equal(snippets.active(),false);
});

test('Alt+L selects entire lines including the newline, and extends on repeat', t => {
  const {cm,key} = setup(t);
  attachHotkeys(cm);
  cm.setValue('  first();\nsecond();\nthird();');
  cm.setCursor({line:0,ch:4});
  key('Alt-L');
  assert.equal(cm.getSelection(),'  first();\n');
  key('Alt-L');
  assert.equal(cm.getSelection(),'  first();\nsecond();\n');
  key('Alt-L');
  assert.equal(cm.getSelection(),cm.getValue());
  key('Alt-L');
  assert.equal(cm.getSelection(),cm.getValue());
});
test('line selection handles empty and final lines and remains available read-only', t => {
  const {cm,key} = setup(t);
  attachHotkeys(cm);
  cm.setValue('first\n\nlast');
  cm.setCursor({line:1,ch:0});
  key('Alt-L');
  assert.equal(cm.getSelection(),'\n');
  cm.setOption('readOnly',true);
  cm.setCursor({line:2,ch:2});
  key('Alt-L');
  assert.equal(cm.getSelection(),'last');
  assert.equal(cm.getValue(),'first\n\nlast');
});

for (const [name, fields] of [['if',['condition','']],['ifelse',['condition','','']],['else',['']],['while',['condition','']],['switch',['expression','value','','']]]) {
  test(`${name} snippet navigates each field and exits after the block`, t => {
    const {cm,snippets,key} = setup(t);
    cm.setOption('indentUnit',2);
    cm.setValue('  '+name); cm.setCursor({line:0,ch:name.length+2});
    const hint=createHintProvider(snippets);
    cm.showHint({hint,completeSingle:false});
    key('Enter');
    assert.match(cm.getValue(), /\n/);
    assert.ok(cm.getValue().endsWith('\n  }'));
    for (const field of fields) {
      assert.equal(cm.getSelection(),field);
      key('Tab');
    }
    assert.equal(snippets.active(),false);
    assert.equal(cm.getCursor().ch,3);
    cm.undo();
    assert.equal(cm.getValue(),'  '+name);
  });
}

test('sketch function completion displays typed signature and inserts argument fields', t => {
  const {cm,snippets,key} = setup(t);
  cm.setValue('void blink(int pin, unsigned long duration) {}\nBLI');
  cm.setCursor({line:1,ch:3});
  const hint=createHintProvider(snippets);
  const first=hint(cm).list[0];
  assert.equal(first.displayText,'blink(int pin, unsigned long duration)');
  cm.showHint({hint,completeSingle:false});
  key('Enter');
  assert.equal(cm.getLine(1),'blink(pin, duration);');
  assert.equal(cm.getSelection(),'pin');
  cm.replaceSelection('13','end','+input');
  key('Tab'); assert.equal(cm.getSelection(),'duration');
  cm.replaceSelection('100','end','+input');
  key('Tab'); assert.equal(snippets.active(),false);
  assert.equal(cm.getLine(1),'blink(13, 100);');
});
test('sketch calls in expressions do not add semicolons or duplicate parentheses', t => {
  const {cm,snippets} = setup(t);
  cm.setValue('int readSensor(int pin) { return pin; }\nint result = readS(1);');
  cm.setCursor({line:1,ch:18});
  const hint=createHintProvider(snippets);
  let data=hint(cm);
  assert.ok(data);
  data.list[0].hint(cm,data,data.list[0]);
  assert.equal(cm.getLine(1),'int result = readSensor(1);');
  cm.setValue('int readSensor(int pin) { return pin; }\nint result = readS');
  cm.setCursor({line:1,ch:18});
  data=createHintProvider(snippets)(cm);
  data.list[0].hint(cm,data,data.list[0]);
  assert.equal(cm.getLine(1),'int result = readSensor(pin)');
});
test('sketch function index removes old names and offers renamed definitions', async t => {
  const {cm,snippets} = setup(t);
  cm.setValue('void oldFunction() {}\noldF'); cm.setCursor({line:1,ch:4});
  const hint=createHintProvider(snippets);
  assert.equal(hint(cm).list[0].text,'oldFunction');
  cm.setValue('void newFunction() {}\nnewF'); cm.setCursor({line:1,ch:4});
  await new Promise(resolve=>setTimeout(resolve,160));
  assert.equal(hint(cm).list[0].text,'newFunction');
  cm.setValue('oldF'); cm.setCursor({line:0,ch:4});
  await new Promise(resolve=>setTimeout(resolve,160));
  assert.equal(hint(cm),null);
});

test('hint provider follows the cursor between function scopes without editing', t => {
  const {cm,snippets} = setup(t);
  cm.setValue('int localGlobal = 13;\nvoid first(int localParam) {\n int localFirst;\n loc\n}\nvoid second() {\n int localSecond;\n loc\n}\nloc');
  const hint=createHintProvider(snippets);
  cm.setCursor({line:3,ch:4});
  let names=hint(cm).list.map(item=>item.text);
  assert.ok(names.includes('localGlobal'));
  assert.ok(names.includes('localParam'));
  assert.ok(names.includes('localFirst'));
  assert.ok(!names.includes('localSecond'));
  cm.setCursor({line:7,ch:4});
  names=hint(cm).list.map(item=>item.text);
  assert.ok(names.includes('localGlobal'));
  assert.ok(names.includes('localSecond'));
  assert.ok(!names.includes('localParam'));
  assert.ok(!names.includes('localFirst'));
  cm.setCursor({line:9,ch:3});
  assert.deepEqual(hint(cm).list.map(item=>item.text),['localGlobal']);
});
test('scope index refreshes immediately after structural edits, before the debounce', t => {
  const {cm,snippets} = setup(t);
  cm.setValue('void first(int localParam) { int localValue;\nloc\n}');
  cm.setCursor({line:1,ch:3});
  const hint=createHintProvider(snippets);
  assert.ok(hint(cm).list.some(item=>item.text==='localValue'));
  cm.replaceRange('}\n',{line:1,ch:0});
  cm.setCursor({line:2,ch:3});
  assert.equal(hint(cm),null);
  cm.replaceRange('',{line:1,ch:0},{line:2,ch:0});
  cm.setCursor({line:1,ch:3});
  assert.ok(hint(cm).list.some(item=>item.text==='localParam'));
});

test('punctuation does not read or index the document for completion', t => {
  const {cm, snippets} = setup(t);
  cm.setValue('void loop() {\n ;\n}');
  cm.setCursor({line:1,ch:2});
  cm.getValue = () => { throw new Error('Unexpected document scan'); };
  assert.equal(createHintProvider(snippets)(cm), null);
});

test('opening completion computes hints once and later updates use fresh hints', t => {
  const {cm} = setup(t);
  cm.closeHint();
  cm.setCursor({line:0,ch:0});
  let calls = 0;
  const hint = () => ({list:[{text:'digitalWrite', displayText:`result ${++calls}`}],
    from:{line:0,ch:0}, to:cm.getCursor()});
  showCompletion(cm, hint);
  assert.equal(calls, 1);
  assert.equal(cm.state.completionActive.data.list[0].displayText, 'result 1');
  cm.state.completionActive.update();
  assert.equal(calls, 2);
  assert.equal(cm.state.completionActive.data.list[0].displayText, 'result 2');
  cm.closeHint();
  showCompletion(cm, () => null);
  assert.equal(cm.state.completionActive, null);
});

test('reference edits reuse the index and keep later scopes aligned', t => {
  const {cm} = setup(t);
  cm.setValue('int global; void first(int param) { int local; glob; }\nvoid second(int input) { int other; glo; }');
  const index = createSketchIndex(cm);
  const getValue = cm.getValue.bind(cm);
  let reads = 0;
  cm.getValue = () => { reads++; return getValue(); };
  for (const text of ['global', 'g', 'globalAgain']) {
    const line = cm.getLine(0);
    const start = line.indexOf('int local; ') + 'int local; '.length;
    const end = line.indexOf(';', start);
    cm.replaceRange(text, {line:0,ch:start}, {line:0,ch:end});
    const fresh = collectSketch(getValue());
    for (const pos of [{line:0,ch:start+text.length}, {line:1,ch:cm.getLine(1).indexOf('glo;')+3}]) {
      const offset = cm.indexFromPos(pos);
      assert.deepEqual(index().variablesAt(offset), fresh.variablesAt(offset));
    }
  }
  assert.equal(reads, 0);
  cm.replaceRange('renamed', {line:0,ch:4}, {line:0,ch:10});
  assert.ok(index().variablesAt(cm.indexFromPos({line:1,ch:cm.getLine(1).length-2})).includes('renamed'));
  assert.equal(reads, 1);
});

test('batched and structural-word edits rebuild instead of reusing scope offsets', t => {
  const {cm} = setup(t);
  cm.setValue('void loop() { int local; loc; loc; }');
  const index = createSketchIndex(cm);
  cm.operation(() => {
    cm.replaceRange('longer', {line:0,ch:24}, {line:0,ch:27});
    cm.replaceRange('int', {line:0,ch:32}, {line:0,ch:35});
  });
  const source = cm.getValue();
  for (let offset = 0; offset <= source.length; offset++) {
    assert.deepEqual(index().variablesAt(offset), collectSketch(source).variablesAt(offset));
  }
});
