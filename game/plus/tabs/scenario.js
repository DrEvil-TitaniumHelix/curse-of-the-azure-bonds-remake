// cab: the map editor stays a stub for Curse (S7): it edits a private draft and exports it inside a cab-scenario JSON.
import {currentMapContext,loadCurrentMap} from '../map/load.js';
import {geoCanvas,DIRECTIONS} from '../map/geo.js';
import {createMapDraft,editSide,exportScenario} from '../scenario/model.js';
export function registerScenarioTab(plus,{context=()=>currentMapContext({bigPic:globalThis.goldBoxPlusTabs?.map?.tracker?.bigPic??null}),load=loadCurrentMap}={}){   // cab: param
 let draft=null,start={},revision=0;
 const api={get draft(){return draft?structuredClone(draft):null;},export(){if(!draft)throw Error('Open or create a map first');return exportScenario(draft,start);}};
 plus.registerTab('scenario',container=>{
  ++revision;const h=document.createElement('h2');h.textContent='Scenario workshop';container.append(h);
  if(plus.settings.original){container.append(document.createTextNode('Scenario workshop is off in original-game mode.'));return;}
  const intro=document.createElement('p');intro.textContent='Edit a private copy of one 16 × 16 map. North, east, south and west sides are independent; neighbours may differ. Export a draft to keep your work.';container.append(intro);
  const status=document.createElement('p');status.setAttribute('role','status');
  const open=document.createElement('button');open.textContent='Open current map';const blank=document.createElement('button');blank.textContent='New blank map';container.append(open,blank,status);
  const controls=document.createElement('div');const fields={};
  function number(name,max){const label=document.createElement('label'),input=document.createElement('input');input.type='number';input.min='0';input.max=String(max);input.value='0';input.setAttribute('aria-label',name);label.append(document.createTextNode(name+' '),input);controls.append(label);fields[name]=input;return input;}
  const x=number('Cell X',15),y=number('Cell Y',15);
  const side=document.createElement('select');side.tabIndex=0;side.setAttribute('aria-label','Side');for(let i=0;i<4;i++){const o=document.createElement('option');o.value=String(i);o.textContent=DIRECTIONS[i];side.append(o);}controls.append(side);
  const wall=number('Wall type',15),door=number('Passage state',3),apply=document.createElement('button');apply.textContent='Apply side';controls.append(apply);container.append(controls);
  const legend=document.createElement('p');legend.textContent='Wall 0: none; 1–15: wall textures. Passage 0: closed; 1: open; 2: locked; 3: wizard-locked. Apply changes only the selected side; attributes are preserved.';container.append(legend);
  const viewport=document.createElement('div');viewport.style.overflow='auto';viewport.style.maxHeight='50vh';viewport.tabIndex=0;viewport.setAttribute('aria-label','Editable map preview');container.append(viewport);
  const output=document.createElement('textarea');output.tabIndex=0;output.readOnly=true;output.setAttribute('aria-label','Exported scenario JSON');
  const exportButton=document.createElement('button');exportButton.textContent='Export scenario JSON';const download=document.createElement('button');download.textContent='Download JSON';container.append(exportButton,download,output);
  function selected(){return draft?.cells[Number(y.value)*16+Number(x.value)];}
  function inspect(){const c=selected();if(!c)return;wall.value=String(c.wall[Number(side.value)]);door.value=String(c.door[Number(side.value)]);}
  function render(){viewport.replaceChildren();for(const e of [apply,exportButton,download])e.disabled=!draft;if(!draft)return;const canvas=geoCanvas(draft.cells);canvas.style.imageRendering='pixelated';canvas.setAttribute('aria-label','Scenario draft map, north up');canvas.onclick=e=>{const r=canvas.getBoundingClientRect();x.value=String(Math.min(15,Math.max(0,Math.floor((e.clientX-r.left)/r.width*16))));y.value=String(Math.min(15,Math.max(0,Math.floor((e.clientY-r.top)/r.height*16))));inspect();};viewport.append(canvas);inspect();}
  x.onchange=y.onchange=side.onchange=inspect;
  apply.onclick=()=>{if(plus.settings.original)return;try{draft=editSide(draft,{x:Number(x.value),y:Number(y.value),side:Number(side.value),wall:Number(wall.value),door:Number(door.value)});output.value='';render();status.textContent='Draft updated in memory.';}catch(e){status.textContent=e.message;}};
  blank.onclick=()=>{if(plus.settings.original)return;++revision;draft=createMapDraft();start={};output.value='';render();status.textContent='Blank draft created in memory.';};
  async function openCurrent(){const request=++revision;open.disabled=true;status.textContent='Reading current map…';try{const c=await context(),model=await load(c);if(model.kind!=='geo')throw Error('This workshop edits GEO maps; overland editing is not available.');if(request!==revision||!container.contains(viewport)||plus.settings.original)return;draft=createMapDraft(model);start={dataset:c.dataset,block:c.block,map:c.mapId,x:c.x,y:c.y,facing:c.facing??((c.dir||0)>>1)};output.value='';render();status.textContent=`Draft copied from ${model.source.file}, record ${model.source.record}.`;}catch(e){if(request===revision&&container.contains(viewport))status.textContent=e.message;}finally{open.disabled=false;}}
  open.onclick=()=>void openCurrent();
  exportButton.onclick=()=>{if(plus.settings.original)return;try{output.value=JSON.stringify(api.export(),null,2);status.textContent='Scenario draft exported below. Download JSON to keep it.';}catch(e){status.textContent=e.message;}};
  download.onclick=()=>{if(plus.settings.original)return;exportButton.click();if(!output.value)return;const url=URL.createObjectURL(new Blob([output.value+'\n'],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='scenario-draft.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  render();if(!draft)void openCurrent();
 });return api;
}
