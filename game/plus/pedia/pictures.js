// Pure picture decoder; does not allocate or touch an engine picture or framebuffer.
import {need,u16} from './records.js';
export function decodePicture(bytes,{animation=false,frame=0,xor=false}={}) {
 function picture(offset) {
  need(bytes,offset+17,'picture header');
  const height=u16(bytes,offset),width=u16(bytes,offset+2)*8,count=bytes[offset+8];
  if (!height || !width || !count || width>2048 || height>2048) throw new Error('Invalid picture dimensions');
  const length=height*width/2*count; need(bytes,offset+17+length,'picture pixels');
  return {width,height,count,start:offset+17,length,end:offset+17+length};
 }
 let h,first;
 if (animation) {
  need(bytes,1,'animation'); if (frame<0 || frame>=bytes[0]) throw new Error('Invalid animation frame');
  let offset=1;
  for(let i=0;i<=frame;i++) { h=picture(offset+4); if (!i) first=h; offset=h.end; }
 } else { h=picture(0); if(frame<0 || frame>=h.count) throw new Error('Invalid picture frame'); }
 const size=h.width*h.height/2,start=h.start+(animation?0:frame*size),pixels=new Uint8Array(size*2);
 if (xor && animation && frame && (first.width!==h.width || first.height!==h.height)) throw new Error('XOR frame dimensions differ');
 for(let i=0;i<size;i++) { const n=bytes[start+i] ^ (xor && animation && frame ? bytes[first.start+i] : 0); pixels[2*i]=n>>4;pixels[2*i+1]=n&15; }
 return {width:h.width,height:h.height,pixels};
}
export const EGA_RGB = [[0,0,0],[0,0,170],[0,170,0],[0,170,170],[170,0,0],[170,0,170],[170,85,0],[170,170,170],[85,85,85],[85,85,255],[85,255,85],[85,255,255],[255,85,85],[255,85,255],[255,255,85],[255,255,255]];
export function pictureCanvas(picture) {
 const c=document.createElement('canvas');c.width=picture.width;c.height=picture.height;
 const ctx=c.getContext('2d'),img=ctx.createImageData(c.width,c.height);
 for(let i=0;i<picture.pixels.length;i++) {img.data.set(EGA_RGB[picture.pixels[i]],i*4);img.data[i*4+3]=255;}
 ctx.putImageData(img,0,0);c.style.imageRendering='pixelated';c.style.maxWidth='100%';return c;
}
