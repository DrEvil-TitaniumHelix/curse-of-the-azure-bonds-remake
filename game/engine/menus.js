// menus.js — the bottom-line and list menus (VIEW ov25, decode/pseudo/VIEW.pas.md; screens VIEW-09/10, SCREENS_INDEX §0).
// por-only: Pool menu geometry, highlighting and key semantics (whole module) (profile: engine.id (decoded adapter); game/profiles/PORONLY.md)
//
// HorizontalMenu(prompt, options, promptColour, textColour, hotColour, allowExt, animate) -> {key, ext}
//   Parameter roles per the asm (9D00:01DA DrawOptions, fix #ref-2): hotkey characters ('0'..'9','A'..'Z') and the whole
//   selected option in hotColour, the other letters in textColour. Enter is accepted only if textColour or hotColour is
//   non-zero (9D00:03E5). Returns key: #0 = Esc, #13 = Enter (option index in menu.sel), ' ', a hotkey letter, or a scan
//   code with ext = true (extended keys when allowExt; keypad digits mapped through DS:288C).

import { DrawText, DrawRepeatedGlyph, ClearGlyphRun, ClearTextRectangle } from './text.js';
import { KeyPressed, ReadGameKey, gamepad, pointer, setPointerRegion, clearPointerRegion, KEY } from './input.js';
import { TimeInHundredths, yieldShort } from './timer.js';
import { UpCase } from './tp.js';
import { hooks } from '../plus/hooks.js';   // GBP W1 (docs/PLUS_HOOKS.md)

export const menu = {
  sel: 1,                 // menu_Sel g_6B2B (1-based)
  ext: false,             // menu_Ext g_6B2C
  timeout: 0,             // menu_Timeout g_6B2E/30 (hundredths, <= 0 none)
  timeoutKey: '\0',       // menu_TimeoutKey g_6B32
  top: 1,                 // menu_Top g_6B29
  animHook: null,         // async (animate) => void: one step of the encounter animation (enc_Anim, ov28) — set by the view area
  forceAnim: () => false, // ecl_Mem4900^.w[$3FE] <> 0 (set by the ECL VM)
  clearForceAnim: () => {},
};

const HOTSET = /[0-9A-Z]/;                                  // CS:00AB / CS:01BA
const KEYPAD = [0x4F, 0x50, 0x51, 0x4B, 0x20, 0x4D, 0x47, 0x48, 0x49];   // DS:288C for '1'..'9'

// 9D00:00CB ParseOptions: an option starts at every hotkey character; it ends two characters before the next start
function parseOptions(s) {
  const start = [0], end = [0];
  let k = 1;
  for (let i = 1; i <= s.length; i++) {
    if (HOTSET.test(s[i - 1])) {
      if (!start[k]) start[k] = i;
      else { end[k] = i - 2; k++; start[k] = i; }
    }
  }
  end[k] = s.length;
  return { start, end, count: k };
}

// 9D00:01DA DrawOptions(sel)
function drawOptions(o, sel) {
  const { options, promptLen, textColour, hotColour } = o;
  if (options.length === 0) return;
  for (let i = 1; i <= options.length; i++) {
    const ch = options[i - 1];
    let colour;
    if (i < o.p.start[sel] || o.p.end[sel] < i || hotColour === 0)
      colour = HOTSET.test(ch) ? hotColour : textColour;
    else colour = hotColour;                                 // the selected option
    DrawRepeatedGlyph(promptLen + i - 1, 24, colour, 1, ch, true);
  }
  if (promptLen + options.length < 0x27)                     // rest of the line cleared
    DrawRepeatedGlyph(promptLen + options.length, 24, 0, 0x28 - promptLen - options.length, ' ', true);
}

// 9D00:03BD HorizontalMenu
export async function HorizontalMenu(prompt, options, promptColour, textColour, hotColour, allowExt, animate) {
  prompt = prompt.slice(0, 40); options = options.slice(0, 40);
  menu.ext = false;
  const haveEnter = !(textColour === 0 && hotColour === 0);  // 9d00:03e5
  const p = parseOptions(options);
  if (p.count < menu.sel) menu.sel = 1;                      // 9d00:040f
  const o = { options, promptLen: prompt.length, textColour, hotColour, p };
  gamepad.menuLetters = p.start.slice(1).map((i) => options[i - 1]);
  let key = '\0', ext = false, done = false, aborted = false;
  let t = TimeInHundredths();
  if (prompt !== '') DrawText(0, 24, promptColour, prompt);  // 9d00:0475
  drawOptions(o, menu.sel);                                  // 9d00:048b
  // pointer layer (input.js): a click on an option = its hotkey (the character at the option's start)
  const prevRegion = pointer.regions.get('hmenu'), prevExt = pointer.menuExt;
  setPointerRegion('hmenu', { x1: o.promptLen * 8, y1: 192, x2: (o.promptLen + options.length) * 8 - 1, y2: 199, prio: 4,
    keysAt: (x) => {
      const i = Math.floor(x / 8) - o.promptLen + 1;
      for (let k = 1; k <= p.count; k++) if (i >= p.start[k] && i <= p.end[k]) return [[options.charCodeAt(p.start[k] - 1), 0]];
      return null;
    } });
  pointer.menuExt = !!allowExt;
  hooks.emit('menuDrawn', () => ({ region: 'hmenu', kind: 'hmenu', prompt, selected: menu.sel, ext: !!allowExt, enter: haveEnter,
    items: p.start.slice(1, p.count + 1).map((s, k) => ({ label: options.slice(s - 1, p.end[k + 1]), key: options[s - 1] })),
    rect: { x1: o.promptLen * 8, y1: 192, x2: (o.promptLen + options.length) * 8 - 1, y2: 199 } }));   // 9d00:048b
  do {
    if ((menu.forceAnim() || animate) && menu.animHook) {     // 9d00:04cc  encounter picture keeps animating
      if (await menu.animHook(animate, () => (t = TimeInHundredths()))) {}
    }
    if (menu.timeout > 0 && TimeInHundredths() - t >= menu.timeout) {   // 9d00:0530 (timer restarts with each animation frame)
      key = menu.timeoutKey; done = true;
    } else if (KeyPressed()) {                               // 9d00:0566
      key = await ReadGameKey();
      if (key === '\0') {                                    // 9d00:0580  extended key
        key = await ReadGameKey();
        if (allowExt) { ext = true; done = true; }
      } else if (key === '\x1b') { key = '\0'; done = true; }                       // Esc
      else if (key === '\r') { if (haveEnter) done = true; }                         // Enter
      else if (key === ',') { menu.sel = menu.sel === 1 ? p.count : menu.sel - 1; drawOptions(o, menu.sel); }
      else if (key === '.') { menu.sel = menu.sel === p.count ? 1 : menu.sel + 1; drawOptions(o, menu.sel); }
      else {
        key = UpCase(key);                                   // 9d00:0610
        if (key === ' ') done = true;
        else if (/[0-9A-Z]/.test(key)) {
          for (let i = 1; i <= options.length; i++) {
            if (options[i - 1] === key) {
              const opt = p.start.indexOf(i, 1);
              if (opt > 0) { done = true; menu.sel = opt; drawOptions(o, menu.sel); }
            }
          }
        }
        if (allowExt && /[1-9\\]/.test(key)) {               // 9d00:06a0  keypad digits as cursor keys
          key = key === '\\' ? '\x37' : String.fromCharCode(KEYPAD[key.charCodeAt(0) - 49]);
          ext = true; done = true;
        }
      }
    } else if (menu.abortWhen && menu.abortWhen()) { key = '\0'; aborted = true; done = true; }   // GBP #14: set around the explore menu only
    else await yieldShort();
  } while (!done);
  menu.clearForceAnim();                                     // 9d00:06de
  menu.ext = ext;
  if (prevRegion) setPointerRegion('hmenu', prevRegion); else clearPointerRegion('hmenu');
  pointer.menuExt = prevExt;
  return { key, ext, aborted };
}

// 9D00:10D1 AskYesNo(prompt, c1, c2, c3): default "No"
export async function AskYesNo(prompt, c1, c2, c3) {
  menu.sel = 2;
  let r;
  do r = await HorizontalMenu(prompt, 'Yes No', c1, c2, c3, false, false);   // 9d00:111b
  while (r.key !== 'Y' && r.key !== 'N');
  return r.key;
}

// 9D00:06FB ClearMenuLine
export function ClearMenuLine() { ClearGlyphRun(0, 24, 0, 40); }

// ---------------------------------------------------------------------------------------------------------------------
// ov25 lists. TMenuItem (46 bytes in the original): { text: string[40], isHeader (+29h), next (+2Ah) }.
// Var parameters are { v } objects (engine contract).
// Nodes come in two shapes: menus.js nodes { text, isHeader, next } and byte nodes { b: Uint8Array, next } (the original
// TMenuItem bytes: string[40] at +0, header flag at +29h — item records, coin lists; fix request #r2-1). DrawList and the
// header tests read node+0 / node+29h (9D00:07A4), so both shapes go through nodeText / nodeHeader.
const nodeText = (p) => {
  if (p.text !== undefined) return p.text;
  let t = ''; for (let i = 1; i <= p.b[0]; i++) t += String.fromCharCode(p.b[i]);   // string[40] at node+0
  return t;
};
const nodeHeader = (p) => (p.isHeader !== undefined ? p.isHeader : p.b[0x29]);         // node+29h

// 9D00:1140 NewMenuList(n, var list): n empty items linked
export function NewMenuList(n, list) {
  let head = null, last = null;
  for (let i = 0; i < n; i++) {
    const it = { text: '', isHeader: 0, next: null };
    if (!head) head = it; else last.next = it;
    last = it;
  }
  if (list) list.v = head;
  return head;
}
// 9D00:11F3 FreeMenuList(var list)
export function FreeMenuList(list) { if (list) list.v = null; return null; }
// 9D00:0000 ListItem(n [BP+0Ah], list [BP+6]): n-th item (0-based) or nil — Pascal order from the bytes (VIEW #verify-19, #e4)
export function ListItem(n, list) {
  let p = list, k = 0;
  for (; p && k !== n; k++) p = p.next;
  return k === n ? p : null;
}
// 9D00:0067 ListCount(list)
export function ListCount(list) { let k = 0; for (let p = list; p; p = p.next) k++; return k; }

// 9D00:0D9A VerticalListMenu(prompt, options, cHeader [24h], cItem [22h], cSel [20h], left, top, right, bottom, list,
// showExit, var redraw, var index, var item): Char
export async function VerticalListMenu(prompt, options, cHeader, cItem, cSel, left, top, right, bottom, list, showExit,
  redraw, index, item) {
  if (!list) { index.v = 0; item.v = null; return '\0'; }
  menu.sel = 1;
  const width = (right - left + 1) & 0xFF;                                  // [BP-54h]
  const count = ListCount(list);                                            // [BP-56h]
  const page = bottom - top + 1;                                            // [BP-59h]
  let leading = 0; for (let p = list; p && nodeHeader(p); p = p.next) leading++;   // [BP-8Bh]
  const it = (n) => ListItem(n, list);
  const firstNB = (s) => { let i = 1; while (i < s.length && s[i - 1] === ' ') i++; return i; };   // 9D00:08D7
  const lastNB = (s) => { let i = s.length; while (i > 1 && s[i - 1] === ' ') i--; return i; };    // 9D00:0923
  const drawList = (t) => {                                                 // 9D00:07A4 DrawList
    ClearTextRectangle(left, top, right, bottom);
    let p = it(t), row = top;
    while (p && row <= bottom) {
      const t = nodeText(p);
      DrawText(left, row, nodeHeader(p) ? cHeader : cItem, t);
      if (t.length < width) DrawRepeatedGlyph(left + t.length, row, 0, width - t.length, ' ', true);
      p = p.next; row++;
    }
  };
  const drawItem = (n, sel) => {                                            // 9D00:0969 / 0A08
    const p = it(n); if (!p) return;
    const t = nodeText(p), f = firstNB(t), l = lastNB(t);
    DrawText(left + f - 1, top + (n - menu.top), sel ? cSel : (nodeHeader(p) ? cHeader : cItem), t.substr(f - 1, l - f + 1));
  };
  const skipHeaders = (down) => {                                           // 9D00:0B03
    let k = 0;
    while (k < page && it(index.v) && nodeHeader(it(index.v))) {
      k++;
      if (!down) {
        index.v--; if (index.v < menu.top) index.v = menu.top + page - 1;
        if (index.v > count - 1) index.v = count - 1;
      } else {
        index.v++; if (index.v > menu.top + page - 1) index.v = menu.top;
        if (index.v > count - 1) index.v = menu.top;
      }
    }
  };
  const moveSelection = (down) => {                                         // 9D00:0CC5
    if (!down) {
      index.v--; if (index.v < menu.top) index.v = menu.top + page - 1;
      if (index.v > count - 1) index.v = count - 1;
    } else {
      index.v++; if (index.v > menu.top + page - 1) index.v = menu.top;
      if (index.v > count - 1) index.v = menu.top;
    }
    skipHeaders(down);
  };
  const pageList = (down) => {                                              // 9D00:0C33
    const rel = index.v - menu.top;
    if (!down) { menu.top -= page; if (menu.top < 0) menu.top = 0; }
    else { menu.top += page; if (count - page < menu.top) menu.top = count - page; }
    index.v = menu.top + rel;
    skipHeaders(down);
    drawList(menu.top);
  };
  if (index.v < menu.top) { menu.top = index.v; redraw.v = true; }          // 9d00:0e45
  if (count < menu.top) { menu.top = 0; redraw.v = true; }
  index.v++;                                                                // 9d00:0ed2
  moveSelection(false);
  if (redraw.v) drawList(menu.top);                                         // 9d00:0ee4
  redraw.v = false;
  // pointer layer: click on an item = Home/End steps to it (the list's own keys, headers skipped); click on the highlighted
  // item = Enter; wheel = Home (up) / End (down)
  const prevWheel = pointer.listWheel;
  pointer.listWheel = { up: KEY.home, down: KEY.end };
  setPointerRegion('vlist', { x1: left * 8, y1: top * 8, x2: right * 8 + 7, y2: bottom * 8 + 7, prio: 5,
    keysAt: (x, y) => {
      const n = menu.top + (Math.floor(y / 8) - top);
      const node = it(n);
      if (!node || nodeHeader(node)) return null;
      if (n === index.v) return [KEY.enter];
      const keys = [];
      const dir = n > index.v ? 1 : -1;
      for (let k = index.v + dir; k !== n + dir; k += dir) if (it(k) && !nodeHeader(it(k))) keys.push(dir > 0 ? KEY.end : KEY.home);
      return keys.length ? keys : null;
    } });
  hooks.emit('listDrawn', () => ({ region: 'vlist', prompt, options, index: index.v, top: menu.top, page, exit: !!showExit,
    items: Array.from({ length: count }, (_, n) => ({ text: nodeText(it(n)), header: !!nodeHeader(it(n)) })),
    rect: { x1: left * 8, y1: top * 8, x2: right * 8 + 7, y2: bottom * 8 + 7 } }));   // 9d00:0ee4
  let key;
  for (;;) {
    drawItem(index.v, true);                                                // 9d00:0ef6
    let opts = options;
    const hasNext = menu.top < count - page; if (hasNext) opts += ' Next';  // cs:0D88
    const hasPrev = leading < menu.top; if (hasPrev) opts += ' Prev';       // cs:0D8E
    if (showExit) opts += ' Exit';                                          // cs:0D94
    const r = await HorizontalMenu(prompt, opts, cHeader, cItem, cSel, true, false);   // 9d00:0fdd
    key = r.key;
    drawItem(index.v, false);                                               // 9d00:0feb
    if (r.ext) {
      if (key === 'G') moveSelection(false);                                // Home
      else if (key === 'O') moveSelection(true);                            // End
      else if (key === 'I') { if (hasPrev) pageList(false); }               // PgUp
      else if (key === 'Q') { if (hasNext) pageList(true); }                // PgDn
      continue;
    }
    if (key === 'P') { pageList(false); continue; }                         // "Prev" (no hasPrev test, as the code)
    if (key === 'N') { pageList(true); continue; }                          // "Next"
    break;
  }
  clearPointerRegion('vlist'); pointer.listWheel = prevWheel;
  if (key === '\x1b' || key === 'E' || key === '\0') { item.v = null; return '\0'; }   // 9d00:1089
  item.v = it(index.v);
  return key;
}
