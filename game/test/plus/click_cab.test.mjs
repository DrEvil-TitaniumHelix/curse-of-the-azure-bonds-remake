// game/test/plus/click_cab.test.mjs (cab-build-engine, S3 click) — the Curse providers of game/plus/click/cab.js:
// roster selection keys (End = next, Home = previous, wrapping: CycleSelectedChar 5000:32DC), the area-map path over
// GetPassage, the roster / area-map regions built from the draw events, and the walker's key sequence.
// Run: node --test game/test/plus/click_cab.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hooks } from '../../plus/hooks.js';
import { setPointerRegion, KEY, script } from '../../engine/input.js';
import { selectKeys, path, turnKeys, travelTo, mountCab, cab } from '../../plus/click/cab.js';

hooks.enabled = true;
mountCab();

const exploreMenu = () => {
  setPointerRegion('hmenu', { x1: 0, y1: 192, x2: 319, y2: 199, prio: 4, keysAt: () => null });
  hooks.emit('menuDrawn', { region: 'hmenu', kind: 'hmenu', prompt: '', items: ['Area', 'Cast', 'View', 'Encamp', 'Search', 'Look'].map((l) => ({ label: l, key: l[0] })) });
};

test('selectKeys: the shorter way, End = next, Home = previous (wrapping)', () => {
  assert.deepEqual(selectKeys(0, 2, 6), [KEY.end, KEY.end]);
  assert.deepEqual(selectKeys(0, 5, 6), [KEY.home]);
  assert.deepEqual(selectKeys(4, 2, 6), [KEY.home, KEY.home]);
  assert.deepEqual(selectKeys(3, 3, 6), []);
});

test('path: breadth-first over GetPassage (1 = open), 4 directions', () => {
  // a corridor 0,0 -> 3,0 with a wall between 1,0 and 2,0 except via row 1
  const open = (x, y, d) => {
    if (y === 0 && x === 1 && d === 2) return 0;                      // wall east of 1,0
    if (x < 0 || y < 0) return 0;
    return 1;
  };
  const p = path(0, 0, 3, 0, open);
  assert.ok(p && p.length === 5, JSON.stringify(p));                  // around the wall: 5 steps
  assert.deepEqual(path(2, 2, 2, 2, open), []);
  assert.equal(path(0, 0, 3, 0, () => 0), null);
  assert.deepEqual(turnKeys(0, 2), [KEY.right]); assert.deepEqual(turnKeys(0, 6), [KEY.left]); assert.deepEqual(turnKeys(2, 6), [KEY.down]);
});

test('roster region: a click types the selection keys only while the explore or top menu waits', () => {
  exploreMenu();
  const members = ['ALPHA', 'BETA', 'GAMMA'].map((name, i) => ({ name, index: i }));
  hooks.emit('partyDrawn', { region: 'roster', col: 0x11, firstRow: 4, members, selected: 0, rect: { x1: 0x88, y1: 32, x2: 319, y2: 55 } });
  const r = hooks.regions().find((x) => x.id === 'plus-roster');
  assert.ok(r);
  assert.deepEqual(r.left(0x90, 6 * 8 + 1), [KEY.home]);              // row 6 = GAMMA: one Home (wraps to the last)
  assert.equal(r.left(0x90, 4 * 8 + 1), null);                       // ALPHA is selected already
  const opts = r.right(0x90, 5 * 8 + 1);
  assert.equal(opts[0].label, 'Select BETA');
  assert.ok(opts.some((o) => o.label === 'Encamp: BETA' && o.keys.length === 2));
  hooks.emit('menuDrawn', { region: 'hmenu', kind: 'hmenu', prompt: 'Locked. ', items: [{ label: 'Bash', key: 'B' }] });
  assert.equal(r.left(0x90, 6 * 8 + 1), null);                       // another menu waits: inert
});

test('area-map region and the walker: turn + Up per explore-menu wait, stops when blocked', async () => {
  exploreMenu();
  let pos = { x: 7, y: 13, dir: 2 };
  hooks.bind({
    G: { get party_MapX() { return pos.x; }, get party_MapY() { return pos.y; }, get party_Dir() { return pos.dir; }, ecl_Block: 1, DataSet: 2 },
    vm: { m0: () => 0, m1: () => 0, is3D: () => true, getMem: () => 0 },
    view: { map: new Uint8Array(0x400), GetPassage: () => 1 },
  });
  hooks.emit('viewDrawn', { region: 'view', mode: 'areamap', x: 7, y: 13, facing: 1, origin: { x: 2, y: 5 } });
  const r = hooks.regions().find((x) => x.id === 'plus-areamap');
  assert.ok(r);
  const opts = r.right(24 + 8 * 5, 24 + 8 * 7);                      // map cell 7,12 = one step north
  assert.match(opts[0].label, /^Walk to 7,12 \(1 step\)/);
  script.keys.length = 0;
  const done = travelTo(7, 11);                                      // north twice: turn left (E -> N), Up, Up
  assert.deepEqual(script.keys.length ? script.keys : [], []);       // one key goes straight to the buffer
  pos.dir = 0; exploreMenu();                                        // the turn happened, the menu waits again
  hooks.emit('moved', { x: 7, y: 12, stepped: true }); pos.y = 12;   // Up -> the step
  exploreMenu();
  hooks.emit('moved', { x: 7, y: 11, stepped: true }); pos.y = 11;
  exploreMenu();
  assert.equal(await done, 'arrived');
  assert.equal(cab.walk, null);
  const blocked = travelTo(7, 9);
  exploreMenu();                                                     // Up typed, but no moved event before the menu
  assert.equal(await blocked, 'blocked');
});
