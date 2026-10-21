// game/areas/party_ov24.js — PARTY ov24 (6200): character derived stats, item names, roster and summary, number strings,
// ability tables, messages, combat animation, damage, status line, party picker (= Pool's resident unit 00BA, moved into
// an overlay in Curse).
// Owner: cab-build-areas. Source: decode/pseudo/PARTY.pas.md ov24 (Character record / item record maps at its end); structure
// as Pool's areas/res_00ba_*.js (structure only). Re-read from decode/listings/ov24.lst:
//  - PartySummary (6200:0795): header 'Name' / 'AC  HP' fg 0Fh bg 0 at row 2, the selected member's name fg 0Fh, the
//    others through DrawCharacterName; AC and HP column offsets from unsigned byte ranges (as the pseudocode).
//  - AnimateAlongPath (6200:1af7..21da, written at step level in PARTY.pas.md) translated statement by statement from the
//    listing: the path of LineStep directions (TLine of view_ov31) at three steps per square; the picture is drawn when
//    delay > 0 or the pixel column or row is a multiple of 3; when the path leaves the 7x7 window the remaining tail is
//    traced backwards from the target to find where the window re-enters, the window is re-centred there and the forward
//    phase continues from that index (the outer loop runs while [BP-B3h] = 0). The centre of a jump uses IDIV (signed).
//  - DrawLocationTimeStatus: direction names DS:2540 + 3·dir (string[2]).
//  - DrawCharacterSummary: the status line row is text_Row + 1 (+1 more for the draw), StatusName DS:0FE0 + 13·status.
// Conventions: records c = { b: Uint8Array(1A6h), next, items, effects, combat, readied[0..12] } (readied[] = the far
// pointers +151h + 4k, rebuilt by RecalcItems), items { b: Uint8Array(3Fh), next }, effects { b: Uint8Array(9), next },
// combatant c.combat.b (+18Dh). ItemTypeTable = DS:5CF6 (16 bytes per type) in G.ds. Var parameters are { v }.

import { G, newItem, rdW, wrW, pstr, setPstr } from '../engine/state.js';
import { DrawText, ClearRectangle, DrawWrappedText, MessageDelay, ShowBottomPromptAndReadKey, DrawScreenFrame, FrameExplore,
  FrameCombat, text } from '../engine/text.js';
import { state as pic, AllocPicture, FreePicture, MirrorPicture, DrawPicture, FlushViewDirtyLines } from '../engine/pictures.js';
import { PlayOrStopSound } from '../engine/audio_cab.js';
import { Delay } from '../engine/timer.js';
import { view, sx8, i16 } from './view_ov30.js';
import { newLine, LineInit, LineStep, Sign, BuildTargetList } from './view_ov31.js';
import { InWindow, FocusSquare, IsVisible, CombatantIndex, CombatantCol, CombatantRow, CombatantSize, PaletteFlashOn } from './view_ov32.js';
import { tiles } from './view_ov33.js';
import { RefreshView } from './view_ov28.js';
import { DrawPictureScreenOrView, LoadPortrait, DrawPortrait, LoadAnimation } from './view_ov29.js';
import { HorizontalMenu } from './view_ov26.js';
import { dev } from '../engine/dev.js';
import { hooks } from '../plus/hooks.js';
import { X } from './view_link.js';

const ds = (a) => G.ds[a & 0xFFFF];
const dsW = (a) => G.ds[a & 0xFFFF] | (G.ds[(a + 1) & 0xFFFF] << 8);
const dsStr = (a) => { let s = ''; for (let i = 1; i <= ds(a); i++) s += String.fromCharCode(ds(a + i)); return s; };
const IT = (t, o) => ds(0x5CF6 + (t & 0xFF) * 16 + o);   // ItemTypeTable[t]: +0 slot, +1 hands, +6 ac_value, +9 dice, +0Ah sides, +0Bh dmg_bonus, +0Ch range, +0Eh wflags2
const rd = (c, k) => (c.readied ? c.readied[k] ?? null : null);   // c^.readied[k] (+151h + 4k)
const setRd = (c, k, it) => { if (!c.readied) c.readied = new Array(13).fill(null); c.readied[k] = it; };
const nameOf = (c) => pstr(c.b, 0);
const cr = (c) => (c.combat ? c.combat.b : (c.combat = { b: new Uint8Array(0x16) }).b);   // c^.combatant (+18Dh); TODO(decode): a never-allocated record is a nil/stale pointer in the original
const s40 = (s) => s.slice(0, 40);                       // string[40] assignment
// item fields: +0 name string[40], +2Eh type, +2Eh+k word[k], +32h plus, +33h plus2, +34h readied, +35h hidden,
// +36h magic flag, +37h weight (word), +39h count, +3Ah value (word), +3Bh+k power[k]
const itype = (it) => it.b[0x2E], iplus = (it) => sx8(it.b[0x32]);

// 6200:0000 ov24_0000: pre-load of other overlay units (nothing to do in the browser)
export function ov24_0000() {}

// 6200:0025 RecalcWeaponStats(c)
export function RecalcWeaponStats(c) {
  const w = rd(c, 0);                                                    // 6200:002b
  if (!w) return;                                                        // 6200:003b
  const t = itype(w);                                                    // 6200:0046
  c.b[0x199] = c.b[0x73];                                                // 6200:0050 thac0 := base_thac0
  if (IT(t, 0x0E) & 2) c.b[0x199] = (c.b[0x199] + DexMissileAdj(c)) & 0xFF;   // 6200:005f / 0074
  c.b[0x1A2] = IT(t, 0x0B);                                              // 6200:0095 dmg_bonus[1]
  if (IT(t, 0x0E) & 4) {                                                 // 6200:00ac
    c.b[0x199] = (c.b[0x199] + StrToHitAdj(c)) & 0xFF;                   // 6200:00c1
    c.b[0x1A2] = (c.b[0x1A2] + StrDamageAdj(c)) & 0xFF;                  // 6200:00e2
  }
  let plus = iplus(w);                                                   // 6200:0102
  if (IT(t, 0x0E) > 0x7F && rd(c, 12)) plus += iplus(rd(c, 12));         // 6200:010c / 012d quarrels
  if ((IT(t, 0x0E) & 1) && rd(c, 11)) plus += iplus(rd(c, 11));          // 6200:0145 / 0169 arrows
  c.b[0x1A2] = (c.b[0x1A2] + plus) & 0xFF;                               // 6200:0181
  const wt = itype(w);
  if (c.b[0x74] === 2 && ((wt > 0x28 && wt < 0x2D) || wt === 0x25 || wt === 0x24)) plus++;   // 6200:019a / 01cc elf
  c.b[0x199] = (c.b[0x199] + plus) & 0xFF;                               // 6200:01cf quirk: the elf bonus goes to THAC0 only
  c.b[0x19E] = IT(t, 9); c.b[0x1A0] = IT(t, 0x0A);                      // 6200:01e9 / 0200
}

// 6200:021D ArmourMoveLimit(c, item)
export function ArmourMoveLimit(c, item) {
  if (IT(itype(item), 0) !== 2) return;                                  // 6200:0220
  const w = rdW(item.b, 0x37);                                           // 6200:0236
  if (w <= 150) c.b[0x1A5] = c.b[0xE4];                                  // 6200:023d
  else if (w >= 151 && w <= 399) c.b[0x1A5] = 9;                         // 6200:0259
  else c.b[0x1A5] = 6;                                                   // 6200:026e
  if (item.b[0x32] !== 0 && c.b[0x1A5] <= 9) c.b[0x1A5] += 3;            // 6200:0277 / 028c
}

// 6200:02A7 AddItemAC(c, item, var part[0..4], var magicArmour)
export function AddItemAC(c, item, part, magicArmour) {
  let acv = IT(itype(item), 6);                                          // 6200:02ad
  if (acv <= 0x7F) return;                                               // 6200:02c3
  acv &= 0x7F; const slot = IT(itype(item), 0);                          // 6200:02cc / 02d4
  const plus = iplus(item);
  if (slot === 1) part[1] = sx8(acv + plus);                             // 6200:02ea / 02f0 shield
  else if (acv === 0) {                                                  // 6200:030b protection item
    if (slot === 9) { if (plus > part[3]) part[3] = plus; }              // 6200:0311 / 0317 best ring
    else part[2] = sx8(part[2] + plus);                                  // 6200:0337
    c.b[0x186] = (c.b[0x186] + item.b[0x33]) & 0xFF;                     // 6200:0352
  } else if (acv + plus > part[4]) {                                     // 6200:0371 armour
    part[4] = sx8(acv + plus);                                           // 6200:0390
    if (plus > 0 && slot === 2) magicArmour.v = true;                    // 6200:03a8
  }
}

// 6200:03C5 EncumbranceMoveLimit(c)
export function EncumbranceMoveLimit(c) {
  let e = rdW(c.b, 0x187) - StrWeightAllowance(c);                       // 6200:03cb
  if (e < 0) e = 0;                                                      // 6200:03eb
  let m;
  if (e >= 0 && e <= 512) m = c.b[0x1A5];                                // 6200:03f9
  else if (e >= 513 && e <= 768) m = 9;                                  // 6200:0410
  else if (e >= 769 && e <= 1024) m = 6;                                 // 6200:0420
  else m = 3;                                                            // 6200:0430
  if (m < c.b[0x1A5]) c.b[0x1A5] = m;                                    // 6200:0434
}

// 6200:0467 BuildItemName(c, item, col, row, withReady, draw)
export function BuildItemName(c, item, col, row, withReady, draw) {
  let name = '';                                                         // 6200:046e
  if (withReady) name = item.b[0x34] !== 0 ? ' Yes  ' : ' No   ';       // 6200:047b / 049a
  let detect = false;
  for (let p = G.PartyList; p && !detect; p = p.next)                    // 6200:04b1 / 04bd
    if (HasEffect(p, 5, { v: null })) detect = true;                     // 6200:04cb Detect Magic
  if (detect && (sx8(item.b[0x32]) > 0 || sx8(item.b[0x33]) > 0 || item.b[0x36] !== 0)) name = s40(name + '*' + ' ');   // 6200:04f7 / 051b
  if (item.b[0x39] > 0) name = s40(name + ByteToStr(item.b[0x39]) + ' ');   // 6200:054d / 0557
  let shown = 0;                                                         // 6200:0596
  for (let k = 1; k <= 3; k++)                                           // 6200:059a
    if (item.b[0x2E + k] !== 0 && ((item.b[0x35] >> (3 - k)) & 1) === 0) shown += 1 << (k - 1);   // 6200:05a3 / 05d6
  let plural = false;                                                    // 6200:05ee
  const type = itype(item), count = item.b[0x39];
  for (let k = 3; k >= 1; k--)                                           // 6200:05f2
    if ((shown >> (k - 1)) & 1) {                                        // 6200:05fb
      name = s40(name + dsStr(0x1040 + 21 * item.b[0x2E + k]));          // 6200:0616 ItemWord
      if (count < 2 || plural) name = s40(name + ' ');                   // 6200:0656 / 0666
      else if ((1 << (k - 1)) === shown || (k === 1 && shown > 4 && type !== 0x56) || (k === 2 && (shown & 1) === 0) ||
               (k === 3 && type === 0x56) ||
               (item.b[0x31] !== 0x87 && (type === 0x49 || type === 0x1C) && item.b[0x31] !== 0xB1)) {   // 6200:0691 .. 06fc
        name = s40(name + 's '); plural = true;                          // 6200:0706 / 072e
      } else name = s40(name + ' ');                                     // 6200:0734
    }
  setPstr(item.b, 0, name, 40);
  if (draw) DrawText(col, row, 0x0A, 0, name);                           // 6200:0765
}

// 6200:0795 PartySummary(sel)
export function PartySummary(sel) {
  if (G.view_Mode === 3) return;                                         // 6200:079b
  const x0 = G.view_Mode === 0 ? 1 : 0x11;                               // 6200:07a5
  let y = 2;                                                             // 6200:07b6
  DrawText(x0, y, 0x0F, 0, 'Name');                                      // 6200:07d7
  DrawText(0x21, y, 0x0F, 0, 'AC  HP');                                  // 6200:07f8
  y += 2;                                                                // 6200:07fd
  for (let p = G.PartyList; p; p = p.next) {                             // 6200:0801 / 080d
    ClearRectangle(x0, y, 0x26, y);                                      // 6200:0827
    if (p === sel) DrawText(x0, y, 0x0F, 0, nameOf(p));                  // 6200:082c / 084e
    else DrawCharacterName(p, x0, y, false);                             // 6200:0867
    const ac = p.b[0x19A];
    const dxA = ac <= 0x32 ? 1 : ac <= 0x3C ? 2 : ac <= 0x45 ? 1 : 0;    // 6200:086a .. 08a4
    DrawAC(p, 0x20 + dxA, y);                                            // 6200:08bc
    const hp = p.b[0x1A4];
    const dxH = hp <= 9 ? 2 : hp <= 99 ? 1 : 0;                          // 6200:08bf .. 08e9
    DrawHP(p, 0x24 + dxH, y, false);                                     // 6200:0904
    y++;                                                                 // 6200:0907
  }
  ClearRectangle(x0, y, 0x26, y);                                        // 6200:092c
  hooks.emit('partyDrawn', () => ({ region: 'roster', col: x0, firstRow: 4, members: hooks.state.party(), selected: sel ? hooks.state.party().findIndex((m) => m.selected) : -1, rect: { x1: x0 * 8, y1: 32, x2: 0x27 * 8 + 7, y2: y * 8 - 1 } }));   // Plus (plus request #1)
}

// 6200:0939 DrawAC(c, col, row)
export function DrawAC(c, col, row) {
  let s = ByteToStr(Math.abs(c.b[0x19A] - 60));                          // 6200:0939
  if (c.b[0x19A] > 60) s = '-' + s;                                      // 6200:096d
  DrawText(col, row, 0x0A, 0, s);                                        // 6200:09a2
}

// 6200:09C1 DrawHP(c, col, row, highlight)
export function DrawHP(c, col, row, highlight) {
  let colour = c.b[0x1A4] < c.b[0x78] ? 0x0E : 0x0A;                     // 6200:09c8
  if (highlight) colour = 0x0D;                                          // 6200:09e3
  DrawText(col, row, colour, 0, ByteToStr(c.b[0x1A4]));                  // 6200:09ed
}

// 6200:0A34 DrawCharacterSummary(c) — one redraw per combat_Shown request
export async function DrawCharacterSummary(c) {
  if (!G.combat_Shown) return;                                           // 6200:0a3a
  G.combat_Shown = 0;                                                    // 6200:0a44
  ClearRectangle(0x17, 1, 0x26, 0x15);                                   // 6200:0a49
  let y = 1;                                                             // 6200:0a5a
  await ShowCharacterMessage(c, ' ', y, false);                          // 6200:0a5e the name line
  y++;                                                                   // 6200:0a7e
  DrawText(0x17, y + 1, 0x0A, 0, 'Hitpoints'); DrawHP(c, 0x21, y + 1, false);   // 6200:0a81 / 0aa5
  y += 2;                                                                // 6200:0abc
  DrawText(0x17, y + 1, 0x0A, 0, 'AC'); DrawAC(c, 0x1A, y + 1);          // 6200:0ac0 / 0ae4
  text.row = (y + 1) & 0xFF;                                             // 6200:0af8 text_Row
  if (rd(c, 0)) {                                                        // 6200:0b01
    y += 2;                                                              // 6200:0b10
    BuildItemName(c, rd(c, 0), 0, 0, false, false);                      // 6200:0b18
    await DrawWrappedText(0x17, y + 1, 0x26, y + 3, 0x0A, 0, 1, pstr(rd(c, 0).b, 0));   // 6200:0b3b
  }
  y = (text.row + 1) & 0xFF;                                             // 6200:0b6a
  if (c.b[0x196] === 0) DrawText(0x17, y + 1, 0x0F, 0, dsStr(0x0FE0 + 13 * c.b[0x195]));   // 6200:0b73 / 0b7e StatusName
  else if (IsHelpless(c)) DrawText(0x17, y + 1, 0x0F, 0, '(Helpless)'); // 6200:0bab / 0bb9
}

// 6200:0BE3 IsHelpless(c): one of the four HelplessEffectIds (DS:27C9, k = 1..4)
export function IsHelpless(c) {
  let r = false;                                                         // 6200:0be9
  for (let k = 1; k <= 4; k++) if (HasEffect(c, ds(0x27C9 + k), { v: null })) r = true;   // 6200:0bed / 0bf6
  return r;                                                              // 6200:0c1f
}

// 6200:0C28 RecalcItems(c)
export async function RecalcItems(c) {
  for (let k = 0; k <= 12; k++) setRd(c, k, null);                       // 6200:0c2e
  const holding = false; c.b[0x14C] = 0;                                 // 6200:0c56 / 0c5a
  c.b[0x185] = 0; wrW(c.b, 0x187, 0); G.ReadiedWeight = 0;               // 6200:0c73 / 0c7c / 0c86
  for (let it = c.items; it; it = it.next) {                             // 6200:0c63 / 0c8b
    c.b[0x14C] = (c.b[0x14C] + 1) & 0xFF;                                // 6200:0c96
    let w = rdW(it.b, 0x37); if (it.b[0x39] > 0) w = (it.b[0x39] * w) & 0xFFFF;   // 6200:0c9e / 0ca8
    wrW(c.b, 0x187, rdW(c.b, 0x187) + w);                                // 6200:0cc1
    if (it.b[0x34] !== 0) {                                              // 6200:0ccc
      G.ReadiedWeight = (G.ReadiedWeight + w) & 0xFFFF;                  // 6200:0cd9
      const s = IT(itype(it), 0);                                        // 6200:0ce0
      if (s <= 8) setRd(c, s, it);                                       // 6200:0cf6
      else if (s === 9) {                                                // 6200:0d23 rings
        if (rd(c, 9)) { if (!rd(c, 10)) setRd(c, 10, it); }              // 6200:0d28 / 0d37
        else setRd(c, 9, it);                                            // 6200:0d5a
      }
      if (itype(it) === 0x49) setRd(c, 11, it);                          // 6200:0d6c arrows
      if (itype(it) === 0x1C) setRd(c, 12, it);                          // 6200:0d88 quarrels
      c.b[0x185] = (c.b[0x185] + IT(itype(it), 1)) & 0xFF;               // 6200:0da4 hands
    }
  }
  for (let k = 0; k <= 6; k++) wrW(c.b, 0x187, rdW(c.b, 0x187) + rdW(c.b, 0xFB + 2 * k));   // 6200:0de1 money
  for (let k = 1; k <= 2; k++) {                                         // 6200:0e10
    c.b[0x19D + k] = c.b[0x11D + k];                                     // 6200:0e19 dmg_dice
    c.b[0x19F + k] = c.b[0x11F + k];                                     // 6200:0e37 dmg_sides
    c.b[0x1A1 + k] = c.b[0x121 + k];                                     // 6200:0e55 dmg_bonus
  }
  const f = [0, 0, 0, 0, 0];                                             // 6200:0e79
  const magicArmour = { v: false }; c.b[0x186] = 0;                      // 6200:0e92 / 0e96
  c.b[0x19A] = c.b[0x124]; c.b[0x1A5] = c.b[0xE4]; c.b[0x199] = c.b[0x73];   // 6200:0e9f / 0eaf / 0ebf
  f[0] = DexDefenseAdj(c);                                               // 6200:0ece
  if (!rd(c, 0)) {                                                       // 6200:0edb
    c.b[0x199] = (c.b[0x199] + StrToHitAdj(c)) & 0xFF;                   // 6200:0eea
    c.b[0x1A2] = (c.b[0x1A2] + StrDamageAdj(c)) & 0xFF;                  // 6200:0f0b
  }
  RecalcWeaponStats(c);                                                  // 6200:0f2b
  for (let it = c.items; it; it = it.next)                               // 6200:0f35 / 0f45
    if (it.b[0x34] !== 0) { ArmourMoveLimit(c, it); AddItemAC(c, it, f, magicArmour); }   // 6200:0f57 / 0f67
  if (magicArmour.v) f[3] = 0;                                           // 6200:0f92
  if (holding) {                                                         // 6200:0f9c dead code: holding stays false
    const e = rdW(c.b, 0x187);
    wrW(c.b, 0x187, e < 5000 ? 0 : e - 5000);
    if (rdW(c.b, 0x187) < G.ReadiedWeight) wrW(c.b, 0x187, G.ReadiedWeight);
  }
  EncumbranceMoveLimit(c);                                               // 6200:0fdd
  if (f[4] < sx8(c.b[0x19A])) f[4] = sx8(c.b[0x19A]);                    // 6200:0fe7 signed compare
  let ac = 0; for (let k = 0; k <= 4; k++) ac += f[k];                   // 6200:1006 / 100f
  c.b[0x19A] = ac & 0xFF;
  c.b[0x19B] = (f[4] + f[2] + f[3] - 2) & 0xFF;                          // 6200:103e ac_rear
  // quirk (as Pool): ac_item_bonus is recomputed but not added to ac
  const dca = (await X.DualClassActive(c)) ? 1 : 0;                      // 6200:1068 / 1082
  if ((c.b[0x109 + 2] > 0 || (c.b[0x111 + 2] > 0 && dca)) && c.b[0x74] > 0)   // 6200:105d .. 1082
    c.b[0xDD] = (c.b[0x109 + 2] + c.b[0x111 + 2] * dca) & 0xFF;          // 6200:108c fighter_lvl_eff
  else c.b[0xDD] = 1;                                                    // 6200:10bc
}

// 6200:10CB ByteToStr / 6200:1107 WordToStr / 6200:1141 LongToStr: Str(LongInt(v), result)
export const ByteToStr = (v) => String(v & 0xFF);
export const WordToStr = (v) => String(v & 0xFFFF);
export const LongToStr = (v) => String(v | 0);

// 6200:117A DexDefenseAdj(c) (current DEX +17h)
export function DexDefenseAdj(c) {
  const d = c.b[0x17];                                                   // 6200:1180
  if (d >= 1 && d <= 3) return -4;
  if (d >= 4 && d <= 6) return d - 7;
  if (d >= 15 && d <= 18) return d - 14;
  if (d >= 19 && d <= 20) return 4;
  if (d >= 21 && d <= 23) return 5;
  if (d >= 24 && d <= 25) return 6;
  return 0;
}

// 6200:120A DexMissileAdj(c)
export function DexMissileAdj(c) {
  const d = c.b[0x17];                                                   // 6200:1210
  if (d <= 2) return -4;                                                 // 6200:121f
  if (d >= 3 && d <= 5) return d - 6;                                    // 6200:122f
  if (d >= 16 && d <= 18) return d - 15;                                 // 6200:1246
  if (d >= 19 && d <= 20) return 3;                                      // 6200:125d
  if (d >= 21 && d <= 23) return 4;                                      // 6200:126d
  if (d >= 24 && d <= 25) return 5;                                      // 6200:127d
  return 0;                                                              // 6200:128d
}

// 6200:129A StrengthIndex(c) (current STR +11h, exceptional +1Ch)
export function StrengthIndex(c) {
  const s = c.b[0x11], e = c.b[0x1C];
  if (s <= 17) return s;                                                 // 6200:12a3
  if (s === 18) {                                                        // 6200:12b6 / 12c7
    if (e === 0) return 18; if (e <= 50) return 19; if (e <= 75) return 20; if (e <= 90) return 21; if (e <= 99) return 22;
    if (e === 100) return 23;
    return 0;                                                            // TODO(decode): str_exc > 100 leaves r uninitialised
  }
  if (s >= 19 && s <= 25) return s + 5;                                  // 6200:1330
  return 0;                                                              // TODO(decode): STR > 25 leaves r uninitialised
}

// 6200:1345 StrToHitAdj(c)
export function StrToHitAdj(c) {
  let r = 0; const i = StrengthIndex(c);                                 // 6200:134b / 134f
  if (c.b[0x125] !== 0) {                                                // 6200:135c STR-bonus flag
    if (i >= 1 && i <= 3) r = -3; else if (i >= 4 && i <= 5) r = -2; else if (i >= 6 && i <= 7) r = -1;   // 6200:136a ..
    else if (i >= 17 && i <= 19) r = 1; else if (i >= 20 && i <= 22) r = 2; else if (i >= 23 && i <= 25) r = 3;
    else if (i >= 26 && i <= 27) r = 4; else if (i >= 28 && i <= 30) r = i - 23;   // 6200:13cf / 13df
  }
  return r;
}

// 6200:13FD StrDamageAdj(c)
export function StrDamageAdj(c) {
  let r = 0; const i = StrengthIndex(c);                                 // 6200:1403 / 1407
  if (c.b[0x125] !== 0) {                                                // 6200:1414
    if (i >= 1 && i <= 2) r = -2; else if (i >= 3 && i <= 5) r = -1; else if (i === 16) r = 1;
    else if (i >= 17 && i <= 19) r = i - 16; else if (i >= 20 && i <= 29) r = i - 17; else if (i === 30) r = 14;
  }
  return r;
}

// 6200:148F StrWeightAllowance(c)
export function StrWeightAllowance(c) {
  const i = StrengthIndex(c);                                            // 6200:1495
  if (i >= 1 && i <= 3) return -350; if (i >= 4 && i <= 5) return -250; if (i >= 6 && i <= 7) return -150;
  if (i >= 12 && i <= 13) return 100; if (i >= 14 && i <= 15) return 200; if (i === 16) return 350;
  if (i >= 17 && i <= 21) return (i - 17) * 250 + 500;
  if (i >= 22 && i <= 26) return (i - 22) * 1000 + 2000;
  if (i === 27) return 7500;
  if (i >= 28 && i <= 30) return (i - 28) * 3000 + 9000;
  return 0;
}

// 6200:1583 ForgetMemorizedSpell(c, id): clears the first of the 84 slots (+1Eh) holding id
export function ForgetMemorizedSpell(c, id) {
  let k = 0;                                                             // 6200:1589
  while (k <= 0x53) {                                                    // 6200:158d
    if (c.b[0x1E + k] === id) { c.b[0x1E + k] = 0; k = 0x54; }           // 6200:1593 / 15ab / 15b5
    k++;                                                                 // 6200:15b9
  }
}

// 6200:15FF LoseItem(c, item)
export async function LoseItem(c, item) {
  if (!item) { await ShowBottomPromptAndReadKey(0x0E, 0, 'Nil Item pointer...'); return; }   // 6200:1605 / 160d
  let p = c.items;                                                       // 6200:162a
  if (p === item) c.items = item.next;                                   // 6200:163a / 1649
  else {
    while (p && p.next !== item) p = p.next;                             // 6200:1661
    if (!p) { await ShowBottomPromptAndReadKey(0x0E, 0, 'Tried to Lose item & couldn\'t find it!'); return; }   // 6200:168d / 1695
    p.next = item.next;                                                  // 6200:16b1
  }
  item.next = null;                                                      // 6200:16c5 (FreeMem 6200:16d2)
}

// 6200:16E6 AppendItemCopy(c, item)
export function AppendItemCopy(c, item) {
  const n = newItem(); n.b.set(item.b.subarray(0, 0x3F)); n.next = null; // 6200:16e6 / 16fa / 170d
  let p = c.items;                                                       // 6200:171a
  if (!p) c.items = n;                                                   // 6200:172a
  else { while (p.next) p = p.next; p.next = n; }                        // 6200:1746 / 1764
}

// 6200:177A ShowTimedBottomMessage(s)
export async function ShowTimedBottomMessage(s) {
  s = s40(s);
  ClearRectangle(0, 0x18, 0x27, 0x18);                                   // 6200:1793
  DrawText(0, 0x18, 0x0A, 0, s);                                         // 6200:17a4
  await MessageDelay();                                                  // 6200:17ba
  ClearRectangle(0, 0x18, 0x27, 0x18);                                   // 6200:17bf
}

// 6200:17D6 ShowCharacterMessage(c, s, combatRow, wait)
export async function ShowCharacterMessage(c, s, combatRow, wait) {
  const t = s;                                                           // 6200:17d6
  if (G.view_Mode === 5) {                                               // 6200:17f1
    ClearRectangle(0x17, combatRow, 0x26, 0x15);                         // 6200:17f8
    DrawCharacterName(c, 0x17, combatRow, false);                        // 6200:180a
    await DrawWrappedText(0x17, combatRow + 1, 0x26, 0x15, 0x0A, 0, 1, t);   // 6200:181e
  } else {
    const row = G.RestActive !== 0 && G.RestActive !== undefined ? 0x12 : 0x11;   // 6200:1844 / 184b / 1852
    ClearRectangle(1, row, 0x26, 0x16);                                  // 6200:1857
    DrawCharacterName(c, 1, row + 1, false);                             // 6200:186a
    await DrawWrappedText(1, row + 2, 0x26, 0x16, 0x0A, 0, 1, t);        // 6200:1882
  }
  if (wait) { await MessageDelay(); ClearCharacterMessage(); }           // 6200:18a9 / 18af / 18b4
}

// 6200:18BE ClearCharacterMessage
export function ClearCharacterMessage() {
  if (G.view_Mode === 5) ClearRectangle(0x17, 0x0A, 0x26, 0x15);         // 6200:18be
  else ClearRectangle(1, 0x12, 0x26, 0x16);                              // 6200:18db
}

// 6200:18F3 DrawCharacterName(c, col, row, possessive)
export function DrawCharacterName(c, col, row, possessive) {
  const colour = c.b[0x196] === 0 ? 0x0C : c.b[0x197] === 1 ? 0x0E : 0x0B;   // 6200:18f9 / 190a / 191b
  DrawText(col, row, colour, 0, nameOf(c));                              // 6200:191f
  if (possessive) DrawText(col + nameOf(c).length, row, colour, 0, '\'s');   // 6200:193e
}

// 6200:1975 CopyCombatAnimationFrame(icon, part, frame, mirror): icon_Pic[icon, part] -> frame of g_75E0
export function CopyCombatAnimationFrame(icon, part, frame, mirror) {
  const dst = G.g_75E0, src = (tiles.icons[icon] || [])[part];
  if (!dst || !src) return;
  const size = dst.height * dst.width8 * 8;                              // 6200:197b frameSize (pixels here)
  let from = src;
  if (mirror) { from = AllocPicture(0x18, 3, 1, 1); MirrorPicture(src, from); }   // 6200:198f / 19a7
  dst.px.set(from.px.subarray(0, size), frame * size);                   // 6200:19d2 / 1a28 pixels
  if (dst.mask && from.mask) dst.mask.set(from.mask.subarray(0, size), frame * size);   // 6200:19f7 / 1a66 second plane (full frame size)
  if (mirror) FreePicture(from);                                         // 6200:1a1c
}

// 6200:1AAA BuildFourAnimationFrames(icon)
export function BuildFourAnimationFrames(icon) {
  CopyCombatAnimationFrame(icon, 0, 0, false);                           // 6200:1aaa
  CopyCombatAnimationFrame(icon, 0, 1, true);                            // 6200:1abe
  CopyCombatAnimationFrame(icon, 1, 2, true);                            // 6200:1acf
  CopyCombatAnimationFrame(icon, 1, 3, false);                           // 6200:1ae0
}

// 6200:1AF7 AnimateAlongPath(x0, y0, x1, y1, frames, delay) — from the listing (see header)
export async function AnimateAlongPath(x0, y0, x1, y1, frames, delay) {
  x0 = i16(x0); y0 = i16(y0); x1 = i16(x1); y1 = i16(y1);
  const m = () => G.cm_Map.b, L2 = () => sx8(m()[2]), L3 = () => sx8(m()[3]);
  const DXT = (d) => sx8(ds(0x2694 + d)), DYT = (d) => sx8(ds(0x269D + d));
  const path = new Array(0x94).fill(8);                                  // 6200:1b19 FillChar(path, 94h, 8)
  const L = newLine();                                                   // 6200:1b2b FillChar(L, 18h, 0)
  let n = 0, frame = 0;                                                  // 6200:1b30 / 1b35
  L.x0 = x0 * 3; L.y0 = y0 * 3; L.x1 = x1 * 3; L.y1 = y1 * 3;            // 6200:1b3a .. 1b66
  LineInit(L);                                                           // 6200:1b70
  let more;
  do { more = LineStep(L); path[n & 0xFF] = L.dir; n = (n + 1) & 0xFF; } while (more);   // 6200:1b7b .. 1ba7
  const count = (n - 2) & 0xFF;                                          // 6200:1ba9
  if (count < 2 || n < 2) return;                                        // 6200:1bb6 / 1bbd
  const dX = x1 - x0, dY = y1 - y0;                                      // 6200:1bc7 / 1bd1
  let single, cx, cy;
  if (InWindow(x0 - L2(), y0 - L3()) && InWindow(x1 - L2(), y1 - L3())) { single = 1; cx = L2() + 3; cy = L3() + 3; }   // 6200:1bfd / 1c28 / 1c9f
  else if (Math.abs(dX) <= 6 && Math.abs(dY) <= 6) {                     // 6200:1c31 / 1c40
    single = 1; cx = Math.trunc(dX / 2) + x0; cy = Math.trunc(dY / 2) + y0;   // 6200:1c4f .. 1c72 (IDIV)
  } else { single = 0; cx = L2() + 3; cy = L3() + 3; }                   // 6200:1c78
  FocusSquare(cx & 0xFF, cy & 0xFF, 0xFF, 8);                            // 6200:1cd4
  let i = 0, ox = 0, oy = 0;                                             // 6200:1cd9 .. 1ce6
  const vp = pic.viewPic;
  for (;;) {
    // forward phase (6200:1cea)
    let px = (x0 - L2()) * 3 + ox, py = (y0 - L3()) * 3 + oy;            // 6200:1cea .. 1d20
    let stop = 0;                                                        // 6200:1d32
    do {
      const sx = DXT(path[i]), sy = DYT(path[i]);                        // 6200:1d37 .. 1d65
      px += sx; py += sy;                                                // 6200:1d69 / 1d71
      if (delay > 0 || px % 3 === 0 || py % 3 === 0) {                   // 6200:1d79 .. 1d9b
        DrawPicture(px, py, frame, 5, G.g_75E0, vp);                     // 6200:1dbd
        FlushViewDirtyLines();                                           // 6200:1dc2
        await Delay(delay);                                              // 6200:1dcd
        DrawPicture(px, py, 0, 0, pic.saveBuf, vp);                      // 6200:1df0
        frame = (frame + 1) & 0xFF; if (frame >= frames) frame = 0;      // 6200:1df5 .. 1e02
      }
      i = (i + 1) & 0xFF;                                                // 6200:1e07
      if (px < 0 || px > 0x12 || py < 0 || py > 0x12) stop = 1;          // 6200:1e0b .. 1e27
      if (stop === 0 && i < count) {                                     // 6200:1e2c / 1e33
        ox += sx; oy += sy;                                              // 6200:1e3d / 1e45
        if (Math.abs(ox) === 3) { x0 += Sign(ox); cx += Sign(ox); ox = 0; }   // 6200:1e57 .. 1e77
        if (Math.abs(oy) === 3) { y0 += Sign(oy); cy += Sign(oy); oy = 0; }   // 6200:1e85 .. 1ea5
      }
    } while (i < count && stop === 0);                                   // 6200:1ea9 .. 1eba
    if (i >= count) {                                                    // 6200:1ebd arrival (6200:20f5)
      single = 1;
      if (!InWindow(x1 - L2(), y1 - L3())) FocusSquare(x1 & 0xFF, y1 & 0xFF, 3, 8);   // 6200:211c / 2133
      px = (x1 - L2()) * 3; py = (y1 - L3()) * 3;                        // 6200:2138 .. 2166
      DrawPicture(px, py, frame, 5, G.g_75E0, vp);                       // 6200:218a
      if (delay > 0) {                                                   // 6200:218f
        FlushViewDirtyLines(); await Delay(delay);                       // 6200:2195 / 21a0
        DrawPicture(px, py, 0, 0, pic.saveBuf, vp);                      // 6200:21c3
      }
    } else {
      // the path left the window: find from the target backwards where it re-enters (6200:1eca .. 20ef)
      let tx = 0, ty = 0; oy = 0; ox = 0;                                // 6200:1eca .. 1ede
      x0 = x1; y0 = y1;                                                  // 6200:1ee2 / 1ee8
      if (x1 + 3 > 0x31) tx = x1 - 0x31; else if (x1 < 3) tx = 3 - x1;   // 6200:1efc .. 1f1f
      if (y1 + 3 > 0x18) ty = y1 - 0x18; else if (y1 < 3) ty = 3 - y1;   // 6200:1f23 .. 1f46
      cx = x1 + tx; cy = y1 + ty;                                        // 6200:1f4a / 1f55
      FocusSquare(cx & 0xFF, cy & 0xFF, 0xFF, 8);                        // 6200:1f70
      px = (x1 - L2()) * 3; py = (y1 - L3()) * 3;                        // 6200:1f75 .. 1fa3
      i = count; stop = 0;                                               // 6200:1fa7 / 1faf
      do {
        const sx = -DXT(path[i]), sy = -DYT(path[i]);                    // 6200:1fb4 .. 1fe6
        px += sx; py += sy;                                              // 6200:1fea / 1ff2
        if (px > 0x12) x0 = L2() + 6; else if (px < 0) x0 = L2();        // 6200:1ffa .. 2022
        if (py > 0x12) y0 = L3() + 6; else if (py < 0) y0 = L3();        // 6200:2025 .. 204d
        if (px < 0 || px > 0x12 || py < 0 || py > 0x12) stop = 1;        // 6200:2050 .. 206c
        if (stop === 0) {                                                // 6200:2071
          ox += sx; oy += sy;                                            // 6200:2078 / 2080
          if (Math.abs(ox) === 3) { x0 += Sign(ox); cx += Sign(ox); ox = 0; }   // 6200:2092 .. 20b2
          if (Math.abs(oy) === 3) { y0 += Sign(oy); cy += Sign(oy); oy = 0; }   // 6200:20c0 .. 20e0
          i = (i - 1) & 0xFF;                                            // 6200:20e4
        }
      } while (stop === 0);                                              // 6200:20e8
    }
    if (single !== 0) break;                                             // 6200:21c8
  }
  FlushViewDirtyLines();                                                 // 6200:21d2
}

// 6200:21DD ShowCombatMessageAnimation(c, spell, s)
export async function ShowCombatMessageAnimation(c, spell, s) {
  const t = s;                                                           // 6200:21dd
  if (G.view_Mode === 5) {                                               // 6200:21f8
    const icon = spell ? 0x16 : 0x17;                                    // 6200:2202 / 2208 / 220f
    BuildFourAnimationFrames(icon);                                      // 6200:2214
    if (!IsVisible(c, true)) FocusSquare(CombatantCol(c), CombatantRow(c), 3, 8);   // 6200:221d / 222f
    if (spell) await PlayOrStopSound(dsW(0x25B4));                       // 6200:2252 / 2258
    else await PlayOrStopSound(dsW(0x25B2));                             // 6200:2263
    await ShowCharacterMessage(c, t, 0x0A, false);                       // 6200:226c
    const reps = spell ? G.GameSpeed : 0;                                // 6200:2282 / 2288 / 2291
    const k = CombatantIndex(c);                                         // 6200:2296
    const px = sx8(G.cb_ScrCol[k]) * 3, py = sx8(G.cb_ScrRow[k]) * 3;    // 6200:22a1 / 22be
    for (let r = 0; r <= reps; r++)                                      // 6200:22d0
      for (let f = 0; f <= 3; f++) {                                     // 6200:22e9
        DrawPicture(px, py, f, 5, G.g_75E0, pic.viewPic);                // 6200:22f8
        FlushViewDirtyLines(); await Delay(70);                          // 6200:2321 / 2326
        DrawPicture(px, py, 0, 0, pic.saveBuf, pic.viewPic);             // 6200:232f
      }
    FlushViewDirtyLines();                                               // 6200:2367
    if (reps === 0) await MessageDelay();                                // 6200:236c / 2373
  } else await ShowCharacterMessage(c, t, 0x0A, true);                   // 6200:237a
}

// 6200:2396 HasEffect(c, id, var e)
export function HasEffect(c, id, e) {
  let found = false; let p = c.effects;                                  // 6200:239c / 23a0
  while (p && !found) { if (p.b[0] === id) found = true; else p = p.next; }   // 6200:23b4 .. 23da
  if (e) e.v = p;
  return found;                                                          // 6200:23f2
}

// 6200:2421 ApplyDamage(c, dmg)
export function ApplyDamage(c, dmg) {
  let over = 0, left = 0;                                                // 6200:2427
  const hp = c.b[0x1A4];
  if (hp >= dmg) left = hp - dmg; else over = dmg - hp;                  // 6200:242f / 2454
  if (over > 9 || (left === 0 && c.b[0x195] === 1)) c.b[0x195] = 6;      // 6200:246a / 2481 Dead
  else if (over > 0) {                                                   // 6200:248c
    c.b[0x195] = 5;                                                      // 6200:2492 Dying
    if (G.view_Mode === 5) cr(c)[0x0E] = over;                           // 6200:249b
  } else if (left === 0) c.b[0x195] = 4;                                 // 6200:24b9 Unconscious
  if (c.b[0x195] === 0 || c.b[0x195] === 1) c.b[0x1A4] = left;           // 6200:24c5 / 250e set CS:2401
  else {
    c.b[0x196] = 0; c.b[0x1A4] = 0;                                      // 6200:24d7 / 24e0
    if (G.view_Mode === 5) {                                             // 6200:24e9
      if (!Array.isArray(G.side_ActiveCount)) G.side_ActiveCount = [0, 0];
      G.side_ActiveCount[c.b[0x197]] = (G.side_ActiveCount[c.b[0x197]] - 1) & 0xFF;   // 6200:24f3
      cr(c)[3] = 0;                                                      // 6200:2502
    }
  }
}

// 6200:2543 ShowHealingResult(c)
export async function ShowHealingResult(c) {
  const s = c.b[0x1A4] === c.b[0x78] ? 'is fully healed' : 'is partially healed';   // 6200:2549 / 256f
  if (dev.target === 'S132') {                                           // dev only (?screen=S132): the line is timed, so the shot
    await ShowCharacterMessage(c, s, 0x0A, false);                       //   is signalled and the game held 1.5 s once it is drawn,
    dev.screenSoon('S132'); await new Promise((r) => setTimeout(r, 1500));   //   then the same wait and clear (not in the original)
    await MessageDelay(); ClearCharacterMessage();
  } else {
    await ShowCharacterMessage(c, s, 0x0A, true);                        // 6200:2582
  }
  if (G.view_Mode !== 5) PartySummary(G.SelectedChar);                   // 6200:2597 / 259e
}

// 6200:25B0 IsSideZero(c)
export function IsSideZero(c) { return c.b[0x197] === 0; }               // 6200:25b6

// 6200:25D4 CountActiveSides: side_ActiveCount[0..1] (DS:6F90/6F91)
export function CountActiveSides() {
  G.side_ActiveCount = [0, 0];                                           // 6200:25da
  for (let c = G.PartyList; c; c = c.next)                               // 6200:25f0
    if (c.b[0x196] !== 0) G.side_ActiveCount[c.b[0x197]] = (G.side_ActiveCount[c.b[0x197]] + 1) & 0xFF;   // 6200:25f8
}

// 6200:2628 CollectOppositeSideTargets(c, range): the targets of the other side into foe_List[1..n]
export function CollectOppositeSideTargets(c, range) {
  BuildTargetList(CombatantCol(c), CombatantRow(c), range, 0xFF, CombatantSize(c), G.cm_Map);   // 6200:2628 / 265a
  let n = G.tg_Count, kept = 0;                                          // 6200:2668
  if (n > 0) {                                                           // 6200:2672
    for (let i = 1; i <= n; i++)                                         // 6200:2681
      if (G.cb_Char[G.tg_List[i].who].b[0x197] === (IsSideZero(c) ? 1 : 0)) { kept++; G.tg_List[kept] = { ...G.tg_List[i] }; }   // 6200:2697 / 26c1
    n = kept; G.tg_Count = kept;                                         // 6200:26f9
  }
  if (!Array.isArray(G.foe_List)) G.foe_List = [];
  for (let i = 1; i <= n; i++) G.foe_List[i] = G.tg_List[i].who;         // 6200:2711
  return n;                                                              // 6200:2743
}

// 6200:274C TargetDistance(c, target)
export function TargetDistance(c, target) {
  const save = (G.tg_List || []).map((e) => (e ? { ...e } : e));         // 6200:274c Move(tg_List, save, D8h)
  G.cm_Map.b[6] = 1;                                                     // 6200:2767
  BuildTargetList(CombatantCol(c), CombatantRow(c), 0xFF, 0xFF, CombatantSize(c), G.cm_Map);   // 6200:2770 / 279a
  G.cm_Map.b[6] = 0; let i = 1;                                          // 6200:27a8 / 27b1
  while (G.tg_List[i] && G.cb_Char[G.tg_List[i].who] !== target && i < G.tg_Count) i++;   // 6200:27b6
  const d = G.tg_List[i] ? G.tg_List[i].dist >> 1 : 0;                   // 6200:27ef quirk: absent = the last entry's distance
  G.tg_List = save;                                                      // 6200:280b / 281a (tg_Count keeps the new value)
  return d;
}

// 6200:2828 ClearCombatantActionFlags(c) / 6200:2877 SetGuarding(c)
export function ClearCombatantActionFlags(c) {
  cr(c)[3] = 0; cr(c)[0] = 0; cr(c)[7] = 0; cr(c)[6] = 0;                // 6200:282e .. 2861
  return true;
}
export async function SetGuarding(c) {
  ClearCombatantActionFlags(c);                                          // 6200:2877
  cr(c)[7] = 1;                                                          // 6200:288a
  await ShowTimedBottomMessage('Guarding');                              // 6200:2897
}

// 6200:28B3 SpellCasterLevel(sp): casting level of SelectedChar for spell sp (spells_Table DS:37DA + 16·sp)
export async function SpellCasterLevel(sp) {
  const c = G.SelectedChar;
  const k = (await X.DualClassActive(c)) ? 1 : 0;                        // 6200:28b9
  const lv = (n) => c.b[0x109 + n], old = (n) => c.b[0x111 + n];
  const cls = ds(0x37DA + 16 * sp);
  let r;
  if (lv(0) === 0 && lv(5) === 0 && lv(3) < 9 && lv(4) < 8) r = 6;      // 6200:28b9 .. 28e9
  else switch (cls) {                                                    // 6200:28f0
    case 0: r = Math.max(lv(0) + old(0) * k, lv(3) + old(3) * k - 8); break;   // 6200:2903 .. 2976
    case 1: r = Math.max(lv(4) + old(4) * k - 7, 0); break;              // 6200:297d .. 29bf
    case 2: r = Math.max(lv(5) + old(5) * k, lv(4) + old(4) * k - 8); break;   // 6200:29c6 .. 2a39
    case 3: r = 12; break;                                               // 6200:2a3f
    default: r = 0;                                                      // TODO(decode): other classes leave r uninitialised
  }
  if (G.ItemCast && cls !== 3) r = 6;                                    // 6200:2a43 / 2a5c
  return r & 0xFF;                                                       // 6200:2a60
}

// 6200:2A6D RedrawCurrentMode
export async function RedrawCurrentMode() {
  G.view_Redraw = 1;                                                     // 6200:2a73
  switch (G.view_Mode) {                                                 // 6200:2a78
    case 0: DrawScreenFrame(); break;                                    // 6200:2a7f
    case 1:                                                              // 6200:2a87
      if (G.g_8B54) FrameExplore();                                      // 6200:2a8b / 2a92 FUN_01A0_0136
      if (G.anim_Id === 0x50) DrawPictureScreenOrView(3, 3, true, G.enc_Anim.pic[1]);   // 6200:2a97 / 2a9e g_7232
      else { await LoadPortrait(G.pic_HeadId, G.pic_BodyId); DrawPortrait(3, 3, true); }   // 6200:2ab8 / 2ac5
      PartySummary(G.SelectedChar); DrawLocationTimeStatus();            // 6200:2ad3 / 2ae0
      break;
    case 2:                                                              // 6200:2aea / 2aef camp picture
      FrameExplore(); await LoadAnimation('PIC', 0x1D, 0, G.enc_Anim);
      PartySummary(G.SelectedChar); DrawLocationTimeStatus();            // 6200:2b0e / 2b1b
      break;
    case 4:                                                              // 6200:2b24 .. 2b3e
      FrameExplore(); RefreshView(); PartySummary(G.SelectedChar); DrawLocationTimeStatus();
      G.g_8B6E = 0;
      break;
    case 3: if (G.anim_Id !== 0x50) RefreshView(); break;                // 6200:2b45 / 2b49 / 2b50
    case 6:                                                              // 6200:2b5b / 2b60 / 2b7f
      FrameExplore(); await LoadAnimation('PIC', 1, 0, G.enc_Anim); PartySummary(G.SelectedChar);
      break;
  }
}

// 6200:2BAA DrawLocationTimeStatus
export function DrawLocationTimeStatus() {
  if (G.view_Mode === 3) return;                                         // 6200:2bb1
  let s = ''; const x = G.party_MapX, y = G.party_MapY;                  // 6200:2bbb / 2bbf / 2bc5
  let hh = WordToStr(view.mem(0x4BC9)); if (hh.length < 2) hh = '0' + hh;   // 6200:2bcb / 2bec
  let mm = WordToStr(10 * view.mem(0x4BC8) + view.mem(0x4BC7)); if (mm.length < 2) mm = '0' + mm;   // 6200:2c1a / 2c4a
  if (view.mem(0x4BFB) === 0) s = ByteToStr(x) + ',' + ByteToStr(y) + ' ';   // 6200:2c78 / 2c84
  s = s + dsStr(0x2540 + 3 * G.party_Dir) + ' ';                         // 6200:2cc7 DirName
  s = s + hh + ':' + mm;                                                 // 6200:2d06
  if (G.DebugFlag) s = s + '*';                                          // 6200:2d42 / 2d49
  if (G.view_Mode === 2) s = s + ' camping';                             // 6200:2d71 / 2d78
  else if (view.mem(0x7ECA) & 1) s = s + ' search';                      // 6200:2da2 / 2db2
  ClearRectangle(0x11, 0x0F, 0x26, 0x0F);                                // 6200:2dda
  DrawText(0x11, 0x0F, 0x0A, 0, s);                                      // 6200:2deb
}

// 6200:2E05 ov24_2E05: combat view refresh
export function ov24_2E05() {
  PaletteFlashOn();                                                      // 6200:2e05
  FrameCombat();                                                         // 6200:2e0d FUN_01A0_0397
  FocusSquare(sx8(G.cm_Map.b[2]) + 3, sx8(G.cm_Map.b[3]) + 3, 0xFF, 8);  // 6200:2e12
}

// 6200:2E6A SelectPartyCharacter(prompt, allowExit, var sel)
export async function SelectPartyCharacter(prompt, allowExit, sel) {
  const p = s40(prompt); let key = ' ', exitItem = '';                   // 6200:2e6a / 2e84
  if (allowExit) exitItem = ' Exit';                                     // 6200:2e8c / 2e92
  while (!['\r', '\x1b', 'E', 'S'].includes(key)) {                      // 6200:2ea5 set CS:2E41
    PartySummary(sel.v);                                                 // 6200:2eb8
    const anim = G.view_Mode === 2 || G.view_Mode === 6;                 // 6200:2ec6
    const r = await HorizontalMenu(p + ' ', 'Select' + exitItem, 0x0D, 0x0A, 0x0F, true, anim);   // 6200:2ede / 2f12
    key = r.key;
    let c = sel.v;                                                       // 6200:2f2f
    if (r.ext) {                                                         // 6200:2f3d
      if (key === 'O') { c = c ? c.next : null; if (!c) c = G.PartyList; }   // 6200:2f46 End
      else if (key === 'G') {                                            // 6200:2f73 Home
        c = G.PartyList;
        if (sel.v === G.PartyList) { while (c && c.next) c = c.next; }   // 6200:2fc3
        else { while (c && c.next !== sel.v) c = c.next; }               // 6200:2f97
      }
    } else if (allowExit && (key === 'E' || key === '\0')) c = null;     // 6200:2fe6 / 2fec / 2ff8
    sel.v = c;                                                           // 6200:3000
  }
}

// 6200:3018 WeaponIsRanged(c) / 6200:305B ov24_305B(c)
export function WeaponIsRanged(c) { return !!rd(c, 0) && IT(itype(rd(c, 0)), 0x0C) > 1; }   // 6200:301e
export function ov24_305B(c) { return WeaponIsRanged(c) && (IT(itype(rd(c, 0)), 0x0E) & 0x14) === 0x14; }   // 6200:305b

// 6200:30A0 GetMissileAmmo(c, var ammo)
export function GetMissileAmmo(c, ammo) {
  let ok = false; const w = rd(c, 0); ammo.v = null; let f = 0;          // 6200:30a6 / 30aa / 30ba
  if (w) {                                                               // 6200:30ca
    f = IT(itype(w), 0x0E);                                              // 6200:30d2
    if (f & 0x10) ammo.v = w;                                            // 6200:30e8
    if (f & 0x08) {
      if (f & 0x01) ammo.v = rd(c, 11);                                  // 6200:3109
      if (f & 0x80) ammo.v = rd(c, 12);                                  // 6200:3126
    }
  }
  if (ammo.v || f === 0x0A) ok = true;                                   // 6200:3143
  return ok;
}

// 6200:3162 RacialLevelLimitReached(c, cls)
export function RacialLevelLimitReached(c, cls) {
  let r = false; const lvl = c.b[0x109 + cls], str = c.b[0x11];          // 6200:3168 / 3175
  if (lvl > 0) switch (c.b[0x74]) {                                      // 6200:3186 / 318f
    case 1: if (cls === 2) r = (lvl === 8 && str === 17) || (lvl === 7 && str < 17); break;   // 6200:319a
    case 2: if (cls === 2) r = lvl === 7 || (lvl === 6 && str === 17) || (lvl === 5 && str < 17); break;   // 6200:31cb
    case 3: if (cls === 2) r = lvl === 6 || (lvl === 5 && str < 18); break;   // 6200:3202
    case 4: if (cls === 0 && lvl === 5) r = true;                        // 6200:3228
            else if (cls === 2) r = lvl === 8 || (lvl === 7 && str === 17) || (lvl === 6 && str < 17); break;   // 6200:323a
    case 5: if (cls === 2) r = lvl === 6 || (lvl === 5 && str === 17) || (lvl === 4 && str < 17); break;   // 6200:3270
  }
  return r;
}

// 6200:32A9 MakeItem(type, w1, w2, w3, plus, plus2, readied, hidden, magic, weight, count, value, p1, p2, p3): PItem
export function MakeItem(type, w1, w2, w3, plus, plus2, readied, hidden, magic, weight, count, value, p1, p2, p3) {
  const it = newItem();                                                  // 6200:32a9 / 32bd GetMem + FillChar
  it.b[0x2E] = type; it.b[0x2F] = w1; it.b[0x30] = w2; it.b[0x31] = w3;  // 6200:32ce .. 32ec
  it.b[0x32] = plus; it.b[0x33] = plus2; it.b[0x34] = readied; it.b[0x35] = hidden; it.b[0x36] = magic;   // 6200:32f6 .. 331e
  wrW(it.b, 0x37, weight); it.b[0x39] = count; wrW(it.b, 0x3A, value);   // 6200:3328 / 3332 / 333c
  it.b[0x3C] = p1; it.b[0x3D] = p2; it.b[0x3E] = p3;                     // 6200:334c / 3356 / 3360 power[1..3] (+3Bh + k)
  return it;                                                             // 6200:3364
}

// 6200:3387 BandageDying(doIt): true when a party member is dying; with doIt the first one is bandaged
export async function BandageDying(doIt) {
  let r = false;                                                         // 6200:338d
  for (let p = G.PartyList; p; p = p.next) {                             // 6200:3391 / 339d
    if (cr(p)[0x13] === 0 && p.b[0x197] === 0 && p.b[0x195] === 5) {    // 6200:33a5 / 33b4 / 33bf
      r = true;                                                          // 6200:33ca
      if (doIt) {                                                        // 6200:33ce
        p.b[0x195] = 4; cr(p)[0x0E] = 0;                                 // 6200:33d4 / 33dd
        await ShowCharacterMessage(p, 'is bandaged', 0x0A, true);        // 6200:33ea
        doIt = false;                                                    // 6200:3409
      }
    }
  }
  return r;                                                              // 6200:3420
}

// 6200:342F ov24_init: empty.
