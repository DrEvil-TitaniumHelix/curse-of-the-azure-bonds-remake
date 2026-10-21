// status_cab.test.mjs (cab-plus-shell, step 4): the Status tab model from the Curse hooks state.
import test from 'node:test';
import assert from 'node:assert/strict';
import { statusModel } from '../../plus/tabs/status.js';
const member = { name: 'TAMSIN', hp: 21, hpMax: 30, ac: 4, levels: [0, 0, 5, 0, 0, 4, 0, 0], xp: 12000, money: [0, 0, 0, 77, 300, 0, 0], npc: false, selected: true };
test('3D area: ECL set/block, map id, square, facing, clock, party levels by base class', () => {
 const state = { slot: 'B', position: () => ({ dataset: 2, block: 1, is3D: true, map3d: 1, x: 7, y: 13, facing: 1 }), clock: () => ({ text: '05:10', day: 1, month: 0, year: 0 }), party: () => [member], mem: () => 0 };
 const m = statusModel(state, { bigPic: null });
 assert.equal(m.slot, 'B'); assert.equal(m.place, 'ECL2/1'); assert.equal(m.where, '3D map 1, square (7, 13), facing East');
 assert.equal(m.time, '05:10, day 1, month 0, year 0');
 assert.deepEqual(m.members[0], { name: 'TAMSIN', hp: '21 / 30', ac: 4, levels: 'Fighter 5 / Magic-User 4', xp: 12000, gold: 77, npc: false, selected: true });
});
test('overland (BIGPIC 121): the location of VM 4CA1; no game: placeholders', () => {
 const state = { position: () => ({ dataset: 1, block: 80, is3D: false }), clock: () => null, party: () => [], mem: (a) => (a === 0x4CA1 ? 0x0109 : 0) };
 const m = statusModel(state, { bigPic: 121 });
 assert.equal(m.where, 'the overland, place 9'); assert.equal(m.time, 'Unavailable'); assert.equal(m.slot, null);
 assert.equal(statusModel({ position: () => ({ dataset: 2, block: 2, is3D: false }), party: () => [] }, { bigPic: 120 }).where, 'a 2D area');
 assert.equal(statusModel({ position: () => null }, {}).place, 'No game loaded');
});
