// text.js — text cells, the game font, prompts (ENGINE res_0709) and frames / rectangles (ENGINE res_03F1).
// cab: PER-2 — Curse fork (game/FORK.md): the Curse twins are RESIDENT res_0542 (text) and res_01A0 (frames)
// (CurseAzureBondsRE decode/pseudo/RESIDENT.pas.md). Every text routine takes an explicit background colour `bg` right
// after the foreground colour (Pool's background was always 0, so Pool callers pass 0); the frames are per-cell symbol
// tables in DS (DrawScreenFrame and the five layouts of 01A0) instead of Pool's DrawFrame/DrawTitledFrame arguments;
// MessageDelay waits GameSpeed * 100 ms (Pool * 225); ReadBottomLine also ends in the demo; DrawWrappedText's
// "Press any key" flushes the keys (FlushGameKeys is live in Curse). Addresses: Curse first, Pool twin in brackets.
//
// Screen = 40x25 cells of 8x8 glyphs from 8X8D1.DAX record C9h (LoadTextFont 0542:0184 [0709:017C], bit 7 = left pixel).
// With textMap the glyph index is UpCase(ch) mod 64, so all text shows in the font's upper-case 64-glyph set.

import { LoadDaxRecord } from './dax.js';
import { state as pic, Put8x8Symbol } from './pictures.js';
import { Delay } from './timer.js';
import { ReadGameKey, FlushGameKeys } from './input.js';
import { UpCase } from './tp.js';
import { clearPointerRegions } from './input.js';
import { G } from './state.js';
import { hooks } from '../plus/hooks.js';   // GBP W1/W3 (docs/PLUS_HOOKS.md)

export const text = {
  font: null,                 // FontPtr g_6594 [g_5E20]
  col: 0, row: 0,             // text_Col g_65A0 / text_Row g_65A1 [g_5E24 / g_5E25]
  // cab: PER-2  TextOutputActive / GameSpeed are the DS globals (state.js G), not copies
  get TextOutputActive() { return G.TextOutputActive ?? 1; }, set TextOutputActive(v) { G.TextOutputActive = v; },
  get GameSpeed() { return G.GameSpeed ?? 1; }, set GameSpeed(v) { G.GameSpeed = v; },
};

// 0542:0184 LoadTextFont [0709:017C]
export async function LoadTextFont() {
  // por-only: font archive and record 201 (profile: engine.font; game/profiles/PORONLY.md)
  const p = await LoadDaxRecord('8X8d1', '.dax', 0xC9);                 // 0542:018a
  if (p) text.font = p;                                                 // 0542:01ba
}

// 0542:01E6 DrawRepeatedGlyph(col, row, fg, bg, count, ch, textMap) [0709:01DF]: font pixels in fg, the others in bg
// (EGA GlyphEga 0542:0DC6: write mode 2, bit mask = font row for fg, its complement for bg).
export function DrawRepeatedGlyph(col, row, fg, bg, count, ch, textMap) {   // cab: PER-2 bg
  if (col > 39 || row > 24 || !text.font) return;                       // 0542:01ec / 01f8
  const g = textMap ? UpCase(ch).charCodeAt(0) % 64 : ch.charCodeAt(0); // 0542:0204 / 0221
  const d = pic.display;
  for (let i = 0; i < count; i++) {                                     // 0542:028f
    if (col <= 39) {                                                    // quirk: cells past col 39 are dropped here (the EGA
      for (let fl = 0; fl < 8; fl++) {                                  //   renderer writes A000:row*320+col, i.e. the next row)
        const bits = text.font[g * 8 + fl] ?? 0;
        const o = (row * 8 + fl) * 320 + col * 8;
        for (let b = 0; b < 8; b++) d.pix[o + b] = (bits & (0x80 >> b)) ? (fg & 15) : (bg & 15);   // 0542:0df2 / 0dff
      }
    }
    col++;                                                              // 0542:02bf
  }
  d.touch();
}

// 0542:0311 ClearGlyphRun(col, row, colour, count) [0709:05EB]: colour as both fg and bg
export function ClearGlyphRun(col, row, colour, count) {
  if (col <= 39 && row <= 24) DrawRepeatedGlyph(col, row, colour, colour, count, ' ', true);   // 0542:032e  cab: PER-2
}

// 0542:0352 DrawText(col, row, fg, bg, s) [0709:0626]
export function DrawText(col, row, fg, bg, s) {                         // cab: PER-2 bg
  if (col > 39 || row > 39) return;                                     // 0542:036d  quirk: row tested against 39
  for (let k = 0; k < s.length; k++) { DrawRepeatedGlyph(col, row, fg, bg, 1, s[k], true); col++; }   // 0542:039d / 03c4
}

// 0542:0B4A ClearTextRectangle / 01A0:04CD ClearRectangle [0709:0DD3 / 03F1:0137] (EGA: both pages; one visible page here)
export function ClearTextRectangle(x1, y1, x2, y2) {
  const d = pic.display;
  for (let y = y1 * 8; y <= y2 * 8 + 7; y++) {
    if (y < 0 || y >= 200) continue;
    for (let x = x1 * 8; x <= x2 * 8 + 7; x++) if (x >= 0 && x < 320) d.pix[y * 320 + x] = 0;
  }
  d.touch();
}
export const ClearRectangle = ClearTextRectangle;                      // 01A0:04CD (same EGA effect: FillEgaTextRectangle colour 0)

// 0542:0A0E ClearScreen [0709:0CAB]
export function ClearScreen() { pic.display.pix.fill(0); pic.display.touch(); clearPointerRegions(['hmenu']); }   // + stale pointer regions (input.js)

// 6800:07E5 ClearMenuLine (VIEW ov26) [9D00:06FB]
export function ClearMenuLine() { ClearGlyphRun(0, 24, 0, 40); }

// 0542:0B33 MessageDelay [0709:0DBE]
export async function MessageDelay() { await Delay(text.GameSpeed * 100); }   // 0542:0b36  cab: PER-2 (Pool * 225)

// 0542:0946 ShowBottomPromptAndReadKey(fg, bg, s) [0709:0BF5]
export async function ShowBottomPromptAndReadKey(fg, bg, s) {           // cab: PER-2 bg
  ClearGlyphRun(0, 24, 0, 40);                                          // 0542:095f
  DrawText(0, 24, fg, bg, s.slice(0, 40));                              // 0542:096f
  await ReadGameKey();                                                  // 0542:0986  the prompt stays on screen
}

// 0542:0AD9 ShowTimedBottomPrompt(s, fg, bg) [0709:0D68]
export async function ShowTimedBottomPrompt(s, fg, bg) {                // cab: PER-2 bg
  ClearGlyphRun(0, 24, 0, 40);                                          // 0542:0af2
  DrawText(0, 24, fg, bg, s.slice(0, 40));                              // 0542:0b02
  await MessageDelay();                                                 // 0542:0b19
  ClearGlyphRun(0, 24, 0, 40);                                          // 0542:0b1d
}

// 0542:04A4 DrawWrappedText(x1, y1, x2, y2, fg, bg, clear, s) [0709:0768]
const PUNCT = new Set(['!', ',', '-', '.', ':', ';', '?']);             // DS:0D16
export async function DrawWrappedText(x1, y1, x2, y2, fg, bg, clear, s) {   // cab: PER-2 bg
  const t = ' ' + s;                                                    // 1-based indexing like the Pascal string
  if (x1 > 39 || y1 > 24 || x2 > 39 || y2 > 39) return;                 // 0542:04bf
  if (text.col < x1 || text.col > x2 || text.row < y1 || text.row > y2) { text.col = x1; text.row = y1; }   // 0542:04da
  if (clear) { ClearTextRectangle(x1, y1, x2, y2); text.col = x1; text.row = y1; }                         // 0542:0506
  let i = 1, j;
  const len = s.length;
  if (len === 0) return;                                                // 0542:0539
  const run = async () => {                                             // 0542:03D7 RenderWrappedRun
    while (i <= j) {
      DrawRepeatedGlyph(text.col, text.row, fg, bg, 1, t[i], true);     // 0542:03ec
      if (text.TextOutputActive) await Delay(text.GameSpeed * 10);      // 0542:0423 typewriter
      i++; text.col++;
    }
  };
  const skipSpaces = () => { while (i < len && t[i] === ' ') i++; };    // 0542:044E
  do {
    j = i;                                                              // 0542:0556
    while (j < len && PUNCT.has(t[j])) j++;                             // 0542:055e
    while (j < len && !PUNCT.has(t[j]) && t[j] !== ' ') j++;            // 0542:0596
    if (t[j] !== ' ') while (j + 1 < len && PUNCT.has(t[j + 1])) j++;   // 0542:05dd
    if ((j - i) + text.col > x2) {                                      // 0542:062e
      if ((j - i) + text.col === x2 && t[j] === ' ') { j--; await run(); }   // dead test (kept)
      text.col = x1; text.row++;                                        // 0542:0691
      skipSpaces();
      if (text.row > y2 && i < len) {                                   // 0542:06a0
        text.col = x1; text.row = y1;
        await ShowBottomPromptAndReadKey(0x0D, 0, 'Press any key to continue');   // 0542:06be
        await FlushGameKeys();                                          // 0542:06d8  cab: PER-2 (Pool: the disabled 0899:0104)
        ClearTextRectangle(x1, y1, x2, y2);                             // 0542:06dd
        await run();                                                    // 0542:06f1  quirk: printed without re-checking its width
      }
    } else await run();                                                 // 0542:06f8
  } while (i <= len);
  if (text.col > x2) { text.col = x1; text.row++; }                     // 0542:070a
}

// 0542:0722 ReadBottomLine(prompt, fg, bg, maxLen): String [0709:09E3]
export async function ReadBottomLine(prompt, fg, bg, maxLen) {          // cab: PER-2 bg
  ClearGlyphRun(0, 24, 0, 40);                                          // 0542:073c
  DrawText(0, 24, fg, bg, prompt);                                      // 0542:074c
  let x = prompt.length, s = '', k;
  hooks.emit('inputStarted', () => ({ kind: 'line', prompt, maxLen, col: prompt.length, row: 24, text: '' }));   // 0542:076e
  do {
    k = await ReadGameKey();                                            // 0542:076e
    if (k >= ' ' && k <= 'z') {                                         // 0542:077b
      if (s.length < maxLen) { s += k; x++; DrawText(x, 24, 0x0F, 0, k); }   // 0542:0783 .. 07c4
    } else if (k === '\b' && s.length > 0) {                            // 0542:07e7
      s = s.slice(0, -1); ClearGlyphRun(x, 24, 0, 1); x--;              // 0542:07f2 .. 082f
    }
    hooks.emit('inputChanged', () => ({ text: s }));                    // 0542:0832
  } while (k !== '\r' && k !== '\x1b' && !G.DemoMode);                  // 0542:0832  quirk: Esc also returns the text; cab: PER-2 demo ends it
  hooks.emit('inputEnded', () => ({ text: s, key: k === '\r' ? 'Enter' : 'Esc' }));   // 0542:084a
  ClearGlyphRun(0, 24, 0, 40);                                          // 0542:084a
  return s.split('').map(UpCase).join('');                              // 0542:085a
}

// 0542:08B3 ReadWordNumber(prompt, fg, bg) [0709:0B66]
export async function ReadWordNumber(prompt, fg, bg) {                  // cab: PER-2 bg
  for (;;) {
    const s = await ReadBottomLine(prompt, fg, bg, 6);                  // 0542:08cd
    if (/^[+-]?\d+$/.test(s.trim()) && s.trim() === s) {                // Val: code = 0 (no blanks allowed)
      const n = parseInt(s, 10);
      if (n >= 0 && n <= 65536) return n & 0xFFFF;                      // 0542:090a  quirk: 65536 -> 0
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// cab: PER-2  res_01A0 frame layouts (RESIDENT.pas.md res_01A0; replaces Pool's DrawFrame / DrawTitledFrame arguments).
// Every frame cell is an 8x8 symbol = table byte + 11Eh (outer frames) or + 114h (picture box), tables = typed constants
// in DS: FrameTop g_0B4E[0..39], FrameBar g_0B76[0..39], FrameBottom g_0B9E[0..39], PicBoxTop g_0BC4[2..14], PicBoxBottom
// g_0BD1[2..14], FrameLeft g_0BE0[0..23], FrameMidCol g_0BF8[0..16], FrameRight g_0C09[0..23], PicBoxLeft g_0C1F[2..14],
// PicBoxRight g_0C2C[2..14], CombatLeft g_0C3B[0..22], CombatMid g_0C52[0..22], CombatRight g_0C69[0..22].
// The g_ address is the instruction displacement (`MOV AL,[DI+0BC4h]` with DI = i, 01a0:01bb), i.e. element i at base + i
// also for the [2..14] arrays (the tables are then contiguous: FrameBottom ends at 0BC6 = PicBoxTop[2]).
const tab = (base) => (i) => G.ds[base + i];
const FrameTop = tab(0x0B4E), FrameBar = tab(0x0B76), FrameBottom = tab(0x0B9E), PicBoxTop = tab(0x0BC4),
  PicBoxBottom = tab(0x0BD1), FrameLeft = tab(0x0BE0), FrameMidCol = tab(0x0BF8), FrameRight = tab(0x0C09),
  PicBoxLeft = tab(0x0C1F), PicBoxRight = tab(0x0C2C), CombatLeft = tab(0x0C3B), CombatMid = tab(0x0C52),
  CombatRight = tab(0x0C69);

// 01A0:0000 DrawScreenFrame
export function DrawScreenFrame() {
  ClearRectangle(1, 1, 0x26, 0x16);                                     // 01a0:0006
  for (let i = 0; i <= 0x27; i++) Put8x8Symbol(i, 0, FrameTop(i) + 0x11E, 0, 0);   // 01a0:0016
  for (let j = 0; j <= 0x17; j++) {                                     // 01a0:0048
    Put8x8Symbol(0, j, FrameLeft(j) + 0x11E, 0, 0);                     // 01a0:0051
    Put8x8Symbol(0x27, j, FrameRight(j) + 0x11E, 0, 0);                 // 01a0:0074
  }
  for (let i = 0; i <= 0x27; i++) Put8x8Symbol(i, 0x17, FrameBottom(i) + 0x11E, 0, 0);   // 01a0:009d
}

// 01A0:00D3 screen frame with bars at rows 3 and 8 (title/credits)
export function FrameWithBars3and8() {
  DrawScreenFrame();                                                    // 01a0:00da
  for (let i = 0; i <= 0x27; i++) {                                     // 01a0:00dd
    Put8x8Symbol(i, 3, FrameBar(i) + 0x11E, 0, 0);                      // 01a0:00e6
    Put8x8Symbol(i, 8, FrameBar(i) + 0x11E, 0, 0);                      // 01a0:0109
  }
}

// 01A0:0136 explore layout: picture box, side column, text window
export function FrameExplore() {
  DrawScreenFrame();                                                    // 01a0:013d
  for (let i = 0; i <= 0x27; i++) Put8x8Symbol(i, 0x10, FrameBar(i) + 0x11E, 0, 0);   // 01a0:0140
  for (let j = 0; j <= 0x10; j++) Put8x8Symbol(0x10, j, FrameMidCol(j) + 0x11E, 0, 0);   // 01a0:0172
  for (let i = 2; i <= 0x0E; i++) {                                     // 01a0:01a4
    Put8x8Symbol(i, 2, PicBoxTop(i) + 0x114, 0, 0);                     // 01a0:01ad
    Put8x8Symbol(i, 0x0E, PicBoxBottom(i) + 0x114, 0, 0);               // 01a0:01d0
  }
  for (let j = 2; j <= 0x0E; j++) {                                     // 01a0:01f9
    Put8x8Symbol(2, j, PicBoxLeft(j) + 0x114, 0, 0);                    // 01a0:0202
    Put8x8Symbol(0x0E, j, PicBoxRight(j) + 0x114, 0, 0);                // 01a0:0225
  }
}

// 01A0:0252 screen frame + text-window bar
export function FrameWithTextBar() {
  DrawScreenFrame();                                                    // 01a0:0259
  for (let i = 0; i <= 0x27; i++) Put8x8Symbol(i, 0x10, FrameBar(i) + 0x11E, 0, 0);   // 01a0:025c
}

// 01A0:0292 upper frame redraw (rows 1..16 cleared, the text window kept)
export function FrameUpperRedraw() {
  ClearRectangle(1, 1, 0x26, 0x10);                                     // 01a0:0298
  for (let i = 0; i <= 0x27; i++) Put8x8Symbol(i, 0, FrameTop(i) + 0x11E, 0, 0);   // 01a0:02a8
  for (let j = 0; j <= 0x17; j++) {                                     // 01a0:02da
    Put8x8Symbol(0, j, FrameLeft(j) + 0x11E, 0, 0);                     // 01a0:02e3
    Put8x8Symbol(0x27, j, FrameRight(j) + 0x11E, 0, 0);                 // 01a0:0306
  }
  for (let i = 0; i <= 0x27; i++) Put8x8Symbol(i, 0x17, FrameBottom(i) + 0x11E, 0, 0);   // 01a0:032f
  for (let i = 0; i <= 0x27; i++) Put8x8Symbol(i, 0x10, FrameBar(i) + 0x11E, 0, 0);      // 01a0:0361
}

// 01A0:0397 combat layout: map window + side panel
export function FrameCombat() {
  ClearRectangle(0, 0, 0x27, 0x17);                                     // 01a0:039d
  for (let i = 0; i <= 0x27; i++) Put8x8Symbol(i, 0, FrameTop(i) + 0x11E, 0, 0);   // 01a0:03ad
  for (let j = 0; j <= 0x16; j++) {                                     // 01a0:03df
    Put8x8Symbol(0, j, CombatLeft(j) + 0x11E, 0, 0);                    // 01a0:03e8
    Put8x8Symbol(0x16, j, CombatMid(j) + 0x11E, 0, 0);                  // 01a0:040b
    Put8x8Symbol(0x27, j, CombatRight(j) + 0x11E, 0, 0);                // 01a0:042e
  }
  for (let i = 0; i <= 0x27; i++) Put8x8Symbol(i, 0x16, FrameBottom(i) + 0x11E, 0, 0);   // 01a0:0457
}

// 01A0:048D screen frame + bar at row 2
export function FrameWithBar2() {
  DrawScreenFrame();                                                    // 01a0:0494
  for (let i = 0; i <= 0x27; i++) Put8x8Symbol(i, 2, FrameBar(i) + 0x11E, 0, 0);   // 01a0:0497
}
