// game/plus/click/combat.js — Gold Box Plus W3: mouse in combat (owner 10/19, GOLD_BOX_PLUS.md "Combat right-click").
// Owner: gbp-click.
//
// While the combat menu waits (event combatTurn, CombatMenu 4800:0666) the 7x7 combat window (24x24 px cells from
// screen 8,8; map cell = window origin + screen cell) is a Plus region. The lists are the combat menu's own commands,
// filtered by what is under the pointer; every entry is typed as the keyboard player's keys, and the multi-step ones
// (aiming, moving) are steered one key at a time by a driver that answers each combatCursor event of the engine:
//   'aim'    (TargetMenu 6100:2AA0, "Aim: Next Prev Manual Target Center Exit")  -> M (manual cursor)
//   'manual' (ManualAim 6100:2DFA, "(Use Cursor keys) Target Center Exit")       -> a direction key toward the cell,
//            T on the cell (if the game offers Target there), or stop (View: the summary of what is under the cursor)
//   'move'   (MoveAttack 4800:09DF, "Move/Attack, Move Left = n")                -> a direction key along a path,
//            Enter on the cell; stepping into an enemy is the game's melee attack
// The driver stops at the next combatTurn, at combatEnd, when the cursor or the party does not move as expected, or
// on any other menu. PoR's combat menu is Move View Aim Use Cast Turn Quick Done (no Guard / Bandage in this game).

import { hooks } from '../hooks.js';
import { KEY } from '../../engine/input.js';
import { typeKeys, k, addProvider } from './click.js';
import { G as stateG } from '../../engine/state.js';

const DX = [0, 1, 1, 1, 0, -1, -1, -1], DY = [-1, -1, 0, 1, 1, 1, 0, -1];                     // ov31 g_2736 / g_273F
const DIRKEY = [[0, 0x48], [0, 0x49], [0, 0x4D], [0, 0x51], [0, 0x50], [0, 0x4F], [0, 0x4B], [0, 0x47]];   // ↑ PgUp → PgDn ↓ End ← Home
export const combat = { turn: null, drive: null, V31: null, cursor: null, module: '../../areas/view_ov31.js', costTable: null };
// cab: param — the module with CellAt(col, row, var occupant, var tile) (Pool VIEW ov31, Curse VIEW ov32 7000:0509) and the
// CombatTerrain cost table in the DS image (Pool DS:2744 via view.g, Curse DS:26A2), 4 bytes per tile, FFh = impassable
export function configureCombat({ module, costTable } = {}) { if (module) combat.module = module; if (costTable != null) combat.costTable = costTable; }

async function ov31() { combat.V31 ??= await import(combat.module); return combat.V31; }

export function cellAt(x, y) {
  const c = hooks.state.combat();
  if (!c || x < 8 || y < 8 || x > 175 || y > 175) return null;
  return { col: c.origin.col + Math.floor((x - 8) / 24), row: c.origin.row + Math.floor((y - 8) / 24) };
}
function occupantAt(col, row) {
  const c = hooks.state.combat();
  if (!c) return null;
  return c.list.find((m) => m.col === col && m.row === row) ||
    c.list.find((m) => m.size > 1 && col >= m.col && col <= m.col + 1 && row >= m.row && row <= m.row + 1) || null;
}
const toward = (fc, fr, tc, tr) => {                       // the 8-direction step that brings (fc, fr) nearest to (tc, tr)
  const sx = Math.sign(tc - fc), sy = Math.sign(tr - fr);
  return DX.findIndex((dx, d) => dx === sx && DY[d] === sy);
};

// breadth-first path over the combat grid (ov31 CellAt: occupant, tile; impassable = tile 0 or CombatTerrain cost FFh)
export function combatPath(fc, fr, tc, tr, V = combat.V31) {
  if (!V) return null;
  const G = V.view?.g, cost = (t) => (combat.costTable != null ? stateG.ds?.[combat.costTable + t * 4] : G?.ds?.[0x2744 + t * 4]);   // cab: param
  const free = (c, r, last) => {
    if (c < 0 || r < 0 || c > 49 || r > 24) return false;
    const o = { v: 0 }, t = { v: 0 }; V.CellAt(c, r, o, t);
    if (t.v === 0 || cost(t.v) === 0xFF) return false;
    return o.v === 0 || last;
  };
  const key = (c, r) => c + r * 50, prev = new Map([[key(fc, fr), null]]), q = [[fc, fr]];
  while (q.length) {
    const [c, r] = q.shift();
    if (c === tc && r === tr) {
      const dirs = []; let kk = key(c, r);
      while (prev.get(kk)) { const [p, d] = prev.get(kk); dirs.unshift(d); kk = p; }
      return dirs;
    }
    for (let d = 0; d < 8; d++) {
      const nc = c + DX[d], nr = r + DY[d];
      if (prev.has(key(nc, nr)) || !free(nc, nr, nc === tc && nr === tr)) continue;
      prev.set(key(nc, nr), [key(c, r), d]); q.push([nc, nr]);
    }
  }
  return null;
}

export function stopDrive(why = 'stopped') { const d = combat.drive; if (!d) return; combat.drive = null; d.done?.(why); }

// drive = { goal: { col, row }, kind: 'target' | 'show' | 'move' | 'attack', first: keys }; without `first` the
// driver answers the cursor that waits now (Aim menu, manual cursor or Move/Attack prompt)
export function drive(kind, goal, first) {
  stopDrive('replaced');
  return new Promise((resolve) => {
    combat.drive = { kind, goal, last: null, same: 0, done: resolve };
    if (first) typeKeys(first);
    else if (combat.cursor) onCursor(combat.cursor);
  });
}
const waitingPrompt = () => hooks.regions().find((r) => r.id === 'hmenu')?.draw?.prompt || '';

function onCursor(e) {
  combat.cursor = e;
  const d = combat.drive; if (!d) return;
  const g = d.goal, here = `${e.col},${e.row}`;
  if (d.last === here && e.mode !== 'aim') { if (++d.same > 1) return stopDrive('stuck'); } else d.same = 0;
  d.last = here;
  if (e.mode === 'aim') {
    if (d.kind === 'move') return stopDrive('wrong menu');
    return typeKeys([k('M')]);                                   // Manual: the cursor starts on the shown target
  }
  if (e.mode === 'manual') {
    if (d.kind === 'move') return stopDrive('wrong menu');
    if (e.col === g.col && e.row === g.row) {
      if (d.kind === 'show') return stopDrive('shown');         // its summary is on screen; the player decides
      if (!e.valid) return stopDrive('not a valid target');
      typeKeys([k('T')]); return stopDrive('targeted');
    }
    return typeKeys([DIRKEY[toward(e.col, e.row, g.col, g.row)]]);
  }
  if (e.mode === 'move') {
    if (d.kind !== 'move' && d.kind !== 'attack') return stopDrive('wrong menu');
    if (e.col === g.col && e.row === g.row) { typeKeys([KEY.enter]); return stopDrive('arrived'); }
    const p = combatPath(e.col, e.row, g.col, g.row);
    if (!p || !p.length) return stopDrive('no path');
    if (d.kind === 'attack' && p.length === 1) { typeKeys([DIRKEY[p[0]]]); return stopDrive('attacked'); }   // into the enemy
    if (e.moveLeft < 1) return stopDrive('no moves left');
    return typeKeys([DIRKEY[p[0]]]);
  }
}

function optionsFor(x, y) {
  const t = combat.turn, cell = cellAt(x, y);
  if (!t || !cell) return [];
  const menu = t.menu || '', has = (w) => new RegExp('\\b' + w + '\\b').test(menu);
  const who = occupantAt(cell.col, cell.row), me = hooks.state.combat()?.list.find((m) => m.index === t.index) || t;
  const out = [], at = `${cell.col},${cell.row}`;
  const prompt = waitingPrompt();
  if (/^(Aim:|\(Use Cursor keys\))/.test(prompt)) {                          // aiming: steer the cursor there
    out.push({ label: who ? `Target ${who.name}` : `Target ${at}`, action: () => drive('target', cell), default: true });
    out.push({ label: who ? `Show ${who.name}` : `Cursor to ${at}`, action: () => drive('show', cell) });
    return out;
  }
  if (/^Move\/Attack/.test(prompt)) {                                       // moving: walk / attack there
    out.push(who && who.enemy ? { label: `Attack ${who.name}`, action: () => drive('attack', cell), default: true }
      : { label: `Move here (${at})`, action: () => drive('move', cell), default: true });
    return out;
  }
  const near = Math.max(Math.abs(cell.col - me.col), Math.abs(cell.row - me.row)) === 1;
  const show = { label: who ? `View ${who.name}` : `Look at ${at}`, action: () => drive('show', cell, [k('A')]) };
  if (who && who.index === t.index) {                                       // the active character
    for (const w of ['View', 'Use', 'Cast', 'Turn', 'Quick', 'Done', 'Move', 'Aim'])
      if (has(w)) out.push({ label: w, keys: [k(w[0])], default: w === 'View' });
  } else if (who && who.enemy) {
    if (has('Move') && near) out.push({ label: `Attack ${who.name}`, action: () => drive('attack', cell, [k('M')]), default: true });
    out.push({ label: `Aim at ${who.name} (Target)`, action: () => drive('target', cell, [k('A')]), default: !(has('Move') && near) });
    if (has('Move') && !near) out.push({ label: `Move to ${who.name} and attack`, action: () => drive('attack', cell, [k('M')]) });
    if (has('Cast')) out.push({ label: `Cast at ${who.name}…`, action: () => drive('target', cell, [k('C')]) });
    out.push(show);
  } else if (who) {                                                         // another party member
    out.push({ ...show, default: true });
    if (has('Cast')) out.push({ label: `Cast on ${who.name}…`, action: () => drive('target', cell, [k('C')]) });
  } else {                                                                  // an empty cell
    if (has('Move')) out.push({ label: `Move here (${at})`, action: () => drive('move', cell, [k('M')]), default: true });
    out.push({ label: `Aim here (${at})`, action: () => drive('show', cell, [k('A')]), default: !has('Move') });
    if (has('Cast')) out.push({ label: `Cast here…`, action: () => drive('target', cell, [k('C')]) });
  }
  return out;
}

export function mountCombat() {
  ov31();
  hooks.on('combatTurn', (t) => {
    stopDrive('next turn');
    combat.turn = t;
    hooks.registerRegion({ id: 'plus-combat', scope: 'combat', kind: 'combat', prio: 6,
      rect: { x1: 8, y1: 8, x2: 175, y2: 175 },
      left: { action: (x, y) => { const d = optionsFor(x, y).find((o) => o.default); if (d) (d.action ? d.action() : typeKeys(d.keys)); } },
      right: (x, y) => optionsFor(x, y) });
  });
  hooks.on('combatCursor', onCursor);
  hooks.on('combatEnd', () => { stopDrive('combat over'); combat.turn = null; hooks.clearRegions('combat'); });
  hooks.on('menuDrawn', (p) => {                       // any other menu while driving (Cast list prompts, Yes/No, ...)
    const d = combat.drive;
    if (!d || p.region !== 'hmenu') return;
    if (/^(Aim:|\(Use Cursor keys\)|Move\/Attack)/.test(p.prompt)) return;
    if (d.kind === 'target' && combat.turn) return;    // Cast: the player picks the spell, the driver waits for the cursor
    stopDrive('other menu');
  });
}
