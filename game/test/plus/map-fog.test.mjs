import test from 'node:test';
import assert from 'node:assert/strict';
import {createMapTracker,mapPosition} from '../../plus/map/fog.js';
import {maskFog,markerPoints,FOG_COLOUR} from '../../plus/map/overlay.js';
function bus(){let position=null;const listeners=new Set();return {enabled:true,state:{slot:'A',position:()=>position,mem:()=>undefined},on(name,fn){listeners.add(fn);return()=>listeners.delete(fn);},emit(name,p){if(name==='saveLoaded'||name==='gameSaved')this.state.slot=p.slot;if(name==='areaEntered'||name==='moved')position={...position,...p};for(const fn of listeners)fn(p,name);}};}
const area=(x=1,y=2,extra={})=>({dataset:3,block:0,map3d:0,is3D:true,travelMode:1,x,y,dir:0,...extra});
function storage({fail=false,delay=0}={}){const records=new Map();return {records,factory:({profile,slot})=>({async get(name,fallback){if(delay)await new Promise(r=>setTimeout(r,delay));return structuredClone(records.get(JSON.stringify([profile,slot,name]))??fallback);},async set(name,value){if(fail)return false;records.set(JSON.stringify([profile,slot,name]),structuredClone(value));return true;}})};}
function enter(events,position){events.emit('areaEntered',position);events.emit('menuDrawn',{region:'hmenu',items:[{label:'Encamp',key:'E'}]});}

test('movement, turns, loads and save-as retain visited cells in the correct slot during pending reads',async()=>{
 const events=bus(),store=storage({delay:5}),tracker=createMapTracker({bus:events,storeFactory:store.factory});
 enter(events,area());events.emit('moved',area(2,2,{dir:2,stepped:true}));events.emit('saveLoaded',{slot:'B'});enter(events,area(8,8));await tracker.flush();
 assert.deepEqual([...tracker.snapshot(area()).visited],[136]);assert.equal(tracker.slot,'B');
 events.emit('saveLoaded',{slot:'A'});await tracker.flush();assert.deepEqual([...tracker.snapshot(area()).visited],[33,34]);assert.equal(tracker.snapshot(area()).marker,null);
 events.emit('moved',area(2,2,{dir:6,stepped:false,turned:6}));await tracker.flush();assert.equal(tracker.snapshot(area()).marker.dir,6);assert.equal(tracker.snapshot(area()).visited.size,2);
 events.emit('gameSaved',{slot:'C'});await tracker.flush();assert.equal(tracker.slot,'C');assert.deepEqual([...tracker.snapshot(area()).visited],[33,34]);tracker.dispose();
 const restored=createMapTracker({bus:events,storeFactory:store.factory});await restored.flush();assert.equal(restored.snapshot(area()).visited.size,2);restored.dispose();
});
test('fog keys use GEO map id rather than block id; profiles and overland modes stay separate',async()=>{
 const events=bus(),store=storage(),tracker=createMapTracker({bus:events,storeFactory:store.factory});enter(events,area(1,1));events.emit('moved',area(3,4,{map3d:14}));await tracker.flush();
 assert.deepEqual([...tracker.snapshot(area(0,0,{block:8})).visited],[17]);assert.deepEqual([...tracker.snapshot(area(0,0,{map3d:14})).visited],[67]);
 enter(events,area(2,35,{dataset:6,travelMode:2,is3D:false}));await tracker.flush();assert.deepEqual([...tracker.snapshot(area(0,0,{dataset:6,travelMode:2,is3D:false})).visited],[562]);assert.equal(tracker.snapshot(area(0,0,{dataset:6,travelMode:3,is3D:false})).visited.size,0);
 const other=createMapTracker({bus:bus(),profile:'other',storeFactory:store.factory});await other.flush();assert.equal(other.snapshot(area()).visited.size,0);tracker.dispose();other.dispose();
});
test('disabled helpers record nothing; malformed events are ignored; failed storage keeps session fog',async()=>{
 const events=bus();let enabled=false;const tracker=createMapTracker({bus:events,storeFactory:storage({fail:true}).factory,enabled:()=>enabled});enter(events,area());await tracker.flush();assert.equal(tracker.snapshot(area()).visited.size,0);
 enabled=true;assert.doesNotThrow(()=>events.emit('moved',{x:999}));events.emit('moved',area(4,4));await tracker.flush();assert.equal(tracker.sessionOnly,true);assert.deepEqual([...tracker.snapshot(area()).visited],[68]);tracker.dispose();events.emit('moved',area(5,5));await tracker.flush();assert.equal(tracker.snapshot(area()).visited.size,1);
 assert.equal(mapPosition(area(0,0,{travelMode:1,is3D:false})),null);
});
test('fog covers unseen pixels and cell attributes without altering the source; facing uses all eight directions',()=>{
 const image={width:49,height:25,data:new Uint8ClampedArray(49*25*4).fill(255)},before=image.data.slice(),masked=maskFog(image,new Set([0]),2,1);
 assert.deepEqual([...masked.data.subarray((12*49+36)*4,(12*49+36)*4+4)],FOG_COLOUR);assert.deepEqual([...masked.data.subarray((12*49+12)*4,(12*49+12)*4+4)],[255,255,255,255]);assert.deepEqual(image.data,before);
 const north=markerPoints({x:1,y:1,dir:0})[0],east=markerPoints({x:1,y:1,dir:2})[0],south=markerPoints({x:1,y:1,dir:4})[0];assert.deepEqual(north,[36,28]);assert.deepEqual(east,[44,36]);assert.deepEqual(south,[36,44]);
});
test('authoritative slot changes are reconciled before a move even without a slot event',async()=>{
 const events=bus(),tracker=createMapTracker({bus:events,storeFactory:storage().factory});enter(events,area(1,1));await tracker.flush();events.state.slot='B';events.emit('moved',area(2,2));await tracker.flush();assert.equal(tracker.slot,'B');assert.deepEqual([...tracker.snapshot(area()).visited],[34]);tracker.dispose();
});

test('player-ready explore menu reconciles initialized position without revealing tour views or another slot',async()=>{
 const events=bus(),store=storage(),tracker=createMapTracker({bus:events,storeFactory:store.factory});
 enter(events,area(1,1));
 events.state.position=()=>area(9,9);events.emit('viewDrawn',{});
 events.emit('menuDrawn',{region:'hmenu',items:[{label:'Continue'}]});await tracker.flush();
 assert.deepEqual([...tracker.snapshot(area()).visited],[17]);
 events.state.position=()=>area(0,4);events.emit('menuDrawn',{region:'hmenu',items:[{label:'Encamp',key:'E'}]});await tracker.flush();
 assert.deepEqual([...tracker.snapshot(area()).visited],[17,64]);
 events.state.slot='B';events.state.position=()=>area(15,4,{dataset:2,map3d:20});
 events.emit('menuDrawn',{region:'hmenu',items:[{label:'Encamp',key:'E'}]});await tracker.flush();
 assert.equal(tracker.slot,'B');assert.deepEqual([...tracker.snapshot(area(15,4,{dataset:2,map3d:20})).visited],[79]);
 assert.equal(tracker.snapshot(area()).visited.size,0);tracker.dispose();
});

test('pre-init area entry does not reveal stale coordinates in the destination map',async()=>{
 const events=bus(),tracker=createMapTracker({bus:events,storeFactory:storage().factory});
 events.emit('areaEntered',area(1,1));await tracker.flush();assert.equal(tracker.snapshot(area()).visited.size,0);
 events.state.position=()=>area(15,4);events.emit('menuDrawn',{region:'hmenu',items:[{label:'Encamp'}]});await tracker.flush();
 assert.deepEqual([...tracker.snapshot(area()).visited],[79]);tracker.dispose();
});

test('scripted combat arrival records world position without using combat-grid coordinates',async()=>{
 const events=bus(),tracker=createMapTracker({bus:events,storeFactory:storage().factory});
 events.state.position=()=>area(14,4,{dataset:2,map3d:20});events.emit('combatStart',{x:8,y:9});await tracker.flush();
 assert.deepEqual([...tracker.snapshot(area(14,4,{dataset:2,map3d:20})).visited],[78]);tracker.dispose();
});

test('Plus quick/autosave slots retain distinct ledgers rather than sharing unsaved state',async()=>{
 const events=bus(),store=storage(),tracker=createMapTracker({bus:events,storeFactory:store.factory});
 enter(events,area(1,1));events.emit('gameSaved',{slot:'Q'});events.emit('moved',area(2,1));await tracker.flush();
 assert.equal(tracker.slot,'Q');assert.deepEqual([...tracker.snapshot(area()).visited],[17,18]);
 events.emit('gameSaved',{slot:'X'});events.emit('moved',area(3,1));await tracker.flush();assert.equal(tracker.slot,'X');
 events.emit('saveLoaded',{slot:'Q'});await tracker.flush();assert.deepEqual([...tracker.snapshot(area()).visited],[17,18]);
 assert.ok([...store.records.keys()].every(key=>!key.includes('unsaved')));tracker.dispose();
});
