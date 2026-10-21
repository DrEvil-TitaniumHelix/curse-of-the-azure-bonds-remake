// game/areas/view_ov33.js — VIEW ov33 (7200): 24x24 tile sets (combat terrain, rune-wheel runes) and combat icons.
// Owner: cab-build-areas. One implementation only: the routines live in engine/tiles_cab.js (cab-build-engine, needed by
// the start-up ov11 and the rune wheel ov03 before the VIEW units); this module re-exports them under the VIEW unit's name.
// Decode: decode/pseudo/VIEW.pas.md ov33, re-read from decode/listings/ov33.lst — Load24x24Set(name, id, start, count)
// 7200:002e (LoadPicture(name, id, 0, 0) without a data-set suffix; the copy uses the loaded picture's frame size for
// the start offset and the length; only tile_Set is tested for nil); DrawTile24(col, row, tile, flags) 7200:00f9 (the 4th
// argument is DrawPictureInto's flags); LoadCombatIcon 7200:01d4 (CHEAD/CBODY 'T' suffix +40h, ICON 13 -> 0, monster
// icons identity recolour); DrawIconAt 7200:0508 (mirrored for dir >= 4).
// State: tiles.set = tile_Set g_65CE, tiles.set2 = tile_Set2 g_65D2, tiles.icons[slot] = [pose0, pose1] (icon_Pic g_65D6).
export { tiles, Load24x24Set, DrawTile24, FreeCombatIcon, LoadCombatIcon, DrawIconAt } from '../engine/tiles_cab.js';
