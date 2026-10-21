import {hooks} from '../hooks.js';
import {createScopedLedger,saveSlot} from '../map/ledger.js';
import {referenceKey} from '../journal/import.js';
// Diary design inspired by Darklands+ (MIT), port/ui/quests.cpp and battlelog.cpp.
// cab: + citations (entry key -> where / when the game cited it, CR-1: the cited line is the player's own game text, kept in
// their store only); entry text comes only from the player (importEntries / setEntry) and is shown only once cited.
const empty=()=>({version:1,notes:[],visits:[],references:[],citations:{},entries:{},scene:0,next:1});
const FROM={curse:'a Curse character file',pool:'Pool of Radiance',hillsfar:'Hillsfar'};
export function createNotesTracker({bus=hooks,profile='cab',storeFactory,enabled=()=>bus.enabled!==false}={}) {
 const ledger=createScopedLedger({profile,key:'notes',empty,storeFactory,slot:saveSlot(bus.state.slot),decode:v=>v?.version===1&&Array.isArray(v.notes)?{...empty(),...v,citations:v.citations||{}}:empty()});
 ledger.use(ledger.slot);
 function sync(){const slot=saveSlot(bus.state.slot);if(slot!==ledger.slot)ledger.use(slot);}
 function snapshot(){const p=bus.state.position?.();return {time:structuredClone(bus.state.clock?.()??null),place:p?{dataset:p.dataset,block:p.block,mapId:p.map3d,travelMode:p.travelMode,x:p.travelMode>1?(bus.state.mem?.(0x49C3)??p.x):p.x,y:p.travelMode>1?(bus.state.mem?.(0x49C4)??p.y):p.y}:null};}
 function add(value,kind,text,meta,extra={}){value.notes.push({id:value.next++,scene:value.scene,...meta,kind,text,...extra});}
 const off=bus.on('*',(payload,name)=>{
  if(name==='saveLoaded'){ledger.use(saveSlot(payload.slot));return;}
  if(name==='gameSaved'){if(enabled())ledger.saveAs(saveSlot(payload.slot));else ledger.use(saveSlot(payload.slot));return;}
  sync();if(!enabled())return;
  if(!['textPrinted','areaEntered','npcTalk','treasure','journalRef','combatEnd','characterImported','npcLeft'].includes(name))return;   // cab: + PER-8 events
  const p=structuredClone(payload),meta=snapshot();
  ledger.change(v=>{
   if(name==='textPrinted'){
    const text=String(p.text??'').replace(/\s+/g,' ').trim();if(!text)return false;
    if(p.clear)v.scene++;
    const previous=v.notes.at(-1),group=v.notes.findLast(n=>n.kind==='text'&&n.scene===v.scene&&JSON.stringify(n.place)===JSON.stringify(meta.place));
    if(group){
     if(group.parts.includes(text))return false;
     group.parts.push(text);group.text=group.parts.join(' ');return;
    }
    // Consecutive redraws of an identical PRINTCLEAR scene are not new diary entries.
    if(previous?.kind==='text'&&previous.text===text&&JSON.stringify(previous.place)===JSON.stringify(meta.place))return false;
    add(v,'text',text,meta,{parts:[text]});
   }else if(name==='areaEntered'){
    v.scene++;const key=JSON.stringify([p.dataset,p.block]);const firstVisit=!v.visits.includes(key);if(firstVisit)v.visits.push(key);
    add(v,'area',`${firstVisit?'First visit: ':'Entered '}ECL${p.dataset}/${p.block}${meta.time?.text?' at '+meta.time.text:''}`,meta,{firstVisit});   // cab: place + clock
   }else if(name==='journalRef'){
    if(!Number.isInteger(p.n)||p.n<1)return false;
    const ref={kind:p.kind==='proclamation'?'proclamation':'entry',n:p.n,...(p.id?{id:p.id}:{})},key=referenceKey(ref);
    if(!v.references.includes(key))v.references.push(key);
    // cab: one citation per site and game time (redraws of the same scene are not new citations)
    const cites=v.citations[key]||=[],at={time:meta.time,clock:p.clock??meta.time?.text??null,place:meta.place,dataset:p.dataset??meta.place?.dataset??null,block:p.block??meta.place?.block??null,addr:p.addr??null,scene:p.scene||'',line:String(p.text??'').replace(/\s+/g,' ').trim()};
    if(!cites.some(c=>c.addr===at.addr&&c.block===at.block&&JSON.stringify(c.time)===JSON.stringify(at.time)))cites.push(at);
    add(v,'journal',ref.kind==='entry'?`Journal entry ${p.n}`:`Journal proclamation ${p.id||p.n}`,meta,{reference:key});
   }else if(name==='npcTalk')add(v,'talk',[p.text,p.choice,p.result].filter(x=>x!==null&&x!==undefined&&x!=='').join(' — ')||'Conversation',meta);
   else if(name==='combatEnd')add(v,'fight',p.result!==undefined?`Fight: ${p.result}; XP ${p.xp??0} per character`:`Fight over: ${p.partyDead?'the party fell':'the party stands'}`,meta);   // cab: { partyDead, party }
   else if(name==='characterImported')add(v,'party',`${p.name||'A character'} joined the roster from ${FROM[p.from]||'a character file'}${p.file?' ('+p.file+')':''}`,meta);   // cab: PER-8
   else if(name==='npcLeft')add(v,'party',`${p.name||'A companion'} left the party`,meta);   // cab: PER-8
   else {
    const labels=['cp','sp','ep','gp','pp','gems','jewelry'];
    const text=[...(p.items||[]).map(i=>i.name||`Item type ${i.type}`),...(p.money||[]).flatMap((n,i)=>n?[`${n} ${labels[i]||'coins'}`]:[])].join(', ');
    if(!text)return false;add(v,'treasure',text,meta);
   }
  });
 });
 return {
  get slot(){return ledger.slot;},get notes(){return structuredClone(ledger.peek().notes);},get sessionOnly(){return ledger.sessionOnly;},get error(){return ledger.error;},
  sync,flush:()=>ledger.flush(),onChange:fn=>ledger.onChange(fn),dispose:off,
  entry(key){const v=ledger.peek();return v.references.includes(key)?v.entries[key]??null:null;},
  // cab: the entries the game has cited in this slot, in number order, with their citations and the player's text if any
  cited(){const v=ledger.peek();return v.references.map(key=>{const [kind,id]=key.split(':');return {key,kind,n:kind==='entry'?Number(id):id,citations:structuredClone(v.citations[key]||[]),text:v.entries[key]??null};}).sort((a,b)=>a.kind===b.kind?(a.kind==='entry'?a.n-b.n:String(a.n).localeCompare(String(b.n))):a.kind==='entry'?-1:1);},
  setEntry(key,text){sync();if(!/^(entry:\d+|proclamation:[IVXLCDM]+)$/.test(key))return Promise.resolve();return ledger.change(v=>{const t=String(text??'').trim();if(t)v.entries[key]=t;else delete v.entries[key];});},
  importEntries(entries){sync();return ledger.change(v=>{for(const [key,text] of Object.entries(entries))if(/^(entry:\d+|proclamation:[IVXLCDM]+)$/.test(key)&&typeof text==='string')v.entries[key]=text;});},
  addNote(text,{pin=false}={}){sync();if(!enabled()||!String(text).trim())return Promise.resolve();const meta=snapshot();return ledger.change(v=>add(v,'personal',String(text).trim(),meta,{pin:!!pin&&Number.isInteger(meta.place?.x)&&Number.isInteger(meta.place?.y)}));},
  pins(){return structuredClone(ledger.peek().notes.filter(n=>n.pin));},
  read:()=>ledger.read(),
 };
}
