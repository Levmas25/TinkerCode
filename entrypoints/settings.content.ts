import { browser } from 'wxt/browser';
import { readShortcuts } from '../src/shortcuts.mjs';
export default defineContentScript({
  matches: ['https://www.tinkercad.com/*'],
  main() {
    async function publish() {
      try {
        const data = await browser.storage.local.get('shortcuts');
        window.postMessage({type:'tinkercode:shortcuts', value:readShortcuts(data.shortcuts)}, location.origin);
      } catch (error) { console.warn('TinkerCode could not load shortcut settings.', error); }
    }
    window.addEventListener('message', event => {
      if (event.source === window && event.origin === location.origin && event.data?.type === 'tinkercode:request-shortcuts') void publish();
    });
    browser.storage.onChanged.addListener((_changes, area) => { if (area === 'local' && _changes.shortcuts) void publish(); });
    void publish();
  },
});
