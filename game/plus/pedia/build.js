import {readDir,DaxRleDecode} from '../../engine/dax.js';
import {extractCharacter,extractItem,extractItemType,extractSpells,extractEffects,splitRecords,need,loadModule,ITEM_SIZE} from './records.js';
import {decodePicture} from './pictures.js';

// cab: ADD_NPC constant operands (record, data set, block) from the decoded ECL scripts (decode/ecl/scripts, ECL1_82,
// ECL3_17/18, ECL5_49, ECL6_66), not names or story text. The names come from the player's MONnCHA records.
export const NPC_REFERENCES = Object.freeze([
 {dataSet:1,block:82,record:0x55}, {dataSet:1,block:82,record:0x58}, {dataSet:1,block:82,record:0x5A},
 {dataSet:3,block:17,record:0x16}, {dataSet:3,block:17,record:0x17},
 {dataSet:5,block:49,record:0x3B}, {dataSet:6,block:66,record:0x43},
]);
export function archiveRecords(bytes) {
 if (!bytes) return new Map();
 need(bytes,2,'DAX');const directory=readDir(bytes);
 if (directory.dataStart>bytes.length || (directory.dataStart-2)%9) throw new Error('Invalid DAX directory');
 const out=new Map();
 for(const e of directory.entries) {
  if (directory.dataStart+e.ofs+e.comp>bytes.length) throw new Error('Truncated DAX record');
  if (!out.has(e.id)) out.set(e.id,DaxRleDecode(bytes.subarray(directory.dataStart+e.ofs,directory.dataStart+e.ofs+e.comp),e.comp,e.raw));   // the engine stops at the first entry with the id
 }
 return out;
}
const setOf = name => Number(name.match(/^[A-Z]+(\d+)/i)?.[1]);
// The catalogue is built in the browser from the player's own imported files; nothing of it is stored in the repo.
export async function buildPedia({profile,readFile}={}) {
 if(!profile) { const response=await fetch(new URL('../../profiles/cab.json',import.meta.url));if(!response.ok) throw new Error('Game profile unavailable');profile=await response.json(); }
 if(profile.id!=='cab' || profile.version!=='1.0') throw new Error('Pedia needs the supported Curse of the Azure Bonds v1.0 profile');
 if(!readFile) {
  const dax=await import('../../engine/dax.js');
  readFile=dax.fetchFile;
 }
 const files=new Map(),archives=new Map();
 const file=async name => { if(!files.has(name)) files.set(name,Promise.resolve(readFile(name)));return files.get(name); };
 const archive=async name => { if(!archives.has(name)) archives.set(name,file(name).then(bytes => {if(!bytes) throw new Error(`Imported file missing: ${name}`);return archiveRecords(bytes);}));return archives.get(name); };
 const state=profile.engine.state,exe=await file(state.executable);if(!exe) throw new Error('Import your own supported game files before opening the pedia');
 const image=loadModule(exe);need(image,state.dsImageOffset+0x37DA+(0x64+1)*16,'executable DS');
 const ds=image.subarray(state.dsImageOffset),entries=[];
 const catalogue=await file('ITEMS');need(catalogue,2050,'ITEMS');
 for(let i=0;i<128;i++) entries.push(extractItemType(catalogue.subarray(2+i*16,18+i*16),i));
 entries.push(...extractSpells(ds));
 const monsters=new Map();
 for(const name of profile.daxGroups.MONCHA) {
  const n=setOf(name),chars=await archive(name);
  const items=profile.daxGroups.MONITM.includes(`MON${n}ITM.DAX`)?await archive(`MON${n}ITM.DAX`):new Map();
  const effects=profile.daxGroups.MONSPC.includes(`MON${n}SPC.DAX`)?await archive(`MON${n}SPC.DAX`):new Map();
  for(const [record,b] of chars) {
   const c=extractCharacter(b,ds),entry={...c,id:`monster:${n}:${record}`,kind:'monster',dataSet:n,record,whereMet:[],picture:null,
    inventory:splitRecords(items.get(record),ITEM_SIZE,'monster item').map(b => extractItem(b,ds)),effects:extractEffects(effects.get(record)),
    source:{file:name,record},note:'Template base values; equipped and in-combat values can differ. Pictures are attached only when an encounter confirms the asset.'};
   entries.push(entry);monsters.set(`${n}:${record}`,entry);
  }
 }
 for(const ref of NPC_REFERENCES) {
  const monster=monsters.get(`${ref.dataSet}:${ref.record}`);if(!monster) throw new Error('NPC source record missing');
  entries.push({...monster,id:`npc:${ref.dataSet}:${ref.record}`,kind:'npc',whereMet:[],scriptRef:{dataSet:ref.dataSet,block:ref.block},note:'Record a script adds to the party. Script association is not evidence that the player met this person.'});
 }
 for(const name of [...profile.daxGroups.ITEM,...profile.daxGroups.MONITM]) {
  const dataSet=setOf(name);
  for(const [record,bytes] of await archive(name)) splitRecords(bytes,ITEM_SIZE,'item').forEach((b,index) => entries.push({
   ...extractItem(b,ds),id:`item:${name}:${record}:${index}`,kind:'item',dataSet,record,index,whereMet:[],source:{file:name,record,index},picture:null,
  }));
 }
 // Places: the 3D maps (GEOn, 1026-byte records; VM 4BC5 holds the loaded id) and the 304x120 2D backdrops (BIGPICn).
 for(const name of profile.daxGroups.GEO) for(const [record,bytes] of await archive(name)) {
  need(bytes,1026,'GEO record');let walls=0,doors=0;
  for(let i=0;i<256;i++) {const w=[bytes[2+i]>>4,bytes[2+i]&15,bytes[258+i]>>4,bytes[258+i]&15];walls+=w.filter(Boolean).length;for(let s=0;s<4;s++) if((bytes[770+i]>>(2*s))&3) doors++;}
  entries.push({id:`place:geo:${record}`,kind:'place',name:`3D map ${record}`,dataSet:setOf(name),geo:record,whereMet:[],source:{file:name,record},
   stats:{'Data set':setOf(name),'Map id':record,'Size':'16 x 16','Walled sides':walls,'Passages':doors},note:'A 3D area. The Map page draws the squares you have visited.'});
 }
 for(const name of profile.daxGroups.BIGPIC) for(const [record] of await archive(name)) entries.push({id:`place:bigpic:${record}`,kind:'place',name:`2D backdrop ${record}`,
  dataSet:setOf(name),bigPic:record,whereMet:[],source:{file:name,record},picture:{file:name,record},stats:{'Data set':setOf(name),'Picture id':record},note:'A full-width picture shown for a 2D area.'});
 return {
  entries,
  observeItem(bytes){return extractItem(bytes,ds);},
  async picture(reference) {
   if(!reference || !/^(CPIC|PIC|SPRIT|HEAD|BODY|BIGPIC)[1-8]\.DAX$/.test(reference.file) || !Number.isInteger(reference.record)) return null;
   const bytes=(await archive(reference.file)).get(reference.record);if(!bytes) return null;
   const animation=/^(PIC|SPRIT)/.test(reference.file);
   return decodePicture(bytes,{animation,xor:reference.file.startsWith('PIC'),frame:reference.frame||0});
  },
 };
}
