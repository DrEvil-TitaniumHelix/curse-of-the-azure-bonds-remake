// Scenarios (W11 + W12, dev-only; cab-plus-shell S7). A scenario is a JSON file (format `cab-scenario` version 1, below
// and game/plus/scenario/data/*.json) that starts a game in a chosen state: a party made by the game's own creation rules
// (cheats/party.js), a data set / block / square / facing, ECL flags, the clock, and optionally the scenario's own ECL
// records written as ecldis.py listings (assembled by scenario/eclasm.js and served for ECLn.DAX through the DAX record
// resolver, hooks.setDaxResolver). `?scenario=<name>&dev=1` runs it at boot. The engine starts it with its dev entry
// `hooks.dev.startScenario` (plus request #13): from the top menu, the party replaced, the game begun in the block, the
// cells set — so nothing of the original data is stored here (party, ECL, GEO come from the player's files at run time).
import { hooks } from '../hooks.js';
import { buildParty, normalizeMember, gameNames, devEntry } from './party.js';
import { clockCells, FACING } from './live.js';
import { assemble } from '../scenario/eclasm.js';
import { loadModule } from '../pedia/records.js';

export { FACING };
const hex4 = (k) => { if (!/^(0x)?[0-9a-f]{4}$/i.test(k)) throw new Error(`flag "${k}": hex address expected`); return parseInt(k.replace(/^0x/i, ''), 16); };
// ECL memory saved with the game (ECL_VM.md section 3: regions 0..2 = VM 4B00..4EFF, 7C00..7FFF, 7A00..7BFF)
export const FLAG_REGIONS = [[0x4B00, 0x4EFF], [0x7A00, 0x7BFF], [0x7C00, 0x7FFF]];
export function flagAddress(k) {
  const a = hex4(k);
  if (!FLAG_REGIONS.some(([lo, hi]) => a >= lo && a <= hi)) throw new Error(`flag ${k}: not in a saved ECL region (4B00..4EFF, 7A00..7FFF)`);
  return a;
}

export function validateScenario(s, { names } = {}) {
  if (!s || typeof s !== 'object') throw new Error('scenario: object expected');
  if (s.format !== 'cab-scenario' || s.version !== 1) throw new Error('scenario: format "cab-scenario", version 1 expected (Pool scenarios do not fit Curse)');
  for (const k of ['dataset', 'block', 'x', 'y']) if (!Number.isInteger(s[k])) throw new Error(`scenario.${k}: integer required`);
  if (s.dataset < 1 || s.dataset > 6) throw new Error('scenario.dataset: 1..6');
  if (s.x < 0 || s.x > 15 || s.y < 0 || s.y > 15) throw new Error('scenario.x/y: 0..15');
  if (!(String(s.facing ?? 'N').toUpperCase() in FACING)) throw new Error('scenario.facing: N, E, S or W');
  for (const [a, v] of Object.entries(s.flags || {})) { flagAddress(a); const n = typeof v === 'string' ? Number(v) : v; if (!Number.isInteger(n) || n < 0 || n > 0xFFFF) throw new Error(`flag ${a}: word value expected`); }
  if (s.clock) clockCells(s.clock);
  for (const e of s.ecl || []) { if (!Number.isInteger(e.dataset) || !Number.isInteger(e.block) || typeof e.listing !== 'string') throw new Error('scenario.ecl[]: { dataset, block, listing }'); assemble(e.listing); }
  if (!Array.isArray(s.party) || s.party.length < 1 || s.party.length > 6) throw new Error('scenario.party: 1..6 members');
  if (names) s.party.forEach((m, i) => normalizeMember(m, names, i, { cheat: !!s.cheat }));
  return s;
}

// the scenario's ECL records: { 'ECL2.DAX': Map(block -> bytes) } for the DAX resolver
export function eclRecords(s) {
  const out = new Map();
  for (const e of s.ecl || []) { const k = `ECL${e.dataset}.DAX`; if (!out.has(k)) out.set(k, new Map()); out.get(k).set(e.block, assemble(e.listing)); }
  return out;
}
export function eclResolver(records, next = null) {
  return (name, id, raw) => records.get(String(name).toUpperCase())?.get(id)?.slice() ?? (next ? next(name, id, raw) : null);
}

export async function fetchScenario(name) {
  if (!/^[a-z0-9-]+$/i.test(name)) throw new Error('scenario name: letters, digits, -');
  const r = await fetch(new URL(`../scenario/data/${name}.json`, import.meta.url));
  if (!r.ok) throw new Error(`scenario ${name} not found`);
  return r.json();
}
async function playerNames(profile) {
  const { fetchFile } = await import('../../engine/dax.js');
  profile ??= await (await import('../games.js')).loadProfile('cab');
  return gameNames(loadModule(await fetchFile('START.EXE')).subarray(profile.engine.state.dsImageOffset));
}
// build the party, serve the scenario's ECL, hand the start to the engine
export async function runScenario(s, { dev, names, bus = hooks } = {}) {
  if (typeof s === 'string') s = await fetchScenario(s);
  names ??= await playerNames();
  validateScenario(s, { names });
  const d = devEntry(dev); if (typeof d.startScenario !== 'function') throw new Error('the engine dev entry has no startScenario (plus request #13)');
  const party = await buildParty(s.party, { names, dev: d, cheat: !!s.cheat });
  const ecl = eclRecords(s);
  if (ecl.size) bus.setDaxResolver(eclResolver(ecl, bus.daxResolver));
  const flags = Object.entries(s.flags || {}).map(([a, v]) => [flagAddress(a), typeof v === 'string' ? Number(v) : v]);
  await d.startScenario({ records: party.map((p) => p.record), dataset: s.dataset, block: s.block, x: s.x, y: s.y,
    facing: FACING[String(s.facing ?? 'N').toUpperCase()], flags, clock: s.clock ? clockCells(s.clock) : null });
  return { scenario: s, party };
}
