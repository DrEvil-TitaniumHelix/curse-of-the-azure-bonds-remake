// errors.js — engine error trap (owner P1: engine errors must be visible and kept). Not game behaviour.
//
// Every uncaught error (window 'error', 'unhandledrejection', and the try/catch around the program body / area coroutines
// in main.js and index.html) is (1) drawn in the game window — "ENGINE ERROR", the message and the top stack lines,
// word-wrapped to the 40-column screen, plus "PRESS F12 / SCREENSHOT THIS" — (2) stored in localStorage `por:lastError`
// and the ring `por:errors` (last 10) as {time, message, stack, url, screen, lastKeys}, (3) written with console.error.
// TerminateGame ends the program by throwing 'TerminateGame'; that is not an error.

import { text, LoadTextFont } from './text.js';
import { recentKeys } from './input.js';

const MAX_RING = 10;
export const errorKeys = { prefix: 'por' };   // cab: param engine.storage.errors (Curse 'cab': localStorage cab:lastError / cab:errors)
let shown = false;

function wrap(s, width) {
  const out = [];
  for (const raw of String(s).split('\n')) {
    let line = raw.replace(/\s+/g, ' ').trim();
    while (line.length > width) {
      let cut = line.lastIndexOf(' ', width);
      if (cut <= 0) cut = width;
      out.push(line.slice(0, cut));
      line = line.slice(cut).trim();
    }
    if (line) out.push(line);
  }
  return out;
}

function store(rec) {
  try { localStorage.setItem(errorKeys.prefix + ':lastError', JSON.stringify(rec)); } catch (e) { /* storage unavailable */ }
  try {
    let ring = [];
    try { ring = JSON.parse(localStorage.getItem(errorKeys.prefix + ':errors') || '[]'); } catch (e) { ring = []; }
    if (!Array.isArray(ring)) ring = [];
    ring.push(rec);
    while (ring.length > MAX_RING) ring.shift();
    localStorage.setItem(errorKeys.prefix + ':errors', JSON.stringify(ring));
  } catch (e) { /* storage unavailable */ }
}

// The message is drawn on an overlay canvas over the game screen (same 320x200 raster, same scale, the game's own font),
// so the game's framebuffer is not touched and later game drawing cannot hide it. Click the message to dismiss it.
const EGA = { 0x0A: [85, 255, 85], 0x0C: [255, 85, 85], 0x0E: [255, 255, 85], 0x0F: [255, 255, 255] };
let overlay = null;
function ensureOverlay() {
  if (overlay) return overlay;
  const game = document.getElementById('screen');
  const c = document.createElement('canvas');
  c.width = 320; c.height = 200; c.title = 'click to dismiss';
  Object.assign(c.style, { position: 'fixed', imageRendering: 'pixelated', zIndex: 10, cursor: 'pointer' });
  const place = () => { const r = game.getBoundingClientRect(); Object.assign(c.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' }); };
  place(); addEventListener('resize', place);
  c.addEventListener('click', () => { c.remove(); overlay = null; });
  document.body.appendChild(c);
  overlay = c;
  return c;
}
function draw(message, stack) {
  try {
    const c = ensureOverlay(), ctx = c.getContext('2d');
    const img = ctx.createImageData(320, 200);               // transparent except the error rows
    const put = (col, row, colour, s) => {
      const rgb = EGA[colour] || [255, 255, 255];
      for (let k = 0; k < s.length && col + k < 40; k++) {
        const g = s.toUpperCase().charCodeAt(k) % 64;          // the game's text mapping (0709:01DF)
        for (let y = 0; y < 8; y++) {
          const bits = text.font ? text.font[g * 8 + y] : 0;
          for (let x = 0; x < 8; x++) {
            const o = ((row * 8 + y) * 320 + (col + k) * 8 + x) * 4;
            const on = bits & (0x80 >> x);
            img.data[o] = on ? rgb[0] : 0; img.data[o + 1] = on ? rgb[1] : 0; img.data[o + 2] = on ? rgb[2] : 0; img.data[o + 3] = 255;
          }
        }
      }
    };
    for (let r = 13; r <= 24; r++) put(0, r, 0, ' '.repeat(40));   // black rows 13..24
    let row = 13;
    put(0, row++, 0x0C, 'ENGINE ERROR');
    for (const l of wrap(message, 40).slice(0, 4)) put(0, row++, 0x0F, l);
    const st = String(stack || '').split('\n').map((x) => x.trim()).filter((x) => x && !x.startsWith('Error'));
    const short = st.slice(0, 3).map((x) => x.replace(/^at\s+/, '').replace(/\(?https?:\/\/[^/]+\//, '').replace(/\)$/, ''));
    for (const x of short) for (const l of wrap(x, 40).slice(0, 2)) if (row <= 22) put(0, row++, 0x0A, l);
    put(0, 24, 0x0E, 'PRESS F12 / SCREENSHOT THIS');
    ctx.putImageData(img, 0, 0);
  } catch (e) { /* drawing must never throw */ }
}

export function reportError(err, where = '') {
  if (err && String(err.message || err) === 'TerminateGame') return;
  const message = (err && (err.message || err.reason)) ? String(err.message || err.reason) : String(err);
  const stack = (err && err.stack) ? String(err.stack) : '';
  const q = new URLSearchParams(location.search);
  const rec = {
    time: new Date().toISOString(), message: (where ? where + ': ' : '') + message, stack, url: location.href,
    screen: window.__screenId || q.get('screen') || null, lastKeys: recentKeys(),
  };
  console.error('ENGINE ERROR', rec.message, err);
  store(rec);
  if (!shown) {                                                // first error stays on screen (later ones are stored too)
    shown = true;
    if (text.font) draw(rec.message, stack);
    else LoadTextFont().then(() => draw(rec.message, stack)).catch(() => {});   // error before InitGameState loaded the font
  }
  window.__engineError = rec;
}

export function installErrorTrap() {
  addEventListener('error', (ev) => reportError(ev.error || ev.message, 'error'));
  addEventListener('unhandledrejection', (ev) => reportError(ev.reason, 'unhandledrejection'));
}

// Fatal data errors of the original (e.g. B100:1132..115B Load3DMap): RestorePreviousVideoMode; WriteLn(msg);
// [ReadGameKey; RestorePreviousVideoMode;] TerminateGame. The sites throw fatal(msg, wait); MainProgram's catch runs
// the sequence (fix request #a-10, ref SY-01) instead of the build's ENGINE ERROR overlay.
export function fatal(msg, wait) {
  const e = new Error(msg);
  e.fatalText = msg; e.fatalWait = !!wait;
  return e;
}
