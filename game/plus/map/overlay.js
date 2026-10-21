export const FOG_COLOUR=[18,24,32,255];
export function maskFog(image,visited,columns,rows){
 const data=image.data.slice();
 for(let y=0;y<rows;y++)for(let x=0;x<columns;x++)if(!visited.has(y*columns+x))for(let py=y*24;py<Math.min(image.height,y*24+25);py++)for(let px=x*24;px<Math.min(image.width,x*24+25);px++)data.set(FOG_COLOUR,(py*image.width+px)*4);
 return {width:image.width,height:image.height,data};
}
export function markerPoints({x,y,dir}){
 const angle=dir*Math.PI/4,center=[x*24+12,y*24+12];
 return [[0,-8],[-5,6],[0,3],[5,6]].map(([dx,dy])=>[center[0]+dx*Math.cos(angle)-dy*Math.sin(angle),center[1]+dx*Math.sin(angle)+dy*Math.cos(angle)]);
}
export function applyMapOverlay(canvas,{visited,marker},columns,rows){
 const ctx=canvas.getContext('2d'),image=ctx.getImageData(0,0,canvas.width,canvas.height),masked=maskFog(image,visited,columns,rows);image.data.set(masked.data);ctx.putImageData(image,0,0);
 if(marker&&visited.has(marker.y*columns+marker.x)){
  const points=markerPoints(marker);ctx.beginPath();ctx.moveTo(...points[0]);for(const point of points.slice(1))ctx.lineTo(...point);ctx.closePath();ctx.fillStyle='#ffd76b';ctx.fill();ctx.strokeStyle='#000';ctx.lineWidth=1;ctx.stroke();
 }
 canvas.setAttribute('aria-label',`Visited area map, north up. ${visited.size} cells visited.${marker?' Party facing '+['north','northeast','east','southeast','south','southwest','west','northwest'][marker.dir]+'.':''}`);
}
