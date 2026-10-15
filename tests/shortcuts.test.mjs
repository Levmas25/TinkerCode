import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults, validateShortcuts, readShortcuts, shortcutFromEvent} from '../src/shortcuts.mjs';
test('defaults validate and malformed saved settings fall back safely', () => {
  assert.equal(validateShortcuts(defaults),null);
  assert.deepEqual(readShortcuts(null),defaults);
  assert.deepEqual(readShortcuts({comment:'Tab'}),defaults);
});
test('duplicates, typing keys, and basic editing keys are rejected', () => {
  assert.match(validateShortcuts({...defaults,moveDown:defaults.moveUp}),/different/);
  for (const key of ['A','Tab','Esc','Ctrl-Z','Ctrl-V']) assert.ok(validateShortcuts({...defaults,comment:key}));
  assert.equal(validateShortcuts({...defaults,comment:''}),null);
  assert.equal(validateShortcuts({...defaults,comment:'Ctrl-K'}),null);
});
test('recorded combinations use CodeMirror modifier order', () => {
  assert.equal(shortcutFromEvent({key:'ArrowDown',altKey:true,shiftKey:true}), 'Shift-Alt-Down');
  assert.equal(shortcutFromEvent({key:'k',ctrlKey:true}), 'Ctrl-K');
  assert.equal(shortcutFromEvent({key:'Control',ctrlKey:true}),null);
});

test('new actions preserve existing shortcut preferences and avoid collisions', () => {
  const old = {...defaults,comment:'Ctrl-K'};
  delete old.selectLine;
  assert.equal(readShortcuts(old).comment,'Ctrl-K');
  assert.equal(readShortcuts(old).selectLine,'Alt-L');
  old.comment='Alt-L';
  assert.equal(readShortcuts(old).comment,'Alt-L');
  assert.equal(readShortcuts(old).selectLine,'');
});
