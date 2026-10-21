// audio_cab.js — Curse sound driver adapter (engine.id 'cab-1.0'; BUILD_PLAN §2 audio row, PER-6).
// Translation of CurseAzureBondsRE decode/pseudo/RESIDENT.pas.md res_0713 = Pool's 08AE driver relocated (every CS variable
// B7h lower), run on a copy of the 0713 segment of the player's START.EXE (state.js G.image; Curse is not EXEPACK'ed).
// Deltas vs Pool (engine/audio.js): no transient mode (the timer is installed once by StartSound 0713:00D6 and removed only
// by PlayOrStopSound($FF)); SoundDevice 0 = PC speaker, 1 = Tandy PSG, 2 = silent; note lists of 2-byte entries with a
// length table at CS:0157, notes on any channel; noteOff gap field +10h. Only the PC speaker is reproduced (as Pool;
// the Tandy PSG channels are not built: StartPsgChannels is a no-op here, TODO(decode) none — not built by BUILD_PLAN §2).
// Sound id 15 (the "Run-time Error 209" timebomb) has no caller in the shipped game and is not implemented.

import { G } from './state.js';

const SEG = 0x0713;
let seg = null;                         // Uint8Array: the 0713 segment (CS = DS for the driver routines)
const w = (o) => seg[o] | (seg[o + 1] << 8);
const sw = (o, v) => { seg[o] = v & 0xFF; seg[o + 1] = (v >> 8) & 0xFF; };
const sx16 = (v) => ((v & 0xFFFF) ^ 0x8000) - 0x8000;

// CS-relative variables (RESIDENT.pas.md res_0713 header)
const V_BUSY = 0x121, V_LOOP = 0x122, V_RECSIZE = 0x123, V_SOUND = 0x148, V_CUR = 0x14A,
  V_CHANBASE = 0x14C, V_NOTETAB = 0x14E, V_RET = 0x150, V_SNDIDX = 0x152, V_OUTPUT = 0x156, V_LENTAB = 0x157, V_LOUDEST = 0x30E;
const SPK_CHANNELS = 0x176, SPK_NOTES = 0x2F6, SPK_TABLE = 0x4A8;

export const audio = { ctx: null, osc: null, gain: null, timer: null, tickAt: 0 };

function ensureSegment() {
  if (seg) return true;
  if (!G.image) return false;
  seg = G.image.slice(SEG * 16, SEG * 16 + 0x2700);
  return true;
}

// ---- speaker output (port 42h divisor / port 61h gate) ---------------------------------------------------------
function ensureContext() {
  if (audio.ctx || typeof window === 'undefined') return;
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
  if ((gate & 3) === 3 && divisor > 0) {
    audio.osc.frequency.setValueAtTime(1193182 / divisor, t);
    audio.gain.gain.setValueAtTime(0.06, t);
  } else audio.gain.gain.setValueAtTime(0, t);
}

// 0713:23EE SoundChannelStep(si) — Pool 08AE:157A instruction for instruction
function channelStep(si) {
  sw(si + 0x0A, w(si + 0x0A) + w(si + 0x0C));                              // 0713:23f0
  sw(si + 0x04, w(si + 0x04) + w(si + 0x06));                              // 0713:23f6
  let dx = 0;
  let p = (w(si + 0x1E) + w(si + 0x20)) & 0xFFFF;                          // 0713:23fe
  if (p !== 0) {
    if (p >= w(si + 0x24)) p = (p - w(si + 0x24)) & 0xFFFF;                // 0713:2406
    sw(si + 0x1E, p);                                                      // 0713:240e
    const di = ((sx16(p) >> 4) + w(si + 0x1C)) & 0xFFFF;
    const prod = sx16(seg[di] << 8) * sx16(w(si + 0x22));                  // 0713:2411  IMUL high word
    dx = (prod >> 16) & 0xFFFF;
  }
  sw(si + 0x08, dx + w(si + 0x04));                                        // 0713:2421
  if (w(si + 0x14) !== 0) {                                                // 0713:2427
    sw(si + 0x14, w(si + 0x14) - 1);                                       // 0713:242d
    if (w(si + 0x14) === 0) { sw(si + 0x18, 0x10); sw(si + 0x1A, 1); }     // 0713:2432 release
  }
  sw(si, w(si) - 1);                                                       // 0713:243c
  if (w(si) === 0) readSoundCommands(si);                                  // 0713:2440
  if (w(si + 0x1A) !== 0) {                                                // 0713:2443
    sw(si + 0x1A, w(si + 0x1A) - 1);                                       // 0713:2449
    if (w(si + 0x1A) === 0) {
      for (let guard = 0; guard < 256; guard++) {                          // 0713:244e
        const bx = (w(si + 0x16) + w(si + 0x18)) & 0xFFFF;
        if (w(bx + 2) === 0xFFFF) {                                        // 0713:2454
          sw(si + 0x0A, w(bx)); if (w(bx) === 0) sw(si + 0x0C, 0);         // 0713:245a
          sw(si + 0x18, w(si + 0x18) + 4);                                 // 0713:2467
        } else {
          sw(si + 0x0C, w(bx)); sw(si + 0x1A, w(bx + 2)); sw(si + 0x18, w(si + 0x18) + 4);   // 0713:246d / 2478
          break;
        }
      }
    }
  }
}

// 0713:24C2 ResetChannel: +04..+0C, +10, +12, +16..+24 cleared (as Pool 08AE:164E)
function resetChannel(si) {
  for (const o of [4, 6, 8, 0xA, 0xC, 0x10, 0x12, 0x16, 0x18, 0x1A, 0x1C, 0x1E, 0x20, 0x22, 0x24]) sw(si + o, 0);
}

// 0713:247F ReadSoundCommands(si)
function readSoundCommands(si) {
  let p = w(si + 2);
  if (p === 0) return;                                                     // 0713:247f
  sw(V_CUR, si);                                                           // 0713:2488
  for (let guard = 0; guard < 10000; guard++) {
    const op = seg[p]; p++;                                                // 0713:248c
    if (op < 0xFA) { noteList(si, p - 1); return; }                        // 0713:248f -> 2538
    switch (op) {                                                          // 0713:249e  jump table CS:016A
      case 0xFA: resetChannel(si); break;                                  // 0713:24c2
      case 0xFB: p = w(V_RET); break;                                      // 0713:2520
      case 0xFC: sw(V_RET, p + 2); p = w(p); break;                        // 0713:2527
      case 0xFD: si = (w(V_CHANBASE) + w(p)) & 0xFFFF; p += 2; resetChannel(si); break;   // 0713:24b9  quirk: si stays
      case 0xFE: {                                                         // 0713:24a2  loop on field f
        const f = seg[p], target = w(p + 1); p += 3;
        if (w(si + f) !== 0) { sw(si + f, w(si + f) - 1); if (w(si + f) === 0) break; }
        p = target; break;
      }
      case 0xFF: {                                                         // 0713:24f3  set field f
        const f = seg[p]; sw(si + f, w(p + 1)); p += 3;
        if (f === 0) { finishStep(p); return; }
        break;
      }
    }
  }
}
function finishStep(p) {                                                   // 0713:2503
  const ch = w(V_CUR);
  if (w(ch) === 0) { seg[V_SNDIDX + 4 - seg[V_LOOP]] = 0; p = 0; }        // 0713:2507 / 250c
  sw(ch + 2, p);                                                           // 0713:251c
}
// 0713:2535 NoteList: 2-byte entries {e0 = channel (bits 7..5) + length index (bits 4..0), e1 = note (bit 7 = last, 7Fh = rest)}
function noteList(si, di) {
  for (let guard = 0; guard < 256; guard++) {
    const e0 = seg[di], e1 = seg[di + 1];
    const dst = (w(V_CHANBASE) + (e0 >> 5) * seg[V_RECSIZE]) & 0xFFFF;    // 0713:2539
    let t = seg[si + 0x0E]; if (t === 0) t = 1;                            // 0713:254c  Lo(tempo)
    sw(si, t * seg[V_LENTAB + (e0 & 0x1F)]);                               // 0713:2555  quirk: indexes 19..31 read the jump table
    let n = e1 & 0x7F;                                                     // 0713:255d
    if (n !== 0x7F) {                                                      // 0713:2562
      sw(dst, w(si));                                                      // 0713:2567
      sw(dst + 0x14, w(si) - w(dst + 0x10));                               // 0713:256b  noteOff = duration - gap
      n = (n + w(dst + 0x12)) & 0xFFFF;                                    // 0713:2571  transpose
      sw(dst + 0x18, 0); sw(dst + 0x1A, 1);                                // 0713:2574  attack
      const oct = Math.floor(n / 12); n %= 12;                             // 0713:257e
      const pitch = w(w(V_NOTETAB) + n * 2) >> oct;                        // 0713:2595
      sw(dst + 4, pitch); sw(dst + 8, pitch);
    }
    di += 2;
    if (e1 & 0x80) break;                                                  // 0713:25a3
  }
  finishStep(di);
}

// 0713:22EB SpeakerChannelTick
function speakerTick() {
  if (w(V_SOUND) === 0) { speaker(0, 0); return; }                         // 0713:22eb
  sw(V_LOUDEST, 0);                                                        // 0713:22f4
  seg[V_LOOP] = 4;
  sw(V_NOTETAB, SPK_NOTES); sw(V_CHANBASE, SPK_CHANNELS);                  // 0713:22ff / 2306
  let si = SPK_CHANNELS;
  do {
    if (w(si) !== 0) {                                                     // 0713:230d
      channelStep(si);                                                     // 0713:2312
      if (w(V_LOUDEST) === 0 && w(si + 0x0A) !== 0 && w(si) !== 0) sw(V_LOUDEST, si);   // 0713:2315
    }
    si += 0x30; seg[V_LOOP]--;
  } while (seg[V_LOOP] !== 0);
  let gate = seg[V_OUTPUT], div = 0;                                       // 0713:2334
  if (gate !== 0 && w(V_LOUDEST) !== 0) { div = w(w(V_LOUDEST) + 8); gate = w(w(V_LOUDEST) + 0x0A) & 3; }   // 0713:2338 .. 2351
  else gate = 0;
  speaker(gate, div);                                                      // 0713:2357
}

// 0713:225E SoundTimerInterrupt (the part that matters: channel ticks when not busy; the countdown is never armed)
function isrTick() {
  if (seg[V_BUSY] === 0) { seg[V_BUSY] = 1; speakerTick(); seg[V_BUSY] = 0; }   // 0713:22b5 .. 22c7
}

// 0713:21F0 InstallSoundTimer / 0713:2225 RemoveSoundTimer (236.7 Hz)
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
  speaker(0, 0);                                                           // 0713:2246 speaker off
}

// 0713:25B0 StartSpeakerChannels(snd)
function StartSpeakerChannels(snd) {
  sw(V_SOUND, snd);                                                        // 0713:25bd
  seg[V_BUSY] = 1;                                                         // 0713:25ca
  for (let k = 0; k <= 3; k++) {                                           // 0713:25cf
    const sq = w(SPK_TABLE + snd * 8 + k * 2);                             // 0713:25d7
    if (sq !== 0) {
      const ch = SPK_CHANNELS + k * 0x30;
      seg.fill(0, ch, ch + 0x30);                                          // 0713:25e0
      sw(ch + 2, sq);                                                      // 0713:25ec
      seg[V_SNDIDX + k] = snd & 0xFF;                                      // 0713:25ef
      sw(ch, 1);                                                           // 0713:25fe
    }
  }
  seg[V_BUSY] = 0;                                                         // 0713:260e
}
// 0713:261A StartPsgChannels: the Tandy PSG is not built (BUILD_PLAN §2)
function StartPsgChannels() {}
// 0713:2684 SetSoundOutput(on)
function SetSoundOutput(on) { seg[V_OUTPUT] = on & 0xFF; }

// 0713:0020 PlayOrStopSound(snd): 0 stop, 1 output on, FFh shutdown, 2..14 effect snd-1
export async function PlayOrStopSound(snd) {
  const b = snd & 0xFF;
  if (!(b <= 15 || b === 0xFF)) return;                                    // 0713:0023  set CS:0000 = [0..15, 255]
  if (G.SoundDevice === 2 || !ensureSegment()) return;                     // every case tests SoundDevice <> 2 first
  ensureContext();
  if (snd === 0) { StartPsgChannels(0); StartSpeakerChannels(0); }         // 0713:003e
  else if (snd === 1) SetSoundOutput(1);                                   // 0713:005a
  else if (snd === 0xFF) { StartPsgChannels(0); StartSpeakerChannels(0); RemoveSoundTimer(); G.SoundTimerOn = 0; }   // 0713:0077 / 0085
  else if (snd >= 2 && snd <= 14) {                                        // 0713:0090
    if (G.SoundDevice === 0) StartSpeakerChannels(snd - 1);                // 0713:00a1
    else if (G.SoundDevice === 1) StartPsgChannels(snd - 1);               // 0713:00b3
  }
  // 15: CountdownPtr^ := 5000 (0713:00c2) — no caller pushes it (RESIDENT quirk); not implemented
}

// 0713:00D6 StartSound
export function StartSound() {
  G.SoundDeviceSaved = G.SoundDevice;                                      // 0713:00e6  g_5BEB
  G.SoundTimerOn = 1;                                                      // 0713:00ec  g_5BEC
  if (G.SoundDevice !== 2 && ensureSegment()) {                            // 0713:00f1
    ensureContext();
    InstallSoundTimer();                                                   // 0713:00fa
    StartSpeakerChannels(0); StartPsgChannels(0);                          // 0713:00fe / 0105
  }
}

// ReadGameKey 06EA:013C ^S: mute / unmute
export async function soundKey() {
  if (G.SoundDevice !== 2) {                                               // 06ea:0142
    G.SoundDeviceSaved = G.SoundDevice;                                    // 06ea:0149
    await PlayOrStopSound(0);                                              // 06ea:014f  SndStop
    G.SoundDevice = 2;                                                     // 06ea:0158
  } else if (G.SoundDeviceSaved === 0 || G.SoundDeviceSaved === 1) {       // 06ea:015f  set CS:00DD
    G.SoundDevice = G.SoundDeviceSaved;                                    // 06ea:016f
    await PlayOrStopSound(1);                                              // 06ea:0175  SndOutputOn
  }
}
