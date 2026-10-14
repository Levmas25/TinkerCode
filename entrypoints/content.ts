import { installHints } from '../src/hint-addon.js';
import { createSnippets } from '../src/snippets.mjs';
import { createHintProvider } from '../src/hints.mjs';
import 'codemirror/addon/hint/show-hint.css';

export default defineContentScript({
  matches: ['https://www.tinkercad.com/*'],
  world: 'MAIN',
  main() {
    const attached = new WeakSet<object>();
    function attach() {
      const CM = (window as any).CodeMirror;
      if (!CM?.defineExtension) return;
      if (!CM.prototype.showHint) installHints(CM);
      document.querySelectorAll('.CodeMirror').forEach((element) => {
        const cm = (element as any).CodeMirror;
        if (!cm || attached.has(cm)) return;
        attached.add(cm);
        const snippets = createSnippets(cm);
        const hint = createHintProvider(snippets);
        function show() {
          if (hint(cm)) cm.showHint({hint, completeSingle: false});
        }
        cm.addKeyMap({'Ctrl-Space': show});
        cm.on('inputRead', (_editor: any, change: any) => {
          if (change.origin === '+input' && !cm.state.completionActive) show();
        });
      });
    }
    let queued = false;
    const observer = new MutationObserver((records) => {
      // Ignore edits inside CodeMirror; only discover newly mounted editors.
      if (!records.some(record => [...record.addedNodes].some(node =>
        node instanceof Element && (node.matches('.CodeMirror') || node.querySelector('.CodeMirror'))))) return;
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; attach(); });
    });
    observer.observe(document.documentElement, {childList: true, subtree: true});
    attach();
  },
});




