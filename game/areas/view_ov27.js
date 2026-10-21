// game/areas/view_ov27.js — VIEW ov27 (6A00): the BIGPIC 121 city overlay animation (no Pool twin; screen VIEW-13).
// Owner: cab-build-areas. Source: decode/pseudo/VIEW.pas.md ov27. Called only by HorizontalMenu (view_ov26.js) while a
// menu waits in a 2D area showing BIGPIC 121 (view_Mode 3, bigpic_Id 79h, anim_Id <> 'P').
// The blinking picture g_8C7C is an 8x8 picture filled with FFh, allocated at start-up (ENGINE ov11 3500:010f / 0127).

import { G } from '../engine/state.js';
import { state as pic, GetPicture, PutPicture } from '../engine/pictures.js';
import { view } from './view_ov30.js';

// DS:0A48 / DS:0A68 (image, 32 entries): column / row of the animated spot per location number
const ANIM_COL = [4, 12, 21, 11, 29, 20, 38, 21, 30, 31, 25, 37, 28, 29, 3, 12, 25, 29, 29, 33, 19, 16, 9, 16, 20, 21, 25, 25, 26, 31, 37, 34];
const ANIM_ROW = [15, 8, 11, 4, 10, 4, 1, 2, 13, 15, 3, 5, 2, 8, 12, 13, 10, 12, 9, 9, 8, 6, 6, 3, 2, 2, 3, 2, 3, 4, 2, 1];
const tab = (a, t, i) => (G.ds ? G.ds[a + i] : t[i]);

// 6A00:0007 BigPicAnimSetPos
export function BigPicAnimSetPos() {
  const loc = view.mem(0x4CA1) & 0xFF;                                   // region-0 cell 4CA1 (location number, M)
  G.bigpic_AnimCol = tab(0x0A48, ANIM_COL, loc);                         // 6a00:000a g_8C78
  G.bigpic_AnimRow = tab(0x0A68, ANIM_ROW, loc);                         // 6a00:001c g_8C7A
}

// 6A00:0032 BigPicAnimPhaseA: save the background under the spot, draw g_8C7C there
export function BigPicAnimPhaseA() {
  GetPicture(G.bigpic_AnimCol, G.bigpic_AnimRow, pic.symbolPic);         // 6a00:0045 scratch_Pic
  if (G.g_8C7C) PutPicture(G.bigpic_AnimCol, G.bigpic_AnimRow, G.g_8C7C);   // 6a00:005a
}

// 6A00:0063 BigPicAnimPhaseB: restore the saved background
export function BigPicAnimPhaseB() {
  PutPicture(G.bigpic_AnimCol, G.bigpic_AnimRow, pic.symbolPic);         // 6a00:0076
}

// 6A00:0000 ov27_0000 / 6A00:007F ov27_init: empty.
