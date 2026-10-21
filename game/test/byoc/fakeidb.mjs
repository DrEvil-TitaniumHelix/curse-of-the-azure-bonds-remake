// game/test/byoc/fakeidb.mjs — a minimal in-memory IndexedDB for node tests of engine/byoc.js (open/upgrade, transaction
// with oncomplete/onabort, object store put/get/getAll/getAllKeys/delete/clear). Requests succeed asynchronously; a
// transaction completes once its requests are done. `failPuts` simulates a quota error (the transaction aborts and none
// of its writes are kept, as in IndexedDB).
export function makeFakeIDB() {
  const dbs = new Map();
  const later = (f) => setTimeout(f, 0);
  const factory = {
    failPuts: false,
    open(name) {
      const req = {};
      later(() => {
        let data = dbs.get(name);
        const fresh = !data;
        if (fresh) { data = new Map(); dbs.set(name, data); }
        const db = {
          createObjectStore(s) { data.set(s, new Map()); },
          transaction(stores, mode) { return makeTx(data, [].concat(stores), mode, factory); },
        };
        req.result = db;
        if (fresh && req.onupgradeneeded) req.onupgradeneeded();
        if (req.onsuccess) req.onsuccess();
      });
      return req;
    },
  };
  return factory;
}

function makeTx(data, stores, mode, factory) {
  const staged = new Map(stores.map((s) => [s, new Map(data.get(s))]));
  let pending = 0, aborted = false;
  const t = { error: null };
  const finish = () => setTimeout(() => {
    if (pending || aborted) return;
    if (mode === 'readwrite') for (const [s, m] of staged) data.set(s, m);
    if (t.oncomplete) t.oncomplete();
  }, 0);
  const request = (fn) => {
    const r = {};
    pending++;
    setTimeout(() => {
      pending--;
      if (aborted) return;
      try { r.result = fn(); if (r.onsuccess) r.onsuccess(); }
      catch (e) { r.error = e; aborted = true; t.error = e; if (r.onerror) r.onerror(); if (t.onabort) t.onabort(); return; }
      finish();
    }, 0);
    return r;
  };
  t.objectStore = (s) => {
    const m = staged.get(s);
    return {
      put: (v, k) => request(() => { if (factory.failPuts) throw new Error('QuotaExceededError'); m.set(k, v); return k; }),
      get: (k) => request(() => m.get(k)),
      getAll: () => request(() => [...m.values()]),
      getAllKeys: () => request(() => [...m.keys()]),
      delete: (k) => request(() => { m.delete(k); }),
      clear: () => request(() => { m.clear(); }),
    };
  };
  finish();
  return t;
}
