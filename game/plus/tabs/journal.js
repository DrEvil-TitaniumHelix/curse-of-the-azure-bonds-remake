import {hooks} from '../hooks.js';
import {createNotesTracker} from '../notes/tracker.js';
import {parseJournal,readJournalPDF} from '../journal/import.js';
const trackers=new WeakMap();
export function registerJournalTab(plus,{tracker,profile='cab',bus=hooks}={}) {   // cab: param
 if(!tracker){if(!trackers.has(plus))trackers.set(plus,createNotesTracker({bus,profile,enabled:()=>bus.enabled!==false&&!plus.settings.original}));tracker=trackers.get(plus);}
 let off;
 plus.registerTab('journal',container=>{
  off?.();const h=document.createElement('h2');h.textContent='Journal';container.append(h);
  if(plus.settings.original){container.append(document.createTextNode('Journal is off in original-game mode.'));return;}
  tracker.sync();const status=document.createElement('p'),list=document.createElement('div');status.setAttribute('role','status');
  const personal=document.createElement('textarea');personal.tabIndex=0;personal.setAttribute('aria-label','Your note');
  const pin=document.createElement('input');pin.type='checkbox';const label=document.createElement('label');label.append(pin,document.createTextNode('Pin to current map cell'));
  const add=document.createElement('button');add.textContent='Add note';add.onclick=async()=>{await tracker.addNote(personal.value,{pin:pin.checked});personal.value='';};
  // cab: the entries the game has cited (journalRef, all 46 sites of decode/ecl/JOURNAL_REFS.md): number, when, where and the
  // cited line; the entry text only if the player supplied it (CR-1 A). Entries never cited stay hidden.
  const citedHead=document.createElement('h3');citedHead.textContent='Journal entries the game has cited';const cited=document.createElement('div');cited.id='cab-plus-cited';
  const diaryHead=document.createElement('h3');diaryHead.textContent='Diary';
  container.append(status,citedHead,cited,diaryHead,personal,label,add,list);
  const imports=document.createElement('details'),summary=document.createElement('summary');summary.tabIndex=0;summary.textContent='Import your Adventurer’s Journal';imports.append(summary);
  const help=document.createElement('p');help.textContent='Import your own PDF or paste numbered entries (Entry 1, 1., or Proclamation I). Text is stored in this save slot and shown only after the game references it. PDF parsing runs locally; pdf.js is downloaded when needed. No journal text is bundled.';
  const paste=document.createElement('textarea');paste.tabIndex=0;paste.setAttribute('aria-label','Paste journal entries');
  const message=document.createElement('p');message.setAttribute('role','status');
  async function importEntries(entries){const count=Object.keys(entries).length;if(!count)throw Error('No numbered entries found. Use headings such as Entry 1.');await tracker.importEntries(entries);message.textContent=`Imported ${count} entries into slot ${tracker.slot}.`;}
  const save=document.createElement('button');save.textContent='Import pasted entries';save.onclick=async()=>{try{await importEntries(parseJournal(paste.value));paste.value='';}catch(e){message.textContent=e.message;}};
  const pdf=document.createElement('input');pdf.type='file';pdf.accept='application/pdf,.pdf';pdf.setAttribute('aria-label','Import journal PDF');
  pdf.onchange=async()=>{const file=pdf.files?.[0],targetSlot=tracker.slot;if(!file)return;pdf.disabled=true;message.textContent='Reading PDF…';try{const entries=await readJournalPDF(file);tracker.sync();if(tracker.slot!==targetSlot)throw Error('Save slot changed; import again in the intended slot');await importEntries(entries);}catch(e){message.textContent=`PDF import failed: ${e.message}. You can paste entries instead.`;}finally{pdf.disabled=false;pdf.value='';}};
  imports.append(help,paste,save,pdf,message);container.append(imports);
  let slot=tracker.slot;
  const where=c=>[c.dataset!=null&&c.block!=null?`ECL${c.dataset}/${c.block}`:null,c.place&&Number.isInteger(c.place.x)?`${c.place.x},${c.place.y}`:null,c.addr!=null?`script ${Number(c.addr).toString(16).toUpperCase()}h`:null].filter(Boolean).join(', ')||'Place unavailable';
  const when=c=>c.time?`Day ${c.time.day??'?'}, ${c.time.text||c.clock||''}`:(c.clock||'Time unavailable');
  function renderCited(){cited.replaceChildren();const all=tracker.cited();
   if(!all.length){const p=document.createElement('p');p.textContent='No journal entry has been cited in this save slot yet. Entries appear here when the game tells you to read them.';cited.append(p);return;}
   for(const e of all){
    const article=document.createElement('article');article.dataset.entry=e.key;const h=document.createElement('h4');h.textContent=e.kind==='entry'?`Entry ${e.n}`:`Proclamation ${e.n}`;article.append(h);
    for(const c of e.citations){const meta=document.createElement('small'),line=document.createElement('p');meta.textContent=`${when(c)} · ${where(c)}`;line.textContent=c.line;article.append(meta,line);}
    if(e.text){const d=document.createElement('details'),s=document.createElement('summary'),body=document.createElement('p');s.tabIndex=0;s.textContent='Your journal text';body.textContent=e.text;body.style.whiteSpace='pre-wrap';d.append(s,body);article.append(d);}
    else{const d=document.createElement('details'),s=document.createElement('summary'),area=document.createElement('textarea'),b=document.createElement('button');s.tabIndex=0;s.textContent='Add the text from your own journal';area.setAttribute('aria-label',`Text of ${h.textContent}`);b.textContent='Save';b.onclick=()=>tracker.setEntry(e.key,area.value);d.append(s,area,b);article.append(d);}
    cited.append(article);
   }
  }
  function update(){if(!container.contains(list))return;renderCited();if(slot!==tracker.slot){slot=tracker.slot;personal.value='';paste.value='';message.textContent='';}status.textContent=`Save slot ${tracker.slot}. ${tracker.notes.length} notes.${tracker.sessionOnly?' Changes are kept for this session.':''}${tracker.error?' Storage: '+tracker.error:''}`;list.replaceChildren();
   for(const note of tracker.notes.slice().reverse()){
    const article=document.createElement('article'),meta=document.createElement('small'),text=document.createElement('p');
    const p=note.place,t=note.time;meta.textContent=[t?`Day ${t.day??'?'}, ${t.text||''}`:'Time unavailable',p?`Area ${p.dataset}, block ${p.block}, ${p.x},${p.y}`:'Place unavailable',note.kind,note.pin?'Map pin':''].filter(Boolean).join(' · ');
    text.textContent=note.text;article.append(meta,text);
    if(note.reference){const entry=tracker.entry(note.reference);if(entry){const d=document.createElement('details'),s=document.createElement('summary'),body=document.createElement('p');s.tabIndex=0;s.textContent='Read imported entry';body.textContent=entry;body.style.whiteSpace='pre-wrap';d.append(s,body);article.append(d);}else article.append(document.createTextNode('Import your journal to read this entry.'));}
    list.append(article);
   }
  }
  off=tracker.onChange(update);update();
 });
 return {tracker,dispose(){off?.();tracker.dispose();trackers.delete(plus);}};
}
