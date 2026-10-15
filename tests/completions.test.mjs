import test from 'node:test';
import assert from 'node:assert/strict';
import { complete } from '../src/completions.mjs';
test('completes Arduino names', () => {
  const result = complete('  digitalW', 10);
  assert.equal(result.list[0].text, 'digitalWrite');
  assert.equal(result.start, 2);
});
test('offers Serial methods', () => {
  assert.deepEqual(complete('Serial.pr', 9).list.map(x => x.text), ['Serial.print', 'Serial.println']);
});
test('replaces the rest of an identifier without duplicating it', () => {
  const result = complete('digitalWrit', 8);
  assert.equal(result.end, 11);
});
test('does not offer unrelated members or empty input', () => {
  assert.equal(complete('', 0), null);
  assert.equal(complete('object.digitalW', 15).list.length, 0);
});

test('case-insensitive matching preserves canonical Arduino spelling', () => {
  assert.equal(complete('DIGITALW', 8).list[0].text, 'digitalWrite');
  assert.equal(complete('high', 4).list[0].text, 'HIGH');
  assert.equal(complete('serial.PR', 9).list[0].text, 'Serial.print');
  assert.equal(complete('DIGITALWRITE', 12).list[0].text, 'digitalWrite');
});

test('common types autocomplete with their canonical spelling', () => {
  for (const [prefix,name] of [['ch','char'],['INT','int'],['dou','double'],['bo','bool'],['str','String']]) {
    assert.ok(complete(prefix,prefix.length).list.some(item=>item.text===name));
  }
  assert.ok(complete('for',3).list.some(item=>item.text==='for'));
});

test('completion preserves priority, overloads, deduplication and the twelve-item limit', () => {
  const functions = [
    {text:'custom', displayText:'custom(int pin)', kind:'function'},
    {text:'custom', displayText:'custom(int pin)', kind:'function'},
    {text:'custom', displayText:'custom(byte pin)', kind:'function'},
  ];
  assert.deepEqual(complete('cu', 2, ['custom', 'custom'], functions).list.map(item => item.displayText),
    ['custom', 'custom(int pin)', 'custom(byte pin)']);
  const variables = Array.from({length:12}, (_,i) => `candidate${i}`);
  // An early match limit must avoid even reading the remaining candidates.
  Object.defineProperty(variables, 12, {get() { throw new Error('Unnecessary candidate scan'); }});
  assert.equal(complete('ca', 2, variables).list.length, 12);
  assert.equal(complete('digitalW', 8, ['digitalWrite']).list[0].description, undefined);
});

test('mutating returned built-in completions does not change future results', () => {
  complete('digitalW', 8).list[0].text = 'changed';
  assert.equal(complete('digitalW', 8).list[0].text, 'digitalWrite');
});
