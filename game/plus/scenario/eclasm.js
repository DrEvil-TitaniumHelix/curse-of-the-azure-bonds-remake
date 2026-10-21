// eclasm.js (cab-plus-shell, S7 W12): the ECL assembler for Curse scenarios. It assembles the address listings of
// decode/tools/ecldis.py (the format of decode/ecl/scripts/ECL<n>_<rec>.ecl.txt) back into the record bytes, byte for
// byte (game/test/plus/eclasm.test.mjs: all 25 records against the player's ECLn.DAX). Port of Pool's tools/eclasm.py to
// the Curse opcode table (ecldis.py OPS / VARCOUNT, ECL_VM.md section 4); it never executes listing text.
// Operand notation (ecldis.py Operand.fmt): #nn byte, #nnnn word, [nnnn] memory, [nnnn]' type 3, $[nnnn] string memory,
// "TEXT" packed six-bit string, ?tTT:LL any other type byte.
export const BASE = 0x8000;
export const OPS = Object.freeze({
  0x00: ['EXIT', 0], 0x01: ['GOTO', 1], 0x02: ['GOSUB', 1], 0x03: ['COMPARE', 2], 0x04: ['ADD', 3], 0x05: ['SUBTRACT', 3],
  0x06: ['DIVIDE', 3], 0x07: ['MULTIPLY', 3], 0x08: ['RANDOM', 2], 0x09: ['SAVE', 2], 0x0A: ['LOAD_CHARACTER', 1],
  0x0B: ['LOAD_MONSTER', 3], 0x0C: ['SETUP_MONSTER', 3], 0x0D: ['APPROACH', 0], 0x0E: ['PICTURE', 1], 0x0F: ['INPUT_NUMBER', 2],
  0x10: ['INPUT_STRING', 2], 0x11: ['PRINT', 1], 0x12: ['PRINTCLEAR', 1], 0x13: ['RETURN', 0], 0x14: ['COMPARE_AND', 4],
  0x15: ['VERTICAL_MENU', 3], 0x16: ['IF_EQ', 0], 0x17: ['IF_NE', 0], 0x18: ['IF_LT', 0], 0x19: ['IF_GT', 0], 0x1A: ['IF_LE', 0],
  0x1B: ['IF_GE', 0], 0x1C: ['CLEAR_MONSTERS', 0], 0x1D: ['PARTY_STRENGTH', 1], 0x1E: ['CHECK_PARTY', 6], 0x20: ['NEW_ECL', 1],
  0x21: ['LOAD_FILES', 3], 0x22: ['PARTY_SURPRISE', 2], 0x23: ['SURPRISE', 4], 0x24: ['COMBAT', 0], 0x25: ['ON_GOTO', 2],
  0x26: ['ON_GOSUB', 2], 0x27: ['TREASURE', 8], 0x28: ['ROB', 3], 0x29: ['ENCOUNTER_MENU', 14], 0x2A: ['GET_TABLE', 3],
  0x2B: ['HORIZONTAL_MENU', 2], 0x2C: ['PARLAY', 6], 0x2D: ['CALL', 1], 0x2E: ['DAMAGE', 5], 0x2F: ['AND', 3], 0x30: ['OR', 3],
  0x31: ['SPRITE_OFF', 0], 0x32: ['FIND_ITEM', 1], 0x33: ['PRINT_RETURN', 0], 0x34: ['ECL_CLOCK', 2], 0x35: ['SAVE_TABLE', 3],
  0x36: ['ADD_NPC', 2], 0x37: ['LOAD_PIECES', 3], 0x38: ['PROGRAM', 1], 0x39: ['WHO', 1], 0x3A: ['DELAY', 0], 0x3B: ['SPELL', 3],
  0x3C: ['PROTECTION', 1], 0x3D: ['CLEAR_BOX', 0], 0x3E: ['DUMP', 0], 0x3F: ['FIND_SPECIAL', 1], 0x40: ['DESTROY_ITEMS', 1],
});
export const VARCOUNT = Object.freeze({ 0x15: 3, 0x25: 2, 0x26: 2, 0x2B: 2 });   // opcode -> 1-based operand holding the extra count
const MNEMONICS = new Map(Object.entries(OPS).map(([op, [name, n]]) => [name, [Number(op), n]]));
const hex = (n, w) => n.toString(16).toUpperCase().padStart(w, '0');

// ecl_UnpackString ov07_12AE / ecldis.py unpack_string (to compare a preview with its text form)
export function unpackString(data) {
  const out = []; let phase = 1, cur = 0, prev = 0, i = 0;
  const ch = (v) => String.fromCharCode(v < 0x20 ? v + 0x40 : v);
  while (i < data.length) {
    if (phase < 4) { prev = cur; cur = data[i++]; }
    let c;
    if (phase === 1) c = cur >> 2;
    else if (phase === 2) c = ((((prev << 6) & 0xFF) + (cur >> 2)) & 0xFF) >> 2;
    else if (phase === 3) c = ((((prev << 4) & 0xFF) + (cur >> 4)) & 0xFF) >> 2;
    else c = cur & 0x3F;
    phase = phase < 4 ? phase + 1 : 1;
    if (c) out.push(ch(c));
  }
  if (phase === 4 && (cur & 0x3F)) out.push(ch(cur & 0x3F));
  return out.join('');
}
// six-bit packing (A.._ -> 1..31, space..? -> 32..63), MSB first, padded with zero bits
export function packString(text) {
  let bits = '';
  for (const c of text) {
    const n = c.charCodeAt(0);
    if (n >= 65 && n <= 95) bits += (n - 64).toString(2).padStart(6, '0');
    else if (n >= 32 && n <= 63) bits += n.toString(2).padStart(6, '0');
    else throw new Error('packed text supports ASCII space.._ except @');
  }
  bits += '0'.repeat((8 - bits.length % 8) % 8);
  const out = new Uint8Array(bits.length / 8);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  return out;
}
export function encodeOperand(token) {
  let m;
  if (token.startsWith('"') && token.endsWith('"') && token.length >= 2) {
    const data = packString(token.slice(1, -1)); if (data.length > 255) throw new Error('packed string exceeds 255 bytes');
    return [0x80, data.length, ...data];
  }
  if ((m = /^#([0-9A-Fa-f]{2}|[0-9A-Fa-f]{4})$/.exec(token))) { const n = parseInt(m[1], 16); return m[1].length === 2 ? [0, n] : [2, n & 255, n >> 8]; }
  if ((m = /^(\$)?\[([0-9A-Fa-f]{4})\](')?$/.exec(token))) { const n = parseInt(m[2], 16); return [m[1] ? 0x81 : m[3] ? 3 : 1, n & 255, n >> 8]; }
  if ((m = /^\?t([0-9A-Fa-f]{2}):([0-9A-Fa-f]{2})$/.exec(token))) return [parseInt(m[1], 16), parseInt(m[2], 16)];
  throw new Error('invalid operand: ' + token);
}
// ecl_ReadOperands ov07_0034 on a byte array (index of the opcode) -> { ops: [text], end }
function readOperands(b, at, n) {
  const ops = []; let pc = at;
  for (let k = 0; k < n; k++) {
    const t = b[pc + 1], lo = b[pc + 2]; if (t === undefined || lo === undefined) throw new Error('operand past end');
    pc += 2;
    if (t === 1 || t === 2 || t === 3) { pc += 1; const w = lo | (b[pc] << 8); ops.push(t === 2 ? '#' + hex(w, 4) : `[${hex(w, 4)}]${t === 3 ? "'" : ''}`); }
    else if (t === 0x80) { const data = b.slice(pc + 1, pc + 1 + lo); if (data.length < lo) throw new Error('string past end'); pc += lo; ops.push(`"${unpackString(data)}"`); }
    else if (t === 0x81) { pc += 1; ops.push(`$[${hex(lo | (b[pc] << 8), 4)}]`); }
    else if (t === 0) ops.push('#' + hex(lo, 2));
    else ops.push(`?t${hex(t, 2)}:${hex(lo, 2)}`);
  }
  return { ops, end: pc + 1 };
}
function decodePreview(b) {
  const op = b[0]; if (!(op in OPS)) return null;
  const [name, n] = OPS[op];
  let { ops, end } = readOperands(b, 0, n);
  if (op in VARCOUNT) { const t = ops[VARCOUNT[op] - 1]; if (/^#/.test(t)) { const more = readOperands(b, end - 1, parseInt(t.slice(1), 16) & 255); ops = ops.concat(more.ops); end = more.end; } }
  return { name, ops, end };
}
const TOKEN = /".*?"(?=, |   ;|$)|\$?\[[0-9A-Fa-f]{4}\]'?|#[0-9A-Fa-f]{2,4}|\?t[0-9A-Fa-f]{2}:[0-9A-Fa-f]{2}/g;

// listing text -> record bytes (2-byte header + code BASE..end)
export function assemble(text) {
  const header = /record header \(skipped by LoadEclBlock\): ([0-9a-fA-F ]+?) ; code ([0-9A-Fa-f]+)\.\.([0-9A-Fa-f]+)/.exec(text);
  if (!header) throw new Error('missing record header / code extent comment');
  const prefix = header[1].trim().split(/\s+/).map((h) => parseInt(h, 16)), end = parseInt(header[3], 16) + 1;
  if (prefix.length !== 2 || parseInt(header[2], 16) !== BASE || end < BASE || end > 0x10000) throw new Error('invalid record extent');
  const image = new Map();
  text.split(/\r?\n/).forEach((line, index) => {
    const m = /^([0-9A-Fa-f]{4})  (.*)$/.exec(line); if (!m) return;
    const address = parseInt(m[1], 16), body = m[2];
    try {
      let data;
      if (body.startsWith('db ')) data = body.slice(3).split(';')[0].trim().split(/\s+/).map((h) => parseInt(h, 16));
      else {
        const p = /^((?:[0-9A-Fa-f]{2} )*(?:[0-9A-Fa-f]{2})(?: \.\.)?) +(.+)$/.exec(body);
        if (!p) throw new Error('missing byte preview / instruction');
        const preview = p[1].replace(' ..', '').split(' ').map((h) => parseInt(h, 16)), instruction = p[2];
        if (instruction.startsWith('???')) data = preview;
        else if (instruction.includes('; header vector')) { const target = parseInt(instruction.split(/\s+/)[1], 16); data = [...preview.slice(0, 2), target & 255, target >> 8]; }
        else {
          const sp = instruction.indexOf(' '), name = sp < 0 ? instruction : instruction.slice(0, sp);
          let tail = sp < 0 ? '' : instruction.slice(sp + 1).trim();
          if (!MNEMONICS.has(name)) throw new Error('unknown mnemonic ' + name);
          const [op, count] = MNEMONICS.get(name);
          const c = tail.search(/   ;/); if (c >= 0) tail = tail.slice(0, c);
          const tokens = tail.match(TOKEN) || [];
          if (tokens.join(', ') !== tail) throw new Error('invalid operand sequence');
          const encoded = tokens.map(encodeOperand);
          let expected = count;
          if (op in VARCOUNT && encoded.length >= count) { const k = VARCOUNT[op] - 1; if (encoded[k][0] === 0 || encoded[k][0] === 2) expected += encoded[k][1]; }
          if (encoded.length !== expected) throw new Error('wrong operand count');
          data = [op, ...encoded.flat()];
          if (!p[1].includes('..')) {   // a complete preview may keep padding the text form omits
            let d = null; try { d = decodePreview(preview); } catch { d = null; }   // a hand-written preview may be partial
            if (d && d.name === name && d.ops.join('\u0000') === tokens.join('\u0000')) data = preview;
          }
        }
      }
      data.forEach((byte, k) => {
        const pos = address + k;
        if (pos < BASE || pos >= end) throw new Error('write outside record extent');
        if (image.has(pos) && image.get(pos) !== byte) throw new Error('conflicting overlapping instruction/data');
        image.set(pos, byte);
      });
    } catch (e) { throw new Error(`line ${index + 1}, ${hex(address, 4)}: ${e.message}`); }
  });
  const out = new Uint8Array(2 + end - BASE); out.set(prefix, 0);
  for (let a = BASE; a < end; a++) {
    if (!image.has(a)) throw new Error(`listing leaves bytes uncovered (first ${hex(a, 4)}); truncated listings cannot be recovered`);
    out[2 + a - BASE] = image.get(a);
  }
  return out;
}
