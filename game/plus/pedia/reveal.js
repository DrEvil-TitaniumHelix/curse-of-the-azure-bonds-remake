import {buildPedia} from './build.js';
import {createScopedLedger,saveSlot} from '../map/ledger.js';
import {spellEvidence,CHAR_SIZE,ITEM_SIZE,SPELL_IDS} from './records.js';
const KINDS=new Set(['monster','npc','item','itemType','spell','place']);
const text=value=>typeof value==='string'?value.trim().slice(0,160):'';
const number=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
function decode(value){
 if(value?.version!==1||!Array.isArray(value.entries))return null;
 return {version:1,entries:value.entries.filter(e=>e&&typeof e.id==='string'&&e.id.length<=600&&KINDS.has(e.kind)).map(e=>({...e,name:text(e.name),whereMet:Array.isArray(e.whereMet)?e.whereMet.filter(p=>number(p.dataSet,1,8)&&number(p.block,0,255)).slice(0,64):[]}))};
}
function picture(ref){
 if(!ref)return undefined;
 const name=String(ref.file??ref.dax??'').toUpperCase().replace(/\.DAX$/,'');
 return /^(CPIC|PIC|HEAD|BODY|SPRIT|BIGPIC)[1-8]$/.test(name)&&number(ref.record,0,255)?{file:name+'.DAX',record:ref.record}:undefined;
}
function observedStats(p){
 const stats={};for(const [key,label]of [['hp','HP observed'],['hpMax','Maximum HP observed'],['ac','AC observed'],['thac0','THAC0 observed'],['status','Status code observed']])if(Number.isFinite(p[key]))stats[label]=p[key];return stats;
}
// Only event-proven identities enter the ledger. A name match never unlocks several
// ambiguous templates, and an observed item never inherits an unseen template's powers.
export function createPediaTracker({bus,profile='cab',load=buildPedia,storeFactory,enabled=()=>bus.enabled!==false}={}){
 const ledger=createScopedLedger({profile,key:'pedia:revealed',empty:()=>({version:1,entries:[]}),decode,storeFactory,slot:saveSlot(bus.state.slot)});
 let catalogPromise,disposed=false,lastError='';
 const catalog=()=>{if(!catalogPromise)catalogPromise=Promise.resolve().then(load).catch(error=>{catalogPromise=null;lastError=error.message;throw error;});return catalogPromise;};
 function placeSnapshot(p={}){
  const position={...bus.state.position(),...p};
  const dataSet=position.dataset??position.dataSet;
  if(!number(dataSet,1,8)||!number(position.block,0,255))return null;
  const place={dataSet,block:position.block};if(number(position.x,0,15))place.x=position.x;if(number(position.y,0,35))place.y=position.y;
  const clock=bus.state.clock?.();if(clock?.text)place.time=text(clock.text);return place;
 }
 function geoPlace(){const p=bus.state.position?.();return p&&p.is3D&&number(p.map3d,0,255)?`place:geo:${p.map3d}`:null;}
 function snapshotParty(){try{return structuredClone(bus.state.party?.({withRecord:true})||[]);}catch{return [];}}
 function remember(value,entry,details,where){
  if(!entry||!KINDS.has(entry.kind))return;
  let stored=value.entries.find(e=>e.id===entry.id);
  if(!stored){stored={id:entry.id,kind:entry.kind,name:entry.name,whereMet:[]};value.entries.push(stored);}
  Object.assign(stored,details);
  if(where&&!stored.whereMet.some(p=>p.dataSet===where.dataSet&&p.block===where.block))stored.whereMet.push(where);
 }
 function namedEntry(c,kind,name,dataset,record){
  const id=number(record,0,255)&&number(dataset,1,8)?`${kind}:${dataset}:${record}`:null;
  let entry=id?c.entries.find(e=>e.id===id):null;
  if(!entry&&kind==='monster'&&!id){const candidates=c.entries.filter(e=>e.kind===kind&&e.dataSet===dataset&&e.name.toUpperCase()===name.toUpperCase());if(candidates.length===1)entry=candidates[0];}
  // cab: a party member flagged NPC carries no record number; one ADD_NPC record of that exact name is proof enough.
  if(!entry&&kind==='npc'&&!id&&name){const candidates=c.entries.filter(e=>e.kind==='npc'&&e.name.toUpperCase()===name.toUpperCase());if(candidates.length===1)entry=candidates[0];}
  return entry || (name?{id:id||`${kind}Observed:${dataset??'unknown'}:${encodeURIComponent(name.toUpperCase())}`,kind,name,stats:{},dynamic:true}:null);
 }
 function processMonster(value,c,p,where){
  const dataset=p.dataset??p.dataSet??where?.dataSet;
  const record=p.monsterId??p.id??p.ref?.record;
  const entry=namedEntry(c,'monster',text(p.name),dataset,record);if(!entry)return;
  const details={};if(entry.dynamic)details.dynamic=true;
  const image=picture(p.icon??p.picture) || (number(p.pic,0,255)&&number(dataset,1,8)?picture({dax:`CPIC${dataset}`,record:p.pic}):undefined);
  if(image)details.picture=image;const stats=observedStats(p);if(Object.keys(stats).length)details.stats=stats;
  if(text(p.name))details.name=text(p.name);remember(value,entry,details,where);
 }
 function processNpc(value,c,p,where){
  const person=p.npc&&typeof p.npc==='object'?p.npc:p,name=text(person.name??person.npcName);
  if(!name)return; // Legacy anonymous encounter/parlay text does not establish an NPC identity.
  const dataset=person.dataset??person.dataSet??where?.dataSet,record=person.monsterId??person.ref?.record;
  const entry=namedEntry(c,'npc',name,dataset,record),details={name,stats:observedStats(person)};
  if(entry.dynamic)details.dynamic=true;
  const image=picture(person.picture??person.icon);if(image)details.picture=image;
  remember(value,entry,details,where);
 }
 // cab: an item is named only from its record (BuildItemName words, hidden words left out). The payload's name is the
 // record's +00h string, which can be an authoring left-over, so without a record only the item type is revealed.
 function processItem(value,c,p,where){
  if(!p||!number(p.type,0,127)&&!(p.record instanceof Uint8Array))return;
  let observed=null;
  if(p.record instanceof Uint8Array&&p.record.length===ITEM_SIZE&&c.observeItem){try{observed=c.observeItem(p.record);}catch{return;}}
  const type=observed?observed.type:p.type;if(!number(type,0,127))return;
  const typeEntry=c.entries.find(e=>e.id===`itemType:${type}`);
  if(typeEntry){const stored=value.entries.find(e=>e.id===typeEntry.id),details=observed&&observed.name!=='Unidentified item'&&(!stored||stored.name===typeEntry.name)?{name:`${text(observed.name)} (type ${type})`}:{};remember(value,typeEntry,details,where);}
  if(!observed)return;
  const name=text(observed.name);if(!name)return;
  const stats={...observed.stats};for(const [key,label]of [['count','Count'],['weight','Weight'],['readied','Readied']])if(typeof p[key]==='boolean'||Number.isFinite(p[key]))stats[label]=p[key];
  const id=`itemObserved:${type}:${encodeURIComponent(name.toUpperCase())}`;
  remember(value,{id,kind:'item',name},{name,dynamic:true,type,stats,picture:null,note:'Observed item. Only the name and details visible when seen are recorded.'},where);
 }
 function processSpell(value,c,id,where){if(!number(id,1,SPELL_IDS))return;const entry=c.entries.find(e=>e.id===`spell:${id}`);remember(value,entry,{},where);}
 function processParty(value,c,party,where){
  for(const member of party){if(member.npc===true)processNpc(value,c,member,where);const b=member.record;if(!(b instanceof Uint8Array)||b.length!==CHAR_SIZE)continue;for(const id of spellEvidence(b))processSpell(value,c,id,where);}
 }
 function receive(payload,name){
  if(disposed)return;
  try{
   if(name==='saveLoaded'){void ledger.use(saveSlot(payload.slot));if(enabled())scanParty();return;}
   if(name==='gameSaved'){if(enabled())void ledger.saveAs(saveSlot(payload.slot));else void ledger.use(saveSlot(payload.slot));return;}
   if(!enabled())return;
   const authoritativeSlot=saveSlot(bus.state.slot);if(authoritativeSlot!==ledger.slot)void ledger.use(authoritativeSlot);
   if(!['areaEntered','moved','viewDrawn','bigPicShown','monsterShown','combatStart','treasure','itemsSeen','itemSeen','spellCast','spellMemorised','spellMemorized','npcTalk','partyDrawn'].includes(name))return;
   // cab: the 3D map id (VM 4BC5) is set by the block's LOAD FILES after areaEntered, so a map is revealed on the first
   // step or view draw that shows it (a cheap check before any work is queued).
   const geo=geoPlace();
   if(name==='moved'||name==='viewDrawn'){if(geo&&!ledger.peek().entries.some(e=>e.id===geo))void ledger.change(async value=>{const before=JSON.stringify(value),c=await catalog();remember(value,c.entries.find(e=>e.id===geo),{},placeSnapshot());return JSON.stringify(value)!==before;});return;}
   const p=structuredClone(payload||{}),where=placeSnapshot(name==='areaEntered'?p:{}),party=['areaEntered','partyDrawn'].includes(name)?snapshotParty():[];
   void ledger.change(async value=>{
    const before=JSON.stringify(value),c=await catalog();let location=where;
    if(name==='bigPicShown'&&number(p.id,0,255))remember(value,c.entries.find(e=>e.id===`place:bigpic:${p.id}`),{},location);
    if(name==='monsterShown')processMonster(value,c,p,location);
    if(name==='combatStart')for(const monster of Array.isArray(p.monsters)?p.monsters:[])processMonster(value,c,monster,location);
    if(name==='treasure'||name==='itemsSeen')for(const item of Array.isArray(p.items)?p.items:[])processItem(value,c,item,location);
    if(name==='itemSeen')processItem(value,c,p.item??p,location);
    if(name==='spellCast'||name==='spellMemorised'||name==='spellMemorized')processSpell(value,c,p.spellId??p.id??p.spell,location);
    if(name==='npcTalk')processNpc(value,c,p,location);
    if(party.length)processParty(value,c,party,location);
    return JSON.stringify(value)!==before;
   });
  }catch{/* Bad or unsupported payloads must not escape into the engine. */}
 }
 function scanParty(){
  if(!enabled()||disposed)return;
  const party=snapshotParty(),where=placeSnapshot();if(!party.length)return;
  void ledger.change(async value=>{const before=JSON.stringify(value);processParty(value,await catalog(),party,where);return JSON.stringify(value)!==before;});
 }
 const off=bus.on('*',receive);void ledger.use(ledger.slot);
 if(!bus.state.partyCount||bus.state.partyCount()>0){const p=bus.state.position();if(p)receive(p,'areaEntered');scanParty();}
 return {
  get slot(){return ledger.slot;},get sessionOnly(){return ledger.sessionOnly;},get error(){return ledger.error||lastError;},
  get revealed(){return new Map(ledger.peek().entries.map(e=>[e.id,structuredClone(e)]));},
  get entries(){return ledger.peek().entries.filter(e=>e.dynamic).map(e=>structuredClone(e));},
  catalog,flush:()=>ledger.flush(),onChange:fn=>ledger.onChange(()=>{if(!disposed)fn();}),
  sync(){const slot=saveSlot(bus.state.slot);if(slot!==ledger.slot)void ledger.use(slot);scanParty();},
  dispose(){disposed=true;off();},
 };
}
