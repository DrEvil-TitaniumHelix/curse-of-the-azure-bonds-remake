// tp.js — Turbo Pascal 6.0 runtime semantics the game depends on (decode/rt/RT_LEDGER.md).
// cab: PER-1 — Curse is linked with the TP 5.x runtime (CurseAzureBondsRE decode/rt/RT_LEDGER.md): @NextRandom 0A54:1154 has
// the same body (RandSeed at DS:47D8/47DA instead of DS:4428/442A, a storage detail only), RandomWord 0A54:1105, Randomize
// 0A54:118C (same DOS clock source); new: RandomReal 0A54:111B = Random without an argument (ov18 only).
//
// Random: System.@NextRandom 0AF8:120F  RandSeed := RandSeed * 134775813 (08088405h) + 1  (RandSeed = DS:4428/442A)
//         System.RandomWord  0AF8:11C0  Random(N) = HiWord(RandSeed) mod N   (N = 0 -> 0)
//         System.Randomize   0AF8:1247  RandSeed := DOS time (INT 21h AH=2Ch: CX:DX)
// Strings: Pascal strings are JS strings here; callers truncate with pstr(s, max) where a string[n] is assigned.

export const tp = {
  randSeed: 0,
};

// 0AF8:120F @NextRandom
function nextRandom() {
  tp.randSeed = (Math.imul(tp.randSeed, 0x08088405) + 1) >>> 0;
}

// 0AF8:11C0 RandomWord: Random(N) for a Word range
export function Random(n) {
  nextRandom();
  n &= 0xFFFF;
  if (n === 0) return 0;
  return (tp.randSeed >>> 16) % n;
}

// 0AF8:1247 Randomize: CX = hours*256 + minutes, DX = seconds*256 + hundredths (DOS GetTime registers);
// RandSeed low word = CX (DS:4428), high word = DX (DS:442A).
export function Randomize() {
  const d = new Date();
  const cx = (d.getHours() << 8) | d.getMinutes();
  const dx = (d.getSeconds() << 8) | Math.floor(d.getMilliseconds() / 10);
  tp.randSeed = ((dx << 16) | cx) >>> 0;
}

// cab: PER-1  0A54:111B RandomReal (Random without an argument): NextRandom, then the 32-bit seed DX:BX becomes the mantissa
// of a 6-byte real with exponent 80h, normalised by left shifts (0A54:1125..1130; seed 0 -> exponent 0 = 0.0). The value is
// exactly RandSeed / 2^32 (unsigned), which a JS double holds without rounding.
export function randomReal() {
  nextRandom();
  return tp.randSeed / 4294967296;
}

// Seedable for acceptance runs (?seed=n): replaces the Randomize value, documented as a test hook.
export function setRandSeed(v) { tp.randSeed = v >>> 0; }

// Byte / Word / ShortInt truncation helpers (TP integer wrap).
export const byte = (v) => v & 0xFF;
export const word = (v) => v & 0xFFFF;
export const shortint = (v) => ((v & 0xFF) ^ 0x80) - 0x80;
export const integer = (v) => ((v & 0xFFFF) ^ 0x8000) - 0x8000;

// string[n] assignment
export const pstr = (s, max = 255) => (s.length > max ? s.slice(0, max) : s);

// System.UpCase (ASCII only, as TP)
export function UpCase(ch) {
  return ch >= 'a' && ch <= 'z' ? String.fromCharCode(ch.charCodeAt(0) - 32) : ch;
}

// Str(n) without width
export const Str = (n) => String(n);

// System.ParamStr 0AF8:16BC — the browser build has one possible parameter: 'STING' (?sting=1, engine request #2)
export const params = { sting: false, second: '' };
// cab: PER-9  Curse reads a second word: START.EXE <x> Wooden skips the copy protection (RESIDENT MainProgram 0000:01e3;
// ?wooden=1 sets it); ParamStr(1) is then a placeholder unless ?sting=1.
export function ParamStr(n) { return n === 1 ? (params.sting ? 'STING' : (params.second ? 'X' : '')) : n === 2 ? params.second : ''; }

// cab: PER-1 (engine request #7)  System.MaxAvail / MemAvail: the browser never runs out of the TP heap; a large constant
// (the Curse heap-error paths, ov00 "Time to save your game", are ERR-PATH in the build)
export const MaxAvail = () => 0x7FFFFFFF;
export const MemAvail = () => 0x7FFFFFFF;
