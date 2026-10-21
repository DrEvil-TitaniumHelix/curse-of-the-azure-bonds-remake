// W8 helpers (gbp-helpers): pure parts. node --test game/test/plus/helpers.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { glyphTable, readCell, readScreen, lineText, glyphChar } from '../../plus/helpers/textcells.js';
import { nameAt, tooltipText } from '../../plus/helpers/tooltips.js';
import { createCombatModel, MENU_WORDS, messageBlocks } from '../../plus/helpers/combatlog.js';
import { createSafePoint, createSaves } from '../../plus/helpers/saves.js';
import { stepKeys, rowOf, memorised, K, createPresets } from '../../plus/helpers/presets.js';
import { fitScale } from '../../plus/helpers/margins.js';

// a synthetic 64-glyph font: glyph g = rows of distinct bit patterns (blank for ' ' = 32)
const font = new Uint8Array(64 * 8);
for (let g = 0; g < 64; g++) if (g !== 32) for (let r = 0; r < 8; r++) font[g * 8 + r] = (g * 7 + r * 13 + 1) & 0xFF;
function drawText(pix, col, row, colour, s) {        // as text.js DrawRepeatedGlyph with textMap
  for (const ch of s) {
    const g = ch.toUpperCase().charCodeAt(0) % 64;
    for (let r = 0; r < 8; r++) for (let b = 0; b < 8; b++) pix[(row * 8 + r) * 320 + col * 8 + b] = (font[g * 8 + r] & (0x80 >> b)) ? colour : 0;
    col++;
  }
}

test('textcells: glyphs read back from pixels, colour kept; pictures are not text', () => {
  const pix = new Uint8Array(320 * 200), t = glyphTable(font);
  drawText(pix, 2, 24, 10, 'AREA CAST VIEW');
  drawText(pix, 1, 17, 15, 'CORWIN HITS KOBOLD.');
  const screen = readScreen(pix, t);
  assert.equal(lineText(screen[24]).trim(), 'AREA CAST VIEW');
  assert.equal(lineText(screen[17]).trim(), 'CORWIN HITS KOBOLD.');
  assert.equal(readCell(pix, t, 2, 24).colour, 10);
  pix[5 * 320 + 3] = 4; pix[5 * 320 + 4] = 9;          // two colours in one cell: not a glyph
  assert.equal(readCell(pix, t, 0, 0), null);
  assert.equal(glyphChar(1), 'A'); assert.equal(glyphChar(33), '!');
});

test('tooltips: the revealed name under the pointer column, whole words, longest first', () => {
  const entries = [{ id: 'i1', name: 'Long Sword', kind: 'item', stats: { Weight: 60 } }, { id: 'i2', name: 'Sword', kind: 'itemType' }, { id: 'm', name: 'Kobold', kind: 'monster', whereMet: [{ dataSet: 2, block: 20 }] }];
  const line = ' *LONG SWORD          KOBOLDS  ';
  assert.equal(nameAt(line, 3, entries).id, 'i1');
  assert.equal(nameAt(line, 8, entries).id, 'i1');
  assert.equal(nameAt(line, 22, entries), null);       // KOBOLDS is not the whole word KOBOLD
  assert.equal(nameAt(' KOBOLD ', 2, entries).id, 'm');
  assert.equal(nameAt(line, 15, entries), null);
  assert.match(tooltipText(entries[2]), /Kobold\nMonster\nMet: data set 2, block 20/);
});

test('combat log: blocks logged once complete, treasure, end; nothing outside combat; panel read-back; plain copy', () => {
  const m = createCombatModel();
  m.rows(['IGNORED OUTSIDE COMBAT']);
  m.start({ monsters: [{ name: 'KOBOLD' }, { name: 'KOBOLD' }, { name: 'ORC' }] });
  m.rows(['THORGRIM ATTACKS']); m.rows(['THORGRIM ATTACKS KOBOLD']); m.rows(['THORGRIM ATTACKS KOBOLD HITTING FOR 12']);   // written line by line
  m.rows(['THORGRIM ATTACKS KOBOLD HITTING FOR 12', 'KOBOLD GOES DOWN']);
  m.rows(['PIP ATTACKS KOBOLD AND MISSES']);
  m.treasure({ money: [0, 0, 0, 12, 0, 0, 0], items: [{ name: 'Short Sword' }] });
  m.end({ result: 'won', xp: 35 });
  assert.deepEqual(m.entries.map((e) => e.text), ['Combat: 2 × KOBOLD, ORC', 'THORGRIM ATTACKS KOBOLD HITTING FOR 12', 'KOBOLD GOES DOWN',
    'Treasure: 12 gold, Short Sword', 'PIP ATTACKS KOBOLD AND MISSES', 'Victory — 35 XP each']);
  assert.match(m.plain(), /^Combat: 2 × KOBOLD, ORC\nTHORGRIM ATTACKS/);
  assert.ok(MENU_WORDS.test('MOVE VIEW AIM USE CAST TURN GUARD QUICK'));
  const pix = new Uint8Array(320 * 200), t = glyphTable(font);
  drawText(pix, 23, 10, 15, 'THORGRIM'); drawText(pix, 23, 11, 15, 'ATTACKS'); drawText(pix, 23, 16, 15, 'KOBOLD'); drawText(pix, 23, 17, 15, 'GOES DOWN');
  drawText(pix, 0, 12, 4, 'XXXX');                                // map area: not the panel
  assert.deepEqual(messageBlocks(readScreen(pix, t)), []);      // no panel frame yet: not the combat screen
  for (let c = 23 * 8; c < 39 * 8; c++) for (let r = 0; r < 8; r++) pix[(22 * 8 + r) * 320 + c] = (c + r) % 3 ? 7 : 1;   // frame
  assert.deepEqual(messageBlocks(readScreen(pix, t)), ['THORGRIM ATTACKS', 'KOBOLD GOES DOWN']);
});

test('saves: safe only at the explore menu outside combat; F5 path asks for the engine entry; autosave rotates', async () => {
  const sp = createSafePoint();
  const explore = { kind: 'hmenu', items: ['Area', 'Cast', 'View', 'Encamp', 'Search', 'Look'].map((label) => ({ label })) };
  assert.equal(sp.safe, false);
  sp.event('menuDrawn', explore); assert.equal(sp.safe, true);
  sp.event('textPrinted', { text: 'A PROMPT' }); assert.equal(sp.safe, false);
  sp.event('menuDrawn', explore); sp.event('combatStart', {}); sp.event('menuDrawn', explore); assert.equal(sp.safe, false);
  sp.event('combatEnd', {}); sp.event('menuDrawn', explore); assert.equal(sp.safe, true);

  const on = new Map(), msgs = [], calls = [];
  const bus = { on(n, fn) { on.set(n, fn); return () => on.delete(n); } };
  const emit = (n, p) => on.get('*')?.(p, n);
  globalThis.addEventListener ||= () => {}; globalThis.removeEventListener ||= () => {};
  const s = createSaves({ bus, notify: (t) => msgs.push(t) }).install();
  s.set('quick', true); s.set('auto', true);
  emit('menuDrawn', explore);
  assert.equal(await s.quickSave(), false); assert.match(msgs.at(-1), /plus request #11/);   // cab: the Curse engine entry
  bus.engine = { save: async (k) => { calls.push('save ' + k); }, load: async (k) => { calls.push('load ' + k); } };
  assert.equal(await s.quickSave(), true); assert.equal(await s.quickLoad(), true);
  for (let i = 0; i < 4; i++) { emit('areaEntered', {}); emit('textPrinted', {}); emit('menuDrawn', explore); await new Promise((r) => setTimeout(r, 0)); }
  assert.deepEqual(calls, ['save Q', 'load Q', 'save X', 'save Y', 'save Z']);   // the first entry after the quick load is the load's own
  emit('areaEntered', {}); emit('textPrinted', {}); emit('menuDrawn', explore); await new Promise((r) => setTimeout(r, 0));
  assert.equal(calls.at(-1), 'save X');
  emit('combatStart', {}); emit('areaEntered', {}); emit('menuDrawn', explore); await new Promise((r) => setTimeout(r, 0));
  assert.equal(calls.length, 6);                                  // never in combat
  s.set('quick', false); assert.equal(await s.quickSave(), false);
  s.uninstall();
});

test('presets: memorised names, shortest list steps with wrap, rows by name, typed key plan', async () => {
  const ds = new Uint8Array(0x28E9 + 60 * 0x29);
  const put = (id, s) => { const o = 0x28E9 + id * 0x29; ds[o] = s.length; for (let i = 0; i < s.length; i++) ds[o + 1 + i] = s.charCodeAt(i); };
  put(1, 'Bless'); put(2, 'Cure Light Wounds');
  const rec = new Uint8Array(285); rec[0x17] = 2; rec[0x18] = 0x81;
  assert.deepEqual(memorised(rec, ds), ['Cure Light Wounds', 'Bless']);
  const six = Array.from({ length: 6 }, (_, i) => ({ text: 'S' + i }));
  assert.deepEqual(stepKeys(six, 5, 0), [K.End]);                 // last row -> first: one End (wraps)
  assert.deepEqual(stepKeys(six, 0, 2), [K.End, K.End]);
  assert.deepEqual(stepKeys(six, 3, 1), [K.Home, K.Home]);
  // the camp memorize list (GBP-HELPERS-1): headers are not rows; from Find Traps (10) up to Cure Light Wounds (3) = 6 Home
  const book = ['#1', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', '#2', 'i', 'j', 'k', 'l', 'm', 'n', 'o'].map((t) => ({ text: t, header: t[0] === '#' }));
  assert.deepEqual(stepKeys(book, 10, 3), Array(6).fill(K.Home));
  const items = [{ text: 'LEVEL 1', header: true }, { text: 'BLESS' }, { text: 'CURE LIGHT WOUNDS' }];
  assert.equal(rowOf(items, 'Cure Light Wounds'), 2);
  const typed = [], data = new Map();
  const store = { get: async (k, f) => data.get(k) ?? f, set: async (k, v) => { data.set(k, structuredClone(v)); } };
  const bus = { on: () => () => {}, state: { party: () => [{ name: 'ALYS', selected: true, record: rec }] } };
  const p = createPresets({ bus, store, ds: () => ds, typeKeys: (k) => typed.push(...k) });
  p.set(true);
  assert.deepEqual(await p.saveCurrent(), ['Cure Light Wounds', 'Bless']);
  await p.apply();
  assert.deepEqual(typed, [K.M]);
  p.listed({ items, index: 2 }); assert.deepEqual(typed.slice(1), [K.M]);           // already on CLW
  p.listed({ items, index: 2 }); assert.deepEqual(typed.slice(2), [K.End, K.M]);    // to BLESS: one step either way, End (wraps) wins ties
  p.listed({ items, index: 1 }); assert.deepEqual(typed.slice(4), [K.E, K.E, K.Y]);
  assert.equal(p.job, null);
});

test('margins: integer scale with and without the margin', () => {
  assert.equal(fitScale(1280, 800), 4); assert.equal(fitScale(1280, 800, 48), 3); assert.equal(fitScale(300, 100, 48), 1);
});
