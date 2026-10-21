// game/areas/view_ov14.js — VIEW ov14 (3F00): party movement, doors, the 3D command loop (Pool ov14 6600).
// Owner: cab-build-areas. Source: decode/pseudo/VIEW.pas.md ov14 (screens VIEW-01/02/02a/03). Caution rule 2: the menu
// loops re-read from decode/listings/ov14.lst:
//  - ExploreCommand (3f00:090a): HorizontalMenu('', DS:03D6 'Area Cast View Encamp Search Look', 0Dh, 0Ah, 0Fh,
//    allowExt 1, animate 0, var ext); 'S' sets the search bit with OR 1 (Mem[7ECA] := Mem[7ECA] or 1, 3f00:0a1f — not a
//    toggle); 'L' ORs 2, AdvanceClock(1, 2), ecl_PC := ecl_VecB, done; with view_Mode <> 4 the loop is skipped and the
//    returned key is an uninitialised local (#0 here).
//  - MoveParty (3f00:0baf): the door menu is HorizontalMenu('Locked. ', opts, 0Dh, 0Ah, 0Fh, 0, 0, var ext); in the
//    wizard-locked state ' Pick' is offered on the same test (door_CanPick and a thief) but 'P' only clears door_CanPick.
//  - TryWalkOffMap (3f00:078e): clamps to the edge only when the square ahead is outside 0..15 (Mem[7ED5] := 1).
// ECL cells: Mem[7EC9] (block the next move), Mem[7ECA] (bit 0 search, bit 1 look), Mem[7ED5] (left the map), Mem[4BFB]
// (area map not allowed). Character fields: +11h str, +1Ch str_exc, +1Eh.. memorised spells (84), +EBh thief skill 1
// (open locks), +109h levels, +111h previous-class levels, +189h next, +195h status.

import { G } from '../engine/state.js';
import { ShowTimedBottomPrompt, ClearRectangle } from '../engine/text.js';
import { FreePicture } from '../engine/pictures.js';
import { PlayOrStopSound } from '../engine/audio_cab.js';
import { Delay } from '../engine/timer.js';
import { ParamStr } from '../engine/tp.js';
import { setPointerRegion, clearPointerRegion, KEY } from '../engine/input.js';
import { hooks } from '../plus/hooks.js';   // GBP W1 (docs/PLUS_HOOKS.md)
import { view, DX, DY, sx8, GetPassage, GetWallType, GetCellAttr, Draw3DView } from './view_ov30.js';
import { HorizontalMenu, menu } from './view_ov26.js';
import { FreeAnimation } from './view_ov29.js';
import { X } from './view_link.js';

const mem = (a) => view.mem(a), setMem = (a, v) => view.setMem(a, v);
const charName = (c) => { let s = ''; for (let i = 1; i <= c.b[0]; i++) s += String.fromCharCode(c.b[i]); return s; };
const pstrDS = (a) => { if (!G.ds) return ''; let s = ''; for (let i = 1; i <= G.ds[a]; i++) s += String.fromCharCode(G.ds[a + i]); return s; };

// 3F00:003E ClosePassage(x, y, dir): empty in Curse
export function ClosePassage(x, y, dir) {}                               // 3f00:0046 RETF 6

// 3F00:0153 OpenPassage(x, y, dir)
export function OpenPassage(x, y, dir) {
  x = sx8(x); y = sx8(y);
  if (x < 0 || x > 15 || y < 0 || y > 15) return;
  const i = 0x300 + y * 16 + x, m = view.map;
  switch (dir) {                                                         // 3f00:016e .. 0284
    case 6: m[i] = (m[i] & 0x3F) | 0x40; break;
    case 4: m[i] = (m[i] & 0xCF) | 0x10; break;
    case 2: m[i] = (m[i] & 0xF3) | 0x04; break;
    case 0: m[i] = (m[i] & 0xFC) | 0x01; break;
  }
}

// 3F00:0288 PartyHasClass(cls)
export async function PartyHasClass(cls) {
  for (let c = G.PartyList; c; c = c.next) {
    if (c.b[0x109 + cls] > 0) return true;                               // 3f00:02b3
    if (c.b[0x111 + cls] > 0 && await X.DualClassActive(c)) return true; // 3f00:02c4 / 02d4
  }
  return false;
}

// 3F00:0302 BashDoor
export async function BashDoor() {
  let ok = false;
  for (let c = G.PartyList; c && !ok; c = c.next) {
    const str = c.b[0x11], exc = c.b[0x1C];
    if (GetPassage(G.party_MapX, G.party_MapY, G.party_Dir) === 3) {     // 3f00:0335 wizard-locked
      switch (str) {
        case 18:
          if (exc >= 91 && exc <= 99) ok = await X.Roll(1, 6) === 1;     // 3f00:036e
          else if (exc === 100) ok = await X.Roll(1, 6) < 3;             // 3f00:0388
          else G.door_CanBash = 0;
          break;
        case 19: case 20: ok = await X.Roll(1, 6) < 4; break;            // 3f00:03af
        case 21: case 22: ok = await X.Roll(1, 6) < 5; break;            // 3f00:03ce
        case 23: ok = await X.Roll(1, 6) < 6; break;                     // 3f00:03e8
        case 24: ok = await X.Roll(1, 8) < 8; break;                     // 3f00:0402
        case 25: ok = true; break;
        default: G.door_CanBash = 0;
      }
    } else {
      switch (str) {
        case 3: case 4: case 5: case 6: case 7: ok = await X.Roll(1, 6) === 1; break;   // 3f00:043d
        case 8: case 9: case 10: case 11: case 12: case 13: case 14: case 15: ok = await X.Roll(1, 6) < 3; break;   // 3f00:045d
        case 16: case 17: ok = await X.Roll(1, 6) < 4; break;            // 3f00:047d
        case 18:
          if (exc < 51) ok = await X.Roll(1, 6) < 4;                     // 3f00:04ab
          else if (exc < 100) ok = await X.Roll(1, 6) < 5;               // 3f00:04ca
          else ok = await X.Roll(1, 6) < 6;                              // 3f00:04e4
          break;
        case 19: case 20: ok = await X.Roll(1, 8) < 8; break;            // 3f00:0503
        case 21: ok = await X.Roll(1, 10) < 10; break;                   // 3f00:051d
        case 22: case 23: ok = await X.Roll(1, 12) < 12; break;          // 3f00:053c
        case 24: ok = await X.Roll(1, 20) < 20; break;                   // 3f00:0556
        case 25: ok = true; break;                                       // 3f00:0570
      }
    }
  }
  if (ok) {
    OpenPassage(G.party_MapX, G.party_MapY, G.party_Dir);                // 3f00:058d
    OpenPassage(sx8(G.party_MapX) + DX[G.party_Dir], sx8(G.party_MapY) + DY[G.party_Dir], (G.party_Dir + 4) % 8);   // 3f00:059d
  }
  return ok;
}

// 3F00:05E8 PickLock
export async function PickLock() {
  let ok = false;
  for (let c = G.PartyList; c && !ok; c = c.next) {                      // 3f00:05fe
    if (await X.Roll(1, 100) <= c.b[0xEB] && c.b[0x195] === 0) ok = true;   // 3f00:061b .. 0635
  }
  G.door_CanPick = 0;                                                    // 3f00:064b
  if (ok) {
    OpenPassage(G.party_MapX, G.party_MapY, G.party_Dir);                // 3f00:0663
    OpenPassage(sx8(G.party_MapX) + DX[G.party_Dir], sx8(G.party_MapY) + DY[G.party_Dir], (G.party_Dir + 4) % 8);   // 3f00:06a1
  }
  return ok;
}

// 3F00:06B1 FindMemorizedSpell(spell, c): slot 0..83 of c^.mem_spell[] (+1Eh) or FFh
export function FindMemorizedSpell(spell, c) {
  for (let i = 0; i <= 83; i++) if (c.b[0x1E + i] === spell) return i;  // 3f00:06bb .. 06e7
  return 0xFF;
}
// 3F00:06F4 FindCasterOf(spell): first member with the spell memorised, else nil
export function FindCasterOf(spell) {
  for (let c = G.PartyList; c; c = c.next) if (FindMemorizedSpell(spell, c) !== 0xFF) return c;   // 3f00:0719
  return null;
}
// 3F00:0749 CastKnock
export function CastKnock() {
  const c = FindCasterOf(0x1F);                                          // 3f00:0753
  if (!c) return false;
  c.b[0x1E + FindMemorizedSpell(0x1F, c)] = 0;                           // 3f00:076e / 0776
  return true;
}

// 3F00:078E TryWalkOffMap
export function TryWalkOffMap() {
  let x = sx8(G.party_MapX), y = sx8(G.party_MapY);
  const d = G.party_Dir;
  setMem(0x7ED5, 0);                                                     // 3f00:07aa
  if (GetPassage(x, y, d) !== 0) {                                       // 3f00:07c1
    x += DX[d]; y += DY[d];
    if (x > 15) { G.party_MapX = 15; setMem(0x7ED5, 1); }                // 3f00:07e0
    if (x < 0) { G.party_MapX = 0; setMem(0x7ED5, 1); }                  // 3f00:07f6
    if (y > 15) { G.party_MapY = 15; setMem(0x7ED5, 1); }                // 3f00:080c
    if (y < 0) { G.party_MapY = 0; setMem(0x7ED5, 1); }                  // 3f00:0822
  }
}

// 3F00:083C StepForward3D
export async function StepForward3D() {
  await PlayOrStopSound(G.ds ? G.ds[0x25C0] | (G.ds[0x25C1] << 8) : 0);                                     // 3f00:083f
  await Delay(50);                                                       // 3f00:0848
  let x = sx8(G.party_MapX + DX[G.party_Dir]), y = sx8(G.party_MapY + DY[G.party_Dir]);   // 3f00:0851 / 0860
  if (x < 0) x = 15; if (x > 15) x = 0;                                  // 3f00:086f / 087b
  if (y < 0) y = 15; if (y > 15) y = 0;                                  // 3f00:0887 / 0893
  const fromX = G.party_MapX, fromY = G.party_MapY;                      // Plus: the square left (plus request #3)
  G.party_MapX = x; G.party_MapY = y;
  G.party_Ahead = GetWallType(x, y, G.party_Dir);                        // 3f00:08ab
  G.door_CanBash = 1; G.door_CanPick = 1; G.door_CanKnock = 1;           // 3f00:08bf FillChar(door_CanBash, 3, 1)
  G.party_CellAttr = GetCellAttr(x, y);                                  // 3f00:08cc
  if ((mem(0x7ECA) & 1) !== 0) await X.AdvanceClock(1, 2);               // 3f00:08ea search mode costs more
  else await X.AdvanceClock(1, 1);                                       // 3f00:08f7
  hooks.emit('moved', () => ({ ...hooks.state.position(), from: { x: fromX, y: fromY }, stepped: true }));
}

// 3F00:090A ExploreCommand: the 3D command prompt; returns the last key
export async function ExploreCommand() {
  setMem(0x7EC9, 0);                                                     // 3f00:0911
  let key = '\0';
  if (G.view_Mode === 4) {                                               // 3f00:091c
    let done = false;                                                    // 3f00:0926
    // pointer layer: left third of the view = turn left, centre = step, right third = turn right (Pool's mouse layer)
    setPointerRegion('view', { x1: 24, y1: 24, x2: 111, y2: 111, prio: 3,
      keysAt: (x) => (x < 53 ? [KEY.left] : x < 83 ? [KEY.up] : [KEY.right]) });
    do {
      menu.abortWhen = hooks.safePointWanted;                            // Plus (plus request #12): a pending quick load ends the wait
      const m = await HorizontalMenu('', pstrDS(0x03D6) || 'Area Cast View Encamp Search Look', 0x0D, 0x0A, 0x0F, true, false);   // 3f00:0952
      menu.abortWhen = null;
      if (m.aborted) { key = ' '; break; }                               //   (never in original mode: abortWhen is false with Plus off)
      key = m.key;
      if (!m.ext) {
        switch (key) {
          case 'A':                                                      // 3f00:0963
            if (mem(0x4BFB) === 0 || ParamStr(2) === (G.CopyProtWord ?? 'Wooden')) {   // 3f00:096e / 098a (CopyProtWord g_8C80 = 'Wooden', RESIDENT 097D:0000)
              G.view_AreaMap = G.view_AreaMap === 0 ? 1 : 0;             // 3f00:0991 .. 099e
              Draw3DView(G.party_MapX, G.party_MapY, G.party_Dir);       // 3f00:09ad
            } else await ShowTimedBottomPrompt('Not Here', 0x0E, 0);     // 3f00:09ca
            break;
          case 'C':                                                      // 3f00:09d2
            if (G.SelectedChar && G.SelectedChar.b[0x195] === 0) { G.menu_Sel = 1; await X.CastMenu(); }   // 3f00:09da / 09e7
            break;
          case 'V': { G.menu_Sel = 1; const v = { v: null }; await X.ViewMenu(v); break; }   // 3f00:09f2 / 09fc
          case 'E': done = true; G.menu_Sel = 1; break;                  // 3f00:0a07
          case 'S': setMem(0x7ECA, mem(0x7ECA) | 1); break;              // 3f00:0a16 .. 0a26
          case 'L':                                                      // 3f00:0a2d
            setMem(0x7ECA, mem(0x7ECA) | 2);                             // 3f00:0a41
            await X.AdvanceClock(1, 2);                                  // 3f00:0a4c
            view.setEclPC(view.vecB());                                  // 3f00:0a54 ecl_PC := ecl_VecB
            done = true;
            break;
        }
      } else {
        const c = key.charCodeAt(0);
        if (c === 0x48) { TryWalkOffMap(); done = true; }                // 3f00:0a65 Up
        else if (c === 0x50) {                                           // 3f00:0a74 Down
          G.party_Dir = (G.party_Dir + 4) % 8;
          hooks.emit('moved', () => ({ ...hooks.state.position(), from: { x: G.party_MapX, y: G.party_MapY }, stepped: false, turned: 4 }));   // Plus (plus request #3)
          G.party_Ahead = GetWallType(G.party_MapX, G.party_MapY, G.party_Dir);   // 3f00:0a92
          Draw3DView(G.party_MapX, G.party_MapY, G.party_Dir);           // 3f00:0aa6
        } else if (c === 0x4B || c === 0x4D) {                           // 3f00:0ab2 Left / 3f00:0af8 Right
          G.party_Dir = (G.party_Dir + (c === 0x4B ? 6 : 2)) % 8;
          hooks.emit('moved', () => ({ ...hooks.state.position(), from: { x: G.party_MapX, y: G.party_MapY }, stepped: false, turned: c === 0x4B ? 6 : 2 }));   // Plus (plus request #3)
          await PlayOrStopSound(G.ds ? G.ds[0x25C0] | (G.ds[0x25C1] << 8) : 0);                             // 3f00:0ac8 / 0b0e
          G.party_Ahead = GetWallType(G.party_MapX, G.party_MapY, G.party_Dir);   // 3f00:0ad9 / 0b1f
          Draw3DView(G.party_MapX, G.party_MapY, G.party_Dir);           // 3f00:0aed / 0b33
        } else {
          await X.CycleSelectedChar(key);                                // 3f00:0b3e
          await X.PartySummary(G.SelectedChar);                          // 3f00:0b4b
        }
      }
      await X.DrawLocationTimeStatus();                                  // 3f00:0b50
    } while (!done);
    clearPointerRegion('view');
  }
  if (G.text_Cleared === 0) { ClearRectangle(1, 0x11, 0x26, 0x16); G.text_Cleared = 1; }   // 3f00:0b64 / 0b77
  return key;
}

// 3F00:0BAF MoveParty
export async function MoveParty() {
  let moved = false;
  if (G.view_Mode === 4) {                                               // 3f00:0bba
    if (mem(0x7EC9) < 0xFF) {                                            // 3f00:0bc4
      G.view_Redraw = 1;                                                 // 3f00:0bd4
      const p = GetPassage(G.party_MapX, G.party_MapY, G.party_Dir);     // 3f00:0be5
      if (p === 1) moved = true;                                         // 3f00:0bf1
      else if (p === 2 || p === 3) {                                     // 3f00:0c00 / 0d40
        let opts = '';
        if (G.door_CanBash !== 0) opts = 'Bash';                         // 3f00:0c04
        if (G.door_CanPick !== 0 && await PartyHasClass(6)) opts += ' Pick';   // 3f00:0c1e / 0c29
        if (G.door_CanKnock !== 0 && FindCasterOf(0x1F)) opts += ' Knock';     // 3f00:0c58 / 0c63
        opts += ' Exit';                                                 // 3f00:0ca2
        if (opts === ' Exit') ClosePassage(G.party_MapX, G.party_MapY, G.party_Dir);   // 3f00:0cc4 / 0cd8
        else {
          const k = (await HorizontalMenu('Locked. ', opts, 0x0D, 0x0A, 0x0F, false, false)).key;   // 3f00:0d05 / 0e45
          if (k === 'B') moved = await BashDoor();                       // 3f00:0d15 / 0e55
          else if (k === 'P') { if (p === 2) moved = await PickLock(); else G.door_CanPick = 0; }   // 3f00:0d22 / 0e61
          else if (k === 'K') moved = CastKnock();                       // 3f00:0d2f / 0e6d
        }
      }
      if (moved) await StepForward3D();                                  // 3f00:0e7a
      await X.DrawLocationTimeStatus();                                  // 3f00:0e7d
    } else setMem(0x7EC9, 0);                                            // 3f00:0e84
  }
  FreeAnimation(G.enc_Anim);                                             // 3f00:0e94
  G.head_Pic = FreePicture(G.head_Pic) ?? null; G.body_Pic = FreePicture(G.body_Pic) ?? null;   // 3f00:0e9e / 0ea8
  G.head_Id = 0xFF; G.body_Id = 0xFF;                                    // 3f00:0ead / 0eb2
}

// 3F00:0000 ov14_LoadDeps / 3F00:0EBB ov14_init: empty.
