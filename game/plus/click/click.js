// game/plus/click/click.js — Gold Box Plus W3: full clickability. Owner: gbp-click (= gbp-hooks).
//
// The engine's mouse layer (engine/input.js) stays as it is: a left click types the key of the region under the pointer.
// This module adds, while Gold Box Plus is on:
//  - a right-click list (ruling GBP-6: a modern list, not an EGA mini-menu) of everything the keyboard player could do
//    at that spot: the entries are key sequences typed through the engine's own key script (one key per idle wait, as
//    the engine's pointer does), or Plus actions. Its first entry marked "default" is what a left click does.
//  - cursor hints: 'context-menu' over a spot with a list, 'pointer' over a left-clickable spot.
// The lists come from the live hit regions (plus/hooks.js `regions()`): engine regions (bottom menu, list, roster, party
// menu, 3D view) are read with the payload of the draw event that registered them; Plus regions bring their own `right`
// (array, or a function (x, y) -> array). The current bottom menu's commands and "Back (Esc)" are appended.
// Original mode (hooks off or the Plus "original" setting): nothing here runs; right-click is the engine's Esc.
// Design credit: Darklands+ (MIT) right-click menu bar and battle info under the pointer — independently written.

import { hooks } from '../hooks.js';
import { pointer, toGamePoint, KEY, pushKey, script } from '../../engine/input.js';

export const click = { mounted: false, canvas: null, menuEl: null, last: null };
const providers = [];                 // extra option providers (x, y) -> { prio, options } | null (combat, travel)

export const k = (c) => [c.charCodeAt(0), 0];               // a printable key
export const same = (a, b) => !!a && !!b && a.length === b.length && a.every((x, i) => x[0] === b[i][0] && x[1] === b[i][1]);
export function active() { return hooks.enabled && globalThis.goldBoxPlus?.settings?.original !== true; }

// type keys the way engine/input.js does for a click: one key straight into the BIOS buffer, a sequence through the
// key script (ReadGameKey 0899:00E4 flushes type-ahead)
export function typeKeys(keys) {
  if (!keys || !keys.length) return;
  if (keys.length === 1 && !script.keys.length) pushKey(keys[0][0], keys[0][1]);
  else script.keys.push(...keys);
}

export function addProvider(fn) { providers.push(fn); return () => providers.splice(providers.indexOf(fn), 1); }

// what a left click at (x, y) would do, without doing it (engine/input.js pointerHit runs a Plus region's action):
// a key list, { action: true }, or null
export function leftAt(x, y) {
  for (const r of hooks.regions()) {
    if (!inside(r, x, y)) continue;
    if (r.source === 'engine') { const keys = r.keysAt(x, y); if (keys) return keys; continue; }
    const l = r.left;
    if (Array.isArray(l) && l.length) return l;
    if (typeof l === 'function') { const keys = l(x, y); if (keys) return keys; }
    if (l && typeof l.action === 'function') return { action: true };
  }
  return null;
}

const inside = (r, x, y) => x >= r.rect.x1 && x <= r.rect.x2 && y >= r.rect.y1 && y <= r.rect.y2;
const title = (s) => String(s).trim().replace(/\s+/g, ' ');

// the commands of the bottom menu that waits now (hmenu draw payload)
export function bottomMenu() {
  const r = hooks.regions().find((x) => x.id === 'hmenu');
  const d = r && r.draw;
  if (!d || !d.items) return [];
  return d.items.filter((i) => i.key && i.key.trim()).map((i) => ({ label: title(i.label || i.key), keys: [k(i.key)] }));
}

function engineOptions(r, x, y) {
  const d = r.draw || {};
  const left = r.keysAt ? r.keysAt(x, y) : null;
  switch (r.id) {
    case 'hmenu': return (d.items || []).filter((i) => i.key && i.key.trim()).map((i) => ({ label: title(i.label || i.key), keys: [k(i.key)] }));
    case 'pmenu': {                  // engine regions are not cleared between the party menu and the explore screen:
      const h = hooks.regions().find((x) => x.id === 'hmenu');   // only while the party menu itself waits
      if (h?.draw?.prompt !== 'Choose a function ') return [];
      return (d.items || []).map((i) => ({ label: title(i.label || i.key), keys: [k(i.key)] }));
    }
    case 'vlist': {
      if (!left) return [];
      const row = Math.floor(y / 8) - Math.floor(r.rect.y1 / 8) + (d.top || 0);
      const text = title(d.items?.[row]?.text || '');
      const move = left.length === 1 && left[0][0] === 13 ? [] : left;      // [Enter] = already highlighted
      const out = [{ label: move.length ? `Highlight ${text}` : `Choose ${text}`, keys: move.length ? move : [KEY.enter] }];
      for (const m of bottomMenu()) if (!/^(Exit|Next|Prev)$/i.test(m.label)) out.push({ label: `${m.label}: ${text}`, keys: [...move, ...m.keys] });
      return out;
    }
    case 'roster': {
      if (!pointer.menuExt) return [];
      const i = Math.floor(y / 8) - (d.firstRow ?? 4);
      const who = d.members?.[i];
      if (!who) return [];
      const steps = left || [];
      const out = [{ label: steps.length ? `Select ${who.name}` : `${who.name} (selected)`, keys: steps }];
      for (const m of bottomMenu()) out.push({ label: `${m.label}: ${who.name}`, keys: [...steps, ...m.keys] });
      return out.filter((o) => o.keys.length);
    }
    case 'view': return [
      { label: 'Forward', keys: [KEY.up] }, { label: 'Turn left', keys: [KEY.left] },
      { label: 'Turn right', keys: [KEY.right] }, { label: 'Turn around', keys: [KEY.down] },
    ];
    default: return [];
  }
}

// every option at a 320x200 point: [{ label, keys?, action?, default?, group? }]
export function optionsAt(x, y) {
  const found = [];
  for (const p of providers) { try { const r = p(x, y); if (r && r.options?.length) found.push(r); } catch (e) { console.error('[click] provider: ' + e); } }
  for (const r of hooks.regions()) {
    if (!inside(r, x, y)) continue;
    let options = [];
    if (r.source === 'plus') options = (typeof r.right === 'function' ? r.right(x, y) : r.right) || [];
    else options = engineOptions(r, x, y);
    if (options.length) found.push({ prio: r.prio, options, id: r.id, noMenu: r.kind === 'input' || r.kind === 'anykey' });
  }
  if (!found.length) return [];
  found.sort((a, b) => b.prio - a.prio);
  const top = found[0];
  const left = leftAt(x, y);
  const out = top.options.map((o) => ({ ...o, default: o.default ?? (Array.isArray(left) && !!o.keys && same(o.keys, left)) }));
  if (top.id !== 'hmenu' && top.id !== 'pmenu' && !top.noMenu) {
    for (const m of bottomMenu()) if (!out.some((o) => o.keys && same(o.keys, m.keys))) out.push({ ...m, group: 'menu' });
  }
  if (!top.noMenu) out.push({ label: 'Back (Esc)', keys: [KEY.esc], group: 'esc' });   // an input prompt lists its own Esc
  return out;
}

export function run(o) {
  if (o.action) { try { o.action(); } catch (e) { console.error('[click] action: ' + e); } return; }
  typeKeys(o.keys);
}

// ---- the list ----------------------------------------------------------------------------------------------------------
const CSS = `.por-click{position:fixed;z-index:900;min-width:160px;max-width:320px;background:#16202e;color:#f1f4f8;border:1px solid #9bb4d0;
border-radius:8px;box-shadow:0 8px 30px #000a;font:14px/1.3 system-ui,sans-serif;padding:4px;margin:0;list-style:none}
.por-click button{display:block;width:100%;text-align:left;background:none;border:0;color:inherit;font:inherit;padding:5px 10px;border-radius:5px;cursor:pointer}
.por-click button:hover,.por-click button:focus{background:#2c4466;outline:none}.por-click .def{font-weight:600}
.por-click .key{float:right;opacity:.6;margin-left:12px}.por-click hr{border:0;border-top:1px solid #39506e;margin:3px 6px}`;
function keyName(keys) {
  if (!keys || !keys.length) return '';
  const n = (x) => x[0] === 13 ? 'Enter' : x[0] === 27 ? 'Esc' : x[0] ? String.fromCharCode(x[0]) :
    ({ 0x48: '↑', 0x50: '↓', 0x4B: '←', 0x4D: '→', 0x47: 'Home', 0x4F: 'End', 0x49: 'PgUp', 0x51: 'PgDn' })[x[1]] || '#' + x[1];
  const s = keys.map(n);
  return s.length > 4 ? s.slice(0, 3).join(' ') + ' … ' + s[s.length - 1] : s.join(' ');
}
export function closeMenu() { if (click.menuEl) { click.menuEl.remove(); click.menuEl = null; } }
export function openMenu(options, clientX, clientY) {
  closeMenu();
  const ul = document.createElement('ul');
  ul.className = 'por-click'; ul.setAttribute('role', 'menu');
  let group = null;
  for (const o of options) {
    if (o.group !== group && ul.childElementCount) ul.append(document.createElement('hr'));
    group = o.group;
    const li = document.createElement('li'), b = document.createElement('button');
    b.setAttribute('role', 'menuitem'); if (o.default) b.className = 'def';
    b.textContent = o.label;
    const kn = keyName(o.keys); if (kn) { const s = document.createElement('span'); s.className = 'key'; s.textContent = kn; b.append(s); }
    b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); closeMenu(); run(o); });
    li.append(b); ul.append(li);
  }
  document.body.append(ul);
  const w = ul.offsetWidth, h = ul.offsetHeight;
  ul.style.left = Math.max(0, Math.min(clientX, innerWidth - w - 4)) + 'px';
  ul.style.top = Math.max(0, Math.min(clientY, innerHeight - h - 4)) + 'px';
  click.menuEl = ul;
  ul.querySelector('button')?.focus({ preventScroll: true });
  return ul;
}

// ---- mounting -----------------------------------------------------------------------------------------------------------
export function mountClick({ canvas = document.getElementById('screen') } = {}) {
  if (click.mounted || !canvas) return click;
  click.mounted = true; click.canvas = canvas;
  const st = document.createElement('style'); st.textContent = CSS; document.head.append(st);
  const host = canvas.parentElement || document.body;
  // capture phase on the parent: runs before the canvas's own contextmenu (= Esc) listener of engine/input.js
  host.addEventListener('contextmenu', (e) => {
    if (e.target !== canvas || !active()) return;
    e.preventDefault(); e.stopPropagation();
    const p = toGamePoint(canvas, e.clientX, e.clientY);
    const options = optionsAt(p.x, p.y);
    click.last = { x: p.x, y: p.y, options };
    if (options.length <= 1) { typeKeys([KEY.esc]); return; }   // nothing but Back: the old right-click
    openMenu(options, e.clientX, e.clientY);
  }, true);
  host.addEventListener('mousedown', (e) => { if (click.menuEl && !click.menuEl.contains(e.target)) closeMenu(); }, true);
  window.addEventListener('keydown', (e) => {
    if (!click.menuEl) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMenu(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); e.stopPropagation();
      const bs = [...click.menuEl.querySelectorAll('button')], i = bs.indexOf(document.activeElement);
      bs[(i + (e.key === 'ArrowDown' ? 1 : bs.length - 1)) % bs.length].focus();
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') return;            // the focused button handles it
    closeMenu();
  }, true);
  canvas.addEventListener('mousemove', (e) => {
    if (!active()) { if (canvas.style.cursor) canvas.style.cursor = ''; return; }
    const p = toGamePoint(canvas, e.clientX, e.clientY);
    let c = '';
    try { c = optionsAt(p.x, p.y).length > 1 ? 'context-menu' : leftAt(p.x, p.y) ? 'pointer' : ''; } catch { c = ''; }
    if (canvas.style.cursor !== c) canvas.style.cursor = c;
  });
  canvas.addEventListener('mouseleave', () => { canvas.style.cursor = ''; });
  hooks.on('*', () => { if (click.menuEl && !click.menuEl.matches(':hover')) closeMenu(); });   // the screen moved on
  if (typeof window !== 'undefined') window.__click = click;
  return click;
}
