// ov17_edit.test.mjs (cab-build-engine) — ENGINE ov17 edit routines (game/areas/engine_ov17_edit.js) with a stub display,
// a synthetic DS image and stubbed area routines (view_link bind). Run: node --test game/test/engine/ov17_edit.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Display } from '../../engine/display.js';
import { state as pic, AllocPicture } from '../../engine/pictures.js';
import { G, newChar, setPstr, pstr, configureState } from '../../engine/state.js';
configureState(null, { TChar: 422, item: 63, effect: 9, combat: 22 });
import { pushChar, pushExt } from '../../engine/input.js';
import { tiles } from '../../engine/tiles_cab.js';
import { bind } from '../../areas/view_link.js';
import { RemovePartyMember, IconEditor, ModifyCharacter, AddCharacterMenu, DropCharacterForever } from '../../areas/engine_ov17_edit.js';

pic.display = new Display(null);
pic.viewPic = AllocPicture(0xA8, 0x15, 1, 0);
G.ds = new Uint8Array(0x8F00);
G.GameSpeed = 0; G.VideoMode = 1;
// IconMenu[k] at DS:0721 + k*29h (as in START.EXE)
['', 'Parts 1st-color 2nd-color Size Exit', 'Head Weapon Exit', 'Weapon Body xxxx Shield Arm Leg Exit', ' Keep Exit', 'Next Prev Keep Exit']
  .forEach((s, k) => { const o = 0x721 + k * 0x29; G.ds[o] = s.length; for (let i = 0; i < s.length; i++) G.ds[o + 1 + i] = s.charCodeAt(i); });
[19, 1, 2, 3, 4, 6, 7, 30].forEach((v, i) => { G.ds[0x3EC0 + i] = v; });          // IconColourSlot
for (let c = 0; c < 8; c++) G.ds[0x3EB9 + c] = 10;                               // HitDiceLevels
// race 0 / gender 0 limits: STR 3..18, exc max 0, other abilities 3..18; class 0 minimum 3 for all
const rl = [3, 3, 18, 18, 0, 0, 3, 18, 3, 18, 3, 18, 3, 18, 3, 18];
rl.forEach((v, k) => { G.ds[0x3F86 + k] = v; });
for (let i = 0; i < 6; i++) G.ds[0x4172 + i] = 3;

const calls = [];
const icon = () => [AllocPicture(24, 3, 1, 1), AllocPicture(24, 3, 1, 1)];
bind({
  ShowTimedBottomMessage: (s) => { calls.push(['msg', s]); },
  PartySummary: () => {}, DeleteCharacterFiles: (c) => { calls.push(['del', pstr(c.b, 0)]); },
  DrawAbility: () => {}, DrawHP: () => {}, DrawCharacterSheet: () => {}, DrawCombatStats: () => {},
  RecalcItems: () => {}, WisdomBonusSpells: () => {}, ConHpAdj: () => 0,
  MinHitPoints: () => 1, MaxHitPoints: () => 60,
  LoadCharacterIcon: () => { tiles.icons[G.SelectedChar.b[0x143]] = icon(); },
  PaletteFlashOn: () => {}, PaletteFlashOff: () => {},
});

function party(...names) {
  G.ecl_Mem7C00 = new Uint16Array(0x400);
  let prev = null; G.PartyList = null;
  for (const n of names) {
    const c = newChar(); setPstr(c.b, 0, n, 15); c.b[0x143] = 1; c.b[0x196] = 1;
    if (prev) prev.next = c; else G.PartyList = c;
    prev = c;
  }
  G.ecl_Mem7C00[0x67C >> 1] = names.length;
  return () => { const r = []; for (let c = G.PartyList; c; c = c.next) r.push(pstr(c.b, 0)); return r; };
}

test('RemovePartyMember: head, middle, last, demo loop', async () => {
  let list = party('A', 'B', 'C');
  G.SelectedChar = G.PartyList;
  await RemovePartyMember(0, 1);
  assert.deepEqual(list(), ['B', 'C']); assert.equal(pstr(G.SelectedChar.b, 0), 'B'); assert.equal(G.ecl_Mem7C00[0x33E], 2);
  list = party('A', 'B', 'C');
  G.SelectedChar = G.PartyList.next;
  await RemovePartyMember(0, 1);
  assert.deepEqual(list(), ['A', 'C']); assert.equal(pstr(G.SelectedChar.b, 0), 'A');     // the predecessor
  list = party('A', 'B', 'C');
  G.SelectedChar = G.PartyList.next.next;
  await RemovePartyMember(1, 0);
  assert.deepEqual(list(), ['A', 'B']); assert.equal(pstr(G.SelectedChar.b, 0), 'B'); assert.equal(G.ecl_Mem7C00[0x33E], 3);   // keepCount
  list = party('A', 'B', 'C');
  G.SelectedChar = G.PartyList;
  let n = 0; while (G.PartyList && n++ < 10) await RemovePartyMember(1, 1);   // demo end (2200:3839)
  assert.equal(G.PartyList, null); assert.equal(G.SelectedChar, null); assert.equal(n, 3);
});

test('DropCharacterForever: Y, Y deletes and removes', async () => {
  const list = party('A', 'B'); G.SelectedChar = G.PartyList.next; calls.length = 0;
  pushChar('Y'); setTimeout(() => pushChar('Y'), 50);
  await DropCharacterForever();
  assert.deepEqual(list(), ['A']);
  assert.deepEqual(calls, [['msg', 'B bids you farewell.'], ['del', 'B']]);
});

test('IconEditor: Size -> Small -> Keep -> Exit -> Yes keeps the size', async () => {
  party('A'); G.SelectedChar = G.PartyList; G.SelectedChar.b[0x144] = 2;
  const keys = ['S', 'S', 'K', 'E', 'Y'];
  const t = setInterval(() => { if (keys.length) pushChar(keys.shift()); }, 30);
  await IconEditor();
  clearInterval(t);
  assert.equal(G.SelectedChar.b[0x144], 1);
  assert.equal(tiles.icons[12] ? tiles.icons[12][0] : null, null);                     // slot 12 freed
});

test('ModifyCharacter: Right on STR then Keep raises STR; Exit restores', async () => {
  party('A'); const c = G.SelectedChar = G.PartyList;
  for (let i = 0; i < 6; i++) { c.b[0x10 + 2 * i] = 10; c.b[0x11 + 2 * i] = 10; }
  c.b[0x109] = 1; c.b[0x78] = 8; c.b[0x1A4] = 8;
  pushExt(0x4D); setTimeout(() => pushChar('K'), 80);
  await ModifyCharacter();
  assert.equal(c.b[0x11], 11); assert.equal(c.b[0x10], 11); assert.equal(c.b[0x12C], 8); assert.equal(c.b[0xF8], 1);
  pushExt(0x4D); setTimeout(() => pushChar('E'), 80);
  await ModifyCharacter();
  assert.equal(c.b[0x11], 11);                                                       // restored
  c.b[0x127] = 1;                                                                    // xp 1: not modifiable
  await ModifyCharacter();
  assert.equal(c.b[0x11], 11);
});

test('AddCharacterMenu: Curse, Add BOB, Esc', async () => {
  party(); G.SelectedChar = null;
  bind({
    BuildCharacterFileList: (names, files) => { names.v = { text: 'BOB', isHeader: 0, next: null }; files.v = { text: 'BOB.GUY', isHeader: 0, next: null }; return true; },
    ReadCharacter: (f, c) => { setPstr(c.b, 0, f.replace('.GUY', ''), 15); },
    AddToParty: (c) => { c.next = null; if (!G.PartyList) G.PartyList = c; else { let p = G.PartyList; while (p.next) p = p.next; p.next = c; } G.SelectedChar = c; },
  });
  const keys = [['C'], ['\r'], ['\x1b']];
  const t = setInterval(() => { if (keys.length) pushChar(keys.shift()[0]); }, 40);
  await AddCharacterMenu();
  clearInterval(t);
  assert.equal(G.ImportSource, 0);
  assert.equal(pstr(G.PartyList.b, 0), 'BOB');
});
