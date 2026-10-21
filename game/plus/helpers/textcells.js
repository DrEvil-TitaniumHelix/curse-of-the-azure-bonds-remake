// Screen text read back from the game's own pixels (W8 helpers, gbp-helpers). The engine draws every text glyph opaque
// into the 40x25 cell grid of the 320x200 indexed framebuffer (text.js DrawRepeatedGlyph 0709:01DF: glyph bit -> colour,
// else 0; with textMap the glyph is UpCase(ch) mod 64 of the font from 8X8D1.DAX record C9h). So a cell whose lit pixels
// share one colour and whose pattern equals one of the 64 text glyphs is that character. Read-only; nothing is drawn.
export const COLS = 40, ROWS = 25;
// glyph g of the 64-glyph text set -> character (UpCase(ch) mod 64: '@'..'_' = 0..31, ' '..'?' = 32..63)
export const glyphChar = (g) => String.fromCharCode(g < 32 ? g + 64 : g);

// pattern -> character. Glyphs 0..63 are the text set (textMap); the font's other glyphs (up to 177) are drawn by
// character code without textMap (e.g. mixed-case names), so glyph g >= 64 is character g. Lower index wins on ties.
export function glyphTable(font) {
  const map = new Map();
  if (!font || font.length < 64 * 8) return map;
  for (let g = Math.min(176, (font.length >> 3) - 1); g >= 0; g--) {
    let key = '';
    for (let r = 0; r < 8; r++) key += String.fromCharCode(font[g * 8 + r]);
    map.set(key, g < 64 ? glyphChar(g) : String.fromCharCode(g));
  }
  return map;
}

// one cell -> { ch, colour } or null (not a text glyph). A blank cell (all 0) is a space with colour 0.
export function readCell(pix, table, col, row) {
  let key = '', colour = 0;
  for (let r = 0; r < 8; r++) {
    const o = (row * 8 + r) * 320 + col * 8;
    let bits = 0;
    for (let b = 0; b < 8; b++) {
      const v = pix[o + b];
      if (v) { if (colour && v !== colour) return null; colour = v; bits |= 0x80 >> b; }
    }
    key += String.fromCharCode(bits);
  }
  const ch = table.get(key);
  return ch === undefined ? null : { ch, colour };
}

// whole screen: rows of cells (null = not text)
export function readScreen(pix, table) {
  const out = [];
  for (let row = 0; row < ROWS; row++) {
    const line = [];
    for (let col = 0; col < COLS; col++) line.push(readCell(pix, table, col, row));
    out.push(line);
  }
  return out;
}
export const lineText = (cells) => cells.map((c) => (c ? c.ch : ' ')).join('');

// cab: the screen as the player sees it — the game canvas's presented 320x200 pixels (packed RGB, black = 0), read at
// most every `every` ms into an own read-back canvas — and the font from the player's 8X8D1.DAX record C9h (profile
// engine.font, LoadTextFont 0542:0184). Plus does not read engine modules (Pool's engineScreen below read the
// framebuffer and the loaded font). Text mode (the 640x350 DOS screen) reports `text: true`.
export async function canvasScreen(canvas, { font, readFile, every = 50 } = {}) {
  if (!font) {
    const { archiveRecords } = await import('../pedia/build.js');
    if (!readFile) { const dax = await import('../../engine/dax.js'); readFile = dax.fetchFile; }
    font = archiveRecords(await readFile('8X8D1.DAX')).get(0xC9) || null;
  }
  const table = glyphTable(font), pix = new Uint32Array(320 * 200), back = document.createElement('canvas');
  back.width = 320; back.height = 200;
  const ctx = back.getContext('2d', { willReadFrequently: true });
  let version = 0, last = -Infinity, sum = -1;
  const display = { pix, text: false, get version() { return version; }, rgbOf: (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255] };
  return {
    get display() {
      if (canvas.width !== 320 || canvas.height !== 200) return { text: true, version: -1 };
      const now = performance.now();
      if (now - last >= every) {
        last = now; ctx.drawImage(canvas, 0, 0);
        const d = ctx.getImageData(0, 0, 320, 200).data; let s = 0;
        for (let p = 0, q = 0; p < pix.length; p++, q += 4) { const v = (d[q] << 16) | (d[q + 1] << 8) | d[q + 2]; pix[p] = v; s = (s * 31 + v) | 0; }
        if (s !== sum) { sum = s; version++; }
      }
      return display;
    },
    table() { return table; },
  };
}

// engine access (read-only): the framebuffer and the loaded font (Pool; not used by the Curse helpers)
export async function engineScreen() {
  const [{ state }, { text }] = await Promise.all([import('../../engine/pictures.js'), import('../../engine/text.js')]);
  let font = null, table = new Map();
  return {
    get display() { return state.display; },
    table() { if (text.font !== font) { font = text.font; table = glyphTable(font); } return table; },
  };
}
