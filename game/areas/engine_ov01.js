// engine_ov01.js — ENGINE ov01 (2100): title pictures and credits (screens S011..S014).
// Translation of CurseAzureBondsRE decode/pseudo/ENGINE.pas.md ov01 (Pool twin: ov01 2500).

import { G } from '../engine/state.js';
import { LoadPicture, PutPicture, FreePicture } from '../engine/pictures.js';
import { DrawText, ClearScreen, FrameWithBars3and8 } from '../engine/text.js';
import { KeyPressed, FlushGameKeys, waitKeyOrTimeout } from '../engine/input.js';
import { TimeInHundredths } from '../engine/timer.js';
import { PlayOrStopSound } from '../engine/audio_cab.js';
import { dev } from '../engine/dev.js';
import { hooks } from '../plus/hooks.js';   // GBP W1 (docs/PLUS_HOOKS.md): emit only

// 2100:0000 WaitSecondsOrKey(secs)
export async function WaitSecondsOrKey(secs) {
  await FlushGameKeys();                                          // 2100:0006
  const target = TimeInHundredths() + ((secs * 100) & 0xFFFF);    // 2100:000b  16-bit MUL
  hooks.emit('anyKeyWait', () => ({ seconds: secs }));
  while (!KeyPressed() && TimeInHundredths() < target) await waitKeyOrTimeout(20);   // 2100:002c / 0035
  hooks.emit('anyKeyWaitEnded', () => ({ seconds: secs }));
  await FlushGameKeys();                                          // 2100:0046  the key is consumed
}

// 2100:01DF ShowCredits (S014)
export function ShowCredits() {
  FrameWithBars3and8();                                           // 2100:01df  01A0:00D3
  DrawText(0x02, 0x01, 0x0A, 0, 'based on the tsr novel "azure bonds"');   // 2100:01ea
  DrawText(0x06, 0x02, 0x0A, 0, 'by:');                           // 2100:020a
  DrawText(0x09, 0x02, 0x0B, 0, 'kate novak');                    // 2100:022a
  DrawText(0x14, 0x02, 0x0A, 0, 'and');                           // 2100:024a
  DrawText(0x18, 0x02, 0x0B, 0, 'jeff grubb');                    // 2100:026a
  DrawText(0x0A, 0x04, 0x0A, 0, 'scenario created by:');          // 2100:028a
  DrawText(0x0B, 0x05, 0x0E, 0, 'tsr, inc.');                     // 2100:02aa
  DrawText(0x15, 0x05, 0x0A, 0, 'and');                           // 2100:02ca
  DrawText(0x19, 0x05, 0x0E, 0, 'ssi');                           // 2100:02ea
  DrawText(0x0E, 0x06, 0x0B, 0, 'jeff grubb');                    // 2100:030a
  DrawText(0x0B, 0x07, 0x0B, 0, 'george mac donald');             // 2100:032a
  DrawText(0x01, 0x09, 0x0A, 0, 'game created by:');              // 2100:034a
  DrawText(0x12, 0x09, 0x0E, 0, 'ssi special projects');          // 2100:036a
  DrawText(0x02, 0x0B, 0x0E, 0, 'project leader:');               // 2100:038a
  DrawText(0x02, 0x0C, 0x0B, 0, 'george mac donald');             // 2100:03aa
  DrawText(0x02, 0x0E, 0x0E, 0, 'programming:');                  // 2100:03ca
  DrawText(0x02, 0x0F, 0x0B, 0, 'scot bayless');                  // 2100:03ea
  DrawText(0x02, 0x10, 0x0B, 0, 'russ brown');                    // 2100:040a
  DrawText(0x02, 0x11, 0x0B, 0, 'michael mancuso');               // 2100:042a
  DrawText(0x02, 0x13, 0x0E, 0, 'development:');                  // 2100:044a
  DrawText(0x02, 0x14, 0x0B, 0, 'david shelley');                 // 2100:046a
  DrawText(0x02, 0x15, 0x0B, 0, 'michael mancuso');               // 2100:048a
  DrawText(0x02, 0x16, 0x0B, 0, 'oran kangas');                   // 2100:04aa
  DrawText(0x16, 0x0B, 0x0E, 0, 'graphic arts:');                 // 2100:04ca
  DrawText(0x16, 0x0C, 0x0B, 0, 'tom wahl');                      // 2100:04ea
  DrawText(0x16, 0x0D, 0x0B, 0, 'fred butts');                    // 2100:050a
  DrawText(0x16, 0x0E, 0x0B, 0, 'susan manley');                  // 2100:052a
  DrawText(0x16, 0x0F, 0x0B, 0, 'mark johnson');                  // 2100:054a
  DrawText(0x16, 0x10, 0x0B, 0, 'cyrus lum');                     // 2100:056a
  DrawText(0x16, 0x12, 0x0E, 0, 'playtesting:');                  // 2100:058a
  DrawText(0x16, 0x13, 0x0B, 0, 'jim jennings');                  // 2100:05aa
  DrawText(0x16, 0x14, 0x0B, 0, 'james kucera');                  // 2100:05ca
  DrawText(0x16, 0x15, 0x0B, 0, 'rick white');                    // 2100:05ea
  DrawText(0x16, 0x16, 0x0B, 0, 'robert daly');                   // 2100:060a
}

// 2100:0634 ShowTitle (S011 .. S014)
export async function ShowTitle() {
  let pic = await LoadPicture('title', 1, 0, 0);                  // 2100:0642
  PutPicture(0, 0, pic);                                          // 2100:0664
  await dev.screen('S011');
  await WaitSecondsOrKey(5);                                      // 2100:0675
  if (!G.cfg_FullIntro) return;                                   // 2100:067d  g_4F98 = 0: title 1 only (picture not freed)
  pic = await LoadPicture('title', 2, 0, 0); PutPicture(0, 0, pic);   // 2100:0687 / 06a9
  pic = FreePicture(pic);                                         // 2100:06ba
  pic = await LoadPicture('title', 3, 0, 0); PutPicture(6, 0x0B, pic);   // 2100:06c4 / 06e6  at cell (6, 11) over title 2
  pic = FreePicture(pic);                                         // 2100:06f9
  await dev.screen('S012');
  await WaitSecondsOrKey(10);                                     // 2100:0703
  pic = await LoadPicture('title', 4, 0, 0);                      // 2100:070b
  await PlayOrStopSound(0x0D);                                    // 2100:072d  g_25C6 = 0Dh: effect 0Ch
  PutPicture(0, 0x0B, pic);                                       // 2100:0736  at cell (0, 11)
  pic = FreePicture(pic);                                         // 2100:0748
  await dev.screen('S013');
  await WaitSecondsOrKey(10);                                     // 2100:0752
  ClearScreen();                                                  // 2100:075a
  ShowCredits();                                                  // 2100:075f
  await dev.screen('S014');
  await WaitSecondsOrKey(10);                                     // 2100:0763
  ClearScreen();                                                  // 2100:076b
}
