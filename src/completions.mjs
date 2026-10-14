export const entries = [
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
];
export function complete(line, cursor) {
  const prefix = line.slice(0, cursor).match(/[A-Za-z_][\w.]*$/)?.[0] ?? '';
  if (!prefix || /[\w.]/.test(line[cursor - prefix.length - 1] ?? '')) return null;
  const suffix = line.slice(cursor).match(/^[\w.]*/)?.[0] ?? '';
  return {
    start: cursor - prefix.length,
    end: cursor + suffix.length,
    list: entries.filter(([name]) => name.startsWith(prefix) && name !== prefix)
      .slice(0, 12).map(([text, displayText]) => ({text, displayText})),
  };
}
