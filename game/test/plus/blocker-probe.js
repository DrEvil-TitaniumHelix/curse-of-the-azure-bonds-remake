// game/test/plus/blocker-probe.js — GBP W3 blockers: title/credits any-key screens and overland travel, headless helpers.
import { hooks } from '../../plus/hooks.js';
import { travel, overlandPos, overlandPath } from '../../plus/click/travel.js';
import { rc, pick } from './click-probe.js';

export function watchScreens() {
  if (!window.__aw) { window.__aw = []; hooks.on('anyKeyWait', (p) => window.__aw.push(p.screen)); hooks.on('menuDrawn', (p) => { if (p.region === 'pmenu') window.__aw.push('PM-01'); }); }
  return window.__aw;
}
export const regions = () => hooks.regions().map((r) => r.id);
// overland: right-click the reachable window cell with the longest path (<= max), choose Travel there, wait
export async function overlandFar(max = 4) {
  const p = overlandPos(), reg = hooks.regions().find((r) => r.id === 'plus-overland');
  if (!reg) throw new Error('no overland region: ' + regions().join(','));
  const { view } = await import('../../areas/view.js');
  const g = view.g, off = g.ds[0x3C76 + g.travel_Mode];
  const o = window.__ov;                                   // origin from the last overland viewDrawn
  let best = null;
  for (let r = 0; r <= 4; r++) for (let c = 0; c <= 4; c++) {
    const x = o.x + c - off, y = o.y + r, d = overlandPath(p.x, p.y, x, y);
    if (d && d.length && d.length <= max && (!best || d.length > best.n)) best = { x, y, n: d.length, c, r };
  }
  if (!best) throw new Error('nothing reachable around ' + JSON.stringify(p));
  const list = rc(8 + best.c * 24 + 12, 8 + best.r * 24 + 12);
  const res = await pick(8 + best.c * 24 + 12, 8 + best.r * 24 + 12, 'Travel there');
  for (let k = 0; k < 40 && !travel.walk; k++) await new Promise((r) => setTimeout(r, 25));   // the walker starts after a module load
  let t = 0; while (travel.walk && t++ < 600) await new Promise((r) => setTimeout(r, 50));
  return { from: p, target: best, list, picked: res.picked, at: overlandPos(), walking: !!travel.walk, path: travel.lastPath };
}
export function watchOverland() { if (!window.__ovw) { window.__ovw = 1; hooks.on('viewDrawn', (p) => { if (p.mode === 'overland') window.__ov = p.origin; }); } return window.__ov || null; }
