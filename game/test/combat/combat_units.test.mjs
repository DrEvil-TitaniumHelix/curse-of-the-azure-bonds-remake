// game/test/combat/combat_units.test.mjs — COMBAT unit checks with decode / DOSBox values (cab-build-areas).
// - Roll(count, sides) 5F00:137F against an independent TP 5 LCG: NextRandom 0A54:1154 = RandSeed * 08088405h + 1,
//   RandomWord 0A54:1105 = high word MOD range (0a54:1114..1117 XCHG / DIV / XCHG — the remainder), byte sum.
// - AttackRoll 5F00:123F, AttackRollVsAC 11D7 and SavingThrow 12EB on ALPHA (save D, decode/data/SAVES.md: THAC0 byte 2Dh,
//   saves 0E 0C 0D 0D 0E) for 200 seeds each, with the outcome predicted from the decoded rule and the predicted d20.
// Run: node game/test/combat/combat_units.test.mjs
import assert from 'node:assert/strict';
import { G } from '../../engine/state.js';
import { tp, setRandSeed } from '../../engine/tp.js';
import { loadDS, loadSave, test, done } from '../areas/fixture.mjs';
import * as C23 from '../../areas/combat_ov23.js';
import { HasEffect } from '../../areas/party_ov24.js';

const haveDS = loadDS();
const alpha = () => { const c = loadSave('camp/CHRDATD1.SAV'); if (c) { c.effects = null; G.PartyList = c; G.SelectedChar = c; } return c; };

// independent reference of the TP 5 generator
function refRolls(seed, count, sides) {
  let s = seed >>> 0, sum = 0;
  for (let i = 0; i < count; i++) {
    s = (Math.imul(s, 0x08088405) + 1) >>> 0;
    sum = (sum + ((s >>> 16) % sides) + 1) & 0xFF;
  }
  return { sum, seed: s };
}

await test('Roll = TP 5 LCG, high word mod sides, byte sum (5F00:137F, 0A54:1105 / 1154)', () => {
  for (const [seed, n, s] of [[0, 1, 20], [1, 3, 6], [0x12345678, 2, 8], [0xDEADBEEF, 255, 255], [7, 0, 6]]) {
    setRandSeed(seed);
    const r = C23.Roll(n, s), ref = refRolls(seed, n, s);
    assert.equal(r, ref.sum, `Roll(${n},${s}) seed ${seed}`);
    assert.equal(tp.randSeed >>> 0, ref.seed, 'seed after the roll');
  }
});

await test('AttackRoll: hit iff d20 > 1 and (20 -> 100) + thac0 byte + side bonus >= targetAC (5F00:123F)', async () => {
  const a = alpha(), t = alpha(); if (!a) return 'skip';
  a.b[0x197] = 0;                                                // party side: bonus Mem[7F71] (0 here, no VM bound)
  for (let seed = 1; seed <= 200; seed++) for (const ac of [0x30, 0x3C, 0x41, 0x46]) {
    setRandSeed(seed * 2654435761);
    const d = refRolls(seed * 2654435761, 1, 20).sum, v = d === 20 ? 100 : d;
    const want = d > 1 && v + 0x2D >= ac;
    setRandSeed(seed * 2654435761);
    assert.equal(await C23.AttackRoll(a, t, ac), want, `seed ${seed} ac ${ac}`);
    assert.equal(G.AttackRollValue, v);
  }
});

await test('AttackRollVsAC: hit iff d20 > 1 and value + toHit > target AC byte (5F00:11D7)', async () => {
  const t = alpha(); if (!t) return 'skip';                      // ALPHA's AC byte 34h
  for (let seed = 1; seed <= 200; seed++) {
    setRandSeed(seed * 40503);
    const d = refRolls(seed * 40503, 1, 20).sum, v = d === 20 ? 100 : d;
    setRandSeed(seed * 40503);
    assert.equal(await C23.AttackRollVsAC(t, 0x25), d > 1 && v + 0x25 > 0x34, `seed ${seed}`);
  }
});

await test('SavingThrow with ALPHA\'s DOSBox save table: 1 fails, 20 saves, else d20 + ac_item_bonus + bonus >= save[type] (5F00:12EB)', async () => {
  const c = alpha(); if (!c) return 'skip';
  const saves = [0x0E, 0x0C, 0x0D, 0x0D, 0x0E];
  for (let seed = 1; seed <= 200; seed++) for (let type = 0; type <= 4; type++) for (const bonus of [0, 2, -3]) {
    setRandSeed(seed * 69069 + type);
    const d = refRolls(seed * 69069 + type, 1, 20).sum;
    const want = d === 1 ? false : d === 20 ? true : ((d + bonus) & 0xFF) >= saves[type];
    setRandSeed(seed * 69069 + type);
    assert.equal(await C23.SavingThrow(c, type, bonus), want, `seed ${seed} type ${type} bonus ${bonus}`);
  }
});

await test('strength codes: StrengthCode / DecodeStrength round trip, 18/xx as 1..100 (5F00:16AC / 16D2)', () => {
  for (const [s, x] of [[3, 0], [17, 0], [18, 0], [18, 50], [18, 100], [19, 0], [25, 0]]) {
    const code = C23.StrengthCode(s, x);
    const e = { b: new Uint8Array(9) }; e.b[3] = code;
    const str = { v: 0 }, exc = { v: 0 }; C23.DecodeStrength(e, str, exc);
    assert.deepEqual([str.v, exc.v], [s, s === 18 ? x : 0], `str ${s}/${x} code ${code}`);
  }
});

await test('effect list: AddEffect appends 9-byte records, HasEffect finds them, RemoveEffect unlinks (5F00:13EE / 010E, 6200:2396)', async () => {
  const c = alpha(); if (!c) return 'skip';
  C23.AddEffect(c, 0x61, 0, 0xFF, 0); C23.AddEffect(c, 0x1A, 0, 0xFF, 0); C23.AddEffect(c, 0x2F, 5, 1, 0);   // ALPHA.FX types
  const types = []; for (let e = c.effects; e; e = e.next) types.push(e.b[0]);
  assert.deepEqual(types, [0x61, 0x1A, 0x2F]);
  const e = { v: null };
  assert.equal(!!HasEffect(c, 0x2F, e), true); assert.equal(e.v.b[1] | (e.v.b[2] << 8), 5); assert.equal(e.v.b[3], 1);
  await C23.RemoveEffect(c, 0x1A, null);
  const left = []; for (let q = c.effects; q; q = q.next) left.push(q.b[0]);
  assert.deepEqual(left, [0x61, 0x2F]);
  assert.equal(!!HasEffect(c, 0x1A, { v: null }), false);
});

await test('RecalcAbility STR / CON leave ALPHA as the DOSBox save has it (5F00:18D8)', async () => {
  const c = alpha(); if (!c || !haveDS) return 'skip';
  const saved = c.b.slice();
  await C23.RecalcAbility(c, 0); await C23.RecalcAbility(c, 4);
  assert.deepEqual(Array.from(c.b), Array.from(saved));
});

done('COMBAT');
