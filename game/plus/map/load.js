import {archiveRecords} from '../pedia/build.js';
import {loadModule} from '../pedia/records.js';
import {decodePicture} from '../pedia/pictures.js';
import {hooks} from '../hooks.js';
import {parseGeo} from './geo.js';
import {OVERLAND_BIGPIC,LOCATION_CELL,LOCATIONS} from './fog.js';
// Read-only map geometry snapshot; hook-driven visited state lives in fog.js.
// cab: Plus reads only hooks.state (no engine module: Pool read areas/view.js). 3D areas: the player's GEOn record of the
// map id in VM 4BC5 (decode/data/GEO.md, Load3DMap 6D00:133A); live wall planes come from hooks.state.geoPlanes() once the
// engine offers it (plus request #10), until then the record as loaded. The overland: BIGPIC 121 of the player's
// BIGPICn.DAX and the 32 location spots of the DS tables 0A48 / 0A68 (view_ov27.js; text cells, the picture at cell 1,1).
export const ANIM_COL=0x0A48,ANIM_ROW=0x0A68;
export async function currentMapContext({bus=hooks,bigPic=null}={}) {
 const p=bus.state.position?.();
 if(!p||!Number.isInteger(p.block))return null;
 const location=p.is3D===false&&bigPic===OVERLAND_BIGPIC?(bus.state.mem?.(LOCATION_CELL)??0)&255:undefined;
 return {...p,mapId:p.map3d,location,livePlanes:bus.state.geoPlanes?.()??null};
}
async function defaultProfile(){return (await import('../games.js')).loadProfile('cab');}
export async function loadCurrentMap(context,{readFile,profile}={}) {
 if(!context)throw new Error('No current area is available. Load or begin a game first.');
 if(!readFile) {const dax=await import('../../engine/dax.js');if(dax.dataSource!=='byoc')throw new Error('Import your supported game copy first');readFile=dax.fetchFile;}
 profile??=await defaultProfile();
 if(profile.id!=='cab')throw new Error('Map needs the Curse of the Azure Bonds v1.0 profile');
 const label=profile.areas.find(a=>a.dataSet===context.dataset && a.block===context.block)?.name || `Block ${context.block}`;
 if(Number.isInteger(context.location)) {
  const st=profile.engine.state,exe=await readFile(st.executable||'START.EXE');if(!exe)throw new Error(`Imported ${st.executable||'START.EXE'} unavailable`);   // cab: v13-1
  const ds=(await import('../../engine/state.js')).dsImageFromExe(exe,{exepack:!!st.exepack,dsImageOffset:st.dsImageOffset,dsBytes:st.dsBytes,dsMap:st.dsMap||null}).ds;
  const name=`BIGPIC${context.dataset}.DAX`,bytes=archiveRecords(await readFile(name)).get(OVERLAND_BIGPIC);
  if(!bytes)throw new Error(`Overland picture is missing: ${name}/${OVERLAND_BIGPIC}`);
  const picture=decodePicture(bytes);
  const locations=Array.from({length:LOCATIONS},(_,i)=>({index:i,x:(ds[ANIM_COL+i]-1)*8,y:(ds[ANIM_ROW+i]-1)*8}));
  return {kind:'overland',label,picture,locations,source:{file:name,record:OVERLAND_BIGPIC},context};
 }
 if(context.is3D!==true)throw new Error('This 2D area has no map: only the 3D areas and the overland picture have one.');
 if(!Number.isInteger(context.dataset) || context.dataset<1 || context.dataset>8 || !Number.isInteger(context.mapId))throw new Error('Current map coordinates are unavailable');
 const name=`GEO${context.dataset}.DAX`,record=archiveRecords(await readFile(name)).get(context.mapId);
 if(!record)throw new Error(`Current map record is missing: ${name}/${context.mapId}`);
 let bytes=record;
 if(context.livePlanes instanceof Uint8Array && context.livePlanes.length===1024){bytes=record.slice();bytes.set(context.livePlanes,2);}
 return {kind:'geo',label,cells:parseGeo(bytes),source:{file:name,record:context.mapId},context};
}
