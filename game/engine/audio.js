// audio.js — sound (ENGINE res_08AE, decode/pseudo/ENGINE.pas.md, fixes #verify-1/#verify-2).
// por-only: Pool sound-driver image offsets and PIT driver translation (whole module) (profile: engine.id (decoded adapter); game/profiles/PORONLY.md)
//
// The original drives the PC speaker from a timer interrupt (236.7 Hz = 13x the BIOS tick) that steps four channel records
// (30h bytes each) through command sequences stored in the 08AE code segment. This module runs the same interpreter on a
// copy of that segment (from the unpacked START.EXE, state.js G.image) and turns the speaker state (PIT counter 2 divisor,
// port 61h gate bits) into a Web Audio square wave. Only the PC speaker device (POOL.CFG line 2 'P') is reproduced; the
// Tandy PSG path (PsgChannelTick) is not built (TODO(decode→M?): POOL.CFG here is 'P').

import { G } from './state.js';
import { sleep } from './timer.js';

const SEG = 0x08AE;
let seg = null;                         // Uint8Array: the 08AE segment (CS = DS for these routines)
const w = (o) => seg[o] | (seg[o + 1] << 8);
const sw = (o, v) => { seg[o] = v & 0xFF; seg[o + 1] = (v >> 8) & 0xFF; };
const sx16 = (v) => ((v & 0xFFFF) ^ 0x8000) - 0x8000;

// CS-relative variables (ENGINE.pas.md 08AE header)
const V_TICKDIV = 0x1D7, V_BUSY = 0x1D8, V_LOOP = 0x1D9, V_RECSIZE = 0x1DA, V_SOUND = 0x1FF, V_CUR = 0x201,
  V_CHANBASE = 0x203, V_NOTETAB = 0x205, V_RET = 0x207, V_SNDIDX = 0x209, V_OUTPUT = 0x20D, V_LOUDEST = 0x3C5;
const SPK_CHANNELS = 0x22D, SPK_NOTES = 0x3AD, SPK_TABLE = 0x55F;

export const audio = {
  SoundTransientMode: 0,                // g_5374
  ctx: null, osc: null, gain: null,
  timer: null,                          // installed "sound timer" (setInterval)
  tickAt: 0,
};

function ensureSegment() {
  if (seg) return true;
  if (!G.image) return false;
  seg = G.image.slice(SEG * 16, SEG * 16 + 0x1900);
  return true;
}

// ---- speaker output (port 42h divisor / port 61h gate) ---------------------------------------------------------
function ensureContext() {
  if (audio.ctx) return;
  try {
    audio.ctx = new (window.AudioContext || window.webkitAudioContext)();
    audio.osc = audio.ctx.createOscillator(); audio.osc.type = 'square';
    audio.gain = audio.ctx.createGain(); audio.gain.gain.value = 0;
    audio.osc.connect(audio.gain).connect(audio.ctx.destination); audio.osc.start();
    const resume = () => audio.ctx.resume();
    addEventListener('keydown', resume); addEventListener('pointerdown', resume);
  } catch (e) { audio.ctx = null; }
}
function speaker(gate, divisor) {
  if (!audio.ctx) return;
  const t = audio.ctx.currentTime;
  if ((gate & 3) === 3 && divisor > 0) {          // timer-2 gate (bit 0) and speaker data (bit 1) both on: the PIT tone
    audio.osc.frequency.setValueAtTime(1193182 / divisor, t);
    audio.gain.gain.setValueAtTime(0.06, t);
  } else audio.gain.gain.setValueAtTime(0, t);
}

// ---- the interpreter (08AE:157A / 160B / 16C1) --------------------------------------------------------------------
// 08AE:157A SoundChannelStep(si)
function channelStep(si) {
  sw(si + 0x0A, w(si + 0x0A) + w(si + 0x0C));                              // 08ae:157c volume += volDelta
  sw(si + 0x04, w(si + 0x04) + w(si + 0x06));                              // 08ae:1582 pitch += slide
  let dx = 0;
  let p = (w(si + 0x1E) + w(si + 0x20)) & 0xFFFF;                          // 08ae:158a
  if (p !== 0) {
    if (p >= w(si + 0x24)) p = (p - w(si + 0x24)) & 0xFFFF;                // 08ae:1592
    sw(si + 0x1E, p);
    const di = ((sx16(p) >> 4) + w(si + 0x1C)) & 0xFFFF;                   // 08ae:159d  sar 4
    const prod = sx16(seg[di] << 8) * sx16(w(si + 0x22));                  // 08ae:15aa  IMUL
    dx = (prod >> 16) & 0xFFFF;
  }
  sw(si + 0x08, dx + w(si + 0x04));                                        // 08ae:15ad divisor
  if (w(si + 0x14) !== 0) {                                                // 08ae:15b3 noteOff
    sw(si + 0x14, w(si + 0x14) - 1);
    if (w(si + 0x14) === 0) { sw(si + 0x18, 0x10); sw(si + 0x1A, 1); }     // 08ae:15be release
  }
  sw(si, w(si) - 1);                                                       // 08ae:15c8
  if (w(si) === 0) readSoundCommands(si);                                  // 08ae:15cc
  if (w(si + 0x1A) !== 0) {                                                // 08ae:15cf envelope
    sw(si + 0x1A, w(si + 0x1A) - 1);
    if (w(si + 0x1A) === 0) {
      for (let guard = 0; guard < 256; guard++) {                          // 08ae:15da
        const bx = (w(si + 0x16) + w(si + 0x18)) & 0xFFFF;
        if (w(bx + 2) === 0xFFFF) {                                        // 08ae:15e0 level entry
          sw(si + 0x0A, w(bx));
          if (w(bx) === 0) sw(si + 0x0C, 0);
          sw(si + 0x18, w(si + 0x18) + 4);
        } else {                                                           // 08ae:15f9 ramp
          sw(si + 0x0C, w(bx)); sw(si + 0x1A, w(bx + 2)); sw(si + 0x18, w(si + 0x18) + 4);
          break;
        }
      }
    }
  }
}

// 08AE:164E ResetChannel (fix #verify-2): +04..+0C, +10, +12, +16..+24 cleared; +0Eh tempo and +14h noteOff kept
function resetChannel(si) {
  for (const o of [4, 6, 8, 0xA, 0xC, 0x10, 0x12, 0x16, 0x18, 0x1A, 0x1C, 0x1E, 0x20, 0x22, 0x24]) sw(si + o, 0);
}

// 08AE:160B ReadSoundCommands(si)
function readSoundCommands(si) {
  let p = w(si + 2);
  if (p === 0) return;
  sw(V_CUR, si);                                                           // 08ae:1614
  for (let guard = 0; guard < 10000; guard++) {
    const op = seg[p]; p++;                                                // 08ae:1618
    if (op < 0xFA) { noteList(si, p - 1); return; }                        // 08ae:161b
    switch (op) {
      case 0xFA: resetChannel(si); break;                                  // 08ae:164e
      case 0xFB: p = w(V_RET); break;                                      // 08ae:16ac
      case 0xFC: sw(V_RET, p + 2); p = w(p); break;                        // 08ae:16b3
      case 0xFD: si = (w(V_CHANBASE) + w(p)) & 0xFFFF; p += 2; resetChannel(si); break;   // 08ae:1645 quirk: si stays
      case 0xFE: {                                                         // 08ae:162e loop
        const f = seg[p], target = w(p + 1); p += 3;
        if (w(si + f) !== 0) { sw(si + f, w(si + f) - 1); if (w(si + f) === 0) break; }
        p = target; break;
      }
      case 0xFF: {                                                         // 08ae:167f set field
        const f = seg[p]; sw(si + f, w(p + 1)); p += 3;
        if (f === 0) { finishStep(p); return; }
        break;
      }
    }
  }
}
function finishStep(p) {                                                   // 08ae:168f
  const ch = w(V_CUR);
  if (w(ch) === 0) { seg[V_SNDIDX + 4 - seg[V_LOOP]] = 0; p = 0; }        // 08ae:1693
  sw(ch + 2, p);                                                           // 08ae:16a8
}
// 08AE:16C1 NoteList (fix #verify-1): 3-byte entries {chanByte, note, length}
function noteList(si, di) {
  for (let guard = 0; guard < 256; guard++) {
    const e0 = seg[di], e1 = seg[di + 1], e2 = seg[di + 2];
    const chan = e0 >> 5;                                                  // 08ae:16c5
    const dst = (w(V_CHANBASE) + chan * seg[V_RECSIZE]) & 0xFFFF;
    const tempo = seg[si + 0x0E];                                          // 08ae:16d9  low byte
    sw(si, tempo <= 1 ? e2 : tempo * e2);                                  // 08ae:16e2 / 16e7
    let n = e1 & 0x7F;                                                     // 08ae:16ec
    if (n !== 0x7F && chan === 0) {                                        // 08ae:16f1 quirk: chan > 0 only sets the length
      sw(dst, w(si)); sw(dst + 0x14, w(si));                               // 08ae:16fb
      n = (n + w(dst + 0x12)) & 0xFFFF;                                    // 08ae:1702 transpose
      sw(dst + 0x18, 0); sw(dst + 0x1A, 1);                                // 08ae:1705
      let oct = 0; while (n >= 12) { n -= 12; oct++; }                     // 08ae:170f
      const pitch = w(w(V_NOTETAB) + n * 2) >> oct;                        // 08ae:1726
      sw(dst + 4, pitch); sw(dst + 8, pitch);
    }
    di += 3;                                                               // 08ae:1737 (di was past e0)
    if (e1 & 0x80) break;                                                  // 08ae:1739
  }
  finishStep(di);                                                          // 08ae:173f -> FinishStep with p = di
}

// 08AE:1477 SpeakerChannelTick
function speakerTick() {
  if (w(V_SOUND) === 0) { speaker(0, 0); return; }                         // 08ae:147e
  sw(V_LOUDEST, 0);
  seg[V_LOOP] = 4;
  sw(V_NOTETAB, SPK_NOTES); sw(V_CHANBASE, SPK_CHANNELS);                  // 08ae:148b / 1492
  let si = SPK_CHANNELS;
  do {
    if (w(si) !== 0) {                                                     // 08ae:1499
      channelStep(si);
      if (w(V_LOUDEST) === 0 && w(si + 0x0A) !== 0 && w(si) !== 0) sw(V_LOUDEST, si);   // 08ae:14a1
    }
    si += 0x30; seg[V_LOOP]--;
  } while (seg[V_LOOP] !== 0);
  let gate = seg[V_OUTPUT];                                                // 08ae:14c0
  let div = 0;
  if (gate !== 0 && w(V_LOUDEST) !== 0) { div = w(w(V_LOUDEST) + 8); gate = w(w(V_LOUDEST) + 0x0A) & 3; }   // 08ae:14d4
  else gate = 0;
  speaker(gate, div);                                                      // 08ae:14e3
}

// 08AE:13EA SoundTimerInterrupt (the ISR part that matters: channel ticks when not busy)
function isrTick() {
  if (seg[V_BUSY] === 0) { seg[V_BUSY] = 1; speakerTick(); seg[V_BUSY] = 0; }   // 08ae:1441
}

// 08AE:137C InstallSoundTimer / 08AE:13B1 RemoveSoundTimer
function InstallSoundTimer() {
  if (audio.timer) return;
  audio.tickAt = performance.now();
  audio.timer = setInterval(() => {
    const now = performance.now();
    let n = 0;
    while (audio.tickAt <= now && n++ < 64) { isrTick(); audio.tickAt += 1000 / 236.7; }
  }, 4);
}
function RemoveSoundTimer() {
  if (audio.timer) { clearInterval(audio.timer); audio.timer = null; }
  speaker(0, 0);                                                           // 08ae:13d2 speaker off
}

// 08AE:1742 StartSpeakerChannels(snd)
function StartSpeakerChannels(snd) {
  sw(V_SOUND, snd);                                                        // 08ae:1752
  seg[V_BUSY] = 1;
  for (let k = 0; k <= 3; k++) {                                           // 08ae:1761
    const sq = w(SPK_TABLE + snd * 8 + k * 2);
    if (sq !== 0) {
      const ch = SPK_CHANNELS + k * 0x30;
      seg.fill(0, ch, ch + 0x30);                                          // 08ae:1772
      sw(ch + 2, sq);                                                      // 08ae:177e
      seg[V_SNDIDX + k] = snd & 0xFF;                                      // 08ae:178c
      sw(ch, 1);                                                           // 08ae:1790
    }
  }
  seg[V_BUSY] = 0;                                                         // 08ae:17a0
}
// 08AE:181A SetSoundOutput(on)
function SetSoundOutput(on) { seg[V_OUTPUT] = on & 0xFF; }

// 08AE:00DC PlayOrStopSound(snd)
export async function PlayOrStopSound(snd) {
  if (G.SoundDevice === 2 || !ensureSegment()) return;                     // 08ae:00df
  ensureContext();
  if (audio.SoundTransientMode > 0) InstallSoundTimer();                   // 08ae:00e9
  if (snd === 0) { StartSpeakerChannels(0); SetSoundOutput(0); }           // 08ae:00fc (PSG channels: not built)
  else if (snd === 1) SetSoundOutput(1);                                   // 08ae:0118
  else if (snd === 0xFF) StartSpeakerChannels(0);                          // 08ae:0127
  else if (G.SoundDevice === 1) StartSpeakerChannels(snd - 1);             // 08ae:013e
  if (audio.SoundTransientMode > 0) {                                      // 08ae:0156
    await sleep(100);                                                      // WaitHundredths(10)
    StartSpeakerChannels(0);
    RemoveSoundTimer();                                                    // 08ae:0174
  }
}

// 08AE:017B ResetSound
export function ResetSound() {
  G.g_5373 = G.SoundDevice;                                                // 08ae:017e
  if (G.SoundDevice !== 2 && ensureSegment()) { InstallSoundTimer(); StartSpeakerChannels(0); RemoveSoundTimer(); }
}

// 08AE:01A5 SetSoundTimerMode(mode)
export function SetSoundTimerMode(mode) {
  if (G.SoundDevice === 2 || !ensureSegment()) return;                     // 08ae:01a8
  if (mode > 0) { if (audio.SoundTransientMode === 0) RemoveSoundTimer(); }   // 08ae:01b1
  else InstallSoundTimer();                                                // 08ae:01c5
  audio.SoundTransientMode = mode;                                         // 08ae:01cb
}

// ReadGameKey ^S (0899:0068): mute / unmute
export function toggleSound() {
  if (G.SoundDevice !== 2) { G.g_5373 = G.SoundDevice; PlayOrStopSound(G.g_2612 ?? 0xFF); G.SoundDevice = 2; }   // 0899:006e
  else if (G.g_5373 === 0 || G.g_5373 === 1) { G.SoundDevice = G.g_5373; ResetSound(); }                     // 0899:0094
}
