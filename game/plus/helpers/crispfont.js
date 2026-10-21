// Crisp font (W8, off by default; GOLD_BOX_PLUS.md item 10): the game's text redrawn at screen resolution with a smooth
// system font on an overlay canvas over each recognised text cell (textcells.js). The game canvas is untouched; off =
// overlay removed.
import { readScreen } from './textcells.js';
import { overlayFor } from './overlay.js';

export function createCrispFont({ canvas, screen, font = '"Consolas", "Courier New", monospace' }) {
  let layer = null, raf = 0, seen = -1, w = 0;
  function draw() {
    const d = screen.display; if (!d || !layer) return;
    const c = layer.el, ctx = c.getContext('2d');
    if (d.version === seen && c.width === w) return;
    seen = d.version; w = c.width;
    ctx.clearRect(0, 0, c.width, c.height);
    if (d.text) return;                                            // fatal-error text mode: leave it alone
    const cw = c.width / 40, ch = c.height / 25, cells = readScreen(d.pix, screen.table());
    ctx.font = `bold ${Math.floor(ch * 0.92)}px ${font}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    let n = 0;
    cells.forEach((line, row) => line.forEach((cell, col) => {
      if (!cell || cell.ch === ' ') return;
      const x = col * cw, y = row * ch;
      ctx.fillStyle = 'rgb(0,0,0)'; ctx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(cw), Math.ceil(ch));   // glyph background is 0
      const [r, g, b] = d.rgbOf(cell.colour); ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillText(cell.ch, x + cw / 2, y + ch / 2 + 1); n++;
    }));
    c.dataset.cells = String(n);
  }
  const loop = () => { draw(); raf = requestAnimationFrame(loop); };
  return {
    get on() { return !!layer; },
    set(on) {
      if (on && !layer) { layer = overlayFor(canvas, { id: 'por-plus-crisp', tag: 'canvas', z: 4 }); seen = -1; raf = requestAnimationFrame(loop); }
      else if (!on && layer) { cancelAnimationFrame(raf); layer.remove(); layer = null; }
    },
    redraw() { seen = -1; draw(); },
  };
}
