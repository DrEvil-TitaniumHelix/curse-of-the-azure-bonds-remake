// Quests (W5, cab-ecl-quests): the Curse table against decode/ecl/scripts/FLAGMAP.md and the listings, the state machine
// over a scripted flagSet / textPrinted sequence, and the texts decoded from the owner's ECLn.DAX (local copy, read-only:
// CAB_DEV_DATA or re-targets/goldbox/cotab/curazure). No game text is written here: expected texts are read from the
// listings at test time.   node --test game/test/plus/quests.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { QUESTS, PROFILE, cellIndex, textRefs, refKey } from '../../plus/quests/table.js';
import { createQuestLog } from '../../plus/quests/log.js';
import { startQuests } from '../../plus/quests/quests.js';
import { loadQuestTexts } from '../../plus/quests/text.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const DATA = process.env.CAB_DEV_DATA || path.resolve(ROOT, '../re-targets/goldbox/cotab/curazure');
const hex = (n) => n.toString(16).toUpperCase().padStart(4, '0');
// the ECL script listings hold the game's texts: private workspace only (plus request #19: skip in the public tree)
const LISTINGS = existsSync(path.join(ROOT, 'decode/ecl/scripts/ECL1_80.ecl.txt')) ? false : 'decode listings not in this tree (public)';
const script = ([ds, block]) => `ECL${ds}_${String(block).padStart(2, '0')}`;

// FLAGMAP.md region tables: cell -> { script -> [{ pc, kind, value }] }
function flagmap() {
  const out = new Map();
  for (const line of readFileSync(path.join(ROOT, 'decode/ecl/scripts/FLAGMAP.md'), 'utf8').split('\n')) {
    const m = line.match(/^\| ([0-9A-F]{4}) \| [^|]* \| (\*\*ECL.*) \|$/);
    if (!m) continue;
    const per = new Map();
    for (const part of m[2].split('<br>')) {
      const [, s, sites] = part.match(/^\*\*(ECL\d_\d\d)\*\* (.*)$/);
      per.set(s, [...sites.matchAll(/([0-9A-F]{4}):([WTRIK])(?:=\$([0-9A-F]{4}))?/g)].map(([, pc, kind, v]) => ({ pc: parseInt(pc, 16), kind, value: v === undefined ? null : parseInt(v, 16) })));
    }
    out.set(parseInt(m[1], 16), per);
  }
  return out;
}
// listing line at an address: { op, text } (text = the quoted operand, or null)
function listingAt(ref) {
  const lines = readFileSync(path.join(ROOT, `decode/ecl/scripts/${script(ref)}.ecl.txt`), 'utf8').split('\n');
  const line = lines.find((l) => l.startsWith(hex(ref[2]) + '  '));
  if (!line) return null;
  const m = line.match(/^[0-9A-F]{4}  (?:[0-9A-F]{2} |\.\. ?)+\s*([A-Z_]+)\s+"(.*)"\s*$/);
  return m ? { op: m[1], text: m[2] } : { op: line.slice(30).trim().split(/\s+/)[0], text: null };
}

// QUESTS.md: the instruction that writes each state (script, address, value; I = implicit engine write)
const WRITES = [
  [0x4C2A, 'ECL2_04', 0x842F, 1, 'W'], [0x4C5B, 'ECL3_18', 0x98AE, 1, 'W'], [0x4C5B, 'ECL3_17', 0x84E7, 0xFF, 'W'],
  [0x4C5A, 'ECL4_34', 0x8C8E, 1, 'W'], [0x4C59, 'ECL5_51', 0x8FB6, 1, 'W'], [0x4CFD, 'ECL6_67', 0x93E7, 0xFF, 'I'],
  [0x4C86, 'ECL1_81', 0x928D, 1, 'W'], [0x4C86, 'ECL1_81', 0x92D7, 1, 'W'], [0x4C86, 'ECL1_81', 0x93DF, 2, 'W'], [0x4C86, 'ECL1_81', 0x94C2, 3, 'W'],
];

test('table: profile cab; every rule cell and value is written by the cited instruction in FLAGMAP', () => {
  assert.equal(PROFILE, 'cab');
  const fm = flagmap();
  for (const [cell, s, pc, value, kind] of WRITES) {
    const site = fm.get(cell)?.get(s)?.find((x) => x.pc === pc);
    assert.ok(site, `${hex(cell)} ${s} ${hex(pc)}`); assert.equal(site.kind, kind); assert.equal(site.value, value);
  }
  for (const [cell] of cellIndex()) {
    assert.ok(fm.has(cell), `${hex(cell)} in FLAGMAP`);
    assert.ok(cell < 0x4C00 || cell > 0x4C1F, `${hex(cell)} is not block-local`);
    const written = [...fm.get(cell).values()].flat().filter((x) => x.kind === 'W' || x.kind === 'I');
    assert.ok(written.length, `${hex(cell)} written`);
  }
  for (const q of Object.values(QUESTS)) for (const [cell, op, want] of q.rules) {
    if (op !== 'eq') continue;
    const values = [...fm.get(cell).values()].flat().filter((x) => x.kind !== 'T' && x.kind !== 'R').map((x) => x.value);
    assert.ok(values.includes(want), `${q.id}: ${hex(cell)} = ${want} is written somewhere`);
  }
  // the hub's count reads exactly the three chapter cells (QUESTS.md §1.0)
  const hubTests = [0x4C59, 0x4C5B, 0x4C5A].map((c) => fm.get(c).get('ECL1_80').filter((x) => x.kind === 'T').map((x) => x.pc));
  assert.ok(hubTests[0].includes(0x8238) && hubTests[1].includes(0x8248) && hubTests[2].includes(0x8258));
});

test('table: every text address is a PRINT / PRINTCLEAR of packed text in that script', { skip: LISTINGS }, () => {
  const refs = textRefs();
  assert.ok(refs.length >= 20);
  for (const ref of refs) {
    const l = listingAt(ref);
    assert.ok(l && /^PRINT(CLEAR)?$/.test(l.op) && l.text !== null, `${script(ref)} ${hex(ref[2])}`);
  }
});

const pos = (dataSet, block, addr) => ({ dataSet, block, addr });
test('state machine over a scripted flagSet / textPrinted sequence', () => {
  const log = createQuestLog(), status = (id) => log.list().find((q) => q.id === id).status;
  const steps = [
    () => log.applyText('', pos(2, 4, 0x839A)),                        // the Fire Knives' leader beaten
    () => log.applyFlag(0x4C2A, 1),                                    // ECL2_04 842F
    () => log.applyText('', pos(1, 80, 0x8389)),                       // a direction: offered
    () => log.applyText('', pos(1, 80, 0x83B1)),
    () => log.applyText('', pos(4, 34, 0x836E)),                       // the bond of Fzoul fades
    () => log.applyFlag(0x4C5A, 1),                                    // ECL4_34 8C8E
    () => log.applyText('', pos(1, 81, 0x90E4)), () => log.applyFlag(0x4C86, 1), () => log.applyFlag(0x4C86, 2),
    () => log.applyFlag(0x4C21, 1),                                    // the Tilverton carry-over: no progress
  ];
  const changes = steps.flatMap((f) => f());
  assert.deepEqual(changes.map((c) => `${c.id}:${c.to}`), ['tilverton:progress', 'tilverton:done', 'moander:offered', 'zhentil-keep:offered',
    'zhentil-keep:progress', 'zhentil-keep:rewarded', 'dagger-falls:offered', 'dagger-falls:progress', 'dagger-falls:rewarded']);
  assert.equal(status('magistrate-daughter'), 'unknown');
  log.applyFlag(0x4C21, 2); assert.equal(status('magistrate-daughter'), 'progress');
  log.applyText('', pos(5, 53, 0x8EFF)); assert.equal(status('magistrate-daughter'), 'failed');
  log.applyFlag(0x4C5B, 0xFF); assert.equal(status('moander'), 'closed');
  log.applyText('', pos(3, 18, 0x95EE)); assert.equal(status('moander'), 'closed');
  log.applyText('', pos(2, 1, 0x8F5A)); assert.equal(status('filani'), 'done');
  // a mark is tied to its block: the same address elsewhere does nothing
  assert.deepEqual(log.applyText('', pos(5, 51, 0x83CF)), []);
  // the finale sets 4CFD without a flagSet: a full read finds it
  log.readAll((a) => (a === 0x4CFD ? 0xFF : a === 0x4C5A ? 1 : 0));
  assert.equal(status('tyranthraxus'), 'done'); assert.equal(status('zhentil-keep'), 'rewarded'); assert.equal(status('dagger-falls'), 'offered');   // the offer mark stays; the flag went back to 0
  const snap = log.snapshot(); assert.deepEqual(snap.marks.filani, ['done']);
});

function fakeBus() {
  const handlers = new Map(); let mem = new Map(), position = { dataset: 1, block: 80 };
  return { enabled: true, state: { slot: null, mem: (a) => mem.get(a) ?? 0, position: () => position },
    on(n, fn) { (handlers.get(n) || handlers.set(n, new Set()).get(n)).add(fn); return () => handlers.get(n).delete(fn); },
    emit(n, p) { for (const fn of handlers.get(n) || []) fn(p, n); }, setMem(m) { mem = new Map(m); }, setPos(p) { position = p; } };
}
function memStore() { const data = new Map(); return ({ slot }) => ({ get: async (k, d) => structuredClone(data.get(slot + k) ?? d), set: async (k, v) => { data.set(slot + k, structuredClone(v)); return true; } }); }

test('tracker: textPrinted addresses mark before the texts load; marks per save slot; flags re-read on load', async () => {
  const bus = fakeBus(), storeFactory = memStore();
  let release; const texts = new Promise((r) => { release = r; });
  const t = startQuests({ bus, storeFactory, loadTexts: () => texts });
  const seen = []; t.onChange((c) => seen.push(...c.map((x) => `${x.id}:${x.to}`)));
  bus.emit('textPrinted', { text: 'x', addr: 0x8E9C, block: 1, dataset: 2 });            // Filani's question
  bus.emit('flagSet', { addr: 0x4C2A, value: 1, old: 0, region: 0, pc: 0x842F });
  assert.deepEqual(seen, ['filani:offered', 'tilverton:done']);
  release(new Map()); await t.ready;
  bus.emit('gameSaved', { slot: 'C' }); await new Promise((r) => setTimeout(r, 0));
  bus.setMem([[0x4C86, 2]]); bus.emit('saveLoaded', { slot: 'D' });
  assert.equal(t.log.status(0x4C86), 'rewarded'); assert.equal(t.log.status(0x4C2A), 'unknown');
  await new Promise((r) => setTimeout(r, 0)); assert.equal(t.log.status(0x4C13), 'unknown');   // slot D has no marks
  bus.setMem([[0x4C2A, 1]]); bus.emit('saveLoaded', { slot: 'C' }); await new Promise((r) => setTimeout(r, 0));
  assert.equal(t.log.status(0x4C13), 'offered'); assert.equal(t.log.status(0x4C2A), 'done');
  bus.enabled = false; bus.emit('flagSet', { addr: 0x4C5A, value: 1 }); assert.equal(t.log.status(0x4C5A), 'unknown');   // original mode
  t.stop();
});

test('local copy: every table text decodes from the player\'s ECLn.DAX and equals the listing', { skip: !existsSync(DATA) ? 'local player copy unavailable' : LISTINGS }, async () => {
  const map = await loadQuestTexts({ readFile: (n) => { try { return new Uint8Array(readFileSync(path.join(DATA, n))); } catch { return null; } } });
  const refs = textRefs();
  assert.equal(map.size, new Set(refs.map(refKey)).size);
  for (const ref of refs) assert.equal(map.get(refKey(ref)), listingAt(ref).text, refKey(ref));
});
