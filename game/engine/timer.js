// timer.js — time in the original's units.
//
// TimeInHundredths 0709:0C3F: Dos.GetTime -> h*360000 + m*6000 + s*100 + hund (LongInt, wraps at midnight).
// Crt.Delay 0A40:029C: milliseconds.  MessageDelay 0709:0DBE: Delay(GameSpeed * 225).
// The DOS clock advances in BIOS ticks (18.2 Hz); GetTime's hundredths therefore move in ~5.5 steps (H for DOS,
// reproduced below so that "wait n hundredths" loops end at the same tick granularity).

let speedFactor = 1;          // acceptance runs may set ?fast=1 (delays shortened); 1 = real time
export function setSpeedFactor(f) { speedFactor = f; }

const TICK_MS = 1000 / 18.2065;

// 0709:0C3F TimeInHundredths
export function TimeInHundredths() {
  const now = Date.now();
  const d = new Date(now);
  const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const sinceMidnight = (now - midnight) * speedFactor;               // cab: PER-13 (Pool divided: ?fast=n made the clock n times slower)
  const ticks = Math.floor(sinceMidnight / TICK_MS);           // DOS time = BIOS tick count
  return Math.floor(ticks * TICK_MS / 10) % 8640000;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Crt.Delay 0A40:029C
export async function Delay(ms) {
  if (ms <= 0) { await sleep(0); return; }
  await sleep(ms / speedFactor);
}

// yield to the browser inside busy-wait loops of the original (KeyPressed polls)
export const yieldFrame = () => new Promise((r) => requestAnimationFrame ? requestAnimationFrame(() => r()) : setTimeout(r, 16));
export const yieldShort = () => sleep(5);
