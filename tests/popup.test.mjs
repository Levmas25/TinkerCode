import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {JSDOM} from 'jsdom';
import {defaults} from '../src/shortcuts.mjs';

test('popup records, validates, saves, disables, and restores shortcuts', async () => {
  const dom = new JSDOM(readFileSync(new URL('../entrypoints/popup/index.html',import.meta.url),'utf8'));
  globalThis.document=dom.window.document;
  let stored=null;
  globalThis.__popupBrowser={storage:{local:{get:async()=>({}),set:async value=>{stored=value;}}}};
  let source=readFileSync(new URL('../entrypoints/popup/main.ts',import.meta.url),'utf8');
  source=source.replace("import { browser } from 'wxt/browser';",'const browser = globalThis.__popupBrowser;')
    .replace("'../../src/shortcuts.mjs'",JSON.stringify(new URL('../src/shortcuts.mjs',import.meta.url).href))
    .replace("import './style.css';",'');
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  try {
    await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
    await new Promise(resolve=>setTimeout(resolve,0));
    const doc=dom.window.document;
    assert.equal(doc.querySelectorAll('input').length,7);
    const input=doc.querySelector('#comment');
    const press=key=>input.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key,ctrlKey:true,bubbles:true,cancelable:true}));
    press('k');
    assert.equal(input.value,'Ctrl+K');
    press('z');
    assert.match(doc.querySelector('#status').textContent,/reserved/);
    assert.equal(input.value,'Ctrl+K');
    doc.querySelector('#settings').dispatchEvent(new dom.window.Event('submit',{cancelable:true}));
    await new Promise(resolve=>setTimeout(resolve,0));
    assert.equal(stored.shortcuts.comment,'Ctrl-K');
    doc.querySelector('.clear').click();
    assert.equal(input.value,'Disabled');
    doc.querySelector('#reset').click();
    assert.equal(doc.querySelector('#comment').value,'Ctrl+/');
    doc.querySelector('#settings').dispatchEvent(new dom.window.Event('submit',{cancelable:true}));
    await new Promise(resolve=>setTimeout(resolve,0));
    assert.deepEqual(stored.shortcuts,defaults);
  } finally {dom.window.close();delete globalThis.__popupBrowser;}
});

