// Quest tracking at run time (W5, gbp-flags): hooks events -> quest log -> listeners (the Quests tab) and the por-plus
// store. flagSet = one ECL write (applied synchronously, inside the engine's event); textPrinted in the quest's block =
// offer / mark texts; saveLoaded = full flag read + that slot's marks; gameSaved = marks copied to the slot.
// Marks are Plus state per save slot ('quests' in por-plus); flags are always re-read from the game.
import { hooks } from '../hooks.js';
import { createStore } from '../store.js';
import { createQuestLog } from './log.js';
import { loadQuestTexts } from './text.js';

export const saveSlot = (slot) => (typeof slot === 'string' && /^[A-Z]$/i.test(slot) ? slot.toUpperCase() : 'unsaved');

export function startQuests({ bus = hooks, profile = 'cab', storeFactory = createStore, loadTexts = loadQuestTexts, table } = {}) {
  const log = createQuestLog(table ? { table } : {});
  const listeners = new Set();
  let slot = saveSlot(bus.state?.slot), store = storeFactory({ profile, slot }), textsReady = false, readOnce = false;
  const pendingTexts = [];
  const live = () => bus.enabled !== false;

  function notify(changes, cause) {
    if (!changes.length) return changes;
    for (const fn of listeners) { try { fn(changes, cause); } catch (e) { console.error('[quests] listener failed:', e); } }
    return changes;
  }
  function persist() { void store.set('quests', log.snapshot()); }
  function readAll(cause) { readOnce = true; return notify(log.readAll((a) => bus.state.mem(a)), cause); }
  function text(p, pos) {
    if (!textsReady && !Number.isInteger(pos.addr)) { pendingTexts.push([p.text, pos]); return []; }
    const changes = notify(log.applyText(p.text, pos), 'textPrinted');
    if (changes.length) persist();
    return changes;
  }

  const offs = [
    bus.on('flagSet', (p) => { if (live()) notify(log.applyFlag(p.addr, p.value), 'flagSet'); }),
    bus.on('textPrinted', (p) => {
      if (!live()) return;
      const pos = bus.state.position() || {};   // cab: textPrinted carries addr / block / dataset of the ECL instruction
      text(p, { dataSet: p.dataset ?? pos.dataset, block: p.block ?? pos.block, addr: p.addr });
    }),
    bus.on('areaEntered', (p) => { if (live() && (!readOnce || p?.source === 'GAMELOOP')) readAll('areaEntered'); }),
    bus.on('saveLoaded', (p) => {
      if (!live()) return;
      slot = saveSlot(p.slot); store = storeFactory({ profile, slot });
      readAll('saveLoaded');
      const at = slot;
      void store.get('quests', null).then((snap) => { if (at === slot) notify(log.restore(snap), 'saveLoaded'); });
    }),
    bus.on('gameSaved', (p) => { if (!live()) return; slot = saveSlot(p.slot); store = storeFactory({ profile, slot }); persist(); }),
  ];

  const ready = Promise.resolve().then(() => loadTexts()).then((map) => {
    log.setTexts(map); textsReady = true;
    for (const [t, pos] of pendingTexts.splice(0)) { const c = notify(log.applyText(t, pos), 'textPrinted'); if (c.length) persist(); }
    return map;
  }).catch((e) => { textsReady = true; pendingTexts.length = 0; throw e; });
  ready.catch(() => {});
  if (bus.state?.position?.()) readAll('start');   // mounted mid-game: read the flags once now

  return {
    log, ready,
    get slot() { return slot; },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    stop() { for (const off of offs) off?.(); listeners.clear(); },
  };
}

let shared;
export function questTracker(options) { return shared || (shared = startQuests(options)); }
