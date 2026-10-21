import {EGA_RGB} from '../pedia/pictures.js';
// cab: the Curse overland (replaces Pool's tiled SQRPACI overland, travel modes 2..4, which Curse does not have): the
// player's BIGPIC 121 picture (304 x 120) with a region layer. Only the visited locations are marked (a ring on their
// 8 x 8 spot) and the party's location (the gold marker); the picture itself is the game's own region map.
export function overlandImage(model) {
 const {width,height,pixels}=model.picture,data=new Uint8ClampedArray(width*height*4);
 for(let i=0;i<pixels.length;i++){data.set(EGA_RGB[pixels[i]],i*4);data[i*4+3]=255;}
 return {width,height,data};
}
// the spots to mark: visited locations (Set of numbers) and the current one; each { x, y, current }
export function overlandMarks(model,{visited=new Set(),marker=null}={}) {
 return model.locations.filter(l=>visited.has(l.index)||marker?.location===l.index).map(l=>({...l,current:marker?.location===l.index}));
}
export function overlandCanvas(model,discovered) {
 const image=overlandImage(model),canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
 const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(canvas.width,canvas.height);pixels.data.set(image.data);ctx.putImageData(pixels,0,0);
 const marks=overlandMarks(model,discovered);
 for(const m of marks){
  ctx.beginPath();ctx.arc(m.x+4,m.y+4,m.current?7:5,0,2*Math.PI);ctx.lineWidth=2;ctx.strokeStyle=m.current?'#ffd76b':'#8fd3ff';ctx.stroke();
  if(m.current){ctx.beginPath();ctx.moveTo(m.x+4,m.y-6);ctx.lineTo(m.x,m.y-12);ctx.lineTo(m.x+8,m.y-12);ctx.closePath();ctx.fillStyle='#ffd76b';ctx.fill();}
 }
 canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`Overland picture from your game files. ${marks.length} visited locations marked.${marks.some(m=>m.current)?' Gold ring: the party.':''}`);
 return canvas;
}
