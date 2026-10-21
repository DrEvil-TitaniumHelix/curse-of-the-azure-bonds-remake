// A DOM layer exactly over the game canvas (W8 helpers). It never draws on the game canvas: removing it restores the
// page as it was (helpers off = 0 px). Follows the canvas's displayed size (integer scale from index.html fit()).
export function overlayFor(canvas, { id, tag = 'div', pointerEvents = 'none', z = 5 } = {}) {
  const el = document.createElement(tag);
  el.id = id;
  Object.assign(el.style, { position: 'fixed', pointerEvents, zIndex: String(z), left: '0', top: '0' });
  const place = () => {
    const r = canvas.getBoundingClientRect();
    Object.assign(el.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    if (tag === 'canvas') { const w = Math.round(r.width * devicePixelRatio), h = Math.round(r.height * devicePixelRatio); if (el.width !== w || el.height !== h) { el.width = w; el.height = h; } }
  };
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(place) : null;
  ro?.observe(canvas); addEventListener('resize', place);
  document.body.append(el); place();
  return { el, place, remove() { ro?.disconnect(); removeEventListener('resize', place); el.remove(); } };
}
