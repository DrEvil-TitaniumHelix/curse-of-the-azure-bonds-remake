// game/test/byoc/byoc.test.mjs (cab fork of Pool's BYOC test): engine/byoc.js against the owner's v1.0 copy (read-only,
// CAB_DEV_DATA or re-targets/goldbox/cotab/curazure) with the CR-2 A normalisation of GAME.OVR 0x4A56 (PER-5).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeFakeIDB } from './fakeidb.mjs';
import * as byoc from '../../engine/byoc.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const DATA = process.env.CAB_DEV_DATA || path.resolve(ROOT, '../re-targets/goldbox/cotab/curazure');
const man = JSON.parse(readFileSync(path.join(ROOT, 'game/byoc/manifest-cab-1.0.json'), 'utf8'));
const profile = JSON.parse(readFileSync(path.join(ROOT, 'game/profiles/cab.json'), 'utf8'));
byoc.configure(profile); byoc.setManifest(man);
const HAVE = existsSync(DATA);

function cands(patch) {
  return byoc.collectFromFileList(readdirSync(DATA).map((n) => {
    let b = new Uint8Array(readFileSync(path.join(DATA, n)));
    if (patch && n.toUpperCase() === 'GAME.OVR') { b = b.slice(); patch(b); }
    return { name: n, webkitRelativePath: 'CURAZURE/' + n, size: b.length, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.length) };
  }));
}

test('wrong folder: every required file missing', async () => {
  const rep = await byoc.validate(byoc.collectFromFileList([{ name: 'README.TXT', size: 3, arrayBuffer: async () => new ArrayBuffer(3) }]));
  assert.equal(rep.ok, false); assert.equal(rep.okCount, 0); assert.equal(rep.requiredCount, 89);
});
test('the owner copy (0x4A56 = EB) is accepted as patched-4A56; GAME.OVR not stored', { skip: !HAVE }, async () => {
  const rep = await byoc.validate(cands());
  assert.equal(rep.ok, true); assert.equal(rep.variant, 'patched-4A56');
  assert.equal(rep.bytes.has('GAME.OVR'), false); assert.equal(rep.bytes.size, 88);
  byoc.setIndexedDB(makeFakeIDB());
  await byoc.importFiles(rep); assert.equal(await byoc.isImported(), true);
  assert.equal((await byoc.info()).variant, 'patched-4A56');
});
test('retail form (74) is accepted as retail; any other byte is refused', { skip: !HAVE }, async () => {
  assert.equal((await byoc.validate(cands((b) => { b[0x4A56] = 0x74; }))).variant, 'retail');
  const bad = await byoc.validate(cands((b) => { b[0x4A56] = 0x75; }));
  assert.equal(bad.ok, false); assert.equal(bad.files.find((f) => f.name === 'GAME.OVR').status, 'hash');
  const bad2 = await byoc.validate(cands((b) => { b[0x100] ^= 1; }));
  assert.equal(bad2.ok, false);
});
test('save names and sizes per the Curse profile', async () => {
  const mk = (name, n) => ({ name, dir: 'SAVE', size: n, read: async () => new Uint8Array(n) });
  const r = await byoc.checkSaves([mk('ALPHA.GUY', 422), mk('ALPHA.FX', 27), mk('CHRDATA1.SAV', 422), mk('SAVGAMA.DAT', 13149),
    mk('SAVGAMB.DAT', 13137), mk('POOLGUY.CHA', 285), mk('HERO.HIL', 188), mk('BAD.GUY', 285)]);
  assert.deepEqual(r.map((s) => s.ok), [true, true, true, true, false, true, true, false]);
});
