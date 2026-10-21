// game/test/view/view_units.test.mjs — unit checks of VIEW routines that need no game files (cab-build-areas).
// Run: node game/test/view/view_units.test.mjs   (exit code 1 on a failure)
import assert from 'node:assert/strict';
import { G } from '../../engine/state.js';
import { view, InMap, GetWallType, GetPassage, GetCellAttr } from '../../areas/view_ov30.js';
import { newLine, LineInit, LineStep, Sign, InFrontArc, SortTargets } from '../../areas/view_ov31.js';
import { FootprintCell, InWindow } from '../../areas/view_ov32.js';
import { ListItem, ListCount, NewMenuList } from '../../areas/view_ov26.js';

let n = 0;
const t = (name, f) => { f(); n++; console.log('ok', name); };

t('InMap bounds (6d00:0556)', () => {
  assert.equal(InMap(0, 0), true); assert.equal(InMap(15, 15), true);
  assert.equal(InMap(16, 0), false); assert.equal(InMap(0xFF, 3), false);   // shortint -1
});

t('map getters: planes, bounded vs wrapping blocks (6d00:0587 / 06bd / 07c6)', () => {
  view.map.fill(0);
  view.map[3 * 16 + 2] = 0xA5;                   // N = A, E = 5 at (2,3)
  view.map[0x100 + 3 * 16 + 2] = 0x3C;           // S = 3, W = C
  view.map[0x200 + 3 * 16 + 2] = 0x81;           // cell attribute
  view.map[0x300 + 3 * 16 + 2] = 0b10_01_11_10;  // W 2, S 1, E 3, N 2
  assert.deepEqual([0, 2, 4, 6].map((d) => GetWallType(2, 3, d)), [0xA, 5, 3, 0xC]);
  assert.deepEqual([0, 2, 4, 6].map((d) => GetPassage(2, 3, d)), [2, 3, 1, 2]);
  assert.equal(GetCellAttr(2, 3), 0x81);
  view.map[0x300 + 3 * 16 + 2] = 0;              // no wall -> passage 1 regardless of the bits
  view.map[3 * 16 + 2] = 0;
  assert.equal(GetPassage(2, 3, 0), 1);
  G.ecl_Block = 0; assert.equal(GetCellAttr(-1, 3), 0);    // bounded map: outside = 0
  G.ecl_Block = 5; view.map[0x200 + 3 * 16 + 15] = 7;
  assert.equal(GetCellAttr(-1, 3), 7);                      // wrapping map: x -1 -> 15
});

t('LineStep Bresenham, x-major on ties (6f00:0246)', () => {
  const L = newLine(); L.x0 = 0; L.y0 = 0; L.x1 = 3; L.y1 = 1; LineInit(L);
  const pts = [];
  while (LineStep(L)) pts.push([L.x, L.y, L.dist, L.dir]);
  assert.deepEqual(pts, [[1, 0, 2, 2], [2, 1, 5, 3], [3, 1, 7, 2]]);
  const D = newLine(); D.x1 = 2; D.y1 = -2; LineInit(D);
  assert.equal(LineStep(D), true); assert.deepEqual([D.x, D.y, D.dist, D.dir], [1, -1, 3, 1]);   // tie: x-major + diagonal
  assert.equal(Sign(-5), -1); assert.equal(Sign(0), 0);
});

t('InFrontArc quadrants', () => {
  assert.equal(InFrontArc(10, 10, 10, 5, 0), true);   // straight north, facing north
  assert.equal(InFrontArc(10, 10, 10, 15, 0), false); // behind
  assert.equal(InFrontArc(10, 10, 10, 15, 0xFF), true);
  assert.equal(InFrontArc(60, 10, 10, 15, 8), false); // outside 50x25
});

t('SortTargets by distance, direction tie rule', () => {
  G.tg_List = [null, { who: 1, dist: 9, dir: 2 }, { who: 2, dist: 4, dir: 6 }, { who: 3, dist: 4, dir: 0 }];
  G.tg_Count = 3; SortTargets();
  assert.deepEqual(G.tg_List.slice(1).map((e) => e.who), [3, 2, 1]);
});

t('FootprintCell / InWindow (7000:0011 / 0732)', () => {
  const dx = { v: 0 }, dy = { v: 0 };
  const saved = G.ds; G.ds = null;
  assert.equal(FootprintCell(4, 3, dx, dy), true); assert.deepEqual([dx.v, dy.v], [1, 1]);
  assert.equal(FootprintCell(2, 2, dx, dy), false);
  assert.equal(FootprintCell(0, 0, dx, dy), false);
  G.ds = saved;
  assert.equal(InWindow(6, 0), true); assert.equal(InWindow(7, 0), false);
});

t('menu lists (6800:0011 / 0074 / 1199)', () => {
  const l = { v: null }; NewMenuList(l, 3);
  assert.equal(ListCount(l.v), 3); assert.equal(ListItem(l.v, 2).next, null); assert.equal(ListItem(l.v, 3), null);
});

console.log(`${n} VIEW unit checks passed`);
