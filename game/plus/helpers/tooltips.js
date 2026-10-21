// Tooltips (W8, on by default): hovering a name in a menu, list or character sheet shows a small tooltip from the
// Gold Box-pedia — only for entries the player has already revealed (pedia tracker `revealed`). The text under the
// pointer is read from the game's pixels (textcells.js); the tooltip is a page element beside the canvas.
import { readScreen, lineText } from './textcells.js';

// the revealed entry whose name covers column `col` of `line` (longest name wins)
export function nameAt(line, col, entries) {
  const up = line.toUpperCase();
  let best = null;
  for (const e of entries) {
    const name = String(e.name || '').trim().toUpperCase();
    if (name.length < 3) continue;
    for (let i = up.indexOf(name); i >= 0; i = up.indexOf(name, i + 1)) {
      const before = up[i - 1], after = up[i + name.length];
      const word = (c) => c !== undefined && /[A-Z0-9]/.test(c);
      if (col >= i && col < i + name.length && !word(before) && !word(after) && (!best || name.length > best.name.length)) best = { entry: e, name, start: i };
    }
  }
  return best?.entry || null;
}
export function tooltipText(e) {
  const lines = [e.name, e.kind ? e.kind[0].toUpperCase() + e.kind.slice(1) : ''];
  for (const [k, v] of Object.entries(e.stats || {}).slice(0, 6)) lines.push(`${k}: ${v}`);
  if (e.whereMet?.length) lines.push('Met: ' + e.whereMet.map((p) => p.name || `data set ${p.dataSet}, block ${p.block}`).slice(0, 2).join('; '));
  return lines.filter(Boolean).join('\n');
}

export function createTooltips({ canvas, screen, revealed }) {
  let tip = null;
  function hide() { if (tip) tip.hidden = true; }
  function move(ev) {
    const d = screen.display; if (!d || d.text) return hide();
    const r = canvas.getBoundingClientRect();
    const col = Math.floor((ev.clientX - r.left) / r.width * 40), row = Math.floor((ev.clientY - r.top) / r.height * 25);
    if (col < 0 || col > 39 || row < 0 || row > 24) return hide();
    const line = lineText(readScreen(d.pix, screen.table())[row]);
    const entry = nameAt(line, col, [...(revealed() || new Map()).values()]);
    if (!entry) return hide();
    if (!tip) {
      tip = document.createElement('div'); tip.id = 'por-plus-tooltip'; tip.setAttribute('role', 'tooltip');
      Object.assign(tip.style, { position: 'fixed', zIndex: '20', pointerEvents: 'none', whiteSpace: 'pre', font: '13px system-ui, sans-serif',
        background: 'rgba(16,20,28,.94)', color: '#eee', border: '1px solid #5af', borderRadius: '6px', padding: '6px 8px', maxWidth: '320px' });
      document.body.append(tip);
    }
    tip.textContent = tooltipText(entry); tip.dataset.entry = entry.id || '';
    tip.hidden = false;
    tip.style.left = Math.min(innerWidth - 330, ev.clientX + 14) + 'px'; tip.style.top = Math.min(innerHeight - 120, ev.clientY + 14) + 'px';
  }
  let on = false;
  return {
    get on() { return on; },
    set(v) {
      if (v && !on) { canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerleave', hide); }
      else if (!v && on) { canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerleave', hide); tip?.remove(); tip = null; }
      on = !!v;
    },
    hoverAt: (clientX, clientY) => move({ clientX, clientY }),
  };
}
