// Failure-tolerant, profile + save-slot scoped Plus storage. Never writes game saves.
// cab: param — the IndexedDB database is `cab-plus` (Pool: `por-plus`); records are keyed [profile, save slot, name].
export const PLUS_DB = 'cab-plus';
export function createStore({ indexedDB = globalThis.indexedDB, profile = 'cab', slot = 'default', database = PLUS_DB } = {}) {   // cab: param
  const memory = new Map();
  let connection;
  const key = name => JSON.stringify([String(profile), String(slot), String(name)]);
  async function db() {
    try {
      if (!indexedDB) return null;
      if (!connection) connection = new Promise(resolve => {
        try {
          const r = indexedDB.open(database, 1);
          r.onupgradeneeded = () => { try { if (!r.result.objectStoreNames.contains('records')) r.result.createObjectStore('records'); } catch { resolve(null); } };
          r.onsuccess = () => { r.result.onversionchange = () => { r.result.close(); connection = null; }; resolve(r.result); };
          r.onerror = r.onblocked = () => resolve(null);
        } catch { resolve(null); }
      });
      return await connection;
    } catch { return null; }
  }
  async function operation(mode, name, value) {
    try {
      const d = await db(); if (!d) return { ok: false };
      return await new Promise(resolve => {
        try {
          const tx = d.transaction('records', mode === 'get' ? 'readonly' : 'readwrite');
          const s = tx.objectStore('records');
          const r = mode === 'get' ? s.get(key(name)) : mode === 'delete' ? s.delete(key(name)) : s.put(value, key(name));
          tx.oncomplete = () => resolve({ ok: true, value: r.result });
          tx.onerror = tx.onabort = () => resolve({ ok: false });
        } catch { resolve({ ok: false }); }
      });
    } catch { return { ok: false }; }
  }
  return {
    async get(name, fallback = null) { try { const r = await operation('get', name); return r.ok ? (r.value ?? fallback) : (memory.get(key(name)) ?? fallback); } catch { return fallback; } },
    async set(name, value) { try { memory.set(key(name), structuredClone(value)); return (await operation('put', name, value)).ok; } catch { return false; } },
    async delete(name) { try { memory.delete(key(name)); return (await operation('delete', name)).ok; } catch { return false; } },
  };
}
export const store = createStore();
