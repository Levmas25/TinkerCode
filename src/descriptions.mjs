export const descriptions = {
  pinMode: 'Set a pin to input, output, or input with a pull-up resistor.',
  digitalWrite: 'Set a digital pin to HIGH or LOW.',
  digitalRead: 'Read whether a digital pin is HIGH or LOW.',
  analogRead: 'Read the analog input value from a pin.',
  analogWrite: 'Set PWM output duty cycle (0–255) on a supported pin.',
  delay: 'Pause the program for a number of milliseconds.',
  delayMicroseconds: 'Pause the program for a number of microseconds.',
  millis: 'Return milliseconds elapsed since the program started.',
  micros: 'Return microseconds elapsed since the program started.',
  'Serial.begin': 'Start serial communication at the specified baud rate.',
  'Serial.print': 'Send a value as readable text over serial.',
  'Serial.println': 'Send readable text over serial, followed by a line ending.',
  'Serial.available': 'Return the number of incoming bytes available to read.',
  'Serial.read': 'Read the next incoming byte, or -1 if none is available.',
};

export function renderHint(element, _data, completion) {
  const doc = element.ownerDocument;
  const signature = doc.createElement('span');
  signature.className = 'tinkercode-signature';
  signature.textContent = completion.displayText;
  element.appendChild(signature);
  if (completion.description) {
    const description = doc.createElement('span');
    description.className = 'tinkercode-description';
    description.textContent = completion.description;
    element.appendChild(description);
    element.setAttribute('aria-label', `${completion.displayText}. ${completion.description}`);
  }
}
