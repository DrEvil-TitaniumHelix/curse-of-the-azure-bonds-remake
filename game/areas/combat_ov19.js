// game/areas/combat_ov19.js — COMBAT ov19 (5000): character sheet, View menu, items menu, trade/drop/sell/identify, coins,
// spell list, paladin Heal/Cure.
// Owner: cab-build-areas. Source: decode/pseudo/COMBAT.pas.md ov19 (verified; DOSBox fixes COMBAT-19-01 / 19-10 applied);
// screens S095..S110 (S095 sheet and S105 drop coins have DOSBox references). Pool twin ov19 7F00 (structure only).
// Re-read from decode/listings/ov19.lst:
//  - ViewMenu (5000:0da0..0dc8): HorizontalMenu(prompt cs:0B09 = '' , menu, 0Dh, 0Ah, 0Fh, allowExt 0, animate 0, var ext);
//    the case has no ext test; after it `if not turnUsed and key in ['I','S','T'] then DrawCharacterSheet` (set CS:0B55).
//  - DropCoins (5000:2fa9..3252): the TradeCoins inner loop with DrawMoney first on every pass, the ' Select' list menu at
//    (12, 7)-(25, 13) and DropCoinsToPool; the coin list repeats after a drop until Exit or no money (COMBAT-19-10).
// Character fields: +0 name, +11h+2i abilities, +1Ch str_exc, +1Eh.. mem_spell[84], +74h race, +75h class, +76h age (word),
// +F7h npc_morale, +FBh+2i money[0..6], +109h levels, +111h old levels, +119h gender, +11Bh alignment, +127h xp (LongInt),
// +12Bh class_mask, +137h.. MU spell slots, +14Ch item_count, readied[k] = c.readied[k], +185h hands_used, +187h
// encumbrance, +191h cures_left, +195h status, +196h active, +198h controlled, +199h thac0, +19Eh.. damage, +1A5h move.
// Item fields: +0 name, +2Eh itype, +2Fh..+31h namenum, +32h plus, +33h plussave, +34h ready, +35h identified, +36h cursed,
// +37h weight (word), +39h count, +3Ah value (word), +3Ch..+3Eh special[1..3].

import { G, newItem, rdW, wrW, pstr } from '../engine/state.js';
import { DrawText, DrawWrappedText, ClearRectangle, MessageDelay, ShowBottomPromptAndReadKey, text,
  DrawScreenFrame, FrameUpperRedraw, FrameWithBar2 } from '../engine/text.js';
import { view } from './view_ov30.js';
import { HorizontalMenu, AskYesNo, VerticalListMenu, FreeMenuList } from './view_ov26.js';
import { PaletteFlashOn, PaletteFlashOff } from './view_ov32.js';
import { X } from './view_link.js';

const sb = (v) => ((v & 0xFF) ^ 0x80) - 0x80;
const dsStr = (a) => (G.ds ? pstr(G.ds, a) : '');
const IT = (t, o) => (G.ds ? G.ds[0x5CF6 + (t & 0xFF) * 16 + o] : 0);   // ItemTypeTable[t]: +0 slot, +1 hands, +2 dice_L, +3 sides_L, +0Dh usable_by
const DISEASES = [0x1F, 0x22, 0x2B, 0x2C, 0x32, 0x39];   // DiseaseEffects DS:0828..082D (image)
const disease = (k) => (G.ds ? G.ds[0x0827 + k] : DISEASES[k - 1]);
const COIN_VALUE = [1, 10, 100, 200, 1000];              // CoinValue DS:0CA2 (5 LongInts)
const coinValue = (k) => (G.ds ? (G.ds[0x0CA2 + 4 * k] | (G.ds[0x0CA3 + 4 * k] << 8) | (G.ds[0x0CA4 + 4 * k] << 16) | (G.ds[0x0CA5 + 4 * k] << 24)) : COIN_VALUE[k]);
const coinName = (k) => dsStr(0x0F93 + 11 * k);          // CoinName string[10]
const money = (c, k) => rdW(c.b, 0xFB + 2 * k);
const setMoney = (c, k, v) => wrW(c.b, 0xFB + 2 * k, v);
const nameOf = (o) => pstr(o.b, 0);
const sel = () => G.SelectedChar;
const readied = (c, k) => (Array.isArray(c.readied) ? c.readied[k] ?? null : null);
const TM = () => { if (!Array.isArray(G.TreasureMoney)) G.TreasureMoney = [0, 0, 0, 0, 0, 0, 0]; return G.TreasureMoney; };

// 5000:0083 DrawCharacterSheet
export async function DrawCharacterSheet() {
  G.ViewChar = sel();                                                    // 5000:008a
  const v = G.ViewChar;
  DrawScreenFrame();                                                     // 5000:0097
  await X.DrawCharacterName(v, 1, 1, 0);                                 // 5000:009c
  if (v.b[0xF7] > 0x7F) DrawText(nameOf(v).length + 3, 1, 10, 0, '(NPC)');   // 5000:00b2 / 00e4
  let x = 1;                                                             // 5000:00e9
  let s = dsStr(0x0F85 + 7 * v.b[0x119]);                                // 5000:00ed GenderName
  DrawText(x, 3, 15, 0, s); x += s.length + 1;                           // 5000:0113 / 012b
  s = dsStr(0x0E9C + 10 * v.b[0x74]);                                    // 5000:013e RaceName
  DrawText(x, 3, 15, 0, s); x += s.length + 1;                           // 5000:0163 / 017b
  DrawText(x, 3, 15, 0, 'Age ' + (await X.WordToStr(rdW(v.b, 0x76))));   // 5000:018e .. 01c3
  DrawText(1, 4, 15, 0, dsStr(0x0EEC + 17 * v.b[0x11B]));               // 5000:01c8 / 01ee AlignmentName
  DrawText(1, 5, 15, 0, dsStr(0x0CB6 + 27 * v.b[0x75]));                 // 5000:0205 / 022a ClassName
  const AB = ['STR ', 'INT ', 'WIS ', 'DEX ', 'CON ', 'CHA '];
  for (let i = 0; i <= 5; i++) {                                         // 5000:024a
    DrawText(1, i + 7, 10, 0, AB[i]);                                    // 5000:02e8
    await DrawAbility(i, false);                                         // 5000:0304
  }
  await DrawMoney();                                                     // 5000:0318
  DrawText(1, 15, 15, 0, 'Level');                                       // 5000:031c / 0338
  let any = false; s = '';                                               // 5000:033d / 0342
  const ccl = await X.CurrentClassLevel(v);
  for (let i = 0; i <= 7; i++) {                                         // 5000:0342
    const lv = v.b[0x109 + i], ol = v.b[0x111 + i];
    if (lv > 0 || (ol > 0 && ol < (ccl & 0xFF))) {                       // 5000:0350 .. 0399
      if (any) s += '/';                                                 // 5000:039c / 03a3
      s += await X.ByteToStr((lv + ol) & 0xFF);                          // 5000:03cd .. 041d
      any = true;                                                        // 5000:0422
    }
  }
  DrawText(7, 15, 15, 0, s);                                             // 5000:0430
  const xp = v.b[0x127] | (v.b[0x128] << 8) | (v.b[0x129] << 16) | (v.b[0x12A] << 24);
  DrawText(17, 15, 15, 0, 'Exp ' + (await X.LongToStr(xp)));             // 5000:0447 .. 0481
  await DrawCombatStats();                                               // 5000:0486
  let row = 20;                                                          // 5000:048a
  if (readied(v, 0)) {                                                   // 5000:048e
    DrawText(1, row, 15, 0, 'Weapon');                                   // 5000:049e / 04bb
    await X.BuildItemName(v, readied(v, 0), 8, row, 0, 1);               // 5000:04c0
  }
  row++;                                                                 // 5000:04e8
  if (readied(v, 2)) {                                                   // 5000:04eb
    DrawText(2, row, 15, 0, 'Armor');                                    // 5000:04fb / 0518
    await X.BuildItemName(v, readied(v, 2), 8, row, 0, 1);               // 5000:051d
  }
  row++;                                                                 // 5000:0545
  DrawText(1, row, 15, 0, 'Status');                                     // 5000:0548 / 0565
  DrawText(8, row, 10, 0, dsStr(0x0FE0 + 13 * v.b[0x195]));              // 5000:056a StatusName
}

// 5000:0597 DrawMoney
export async function DrawMoney() {
  ClearRectangle(12, 7, 26, 14);                                         // 5000:059e
  let row = 7;                                                           // 5000:05af
  for (let i = 6; i >= 0; i--)                                           // 5000:05b3
    if (money(sel(), i) !== 0) {                                         // 5000:05bc
      const s = coinName(i);                                             // 5000:05d0
      DrawText(20 - s.length, row, 10, 0, s);                            // 5000:05ef
      DrawText(21, row, 10, 0, await X.WordToStr(money(sel(), i)));      // 5000:0610 / 0639
      row++;                                                             // 5000:063e
    }
}

// 5000:0698 DrawCombatStats
export async function DrawCombatStats() {
  const c = sel();                                                       // 5000:069f
  await X.RecalcItems(c);                                                // 5000:06ab
  const row = 17;                                                        // 5000:06b6
  DrawText(1, row, 15, 0, 'AC    ');                                     // 5000:06ba / 06d6
  await X.DrawAC(c, 4, row);                                             // 5000:06db
  DrawText(1, row + 1, 15, 0, 'HP    ');                                 // 5000:06ed / 070c
  await X.DrawHP(c, 4, row + 1, 0);                                      // 5000:0711
  let col = 8;                                                           // 5000:0729
  DrawText(col + 1, row, 15, 0, 'THAC0   ');                             // 5000:072d / 074d
  DrawText(col + 7, row, 10, 0, await X.ByteToStr((60 - c.b[0x199]) & 0xFF));   // 5000:0752 / 0782
  let s = (await X.ByteToStr(c.b[0x19E])) + 'd' + (await X.ByteToStr(c.b[0x1A0]));   // 5000:0787 .. 07c7
  const bonus = sb(c.b[0x1A2]);
  if (bonus > 0) s += '+' + (await X.ByteToStr(bonus));                  // 5000:07cc .. 0813
  if (bonus < 0) s += '-' + (await X.ByteToStr(Math.abs(bonus)));        // 5000:0818 .. 0866
  DrawText(col, row + 1, 15, 0, 'Damage        ');                       // 5000:086b / 088b
  DrawText(col + 7, row + 1, 10, 0, s);                                  // 5000:0890
  col = 22;                                                              // 5000:08b0
  DrawText(col, row, 15, 0, 'Encumbrance      ');                        // 5000:08b4 / 08d1
  DrawText(col + 12, row, 10, 0, await X.WordToStr(rdW(c.b, 0x187)));    // 5000:08d6 / 08fc
  let mv = c.b[0x1A5];                                                   // 5000:0901
  if (await X.HasEffect(c, 0x2A, { v: null })) mv = (mv * 2) & 0xFF;     // 5000:090c / 0923
  if (await X.HasEffect(c, 0x27, { v: null })) mv = mv >> 1;             // 5000:092d / 0944
  DrawText(col + 3, row + 1, 15, 0, 'Movement   ');                      // 5000:0952 / 0977
  DrawText(col + 12, row + 1, 10, 0, await X.ByteToStr(mv));             // 5000:097c / 09a1
}

// 5000:09B3 DrawAbility(stat, highlight)
export async function DrawAbility(stat, highlight) {
  const colour = highlight ? 13 : 10;                                    // 5000:09b6 .. 09c4
  let col = 5;                                                           // 5000:09ca
  ClearRectangle(5, stat + 7, 11, stat + 7);                             // 5000:09ce
  const v = sel().b[0x11 + 2 * stat];
  if (v < 10) col++;                                                     // 5000:09ea / 09fd
  DrawText(col, stat + 7, colour, 0, await X.ByteToStr(v));              // 5000:0a00 / 0a2f
  const exc = sel().b[0x1C];
  if (stat === 0 && sel().b[0x11] === 18 && exc !== 0) {                 // 5000:0a34 .. 0a59
    let s = await X.ByteToStr(exc);                                      // 5000:0a59 / 0a6d
    if (exc < 10) s = '0' + s;                                           // 5000:0a7b / 0a86
    if (exc === 100) s = '00';                                           // 5000:0aae / 0ab9
    DrawText(7, 7, colour, 0, '(' + s + ')');                            // 5000:0acc .. 0afd
  }
}

// 5000:0B75 ViewMenu(var turnUsed)
export async function ViewMenu(turnUsed) {
  if (G.view_Mode === 5) PaletteFlashOff();                              // 5000:0b7c / 0b83
  let key = ' '; turnUsed.v = false;                                     // 5000:0b88 / 0b8c
  G.TradePartner = sel();                                                // 5000:0b93
  await DrawCharacterSheet();                                            // 5000:0ba0
  while (key !== '\0' && key !== 'E' && !turnUsed.v) {                   // 5000:0ba4 set CS:0B08
    const v = G.ViewChar;
    let menu = '', hasSpells = false, hasMoney = false;                  // 5000:0bc3 .. 0bcb
    for (let i = 0; i <= 83; i++) if (v.b[0x1E + i] !== 0) hasSpells = true;   // 5000:0bd8 .. 0bf4
    for (let i = 0; i <= 6; i++) if (money(v, i) !== 0) hasMoney = true;  // 5000:0bf4 .. 0c15
    if (v.items) menu += 'Items ';                                       // 5000:0c1b / 0c2b
    if (hasSpells) menu += 'Spells ';                                    // 5000:0c53 / 0c59
    if ((v.b[0xF7] < 0x80 || v.b[0x196] === 0 || v.b[0x195] === 1) && hasMoney && G.view_Mode !== 5) menu += 'Trade ';   // 5000:0c81 .. 0cb2
    if (hasMoney) menu += 'Drop ';                                       // 5000:0cda / 0ce0
    if (await CanLayHands(sel())) menu += 'Heal ';                       // 5000:0d08 / 0d18
    if (await CanCureDisease(sel())) menu += 'Cure ';                    // 5000:0d40 / 0d50
    menu += 'Exit';                                                      // 5000:0d78
    key = (await HorizontalMenu('', menu, 13, 10, 15, false, false)).key;   // 5000:0dc8 prompt cs:0B09 = ''
    const spellIdx = { v: -1 };                                          // 5000:0dcd
    switch (key) {                                                       // 5000:0dd0
      case 'I': await ItemsMenu(turnUsed); break;                        // 5000:0ddc
      case 'S': await SpellList(0, 0, spellIdx, { v: hasSpells ? 1 : 0 }); break;   // 5000:0deb result unused
      case 'T': await TradeCoins(); break;                               // 5000:0e08
      case 'D': await DropCoins(); await DrawMoney(); break;             // 5000:0e12 / 0e16
      case 'H': await LayOnHands(sel()); break;                          // 5000:0e20
      case 'C': await PaladinCureDisease(sel()); break;                  // 5000:0e32
    }
    if (!turnUsed.v && (key === 'I' || key === 'S' || key === 'T')) await DrawCharacterSheet();   // 5000:0e3e .. 0e57
  }
  if (G.view_Mode === 5) PaletteFlashOn();                               // 5000:0e5e / 0e65
  await X.RedrawCurrentMode();                                           // 5000:0e6a
}

// 5000:0EC5 MayLoseItem(item): Boolean
export async function MayLoseItem(item) {
  let r = false;                                                         // 5000:0ecb
  if (item.b[0x34] !== 0) await X.ShowTimedBottomMessage('Must be unreadied');   // 5000:0ecf .. 0ee8
  else if (!await X.IsScroll(item)) r = true;                            // 5000:0ef0 / 0f06
  else if (item.b[0x3C] > 0x7F || item.b[0x3D] > 0x7F || item.b[0x3E] > 0x7F) {   // 5000:0f06 .. 0f1d
    await X.DrawCharacterName(sel(), 1, 21, 0);                          // 5000:0f24
    text.col = nameOf(sel()).length + 2; text.row = 21;                  // 5000:0f3a / 0f49
    await DrawWrappedText(1, 21, 38, 22, 14, 0, 0, ' was going to scribe from that scroll');   // 5000:0f4e / 0f72
    if (await AskYesNo('is it Okay to lose it? ', 13, 10, 15) === 'Y') r = true;   // 5000:0f77 .. 0f98
  } else r = true;                                                       // 5000:0f9e
  ClearRectangle(1, 21, 38, 22);                                         // 5000:0fa2
  return r;
}

// 5000:10AB ItemDebugView(item): SSI's own item dump (hidden 'V' key of the items menu)
export async function ItemDebugView(item) {
  DrawScreenFrame();                                                     // 5000:10b2
  const L = ['itemptr:      ', 'namenum(1):   ', 'namenum(2):   ', 'namenum(3):   ', 'plus:         ', 'plussave:     ',
    'ready:        ', 'identified:   ', 'cursed:       ', 'value:        ', 'special(1):   ', 'special(2):   ', 'special(3):   ',
    'dice large:    ', 'sides large:   '];                               // cs:0FBC..109F, read from decode/listings/ov19.lst
  for (let i = 0; i < 15; i++) DrawText(1, i + 1, 10, 0, L[i]);          // 5000:10db .. 129b
  const B = (v) => X.ByteToStr(v);
  DrawText(20, 1, 10, 0, await B(item.b[0x2E]));                         // 5000:12a0 / 12bf
  for (let k = 1; k <= 3; k++) DrawText(20, 1 + k, 10, 0, await B(item.b[0x2E + k]));   // 5000:12c4 .. 132b
  DrawText(20, 5, 10, 0, await B(item.b[0x32])); DrawText(20, 6, 10, 0, await B(item.b[0x33]));   // 5000:1330 ..
  DrawText(20, 7, 10, 0, await B(item.b[0x34]));                         // .. 1397
  DrawText(20, 8, 10, 0, await B(item.b[0x35])); DrawText(20, 9, 10, 0, await B(item.b[0x36]));   // 5000:139c .. 13df
  DrawText(20, 10, 10, 0, await X.WordToStr(rdW(item.b, 0x3A)));         // 5000:13e4 / 1402
  for (let k = 1; k <= 3; k++) DrawText(20, 10 + k, 10, 0, await B(item.b[0x3B + k]));   // 5000:1407 .. 146e
  DrawText(20, 14, 10, 0, await B(IT(item.b[0x2E], 2)));                 // 5000:1473 / 149e
  DrawText(20, 15, 10, 0, await B(IT(item.b[0x2E], 3)));                 // 5000:14a3 / 14ce
  await ShowBottomPromptAndReadKey(10, 0, 'press a key');                // 5000:14d3 / 14e8
}

// 5000:1588 ItemsMenu(var turnUsed)
export async function ItemsMenu(turnUsed) {
  const c = sel();
  let key = ' ';                                                         // 5000:158f
  const item = { v: c.items }, index = { v: 0 }, redraw = { v: true };   // 5000:1597 .. 15ad
  let fullRedraw = 1;                                                    // 5000:15b1
  while (key !== '\0' && key !== 'E' && !turnUsed.v) {                   // 5000:15bc .. 15cf set CS:14F3
    if (c.b[0x14C] === 0) return;                                        // 5000:15db
    const oldCount = c.b[0x14C];                                         // 5000:15e6
    if (c.items) {                                                       // 5000:15e9
      let menu = 'Ready';                                                // 5000:1606
      const vm = G.view_Mode;
      if (c.b[0x196] !== 0 && view.mem(0x4BE5) === 0 && ((vm >= 2 && vm <= 4) || (vm === 5 && c.combat && c.combat.b[2] !== 0)))   // 5000:1619 .. 1659
        menu += ' Use';
      if ((c.b[0xF7] < 0x80 || c.b[0x196] === 0 || c.b[0x195] === 1) && vm !== 5) menu += ' Trade';   // 5000:1683 .. 16ce
      menu += ' Drop';                                                   // 5000:16d3
      if (c.b[0x14C] < 16) menu += ' Halve';                             // 5000:16fb .. 1729
      menu += ' Join';                                                   // 5000:172e
      if ((c.b[0xF7] < 0x80 || c.b[0x196] === 0 || c.b[0x195] === 1) && vm === 1) menu += ' Sell';   // 5000:1756 .. 17a1
      if (vm === 1) menu += ' Id';                                       // 5000:17a6 .. 17d0
      for (let p = c.items; p; p = p.next) await X.BuildItemName(c, p, 0, 0, 1, 0);   // 5000:17d5 .. 180a
      if (fullRedraw !== 0 || G.ItemsChanged !== 0) {                    // 5000:181b / 1821
        FrameWithBar2();                                                 // 5000:1828 FUN_01A0_048D
        await X.DrawCharacterName(c, 1, 1, 1);                           // 5000:182d
        DrawText(nameOf(c).length + 4, 1, 10, 0, 'Items');               // 5000:1841 / 1865
        DrawText(1, 3, 15, 0, 'Ready Item');                             // 5000:186a / 1885
        redraw.v = true; fullRedraw = 0; G.ItemsChanged = 0;             // 5000:188a .. 1892
      }
      key = await VerticalListMenu('', menu, 13, 10, 15, 1, 5, 38, 22, c.items, true, redraw, index, item);   // 5000:18df
      const s = item.v;
      if (s) {                                                           // 5000:18e7
        switch (key) {                                                   // 5000:18f2
          case 'V': await ItemDebugView(s); redraw.v = true; fullRedraw = 1; break;   // 5000:18f9 .. 1907
          case 'R': await ReadyItem(s); break;                           // 5000:1912
          case 'U':                                                      // 5000:191f
            if (s.b[0x34] === 0) { await X.ShowTimedBottomMessage('Must be Readied'); key = ' '; }   // 5000:192d .. 1941
            else if (await X.IsScroll(s) || (s.b[0x3D] !== 0 && s.b[0x3E] < 0x80)) {   // 5000:1947 .. 1963
              await UseItem(s, turnUsed);                                // 5000:196a
              if (G.view_Mode !== 5) turnUsed.v = false;                 // 5000:1979 / 1980
              if (!turnUsed.v) fullRedraw = 1;                           // 5000:1987 / 198a
            }
            break;
          case 'T':                                                      // 5000:199b
            if (await MayLoseItem(s)) await TradeItem(s); else key = ' ';
            fullRedraw = 1;                                              // 5000:19b9
            break;
          case 'D':                                                      // 5000:19c7
            if (await MayLoseItem(s)) {
              await X.BuildItemName(c, s, 0, 0, 0, 0);                   // 5000:19d8
              await DrawWrappedText(1, 21, 38, 22, 14, 0, 1, 'Your ' + nameOf(s) + 'will be gone forever');   // 5000:19f5 .. 1a2e
              if (await AskYesNo('Drop It? ', 13, 10, 15) === 'Y') { await X.LoseItem(sel(), s); redraw.v = true; }   // 5000:1a33 .. 1a67
              ClearRectangle(1, 21, 38, 22);                             // 5000:1a6b
            } else key = ' ';                                            // 5000:1a7e
            break;
          case 'H': await HalveItem(s); break;                           // 5000:1a88
          case 'J': await JoinItems(s); break;                           // 5000:1a98
          case 'S': if (await MayLoseItem(s)) await SellItem(s); else key = ' '; break;   // 5000:1aa8 .. 1ac2
          case 'I': await IdentifyItem(s, redraw); break;                // 5000:1acc
        }
      }
      await X.RecalcItems(c);                                            // 5000:1adb
    }
    if (c.b[0x14C] !== oldCount) redraw.v = true;                        // 5000:1ae6 / 1af3
  }
}

// 5000:1B00 ItemReadyEffect(item, onReady)
export async function ItemReadyEffect(item, onReady) {
  const c = sel();                                                       // 5000:1b06
  const kind = item.b[0x3E] & 0x7F;                                      // 5000:1b12
  switch (kind) {                                                        // 5000:1b1e
    case 0: G.item_HookMode = 1; await X.CallEffectHandler(item.b[0x3E], c, item, onReady ? 0 : 1); break;   // 5000:1b2d / 1b4d
    case 1:
      if (!onReady) {                                                    // 5000:1b56 / 1b5e
        const lv = (c.b[0x10E] + c.b[0x116] * ((await X.DualClassActive(c)) ? 1 : 0)) & 0xFF;   // 5000:1b92 .. 1bb6
        for (let k = 1; k <= 5; k++) c.b[0x136 + k] = 0;                 // 5000:1bbb
        c.b[0x137] = 1;                                                  // 5000:1bd3
        if (lv > 1) for (let L = 2; L <= lv; L++) for (let k = 1; k <= 5; k++)   // 5000:1bdf .. 1c2b
          c.b[0x136 + k] = (c.b[0x136 + k] + (G.ds ? G.ds[0x44A9 + L * 5 + k] : 0)) & 0xFF;
        const cnt = [lv, 0, 0, 0, 0, 0];                                 // 5000:1c31 / 1c39
        for (let d = 0; d <= 83; d++) {                                  // 5000:1c4a
          const sp = c.b[0x1E + d];
          if (sp !== 0 && G.ds && G.ds[0x37DA + sp * 0x10] === 2) {      // 5000:1c53 .. 1c69 SpellTable[id*16] +0 class
            const L = G.ds[0x37DB + sp * 0x10];                          // 5000:1c64
            cnt[L] = (cnt[L] ?? 0) + 1;                                  // 5000:1c81
            if (c.b[0x136 + L] < cnt[L]) c.b[0x1E + d] = 0;              // 5000:1ca8 .. 1cc2 forget the excess
          }
        }
      } else for (let k = 1; k <= 3; k++) c.b[0x136 + k] = (c.b[0x136 + k] * 2) & 0xFF;   // 5000:1b64 .. 1b8d
      break;
    case 2: await X.RecalcAbility(c, 3); await X.UpdateThiefSkills(c); break;   // 5000:1ce4 / 1cf2
    case 4:
      if ((item.b[0x3D] & 0x0F) !== c.b[0x11B]) {                        // 5000:1d05 .. 1d11
        item.b[0x34] = 0;                                                // 5000:1d18
        const dmg = item.b[0x3D] >> 4;                                   // 5000:1d20
        G.DamageType = 8;                                                // 5000:1d32
        if (G.view_Mode === 5) await X.ov24_2E05();                      // 5000:1d37 / 1d3e
        await X.DamageCharacter(c, dmg, 0, 0);                           // 5000:1d43
        G.ItemsChanged = 1;                                              // 5000:1d58
      }
      break;
    case 5: await X.RecalcAbility(c, 0); break;                          // 5000:1d65
    case 6: await X.RecalcAbility(c, 4); await X.RecalcAbility(c, 5); break;   // 5000:1d7b / 1d89
    case 8: if (item.b[0x3D] <= 5) await X.RecalcAbility(c, item.b[0x3D]); break;   // 5000:1da2 .. 1e22
    case 9: if (!onReady) await X.RemoveEffect(c, 0x17, null); break;    // 5000:1e29 / 1e34
    case 0x0A: await X.RecalcAbility(c, 3); break;                       // 5000:1e4f
    case 0x0B: await X.UpdateThiefSkills(c); break;                      // 5000:1e64
    case 0x0C: await X.RecalcAbility(c, 1); break;                       // 5000:1e76
    case 0x0D: await X.RecalcAbility(c, 0); await X.RecalcAbility(c, 1); break;   // 5000:1e8b / 1e99
  }
}

// 5000:1EE9 ReadyItem(item)
export async function ReadyItem(item) {
  const hasHook = item.b[0x3E] > 0x7F;                                   // 5000:1ef0
  const c = sel();                                                       // 5000:1f03
  if (!Array.isArray(c.readied)) c.readied = new Array(13).fill(null);
  if (item.b[0x34] !== 0) {                                              // 5000:1f0f
    if (item.b[0x36] !== 0) await X.ShowTimedBottomMessage("It's Cursed");   // 5000:1f19 .. 1f32
    else { item.b[0x34] = 0; if (hasHook) await ItemReadyEffect(item, false); }   // 5000:1f39 / 1f41 / 1f47
    return;
  }
  let err = 0;                                                           // 5000:1f57
  const t = item.b[0x2E];
  if (c.b[0x185] + IT(t, 1) > 2) err = 3;                                // 5000:1f5b .. 1f83
  let slot = IT(t, 0);                                                   // 5000:1f87 .. 1f9a
  if (slot < 9) { if (c.readied[slot]) err = 2; }                        // 5000:1f9d .. 1fc5
  else if (slot === 9 && c.readied[10]) err = 2;                         // 5000:1fcb .. 1fdf
  if (t === 0x49 && c.readied[11]) { err = 2; slot = 11; }               // 5000:1fe3 .. 2000
  if (t === 0x1C && c.readied[12]) { err = 2; slot = 12; }               // 5000:2004 .. 2021
  if ((IT(t, 0x0D) & c.b[0x12B]) === 0) err = 1;                         // 5000:2025 .. 2044
  switch (err) {                                                         // 5000:2048
    case 0: item.b[0x34] = 1; if (hasHook) await ItemReadyEffect(item, true); break;   // 5000:2052 .. 2060
    case 1: await X.ShowTimedBottomMessage('Wrong Class'); break;        // 5000:2070 .. 2084
    case 2: {                                                            // 5000:2091
      const r = c.readied[slot];
      if (r) await X.BuildItemName(c, r, 0, 0, 0, 0);
      await X.ShowTimedBottomMessage('already using ' + (r ? nameOf(r) : ''));   // 5000:20bf .. 20e8
      break;
    }
    case 3: if (G.view_Mode !== 5 || c.b[0x198] === 0) await X.ShowTimedBottomMessage('Your hands are full!'); break;   // 5000:20f4 .. 2115
  }
}

// 5000:213C TradeItem(item)
export async function TradeItem(item) {
  const whom = { v: G.TradePartner };                                    // 5000:2142
  await X.RedrawCurrentMode();                                           // 5000:214e
  await X.SelectPartyCharacter('Trade with Whom?', 1, whom);             // 5000:2162
  if (whom.v) {                                                          // 5000:216f
    G.TradePartner = whom.v;                                             // 5000:2177
    if (await ItemOverloads(whom.v, item)) await X.ShowTimedBottomMessage('Overloaded');   // 5000:2183 .. 21a6
    else { await X.AppendItemCopy(whom.v, item); await X.LoseItem(sel(), item); await X.RecalcItems(whom.v); }   // 5000:21ad .. 21d1
  }
}

// 5000:21F3 HalveItem(item)
export async function HalveItem(item) {
  const half = item.b[0x39] >> 1;                                        // 5000:21f9
  if (half === 0) { await X.ShowTimedBottomMessage("Can't halve that"); return; }   // 5000:220b / 2289 / 2298
  const rest = item.b[0x39] - half;                                      // 5000:2211
  const p = newItem(); p.b.set(item.b);                                  // 5000:2226 / 2234
  p.b[0x39] = half; p.b[0x34] = 0; p.next = item.next;                   // 5000:2247 .. 2259
  item.b[0x39] = rest; item.next = p;                                    // 5000:2269 / 2277
}

// 5000:22A3 JoinItems(item): the special[1..3] self-compares are always true; only special[1] < 2 restricts
export async function JoinItems(item) {
  let target = item, total = target.b[0x39];                             // 5000:22a9 / 22b1
  let p = sel().items;                                                   // 5000:22be
  while (p) {                                                            // 5000:22cf
    const nxt = p.next;                                                  // 5000:22da
    const same = (o) => p.b[o] === target.b[o];
    if (p !== target && p.b[0x39] !== 0 && same(0x2F) && same(0x30) && same(0x31) && same(0x2E) &&
        same(0x32) && same(0x33) && same(0x36) && rdW(p.b, 0x37) === rdW(target.b, 0x37) && p.b[0x3C] < 2) {   // 5000:22e9 .. 23d0
      if (total + p.b[0x39] < 256) { total += p.b[0x39]; await X.LoseItem(sel(), p); }   // 5000:23e3 .. 2404
      else {
        target.b[0x39] = 255; p.b[0x39] = (p.b[0x39] - (255 - total)) & 0xFF; total = p.b[0x39]; target = p;   // 5000:2421 .. 2456
      }
    }
    p = nxt;
  }
  target.b[0x39] = total & 0xFF;                                         // 5000:2464
}

// 5000:248D UseItem(item, var done)
export async function UseItem(item, done) {
  const spellIdx = { v: -1 }; G.ItemCast = 0; let spell = 0;             // 5000:2493 .. 249d
  if (await X.IsScroll(item)) {                                          // 5000:24a1
    G.ScrollItem = item;                                                 // 5000:24b0
    spell = await SpellList(2, 1, spellIdx, { v: 0 });                   // 5000:24bc
  } else if (item.b[0x3D] !== 0 && item.b[0x3E] < 0x80) {                // 5000:24d5 .. 24e2
    G.ItemCast = 1; spell = item.b[0x3D] & 0x7F;                         // 5000:24e9 / 24ee
  }
  if (spell === 0) { done.v = false; return; }                           // 5000:24fa / 2500
  const c = sel();
  if (G.view_Mode === 5 && c.b[0x198] === 0) await X.ov24_2E05();        // 5000:250a .. 251d
  if (G.ItemCast !== 0) {                                                // 5000:2522
    await X.ShowCharacterMessage(c, 'uses an item', 10, 0);              // 5000:2543
    if (G.view_Mode === 5) {                                             // 5000:254e
      DrawText(0, 23, 10, 0, 'Item:');                                   // 5000:2555 / 2570
      await X.BuildItemName(c, item, 5, 23, 0, 1);                       // 5000:2575
    } else await X.BuildItemName(c, item, 1, 22, 0, 1);                  // 5000:2596
    await MessageDelay(); await X.ClearCharacterMessage();               // 5000:25b5 / 25ba
  }
  G.ItemCast = 1;                                                        // 5000:25bf
  if (!await X.IsScroll(item)) await X.CastSpell(spell, c.b[0x198], 0, done);   // 5000:25c4 / 2632
  else if ((await X.FormerClass(c)) !== 5 && (await X.CurrentClass(c)) !== 5 && (await X.FormerClass(c)) !== 0 &&
           (await X.CurrentClass(c)) !== 0 && sb(c.b[0x10E]) < 1 && sb(c.b[0x109]) < 1) {   // 5000:25d6 .. 2626
    if (c.b[0x10F] > 9 && (await X.Roll(1, 100)) < 76) await X.CastSpell(spell, c.b[0x198], 0, done);   // 5000:264f .. 266a thief
    else await X.ShowCharacterMessage(c, 'oops!', text.row + 1, 1);      // 5000:2687 / 269e
  } else await X.CastSpell(spell, c.b[0x198], 0, done);                  // 5000:26af
  G.ItemCast = 0;                                                        // 5000:26ca
  if (G.view_Mode === 5 && G.ds && G.ds[0x37E5 + spell * 0x10] !== 0)   // 5000:26cf .. 26e8 SpellTable[id*16] +0Bh combat
    done.v = !!(await X.ClearCombatantActionFlags(c));
  if (done.v) {                                                          // 5000:26fb
    if (await X.IsScroll(item)) await X.UseScrollSpell(c, item, spell);  // 5000:2704 / 2713
    else if (item.b[0x3C] !== 0) {                                       // 5000:272c
      if (item.b[0x39] < 2) {                                            // 5000:2736
        item.b[0x3C]--;                                                  // 5000:2740
        if (item.b[0x3C] === 0) await X.LoseItem(c, item);               // 5000:2749 / 275a
      } else item.b[0x39]--;                                             // 5000:2750
    }
  }
}

// 5000:27D6 SellItem(item)
export async function SellItem(item) {
  let price = 0;                                                         // 5000:27d9
  const value = rdW(item.b, 0x3A);
  if (value !== 0) price = value >> 1;                                   // 5000:27e2 / 27ec
  if (item.b[0x39] > 1) price = Math.trunc(((item.b[0x39] * price) & 0xFFFF) / 20);   // 5000:27fd .. 281b (the stack test is unreachable)
  await X.BuildItemName(G.ViewChar, item, 0, 0, 0, 0);                   // 5000:2842
  await DrawWrappedText(1, 21, 38, 22, 14, 0, 1, "I'll give you " + (await X.WordToStr(price)) + ' gold pieces for your ' + nameOf(item));   // 5000:2861 .. 28ad
  if (await AskYesNo('Is It a Deal? ', 13, 10, 15) === 'Y') {            // 5000:28b2 .. 28d3
    await X.ShowTimedBottomMessage('Sold!');                             // 5000:28e5
    const c = sel();
    await X.LoseItem(c, item);                                           // 5000:28ea
    const plat = Math.trunc(price / 5), gold = price % 5;                // 5000:28fd / 290a
    const room = { v: 0 };
    if (await X.WouldOverload(c, gold + plat, room)) {                   // 5000:2918
      await X.ShowTimedBottomMessage('Overloaded.  Money will be put in pool.');   // 5000:2944
      if (plat < room.v) setMoney(c, 4, money(c, 4) + plat);             // 5000:2949 / 2951
      else { setMoney(c, 4, money(c, 4) + room.v); TM()[4] = TM()[4] + (plat - room.v); }   // 5000:295f / 296b
      setMoney(c, 3, money(c, 3) + gold);                                // 5000:297b
    } else { setMoney(c, 4, money(c, 4) + plat); setMoney(c, 3, money(c, 3) + gold); }   // 5000:2989 / 2995
  }
  ClearRectangle(1, 21, 38, 22);                                         // 5000:29a1
}

// 5000:2A42 IdentifyItem(item, var redraw)
export async function IdentifyItem(item, redraw) {
  let paid = false;                                                      // 5000:2a45
  await X.BuildItemName(G.ViewChar, item, 0, 0, 0, 0);                   // 5000:2a4d
  await DrawWrappedText(1, 21, 38, 22, 14, 0, 1, "For 200 gold pieces I'll identify your " + nameOf(item));   // 5000:2a6c .. 2a9b
  if (await AskYesNo('Is It a Deal? ', 13, 10, 15) === 'Y') {            // 5000:2aa0 .. 2abd
    let m = MoneyInGold(sel());                                          // 5000:2ac4
    if (m >= 200) { paid = true; await X.SetCharMoneyGold((m - 200) & 0xFFFF); }   // 5000:2ad6 .. 2af5
    else {
      m = await X.MoneyValueInGold(TM());                                // 5000:2afc
      if (m >= 200) { paid = true; await X.SetPoolMoneyGold((m - 200) & 0xFFFF); }   // 5000:2b0c .. 2b2b
      else await X.ShowTimedBottomMessage('Not Enough Money');           // 5000:2b32 / 2b41
    }
  }
  if (paid) {                                                            // 5000:2b46
    if (item.b[0x35] === 0) await DrawWrappedText(1, 21, 38, 22, 14, 0, 1, "I can't tell anything new about your " + nameOf(item));   // 5000:2b4f .. 2b88
    else {
      item.b[0x35] = 0;                                                  // 5000:2b8f
      await X.BuildItemName(G.ViewChar, item, 0, 0, 0, 0);               // 5000:2b97
      await DrawWrappedText(1, 21, 38, 22, 14, 0, 1, 'It looks like some sort of ' + nameOf(item));   // 5000:2bb6 .. 2be5
      redraw.v = true;                                                   // 5000:2bea
    }
    await MessageDelay();                                                // 5000:2bf1 / 2bf7
  }
  ClearRectangle(1, 21, 38, 22);                                         // 5000:2bfc
}

// coin list of TradeCoins / DropCoins (5000:2cb0 .. 2e1d): one item per coin kind, built by prepending
function coinList(c) {
  let head = null;
  for (let i = 0; i <= 6; i++)                                           // 5000:2ccd
    if (money(c, i) !== 0) {                                             // 5000:2cd6
      const prev = head;
      head = { text: '', isHeader: 0, next: prev };                      // 5000:2cf6 .. 2d2e GetMem($2E)
      const num = String(money(c, i));                                   // 5000:2d3e Str(LongInt(money)) string[15]
      const name = coinName(i), pad = Math.max(0, 8 - name.length);      // 5000:2d64 .. 2d9b
      head.text = (' '.repeat(pad) + name + ' ' + num).slice(0, 40);     // 5000:2db4 .. 2df7
    }
  return head;
}

// 5000:2C57 TradeCoins
export async function TradeCoins() {
  let noMoney = false;
  do {
    const whom = { v: G.TradePartner };                                  // 5000:2c5e
    await X.RedrawCurrentMode();                                         // 5000:2c6a
    await X.SelectPartyCharacter('Trade to?', 1, whom);                  // 5000:2c7f
    if (!whom.v) noMoney = true;                                         // 5000:2c8c / 2c94
    else {
      await DrawCharacterSheet();                                        // 5000:2c9c
      let done = false;
      do {
        await DrawMoney();                                               // 5000:2ca0
        G.TradePartner = whom.v;                                         // 5000:2ca4
        const list = { v: coinList(sel()) };
        const index = { v: 0 }, redraw = { v: true }, item = { v: null };   // 5000:2e0d .. 2e1d
        await VerticalListMenu('Select type of coin ', ' Select', 13, 10, 15, 12, 7, 25, 13, list.v, true, redraw, index, item);   // 5000:2e42
        if (!item.v) done = true;                                        // 5000:2e79 / 2e7c
        else {
          const cn = { v: '' };                                          // 5000:2e81
          const coin = await X.CoinFromText(item.v.text, cn);            // 5000:2e8e
          const prompt = 'How much ' + cn.v + 'will you trade? ';        // 5000:2ea1 .. 2ed0
          const amount = await X.InputNumber(money(sel(), coin), prompt, 10);   // 5000:2ed5
          await X.TransferCoins(sel(), whom.v, amount, coin);            // 5000:2ef8
          done = true; noMoney = true;                                   // 5000:2f0f / 2f14
          for (let i = 0; i <= 6; i++) if (money(sel(), i) !== 0) { noMoney = false; done = false; }   // 5000:2f22 .. 2f44
        }
        if (list.v) FreeMenuList(list);                                  // 5000:2f46 / 2f4e
      } while (!done);                                                   // 5000:2f58
    }
  } while (!noMoney);                                                    // 5000:2f62
}

// 5000:2FA9 DropCoins: the coin list repeats after each drop until Exit or no money is left (COMBAT-19-10)
export async function DropCoins() {
  let done = false;
  do {
    await DrawMoney();                                                   // 5000:2fb1
    const list = { v: coinList(sel()) };
    const index = { v: 0 }, redraw = { v: true }, item = { v: null };
    await VerticalListMenu('Select type of coin ', ' Select', 13, 10, 15, 12, 7, 25, 13, list.v, true, redraw, index, item);   // 5000:3172
    if (!item.v) done = true;
    else {
      const cn = { v: '' };
      const coin = await X.CoinFromText(item.v.text, cn);                // 5000:319a
      const prompt = 'How much ' + cn.v + 'will you drop? ';             // 5000:31ad .. 31d1
      const amount = await X.InputNumber(money(sel(), coin), prompt, 10);   // 5000:31f0
      await X.DropCoinsToPool(sel(), amount, coin);                      // 5000:3209
      done = true;
      for (let i = 0; i <= 6; i++) if (money(sel(), i) !== 0) done = false;   // 5000:3221 .. 3252
    }
    if (list.v) FreeMenuList(list);                                      // 5000:3246
  } while (!done);
}

// 5000:3258 ItemOverloads(c, item): Boolean
export async function ItemOverloads(c, item) {
  await X.RecalcItems(c);                                                // 5000:325e
  let over = c.b[0x14C] > 15;                                            // 5000:3269
  let w = rdW(item.b, 0x37);                                             // 5000:327c
  if (item.b[0x39] !== 0) w = (item.b[0x39] * w) & 0xFFFF;               // 5000:3286 / 3290
  if (((rdW(c.b, 0x187) + w) & 0xFFFF) > (await X.StrWeightAllowance(c)) + 1500) over = true;   // 5000:329f .. 32cd
  return over;
}

// 5000:32DC CycleSelectedChar(key): Home ('G') = previous (wraps to the last), End ('O') = next
export function CycleSelectedChar(key) {
  let p = G.PartyList;                                                   // 5000:32e2
  if (p) {                                                               // 5000:32ee
    if (key === 'G') {                                                   // 5000:32f9
      if (p === G.SelectedChar) { while (p.next) p = p.next; }           // 5000:3300 .. 332d
      else { while (p && p.next !== G.SelectedChar) p = p.next; }        // 5000:3332 .. 335f
    } else if (key === 'O' && G.SelectedChar && G.SelectedChar.next) p = G.SelectedChar.next;   // 5000:3366 .. 337e
  }
  G.SelectedChar = p;                                                    // 5000:3399
}

// 5000:33AB MoneyInGold(c): LongInt (gems / jewelry not counted)
export function MoneyInGold(c) {
  let total = 0;                                                         // 5000:33b1
  for (let i = 0; i <= 4; i++) total = (total + money(c, i) * coinValue(i)) | 0;   // 5000:33b9 .. 33f9
  return Math.trunc((total + 100) / coinValue(3));                       // 5000:33f9 .. 340a
}

// 5000:3474 SpellList(mode, flag, var index, var count): Byte
export async function SpellList(mode, flag, index, count) {
  const s = ['in Memory', 'in Grimoire', 'on Scroll', 'on Scrolls', 'to Choose', 'to Memorize', 'to Scribe'][mode] ?? '';   // 5000:347b .. 3536
  count.v = await X.BuildSpellList(mode);                                // 5000:353c
  if (count.v === 0) return 0;                                           // 5000:354b / 354e
  if (index.v < 0 || flag === 1) {                                       // 5000:3557 / 3560
    if (G.view_Mode === 5) DrawScreenFrame();                            // 5000:3566
    else if (flag === 2) FrameUpperRedraw();                             // FUN_01A0_0292
    else FrameWithBar2();                                                // 5000:3581 FUN_01A0_048D
  }
  await X.DrawCharacterName(sel(), 1, 1, 1);                             // 5000:3586
  DrawText(nameOf(sel()).length + 4, 1, 10, 0, 'Spells ' + s);           // 5000:359c .. 35cc
  return await X.ChooseSpell(flag, index);                               // 5000:35d1
}

// paladin: class 3, or a former paladin whose old level counts
async function isPaladin(c) { return c.b[0x75] === 3 || (c.b[0x114] > 0 && !!(await X.DualClassActive(c))); }

// 5000:35F1 CanLayHands(c)
export async function CanLayHands(c) {
  return (await isPaladin(c)) && G.view_Mode !== 5 && c.b[0x195] === 0 && !(await X.HasEffect(c, 0x8C, { v: null }));   // 5000:35f7 .. 362d
}

// 5000:3656 CanCureDisease(c)
export async function CanCureDisease(c) {
  return (await isPaladin(c)) && G.view_Mode !== 5 && c.b[0x195] === 0 && c.b[0x191] !== 0;   // 5000:365c .. 369f
}

// 5000:36D8 LayOnHands(c)
export async function LayOnHands(c) {
  await X.RedrawCurrentMode();                                           // 5000:36df
  const whom = { v: G.PartyList };                                       // 5000:36e4
  await X.SelectPartyCharacter('Heal whom? ', 1, whom);                  // 5000:36ff
  if (!whom.v) { await DrawCharacterSheet(); return; }                   // 5000:370c / 3714
  const lv = (c.b[0x10C] + c.b[0x114] * ((await X.DualClassActive(c)) ? 1 : 0)) & 0xFF;   // 5000:371b .. 3745
  if (await X.HealCharacter(whom.v, (lv * 2) & 0xFF, 0)) await X.ShowTimedBottomMessage(nameOf(whom.v) + ' feels better');   // 5000:372c / 3777 .. 3791
  else await X.ShowTimedBottomMessage(nameOf(whom.v) + ' is unaffected'); // 5000:3756 .. 3770
  await X.AddEffect(c, 0x8C, 0x5A0, 0, 0);                               // 5000:3796 1440 minutes
  await DrawCharacterSheet();                                            // 5000:37ae
}

// 5000:37EC PaladinCureDisease(c)
export async function PaladinCureDisease(c) {
  await X.RedrawCurrentMode();                                           // 5000:37f3
  const whom = { v: G.PartyList };                                       // 5000:37f8
  await X.SelectPartyCharacter('Cure whom? ', 1, whom);                  // 5000:3813
  if (!whom.v) { await DrawCharacterSheet(); return; }                   // 5000:3820 / 3828
  let diseased = false;                                                  // 5000:382f
  for (let k = 1; k <= 6; k++) if (await X.HasEffect(whom.v, disease(k), { v: null })) diseased = true;   // 5000:383e .. 3866
  let ans = 'Y';                                                         // 5000:3868
  if (!diseased) {                                                       // 5000:386c
    await X.ShowCharacterMessage(whom.v, 'is not diseased', 0, 0);       // 5000:3887
    ans = await AskYesNo('cure anyway: ', 13, 10, 15);                   // 5000:38a1
    await X.ClearCharacterMessage();                                     // 5000:38b2
  }
  if (ans === 'Y') {                                                     // 5000:38b7
    G.cure_InProgress = 1;                                               // 5000:38c0
    for (G.gfx_LoopCounter = 1; G.gfx_LoopCounter <= 6; G.gfx_LoopCounter++)   // 5000:38c5 .. 38ec loop variable = DS:7747
      await X.RemoveEffect(whom.v, disease(G.gfx_LoopCounter), null);
    G.gfx_LoopCounter = 6;                                               // left = 6
    G.cure_InProgress = 0;                                               // 5000:38f3
    if (c.b[0x191] !== 0) c.b[0x191]--;                                  // 5000:38f8 / 3903
    if (!await X.HasEffect(c, 0x8D, { v: null })) await X.AddEffect(c, 0x8D, 0x2760, 0, 1);   // 5000:390b / 3922 10080 minutes
    await X.ShowTimedBottomMessage(nameOf(whom.v) + ' is cured');        // 5000:393a .. 3954
  }
  await DrawCharacterSheet();                                            // 5000:3959
}

// 5000:0000 ov19_LoadDeps / 5000:3963 ov19_init: empty.
