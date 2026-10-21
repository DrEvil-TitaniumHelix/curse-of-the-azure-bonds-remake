// engine_ov17.js — ENGINE ov17 (4800): the top menu "Choose a function" (screens S020..S022) and the unit's entry point.
// Translation of CurseAzureBondsRE decode/pseudo/ENGINE.pas.md ov17 PartyCreationMenu 4800:01DD, re-read against
// decode/listings/ov17.lst (Pool twin: Pool ov16 7000:0161). The other ov17 routines live in engine_ov17_create.js
// (CreateCharacter, hit points, training) and engine_ov17_edit.js (Drop, Modify, Add, Remove, icon editor) and are re-exported.
// TopMenu = DS:0551, 12 entries of 2Ah bytes: string[40] + enabled byte at +29h (enabled bytes DS:057A + i*2Ah).

import { G, pstr } from '../engine/state.js';
import { DrawText, DrawScreenFrame, FrameExplore, FrameWithTextBar, ShowBottomPromptAndReadKey } from '../engine/text.js';
import { HorizontalMenu, AskYesNo, ClearMenuLine } from '../engine/menus_cab.js';
import { TerminateGame } from '../engine/input.js';
import { ParamStr } from '../engine/tp.js';
import { dev } from '../engine/dev.js';
import { X } from './view_link.js';
import { CreateCharacter } from './engine_ov17_create.js';
import { DropCharacterForever, ModifyCharacter, AddCharacterMenu, RemovePartyMember } from './engine_ov17_edit.js';
import { TrainCharacter } from './engine_ov17_create.js';

export * from './engine_ov17_create.js';
export * from './engine_ov17_edit.js';

const TOP_MENU = 0x0551, ENTRY = 0x2A, ON = 0x29;
const on = (i) => G.ds[TOP_MENU + i * ENTRY + ON];
const setOn = (i, v) => { G.ds[TOP_MENU + i * ENTRY + ON] = v ? 1 : 0; };
const hall = () => G.ecl_Mem7C00[0x550 >> 1];                     // VM word 7EA8 (training hall)

// 4800:0000 ov17_0000 — pre-load overlay units: nothing to do in the build
export function ov17_0000() {}

async function humanChanger() {                                   // IsHuman(SelectedChar) and (FormerClass(SelectedChar) = 11h)
  return !!(await X.IsHuman(G.SelectedChar)) && (await X.FormerClass(G.SelectedChar)) === 0x11;
}

// 4800:01DD PartyCreationMenu
export async function PartyCreationMenu() {
  const savedMode = G.view_Mode;  G.view_Mode = 0;                // 4800:01e4 / 01ea
  let redraw = true;  G.FreeTraining = 0;                         // 4800:01ef / 01f3
  const turnUsed = { v: false };
  for (;;) {
    if (redraw) {                                                 // 4800:01f8
      DrawScreenFrame();                                          // 4800:0201
      if (G.SelectedChar) {                                       // 4800:0206
        await X.PartySummary(G.SelectedChar);                     // 4800:021a
        setOn(1, 1); setOn(2, 1);                                 // 4800:021f / 0224  Drop, Modify
        if (hall() > 0 || G.FreeTraining) setOn(3, 1);            // 4800:022d .. 023c  Train
        setOn(4, (hall() > 0 || G.FreeTraining) && await humanChanger());   // 4800:0245 .. 027c  Human Change Classes
        setOn(5, 1); setOn(7, 1); setOn(8, 0); setOn(9, 1); setOn(10, 1);   // 4800:027f .. 0293
      } else {
        for (const i of [1, 2, 3, 4, 5, 7, 9, 10]) setOn(i, 0);   // 4800:029a .. 02c2
        setOn(8, 1);                                              // 4800:02b8  Load
      }
      let row = 0;                                                // 4800:02c7
      for (let i = 0; i <= 11; i++) {                             // 4800:02cb
        if (on(i)) {                                              // 4800:02e0
          const t = pstr(G.ds, TOP_MENU + i * ENTRY);
          DrawText(2, row + 12, 0x0F, 0, t.charAt(0));            // 4800:0317  hot letter white
          DrawText(3, row + 12, 0x0A, 0, t.slice(1));             // 4800:0362  Copy(text, 2, Length - 1)
          row++;
        }
      }
      redraw = false;                                             // 4800:0373
    }
    dev.screenSoon(G.SelectedChar ? 'S020-PARTY' : 'S020');
    const r = await HorizontalMenu('Choose a function ', pstr(G.ds, 0x0528), 0x0D, 0, 0, true, false);   // 4800:039f  DS:0528 'C D M T H V A R L S B E J'
    const key = r.key, ext = r.ext;
    ClearMenuLine();                                              // 4800:03a7
    if (ext) {                                                    // 4800:03ac
      if (key === 'G' || key === 'O') {                           // 4800:03be  set CS:0128 (Home / End)
        const was = await humanChanger();                         // 4800:03c8 .. 03f0
        await X.CycleSelectedChar(key);                           // 4800:03f7
        await X.PartySummary(G.SelectedChar);                     // 4800:0404
        redraw = ((await humanChanger()) !== was) && hall() > 0;  // 4800:0409 .. 044a  the menu changes only then
      }
      continue;                                                   // 4800:044d
    }
    if (!(key === 'E' || key === 'S')) G.GameSaved = 0;          // 4800:0459 / 0460  set CS:0148
    switch (key) {                                                // 4800:0465
      case 'C': if (on(0)) await CreateCharacter(); break;                                  // 4800:046c / 0474
      case 'D': if (on(1)) await DropCharacterForever(); break;                             // 4800:047e / 0486
      case 'M': if (on(2)) await ModifyCharacter(); break;                                  // 4800:0490 / 0498
      case 'T': if (on(3)) await TrainCharacter(); break;                                   // 4800:04a2 / 04aa
      case 'H': if (on(4)) await X.ChangeClass(G.SelectedChar); break;                      // 4800:04b4 / 04c3
      case 'V': if (on(5)) await X.ViewMenu(turnUsed); break;                               // 4800:04cf / 04db
      case 'A': if (on(6)) await AddCharacterMenu(); break;                                 // 4800:04e7 / 04ef
      case 'R':
        if (on(7) && G.SelectedChar) {                            // 4800:04f9
          if (G.SelectedChar.b[0xF7] < 0x80) {                    // 4800:050d
            await X.WriteCharacter(G.SelectedChar, '');           // 4800:052c  back to <name>.guy
            await RemovePartyMember(0, 1);                        // 4800:0538
          } else await DropCharacterForever();                    // 4800:053e  an NPC: dropped instead
        }
        break;
      case 'L':
        if (on(8)) {                                              // 4800:0548
          await X.LoadGame();                                     // 4800:054f
          if (G.ecl_Mem4B00[0x3FA >> 1] !== 0) {                  // 4800:0558  VM word 4CFD
            await ShowBottomPromptAndReadKey(0x0E, 0, "You've already defeated Tyranthraxus.");   // 4800:0575
            await TerminateGame();                                // 4800:057a
          }
        }
        break;
      case 'S': if (on(9) && G.PartyList) await X.SaveGame(); break;                        // 4800:0586 / 0596
      case 'B':
        if (on(10) && (G.PartyList || G.DemoMode)) {              // 4800:05a2 .. 05b2
          G.view_Mode = savedMode;                                // 4800:05b9
          if (!G.Resuming && G.anim_Id !== 0x50) {                // 4800:05bf / 05c6
            if (G.view_Mode === 3) FrameWithTextBar(); else FrameExplore();   // 4800:05cd .. 05db
            await X.PartySummary(G.SelectedChar);                 // 4800:05e8
          } else if (G.ecl_Mem4B00[0x1E4 >> 1] === 0) FrameExplore();   // 4800:05f3 / 05fb
          ClearMenuLine();                                        // 4800:0600
          G.ecl_Mem7C00[0x550 >> 1] = 0;                          // 4800:060b  leave the training hall
          return;                                                 // 4800:0610
        }
        break;
      case 'E':
        if (on(11)) {                                             // 4800:061a
          let k = await AskYesNo('Quit to DOS ', 0x0E, 0x0A, 0x0F);   // 4800:0639
          dev.screenSoon('S022');
          if (k === 'Y') {                                        // 4800:0641
            if (G.PartyList && !G.GameSaved) {                    // 4800:0647 / 0650
              k = await AskYesNo('Game not saved.  Quit anyway? ', 0x0E, 0x0A, 0x0F);   // 4800:066f
              if (k === 'N') await X.SaveGame();                  // 4800:0677 / 067d
            }
            if (k === 'Y') await TerminateGame();                 // 4800:0682 / 0688
          }
        }
        break;
      case 'J':
        if (ParamStr(2) === G.CopyProtWord) {                     // 4800:069d / 06a7  'Wooden'
          G.FreeTraining = G.FreeTraining ? 0 : 1;                // 4800:06ae / 06bb
          await X.ShowTimedBottomMessage(G.FreeTraining ? 'Free training on' : 'Free training off');   // 4800:06c5 / 06dc
        }
        break;
    }
    redraw = true;                                                // 4800:06f1
  }
}
