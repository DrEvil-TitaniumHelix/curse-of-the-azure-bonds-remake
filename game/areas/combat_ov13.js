// game/areas/combat_ov13.js — COMBAT ov13 (3A00): round start, the attack engine and its messages, facing, free attacks,
// fighter sweeps, step movement, Flee, Turn Undead, the "Aim:" target UI with the manual cursor, AI target choice, spell
// target collection, "Attack Ally:", Begin casting, the monster special attacks (engulf, hug, eye rays) and the cheat.
// Owner: cab-build-areas. Source: decode/pseudo/COMBAT.pas.md ov13 (verified, COMBAT_VERIFY.md #verify-1..31 applied);
// Pool twin ov13 6100 (structure only). Re-read from decode/listings/ov13.lst (code follows the bytes):
//  - TurnUndead (3a00:1267) marks the caster's combat record +11h (the "Turn" menu test of ov08) while a turned undead
//    gets +10h (3a00:136b) and FindTurnTarget tests +10h (3a00:149a); the pseudocode calls both "turned".
//  - Attack (3a00:1be0): the "keep the missile as treasure" test reads item +3Eh (power[3]) <> 89h.
//  - SelectTarget (3a00:3c66 .. 3dd9): plain keys N / P / M H K G O Q I / T / C, the extended branch takes the cursor
//    letters of set CS:3B17; `move` (the NextTarget step) is an uninitialised local before the first key (0 here).
//  - StepCombatant (3a00:07b5 .. 084c): cost = CombatTerrain[tile].cost * 3 (odd dir, IMUL) or * 2 (SHL), as a byte.
// Data (conventions of this lane): character c = { b: Uint8Array(1A6h), next, items, effects, combat: { b, target },
// readied[0..12] }; item +2Eh type, +34h readied, +39h count, +3Eh power[3]; ITEMS type table DS:5CF6 (16 bytes:
// +2 dice_L, +3 sides_L, +4 bonus_L, +5 rof, +0Bh dmg_bonus, +0Ch range); spell table DS:37DA (16 bytes: +6 target,
// +0Ah effect, +0Bh combat, +0Ch castTime, +0Eh needsTarget); combatant arrays and cm_Map as in view_ov32.js; target
// records TTargetRec = { char, x, y } (7 bytes in the original); G.foe_List[1..n] (combatant indexes), G.SpellTargets[1..n]
// (character refs), G.tg_List[1..tg_Count] = { who, dist, dir }. Effect records e.b: +0 type, +1 duration, +3 p3,
// +4 callOnRemove. Character offsets: +11Ch attacks, +11Dh attacks2, +19Ah ac, +19Bh ac_rear, +19Ch/+19Dh attacks_left,
// +19Eh/+19Fh dmg_dice, +1A0h/+1A1h dmg_sides, +1A2h/+1A3h dmg_bonus, +DDh fighter_lvl_eff, +DEh size, +E5h level,
// +E9h undead type, +109h levels, +111h former levels, +F7h npc_morale, +195h status, +196h active, +197h side,
// +198h controlled, +1A4h hp, +1A5h move, +78h maxhp.

import { G, pstr, newItem } from '../engine/state.js';
import { DrawText, DrawWrappedText, MessageDelay, ClearMenuLine, ClearRectangle, text } from '../engine/text.js';
import { PlayOrStopSound } from '../engine/audio_cab.js';
import { FlushGameKeys } from '../engine/input.js';
import { Delay } from '../engine/timer.js';
import { ParamStr } from '../engine/tp.js';
import { hooks } from '../plus/hooks.js';   // GBP W1 (docs/PLUS_HOOKS.md)
import { view, DX, DY, sx8 } from './view_ov30.js';
import { HorizontalMenu, AskYesNo } from './view_ov26.js';
import { InFrontArc, TraceLine, BuildTargetList } from './view_ov31.js';
import { CombatantIndex, CombatantCol, CombatantRow, CombatantSize, InWindow, FocusSquare, FocusCombatant, RestoreTerrain,
  RebuildOccupancy, RedrawSquare, ShowCombatant, IsVisible, CellAt, RemoveCombatant } from './view_ov32.js';
import { X } from './view_link.js';

const CB = (c) => c.combat.b;
const sb = (v) => ((v & 0xFF) ^ 0x80) - 0x80;
const byte = (v) => v & 0xFF;
const ds = (a) => (G.ds ? G.ds[a & 0xFFFF] : 0);
const dsW = (a) => (G.ds ? G.ds[a] | (G.ds[a + 1] << 8) : 0);
const snd = (a) => dsW(a);                                               // sound ids: words g_25B8 / 25BA / 25BE / 25C0 / 25C4
const ITT = (t, o) => ds(0x5CF6 + (t & 0xFF) * 16 + o);                  // ItemTypeTable[t]
const SPT = (sp, o) => ds(0x37DA + (sp & 0xFF) * 16 + o);                // spells_Table[sp]
const itype = (it) => it.b[0x2E];
const name = (c) => pstr(c.b, 0);
const terrCost = (t) => ds(0x26A2 + t * 4);                              // CombatTerrain[t].cost
const map = () => G.cm_Map.b;
const AL = (c, k) => c.b[0x19B + k];                                     // attacks_left[k] (k = 1, 2)
const setAL = (c, k, v) => { c.b[0x19B + k] = byte(v); };
const slotHits = () => { if (!Array.isArray(G.SlotHits)) G.SlotHits = [0, 0, 0]; return G.SlotHits; };      // g_6FA0 (6F9F+k)
const slotSwings = () => { if (!Array.isArray(G.SlotSwings)) G.SlotSwings = [0, 0, 0]; return G.SlotSwings; };   // g_75D7 (75D6+k)
const foes = () => { if (!Array.isArray(G.foe_List)) G.foe_List = []; return G.foe_List; };
const targets = () => { if (!Array.isArray(G.SpellTargets)) G.SpellTargets = []; return G.SpellTargets; };
const clearTgt = (t) => { t.char = null; t.x = 0; t.y = 0; };            // FillChar(tgt, 7, 0)
export const newTargetRec = () => ({ char: null, x: 0, y: 0 });

// 3A00:0000 StartCombatRound(c)
export async function StartCombatRound(c) {
  const cb = CB(c);
  cb[0] = 0; cb[1] = 1; cb[2] = 1; cb[8] = 0; cb[4] = 2;                 // 3a00:0006 .. 0036
  await CalcAttacks(c);                                                  // 3a00:003b
  G.StatValue = c.b[0x11D];                                              // 3a00:0045
  G.StatKind = 0;                                                        // 3a00:0050
  await X.CallEffectHooks(0x12, c);                                      // 3a00:0055
  setAL(c, 2, HalfRound(G.StatValue));                                   // 3a00:0063 / 0068
  cb[5] = c.b[0xDD];                                                     // 3a00:0073 / 007e
  if (c.b[0x196] !== 0) {                                                // 3a00:0082
    let ini = sb((await X.DexMissileAdj(c)) + (await X.Roll(1, 6)));     // 3a00:008d / 00a0 ShortInt
    if (ini < 1) ini = 1;                                                // 3a00:00b1
    if (((c.b[0x197] + 1) & (view.mem(0x7ECB) & 0xFF)) !== 0) ini = sb(ini - 6);   // 3a00:00c3 surprise bits
    if (ini < 0 || ini > 20) ini = 0;                                    // 3a00:00e2
    cb[3] = byte(ini);
  } else cb[3] = 0;                                                      // 3a00:00fe
  cb[6] = await CalcMove(c);                                             // 3a00:0108
}

// 3A00:0124 CalcMove(c): Byte
export async function CalcMove(c) {
  let m = c.b[0x1A5];                                                    // 3a00:012a
  if (c.b[0x197] === 0) m = byte(m + (view.mem(0x7F72) & 0xFF));         // 3a00:0135 / 0140
  G.StatKind = 1;                                                        // 3a00:0151
  if (m === 0 || m > 0x60) m = 1;                                        // 3a00:0156
  G.StatValue = byte(m * 2);                                             // 3a00:0162
  await X.CallEffectHooks(0x12, c);                                      // 3a00:0170
  G.StatKind = 0;                                                        // 3a00:017e
  return byte(G.StatValue);                                              // 3a00:0183
}

// 3A00:0192 RollDamage(att, tgt, k)
export async function RollDamage(att, tgt, k) {
  G.DamageAmount = byte((await X.RollDice(att.b[0x19D + k], att.b[0x19F + k])) + sb(att.b[0x1A1 + k]));   // 3a00:0195 / 01ba 8-bit add
  // 3a00:01d3 "if DamageAmount < 0" is an unsigned compare: never true (quirk kept)
  if (await CanBackstab(att, tgt)) {                                     // 3a00:01df
    const lv = att.b[0x10F] + att.b[0x117] * ((await X.DualClassActive(att)) ? 1 : 0);
    G.DamageAmount = byte(G.DamageAmount * (Math.trunc((lv - 1) / 4) + 2));   // 3a00:01f3 .. 022c
  }
  G.DamageType = 0;                                                      // 3a00:022f
  await X.CallEffectHooks(4, att);                                       // 3a00:0234
  await X.CallEffectHooks(5, tgt);                                       // 3a00:0242
}

// 3A00:031D ShowAttackResult(att, tgt, kind, dmgApplied, dmgShown, hit)
export async function ShowAttackResult(att, tgt, kind, dmgApplied, dmgShown, hit) {
  let s = kind === 2 ? '-Backstabs-' : kind === 3 ? 'slays helpless' : 'Attacks';   // 3a00:032e / 0348 / 035d
  await X.ShowCharacterMessage(att, s, 10, 0);                           // 3a00:0370
  let row = 0x0C;                                                        // 3a00:0386
  await X.DrawCharacterName(tgt, 0x17, row, 0);                          // 3a00:038a
  row++;                                                                 // 3a00:039f
  s = kind === 1 ? '(from behind) ' : '';                                // 3a00:03a2 .. 03c1
  if (hit !== 0) {                                                       // 3a00:03c7
    if (kind === 3) s = 'with one cruel blow';                           // 3a00:03ca / 03d0
    else {
      s = s + 'Hitting for ' + (await X.ByteToStr(dmgShown));            // 3a00:03e6 .. 041d
      s += dmgShown === 1 ? ' point ' : ' points ';                      // 3a00:0422 .. 0452
      s += 'of damage';                                                  // 3a00:047a
    }
    await X.ApplyDamage(tgt, byte(dmgApplied));                          // 3a00:04a2
  } else s += 'and Misses';                                              // 3a00:04b3
  if (tgt.b[0x195] !== 8) await DrawWrappedText(0x17, row, 0x26, row + 3, 10, 0, 1, s);   // 3a00:04db / 04e6 new guard
  row = text.row + 1;                                                    // 3a00:050c
  if (dmgApplied !== 0) {                                                // 3a00:0515
    CB(tgt)[1] = 0;                                                      // 3a00:051b
    if (CB(tgt)[0] !== 0) {                                              // 3a00:0528
      await MessageDelay();                                              // 3a00:0536
      await X.ShowCharacterMessage(tgt, 'lost a spell', 0x0C, 1);        // 3a00:0550
      await X.ForgetMemorizedSpell(tgt, CB(tgt)[0]);                     // 3a00:055b (the target, not SelectedChar)
      CB(tgt)[0] = 0;                                                    // 3a00:0572
    } else await MessageDelay();                                         // 3a00:0580
  } else await MessageDelay();                                           // 3a00:0587
  if (tgt.b[0x196] === 0) {                                              // 3a00:058c
    await X.ShowCharacterMessage(tgt, 'goes down', row, 0);              // 3a00:05af
    row += 2;                                                            // 3a00:05bb
    if (tgt.b[0x195] === 5) DrawText(0x17, row, 10, 0, 'and is Dying'); // 3a00:05bf / 05e6
    if ([6, 7, 8].includes(tgt.b[0x195])) await X.ShowCharacterMessage(tgt, 'is killed', row, 0);   // 3a00:05eb / 0615
    row += 2;                                                            // 3a00:0621
    await X.RemoveCombatEffects(tgt);                                    // 3a00:0625
    await X.CallEffectHooks(0x0D, tgt);                                  // 3a00:0630
    if (tgt.b[0x196] === 0) await RemoveCombatant(tgt); else await MessageDelay();   // 3a00:063e .. 0656
  }
  await X.ClearCharacterMessage();                                       // 3a00:065b
}

// 3A00:0666 FreeAttacksOnMover(c)
export async function FreeAttacksOnMover(c) {
  const n = await X.CollectOppositeSideTargets(c, 1);                    // 3a00:066c adjacent enemies
  const L = foes().slice();
  for (let i = 1; i <= n; i++) {                                         // 3a00:0683
    if (c.b[0x196] === 0) continue;                                      // 3a00:0695
    const e = G.cb_Char[L[i]];                                           // 3a00:06a3
    if (CB(e)[7] !== 0 && !(await X.IsHelpless(e))) {                    // 3a00:06c2 / 06d1
      FocusSquare(CombatantCol(c), CombatantRow(c), 2, 8);               // 3a00:06e0 .. 06fe
      CB(e)[7] = 0;                                                      // 3a00:0703
      await FaceAttacker(e, c);                                          // 3a00:0710
      await Attack(e, c, 0, null, { v: 0 });                             // 3a00:0720
    }
  }
}

// 3A00:074F StepCombatant(c, dir)
export async function StepCombatant(c, dir) {
  const cb = CB(c);
  const idx = CombatantIndex(c);                                         // 3a00:0755
  const ox = sx8(G.cb_Col[idx]), oy = sx8(G.cb_Row[idx]);                // 3a00:0763 / 0775
  const nx = sx8(ox + DX[dir]), ny = sx8(oy + DY[dir]);                  // 3a00:0787 / 079e
  const t = map()[7 + ny * 50 + nx];
  const cost = (dir & 1) ? byte(terrCost(t) * 3) : byte(terrCost(t) * 2);   // 3a00:07b5 .. 081a
  if (cb[6] < cost) cb[6] = 0; else cb[6] = byte(cb[6] - cost);          // 3a00:081d .. 0848
  let mode = 1;                                                          // 3a00:084c
  if (c.b[0x198] !== 0) {                                                // 3a00:0853
    mode = 3;                                                            // 3a00:085b
    if (!InWindow(nx - sx8(map()[2]), ny - sx8(map()[3])) && G.combat_Visible) FocusSquare(ox, oy, 2, 8);   // 3a00:0883 .. 08a1
  }
  if (G.combat_Visible) RestoreTerrain(0, 0, idx);                       // 3a00:08a6 / 08b7
  G.cb_Col[idx] = byte(nx); G.cb_Row[idx] = byte(ny);                    // 3a00:08bc / 08ce
  RebuildOccupancy();                                                    // 3a00:08e0
  if (G.combat_Visible) FocusSquare(nx, ny, mode, 8);                    // 3a00:08e5 / 08fb
  cb[0x0F] = 0; cb[0x12] = 0;                                            // 3a00:0900 / 090d
  await PlayOrStopSound(G.snd_Step ?? snd(0x25C0));                      // 3a00:091e
  await FreeAttacksOnMover(c);                                           // 3a00:092a
  if (c.b[0x196] === 0 || await X.IsHelpless(c)) cb[6] = 0;              // 3a00:092d .. 094f
}

// 3A00:095A AttacksOfOpportunity(c, dir)
export async function AttacksOfOpportunity(c, dir) {
  const L = new Array(13).fill(0);                                       // 3a00:0960 FillChar(L, 12, 0)
  const idx = CombatantIndex(c);                                         // 3a00:0971
  const n = await X.CollectOppositeSideTargets(c, 1);                    // 3a00:097f
  if (n === 0) return;                                                   // 3a00:0990
  for (let i = 1; i <= n; i++) L[i] = foes()[i];                         // 3a00:099f
  G.cb_Col[idx] = byte(G.cb_Col[idx] + DX[dir]); G.cb_Row[idx] = byte(G.cb_Row[idx] + DY[dir]);   // 3a00:09ae / 09cb tentative step
  const m = await X.CollectOppositeSideTargets(c, 1);                    // 3a00:09ff
  G.cb_Col[idx] = byte(G.cb_Col[idx] - DX[dir]); G.cb_Row[idx] = byte(G.cb_Row[idx] - DY[dir]);   // 3a00:0a10 / 0a2a undo
  for (let i = 1; i <= n; i++) {                                         // 3a00:0a4a
    let still = false;                                                   // 3a00:0a59
    for (let j = 1; j <= m; j++) if (foes()[j] === L[i]) still = true;   // 3a00:0a63 .. 0a7f
    if (still) L[i] = 0;                                                 // 3a00:0a8f
  }
  for (let i = 1; i <= n; i++) {                                         // 3a00:0aa8
    if (L[i] === 0 || c.b[0x196] === 0) continue;                        // 3a00:0ab6 / 0ac0
    G.combat_Shown = 1; G.combat_Visible = 1;                            // 3a00:0ae6 / 0aeb new
    let done = false;                                                    // 3a00:0af0
    const e = G.cb_Char[L[i]];                                           // 3a00:0af4
    if (!(await X.IsHelpless(e)) && await CanAttack(c, e) &&             // 3a00:0b12 / 0b24
        !(await X.HasEffect(e, 0x4B, { v: null })) && !(await X.HasEffect(e, 0x4A, { v: null }))) {   // 3a00:0b3b / 0b55
      const f = CB(e)[9];
      for (let k = f + 6; k <= f + 10; k++) {                            // 3a00:0b6f .. 0b94
        if (done) continue;                                              // 3a00:0ba1
        if (sb(CB(e)[3]) > 0 || CB(e)[0x0F] === 0 ||                     // 3a00:0ba4 / 0bad
            InFrontArc(CombatantCol(e), CombatantRow(e), CombatantCol(c), CombatantRow(c), k % 8)) {   // 3a00:0bcb .. 0c08
          let slot = 1;                                                  // 3a00:0c14
          if (e.b[0x11C] === 0) slot = 2;                                // 3a00:0c18
          for (let j = 1; j <= 2; j++) if (AL(e, j) !== 0) slot = j;     // 3a00:0c30 .. 0c3a
          if (AL(e, slot) === 0) setAL(e, slot, 1);                      // 3a00:0c48
          CB(e)[4] = slot;                                               // 3a00:0c60
          const saved = e.combat.target;                                 // 3a00:0c7f
          const d = { v: G.dummy_Done };
          await Attack(e, c, 1, null, d);                                // 3a00:0c93
          G.dummy_Done = d.v;
          done = true;                                                   // 3a00:0cb1
          e.combat.target = saved;                                       // 3a00:0cb5
          if (c.b[0x196] !== 0) { G.combat_Shown = 1; await X.DrawCharacterSummary(c); }   // 3a00:0cca .. 0cda
        }
      }
    }
  }
}

// 3A00:0D1C Flee(c): Byte
export async function Flee(c) {
  let escaped = false;                                                   // 3a00:0d22
  if (await X.CollectOppositeSideTargets(c, 0xFF) === 0) escaped = true; // 3a00:0d26 / 0d38
  else {
    const mine = (await CalcMove(c)) >> 1;                               // 3a00:0d3e
    const theirs = await MaxEnemyMove(c);                                // 3a00:0d53
    if (theirs < mine) escaped = true;                                   // 3a00:0d60
    else if (theirs === mine && (await X.Roll(1, 2)) === 1) escaped = true;   // 3a00:0d6e / 0d76
  }
  if (escaped) await X.RemoveFromCombat(c, 3, 'Got Away');               // 3a00:0d89 / 0da7
  else await X.ShowTimedBottomMessage('Escape is blocked');              // 3a00:0dbd
  return await X.ClearCombatantActionFlags(c);                           // 3a00:0dc2
}

// 3A00:0DD9 CalcAttacks(c)
export async function CalcAttacks(c) {
  const cb = CB(c);
  let missile = false;                                                   // 3a00:0ddf
  const old = AL(c, 1);                                                  // 3a00:0de3
  setAL(c, 1, c.b[0x11C]);                                               // 3a00:0dee
  const ammo = { v: null };
  if (await X.WeaponIsRanged(c) && await X.GetMissileAmmo(c, ammo)) {    // 3a00:0dfe / 0e0d
    missile = true;                                                      // 3a00:0e21
    let rof = ITT(itype(c.readied[0]), 5);                               // 3a00:0e25 g_5CFB
    if (rof < 2) rof = 2;                                                // 3a00:0e40
    G.StatValue = rof;                                                   // 3a00:0e4a
  } else G.StatValue = AL(c, 1);                                         // 3a00:0e52
  G.StatKind = 0;                                                        // 3a00:0e5d
  await X.CallEffectHooks(0x12, c);                                      // 3a00:0e62
  let n = HalfRound(G.StatValue);                                        // 3a00:0e70 / 0e75
  if (missile && ammo.v) {                                               // 3a00:0e7b
    let k = 1;                                                           // 3a00:0e89
    if (ammo.v.b[0x39] > 1) k = ammo.v.b[0x39];                          // 3a00:0e8d
    if (k < n && ammo.v.b[0x39] !== 0) n = k;                            // 3a00:0eab / 0eb3
  }
  if (cb[8] === 0 || n < old || (n < 2 * old && !missile)) setAL(c, 1, n);   // 3a00:0ec3 .. 0f01
}

// 3A00:0F12 HalfRound(v): Byte
export function HalfRound(v) {
  let t = byte(v); if (G.CombatRound & 1) t = byte(t + 1);               // 3a00:0f18 / 0f1e
  return t >> 1;                                                         // 3a00:0f28
}

// 3A00:0F46 FighterSweep(att, tgt): Boolean
export async function FighterSweep(att, tgt) {
  if (AL(att, 1) >= CB(att)[5]) return false;                            // 3a00:0f50
  if (tgt.b[0xE5] !== 0 || (await X.TargetDistance(att, tgt)) !== 1) return false;   // 3a00:0f69 / 0f77
  const n = await X.CollectOppositeSideTargets(att, 1);                  // 3a00:0f8f
  const F = foes();
  let cnt = 0, pos = 0;                                                  // 3a00:0fa0 (pos uninitialised when tgt is not adjacent)
  for (let i = 1; i <= n; i++) {                                         // 3a00:0faa
    const e = G.cb_Char[F[i]];                                           // 3a00:0fb6
    if (e === tgt) pos = i;                                              // 3a00:0fd8
    if (e.b[0xE5] === 0) cnt++;                                          // 3a00:0fe2
  }
  if (cnt <= AL(att, 1)) return false;                                   // 3a00:1003
  if (cnt > CB(att)[5]) cnt = CB(att)[5];                                // 3a00:1013
  await X.ShowCharacterMessage(att, 'sweeps', 10, 1);                    // 3a00:1048
  if (G.cb_Char[F[1]] !== tgt) { F[pos] = F[1]; F[1] = CombatantIndex(tgt); }   // 3a00:1053 .. 1088
  for (let i = 1; i <= n; i++) {                                         // 3a00:109c
    if (cnt !== 0 && G.cb_Char[F[i]].b[0xE5] === 0) {                    // 3a00:10ab / 10b4
      const e = G.cb_Char[F[i]];                                         // 3a00:10d3
      await FaceAttacker(att, e);                                        // 3a00:10f2
      setAL(att, 1, 1);                                                  // 3a00:1102
      const d = { v: G.dummy_Done };
      await Attack(att, e, 0, null, d);                                  // 3a00:110b
      G.dummy_Done = d.v;
      cnt--;                                                             // 3a00:1129
    }
  }
  return true;                                                           // 3a00:1137
}

// 3A00:1144 CanAttack(att, tgt): Boolean
export async function CanAttack(att, tgt) {
  if (!tgt) return false;                                                // 3a00:114e
  if (att === tgt) return true;                                          // 3a00:1159 / 1168
  G.AttackBlocked = 0;                                                   // 3a00:116e
  await X.CallEffectHooks(1, tgt);                                       // 3a00:1173
  if (G.AttackBlocked === 0) {                                           // 3a00:1181
    const saved = att.combat.target; att.combat.target = tgt;            // 3a00:1188 / 119c
    await X.CallEffectHooks(0, att);                                     // 3a00:11b1
    att.combat.target = saved;                                           // 3a00:11bf
  }
  return G.AttackBlocked === 0;                                          // 3a00:11d4
}

// 3A00:1227 TurnUndead(c)
export async function TurnUndead(c) {
  await X.ShowCharacterMessage(c, 'turns undead...', 10, 0);             // 3a00:1242
  ClearMenuLine(); await MessageDelay();                                 // 3a00:124d / 1252
  let any = false, stop = false;                                         // 3a00:1257 / 125b
  CB(c)[0x11] = 1;                                                       // 3a00:1267 the caster has turned (ov08 'Turn' test)
  let extra = 6;                                                         // 3a00:126c
  let count = await X.Roll(1, 12);                                       // 3a00:1270
  const d20 = await X.Roll(1, 20);                                       // 3a00:127e
  const lv = byte(c.b[0x109] + c.b[0x111] * ((await X.DualClassActive(c)) ? 1 : 0));   // 3a00:128c .. 12a7
  let col;
  if (lv >= 1 && lv <= 8) col = c.b[0x109];                              // 3a00:1297 / 12cf quirk: the raw cleric level
  else if (lv >= 9 && lv <= 13) col = 9; else col = 10;                  // 3a00:12c7 .. 12d5
  const u = { v: null };
  while (await FindTurnTarget(c, u) && count !== 0 && !stop) {           // 3a00:12d9 .. 12fe
    const v = sb(ds(0x0367 + u.v.b[0xE9] * 10 + col));                   // 3a00:1301 TurnUndeadTable
    if (d20 < Math.abs(v)) stop = true;                                  // 3a00:1320 .. 1333
    else {
      any = true;                                                        // 3a00:1335
      FocusCombatant(u.v, 3, false);                                     // 3a00:133c
      G.combat_Shown = 1; await X.DrawCharacterSummary(u.v);             // 3a00:134d / 1358
      if (v < 1) {                                                       // 3a00:135d
        await X.ShowCharacterMessage(u.v, 'Is destroyed', 10, 0);        // 3a00:13a4
        await RemoveCombatant(u.v);                                      // 3a00:13af
        u.v.b[0x195] = 8; u.v.b[0x196] = 0;                              // 3a00:13ba / 13c3 Gone
      } else {
        CB(u.v)[0x10] = 1;                                               // 3a00:136b turned
        await X.ShowCombatMessageAnimation(u.v, 1, 'is turned');         // 3a00:1388
      }
      if (extra !== 0) extra--;                                          // 3a00:13cc
      count = byte(count - 1);                                           // 3a00:13d2
      if (count === 0 && extra !== 0 && v < 0) count++;                  // 3a00:13d8 .. 13e4
      await X.ClearCharacterMessage();                                   // 3a00:13ed
    }
  }
  if (!any) await X.ShowTimedBottomMessage('Nothing Happens...');        // 3a00:13f4 / 1410
  await X.CountActiveSides();                                            // 3a00:1415
  G.dummy_Done = await X.ClearCombatantActionFlags(c);                   // 3a00:141a
  await X.ClearCharacterMessage();                                       // 3a00:1428
}

// 3A00:1433 FindTurnTarget(c, var u): Boolean
export async function FindTurnTarget(c, u) {
  let best = 0x0D; u.v = null;                                           // 3a00:1439 / 143d
  const n = await X.CollectOppositeSideTargets(c, 0xFF);                 // 3a00:1449
  let r = false;                                                         // 3a00:1457
  for (let i = 1; i <= n; i++) {                                         // 3a00:145e
    const e = G.cb_Char[foes()[i]];                                      // 3a00:1473
    if (CB(e)[0x10] === 0 && e.b[0xE9] > 0 && e.b[0xE9] < best) { best = e.b[0xE9]; u.v = e; r = true; }   // 3a00:1492 .. 14c4
  }
  return r;
}

// 3A00:14E8 MeleeAttack(att, tgt, behind, var done, missile)
export async function MeleeAttack(att, tgt, behind, done, missile) {
  const H = slotHits(), S = slotSwings(), cb = CB(att);
  let backstab = behind;                                                 // 3a00:14ee
  done.v = 0;                                                            // 3a00:14f4
  H[1] = 0; H[2] = 0; S[1] = 0; S[2] = 0;                                // 3a00:14fb .. 150a
  let anyHit = false, stop = false;                                      // 3a00:150f / 1513
  G.DamageAmount = 0;                                                    // 3a00:1517
  cb[8] = 1;                                                             // 3a00:151c
  if (await X.IsHelpless(tgt)) {                                         // 3a00:1529
    await PlayOrStopSound(snd(0x25BA));                                  // 3a00:153b
    while (AL(att, cb[4]) === 0 && cb[4] > 0) cb[4]--;                   // 3a00:1544 .. 1562
    S[cb[4]] = (S[cb[4]] ?? 0) + 1;                                      // 3a00:156d
    await ShowAttackResult(att, tgt, 3, byte(tgt.b[0x1A4] + 5), 1, 1);   // 3a00:1581 "slays helpless ... with one cruel blow"
    await X.ov23_1569(att);                                              // 3a00:15a8 remove effects 19h
    for (let k = 1; k <= 2; k++) setAL(att, k, 0);                       // 3a00:15cc
    anyHit = true; done.v = 1;                                           // 3a00:15d2 / 15d6
  } else {
    const w = att.readied ? att.readied[0] : null;
    if (w && (tgt.b[0xDE] > 0x80 || (tgt.b[0xDE] & 7) > 1)) {            // 3a00:15e0 .. 15f8 large target
      const t = itype(w);                                                // 3a00:1608 16-byte copy
      att.b[0x19E] = ITT(t, 2); att.b[0x1A0] = ITT(t, 3);                // 3a00:1630 / 163b
      att.b[0x1A2] = byte(att.b[0x1A2] - ITT(t, 0x0B) + ITT(t, 4));      // 3a00:1646
    }
    await X.RecalcItems(tgt);                                            // 3a00:1667
    await X.CallEffectHooks(0x0B, tgt);                                  // 3a00:1672
    const ac = { v: 0 };
    if (await CanBackstab(att, tgt)) ac.v = byte(tgt.b[0x19B] - 4);      // 3a00:1684 / 1698 changed: -4
    else {
      if (CB(tgt)[0x0F] > 1 && (await DirectionTo(att, tgt)) === CB(tgt)[9] && CB(tgt)[0x12] > 4) backstab = 1;   // 3a00:16aa .. 16ea
      ac.v = tgt.b[0x19A + (backstab !== 0 ? 1 : 0)];                    // 3a00:16f0
    }
    await RangePenalty(att, tgt, ac);                                    // 3a00:1705
    let kind = backstab !== 0 ? 1 : 0;                                   // 3a00:171a
    if (await CanBackstab(att, tgt)) kind = 2;                           // 3a00:1728
    for (let k = cb[4]; k >= 1; k--) {                                   // 3a00:1740
      while (AL(att, k) !== 0 && !stop) {                                // 3a00:175e
        setAL(att, k, AL(att, k) - 1);                                   // 3a00:1776
        cb[4] = k;                                                       // 3a00:177f
        S[k]++;                                                          // 3a00:178e
        if (await X.AttackRoll(att, tgt, ac.v) || await X.IsHelpless(tgt)) {   // 3a00:17a8 / 17c1
          H[k]++;                                                        // 3a00:17d3
          await PlayOrStopSound(snd(0x25BA));                            // 3a00:17de
          anyHit = true;                                                 // 3a00:17e7
          await RollDamage(att, tgt, k);                                 // 3a00:17eb
          await ShowAttackResult(att, tgt, kind, G.DamageAmount, G.DamageAmount, 1);   // 3a00:17ff
          if (tgt.b[0x196] !== 0) await X.CallEffectHooks(k + 1, att);   // 3a00:181e / 1829 event 2 / 3
          if (tgt.b[0x196] === 0) stop = true;                           // 3a00:183b
          if (att.b[0x196] === 0) setAL(att, k, 0);                      // 3a00:184a new
        }
      }
    }
    if (missile && missile.b[0x39] === 0 && itype(missile) === 0x64)     // 3a00:1875 .. 188a new
      for (let k = 1; k <= 2; k++) setAL(att, k, 0);                     // 3a00:1891
    if (!anyHit) {                                                       // 3a00:18aa
      await PlayOrStopSound(snd(0x25BE));                                // 3a00:18b6
      await ShowAttackResult(att, tgt, kind, 0, 0, 0);                   // 3a00:18bf "... and Misses"
    }
    done.v = 1;                                                          // 3a00:18dc
    for (let k = 1; k <= 2; k++) if (AL(att, k) !== 0) done.v = 0;       // 3a00:18ec
    cb[5] = 0;                                                           // 3a00:1905
  }
  if (att.b[0x196] === 0) done.v = 1;                                    // 3a00:1918 new
  if (done.v !== 0) done.v = await X.ClearCombatantActionFlags(att);     // 3a00:1923 / 1933
}

// 3A00:194A FaceAttacker(att, def)
export async function FaceAttacker(att, def) {
  const cb = CB(def);
  cb[0x0F] = byte(cb[0x0F] + 1);                                         // 3a00:1950
  const d = await DirectionTo(def, att);                                 // 3a00:195c
  let diff = (d - cb[9] + 8) % 8;                                        // 3a00:196f
  if (diff > 4) diff = 8 - diff;                                         // 3a00:1993
  cb[0x12] = (cb[0x12] + diff) % 8;                                      // 3a00:1999
}

// 3A00:19D8 Attack(att, tgt, behind, missile, var done)
export async function Attack(att, tgt, behind, missile, done) {
  G.combat_Visible = 1; G.combat_Shown = 1;                              // 3a00:19de / 19e3
  G.combat_MaxRounds = byte(G.CombatRound + 0x0F);                       // 3a00:19e8
  let d = 0;                                                             // TODO(decode): uninitialised when neither branch sets it
  if (CB(tgt)[0x0F] < 2 && behind === 0) {                               // 3a00:19f3 .. 1a0b
    d = await DirectionTo(tgt, att);                                     // 3a00:1a08
    CB(tgt)[9] = (d + 4) % 8;                                            // 3a00:1a18
  } else if (IsVisible(tgt, false)) {                                    // 3a00:1a38
    d = CB(tgt)[9];                                                      // 3a00:1a46
    if (behind === 0) CB(tgt)[9] = (d + 4) % 8;                          // 3a00:1a59 / 1a5f
  }
  if (IsVisible(tgt, false)) ShowCombatant(tgt, d, 0, false);            // 3a00:1a7a / 1a8c
  d = await DirectionTo(att, tgt);                                       // 3a00:1aa1
  await X.DrawCharacterSummary(att);                                     // 3a00:1ab4
  ShowCombatant(att, d, 1, false);                                       // 3a00:1abf attack pose
  att.combat.target = tgt;                                               // 3a00:1ad4
  await Delay(100);                                                      // 3a00:1ae9
  if (missile) await MissileAnim(att, tgt, missile);                     // 3a00:1af2 / 1afa
  const w = att.readied ? att.readied[0] : null;
  if (w && (itype(w) === 0x2F || itype(w) === 0x65)) await MissileAnim(att, tgt, w);   // 3a00:1b10 .. 1b48 (no nil test: TODO(decode))
  done.v = 1;                                                            // 3a00:1b4b
  if (AL(att, 1) !== 0 || AL(att, 2) !== 0) {                            // 3a00:1b52
    const savedSel = G.SelectedChar; G.SelectedChar = att;               // 3a00:1b6b / 1b77
    await MeleeAttack(att, tgt, behind, done, missile);                  // 3a00:1b83
    if (missile) {                                                       // 3a00:1ba2
      if (missile.b[0x39] !== 0) missile.b[0x39] = byte(missile.b[0x39] - slotSwings()[1]);   // 3a00:1bad / 1bb7
      if (missile.b[0x39] === 0) {                                       // 3a00:1bc1
        if (await X.ov24_305B(att) && missile.b[0x3E] !== 0x89) {        // 3a00:1bce / 1be0 (+3Eh, listing)
          const copy = newItem(); copy.b.set(missile.b);                 // 3a00:1be7 / 1bf5
          copy.next = G.TreasureItems ?? null; G.TreasureItems = copy; copy.b[0x34] = 0;   // 3a00:1c08 .. 1c28
          await X.LoseItem(att, missile);                                // 3a00:1c2d
          G.treasure_Mark = copy;                                        // 3a00:1c3e
        } else await X.LoseItem(att, missile);                           // 3a00:1c4c
      }
    }
    await X.RecalcItems(att);                                            // 3a00:1c5d
    G.SelectedChar = savedSel;                                           // 3a00:1c68
  }
  if (done.v !== 0) done.v = await X.ClearCombatantActionFlags(att);     // 3a00:1c74 / 1c7d
  if (IsVisible(att, false)) {                                           // 3a00:1c8e
    ShowCombatant(att, CB(att)[9], 1, true);                             // 3a00:1ca0
    ShowCombatant(att, CB(att)[9], 0, false);                            // 3a00:1cbe
  }
}

// 3A00:1CE2 RangePenalty(att, tgt, var ac)
export async function RangePenalty(att, tgt, ac) {
  let dist = await X.TargetDistance(att, tgt);                           // 3a00:1ce8
  let band;
  if (await X.WeaponIsRanged(att)) band = Math.trunc((ITT(itype(att.readied[0]), 0x0C) - 1) / 3);   // 3a00:1cfc / 1d0b
  else band = dist;                                                      // 3a00:1d31
  if (sb(dist) - sb(band) > 0) { dist = byte(dist - band); ac.v = byte(ac.v + 2); }   // 3a00:1d37 .. 1d5c
  if (sb(dist) - sb(band) > 0) ac.v = byte(ac.v + 3);                    // 3a00:1d67 .. 1d8e
}

// 3A00:1DF6 FindHealTarget(c, var t): Boolean
export async function FindHealTarget(c, t) {
  let best = null, body = 0, minHp = 0xFF;                               // 3a00:1dfc .. 1e08
  const L = G.corpse_List || [];
  for (let d = 0; d <= 8; d++) {                                         // 3a00:1e0c
    const x = sx8(CombatantCol(c) + DX[d]), y = sx8(CombatantRow(c) + DY[d]);   // 3a00:1e15 / 1e34
    const occ = { v: 0 }, ground = { v: 0 };
    CellAt(x, y, occ, ground);                                           // 3a00:1e53
    if (occ.v !== 0) {                                                   // 3a00:1e6a
      t.v = G.cb_Char[occ.v];                                            // 3a00:1e73
      const p = t.v;
      if (p.b[0x197] === c.b[0x197] && p.b[0x1A4] < p.b[0x78] &&         // 3a00:1e8e / 1ea3
          (p.b[0x1A4] < minHp || (p === c && p.b[0x1A4] < (p.b[0x78] >> 1)))) { best = p; minHp = p.b[0x1A4]; }   // 3a00:1eba .. 1f0f
    } else if (ground.v === 0x1F && G.corpse_Count !== 0) {              // 3a00:1f20 / 1f29
      for (let k = 1; k <= G.corpse_Count; k++) {                        // 3a00:1f2f
        const e = L[k];
        if (e && e.char && ![6, 7, 8].includes(e.char.b[0x195]) && sx8(e.col) === x && sx8(e.row) === y) body = k;   // 3a00:1f3e .. 1f9b
      }
    }
  }
  if (minHp < 8 || body === 0) t.v = best; else t.v = L[body].char;     // 3a00:1fae .. 1fe0
  return t.v !== null && t.v !== undefined;                              // 3a00:1ff0
}

// 3A00:200F ChooseSpellTarget(spell, auto, allowEmpty, var tgt): Boolean
export async function ChooseSpellTarget(spell, auto, allowEmpty, tgt) {
  let found = false;                                                     // 3a00:2015
  const sel = G.SelectedChar;
  if (auto === 0) {                                                      // 3a00:2019
    const ok = { v: 0 };
    await SelectTarget(sel, await X.SpellRange(spell), 0, allowEmpty, spell !== 0x53 ? 1 : 0, ok, tgt);   // 3a00:202e / 2056
    found = ok.v !== 0;
    sel.combat.target = tgt.char;                                        // 3a00:2059
  } else if (SPT(spell, 0x0E) === 0) {                                   // 3a00:2075
    tgt.char = sel;                                                      // 3a00:2087
    const h = { v: tgt.char };
    if (spell !== 3 || await FindHealTarget(sel, h)) {                   // 3a00:2097 / 209d
      tgt.char = h.v;
      tgt.x = CombatantCol(tgt.char); tgt.y = CombatantRow(tgt.char);    // 3a00:20b2 / 20c8
      found = true;                                                      // 3a00:20e5
    } else tgt.char = h.v;
  } else {
    let tries = 1;                                                       // 3a00:20de changed: one attempt
    while (tries !== 0 && !found) {                                      // 3a00:20f2
      let ok = true;                                                     // 3a00:20fb
      if (await AutoTarget(sel, await X.SpellRange(spell), 0, 1)) {      // 3a00:20ff / 211b
        const t = sel.combat.target;                                     // 3a00:2122
        if (await X.IsHelpless(t))                                       // 3a00:2137
          for (let k = 1; k <= 4; k++) if (SPT(spell, 0x0A) === ds(0x27C8 + k)) ok = false;   // 3a00:2146 .. 215f HelplessEffectIds
        if (ok) {                                                        // 3a00:2171
          tgt.char = sel.combat.target;                                  // 3a00:217d
          tgt.x = CombatantCol(tgt.char); tgt.y = CombatantRow(tgt.char);   // 3a00:2196 / 21ac
          found = true;                                                  // 3a00:21c2
        }
      }
      tries--;                                                           // 3a00:21c6
    }
  }
  if (found) { G.SpellX = tgt.x; G.SpellY = tgt.y; return true; }        // 3a00:21cc .. 21e7
  clearTgt(tgt); return false;                                           // 3a00:21ec / 21fc
}

// 3A00:2220 CollectSpellTargets(spell, auto, var ok) — the combat target selector (G.SpellHandlers[0])
export async function CollectSpellTargets(spell, auto, ok) {
  const T = targets(), sel = G.SelectedChar;
  ok.v = 1; G.SpellTargetCount = 0; G.SpellArea = 0;                     // 3a00:2226 .. 2232
  G.SpellX = CombatantCol(sel); G.SpellY = CombatantRow(sel);            // 3a00:2237 / 2247
  const code = SPT(spell, 6) & 0x0F;                                     // 3a00:2257
  const t = newTargetRec();
  if (code === 0) { T[1] = sel; G.SpellTargetCount = 1; }                // 3a00:226f / 227c
  else if (code === 5) {                                                 // 3a00:2284 new
    let sum = 0, n = 0;                                                  // 3a00:228c / 2290
    let budget = spell === 0x4F ? await X.SpellCasterLevel(0x4F) : await X.Roll(2, 4);   // 3a00:2294 .. 22a7
    let stop = false;                                                    // 3a00:22b5
    do {
      if (!await ChooseSpellTarget(spell, auto, 0, t)) stop = true;      // 3a00:22b9 / 22d4
      else {
        let dup = false;                                                 // 3a00:22d8
        for (let j = 1; j <= n; j++) if (T[j] === t.char) dup = true;    // 3a00:22de .. 2303
        if (!dup) {                                                      // 3a00:230c
          n++; T[n] = t.char;                                            // 3a00:2314
          G.SpellX = CombatantCol(t.char); G.SpellY = CombatantRow(t.char);   // 3a00:2338 / 2346
          G.SpellTargetCount++;                                          // 3a00:2354
          if (spell === 0x4F) {                                          // 3a00:2358
            const s = t.char.b[0xDE];
            if (s === 1) sum += 1; else if (s === 2 || s === 3) sum += 2; else if (s === 4) sum += 4;   // 3a00:235e .. 2397
          } else {
            const l = t.char.b[0xE5];
            sum += l <= 1 ? 1 : l === 2 ? 2 : l === 3 ? 4 : 8;           // 3a00:2399 .. 23de
          }
          if (n > 1 && sum > budget) stop = true;                        // 3a00:23e6 / 23ec
        } else if (auto === 0) await X.ShowTimedBottomMessage('Already been targeted');   // 3a00:23f1 / 2400
        else budget = byte(budget - 1);                                  // 3a00:2405
        RedrawSquare(CombatantCol(t.char), CombatantRow(t.char));        // 3a00:240b .. 241d
      }
    } while (!stop && budget !== 0);                                     // 3a00:2422
  } else if (code === 0x0F) {
    if (await ChooseSpellTarget(spell, auto, 0, t)) {                    // 3a00:2442
      if (sel.combat.target) { T[1] = sel.combat.target; G.SpellTargetCount = 1; }   // 3a00:245d .. 2486
      else {
        BuildTargetList(G.SpellX, G.SpellY, (SPT(spell, 6) & 0x0F) >> 4, 0xFF, 1, G.cm_Map);   // 3a00:248e radius always 0 (quirk kept)
        for (let i = 1; i <= G.tg_Count; i++) T[i] = G.cb_Char[G.tg_List[i].who];   // 3a00:24c2 .. 2508
        G.SpellTargetCount = G.tg_Count; G.SpellArea = 1;                // 3a00:2510 / 2516
      }
    } else ok.v = 0;                                                     // 3a00:251d
  } else if (code >= 8 && code <= 0x0E) {
    if (await ChooseSpellTarget(spell, auto, 1, t)) {                    // 3a00:2537
      BuildTargetList(G.SpellX, G.SpellY, SPT(spell, 6) & 7, 0xFF, 1, G.cm_Map);   // 3a00:2552
      for (let i = 1; i <= G.tg_Count; i++) T[i] = G.cb_Char[G.tg_List[i].who];   // 3a00:2581 .. 25c7
      G.SpellTargetCount = G.tg_Count; G.SpellArea = 1;                  // 3a00:25cf / 25d5
    } else ok.v = 0;                                                     // 3a00:25dc
  } else {                                                               // 1..4, 6, 7
    let left = (SPT(spell, 6) & 3) + 1, n = 0;                           // 3a00:25e6 / 25f5
    while (left !== 0) {                                                 // 3a00:2601
      if (await ChooseSpellTarget(spell, auto, 0, t)) {                  // 3a00:260a
        let dup = false;                                                 // 3a00:2625
        for (let j = 1; j <= n; j++) if (T[j] === t.char) dup = true;    // 3a00:262f
        if (!dup) {                                                      // 3a00:2665
          n++; T[n] = t.char; left--;                                    // 3a00:266b .. 2686
          G.SpellX = CombatantCol(t.char); G.SpellY = CombatantRow(t.char);   // 3a00:2689 / 2697
        } else if (auto === 0) await X.ShowTimedBottomMessage('Already been targeted');   // 3a00:26a5 / 26bc
        else left--;                                                     // 3a00:26c3
        RedrawSquare(CombatantCol(t.char), CombatantRow(t.char));        // 3a00:26c6 .. 26de
      } else left = 0;                                                   // 3a00:26e5
    }
    G.SpellTargetCount = n;                                              // 3a00:26ec
    if (n === 0) ok.v = 0;                                               // 3a00:26f2
    if (T[n]) { G.SpellX = CombatantCol(T[n]); G.SpellY = CombatantRow(T[n]); }   // 3a00:26ff / 271a (n = 0 reads SpellTargets[0]: TODO(decode))
  }
}

// 3A00:275A BeginCast(spell, auto, var done)
export async function BeginCast(spell, auto, done) {
  const caster = G.SelectedChar;                                         // 3a00:2760
  const f = { v: 1 }, w = { v: 0xFFFF };
  done.v = 0;
  let sp = spell;                                                        // 3a00:277c
  if (sp === 0) sp = await X.SpellList(0, 1, w, f);                      // 3a00:2782 / 2788
  if (sp !== 0 && SPT(sp, 0x0B) === 0) { await X.ShowTimedBottomMessage('Camp Only Spell'); sp = 0; }   // 3a00:27a0 .. 27cc
  if (auto === 0) {                                                      // 3a00:27d0
    await X.ov24_2E05();                                                 // 3a00:27d6
    G.combat_Visible = 1; G.combat_Shown = 1;                            // 3a00:27db / 27e0 new
    FocusCombatant(caster, 3, true); await X.DrawCharacterSummary(caster);   // 3a00:27e5 / 27f6
  }
  if (sp !== 0) {                                                        // 3a00:2801
    const ct = Math.trunc(SPT(sp, 0x0C) / 3);                            // 3a00:280a
    if (ct === 0) {                                                      // 3a00:2824
      await X.CastSpell(sp, auto, 1, done);                              // 3a00:282a
      done.v = await X.ClearCombatantActionFlags(caster);                // 3a00:283f
    } else {
      done.v = 1;                                                        // 3a00:2852
      await X.ShowCharacterMessage(caster, 'Begins Casting', 10, 1);     // 3a00:286e
      CB(caster)[0] = sp;                                                // 3a00:2879
      if (sb(CB(caster)[3]) > ct) CB(caster)[3] = byte(CB(caster)[3] - ct);   // 3a00:2887 / 289f
      else CB(caster)[3] = 1;                                            // 3a00:28b0
    }
  }
}

// 3A00:28C3 CanBackstab(att, tgt): Boolean
export async function CanBackstab(att, tgt) {
  let ok = false;                                                        // 3a00:28c9
  const w = att.readied ? att.readied[0] : null;                         // 3a00:28cd
  const wt = w ? itype(w) : 0;                                           // 3a00:28dd
  if ((sb(att.b[0x10F]) > 0 || (sb(att.b[0x117]) > 0 && await X.DualClassActive(att))) &&   // 3a00:28ef .. 291b
      (!w || wt === 0x61 || wt === 7 || wt === 8 || (wt > 0x22 && wt < 0x26))) ok = true;   // 3a00:2924 .. 294e
  return ok && CB(tgt)[0x0F] > 1 && (tgt.b[0xDE] & 0x7F) < 2 &&          // 3a00:2954 .. 2977
    (await DirectionTo(att, tgt)) === CB(tgt)[9];                        // 3a00:2971
}

// 3A00:29A2 DirectionTo(a, b): direction 0..7 from a to b (22.5-degree sectors)
export function DirectionTo(a, b) {
  const ax = sx8(CombatantCol(a)), ay = sx8(CombatantRow(a)), bx = sx8(CombatantCol(b)), by = sx8(CombatantRow(b));   // 3a00:29a8 .. 29db
  const dx = Math.abs(bx - ax), dy = Math.abs(by - ay);                  // 3a00:29e4 .. 2a06
  const steep = (dx * 0x26A) >> 8, flat = (dx * 0x6A) >> 8;
  for (let d = 0; d <= 7; d++) {                                         // 3a00:2a0a .. 2be0
    let f = false;
    switch (d) {
      case 0: f = by <= ay && dy >= steep; break;
      case 2: f = bx >= ax && dy <= flat; break;
      case 4: f = by >= ay && dy >= steep; break;
      case 6: f = bx <= ax && dy <= flat; break;
      case 1: f = by <= ay && bx >= ax && dy <= steep && dy >= flat; break;
      case 3: f = by >= ay && bx >= ax && dy <= steep && dy >= flat; break;
      case 5: f = by >= ay && bx <= ax && dy <= steep && dy >= flat; break;
      case 7: f = by <= ay && bx <= ax && dy <= steep && dy >= flat; break;
    }
    if (f) return d;                                                     // 3a00:2bec
  }
  return 0;                                                              // unreachable (the original loops)
}

// 3A00:2BFB MissileAnim(att, tgt, it)
export async function MissileAnim(att, tgt, it) {
  await PlayOrStopSound(snd(0x25C4));                                    // 3a00:2c01
  const d = DirectionTo(att, tgt);                                       // 3a00:2c0a
  let steps = 1, pause = 10;                                             // 3a00:2c1a / 2c1d
  const t = itype(it);                                                   // 3a00:2c21
  if ([9, 0x15, 0x64, 0x1C, 0x1F, 0x49].includes(t)) {                   // 3a00:2c29 .. 2c5b
    if (d & 1) {                                                         // 3a00:2c5e
      if (d === 3 || d === 5) await X.CopyCombatAnimationFrame(0x0E, 1, 0, d === 5 ? 1 : 0);   // 3a00:2c65 / 2c8a
      else await X.CopyCombatAnimationFrame(0x0E, 0, 0, d === 7 ? 1 : 0);   // 3a00:2cab
    } else await X.CopyCombatAnimationFrame(0x0D + (d % 4), d >> 2, 0, 0);   // 3a00:2cb3
    await PlayOrStopSound(snd(0x25C4));                                  // 3a00:2ce0
  } else if ([2, 7, 0x14].includes(t)) {                                 // 3a00:2ce9
    await X.BuildFourAnimationFrames(0x10); steps = 4; pause = 0x32; await PlayOrStopSound(snd(0x25BE));   // 3a00:2cfb .. 2d15
  } else if (t === 0x55 || t === 0x56) {                                 // 3a00:2d1a
    await X.BuildFourAnimationFrames(0x11); steps = 4; pause = 0x32; await PlayOrStopSound(snd(0x25B8));   // 3a00:2d27 .. 2d41
  } else if ([0x65, 0x2F, 0x62].includes(t)) {                           // 3a00:2d46 .. 2d5e new class
    await X.CopyCombatAnimationFrame(0x15, 0, 0, 0);                     // 3a00:2d5b
    await X.CopyCombatAnimationFrame(0x15, 1, 1, 0); steps = 2; pause = 10; await PlayOrStopSound(snd(0x25B8));   // 3a00:2d72 .. 2d95
  } else {
    await X.CopyCombatAnimationFrame(0x14, 0, 0, 0);                     // 3a00:2d9c
    await X.CopyCombatAnimationFrame(0x14, 1, 1, 0); steps = 2; pause = 0x14; await PlayOrStopSound(snd(0x25BE));   // 3a00:2db3 .. 2dd6
  }
  await X.AnimateAlongPath(CombatantCol(att), CombatantRow(att), CombatantCol(tgt), CombatantRow(tgt), steps, pause);   // 3a00:2ddb .. 2e17
}

// 3A00:2E22 CalcEnemyHpPct
export function CalcEnemyHpPct() {
  let sumMax = 0, sumHp = 0;                                             // 3a00:2e28 / 2e2a
  for (let p = G.PartyList; p; p = p.next) {                             // 3a00:2e32 .. 2e7b
    if (p.b[0x197] === 1) {                                              // 3a00:2e46
      if (p.b[0x196] !== 0) sumHp = (sumHp + p.b[0x1A4]) & 0xFFFF;       // 3a00:2e51 / 2e5c
      sumMax = (sumMax + p.b[0x78]) & 0xFFFF;                            // 3a00:2e6c
    }
  }
  if (sumMax !== 0) G.enemy_HpPercent = byte(Math.trunc(((0x14 * sumHp) & 0xFFFF) / sumMax) * 5);   // 3a00:2e8d / 2e93
}

// 3A00:2EAC MaxEnemyMove(c): Byte
export async function MaxEnemyMove(c) {
  let best = 0;                                                          // 3a00:2eb2
  const side = (await X.IsSideZero(c)) ? 1 : 0;
  for (let p = G.PartyList; p; p = p.next) {                             // 3a00:2eb6 .. 2f0d
    if (p.b[0x197] === side && p.b[0x196] !== 0) {                       // 3a00:2eca / 2ed5
      const m = (await CalcMove(p)) >> 1;                                // 3a00:2eea
      if (m > best) best = m;                                            // 3a00:2eff
    }
  }
  return best;                                                           // 3a00:2f25
}

// 3A00:2F3C ConfirmAttackAlly(att, tgt): Boolean
export async function ConfirmAttackAlly(att, tgt) {
  if (att.b[0x197] === ((await X.IsSideZero(tgt)) ? 1 : 0) || att.b[0x198] !== 0) return true;   // 3a00:2f42 .. 2f66
  if (await AskYesNo('Attack Ally: ', 13, 10, 15) !== 'Y') return false; // 3a00:2f69 .. 2f8a
  G.AllyAttacked = 1; view.setMem(0x7F33, 1);                            // 3a00:2f94 / 2f99
  for (let p = G.PartyList; p; p = p.next)                               // 3a00:2fa4 .. 2fe9
    if (p.b[0x195] === 0 && p.b[0xF7] > 0x7F) { p.b[0x197] = 1; if (p.combat) p.combat.target = null; }   // 3a00:2fb8 .. 2fdf
  await X.CountActiveSides();                                            // 3a00:2ffb
  return true;
}

// 3A00:3040 TargetMenu(att, t, maxRange, showRange, allowEmpty, canTargetChar): Char
export async function TargetMenu(att, t, maxRange, showRange, allowEmpty, canTargetChar) {
  let menu = '';                                                         // 3a00:3047
  const dist = await X.TargetDistance(att, t);                           // 3a00:304b
  DirectionTo(att, t);                                                   // 3a00:305f unused
  if (showRange !== 0) DrawText(0, 0x17, 10, 0, 'Range = ' + (await X.ByteToStr(dist)) + '  ');   // 3a00:3072 .. 30b2
  if (dist <= maxRange) {                                                // 3a00:30b7
    if (showRange === 0) { if (canTargetChar !== 0) menu = 'Target '; }  // 3a00:30c2 .. 30ce
    else if (att !== t) {                                                // 3a00:30e9
      const ammo = { v: null };
      if (!await X.WeaponIsRanged(att)) menu = 'Target ';                // 3a00:30f8 / 3107
      else if (await X.GetMissileAmmo(att, ammo))                        // 3a00:311c
        if ((await X.CollectOppositeSideTargets(att, 1)) === 0 || await X.ov24_305B(att)) menu = 'Target ';   // 3a00:3130 .. 3151
    }
  }
  menu = 'Next Prev Manual ' + menu + 'Center Exit';                     // 3a00:3164 .. 3191
  FocusCombatant(t, 3, true);                                            // 3a00:3196
  G.combat_Shown = 1; await X.DrawCharacterSummary(t);                   // 3a00:31a7 / 31b2
  hooks.emit('combatCursor', () => ({ mode: 'aim', ...hooks.state.combatant(t), col: CombatantCol(t), row: CombatantRow(t), menu }));   // Plus (#17)
  const m = await HorizontalMenu('Aim:', menu, 13, 10, 15, true, false); // 3a00:31df allowExt = 1
  return m.key;
}

// 3A00:31F0 ConfirmTarget(att, t, mode, var ok, var tgt)
export async function ConfirmTarget(att, t, mode, ok, tgt) {
  const ammo = { v: null }; ok.v = 1;                                    // 3a00:31f6 / 31fe
  if (mode === 1 && !await ConfirmAttackAlly(att, t)) ok.v = 0;          // 3a00:3205 .. 321f
  if (ok.v !== 0) {                                                      // 3a00:3226
    tgt.char = t; tgt.x = CombatantCol(t); tgt.y = CombatantRow(t);      // 3a00:3232 .. 3253
    map()[4] = 0;                                                        // 3a00:3265
    FocusSquare(sx8(map()[2]) + 3, sx8(map()[3]) + 3, 3, 8);             // 3a00:326e .. 328e
    if (mode === 1) {                                                    // 3a00:3293
      if (await FighterSweep(att, t)) ok.v = await X.ClearCombatantActionFlags(att);   // 3a00:329c / 32b0
      else {
        await FaceAttacker(att, t);                                      // 3a00:32c3
        if (await X.WeaponIsRanged(att) && await X.GetMissileAmmo(att, ammo) && await X.ov24_305B(att) &&
            (await X.TargetDistance(att, t)) === 1) ammo.v = null;       // 3a00:32d3 .. 331a
        await Attack(att, t, 0, ammo.v, ok);                             // 3a00:3322
      }
    }
  } else clearTgt(tgt);                                                  // 3a00:3342
}

// 3A00:33AC ManualAim(att, start, maxRange, mode, allowEmpty, canTargetChar, var ok, var tgt)
export async function ManualAim(att, start, maxRange, mode, allowEmpty, canTargetChar, ok, tgt) {
  clearTgt(tgt);                                                         // 3a00:33b3
  let cx = sx8(CombatantCol(start)), cy = sx8(CombatantRow(start));      // 3a00:33c4 / 33d2
  let key = ' ', dir = 8; ok.v = 0;                                      // 3a00:33dd .. 33e4
  map()[4] = 1; map()[5] = 1;                                            // 3a00:33ef / 33f8
  const L = G.corpse_List || [];
  while (!['\0', '\r', 'E', 'T'].includes(key)) {                        // 3a00:3401 set CS:3359
    FocusSquare(cx, cy, 3, dir);                                         // 3a00:3414
    cx += DX[dir]; cy += DY[dir];                                        // 3a00:3428 / 3436
    if (cx < 0) cx = 0; if (cy < 0) cy = 0; if (cx > 0x31) cx = 0x31; if (cy > 0x18) cy = 0x18;   // 3a00:3444 .. 3468
    const occ = { v: 0 }, ground = { v: 0 };
    CellAt(cx, cy, occ, ground);                                         // 3a00:346c
    await FlushGameKeys();                                               // 3a00:3483
    let valid = false;                                                   // 3a00:3488
    const rng = { v: 0xFF }, tx = { v: cx }, ty = { v: cy };
    if (TraceLine(CombatantCol(att), CombatantRow(att), tx, ty, rng, G.cm_Map)) {   // 3a00:349d .. 34cc
      valid = true;                                                      // 3a00:34d5
      if (mode !== 0) DrawText(0, 0x17, 10, 0, 'Range = ' + (await X.WordToStr(rng.v >> 1)) + '  ');   // 3a00:34df .. 3520
    } else if (mode !== 0) ClearRectangle(0, 0x17, 0x27, 0x17);          // 3a00:352d
    const r = rng.v >> 1;                                                // 3a00:3527
    let under = null;                                                    // 3a00:354b
    if (valid) {                                                         // 3a00:354d
      if (occ.v !== 0) under = G.cb_Char[occ.v];                         // 3a00:3553 / 3562
      else if (ground.v === 0x1F && G.corpse_Count !== 0)                // 3a00:357b / 3581
        for (let k = 1; k <= G.corpse_Count; k++)                        // 3a00:3587
          if (L[k] && sx8(L[k].col) === cx && sx8(L[k].row) === cy) under = L[k].char;   // 3a00:3596 .. 35cc
    }
    if (under) { G.combat_Shown = 1; await X.DrawCharacterSummary(under); }   // 3a00:35e0 .. 35ed
    else ClearRectangle(0x17, 1, 0x26, 0x15);                            // 3a00:35fa
    if (maxRange < r || terrCost(ground.v) === 0xFF) valid = false;      // 3a00:360b .. 3627
    if (under) {                                                         // 3a00:362b
      if (!await CanAttack(att, under) || canTargetChar === 0) valid = false;   // 3a00:3636 .. 3650
      if (mode === 1) {                                                  // 3a00:3654
        if (att === under || (occ.v === 0 && ground.v === 0x1F)) valid = false;   // 3a00:365a .. 367b
        else if (await X.WeaponIsRanged(att)) {                          // 3a00:367b
          const ammo = { v: null };
          if (!await X.GetMissileAmmo(att, ammo)) valid = false;         // 3a00:368a / 36bf
          else if ((await X.CollectOppositeSideTargets(att, 1)) !== 0 && !await X.ov24_305B(att)) valid = false;   // 3a00:369e / 36b0
        }
      }
    } else if (allowEmpty === 0) valid = false;                          // 3a00:36c5 / 36cb
    let menu = 'Center Exit';                                            // 3a00:36cf
    if (valid) menu = 'Target ' + menu;                                  // 3a00:36e2 / 36e8
    hooks.emit('combatCursor', () => ({ mode: 'manual', col: cx, row: cy, valid, under: under ? hooks.state.combatant(under) : null, menu }));   // Plus (#17)
    const m = await HorizontalMenu('(Use Cursor keys) ', menu, 13, 10, 15, true, false);   // 3a00:3738
    key = m.key; G.dummy_Done = m.ext ? 1 : 0;
    switch (key) {                                                       // 3a00:3747
      case '\r': case 'T':                                               // 3a00:374b
        map()[4] = 0;                                                    // 3a00:374e
        if (valid) {                                                     // 3a00:3757
          tgt.x = cx; tgt.y = cy;                                        // 3a00:375d / 3760
          tgt.char = under || null;                                      // 3a00:3767 .. 3796
          if (mode === 1) await ConfirmTarget(att, tgt.char, 1, ok, tgt); else ok.v = 1;   // 3a00:379c .. 37c0
        }
        if (!valid || ok.v === 0) { RedrawSquare(cx, cy); ok.v = 0; clearTgt(tgt); }   // 3a00:37c7 .. 37f6
        break;
      case 'H': dir = 0; break; case 'I': dir = 1; break; case 'M': dir = 2; break; case 'Q': dir = 3; break;   // 3a00:37fe .. 3847
      case 'P': dir = 4; break; case 'O': dir = 5; break; case 'K': dir = 6; break; case 'G': dir = 7; break;
      case '\0': case 'E': RedrawSquare(cx, cy); clearTgt(tgt); ok.v = 0; break;   // 3a00:3851 .. 3872
      case 'C': FocusSquare(cx, cy, 0, 8); dir = 8; break;               // 3a00:3877 .. 3897
      default: dir = 8;                                                  // 3a00:389d
    }
  }
}

// 3A00:3B37 SelectTarget(att, range, mode, allowEmpty, canTargetChar, var ok, var tgt)
// (with the nested CombatBuildTargetList 3A00:38AA and NextTarget 3A00:394B over the parent's locals)
export async function SelectTarget(att, range, mode, allowEmpty, canTargetChar, ok, tgt) {
  const st = { L: [], n: 0, cur: 1, px: 0, py: 0, nx: 0, ny: 0 };
  // 3A00:38AA CombatBuildTargetList(c)
  const CombatBuildTargetList = (c) => {
    BuildTargetList(CombatantCol(c), CombatantRow(c), 0x7F, 0xFF, CombatantSize(c), G.cm_Map);   // 3a00:38b0 .. 38e3
    st.n = G.tg_Count;                                                   // 3a00:38e8
    for (let i = 1; i <= st.n; i++) st.L[i] = { ...G.tg_List[i] };       // 3a00:38f3 .. 3938
  };
  // 3A00:394B NextTarget(step, draw): PChar
  const NextTarget = async (step, draw) => {
    if (draw !== 0) { st.px = G.cb_Col[st.L[st.cur].who]; st.py = G.cb_Row[st.L[st.cur].who]; }   // 3a00:3951 .. 3984
    else RedrawSquare(st.px, st.py);                                     // 3a00:39b3
    st.cur += sb(step);                                                  // 3a00:39ca
    if (st.cur === 0) st.cur = st.n;                                     // 3a00:39d5
    if (st.cur > st.n) st.cur = 1;                                       // 3a00:39f0
    const t = G.cb_Char[st.L[st.cur].who];                               // 3a00:3a0b
    st.nx = G.cb_Col[st.L[st.cur].who]; st.ny = G.cb_Row[st.L[st.cur].who];   // 3a00:3a38 / 3a65
    if (draw !== 0) {                                                    // 3a00:3a65
      await X.AnimateAlongPath(st.px, st.py, st.nx, st.ny, 1, 0);        // 3a00:3a98 move the cursor
      st.px = st.nx; st.py = st.ny;                                      // 3a00:3acb / 3adb
    }
    return t;                                                            // 3a00:3aeb
  };
  await X.CopyCombatAnimationFrame(0x19, 0, 0, 0);                       // 3a00:3b3e cursor frame
  clearTgt(tgt); ok.v = 0;                                               // 3a00:3b4f / 3b60
  let maxR = range;                                                      // 3a00:3b67
  if (maxR === 0xFF) {                                                   // 3a00:3b6e
    const w = att.readied ? att.readied[0] : null;
    maxR = w ? byte(ITT(itype(w), 0x0C) - 1) : 1;                        // 3a00:3b75 .. 3b9f
  }
  if (maxR === 0 || maxR === 0xFF) maxR = 1;                             // 3a00:3baa
  CombatBuildTargetList(att);                                            // 3a00:3bc4
  st.cur = 1;                                                            // 3a00:3bc8
  let t = await NextTarget(0, 1);                                        // 3a00:3bdb
  let skip = 1, move = 0, key = ' ';                                     // 3a00:3be7 / 3bec (move uninitialised: 0 here)
  while (ok.v === 0 && key !== '\0' && key !== 'E') {                    // 3a00:3bf1 .. 3c07 set CS:3AF7
    if (!await CanAttack(att, t)) t = await NextTarget(skip, 0);         // 3a00:3c11 / 3c30
    else {
      key = await TargetMenu(att, t, maxR, mode, allowEmpty, canTargetChar);   // 3a00:3c5f
      if (!G.menu_Ext) {                                                 // 3a00:3c66
        if (key === 'N') { skip = 1; move = 1; }                         // 3a00:3c74
        else if (key === 'P') { skip = -1; move = -1; }                  // 3a00:3c85 .. 3c8e
        else if ('MHPKGOQI'.includes(key) && key.length === 1) {         // 3a00:3c96 .. 3cb8
          await ManualAim(att, t, maxR, mode, allowEmpty, canTargetChar, ok, tgt);   // 3a00:3ce4
          await X.CopyCombatAnimationFrame(0x19, 0, 0, 0); CombatBuildTargetList(att); move = 0;   // 3a00:3cf3 .. 3d03
        } else if (key === 'T') {                                        // 3a00:3d0a
          await ConfirmTarget(att, t, mode, ok, tgt);                    // 3a00:3d2b
          await X.CopyCombatAnimationFrame(0x19, 0, 0, 0); CombatBuildTargetList(att); move = 0;   // 3a00:3d3a .. 3d4a
        } else if (key === 'C') { FocusSquare(CombatantCol(t), CombatantRow(t), 0, 8); move = 0; }   // 3a00:3d51 .. 3d7c
      } else if ('GHIKMOPQ'.includes(key) && key.length === 1) {         // 3a00:3d83 set CS:3B17
        await ManualAim(att, t, maxR, mode, allowEmpty, canTargetChar, ok, tgt);   // 3a00:3dbe
        await X.CopyCombatAnimationFrame(0x19, 0, 0, 0); CombatBuildTargetList(att); move = 0;   // 3a00:3dcd .. 3ddd
      }
      RedrawSquare(CombatantCol(t), CombatantRow(t));                    // 3a00:3dea .. 3dfe
      t = await NextTarget(move, (ok.v === 0 && key !== '\0' && key !== 'E') ? 1 : 0);   // 3a00:3e03 .. 3e2b
    }
  }
  if (mode !== 0) ClearRectangle(0, 0x17, 0x27, 0x17);                   // 3a00:3e39 / 3e3f
}

// 3A00:3E56 AutoTarget(c, range, ignoreBlock, fresh): Boolean
export async function AutoTarget(c, range, ignoreBlock, fresh) {
  let pass = 0, found = false, last = 0;                                 // 3a00:3e5c
  const t = c.combat.target;                                             // 3a00:3e68
  if (fresh !== 0 || (t && (t.b[0x197] === c.b[0x197] || t.b[0x196] === 0 || !await CanAttack(c, t))))   // 3a00:3e7c .. 3eb4
    c.combat.target = null;                                              // 3a00:3ebb
  if (c.combat.target) found = true;                                     // 3a00:3ecd
  while (!found && last === 0) {                                         // 3a00:3eec
    last = pass;                                                         // 3a00:3ef5
    if (pass !== 0 && fresh === 0) map()[6] = 1;                         // 3a00:3efb / 3f07
    let tries = 20;                                                      // 3a00:3f10
    let n = await X.CollectOppositeSideTargets(c, range);                // 3a00:3f14
    const F = foes();
    while (tries !== 0 && !found && n !== 0) {                           // 3a00:3f26
      tries--;                                                           // 3a00:3f41
      const r = await X.Roll(1, n);                                      // 3a00:3f44
      if (F[r] !== 0) {                                                  // 3a00:3f53
        const e = G.cb_Char[F[r]];                                       // 3a00:3f64
        if ((ignoreBlock !== 0 && map()[6] !== 0) || await CanAttack(c, e)) { found = true; c.combat.target = e; }   // 3a00:3f83 .. 3fc3
        else {
          F[r] = 0;                                                      // 3a00:3fd5
          for (let k = 1; k <= n; k++) if (F[k] !== 0) found = true;     // 3a00:3fe4
          if (found) found = false; else n = 0;                          // 3a00:3ffe
        }
      }
    }
    if (pass === 0) pass = 1;                                            // 3a00:4011
  }
  map()[6] = 0;                                                          // 3a00:401e
  return found;                                                          // 3a00:4027
}

// 3A00:403F EffEngulf(c, eff, event) — effect handler (monster special attack)
export async function EffEngulf(c, eff, event) {
  const tgt = c.combat.target;                                           // 3a00:4046
  if (slotHits()[1] === 2 && tgt && tgt.b[0x196] !== 0 &&               // 3a00:405a / 4064
      !await X.HasEffect(tgt, 0x3A, { v: null }) && !await X.HasEffect(tgt, 0x0D, { v: null })) {   // 3a00:4072 / 408c
    await X.ShowCharacterMessage(c, 'engulfs ' + name(tgt), 0x0C, 1);    // 3a00:40ba .. 40e0
    await X.AddEffect(tgt, 0x3A, 0, CombatantIndex(tgt), 0);             // 3a00:40e5 / 4100
    await X.CallEffectHandler(0x3A, tgt, null, 0);                       // 3a00:4105
    await X.AddEffect(tgt, 0x0D, 0, await X.Roll(2, 4), 0);              // 3a00:411c / 4137
    await X.AddEffect(c, 0x8B, 0, CombatantIndex(tgt), 1);               // 3a00:413c / 4157
  }
}

// 3A00:42FD EffEyeRays(c, eff, event) — effect handler (with the nested RayAnim 3A00:4162 / AcquireRayTarget 3A00:41CC)
export async function EffEyeRays(c, eff, event) {
  const st = { blocked: 0, range: { v: 0 }, tgt: null };
  // 3A00:4162 RayAnim(n)
  const RayAnim = async (n) => {
    await X.BuildFourAnimationFrames(n + 0x0D);                          // 3a00:4165
    await X.AnimateAlongPath(CombatantCol(c), CombatantRow(c), CombatantCol(st.tgt), CombatantRow(st.tgt), 1, 0x1E);   // 3a00:4173 .. 41c1
  };
  // 3A00:41CC AcquireRayTarget(fresh)
  const AcquireRayTarget = async (fresh) => {
    st.blocked = 1;                                                      // 3a00:41d2
    if (await AutoTarget(c, 0xFF, 0, fresh)) {                           // 3a00:41da
      const tx = { v: CombatantCol(c.combat.target) }, ty = { v: CombatantRow(c.combat.target) };   // 3a00:41fa / 4216
      if (TraceLine(CombatantCol(c), CombatantRow(c), tx, ty, st.range, G.cm_Map)) st.blocked = 0;   // 3a00:4232 .. 4278 (TODO(decode): parent's range local)
    }
  };
  let used = 0, tries = 4;                                               // 3a00:4303 / 4307
  c.combat.target = null;                                                // 3a00:430f
  await AcquireRayTarget(1);                                             // 3a00:4325
  const x = { v: 0 };
  do {
    st.tgt = c.combat.target;                                            // 3a00:4329
    const dist = st.tgt ? await X.TargetDistance(st.tgt, c) : 0;         // 3a00:433d
    tries--;                                                             // 3a00:4353
    if (st.tgt) {                                                        // 3a00:4356
      const tgt = st.tgt;
      if (dist < 3 && (used & 1) === 0) {                                // 3a00:4361 / 4367
        used |= 1;                                                       // 3a00:4370
        await X.ShowCharacterMessage(c, 'fires a disintegrate ray', 10, 1);   // 3a00:438d
        await RayAnim(5);                                                // 3a00:439c
        if (!await X.SavingThrow(tgt, 3, 0)) await X.KillCombatant(tgt, 8, 'is disintergrated');   // 3a00:43a0 .. 43cd
        await AcquireRayTarget(0);                                       // 3a00:43d6
      } else if (dist < 4 && (used & 2) === 0) {                         // 3a00:43da
        used |= 2;                                                       // 3a00:43e3
        await X.ShowCharacterMessage(c, 'fires a stone to flesh ray', 10, 1);   // 3a00:4409
        await RayAnim(10);                                               // 3a00:4418
        if (!await X.SavingThrow(tgt, 1, 0)) await X.KillCombatant(tgt, 7, 'is Stoned');   // 3a00:441c .. 4449
        await AcquireRayTarget(0);                                       // 3a00:4452
      } else if (dist < 5 && (used & 4) === 0) {                         // 3a00:4456
        used |= 4;                                                       // 3a00:445f
        await X.ShowCharacterMessage(c, 'fires a death ray', 10, 1);     // 3a00:4485
        await RayAnim(5);                                                // 3a00:4494
        if (!await X.SavingThrow(tgt, 0, 0)) await X.KillCombatant(tgt, 6, 'is killed');   // 3a00:4498 .. 44c5
        await AcquireRayTarget(0);                                       // 3a00:44ce
      } else if (dist < 6 && (used & 8) === 0) {                         // 3a00:44d2
        used |= 8;                                                       // 3a00:44db
        await X.ShowCharacterMessage(c, 'wounds you', 10, 1);            // 3a00:4501
        await RayAnim(5);                                                // 3a00:4510
        await X.DamageCharacter(tgt, byte((await X.RollDice(2, 8)) + 1), 0, 0);   // 3a00:4514 / 4525
        await AcquireRayTarget(0);                                       // 3a00:4538
      } else if ((used & 0x10) === 0) { await X.CastSpell(0x54, 1, 1, x); used |= 0x10; }   // 3a00:453e .. 455a
      else if ((used & 0x20) === 0) { await X.CastSpell(0x37, 1, 1, x); used |= 0x20; }     // 3a00:4564 .. 4580
      else if ((used & 0x40) === 0) { await X.CastSpell(0x15, 1, 1, x); used |= 0x40; }     // 3a00:458a .. 45a6
    }
  } while (tries !== 0 && c.combat.target);                              // 3a00:45ae .. 45c0
}

// 3A00:45CF EffEngulfHold(c, eff, event) — handler of effect 8Bh
export async function EffEngulfHold(c, eff, event) {
  G.hold_Victim = G.cb_Char[eff.b[3]];                                   // 3a00:45d5 +3 p3
  const v = G.hold_Victim;
  if (event === 0 && c.b[0x196] !== 0 && v && v.b[0x196] !== 0) {       // 3a00:45f1 .. 4606
    setAL(c, 1, 2); setAL(c, 2, 0); c.b[0x19E] = 2; c.b[0x1A0] = 8;      // 3a00:460e .. 463a
    const d = { v: 0 };
    await Attack(c, v, 1, null, d);                                      // 3a00:4683
    d.v = await X.ClearCombatantActionFlags(c);                          // 3a00:46a3
    if (v.b[0x196] === 0) {                                              // 3a00:46b1
      await X.RemoveEffect(c, 0x8B, null);                               // 3a00:46bd
      await X.RemoveEffect(v, 0x3A, null);                               // 3a00:46d1
      await X.RemoveEffect(v, 0x0D, null);                               // 3a00:46e7
    }
  } else {
    await X.RemoveEffect(v, 0x3A, null);                                 // 3a00:460e
    await X.RemoveEffect(v, 0x0D, null);                                 // 3a00:4624
    if (event === 0) { eff.b[4] = 0; await X.RemoveEffect(c, 0x8B, eff); }   // 3a00:4640 .. 4648
  }
}

// 3A00:4703 EffHugHold(c, eff, event) — handler of effect 90h
export async function EffHugHold(c, eff, event) {
  G.hold_Victim = G.cb_Char[eff.b[3]];                                   // 3a00:4709
  const v = G.hold_Victim;
  if (event === 0 && c.b[0x196] !== 0 && v && v.b[0x196] !== 0) {       // 3a00:4725 .. 473a
    setAL(c, 1, 1); setAL(c, 2, 0); c.b[0x19E] = 2; c.b[0x1A0] = 8;      // 3a00:4742 .. 476f
    const d = { v: 0 };
    await Attack(c, v, 1, null, d);                                      // 3a00:47a1
    d.v = await X.ClearCombatantActionFlags(c);                          // 3a00:47c1
    if (v.b[0x196] === 0) {                                              // 3a00:47cf
      await X.RemoveEffect(c, 0x90, null);                               // 3a00:47db
      await X.RemoveEffect(v, 0x3A, null);                               // 3a00:47ef
    }
  } else {
    await X.RemoveEffect(v, 0x3A, null);                                 // 3a00:4742
    if (event === 0) { eff.b[4] = 0; await X.RemoveEffect(c, 0x90, eff); }   // 3a00:475e .. 4766
  }
}

// 3A00:4811 EffHug(c, eff, event) — effect handler
export async function EffHug(c, eff, event) {
  if (G.AttackRollValue > 0x11) {                                        // 3a00:4818
    G.hold_Victim = c.combat.target;                                     // 3a00:4822
    const v = G.hold_Victim;
    await X.ShowCharacterMessage(c, 'hugs ' + name(v), 0x0C, 1);         // 3a00:4837 .. 485e
    await X.AddEffect(v, 0x3A, 0, CombatantIndex(v), 0);                 // 3a00:4863 / 4882
    await X.CallEffectHandler(0x3A, v, null, 0);                         // 3a00:4887
    await X.AddEffect(c, 0x90, 0, CombatantIndex(v), 1);                 // 3a00:48a0 / 48bd
  }
}

// 3A00:48DC GodsIntervene: Boolean (cheat: second command-line word = CopyProtWord 'Wooden')
export async function GodsIntervene() {
  if (ParamStr(2) !== (G.CopyProtWord ?? 'Wooden')) return false;        // 3a00:48e3 .. 48f6
  await X.ShowTimedBottomMessage('The Gods intervene!');                 // 3a00:4918
  for (let p = G.PartyList; p; p = p.next) {                             // 3a00:491d .. 4974
    if (p.b[0x197] === 1) {                                              // 3a00:4931
      p.b[0x196] = 0; p.b[0x195] = 6;                                    // 3a00:493c / 4945
      G.cb_Size[CombatantIndex(p)] = 0;                                  // 3a00:494e
    }
    await X.ClearCombatantActionFlags(p);                                // 3a00:4966
  }
  FocusSquare(sx8(map()[2]) + 3, sx8(map()[3]) + 3, 0xFF, 8);            // 3a00:4986 .. 49a6
  return true;
}

// 3A00:1D9D ov13_LoadDeps / 3A00:49B2 ov13_init: empty.
