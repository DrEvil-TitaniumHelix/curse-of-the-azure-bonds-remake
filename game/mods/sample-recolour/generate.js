// Built-in tool only: generate replacement PNGs in the browser from the player's original PIC3 records.
// Never execute JavaScript from an imported mod.
import {recordFrames,imageSheet,encodePNG} from '../../plus/mods/record.js';
export async function generateSample(manifest,{readOriginal}={}) {
 if(!readOriginal) {
  const dax=await import('../../engine/dax.js');
  if(dax.dataSource!=='byoc')throw new Error('Import your supported game copy first');
  const bytes=await dax.fetchFile('PIC3.DAX');if(!bytes)throw new Error('Imported PIC3.DAX missing');
  const {dataStart,entries}=dax.readDir(bytes);
  readOriginal=async(name,id)=>{const entry=entries.find(e=>e.id===id);if(!entry)throw new Error('Sample PIC record missing');return dax.DaxRleDecode(bytes.subarray(dataStart+entry.ofs,dataStart+entry.ofs+entry.comp),entry.comp,entry.raw);};
 }
 const assets={};
 for(const override of manifest.overrides) {
  const name=`${override.dax}${override.dataSet}`,original=await readOriginal(name,override.record);
  const frames=recordFrames(original,name);
  // Cycle the eight hues within each intensity bank: every pixel keeps its geometry and intensity.
  assets[override.png]=await encodePNG(imageSheet(frames,n=>(n&8)|((n+1)&7)));
 }
 return assets;
}
