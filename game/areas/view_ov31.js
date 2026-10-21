// game/areas/view_ov31.js — VIEW ov31 (6F00): combat line of sight and the target list (Pool ov30 B600).
// Owner: cab-build-areas. Source: decode/pseudo/VIEW.pas.md ov31, re-read from decode/listings/ov31.lst:
//  - TLine (Curse layout, from LineInit 6f00:019d / LineStep 6f00:0246): words +0 x0, +2 y0, +4 x1, +6 y1, +8 err,
//    +0Ah adx, +0Ch ady, +0Eh x, +10h y, +12h sx, +14h sy; bytes +16h dist, +17h dir. No incDiag/incStraight (Pool had
//    them); LineInit sets x, y, adx, ady, sx, sy, err := 0, dist := 0.
//  - LineStep: x-major when adx >= ady (JGE): x += sx, err += 2*ady, dist += 2; if err >= adx then err -= 2*adx,
//    y += sy, dist += 1. y-major the same with the axes exchanged. dir := g_2558[(oy+1)*3 + (ox+1)].
//  - TraceLine (6f00:03ea): step limit range*2+1; the height line H runs 0 -> max(adx, ady) from the start tile's height
//    to the start tile's height again (quirk, as Pool); blocked when map^[6] = 0 and the obstacle height of the tile under
//    (L.x, L.y) is above H.y, or L.dist > limit.
//  - BuildTargetList (6f00:08e3): outer loop over the target's footprint cells m, inner over the attacker's cells k;
//    `found` is set by every successful TraceLine even when its distance is not below `best` (6f00:0ad6, quirk as Pool);
//    best starts at 00FFh (word); the stored distance is its low byte.
//  - InFrontArc (6f00:054a, 921 bytes): same eight quadrant cases as Pool B600:057B (shape 0.97); the case formulas are
//    Pool's verified ones.
// Data (combat conventions of this lane): G.cb_Col/cb_Row/cb_Index/cb_Size[n] (n = 1..cb_Size[0]), G.cm_Map = { b }
// (+2/+3 window origin, +6 "no line-of-sight test", +7 grid 25 x 50), G.tg_List[1..tg_Count] = { who, dist, dir }.

import { G } from '../engine/state.js';
import { DX, DY, sx8, i16 } from './view_ov30.js';
import { FootprintCell } from './view_ov32.js';

const DIR_OF = [7, 0, 1, 6, 8, 2, 5, 4, 3];              // g_2558 (image)
const dirOf = (i) => (G.ds ? G.ds[0x2558 + i] : DIR_OF[i]);

export function newLine() {
  return { x0: 0, y0: 0, x1: 0, y1: 0, err: 0, adx: 0, ady: 0, x: 0, y: 0, sx: 0, sy: 0, dist: 0, dir: 0 };
}

// 6F00:0007 Sign(n): -1 / 0 / 1
export function Sign(n) { n = i16(n); return n < 0 ? -1 : n > 0 ? 1 : 0; }

// 6F00:0035 SortTargets: exchange sort by distance; equal distance: lower direction code first when its parity is not greater
export function SortTargets() {
  const L = G.tg_List;
  if (!L || G.tg_Count <= 1) return;                                     // 6f00:0045
  for (let i = 1; i <= G.tg_Count - 1; i++)
    for (let j = i + 1; j <= G.tg_Count; j++) {
      const a = L[i], b = L[j];
      const swap = b.dist < a.dist || (b.dist === a.dist && b.dir < a.dir && (b.dir % 2) <= (a.dir % 2));
      if (swap) { L[i] = b; L[j] = a; }                                  // 6f00:00c2 / 00e0 / 00fe 3-byte swaps
    }
}

// 6F00:019D LineInit(var L)
export function LineInit(L) {
  L.x = L.x0; L.y = L.y0;                                                // 6f00:01a0
  L.adx = Math.abs(i16(L.x1 - L.x0)); L.ady = Math.abs(i16(L.y1 - L.y0));   // 6f00:01c4 / 01df
  L.sx = Sign(L.x1 - L.x0); L.sy = Sign(L.y1 - L.y0);                    // 6f00:020b / 0225
  L.err = 0; L.dist = 0;                                                 // 6f00:0230 / 0238
}

// 6F00:0246 LineStep(var L): one step towards (x1, y1); false when already there
export function LineStep(L) {
  let r = false, ox = 1, oy = 1;                                         // 6f00:024c (1 = no step)
  if (L.adx >= L.ady) {                                                  // 6f00:0261 x-major
    if (L.x !== L.x1) {
      L.x = i16(L.x + L.sx); ox = L.sx + 1; L.err = i16(L.err + 2 * L.ady); L.dist = (L.dist + 2) & 0xFF;
      if (L.err >= L.adx) { L.err = i16(L.err - 2 * L.adx); L.y = i16(L.y + L.sy); oy = L.sy + 1; L.dist = (L.dist + 1) & 0xFF; }
      r = true;
    }
  } else if (L.y !== L.y1) {                                             // 6f00:031d y-major
    L.y = i16(L.y + L.sy); oy = L.sy + 1; L.err = i16(L.err + 2 * L.adx); L.dist = (L.dist + 2) & 0xFF;
    if (L.err >= L.ady) { L.err = i16(L.err - 2 * L.ady); L.x = i16(L.x + L.sx); ox = L.sx + 1; L.dist = (L.dist + 1) & 0xFF; }
    r = true;
  }
  L.dir = dirOf(oy * 3 + ox);                                            // 6f00:03c3
  return r;
}

const tileAt = (map, x, y) => map.b[(7 + y * 0x32 + x) & 0xFFFF];        // cm_Map^.grid[y, x]
const height = (t) => G.ds[0x26A3 + t * 4];                              // CombatTerrain[t] +1
const obstacle = (t) => G.ds[0x26A4 + t * 4];                            // CombatTerrain[t] +2

// 6F00:03EA TraceLine(x0, y0, var x1, var y1, var range, map): true = target reached (range := distance)
export function TraceLine(x0, y0, x1, y1, range, map) {
  const limit = ((range.v & 0xFFFF) * 2 + 1) & 0xFFFF;                   // 6f00:03f3
  const L = newLine();
  L.x0 = sx8(x0); L.y0 = sx8(y0); L.x1 = sx8(x1.v); L.y1 = sx8(y1.v);
  LineInit(L);                                                           // 6f00:0424
  const H = newLine();
  const h0 = height(tileAt(map, L.x0, L.y0));
  H.x0 = 0; H.y0 = h0;                                                   // 6f00:0429 .. 0458
  H.x1 = L.adx > L.ady ? L.adx : L.ady;                                  // 6f00:045c .. 046d
  H.y1 = height(tileAt(map, L.x0, L.y0));                                // 6f00:0496 quirk: the start tile again
  LineInit(H);                                                           // 6f00:049e
  for (;;) {
    if ((map.b[6] === 0 && obstacle(tileAt(map, L.x, L.y)) > H.y) || L.dist > limit) {   // 6f00:04a5 .. 04e1
      x1.v = L.x & 0xFF; y1.v = L.y & 0xFF; range.v = L.dist;            // 6f00:04e4 .. 04fd
      return false;
    }
    LineStep(H);                                                         // 6f00:050b
    if (!LineStep(L)) { range.v = L.dist; return true; }                 // 6f00:0517 / 0532
  }
}

// 6F00:054A InFrontArc(sx, sy, tx, ty, dir): target in the quadrant in front (dir FFh -> 8 = all directions)
export function InFrontArc(sx, sy, tx, ty, dir) {
  sx = sx8(sx); sy = sx8(sy); tx = sx8(tx); ty = sx8(ty);
  if (sx < 0 || sx > 0x31 || sy < 0 || sy > 0x18 || tx < 0 || tx > 0x31 || ty < 0 || ty > 0x18) return false;   // 6f00:0550
  if (dir === 0xFF) dir = 8;                                             // 6f00:0580
  const fx = sx8(sx + (DX[dir] ?? 0)), fy = sx8(sy + (DY[dir] ?? 0));    // 6f00:0587
  if ((sx === tx && sy === ty) || (fx === tx && fy === ty)) return true; // 6f00:05c5
  switch (dir) {                                                         // 6f00:05c5 .. 08d6
    case 0: return (tx >= fx && ty <= fy + fx - tx) || (tx <= fx && ty <= fy + tx - fx);
    case 1: return (tx >= fx && ty <= fy + fx - tx) || (tx >= fx + fy - ty && ty <= fy);
    case 2: return (tx >= fx + fy - ty && ty <= fy) || (tx >= fx + ty - fy && ty >= fy);
    case 3: return (tx >= fx + ty - fy && ty >= fy) || (tx >= fx && ty >= fy + tx - fx);
    case 4: return (tx >= fx && ty >= fy + tx - fx) || (tx <= fx && ty >= fy + fx - tx);
    case 5: return (tx <= fx && ty >= fy + fx - tx) || (tx <= fx + fy - ty && ty >= fy);
    case 6: return (tx <= fx + fy - ty && ty >= fy) || (tx <= fx + ty - fy && ty <= fy);
    case 7: return (tx <= fx + ty - fy && ty <= fy) || (tx <= fx && ty <= fy + tx - fx);
    case 8: return true;
  }
  return false;                                                          // TODO(decode): dir 9..FEh leaves the result undefined
}

// 6F00:08E3 BuildTargetList(col, row, range, dir, size, map)
export function BuildTargetList(col, row, range, dir, size, map) {
  if (!Array.isArray(G.tg_List)) G.tg_List = [];
  const ac = [], ar = [], tc = [], tr = [];
  const dx = { v: 0 }, dy = { v: 0 };
  for (let k = 0; k <= 3; k++) {                                         // 6f00:08e9
    if (FootprintCell(size, k, dx, dy)) { ac[k] = sx8(col + dx.v); ar[k] = sx8(row + dy.v); }   // 6f00:0904 / 0922
    else ac[k] = -1;                                                     // 6f00:0946
  }
  G.tg_Count = 0;                                                        // 6f00:0950
  const count = G.cb_Size[0] & 0xFF;                                     // 6f00:0955
  for (let n = 1; n <= count; n++) {
    if ((G.cb_Size[n] & 0xFF) === 0) continue;                           // 6f00:0978
    let found = false, best = 0xFF, bk = 0, bm = 0;                      // 6f00:0982 / 0986
    for (let m = 0; m <= 3; m++) {                                       // 6f00:098b
      if (FootprintCell(G.cb_Size[n], m, dx, dy)) { tc[m] = sx8(G.cb_Col[n] + dx.v); tr[m] = sx8(G.cb_Row[n] + dy.v); }   // 6f00:09b2
      else tc[m] = -1;                                                   // 6f00:0a0c
    }
    for (let m = 0; m <= 3; m++) {                                       // 6f00:0a19 target cells
      if (tc[m] < 0) continue;
      for (let k = 0; k <= 3; k++) {                                     // 6f00:0a32 attacker cells
        if (ac[k] < 0) continue;
        if (!InFrontArc(ac[k], ar[k], tc[m], tr[m], dir)) continue;      // 6f00:0a7c
        const x = { v: tc[m] }, y = { v: tr[m] }, d = { v: range & 0xFFFF };   // 6f00:0a83 .. 0aa0
        if (TraceLine(ac[k], ar[k], x, y, d, map)) {                     // 6f00:0acf
          found = true;                                                  // 6f00:0ad6 quirk: before the distance test
          if (d.v < best) { best = d.v; bk = k; bm = m; }                // 6f00:0add
        }
      }
    }
    if (found) {                                                         // 6f00:0b06
      G.tg_Count++;                                                      // 6f00:0b0f
      let d = 0;                                                         // 6f00:0b39
      if (dir < 8) d = dir;                                              // 6f00:0b3d
      else while (!InFrontArc(ac[bk], ar[bk], tc[bm], tr[bm], d)) d++;   // 6f00:0b7c
      G.tg_List[G.tg_Count] = { who: n, dist: best & 0xFF, dir: d & 0xFF };   // 6f00:0b22 / 0b35 / 0b97
    }
  }
  SortTargets();                                                         // 6f00:0ba6
}

// 6F00:0000 ov31_0000 / 6F00:0BB0 ov31_init: empty.
