import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../../plus/store.js';

test('unavailable IndexedDB keeps settings in session and deletes them', async () => {
 const s = createStore({ indexedDB: null });
 assert.equal(await s.get('settings', 'default'), 'default');
 assert.equal(await s.set('settings', { crispFont: true }), false);
 assert.deepEqual(await s.get('settings'), { crispFont: true });
 await s.delete('settings'); assert.equal(await s.get('settings'), null);
});
test('throwing storage and uncloneable values never reject', async () => {
 const s = createStore({ indexedDB: { open() { throw Error('denied'); } } });
 assert.equal(await s.set('x', 3), false); assert.equal(await s.get('x'), 3);
 assert.equal(await s.set('bad', () => {}), false);
 await s.delete('x'); assert.equal(await s.get('x', 9), 9);
});
function fakeIDB() {
 const records = new Map(); const keys = [];
 const database = { objectStoreNames: { contains: () => true }, close() {}, transaction() {
  const tx = { objectStore() { return {
   get(k) { keys.push(k); return { result: records.get(k) }; },
   put(v,k) { keys.push(k); records.set(k, structuredClone(v)); return {}; },
   delete(k) { records.delete(k); return {}; },
  }; } }; setTimeout(() => tx.oncomplete(), 0); return tx;
 } };
 return { keys, open(name) { assert.equal(name, 'cab-plus'); const r = { result: database }; queueMicrotask(() => r.onsuccess()); return r; } };
}
test('IndexedDB persists across instances and isolates slot plus profile', async () => {
 const indexedDB = fakeIDB();
 const a = createStore({ indexedDB, profile:'por', slot:'A' });
 assert.equal(await a.set('notes', ['one']), true);
 assert.deepEqual(await createStore({ indexedDB, profile:'por', slot:'A' }).get('notes'), ['one']);
 assert.equal(await createStore({ indexedDB, profile:'por', slot:'B' }).get('notes'), null);
 assert.equal(await createStore({ indexedDB, profile:'other', slot:'A' }).get('notes'), null);
 assert.deepEqual(JSON.parse(indexedDB.keys[0]), ['por','A','notes']);
 await a.delete('notes'); assert.equal(await a.get('notes'), null);
});
test('transaction abort falls back to session values', async () => {
 const indexedDB = { open() { const r = { result: { transaction() { const t = { objectStore() { return { put() {}, get() {} }; } }; setTimeout(() => t.onabort(),0); return t; } } }; queueMicrotask(() => r.onsuccess()); return r; } };
 const s = createStore({ indexedDB }); assert.equal(await s.set('x', 5), false); assert.equal(await s.get('x'), 5);
});
