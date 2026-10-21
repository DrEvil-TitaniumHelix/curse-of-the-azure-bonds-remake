// game/test/areas/import_check.mjs — ES-module import check of every game/areas/*.js (cab-build-areas).
// Pool lesson: `node --check` parses a file but does not link it, so a wrong named import or a missing module passes it;
// importing through a file:// URL links the whole graph. Also reports export names defined by more than one module that
// view_link.js loads (its `X` binds the first one found, so a duplicate can bind the wrong routine).
// Run: node game/test/areas/import_check.mjs   (exit 1 on an import failure or an unexpected duplicate)
import { readdirSync, readFileSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../../areas/', import.meta.url));
let failed = 0;
for (const f of readdirSync(dir).filter((n) => n.endsWith('.js')).sort()) {
  try { await import(pathToFileURL(dir + f).href); console.log('ok  ', f); }
  catch (e) { failed++; console.log('FAIL', f, '-', e.message); }
}

// Duplicates that are intended: the VIEW modules re-export one engine implementation (one function object, no conflict).
const link = readFileSync(dir + 'view_link.js', 'utf8');
const mods = [...link.matchAll(/'(\.{1,2}\/[^']+\.js)'/g)].map((m) => m[1]);
const owner = new Map();
for (const m of mods) {
  let mod;
  try { mod = await import(new URL(m, pathToFileURL(dir)).href); } catch { continue; }   // not built yet
  for (const [k, v] of Object.entries(mod)) {
    if (typeof v !== 'function') continue;
    if (!owner.has(k)) owner.set(k, []);
    owner.get(k).push({ m, v });
  }
}
const SAME_BODY = new Set(['ClearMenuLine']);   // view_ov26 (menus_cab) and text.js: both ClearGlyphRun(0, 24, 0, 40)
let dups = 0;
for (const [k, list] of owner) {
  if (SAME_BODY.has(k)) continue;
  const distinct = new Set(list.map((e) => e.v));
  if (distinct.size > 1) { dups++; console.log('DUP ', k, list.map((e) => e.m).join(' ')); }
}
console.log(`${failed} import failures, ${dups} conflicting duplicate exports`);
process.exit(failed || dups ? 1 : 0);
