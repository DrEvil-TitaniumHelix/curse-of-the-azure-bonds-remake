// game/plus/click/input.js — Gold Box Plus W3 (fix request #q-9): mouse and touch access to line-input prompts.
// Owner: gbp-click.
//
// The engine reports its line-input prompts (inputStarted / inputChanged / inputEnded: ReadBottomLine 0709:09E3 — names,
// the code word, ECL INPUT STRING / NUMBER through ReadWordNumber — and InputNumber 8900:0294 — coin and item amounts).
// While one waits:
//  - a visible text field (HTML, outside the game picture) mirrors what the game has taken so far; typing into it sends
//    exactly the keys the keyboard would (characters, Backspace, Enter, Esc) through the engine's key script, one per idle
//    wait, so nothing is lost to ReadGameKey's type-ahead flush (0899:00E4); the game stays the only owner of the text;
//  - the bottom line (row 24) is a Plus region: left click = focus the field, right click = Enter / Esc / Backspace /
//    Clear / type in the field.
// Typing on the keyboard without the field works as before (the field is not focused unless the player chose it).
// Original mode: no events, so nothing here appears.

import { hooks } from '../hooks.js';
import { KEY, script } from '../../engine/input.js';

export const input = { active: null, field: null };
const BS = [8, 0x0E];
const queue = (keys) => { script.keys.push(...keys); };           // always one key per idle wait

const CSS = `.por-input{position:fixed;z-index:850;box-sizing:border-box;font:16px/1.2 ui-monospace,Consolas,monospace;
padding:4px 8px;border:2px solid #f0c040;border-radius:6px;background:#101820;color:#fff;letter-spacing:.06em;
text-transform:uppercase;outline:none;box-shadow:0 4px 16px #000a}.por-input:focus{border-color:#7fd0ff}
.por-input-label{position:fixed;z-index:850;font:12px system-ui,sans-serif;color:#cfd8e3;background:#101820cc;padding:1px 6px;border-radius:4px}`;

function place() {
  const f = input.field, a = input.active, c = document.getElementById('screen');
  if (!f || !a || !c) return;
  const r = c.getBoundingClientRect(), h = 32;
  const w = Math.min(r.width, Math.max(240, (a.maxLen + 4) * 14));
  const below = r.bottom + h + 22 <= innerHeight;
  f.style.width = w + 'px'; f.style.height = h + 'px';
  f.style.left = Math.max(4, r.left + (a.col * 8) * r.width / 320 - 10) + 'px';
  f.style.left = Math.min(parseFloat(f.style.left), innerWidth - w - 4) + 'px';
  f.style.top = (below ? r.bottom + 18 : Math.max(18, r.top + 23 * 8 * r.height / 200 - h - 4)) + 'px';
  input.label.style.left = f.style.left; input.label.style.top = (parseFloat(f.style.top) - 17) + 'px';
}

function show(p) {
  input.active = p;
  if (!input.field) {
    const st = document.createElement('style'); st.textContent = CSS; document.head.append(st);
    const f = document.createElement('input');
    f.type = 'text'; f.className = 'por-input'; f.autocomplete = 'off'; f.spellcheck = false;
    f.setAttribute('aria-label', 'Game text input');
    const label = document.createElement('div'); label.className = 'por-input-label';
    f.addEventListener('keydown', (e) => {                       // keys go to the game from here (not twice)
      e.stopPropagation();
      if (!input.active) return;
      if (e.key === 'Enter') { e.preventDefault(); queue([KEY.enter]); }
      else if (e.key === 'Escape') { e.preventDefault(); queue([KEY.esc]); }
      else if (e.key === 'Backspace') { e.preventDefault(); queue([BS]); }
      else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) { e.preventDefault(); typeText(e.key); }
      else if (!['Tab', 'Shift', 'CapsLock'].includes(e.key)) e.preventDefault();
    });
    f.addEventListener('beforeinput', (e) => {                   // touch keyboards / IME: text arrives here
      e.preventDefault();
      if (!input.active) return;
      if (e.inputType === 'deleteContentBackward') queue([BS]);
      else if (e.data) typeText(e.data);
    });
    input.field = f; input.label = label;
    addEventListener('resize', place);
  }
  input.label.textContent = (p.prompt || '').trim() || (p.kind === 'number' ? 'Number' : 'Text') + ' — type here, Enter to finish';
  input.field.maxLength = p.maxLen; input.field.value = p.text || '';
  input.field.inputMode = p.kind === 'number' ? 'numeric' : 'text';
  document.body.append(input.label, input.field);
  place();
}
function typeText(t) {
  const a = input.active; if (!a) return;
  const keys = [];
  for (const ch of t) {
    const c = ch.charCodeAt(0);
    if (a.kind === 'number' ? (c >= 48 && c <= 57) : (c >= 32 && c <= 0x7A)) keys.push([c, 0]);   // what the reader takes
  }
  queue(keys);
}
function hide() {
  input.active = null;
  input.field?.remove(); input.label?.remove();
  hooks.clearRegions('input');
}
export function focusField() { if (input.field && input.active) { input.field.focus({ preventScroll: true }); return true; } return false; }

export function mountInput() {
  hooks.on('inputStarted', (p) => {
    show(p);
    hooks.registerRegion({ id: 'plus-input', scope: 'input', kind: 'input', prio: 7,
      rect: { x1: 0, y1: 192, x2: 319, y2: 199 },
      left: { action: () => focusField() },
      right: () => {
        const n = (input.field?.value || '').length;
        return [
          { label: 'Type in the text field', action: () => focusField(), default: true },
          { label: 'Enter (accept)', keys: [KEY.enter] },
          { label: 'Backspace', keys: [BS] },
          ...(n ? [{ label: `Clear (${n} × Backspace)`, action: () => queue(Array.from({ length: n }, () => BS)) }] : []),
          { label: 'Esc', keys: [KEY.esc] },
        ];
      } });
  });
  hooks.on('inputChanged', (p) => { if (input.field && input.active) input.field.value = p.text; });
  hooks.on('inputEnded', () => hide());
}
