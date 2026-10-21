// Party spec -> 422-byte Curse character records (W11, dev-only; cab-plus-shell S7, adapted from Pool's gbp-cheat).
// The records are made by the game's own creation rules, never poked by hand: the engine's dev entry
// `hooks.dev.createCharacter(spec)` (plus request #13) runs CreateCharacter 4800:0782 with the spec's choices in place of
// the menu picks (rolls repeated within RaceLimits / ClassMin until the asked abilities are met), then XP + TrainCharacter
// 4800:4D2A per level. Plus only (1) turns names into the game's ids with the player's own DS tables (START.EXE) and
// (2) checks every record that comes back against the spec, field by field, at the offsets of
// decode/pseudo/PARTY.pas.md `## Character record` (the test reads them from there). Out-of-limit values need "cheat": true.
import { pstr } from '../pedia/records.js';
import { hooks } from '../hooks.js';

// PARTY.pas.md ## Character record (Curse, 1A6h record)
export const RECORD = 0x1A6;
export const FIELDS = Object.freeze({ name: 0x00, abilityMax: 0x10, ability: 0x11, strExcMax: 0x1C, strExc: 0x1D, race: 0x74, cls: 0x75,
  hpMax: 0x78, money: 0xFB, level: 0x109, gender: 0x119, alignment: 0x11B, xp: 0x127, hp: 0x1A4 });
export const ABILITIES = ['str', 'int', 'wis', 'dex', 'con', 'cha'];
// DS name tables (engine_ov17_create.js header, verified in the listing): [offset, stride, count]
export const DS_TABLES = Object.freeze({ race: [0x0E9C, 10, 8], cls: [0x0CB6, 0x1B, 17], alignment: [0x0EEC, 0x11, 9], gender: [0x0F85, 7, 2] });

export function gameNames(ds) {
  const out = {};
  for (const [k, [o, stride, n]] of Object.entries(DS_TABLES)) out[k] = Array.from({ length: n }, (_, i) => pstr(ds, o + i * stride, stride - 1));
  return out;
}
const norm = (s) => String(s ?? '').trim().toUpperCase().replace(/\s*\/\s*/g, '/').replace(/\s+/g, ' ');
function lookup(kind, value, list) {
  if (Number.isInteger(value)) { if (value < 0 || value >= list.length) throw new Error(`${kind} ${value}: 0..${list.length - 1}`); return value; }
  const i = list.findIndex((n) => norm(n) === norm(value));
  if (i < 0) throw new Error(`unknown ${kind} "${value}" (the game has: ${list.filter(Boolean).join(', ')})`);
  return i;
}
// base classes (0..7) of a class id, from its game name ("CLERIC/FIGHTER" -> [0, 2])
export function basesOf(cls, names) {
  if (cls < 8) return [cls];
  return names.cls[cls].split('/').map((part) => { const k = names.cls.slice(0, 8).findIndex((n) => norm(n) === norm(part)); if (k < 0) throw new Error(`class ${names.cls[cls]}: base "${part}" unknown`); return k; });
}

// one member of a scenario / the cheat tab -> the spec handed to hooks.dev.createCharacter
export function normalizeMember(m, names, index = 0, { cheat = false } = {}) {
  if (!m || typeof m.name !== 'string' || !m.name.trim()) throw new Error(`party[${index}]: name required`);
  const name = m.name.trim().toUpperCase();
  if (name.length > 15) throw new Error(`${name}: at most 15 letters`);
  const race = lookup('race', m.race, names.race);
  if (race === 0) throw new Error(`${name}: race 0 is the monster race`);
  const cls = lookup('class', Array.isArray(m.classes) ? m.classes.join('/') : m.class ?? m.classes, names.cls);
  let gender = 0;
  if (m.gender != null) {
    const exact = typeof m.gender === 'string' ? names.gender.findIndex((g) => norm(g) === norm(m.gender)) : -1;
    gender = exact >= 0 ? exact : typeof m.gender === 'string' && /^[fm]/i.test(m.gender) ? (/^f/i.test(m.gender) ? 1 : 0) : lookup('gender', m.gender, names.gender);
  }
  const alignment = m.alignment == null ? null : lookup('alignment', m.alignment, names.alignment);
  const bases = basesOf(cls, names), allow = cheat || !!m.cheat;
  const levelsIn = Array.isArray(m.levels) ? m.levels : bases.map(() => m.level ?? 1);
  if (levelsIn.length !== bases.length) throw new Error(`${name}: ${bases.length} levels needed for ${names.cls[cls]}`);
  const levels = new Array(8).fill(0);
  bases.forEach((k, i) => { const l = levelsIn[i]; if (!Number.isInteger(l) || l < 1 || l > (allow ? 127 : 40)) throw new Error(`${name}: level ${l}`); levels[k] = l; });
  const stats = {};
  for (const a of ABILITIES) {
    const v = m.stats?.[a] ?? 'max';
    if (v !== 'max' && (!Number.isInteger(v) || v < 3 || v > (allow ? 25 : 18))) throw new Error(`${name}: ${a} ${v} (3..18, or "cheat": true)`);
    stats[a] = v;
  }
  const exc = m.stats?.exc ?? 'max';
  if (exc !== 'max' && (!Number.isInteger(exc) || exc < 0 || exc > 100)) throw new Error(`${name}: exceptional strength 0..100`);
  const gold = m.gold ?? 0;
  if (!Number.isInteger(gold) || gold < 0 || gold > 0xFFFF) throw new Error(`${name}: gold 0..65535`);
  if (m.hp != null && (!Number.isInteger(m.hp) || m.hp < 0 || m.hp > 255)) throw new Error(`${name}: hp 0..255`);
  return { name, race, gender, cls, alignment, levels, bases, stats, exc, gold, hp: m.hp ?? null, cheat: allow };
}

const w16 = (b, o) => b[o] | (b[o + 1] << 8);
// the record's fields that must equal the spec (abilities only where a number was asked); [] = all agree
export function verifyRecord(b, spec) {
  const bad = [];
  if (!(b instanceof Uint8Array) || b.length !== RECORD) return [`record: ${RECORD} bytes expected, got ${b?.length}`];
  const want = (what, got, exp) => { if (got !== exp) bad.push(`${what}: ${got} (asked ${exp})`); };
  want('name', String.fromCharCode(...b.subarray(1, 1 + b[FIELDS.name])), spec.name);
  want('race', b[FIELDS.race], spec.race); want('class', b[FIELDS.cls], spec.cls); want('gender', b[FIELDS.gender], spec.gender);
  if (spec.alignment != null) want('alignment', b[FIELDS.alignment], spec.alignment);
  for (let k = 0; k < 8; k++) want(`level[${k}]`, (b[FIELDS.level + k] << 24) >> 24, spec.levels[k]);
  ABILITIES.forEach((a, i) => { if (Number.isInteger(spec.stats[a])) { want(a, b[FIELDS.ability + 2 * i], spec.stats[a]); want(a + ' max', b[FIELDS.abilityMax + 2 * i], spec.stats[a]); } });
  if (Number.isInteger(spec.exc) && spec.stats.str === 18) want('exceptional strength', b[FIELDS.strExc], spec.exc);
  want('gold', w16(b, FIELDS.money + 6), spec.gold);
  if (spec.hp != null) want('hp', b[FIELDS.hp], spec.hp);
  if (b[FIELDS.hp] > b[FIELDS.hpMax] && !spec.cheat) bad.push(`hp ${b[FIELDS.hp]} above max ${b[FIELDS.hpMax]}`);
  return bad;
}

export function devEntry(dev = hooks.dev) {
  if (!dev || typeof dev.createCharacter !== 'function') throw new Error('needs the engine dev entry (plus request #13); start with ?dev=1');
  return dev;
}
// party spec (1..6 members) -> verified records [{ spec, record }]
export async function buildParty(party, { names, dev, cheat = false } = {}) {
  if (!Array.isArray(party) || party.length < 1 || party.length > 6) throw new Error('party: 1..6 members');
  const d = devEntry(dev), out = [];
  for (const [i, m] of party.entries()) {
    const spec = normalizeMember(m, names, i, { cheat });
    const record = await d.createCharacter(spec);
    const bad = verifyRecord(record, spec);
    if (bad.length) throw new Error(`${spec.name}: the game's record differs from the spec: ${bad.join('; ')}`);
    out.push({ spec, record });
  }
  return out;
}
