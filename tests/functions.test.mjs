import test from 'node:test';
import assert from 'node:assert/strict';
import {collectFunctions} from '../src/functions.mjs';
import {complete} from '../src/completions.mjs';
test('finds free functions, typed parameters, pointers, arrays, and void parameter lists',()=>{
  const functions=collectFunctions(`void blink(int pin, unsigned long duration) { digitalWrite(pin,HIGH); }
    int readValue(void) { return 1; }
    static bool send(const char *message, byte pins[], int count=3);
    void unnamed(int);`);
  assert.deepEqual(functions.map(f=>f.callText),['blink(pin, duration)','readValue()','send(message, pins, count)','unnamed(arg1)']);
  assert.equal(functions[0].displayText,'blink(int pin, unsigned long duration)');
});
test('deduplicates prototypes and definitions but retains overloads',()=>{
  const functions=collectFunctions('void blink(int pin); void blink(int pin) {} void blink(int pin, int count) {}');
  assert.equal(functions.length,2);
  assert.equal(complete('BLI',3,[],functions).list.length,2);
});
test('ignores comments, calls, strings, class methods, and function pointers',()=>{
  const functions=collectFunctions(`// void fake(int x);
    String text = "void hidden();";
    int value = readValue();
    void (*callback)(int);
    class Device { void method(); };
    void real() { fake(1); }
    /* void nope(); */`);
  assert.deepEqual(functions.map(f=>f.text),['real']);
});

test('handles pointer return types and unnamed compound types',()=>{
  const functions=collectFunctions('char *makeText(int); void configure(unsigned long, const char *);');
  assert.deepEqual(functions.map(f=>f.callText),['makeText(arg1)','configure(arg1, arg2)']);
});
