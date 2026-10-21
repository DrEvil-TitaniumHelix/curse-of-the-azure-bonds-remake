// game/test/plus/hooks.test.mjs — GBP W1: event bus, master switch, journal references, region registry, state access.
// node --test game/test/plus/hooks.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { hooks, EVENTS } from '../../plus/hooks.js';
import { pointer, pointerHit, setPointerRegion, clearPointerRegions } from '../../engine/input.js';
import { EclVM, newChar, setPstr } from '../../engine/ecl.js';

const quiet = (fn) => { const e = console.error, w = console.warn; const seen = []; console.error = console.warn = (...a) => seen.push(a.join(' '));
  try { fn(); } finally { console.error = e; console.warn = w; } return seen; };

test('on / emit / off, payload thunk only evaluated when listened', () => {
  hooks.enabled = true;
  let n = 0, got = null;
  hooks.emit('moved', () => { n++; return { x: 1 }; });
  assert.equal(n, 0);
  const off = hooks.on('moved', (p) => { got = p; });
  hooks.emit('moved', () => { n++; return { x: 2 }; });
  assert.equal(n, 1); assert.deepEqual(got, { x: 2 });
  off();
  hooks.emit('moved', () => { n++; return { x: 3 }; });
  assert.equal(n, 1);
});

test('a throwing listener or payload never reaches the caller; other listeners still run', () => {
  let ran = false;
  const a = () => { throw new Error('boom'); }, b = () => { ran = true; };
  hooks.on('combatEnd', a); hooks.on('combatEnd', b);
  const log = quiet(() => { hooks.emit('combatEnd', { result: 0, xp: 1 }); hooks.emit('combatEnd', () => { throw new Error('bad payload'); }); });
  assert.ok(ran);
  assert.ok(log.some((l) => /boom/.test(l)) && log.some((l) => /bad payload/.test(l)));
  hooks.off('combatEnd', a); hooks.off('combatEnd', b);
  quiet(() => hooks.emit('noSuchEvent', {}));          // unknown name: warned, not thrown
});

test('master switch: disabled = emit is a no-op', () => {
  let n = 0;
  const off = hooks.on('*', () => n++);
  hooks.enabled = false;
  hooks.emit('textPrinted', { text: 'X' });
  assert.equal(n, 0);
  hooks.enabled = true;
  hooks.emit('textPrinted', { text: 'X' });
  assert.equal(n, 1);
  off();
});

test('journal references from printed text', () => {
  const refs = [];
  const off = hooks.on('journalRef', (p) => refs.push(p.kind === 'entry' ? p.n : 'P' + p.n));
  const print = (text, clear = true) => hooks.emit('textPrinted', { text, clear, window: 'text', source: 'PRINT' });
  print('YOU FIND A PIECE OF PAPER ON THE FLOOR IN THE ROOM.  YOU PLACE IT IN YOUR JOURNAL UNDER ENTRY 53');
  print('IT BECOMES ENTRY 37 IN YOUR JOURNAL.');
  print('YOU NOTE THEM IN YOUR JOURNAL AS JOURNAL ENTRIES 23 AND 14.');
  print('THE CROAKING OF FROGS GREETS YOUR ENTRY.');                  // no journal: nothing
  print(' YOU RECORD IT IN YOUR JOURNAL UNDER ENTRY ', false); print('12', false);   // number in a second PRINT
  print('PROCLAMATIONS ARE POSTED ON THE WALLS, IN YOUR JOURNAL YOU NOTE '); print('PROCLAMATION', false); print('CXXVI AND CX.', false);
  print('NEXT PAGE');                                                  // PRINTCLEAR ends the proclamation context
  print('I SAID NOTHING', false);
  off();
  assert.deepEqual(refs, [53, 37, 23, 14, 12, 'P126', 'P110']);
});

test('regions: engine regions listed, Plus regions go through the same pointer map, switch removes them', () => {
  clearPointerRegions();
  setPointerRegion('vlist', { x1: 8, y1: 8, x2: 100, y2: 50, prio: 5, keysAt: () => [[13, 0x1C]] });
  hooks.emit('listDrawn', { region: 'vlist', items: [{ text: 'A' }] });
  assert.ok(hooks.registerRegion({ id: 'pedia-1', rect: { x1: 200, y1: 0, x2: 210, y2: 10 }, left: [[0x41, 0]], right: [{ label: 'Info', keys: [] }], kind: 'monster' }));
  let acted = 0;
  hooks.registerRegion({ id: 'act', rect: { x1: 220, y1: 0, x2: 230, y2: 10 }, left: { action: () => acted++ }, scope: 'map' });
  assert.deepEqual(pointerHit(205, 5), [[0x41, 0]]);
  assert.deepEqual(pointerHit(225, 5), []); assert.equal(acted, 1);
  assert.deepEqual(pointerHit(20, 20), [[13, 0x1C]]);
  const r = hooks.regions();
  assert.equal(r.find((x) => x.id === 'vlist').kind, 'list');
  assert.equal(r.find((x) => x.id === 'vlist').draw.items[0].text, 'A');
  assert.equal(r.find((x) => x.id === 'pedia-1').right[0].label, 'Info');
  assert.equal(quiet(() => assert.equal(hooks.registerRegion({ id: 'hmenu', rect: { x1: 0, y1: 0, x2: 1, y2: 1 } }), false)).length, 1);
  hooks.clearRegions('map');
  assert.ok(!pointer.regions.has('act') && pointer.regions.has('pedia-1'));
  hooks.enabled = false;
  assert.ok(!pointer.regions.has('pedia-1') && pointer.regions.has('vlist'));   // engine region kept
  assert.equal(hooks.registerRegion({ id: 'x', rect: { x1: 0, y1: 0, x2: 1, y2: 1 } }), false);
  hooks.enabled = true;
  clearPointerRegions();
});

test('state access: party, position, mem, clock, slot (read-only)', () => {
  const vm = new EclVM({});
  const g = vm.g;
  const a = newChar(), b = newChar(), m = newChar();
  setPstr(a.b, 0, 'CORWIN', 15); setPstr(b.b, 0, 'ALYS', 15); setPstr(m.b, 0, 'KOBOLD', 15);
  a.b[0x11B] = 40; a.b[0x111] = 55; a.next = b; b.next = m;
  g.PartyHead = a; g.SelectedChar = b; g.party_MapX = 15; g.party_MapY = 4; g.party_Dir = 6; g.ecl_Block = 3;
  vm.setM1(0x6E3E, 2);
  vm.setM0(0x49C9, 13); vm.setM0(0x49C8, 2); vm.setM0(0x49C7, 5);
  vm.setM0(0x4A10, 7);
  hooks.bind({ G: g, vm });
  const p = hooks.state.party();
  assert.deepEqual(p.map((c) => c.name), ['CORWIN', 'ALYS']);
  assert.equal(p[0].hp, 40); assert.equal(p[0].ac, 5); assert.ok(p[1].selected);
  assert.equal(hooks.state.party({ monsters: true })[2].monster, true);
  assert.deepEqual({ ...hooks.state.position(), map3d: 0 }, { block: 3, dataset: 1, x: 15, y: 4, facing: 3, dir: 6, travelMode: 0, gameMode: undefined, map3d: 0, is3D: false });
  assert.equal(hooks.state.mem(0x4A10), 7);
  assert.equal(hooks.state.clock().text, '13:25');
  hooks.emit('saveLoaded', { slot: 'C' });
  assert.equal(hooks.state.slot, 'C');
  assert.ok(EVENTS.includes('flagSet'));
});
