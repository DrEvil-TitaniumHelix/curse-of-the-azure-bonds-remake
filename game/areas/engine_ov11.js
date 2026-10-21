// engine_ov11.js — ENGINE ov11 (3500): engine start-up and new-game reset.
// Translation of CurseAzureBondsRE decode/pseudo/ENGINE.pas.md ov11 (Pool twin: ov11 InitGameState 5700:002D).
// ECL VM regions (ECL_VM.md §2) are word-indexed: byte offset o of a region = word o/2 (Uint16Array here).

import { G } from '../engine/state.js';
import { state as pic, AllocPicture, LoadPicture, Load8x8Set, lineDirty, spanFirst, spanLast, spanScreenX } from '../engine/pictures.js';
import { LoadTextFont, ClearMenuLine, DrawText } from '../engine/text.js';
import { Randomize } from '../engine/tp.js';
import { fetchFile, BiosPromptLine } from '../engine/dax.js';
import { tiles, LoadCombatIcon } from '../engine/tiles_cab.js';
import { dev } from '../engine/dev.js';
import { view } from './view_ov30.js';

async function optional(path) {
  try { return await import(path); } catch (e) {
    if (!/Failed to fetch|Cannot find|404|error loading|Importing a module script failed/i.test(String(e && e.message))) console.warn(path, e);
    return null;
  }
}

// 3500:0000 ov11_0000 — pre-load overlay units (overlay manager only: nothing to do in the build)
export function ov11_0000() {}

function clearViewTables() {                                     // 3500:0171 .. 01a4 (06D8: 3500:06d8 .. 070e)
  lineDirty.fill(0); spanScreenX.fill(0); spanFirst.fill(0xFFFF); spanLast.fill(0);
}

function clearEclMemory() {                                      // 3500:0318 .. 0364
  G.ecl_Mem4B00.fill(0);
  G.ecl_Mem4B00[0x1CC >> 1] = 1;                                 // 3500:032a  VM word 4BE6 := 1 (3D-area flag)
  G.ecl_Mem4B00[0x1E4 >> 1] = 0;                                 // 3500:0335  VM word 4BF2 := 0
  G.ecl_Mem7C00.fill(0);                                         // 3500:0340
  G.ecl_Mem7A00.fill(0);                                         // 3500:0352
  G.ecl_CodeBuf.fill(0);                                         // 3500:0364
}

// the new-game reset block (ov11_0056 3500:03e1 .. 0559; ov11_06D8 without the marked statements)
function resetBlock(first) {
  G.party_MapX = 7; G.party_MapY = 0x0D; G.party_Dir = first ? 0 : 2;   // 3500:03e1 .. 03fc  (06D8 3500:0798: dir 2)
  G.party_Ahead = 0; G.party_CellAttr = 0;                       //   FillChar(party_MapX, 5, 0)
  G.door_CanBash = 1; G.door_CanPick = 1; G.door_CanKnock = 1;   // 3500:0401  FillChar(door_CanBash, 3, 1)
  view.wallSlotId[1] = 0; view.wallSlotNo[1] = 1;               // 3500:0412 / 0417  g_7214 / g_7216: wall-set slot 1
  for (let i = 2; i <= 3; i++) { view.wallSlotId[i] = 0xFFFF; view.wallSlotNo[i] = 0xFFFF; }   // 3500:041d .. 0439  slots 2, 3 empty
  if (first) { G.opt_Animation = 1; G.opt_Pics = 1; }            // 3500:0451 / 0456  only in ov11_0056
  G.DebugFlag = 0; G.TextOutputActive = 1; G.Resuming = 0; G.RestEncCounter = 0;   // 3500:045b .. 046a
  G.PartyList = null; G.SelectedChar = null;                     // 3500:046f / 0477
  G.ecl_PC = 0x8000; G.GameSpeed = 4;                            // 3500:047f / 0485
  if (first) G.DemoMode = 0;                                     // 3500:048a  only in ov11_0056
  G.DataSet = 1; G.PrevDataSet = 1; G.view_AreaMap = 0; G.g_8C9E = 1;   // 3500:048f .. 049e
  G.ecl_Mem7C00[0x67C >> 1] = 0;                                 // 3500:04a4  VM word 7F3E
  G.menu_Top = 1; G.DuelActive = 0; G.RestActive = 0; G.g_8B5F = 0; G.g_8B60 = 0; G.g_8B61 = 0;   // 3500:04af .. 04c9
  G.view_RedrawPicture = 0; G.PartyDead = 0; G.g_5BE8 = 1; G.enc_SpriteOnScreen = 0; G.NoDiskPrompt = 0;   // 3500:04ce .. 04e2
  G.anim_Name = ''; G.camp_AnimName = 0; G.anim_Id = 0xFF; G.camp_AnimId = 0xFF; G.GameSaved = 0;   // 3500:04e7 .. 04fb
  G.backdrop_Key12 = 0xE8; G.backdrop_Key3 = 0xDB; G.enc_MenuActive = 0; G.combat_Visible = 1; G.bigpic_Id = 0xFF;   // 3500:0500 .. 0514
  G.g_8C76 = 0; G.g_8C77 = 0; G.g_4FC8 = 0;                      // 3500:0519 .. 0523
}
function resetTail(first) {
  G.menu_Sel = 1; G.view_Mode = 4; G.view_PrevMode = 0; G.SoundTimerOn = 1; G.item_HookMode = 0;   // 3500:0528 .. 053c
  if (first) { G.sky_Moon = null; G.sky_Sun = null; G.sky_Strip = null; }   // 3500:0541 .. 0551  only in ov11_0056
  G.g_8B6F = 0;                                                  // 3500:0559
}

// 3500:0056 ov11_0056 — engine start-up (once)
export async function ov11_0056() {
  // 3500:0056 .. 007c  BIOS keyboard flags saved, NumLock forced on: no browser equivalent
  Randomize();                                                   // 3500:0090
  if (dev.seed !== null) (await import('../engine/tp.js')).setRandSeed(dev.seed);   // ?seed=n replaces the Randomize value (test hook)
  G.ecl_Mem4B00 = new Uint16Array(0x400); G.ecl_Mem7C00 = new Uint16Array(0x400);   // 3500:0095 / 00a3
  G.ecl_Mem7A00 = new Uint16Array(0x200);                        // 3500:00b1
  G.ecl_CodeBuf = new Uint8Array(0x1E00);                        // 3500:00bf
  // 3500:00cd .. 00e9  FontPtr (588h), wall_Buf (924h), map_Buf (400h): allocated by their loaders here
  pic.symbolPic = AllocPicture(8, 1, 1, 0); G.scratch_Pic = pic.symbolPic;   // 3500:00f7
  G.g_8C7C = AllocPicture(8, 1, 1, 0); G.g_8C7C.px.fill(15);     // 3500:010f / 0127  FillChar(data, frameSize, FFh) = colour 15
  pic.viewPic = AllocPicture(0xA8, 0x15, 1, 0); G.view_Pic = pic.viewPic;   // 3500:0141
  pic.saveBuf = AllocPicture(0x18, 3, 1, 0); G.PicSaveBuf = pic.saveBuf;   // 3500:0159
  clearViewTables();                                             // 3500:0171 .. 01a4
  // 3500:01c0 .. 02d4  CGA / EGA / Tandy screen line tables: the raster here is linear
  pic.SymbolSets.fill(null);                                     // 3500:02de  FillChar(sym_Block, 14h, 0)
  tiles.set = null; tiles.set2 = null;                           // 3500:02ef  FillChar(tile_Set, 8, 0)
  tiles.set = AllocPicture(0x18, 3, 0x30, 0); G.tile_Set = tiles.set;   // 3500:0300
  clearEclMemory();                                              // 3500:0318 .. 0364
  tiles.icons = [];                                              // 3500:0376  FillChar(icon_Pic, D0h, 0)
  G.PortraitSlots = [null, { id: 0xFF, pic: null }, { id: 0xFF, pic: null }];   // 3500:0387 .. 03a3  head / body
  G.enc_Anim = { count: 0, cur: 0, delay: [0], pic: [null] };    // 3500:03c0  FillChar(enc_Anim, 42h, 0)
  G.bigpic_Pic = null; G.TreasureItems = null;                   // 3500:03d1 / 03d9
  resetBlock(true);                                              // 3500:03e1 .. 0523
  resetTail(true);                                               // 3500:0528 .. 0559
  await LoadTextFont();                                          // 3500:055e
  ClearMenuLine();                                               // 3500:0563
  DrawText(0, 0x18, 0x0A, 0, 'Loading...Please Wait');           // 3500:0568  (S010)
  await Load8x8Set(0xCA, 4);                                     // 3500:0588  8X8D1 record 202
  await Load8x8Set(0xCB, 0);                                     // 3500:0593  record 203
  for (let i = 0; i <= 11; i++) await LoadCombatIcon('COMSPR', i, i + 0x0D);   // 3500:059e / 05a9
  await LoadCombatIcon('COMSPR', 0x19, 0x19);                    // 3500:05d1
  if (G.VideoMode !== 0) {                                       // 3500:05eb  no sky in CGA
    G.sky_Moon = await LoadPicture('sky', 0xFA, 1, 0x0D);        // 3500:05f2
    G.sky_Sun = await LoadPicture('sky', 0xFB, 1, 0x0D);         // 3500:0614
    G.sky_Strip = await LoadPicture('sky', 0xFC, 1, 0x0D);       // 3500:0636
  }
  let items = await fetchFile('ITEMS');                          // 3500:0658  OpenWithPrompt('ITEMS', DiskPrompt[DataSet], NoDiskPrompt, ItemsFile)
  while (!items) { await BiosPromptLine(0x0E, "Couldn't find ITEMS. Check install."); items = await fetchFile('ITEMS'); }   // (OpenWithPrompt 0636:0462)
  G.ItemsFound = 1;
  const n = Math.min(0x810, Math.max(0, items.length - 2));      // 3500:0697 / 06a8  Seek 2, BlockRead 810h
  G.ds.set(items.subarray(2, 2 + n), 0x5CF6);                    //   into ItemTypeTable g_5CF6 (DS)
  G.ItemTypeTable = G.ds.subarray(0x5CF6, 0x5CF6 + 0x810);
  G.ItemsReadCount = n;                                          //   g_6592
  // 3500:06ca InitSpellTable (MAGIC) / 3500:06cf InstallEffectHandlers (PARTY): cab-build-areas units, bound when present
  const magic = await optional('./magic_ov22.js');
  if (magic && magic.InitSpellTable) await magic.InitSpellTable();
  const party = await optional('./party_ov12.js');
  if (party && party.InstallEffectHandlers) await party.InstallEffectHandlers();
}

// 3500:06D8 ov11_06D8 — new-game reset (after every game session or demo)
export async function ov11_06D8() {
  clearViewTables();                                             // 3500:06d8 .. 070e
  clearEclMemory();
  resetBlock(false);                                             // party_Dir := 2 (3500:0798)
  ClearMenuLine();                                               // 3500:08b5  (ov26 e4) before menu_Sel := 1
  resetTail(false);
}
