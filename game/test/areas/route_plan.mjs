// game/test/areas/route_plan.mjs — plans DOSBox key routes on a GEO map for the reference runs (cab-build-areas).
// Uses the build's own map getters (view_ov30.js GetPassage / GetCellAttr) on the player's GEO<set>.DAX record, and a
// breadth-first search over (x, y, facing) with the explore-menu keys: Up = step (passage 1 = open), Left / Right = turn.
// Usage: node game/test/areas/route_plan.mjs <set> <geoId> <x> <y> <facing 0/2/4/6> <attr & 7Fh> [...more attrs]
// Prints the map's attribute grid and, per target attribute, the shortest key sequence (driver tokens Up / Left / Right).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DATA } from './fixture.mjs';
import { G } from '../../engine/state.js';
import { view, GetPassage, GetCellAttr, DX, DY } from '../../areas/view_ov30.js';

function rle(src) {
  const out = []; let i = 0;
  while (i < src.length) { const c = src[i]; if (c <= 0x7E) { for (let k = 0; k <= c; k++) out.push(src[i + 1 + k]); i += c + 2; }
    else { for (let k = 0; k < 0x100 - c; k++) out.push(src[i + 1]); i += 2; } }
  return Uint8Array.from(out);
}
function record(file, id) {
  const d = readFileSync(path.join(DATA, file)), n = d.readUInt16LE(0);
  for (let i = 0; i < n / 9; i++) { const o = 2 + 9 * i;
    if (d[o] === id) return rle(d.subarray(2 + n + d.readUInt32LE(o + 1), 2 + n + d.readUInt32LE(o + 1) + d.readUInt16LE(o + 7))); }
  return null;
}
const [set, geo, x0, y0, d0, ...targets] = process.argv.slice(2).map(Number);
const rec = record('GEO' + set + '.DAX', geo);
view.map.set(rec.subarray(2, 0x402)); G.ecl_Block = geo;
for (let y = 0; y < 16; y++) console.log(Array.from({ length: 16 }, (_, x) => (GetCellAttr(x, y) & 0x7F).toString(16).padStart(2, ' ')).join(' '));
for (const t of targets) {
  const key = (x, y, d) => `${x},${y},${d}`, prev = new Map([[key(x0, y0, d0), null]]), q = [[x0, y0, d0]];
  let hit = null;
  while (q.length && !hit) {
    const [x, y, d] = q.shift();
    if ((GetCellAttr(x, y) & 0x7F) === t && !(x === x0 && y === y0)) { hit = [x, y, d]; break; }
    const nxt = [['Left', x, y, (d + 6) % 8], ['Right', x, y, (d + 2) % 8]];
    if (GetPassage(x, y, d) === 1) nxt.push(['Up', (x + DX[d] + 16) % 16, (y + DY[d] + 16) % 16, d]);
    for (const [k, nx, ny, nd] of nxt) if (!prev.has(key(nx, ny, nd))) { prev.set(key(nx, ny, nd), [k, key(x, y, d)]); q.push([nx, ny, nd]); }
  }
  if (!hit) { console.log(`attr ${t}: unreachable`); continue; }
  const keys = []; let k = key(...hit);
  while (prev.get(k)) { const [kk, p] = prev.get(k); keys.unshift(kk); k = p; }
  console.log(`attr ${t}: at ${hit[0]},${hit[1]} facing ${hit[2]} — ${keys.length} keys: ${keys.join(' ')}`);
}
