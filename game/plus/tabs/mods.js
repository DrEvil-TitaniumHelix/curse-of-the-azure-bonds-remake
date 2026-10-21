import {plusMods,installSample} from '../mods/manager.js';
import {importFolder,importZip} from '../mods/import.js';
export function registerModsTab(plus,{manager=plusMods}={}) {
 let dispose;
 plus.registerTab('mods',container=>{
  dispose?.();const host=document.createElement('section');container.append(host);
  function render() {
   if(!container.contains(host))return;
   host.replaceChildren();const title=document.createElement('h2');title.textContent='Mods and skins';host.append(title);
   const status=document.createElement('p');status.setAttribute('role','status');
   status.textContent=plus.settings.original?'All mods are bypassed in original-game mode.':manager.sessionOnly?'Mods are available for this session; browser storage is unavailable.':'The last enabled matching override wins. Reload the current picture to see a stack change.';host.append(status);
   if(manager.lastError){const error=document.createElement('p');error.textContent=`Last override issue (original used): ${manager.lastError}`;host.append(error);}
   async function action(fn) {try{await fn();render();}catch(error){status.textContent=error.message;}}
   function button(label,fn,disabled=false) {const b=document.createElement('button');b.textContent=label;b.disabled=disabled;b.onclick=()=>action(fn);return b;}
   const folder=document.createElement('input');folder.type='file';folder.multiple=true;folder.setAttribute('webkitdirectory','');folder.setAttribute('aria-label','Import mod folder');folder.onchange=()=>action(async()=>{await manager.install(await importFolder(folder.files));});
   const zip=document.createElement('input');zip.type='file';zip.accept='.zip,application/zip';zip.setAttribute('aria-label','Import mod ZIP');zip.onchange=()=>action(async()=>{const f=zip.files[0];if(f)await manager.install(await importZip(new Uint8Array(await f.arrayBuffer())));});
   const folderLabel=document.createElement('label');folderLabel.textContent='Import folder ';folderLabel.append(folder);
   const zipLabel=document.createElement('label');zipLabel.textContent='Import ZIP ';zipLabel.append(zip);host.append(folderLabel,zipLabel);
   const mods=manager.list;
   for(let i=0;i<mods.length;i++) {
    const mod=mods[i],row=document.createElement('div'),name=document.createElement('strong');name.textContent=`${mod.manifest.name} ${mod.manifest.version} — ${mod.manifest.author}`;
    const label=document.createElement('label'),toggle=document.createElement('input');toggle.type='checkbox';toggle.checked=mod.enabled;toggle.disabled=plus.settings.original;toggle.onchange=()=>action(()=>manager.enable(mod.manifest.id,toggle.checked));label.append(toggle,document.createTextNode('Enabled'));
    row.append(name,label);
    for(const [text,delta] of [['Move up',-1],['Move down',1]])row.append(button(text,()=>{const ids=manager.list.map(m=>m.manifest.id),j=i+delta;[ids[i],ids[j]]=[ids[j],ids[i]];return manager.reorder(ids);},i+delta<0 || i+delta>=mods.length));
    row.append(button('Remove',()=>manager.remove(mod.manifest.id)));const p=document.createElement('p');p.textContent=mod.manifest.description;row.append(p);host.append(row);
   }
   host.append(button('Add built-in recolour sample',()=>installSample(manager),mods.some(m=>m.manifest.id==='sample-recolour')));
   const help=document.createElement('p');help.textContent='PNG frame strips replace pictures only. No imported scripts run. See docs/MODDING.md in the repository for the format.';host.append(help);
  }
  host.textContent='Loading mods…';
  manager.ready.then(()=>{if(!container.contains(host))return;render();dispose=manager.onChange(render);}).catch(error=>{host.textContent=error.message;});
 });
 return ()=>dispose?.();
}
