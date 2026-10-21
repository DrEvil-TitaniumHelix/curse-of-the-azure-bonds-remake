// Curse of the Azure Bonds quest table (W5, cab-ecl-quests). Evidence for every cell, value and text address:
// decode/ecl/QUESTS.md (section numbers below). Keyed by the quest's main ECL memory cell. No game text here: texts are
// [dataSet, block, ECL address] of the printing instruction, decoded at run time from the player's imported ECLn.DAX
// (quests/text.js).
//   rules: [cell, op, value, status] — the highest-ranked matching rule gives the flag status (ops: eq, ge, range, bits).
//   marks: [text, status] — that PRINT / PRINTCLEAR running (textPrinted with its address, or its exact text in that
//          block) sets a sticky status (Plus state per save slot).
//   offer: the text that offers the quest (also a mark: offered); title: the text shown as the quest's name when there
//          is no offer; reward: the text that pays it.
export const PROFILE = 'cab';
export const STATUS_RANK = Object.freeze({ unknown: 0, offered: 1, accepted: 2, progress: 3, done: 4, closed: 5, rewarded: 6, failed: 6 });
const at = (dataSet, block) => (addr) => [dataSet, block, addr];
const hub = at(1, 80);
const ORDER_IDS = ['tilverton', 'moander', 'zhentil-keep', 'dracandros', 'tyranthraxus', 'filani', 'dagger-falls', 'magistrate-daughter'];

export const QUESTS = Object.freeze({
  // §1 the bonds. The hub counts 4C59 / 4C5B / 4C5A (ECL1_80 8232..828B); the directions are the offers (8354..83C7).
  0x4C2A: { id: 'tilverton', group: 'bonds', conf: 'H', title: at(2, 4)(0x830B),            // §1.1
    rules: [[0x4C2A, 'eq', 1, 'done']], marks: [[at(2, 4)(0x839A), 'progress']] },
  0x4C5B: { id: 'moander', group: 'bonds', conf: 'H', offer: hub(0x8389), reward: at(3, 18)(0x987B),   // §1.2
    // FFh = left Yulash by the west exit (ECL3_17 84E7, M); the hub counts it as done
    rules: [[0x4C5B, 'eq', 1, 'rewarded'], [0x4C5B, 'eq', 0xFF, 'closed']], marks: [[at(3, 18)(0x95EE), 'progress']] },
  0x4C5A: { id: 'zhentil-keep', group: 'bonds', conf: 'H', offer: hub(0x83B1), reward: at(4, 34)(0x8C4E),   // §1.3
    rules: [[0x4C5A, 'eq', 1, 'rewarded']], marks: [[at(4, 34)(0x836E), 'progress']] },
  0x4C59: { id: 'dracandros', group: 'bonds', conf: 'H', offer: hub(0x8365), reward: at(5, 51)(0x8F8E),   // §1.4
    rules: [[0x4C59, 'eq', 1, 'rewarded']], marks: [[at(5, 51)(0x841E), 'progress']] },
  0x4CFD: { id: 'tyranthraxus', group: 'bonds', conf: 'H', offer: hub(0x83CF),             // §1.5 (PROGRAM 8 at ECL6_67 93E7)
    rules: [[0x4CFD, 'eq', 0xFF, 'done']], marks: [[at(6, 67)(0x8963), 'progress']] },
  // §4 the sage: block-local cells only, so the visit is kept as marks
  0x4C13: { id: 'filani', group: 'side', conf: 'H', offer: at(2, 1)(0x8E9C), rules: [], marks: [[at(2, 1)(0x8F5A), 'done']] },
  // §2 the march on Dagger Falls
  0x4C86: { id: 'dagger-falls', group: 'side', conf: 'H', offer: at(1, 81)(0x90E4), reward: at(1, 81)(0x938E),
    rules: [[0x4C86, 'eq', 1, 'progress'], [0x4C86, 'eq', 2, 'rewarded'], [0x4C86, 'eq', 3, 'closed']] },
  // §3 the drow raid; 4C21 may carry a 1 from ECL2_04 82D1, so the counter counts from 2 and the texts carry the rest
  0x4C21: { id: 'magistrate-daughter', group: 'side', conf: 'M', offer: at(5, 53)(0x8AC5), reward: at(5, 53)(0x8E20),
    rules: [[0x4C21, 'ge', 2, 'progress']],
    marks: [[at(5, 53)(0x8E20), 'rewarded'], [at(5, 53)(0x8EC8), 'closed'], [at(5, 53)(0x8EFF), 'failed']] },
});

export const ORDER = Object.freeze(Object.values(QUESTS).map((q) => q.id).sort((a, b) => ORDER_IDS.indexOf(a) - ORDER_IDS.indexOf(b)));
export const GROUPS = Object.freeze({ bonds: 'The bonds', side: 'Other deeds' });

// every cell a rule reads -> the quest keys that use it
export function cellIndex(table = QUESTS) {
  const out = new Map();
  for (const [key, q] of Object.entries(table)) for (const [cell] of q.rules) {
    if (!out.has(cell)) out.set(cell, new Set());
    out.get(cell).add(Number(key));
  }
  return out;
}
// every text address the table refers to (offer, title, reward, marks)
export function textRefs(table = QUESTS) {
  const refs = [];
  const add = (r) => { if (!r) return; if (Array.isArray(r[0])) r.forEach(add); else refs.push(r); };
  for (const q of Object.values(table)) { add(q.offer); add(q.title); add(q.reward); for (const [r] of q.marks || []) add(r); }
  return refs;
}
export const refKey = ([ds, block, addr]) => `${ds}:${block}:${addr.toString(16).toUpperCase()}`;
