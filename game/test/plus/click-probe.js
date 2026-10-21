// game/test/plus/click-probe.js — GBP W3 headless helpers: mount the click layer, right-click a 320x200 point with a real
// contextmenu event on the canvas, read the list, choose an entry by label (as a player's click does).
import { click, closeMenu } from '../../plus/click/click.js';
import { mountClickLayer } from '../../plus/click/index.js';
import { travel, path, loadView } from '../../plus/click/travel.js';
import { script } from '../../engine/input.js';
import { hooks } from '../../plus/hooks.js';

const canvas = () => document.getElementById('screen');
function client(x, y) {
  const r = canvas().getBoundingClientRect();
  return { clientX: r.left + (x + 0.5) * r.width / 320, clientY: r.top + (y + 0.5) * r.height / 200 };
}
export function mount() { mountClickLayer({ canvas: canvas() }); return { mounted: click.mounted, hooks: hooks.enabled }; }

// right-click at (x, y): returns the labels of the list ('*' marks the default), [] when no list opened
export function rc(x, y) {
  closeMenu();
  canvas().dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, ...client(x, y) }));
  if (!click.menuEl) return [];
  return [...click.menuEl.querySelectorAll('button')].map((b) => (b.className === 'def' ? '*' : '') + b.firstChild.textContent);
}
// right-click at (x, y) and choose the entry whose label starts with `label`
// (the acceptance runner resets the key script at each step, so wait until the chosen keys have been typed)
export async function pick(x, y, label) {
  const labels = rc(x, y);
  const b = click.menuEl && [...click.menuEl.querySelectorAll('button')].find((e) => e.firstChild.textContent.startsWith(label));
  if (!b) { closeMenu(); throw new Error(`no "${label}" at ${x},${y}: ${JSON.stringify(labels)}`); }
  const key = b.querySelector('.key')?.textContent || '';
  b.click();
  for (let t = 0; t < 200 && script.keys.length; t++) await new Promise((r) => setTimeout(r, 50));
  return { picked: b.firstChild.textContent, key, labels };
}
export function cursorAt(x, y) {
  canvas().dispatchEvent(new MouseEvent('mousemove', { bubbles: true, ...client(x, y) }));
  return canvas().style.cursor;
}
export const pos = () => hooks.state.position();

// area map: choose the reachable cell inside the 11x11 window with the longest path (<= maxSteps), right-click it,
// choose "Walk to", wait for the walker; returns what happened
export async function walkFar(maxSteps = 8) {
  const v = await loadView();
  const p = hooks.state.position(), o = hooks.regions().find((r) => r.id === 'plus-areamap');
  if (!o) throw new Error('no area map region');
  const x0 = Math.max(0, Math.min(5, p.x - 5)), y0 = Math.max(0, Math.min(5, p.y - 5));
  let best = null;
  for (let y = y0; y <= y0 + 10; y++) for (let x = x0; x <= x0 + 10; x++) {
    const d = path(p.x, p.y, x, y, v);
    if (d && d.length <= maxSteps && (!best || d.length > best.n)) best = { x, y, n: d.length };
  }
  if (!best) throw new Error('nothing reachable');
  const px = 24 + (best.x - x0) * 8 + 3, py = 24 + (best.y - y0) * 8 + 3;
  const r = await pick(px, py, 'Walk to');
  let t = 0; while (travel.walk && t++ < 600) await new Promise((res) => setTimeout(res, 50));
  return { from: { x: p.x, y: p.y }, target: best, picked: r.picked, at: hooks.state.position(), walking: !!travel.walk, path: travel.lastPath };
}

// combat: the turn, the window and every combatant; cell -> screen point; right-click / choose on a combat cell
import { combat } from '../../plus/click/combat.js';
export function fight() { return { turn: combat.turn && { name: combat.turn.name, index: combat.turn.index, col: combat.turn.col, row: combat.turn.row, menu: combat.turn.menu }, map: hooks.state.combat() }; }
function cellPoint(col, row) { const o = hooks.state.combat().origin; return { x: 8 + (col - o.col) * 24 + 12, y: 8 + (row - o.row) * 24 + 12 }; }
export function rcCell(col, row) { const p = cellPoint(col, row); return rc(p.x, p.y); }
export async function pickCell(col, row, label) {
  const p = cellPoint(col, row);
  const r = await pick(p.x, p.y, label);
  let t = 0; while (combat.drive && t++ < 400) await new Promise((res) => setTimeout(res, 50));
  return { ...r, driving: !!combat.drive };
}
// the nearest visible enemy and a free cell next to the active character (inside the window)
export function targets() {
  const f = hooks.state.combat(), me = f.list.find((m) => m.index === combat.turn.index), o = f.origin;
  const vis = (m) => m.col >= o.col && m.col <= o.col + 6 && m.row >= o.row && m.row <= o.row + 6;
  const d = (m) => Math.max(Math.abs(m.col - me.col), Math.abs(m.row - me.row));
  const enemy = f.list.filter((m) => m.enemy && m.hp > 0 && vis(m)).sort((a, b) => d(a) - d(b))[0] || null;
  let free = null;
  for (const [dc, dr] of [[0, -1], [-1, 0], [1, 0], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const c = me.col + dc, r = me.row + dr;
    if (c < o.col || c > o.col + 6 || r < o.row || r > o.row + 6) continue;
    if (!f.list.some((m) => m.col === c && m.row === r)) { free = { col: c, row: r }; break; }
  }
  return { me: { name: me.name, col: me.col, row: me.row }, enemy: enemy && { name: enemy.name, col: enemy.col, row: enemy.row, hp: enemy.hp }, free };
}
export async function pickCellNoWait(col, row, label) { const p = cellPoint(col, row); return pick(p.x, p.y, label); }
