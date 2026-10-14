import test from 'node:test';
import assert from 'node:assert/strict';
import { collectVariables } from '../src/variables.mjs';
import { complete } from '../src/completions.mjs';
test('finds common Arduino declarations, parameters, arrays, and comma declarations', () => {
  const names = collectVariables(`const int ledPin = 13;
    unsigned long previousMillis = 0;
    byte pins[] = {2,3,4}, count = 3;
    char *message;
    void blink(int duration, bool enabled) { int localValue = 2; }
    for (int index = 0; index < 4; index++) {}
    String label = "test";
    uint8_t level = 2;`);
  for (const name of ['ledPin','previousMillis','pins','count','message','duration','enabled','localValue','index','label','level']) assert.ok(names.includes(name), name);
  assert.ok(!names.includes('blink'));
});
test('ignores comments, strings, preprocessor lines, functions and duplicates', () => {
  assert.deepEqual(collectVariables(`// int fake;
    /* byte hidden; */
    String text = "int quoted;";
    #define DECL int macro;
    int functionName(int argument);
    int actual; int actual;`), ['text','argument','actual']);
});
test('matches variables without changing spelling and keeps prefix replacement', () => {
  const result = complete('LEDP', 4, ['ledPin']);
  assert.deepEqual(result.list[0], {text:'ledPin', displayText:'ledPin'});
  assert.equal(result.start, 0);
  assert.equal(complete('object.led', 10, ['ledPin']).list.length, 0);
});
