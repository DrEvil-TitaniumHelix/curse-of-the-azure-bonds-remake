import {decodePicture,EGA_RGB} from '../pedia/pictures.js';
import {need,u16} from '../pedia/records.js';
import {normalizeDax} from './manifest.js';
export function recordFrames(bytes,name) {
 const group=normalizeDax(name)?.group,animation=group==='PIC'||group==='SPRIT';
 const frames=[];
 function header(offset) {need(bytes,offset+17,'picture');const w=u16(bytes,offset+2)*8,h=u16(bytes,offset),n=bytes[offset+8];if(!w||!h||!n||w*h>4194304)throw new Error('Invalid picture');return {w,h,n,size:w*h/2};}
 if(animation) {
  need(bytes,1,'animation');let offset=1;
  for(let i=0;i<bytes[0];i++) {const h=header(offset+4);if(h.n!==1)throw new Error('Unsupported animation frame count');const image=decodePicture(bytes,{animation:true,xor:group==='PIC',frame:i});frames.push({...image,offset:offset+21});offset+=21+h.size;}
  if(!frames.length || offset!==bytes.length)throw new Error('Invalid animation length');
 } else {const h=header(0);if(17+h.n*h.size!==bytes.length)throw new Error('Invalid picture length');for(let i=0;i<h.n;i++)frames.push({...decodePicture(bytes,{frame:i}),offset:17+i*h.size});}
 return frames;
}
export function imageSheet(frames,map=n=>n) {
 const width=frames.reduce((n,f)=>n+f.width,0),height=Math.max(...frames.map(f=>f.height)),data=new Uint8ClampedArray(width*height*4);let left=0;
 for(const f of frames) {for(let y=0;y<f.height;y++)for(let x=0;x<f.width;x++){const o=(y*width+left+x)*4;data.set(EGA_RGB[map(f.pixels[y*f.width+x])],o);data[o+3]=255;}left+=f.width;}
 return {width,height,data};
}
function nearest(r,g,b) {
 let best=0,distance=Infinity;for(let i=0;i<16;i++){const c=EGA_RGB[i],d=(r-c[0])**2+(g-c[1])**2+(b-c[2])**2;if(d<distance){best=i;distance=d;}}return best;
}
export function compileImage(original,name,image) {
 const frames=recordFrames(original,name),width=frames.reduce((n,f)=>n+f.width,0),height=Math.max(...frames.map(f=>f.height));
 if(image.width!==width || image.height!==height || image.data.length!==width*height*4)throw new Error(`PNG must be a ${width}×${height} horizontal frame strip`);
 const output=original.slice(),packed=[];let left=0;
 for(const f of frames) {
  const pixels=new Uint8Array(f.width*f.height/2);
  for(let y=0;y<f.height;y++)for(let x=0;x<f.width;x++) {const p=y*f.width+x,o=(y*width+left+x)*4,alpha=image.data[o+3];if(alpha!==0 && alpha!==255)throw new Error('PNG pixels must be opaque or fully transparent');const index=alpha?nearest(image.data[o],image.data[o+1],image.data[o+2]):f.pixels[p];pixels[p>>1]|=index << (p%2?0:4);}
  packed.push(pixels);left+=f.width;
 }
 const xor=normalizeDax(name)?.group==='PIC';
 for(let i=0;i<frames.length;i++){const b=packed[i].slice();if(xor && i) {if(b.length!==packed[0].length)throw new Error('XOR frame dimensions differ');for(let j=0;j<b.length;j++)b[j]^=packed[0][j];}output.set(b,frames[i].offset);}
 return output;
}
export async function decodePNG(bytes) {
 const bitmap=await createImageBitmap(new Blob([bytes],{type:'image/png'}),{colorSpaceConversion:'none',premultiplyAlpha:'none'});
 try {const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(bitmap,0,0);return ctx.getImageData(0,0,canvas.width,canvas.height);}finally{bitmap.close();}
}
export async function encodePNG(image) {
 const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d'),data=ctx.createImageData(c.width,c.height);data.data.set(image.data);ctx.putImageData(data,0,0);
 const blob=await new Promise(resolve=>c.toBlob(resolve,'image/png'));if(!blob)throw new Error('PNG generation failed');return new Uint8Array(await blob.arrayBuffer());
}
