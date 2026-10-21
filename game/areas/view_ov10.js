// game/areas/view_ov10.js — VIEW ov10 (3300): combat battlefield construction and party deployment (StartCombat).
// Owner: cab-build-areas. Source: decode/pseudo/VIEW.pas.md ov10 (screen VIEW-05); the summarised routines (corner
// fillers, field generators, FindDeploySpot, DeployParty) translated from decode/listings/ov10.c (Ghidra parameter lists
// read right-to-left = Pascal order) and checked on ov10.lst. Findings vs Pool 5200 / VIEW.pas.md:
//  - FillSquareNE: north = 0 and the probe north = 1 gives 7 / 0Bh / 3 (east = 0 and probe east = 0 / east = 0 / else);
//    Pool gave 0Bh / 3.
//  - ScatterFloorDebris runs per 3D square over rows 2..4 and the skewed columns row + 2..3 (`col = r + k + base`); the
//    Roll calls are short-circuit evaluated after the frame / cell_Door / sq_Open tests (RNG order matters).
//  - BuildRoadOrRidge: `Roll(1,20) = 1` places a boulder pair; PlaceBoulderPair(col, row) writes col+1 (tests col < 49).
//  - BuildGroundCover: a score below -30 places nothing (no case matches).
//  - DeployParty: cb_Size[0] starts at 1 and counts every kept member (as Pool); an unplaced extra is removed with
//    RemovePartyMember(1, 0) and the walk continues from the previous member; the list is cut after the last kept one.
//  - FindDeploySpot: `local_4` (the placed flag) is uninitialised when the first probe is outside the box (0 here).
// Shapes: as view_ov32.js (cb_* arrays, cm_Map = { b }, corpse_List / corpse_Count, c.combat = { b: Uint8Array(16h) }).
// Deployment globals (DS:4A04..4A12): dep_StartX[2], dep_StartY[2], dep_Half[2], dep_Facing[2], dep_Side; boxes
// dep_Boxes DS:47F4 [side*108h + tmpl*42h + r*0Bh + c] (2 x 4 x 6 x 11).

import { G } from '../engine/state.js';
import { DrawText, MessageDelay } from '../engine/text.js';
import { AllocPicture, FreePicture } from '../engine/pictures.js';
import { PollOneKey } from '../engine/input.js';
import { hooks } from '../plus/hooks.js';   // GBP W1 (docs/PLUS_HOOKS.md)
import { view, DX, DY, sx8, GetPassage, GetWallType, GetCellAttr } from './view_ov30.js';
import { ClearMenuLine } from './view_ov26.js';
import { FreeAnimation } from './view_ov29.js';
import { Load24x24Set } from './view_ov33.js';
import { RebuildOccupancy, ProbeMove, CombatantCol, CombatantRow } from './view_ov32.js';
import { X } from './view_link.js';

const ds = (o) => G.ds[o & 0xFFFF];
const S = (o) => sx8(G.ds[o & 0xFFFF]);
const frameOf = (t) => G.ds[0x26A5 + t * 4];             // CombatTerrain[t] +3
const costOf = (t) => G.ds[0x26A2 + t * 4];              // CombatTerrain[t] +0
const map = () => G.cm_Map.b;
const gridAt = (row, col) => map()[7 + row * 50 + col];
const setGrid = (row, col, t) => { const i = 7 + row * 50 + col; if (i >= 7 && i < map().length) map()[i] = t & 0xFF; };
const roll = async (n, s) => (await X.Roll(n, s)) & 0xFF;
const arr2 = (name) => { if (!Array.isArray(G[name])) G[name] = [0, 0]; return G[name]; };
const boxes = () => { if (!(G.dep_Boxes instanceof Uint8Array)) G.dep_Boxes = new Uint8Array(0x210); return G.dep_Boxes; };
const cbArrays = () => { for (const k of ['cb_Col', 'cb_Row', 'cb_Index', 'cb_Size', 'cb_Char']) if (!Array.isArray(G[k])) G[k] = new Array(256).fill(k === 'cb_Char' ? null : 0); };

// 3300:0048 PutCombatTile(col, row, tile): each 3D square becomes a 6x5 block skewed by 5 columns per map row
function PutCombatTile(col, row, tile) {
  const c = sx8(col + G.sq_dx * 6 + G.sq_dy * 5 + 0x15), r = sx8(row + G.sq_dy * 5 + 10);   // 3300:004b / 005d
  if (c >= 0 && c < 50 && r >= 0 && r < 25) setGrid(r, c, tile + 1);   // 3300:0097
}

// 3300:00CC ScatterFloorDebris (per square)
async function ScatterFloorDebris() {
  const N = G.sq_North, E = G.sq_East, Sth = G.sq_South, W = G.sq_West;
  G.sq_Open = ((N === 1 || E === 1 || Sth === 1 || W === 1) &&
    (N !== 1 || Sth !== 1 || (E === 1 && W === 1)) && (E !== 1 || W !== 1 || (N === 1 && Sth === 1)) &&
    N !== 3 && E !== 3 && Sth !== 3 && W !== 3) ? 1 : 0;                 // 3300:00cc .. 0139
  for (let k = 2; k <= 3; k++)
    for (let r = 2; r <= 4; r++) {
      const c1 = sx8(r + k + G.sq_dx * 6 + G.sq_dy * 5 + 0x15), r1 = sx8(G.sq_dy * 5 + 10 + r);
      if (c1 >= 0 && c1 < 50 && r1 >= 0 && r1 < 25 && frameOf(gridAt(r1, c1)) === 0x16 && G.cell_Door !== 0 &&
          G.sq_Open !== 0 && await roll(1, 10) < 6) {                    // 3300:019b
        setGrid(r1, c1, 0x1A);
        for (let n = 1; n <= 4; n++) {                                   // 3300:0250 .. 02be
          const c2 = sx8(S(0x349 + n) + c1), r2 = sx8(S(0x34D + n) + r1);
          if (c2 >= 0 && c2 < 50 && r2 >= 0 && r2 < 25 && frameOf(gridAt(r2, c2)) === 0x16 && await roll(1, 10) < 10)
            setGrid(r2, c2, 0x1B);
        }
      }
    }
}

// 3300:02F6 ProbeSide(x, y, dir) (nested in ProbeWall)
function ProbeSide(x, y, dir) {
  x = sx8(x); y = sx8(y);
  if (x < 0 || x > 15 || y < 0 || y > 15) return (y === sx8(G.party_MapY) && (dir === 2 || dir === 6)) ? 0 : 1;   // 3300:0300
  if (GetPassage(x, y, dir) === 0) return 1;                             // 3300:0320
  return GetWallType(x, y, dir) === 0 ? 0 : 3;                           // 3300:033b
}
// 3300:0378 ProbeWall(x, y, dir)
export function ProbeWall(x, y, dir) {
  return ProbeSide(x, y, dir) | ProbeSide(sx8(x) + DX[dir], sx8(y) + DY[dir], (dir + 4) % 8);   // 3300:039e / 03d4
}

// 3300:03EC FillSquareFloor
function FillSquareFloor() {
  for (let row = 2; row <= 4; row++) for (let col = 0; col <= 5; col++) PutCombatTile(col, row, 0x16);   // 3300:0410
  if (G.sq_West === 1) for (let row = 2; row <= 4; row++) {
    PutCombatTile(row - 1, row, 4); PutCombatTile(row, row, 3); PutCombatTile(row + 1, row, 0x0D);   // 3300:043e / 044d / 045f
  } else if (G.sq_West === 3) { PutCombatTile(1, 2, 8); PutCombatTile(5, 4, 0); }   // 3300:047b / 0488
}
// 3300:0491 FillSquareNorth
function FillSquareNorth() {
  const t0 = G.sq_North === 1 ? 5 : 0x16, t1 = G.sq_North === 1 ? 0x0A : 0x16;
  PutCombatTile(3, 0, t0); PutCombatTile(4, 0, t0); PutCombatTile(3, 1, t1); PutCombatTile(4, 1, t1);   // 3300:04a8 .. 0505
}
// 3300:050E FillSquareNW(x, y) (locals stay uninitialised when no case matches: 0 here)
function FillSquareNW(x, y) {
  const N = G.sq_North, W = G.sq_West;
  const open = ProbeWall(x, y - 1, 6) === 0 && ProbeWall(x - 1, y, 0) === 0;   // 3300:052a / 0547
  let a = 0, b = 0, c = 0, d = 0;
  if (N === 0) a = W === 0 ? 0x16 : W === 3 ? 0x0D : W === 1 ? (open ? 0 : 0x0D) : 0;
  else if (N === 3 || N === 1) a = W === 0 ? (open ? 0x0F : 5) : (open ? 0x12 : 2);
  b = N === 0 ? 0x16 : N === 3 ? 0x11 : N === 1 ? 5 : 0;
  if (W === 0) c = N === 0 ? 0x16 : (open ? 0x10 : 10);
  else if (W === 3) c = open ? 0x14 : 7;
  else if (W === 1) c = open ? 1 : 3;
  if (W === 0 || W === 3) d = N === 0 ? 0x16 : N === 3 ? 0x17 : N === 1 ? 10 : 0;
  else if (W === 1) d = N === 0 ? 0x0D : N === 3 ? 0x15 : N === 1 ? 6 : 0;
  PutCombatTile(1, 0, a); PutCombatTile(2, 0, b); PutCombatTile(1, 1, c); PutCombatTile(2, 1, d);   // 3300:06b9 .. 06e3
}
// 3300:06EC FillSquareNE(x, y)
function FillSquareNE(x, y) {
  const N = G.sq_North, E = G.sq_East;
  const pN = ProbeWall(x, y - 1, 2), pE = ProbeWall(x + 1, y, 0);        // 3300:0708 / 0724
  const open = pN === 0 && pE === 0;
  let a = 0, b = 0, c = 0, d = 0;
  if (N === 0) a = pN === 1 ? 4 : 0x16; else if (N === 3) a = 0x0F; else if (N === 1) a = 5;
  if (N === 0) {
    if (pN === 0) b = 0x16;
    else if (pN === 3) b = (E === 0 && pE !== 0) ? 0x18 : 1;
    else if (pN === 1) b = E === 0 ? (pE === 0 ? 7 : 0x0B) : 3;
  } else if (E === 0) b = pE === 0 ? (open ? 0x11 : 0x13) : 5;
  else b = 9;
  c = N === 0 ? 0x16 : N === 3 ? 0x10 : N === 1 ? 10 : 0;
  if (N === 0) d = pN === 0 ? 0x16 : E === 0 ? (pE === 0 ? 8 : 0x0C) : 4;
  else d = E === 0 ? (pE === 0 ? 0x17 : 10) : 0x0E;
  PutCombatTile(5, 0, a); PutCombatTile(6, 0, b); PutCombatTile(5, 1, c); PutCombatTile(6, 1, d);   // 3300:0896 .. 08c0
}

// 3300:08C9 BuildDungeonField
async function BuildDungeonField() {
  for (G.sq_dy = -2; G.sq_dy <= 2; G.sq_dy++)                           // 3300:08cc
    for (G.sq_dx = -6; G.sq_dx <= 6; G.sq_dx++) {                       // 3300:08d6
      const x = sx8(G.party_MapX + G.sq_dx), y = sx8(G.party_MapY + G.sq_dy);
      G.sq_West = ProbeWall(x, y, 6);                                    // 3300:0903
      G.sq_North = ProbeWall(x, y, 0);                                   // 3300:0915
      G.sq_East = ProbeWall(x, y, 2);                                    // 3300:0927
      G.sq_South = ProbeWall(x, y, 4);                                   // 3300:0939
      FillSquareFloor(); FillSquareNorth(); FillSquareNW(x, y); FillSquareNE(x, y);   // 3300:094c .. 095c
      G.cell_Door = GetCellAttr(x, y) & 0x40;                            // 3300:095f
      await ScatterFloorDebris();                                        // 3300:0971
    }
}

// 3300:098D TerrainFlags: the 32-entry image table DS:0352 by location number
export function TerrainFlags() { return ds(0x352 + (G.terrain_Loc & 0xFF)); }

// 3300:09A8 PlaceBoulderPair(col, row)
function PlaceBoulderPair(col, row) {
  col = sx8(col); row = sx8(row);
  if (col < 49) map()[7 + row * 50 + col + 1] = 0x40;                   // 3300:09ab
  if (row < 24 && col < 49) map()[7 + (row + 1) * 50 + col + 1] = 0x41; // 3300:09d8
}

// 3300:09FE BuildRoadOrRidge
async function BuildRoadOrRidge() {
  let chance = 0;
  if (TerrainFlags() & 0x20) chance = 0x23;                              // 3300:0a09
  if (TerrainFlags() & 0x10) chance = 0x4B;                              // 3300:0a17
  if (await roll(1, 100) > chance) return;                               // 3300:0a2a
  let c = sx8(0x22 - await roll(5, 4));                                  // 3300:0a46
  while ((c + 2) % 7 > 0) c = sx8(c - 1);
  for (let row = 0; row <= 24; row++) {
    if (c < 0x32) {
      map()[7 + row * 50 + c] = ((await roll(1, 2)) + 0x3B) & 0xFF;      // 3300:0aa4
      if (c < 0x31) map()[7 + row * 50 + c + 1] = ((await roll(1, 2)) + 0x3D) & 0xFF;   // 3300:0ad0
      if (await roll(1, 20) === 1) PlaceBoulderPair(c, row);             // 3300:0af7
      c = sx8(c + 1);
    }
  }
}

// 3300:0B0A BuildTrees
async function BuildTrees() {
  if (TerrainFlags() & 0x80) return;                                     // 3300:0b11
  let density = 10;
  if (TerrainFlags() & 2) density = 5;
  if (TerrainFlags() & 4) density -= 2;
  if (TerrainFlags() & 0x40) density += 5;
  if (TerrainFlags() & 8) density += 10;
  if (density < 0) density = 1;                                          // 3300:0b72
  for (let col = 0; col <= 49; col++)
    for (let row = 1; row <= 24; row++)
      if (frameOf(gridAt(row, col)) === 0x16 && frameOf(gridAt(row - 1, col)) === 0x16 && await roll(1, 100) <= density) {   // 3300:0bb0
        if (density < await roll(1, 100)) {                              // two-cell tree
          map()[7 + (row - 1) * 50 + col] = ((await roll(1, 5)) + 0x1F) & 0xFF;   // 3300:0c19
          map()[7 + row * 50 + col] = ((await roll(1, 5)) + 0x24) & 0xFF;
        } else map()[7 + row * 50 + col] = ((await roll(1, 2)) + 0x29) & 0xFF;     // 3300:0c7a
      }
}

// 3300:0CA1 PutGroundCover(col, row, t1, t2, t3, t4, t5)
async function PutGroundCover(col, row, t1, t2, t3, t4, t5) {
  const r = await roll(1, 100);                                          // 3300:0ca9
  const i = 7 + row * 50 + col;
  if (r <= t1) map()[i] = ((await roll(1, 2)) + 0x39) & 0xFF;
  else if (r <= t1 + t2) map()[i] = ((await roll(1, 2)) + 0x2F) & 0xFF;
  else if (r <= t1 + t2 + t3) map()[i] = ((await roll(1, 4)) + 0x2B) & 0xFF;
  else if (r <= t1 + t2 + t3 + t4) map()[i] = ((await roll(1, 3)) + 0x36) & 0xFF;
  else if (r <= t1 + t2 + t3 + t4 + t5) map()[i] = ((await roll(1, 4)) + 0x31) & 0xFF;   // 3300:0e46
}

// 3300:0E49 BuildGroundCover
async function BuildGroundCover() {
  let s = 50;
  if (TerrainFlags() & 0x10) s = 60;                                     // 3300:0e55 .. 0ea2
  if (TerrainFlags() & 0x20) s += 30;
  if (TerrainFlags() & 0x40) s += 20;
  if (TerrainFlags() & 4) s -= 10;
  if (TerrainFlags() & 2) s -= 20;
  if (TerrainFlags() & 0x80) s -= 50;
  for (let col = 0; col <= 49; col++)
    for (let row = 0; row <= 24; row++) {
      if (frameOf(gridAt(row, col)) !== 0x16) continue;
      if (s >= -30 && s <= 9) await PutGroundCover(col, row, 0, 0, 0, 30, 15);        // 3300:0f0d
      else if (s >= 10 && s <= 29) await PutGroundCover(col, row, 0, 1, 5, 20, 10);   // 3300:0f36
      else if (s >= 30 && s <= 69) await PutGroundCover(col, row, 0, 2, 5, 10, 5);    // 3300:0f5e
      else if (s >= 70 && s <= 89) await PutGroundCover(col, row, 10, 2, 10, 10, 1);  // 3300:0f86
      else if (s >= 90 && s <= 110) await PutGroundCover(col, row, 15, 5, 15, 10, 1); // 3300:0fae
    }
}

// 3300:0FC7 BuildWildernessField
async function BuildWildernessField() {
  map().fill(0x17, 7, 7 + 0x4E2);                                        // 3300:0fd6
  G.terrain_Loc = view.mem(0x4CA1) & 0xFF;                               // 3300:0fe3 location number
  await BuildRoadOrRidge(); await BuildTrees(); await BuildGroundCover();   // 3300:1008 / 100c / 1010
}

// 3300:102F PrepareBattlefield
export async function PrepareBattlefield() {
  if (view.mem(0x4BE6) === 0) await Load24x24Set('WildCom', 1, 0, 0x21); // 3300:106f
  else await Load24x24Set('DungCom', 1, 0, 0x19);                        // 3300:1059
  await Load24x24Set('RandCom', 1, 0x22, 6);                             // 3300:108c
  G.cm_Map = { b: new Uint8Array(0x4E9) };                               // 3300:109a GetMem (heap garbage: 0 here)
  map()[4] = 0; map()[5] = 1; map()[6] = 0;
  if (view.mem(0x4BE6) === 0) await BuildWildernessField(); else await BuildDungeonField();   // 3300:10d5 / 10d0
}

// 3300:10DD InitPartyCombatants
export async function InitPartyCombatants() {
  let k = 0;
  for (let c = G.PartyList; c; c = c.next) {
    await X.RecalcItems(c);                                              // 3300:1104
    k++;
    c.combat = { b: new Uint8Array(0x16) };                              // 3300:1119 GetMem + FillChar
    if ((view.mem(0x7F3E) & 0xFFFF) < k) c.combat.b[0x13] = 1;           // extras beyond Mem[7F3E]
    c.combat.b[9] = ds(0x2FA + (G.party_Dir >> 1));                      // facing 7, 2, 3, 6
    if (c.b[0x197] === 1) c.combat.b[9] = (c.combat.b[9] + 4) % 8;       // enemy side
    const m = c.b[0xF7] & 0x7F;
    if (c.b[0x197] === 0 && c.combat.b[0x13] === 1 && (m === 0 || m > 0x66))
      c.b[0xF7] = (view.mem(0x7EC6) - 0x80) & 0xFF;                      // 3300:11bd NPC morale
  }
}

// 3300:11FB OutsideDeployBox(c, r)
function OutsideDeployBox(c, r) { c = sx8(c); r = sx8(r); return (c < 0 || c > 10) && (r < 0 || r > 5); }

// 3300:122C TryPlaceCombatant(who, c, r, sq_x, sq_y, tmpl)
function TryPlaceCombatant(who, c, r, sqx, sqy, tmpl) {
  c = sx8(c); r = sx8(r);
  const bi = G.dep_Side * 0x108 + tmpl * 0x42 + r * 0x0B + c;
  if (c < 0 || r < 0 || c > 10 || r > 5 || boxes()[bi] === 0) return false;
  G.cb_Col[who] = (c + sqx * 6 + sqy * 5 + 0x16) & 0xFF;                // 3300:1294
  G.cb_Row[who] = (r + sqy * 5 + 0x0A) & 0xFF;                           // 3300:12b8
  const o = { v: 0 }, t = { v: 0 }, h1 = { v: 0 }, h2 = { v: 0 };
  ProbeMove(G.cb_Char[who], 8, o, t, h1, h2);                            // 3300:1307
  if (o.v === 0 && t.v !== 0 && costOf(t.v) !== 0xFF) { boxes()[bi] = 0; return true; }
  return false;
}

// 3300:1370 FindDeploySpot(who): spiral through the deployment template, stepping to open neighbour squares
async function FindDeploySpot(who) {
  const side = G.dep_Side, sx = arr2('dep_StartX'), sy = arr2('dep_StartY'), half = arr2('dep_Half'), face = arr2('dep_Facing');
  let first = true, fail = false, state = 1, ring = 0, tmpl = 0, run = 0, step = 0;
  let sqx = sx8(sx[side]), sqy = sx8(sy[side]);
  let c0 = 0, r0 = 0, c = 0, r = 0, placed = false;
  const dirs = (k) => ds(0x2FA + k);
  do {
    const u = ds(0x2EA + sx8(face[side]) * 4 + tmpl) >> 1;
    if (state === 1) {
      c = sx8(S(0x2FE + (tmpl !== 0 ? 4 : 0) + u) + DX[dirs((u + 2) % 4)] * ring);
      r = sx8(S(0x306 + (tmpl !== 0 ? 4 : 0) + u) + DY[dirs((u + 2) % 4)] * ring);
      step = 1; state = 2; run = 1; r0 = r; c0 = c;
    } else if (state === 2) {
      c = sx8(c0 + DX[dirs((u + 1) % 4)] * step); r = sx8(r0 + DY[dirs((u + 1) % 4)] * step);
      state = 3; run++;
    } else if (state === 3) {
      c = sx8(c0 + DX[dirs((u + 3) % 4)] * step); r = sx8(r0 + DY[dirs((u + 3) % 4)] * step);
      state = 2; step++; run++;
    }
    const outside = c < 0 || r < 0 || c > 10 || r > 5;
    if (state > 1 && ((outside && !OutsideDeployBox(c, r)) || (first && sx8(half[side]) <= run) || (!first && run > 11))) {
      let b = ring + 1;
      if (side === 0 && (face[0] & 1) && tmpl === 0 && b === 1) {
        const x = sx8(sx[0] + G.party_MapX), y = sx8(sy[0] + G.party_MapY);
        let any = false;
        for (let k = 1; k <= 3; k++)
          if (G.view_Mode === 3 || ProbeWall(x, y, ds(0x2DA + sx8(face[side]) * 4 + k)) !== 1) any = true;   // 3300:169f
        if (any) b = ring + 2;
      }
      ring = b; state = 1; first = false;
    }
    if (outside && OutsideDeployBox(c, r)) {
      placed = false; state = 0;
      while (tmpl < 3 && state !== 1) {
        tmpl++;
        const d = ds(0x2DA + sx8(face[side]) * 4 + tmpl);
        if (G.view_Mode === 3 || ProbeWall(sx8(sx[side] + G.party_MapX), sx8(sy[side] + G.party_MapY), d) !== 1) {   // 3300:175b
          sqx = sx8(sx[side] + DX[d]); sqy = sx8(sy[side] + DY[d]); ring = 0; state = 1;
        }
      }
      if (state !== 1) fail = true;
    }
    if (!outside) placed = TryPlaceCombatant(who, c, r, sqx, sqy, tmpl); // 3300:17d2
  } while (!placed && !fail);
  return !fail;
}

// 3300:1800 DeployParty
export async function DeployParty() {
  cbArrays();
  await X.CountActiveSides();                                            // 3300:1806
  for (let n = 1; n <= 0xFF; n++) G.cb_Size[n] = 0;
  RebuildOccupancy();                                                    // 3300:1832
  const sx = arr2('dep_StartX'), sy = arr2('dep_StartY'), half = arr2('dep_Half'), face = arr2('dep_Facing');
  const act = Array.isArray(G.side_ActiveCount) ? G.side_ActiveCount : [0, 0];
  sx[0] = 0; sy[0] = 0; face[0] = G.party_Dir >> 1;                      // 3300:183c
  sx[1] = (view.mem(0x7EC1) * DX[G.party_Dir]) & 0xFF;                   // encounter distance x step
  sy[1] = (view.mem(0x7EC1) * DY[G.party_Dir]) & 0xFF;
  face[1] = ((G.party_Dir + 4) % 8) >> 1;                                // 3300:189c
  for (let s = 0; s <= 1; s++) half[s] = ((act[s] & 0xFF) + 1) >> 1;     // 3300:18ae
  for (let s = 0; s <= 1; s++)                                           // 3300:18d4 .. 1983 boxes
    for (let e = 0; e <= 3; e++) {
      const f = e === 1 ? 4 : face[s];
      for (let r = 0; r <= 5; r++)
        for (let c = 0; c <= 10; c++)
          boxes()[s * 0x108 + e * 0x42 + r * 0x0B + c] = (c < S(0x30E + f * 12 + r * 2) || S(0x30F + f * 12 + r * 2) < c) ? 0 : 1;
    }
  let d = 1;
  G.cb_Size[0] = 1;
  let prev = G.PartyList, c = G.PartyList;
  while (c) {
    await PollOneKey();                                                  // 3300:1a30
    let next = c.next;
    G.cb_Char[d] = c; G.dep_Side = c.b[0x197]; G.cb_Index[d] = d; G.cb_Size[d] = c.b[0xDE] & 7;   // 3300:19e5 .. 1a7d
    if (!await FindDeploySpot(d)) {                                      // 3300:1a8a
      G.cb_Size[d] = 0;
      if (c.combat.b[0x13] === 1) {                                      // an extra that found no spot leaves the party
        G.cb_Char[d] = null;
        G.SelectedChar = c;
        await X.RemovePartyMember(1, 0);                                 // 3300:1be1
        next = prev ? prev.next : null;                                  // continue from the previous member
        if (prev === c) next = c.next;
      } else { d++; G.cb_Size[0]++; prev = c; }
    } else {
      prev = c;
      if (c.b[0x196] === 0) {                                            // placed but inactive
        G.cb_Size[d] = 0;
        if (G.DuelActive === 0 && c.combat.b[0x13] === 0) {              // 3300:1b1f .. 1b7f corpse entry, tile 1Fh
          const col = sx8(G.cb_Col[d]), row = sx8(G.cb_Row[d]);
          G.corpse_Count = (G.corpse_Count + 1) & 0xFF;
          if (!G.corpse_List) G.corpse_List = [];
          G.corpse_List[G.corpse_Count] = { char: c, col, row, tile: gridAt(row, col) };
          setGrid(row, col, 0x1F);
        }
      }
      RebuildOccupancy();                                                // 3300:1b87
      d++; G.cb_Size[0]++;
    }
    c = next;
  }
  if (prev) prev.next = null;                                            // 3300:1c15 cut after the last kept member
}

// 3300:1C3E StartCombat
export async function StartCombat() {
  G.TextOutputActive = 0;                                                // 3300:1c3e
  FreeAnimation(G.enc_Anim);                                             // 3300:1c49
  G.head_Pic = FreePicture(G.head_Pic) ?? null; G.body_Pic = FreePicture(G.body_Pic) ?? null;
  G.bigpic_Pic = FreePicture(G.bigpic_Pic) ?? null;                      // 3300:1c6c
  G.bigpic_Id = 0xFF; G.head_Id = 0xFF; G.body_Id = 0xFF;
  ClearMenuLine(); await MessageDelay();                                 // 3300:1c80 / 1c85
  DrawText(0, 24, 10, 0, 'A battle begins...');                          // 3300:1ca5
  G.MagicOn = 0; G.CombatRound = 0; G.combat_MaxRounds = 0x0F; G.AttackRollValue = 0; G.corpse_Count = 0;
  G.cloud_List = null; G.cloud9_List = null; G.treasure_Mark = null; G.g_6510 = 0;
  G.corpse_List = [];                                                    // 3300:1cdb FillChar(g_6E59, 38h, 0) = entries 1..8
  view.setMem(0x7F33, 0);                                                // 3300:1ce7
  await PrepareBattlefield(); await PollOneKey();                        // 3300:1cf7
  await InitPartyCombatants(); await PollOneKey();
  await DeployParty(); await PollOneKey();                               // 3300:1d0d
  G.g_75E0 = AllocPicture(0x18, 3, 4, 1);                                // 3300:1d12
  map()[2] = (CombatantCol(G.PartyList) - 3) & 0xFF;                     // 3300:1d2a
  map()[3] = (CombatantRow(G.PartyList) - 3) & 0xFF;                     // 3300:1d43
  await X.ov24_2E05();                                                   // 3300:1d5c combat view refresh (PARTY ov24)
  for (let c = G.PartyList; c; c = c.next) {
    await X.CallEffectHooks(8, c);                                       // 3300:1d75
    await X.CallEffectHooks(0x16, c);                                    // 3300:1d83 (new second hook)
  }
  await X.CalcEnemyHpPct();                                              // 3300:1da3
  G.view_Mode = 5;                                                       // 3300:1da8
}

// 3300:0000 ov10_LoadDeps / 3300:1DB1 ov10_init: empty.
