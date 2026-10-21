// game/test/engine/v13.test.mjs (cab-v13): the v1.3 (WizardWorks CD) support behind the cab-1.3 profile overlay —
// requests v13-1 (overlay, EXEPACK, dsMap), v13-2 (audio constants + 3-byte notes), v13-3 (behaviour switch),
// decode/V13_DELTA.md. Data: the owner's v1.0 folder (CAB_DEV_DATA) and the CD copy (CAB_V13_DATA or
// re-targets/goldbox/adnd-collectors-cd/WIZWORKS/CURSE), both read-only; tests needing a missing folder are skipped.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { G, newChar, configureState, dsImageFromExe, stateConfigView } from '../../engine/state.js';
import { variant } from '../../engine/variant.js';
import { configureAudio } from '../../engine/audio_cab.js';
import { applyOverlay } from '../../plus/games.js';
import { bind } from '../../areas/view_link.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const DATA10 = process.env.CAB_DEV_DATA || path.resolve(ROOT, '../re-targets/goldbox/cotab/curazure');
const DATA13 = process.env.CAB_V13_DATA || path.resolve(ROOT, '../re-targets/goldbox/adnd-collectors-cd/WIZWORKS/CURSE');
const base = JSON.parse(readFileSync(path.join(ROOT, 'game/profiles/cab.json'), 'utf8'));
const overlay = JSON.parse(readFileSync(path.join(ROOT, 'game/profiles/cab-1.3.json'), 'utf8'));
const p13 = applyOverlay({ ...base, url: 'file:///cab.json' }, { ...overlay, url: 'file:///cab-1.3.json' });
const HAVE10 = existsSync(path.join(DATA10, 'START.EXE')), HAVE13 = existsSync(path.join(DATA13, 'ST.EXE'));
const rd = (d, n) => new Uint8Array(readFileSync(path.join(d, n)));
const cfg = (p) => ({ exepack: !!p.engine.state.exepack, dsImageOffset: p.engine.state.dsImageOffset, dsBytes: p.engine.state.dsBytes, dsMap: p.engine.state.dsMap || null });

test('v13-1 dsMap: the CD ST.EXE unpacks to the v1.3 image and its DS maps onto the v1.0 image byte for byte', { skip: !(HAVE10 && HAVE13) }, () => {
  const a = dsImageFromExe(rd(DATA10, 'START.EXE'), cfg(base)), b = dsImageFromExe(rd(DATA13, 'ST.EXE'), cfg(p13));
  assert.equal(b.image.length, 62432);                                                     // 0xF3E paragraphs
  assert.equal(String.fromCharCode(...b.image.subarray(7, 7 + 30)), 'Curse of the Azure Bonds v1.3 ');
  assert.equal(String.fromCharCode(...a.image.subarray(7, 7 + 30)), 'Curse of the Azure Bonds v1.0 ');
  assert.equal(a.ds.length, 0x8F00); assert.equal(b.ds.length, 0x8F20);
  assert.deepEqual(b.ds.subarray(0, 0x47A2), a.ds.subarray(0, 0x47A2));                    // every game table and string
  assert.deepEqual(b.ds.subarray(0x47A6, 0x47E0), a.ds.subarray(0x47A6, 0x47E0));          // System unit words
  assert.equal(String.fromCharCode(...b.ds.subarray(1, 37)), 'CWLNRTESSCEDCSHSISERRRNSHSSTSSNNHSHN');   // rune row 0 at DS:0000
  assert.equal(b.ds[0x37DA + 1 * 16 + 1], a.ds[0x37DA + 1 * 16 + 1]);                        // spell table (pedia 14298)
  for (let i = 0x47E0; i < 0x8F00; i++) if (b.ds[i] !== 0) assert.fail('BSS not zero at ' + i.toString(16));
});

test('v13-1 configureState keeps the v1.0 defaults and takes the overlay (executable, dsMap)', () => {
  configureState(base.engine.state, base.recordSizes);
  let c = stateConfigView(); assert.equal(c.executable, 'START.EXE'); assert.equal(c.exepack, false); assert.equal(c.dsMap, null);
  configureState(p13.engine.state, p13.recordSizes);
  c = stateConfigView(); assert.equal(c.executable, 'ST.EXE'); assert.equal(c.exepack, true); assert.equal(c.dsMap.length, 2); assert.equal(c.dsImageOffset, 44000);
  configureState(base.engine.state, base.recordSizes);
  assert.equal(stateConfigView().dsMap, null);
});

test('v13-2 audio constants: v1.3 moves every CS variable by -6 and reads segment 0699; v1.0 is restored', () => {
  const a = configureAudio(p13.engine.audio);
  assert.deepEqual([a.SEG, a.SEGLEN, a.V_BUSY, a.V_LENTAB, a.V_LOUDEST, a.SPK_CHANNELS, a.SPK_NOTES, a.SPK_TABLE],
    [0x699, 0x1780, 0x11B, 0x151, 0x308, 0x170, 0x2F0, 0x4A2]);
  assert.equal(a.noteEntryBytes, 3); assert.equal(a.notesOnChannel0Only, true); assert.equal(a.noteOffGap, false);
  const b = configureAudio(null);
  assert.deepEqual([b.SEG, b.SEGLEN, b.V_BUSY, b.V_LENTAB, b.SPK_TABLE, b.noteEntryBytes, b.notesOnChannel0Only, b.noteOffGap],
    [0x713, 0x2700, 0x121, 0x157, 0x4A8, 2, false, true]);
});

test('v13-2 the v1.3 driver segment: record size 30h at 011D, the speaker sound table points into the note data', { skip: !HAVE13 }, () => {
  const { image } = dsImageFromExe(rd(DATA13, 'ST.EXE'), cfg(p13));
  const seg = image.subarray(0x699 * 16, 0x699 * 16 + 0x1780), w = (o) => seg[o] | (seg[o + 1] << 8);
  assert.equal(seg[0x11D], 0x30); assert.equal(seg[0x11A], 13);                            // record size, tick divider
  assert.deepEqual([w(0x164), w(0x166), w(0x168)], [0x1591, 0x15EF, 0x15F6]);               // command jump table (FA FB FC)
  for (let k = 0; k < 20 * 4; k++) { const p = w(0x4A2 + 2 * k); if (p) assert.ok(p >= 0x5F2 && p < 0x11D9, 'speaker table entry ' + k + ' -> ' + p.toString(16)); }
});

test('v13-3 effect handlers: v1.3 leaves 53h / 7Eh to the magic unit (stone gaze with the target selector, ov22 EffParalysingGaze)', async () => {
  const P12 = await import('../../areas/party_ov12.js'), M22 = await import('../../areas/magic_ov22.js');
  try {
    variant.set('cab-1.0');
    G.EffectHandler = new Array(0x94).fill(null); M22.InitSpellTable(); P12.InstallEffectHandlers();
    assert.equal(G.EffectHandler[0x53], P12.EffStoneGaze); assert.equal(G.EffectHandler[0x7E], P12.EffParalyzingGaze);   // ov12 wins (v1.0)
    variant.set('cab-1.3');
    G.EffectHandler = new Array(0x94).fill(null); M22.InitSpellTable(); P12.InstallEffectHandlers();
    assert.equal(G.EffectHandler[0x53], M22.EffStoneGazeTargeted); assert.equal(G.EffectHandler[0x7E], M22.EffParalysingGaze);
    assert.equal(G.EffectHandler[0x84], M22.EffThrowLightning); assert.equal(G.EffectHandler[0x93], G.EffectHandler[0x93]);
  } finally { variant.set('cab-1.0'); }
});

test('v13-3 AddSpellLineCounted v1.3: sorted by level, a new line goes before the first higher level, the same spell counts up', async () => {
  const M22 = await import('../../areas/magic_ov22.js');
  const ds = new Uint8Array(0x8F00);
  const setName = (id, s) => { const o = 0x27BD + id * 0x29; ds[o] = s.length; for (let i = 0; i < s.length; i++) ds[o + 1 + i] = s.charCodeAt(i); };
  const levels = { 1: 2, 2: 1, 3: 3, 4: 1, 5: 2 };
  for (const [id, lv] of Object.entries(levels)) { ds[0x37DA + id * 16 + 1] = lv; setName(+id, 'SPELL' + id); }
  bind({ ByteToStr: async (n) => String(n) });
  const saved = G.ds; G.ds = ds;
  try {
    variant.set('cab-1.3');
    G.sl_List = null; G.sl_Ids = new Array(84).fill(0); G.sl_Counts = new Array(84).fill(0);
    for (const id of [1, 2, 3, 4, 5, 2]) await M22.AddSpellLineCounted(id);
    const lines = []; for (let p = G.sl_List; p; p = p.next) lines.push(p.text);
    assert.deepEqual(lines, ['  SPELL2 (2)', '  SPELL4', '  SPELL1', '  SPELL5', '  SPELL3']);
    assert.deepEqual(G.sl_Ids.slice(0, 6), [2, 4, 1, 5, 3, 0]);
    assert.deepEqual(G.sl_Counts.slice(0, 6), [2, 1, 1, 1, 1, 0]);
    variant.set('cab-1.0');                                                                 // the v1.0 routine still runs
    G.sl_List = null; G.sl_Ids = new Array(84).fill(0); G.sl_Counts = new Array(84).fill(0);
    for (const id of [1, 2, 3]) await M22.AddSpellLineCounted(id);
    let n = 0; for (let p = G.sl_List; p; p = p.next) n++;
    assert.equal(n, 3);
  } finally { G.ds = saved; variant.set('cab-1.0'); }
});

test('v13-3 ConvertPoolCharacter: the exceptional-strength clamp lands on CHA max in v1.0 and on STR in v1.3', async () => {
  const { ConvertPoolCharacter } = await import('../../areas/engine_ov16.js');
  const ds = new Uint8Array(0x8F00);
  ds.set([0x03, 0x03, 0x12, 0x12, 0x64, 0x32, 0x03, 0x12, 0x03, 0x12, 0x03, 0x12, 0x03, 0x12, 0x03, 0x12], 0x3F86 + 7 * 16);   // human row (DS:3F86, v1.0 image)
  const pool = new Uint8Array(0x11D); pool[0x2E] = 7; pool[0x9E] = 0; pool.set([10, 11, 12, 13, 14, 15], 0x10); pool[0x16] = 0;
  const saved = G.ds; G.ds = ds;
  try {
    variant.set('cab-1.0'); let ch = newChar(); ConvertPoolCharacter(pool, ch);
    assert.equal(ch.b[0x10], 10); assert.equal(ch.b[0x1A], 0x64); assert.equal(ch.b[0x1B], 15);   // the v1.0 quirk: CHA max := 100
    variant.set('cab-1.3'); ch = newChar(); ConvertPoolCharacter(pool, ch);
    assert.equal(ch.b[0x10], 0x64); assert.equal(ch.b[0x1A], 15); assert.equal(ch.b[0x1B], 15);  // v1.3: STR := 100, CHA untouched
  } finally { G.ds = saved; variant.set('cab-1.0'); }
});

test('v13-3 variant switch defaults to cab-1.0 and reports is13 only for cab-1.3', () => {
  assert.equal(variant.id, 'cab-1.0'); assert.equal(variant.is13, false);
  variant.set('cab-1.3'); assert.equal(variant.is13, true);
  variant.set(null); assert.equal(variant.id, 'cab-1.0');
});
