// game/areas/view_ov26.js — VIEW ov26 (6800): bottom-line and list menus (Pool ov25 9D00 = Pool engine/menus.js).
// Owner: cab-build-areas. Source: decode/pseudo/VIEW.pas.md ov26; screens VIEW-09 / VIEW-10 / VIEW-13.
// HorizontalMenu / AskYesNo / ClearMenuLine have ONE implementation, engine/menus_cab.js (cab-build-engine, needed by the
// ENGINE units at M1); this module re-exports them and binds the VIEW parts their loop calls through `menu` hooks:
// the encounter animation (6800:04f6..05b7: DrawPictureScreenOrView(3, 3, animate, enc_Anim.pic[cur]), delay * 10
// hundredths, advance), Mem[4CFF] (force / clear), and the ov27 city overlay (view_Mode 3, bigpic_Id 79h, anim_Id <> 'P').
// The list menus are translated here (Curse deltas re-read from decode/listings/ov26.lst): DrawItemSelected (6800:0a56)
// draws inverse, DrawText(col, row, 0, selColour, text); DrawList / DrawItemNormal draw fg = header / normal colour on
// bg 0; ListItem is (list, n) in Curse (Pool (n, list)).
// Menu state lives in the DS globals G.menu_Sel / menu_Ext / menu_Timeout / menu_TimeoutKey / menu_Top.

import { G } from '../engine/state.js';
import { DrawText, DrawRepeatedGlyph, ClearRectangle } from '../engine/text.js';
import { pointer, setPointerRegion, clearPointerRegion, KEY } from '../engine/input.js';
import { hooks } from '../plus/hooks.js';   // GBP W1 (docs/PLUS_HOOKS.md)
import { menu, HorizontalMenu, AskYesNo, ClearMenuLine } from '../engine/menus_cab.js';
import { view } from './view_ov30.js';
import { BigPicAnimSetPos, BigPicAnimPhaseA, BigPicAnimPhaseB } from './view_ov27.js';
import { DrawPictureScreenOrView } from './view_ov29.js';

export { menu, HorizontalMenu, AskYesNo, ClearMenuLine };

// VIEW hooks of HorizontalMenu's wait loop (engine/menus_cab.js contract)
menu.animHook = async (animate) => {                                     // 6800:051c / 0526
  const a = G.enc_Anim;
  if (!a || !(a.cur > 0)) return null;
  DrawPictureScreenOrView(3, 3, animate, a.pic[a.cur]);
  return (a.delay[a.cur] ?? 0) * 10;                                     // 6800:054a @LongMul by 0Ah
};
menu.animAdvance = () => { const a = G.enc_Anim; a.cur++; if (a.cur > a.count) a.cur = 1; };   // 6800:058a .. 059c
menu.forceAnim = () => view.mem(0x4CFF) !== 0;                           // 6800:04f6 Mem[4CFF]
menu.clearForceAnim = () => view.setMem(0x4CFF, 0);                      // 6800:07a8
menu.cityAnim = {                                                        // 6800:04a7 .. 04c6, 04e0, 0789, 07c8
  active: () => G.view_Mode === 3 && G.bigpic_Id === 0x79 && G.anim_Id !== 0x50,
  setPos: BigPicAnimSetPos, phaseA: BigPicAnimPhaseA, phaseB: BigPicAnimPhaseB,
};

if (G.menu_Sel === undefined) G.menu_Sel = 1;
if (G.menu_Top === undefined) G.menu_Top = 0;
if (G.menu_Timeout === undefined) G.menu_Timeout = 0;
if (G.menu_TimeoutKey === undefined) G.menu_TimeoutKey = '\0';
if (G.menu_Ext === undefined) G.menu_Ext = false;

// 6800:0011 ListItem(list, n): n-th item (0-based) or nil — Pascal order (list, n) from the pushes (6800:08c4)
export function ListItem(list, n) {
  let p = list, k = 0;
  for (; p && k !== n; k++) p = p.next;
  return k === n ? p : null;
}
// 6800:0074 ListCount(list)
export function ListCount(list) { let k = 0; for (let p = list; p; p = p.next) k++; return k; }

// ---------------------------------------------------------------------------------------------------------------------
// Lists. TMenuItem (2Eh bytes): { text: string[40], isHeader (+29h), next (+2Ah) }. Nodes may also be byte records
// { b: Uint8Array, next } (string[40] at +0, header flag at +29h), as in the Pool engine.
const nodeText = (q) => {
  if (q.text !== undefined) return q.text;
  let t = ''; for (let i = 1; i <= q.b[0]; i++) t += String.fromCharCode(q.b[i]);
  return t;
};
const nodeHeader = (q) => (q.isHeader !== undefined ? q.isHeader : q.b[0x29]);

// 6800:1199 NewMenuList(var list, n): n empty items linked by +2Ah
export function NewMenuList(list, n) {
  let head = null, last = null;
  for (let i = 0; i < n; i++) {                             // 6800:11a8 .. 1203
    const it = { text: '', isHeader: 0, next: null };
    if (!head) head = it; else last.next = it;
    last = it;
  }
  if (list) list.v = head;
  return head;
}
// 6800:1241 FreeMenuList(var list)
export function FreeMenuList(list) { if (list) list.v = null; return null; }   // 6800:1280

// 6800:0DF9 VerticalListMenu(prompt, options, headerColour, normalColour, selColour, left, top, right, bottom, list,
// showExit, var redraw, var index, var item): Char — var parameters are { v } objects
export async function VerticalListMenu(prompt, options, cHeader, cItem, cSel, left, top, right, bottom, list, showExit,
  redraw, index, item) {
  if (!list) { item.v = null; return '\0'; }                // 6800:0e00 nil list
  G.menu_Sel = 1;
  const width = (right - left + 1) & 0xFF;
  const count = ListCount(list);
  const page = bottom - top + 1;
  let leading = 0; for (let q = list; q && nodeHeader(q); q = q.next) leading++;   // first selectable 6800:0e20 .. 0e65
  const it = (n) => ListItem(list, n);
  const firstNB = (s) => { let i = 1; while (i < s.length && s[i - 1] === ' ') i++; return i; };   // 6800:09C4
  const lastNB = (s) => { let i = s.length; while (i > 1 && s[i - 1] === ' ') i--; return i; };    // 6800:0A10
  const drawList = (t) => {                                 // 6800:088A DrawList
    ClearRectangle(left, top, right, bottom);               // 6800:08b0
    let q = it(t), row = top;                               // 6800:08c4
    while (q && row <= bottom) {
      const s = nodeText(q);
      DrawText(left, row, nodeHeader(q) ? cHeader : cItem, 0, s);   // 6800:0932 / 0955
      if (s.length < width) DrawRepeatedGlyph(left + s.length, row, 0, 0, width - s.length, ' ', true);   // 6800:09a4
      q = q.next; row++;
    }
  };
  const drawItem = (n, sel) => {                            // 6800:0A56 DrawItemSelected / 0AF8 DrawItemNormal
    const q = it(n); if (!q) return;
    const s = nodeText(q), f = firstNB(s), l = lastNB(s);
    const col = left + f - 1, row = top + (n - G.menu_Top), part = s.substr(f - 1, l - f + 1);
    if (sel) DrawText(col, row, 0, cSel, part);             // 6800:0aed inverse
    else DrawText(col, row, nodeHeader(q) ? cHeader : cItem, 0, part);   // 6800:0b99 / 0bee
  };
  const skipHeaders = (down) => {                           // 6800:0BF9
    let k = 0;
    while (k < page && it(index.v) && nodeHeader(it(index.v))) {
      k++;
      if (!down) {
        index.v--; if (index.v < G.menu_Top) index.v = G.menu_Top + page - 1;
        if (index.v > count - 1) index.v = count - 1;
      } else {
        index.v++; if (index.v > G.menu_Top + page - 1) index.v = G.menu_Top;
        if (index.v > count - 1) index.v = G.menu_Top;
      }
    }
  };
  const moveSelection = (down) => {                         // 6800:0D6B
    if (!down) {
      index.v--; if (index.v < G.menu_Top) index.v = G.menu_Top + page - 1;
      if (index.v > count - 1) index.v = count - 1;
    } else {
      index.v++; if (index.v > G.menu_Top + page - 1) index.v = G.menu_Top;
      if (index.v > count - 1) index.v = G.menu_Top;
    }
    skipHeaders(down);
  };
  const pageList = (down) => {                              // 6800:0CD9
    const rel = index.v - G.menu_Top;
    if (!down) { G.menu_Top -= page; if (G.menu_Top < 0) G.menu_Top = 0; }
    else { G.menu_Top += page; if (count - page < G.menu_Top) G.menu_Top = count - page; }
    index.v = G.menu_Top + rel;
    skipHeaders(down);
    drawList(G.menu_Top);                                   // 6800:0d57 / 0d62
  };
  if (index.v < G.menu_Top) { G.menu_Top = index.v; redraw.v = true; }   // 6800:0e92 clamp menu_Top
  if (count < G.menu_Top) { G.menu_Top = 0; redraw.v = true; }
  index.v++;                                                // 6800:0f2b
  moveSelection(false);
  if (redraw.v) drawList(G.menu_Top);                       // 6800:0f3d
  redraw.v = false;
  const prevWheel = pointer.listWheel;
  pointer.listWheel = { up: KEY.home, down: KEY.end };
  setPointerRegion('vlist', { x1: left * 8, y1: top * 8, x2: right * 8 + 7, y2: bottom * 8 + 7, prio: 5,
    keysAt: (x, y) => {
      const n = G.menu_Top + (Math.floor(y / 8) - top);
      const node = it(n);
      if (!node || nodeHeader(node)) return null;
      if (n === index.v) return [KEY.enter];
      const keys = [], dir = n > index.v ? 1 : -1;
      for (let k = index.v + dir; k !== n + dir; k += dir) if (it(k) && !nodeHeader(it(k))) keys.push(dir > 0 ? KEY.end : KEY.home);
      return keys.length ? keys : null;
    } });
  hooks.emit('listDrawn', () => ({ region: 'vlist', prompt, options, index: index.v, top: G.menu_Top, page, exit: !!showExit,
    items: Array.from({ length: count }, (_, n) => ({ text: nodeText(it(n)), header: !!nodeHeader(it(n)) })),
    rect: { x1: left * 8, y1: top * 8, x2: right * 8 + 7, y2: bottom * 8 + 7 } }));
  let key;
  for (;;) {
    drawItem(index.v, true);                                // 6800:0f4f
    let opts = options;
    const hasNext = G.menu_Top < count - page; if (hasNext) opts += ' Next';   // cs:0DE7
    const hasPrev = leading < G.menu_Top; if (hasPrev) opts += ' Prev';        // cs:0DED
    if (showExit) opts += ' Exit';                                              // cs:0DF3
    const r = await HorizontalMenu(prompt, opts, cHeader, cItem, cSel, true, false);   // 6800:1036
    key = r.key;
    drawItem(index.v, false);                               // 6800:1044
    if (r.ext) {                                            // 6800:1059 .. 10b0
      if (key === 'G') moveSelection(false);                // Home
      else if (key === 'O') moveSelection(true);            // End
      else if (key === 'I') { if (hasPrev) pageList(false); }   // PgUp
      else if (key === 'Q') { if (hasNext) pageList(true); }    // PgDn
      continue;
    }
    if (key === 'P') { pageList(false); continue; }
    if (key === 'N') { pageList(true); continue; }
    break;
  }
  clearPointerRegion('vlist'); pointer.listWheel = prevWheel;
  if (key === '\x1b' || key === 'E' || key === '\0') { item.v = null; return '\0'; }
  item.v = it(index.v);                                     // 6800:10e2
  return key;
}

// 6800:0000 ov26_LoadDeps / 6800:128D ov26_init: empty.
