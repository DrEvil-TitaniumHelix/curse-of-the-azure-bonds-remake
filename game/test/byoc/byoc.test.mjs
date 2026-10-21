// game/test/byoc/byoc.test.mjs (cab fork of Pool's BYOC test): engine/byoc.js against the owner's v1.0 copy (read-only,
// CAB_DEV_DATA or re-targets/goldbox/cotab/curazure) with the CR-2 A normalisation of GAME.OVR 0x4A56 (PER-5).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeFakeIDB } from './fakeidb.mjs';
import * as byoc from '../../engine/byoc.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const DATA = process.env.CAB_DEV_DATA || path.resolve(ROOT, '../re-targets/goldbox/cotab/curazure');
const man = JSON.parse(readFileSync(path.join(ROOT, 'game/byoc/manifest-cab-1.0.json'), 'utf8'));
const man13 = JSON.parse(readFileSync(path.join(ROOT, 'game/byoc/manifest-cab-1.3.json'), 'utf8'));   // cab: v13-4
const profile = JSON.parse(readFileSync(path.join(ROOT, 'game/profiles/cab.json'), 'utf8'));
byoc.configure(profile); byoc.setManifests([man, man13]);
const HAVE = existsSync(DATA);
// cab: v13-4 — the WizardWorks CD copy (Curse v1.3), read-only; decode/V13_DELTA.md 4.3 test plan T1-T8
const DATA13 = process.env.CAB_V13_DATA || path.resolve(ROOT, '../re-targets/goldbox/adnd-collectors-cd/WIZWORKS/CURSE');
const HAVE13 = existsSync(path.join(DATA13, 'ST.EXE'));
const POOL = path.resolve(ROOT, '../re-targets/goldbox/por/POOLRAD');

function candsOf(dir, patch, { skip = [], withSaves = false, prefix = 'GAME' } = {}) {
  const files = readdirSync(dir).filter((n) => statSync(path.join(dir, n)).isFile() && !skip.includes(n.toUpperCase())).map((n) => {
    let b = new Uint8Array(readFileSync(path.join(dir, n)));
    if (patch) { const c = patch(n.toUpperCase(), b); if (c) b = c; }
    return { name: n, webkitRelativePath: prefix + '/' + n, size: b.length, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.length) };
  });
  if (withSaves && existsSync(path.join(dir, 'SAVE'))) for (const n of readdirSync(path.join(dir, 'SAVE'))) {
    const b = new Uint8Array(readFileSync(path.join(dir, 'SAVE', n)));
    files.push({ name: n, webkitRelativePath: prefix + '/SAVE/' + n, size: b.length, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.length) });
  }
  return byoc.collectFromFileList(files);
}
function cands(patch) { return candsOf(DATA, patch && ((n, b) => { if (n === 'GAME.OVR') { const c = b.slice(); patch(c); return c; } return null; }), { prefix: 'CURAZURE' }); }

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

// ---- cab: v13-4 — decode/V13_DELTA.md 4.3: T3 .. T8 (T1 / T2 = the owner / retail74 tests above) --------------------------
test('T3 the CD copy (v1.3) is accepted as cab-1.3 retail (0x4A9C = 74); ST.EXE stored packed, GAME.OVR hashed only', { skip: !HAVE13 }, async () => {
  const rep = await byoc.validate(candsOf(DATA13, null, { withSaves: true }));
  assert.equal(rep.ok, true); assert.equal(rep.manifestId, 'cab-1.3'); assert.equal(rep.version, '1.3'); assert.equal(rep.variant, 'retail');
  assert.deepEqual(rep.versionsTried, ['1.0', '1.3']); assert.equal(rep.okCount, 89); assert.equal(rep.gameOvr, 'match');
  assert.equal(rep.bytes.has('ST.EXE'), true); assert.equal(rep.bytes.get('ST.EXE').length, 57789); assert.equal(rep.bytes.has('GAME.OVR'), false);
  assert.equal(rep.bytes.size, 88);
  // T6: the CD's extra files are not in the report; its SAVE/ is scanned (SAVGAMA 13149, CHRDAT* 422, .FX 9 / 27)
  for (const n of ['START.BAT', 'CURSE.CFG', 'COPYCURS.EXE', 'DKK']) assert.equal(rep.files.some((f) => f.name === n), false, n);
  assert.ok(rep.saves.length >= 17, 'saves scanned: ' + rep.saves.length); assert.ok(rep.saves.every((s) => s.ok), rep.saves.filter((s) => !s.ok).map((s) => s.name + ' ' + s.reason).join(', '));
  assert.ok(rep.saves.some((s) => s.name === 'SAVGAMA.DAT' && s.size === 13149));
  byoc.setIndexedDB(makeFakeIDB());
  await byoc.importFiles(rep);
  assert.equal(await byoc.isImported(), true); assert.equal(byoc.activeManifest().id, 'cab-1.3');
  assert.equal((await byoc.info()).manifest, 'cab-1.3'); assert.equal((await byoc.info()).variant, 'retail');
  assert.equal((await byoc.get('ST.EXE')).length, 57789); assert.equal(await byoc.get('START.EXE'), null);
});
test('T4 the CD copy with GAME.OVR 0x4A9C patched to EB is accepted as patched-4A9C; another byte is refused', { skip: !HAVE13 }, async () => {
  const at = (v) => (n, b) => { if (n === 'GAME.OVR') { const c = b.slice(); c[0x4A9C] = v; return c; } return null; };
  const ok = await byoc.validate(candsOf(DATA13, at(0xEB)));
  assert.equal(ok.ok, true); assert.equal(ok.manifestId, 'cab-1.3'); assert.equal(ok.variant, 'patched-4A9C');
  const bad = await byoc.validate(candsOf(DATA13, at(0x75)));
  assert.equal(bad.ok, false); assert.equal(bad.manifestId, 'cab-1.3');
  assert.equal(bad.files.find((f) => f.name === 'GAME.OVR').status, 'hash'); assert.equal(bad.likelyOtherVersion, true);
});
test('T5 mixed folders are refused by both manifests', { skip: !(HAVE && HAVE13) }, async () => {
  // v1.3 data files with the v1.0 executable and overlay file
  const a = candsOf(DATA13, null, { skip: ['ST.EXE', 'GAME.OVR'] }).concat(cands().filter((c) => c.name === 'START.EXE' || c.name === 'GAME.OVR'));
  const ra = await byoc.validate(a);
  assert.equal(ra.ok, false); assert.equal(ra.likelyOtherVersion, true); assert.deepEqual(ra.versionsTried, ['1.0', '1.3']);
  assert.ok(ra.files.filter((f) => f.required && f.status !== 'ok').length >= 5, 'the changed DAX files differ');
  // v1.0 data files with the v1.3 ST.EXE and GAME.OVR
  const b = cands().filter((c) => c.name !== 'START.EXE' && c.name !== 'GAME.OVR').concat(candsOf(DATA13, null).filter((c) => c.name === 'ST.EXE' || c.name === 'GAME.OVR'));
  const rb = await byoc.validate(b);
  assert.equal(rb.ok, false); assert.equal(rb.likelyOtherVersion, true);
});
test('T8 refuse the others: a Pool of Radiance folder, a v1.3 copy without GAME.OVR, a v1.0 copy with a damaged file', { skip: !HAVE13 }, async () => {
  if (existsSync(path.join(POOL, 'START.EXE'))) {
    const rp = await byoc.validate(candsOf(POOL, null, { prefix: 'POOLRAD' }));
    assert.equal(rp.ok, false); assert.ok(rp.okCount < 10);
  }
  const noOvr = await byoc.validate(candsOf(DATA13, null, { skip: ['GAME.OVR'] }));
  assert.equal(noOvr.ok, false); assert.equal(noOvr.gameOvr, 'absent'); assert.equal(noOvr.manifestId, 'cab-1.3');
  assert.equal(noOvr.files.find((f) => f.name === 'GAME.OVR').status, 'missing');
  if (HAVE) {
    const dmg = await byoc.validate(cands((bb) => { bb[0x100] ^= 1; }));
    assert.equal(dmg.ok, false); assert.equal(dmg.manifestId, 'cab-1.0');
  }
});
test('T1/T2 after T3: the owner copy still matches cab-1.0 and the active manifest follows the import', { skip: !HAVE }, async () => {
  const rep = await byoc.validate(cands());
  assert.equal(rep.ok, true); assert.equal(rep.manifestId, 'cab-1.0'); assert.equal(rep.version, '1.0'); assert.equal(byoc.activeManifest().id, 'cab-1.0');
  byoc.setIndexedDB(makeFakeIDB()); await byoc.importFiles(rep);
  assert.equal(await byoc.isImported(), true); assert.equal(byoc.activeManifest().id, 'cab-1.0');
});
