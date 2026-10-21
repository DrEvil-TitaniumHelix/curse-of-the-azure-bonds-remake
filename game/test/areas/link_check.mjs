// game/test/areas/link_check.mjs — every `X.Name(` used by the area files must be exported by a module that
// view_link.js loads (cab-build-areas). Run: node game/test/areas/link_check.mjs   (lists unbound names; exit 1 if any)
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const dir = fileURLToPath(new URL('../../areas/', import.meta.url));
const mine = readdirSync(dir).filter((f) => /^(view|party|magic|combat)_.*\.js$/.test(f) && f !== 'view_link.js');
const used = new Map();
for (const f of mine) for (const m of readFileSync(dir + f, 'utf8').matchAll(/\bX\.([A-Za-z_]\w*)\s*\(/g)) {
  if (!used.has(m[1])) used.set(m[1], new Set()); used.get(m[1]).add(f);
}
const link = readFileSync(dir + 'view_link.js', 'utf8');
const mods = [...link.matchAll(/'(\.{1,2}\/[^']+\.js)'/g)].map((m) => m[1]);
const exported = new Set();
for (const m of mods) {
  try { const mod = await import(new URL(m, new URL('../../areas/', import.meta.url))); for (const k of Object.keys(mod)) exported.add(k); }
  catch { /* not built */ }
}
const missing = [...used.keys()].filter((k) => !exported.has(k)).sort();
for (const k of missing) console.log('unbound', k, '<-', [...used.get(k)].join(', '));
console.log(`${used.size} names used, ${missing.length} unbound`);
process.exit(missing.length ? 1 : 0);
