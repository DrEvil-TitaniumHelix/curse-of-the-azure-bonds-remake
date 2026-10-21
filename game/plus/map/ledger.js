import {createStore} from '../store.js';
// Serialise read/modify/write per profile + slot. Capture the slot when work is queued,
// never after an IndexedDB await. Keep failed writes in this controller's session cache.
export function createScopedLedger({profile='por',key,empty,decode=value=>value,storeFactory=createStore,slot='unsaved'}={}) {
 let current=String(slot),pending=Promise.resolve(),error='';
 const values=new Map(),stores=new Map(),temporary=new Set(),listeners=new Set();
 const notify=()=>{for(const fn of listeners){try{fn();}catch{/* consumers cannot interrupt persistence */}}};
 const store=scope=>{if(!stores.has(scope))stores.set(scope,storeFactory({profile,slot:scope}));return stores.get(scope);};
 async function load(scope){if(!values.has(scope)){let value;try{value=decode(await store(scope).get(key,null));}catch(e){error=e.message;}values.set(scope,value??empty());}return values.get(scope);}
 function queue(fn){const next=pending.then(fn).catch(e=>{error=e.message;notify();});pending=next;return next;}
 async function persist(scope,value){try{if(await store(scope).set(key,structuredClone(value))===false)temporary.add(scope);else temporary.delete(scope);}catch(e){error=e.message;temporary.add(scope);}}
 return {
  get slot(){return current;},get error(){return error;},get sessionOnly(){return temporary.has(current);},
  peek(){return values.get(current)??empty();},
  onChange(fn){listeners.add(fn);return ()=>listeners.delete(fn);},
  use(slot){current=String(slot);const target=current;notify();return queue(async()=>{await load(target);notify();});},
  saveAs(slot){const source=current,target=String(slot);current=target;notify();return queue(async()=>{const value=structuredClone(await load(source));values.set(target,value);await persist(target,value);notify();});},
  change(fn){const target=current;return queue(async()=>{const value=await load(target);if(await fn(value)!==false)await persist(target,value);notify();});},
  async read(){const target=current;await pending;return structuredClone(await load(target));},
  flush(){return pending;},
 };
}
export function saveSlot(slot){return typeof slot==='string'&&/^[A-Z]$/i.test(slot)?slot.toUpperCase():'unsaved';}
