// ega.js — a 320x200 16-colour text-grid screen for the BYOC screens (docs/BYOC.md §5). The game's own font and frame
// live in the player's data files, which are not there yet when these screens run, so the text uses the BIOS 8x8 ROM
// font (engine/biosfont.js, not game data) on the game's 40x25 grid, in the EGA colours of engine/display.js. The frame
// is our own pattern in the game's frame colours (red rope, yellow corners); nothing here is drawn from game data.

import { BIOS_FONT_8X8 } from '../../engine/biosfont.js';

export const W = 320, H = 200, COLS = 40, ROWS = 25;
export const RGB = [
  [0, 0, 0], [0, 0, 170], [0, 170, 0], [0, 170, 170], [170, 0, 0], [170, 0, 170], [170, 85, 0], [170, 170, 170],
  [85, 85, 85], [85, 85, 255], [85, 255, 85], [85, 255, 255], [255, 85, 85], [255, 85, 255], [255, 255, 85], [255, 255, 255],
];
// colour roles, after the party menu (PM-01): green options with white hotkeys, magenta prompt line, yellow headings
export const C = { title: 14, text: 15, dim: 7, item: 10, hot: 15, bad: 12, good: 10, prompt: 13, bar: 2, barBg: 8, mark: 14 };

export class EgaScreen {
  constructor(canvas) {
    this.canvas = canvas;
    canvas.width = W; canvas.height = H;
    this.ctx = canvas.getContext('2d');
    this.img = this.ctx.createImageData(W, H);
    this.pix = new Uint8Array(W * H);
  }
  clear(c = 0) { this.pix.fill(c); }
  rect(x, y, w, h, c) {
    for (let j = Math.max(0, y); j < Math.min(H, y + h); j++) this.pix.fill(c, j * W + Math.max(0, x), j * W + Math.min(W, x + w));
  }
  glyph(col, row, code, fg, bg = 0) {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;
    for (let y = 0; y < 8; y++) {
      const bits = BIOS_FONT_8X8[(code & 0xFF) * 8 + y];
      const o = (row * 8 + y) * W + col * 8;
      for (let x = 0; x < 8; x++) this.pix[o + x] = (bits & (0x80 >> x)) ? fg : bg;
    }
  }
  // one line of text; characters outside Latin-1 become '?'
  text(col, row, s, fg, bg = 0) {
    for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); this.glyph(col + i, row, c < 256 ? c : 63, fg, bg); }
  }
  // the frame one cell wide around columns 1..38, rows 1..22 (where the game's DrawFrame(1, 1, 38, 22) border sits)
  frame() {
    for (let col = 1; col < COLS - 1; col++) { this._rope(col * 8, 0, true); this._rope(col * 8, 23 * 8, true); }
    for (let row = 1; row < 23; row++) { this._rope(0, row * 8, false); this._rope(39 * 8, row * 8, false); }
    for (const [x, y] of [[0, 0], [312, 0], [0, 184], [312, 184]]) { this.rect(x + 1, y + 1, 6, 6, 14); this.rect(x + 3, y + 3, 2, 2, 6); }
  }
  _rope(x0, y0, horiz) {
    for (let a = 0; a < 8; a++) for (let b = 2; b < 6; b++) {
      const twist = ((a + (b - 2) * 2) & 7) < 4 ? 12 : 4;
      const [x, y] = horiz ? [x0 + a, y0 + b] : [x0 + b, y0 + a];
      this.pix[y * W + x] = twist;
    }
  }
  present() {
    const d = this.img.data;
    for (let i = 0; i < W * H; i++) { const c = RGB[this.pix[i] & 15]; d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255; }
    this.ctx.putImageData(this.img, 0, 0);
  }
}

// word wrap to `width` columns (long words are cut)
export function wrap(s, width) {
  const out = [];
  for (const para of String(s).split('\n')) {
    let line = '';
    for (let w of para.split(/\s+/).filter(Boolean)) {
      while (w.length > width) { if (line) { out.push(line); line = ''; } out.push(w.slice(0, width)); w = w.slice(width); }
      if (!line) line = w;
      else if (line.length + 1 + w.length <= width) line += ' ' + w;
      else { out.push(line); line = w; }
    }
    out.push(line);
  }
  return out;
}
