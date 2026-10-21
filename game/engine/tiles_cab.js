// tiles_cab.js — Curse ov33 (7200) 24x24 tile sets and combat icons (engine.id 'cab-1.0' adapter; BUILD_PLAN §2 pictures row).
// Translation of CurseAzureBondsRE decode/pseudo/VIEW.pas.md ov33 (Pool ov32 C000). Lives in the engine because the
// start-up (ov11_0056: COMSPR icons) and the rune wheel (ov03: TILES) need it before the VIEW units (agreed in STATUS.md,
// engine done #M1). tile_Set g_65CE (48 frames of 24x24, allocated by ov11_0056), tile_Set2 g_65D2, icon_Pic g_65D6
// (two pictures per slot: +0 pose 0, +4 pose 1).

import { state as pic, LoadPicture, AllocPicture, FreePicture, DrawPictureInto, DrawPicture, MirrorPicture, RecolorPicture } from './pictures.js';
import { FlushGameKeys, TerminateGame } from './input.js';
import { G } from './state.js';

export const tiles = {
  set: null,        // tile_Set g_65CE
  set2: null,       // tile_Set2 g_65D2
  icons: [],        // icon_Pic g_65D6: icons[slot] = [pose0, pose1]
};

// 7200:002E Load24x24Set(name, id, start, count): record `id` of name.dax -> tile_Set frames start .. start+count-1
export async function Load24x24Set(name, id, start, count) {
  if (start > 0x30) {                                                     // 7200:0035
    pic.display.setTextMode(); pic.display.writeLn('Start range error in Load24x24Set');   // 7200:0040 .. 0060
    await TerminateGame();                                                // 7200:006b
  }
  const tmp = await LoadPicture(name, id, 0, 0);                          // 7200:007a
  if (tiles.set && tmp) {                                                 // 7200:00b7
    const fpx = 24 * 24;
    tiles.set.px.set(tmp.px.subarray(0, Math.min(tmp.px.length, count * fpx)), start * fpx);   // 7200:00c0  Move count * frameSize
  }
  FreePicture(tmp);                                                       // 7200:00e3
  await FlushGameKeys();                                                  // 7200:00ee
}

// 7200:00F9 DrawTile24(col, row, tile, flags): tile < 80h from tile_Set, else frame tile and 7Fh of tile_Set2, into the view
export function DrawTile24(col, row, tile, flags) {
  if (tile < 0x80) DrawPictureInto(col, row, tile, flags, tiles.set, pic.viewPic);        // 7200:014f
  else if (tiles.set2) DrawPictureInto(col, row, tile & 0x7F, flags, tiles.set2, pic.viewPic);   // 7200:0126
}

// 7200:015A FreeCombatIcon(slot)
export function FreeCombatIcon(slot) {
  if (tiles.icons[slot]) tiles.icons[slot] = [null, null];                // 7200:0186 / 01b1
}

const identity = () => Array.from({ length: 16 }, (_, i) => i);
// 7200:01D4 LoadCombatIcon(name, id, slot)
export async function LoadCombatIcon(name, id, slot) {
  const icon = tiles.icons[slot] = tiles.icons[slot] || [null, null];
  const up = name.toUpperCase();
  if (up.slice(0, 5) === 'CHEAD' || up.slice(0, 5) === 'CBODY') {        // 7200:01db .. 022d
    if (up[up.length - 1] === 'T') id = (id + 0x40) & 0xFF;               // 7200:023c
    const n = name.slice(0, name.length - 1);                             // 7200:0256
    icon[0] = await LoadPicture(n, id, 1, 0);                             // 7200:02a3
    icon[1] = await LoadPicture(n, (id + 0x80) & 0xFF, 1, 0);             // 7200:02df
  } else if (up === 'COMSPR' || up === 'ICON') {                          // 7200:0307 / 0319
    icon[0] = await LoadPicture(name, id, 1, 0);                          // 7200:034f
    icon[1] = await LoadPicture(name, (id + 0x80) & 0xFF, 1, 0);          // 7200:038b
    if (up === 'ICON') {                                                  // 7200:03b0  g_0B1E -> g_0B3E: 13 -> 0
      const from = Array.from(G.ds.subarray(0x0B1E, 0x0B2E)), to = Array.from(G.ds.subarray(0x0B3E, 0x0B4E));
      RecolorPicture(from, to, 0, 0, icon[0]); RecolorPicture(from, to, 0, 0, icon[1]);   // 7200:03c2 / 03ea
    }
  } else {                                                                // monster icons: name + data set
    icon[0] = await LoadPicture(name + G.DataSet, id, 1, 0);              // 7200:044c
    RecolorPicture(identity(), identity(), 0, 0, icon[0]);                // 7200:046c  g_0B1E -> g_0B2E (identity: a no-op)
    icon[1] = await LoadPicture(name + G.DataSet, (id + 0x80) & 0xFF, 1, 0);   // 7200:04b0
    RecolorPicture(identity(), identity(), 0, 0, icon[1]);                // 7200:04d5
  }
  await FlushGameKeys();                                                  // 7200:04fd
}

// 7200:0508 DrawIconAt(col, row, dir, pose, slot): icon facing dir (>= 4 mirrored) at combat cell (col, row) of the view
export function DrawIconAt(col, row, dir, pose, slot) {
  const icon = (tiles.icons[slot] || [])[pose];
  if (!icon) return;
  const tmp = AllocPicture(icon.height, icon.width8, 1, 1);               // 7200:056d
  if (dir < 4) { tmp.px.set(icon.px.subarray(0, tmp.px.length)); if (icon.mask) tmp.mask.set(icon.mask.subarray(0, tmp.mask.length)); }   // 7200:05be / 05dc
  else MirrorPicture(icon, tmp);                                          // 7200:059e
  DrawPicture(col * 3, row * 3, 0, 1, tmp, pic.viewPic);                  // 7200:0609
  FreePicture(tmp);                                                       // 7200:0613
}
