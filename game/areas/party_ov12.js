// game/areas/party_ov12.js — PARTY ov12 (3600): the active-effect handlers and InstallEffectHandlers.
// Owner: cab-build-areas. Source: decode/pseudo/PARTY.pas.md ov12 (3600:0000..356C); evidence decode/listings/ov12.lst.
// Structure as Pool's areas/party_ov12.js (5C00); the bodies are Curse's (many types are redefined, 8Ch..93h are new).
// Re-read from the listing:
//  - EffCloud9Removed (3600:1cf6..1fc1, summarised in the pseudocode): node layout as the 4-square cloud, squares k = 1..9
//    with the steps step_dx/dy[CloudDirs9 DS:27DB + k], ground[k] at +7+k, active[k] at +10h+k; bodies -> tile 1Fh, else
//    the saved ground; unlink as EffCloudRemoved; the remaining 3x3 clouds are re-marked with tile 1Ch.
//  - EffBerserk / EffTurnOnAllies (3600:189f / 2bc7): the new target is cb_Char[byte DS:6E9A] = cb_Char[tg_List[2].who]
//    (the second entry of the sorted target list; entry 1 is the combatant itself at distance 0).
// Handler ABI (COMBAT ov23 CallEffectHandler 5F00:00C9): G.EffectHandler[type] = async (c, e, mode); c = the owner, e = the
//   9-byte effect { b: Uint8Array(9), next } (type +0, duration +1 word, p3 +3, callOnRemove +4) — for type 93h the item
//   { b: Uint8Array(3Fh), next } — mode 0 = hook event, 1 = removed. Nil slots 56h, 58h, 5Ah, 80h, 83h, 84h stay null;
//   39h, 57h, 60h, 8Bh, 90h are COMBAT handlers, bound by published name through view_link.js.
// Hook globals are raw bytes in G (SaveRoll 6F92, EffectToApply 6F93, DamageAmount 6F94, DamageType 6F95, StatValue 6F96,
//   sp_Current 6F97, LastDiceCount 6F98, StatKind 6F9A, AttackBlocked 6F9B, cure_InProgress 6F9C, SpellArea 6F9D,
//   AttackRollValue 6F9F, SlotHits 6FA0, morale_Value 6FA2, hold_Victim 6FA3 (JS ref), SaveType 6FA7, SaveResult 6FA8).
// Combat record cr(c) = c.combat = { b: Uint8Array(16h), target }: +0 spell being prepared, +1 mayCast, +2 mayUseItems,
//   +3 initiative, +6 moveLeft, +0Eh dying counter, +10h turned; the far pointer +0Ah is the JS reference `target`.
//   A nil combatant (outside combat) reads as an all-zero stand-in, as Pool (#r3-1).
// Readied items: c.readied[0..12] (TChar +151h far pointers, JS refs; 0 = weapon). Cloud nodes (cloud_List DS:755B,
//   cloud9_List DS:755F): { owner, next, ground[1..9], active[1..9], x, y, id } (1Eh bytes in the original).
//   corpse_List[k] = { char, col, row, tile } (view_ov32.js). Spell table bytes at DS:37DB + 16*sp (level) and
//   DS:37E2 + 16*sp (MAGIC InitSpellTable); ItemTypeTable wflags at DS:5CFD + 16*type (ENGINE ov11 ITEMS load).

import { G, newChar, newItem } from '../engine/state.js';
import { MessageDelay } from '../engine/text.js';
import { X } from './view_link.js';
import { variant } from '../engine/variant.js';                      // cab: v13-3

// TChar fields (PARTY.pas.md ## Character record)
const STR = 0x11, INT = 0x13, WIS = 0x15, CON = 0x19, RACE = 0x74, AGE = 0x76, HP_MAX = 0x78, FIGHTER_LVL_EFF = 0xDD,
  SIZE = 0xDE, BASE_MOVE = 0xE4, LEVEL_MAIN = 0xE5, UNDEAD = 0xE9, NPC_MORALE = 0xF7, LEVEL = 0x109, OLD_LEVEL = 0x111,
  CREATURE_TYPE = 0x11A, ALIGNMENT = 0x11B, KIND_FLAGS = 0x14B, ITEM_COUNT = 0x14C, CURES_LEFT = 0x191, STATUS = 0x195,
  ACTIVE = 0x196, SIDE = 0x197, CONTROLLED = 0x198, AC = 0x19A, AC_REAR = 0x19B, ATTACKS_LEFT = 0x19B, HP = 0x1A4;
// TEffect / TItem
const E_P3 = 3, E_CALL = 4;
const I_TYPE = 0x2E, I_PLUS = 0x32, I_READIED = 0x34;
// combat record
const CR_SPELL = 0, CR_MAYCAST = 1, CR_MAYUSE = 2, CR_INIT = 3, CR_MOVELEFT = 6, CR_DYING = 0x0E, CR_TURNED = 0x10;

const byte = (v) => v & 0xFF;
const sx8 = (v) => ((v & 0xFF) ^ 0x80) - 0x80;
const addB = (k, n) => { G[k] = byte((G[k] ?? 0) + n); };
const ref = (v = null) => ({ v });
const cr = (c) => (c && c.combat) || { b: new Uint8Array(0x16), target: null };   // nil combatant: zero stand-in
const zeroChar = () => newChar();
const hv = () => G.hold_Victim || zeroChar();                         // hold_Victim^ (nil reads zeros)
const rdy0 = (c) => (c.readied ? c.readied[0] ?? null : null);       // TChar +151h readied[0]
const ds = (a) => (G.ds ? G.ds[a & 0xFFFF] : 0);
const spellLevel = (sp) => sx8(ds(0x37DB + 16 * sp));                 // spells_Table[sp] +1 (level)
const spellHalfOnSave = (sp) => ds(0x37E2 + 16 * sp);                 // spells_Table[sp] +8 (DS:37E2)
const wflags = (t) => ds(0x5CFD + 16 * byte(t));                      // ItemTypeTable[t] +7
const has = async (c, type) => !!(await X.HasEffect(c, type, ref()));
const dca = async (c) => ((await X.DualClassActive(c)) ? 1 : 0);
const map = () => G.cm_Map.b;
const stepDX = (d) => sx8(ds(0x2694 + d)), stepDY = (d) => sx8(ds(0x269D + d));

// 3600:0000 ov12_0000: overlay-manager touches, empty here.

// 3600:001B CancelDamageAndEffect(type)
export function CancelDamageAndEffect(type) {
  if (type === 0 || G.EffectToApply === type) {                       // 3600:001e / 0024
    G.DamageAmount = 0; G.EffectToApply = 0;                          // 3600:002c / 0031
  }
}

// 3600:003C AddEffectUnlessCuring(c, type, p3, duration)
export async function AddEffectUnlessCuring(c, type, p3, duration) {
  if (G.cure_InProgress !== 0) return false;                          // 3600:0042
  await X.AddEffect(c, type, duration, p3, 1);                        // 3600:0053
  return true;                                                        // 3600:004f
}

// 3600:0075 EffHelpless — types 1Bh, 1Fh, 33h, 34h, 35h
export async function EffHelpless(c, e, mode) {
  await X.ClearCombatantActionFlags(c);                               // 3600:0078 (result tested, both paths return)
}

// 3600:008D EffPlusOne (called by EffPrayer)
export async function EffPlusOne(c, e, mode) {
  addB('SaveRoll', 1); addB('AttackRollValue', 1);                    // 3600:0090 / 0094
}

// 3600:009E EffBless — type 01h
export async function EffBless(c, e, mode) {
  addB('morale_Value', 5); addB('AttackRollValue', 1);                // 3600:00a1 / 00a6
}

// 3600:00B0 EffCurse — type 02h
export async function EffCurse(c, e, mode) {
  if (G.morale_Value < 5) G.morale_Value = 0; else addB('morale_Value', -5);   // 3600:00b3 / 00ba / 00c1
  addB('AttackRollValue', -1);                                        // 3600:00c6
}

// 3600:00E8 EffSnakes — type 03h ("is fighting with snakes")
export async function EffSnakes(c, e, mode) {
  const n = byte(c.b[ATTACKS_LEFT + 2] + c.b[ATTACKS_LEFT + 1]);      // 3600:00ee +19Dh + +19Ch
  if (e.b[E_P3] > n) e.b[E_P3] = byte(e.b[E_P3] - n);                 // 3600:0109 / 0115
  else await X.RemoveEffect(c, 3, null);                              // 3600:0121
  await X.ShowCombatMessageAnimation(c, true, 'is fighting with snakes');   // 3600:0135
  await X.ClearCharacterMessage();                                    // 3600:0152
  await X.ClearCombatantActionFlags(c);                               // 3600:0157 the owner loses its turn
}

// 3600:016B EffHitPenaltyVsFlag1 — type 04h
export async function EffHitPenaltyVsFlag1(c, e, mode) {
  if (G.SelectedChar && (G.SelectedChar.b[KIND_FLAGS] & 1) !== 0) addB('AttackRollValue', -7);   // 3600:016e / 017d
}

// 3600:0188 EffFlameTongue — type 06h
export async function EffFlameTongue(c, e, mode) {
  G.hold_Victim = cr(c).target;                                       // 3600:018e
  const t = hv().b[CREATURE_TYPE];                                    // 3600:01a3
  const b = t === 0x0A ? 1 : (t === 9 || t === 0x0C) ? 2 : t === 4 ? 3 : 0;   // 3600:01ae .. 01d4
  addB('AttackRollValue', b); addB('DamageAmount', b);                // 3600:01d8 / 01df
  G.DamageType = 9;                                                   // 3600:01e6 fire + magic
}

// 3600:01F1 EffAcBonus2 — type 07h
export async function EffAcBonus2(c, e, mode) {
  if (c.b[AC] < 0x3A) c.b[AC] = byte(c.b[AC] + 2); else c.b[AC] = 0x3C;               // 3600:01f4 / 0202 / 020d
  if (c.b[AC_REAR] < 0x3A) c.b[AC_REAR] = byte(c.b[AC_REAR] + 2); else c.b[AC_REAR] = 0x3C;   // 3600:0213 / 0221 / 022c
}

// 3600:0238 EffProtFromEvil — types 08h, 2Dh
export async function EffProtFromEvil(c, e, mode) {
  const s = G.SelectedChar;
  if (s && [2, 5, 8].includes(s.b[ALIGNMENT])) { addB('SaveRoll', 2); addB('AttackRollValue', -2); }   // 3600:023b / 025f / 0264
}
// 3600:026F EffProtFromGood — types 09h, 2Eh
export async function EffProtFromGood(c, e, mode) {
  const s = G.SelectedChar;
  if (s && [0, 3, 6].includes(s.b[ALIGNMENT])) { addB('SaveRoll', 2); addB('AttackRollValue', -2); }   // 3600:0272 / 0296 / 029b
}

// 3600:02A6 EffResistCold — type 0Ah
export async function EffResistCold(c, e, mode) {
  if ((G.DamageType & 2) !== 0) { G.DamageAmount = G.DamageAmount >> 1; addB('SaveRoll', 3); }   // 3600:02a9 / 02b2 / 02c0
}

// 3600:02CB EffCharm — type 0Bh
export async function EffCharm(c, e, mode) {
  if (mode !== 0) {                                                   // 3600:02ce removed
    c.b[SIDE] = (e.b[E_P3] & 0x40) >> 6;                              // 3600:02d4
    if (c.b[NPC_MORALE] === 0xB3) c.b[NPC_MORALE] = 0;                // 3600:02ed
    return;                                                           // 3600:0301
  }
  if ((e.b[E_P3] & 0x20) === 0) {                                     // 3600:0304 first time
    e.b[E_P3] = byte(e.b[E_P3] + 0x20 + (c.b[SIDE] << 6));            // 3600:0311
    c.b[SIDE] = e.b[E_P3] >> 7; c.b[CONTROLLED] = 1;                  // 3600:0336 / 034d
    if (c.b[NPC_MORALE] <= 0x7F) c.b[NPC_MORALE] = 0xB3;              // 3600:0356
    cr(c).target = null;                                              // 3600:036a
    await X.CountActiveSides();                                       // 3600:037c
  }
  G.morale_Value = 100;                                               // 3600:0381
}

// 3600:038C EffNop0C — types 0Ch, 26h (empty)
export async function EffNop0C(c, e, mode) {}                         // 3600:038c

// 3600:03A0 EffSuffocate — type 0Dh
export async function EffSuffocate(c, e, mode) {
  if (e.b[E_P3] === 0) await X.KillCombatant(c, 6, 'Suffocates');     // 3600:03a6 / 03b0 6 = Dead
  else e.b[E_P3] = byte(e.b[E_P3] - 1);                               // 3600:03cf
}

// 3600:03DC EffNop0E — type 0Eh (empty)
export async function EffNop0E(c, e, mode) {}                         // 3600:03dc

// 3600:03E5 EffHpLossTick — type 0Fh
export async function EffHpLossTick(c, e, mode) {
  if (await AddEffectUnlessCuring(c, 0x0F, e.b[E_P3], 10)) {          // 3600:03e8
    if (c.b[HP] > 1) {                                                // 3600:0405
      G.DamageType = 0;                                               // 3600:0410
      await X.DamageCharacter(c, 1, 0, false);                        // 3600:0415
      if (G.view_Mode !== 5) await X.PartySummary(G.SelectedChar);    // 3600:0429 / 0430
    }
  }
}

// 3600:0443 EffNop10 — type 10h (empty)
export async function EffNop10(c, e, mode) {}                         // 3600:0443

// 3600:044C EffShield — type 11h
export async function EffShield(c, e, mode) {
  if (c.b[AC] < 0x39) c.b[AC] = 0x39;                                 // 3600:044f / 045a at least AC 3
  addB('SaveRoll', 1);                                                // 3600:0463
  if (G.sp_Current === 0x0F) G.DamageAmount = 0;                      // 3600:0467 / 046e magic missile has no effect
}

// 3600:0479 EffHitBonusVsFlag2 — type 12h
export async function EffHitBonusVsFlag2(c, e, mode) {
  G.hold_Victim = cr(c).target;                                       // 3600:047f
  if ((hv().b[KIND_FLAGS] & 2) !== 0) addB('AttackRollValue', 1);     // 3600:0494 / 04a3
}

// 3600:04AD EffResistFire — type 14h
export async function EffResistFire(c, e, mode) {
  if (mode === 0 && (G.DamageType & 1) !== 0) { G.DamageAmount = G.DamageAmount >> 1; addB('SaveRoll', 3); }   // 3600:04b0 .. 04cd
}

// 3600:04E4 EffSilence — type 15h
export async function EffSilence(c, e, mode) {
  if (cr(c).b[CR_MAYUSE] !== 0) await X.ShowCharacterMessage(c, 'is silenced', 0x0A, true);   // 3600:04ea / 04f9
  cr(c).b[CR_MAYUSE] = 0; cr(c).b[CR_MAYCAST] = 0;                    // 3600:0519 / 0526
}

// 3600:054A EffSlowPoisonEnd — type 16h
export async function EffSlowPoisonEnd(c, e, mode) {
  if (await has(c, 0x37)) await X.KillCombatant(c, 6, 'dies from poison');   // 3600:0550 / 0567
  G.cure_InProgress = 1;                                              // 3600:0584
  await X.RemoveEffect(c, 0x0F, null);                                // 3600:0589
  G.cure_InProgress = 0;                                              // 3600:059d
}

// 3600:05B6 EffSpiritualHammer — type 17h
export async function EffSpiritualHammer(c, e, mode) {
  let p = c.items, found = false;                                     // 3600:05bc / 05cc
  while (p && !found) {                                               // 3600:05d0
    if (p.b[I_TYPE] === 0x14 && p.b[0x31] === 0xF3) found = true;     // 3600:05de / 05f2
    else p = p.next;                                                  // 3600:05f8
  }
  if (mode !== 0 && p) await X.LoseItem(c, p);                        // 3600:0609 / 0617
  if (mode === 0 && !found && c.b[ITEM_COUNT] < 16) {                 // 3600:0628 / 0631 / 063a
    p = newItem();                                                    // 3600:0648 / 0656 GetMem + FillChar($3F, 0)
    p.b[I_TYPE] = 0x14; p.b[0x30] = 0x14; p.b[0x31] = 0xF3; p.b[I_PLUS] = 1;   // 3600:0667 .. 0682 "Spiritual Hammer" +1
    p.b[0x3D] = 0x17; p.b[0x3E] = 0xA0;                               // 3600:0687 / 068f
    await X.AppendItemCopy(c, p);                                     // 3600:0697
    await X.ReadyItem(p);                                             // 3600:06a8 quirk: on the template, not the copy
    p = null;                                                         // 3600:06b3 FreeMem
    await X.ShowCharacterMessage(c, 'Gains an item', 0x0A, true);     // 3600:06c1
  }
  await X.RecalcItems(c);                                             // 3600:06e1
}

// 3600:06F2 EffInvisible — type 19h
export async function EffInvisible(c, e, mode) {
  if (mode === 0 && !(await has(G.SelectedChar, 0x18))) {             // 3600:06f8 / 06fe
    G.AttackBlocked = 1; addB('AttackRollValue', -4);                 // 3600:0717 / 071c
  }
}

// 3600:0727 EffHitBonusVsFlag4 — type 1Ah
export async function EffHitBonusVsFlag4(c, e, mode) {
  G.hold_Victim = cr(c).target;                                       // 3600:072d
  if ((hv().b[KIND_FLAGS] & 4) !== 0) addB('AttackRollValue', 1);     // 3600:0742 / 0751
}

// 3600:0769 EffMirrorImage — type 1Ch
export async function EffMirrorImage(c, e, mode) {
  if (byte(await X.Roll(1, (e.b[E_P3] >> 4) + 1)) > 1 && G.sp_Current > 0 && G.SpellArea === 0) {   // 3600:076f .. 0793
    CancelDamageAndEffect(0);                                         // 3600:079a
    await X.ShowCharacterMessage(c, 'lost an image', 0x0A, true);     // 3600:07a1
    e.b[E_P3] = byte(e.b[E_P3] - 1);                                  // 3600:07c1 quirk: the whole byte
    if (e.b[E_P3] === 0) await X.RemoveEffect(c, 0x1C, null);         // 3600:07c8 / 07d2
  }
}

// 3600:07EC EffDamageMinusQuarter — type 1Dh
export async function EffDamageMinusQuarter(c, e, mode) {
  G.DamageAmount = byte(G.DamageAmount - (G.DamageAmount >> 2));      // 3600:07ef / 0803
}

// 3600:0818 EffCoughing — type 1Eh
export async function EffCoughing(c, e, mode) {
  if (cr(c).b[CR_MAYUSE] !== 0) await X.ShowCharacterMessage(c, 'is coughing', 0x0A, true);   // 3600:081e / 082d
  cr(c).b[CR_MAYUSE] = 0; cr(c).b[CR_MAYCAST] = 0;                    // 3600:084d / 085a
  await X.RecalcItems(c);                                             // 3600:0867
  if (c.b[AC_REAR] > 0x34) c.b[AC_REAR] = byte(c.b[AC_REAR] - 2); else c.b[AC_REAR] = 0x32;   // 3600:0872 / 087d / 0888
  c.b[AC] = c.b[AC_REAR];                                             // 3600:0891
  if (c === G.SelectedChar) await X.DrawCharacterSummary(c);          // 3600:08a1 / 08b2
}

// 3600:08CD EffAnimatedEnd — type 20h
export async function EffAnimatedEnd(c, e, mode) {
  e.b[E_CALL] = 0;                                                    // 3600:08d3
  if (G.cure_InProgress === 0) await X.KillCombatant(c, 6, 'collapses');   // 3600:08db / 08e2
  c.b[SIDE] = e.b[E_P3] >> 4; c.b[CONTROLLED] = 1; c.b[UNDEAD] = 0;   // 3600:08ff / 0916 / 091f
  c.b[FIGHTER_LVL_EFF] = byte(c.b[LEVEL + 2] + c.b[OLD_LEVEL + 2] * await dca(c));   // 3600:0928
  c.b[BASE_MOVE] = 12;                                                // 3600:0956
  if (c.b[NPC_MORALE] === 0xB3) c.b[NPC_MORALE] = 0;                  // 3600:095f / 096a
  c.b[CREATURE_TYPE] = 0;                                             // 3600:0973
}

// 3600:0982 EffPenaltyAll4 — type 21h
export async function EffPenaltyAll4(c, e, mode) {
  addB('AttackRollValue', -4); c.b[AC] = byte(c.b[AC] - 4); c.b[AC_REAR] = byte(c.b[AC_REAR] - 4);   // 3600:0985 / 098a / 0993
  addB('SaveRoll', -4);                                               // 3600:099c
}

// 3600:09A7 EffWeaknessAndDrain — type 22h
export async function EffWeaknessAndDrain(c, e, mode) {
  await X.CallEffectHandler(0x2B, c, e, mode);                        // 3600:09aa
  await X.CallEffectHandler(0x2C, c, e, mode);                        // 3600:09c2
}

// 3600:0A0E EffConfusion — type 23h
export async function EffConfusion(c, e, mode) {
  const r = byte(await X.Roll(1, 100));                               // 3600:0a14
  if (r >= 1 && r <= 10) {                                            // 3600:0a22 runs away
    await X.RemoveEffect(c, 0x23, null);                              // 3600:0a37
    cr(c).b[CR_TURNED] = 1; c.b[CONTROLLED] = 1;                      // 3600:0a4b / 0a58
    if (c.b[NPC_MORALE] <= 0x7F) c.b[NPC_MORALE] = 0xB3;              // 3600:0a61 / 0a6c
    cr(c).target = null;                                              // 3600:0a75
    await X.ApplyEffect(c, 0x8E, 10, 0, 1, 1, false, 'runs away');    // 3600:0a87
  } else if (r >= 11 && r <= 60) {                                    // 3600:0ab7 confused
    await X.ShowCombatMessageAnimation(c, true, 'is confused');       // 3600:0ac1
    await X.ClearCharacterMessage();                                  // 3600:0ade
    await EffHelpless(c, e, 0);                                       // 3600:0ae3
  } else if (r >= 61 && r <= 80) {                                    // 3600:0af9 berserk
    await X.ApplyEffect(c, 0x89, 1, c.b[SIDE], 1, 1, false, 'goes berserk');   // 3600:0b03
    await X.CallEffectHandler(0x89, c, null, 0);                      // 3600:0b36
  } else if (r >= 81 && r <= 100) {                                   // 3600:0b4f enraged
    await X.ShowCombatMessageAnimation(c, true, 'is enraged');        // 3600:0b59
    await X.ClearCharacterMessage();                                  // 3600:0b76
  }
  if (await X.SavingThrow(c, 4, -2)) await X.RemoveEffect(c, 0x23, null);   // 3600:0b7b / 0b95 save vs spell, bonus FEh
}

// 3600:0BAF EffPenalty4 — type 24h
export async function EffPenalty4(c, e, mode) {
  addB('AttackRollValue', -4); addB('SaveRoll', -4);                  // 3600:0bb2 / 0bb7
}

// 3600:0BC2 EffUntouchableAfterTurn — type 25h
export async function EffUntouchableAfterTurn(c, e, mode) {
  if (cr(c).b[CR_INIT] === 0) { G.AttackBlocked = 1; G.AttackRollValue = 0xFF; }   // 3600:0bc5 / 0bd4 / 0bd9 (-1)
}

// 3600:0BE9 EffHaste — type 27h
export async function EffHaste(c, e, mode) {
  if ((e.b[E_P3] & 0x10) === 0) {                                     // 3600:0bef
    e.b[E_P3] = byte(e.b[E_P3] + 0x10);                               // 3600:0bfc
    await X.ShowCharacterMessage(c, 'ages', 0x0A, true);              // 3600:0c0f
    const a = (c.b[AGE] | (c.b[AGE + 1] << 8)) + 1;                   // 3600:0c2f age word +76h
    c.b[AGE] = a & 0xFF; c.b[AGE + 1] = (a >> 8) & 0xFF;
  }
  G.StatValue = byte(G.StatValue << 1);                               // 3600:0c36
}

// cloud removal shared by EffCloudRemoved (4 squares, CloudSearchDirs DS:27D8, re-mark 1Eh) and EffCloud9Removed
// (9 squares, CloudDirs9 DS:27DB, re-mark 1Ch); the two routines are separate copies in the original.
async function removeCloud(c, e, listName, squares, dirTab, mark) {
  const id = e.b[E_P3] >> 4;                                          // 3600:0c67 / 1cfc
  let a = G[listName], found = false;                                 // 3600:0c79 / 0c7d ; 1d0e / 1d12
  while (a && !found) {                                               // 3600:0c89 ; 1d1e
    if (a.owner === c && a.id === id) found = true;                   // 3600:0c97 / 0ca9 ; 1d2c / 1d3e
    else a = a.next;                                                  // 3600:0cbb ; 1d50
  }
  if (!found) return;                                                 // 3600:0ccc ; 1d61
  await X.ShowTimedBottomMessage('The air clears a little...');       // 3600:0cd5 ; 1d79
  for (let k = 1; k <= squares; k++) {                                // 3600:0ce9 ; 1d7e
    if (!a.active[k]) continue;                                       // 3600:0cf2 ; 1d91
    const d = ds(dirTab + k);
    const x = byte(a.x + stepDX(d)), y = byte(a.y + stepDY(d));       // 3600:0d06 / 0d29 ; 1db1 / 1dd4
    let body = false;                                                 // 3600:0d4c ; 1de1
    for (let i = 1; i <= (G.corpse_Count || 0); i++) {                // 3600:0d50 ; 1de5
      const b = G.corpse_List && G.corpse_List[i];
      if (b && b.char && sx8(b.col) === x && sx8(b.row) === y) body = true;   // 3600:0d65 .. 0db3 ; 1e06 .. 1e48
    }
    if (body) map()[7 + y * 50 + x] = 0x1F;                           // 3600:0dbf / 0dc5 ; 1e73
    else map()[7 + y * 50 + x] = a.ground[k];                         // 3600:0de5 ; 1ea1
  }
  let p = G[listName];                                                // 3600:0e19 ; 1eae
  if (p === a) G[listName] = a.next;                                  // 3600:0e25 / 0e34 ; 1ed2
  else while (p.next !== a) p = p.next;                               // 3600:0e46 / 0e59 ; 1edb .. 1efd
  p.next = a.next;                                                    // 3600:0e6a ; 1f0b (no-op when a was the head)
  // 3600:0e7e ; 1f1c FreeMem(a, 1Eh)
  for (p = G[listName]; p; p = p.next)                                // 3600:0e8c / 0e98 ; 1f21 / 1f2d
    for (let k = 1; k <= squares; k++)                                // 3600:0ea3 ; 1f38
      if (p.active[k]) {
        const d = ds(dirTab + k);
        map()[7 + byte(p.y + stepDY(d)) * 50 + byte(p.x + stepDX(d))] = mark;   // 3600:0ebd ; 1fa1
      }
}

// 3600:0C61 EffCloudRemoved — type 28h
export async function EffCloudRemoved(c, e, mode) { await removeCloud(c, e, 'cloud_List', 4, 0x27D8, 0x1E); }

// 3600:0F39 AvoidRangedAttack(c, chance)
export async function AvoidRangedAttack(c, chance) {
  if (G.SelectedChar && rdy0(G.SelectedChar)) {                       // 3600:0f3f
    if (byte(await X.TargetDistance(G.SelectedChar, c)) > 1) {        // 3600:0f4f
      if (byte(await X.Roll(1, 100)) <= chance) {                     // 3600:0f66
        await X.ShowCharacterMessage(c, 'Avoids it', 0x0A, true);     // 3600:0f76
        G.DamageAmount = 0; G.AttackRollValue = 0xFF;                 // 3600:0f96 / 0f9b
        if (Array.isArray(G.SlotHits)) G.SlotHits[0] = byte(G.SlotHits[0] - 1); else addB('SlotHits', -1);   // 3600:0fa0
      }
    }
  }
}

// 3600:0FAA CurrentAttackItem(c)
export async function CurrentAttackItem(c) {
  let p = null;                                                       // 3600:0fb0
  if (c && rdy0(c)) {                                                 // 3600:0fb8
    const ammo = ref(null);
    const ok = await X.GetMissileAmmo(c, ammo);                       // 3600:0fc7
    p = ammo.v;
    if (!ok || !p) p = rdy0(c);                                       // 3600:0fda / 0fe8
  }
  return p;                                                           // 3600:0ff8
}

// 3600:100F EffMagicWeaponOnly — type 29h
export async function EffMagicWeaponOnly(c, e, mode) {
  if (await CurrentAttackItem(G.SelectedChar))                        // 3600:1012
    if ((await CurrentAttackItem(G.SelectedChar)).b[I_PLUS] === 0) await AvoidRangedAttack(c, 100);   // 3600:1022 / 1032 / 1039
}

// 3600:104C EffSlow — type 2Ah
export async function EffSlow(c, e, mode) { G.StatValue = G.StatValue >> 1; }   // 3600:104f

// 3600:106F EffWeakness — type 2Bh
export async function EffWeakness(c, e, mode) {
  if (await AddEffectUnlessCuring(c, 0x2B, e.b[E_P3], 0x3C)) {        // 3600:1072
    if (c.b[STR] > 3) {                                               // 3600:1092
      await X.ShowCharacterMessage(c, 'is weakened', 0x0A, true);     // 3600:109c
      c.b[STR] = byte(c.b[STR] - 1);                                  // 3600:10bc
    } else if (!(await has(c, 0x1F))) await X.AddEffect(c, 0x1F, 0, 0xFF, 0);   // 3600:10c5 / 10dc
  }
}

// 3600:10F9 EffHpDrainTick — type 2Ch
export async function EffHpDrainTick(c, e, mode) {
  if (await AddEffectUnlessCuring(c, 0x2C, e.b[E_P3], 10)) {          // 3600:10fc
    if (c.b[HP] > 1) {                                                // 3600:111c
      G.DamageType = 0; await X.DamageCharacter(c, 1, 0, false);      // 3600:1127 / 112c
      if (G.view_Mode !== 5) await X.PartySummary(G.SelectedChar);    // 3600:1140 / 1147
    } else if (!(await has(c, 0x1F))) await X.AddEffect(c, 0x1F, 0, 0xFF, 0);   // 3600:1156 / 116d
  }
}

// 3600:118A EffDefenceVsLargeGiants — type 2Fh
export async function EffDefenceVsLargeGiants(c, e, mode) {
  G.hold_Victim = cr(c).target;                                       // 3600:1190 (unused)
  const s = G.SelectedChar || zeroChar();
  if ((s.b[CREATURE_TYPE] === 2 || s.b[CREATURE_TYPE] === 0x0A) && (s.b[SIZE] & 0x7F) === 2) addB('AttackRollValue', -4);   // 3600:11a5 / 11bd / 11cc
}

// 3600:11D7 EffDefenceVsLargeType1 — type 30h
export async function EffDefenceVsLargeType1(c, e, mode) {
  const s = G.SelectedChar || zeroChar();
  if (s.b[CREATURE_TYPE] === 1 && (s.b[SIZE] & 0x7F) === 2) addB('AttackRollValue', -4);   // 3600:11da / 11e6 / 11f5
}

// 3600:1200 EffPrayer — type 31h
export async function EffPrayer(c, e, mode) {
  const side = (e.b[E_P3] & 0x10) >> 4;                               // 3600:1206
  if (c.b[SIDE] === side) await EffPlusOne(c, e, mode);               // 3600:121a / 122d
  else { addB('AttackRollValue', -1); addB('SaveRoll', -1); }         // 3600:123d / 1241
}

// 3600:124B EffFireVulnerable — type 32h
export async function EffFireVulnerable(c, e, mode) {
  if ((G.DamageType & 2) !== 0) addB('SaveRoll', 2);                  // 3600:124e / 1257 cold: +2 save
  else if ((G.DamageType & 1) !== 0 && G.SaveResult === 0) G.DamageAmount = byte(G.DamageAmount << 1);   // 3600:125e .. 126e
}

// 3600:127E EffColdVulnerable — type 36h
export async function EffColdVulnerable(c, e, mode) {
  if ((G.DamageType & 1) !== 0) addB('SaveRoll', 2);                  // 3600:1281 / 128a fire: +2 save
  else if ((G.DamageType & 2) !== 0 && G.GameSaved === 0) G.DamageAmount = byte(G.DamageAmount << 1);   // 3600:1291 .. 12a1 quirk: DS:5CF1
}

// 3600:12B1 EffNop37 — type 37h (the poison marker, empty)
export async function EffNop37(c, e, mode) {}                         // 3600:12b1

// 3600:12BA EffGrantInvisible — type 38h
export async function EffGrantInvisible(c, e, mode) { await X.AddEffect(c, 0x19, 1, 0x0C, 0); }   // 3600:12ba

// 3600:12DB EffHeld — type 3Ah
export async function EffHeld(c, e, mode) {
  cr(c).b[CR_MOVELEFT] = 0;                                           // 3600:12de
  if (G.StatKind !== 0) G.StatValue = 0;                              // 3600:12eb / 12f2
}

// 3600:12FD EffBecome62 — type 3Bh
export async function EffBecome62(c, e, mode) { await X.AddEffect(c, 0x62, 0, 0xFF, 0); }   // 3600:12fd

// 3600:131D EffNeedMagicWeaponHalf — type 3Ch
export async function EffNeedMagicWeaponHalf(c, e, mode) {
  const p = await CurrentAttackItem(G.SelectedChar);                  // 3600:1323
  if (!p || p.b[I_PLUS] === 0) G.DamageAmount = 0;                    // 3600:1335 / 1347
  else if (sx8(p.b[I_PLUS]) < 3) G.DamageAmount = G.DamageAmount >> 1;   // 3600:134e / 1360 signed
}

// 3600:1374 EffFireResistance — type 3Dh
export async function EffFireResistance(c, e, mode) {
  if ((G.DamageType & 1) !== 0) {                                     // 3600:137a
    for (let i = 1; i <= G.LastDiceCount; i++) {                      // 3600:1383 / 1395
      addB('DamageAmount', -2);                                       // 3600:1398 -2 per die
      if (G.DamageAmount < G.LastDiceCount) G.DamageAmount = G.LastDiceCount;   // 3600:139d / 13a6 unsigned
    }
    addB('SaveRoll', 4);                                              // 3600:13b4
    if ((G.DamageType & 8) === 0) CancelDamageAndEffect(0);           // 3600:13b9 / 13c2
  }
}

// 3600:13CF EffRegenerate — type 3Eh
export async function EffRegenerate(c, e, mode) {
  if (await AddEffectUnlessCuring(c, 0x3E, e.b[E_P3], 0x3C))          // 3600:13d2
    if (await X.HealCharacter(c, 1, true)) await X.ShowHealingResult(c);   // 3600:13ef / 1404
}

// 3600:1415 EffMinorGlobe — type 3Fh
export async function EffMinorGlobe(c, e, mode) {
  if (G.sp_Current > 0 && spellLevel(G.sp_Current) < 4) CancelDamageAndEffect(0);   // 3600:1418 / 141f / 1431
}

// 3600:1454 PoisonOpponent(c, bonus)
export async function PoisonOpponent(c, bonus) {
  G.hold_Victim = cr(c).target;                                       // 3600:145a
  if (!(await X.SavingThrow(G.hold_Victim, 0, bonus))) {              // 3600:146f
    await X.ShowCharacterMessage(G.hold_Victim, 'is Poisoned', 0x0A, false);   // 3600:1487
    await MessageDelay();                                             // 3600:14a9
    await X.AddEffect(G.hold_Victim, 0x37, 0, 0xFF, 0);               // 3600:14ae
    await X.KillCombatant(G.hold_Victim, 6, 'is killed');             // 3600:14c7
  }
}

// 3600:14F9 ParalyzeOpponent(c, duration, unused)
export async function ParalyzeOpponent(c, duration, unused) {
  G.hold_Victim = cr(c).target;                                       // 3600:14ff
  if (!(await X.SavingThrow(G.hold_Victim, 0, 0))) {                  // 3600:1514
    await X.ShowCombatMessageAnimation(G.hold_Victim, true, 'is Paralyzed');   // 3600:152b
    await X.AddEffect(G.hold_Victim, 0x34, duration, 0x0C, 0);        // 3600:154a
  }
}

// 3600:1569 / 157F / 1595 / 16C2 EffPoisonHit — types 40h / 41h / 42h / 46h
export async function EffPoisonHit(c, e, mode) { await PoisonOpponent(c, 0); }      // 3600:1569
export async function EffPoisonHitP4(c, e, mode) { await PoisonOpponent(c, 4); }    // 3600:157f
export async function EffPoisonHitP2(c, e, mode) { await PoisonOpponent(c, 2); }    // 3600:1595
export async function EffPoisonHitM2(c, e, mode) { await PoisonOpponent(c, -2); }   // 3600:16c2

// 3600:15AB EffParalyzeHit2d8 — type 43h
export async function EffParalyzeHit2d8(c, e, mode) { await ParalyzeOpponent(c, byte(await X.Roll(2, 8)), 0); }   // 3600:15ab

// 3600:15E6 EffFeeblemind — type 44h
export async function EffFeeblemind(c, e, mode) {
  c.b[INT] = 7; c.b[WIS] = 7;                                         // 3600:15ec / 15f4
  await X.ShowCharacterMessage(c, 'is stupid', 0x0A, true);           // 3600:15fc
  if (G.view_Mode === 5) {                                            // 3600:161c in combat
    cr(c).b[CR_MAYCAST] = 0;                                          // 3600:1623
    if (cr(c).b[CR_SPELL] > 0) {                                      // 3600:1630
      await X.ShowCharacterMessage(c, 'lost a spell', 0x0C, true);    // 3600:163e
      await X.ForgetMemorizedSpell(c, cr(c).b[CR_SPELL]);             // 3600:165e
      cr(c).b[CR_SPELL] = 0;                                          // 3600:1675
    }
  }
}

// 3600:1687 EffInvisibleToType13 — type 45h
export async function EffInvisibleToType13(c, e, mode) {
  if (G.SelectedChar && G.SelectedChar.b[CREATURE_TYPE] === 0x13) {   // 3600:168d
    if (!(await has(G.SelectedChar, 0x18))) G.AttackBlocked = 1;      // 3600:1699 / 16b2
    addB('AttackRollValue', -4);                                      // 3600:16b7
  }
}

// 3600:16D8 EffUnattackable — type 47h
export async function EffUnattackable(c, e, mode) { G.AttackBlocked = 1; addB('AttackRollValue', -4); }   // 3600:16db / 16e0

// 3600:16EB EffGrantInvisible95 — type 48h
export async function EffGrantInvisible95(c, e, mode) {
  if (byte(await X.Roll(1, 100)) <= 95) await X.AddEffect(c, 0x19, 1, 0x0C, 0);   // 3600:16ee / 16fd
}

// 3600:1729 EffImmuneDamage20 — type 49h
export async function EffImmuneDamage20(c, e, mode) {
  if ((G.DamageType & 0x20) !== 0) {                                  // 3600:172f
    CancelDamageAndEffect(0);                                         // 3600:1738
    await X.ShowCharacterMessage(c, 'is unaffected', 0x0A, true);     // 3600:173f
  }
}

// 3600:1765 EffNop4A — type 4Ah (empty)
export async function EffNop4A(c, e, mode) {}                         // 3600:1765

// 3600:1771 EffBonusVsType3 — type 4Bh
export async function EffBonusVsType3(c, e, mode) {
  G.hold_Victim = cr(c).target;                                       // 3600:1774
  if (hv().b[CREATURE_TYPE] === 3) {                                  // 3600:1789
    G.DamageAmount = byte(byte(await X.Roll(1, 12)) * 3 + 4 + sx8(await X.StrDamageAdj(c)));   // 3600:1795 / 17ba
    addB('AttackRollValue', 2);                                       // 3600:17bd
  }
}

// 3600:17C8 EffBonusVsType8 — type 4Ch
export async function EffBonusVsType8(c, e, mode) {
  G.hold_Victim = cr(c).target;                                       // 3600:17cb
  if (hv().b[CREATURE_TYPE] === 8) { addB('AttackRollValue', 3); addB('DamageAmount', 3); }   // 3600:17e0 / 17ec / 17f1
}

// new target of a berserk combatant: BuildTargetList around it, then cb_Char[tg_List[2].who] (byte DS:6E9A)
async function pickBerserkTarget(c) {
  await X.BuildTargetList(await X.CombatantCol(c), await X.CombatantRow(c), 0xFF, 0xFF, await X.CombatantSize(c), G.cm_Map);
  const t = G.tg_List && G.tg_List[2];
  cr(c).target = G.cb_Char ? G.cb_Char[t ? t.who : 0] ?? null : null;
}

// 3600:1809 EffBerserk — type 4Dh
export async function EffBerserk(c, e, mode) {
  if (mode === 0) {                                                   // 3600:180f
    c.b[CONTROLLED] = 1;                                              // 3600:1818
    if (c.b[NPC_MORALE] <= 0x7F || c.b[NPC_MORALE] === 0xB3) c.b[NPC_MORALE] = 0xB3;   // 3600:1821 / 1837
    else c.b[NPC_MORALE] = 0xB2;                                      // 3600:1842
    if (G.view_Mode === 5) {                                          // 3600:184b
      cr(c).target = null;                                            // 3600:1855
      await pickBerserkTarget(c);                                     // 3600:1867 / 189a / 189f
      cr(c).b[CR_MAYCAST] = 0;                                        // 3600:18c0
      c.b[SIDE] = ((cr(c).target || zeroChar()).b[SIDE] ^ 1) & 0xFF;  // 3600:18cd
      await X.ShowCharacterMessage(c, 'goes berzerk', 0x0A, true);    // 3600:18e8
    }
  } else {
    if (c.b[NPC_MORALE] === 0xB3) c.b[NPC_MORALE] = 0;                // 3600:190a / 1915
    c.b[SIDE] = 0;                                                    // 3600:191e
  }
}

// 3600:192D EffReviveCheck — type 4Eh
export async function EffReviveCheck(c, e, mode) {
  if (!(await X.ReviveCombatant(c, c.b[HP]))) await AddEffectUnlessCuring(c, 0x4E, e.b[E_P3], 1);   // 3600:1933 / 194b
}

// 3600:196D EffFireDamage — type 4Fh / 3600:19A2 EffAcidDamage — type 50h
export async function EffFireDamage(c, e, mode) {
  G.DamageType = 9;                                                   // 3600:1970
  await X.DamageCharacter(cr(c).target, byte(await X.RollDice(2, 10)), 0, false);   // 3600:1975
}
export async function EffAcidDamage(c, e, mode) {
  G.DamageType = 0x10;                                                // 3600:19a5
  await X.DamageCharacter(cr(c).target, byte(await X.RollDice(1, 4)), 0, false);    // 3600:19aa
}

// 3600:19D7 EffHalveDamage — type 51h
export async function EffHalveDamage(c, e, mode) { G.DamageAmount = G.DamageAmount >> 1; }   // 3600:19da

// 3600:19EE EffEvadeFireCold — type 52h
export async function EffEvadeFireCold(c, e, mode) {
  if ((G.DamageType & 3) !== 0) {                                     // 3600:19f1 / 19fa
    if (await X.SavingThrow(c, 4, 0) && spellHalfOnSave(G.sp_Current) !== 0) G.DamageAmount = 0;   // 3600:1a03 / 1a18 / 1a2a
    else G.DamageAmount = G.DamageAmount >> 1;                        // 3600:1a31
  }
}

// gaze animation: BuildFourAnimationFrames(12h) + AnimateAlongPath(src -> dst, 4 frames, delay 2Dh)
async function gazeAnim(from, to) {
  await X.AnimateAlongPath(await X.CombatantCol(from), await X.CombatantRow(from), await X.CombatantCol(to), await X.CombatantRow(to), 4, 0x2D);
}

// 3600:1A65 EffStoneGaze — type 53h
export async function EffStoneGaze(c, e, mode) {
  G.hold_Victim = cr(c).target;                                       // 3600:1a6b
  await X.ShowCharacterMessage(c, 'gazes...', 0x0A, false);           // 3600:1a80
  await X.BuildFourAnimationFrames(0x12);                             // 3600:1aa0
  await gazeAnim(c, G.hold_Victim);                                   // 3600:1aa8 .. 1ae6
  if (await has(c, 0x7F)) {                                           // 3600:1aeb
    let reflected = false, it = hv().items;                           // 3600:1b05 / 1b09
    while (it && !reflected) {                                        // 3600:1b1a / 1b25
      if (it.b[I_READIED] !== 0 && (it.b[0x2F] === 0x76 || it.b[0x30] === 0x76 || it.b[0x31] === 0x76)) {   // 3600:1b2e / 1b3b "Mirror"
        await X.ShowCharacterMessage(G.hold_Victim, 'reflects it!', 0x0C, false);   // 3600:1b59
        await gazeAnim(G.hold_Victim, c);                             // 3600:1b7b .. 1bb9
        reflected = true; G.hold_Victim = c;                          // 3600:1bbe / 1bc2
      }
      it = it.next;                                                   // 3600:1bce
    }
  }
  if (!(await X.SavingThrow(G.hold_Victim, 1, 0))) await X.KillCombatant(G.hold_Victim, 7, 'is Stoned');   // 3600:1be0 / 1bf7
}

// 3600:1C1C EffElectricityHeals — type 54h
export async function EffElectricityHeals(c, e, mode) {
  if ((G.DamageType & 4) !== 0) {                                     // 3600:1c22
    CancelDamageAndEffect(0);                                         // 3600:1c2b
    await X.Roll(1, 8);                                               // 3600:1c32 quirk: the roll is discarded
    c.b[HP] = byte(c.b[HP] + 8);                                      // 3600:1c40 no maximum
  }
}

// 3600:1C4F EffOneDamageFromWflag1 — type 55h
export async function EffOneDamageFromWflag1(c, e, mode) {
  const p = await CurrentAttackItem(G.SelectedChar);                  // 3600:1c55
  if (p && wflags(p.b[I_TYPE]) === 1) G.DamageAmount = 1;             // 3600:1c67 / 1c6f / 1c85
}

// 3600:1C90 EffDisplacement — type 59h
export async function EffDisplacement(c, e, mode) {
  if (G.CombatRound === 0 && G.AttackRollValue === 0) e.b[E_P3] &= 0x0F;   // 3600:1c93 / 1c9a / 1ca1
  else if ((e.b[E_P3] & 0x10) === 0) { G.AttackRollValue = 0xFF; e.b[E_P3] |= 0x10; }   // 3600:1cb3 / 1cc0 / 1cc5 the first attack misses
}

// 3600:1CF6 EffCloud9Removed — type 5Bh (3x3 clouds, cloud9_List DS:755F)
export async function EffCloud9Removed(c, e, mode) { await removeCloud(c, e, 'cloud9_List', 9, 0x27DB, 0x1C); }

// 3600:1FC4 EffHalveFire — type 5Dh
export async function EffHalveFire(c, e, mode) {
  if ((G.DamageType & 1) !== 0) G.DamageAmount = G.DamageAmount >> 1; // 3600:1fc7 / 1fd0
}

// 3600:1FE4 EffHalveWeapon — type 5Eh
export async function EffHalveWeapon(c, e, mode) {
  const p = await CurrentAttackItem(G.SelectedChar);                  // 3600:1fea
  if (p && (wflags(p.b[I_TYPE]) & 0x81) !== 0) G.DamageAmount = G.DamageAmount >> 1;   // 3600:1ffc / 2004 / 201d
}

// 3600:203C EffFallsDead — type 5Fh
export async function EffFallsDead(c, e, mode) {
  e.b[E_CALL] = 0;                                                    // 3600:2042
  if (c.b[ACTIVE] !== 0) await X.KillCombatant(c, 6, 'Falls dead');   // 3600:204a / 2055
}

// 3600:2078 EffConSaveBonusMagic — type 61h
export async function EffConSaveBonusMagic(c, e, mode) {
  if (G.SaveType === 4 || G.SaveType === 2) {                         // 3600:207e / 2085
    const k = c.b[CON];
    const b = k >= 4 && k <= 6 ? 1 : k >= 7 && k <= 10 ? 2 : k >= 11 && k <= 13 ? 3 : k >= 14 && k <= 17 ? 4 : k >= 18 && k <= 20 ? 5
      : 0;                                                            // 3600:208c .. 20df TODO(decode): uninitialised outside 4..20
    addB('SaveRoll', b);                                              // 3600:20e3
  }
}

// 3600:20FA EffRegenerate3 — type 62h
export async function EffRegenerate3(c, e, mode) {
  c.b[HP] = byte(c.b[HP] + 3); if (c.b[HP] > c.b[HP_MAX]) c.b[HP] = c.b[HP_MAX];   // 3600:20fd / 2106 / 2117
}

// 3600:212C EffReviveOnce — type 63h
export async function EffReviveOnce(c, e, mode) {
  let n = 0;                                                          // 3600:2132
  if (c.b[STATUS] === 5 && cr(c).b[CR_DYING] < 6) n = 6 - cr(c).b[CR_DYING];   // 3600:2136 / 2141 / 2150
  if (c.b[STATUS] === 4) n = 6;                                       // 3600:2168 / 2173
  if (n > 0 && await X.ReviveCombatant(c, n)) {                       // 3600:2177 / 217d
    await X.AddEffect(c, 0x5F, byte(await X.Roll(1, 4)) + 1, 0xFF, 1);   // 3600:2190
    e.b[E_CALL] = 0;                                                  // 3600:21b3
    await X.RemoveEffect(c, 0x63, e);                                 // 3600:21bb
  }
}

// 3600:21D5 EffTrollDown — type 64h
export async function EffTrollDown(c, e, mode) {
  if ((G.DamageType & 1) === 0 && (G.DamageType & 0x10) === 0) await X.AddEffect(c, 0x66, byte(await X.Roll(3, 6)), 0xFF, 1);   // 3600:21d8 .. 21e8
}

// 3600:2212 EffStartRegenerating — type 65h
export async function EffStartRegenerating(c, e, mode) {
  if (!(await has(c, 0x62)) && !(await has(c, 0x3B))) await X.AddEffect(c, 0x3B, 3, 0xFF, 1);   // 3600:2218 / 222f / 2246
}

// 3600:2264 EffTrollRise — type 66h
export async function EffTrollRise(c, e, mode) {
  if (!(await X.ReviveCombatant(c, c.b[HP_MAX]))) await AddEffectUnlessCuring(c, 0x66, e.b[E_P3], 1);   // 3600:226a / 2281
}

// 3600:22A3 EffFireBonusD6 — type 67h
export async function EffFireBonusD6(c, e, mode) {
  G.hold_Victim = cr(c).target;                                       // 3600:22a9
  if (!(await has(G.hold_Victim, 0x14)) && !(await has(G.hold_Victim, 0x36)) && !(await has(G.hold_Victim, 0x3D)))   // 3600:22be / 22d7 / 22f0
    addB('DamageAmount', byte(await X.Roll(1, 6)));                   // 3600:2309
}

// 3600:231E EffAvoidMissiles60 — type 68h
export async function EffAvoidMissiles60(c, e, mode) { await AvoidRangedAttack(c, 60); }   // 3600:2321

// 3600:2334 MagicResistance(pct)
export async function MagicResistance(pct) {
  const lvl = byte(await X.SpellCasterLevel(G.sp_Current));           // 3600:233a
  const chance = byte((11 - lvl) * 5 + pct);                          // 3600:2346 byte (quirk: Curse adds the level term)
  if (G.EffectToApply !== 0 || (G.DamageType & 8) !== 0)              // 3600:2363 / 236a
    if (byte(await X.Roll(1, 100)) <= chance) CancelDamageAndEffect(0);   // 3600:2375 / 2385
}

// 3600:2392 EffMagicRes50 — type 69h / 3600:23A2 EffMagicRes15 — type 6Ah
export async function EffMagicRes50(c, e, mode) { await MagicResistance(50); }   // 3600:2395
export async function EffMagicRes15(c, e, mode) { await MagicResistance(15); }   // 3600:23a5

// 3600:23B2 EffResistSleepCharm90 — type 6Bh
export async function EffResistSleepCharm90(c, e, mode) {
  if (byte(await X.Roll(1, 100)) <= 90) { CancelDamageAndEffect(0x35); CancelDamageAndEffect(0x0B); }   // 3600:23b5 / 23c4 / 23cb
}

// 3600:23D8 EffImmuneSleepCharm — type 6Ch
export async function EffImmuneSleepCharm(c, e, mode) { CancelDamageAndEffect(0x0B); CancelDamageAndEffect(0x35); }   // 3600:23db / 23e2

// 3600:23EF EffImmuneHold — type 6Dh
export async function EffImmuneHold(c, e, mode) { CancelDamageAndEffect(0x34); }   // 3600:23f2

// 3600:23FF EffImmuneCold — type 6Eh
export async function EffImmuneCold(c, e, mode) { if ((G.DamageType & 2) !== 0) CancelDamageAndEffect(0); }   // 3600:2402 / 240b

// 3600:2418 EffImmunePoisonParalysis — type 6Fh
export async function EffImmunePoisonParalysis(c, e, mode) {
  CancelDamageAndEffect(0x37); CancelDamageAndEffect(0x34);           // 3600:241b / 2422
  if (G.SaveType === 0) G.SaveRoll = 100;                             // 3600:2429 / 2430
}

// 3600:243B EffImmuneFire — type 70h
export async function EffImmuneFire(c, e, mode) { if ((G.DamageType & 1) !== 0) CancelDamageAndEffect(0); }   // 3600:243e

// 3600:2454 EffFireMinusOnePerDie — type 71h
export async function EffFireMinusOnePerDie(c, e, mode) {
  if ((G.DamageType & 1) !== 0)                                       // 3600:245a
    for (let i = 1; i <= G.LastDiceCount; i++) {                      // 3600:2463 / 2475
      addB('DamageAmount', -1);                                       // 3600:2478
      if (G.DamageAmount < G.LastDiceCount) G.DamageAmount = G.LastDiceCount;   // 3600:247c / 2485
    }
}

// 3600:2499 EffHalveElectricity — type 72h / 3600:259A EffHalveCold — type 76h
export async function EffHalveElectricity(c, e, mode) { if ((G.DamageType & 4) !== 0) G.DamageAmount = G.DamageAmount >> 1; }   // 3600:249c / 24a5
export async function EffHalveCold(c, e, mode) { if ((G.DamageType & 2) !== 0) G.DamageAmount = G.DamageAmount >> 1; }          // 3600:259d

// 3600:24B9 EffHalveEdged — type 73h
export async function EffHalveEdged(c, e, mode) {
  const p = await CurrentAttackItem(G.SelectedChar);                  // 3600:24bf
  if (p && (wflags(p.b[I_TYPE]) === 0 || (wflags(p.b[I_TYPE]) & 1) !== 0)) G.DamageAmount = G.DamageAmount >> 1;   // 3600:24d1 .. 2508
}

// 3600:251C EffHalveMagicWeapon — type 74h
export async function EffHalveMagicWeapon(c, e, mode) {
  const p = await CurrentAttackItem(G.SelectedChar);                  // 3600:2522
  if (p && sx8(p.b[I_PLUS]) > 0) G.DamageAmount = G.DamageAmount >> 1;   // 3600:2534 / 253c / 2546 signed
}

// 3600:255A EffHolyWater — type 75h
export async function EffHolyWater(c, e, mode) {
  const p = G.SelectedChar ? rdy0(G.SelectedChar) : null;             // 3600:2560
  if (p && p.b[I_TYPE] === 0x55) G.DamageAmount = byte(byte(await X.RollDice(1, 6)) + 1);   // 3600:2571 / 2579 / 2583
}

// 3600:25BA EffNeedMagicWeapon — type 77h
export async function EffNeedMagicWeapon(c, e, mode) {
  const p = await CurrentAttackItem(G.SelectedChar);                  // 3600:25c0
  if (!p || p.b[I_PLUS] === 0) {                                      // 3600:25d2 / 25da
    const s = G.SelectedChar || zeroChar();
    if (sx8(s.b[RACE]) > 0 || sx8(s.b[LEVEL_MAIN]) < 4) G.DamageAmount = 0;   // 3600:25e4 / 25ef / 25fb signed
  }
}

// 3600:2606 EffAvoidBoulders — type 78h
export async function EffAvoidBoulders(c, e, mode) {
  const p = G.SelectedChar ? rdy0(G.SelectedChar) : null;             // 3600:260c
  if (p && (p.b[I_TYPE] === 0x57 || p.b[I_TYPE] === 0x58)) await AvoidRangedAttack(c, 50);   // 3600:261d / 2625 / 263c
}

// 3600:2657 EffSpitAcid — type 79h
export async function EffSpitAcid(c, e, mode) {
  G.hold_Victim = cr(c).target;                                       // 3600:265d
  if (byte(await X.Roll(1, 100)) <= 25) {                             // 3600:2672
    if (byte(await X.TargetDistance(c, G.hold_Victim)) < 4) {         // 3600:2684
      await X.ClearCombatantActionFlags(c);                           // 3600:269e
      await X.ShowCharacterMessage(c, 'Spits Acid', 0x0A, true);      // 3600:26a9
      await X.BuildFourAnimationFrames(0x17);                         // 3600:26cc
      await X.AnimateAlongPath(await X.CombatantCol(c), await X.CombatantRow(c), await X.CombatantCol(G.hold_Victim),
        await X.CombatantRow(G.hold_Victim), 1, 0x1E);                // 3600:26d4 .. 2712
      const dmg = byte(await X.RollDice(8, 4));                       // 3600:2717
      await X.DamageCharacter(G.hold_Victim, dmg, 2, await X.SavingThrow(G.hold_Victim, 3, 0));   // 3600:2742 half on a save
      await X.RemoveEffect(c, 0x79, e);                               // 3600:2747
      await X.RemoveEffect(c, 0x50, null);                            // 3600:275b
    }
  }
}

// 3600:2782 EffParalyzeOnHit — type 7Ah
export async function EffParalyzeOnHit(c, e, mode) {
  G.hold_Victim = cr(c).target;                                       // 3600:2788
  if (!(await X.SavingThrow(G.hold_Victim, 0, 0))) {                  // 3600:279d / 27b3
    await X.AddEffect(G.hold_Victim, 0x34, 0, 0xFF, 0);               // 3600:27b9
    await X.ShowCharacterMessage(G.hold_Victim, 'is paralyzed', 0x0A, true);   // 3600:27d2
  }
}

// 3600:27FA EffColdDamage2d8 — type 7Bh
export async function EffColdDamage2d8(c, e, mode) {
  G.DamageType = 0x0A;                                                // 3600:27fd cold + magic
  await X.DamageCharacter(cr(c).target, byte(await X.RollDice(2, 8)), 0, false);   // 3600:2802
}

// 3600:282F EffResistSleepCharm30 — type 7Ch
export async function EffResistSleepCharm30(c, e, mode) {
  if (byte(await X.Roll(1, 100)) <= 30) { CancelDamageAndEffect(0x0B); CancelDamageAndEffect(0x35); }   // 3600:2832 / 2841 / 2848
}

// 3600:2855 EffUndeadImmunities — type 7Dh
export async function EffUndeadImmunities(c, e, mode) {
  CancelDamageAndEffect(0x0B); CancelDamageAndEffect(0x35); CancelDamageAndEffect(0x34); CancelDamageAndEffect(0x37);   // 3600:2858 .. 286d
  if (G.SaveType === 0) G.SaveRoll = 100;                             // 3600:2874 / 287b
}

// 3600:289C EffParalyzingGaze — type 7Eh
export async function EffParalyzingGaze(c, e, mode) {
  G.hold_Victim = cr(c).target;                                       // 3600:28a2
  await X.ShowCharacterMessage(c, 'gazes...', 0x0A, false);           // 3600:28b7
  await X.BuildFourAnimationFrames(0x12);                             // 3600:28d7
  await gazeAnim(c, G.hold_Victim);                                   // 3600:28df .. 291d
  if (!(await X.SavingThrow(G.hold_Victim, 1, 0))) {                  // 3600:2922
    await X.AddEffect(G.hold_Victim, 0x34, 0, 0xFF, 0);               // 3600:2939
    await X.ShowCharacterMessage(G.hold_Victim, 'is paralyzed', 0x0A, false);   // 3600:2952
  }
}

// 3600:297A EffImmuneMagic — type 81h
export async function EffImmuneMagic(c, e, mode) {
  if (G.EffectToApply !== 0 || (G.DamageType & 8) !== 0) CancelDamageAndEffect(0);   // 3600:297d / 2984 / 298f
}

// 3600:299C EffSlainBySpecialArrow — type 82h
export async function EffSlainBySpecialArrow(c, e, mode) {
  const p = ref(null);                                                // 3600:29a2
  if (await X.GetMissileAmmo(G.SelectedChar, p) && p.v && p.v.b[I_TYPE] === 0x1C && p.v.b[0x31] === 0x87) {   // 3600:29aa .. 29d2
    c.b[STATUS] = 8; c.b[ACTIVE] = 0; c.b[HP] = 0;                    // 3600:29dc / 29e5 / 29ee 8 = Gone
    await X.RemoveCombatEffects(c);                                   // 3600:29f7
    await X.CallEffectHooks(0x0D, c);                                 // 3600:2a02 event 0Dh
    if (c.b[ACTIVE] === 0) await X.RemoveCombatant(c);                // 3600:2a10 / 2a1b
  }
}

// 3600:2A2C ItemGrantsEffect — type 93h (e is the item)
export async function ItemGrantsEffect(c, e, mode) {
  G.item_HookMode = 0; const it = e;                                  // 3600:2a32 / 2a37
  if (mode !== 0) await X.RemoveEffect(c, it.b[0x3D], null);          // 3600:2a42 / 2a48
  else {
    await X.AddEffect(c, it.b[0x3D], 0, 0xFF, 1);                     // 3600:2a63
    if (G.view_Mode !== 5) await X.CallEffectHandler(it.b[0x3D], c, null, 0);   // 3600:2a7f / 2a86
  }
}

// 3600:2AA8 EffImmuneFearWeakness — type 85h
export async function EffImmuneFearWeakness(c, e, mode) {
  CancelDamageAndEffect(0x8E); CancelDamageAndEffect(0x1D); CancelDamageAndEffect(0x44);   // 3600:2aab / 2ab2 / 2ab9
  if ((G.DamageType & 0x40) !== 0) CancelDamageAndEffect(0);          // 3600:2ac0 / 2ac9
}

// 3600:2AD6 EffRangerBonusVsFlag8 — type 86h
export async function EffRangerBonusVsFlag8(c, e, mode) {
  G.hold_Victim = cr(c).target;                                       // 3600:2ad9
  if ((hv().b[KIND_FLAGS] & 8) !== 0) addB('DamageAmount', c.b[LEVEL + 4]);   // 3600:2aee / 2afd
}

// 3600:2B0F EffImmuneElectricity — type 87h
export async function EffImmuneElectricity(c, e, mode) { if ((G.DamageType & 4) !== 0) CancelDamageAndEffect(0); }   // 3600:2b12

// 3600:2B28 EffNoMove — type 88h
export async function EffNoMove(c, e, mode) { cr(c).b[CR_MOVELEFT] = 0; }   // 3600:2b2b

// 3600:2B3E EffTurnOnAllies — type 89h
export async function EffTurnOnAllies(c, e, mode) {
  if (mode === 0) {                                                   // 3600:2b41
    c.b[CONTROLLED] = 1;                                              // 3600:2b4a
    if (c.b[NPC_MORALE] <= 0x7F || c.b[NPC_MORALE] === 0xB3) c.b[NPC_MORALE] = 0xB3; else c.b[NPC_MORALE] = 0xB2;   // 3600:2b53 / 2b69 / 2b74
    cr(c).target = null;                                              // 3600:2b7d
    await pickBerserkTarget(c);                                       // 3600:2b8f / 2bc2 / 2bc7
    c.b[SIDE] = ((cr(c).target || zeroChar()).b[SIDE] ^ 1) & 0xFF;    // 3600:2be8
  } else {
    if (c.b[NPC_MORALE] === 0xB3) c.b[NPC_MORALE] = 0;                // 3600:2c05 / 2c10
    c.b[SIDE] = e ? e.b[E_P3] : 0;                                    // 3600:2c19 TODO(decode): e = nil reads garbage
  }
}

// 3600:2C2E EffPermanentInvisibility — type 8Ah
export async function EffPermanentInvisibility(c, e, mode) { await X.AddEffect(c, 0x19, 0xFF, 0xFF, 0); }   // 3600:2c31

// 3600:2C4F EffPaladinCuresReset — type 8Dh
export async function EffPaladinCuresReset(c, e, mode) {
  if (mode !== 0)                                                     // 3600:2c52
    c.b[CURES_LEFT] = byte(Math.trunc((c.b[LEVEL + 3] + c.b[OLD_LEVEL + 3] * await dca(c) - 1) / 5) + 1);   // 3600:2c58 / 2c86
}

// 3600:2C94 EffRunsAwayEnd — type 8Eh
export async function EffRunsAwayEnd(c, e, mode) {
  if (mode !== 0) {                                                   // 3600:2c97
    if (c.b[NPC_MORALE] === 0xB3) { c.b[NPC_MORALE] = 0; c.b[CONTROLLED] = 0; }   // 3600:2c9d / 2ca8 / 2cb1
    cr(c).b[CR_TURNED] = 0;                                           // 3600:2cba
  }
}

// 3600:2CD9 EffZapAttacker — type 8Fh
export async function EffZapAttacker(c, e, mode) {
  if (byte(await X.TargetDistance(G.SelectedChar, c)) < 2) {          // 3600:2cdf
    const oldDmg = G.DamageAmount; G.DamageAmount = byte(G.DamageAmount << 1);   // 3600:2cf6 / 2cfc
    const oldType = G.DamageType; G.DamageType = 8;                   // 3600:2d06 / 2d0c
    await X.ShowCharacterMessage(G.SelectedChar, 'gets zapped', 0x0A, true);   // 3600:2d11
    await X.DamageCharacter(G.SelectedChar, G.DamageAmount, 0, false);   // 3600:2d33
    G.DamageAmount = oldDmg; G.DamageType = oldType;                  // 3600:2d4a / 2d50
  }
}

// 3600:2D7D EffDispelEvil — type 91h
export async function EffDispelEvil(c, e, mode) {
  G.hold_Victim = cr(c).target;                                       // 3600:2d83
  if ((hv().b[KIND_FLAGS] & 1) !== 0 && !(await X.SavingThrow(G.hold_Victim, 4, 0))) {   // 3600:2d98 / 2da7
    await X.KillCombatant(G.hold_Victim, 8, 'is dispelled');          // 3600:2dbe 8 = Gone
    await X.RemoveEffect(G.SelectedChar, 4, null);                    // 3600:2ddd
    await X.RemoveEffect(G.SelectedChar, 0x91, null);                 // 3600:2df3
  } else await X.ShowCharacterMessage(G.hold_Victim, 'resists dispel evil', 0x0A, true);   // 3600:2e0b
}

// 3600:2E33 EffNop — types 05h, 13h, 18h, 5Ch, 7Fh, 8Ch, 92h (empty)
export async function EffNop(c, e, mode) {}                           // 3600:2e33

// 3600:2E3C InstallEffectHandlers: EffectHandler[t] = DS:6FA6 + 4t for t = 01h..93h; slots 56h, 58h, 5Ah, 80h, 83h, 84h
// are never written (nil). 39h / 57h / 60h / 8Bh / 90h are COMBAT handlers (bound by name through view_link.js).
export function handlerTable() {
  const ext = (name) => async (c, e, mode) => X[name](c, e, mode);
  return {
    0x01: EffBless, 0x02: EffCurse, 0x03: EffSnakes, 0x04: EffHitPenaltyVsFlag1, 0x05: EffNop, 0x06: EffFlameTongue,
    0x07: EffAcBonus2, 0x08: EffProtFromEvil, 0x09: EffProtFromGood, 0x0A: EffResistCold, 0x0B: EffCharm, 0x0C: EffNop0C,
    0x0D: EffSuffocate, 0x0E: EffNop0E, 0x0F: EffHpLossTick, 0x10: EffNop10, 0x11: EffShield, 0x12: EffHitBonusVsFlag2,
    0x13: EffNop, 0x14: EffResistFire, 0x15: EffSilence, 0x16: EffSlowPoisonEnd, 0x17: EffSpiritualHammer, 0x18: EffNop,
    0x19: EffInvisible, 0x1A: EffHitBonusVsFlag4, 0x1B: EffHelpless, 0x1C: EffMirrorImage, 0x1D: EffDamageMinusQuarter,
    0x1E: EffCoughing, 0x1F: EffHelpless, 0x20: EffAnimatedEnd, 0x21: EffPenaltyAll4, 0x22: EffWeaknessAndDrain,
    0x23: EffConfusion, 0x24: EffPenalty4, 0x25: EffUntouchableAfterTurn, 0x26: EffNop0C, 0x27: EffHaste,
    0x28: EffCloudRemoved, 0x29: EffMagicWeaponOnly, 0x2A: EffSlow, 0x2B: EffWeakness, 0x2C: EffHpDrainTick,
    0x2D: EffProtFromEvil, 0x2E: EffProtFromGood, 0x2F: EffDefenceVsLargeGiants, 0x30: EffDefenceVsLargeType1,
    0x31: EffPrayer, 0x32: EffFireVulnerable, 0x33: EffHelpless, 0x34: EffHelpless, 0x35: EffHelpless, 0x36: EffColdVulnerable,
    0x37: EffNop37, 0x38: EffGrantInvisible, 0x39: ext('EffEngulf'), 0x3A: EffHeld, 0x3B: EffBecome62,
    0x3C: EffNeedMagicWeaponHalf, 0x3D: EffFireResistance, 0x3E: EffRegenerate, 0x3F: EffMinorGlobe, 0x40: EffPoisonHit,
    0x41: EffPoisonHitP4, 0x42: EffPoisonHitP2, 0x43: EffParalyzeHit2d8, 0x44: EffFeeblemind, 0x45: EffInvisibleToType13,
    0x46: EffPoisonHitM2, 0x47: EffUnattackable, 0x48: EffGrantInvisible95, 0x49: EffImmuneDamage20, 0x4A: EffNop4A,
    0x4B: EffBonusVsType3, 0x4C: EffBonusVsType8, 0x4D: EffBerserk, 0x4E: EffReviveCheck, 0x4F: EffFireDamage,
    0x50: EffAcidDamage, 0x51: EffHalveDamage, 0x52: EffEvadeFireCold, 0x53: EffStoneGaze, 0x54: EffElectricityHeals,
    0x55: EffOneDamageFromWflag1, 0x57: ext('EffEyeRays'), 0x59: EffDisplacement, 0x5B: EffCloud9Removed, 0x5C: EffNop,
    0x5D: EffHalveFire, 0x5E: EffHalveWeapon, 0x5F: EffFallsDead, 0x60: ext('EffHug'), 0x61: EffConSaveBonusMagic,
    0x62: EffRegenerate3, 0x63: EffReviveOnce, 0x64: EffTrollDown, 0x65: EffStartRegenerating, 0x66: EffTrollRise,
    0x67: EffFireBonusD6, 0x68: EffAvoidMissiles60, 0x69: EffMagicRes50, 0x6A: EffMagicRes15, 0x6B: EffResistSleepCharm90,
    0x6C: EffImmuneSleepCharm, 0x6D: EffImmuneHold, 0x6E: EffImmuneCold, 0x6F: EffImmunePoisonParalysis, 0x70: EffImmuneFire,
    0x71: EffFireMinusOnePerDie, 0x72: EffHalveElectricity, 0x73: EffHalveEdged, 0x74: EffHalveMagicWeapon, 0x75: EffHolyWater,
    0x76: EffHalveCold, 0x77: EffNeedMagicWeapon, 0x78: EffAvoidBoulders, 0x79: EffSpitAcid, 0x7A: EffParalyzeOnHit,
    0x7B: EffColdDamage2d8, 0x7C: EffResistSleepCharm30, 0x7D: EffUndeadImmunities, 0x7E: EffParalyzingGaze, 0x7F: EffNop,
    0x81: EffImmuneMagic, 0x82: EffSlainBySpecialArrow, 0x85: EffImmuneFearWeakness, 0x86: EffRangerBonusVsFlag8,
    0x87: EffImmuneElectricity, 0x88: EffNoMove, 0x89: EffTurnOnAllies, 0x8A: EffPermanentInvisibility,
    0x8B: ext('EffEngulfHold'), 0x8C: EffNop, 0x8D: EffPaladinCuresReset, 0x8E: EffRunsAwayEnd, 0x8F: EffZapAttacker,
    0x90: ext('EffHugHold'), 0x91: EffDispelEvil, 0x92: EffNop, 0x93: ItemGrantsEffect,
  };
}

// 3600:2E3C InstallEffectHandlers (stub ov12 e1; caller ENGINE ov11_0056)
export function InstallEffectHandlers() {
  const t = handlerTable();
  if (!Array.isArray(G.EffectHandler)) G.EffectHandler = new Array(0x94).fill(null);
  // cab: v13-3 — v1.3's ov12 (2AD8) no longer installs 53h EffStoneGaze and 7Eh EffParalyzingGaze: both gaze handlers moved
  // to the magic unit (ov22 InitSpellTable: 53h := the stone gaze with the target-selector prologue, 7Eh := ov22's
  // EffParalysingGaze, which ov12's store shadowed in v1.0). decode/V13_DELTA.md 3.4.
  const skip = variant.is13 ? new Set([0x53, 0x7E]) : null;
  for (let k = 0x01; k <= 0x93; k++) if (t[k] && !(skip && skip.has(k))) G.EffectHandler[k] = t[k];   // 3600:2e3f .. 3568 (141 stores; nil slots untouched)
  return G.EffectHandler;
}

// 3600:356C ov12_init: empty.
