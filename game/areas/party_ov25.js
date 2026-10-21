// game/areas/party_ov25.js — PARTY ov25 (6600): level statistics, spell slots, saving throws, thief skills, the human
// dual-class change. Pool twin: Pool ov23 (9300) for WisdomBonusSpells / UpdateThiefSkills only; the rest is new.
// Owner: cab-build-areas. Source: decode/pseudo/PARTY.pas.md ov25 (verified). Re-read from decode/listings/ov25.lst:
//  - CurrentClass (6600:12ee): non-humans 11h; k runs while k < 7 and level[k] = 0; level[k] > 0 (signed) -> k, else 11h.
//    CurrentClassLevel (6600:134a): non-humans 0, else level[k] of the same search (no > 0 test).
//    DualClassActive (6600:13bc): CurrentClassLevel(c) > c^.b[E6h], a signed byte compare (JG).
//  - RecalcSpellSlots ranger part (6600:0210..02d5): druid slots +132h..+134h from RangerSlots k 1..3, magic-user slots
//    +137h/+138h from k 4..5; every class-1 spell 1..100 becomes known.
//  - MayChangeTo (6600:0d2f): RaceClasses rows are 14 bytes (race * 0Eh + k, DS:3FF8); the prime-requisite loops use a
//    signed k (JG 5); ClassAligns rows are 10 bytes (DS:41D8); ClassName entries are string[26] (27 bytes, DS:0CB6).
//  - UpdateLevelStats (6600:0505..0585): usable-by mask = ItemTypeTable[type] + 0Dh (DS:5D03 + type * 16).
// Tables (START.EXE image, read from G.ds): BaseThac0 3E38 (13 per class), ClassBit 3EA0, ClericSlots 42BA,
// PaladinSlots 43E3, RangerSlots 4446, SpellSlotTable 44A9 (5 per level), SaveTable 45BC (60 per class, 5 per level),
// ThiefBase 3EBE (8 per level), RaceSkillAdj 3F1E (8 per race, signed), DexSkillAdj 3F31 (5 per DEX, signed),
// ClassPrimeReq 4172 (6 per class), RaceClasses 3FF8, ClassAligns 41D8, ClassName 0CB6, spells_Table 37DA (16 per spell:
// +0 class, +1 level).
// Record fields (PARTY.pas.md ## Character record): +10h+2k ability max, +15h WIS, +17h DEX, +19h CON, +1Eh mem_spell,
// +73h base_thac0, +74h race, +75h class, +78h+id known_spell, +DFh+s save, +E5h level_main, +E6h level at the change,
// +E9h+k thief_skill, +109h+cls level, +111h+cls old_level, +11Bh alignment, +11Ch attacks, +127h xp, +12Bh class_mask,
// +12Dh..+13Bh spell slots; items: +2Eh type, +34h readied, +36h cursed/magic, +3Eh readied-item power;
// c.readied[0..12] = the far pointers +151h + 4k (JS references).

import { G, pstr } from '../engine/state.js';
import { ShowTimedBottomPrompt } from '../engine/text.js';
import { VerticalListMenu, FreeMenuList } from './view_ov26.js';

const sx8 = (v) => ((v & 0xFF) ^ 0x80) - 0x80;
const D = (a) => G.ds[a & 0xFFFF];
const S = (a) => sx8(G.ds[a & 0xFFFF]);
const lvlOf = (c, cls) => c.b[0x109 + cls];
const oldOf = (c, cls) => c.b[0x111 + cls];
const readied = (c, k) => (c.readied ? c.readied[k] ?? null : null);
const className = (cls) => { let s = ''; const a = 0x0CB6 + cls * 0x1B; for (let i = 1; i <= D(a); i++) s += String.fromCharCode(D(a + i)); return s; };
const addB = (c, o, v) => { c.b[o] = (c.b[o] + v) & 0xFF; };

// 6600:0011 RecalcSpellSlots(c)
export function RecalcSpellSlots(c) {
  c.b.fill(0, 0x12D, 0x12D + 0x0F);                                      // 6600:0017 all spell slots
  for (let cls = 0; cls <= 7; cls++) {                                   // 6600:0035
    const lvl = (DualClassActive(c) && oldOf(c, cls) !== 0) ? oldOf(c, cls) : lvlOf(c, cls);   // 6600:003b / 0070
    if (lvl <= 0) continue;                                              // 6600:0081
    switch (cls) {
      case 0:                                                            // cleric
        addB(c, 0x12D, 1);                                               // 6600:0094 one level-1 slot at level 1
        for (let L = 2; L <= lvl; L++) for (let k = 1; k <= 5; k++) addB(c, 0x12C + k, D(0x42BA + L * 5 + k));   // 6600:009c / 00da
        WisdomBonusSpells(c, false);                                     // 6600:00ed
        for (let sp = 1; sp <= 100; sp++)                                // 6600:00fa
          if (D(0x37DA + sp * 16) === 0 && c.b[0x12C + D(0x37DB + sp * 16)] > 0 && sp !== 0x24) c.b[0x78 + sp] = 1;   // 6600:0118 / 0146
        break;
      case 3:                                                            // paladin from level 9
        if (lvl > 8) {                                                   // 6600:015b
          for (let L = 9; L <= lvl; L++) for (let k = 1; k <= 5; k++) addB(c, 0x12C + k, D(0x43E3 + L * 5 + k));   // 6600:0164 / 01a2
          for (let sp = 1; sp <= 100; sp++)
            if (D(0x37DA + sp * 16) === 0 && c.b[0x12C + D(0x37DB + sp * 16)] > 0) c.b[0x78 + sp] = 1;   // 6600:01b5 / 01fb
        }
        break;
      case 4:                                                            // ranger from level 8
        if (lvl > 7) {                                                   // 6600:0210
          for (let L = 8; L <= lvl; L++) {
            for (let k = 1; k <= 3; k++) addB(c, 0x131 + k, D(0x4446 + L * 5 + k));       // 6600:025a druid slots
            for (let k = 4; k <= 5; k++) addB(c, 0x136 + k - 3, D(0x4446 + L * 5 + k));   // 6600:0298 magic-user 1..2
          }
          for (let sp = 1; sp <= 100; sp++) if (D(0x37DA + sp * 16) === 1) c.b[0x78 + sp] = 1;   // 6600:02bf / 02d0
        }
        break;
      case 5:                                                            // magic-user
        addB(c, 0x137, 1);                                               // 6600:02e4
        for (let L = 2; L <= lvl; L++) for (let k = 1; k <= 5; k++) addB(c, 0x136 + k, D(0x44A9 + L * 5 + k));   // 6600:02e9 / 0327
        break;
    }
  }
  for (let it = c.items; it; it = it.next)                               // 6600:0343 / 0353 / 039a
    if (it.b[0x3E] === 0x81 && it.b[0x34] !== 0)                         // 6600:035b / 0365
      for (let k = 1; k <= 3; k++) c.b[0x136 + k] = (c.b[0x136 + k] * 2) & 0xFF;   // 6600:036f / 038f power 81h doubles MU slots 1..3
}
// quirk: cleric spell 24h is never added to the spell book.

// 6600:03B1 UpdateLevelStats(c)
export function UpdateLevelStats(c) {
  c.b[0x73] = 0;                                                         // 6600:03b7 base_thac0
  for (let cls = 0; cls <= 7; cls++) {                                   // 6600:03bf
    const lvl = lvlOf(c, cls);                                           // 6600:03c8
    if (D(0x3E38 + cls * 13 + lvl) > c.b[0x73]) c.b[0x73] = D(0x3E38 + cls * 13 + lvl);   // 6600:03d9 / 03f9
    if (c.b[0xE5] < lvl) c.b[0xE5] = lvl;                                // 6600:0417 / 0424 level_main
    if ((cls === 2 && lvl > 6) || (cls === 4 && lvl > 7) || (cls === 3 && lvl > 6)) c.b[0x11C] = 3;   // 6600:042f .. 0469 3/2 attacks
  }
  RecalcSpellSlots(c); UpdateSaves(c);                                   // 6600:0478 / 0482
  if (lvlOf(c, 6) > 0) UpdateThiefSkills(c);                             // 6600:048c / 0497
  c.b[0x12B] = 0;                                                        // 6600:04a1 class_mask
  for (let cls = 0; cls <= 7; cls++)                                     // 6600:04aa
    if (lvlOf(c, cls) > 0 || (oldOf(c, cls) > 0 && oldOf(c, cls) < c.b[0xE5]))   // 6600:04b3 / 04c4 / 04d5
      c.b[0x12B] = (c.b[0x12B] + D(0x3EA0 + cls)) & 0xFF;                // 6600:04ed
  for (let k = 0; k <= 12; k++) {                                        // 6600:0505
    const it = readied(c, k);                                            // 6600:051b
    if (it && (D(0x5D03 + it.b[0x2E] * 16) & c.b[0x12B]) === 0 && it.b[0x36] === 0)   // 6600:0527 / 0555 / 0567
      it.b[0x34] = 0;                                                    // 6600:056e unusable items are unreadied (not cursed ones)
  }
  if (DualClassActive(c)) {                                              // 6600:058b
    for (let cls = 0; cls <= 7; cls++) {                                 // 6600:059c
      const lvl = oldOf(c, cls);                                         // 6600:05a5
      if (((cls === 2 || cls === 3) && lvl > 6) || (cls === 4 && lvl > 7)) c.b[0x11C] = 3;   // 6600:05b6 .. 05df
      if (D(0x3E38 + cls * 13 + lvl) > c.b[0x73]) c.b[0x73] = D(0x3E38 + cls * 13 + lvl);   // 6600:05e5 / 0605
    }
    if (oldOf(c, 2) > 6 || oldOf(c, 4) > 7 || oldOf(c, 3) > 6) c.b[0x11C] = 3;   // 6600:062c .. 064d
    if (oldOf(c, 6) > 0) UpdateThiefSkills(c);                           // 6600:0656 / 0661
  }
}

// 6600:0671 WisdomBonusSpells(c, rebuild)
export function WisdomBonusSpells(c, rebuild) {
  const lvl = sx8(lvlOf(c, 0) + oldOf(c, 0) * (DualClassActive(c) ? 1 : 0));   // 6600:0674
  if (lvl <= 0) return;                                                  // 6600:069f
  if (rebuild) {                                                         // 6600:06b1
    for (let k = 2; k <= 5; k++) c.b[0x12C + k] = 0;                     // 6600:06b7
    c.b[0x12D] = 1;                                                      // 6600:06d5
    for (let L = 2; L <= lvl; L++) for (let k = 1; k <= 5; k++) addB(c, 0x12C + k, D(0x42BA + L * 5 + k));   // 6600:06de / 071c
  }
  const wis = c.b[0x15];
  if (wis > 12 && c.b[0x12D] > 0) addB(c, 0x12D, 1);                     // 6600:072f
  if (wis > 13 && c.b[0x12D] > 0) addB(c, 0x12D, 1);                     // 6600:074c
  if (wis > 14 && c.b[0x12E] > 0) addB(c, 0x12E, 1);                     // 6600:0769
  if (wis > 15 && c.b[0x12E] > 0) addB(c, 0x12E, 1);                     // 6600:0786
  if (wis > 16 && c.b[0x12F] > 0) addB(c, 0x12F, 1);                     // 6600:07a3
  if (wis > 17 && c.b[0x130] > 0) addB(c, 0x130, 1);                     // 6600:07c0 new
}

// 6600:07E3 UpdateSaves(c)
export function UpdateSaves(c) {
  let ring = false;                                                      // 6600:07e9
  for (let it = c.items; it && !ring; it = it.next)                      // 6600:07ed / 07fd / 083a
    if (it.b[0x3E] > 0x80 && it.b[0x34] !== 0) ring = (it.b[0x3E] & 0x7F) === 6;   // 6600:080b / 0815 / 081f power 6
  for (let s = 0; s <= 4; s++) {                                         // 6600:084b
    c.b[0xDF + s] = 20;                                                  // 6600:0854
    let cls;
    for (cls = 0; cls <= 7; cls++)                                       // 6600:0863
      if (lvlOf(c, cls) > 0 && c.b[0xDF + s] > D(0x45BC + cls * 60 + lvlOf(c, cls) * 5 + s))   // 6600:086c / 0880
        c.b[0xDF + s] = D(0x45BC + cls * 60 + lvlOf(c, cls) * 5 + s);    // 6600:08c1
    cls = 7;                                                             // quirk: the former-class test runs after the loop (class 7 only)
    if (lvlOf(c, cls) > oldOf(c, cls) && c.b[0xDF + s] > D(0x45BC + cls * 60 + oldOf(c, cls) * 5 + s))   // 6600:0907 / 092a
      c.b[0xDF + s] = D(0x45BC + cls * 60 + oldOf(c, cls) * 5 + s);      // 6600:096b
    const con = c.b[0x19];
    if (s === 0 && (c.b[0x74] === 1 || c.b[0x74] === 5 || ring)) {       // 6600:09a8 / 09b1 / 09c5
      if (con >= 4 && con <= 6) addB(c, 0xDF, 1);                        // 6600:09d1
      else if (con >= 7 && con <= 10) addB(c, 0xDF, 2);
      else if (con >= 11 && con <= 13) addB(c, 0xDF, 3);
      else if (con >= 14 && con <= 17) addB(c, 0xDF, 4);                 // 6600:0a27
      else if (con === 18) addB(c, 0xDF, 5);                             // 6600:0a42
    }
    if (s === 0) {                                                       // 6600:0a56 .. 0ab5
      if (con === 19 || con === 20) addB(c, 0xDF, 1);
      else if (con === 21 || con === 22) addB(c, 0xDF, 2);
      else if (con === 23 || con === 24) addB(c, 0xDF, 3);
      else if (con === 25) addB(c, 0xDF, 4);
    }
  }
}

// 6600:0AD8 UpdateThiefSkills(c)
let thiefBonus = 0;   // local [BP-2]: only assigned for skills 1/2 with the elven item (TODO(decode): stack garbage otherwise; 0 here)
export function UpdateThiefSkills(c) {
  let elven = false, power2 = false;                                     // 6600:0ae7 / 0aeb
  for (let it = c.items; it && !elven && !power2; it = it.next) {        // 6600:0aef / 0aff / 0b51
    if (it.b[0x3E] > 0x80 && it.b[0x34] !== 0) {                         // 6600:0b13 / 0b1d
      elven = (it.b[0x3E] & 0x7F) === 0x0B; power2 = (it.b[0x3E] & 0x7F) === 2;   // 6600:0b27 / 0b42
    }
  }
  let lvl = (lvlOf(c, 6) + oldOf(c, 6) * (DualClassActive(c) ? 1 : 0)) & 0xFF;   // 6600:0b62
  if (lvl < 4 && power2) { lvl = 4; power2 = false; }                    // 6600:0b8a / 0b96
  const saved = lvl;                                                     // 6600:0b9e
  thiefBonus = 0;
  for (let k = 1; k <= 8; k++) {                                         // 6600:0ba4
    if (elven) {                                                         // 6600:0bad
      if (k === 1) { if (lvl < 5) { lvl = 5; thiefBonus = 0; } else thiefBonus = 5; }   // 6600:0bb3 .. 0bcd
      else if (k === 2) { if (lvl < 7) { lvl = 7; thiefBonus = 0; } else thiefBonus = 5; }   // 6600:0bd3 .. 0be8
    }
    const adj = S(0x3F1E + c.b[0x74] * 8 + k);                           // 6600:0bec
    const base = D(0x3EBE + lvl * 8 + k);
    if (adj < 0 && Math.abs(adj) + thiefBonus > base) c.b[0xE9 + k] = 0; // 6600:0c03 / 0c0a / 0c54
    else {
      c.b[0xE9 + k] = (base + adj + thiefBonus) & 0xFF;                  // 6600:0c67
      if (k < 6) c.b[0xE9 + k] = (c.b[0xE9 + k] + S(0x3F31 + c.b[0x17] * 5 + k)) & 0xFF;   // 6600:0cba / 0cc0
    }
    if (power2) c.b[0xE9 + k] = (c.b[0xE9 + k] + 10) & 0xFF;             // 6600:0d04 / 0d0a
    lvl = saved;                                                         // 6600:0d1a
  }
}

// 6600:0D2F MayChangeTo(cls) — nested in ChangeClass (c = the parent's parameter); the loop index is gfx_LoopCounter
function MayChangeTo(c, cls) {
  const cur = CurrentClass(c);
  let ok = D(0x3FF8 + c.b[0x74] * 14 + (G.gfx_LoopCounter & 0xFF)) !== cur;   // 6600:0d35 / 0d61
  let k = 0;
  while (k <= 5 && (D(0x4172 + cur * 6 + k) < 9 || c.b[0x10 + 2 * k] > 14)) k++;   // 6600:0d72 / 0d7c 15+ in the current prime requisites
  ok = ok && k > 5;                                                      // 6600:0dc0
  k = 0;
  while (k <= 5 && (D(0x4172 + cls * 6 + k) < 9 || c.b[0x10 + 2 * k] > 16)) k++;   // 6600:0dd5 / 0ddf 17+ in the new ones
  ok = ok && k > 5;                                                      // 6600:0e17
  k = 1;
  while (D(0x41D8 + cls * 10) >= k && D(0x41D8 + cls * 10 + k) !== c.b[0x11B]) k++;   // 6600:0e2c / 0e30
  ok = ok && D(0x41D8 + cls * 10) >= k;                                  // 6600:0e6f the alignment is allowed
  return ok;                                                             // 6600:0e92
}

// 6600:0EE1 ChangeClass(c) — 'Human Change Classes' (PartyCreationMenu 'H')
export async function ChangeClass(c) {
  const n = D(0x3FF8 + c.b[0x74] * 14);                                  // 6600:0ee8
  const list = { text: 'Pick New Class', isHeader: 1, next: null };      // 6600:0efe .. 0f2c GetMem(2Eh)
  let item = list, count = 1;                                            // 6600:0f3f
  for (G.gfx_LoopCounter = 1; G.gfx_LoopCounter <= n; G.gfx_LoopCounter++) {   // 6600:0f44 / 0f54
    const cls = D(0x3FF8 + c.b[0x74] * 14 + G.gfx_LoopCounter);          // 6600:0f5d
    if (MayChangeTo(c, cls)) {                                           // 6600:0f7b
      item.next = { text: className(cls).substring(0, 40), isHeader: 0, next: null };   // 6600:0f88 .. 0fbe
      item = item.next; count++;                                         // 6600:0fdd
    }
  }
  if (count === 1) {                                                     // 6600:0feb
    await ShowTimedBottomPrompt(pstr(c.b, 0) + " doesn't qualify.", 4, 0x0F);   // 6600:0ff1
    FreeMenuList({ v: list });                                           // 6600:1016
    return;
  }
  const sel = { v: list }, index = { v: 1 }, redraw = { v: true };       // 6600:1023 / 102e / 1037
  let key;
  do {
    key = await VerticalListMenu('', 'Select', 0x0D, 0x0A, 0x0F, 1, 2, 0x26, 0x16, list, true, redraw, index, sel);   // 6600:1087
    if (key === '\0') return;                                            // 6600:108f quirk: the list is not freed
  } while (key !== 'S');                                                 // 6600:1098
  c.b[0x127] = 0; c.b[0x128] = 0; c.b[0x129] = 0; c.b[0x12A] = 0;       // 6600:109e xp := 0
  c.b[0x11C] = 2;                                                        // 6600:10ad attacks
  let cls = 0;
  while (cls <= 7 && className(cls) !== (sel.v ? sel.v.text : '')) cls++;   // 6600:10b6 / 10c0
  FreeMenuList({ v: list });                                             // 6600:10e2
  c.b[0x111 + CurrentClass(c)] = CurrentClassLevel(c);                   // 6600:10ec / 1108 old_level[current]
  c.b[0xE6] = c.b[0xE5]; c.b[0xE5] = 1;                                  // 6600:110d / 111d level at the change
  c.b[0x109 + CurrentClass(c)] = 0; c.b[0x109 + cls] = 1;                // 6600:1126 / 113c
  c.b.fill(0, 0x12D, 0x12D + 0x0F);                                      // 6600:114b spell slots
  if (cls === 0) c.b[0x12D] = 1;                                         // 6600:1160 / 1167
  else if (cls === 5) {                                                  // 6600:1172
    c.b[0x137] = 1;                                                      // 6600:1176
    c.b[0x78 + 0x0B] = 1; c.b[0x78 + 0x12] = 1; c.b[0x78 + 0x0C] = 1; c.b[0x78 + 0x15] = 1;   // 6600:117f .. 119a
  }
  c.b[0x75] = cls;                                                       // 6600:11a3
  await ShowTimedBottomPrompt(pstr(c.b, 0) + ' is now a 1st level ' + className(cls) + '.', 0x0A, 0);   // 6600:11ad
  c.b.fill(0, 0x1E, 0x1E + 0x54);                                        // 6600:11f2 memorised spells
  UpdateLevelStats(c); WisdomBonusSpells(c, true); UpdateSaves(c); UpdateThiefSkills(c);   // 6600:1207 / 1211 / 121e / 1228
  for (let it = c.items; it; it = it.next)                               // 6600:1232 / 1242 / 127b
    if ((D(0x5D03 + it.b[0x2E] * 16) & c.b[0x12B]) === 0 && it.b[0x36] === 0) it.b[0x34] = 0;   // 6600:124a / 1269 / 1273
}

// 6600:1292 FormerClass(c): non-humans 11h
export function FormerClass(c) {
  if (c.b[0x74] !== 7) return 0x11;                                      // 6600:1298
  let k = 0; while (k < 7 && oldOf(c, k) === 0) k++;                     // 6600:12a8
  return sx8(oldOf(c, k)) > 0 ? k : 0x11;                                // 6600:12c8
}
// 6600:12EE CurrentClass(c): non-humans 11h
export function CurrentClass(c) {
  if (c.b[0x74] !== 7) return 0x11;                                      // 6600:12f4 / 12fe
  let k = 0; while (k < 7 && lvlOf(c, k) === 0) k++;                     // 6600:1304 .. 1322
  return sx8(lvlOf(c, k)) > 0 ? k : 0x11;                                // 6600:1324 .. 133d
}
// 6600:134A CurrentClassLevel(c): non-humans 0
export function CurrentClassLevel(c) {
  if (c.b[0x74] !== 7) return 0;                                         // 6600:1350 / 135a
  let k = 0; while (k < 7 && lvlOf(c, k) === 0) k++;                     // 6600:1360 .. 137e
  return lvlOf(c, k);                                                    // 6600:1380 .. 138e
}
// 6600:139A IsHuman(c)
export function IsHuman(c) { return c.b[0x74] === 7; }                   // 6600:13a0
// 6600:13BC DualClassActive(c): former-class levels count once the new class passes them
export function DualClassActive(c) { return sx8(CurrentClassLevel(c)) > sx8(c.b[0xE6]); }   // 6600:13c9 / 13cf JG

// 6600:0000 ov25_0000 / 6600:13E8 ov25_init: empty.
