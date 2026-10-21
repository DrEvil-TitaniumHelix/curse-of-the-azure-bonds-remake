import {createStore} from '../store.js';
// cab: param — profile default 'cab' (byoc-ui passes its own prefix)
// ZIP owner appends these entries to the ordinary save files before makeZip().
export async function exportNotes({profile='cab',slots='ABCDEFGHIJKLMNOPQRSTUVWXYZ',storeFactory=createStore}={}) {
 const files=[];
 for(const slot of slots){if(!/^[A-Z]$/.test(slot))continue;const value=await storeFactory({profile,slot}).get('notes',null);if(value?.version===1)files.push({name:`plus/notes-${slot}.json`,bytes:new TextEncoder().encode(JSON.stringify(value))});}
 return files;
}
// W7: only personal pins, scoped by profile, slot and map identity; never engine writes.
export async function getNotesPins({profile='cab',slot,dataset,mapId,travelMode,storeFactory=createStore}={}) {
 if(!/^[A-Z]$/.test(slot||''))return [];
 const value=await storeFactory({profile,slot}).get('notes',null);
 return (value?.notes||[]).filter(n=>n.pin&&n.place?.dataset===dataset&&(travelMode===undefined||n.place.travelMode===travelMode)&&(mapId===undefined||n.place.mapId===mapId));
}
