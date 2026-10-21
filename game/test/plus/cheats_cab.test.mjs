// cheats_cab.test.mjs (cab-plus-shell, S7 W11 / W12): the Curse cheat and scenario side.
//  - the record offsets Plus checks (cheats/party.js FIELDS) are the ones of decode/pseudo/PARTY.pas.md ## Character record;
//  - names -> ids from the player's own START.EXE DS tables (race / class / alignment / gender, multi-class bases);
//  - buildParty hands each spec to the engine's dev entry and refuses a record that differs from it (fake dev entry here:
//    the real one is plus request #13), out-of-limit specs need "cheat";
//  - scenarios: the shipped samples validate, Pool scenarios are refused, flags only in the saved ECL regions, the clock
//    as the VM cells, a scenario's ECL listing is assembled and served through the DAX resolver.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { FIELDS, RECORD, gameNames, normalizeMember, verifyRecord, buildParty, basesOf } from '../../plus/cheats/party.js';
import { validateScenario, flagAddress, eclRecords, eclResolver, runScenario } from '../../plus/cheats/scenario.js';
import { clockCells } from '../../plus/cheats/live.js';
import { loadModule } from '../../plus/pedia/records.js';
const root = new URL('../../../', import.meta.url);
const folder = process.env.CAB_DATA || fileURLToPath(new URL('../re-targets/goldbox/cotab/curazure/', root));
const local = existsSync(folder) ? false : 'local player copy unavailable';
const profile = JSON.parse(readFileSync(new URL('game/profiles/cab.json', root), 'utf8'));
const read = (p) => readFileSync(new URL(p, root), 'utf8');
// the names as the game has them (fallback for runs without the player's copy: the same lists, for the pure tests)
const NAMES = { race: ['Monster', 'Dwarf', 'Elf', 'Gnome', 'Half-Elf', 'Halfling', 'Half-Orc', 'Human'],
 cls: ['Cleric', 'Druid', 'Fighter', 'Paladin', 'Ranger', 'Magic-User', 'Thief', 'Monk', 'Cleric/Fighter', 'Cleric/Fighter/Magic-User', 'Cleric/Ranger', 'Cleric/Magic-User', 'Cleric/Thief', 'Fighter/Magic-User', 'Fighter/Thief', 'Fighter/Magic-User/Thief', 'Magic-User/Thief'],
 alignment: ['Lawful Good', 'Lawful Neutral', 'Lawful Evil', 'Neutral Good', 'True Neutral', 'Neutral Evil', 'Chaotic Good', 'Chaotic Neutral', 'Chaotic Evil'], gender: ['Male', 'Female'] };

test('checked record offsets = PARTY.pas.md ## Character record', () => {
 const doc = read('decode/pseudo/PARTY.pas.md').split(/\r?\n## Character record/)[1];
 const row = (re) => { const m = new RegExp(`^\\| ${re} \\|`, 'm').exec(doc); assert.ok(m, re); return m; };
 assert.match(doc, /1A6h = 422 bytes/); assert.equal(RECORD, 422); assert.equal(profile.recordSizes.TChar, RECORD);
 const at = (off, name) => assert.match(doc, new RegExp(`^\\| ${off} \\|[^|]*\\| ${name}`, 'm'), `${off} ${name}`);
 at('00', 'name'); at('74', 'race'); at('75', 'class'); at('78', 'hp_max'); at('119', 'gender'); at('11B', 'alignment'); at('127', 'xp');
 at('109\\.\\.110', 'level\\[0\\.\\.7\\]'); at('FB\\.\\.108', 'money\\[0\\.\\.6\\] words'); at('10\\+2i', 'ability max'); at('11\\+2i', 'ability current');
 row('1C / 1D');
 assert.deepEqual([FIELDS.race, FIELDS.cls, FIELDS.hpMax, FIELDS.gender, FIELDS.alignment, FIELDS.xp, FIELDS.level, FIELDS.money, FIELDS.abilityMax, FIELDS.ability, FIELDS.strExcMax, FIELDS.strExc],
  [0x74, 0x75, 0x78, 0x119, 0x11B, 0x127, 0x109, 0xFB, 0x10, 0x11, 0x1C, 0x1D]);
 // the same offsets as the profile's char-summary map (cab-build-engine, hooks.js)
 const f = profile.plus.charFields; assert.deepEqual([f.race, f.cls, f.levels, f.hpMax, f.xp, f.money], [FIELDS.race, FIELDS.cls, FIELDS.level, FIELDS.hpMax, FIELDS.xp, FIELDS.money]);
 // hp current: the profile's field (+1A4h)
 assert.equal(f.hp, FIELDS.hp);
});
test('names -> ids from the player\'s START.EXE DS tables', { skip: local }, () => {
 const ds = loadModule(new Uint8Array(readFileSync(path.join(folder, 'START.EXE')))).subarray(profile.engine.state.dsImageOffset);
 assert.deepEqual(gameNames(ds), NAMES);
});
test('member specs: ids, multi-class bases and levels, limits unless cheat', () => {
 const s = normalizeMember({ name: 'tamsin', race: 'elf', gender: 'F', class: 'Fighter / Magic-User', levels: [5, 4], alignment: 'chaotic good' }, NAMES);
 assert.deepEqual([s.name, s.race, s.gender, s.cls, s.alignment, s.levels], ['TAMSIN', 2, 1, 13, 6, [0, 0, 5, 0, 0, 4, 0, 0]]);
 assert.deepEqual(basesOf(15, NAMES), [2, 5, 6]);
 assert.throws(() => normalizeMember({ name: 'X', race: 'Orc', class: 'Fighter' }, NAMES), /unknown race "Orc"/);
 assert.throws(() => normalizeMember({ name: 'X', race: 'Human', class: 'Fighter', stats: { str: 19 } }, NAMES), /cheat/);
 assert.equal(normalizeMember({ name: 'X', race: 'Human', class: 'Fighter', stats: { str: 19 }, cheat: true }, NAMES).stats.str, 19);
 assert.throws(() => normalizeMember({ name: 'X', race: 'Monster', class: 'Fighter' }, NAMES), /monster race/);
});
// a stand-in for the engine's dev entry: writes the spec's fields at the record offsets (the engine runs the game's rules)
function fakeDev({ wrong } = {}) {
 const calls = [];
 return { calls, async createCharacter(spec) {
  calls.push(spec); const b = new Uint8Array(RECORD);
  b[0] = spec.name.length; for (let i = 0; i < spec.name.length; i++) b[1 + i] = spec.name.charCodeAt(i);
  b[FIELDS.race] = spec.race; b[FIELDS.cls] = wrong ? (spec.cls + 1) : spec.cls; b[FIELDS.gender] = spec.gender; b[FIELDS.alignment] = spec.alignment ?? 0;
  spec.levels.forEach((l, k) => { b[FIELDS.level + k] = l; });
  ['str', 'int', 'wis', 'dex', 'con', 'cha'].forEach((a, i) => { const v = spec.stats[a] === 'max' ? 17 : spec.stats[a]; b[FIELDS.ability + 2 * i] = v; b[FIELDS.abilityMax + 2 * i] = v; });
  if (Number.isInteger(spec.exc)) b[FIELDS.strExc] = spec.exc;
  b[FIELDS.money + 6] = spec.gold & 255; b[FIELDS.money + 7] = spec.gold >> 8; b[FIELDS.hpMax] = 40; b[FIELDS.hp] = spec.hp ?? 40;
  return b;
 }, async startScenario(s) { calls.push({ start: s }); } };
}
test('buildParty: each spec through the dev entry, every record checked against the spec', async () => {
 const dev = fakeDev(), party = await buildParty([{ name: 'BRAND', race: 'Human', class: 'Fighter', level: 5, gold: 100, stats: { str: 18, exc: 50 } }], { names: NAMES, dev });
 assert.equal(party[0].record.length, 422); assert.equal(dev.calls[0].levels[2], 5);
 await assert.rejects(buildParty([{ name: 'BRAND', race: 'Human', class: 'Fighter' }], { names: NAMES, dev: fakeDev({ wrong: true }) }), /differs from the spec: class: 3 \(asked 2\)/);
 await assert.rejects(buildParty([{ name: 'A', race: 'Human', class: 'Fighter' }], { names: NAMES, dev: {} }), /plus request #13/);
 const bad = verifyRecord(new Uint8Array(10), party[0].spec); assert.match(bad[0], /422 bytes/);
});
test('scenarios: the samples validate; Pool scenarios refused; flags in saved ECL regions; clock cells', () => {
 for (const name of JSON.parse(read('game/plus/scenario/data/index.json'))) validateScenario(JSON.parse(read(`game/plus/scenario/data/${name}.json`)), { names: NAMES });
 if (existsSync(new URL('game/scenarios/sokal-gate.json', root))) assert.throws(() => validateScenario(JSON.parse(read('game/scenarios/sokal-gate.json'))), /cab-scenario/);   // Pool's sample (private tree only)
 assert.equal(flagAddress('4C2A'), 0x4C2A); assert.throws(() => flagAddress('8000'), /saved ECL region/);
 assert.deepEqual(clockCells({ hour: 5, minute: 47, day: 1 }), [0, 7, 4, 5, 1, 0, 0]); assert.throws(() => clockCells({ hour: 24 }), /hour/);
});
test('a scenario ECL listing is assembled and served for ECLn.DAX through the resolver; runScenario hands the start to the engine', async () => {
 const listing = ['; record header (skipped by LoadEclBlock): 88 13 ; code 8000..8015 (22 bytes)',
  ...[1, 2, 3, 4, 5].map((v) => `${(0x8000 + 4 * (v - 1)).toString(16).toUpperCase()}  01 01 14 80              GOTO 8014        ; header vector ${v}`),
  '8014  00                       EXIT', '8015  00                       EXIT'].join('\n');
 const s = JSON.parse(read('game/plus/scenario/data/tilverton-start.json'));
 s.ecl = [{ dataset: 2, block: 1, listing }]; s.flags = { '4C2A': 1 };
 const rec = eclRecords(s).get('ECL2.DAX').get(1); assert.equal(rec.length, 2 + 0x16);
 const resolve = eclResolver(eclRecords(s)); assert.deepEqual([...resolve('ecl2.dax', 1, null)], [...rec]); assert.equal(resolve('ECL2.DAX', 2, null), null);
 let installed = null; const bus = { setDaxResolver(fn) { installed = fn; }, daxResolver: null };
 const dev = fakeDev(); const out = await runScenario(s, { dev, names: NAMES, bus });
 assert.equal(out.party.length, 4); assert.ok(installed);
 const start = dev.calls.at(-1).start;
 assert.deepEqual([start.dataset, start.block, start.x, start.y, start.facing, start.records.length], [2, 1, 7, 13, 1, 4]);
 assert.deepEqual(start.flags, [[0x4C2A, 1]]); assert.deepEqual(start.clock, [0, 0, 0, 5, 1, 0, 0]);
});
