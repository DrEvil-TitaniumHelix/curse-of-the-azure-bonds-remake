// game/plus/click/cab.js — Gold Box Plus W3 (S3) for Curse of the Azure Bonds: the screen providers that differ from
// Pool's (click/travel.js, the roster of res_00ba). Owner: cab-build-engine (plus lane S3).
//
// Every click types exactly the keys a keyboard player would press, through the engine's key script (click.js typeKeys);
// regions are Plus regions built from the engine's draw events and dropped when their screen stops waiting.
//  - Roster (partyDrawn, PARTY ov24 PartySummary 6200:0795): while a menu that takes the extended keys waits (the explore
//    menu, the top menu), a click on a member's line selects that member with the keys that do it: End ('O') = next,
//    Home ('G') = previous, both wrapping (CycleSelectedChar 5000:32DC); the shorter way is typed. Right click: select, and
//    each command of the waiting bottom menu for that member.
//  - Area map (viewDrawn 'areamap', VIEW 6D00:0011 DrawAreaMap: 11x11 cells of 8x8 px from 24,24; `origin` = the map cell
//    at the top-left): left click = walk there, typed as turn keys (Left / Right / Down) and Up, one at a time whenever
//    the explore menu waits again; the path is a breadth-first search over the live 3D map with the game's own
//    GetPassage 6D00:0596 (hooks.state.passage, plus request #10: 1 = open; doors are left to the player). The walk stops
//    on anything else: another menu or list (a script event), a square other than the expected one, combat, a new block.
//  - 2D areas (BIGPIC, view mode 3) have no view cells: their commands are the ECL menus (op2B HORIZONTAL MENU = the
//    bottom menu, op15 VERTICAL MENU = the list), which the generic layer (click.js) already covers.
//  - The rune-wheel answer (ENGINE ov03 RuneWheelCheck: ReadBottomLine) is a line prompt: click/input.js.
import { hooks } from '../hooks.js';
import { KEY } from '../../engine/input.js';
import { typeKeys, bottomMenu } from './click.js';

const DX = [0, 0, 1, 0, 0, 0, -1, 0], DY = [-1, 0, 0, 0, 1, 0, 0, 0];   // party_Dir 0 N, 2 E, 4 S, 6 W (view_ov30 DX/DY)
export const cab = { walk: null, lastPath: null, roster: null };

const hmenu = () => hooks.regions().find((r) => r.id === 'hmenu')?.draw || null;
const isExploreMenu = (p) => !!p && p.region === 'hmenu' && (p.items || []).some((i) => /^Encamp$/i.test(String(i.label).trim()));
const isTopMenu = (p) => !!p && p.region === 'hmenu' && p.prompt === 'Choose a function ';

// ---- roster ------------------------------------------------------------------------------------------------------------
export function selectKeys(from, to, count) {
  if (from < 0 || to < 0 || from === to || count < 2) return [];
  const fwd = (to - from + count) % count, back = (from - to + count) % count;
  return fwd <= back ? Array.from({ length: fwd }, () => KEY.end) : Array.from({ length: back }, () => KEY.home);
}
function rosterRegion(p) {
  cab.roster = p;
  const rowOf = (y) => Math.floor(y / 8) - (p.firstRow ?? 4);
  const usable = () => { const m = hmenu(); return (isExploreMenu(m) || isTopMenu(m)) && cab.roster === p; };
  hooks.registerRegion({ id: 'plus-roster', scope: 'roster', kind: 'party', prio: 2, rect: p.rect,
    left: (x, y) => {
      if (!usable()) return null;
      const i = rowOf(y);
      if (!p.members[i]) return null;
      const keys = selectKeys(p.selected, i, p.members.length);
      return keys.length ? keys : null;
    },
    right: (x, y) => {
      if (!usable()) return [];
      const i = rowOf(y), who = p.members[i];
      if (!who) return [];
      const steps = selectKeys(p.selected, i, p.members.length);
      const out = steps.length ? [{ label: `Select ${who.name}`, keys: steps, default: true }] : [];
      for (const m of bottomMenu()) out.push({ label: `${m.label}: ${who.name}`, keys: [...steps, ...m.keys] });
      return out;
    } });
}

// ---- area-map travel ---------------------------------------------------------------------------------------------------
// [dir, ...] from (x0, y0) to (x1, y1) inside the current 3D map, or null; passage(x, y, dir) = GetPassage
export function path(x0, y0, x1, y1, passage = hooks.state.passage) {
  if (x0 === x1 && y0 === y1) return [];
  const prev = new Map([[x0 + y0 * 16, null]]), q = [[x0, y0]];
  while (q.length) {
    const [x, y] = q.shift();
    for (const d of [0, 2, 4, 6]) {
      const nx = x + DX[d], ny = y + DY[d];
      if (nx < 0 || ny < 0 || nx > 15 || ny > 15 || prev.has(nx + ny * 16)) continue;
      if (passage(x, y, d) !== 1) continue;
      prev.set(nx + ny * 16, [x + y * 16, d]);
      if (nx === x1 && ny === y1) {
        const dirs = []; let c = nx + ny * 16;
        while (prev.get(c)) { const [pp, pd] = prev.get(c); dirs.unshift(pd); c = pp; }
        return dirs;
      }
      q.push([nx, ny]);
    }
  }
  return null;
}
export function turnKeys(from, to) {
  const d = (to - from + 8) % 8;
  return d === 0 ? [] : d === 2 ? [KEY.right] : d === 6 ? [KEY.left] : [KEY.down];
}
export function stop(why = 'stopped') {
  const w = cab.walk;
  if (!w) return;
  cab.walk = null;
  for (const off of w.offs) off();
  w.done?.(why);
}
// walk to (x, y) in the current 3D area; resolves 'arrived' | 'no path' | the reason it stopped
export function travelTo(x, y) {
  stop('replaced');
  const p0 = hooks.state.position();
  if (!p0 || !p0.is3D || !hooks.enabled || !isExploreMenu(hmenu())) return Promise.resolve('not exploring');
  const dirs = path(p0.x, p0.y, x, y);
  cab.lastPath = dirs;
  if (!dirs) return Promise.resolve('no path');
  if (!dirs.length) return Promise.resolve('arrived');
  return new Promise((resolve) => {
    const w = { dirs, i: 0, x: p0.x, y: p0.y, pendingStep: false, offs: [], done: resolve };
    cab.walk = w;
    const nextKey = () => {
      if (w.i >= w.dirs.length) return stop('arrived');
      const pos = hooks.state.position();
      if (pos.x !== w.x || pos.y !== w.y) return stop('moved elsewhere');
      const t = turnKeys(pos.dir & 6, w.dirs[w.i]);
      if (t.length) { typeKeys(t); return; }                         // a turn redraws the explore menu: back here
      w.pendingStep = true; typeKeys([KEY.up]);
    };
    w.offs.push(hooks.on('menuDrawn', (p) => {
      if (!isExploreMenu(p)) return stop('interrupted');             // a script prompt, a door menu, ...
      if (w.pendingStep) return stop('blocked');                     // Up did not reach the step's moved event
      nextKey();
    }));
    w.offs.push(hooks.on('listDrawn', () => stop('interrupted')));
    w.offs.push(hooks.on('combatStart', () => stop('combat')));
    w.offs.push(hooks.on('areaEntered', () => stop('new area')));
    w.offs.push(hooks.on('moved', (p) => {
      if (!w.pendingStep || p.stepped === false) return;
      w.pendingStep = false;
      const d = w.dirs[w.i];
      if (p.x !== w.x + DX[d] || p.y !== w.y + DY[d]) return stop('blocked');
      w.x = p.x; w.y = p.y; w.i++;
    }));
    nextKey();                                                       // the explore menu waits now
  });
}
function areamapRegion(p) {
  const o = p.origin;
  const cell = (x, y) => ({ x: o.x + Math.floor((x - 24) / 8), y: o.y + Math.floor((y - 24) / 8) });
  hooks.registerRegion({ id: 'plus-areamap', scope: 'areamap', kind: 'map', prio: 6,
    rect: { x1: 24, y1: 24, x2: 111, y2: 111 },
    left: { action: (x, y) => { const c = cell(x, y); travelTo(c.x, c.y); } },
    right: (x, y) => {
      const c = cell(x, y), pos = hooks.state.position();
      const dirs = pos ? path(pos.x, pos.y, c.x, c.y) : null, out = [];
      if (dirs && dirs.length) out.push({ label: `Walk to ${c.x},${c.y} (${dirs.length} ${dirs.length === 1 ? 'step' : 'steps'})`, action: () => travelTo(c.x, c.y), default: true });
      else if (!dirs) out.push({ label: `${c.x},${c.y}: no open way`, action: () => {} });
      out.push({ label: 'Forward', keys: [KEY.up] }, { label: 'Turn left', keys: [KEY.left] },
        { label: 'Turn right', keys: [KEY.right] }, { label: 'Turn around', keys: [KEY.down] });
      return out;
    } });
}

export function mountCab() {
  hooks.on('partyDrawn', (p) => { if (p && p.rect && p.members) rosterRegion(p); });
  hooks.on('viewDrawn', (p) => { if (p.mode === 'areamap') areamapRegion(p); else hooks.clearRegions('areamap'); });
  // a new screen state drops the regions that belong to the old one
  hooks.on('areaEntered', () => { hooks.clearRegions('areamap'); stop('new area'); });
  hooks.on('combatStart', () => { hooks.clearRegions('roster'); hooks.clearRegions('areamap'); });
  hooks.on('saveLoaded', () => hooks.clearRegions('roster'));
}
