import {hooks} from '../hooks.js';
import {createMapTracker} from '../map/fog.js';
import {applyMapOverlay} from '../map/overlay.js';
const trackers=new WeakMap(),registrations=new WeakMap();
import {currentMapContext,loadCurrentMap} from '../map/load.js';
import {geoCanvas,DIRECTIONS} from '../map/geo.js';
import {overlandCanvas,overlandMarks} from '../map/overland.js';
export function registerMapTab(plus,{context,load=loadCurrentMap,tracker,profile='cab',bus=hooks}={}) {   // cab: param
 if(!tracker){if(!trackers.has(plus))trackers.set(plus,createMapTracker({bus,profile,enabled:()=>bus.enabled!==false&&plus.enabled('automap')}));tracker=trackers.get(plus);}
 context??=()=>currentMapContext({bus,bigPic:tracker.bigPic});   // cab: the overland is known from the last bigPicShown
 registrations.get(plus)?.();
 let zoom=1,unsubscribe;registrations.set(plus,()=>unsubscribe?.());
 plus.registerTab('map',container=>{
  unsubscribe?.();if(plus.enabled('automap'))tracker.sync?.();
  const host=document.createElement('section');container.append(host);
  if(!plus.enabled('automap')){host.textContent=plus.settings.original?'Map is off in original-game mode.':'Map is off. Enable Automap in Helpers to view it.';return;}
  const heading=document.createElement('h2');heading.textContent='Map';host.append(heading);
  const controls=document.createElement('div'),zoomLabel=document.createElement('label'),range=document.createElement('input'),readout=document.createElement('span');
  range.type='range';range.min='.5';range.max='3';range.step='.25';range.value=String(zoom);range.setAttribute('aria-label','Map zoom');zoomLabel.append(document.createTextNode('Zoom '),range,readout);controls.append(zoomLabel);
  const refresh=document.createElement('button');refresh.textContent='Refresh current area';controls.append(refresh);host.append(controls);
  const status=document.createElement('p');status.setAttribute('role','status');host.append(status);
  const viewport=document.createElement('div');viewport.tabIndex=0;viewport.setAttribute('aria-label','Scrollable map');Object.assign(viewport.style,{overflow:'auto',maxHeight:'55vh',maxWidth:'100%',background:'#000'});host.append(viewport);
  const info=document.createElement('p');info.textContent='North is up. Point at a visited cell for details.';   // cab: no click-to-travel yet (plus request #10)
 host.append(info);
  const legend=document.createElement('p');host.append(legend);let canvas,revision=0;
  function size(){readout.textContent=` ${Math.round(zoom*100)}%`;if(canvas){canvas.style.width=`${canvas.width*zoom}px`;canvas.style.height=`${canvas.height*zoom}px`;canvas.style.imageRendering='pixelated';}}
  range.oninput=()=>{zoom=Number(range.value);size();};size();
  async function update() {
   const request=++revision;status.textContent='Reading current area…';refresh.disabled=true;
   try {
    const snapshot=await context(),model=await load(snapshot);await tracker.flush();
    if(request!==revision || !container.contains(host))return;
    const discovered=tracker.snapshot(model.context),columns=16,rows=16;
    canvas=model.kind==='geo'?geoCanvas(model.cells):overlandCanvas(model,discovered);   // cab: overland = BIGPIC 121 + visited locations
    if(model.kind==='geo')applyMapOverlay(canvas,discovered,columns,rows);
    host.querySelector('[data-map-progress]')?.remove();
    viewport.replaceChildren(canvas);size();status.textContent=model.kind==='geo'?`${model.label} — 3D map ${model.source.record}, 16 × 16, north up`:`${model.label} — the overland (${model.source.file} picture ${model.source.record})`;
    legend.textContent=model.kind==='geo'?'White: wall slot 1 · Cyan: slot 2 · Yellow: slot 3 · Thin line: open passage in a wall · Red: locked door · Magenta: wizard-locked door · Grey: passage state without a wall type. Shading and hex labels show the script-defined cell attribute (blue when bit 7 is set). Each side is drawn separately; neighbouring sides can differ.':'The overland picture from your game files. Blue rings: places you have been. Gold ring and arrow: the party.';
    const progress=document.createElement('p');progress.dataset.mapProgress='true';progress.textContent=`${discovered.visited.size} ${model.kind==='geo'?'cells':'places'} visited in save slot ${tracker.slot}. Unvisited cells are hidden. Gold arrow: party and facing.${tracker.sessionOnly?' Changes are kept for this session.':''}`;viewport.after(progress);
    canvas.onpointermove=event=>{
     const rect=canvas.getBoundingClientRect(),x=Math.floor((event.clientX-rect.left)/rect.width*canvas.width/24),y=Math.floor((event.clientY-rect.top)/rect.height*canvas.height/24);
     if(model.kind!=='geo'){const px=(event.clientX-rect.left)/rect.width*canvas.width,py=(event.clientY-rect.top)/rect.height*canvas.height,m=overlandMarks(model,discovered).find(l=>Math.abs(l.x+4-px)<8&&Math.abs(l.y+4-py)<8);info.textContent=m?`Place ${m.index}${m.current?' (the party is here)':''}`:'North is up.';return;}   // cab
     if(!discovered.visited.has(y*columns+x)){info.textContent='Unvisited cell.';return;}
     {const cell=model.cells[y*16+x];if(x<0||x>=16||y<0||y>=16||!cell)return;info.textContent=`(${x}, ${y}) · Attribute 0x${cell.attr.toString(16).padStart(2,'0')} · `+DIRECTIONS.map((dir,i)=>`${dir}: wall ${cell.wall[i]}, state ${cell.door[i]}`).join(' · ');}
    };
   }catch(error){if(request===revision && container.contains(host)){viewport.replaceChildren();status.textContent=`Map unavailable: ${error.message}`;}}
   finally{if(request===revision)refresh.disabled=false;}
  }
  refresh.onclick=()=>{void update();};unsubscribe=tracker.onChange(()=>{if(container.contains(host)&&plus.enabled('automap'))void update();});void update();
 });
 return {tracker,dispose(){unsubscribe?.();tracker.dispose();trackers.delete(plus);}};
}
