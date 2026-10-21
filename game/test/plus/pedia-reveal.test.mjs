// Pedia reveal (S5 step 2, cab-plus-pedia): entries unlock only from hook events, per save slot. Synthetic catalogue,
// no game data.   node --test game/test/plus/pedia-reveal.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {createPediaTracker} from '../../plus/pedia/reveal.js';
import {extractItem} from '../../plus/pedia/records.js';
function bus(){let position=null,party=[];const listeners=new Set();return {enabled:true,state:{slot:'A',position:()=>position,clock:()=>({text:'10:30'}),party:()=>party,partyCount:()=>party.length},setParty(value){party=value;},setPosition(p){position={...p};},on(name,fn){listeners.add(fn);return()=>listeners.delete(fn);},emit(name,p){if(name==='saveLoaded'||name==='gameSaved')this.state.slot=p.slot;if(name==='areaEntered')position={...p};for(const fn of listeners)fn(p,name);}};}
function storage({fail=false}={}){const records=new Map();return {records,factory:({profile,slot})=>({async get(key,fallback){await new Promise(r=>setTimeout(r,1));return structuredClone(records.get(JSON.stringify([profile,slot,key]))??fallback);},async set(key,value){if(fail)return false;records.set(JSON.stringify([profile,slot,key]),structuredClone(value));return true;}})};}
const place={dataset:3,block:17,x:1,y:2,is3D:false,travelMode:1,map3d:0,dir:0};
function catalog(){return {entries:[{id:'place:geo:16',kind:'place',name:'3D map 16'},{id:'place:geo:17',kind:'place',name:'3D map 17'},{id:'place:bigpic:121',kind:'place',name:'2D backdrop 121'},
 {id:'monster:3:16',kind:'monster',name:'First beast',dataSet:3,stats:{'Base AC':4}},{id:'monster:3:17',kind:'monster',name:'Second beast',dataSet:3},{id:'monster:3:18',kind:'monster',name:'Unseen beast',dataSet:3},
 {id:'monster:3:24',kind:'monster',name:'Ambiguous',dataSet:3},{id:'monster:3:25',kind:'monster',name:'Ambiguous',dataSet:3},
 {id:'npc:3:22',kind:'npc',name:'Test guide'},{id:'itemType:36',kind:'itemType',name:'Item type 36'},{id:'itemType:71',kind:'itemType',name:'Item type 71'},
 ...[1,2,3,70,100].map(i=>({id:`spell:${i}`,kind:'spell',name:`Test spell ${i}`})),{id:'item:secret',kind:'item',name:'Secret potion power',stats:{'Magic bonus':9}}]};}
const charRecord=()=>new Uint8Array(0x1A6);

test('area/monster/combat/treasure/spell/NPC/place hooks unlock only proven entries and confirmed pictures',async()=>{
 const events=bus(),tracker=createPediaTracker({bus:events,load:async()=>catalog(),storeFactory:storage().factory});
 events.emit('areaEntered',place);
 events.emit('monsterShown',{id:16,dataset:3,name:'First beast',pic:12,ref:{dax:'MON3CHA',record:16},icon:{dax:'CPIC3',record:12}});
 events.emit('combatStart',{monsters:[{monsterId:17,dataset:3,name:'Second beast',hp:7,ac:5}]});
 events.emit('treasure',{items:[{name:'Stored name',type:71}]});
 events.emit('npcTalk',{kind:'parlay',choice:'NICE'});events.emit('spellCast',{spellId:2});events.emit('spellCast',{spellId:101});
 events.emit('bigPicShown',{id:121});await tracker.flush();
 for(const id of ['npc:3:22','monster:3:18','spell:3','item:secret','place:geo:16'])assert.equal(tracker.revealed.has(id),false,id);
 // a treasure payload without the record reveals the type only, never the stored +00h name
 assert.equal(tracker.revealed.get('itemType:71').name,'Item type 71');assert.equal(tracker.entries.filter(e=>e.kind==='item').length,0);
 assert.deepEqual(tracker.revealed.get('monster:3:16').picture,{file:'CPIC3.DAX',record:12});assert.equal(tracker.revealed.get('monster:3:17').stats['HP observed'],7);
 assert.deepEqual(tracker.revealed.get('monster:3:16').whereMet[0],{dataSet:3,block:17,x:1,y:2,time:'10:30'});
 assert.equal(tracker.revealed.has('spell:2'),true);assert.equal(tracker.revealed.has('place:bigpic:121'),true);
 // an NPC who joins (party member flagged NPC) is matched by its one ADD_NPC record name
 events.setParty([{name:'TEST GUIDE',npc:true,record:charRecord()}]);events.emit('partyDrawn',{});await tracker.flush();assert.equal(tracker.revealed.has('npc:3:22'),true);
 tracker.dispose();
});
test('3D maps unlock on the first step or view draw with the map loaded, not on block entry',async()=>{
 const events=bus(),tracker=createPediaTracker({bus:events,load:async()=>catalog(),storeFactory:storage().factory});
 events.emit('areaEntered',{...place,is3D:true,map3d:16});await tracker.flush();assert.equal(tracker.revealed.has('place:geo:16'),false);
 events.setPosition({...place,is3D:true,map3d:17});events.emit('viewDrawn',{});await tracker.flush();assert.equal(tracker.revealed.has('place:geo:17'),true);
 events.emit('moved',{});await tracker.flush();assert.equal(tracker.revealed.get('place:geo:17').whereMet.length,1);
 events.setPosition({...place,is3D:false,map3d:16});events.emit('moved',{});await tracker.flush();assert.equal(tracker.revealed.has('place:geo:16'),false);
 tracker.dispose();
});
test('catalogue loads in background; rapid slot changes never leak queued discoveries and save-as inherits knowledge',async()=>{
 const events=bus(),store=storage();let release;const waiting=new Promise(resolve=>{release=resolve;});const tracker=createPediaTracker({bus:events,storeFactory:store.factory,load:async()=>{await waiting;return catalog();}});
 assert.doesNotThrow(()=>events.emit('monsterShown',{dataset:3,id:16,name:'First beast'}));events.emit('saveLoaded',{slot:'B'});events.emit('monsterShown',{dataset:3,id:17,name:'Second beast'});release();await tracker.flush();
 assert.equal(tracker.slot,'B');assert.equal(tracker.revealed.has('monster:3:16'),false);assert.equal(tracker.revealed.has('monster:3:17'),true);
 events.emit('gameSaved',{slot:'C'});await tracker.flush();assert.equal(tracker.revealed.has('monster:3:17'),true);events.emit('saveLoaded',{slot:'A'});await tracker.flush();assert.equal(tracker.revealed.has('monster:3:16'),true);assert.equal(tracker.revealed.has('monster:3:17'),false);tracker.dispose();
 const restored=createPediaTracker({bus:events,storeFactory:store.factory,load:async()=>catalog()});await restored.flush();assert.equal(restored.revealed.has('monster:3:16'),true);restored.dispose();
 const isolated=createPediaTracker({bus:bus(),profile:'other',storeFactory:store.factory,load:async()=>catalog()});await isolated.flush();assert.equal(isolated.revealed.size,0);isolated.dispose();
});
test('party snapshots reveal known and memorised spells of the 422-byte record; disabled events and disposed listeners do nothing',async()=>{
 const events=bus(),record=charRecord();record[0x78+1]=1;record[0x1E]=100;record[0x1F]=0x80|70;events.setParty([{name:'Test caster',record}]);let enabled=false;
 const tracker=createPediaTracker({bus:events,load:async()=>catalog(),storeFactory:storage({fail:true}).factory,enabled:()=>enabled});events.emit('spellCast',{id:2});events.emit('areaEntered',place);await tracker.flush();assert.equal(tracker.revealed.size,0);
 enabled=true;events.emit('partyDrawn',{});await tracker.flush();
 assert.equal(tracker.revealed.has('spell:1'),true);assert.equal(tracker.revealed.has('spell:100'),true);assert.equal(tracker.revealed.has('spell:70'),false);assert.equal(tracker.revealed.has('spell:2'),false);
 assert.equal(tracker.sessionOnly,true);tracker.dispose();events.emit('spellCast',{id:2});await tracker.flush();assert.equal(tracker.revealed.has('spell:2'),false);
 // a Pool-sized record is not read as a Curse record
 const pool=bus();pool.setParty([{name:'Old',record:new Uint8Array(285).fill(1)}]);const t2=createPediaTracker({bus:pool,load:async()=>catalog(),storeFactory:storage().factory});pool.emit('partyDrawn',{});await t2.flush();assert.equal([...t2.revealed.keys()].some(k=>k.startsWith('spell:')),false);t2.dispose();
});
test('item records: hidden words and bonus stay hidden, the type takes the visible name; ambiguous combat names unlock nothing',async()=>{
 const ds=new Uint8Array(0x4000);const put=(o,s)=>{ds[o]=s.length;for(let i=0;i<s.length;i++)ds[o+i+1]=s.charCodeAt(i);};put(0x1040+21*36,'Test Blade');put(0x1040+21*162,'+1');
 const record=new Uint8Array(63);record[0x31]=36;record[0x30]=162;record[0x35]=2;record[0x32]=1;record[0x2E]=36;for(const [i,c] of [...'Stored name'].entries())record[1+i]=c.charCodeAt(0);record[0]=14;
 const c=catalog();c.observeItem=bytes=>extractItem(bytes,ds);const events=bus(),tracker=createPediaTracker({bus:events,load:async()=>c,storeFactory:storage().factory});
 events.emit('treasure',{items:[{name:'Stored name',type:36,record}]});events.emit('combatStart',{monsters:[{name:'Ambiguous',dataset:3,hp:2}]});await tracker.flush();
 const item=tracker.entries.find(e=>e.kind==='item');assert.equal(item.name,'Test Blade');assert.equal(item.stats['Magic bonus'],undefined);assert.equal(item.stats['Value (gp)'],undefined);
 assert.equal(tracker.revealed.get('itemType:36').name,'Test Blade (type 36)');
 assert.equal(tracker.revealed.has('monster:3:24'),false);assert.equal(tracker.revealed.has('monster:3:25'),false);assert.equal(tracker.entries.filter(e=>e.kind==='monster').length,1);tracker.dispose();
});
test('early authoritative slot metadata is reconciled before discoveries from a new load',async()=>{
 const events=bus(),tracker=createPediaTracker({bus:events,load:async()=>catalog(),storeFactory:storage().factory});events.emit('monsterShown',{dataset:3,id:16});await tracker.flush();events.state.slot='B';events.emit('monsterShown',{dataset:3,id:17});await tracker.flush();assert.equal(tracker.slot,'B');assert.equal(tracker.revealed.has('monster:3:16'),false);assert.equal(tracker.revealed.has('monster:3:17'),true);tracker.dispose();
});
