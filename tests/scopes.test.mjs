import test from 'node:test';
import assert from 'node:assert/strict';
import {collectSketch} from '../src/variables.mjs';
import {createScopeLookup, createVariableLookup} from '../src/scopes.mjs';

test('scope index agrees with a full search across overlapping and tied intervals', () => {
  const scopes = [{start:0,end:101}, {start:5,end:30}, {start:15,end:50},
    {start:15,end:50}, {start:20,end:25}, {start:60,end:100}];
  const lookup = createScopeLookup(scopes);
  for (let offset = -1; offset <= 102; offset++) {
    const expected = scopes.filter(scope => offset >= scope.start && offset < scope.end)
      .sort((a,b) => (a.end-a.start)-(b.end-b.start));
    assert.deepEqual(lookup(offset), expected);
  }
});

test('indexed variable visibility matches full sorting at every offset', () => {
  const scopes = [{start:0,end:100}, {start:10,end:40}, {start:20,end:50}, {start:30,end:35}];
  const declarations = scopes.flatMap((scope,i) => [
    {scope, name:'shadow', offset:scope.start+1, end:scope.start+7},
    {scope, name:`name${i}`, offset:scope.start+8, end:scope.start+13},
  ]);
  const lookup = createVariableLookup(declarations);
  for (let offset = 0; offset <= 100; offset++) {
    const seen = new Set();
    const expected = declarations.filter(item => item.end <= offset && offset >= item.scope.start && offset < item.scope.end)
      .sort((a,b) => (a.scope.end-a.scope.start)-(b.scope.end-b.scope.start) || b.offset-a.offset)
      .filter(item => { if (seen.has(item.name)) return false; seen.add(item.name); return true; })
      .map(item => item.name);
    assert.deepEqual(lookup(offset), expected, `offset ${offset}`);
  }
});
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
