import {parseManifest,matches} from './manifest.js';
import {createModStore} from './store.js';
import {checkPng} from './import.js';
import {compileImage,decodePNG} from './record.js';
export function createModManager({store=createModStore(),decode=decodePNG,isOriginal=()=>globalThis.goldBoxPlus?.settings.original===true,generate}={}) {
 let stack=[],original=false,cache=new Map(),version=0,lastError='',serial=Promise.resolve();const listeners=new Set();
 const ready=store.load().then(saved=>{stack=saved.map(mod=>({...mod,manifest:parseManifest(mod.manifest,{builtIn:mod.builtIn===true})}));}).catch(e=>{lastError=e.message;stack=[];});
 function changed() {version++;cache.clear();if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('por-mods-changed',{detail:{version}}));for(const fn of listeners) {try{fn();}catch{ /* UI callbacks cannot break resolver */ }} }
 async function save(){changed();await store.save(stack);}
 function mutate(fn) {const job=serial.then(async()=>{await ready;return fn();});serial=job.catch(()=>{});return job;}
 const api={
  ready,get lastError(){return lastError;},get sessionOnly(){return store.sessionOnly;},
  get list(){return stack.map(m=>({manifest:structuredClone(m.manifest),enabled:m.enabled}));},
  onChange(fn){listeners.add(fn);return ()=>listeners.delete(fn);},
  setOriginal(value){original=!!value;changed();},
  install(mod){return mutate(async()=>{
   const manifest=parseManifest(mod.manifest,{builtIn:mod.builtIn===true});
   if(stack.some(m=>m.manifest.id===manifest.id))throw new Error('Mod id already installed; remove it before importing a replacement');
   const assets={};for(const o of manifest.overrides) {if(!mod.builtIn)checkPng(mod.assets?.[o.png]);if(mod.assets?.[o.png])assets[o.png]=mod.assets[o.png].slice();}
   stack.push({manifest,assets,builtIn:mod.builtIn===true,enabled:false});await save();
  });},
  enable(id,value){return mutate(async()=>{
   const mod=stack.find(m=>m.manifest.id===id);if(!mod)throw new Error('Unknown mod');
   if(value && mod.builtIn && !mod.manifest.overrides.every(o=>mod.assets[o.png])) {
    const generator=generate || (await import('../../mods/sample-recolour/generate.js')).generateSample;
    const assets=await generator(mod.manifest);for(const o of mod.manifest.overrides)checkPng(assets[o.png]);mod.assets=assets;
   }
   mod.enabled=!!value;await save();
  });},
  reorder(ids){return mutate(async()=>{if(ids.length!==stack.length || new Set(ids).size!==ids.length || ids.some(id=>!stack.some(m=>m.manifest.id===id)))throw new Error('Order must contain every mod id once');stack=ids.map(id=>stack.find(m=>m.manifest.id===id));await save();});},
  remove(id){return mutate(async()=>{if(!stack.some(m=>m.manifest.id===id))throw new Error('Unknown mod');stack=stack.filter(m=>m.manifest.id!==id);await save();});},
  async resolve(name,id,raw) {
   if(original || isOriginal())return null;
   await ready;if(original || isOriginal())return null;
   const revision=version,key=`${name.toUpperCase()}:${id}`;
   try {
    let found,override;
    for(const mod of stack)if(mod.enabled)for(const o of mod.manifest.overrides)if(matches(o,name,id)){found=mod;override=o;}
    if(!found)return null;
    if(!cache.has(key)) {const compiled=compileImage(raw,name,await decode(found.assets[override.png]));if(original || isOriginal() || revision!==version)return null;cache.set(key,compiled);}
    if(original || isOriginal() || revision!==version)return null;
    return cache.get(key).slice();
   } catch(e){lastError=`${name}/${id}: ${e.message}`;return null;}
  },
 };
 return api;
}
export const plusMods=createModManager();
export async function installSample(manager=plusMods) {
 await manager.ready;if(manager.list.some(m=>m.manifest.id==='sample-recolour'))return;
 const response=await fetch(new URL('../../mods/sample-recolour/mod.json',import.meta.url));if(!response.ok)throw new Error('Sample manifest unavailable');
 await manager.install({manifest:await response.json(),assets:{},builtIn:true});
}
if(typeof window!=='undefined') {window.plusMods=plusMods;window.addEventListener('por-plus-settings',event=>plusMods.setOriginal(event.detail.settings.original));}
