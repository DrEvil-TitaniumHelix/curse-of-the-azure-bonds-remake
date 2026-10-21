# SKY — 3D-view sky/horizon pictures (SKY.DAX) — new in CAB

Owner: cab-data. Format: **Pool P-record** (PICTURES.md §1). Renders: `png/SKY/` (local).

## Records — H (bytes)

| id | raw | layout | cga_map | content (render) |
|---|---|---|---|---|
| 250 | 721 | P 88×16 × 1 | all 0 | cloud/mountain strip on colour-13 (light magenta) background |
| 251 | 305 | P 24×24 × 1 | all 0 | yellow sun disc on colour-13 background |
| 252 | 2129 | P 88×48 × 1 | all 0 | horizon lines over a grey cobblestone ground |

Size check: 17 + 16×11×4 = 721; 17 + 24×3×4 = 305; 17 + 48×11×4 = 2129. The `cga_map` is all zero (no CGA mapping; consistent with an EGA-only feature, L).

## Loader — startup routine GAME.OVR 0xF552 (unit code base 0xF4FB; strings `"COMSPR"` 0xF540, `"sky"` 0xF547, `"ITEMS"` 0xF54B) — H
```pascal
if DS:4FE6 <> 0 then begin                       { 0FAE5 }
  LoadPicture('sky', 250, 1, 0Dh, var DS:7220);  { 0FAF1..0FB09 }
  LoadPicture('sky', 251, 1, 0Dh, var DS:7224);
  LoadPicture('sky', 252, 1, 0Dh, var DS:7228);
end;
```
Mask colour argument **0Dh = 13** (same as Pool's 8×8 wall tiles) → the light-magenta areas are transparent. File name has no data-set digit (one SKY.DAX for all sets). The 88-pixel width = the 3D view width: 250 is drawn across the top of the view, 251 placed in the sky, 252 the ground/horizon band (M, from sizes and renders; the drawing code is not yet read — cab-tooling/VIEW lane). `DS:4FE6` = unknown flag (only then is the sky loaded).
