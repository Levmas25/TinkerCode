import { controlTemplates } from './controls.mjs';
import { descriptions } from './descriptions.mjs';
export const types = ['int', 'char', 'double', 'float', 'bool', 'boolean', 'byte', 'word', 'short', 'long', 'unsigned', 'signed', 'void', 'String', 'size_t', 'int8_t', 'uint8_t', 'int16_t', 'uint16_t', 'int32_t', 'uint32_t', 'int64_t', 'uint64_t'];
export const entries = [
  ['for', 'for (initialization; condition; increment)'],
  ['if', 'if (condition) { … }'],
  ['ifelse', 'if (condition) { … } else { … }'],
  ['else', 'else { … }'],
  ['while', 'while (condition) { … }'],
  ['switch', 'switch (expression) { case … }'],

  ['pinMode', 'pinMode(pin, mode)'],
  ['digitalWrite', 'digitalWrite(pin, value)'],
  ['digitalRead', 'digitalRead(pin)'],
  ['analogRead', 'analogRead(pin)'],
  ['analogWrite', 'analogWrite(pin, value)'],
  ['delay', 'delay(ms)'],
  ['delayMicroseconds', 'delayMicroseconds(us)'],
  ['millis', 'millis()'], ['micros', 'micros()'],
  ['HIGH', 'HIGH'], ['LOW', 'LOW'], ['INPUT', 'INPUT'],
  ['OUTPUT', 'OUTPUT'], ['INPUT_PULLUP', 'INPUT_PULLUP'],
  ['Serial.begin', 'Serial.begin(baud)'],
  ['Serial.print', 'Serial.print(value)'],
  ['Serial.println', 'Serial.println(value)'],
  ['Serial.available', 'Serial.available()'],
  ['Serial.read', 'Serial.read()'],
  ...types.map(name => [name, name]),
];
const builtinCandidates = entries.map(([text,displayText]) => ({text,displayText,
  ...(Object.hasOwn(controlTemplates,text) ? {kind:'control'} : {}),
  ...(displayText.includes('(') && descriptions[text] ? {description:descriptions[text]} : {}),
}));
export function completionPrefix(line, cursor) {
  const prefix = line.slice(0, cursor).match(/[A-Za-z_][\w.]*$/)?.[0] ?? '';
  if (!prefix || /[\w.]/.test(line[cursor - prefix.length - 1] ?? '')) return null;
  return prefix;
}
export function complete(line, cursor, variables = [], functions = []) {
  const prefix = completionPrefix(line, cursor);
  if (!prefix) return null;
  const suffix = line.slice(cursor).match(/^[\w.]*/)?.[0] ?? '';
  const seen = new Set();
  const normalizedPrefix = prefix.toLowerCase();
  const list = [];
  candidates: for (const group of [variables, functions, builtinCandidates]) {
    for (const candidate of group) {
      const variable = typeof candidate === 'string';
      const text = variable ? candidate : candidate.text;
      const kind = variable ? undefined : candidate.kind;
      const key = kind === 'function' ? candidate.displayText : text;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!text.toLowerCase().startsWith(normalizedPrefix) ||
          (text === prefix && kind !== 'control' && kind !== 'function')) continue;
      list.push(variable ? {text,displayText:text} : group === builtinCandidates ? {...candidate} : candidate);
      if (list.length === 12) break candidates;
    }
  }
  return {
    start: cursor - prefix.length,
    end: cursor + suffix.length,
    list,
  };
}
