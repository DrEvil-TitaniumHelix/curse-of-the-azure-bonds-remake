// game/test/magic/magic_units.test.mjs — MAGIC unit checks with decode values (cab-build-areas).
// Spell table SpellTable DS:37DA (16 bytes per id: +0 class 0 cleric / 1 druid / 2 magic-user / 3 power, +1 level) and the
// names SpellNames DS:27BD + id*29h from the player's START.EXE (MAGIC.pas.md ov22 header); the class/level pairs checked
// are the AD&D Players Handbook ones. BuildSpellList / AddSpellLineCounted (5800:09FC / 05B4) build the memorised list with
// level headings LevelHeading DS:0875 + level*29h and the " (N)" count (MAGIC_SCREENS #verify-44).
// Run: node game/test/magic/magic_units.test.mjs
import assert from 'node:assert/strict';
import { G, pstr } from '../../engine/state.js';
import { loadDS, loadSave, test, done } from '../areas/fixture.mjs';
import * as M22 from '../../areas/magic_ov22.js';

const haveDS = loadDS();
const name = (id) => pstr(G.ds, 0x27BD + id * 0x29);
const row = (id) => [G.ds[0x37DA + id * 16], G.ds[0x37DA + id * 16 + 1]];
const idOf = (n, cls) => { for (let id = 1; id <= 100; id++) if (name(id) === n && G.ds[0x37DA + id * 16] === cls) return id; return 0; };

await test('spell table: AD&D class and level of named spells (DS:37DA / 27BD)', () => {
  if (!haveDS) return 'skip';
  for (const [n, cls, lv] of [['Bless', 0, 1], ['Cure Light Wounds', 0, 1], ['Hold Person', 0, 2], ['Remove Curse', 0, 3],
    ['Cure Serious Wounds', 0, 4], ['Raise Dead', 0, 5], ['Magic Missile', 2, 1], ['Sleep', 2, 1], ['Stinking Cloud', 2, 2],
    ['Fireball', 2, 3], ['Lightning Bolt', 2, 3], ['Hold Person', 2, 3], ['Ice Storm', 2, 4], ['Cone of Cold', 2, 5],
    ['Entangle', 1, 1]]) {
    const id = idOf(n, cls);
    assert.ok(id > 0, n + ' not found for class ' + cls);
    assert.deepEqual(row(id), [cls, lv], n);
  }
  assert.equal(name(1), 'Bless'); assert.equal(name(15), 'Magic Missile'); assert.equal(name(47), 'Fireball');
});

await test('InitSpellTable: selector name, 100 handlers, the seven ov22 effect handlers (5800:6311 .. 689d)', () => {
  M22.InitSpellTable();
  assert.equal(G.SpellHandlers[0], 'SelectTargetsCamp');
  for (let id = 1; id <= 100; id++) assert.equal(typeof G.SpellHandlers[id], 'function', 'handler ' + id);
  for (const t of [0x56, 0x58, 0x5A, 0x7E, 0x80, 0x83, 0x84]) assert.equal(typeof G.EffectHandler[t], 'function', 'effect ' + t.toString(16));
  assert.equal(G.cure_InProgress, 0); assert.equal(G.ItemCast, 0);
});

const cleric = () => {
  const c = loadSave('camp/CHRDATD1.SAV'); if (!c) return null;
  G.SelectedChar = c; G.PartyList = c; c.effects = null;
  c.b[0x74] = 7; c.b[0x75] = 0; c.b.fill(0, 0x109, 0x119); c.b[0x109] = 5;   // human cleric 5
  c.b.fill(0, 0x1E, 0x72);
  return c;
};
const listText = () => { const l = []; for (let p = G.sl_List; p; p = p.next) l.push((p.isHeader ? '#' : '') + p.text); return l; };

await test('BuildSpellList(0): memorised cleric spells by level with headings and " (N)" counts (5800:09FC / 05B4)', async () => {
  const c = cleric(); if (!c || !haveDS) return 'skip';
  const hold = idOf('Hold Person', 0), clw = idOf('Cure Light Wounds', 0);
  [1, 1, 1, clw, hold].forEach((id, i) => { c.b[0x1E + i] = id; });          // copies adjacent
  c.b[0x1E + 5] = 0x80 | 2;                                                  // Curse still to memorise: not listed in mode 0
  assert.equal(await M22.BuildSpellList(0), true);
  assert.deepEqual(listText(), ['#1st Level', '  Bless (3)', '  Cure Light Wounds', '#2nd Level', '  Hold Person']);
});

await test('quirk kept: a non-adjacent copy overwrites the line the search stopped at (5800:066c..0678 / 0747..0764)', async () => {
  const c = cleric(); if (!c || !haveDS) return 'skip';
  const clw = idOf('Cure Light Wounds', 0);
  [1, clw, 1].forEach((id, i) => { c.b[0x1E + i] = id; });
  await M22.BuildSpellList(0);
  // p walks to the CLW line while n stays on Bless: the count goes to sl_Counts[0], the text to the CLW node
  assert.deepEqual(listText(), ['#1st Level', '  Bless', '  Bless (2)']);
});

done('MAGIC');
