// Player-supplied text only. No Adventurer's Journal content is bundled.
export function referenceKey({kind='entry',n,id}={}) {
 return kind==='proclamation'?`proclamation:${String(id||n).toUpperCase()}`:`entry:${Number(n)}`;
}
export function parseJournal(text) {
 const entries={};let key=null,lines=[];
 function finish(){if(key&&lines.join('\n').trim())entries[key]=lines.join('\n').trim();}
 for(const line of String(text).replace(/\r/g,'').split('\n')) {
  const heading=line.match(/^\s*(?:(?:JOURNAL\s+)?ENTRY\s+(\d{1,3})[.:]?|PROCLAMATION\s+([IVXLCDM]+)[.:]?|(\d{1,3})[.)])(?:\s+(.*))?\s*$/i);
  if(heading){finish();key=heading[2]?`proclamation:${heading[2].toUpperCase()}`:`entry:${Number(heading[1]||heading[3])}`;lines=[heading[4]||''];}
  else if(key)lines.push(line);
 }
 finish();return entries;
}
export const PDFJS_VERSION='6.4.299';
export async function readJournalPDF(file,{pdfjs}={}) {
 const base=`https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/`;
 const library=pdfjs||await import(base+'pdf.mjs');
 if(!pdfjs)library.GlobalWorkerOptions.workerSrc=base+'pdf.worker.mjs';
 const task=library.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false});
 let document;
 try {
  document=await task.promise;const pages=[];
  for(let n=1;n<=document.numPages;n++) {
   const page=await document.getPage(n),content=await page.getTextContent();let line='',y=null,lines=[];
   for(const item of content.items){if(typeof item.str!=='string')continue;const nextY=item.transform?.[5];if(y!==null&&Math.abs(nextY-y)>3){lines.push(line);line='';}line+=(line?' ':'')+item.str;y=nextY;if(item.hasEOL){lines.push(line);line='';y=null;}}
   if(line)lines.push(line);pages.push(lines.join('\n'));page.cleanup?.();
  }
  return parseJournal(pages.join('\n'));
 }finally{if(document)await document.destroy();else await task.destroy?.();}
}
