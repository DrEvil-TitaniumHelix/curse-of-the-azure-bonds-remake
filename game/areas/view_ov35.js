// game/areas/view_ov35.js — VIEW ov35 (7400): the 8x8 symbol sets (Pool ov34 CA00).
// Owner: cab-build-areas. One implementation only: the routines live in engine/pictures.js (cab-build-engine), because the
// resident frame routines (01A0:0000..) and the title need them at M1; Curse's block-4 limit 127h comes from
// configurePictures({ symbolMax: 0x127 }) (cab: PER-7). This module re-exports them under the VIEW unit's name.
// Decode: decode/pseudo/VIEW.pas.md ov35 — Load8x8Set(id, block) 7400:0047 (LoadPicture('8x8d' + DataSet, id, 1, 0Dh),
// fatal 'Unable to load ' id ' from 8x8D' DataSet, then FlushGameKeys 7400:0145), Put8x8Symbol(col, row, sym, toView,
// masked) 7400:0173 (blocks 1..2Dh / 2Eh..73h / 74h..B9h / BAh..FFh / 100h..127h, bases DS:2680).
export { Load8x8Set, Put8x8Symbol, SYMBOL_BASE } from '../engine/pictures.js';
