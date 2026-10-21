// game/plus/click/travel.js — Gold Box Plus W3: click-to-travel on the 3D area map (and for the Plus automap, W7).
// Owner: gbp-click.
//
// path(): breadth-first search over the decoded 16x16 GEO map of the current 3D area (areas/view.js GetPassage: a step
// is taken only where MoveParty 6600:0D6D would walk, passage 1 = open; locked doors are left to the player).
// travelTo(x, y): a walker that types the keyboard player's keys one at a time, each when the explore menu waits again:
// turn (Left / Right / Down = about) and Up. It stops as soon as anything else happens — another menu or prompt (a
// script event on the way), a square other than the expected one, combat — and leaves the game to the player.
// The area map (Area, VIEW-02) registers a Plus region: left click = walk there, right click = walk / the view keys.
// Overland maps (travel modes 2-4, ExploreCommand 6600:0bac): the 5x5 window (24 px tiles from screen 8,8) is a region;
// a step there is one cursor key (it sets the direction and moves, StepOverland 6600:0818), the path search uses the
// game's own rule (view_ov14 OverlandImpassable, the river needs VM 4AA2), the position is VM 49C3 / 49C4.

import { hooks } from '../hooks.js';
import { KEY } from '../../engine/input.js';
import { typeKeys } from './click.js';

const DX = [0, 0, 1, 0, 0, 0, -1, 0], DY = [-1, 0, 0, 0, 1, 0, 0, 0];   // dir 0 N, 2 E, 4 S, 6 W (view.js DX/DY)
let V = null;                                                          // areas/view.js, loaded on demand
export const travel = { walk: null, lastPath: null };

export async function loadView() { V ??= await import('../../areas/view.js'); return V; }

// [dir, ...] from (x0, y0) to (x1, y1) inside the current 3D map, or null
export function path(x0, y0, x1, y1, view = V) {
  if (!view) return null;
  if (x0 === x1 && y0 === y1) return [];
  const prev = new Map([[x0 + y0 * 16, null]]);
  const q = [[x0, y0]];
  while (q.length) {
    const [x, y] = q.shift();
    for (const d of [0, 2, 4, 6]) {
      const nx = x + DX[d], ny = y + DY[d];
      if (nx < 0 || ny < 0 || nx > 15 || ny > 15 || prev.has(nx + ny * 16)) continue;
      if (view.GetPassage(x, y, d) !== 1) continue;
      prev.set(nx + ny * 16, [x + y * 16, d]);
      if (nx === x1 && ny === y1) {
        const dirs = []; let c = nx + ny * 16;
        while (prev.get(c)) { const [p, pd] = prev.get(c); dirs.unshift(pd); c = p; }
        return dirs;
      }
      q.push([nx, ny]);
    }
  }
  return null;
}

const isExploreMenu = (p) => p && p.region === 'hmenu' && (p.items || []).some((i) => /^Encamp$/i.test(i.label.trim()));
function turnKeys(from, to) {
  const d = (to - from + 8) % 8;
  return d === 0 ? [] : d === 2 ? [KEY.right] : d === 6 ? [KEY.left] : [KEY.down];
}

// ---- overland (travel modes 2-4) ----
const ARROW = { 0: KEY.up, 2: KEY.right, 4: KEY.down, 6: KEY.left };
let V14 = null;
async function loadV14() { V14 ??= await import('../../areas/view_ov14.js'); return V14; }
export function overlandPos() {
  const m = hooks.state.mem, p = hooks.state.position();
  return p ? { x: m(0x49C3), y: m(0x49C4), mode: p.travelMode } : null;
}
function overlandFree(nx, ny, view = V, v14 = V14) {
  if (!view || !v14 || nx < 0 || nx > 15 || ny < 0 || ny > 0x23) return false;
  const g = view.view.g, mode = g.travel_Mode;
  const col = (((nx + g.ds[0x3C76 + mode]) & 0xFF) ^ 0x80) - 0x80;
  const t = g.ds[0x3648 + ny * 44 + col];
  if (v14.OverlandImpassable(t)) return false;
  if (((t >= 0x66 && t <= 0x6C) || t === 0x72) && view.view.m0(0x4AA2) === 0) return false;   // the river (6600:08f9)
  return true;
}
// [dir, ...] over the overland map (4 directions, as the arrow keys), or null
export function overlandPath(x0, y0, x1, y1) {
  if (!V || !V14) return null;
  if (x0 === x1 && y0 === y1) return [];
  const key = (x, y) => x + y * 16, prev = new Map([[key(x0, y0), null]]), q = [[x0, y0]];
  while (q.length) {
    const [x, y] = q.shift();
    for (const d of [0, 2, 4, 6]) {
      const nx = x + DX[d], ny = y + DY[d];
      if (prev.has(key(nx, ny)) || !overlandFree(nx, ny)) continue;
      prev.set(key(nx, ny), [key(x, y), d]);
      if (nx === x1 && ny === y1) {
        const dirs = []; let c = key(nx, ny);
        while (prev.get(c)) { const [p, pd] = prev.get(c); dirs.unshift(pd); c = p; }
        return dirs;
      }
      q.push([nx, ny]);
    }
  }
  return null;
}
export async function overlandTravelTo(x, y) {
  stop('replaced');
  await loadView(); await loadV14();
  const p0 = overlandPos();
  if (!p0 || p0.mode < 2 || p0.mode > 4 || !hooks.enabled) return 'not on an overland map';
  const dirs = overlandPath(p0.x, p0.y, x, y);
  travel.lastPath = dirs;
  if (!dirs) return 'no path';
  if (!dirs.length) return 'arrived';
  return new Promise((resolve) => {
    const w = { dirs, i: 0, x: p0.x, y: p0.y, offs: [], done: resolve, sent: false };
    travel.walk = w;
    const next = () => {
      const pos = overlandPos();
      if (w.sent) {                                                  // the step just made
        const d = w.dirs[w.i];
        if (pos.x !== w.x + DX[d] || pos.y !== w.y + DY[d]) return stop('blocked');
        w.x = pos.x; w.y = pos.y; w.i++; w.sent = false;
      } else if (pos.x !== w.x || pos.y !== w.y) return stop('moved elsewhere');
      if (w.i >= w.dirs.length) return stop('arrived');
      w.sent = true; typeKeys([ARROW[w.dirs[w.i]]]);
    };
    w.offs.push(hooks.on('menuDrawn', (p) => { if (!isExploreMenu(p)) return stop('interrupted'); next(); }));
    w.offs.push(hooks.on('listDrawn', () => stop('interrupted')));
    w.offs.push(hooks.on('combatStart', () => stop('combat')));
    w.offs.push(hooks.on('areaEntered', () => stop('new area')));
    next();
  });
}

export function stop(why = 'stopped') {
  const w = travel.walk;
  if (!w) return;
  travel.walk = null;
  for (const off of w.offs) off();
  w.done?.(why);
}

// walk to (x, y) in the current 3D area; resolves with 'arrived' | 'no path' | the reason it stopped
export async function travelTo(x, y) {
  stop('replaced');
  const view = await loadView();
  const p0 = hooks.state.position();
  if (!p0 || p0.travelMode !== 1 || !hooks.enabled) return 'not exploring';
  const dirs = path(p0.x, p0.y, x, y, view);
  travel.lastPath = dirs;
  if (!dirs) return 'no path';
  if (!dirs.length) return 'arrived';
  return new Promise((resolve) => {
    const w = { dirs, i: 0, x: p0.x, y: p0.y, pendingStep: false, offs: [], done: resolve };
    travel.walk = w;
    const nextKey = () => {
      if (w.i >= w.dirs.length) return stop('arrived');
      const pos = hooks.state.position();
      if (pos.x !== w.x || pos.y !== w.y || pos.travelMode !== 1) return stop('moved elsewhere');
      const t = turnKeys(pos.dir, w.dirs[w.i]);
      if (t.length) { typeKeys(t); return; }                     // a turn redraws the explore menu: come back here
      w.pendingStep = true; typeKeys([KEY.up]);
    };
    w.offs.push(hooks.on('menuDrawn', (p) => {
      if (!isExploreMenu(p)) return stop('interrupted');           // a script prompt, a door menu, ...
      if (w.pendingStep) return stop('blocked');                   // Up did not reach MoveParty's moved event
      nextKey();
    }));
    w.offs.push(hooks.on('listDrawn', () => stop('interrupted')));
    w.offs.push(hooks.on('combatStart', () => stop('combat')));
    w.offs.push(hooks.on('areaEntered', () => stop('new area')));
    w.offs.push(hooks.on('moved', (p) => {
      if (!w.pendingStep) return;
      w.pendingStep = false;
      const d = w.dirs[w.i];
      if (!p.stepped || p.x !== w.x + DX[d] || p.y !== w.y + DY[d]) return stop('blocked');
      w.x = p.x; w.y = p.y; w.i++;
    }));
    nextKey();                                                       // the explore menu waits now
  });
}

// ---- area map region (VIEW-02: 11x11 cells of 8x8 at 24 + 8c, 24 + 8r; viewDrawn 'areamap' gives the map origin) ----
export function mountTravel() {
  hooks.on('viewDrawn', (p) => {
    if (p.mode === 'overland') { overlandRegion(p); return; }
    hooks.clearRegions('overland');
    if (p.mode !== 'areamap') { hooks.clearRegions('areamap'); return; }
    const o = p.origin;
    const cell = (x, y) => ({ x: o.x + Math.floor((x - 24) / 8), y: o.y + Math.floor((y - 24) / 8) });
    hooks.registerRegion({ id: 'plus-areamap', scope: 'areamap', kind: 'map', prio: 6,
      rect: { x1: 24, y1: 24, x2: 111, y2: 111 },
      left: { action: (x, y) => { const c = cell(x, y); travelTo(c.x, c.y); } },
      right: (x, y) => {
        const c = cell(x, y), pos = hooks.state.position();
        const dirs = V && pos ? path(pos.x, pos.y, c.x, c.y) : null;
        const out = [];
        if (dirs && dirs.length) out.push({ label: `Walk to ${c.x},${c.y} (${dirs.length} steps)`, action: () => travelTo(c.x, c.y), default: true });
        else if (!dirs) out.push({ label: `${c.x},${c.y}: no open way`, action: () => {} });
        out.push({ label: 'Forward', keys: [KEY.up] }, { label: 'Turn left', keys: [KEY.left] },
          { label: 'Turn right', keys: [KEY.right] }, { label: 'Turn around', keys: [KEY.down] });
        return out;
      } });
  });
  loadView(); loadV14();
}

// overland window region (viewDrawn 'overland': origin = map cell of the window's top-left, 44-column map)
function overlandRegion(p) {
  const target = (x, y) => {
    const g = V?.view?.g; if (!g) return null;
    const col = p.origin.x + Math.floor((x - 8) / 24), row = p.origin.y + Math.floor((y - 8) / 24);
    return { x: col - g.ds[0x3C76 + g.travel_Mode], y: row };
  };
  const dirs = [{ label: 'North', keys: [KEY.up] }, { label: 'East', keys: [KEY.right] },
    { label: 'South', keys: [KEY.down] }, { label: 'West', keys: [KEY.left] }];
  hooks.registerRegion({ id: 'plus-overland', scope: 'overland', kind: 'map', prio: 6,
    rect: { x1: 8, y1: 8, x2: 127, y2: 127 },
    left: { action: (x, y) => { const t = target(x, y); if (t) overlandTravelTo(t.x, t.y); } },
    right: (x, y) => {
      const t = target(x, y), pos = overlandPos(), out = [];
      const d = t && pos ? overlandPath(pos.x, pos.y, t.x, t.y) : null;
      if (d && d.length) out.push({ label: `Travel there (${d.length} ${d.length === 1 ? 'step' : 'steps'})`, action: () => overlandTravelTo(t.x, t.y), default: true });
      else if (t && !d) out.push({ label: 'No way there over land', action: () => {} });
      return [...out, ...dirs];
    } });
}
