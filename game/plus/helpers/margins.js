// Margins (W8, off by default): a margin of `margin` CSS px kept free around the game canvas, the canvas still at an
// integer scale (nearest neighbour, BUILD_PLAN §1). Off = index.html's own fit(): the largest integer scale of 320x200.
export const fitScale = (w, h, margin = 0) => Math.max(1, Math.floor(Math.min((w - 2 * margin) / 320, (h - 2 * margin) / 200)));

export function createMargins({ canvas, margin = 48, viewport = () => ({ w: innerWidth, h: innerHeight }) }) {
  let on = false;
  const apply = () => {
    const { w, h } = viewport(), s = fitScale(w, h, on ? margin : 0);
    canvas.style.width = 320 * s + 'px'; canvas.style.height = 200 * s + 'px';
    if (on) canvas.dataset.plusScale = String(s);
  };
  return {
    get on() { return on; },
    set(v) {
      v = !!v; if (v === on) return;
      on = v;
      if (on) addEventListener('resize', apply);
      else { removeEventListener('resize', apply); delete canvas.dataset.plusScale; }
      apply();                                    // off: the same size index.html fit() gives (fitScale with margin 0)
    },
  };
}
