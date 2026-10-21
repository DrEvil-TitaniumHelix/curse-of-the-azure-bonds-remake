// Spell presets (W8, off by default): save the selected character's memorised spells as a preset; in camp, at the Magic
// menu, "apply" types the original Memorize keys: M, then per spell the list steps (End = next row, Home = previous,
// VerticalListMenu 9D00:0D9A; the list opens on its last row) to the spell's row and M, then E (leave the book), E (the
// "to be memorised" list) and Y (confirm) — the same keys a player presses (RUN-2 2-camp). Keys go through the engine's
// key script one per idle wait (ReadGameKey flushes type-ahead). Presets per character name in por-plus ('spellPresets').
const SPELL_NAME = (ds, id) => { const o = 0x28E9 + id * 0x29; let s = ''; for (let i = 1; i <= ds[o]; i++) s += String.fromCharCode(ds[o + i]); return s; };
export const K = { M: [0x4D, 0], E: [0x45, 0], Y: [0x59, 0], End: [0, 0x4F], Home: [0, 0x47] };

// memorised spell ids of a TChar record (+17h, 21 bytes; bit 7 = not yet learned by resting) -> names
export function memorised(record, ds) {
  const out = [];
  for (let i = 0; i < 21; i++) { const id = record[0x17 + i] & 0x7F; if (id) out.push(SPELL_NAME(ds, id)); }
  return out;
}
// keys from item `from` to item `to` (End = next selectable row, wrapping last -> first; Home = previous; header rows
// such as "1st Level" are skipped by the list, so steps count selectable rows only): the shorter way
export function stepKeys(items, from, to) {
  const sel = items.map((it, i) => (it.header ? -1 : i)).filter((i) => i >= 0), n = sel.length;
  const a = sel.indexOf(from), b = sel.indexOf(to);
  if (a < 0 || b < 0) return [];
  const down = ((b - a) % n + n) % n, up = ((a - b) % n + n) % n;
  return down <= up ? Array(down).fill(K.End) : Array(up).fill(K.Home);
}
// the row of a spell in a drawn list (headers skipped; names compared without case/spacing)
export function rowOf(items, name) {
  const want = name.toUpperCase().replace(/\s+/g, ' ').trim();
  return items.findIndex((it) => !it.header && String(it.text).toUpperCase().replace(/\s+/g, ' ').includes(want));
}

export function createPresets({ bus, store, ds, typeKeys, notify = () => {} }) {
  let on = false, job = null;
  const offs = [];
  function selected() { return (bus.state.party({ withRecord: true }) || []).find((c) => c.selected) || null; }
  const api = {
    get on() { return on; }, get job() { return job; },
    set(v) {
      on = !!v;
      if (on && !offs.length) offs.push(bus.on('listDrawn', (p) => api.listed(p)));
      if (!on) { for (const off of offs.splice(0)) off(); job = null; }
    },
    async list() { return (await store.get('spellPresets', {})) || {}; },
    async saveCurrent() {
      const c = selected(); if (!c?.record) throw new Error('select a character first');
      const spells = memorised(c.record, ds());
      const all = await api.list(); all[c.name] = spells; await store.set('spellPresets', all);
      notify(`Preset saved for ${c.name}: ${spells.join(', ') || 'no spells'}.`);
      return spells;
    },
    // at the camp Magic menu with the character selected: start typing
    async apply(name) {
      if (!on) return false;
      const c = selected(); name ||= c?.name;
      const spells = (await api.list())[name];
      if (!spells?.length) throw new Error(`no preset for ${name}`);
      job = { name, spells: [...spells], phase: 'open' };
      typeKeys([K.M]);
      return true;
    },
    // each list the game draws while a job runs: move to the next wanted spell and memorise it
    listed(p) {
      if (!job || !p?.items?.length) return;
      if (job.phase === 'open' || job.phase === 'pick') {
        const spell = job.spells[0];
        if (!spell) { job.phase = 'finish'; typeKeys([K.E, K.E, K.Y]); notify(`Preset applied for ${job.name}.`); job = null; return; }
        const row = rowOf(p.items, spell);
        if (row < 0) { notify(`Preset: ${spell} is not in the list (stopped).`, 'warn'); typeKeys([K.E]); job = null; return; }
        job.spells.shift(); job.phase = 'pick';
        typeKeys([...stepKeys(p.items, p.index, row), K.M]);
      }
    },
  };
  return api;
}
