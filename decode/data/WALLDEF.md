# WALLDEF — 3D wall sets (WALLDEF2..6.DAX) and their 8×8 symbol sets (8X8D1..6.DAX) — deltas vs Pool

Owner: cab-data. Tool: `decode/tools/cabdata.py walldef`.

**Spec: same as Pool `PoolRadianceRE/decode/data/WALLDEF.md` (780-byte block = 5 wall types × 156 bytes, 10 pieces, slot rebasing, WALLDEF id ↔ 8X8D id pairing, multi-block id·10+k). No format delta.** Confidence H.

## Loader — `LoadWallSet` GAME.OVR **0x3EFD3** (`55 89 e5`; strings just before it: `"WALLDEF"`, `".dax"`, `"Unable to load "`, `" from WALLDEF"`, `"."`; Pool's message differed) — H
Same constants as Pool ov29_0E08: slot test `cmp byte [bp+6],1` / `cmp …,3` (0x3EFDA/0x3EFE0); block size `0x30C` (0x3F052, 0x3F0FA, 0x3F10B, 0x3F114); "blocks + slot > 4" check `cmp ax,4` (0x3F059); wall-type size `0x9C` (0x3F1B3, 0x3F1ED); loops `cmp [bp-0Fh],9Bh` and `cmp [bp-0Bh],5` (0x3F212/0x3F219); rebasing threshold read from a word variable `DS:268A` (0x3F1D9; Pool used the byte `DS:272C` = 45 — value of `DS:268A` to read from the data segment, cab-tooling); `retf 4`.

## Deltas
- **Files:** WALLDEF2..6 (no 1, 7, 8). 20 records; 18 × 780 B, 2 × 1560 B (2 blocks): WALLDEF5/14 ↔ 8X8D5/141, 142 and WALLDEF6/17 ↔ 8X8D6/171, 172. No 3-block record (Pool had WALLDEF3/0).
- **Pairing** with 8X8D is complete (every record, see table) — H.
- **Byte range:** 1-block records max 114..115 (slot-1 symbols, as Pool). The 2-block records reach 184/185 → their second block is authored for slot 2 directly (symbols 116..185), like Pool's 3-block WALLDEF3/0 (L, same reading as Pool).
- **8X8D1/202 has 40 tiles (Pool 31)** → symbol block 4 (256..) is 9 symbols longer if Put8x8Symbol's base table is unchanged (check `"Bad symbol number in Put8x8Symbol."` at OVR 0x425C4; open). 8X8D1/201 (font) is byte-identical to Pool; 203 = 45 tiles as in Pool.

## Records
| file | id | bytes | blocks | max byte | paired 8X8D records |
|---|---|---|---|---|---|
| WALLDEF2 | 1 | 780 | 1 | 115 | 8X8D2/1 ok |
| WALLDEF2 | 2 | 780 | 1 | 115 | 8X8D2/2 ok |
| WALLDEF2 | 3 | 780 | 1 | 115 | 8X8D2/3 ok |
| WALLDEF2 | 4 | 780 | 1 | 114 | 8X8D2/4 ok |
| WALLDEF3 | 3 | 780 | 1 | 115 | 8X8D3/3 ok |
| WALLDEF3 | 5 | 780 | 1 | 115 | 8X8D3/5 ok |
| WALLDEF3 | 6 | 780 | 1 | 115 | 8X8D3/6 ok |
| WALLDEF3 | 7 | 780 | 1 | 115 | 8X8D3/7 ok |
| WALLDEF4 | 3 | 780 | 1 | 115 | 8X8D4/3 ok |
| WALLDEF4 | 8 | 780 | 1 | 115 | 8X8D4/8 ok |
| WALLDEF4 | 9 | 780 | 1 | 115 | 8X8D4/9 ok |
| WALLDEF4 | 10 | 780 | 1 | 115 | 8X8D4/10 ok |
| WALLDEF4 | 11 | 780 | 1 | 115 | 8X8D4/11 ok |
| WALLDEF5 | 8 | 780 | 1 | 115 | 8X8D5/8 ok |
| WALLDEF5 | 12 | 780 | 1 | 115 | 8X8D5/12 ok |
| WALLDEF5 | 14 | 1560 | 2 | 184 | 8X8D5/141, 8X8D5/142 ok |
| WALLDEF6 | 3 | 780 | 1 | 115 | 8X8D6/3 ok |
| WALLDEF6 | 13 | 780 | 1 | 115 | 8X8D6/13 ok |
| WALLDEF6 | 16 | 780 | 1 | 115 | 8X8D6/16 ok |
| WALLDEF6 | 17 | 1560 | 2 | 185 | 8X8D6/171, 8X8D6/172 ok |

8X8D ids: 8X8D1 {201, 202, 203}; 8X8D2 {1, 2, 3, 4}; 8X8D3 {3, 5, 6, 7}; 8X8D4 {3, 8, 9, 10, 11}; 8X8D5 {8, 12, 141, 142}; 8X8D6 {3, 13, 16, 171, 172}
all WALLDEF records multiples of 780 and paired: True
