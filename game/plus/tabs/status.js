import { hooks } from '../hooks.js';

// Read-only snapshot refreshed whenever the panel/tab opens.
// cab: wired to the Curse hooks state (hooks ready, 3c2e9b0): place = ECL<set>/<block> (profile area names), 3D map id of
// VM 4BC5 or the overland location of VM 4CA1 (BIGPIC 121), the clock of VM 4BC6..4BCC, the party from the 422-byte
// records (profile plus.charFields). While the tab is shown it redraws on the events that change these values.
const BASE_CLASSES = ['Cleric', 'Druid', 'Fighter', 'Paladin', 'Ranger', 'Magic-User', 'Thief', 'Monk'];
const FACING = ['North', 'East', 'South', 'West'];
const COINS = ['copper', 'silver', 'electrum', 'gold', 'platinum', 'gems', 'jewelry'];
const REFRESH = new Set(['moved', 'areaEntered', 'partyDrawn', 'saveLoaded', 'gameSaved', 'combatEnd', 'npcLeft', 'characterImported', 'treasure', 'bigPicShown']);
const HELPER_LABELS = { automap: 'Automap', tooltips: 'Tooltips', combatLog: 'Combat log', quicksave: 'Quick save', autosave: 'Autosave', crispFont: 'Crisp font' };
let unsubscribe = null;

export function statusModel(state = hooks.state, { bigPic = globalThis.goldBoxPlusTabs?.map?.tracker?.bigPic ?? null } = {}) {
 const position = state.position?.() ?? null, clock = state.clock?.() ?? null, party = state.party?.() ?? [];
 let place = 'No game loaded', where = null;
 if (position && Number.isInteger(position.block)) {
  place = `ECL${position.dataset}/${position.block}`;
  if (position.is3D) where = `3D map ${position.map3d ?? '?'}, square (${position.x}, ${position.y}), facing ${FACING[position.facing] ?? '?'}`;
  else if (bigPic === 121) where = `the overland, place ${(state.mem?.(0x4CA1) ?? 0) & 255}`;
  else where = 'a 2D area';
 }
 const time = clock ? `${clock.text}, day ${clock.day}, month ${clock.month}, year ${clock.year}` : 'Unavailable';
 const members = party.map((m) => ({
  name: m.name, hp: `${m.hp} / ${m.hpMax}`, ac: m.ac,
  levels: (m.levels || []).map((l, k) => (l > 0 ? `${BASE_CLASSES[k]} ${l}` : null)).filter(Boolean).join(' / ') || '—',
  xp: m.xp, gold: m.money?.[3] ?? 0, npc: m.npc, selected: m.selected,
 }));
 return { slot: state.slot || null, place, where, time, members };
}

export function renderStatus(container, plus) {
 unsubscribe?.(); unsubscribe = null;
 const draw = () => {
  container.replaceChildren();
  const heading = document.createElement('h2'); heading.textContent = 'Status'; container.append(heading);
  const m = statusModel();
  const details = document.createElement('dl'); details.dataset.status = 'place';
  const row = (label, value) => { const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = label; dd.textContent = value; details.append(dt, dd); };
  row('Save slot', m.slot || 'Session (not saved)');
  row('Place', m.where ? `${m.place}: ${m.where}` : m.place);
  row('Game time', m.time);
  const settings = plus?.settings || {};
  row('Active helpers', settings.original ? 'Original game (all additions off)' : Object.entries(HELPER_LABELS).filter(([k]) => settings[k]).map(([, v]) => v).join(', ') || 'None');
  container.append(details);
  const title = document.createElement('h3'); title.textContent = 'Party'; container.append(title);
  if (!m.members.length) { const p = document.createElement('p'); p.textContent = 'No party loaded.'; container.append(p); return; }
  const table = document.createElement('table'), head = document.createElement('tr'); table.dataset.status = 'party';
  for (const label of ['Character', 'HP', 'AC', 'Levels', 'XP', 'Gold']) { const th = document.createElement('th'); th.textContent = label; head.append(th); }
  table.append(head);
  for (const c of m.members) {
   const tr = document.createElement('tr');
   for (const value of [c.name + (c.npc ? ' (NPC)' : '') + (c.selected ? ' ◂' : ''), c.hp, c.ac, c.levels, c.xp, c.gold]) { const td = document.createElement('td'); td.textContent = String(value); tr.append(td); }
   table.append(tr);
  }
  container.append(table);
  const note = document.createElement('p'); note.textContent = `Money other than gold (${COINS.filter((k) => k !== 'gold').join(', ')}) is on each character sheet in the game.`; container.append(note);
 };
 draw();
 unsubscribe = hooks.on('*', (_, name) => { if (!REFRESH.has(name)) return; if (!container.isConnected) { unsubscribe?.(); unsubscribe = null; return; } draw(); });
}
