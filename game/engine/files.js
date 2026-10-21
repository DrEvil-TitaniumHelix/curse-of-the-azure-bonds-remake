// files.js — the save directory (SAVE\ in POOL.CFG line 4) as the original's file routines see it (PARTY ov17:
// charlist.txt, <name>.CHA/.ITM/.SPC, CHRDAT<x><n>.SAV/.ITM/.SPC, SAVGAM<x>.DAT — formats SAVES.md).
//
// Storage: a browser file store (IndexedDB database 'por-save', object store 'files', key = upper-case file name; memory
// fallback when IndexedDB is unavailable). With an imported copy (engine/byoc.js) its SAVE/ files were copied into this
// store at import; in the /data/ fallback the shipped saves are visible read-only through /data/SAVE/ until a file of the
// same name is written or erased in the store (an erase is stored as a tombstone, so the original folder is never
// modified). Names are passed with or without the SavePath prefix; only the file name counts.

import { DATA_URL, dataSource } from './dax.js';

const mem = new Map();          // name -> Uint8Array | null (tombstone)
let dbp = null;
let SAVE_DB = 'por-save';
// cab: PER-4 — the save database comes from the profile (engine.storage.saves: Curse 'cab-save')
export function configureFiles(name) { SAVE_DB = name; dbp = null; mem.clear(); }

function openDb() {
  if (dbp) return dbp;
  dbp = new Promise((res) => {
    try {
      // por-only: save database (profile: engine.storage.saves; game/profiles/PORONLY.md)
      const r = indexedDB.open(SAVE_DB, 1);                       // cab: PER-4
      r.onupgradeneeded = () => r.result.createObjectStore('files');
      r.onsuccess = () => res(r.result);
      r.onerror = () => res(null);
    } catch (e) { res(null); }
  });
  return dbp;
}
async function idb(mode, fn) {
  const db = await openDb();
  if (!db) return undefined;
  return new Promise((res) => {
    try {
      const tx = db.transaction('files', mode);
      const rq = fn(tx.objectStore('files'));
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => res(undefined);
    } catch (e) { res(undefined); }
  });
}

export const baseName = (path) => path.replace(/^.*[\\/:]/, '').toUpperCase();

async function storeGet(n) {
  if (mem.has(n)) return mem.get(n);
  const v = await idb('readonly', (s) => s.get(n));
  if (v !== undefined) { const b = v === null ? null : new Uint8Array(v); mem.set(n, b); return b; }
  return undefined;               // not in the store
}

async function shipped(n) {
  if (dataSource === 'byoc') return null;                        // imported saves live in the store itself
  try {
    const r = await fetch(DATA_URL + 'SAVE/' + encodeURIComponent(n));
    return r.ok ? new Uint8Array(await r.arrayBuffer()) : null;
  } catch (e) { return null; }
}

// every file of the save store (IndexedDB + memory; erased names left out) — BY-5 "Export saves"
export async function listStore() {
  const names = new Set(mem.keys());
  const keys = await idb('readonly', (s) => s.getAllKeys());
  if (keys) for (const k of keys) names.add(k);
  const out = [];
  for (const n of [...names].sort()) { const b = await storeGet(n); if (b) out.push({ name: n, bytes: b }); }
  return out;
}

// true when the browser save store holds this name (written or erased), whatever the shipped layer has (BYOC importSaves)
export async function storeHas(path) { return (await storeGet(baseName(path))) !== undefined; }

// whole file or null (FileExists = readFile !== null)
export async function readFile(path) {
  const n = baseName(path);
  const v = await storeGet(n);
  if (v !== undefined) return v;
  const b = await shipped(n);
  return b;
}
export async function fileExists(path) { return (await readFile(path)) !== null; }

export async function writeFile(path, bytes) {
  const n = baseName(path);
  const b = new Uint8Array(bytes);
  mem.set(n, b);
  await idb('readwrite', (s) => s.put(b.buffer, n));
}

export async function eraseFile(path) {
  const n = baseName(path);
  mem.set(n, null);
  await idb('readwrite', (s) => s.put(null, n));
}

// text files (charlist.txt): lines without CR/LF; written with CR LF as TP's WriteLn does
export async function readLines(path) {
  const b = await readFile(path);
  if (!b) return null;
  const t = new TextDecoder('latin1').decode(b);
  const lines = t.split(/\r?\n/);
  if (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines;
}
export async function writeLines(path, lines) {
  const t = lines.map((l) => l + '\r\n').join('');
  await writeFile(path, Uint8Array.from(t, (c) => c.charCodeAt(0) & 0xFF));
}

// A sequential reader for BlockRead-style code: r.read(n) returns n bytes (fewer at the end), r.eof()
export function reader(bytes) {
  let p = 0;
  return {
    read(n) { const s = bytes.subarray(p, Math.min(bytes.length, p + n)); p += s.length; return s; },
    eof() { return p >= bytes.length; },
    get pos() { return p; },
  };
}

// ?save=<name>[&force=1]: copy a prepared save (game/assets/saves/<name>/, original file formats) into the store before
// boot (as Star Command's saves.js). The folder lists its files in index.json (["SAVGAMA.DAT", "CHRDATA1.SAV", ...]);
// without index.json the standard names SAVGAMA..J.DAT / CHRDAT<x><1..8>.SAV/.ITM/.SPC are probed. Without force an
// existing store file of the same name is kept.
export async function importSaveSet(name, force) {
  const base = new URL(`../assets/saves/${encodeURIComponent(name)}/`, import.meta.url);
  let list = null;
  try { const r = await fetch(new URL('index.json', base)); if (r.ok) list = await r.json(); } catch (e) { list = null; }
  if (!list) {
    list = [];
    // por-only: A-J slot names and eight member files (profile: saveFormat; game/profiles/PORONLY.md)
    for (const x of 'ABCDEFGHIJ') {
      list.push(`SAVGAM${x}.DAT`);
      for (let n = 1; n <= 8; n++) for (const e of ['SAV', 'ITM', 'SPC']) list.push(`CHRDAT${x}${n}.${e}`);
    }
  }
  let copied = 0;
  for (const f of list) {
    const n = baseName(f);
    if (!force && (await storeGet(n)) !== undefined) continue;
    try {
      const r = await fetch(new URL(f, base));
      if (!r.ok) continue;
      await writeFile(n, new Uint8Array(await r.arrayBuffer()));
      copied++;
    } catch (e) { /* missing file */ }
  }
  return copied;
}
