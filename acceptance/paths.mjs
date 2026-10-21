// acceptance/paths.mjs (fork of PoolRadianceRE's, por-accept, BYOC step 7) — where acceptance artefacts live.
// Screenshots, reference captures and diff images show the original art pixel for pixel, so they go to the gitignored
// acceptance/local/ tree; only small reports (pixel counts, SHA-256 of every shot) are committed, under acceptance/reports/.
//   local(kind, name)  -> acceptance/local/<kind>/<name>   (created; gitignored)
//   report(kind, name) -> acceptance/reports/<kind>/<name>.json (directory created; committed)
//   refPng(file)       -> acceptance/local/ref/<file> if present, else the legacy tracked acceptance/ref/<file>
//                         (this private repo keeps its earlier refs; the public tree has only the local copy)
import { mkdirSync, existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ACC = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(ACC, '..');
export const LOCAL = join(ACC, 'local');
export const REPORTS = join(ACC, 'reports');

export function local(kind, name = '') {
  const d = join(LOCAL, kind, name);
  mkdirSync(d, { recursive: true });
  return d;
}
export function report(kind, name) {
  mkdirSync(join(REPORTS, kind), { recursive: true });
  return join(REPORTS, kind, `${name.replace(/[\\/]/g, '_')}.json`);
}
export function refPng(file) {
  const l = join(LOCAL, 'ref', file);
  return existsSync(l) ? l : join(ACC, 'ref', file);
}
export const sha256 = (bytesOrPath) =>
  createHash('sha256').update(typeof bytesOrPath === 'string' ? readFileSync(bytesOrPath) : bytesOrPath).digest('hex');
