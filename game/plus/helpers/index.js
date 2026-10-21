// Gold Box Plus helpers (W8, gbp-helpers): installs every helper and switches each one with its Helpers setting
// (`plus.enabled(name)`: false in original mode). Off = the helper's page elements and listeners are gone and the game
// canvas was never drawn on (0 px). Mount: `startHelpers(plus)` after mountPlus (hooks request #17).
import { hooks } from '../hooks.js';
import { createStore } from '../store.js';
import { canvasScreen } from './textcells.js';
import { createCrispFont } from './crispfont.js';
import { createTooltips } from './tooltips.js';
import { createCombatLog } from './combatlog.js';
import { createSaves } from './saves.js';

// cab: every helper is off until the player turns it on (Curse S6); spell presets and margins are not offered (presets read
// engine state; margins would rescale the frame)
export const HELPER_DEFAULTS = Object.freeze({ tooltips: false, combatLog: false, quicksave: false, autosave: false, spellPresets: false, margins: false, crispFont: false });

function toast(text, level = 'info') {
  let box = document.getElementById('por-plus-toast');
  if (!box) {
    box = document.createElement('div'); box.id = 'por-plus-toast'; box.setAttribute('role', 'status');
    Object.assign(box.style, { position: 'fixed', left: '50%', bottom: '12px', transform: 'translateX(-50%)', zIndex: '30', padding: '6px 12px',
      borderRadius: '6px', font: '13px system-ui, sans-serif', color: '#fff', pointerEvents: 'none' });
    document.body.append(box);
  }
  box.style.background = level === 'warn' ? 'rgba(140,60,20,.92)' : 'rgba(20,60,110,.92)';
  box.textContent = text; box.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => { box.hidden = true; }, 3000);
}

let started;
export async function startHelpers(plus, { bus = hooks, canvas = document.getElementById('screen'), profile = 'cab', pedia, screen } = {}) {   // cab: param
  if (started) return started;
  screen ??= await canvasScreen(canvas);   // cab: the presented canvas + the player's font, no engine module
  const revealed = () => (pedia || window.goldBoxPlusTabs?.pedia?.tracker)?.revealed || new Map();
  const h = {
    crispFont: createCrispFont({ canvas, screen }),
    tooltips: createTooltips({ canvas, screen, revealed }),
    combatLog: createCombatLog({ canvas, screen, bus }),
    saves: createSaves({ bus, notify: toast }).install(),
  };
  const enabled = (name) => (plus.settings.original ? false : plus.enabled(name));
  function apply() {
    h.crispFont.set(enabled('crispFont'));
    h.tooltips.set(enabled('tooltips'));
    h.combatLog.set(enabled('combatLog'));
    h.saves.set('quick', enabled('quicksave'));
    h.saves.set('auto', enabled('autosave'));
  }
  addEventListener('por-plus-settings', apply);
  apply();
  started = { helpers: h, apply, toast, renderExtras: (c) => renderHelperExtras(c, { plus, helpers: h }) };
  window.goldBoxPlusHelpers = started;
  return started;
}

// controls below the Helpers checkboxes (shell: call from its Helpers section, hooks request #17)
export function renderHelperExtras(container, { plus, helpers }) {
  const box = document.createElement('section'); box.setAttribute('aria-label', 'Helper actions');
  const add = (label, fn, disabled) => { const b = document.createElement('button'); b.textContent = label; b.disabled = !!disabled; b.onclick = async () => { try { await fn(); } catch (e) { toast(e.message, 'warn'); } }; box.append(b, ' '); return b; };
  add('Quick save (F5)', async () => { plus.close(); await helpers.saves.quickSave(); }, !plus.enabled('quicksave'));
  add('Quick load (F9)', async () => { plus.close(); await helpers.saves.quickLoad(); }, !plus.enabled('quicksave'));
  container.append(box);
}
