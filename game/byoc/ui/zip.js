// zip.js — the saves archive of BY-5 (Export saves / Import saves). Writes stored (uncompressed) ZIP files; reads stored
// and deflated entries (DecompressionStream 'deflate-raw'), so a ZIP of save files packed by any tool imports too.

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
export function crc32(b) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// files: [{ name, bytes: Uint8Array }] -> Uint8Array (the date fields are fixed to 1980-01-01)
export function makeZip(files) {
  const enc = new TextEncoder(), local = [], central = [];
  let ofs = 0;
  for (const f of files) {
    const name = enc.encode(f.name), crc = crc32(f.bytes), n = f.bytes.length;
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034B50, true); h.setUint16(4, 20, true); h.setUint16(10, 0, true); h.setUint16(12, 0x21, true);
    h.setUint32(14, crc, true); h.setUint32(18, n, true); h.setUint32(22, n, true); h.setUint16(26, name.length, true);
    local.push(new Uint8Array(h.buffer), name, f.bytes);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014B50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(14, 0x21, true);
    c.setUint32(16, crc, true); c.setUint32(20, n, true); c.setUint32(24, n, true); c.setUint16(28, name.length, true);
    c.setUint32(42, ofs, true);
    central.push(new Uint8Array(c.buffer), name);
    ofs += 30 + name.length + n;
  }
  const cenSize = central.reduce((a, b) => a + b.length, 0);
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054B50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
  e.setUint32(12, cenSize, true); e.setUint32(16, ofs, true);
  const parts = [...local, ...central, new Uint8Array(e.buffer)];
  const out = new Uint8Array(parts.reduce((a, b) => a + b.length, 0));
  let p = 0; for (const x of parts) { out.set(x, p); p += x.length; }
  return out;
}

// Uint8Array -> [{ name, bytes }] (directories skipped); throws on an unsupported archive
export async function readZip(b) {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let e = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 22 - 0xFFFF); i--) if (dv.getUint32(i, true) === 0x06054B50) { e = i; break; }
  if (e < 0) throw new Error('not a ZIP archive');
  const count = dv.getUint16(e + 10, true);
  let p = dv.getUint32(e + 16, true);
  const dec = new TextDecoder(), out = [];
  for (let k = 0; k < count; k++) {
    if (dv.getUint32(p, true) !== 0x02014B50) throw new Error('damaged ZIP directory');
    const method = dv.getUint16(p + 10, true), comp = dv.getUint32(p + 20, true), size = dv.getUint32(p + 24, true);
    const nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
    const lo = dv.getUint32(p + 42, true);
    const name = dec.decode(b.subarray(p + 46, p + 46 + nl));
    p += 46 + nl + xl + cl;
    if (name.endsWith('/')) continue;
    const start = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true);
    const raw = b.subarray(start, start + comp);
    let bytes;
    if (method === 0) bytes = raw.slice();
    else if (method === 8) bytes = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
    else throw new Error(`${name}: ZIP method ${method} not supported`);
    if (bytes.length !== size) throw new Error(`${name}: damaged`);
    out.push({ name, bytes });
  }
  return out;
}
