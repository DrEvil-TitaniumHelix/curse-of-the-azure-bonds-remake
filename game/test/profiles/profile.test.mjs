// profile.test.mjs (cab fork of Pool's test): cab.json vs the manifest, SAVES.md and the ECL index.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {PROFILE_URLS, loadProfiles, loadProfile, profileResource} from '../../plus/games.js';
const root = new URL('../../', import.meta.url);
const read = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const profile = await read('profiles/cab.json');
const manifest = await read('byoc/manifest-cab-1.0.json');
const fetcher = async url => ({ok:true, json:() => readFile(new URL(url),'utf8').then(JSON.parse)});
test('catalog covers exactly every profile JSON and loads Curse', async () => {
 const files = (await readdir(new URL('profiles/',root))).filter(f => f.endsWith('.json')).sort();
 assert.deepEqual(PROFILE_URLS.map(u => new URL(u).pathname.split('/').pop()).sort(),files);
 const games = await loadProfiles({fetcher}); assert.equal(games.length,1); assert.equal(games[0].id,'cab');
 assert.equal(profileResource(games[0], games[0].manifest.url),new URL('byoc/manifest-cab-1.0.json',root).href);
});
test('manifest and every DAX group match the imported-file list', () => {
 assert.equal(profile.manifest.id,manifest.id);
 assert.equal(profile.manifest.requiredCount,Object.values(manifest.files).filter(f => f.required).length);
 assert.deepEqual([...profile.manifest.files].sort(),Object.keys(manifest.files).sort());
 const dax = Object.values(profile.daxGroups).flat();
 assert.equal(dax.length,86); assert.equal(new Set(dax).size,dax.length);
 assert.deepEqual(dax.sort(),Object.keys(manifest.files).filter(n => n.endsWith('.DAX')).sort());
 assert.deepEqual(manifest.normalize[0].accept,[0xEB,0x74]); assert.equal(manifest.files['GAME.OVR'].store,false);
});
test('record and save sizes agree with SAVES.md', async () => {
 const doc = await readFile(new URL('../decode/data/SAVES.md',root),'utf8');
 assert.match(doc,/422 bytes \(1A6h\)/); assert.equal(profile.recordSizes.TChar,422);
 assert.equal(profile.saveFormat.gameBytes,Number(doc.match(/SAVGAM<k>\.DAT` \(k = A\.\.J\) — ([\d,]+) bytes/)[1].replaceAll(',','')));
});
test('areas = the 25 ECL records of the index', async () => {
 const index = await readFile(new URL('../decode/ecl/scripts/INDEX.md',root),'utf8');
 const rows = [...index.matchAll(/^\| ECL(\d) \| (\d+) \| 88 13/gm)];
 assert.equal(rows.length,25); assert.equal(profile.areas.length,25);
 for (const [,ds,b] of rows) assert.ok(profile.areas.find(a => a.dataSet === +ds && a.block === +b));
 assert.equal(profile.ecl.baseAddress,0x8000); assert.equal(profile.ecl.codeBufferBytes,0x1E00);
});
test('unknown ids fail explicitly', async () => {
 await assert.rejects(loadProfile('missing',{fetcher}),/Unknown/);
});
