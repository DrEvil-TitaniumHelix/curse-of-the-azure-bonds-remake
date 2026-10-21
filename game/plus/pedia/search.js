const normalize=s => String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase();
// No reveal ledger means no game-data results. A catalog is not a list of discoveries.
export function searchEntries(entries,query='',{revealed=new Map(),kind='all'}={}) {
 const words=normalize(query).trim().split(/\s+/).filter(Boolean);
 return entries.filter(e => {
  if(!revealed.has(e.id)) return false;
  if(kind!=='all' && e.kind!==kind) return false;
  // Search only visible names and observed places, never hidden fields or full original script text.
  const discovery=revealed.get(e.id),text=normalize([discovery?.name || e.name,e.kind,...(discovery?.whereMet || []).map(p => p.name || `${p.dataSet}:${p.block}`)].join(' '));
  return words.every(word => text.includes(word));
 }).sort((a,b) => (revealed.get(a.id)?.name || a.name).localeCompare(revealed.get(b.id)?.name || b.name) || a.id.localeCompare(b.id));
}
export function discoveredEntry(entry,discovery={}) {
 // An observed snapshot takes precedence over template stats (especially unidentified items).
 return {...entry,...discovery,id:entry.id,kind:entry.kind,whereMet:discovery.whereMet || []};
}
