# TinkerCode

Small Firefox-first Arduino autocomplete extension for Tinkercad's CodeMirror 5 editor.

## Development

Requires Node.js and npm. Run `npm install`, then `npm run dev`.

Build Firefox: `npm run build`. Build Chrome: `npm run build:chrome`.
Check types: `npm run check`. Run completion tests: `npm test`.

## Load in Firefox

1. Run `npm run build`.
2. Open `about:debugging#/runtime/this-firefox` in Firefox.
3. Choose **Load Temporary Add-on** and select `.output/firefox-mv3/manifest.json`.
4. Reload Tinkercad and open a circuit in Code > Text mode.
5. Type `digitalW`, or use Ctrl+Space after a partial name. Choose with arrows and Enter/Tab; Escape dismisses.

Temporary add-ons are removed when Firefox restarts. Public distribution requires signing.

## First live checks

Use a disposable circuit. Check `digitalW` and `Serial.pr` suggestions, insertion in the middle of a word, and suppression in strings/comments. Accepting a function inserts its call and selects the first argument. Tab advances, Shift+Tab goes back, and Escape exits placeholder navigation. After the last argument, Tab moves beyond the closing parenthesis. Constants remain plain text; an existing opening parenthesis prevents duplicate parentheses. Constants such as HIGH, LOW, and OUTPUT are suggested inside placeholders. While the dropdown is open, Tab accepts a suggestion; the next Tab navigates arguments. Nested function snippets are not offered inside placeholders. Verify Ctrl+Z restores the previous text. Complete a valid sketch, run the simulation, wait for saving, and reload to confirm persistence. Close/reopen Code and switch boards to check editor remounts.

The real Tinkercad integration still needs these live checks. Unit tests do not establish simulator or saving behavior.

## Design

TypeScript + WXT, Manifest V3, no backend. The page-world script uses Tinkercad's existing CodeMirror instance. Only CodeMirror's MIT-licensed completion add-on and CSS are bundled, not its editor core. Arduino definitions and matching are separate from the adapter. The add-on is generated during npm prepare; its license is in THIRD_PARTY_LICENSE.txt.

No background worker, remote suggestions, or storage permissions. The content script runs on www.tinkercad.com and attaches when a CodeMirror editor is mounted. A mutation observer discovers editors; it does not poll or read the whole sketch on each keystroke.

Firefox 128+ is required for MAIN-world content scripts. Chrome has a separate build from the same source. Browser compatibility and site integration need manual verification before release.

## Snippet checks

Complete digitalWrite, replace pin with 13, press Tab, replace value with HIGH, and press Tab to exit. Try Shift+Tab, Escape, deleting a placeholder, and undo. Automated tests use real CodeMirror in jsdom; the test runner exits explicitly because CodeMirror's browser polling timers can outlive the simulated document. Reload the temporary add-on and Tinkercad after rebuilding.


## Completion casing and semicolons

Matching is case-insensitive: DIGITALW completes to digitalWrite, serial.PR to Serial.print, and high to HIGH. Inserted names always use Arduino's canonical casing.

New standalone function calls receive a trailing semicolon, including before a trailing line comment. Existing semicolons and parentheses are preserved. Expression contexts, including multiline assignments and loop headers, do not receive a semicolon. Detection is intentionally conservative; ambiguous contexts may require typing the semicolon manually. The final snippet Tab stop is after the inserted semicolon.

