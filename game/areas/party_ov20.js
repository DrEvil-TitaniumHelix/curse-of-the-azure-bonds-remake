// game/areas/party_ov20.js — PARTY ov20 (5400): game clock, rest clock, resting (healing, memorising, scribing,
// rest encounters). Pool twin: Pool ov20 (8400).
// Owner: cab-build-areas. Source: decode/pseudo/PARTY.pas.md ov20 (verified, PARTY_VERIFY.md); RestMenu re-read from
// decode/listings/ov20.lst (5400:0712..0847, caution rule 2): HorizontalMenu('', 'Rest Days Hours Mins Add Subtract Exit',
// 0Dh, 0Ah, 0Fh, allowExt 1, animate 0, var ext); extended keys: 'H' (Up) -> 'A', 'P' (Down) -> 'S', 'K' (Left) / 'M'
// (Right) move the selected field and become 'X', every other extended key 'X'; Enter -> 'R'; loop until #0 / 'E' / 'R'.
// 'A' on minutes adds 5 to RestClock[1] (DS:7568), else Inc(RestClock[sel]) (DS:7566 + 2*sel).
// Globals (DS): game clock = VM words 4BC6..4BCC (view.mem); RestClock DS:7566 (7 words) = G.RestClock[0..6];
// EffectsPending DS:4AFC ([i] at 4AFB+i, 72 bytes) = G.EffectsPending[1..72]; StudyTimer DS:7574 ([i] at 7573+i) =
// G.StudyTimer[1..]; HealCounter DS:757C, RestActive DS:757E, RestEncCounter DS:4FC3; ClockLimits DS:3E2A (words, image).
// Record fields: rest_need +72h, mem_spell[k] +1Eh+k (k 0..83), known_spell[s] +78h+s, age +76h (word), items list,
// effects list (9-byte records: +0 type, +1 duration word); spells_Table level = DS:37DB + 16*id (image).

import { G, rdW, wrW } from '../engine/state.js';
import { DrawText, ClearTextRectangle, MessageDelay } from '../engine/text.js';
import { KeyPressed } from '../engine/input.js';
import { HorizontalMenu, AskYesNo, ClearMenuLine } from './view_ov26.js';
import { view } from './view_ov30.js';
import { X } from './view_link.js';

const w16 = (v) => v & 0xFFFF;
const clockLimit = (i) => (G.ds ? rdW(G.ds, 0x3E2A + 2 * i) : 0xFFFF);   // ClockLimits DS:3E2A (no DS image: never carries)
const spellLevel = (id) => (G.ds ? G.ds[0x37DB + 16 * (id & 0xFF)] : 0);   // spells_Table[id].level
const rc = () => { if (!Array.isArray(G.RestClock)) G.RestClock = [0, 0, 0, 0, 0, 0, 0]; return G.RestClock; };
const pending = () => { if (!Array.isArray(G.EffectsPending)) G.EffectsPending = new Array(0x49).fill(0); return G.EffectsPending; };
const study = () => { if (!Array.isArray(G.StudyTimer)) G.StudyTimer = new Array(0x10).fill(0); return G.StudyTimer; };
const dur = (e) => rdW(e.b, 1);

// 5400:0020 TickEffects(count, unit)
export async function TickEffects(count, unit) {
  const P = pending();
  if (G.view_Mode === 2) {                                               // 5400:0026 camp
    let any = false, i = 1;                                              // 5400:0040 / 0044
    do { if (P[i] !== 0) any = true; i++; }                              // 5400:0048 / 005a
    while (!(any || i > view.mem(0x7F3E)));                              // 5400:005d party size, VM 7F3E
    if (!any) return;                                                    // 5400:0073
  } else P.fill(1, 1, 0x49);                                             // 5400:002d FillChar(EffectsPending, 48h, 1)
  let minutes = count & 0xFF, u = unit & 0xFF;                           // 5400:007c / 0084
  while (u > 1) { minutes = w16(clockLimit(u - 1) * minutes); u--; }     // 5400:008a / 0090 / 00a4
  while (minutes > 0) {                                                  // 5400:00ae
    const chunk = minutes > 10 ? 10 : minutes;                           // 5400:00b7
    let i = 1, c = G.PartyList;                                          // 5400:00c9 / 00cd
    while (c) {                                                          // 5400:00d9
      if (P[i] !== 0) {                                                  // 5400:00e4
        P[i] = 0;                                                        // 5400:00f5
        let e = c.effects, last = c.effects, prev = c.effects;           // 5400:0101 / 0111 / 0121
        if (c.effects) while (last.next) last = last.next;               // 5400:0131 / 0140 / 014d
        let done = false;                                                // 5400:015e
        while (e && !done) {                                             // 5400:0162 / 016d
          if (e === last) done = true;                                   // 5400:0176 / 0185
          if (dur(e) === 0) e = e.next;                                  // 5400:0189 / 0193
          else if (chunk < dur(e)) {                                     // 5400:01a5
            wrW(e.b, 1, dur(e) - chunk); P[i] = 1; e = e.next;           // 5400:01b3 / 01bf / 01cb
          } else {
            await X.RemoveEffect(c, e.b[0], e);                          // 5400:01dc
            if (prev === c.effects) e = c.effects; else e = prev.next;   // 5400:01f4 / 020a / 021c
          }
          prev = c.effects;                                              // 5400:022b
          while (prev && prev !== e && prev.next !== e) prev = prev.next;   // 5400:023b .. 0265
        }
        while (e) {                                                      // 5400:0279
          if (dur(e) > 0) P[i] = 1;                                      // 5400:0281 / 028b
          e = e.next;                                                    // 5400:0297
        }
      }
      i++; c = c.next;                                                   // 5400:02a8 / 02ab
    }
    if (minutes > 10) minutes -= 10; else minutes = 0;                   // 5400:02be .. 02ca
  }
}

// 5400:02D8 CarryClock(var clk): clk is an array of 7 words
export function CarryClock(clk) {
  for (let i = 0; i <= 6; i++)                                           // 5400:02de
    if (clk[i] >= clockLimit(i)) {                                       // 5400:02e7 / 0301
      if (i === 6) {                                                     // 5400:0305
        for (let c = G.PartyList; c; c = c.next) wrW(c.b, 0x76, rdW(c.b, 0x76) + 1);   // 5400:0349 .. 0364 age
      } else {
        clk[i + 1] = w16(clk[i + 1] + 1);                                // 5400:030b
        clk[i] = w16(clk[i] - clockLimit(i));                            // 5400:031b
      }
    }
}

// 5400:0385 NormalizeRestClock
export function NormalizeRestClock() {
  const R = rc();
  CarryClock(R);                                                         // 5400:0388
  if (R[5] > 0) {                                                        // 5400:0391
    R[4] = w16(R[4] + clockLimit(4) * R[5]);                             // 5400:0398
    R[5] = 0;                                                            // 5400:03a3
    if (R[4] > 99) R[4] = 99;                                            // 5400:03a8 / 03af
  }
}

// 5400:03B9 AdvanceClock(count, unit)
export async function AdvanceClock(count, unit) {
  const clk = [];
  for (let i = 0; i <= 6; i++) clk[i] = view.mem(0x4BC6 + i) & 0xFFFF;   // 5400:03bf / 03c8
  for (let k = 1; k <= (count & 0xFF); k++) { clk[unit] = w16(clk[unit] + 1); CarryClock(clk); }   // 5400:03ed / 0402 / 040d
  for (let i = 0; i <= 6; i++) view.setMem(0x4BC6 + i, clk[i]);          // 5400:041e / 0427
  await TickEffects(count, unit);                                        // 5400:044c
}

// 5400:045E DecRestClock(amount, unit)
export function DecRestClock(amount, unit) {
  const R = rc();
  if (R[4] === 0 && R[3] === 0 && R[2] === 0 && R[1] === 0) return;      // 5400:0464 .. 0480
  while (amount > R[unit]) {                                             // 5400:0483
    let k = unit + 1;                                                    // 5400:049b
    while (R[k] === 0 && k < 5) k++;                                     // 5400:04a3 / 04b8
    if (k === 5) { R.fill(0); amount = 0; }                              // 5400:04c2 / 04c8 / 04d9 FillChar(RestClock, 0Eh, 0)
    else if (k >= unit + 1)                                              // 5400:04df
      for (let j = k; j >= unit + 1; j--) {                              // 5400:04ef
        R[j] = w16(R[j] - 1);                                            // 5400:04f7
        R[j - 1] = w16(R[j - 1] + clockLimit(j - 1));                    // 5400:0503
      }
  }
  R[unit] = w16(R[unit] - amount);                                       // 5400:052a
  NormalizeRestClock();                                                  // 5400:053e
}

// 5400:0549 TwoDigits(v)
export function TwoDigits(v) {
  v &= 0xFF;
  let s = String(v);                                                     // 5400:0550
  if (v < 10) s = '0' + s;                                               // 5400:056d / 0573
  return s.substring(0, 2);                                              // 5400:059b
}

// 5400:05D4 DrawRestTime(sel)
export function DrawRestTime(sel) {
  const R = rc();
  const colour = [0x0A, 0x0A, 0x0A, 0x0A, 0x0A, 0x0A, 0x0A];             // 5400:05db
  if (sel >= 0 && sel <= 6) colour[sel] = 0x0F;                          // 5400:05f7
  DrawText(1, 0x11, 0x0A, 0, 'Rest Time:');                              // 5400:0604
  let col = 0x0B;                                                        // 5400:0624
  for (let i = 4; i >= 3; i--) {                                         // 5400:0628
    DrawText(col + 1, 0x11, colour[i], 0, TwoDigits(R[i] & 0xFF));       // 5400:0631
    DrawText(col + 3, 0x11, 0x0A, 0, ':');                               // 5400:0666
    col += 3;                                                            // 5400:068d
  }
  DrawText(col + 1, 0x11, colour[2], 0, TwoDigits(10 * R[2] + R[1]));    // 5400:0697
}

// 5400:0712 RestMenu: true = start resting
export async function RestMenu() {
  const R = rc();
  let start = false, sel = 2, key;                                       // 5400:0718 / 071c
  do {
    DrawRestTime(sel);                                                   // 5400:0720
    const m = await HorizontalMenu('', 'Rest Days Hours Mins Add Subtract Exit', 0x0D, 0x0A, 0x0F, true, false);   // 5400:075a
    key = m.key;
    if (m.ext) {                                                         // 5400:0762
      if (key === 'H') key = 'A';                                        // 5400:076f cursor up
      else if (key === 'P') key = 'S';                                   // 5400:0779 cursor down
      else if (key === 'K') { sel++; if (sel > 4) sel = 2; key = 'X'; }  // 5400:0783 .. 0790
      else if (key === 'M') { sel--; if (sel < 2) sel = 4; key = 'X'; }  // 5400:079a .. 07a7
      else key = 'X';                                                    // 5400:07ad
    }
    if (key === '\r') key = 'R';                                         // 5400:07b1
    switch (key) {
      case 'R': start = true; break;                                     // 5400:07c2
      case 'D': sel = 4; break;                                          // 5400:07cc
      case 'H': sel = 3; break;                                          // 5400:07d6
      case 'M': sel = 2; break;                                          // 5400:07e0
      case 'A':                                                          // 5400:07ea
        if (sel === 2) R[1] = w16(R[1] + 5); else R[sel] = w16(R[sel] + 1);   // 5400:07f0 / 07ff
        NormalizeRestClock(); break;                                     // 5400:0804
      case 'S':                                                          // 5400:080d
        if (sel === 2) DecRestClock(5, 1); else DecRestClock(1, sel);    // 5400:081a / 0827
        NormalizeRestClock(); break;                                     // 5400:082b
    }
  } while (!(key === '\0' || key === 'E' || key === 'R'));               // 5400:0837 set cs:06F2
  return start;                                                          // 5400:0841
}

// 5400:0862 DailyHealing(show)
export async function DailyHealing(show) {
  G.HealCounter = w16((G.HealCounter ?? 0) + 1);                         // 5400:0868
  if (G.HealCounter >= 0x120) {                                          // 5400:086c
    let any = false;                                                     // 5400:0877
    for (let c = G.PartyList; c; c = c.next)                             // 5400:087b / 0887
      if (await X.HealCharacter(c, 1, false)) any = true;                // 5400:088f / 08a4
    if (show) DrawRestTime(0);                                           // 5400:08ba / 08c0
    DrawText(1, 0x13, 0x0A, 0, 'The Whole Party Is Healed');             // 5400:08c7
    if (any) await X.PartySummary(G.SelectedChar);                       // 5400:08e7 / 08ed
    await MessageDelay(); await X.ClearCharacterMessage();               // 5400:08fa / 08ff
    G.HealCounter = 0;                                                   // 5400:0904
  }
}

// 5400:091D FinishMemorize(c, var learnt): level of a spell still to memorise (learnt = true), else memorises one
export async function FinishMemorize(c, learnt) {
  let result = 0, k = 0;                                                 // 5400:0923 / 0927
  while (k <= 0x53 && result === 0) {                                    // 5400:092b / 0934
    if (c.b[0x1E + k] > 0x7F) {                                          // 5400:093d
      if (learnt.v) result = spellLevel(c.b[0x1E + k] & 0x7F);           // 5400:094e / 0957
      else {
        c.b[0x1E + k] = (c.b[0x1E + k] - 0x80) & 0xFF;                   // 5400:0978
        DrawRestTime(0);                                                 // 5400:0987
        await X.ShowCasts(c, 'has memorized', c.b[0x1E + k]);            // 5400:098e (MAGIC ov22)
        learnt.v = true;                                                 // 5400:09b7
      }
    }
    k++;                                                                 // 5400:09be
  }
  return result;                                                         // 5400:09c4
}

// 5400:09DF FinishScribe(c, var learnt)
export async function FinishScribe(c, learnt) {
  let result = 0, found = false, item = c.items;                         // 5400:09e5 / 09e9 / 09ed
  while (item && result === 0) {                                         // 5400:09fd / 0a08
    let k = 1;                                                           // 5400:0a11
    if (await X.IsScroll(item))                                          // 5400:0a15 (MAGIC)
      while (k <= 3 && result === 0) {                                   // 5400:0a27 / 0a30
        if (item.b[0x3B + k] > 0x80) {                                   // 5400:0a39 power[k]
          found = true;                                                  // 5400:0a4d (unused)
          if (learnt.v) result = spellLevel(item.b[0x3B + k] & 0x7F);    // 5400:0a51 / 0a5a
          else {
            const s = item.b[0x3B + k] & 0x7F;                           // 5400:0a7b
            c.b[0x78 + s] = 1;                                           // 5400:0a8e known_spell[s]
            await X.UseScrollSpell(c, item, s);                          // 5400:0a9d (MAGIC)
            DrawRestTime(0);                                             // 5400:0ab2
            await X.ShowCasts(c, 'has scribed', s);                      // 5400:0ab9
            learnt.v = true;                                             // 5400:0ad7
          }
        }
        k++;                                                             // 5400:0ade
      }
    item = item.next;                                                    // 5400:0ae4 quirk (as Pool): after UseScrollSpell may have freed it
  }
  void found;
  return result;                                                         // 5400:0af6
}

// 5400:0B05 StudyTick
export async function StudyTick() {
  const T = study();
  let i = 1;                                                             // 5400:0b0b
  for (let c = G.PartyList; c; c = c.next, i++) {                        // 5400:0b0f / 0b1b / 0b9c / 0bac
    if (T[i] > 0) T[i]--;                                                // 5400:0b26 / 0b34
    if (T[i] === 0 && c.b[0x72] === 0) {                                 // 5400:0b3f / 0b4d
      const learnt = { v: false };                                       // 5400:0b57
      let lvl = await FinishScribe(c, learnt);                           // 5400:0b5b
      if (lvl === 0) lvl = await FinishMemorize(c, learnt);              // 5400:0b6d / 0b73
      T[i] = (lvl * 3) & 0xFF;                                           // 5400:0b85
    }
  }
}

// 5400:0BB6 StudyHourTick(var tick)
export async function StudyHourTick(tick) {
  const T = study();
  tick.v = (tick.v + 1) & 0xFF;                                          // 5400:0bbc
  if (tick.v >= 12) {                                                    // 5400:0bc2
    tick.v = 0; let i = 1;                                               // 5400:0bce / 0bd5
    for (let c = G.PartyList; c; c = c.next, i++) {                      // 5400:0bd9 / 0be5 / 0c4d / 0c5d
      const need = (c.b[0x72] ^ 0x80) - 0x80;
      if (need > 0) {                                                    // 5400:0bed signed
        c.b[0x72] = (c.b[0x72] - 1) & 0xFF;                              // 5400:0bf7
        if (c.b[0x72] === 0) {                                           // 5400:0bfe
          const learnt = { v: true };                                    // 5400:0c08
          let lvl = await FinishScribe(c, learnt);                       // 5400:0c0c
          if (lvl === 0) lvl = await FinishMemorize(c, learnt);          // 5400:0c1e / 0c24
          T[i] = (lvl * 3) & 0xFF;                                       // 5400:0c36
        }
      }
    }
  }
}

// 5400:0C9C RestLoop(show): true = the rest was interrupted by an encounter
export async function RestLoop(show) {
  const R = rc(), T = study();
  let interrupted = false;                                               // 5400:0ca2
  let i = 1;                                                             // 5400:0caa
  for (let c = G.PartyList; c; c = c.next) { T[i] = 0; i++; }            // 5400:0cae .. 0cd1
  pending().fill(1, 1, 0x49);                                            // 5400:0ce3 FillChar(EffectsPending, 48h, 1)
  const hourTick = { v: 0 }; let redrawTick = 0;                         // 5400:0cf4 / 0cf8
  if (show) { ClearTextRectangle(1, 0x11, 0x26, 0x16); DrawRestTime(0); }   // 5400:0cfc / 0d02 / 0d13
  G.RestActive = 1;                                                      // 5400:0d1a
  let stop = show ? !(await RestMenu()) : false;                         // 5400:0d1f / 0d26 / 0d38
  while (!stop && (R[4] > 0 || R[3] > 0 || R[2] > 0 || R[1] > 0)) {      // 5400:0d3c .. 0d5a
    if (show && KeyPressed()) {                                          // 5400:0d64 / 0d6a
      DrawRestTime(0);                                                   // 5400:0d73
      if (await AskYesNo('Stop Resting? ', 0x0D, 0x0A, 0x0F) === 'Y') stop = true;   // 5400:0d7a / 0d9b
      else ClearMenuLine();                                              // 5400:0da1
    }
    if (!stop) {                                                         // 5400:0da6
      DecRestClock(5, 1);                                                // 5400:0daf
      redrawTick++;                                                      // 5400:0db9
      if (show && redrawTick >= 5) { DrawRestTime(0); redrawTick = 0; }  // 5400:0dbc / 0dc8 / 0dcf
      await AdvanceClock(5, 1);                                          // 5400:0dd3
      await DailyHealing(show);                                          // 5400:0ddd
      await StudyTick(); await StudyHourTick(hourTick);                  // 5400:0de6 / 0de9
      const steps = view.mem(0x7ED2);                                    // 5400:0df2 VM 7ED2: steps between encounter checks
      if (steps > 0) {
        G.RestEncCounter = w16((G.RestEncCounter ?? 0) + 1);             // 5400:0dfe
        if (G.RestEncCounter >= steps) {                                 // 5400:0e02
          G.RestEncCounter = 0;                                          // 5400:0e10
          if (await X.Roll(1, 100) <= view.mem(0x7ED3)) {                // 5400:0e15 VM 7ED3: chance in %
            await X.ClearCharacterMessage(); DrawRestTime(0);            // 5400:0e2d / 0e32
            DrawText(1, 0x13, 0x0F, 0, 'Your repose is suddenly interrupted!');   // 5400:0e39
            stop = true; interrupted = true;                             // 5400:0e59 / 0e5d
            await MessageDelay();                                        // 5400:0e61
          }
        }
      }
    }
  }
  ClearTextRectangle(1, 0x11, 0x26, 0x16);                               // 5400:0e69 (also when show = false, quirk)
  G.RestActive = 0;                                                      // 5400:0e7a
  return interrupted;                                                    // 5400:0e7f
}

// 5400:0000 ov20_0000 / 5400:0E88 ov20_init: empty.
