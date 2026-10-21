// game/areas/magic_ov22.js — MAGIC ov22 (5800): spell lists, casting, the spell handlers, scroll helpers, InitSpellTable.
// Owner: cab-build-areas. Source: decode/pseudo/MAGIC.pas.md ov22 parts A and B (verified, #verify-39..43 applied); the
// summarised routines (AddSpellLine, AddScrollSpells, ConeTargets + nested SetLine/ClampXY/CollectLine, the stinking-cloud
// and cloudkill tile searches, Spell_DispelMagic, LightningBolt, Fire Shield, the breath handlers) translated from
// decode/listings/ov22.c (Ghidra parameter lists read right-to-left = Pascal order) and checked on ov22.lst.
// Findings from the listing (code follows the listing):
//  - SpellUsable (5800:0020): magic-user (class 2) is refused when race = 7 with readied[2] set in combat and
//    (ranger level < 9 and former ranger < 9 — or no current / former magic-user level); the pseudocode's and/or grouping
//    is read as compiled.
//  - ConeTargets (5800:175b): the centre line's step directions are recorded and repeated cyclically until the length is
//    used up (orthogonal 2, diagonal 3 half squares, only while the aim stays inside 1..48 x 1..23); TraceLine is called
//    with an UNINITIALISED range (5800:18b3, TODO(decode): FFh here); the duplicate flag of the centre-line collection is
//    never reset once set (quirk); the side lines use the direction of the last centre-line step that HIT an occupant;
//    width 2 adds the DS:0A20/0A28 side line, width 3 also DS:0A10/0A18.
//  - Fire Shield (5800:4bec): 'C' applies effect 36h with an EMPTY message (only 'H' prints 'is protected').
//  - Fear (5800:4a8f): ApplyEffect(t, 8Eh, dur, p3 0, callOnRemove 1, negateOnSave 1, saved, 'runs in terror').
//  - Spell_StinkingCloud / Spell_CloudKill: cloud records +8.. saved tile of square k (= +7+k), +11h.. placed (= +10h+k);
//    the cloudkill tile search stops at the first matching record of a list (flag), the stinking-cloud search does not;
//    cloudkill re-writes square 9 after its loop (5800:54b0, harmless).
//  - Spell_DispelMagic (5800:32b7..): the cloud squares are tested with CloudSquareDir[j] (DS:27D7 + j) for BOTH lists, so
//    j = 5..9 of a cloudkill read the bytes after the 4-entry table (DS:27DC.. = CloudDirs9[1..]) — read from G.ds as compiled.
//  - LightningBolt (5800:3a03): the step budget `left` is reduced by (L.dist - steps) in byte arithmetic, and `steps` is not
//    reset when a reflected line starts (quirk kept).
//  - DispelChance uses DualClassActive(SelectedChar) for the cloud caster's former level (quirk, as the pseudocode says).
// Conventions: SpellTargets = G.SpellTargets[1..SpellTargetCount] (character refs); SpellHandlers: G.SpellHandlers[0] is a
// routine NAME (the target selector: 'SelectTargetsCamp' / 'CollectSpellTargets', called as X[name](spell, auto, var ok));
// G.SpellHandlers[1..100] hold function references (filled by InitSpellTable from SPELL_HANDLERS). The spell table
// (spells_Table DS:37DA, 16 bytes per id) and the names (DS:27BD + id*29h) are pure image data read from G.ds; InitSpellTable
// does not build or modify them. Cloud nodes (party_ov12.js shape): { owner, next, ground[1..9], active[1..9], x, y, id,
// tried } (tried = +1Dh dispel-tried). Effect records { b: Uint8Array(9), next } (+0 type, +3 p3).

import { G, pstr } from '../engine/state.js';
import { DrawText, ClearRectangle, MessageDelay } from '../engine/text.js';
import { PlayOrStopSound } from '../engine/audio_cab.js';
import { view, DX, DY, sx8 } from './view_ov30.js';
import { HorizontalMenu, AskYesNo, VerticalListMenu, FreeMenuList } from './view_ov26.js';
import { LineInit, LineStep, newLine, TraceLine, Sign, InFrontArc, BuildTargetList } from './view_ov31.js';
import { CellAt, CombatantCol, CombatantRow, CombatantIndex, PlaceCombatant, RestoreTerrain, FocusSquare, ShowCombatant,
  IsVisible } from './view_ov32.js';
import { X } from './view_link.js';
import { dev } from '../engine/dev.js';

// dev only (?screen=<id>, acceptance/areas_shots.sh): signal the screenshot and hold the game 1.5 s, so a timed line is
// still on screen when the shot is taken (the rest loop would draw the next one); nothing happens for other targets
async function shotHold(...ids) {
  if (!ids.includes(dev.target)) return;
  dev.screenSoon(dev.target); await new Promise((r) => setTimeout(r, 1500));
}

const ds = (a) => G.ds[a & 0xFFFF];
const sb = (v) => ((v & 0xFF) ^ 0x80) - 0x80;
const ST = (id, o) => ds(0x37DA + (id & 0xFF) * 16 + o);   // spells_Table[id] +o
const LEVEL = (id) => ST(id, 1);
const spellName = (id) => pstr(G.ds, 0x27BD + (id & 0xFF) * 0x29);   // SpellNames
const levelHeading = (l) => pstr(G.ds, 0x0875 + (l & 0xFF) * 0x29);  // LevelHeading
const IT = (t, o) => ds(0x5CF6 + (t & 0xFF) * 16 + o);              // ItemTypeTable[t] (+0 slot)
const cost = (t) => ds(0x26A2 + (t & 0xFF) * 4);                      // CombatTerrain[t].cost
const csd = (j) => ds(0x27D7 + j);                                    // CloudSquareDir[j]
const cd9 = (j) => ds(0x27DB + j);                                    // CloudDirs9[j]
const tg = () => { if (!Array.isArray(G.SpellTargets)) G.SpellTargets = []; return G.SpellTargets; };
const T1 = () => tg()[1];
const cb = (c) => c.combat.b;
const hp = (c) => c.b[0x1A4];
const msgC = (c, s, wait = 1) => X.ShowCharacterMessage(c, s, 10, wait);
const ids = () => { if (!Array.isArray(G.sl_Ids)) G.sl_Ids = new Array(84).fill(0); return G.sl_Ids; };
const counts = () => { if (!Array.isArray(G.sl_Counts)) G.sl_Counts = new Array(84).fill(0); return G.sl_Counts; };
const idAt = (i) => (i < 0 ? counts()[83] : ids()[i]);                // sl_Ids[-1] reads the byte before (sl_Counts[83])
const node = () => ({ text: '', isHeader: 0, next: null });
const handlers = () => { if (!Array.isArray(G.SpellHandlers)) G.SpellHandlers = [null]; return G.SpellHandlers; };
const selectTargets = async (spell, auto, ok) => X[handlers()[0] || 'SelectTargetsCamp'](spell, auto, ok);   // SpellHandlers[0]
const okFlag = async (spell) => { const ok = { v: !!G.g_7746 }; await selectTargets(spell, 1, ok); G.g_7746 = ok.v ? 1 : 0; return ok.v; };

// ======================================================================================================
// part A: lists, casting core, targeting helpers
// ======================================================================================================

// 5800:0020 SpellUsable(c, id)
export async function SpellUsable(c, id) {
  id &= 0x7F;                                                            // 5800:0026
  const lv = (n) => sb(c.b[0x109 + n]), old = (n) => sb(c.b[0x111 + n]);
  switch (ST(id, 0)) {                                                   // 5800:0032
    case 0:                                                              // cleric (paladin 9+)
      if (c.b[0x15] < 9) return false;                                   // 5800:0045
      if (lv(0) < 1 && (!await X.DualClassActive(c) || old(0) < 1) && lv(3) < 9 && (old(3) < 9 || !await X.DualClassActive(c))) return false;
      return true;
    case 1:                                                              // druid (ranger 7+)
      if (c.b[0x15] < 9) return false;                                   // 5800:00b3
      if (lv(4) < 7 && (!await X.DualClassActive(c) || old(4) < 7)) return false;
      return true;
    case 2:                                                              // magic-user
      if (c.b[0x13] < 9) return false;                                   // 5800:00ff
      if (c.b[0x74] === 7 && c.readied && c.readied[2] && G.view_Mode === 5 && lv(4) < 9 &&   // 5800:0109 .. 0171
          ((!await X.DualClassActive(c) || old(4) < 9) || (lv(5) < 1 && (!await X.DualClassActive(c) || old(5) < 1)))) return false;
      return true;
    case 3: return false;                                                // 5800:021f
  }
  return false;                                                          // TODO(decode): other classes leave the local unset
}

// 5800:0219 ChooseSpell(mode, var page)
export async function ChooseSpell(mode, page) {
  const opt = { 1: 'Cast', 2: 'Memorize', 3: 'Scribe', 4: 'Learn' }[mode] || '';   // 5800:0229 .. 028c
  const prompt = mode >= 1 && mode <= 4 ? 'Choose Spell: ' : '';         // 5800:0290 set CS:01AA
  const bottom = mode === 2 ? 0x0F : 0x16;                               // 5800:02b9
  const selectable = mode !== 4;                                         // 5800:02d5
  const redraw = { v: page.v < 0 };                                      // 5800:02dd
  if (page.v < 0) page.v = 0;                                            // 5800:02ea
  if (mode === 4 || mode === 1) redraw.v = true;                         // 5800:02fe
  const sel = { v: null };                                               // 5800:0307
  let key;
  do key = await VerticalListMenu(prompt, opt, 13, 10, 15, 1, 5, 0x26, bottom, G.sl_List, selectable, redraw, page, sel);   // 5800:030a
  while (!['\0', '\r', 'C', 'E', 'L', 'M', 'S'].includes(key));          // 5800:034d set CS:01D9
  let n = 0;
  for (let p = G.sl_List; p && p !== sel.v; p = p.next) if (!p.isHeader) n++;   // 5800:035d .. 0398
  const result = key === '\0' || key === 'E' ? 0 : ids()[n];             // 5800:039a .. 03b0
  if (mode === 3) G.ScrollItem = (G.sl_Items || [])[n] ?? null;          // 5800:03be .. 03d8
  G.sl_List = FreeMenuList({ v: G.sl_List });                            // 5800:03dc
  return result;
}

// 5800:03F5 AddSpellLine(id)
export function AddSpellLine(id) {
  let p = G.sl_List, n, prevLevel;
  if (!p) { p = node(); G.sl_List = p; prevLevel = 0; n = 0; }           // 5800:0400 .. 0420
  else {
    n = 1;
    for (; p.next; p = p.next) if (!p.isHeader) n++;                     // the last line is not counted
    prevLevel = LEVEL(idAt(n - 1));                                      // DS:4B9B + n
    p.next = node(); p = p.next;
  }
  if (LEVEL(id & 0x7F) !== prevLevel) {                                  // 5800:0529 new level: heading line
    p.text = levelHeading(LEVEL(id & 0x7F)); p.isHeader = 1;             // 5800:0530 / 0545
    p.next = node(); p = p.next;
  }
  p.text = (id < 0x80 ? '  ' : ' *') + spellName(id & 0x7F);            // 5800:0559 .. 058a
  p.isHeader = 0;
  ids()[n] = id & 0x7F;                                                  // 5800:059f
}

// 5800:05B4 AddSpellLineCounted(id)
export async function AddSpellLineCounted(id) {
  const I = ids(), K = counts();
  let p = G.sl_List, n, prevLevel;
  if (!p) {                                                              // 5800:05c7
    K.fill(0); p = node(); G.sl_List = p;                                // 5800:05d0 .. 05fc
    prevLevel = 0; n = 0; K[0] = 1;                                      // 5800:0608 .. 0614
  } else {
    n = 1; prevLevel = 0;                                                // 5800:061e / 0622
    while (p.next && prevLevel <= LEVEL(id & 0x7F)) {                    // 5800:0626 .. 0647
      if (!p.isHeader && idAt(n - 1) !== (id & 0x7F)) n++;               // 5800:0649 .. 0667
      p = p.next; prevLevel = LEVEL(I[n]);                               // 5800:066c / 0678 (entry n)
    }
    if (idAt(n - 1) === (id & 0x7F)) {                                   // 5800:0696
      n--; prevLevel = LEVEL(id & 0x7F); K[n] = (K[n] + 1) & 0xFF;       // 5800:0747 .. 0764 same spell again
    } else {
      prevLevel = LEVEL(idAt(n - 1));                                    // 5800:06af
      const q = node(); q.next = p.next; p.next = q; p = q;              // 5800:06c9 .. 0707
      let carry = 1;
      for (let k = n; k <= 0x53; k++) { const t = K[k]; K[k] = carry; carry = t; }   // 5800:070a .. 0745
    }
  }
  p.text = id < 0x80 ? '  ' : ' *';                                      // 5800:0768 / 076e / 0783
  p.text += spellName(id & 0x7F); p.isHeader = 0;                        // 5800:0796 .. 07ba
  if (K[n] > 1) p.text = (p.text + ' (' + (await X.ByteToStr(K[n])) + ')').slice(0, 40);   // 5800:07cd .. 0829
  if (I[n] !== (id & 0x7F)) {                                            // 5800:082f
    let t = I[n]; I[n] = id & 0x7F;                                      // 5800:0844 / 0851
    for (let k = n + 1; k <= 0x53; k++) { const u = I[k]; I[k] = t; t = u; }   // 5800:0862 .. 0899
  }
}

// 5800:08A1 AddItemSpells(pendingOnly)
export async function AddItemSpells(pendingOnly) {
  const c = G.SelectedChar, it = G.ScrollItem;
  if (await X.HasEffect(c, 0x10, { v: null }) ||                         // 5800:08a7 Read Magic
      ((sb(c.b[0x109]) > 0 || sb(c.b[0xE6]) < sb(c.b[0x111])) && IT(it.b[0x2E], 0) === 0x0C))   // 5800:08c0 .. 08f5
    it.b[0x35] = 0;                                                      // 5800:08f7
  if (it.b[0x35] !== 0) return;                                          // 5800:0900
  if (!Array.isArray(G.sl_Items)) G.sl_Items = new Array(0x31).fill(null);
  for (let k = 1; k <= 3; k++) {                                         // 5800:0914
    const s = it.b[0x3B + k];
    if ((pendingOnly && s > 0x80) || (!pendingOnly && s !== 0)) {        // 5800:091a .. 0942
      AddSpellLine(s);                                                   // 5800:0944
      G.sl_Items[G.sl_ItemCount] = it; G.sl_ItemCount = (G.sl_ItemCount + 1) & 0xFF;   // 5800:0958 .. 0971
    }
  }
}

// 5800:0981 AddScrollSpells(pendingOnly)
export async function AddScrollSpells(pendingOnly) {
  G.sl_Items = new Array(0x31).fill(null);                               // 5800:0987 .. 09a6
  G.sl_ItemCount = 0;                                                    // 5800:09ab
  for (G.ScrollItem = G.SelectedChar.items; G.ScrollItem; G.ScrollItem = G.ScrollItem.next)   // 5800:09b0 .. 09f4
    if (IsScroll(G.ScrollItem)) await AddItemSpells(pendingOnly);        // 5800:09d4 / 09e0
}

// 5800:09FC BuildSpellList(mode): Boolean
export async function BuildSpellList(mode) {
  const c = G.SelectedChar, I = ids();
  let headings = true; G.sl_List = null;                                 // 5800:0a02 / 0a06
  for (let i = 0; i <= 0x53; i++) I[i] = 0;                              // 5800:0a1b
  switch (mode) {
    case 0: for (let i = 0; i <= 0x53; i++) {                            // 5800:0a3d memorised
      const id = c.b[0x1E + i];
      if (id !== 0 && await SpellUsable(c, id & 0x7F) && id < 0x80) await AddSpellLineCounted(id);
    } break;
    case 5: for (let i = 0; i <= 0x53; i++) {                            // 5800:0aae chosen, not yet memorised
      const id = c.b[0x1E + i];
      if (id > 0x7F && await SpellUsable(c, id & 0x7F)) await AddSpellLineCounted(id);
    } break;
    case 1: for (let id = 1; id <= 100; id++)                            // 5800:0b0d spell book
      if (c.b[0x78 + id] !== 0 && await SpellUsable(c, id)) await AddSpellLineCounted(id);
      break;
    case 2: await AddItemSpells(false); headings = false; break;         // 5800:0b4c
    case 3: await AddScrollSpells(false); headings = false; break;       // 5800:0b5f
    case 6: await AddScrollSpells(true); headings = false; break;        // 5800:0b72
    case 4: for (let id = 1; id <= 100; id++)                            // 5800:0b8a Learn
      if (c.b[(0x12C + sb(ST(id, 0)) * 5 + sb(LEVEL(id))) & 0xFFFF] !== 0 && await SpellUsable(c, id) && c.b[0x78 + id] === 0)
        await AddSpellLineCounted(id);
      break;
  }
  if (!G.sl_List) return false;                                          // 5800:0bf8
  if (headings) {                                                        // 5800:0c04
    let n = 0, level = LEVEL(I[0]);                                      // 5800:0c0d / 0c11
    const h = node(); h.next = G.sl_List; G.sl_List = h;                 // 5800:0c2b .. 0c52
    h.text = levelHeading(LEVEL(I[n])); h.isHeader = 1;                  // 5800:0c56 / 0c7b
    let p = G.sl_List;
    do {
      const prev = level;                                                // 5800:0c9f
      if (I[n] !== 0) level = LEVEL(I[n]);                               // 5800:0ca5 / 0cb3
      if (sb(prev) < sb(level)) {                                        // 5800:0ccd
        const q = node(); q.next = p.next; p.next = q; p = q;            // 5800:0cd5 .. 0d0e
        p.text = levelHeading(level); p.isHeader = 1;                    // 5800:0d16 / 0d35
      }
      n++; p = p.next;                                                   // 5800:0d3d / 0d40
    } while (p);                                                         // 5800:0d4f
  }
  return true;                                                           // 5800:0d5a
}

// 5800:0D67 SpellRange(spell)
export async function SpellRange(spell) {
  let r;
  if (G.ItemCast === 0) r = (ST(spell, 2) + ST(spell, 3) * (await X.SpellCasterLevel(spell))) & 0xFF;   // 5800:0d6d / 0d78
  else r = (ST(spell, 2) + ST(spell, 3) * 6) & 0xFF;                     // 5800:0dac
  if (r === 0 && ST(spell, 6) !== 0) r = 1;                              // 5800:0de0 / 0df2
  if (r === 0xFF) r = 1;                                                 // 5800:0dfc
  return r;
}

// 5800:0E11 SpellDuration(spell): Word
export async function SpellDuration(spell) {
  switch (spell) {
    case 0x28: return ((await X.Roll(1, 6)) * 10) & 0xFFFF;              // 5800:0e27
    case 0x39: case 0x3D: return await X.Roll(5, 4);                     // 5800:0e49
    case 0x3B: return ((await X.Roll(1, 4)) * 10 + 40) & 0xFFFF;         // 5800:0e61
    case 0x3F:                                                           // 5800:0e7b
      if (G.view_Mode === 5) return ((await X.Roll(2, 10)) * 10) & 0xFFFF;   // 5800:0e88
      return (((await X.Roll(1, 10)) + 10) * 10) & 0xFFFF;               // 5800:0e9f
    case 0x43: return 1440;                                              // 5800:0eb6
  }
  return (ST(spell, 4) + ST(spell, 5) * (await X.SpellCasterLevel(spell))) & 0xFFFF;   // 5800:0ec3 .. 0ef0
}

// 5800:0F06 ApplySpell(spell, level, onRemove, damage, dmgType, msg)
export async function ApplySpell(spell, level, onRemove, damage, dmgType, msg) {
  G.DamageType = damage === 0 ? 0 : dmgType;                             // 5800:0f1f .. 0f2c
  if (G.SpellTargetCount === 0) return;                                  // 5800:0f32
  if (level === 0) level = await X.SpellCasterLevel(spell);              // 5800:0f3c / 0f42
  for (let k = 1; k <= G.SpellTargetCount; k++) {                        // 5800:0f56
    const t = tg()[k];
    if (!t) continue;                                                    // 5800:0f6e
    let dmg = damage;
    let saved = ST(spell, 8) === 0 ? false : !!(await X.SavingThrow(t, ST(spell, 9), 0));   // 5800:0f9d / 0faf / 0fb5
    if (ST(G.sp_Current, 2) === 0xFF) {                                  // 5800:0fd6 touch
      await X.RecalcItems(t); await X.CallEffectHooks(0x0B, t);          // 5800:0fe8 / 0ff3
      if (!await X.AttackRoll(G.SelectedChar, t, t.b[0x19A])) { dmg = 0; saved = true; }   // 5800:1001 .. 1025
    }
    if (dmg !== 0) await X.DamageCharacter(t, dmg, ST(spell, 8), saved ? 1 : 0);   // 5800:1029 / 102f
    if (ST(spell, 0x0A) !== 0)                                           // 5800:1052
      await X.ApplyEffect(t, ST(spell, 0x0A), await SpellDuration(spell), level, onRemove, ST(spell, 8), saved ? 1 : 0, msg);   // 5800:1064 / 10a4
  }
  G.DamageType = 0;                                                      // 5800:10b4
}

// 5800:10D2 SelectTargetsCamp(spell, auto, var ok) — SpellHandlers[0] outside combat
export async function SelectTargetsCamp(spell, auto, ok) {
  if (!G.sp_CampTarget) G.sp_CampTarget = G.SelectedChar;                // 5800:10d8 / 10e1
  tg()[1] = G.SelectedChar; G.SpellTargetCount = 1; ok.v = true;         // 5800:10ee .. 1100
  switch (ST(spell, 7)) {                                                // 5800:1107
    case 1: break;                                                       // the caster
    case 2: {
      await X.RedrawCurrentMode();                                       // 5800:1125
      const who = { v: G.sp_CampTarget };
      await X.SelectPartyCharacter('Cast Spell on whom', 1, who);        // 5800:1139
      G.sp_CampTarget = who.v;
      if (!G.sp_CampTarget) { tg()[1] = null; G.SpellTargetCount = 0; ok.v = false; }   // 5800:1146 .. 115c
      else tg()[1] = G.sp_CampTarget;                                    // 5800:1165
      break;
    }
    case 4:
      tg()[1] = G.PartyList;                                             // 5800:1179
      while (tg()[G.SpellTargetCount].next) {                            // 5800:1192 .. 11ab
        tg()[G.SpellTargetCount + 1] = tg()[G.SpellTargetCount].next; G.SpellTargetCount++;   // 5800:11ad .. 11d7
      }
      break;
    default: ok.v = false;                                               // 5800:11df combat-only spell
  }
}

// 5800:1263 CastSpell(spell, auto, announce, var used)
export async function CastSpell(spell, auto, announce, used) {
  const caster = G.SelectedChar;                                         // 5800:1269
  let again = true;                                                      // 5800:1275
  if (G.view_Mode !== 5 && ST(spell, 7) === 0) {                         // 5800:1279 / 1283
    if (G.ItemCast === 0) {                                              // 5800:1298
      DrawText(1, 0x13, 10, 0, spellName(spell));                        // 5800:129f
      DrawText(1, 0x14, 10, 0, "can't be cast here...");                 // 5800:12dd
      if (await AskYesNo('Lose it? ', 13, 10, 15) === 'Y') await X.ForgetMemorizedSpell(caster, spell);   // 5800:12f1 .. 130d
    } else {
      DrawText(1, 0x13, 10, 0, 'That Item'); DrawText(1, 0x14, 10, 0, 'is a combat-only item...');   // 5800:132f / 134f
      if (await AskYesNo('Use it? ', 13, 10, 15) === 'Y') used.v = true; // 5800:1363 .. 1375
    }
    announce = 0; again = false;                                         // 5800:137c / 1380
  }
  if (await X.HasEffect(caster, 0x4A, { v: null }))                      // 5800:1384 new
    if (await X.Roll(1, 2) === 1) { await ShowCasts(caster, 'miscasts', spell); announce = 0; again = false; }   // 5800:139b .. 13d0
  if (announce !== 0 && G.ItemCast === 0) await ShowCasts(caster, 'casts', spell);   // 5800:13d4 .. 13f6
  while (again) {                                                        // 5800:13fe
    await selectTargets(spell, auto, used);                              // 5800:1407
    if (used.v) {                                                        // 5800:1418
      again = false;                                                     // 5800:1424
      if (G.view_Mode === 5) {                                           // 5800:1428
        await X.BuildFourAnimationFrames(0x12);                          // 5800:1432
        const col = CombatantCol(caster), row = CombatantRow(caster);    // 5800:143a / 1448
        let dir = 0; while (!InFrontArc(col, row, G.SpellX, G.SpellY, dir)) dir++;   // 5800:1453 .. 147a
        G.combat_Visible = 1; ShowCombatant(caster, dir, 1, false);      // 5800:147c / 1491 casting pose
        if (spell === 0x2F) await PlayOrStopSound(G.g_25C2);             // 5800:1496 Fireball
        else if (spell === 0x33) await PlayOrStopSound(G.g_25BC);        // 5800:14ab Lightning Bolt
        else await PlayOrStopSound(G.g_25B0);                            // 5800:14bb
        await X.AnimateAlongPath(col, row, G.SpellX, G.SpellY, 4, 0x1E); // 5800:14c4
        if (IsVisible(caster, false)) {                                  // 5800:14e3
          ShowCombatant(caster, cb(caster)[9], 1, true);                 // 5800:14f5
          ShowCombatant(caster, cb(caster)[9], 0, false);                // 5800:1513
        }
      }
      await X.ov23_1569(caster);                                         // 5800:1531 BreakInvisibility
      if (G.ItemCast === 0) await X.ForgetMemorizedSpell(caster, spell); // 5800:153c / 1543
      G.sp_Current = spell;                                              // 5800:1552
      const h = handlers()[spell];
      if (typeof h === 'function') await h();                            // 5800:1558 SpellHandlers[spell]
      G.sp_Current = 0; G.SpellArea = 0;                                 // 5800:1567 / 156c
    } else if (G.view_Mode !== 5) again = false;                         // 5800:1573 / 157a
    else if (auto !== 0 || await AskYesNo('Abort Spell? ', 14, 10, 15) === 'Y') {   // 5800:1580 .. 15a7
      await X.ShowTimedBottomMessage('Spell Aborted');                   // 5800:15b6
      if (G.ItemCast === 0) await X.ForgetMemorizedSpell(caster, spell); // 5800:15bb / 15c2
      again = false;                                                     // 5800:15d1
    }
  }
  await X.ClearCharacterMessage();                                       // 5800:15d8
  if (G.view_Mode === 5) ClearRectangle(0, 0x17, 0x27, 0x17);            // 5800:15dd / 15e4
}

// 5800:175B ConeTargets(srcCol, srcRow, aimX, aimY, width, length) with its nested SetLine 15FB / ClampXY 163E /
// CollectLine 168B
export function ConeTargets(srcCol, srcRow, aimX, aimY, width, length) {
  srcCol = sx8(srcCol); srcRow = sx8(srcRow); aimX = sx8(aimX); aimY = sx8(aimY);
  const L = newLine();
  const SetLine = (x0, y0, x1, y1) => {                                  // 5800:15fb
    Object.assign(L, newLine()); L.x0 = sx8(x0); L.y0 = sx8(y0); L.x1 = sx8(x1); L.y1 = sx8(y1); LineInit(L);   // 5800:1601 .. 1633
  };
  const ClampXY = (col, row) => {                                        // 5800:163e
    if (col.v >= 0x32) col.v = 0x31; else if (col.v < 0) col.v = 0;
    if (row.v >= 0x19) row.v = 0x18; else if (row.v < 0) row.v = 0;
  };
  const hits = new Array(31).fill(0);                                    // [BP-72h]: hits[0] = CellAt scratch, 1.. collected
  const occ = { v: 0 }, tile = { v: 0 };
  const CollectLine = () => {                                            // 5800:168b
    let done;
    do {
      done = !LineStep(L);                                               // 5800:169a
      if (!done) {
        CellAt(L.x, L.y, occ, tile); hits[0] = occ.v;                    // 5800:16df
        if (hits[0] !== 0) {
          let k = 1, found = false;
          do {                                                           // 5800:16f4 .. 1735
            if (hits[k] === hits[0]) found = true;
            else if (hits[k] === 0) { hits[k] = hits[0]; found = true; }
            else k++;
          } while (!found && k < 31);
        }
      }
    } while (!done);
  };
  // the centre line's step directions
  const dirs = []; let n = 0;
  SetLine(srcCol, srcRow, aimX, aimY);                                   // 5800:1769
  while (LineStep(L)) { dirs[n] = L.dir; n = (n + 1) & 0xFF; }           // 5800:1771 .. 17a6
  const last = (n - 1) & 0xFF;
  let k = 0, dist = L.dist, stop = false;                                // 5800:17b0
  while (dist < ((length << 1) & 0xFF) && !stop) {                       // 5800:17d4 .. 1841
    if (aimX < 0x31 && aimX > 0 && aimY < 0x18 && aimY > 0) {
      const d = dirs[k] ?? 8;                                            // TODO(decode): an empty direction list reads garbage
      if (d === 0 || d === 2 || d === 4 || d === 6) dist += 2; else if (d === 1 || d === 3 || d === 5 || d === 7) dist += 3;
      dist &= 0xFF;
      aimX = sx8(aimX + (DX[d] ?? 0)); aimY = sx8(aimY + (DY[d] ?? 0));
      k = k === last ? 0 : k + 1;
    } else stop = true;
  }
  const ax = { v: aimX }, ay = { v: aimY };
  ClampXY(ax, ay);                                                       // 5800:1891
  const range = { v: 0xFF };                                             // TODO(decode): uninitialised local [BP-78h]
  TraceLine(srcCol, srcRow, ax, ay, range, G.cm_Map);                    // 5800:18b3 (result unused)
  aimX = sx8(ax.v); aimY = sx8(ay.v);
  SetLine(srcCol, srcRow, aimX, aimY);                                   // 5800:18c5
  let count = 1, dup = false, lastDir = 0;                               // TODO(decode): lastDir unset when nothing is hit
  let stepped;
  do {                                                                   // 5800:18ea .. 197e
    stepped = LineStep(L);
    if (stepped) {
      CellAt(L.x, L.y, occ, tile); hits[0] = occ.v;
      if (hits[0] !== 0) {
        if (count < 2) dup = false;
        else for (let g = 1; g <= count - 1; g++) if (hits[g] === hits[0]) dup = true;   // quirk: never reset to false
        if (!dup && count < 31) { hits[count] = hits[0]; count++; }
        lastDir = L.dir;
      }
    }
  } while (stepped);
  if (width > 1) {                                                       // 5800:19a3
    const c3 = { v: sx8(aimX + sb(ds(0x0A10 + lastDir))) }, r3 = { v: sx8(aimY + sb(ds(0x0A18 + lastDir))) };
    ClampXY(c3, r3);
    const c5 = { v: sx8(aimX + sb(ds(0x0A20 + lastDir))) }, r5 = { v: sx8(aimY + sb(ds(0x0A28 + lastDir))) };
    ClampXY(c5, r5);
    SetLine(srcCol, srcRow, c5.v, r5.v); CollectLine();                  // 5800:1a0e
    if (width > 2) { SetLine(srcCol, srcRow, c3.v, r3.v); CollectLine(); }   // 5800:1a2a .. 1a3d
  }
  G.SpellTargetCount = 0;                                                // 5800:1a48 .. 1ab7
  let out = 1;
  for (let i = 1; i < 31 && hits[i] !== 0; i++) {
    const c = G.cb_Char[hits[i]];
    if (c !== G.SelectedChar) { G.SpellTargetCount++; tg()[out++] = c; }
  }
}

// 5800:1ABF HoldTargets(bonus, msg)
export async function HoldTargets(bonus, msg) {
  if (G.SpellTargetCount === 0) return;                                  // 5800:1ad8
  for (let k = G.SpellTargetCount; k >= 1; k--) {                        // 5800:1ae2 .. 1c2e
    const t = tg()[k];
    if (!t) continue;                                                    // 5800:1aea
    if (k < G.SpellTargetCount) {                                        // 5800:1b19
      await PlayOrStopSound(G.g_25B0); await X.BuildFourAnimationFrames(0x12);   // 5800:1b22 / 1b2b
      await X.AnimateAlongPath(CombatantCol(G.SelectedChar), CombatantRow(G.SelectedChar), CombatantCol(t), CombatantRow(t), 4, 0x1E);   // 5800:1b33 .. 1b71
    }
    let saved, negate;
    if ((G.sp_Current === 0x4F || G.sp_Current === 0x51) && k === G.SpellTargetCount) { saved = true; negate = 1; }   // 5800:1b76 .. 1b91
    else { saved = !!(await X.SavingThrow(t, ST(G.sp_Current, 9), bonus)); negate = ST(G.sp_Current, 8); }   // 5800:1b97 / 1bb9
    if ((t.b[0x11A] > 1 || t.b[0xDE] > 1) && G.sp_Current !== 0x5E) saved = true;   // 5800:1bcb .. 1be8
    await X.ApplyEffect(t, ST(G.sp_Current, 0x0A), await SpellDuration(G.sp_Current), await X.SpellCasterLevel(G.sp_Current), 0, negate, saved ? 1 : 0, msg);   // 5800:1bec .. 1c25
  }
}

// 5800:1C39 ApplyToSide(side, msg)
export async function ApplyToSide(side, msg) {
  G.SpellArea = 1;                                                       // 5800:1c52
  for (let k = 1; k <= G.SpellTargetCount; k++) {                        // 5800:1c57 .. 1ccd
    const t = tg()[k];
    if (!t) continue;
    if (t.b[0x197] !== side) tg()[k] = null;
    else if (G.sp_Current === 1 && G.view_Mode === 5 && (await X.CollectOppositeSideTargets(t, 1)) !== 0) tg()[k] = null;   // 5800:1ca9
  }
  await ApplySpell(G.sp_Current, 0, 0, 0, 0, msg);                       // 5800:1ce5
}

// ======================================================================================================
// part B: the spell handlers (SpellHandlers[1..100], parameterless; t = SpellTargets[1])
// ======================================================================================================

const apply = (s) => async () => ApplySpell(G.sp_Current, 0, 0, 0, 0, s);
const heal = (n, s, add) => async () => {
  if (G.SpellTargetCount !== 0 && await X.HealCharacter(T1(), ((await X.Roll(n, s)) + add) & 0xFF, 0)) await X.ShowHealingResult(T1());
};

export async function ov22_1CF9() { await ApplyToSide(G.SelectedChar.b[0x197], 'is Blessed'); }               // 01 5800:1d19
export async function ov22_1D2A() { await ApplyToSide((await X.IsSideZero(G.SelectedChar)) ? 1 : 0, 'is Cursed'); }   // 02 5800:1d38 / 1d4e
export const ov22_1D55 = heal(1, 8, 0);                                                                        // 03 5800:1d58 .. 1d89
export async function ov22_1D93() { await ApplySpell(G.sp_Current, 0, 0, await X.RollDice(1, 8), 8, ''); }    // 04 5800:1da9 / 1dc2
export const ov22_1DD5 = apply('is affected');                                                                // 05 0B 12 16 1D 4D 5800:1dfb
export const ov22_1E0F = apply('is protected');                                                               // 06 07 10 11 34 35 36 45 5800:1e35
export const ov22_1E4E = apply('is cold-resistant');                                                          // 08 5800:1e74
export async function ov22_1E7C() { await ApplySpell(G.sp_Current, 0, 0, await X.SpellCasterLevel(G.sp_Current), 9, ''); }   // 09 5800:1e90 / 1ea9

// 0A Charm Person 5800:1EC9
export async function ov22_1EC9() {
  const t = T1();
  if (t.b[0x11A] < 2 && t.b[0xDE] < 2) {                                 // 5800:1edb
    await ApplySpell(G.sp_Current, (G.SelectedChar.b[0x197] * 0x80 + await X.SpellCasterLevel(G.sp_Current)) & 0xFF, 1, 0, 0, 'is charmed');   // 5800:1f4f
    const e = { v: null };
    if (await X.HasEffect(t, 0x0B, e)) await X.CallEffectHandler(0x0B, t, e.v, 0);   // 5800:1f60 / 1f7d
  } else await msgC(t, 'is unaffected');                                 // 5800:1f67
}

// 0C Enlarge 5800:1FA0
export async function ov22_1FA0() {
  const t = T1();
  G.sp_Str = 18; G.sp_StrExc = 0;                                        // 5800:1fb2 / 1fb7
  const lv = await X.SpellCasterLevel(G.sp_Current);                     // 5800:1fc0 .. 2042
  switch (lv) {
    case 1: G.sp_StrExc = 0; break; case 2: G.sp_StrExc = 1; break; case 3: G.sp_StrExc = 51; break;
    case 4: G.sp_StrExc = 76; break; case 5: G.sp_StrExc = 91; break; case 6: G.sp_StrExc = 100; break;
    case 7: G.sp_Str = 19; break; case 8: G.sp_Str = 20; break; case 9: G.sp_Str = 21; break;
    case 10: case 11: G.sp_Str = 22; break;
  }
  const code = { v: 0 };
  if (await X.StrengthFromItem(t, G.sp_Str, G.sp_StrExc, code)) {        // 5800:2055
    await msgC(t, 'is stronger');                                        // 5800:2079
    await X.AddEffect(t, 0x0C, await SpellDuration(G.sp_Current), code.v, 1);   // 5800:208c / 2097
    await X.RecalcAbility(t, 0);                                         // 5800:20a5
  } else await msgC(t, 'is unaffected');                                 // 5800:20c7
}

// 0D Reduce 5800:20E1
export async function ov22_20E1() {
  const t = T1();
  if (t && G.SpellTargetCount !== 0 && !await X.SavingThrow(t, 4, 0) && await X.HasEffect(t, 0x0C, { v: null })) {   // 5800:20f6 .. 2125
    await X.RemoveEffect(t, 0x0C, null); await X.RecalcAbility(t, 0); await msgC(t, 'has been reduced');   // 5800:213d / 214b / 216b
  }
}

// 0E Friends 5800:2180
export async function ov22_2180() {
  await ApplySpell(G.sp_Current, await X.Roll(2, 4), 1, 0, 0, 'is friendly');   // 5800:2190 / 21af
  await X.RecalcAbility(G.SelectedChar, 5);                              // 5800:21bd
}

// 0F Magic Missile 5800:21C7
export async function ov22_21C7() {
  const n = ((await X.SpellCasterLevel(G.sp_Current)) + 1) >> 1;         // 5800:21d1 .. 21ec
  await ApplySpell(G.sp_Current, 0, 0, ((await X.RollDice(n, 4)) + n) & 0xFF, 8, '');   // 5800:21f5 / 221f
}

export const ov22_2232 = apply('is shielded');                                                                // 13 5800:2258
export async function ov22_2260() {                                                                            // 14 Shocking Grasp
  await ApplySpell(G.sp_Current, 0, 0, ((await X.RollDice(1, 8)) + await X.SpellCasterLevel(G.sp_Current)) & 0xFF, 0x0C, '');   // 5800:2274 .. 22a0
}

// 15 Sleep 5800:22B4
export async function ov22_22B4() {
  G.SpellArea = 1;                                                       // 5800:22ba
  G.sp_Str = (await X.Roll(4, 4)) & 0xFF;                                // 5800:22c5 the budget
  const n = G.SpellTargetCount;
  for (let k = 1; k <= n; k++) {
    const t = tg()[k];
    const lm = sb(t.b[0xE5]);                                            // 5800:22f0 .. 2351 cost by level_main
    if (lm >= 0 && lm <= 1) G.sp_StrExc = 1;
    else if (lm === 2) G.sp_StrExc = 2; else if (lm === 3) G.sp_StrExc = 4; else if (lm === 4) G.sp_StrExc = 6;
    else if (lm === 5) G.sp_StrExc = t.b[0x74] === 0 ? 10 : 20;
    else G.sp_StrExc = 20;
    if (t.b[0x195] === 1 || await X.HasEffect(t, 0x35, { v: null }) || G.sp_Str < G.sp_StrExc) tg()[k] = null;   // 5800:2361 .. 23be
    else G.sp_Str = (G.sp_Str - G.sp_StrExc) & 0xFF;
  }
  await ApplySpell(G.sp_Current, 0, 0, 0, 0, 'falls asleep');            // 5800:23e3
}

// 17 31 5E Hold Person / Hold Monsters 5800:23F2
let holdBonus = 0;                                                       // [BP-1] (TODO(decode): unset for 0 or >= 5 targets, B-28)
export async function ov22_23F2() {
  const n = G.SpellTargetCount;
  if (n === 1) holdBonus = G.sp_Current === 0x17 ? -2 : -3;              // 5800:23f8 .. 242e
  else if (n === 2) holdBonus = -1;
  else if (n === 3 || n === 4) holdBonus = 0;
  await HoldTargets(holdBonus, 'is held');                               // 5800:2442
}

export const ov22_245B = apply('is fire resistant');                                                          // 18 5800:2481
export const ov22_2494 = apply('is silenced');                                                                // 19 5800:24ba

// 1A Slow Poison 5800:24CD
export async function ov22_24CD() {
  const t = T1();
  if (t.b[0x195] === 1) tg()[1] = null;                                  // 5800:24e2 / 24e8
  else if (await X.HasEffect(t, 0x37, { v: null })) {                    // 5800:2502
    if (hp(t) === 0) t.b[0x1A4] = 1;                                     // 5800:250e / 2519
    await ApplySpell(G.sp_Current, 0xFF, 1, 0, 0, 'is affected');        // 5800:253f
    await X.CallEffectHandler(0x4E, t, null, 1);                         // 5800:2554
    await X.AddEffect(t, 0x0F, 10, 0xFF, 1);                             // 5800:256c
  }
}

// 1B Snake Charm 5800:2580
export async function ov22_2580() {
  let budget = hp(G.SelectedChar);                                       // 5800:2586
  G.SpellTargetCount = 0;
  for (let c = G.PartyList; c; c = c.next)                               // 5800:2592 .. 25f5
    if (c.b[0x11A] === 0x0E && hp(c) <= budget) { budget -= hp(c); G.SpellTargetCount++; tg()[G.SpellTargetCount] = c; }
  await ApplySpell(G.sp_Current, 0, 0, 0, 0, 'is charmed');              // 5800:2627
}

// 1C Spiritual Hammer 5800:262F
export async function ov22_262F() {
  await ApplySpell(G.sp_Current, 0, 1, 0, 0, '');                        // 5800:2655
  await X.CallEffectHandler(0x17, T1(), null, 0);                        // 5800:266c
}

export const ov22_2682 = apply('is invisible');                                                               // 1E 32 5800:26a8
export const ov22_26BB = apply('Knock-Knock');                                                                // 1F 5800:26e1
export async function ov22_26F6() {                                                                            // 20 Mirror Image
  await ApplySpell(G.sp_Current, ((await X.Roll(1, 4)) * 16 + await X.SpellCasterLevel(G.sp_Current)) & 0xFF, 0, 0, 0, 'is duplicated');   // 5800:2702 .. 2741
}
export const ov22_2754 = apply('is weakened');                                                                // 21 5800:277a

// shared by Spell_StinkingCloud / Spell_CloudKill: append a record to a cloud list, count the caster's earlier records
function newCloudRecord(listName) {
  let n = 0, r;
  const fresh = () => ({ owner: null, next: null, ground: new Array(10).fill(0), active: new Array(10).fill(0), x: 0, y: 0, id: 0, tried: 0 });
  if (!G[listName]) { G[listName] = fresh(); r = G[listName]; }
  else {
    r = G[listName];
    while (r.next) { if (r.owner === G.SelectedChar) n++; r = r.next; }  // the last record is not counted (B-31)
    r.next = fresh(); r = r.next;
  }
  return { r, n };
}
const sqx = (d) => sx8(G.SpellX + sb(ds(0x2694 + d))), sqy = (d) => sx8(G.SpellY + sb(ds(0x269D + d)));
const setGrid = (x, y, t) => { const i = 7 + y * 50 + x; if (i >= 7 && i < G.cm_Map.b.length) G.cm_Map.b[i] = t; };

// 22 Spell_StinkingCloud 5800:2799
export async function Spell_StinkingCloud() {
  G.SpellArea = 1;                                                       // 5800:279f
  const lvl = await X.SpellCasterLevel(G.sp_Current);                    // 5800:27a8
  const { r, n } = newCloudRecord('cloud_List');                         // 5800:27b4 .. 283b
  await X.AddEffect(G.SelectedChar, 0x28, lvl, (lvl + n * 16) & 0xFF, 1);   // 5800:284c
  r.owner = G.SelectedChar; r.id = n; r.x = G.SpellX; r.y = G.SpellY;    // 5800:2879 .. 28a0
  const occ = [0, 0, 0, 0, 0];
  for (let k = 1; k <= 4; k++) {                                         // 5800:28a7
    const d = csd(k), x = sqx(d), y = sqy(d);
    const o = { v: 0 }, tl = { v: 0 };
    CellAt(x, y, o, tl); occ[k] = o.v; let tile = tl.v;                  // 5800:28be
    r.active[k] = tile === 0 || cost(tile) === 0xFF ? 0 : 1;             // 5800:2904 .. 2927
    if (tile === 0x1E) {                                                 // 5800:2936 another cloud: its saved tile
      for (let q = G.cloud_List; q; q = q.next) {
        if (q === r) continue;
        for (let j = 1; j <= 4; j++)
          if (q.active[j] && sx8(q.x + sb(ds(0x2694 + csd(j)))) === x && sx8(q.y + sb(ds(0x269D + csd(j)))) === y && q.ground[j] !== 0x1E)
            tile = q.ground[j];                                          // 5800:293f .. 2a33
      }
    } else if (tile === 0x1F && G.corpse_Count) {                        // 5800:2a39 / 2a42 a corpse: its ground tile
      for (let j = 1; j <= G.corpse_Count; j++) {
        const e = (G.corpse_List || [])[j];
        if (e && sx8(e.col) === x && sx8(e.row) === y) tile = e.tile;    // 5800:2a57 .. 2ac6
      }
    }
    r.ground[k] = tile;                                                  // 5800:2ac8
    if (r.active[k]) setGrid(x, y, 0x1E);                                // 5800:2ad9 / 2aea
  }
  await X.ShowCharacterMessage(G.SelectedChar, 'Creates a noxious cloud', 10, 0);   // 5800:2b46
  FocusSquare(G.SpellX, G.SpellY, 0xFF, 8); await MessageDelay(); await X.ClearCharacterMessage();   // 5800:2b51 / 2b64 / 2b69
  for (let k = 2; k <= 4; k++) for (let j = 1; j <= 4; j++) if (occ[k] === occ[j] && k !== j) occ[k] = 0;   // 5800:2b6e .. 2bbb
  for (let k = 1; k <= 4; k++) if (occ[k] !== 0) await X.StinkingCloudCheck(G.cb_Char[occ[k]], 1);   // 5800:2bc0 .. 2bf3
}

// 23 Spell_Strength 5800:2BF9
let strRoll = 0;                                                         // [BP-x] (B-29: unset without a class)
export async function Spell_Strength() {
  let exc = 0; const t = T1();                                           // 5800:2bff / 2c03
  const lv = (n) => sb(t.b[0x109 + n]), was = (n) => sb(t.b[0xE6]) < sb(t.b[0x111 + n]);
  if (lv(5) > 0 || was(5)) strRoll = await X.Roll(1, 4);                 // 5800:2c0f .. 2c32 magic-user
  if (lv(0) > 0 || was(0) || lv(6) > 0 || was(6)) strRoll = await X.Roll(1, 6);   // 5800:2c3a .. 2c7a cleric, thief
  if (lv(2) > 0 || was(2)) strRoll = await X.Roll(1, 8);                 // 5800:2c82 .. 2ca5 fighter
  let s = (t.b[0x11] + strRoll) & 0xFF;                                  // 5800:2cad
  if (s > 18) {                                                          // 5800:2cc2
    if (!(lv(2) > 0 || was(2) || lv(3) > 0 || was(3) || lv(4) > 0 || was(4))) s = 18;   // 5800:2ccb .. 2d31
    else { exc = t.b[0x1C] + (s - 18) * 10; if (exc > 100) exc = 100; s = 18; }   // 5800:2d22 .. 2d4f
  }
  const code = { v: 0 };
  if (await X.StrengthFromItem(t, s, exc, code)) {                       // 5800:2d53 / 2d6d
    code.v = (strRoll + 100) & 0xFF;                                     // 5800:2d6f
    await X.AddEffect(t, 0x26, await SpellDuration(G.sp_Current), code.v, 1);   // 5800:2d7a / 2d93
    await X.RecalcAbility(t, 0);                                         // 5800:2d98
  }
}

// 24 5A Spell_AnimateDead 5800:2DB6
export async function Spell_AnimateDead() {
  G.SpellArea = 1;                                                       // 5800:2dbc
  let budget = await X.SpellCasterLevel(G.sp_Current);                   // 5800:2dc1
  G.SpellTargetCount = 0;                                                // 5800:2dcd
  for (let c = G.PartyList; c && budget !== 0; c = c.next) {             // 5800:2dd2 .. 2ded
    if (c.b[0x195] === 6 && c.b[0x11A] === 0 && PlaceCombatant(c, CombatantCol(c), CombatantRow(c), true)) {   // 5800:2df2 .. 2e2f
      const p3 = (c.b[0x197] * 16 + await X.SpellCasterLevel(G.sp_Current)) & 0xFF;   // 5800:2e3b .. 2e48
      c.b[0x197] = G.SelectedChar.b[0x197]; c.b[0x198] = 1; c.b[0xE9] = 2;   // 5800:2e5b .. 2e75
      c.b[0xDD] = 0; c.b[0xE4] = 6; c.b.fill(0, 0x1E, 0x1E + 84);        // 5800:2e7e .. 2eac
      c.b[0xF7] = c.b[0xF7] < 0x80 ? 0xB3 : 0xB2;                        // 5800:2eae .. 2ecd
      c.b[0x11A] = 4;                                                    // 5800:2ecd
      if (G.view_Mode === 5) c.combat.target = null;                     // 5800:2ed6 / 2edd
      budget--;                                                          // 5800:2eef
      if (await X.ReviveCombatant(c, c.b[0x78])) {                       // 5800:2ef2 / 2f09
        await X.ApplyEffect(c, 0x20, 0, p3, 1, 0, 0, 'is animated'); c.b[0x195] = 1;   // 5800:2f31 / 2f36
      }
    }
  }
}

export async function ov22_2F5E() { if (await X.CureEffect(T1(), 0x21)) await X.ShowCombatMessageAnimation(T1(), 1, 'can see'); }   // 25 5800:2f6f / 2f92
export const ov22_2FA4 = apply('is blind');                                                                   // 26 5800:2fca

// 5800:2FD1 Spell_CureDisease: Boolean
export async function Spell_CureDisease() {
  const t = T1();
  G.cure_InProgress = 1;                                                 // 5800:2fd7
  let any = !!(await X.CureEffect(t, 0x22));                             // 5800:2feb
  if (await X.CureEffect(t, 0x2B)) { any = true; await X.RemoveEffect(t, 0x2C, null); await X.RemoveEffect(t, 0x1F, null); }   // 5800:3003 .. 3037
  if (await X.CureEffect(t, 0x32)) { any = true; await X.RemoveEffect(t, 0x39, null); }   // 5800:3047 / 3065
  G.cure_InProgress = 0;
  return any;
}
export async function ov22_3076() { await Spell_CureDisease(); }                                              // 27 5800:307d
export async function ov22_3093() { await ApplySpell(G.sp_Current, 0, 1, 0, 0, 'is diseased'); }             // 28 5800:30b9

// 5800:30C0 DispelChance(caster) (nested in Spell_DispelMagic; parent's lvl)
async function DispelChance(caster, lvl) {
  const dc = (await X.DualClassActive(G.SelectedChar)) ? 1 : 0;          // 5800:30c6 quirk: the dispelling character
  G.sp_StrExc = (sb(caster.b[0x10E]) + sb(caster.b[0x116]) * dc) & 0xFF;   // 5800:30c6 .. 30e1
  if (G.sp_StrExc < lvl) G.sp_Str = ((lvl - G.sp_StrExc) * 5 + 50) & 0xFF;   // 5800:30ee .. 3138
  else if (lvl < G.sp_StrExc) G.sp_Str = (50 - (G.sp_StrExc - lvl) * 2) & 0xFF;
  else G.sp_Str = 50;
  return (await X.Roll(1, 100)) <= G.sp_Str;                             // 5800:3155 / 315a
}

// 29 2E Spell_DispelMagic 5800:317E
export async function Spell_DispelMagic() {
  G.SpellArea = 1;                                                       // 5800:3184
  const lvl = await X.SpellCasterLevel(G.sp_Current);                    // 5800:318d
  const n = G.SpellTargetCount;
  for (let k = 1; k <= n; k++) {                                         // 5800:3195
    const t = T1(); let dispelled = false;                               // 5800:31ad / 31b1 always the first target
    let e = t ? t.effects : null;                                        // 5800:31bd
    while (e) {                                                          // 5800:31cd
      const nx = e.next;                                                 // 5800:31d8
      if (e.b[3] !== 0xFF) {                                             // 5800:31e7
        G.sp_StrExc = e.b[3] & 0x0F;                                     // 5800:31f4
        if (G.sp_StrExc < lvl) G.sp_Str = ((lvl - G.sp_StrExc) * 5 + 50) & 0xFF;   // 5800:3200 .. 3249
        else if (lvl < G.sp_StrExc) G.sp_Str = (50 - (G.sp_StrExc - lvl) * 2) & 0xFF;
        else G.sp_Str = 50;
        if ((await X.Roll(1, 100)) <= G.sp_Str) { await X.RemoveEffect(t, e.b[0], e); dispelled = true; }   // 5800:324e .. 3277
      }
      e = nx;                                                            // 5800:327b
    }
    if (dispelled) await X.ShowCombatMessageAnimation(t, 1, 'is affected');   // 5800:3289 / 32a7
  }
  let x = G.SpellX, y = G.SpellY;
  for (let d = 0; d <= 8; d++) {                                         // 5800:32b7 .. 3514 gfx_LoopCounter
    G.gfx_LoopCounter = d;
    switch (d) {                                                         // 5800:32c2 .. 3349
      case 0: x = G.SpellX; y = G.SpellY; break; case 1: y = G.SpellY - 1; break; case 2: x = G.SpellX + 1; break;
      case 3: y = G.SpellY; break; case 4: y = G.SpellY + 1; break; case 5: x = G.SpellX; break;
      case 6: x = G.SpellX - 1; break; case 7: y = G.SpellY; break; case 8: y = G.SpellY - 1; break;
    }
    x = sx8(x); y = sx8(y);
    const o = { v: 0 }, tl = { v: 0 };
    CellAt(x, y, o, tl);                                                 // 5800:3349
    const tile = tl.v;
    if (tile !== 0x1C && tile !== 0x1E) continue;                        // 5800:3360 / 336c
    const list = tile === 0x1C ? G.cloud9_List : G.cloud_List;           // 5800:336f .. 3390
    const squares = tile === 0x1C ? 9 : 4;
    for (let q = list; q; q = q.next) {                                  // 5800:3397 .. 3432
      for (let j = 1; j <= squares; j++) {
        if (x === sx8(q.x + sb(ds(0x2694 + csd(j)))) && y === sx8(q.y + sb(ds(0x269D + csd(j)))) && !q.tried) {   // CloudSquareDir[j] for both lists (quirk)
          if (!await DispelChance(q.owner, lvl)) q.tried = 1;            // 5800:342c / 3434 / 34bb
          else {
            let e = q.owner.effects, found = false;                      // 5800:3437 / 344a
            while (e && !found) {                                        // 5800:344e / 3456
              if (((e.b[0] === 0x5B && tile === 0x1C) || (e.b[0] === 0x28 && tile === 0x1E)) && (e.b[3] >> 4) === q.id) found = true;   // 5800:345c .. 3498
              else e = e.next;                                           // 5800:349e
            }
            if (found) await X.RemoveEffect(q.owner, tile === 0x1C ? 0x5B : 0x28, e);   // 5800:34b5 / 34ce / 34d5
          }
        }
      }
    }
  }
}

export async function ov22_352D() {                                                                            // 2A Prayer
  await ApplySpell(G.sp_Current, (G.SelectedChar.b[0x197] * 16 + await X.SpellCasterLevel(G.sp_Current)) & 0xFF, 0, 0, 0, 'is praying');   // 5800:353b / 356f
}

// 2B 59 Spell_RemoveCurse 5800:3599 (stub e9, temple)
export async function Spell_RemoveCurse() {
  const t = T1();
  if (await X.CureEffect(t, 0x24)) { await X.ShowCombatMessageAnimation(t, 1, 'is un-cursed'); return; }   // 5800:359f .. 35cd
  let found = false;                                                     // 5800:35d5
  for (let it = t.items; it && !found; it = it.next) {                   // 5800:35d9 .. 365b
    if (it.b[0x36] !== 0) {                                              // 5800:35f8
      found = true; it.b[0x34] = 0;                                      // 5800:3602 / 3606
      if (it.b[0x3E] >= 0x80) {                                          // 5800:360e special[3]
        G.item_HookMode = 1; await X.CallEffectHandler(it.b[0x3E], t, it, 1);   // 5800:3618 / 3636
        for (let n = 0; n <= 5; n++) await X.RecalcAbility(t, n);        // 5800:3655 .. 3659
      }
    }
  }
  if (found) await X.ShowCombatMessageAnimation(t, 1, 'has an item un-cursed');   // 5800:366d / 368d
}

export const ov22_36A7 = apply('has been cursed!');                                                           // 2C 64 5800:36cd
export const ov22_36E0 = apply('is blinking');                                                                // 2D 5800:3706

// 2F 40 Spell_Fireball 5800:370E
export async function Spell_Fireball() {
  G.SpellArea = 1;                                                       // 5800:3714
  const dice = G.sp_Current === 0x40 ? ((await X.Roll(1, 3)) * 2 + 1) : await X.SpellCasterLevel(G.sp_Current);   // 5800:3719 .. 3735
  if (view.mem(0x4BE6) === 0) {                                          // 5800:3741
    BuildTargetList(G.SpellX, G.SpellY, 2, 0xFF, 1, G.cm_Map);           // 5800:374d
    for (let k = 1; k <= G.tg_Count; k++) tg()[k] = G.cb_Char[G.tg_List[k].who];   // 5800:376c .. 37b8
    G.SpellTargetCount = G.tg_Count;                                     // 5800:37ba
  }
  FocusSquare(G.SpellX, G.SpellY, 0, 8);                                 // 5800:37c0
  await ApplySpell(G.sp_Current, 0, 0, await X.RollDice(dice, 6), 9, '');   // 5800:37d3 / 37fd
}

// 5800:3804 HasteSlow(cancels, side, msg)
export async function HasteSlow(cancels, side, msg) {
  G.SpellArea = 1;                                                       // 5800:381d
  let budget = await X.SpellCasterLevel(G.sp_Current);                   // 5800:3826
  const n = G.SpellTargetCount;
  for (let k = 1; k <= n; k++) {
    const t = tg()[k];
    if (t && t.b[0x197] === side && budget !== 0) {                      // 5800:3851 .. 3863
      budget--;
      if (await X.CureEffect(t, cancels)) tg()[k] = null;                // 5800:387f / 3886 the opposite effect only cancelled
    } else tg()[k] = null;                                               // 5800:389f
  }
  await ApplySpell(G.sp_Current, 0, 0, 0, 0, msg);                       // 5800:38d2
  for (let k = 1; k <= G.SpellTargetCount; k++) await X.CallEffectHooks(0x12, tg()[k]);   // 5800:38d5 .. 390b (nil targets too, as compiled)
}
export async function ov22_391D() { await HasteSlow(0x2A, G.SelectedChar.b[0x197], 'is Hasted'); }            // 30 5800:3940

// 5800:3947 BoltHitSquare(col, row, dmg, saveType, skip, var wall)
export async function BoltHitSquare(col, row, dmg, saveType, skip, wall) {
  const o = { v: 0 }, tl = { v: 0 };
  CellAt(col, row, o, tl);                                               // 5800:394d
  wall.v = !(tl.v === 0 || cost(tl.v) !== 0xFF || view.mem(0x4BE6) !== 1 || wall.v);   // 5800:396a .. 399a
  if (o.v !== 0 && o.v !== skip) {                                       // 5800:39a1 / 39af
    const c = G.cb_Char[o.v];
    G.DamageType = 0x0C;                                                 // 5800:39c6
    await X.DamageCharacter(c, dmg, 2, await X.SavingThrow(c, saveType, 0));   // 5800:39cb / 39eb
    await X.BuildFourAnimationFrames(0x13); G.DamageType = 0;            // 5800:39f0 / 39f8
  }
}

// 5800:3A03 LightningBolt(length, dmg, saveType, mayBounce)
export async function LightningBolt(length, dmg, saveType, mayBounce) {
  const wall = { v: false };                                             // 5800:3a09
  await X.BuildFourAnimationFrames(0x13);                                // 5800:3a10
  const o = { v: 0 }, tl = { v: 0 };
  CellAt(G.SpellX, G.SpellY, o, tl);                                     // 5800:3a27
  let prevOcc = o.v, tile = tl.v, occ = 0, steps = 0, sign = 1;
  const cc = CombatantCol(G.SelectedChar), cr = CombatantRow(G.SelectedChar);
  let bounce = mayBounce;
  if (cc === sx8(G.SpellX) && cr === sx8(G.SpellY)) return;              // 5800:3a61 / 3a6a own square
  let left = (length << 1) & 0xFF;                                       // 5800:3a72
  G.SpellArea = 1;                                                       // 5800:3a79
  while (left !== 0) {
    const L = newLine();                                                 // 5800:3a98 FillChar(18h)
    L.x0 = sx8(G.SpellX); L.y0 = sx8(G.SpellY);
    L.x1 = L.x0 + (L.x0 - cc) * sign * left; L.y1 = L.y0 + (L.y0 - cr) * sign * left;
    LineInit(L);                                                         // 5800:3b21
    do {
      const px = L.x, py = L.y;
      if (L.x0 !== L.x1 || L.y0 !== L.y1) {
        let stepped;
        do {                                                             // 5800:3b3b .. 3b88
          stepped = LineStep(L);
          const a = { v: 0 }, b = { v: 0 }; CellAt(L.x, L.y, a, b); occ = a.v; tile = b.v;
          if (cost(tile) === 1) wall.v = false;
        } while (stepped && (occ === 0 || occ === prevOcc) && tile !== 0 && cost(tile) < 2 && L.dist < left);
      }
      if (tile === 0) left = 0;                                          // 5800:3b8e off the field
      await X.AnimateAlongPath(px, py, L.x, L.y, 4, 0x32);               // 5800:3baa
      await BoltHitSquare(L.x, L.y, dmg, saveType, prevOcc, wall);       // 5800:3bc9
      prevOcc = occ;
      if (wall.v) {                                                      // 5800:3bd6 a wall reflects
        G.SpellX = L.x & 0xFF; G.SpellY = L.y & 0xFF;
        const B = newLine(); B.x0 = sx8(G.SpellX); B.y0 = sx8(G.SpellY); B.x1 = cc; B.y1 = cr;
        LineInit(B); while (LineStep(B));                                // 5800:3bf6 .. 3c20
        if (bounce && B.dist < 9) L.dist = (L.dist + 8) & 0xFF;          // 5800:3c2f / 3c35 / 3c3b
        sign = -sign; bounce = 0; prevOcc = 0;                           // 5800:3c45 .. 3c4c
      }
      const used = (L.dist - steps) & 0xFF;                              // 5800:3c67 .. 3c78 byte arithmetic
      if (used < left) left -= used; else left = 0;
      steps = L.dist;
    } while (!wall.v && left !== 0);                                     // 5800:3c7f / 3c85
  }
  G.SpellArea = 0;                                                       // 5800:3c8d
}

// 33 Lightning Bolt 5800:3C98
export async function ov22_3C98() {
  const dmg = await X.Roll(await X.SpellCasterLevel(G.sp_Current), 6);   // 5800:3ca2 / 3cab
  const wall = { v: false };
  await BoltHitSquare(G.SpellX, G.SpellY, dmg, 4, 0, wall);              // 5800:3ccb
  await LightningBolt(7, dmg, 4, 1);                                     // 5800:3cdc
}
export async function ov22_3CED() { await HasteSlow(0x27, (await X.IsSideZero(G.SelectedChar)) ? 1 : 0, 'is Slowed'); }   // 37 5800:3cfe / 3d14

// 38 Spell_Restoration 5800:3D27
let restPick = 0;                                                        // [BP-0Ch] (unset when no class qualifies)
export async function Spell_Restoration() {
  const t = T1();
  if (t.b[0xE7] === 0) return;                                           // 5800:3d39
  const n = Math.trunc(t.b[0xE8] / t.b[0xE7]);                           // 5800:3d47
  t.b[0x78] = (t.b[0x78] + n) & 0xFF; t.b[0x1A4] = (t.b[0x1A4] + n) & 0xFF; t.b[0x12C] = (t.b[0x12C] + n) & 0xFF;   // 5800:3d63 .. 3d7b
  t.b[0xE8] = (t.b[0xE8] - n) & 0xFF; t.b[0xE7] = (t.b[0xE7] - 1) & 0xFF;   // 5800:3d83 / 3d8e
  let best = 13, bestXp = 10000000;                                      // 5800:3d9a .. 3da4
  const xp = (j, lv) => { const a = 0x4291 + j * 99 + sb(lv + 1) * 4; return (ds(a) | (ds(a + 1) << 8) | (ds(a + 2) << 16) | (ds(a + 3) << 24)) | 0; };
  for (let j = 0; j <= 7; j++) {                                         // 5800:3da4
    const lv = sb(t.b[0x109 + j]);                                       // 5800:3dad
    if (lv > 0 && lv <= best) {                                          // 5800:3dbe / 3dcf
      const v = xp(j, lv);
      if (v > 0 && v < bestXp && !await X.RacialLevelLimitReached(t, j)) { best = lv; restPick = j; bestXp = v; }   // 5800:3dd2 .. 3e62
    }
  }
  t.b[0x109 + restPick] = (t.b[0x109 + restPick] + 1) & 0xFF;            // 5800:3e73
  const cur = (t.b[0x127] | (t.b[0x128] << 8) | (t.b[0x129] << 16) | (t.b[0x12A] << 24)) | 0;
  if (cur < bestXp) { t.b[0x127] = bestXp & 0xFF; t.b[0x128] = (bestXp >> 8) & 0xFF; t.b[0x129] = (bestXp >> 16) & 0xFF; t.b[0x12A] = (bestXp >> 24) & 0xFF; }   // 5800:3e81 .. 3e9c
  await X.UpdateLevelStats(t);                                           // 5800:3ea9
  await msgC(t, 'is restored');                                          // 5800:3ec9
}

export async function ov22_3EE2() { if (!await X.CureEffect(T1(), 0x2A)) await ApplySpell(G.sp_Current, 0, 0, 0, 0, 'is Speedy'); }   // 39 5800:3ef3 / 3f1c
export const ov22_3F23 = heal(2, 8, 1);                                                                        // 3A 5800:3f3d .. 3f5a

// 3B (item: giant strength) 5800:3F6F
export async function ov22_3F6F() {
  const t = T1(), code = { v: 0 };
  if (await X.StrengthFromItem(t, 21, 0, code)) await msgC(t, 'is stronger');   // 5800:3f88 / 3fae
  await X.AddEffect(t, 0x92, ((await X.Roll(1, 4)) * 10 + 40) & 0xFFFF, code.v, 1);   // 5800:3fc4 / 3fdb
  await X.RecalcAbility(t, 0);                                           // 5800:3feb
}

export async function ov22_3FF4() {                                                                            // 3C (lightning power)
  const wall = { v: false };
  await BoltHitSquare(G.SpellX, G.SpellY, ((await X.Roll(1, 6)) + 20) & 0xFF, 4, 0, wall);   // 5800:4008 / 401f
  await LightningBolt(3, 20, 4, 0);                                      // 5800:402f
}
export const ov22_4043 = apply('is paralyzed');                                                               // 3D 5800:4069
export async function ov22_407A() { if (await X.HealCharacter(T1(), ((await X.Roll(2, 4)) + 2) & 0xFF, 0)) await X.ShowCombatMessageAnimation(T1(), 1, 'is Healed'); }   // 3E 5800:408e .. 40bf
export const ov22_40D5 = apply('is invisible');                                                               // 3F 5800:40fb
export async function ov22_4103() { await ApplySpell(G.sp_Current, 0, 0, ((await X.RollDice(2, 4)) + 2) & 0xFF, 8, ''); }   // 41 5800:4119 / 4137
export async function ov22_413F() { await ApplySpell(G.sp_Current, 0, 0, ((await X.RollDice(2, 8)) + 1) & 0xFF, 8, ''); }   // 42 5800:4155 / 4171

// 43 Neutralize Poison 5800:4194
export async function ov22_4194() {
  const t = T1();
  if (t.b[0x195] === 1) { tg()[1] = null; return; }                      // 5800:41a9 / 41af
  if (await X.HasEffect(t, 0x37, { v: null })) {                         // 5800:41ca
    if (hp(t) === 0) t.b[0x1A4] = 1;                                     // 5800:41d6
    G.cure_InProgress = 1;                                               // 5800:41ea .. 422b
    await X.RemoveEffect(t, 0x37, null); await X.RemoveEffect(t, 0x16, null); await X.RemoveEffect(t, 0x0F, null);
    G.cure_InProgress = 0;
    await msgC(t, 'is unpoisoned');                                      // 5800:424b
    t.b[0x196] = 1; t.b[0x195] = 0;                                      // 5800:4250 / 4259
  } else await msgC(t, 'is unaffected');                                 // 5800:427f
}

// 44 Poison 5800:4289
let poisonE = null;                                                      // TODO(decode): uninitialised local e (L)
export async function ov22_4289() {
  await ApplySpell(G.sp_Current, 0, 0, 0, 8, '');                        // 5800:42af
  const tgt = G.SelectedChar.combat ? G.SelectedChar.combat.target : null;   // 5800:42b2
  G.EffectToApply = 0x40; await X.CallEffectHooks(9, tgt);               // 5800:42c7 / 42d5
  if (G.EffectToApply === 0x40) await X.CallEffectHandler(0x40, G.SelectedChar, poisonE, 0);   // 5800:42da / 42f5
}

// 46 Sticks to Snakes 5800:4311
export async function ov22_4311() {
  const t = T1();
  if (sb(t.b[0xE5]) < 6) {                                               // 5800:4317
    await ApplySpell(G.sp_Current, await X.SpellCasterLevel(G.sp_Current), 0, 0, 8, '');   // 5800:432b / 434a
    const e = { v: null };
    if (await X.HasEffect(t, 3, e)) await X.CallEffectHandler(3, t, e.v, 0);   // 5800:435d / 437a
  } else await msgC(t, 'smashes them flat');                             // 5800:439e
}

export const ov22_43A7 = heal(3, 8, 3);                                                                        // 47 5800:43c1 .. 43e0
export async function ov22_43EA() { await ApplySpell(G.sp_Current, 0, 0, ((await X.RollDice(3, 8)) + 3) & 0xFF, 8, ''); }   // 48 5800:4400 / 441e
export async function ov22_4432() {                                                                            // 49 Dispel Evil
  await X.ApplyEffect(G.SelectedChar, 4, await SpellDuration(0x49), 0, 0, 0, 0, '');   // 5800:4447 / 4466
  await ApplySpell(G.sp_Current, 0, 0, 0, 0, 'is affected');             // 5800:448b
}
export async function ov22_4493() { await ApplySpell(G.sp_Current, 0, 0, await X.RollDice(6, 8), 9, ''); }   // 4A 5800:44a9 / 44c2

// 4B Raise Dead 5800:44D3
export async function ov22_44D3() {
  const t = T1();
  if ((t.b[0x195] === 6 || t.b[0x195] === 1) && t.b[0x18] !== 0 && t.b[0x74] !== 2) {   // 5800:44e5 .. 4513
    G.cure_InProgress = 1; await X.RemoveEffect(t, 0x20, null); await X.RemoveEffect(t, 0x37, null); G.cure_InProgress = 0;   // 5800:4518 .. 4545
    t.b[0x195] = 0; t.b[0x196] = 1; t.b[0x18] = (t.b[0x18] - 1) & 0xFF;  // 5800:454a .. 455c
    await X.RecalcAbility(t, 4);                                         // 5800:456c
    t.b[0x1A4] = 1;                                                      // 5800:4571
    await msgC(t, 'is raised');                                          // 5800:4595
  }
}

// 4C Slay Living 5800:45B5
export async function ov22_45B5() {
  const t = T1();
  G.DamageType = 0x40; G.DamageAmount = 0x43;                            // 5800:45c7 / 45cc
  await X.CallEffectHooks(9, t);                                         // 5800:45da
  if (G.DamageAmount === 0) await msgC(t, 'is unaffected');              // 5800:45df / 465c
  else if (!await X.SavingThrow(t, 4, 0)) await X.KillCombatant(t, 6, 'is slain');   // 5800:45f2 / 4613
  else { G.DamageType = 8; await X.DamageCharacter(t, ((await X.RollDice(2, 8)) + 1) & 0xFF, 0, 0); }   // 5800:461a .. 463a
}

// 4E Entangle 5800:4672
export async function ov22_4672() {
  if (view.mem(0x4BE6) !== 0) return;                                    // 5800:4678
  for (let k = 1; k <= G.SpellTargetCount; k++) {
    const t = tg()[k];
    const saved = await X.SavingThrow(t, 4, 0);
    await X.ApplyEffect(t, 0x88, await SpellDuration(0x88), 0, 0, 1, saved, 'is entangled');   // 5800:4678 .. 470c
  }
}
export async function ov22_472C() { await HoldTargets(0, 'is highlighted'); }                                  // 4F 5800:4745
export const ov22_4759 = apply('is invisible');                                                               // 50 5800:477f

// 51 Charm Monsters 5800:4791
export async function ov22_4791() {
  await HoldTargets(0, 'is charmed');                                    // 5800:47aa
  for (let k = 1; k <= G.SpellTargetCount; k++) {                        // 5800:47b0 .. 4805
    const t = tg()[k], e = { v: null };
    if (t && await X.HasEffect(t, 0x0B, e)) await X.CallEffectHandler(0x0B, t, e.v, 0);
  }
}

// 52 Confusion 5800:4822
export async function ov22_4822() {
  const n = await X.Roll(2, 8);                                          // 5800:482e
  if (n < G.SpellTargetCount) G.SpellTargetCount = n;                    // 5800:4833 / 4839
  for (let k = 1; k <= G.SpellTargetCount; k++) {                        // 5800:484a .. 48c9
    const t = tg()[k];
    const saved = await X.SavingThrow(t, 4, 0);
    await X.ApplyEffect(t, 0x23, await SpellDuration(0x52), 0, 0, 1, saved, 'is confused');
  }
}

// 53 Dimension Door 5800:48E4
export async function ov22_48E4() {
  const c = G.SelectedChar, e = { v: null };
  if (await X.HasEffect(c, 0x3A, e)) {                                   // 5800:4904
    BuildTargetList(CombatantCol(c), CombatantRow(c), 1, 0xFF, 1, G.cm_Map);   // 5800:4916 / 4922 / 493a
    const n = G.tg_Count;
    for (let k = 1; k <= n; k++) {                                       // 5800:4954 .. 49f6
      const t = G.cb_Char[G.tg_List[k].who];
      if (await X.HasEffect(t, 0x90, e) || await X.HasEffect(t, 0x8B, e)) {
        if (G.cb_Char[e.v.b[3]] === c) { await X.RemoveEffect(t, 0x90, null); await X.RemoveEffect(t, 0x8B, null); }
      }
    }
  }
  RestoreTerrain(0, 0, CombatantIndex(c));                               // 5800:4a07 / 4a0d
  PlaceCombatant(c, G.SpellX, G.SpellY, false);                          // 5800:4a23
  FocusSquare(CombatantCol(c), CombatantRow(c), 0, 8);                   // 5800:4a31 .. 4a49
  await msgC(c, 'teleports');                                            // 5800:4a69
}

// 54 Fear 5800:4A8F
export async function ov22_4A8F() {
  const c = G.SelectedChar;
  ConeTargets(CombatantCol(c), CombatantRow(c), G.SpellX, G.SpellY, 3, 6);   // 5800:4aa7 / 4ab3 / 4ac8
  const n = G.SpellTargetCount;
  for (let k = 1; k <= n; k++) {
    const t = tg()[k];
    const saved = await X.SavingThrow(t, 4, 0);                          // 5800:4b06
    if (!saved) {
      await X.ApplyEffect(t, 0x8E, await SpellDuration(0x54), 0, 1, 1, saved, 'runs in terror');   // 5800:4b21 / 4b41
      cb(t)[0x10] = 1; t.b[0x198] = 1;                                   // 5800:4b46 .. 4b82
      if (t.b[0xF7] < 0x80) t.b[0xF7] = 0xB3;
      t.combat.target = null;
    } else await msgC(t, 'is unaffected');                               // 5800:4b9f
  }
}

// 55 Fire Shield 5800:4BEC
export async function ov22_4BEC() {
  let done = false;
  do {
    let k;
    if (G.SelectedChar.b[0x198] === 0) k = (await HorizontalMenu('flame type: ', 'Hot Cold', 13, 10, 15, false, false)).key;   // 5800:4c4f
    else k = (await X.Roll(1, 10)) < 6 ? 'C' : 'H';                      // 5800:4c08 .. 4c1b
    if (k === 'H') {
      await X.ApplyEffect(G.SelectedChar, 0x32, await SpellDuration(0x55), 0, 0, 0, 0, 'is protected');   // 5800:4c6d / 4c8c
      await X.ApplyEffect(G.SelectedChar, 0x8F, await SpellDuration(0x55), 0, 0, 0, 0, '');   // 5800:4ca0 / 4cbf
      done = true;
    } else if (k === 'C') {
      await X.ApplyEffect(G.SelectedChar, 0x36, await SpellDuration(0x55), 0, 0, 0, 0, '');   // 5800:4cde / 4cfd (no message)
      await X.ApplyEffect(G.SelectedChar, 0x8F, await SpellDuration(0x55), 0, 0, 0, 0, '');   // 5800:4d11 / 4d30
      done = true;
    } else if ((await HorizontalMenu('Abort spell? ', 'Yes No', 13, 10, 15, false, false)).key === 'Y') done = true;   // 5800:4d6d / 4d79
  } while (!done);
}

// 56 Fumble 5800:4DA0
export async function ov22_4DA0() {
  const t = T1();
  G.DamageType = 0x40;                                                   // 5800:4db2
  if (!await X.SavingThrow(t, 4, 0)) {                                   // 5800:4dc3
    await X.ApplyEffect(t, 0x1B, await SpellDuration(0x56), 0, 0, 0, 0, 'is clumsy');   // 5800:4dd9 / 4df8
    if (await X.HasEffect(t, 0x1B, { v: null })) await X.CallEffectHandler(0x1B, t, null, 0);   // 5800:4e0b / 4e26
  } else {
    await X.ApplyEffect(t, 0x2A, await SpellDuration(0x56), 0, 0, 0, 0, 'is slowed');   // 5800:4e3a / 4e59
    if (await X.HasEffect(t, 0x2A, { v: null })) await X.CallEffectHandler(0x2A, t, null, 0);   // 5800:4e6c / 4e87
  }
  await ApplySpell(G.sp_Current, 0, 1, 0, 0, 'is clumsy');               // 5800:4eac
}

export async function ov22_4EB4() { await ApplySpell(G.sp_Current, 0, 0, await X.RollDice(3, 10), 10, ''); }   // 57 5800:4eca / 4ee3
export const ov22_4EF7 = apply('is protected');                                                               // 58 5800:4f1d

// 5B Spell_CloudKill 5800:4F3E
export async function Spell_CloudKill() {
  G.SpellArea = 1;
  const lvl = await X.SpellCasterLevel(G.sp_Current);
  const { r, n } = newCloudRecord('cloud9_List');
  await X.AddEffect(G.SelectedChar, 0x5B, lvl, (lvl + n * 16) & 0xFF, 1);   // 5800:5019
  r.owner = G.SelectedChar; r.id = n; r.x = G.SpellX; r.y = G.SpellY;
  const occ = new Array(10).fill(0);
  let tile = 0, x = 0, y = 0;
  for (let k = 1; k <= 9; k++) {
    const d = cd9(k); x = sqx(d); y = sqy(d);
    const o = { v: 0 }, tl = { v: 0 };
    CellAt(x, y, o, tl); occ[k] = o.v; tile = tl.v;
    r.active[k] = tile === 0 || cost(tile) === 0xFF ? 0 : 1;
    if (tile === 0x1E) {                                                 // 5800:50e8 .. stinking clouds, first match
      let found = false;
      for (let q = G.cloud_List; q && !found; q = q.next)
        for (let j = 1; j <= 4; j++)
          if (q.active[j] && sx8(q.x + sb(ds(0x2694 + csd(j)))) === x && sx8(q.y + sb(ds(0x269D + csd(j)))) === y &&
              q.ground[j] !== 0x1E && q.ground[j] !== 0x1C) { tile = q.ground[j]; found = true; }
    } else if (tile === 0x1C) {                                          // other cloudkills, first match
      let found = false;
      for (let q = G.cloud9_List; q && !found; q = q.next) {
        if (q === r) continue;
        for (let j = 1; j <= 9; j++)
          if (q.active[j] && sx8(q.x + sb(ds(0x2694 + cd9(j)))) === x && sx8(q.y + sb(ds(0x269D + cd9(j)))) === y &&
              q.ground[j] !== 0x1E && q.ground[j] !== 0x1C) { tile = q.ground[j]; found = true; }
      }
    } else if (tile === 0x1F && G.corpse_Count) {                        // 5800:531e .. 53a2
      for (let j = 1; j <= G.corpse_Count; j++) {
        const e = (G.corpse_List || [])[j];
        if (e && sx8(e.col) === x && sx8(e.row) === y) tile = e.tile;
      }
    }
    r.ground[k] = tile;
    if (r.active[k]) setGrid(x, y, 0x1C);                                // 5800:53f5
  }
  r.ground[9] = tile; if (r.active[9]) setGrid(x, y, 0x1C);              // 5800:5450 .. 545c (repeats square 9)
  await X.ShowCharacterMessage(G.SelectedChar, 'Creates a poisonous cloud', 10, 0);   // 5800:5486
  FocusSquare(G.SpellX, G.SpellY, 0xFF, 8); await MessageDelay(); await X.ClearCharacterMessage();   // 5800:5499 .. 54a3
  for (let k = 1; k <= 9; k++) if (occ[k] !== 0) await X.StinkingCloudCheck(G.cb_Char[occ[k]], 1);   // 5800:54ae .. 54e4 (no duplicate filter)
}

// 5C Cone of Cold 5800:54EB
export async function ov22_54EB() {
  const c = G.SelectedChar;
  let n = ((await X.SpellCasterLevel(G.sp_Current)) + 1) >> 1; if (n < 1) n = 1;   // 5800:5501 .. 5524
  ConeTargets(CombatantCol(c), CombatantRow(c), G.SpellX, G.SpellY, 2, n);   // 5800:5550
  const lv = await X.SpellCasterLevel(G.sp_Current);
  await ApplySpell(G.sp_Current, 0, 0, (lv + await X.RollDice(lv, 4)) & 0xFF, 10, '');   // 5800:5564 / 5588
}

// 5D Feeblemind 5800:5590
export async function ov22_5590() {
  const t = T1();
  const saved = t.b[0xE3 + 4];                                           // 5800:55a2 save[4]
  const cls = t.b[0x75];                                                 // 5800:55ad .. 55d1
  if (cls === 0) t.b[0xE3 + 4] = (saved - 1) & 0xFF; else if (cls === 5) t.b[0xE3 + 4] = (saved + 4) & 0xFF; else t.b[0xE3 + 4] = (saved + 2) & 0xFF;
  await ApplySpell(G.sp_Current, 0, 0, 0, 0, '');                        // 5800:55fa
  const e = { v: null };
  if (await X.HasEffect(t, 0x44, e)) await X.CallEffectHandler(0x44, t, e.v, 0);   // 5800:560b / 5626
  t.b[0xE3 + 4] = saved;                                                 // 5800:562e
}

export const ov22_563B = apply('');                                                                           // 5F 5800:5661
export const ov22_5669 = apply('');                                                                           // 60 5800:568f
export const ov22_5697 = apply('');                                                                           // 61 5800:56bd

// 62 (breath: cold cone) 5800:56C4
export async function ov22_56C4() {
  const c = G.SelectedChar;
  ConeTargets(CombatantCol(c), CombatantRow(c), G.SpellX, G.SpellY, 1, 3);   // 5800:56fd
  for (let k = 1; k <= G.SpellTargetCount; k++) {
    const t = tg()[k];
    await X.DamageCharacter(t, await X.RollDice(6, 6), ds(0x3E02), t.b[0x11A] !== 0x12 ? 1 : 0);   // 5800:5762 / 5770
  }
}
export const ov22_578B = async () => { if (await X.HealCharacter(T1(), ((await X.Roll(2, 4)) + 2) & 0xFF, 0)) await X.ShowCombatMessageAnimation(T1(), 1, 'is Healed'); };   // 63 5800:579f .. 57d0

// ======================================================================================================
// effect handlers of ov22 (EffectHandler[type](c, e, mode))
// ======================================================================================================

// 5800:57E3 EffBreathWeapon — effect 58h
export async function EffBreathWeapon(c, e, mode) {
  if (G.CombatRound !== 0 && (await X.Roll(1, 100)) <= 0x32) return;    // 5800:57e9 / 57f6
  G.DamageType = 0x24;                                                   // 5800:5802
  const col = CombatantCol(c), row = CombatantRow(c);
  await msgC(c, 'Breathes!');                                            // 5800:583e
  await okFlag(0x33);                                                    // 5800:584e
  G.SpellX = sx8(col + Sign(sx8(G.SpellX) - col)) & 0xFF;               // 5800:585f
  G.SpellY = sx8(row + Sign(sx8(G.SpellY) - row)) & 0xFF;               // 5800:587c
  if (sx8(G.SpellX) === col + 1) G.SpellX = (G.SpellX + 1) & 0xFF;       // 5800:5893 .. 58ae
  if (sx8(G.SpellY) === row + 1) G.SpellY = (G.SpellY + 1) & 0xFF;
  await X.ov23_1569(c);                                                  // 5800:58b8
  await X.BuildFourAnimationFrames(0x13);                                // 5800:58c0
  await X.AnimateAlongPath(col, row, sx8(G.SpellX), sx8(G.SpellY), 4, 0x32);   // 5800:58df
  const wall = { v: false };
  await BoltHitSquare(sx8(G.SpellX), sx8(G.SpellY), c.b[0x78], 3, 0, wall);   // 5800:5900
  await LightningBolt(10, c.b[0x78], 3, 0);                              // 5800:5915
  if (e.b[3] < 0xFE) await X.RemoveEffect(c, 0x58, e); else e.b[3] = (e.b[3] - 1) & 0xFF;   // 5800:5918 .. 593a
  await X.ClearCombatantActionFlags(c);                                  // 5800:5945
}

// 5800:5974 EffSpitAcidRanged — effect 56h
export async function EffSpitAcidRanged(c, e, mode) {
  await okFlag(0x41);                                                    // 5800:5985
  G.hold_Victim = c.combat ? c.combat.target : null;                     // 5800:5989 .. 599a
  const roll = await X.Roll(1, 100);                                     // 5800:59a4
  const v = G.hold_Victim;
  if (v && (await X.TargetDistance(c, v)) < 7) {                         // 5800:59ba .. 59cd
    if (roll < 0x1F) {
      await msgC(c, 'Spits Acid');                                       // 5800:59f6
      await X.BuildFourAnimationFrames(0x17);
      await X.AnimateAlongPath(CombatantCol(c), CombatantRow(c), CombatantCol(v), CombatantRow(v), 1, 0x1E);   // 5800:59fe .. 5a41
      await X.DamageCharacter(v, c.b[0x78], 2, await X.SavingThrow(v, 3, 0));   // 5800:5a67 / 5a6d
    } else await msgC(c, 'Spits Acid and Misses');                       // 5800:5a8f
  }
}

// shared body of EffAcidCone 5AA8 / EffFireCone 5C86
async function breathCone(c, e, dmgType, width, length, text, sideTest) {
  G.g_7746 = 0;                                                          // 5800:5aae
  if (G.CombatRound === 0) e.b[3] = 3;                                   // 5800:5ab3 / 5aba three breaths
  if (e.b[3] === 0) return;                                              // 5800:5ac2
  G.DamageType = dmgType;                                                // 5800:5acf
  const col = CombatantCol(c), row = CombatantRow(c);
  await okFlag(0x3D);                                                    // 5800:5afb
  if (G.g_7746) ConeTargets(col, row, G.SpellX, G.SpellY, width, length);   // 5800:5aff / 5b1d
  if (sideTest) {
    const opp = await X.IsSideZero(c);
    for (let k = 1; k <= G.SpellTargetCount; k++) if (tg()[k].b[0x197] !== (opp ? 1 : 0)) G.g_7746 = 0;   // 5800:5b20 .. 5b65
  }
  if (!G.g_7746 || G.SpellTargetCount === 0) return;                     // 5800:5b67 / 5b71
  await msgC(c, text);                                                   // 5800:5b96
  await X.BuildFourAnimationFrames(0x12);
  await X.AnimateAlongPath(col, row, CombatantCol(tg()[1]), CombatantRow(tg()[1]), 1, 0x1E);   // 5800:5b9e .. 5be1
  for (let k = 1; k <= G.SpellTargetCount; k++) {                        // 5800:5be6 .. 5c5b
    const t = tg()[k];
    if (t) await X.DamageCharacter(t, c.b[0x78], 2, await X.SavingThrow(t, 3, 0));
  }
  e.b[3] = (e.b[3] - 1) & 0xFF;                                          // 5800:5c5d
  await X.ClearCombatantActionFlags(c);                                  // 5800:5c6a
}
// 5800:5AA8 EffAcidCone — effect 5Ah (the side test uses IsSideZero(c) as the opposite side's code, 6200:25B0)
export async function EffAcidCone(c, e, mode) { await breathCone(c, e, 0x30, 1, 6, 'breathes acid', true); }
// 5800:5C86 EffFireCone — effect 80h
export async function EffFireCone(c, e, mode) { await breathCone(c, e, 0x21, 3, 9, 'breathes fire', false); }

// 5800:5E11 EffFireBreathShort — effect 83h
export async function EffFireBreathShort(c, e, mode) {
  await okFlag(0x41);                                                    // 5800:5e22
  G.hold_Victim = c.combat ? c.combat.target : null;                     // 5800:5e26 .. 5e37
  const v = G.hold_Victim;
  if ((await X.Roll(1, 100)) < 0x33 && (await X.TargetDistance(c, v)) < 2 && v) {   // 5800:5e41 .. 5e6e
    G.DamageType = 1;                                                    // 5800:5e73
    G.g_7746 = (await X.ClearCombatantActionFlags(c)) ? 1 : 0;           // 5800:5e7e
    await msgC(c, 'Breathes Fire');                                      // 5800:5ea1
    await X.BuildFourAnimationFrames(0x17);
    await X.AnimateAlongPath(CombatantCol(c), CombatantRow(c), CombatantCol(v), CombatantRow(v), 1, 0x1E);   // 5800:5ea9 .. 5eec
    await X.DamageCharacter(v, 7, 2, await X.SavingThrow(v, 3, 0));      // 5800:5f0d / 5f13
  }
}

// 5800:5F2F EffThrowLightning — effect 84h
export async function EffThrowLightning(c, e, mode) {
  if (G.CombatRound >= 4) return;                                        // 5800:5f35
  const col = CombatantCol(c), row = CombatantRow(c);
  await msgC(c, 'throws lightning');                                     // 5800:5f76
  await okFlag(0x33);                                                    // 5800:5f86
  await X.ov23_1569(c);                                                  // 5800:5f90
  await X.BuildFourAnimationFrames(0x13);                                // 5800:5f98
  await X.AnimateAlongPath(col, row, sx8(G.SpellX), sx8(G.SpellY), 4, 0x32);   // 5800:5fb7
  const wall = { v: false };
  await BoltHitSquare(sx8(G.SpellX), sx8(G.SpellY), await X.RollDice(16, 6), 4, 0, wall);   // 5800:5fca / 5fdc
  await LightningBolt(10, await X.RollDice(16, 6), 4, 0);                // 5800:5fe8 / 5ff5 a second roll
  await X.ClearCombatantActionFlags(c);                                  // 5800:5ffe
}

// 5800:6022 EffParalysingGaze — effect 7Eh
export async function EffParalysingGaze(c, e, mode) {
  if (c.combat) c.combat.target = null;                                  // 5800:6028
  await okFlag(0x24);                                                    // 5800:6045
  G.hold_Victim = c.combat ? c.combat.target : null;                     // 5800:6049 .. 605a
  const v = G.hold_Victim;
  if (!v) return;                                                        // 5800:605e
  await msgC(c, 'gazes...', 0);                                          // 5800:6085
  await X.BuildFourAnimationFrames(0x12);
  await X.AnimateAlongPath(CombatantCol(c), CombatantRow(c), CombatantCol(v), CombatantRow(v), 4, 0x2D);   // 5800:608d .. 60d0
  if (!await X.SavingThrow(v, 1, 0)) {                                   // 5800:60e3
    await X.AddEffect(v, 0x34, 60, 0xFF, 0);                             // 5800:6101
    await msgC(v, 'is paralyzed', 0);                                    // 5800:6123
  }
}

// ======================================================================================================
// scroll helpers, ShowCasts, InitSpellTable
// ======================================================================================================

// 5800:612E IsScroll(item)
export function IsScroll(item) {
  if (!item) return false;                                               // 5800:6134
  const slot = IT(item.b[0x2E], 0);
  return slot >= 0x0B && slot <= 0x0D;                                   // 5800:6134 .. 616e
}

// 5800:617B UseScrollSpell(owner, item, spell)
export async function UseScrollSpell(owner, item, spell) {
  let k = 0;
  for (let i = 1; i <= 3; i++) if ((item.b[0x3B + i] & 0x7F) === spell) k = i;   // 5800:6184 .. 61ac the last match
  if (k === 0) return;
  item.b[0x3B + k] = 0;                                                  // 5800:61bb
  item.b[0x30] = (item.b[0x30] - 1) & 0xFF;                              // 5800:61c5
  if (item.b[0x30] < 0xD2) await X.LoseItem(owner, item);                // 5800:61d6 / 61e9
}

// 5800:6209 ShowCasts(c, msg, spell)
export async function ShowCasts(c, msg, spell) {
  msg = String(msg).slice(0, 40);
  if (G.view_Mode === 5) {
    await X.ShowCharacterMessage(c, 'Casts a Spell', 10, 1);             // 5800:6245
    ClearRectangle(0, 0x17, 0x27, 0x17);                                 // 5800:6256
    DrawText(0, 0x17, 10, 0, 'Spell:' + spellName(spell));               // 5800:628e
  } else {
    ClearRectangle(1, 0x12, 0x26, 0x16);                                 // 5800:62a1
    await X.DrawCharacterName(c, 1, 0x13, 0);                            // 5800:62b5
    DrawText(c.b[0] + 2, 0x13, 10, 0, msg);                              // 5800:62d3
    DrawText(1, 0x14, 10, 0, spellName(spell));                          // 5800:62f6
    if (msg === 'casts') await shotHold('S079-CASTS');                  // dev: shot hooks for the timed lines (not in
    if (msg === 'has memorized') await shotHold('S091', 'S090');         //   the original)
    await MessageDelay(); await X.ClearCharacterMessage();               // 5800:62fb / 6300
  }
}

// SpellHandlers[1..100] as installed by InitSpellTable (MAGIC.pas.md part B table, column `handler`)
export const SPELL_HANDLERS = [null,
  ov22_1CF9, ov22_1D2A, ov22_1D55, ov22_1D93, ov22_1DD5, ov22_1E0F, ov22_1E0F, ov22_1E4E, ov22_1E7C, ov22_1EC9,   // 01..0A
  ov22_1DD5, ov22_1FA0, ov22_20E1, ov22_2180, ov22_21C7, ov22_1E0F, ov22_1E0F, ov22_1DD5, ov22_2232, ov22_2260,   // 0B..14
  ov22_22B4, ov22_1DD5, ov22_23F2, ov22_245B, ov22_2494, ov22_24CD, ov22_2580, ov22_262F, ov22_1DD5, ov22_2682,   // 15..1E
  ov22_26BB, ov22_26F6, ov22_2754, Spell_StinkingCloud, Spell_Strength, Spell_AnimateDead, ov22_2F5E, ov22_2FA4,  // 1F..26
  ov22_3076, ov22_3093, Spell_DispelMagic, ov22_352D, Spell_RemoveCurse, ov22_36A7, ov22_36E0, Spell_DispelMagic,   // 27..2E
  Spell_Fireball, ov22_391D, ov22_23F2, ov22_2682, ov22_3C98, ov22_1E0F, ov22_1E0F, ov22_1E0F, ov22_3CED,         // 2F..37
  Spell_Restoration, ov22_3EE2, ov22_3F23, ov22_3F6F, ov22_3FF4, ov22_4043, ov22_407A, ov22_40D5, Spell_Fireball, // 38..40
  ov22_4103, ov22_413F, ov22_4194, ov22_4289, ov22_1E0F, ov22_4311, ov22_43A7, ov22_43EA, ov22_4432, ov22_4493,   // 41..4A
  ov22_44D3, ov22_45B5, ov22_1DD5, ov22_4672, ov22_472C, ov22_4759, ov22_4791, ov22_4822, ov22_48E4, ov22_4A8F,   // 4B..54
  ov22_4BEC, ov22_4DA0, ov22_4EB4, ov22_4EF7, Spell_RemoveCurse, Spell_AnimateDead, Spell_CloudKill, ov22_54EB,   // 55..5C
  ov22_5590, ov22_23F2, ov22_563B, ov22_5669, ov22_5697, ov22_56C4, ov22_578B, ov22_36A7,                         // 5D..64
];

// 5800:630B InitSpellTable
export function InitSpellTable() {
  const h = handlers();
  h[0] = 'SelectTargetsCamp';                                            // 5800:6311 / 6317
  G.cure_InProgress = 0; G.ItemCast = 0; G.sp_CampTarget = null; G.ItemsChanged = 1;   // 5800:631b .. 632d
  for (let id = 1; id <= 100; id++) h[id] = SPELL_HANDLERS[id];          // 5800:6335 .. 6842
  if (!Array.isArray(G.EffectHandler)) G.EffectHandler = new Array(0x94).fill(null);
  G.EffectHandler[0x56] = EffSpitAcidRanged;                             // 5800:6849 .. 689d DS:70FE
  G.EffectHandler[0x58] = EffBreathWeapon;                               // DS:7106
  G.EffectHandler[0x5A] = EffAcidCone;                                   // DS:710E
  G.EffectHandler[0x7E] = EffParalysingGaze;                             // DS:719E
  G.EffectHandler[0x80] = EffFireCone;                                   // DS:71A6
  G.EffectHandler[0x83] = EffFireBreathShort;                            // DS:71B2
  G.EffectHandler[0x84] = EffThrowLightning;                             // DS:71B6
}

// 5800:0000 ov22_LoadDeps / 5800:68A5 ov22_init: empty.
