// byoc.js — "bring your own copy" (docs/BYOC.md §3, §4, §8): the player's original Pool of Radiance v1.3 files are
// collected from a folder / file list / drop / URL, checked against the manifest (size, then SHA-256), stored in
// IndexedDB 'por-data' (object store 'files' = upper-case name -> ArrayBuffer, object store 'meta' = 'meta' -> record)
// in one all-or-nothing transaction, and read back by dax.js. Nothing derived is stored: the DS image is unpacked from
// START.EXE at every boot. Saves found next to the data (SAVE/) go into the game's save store (files.js, 'por-save'),
// never over an existing save.
//
// API (screens BY-1..BY-5 code against it; changes are announced as `byoc api #n` in STATUS.md):
//   loadManifest()                         -> manifest (game/byoc/manifest-por-1.3.json)
//   collectFromDirectoryHandle(handle)     -> candidates   (File System Access API, showDirectoryPicker)
//   collectFromFileList(fileList)          -> candidates   (<input type=file webkitdirectory multiple> or multiple)
//   collectFromDataTransfer(dataTransfer)  -> candidates   (drag & drop of a folder or files)
//   collectFromUrl(base, names?)           -> candidates   (dev mode /devdata/: fetch each manifest name + SAVE/ index)
//   validate(candidates, { onProgress(n, total, name), signal }) -> report (see below)
//   importFiles(report)                    -> { stored, bytes, persisted }   (throws if !report.ok)
//   importSaves(report, { replace })       -> { imported: [...], conflicts: [...], skipped: [...] }
//   isImported() / info() / get(name) / preload() / removeGameFiles()
//   useSession(report) / sessionActive()   F7: serve a validated report from memory only (no IndexedDB; until the tab closes)
//   checkSaves(candidates)                 -> report.saves for candidates without game files (BY-5 "Import saves")
//   devImport()                            -> report | null: `serve.py --dev` /devdata/ copy imported (files + saves), else null
// candidate = { path: 'POOLRAD/SAVE/CHRDATA1.SAV', name: 'CHRDATA1.SAV', dir: 'SAVE' | '', size, read(): Promise<Uint8Array> }
// report = { ok, manifestId, files: [{ name, required, status: 'ok'|'missing'|'size'|'hash', size, expectedSize, sha256 }],
//            okCount, requiredCount, matchRatio, likelyOtherVersion, gameOvr: 'match'|'absent'|'mismatch',
//            saves: [{ name, size, ok, reason }], bytes: Map(name -> Uint8Array) (ok required files only) }

// por-only: Pool import database and accepted save names (profile: engine.storage.data / saveFormat; game/profiles/PORONLY.md)
let DB = 'por-data';
let SAVE_RX = /^(CHRDAT[A-J][1-8]\.(SAV|ITM|SPC)|SAVGAM[A-J]\.DAT|[A-Z0-9_$~!#%&'(){}^@-]{1,8}\.(CHA|ITM|SPC))$/;
// cab: PER-5 — per-profile storage, accepted save names and record sizes (game/profiles/cab.json engine.storage /
// saveFormat / recordSizes). Curse: '*.guy/.swg/.fx' characters, CHRDAT<k><n>.SAV/.SWG/.FX, SAVGAM<k>.DAT (13149 B) and the
// read-only import sources *.CHA / *.SAV (Pool, 11Dh) and *.HIL (Hillsfar, BCh) (BUILD_PLAN §4).
let SIZES = { char: 285, item: 63, effect: 9, game: 13137, charExt: 'SAV', itemExt: 'ITM', effectExt: 'SPC', imports: [] };
export let gameInfo = null;           // cab: PER-12  texts of the import screens (byoc/ui/byoc-ui.js)
export function configure(profile) {
  DB = profile.engine.storage.data; dbp = null;
  gameInfo = { title: profile.title, version: profile.version, prefix: profile.id,
    daxCount: profile.manifest.files.filter((f) => f.endsWith('.DAX')).length, credits: 'the version on the title prompt' };
  const f = profile.saveFormat, ie = f.itemExtension.slice(1), ee = f.effectExtension.slice(1), re = f.rosterExtension.slice(1);
  const imp = (f.importSources || []).filter((x) => x.game !== profile.id).map((x) => x.extension.slice(1));
  const N = "[A-Z0-9_$~!#%&'(){}^@-]{1,8}";
  SAVE_RX = new RegExp(`^(CHRDAT[A-J][1-8]\\.(SAV|${ie}|${ee})|SAVGAM[A-J]\\.DAT|${N}\\.(${[re, ie, ee, ...imp].join('|')}))$`);
  SIZES = { char: profile.recordSizes.TChar, item: profile.recordSizes.item, effect: profile.recordSizes.effect,
    game: f.gameBytes, rosterExt: re, itemExt: ie, effectExt: ee,
    imports: (f.importSources || []).filter((x) => x.game !== profile.id).map((x) => ({ ext: x.extension.slice(1), bytes: x.bytes })) };
}
// cab: PER-5 — normalised bytes: {file, offset, accept: [bytes], hashAs, variants} (CR-2 A: GAME.OVR 0x4A56 EB/74 hashed as 74)
function normalise(m, name, b) {
  for (const n of m.normalize || []) {
    if (n.file !== name) continue;
    if (!n.accept.includes(b[n.offset])) return { bytes: b, variant: null };
    const variant = (n.variants || {})[String(b[n.offset])] || String(b[n.offset]);
    const c = b.slice(); c[n.offset] = n.hashAs;
    return { bytes: c, variant };
  }
  return { bytes: b, variant: undefined };
}

// ---- storage adapter (IndexedDB; tests can swap in another indexedDB implementation via setIndexedDB) -----------------
let idbFactory = (typeof indexedDB !== 'undefined') ? indexedDB : null;
let dbp = null;
export function setIndexedDB(f) { idbFactory = f; dbp = null; cache.clear(); loaded = false; }
function openDb() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    if (!idbFactory) { rej(new Error('IndexedDB is not available in this browser (private window or blocked site data)')); return; }
    const r = idbFactory.open(DB, 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('files'); r.result.createObjectStore('meta'); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error || new Error('IndexedDB open failed'));
  });
  return dbp;
}
const reqP = (rq) => new Promise((res, rej) => { rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error); });
async function tx(stores, mode, fn) {
  const db = await openDb();
  return new Promise((res, rej) => {
    const t = db.transaction(stores, mode);
    let out;
    Promise.resolve(fn(t)).then((v) => { out = v; }, rej);
    t.oncomplete = () => res(out);
    t.onerror = () => rej(t.error || new Error('IndexedDB transaction failed'));
    t.onabort = () => rej(t.error || new Error('IndexedDB transaction aborted (quota?)'));
  });
}

// ---- manifest -------------------------------------------------------------------------------------------------------
let manifest = null;
export function setManifest(m) { manifest = m; }
export async function loadManifest() {
  if (manifest) return manifest;
  // por-only: fixed v1.3 BYOC manifest (profile: manifest.url; game/profiles/PORONLY.md)
  const r = await fetch(new URL('../byoc/manifest-por-1.3.json', import.meta.url));
  if (!r.ok) throw new Error('manifest-por-1.3.json not found');
  manifest = await r.json();
  return manifest;
}

// ---- candidate collection ---------------------------------------------------------------------------------------
// path normalisation: a top-level folder (POOLRAD/, PoolRad/ ...) is ignored; SAVE/ anywhere marks saves
function candidate(path, size, read) {
  const parts = path.split(/[\\/]/).filter(Boolean);
  const name = parts[parts.length - 1].toUpperCase();
  const dir = parts.slice(0, -1).some((p) => p.toUpperCase() === 'SAVE') ? 'SAVE' : '';
  return { path, name, dir, size, read };
}
export async function collectFromDirectoryHandle(handle, prefix = '') {
  const out = [];
  for await (const [name, h] of handle.entries()) {
    const p = prefix + name;
    if (h.kind === 'directory') out.push(...await collectFromDirectoryHandle(h, p + '/'));
    else { const f = await h.getFile(); out.push(candidate(p, f.size, async () => new Uint8Array(await f.arrayBuffer()))); }
  }
  return out;
}
export function collectFromFileList(fileList) {
  return Array.from(fileList, (f) => candidate(f.webkitRelativePath || f.name, f.size, async () => new Uint8Array(await f.arrayBuffer())));
}
export async function collectFromDataTransfer(dt) {
  const out = [];
  const walk = (entry, prefix) => new Promise((res) => {
    if (entry.isFile) entry.file((f) => { out.push(candidate(prefix + f.name, f.size, async () => new Uint8Array(await f.arrayBuffer()))); res(); }, () => res());
    else if (entry.isDirectory) {
      const rd = entry.createReader(); const all = [];
      const next = () => rd.readEntries(async (es) => {
        if (!es.length) { for (const e of all) await walk(e, prefix + entry.name + '/'); res(); }
        else { all.push(...es); next(); }
      }, () => res());
      next();
    } else res();
  });
  const entries = Array.from(dt.items || []).map((it) => (it.webkitGetAsEntry ? it.webkitGetAsEntry() : null)).filter(Boolean);
  if (entries.length) { for (const e of entries) await walk(e, ''); return out; }
  return collectFromFileList(dt.files || []);
}
// dev mode: the server lists the folder (GET base + '?list' -> ["START.EXE", "SAVE/SAVGAMA.DAT", ...]); without a
// listing, the manifest names are fetched
export async function collectFromUrl(base, names) {
  if (!names) {
    try { const r = await fetch(base + '?list'); if (r.ok) names = await r.json(); } catch { /* no listing */ }
    if (!names) names = Object.keys((await loadManifest()).files);
  }
  const out = [];
  for (const n of names) {
    out.push(candidate(n, -1, async () => {
      const r = await fetch(base + n.split('/').map(encodeURIComponent).join('/'));
      if (!r.ok) throw new Error(`${n}: HTTP ${r.status}`);
      return new Uint8Array(await r.arrayBuffer());
    }));
  }
  return out;
}

// ---- validation -----------------------------------------------------------------------------------------------------
export async function sha256Hex(bytes) {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(d, (x) => x.toString(16).padStart(2, '0')).join('');
}
export async function validate(cands, { onProgress, signal } = {}) {
  const m = await loadManifest();
  const data = new Map(), saves = [];
  for (const c of cands) {
    if (c.dir === 'SAVE') { if (SAVE_RX.test(c.name)) saves.push(c); continue; }
    if (m.files[c.name] && !data.has(c.name)) data.set(c.name, c);
  }
  const names = Object.keys(m.files);
  const files = [], bytes = new Map();
  let n = 0, okCount = 0, nameHits = 0;
  for (const name of names) {
    if (signal && signal.aborted) throw new Error('cancelled');
    const want = m.files[name], c = data.get(name);
    if (onProgress) onProgress(++n, names.length, name);
    if (!c) { files.push({ name, required: want.required, status: 'missing', expectedSize: want.size }); continue; }
    nameHits++;
    if (c.size >= 0 && c.size !== want.size) { files.push({ name, required: want.required, status: 'size', size: c.size, expectedSize: want.size }); continue; }
    let b;
    try { b = await c.read(); } catch (e) { files.push({ name, required: want.required, status: 'missing', expectedSize: want.size, error: String(e.message || e) }); continue; }
    if (b.length !== want.size) { files.push({ name, required: want.required, status: 'size', size: b.length, expectedSize: want.size }); continue; }
    const nb = normalise(m, name, b);                                     // cab: PER-5
    const h = await sha256Hex(nb.bytes);
    if (h !== want.sha256) { files.push({ name, required: want.required, status: 'hash', size: b.length, expectedSize: want.size, sha256: await sha256Hex(b) }); continue; }
    files.push({ name, required: want.required, status: 'ok', size: b.length, ...(nb.variant ? { variant: nb.variant } : {}) });
    if (want.required) { okCount++; if (want.store !== false) bytes.set(name, b); }   // cab: PER-5  store:false = hashed, not stored
  }
  const requiredCount = names.filter((k) => m.files[k].required).length;
  const ovr = files.find((f) => f.name === 'GAME.OVR');
  const variant = (files.find((f) => f.variant) || {}).variant || null;   // cab: PER-5
  const saveRep = await checkSaves(saves);
  return {
    ok: okCount === requiredCount, manifestId: m.id, files, okCount, requiredCount,
    matchRatio: okCount / requiredCount,
    likelyOtherVersion: okCount < requiredCount && nameHits >= 0.8 * requiredCount,
    gameOvr: !ovr || ovr.status === 'missing' ? 'absent' : ovr.status === 'ok' ? 'match' : 'mismatch',
    saves: saveRep, bytes, variant,
  };
}

// SAVE/ files (or any candidates with save names): size / record checks (SAVES.md), bytes kept for importSaves
export async function checkSaves(cands) {
  const saves = cands.filter((c) => SAVE_RX.test(c.name));
  const saveRep = [];
  for (const c of saves) {
    let b = null, ok = true, reason = '';
    try { b = await c.read(); } catch (e) { ok = false; reason = 'unreadable'; }
    if (b) {
      const ext = c.name.slice(-3);
      // por-only: character, item/effect and SAVGAM size validation (profile: recordSizes / saveFormat.gameBytes; game/profiles/PORONLY.md)
      // cab: PER-5  sizes from the profile (Curse 1A6h / 3Fh / 9 / 13149; import sources Pool 11Dh, Hillsfar BCh)
      const e = c.name.slice(c.name.lastIndexOf('.') + 1), imp = SIZES.imports.find((x) => x.ext === e);
      if (e === 'SAV' && c.name.startsWith('CHRDAT') && b.length !== SIZES.char && !SIZES.imports.some((x) => x.ext === 'CHA' && x.bytes === b.length)) { ok = false; reason = 'size ≠ ' + SIZES.char; }
      else if (e === SIZES.rosterExt && !c.name.startsWith('CHRDAT') && b.length !== SIZES.char) { ok = false; reason = 'size ≠ ' + SIZES.char; }
      else if (imp && b.length !== imp.bytes) { ok = false; reason = 'size ≠ ' + imp.bytes; }
      else if ((e === SIZES.itemExt && b.length % SIZES.item) || (e === SIZES.effectExt && b.length % SIZES.effect)) { ok = false; reason = 'size not a record multiple'; }
      else if (c.name.startsWith('SAVGAM') && b.length !== SIZES.game) { ok = false; reason = 'size ≠ ' + SIZES.game; }
    }
    saveRep.push({ name: c.name, size: b ? b.length : c.size, ok, reason, bytes: ok ? b : null });
  }
  return saveRep;
}

// ---- storing ----------------------------------------------------------------------------------------------------
const cache = new Map();      // name -> Uint8Array (after preload / get)
let loaded = false;
export async function importFiles(report) {
  if (!report || !report.ok) throw new Error('import refused: the files do not match manifest ' + (report && report.manifestId));
  let total = 0;
  await tx(['files', 'meta'], 'readwrite', (t) => {
    const fs = t.objectStore('files');
    fs.clear();
    for (const [name, b] of report.bytes) { fs.put(b.slice().buffer, name); total += b.length; }
    t.objectStore('meta').put({ manifest: report.manifestId, importedAt: new Date().toISOString(), count: report.bytes.size,
      bytes: total, gameOvr: report.gameOvr, variant: report.variant || null }, 'meta');   // cab: PER-5 variant
  });
  cache.clear(); for (const [name, b] of report.bytes) cache.set(name, b); loaded = true;
  let persisted = false;
  try { if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) persisted = await navigator.storage.persist(); } catch { /* */ }
  return { stored: report.bytes.size, bytes: total, persisted };
}
export async function importSaves(report, { replace = false } = {}) {
  const files = await import('./files.js');
  const imported = [], conflicts = [], skipped = [];
  for (const s of report.saves) {
    if (!s.ok) { skipped.push(s.name); continue; }
    if (!replace && await files.storeHas(s.name)) { conflicts.push(s.name); continue; }
    await files.writeFile(s.name, s.bytes);
    imported.push(s.name);
  }
  return { imported, conflicts, skipped };
}
// F7: IndexedDB unavailable / quota -> the validated files are served from memory for this tab only
let session = false;
export function useSession(report) {
  if (!report || !report.ok) throw new Error('session refused: the files do not match manifest ' + (report && report.manifestId));
  cache.clear(); for (const [name, b] of report.bytes) cache.set(name, b); loaded = true; session = true;
}
export function sessionActive() { return session; }

// dev mode (serve.py --dev): import the server's /devdata/ copy through the same pipeline; null when there is none
export async function devImport(base = '/devdata/') {
  let names = null;
  try { const r = await fetch(base + '?list'); if (r.ok) names = await r.json(); } catch { /* not in dev mode */ }
  if (!names) return null;
  const rep = await validate(await collectFromUrl(base, names));
  if (!rep.ok) throw new Error('dev data does not match manifest ' + rep.manifestId + ': ' +
    rep.files.filter((f) => f.required && f.status !== 'ok').map((f) => f.name + ' ' + f.status).slice(0, 5).join(', '));
  try { await importFiles(rep); } catch (e) { useSession(rep); }        // no IndexedDB in this profile: memory only
  await importSaves(rep);                                                // never over existing saves
  return rep;
}

export async function info() {
  try { return (await tx(['meta'], 'readonly', (t) => reqP(t.objectStore('meta').get('meta')))) || null; }
  catch { return null; }
}
export async function isImported() {
  const m = await info();
  if (!m) return false;
  const man = await loadManifest();
  if (m.manifest !== man.id) return false;
  const keys = await tx(['files'], 'readonly', (t) => reqP(t.objectStore('files').getAllKeys()));
  const req = Object.keys(man.files).filter((k) => man.files[k].required && man.files[k].store !== false);   // cab: PER-5
  return req.every((k) => keys.includes(k));       // F8: evicted files -> import again
}
export async function preload() {
  const all = await tx(['files'], 'readonly', async (t) => {
    const s = t.objectStore('files');
    const [keys, vals] = await Promise.all([reqP(s.getAllKeys()), reqP(s.getAll())]);
    return keys.map((k, i) => [k, vals[i]]);
  });
  cache.clear(); for (const [k, v] of all) cache.set(k, new Uint8Array(v)); loaded = true;
  return cache.size;
}
// stored original file by (case-insensitive) name, or null
export async function get(name) {
  const k = name.toUpperCase();
  if (cache.has(k)) return cache.get(k);
  if (loaded) return null;
  const v = await tx(['files'], 'readonly', (t) => reqP(t.objectStore('files').get(k)));
  if (v === undefined) return null;
  const b = new Uint8Array(v); cache.set(k, b); return b;
}
export async function removeGameFiles() {
  await tx(['files', 'meta'], 'readwrite', (t) => { t.objectStore('files').clear(); t.objectStore('meta').clear(); });
  cache.clear(); loaded = false;
}
