import { browser } from 'wxt/browser';
import { actions, defaults, readShortcuts, validateShortcuts, shortcutFromEvent, displayShortcut } from '../../src/shortcuts.mjs';
import './style.css';
const form = document.querySelector<HTMLFormElement>('#settings')!;
const fields = document.querySelector<HTMLFieldSetElement>('#fields')!;
const status = document.querySelector<HTMLElement>('#status')!;
const save = document.querySelector<HTMLButtonElement>('#save')!;
let draft: Record<string, string> = {...defaults};
function render() {
  fields.replaceChildren();
  for (const [id, [label]] of Object.entries(actions)) {
    const row = document.createElement('div'); row.className = 'row';
    const text = document.createElement('label'); text.htmlFor = id; text.textContent = label;
    const input = document.createElement('input'); input.id = id; input.readOnly = true; input.value = displayShortcut(draft[id]);
    input.setAttribute('aria-label', label + ' shortcut');
    input.addEventListener('keydown', event => {
      if (event.key === 'Tab') return;
      event.preventDefault();
      if (event.key === 'Escape') { input.blur(); return; }
      const key = shortcutFromEvent(event);
      if (!key) return;
      const candidate = {...draft, [id]:key};
      const error = validateShortcuts(candidate);
      if (error) { status.textContent = error; return; }
      draft = candidate; input.value = displayShortcut(key); status.textContent = 'Unsaved changes.';
    });
    const clear = document.createElement('button'); clear.type = 'button'; clear.textContent = '×'; clear.className='clear'; clear.setAttribute('aria-label', 'Disable ' + label.toLowerCase());
    clear.onclick = () => { draft[id] = ''; input.value = 'Disabled'; status.textContent = 'Unsaved changes.'; };
    row.append(text,input,clear); fields.append(row);
  }
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  const error = validateShortcuts(draft);
  if (error) { status.textContent=error; return; }
  save.disabled=true;
  try { await browser.storage.local.set({shortcuts:{...draft}}); status.textContent='Saved. Open editors updated.'; }
  catch { status.textContent='Could not save. Please try again.'; }
  finally { save.disabled=false; }
});
document.querySelector<HTMLButtonElement>('#reset')!.onclick = () => { draft={...defaults}; render(); status.textContent='Defaults restored. Click Save to apply.'; };
async function load() {
  try { const data=await browser.storage.local.get('shortcuts'); draft=readShortcuts(data.shortcuts); render(); fields.disabled=false; save.disabled=false; status.textContent='Stored on this browser only.'; }
  catch { status.textContent='Could not load settings. Reopen this popup to retry.'; }
}
void load();
