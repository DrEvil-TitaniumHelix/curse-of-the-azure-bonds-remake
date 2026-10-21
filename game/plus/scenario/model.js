// Scenario creation skeleton. Independent implementation; FRUA/uaf are design references only.
// cab: the Curse scenario format `cab-scenario` v1 (cheats/scenario.js validateScenario); the map editor stays a stub (S7):
// its draft travels in `maps` for a later writer, the game does not load it.
const integer=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
export function validateMap(map) {
 if(!map||map.width!==16||map.height!==16||!Array.isArray(map.cells)||map.cells.length!==256)throw Error('Map must contain 256 cells in a 16 × 16 grid');
 for(let i=0;i<256;i++){
  const c=map.cells[i];if(!c||c.x!==i%16||c.y!==Math.floor(i/16)||!integer(c.attr,0,255)||!Array.isArray(c.wall)||c.wall.length!==4||!c.wall.every(n=>integer(n,0,15))||!Array.isArray(c.door)||c.door.length!==4||!c.door.every(n=>integer(n,0,3)))throw Error(`Invalid map cell ${i}`);
 }
 if(map.source!==null&&map.source!==undefined&&(!/^GEO[1-8]\.DAX$/.test(map.source.file)||!integer(map.source.record,0,255)))throw Error('Invalid GEO source');
 return map;
}
export function createMapDraft(model=null){
 const map={width:16,height:16,source:model?.source?structuredClone(model.source):null,cells:model?.cells?structuredClone(model.cells):Array.from({length:256},(_,i)=>({x:i%16,y:Math.floor(i/16),wall:[0,0,0,0],door:[0,0,0,0],attr:0}))};return validateMap(map);
}
export function editSide(map,{x,y,side,wall,door}){
 validateMap(map);if(!integer(x,0,15)||!integer(y,0,15)||!integer(side,0,3)||!integer(wall,0,15)||!integer(door,0,3))throw Error('Cell, side, wall or passage value out of range');
 const copy=structuredClone(map);copy.cells[y*16+x].wall[side]=wall;copy.cells[y*16+x].door[side]=door;return copy;
}
export function exportScenario(map,{dataset=2,block=1,x=0,y=0,facing='N',...rest}={}){
 validateMap(map);const direction=typeof facing==='string'?facing.toUpperCase():['N','E','S','W'][facing];if(!integer(dataset,1,8)||!integer(block,0,255)||!integer(x,0,15)||!integer(y,0,15)||!['N','E','S','W'].includes(direction))throw Error('Invalid scenario starting position');
 const extras=structuredClone(rest),mapId=extras.map??map.source?.record??block;if(!integer(mapId,0,255))throw Error('Invalid GEO map id');return {...extras,format:'cab-scenario',version:1,profile:'cab',party:extras.party??[],flags:extras.flags??{},items:extras.items??[],dataset,block,map:mapId,x,y,facing:direction,maps:[structuredClone(map)]};
}
// Authoring schema; W11 consumes party/position/clock/flags/items. Map application is a later integration.
export const scenarioSchema={
 $schema:'https://json-schema.org/draft/2020-12/schema',title:'Gold Box Plus scenario draft',type:'object',
 required:['format','version','profile','dataset','block','x','y','facing','party'],
 properties:{format:{const:'cab-scenario'},version:{const:1},profile:{const:'cab'},ecl:{type:'array',items:{type:'object',required:['dataset','block','listing'],properties:{dataset:{type:'integer'},block:{type:'integer'},listing:{type:'string'}}}},cheat:{type:'boolean'},party:{type:'array',items:{type:'object',required:['name'],properties:{name:{type:'string'},race:{type:['string','integer']},class:{type:['string','integer']},classes:{type:'array',items:{type:'string'}},level:{type:'integer',minimum:1},levels:{type:'array',items:{type:'integer',minimum:1}},stats:{type:'object'},hp:{type:'integer'},items:{type:'array'},spells:{type:'array'}}}},dataset:{type:'integer',minimum:1,maximum:6},block:{type:'integer',minimum:0,maximum:255},x:{type:'integer',minimum:0,maximum:15},y:{type:'integer',minimum:0,maximum:15},map:{type:'integer',minimum:0,maximum:255},facing:{enum:['N','E','S','W']},clock:{type:'object'},flags:{type:'object',patternProperties:{'^(0x)?[0-9A-Fa-f]{4}$':{type:['integer','string']}},additionalProperties:false},items:{type:'array'},cheat:{type:'boolean'},maps:{type:'array',minItems:1,maxItems:1,items:{$ref:'#/$defs/map'}}},
 $defs:{map:{type:'object',required:['width','height','cells'],properties:{width:{const:16},height:{const:16},source:{type:['object','null'],properties:{file:{type:'string',pattern:'^GEO[1-8]\\.DAX$'},record:{type:'integer',minimum:0,maximum:255}},required:['file','record']},cells:{type:'array',minItems:256,maxItems:256,items:{type:'object',required:['x','y','wall','door','attr'],properties:{x:{type:'integer',minimum:0,maximum:15},y:{type:'integer',minimum:0,maximum:15},wall:{type:'array',minItems:4,maxItems:4,items:{type:'integer',minimum:0,maximum:15}},door:{type:'array',minItems:4,maxItems:4,items:{type:'integer',minimum:0,maximum:3}},attr:{type:'integer',minimum:0,maximum:255}}}}}}}
};
