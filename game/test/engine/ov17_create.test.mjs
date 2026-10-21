// ov17_create.test.mjs — ENGINE ov17 CreateCharacter / TrainCharacter / hit points (game/areas/engine_ov17_create.js).
// Runs the creation of a dwarf / male / fighter / lawful good named ALPHA with a fixed RandSeed against the owner's v1.0
// files (read-only, CAB_DEV_DATA or re-targets/goldbox/cotab/curazure), keys typed one at a time by the input.js key
// script, a canvas-less Display, and the save store's memory fallback. The DOSBox run explore8 (decode/data/SAVES.md) was
// not seeded, so the record is compared by structure and by the decode's fixed values.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const DATA = process.env.CAB_DEV_DATA || join(ROOT, '..', 're-targets', 'goldbox', 'cotab', 'curazure');
const HAVE = existsSync(DATA);

const { G, configureState, newChar, rdW } = await import('../../engine/state.js');
const { state: pic, configurePictures, AllocPicture, Load8x8Set } = await import('../../engine/pictures.js');
const { Display } = await import('../../engine/display.js');
const { useByoc } = await import('../../engine/dax.js');
const { LoadTextFont } = await import('../../engine/text.js');
const { setRandSeed } = await import('../../engine/tp.js');
const input = await import('../../engine/input.js');
const files = await import('../../engine/files.js');
const { bind } = await import('../../areas/view_link.js');
const ov17 = await import('../../areas/engine_ov17_create.js');

async function setup() {
  configureState({ exepack: false, dsImageOffset: 0xC1C0, dsBytes: 0x8F00 }, { TChar: 0x1A6, item: 0x3F, effect: 9, combat: 0x16 });
  const names = Object.fromEntries(readdirSync(DATA).map((f) => [f.toUpperCase(), f]));
  useByoc(async (n) => (names[n] ? new Uint8Array(readFileSync(join(DATA, names[n]))) : null));
  const exe = new Uint8Array(readFileSync(join(DATA, names['START.EXE'])));
  const u16 = (o) => exe[o] | (exe[o + 1] << 8);
  const size = u16(2) ? (u16(4) - 1) * 512 + u16(2) : u16(4) * 512;
  const img = exe.slice(u16(8) * 16, size);
  const ds = new Uint8Array(0x8F00); ds.set(img.subarray(0xC1C0, 0xC1C0 + 0x8F00));
  G.ds = ds; G.image = img;
  pic.display = new Display(null);
  configurePictures({ symbolMax: 0x127, curseBlits: true, flushAfterLoad: true });
  G.DataSet = 1;
  pic.symbolPic = AllocPicture(8, 1, 1, 0); pic.viewPic = AllocPicture(0xA8, 0x15, 1, 0);
  await LoadTextFont();
  await Load8x8Set(0xCA, 4); await Load8x8Set(0xCB, 0);
  G.ecl_Mem4B00 = new Uint16Array(0x400); G.ecl_Mem7C00 = new Uint16Array(0x400); G.ecl_Mem7A00 = new Uint16Array(0x200);
  G.SelectedChar = null; G.PartyList = null; G.FreeTraining = 0; G.g_8B6F = 0; G.g_4FC8 = 0; G.GameSpeed = 0; G.TextOutputActive = 0;
}
const keys = (s) => { for (const ch of s) input.script.keys.push(ch === '\r' ? [13, 0x1C] : [ch.charCodeAt(0), 0]); };

test('hit-point routines and PayGold follow the listing', { skip: !HAVE }, async () => {
  await setup();
  const c = newChar();
  c.b[0x75] = 2; c.b[0x109 + 2] = 1; c.b[0x19] = 16;                    // fighter level 1, CON 16
  G.SelectedChar = c;
  assert.equal(ov17.ConHpAdj(2), 2);
  c.b[0x19] = 18; assert.equal(ov17.ConHpAdj(2), 4); assert.equal(ov17.ConHpAdj(5), 2);
  c.b[0x19] = 3; assert.equal(ov17.ConHpAdj(0), -2);
  c.b[0x19] = 16;
  const bonus = ov17.ConHpBonus(c);
  assert.equal(bonus, ((G.ds[0x427F + 16] ^ 0x80) - 0x80));           // ConBonus[16], no fighter extra below CON 17
  const r = ov17.RollHitDice(c, 0xFF);
  assert.ok(r >= 1 && r <= G.ds[0x0818 + 2] * G.ds[0x0820 + 2], 'roll within the hit dice ' + r);
  assert.ok(ov17.MaxHitPoints(c) >= ov17.MinHitPoints(c));
  // PayGold(1000, c) with 300 platinum: coin values DS:0CA2; the total value paid must equal 1000 gp (change returned)
  const value = (k) => (G.ds[0x0CA2 + k * 4] | (G.ds[0x0CA3 + k * 4] << 8) | (G.ds[0x0CA4 + k * 4] << 16) | (G.ds[0x0CA5 + k * 4] << 24));
  const worth = (cc) => { let t = 0; for (let k = 0; k < 7; k++) t += rdW(cc.b, 0xFB + 2 * k) * value(k); return t; };
  c.b.fill(0, 0xFB, 0x109); c.b[0x103] = 300 & 0xFF; c.b[0x104] = 300 >> 8;
  const before = worth(c);
  ov17.PayGold(1000, c);
  assert.equal(before - worth(c), 1000 * 200, 'paid exactly 1000 gp in copper units');
});

test('CreateCharacter: dwarf / male / fighter / lawful good, trained to its starting XP, ALPHA.GUY written', { skip: !HAVE, timeout: 60000 }, async () => {
  await setup();
  const ov16 = await import('../../areas/engine_ov16.js').catch(() => null);
  const written = [];
  bind({
    IconEditor: async () => {},
    ...(ov16 && ov16.WriteCharacter ? {} : { WriteCharacter: async (ch) => { written.push(ch); await files.writeFile('ALPHA.GUY', ch.b); } }),
  });
  setRandSeed(20261020);
  keys('SSSS' + 'N' + 'ALPHA\r' + 'Y');                               // race, gender, class, alignment, Reroll? N, name, Save? Y
  await ov17.CreateCharacter();
  const guy = await files.readFile('ALPHA.GUY');
  assert.ok(guy, 'ALPHA.GUY in the save store');
  assert.equal(guy.length, 0x1A6);
  const b = guy, s = (o) => String.fromCharCode(...b.subarray(o + 1, o + 1 + b[o]));
  assert.equal(s(0), 'ALPHA');
  assert.equal(b[0x74], 1, 'race dwarf');
  assert.equal(b[0x119], 0, 'male');
  assert.equal(b[0x75], 2, 'fighter');
  assert.equal(b[0x11B], 0, 'lawful good');
  assert.equal(rdW(b, 0x103), 300, 'platinum 300');
  assert.equal(b[0x127] | (b[0x128] << 8) | (b[0x129] << 16), 25000, 'XP 25000');
  assert.equal(b[0x109 + 2], 5, 'trained to fighter level 5 (SAVES.md save D)');
  assert.ok(b[0x78] >= 5 && b[0x78] <= 5 * 10 + 5 * 5, 'HP max within the dice ' + b[0x78]);
  assert.equal(b[0x1A4], b[0x78], 'HP = HP max');
  assert.equal(b[0xE4], 12, 'move 12'); assert.equal(b[0x144], 1, 'small icon (dwarf)');
  assert.deepEqual([...b.subarray(0x145, 0x14B)], [0x91, 0xA2, 0xB3, 0xC4, 0xE6, 0xF7], 'icon colours (SAVES.md)');
  for (let i = 0; i < 6; i++) assert.equal(b[0x10 + 2 * i], b[0x11 + 2 * i], 'max = current ability ' + i);
  const lim = (k) => G.ds[0x3F86 + 1 * 16 + k];
  assert.ok(b[0x11] >= lim(0) && b[0x11] <= lim(2), 'STR within the dwarf limits');
  assert.equal(b[0x143], 0x0A); assert.equal(b[0x196], 1); assert.equal(b[0x124], 0x32);
  assert.equal(G.ecl_Mem7C00[0x550 >> 1], 0, 'training hall restored');
});
