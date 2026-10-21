// game/areas/view_ov28.js — VIEW ov28 (6B00): the view refresh (Pool ov26 A200).
// Owner: cab-build-areas. Source: decode/pseudo/VIEW.pas.md ov28, re-read from decode/listings/ov28.lst (6b00:00cc..01b3):
// no overland branch; a 2D area (Mem[4BE6] = 0) redraws the BIGPIC when view_Redraw is set; in a 3D area the sky colour is
// SkyColours[Mem[4BFD]] (cell attribute <= 7Fh) or SkyColours[Mem[4BFE]]; CGA recomputes the bands from the ECL keys when
// view_RedrawParams is set, EGA only forces backdrop_C3 := 8 (no SetBackdropColours call: C1/C2 keep their values).

import { G } from '../engine/state.js';
import { view, GetCellAttr, SetBackdropColours, Draw3DView } from './view_ov30.js';
import { DrawBigPic } from './view_ov29.js';

const SKY = [0, 15, 4, 11, 13, 2, 9, 14, 0, 15, 4, 11, 13, 2, 9, 14];   // SkyColours DS:0A88 (image)
const skyColour = (k) => (G.ds ? G.ds[(0x0A88 + k) & 0xFFFF] : (SKY[k] ?? 0));   // index > 15 reads the following image bytes

// 6B00:0016 / 004F / 0088 BackdropColour1/2/3 (nested in RefreshView)
function BackdropColour1(k) { return k === 0x08 ? 0 : k === 0x41 ? 0 : k === 0xE8 ? 0x0F : 0x0F; }   // 6b00:0016
function BackdropColour2(k) { return k === 0x08 ? 8 : 7; }                                            // 6b00:004f
function BackdropColour3(k) { return k === 0x0B ? 8 : k === 0x09 ? 6 : k === 0xDB ? 6 : k === 0x06 ? 1 : 6; }   // 6b00:0088

// 6B00:00CC RefreshView
export function RefreshView() {
  if (G.anim_Id === 0x50) G.view_Redraw = 0;                             // 6b00:00cc a full picture is up ('P')
  if (G.PartyDead) return;                                               // 6b00:00de
  if (view.mem(0x4BE6) === 0) {                                          // 6b00:00e8 not a 3D area
    if (G.view_Redraw !== 0) DrawBigPic();                               // 6b00:01a2 / 01a9
  } else {
    G.party_CellAttr = GetCellAttr(G.party_MapX, G.party_MapY);          // 6b00:00f7
    G.backdrop_C0 = skyColour(view.mem(G.party_CellAttr > 0x7F ? 0x4BFE : 0x4BFD));   // 6b00:0107 / 0120
    if (G.VideoMode === 0) {                                             // 6b00:0130 CGA
      if (G.view_RedrawParams !== 0) {                                   // 6b00:0137
        G.backdrop_C1 = BackdropColour1(G.backdrop_Key12);               // 6b00:0143
        G.backdrop_C2 = BackdropColour2(G.backdrop_Key12);               // 6b00:014f
        G.backdrop_C3 = BackdropColour3(G.backdrop_Key3);                // 6b00:015b
        SetBackdropColours(G.backdrop_C0, G.backdrop_C1, G.backdrop_C2, G.backdrop_C3);   // 6b00:0162
      }
    } else G.backdrop_C3 = 8;                                            // 6b00:0177 EGA/Tandy: ground dark grey
    if (view.mem(0x4BFB) !== 0) G.view_AreaMap = 0;                      // 6b00:017e area map not allowed here
    Draw3DView(G.party_MapX, G.party_MapY, G.party_Dir);                 // 6b00:018f
  }
  G.view_Redraw = 0;                                                     // 6b00:01ae
}

// 6B00:0000 ov28_LoadDeps / 6B00:01B7 ov28_init: empty.
