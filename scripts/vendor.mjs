import { readFileSync, writeFileSync } from 'node:fs';
const source = readFileSync('node_modules/codemirror/addon/hint/show-hint.js', 'utf8');
const marker = '})(function(CodeMirror) {';
const start = source.indexOf(marker);
const end = source.lastIndexOf('});');
if (start < 0 || end < start) throw new Error('Unexpected CodeMirror add-on format');
writeFileSync('src/hint-addon.js', '// CodeMirror 5 completion add-on. MIT license; see THIRD_PARTY_LICENSE.txt.\nexport function installHints(CodeMirror) {' + source.slice(start + marker.length, end) + '}\n');
writeFileSync('THIRD_PARTY_LICENSE.txt', readFileSync('node_modules/codemirror/LICENSE', 'utf8'));
