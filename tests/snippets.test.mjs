import test from 'node:test';
import assert from 'node:assert/strict';
import { planSnippet } from '../src/snippets.mjs';
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
