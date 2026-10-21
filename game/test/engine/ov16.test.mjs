// ov16.test.mjs (cab-build-engine) — ENGINE ov16 save formats: node --test game/test/engine/ov16.test.mjs
// (a) SAVGAM image layout per decode/data/SAVES.md §1 from a synthetic state; (b) DOSBox-made saves (acceptance/local/saves,
// local only) round-trip through LoadGame's parser / SaveGame's writer and ReadCharacter / WriteCharacter; (c) the
// ConvertPoolCharacter field map on a synthetic 11Dh record. The save store (engine/files.js) runs on its memory map in node.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { G, newChar, setPstr, configureState } from '../../engine/state.js';
import { writeFile, readFile } from '../../engine/files.js';
import { bind } from '../../areas/view_link.js';
import { view } from '../../areas/view_ov30.js';
import { buildSavGam, parseSavGam, ReadCharacter, WriteCharacter, ConvertPoolCharacter, MakeDosName, DeleteAll,
  BuildCharacterFileList } from '../../areas/engine_ov16.js';

configureState(null, { TChar: 0x1A6, item: 0x3F, effect: 9, combat: 0x16 });   // as main_cab.js from profiles/cab.json
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const DATA = process.env.CAB_DEV_DATA || join(ROOT, '..', 're-targets', 'goldbox', 'cotab', 'curazure');
const SAVES = join(ROOT, 'acceptance', 'local', 'saves');

// DS image from the player's START.EXE (not packed: header 7B0h, DS = 0C1C, 8F00h bytes)
const exePath = existsSync(join(DATA, 'START.EXE')) ? join(DATA, 'START.EXE') : join(ROOT, 'decode', 'bin', 'START.EXE');
if (existsSync(exePath)) { const exe = readFileSync(exePath); G.ds = new Uint8Array(0x8F00); G.ds.set(exe.subarray(0x7B0 + 0xC1C0, 0x7B0 + 0xC1C0 + 0x8F00)); }
bind({ RecalcItems: () => {}, UpdateLevelStats: () => {} });           // keep the records exactly as read

function freshVm() {
  G.ecl_Mem4B00 = new Uint16Array(0x400); G.ecl_Mem7C00 = new Uint16Array(0x400);
  G.ecl_Mem7A00 = new Uint16Array(0x200); G.ecl_CodeBuf = new Uint8Array(0x1E00);
}
G.SavePath = 'C:\\SAVE\\'; G.ImportSource = 0; G.PartyList = null;

test('(a) SAVGAM layout: 13149 bytes, every region at its SAVES.md offset', () => {
  freshVm();
  G.DataSet = 2; G.ecl_Mem4B00[0] = 0x1111; G.ecl_Mem4B00[0x3FF] = 0x2222; G.ecl_Mem7C00[0] = 0x3333; G.ecl_Mem7A00[0x1FF] = 0x4444;
  G.ecl_CodeBuf[0] = 0x55; G.ecl_CodeBuf[0x1DFF] = 0x66;
  G.party_MapX = 7; G.party_MapY = 13; G.party_Dir = 2; G.party_Ahead = 6; G.party_CellAttr = 0x80; G.view_PrevMode = 1; G.view_Mode = 2;
  view.wallSlotId[1] = 1; view.wallSlotNo[1] = 1; view.wallSlotId[2] = 0xFFFF; view.wallSlotNo[2] = 0xFFFF; view.wallSlotId[3] = 3; view.wallSlotNo[3] = 3;
  const b = buildSavGam('D', ['CHRDATD1', 'CHRDATD2']);
  assert.equal(b.length, 13149);
  assert.equal(b[0], 2);
  assert.deepEqual([b[1], b[2], b[0x7FF], b[0x800]], [0x11, 0x11, 0x22, 0x22]);
  assert.deepEqual([b[0x801], b[0x802]], [0x33, 0x33]);
  assert.deepEqual([b[0x13FF], b[0x1400]], [0x44, 0x44]);
  assert.deepEqual([b[0x1401], b[0x3200]], [0x55, 0x66]);
  assert.deepEqual([...b.subarray(0x3201, 0x3206)], [7, 13, 2, 6, 0x80]);
  assert.deepEqual([b[0x3206], b[0x3207]], [1, 2]);
  assert.deepEqual([...b.subarray(0x3208, 0x3214)], [1, 0, 1, 0, 0xFF, 0xFF, 0xFF, 0xFF, 3, 0, 3, 0]);
  assert.equal(b[0x3214], 2);
  assert.equal(b[0x3215], 8); assert.equal(String.fromCharCode(...b.subarray(0x3216, 0x321E)), 'CHRDATD1');
  assert.equal(String.fromCharCode(...b.subarray(0x3215 + 41 + 1, 0x3215 + 41 + 9)), 'CHRDATD2');
  const r = (freshVm(), parseSavGam(b));                                  // and back
  assert.equal(r.count, 2); assert.deepEqual(r.names.slice(0, 2), ['CHRDATD1', 'CHRDATD2']);
  assert.equal(G.ecl_Mem7A00[0x1FF], 0x4444); assert.equal(G.party_CellAttr, 0x80); assert.equal(view.wallSlotId[3], 3);
});

const dirs = existsSync(SAVES) ? readdirSync(SAVES).filter((d) => readdirSync(join(SAVES, d)).some((f) => /^SAVGAM/i.test(f))) : [];
test('(b) DOSBox saves round-trip (local acceptance/local/saves)', { skip: dirs.length === 0 }, async () => {
  let games = 0, members = 0;
  for (const d of dirs) {
    for (const f of readdirSync(join(SAVES, d))) {
      const bytes = new Uint8Array(readFileSync(join(SAVES, d, f)));
      if (/^SAVGAM/i.test(f)) {
        freshVm();
        const { count, names } = parseSavGam(bytes);
        const out = buildSavGam(f[6], names.slice(0, count));
        assert.equal(out.length, bytes.length, f);
        assert.deepEqual(out.subarray(0, 0x3215), bytes.subarray(0, 0x3215), d + '/' + f + ' before the name array');
        for (let i = 0; i < count; i++) {                                 // names: only the length-counted part is defined
          const o = 0x3215 + i * 41, n = bytes[o];
          assert.deepEqual(out.subarray(o, o + 1 + n), bytes.subarray(o, o + 1 + n), f + ' name ' + (i + 1));
        }
        games++;
      } else if (/\.SAV$/i.test(f)) {
        const base = f.slice(0, -4).toUpperCase();
        await writeFile('C:\\SAVE\\' + base + '.SAV', bytes);
        const fx = join(SAVES, d, base + '.FX'); if (existsSync(fx)) await writeFile('C:\\SAVE\\' + base + '.FX', new Uint8Array(readFileSync(fx)));
        G.ImportSource = 0;
        const c = newChar();
        await ReadCharacter(base + '.sav', c, 1, 1);
        await WriteCharacter(c, base + 'X');
        const back = await readFile('C:\\SAVE\\' + base + 'X.sav');
        const ptr = (o) => (o >= 0xF2 && o < 0xF6) || (o >= 0x14D && o < 0x151) || (o >= 0x189 && o < 0x191);   // far pointers
        for (let o = 0; o < 0x1A6; o++) if (!ptr(o)) assert.equal(back[o], bytes[o], `${d}/${f} +${o.toString(16)}`);
        if (existsSync(fx)) {
          const fxb = new Uint8Array(readFileSync(fx)), fb = await readFile('C:\\SAVE\\' + base + 'X.fx');
          assert.equal(fb.length, fxb.length);
          for (let o = 0; o < fxb.length; o++) if (o % 9 < 5) assert.equal(fb[o], fxb[o], `${f} .fx +${o}`);   // +5 = next pointer
        }
        members++;
      }
    }
  }
  assert.ok(games > 0 && members > 0);
});

test('(c) ConvertPoolCharacter field map', { skip: !G.ds }, () => {
  const p = new Uint8Array(0x11D);
  for (let i = 0; i < p.length; i++) p[i] = (i * 7 + 3) & 0xFF;
  setPstr(p, 0, 'POOLHERO', 15);
  p[0x2E] = 7; p[0x9E] = 0;                                               // human male
  for (let i = 0; i < 6; i++) p[0x10 + i] = 12 + i;                        // in range for a human
  const c = newChar();
  ConvertPoolCharacter(p, c);
  const b = c.b;
  assert.equal(String.fromCharCode(...b.subarray(1, 1 + b[0])), 'POOLHERO');
  assert.equal(b[0x74], 7); assert.equal(b[0x119], 0);
  for (let i = 0; i < 5; i++) { assert.equal(b[0x10 + 2 * i], p[0x10 + i]); assert.equal(b[0x11 + 2 * i], b[0x10 + 2 * i]); }
  // quirk 4300:191a: with the loop variable left at 5 the exceptional-STR maximum DS:3F8A[race*16+sex] (human male 100)
  // raises CHA max (+1Ah); CHA current (+1Bh) keeps the clamped value
  assert.equal(b[0x1A], G.ds[0x3F8A + 7 * 16 + 0]); assert.equal(b[0x1B], p[0x15]);
  assert.equal(b[0x1C], p[0x16]); assert.equal(b[0x1D], p[0x16]);
  assert.equal(b[0x75], p[0x2F]); assert.equal(b[0x76] | (b[0x77] << 8), p[0x30] | (p[0x31] << 8));
  const mv = [...p.subarray(0x33, 0x33 + 0x38)]; mv[0x9C - 0x79] = 0;   // +9Ch := 0 after the Move (4300:19e1)
  assert.deepEqual([...b.subarray(0x79, 0x79 + 0x38)], mv);
  assert.equal(b[0x9C], 0);
  assert.deepEqual([...b.subarray(0xEA, 0xF2)], [...p.subarray(0x77, 0x7F)]);
  assert.equal(b[0xF7], p[0x84]);
  assert.equal(b[0x103] | (b[0x104] << 8), 300);
  assert.deepEqual([...b.subarray(0x109, 0x111)], [...p.subarray(0x96, 0x9E)]);
  assert.deepEqual([...b.subarray(0x127, 0x12B)], [...p.subarray(0xAC, 0xB0)]);
  assert.deepEqual([...b.subarray(0x145, 0x14B)], [...p.subarray(0xC1, 0xC7)]);
  assert.deepEqual([...b.subarray(0x151, 0x185)], [...p.subarray(0xCC, 0x100)]);
  assert.deepEqual([b[0x195], b[0x196], b[0x197], b[0x199], b[0x1A4], b[0x1A5]], [p[0x10C], p[0x10D], p[0x10E], p[0x110], p[0x11B], p[0x11C]]);
  assert.deepEqual([...b.subarray(0x19A, 0x1A4)], [...p.subarray(0x111, 0x11B)]);
});

test('name helpers and the character list scan', { skip: !G.ds }, async () => {
  assert.equal(MakeDosName('Sir Rolf.II'), 'SIRROLFI');
  assert.equal(DeleteAll('a..b', '.'), 'a.b');                            // quirk: adjacent occurrences
  const c = new Uint8Array(0x1A6); setPstr(c, 0, 'ZED', 15);
  await writeFile('C:\\SAVE\\ZED.GUY', c);
  const hidden = new Uint8Array(0x1A6); setPstr(hidden, 0, 'NPC', 15); hidden[0xF7] = 0x80;
  await writeFile('C:\\SAVE\\NPC.GUY', hidden);
  G.ImportSource = 0; G.PartyList = null;
  const names = { v: null }, files = { v: null };
  assert.equal(await BuildCharacterFileList(names, files), true);
  const list = []; for (let p = names.v, q = files.v; p; p = p.next, q = q.next) list.push([p.text.trimEnd(), q.text]);
  assert.ok(list.some(([n, f]) => n === 'ZED' && f === 'ZED.GUY'));
  assert.ok(!list.some(([n]) => n === 'NPC'));                            // flag byte +F7h >= 80h hides the file
});
