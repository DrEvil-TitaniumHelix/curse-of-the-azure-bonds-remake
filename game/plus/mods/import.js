import {parseManifest,safePath} from './manifest.js';
import {crc32} from '../../byoc/ui/zip.js';
const MAX_TOTAL=64*1024*1024,MAX_FILE=8*1024*1024;
export function checkPng(bytes) {
 if(!(bytes instanceof Uint8Array) || bytes.length<24 || bytes.length>MAX_FILE || ![137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n)) throw new Error('Invalid or oversized PNG');
 const d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),w=d.getUint32(16),h=d.getUint32(20);
 if(!w || !h || w*h>4*1024*1024)throw new Error('PNG dimensions exceed the supported limit');
 return bytes;
}
export function importEntries(entries) {
 if(!Array.isArray(entries) || entries.length>512)throw new Error('Too many mod files');
 const files=new Map();let total=0;
 for(const e of entries) {const name=safePath(e.name),key=name.toLowerCase();if(files.has(key))throw new Error('Duplicate mod file');total+=e.bytes.length;if(total>MAX_TOTAL || e.bytes.length>MAX_FILE)throw new Error('Mod is too large');files.set(key,{name,bytes:e.bytes});}
 const manifests=[...files.values()].filter(e=>e.name.split('/').pop().toLowerCase()==='mod.json');
 if(manifests.length!==1)throw new Error('Choose one mod containing one mod.json');
 const manifestFile=manifests[0],prefix=manifestFile.name.slice(0,-8),manifest=parseManifest(new TextDecoder().decode(manifestFile.bytes));
 const assets={};for(const o of manifest.overrides) {const asset=files.get((prefix+o.png).toLowerCase());if(!asset)throw new Error(`Missing PNG: ${o.png}`);assets[o.png]=checkPng(asset.bytes).slice();}
 return {manifest,assets,enabled:false};
}
export async function importFolder(files) {
 const entries=[];let total=0;
 for(const file of files) {if(file.size>MAX_FILE || (total+=file.size)>MAX_TOTAL)throw new Error('Mod is too large');entries.push({name:file.webkitRelativePath||file.name,bytes:new Uint8Array(await file.arrayBuffer())});}
 return importEntries(entries);
}
export async function importZip(bytes) {
 if(bytes.length>MAX_TOTAL)throw new Error('ZIP is too large');
 // Bound decompression to declared sizes; validate paths and CRC before installing any assets.
 const d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let end=-1;
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(d.getUint32(i,true)===0x06054B50){end=i;break;}
 if(end<0)throw new Error('Not a ZIP archive');
 const count=d.getUint16(end+10,true);if(count>512 || d.getUint16(end+4,true) || d.getUint16(end+6,true))throw new Error('Unsupported ZIP archive');
 let pos=d.getUint32(end+16,true),total=0;const checks=new Map(),entries=[];
 for(let i=0;i<count;i++) {
  if(pos+46>bytes.length || d.getUint32(pos,true)!==0x02014B50)throw new Error('Damaged ZIP');
  const size=d.getUint32(pos+24,true),nl=d.getUint16(pos+28,true),xl=d.getUint16(pos+30,true),cl=d.getUint16(pos+32,true);
  if(d.getUint16(pos+8,true)&1 || size>MAX_FILE || (total+=size)>MAX_TOTAL || pos+46+nl+xl+cl>bytes.length)throw new Error('Unsupported or oversized ZIP entry');
  const name=new TextDecoder().decode(bytes.subarray(pos+46,pos+46+nl));
  if(!name.endsWith('/')) {safePath(name);if(checks.has(name))throw new Error('Duplicate ZIP entry');checks.set(name,d.getUint32(pos+16,true));
   const local=d.getUint32(pos+42,true),compressed=d.getUint32(pos+20,true),method=d.getUint16(pos+10,true);
   if(local+30>bytes.length || d.getUint32(local,true)!==0x04034B50)throw new Error('Damaged ZIP entry');
   const start=local+30+d.getUint16(local+26,true)+d.getUint16(local+28,true);if(start+compressed>bytes.length)throw new Error('Truncated ZIP entry');
   const packed=bytes.subarray(start,start+compressed);let unpacked;
   if(method===0)unpacked=packed.slice();
   else if(method===8) {const reader=new Blob([packed]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader(),chunks=[];let actual=0;try{for(;;){const chunk=await reader.read();if(chunk.done)break;actual+=chunk.value.length;if(actual>size)throw new Error('ZIP entry expands beyond its declared size');chunks.push(chunk.value);}}finally{await reader.cancel();}unpacked=new Uint8Array(actual);let offset=0;for(const chunk of chunks){unpacked.set(chunk,offset);offset+=chunk.length;}}
   else throw new Error('ZIP compression method is not supported');
   if(unpacked.length!==size || crc32(unpacked)!==checks.get(name))throw new Error('Damaged ZIP checksum');
   entries.push({name,bytes:unpacked});}
  pos+=46+nl+xl+cl;
 }

 return importEntries(entries);
}
