// Pedia catalogue (S5, cab-plus-pedia): record parsing against the decode tables. The synthetic tests need no game data;
// the local-copy test reads the owner's v1.0 files (CAB_DEV_DATA or re-targets/goldbox/cotab/curazure, read-only) and
// takes every expected value from decode/data/MONSTERS.md, ITEM.md, GEO.md, BIGPIC.md and decode/pseudo/MAGIC.pas.md.
//   node --test game/test/plus/pedia.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildPedia,archiveRecords,NPC_REFERENCES} from '../../plus/pedia/build.js';
import {extractItem,extractCharacter,extractSpells,extractEffects,splitRecords,spellEvidence,loadModule,CHAR_SIZE} from '../../plus/pedia/records.js';
import {decodePicture} from '../../plus/pedia/pictures.js';
import {searchEntries,discoveredEntry} from '../../plus/pedia/search.js';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const DATA=process.env.CAB_DEV_DATA || path.resolve(ROOT,'../re-targets/goldbox/cotab/curazure');
const profile=JSON.parse(readFileSync(path.join(ROOT,'game/profiles/cab.json'),'utf8'));
const doc=f=>readFileSync(path.join(ROOT,f),'utf8');
const rows=(text,head)=>text.slice(text.indexOf(head)).split('\n').slice(2).filter(l=>l.startsWith('|')).map(l=>l.split('|').slice(1,-1).map(c=>c.trim()));
function putString(b,o,s) {b[o]=s.length;for(let i=0;i<s.length;i++)b[o+i+1]=s.charCodeAt(i);}

test('item names: words +31h/+30h/+2Fh, hidden words and their bonus stay hidden, the stored +00h string is never shown',()=>{
 const ds=new Uint8Array(0x4000),item=new Uint8Array(63);
 putString(ds,0x1040+21*36,'Test Blade');putString(ds,0x1040+21*162,'+1');putString(item,0,'Stored name');
 item[0x31]=36;item[0x30]=162;item[0x35]=2;item[0x32]=1;item[0x3A]=208;
 const hidden=extractItem(item,ds);assert.equal(hidden.name,'Test Blade');assert.equal(hidden.identified,false);assert.equal(hidden.stats['Magic bonus'],undefined);assert.equal(hidden.stats['Value (gp)'],undefined);
 item[0x35]=0;const known=extractItem(item,ds);assert.equal(known.name,'Test Blade +1');assert.equal(known.stats['Magic bonus'],1);assert.equal(known.stats['Value (gp)'],208);
 item[0x35]=7;assert.equal(extractItem(item,ds).name,'Unidentified item');
});
test('422-byte record: template fields at the PARTY.pas.md offsets; spell evidence = known_spell + ready mem_spell',()=>{
 const ds=new Uint8Array(0x4000),b=new Uint8Array(CHAR_SIZE);putString(ds,0x0E9C+70,'Race7');putString(ds,0x0CB6+2*27,'Class2');putString(b,0,'TEMPLATE');
 b[0x74]=7;b[0x75]=2;b[0xE5]=5;b[0x10B]=5;b[0x78]=35;b[0x124]=50;b[0x73]=44;b[0x11C]=3;b.set([1,0,8,0,0xFF,0],0x11E);b[0xE4]=12;b[0xDE]=0x82;b[0x13C]=0xE1;
 const c=extractCharacter(b,ds);
 assert.deepEqual(c.stats,{'Race':'Race7','Class':'Class2','Level / hit dice':5,'Class levels':'0/0/5/0/0/0/0/0','Maximum HP (record)':35,'Base AC':10,'Base THAC0':16,
  'Attacks per round':1.5,'Base damage':'1d8-1 / 0d0+0','Base movement':12,'Size':'Large','XP value':225});
 assert.throws(()=>extractCharacter(new Uint8Array(285),ds),/422/);
 b[0x78+9]=1;b[0x1E]=47;b[0x1F]=0x80|15;assert.deepEqual([...spellEvidence(b)].sort((x,y)=>x-y),[9,47]);
 assert.equal(spellEvidence(new Uint8Array(285)).size,0);
});
test('search returns only revealed entries and searches only visible discovery names',()=>{
 const entries=[{id:'a',kind:'monster',name:'Hidden template name'},{id:'b',kind:'spell',name:'Unseen spell'}];
 assert.deepEqual(searchEntries(entries,''),[]);
 const revealed=new Map([['a',{name:'Observed name',whereMet:[{dataSet:3,block:17}]}]]);
 assert.equal(searchEntries(entries,'observed 3:17',{revealed}).length,1);
 assert.equal(searchEntries(entries,'Hidden',{revealed}).length,0);
 assert.equal(searchEntries(entries,'',{revealed,kind:'spell'}).length,0);
 assert.equal(discoveredEntry(entries[0],revealed.get('a')).name,'Observed name');
});
test('spells: unnamed ids get no entry; effects ignore stale links and reject partial records; bad executables are refused',()=>{
 const ds=new Uint8Array(0x4000);for(const id of [1,2,0x64]) putString(ds,0x27BD+id*0x29,`Spell ${id}`);ds[0x37DA+0x64*16]=2;ds[0x37DA+0x64*16+5]=10;
 const spells=extractSpells(ds);assert.deepEqual(spells.map(s=>s.spellId),[1,2,100]);assert.equal(spells[2].stats.Class,'Magic-user');assert.equal(spells[2].stats.Duration,'0 + 10 per level');
 const effect=new Uint8Array(9);effect.set([0x18,30,0,0xFF,2,0,0,0x77,0x1E]);
 assert.deepEqual(extractEffects(effect),[{type:0x18,duration:30,parameter3:255,parameter4:2}]);
 assert.throws(()=>splitRecords(new Uint8Array(8),9,'effect'),/length/);
 assert.throws(()=>archiveRecords(new Uint8Array([9,0])),/directory|bounds/);
 assert.throws(()=>loadModule(new Uint8Array(64)),/header/);
});
function pictureBytes(pixel) {const b=new Uint8Array(21);b[0]=1;b[2]=1;b[8]=1;b.fill(pixel,17);return b;}
test('picture decoder handles packed nibbles, animation XOR and rejects malformed frames',()=>{
 const p=pictureBytes(0x12),original=p.slice();const image=decodePicture(p);
 assert.equal(image.width,8);assert.equal(image.height,1);assert.deepEqual([...image.pixels],[1,2,1,2,1,2,1,2]);assert.deepEqual(p,original);
 const a=new Uint8Array(51);a[0]=2;a.set(p,5);a.set(pictureBytes(0x33),30);
 assert.deepEqual([...decodePicture(a,{animation:true,xor:true,frame:1}).pixels],[2,1,2,1,2,1,2,1]);
 assert.throws(()=>decodePicture(p.subarray(0,20)),/picture pixels/);
 assert.throws(()=>decodePicture(a,{animation:true,frame:2}),/frame/);
});
test('the profile check refuses another game',async()=>{
 await assert.rejects(buildPedia({profile:{id:'por',version:'1.3'},readFile:()=>null}),/Curse of the Azure Bonds/);
});

test('local copy: the catalogue matches the decode tables',{skip:!existsSync(DATA)&&'local player copy unavailable'},async()=>{
 const read=name=>{try{return new Uint8Array(readFileSync(path.join(DATA,name)));}catch{return null;}};
 const catalog=await buildPedia({profile,readFile:read});
 const kind=k=>catalog.entries.filter(e=>e.kind===k);
 assert.equal(searchEntries(catalog.entries,'').length,0,'nothing is revealed before an event');
 // MONSTERS.md inventory: set, id, name, ITM item count, SPC entries (type bytes)
 const mon=rows(doc('decode/data/MONSTERS.md'),'| set | id |');assert.equal(mon.length,81);assert.equal(kind('monster').length,81);
 for(const [set,id,name,itm,spc] of mon) {
  const e=catalog.entries.find(e=>e.id===`monster:${set}:${id}`);assert.ok(e,`monster ${set}/${id}`);
  assert.equal(e.name,name);assert.equal(e.inventory.length,itm==='-'?0:Number(itm),`${name} items`);
  const types=spc==='-'?[]:spc.match(/\(([^)]*)\)/)[1].split(' ').map(h=>parseInt(h,16));
  assert.deepEqual(e.effects.map(x=>x.type),types,`${name} effects`);
  const b=archiveRecords(read(`MON${set}CHA.DAX`)).get(Number(id));assert.equal(b.length,422);
  assert.equal(e.stats['Base AC'],60-b[0x124]);assert.equal(e.stats['Base THAC0'],60-b[0x73]);assert.equal(e.stats['Maximum HP (record)'],b[0x78]);
 }
 for(const ref of NPC_REFERENCES) {const n=catalog.entries.find(e=>e.id===`npc:${ref.dataSet}:${ref.record}`);assert.equal(n.name,mon.find(r=>+r[0]===ref.dataSet&&+r[1]===ref.record)[2]);}
 // ITEM.md: file, id, item count, types (+2Eh)
 const it=rows(doc('decode/data/ITEM.md'),'| file | id |');assert.equal(it.length,19);   // the table and the files hold 19 records (the prose line "23 records" of ITEM.md is a slip)
 for(const [file,id,count,,types] of it) {
  const list=kind('item').filter(e=>e.source.file===`${file}.DAX`&&e.record===Number(id));assert.equal(list.length,Number(count),`${file}/${id}`);
  assert.deepEqual(list.map(e=>e.type),types.split(' ').map(h=>parseInt(h,16)));
  for(const e of list) assert.ok(e.name.length>0);
 }
 assert.equal(kind('itemType').length,128);
 const types=kind('itemType'),items=read('ITEMS');assert.equal(types[36].stats['Class mask'],items[2+36*16+13]);
 // MAGIC.pas.md spell table: id, name, cls, lvl (named ids only)
 const sp=rows(doc('decode/pseudo/MAGIC.pas.md'),'| id | name | cls |').filter(r=>r[1]);assert.equal(kind('spell').length,sp.length);
 const CLS={C:'Cleric',D:'Druid',M:'Magic-user',I:'Item/monster power'};
 for(const [id,name,cls,lvl] of sp) {const e=catalog.entries.find(e=>e.id===`spell:${parseInt(id,16)}`);assert.equal(e.name,name);assert.equal(e.stats.Class,CLS[cls],name);assert.equal(e.stats.Level,Number(lvl));}
 // GEO.md: 16 records; BIGPIC.md: ids 120..123, 304x120
 const geo=rows(doc('decode/data/GEO.md'),'| file | ids |').flatMap(r=>r[1].split(',').map(Number));
 assert.deepEqual(kind('place').filter(e=>e.geo!==undefined).map(e=>e.geo).sort((a,b)=>a-b),geo.sort((a,b)=>a-b));assert.equal(geo.length,16);
 const big=kind('place').filter(e=>e.bigPic!==undefined);assert.deepEqual(big.map(e=>e.bigPic).sort(),[120,121,122,123]);
 for(const e of big) {const p=await catalog.picture(e.picture);assert.equal(p.width,304);assert.equal(p.height,120);}
 let icons=0;for(const file of profile.daxGroups.CPIC) for(const [record] of archiveRecords(read(file))) {const p=await catalog.picture({file,record});assert.ok(p.width>0&&p.pixels.length===p.width*p.height);icons++;}
 assert.equal(icons,156);
});
