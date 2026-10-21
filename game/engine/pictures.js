// pictures.js — picture records and blits (ENGINE res_0464, decode/pseudo/ENGINE.pas.md; formats decode/data/PICTURES.md),
// the 8x8 symbol sets (VIEW ov34), A-record animations (VIEW ov28 LoadAnimation).
//
// Memory model: the original converts the 4-bpp DAX pixels into the EGA planar format (VideoMode 1). Here a picture keeps
// one colour index per pixel (`px`) and one transparency flag per pixel (`mask`, 1 = transparent), which is what the EGA
// plane bytes + mask byte encode. Offsets in the view dirty tables are kept in EGA byte units (4 bytes per 8-pixel cell,
// rows of width8*4 bytes) so that the bookkeeping quirks of the original stay visible in the same numbers.

import { LoadDaxRecord } from './dax.js';
import { Random } from './tp.js';
import { fatal } from './errors.js';
import { FlushGameKeys } from './input.js';
import { G } from './state.js';

// cab: PER-7 — per-game picture parameters (Curse fork, game/FORK.md; CurseAzureBondsRE RESIDENT.pas.md res_0297, VIEW ov35):
// symbolMax: last 8x8 symbol id (Curse block 4 = 100h..127h, 8X8D1/202 has 40 tiles; Pool 11Eh);
// curseBlits: Curse's assembly blitters (0297:21E3..2AAA): one EGA mask byte per plane byte, so no signed-byte row counter
// (Pool quirk 0464:0c1f / 139d), DrawPicture always clips with the 0297:22FE/258F rules (opaque rows shear when clipped);
// flushAfterLoad: LoadPicture ends with FlushGameKeys (0297:02a2; Pool called the disabled 0899:0104).
export const config = { symbolMax: 0x11E, curseBlits: false, flushAfterLoad: false };
export function configurePictures(c) { Object.assign(config, c); }

export const state = {
  DataPath: '',            // g_547C (POOL.CFG line 3); the browser build reads everything from /data/
  get DataSet() { return G.DataSet ?? 1; }, set DataSet(v) { G.DataSet = v; },   // g_5376 (Curse g_5BEE)  cab: PER-7 one DataSet: the DS global
  ClipPictures: 1,         // g_5370 (DrawPicture clipping)
  display: null,           // the screen (display.js)
  viewPic: null,           // g_4A20 off-screen view picture (168 lines x 21 cells), AllocPicture'd by InitGameState
  saveBuf: null,           // g_4A24 PicSaveBuffer (DrawPicture flag 4)
  symbolPic: null,         // g_5E4E 8x8 scratch picture
  SymbolSets: [null, null, null, null, null],   // g_5E3A[0..4]
};

// view dirty tables (g_4A28 view_LineDirty, g_4C20 view_SpanFirst, g_4AD0 view_SpanScreenX, g_4D70 view_SpanLast)
// por-only: 168-line Pool view buffer and span geometry (profile: engine.id (decoded adapter); game/profiles/PORONLY.md)
const LINES = 0xA8;
export const lineDirty = new Uint8Array(LINES);
export const spanFirst = new Uint32Array(LINES).fill(0xFFFF);
export const spanScreenX = new Int32Array(LINES);
export const spanLast = new Int32Array(LINES);

function markSpan(line, ofs, screenX) {
  if (line < 0 || line >= LINES) return;
  lineDirty[line] = 1;
  if (spanFirst[line] > ofs) { spanScreenX[line] = screenX; spanFirst[line] = ofs; }
}
function markLast(line, ofsEnd) {
  if (line < 0 || line >= LINES) return;
  if (ofsEnd - 1 > spanLast[line]) spanLast[line] = ofsEnd - 1;
}

// 0464:248E AllocPicture(height, width8, count, flags)
export function AllocPicture(height, width8, count, flags) {
  const n = count * height * width8 * 8;
  return {
    height, width8, x: 0, y: 0, count, cgaMap: new Uint8Array(8),
    frameSize: height * width8 * 4,             // EGA bytes per frame (0464:2494 / 249f)
    px: new Uint8Array(n),
    mask: (flags & 1) ? new Uint8Array(n) : null,
  };
}

// 0464:2595 FreePicture — garbage collected; kept for call-site fidelity
export function FreePicture(pic) { return null; }

function parseHeader(b, o) {
  const dv = new DataView(b.buffer, b.byteOffset + o);
  return { height: dv.getUint16(0, true), width8: dv.getUint16(2, true), x: dv.getUint16(4, true), y: dv.getUint16(6, true),
    count: b[o + 8], cgaMap: b.slice(o + 9, o + 17) };
}

// 0464:02A5 ConvertPicturePixels (EGA path): 4-bpp nibbles (high nibble = left pixel) -> pixels; mask where pixel = transpColour;
// masked pixels are cleared to 0 in the data (0464:072a "and not mask").
function convertPixels(src, ofs, transpColour, pic, firstFrame = 0, nFrames = pic.count) {
  const fpx = pic.height * pic.width8 * 8;
  let pi = firstFrame * fpx;
  const bytes = nFrames * fpx / 2;
  for (let i = 0; i < bytes; i++) {
    const b = src[ofs + i];
    for (const nib of [b >> 4, b & 15]) {
      if (pic.mask && nib === transpColour) { pic.mask[pi] = 1; pic.px[pi] = 0; }
      else pic.px[pi] = nib;
      pi++;
    }
  }
}

// cab: PER-7 (engine request #8)  0297:02AD ConvertPicturePixels(src, ofs, maskFlags, transpColour, pic) in Curse Pascal order:
// all frames of pic from the 4-bpp bytes at src[ofs..]; maskFlags is not read (the mask pointer decides, RESIDENT.pas.md)
export function ConvertPicturePixels(src, ofs, maskFlags, transpColour, pic) {
  if (!pic) return;                                                       // 0297:02b3
  convertPixels(src, ofs, transpColour, pic);                             // 0297:060f .. 07a8 (EGA)
}
// cab: PER-7 (engine request #8)  0297:2171 SetEgaPaletteRegister(index, colour) / 0297:21B0 SetEgaPaletteRegisterRaw(index, value)
export function SetEgaPaletteRegister(index, colour) { state.display.setPaletteRegister(index, colour); }
export function SetEgaPaletteRegisterRaw(index, value) { state.display.palette[index & 15] = value & 0xFF; state.display.touch(); }

// 0464:0111 LoadPicture(name, id, maskFlags, transpColour) -> picture or null (record missing: size 0, silent)
export async function LoadPicture(name, id, maskFlags, transpColour) {
  const buf = await LoadDaxRecord(state.DataPath + name, '.dax', id);   // 0464:0141
  if (!buf || buf.length === 0) return null;                              // 0464:016c
  const h = parseHeader(buf, 0);                                          // 0464:0176 .. 01ef
  const pic = AllocPicture(h.height, h.width8, h.count, maskFlags);       // 0464:0208
  pic.x = h.x; pic.y = h.y; pic.cgaMap = h.cgaMap;                        // 0464:0230 .. 0248
  convertPixels(buf, 0x11, transpColour, pic);                            // 0464:0267
  if (config.flushAfterLoad) await FlushGameKeys();                       // cab: PER-7  0297:02a2
  return pic;
}

// ---------------------------------------------------------------------------------------------------------------------
// 0464:1951 PutPicture(col, row, pic): frame 0 straight to video at cell (col,row), opaque, no clipping
export function PutPicture(col, row, pic) {
  if (!pic) return;                                                       // 0464:1957
  const d = state.display, w = pic.width8 * 8;
  for (let y = 0; y < pic.height; y++) {                                  // 0464:1a2f
    const sy = row * 8 + y;
    if (sy < 0 || sy >= 200) continue;
    for (let x = 0; x < w; x++) {
      const sx = col * 8 + x;
      if (sx >= 0 && sx < 320) d.pix[sy * 320 + sx] = pic.px[y * w + x];
    }
  }
  d.touch();
}

// 0464:08D4 DrawPictureInto(x, y, frame, flags, src, dst): frame of src into dst at cell (x, y); flags bit 0 = transparent
export function DrawPictureInto(x, y, frame, flags, src, dst) {
  const useMask = (flags & 1) !== 0 && src.mask !== null;                 // 0464:08da
  let row = y * 8;                                                        // 0464:08f9
  const sw = src.width8 * 8, dw = dst.width8 * 8;
  const rowBytes = src.width8 * 4;                                        // 0464:0b81
  const fofs = frame * src.height * sw;
  let d = row * dst.width8 * 4;                                           // 0464:0903 / 0bc0
  const gap = (dst.width8 - (x + src.width8)) * 4;
  for (let r = 0; r < src.height; r++) {                                  // 0464:0bd3
    d += x * 4;                                                           // 0464:0bf3
    markSpan(row, d, x);                                                  // 0464:0bf9  (EGA: cell x stored)
    // quirk 0464:0c1f: masked loop counter is a signed byte -> rows of >= 128 bytes copy nothing when masked
    if (config.curseBlits || !(useMask && rowBytes >= 128)) {            // cab: PER-7  Curse RowCopyMasked 0297:2A18: no such quirk
      for (let c = 0; c < sw; c++) {
        const dx = x * 8 + c, sp = fofs + r * sw + c;
        if (row < 0 || row >= dst.height || dx < 0 || dx >= dw) continue;
        if (useMask && src.mask[sp]) continue;
        dst.px[row * dw + dx] = src.px[sp];
      }
    }
    d += rowBytes;
    markLast(row, d);                                                     // 0464:0c8c
    d += gap;
    row++;
  }
}

// 0464:0D71 DrawPicture(col, row, frame, flags, src, dst): flags bit 0 = mask, bit 2 = save the covered area to saveBuf
export function DrawPicture(col, row, frame, flags, src, dst) {
  if (!src || !dst) return;                                               // 0464:0d77
  if (config.curseBlits) return DrawPictureCab(col, row, frame, flags, src, dst);   // cab: PER-7
  const masked = (flags & 1) !== 0 && src.mask !== null;                  // 0464:0d8a
  const saveBg = (flags & 4) !== 0;                                       // 0464:0da9
  let skipL, skipR, srcRow0, dstRow, lastRow, dstX;
  if (state.ClipPictures !== 0) {                                         // 0464:0db8
    if (col < 0) { skipL = -col; if (skipL > src.width8) return; dstX = 0; }
    else { skipL = 0; dstX = col; if (dstX > dst.width8) return; }
    if (col + src.width8 > dst.width8) { skipR = col + src.width8 - dst.width8; if (skipR > src.width8) return; }
    else skipR = 0;
    if (row < 0) {                                                        // 0464:0eab
      srcRow0 = -row * 8; dstRow = 0;
      lastRow = src.height - 1 - (-row) * 8;
      if (srcRow0 * src.width8 * 4 > src.frameSize - 1 || src.height - 1 < lastRow) return;
    } else {
      srcRow0 = 0; dstRow = row * 8; lastRow = src.height - 1;
      if (dst.height < src.height + row * 8) lastRow = dst.height - 1 - row * 8;   // 0464:0f49
      if (dstRow * dst.width8 * 4 > dst.frameSize - 1 || src.height - 1 < lastRow) return;
    }
  } else {                                                                // 0464:0fca
    skipL = 0; skipR = 0; srcRow0 = 0; dstRow = row * 8; lastRow = src.height - 1; dstX = col;
  }
  const cells = src.width8 - skipL - skipR;
  const rowBytes = cells * 4;                                             // 0464:127e
  const sw = src.width8 * 8, dw = dst.width8 * 8;
  const fofs = frame * src.height * sw;
  const sb = state.saveBuf;
  for (let r = 0; r <= lastRow; r++) {                                    // 0464:1308
    const sy = srcRow0 + r, dy = dstRow;
    const dOfs = (dy * dst.width8 + dstX) * 4;
    markSpan(dy, dOfs, dstX);                                             // 0464:1340
    if (saveBg && sb) {                                                   // 0464:1366  save buffer has the source geometry
      for (let c = 0; c < cells * 8; c++) {
        const sx = (skipL * 8 + c), dx = dstX * 8 + c;
        if (dy >= 0 && dy < dst.height && dx < dw && sy < sb.height && sx < sb.width8 * 8) sb.px[sy * sb.width8 * 8 + sx] = dst.px[dy * dw + dx];
      }
    }
    if (!(masked && rowBytes >= 128)) {                                   // quirk 0464:139d: signed byte count
      for (let c = 0; c < cells * 8; c++) {
        const sp = fofs + sy * sw + skipL * 8 + c, dx = dstX * 8 + c;
        if (dy < 0 || dy >= dst.height || dx < 0 || dx >= dw) continue;
        if (masked && src.mask[sp]) continue;
        dst.px[dy * dw + dx] = src.px[sp];
      }
    }
    markLast(dy, dOfs + rowBytes);                                        // 0464:143c
    dstRow++;
  }
}

// cab: PER-7  0297:09E4 DrawPicture -> 0297:258F DrawPicEga (Curse; RESIDENT.pas.md). Offsets in cells here (the asm scales
// them by 4 bytes per EGA cell after the tests, 0297:23f3). flags bit 0 = mask, bit 2 = save the covered bytes into
// PicSaveBuf (laid out with the source geometry).
function DrawPictureCab(col, row, frame, flags, src, dst) {
  let clipL, xs, clipR, gap, rows, s, line, d;
  const sw = src.width8, dw = dst.width8;
  if (col < 0) { clipL = -col; xs = 0; } else { clipL = 0; xs = col; }     // 0297:231d / 2333
  if (col + sw > dw) { clipR = col + sw - dw; gap = 0; }                  // 0297:233b / 2344
  else { clipR = 0; gap = dw - col - sw; }                                // 0297:2353
  if (row < 0) { rows = src.height + row * 8; s = -row * 8 * sw; line = 0; d = 0; }   // 0297:236d
  else {
    s = 0; line = row * 8; d = line * dw;                                 // 0297:2391
    rows = line + src.height > dst.height ? dst.height - line : src.height;   // 0297:23a7 / 23bd
  }
  // 0297:23c2  nothing visible (quirk: s and d in cells compared with frameSize in bytes, as the asm does before scaling)
  if (sw < clipL || sw < clipR || s > src.frameSize || d > dst.frameSize || rows > src.height || rows <= 0) return;
  const cells = sw - clipL - clipR;                                       // 0297:23f3 rowBytes / 4
  let si = s;                                                             // 0297:241b  save-buffer index
  s += frame * src.height * sw;                                           // 0297:2421
  const masked = (flags & 1) !== 0 && src.mask !== null;                  // 0297:2439
  const save = masked && (flags & 4) !== 0 ? state.saveBuf : null;        // 0297:244a
  for (let r = 0; r < rows; r++, line++) {
    d += xs;                                                              // 0297:29c0 / 2a1f
    markSpan(line, d * 4, xs);                                            // 0297:29c6 / 2a2b  (byte offsets as the asm)
    if (masked) s += clipL;                                               // 0297:2a1f  RowCopyMasked skips the clipped cells
    for (let c = 0; c < cells * 8; c++) {                                 // 0297:29da / 2a3f
      const sp = s * 8 + c, dp = d * 8 + c, dy = (dp / (dw * 8)) | 0, dx = dp % (dw * 8);
      if (dy < 0 || dy >= dst.height) continue;
      const di = dy * dw * 8 + dx;
      if (save) { const k = si * 8 + c; if (k < save.px.length) save.px[k] = dst.px[di]; }   // 0297:2a4a
      if (masked && src.mask[sp]) continue;                               // 0297:2a5d
      dst.px[di] = src.px[sp];
    }
    s += cells; si += cells; d += cells;                                  // 0297:29f5 / 2a76
    markLast(line, d * 4);                                                // 0297:29fe / 2a84
    d += gap;                                                             // 0297:2a0c / 2a92
    if (masked) { s += clipR; si += clipR; }                              // 0297:2a92  quirk: the opaque loop skips neither -> shear
  }
}

// cab: PER-7  0297:0EFF GetPicture(col, row, pic): the screen area under pic (frame 0 geometry) -> pic (Curse, new; the inverse
// of PutPicture; BigPicAnimPhaseA saves the screen with it)
export function GetPicture(col, row, pic) {
  if (!pic) return;                                                       // 0297:0f05
  const d = state.display, w = pic.width8 * 8;
  for (let y = 0; y < pic.height; y++) {                                  // 0297:0feb
    const sy = row * 8 + y;
    for (let x = 0; x < w; x++) {
      const sx = col * 8 + x;
      pic.px[y * w + x] = sy >= 0 && sy < 200 && sx >= 0 && sx < 320 ? d.pix[sy * 320 + sx] : 0;   // 0297:1027
    }
  }
}

// 0464:1B52 FlushViewDirtyLines: dirty spans of the view picture -> screen at pixel (8 + x, line + 8)
export function FlushViewDirtyLines() {
  const v = state.viewPic, d = state.display;
  if (!v) return;
  const vw = v.width8 * 8;
  for (let line = 0; line < LINES; line++) {
    if (!lineDirty[line]) continue;
    const first = spanFirst[line], last = spanLast[line];
    if (last < first) continue;
    const n = ((last - first) >> 2) + 1;                                   // 0464:1da0
    const srcCell = (first >> 2) - line * v.width8;
    const scrCell = spanScreenX[line] + 1;                                // 0464:1bee  g_4AD0 + 1
    const sy = line + 8;
    for (let k = 0; k < n; k++) {
      const sc = srcCell + k, dc = scrCell + k;
      if (sc < 0 || sc >= v.width8 || dc < 0 || dc >= 40) continue;
      for (let p = 0; p < 8; p++) d.pix[sy * 320 + dc * 8 + p] = v.px[line * vw + sc * 8 + p];
    }
  }
  lineDirty.fill(0); spanFirst.fill(0xFFFF); spanLast.fill(0);            // 0464:1e25 .. 1e47
  d.touch();
}

// 0464:2632 FillPictureRect(x cells, y lines, w cells, h lines, colour, cgaMap, pic)
export function FillPictureRect(x, y, w, h, colour, cgaMap, pic) {
  if (!pic) return;
  let skipL, x0, skipR, last, line;
  if (x < 0) { skipL = -x; x0 = 0; } else { skipL = 0; x0 = x; }          // 0464:2656
  skipR = pic.width8 < x + w ? x + w - pic.width8 : 0;                    // 0464:2679
  if (y < 0) { line = 0; last = h - (-y); }                               // quirk 0464:2707: one extra line, no bottom clip
  else { line = y; last = h - 1; if (pic.height < y + h) last = pic.height - 1 - y; }
  const cells = w - skipL - skipR;
  const pw = pic.width8 * 8;
  for (let r = 0; r <= last; r++) {                                       // 0464:294d
    const ofs = (line * pic.width8 + x0) * 4;
    markSpan(line, ofs, x0);
    const n = cells > 127 ? 0 : cells;                                    // quirk 0464:2999 signed byte counter
    for (let c = 0; c < n * 8; c++) {
      const px = x0 * 8 + c;
      if (line >= 0 && line < pic.height && px < pw) pic.px[line * pw + px] = colour & 15;
    }
    markLast(line, ofs + n * 4);
    line++;
  }
}

// 0464:15C7 MirrorPicture(src, dst): left<->right mirror of src's FIRST frame (quirk: other frames untouched)
export function MirrorPicture(src, dst) {
  if (!src || !dst) return;
  dst.cgaMap = src.cgaMap.slice();
  const w = src.width8 * 8;
  for (let y = 0; y < src.height; y++)
    for (let x = 0; x < w; x++) {
      dst.px[y * w + x] = src.px[y * w + (w - 1 - x)];
      if (src.mask && dst.mask) dst.mask[y * w + x] = src.mask[y * w + (w - 1 - x)];
    }
}

// 0464:1E5C RecolorPicture(fromCol[16], toCol[16], frame, randomMix, pic): simultaneous remap; frame < 0 = all frames;
// randomMix (EGA path 0464:21cd): a pixel changes only where Random(256) and Random(256) has its bit set (per 8-pixel group).
export function RecolorPicture(fromCol, toCol, frame, randomMix, pic) {
  if (!pic) return;
  let n;
  if (frame < 0) { frame = 0; n = pic.count; } else n = 1;
  const fpx = pic.height * pic.width8 * 8;
  const orig = pic.px.slice(frame * fpx, (frame + n) * fpx);
  const out = orig.slice();
  for (let i = 0; i < 16; i++) {
    if (fromCol[i] === toCol[i]) continue;                                 // 0464:1f8a
    for (let g = 0; g < orig.length; g += 8) {
      const m = randomMix ? (Random(256) & Random(256)) : 0xFF;           // 0464:21cd
      for (let b = 0; b < 8; b++)
        if ((m & (0x80 >> b)) && orig[g + b] === fromCol[i]) out[g + b] = toCol[i] & 15;
    }
  }
  pic.px.set(out, frame * fpx);                                            // 0464:243a
}

// ---------------------------------------------------------------------------------------------------------------------
// VIEW ov34 — 8x8 symbol sets. Block bases DS:2722 = 1, 46, 116, 186, 256 (image words, WALLDEF.md).
// por-only: Pool picture-symbol tile bases (profile: engine.id (decoded adapter) / daxGroups; game/profiles/PORONLY.md)
export const SYMBOL_BASE = [1, 46, 116, 186, 256];

// CA00:003B Load8x8Set(id, block): '8x8d' + DataSet, mask colour 0Dh
export async function Load8x8Set(id, block) {
  if (block < 0 || block > 4) return;                                     // ca00:004b
  const name = '8x8d' + state.DataSet;                                    // ca00:006a
  state.SymbolSets[block] = await LoadPicture(name, id, 1, 0x0D);         // ca00:00be
  if (!state.SymbolSets[block]) throw fatal(config.curseBlits ? 'Unable to load ' + id + ' from 8x8D' + state.DataSet   // cab: PER-7  7400:00e9
    : `Unable to load 8x8D${state.DataSet}-${id}`, true);   // ca00:00e8 (VIEW-11)
  if (config.flushAfterLoad) await FlushGameKeys();                       // cab: PER-7  7400:0145
}

// CA00:015D Put8x8Symbol(col, row, sym, toView, masked)
export function Put8x8Symbol(col, row, sym, toView, masked) {
  let blk;
  if (sym >= 1 && sym <= 0x2D) blk = 0;
  else if (sym <= 0x73 && sym >= 0x2E) blk = 1;
  else if (sym >= 0x74 && sym <= 0xB9) blk = 2;
  else if (sym >= 0xBA && sym <= 0xFF) blk = 3;
  else if (sym >= 0x100 && sym <= config.symbolMax) blk = 4;              // cab: PER-7  7400:01cc (Curse 127h)
  else throw fatal('Bad symbol number in Put8x8Symbol.', true);              // ca00:01c5 (VIEW-11)
  const set = state.SymbolSets[blk];
  if (!set) return;                                                       // ca00:01ee
  const t = sym - SYMBOL_BASE[blk];                                       // ca00:020f
  if (toView) DrawPictureInto(col, row, t, masked, set, state.viewPic);   // ca00:0249
  else {                                                                  // ca00:028b / 02a2
    const sp = state.symbolPic;
    sp.px.set(set.px.subarray(t * 64, t * 64 + 64));
    PutPicture(col, row, sp);
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// VIEW ov28 AC00:00A2 LoadAnimation: A-records (u8 count, count x (u32 delay, P-record)); PIC/FINAL frames 2..n are XOR
// deltas of frame 1's pixel bytes (AC00:0392..03D6, PICTURES.md). Returns {count, delay[], pic[]} with 1-based slots.
export async function LoadAnimationRecord(name, id, xorDeltas) {
  const b = await LoadDaxRecord(state.DataPath + name, '.dax', id);
  if (!b) return null;
  const n = b[0];
  const anim = { count: n, cur: 1, delay: [0], pic: [null] };
  let o = 1, base = null;
  for (let k = 0; k < n; k++) {
    const delay = new DataView(b.buffer, b.byteOffset + o).getUint32(0, true);
    const h = parseHeader(b, o + 4);
    const bytes = h.height * h.width8 * 4;
    let data = b.subarray(o + 4 + 17, o + 4 + 17 + bytes);
    if (xorDeltas) {
      if (k === 0) base = data;
      else { const x = new Uint8Array(bytes); for (let i = 0; i < bytes; i++) x[i] = data[i] ^ base[i]; data = x; }
    }
    const pic = AllocPicture(h.height, h.width8, 1, 0);
    pic.x = h.x; pic.y = h.y; pic.cgaMap = h.cgaMap;
    convertPixels(data, 0, -1, pic);
    anim.delay.push(delay); anim.pic.push(pic);
    o += 4 + 17 + h.count * bytes;
  }
  return anim;
}
