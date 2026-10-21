// engine_ov17_create.js — ENGINE ov17 (4800) part: CreateCharacter, the hit-point routines, PayGold, TrainCharacter.
// Owner: cab-build-engine. Source: decode/pseudo/ENGINE.pas.md ov17; the parts the pseudocode summarises (the gender /
// class / alignment menus, the age tables, the ability-roll block 4800:15fb..2094, the training body) are translated
// statement by statement from decode/listings/ov17.lst (Pool's party_ov16a/b.js at 85fb6d6 was the semantic model only).
// Record offsets (1A6h record): +0 name, +10h+2i max / +11h+2i current ability i (STR INT WIS DEX CON CHA), +1Ch/+1Dh
// exceptional STR, +73h base THAC0, +74h race, +75h class, +76h age (word), +78h HP max, +79h.. known spells (+78h+id),
// +E4h move, +E5h/+E6h level counters (M), +E7h/+E8h levels / HP drained, +FBh.. money words, +103h platinum, +109h+c
// level in base class c, +111h+c former-class level, +119h gender, +11Bh alignment, +11Ch attacks, +11Eh/+120h base
// damage dice / sides, +124h AC, +125h, +126h id, +127h XP (LongInt), +12Bh class mask, +12Ch rolled HP, +12Dh..13Bh
// (15 bytes, spell-slot flags), +143h, +144h icon size, +145h..14Ah icon colours, +191h, +195h status, +196h, +1A4h HP.
// DS tables (verified in the listing): RaceName 0E9C (stride 10), GenderName 0F85 (7), AlignName 0EEC (11h), ClassName
// 0CB6 (1Bh), IconCol 3EC0+k (k 1..6), BaseThac0 3E38 (cls*0Dh + level), ClassBit 3EA0, ClassMask 3EA8 (RollHitDice /
// training bits), HitDiceLevels 3EB9, HitDiceCount 0818, HitDie 0820, RaceLimits 3F86 (race*16 + k), AgeCategory 4122
// (race*10 + 2i), ClassMin 4172 (class*6 + ability), StartAge 404C (race*1Ch + cls*4: word base, dice, sides),
// GoldDice 45B1 (cls*2), SpellTable 37DA (id*16), ConBonus 427F, XpForLevel 4291 (cls*63h + level*4, LongInt),
// CoinValue 0CA2 (LongInt[k]).

import { G, newChar, pstr, setPstr, rdW, wrW } from '../engine/state.js';
import { DrawText, ShowTimedBottomPrompt, ReadBottomLine, ClearRectangle } from '../engine/text.js';
import { AskYesNo } from '../engine/menus_cab.js';
import { Random } from '../engine/tp.js';
import { dev } from '../engine/dev.js';
import { NewMenuList, ListItem, FreeMenuList, VerticalListMenu } from './view_ov26.js';
import { X } from './view_link.js';
import { Roll } from './combat_ov23.js';   // 5F00:137F Roll(count, sides) is synchronous (RollHitDice calls it directly)

const byte = (v) => v & 0xFF;
const sb = (v) => ((v & 0xFF) ^ 0x80) - 0x80;                          // ShortInt
const i16 = (v) => ((v & 0xFFFF) ^ 0x8000) - 0x8000;                    // Integer
const ds = (a) => G.ds[a];
const dsW = (a) => G.ds[a] | (G.ds[a + 1] << 8);
const dsL = (a) => (G.ds[a] | (G.ds[a + 1] << 8) | (G.ds[a + 2] << 16) | (G.ds[a + 3] << 24)) | 0;
const rdL = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) | 0;
const wrL = (b, o, v) => { b[o] = v & 0xFF; b[o + 1] = (v >> 8) & 0xFF; b[o + 2] = (v >> 16) & 0xFF; b[o + 3] = (v >>> 24) & 0xFF; };
const lvl = (c, cls) => sb(c.b[0x109 + cls]);                            // levels are tested signed (JG / JLE)
const xpFor = (cls, l) => dsL(0x4291 + cls * 0x63 + byte(l) * 4);       // XpForLevel
const keyOf = (r) => (r !== null && typeof r === 'object' ? r.key : r);
const chr = (r) => { const k = keyOf(r); return typeof k === 'number' ? String.fromCharCode(k) : (k ?? '\0'); };

// one list pick of the creation menus (4800:091e / 0b9d / 0d09 / 119d): index 1, redraw and showExit on, prompt '',
// options 'Select' (cs:070A) -> the menu line `Select Exit`; with index = 1 menu_Top is clamped to 1, so the header item
// `Pick ...` is scrolled off and the first choice is on row 2 (#ref-5). Returns the 1-based index, or null for #0.
async function pick(list, screenId, want) {
  if (want !== undefined) return want;                                  // GBP #13 (dev createCharacter): the spec's pick
  const item = { v: list.v }, index = { v: 1 }, redraw = { v: 1 };      // 4800:091e .. 0932
  let key;
  do {
    dev.screenSoon(screenId);
    key = chr(await VerticalListMenu('', 'Select', 0x0D, 0x0A, 0x0F, 1, 2, 0x26, 0x16, list.v, 1, redraw, index, item));   // 4800:0982
    if (key === '\0') return null;                                      // 4800:098a
  } while (key !== 'S');                                                // 4800:09ab
  return index.v;
}

// GBP plus request #13 (dev only, hooks.dev.createCharacter, main_cab.js): the creation rules driven by a spec instead of
// the menu picks. Abilities: the original rolls, repeated (whole rerolls) until each asked ability reaches its value, at
// most SPEC_TRIES times; then the asked values are set (they are within RaceLimits / ClassMin, else refused unless cheat).
const SPEC_TRIES = 200;
const ABIL = ['str', 'int', 'wis', 'dex', 'con', 'cha'];
function specPick(spec, what, k) {
  if (!spec) return undefined;
  if (k === null || k === undefined || k < 1) throw new Error(`createCharacter: ${what} not offered by the creation menu`);
  return k;
}
// 'again' = reroll; otherwise the asked abilities are written (exact values)
function specAbilities(spec, b, Lim, Cmin, tries) {
  const g = b[0x119], want = [], st = spec.stats || {};
  for (let a = 0; a <= 5; a++) {
    const v = st[ABIL[a]];
    if (v === undefined || v === null) continue;
    const lo = Math.max(a === 0 ? Lim(0 + g) : Lim(6 + 2 * (a - 1)), Cmin(a)), hi = a === 0 ? Lim(2 + g) : Lim(7 + 2 * (a - 1));
    const t = v === 'max' ? hi : Number(v);
    if (!spec.cheat && (!(t >= lo) || !(t <= hi))) throw new Error(`createCharacter: ${ABIL[a]} ${t} outside ${lo}..${hi} (use cheat)`);
    want.push([0x11 + 2 * a, t]);
  }
  const met = want.every(([at, t]) => b[at] >= t);
  if (!met && tries < SPEC_TRIES) return 'again';
  for (const [at, t] of want) b[at] = t & 0xFF;
  if (spec.exc !== undefined && spec.exc !== null && b[0x11] === 18 && (sb(b[0x10B]) > 0 || sb(b[0x10D]) > 0 || sb(b[0x10C]) > 0)) {
    const t = spec.exc === 'max' ? Lim(4 + g) : Number(spec.exc);
    if (!spec.cheat && !(t >= 1 && t <= Lim(4 + g))) throw new Error(`createCharacter: exceptional strength ${t} outside 1..${Lim(4 + g)}`);
    b[0x1C] = t & 0xFF;
  }
  return 'ok';
}
// the experience for the asked levels (the creation training loop below then trains up to it)
function specXp(spec, b) {
  if (!Array.isArray(spec.levels)) return;
  let xp = rdL(b, 0x127);
  for (let cls = 0; cls <= 7; cls++) {
    const l = spec.levels[cls] | 0;
    if (l > 1 && sb(b[0x109 + cls]) > 0) { const need = xpFor(cls, l); if (need > xp) xp = need; }
  }
  wrL(b, 0x127, xp);
}

// 4800:0782 CreateCharacter — the record is written to <name>.guy only (Add Character loads it).
// `spec` (GBP #13, dev only): picks / name from the spec, no icon editor, nothing written; returns the record.
export async function CreateCharacter(spec = null) {
  const ch = newChar(), b = ch.b;                                       // 4800:0789 GetMem(ch, 1A6h) / 0797 FillChar
  let specTries = 0;
  for (let k = 1; k <= 6; k++) b[0x144 + k] = byte((ds(0x3EC0 + k) + 8) * 16 + ds(0x3EC0 + k));   // 4800:07ba .. 07ec
  b[0x124] = 0x32; b[0x73] = 0x28;                                      // 4800:07fa / 0803  AC 10, THAC0
  b[0x195] = 0; b[0x196] = 1; b[0xDE] = 1;                              // 4800:080b / 0814 / 081d
  b[0x126] = byte(Random(256));                                         // 4800:0827 RandomWord(256)
  b[0x143] = 0x0A;                                                      // 4800:0837
  const freeAll = (list) => { FreeMenuList(list); };                    // 4800:0995 + FreeMem(ch, 1A6h)

  // ---- race ----
  const list = { v: null };
  NewMenuList(list, 7);                                                 // 4800:0846
  list.v.isHeader = 1; list.v.text = 'Pick Race';                       // 4800:084e / 0861
  let raceLoop;
  for (raceLoop = 1; raceLoop <= 7; raceLoop++) {                       // 4800:0866
    if (raceLoop >= 1 && raceLoop <= 5)                                 // 4800:0872 / 0876  signed
      ListItem(list.v, raceLoop).text = ('  ' + pstr(G.ds, 0x0E9C + raceLoop * 10)).slice(0, 40);   // 4800:0885 .. 08bf
    else if (raceLoop === 7)                                            // 4800:08c6
      ListItem(list.v, raceLoop - 1).text = ('  ' + pstr(G.ds, 0x0E9C + raceLoop * 10)).slice(0, 40);   // 4800:08d6 .. 0910  Half-Orc not offered
  }
  raceLoop = 7;                                                         // the loop variable [BP-17h] after `for 1 to 7`
  let index = await pick(list, 'S024', specPick(spec, 'race', spec && (spec.race >= 1 && spec.race <= 5 ? spec.race : spec.race === 7 ? 6 : null)));
  if (index === null) { freeAll(list); return; }                        // 4800:0990 .. 09a8
  if (index === 6) index = 7;                                           // 4800:09b1 / 09b7
  b[0x74] = index;                                                      // 4800:09c9
  switch (b[0x74]) {                                                    // 4800:09d0  icon size + innate effects
    case 5: b[0x144] = 1; await X.AddEffect(ch, 0x61, 0, 0xFF, 0); break;                          // 4800:09db / 09f3  halfling
    case 1: b[0x144] = 1;                                                                           // 4800:0a02  dwarf
      await X.AddEffect(ch, 0x61, 0, 0xFF, 0); await X.AddEffect(ch, 0x1A, 0, 0xFF, 0); await X.AddEffect(ch, 0x2F, 0, 0xFF, 0); break;   // 4800:0a1a / 0a31 / 0a48
    case 3: b[0x144] = 1;                                                                           // 4800:0a57  gnome
      await X.AddEffect(ch, 0x61, 0, 0xFF, 0); await X.AddEffect(ch, 0x12, 0, 0xFF, 0);            // 4800:0a6f / 0a86
      await X.AddEffect(ch, 0x2F, 0, 0xFF, 0); await X.AddEffect(ch, 0x30, 0, 0xFF, 0); break;     // 4800:0a9d / 0ab4
    case 2: b[0x144] = 2; await X.AddEffect(ch, 0x6B, 0, 0xFF, 0); break;                          // 4800:0ac2 / 0ada  elf
    case 4: b[0x144] = 2; await X.AddEffect(ch, 0x7C, 0, 0xFF, 0); break;                          // 4800:0ae8 / 0b00  half-elf
    default: b[0x144] = 2;                                                                          // 4800:0b0a
  }
  FreeMenuList(list);                                                   // 4800:0b15

  // ---- gender ----
  NewMenuList(list, 3);                                                 // 4800:0b23
  list.v.isHeader = 1; list.v.text = 'Pick Gender';                     // 4800:0b2b / 0b3e
  for (let k = 0; k <= 1; k++) ListItem(list.v, k + 1).text = ('  ' + pstr(G.ds, 0x0F85 + k * 7)).slice(0, 40);   // 4800:0b43 .. 0b92
  index = await pick(list, 'S024-GENDER', specPick(spec, 'gender', spec && (spec.gender === 0 || spec.gender === 1) ? spec.gender + 1 : null));   // 4800:0c01
  if (index === null) { freeAll(list); return; }                        // 4800:0c0f .. 0c27
  b[0x119] = byte(index - 1);                                           // 4800:0c37
  FreeMenuList(list);                                                   // 4800:0c41

  // ---- class ----
  let n = ds(0x3FF8 + sb(b[0x74]) * 0x0E);                              // 4800:0c55  RaceClasses[race]: count
  NewMenuList(list, n + 1);                                             // 4800:0c68
  list.v.isHeader = 1; list.v.text = 'Pick Class';                      // 4800:0c70 / 0c83
  for (let k = 1; k <= n; k++)                                          // 4800:0c8e
    ListItem(list.v, k).text = ('  ' + pstr(G.ds, 0x0CB6 + sb(ds(0x3FF8 + sb(b[0x74]) * 0x0E + k)) * 0x1B)).slice(0, 40);   // 4800:0ca9 .. 0cfc
  index = await pick(list, 'S024-CLASS', specPick(spec, 'class', spec && (() => { for (let k = 1; k <= n; k++) if (ds(0x3FF8 + sb(b[0x74]) * 0x0E + k) === spec.cls) return k; return null; })()));   // 4800:0d6d
  if (index === null) { freeAll(list); return; }                        // 4800:0d7b .. 0d93
  wrL(b, 0x127, 25000);                                                 // 4800:0da8  experience of a single class
  b[0x75] = ds(0x3FF8 + sb(b[0x74]) * 0x0E + index);                    // 4800:0dd3
  b[0xE5] = 1;                                                          // 4800:0dda
  const L1 = (...cls) => { for (const k of cls) b[0x109 + k] = 1; };
  const cl = sb(b[0x75]);
  if (cl >= 0 && cl <= 2) b[0x109 + cl] = 1;                            // 4800:0de7 .. 0dfc
  else if (cl >= 5 && cl <= 7) b[0x109 + cl] = 1;                       // 4800:0e05 .. 0e1a
  else switch (cl) {
    case 3: b[0x191] = 1; b[0x10C] = 1; await X.AddEffect(ch, 8, 0, 0xFF, 0); break;               // 4800:0e2a / 0e33 / 0e4b  paladin
    case 4: b[0x10D] = 1; await X.AddEffect(ch, 0x86, 0, 0xFF, 0); break;                          // 4800:0e5a / 0e72  ranger
    case 8: L1(0, 2); wrL(b, 0x127, 12500); break;                                                  // 4800:0e81 .. 0e9a  C/F
    case 9: L1(0, 2, 5); wrL(b, 0x127, 8333); break;                                                // 4800:0eab .. 0ecd  C/F/MU
    case 10: L1(0, 4); await X.AddEffect(ch, 0x86, 0, 0xFF, 0); wrL(b, 0x127, 12500); break;        // 4800:0ede .. 0f0e  C/R
    case 11: L1(0, 5); wrL(b, 0x127, 12500); break;                                                 // 4800:0f1f .. 0f38  C/MU
    case 12: L1(0, 6); wrL(b, 0x127, 12500); break;                                                 // 4800:0f49 .. 0f62  C/T
    case 13: L1(2, 5); wrL(b, 0x127, 12500); break;                                                 // 4800:0f73 .. 0f8c  F/MU
    case 14: L1(2, 6); wrL(b, 0x127, 12500); break;                                                 // 4800:0f9d .. 0fb6  F/T
    case 15: L1(2, 5, 6); wrL(b, 0x127, 8333); break;                                               // 4800:0fc6 .. 0fe8  F/MU/T
    case 16: L1(5, 6); wrL(b, 0x127, 8333); break;                                                  // 4800:0ff8 .. 1011  MU/T
  }
  if (sb(b[0x10F]) > 0) await X.UpdateThiefSkills(ch);                  // 4800:101b / 1029
  b[0x12B] = 0; b[0x73] = 0;                                            // 4800:1031 / 103a
  for (let cls = 0; cls <= 7; cls++)                                    // 4800:103f
    if (lvl(ch, cls) > 0) {                                             // 4800:1051
      const t = ds(0x3E38 + cls * 0x0D + sb(b[0x109 + cls]));           // 4800:1077
      if (t > b[0x73]) b[0x73] = t;                                     // 4800:107e / 10a9  unsigned (JBE)
      b[0x12B] = byte(b[0x12B] + ds(0x3EA0 + cls));                     // 4800:10ba
    }
  await X.UpdateSaves(ch);                                              // 4800:10cb
  FreeMenuList(list);                                                   // 4800:10d5

  // ---- alignment ----
  n = ds(0x41D8 + sb(b[0x75]) * 10);                                    // 4800:10e9
  NewMenuList(list, n + 1);                                             // 4800:10fc
  list.v.isHeader = 1; list.v.text = 'Pick Alignment';                  // 4800:1104 / 1117
  for (let k = 1; k <= n; k++)                                          // 4800:1122
    ListItem(list.v, k).text = ('  ' + pstr(G.ds, 0x0EEC + sb(ds(0x41D8 + sb(b[0x75]) * 10 + k)) * 0x11)).slice(0, 40);   // 4800:113d .. 1190
  index = await pick(list, 'S024-ALIGN', specPick(spec, 'alignment', spec && (spec.alignment === null || spec.alignment === undefined ? 1 : (() => { for (let k = 1; k <= n; k++) if (ds(0x41D8 + sb(b[0x75]) * 10 + k) === spec.alignment) return k; return null; })())));   // 4800:1201
  if (index === null) { freeAll(list); return; }                        // 4800:120f .. 1227
  b[0x11B] = ds(0x41D8 + sb(b[0x75]) * 10 + index);                     // 4800:124d
  FreeMenuList(list);                                                   // 4800:1257

  // ---- age (word +76h) ----
  const ageEntry = (cls) => 0x404C + sb(b[0x74]) * 0x1C + cls * 4;      // StartAge: word base, dice, sides
  const setAge = (v) => wrW(b, 0x76, v);
  const maxAge = (cls) => { const a = ageEntry(cls); return (dsW(a) + ds(a + 2) * ds(a + 3)) & 0xFFFF; };   // base + dice*sides (IMUL)
  if (sb(b[0x75]) <= 7) {                                               // 4800:125f  JG (signed)
    const a = ageEntry(sb(b[0x75]));                                    // 4800:1285
    setAge(dsW(a) + byte(await X.Roll(ds(a + 2), ds(a + 3))));          // 4800:129f .. 12af
  } else switch (b[0x75]) {                                             // 4800:12c2  multi-class
    case 8: case 9: case 11: case 12: case 10: setAge(maxAge(0)); break;   // 4800:12ca / 131d / 1370 / 13c3 / 1561  cleric entry
    case 13: case 15: case 16: setAge(maxAge(5)); break;                // 4800:1416 / 14bc / 150f  magic-user entry
    case 14: setAge(maxAge(2)); break;                                  // 4800:1469  fighter entry
  }

  const saved = G.SelectedChar; G.SelectedChar = ch;                    // 4800:15ad .. 15c1
  await X.DrawCharacterSheet();                                         // 4800:15c5  ov19 e1

  // ---- abilities; "Reroll stats?" Y restarts here (4800:15ca) ----
  const age = () => rdW(b, 0x76);
  const A = (i) => dsW(0x4122 + sb(b[0x74]) * 10 + i * 2);              // AgeCategory[race][i]
  const Lim = (k) => ds(0x3F86 + sb(b[0x74]) * 16 + k);                 // RaceLimits[race][k]
  const Cmin = (a) => ds(0x4172 + sb(b[0x75]) * 6 + a);                 // ClassMin[class][ability]
  for (;;) {
    for (let cls = 0; cls <= 7; cls++) if (lvl(G.SelectedChar, cls) > 0) G.SelectedChar.b[0x109 + cls] = 1;   // 4800:15ca .. 15f9  back to level 1
    b[0x1C] = 0;                                                        // 4800:15fe
    for (let abil = 0; abil <= 5; abil++) {                             // 4800:1603
      const at = 0x11 + 2 * abil;                                       // current value
      b[at] = 0;                                                        // 4800:1617
      for (let tr = 1; tr <= 6; tr++) {                                 // 4800:161c  best of six
        let r = byte(byte(await X.Roll(3, 6)) + 1);                     // 4800:162b / 1632  Roll(3, 6) + 1
        switch (raceLoop) {                                             // 4800:1636  quirk: the race-list loop variable (always 7) -> never applies
          case 1: if (abil === 4) r++; else if (abil === 5) r--; break;
          case 2: if (abil === 3) r++; else if (abil === 4) r--; break;
          case 5: if (abil === 0) r--; else if (abil === 3) r++; break;
          case 6: if (abil === 0) r++; else if (abil === 4) r++; else if (abil === 5) r -= 2; break;
        }
        r = byte(r);
        if (b[at] < r) b[at] = r;                                       // 4800:16b0 / 16c7  unsigned
      }
      const clamp = (lo, hi) => { if (b[at] < lo) b[at] = lo; if (b[at] > hi) b[at] = hi; };
      const classMin = () => { if (b[at] < Cmin(abil)) b[at] = Cmin(abil); };
      const ag = age(), g = b[0x119];
      switch (abil) {                                                   // 4800:16dd
        case 0:                                                         // STR
          if (b[at] > 0 && A(0) < ag) b[at] = byte(b[at] + 1);          // 4800:16f2 .. 1720
          if (b[at] > 0 && A(1) < ag) b[at] = byte(b[at] - 1);          // 4800:172f .. 175d
          if (b[at] > 0 && A(2) < ag) b[at] = byte(b[at] - 2);          // 4800:176c .. 179a
          if (b[at] > 0 && A(3) < ag) b[at] = byte(b[at] - 1);          // 4800:17aa .. 17d8
          if (b[at] < Lim(0 + g)) b[at] = Lim(0 + g);                   // 4800:17f7 .. 1838  race/gender minimum
          if (b[at] > Lim(2 + g)) b[at] = Lim(2 + g);                   // 4800:1857 .. 1898  race/gender maximum
          classMin();                                                   // 4800:18b6 .. 18f6
          if (b[at] === 0x12 && (sb(b[0x10B]) > 0 || sb(b[0x10D]) > 0 || sb(b[0x10C]) > 0)) {   // 4800:18fd .. 1926  fighter / ranger / paladin
            b[0x1C] = byte(Random(100) + 1);                            // 4800:192c / 1935
            if (Lim(4 + g) < b[0x1C]) b[0x1C] = Lim(4 + g);             // 4800:1954 .. 1983
          }
          break;
        case 1:                                                         // INT
          if (A(1) < ag) b[at] = byte(b[at] + 1);                       // 4800:19a0 .. 19b8
          if (A(3) < ag) b[at] = byte(b[at] + 1);                       // 4800:19cb .. 19e3
          clamp(Lim(6), Lim(7));                                        // 4800:19f5 .. 1a6f
          classMin();                                                   // 4800:1a8d .. 1acd
          break;
        case 2:                                                         // WIS
          if (A(0) >= ag) b[at] = byte(b[at] - 1);                      // 4800:1aea .. 1b02  young
          if (A(1) < ag) b[at] = byte(b[at] + 1);                       // 4800:1b15 .. 1b2d
          if (A(2) < ag) b[at] = byte(b[at] + 1);                       // 4800:1b40 .. 1b58
          if (A(3) < ag) b[at] = byte(b[at] + 1);                       // 4800:1b6b .. 1b83
          clamp(Lim(8), Lim(9));                                        // 4800:1b95 .. 1c0f
          classMin();                                                   // 4800:1c2d .. 1c6d
          if (b[at] < 0x0D && b[0x75] >= 8 && b[0x75] <= 12) b[at] = 0x0D;   // 4800:1c7c .. 1ca2  set cs:0737 = [8..12]
          break;
        case 3:                                                         // DEX
          if (A(2) < ag) b[at] = byte(b[at] - 2);                       // 4800:1cc0 .. 1cd8
          if (A(3) < ag) b[at] = byte(b[at] - 1);                       // 4800:1cec .. 1d04
          clamp(Lim(0x0A), Lim(0x0B));                                  // 4800:1d16 .. 1d90
          classMin();                                                   // 4800:1dae .. 1dee
          break;
        case 4:                                                         // CON
          if (A(1) < ag) b[at] = byte(b[at] - 1);                       // 4800:1e0b .. 1e23
          if (A(2) < ag) b[at] = byte(b[at] - 1);                       // 4800:1e36 .. 1e4e
          if (A(3) < ag) b[at] = byte(b[at] - 1);                       // 4800:1e61 .. 1e79
          clamp(Lim(0x0C), Lim(0x0D));                                  // 4800:1e8b .. 1f05
          classMin();                                                   // 4800:1f23 .. 1f63
          break;
        case 5:                                                         // CHA: no age adjustment
          clamp(Lim(0x0E), Lim(0x0F));                                  // 4800:1f7f .. 1ff9
          classMin();                                                   // 4800:2017 .. 2057
          break;
      }
      await X.DrawAbility(abil, 0);                                     // 4800:2062  ov19 e3
    }
    if (spec && specAbilities(spec, b, Lim, Cmin, ++specTries) === 'again') continue;   // GBP #13: reroll
    b[0x1A4] = b[0x78];                                                 // 4800:2083  (old value; set again below)
    b[0x11C] = 2; b[0x11E] = 1; b[0x120] = 2;                           // 4800:208b / 2094 / 209d  attacks, base damage 1d2
    b[0x125] = 1; b[0xE4] = 0x0C;                                       // 4800:20a6 / 20af
    let goldSum = 0, nCls = 0;                                          // 4800:20b5 / 20b9
    b.fill(0, 0x12D, 0x12D + 0x0F);                                     // 4800:20cd  FillChar(+12Dh, 0Fh, 0)
    for (let cls = 0; cls <= 7; cls++) {                                // 4800:20d2
      if (lvl(ch, cls) <= 0) continue;                                  // 4800:20e4
      if (cls === 0) b[0x12D] = 1;                                      // 4800:20f9
      else if (cls === 5) b[0x137] = 1;                                 // 4800:2108
      goldSum = byte(goldSum + await X.Roll(ds(0x45B1 + cls * 2), ds(0x45B2 + cls * 2)));   // 4800:2128 / 212d  computed, never used (money is fixed)
      if (cls === 0) {                                                  // 4800:2133
        await X.WisdomBonusSpells(ch, 0);                               // 4800:2140
        for (let k = 1; k <= 0x64; k++)                                 // 4800:2145
          if (ds(0x37DA + k * 16) === 0 && ds(0x37DA + k * 16 + 1) === 1) b[0x78 + k] = 1;   // 4800:2166 .. 2180  every level-1 cleric spell
      } else if (cls === 5) {                                           // 4800:218d
        b[0x83] = 1; b[0x8A] = 1; b[0x84] = 1; b[0x8D] = 1;             // 4800:2194 .. 21af
      }
      nCls = byte(nCls + 1);                                            // 4800:21b5
    }
    void goldSum;
    wrW(b, 0x103, 300);                                                 // 4800:21c4  platinum 300
    b[0x12C] = byte(await RollHitDice(ch, 0xFF));                       // 4800:21d5 / 21db
    b[0x78] = b[0x12C];                                                 // 4800:21eb
    const bonus = sb(ConHpBonus(ch));                                   // 4800:21f6 / 21f9  CBW
    if (bonus < 0) {                                                    // 4800:21fd
      if (b[0x78] > Math.abs(bonus) + nCls) b[0x78] = byte(Math.trunc((b[0x78] + bonus) / nCls));   // 4800:2203 .. 223d  signed JLE, IDIV
      else b[0x78] = 1;                                                 // 4800:2246
    } else b[0x78] = byte(Math.trunc((b[0x78] + bonus) / nCls));        // 4800:224d .. 2266
    b[0x1A4] = b[0x78];                                                 // 4800:2274
    b[0x12C] = byte(Math.trunc(b[0x12C] / nCls));                       // 4800:2279 .. 2290
    // new in Curse: train the character up to its starting experience (the training hall opened for every class)
    const oldHall = G.ecl_Mem7C00[0x550 >> 1] & 0xFF;                   // 4800:2299  (byte read of the word)
    G.ecl_Mem7C00[0x550 >> 1] = 0xFF;                                   // 4800:22a5  VM 7EA8
    G.g_7586 = 0; G.g_4FC8 = 1;                                         // 4800:22ac / 22b1
    if (spec) specXp(spec, b);                                          // GBP #13: the experience for the asked levels
    do await TrainCharacter();                                          // 4800:22b7
    while (!G.g_7586);                                                  // 4800:22ba / 22bf  until no class can train any more
    G.ecl_Mem7C00[0x550 >> 1] = oldHall;                                // 4800:22ca
    G.g_4FC8 = 0;                                                       // 4800:22cf
    let levels = '', any = false;                                       // 4800:22d4 / 22d8
    const sel = G.SelectedChar;
    for (let cls = 0; cls <= 7; cls++) {                                // 4800:22dc
      const cur = lvl(sel, cls), prev = sb(sel.b[0x111 + cls]);
      let show = cur > 0;                                               // 4800:22ef / 22f5
      if (!show) {
        const ccl = sb(await X.CurrentClassLevel(sel));                 // 4800:22ff
        show = prev < ccl && prev > 0;                                  // 4800:2315 / 2326  signed
      }
      if (show) {
        if (any) levels = (levels + '/').slice(0, 40);                  // 4800:2331 .. 235a
        levels = (levels + String(byte(prev + cur))).slice(0, 40);      // 4800:2375 .. 23ad  ByteToStr
        any = true;                                                     // 4800:23b2
      }
    }
    DrawText(7, 0x0F, 0x0F, 0, levels);                                 // 4800:23d0
    await X.DrawCombatStats();                                          // 4800:23d5  ov19 e2
    await X.DrawMoney();                                                // 4800:23da  ov19 e4
    dev.screenSoon('S025');
    if (spec || chr(await AskYesNo('Reroll stats? ', 0x0D, 0x0A, 0x0F)) === 'N') break;   // 4800:23f7 / 23ff  any other key: reroll
  }
  await X.DrawCharacterSheet();                                         // 4800:2408  ov19 e1
  do {
    dev.screenSoon('S026');
    setPstr(b, 0, spec ? String(spec.name || 'PLUS').toUpperCase() : await ReadBottomLine('Character name: ', 0x0D, 0, 0x0F), 15);   // 4800:242b / 2439  StrAssign 15
  } while (b[0] === 0);                                                 // 4800:2441
  if (!spec) await X.IconEditor();                                      // 4800:2448  (GBP #13: the default icon)
  for (let abil = 0; abil <= 5; abil++) b[0x10 + 2 * abil] = b[0x11 + 2 * abil];   // 4800:244b .. 2476  max := current
  b[0x1D] = b[0x1C];                                                    // 4800:2482
  if (spec) { G.SelectedChar = saved; return ch; }                      // GBP #13: the record, nothing written
  dev.screenSoon('S027');
  if (chr(await AskYesNo('Save ' + pstr(b, 0) + '? ', 0x0D, 0x0A, 0x0F)) === 'N') {   // 4800:24b3 / 24bb
    G.SelectedChar = saved; return;                                     // 4800:24ca .. 24db  FreeMem(ch)
  }
  await X.WriteCharacter(ch, '');                                       // 4800:24f2  <name>.guy (ENGINE ov16)
  G.SelectedChar = saved;                                               // 4800:2500 .. 250d  FreeMem(ch)
}

// 4800:2515 ConHpAdj(cls): CON (+19h) of SelectedChar
export function ConHpAdj(cls) {
  const con = G.SelectedChar.b[0x19];                                   // 4800:251b
  if (con === 3) return -2;                                             // 4800:2525
  if (con >= 4 && con <= 6) return -1;                                  // 4800:2530
  if (con >= 7 && con <= 14) return 0;                                  // 4800:2540
  if (con === 15) return 1;                                             // 4800:2550
  if (con === 16) return 2;                                             // 4800:255b
  if (con >= 17 && con <= 19) return (cls === 2 || cls === 4 || cls === 3) ? sb(con - 14) : 2;   // 4800:2566 .. 2594
  return 0;                                                             // TODO(decode): CON < 3 / > 19 returns the uninitialised [BP-2] (not reachable by the rules)
}

// 4800:45E9 ConHpBonus(c)
export function ConHpBonus(c) {
  let bonus = 0;                                                        // 4800:45ef
  for (let cls = 0; cls <= 7; cls++) {                                  // 4800:45fc
    if (lvl(c, cls) <= 0) continue;                                     // 4800:460e
    if (!(c.b[0x109 + cls] < ds(0x3EB9 + cls))) continue;               // 4800:4631  unsigned JC: below HitDiceLevels
    bonus = byte(bonus + ds(0x427F + c.b[0x19]));                       // 4800:4643 / 4647  ConBonus[con]
    const cl = c.b[0x75];
    if (cl === 2 || cl === 3 || cl === 4) {                             // 4800:464d .. 4666
      const con = c.b[0x19];
      if (con === 17) bonus = byte(bonus + 1);                          // 4800:4676
      else if (con === 18) bonus = byte(bonus + 2);                     // 4800:4680
      else if (con === 19 || con === 20) bonus = byte(bonus + 3);       // 4800:4690
      else if (con >= 21 && con <= 23) bonus = byte(bonus + 4);         // 4800:46a0
      else if (con === 24 || con === 25) bonus = byte(bonus + 5);       // 4800:46b0
    }
    if (cls === 4 && c.b[0x109 + 4] === 1) bonus = byte(sb(bonus) * 2); // 4800:46b4 .. 46d1  ranger: two dice at level 1
  }
  return sb(bonus);                                                     // 4800:46dd
}

// 4800:46EC MinHitPoints(c)
export function MinHitPoints(c) {
  let n = 0, sum = 0;                                                   // 4800:46fb / 46ff
  for (let cls = 0; cls <= 7; cls++) {                                  // 4800:4703
    if (lvl(c, cls) <= 0) continue;                                     // 4800:4715
    sum = byte(sum + c.b[0x109 + cls]); n = byte(n + 1);                // 4800:472b / 472e
    if (cls === 4 || cls === 7) sum = byte(sum + 1);                    // 4800:4734 .. 4741
  }
  const bonus = sb(ConHpBonus(c));                                      // 4800:4751
  if (bonus < 0) {                                                      // 4800:4757
    if (sum > n + Math.abs(bonus)) sum = byte(Math.trunc((sum + bonus) / n));   // 4800:475d .. 4792
    else sum = 1;                                                       // 4800:4797
  } else sum = byte(Math.trunc((sum + bonus) / n));                     // 4800:479d .. 47b4
  return sum;                                                           // 4800:47b7
}

// 4800:47C6 MaxHitPoints(c)
export function MaxHitPoints(c) {
  let n = 0, sum = 0;                                                   // 4800:47d5 / 47d9
  for (let cls = 0; cls <= 7; cls++) {                                  // 4800:47dd
    if (lvl(c, cls) <= 0) continue;                                     // 4800:47ef
    const adj = sb(ConHpAdj(cls));                                      // 4800:47ff
    const l = sb(c.b[0x109 + cls]);
    n = byte(n + 1);                                                    // 4800:4824 / 4949
    if (c.b[0x109 + cls] < ds(0x3EB9 + cls)) {                          // 4800:481d  unsigned JC
      const add = [l * (adj + 8), l * (adj + 8), (adj + 10) * l, (adj + 10) * l, (l + 1) * (adj + 8), (adj + 4) * l, (adj + 6) * l, (l + 1) * (adj + 4)][cls];   // 4800:482e .. 4943
      sum = byte(sum + add);
    } else {                                                            // beyond the hit-dice levels: quirk: assignments, not sums
      const t = byte(l - ds(0x3EB9 + cls) + 1);                         // 4800:4949 .. 496c
      sum = byte([t * 2 + 0x48, 0x70, t * 3 + 0x5A, t * 3 + 0x5A, t * 2 + 0x58, t + 0x2C, t * 2 + 0x3C, 0x48][cls]);   // 4800:4976 .. 49e4
    }
  }
  return byte(Math.trunc(sum / n));                                     // 4800:49f1 .. 4a00  IDIV
}

// 4800:4A12 RollHitDice(c, mask): one hit-die roll (best of two) per class in mask below its hit-dice level
export function RollHitDice(c, mask) {
  let sum = 0;                                                          // 4800:4a18
  for (let cls = 0; cls <= 7; cls++) {                                  // 4800:4a1c
    if (lvl(c, cls) <= 0) continue;                                     // 4800:4a2e
    if ((ds(0x3EA8 + cls) & mask) === 0) continue;                      // 4800:4a3f .. 4a48
    if (c.b[0x109 + cls] < ds(0x3EB9 + cls)) {                          // 4800:4a65  unsigned JNC
      let dice = ds(0x0818 + cls);                                      // 4800:4a6f
      if (lvl(c, cls) > 1) dice = 1;                                    // 4800:4a7f / 4a87
      const r1 = byte(Roll(dice, ds(0x0820 + cls)));                  // 4800:4a9a
      const r2 = byte(Roll(dice, ds(0x0820 + cls)));                  // 4800:4ab1
      sum = byte(sum + (r2 > r1 ? r2 : r1));                            // 4800:4ab9 .. 4aca
    } else if (cls === 2 || cls === 3) sum = 3;                         // 4800:4ad2 .. 4ada  quirk: assignments
    else if (cls === 4 || cls === 0 || cls === 6) sum = 2;              // 4800:4ae0 .. 4aec
    else if (cls === 5) sum = 1;                                        // 4800:4af2 / 4af6
  }
  return sum;                                                           // 4800:4b03
}
// 4800:4B12 PayGold(gold: LongInt, c): pays gold in the coins the character has, cheapest first, then gives change
export function PayGold(gold, c) {
  gold = Math.imul(gold, 200) | 0;                                      // 4800:4b22  LongMul by 0C8h
  const value = (k) => dsL(0x0CA2 + k * 4);                             // CoinValue[k]
  const money = (k) => rdW(c.b, 0xFB + 2 * k), setMoney = (k, v) => wrW(c.b, 0xFB + 2 * k, v);
  let k = 0;                                                            // 4800:4b2d
  while (gold > 0 && k < 0x40) {                                        // 4800:4b3a  (no bound in the original; coins 0..6)
    let q = (Math.trunc(gold / value(k)) + 1) & 0xFFFF;                 // 4800:4b63 / 4b68  LongDivMod + 1, low word
    if (money(k) < q) q = money(k);                                     // 4800:4b81 .. 4b96
    gold = (gold - Math.imul(q, value(k))) | 0;                         // 4800:4bae / 4bb3
    setMoney(k, money(k) - q);                                          // 4800:4bc7
    k = byte(k + 1);                                                    // 4800:4bcf
  }
  if (gold < 0) {                                                       // 4800:4bd7
    gold = Math.abs(gold);                                              // 4800:4bed  LongAbs
    k = 4;                                                              // 4800:4bf8
    while (gold > 0 && sb(k) >= 0) {                                    // 4800:4bfc
      const q = Math.trunc(gold / value(k)) & 0xFFFF;                   // 4800:4c1f
      gold = (gold - Math.imul(q, value(k))) | 0;                       // 4800:4c3c / 4c41
      setMoney(k, money(k) + q);                                        // 4800:4c55
      k = byte(k - 1);                                                  // 4800:4c5d
    }
  }
}

// 4800:4D2A TrainCharacter — training hall (top menu 'T'; CreateCharacter with g_4FC8 = 1 trains silently)
export async function TrainCharacter() {
  const FT = () => G.FreeTraining !== 0 && G.FreeTraining !== undefined;
  const create = () => (G.g_4FC8 ?? 0) !== 0;
  if (G.SelectedChar.b[0x195] !== 0 && !FT()) {                         // 4800:4d35 / 4d3d
    await ShowTimedBottomPrompt('we only train conscious people', 0x0E, 0); return;   // 4800:4d59
  }
  const gp = await X.MoneyInGold(G.SelectedChar);                       // 4800:4d69  ov19 e11 (LongInt)
  if (gp < 1000 && !FT() && !create() && !G.g_8B6F) {                   // 4800:4d6e .. 4d8d
    await ShowTimedBottomPrompt('Training costs 1000 gp.', 0x0E, 0); return;   // 4800:4da4
  }
  let canBits = 0, haveBits = 0, xpCap = 0;                             // 4800:4dac .. 4db9
  const hall = G.ecl_Mem7C00[0x550 >> 1] & 0xFF;                        // 4800:4dc0  VM 7EA8 (byte)
  const c = G.SelectedChar, b = c.b;                                    // 4800:4dc8
  let l = 0;                                                            // [BP-19h]: the level of the last class looked at (stale below)
  for (let cls = 0; cls <= 7; cls++) {                                  // 4800:4dda
    if (lvl(c, cls) <= 0) continue;                                     // 4800:4dec
    haveBits = byte(haveBits + ds(0x3EA8 + cls));                       // 4800:4dfd / 4e01
    let blocked = false;                                                // 4800:4e04
    l = b[0x109 + cls];                                                 // 4800:4e16
    const str = b[0x11], int = b[0x13];
    switch (b[0x74]) {                                                  // 4800:4e1c  demi-human level limits
      case 1: if (cls === 2 && (l === 9 || (l === 8 && str === 17) || (l === 7 && str < 17))) blocked = true; break;   // 4800:4e24 .. 4e50  dwarf
      case 2:                                                                                                          // elf
        if (cls === 2 && (l === 7 || (l === 6 && str === 17) || (l === 5 && str < 17))) blocked = true;                // 4800:4e5b .. 4e87
        if (cls === 5 && (l === 11 || (l === 9 && int < 17) || (l === 10 && int === 17))) blocked = true;              // 4800:4e8b .. 4eb7
        break;
      case 3: if (cls === 2 && (l === 6 || (l === 5 && str < 18))) blocked = true; break;                               // 4800:4ec2 .. 4ede  gnome
      case 4:                                                                                                          // half-elf
        if (cls === 0 && l === 5) blocked = true;                                                                      // 4800:4ee9 .. 4ef5
        else if ((cls === 2 || cls === 4) && (l === 8 || (l === 7 && str === 17) || (l === 6 && str < 17))) blocked = true;   // 4800:4efb .. 4f2d
        if (cls === 5 && (l === 8 || (l === 7 && int === 17) || (l === 6 && int < 17))) blocked = true;                // 4800:4f31 .. 4f5d
        break;
      case 5: if (cls === 2 && (l === 6 || (l === 5 && str === 17) || (l === 4 && str < 17))) blocked = true; break;   // 4800:4f67 .. 4f93  halfling
    }
    if (blocked) continue;                                              // 4800:4f97
    const next = xpFor(cls, l + 1);                                     // 4800:4fb9
    if (!(next <= rdL(b, 0x127) || FT())) continue;                     // 4800:4fc2 .. 4fd9  signed
    if (!(next > 0)) continue;                                          // 4800:4ff5 .. 5008  -1 = no further level
    if (FT() && next > rdL(b, 0x127)) wrL(b, 0x127, next);              // 4800:500b .. 5097  free training: the XP is raised
    canBits = byte(canBits + ds(0x3EA8 + cls));                         // 4800:50a2 / 50a6
    const nextXp = xpFor(cls, l + 2);                                   // 4800:50c4
    if (nextXp > 0 && rdL(b, 0x127) >= nextXp && nextXp > xpCap) xpCap = (nextXp - 1) | 0;   // 4800:50d0 .. 5113
  }
  if (!create()) {                                                      // 4800:511f  outside creation only one class trains
    let best = 0, bestCls = 0;                                          // 4800:5129 .. 5136
    for (let cls = 0; cls <= 7; cls++)                                  // 4800:5139
      if ((ds(0x3EA8 + cls) & canBits) !== 0) {                         // 4800:5148 .. 5151
        const v = xpFor(cls, l + 1);                                    // 4800:516c  quirk: the stale level [BP-19h]
        if (v > best) { best = v; bestCls = cls; }                      // 4800:5172 .. 51a6
      }
    if (best > 0) {                                                     // 4800:51af
      canBits = ds(0x3EA8 + bestCls);                                   // 4800:51c6 / 51ca
      const nextXp = xpFor(bestCls, l + 2);                             // 4800:51e8
      if (nextXp > 0 && rdL(b, 0x127) >= nextXp && nextXp > xpCap) xpCap = (nextXp - 1) | 0;   // 4800:51f4 .. 5237
    }
  }
  if (xpCap > 0 && !create()) wrL(b, 0x127, xpCap);                     // 4800:523a .. 525c  quirk: before the hall checks
  let trainBits;
  if (!FT()) {                                                          // 4800:5261
    if ((haveBits & hall) === 0 && !create()) {                         // 4800:5268 .. 5277
      await ShowTimedBottomPrompt("We don't train that class here", 0x0E, 0); return;   // 4800:528e
    }
    if ((canBits & hall) === 0) {                                       // 4800:5298 / 52a0
      G.g_7586 = 1;                                                     // 4800:52a2  "nothing to train" (CreateCharacter's loop ends)
      if (!create()) await ShowTimedBottomPrompt('Not Enough Experience', 0x0E, 0);   // 4800:52a7 / 52c3
      return;
    }
    trainBits = byte(canBits & hall);                                   // 4800:52d2
  } else trainBits = canBits;                                           // 4800:52dd
  if (!create()) {                                                      // 4800:52e3
    ClearRectangle(1, 1, 0x26, 0x16);                                   // 4800:52f9
    let row = 4;                                                        // 4800:52fe
    await X.DrawCharacterName(G.SelectedChar, 4, row, 0);               // 4800:5314
    DrawText(b[0] + 4, row, 0x0A, 0, ' will become:');                  // 4800:533e
    for (let cls = 0; cls <= 7; cls++)                                  // 4800:5343
      if (lvl(c, cls) > 0 && (ds(0x3EA8 + cls) & trainBits) !== 0) {    // 4800:5355 / 536a
        row++;                                                          // 4800:5374
        const t = String(byte(b[0x109 + cls] + 1)) + ' ' + pstr(G.ds, 0x0CB6 + cls * 0x1B);   // ByteToStr + ' ' + ClassName
        if (row === 5) DrawText(6, row, 0x0A, 0, ('    a level ' + t).slice(0, 255));     // 4800:53db
        else DrawText(6, row, 0x0A, 0, ('and a level ' + t).slice(0, 255));                // 4800:5440
      }
    dev.screenSoon('S032');
    if (chr(await AskYesNo('Do you wish to train? ', 0x0D, 0x0A, 0x0F)) !== 'Y') return;   // 4800:5466 / 546b
    await X.ShowTimedBottomMessage('Congratulations...');               // 4800:5481
    if (!FT() && !G.g_8B6F) PayGold(1000, G.SelectedChar);              // 4800:5486 .. 54a4
  }
  let nCls = 0;                                                         // 4800:54a7
  const oldMu = sb(b[0x10E]), oldRanger = sb(b[0x10D]);                 // 4800:54ae / 54b9
  void oldRanger;
  b[0x12B] = 0;                                                         // 4800:54c4
  for (let cls = 0; cls <= 7; cls++) {                                  // 4800:54ca
    if (lvl(c, cls) <= 0) continue;                                     // 4800:54dc
    nCls = byte(nCls + 1);                                              // 4800:54e4
    if ((ds(0x3EA8 + cls) & trainBits) === 0) continue;                 // 4800:54ed .. 54f6
    b[0x109 + cls] = byte(b[0x109 + cls] + 1);                          // 4800:5501
    if (b[0xE7] > 0) {                                                  // 4800:5509  levels drained (unsigned)
      b[0xE8] = byte(b[0xE8] - Math.trunc(b[0xE8] / b[0xE7]));          // 4800:5511 .. 552d
      b[0xE7] = byte(b[0xE7] - 1);                                      // 4800:5535
    }
  }
  await X.UpdateLevelStats(G.SelectedChar);                             // 4800:5548
  if (!create()) {                                                      // 4800:554d
    if (sb(b[0x10E]) > oldMu || sb(b[0x10D]) > 8) {                     // 4800:555c / 5564  signed
      const index = { v: -1 }, count = { v: 0 };                        // 4800:556c
      let spell;
      do spell = byte(await X.SpellList(4, 4, index, count));           // 4800:5581
      while (!(spell > 0 || count.v === 0));                            // 4800:5589 / 558f
      if (spell > 0) b[0x78 + spell] = 1;                               // 4800:5595 .. 55a5
    }
  } else switch (b[0x10E]) {                                            // 4800:55b4  creation: the magic-user's spells per level
    case 2: b[0x87] = 1; break;                                         // 4800:55c0
    case 3: b[0x9A] = 1; b[0x82] = 1; break;                            // 4800:55cf / 55d8
    case 4: b[0x97] = 1; break;                                         // 4800:55e7
    case 5: b[0xA7] = 1; break;                                         // 4800:55f6
  }
  if (!(sb(b[0xE5]) > sb(b[0xE6]))) return;                             // 4800:55ff .. 560e  (M: level counters)
  const hpRoll = RollHitDice(G.SelectedChar, trainBits);                // 4800:561e
  let gain = Math.trunc(hpRoll / nCls); if (gain === 0) gain = 1;       // 4800:5626 .. 563c
  b[0x12C] = byte(b[0x12C] + gain);                                     // 4800:5647
  const bonus = sb(ConHpBonus(G.SelectedChar));                         // 4800:5655 / 5658
  gain = Math.trunc((hpRoll + bonus) / nCls); if (gain < 1) gain = 1;   // 4800:5663 .. 5675
  const wounds = byte(b[0x78] - b[0x1A4]);                              // 4800:567d .. 5691
  b[0x78] = byte(b[0x78] + gain);                                       // 4800:569a
  b[0x1A4] = byte(b[0x78] - wounds);                                    // 4800:56b3
}

export { rdL, wrL };
