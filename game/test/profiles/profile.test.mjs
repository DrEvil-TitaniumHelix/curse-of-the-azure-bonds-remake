// profile.test.mjs (cab fork of Pool's test): cab.json vs the manifest, SAVES.md and the ECL index.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {PROFILE_URLS, OVERLAY_URLS, loadProfiles, loadProfile, loadOverlays, applyOverlay, profileResource} from '../../plus/games.js';
const root = new URL('../../', import.meta.url);
const read = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const profile = await read('profiles/cab.json');
const manifest = await read('byoc/manifest-cab-1.0.json');
const fetcher = async url => ({ok:true, json:() => readFile(new URL(url),'utf8').then(JSON.parse)});
test('catalog covers exactly every profile JSON and loads Curse', async () => {
 // cab: v13-1 — a profiles/*.json with `basedOn` is a version overlay (OVERLAY_URLS), not a game of the catalog
 const names = (await readdir(new URL('profiles/',root))).filter(f => f.endsWith('.json')).sort();
 const isOverlay = {}; for (const f of names) isOverlay[f] = !!(await read('profiles/' + f)).basedOn;
 assert.deepEqual(PROFILE_URLS.map(u => new URL(u).pathname.split('/').pop()).sort(),names.filter(f => !isOverlay[f]));
 assert.deepEqual(OVERLAY_URLS.map(u => new URL(u).pathname.split('/').pop()).sort(),names.filter(f => isOverlay[f]));
 const games = await loadProfiles({fetcher}); assert.equal(games.length,1); assert.equal(games[0].id,'cab');
 assert.equal(profileResource(games[0], games[0].manifest.url),new URL('byoc/manifest-cab-1.0.json',root).href);
});
test('the v1.3 overlay merges over cab.json and names manifest-cab-1.3.json', async () => {   // cab: v13-1
 const [o] = await loadOverlays({fetcher}); assert.equal(o.id,'cab-1.3'); assert.equal(o.basedOn,'cab.json');
 const m13 = await read('byoc/manifest-cab-1.3.json'); assert.equal(o.manifest.id,m13.id);
 assert.equal(o.manifest.requiredCount,Object.values(m13.files).filter(f => f.required).length);
 const base = (await loadProfiles({fetcher}))[0], p = applyOverlay(base, o);
 assert.equal(p.id,'cab'); assert.equal(p.variant,'cab-1.3'); assert.equal(p.version,'1.3'); assert.equal(p.engine.id,'cab-1.3');
 assert.equal(p.engine.state.executable,'ST.EXE'); assert.equal(p.engine.state.exepack,true); assert.equal(p.engine.state.dsImageOffset,0xABE0);
 assert.equal(p.engine.state.dsMap.length,2); assert.equal(p.engine.audio.segment,0x699); assert.equal(p.engine.behaviour.id,'cab-1.3');
 assert.deepEqual([...p.manifest.files].sort(),Object.keys(m13.files).sort());          // START.EXE -> ST.EXE, the rest as v1.0
 assert.equal(p.engine.storage.saves,base.engine.storage.saves); assert.equal(p.areas.length,25); assert.equal(p.recordSizes.TChar,422);
 assert.deepEqual(m13.normalize[0], {file:'GAME.OVR', offset:0x4A9C, accept:[0x74,0xEB], hashAs:0x74, variants:{'116':'retail','235':'patched-4A9C'}});
 assert.equal(m13.files['ST.EXE'].exepack,true); assert.equal(m13.files['GAME.OVR'].store,false);
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
