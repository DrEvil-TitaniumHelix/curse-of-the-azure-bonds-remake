// map.test.mjs (cab fork of Pool's; cab-plus-shell, S6 W7): the Curse map from the player's files against the decode.
//  - GEO: parse + draw plan + raster equal decode/tools/geo.py (the decode's reference renderer) for three Curse records;
//  - live planes override the record (hooks.state.geoPlanes, plus request #10) without changing the imported bytes;
//  - the overland: BIGPIC 121 decodes to the 304x120 backdrop, the 32 location spots come from the player's DS image
//    and equal the decoded tables of view_ov27.js (DS:0A48 / 0A68) and lie inside the picture;
//  - Curse positions (no travel mode) map to geo / overland keys; fog per save slot for the overland locations.
// The local-copy tests need the player's curazure folder (CAB_DATA, default ../re-targets/goldbox/cotab/curazure next to the repo).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {parseGeo,geoPlan,rasterGeo} from '../../plus/map/geo.js';
import {overlandImage,overlandMarks} from '../../plus/map/overland.js';
import {loadCurrentMap,currentMapContext,ANIM_COL,ANIM_ROW} from '../../plus/map/load.js';
import {createMapTracker,mapPosition,OVERLAND_BIGPIC} from '../../plus/map/fog.js';
import {archiveRecords} from '../../plus/pedia/build.js';
const root=new URL('../../../',import.meta.url);
const folder=process.env.CAB_DATA||fileURLToPath(new URL('../re-targets/goldbox/cotab/curazure/',root));
const profile=JSON.parse(readFileSync(new URL('game/profiles/cab.json',root),'utf8'));
const local=existsSync(folder)?false:'local player copy unavailable';
const readOriginal=async name=>new Uint8Array(readFileSync(path.join(folder,name)));

test('GEO planes retain all four directed walls, raw passage states and attributes',()=>{
 const b=new Uint8Array(1026);b[2]=0xA3;b[258]=0xF1;b[514]=0xA5;b[770]=0xE4;
 const c=parseGeo(b)[0];assert.deepEqual(c,{x:0,y:0,wall:[10,3,15,1],door:[0,1,2,3],attr:0xA5});
 assert.throws(()=>parseGeo(new Uint8Array(1024)),/1026/);
});
test('three Curse GEO records equal decode/tools/geo.py cell by cell, command by command and pixel by pixel',{skip:local},async()=>{
 const targets=[['GEO2.DAX',1],['GEO4.DAX',33],['GEO6.DAX',69]],records=[];
 for(const [file,id]of targets){const r=archiveRecords(await readOriginal(file)).get(id);assert.equal(r?.length,1026,`${file}/${id}`);records.push(r);}
 const reference=spawnSync('python',['-I','-B',fileURLToPath(new URL('game/test/plus/map-reference.py',root))],{input:JSON.stringify(records.map(b=>Buffer.from(b).toString('base64'))),encoding:'utf8',maxBuffer:8*1024*1024});
 assert.equal(reference.status,0,reference.stderr);const expected=JSON.parse(reference.stdout);
 for(let i=0;i<records.length;i++) {
  const cells=parseGeo(records[i]);assert.deepEqual(cells.map(({x,y,...cell})=>cell),expected[i].cells,targets[i].join('/'));
  const plan=geoPlan(cells);assert.deepEqual(plan.flat(),expected[i].commands);
  const image=rasterGeo(plan),rgb=Buffer.alloc(image.width*image.height*3);for(let p=0;p<image.width*image.height;p++)for(let c=0;c<3;c++)rgb[p*3+c]=image.data[p*4+c];
  assert.deepEqual(rgb,Buffer.from(expected[i].rgb,'base64'));
 }
});
test('the current 3D map: GEO<set> record of VM 4BC5, live planes override without mutating the import, 2D areas refused',{skip:local},async()=>{
 const archive=await readOriginal('GEO2.DAX'),before=archive.slice(),record=archiveRecords(archive).get(1),live=record.slice(2);live[768]=(live[768]&252)|3;
 const model=await loadCurrentMap({dataset:2,block:1,mapId:1,is3D:true,livePlanes:live},{profile,readFile:async()=>archive});
 assert.equal(model.kind,'geo');assert.equal(model.label,'ECL2/1');assert.equal(model.cells[0].door[0],3);assert.deepEqual(archive,before);
 await assert.rejects(loadCurrentMap(null,{profile,readFile:readOriginal}),/No current area/);
 await assert.rejects(loadCurrentMap({dataset:2,block:2,mapId:1,is3D:false},{profile,readFile:readOriginal}),/2D area has no map/);
 await assert.rejects(loadCurrentMap({dataset:2,block:1,mapId:1,is3D:true},{profile:{...profile,id:'por'},readFile:readOriginal}),/Curse/);
});
test('the overland: BIGPIC 121 picture and the 32 location spots of the DS image = view_ov27.js tables',{skip:local},async()=>{
 const model=await loadCurrentMap({dataset:1,block:80,location:5,is3D:false},{profile,readFile:readOriginal});
 assert.equal(model.kind,'overland');assert.deepEqual([model.picture.width,model.picture.height],[304,120]);assert.deepEqual(model.source,{file:'BIGPIC1.DAX',record:OVERLAND_BIGPIC});
 const src=readFileSync(new URL('game/areas/view_ov27.js',root),'utf8');
 const table=name=>JSON.parse(src.match(new RegExp(`const ${name} = (\\[[^\\]]+\\])`))[1]);
 const col=table('ANIM_COL'),row=table('ANIM_ROW');
 assert.equal(model.locations.length,32);
 model.locations.forEach((l,i)=>{assert.deepEqual([l.x,l.y],[(col[i]-1)*8,(row[i]-1)*8],`location ${i}`);assert.ok(l.x>=0&&l.x+8<=304&&l.y>=0&&l.y+8<=120,`location ${i} inside the picture`);});
 assert.equal(ANIM_COL,0x0A48);assert.equal(ANIM_ROW,0x0A68);
 const image=overlandImage(model);assert.equal(image.data.length,304*120*4);
 assert.deepEqual(overlandMarks(model,{visited:new Set([5,9]),marker:{location:9}}).map(m=>[m.index,m.current]),[[5,false],[9,true]]);
});

function bus(){const listeners=new Set();return {enabled:true,state:{slot:'A',position:()=>null,mem:a=>a===0x4CA1?7:undefined},on(_,fn){listeners.add(fn);return()=>listeners.delete(fn);},emit(name,p){if(name==='saveLoaded'||name==='gameSaved')this.state.slot=p.slot;for(const fn of listeners)fn(p,name);}};}
function storage(){const records=new Map();return {records,factory:({profile,slot})=>({async get(name,fallback){return structuredClone(records.get(JSON.stringify([profile,slot,name]))??fallback);},async set(name,value){records.set(JSON.stringify([profile,slot,name]),structuredClone(value));return true;}})};}
test('Curse positions (no travel mode): 3D -> geo:<set>:<map id>, overland -> overland:<set> location, other 2D -> none',()=>{
 assert.deepEqual(mapPosition({dataset:2,block:1,map3d:1,is3D:true,x:7,y:13,facing:1}),{key:'geo:2:1',x:7,y:13,dir:2,dataset:2,block:1,travelMode:undefined,mapId:1});
 assert.equal(mapPosition({dataset:2,block:2,map3d:1,is3D:false,x:7,y:13}),null);
 assert.equal(mapPosition({dataset:1,block:80,is3D:false,location:31}).key,'overland:1');
 assert.equal(mapPosition({dataset:1,block:80,is3D:false,location:32}),null);
});
test('overland fog: visited locations per save slot, only while BIGPIC 121 is up, marker = the party location',async()=>{
 const b=bus(),s=storage(),t=createMapTracker({bus:b,storeFactory:s.factory});
 b.state.position=()=>({dataset:1,block:80,is3D:false,x:0,y:0});
 b.emit('menuDrawn',{region:'hmenu',items:[{label:'Travel'}]});await t.flush();
 assert.equal(t.snapshot({dataset:1,location:0}).visited.size,0,'no overland before bigPicShown 121');
 b.emit('bigPicShown',{id:120});await t.flush();assert.equal(t.snapshot({dataset:1,location:0}).visited.size,0);
 b.emit('bigPicShown',{id:121});await t.flush();
 assert.deepEqual([...t.snapshot({dataset:1,location:0}).visited],[7]);assert.equal(t.snapshot({dataset:1,location:0}).marker.location,7);
 b.state.mem=a=>a===0x4CA1?0x0103:undefined;b.emit('menuDrawn',{region:'hmenu',items:[]});await t.flush();   // word cell: low byte
 assert.deepEqual([...t.snapshot({dataset:1,location:0}).visited],[7,3]);
 b.emit('saveLoaded',{slot:'B'});await t.flush();assert.equal(t.snapshot({dataset:1,location:0}).visited.size,0);
 b.emit('saveLoaded',{slot:'A'});await t.flush();assert.deepEqual([...t.snapshot({dataset:1,location:0}).visited],[7,3]);
 assert.equal(t.bigPic,121);
 const ctx=await currentMapContext({bus:{state:{position:()=>({dataset:1,block:80,is3D:false}),mem:()=>0x0105}},bigPic:121});assert.equal(ctx.location,5);
 const ctx3=await currentMapContext({bus:{state:{position:()=>({dataset:2,block:1,is3D:true,map3d:1}),mem:()=>0,geoPlanes:()=>new Uint8Array(1024)}},bigPic:121});assert.equal(ctx3.location,undefined);assert.equal(ctx3.mapId,1);assert.equal(ctx3.livePlanes.length,1024);
 t.dispose();
});
test('automap off records nothing (the helper toggle; original mode switches it off with every helper)',async()=>{
 const b=bus();let on=false;const t=createMapTracker({bus:b,storeFactory:storage().factory,enabled:()=>on});
 b.state.position=()=>({dataset:2,block:1,map3d:1,is3D:true,x:3,y:4});b.emit('moved',{x:3,y:4});await t.flush();
 assert.equal(t.snapshot({dataset:2,map3d:1,is3D:true,x:0,y:0}).visited.size,0);
 on=true;b.emit('moved',{x:3,y:4});await t.flush();assert.deepEqual([...t.snapshot({dataset:2,map3d:1,is3D:true,x:0,y:0}).visited],[67]);t.dispose();
});
