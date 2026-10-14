import test from 'node:test';
import assert from 'node:assert/strict';
import { planSnippet, isStatementStart } from '../src/snippets.mjs';
const digitalWrite = { text: 'digitalWrite', displayText: 'digitalWrite(pin, value)' };
test('inserts a call with accurate argument selection ranges', () => {
  const plan = planSnippet(digitalWrite, '');
  assert.equal(plan.text, digitalWrite.displayText);
  assert.deepEqual(plan.fields.map(f => plan.text.slice(f.start, f.end)), ['pin', 'value']);
});
test('preserves existing parentheses, including intervening whitespace', () => {
  for (const tail of ['(13, HIGH)', '  (13, HIGH)']) {
    assert.deepEqual(planSnippet(digitalWrite, tail), {text: 'digitalWrite', fields: []});
  }
});
test('constants and zero-argument calls do not create placeholders', () => {
  assert.deepEqual(planSnippet({text:'HIGH', displayText:'HIGH'}, ''), {text:'HIGH', fields:[]});
  assert.deepEqual(planSnippet({text:'millis', displayText:'millis()'}, ''), {text:'millis()', fields:[]});
});

test('standalone calls receive semicolons without changing argument ranges', () => {
  const plan = planSnippet(digitalWrite, '', true);
  assert.equal(plan.text, 'digitalWrite(pin, value);');
  assert.deepEqual(plan.fields.map(f => plan.text.slice(f.start, f.end)), ['pin', 'value']);
  assert.equal(planSnippet(digitalWrite, ' // output', true).text, plan.text);
});
test('existing terminators and expression suffixes are preserved', () => {
  for (const tail of [';', ' ;', ')', ' + 1', '(13, HIGH)']) {
    assert.equal(planSnippet(digitalWrite, tail, true).text.endsWith(';'), false);
  }
  assert.equal(planSnippet(digitalWrite, '', false).text.endsWith(';'), false);
});


test('statement detection excludes multiline expressions and loop headers', () => {
  for (const prefix of ['', 'void loop() {\n  ', 'void loop() {\n delay(1);\n ', '// comment\n']) {
    assert.equal(isStatementStart(prefix), true, prefix);
  }
  for (const prefix of ['int value =\n ', 'if (\n ', 'for (int i=0;\n', 'foo(\n', 'return ', 'x[']) {
    assert.equal(isStatementStart(prefix), false, prefix);
  }
});
