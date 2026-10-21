// Quest texts from the player's imported ECLn.DAX (W5, gbp-flags). A table text is [dataSet, block, ECL address] of a
// PRINT / PRINTCLEAR / SAVE instruction whose first operand is packed text (type 80h, decode/ecl/ECL_VM.md §2, §2.2).
import { readDir, DaxRleDecode } from '../../engine/dax.js';
import { refKey, textRefs } from './table.js';

const BASE = 0x8000;   // cab: ECL code buffer address of record byte 2 (Curse 8000h, ECL_VM.md §3; Pool 9900h); the record's 2-byte header is skipped by LoadEclBlock

// ecl_UnpackString (Curse: same shape as Pool 4300:1153, ECL_VM.md §2.2) / engine/ecl.js unpackString: four 6-bit codes per 3 bytes, code 0 skipped,
// 01..1F -> 'A'..'_', 20..3F -> themselves; a phase ending on 4 adds the last group's c4.
export function unpackText(bytes, offset, len) {
  let s = '', n = 0, phase = 1, cur = 0, prev = 0, c = 0, p = offset - 1;
  const add = (code) => { if (s.length < 255) s += String.fromCharCode(code > 0x1F ? code : code + 0x40); };
  while (n < len) {
    if (phase < 4) { prev = cur; cur = bytes[++p]; n++; }
    if (phase === 1) c = cur >> 2;
    else if (phase === 2) c = ((prev & 3) << 4) | (cur >> 4);
    else if (phase === 3) c = ((prev & 0x0F) << 2) | (cur >> 6);
    else c = cur & 0x3F;
    phase = phase < 4 ? phase + 1 : 1;
    if (c !== 0) add(c);
  }
  if (phase === 4 && (cur & 0x3F) !== 0) add(cur & 0x3F);
  return s;
}

// text of the first operand of the instruction at ECL address `at` in a decompressed ECL record
export function textAt(record, at) {
  const i = 2 + at - BASE;
  if (!(record instanceof Uint8Array) || i < 2 || i + 3 > record.length) throw new Error(`ECL address ${at.toString(16)} outside the record`);
  if (record[i + 1] !== 0x80) throw new Error(`ECL ${at.toString(16)}: first operand is not packed text`);
  const len = record[i + 2];
  if (i + 3 + len > record.length) throw new Error(`ECL ${at.toString(16)}: truncated text`);
  return unpackText(record, i + 3, len);
}

export function daxRecord(bytes, id) {
  const dir = readDir(bytes);
  const e = dir.entries.find((x) => x.id === id);
  if (!e || dir.dataStart + e.ofs + e.comp > bytes.length) return null;
  return DaxRleDecode(bytes.subarray(dir.dataStart + e.ofs, dir.dataStart + e.ofs + e.comp), e.comp, e.raw);
}

// Map refKey -> text for every table text that the imported files hold (missing files/records are skipped).
export async function loadQuestTexts({ refs = textRefs(), readFile } = {}) {
  if (!readFile) readFile = (await import('../../engine/dax.js')).fetchFile;
  const files = new Map(), out = new Map();
  for (const ref of refs) {
    const [ds, block, at] = ref;
    const name = `ECL${ds}.DAX`;
    if (!files.has(name)) files.set(name, Promise.resolve(readFile(name)).catch(() => null));
    const bytes = await files.get(name);
    if (!bytes) continue;
    try { const rec = daxRecord(bytes, block); if (rec) out.set(refKey(ref), textAt(rec, at)); } catch { /* keep the others */ }
  }
  return out;
}
