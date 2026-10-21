// engine_ov03.js — ENGINE ov03 (2600): rune translation wheel (copy protection, screens S016..S018).
// Translation of CurseAzureBondsRE decode/pseudo/ENGINE.pas.md ov03 RuneWheelCheck 2600:011A (spec ECL_VM.md §8, RULINGS CR-2).
// The flag (BUILD_PLAN §2a, dev.wheelMode): 'bypass' (default) = the caller skips the check (MainProgram) or returns as if
// answered (ECL op 3C); 'any' (?wheel=1) = the owner's copy (byte 2600:03CE = EB): the screen and one answer, any input
// accepted; 'retail' (?wheel=retail) = the JZ (74) logic: wrong answers retried, the third failure ends the game.

import { G } from '../engine/state.js';
import { FlushViewDirtyLines } from '../engine/pictures.js';
import { DrawText, DrawScreenFrame, ReadBottomLine, ShowTimedBottomPrompt } from '../engine/text.js';
import { Random } from '../engine/tp.js';
import { Delay } from '../engine/timer.js';
import { TerminateGame } from '../engine/input.js';
import { Load24x24Set, DrawTile24 } from '../engine/tiles_cab.js';
import { PlayOrStopSound } from '../engine/audio_cab.js';
import { dev } from '../engine/dev.js';

// six string[36] answer rows at DS:0000 (stride 37)
const answerChar = (row, pos) => String.fromCharCode(G.ds[row * 37 + pos + 1]);

// 2600:011A RuneWheelCheck
export async function RuneWheelCheck(mode = dev.wheelMode) {
  await Load24x24Set('tiles', 1, 0, 0x1A);                       // 2600:0121  espruar runes -> slots 0..25
  await Load24x24Set('tiles', 2, 0x1A, 0x16);                    // 2600:013e  dethek runes -> slots 26..47
  DrawScreenFrame();                                              // 2600:015b
  DrawText(3, 2, 0x0A, 0, 'Align the espruar and dethek runes');  // 2600:0160
  DrawText(3, 3, 0x0A, 0, 'shown below, on translation wheel');   // 2600:0180
  DrawText(3, 4, 0x0A, 0, 'like this:');                          // 2600:01a0
  let attempts = 0, typed, expected;                              // 2600:01c0
  do {
    const e = Random(0x1A), d = Random(0x16);                     // 2600:01c4 / 01d0
    DrawTile24(0x11, 3, e, 0);                                    // 2600:01dc  screen cell (18, 4)
    DrawTile24(0x11, 7, d + 0x1A, 0);                             // 2600:01ee  screen cell (18, 8)
    FlushViewDirtyLines();                                        // 2600:0205
    const path = Random(3);                                       // 2600:020a
    const pathStr = ['-..-..-..', '- - - - -', '.........'][path];   // 2600:0220 / 023a / 0254
    const row = Random(6);                                        // 2600:0267
    DrawText(3, 0x0C, 0x0A, 0, 'Type the character in box number ' + (6 - row));   // 2600:0273 / 0293
    DrawText(3, 0x0D, 0x0A, 0, 'under the ');                     // 2600:02be
    DrawText(0x0E, 0x0D, 0x0F, 0, pathStr);                       // 2600:02de
    DrawText(0x19, 0x0D, 0x0A, 0, 'path.');                       // 2600:02f4
    let pos = e + 34 - d + path * 12 + (5 - row) * 2;             // 2600:0314
    while (pos < 0) pos += 36;                                    // 2600:0348
    while (pos > 35) pos -= 36;                                   // 2600:0354
    expected = answerChar(row, pos);                              // 2600:0360
    dev.screenSoon('S016');
    const answer = await ReadBottomLine('type character and press return: ', 0x0D, 0, 1);   // 2600:038e / 03b1
    typed = answer.length ? answer[0] : ' ';                      // 2600:03bf
    attempts++;                                                   // 2600:03c5
    if (mode !== 'retail') return;                                // 2600:03ce  EB 1C in the owner's copy: return
    if (typed !== expected) {                                     // 2600:03d0  retail path
      dev.screenSoon('S017');
      await ShowTimedBottomPrompt("Sorry, that's incorrect.", 0x0E, 0);
    }
  } while (typed !== expected && attempts <= 2);                  // 2600:03ee / 03f6
  if (attempts >= 3) {                                            // 2600:03ff  quirk: a correct third answer also ends the game
    await PlayOrStopSound(1); await PlayOrStopSound(5);           // 2600:0407 / 0410  output on, g_25B6 = 5
    G.GameSpeed = 9;                                              // 2600:0419
    dev.screenSoon('S018');
    await ShowTimedBottomPrompt('An unseen force hurls you into the abyss!', 0x0E, 0);   // 2600:041e
    await Delay(1000);                                            // 2600:0438
    await TerminateGame();                                        // 2600:0441
  }
}
