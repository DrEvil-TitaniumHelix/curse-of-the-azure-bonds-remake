import test from 'node:test';
import assert from 'node:assert/strict';
import {createMapDraft,editSide,exportScenario,validateMap,scenarioSchema} from '../../plus/scenario/model.js';
import {parseGeo} from '../../plus/map/geo.js';
test('draft preserves original directed walls, doors, attributes and map source without mutating input',()=>{
 const bytes=new Uint8Array(1026);bytes[1]=4;bytes[2]=0x12;bytes[258]=0x34;bytes[514]=0x85;bytes[770]=0xe4;
 const original={source:{file:'GEO3.DAX',record:0},cells:parseGeo(bytes)},before=structuredClone(original),draft=createMapDraft(original);
 assert.deepEqual(draft.cells[0].wall,[1,2,3,4]);assert.deepEqual(draft.cells[0].door,[0,1,2,3]);
 const edited=editSide(draft,{x:0,y:0,side:1,wall:15,door:2});assert.deepEqual(original,before);assert.equal(draft.cells[0].wall[1],2);assert.equal(edited.cells[0].wall[1],15);assert.equal(edited.cells[0].attr,0x85);assert.deepEqual(edited.cells[1],draft.cells[1]);
 const scenario=exportScenario(edited,{dataset:3,block:0,x:15,y:4,facing:3,party:[{name:'Synthetic',level:5}],flags:{'0x49AA':1}}),roundtrip=JSON.parse(JSON.stringify(scenario));assert.deepEqual(roundtrip.maps[0],edited);assert.equal(roundtrip.facing,'W');assert.equal(roundtrip.map,0);assert.equal(roundtrip.party[0].level,5);assert.equal(roundtrip.flags['0x49AA'],1);scenario.maps[0].cells[0].attr=0;assert.equal(edited.cells[0].attr,0x85);
 assert.ok(new RegExp(scenarioSchema.$defs.map.properties.source.properties.file.pattern).test('GEO3.DAX'));
});
test('blank maps validate and malformed cells, coordinates and side encodings are rejected',()=>{
 const map=createMapDraft();assert.equal(validateMap(map),map);assert.equal(map.cells.length,256);
 for(const change of [{x:-1,y:0,side:0,wall:0,door:0},{x:0,y:16,side:0,wall:0,door:0},{x:0,y:0,side:4,wall:0,door:0},{x:0,y:0,side:0,wall:16,door:0},{x:0,y:0,side:0,wall:0,door:4}])assert.throws(()=>editSide(map,change));
 assert.throws(()=>validateMap({...map,cells:map.cells.slice(1)}));assert.throws(()=>exportScenario(map,{facing:4}));assert.throws(()=>createMapDraft({source:{file:'../GEO3.DAX',record:0},cells:map.cells}));
});
