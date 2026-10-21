// game/areas/view_ov32.js — VIEW ov32 (7000): combat map window, occupancy, combatant placement (Pool ov31 BB00).
// Owner: cab-build-areas. Source: decode/pseudo/VIEW.pas.md ov32; structure as Pool's areas/view_ov31.js. Re-read from
// decode/listings/ov32.lst (the Curse deltas):
//  - ShowCombatant (7000:0b3f): FocusSquare / RestoreTerrain / DrawIconAt only while combat_Visible (g_75E6); the icon is
//    drawn when IsVisible(c, false) (any cell in the window).
//  - ProbeMove (7000:0d06): (c, dir, var occupant, var tile, var hit1E, var hit1C); tiles 1Eh / 1Ch set the flags instead
//    of competing for the tile result.
//  - RemoveCombatant (7000:0e75): the "already a corpse" search indexes the corpse list with an uninitialised local
//    ([BP-3], quirk; entry 0 here, which never matches); a 9-frame fall animation alternating fallen_Pic[frame mod 2]
//    with Delay(10) per frame; corpse entries +0 char, +4 col, +5 row, +6 old tile; no sound-timer mode calls.
//  - PlaceCombatant: footprint size from c+DEh and 7Fh.
//  - Character fields: +143h icon slot, +18Dh combatant record (c.combat.b: +9 facing, +13h extra), +196h active.
// Data shapes: G.cb_Char/cb_Col/cb_Row/cb_Index/cb_Size[n] (n = 1..cb_Size[0]), G.cb_ScrCol/cb_ScrRow[n],
// G.cm_Map = { b: Uint8Array(4E9h) }, G.cm_Occupant = Uint8Array(4E2h), G.corpse_List[k] = { char, col, row, tile }
// (k = 1..8), G.corpse_Count.

import { G } from '../engine/state.js';
import * as P from '../engine/pictures.js';
import { MessageDelay } from '../engine/text.js';
import { PlayOrStopSound } from '../engine/audio_cab.js';
import { Delay } from '../engine/timer.js';
import { DX, DY, sx8 } from './view_ov30.js';
import { DrawTile24, DrawIconAt } from './view_ov33.js';

const { state: pic, DrawPicture, FlushViewDirtyLines } = P;
// 0297:2171 SetEgaPaletteRegister(i, c) (engine request #5; display.js setPaletteRegister until pictures.js exports it)
const SetEgaPaletteRegister = P.SetEgaPaletteRegister || ((i, c) => { if (pic.display && pic.display.setPaletteRegister) pic.display.setPaletteRegister(i, c); });
const FOOT = [[], [[0, 0]], [[0, 0], [0, 1]], [[0, 0], [1, 0]], [[0, 0], [1, 0], [0, 1], [1, 1]]];   // g_27A2 (image)
const map = () => G.cm_Map.b;
const grid = (row, col) => map()[7 + row * 50 + col];
const terrCost = (t) => G.ds[0x26A2 + t * 4];            // CombatTerrain[t] +0 (FFh impassable)
const terrFrame = (t) => G.ds[0x26A5 + t * 4];           // CombatTerrain[t] +3
const occ = () => { if (!G.cm_Occupant) G.cm_Occupant = new Uint8Array(0x4E2); return G.cm_Occupant; };
const scr = () => { if (!G.cb_ScrCol) { G.cb_ScrCol = []; G.cb_ScrRow = []; } };
const corpses = () => { if (!G.corpse_List) G.corpse_List = []; return G.corpse_List; };
const slotOf = (c) => c.b[0x143];

// 7000:0011 FootprintCell(size, k, var dx, var dy): g_27A2 / g_27A3 [size*8 + k*2], dx < 0 = unused
export function FootprintCell(size, k, dx, dy) {
  if (size === 0) return false;
  if (G.ds) { dx.v = sx8(G.ds[0x27A2 + size * 8 + k * 2]); dy.v = sx8(G.ds[0x27A3 + size * 8 + k * 2]); }
  else { const f = (FOOT[size] || [])[k]; dx.v = f ? f[0] : -1; dy.v = f ? f[1] : -1; }
  return dx.v >= 0;                                                      // 7000:0011 .. 0076
}
const fp = (size, k) => { const dx = { v: 0 }, dy = { v: 0 }; return FootprintCell(size, k, dx, dy) ? [dx.v, dy.v] : null; };

// 7000:0079 UpdateScreenPositions
export function UpdateScreenPositions() {
  scr();
  for (let n = 1; n <= (G.cb_Size[0] || 0); n++) {
    G.cb_ScrCol[n] = sx8(G.cb_Col[n] - map()[2]); G.cb_ScrRow[n] = sx8(G.cb_Row[n] - map()[3]);
  }
}

// 7000:00F4 PaletteFlashOn / 7000:0134 PaletteFlashOff (EGA; Tandy goes through the raw register write, not built)
export function PaletteFlashOn() {
  if (G.VideoMode === 1 || G.VideoMode === 2) { SetEgaPaletteRegister(8, 0); SetEgaPaletteRegister(0, 8); }   // 7000:0104 / 010f
}
export function PaletteFlashOff() {
  if (G.VideoMode === 1 || G.VideoMode === 2) { SetEgaPaletteRegister(0, 0); SetEgaPaletteRegister(8, 8); }   // 7000:0144 / 014f
}

// 7000:0509 CellAt(col, row, var occupant, var tile)
export function CellAt(col, row, occupant, tile) {
  col = sx8(col); row = sx8(row);
  if (col < 0 || col > 49 || row < 0 || row > 24) { occupant.v = 0; tile.v = 0; return; }
  tile.v = grid(row, col); occupant.v = occ()[row * 50 + col];           // 7000:0509 .. 0575
}

// 7000:0732 InWindow(a, b)
export function InWindow(a, b) { a = sx8(a); b = sx8(b); return a >= 0 && a <= 6 && b >= 0 && b <= 6; }

// 7000:0CAE CombatantIndex(c): 0 if absent
export function CombatantIndex(c) {
  const n = G.cb_Size[0] || 0;
  for (let i = 1; i <= n; i++) if (G.cb_Char[i] === c) return i;
  return 0;
}
export const CombatantCol = (c) => G.cb_Col[CombatantIndex(c)];        // 7000:0C36
export const CombatantRow = (c) => G.cb_Row[CombatantIndex(c)];        // 7000:0C5E
export const CombatantSize = (c) => G.cb_Size[CombatantIndex(c)];      // 7000:0C86

// 7000:0763 IsVisible(c, all)
export function IsVisible(c, all) {
  const n = CombatantIndex(c); scr();                                    // 7000:0774
  if (!G.cb_Size[n]) return false;
  let r = true;
  for (let k = 0; k <= 3; k++) {
    const f = fp(G.cb_Size[n], k);
    if (!f) continue;
    if (!InWindow(sx8(G.cb_ScrCol[n]) + f[0], sx8(G.cb_ScrRow[n]) + f[1])) { r = false; if (all) return false; }   // 7000:07bb
    else { r = true; if (!all) return true; }                            // 7000:07ed
  }
  return r;
}

// 7000:03EB RebuildOccupancy
export function RebuildOccupancy() {
  occ().fill(0); scr();                                                  // 7000:03f9
  for (let n = 1; n <= (G.cb_Size[0] || 0); n++) {
    if (!G.cb_Size[n]) continue;
    for (let k = 0; k <= 3; k++) {
      const f = fp(G.cb_Size[n], k);
      if (f) { const i = (sx8(G.cb_Row[n]) + f[1]) * 50 + sx8(G.cb_Col[n]) + f[0]; if (i >= 0 && i < 0x4E2) occ()[i] = n; }   // 7000:0457
    }
    G.cb_ScrCol[n] = sx8(G.cb_Col[n] - map()[2]); G.cb_ScrRow[n] = sx8(G.cb_Row[n] - map()[3]);
  }
}

function drawOccupant(n) {
  const c = G.cb_Char[n];
  if (n !== 0 && IsVisible(c, false)) DrawIconAt(G.cb_ScrCol[n], G.cb_ScrRow[n], c.combat.b[9], 0, slotOf(c));
}

// 7000:0174 RedrawCell(col, row): terrain under the cursor footprint (+ cursor icon), then the cell's occupant
export function RedrawCell(col, row) {
  col = sx8(col); row = sx8(row);
  const c0 = col - sx8(map()[2]), r0 = row - sx8(map()[3]);
  for (let k = 0; k <= 3; k++) {
    const f = fp(map()[5], k);
    if (f && InWindow(c0 + f[0], r0 + f[1])) {
      DrawTile24((c0 + f[0]) * 3, (r0 + f[1]) * 3, terrFrame(grid(row + f[1], col + f[0])), 0);   // 7000:0251
      if (map()[4] !== 0) DrawIconAt(c0 + f[0], r0 + f[1], 0, 0, 0x19); // 7000:0284 cursor
    }
  }
  const o = { v: 0 }, t = { v: 0 };
  CellAt(col, row, o, t);                                                // 7000:02a5
  drawOccupant(o.v);                                                     // 7000:02c5 / 0315
}

// 7000:0578 RestoreTerrain(scol, srow, who)
export function RestoreTerrain(scol, srow, who) {
  scol = sx8(scol); srow = sx8(srow);
  let col = 0, row = 0;
  if (who === 0) {
    col = scol + sx8(map()[2]); row = srow + sx8(map()[3]);
    const o = { v: 0 }, t = { v: 0 }; CellAt(col, row, o, t); who = o.v; // 7000:05bf
  }
  if (who === 0) {
    if (InWindow(srow, scol)) DrawTile24(scol * 3, srow * 3, terrFrame(grid(row, col)), 0);   // 7000:0662 / 06c8
  } else {
    scr();
    scol = sx8(G.cb_ScrCol[who]); srow = sx8(G.cb_ScrRow[who]);
    col = scol + sx8(map()[2]); row = srow + sx8(map()[3]);
    for (let k = 0; k <= 3; k++) {
      const f = fp(G.cb_Size[who], k);
      if (f && InWindow(srow + f[1], scol + f[0]))
        DrawTile24((scol + f[0]) * 3, (srow + f[1]) * 3, terrFrame(grid(row + f[1], col + f[0])), 0);   // 7000:063d / 06e1 / 0727
    }
  }
}

// 7000:0320 RedrawSquare(col, row)
export function RedrawSquare(col, row) {
  col = sx8(col); row = sx8(row);
  RestoreTerrain(col - sx8(map()[2]), row - sx8(map()[3]), 0);           // 7000:035a
  const o = { v: 0 }, t = { v: 0 }; CellAt(col, row, o, t);              // 7000:0370
  drawOccupant(o.v);                                                     // 7000:0390 / 03e0
}

// 7000:081D ScrollToShow(col, row, margin): true if the window moved (all 7x7 tiles redrawn)
export function ScrollToShow(col, row, margin) {
  col = sx8(col); row = sx8(row);
  let cx = sx8(map()[2] + 3), cy = sx8(map()[3] + 3);
  const m = margin === 0xFF ? 0 : margin;
  const hi = sx8(cy + m);
  if (!(margin === 0xFF || col < sx8(cx - m) || sx8(cx + m) < col || row < sx8(cy - m) || hi < row)) return false;
  if (col < sx8(cx - m)) { while (col < cx && cx > 3) cx--; }
  else if (sx8(cx + m) < col) { while (cx < col && cx < 0x2E) cx++; }   // column 3..46
  if (row < sx8(cy - m)) { while (row < cy && cy > 3) cy--; }
  else if (hi < row) { while (cy < row && cy < 0x15) cy++; }             // row 3..21
  map()[2] = (cx - 3) & 0xFF; map()[3] = (cy - 3) & 0xFF;
  for (let r = 0; r <= 6; r++)
    for (let c = 0; c <= 6; c++)
      DrawTile24(c * 3, r * 3, terrFrame(grid(sx8(map()[3]) + r, sx8(map()[2]) + c)), 0);   // 7000:09af
  UpdateScreenPositions();                                               // 7000:09cf
  return true;
}

// 7000:09DF FocusSquare(col, row, margin, dir): moves the cursor to (col,row) + step[dir] (dir 8 = none)
export function FocusSquare(col, row, margin, dir) {
  col = sx8(col); row = sx8(row);
  let tc = sx8(col + DX[dir]), tr = sx8(row + DY[dir]);
  if (ScrollToShow(tc, tr, margin)) {                                    // 7000:0a20
    for (let n = 1; n <= (G.cb_Size[0] || 0); n++) {
      const c = G.cb_Char[n];
      if (c && c.b[0x196] !== 0 && G.cb_Size[n] && IsVisible(c, false))  // 7000:0a5c active
        DrawIconAt(G.cb_ScrCol[n], G.cb_ScrRow[n], c.combat.b[9], 0, slotOf(c));   // 7000:0ab8
    }
  }
  RedrawSquare(col, row);                                                // 7000:0ad1
  if (!InWindow(tc - sx8(map()[2]), tr - sx8(map()[3]))) {               // 7000:0af9
    if (tc > 49) tc = 49; if (tc < 0) tc = 0; if (tr > 24) tr = 24; if (tr < 0) tr = 0;
  }
  RedrawCell(tc, tr);                                                    // 7000:0b31
  FlushViewDirtyLines();                                                 // 7000:0b34
}

// 7000:0B3F ShowCombatant(c, dir, pose, noDraw)
export function ShowCombatant(c, dir, pose, noDraw) {
  const n = CombatantIndex(c);                                           // 7000:0b4c
  if (!IsVisible(c, true) && G.combat_Visible) FocusSquare(CombatantCol(c), CombatantRow(c), 3, 8);   // 7000:0b5c / 0b87
  if (((dir >> 2) !== (c.combat.b[9] >> 2) || pose || noDraw) && G.combat_Visible) RestoreTerrain(0, 0, n);   // 7000:0b8a .. 0bcd
  c.combat.b[9] = dir;                                                   // 7000:0bdb
  if (!noDraw && IsVisible(c, false) && G.combat_Visible) {              // 7000:0bdf .. 0bf6
    DrawIconAt(G.cb_ScrCol[n], G.cb_ScrRow[n], dir, pose, slotOf(c));    // 7000:0c26
    FlushViewDirtyLines();                                               // 7000:0c2b
  }
}

// 7000:0D06 ProbeMove(c, dir, var occupant, var tile, var hit1E, var hit1C)
export function ProbeMove(c, dir, occupant, tile, hit1E = { v: 0 }, hit1C = { v: 0 }) {
  occupant.v = 0; tile.v = 0x17; let best = 1; hit1E.v = 0; hit1C.v = 0;   // 7000:0d0c .. 0d28
  const n = CombatantIndex(c);
  const col = sx8(G.cb_Col[n]), row = sx8(G.cb_Row[n]);
  for (let k = 0; k <= 3; k++) {
    const f = fp(G.cb_Size[n], k);                                       // 7000:0d85
    if (!f) continue;
    const o = { v: 0 }, t = { v: 0 };
    CellAt(col + f[0] + DX[dir], row + f[1] + DY[dir], o, t);           // 7000:0de0
    if (o.v === n) o.v = 0;                                              // 7000:0de3
    if (o.v > 0) occupant.v = o.v;                                       // 7000:0def
    if (t.v === 0 || tile.v === 0) tile.v = 0;                           // 7000:0dfe / 0e0d
    else if (t.v === 0x1E) hit1E.v = 1;                                  // 7000:0e1b
    else if (t.v === 0x1C) hit1C.v = 1;                                  // 7000:0e29
    else if (terrCost(t.v) >= best) { best = terrCost(t.v); tile.v = t.v; }   // 7000:0e42 .. 0e63
  }
}

// 7000:0E75 RemoveCombatant(c)
export async function RemoveCombatant(c) {
  if (G.view_Mode !== 5) {                                               // 7000:0e7b
    await PlayOrStopSound(G.ds ? G.ds[0x25B6] | (G.ds[0x25B7] << 8) : 0); await MessageDelay();               // 7000:0e86 / 0e8b
    return;
  }
  const L = corpses();
  let k = 1;
  while (k < 9 && !(L[0] && L[0].char === c)) k++;                       // 7000:0e93 .. 0ebc quirk: index = uninitialised [BP-3]
  if (k < 9) return;                                                     // 7000:0ebe
  const n = CombatantIndex(c), col = sx8(CombatantCol(c)), row = sx8(CombatantRow(c));   // 7000:0ece / 0edb / 0ee8
  if (!IsVisible(c, true)) FocusSquare(col, row, 3, 8);                  // 7000:0ef8 / 0f0e
  RestoreTerrain(0, 0, n);                                               // 7000:0f1c
  await PlayOrStopSound(G.ds ? G.ds[0x25B6] | (G.ds[0x25B7] << 8) : 0);                                       // 7000:0f23
  const fallen = G.fallen_Pic || [null, null];                           // g_6696 / g_6698
  for (let frame = 0; frame <= 8; frame++) {                             // 7000:0f28
    for (let i = 0; i <= 3; i++) {
      const f = fp(G.cb_Size[n], i);                                     // 7000:0f59
      if (f && InWindow(sx8(G.cb_ScrCol[n]) + f[0], sx8(G.cb_ScrRow[n]) + f[1]))   // 7000:0f8e
        DrawPicture((sx8(G.cb_ScrCol[n]) + f[0]) * 3, (sx8(G.cb_ScrRow[n]) + f[1]) * 3, 0, 5, fallen[frame % 2], pic.viewPic);   // 7000:0ff1
    }
    FlushViewDirtyLines();                                               // 7000:0fff
    await Delay(10);                                                     // 7000:1008
  }
  if (c.combat.b[0x13] === 0) {                                          // 7000:101e not an extra
    G.corpse_Count = (G.corpse_Count + 1) & 0xFF;                        // 7000:1028
    const tile = grid(row, col);                                         // 7000:1043
    if (tile !== 0x1E) map()[7 + row * 50 + col] = 0x1F;                 // 7000:106e / 108c
    L[G.corpse_Count] = { char: c, col, row, tile };                     // 7000:10a2 .. 10cc
  }
  await MessageDelay();                                                  // 7000:10d0
  RestoreTerrain(0, 0, n);                                               // 7000:10e0
  G.cb_Size[CombatantIndex(c)] = 0;                                      // 7000:10f5
  RebuildOccupancy();                                                    // 7000:10fb
  FocusSquare(sx8(map()[2]) + 3, sx8(map()[3]) + 3, 3, 8);               // 7000:111f recentre
  c.combat.b[3] = 0; c.combat.b[6] = 0; c.combat.b[0] = 0; c.combat.b[7] = 0;   // 7000:112a .. 1150
}

// 7000:115B PlaceCombatant(c, col, row, restoreTile)
export function PlaceCombatant(c, col, row, restoreTile) {
  if (G.view_Mode !== 5) return true;                                    // 7000:1161 / 1348
  let ok = false;
  const n = CombatantIndex(c);                                           // 7000:1176
  G.cb_Size[n] = c.b[0xDE] & 0x7F; G.cb_Col[n] = col & 0xFF; G.cb_Row[n] = row & 0xFF;   // 7000:117f .. 11b7
  const o = { v: 0 }, t = { v: 0 }, h1 = { v: 0 }, h2 = { v: 0 };
  ProbeMove(c, 8, o, t, h1, h2);                                         // 7000:11d9
  if (o.v === 0 && t.v !== 0 && terrCost(t.v) !== 0xFF) {                // 7000:11dc .. 11f8
    ok = true;
    let tile = t.v;
    if (restoreTile && c.combat.b[0x13] === 0) {                         // 7000:1211 / 1222
      const L = corpses(), cnt = G.corpse_Count || 0;
      for (let k = 1; k <= cnt; k++) {                                   // 7000:122c
        const b = L[k];
        if (b && b.char === c) { if (b.tile !== 0x1F) tile = b.tile; L[k] = { char: null, col: 0, row: 0, tile: 0 }; }   // 7000:1269 / 129c FillChar(7, 0)
      }
      let other = false;
      for (let k = 1; k <= cnt; k++) {                                   // 7000:12a9
        const b = L[k];
        if (b && b.char && sx8(b.col) === (col & 0xFF) && sx8(b.row) === (row & 0xFF)) other = true;   // 7000:12ce .. 1310
      }
      if (!other) map()[7 + (row & 0xFF) * 50 + (col & 0xFF)] = tile;   // 7000:133e
    }
    RebuildOccupancy();                                                  // 7000:1343
  } else G.cb_Size[n] = 0;                                               // 7000:1205
  return ok;
}

// 7000:1355 FocusCombatant(c, margin, cursor)
export function FocusCombatant(c, margin, cursor) {
  map()[4] = cursor ? 1 : 0;                                             // 7000:135f
  map()[5] = G.cb_Size[CombatantIndex(c)];                               // 7000:137d
  if (G.combat_Visible) FocusSquare(CombatantCol(c), CombatantRow(c), margin, 8);   // 7000:1381 / 13a6
  map()[4] = 0; map()[5] = 1;                                            // 7000:13ad / 13b6
}

// 7000:0000 ov32_LoadDeps / 7000:13C1 ov32_init: empty.
