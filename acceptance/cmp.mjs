// cmp.mjs (cab-build-engine) — exact-RGB pixel comparison of a build shot against a DOSBox reference, the rule of
// acceptance/ref/compare.py (320x200, or an exact 2x nearest 640x400 reduced to 320x200; no palette remap, no tolerance)
// without NumPy: Node's zlib + a small PNG decoder (8-bit grey / RGB / RGBA / palette, non-interlaced).
// Usage: node acceptance/cmp.mjs <ref.png> <shot.png> [--json out.json]   -> prints "<n>/64000 pixels differ" (exit 1 if n > 0)
//        node acceptance/cmp.mjs --pairs REF-S010=S010 REF-S011=S011 ...  (acceptance/local/ref/<a>.png vs acceptance/local/shoot/<b>.png)
import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ACC = dirname(fileURLToPath(import.meta.url));

export function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504E47) throw new Error('not a PNG');
  let o = 8, w, h, depth, type, inter, pal = null; const idat = [];
  while (o < buf.length) {
    const len = buf.readUInt32BE(o), t = buf.toString('latin1', o + 4, o + 8), d = buf.subarray(o + 8, o + 8 + len);
    if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); depth = d[8]; type = d[9]; inter = d[12]; }
    else if (t === 'PLTE') pal = d;
    else if (t === 'IDAT') idat.push(d);
    else if (t === 'IEND') break;
    o += 12 + len;
  }
  if (depth !== 8 || inter) throw new Error(`unsupported PNG (depth ${depth}, interlace ${inter})`);
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
  const raw = inflateSync(Buffer.concat(idat)), stride = w * ch, out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? out[y * stride + x - ch] : 0, b = y ? out[(y - 1) * stride + x] : 0, c = x >= ch && y ? out[(y - 1) * stride + x - ch] : 0;
      let v = src[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[y * stride + x] = v & 0xFF;
    }
  }
  const rgb = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    if (type === 2 || type === 6) { rgb[i * 3] = out[i * ch]; rgb[i * 3 + 1] = out[i * ch + 1]; rgb[i * 3 + 2] = out[i * ch + 2]; }
    else if (type === 3) { const k = out[i]; rgb[i * 3] = pal[k * 3]; rgb[i * 3 + 1] = pal[k * 3 + 1]; rgb[i * 3 + 2] = pal[k * 3 + 2]; }
    else { rgb[i * 3] = rgb[i * 3 + 1] = rgb[i * 3 + 2] = out[i * ch]; }
  }
  return { w, h, rgb };
}

function raster(path) {
  const p = decodePng(readFileSync(path));
  if (p.w === 640 && p.h === 400) {                       // exact 2x nearest only
    const lo = Buffer.alloc(320 * 200 * 3);
    for (let y = 0; y < 400; y++) for (let x = 0; x < 640; x++) for (let k = 0; k < 3; k++) {
      const v = p.rgb[(y * 640 + x) * 3 + k], q = ((y >> 1) * 320 + (x >> 1)) * 3 + k;
      if (!(y & 1) && !(x & 1)) lo[q] = v; else if (lo[q] !== v) throw new Error(`${path}: not exact 2x nearest pixels`);
    }
    return lo;
  }
  if (p.w !== 320 || p.h !== 200) throw new Error(`${path}: unexpected size ${p.w}x${p.h}`);
  return p.rgb;
}

export function compare(refPath, shotPath) {
  const a = raster(refPath), b = raster(shotPath);
  let n = 0, x1 = 999, y1 = 999, x2 = -1, y2 = -1; const cells = new Set();
  for (let i = 0; i < 64000; i++) {
    if (a[i * 3] !== b[i * 3] || a[i * 3 + 1] !== b[i * 3 + 1] || a[i * 3 + 2] !== b[i * 3 + 2]) {
      n++; const x = i % 320, y = (i / 320) | 0;
      x1 = Math.min(x1, x); y1 = Math.min(y1, y); x2 = Math.max(x2, x); y2 = Math.max(y2, y); cells.add(`${y >> 3},${x >> 3}`);
    }
  }
  return { reference: refPath, render: shotPath, mismatch_pixels: n, total_pixels: 64000, bbox_inclusive: n ? [x1, y1, x2, y2] : null,
    mismatching_8x8_cells: [...cells].slice(0, 200).map((s) => { const [row, col] = s.split(','); return { row: +row, col: +col }; }) };
}

const args = process.argv.slice(2);
if (args[0] === '--pairs') {
  let bad = 0;
  for (const p of args.slice(1)) {
    const [r, s] = p.split('=');
    const res = compare(join(ACC, 'local', 'ref', r + '.png'), join(ACC, 'local', 'shoot', s + '.png'));
    console.log(`${r} vs ${s}: ${res.mismatch_pixels}/64000 px${res.bbox_inclusive ? ' bbox ' + res.bbox_inclusive.join(',') : ''}`);
    if (res.mismatch_pixels) bad++;
  }
  process.exit(bad ? 1 : 0);
} else if (args.length >= 2) {
  const res = compare(args[0], args[1]);
  const j = args.indexOf('--json'); if (j > 0) writeFileSync(args[j + 1], JSON.stringify(res, null, 1) + '\n');
  console.log(`${res.mismatch_pixels}/64000 pixels differ${res.bbox_inclusive ? ' bbox ' + res.bbox_inclusive.join(',') : ''}`);
  process.exit(res.mismatch_pixels ? 1 : 0);
}
