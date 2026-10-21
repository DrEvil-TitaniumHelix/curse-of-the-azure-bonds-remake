// game/areas/combat_ov09.js — COMBAT ov09 (3100): combat AI, the turn of every computer-controlled combatant.
// Owner: cab-build-areas. Source: decode/pseudo/COMBAT.pas.md ov09 (verified); Pool twin ov09 4D00 (structure only).
// Re-read from decode/listings/ov09.lst:
//  - AiMoveAttack (3100:0e04..0ecf): done = [BP-2], going = [BP-3]; the fleeing loop runs AiMove while moveLeft > 0
//    (unsigned), initiative > 0 and < 14h (signed); after the 20-step limit (done := 1, going := not AiEndTurn) the body
//    still runs to the end of the pass.
//  - AiCanStep / AiMove (3100:0764): ai_DirOffsets is read at DS:02B6 + pattern*5 + try (= DS:02BC.. for pattern 1, try 1).
//  - AiWeaponScore (3100:1542): the 16-byte ITEMS copy at [BP-12h] gives dice +9, sides +0Ah, dmg_bonus +0Bh (signed,
//    JLE), rof +5, wflags2 +0Eh; it^.plus +32h is signed; Holy Water (type 55h) tests target +E9h signed > 0.
// ITEMS[t] = 16 bytes at ItemTypeTable DS:5CF6 + t*16: +0 slot, +1 hands, +5 rof, +9 dice, +0Ah sides, +0Bh dmg_bonus,
// +0Ch range, +0Dh usable_by, +0Eh wflags2. Item: +2Eh type, +32h plus, +34h readied, +36h magic flag, +3Dh power1,
// +3Eh power2. Combat record c.combat.b: +0 castingSpell, +1 mayCast, +2 mayUseItems, +3 initiative (signed; 14h = back
// to the player), +6 moveLeft, +9 facing, +10h turned, +11h hasTurned, +14h fleeing, +15h movePattern; target =
// c.combat.target. Character: +13h int, +1Eh.. memorised spells, +78h maxhp, +109h levels, +111h former levels, +11Bh
// alignment, +11Eh/+120h/+122h base damage dice/sides/bonus, +12Bh class mask, +185h hands used, +E5h level, +E6h,
// +E9h undead, +F7h npc_morale, +75h class, +195h status, +196h active, +197h side, +198h controlled, +1A4h hp.

import { G } from '../engine/state.js';
import { DrawText } from '../engine/text.js';
import { KeyPressed, ReadGameKey, FlushGameKeys } from '../engine/input.js';
import { view } from './view_ov30.js';
import { ClearMenuLine } from './view_ov26.js';
import { TraceLine } from './view_ov31.js';
import { IsVisible, ShowCombatant, ProbeMove, FocusSquare, CombatantCol, CombatantRow } from './view_ov32.js';
import { X } from './view_link.js';

const CB = (c) => c.combat.b;
const sb = (v) => ((v & 0xFF) ^ 0x80) - 0x80;
const byte = (v) => v & 0xFF;
const ds = (o) => G.ds[o & 0xFFFF];
const ITEM = (t, o) => ds(0x5CF6 + (t & 0xFF) * 16 + o);                 // ItemTypeTable[t]
const SPELL = (s, o) => ds(0x37DA + (s & 0xFF) * 16 + o);                // spells_Table[s]
const terrCost = (t) => ds(0x26A2 + t * 4);                              // CombatTerrain[t].cost
const DIR_OFS = [0, 0, 0, 0, 0, 0, 8, 7, 6, 1, 2, 8, 1, 2, 7, 6, 7, 1, 8, 6, 2, 1, 7, 8, 2, 6, 8, 7, 6, 5, 4, 8, 1, 2, 3, 4];   // index pattern*5 + try (pattern 1..6, try 1..5)
const dirOfs = (i) => (G.ds ? ds(0x02B6 + i) : DIR_OFS[i]);   // 3100:0764 MOV AL,[DI+2B6h]: bytes DS:02BC..02D9
const readied = (c, k) => (c.readied ? c.readied[k] ?? null : null);
const has = async (c, t) => !!(await X.HasEffect(c, t, { v: null }));

// 3100:004D AiCombatTurn(c)
export async function AiCombatTurn(c) {
  const cb = CB(c);
  let done = await CheckCombatHotkeys(c);                                // 3100:0053
  ClearMenuLine();                                                       // 3100:0060
  await X.ClearCharacterMessage();                                       // 3100:0065
  if (c.b[0x196] === 0) done = !!(await X.ClearCombatantActionFlags(c)); // 3100:006a / 0075
  let pat = cb[0x15];                                                    // 3100:0083
  if (pat === 0 || pat > 4 || await X.Roll(1, 4) === 1) {                // 3100:0092 / 009e
    pat = await X.Roll(1, 8);                                            // 3100:00ad
    if (pat === 8) pat = byte((await X.Roll(1, 2)) + 4);                 // 3100:00bb / 00c1
    else pat = await X.Roll(1, 4);                                       // 3100:00d6
  }
  cb[0x15] = pat;                                                        // 3100:00e4
  if (!done) done = await AiMoraleCheck(c);                              // 3100:00f3 / 00f9
  if (cb[0x14] !== 0 && cb[0x10] === 0) await X.ShowCharacterMessage(c, 'flees in panic', 10, 1);   // 3100:0106 .. 0139
  if (done) return;                                                      // 3100:0144
  if (await AiTryUseMagicItem(c)) done = !!(await X.ClearCombatantActionFlags(c));   // 3100:014d / 015b
  else if (cb[0] !== 0) {                                                // 3100:016c
    const d = { v: done };
    await X.CastSpell(cb[0], 1, 1, d);                                   // 3100:017a
    done = !!(await X.ClearCombatantActionFlags(c));                     // 3100:0196
  } else if (await AiTryTurnUndead(c)) done = !!(await X.ClearCombatantActionFlags(c));   // 3100:01a7 / 01b5
  else if (!await AiTryCastSpell(c)) {                                   // 3100:01c6
    await AiReadyBestWeapon(c);                                          // 3100:01da
    done = await CheckCombatHotkeys(c);                                  // 3100:01e4
    while (!done) {                                                      // 3100:01f1
      if (await X.AutoTarget(c, 0xFF, 1, 0) && sb(cb[3]) > 0 && c.b[0x196] !== 0)   // 3100:01f7 / 020f / 021e
        done = await AiMoveAttack(c);                                    // 3100:0229
      else done = await AiEndTurn(c);                                    // 3100:0238
    }
  }
}

// 3100:024D AiTryTurnUndead(c)
export async function AiTryTurnUndead(c) {
  const u = { v: null };
  if (CB(c)[0x11] === 0 && (sb(c.b[0x109]) > 0 || sb(c.b[0xE6]) < sb(c.b[0x111])) &&   // 3100:0253 .. 0275 (M)
      await X.FindTurnTarget(c, u)) {                                    // 3100:027f
    await X.TurnUndead(c);                                               // 3100:0297
    return true;                                                         // 3100:0293
  }
  return false;                                                          // 3100:02a4
}

// 3100:02B1 AreaHitsFriend(x, y, spell) (nested in AiSpellUseful)
async function AreaHitsFriend(x, y, spell) {
  let r = false;                                                         // 3100:02b7
  const bonus = G.SelectedChar.b[0x197] === 0 ? -2 : 8;                  // 3100:02bb .. 02cd
  const { BuildTargetList } = await import('./view_ov31.js');
  BuildTargetList(x, y, SPELL(spell, 0x0F), 0xFF, 1, G.cm_Map);          // 3100:02d1
  const own = (await X.IsSideZero(G.SelectedChar)) ? 1 : 0;
  for (let i = 1; i <= G.tg_Count; i++) {                                // 3100:02fe .. 030e
    const who = G.tg_List[i].who;                                        // 3100:0325
    const f = G.cb_Char[who];
    if (f.b[0x197] !== own && SPELL(spell, 8) !== 1 &&                   // 3100:0316 / 0346 / 034a
        !await X.SavingThrow(f, SPELL(spell, 9), bonus)) r = true;       // 3100:035c / 0399
  }
  return r;
}

// 3100:03B1 AiSpellUseful(c, spell, minValue)
export async function AiSpellUseful(c, spell, minValue) {
  if (SPELL(spell, 0x0D) < minValue) return false;                       // 3100:03bb
  if ((spell === 3 || SPELL(spell, 0x0E) !== 0) &&                       // 3100:03d2 / 03d8
      (spell !== 3 || !await X.FindHealTarget(c, { v: null }))) {        // 3100:03ea / 03f0
    const n = await X.CollectOppositeSideTargets(c, await X.SpellRange(spell));   // 3100:040b / 041b
    if (n === 0) return false;                                           // 3100:0420
    if (SPELL(spell, 0x0F) === 0) return true;                           // 3100:0429 / 043b
    for (let i = 1; i <= n; i++) {                                       // 3100:0441
      const w = G.foe_List[i];
      if (await AreaHitsFriend(G.cb_Col[w], G.cb_Row[w], spell)) return false;   // 3100:048b / 0493
    }
    return true;                                                         // 3100:049d
  }
  return true;                                                           // 3100:0404
}

// 3100:04AA AiTryUseMagicItem(c)
export async function AiTryUseMagicItem(c) {
  let chosen = null, minValue = 7;                                       // 3100:04b0 .. 04c2
  const passes = await X.Roll(1, 7);                                     // 3100:04c0
  const act = G.side_ActiveCount || [0, 0];
  if (CB(c)[2] !== 0 && act[(await X.IsSideZero(c)) ? 1 : 0] !== 0 &&    // 3100:04ce / 04e0
      view.mem(0x4BE5) === 0 && passes !== 0) {                          // 3100:04f8 / 0504
    for (let pass = 1; pass <= passes; pass++) {                         // 3100:050d
      for (let it = c.items; it && !chosen; it = it.next) {              // 3100:051f .. 05c0
        let sp = it.b[0x3D];                                             // 3100:0545
        if (!await X.IsScroll(it) && it.b[0x3E] < 0x80 && it.b[0x34] !== 0 && sp !== 0) {   // 3100:0565 .. 0594
          if (sp > 0x38) sp = byte(sp - 0x17);                           // 3100:058e / 0594
          if (await AiSpellUseful(c, sp, minValue)) chosen = it;         // 3100:059f / 05b5
        }
      }
      minValue = byte(minValue - 1);                                     // 3100:05d2
    }
  }
  if (chosen) { await X.UseItem(chosen, { v: 0 }); return true; }        // 3100:05e0 / 05e8 / 05f8
  return false;
}

// 3100:0605 AiTryCastSpell(c)
export async function AiTryCastSpell(c) {
  const list = [];                                                       // 3100:060b
  if (CB(c)[1] !== 0)                                                    // 3100:060f
    for (let k = 1; k <= 83; k++) if (c.b[0x1E + k] !== 0) list.push(c.b[0x1E + k]);   // 3100:061e .. 0650
  let chosen = 0, minValue = 7;                                          // 3100:0659 / 065d
  const passes = await X.Roll(1, 7);                                     // 3100:0661
  let pass = 1;                                                          // 3100:066f
  const act = G.side_ActiveCount || [0, 0];
  if (list.length !== 0 && (c.b[0xF7] > 0x7F || G.MagicOn !== 0) &&     // 3100:0673 / 067c / 0687
      act[(await X.IsSideZero(c)) ? 1 : 0] !== 0) {                      // 3100:068e
    while (pass <= passes && chosen === 0) {                             // 3100:06a3
      let k = 1;                                                         // 3100:06b1
      while (k < 4 && chosen === 0) {                                    // 3100:06b5
        const pick = list[(await X.Roll(1, list.length)) - 1];           // 3100:06c1
        if (await AiSpellUseful(c, pick, minValue)) chosen = pick;       // 3100:06e0 / 06f6
        k++;                                                             // 3100:06fc
      }
      minValue = byte(minValue - 1); pass++;                             // 3100:0701 / 0704
    }
  }
  if (chosen === 0) return false;                                        // 3100:0709
  const r = { v: false };
  await X.BeginCast(chosen, 1, r);                                       // 3100:070f
  return !!r.v;
}

// 3100:0735 AiCanStep(c, try, baseDir, var blocked)
export async function AiCanStep(c, tryN, baseDir, blocked) {
  const cb = CB(c);
  blocked.v = false;                                                     // 3100:073b
  const dir = (dirOfs(cb[0x15] * 5 + tryN) + baseDir) % 8;               // 3100:0742 / 0762
  const occ = { v: 0 }, tile = { v: 0 }, h1E = { v: 0 }, h1C = { v: 0 };
  ProbeMove(c, dir, occ, tile, h1E, h1C);                                // 3100:0783
  if (tile.v === 0) { blocked.v = true; return false; }                  // 3100:07a6 / 07ac
  if (terrCost(tile.v) === 0xFF) return false;                           // 3100:07b6 new: impassable
  let cost = (dir & 1) ? byte(terrCost(tile.v) * 3) : byte(terrCost(tile.v) * 2);   // 3100:07c8 .. 07ef
  if (occ.v === 0 && cost < cb[6]) {                                     // 3100:0807 / 0810
    if (h1E.v && !await has(c, 0x20) && !await has(c, 0x1E) && !await has(c, 0x6F) &&   // 3100:0824 .. 0861
        !await has(c, 0x7D) && !await has(c, 0x81) && !await has(c, 0x3F) &&           // 3100:0878 .. 08a6
        cb[0x10] === 0 && !await X.SavingThrow(c, 0, 0))                  // 3100:08bd / 08cc
      cost = byte(cb[6] + 1);                                            // 3100:08e1
    if (h1C.v && c.b[0xE5] < 7 && !await has(c, 0x81) && !await has(c, 0x6F) &&       // 3100:08f3 .. 0921
        !await has(c, 0x85) && cb[0x10] === 0 && !await has(c, 0x7D))    // 3100:0938 .. 095e
      cost = byte(cb[6] + 1);                                            // 3100:0975
    if (cost <= cb[6]) return true;                                      // 3100:0987 / 0998
  }
  return false;
}

// 3100:09C7 AiMove(c)
export async function AiMove(c) {
  const cb = CB(c);
  DrawText(0, 24, 10, 0, 'Move/Attack, Move Left = ' + (await X.ByteToStr(cb[6] >> 1)) + ' ');   // 3100:09ce .. 0a19
  if (await CheckCombatHotkeys(c)) return;                               // 3100:0a1e
  if ((cb[6] >> 1) > 0 && sb(cb[3]) > 0 &&                               // 3100:0a2f / 0a4a
      (c.b[0xF7] < 0x80 || G.enemy_HpPercent <= G.morale_Value + await X.Roll(1, 100) || c.b[0x197] === 1) &&   // 3100:0a5c .. 0a9c
      !(cb[0x14] === 0 && !readied(c, 2) && c.b[0x75] === 5)) {          // 3100:0aa1 .. 0acc
    let dir;
    if (cb[0x14] === 0) dir = await X.DirectionTo(c, c.combat.target);   // 3100:0acc / 0adb
    else {
      cb[0x15] = await X.Roll(1, 2);                                     // 3100:0afb
      dir = byte(G.party_Dir - (((G.party_Dir + 2) % 4) >> 1));          // 3100:0b12
      if (c.b[0x197] === 0) dir = byte(dir + 4);                         // 3100:0b33 / 0b3e
      dir %= 8;                                                          // 3100:0b49
    }
    const blocked = { v: false };
    let stop = false, i = 1, newDir = 8;                                 // 3100:0b58 .. 0b60
    while (i < 6 && !stop && !await AiCanStep(c, i, dir, blocked)) {     // 3100:0b64 / 0b70
      if (cb[0x14] !== 0 && blocked.v) stop = !!(await X.Flee(c));       // 3100:0b8b / 0ba0
      else i++;                                                          // 3100:0bb0
    }
    if (stop) {                                                          // 3100:0bb5
      cb[6] = 0; cb[0x14] = 0;                                           // 3100:0bbb / 0bc8
      stop = !!(await X.ClearCombatantActionFlags(c));                   // 3100:0bd5
    } else {
      newDir = (dirOfs(cb[0x15] * 5 + i) + dir) % 8;                     // 3100:0be6
      if (i === 6 || (newDir + 4) % 8 === G.ai_LastStepDir) {            // 3100:0c1d / 0c23
        G.ai_StuckCount = byte(G.ai_StuckCount + 1);                     // 3100:0c40
        cb[0x15] = cb[0x15] % 6 + 1;                                     // 3100:0c44
        if (G.ai_StuckCount > 1) {                                       // 3100:0c66
          c.combat.target = null;                                        // 3100:0c6d
          if (G.ai_StuckCount < 3) {                                     // 3100:0c7f
            if (!await X.AutoTarget(c, 0xFF, 1, 0)) stop = await AiEndTurn(c);   // 3100:0c99 / 0cb1
          } else { cb[6] = 0; stop = true; }                             // 3100:0c86 / 0c93
        }
      }
      if (i < 6) G.ai_LastStepDir = newDir; else stop = true;            // 3100:0cbe / 0cc4 / 0ccc
    }
    if (!stop) {                                                         // 3100:0cd0
      G.combat_Visible = (G.ai_InReach !== 0 || IsVisible(c, false) || c.b[0x197] === 0) ? 1 : 0;   // 3100:0cd9 .. 0d03
      ShowCombatant(c, newDir, 0, false);                                // 3100:0d06
      await X.AttacksOfOpportunity(c, cb[9]);                            // 3100:0d1b
      if (c.b[0x196] === 0) await X.ClearCombatantActionFlags(c);        // 3100:0d33 / 0d3e
      else {
        if (cb[6] !== 0) await X.StepCombatant(c, cb[9]);                // 3100:0d4e / 0d5d
        if (c.b[0x196] === 0) stop = !!(await X.ClearCombatantActionFlags(c));   // 3100:0d75 / 0d80
        await X.StinkingCloudCheck(c, 1);                                // 3100:0d8e
      }
    }
  } else await AiEndTurn(c);                                             // 3100:0d9e
}

// 3100:0DB1 AiMoveAttack(c): true = the turn is over
export async function AiMoveAttack(c) {
  const cb = CB(c);
  G.ai_LastStepDir = 8; G.ai_StuckCount = 0; G.g_47F2 = 0;               // 3100:0db7 .. 0dc1
  let steps = 0, going = true, done = false;                             // 3100:0dc6 .. 0dce
  await X.CallEffectHooks(0x0E, c);                                      // 3100:0dd2
  if (c.b[0x197] === 0 && await X.BandageDying(1)) cb[3] = 0;            // 3100:0de0 / 0deb / 0df7 new
  if (cb[3] === 0) going = false;                                        // 3100:0e04
  while (!done && going) {                                               // 3100:0e17 / 0e20
    if (cb[0x14] !== 0)                                                  // 3100:0e29
      while (cb[6] !== 0 && sb(cb[3]) > 0 && sb(cb[3]) < 0x14) await AiMove(c);   // 3100:0e38 .. 0e6c
    if (cb[3] === 0 || cb[3] === 0x14) going = false; else done = false; // 3100:0e71 .. 0e95
    if (done || !going) continue;                                        // 3100:0e99 / 0ea2
    steps++;                                                             // 3100:0eab
    if (steps > 20) { done = true; going = !await AiEndTurn(c); }        // 3100:0eae .. 0ecc
    G.ai_InReach = 0;                                                    // 3100:0ecf
    let range = 1;                                                       // 3100:0ed4
    if (readied(c, 0)) range = byte(ITEM(readied(c, 0).b[0x2E], 0x0C) - 1);   // 3100:0ed8 / 0ee7
    if (range === 0 || range === 0xFF) range = 1;                        // 3100:0f05 / 0f0b
    let tgt = c.combat.target;                                           // 3100:0f15
    if (!tgt || tgt.b[0x196] === 0 || tgt.b[0x197] === 0) tgt = null;    // 3100:0f29 .. 0f3f (fields read even when nil)
    if (tgt && await X.CanAttack(c, tgt)) {                              // 3100:0f47 / 0f52
      const tx = { v: CombatantCol(tgt) }, ty = { v: CombatantRow(tgt) };   // 3100:0f6a / 0f78
      const dist = { v: range };                                         // 3100:0f86
      G.cm_Map.b[6] = 0;                                                 // 3100:0f8e new
      if (TraceLine(CombatantCol(c), CombatantRow(c), tx, ty, dist, G.cm_Map) && (dist.v >> 1) <= range)   // 3100:0f97 .. 0fd9
        G.ai_InReach = 1;                                                // 3100:0fe4
    }
    if (G.ai_InReach === 0) {                                            // 3100:0fe9
      const n = await X.CollectOppositeSideTargets(c, range);            // 3100:0ff3
      if (n === 0) {
        if (await X.AutoTarget(c, 0xFF, 0, 0)) await AiMove(c); else done = await AiEndTurn(c);   // 3100:100b / 1023 / 102f
      } else {
        const k = await X.Roll(1, n);                                    // 3100:103f
        tgt = G.cb_Char[G.foe_List[k]];                                  // 3100:104e
        if (await X.WeaponIsRanged(c) && !await X.ov24_305B(c) && (await X.CollectOppositeSideTargets(c, 1)) !== 0) {   // 3100:106d / 107c / 108b
          await AiReadyBestWeapon(c); done = true;                       // 3100:109d / 10a7
        } else if ((await X.TargetDistance(c, tgt)) === 1 || await X.CanAttack(c, tgt))   // 3100:10ad / 10c2
          G.ai_InReach = 1;                                              // 3100:10d7
      }
    }
    if (G.ai_InReach !== 0) {                                            // 3100:10dc
      FocusSquare(CombatantCol(c), CombatantRow(c), 2, await X.DirectionTo(c, tgt));   // 3100:10e3 .. 1110
      if (await X.FighterSweep(c, tgt)) done = !!(await X.ClearCombatantActionFlags(c));   // 3100:111f / 1134
      else {
        await X.FaceAttacker(c, tgt);                                    // 3100:1145
        const ammo = { v: null };                                        // 3100:1156
        if (await X.WeaponIsRanged(c)) {                                 // 3100:115e
          G.ai_InReach = (await X.GetMissileAmmo(c, ammo)) ? 1 : 0;      // 3100:116d
          if (await X.ov24_305B(c) && (await X.TargetDistance(c, tgt)) === 1) ammo.v = null;   // 3100:1180 / 118f
        }
        const d = { v: done };
        await X.Attack(c, tgt, 0, ammo.v, d);                            // 3100:11ac
        done = !!d.v;
        if (done) going = false;                                         // 3100:11cb / 11d7
        else if (tgt.b[0x196] === 0) done = true;                        // 3100:11d7 / 11e9
      }
    }
  }
  return !going;                                                         // 3100:11e9 .. 11f5
}

// 3100:1201 AiEndTurn(c)
export async function AiEndTurn(c) {
  await X.ClearCharacterMessage();                                       // 3100:1207
  if (!await X.IsHelpless(c) && !await X.WeaponIsRanged(c) && CB(c)[3] !== 0)   // 3100:120c / 121b / 122a
    return !!(await X.SetGuarding(c));                                   // 3100:1249
  return !!(await X.ClearCombatantActionFlags(c));                       // 3100:1239
}

// 3100:1273 CheckCombatHotkeys(c)
export async function CheckCombatHotkeys(c) {
  let r = false;                                                         // 3100:1279
  if (KeyPressed()) {                                                    // 3100:127d
    let key = await ReadGameKey();                                       // 3100:1289
    if (key === '\0') key = await ReadGameKey();                         // 3100:1291 / 1297
    if (key === '2') {                                                   // 3100:129f
      G.MagicOn = G.MagicOn ? 0 : 1;                                     // 3100:12a6
      await X.ShowTimedBottomMessage(G.MagicOn ? 'Magic On' : 'Magic Off');   // 3100:12bd .. 12e2
    } else if (key === ' ') {                                            // 3100:12e7
      for (let p = G.PartyList; p; p = p.next)                           // 3100:12ed .. 1320
        if (p.b[0xF7] < 0x80 && p.b[0x195] !== 1) p.b[0x198] = 0;        // 3100:1301 / 130c / 1317
      if (c.b[0x198] === 0) { CB(c)[3] = 0x14; r = true; }               // 3100:1332 / 133d / 134a
    } else if (key === '-') await X.GodsIntervene();                     // 3100:134e / 1354
  }
  await FlushGameKeys();                                                 // 3100:135d
  return r;
}

// 3100:1388 AiMoraleCheck(c)
export async function AiMoraleCheck(c) {
  const cb = CB(c);
  cb[0x14] = 0;                                                          // 3100:1392
  await X.ov23_1603(c);                                                  // 3100:139f remove effects 4Ah / 4Bh
  if (cb[0x10] !== 0) {                                                  // 3100:13aa
    cb[0x14] = 1;                                                        // 3100:13b9
    await X.ShowCharacterMessage(c, 'is forced to flee', 10, 1);         // 3100:13db
    return false;
  }
  if (c.b[0xF7] <= 0x7F) return false;                                   // 3100:13e9
  G.morale_Value = byte(c.b[0xF7] << 1);                                 // 3100:13f7
  if (G.morale_Value > 0x66) G.morale_Value = 0;                         // 3100:1408 / 140f
  await X.CallEffectHooks(0x11, c);                                      // 3100:1414
  const hpPct = 100 - Math.trunc(c.b[0x1A4] * 100 / (c.b[0x78] || 1));  // TODO(decode): maxhp 0 divides by zero in the original
  if (G.morale_Value >= hpPct && G.morale_Value !== 0) return false;     // 3100:1422 .. 1451 signed
  G.morale_Value = G.enemy_HpPercent;                                    // 3100:145b
  await X.CallEffectHooks(0x11, c);                                      // 3100:1467
  if (G.morale_Value >= ((100 - view.mem(0x7EC6)) & 0xFFFF) && G.morale_Value !== 0 && c.b[0x197] !== 0) return false;   // 3100:1475 .. 1496 unsigned
  if ((await X.MaxEnemyMove(c)) > ((await X.CalcMove(c)) >> 1)) {        // 3100:14a1 / 14af
    if (c.b[0x13] > 5) {                                                 // 3100:14ba
      await X.RemoveFromCombat(c, 4, 'Surrenders');                      // 3100:1526
      return !!(await X.ClearCombatantActionFlags(c));                   // 3100:152b
    }
  } else {
    cb[0x14] = 1;                                                        // 3100:14cd
    await X.RemoveEffect(c, 0x4A, null);                                 // 3100:14da
    await X.RemoveEffect(c, 0x4B, null);                                 // 3100:14ee
  }
  return false;
}

// 3100:1542 AiWeaponScore(c, it)
export function AiWeaponScore(c, it) {
  const t = it.b[0x2E];                                                  // 3100:1548 CopyBytes 16
  let s = byte(ITEM(t, 9) * ITEM(t, 0x0A));                              // 3100:156b
  if (sb(it.b[0x32]) > 0) s = byte(s + sb(it.b[0x32]) * 8);              // 3100:157c / 1586
  if (sb(ITEM(t, 0x0B)) > 0) s = byte(s + sb(ITEM(t, 0x0B)) * 2);        // 3100:159f / 15a5
  const tg = c.combat ? c.combat.target : null;
  if (t === 0x55 && tg && sb(tg.b[0xE9]) > 0) s = 8;                     // 3100:159f .. 15df holy water vs undead
  if ((ITEM(t, 0x0E) & 8) !== 0) s = byte(s + (ITEM(t, 5) - 1) * 2);     // 3100:15eb / 15f4
  if (ITEM(t, 1) <= 1) s = byte(s + 3);                                  // 3100:1608 / 160e
  if (c.b[0x185] + ITEM(t, 1) > 3) s = 0;                                // 3100:1619 / 1631
  if (it.b[0x3E] === 0x84 && (it.b[0x3D] & 0x0F) !== c.b[0x11B]) s = 0;  // 3100:1635 .. 164b
  if (it.b[0x3D] === 0x53) s = 0;                                        // 3100:1656
  if (it.b[0x36] !== 0) s = 0;                                           // 3100:1660 / 1664
  return s;                                                              // 3100:166e
}

// 3100:1681 AiReadyBestWeapon(c)
export async function AiReadyBestWeapon(c) {
  const R = (k) => readied(c, k);
  const hands = (it) => ITEM(it.b[0x2E], 1);
  if (R(0)) c.b[0x185] = byte(c.b[0x185] - hands(R(0)));                 // 3100:1687 / 1696
  if (R(1)) c.b[0x185] = byte(c.b[0x185] - hands(R(1)));                 // 3100:16c6 / 16d5
  let bestMissile = null, bestMelee = null, bestShield = null;           // 3100:1705 .. 1715
  let missileScore = 1;                                                  // 3100:171d
  let meleeScore = byte(c.b[0x120] * c.b[0x11E]);                        // 3100:1721
  if (sb(c.b[0x122]) > 0) meleeScore = byte(meleeScore + sb(c.b[0x122]) * 2);   // 3100:173c / 1747
  let shieldScore = 0;                                                   // 3100:175e
  for (let it = c.items; it; it = it.next) {                             // 3100:1762 .. 18a0
    const t = it.b[0x2E];
    if (ITEM(t, 0) === 0 && (ITEM(t, 0x0D) & c.b[0x12B]) !== 0) {        // 3100:1787 / 179c
      const s = AiWeaponScore(c, it);                                    // 3100:17ba
      if ((ITEM(t, 0x0E) & 8) !== 0 || (ITEM(t, 0x0E) & 0x10) !== 0)     // 3100:17cd / 17e2
        if (s > missileScore) { bestMissile = it; missileScore = s; }    // 3100:17f7 / 17ff
      if ((ITEM(t, 0x0E) & 8) === 0 && s > meleeScore) { bestMelee = it; meleeScore = s; }   // 3100:1810 / 182d
    }
    if (ITEM(t, 0) === 1 && (ITEM(t, 0x0D) & c.b[0x12B]) !== 0) {        // 3100:183e / 1850
      const s = sb(it.b[0x32]) < 0 ? 0 : byte(sb(it.b[0x32]) + 1);       // 3100:186b .. 1883
      if (s > shieldScore) { bestShield = it; shieldScore = s; }         // 3100:1887 / 188f
    }
  }
  const throwable = !!bestMissile && ITEM(bestMissile.b[0x2E], 0x0C) >= 2 &&   // 3100:18b2 .. 18f3
    (ITEM(bestMissile.b[0x2E], 0x0E) & 0x14) === 0x14;
  let canShoot = false, ammo = null, fl = 0;                             // 3100:18f7 .. 18ff
  if (bestMissile) {                                                     // 3100:1903
    fl = ITEM(bestMissile.b[0x2E], 0x0E);                                // 3100:190b
    if ((fl & 0x10) !== 0) ammo = bestMissile;                           // 3100:1921 / 192a
    if ((fl & 8) !== 0) {                                                // 3100:1935
      if ((fl & 1) !== 0) ammo = R(11);                                  // 3100:193e / 1947
      if ((fl & 0x80) !== 0) ammo = R(12);                               // 3100:1957 / 1960
    }
  }
  if (ammo || fl === 0x0A) canShoot = true;                              // 3100:1970 / 197e
  let chosen;
  if (bestMissile && missileScore > (meleeScore >> 1) && canShoot &&     // 3100:1982 .. 19a6
      (throwable || (await X.CollectOppositeSideTargets(c, 1)) === 0)) chosen = bestMissile;   // 3100:19ac / 19cb
  else chosen = bestMelee;                                               // 3100:19be
  let changed = false, ok = true;                                        // 3100:19d6
  if (R(0) && (R(0) === chosen || R(0).b[0x36] !== 0)) ok = false;       // 3100:19de .. 1a14
  if (ok) {                                                              // 3100:1a14
    if (R(0)) await X.ReadyItem(R(0));                                   // 3100:1a1d / 1a2c un-ready
    await X.RecalcItems(c);                                              // 3100:1a3e
    if (R(1) && R(1).b[0x36] === 0) c.b[0x185] = byte(c.b[0x185] - hands(R(1)));   // 3100:1a49 .. 1a67
    if (chosen) await X.ReadyItem(chosen);                               // 3100:1a97 / 1a9f
    changed = true;                                                      // 3100:1aaa
  }
  await X.RecalcItems(c);                                                // 3100:1aae
  await X.CalcAttacks(c);                                                // 3100:1ab9
  ok = true;                                                             // 3100:1ac4
  if (R(1) && (R(1) === bestShield || R(1).b[0x36] !== 0)) ok = false;   // 3100:1ac8 .. 1afe
  if (c.b[0x185] < 3) {                                                  // 3100:1afe
    if (c.b[0x185] < 2 && ok) {                                          // 3100:1b50 / 1b5b
      if (R(1)) await X.ReadyItem(R(1));                                 // 3100:1b61 / 1b70
      await X.RecalcItems(c);                                            // 3100:1b82
      if (bestShield) await X.ReadyItem(bestShield);                     // 3100:1b8d / 1b95
      changed = true;                                                    // 3100:1ba0
    }
  } else {
    if (!R(1) || R(1).b[0x36] !== 0) await X.ReadyItem(chosen);          // 3100:1b09 .. 1b27
    else await X.ReadyItem(R(1));                                        // 3100:1b38
    changed = true;                                                      // 3100:1b32 / 1b4a
  }
  await X.RecalcItems(c);                                                // 3100:1ba4
  if (changed) await X.DrawCharacterSummary(c);                          // 3100:1baf / 1bb5
}

// 3100:0000 ov09_LoadDeps / 3100:1BC6 ov09_init: empty.
