// game/areas/magic_ov15.js — MAGIC ov15 (4000): camp — rest, memorize, scribe, effects display, party options, Fix.
// Owner: cab-build-areas. Source: decode/pseudo/MAGIC.pas.md ov15 (verified, MAGIC_VERIFY.md #verify-33..38 / #43
// applied); Pool twin ov15 6B00 (structure only). Caution rule 2: every menu loop re-read from decode/listings/ov15.lst
// (MagicMenu 4000:14d2, PartyOrder 1834, GameSpeedMenu 1b4d, AlterMenu 1d0a, Camp 23fc): all pass allowExt 1 and
// animate 1 (the Pics submenu allowExt 0, animate 1); an extended key cycles the selected member (CycleSelectedChar +
// PartySummary) except in PartyOrder's place mode ('G' / 'O' move) and GameSpeedMenu (ext 'P' slower-to-faster /
// 'H' with bounds, plain 'F' / 'S' without bounds). Findings from the bytes (code follows the listing):
//  - RestForCures (4000:20c5..2252): the per-member times t1/t4/t5 ([BP-0Ah]/[BP-0Ch]/[BP-0Eh]) are zeroed once before
//    the loop, not per member (only `fixed` [BP-10h] is), so a member who is not Okay reuses the previous member's
//    times; the expected-healing sum [BP-2] is never initialised (stack garbage; 0 here, TODO(decode)).
//  - DistributeHealing (4000:2255): `total` is reduced only when HealCharacter returns true and n <= total.
//  - MoveSelectedDown / MoveSelectedUp list surgery from decode/listings/ov15.c (4000:158a / 16cb).
// Character fields: +1Eh.. mem_spell[0..83] (bit 7 = chosen, not memorised), +72h rest_need, +78h maxhp,
// +78h + id known_spell[id], +12Ch + class*5 + level spell_slots, +14Dh items (item special[1..3] = +3Ch..+3Eh),
// +F2h effects (+0 type), +189h next, +195h status, +196h active, +1A4h hp.
// Spell table (image): class DS:37DA + id*16, level 37DB, effect 37E4; SpellNames string[40] at DS:27BD + id*29h.
// RestClock DS:7566 = G.RestClock[0..6] (words; [1] units 7568, [2] tens 756A, [3] hours 756C), as party_ov20.js.

import { G, pstr } from '../engine/state.js';
import { DrawText, ClearRectangle, DrawScreenFrame } from '../engine/text.js';
import { TerminateGame } from '../engine/input.js';
import { HorizontalMenu, AskYesNo, ClearMenuLine, VerticalListMenu, FreeMenuList } from './view_ov26.js';
import { view } from './view_ov30.js';
import { LoadAnimation } from './view_ov29.js';
import { X } from './view_link.js';

const sel = () => G.SelectedChar;
const sb = (v) => ((v & 0xFF) ^ 0x80) - 0x80;
const dsPstr = (a, dflt = '') => (G.ds ? pstr(G.ds, a) : dflt);
const spClass = (id) => G.ds[0x37DA + id * 16];
const spLevel = (id) => G.ds[0x37DB + id * 16];
const spEffect = (id) => G.ds[0x37E4 + id * 16];
const spName = (id) => dsPstr(0x27BD + id * 0x29);
const special = (it, k) => it.b[0x3B + k];                               // item special[1..3] +3Ch..+3Eh
const rc = () => { if (!Array.isArray(G.RestClock)) G.RestClock = [0, 0, 0, 0, 0, 0, 0]; return G.RestClock; };
const setRestTime = (t) => { const R = rc(); R[3] = Math.floor(t / 60) & 0xFFFF; R[2] = Math.floor((t - R[3] * 60) / 10) & 0xFFFF; R[1] = (t % 10) & 0xFFFF; };

// 4000:0034 RestTimeNeeded(c): Word
export async function RestTimeNeeded(c) {
  let maxMem = 0, maxScr = 0, lvMem = 0, lvScr = 0;                      // 4000:003a .. 0046
  for (let i = 0; i <= 0x53; i++)                                        // 4000:004a
    if (c.b[0x1E + i] >= 0x80) {                                         // 4000:0053
      const lv = spLevel(c.b[0x1E + i] & 0x7F);                          // 4000:0064
      if (maxMem < lv) maxMem = lv;                                      // 4000:0083
      lvMem += lv;                                                       // 4000:0091
    }
  for (let it = c.items; it; it = it.next) {                             // 4000:009d .. 0117
    if (await X.IsScroll(it))                                            // 4000:00b5 / 00c2
      for (let k = 1; k <= 3; k++)                                       // 4000:00c4
        if (special(it, k) >= 0x80) {                                    // 4000:00cd
          const lv = spLevel(special(it, k) & 0x7F);                     // 4000:00de
          if (maxScr < lv) maxScr = lv;                                  // 4000:00fd
          lvScr += lv;                                                   // 4000:010b
        }
  }
  let need = 0;                                                          // 4000:0128
  if (lvMem !== 0 || lvScr !== 0) need = 4;                              // 4000:012c .. 0138
  if (maxMem > 2 || maxScr > 2) need = 6;                                // 4000:013c .. 0148
  c.b[0x72] = need;                                                      // 4000:014c
  return (lvScr * 15 + need * 60 + lvMem * 15) & 0xFFFF;                 // 4000:0156 .. 017c
}

// 4000:0188 CancelMemorizing(c)
export function CancelMemorizing(c) {
  for (let i = 0; i <= 0x53; i++) if (c.b[0x1E + i] >= 0x80) c.b[0x1E + i] = 0;   // 4000:018e .. 01bb
  c.b[0x72] = 0;                                                         // 4000:01bd
}

// 4000:01CB CancelScribing(c)
export async function CancelScribing(c) {
  for (let it = c.items; it; it = it.next)
    if (await X.IsScroll(it))                                            // 4000:01ef
      for (let k = 1; k <= 3; k++) it.b[0x3B + k] &= 0x7F;               // 4000:01fe .. 0225
}

// 4000:023E CancelAllStudy
export async function CancelAllStudy() {
  for (let c = G.PartyList; c; c = c.next) { CancelMemorizing(c); await CancelScribing(c); }   // 4000:0244 .. 026c
}

// 4000:0282 FreeSlots(level, class): Byte
export function FreeSlots(level, cls) {
  const c = sel();
  let n = 0;                                                             // 4000:0288
  for (let i = 0; i <= 0x53; i++) {                                      // 4000:028c
    const id = c.b[0x1E + i];
    if (id !== 0 && spLevel(id & 0x7F) === (level & 0xFF) && spClass(id & 0x7F) === (cls & 0xFF)) n++;   // 4000:0295 .. 02f2
  }
  return (c.b[0x12C + cls * 5 + level] - n) & 0xFF;                      // 4000:02f4 .. 0334
}

// 4000:0391 CanUseMagic(what): 1 cast, 2 memorize, 3 scribe
export async function CanUseMagic(what) {
  let msg = '';
  if (what === 1 && view.mem(0x4BE5) !== 0) msg = 'cannot cast spells in this area';   // 4000:039e
  else if (sel().b[0x195] === 1 || sel().b[0x196] === 0) {
    msg = 'is in no condition to ';
    if (what === 1) msg += 'cast any spells';
    else if (what === 2) msg += 'memorize spells';
    else if (what === 3) msg += 'scribe any scrolls';
  }
  if (msg === '') return true;                                           // 4000:048e
  await X.ShowCharacterMessage(sel(), msg, 10, 1);                       // 4000:04a5
  return false;                                                          // 4000:0496
}

// 4000:04CB CastMenu (ExploreCommand 'C')
export async function CastMenu() {
  let cast = false;                                                      // 4000:04d1
  const idx = { v: -1 };                                                 // 4000:04d5
  G.sp_CampTarget = null; G.menu_Sel = 1;                                // 4000:04da / 04e2
  if (await CanUseMagic(1)) {                                            // 4000:04e7
    let s;
    do {
      const found = { v: false };
      s = await X.SpellList(0, 1, idx, found);                           // 4000:04f5
      if (s === 0) {                                                     // 4000:050d
        if (!found.v) await X.ShowCharacterMessage(sel(), 'has no spells memorized', 10, 1);   // 4000:053e / 054a
        else cast = true;                                                // 4000:0544
      } else {
        cast = true;                                                     // 4000:0513
        ClearRectangle(1, 0x11, 0x26, 0x16);                             // 4000:0517
        const used = { v: false };
        await X.CastSpell(s, 0, 1, used);                                // 4000:0528
      }
    } while (s !== 0);                                                   // 4000:056c
  }
  if (cast) await X.RedrawCurrentMode();                                 // 4000:0572 / 0578
}

// 4000:05CA ShowFreeSlots: Boolean
export async function ShowFreeSlots() {
  let any = false;                                                       // 4000:05cd
  const has = [false, false, false], txt = [[], [], []];
  for (let cls = 0; cls <= 2; cls++) {                                   // 4000:05d1
    has[cls] = false;                                                    // 4000:05de
    for (let lv = 1; lv <= 5; lv++) {                                    // 4000:05e4
      txt[cls][lv] = String(await X.ByteToStr(FreeSlots(lv, cls))).slice(0, 2);   // 4000:05f1 / 0604 / 0609 string[2]
      if (sel().b[0x12C + cls * 5 + lv] === 0) txt[cls][lv] = ' ';       // 4000:062f / 064e
      else { has[cls] = true; any = true; }                              // 4000:067b / 0681
    }
  }
  if (any) {                                                             // 4000:069b
    await X.ShowCharacterMessage(sel(), 'can memorize:', 10, 0);         // 4000:06bb
    let row = 3;                                                         // 4000:06c6
    for (let cls = 0; cls <= 2; cls++) {                                 // 4000:06d3
      if (!has[cls]) continue;                                           // 4000:06df
      const s = ['    Cleric Spells:', '     Druid Spells:', 'Magic-User Spells:'][cls];   // 4000:06e9 .. 072e
      DrawText(1, row + 0x11, 10, 0, s);                                 // 4000:072e
      let col = 0x13;                                                    // 4000:074a
      for (let lv = 1; lv <= 5; lv++) { DrawText(col + 1, row + 0x11, 10, 0, txt[cls][lv]); col += 3; }   // 4000:074e .. 0797
      row++;                                                             // 4000:0799
    }
  }
  return any;                                                            // 4000:07a5
}

// 4000:07B2 Rest(var interrupted)
export async function Rest(interrupted) {
  let t = 0;                                                             // 4000:07b8
  for (let c = G.PartyList; c; c = c.next) { const n = await RestTimeNeeded(c); if (t < n) t = n; }   // 4000:07bd .. 07fc
  setRestTime(t);                                                        // 4000:07fe / 080b / 0824
  interrupted.v = !!(await X.RestLoop(1));                               // 4000:0832
  rc().fill(0);                                                          // 4000:0840 FillChar(RestClock, 0Eh, 0)
  await X.DrawLocationTimeStatus();                                      // 4000:0851
}

// 4000:085C SortMemorized: exchange sort of SelectedChar's 84 mem_spell bytes by id and 7Fh
export function SortMemorized() {
  const b = sel().b;
  for (let i = 0; i < 0x53; i++)                                         // 4000:0862 .. 08f0
    for (let j = i + 1; j <= 0x53; j++)
      if ((b[0x1E + j] & 0x7F) < (b[0x1E + i] & 0x7F)) { const t = b[0x1E + i]; b[0x1E + i] = b[0x1E + j]; b[0x1E + j] = t; }
}

// 4000:0942 MemorizeMenu
export async function MemorizeMenu() {
  if (!await CanUseMagic(2)) return;                                     // 4000:0948 / 0953
  let done = false;                                                      // 4000:0956
  const idx = { v: -1 };                                                 // 4000:095a
  G.menu_Sel = 1;                                                        // 4000:095f
  let found = { v: false };
  let s = await X.SpellList(5, 0, idx, found); let changed = true;       // 4000:0964 / 097c
  if (!found.v) changed = false;                                         // 4000:0980 / 0986
  else if (await AskYesNo('Memorize These Spells? ', 14, 10, 15) === 'N') CancelMemorizing(sel());   // 4000:0986 .. 09a7
  else done = true;                                                      // 4000:09b5
  idx.v = -1;                                                            // 4000:09bb
  while (!done) {                                                        // 4000:09c4
    if (!await ShowFreeSlots()) {                                        // 4000:09cd
      done = true; await X.ShowCharacterMessage(sel(), 'cannot memorize any spells', 10, 1);   // 4000:09d5 / 09fb
    } else {
      found = { v: false };
      s = await X.SpellList(1, 2, idx, found); changed = true;           // 4000:0a09 / 0a21
      if (s === 0) done = true;                                          // 4000:0a25 / 0a2b
      else if (FreeSlots(spLevel(s), spClass(s)) !== 0) {                // 4000:0a31 / 0a59
        let k = 0; while (sel().b[0x1E + k] !== 0) k++;                  // 4000:0a59 .. 0a6f
        sel().b[0x1E + k] = s | 0x80;                                    // 4000:0a74
        SortMemorized();                                                 // 4000:0a8d
      }
    }
  }
  if (idx.v !== -1) {                                                    // 4000:0a94
    idx.v = -1; found = { v: false };
    s = await X.SpellList(5, 0, idx, found);                             // 4000:0a9a / 0aaf
    if (found.v && await AskYesNo('Memorize these spells? ', 14, 10, 15) === 'N') CancelMemorizing(sel());   // 4000:0ab7 .. 0ae7
  }
  if (changed) await X.RedrawCurrentMode();                              // 4000:0aea / 0af0
}

// 4000:0B9B ScribeMenu
export async function ScribeMenu() {
  if (!await CanUseMagic(3)) return;                                     // 4000:0ba1 / 0bac
  let done = false;                                                      // 4000:0baf
  const idx = { v: -1 };                                                 // 4000:0bb3
  let found = { v: false };
  let s = await X.SpellList(6, 0, idx, found); let changed = true;       // 4000:0bb8 / 0bd0
  if (!found.v) changed = false;                                         // 4000:0bd4 / 0bda
  else if (await AskYesNo('Scribe These Spells? ', 14, 10, 15) === 'N') await CancelScribing(sel());   // 4000:0bda .. 0bfb
  else done = true;                                                      // 4000:0c09
  idx.v = -1;                                                            // 4000:0c0f
  while (!done) {                                                        // 4000:0c18
    found = { v: false };
    s = await X.SpellList(3, 3, idx, found);                             // 4000:0c21
    if (s === 0) {                                                       // 4000:0c36
      done = true;                                                       // 4000:0c39
      if (!found.v) await X.ShowCharacterMessage(sel(), 'has no copyable scrolls', 10, 1);   // 4000:0c43 / 0c60
      else changed = true;                                               // 4000:0c6d
    } else {
      changed = true;                                                    // 4000:0c74
      if (sel().b[0x78 + s] !== 0) await X.ShowTimedBottomMessage('You already know that spell');   // 4000:0c78 .. 0c99
      else {
        let marked = false;                                              // 4000:0ca1 / 0caa
        for (let it = sel().items; it && !marked; it = it.next) {        // 4000:0cb6 .. 0d20
          if (await X.IsScroll(it))                                      // 4000:0cc4 / 0cd1
            for (let k = 1; k <= 3; k++)                                 // 4000:0cd3
              if (special(it, k) >= 0x80 && (special(it, k) & 0x7F) === s) {   // 4000:0cdc .. 0d11
                await X.ShowTimedBottomMessage('You are already scibing that spell'); marked = true;   // 4000:0d16
              }
        }
        if (!marked) {                                                   // 4000:0d31
          if (sel().b[0x12C + spClass(s) * 5 + spLevel(s)] === 0) await X.ShowTimedBottomMessage('You can not scribe that spell.');   // 4000:0d3a .. 0dfc
          else {
            for (let it = sel().items; it && !marked; it = it.next) {    // 4000:0d71 .. 0dda
              let k = 1;                                                 // 4000:0d90
              do {                                                       // first scroll byte equal to s (no IsScroll test)
                if (special(it, k) === s) { it.b[0x3B + k] |= 0x80; marked = true; }   // 4000:0d94 .. 0dc7
                k++;                                                     // 4000:0dcb
              } while (!(k >= 4 || marked));                             // 4000:0dce / 0dd4
            }
          }
        }
      }
    }
  }
  if (idx.v !== -1) {                                                    // 4000:0deb
    idx.v = -1; found = { v: false };
    s = await X.SpellList(6, 0, idx, found);                             // 4000:0ded / 0e0f
    if (found.v && await AskYesNo('Scribe these spells? ', 14, 10, 15) === 'N') await CancelScribing(sel());   // 4000:0e27 .. 0e57
  }
  if (changed) await X.RedrawCurrentMode();                              // 4000:0e5a / 0e60
}

// 4000:0E69 AddLine(header, text) — nested in DisplayEffects (the parent's list tail is `tail.v`)
function AddLine(tail, header, text) {
  const node = { text: String(text).slice(0, 40), isHeader: header, next: null };   // 4000:0e93 GetMem($2E), 0edb / 0ede
  tail.v.next = node; tail.v = node;                                     // 4000:0e9b .. 0ec1
}

const SPELL_EFFECTS = new Set([1, 2, 5, 8, 9, 0x0A, 0x0B, 0x0C, 0x0E, 0x10, 0x11, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19,
  0x1C, 0x1D, 0x20, 0x21, 0x22, 0x24, 0x25, 0x26, 0x27, 0x29, 0x2A, 0x2D, 0x2E, 0x31, 0x33, 0x34, 0x35]);
const FIXED_EFFECTS = { 4: 'Dispel Evil', 7: 'Faerie Fire', 0x1B: 'Fumbling', 0x1F: 'Helpless', 0x23: 'Confused',
  0x2C: 'Cause Disease', 0x32: 'Hot Fire Shield', 0x36: 'Cold Fire Shield', 0x37: 'Poisoned', 0x3B: 'Regenerating',
  0x3D: 'Fire Resistance', 0x3F: 'Minor Globe of Invulnerability', 0x44: 'enfeebled', 0x45: 'invisible to animals',
  0x47: 'Invisible', 0x48: 'Camouflaged', 0x49: 'protected from dragon breath', 0x4D: 'berserk', 0x59: 'Displaced' };

// 4000:1016 DisplayEffects
export async function DisplayEffects() {
  const list = { text: ' ', isHeader: 0, next: null };                   // 4000:101d .. 1051
  const tail = { v: list };
  for (let c = G.PartyList; c; c = c.next) {                             // 4000:105e / 106a
    let n = 0;                                                           // 4000:1075
    AddLine(tail, 1, pstr(c.b, 0));                                      // 4000:1082
    for (let e = c.effects; e; e = e.next) {                             // 4000:1086 / 1096
      let show = true, s = '';                                           // 4000:10a1
      const t = e.b[0];                                                  // 4000:10a5
      if (SPELL_EFFECTS.has(t)) {                                        // 4000:10ae .. 1127
        let id = 1, found = false;                                       // 4000:112c / 1130
        while (id < 0x39 && !found) {                                    // 4000:1134 .. 113e
          if (spEffect(id) === t) { s = spName(id); found = true; }      // 4000:1140 / 114b / 1154
          else id++;                                                     // 4000:1166
        }
        if (!found) s = 'Funky--' + (await X.ByteToStr(t));              // 4000:117f / 1185 .. 11b2
      } else if (t in FIXED_EFFECTS) s = FIXED_EFFECTS[t];               // 4000:11ba .. 13c3
      else show = false;                                                 // 4000:13c3
      if (show) { n++; AddLine(tail, 0, ' ' + s); }                      // 4000:13c6 / 13cc / 13e1
    }
    if (n === 0) AddLine(tail, 0, ' <No Spell Effects>');                // 4000:13f7 / 1410
    AddLine(tail, 0, ' ');                                               // 4000:1427
  }
  const redraw = { v: true }, idx = { v: 0 }, item = { v: null };        // 4000:143e / 1442
  DrawScreenFrame();                                                     // 4000:1447
  await VerticalListMenu('', '', 11, 10, 15, 1, 4, 0x26, 0x16, list, true, redraw, idx, item);   // 4000:146a
  FreeMenuList({ v: list });                                             // 4000:149f
  await X.RedrawCurrentMode();                                           // 4000:14a9
}

// 4000:14D2 MagicMenu(var done)
export async function MagicMenu(done) {
  let key = ' ';                                                         // 4000:14d8
  while (!done.v && key !== '\0' && key !== 'E') {                       // 4000:14dc .. 14f1 set CS:14B2
    const m = await HorizontalMenu('', dsPstr(0x0451, 'Cast Memorize Scribe Display Rest Exit'), 13, 10, 15, true, true);   // 4000:1523
    key = m.key;
    if (m.ext) { await X.CycleSelectedChar(key); await X.PartySummary(sel()); }   // 4000:152b .. 1542
    else switch (key) {
      case 'C': await CastMenu(); break;                                 // 4000:1551
      case 'M': await MemorizeMenu(); break;                             // 4000:155b
      case 'S': await ScribeMenu(); break;                               // 4000:1565
      case 'D': await DisplayEffects(); break;                           // 4000:156f
      case 'R': await Rest(done); break;                                 // 4000:157e
    }
  }
}

// 4000:158A MoveSelectedDown: SelectedChar one place towards the front; the head goes to the end
export function MoveSelectedDown() {
  const head = G.PartyList, s = sel();
  let p = head, pp = null;
  if (head === s) { while (p.next) p = p.next; }                         // 4000:1590 .. last member
  else while (p.next !== s) { pp = p; p = p.next; }                      // predecessor p and its predecessor pp
  const next = s.next;
  if (head === s) {                                                      // 4000:161c .. 1665
    if (next) G.PartyList = next;
    p.next = s; s.next = null;
  } else {                                                               // 4000:1667 ..
    p.next = next; s.next = p;
    if (p !== G.PartyList && pp) pp.next = s;
    else G.PartyList = s;
  }
}

// 4000:16CB MoveSelectedUp: SelectedChar swaps with its successor; the last member wraps to the front
export function MoveSelectedUp() {
  const head = G.PartyList, s = sel();
  let p = head;
  if (head !== s) while (p.next !== s) p = p.next;                       // 4000:16d1 .. predecessor
  const next = s.next;
  if (!next) {                                                           // last member
    s.next = head; G.PartyList = s; p.next = null;
  } else {
    s.next = next.next;
    if (G.PartyList === s) G.PartyList = next;
    if (p !== s) p.next = next;
    next.next = s;
  }
}

// 4000:1834 PartyOrder
export async function PartyOrder() {
  let place = false, key = ' ';                                          // 4000:183a / 183e
  while (key !== '\0' && key !== 'E') {                                  // 4000:1842 / 184b set CS:17D4
    const m = await HorizontalMenu('Party Order: ', dsPstr(0x04A4 + (place ? 0x29 : 0), place ? 'Place Exit' : 'Select Exit'), 13, 10, 15, true, true);   // 4000:1889
    key = m.key;
    if (!m.ext) {                                                        // 4000:1891
      if (key === '\r' || key === 'P' || key === 'S') {                  // 4000:18d9 set CS:1802
        place = !place;                                                  // 4000:18e9
        if (place) await X.ShowCharacterMessage(sel(), 'has been selected', 10, 0);   // 4000:191b
        else await X.ClearCharacterMessage();                            // 4000:1922
      }
    } else if (!place) { await X.CycleSelectedChar(key); await X.PartySummary(sel()); }   // 4000:1897 .. 18ae
    else {
      if (key === 'G') MoveSelectedDown(); else if (key === 'O') MoveSelectedUp();   // 4000:18b5 .. 18c7
      await X.PartySummary(sel());                                       // 4000:18d2
    }
  }
}

// 4000:199C DropCharacter
export async function DropCharacter() {
  if (!sel().next && sel() === G.PartyList) {                            // 4000:19a2 .. 19be
    if (await AskYesNo('quit TO DOS: ', 14, 10, 15) === 'Y') { await X.RemovePartyMember(0, 1); await TerminateGame(); }   // 4000:19d3 .. 19f0
  } else {
    await X.ShowCharacterMessage(sel(), 'will be gone', 10, 0);          // 4000:1a14
    if (await AskYesNo('Drop from party? ', 14, 10, 15) === 'Y') {       // 4000:1a2e / 1a40
      if (sel().b[0x196] === 0) await X.ShowCharacterMessage(sel(), 'is dumped in a ditch', 10, 1);   // 4000:1a43 / 1a8a
      else await X.ShowCharacterMessage(sel(), 'bids you farewell', 10, 1);   // 4000:1a66
      await X.RemovePartyMember(0, 1);                                   // 4000:1a95
      ClearRectangle(0x11, 1, 0x26, 0x0B); await X.PartySummary(sel());  // 4000:1aa0 / 1ab1
    } else await X.ShowCharacterMessage(sel(), 'Breathes A sigh of relief', 10, 1);   // 4000:1ad7
  }
}

// 4000:1B4D GameSpeedMenu
export async function GameSpeedMenu() {
  let key;
  do {
    DrawText(1, 0x12, 10, 0, 'Game Speed = ' + (await X.ByteToStr(G.GameSpeed)) + ' (0=fastest 9=slowest)');   // 4000:1b8e
    let opts = '';                                                       // 4000:1b93
    if (G.GameSpeed !== 0) opts += ' Faster';                            // 4000:1b97
    if (G.GameSpeed < 9) opts += ' Slower';                              // 4000:1bc6
    opts += ' Exit';                                                     // 4000:1bf5
    const m = await HorizontalMenu('Game Speed:', opts, 13, 10, 15, true, true);   // 4000:1c45
    key = m.key;
    if (!m.ext) {                                                        // 4000:1c4d
      if (key === 'F') G.GameSpeed = (G.GameSpeed - 1) & 0xFF;           // 4000:1c7f
      else if (key === 'S') G.GameSpeed = (G.GameSpeed + 1) & 0xFF;      // 4000:1c89
    } else if (key === 'P') { if (G.GameSpeed !== 0) G.GameSpeed--; }    // 4000:1c53 .. 1c61 down arrow
    else if (key === 'H') { if (G.GameSpeed < 9) G.GameSpeed++; }        // 4000:1c67 .. 1c72 up arrow
  } while (key !== '\0' && key !== 'E');                                 // 4000:1c8d set CS:1B2D
  await X.ClearCharacterMessage();                                       // 4000:1ca0
}

// 4000:1D0A AlterMenu
export async function AlterMenu() {
  let key = ' ';                                                         // 4000:1d11
  while (key !== '\0' && key !== 'E') {                                  // 4000:1d15 set CS:1CA9
    const m = await HorizontalMenu('Alter: ', dsPstr(0x047A, 'Order Drop Speed Icon Pics Exit'), 13, 10, 15, true, true);   // 4000:1d50
    key = m.key;
    if (m.ext) { await X.CycleSelectedChar(key); await X.PartySummary(sel()); }   // 4000:1d58 .. 1d6f
    else switch (key) {
      case 'O': await PartyOrder(); break;                               // 4000:1d7f
      case 'D': await DropCharacter(); break;                            // 4000:1d8a
      case 'S': await GameSpeedMenu(); break;                            // 4000:1d95
      case 'I': await X.IconEditor(); await X.RedrawCurrentMode(); break;   // 4000:1d9f / 1da4
      case 'P': {                                                        // 4000:1dac
        let k;
        do {
          let opts;
          if (G.opt_Pics === 0) opts = 'Pics off  ';                     // 4000:1db3 / 1e28
          else opts = 'Pics on  ' + (G.opt_Animation === 0 ? 'Animation off  ' : 'Animation on  ');   // 4000:1dba .. 1e1d
          opts += 'Exit';                                                // 4000:1e3b
          k = (await HorizontalMenu('', opts, 13, 10, 15, false, true)).key;   // 4000:1e8b
          if (k === 'P') G.opt_Pics = G.opt_Pics === 0 ? 1 : 0;          // 4000:1e93 .. 1ea7
          else if (k === 'A') G.opt_Animation = G.opt_Animation === 0 ? 1 : 0;   // 4000:1eac .. 1ebd
        } while (k !== '\0' && k !== 'E');                               // 4000:1ec0
        break;
      }
    }
  }
}

// Fix (4000:2309) and its nested routines; `F` = the parent frame: total [BP-2], n1 [BP-4], n4 [BP-6], n5 [BP-8]
// 4000:1EDA IsOkay(c)
function IsOkay(c) { return c.b[0x195] === 0; }                          // 4000:1ee0 / 1ee9

// 4000:1EFD RollMemorizedCures: memorised cures are rolled, not used up
async function RollMemorizedCures(F) {
  let sum = 0;                                                           // 4000:1f03
  for (let c = G.PartyList; c; c = c.next) {                             // 4000:1f08 / 1f14
    if (!IsOkay(c)) continue;                                            // 4000:1f1f / 1f2e
    for (let i = 0; i <= 0x53; i++) {                                    // 4000:1f30
      switch (c.b[0x1E + i]) {                                           // 4000:1f39 .. 1f7b
        case 3: sum += await X.Roll(1, 8); break;                        // 4000:1f4e
        case 0x3A: sum += (await X.Roll(2, 8)) + 1; break;               // 4000:1f65
        case 0x47: sum += (await X.Roll(3, 8)) + 3; break;               // 4000:1f7d
      }
    }
  }
  F.total = (F.total + sum) & 0xFFFF;                                    // 4000:1fa9
}

// 4000:1FB9 RollRestCures
async function RollRestCures(F) {
  let sum = 0;
  for (let k = 1; k <= (F.n1 & 0xFF); k++) sum += await X.Roll(1, 8);           // 4000:1fbf ..
  for (let k = 1; k <= (F.n4 & 0xFF); k++) sum += (await X.Roll(2, 8)) + 1;
  for (let k = 1; k <= (F.n5 & 0xFF); k++) sum += (await X.Roll(3, 8)) + 3;     // .. 4000:2061
  F.total = (F.total + sum) & 0xFFFF;
}

// 4000:206B MissingHp: sum of maxhp - hp
function MissingHp() {
  let m = 0;
  for (let c = G.PartyList; c; c = c.next) m += c.b[0x78] - c.b[0x1A4];  // 4000:2071 .. 20b4
  return m & 0xFFFF;
}

// 4000:20C5 RestForCures
function RestForCures(F) {
  let t1 = 0, t4 = 0, t5 = 0, maxT = 0;                                  // 4000:20d7 .. 20e3 (once, not per member)
  F.n1 = 0; F.n4 = 0; F.n5 = 0;                                          // 4000:20eb .. 20fd
  let expected = 0;                                                      // [BP-2] never initialised: TODO(decode) garbage, 0 here
  for (let c = G.PartyList; c; c = c.next) {                             // 4000:2106
    let fixed = 0;                                                       // 4000:2111
    if (IsOkay(c)) {                                                     // 4000:2120
      F.n1 += c.b[0x12D]; t1 = c.b[0x12D] * 15;                          // 4000:2134 / 2147
      F.n4 += c.b[0x130]; t4 = c.b[0x130] * 60;                          // 4000:2157 / 216a
      F.n5 += c.b[0x131]; t5 = c.b[0x131] * 75;                          // 4000:217a / 218d
    }
    if (t1 !== 0) { fixed = 0xF0; expected += 0x1B; }                    // 4000:2190 .. 219b
    if (t4 + t5 !== 0) { fixed = 0x168; expected += t5 !== 0 ? 0x4E : 0x22; }   // 4000:219f .. 21ba
    const t = (fixed + t1 + t4 + t5) & 0xFFFF;                           // 4000:21be .. 21c7
    if (maxT < t) maxT = t;                                              // 4000:21ca / 21d5
  }
  expected &= 0xFFFF;
  const missing = MissingHp();                                           // 4000:21ef
  if (missing < expected) {                                              // 4000:21f2
    const q = Math.floor(expected / missing) & 0xFF;                     // 4000:21fb .. 2207 Lo(expected div missing)
    if (q !== 0) maxT = Math.floor(maxT / q);                            // 4000:2216 (q = 0: TP runtime error 200, TODO(decode))
  }
  setRestTime(maxT);                                                     // 4000:221b .. 224c
}

// 4000:2255 DistributeHealing
async function DistributeHealing(F) {
  for (let c = G.PartyList; c; c = c.next) {                             // 4000:225b / 2267
    if (c.b[0x78] <= c.b[0x1A4]) continue;                               // 4000:227c
    let n = c.b[0x78] - c.b[0x1A4];                                      // 4000:2298
    if (n > F.total) n = F.total;                                        // 4000:22a3 / 22b0
    if (n < 1) n = 0;                                                    // 4000:22b3
    if (n === 0) continue;                                               // 4000:22be
    if (await X.HealCharacter(c, n & 0xFF, 0) && n <= F.total) F.total -= n;   // 4000:22d1 .. 22ec
  }
}

// 4000:2309 Fix(var interrupted): automatic healing (new)
export async function Fix(interrupted) {
  interrupted.v = false;                                                 // 4000:230f
  const F = { total: 0, n1: 0, n4: 0, n5: 0 };                           // 4000:2316
  if (MissingHp() === 0) return;                                         // 4000:231c / 2324
  await RollMemorizedCures(F);                                           // 4000:2328
  if (MissingHp() === 0) {                                               // 4000:232d (cannot be true: nothing healed yet, quirk)
    await X.PartySummary(sel()); await X.DrawLocationTimeStatus();       // 4000:233d / 2342
  } else {
    const saved = rc().slice();                                          // 4000:2349 14 bytes
    RestForCures(F);                                                     // 4000:235d
    interrupted.v = !!(await X.RestLoop(0));                             // 4000:2361
    if (!interrupted.v) {                                                // 4000:2369 / 2378
      await RollRestCures(F); await DistributeHealing(F);                // 4000:2379 / 237e
      await X.PartySummary(sel()); await X.DrawLocationTimeStatus();     // 4000:2382 / 238f
      G.RestClock = saved;                                               // 4000:2394
    }
  }
}

// 4000:23FC Camp(var done) — entry e1
export async function Camp(done) {
  const savedMode = G.view_Mode;                                         // 4000:2403
  G.view_Mode = 2; G.HealCounter = 0;                                    // 4000:2409 / 240e
  rc().fill(0);                                                          // 4000:2413 FillChar(RestClock, 0Eh, 0)
  G.camp_AnimName = String(G.anim_Name ?? '').slice(0, 8); G.camp_AnimId = G.anim_Id;   // 4000:2424 / 2437
  await X.RedrawCurrentMode();                                           // 4000:243d
  ClearRectangle(1, 0x11, 0x26, 0x16);                                   // 4000:2442
  DrawText(1, 0x12, 10, 0, 'The party makes camp...');                   // 4000:246e
  await CancelAllStudy();                                                // 4000:2473
  done.v = false; let key = ' ';                                         // 4000:2477 / 247e
  while (!done.v && key !== '\0' && key !== 'E') {                       // 4000:2482 .. 2497 set CS:23C5
    const m = await HorizontalMenu('Camp:', dsPstr(0x0428, 'Save View Magic Rest Alter Fix Exit'), 13, 10, 15, true, true);   // 4000:24c9
    key = m.key;
    if (m.ext) { await X.CycleSelectedChar(key); await X.PartySummary(sel()); }   // 4000:24d1 .. 24e8
    else switch (key) {
      case 'S':                                                          // 4000:24f0
        await X.SaveGame();                                              // 4000:24f7
        if (await AskYesNo('Quit TO DOS ', 14, 10, 15) === 'Y') await TerminateGame();   // 4000:2514 / 251d
        break;
      case 'V': { G.menu_Sel = 1; const viewExt = { v: false }; await X.ViewMenu(viewExt); break; }   // 4000:2528 / 2532
      case 'M': G.menu_Sel = 1; await MagicMenu(done); break;            // 4000:253d / 2548
      case 'R': G.menu_Sel = 1; await Rest(done); break;                 // 4000:2551 / 255c
      case 'F': await Fix(done); break;                                  // 4000:256b new
      case 'A': G.menu_Sel = 1; await AlterMenu(); break;                // 4000:2574 / 257a
    }
  }
  if (String(G.camp_AnimName).slice(0, 3) === 'PIC') await LoadAnimation(G.camp_AnimName, G.camp_AnimId, 0, G.enc_Anim);   // 4000:2580 .. 25b5
  await CancelAllStudy();                                                // 4000:25bb
  G.sp_CampTarget = null; G.view_Mode = savedMode;                       // 4000:25be / 25c6
  await X.DrawLocationTimeStatus();                                      // 4000:25cc
  await X.ClearCharacterMessage();                                       // 4000:25d1
  ClearMenuLine();                                                       // 4000:25d6
}

// 4000:0000 ov15_LoadDeps / 4000:25E1 ov15_init: empty.
