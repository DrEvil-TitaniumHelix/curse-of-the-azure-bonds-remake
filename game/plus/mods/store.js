// Independent per-profile mod stacks beside por-data. A failed write retains a session copy.
export function createModStore({indexedDB=globalThis.indexedDB,profile='por'}={}) {
 let connection,memory=[],session=false;
 async function db() {
  if(!indexedDB) return null;
  if(!connection) connection=new Promise(resolve=>{
   try {const r=indexedDB.open('por-mods',1);r.onupgradeneeded=()=>r.result.createObjectStore('stacks');r.onerror=r.onblocked=()=>resolve(null);r.onsuccess=()=>{r.result.onversionchange=()=>{r.result.close();connection=null;};resolve(r.result);};} catch {resolve(null);}
  });return connection;
 }
 async function transact(value,write) {
  try {const d=await db();if(!d)return {ok:false};return await new Promise(resolve=>{
   try {const tx=d.transaction('stacks',write?'readwrite':'readonly'),s=tx.objectStore('stacks'),r=write?s.put(value,profile):s.get(profile);
    tx.oncomplete=()=>resolve({ok:true,value:r.result});tx.onerror=tx.onabort=()=>resolve({ok:false});
   }catch{resolve({ok:false});}
  });}catch{return {ok:false};}
 }
 return {
  get sessionOnly(){return session;},
  async load(){if(session)return structuredClone(memory);const r=await transact(null,false);if(r.ok){memory=r.value||[];return structuredClone(memory);}session=true;return structuredClone(memory);},
  async save(stack){memory=structuredClone(stack);const r=await transact(memory,true);session=!r.ok;return r.ok;},
 };
}
