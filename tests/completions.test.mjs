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
