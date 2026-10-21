// dax.js — DAX container files (decode/data/DAX.md; JS port of decode/tools/dax.py).
//
// File: u16 dir_size, then dir_size/9 entries {u8 id, u32 offset (from data start = 2 + dir_size), u16 raw, u16 comp},
// then the RLE-packed records. The original files come from the player's own copy, imported into IndexedDB by
// engine/byoc.js (docs/BYOC.md); until the import screens and dev mode are in, the server's read-only /data/ mapping
// (tools/serve.py, env POR_DATA) is the fallback. Nothing of the game is in the repo.

const fileCache = new Map();     // upper-case name -> Uint8Array | null

export let DATA_URL = '/data/';
export function setDataUrl(u) { DATA_URL = u; }
// 'byoc' = files from engine/byoc.js (imported copy), 'url' = fetch DATA_URL + name (fallback / dev)
export let dataSource = 'url';
let byocGet = null;
export function useByoc(get) { byocGet = get; dataSource = 'byoc'; fileCache.clear(); }

export async function fetchFile(name) {
  const key = name.toUpperCase();
  if (fileCache.has(key)) return fileCache.get(key);
  let bytes = null;
  if (dataSource === 'byoc') bytes = await byocGet(key);
  else {
    try {
      const r = await fetch(DATA_URL + encodeURIComponent(key));
      if (r.ok) bytes = new Uint8Array(await r.arrayBuffer());
    } catch (e) { bytes = null; }
  }
  fileCache.set(key, bytes);
  return bytes;
}

// 0802:0193 BiosPromptLine(colour, s): BIOS text (INT 10h, ROM 8x8 font) on row 24, waits for a key, clears the row.
// Fix request #a-5 (ref SY-02). INT 10h in EGA graphics mode: glyph pixels in the colour, the rest of the cell 0.
function BiosFillChars(col, row, colour, count) {                // 0802:01ac  blocks in colour 0 = cleared cells
  const d = picState.display; if (!d) return;
  for (let k = 0; k < count && col + k < 40; k++)
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) d.pix[(row * 8 + y) * 320 + (col + k) * 8 + x] = (colour & 15);
  d.touch();
}
function BiosWriteString(col, row, colour, s) {                  // 0802:01bc
  const d = picState.display; if (!d) return;
  for (let k = 0; k < s.length && col + k < 40; k++) {
    const g = s.charCodeAt(k) & 0xFF;
    for (let y = 0; y < 8; y++) {
      const bits = BIOS_FONT_8X8[g * 8 + y];
      for (let x = 0; x < 8; x++) d.pix[(row * 8 + y) * 320 + (col + k) * 8 + x] = (bits & (0x80 >> x)) ? (colour & 15) : 0;
    }
  }
  d.touch();
}
export async function BiosPromptLine(colour, s) {
  const t = s.slice(0, 40);                                       // 0802:0199
  BiosFillChars(0, 24, 0, 40);                                    // 0802:01ac
  BiosWriteString(0, 24, colour, t);                              // 0802:01bc
  await ReadGameKey();                                            // 0802:01cf  result unused
  BiosFillChars(0, 24, 0, 40);                                    // 0802:01d7
}

// 0802:025D OpenWithPrompt / 0802:05CD OpenDax for DAX files: until the file exists, the yellow prompt
// DiskPromptText{g_2614}[DataSet] + DataPath[1]{g_547D} + ':' (unless NoDiskPrompt g_557C); the file is fetched again
// after each key (the player "inserts the disk").
// cab: PER-10 — Curse OpenDax 0636:07C4 -> OpenWithPrompt 0636:02E5 (CurseAzureBondsRE RESIDENT.pas.md res_0636): the data
// directory is never a floppy here (ProgDir = the hard-disk path), so a missing file repeats the prompt
// 'Couldn''t find ' + name + '. Check install.' (0636:0462) until it is found, unless NoDiskPrompt g_5CF0 (quiet).
export const daxConfig = { curse: false, onBeforeRead: null, onAfterRead: null };
async function OpenDaxCab(n) {
  let bytes = await fetchFile(n);                                 // 0636:034a
  while (!bytes && !G.NoDiskPrompt) {                             // 0636:0416 / 041d
    const dot = n.lastIndexOf('.');
    await BiosPromptLine(0x0E, "Couldn't find " + n.slice(0, dot < 0 ? n.length : dot).toLowerCase() + (dot < 0 ? '' : n.slice(dot)) + '. Check install.');   // 0636:0462
    fileCache.delete(n.toUpperCase());
    bytes = await fetchFile(n);
  }
  return bytes;
}
async function OpenDax(name, ext) {
  const n = name + ext;
  if (daxConfig.curse) return OpenDaxCab(n);                      // cab: PER-10
  let bytes = await fetchFile(n);                                 // 0802:0289 FileExists
  while (!bytes && !G.NoDiskPrompt) {                             // 0802:0295 / 02ad
    // por-only: Pool disk-prompt DS table 2614, dataset suffix and path policy (profile: engine.id (decoded adapter) / daxGroups; game/profiles/PORONLY.md)
    const ds = G.ds, set = picState.DataSet & 0xFF, o = 0x2614 + set * 0x1E;   // string[29], stride 1Eh
    let p = ''; if (ds) for (let i = 1; i <= ds[o]; i++) p += String.fromCharCode(ds[o + i]);
    await BiosPromptLine(0x0E, p + (G.DataDrive || 'C') + ':');   // 0802:0614  g_2614[DataSet] + g_547D + ':'
    fileCache.delete(n.toUpperCase());
    bytes = await fetchFile(n);
  }
  return bytes;
}

// 0802:02EB FileExists
export async function FileExists(name) { return (await fetchFile(name)) !== null; }

// 0802:050F DaxRleDecode: control byte c (signed): 0..7Eh literal run of c+1 bytes; -127..-1 repeat next byte -c times;
// 7Fh / 80h: no progress (engine hangs; never in the shipped data) -> thrown here.
export function DaxRleDecode(src, compSize, rawSize) {
  const dst = new Uint8Array(rawSize);
  let si = 0, di = 0;
  do {
    const c = (src[si] ^ 0x80) - 0x80;
    if (c >= 0 && c <= 0x7E) {                                   // 0802:0533
      for (let k = 0; k <= c; k++) { if (di < rawSize) dst[di] = src[si + 1 + k]; di++; }   // 0802:053b
      si += c + 2;
    } else if (c >= -127 && c <= -1) {                           // 0802:0574
      for (let k = 0; k < -c; k++) { if (di < rawSize) dst[di] = src[si + 1]; di++; }       // 0802:057c
      si += 2;
    } else {
      throw new Error(`DaxRleDecode: control byte ${src[si].toString(16)} at ${si} (engine would hang)`);
    }
  } while (si < compSize);                                        // 0802:05b7
  return dst;
}

// directory of one DAX file
export function readDir(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const dirSize = dv.getUint16(0, true);
  const dataStart = 2 + dirSize;
  const entries = [];
  for (let o = 2; o < dataStart; o += 9) {
    entries.push({ id: bytes[o], ofs: dv.getUint32(o + 1, true), raw: dv.getUint16(o + 5, true), comp: dv.getUint16(o + 7, true) });
  }
  return { dataStart, entries };
}

// 0802:0716 LoadDaxRecord(name, ext, id): returns the decompressed record (Uint8Array) or null (= size 0).
// The directory scan stops at the first entry with the id (0802:0852).
export async function LoadDaxRecord(name, ext, id) {
  if (daxConfig.onBeforeRead) daxConfig.onBeforeRead();           // cab: PER-10  0636:090c PlayOrStopSound(SndStop)
  try {
    return await LoadDaxRecordBody(name, ext, id);
  } finally {
    if (daxConfig.onAfterRead) daxConfig.onAfterRead();           // cab: PER-10  0636:094e / 0a69 / 0afe PlayOrStopSound(SndOutputOn)
  }
}
async function LoadDaxRecordBody(name, ext, id) {
  const bytes = await OpenDax(name, ext);
  if (!bytes) return null;                                        // 0802:077c  OpenDax failed (no-prompt mode; caller reports, ENGINE-12)
  const { dataStart, entries } = readDir(bytes);
  const e = entries.find((x) => x.id === id);
  if (!e) return null;                                            // 0802:0884
  if (e.comp > 36000) {                                           // 0802:080b  (not reachable with the shipped data)
    if (daxConfig.curse) { await BiosPromptLine(0x0E, 'tempsize ' + e.comp); await TerminateGame(); }   // cab: PER-10  0636:09cd / 0a09
    throw new Error(`tempsize ${e.comp}`);
  }
  const src = bytes.subarray(dataStart + e.ofs, dataStart + e.ofs + e.comp);   // 0802:08d4
  const raw = DaxRleDecode(src, e.comp, e.raw);                   // 0802:0920
  const mod = hooks.daxResolver;                                  // GBP W9 mods (hooks request #6); none / original mode: no await
  if (!mod) return raw;
  try { return (await mod(name + ext, id, raw.slice())) ?? raw; } catch (err) { console.error('[hooks] dax resolver: ' + err); return raw; }
}

// 0802:094A SetDataSet(n) / 0802:095D RestoreDataSet (engine request #e1). DataSet g_5376 lives in pictures.js state;
// the previous value g_5377 (PrevDataSet) in G.
import { state as picState } from './pictures.js';
import { BIOS_FONT_8X8 } from './biosfont.js';
import { ReadGameKey, TerminateGame } from './input.js';
import { G } from './state.js';
import { hooks } from '../plus/hooks.js';
export function SetDataSet(n) { G.PrevDataSet = picState.DataSet; picState.DataSet = n & 0xFF; }   // 0802:094d / 0953
export function RestoreDataSet() { picState.DataSet = G.PrevDataSet ?? picState.DataSet; }        // 0802:0960
