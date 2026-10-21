import {createScopedLedger,saveSlot} from './ledger.js';
// cab: the Curse overland is one picture (BIGPIC 121) with 32 numbered locations: the location number is region-0 cell
// 4CA1 (view_ov27.js BigPicAnimSetPos, M); its spot is the DS tables 0A48 / 0A68. Visited = the location numbers seen.
export const OVERLAND_BIGPIC=121,LOCATION_CELL=0x4CA1,LOCATIONS=32;
export function mapPosition(p) {
 if(!p)return null;
 const dataset=p.dataset??p.dataSet,mode=p.travelMode,mapId=p.map3d??p.mapId;
 if(Number.isInteger(p.location)){if(!Number.isInteger(dataset)||dataset<1||dataset>8||p.location<0||p.location>=LOCATIONS)return null;return {key:`overland:${dataset}`,x:p.location,y:0,dir:0,dataset,block:p.block,location:p.location};}   // cab
 if(mode===undefined&&p.is3D!==true)return null;   // cab: Curse has no travel mode; a 2D area other than the overland has no map
 const overland=[2,3,4].includes(mode);
 if(!Number.isInteger(dataset)||dataset<1||dataset>8||(!overland && ((mode!==undefined&&mode!==1)||p.is3D!==true||!Number.isInteger(mapId)||mapId<0||mapId>255)))return null;
 if(!Number.isInteger(p.x)||p.x<0||p.x>=16||!Number.isInteger(p.y)||p.y<0||p.y>=(overland?36:16))return null;
 const dir=Number.isInteger(p.dir)&&p.dir>=0&&p.dir<8?p.dir:Number.isInteger(p.facing)&&p.facing>=0&&p.facing<4?p.facing*2:0;
 return {key:overland?`overland:${dataset}:${mode}`:`geo:${dataset}:${mapId}`,x:p.x,y:p.y,dir,dataset,block:p.block,travelMode:mode,mapId};
}
function decode(value){if(value?.version!==1||!value.maps||typeof value.maps!=='object')return null;const maps={};for(const [key,cells]of Object.entries(value.maps)){if(!/^(geo:[1-8]:\d{1,3}|overland:[1-8](:[234])?)$/.test(key)||!Array.isArray(cells))continue;const limit=key.startsWith('geo:')?256:/^overland:\d$/.test(key)?LOCATIONS:576;maps[key]=[...new Set(cells.filter(i=>Number.isInteger(i)&&i>=0&&i<limit))];}return {version:1,maps};}   // cab: overland:<set> = locations
export function createMapTracker({bus,profile='cab',storeFactory,enabled=()=>bus.enabled!==false}={}) {
 const ledger=createScopedLedger({profile,key:'map:visited',empty:()=>({version:1,maps:{}}),decode,storeFactory,slot:saveSlot(bus.state.slot)});
 let marker=null,markerSlot=ledger.slot,disposed=false,bigPic=null;   // cab: bigPic = the last BIGPIC loaded (bigPicShown)
const listeners=new Set();
 const notify=()=>{for(const fn of listeners){try{fn();}catch{/* display errors stay outside the engine */}}};
 const offLedger=ledger.onChange(notify);
 function capture(payload={}){
  const p={...bus.state.position(),...payload};
  if([2,3,4].includes(p.travelMode)){const x=bus.state.mem?.(0x49C3),y=bus.state.mem?.(0x49C4);if(Number.isInteger(x))p.x=x;if(Number.isInteger(y))p.y=y;}
  if(p.is3D===false&&bigPic===OVERLAND_BIGPIC){const loc=bus.state.mem?.(LOCATION_CELL);if(Number.isInteger(loc))p.location=loc&255;}   // cab
  return mapPosition(p);
 }
 function observe(payload){
  if(disposed||!enabled())return;
  const position=capture(payload);if(!position)return;
  const slot=saveSlot(bus.state.slot);if(slot!==ledger.slot){marker=null;void ledger.use(slot);}
  marker=position;markerSlot=ledger.slot;
  void ledger.change(value=>{const cells=value.maps[position.key]??=[];const index=position.location??position.y*16+position.x;if(cells.includes(index))return false;cells.push(index);return true;});notify();
 }
 const off=bus.on('*',(payload,name)=>{
  try {
   if(name==='saveLoaded'){marker=null;void ledger.use(saveSlot(payload.slot));}
   else if(name==='gameSaved'){markerSlot=saveSlot(payload.slot);if(enabled())void ledger.saveAs(markerSlot);else void ledger.use(markerSlot);}
   else if(name==='moved')observe(payload);
   // An arrival script may enter combat before showing an explore menu. Its
   // physical party position is authoritative; combat payload grid cells are not.
   else if(name==='combatStart')observe();
   else if(name==='areaEntered'){marker=null;notify();}
   else if(name==='bigPicShown'){bigPic=payload?.id??null;observe();}   // cab: PER-8
   else if(name==='menuDrawn'&&payload?.region==='hmenu'&&bigPic===OVERLAND_BIGPIC)observe();   // cab: any menu waiting over the overland picture
   // areaEntered precedes ECL initialization. Only the player-ready explore menu
   // reconciles script placement; viewDrawn also includes unvisited tour previews.
   else if(name==='menuDrawn'&&payload?.region==='hmenu'&&payload.items?.some(item=>/^Encamp$/i.test(item.label)))observe();
  }catch{/* malformed events cannot interrupt the engine */}
 });
 void ledger.use(ledger.slot);
 if(!bus.state.partyCount || bus.state.partyCount()>0)observe(bus.state.position());
 return {
  get slot(){return ledger.slot;},get bigPic(){return bigPic;},get sessionOnly(){return ledger.sessionOnly;},get error(){return ledger.error;},
  sync(){const slot=saveSlot(bus.state.slot);if(slot!==ledger.slot){marker=null;void ledger.use(slot);}observe(bus.state.position());},flush:()=>ledger.flush(),onChange(fn){listeners.add(fn);return ()=>listeners.delete(fn);},
  snapshot(context){const position=mapPosition(context),key=position?.key;if(!key)return {visited:new Set(),marker:null};return {visited:new Set(ledger.peek().maps[key]||[]),marker:markerSlot===ledger.slot&&marker?.key===key?{...marker}:null};},
  dispose(){disposed=true;off();offLedger();listeners.clear();},
 };
}
