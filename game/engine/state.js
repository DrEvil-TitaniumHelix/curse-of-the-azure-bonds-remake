// state.js — the game's DS globals, shared by the engine, the ECL VM and every area (engine request #1, por-build-combat).
//
// Contract:
// - `G` is the one globals object. Every DS global is a property under its merged name (decode/names/*_names.json,
//   generated into game/state/globals.json by tools/gen_globals.py); `G.g_XXXX` reads/writes the same property when the
//   address XXXX has a name (otherwise `g_XXXX` is its own property). Far-pointer globals hold JS references (null = nil).
// - `G.ds` = Uint8Array(0x8760): the DS 0C7C image (initialised data of START.EXE, unpacked from the EXEPACK'ed file on
//   /data/, + zero BSS) for constant tables (string tables, ITEMS after the ITEMS load, ...). Loaded by initState().
// - Records use the ecl.js shape: TChar { b: Uint8Array(0x11D), next, items, effects, combat }, items { b: Uint8Array(0x3F),
//   next }, effects { b: Uint8Array(9), next }; the far-pointer bytes inside `b` are not used. Var parameters across areas
//   are `{ v }` objects.

import { fetchFile } from './dax.js';

const store = {
  game_Mode: 0, GameSpeed: 1, DebugFlag: 0, opt_Portraits: 1, opt_MonsterPics: 1, travel_Mode: 1,
  party_MapX: 15, party_MapY: 1, party_Dir: 6, PartyHead: null, SelectedChar: null,
  TileSetLo: null, TileSetHi: null, ItemTypeTable: null, StingMode: 0, GameSaved: 0, cfg_FullIntro: 0, SoundDevice: 2,
  ds: null,
};

const nameOf = {};     // 'XXXX' -> name
const addrOf = {};     // name -> 'XXXX'
const resolve = (k) => {
  if (typeof k !== 'string') return k;
  const m = /^g_([0-9A-Fa-f]{4})$/.exec(k);
  if (m) { const n = nameOf[m[1].toUpperCase()]; if (n) return n; }
  return k;
};

export const G = new Proxy(store, {
  get(t, k) { return t[resolve(k)]; },
  set(t, k, v) { t[resolve(k)] = v; return true; },
  has(t, k) { return resolve(k) in t; },
  deleteProperty(t, k) { delete t[resolve(k)]; return true; },
});

export function dsAddrOf(name) { return addrOf[name] ?? null; }

// EXEPACK unpack (decode/tools/unexepack.py; JS port by por-build-combat, game/test/combat/harness.js)
export function unexepack(raw) {
  const u16 = (b, o) => b[o] | (b[o + 1] << 8);
  const hdr = u16(raw, 8) * 16;
  const cblp = u16(raw, 2), cp = u16(raw, 4);
  const size = cblp ? (cp - 1) * 512 + cblp : cp * 512;
  const lm = raw.subarray(hdr, size);
  const cs = u16(raw, 0x16), eh = cs * 16;
  const destLen = u16(lm, eh + 12), skipLen = lm[eh + 16] === 0x52 ? u16(lm, eh + 14) : 1;
  const srcEnd = cs * 16 - (skipLen - 1) * 16;
  const buf = new Uint8Array(Math.max(destLen * 16, srcEnd));
  buf.set(lm.subarray(0, srcEnd));
  let s = srcEnd - 1, pad = 0;
  while (buf[s] === 0xFF && pad < 16) { s--; pad++; }
  let d = destLen * 16 - 1;
  for (;;) {
    const cmd = buf[s--];
    const len = (buf[s] << 8) | buf[s - 1]; s -= 2;
    if ((cmd & 0xFE) === 0xB0) { const f = buf[s--]; for (let i = 0; i < len; i++) buf[d--] = f; }
    else if ((cmd & 0xFE) === 0xB2) { for (let i = 0; i < len; i++) buf[d--] = buf[s--]; }
    else throw new Error('EXEPACK: bad command ' + cmd.toString(16));
    if (cmd & 1) break;
  }
  return buf.subarray(0, destLen * 16);
}

// cab: param (engine.state, recordSizes) — profile values (game/profiles/cab.json): Curse START.EXE is not EXEPACK'ed
// (CurseAzureBondsRE decode/LAYOUT.md): the load module is the file after the 7B0h-byte header, DS = 0C1C, DS+BSS = 8F00h.
const stateConfig = { exepack: true, headerBytes: 0, dsImageOffset: 0xC7C0, dsBytes: 0x8760 };
export function configureState(engineState, recordSizes) {
  if (engineState) Object.assign(stateConfig, engineState);
  if (recordSizes) { CHAR_SIZE = recordSizes.TChar ?? CHAR_SIZE; ITEM_SIZE = recordSizes.item ?? ITEM_SIZE;
    EFFECT_SIZE = recordSizes.effect ?? EFFECT_SIZE; COMBAT_SIZE = recordSizes.combat ?? COMBAT_SIZE; }
}
function loadModule(exe) {
  if (stateConfig.exepack) return unexepack(exe);
  const u16 = (o) => exe[o] | (exe[o + 1] << 8);
  const size = u16(2) ? (u16(4) - 1) * 512 + u16(2) : u16(4) * 512;
  return exe.slice(u16(8) * 16, size);                       // MZ header paragraphs (e_cparhdr) .. end of the load module
}

export async function initState() {
  try {
    // por-only: Pool globals JSON, executable and DS image offsets (profile: engine.state; game/profiles/PORONLY.md)
    const names = await (await fetch(new URL('../state/globals.json', import.meta.url))).json();
    for (const [a, n] of Object.entries(names)) { nameOf[a] = n; addrOf[n] = a; }
  } catch (e) { console.warn('state.js: globals.json not loaded', e); }
  const exe = await fetchFile('START.EXE');
  if (exe) {
    const img = loadModule(exe);                             // cab: param engine.state.exepack
    const ds = new Uint8Array(stateConfig.dsBytes);          // DS .. stack segment (initialised part + BSS)
    const o = stateConfig.dsImageOffset;
    ds.set(img.subarray(o, Math.min(img.length, o + stateConfig.dsBytes)));
    store.ds = ds;
    store.image = img;                                       // whole load module (segment s at s*16): audio.js reads 08AE
  }
}

// ---- records (ecl.js shape) ------------------------------------------------------------------------------------
// por-only: Pool character/item/effect/combat record allocations (profile: recordSizes; game/profiles/PORONLY.md)
export let CHAR_SIZE = 0x11D, ITEM_SIZE = 0x3F, EFFECT_SIZE = 9, COMBAT_SIZE = 0x16;   // cab: param recordSizes (Curse 1A6h)
export const newChar = () => ({ b: new Uint8Array(CHAR_SIZE), next: null, items: null, effects: null, combat: null });
export const newItem = () => ({ b: new Uint8Array(ITEM_SIZE), next: null });
export const newEffect = () => ({ b: new Uint8Array(EFFECT_SIZE), next: null });
export const rdW = (b, o) => b[o] | (b[o + 1] << 8);
export const wrW = (b, o, v) => { b[o] = v & 0xFF; b[o + 1] = (v >> 8) & 0xFF; };
export function pstr(b, o) { let s = ''; for (let i = 1; i <= b[o]; i++) s += String.fromCharCode(b[o + i]); return s; }
export function setPstr(b, o, s, max) { s = s.substring(0, max); b[o] = s.length; for (let i = 0; i < s.length; i++) b[o + 1 + i] = s.charCodeAt(i) & 0xFF; }
export const charName = (c) => pstr(c.b, 0);
