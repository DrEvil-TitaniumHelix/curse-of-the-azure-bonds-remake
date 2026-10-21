// menus_cab.js — Curse bottom-line and list menus (engine.id 'cab-1.0' adapter of engine/menus.js; BUILD_PLAN §2 input row).
// Translation of CurseAzureBondsRE decode/pseudo/VIEW.pas.md ov26 (6800) = Pool ov25 (9D00), re-read against
// decode/listings/ov26.lst. Deltas vs Pool (H, asm):
// - DrawOptions 6800:01E5: the selected option is drawn INVERSE (fg 0 on bg hotColour, 6800:025d..0281); other hotkey
//   characters fg hotColour, the rest textColour, both on bg 0; the rest of the row is cleared from promptLen+len with
//   count 27h - len - promptLen + 1 when promptLen + len < 27h.
// - HorizontalMenu 6800:03D4: Enter returns the selected option's start character (6800:0630; #13 if that is #0) instead of
//   #13; menu_Sel is kept across calls (reset to 1 only when > optCount); the 2D city overlay animation (ov27) runs while
//   waiting (menu.cityAnim, set by the VIEW lane); keypad digits map through DS:27CE (6800:0751).
// Var parameters are { v } objects (engine contract). Returns { key, ext } like engine/menus.js.

import { DrawText, DrawRepeatedGlyph, ClearGlyphRun, ClearTextRectangle } from './text.js';
import { KeyPressed, ReadGameKey, gamepad, pointer, setPointerRegion, clearPointerRegion, KEY } from './input.js';
import { TimeInHundredths, yieldShort } from './timer.js';
import { UpCase } from './tp.js';
import { G } from './state.js';
import { hooks } from '../plus/hooks.js';   // GBP W1 (docs/PLUS_HOOKS.md)

export const menu = {
  get sel() { return G.menu_Sel ?? 1; }, set sel(v) { G.menu_Sel = v; },            // menu_Sel g_7294 (1-based)
  get ext() { return !!G.menu_Ext; }, set ext(v) { G.menu_Ext = v ? 1 : 0; },       // menu_Ext g_7295
  get timeout() { return G.menu_Timeout ?? 0; }, set timeout(v) { G.menu_Timeout = v; },   // g_7296/g_7298 (hundredths)
  get timeoutKey() { return G.menu_TimeoutKey ?? '\0'; }, set timeoutKey(v) { G.menu_TimeoutKey = v; },   // g_729A
  get top() { return G.menu_Top ?? 1; }, set top(v) { G.menu_Top = v; },            // menu_Top g_7292
  // encounter picture animation (6800:0507..05a4): set by the VIEW lane. animHook(animate) draws the current frame
  // (DrawPictureScreenOrView(3, 3, animate, enc_Anim.pic[cur])) and returns its delay in hundredths (enc_Anim.delay[cur] * 10),
  // or null when there is no animation (enc_Anim.cur = 0); animAdvance() steps enc_Anim.cur (wraps to 1).
  animHook: null, animAdvance: null,
  forceAnim: () => false,          // ecl_Mem4B00^.w[3FEh] <> 0 (VM 4CFF)
  clearForceAnim: () => {},
  // 2D city overlay (ov27, VIEW-13): active() = (view_Mode = 3) and (bigpic_Id = 79h) and (anim_Id <> 'P'); set by VIEW
  cityAnim: null,                  // { active(), setPos(), phaseA(), phaseB() }
};

const HOTSET = /[0-9A-Z]/;                                  // set cs:00B5 / cs:01C5

// 6800:00D5 ParseOptions: an option starts at every hotkey character; it ends two characters before the next start
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

// 6800:01E5 DrawOptions(sel)
function drawOptions(o, sel) {
  const { options, promptLen, textColour, hotColour } = o;
  if (options.length === 0) return;                          // 6800:01ee
  for (let i = 1; i <= options.length; i++) {                // 6800:0211
    const ch = options[i - 1];
    if (o.p.start[sel] <= i && i <= o.p.end[sel] && hotColour !== 0)
      DrawRepeatedGlyph(promptLen + i - 1, 24, 0, hotColour, 1, ch, true);            // 6800:0281  selected: inverse
    else if (HOTSET.test(ch)) DrawRepeatedGlyph(promptLen + i - 1, 24, hotColour, 0, 1, ch, true);   // 6800:02db
    else DrawRepeatedGlyph(promptLen + i - 1, 24, textColour, 0, 1, ch, true);         // 6800:0319
  }
  if (promptLen + options.length < 0x27)                     // 6800:033f
    DrawRepeatedGlyph(promptLen + options.length, 24, 0, 0, 0x27 - options.length - promptLen + 1, ' ', true);   // 6800:0389
}

// 6800:03D4 HorizontalMenu(prompt, options, promptColour, textColour, hotColour, allowExt, animate, var ext): Char
export async function HorizontalMenu(prompt, options, promptColour, textColour, hotColour, allowExt, animate) {
  prompt = prompt.slice(0, 40); options = options.slice(0, 40);   // 6800:03db / 03ee  string[40]
  menu.ext = false;                                          // 6800:0401
  const haveOpts = !(textColour === 0 && hotColour === 0);   // 6800:0406
  const p = parseOptions(options);                           // 6800:0423
  if (menu.sel > p.count) menu.sel = 1;                      // 6800:0426
  const o = { options, promptLen: prompt.length, textColour, hotColour, p };
  gamepad.menuLetters = p.start.slice(1).map((i) => options[i - 1]);
  let key = '\0', ext = false, done = false, aborted = false;   // 6800:043a .. 0445 (aborted: GBP)
  let t0 = TimeInHundredths();                               // 6800:0449
  let tA = TimeInHundredths() + 0x1E, tB = tA + 0x32;        // 6800:0454 / 0465
  if (prompt !== '') DrawText(0, 24, promptColour, 0, prompt);   // 6800:048e
  drawOptions(o, menu.sel);                                  // 6800:04a4
  const city = menu.cityAnim && menu.cityAnim.active() ? menu.cityAnim : null;   // 6800:04a7
  if (city) { await city.setPos(); await city.phaseA(); await city.phaseB(); }   // 6800:04bc .. 04c6
  // pointer layer (input.js): a click on an option = its hotkey (the character at the option's start)
  const prevRegion = pointer.regions.get('hmenu'), prevExt = pointer.menuExt;
  setPointerRegion('hmenu', { x1: o.promptLen * 8, y1: 192, x2: (o.promptLen + options.length) * 8 - 1, y2: 199, prio: 4,
    keysAt: (x) => {
      const i = Math.floor(x / 8) - o.promptLen + 1;
      for (let k = 1; k <= p.count; k++) if (i >= p.start[k] && i <= p.end[k]) return [[options.charCodeAt(p.start[k] - 1), 0]];
      return null;
    } });
  pointer.menuExt = !!allowExt;
  hooks.emit('menuDrawn', () => ({ region: 'hmenu', kind: 'hmenu', prompt, selected: menu.sel, ext: !!allowExt, enter: haveOpts,
    items: p.start.slice(1, p.count + 1).map((s, k) => ({ label: options.slice(s - 1, p.end[k + 1]), key: options[s - 1] })),
    rect: { x1: o.promptLen * 8, y1: 192, x2: (o.promptLen + options.length) * 8 - 1, y2: 199 } }));
  do {
    if (city && TimeInHundredths() >= tA) { await city.phaseA(); tA = tB + 0x1E; }   // 6800:04e0 / 04f1
    if ((menu.forceAnim() || animate) && menu.animHook) {    // 6800:0507
      const delay = await menu.animHook(animate);            // 6800:0545  null = enc_Anim.cur = 0 (6800:051c)
      if (delay !== null && delay !== undefined && (TimeInHundredths() - t0 >= delay || menu.forceAnim())) {   // 6800:0574 / 057e
        if (menu.animAdvance) menu.animAdvance();            // 6800:058a
        t0 = TimeInHundredths();                             // 6800:059c
      }
    }
    if (menu.timeout > 0 && TimeInHundredths() - t0 >= menu.timeout) {   // 6800:05a7 / 05b7
      key = menu.timeoutKey; done = true;                    // 6800:05d0
    } else if (KeyPressed()) {                               // 6800:05dd
      key = await ReadGameKey();                             // 6800:05e9
      if (key === '\0') {                                    // 6800:05f1  extended key
        key = await ReadGameKey();                           // 6800:05f7
        if (allowExt) { ext = true; done = true; }           // 6800:05ff
      } else if (key === '\x1b') { done = true; key = '\0'; }                         // 6800:0616
      else if (key === '\r') {                               // 6800:0625
        if (haveOpts) {                                      // 6800:0629
          key = options[p.start[menu.sel] - 1] ?? '\0';      // 6800:0639
          if (key === '\0') key = '\r';                      // 6800:0647
          done = true;
        }
      } else if (key === ',') { menu.sel = menu.sel === 1 ? p.count : menu.sel - 1; drawOptions(o, menu.sel); }   // 6800:0658
      else if (key === '.') { menu.sel = menu.sel === p.count ? 1 : menu.sel + 1; drawOptions(o, menu.sel); }     // 6800:067c
      else {
        key = UpCase(key);                                   // 6800:06a4
        if (key === ' ' || /[0-9A-Z]/.test(key)) {          // 6800:06b5  set cs:0394
          if (key === ' ') done = true;                      // 6800:06bc
          else for (let i = 1; i <= options.length; i++) {   // 6800:06c8
            if (options[i - 1] === key) {                    // 6800:06e9
              done = true;
              let k = 1; while (p.start[k] !== i) k++;       // 6800:06f6
              menu.sel = k; drawOptions(o, menu.sel);        // 6800:0710 / 0719
            }
          }
        }
        if (allowExt && /[1-9\\]/.test(key)) {               // 6800:0725 / 0734  set cs:03B4
          key = key === '\\' ? '\x37' : String.fromCharCode(G.ds ? G.ds[0x27CE + key.charCodeAt(0) - 0x31] : 0);   // 6800:0741 / 0751
          ext = true; done = true;
        }
      }
    } else if (menu.abortWhen && menu.abortWhen()) { key = '\0'; aborted = true; done = true; }   // GBP #11/#12: set around the explore menu only
    else await yieldShort();
    if (city && TimeInHundredths() >= tB) { await city.phaseB(); tB = tA + 0x32; }   // 6800:0778 / 0789
  } while (!done);
  menu.clearForceAnim();                                     // 6800:07a8  ecl_Mem4B00^.w[3FEh] := 0
  if (city) await city.phaseB();                             // 6800:07c8
  menu.ext = ext;                                            // 6800:07d9
  if (prevRegion) setPointerRegion('hmenu', prevRegion); else clearPointerRegion('hmenu');
  pointer.menuExt = prevExt;
  return aborted ? { key, ext, aborted } : { key, ext };
}

// 6800:112A AskYesNo(prompt, c1, c2, c3): default "No"
export async function AskYesNo(prompt, c1, c2, c3) {
  menu.sel = 2;
  let r;
  do r = await HorizontalMenu(prompt, 'Yes No', c1, c2, c3, false, false);   // 6800:1174
  while (r.key !== 'Y' && r.key !== 'N');                    // set cs:110A
  return r.key;
}

// 6800:07E5 ClearMenuLine
export function ClearMenuLine() { ClearGlyphRun(0, 24, 0, 40); }   // 6800:07f4

export { ClearTextRectangle, KEY };
