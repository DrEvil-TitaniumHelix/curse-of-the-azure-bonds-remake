// game/areas/combat_ov18.js — COMBAT ov18 (4E00): the end sequence (ECL PROGRAM 8): the victory story, three PIC
// animations, portrait 41h, BIGPIC 7Ah and the fireworks show (screens COMBAT-18-01..06).
// Owner: cab-build-areas. Source: decode/pseudo/COMBAT.pas.md ov18; Pool twin ov18 7A00 (PlayFinaleAnimation only).
// BUILD_PLAN O-13: the texts are reproduced exactly as the code prints them (string bytes from decode/listings/ov18.lst,
// incl. the double blank in "this  foul place"). Re-read from the listing (the pseudocode summarises these parts):
//  - EndSequence (4e00:10ff..15e7): every line DrawWrappedText(1, 11h, 26h, 16h, 0Ah, 0, clear, s), clear = 1 for the
//    first line of a page; after page 1 there is no ClearMenuLine; page 6 has no prompt (the fireworks follow).
//  - InitFireworks (4e00:00bc..04d9): shell s: r := Random(5) + 5, a := RandomReal * 2Pi, b := RandomReal * 2Pi,
//    shellVX := vx0 + Trunc(cos(b) * (cos(a) * (Random(10) + 24))), shellVY := vy0 + Trunc(cos(b) * (sin(a) *
//    (Random(10) + 24))); particle p: a, b fresh, vx := shellVX + Trunc(cos(b) * (cos(a) * 16)), vy := shellVY +
//    Trunc(cos(b) * (sin(a) * 16)), t[2] := r + Random(7) - 4, t[3] := r + 15 + Random(11) - 6, t[4] := maxT - Random(7)
//    (the pseudocode's "r + Random(7) + 1 / r + Random(11) + 14" is wrong). The 6-byte reals 0x490FCF80DC83 = 2Pi and
//    0x000000000085 = 16. TP Real arithmetic / Cos / Sin run here on JS doubles (TODO(decode): last-bit differences can
//    change a Trunc result).
//  - StepFireworks (4e00:04df): gravity uses the parent's frame counter (frame mod 6 = 0, taken once on entry); the phase
//    test is t[phase] < frame (unsigned) and phase < 5; the first loop runs s outer / p inner, the three drawing loops p
//    outer / s inner; the flash tests buf^[1, 1].phase = 2 (LES DI,[BP+8] at 4e00:076c).
//  - LaunchRocket (4e00:0843): the range test 8 < y < 41h is made on the OLD position before each move.
// Pixels go to the screen as the BIOS calls INT 10h 0Ch / 0Dh do (pic.display.pix, 320x200 colour indices).
// Fireworks state: particle records { x, y, nx, ny, fx, fy, vx, vy, phase, saved, t[1..5] } in G.fw_Buf[s][p];
// fw_Ramp[s][phase] = DS:4ACD + 5s + phase (kept as G.fw_Ramp[s][1..5]).

import { G } from '../engine/state.js';
import * as P from '../engine/pictures.js';
import { DrawWrappedText, ShowBottomPromptAndReadKey } from '../engine/text.js';
import { KeyPressed, ReadKey } from '../engine/input.js';
import { TimeInHundredths, Delay, yieldShort } from '../engine/timer.js';
import { Random, randomReal } from '../engine/tp.js';
import { view } from './view_ov30.js';
import { ClearMenuLine } from './view_ov26.js';
import { emptyAnim, LoadAnimation, FreeAnimation, DrawPictureScreenOrView, LoadPortrait, DrawPortrait, LoadBigPic,
  DrawBigPic } from './view_ov29.js';
import { X } from './view_link.js';

const { state: pic, DrawPicture, FlushViewDirtyLines } = P;
const SetEgaPaletteRegister = P.SetEgaPaletteRegister || ((i, c) => { if (pic.display) pic.display.setPaletteRegister(i, c); });
const SetEgaPaletteRegisterRaw = P.SetEgaPaletteRegisterRaw || SetEgaPaletteRegister;
const TWO_PI = 6.283185307179586;                                        // Real 490F CF80 DC83
const sw = (v) => ((v & 0xFFFF) ^ 0x8000) - 0x8000;
const idiv32 = (v) => sw(Math.trunc(sw(v) / 32));                        // CWD; IDIV 20h

// 4E00:0000 WritePixel(x, y, colour): BIOS INT 10h AH=0Ch, page 0
export function WritePixel(x, y, colour) {
  x = sw(x); y = sw(y);
  const d = pic.display;
  if (!d || x < 0 || x >= 320 || y < 0 || y >= 200) return;             // TODO(decode): BIOS writes outside the screen
  d.pix[y * 320 + x] = colour & 0x0F; d.touch();                         // 4e00:0003 .. 001f
}

// 4E00:0032 ReadPixel(x, y): BIOS INT 10h AH=0Dh -> AL
export function ReadPixel(x, y) {
  x = sw(x); y = sw(y);
  const d = pic.display;
  if (!d || x < 0 || x >= 320 || y < 0 || y >= 200) return 0;
  return d.pix[y * 320 + x];                                             // 4e00:0038 .. 005b
}

// 4E00:006A FlashPalette: register 9 white for one tick
export async function FlashPalette() {
  if (G.VideoMode === 1) {                                               // 4e00:006d
    SetEgaPaletteRegister(9, 15); await Delay(1);                        // 4e00:0074 / 007f
    SetEgaPaletteRegister(9, 9);                                         // 4e00:0088
  } else if (G.VideoMode === 2) {
    SetEgaPaletteRegisterRaw(9, 15); await Delay(1);                     // 4e00:0099 / 00a4
    SetEgaPaletteRegisterRaw(9, 9);                                      // 4e00:00ad
  }
}

const ramp = () => { if (!G.fw_Ramp) G.fw_Ramp = [null, [0, 1, 1, 1, 1, 1], [0, 1, 1, 1, 1, 1], [0, 1, 1, 1, 1, 1]]; return G.fw_Ramp; };
const newParticle = () => ({ x: 0, y: 0, nx: 0, ny: 0, fx: 0, fy: 0, vx: 0, vy: 0, phase: 0, saved: 0, t: [0, 0, 0, 0, 0, 0] });

// 4E00:00BC InitFireworks(x0, y0, vx0, vy0, colours)
export function InitFireworks(x0, y0, vx0, vy0, colours) {
  const c = [0, colours[1] & 0xFF, colours[2] & 0xFF, colours[3] & 0xFF]; // 4e00:00c2 CopyBytes 3
  G.fw_MaxTime = 0;                                                      // 4e00:00d5
  G.fw_Ramp = [null, [0, 1, 1, 1, 1, 1], [0, 1, 1, 1, 1, 1], [0, 1, 1, 1, 1, 1]];   // 4e00:00da FillChar(fw_Ramp, 15, 1)
  const R = ramp();
  for (let s = 1; s <= 3; s++) {                                         // 4e00:00eb
    if (G.VideoMode === 0) {                                             // 4e00:00f4 CGA ramp
      if (c[s] > 1) { R[s][1] = 2; R[s][2] = 3; R[s][3] = 3; R[s][4] = 3; R[s][5] = 2; }
    } else {                                                             // EGA / Tandy
      if (c[s] > 1) R[s][1] = 15;                                        // 4e00:0160
      R[s][2] = 15;
      if (c[s] > 1) R[s][3] = (c[s] + 8) & 0xFF;
      R[s][4] = c[s]; R[s][5] = 1;
    }
    const maxT = (Random(20) + 25) & 0xFF;                               // 4e00:01e8 [BP-15h]
    if (G.fw_MaxTime < maxT) G.fw_MaxTime = maxT;                        // 4e00:01f7 / 01ff
    const r = (Random(5) + 5) & 0xFF;                                    // 4e00:0205 [BP-16h]
    const r15 = (r + 15) & 0xFF;                                         // [BP-18h]
    let a = randomReal() * TWO_PI, b = randomReal() * TWO_PI;            // [BP-0Ch] / [BP-12h]
    const shellVX = sw(vx0 + Math.trunc(Math.cos(b) * (Math.cos(a) * (Random(10) + 24))));   // [BP-1Ah]
    const shellVY = sw(vy0 + Math.trunc(Math.cos(b) * (Math.sin(a) * (Random(10) + 24))));   // [BP-1Ch]
    if (!G.fw_Buf) G.fw_Buf = [];
    G.fw_Buf[s] = G.fw_Buf[s] || [];
    for (let p = 1; p <= 40; p++) {                                      // 4e00:02fa
      const q = G.fw_Buf[s][p] = G.fw_Buf[s][p] || newParticle();
      a = randomReal() * TWO_PI; b = randomReal() * TWO_PI;
      q.x = sw(x0); q.y = sw(y0);                                        // 4e00:0312
      q.fx = sw(q.x << 5); q.fy = sw(q.y << 5);
      q.vx = sw(shellVX + Math.trunc(Math.cos(b) * (Math.cos(a) * 16)));
      q.vy = sw(shellVY + Math.trunc(Math.cos(b) * (Math.sin(a) * 16)));
      q.phase = 1; q.t[1] = 1;
      q.t[2] = (r + Random(7) - 4) & 0xFF;                               // 4e00:0450
      q.t[3] = (r15 + Random(11) - 6) & 0xFF;                            // 4e00:046c
      q.t[4] = (maxT - Random(7)) & 0xFF;                                // 4e00:0488
      q.saved = ReadPixel(q.x, q.y);                                     // 4e00:04af
    }
  }
}

// 4E00:04DF StepFireworks(frame, buf) — nested in RunFireworks (parentFrame = the parent's frame counter)
async function StepFireworks(frame, buf, parentFrame) {
  const grav = parentFrame % 6 === 0;                                    // 4e00:04e8 .. 04f6
  for (let s = 1; s <= 3; s++)
    for (let p = 1; p <= 40; p++) {
      const q = buf[s][p];
      q.fx = sw(q.fx + q.vx); q.fy = sw(q.fy + q.vy);
      q.nx = idiv32(q.fx); q.ny = idiv32(q.fy);
      if (grav) q.vy = sw(q.vy + 1);                                     // 4e00:057e
      if (q.vx > 0) q.vx--; else if (q.vx < 0) q.vx++;                   // 4e00:0582 .. 05a1
      if (q.t[q.phase] < frame && q.phase < 5) q.phase++;                // 4e00:05a6 .. 05ca
    }
  const inRange = (q) => q.y > 8 && q.y < 0x41;
  for (let p = 1; p <= 40; p++) for (let s = 1; s <= 3; s++) { const q = buf[s][p]; if (inRange(q)) WritePixel(q.x, q.y, q.saved); }   // 4e00:062d
  for (let p = 1; p <= 40; p++) for (let s = 1; s <= 3; s++) {
    const q = buf[s][p]; q.x = q.nx; q.y = q.ny;
    if (inRange(q)) q.saved = ReadPixel(q.x, q.y);                       // 4e00:06ba
  }
  const R = ramp();
  for (let p = 1; p <= 40; p++) for (let s = 1; s <= 3; s++) { const q = buf[s][p]; if (inRange(q)) WritePixel(q.x, q.y, R[s][q.phase]); }   // 4e00:072e
  if (buf[1][1].phase === 2) await FlashPalette();                       // 4e00:076c / 0777
  await yieldShort();                                                    // browser: one frame shown
}

// 4E00:0780 RunFireworks(x0, y0, vx0, vy0, colours)
export async function RunFireworks(x0, y0, vx0, vy0, colours) {
  const last = (G.fw_MaxTime + 1) & 0xFF;                                // 4e00:0799 for frame := 1 to fw_MaxTime + 1
  for (let frame = 1; frame <= last; frame++) await StepFireworks(frame, G.fw_Buf, frame);   // 4e00:07be
  for (let p = 1; p <= 40; p++) for (let s = 1; s <= 3; s++) {           // 4e00:07c2
    const q = G.fw_Buf[s][p];
    if (q.y > 8 && q.y < 0x41) WritePixel(q.x, q.y, q.saved);            // 4e00:0818
  }
}

// 4E00:0843 LaunchRocket(var x, var y, var vx, var vy, steps, draw)
export async function LaunchRocket(px, py, pvx, pvy, steps, draw) {
  if (draw) await FlashPalette();                                        // 4e00:0849 / 084f
  let fx = sw(px.v << 5), fy = sw(py.v << 5), saved = 0, nx = 0, ny = 0; // 4e00:0853 / 0861 (saved: TODO(decode) uninitialised)
  const inRange = () => draw && py.v > 8 && py.v < 0x41;
  if (inRange()) saved = ReadPixel(px.v, py.v);                          // 4e00:086f .. 0894
  for (let i = 1; i <= (steps & 0xFFFF); i++) {                          // 4e00:08a0
    fx = sw(fx + pvx.v); fy = sw(fy + pvy.v + 1);                        // 4e00:08ab / 08b3
    nx = idiv32(fx); ny = idiv32(fy);                                    // 4e00:08bf / 08cc
    pvy.v = sw(pvy.v + 1);                                               // 4e00:08d8
    if (inRange()) {                                                     // 4e00:08ea
      WritePixel(px.v, py.v, saved);                                     // 4e00:0902
      saved = ReadPixel(nx, ny);                                         // 4e00:0916
      WritePixel(nx, ny, Random(7) + 8);                                 // 4e00:0932
    }
    await Delay(15);                                                     // 4e00:093a
    px.v = nx; py.v = ny;                                                // 4e00:0943 / 0949
  }
  if (inRange()) WritePixel(px.v, py.v, saved);                          // 4e00:0978
  fx = sw(fx + pvx.v); fy = sw(fy + pvy.v + 1);                          // 4e00:0998 .. one more unseen step
  px.v = idiv32(fx); py.v = idiv32(fy); pvy.v = sw(pvy.v + 1);
}

// 4E00:09DB FireworksShow: until a key is pressed (the key is polled only after a rocket)
export async function FireworksShow() {
  G.fw_Buf = [];                                                         // 4e00:09e1 GetMem($0AC8)
  G.fw_Key = '\0';                                                       // 4e00:09ef
  let spin = 0;
  do {
    if (G.fw_Key === '\0' && Random(10000) === 0) {                      // 4e00:09f4 / 09fe
      const col = [0, 1, 1, 1];                                          // 4e00:0a0f FillChar(fw_Colours, 3, 1)
      G.fw_Shells = Random(2) + 1;                                       // 4e00:0a20
      for (let i = 1; i <= G.fw_Shells; i++) col[i] = Random(5) + 2;     // 4e00:0a51 .. 0a5c
      G.fw_Colours = col;
      const x = { v: 0x41 }, y = { v: 0x41 };                            // 4e00:0a64 / 0a6a
      const vx = { v: Random(20) + 0x23 }, vy = { v: sw(-(Random(5) + 0x32)) };   // 4e00:0a70 / 0a7f
      const vx0 = vx.v, vy0 = vy.v;                                      // 4e00:0a9a / 0aa0
      await LaunchRocket(x, y, vx, vy, 60, false);                       // 4e00:0aa6 find the apex
      InitFireworks(x.v, y.v, vx.v, vy.v, col);                          // 4e00:0ac5
      vx.v = vx0; vy.v = vy0; x.v = 0x41; y.v = 0x41;                    // 4e00:0ade .. 0af0
      await LaunchRocket(x, y, vx, vy, 60, true);                        // 4e00:0af6
      G.fw_X = x.v; G.fw_Y = y.v; G.fw_VX = vx.v; G.fw_VY = vy.v;
      await RunFireworks(x.v, y.v, vx.v, vy.v, col);                     // 4e00:0b15
      if (KeyPressed()) G.fw_Key = await ReadKey();                      // 4e00:0b2e / 0b37
    } else if (++spin % 2000 === 0) await yieldShort();                  // busy loop in the original; let the page live
  } while (G.fw_Key === '\0');                                           // 4e00:0b3f
  G.fw_Buf = null;                                                       // 4e00:0b49 FreeMem
}

// 4E00:0B5F PlayFinaleAnimation(col, row, animId, cycles)
export async function PlayFinaleAnimation(col, row, animId, cycles) {
  let done = 0;                                                          // 4e00:0b65
  let t0 = TimeInHundredths();                                           // 4e00:0b69
  const anim = emptyAnim();                                              // 4e00:0b74 FillChar(anim, $42, 0)
  await LoadAnimation('PIC', animId, 2, anim);                           // 4e00:0b94
  DrawPicture(col - 1, row - 1, 0, 0, anim.pic[1], pic.viewPic);         // 4e00:0ba5
  FlushViewDirtyLines();                                                 // 4e00:0bc8
  if (!(anim.count > 0)) { FreeAnimation(anim); return; }                // TODO(decode): an empty record loops forever in the original
  do {
    DrawPictureScreenOrView(col, row, true, anim.pic[anim.cur]);         // 4e00:0bcd
    const t = TimeInHundredths();                                        // 4e00:0bec
    if (t - t0 > (G.GameSpeed + 3) * (anim.delay[anim.cur] | 0)) {       // 4e00:0bf7 .. 0c14 signed 32-bit
      anim.cur++;                                                        // 4e00:0c2c
      if (anim.cur > anim.count) { anim.cur = 1; done = (done + 1) & 0xFF; }   // 4e00:0c35
      t0 = t;                                                            // 4e00:0c44
    }
    await yieldShort();
  } while (done !== (cycles & 0xFF));                                    // 4e00:0c4f
  FreeAnimation(anim);                                                   // 4e00:0c5a
}

const PAGES = [
  ["Tyranthraxus' spirit coalesces over the slain ", "storm giant. 'You have defeated me. Were it not for ",
    'the Amulet of Lythander, I could possess you and rob ', 'you of your victory. Still I can escape through the pool.'],
  ['As you reach for the Pool of Radiance, he cries ', "out, 'Keep the Gauntlet of Moander away from there, you ",
    "will unleash dangerous energies. Stay back!' As the ", 'gauntlet contacts the pool, it contracts and shatters it.'],
  ["'I am trapped without escape, you have succeeded ", 'where armies have not. Gloat while you may, Tyranthraxus ',
    "is slain this day.' Before your eyes he crumbles into ", 'nothingness.'],
  ['You are certain he is destroyed because your ', 'final bond fades away. The Curse of the Azure Bonds ',
    'has finally been lifted from you! You are free at ', 'last!'],
  ["The Knights of Myth Drannor rush in, '", 'Congratulations, you have destroyed the Flamed One. ',
    'With the power of Elminster, let us take you from ', "this  foul place, to a fine feast.'"],
  ['You are teleported to Shadowdale, where festivities ', 'have already begun. A huge cheer goes up at your arrival. ',
    'Gharri and Nacacia, arm in arm, yell congratulations ', "from the nearby stands. 'You have won!'"],
];
async function page(k) {
  for (let i = 0; i < 4; i++) await DrawWrappedText(1, 0x11, 0x26, 0x16, 0x0A, 0, i === 0 ? 1 : 0, PAGES[k][i]);
}
const prompt = () => ShowBottomPromptAndReadKey(0x0D, 0, 'Press any key to continue.');

// 4E00:10FF EndSequence (ECL PROGRAM 8)
export async function EndSequence() {
  G.view_PrevMode = G.view_Mode; G.view_Mode = 7;                        // 4e00:1105 / 110b
  await page(0);                                                         // 4e00:1110 .. 11af
  await prompt();                                                        // 4e00:11c9
  await page(1);                                                         // 4e00:11ce .. 126d
  await PlayFinaleAnimation(3, 3, 0x4A, 1);                              // 4e00:1281
  await prompt(); ClearMenuLine();                                       // 4e00:1299 / 129e
  await page(2);                                                         // 4e00:12a3 .. 1342
  await PlayFinaleAnimation(3, 3, 0x4B, 1);                              // 4e00:1356
  await prompt(); ClearMenuLine();                                       // 4e00:136e / 1373
  await page(3);                                                         // 4e00:1378 .. 1417
  view.setMem(0x4CFF, 1);                                                // 4e00:141c red tint on
  await PlayFinaleAnimation(3, 3, 0x4D, ((10 - G.GameSpeed) * 2) & 0xFF);   // 4e00:1427 / 1442
  view.setMem(0x4CFF, 0);                                                // 4e00:1445
  await LoadPortrait(0x41, 0x41); DrawPortrait(3, 3, true);              // 4e00:1456 / 1464
  await page(4);                                                         // 4e00:1469 .. 1508
  await prompt(); ClearMenuLine();                                       // 4e00:1522 / 1527
  await LoadBigPic(0x7A); DrawBigPic();                                  // 4e00:152f / 1534
  await page(5);                                                         // 4e00:1539 .. 15d8
  await FireworksShow();                                                 // 4e00:15de
  G.view_Mode = G.view_PrevMode;                                         // 4e00:15e1 / 15e4
  await X.RedrawCurrentMode();                                           // 4e00:15e7
}

// 4E00:15F0 ov18_init: empty.
