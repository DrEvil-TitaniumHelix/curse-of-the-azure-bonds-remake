// Minimal DAX reader for the node tests (port of decode/tools/dax.py; the game uses build-engine's engine/dax.js).
// DAX = u16 dir_size, dir_size/9 entries {u8 id, u32 offset, u16 raw, u16 comp}, RLE records (START.EXE 0802:050F).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// default: re-targets/goldbox/cotab/curazure next to this repo (cab fork; env CAB_DEV_DATA)
export const DATA_DIR = process.env.CAB_DEV_DATA || fileURLToPath(new URL('../../../../re-targets/goldbox/cotab/curazure', import.meta.url));

export function rleDecode(src) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c <= 0x7E) { for (let k = 0; k <= c; k++) out.push(src[i + 1 + k]); i += c + 2; }
    else if (c >= 0x81) { for (let k = 0; k < 0x100 - c; k++) out.push(src[i + 1]); i += 2; }
    else throw new Error('DAX control byte ' + c.toString(16) + ' (engine would hang)');
  }
  return Uint8Array.from(out);
}

const cache = new Map();
export function readDax(file) {
  const key = file.toUpperCase();
  if (cache.has(key)) return cache.get(key);
  const data = readFileSync(join(DATA_DIR, file));
  const dirSize = data[0] | (data[1] << 8);
  const recs = new Map();
  for (let i = 0; i < dirSize / 9; i++) {
    const o = 2 + 9 * i;
    const id = data[o], off = data.readUInt32LE(o + 1), raw = data.readUInt16LE(o + 5), comp = data.readUInt16LE(o + 7);
    const b = rleDecode(data.subarray(2 + dirSize + off, 2 + dirSize + off + comp));
    if (b.length !== raw) throw new Error(file + ' record ' + id + ': ' + b.length + ' != ' + raw);
    recs.set(id, b);
  }
  cache.set(key, recs);
  return recs;
}

export function loadRecord(name, ext, id) {
  try { return readDax(name + ext).get(id) || null; } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
}
