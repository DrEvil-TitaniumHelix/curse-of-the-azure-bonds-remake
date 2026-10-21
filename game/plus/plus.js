import { createStore } from './store.js';
import { tabs, renderStub } from './tabs/stubs.js';
import { renderGames } from './games.js';
import { hooks } from './hooks.js';

export const defaults = Object.freeze({ original: false, devTools: false, sidePanel: false, tooltips: false, automap: true, combatLog: false, quicksave: false, autosave: false,   // cab: W8 helpers default off
  spellPresets: false, margins: false, crispFont: false });
// cab: param — helpers adapted for Curse (S6: automap + the W8 helpers; spell presets and margins are not offered)
const available = new Set(['automap', 'crispFont', 'tooltips', 'combatLog', 'quicksave', 'autosave']);
const labels = { tooltips: 'Tooltips', automap: 'Automap', combatLog: 'Combat log', quicksave: 'Quick save', autosave: 'Autosave on area entry', spellPresets: 'Spell presets', margins: 'Margins', crispFont: 'Crisp alternative font' };
let instance;
export function mountPlus({ canvas = document.getElementById('screen'), input = null, profile = 'cab', slot = 'default', dev = new URLSearchParams(location.search).has('sting') || new URLSearchParams(location.search).get('dev') === '1' } = {}) {
 if (instance) { if (input) instance.setInput(input); return instance; }
 let storage = createStore({ profile, slot });
 let settings = { ...defaults }, open = false, tab = 'status', previousFocus, previousSuspended, gate = input;
 const renderers = new Map();
 const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = new URL('./plus.css', import.meta.url); document.head.append(link);
 const gear = document.createElement('button'); gear.id = 'por-plus-menu'; gear.textContent = '⚙ Plus'; gear.title = 'Gold Box Plus (F12)';
 // cab: the owner 2026-10-20 — the hint stays on screen the whole game (not first-run only), outside the 320x200 frame, so the
 // game's own pixels never change; only "Play the original game" hides it. The gear rides in the same strip.
 const hint = document.createElement('div'); hint.id = 'cab-plus-hint'; hint.setAttribute('role', 'note');
 const hintText = document.createElement('span'); hintText.textContent = 'F12 opens the Plus screen'; hint.append(gear, hintText);
 const root = document.createElement('section'); root.id = 'por-plus'; root.hidden = true; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Gold Box Plus');
 const header = document.createElement('header'); const title = document.createElement('strong'); title.textContent = 'Gold Box Plus';
 const close = document.createElement('button'); close.textContent = 'Close (Esc)'; close.onclick = () => api.close(); header.append(title, close);
 const nav = document.createElement('nav'); nav.setAttribute('role', 'tablist'); nav.setAttribute('aria-label', 'Plus pages');
 const body = document.createElement('div'); body.id = 'por-plus-content'; body.setAttribute('role', 'tabpanel'); body.tabIndex = 0;
 root.append(header, nav, body); document.body.append(hint, root);
 function checkbox(name, text, disabled = false) {
  const label = document.createElement('label'), c = document.createElement('input'); c.dataset.setting = name; c.type = 'checkbox'; c.checked = !!settings[name]; c.disabled = disabled;
  c.onchange = () => api.setSetting(name, c.checked); label.append(c, document.createTextNode(text)); body.append(label);
 }
 function render() {
  root.classList.toggle('side-panel', settings.sidePanel && !settings.original);
  gear.hidden = settings.original; placeHint();
  for (const id of ['cheats', 'scenario']) {   // cab: both dev only (S7)
   const b = nav.querySelector(`[data-tab=${id}]`);
   if (b) b.hidden = settings.original || !(dev || settings.devTools);
   if (tab === id && b?.hidden) tab = 'helpers';
  }
  for (const b of nav.children) { const selected = b.dataset.tab === tab; b.setAttribute('aria-selected', String(selected)); b.tabIndex = selected ? 0 : -1; }
  body.replaceChildren(); body.setAttribute('aria-labelledby', `por-plus-tab-${tab}`);
  if (renderers.has(tab)) { renderers.get(tab)(body, api); return; }
  if (tab === 'helpers') {
   checkbox('original', 'Play the original game');
   const p = document.createElement('p'); p.textContent = 'Original mode turns every addition off. Your helper choices are kept. F12 returns here.'; body.append(p);
   checkbox('sidePanel', 'Show Plus as a side panel', settings.original);
   for (const [name, label] of Object.entries(labels)) if (available.has(name)) checkbox(name, label, settings.original);   // cab: only adapted helpers
   if (!settings.original) window.goldBoxPlusHelpers?.renderExtras(body);   // W8 helper actions (presets, quick save/load)
  } else if (tab === 'about') {
   // cab: Curse credits (CREDITS.md)
   for (const text of ['Gold Box Plus for Curse of the Azure Bonds: optional helpers on top of the faithful engine. "Play the original game" turns every addition off.',
    'Built on Gold Box Plus of the Pool of Radiance project (the same shell, hooks and store, adapted for Curse).',
    'Gold Box Companion (gbc.zorbus.net): the feature list Plus works from; inspiration only, nothing copied.',
    'simeonpilgrim/coab: used only as a cross-check oracle while decoding the original program; no code copied.',
    'Darklands+ (MIT) inspired the F12 window and the original-game switch.',
    'No original file, picture or journal text is included: the player supplies their own copy of the game.']) { const p = document.createElement('p'); p.textContent = text; body.append(p); }
   const a = document.createElement('a'); a.href = new URL('./CREDITS.md', import.meta.url); a.textContent = 'Full credits'; a.target = '_blank'; a.rel = 'noopener'; body.append(a);
  } else if (tab === 'games') void renderGames(body);   // cab: the selector (cab next to por) without a boot-time registration
  else renderStub(body, tab);
 }
 for (const [id, label] of tabs) {

  const b = document.createElement('button'); b.id = `por-plus-tab-${id}`; b.dataset.tab = id; b.textContent = label; b.setAttribute('role', 'tab'); b.setAttribute('aria-controls', body.id); b.onclick = () => api.selectTab(id); nav.append(b);
 }
 // cab: put the hint strip in the largest margin around the scaled frame; never over it. `data-plus-hint` on <html> asks the
 // page's fit() for a strip below the frame (plus request #6) when no margin is large enough.
 let reserved = null;
 function placeHint() {
  hint.hidden = settings.original;
  const want = settings.original ? null : String(Math.ceil(hint.offsetHeight || 0) + 8);
  if (want !== reserved) { reserved = want; if (want) document.documentElement.dataset.plusHint = want; else delete document.documentElement.dataset.plusHint; window.dispatchEvent(new Event('resize')); }
  if (hint.hidden) return;
  const r = canvas?.getBoundingClientRect?.() || { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
  Object.assign(hint.style, { left: '', top: '', width: '', transform: '', visibility: '' });
  const W = innerWidth, H = innerHeight, h = hint.offsetHeight, w = hint.offsetWidth, gap = 4;
  const at = (where, left, top, width) => { hint.dataset.where = where; Object.assign(hint.style, { left: left + 'px', top: top + 'px', width: width ? width + 'px' : '' }); };
  if (H - r.bottom >= h + gap) at('below', Math.max(8, Math.min(W - w - 8, r.left + (r.width - w) / 2)), r.bottom + gap);
  else if (r.top >= h + gap) at('above', Math.max(8, Math.min(W - w - 8, r.left + (r.width - w) / 2)), r.top - h - gap);
  else if (W - r.right >= 96 + gap) at('right', r.right + gap, r.bottom - h * 2 - gap, W - r.right - 2 * gap);
  else if (r.left >= 96 + gap) at('left', gap, r.bottom - h * 2 - gap, r.left - 2 * gap);
  else { hint.dataset.where = 'none'; hint.style.visibility = 'hidden'; }   // no free margin: wait for fit() to leave the strip
  if (hint.dataset.where === 'right' || hint.dataset.where === 'left') hint.style.top = Math.max(r.top, r.bottom - hint.offsetHeight) + 'px';
 }
 addEventListener('resize', () => requestAnimationFrame(placeHint));
 if (canvas && typeof ResizeObserver === 'function') new ResizeObserver(() => placeHint()).observe(canvas);
 function focusables() { return [...root.querySelectorAll('button, input:not(:disabled), a, [tabindex="0"]')].filter(e => !e.hidden); }
 function move(delta) { const a = focusables(); a[(a.indexOf(document.activeElement) + delta + a.length) % a.length]?.focus(); }
 const api = {
  get isOpen() { return open; }, get settings() { return { ...settings }; }, get hint() { return hint; },
  // cab: per-save-slot records (store `cab-plus`, key [profile, slot, name]); the slot is the game last loaded / saved
  slotStore(slot = hooks.state.slot || 'session') { return createStore({ profile, slot }); },
  enabled(name) { return !settings.original && settings[name] === true; },
  setInput(value) { gate = value; if (open && gate) { previousSuspended = gate.suspended; gate.suspended = true; } },
  async setSetting(name, value) { if (!(name in defaults)) return; settings[name] = !!value; const focused = document.activeElement?.dataset.setting; render(); if (focused) body.querySelector(`[data-setting="${focused}"]`)?.focus(); window.dispatchEvent(new CustomEvent('por-plus-settings', { detail: { settings: api.settings, enabled: api.enabled } })); return storage.set('settings', settings); },
  async setContext({ profile = 'cab', slot = 'default' } = {}) { storage = createStore({ profile, slot }); const saved = await storage.get('settings', defaults); settings = { ...defaults }; for (const k of Object.keys(defaults)) if (typeof saved?.[k] === 'boolean') settings[k] = saved[k]; render(); window.dispatchEvent(new CustomEvent('por-plus-settings', { detail: { settings: api.settings, enabled: api.enabled } })); },
  selectTab(id) { if (![...nav.children].some(b => b.dataset.tab === id && !b.hidden)) return; tab = id; render(); },
  registerTab(id, renderer) { renderers.set(id, renderer); if (tab === id) render(); },
  open() { if (open) return; previousFocus = document.activeElement; open = true; if (gate) { previousSuspended = gate.suspended; gate.suspended = true; } root.hidden = false; render(); nav.querySelector('[aria-selected="true"]')?.focus(); window.dispatchEvent(new CustomEvent('por-plus-open')); },
  close() { if (!open) return; open = false; root.hidden = true; if (gate) gate.suspended = previousSuspended; previousFocus?.focus(); window.dispatchEvent(new CustomEvent('por-plus-close')); },
  toggle() { open ? api.close() : api.open(); },
  ready: null,
 };
 gear.onclick = () => api.toggle();
 window.addEventListener('keydown', e => {
  if (e.key === 'F12') { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) api.toggle(); return; }
  if (!open) return;
  e.stopImmediatePropagation();
  if (e.key === 'Escape') { e.preventDefault(); api.close(); }
  else if (e.key === 'Tab') { e.preventDefault(); move(e.shiftKey ? -1 : 1); }
  else if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key) && document.activeElement?.getAttribute('role') === 'tab') {
   e.preventDefault(); const a = [...nav.children].filter(b => !b.hidden); const n = e.key === 'Home' ? 0 : e.key === 'End' ? a.length - 1 : (a.findIndex(b => b.dataset.tab === tab) + (e.key === 'ArrowRight' ? 1 : a.length - 1)) % a.length; api.selectTab(a[n].dataset.tab); a[n].focus();
  }
 }, true);
 for (const type of ['keyup', 'keypress', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'click', 'contextmenu', 'wheel']) window.addEventListener(type, e => {
  if (open && !root.contains(e.target) && e.target !== gear) { e.preventDefault(); e.stopImmediatePropagation(); }
 }, { capture: true, passive: false });
 const previous = new Map();
 function poll() {
  for (const pad of navigator.getGamepads?.() || []) {
   if (!pad) continue;
   const values = { menu: pad.buttons[9]?.pressed, back: pad.buttons[1]?.pressed, choose: pad.buttons[0]?.pressed, next: pad.buttons[13]?.pressed || pad.axes[1] > .6, prev: pad.buttons[12]?.pressed || pad.axes[1] < -.6, left: pad.buttons[14]?.pressed || pad.buttons[4]?.pressed, right: pad.buttons[15]?.pressed || pad.buttons[5]?.pressed };
   for (const [key, down] of Object.entries(values)) {
    const id = `${pad.index}:${key}`;
    if (down && !previous.get(id)) {
     if (key === 'menu') api.toggle();
     else if (open) {
      if (key === 'back') api.close(); else if (key === 'choose') document.activeElement?.click();
      else if (key === 'next' || key === 'prev') move(key === 'next' ? 1 : -1);
      else { const a = [...nav.children].filter(b => !b.hidden); const n = (a.findIndex(b => b.dataset.tab === tab) + (key === 'right' ? 1 : a.length - 1)) % a.length; api.selectTab(a[n].dataset.tab); a[n].focus(); }
     }
    }
    previous.set(id, down);
   }
  }
  requestAnimationFrame(poll);
 }
 requestAnimationFrame(poll);
 api.ready = storage.get('settings', defaults).then(saved => { settings = { ...defaults }; for (const k of Object.keys(defaults)) if (typeof saved?.[k] === 'boolean') settings[k] = saved[k]; render(); });
 instance = api; window.goldBoxPlus = api;
 // cab: the package tabs register themselves (Pool: engine/main.js), so the boot needs only mountPlus (plus request #5)
 window.goldBoxPlusTabs ||= {};
 for (const [name, file, method] of [['quests', './tabs/quests.js', 'registerQuestsTab'], ['journal', './tabs/journal.js', 'registerJournalTab'], ['pedia', './tabs/pedia.js', 'registerPediaTab'], ['map', './tabs/map.js', 'registerMapTab']])   // pedia: plus request #9
  import(file).then(m => { window.goldBoxPlusTabs[name] ||= m[method](api, { profile }); }).catch(e => console.warn(`Plus ${name}: ${e.message}`));
 if (dev) for (const [name, file, method] of [['cheats', './tabs/cheats.js', 'registerCheatsTab'], ['scenario', './tabs/scenario.js', 'registerScenarioTab']])   // cab: dev only (S7)
  import(file).then(m => { window.goldBoxPlusTabs[name] ||= m[method](api, { profile }); }).catch(e => console.warn(`Plus ${name}: ${e.message}`));
 const scenario = new URLSearchParams(location.search).get('scenario');   // cab: ?scenario=<name> (dev only), once the engine dev entry is up
 if (dev && scenario) (async () => { for (let i = 0; i < 600 && !hooks.dev; i++) await new Promise(r => setTimeout(r, 100)); await (await import('./cheats/scenario.js')).runScenario(scenario); })().catch(e => console.warn(`Plus scenario ${scenario}: ${e.message}`));
 // cab: the W8 helpers (each off until its Helpers toggle is on; Pool: engine/main.js startHelpers)
 import('./helpers/index.js').then(m => m.startHelpers(api, { profile, canvas })).catch(e => console.warn(`Plus helpers: ${e.message}`));
 if (!gate) import('../engine/input.js').then(m => api.setInput(m.gamepad)).catch(() => {});
 render(); return api;
}
if (typeof document !== 'undefined') mountPlus();
