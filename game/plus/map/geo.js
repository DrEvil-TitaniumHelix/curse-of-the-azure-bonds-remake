// Decoded GEO layout and the rendering operations of decode/tools/geo.py.
export const CELL=24;
export const DIRECTIONS=['N','E','S','W'];
export const SLOT_COLOURS={1:[255,255,255],2:[85,255,255],3:[255,255,85]};
export const DOOR_COLOURS={2:[255,85,85],3:[255,85,255]};
export function parseGeo(bytes) {
 if(!(bytes instanceof Uint8Array) || bytes.length!==1026)throw new Error('GEO record must be exactly 1026 bytes');
 // The original loader ignores the two-byte header; do not reject it based on its value.
 return Array.from({length:256},(_,i)=>{
  const p0=bytes[2+i],p1=bytes[258+i],p3=bytes[770+i];
  return {x:i%16,y:Math.floor(i/16),wall:[p0>>4,p0&15,p1>>4,p1&15],door:[p3&3,(p3>>2)&3,(p3>>4)&3,(p3>>6)&3],attr:bytes[514+i]};
 });
}
export function geoPlan(cells) {
 if(cells.length!==256)throw new Error('A GEO map needs 256 cells');
 return cells.map(c=>{
  const x=c.x*CELL,y=c.y*CELL,commands=[];
  if(c.attr) {commands.push({op:'rectangle',rect:[x+1,y+1,x+23,y+23],colour:c.attr&128?[40,40,70]:[30,60,30]});commands.push({op:'text',point:[x+3,y+7],text:c.attr.toString(16).padStart(2,'0'),colour:[150,150,150]});}
  const lines=[[x,y+2,x+24,y+2],[x+22,y,x+22,y+24],[x,y+22,x+24,y+22],[x+2,y,x+2,y+24]];
  for(let side=0;side<4;side++) {
   const wall=c.wall[side],door=c.door[side];if(!wall && !door)continue;
   const colour=DOOR_COLOURS[door] || (wall?SLOT_COLOURS[Math.floor((wall-1)/5)+1]:[90,90,90]);
   commands.push({op:'line',line:lines[side],colour,width:door===1&&wall?1:2});
  }
  return commands;
 });
}
// Pillow's horizontal/vertical line rasterisation, with labels rendered separately by the browser.
export function rasterGeo(plan) {
 const width=385,height=385,data=new Uint8ClampedArray(width*height*4);for(let i=3;i<data.length;i+=4)data[i]=255;
 function rectangle(x1,y1,x2,y2,colour) {
  for(let y=Math.max(0,y1);y<=Math.min(height-1,y2);y++)for(let x=Math.max(0,x1);x<=Math.min(width-1,x2);x++){const o=(y*width+x)*4;data.set(colour,o);}
 }
 for(const commands of plan)for(const command of commands) {
  if(command.op==='rectangle')rectangle(...command.rect,command.colour);
  else if(command.op==='line') {const [x1,y1,x2,y2]=command.line,w=command.width;rectangle(x1,y1,x2+(x1===x2?w-1:0),y2+(y1===y2?w-1:0),command.colour);}
 }
 return {width,height,data};
}
export function geoCanvas(cells) {
 const plan=geoPlan(cells),image=rasterGeo(plan),canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
 const context=canvas.getContext('2d'),pixels=context.createImageData(image.width,image.height);pixels.data.set(image.data);context.putImageData(pixels,0,0);
 context.font='10px monospace';context.textBaseline='top';
 for(const commands of plan)for(const c of commands)if(c.op==='text'){context.fillStyle=`rgb(${c.colour.join(',')})`;context.fillText(c.text,...c.point);}
 canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Area map, north up. Wall and door colours are explained in the legend.');return canvas;
}
