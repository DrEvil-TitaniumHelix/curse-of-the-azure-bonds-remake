import {hooks} from '../hooks.js';
import {createPediaTracker} from '../pedia/reveal.js';
const trackers=new WeakMap(),registrations=new WeakMap();
import {buildPedia} from '../pedia/build.js';
import {searchEntries,discoveredEntry} from '../pedia/search.js';
import {pictureCanvas} from '../pedia/pictures.js';

export function renderEntry(container,entry,{picture}={}) {
 const article=document.createElement('article'),heading=document.createElement('h3');heading.textContent=entry.name;article.append(heading);
 if(picture) {const c=pictureCanvas(picture);c.setAttribute('role','img');c.setAttribute('aria-label',entry.name);article.append(c);}
 else {const p=document.createElement('p');p.textContent='No confirmed picture.';article.append(p);}
 const stats=document.createElement('dl');
 for(const [label,value] of Object.entries(entry.stats || {})) {const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=String(value);stats.append(dt,dd);}
 article.append(stats);
 const places=document.createElement('p');places.textContent='Where met: '+(entry.whereMet?.length?entry.whereMet.map(p => p.name || `Data set ${p.dataSet}, block ${p.block}`).join('; '):'No encounter recorded.');article.append(places);
 if(entry.note) {const p=document.createElement('p');p.textContent=entry.note;article.append(p);}
 container.replaceChildren(article);
}
// Explicit revealed Maps remain supported for previews/tests; normal mounts use hook-driven slot ledgers.
export function registerPediaTab(plus,{load=buildPedia,revealed,tracker,profile='cab',bus=hooks}={}) {
 registrations.get(plus)?.();
 if(!tracker&&revealed===undefined){if(!trackers.has(plus))trackers.set(plus,createPediaTracker({bus,profile,load,enabled:()=>bus.enabled!==false&&!plus.settings.original}));tracker=trackers.get(plus);}
 let catalog,loading,query='',kind='all',unsubscribe,activeUpdate,lastSlot=tracker?.slot;registrations.set(plus,()=>unsubscribe?.());
 plus.registerTab('pedia',container => {
  unsubscribe?.();activeUpdate=null;if(!plus.settings.original)tracker?.sync();
  const heading=document.createElement('h2');heading.textContent='Gold Box-pedia';container.append(heading);
  if(plus.settings.original) {const p=document.createElement('p');p.textContent='Pedia is off in original-game mode.';container.append(p);return;}
  const input=document.createElement('input');input.type='search';input.placeholder='Search discoveries';input.setAttribute('aria-label','Search discoveries');input.value=query;
  const filter=document.createElement('select');filter.tabIndex=0;filter.setAttribute('aria-label','Entry category');
  for(const [value,label] of [['all','All'],['monster','Monsters'],['npc','People'],['item','Items'],['itemType','Item types'],['spell','Spells'],['place','Places']]) {const o=document.createElement('option');o.value=value;o.textContent=label;filter.append(o);}filter.value=kind;
  const status=document.createElement('p');status.setAttribute('role','status');
  const results=document.createElement('div'),detail=document.createElement('div');container.append(input,filter,status,results,detail);
  const guides=document.createElement('details'),summary=document.createElement('summary');summary.textContent='How to read these entries';guides.append(summary);
  for(const [file,title] of [['discoveries','Discoveries and save slots'],['monster-records','Monster records'],['items','Items and identification'],['spells','Known and memorised spells'],['places','Places']]) {const a=document.createElement('a');a.href=new URL(`../pedia/howto/${file}.md`,import.meta.url);a.textContent=title;a.target='_blank';a.rel='noopener';const p=document.createElement('p');p.append(a);guides.append(p);}container.append(guides);
  let revision=0;
  function update() {
   if(!container.contains(results)) return;
   ++revision;detail.replaceChildren();results.replaceChildren();
   if(!catalog) {status.textContent='Reading your imported game files…';return;}
   if(tracker&&tracker.slot!==lastSlot){lastSlot=tracker.slot;query='';kind='all';input.value='';filter.value='all';}
   const ledger=tracker?tracker.revealed:(revealed||new Map()),entries=[...catalog.entries,...(tracker?.entries||[]).filter(e=>!catalog.entries.some(c=>c.id===e.id))];
   const found=searchEntries(entries,query,{revealed:ledger,kind});status.textContent=`${found.length} discoveries. Entries appear after you meet, visit or see them.${tracker?' Save slot '+tracker.slot+'.':''}${tracker?.sessionOnly?' Changes are kept for this session.':''}`;
   for(const entry of found) {const b=document.createElement('button');const visible=discoveredEntry(entry,ledger.get(entry.id));b.textContent=visible.name;b.onclick=async () => {
    const selected=++revision;renderEntry(detail,visible);
    try {const pic=visible.picture?await catalog.picture(visible.picture):null;if(selected===revision && container.contains(detail)) renderEntry(detail,visible,{picture:pic});} catch { /* keep entry and no-picture fallback */ }
   };results.append(b);}
  }
  input.oninput=()=>{query=input.value;update();};filter.onchange=()=>{kind=filter.value;update();};
  activeUpdate=update;unsubscribe=tracker?.onChange(update);update();
  if(!loading) loading=Promise.resolve().then(()=>tracker?tracker.catalog():load()).then(result => {catalog=result;return result;}).catch(error=>{loading=null;throw error;});
  loading.then(async()=>{await tracker?.flush();update();}).catch(error=>{if(container.contains(status)) status.textContent=`Pedia unavailable: ${error.message}`;});
 });
 return {tracker,refresh(){activeUpdate?.();},dispose(){unsubscribe?.();tracker?.dispose();trackers.delete(plus);registrations.delete(plus);}};
}
