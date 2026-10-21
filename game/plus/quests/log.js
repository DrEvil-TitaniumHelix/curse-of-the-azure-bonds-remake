// Quest state machine (W5, gbp-flags): ECL flag values + sticky text marks -> status per quest. Pure; no DOM, no hooks.
// Flag status = the highest-ranked matching rule of the quest (table.js); a mark (offer text or table mark printed in
// its block) adds a status; the shown status is the highest rank of both. Rules: decode/ecl/QUESTS.md.
import { QUESTS, ORDER, STATUS_RANK, cellIndex, refKey } from './table.js';

function test(op, v, want) {
  if (op === 'eq') return v === want;
  if (op === 'ge') return v >= want;
  if (op === 'range') return v >= want[0] && v <= want[1];
  if (op === 'bits') return (v & want) === want;
  return false;
}
const higher = (a, b) => (STATUS_RANK[b] > STATUS_RANK[a] ? b : a);

export function createQuestLog({ table = QUESTS, texts = new Map(), order = ORDER } = {}) {
  const rank = (k) => { const i = order.indexOf(table[k].id); return i < 0 ? order.length : i; };
  const keys = Object.keys(table).map(Number).sort((a, b) => rank(a) - rank(b));
  const cells = cellIndex(table);
  const values = new Map();                       // cell -> last known word
  const marks = new Map();                        // quest key -> Set(status)
  let byText = new Map();                         // `${ds}:${block}:${text}` -> [{ key, status }]
  const byAddr = new Map();                       // cab: refKey -> [{ key, status }] (textPrinted carries the instruction address)

  function setTexts(map) {
    texts = map; byText = new Map();
    const add = (ref, key, status) => {
      const t = texts.get(refKey(ref)); if (!t) return;
      const k = `${ref[0]}:${ref[1]}:${t}`;
      if (!byText.has(k)) byText.set(k, []);
      byText.get(k).push({ key, status });
    };
    for (const key of keys) {
      const q = table[key];
      if (q.offer) add(q.offer, key, 'offered');
      for (const [ref, status] of q.marks || []) add(ref, key, status);
    }
  }
  for (const key of keys) {
    const q = table[key];
    const put = (ref, status) => { const k = refKey(ref); if (!byAddr.has(k)) byAddr.set(k, []); byAddr.get(k).push({ key, status }); };
    if (q.offer) put(q.offer, 'offered');
    for (const [ref, status] of q.marks || []) put(ref, status);
  }
  setTexts(texts);

  function flagStatus(key) {
    let s = 'unknown';
    for (const [cell, op, want, status] of table[key].rules) if (test(op, values.get(cell) ?? 0, want)) s = higher(s, status);
    return s;
  }
  function status(key) {
    let s = flagStatus(key);
    for (const m of marks.get(key) || []) s = higher(s, m);
    return s;
  }
  function track(affected, mutate) {
    const before = new Map([...affected].map((k) => [k, status(k)]));
    mutate();
    const changes = [];
    for (const [k, from] of before) { const to = status(k); if (to !== from) changes.push({ key: k, id: table[k].id, from, to }); }
    return changes;
  }

  return {
    setTexts,
    get texts() { return texts; },
    applyFlag(addr, value) {
      const affected = cells.get(addr);
      if (!affected) return [];
      return track(affected, () => values.set(addr, value & 0xFFFF));
    },
    applyText(text, { dataSet, block, addr } = {}) {
      const hits = (Number.isInteger(addr) && byAddr.get(refKey([dataSet, block, addr]))) || byText.get(`${dataSet}:${block}:${text}`);
      if (!hits) return [];
      return track(new Set(hits.map((h) => h.key)), () => {
        for (const { key, status: s } of hits) { if (!marks.has(key)) marks.set(key, new Set()); marks.get(key).add(s); }
      });
    },
    // full read (save loaded / game started): mem(addr) -> word or null
    readAll(mem) {
      return track(new Set(keys), () => { for (const cell of cells.keys()) { const v = mem(cell); values.set(cell, v == null ? 0 : v & 0xFFFF); } });
    },
    status,
    value: (cell) => values.get(cell) ?? 0,
    list() {
      return keys.map((key) => {
        const q = table[key], s = status(key);
        const out = { key, id: q.id, group: q.group, conf: q.conf, status: s, met: s !== 'unknown' };
        if (q.progress) out.progress = { count: values.get(q.progress.cell) ?? 0, of: q.progress.of };
        return out;
      });
    },
    snapshot() { return { marks: Object.fromEntries([...marks].filter(([, s]) => s.size).map(([k, s]) => [table[k].id, [...s]])) }; },
    restore(snap) {
      return track(new Set(keys), () => {
        marks.clear();
        const ids = new Map(keys.map((k) => [table[k].id, k]));
        for (const [id, list] of Object.entries(snap?.marks || {})) {
          const k = ids.get(id);
          if (k != null && Array.isArray(list)) marks.set(k, new Set(list.filter((s) => s in STATUS_RANK)));
        }
      });
    },
  };
}
