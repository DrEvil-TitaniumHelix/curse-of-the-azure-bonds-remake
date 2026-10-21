// game/areas/view_ov30.js — VIEW ov30 (6D00): map access, the 3D view renderer, wall sets, the GEO map loader.
// Owner: cab-build-areas. Source: decode/pseudo/VIEW.pas.md ov30 (verified, VIEW_VERIFY.md #verify-47..50 applied);
// structure as Pool's areas/view.js (B100), code from the Curse pseudocode. Re-read against decode/listings/ov30.lst:
//  - Draw3DView far-front pass (6d00:0907..0a0c): GetWallType ahead, InMap / other-side test, corner piece 9 before the
//    front piece when a wall follows a wall, corner only with a side wall behind when the square is open (as Pool).
//  - DrawBackdrop (6d00:02a9..0447): the sun/moon positions are computed from locals 2 / 2 / 0Ch (minCol, minRow, maxCol);
//    the hour cell is a signed word (JGE / JLE), `h > 2` and `h < 16` are unsigned tests; the cloud strip is drawn on
//    every EGA backdrop (the outdoor gate only covers sun and moon).
//  - LoadWallSet (6d00:104c..130d): blocks copy to wall_Buf^[(slot+k-2)*30Ch] (ADD DI,FCF4h); no Pool `id 0 -> 10` quirk;
//    the rebase threshold is the word DS:268A; the slot tables are DS:7210/7212 + slot*4.
//
// This file also holds the VIEW-wide state that is not a DS global (the far-heap buffers wall_Buf^ / map_Buf^) and the
// ECL bindings (engine request #3): ecl_host.js calls bindView({ mem, setMem, setEclPC, eclPC, vecB }).

import { G } from '../engine/state.js';
import { LoadDaxRecord } from '../engine/dax.js';
import { state as pic, FillPictureRect, FlushViewDirtyLines, DrawPicture } from '../engine/pictures.js';
import { fatal } from '../engine/errors.js';
import { hooks } from '../plus/hooks.js';   // GBP W1 (docs/PLUS_HOOKS.md)
import { Put8x8Symbol, Load8x8Set } from './view_ov35.js';

const VIEW_RECT = { x1: 24, y1: 24, x2: 111, y2: 111 };   // VIEW-01 3D window, 88x88 at text cell (3,3)

export const view = {
  map: new Uint8Array(0x400),       // map_Buf^ (g_7206): 4 planes of 16x16 (walls N/E, walls S/W, cell attribute, passages)
  wallBuf: new Uint8Array(0x924),   // wall_Buf^ (g_7202): 3 slots x 30Ch (5 wall types x 156 bytes)
  wallSlotId: [0, 0xFFFF, 0xFFFF, 0xFFFF],   // DS:7210 + slot*4: wall-set id per slot
  wallSlotNo: [0, 0xFFFF, 0xFFFF, 0xFFFF],   // DS:7212 + slot*4
  // ECL VM memory (engine request #3; bound by ecl_host.js). mem(a) = the VM cell at ECL address a.
  mem: (a) => 0,
  setMem: (a, v) => {},
  setEclPC: (pc) => {},
  eclPC: () => 0,
  vecB: () => 0,
};
export function bindView(fns = {}) { Object.assign(view, fns); }
G.map_Buf = view.map; G.wall_Buf = view.wallBuf;

export const DX = [0, 1, 1, 1, 0, -1, -1, -1, 0];        // step_dx DS:2694 (image)
export const DY = [-1, -1, 0, 1, 1, 1, 0, -1, 0];        // step_dy DS:269D
const PIECE_START = [0, 2, 6, 10, 22, 38, 54, 110, 132, 154];   // g_0AD8
const PIECE_W = [1, 1, 1, 3, 2, 2, 7, 2, 2, 1];          // g_0AE2
const PIECE_H = [2, 4, 4, 4, 8, 8, 8, 11, 11, 2];        // g_0AEC
const COL = [5, 4, 6, 4, 2, 7, 2, 0, 9, 5];              // g_0AF6[piece] (words; g_0B08 = COL[9])
const ROW = [4, 3, 3, 3, 1, 1, 1, 0, 0, 4];              // g_0B0A[piece] (g_0B1C = ROW[9])
export const SYM_BASE = [1, 46, 116, 186, 256];          // g_2680 (words)
const PATTERN_25A2 = null;                               // @g_25A2 (CGA fill pattern table; the EGA fill ignores it)

export const sx8 = (v) => ((v & 0xFF) ^ 0x80) - 0x80;
export const i16 = (v) => ((v & 0xFFFF) ^ 0x8000) - 0x8000;
const dsW = (a, dflt) => (G.ds ? G.ds[a] | (G.ds[a + 1] << 8) : dflt);

// ======================================================================================================
// map access
// ======================================================================================================

// 6D00:0556 InMap(x, y)
export function InMap(x, y) { x = sx8(x); y = sx8(y); return x < 16 && x >= 0 && y < 16 && y >= 0; }   // 6d00:055c

// bounds rule of the three readers (6d00:058d / 06cc / 07d5): null = outside a bounded map (ecl_Block 0 or 10), else wrap
function cell(x, y) {
  x = sx8(x); y = sx8(y);
  if (!InMap(x, y) && (G.ecl_Block === 0 || G.ecl_Block === 10)) return null;
  if (x > 15) x = 0; if (x < 0) x = 15;                                  // 6d00:05b2 wrap
  if (y > 15) y = 0; if (y < 0) y = 15;                                  // 6d00:05c8
  return y * 16 + x;
}

// 6D00:0587 GetPassage(x, y, dir)
export function GetPassage(x, y, dir) {
  const c = cell(x, y);
  if (c === null) return 0;                                              // 6d00:05a4
  let r = 1;
  if (GetWallType(x, y, dir) !== 0) {                                    // 6d00:05e2
    const p = view.map[0x300 + c];
    switch (dir) {                                                       // 6d00:05f9
      case 6: r = p >> 6; break;
      case 4: r = (p & 0x30) >> 4; break;
      case 2: r = (p & 0x0C) >> 2; break;
      case 0: r = p & 3; break;
    }
  }
  return r;
}

// 6D00:06BD GetWallType(x, y, dir)
export function GetWallType(x, y, dir) {
  const c = cell(x, y);
  if (c === null) return 0;
  switch (dir) {                                                         // 6d00:0704 .. 07c0
    case 0: return view.map[c] >> 4;
    case 2: return view.map[c] & 0x0F;
    case 4: return view.map[0x100 + c] >> 4;
    case 6: return view.map[0x100 + c] & 0x0F;
  }
  return 0;                                                              // TODO(decode): odd dir leaves the result undefined
}

// 6D00:07C6 GetCellAttr(x, y)
export function GetCellAttr(x, y) {
  const c = cell(x, y);
  return c === null ? 0 : view.map[0x200 + c];                           // 6d00:07d5 .. 0835
}

// ======================================================================================================
// renderer
// ======================================================================================================

// 6D00:0011 DrawAreaMap(x, y, dir)
export function DrawAreaMap(x, y, dir) {
  x = sx8(x); y = sx8(y);
  let x0 = x - 5; if (x0 < 0) x0 = 0; if (x0 > 5) x0 = 5;               // 6d00:0014
  let y0 = y - 5; if (y0 < 0) y0 = 0; if (y0 > 5) y0 = 5;               // 6d00:0036
  for (let r = 0; r <= 10; r++)                                          // 6d00:006f
    for (let c = 0; c <= 10; c++) {
      let sym = 0x104;                                                   // 6d00:008a
      if (GetWallType(x0 + c, y0 + r, 0) !== 0) sym = 0x105;             // 6d00:00a7
      if (GetWallType(x0 + c, y0 + r, 2) !== 0) sym += 2;                // 6d00:00bd
      if (GetWallType(x0 + c, y0 + r, 4) !== 0) sym += 4;                // 6d00:00d4
      if (GetWallType(x0 + c, y0 + r, 6) !== 0) sym += 8;                // 6d00:00eb
      Put8x8Symbol(c + 2, r + 2, sym, 1, 0);                             // 6d00:0102
    }
  Put8x8Symbol(x - x0 + 2, y - y0 + 2, (dir >> 1) + 0x100, 1, 0);        // 6d00:0134 party arrow 100h..103h
  FlushViewDirtyLines();                                                 // 6d00:0160
  hooks.emit('viewDrawn', () => ({ region: 'view', mode: 'areamap', x, y, facing: (dir & 7) >> 1, origin: { x: x0, y: y0 }, rect: VIEW_RECT }));
}

// 6D00:016B SetBackdropColours(c0, c1, c2, c3)
export function SetBackdropColours(c0, c1, c2, c3) {
  G.backdrop_C0 = c0; G.backdrop_C1 = c1; G.backdrop_C2 = c2; G.backdrop_C3 = c3;   // 6d00:016e .. 0188
}

// 6D00:018C DrawBackdrop
export function DrawBackdrop() {
  const vp = pic.viewPic;
  if (G.VideoMode === 0) {                                               // 6d00:018c CGA (not built; kept for fidelity)
    FillPictureRect(2, 0x10, 0x0B, 0x2B, G.backdrop_C0, PATTERN_25A2, vp);   // 6d00:019c
    FillPictureRect(2, 0x3B, 0x0B, 0x01, G.backdrop_C1, PATTERN_25A2, vp);   // 6d00:01c2
    FillPictureRect(2, 0x3C, 0x0B, 0x02, G.backdrop_C2, PATTERN_25A2, vp);   // 6d00:01e8
    FillPictureRect(2, 0x3E, 0x0B, 0x2A, G.backdrop_C3, PATTERN_25A2, vp);   // 6d00:020e
    return;
  }
  FillPictureRect(2, 0x10, 0x0B, 0x2C, G.backdrop_C0, PATTERN_25A2, vp);     // 6d00:0237 sky one row taller
  FillPictureRect(2, 0x3C, 0x0B, 0x02, G.backdrop_C2, PATTERN_25A2, vp);     // 6d00:025d
  FillPictureRect(2, 0x3E, 0x0B, 0x2A, G.backdrop_C3, PATTERN_25A2, vp);     // 6d00:0283
  if (GetCellAttr(G.party_MapX, G.party_MapY) < 0x80 && G.backdrop_C0 === 0x0B) {   // 6d00:02a9 / 02bc outdoors only
    const minCol = 2, minRow = 2, maxCol = 0x0C;                         // 6d00:02c6 locals [BP-3] / [BP-4] / [BP-5]
    const h = i16(view.mem(0x4BC9));                                     // 6d00:02d6 hour cell (region 0 +192h)
    const dir = G.party_Dir;
    if (h >= 1 && h <= 5) {                                              // morning: sun low in the east
      if (dir === 2) DrawPicture(maxCol - 3, minRow + 5 - h, 0, 1, G.sky_Sun, vp);                 // 6d00:02ff
      else if (dir === 4 && (h & 0xFFFF) > 2) DrawPicture(minCol + h - 3, minRow + 5 - h, 0, 1, G.sky_Sun, vp);   // 6d00:033c
    } else if (h >= 13 && h <= 18) {                                     // 6d00:0372 evening: sun in the west
      if (dir === 6) DrawPicture(minCol, minRow + h - 13, 0, 1, G.sky_Sun, vp);                    // 6d00:0386
      else if (dir === 4 && (h & 0xFFFF) < 16) DrawPicture(minCol + h - 8, minRow + h - 13, 0, 1, G.sky_Sun, vp);   // 6d00:03c0
    }
    if (dir === 0) DrawPicture(minCol, minRow, 0, 1, G.sky_Moon, vp);    // 6d00:03fa facing north
  }
  DrawPicture(2, 7, 0, 1, G.sky_Strip, vp);                              // 6d00:0421
}

// 6D00:0448 DrawWallPiece(col, row, wallType, piece)
export function DrawWallPiece(col, row, wallType, piece) {
  col = sx8(col); row = sx8(row);
  let k = PIECE_START[piece];                                            // 6d00:044e
  const lastCol = col + PIECE_W[piece] - 1;                              // 6d00:045c
  const lastRow = row + PIECE_H[piece] - 1;                              // 6d00:0475
  for (let r = row; r <= lastRow; r++)
    for (let c = col; c <= lastCol; c++) {
      if (r >= 0 && r < 11 && c >= 0 && c < 11) {
        const s = view.wallBuf[(wallType - 1) * 0x9C + k];
        if (s !== 0) Put8x8Symbol(c + 2, r + 2, s, 1, 1);                // 6d00:04fb
      }
      k++;                                                               // advances even for clipped cells
    }
}

// 6D00:0841 Draw3DView(x, y, dir)
export function Draw3DView(x, y, dir) {
  if (G.view_AreaMap !== 0) { DrawAreaMap(x, y, dir); return; }          // 6d00:0847 / 084e
  DrawBackdrop();                                                        // 6d00:0861
  const left = (dir + 6) % 8, back = (dir + 4) % 8, right = (dir + 2) % 8;   // 6d00:0865 [BP-1] / [BP-3] / [BP-2]
  let cx = sx8(x) + 2 * DX[dir], cy = sx8(y) + 2 * DY[dir];             // 6d00:08a9 square two ahead
  const GW = GetWallType;
  for (let dist = 2; dist >= 0; dist--) {                                // 6d00:08cb
    if (dist === 2) {
      // far front walls: pass 1 centre -> left (6d00:08d6), pass 2 centre -> right (6d00:0a31 .. 0aa8)
      for (const [side, other, step] of [[left, right, -2], [right, left, 2]]) {
        let sx = cx, sy = cy, off = 0, edge = 0;
        for (let i = 0; i < 4; i++) {
          const w = GW(sx, sy, dir);                                     // 6d00:0910
          if (!InMap(sx, sy) && GW(sx, sy, other) === 0) edge = 0;       // 6d00:0923 / 0933
          const corner = step < 0 ? COL[9] + off + 1 : COL[9] + off - 1;
          if (w === 0) {
            if (edge > 0 && GW(sx - DX[side], sy - DY[side], side) !== 0) DrawWallPiece(corner, ROW[9], edge, 9);   // 6d00:09c6
            edge = 0;                                                    // 6d00:09dd
          } else {
            if (edge > 0) DrawWallPiece(corner, ROW[9], edge, 9);        // 6d00:0957 far corner piece
            edge = w;                                                    // 6d00:096e
            DrawWallPiece(COL[0] + off, ROW[0], w, 0);                   // 6d00:0974 far front wall 1x2
          }
          off += step; sx += DX[side]; sy += DY[side];                   // 6d00:09e4
        }
      }
      // far side walls: left piece 1 (6d00:0b4b), right piece 2 (6d00:0be2)
      for (const [side, piece, step] of [[left, 1, -2], [right, 2, 2]]) {
        let sx = cx, sy = cy, off = 0;
        for (let i = 0; i < 3; i++) {
          const w = GW(sx, sy, side);
          if (w !== 0) DrawWallPiece(COL[piece] + off + (i === 0 ? 0 : (step < 0 ? -1 : 1)), ROW[piece], w, piece);   // 6d00:0b6a / 0b82 ; 0c14 / 0c2d
          off += step; sx += DX[side]; sy += DY[side];
        }
      }
    } else if (dist === 1) {
      // middle row: from cx + 2*left going right (front 3, left side 4) 6d00:0c8d; mirror (front 3, right side 5) 6d00:0d61
      for (const [from, to, sidePiece, start, step, side] of [[left, right, 4, -6, 3, left], [right, left, 5, 6, -3, right]]) {
        let sx = cx + 2 * DX[from], sy = cy + 2 * DY[from], off = start;
        for (let i = 0; i < 3; i++) {
          let w = GW(sx, sy, dir); if (w !== 0) DrawWallPiece(COL[3] + off, ROW[3], w, 3);                          // 6d00:0cc3 / 0da9
          w = GW(sx, sy, side); if (w !== 0) DrawWallPiece(COL[sidePiece] + off, ROW[sidePiece], w, sidePiece);   // 6d00:0cf2 / 0dd8
          off += step; sx += DX[to]; sy += DY[to];
        }
      }
    } else {
      // near row: from cx + left going right (front 6, left side 7) 6d00:0e52; mirror (front 6, right side 8) 6d00:0f14
      for (const [from, to, sidePiece, start, step, side] of [[left, right, 7, -7, 7, left], [right, left, 8, 7, -7, right]]) {
        let sx = cx + DX[from], sy = cy + DY[from], off = start;
        for (let i = 0; i < 2; i++) {
          let w = GW(sx, sy, dir); if (w !== 0) DrawWallPiece(COL[6] + off, ROW[6], w, 6);                          // 6d00:0e76 / 0f38
          w = GW(sx, sy, side); if (w !== 0) DrawWallPiece(COL[sidePiece] + off, ROW[sidePiece], w, sidePiece);   // 6d00:0ea5 / 0f67
          off += step; sx += DX[to]; sy += DY[to];
        }
      }
    }
    cx += DX[back]; cy += DY[back];                                      // 6d00:0fd6 one square nearer
  }
  FlushViewDirtyLines();                                                 // 6d00:0ff4
  hooks.emit('viewDrawn', () => ({ region: 'view', mode: '3d', x: sx8(x), y: sx8(y), facing: (dir & 7) >> 1, rect: VIEW_RECT }));
}

// ======================================================================================================
// loaders
// ======================================================================================================

// 6D00:104C LoadWallSet(id, slot)
export async function LoadWallSet(id, slot) {
  if (slot < 1 || slot > 3) return;                                      // 6d00:1052
  const name = 'WALLDEF' + pic.DataSet;                                  // 6d00:1062 / 1077 / 1091
  const rec = await LoadDaxRecord((pic.DataPath ?? '') + name, '.dax', id);   // 6d00:10b4 ('.dax' a separate argument)
  const size = rec ? rec.length : 0;
  if (size === 0 || Math.floor(size / 0x30C) + slot > 4)                 // 6d00:10b9 / 10c6
    throw fatal('Unable to load ' + id + ' from ' + name + '.', true);   // 6d00:10d7 .. 113d (VIEW-11; ReadGameKey, TerminateGame)
  const delta = (SYM_BASE[slot] - SYM_BASE[1]) & 0xFF;                   // 6d00:1142 g_2680[slot] - g_2682 (added as a byte)
  const rebaseMin = dsW(0x268A, 45);                                     // word DS:268A
  let n = 0, k = 1;
  do {                                                                   // 6d00:1160
    const dst = (slot + k - 2) * 0x30C;                                  // 6d00:116a .. 117e (ADD DI,FCF4h)
    const src = rec.subarray(n, n + 0x30C);
    view.wallBuf.fill(0, dst, dst + 0x30C); view.wallBuf.set(src, dst);  // 6d00:1188 Move($30C) (TODO(decode): a short block copies heap bytes)
    n += 0x30C; k++;                                                     // 6d00:118d / 1192
  } while (n < size);                                                    // 6d00:1198
  const blocks = (k - 1) & 0xFF;                                         // 6d00:11aa
  for (k = 1; k <= blocks; k++) {                                        // 6d00:11b9
    const s = slot + k - 1;
    if (s >= 1 && s <= 3) {                                              // 6d00:11db SetIn cs:102C
      view.wallSlotId[s] = 0xFFFF; view.wallSlotNo[s] = 0xFFFF;          // 6d00:11f4 / 1209
      for (let t = 1; t <= 5; t++)                                       // 6d00:120f
        for (let i = 0; i <= 0x9B; i++) {
          const o = (s * 0x30C + t * 0x9C + i - 0x3A8) & 0xFFFF;         // = (s-1)*30Ch + (t-1)*9Ch + i (ES:[DI+FC58h])
          if (o < view.wallBuf.length && view.wallBuf[o] >= rebaseMin) view.wallBuf[o] = (view.wallBuf[o] + delta) & 0xFF;   // 6d00:1252 / 1286
        }
      if (blocks > 1) await Load8x8Set((id * 10 + k) & 0xFF, s);         // 6d00:12b9 multi-set record
      else await Load8x8Set(id, s);                                      // 6d00:12ce
    }
  }
  view.wallSlotId[slot] = id; view.wallSlotNo[slot] = slot;              // 6d00:12f0 / 1306
}

// LOAD_PIECES with FFh (ECL_VM.md 4.5): slot emptied
export function ClearWallSlot(slot) { view.wallSlotId[slot] = 0xFFFF; view.wallSlotNo[slot] = 0xFFFF; }

// 6D00:133A Load3DMap(id)
export async function Load3DMap(id) {
  const rec = await LoadDaxRecord((pic.DataPath ?? '') + 'GEO' + pic.DataSet, '.dax', id);   // 6d00:1361 / 1393
  if (!rec || rec.length !== 0x402) throw fatal('Unable to load geo in Load3DMap.', true);   // 6d00:1398 .. 13ce
  view.map.set(rec.subarray(2, 0x402));                                  // 6d00:13ec / 140e / 1430 / 1452 four Move($100)
  view.setMem(0x4BC5, id);                                               // 6d00:1464 ecl_Mem4B00^.w[$18A] := id
}

// 6D00:0000 ov30_LoadDeps / 6D00:1478 ov30_init: overlay-manager touches, empty here.
