// startup.js — RESIDENT main_0000 MainProgram (0000:002F) and res_020F StartupConfiguration (020F:027C).
// Translation of CurseAzureBondsRE decode/pseudo/RESIDENT.pas.md (Pool twin: Pool startup.js / main.js MainProgram 0000:0006).
// Screens S006 (NUMLOCK note), S010 (ov11), S011..S014 (ov01), S015 (Play Demo prompt), S016 (ov03).

import { G } from '../engine/state.js';
import { state as pic } from '../engine/pictures.js';
import { Delay } from '../engine/timer.js';
import { FlushGameKeys, TerminateGame, script } from '../engine/input.js';
import { ParamStr } from '../engine/tp.js';
import { HorizontalMenu, menu } from '../engine/menus_cab.js';
import { StartSound, PlayOrStopSound } from '../engine/audio_cab.js';
import { dev } from '../engine/dev.js';
import { ov11_0000, ov11_0056, ov11_06D8 } from './engine_ov11.js';
import { ShowTitle } from './engine_ov01.js';
import { RuneWheelCheck } from './engine_ov03.js';

async function optional(path) {
  try { return await import(path); } catch (e) {
    if (!/Failed to fetch|Cannot find|404|error loading|Importing a module script failed/i.test(String(e && e.message))) console.warn(path, e);
    return null;
  }
}

// 020F:027C StartupConfiguration (unit init). curse.cfg is not imported (BUILD_PLAN §2 main.js row): the engine supplies the
// four lines a first run with EGA / PC speaker / C:\SAVE\ writes (profile engine.configuration), so the first-run prompts
// S001..S005 and the overlay/memory errors S007..S009 are ERR-PATH rows.
export async function StartupConfiguration(cfgText) {
  G.g_8C9A = 0;                                                  // 020f:0283
  // 020f:0288 .. 02b5  WaitOverlayDisk, OvrInit('GAME.OVR'), FSplit(FExpand('*.exe')): the program directory C:\CURSE\
  G.ProgDir = 'C:\\CURSE\\'; G.DataDir = G.ProgDir;              // 020f:02bb / 02f3  not a floppy
  G.DataDrive = G.DataDir[0];                                    // 020f:0306
  const lines = cfgText.split(/\r?\n/);                          // 020f:030c  curse.cfg exists: no first-run questions
  const d = pic.display;
  d.setTextMode();                                               // 020f:0642  ClrScr (DOS text mode)
  d.writeLn('TANDY 1000 USERS - Make sure NUMLOCK is on.');      // 020f:0647  (S006)
  dev.screenSoon('S006');
  await Delay(2000);                                             // 020f:065e
  const c1 = (lines[0] || '')[0];                                // 020f:0680  line 1: adapter
  if (c1 === 'E') { G.VideoMode = 1; d.setGraphicsMode(); }      // 020f:06b0 / 06bc  SetVideoMode($0D); pages 0
  else throw new Error('curse.cfg: only the EGA adapter is built (BUILD_PLAN §2)');
  // 020f:0736 .. 07e8  MemAvail / OvrSetBuf / OvrResult checks (S007, S008): cannot fail here
  const c2 = (lines[1] || '')[0];                                // 020f:07ef  line 2: sound
  G.SoundDevice = c2 === 'T' ? 1 : c2 === 'P' ? 0 : 2;           // 020f:0801 / 080f / 081a
  G.SavePath = lines[2] || '';                                   // 020f:0832  line 3 -> g_5BF0
  G.cfg_FullIntro = (lines[3] || '')[0] === 'F' ? 1 : 0;         // 020f:085c  line 4 -> g_4F98
}

// 0000:0190 / 02f6 the Play Demo prompt (S015)
async function PlayDemoPrompt(timeout, screenId = 'S015') {
  menu.timeout = timeout; menu.timeoutKey = 'D';                 // 0000:017f / 02e5
  if (dev.demo) script.keys.unshift([0x44, 0x20]);               // ?demo=1: 'D' typed at the prompt (dev route)
  const p = HorizontalMenu('Curse of the Azure Bonds v1.0 ', 'Play Demo', 0x0D, 0x0A, 0x0F, false, false);   // 0000:0190
  dev.screenSoon(screenId);
  const r = await p;
  menu.timeout = 0; menu.timeoutKey = '\0';                      // 0000:01ca / 0330
  G.g_47DE = r.key;
  return r.key;
}

// RuneWheelCheck at start-up unless the demo or START.EXE <x> Wooden; the flag (BUILD_PLAN §2a) bypasses it by default
async function CopyProtection() {
  if (ParamStr(2) !== G.CopyProtWord && !G.DemoMode && dev.wheelMode !== 'bypass') await RuneWheelCheck();   // 0000:01e3 / 034d
}

// 0000:002F MainProgram — the program body (after the unit init chain)
export async function MainProgram(cfgText) {
  G.CopyProtWord = 'Wooden';                                     // 097D:0000  unit init: string[20] := 'Wooden' (DS:24EC)
  await StartupConfiguration(cfgText);                           // 020F:027C  (init chain)
  StartSound();                                                  // 0000:0126
  if (G.SoundTimerOn) await PlayOrStopSound(0xFF);               // 0000:012b  SndShutdown
  ov11_0000();                                                   // 0000:013b
  await ov11_0056();                                             // 0000:0140  (S010)
  await dev.screen('S010');
  if (!G.SoundTimerOn) StartSound();                             // 0000:0145  (skipped: ov11 set the flag, RESIDENT quirk)
  await PlayOrStopSound(0);                                      // 0000:0151  SndStop
  StartSound();                                                  // 0000:015a
  if (ParamStr(1) !== 'STING') await ShowTitle();                // 0000:015f / 017a
  if (await PlayDemoPrompt(3000) === 'D') G.DemoMode = 1;        // 0000:017f .. 01d7  30 s, default 'D'
  await CopyProtection();                                        // 0000:01e3 .. 0205
  for (;;) {                                                     // 0000:020a
    if (G.DemoMode) { G.DataSet = 1; G.GameSpeed = 9; }          // 0000:020a
    else G.DataSet = 2;                                          // 0000:021d
    if (G.SoundTimerOn) await PlayOrStopSound(0xFF);             // 0000:0222
    if (!G.SoundTimerOn) StartSound();                           // 0000:0237  (ov17_0000 pre-load between: nothing to do)
    if (!G.DemoMode) {                                           // 0000:0243
      const ov17 = await optional('./engine_ov17.js');
      if (!ov17) { await dev.screen('S020'); await TerminateGame(); }   // (M3: the top menu is not translated yet)
      await ov17.PartyCreationMenu();
    }
    if (G.SoundTimerOn) await PlayOrStopSound(0xFF);             // 0000:024f
    if (!G.SoundTimerOn) StartSound();                           // 0000:0264  (ov30_LoadDeps between)
    const view = await optional('./view_ov30.js');
    if (view && view.SetBackdropColours) view.SetBackdropColours(G.backdrop_C0, G.backdrop_C1, G.backdrop_C2, G.backdrop_C3);   // 0000:0270
    if (G.SoundTimerOn) await PlayOrStopSound(0xFF);             // 0000:0285
    if (!G.SoundTimerOn) StartSound();                           // 0000:029a  (ov02_LoadDeps between)
    await (await import('./ecl_host.js')).ecl_GameLoop();        // 0000:02a6
    if (G.DemoMode) await dev.screen('DEMO-END');
    if (G.SoundTimerOn) await PlayOrStopSound(0xFF);             // 0000:02ab
    ov11_0000();                                                 // 0000:02bb
    if (!G.SoundTimerOn) StartSound();                           // 0000:02c0
    await ov11_06D8();                                           // 0000:02cc
    if (G.DemoMode) {                                            // 0000:02d1  after a demo run: the title again
      await ShowTitle();                                         // 0000:02db
      await FlushGameKeys();                                     // 0000:02e0
      G.DemoMode = (await PlayDemoPrompt(1000, 'S019')) === 'D' ? 1 : 0; // 0000:02e5 .. 033d  10 s
      await CopyProtection();                                    // 0000:034d
      await PlayOrStopSound(0);                                  // 0000:0374
    }
  }
}
