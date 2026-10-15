/** @type {Record<string, [string, string]>} */
export const actions = {
  comment: ['Toggle comments', 'Ctrl-/'],
  selectLine: ['Select whole line', 'Alt-L'],
  duplicateUp: ['Duplicate above', 'Shift-Alt-Up'],
  duplicateDown: ['Duplicate below', 'Shift-Alt-Down'],
  moveUp: ['Move up', 'Alt-Up'],
  moveDown: ['Move down', 'Alt-Down'],
  complete: ['Show autocomplete', 'Ctrl-Space'],
};
export const defaults = Object.fromEntries(Object.entries(actions).map(([id, value]) => [id, value[1]]));
export function validateShortcuts(value) {
  if (!value || typeof value !== 'object') return 'Invalid shortcut settings.';
  const used = new Set();
  for (const id of Object.keys(actions)) {
    const key = value[id];
    if (typeof key !== 'string') return 'Each action needs a shortcut or must be disabled.';
    if (!key) continue;
    if (!/^(?:Shift-)?(?:Ctrl-)?(?:Alt-)?(?:Cmd-)?(?:[A-Z0-9/]|Up|Down|Left|Right|Space|F(?:[1-9]|1[0-2]))$/.test(key) ||
        (!/(Ctrl|Alt|Cmd)-/.test(key) && !/F\d+$/.test(key))) return 'Use Ctrl, Alt, or Command with a key, or a function key.';
    if (['Ctrl-Z','Shift-Ctrl-Z','Ctrl-Y','Ctrl-C','Ctrl-V','Ctrl-X','Ctrl-A','Cmd-Z','Shift-Cmd-Z','Cmd-C','Cmd-V','Cmd-X','Cmd-A'].includes(key)) return 'That shortcut is reserved for basic editing.';
    if (used.has(key)) return 'Each action must have a different shortcut.';
    used.add(key);
  }
  return null;
}
export function readShortcuts(value) {
  if (!value || typeof value !== 'object') return {...defaults};
  /** @type {Record<string, string>} */
  const migrated = {};
  const used = new Set(Object.values(value));
  for (const id of Object.keys(actions)) {
    // Preserve existing preferences when a new action is introduced.
    migrated[id] = Object.hasOwn(value,id) ? value[id] : used.has(defaults[id]) ? '' : defaults[id];
  }
  return validateShortcuts(migrated) ? {...defaults} : migrated;
}
export function shortcutFromEvent(event) {
  const names = {ArrowUp:'Up',ArrowDown:'Down',ArrowLeft:'Left',ArrowRight:'Right',' ':'Space'};
  let key = names[event.key] ?? event.key;
  if (/^[a-z]$/i.test(key)) key = key.toUpperCase();
  if (key === '?') key = '/';
  const result = [event.shiftKey && 'Shift', event.ctrlKey && 'Ctrl', event.altKey && 'Alt', event.metaKey && 'Cmd', key].filter(Boolean).join('-');
  return /^(?:Shift|Control|Alt|Meta)$/.test(event.key) ? null : result;
}
export const displayShortcut = key => key ? key.replaceAll('-', '+').replace('Up','↑').replace('Down','↓').replace('Left','←').replace('Right','→') : 'Disabled';



