// Combat log (W8, on by default): a scrollable panel beside the game listing each fight — who appeared (combatStart),
// every combat message the game shows (attacks, hits, misses, damage, spells, deaths: the combat panel's message area
// read back from the game's pixels whenever the screen changes during combat, textcells.js), treasure and the result/XP (combatEnd). Copy button.
// Prior art: Darklands+ port/ui battle log (MIT, credit in plus/CREDITS.md).
import { readScreen, lineText } from './textcells.js';

// the log model (no DOM): entries [{ kind, text }]; a fight is a 'start' entry and what follows
export function createCombatModel({ max = 2000 } = {}) {
  const entries = [], listeners = new Set();
  let inCombat = false, lastRows = [];
  const add = (kind, text) => { text = String(text).replace(/\s+/g, ' ').trim(); if (!text) return; entries.push({ kind, text }); if (entries.length > max) entries.splice(0, entries.length - max); for (const fn of listeners) fn(entries.at(-1)); };
  return {
    entries, get inCombat() { return inCombat; },
    onAdd(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    start(p) {
      inCombat = true; lastRows = [];
      const names = new Map(); for (const m of p?.monsters || []) names.set(m.name, (names.get(m.name) || 0) + 1);
      add('start', `Combat${p?.duel ? ' (duel)' : ''}: ` + ([...names].map(([n, c]) => (c > 1 ? `${c} × ${n}` : n)).join(', ') || 'unknown foes'));
    },
    end(p) {
      for (const old of lastRows) add('message', old);
      lastRows = []; inCombat = false;
      const r = { won: 'Victory', fled: 'The party fled', partyDead: 'The party was destroyed' }[p?.result ?? (p?.partyDead ? 'partyDead' : undefined)] || 'Combat over';   // cab: combatEnd { partyDead, party }
      add('end', r + (p?.xp ? ` — ${p.xp} XP each` : ''));
    },
    treasure(p) {
      const coins = ['copper', 'silver', 'electrum', 'gold', 'platinum', 'gems', 'jewelry'].map((n, i) => (p?.money?.[i] ? `${p.money[i]} ${n}` : '')).filter(Boolean);
      const items = (p?.items || []).map((i) => i.name).filter(Boolean);
      if (coins.length || items.length) add('treasure', 'Treasure: ' + [...coins, ...items].join(', '));
    },
    // the message blocks now on screen (groups of consecutive non-blank rows, joined): a block is logged once it is
    // complete, i.e. when it leaves the screen or is replaced by one that does not continue it (the game writes a
    // message line by line), and at the end of the fight
    rows(blocks) {
      if (!inCombat) return;
      blocks = blocks.map((t) => t.replace(/\s+/g, ' ').trim()).filter(Boolean);
      for (const old of lastRows) if (!blocks.some((b) => b === old || b.startsWith(old + ' '))) add('message', old);
      lastRows = blocks;
    },
    text(p) { if (inCombat && p?.text) add('message', p.text); },
    turn(p) { if (inCombat && Number.isInteger(p?.round) && p.round !== this.round) { this.round = p.round; add('round', `Round ${p.round}`); } },   // cab: combatTurn { round, side }
    round: null,
    clear() { entries.length = 0; },
    plain() { return entries.map((e) => (e.kind === 'start' ? '\n' : '') + e.text).join('\n').trim(); },
  };
}

// the combat screen's message area: the right-hand panel, rows 10..21, columns 23..38 (rows 1..8 = the active
// character's name, HP, AC, weapon; GBP-HELPERS-1 screen read-back)
// (anything read before the combat screen is drawn is ignored: messageBlocks needs the panel frame)
export const PANEL = { rows: [10, 21], cols: [23, 38] };
export const MENU_WORDS = /^(MOVE|VIEW|AIM|USE|CAST|TURN|GUARD|QUICK|DELAY|BANDAGE|SPEED|DONE|ENCAMP|EXIT)\b/;
export function messageBlocks(cells) {
  // only on the combat screen: its panel frame (row 22, columns 23..38) is graphics, never text
  if (!cells[22].slice(PANEL.cols[0], PANEL.cols[1] + 1).every((c) => c === null)) return [];
  const out = []; let cur = [];
  for (let r = PANEL.rows[0]; r <= PANEL.rows[1]; r++) {
    const t = lineText(cells[r].slice(PANEL.cols[0], PANEL.cols[1] + 1)).trim();
    if (t && !MENU_WORDS.test(t)) cur.push(t); else if (cur.length) { out.push(cur.join(' ')); cur = []; }
  }
  if (cur.length) out.push(cur.join(' '));
  return out;
}

export function createCombatLog({ canvas, screen, bus }) {
  const model = createCombatModel();
  let panel = null, list = null, raf = 0, seen = -1;
  const offs = [];
  function poll() {
    const d = screen.display;
    if (d && !d.text && model.inCombat && d.version !== seen) {
      seen = d.version;
      const cells = readScreen(d.pix, screen.table());
      model.rows(messageBlocks(cells));
    }
    raf = requestAnimationFrame(poll);
  }
  function show(e) {
    if (!list) return;
    const li = document.createElement('li'); li.textContent = e.text; li.dataset.kind = e.kind;
    if (e.kind === 'start') li.style.marginTop = '8px';
    if (e.kind !== 'message') li.style.fontWeight = 'bold';
    list.append(li); list.scrollTop = list.scrollHeight;
  }
  function open() {
    panel = document.createElement('aside'); panel.id = 'por-plus-combatlog'; panel.setAttribute('aria-label', 'Combat log');
    Object.assign(panel.style, { position: 'fixed', right: '8px', top: '8px', width: '260px', maxHeight: '45vh', display: 'flex', flexDirection: 'column',
      zIndex: '6', background: 'rgba(10,12,18,.88)', color: '#ddd', font: '12px system-ui, sans-serif', border: '1px solid #456', borderRadius: '6px' });
    const head = document.createElement('div'); head.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:4px 6px';
    const title = document.createElement('strong'); title.textContent = 'Combat log';
    const copy = document.createElement('button'); copy.textContent = 'Copy'; copy.dataset.helper = 'combatlog-copy';
    copy.onclick = async () => { const t = model.plain(); try { await navigator.clipboard.writeText(t); copy.textContent = 'Copied'; } catch { copy.textContent = 'Copy failed'; } setTimeout(() => { copy.textContent = 'Copy'; }, 1500); };
    head.append(title, copy);
    list = document.createElement('ol'); list.style.cssText = 'list-style:none;margin:0;padding:0 8px 6px;overflow:auto;flex:1'; list.tabIndex = 0;
    panel.append(head, list); document.body.append(panel);
    for (const e of model.entries) show(e);
  }
  model.onAdd(show);
  let on = false;
  return {
    model, get on() { return on; }, get panel() { return panel; },
    set(v) {
      if (v && !on) {
        offs.push(bus.on('combatStart', (p) => { model.round = null; model.start(p); }), bus.on('combatEnd', (p) => model.end(p)), bus.on('treasure', (p) => { if (model.inCombat || p?.afterCombat) model.treasure(p); }),
          bus.on('combatTurn', (p) => model.turn(p)), bus.on('textPrinted', (p) => model.text(p)));   // cab: + combatTurn / textPrinted
        open(); raf = requestAnimationFrame(poll);
      } else if (!v && on) { for (const off of offs.splice(0)) off(); cancelAnimationFrame(raf); panel?.remove(); panel = null; list = null; }
      on = !!v;
    },
  };
}
