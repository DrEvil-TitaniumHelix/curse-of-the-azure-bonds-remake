import test from 'node:test';
import {deflateRawSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {parseManifest,normalizeDax} from '../../plus/mods/manifest.js';
import {createModManager} from '../../plus/mods/manager.js';
import {createModStore} from '../../plus/mods/store.js';
import {importEntries,importZip} from '../../plus/mods/import.js';
import {compileImage,recordFrames,imageSheet} from '../../plus/mods/record.js';
import {makeZip,crc32} from '../../byoc/ui/zip.js';
import {makeFakeIDB} from '../byoc/fakeidb.mjs';
const manifest=id=>({schemaVersion:1,id,name:id,version:'1',author:'Test',profile:'por',overrides:[{dax:'PIC',dataSet:3,record:1,png:'one.png'}]});
function png(marker=0){const b=new Uint8Array(25);b.set([137,80,78,71,13,10,26,10]);b[19]=8;b[23]=1;b[24]=marker;return b;}
function original(){const b=new Uint8Array(26);b[0]=1;b[5]=1;b[7]=1;b[13]=1;b.fill(0x12,22);return b;}
const decode=async bytes=>({width:8,height:1,data:new Uint8ClampedArray(Array.from({length:8},()=>[bytes[24]?170:0,0,170,255]).flat())});
async function install(manager,id,marker=0){await manager.install({manifest:manifest(id),assets:{'one.png':png(marker)}});await manager.enable(id,true);}
test('manifest normalizes targets and rejects unsafe, duplicate, script and non-picture overrides',()=>{
 const m=parseManifest(manifest('one'));assert.equal(m.overrides[0].dataSet,3);
 assert.deepEqual(normalizeDax('C:\\POOLRAD\\pic3.dax'),{group:'PIC',dataSet:3});
 for(const change of [m=>{m.overrides[0].png='../bad.png';},m=>{m.overrides[0].dax='ECL3';},m=>{m.overrides[0].record=256;},m=>{m.generator='script.js';},m=>{m.overrides.push({...m.overrides[0]});}]) {const m=manifest('one');change(m);assert.throws(()=>parseManifest(m));}
});
test('last enabled match wins; reorder, disable, remove and original mode invalidate resolver cache',async()=>{
 const manager=createModManager({store:createModStore({indexedDB:null}),decode,isOriginal:()=>false});await install(manager,'first',0);await install(manager,'last',1);
 const raw=original(),before=raw.slice();const last=await manager.resolve('/PIC3.dax',1,raw);assert.notDeepEqual(last,raw);
 await manager.reorder(['last','first']);const first=await manager.resolve('/PIC3.dax',1,raw);assert.notDeepEqual(first,last);
 await manager.enable('first',false);assert.deepEqual(await manager.resolve('/PIC3.dax',1,raw),last);
 manager.setOriginal(true);assert.equal(await manager.resolve('PIC3',1,raw),null);manager.setOriginal(false);
 await manager.remove('last');assert.equal(await manager.resolve('PIC3',1,raw),null);assert.equal(await manager.resolve('PIC4',1,raw),null);
 assert.deepEqual(raw,before);await assert.rejects(manager.reorder(['first','first']),/every mod/);
});
test('PNG frame strips roundtrip unchanged and preserve headers, delays and XOR frames',()=>{
 const bytes=new Uint8Array(51);bytes[0]=2;bytes.set(original().subarray(1),1);bytes.set(original().subarray(1),26);bytes[1]=47;
 const frames=recordFrames(bytes,'PIC3'),sheet=imageSheet(frames);assert.deepEqual(compileImage(bytes,'PIC3',sheet),bytes);
 const recoloured=compileImage(bytes,'PIC3',imageSheet(frames,n=>(n+1)&15));assert.notDeepEqual(recoloured,bytes);assert.deepEqual(recoloured.subarray(0,22),bytes.subarray(0,22));
 assert.throws(()=>compileImage(bytes,'PIC3',{...sheet,width:1}),/frame strip/);
});
test('persistent store isolates profiles and quota failure retains current session stack',async()=>{
 const indexedDB=makeFakeIDB(),a=createModStore({indexedDB,profile:'por'});assert.equal(await a.save([{value:1}]),true);
 assert.deepEqual(await createModStore({indexedDB,profile:'por'}).load(),[{value:1}]);assert.deepEqual(await createModStore({indexedDB,profile:'other'}).load(),[]);
 indexedDB.failPuts=true;assert.equal(await a.save([{value:2}]),false);assert.equal(a.sessionOnly,true);assert.deepEqual(await a.load(),[{value:2}]);
});
test('folder and ZIP import are disabled by default and validate paths, assets and checksums',async()=>{
 const entries=[{name:'MyMod/mod.json',bytes:new TextEncoder().encode(JSON.stringify(manifest('one')))},{name:'MyMod/one.png',bytes:png()}];
 assert.equal(importEntries(entries).enabled,false);assert.equal((await importZip(makeZip(entries))).manifest.id,'one');
 assert.throws(()=>importEntries(entries.slice(0,1)),/Missing PNG/);
 assert.throws(()=>importEntries([...entries,{name:'../escape',bytes:png()}]),/Unsafe/);
 const corrupt=makeZip(entries);corrupt[50]^=1;await assert.rejects(importZip(corrupt));
});
test('resolver failures fall back to the original and cannot cache a stale asynchronous decode',async()=>{
 let finish;const manager=createModManager({store:createModStore({indexedDB:null}),decode:()=>new Promise(r=>{finish=r;}),isOriginal:()=>false});await install(manager,'one');
 const pending=manager.resolve('PIC3',1,original());await new Promise(r=>setTimeout(r,0));await manager.enable('one',false);finish(await decode(png()));assert.equal(await pending,null);
 assert.equal(await manager.resolve('PIC3',1,original()),null);
 const bad=createModManager({store:createModStore({indexedDB:null}),decode:async()=>{throw Error('bad PNG');},isOriginal:()=>false});await install(bad,'bad');assert.equal(await bad.resolve('PIC3',1,original()),null);assert.match(bad.lastError,/bad PNG/);
});

test('deflated ZIP imports and rejects inflated data beyond declared size',async()=>{
 const name=new TextEncoder().encode('mod.json'),bytes=new TextEncoder().encode(JSON.stringify(manifest('zip'))),packed=deflateRawSync(bytes);
 const assetName=new TextEncoder().encode('one.png'),asset=png();
 function zip(declared=bytes.length) {
  const records=[{name,bytes,packed,method:8,size:declared},{name:assetName,bytes:asset,packed:asset,method:0,size:asset.length}],parts=[],central=[];let offset=0;
  for(const r of records) {
   const l=new Uint8Array(30+r.name.length+r.packed.length),ld=new DataView(l.buffer);ld.setUint32(0,0x04034B50,true);ld.setUint16(8,r.method,true);ld.setUint32(18,r.packed.length,true);ld.setUint32(22,r.size,true);ld.setUint16(26,r.name.length,true);l.set(r.name,30);l.set(r.packed,30+r.name.length);parts.push(l);
   const c=new Uint8Array(46+r.name.length),cd=new DataView(c.buffer);cd.setUint32(0,0x02014B50,true);cd.setUint16(10,r.method,true);cd.setUint32(16,crc32(r.bytes),true);cd.setUint32(20,r.packed.length,true);cd.setUint32(24,r.size,true);cd.setUint16(28,r.name.length,true);cd.setUint32(42,offset,true);c.set(r.name,46);central.push(c);offset+=l.length;
  }
  const end=new Uint8Array(22),ed=new DataView(end.buffer);ed.setUint32(0,0x06054B50,true);ed.setUint16(10,2,true);ed.setUint32(16,offset,true);
  const all=[...parts,...central,end],out=new Uint8Array(all.reduce((n,p)=>n+p.length,0));let o=0;for(const p of all){out.set(p,o);o+=p.length;}return out;
 }
 assert.equal((await importZip(zip())).manifest.id,'zip');await assert.rejects(importZip(zip(1)),/declared size/);
});
test('manager reload restores enabled order and PNG assets from profile storage',async()=>{
 const indexedDB=makeFakeIDB(),first=createModManager({store:createModStore({indexedDB}),decode,isOriginal:()=>false});await install(first,'persist',1);
 const second=createModManager({store:createModStore({indexedDB}),decode,isOriginal:()=>false});await second.ready;assert.equal(second.list[0].enabled,true);assert.deepEqual(await second.resolve('PIC3',1,original()),await first.resolve('PIC3',1,original()));
});
