// Quick save / autosave (W8, on by default). F5 = quick save, F9 = quick load, autosave after each area entry into three
// rotating slots — all through the game's own SaveGame / LoadGame (party_ov17.js 7500:1D58 / 7500:1602) with a preset
// slot letter outside the player's A..J (Q = quick, X/Y/Z = autosave; LoadGame's own menu only offers A..J, so these
// never appear there). Never during combat or while a script prompt waits: only at the explore menu (the last menuDrawn
// is the explore command line and no combat is running).
// Engine entry (Pool: hooks request #16; cab: plus request #11): `bus.engine.save(key)` / `bus.engine.load(key)` run the
// original routines with that key at the explore loop's next safe point and resolve when done. Until it exists the
// helper says so instead of saving.
export const QUICK = 'Q', AUTO = ['X', 'Y', 'Z'];
const EXPLORE = ['Area', 'Cast', 'View', 'Encamp', 'Search', 'Look'];

// state machine of "may we save now" from hook events (pure; tests feed it)
export function createSafePoint() {
  let combat = false, explore = false;
  return {
    get safe() { return !combat && explore; },
    event(name, p) {
      if (name === 'combatStart') { combat = true; explore = false; }
      else if (name === 'combatEnd') combat = false;
      else if (name === 'menuDrawn') explore = p?.kind === 'hmenu' && EXPLORE.every((w) => (p.items || []).some((i) => String(i.label).toLowerCase() === w.toLowerCase()));
      else if (name === 'listDrawn' || name === 'textPrinted' || name === 'npcTalk') explore = false;
    },
  };
}

export function createSaves({ bus, notify = () => {}, autoSlots = AUTO }) {
  const safe = createSafePoint();
  let on = { quick: false, auto: false }, pendingAuto = false, next = 0, busy = false, skipEntry = false;
  const offs = [];
  const engine = () => bus.engine && typeof bus.engine.save === 'function' ? bus.engine : null;
  async function run(kind, key) {
    const e = engine();
    if (!e) { notify(`${kind} needs the engine save entry (plus request #11).`, 'warn'); return false; }
    if (busy) return false;
    busy = true;
    try { await e[kind === 'Quick load' ? 'load' : 'save'](key); notify(`${kind}: game ${key}.`); return true; }
    catch (err) { notify(`${kind} failed: ${err.message}`, 'warn'); return false; }
    finally { busy = false; }
  }
  const api = {
    safe, get pendingAuto() { return pendingAuto; }, get nextAuto() { return autoSlots[next]; },
    async quickSave() { if (!on.quick) return false; if (!safe.safe) { notify('Quick save: only at the explore menu, not in combat or at a prompt.', 'warn'); return false; } return run('Quick save', QUICK); },
    async quickLoad() { if (!on.quick) return false; if (!safe.safe) { notify('Quick load: only at the explore menu.', 'warn'); return false; } skipEntry = true; return run('Quick load', QUICK); },
    async autoSave() {
      if (!on.auto || !pendingAuto || !safe.safe) return false;
      pendingAuto = false;
      const key = autoSlots[next]; next = (next + 1) % autoSlots.length;
      return run('Autosave', key);
    },
    set(name, v) { on[name] = !!v; },
    install() {
      const hm = bus.regions?.().find((r) => r.id === 'hmenu');   // helpers started while a menu waits: seed from its draw
      if (hm?.draw) safe.event('menuDrawn', hm.draw);
      offs.push(bus.on('*', (p, name) => {
        safe.event(name, p);
        if (name === 'areaEntered') { if (skipEntry) skipEntry = false; else if (on.auto) pendingAuto = true; }   // a quick load is not an area entry
        if (name === 'menuDrawn' && pendingAuto && safe.safe) void api.autoSave();
      }));
      const key = (ev) => {
        if (ev.key !== 'F5' && ev.key !== 'F9') return;
        if (!on.quick) return;
        ev.preventDefault(); ev.stopImmediatePropagation();
        void (ev.key === 'F5' ? api.quickSave() : api.quickLoad());
      };
      addEventListener('keydown', key, true); offs.push(() => removeEventListener('keydown', key, true));
      return api;
    },
    uninstall() { for (const off of offs.splice(0)) off(); },
  };
  return api;
}
