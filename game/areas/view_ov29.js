// game/areas/view_ov29.js — VIEW ov29 (6C00): encounter pictures and animations, portraits, 3D sprites, BIGPIC backdrops.
// Owner: cab-build-areas. Source: decode/pseudo/VIEW.pas.md ov29 (Pool ov28 AC00); screens VIEW-04, VIEW-07, VIEW-08,
// VIEW-12. Re-read from decode/listings/ov29.lst:
//  - DrawPictureScreenOrView (6c00:000c): DrawPicture(col-1, row-1, frame 0, flags 0, pic, view_Pic) (Pool flags 1).
//  - LoadAnimation (6c00:0400 .. 04ad): frame 1 is kept as `len + 1` bytes and later frames are XORed over `o .. o+len`
//    INCLUSIVE (quirk: one byte past the pixels, i.e. the low byte of the next frame's delay, is XORed too);
//    ConvertPicturePixels is called with (p, o, maskFlags = flags, transpColour = 0, pic) — the pushes at 6c00:0488..04a9
//    are p, o, [BP+0Ah] flags, 0, pic (VIEW.pas.md writes the two bytes the other way round).
// TAnim (66 bytes in the original) = G.enc_Anim { count, cur, delay[1..8], pic[1..8] } (1-based slots, Pool engine shape).

import { G } from '../engine/state.js';
import * as P from '../engine/pictures.js';
import { LoadDaxRecord } from '../engine/dax.js';
import { DrawText, ClearGlyphRun, ShowBottomPromptAndReadKey, FrameWithTextBar } from '../engine/text.js';
import { FlushGameKeys } from '../engine/input.js';
import { fatal } from '../engine/errors.js';
import { hooks } from '../plus/hooks.js';   // GBP W1 (docs/PLUS_HOOKS.md)
import { view, sx8 } from './view_ov30.js';

const { state: pic, LoadPicture, DrawPicture, PutPicture, FlushViewDirtyLines, RecolorPicture, AllocPicture } = P;
// 0297:02AD ConvertPicturePixels(src, ofs, maskFlags, transpColour, pic) — engine request #5; until pictures.js exports it,
// the EGA path here: 4-bpp nibbles (high nibble = left pixel), mask where pixel = transpColour (if the picture has one).
const ConvertPicturePixels = P.ConvertPicturePixels || ((src, ofs, maskFlags, transp, q) => {
  if (!q) return;
  const n = q.px.length;
  for (let i = 0; i < n; i++) {
    const b = src[ofs + (i >> 1)] ?? 0, v = (i & 1) ? b & 0x0F : b >> 4;
    if (q.mask && v === transp) { q.mask[i] = 1; q.px[i] = 0; } else q.px[i] = v;
  }
});

const IDENT = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
const tab16 = (a, dflt) => (G.ds ? Array.from(G.ds.subarray(a, a + 16)) : dflt);
// g_0A98 / g_0AA8: the red tint (every colour except 4..7, 10, 14 -> 12); g_0AB8 / g_0AC8: 13 -> 0
const TINT_TO = [12, 12, 12, 12, 4, 5, 6, 7, 12, 12, 10, 12, 12, 12, 14, 12];
const MASK13_TO = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 0, 14, 15];

export const emptyAnim = () => ({ count: 0, cur: 0, delay: [0], pic: [null] });
if (!G.enc_Anim) G.enc_Anim = emptyAnim();               // g_722C
if (G.anim_Name === undefined) G.anim_Name = '';         // g_7278 string[8]
if (G.anim_Id === undefined) G.anim_Id = 0xFF;           // g_728A
if (G.head_Id === undefined) G.head_Id = 0xFF;           // g_726E
if (G.body_Id === undefined) G.body_Id = 0xFF;           // g_7273
if (G.bigpic_Id === undefined) G.bigpic_Id = 0xFF;       // g_7290

// 6C00:000C DrawPictureScreenOrView(col, row, toView, pic)
export function DrawPictureScreenOrView(col, row, toView, p) {
  if (!p) return;                                                        // 6c00:000f
  if (view.mem(0x4CFF) === 0 && !toView) { PutPicture(col, row, p); return; }   // 6c00:0017 / 007a
  if (view.mem(0x4CFF) !== 0) RecolorPicture(tab16(0x0A98, IDENT), tab16(0x0AA8, TINT_TO), 0, 1, p);   // 6c00:0035 red tint
  DrawPicture(col - 1, row - 1, 0, 0, p, pic.viewPic);                   // 6c00:0050
  FlushViewDirtyLines();                                                 // 6c00:0073
}

// 6C00:0091 DrawHead(col, row, pic) / 6C00:00B3 DrawBody(col, row, pic)
export function DrawHead(col, row, p) { DrawPictureScreenOrView(col, row, false, p); }        // 6c00:00aa
export function DrawBody(col, row, p) { DrawPictureScreenOrView(col, row + 5, false, p); }    // 6c00:00cf

// 6C00:010B LoadAnimation(name, id, flags, var anim)
export async function LoadAnimation(name, id, flags, anim = G.enc_Anim) {
  if ((name === G.anim_Name && id === G.anim_Id) || id === 0xFF) return; // 6c00:0112 / 012f
  if (G.opt_Animation !== 0) { ClearGlyphRun(0, 24, 0, 40); DrawText(0, 24, 10, 0, 'Loading...Please Wait'); }   // 6c00:0148 / 017b
  FreeAnimation(anim); G.anim_Name = name; G.anim_Id = id;               // 6c00:0180 / 0189 / 0197
  const isPic = name === 'PIC' || name === 'FINAL';                      // 6c00:01a2 / 01b3
  const rec = await LoadDaxRecord((pic.DataPath ?? '') + name + pic.DataSet, '.dax', id);   // 6c00:0211
  if (!rec || rec.length === 0) { await ShowBottomPromptAndReadKey(0x0E, 0, 'PIC not found'); return; }   // 6c00:023f
  const p = new Uint8Array(rec.length + 1); p.set(rec);                  // working copy (the inclusive XOR may touch one byte past the end)
  anim.count = p[0]; let o = 1; anim.cur = 1; let loaded = 0;            // 6c00:0250
  if (G.opt_Animation === 0 && isPic) anim.count = 1;                    // 6c00:0280 animations off: first frame only
  let base = null, len = 0;
  for (let k = 1; k <= anim.count; k++) {
    anim.delay[k] = (p[o] | (p[o + 1] << 8) | (p[o + 2] << 16) | (p[o + 3] << 24)) >>> 0; o += 4;   // 6c00:02a8
    const h = p[o] | (p[o + 1] << 8); o += 2;                            // 6c00:02d3
    const w = p[o] | (p[o + 1] << 8); o += 2;                            // 6c00:02ef
    loaded++;                                                            // 6c00:030b MaxAvail > F3Bh (always here)
    const q = AllocPicture(h, w, 1, flags);                              // 6c00:0325
    q.x = p[o] | (p[o + 1] << 8); o += 2;                                // 6c00:0363
    q.y = p[o] | (p[o + 1] << 8); o += 3;                                // 6c00:0383 (+ the frame-count byte)
    q.cgaMap = p.slice(o, o + 8); o += 8;                                // 6c00:03a3
    len = q.frameSize;                                                   // 6c00:03ca (EGA)
    if (isPic) {
      if (k === 1) { base = p.slice(o, o + len + 1); }                   // 6c00:0411 / 0434 keep frame 1 (len + 1 bytes)
      else for (let i = o; i <= o + len && i < p.length; i++) p[i] ^= base[i - o];   // 6c00:0450 .. 0486 inclusive quirk
    }
    ConvertPicturePixels(p, o, flags, 0, q);                             // 6c00:04ad
    if ((flags & 1) !== 0 && G.VideoMode !== 0) RecolorPicture(tab16(0x0AB8, IDENT), tab16(0x0AC8, MASK13_TO), 0, 0, q);   // 6c00:04c2 13 -> 0
    anim.pic[k] = q;
    o += len;
  }
  anim.count = loaded;
  base = null;                                                           // 6c00:051c FreeMem(base)
  await FlushGameKeys();                                                       // 6c00:0538
  if (G.opt_Animation !== 0) ClearGlyphRun(0, 24, 0, 40);                // 6c00:0544
  hooks.emit('pictureShown', () => ({ kind: 'animation', name, id, frames: anim.count }));
}

// 6C00:055B FreeAnimation(var anim)
export function FreeAnimation(anim = G.enc_Anim) {
  anim.count = 0; anim.cur = 0; anim.delay = [0]; anim.pic = [null];    // 6c00:0596 free + 6c00:05af FillChar($42)
  G.anim_Name = ''; G.anim_Id = 0xFF;                                    // 6c00:05b9 / 05be
}

// 6C00:05DD LoadPortrait(head, body)
export async function LoadPortrait(head, body) {
  head = sx8(head); body = sx8(body);
  if (head !== -1 && (sx8(G.head_Id) === -1 || sx8(G.head_Id) !== head)) {   // 6c00:05f9
    G.head_Pic = await LoadPicture('HEAD' + pic.DataSet, head & 0xFF, 0, 0); // 6c00:063c
    if (!G.head_Pic) await ShowBottomPromptAndReadKey(0x0E, 0, 'head not found');   // 6c00:065f
    G.head_Id = head & 0xFF;                                             // 6c00:0664
  }
  if (body !== -1 && (sx8(G.body_Id) === -1 || sx8(G.body_Id) !== body)) {   // 6c00:0670
    G.body_Pic = await LoadPicture('BODY' + pic.DataSet, body & 0xFF, 0, 0); // 6c00:06a8
    if (!G.body_Pic) await ShowBottomPromptAndReadKey(0x0E, 0, 'head not found');   // 6c00:06cb (same text)
    G.body_Id = body & 0xFF;                                             // 6c00:06d0
  }
  await FlushGameKeys();                                                       // 6c00:06d6
}

// 6C00:06E1 DrawPortrait(col, row, both)
export function DrawPortrait(col, row, both) {
  if (both) { DrawHead(col, row, G.head_Pic); DrawBody(col, row, G.body_Pic); }   // 6c00:06fb / 070f
  else DrawPictureScreenOrView(col, row, false, G.head_Pic);             // 6c00:072c
  hooks.emit('pictureShown', () => ({ kind: 'portrait', head: G.head_Id, body: both ? G.body_Id : null }));
}

// 6C00:0754 Show3DSprite(k, anim)
export function Show3DSprite(k, anim = G.enc_Anim) {
  if (k < 1 || k > 3) throw fatal('Illegal range in Show3DSprite.', true);   // 6c00:0779 .. 0795 (VIEW-11)
  const q = anim.pic[k];
  if (q) {
    DrawPicture(q.x + 2, q.y + 2, 0, 1, q, pic.viewPic);                 // 6c00:07f8 header words +4 / +6, each + 2
    FlushViewDirtyLines();                                               // 6c00:0801
  }
}

// 6C00:0813 LoadBigPic(id)
export async function LoadBigPic(id) {
  FreeAnimation(G.enc_Anim);                                             // 6c00:0820
  if (G.bigpic_Id !== id) {                                              // 6c00:0836
    G.bigpic_Pic = await LoadPicture('bigpic' + pic.DataSet, id, 0, 0);  // 6c00:0870
    G.bigpic_Id = id;                                                    // 6c00:0878
  }
  hooks.emit('bigPicShown', () => ({ id }));                             // PER-8
}

// 6C00:0881 DrawBigPic
export function DrawBigPic() {
  FrameWithTextBar();                                                    // 6c00:0884 FUN_01A0_0252 screen frame + text-window bar
  if (G.bigpic_Pic) PutPicture(1, 1, G.bigpic_Pic);                      // 6c00:0899 at text cell (1,1) (nil: TODO(decode) draws garbage)
}

// 6C00:0000 ov29_LoadDeps / 6C00:08A2 ov29_init: empty.
