// game/test/areas/fixture.mjs — shared set-up for the area unit tests (cab-build-areas).
// - loadDS(): G.ds = the DS image of the player's START.EXE (profile cab.json engine.state: not EXEPACK'ed, header 7B0h,
//   DS 0C1C at load-module offset C1C0h, 8F00h bytes incl. BSS) + ITEMS read into ItemTypeTable DS:5CF6 (810h bytes,
//   ENGINE ov11 3500:06a8). Data folder: env CAB_DEV_DATA, else re-targets/goldbox/cotab/curazure next to the repo
//   (read-only; nothing is copied into the repo).
// - loadSave(rel): a DOSBox-made character record from acceptance/local/saves (gitignored; decode/data/SAVES.md).
// Tests that need a missing file are skipped with a note, never failed.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { G, newChar, configureState } from '../../engine/state.js';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const profile = JSON.parse(readFileSync(path.join(ROOT, 'game/profiles/cab.json'), 'utf8'));
configureState(null, profile.recordSizes);                         // 422-byte TChar (cab: param recordSizes)
export const DATA = process.env.CAB_DEV_DATA || path.resolve(ROOT, '../re-targets/goldbox/cotab/curazure');

export function loadDS() {
  const exe = path.join(DATA, 'START.EXE');
  if (!existsSync(exe)) return false;
  const b = readFileSync(exe);
  const hdr = (b[8] | (b[9] << 8)) * 16;                          // e_cparhdr (7B0h)
  const ds = new Uint8Array(0x8F00);
  ds.set(b.subarray(hdr + 0xC1C0, Math.min(b.length, hdr + 0xC1C0 + 0x8F00)));
  const items = path.join(DATA, 'ITEMS');
  if (existsSync(items)) ds.set(readFileSync(items).subarray(0, 0x810), 0x5CF6);
  G.ds = ds;
  return true;
}

export function loadSave(rel) {
  const f = path.join(ROOT, 'acceptance/local/saves', rel);
  if (!existsSync(f)) return null;
  const c = newChar();
  c.b.set(readFileSync(f).subarray(0, 0x1A6));
  c.readied = new Array(13).fill(null);
  return c;
}

let n = 0, skipped = 0;
export function test(name, f) {
  return Promise.resolve().then(f).then((r) => {
    if (r === 'skip') { skipped++; console.log('skip', name); } else { n++; console.log('ok  ', name); }
  });
}
export function done(area) { console.log(`${area}: ${n} checks passed, ${skipped} skipped`); }
