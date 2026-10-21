// Decoded layouts only. All names and record values come from the player's copy.
// cab: the 422-byte character record (decode/pseudo/PARTY.pas.md ## Character record), the 63-byte item record
// (same section), the DS name tables (RaceName 0E9C, ClassName 0CB6, ItemWord 1040, SpellNames 27BD, SpellTable 37DA)
// and the spell table ids 1..64h (decode/pseudo/MAGIC.pas.md ## Spell table).
export const CHAR_SIZE = 0x1A6, ITEM_SIZE = 63, EFFECT_SIZE = 9, SPELL_IDS = 0x64;
export const DS = Object.freeze({ race: 0x0E9C, cls: 0x0CB6, word: 0x1040, spellName: 0x27BD, spellTable: 0x37DA });
export function need(bytes, size, label = 'record') {
 if (!(bytes instanceof Uint8Array) || bytes.length < size) throw new Error(`Invalid ${label}: needs ${size} bytes`);
 return bytes;
}
export function pstr(bytes, offset, max) {
 need(bytes, offset + 1, 'string');
 const n = bytes[offset]; if (n > max || offset + 1 + n > bytes.length) throw new Error('Invalid Pascal string');
 return String.fromCharCode(...bytes.subarray(offset + 1, offset + 1 + n)).trim();
}
export const u16 = (b,o) => b[o] | b[o+1] << 8;
const signed = n => (n << 24) >> 24;
const dice = (b,o,i) => `${b[o+i]}d${b[o+2+i]}${signed(b[o+4+i]) >= 0 ? '+' : ''}${signed(b[o+4+i])}`;
// The load module of START.EXE (MZ header paragraphs .. end of image); Curse's executable is not EXEPACK'ed.
export function loadModule(exe) {
 need(exe,0x20,'executable');
 if (exe[0]!==0x4D || exe[1]!==0x5A) throw new Error('Invalid executable header');
 const size=u16(exe,2)?(u16(exe,4)-1)*512+u16(exe,2):u16(exe,4)*512;
 return exe.subarray(u16(exe,8)*16,Math.min(size,exe.length));
}
// Monster template: the base values the record holds (current-value fields of a template can be stale).
export function extractCharacter(b, ds) {
 need(b,CHAR_SIZE,'character record');
 return { name:pstr(b,0,15), stats: {
  'Race':pstr(ds,DS.race + b[0x74]*10,9), 'Class':pstr(ds,DS.cls + b[0x75]*27,26),
  'Level / hit dice':b[0xE5], 'Class levels':[...b.subarray(0x109,0x111)].map(signed).join('/'),
  'Maximum HP (record)':b[0x78], 'Base AC':60-b[0x124], 'Base THAC0':60-b[0x73],
  'Attacks per round':b[0x11C]/2, 'Base damage':`${dice(b,0x11E,0)} / ${dice(b,0x11E,1)}`,
  'Base movement':b[0xE4], 'Size':(b[0xDE]&0x7F)===2?'Large':'Small/medium', 'XP value':u16(b,0x13C),
 }, portrait:{head:b[0x13F],body:b[0x140]} };
}
export function extractItemType(b,id) {
 need(b,16,'ITEMS row');
 return { id:`itemType:${id}`, kind:'itemType', name:`Item type ${id}`, type:id, whereMet:[], stats:{
  'Equipment slot code':b[0], 'Hands':b[1], 'Damage vs large':`${b[2]}d${b[3]}${signed(b[4]) >= 0 ? '+' : ''}${signed(b[4])}`,
  'AC value':b[6], 'Damage vs small/medium':`${b[9]}d${b[10]}${signed(b[11]) >= 0 ? '+' : ''}${signed(b[11])}`, 'Missile range':b[12], 'Class mask':b[13],
 } };
}
// BuildItemName 6200:0467: words +31h, +30h, +2Fh in that order, word k hidden when +35h bit (3 - k) is set.
export function itemWords(b) { const w=[];for (let k=3;k>=1;k--) if (b[0x2E+k] && !(b[0x35] & (1 << (3-k)))) w.push(b[0x2E+k]);return w; }
export function extractItem(b,ds) {
 need(b,ITEM_SIZE,'item');
 const words=itemWords(b).map(w => pstr(ds,DS.word+w*21,20)).filter(Boolean);
 // The +00h string of a DAX item is an authoring left-over and a stored name can carry hidden words: never shown.
 const name=words.join(' ') || 'Unidentified item';
 const stats={'Weight':u16(b,0x37),'Count':b[0x39] || 1,'Readied':!!b[0x34]};
 if (!b[0x35]) { stats['Magic bonus']=signed(b[0x32]); stats['Value (gp)']=u16(b,0x3A); }
 return {name,type:b[0x2E],identified:b[0x35] === 0,stats};
}
export function splitRecords(bytes,size,label) {
 if (!bytes) return [];
 if (bytes.length % size) throw new Error(`Invalid ${label} record length`);
 return Array.from({length:bytes.length/size},(_,i) => bytes.subarray(i*size,(i+1)*size));
}
export function extractEffects(bytes) {
 return splitRecords(bytes,EFFECT_SIZE,'effect').map(b => ({type:b[0],duration:u16(b,1),parameter3:b[3],parameter4:b[4]}));
}
const SPELL_CLASS = ['Cleric','Druid','Magic-user'];
const perLevel = (base,per) => per ? `${base} + ${per} per level` : String(base);
// Ids without a name are item / monster powers; they get no entry and no invented name.
export function extractSpells(ds) {
 need(ds,DS.spellTable+(SPELL_IDS+1)*16,'spell table');
 const out=[];
 for (let id=1;id<=SPELL_IDS;id++) {
  const name=pstr(ds,DS.spellName+id*0x29,40);if(!name) continue;
  const b=ds.subarray(DS.spellTable+id*16,DS.spellTable+(id+1)*16);
  out.push({id:`spell:${id}`,kind:'spell',spellId:id,name,whereMet:[],stats:{
   'Class':SPELL_CLASS[b[0]] || 'Item/monster power','Level':b[1],
   'Range':perLevel(b[2],b[3]),'Duration':perLevel(b[4],b[5]),'Area code':b[6],
   'Target mode code':b[7],'Save effect code':b[8],'Saving throw type':b[9],'Effect type':b[10],
  }});
 }
 return out;
}
// Character-record spell evidence: known_spell[id] = +78h+id, mem_spell[0..83] = +1Eh (bit 7 = still to memorise).
export function spellEvidence(b) {
 const ids=new Set();if (!(b instanceof Uint8Array) || b.length!==CHAR_SIZE) return ids;
 for (let id=1;id<=SPELL_IDS;id++) if (b[0x78+id]) ids.add(id);
 for (const m of b.subarray(0x1E,0x72)) if (m>0 && m<=SPELL_IDS) ids.add(m);
 return ids;
}
