// game/test/party/party_units.test.mjs — PARTY unit checks with decode / DOSBox values (cab-build-areas).
// Ground truth: the DOSBox-made save D of decode/data/SAVES.md (ALPHA: dwarf fighter level 5, STR 17 INT 17 WIS 13 DEX 16
// CON 12 CHA 11, 290 platinum), whose derived fields SAVES.md §2 checked against the on-screen sheet REF-S095; tables from
// the player's START.EXE + ITEMS (test/areas/fixture.mjs). Needs acceptance/local/saves/camp/CHRDATD1.SAV (gitignored,
// made by cab-saves-ref) — skipped when absent.
// Run: node game/test/party/party_units.test.mjs
import assert from 'node:assert/strict';
import { G, rdW } from '../../engine/state.js';
import { loadDS, loadSave, test, done } from '../areas/fixture.mjs';
import * as P21 from '../../areas/party_ov21.js';
import * as P24 from '../../areas/party_ov24.js';
import * as P25 from '../../areas/party_ov25.js';

const haveDS = loadDS();
const alpha = () => { const c = loadSave('camp/CHRDATD1.SAV'); if (c) { G.PartyList = c; G.SelectedChar = c; } return c; };
const bytes = (c, a, b) => Array.from(c.b.subarray(a, b));

await test('UpdateSaves rebuilds ALPHA\'s five saves (6600:07E3; save D +DFh..+E3h = 0E 0C 0D 0D 0E)', () => {
  const c = alpha(); if (!c || !haveDS) return 'skip';
  c.b.fill(0, 0xDF, 0xE4);
  P25.UpdateSaves(c);
  assert.deepEqual(bytes(c, 0xDF, 0xE4), [0x0E, 0x0C, 0x0D, 0x0D, 0x0E]);
});

await test('RecalcItems reproduces the sheet: THAC0 15, AC 8 (rear 30h), damage 1d2+1, encumbrance 290, move 12 (6200:0C28)', async () => {
  const c = alpha(); if (!c || !haveDS) return 'skip';
  const saved = c.b.slice();
  c.b[0x199] = 0; c.b[0x19A] = 0; c.b[0x19B] = 0; c.b.fill(0, 0x19E, 0x1A4); c.b[0x1A5] = 0; c.b[0x187] = 0; c.b[0x188] = 0;
  await P24.RecalcItems(c);
  assert.equal(c.b[0x199], 0x2D);                                // 60 - THAC0 15
  assert.deepEqual(bytes(c, 0x19A, 0x19C), [0x34, 0x30]);        // AC 8 / rear
  assert.deepEqual(bytes(c, 0x19E, 0x1A4), [1, 0, 2, 0, 1, 0]);  // 1d2+1 (STR 17: +1 damage)
  assert.equal(rdW(c.b, 0x187), 290);                            // 290 platinum, 1 each
  assert.equal(c.b[0x1A5], 12);
  for (let i = 0; i < 0x1A6; i++) assert.equal(c.b[i], saved[i], 'byte +' + i.toString(16) + ' differs from the DOSBox save');
});

await test('UpdateLevelStats / RecalcSpellSlots leave ALPHA unchanged (6600:03B1 / 0011)', () => {
  const c = alpha(); if (!c || !haveDS) return 'skip';
  const saved = c.b.slice();
  P25.UpdateLevelStats(c); P25.RecalcSpellSlots(c);
  assert.deepEqual(Array.from(c.b), Array.from(saved));
});

await test('class helpers: non-humans give class 11h / level 0, no dual class (6600:1298 / 1350 / 13BC)', () => {
  const c = alpha(); if (!c) return 'skip';
  assert.equal(P25.IsHuman(c), false);
  assert.equal(P25.CurrentClass(c), 0x11);
  assert.equal(P25.CurrentClassLevel(c), 0);
  assert.equal(P25.DualClassActive(c), false);
  c.b[0x74] = 7;                                                 // as a human fighter 5
  assert.equal(P25.CurrentClass(c), 2); assert.equal(P25.CurrentClassLevel(c), 5);
  c.b[0xE6] = 5; assert.equal(P25.DualClassActive(c), false);    // signed JG: 5 > 5 is false
  c.b[0xE6] = 4; assert.equal(P25.DualClassActive(c), true);
});

await test('UpdateThiefSkills indexes ThiefBase / RaceSkillAdj / DexSkillAdj as 6600:0bec..0cc0 (human thief 1, DEX 16)', () => {
  const c = alpha(); if (!c || !haveDS) return 'skip';
  c.b[0x74] = 7; c.b.fill(0, 0x109, 0x119); c.b[0x109 + 6] = 1; c.b[0x17] = 16;
  P25.UpdateThiefSkills(c);
  const s8 = (v) => ((v & 0xFF) ^ 0x80) - 0x80;
  for (let k = 1; k <= 8; k++) {
    const adj = s8(G.ds[0x3F1E + 7 * 8 + k]), base = G.ds[0x3EBE + 1 * 8 + k];
    let want = (adj < 0 && Math.abs(adj) > base) ? 0 : base + adj + (k < 6 ? s8(G.ds[0x3F31 + 16 * 5 + k]) : 0);
    assert.equal(c.b[0xE9 + k], want & 0xFF, 'skill ' + k);
  }
});

await test('money: MoneyValueInGold / SetCharMoneyGold with the CoinValue table DS:0CA2 (5500:00C7 / 0149)', () => {
  const c = alpha(); if (!c || !haveDS) return 'skip';
  assert.deepEqual([0, 1, 2, 3].map((k) => G.ds[0x0CA2 + 4 * k]), [1, 10, 100, 200]);   // copper .. gold in copper
  assert.equal(P21.MoneyValueInGold([0, 0, 0, 0, 290, 0, 0]), 1450);   // ALPHA's 290 platinum
  assert.equal(P21.MoneyValueInGold([0, 0, 0, 0, 0, 7, 9]), 0);         // gems / jewelry not counted
  P21.SetCharMoneyGold(1453);
  assert.deepEqual([0, 1, 2, 3, 4].map((k) => rdW(c.b, 0xFB + 2 * k)), [0, 0, 0, 3, 290]);   // 5 gold per platinum
});

await test('coin names DS:0F93 + 11k and CoinFromText (5500:0B91)', () => {
  if (!haveDS) return 'skip';
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map(P21.CoinName), ['Copper', 'Silver', 'Electrum', 'Gold', 'Platinum', 'Gems', 'Jewelry']);
  const nm = { v: '' };
  assert.equal(P21.CoinFromText('Gems 3', nm), 5);
});

await test('encumbrance: Add/SubEncumbrance word arithmetic, MaxCarryWeight = StrWeightAllowance + 1500 (5500:001B..0057)', async () => {
  const c = alpha(); if (!c || !haveDS) return 'skip';
  P21.AddEncumbrance(c, 10); assert.equal(rdW(c.b, 0x187), 300);
  P21.SubEncumbrance(c, 301); assert.equal(rdW(c.b, 0x187), 0xFFFF);   // word wrap, no clamp
  assert.equal(await P21.MaxCarryWeight(c), P24.StrWeightAllowance(c) + 1500);
});

await test('STR / DEX adjustments read the AD&D 1e tables from the image (6200 StrToHitAdj / StrDamageAdj / StrWeightAllowance / Dex*)', () => {
  const c = alpha(); if (!c || !haveDS) return 'skip';
  // [str, exc, to-hit, damage, weight allowance] — Players Handbook values (weight in coins)
  for (const [s, x, hit, dmg, wt] of [[3, 0, -3, -1, -350], [16, 0, 0, 1, 350], [17, 0, 1, 1, 500], [18, 0, 1, 2, 750],
    [18, 50, 1, 3, 1000], [18, 91, 2, 5, 2000], [18, 100, 3, 6, 3000], [19, 0, 3, 7, 4000], [25, 0, 7, 14, 15000]]) {
    c.b[0x11] = s; c.b[0x1C] = x;
    assert.deepEqual([P24.StrToHitAdj(c), P24.StrDamageAdj(c), P24.StrWeightAllowance(c)], [hit, dmg, wt], `STR ${s}/${x}`);
  }
  // [dex, defensive adjustment (AC bonus), missile to-hit]
  for (const [d, def, mis] of [[3, -4, -3], [6, -1, 0], [15, 1, 0], [16, 2, 1], [17, 3, 2], [18, 4, 3]]) {
    c.b[0x17] = d;
    assert.deepEqual([P24.DexDefenseAdj(c), P24.DexMissileAdj(c)], [def, mis], `DEX ${d}`);
  }
});

done('PARTY');
