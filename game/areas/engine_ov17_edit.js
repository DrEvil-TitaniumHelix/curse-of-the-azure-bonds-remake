// engine_ov17_edit.js — ENGINE ov17 (4800), the edit half: FreeCharacter, DropCharacterForever, ModifyCharacter (+ nested
// DrawModifyField), AddCharacterMenu, RemovePartyMember, IconEditor (+ nested DrawIconPreview, CopyIconSlot).
// Owner: cab-build-engine. Source: CurseAzureBondsRE decode/pseudo/ENGINE.pas.md ov17; the routines it summarises
// (ModifyCharacter, IconEditor, DrawIconPreview, CopyIconSlot, RemovePartyMember, the AddCharacterMenu checks) are
// translated statement by statement from decode/listings/ov17.lst. Pool twins (structure model): PARTY ov16 part B
// (PoolRadianceRE 85fb6d6 game/areas/party_ov16b.js). Screens: S028 (IconEditor), S029 (Drop), S030 (Add), S031 (Modify).
// Curse record (1A6h): +0 name string[15], +10h+2i max / +11h+2i current ability i (STR INT WIS DEX CON CHA), +1Ch/+1Dh
// exceptional STR current / max, +74h race, +75h class, +78h HP max, +109h+c level in class c, +119h gender, +11Bh
// alignment, +126h id, +12Ch rolled HP, +12Dh spell flag, +141h icon head, +142h icon body, +143h icon slot, +144h icon
// size, +145h..14Ah icon colours, +F7h NPC flag/morale, +F8h, +196h active, +1A4h HP.

import { G, newChar, pstr, setPstr } from '../engine/state.js';
import { DrawText, ClearGlyphRun, ClearRectangle, ShowTimedBottomPrompt, MessageDelay, DrawScreenFrame } from '../engine/text.js';
import { HorizontalMenu, AskYesNo, ClearMenuLine } from '../engine/menus_cab.js';
import { KeyPressed, ReadGameKey } from '../engine/input.js';
import { yieldShort } from '../engine/timer.js';
import { state as pic, FillPictureRect, FlushViewDirtyLines, RecolorPicture } from '../engine/pictures.js';
import { tiles, FreeCombatIcon, DrawIconAt } from '../engine/tiles_cab.js';
import { dev } from '../engine/dev.js';
import { VerticalListMenu, ListItem, FreeMenuList } from './view_ov26.js';
import { X } from './view_link.js';
import { hooks, charSummary } from '../plus/hooks.js';   // GBP W1 (docs/PLUS_HOOKS.md): emit only

const sx8 = (v) => ((v & 0xFF) ^ 0x80) - 0x80;
const lo = (v) => v & 0xFF;
const name = (c) => pstr(c.b, 0);
const ds = (a) => G.ds[a];
const PARTY_COUNT = 0x67C >> 1;                                           // VM word 7F3E in ecl_Mem7C00 (party size)

// 4800:003E FreeCharacter(var c): combatant (16h), item list (3Fh each), effect list (9 each), the 1A6h record; c := nil.
// The JS records are garbage-collected: the visible effect is the nil (and the dropped lists).
export function FreeCharacter(c) {
  const r = c.v;
  if (r) { r.combat = null; r.items = null; r.effects = null; }           // 4800:005f / 0071..00b1 / 00b3..00f3
  c.v = null;                                                             // 4800:0103
}

// 4800:3A56 RemovePartyMember(keepCount, freeIcon): unlink SelectedChar from PartyList, free it, select a neighbour
export async function RemovePartyMember(keepCount, freeIcon) {
  if (!G.PartyList) return;                                               // 4800:3a5c
  let p = G.PartyList;                                                    // 4800:3a68
  if (p === G.SelectedChar) {                                             // 4800:3a79  the head
    if (freeIcon) FreeCombatIcon(G.SelectedChar.b[0x143]);                // 4800:3b21 / 3b31
    G.PartyList = G.SelectedChar.next;                                    // 4800:3b36
    p = G.SelectedChar.next;                                              // 4800:3b48
    const v = { v: G.SelectedChar }; FreeCharacter(v);                    // 4800:3b5f
    G.SelectedChar = p;                                                   // 4800:3b62
    if (!keepCount) G.ecl_Mem7C00[PARTY_COUNT] = (G.ecl_Mem7C00[PARTY_COUNT] - 1) & 0xFFFF;   // 4800:3b6e / 3b78
  } else {
    while (p.next !== G.SelectedChar && p.next) p = p.next;               // 4800:3a88 .. 3abd
    if (p.next) {                                                         // 4800:3abf
      if (freeIcon) FreeCombatIcon(G.SelectedChar.b[0x143]);              // 4800:3ace / 3ade
      p.next = G.SelectedChar.next;                                       // 4800:3ae3
      const v = { v: G.SelectedChar }; FreeCharacter(v);                  // 4800:3b01
      G.SelectedChar = p;                                                 // 4800:3b04  the predecessor
      if (!keepCount) G.ecl_Mem7C00[PARTY_COUNT] = (G.ecl_Mem7C00[PARTY_COUNT] - 1) & 0xFFFF;   // 4800:3b10 / 3b1a
    }
  }
  if (!G.SelectedChar) G.SelectedChar = G.PartyList;                      // 4800:3b7d / 3b86
}

// 4800:260C DropCharacterForever (S029)
export async function DropCharacterForever() {
  if (!G.SelectedChar) return;                                            // 4800:2613
  const c = G.SelectedChar;                                               // 4800:261f
  dev.screenSoon('S029');
  if ((await AskYesNo('Drop ' + name(c) + ' forever? ', 0x0E, 0x0A, 0x0F)) === 'Y') {   // 4800:2656 / 265b
    if ((await AskYesNo('Are you sure? ', 0x0E, 0x0A, 0x0F)) === 'Y') {  // 4800:267b / 2680
      if (c.b[0x196] === 0) await X.ShowTimedBottomMessage('You dump ' + name(c) + ' out back.');   // 4800:2687 / 26b3
      else await X.ShowTimedBottomMessage(name(c) + ' bids you farewell.');   // 4800:26d4
      await X.DeleteCharacterFiles(G.SelectedChar);                       // 4800:26e1
      await RemovePartyMember(0, 1);                                      // 4800:26ed
      return;                                                             // 4800:26f0
    }
  }
  await X.ShowTimedBottomMessage(name(c) + ' breathes a sigh of relief.');   // 4800:270c
  await X.PartySummary(G.SelectedChar);                                   // 4800:2719
}

// 4800:2724 DrawModifyField(highlight) — nested in ModifyCharacter; st.field = parent [BP-37h], st.cursor = parent [BP-3Fh]
async function DrawModifyField(st, highlight) {
  const f = st.field;                                                     // 4800:272e
  if (f >= 0 && f <= 5) await X.DrawAbility(f, highlight);                // 4800:274a
  else if (f === 6) await X.DrawHP(G.SelectedChar, 4, 0x12, highlight);  // 4800:2769
  else if (f === 7) {                                                     // 4800:2771  the name
    const b = G.SelectedChar.b;
    if (highlight) {                                                      // 4800:2779
      ClearGlyphRun(b[0] + 1, 1, 0, 1);                                   // 4800:2796
      DrawText(1, 1, 0x0D, 0, name(G.SelectedChar));                      // 4800:27ad
      if (b[st.cursor] === 0x20) DrawText(st.cursor, 1, 0x0F, 0, '%');    // 4800:27c1 / 27e7  cs:2722 = '%' (cursor glyph)
      else DrawText(st.cursor, 1, 0x0F, 0, String.fromCharCode(b[st.cursor]));   // 4800:281d
    } else DrawText(1, 1, 0x0A, 0, name(G.SelectedChar));                 // 4800:2836
  }
}

// race / class ability limits (DS tables): RaceLimits DS:3F86 [race*16 + k] (STR min +gender, STR max +2+gender, exc max
// +4+gender, INT min/max +6/+7, WIS +8/+9, DEX +0Ah/+0Bh, CON +0Ch/+0Dh, CHA +0Eh/+0Fh), ClassMin DS:4172 [class*6 + i]
const raceLim = (c, k) => ds(0x3F86 + sx8(c.b[0x74]) * 16 + k);
const classMin = (c, i) => ds(0x4172 + sx8(c.b[0x75]) * 6 + i);
const RACE_MIN = [null, 6, 8, 0x0A, 0x0C, 0x0E], RACE_MAX = [null, 7, 9, 0x0B, 0x0D, 0x0F];

// 4800:2868 ModifyCharacter (S031)
export async function ModifyCharacter() {
  let sc = G.SelectedChar;
  const xpLo = sc.b[0x127] | (sc.b[0x128] << 8), xpHi = sc.b[0x129] | (sc.b[0x12A] << 8);
  const xpOk = (xpLo === 0 && xpHi === 0) ||                              // 4800:2873
    (xpHi === 0 && (xpLo === 0x208D || xpLo === 0x30D4 || xpLo === 0x61A8));   // 4800:2883 .. 28bc  8333 / 12500 / 25000
  if (!xpOk || sc.b[0xE6] !== 0) {                                        // 4800:28be
    await ShowTimedBottomPrompt(name(sc) + " can't be modified.", 0x0E, 0);   // 4800:28eb
    return;
  }
  await X.DrawCharacterSheet();                                           // 4800:28f3  stub ov19 e1
  const saved = [];                                                       // [BP-6..-1]
  for (let i = 0; i <= 5; i++) saved[i] = sc.b[0x11 + 2 * i];             // 4800:28f8 .. 291e  current values
  const savedExc = sc.b[0x1C];                                            // 4800:2924
  const savedHp = sc.b[0x78];                                             // 4800:292f
  const savedName = name(sc);                                             // 4800:2945  [BP-31h]
  const st = { field: 7, cursor: 1 };                                     // 4800:294a / 294e
  await DrawModifyField(st, false);                                       // 4800:2957
  st.field = 0;                                                           // 4800:295a
  await DrawModifyField(st, true);                                        // 4800:2963
  const c = G.SelectedChar, b = c.b;                                      // 4800:2966  [BP-44h]
  const restore = async () => {                                           // 4800:338a .. 33f4 / 3402 .. 346c
    for (let i = 0; i <= 5; i++) G.SelectedChar.b[0x11 + 2 * i] = saved[i];
    G.SelectedChar.b[0x1C] = savedExc;
    G.SelectedChar.b[0x78] = savedHp;
    G.SelectedChar.b[0x1A4] = b[0x78];
    setPstr(G.SelectedChar.b, 0, savedName, 15);
    await X.RecalcItems(G.SelectedChar);
  };
  let key, ext;
  for (;;) {
    if (st.field === 7) {                                                 // 4800:2970  name field: raw keys
      while (!KeyPressed()) await yieldShort();                           // 4800:2976
      key = await ReadGameKey();                                          // 4800:297f
      if (key === '\0') { key = await ReadGameKey(); ext = true; }        // 4800:2987 .. 2995
      else ext = false;                                                   // 4800:299b
      if (key === '\x1b') key = '\0';                                     // 4800:299f
    } else {
      dev.screenSoon('S031');
      const r = await HorizontalMenu('Modify: ', 'Keep Exit', 0x0D, 0x0A, 0x0F, true, false);   // 4800:29dd
      key = r.key; ext = r.ext;
    }
    await DrawModifyField(st, false);                                     // 4800:29ea
    if (ext) {                                                            // 4800:29ed
      if (key === 'S') {                                                  // 4800:29f9  Delete: the character under the cursor
        if (st.field === 7 && b[0] > 1) {                                 // 4800:29fd / 2a07
          if (st.cursor === b[0]) { b[0]--; st.cursor = b[0]; }           // 4800:2a14 .. 2a27
          else {
            const last = b[0] - 1;                                        // 4800:2a35
            for (let k = st.cursor; k <= last; k++) b[k] = b[k + 1];      // 4800:2a41 .. 2a6c
            b[0]--;                                                       // 4800:2a72
          }
        }
      } else if (key === 'O') {                                           // 4800:2a78  End: next field
        st.field = lo(st.field + 1); if (st.field > 7) st.field = 0;      // 4800:2a7c
      } else if (key === 'G') {                                           // 4800:2a8c  Home: previous field
        st.field = lo(st.field - 1); if (st.field === 0xFF) st.field = 7; // 4800:2a90
      } else if (key === 'K') {                                           // 4800:2aa0  Left: decrease
        if (st.field < 6) {
          const i = st.field, o = 0x11 + 2 * i;                           // 4800:2ab0
          b[o] = lo(b[o] - 1);                                            // 4800:2ac1
          if (i === 0) {
            if (b[0x1C] > 0) { b[0x1C]--; b[o] = lo(b[o] + 1); }          // 4800:2acf .. 2aeb  exceptional STR first
            else if (b[o] < raceLim(c, sx8(b[0x119]))) b[o] = raceLim(c, sx8(b[0x119]));   // 4800:2af1 .. 2b4d
          } else if (b[o] < raceLim(c, RACE_MIN[i])) b[o] = raceLim(c, RACE_MIN[i]);   // 4800:2ba9 / 2c47 / 2cf9 / 2d97 / 2e7c
          if (b[o] < classMin(c, i)) b[o] = classMin(c, i);               // 4800:2b51 / 2bef / 2c8d / 2d3f / 2ddd / 2ec2
          if (i === 2 && b[0x12D] > 0) b[0x12D] = 1;                      // 4800:2cdb
          if (i === 4) {                                                  // 4800:2e2b  CON: HP within the new maximum
            const mx = await X.MaxHitPoints(G.SelectedChar);
            if (mx < b[0x78]) b[0x78] = await X.MaxHitPoints(G.SelectedChar);   // 4800:2e34 / 2e49
            b[0x1A4] = b[0x78];                                           // 4800:2e5d
            st.field = 6; await DrawModifyField(st, false); st.field = 4; // 4800:2e62 .. 2e6e
          }
        } else if (st.field === 6) {                                      // 4800:2f12  HP
          b[0x78] = lo(b[0x78] - 1);                                      // 4800:2f1b
          if ((await X.MinHitPoints(G.SelectedChar)) > b[0x78]) b[0x78] = await X.MinHitPoints(G.SelectedChar);   // 4800:2f28 / 2f3d
          b[0x1A4] = b[0x78];                                             // 4800:2f51
        } else {                                                          // name: cursor left, wraps to the end
          if (st.cursor === 1) st.cursor = b[0]; else st.cursor--;        // 4800:2f58 / 2f6a
        }
      } else if (key === 'M') {                                           // 4800:2f70  Right: increase
        if (st.field < 6) {
          const i = st.field, o = 0x11 + 2 * i;                           // 4800:2f80
          b[o] = lo(b[o] + 1);                                            // 4800:2f91
          if (i === 0) {
            const g = sx8(b[0x119]);
            if (b[o] > raceLim(c, 2 + g)) {                               // 4800:2fcd
              if (b[o] > 0x12 && (sx8(b[0x10B]) > 0 || sx8(b[0x10C]) > 0 || sx8(b[0x10D]) > 0)   // 4800:2fdf .. 3005  fighter, paladin, ranger
                  && raceLim(c, 4 + g) > b[0x1C]) b[0x1C]++;              // 4800:3029 / 3032
              b[o] = raceLim(c, 2 + g);                                   // 4800:3060
            }
          } else {
            if (b[o] > raceLim(c, RACE_MAX[i])) b[o] = raceLim(c, RACE_MAX[i]);   // 4800:308c / 30d9 / 313a / 318a / 321d
            if (i === 2 && b[0x12D] > 0) b[0x12D] = 1;                    // 4800:30fe
            if (i === 4) {                                                // 4800:31af  quirk: MinHitPoints on increase
              if ((await X.MinHitPoints(G.SelectedChar)) > b[0x78]) b[0x78] = await X.MinHitPoints(G.SelectedChar);   // 4800:31b8 / 31cd
              b[0x1A4] = b[0x78];                                         // 4800:31e1
              st.field = 6; await DrawModifyField(st, false); st.field = 4;   // 4800:31e6 .. 31f2
            }
          }
        } else if (st.field === 6) {                                      // 4800:3244  HP
          b[0x78] = lo(b[0x78] + 1);                                      // 4800:324d
          if ((await X.MaxHitPoints(G.SelectedChar)) < b[0x78]) b[0x78] = await X.MaxHitPoints(G.SelectedChar);   // 4800:325a / 326f
          b[0x1A4] = b[0x78];                                             // 4800:3283
        } else {                                                          // name: cursor right, wraps to 1
          if (st.cursor === b[0]) st.cursor = 1; else st.cursor++;        // 4800:328a / 329c
        }
      }
    } else if (key === '\r') {                                            // 4800:32a2  Enter: next field
      st.field = lo(st.field + 1); if (st.field > 7) st.field = 0;
    } else if (key === '\b') {                                            // 4800:32b9  Backspace in the name
      if (st.cursor > 1 && st.field > 6) {                                // 4800:32bd / 32c3
        const len = b[0];                                                 // 4800:32cd
        for (let k = st.cursor; k <= len; k++) b[k - 1] = b[k];           // 4800:32db .. 3306  quirk: the cursor stays
        b[0]--;                                                           // 4800:330c
        if (st.cursor > b[0]) st.cursor = b[0];                           // 4800:330f / 3322
      }
    } else if (key >= ' ' && key <= 'z') {                                // 4800:3328 / 332f
      if (st.field > 6) {                                                 // 4800:3336  typing into the name
        if (st.cursor <= 0x0F) {                                          // 4800:333c
          b[st.cursor] = key.charCodeAt(0) & 0xFF;                        // 4800:3350
          st.cursor++;                                                    // 4800:3353
          if (st.cursor > 0x0F) st.cursor = 0x0F;                         // 4800:3356
          if (st.cursor > b[0]) { b[0]++; b[st.cursor] = 0x20; }          // 4800:3360 .. 337e
        }
      } else if (key === 'E') { await restore(); return; }                // 4800:3384 .. 33f9  Exit: undo
    } else if (key === '\0') { await restore(); return; }                 // 4800:33fe .. 3471  Esc: undo
    await X.RecalcItems(G.SelectedChar);                                  // 4800:347c
    await X.DrawCombatStats();                                            // 4800:3481
    await DrawModifyField(st, true);                                      // 4800:348b
    if (!ext && key === 'K') break;                                       // 4800:348e / 3497  Keep (quirk: also a typed 'K' in the name)
  }
  // Keep
  await X.WisdomBonusSpells(G.SelectedChar, 1);                           // 4800:34ab
  G.SelectedChar.b[0xF8] = 1;                                             // 4800:34b4
  sc = G.SelectedChar; const sb = sc.b;                                   // 4800:34ba
  let sum = 0, n = 0;                                                     // 4800:34c4 / 34c8
  for (let cls = 0; cls <= 7; cls++) {                                    // 4800:34cc
    const lv = sx8(sb[0x109 + cls]);
    if (lv <= 0) continue;                                                // 4800:34de
    const hdl = ds(0x3EB9 + cls);                                         // HitDiceLevels DS:3EB9
    const adj = sx8(await X.ConHpAdj(cls));
    if (sb[0x109 + cls] < hdl) sum = lo(sum + adj * (cls === 4 ? lv + 1 : lv));   // 4800:3501 .. 3549  ranger: one more die
    else sum = lo(sum + adj * (hdl - 1));                                 // 4800:354e .. 3568
    n++;                                                                  // 4800:356b
  }
  sum = lo(Math.trunc(sx8(sum) / n));                                     // 4800:3577 .. 3586  IDIV
  sb[0x12C] = lo(sb[0x78] - sx8(sum));                                    // 4800:3589 .. 359e  rolled HP without CON
  for (let i = 0; i <= 5; i++) G.SelectedChar.b[0x10 + 2 * i] = G.SelectedChar.b[0x11 + 2 * i];   // 4800:35a3 .. 35d0  max := current
  G.SelectedChar.b[0x1D] = G.SelectedChar.b[0x1C];                        // 4800:35d2
}

// 4800:3680 AddCharacterMenu (S030)
export async function AddCharacterMenu() {
  let evil = 0, paladin = 0, rangers = 0;                                 // 4800:3687 .. 368f  [BP-20h] [BP-21h] [BP-1Fh]
  let paladinName = '';                                                   // [BP-4Ah]
  ClearRectangle(1, 1, 0x26, 0x16);                                       // 4800:369f
  dev.screenSoon('S030');
  const r = await HorizontalMenu('Add from where? ', 'Curse Pool Hillsfar Exit', 0x0D, 0x0A, 0x0F, false, false);   // 4800:36d6
  let key = r.key;
  if (key === 'C') G.ImportSource = 0;                                    // 4800:36e1
  else if (key === 'P') G.ImportSource = 1;                               // 4800:36ec
  else if (key === 'H') G.ImportSource = 2;                               // 4800:36f7
  else if (key === 'E' || key === '\0') return;                           // 4800:3702
  const names = { v: null }, files = { v: null };
  await X.BuildCharacterFileList(names, files);                           // 4800:3717
  if (!names.v) return;                                                   // 4800:371c
  const index = { v: 0 }, item = { v: names.v }, redraw = { v: true };    // 4800:3727 .. 3737
  const showExit = 0;                                                     // TODO(decode): [BP-1Ch] is never initialised (stack garbage); 0 assumed
  let pcCount = 0;                                                        // [BP-1Eh]
  do {
    key = await VerticalListMenu('Add a character: ', 'Add ', 0x0D, 0x0A, 0x0F, 1, 2, 0x26, 0x16, names.v, showExit, redraw, index, item);   // 4800:3787
    if ((key === '\r' || key === 'A') && item.v && item.v.text[0] !== '*') {   // 4800:378f .. 37a6
      ClearMenuLine();                                                    // 4800:37ab
      const nc = newChar();                                               // 4800:37b9  GetMem($1A6)
      await X.ReadCharacter(ListItem(files.v, index.v).text, nc, 0, 1);   // 4800:37c7 / 37e3
      hooks.emit('characterImported', () => ({ source: G.ImportSource ?? 0, from: ['curse', 'pool', 'hillsfar'][G.ImportSource ?? 0], file: ListItem(files.v, index.v).text, ...charSummary(nc, 0) }));   // cab: PER-8 (read for Add, before the party checks)
      item.v.text = ('* ' + item.v.text).substring(0, 40);                // 4800:37e8 .. 380b  marked before the checks
      pcCount = 0;                                                        // 4800:3810
      if (!G.PartyList) {                                                 // 4800:3814
        G.ecl_Mem7C00[PARTY_COUNT] = 0;                                   // 4800:3823
        await X.AddToParty(nc);                                           // 4800:382e
        await X.LoadCharacterIcon(1);                                     // 4800:3836
      } else {
        let p = G.PartyList;                                              // 4800:383e
        rangers = 0;                                                      // 4800:384a  (evil / paladin are not reset: quirk, sticky)
        while (p && !(name(p) === name(nc) && p.b[0x126] === nc.b[0x126])) {   // 4800:384e .. 387a  same name and id = already in
          if (p.b[0xF7] < 0x80) pcCount++;                                // 4800:387f
          if (sx8(p.b[0x10D]) > 0) rangers++;                             // 4800:388d
          if ((sx8(p.b[0x11B]) + 1) % 3 === 0) evil = 1;                  // 4800:389b .. 38ad  LE / NE / CE
          if (sx8(p.b[0x10C]) > 0) { paladin = 1; paladinName = name(p); }   // 4800:38b4 .. 38ce
          p = p.next;                                                     // 4800:38d3
        }
        const newEvil = (sx8(nc.b[0x11B]) + 1) % 3 === 0;
        const ok = !p &&                                                  // 4800:38e6
          ((nc.b[0xF7] < 0x80 && pcCount < 6) || (nc.b[0xF7] > 0x7F && G.ecl_Mem7C00[PARTY_COUNT] < 8)) &&   // 4800:38f1 .. 3917
          (nc.b[0x10C] === 0 || !evil) &&                                 // 4800:391c / 3924
          (nc.b[0x10D] === 0 || rangers < 3) &&                           // 4800:392d / 3935
          (!newEvil || !paladin);                                         // 4800:393e .. 3954
        if (ok) {
          await X.AddToParty(nc);                                         // 4800:395c
          await X.LoadCharacterIcon(1);                                   // 4800:3964
          if (nc.b[0xF7] < 0x80) pcCount++;                               // 4800:396c / 3974
        } else {
          item.v.text = item.v.text.substring(2);                         // 4800:3987  Delete(text, 1, 2): the mark again
          if (sx8(nc.b[0x10C]) > 0 && evil) {                             // 4800:398f / 3997
            await X.ShowTimedBottomMessage('paladins do not join with evil scum');   // 4800:39ac
            await MessageDelay();                                         // 4800:39b1
          } else if (sx8(nc.b[0x10D]) > 0 && rangers > 2)                 // 4800:39bb / 39c3
            await X.ShowTimedBottomMessage('too many rangers in party');  // 4800:39d8
          else if (newEvil && paladin)                                    // 4800:39df .. 39f8
            await X.ShowTimedBottomMessage(paladinName + ' will tolerate no evil!');   // 4800:3a14
          // 4800:3a22 FreeMem(nc, $1A6)
        }
      }
    }
  } while (!(key === 'E' || key === '\0' || pcCount > 5 || G.ecl_Mem7C00[PARTY_COUNT] > 7));   // 4800:3a27 .. 3a43
  FreeMenuList(names);                                                    // 4800:3a4d  quirk: the file-name list is not freed
}

// ---- icon editor ----------------------------------------------------------------------------------------------------

// 4800:3B99 DrawIconPreview(col, row) — nested in IconEditor
function DrawIconPreview(col, row) {
  const cga = G.ds.subarray(0x25A2, 0x25AA);                              // DS:25A2 CGA map
  if (G.VideoMode === 0) FillPictureRect(col * 3, row * 24, 0x0C, 0x18, 3, cga, pic.viewPic);   // 4800:3b9c / 3bd1
  else {
    FillPictureRect(col * 3, row * 24, 0x0C, 0x18, 0, cga, pic.viewPic);  // 4800:3c06
    DrawIconAt(col, row, 0, 0, 0x19);                                     // 4800:3c1c
    DrawIconAt(col + 3, row, 0, 1, 0x19);                                 // 4800:3c37
  }
  DrawIconAt(col, row, 0, 0, 0x0C);                                       // 4800:3c4d  ready
  DrawIconAt(col + 3, row, 0, 1, 0x0C);                                   // 4800:3c68  action
  FlushViewDirtyLines();                                                  // 4800:3c6d
}

// 4800:3C78 CopyIconSlot(src, dst, recolour) — nested in IconEditor: pixels + mask of both poses (dst geometry), then
// optionally the 6 colour slots of SelectedChar applied to dst
function CopyIconSlot(src, dst, recolour) {
  const s = tiles.icons[src] || [], d = tiles.icons[dst] || [];
  for (let k = 0; k <= 1; k++) {                                          // 4800:3c7e .. 3d77
    if (!s[k] || !d[k]) continue;
    d[k].px.set(s[k].px.subarray(0, d[k].px.length));
    if (d[k].mask && s[k].mask) d[k].mask.set(s[k].mask.subarray(0, d[k].mask.length));
  }
  if (recolour) {                                                         // 4800:3d7c
    const c = G.SelectedChar;                                             // 4800:3d85
    const from = [], to = [];
    for (let k = 0; k <= 15; k++) { from[k] = k; to[k] = k; }             // 4800:3d8f .. 3db6
    for (let i = 1; i <= 6; i++) {                                        // 4800:3db8
      const slot = ds(0x3EC0 + i);                                        // IconColourSlot DS:3EC0+i = 1 2 3 4 6 7
      to[slot] = c.b[0x144 + i] & 0x0F;                                   // 4800:3dc1 .. 3de3
      to[slot + 8] = (c.b[0x144 + i] & 0xF0) >> 4;                        // 4800:3de6 .. 3e12
    }
    if (d[0]) RecolorPicture(from, to, 0, 0, d[0]);                       // 4800:3e3e
    if (d[1]) RecolorPicture(from, to, 0, 0, d[1]);                       // 4800:3e66
  }
}

// IconMenu[k] (DS:0721 + k*29h, string[40]) lives in the DS image and is edited in place (quirk: keeps 'Hair' / 'Face')
const iconMenu = (k) => { const o = 0x721 + k * 0x29; let s = ''; for (let i = 1; i <= G.ds[o]; i++) s += String.fromCharCode(G.ds[o + i]); return s; };
function setIconMenu(k, s) {
  const o = 0x721 + k * 0x29; s = s.substring(0, 40);
  G.ds[o] = s.length; for (let i = 0; i < s.length; i++) G.ds[o + 1 + i] = s.charCodeAt(i) & 0xFF;
}
const replaceAt13 = (s, w) => { const d = s.slice(0, 12) + s.slice(16); return (d.slice(0, 12) + w + d.slice(12)).substring(0, 40); };   // Delete(s, 0Dh, 4); Insert(w, s, 0Dh)
const exitKey = (k) => k === '\0' || k === 'E';                          // set cs:3EB1 = [#0, 'E']

// 4800:3EE3 IconEditor (S028)
export async function IconEditor() {
  DrawScreenFrame();                                                      // 4800:3eea
  await X.PaletteFlashOn();                                               // 4800:3eef
  do {
    await X.LoadCharacterIcon(0);                                         // 4800:3ef7
    const c = G.SelectedChar, b = c.b;                                    // 4800:3efc  [BP-1Fh]
    let state = 1;                                                        // 4800:3f06  [BP-8]
    const cColours = Array.from(b.subarray(0x145, 0x14B));                // 4800:3f1c  [BP-15h]
    const savedSlot = b[0x143]; b[0x143] = 0x0C;                          // 4800:3f29 / 3f2f
    await X.LoadCharacterIcon(0);                                         // 4800:3f38  the same icon into slot 12
    b[0x143] = savedSlot;                                                 // 4800:3f43
    let cHead = b[0x141], cBody = b[0x142], cSize = b[0x144];             // 4800:3f50 / 3f5b / 3f66
    CopyIconSlot(b[0x143], 0x0C, 1);                                      // 4800:3f7a
    DrawIconPreview(1, 2);                                                // 4800:3f85  "old"
    DrawText(8, 6, 0x0F, 0, 'old');                                       // 4800:3fa3
    DrawText(3, 0x0A, 0x0F, 0, 'ready   action');                         // 4800:3fc3
    DrawText(8, 0x0C, 0x0F, 0, 'new');                                    // 4800:3fe3
    DrawText(3, 0x10, 0x0F, 0, 'ready   action');                         // 4800:4003
    let prev = 1, part = ' ', slot = 1, hiNib = 0, key;                   // [BP-1Ah] [BP-1Bh] [BP-16h] [BP-17h]
    do {
      DrawIconPreview(1, 4);                                              // 4800:4010  "new"
      let sizeStr = '';                                                   // 4800:4013
      if (state === 4) sizeStr = b[0x144] === 2 ? 'Small' : 'Large';     // 4800:4017 .. 404b
      dev.screenSoon('S028');
      const r = await HorizontalMenu('', sizeStr + iconMenu(state), 0x0D, 0x0A, 0x0F, false, false);   // 4800:4050 .. 409a
      key = r.key;
      if (!r.ext) {                                                       // 4800:40a2
        switch (state) {
          case 1:                                                         // 4800:40ab
            prev = 1;                                                     // 4800:40b8
            if (key === 'P') state = 2;                                   // 4800:40bf
            else if (key === '1') {                                       // 4800:40ca
              if (G.VideoMode === 0) await ShowTimedBottomPrompt('Sorry, not in CGA', 0x0E, 0);   // 4800:40ce / 40ea
              else { state = 3; hiNib = 0; setIconMenu(3, replaceAt13(iconMenu(3), 'Hair')); }   // 4800:40f1 .. 411d
            } else if (key === '2') {                                     // 4800:4124
              if (G.VideoMode === 0) await ShowTimedBottomPrompt('Sorry, not in CGA', 0x0E, 0);   // 4800:4128 / 4144
              else { state = 3; hiNib = 1; setIconMenu(3, replaceAt13(iconMenu(3), 'Face')); }   // 4800:414b .. 4177
            } else if (key === 'S') state = 4;                            // 4800:417e
            break;
          case 2:                                                         // 4800:4189  Parts: Head / Weapon
            prev = 2;                                                     // 4800:418e
            if (exitKey(key)) state = 1;                                  // 4800:419b
            else { part = key; state = 5; }                               // 4800:41a8
            break;
          case 3:                                                         // 4800:41b5  colour part
            prev = 3;                                                     // 4800:41ba
            switch (key) {
              case 'W': slot = 6; break; case 'B': slot = 1; break; case 'H': case 'F': slot = 4; break;   // 4800:41c1 .. 41e3
              case 'S': slot = 5; break; case 'A': slot = 2; break; case 'L': slot = 3; break;   // 4800:41e9 .. 4201
              default: slot = 1;                                          // 4800:4207
            }
            state = exitKey(key) ? 1 : 5;                                 // 4800:420b .. 4221
            break;
          case 4:                                                         // 4800:4228  size
            if (key === 'L') { b[0x144] = 2; await X.LoadCharacterIcon(0); }   // 4800:4230 .. 4240
            else if (key === 'S') { b[0x144] = 1; await X.LoadCharacterIcon(0); }   // 4800:4247 .. 4257
            else if (key === 'K') { cSize = b[0x144]; state = 1; key = ' '; }   // 4800:425e .. 4271
            else if (exitKey(key)) { b[0x144] = cSize; state = 1; key = ' '; }   // 4800:4277 .. 428e
            await X.LoadCharacterIcon(0);                                 // 4800:4295
            break;
          case 5:                                                         // 4800:429d
            if (prev === 2) {                                             // 4800:42a5
              if (part === 'H') {                                         // 4800:42b2  head 0..13
                if (key === 'P') { if (b[0x141] > 0) b[0x141]--; else b[0x141] = 0x0D; }   // 4800:42bc
                else if (key === 'N') { if (b[0x141] < 0x0D) b[0x141]++; else b[0x141] = 0; }   // 4800:42e3
                else if (key === 'K') { cHead = G.SelectedChar.b[0x141]; state = prev; key = ' '; }   // 4800:4307
                else if (exitKey(key)) { b[0x141] = cHead; state = prev; key = ' '; }   // 4800:432c
                await X.LoadCharacterIcon(0);                             // 4800:434c
              } else if (part === 'W') {                                  // 4800:4354  weapon / body 0..31
                if (key === 'P') { if (b[0x142] > 0) b[0x142]--; else b[0x142] = 0x1F; }   // 4800:435b
                else if (key === 'N') { if (b[0x142] < 0x1F) b[0x142]++; else b[0x142] = 0; }   // 4800:4382
                else if (key === 'K') { cBody = G.SelectedChar.b[0x142]; state = prev; key = ' '; }   // 4800:43a6
                else if (exitKey(key)) { b[0x142] = cBody; state = prev; key = ' '; }   // 4800:43cb
                await X.LoadCharacterIcon(0);                             // 4800:43eb
              }                                                           // quirk: another part (Space) has no handler
            } else if (prev === 3) {                                      // 4800:43f3  browse a colour nibble
              const o = 0x144 + slot;
              let l = b[o] & 0x0F, h = (b[o] & 0xF0) >> 4;                // 4800:43fb .. 4427
              if (key === 'N') {                                          // 4800:442a
                if (hiNib) h = (h + 1) % 16; else l = (l + 1) % 16;       // 4800:4431 .. 4456
                b[o] = lo((h << 4) + l);                                  // 4800:4459 .. 4478
              } else if (key === 'P') {                                   // 4800:4480
                if (hiNib) h = (h - 1) & 0x0F; else l = (l - 1) & 0x0F;   // 4800:4484 .. 44a1
                b[o] = lo((h << 4) + l);                                  // 4800:44a4 .. 44c3
              } else if (key === 'K') {                                   // 4800:44ca  keep: the colours become the saved set
                for (let i = 0; i < 6; i++) cColours[i] = b[0x145 + i];   // 4800:44e0
                state = prev; key = ' ';                                  // 4800:44e5 / 44eb
              } else if (exitKey(key)) {                                  // 4800:44f1
                for (let i = 0; i < 6; i++) b[0x145 + i] = cColours[i];   // 4800:450b
                state = prev; key = ' ';                                  // 4800:4510 / 4516
              }
            }
            break;
        }
      }
      CopyIconSlot(b[0x143], 0x0C, 1);                                    // 4800:452b
    } while (!(prev === 1 && exitKey(key)));                              // 4800:452e / 4540
    b[0x141] = cHead; b[0x142] = cBody; b[0x144] = cSize;                 // 4800:454a .. 4566
    for (let i = 0; i < 6; i++) b[0x145 + i] = cColours[i];               // 4800:457d
    CopyIconSlot(b[0x143], 0x0C, 1);                                      // 4800:4593
    CopyIconSlot(0x0C, b[0x143], 0);                                      // 4800:45a7
    ClearMenuLine();                                                      // 4800:45aa
    FreeCombatIcon(0x0C);                                                 // 4800:45b2
  } while ((await AskYesNo('Is this icon ok? ', 0x0D, 0x0A, 0x0F)) !== 'Y');   // 4800:45cf / 45d7
  await X.PaletteFlashOff();                                              // 4800:45e0
}
