import test from 'node:test';
import assert from 'node:assert/strict';
import {collectSketch} from '../src/variables.mjs';
function visible(marked) {
  const cursor=marked.indexOf('|');
  assert.ok(cursor>=0);
  const source=marked.replace('|','');
  return collectSketch(source).variablesAt(cursor);
}
test('globals, parameters, locals and declarations after the cursor',()=>{
  const names=visible(`int globalPin=13;
    void first(int firstParam) { int firstLocal; }
    void second(int secondParam) { int local; | int later; }
    int laterGlobal;`);
  assert.ok(names.includes('globalPin'));
  assert.ok(names.includes('secondParam'));
  assert.ok(names.includes('local'));
  for (const name of ['firstParam','firstLocal','later','laterGlobal']) assert.ok(!names.includes(name),name);
});
test('nested and sibling blocks do not leak variables',()=>{
  assert.deepEqual(visible('void loop() { { int hidden; } { int visible; | } }'),['visible']);
  assert.deepEqual(visible('int global; void loop() { int outer; { int inner; | } }'),['inner','outer','global']);
  assert.deepEqual(visible('int global; void loop() { int outer; { int inner; } | }'),['outer','global']);
});
test('parameters in prototypes never leak; matching definitions use their own parameter names',()=>{
  assert.deepEqual(visible('void blink(int protoParam); void blink(int pin) { | }'),['pin']);
  assert.deepEqual(visible('void blink(int param) {} |'),[]);
});
test('for variables stay within their loop header and body',()=>{
  assert.deepEqual(visible('void loop() { for(int index=0; | index<3; index++) {} }'),['index']);
  assert.deepEqual(visible('void loop() { for(int index=0; index<3; index++) { | } }'),['index']);
  assert.deepEqual(visible('void loop() { for(int index=0; index<3; index++) {} | }'),[]);
  assert.deepEqual(visible('void loop() { for(int index=0; index<3; index++) delay(index); | }'),[]);
  assert.deepEqual(visible('void loop() { for(int index=0; index<3; index++) delay(|); }'),['index']);
});
test('if initializer stays visible in else and ends after the whole conditional',()=>{
  assert.deepEqual(visible('void loop() { if(int value=read()) {} else { | } }'),['value']);
  assert.deepEqual(visible('void loop() { if(int value=read()) {} else {} | }'),[]);
});
test('shadowing emits one name and restores outer variables after the block',()=>{
  assert.deepEqual(visible('int pin; void loop() { int pin; { int pin; | } }'),['pin']);
  assert.deepEqual(visible('int pin; void loop() { { int pin; } | }'),['pin']);
});
test('comments, strings, and initializer braces do not break outer scope',()=>{
  assert.deepEqual(visible('int pins[]={1,2}; void loop() { String text="}"; /* } */ int value; | }'),['value','text','pins']);
});
test('unfinished function and nested blocks retain visible declarations',()=>{
  assert.deepEqual(visible('int global; void loop(int input) { int local; { int inner; |'),['inner','local','input','global']);
});

test('loop variables are hidden immediately after a loop ending at EOF',()=>{
  assert.deepEqual(visible('for(int index=0; index<3; index++) {}|'),[]);
  assert.deepEqual(visible('for(int index=0; index<3; index++) delay(index);|'),[]);
  assert.deepEqual(visible('for(int index=0; index<3; index++) { |'),['index']);
});
test('range-for and nested unbraced control statements get their own scopes',()=>{
  assert.deepEqual(visible('int pins[2]; void loop() { for(int pin : pins) { | } }'),['pin','pins']);
  assert.deepEqual(visible('void loop() { for(int index=0; index<2; index++) if(true) delay(index); else delay(index); | }'),[]);
  assert.deepEqual(visible('void loop() { if(true) int hidden; else { | } }'),[]);
});
