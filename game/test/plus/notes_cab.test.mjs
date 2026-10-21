// notes_cab.test.mjs (cab-plus-shell, S4): the Curse side of the diary and the Journal tab data.
//  - journalRef -> the cited-entry list, per save slot, with when / where / the cited line (payload of hooks.js PER-8);
//  - the reveal rule: player text is shown only for entries the game has cited in that slot (PLUS_LAYER W4);
//  - the Curse diary events (areaEntered place + clock, characterImported, npcLeft, combatEnd { partyDead });
//  - no content shipped (CR-1 A): no printed script text of the decode listings is inside game/plus or the profile.
// Synthetic texts only. Run: node --test game/test/plus/notes_cab.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createNotesTracker } from '../../plus/notes/tracker.js';
import { parseJournal } from '../../plus/journal/import.js';
import { hooks } from '../../plus/hooks.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
function bus() {
 const listeners = new Set();
 return { enabled: true, state: { slot: 'A', position: () => ({ dataset: 2, block: 1, map3d: 1, travelMode: 1, x: 7, y: 13 }), clock: () => ({ day: 2, text: '05:10' }) },
  on(_, fn) { listeners.add(fn); return () => listeners.delete(fn); },
  emit(name, p) { if (['saveLoaded', 'gameSaved'].includes(name)) this.state.slot = p.slot; for (const fn of listeners) fn(p, name); } };
}
function storage() {
 const data = new Map();
 return { data, factory: ({ profile, slot }) => ({ async get(k, f) { await new Promise((r) => setTimeout(r, 1)); return structuredClone(data.get(JSON.stringify([profile, slot, k])) ?? f); },
  async set(k, v) { data.set(JSON.stringify([profile, slot, k]), structuredClone(v)); return true; } }) };
}
const cite = (n, extra = {}) => ({ n, kind: 'entry', text: `SYNTHETIC LINE ${n}.`, source: 'PRINT', addr: 0x8800 + n, block: 1, dataset: 2, scene: 'SYNTHETIC SCENE', clock: '05:10', ...extra });

test('journalRef builds the cited-entry list per save slot, in number order, with when / where / line', async () => {
 const b = bus(), s = storage(), t = createNotesTracker({ bus: b, storeFactory: s.factory });
 b.emit('journalRef', cite(58)); b.emit('journalRef', cite(18)); b.emit('journalRef', cite(18));   // a redraw: same site, same time
 await t.flush();
 assert.deepEqual(t.cited().map((e) => e.n), [18, 58]);
 const [c] = t.cited()[0].citations;
 assert.equal(t.cited()[0].citations.length, 1);
 assert.deepEqual([c.clock, c.dataset, c.block, c.addr, c.line, c.scene], ['05:10', 2, 1, 0x8812, 'SYNTHETIC LINE 18.', 'SYNTHETIC SCENE']);
 assert.equal(c.time.day, 2); assert.equal(c.place.x, 7);
 b.emit('saveLoaded', { slot: 'B' }); await t.flush();
 assert.deepEqual(t.cited(), []);
 b.emit('journalRef', cite(4, { block: 2, addr: 0x852D })); await t.flush();
 assert.deepEqual(t.cited().map((e) => e.n), [4]);
 b.emit('saveLoaded', { slot: 'A' }); await t.flush();
 assert.deepEqual(t.cited().map((e) => e.n), [18, 58]);
 b.emit('journalRef', cite(18, { addr: 0x9000, block: 3 })); await t.flush();   // a second site citing the same entry
 assert.equal(t.cited()[0].citations.length, 2);
 assert.equal(t.notes.filter((n) => n.kind === 'journal').length, 4);
 t.dispose();
});

test('reveal rule: player text only for cited entries, per slot; pasted text per entry', async () => {
 const b = bus(), t = createNotesTracker({ bus: b, storeFactory: storage().factory });
 await t.importEntries(parseJournal('Entry 4\nSynthetic four\nEntry 31\nSynthetic thirty-one'));
 assert.deepEqual(t.cited(), []); assert.equal(t.entry('entry:4'), null);
 b.emit('journalRef', cite(31)); await t.flush();
 assert.deepEqual(t.cited().map((e) => [e.n, e.text]), [[31, 'Synthetic thirty-one']]);
 assert.equal(t.entry('entry:4'), null);
 b.emit('journalRef', cite(22)); await t.flush();
 assert.equal(t.cited().find((e) => e.n === 22).text, null);
 await t.setEntry('entry:22', '  Synthetic pasted  '); await t.setEntry('bogus', 'x');
 assert.equal(t.cited().find((e) => e.n === 22).text, 'Synthetic pasted');
 b.emit('saveLoaded', { slot: 'C' }); await t.flush();
 assert.deepEqual(t.cited(), []); assert.equal(t.entry('entry:31'), null);
 t.dispose();
});

test('the real hooks.js journalRef (Curse split "... JOURNAL " / "ENTRY 30.") reaches the list', async () => {
 const s = storage(), was = hooks.enabled; hooks.enabled = true;
 const t = createNotesTracker({ bus: hooks, storeFactory: s.factory });
 hooks.emit('textPrinted', { text: 'SYNTHETIC SCENE', clear: true });
 hooks.emit('textPrinted', { text: 'YOU LOG IT AS JOURNAL ' });
 hooks.emit('textPrinted', { text: 'ENTRY 30.' });
 await t.flush();
 assert.deepEqual(t.cited().map((e) => e.n), [30]);
 hooks.enabled = false; hooks.emit('textPrinted', { text: 'RECORD IT IN JOURNAL ENTRY 41.' }); await t.flush();
 assert.deepEqual(t.cited().map((e) => e.n), [30], 'original mode records nothing');
 hooks.enabled = was; t.dispose();
});

test('Curse diary events: area with place + clock, character imported, NPC left, fight over', async () => {
 const b = bus(), t = createNotesTracker({ bus: b, storeFactory: storage().factory });
 b.emit('areaEntered', { dataset: 2, block: 1, source: 'NEWECL' });
 b.emit('characterImported', { source: 1, from: 'pool', file: 'CHRDATJ1.SAV', name: 'SYNTH' });
 b.emit('npcLeft', { name: 'SYNTHNPC', block: 1, addr: 0x8000 });
 b.emit('combatEnd', { partyDead: false, party: [] });
 await t.flush();
 assert.deepEqual(t.notes.map((n) => n.text), ['First visit: ECL2/1 at 05:10', 'SYNTH joined the roster from Pool of Radiance (CHRDATJ1.SAV)',
  'SYNTHNPC left the party', 'Fight over: the party stands']);
 t.dispose();
});

const SCRIPTS = join(ROOT, 'decode', 'ecl', 'scripts');   // private workspace only (the public tree has no listings)
test('no content shipped: no printed script text of the decode listings is in game/plus or the profile', { skip: existsSync(SCRIPTS) && readdirSync(SCRIPTS).some((f) => f.endsWith('.ecl.txt')) ? false : 'decode listings not in this tree (public)' }, () => {
 const texts = new Set();
 const dir = SCRIPTS;
 for (const f of readdirSync(dir)) if (f.endsWith('.ecl.txt'))
  for (const m of readFileSync(join(dir, f), 'utf8').matchAll(/PRINT(?:CLEAR)?\s+"([^"]{24,})"/g)) texts.add(m[1].trim());
 assert.ok(texts.size > 100, `listing texts read: ${texts.size}`);
 const files = [];
 const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else files.push(p); } };
 walk(join(ROOT, 'game', 'plus')); files.push(join(ROOT, 'game', 'profiles', 'cab.json'));
 for (const p of files) {
  assert.doesNotMatch(p, /\.(pdf|txt)$/i, `no journal file in ${p}`);
  const body = readFileSync(p, 'utf8');
  for (const t of texts) assert.ok(!body.includes(t), `${p} contains script text "${t.slice(0, 40)}"`);
 }
});
