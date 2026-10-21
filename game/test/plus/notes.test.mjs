import test from 'node:test';
import assert from 'node:assert/strict';
import {createNotesTracker} from '../../plus/notes/tracker.js';
import {parseJournal,readJournalPDF} from '../../plus/journal/import.js';
import {exportNotes,getNotesPins} from '../../plus/notes/export.js';
function bus(){const listeners=new Set();return {enabled:true,state:{slot:'A',position:()=>({dataset:3,block:0,map3d:4,travelMode:1,x:2,y:5}),clock:()=>({day:1,text:'12:30'})},on(_,fn){listeners.add(fn);return()=>listeners.delete(fn);},emit(name,p){if(['saveLoaded','gameSaved'].includes(name))this.state.slot=p.slot;for(const fn of listeners)fn(p,name);}};}
function storage(){const data=new Map();return {factory:({profile,slot})=>({async get(k,f){await new Promise(r=>setTimeout(r,1));return structuredClone(data.get(JSON.stringify([profile,slot,k]))??f);},async set(k,v){data.set(JSON.stringify([profile,slot,k]),structuredClone(v));return true;}})};}
test('observed text grouped and deduplicated, first visits, talks, treasure and fight metadata',async()=>{
 const b=bus(),t=createNotesTracker({bus:b,storeFactory:storage().factory});
 b.emit('areaEntered',{dataset:3,block:0});b.emit('textPrinted',{text:'Synthetic scene',clear:true});b.emit('textPrinted',{text:'Synthetic scene'});b.emit('journalRef',{n:9,kind:'entry'});b.emit('textPrinted',{text:'continued'});b.emit('textPrinted',{text:'continued'});
 b.emit('npcTalk',{text:'Synthetic talk',choice:'PARLAY'});b.emit('treasure',{items:[{name:'Synthetic item'}],money:[0,0,0,2]});b.emit('combatEnd',{result:'won',xp:25});b.emit('areaEntered',{dataset:3,block:0});await t.flush();
 assert.deepEqual(t.notes.filter(n=>n.kind==='text').map(n=>n.text),['Synthetic scene continued']);assert.deepEqual(t.notes.filter(n=>n.kind==='area').map(n=>n.firstVisit),[true,false]);assert.match(t.notes.find(n=>n.kind==='fight').text,/25/);assert.match(t.notes.find(n=>n.kind==='treasure').text,/2 gp/);assert.equal(t.notes[0].time.text,'12:30');assert.equal(t.notes[0].place.x,2);t.dispose();
});
test('queued slot switches, save-as, reload, profile isolation, scoped pins and ZIP paths',async()=>{
 const b=bus(),s=storage(),t=createNotesTracker({bus:b,storeFactory:s.factory});
 await t.addNote('Synthetic A',{pin:true});b.emit('saveLoaded',{slot:'B'});await t.addNote('Synthetic B');await t.flush();assert.deepEqual(t.notes.map(n=>n.text),['Synthetic B']);
 b.emit('saveLoaded',{slot:'A'});await t.flush();assert.equal(t.pins().length,1);b.emit('gameSaved',{slot:'C'});await t.flush();assert.equal(t.notes[0].text,'Synthetic A');
 const restored=createNotesTracker({bus:b,storeFactory:s.factory});await restored.flush();assert.equal(restored.notes[0].text,'Synthetic A');const other=createNotesTracker({bus:b,profile:'other',storeFactory:s.factory});await other.flush();assert.equal(other.notes.length,0);
 assert.equal((await getNotesPins({slot:'A',dataset:3,mapId:4,storeFactory:s.factory})).length,1);assert.equal((await getNotesPins({slot:'B',dataset:3,storeFactory:s.factory})).length,0);
 const files=await exportNotes({storeFactory:s.factory});assert.deepEqual(files.map(f=>f.name),['plus/notes-A.json','plus/notes-B.json','plus/notes-C.json']);assert.equal(JSON.parse(new TextDecoder().decode(files[0].bytes)).notes[0].text,'Synthetic A');[t,restored,other].forEach(t=>t.dispose());
});
test('fake imported journal stays hidden until referenced, including across slot changes',async()=>{
 const b=bus(),t=createNotesTracker({bus:b,storeFactory:storage().factory});const entries=parseJournal('Entry 1\nSynthetic first\n2. Synthetic second\nProclamation IV\nSynthetic fourth');await t.importEntries(entries);
 assert.equal(t.entry('entry:1'),null);b.emit('journalRef',{n:1,kind:'entry'});b.emit('journalRef',{n:4,kind:'proclamation',id:'IV'});await t.flush();assert.equal(t.entry('entry:1'),'Synthetic first');assert.equal(t.entry('entry:2'),null);assert.equal(t.entry('proclamation:IV'),'Synthetic fourth');
 b.emit('saveLoaded',{slot:'B'});await t.flush();assert.equal(t.entry('entry:1'),null);t.dispose();
});
test('original mode disables recording; authoritative slot reconciles; quota fallback survives',async()=>{
 const b=bus(),t=createNotesTracker({bus:b,storeFactory:()=>({get:async(_,f)=>f,set:async()=>false})});b.enabled=false;b.emit('textPrinted',{text:'hidden'});await t.flush();assert.equal(t.notes.length,0);b.state.slot='B';b.enabled=true;b.emit('textPrinted',{text:'Synthetic visible'});await t.flush();assert.equal(t.slot,'B');assert.equal(t.sessionOnly,true);assert.equal(t.notes.length,1);t.dispose();
});
test('PDF extracts numbered text locally and destroys document, using fake content only',async()=>{
 let destroyed=false;const entries=await readJournalPDF({arrayBuffer:async()=>new ArrayBuffer(1)},{pdfjs:{getDocument(options){assert.equal(options.isEvalSupported,false);return {promise:Promise.resolve({numPages:1,getPage:async()=>({getTextContent:async()=>({items:[{str:'Entry 7',hasEOL:true},{str:'Synthetic PDF entry',hasEOL:true}]}),cleanup(){}}),destroy:async()=>{destroyed=true;}})};}}});assert.equal(entries['entry:7'],'Synthetic PDF entry');assert.equal(destroyed,true);
});
