// game/plus/hooks.js — Gold Box Plus W1: the thin layer between the pixel-exact engine and the Plus layer
// (GOLD_BOX_PLUS.md "Architecture"; contract and every event: docs/PLUS_HOOKS.md). Owner: gbp-hooks.
//
// Three parts, none of which changes what the game does:
//  1. Event bus: `hooks.on(name, fn)`, `hooks.off(name, fn)`, `hooks.emit(name, payload)`. Synchronous; a listener that
//     throws is caught and logged (console.error), never thrown into the engine. The engine's call sites are one line
//     each and carry the seg:off of the decoded point. `payload` may be a function: it is called only when somebody
//     listens, so a call site costs nothing in "Play the original game" mode. `name` '*' listens to every event.
//  2. State access, read-only: `hooks.state.party()`, `.position()`, `.mem(addr)` / `.flag(addr)` (ECL VM memory as the
//     VM reads it, no side effects), `.clock()`, `.slot`. Data comes from the engine's own objects (state.js G through
//     the VM facade, the VM's memory arrays), bound by areas/ecl_host.js bindEclHost.
//  3. Region registry: `hooks.registerRegion({ id, rect, left, right, kind, prio, scope })` puts a hit region into
//     engine/input.js `pointer.regions` (the same map the engine's own mouse regions live in, so the existing pointer
//     code does the hit test); `hooks.regions()` lists every region, the engine's ones (hmenu, vlist, roster, pmenu,
//     view) with their kind and the items of the matching draw event; `hooks.clearRegions(scope)` removes Plus regions.
//
// Master switch: `hooks.enabled = false` ("Play the original game", ruling GBP-4) makes emit a no-op, removes every Plus
// region and refuses new ones, so the mouse layer is exactly the engine's own.
//
// Test hooks: `?hooklog=1` records every event into `hooks.log` (also `window.__hookLog`); `?plus=0` starts disabled.

import { pointer } from '../engine/input.js';

// every event the engine emits (docs/PLUS_HOOKS.md has payloads, sources and timing)
export const EVENTS = ['textPrinted', 'areaEntered', 'moved', 'combatStart', 'combatEnd', 'monsterShown', 'pictureShown',
  'npcTalk', 'treasure', 'journalRef', 'flagSet', 'menuDrawn', 'listDrawn', 'partyDrawn', 'viewDrawn', 'saveLoaded',
  'gameSaved', 'combatTurn', 'combatCursor', 'inputStarted', 'inputChanged', 'inputEnded', 'anyKeyWait', 'anyKeyWaitEnded',
  'npcLeft', 'bigPicShown', 'characterImported'];   // cab: PER-8 — Curse-new events (ECL op 3E DUMP, BIGPIC backdrops, ov16 import)
const KNOWN = new Set(EVENTS);

const listeners = new Map();          // name -> [fn]
const pending = { warp: null, redraw: false };   // hooks request #14
let daxResolver = null;                           // hooks request #6
const recordInfo = new WeakMap();     // engine monster record -> { monsterId, dataset } (from monsterShown; never stored in the record)
const lastDraw = {};                  // engine region name -> payload of the draw event that set it
const warned = new Set();
let enabled = true;
let seq = 0;
let ctx = { G: null, vm: null };      // bound by areas/ecl_host.js bindEclHost
// cab: param — the character-record layout and the VM addresses the state getters read come from the profile
// (game/profiles/<id>.json "plus", set by hooks.configure at boot); the defaults are Pool's (285-byte TChar, VM 4900/6B00)
const L = { partyList: 'PartyHead', nameMax: 15, race: 0x2E, cls: 0x2F, levels: 0x96, hp: 0x11B, hpMax: 0x32, ac: 0x111,
  thac0: 0x110, status: 0x10C, side: 0x10E, npc: 0x84, xp: 0xAC, money: 0x88, itemType: 0x2E,
  partyCount: 0x6E3E, clock: 0x49C6, map3d: 0x49C5, combatModeVar: 'game_Mode' };

function warnOnce(k, ...a) { if (!warned.has(k)) { warned.add(k); console.warn('[hooks]', ...a); } }

// ---- journal references (derived from textPrinted; the original has no journal opcode) -------------------------------
// The ECL scripts print "... YOUR JOURNAL UNDER ENTRY 25.", "... ENTRIES 23 AND 14", "... AS ENTRY 7 IN YOUR JOURNAL",
// sometimes the number in a second PRINT ("UNDER ENTRY " then the number, ECL8 B512), and the proclamations as roman
// numerals after "IN YOUR JOURNAL YOU NOTE " (ECL3 AC25..ACC1).
// cab: PER-8 — Curse also splits "... AS JOURNAL " / "ENTRY 30." over two PRINTs (ECL2/2 852D, ECL4/34 81F1, ECL5/50
// 8C12: pendingJournal) and prints the number of a shared " ... JOURNAL ENTRY " subroutine from the caller, once from a
// table (ECL1/80 9A7C: 24 / 35 / 42); decode/ecl/JOURNAL_REFS.md has all 46 sites (game/test/plus/hooks_cab.test.mjs).
const journal = { pendingEntry: false, pendingJournal: false, proclamations: false, scene: '' };
function journalRefs(text, clear) {
  const out = [];
  const t = text.toUpperCase();
  if (clear) { journal.pendingEntry = false; journal.pendingJournal = false; journal.proclamations = false; }
  if (journal.pendingJournal) {                                  // cab: PER-8
    journal.pendingJournal = false;
    const m = /^\s*ENTR(?:Y|IES)\b((?:\s*(?:\d+|,|AND))+)/.exec(t);
    if (m) for (const d of m[1].match(/\d+/g) || []) out.push({ n: +d, kind: 'entry', text });
    else if (/^\s*ENTRY\s*$/.test(t)) journal.pendingEntry = true;
  }
  if (journal.pendingEntry) {
    journal.pendingEntry = false;
    const m = /^\s*(\d+)/.exec(t);
    if (m) out.push({ n: +m[1], kind: 'entry', text });
  }
  if (journal.proclamations) {
    for (const r of t.replace(/PROCLAMATIONS?/g, ' ').match(/\b[IVXLCDM]+\b/g) || []) out.push({ n: roman(r), kind: 'proclamation', id: r, text });
  }
  if (/JOURNAL/.test(t)) {
    const m = /\bENTR(?:Y|IES)\b((?:\s*(?:\d+|,|AND))+)/.exec(t);
    if (m) for (const d of m[1].match(/\d+/g)) out.push({ n: +d, kind: 'entry', text });
    else if (/\bENTRY\s*$/.test(t)) journal.pendingEntry = true;
    else if (/JOURNAL\s*$/.test(t)) journal.pendingJournal = true;   // cab: PER-8
    if (/JOURNAL YOU NOTE\s*$/.test(t)) journal.proclamations = true;
  }
  return out;
}
function roman(s) {
  const v = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let n = 0;
  for (let i = 0; i < s.length; i++) n += v[s[i]] < (v[s[i + 1]] || 0) ? -v[s[i]] : v[s[i]];
  return n;
}

// ---- event bus ---------------------------------------------------------------------------------------------------------
function call(fn, name, p) {
  try { fn(p, name); } catch (e) { console.error('[hooks] ' + name + ' listener failed: ' + (e && e.stack || e)); }
}
function dispatch(name, payload) {
  const fns = listeners.get(name), all = listeners.get('*');
  if (!fns && !all && !hooks.log) return;
  let p;
  try { p = typeof payload === 'function' ? payload() : payload; }
  catch (e) { console.error('[hooks] ' + name + ' payload failed: ' + (e && e.stack || e)); return; }
  if (p === undefined) return;                                   // a call site may decide there is nothing to report
  if (hooks.log) hooks.log.push({ ...p, seq: ++seq, event: name });   // `event`: payloads may have their own `name`
  if (fns) for (const fn of fns.slice()) call(fn, name, p);
  if (all) for (const fn of all.slice()) call(fn, name, p);
}

export const hooks = {
  log: null,
  get enabled() { return enabled; },
  set enabled(v) {
    enabled = !!v;
    if (!enabled) clearPlusRegions(null);
  },

  on(name, fn) {
    if (name !== '*' && !KNOWN.has(name)) warnOnce('on:' + name, 'unknown event', name);
    if (!listeners.has(name)) listeners.set(name, []);
    listeners.get(name).push(fn);
    return () => hooks.off(name, fn);
  },
  off(name, fn) {
    const a = listeners.get(name); if (!a) return;
    const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1);
    if (!a.length) listeners.delete(name);
  },
  emit(name, payload) {
    if (!enabled) return;
    try {
      if (!KNOWN.has(name)) { warnOnce('emit:' + name, 'unknown event', name); return; }
      if (name === 'textPrinted') {                              // journal references ride on the printed text
        let p = null;
        const get = () => (p ??= typeof payload === 'function' ? payload() : payload);
        dispatch(name, get);
        const t = get();
        if (t && typeof t.text === 'string') {
          if (t.clear && t.text.trim()) journal.scene = t.text;     // cab: PER-8 — the scene line of the tab (the last cleared text)
          for (const r of journalRefs(t.text, !!t.clear)) dispatch('journalRef', { ...r, source: t.source,
            ...(t.addr !== undefined ? { addr: t.addr, block: t.block, dataset: t.dataset, scene: journal.scene, clock: state.clock()?.text ?? null } : {}) });
        }
        return;
      }
      if (name === 'monsterShown') {                             // tag the loaded records so later summaries name their MON record
        const p = typeof payload === 'function' ? payload() : payload;
        if (p && p.records) { for (const r of p.records) recordInfo.set(r, { monsterId: p.id, dataset: p.dataset }); delete p.records; }
        dispatch(name, p);
        return;
      }
      if (name === 'saveLoaded' || name === 'gameSaved') {
        const p = typeof payload === 'function' ? payload() : payload;
        if (p && p.slot) state.slot = p.slot;
        dispatch(name, p);
        return;
      }
      if (name === 'menuDrawn' || name === 'listDrawn' || name === 'partyDrawn' || name === 'viewDrawn') {
        const p = typeof payload === 'function' ? payload() : payload;
        if (p && p.region) lastDraw[p.region] = { name, ...p };
        dispatch(name, p);
        return;
      }
      dispatch(name, payload);
    } catch (e) { console.error('[hooks] emit ' + name + ' failed: ' + (e && e.stack || e)); }
  },

  // ---- state (read-only) ----
  bind(c) { ctx = { ...ctx, ...c }; },
  // cab: param — profile "plus": { charFields: {...}, mem: { partyCount, clock, map3d }, partyList }
  configure(p = {}) { Object.assign(L, p.charFields || {}, p.mem || {}, p.partyList ? { partyList: p.partyList } : {}, p.combatModeVar ? { combatModeVar: p.combatModeVar } : {}); },
  get state() { return state; },

  // ---- cheat entry (hooks request #14, gbp-cheat): applied by ecl.js plusSafePoint between two explore commands ----
  safePointArmed: false,                                         // set by the game loop around its explore wait
  requestWarp({ dataset = null, block = null, x, y, facing = 0 } = {}) {
    if (!enabled || ![x, y].every((v) => Number.isInteger(v) && v >= 0 && v <= 255)) return false;
    pending.warp = { dataset, block, x, y, facing: facing & 3 };
    return true;
  },
  requestRedraw() { if (!enabled) return false; pending.redraw = true; return true; },
  safePointWanted: () => enabled && hooks.safePointArmed && !!(pending.warp || pending.redraw),
  takeSafePoint() {
    if (!enabled || !(pending.warp || pending.redraw)) return null;
    const p = { ...pending }; pending.warp = null; pending.redraw = false;
    return p;
  },

  // ---- DAX record resolver (hooks request #6, gbp-mods): engine/dax.js LoadDaxRecord asks it after decoding ----
  // fn(daxName, recordId, originalBytesCopy) -> Promise<Uint8Array | null>; only while hooks are on
  setDaxResolver(fn) { daxResolver = typeof fn === 'function' ? fn : null; },
  get daxResolver() { return enabled ? daxResolver : null; },

  // ---- regions ----
  registerRegion, clearRegions: (scope) => clearPlusRegions(scope ?? null), regions,

  // ---- test / log helpers ----
  startLog() { hooks.log = []; seq = 0; if (typeof window !== 'undefined') window.__hookLog = hooks.log; return hooks.log; },
  stopLog() { const l = hooks.log; hooks.log = null; return l; },
};
export default hooks;

// ---- state access --------------------------------------------------------------------------------------------------
const rd16 = (b, o) => b[o] | (b[o + 1] << 8);
const pname = (b) => { let s = ''; for (let i = 1; i <= b[0] && i <= L.nameMax; i++) s += String.fromCharCode(b[i]); return s; };
// TChar summary (decode/data/SAVES.md §3); `record` is a copy of the 285 bytes
export function charSummary(c, index, partyCount) {
  const b = c.b;
  return {
    index, name: pname(b), monster: partyCount !== undefined && index >= partyCount, selected: c === ctx.G?.SelectedChar,
    race: b[L.race], cls: b[L.cls], levels: Array.from(b.subarray(L.levels, L.levels + 8)), hp: b[L.hp], hpMax: b[L.hpMax],   // cab: param
    ac: 60 - b[L.ac], thac0: 60 - b[L.thac0], status: b[L.status], side: b[L.side], npc: b[L.npc] > 0x7F,
    xp: (b[L.xp] | (b[L.xp + 1] << 8) | (b[L.xp + 2] << 16) | (b[L.xp + 3] << 24)) >>> 0,
    money: Array.from({ length: 7 }, (_, k) => rd16(b, L.money + 2 * k)),
    ...recordInfo.get(c),
  };
}
export function itemSummary(it) {
  const b = it.b, n = Math.min(b[0], 40);
  let name = ''; for (let i = 1; i <= n; i++) name += String.fromCharCode(b[i]);
  return { name: name.trim(), type: b[L.itemType], record: b.slice() };   // cab: plus request #8 (pedia: names from the item words)
}

export const state = {
  slot: null,                                                    // last loaded / saved game letter ('A'..'J')
  get bound() { return !!ctx.vm; },
  partyCount() { return ctx.vm ? ctx.vm.m1(L.partyCount) : 0; }, // VM 6E3E party size (block 2 +67Ch); Curse 7F3E (cab: param)
  // every record of the party list (members first, then monsters that are still linked); `withRecord` adds a copy
  party({ withRecord = false, monsters = false } = {}) {
    const G = ctx.G; if (!G) return [];
    const n = state.partyCount(), out = [];
    let i = 0;
    for (let c = G[L.partyList]; c; c = c.next, i++) {             // cab: param (Curse G.PartyList)
      if (!monsters && n && i >= n) break;
      const s = charSummary(c, i, n || undefined);
      if (withRecord) s.record = c.b.slice();
      out.push(s);
    }
    return out;
  },
  position() {
    const G = ctx.G, vm = ctx.vm; if (!G) return null;
    return { block: G.ecl_Block, dataset: G.DataSet, x: G.party_MapX, y: G.party_MapY, facing: (G.party_Dir & 7) >> 1,
      dir: G.party_Dir, travelMode: G.travel_Mode, gameMode: G.game_Mode, map3d: vm ? vm.m0(L.map3d) : null,   // cab: param
      is3D: vm ? vm.is3D() : null };
  },
  mem(addr) { return ctx.vm ? ctx.vm.getMem(addr) : undefined; },   // 4300:07BC GetMem: read-only, no side effects
  // cab: plus request #10 — the live 1024 bytes of the loaded 3D map (view_ov30.js view.map, Load3DMap 6D00:133A; a copy)
  // and GetPassage 6D00:0596 as MoveParty uses it (read only)
  geoPlanes() { return ctx.view ? ctx.view.map.slice() : null; },
  passage(x, y, dir) { return ctx.view ? ctx.view.GetPassage(x, y, dir) : null; },
  flag(addr) { return state.mem(addr); },
  // combat (COMBAT/VIEW ov31 shapes: cb_Char/cb_Col/cb_Row/cb_Size[1..n], cm_Map.b +2/+3 = window origin, 7x7 cells
  // of 24x24 px from screen (8, 8)); null outside combat
  combatant(c) {
    const G = ctx.G; if (!G || !c || !G.cb_Char) return null;
    const n = G.cb_Size?.[0] || 0;
    let i = 1; while (i <= n && G.cb_Char[i] !== c) i++;
    if (i > n) return null;
    const sx = (v) => ((v & 0xFF) ^ 0x80) - 0x80;
    return { ...charSummary(c, i - 1), index: i, col: sx(G.cb_Col[i]), row: sx(G.cb_Row[i]), size: G.cb_Size[i], enemy: c.b[L.side] !== 0 };
  },
  combat() {
    const G = ctx.G; if (!G || G[L.combatModeVar] !== 5 || !G.cm_Map || !G.cb_Char) return null;   // cab: param (Curse view_Mode 5)
    const sx = (v) => ((v & 0xFF) ^ 0x80) - 0x80, list = [];
    for (let i = 1; i <= (G.cb_Size?.[0] || 0); i++) { const c = G.cb_Char[i]; if (c && G.cb_Size[i]) list.push(state.combatant(c)); }
    return { origin: { col: sx(G.cm_Map.b[2]), row: sx(G.cm_Map.b[3]) }, list };
  },
  // game clock VM 49C6..49CC (party_ov20 AdvanceClock; limits DS:363A 10,10,6,24,30,12,256)
  clock() {
    const vm = ctx.vm; if (!vm) return null;
    const w = Array.from({ length: 7 }, (_, i) => vm.m0(L.clock + i));   // cab: param (Curse 4BC6..4BCC)
    return { raw: w, round: w[0], minute: w[2] * 10 + w[1], hour: w[3], day: w[4], month: w[5], year: w[6],
      text: String(w[3]).padStart(2, '0') + ':' + String(w[2] * 10 + w[1]).padStart(2, '0') };
  },
};

// ---- regions ---------------------------------------------------------------------------------------------------------
// engine regions (registered by the engine's own draw / wait code through input.js setPointerRegion)
const ENGINE_KIND = { hmenu: 'menu', vlist: 'list', roster: 'party', pmenu: 'menu', view: 'view' };

function registerRegion({ id, rect, left = null, right = null, kind = 'plus', prio = 6, scope = 'plus' } = {}) {
  if (!enabled) return false;
  if (!id || !rect) { warnOnce('reg', 'registerRegion needs id and rect'); return false; }
  if (ENGINE_KIND[id]) { warnOnce('reg:' + id, 'region id ' + id + ' belongs to the engine'); return false; }
  const keysAt = (x, y) => {
    try {
      if (typeof left === 'function') return left(x, y) || null;
      if (Array.isArray(left)) return left.length ? left : null;
      if (left && typeof left.action === 'function') { left.action(x, y); return []; }   // handled: no key, stop the hit test
    } catch (e) { console.error('[hooks] region ' + id + ' failed: ' + (e && e.stack || e)); }
    return null;
  };
  pointer.regions.set(id, { x1: rect.x1, y1: rect.y1, x2: rect.x2, y2: rect.y2, prio, keysAt, plus: true, scope, kind, right, left });
  return true;
}
function clearPlusRegions(scope) {
  for (const [k, r] of [...pointer.regions]) if (r.plus && (scope === null || r.scope === scope)) pointer.regions.delete(k);
}
// every live region, engine and Plus, highest priority first: { id, rect, kind, prio, source, right, draw }
function regions() {
  const out = [];
  for (const [id, r] of pointer.regions) {
    const rect = { x1: r.x1, y1: r.y1, x2: r.x2, y2: r.y2 };
    if (r.plus) out.push({ id, rect, kind: r.kind, prio: r.prio, source: 'plus', scope: r.scope, right: r.right, left: r.left });
    else out.push({ id, rect, kind: ENGINE_KIND[id] || 'engine', prio: r.prio, source: 'engine', draw: lastDraw[id] || null,
      keysAt: r.keysAt });
  }
  return out.sort((a, b) => b.prio - a.prio);
}

// ---- URL switches (browser only) -------------------------------------------------------------------------------------
try {
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
  if (q && q.get('plus') === '0') enabled = false;
  if (q && q.get('hooklog') === '1') hooks.startLog();
  if (typeof window !== 'undefined') window.__hooks = hooks;
} catch { /* no location */ }
