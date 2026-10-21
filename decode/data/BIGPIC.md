# BIGPIC — full-width pictures (BIGPIC1.DAX, BIGPIC2.DAX, BIGPIC6.DAX) — new in CAB

Owner: cab-data. Format: **Pool P-record** (PICTURES.md §1), no new format. Renders: `png/BIGPIC/` (local).

## Records — H (bytes)

| file | id | raw | header (h, w8, x, y, count) | cga_map | content (from render, M) |
|---|---|---|---|---|---|
| BIGPIC1 | 121 | 18257 | 120, 38, 0, 0, 1 → **304×120** | 00 13 32 21 03 11 03 23 | overland map of the region: forest, hills, river, nodes joined by paths |
| BIGPIC1 | 123 | 18257 | 304×120 | 02 22 22 22 02 31 11 33 | horned skull over flames |
| BIGPIC2 | 120 | 18257 | 304×120 | 00 22 22 21 01 13 11 33 | three hooded faces |
| BIGPIC6 | 122 | 18257 | 304×120 | 02 11 21 21 13 11 22 33 | night landscape with buildings |

Size check: 17 + 1 × 120 × 38 × 4 = 18257 for every record. Ids 120..123 are unique across the three files (global picture numbers, M).

## Loader — GAME.OVR 0x3DE73 (string `"bigpic"` at 0x3DE6C, length-prefixed) — H for the steps
```pascal
procedure LoadBigPic(id: byte);                 { retf 2 }
  FreePicture(DS:722C);                         { near call 0x3DBBB }
  if DS:7290 = id then exit;                    { already loaded }
  name := 'bigpic' + Str(DS:5BEE);              { DS:5BEE = current data set (role of Pool's DS:5376) }
  LoadPicture(name, id, 0, 0, var DS:728C);     { lcall 0297:011B }
  DS:7290 := id;
```
The next routine (0x3DEE1) draws `DS:728C` with `0297:1110(pic, 1, 1)` → column 1, row 1 in 8-px cells (M: arg order from the TITLE calls, PICTURES.md): 304×120 at (8, 8) fills the screen inside a one-cell border. Which ECL opcode/event calls LoadBigPic: cab-ecl/cab-tooling (open).
