# GEO — 3D-area maps (GEO2..6.DAX) — deltas vs Pool

Owner: cab-data. Tools: `decode/tools/geo.py` (Pool's, copied unchanged; renders `png/GEO/`, local), `decode/tools/cabdata.py geo`.

**Spec: same as Pool `PoolRadianceRE/decode/data/GEO.md` (layout, planes, wall-type nibbles, passage states, cell attribute byte). No format delta.** Confidence H.

## Loader — `Load3DMap` GAME.OVR **0x3F2C1** (`55 89 e5`; strings just before it: `"GEO"`, `".dax"`, `"Unable to load geo in Load3DMap."` at 0x3F297..0x3F2C0) — H
Same steps as Pool ov29_10C7: `cmp word [bp-2], 402h` (0x3F325) → error if raw ≠ 1026; 4 × Move(100h) (`0A54:1ABD`) at +0, +100h, +200h, +300h of the map buffer (0x3F36F..0x3F3D9) after skipping the 2-byte header; stores the id at `[…+18Ah]` (0x3F3F4); `retf 2`. File name = `"GEO" + Str(DS:5BEE) + ".dax"` (data-set byte `DS:5BEE`, Pool `DS:5376`).

## Deltas
- **Files:** GEO2..GEO6 (no GEO1, no GEO7/8). 16 records, all 1026 B, header `00 04` in all.
- **Id numbering:** ids are unique across files and fall in one 16-block per data set: set n → ids 16·(n−2) + k (GEO2 1..4, GEO3 16..21, GEO4 32..37, GEO5 48..53, GEO6 64..69). Pool's ids 0..32 had no such blocking (M: a numbering convention; the engine only uses the id).
- **Data cross-check (same test as Pool):** "E side of (x,y) walled" agrees with "W side of (x+1,y) walled" in **99.4 %** (Pool 90.7 %), S/N **99.5 %** (Pool 90.6 %); passage-state counts on walled sides: 0 → 5941, 1 → 1528, 2 → 395, 3 → 1 (Pool, same count: 0 → 9780, 1 → 2876, 2 → 128, 3 → 14).

## Records
| file | ids | sizes | header |
|---|---|---|---|
| GEO2 | 1, 3, 4 | [1026] | ['00 04'] |
| GEO3 | 16, 17, 21 | [1026] | ['00 04'] |
| GEO4 | 32, 33, 37 | [1026] | ['00 04'] |
| GEO5 | 50, 51, 53 | [1026] | ['00 04'] |
| GEO6 | 64, 66, 67, 69 | [1026] | ['00 04'] |

records=16, ids unique across files: True
