// game/areas/combat_ov23.js — COMBAT ov23 (5F00): active effects, effect hooks, saving throw, to-hit roll, damage,
// healing, revival, ability recalculation (Pool twin ov24 9800, structure only).
// Owner: cab-build-areas. Source: decode/pseudo/COMBAT.pas.md ov23 (5F00:0000..25B6). Re-read from decode/listings/ov23.lst:
//  - HpPerLevel (5f00:17b8, summarised in the pseudocode): Pascal order is (class [BP+0Ah], levels [BP+8]) — the callers
//    push the class first (5f00:1cdb / 1d36); levels >= LevelCap[class] become cap - 1; a ranger (class 4) gets +1 when
//    old_level_cap (+E6h) = 0 or old_level[4] (+115h) = +E6h; classes 2, 4, 3 add (con - 14) * levels for CON 15..19, *5 for
//    20, *6 for 21..23, *7 for 24..25; the others +2*levels above CON 15, +levels at 15. It adds to the parent's hit-point
//    accumulator [BP-0Ah], not to maxhp.
//  - RecalcAbility n = 4 (5f00:1c9e..1de7): the per-class hit points are summed in [BP-0Ah] (zeroed at 5f00:18de) and the
//    number of classes with a current level > 0 counted in [BP-13h]; maxhp := maxhp_base + sum div count (5f00:1d4c .. 1d64,
//    unsigned DIV: a character without any current level stops with runtime error 200). The pseudocode's statement list
//    omits the division. The current-class part runs HpPerLevel only when the capped level exceeds +E6h, with lv - +E6h.
//  - RecalcAbility items: hook kind = item +3Eh and 7Fh (tested > 80h), sub-kind item +3Dh, readied flag item +34h; the
//    effect-26h branch adds (new - 18) * 10 to the CURRENT str_exc (+1Ch); the no-fighter test reads levels +10Bh/+10Ch/+10Dh
//    and old levels +113h/+114h/+115h signed (JG).
// Effect handlers: G.EffectHandler[type] = async (c, e, mode), filled by PARTY ov12 InstallEffectHandlers (installed here
// on first use when the start-up has not done it); while G.item_HookMode <> 0 the call goes to G.item_HookProc.
// Records: c.b (1A6h), c.effects list { b: Uint8Array(9), next } (type +0, duration word +1, p3 +3, callOnRemove +4),
// c.combat = { b: Uint8Array(16h), target }, c.items { b: Uint8Array(3Fh), next }. Cloud nodes { owner, next, active[], x, y }.

import { G, newEffect, rdW, wrW } from '../engine/state.js';
import { MessageDelay, text } from '../engine/text.js';
import { FlushViewDirtyLines } from '../engine/pictures.js';
import { Random } from '../engine/tp.js';
import { view, DX, DY } from './view_ov30.js';
import { BuildTargetList } from './view_ov31.js';
import { CombatantIndex, CombatantCol, CombatantRow, CombatantSize, ProbeMove, FocusCombatant, RestoreTerrain,
  RebuildOccupancy, PlaceCombatant, RemoveCombatant } from './view_ov32.js';
import { InstallEffectHandlers } from './party_ov12.js';
import { X } from './view_link.js';

const sb = (v) => ((v & 0xFF) ^ 0x80) - 0x80;
const byte = (v) => v & 0xFF;
const ds = (a, dflt) => (G.ds ? G.ds[a & 0xFFFF] : dflt);
const COMBAT_EFFECTS = [0x07, 0x0B, 0x0D, 0x15, 0x17, 0x1E, 0x1F, 0x20, 0x33, 0x34, 0x35, 0x3A, 0x3B, 0x5F, 0x62, 0x88, 0x89, 0x8B, 0x90];   // g_0A30[1..19]
const MORALE_EFFECTS = [0x0D, 0x3A, 0x8B, 0x90];                         // g_0A44[1..4]
const CLOUD_DIRS = [8, 2, 3, 4];                                         // CloudSearchDirs g_27D8[1..4]
const LEVEL_CAP = [0x0A, 0x0F, 0x0A, 0x0A, 0x0B, 0x0C, 0x0B, 0x13];      // LevelCap g_3EB9[0..7]
const levelCap = (k) => ds(0x3EB9 + k, LEVEL_CAP[k]);
const cb = (c) => (c && c.combat ? c.combat.b : new Uint8Array(0x16));
const has = async (c, type, e = { v: null }) => !!(await X.HasEffect(c, type, e));

// 5F00:0016 KillCombatant(c, newStatus, msg)
export async function KillCombatant(c, newStatus, msg) {
  const s = String(msg).slice(0, 40);                                    // 5f00:001c
  await X.ShowCharacterMessage(c, s, 10, 0);                             // 5f00:002f
  if (![7, 6, 8].includes(c.b[0x195])) {                                // 5f00:0045 .. 0059
    c.b[0x195] = newStatus; c.b[0x196] = 0; c.b[0x1A4] = 0;              // 5f00:005b / 0066 / 006f
    await RemoveCombatEffects(c);                                        // 5f00:0078
    await CallEffectHooks(0x0D, c);                                      // 5f00:0082
    if (c.b[0x196] === 0) await RemoveCombatant(c);                      // 5f00:008f / 009a
    await MessageDelay(); await X.ClearCharacterMessage();               // 5f00:00a5 / 00aa
    if (G.view_Mode !== 5) await X.PartySummary(G.SelectedChar);         // 5f00:00af / 00b6
  }
}

// 5F00:00C9 CallEffectHandler(type, c, e, mode)
export async function CallEffectHandler(type, c, e, mode) {
  if (!G.item_HookMode) {                                                // 5f00:00cc
    if (!Array.isArray(G.EffectHandler)) InstallEffectHandlers();
    const h = G.EffectHandler[type];                                     // 5f00:00e9 CALLF [type*4 + 6FA6h]
    if (typeof h === 'function') await h(c, e, mode);                    // TODO(decode): a nil slot calls address 0 in the original
  } else if (typeof G.item_HookProc === 'function') await G.item_HookProc(c, e, mode);   // 5f00:00d3
}

// 5F00:010E RemoveEffect(c, type, e)
export async function RemoveEffect(c, type, e) {
  let p = e;                                                             // 5f00:0114
  if (!p) {                                                              // 5f00:011f
    p = c.effects;                                                       // 5f00:0127
    while (p && p.b[0] !== type) p = p.next;                             // 5f00:0137 .. 014d
  }
  if (!p) return;                                                        // 5f00:015b
  if (p.b[4] !== 0) await CallEffectHandler(type, c, p, 1);              // 5f00:0166 / 0170
  if (c.effects === p) c.effects = p.next;                               // 5f00:0187 / 019b
  else {
    let q = c.effects;                                                   // 5f00:01b3
    while (q && q.next !== p) q = q.next;                                // 5f00:01c3 .. 01e1
    if (q) q.next = p.next;                                              // 5f00:01ef
  }
  // 5f00:0203 FreeMem(p, 9)
  if (type === 0x0E) await RecalcAbility(c, 5);                          // 5f00:0211 / 0217
  if (type === 0x0C || type === 0x26 || type === 0x92) await RecalcAbility(c, 0);   // 5f00:0224 .. 0240
}

// 5F00:0269 RunEffectIfActive(c, type)
export async function RunEffectIfActive(c, type) {
  let found = false; let m = G.PartyList;                                // 5f00:026c / 0275
  const e = { v: null };
  if (await has(c, type, e)) found = true;                               // 5f00:0283 / 029c
  else if ([0x15, 0x2D, 0x2E, 0x31].includes(type)) {                    // 5f00:02a4 set CS:0249
    const saved = (G.tg_List || []).map((t) => (t ? { ...t } : t)), savedCount = G.tg_Count;   // 5f00:02b7 Move(tg_List, saved, $D8)
    while (m && !found) {                                                // 5f00:02cb
      if (await has(m, type, e)) {                                       // 5f00:02e2
        if (G.view_Mode === 5) {                                         // 5f00:0300
          const range = type === 0x31 ? 6 : 1;                           // 5f00:030a .. 0310
          BuildTargetList(CombatantCol(m), CombatantRow(m), range, 0xFF, CombatantSize(m), G.cm_Map);   // 5f00:031c .. 0358
          for (let i = 1; i <= G.tg_Count; i++) if (G.tg_List[i].who === CombatantIndex(c)) found = true;   // 5f00:035d .. 0389
        } else found = true;                                             // 5f00:03a9
      }
      m = m.next;                                                        // 5f00:03ae
    }
    G.tg_List = saved; G.tg_Count = savedCount;                          // 5f00:03c4 (the count byte DS:6E96 lies outside the copy; restored with it here)
  }
  if (found) await CallEffectHandler(type, c, e.v, 0);                   // 5f00:03d8 / 03df
}

// 5F00:03FE CallEffectHooks(event, c): the effect types run for each event, in the asm's order (5f00:0405 .. 0d04)
const HOOKS = {
  0x01: [0x25, 0x19, 0x47, 0x45],                                                                      // 5f00:0416
  0x02: [0x4F, 0x50, 0x91, 0x39, 0x60, 0x7A, 0x7B],                                                    // 5f00:0452
  0x03: [0x40, 0x41, 0x42, 0x43, 0x46, 0x4F, 0x57],                                                    // 5f00:04b5
  0x04: [0x1D, 0x06, 0x67, 0x4B, 0x4C, 0x86],                                                          // 5f00:0518
  0x05: [0x1C, 0x29, 0x68, 0x78, 0x65, 0x73, 0x74, 0x77, 0x5E, 0x75, 0x3C, 0x51, 0x52, 0x55, 0x82, 0x8F],   // 5f00:0571
  0x06: [0x71, 0x3D, 0x0A, 0x14, 0x69, 0x6A, 0x70, 0x72, 0x76, 0x11, 0x5D, 0x65, 0x1C, 0x6E, 0x49, 0x52, 0x54, 0x81, 0x85, 0x87, 0x3F],   // 5f00:064c
  0x07: [0x33, 0x34, 0x35, 0x1F, 0x03, 0x1B, 0x88],                                                    // 5f00:0765
  0x08: [0x63, 0x52, 0x59, 0x48, 0x38],                                                                // 5f00:07c8
  0x09: [0x69, 0x6A, 0x6B, 0x6C, 0x6D, 0x6E, 0x6F, 0x70, 0x7C, 0x7D, 0x3F, 0x81],                      // 5f00:0814
  0x0A: [0x01, 0x02, 0x21, 0x24, 0x31, 0x06, 0x12, 0x1A, 0x4B, 0x4C],                                  // 5f00:08bb
  0x0B: [0x21, 0x11, 0x08, 0x09, 0x2D, 0x2E, 0x1E, 0x07],                                              // 5f00:0945
  0x0C: [0x08, 0x09, 0x0A, 0x11, 0x14, 0x21, 0x24, 0x2D, 0x2E, 0x31, 0x3D, 0x6F, 0x7D, 0x61, 0x32, 0x36],   // 5f00:09b8
  0x0D: [0x63, 0x64, 0x4B],                                                                            // 5f00:0a90
  0x0E: [0x53, 0x58, 0x79, 0x56, 0x57, 0x5A, 0x7E, 0x80, 0x83, 0x84, 0x8B],                            // 5f00:0ac2
  0x0F: [0x15, 0x1E, 0x0B, 0x0D, 0x4D],                                                                // 5f00:0b59
  0x10: [0x19, 0x47, 0x25, 0x2F, 0x30, 0x59, 0x04],                                                    // 5f00:0ba2
  0x11: [0x01, 0x02, 0x0B],                                                                            // 5f00:0c05
  0x12: [0x27, 0x2A, 0x3A],                                                                            // 5f00:0c34
  0x13: [0x62, 0x17, 0x48, 0x38, 0x0B],                                                                // 5f00:0c63
  0x14: [0x32, 0x36],                                                                                  // 5f00:0cab new
  0x15: [0x23],                                                                                        // 5f00:0ccc new
  0x16: [0x8A],                                                                                        // 5f00:0ce0 new
  0x17: [0x4A],                                                                                        // 5f00:0cf4 new
};
export async function CallEffectHooks(event, c) {
  for (const t of HOOKS[event] || []) await RunEffectIfActive(c, t);     // event 0 and others: nothing
}

// 5F00:0D07 NearestCloudSource(dirs, n, list, y, x): owner of the first cloud with a cell on (x, y), else PartyHead
export function NearestCloudSource(dirs, n, list, y, x) {
  let p = list, found = false;                                           // 5f00:0d0d / 0d18
  while (p && !found) {                                                  // 5f00:0d1c
    for (let k = 1; k <= n; k++) {                                       // 5f00:0d40
      const d = dirs[k - 1];
      if ((p.active ? p.active[k] : 0) !== 0 && sb(p.x + DX[d]) === sb(x) && sb(p.y + DY[d]) === sb(y)) found = true;   // 5f00:0d48 .. 0db5
    }
    if (!found) p = p.next;                                              // 5f00:0dc3
  }
  return found ? p.owner : G.PartyList;                                  // 5f00:0dd5 .. 0deb
}

async function poisonAndKill(c) {                                        // 5f00:1097 .. 10eb (repeated for levels 5 / 6)
  await X.ShowCharacterMessage(c, 'is Poisoned', 10, 0);
  await MessageDelay();
  await AddEffect(c, 0x37, 0, 0xFF, 0);
  await KillCombatant(c, 6, 'is killed');
}

// 5F00:0E45 StinkingCloudCheck(c, poison)
// Fix #run1-1 (from decode/listings/ov23.lst; COMBAT.pas.md had `tile = 0` / `hit1E`): ProbeMove's results are pushed
// as occupant [BP-2], tile [BP-1], 1Eh-square flag [BP-0Ch], 1Ch-square flag [BP-0Dh] (5f00:0e59..0e76). The cough /
// nausea part runs only on a stinking-cloud square (1Eh, 5f00:0e7b) with `poison`; every way out of it, including the
// four effect tests and the saved branch, goes on to 5f00:1070, the poison kill on a cloudkill square (1Ch, [BP-0Dh]).
export async function StinkingCloudCheck(c, poison) {
  if (c.b[0x196] === 0) return;                                          // 5f00:0e4b
  const occ = { v: 0 }, tile = { v: 0 }, hit1E = { v: 0 }, hit1C = { v: 0 };
  ProbeMove(c, 8, occ, tile, hit1E, hit1C);                              // 5f00:0e76
  const nausea = async () => {
    if (hit1E.v === 0 || !poison) return;                                // 5f00:0e7b / 0e84 -> 1070
    if (await has(c, 0x1F) || await has(c, 0x20) || await has(c, 0x6F) || await has(c, 0x7D)) return;   // 5f00:0e8d .. 0ef2 -> 1070
    const saved = await SavingThrow(c, 0, 0);                            // 5f00:0ef5
    const e = { v: null };
    if (saved) {                                                         // 5f00:0f08
      const sel = G.SelectedChar;                                        // 5f00:0f11
      G.SelectedChar = NearestCloudSource(CLOUD_DIRS.map((d, i) => ds(0x27D8 + i, d)), 4, G.cloud_List, CombatantRow(c), CombatantCol(c));   // 5f00:0f46
      await ApplyEffect(c, 0x1E, 1, 0xFF, 0, 0, saved, 'starts to cough');   // 5f00:0f7a
      if (await has(c, 0x1E, e)) await CallEffectHandler(0x1E, c, e.v, 0);   // 5f00:0f85 / 0f9c
      G.SelectedChar = sel;                                              // 5f00:0fb2
      return;                                                            // 5f00:0fbe -> 1070
    }
    const sel = G.SelectedChar;                                          // 5f00:0fc1
    G.SelectedChar = NearestCloudSource(CLOUD_DIRS.map((d, i) => ds(0x27D8 + i, d)), 4, G.cloud_List, CombatantRow(c), CombatantCol(c));   // 5f00:0ff6
    await ApplyEffect(c, 0x1F, byte((await Roll(1, 4)) + 1), 0xFF, 0, 0, saved, 'chokes and gags from nausea');   // 5f00:1013
    if (await has(c, 0x1F, e)) await CallEffectHandler(0x1F, c, e.v, 0); // 5f00:1037 / 104e
    G.SelectedChar = sel;                                                // 5f00:1064
  };
  await nausea();
  if (hit1C.v && c.b[0x196] !== 0) {                                     // 5f00:1070 / 1079 cloudkill square: poison
    const lv = c.b[0xE5];                                                // 5f00:1087 (signed 0..4 / 5 / 6)
    if (lv <= 4) await poisonAndKill(c);
    else if (lv === 5) { if (!await SavingThrow(c, 0, -4)) await poisonAndKill(c); }   // 5f00:10f5 .. 115d bonus -4 (FCh)
    else if (lv === 6) { if (!await SavingThrow(c, 0, 0)) await poisonAndKill(c); }    // 5f00:1166 .. 11ce
  }
}

// 5F00:11D7 AttackRollVsAC(target, toHit)
export async function AttackRollVsAC(target, toHit) {
  G.AttackRollValue = await Roll(1, 20);                                 // 5f00:11e1
  if (G.AttackRollValue <= 1) return false;                              // 5f00:11ee
  if (G.AttackRollValue === 20) G.AttackRollValue = 100;                 // 5f00:11f5 / 11fc
  await CallEffectHooks(0x10, target);                                   // 5f00:1201
  return sb(G.AttackRollValue) >= 0 && sb(G.AttackRollValue) + toHit > target.b[0x19A];   // 5f00:120e .. 1232
}

// 5F00:123F AttackRoll(attacker, target, targetAC)
export async function AttackRoll(attacker, target, targetAC) {
  await ov23_1569(attacker);                                             // 5f00:1249
  G.AttackRollValue = await Roll(1, 20);                                 // 5f00:1253
  if (G.AttackRollValue <= 1) return false;                              // 5f00:1260
  if (G.AttackRollValue === 20) G.AttackRollValue = 100;                 // 5f00:1267 / 126e
  await CallEffectHooks(0x0A, attacker); await CallEffectHooks(0x10, target);   // 5f00:1273 / 1280
  const sideBonus = attacker.b[0x197] === 0 ? sb(view.mem(0x7F71)) : sb(view.mem(0x7F70));   // 5f00:128d .. 12aa
  return sb(G.AttackRollValue) >= 0 && sb(G.AttackRollValue) + attacker.b[0x199] + sideBonus >= targetAC;   // 5f00:12b2 .. 12dc
}

// 5F00:12EB SavingThrow(c, saveType, bonus)
export async function SavingThrow(c, saveType, bonus) {
  G.SaveResult = 1;                                                      // 5f00:12f1
  G.SaveRoll = await Roll(1, 20);                                        // 5f00:12f6
  if (G.SaveRoll === 1) G.SaveResult = 0;                                // 5f00:1303 / 130d
  else if (G.SaveRoll === 20) G.SaveResult = 1;                          // 5f00:1314 / 1319
  else {
    G.SaveRoll = byte(G.SaveRoll + sb(c.b[0x186]) + sb(bonus));          // 5f00:1320 .. 133a
    G.SaveType = saveType;                                               // 5f00:133d
    await CallEffectHooks(0x0C, c);                                      // 5f00:1343
    G.SaveResult = G.SaveRoll < c.b[0xDF + G.SaveType] ? 0 : 1;          // 5f00:1350 .. 136b
  }
  return G.SaveResult !== 0;                                             // 5f00:1370
}

// 5F00:137F Roll(count, sides)
export function Roll(count, sides) {
  let sum = 0;                                                           // 5f00:1385
  for (let i = 1; i <= (count & 0xFF); i++) sum = byte(sum + Random(sides & 0xFF) + 1);   // 5f00:1389 .. 13aa
  return sum;                                                            // 5f00:13bb
}

// 5F00:13CA RollDice(count, sides)
export function RollDice(count, sides) { G.LastDiceCount = count; return Roll(count, sides); }   // 5f00:13d3 / 13df

// 5F00:13EE AddEffect(c, type, duration, p3, callOnRemove)
export function AddEffect(c, type, duration, p3, callOnRemove) {
  const e = newEffect();                                                 // 5f00:13f4
  if (!c.effects) c.effects = e;                                         // 5f00:1402 / 1411
  else { let q = c.effects; while (q.next) q = q.next; q.next = e; }     // 5f00:1425 .. 1453
  e.next = null; e.b[0] = type; wrW(e.b, 1, duration); e.b[4] = callOnRemove; e.b[3] = p3;   // 5f00:1463 .. 1493
}

// 5F00:149D RemoveFromCombat(c, newStatus, msg)
export async function RemoveFromCombat(c, newStatus, msg) {
  const s = String(msg);                                                 // 5f00:14a3
  if (c.b[0x196] === 0) return;                                          // 5f00:14b6
  const i = CombatantIndex(c);                                           // 5f00:14c4
  FocusCombatant(c, 3, false);                                           // 5f00:14d2
  await X.ShowCharacterMessage(c, s, 10, 1);                             // 5f00:14e3
  c.b[0x196] = 0; c.b[0x195] = newStatus;                                // 5f00:14f9 / 1502
  if (c.b[0x195] !== 3) c.b[0x1A4] = 0;                                  // 5f00:150d / 1518
  RestoreTerrain(0, 0, i);                                               // 5f00:1521
  FlushViewDirtyLines();                                                 // 5f00:1530
  G.cb_Size[i] = 0;                                                      // 5f00:1535
  RebuildOccupancy();                                                    // 5f00:1545
  if (await X.ClearCombatantActionFlags(c)) await RemoveCombatEffects(c);   // 5f00:154a / 1559
}

// 5F00:1569 ov23_1569(c): remove every effect 19h
export async function ov23_1569(c) {
  const e = { v: null };
  while (await has(c, 0x19, e)) await RemoveEffect(c, 0x19, e.v);        // 5f00:157d / 1596
}

// 5F00:15A1 RemoveCombatEffects(c)
export async function RemoveCombatEffects(c) {
  for (let k = 1; k <= 19; k++) await RemoveEffect(c, ds(0x0A2F + k, COMBAT_EFFECTS[k - 1]), null);   // 5f00:15a7 .. 15c9
  if (await has(c, 0x4D) && c.b[0xF7] === 0xB3) c.b[0x197] = 0;          // 5f00:15d2 / 15e9 / 15f4 new
}

// 5F00:1603 ov23_1603(c): remove the morale effects
export async function ov23_1603(c) {
  for (let k = 1; k <= 4; k++) await RemoveEffect(c, ds(0x0A43 + k, MORALE_EFFECTS[k - 1]), null);   // 5f00:1609 .. 162b
}

// 5F00:1643 CureEffect(c, type)
export async function CureEffect(c, type) {
  const e = { v: null };
  if (!await has(c, type, e)) return false;                              // 5f00:164d
  await X.ShowCharacterMessage(c, 'is Cured', 10, 1);                    // 5f00:167a
  await RemoveEffect(c, type, e.v);                                      // 5f00:1685
  return true;                                                           // 5f00:1699
}

// 5F00:16A6 StrengthCode(str, strExc)
export function StrengthCode(str, strExc) { return str === 18 ? byte(strExc + 1) : byte(str + 100); }   // 5f00:16ac / 16b7

// 5F00:16CF DecodeStrength(e, var str, var strExc)
export function DecodeStrength(e, str, strExc) {
  strExc.v = 0; str.v = e.b[3] & 0x7F;                                   // 5f00:16d2 / 16d9
  if (str.v <= 0x65) { strExc.v = byte(str.v - 1); str.v = 18; } else str.v = byte(str.v - 100);   // 5f00:16e8 .. 170c
}

// 5F00:1720 StrengthFromItem(c, str, strExc, var code)
export function StrengthFromItem(c, str, strExc, code) {
  if (c.b[0x10] < str || (str === 18 && c.b[0x1D] < strExc)) { code.v = StrengthCode(str, strExc); return true; }   // 5f00:1726 .. 1751
  return false;                                                          // 5f00:175c
}

// 5F00:1769 RaiseStrength (nested in RecalcAbility; s = the parent's cur / new / curExc / newExc)
export function RaiseStrength(s) {
  if (s.cur < s.nw || (s.nw === 18 && s.curExc < s.newExc)) { s.cur = s.nw; s.curExc = s.newExc; }   // 5f00:176c .. 17a7
}

// 5F00:17B8 HpPerLevel(class, levels) (nested in RecalcAbility; s = the parent's c / hp accumulator / con)
export function HpPerLevel(s, cls, levels) {
  const c = s.c, cap = levelCap(cls);
  if (cap <= levels) levels = byte(cap - 1);                             // 5f00:17bb .. 17d7
  if (cls === 4 && (c.b[0xE6] === 0 || c.b[0x115] === c.b[0xE6])) levels = byte(levels + 1);   // 5f00:17da .. 1809
  const con = s.con;
  if (cls === 2 || cls === 4 || cls === 3) {                             // 5f00:180c .. 181c
    if (con >= 15 && con <= 19) s.hp = byte(s.hp + (con - 14) * levels); // 5f00:1821 .. 184c
    else if (con === 20) s.hp = byte(s.hp + levels * 5);                 // 5f00:1852 .. 1864
    else if (con >= 21 && con <= 23) s.hp = byte(s.hp + levels * 6);     // 5f00:186a .. 1881
    else if (con >= 24 && con <= 25) s.hp = byte(s.hp + levels * 7);     // 5f00:1887 .. 189e
  } else if (con > 15) s.hp = byte(s.hp + levels * 2);                   // 5f00:18a4 .. 18b8
  else if (con === 15) s.hp = byte(s.hp + levels);                       // 5f00:18be .. 18ce
}

// 5F00:18D8 RecalcAbility(c, n): ability n (0 STR .. 5 CHA) from the base value, readied items and effects
export async function RecalcAbility(c, n) {
  const s = { c, hp: 0, nw: 0, newExc: 0, cur: c.b[0x10 + 2 * n], curExc: c.b[0x1D], con: 0 };   // 5f00:18de .. 1913
  let fixed = 0xFF;                                                      // 5f00:18ea
  const e = { v: null };
  for (let it = c.items; it; it = it.next) {                             // 5f00:18ee / 191a
    if (it.b[0x3E] > 0x80 && it.b[0x34] !== 0) {                         // 5f00:1925 / 1932
      const kind = it.b[0x3E] & 0x7F, sub = it.b[0x3D];                  // 5f00:193f
      switch (n) {
        case 0:                                                          // 5f00:194b
          if (kind === 5) {                                              // 5f00:1955
            switch (sub) { case 0: s.nw = 18; s.newExc = 100; break; case 1: s.nw = 19; break; case 2: s.nw = 20; break;
              case 3: s.nw = 21; break; case 4: s.nw = 22; break; case 5: s.nw = 23; break; case 6: s.nw = 24; break; }   // 5f00:196d .. 19b3
          } else if (kind === 8) {                                       // 5f00:19b9
            if (c.b[0x10] < 18 && sub === 0) { s.nw = byte(c.b[0x10] + 1); s.newExc = 0; }   // 5f00:19be .. 19df
          } else if (kind === 0x0D) fixed = 3;                           // 5f00:19e5 / 19ea
          RaiseStrength(s);                                              // 5f00:19f0
          break;
        case 4:                                                          // 5f00:19f6
          if (kind === 6) s.cur = byte(s.cur + 1);                       // 5f00:1a00
          else if (kind === 8 && c.b[0x18] < 18 && sub === 4) s.cur = byte(s.cur + 1);   // 5f00:1a05 .. 1a1f
          break;
        case 1:                                                          // 5f00:1a25
          if (kind === 8) { if (c.b[0x12] < 18 && sub === 1) s.cur = byte(s.cur + 1); }   // 5f00:1a2e .. 1a47
          else if (kind === 0x0C) fixed = 7;                             // 5f00:1a51
          else if (kind === 0x0D) fixed = 3;                             // 5f00:1a5c
          break;
        case 2:                                                          // 5f00:1a63
          if (kind === 8 && sub === 2 && c.b[0x14] < 18) s.cur = byte(s.cur + 1);   // 5f00:1a67 .. 1a81
          break;
        case 3: {                                                        // 5f00:1a87
          const d = sb(c.b[0x16]);
          if (kind === 2) {                                              // 5f00:1a90
            if (d >= 0 && d <= 6) s.cur = byte(s.cur + 4);               // 5f00:1aa8
            else if (d >= 7 && d <= 13) s.cur = byte(s.cur + 2);         // 5f00:1ab8
            else s.cur = byte(s.cur + 1);                                // 5f00:1abe
          } else if (kind === 8) { if (c.b[0x16] < 18 && sub === 3) s.cur = byte(s.cur + 1); }   // 5f00:1ac3 .. 1adc
          else if (kind === 0x0A) s.cur = byte(s.cur - 2);               // 5f00:1ae6
          break;
        }
        case 5:                                                          // 5f00:1aec
          if (kind === 6) s.cur = byte(s.cur - 1);                       // 5f00:1afa
          else if (kind === 8 && c.b[0x1A] < 18 && sub === 5) s.cur = byte(s.cur + 1);   // 5f00:1aff .. 1b18
          break;
      }
    }
  }
  const nw = { v: 0 }, nx = { v: 0 };
  switch (n) {
    case 0:                                                              // 5f00:1b2d
      if (await has(c, 0x26, e)) {                                       // 5f00:1b45
        DecodeStrength(e.v, nw, nx); s.nw = nw.v; s.newExc = nx.v;       // 5f00:1b62
        if (s.cur <= 18 && s.curExc < 100) {                             // 5f00:1b65 / 1b6e
          s.nw = byte(s.cur + s.nw);                                     // 5f00:1b77 .. 1b85
          if (s.nw > 18) {                                               // 5f00:1b88
            const none = [0x10B, 0x113, 0x10C, 0x114, 0x10D, 0x115].every((o) => sb(c.b[o]) <= 0);   // 5f00:1b8e .. 1bce
            if (none) s.nw = 18;                                         // 5f00:1bfd
            else {
              s.newExc = byte((s.nw - 18) * 10 + c.b[0x1C]);             // 5f00:1bd0 .. 1bea
              if (s.newExc > 100) s.newExc = 100;                        // 5f00:1bed / 1bf3
              s.nw = 18;                                                 // 5f00:1bf7
            }
          }
        }
        RaiseStrength(s);                                                // 5f00:1c03
      }
      if (await has(c, 0x92, e)) { DecodeStrength(e.v, nw, nx); s.nw = nw.v; s.newExc = nx.v; RaiseStrength(s); }   // 5f00:1c14 .. 1c33
      if (await has(c, 0x0C, e)) { DecodeStrength(e.v, nw, nx); s.nw = nw.v; s.newExc = nx.v; RaiseStrength(s); }   // 5f00:1c44 .. 1c63
      if (fixed !== 0xFF) { c.b[0x11] = fixed; c.b[0x1C] = 0; }          // 5f00:1c66 .. 1c79
      else { c.b[0x11] = s.cur; c.b[0x1C] = s.curExc; }                  // 5f00:1c80 .. 1c90
      break;
    case 4: {                                                            // 5f00:1c97
      let count = 0;                                                     // 5f00:1c9e
      const oldMax = c.b[0x78];                                          // 5f00:1ca2
      c.b[0x78] = c.b[0x12C];                                            // 5f00:1cac
      s.con = s.cur;                                                     // HpPerLevel reads the parent's cur ([BP-1])
      for (let k = 0; k <= 7; k++) {                                     // 5f00:1cbb
        let lv = c.b[0x111 + k];                                         // 5f00:1ccd
        if (lv !== 0) HpPerLevel(s, k, lv);                              // 5f00:1cd5 / 1ce5
        lv = c.b[0x109 + k];                                             // 5f00:1cf1
        if (lv !== 0) count++;                                           // 5f00:1cf9 / 1cff
        if (levelCap(k) < lv) lv = levelCap(k);                          // 5f00:1d08 .. 1d1b
        if (lv > c.b[0xE6]) HpPerLevel(s, k, byte(lv - c.b[0xE6]));      // 5f00:1d24 .. 1d40
      }
      if (count === 0) throw new Error('Runtime error 200 (division by zero) at 5F00:1D59');   // 5f00:1d59 DIV CX
      s.hp = Math.trunc(s.hp / count) & 0xFF;                            // 5f00:1d4c .. 1d5b
      c.b[0x78] = byte(c.b[0x78] + s.hp);                                // 5f00:1d64
      if (c.b[0x78] > oldMax) c.b[0x1A4] = byte(c.b[0x1A4] + (c.b[0x78] - oldMax));   // 5f00:1d68 .. 1d89
      if (c.b[0x78] < oldMax) {                                          // 5f00:1d8e .. 1d98
        if (c.b[0x1A4] > oldMax - c.b[0x78]) c.b[0x1A4] = byte(c.b[0x1A4] - (oldMax - c.b[0x78]));   // 5f00:1db8 / 1dd1
        else c.b[0x1A4] = 0;                                             // 5f00:1dd8
      }
      c.b[0x19] = s.cur;                                                 // 5f00:1de7
      if (c.b[0x19] < 20) await RemoveEffect(c, 0x3E, null);             // 5f00:1dee / 1e35
      else if (!await has(c, 0x3E, e)) AddEffect(c, 0x3E, 0x3C, 0xFF, 1);   // 5f00:1e03 / 1e20
      break;
    }
    case 1:                                                              // 5f00:1e3b
      if (await has(c, 0x44, e) && fixed > 7) fixed = 3;                 // 5f00:1e4d .. 1e5c
      c.b[0x13] = fixed !== 0xFF ? fixed : s.cur;                        // 5f00:1e60 .. 1e78
      break;
    case 2:                                                              // 5f00:1e7f
      if (await has(c, 0x44, e) && fixed > 7) fixed = 3;                 // 5f00:1e91 .. 1ea0
      c.b[0x15] = fixed !== 0xFF ? fixed : s.cur;                        // 5f00:1ea4 .. 1ebc
      break;
    case 3: c.b[0x17] = fixed !== 0xFF ? fixed : s.cur; break;           // 5f00:1ec2 .. 1ede
    case 5:                                                              // 5f00:1ee4
      if (await has(c, 0x0E, e)) s.cur = byte(s.cur + e.v.b[3]);         // 5f00:1ef6 .. 1f06
      c.b[0x1B] = s.cur;                                                 // 5f00:1f0f
      break;
  }
}

// 5F00:1FD6 DamageCharacter(c, dmg, saveEffect, saved)
export async function DamageCharacter(c, dmg, saveEffect, saved) {
  G.DamageAmount = byte(dmg);                                            // 5f00:1fdd
  await CallEffectHooks(0x06, c);                                        // 5f00:1fe3
  if (!saved) await CallEffectHooks(0x14, c);                            // 5f00:1ff0 / 2018 new
  else if (saveEffect === 1) G.DamageAmount = 0;                         // 5f00:1ff6 .. 2013
  else if (saveEffect === 2) G.DamageAmount = G.DamageAmount >> 1;
  if (G.DamageAmount === 0) return;                                      // 5f00:2025
  let s = G.DamageAmount === 1 ? 'takes 1 point of damage '             // 5f00:202f / 2075
    : 'takes ' + (await X.ByteToStr(G.DamageAmount)) + ' points of damage ';   // 5f00:2036 .. 206e
  switch (G.DamageType & 0xF7) {                                         // 5f00:2089 .. 211d
    case 1: s += 'from Fire'; break;
    case 2: s += 'from Cold'; break;
    case 4: s += 'from Electricity'; break;
    case 0x10: s += 'from Acid'; break;
  }
  if ((G.DamageType & 8) === G.DamageType) s += 'from Magic';            // 5f00:2153 .. 2183 (true for 8 and 0)
  await X.ShowCombatMessageAnimation(c, 0, s);                           // 5f00:2188
  await X.ApplyDamage(c, G.DamageAmount);                                // 5f00:219c
  if (G.view_Mode === 5) {                                               // 5f00:21ab
    const r = cb(c);
    r[1] = 0;                                                            // 5f00:21b2
    if (r[0] !== 0) {                                                    // 5f00:21bf
      await X.ShowCharacterMessage(c, 'lost a spell', 12, 1);            // 5f00:21e3
      await X.ForgetMemorizedSpell(c, r[0]);                             // 5f00:21ee
      r[0] = 0;                                                          // 5f00:2205
    }
  }
  if (c.b[0x196] === 0) {                                                // 5f00:2211
    let m = 'Goes Down';                                                 // 5f00:221f
    if (c.b[0x195] === 5) m += ', and is Dying';                         // 5f00:2233 .. 2263
    if ([6, 7, 8].includes(c.b[0x195])) m = 'is killed';                 // 5f00:2268 / 227d set CS:1FAC
    await X.ShowCharacterMessage(c, m, byte(text.row + 1), 0);           // 5f00:2291
    if (G.view_Mode === 5) {                                             // 5f00:22ac
      await RemoveCombatEffects(c); await CallEffectHooks(0x0D, c);      // 5f00:22ba / 22c4
      if (c.b[0x196] === 0) await RemoveCombatant(c); else await MessageDelay();   // 5f00:22d1 / 22dc / 22e9
    } else await MessageDelay();                                         // 5f00:22b3
  }
  await X.ClearCharacterMessage();                                       // 5f00:22ee
}

// 5F00:2307 ApplyEffect(c, type, duration, p3, callOnRemove, negateOnSave, saved, msg)
export async function ApplyEffect(c, type, duration, p3, callOnRemove, negateOnSave, saved, msg) {
  const s = String(msg);                                                 // 5f00:230d
  G.EffectToApply = type;                                                // 5f00:2320
  await CallEffectHooks(0x09, c);                                        // 5f00:2326
  if (G.EffectToApply === 0 || (saved && negateOnSave === 1)) await X.ShowCharacterMessage(c, 'is Unaffected', 10, 1);   // 5f00:2333 .. 2361
  else {
    const e = { v: null };
    if (await has(c, type, e) && rdW(e.v.b, 1) !== 0) await RemoveEffect(c, type, e.v);   // 5f00:2368 / 2380 / 238a
    AddEffect(c, type, duration, p3, callOnRemove);                      // 5f00:239e
    if (s !== '') { await X.ShowCombatMessageAnimation(c, 1, s); await X.ClearCharacterMessage(); }   // 5f00:23b7 / 23bd / 23d0
  }
}

// 5F00:23FB HealCharacter(c, amount, onlyIfHurt)
export async function HealCharacter(c, amount, onlyIfHurt) {
  if ([0, 1, 4, 5].includes(c.b[0x195]) && ((c.b[0x1A4] < c.b[0x78] && onlyIfHurt) || !onlyIfHurt)) {   // 5f00:2405 .. 2442 set CS:23DB
    c.b[0x1A4] = byte(c.b[0x1A4] + amount);                              // 5f00:243d
    if (c.b[0x1A4] > c.b[0x78]) c.b[0x1A4] = c.b[0x78];                  // 5f00:2458 / 2469
    if (c.b[0x196] === 0) {                                              // 5f00:2478
      if (c.b[0x195] === 5) c.b[0x195] = 4;                              // 5f00:2483 / 248e
      if (c.b[0x195] === 4 && G.view_Mode !== 5) await CallEffectHandler(0x4E, c, null, 1);   // 5f00:2497 .. 24a9
    }
    return true;                                                         // 5f00:24bf
  }
  return false;                                                          // 5f00:2401
}

// 5F00:24ED ReviveCombatant(c, hp)
export async function ReviveCombatant(c, hp) {
  if (!PlaceCombatant(c, CombatantCol(c), CombatantRow(c), true)) return false;   // 5f00:24f3 .. 2519
  c.b[0x195] = 0; c.b[0x196] = 1; c.b[0x1A4] = byte(hp);                 // 5f00:2520 / 2529 / 2532
  if (G.view_Mode === 5) FocusCombatant(c, 3, false);                    // 5f00:253d / 2544
  const s = c.b[0x197] === 1 ? 'stands up and grins' : 'gets back up';   // 5f00:2555 .. 2575
  await X.ShowCharacterMessage(c, s, 10, 1);                             // 5f00:2588
  await X.CountActiveSides();                                            // 5f00:259e
  return true;                                                           // 5f00:25a3
}

// 5F00:0000 ov23_LoadDeps / 5F00:25B6 ov23_init: empty.
