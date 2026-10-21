// display.js — the EGA 320x200x16 screen (BIOS mode 0Dh, POOL.CFG line 1 'E': InitConfiguration 042B:0197).
//
// The framebuffer holds 4-bit colour indices (the 4 EGA planes combined). Each index goes through the 16 EGA palette
// registers (default: 0..7 -> 00h..07h, 8..15 -> 10h..17h) and then through the 200-line monitor decoding (RGB + intensity
// on bit 4, colour 6 = brown) to RGB. SetEgaPaletteRegister 0464:2A0D changes a register: the whole screen's colour
// changes at once, as on the hardware. Only EGA is built (BUILD_PLAN §2); CGA/Tandy paths are not reproduced.

import { BIOS_FONT_8X14 } from './biosfont.js';

export const W = 320, H = 200;

// 200-line EGA monitor colours: value bits 0..2 = B,G,R, bit 4 = intensity (bit 3 ignored in 200-line modes).
// Same RGB as the DOSBox reference captures (acceptance/ref, e.g. 0Ah = 85,255,85).
const CGA_RGB = [
  [0, 0, 0], [0, 0, 170], [0, 170, 0], [0, 170, 170], [170, 0, 0], [170, 0, 170], [170, 85, 0], [170, 170, 170],
  [85, 85, 85], [85, 85, 255], [85, 255, 85], [85, 255, 255], [255, 85, 85], [255, 85, 255], [255, 255, 85], [255, 255, 255],
];
function regToRgb(v) { return CGA_RGB[(v & 7) | ((v & 0x10) ? 8 : 0)]; }

export class Display {
  constructor(canvas) {
    this.pix = new Uint8Array(W * H);
    this.palette = new Uint8Array(16);
    this.resetPalette();
    this.canvas = canvas || null;
    this.ctx = canvas ? canvas.getContext('2d') : null;
    this.img = this.ctx ? this.ctx.createImageData(W, H) : null;
    this.dirty = true;
    this.version = 0;
    if (this.ctx) this._loop();
  }

  // BIOS mode set: default palette registers
  resetPalette() {
    for (let i = 0; i < 16; i++) this.palette[i] = i < 8 ? i : i + 8;
    this.touch();
  }

  touch() { this.dirty = true; this.version++; }

  // 0464:2A0D SetEgaPaletteRegister(index, colour): colours 8..15 become 10h..17h
  setPaletteRegister(index, colour) {
    this.palette[index & 15] = colour < 8 ? colour : colour + 8;
    this.touch();
  }

  clear() { this.pix.fill(0); this.touch(); }

  rgbOf(i) { return regToRgb(this.palette[i & 15]); }

  // 0464:00FF RestorePreviousVideoMode (BIOS mode 3): the 80x25 text screen of the fatal error paths, 640x350, EGA 8x14
  // font, attribute 07h (light grey on black). A mode set clears the screen and homes the cursor.
  setTextMode() {
    this.text = { chars: new Uint8Array(80 * 25).fill(0x20), row: 0, col: 0 };
    if (this.canvas) { this.canvas.width = 640; this.canvas.height = 350; this.img = this.ctx.createImageData(640, 350); }
    this.touch();
  }
  // cab: PER-11  SetVideoMode($0D) after a text screen (Curse StartupConfiguration 020F:06bc shows its NUMLOCK note S006
  // in the DOS text mode first): back to the 320x200 EGA raster, screen cleared, default palette
  setGraphicsMode() {
    this.text = null;
    if (this.canvas) { this.canvas.width = W; this.canvas.height = H; this.img = this.ctx.createImageData(W, H); }
    this.pix.fill(0); this.resetPalette();
  }
  // System.WriteLn on the text screen (TTY: CR/LF, scrolls at row 25)
  writeLn(s = '') {
    const t = this.text; if (!t) return;
    for (const ch of s) {
      t.chars[t.row * 80 + t.col] = ch.charCodeAt(0) & 0xFF;
      if (++t.col === 80) { t.col = 0; this._lf(); }
    }
    t.col = 0; this._lf(); this.touch();
  }
  _lf() {
    const t = this.text;
    if (++t.row === 25) { t.chars.copyWithin(0, 80); t.chars.fill(0x20, 24 * 80); t.row = 24; }
  }
  presentText() {
    const d = this.img.data, t = this.text;
    for (let y = 0; y < 350; y++) for (let x = 0; x < 640; x++) {
      const ch = t.chars[((y / 14) | 0) * 80 + (x >> 3)];
      const on = (BIOS_FONT_8X14[ch * 14 + (y % 14)] >> (7 - (x & 7))) & 1;
      const q = (y * 640 + x) * 4, v = on ? 0xAA : 0;
      d[q] = v; d[q + 1] = v; d[q + 2] = v; d[q + 3] = 255;
    }
    this.ctx.putImageData(this.img, 0, 0);
    this.dirty = false;
  }

  present() {
    if (!this.ctx) return;
    if (this.text) return this.presentText();
    const d = this.img.data, lut = [];
    for (let i = 0; i < 16; i++) lut.push(this.rgbOf(i));
    for (let p = 0, q = 0; p < W * H; p++, q += 4) {
      const c = lut[this.pix[p]];
      d[q] = c[0]; d[q + 1] = c[1]; d[q + 2] = c[2]; d[q + 3] = 255;
    }
    this.ctx.putImageData(this.img, 0, 0);
    this.dirty = false;
  }

  _loop() {
    const tick = () => { if (this.dirty) this.present(); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }
}
