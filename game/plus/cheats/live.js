// Live cheats (W11, dev-only; cab-plus-shell S7, adapted from Pool's gbp-cheat). Every write goes through the engine's
// dev entry `hooks.dev` (plus request #13), which runs it as a job at the explore loop's safe point (the mechanism of
// plus request #11) with the game's own routines: party records (then UpdateLevelStats / RecalcCharacter as the game
// runs them), the party position (warp, incl. another block via NEW_ECL), ECL memory through ecl_SetMem (so flagSet is
// reported like a script write) and the clock cells VM 4BC6..4BCC. Reads come from hooks.state. Plus never touches the
// engine's objects itself (Pool's live.js did).
import { hooks } from '../hooks.js';
import { devEntry } from './party.js';

const need = (name) => { const d = devEntry(); if (typeof d[name] !== 'function') throw new Error(`the engine dev entry has no ${name} (plus request #13)`); return d; };
const int = (v, lo, hi, what) => { if (!Number.isInteger(v) || v < lo || v > hi) throw new Error(`${what}: ${lo}..${hi}`); return v; };

export function liveParty() {
  return hooks.state.party().map((m, i) => ({ index: i, name: m.name, levels: m.levels, hp: m.hp, hpMax: m.hpMax, gold: m.money?.[3] ?? 0 }));
}
export async function setHp(i, hp, { cheat = false } = {}) {
  const m = liveParty()[i]; if (!m) throw new Error(`no party member ${i + 1}`);
  int(hp, 0, 255, 'HP'); if (hp > m.hpMax && !cheat) throw new Error(`HP above the maximum ${m.hpMax} needs cheat`);
  return need('setMember').setMember(i, { hp, cheat });
}
export const setGold = (i, gold) => need('setMember').setMember(i, { gold: int(gold, 0, 0xFFFF, 'gold') });
// class level by base class id 0..7 (cleric .. monk); the class must be one of the character's
export async function setLevel(i, cls, level) {
  const m = liveParty()[i]; if (!m) throw new Error(`no party member ${i + 1}`);
  if (!(m.levels?.[int(cls, 0, 7, 'class')] > 0)) throw new Error('not one of this character\'s classes');
  return need('setMember').setMember(i, { cls, level: int(level, 1, 127, 'level') });
}
export const FACING = { N: 0, E: 1, S: 2, W: 3 };
export function teleport(x, y, facing, { dataset = null, block = null } = {}) {
  int(x, 0, 15, 'x'); int(y, 0, 15, 'y'); int(facing, 0, 3, 'facing');
  return need('warp').warp({ dataset, block, x, y, facing });
}
export function getFlag(addr) { return hooks.state.mem(int(addr, 0, 0xFFFF, 'address')); }
export async function setFlag(addr, value) {
  await need('setFlag').setFlag(int(addr, 0, 0xFFFF, 'address'), int(value, 0, 0xFFFF, 'value'));
  return hooks.state.mem(addr);
}
// game clock (hooks.state.clock(): VM 4BC6..4BCC round, minute units, minute tens, hour, day, month, year)
export function clockCells({ round = 0, minute = 0, hour = 0, day = 0, month = 0, year = 0 } = {}) {
  int(minute, 0, 59, 'minute'); int(hour, 0, 23, 'hour'); int(day, 0, 29, 'day'); int(month, 0, 11, 'month'); int(year, 0, 0xFFFF, 'year'); int(round, 0, 9, 'round');
  return [round, minute % 10, Math.trunc(minute / 10), hour, day, month, year];
}
export const setClock = (c) => need('setClock').setClock(clockCells(c));
