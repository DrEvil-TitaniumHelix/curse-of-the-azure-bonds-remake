# VIEW — 3D view, area map, movement, wall sets, sprites, menus, combat field (FINAL pseudocode, lane cab-mod-eclview)

Units (herdr/assignments/cab-areas.md, ECL+VIEW minus the script VM): ov10, ov14, ov26, ov27, ov28, ov29, ov30, ov31, ov32, ov33, ov35.
Pool twin file: `PoolRadianceRE/decode/pseudo/VIEW.pas.md` (Pool units ov10, ov14, ov23, ov25..ov34). Curse unit = Pool unit shifted: ov26=Pool ov25, ov28=Pool ov26, ov29=Pool ov28, ov30=Pool ov29, ov31=Pool ov30, ov32=Pool ov31, ov33=Pool ov32, ov35=Pool ov34 (shape match per function: `rtcensus`-style instruction-shape ratio, listed as `Pool:` per routine; 1.00 = identical code modulo addresses).
Sources: `decode/listings/<unit>.lst` (evidence) and `.c` (Ghidra aid, names from `decode/names/*.json`). Data specs: `decode/data/GEO.md`, `WALLDEF.md`, `PICTURES.md`, `BIGPIC.md`, `SKY.md`, `TILES.md`, `MONSTERS.md`; VM spec `decode/ecl/ECL_VM.md`.

Conventions
- **Signatures are in Pascal order**: first parameter = highest BP offset (pushed first). Ghidra's `param_1..n` is the reverse (param_1 = the last push = `[BP+6]`). Every call with 2+ arguments below was read from the pushes in the `.lst` (scratch tool `pushes.py`: push sequence before each CALL = Pascal order) and checked with `decode/tools/argcheck.py` (VIEW_ARGCHECK.md), not from the C.
- `{ seg:off }` = address of the first instruction of the statement (or of the call that implements it).
- Globals: `g_XXXX` = DS:XXXX (DS = 0C1C). Names introduced here are in `decode/names/eclview_names.json` (globals request in STATUS.md for cab-rt). Pointers `p^` are far. `Mem[x]` = ECL VM cell (ECL_VM.md §3; region 0 = word array `g_4F99^` at 4B00h, region 1 = `g_4F9D^` at 7C00h).
- Resident routines are cab-rt's names (`decode/names/res_names.json`): `LoadDaxRecord 0636:08DE`, `LoadPicture 0297:011B` (Pascal order `LoadPicture(name, id, flags, maskColour, var pic)`), `GetPicture 0297:0EFF` (col, row, pic: screen -> picture) and `PutPicture 0297:1110` (col, row, pic: picture -> screen) (cab-rt resident note #1; the listings still show them as `PutPicture` / `PutPicture`), `DrawPictureInto 0297:08F8` (col, row, frame, flags, pic, target), `DrawPicture` = `DrawPicture(col, row, frame, flags, pic, target)` (same signature, Pool 0464:1951; name M), `FillPictureRect 0297:1D8D` (x, y, width, height, colour, pattern, target), `FlushViewDirtyLines 0297:1316`, `RecolorPicture 0297:1626`, `AllocPicture 0297:1C59`, `FreePicture 0297:1D19`, `ConvertPicturePixels 0297:02AD`, `MirrorPicture 0297:0BB5`, `DrawText 0542:0352` (col, row, fg, bg, s), `DrawRepeatedGlyph 0542:01E6`, `ClearGlyphRun 0542:0311`, `ClearRectangle 01A0:04CD`, `ShowTimedBottomPrompt 0542:0AD9`, `ShowBottomPromptAndReadKey 0542:0946`, `MessageDelay 0542:0B33`, `TimeInHundredths 0542:0994`, `ReadGameKey 06EA:010D`, `TerminateGame 06EA:0000`, `RestorePreviousVideoMode 0297:0107`, `PlayOrStopSound 0713:0020`, `FlushGameKeys` (called after every picture load, role L; Pool 0899:0104).
- ECL-lane names (ecl_names.json): `AdvanceClock 5400:03B9(count, unit)`, `PartySummary 6200:0795`, `DrawLocationTimeStatus` (status line redraw, M), `RedrawCurrentMode` (redraw by view mode), `RemovePartyMember 4800:3A56`, `Roll = Roll(count, sides)` (COMBAT lane; Pascal order from the pushes `3F00:0374`: count 1 first, sides 6 second).

Map coordinate convention (from the getters): cell index = `y*16 + x`; directions 0/2/4/6 = N/E/S/W; step tables `g_2694[dir]` = dx `{0,1,1,1,0,-1,-1,-1,0}` and `g_269D[dir]` = dy `{-1,-1,0,1,1,1,0,-1,0}` (image bytes at DS:2694/269D, H; Pool g_2736/g_273F).

Globals of this area (Curse DS, Pool twin in brackets): `party_MapX` g_720F [6AAD], `party_MapY` g_7210 [6AAE], `party_Dir` g_7211 [6AAF], `party_Ahead` g_7212 [6AB0], `party_CellAttr` g_7213 [6AB1], `view_AreaMap` g_720E [6AAC], `view_Mode` g_4FBA [travel_Mode 49FA; **values differ: 4 = 3D area, 3 = 2D area (BIGPIC backdrop), 5 = combat, 0/1/2/6 other screens** — Curse has no overland travel modes], `view_PrevMode` g_4FBB [49F9], `view_Redraw` g_7580 (RefreshView request, new), `backdrop_C0..C3` g_720A..g_720D [6A60..63], `wall_Buf` g_7202 [6A58], `map_Buf` g_7206 [6A5C], `view_Pic` g_4FE8 [4A20], `VideoMode` g_4FE6 [4A1E] (0 = CGA, 1 = EGA, 2 = Tandy; cab-rt globals), `sym_Block[0..4]` g_65B6 [5E3A], `scratch_Pic` g_65CA [5E4E], `tile_Set` g_65CE / `tile_Set2` g_65D2 [5E52 / 5E56], `icon_Pic[slot*8]` g_65D6 [5E5A], `enc_Anim` g_722C [6ABE], `anim_Name` g_7278 / `anim_Id` g_728A [6B0A / 6B1C], `head_Id/Pic` g_726E / g_726F, `body_Id/Pic` g_7273 / g_7274 [6B00/6B01, 6B05/6B06], `bigpic_Pic` g_728C / `bigpic_Id` g_7290 (new), `sky_Strip` g_7228, `sky_Sun` g_7224, `sky_Moon` g_7220 (SKY.DAX 252/251/250, names M), `door_CanBash/Pick/Knock` g_7588..g_758A [6DDE..6DE0], `text_Cleared` g_8B66 [84E4], `ecl_Block` g_8B5E [84DC], `PartyDead` g_4FC7, `SelectedChar` g_6506, `PartyHead` g_650A, `DataSet` g_5BEE [5376], `cm_Map` g_6E92 [6716], combatant table `cb_Col/Row/Index/Size` g_66A3..g_66A6 [5F27..5F2A], `cb_Char[n]` g_6D35 [65B9], `cb_ScrCol/Row` g_67C6 / g_680E [604A / 6092], `cm_Occupant` g_6857 [60DB], target list base g_6E94 / count g_6E96 [6718 / 671A], corpse list g_6E52 (7 bytes × 8, count g_6E91) [66D6], `menu_Sel` g_7294, `menu_Ext` g_7295, `menu_Timeout` g_7296/g_7298, `menu_TimeoutKey` g_729A [6B2B..6B32], `menu_Top` g_7292 [6B29], `combat_Visible` g_75E6 (M), `fallen_Pic[2]` g_6696/g_6698 [5F1A].

Character record (`c`, 422 B, MONSTERS.md): fields used here — `+11h` str, `+1Ch` str_exc, `+1Eh..` memorised spells (84 slots), `+75h` class, `+DEh` size/footprint (`and 7Fh`), `+EAh..+F1h` thief skills, `+109h..+110h` levels, `+111h..+118h` previous-class levels (used when `DualClassActive(c)`), `+143h` icon slot, `+189h` next member, `+18Dh` combatant record (`^[9]` facing, `^[13h]` extra flag), `+195h` status, `+196h` active. Pool offsets: SAVES.md §3.

---

## ov30 (6D00) — map access, 3D view renderer, wall sets, map loader (Pool ov29 B100)

### 6D00:0011 DrawAreaMap (M)
`procedure DrawAreaMap(x [BP+0Ah], y [BP+8], dir [BP+6]: ShortInt)` — caller Draw3DView (when `view_AreaMap <> 0`). Callees: GetWallType, Put8x8Symbol (ov35 e3), FlushViewDirtyLines. `RETF 6`.
Pool: B100:0000 DrawAreaMap, shape 0.95 — same algorithm, Curse addresses below.
```pascal
x0 := x - 5;  if x0 < 0 then x0 := 0;  if x0 > 5 then x0 := 5;          { 6d00:0014 }
y0 := y - 5;  if y0 < 0 then y0 := 0;  if y0 > 5 then y0 := 5;          { 6d00:0036 }
for r := 0 to 10 do                                                     { 6d00:006f }
  for c := 0 to 10 do begin
    sym := $104;                                                        { 6d00:008a }
    if GetWallType(x0+c, y0+r, 0) <> 0 then sym := $105;                { 6d00:00a7  pushes: x, y, dir 0 }
    if GetWallType(x0+c, y0+r, 2) <> 0 then sym := sym + 2;             { 6d00:00bd }
    if GetWallType(x0+c, y0+r, 4) <> 0 then sym := sym + 4;             { 6d00:00d4 }
    if GetWallType(x0+c, y0+r, 6) <> 0 then sym := sym + 8;             { 6d00:00eb }
    Put8x8Symbol(c+2, r+2, sym, 1, 0);                                  { 6d00:0102 }
  end;
Put8x8Symbol(x - x0 + 2, y - y0 + 2, (dir div 2) + $100, 1, 0);         { 6d00:0134  party arrow = symbols 100h..103h }
FlushViewDirtyLines;                                                    { 6d00:0160 }
```
**Argument order of the map getters (H, argcheck on every push site, e.g. 3f00:0338 `PUSH [720F]; PUSH [7210]; PUSH [7211]`): `GetWallType(x, y, dir)`, `GetPassage(x, y, dir)`, `GetCellAttr(x, y)`, `InMap(x, y)` — Pool's order.** The bodies read `x` at `[BP+0Ah]`, `y` at `[BP+8]`, `dir` at `[BP+6]` (6d00:06bd: Ghidra `param_1` = dir = `[BP+6]`, `param_2` = y (row index `*10h`), `param_3` = x).

### 6D00:016B SetBackdropColours (M)
`procedure SetBackdropColours(c0 [BP+0Ch], c1 [BP+0Ah], c2 [BP+8], c3 [BP+6]: Byte)` — caller RefreshView (RefreshView, stub ov30 e2). `g_720A := c0; g_720B := c1; g_720C := c2; g_720D := c3` { 6d00:016e .. 0188 }. Pool: B100:0155, same.

### 6D00:018C DrawBackdrop (H)
`procedure DrawBackdrop` — caller Draw3DView. Pool: B100:0174 DrawBackdrop (4 rectangles only) — **changed: the EGA branch draws the SKY.DAX pictures (sun / moon by time of day and facing) over the colour bands.**
```pascal
if VideoMode = 0 then begin                                              { 6d00:018c  CGA }
  FillPictureRect(2, $10, $0B, $2B, backdrop_C0, @g_25A2, view_Pic);          { 6d00:019c  sky, rows 10h..3Ah }
  FillPictureRect(2, $3B, $0B, $01, backdrop_C1, @g_25A2, view_Pic);          { 6d00:01c2 }
  FillPictureRect(2, $3C, $0B, $02, backdrop_C2, @g_25A2, view_Pic);          { 6d00:01e8 }
  FillPictureRect(2, $3E, $0B, $2A, backdrop_C3, @g_25A2, view_Pic);          { 6d00:020e  ground }
end else begin                                                           { EGA / Tandy }
  FillPictureRect(2, $10, $0B, $2C, backdrop_C0, @g_25A2, view_Pic);          { 6d00:0237  sky one row taller }
  FillPictureRect(2, $3C, $0B, $02, backdrop_C2, @g_25A2, view_Pic);          { 6d00:025d }
  FillPictureRect(2, $3E, $0B, $2A, backdrop_C3, @g_25A2, view_Pic);          { 6d00:0283 }
  if (GetCellAttr(party_MapX, party_MapY) < $80) and (backdrop_C0 = $0B) then begin   { 6d00:02a9 / 02bc  outdoors (light-cyan sky) only }
    h := Mem[4BC9];                                                      { 6d00:02c6  clock cell 4BC9 = hour counter (region 0 +192h) }
    if h in [1..5] then                                                  { 6d00:02d6  morning: sun low in the east }
      if party_Dir = 2 then DrawPicture(9, 7 - h, 0, 1, sky_Sun, view_Pic)                { 6d00:02ff  col 9, row 7-h }
      else if (party_Dir = 4) and (h > 2) then DrawPicture(h - 1, 7 - h, 0, 1, sky_Sun, view_Pic)   { 6d00:033c }
    else if h in [13..18] then                                           { 6d00:0372  evening: sun in the west }
      if party_Dir = 6 then DrawPicture(2, h - 11, 0, 1, sky_Sun, view_Pic)              { 6d00:0386 }
      else if (party_Dir = 4) and (h < 16) then DrawPicture(h - 6, h - 11, 0, 1, sky_Sun, view_Pic);   { 6d00:03c0 }
    if party_Dir = 0 then DrawPicture(2, 2, 0, 1, sky_Moon, view_Pic);   { 6d00:03fa  facing north: the second sky object }
  end;
  DrawPicture(2, 7, 0, 1, sky_Strip, view_Pic);                          { 6d00:0421  col 2, row 7 }
end;
```
(`g_25A2` = fill pattern table as Pool's `g_260A`; `DrawPicture` arguments from the pushes `col, row, 0, 1, pic, view`. Which SKY record is `g_7224` vs `g_7220`: SKY.md loads 250 -> g_7220, 251 -> g_7224 (24x24 sun), 252 -> g_7228 (88x48) — so the "sun" above is record 251 and the north object record 250, the 88x16 strip; the strip drawn at (2,7) is record 252 (M: SKY.md load order vs. picture sizes; the code is H).)

### 6D00:0448 DrawWallPiece (H)
`procedure DrawWallPiece(col [BP+0Ch], row [BP+0Ah]: ShortInt; wallType [BP+8], piece [BP+6]: Byte)` — caller Draw3DView. Callee Put8x8Symbol. Pascal order = push order (6d00:0987: `PUSH g_0AF6+off; PUSH [0B0A]; PUSH w; PUSH 0`): col, row, type, piece — as Pool.
Draws piece `piece` (0..9) of wall type `wallType` (1..15) as a block of 8x8 symbols whose top-left cell is (col, row) of the 11x11 view grid; cells outside 0..10 are clipped, symbol 0 is transparent.
```pascal
k := g_0AD8[piece];                                  { 6d00:044e  start offset of the piece in the 156-byte wall type }
lastCol := col + g_0AE2[piece] - 1;                  { 6d00:045c  width }
lastRow := row + g_0AEC[piece] - 1;                  { 6d00:0475  height }
for r := row to lastRow do                           { 6d00:0475 }
  for c := col to lastCol do begin
    if (r >= 0) and (r < 11) and (c >= 0) and (c < 11) then
      if wall_Buf^[(wallType-1)*$9C + k] <> 0 then
        Put8x8Symbol(c+2, r+2, wall_Buf^[(wallType-1)*$9C + k], 1, 1);   { 6d00:04fb }
    k := k + 1;                                      { advances even for clipped cells }
  end;
```
Tables (image bytes at DS:0AD8/0AE2/0AEC, H): start = 0, 2, 6, 10, 22, 38, 54, 110, 132, 154; width = 1, 1, 1, 3, 2, 2, 7, 2, 2, 1; height = 2, 4, 4, 4, 8, 8, 8, 11, 11, 2 — identical to Pool's (WALLDEF.md 156-byte layout holds).

### 6D00:0556 InMap (H)
`function InMap(x [BP+8], y [BP+6]: ShortInt): Boolean` := `(x < 16) and (x >= 0) and (y < 16) and (y >= 0)` { 6d00:055c }. Pool: B100:031F (1.00).

### 6D00:0587 GetPassage (H)
`function GetPassage(x [BP+0Ah], y [BP+8]: ShortInt; dir [BP+6]: Byte): Byte` — callers: ov14 movement (stub ov30 e5), ov10 ProbeSide.
```pascal
if not InMap(x, y) and ((ecl_Block = 0) or (ecl_Block = 10)) then GetPassage := 0   { 6d00:058d / 05a4 }
else begin
  if x > 15 then x := 0;  if x < 0 then x := 15;                         { 6d00:05b2  wrap }
  if y > 15 then y := 0;  if y < 0 then y := 15;                         { 6d00:05c8 }
  result := 1;
  if GetWallType(x, y, dir) <> 0 then                                    { 6d00:05e2 }
    case dir of                                                          { 6d00:05f9 }
      6: result :=  map_Buf^[$300 + y*16 + x] shr 6;
      4: result := (map_Buf^[$300 + y*16 + x] and $30) shr 4;
      2: result := (map_Buf^[$300 + y*16 + x] and $0C) shr 2;
      0: result :=  map_Buf^[$300 + y*16 + x] and 3;
    end;
  GetPassage := result;
end;
```
Pool: B100:0350 (same). `ecl_Block` 0 / 10 = bounded map (outside cells have no walls), others wrap (H for the test).

### 6D00:06BD GetWallType (H)
`function GetWallType(x [BP+0Ah], y [BP+8]: ShortInt; dir [BP+6]: Byte): Byte` — same bounds/wrap rule { 6d00:06cc .. 06fe }; `case dir of 0: map_Buf^[y*16+x] shr 4; 2: … and $0F; 4: map_Buf^[$100 + y*16+x] shr 4; 6: … and $0F` { 6d00:0704 .. 07c0 }. Pool: B100:047B (same).

### 6D00:07C6 GetCellAttr (H)
`function GetCellAttr(x [BP+8], y [BP+6]: ShortInt): Byte` — same rule, returns `map_Buf^[$200 + y*16 + x]` { 6d00:07d5 .. 0835 }. Pool: B100:057A.

### 6D00:0841 Draw3DView (H)
`procedure Draw3DView(x [BP+0Ah], y [BP+8]: ShortInt; dir [BP+6]: Byte)` — callers: RefreshView, ExploreCommand (stub ov30 e7, pushes `[720F] [7210] [7211]` = x, y, dir). Callees: DrawAreaMap, DrawBackdrop, GetWallType, InMap, DrawWallPiece, FlushViewDirtyLines.
Pool: B100:05FD Draw3DView, shape 0.94 — identical renderer; the painter's order and the square geometry are Pool's. The view is an 11x11 grid of 8x8 cells placed at text cell (3,3); the renderer starts two squares ahead and works back to the party's square, drawing for each distance the front walls (side `dir`) and the side walls (`left = dir+6`, `right = dir+2`).
```pascal
if view_AreaMap <> 0 then begin DrawAreaMap(x, y, dir); exit end;          { 6d00:0847 / 084e }
DrawBackdrop;                                                               { 6d00:0861 }
left := (dir + 6) mod 8;  back := (dir + 4) mod 8;  right := (dir + 2) mod 8;  { 6d00:0865 }
cx := x + 2*step_dx[dir];  cy := y + 2*step_dy[dir];                          { 6d00:08a9  square two ahead }
for dist := 2 downto 0 do begin                                             { 6d00:08cb }
  case dist of
  2: begin
       { pass 1: centre to the left, 4 squares }                            { 6d00:08d6 }
       sx := cx; sy := cy; off := 0; edge := 0;
       for i := 0 to 3 do begin
         w := GetWallType(sx, sy, dir);                                     { 6d00:0910 }
         if not InMap(sx, sy) and (GetWallType(sx, sy, right) = 0) then edge := 0;   { 6d00:0923 / 0933 }
         if w = 0 then begin
           if (edge <> 0) and (GetWallType(sx - step_dx[left], sy - step_dy[left], left) <> 0) then
             DrawWallPiece(g_0B08 + off + 1, g_0B1C, edge, 9);              { 6d00:0957  far corner piece }
           edge := 0;
         end else begin
           if edge <> 0 then DrawWallPiece(g_0B08 + off + 1, g_0B1C, edge, 9);   { 6d00:09c6 }
           DrawWallPiece(g_0AF6 + off, g_0B0A, w, 0);                       { 6d00:0974  far front wall 1x2 }
           edge := w;
         end;
         off := off - 2;  sx := sx + step_dx[left];  sy := sy + step_dy[left];
       end;
       { pass 2: centre to the right — same with `right`, corner at g_0B08 + off - 1, off := off + 2 }   { 6d00:0a31 .. 0aa8 }
       { far side walls, left: }                                            { 6d00:0b4b }
       sx := cx; sy := cy; off := 0;
       for i := 0 to 2 do begin
         w := GetWallType(sx, sy, left);
         if w <> 0 then
           if i = 0 then DrawWallPiece(g_0AF8 + off, g_0B0C, w, 1)          { 6d00:0b6a }
           else DrawWallPiece(g_0AF8 + off - 1, g_0B0C, w, 1);              { 6d00:0b82 }
         off := off - 2;  sx := sx + step_dx[left];  sy := sy + step_dy[left];
       end;
       { far side walls, right: piece 2 at g_0AFA + off (+1 after the first), off := off + 2 }   { 6d00:0be2; draws 0c14 / 0c2d }
     end;
  1: begin                                                                  { middle row, squares -2..+2 }
       sx := cx + 2*step_dx[left]; sy := cy + 2*step_dy[left]; off := -6;     { 6d00:0c8d }
       for i := 0 to 2 do begin
         w := GetWallType(sx, sy, dir);  if w <> 0 then DrawWallPiece(g_0AFC + off, g_0B10, w, 3);   { 6d00:0cc3 / 0cdc  front 3x4 }
         w := GetWallType(sx, sy, left); if w <> 0 then DrawWallPiece(g_0AFE + off, g_0B12, w, 4);   { 6d00:0cf2 / 0d0b  left side 2x8 }
         off := off + 3;  sx := sx + step_dx[right];  sy := sy + step_dy[right];
       end;
       sx := cx + 2*step_dx[right]; sy := cy + 2*step_dy[right]; off := 6;    { 6d00:0d61 }
       for i := 0 to 2 do begin
         w := GetWallType(sx, sy, dir);   if w <> 0 then DrawWallPiece(g_0AFC + off, g_0B10, w, 3);   { 6d00:0da9 / 0dc2 }
         w := GetWallType(sx, sy, right); if w <> 0 then DrawWallPiece(g_0B00 + off, g_0B14, w, 5);   { 6d00:0dd8 / 0df1  right side 2x8 }
         off := off - 3;  sx := sx + step_dx[left];  sy := sy + step_dy[left];
       end;
     end;
  0: begin                                                                  { near row, squares -1..+1 }
       sx := cx + step_dx[left]; sy := cy + step_dy[left]; off := -7;         { 6d00:0e52 }
       for i := 0 to 1 do begin
         w := GetWallType(sx, sy, dir);  if w <> 0 then DrawWallPiece(g_0B02 + off, g_0B16, w, 6);   { 6d00:0e76 / 0e8f  front 7x8 }
         w := GetWallType(sx, sy, left); if w <> 0 then DrawWallPiece(g_0B04 + off, g_0B18, w, 7);   { 6d00:0ea5 / 0ebe  left side 2x11 }
         off := off + 7;  sx := sx + step_dx[right];  sy := sy + step_dy[right];
       end;
       sx := cx + step_dx[right]; sy := cy + step_dy[right]; off := 7;        { 6d00:0f14 }
       for i := 0 to 1 do begin
         w := GetWallType(sx, sy, dir);   if w <> 0 then DrawWallPiece(g_0B02 + off, g_0B16, w, 6);   { 6d00:0f38 / 0f51 }
         w := GetWallType(sx, sy, right); if w <> 0 then DrawWallPiece(g_0B06 + off, g_0B1A, w, 8);   { 6d00:0f67 / 0f80  right side 2x11 }
         off := off - 7;  sx := sx + step_dx[left];  sy := sy + step_dy[left];
       end;
     end;
  end;
  cx := cx + step_dx[back];  cy := cy + step_dy[back];                        { 6d00:0fd6  one square nearer }
end;
FlushViewDirtyLines;                                                        { 6d00:0ff4 }
```
Placement tables (image words at DS:0AF6 / 0B0A, H): column `g_0AF6[piece]` = 5, 4, 6, 4, 2, 7, 2, 0, 9, 5 and row `g_0B0A[piece]` = 4, 3, 3, 3, 1, 1, 1, 0, 0, 4 — Pool's values. `g_0B08` = column of piece 9 (5), `g_0B1C` = its row (4).

### 6D00:104C LoadWallSet (H) — stub ov30 e8
`procedure LoadWallSet(id [BP+8], slot [BP+6]: Byte)` — callers: ECL LOAD_PIECES (ECL_VM.md 4.5), `ecl_SetCharField` 7F22/24/26, StartCombat. Name from "Unable to load N from WALLDEF" (cs:100C/101C). Pascal order (id, slot) as Pool: `[BP+6]` (Ghidra param_1) is tested `in 1..3` (6d00:1052), `[BP+8]` is the record id passed to LoadDaxRecord (6d00:10b4). Pool: B100:0E08 (0.93).
Pseudocode = WALLDEF.md loader: name `'WALLDEF' + Str(DataSet)` { 6d00:1062 / 1077 / 1091 }, `LoadDaxRecord(name, '.dax', id, size, buf)` { 6d00:109c / 10b4  the extension is a separate argument (cs:1007) }, size check `size = 0 or size div 30Ch + slot > 4` { 6d00:10c6 } -> RestorePreviousVideoMode, `Write('Unable to load ', id, ' from WALLDEF' + Str(DataSet))`, ReadGameKey, halt { 6d00:10d7 .. 113d }; delta `g_2680[slot] - g_2682` { 6d00:1142 }; copy loop `Move(30Ch)` into `wall_Buf^[(slot+k-1)*30Ch]` { 6d00:1188 }; FreeMem { 6d00:11a5 }; per loaded set k: if `slot+k-1 in [1..3]` (SetIn cs:102C) { 6d00:11c9 }: slot table `g_7210[(slot+k-1)*4] := FFFFh; g_7212[..] := FFFFh` { 6d00:11db / 11ee } (= `g_7214..` beyond the party bytes: the remembered-slot table is `g_7214 + (slot-1)*4`, as Pool's g_6AB2), rebasing of every symbol byte `>= g_268A` (= 45) by the delta over 5 x 9Ch entries { 6d00:1233 }, then `Load8x8Set(id, slot+k-1)` for a single set or `Load8x8Set(id*10 + k, slot+k-1)` for multi-set records { 6d00:12b9 / 12ce }; finally `g_7210[slot*4] := id; g_7212[slot*4] := slot` { 6d00:12f7 / 130d }. `RETF 4`.

### 6D00:133A Load3DMap (H) — stub ov30 e9
`procedure Load3DMap(id [BP+6]: Byte)` — caller ECL LOAD_FILES. Error "Unable to load geo in Load3DMap." (cs:1319). `LoadDaxRecord('GEO' + Str(DataSet), '.dax', id, size, buf)` { 6d00:1361 / 1393  '.dax' = cs:1314, a separate argument }; size <> 402h -> fatal { 6d00:139e .. 13ce }; four `Move($100)` of the record bytes 2.. into `map_Buf^[0..3FFh]` { 6d00:13ec / 140e / 1430 / 1452 }; FreeMem { 6d00:145f }; `Mem[4BC5] := id` { 6d00:1464  region 0 +18Ah }. Pool: B100:10C7 (same).

### 6D00:0000 ov30_LoadDeps (M) / 6D00:1478 ov30_init
`ov30_LoadDeps` calls `ov35_0000` and `ov34_0000` (stubs e4/e2) { 6d00:0003 / 0008 } — every unit's entry-0 routine is an empty procedure or a chain of such calls: a dependency touch that forces the overlay manager to load the called units (M; harmless). `ov30_init` = `RETF`.

---

## ov35 (7400) — 8x8 symbol sets (Pool ov34 CA00)

### 7400:0047 Load8x8Set (H) — stub ov35 e2
`procedure Load8x8Set(id [BP+8], block [BP+6]: Byte)` — callers: LoadWallSet (6d00:12b9 / 12ce), startup. Name from "Unable to load " / " from 8x8D" (cs:2C / 3C). Pool: CA00:003B (id, block), same order (H: Ghidra param_1 = `[BP+6]` = block goes into the `SetIn` test and the block index, `[BP+8]` = id into LoadPicture at 7400:00ca). `RETF 4`.
```pascal
if block in [0..4] then begin                       { 7400:004e  set constant cs:0007 }
  name := '8x8d' + Str(DataSet);                    { 7400:0061 / 007b / 00aa }
  LoadPicture(name, id, 1, $0D, var sym_Block[block]);   { 7400:00af  pushes: name, id, 1, 0Dh, @g_65B6[block*4] }
  if sym_Block[block] = nil then begin              { 7400:00cf }
    RestorePreviousVideoMode;                       { 7400:00e4 }
    WriteLn(Output, 'Unable to load ', id, ' from 8x8D' + Str(DataSet));   { 7400:00e9 .. 012e }
    ReadGameKey; RestorePreviousVideoMode; TerminateGame;   { 7400:0133 / 013b / 0140 }
  end;
  FlushGameKeys;                                    { 7400:0145 }
end;
```
### 7400:0173 Put8x8Symbol (H) — stub ov35 e3
`procedure Put8x8Symbol(col [BP+0Eh], row [BP+0Ch]: ShortInt; sym [BP+0Ah]: Word; toView [BP+8], masked [BP+6]: Byte)` — name from "Bad symbol number in Put8x8Symbol." (cs:150). Order as Pool (the body passes `[BP+0Eh]`, `[BP+0Ch]` as DrawPictureInto's col, row at 7400:025f). `RETF 0Ah`.
```pascal
case sym of                                         { 7400:0176 }
  1..$2D: blk := 0;  $2E..$73: blk := 1;  $74..$B9: blk := 2;  $BA..$FF: blk := 3;  $100..$127: blk := 4;
else if (sym = 0) or (sym > $127) then begin        { 7400:01cc  Pool: > 11Eh; block 4 has 40 symbols here (cab-data 8X8D1/202) }
  RestorePreviousVideoMode; WriteLn('Bad symbol number in Put8x8Symbol.'); ReadGameKey; TerminateGame;   { 7400:01db .. 01ff }
end end;
if sym_Block[blk] <> nil then begin                 { 7400:0204 }
  sym := sym - g_2680[blk];                         { 7400:021c  block bases 1, 46, 116, 186, 256 (image words DS:2680) }
  if toView <> 0 then                               { 7400:022c }
    DrawPictureInto(col, row, sym, masked, sym_Block[blk], view_Pic)   { 7400:0232 }
  else begin
    Move(sym_Block[blk]^.pixels[sym * frameSize], scratch_Pic^.pixels, frameSize);   { 7400:027b  frameSize = pic^+11h }
    PutPicture(col, row, scratch_Pic);              { 7400:02a6  0294:1110 }
  end;
end;
```
Pool: CA00:015D (0.90). `ov35_0000` empty, `ov35_init` empty.

---

## ov29 (6C00) — encounter pictures, animations, portraits, 3D sprites, BIGPIC (Pool ov28 AC00)

`TAnim` (66 = 42h bytes, as Pool): +0 frame count n (<= 8), +1 current frame, frame k = 1..n: `+k*8-6` delay (longint) and `+k*8-2` picture pointer. `enc_Anim` = g_722C; `anim_Name` g_7278 (string[8]), `anim_Id` g_728A (FFh = none).

### 6C00:000C DrawPictureScreenOrView (H)
`procedure DrawPictureScreenOrView(col [BP+0Eh], row [BP+0Ch]: Byte; toView [BP+0Ah]: Boolean; pic: Pointer [BP+6])` — callers DrawHead, DrawBody, DrawPortrait, PICTURE / CLEAR BOX / CALL 6803h / HorizontalMenu (stub ov29 e1: pushes `3, 3, flag, pic`). Pool: AC00:0000 (0.76) — **changed: a "tint" recolouring when `Mem[4CFF] <> 0`.**
```pascal
if pic <> nil then                                                  { 6c00:000f }
  if (Mem[4CFF] = 0) and not toView then PutPicture(col, row, pic)      { 6c00:0017 / 007a  0296:1110 }
  else begin
    if Mem[4CFF] <> 0 then RecolorPicture(@g_0A98, @g_0AA8, 0, 1, pic);   { 6c00:0035  every colour except 4..7, 10, 14 -> 12 (light red): image tables }
    DrawPicture(col-1, row-1, 0, 0, pic, view_Pic);                 { 6c00:0050 }
    FlushViewDirtyLines;                                            { 6c00:0073 }
  end;
```
`Mem[4CFF]` = region-0 cell 4CFF (word index 1FFh): set by the scripts before "red" scenes (M: ECL4/34, ECL5/51 write `[4CFF]`); its exact meaning is the ECL lane's.

### 6C00:0091 DrawHead (H) / 6C00:00B3 DrawBody (H)
`DrawHead(col, row, pic)` = `DrawPictureScreenOrView(col, row, false, pic)` { 6c00:00aa }; `DrawBody(col, row, pic)` = `DrawPictureScreenOrView(col, row + 5, false, pic)` { 6c00:00cf }. Pool: AC00:0050 / 0070 (0.97).

### 6C00:010B LoadAnimation (H) — stub ov29 e4
`procedure LoadAnimation(name: string[8] [BP+0Eh]; id [BP+0Ch]: Byte; flags [BP+0Ah]: Byte; var anim: TAnim [BP+6])` — callers: PICTURE (`LoadAnimation('PIC', p, 0, enc_Anim)`, 2200:08BE), ShowEncounter (`'SPRIT'`), CLEAR BOX. Strings cs:D8 "Loading...Please Wait", EE "PIC", F2 "FINAL", F8 ".dax", FD "PIC not found". Pool: AC00:00A2 (0.89), same order; new: the "Loading" line on row 24 and the "PIC not found" prompt; the PIC frame cap is now a flag test.
```pascal
if ((name <> anim_Name) or (id <> anim_Id)) and (id <> $FF) then begin   { 6c00:0112 / 012f }
  if opt_Animation <> 0 then begin ClearGlyphRun(0, 24, 0, 40); DrawText(0, 24, 10, 0, 'Loading...Please Wait') end;   { 6c00:0148 / 014f / 017b  (g_4FBF: config flag, M) }
  FreeAnimation(anim); anim_Name := name; anim_Id := id;            { 6c00:0180 / 0189 / 0197 }
  isPic := (name = 'PIC') or (name = 'FINAL');                      { 6c00:01a2 / 01b3 }
  LoadDaxRecord(name + Str(DataSet), '.dax', id, size, p);          { 6c00:0211  RESIDENT 0636:08DE (name, ext, id, var size, var buf); '.dax' = cs:00F8 }
  if size = 0 then ShowBottomPromptAndReadKey($0E, 0, 'PIC not found')   { 6c00:023f }
  else begin
    anim.count := p^[0]; o := 1; anim.cur := 1; loaded := 0;        { 6c00:0250 .. }
    if (opt_Animation = 0) and isPic then anim.count := 1;                 { 6c00:0280  animations off: first frame only (M on the flag's name) }
    for k := 1 to anim.count do begin
      Move(p^[o], anim.delay[k], 4); o := o + 4;                    { 6c00:02a8 }
      h := word(p^[o]); o := o + 2;  w := word(p^[o]); o := o + 2;   { 6c00:02d3 / 02ef }
      if MaxAvail > $F3B then begin                                 { 6c00:030b }
        loaded := loaded + 1;
        AllocPicture(h, w, 1, flags, var anim.pic[k]);              { 6c00:0325  push order: h, w, 1, flags, @pic (resident AllocPicture; the word order is the resident lane's) }
        Move(p^[o], anim.pic[k]^.x, 2); o := o + 2;                 { 6c00:0363 }
        Move(p^[o], anim.pic[k]^.y, 2); o := o + 3;                 { 6c00:0383 }
        Move(p^[o], anim.pic[k]^.cga_map, 8); o := o + 8;           { 6c00:03a3 }
        len := frameSize (x2 when VideoMode = 0 / CGA);             { 6c00:03ca }
        if isPic then
          if k = 1 then begin base := GetMem(len); Move(p^[o], base^, len) end   { 6c00:0411 / 0420  keep frame 1 }
          else for i := 0 to len-1 do p^[o+i] := p^[o+i] xor base^[i];           { 6c00:0458  XOR delta as in Pool }
        ConvertPicturePixels(p, o, 0, flags, anim.pic[k]);          { 6c00:0488 }
        if (flags and 1 <> 0) and (VideoMode <> 0) then RecolorPicture(@g_0AB8, @g_0AC8, 0, 0, anim.pic[k]);   { 6c00:04c2  13 -> 0 }
        o := o + len;
      end;
    end;
    anim.count := loaded;
    if isPic and (base <> nil) then FreeMem(base, len);             { 6c00:051c }
    FreeMem(p, size); FlushGameKeys;                                { 6c00:052b / 0538 }
    if opt_Animation <> 0 then ClearGlyphRun(0, 24, 0, 40);                { 6c00:0544 }
  end;
end;
```
### 6C00:055B FreeAnimation (H) — stub ov29 e5
`procedure FreeAnimation(var anim: TAnim [BP+6])` — free `anim.pic[1..count]` (loop counter in `g_7747`) { 6c00:0596 }, `FillChar(anim, $42, 0)` { 6c00:05af }, `anim_Name := ''; anim_Id := $FF` { 6c00:05b9 / 05be }. Pool: AC00:048F (1.00).

### 6C00:05DD LoadPortrait (H) — stub ov29 e7
`procedure LoadPortrait(head [BP+8], body [BP+6]: ShortInt)` — caller ShowHeadBodyPicture. Order as Pool (H: Ghidra param_2 = `[BP+8]` is compared with `head_Id` and loaded as 'HEAD', param_1 = `[BP+6]` as 'BODY'). `if (head <> -1) and ((head_Id = -1) or (head_Id <> head)) then begin LoadPicture('HEAD' + Str(DataSet), head, 0, 0, var head_Pic); if head_Pic = nil then ShowBottomPromptAndReadKey($0E, 0, 'head not found'); head_Id := head end` { 6c00:05f9 / 063c / 065f / 0664 }; the same for the body with 'BODY' into `body_Pic`/`body_Id` (the same "head not found" text) { 6c00:0670 / 06a8 / 06cb / 06d0 }; `FlushGameKeys` { 6c00:06d6 }. Pool: AC00:05D9 (0.84).

### 6C00:06E1 DrawPortrait (H) — stub ov29 e6
`procedure DrawPortrait(col [BP+0Ah], row [BP+8]: Byte; both [BP+6]: Boolean)` — `both` -> `DrawHead(col, row, head_Pic); DrawBody(col, row, body_Pic)` { 6c00:06fb / 070f }; else `DrawPictureScreenOrView(col, row, false, head_Pic)` { 6c00:072c }. Pool: AC00:0697 (0.99). ShowHeadBodyPicture calls it as `(1, 3, 3)` -> `DrawPortrait(3, 3, true)`.

### 6C00:0754 Show3DSprite (H) — stub ov29 e8
`procedure Show3DSprite(k [BP+0Ah]: Byte; anim: TAnim [BP+6])` — name from "Illegal range in Show3DSprite." (cs:735). Copies the 66-byte record { 6c00:0768 }; k must be 1..3 else fatal { 6c00:0779 .. 0795 }; if `anim.pic[k] <> nil`: `DrawPicture(pic^.hdr4 + 2, pic^.hdr6 + 2, 0, 1, pic, view_Pic)` { 6c00:07f8  pushes: header word +4 then +6, each + 2 = the frame's cell position inside the view } and FlushViewDirtyLines { 6c00:0801 }. Pool: AC00:0708 (1.00).

### 6C00:0813 LoadBigPic (H) — stub ov29 e9 (new, no Pool twin)
`procedure LoadBigPic(id [BP+6]: Byte)` — callers: PICTURE (ids >= 78h), LOAD FILES / COMBAT (backdrop 79h), RedrawCurrentMode. `FreeAnimation(enc_Anim)` { 6c00:0820 }; `if bigpic_Id <> id then begin LoadPicture('bigpic' + Str(DataSet), id, 0, 0, var bigpic_Pic); bigpic_Id := id end` { 6c00:0836 / 0870 / 0878 }. (BIGPIC.md: 304x120 full-width pictures, ids 120..123.)
### 6C00:0881 DrawBigPic (H) — stub ov29 e10
`procedure DrawBigPic` — `FUN_01A0_0252` (resident, M: clear the picture area) { 6c00:0884 }; `PutPicture(1, 1, bigpic_Pic)` { 6c00:0899  at text cell (1,1) }. Called by RefreshView in 2D mode.
### 6C00:0000 ov29_LoadDeps (M, touches ov34) · 6C00:08A2 ov29_init empty.

---

## ov28 (6B00) — view refresh (Pool ov26 A200)

### 6B00:0016 BackdropColour1 (H) · 6B00:004F BackdropColour2 (H) · 6B00:0088 BackdropColour3 (H) *nested in RefreshView*
Lookup functions on a key byte: colour1(k): 8 -> 0, 'A' -> 0, E8h -> 0Fh, else 0Fh { 6b00:0016 }; colour2(k): 8 -> 8, 'A'/E8h/else -> 7 { 6b00:004f }; colour3(k): 0Bh -> 8, 9 -> 6, DBh -> 6, 6 -> 1, else 6 { 6b00:0088 }. Keys: `g_75E9` for 1 and 2, `g_75E8` for 3 (set by ECL C05Fh / C059h, ECL_VM.md §3.2). Pool: A200:00C7/00FB/012F (0.84), same tables.

### 6B00:00CC RefreshView (H) — stub ov28 e1
`procedure RefreshView` — callers: game loop, ECL PICTURE/SPRITE OFF/CALL, movement (everywhere `g_7580 := 1; RefreshView`). Pool: A200:016D (0.69) — **changed: no overland branch; 2D areas redraw the BIGPIC; the redraw is gated by `view_Redraw` (g_7580).**
```pascal
if anim_Id = 'P' then view_Redraw := 0;                                  { 6b00:00cc  id 50h: a full picture is up (M) }
if not PartyDead then begin                                              { 6b00:00de }
  if Mem[4BE6] = 0 then begin                                            { 6b00:00e8  not a 3D area }
    if view_Redraw <> 0 then DrawBigPic;                                 { 6b00:01a2 / 01a9 }
  end else begin
    party_CellAttr := GetCellAttr(party_MapX, party_MapY);               { 6b00:00f7 }
    if party_CellAttr < $80 then backdrop_C0 := SkyColours[Mem[4BFD]]             { 6b00:0107  sky colour: cell attribute bit 7 selects the ECL colour cell }
    else backdrop_C0 := SkyColours[Mem[4BFE]];                                    { 6b00:0120 }
    if VideoMode = 0 then begin                                          { 6b00:0130  CGA: colour bands from the ECL keys }
      if view_RedrawParams <> 0 then begin                                          { 6b00:0137  backdrop keys changed (C059h/C05Fh writes) }
        backdrop_C1 := BackdropColour1(backdrop_Key12); backdrop_C2 := BackdropColour2(backdrop_Key12); backdrop_C3 := BackdropColour3(backdrop_Key3);   { 6b00:0143 / 014f / 015b }
        SetBackdropColours(backdrop_C0, backdrop_C1, backdrop_C2, backdrop_C3);              { 6b00:0162 }
      end
    end else backdrop_C3 := 8;                                                { 6b00:0177  EGA/Tandy: ground always dark grey }
    if Mem[4BFB] <> 0 then view_AreaMap := 0;                            { 6b00:017e  area map not allowed here }
    Draw3DView(party_MapX, party_MapY, party_Dir);                       { 6b00:018f }
  end;
  view_Redraw := 0;                                                      { 6b00:01ae }
end;
```
`g_0A88` = EGA colour list (image, 16 bytes: 0, 15, 4, 11, 13, 2, 9, 14, repeated — Pool's `g_0C26` had 0, 15, 12, 11, 13, 10, 9, 14: two entries differ, H bytes).
### 6B00:0000 ov28_LoadDeps (touches ov33, ov34, ov29) · 6B00:01B7 ov28_init empty.

---

## ov27 (6A00) — BIGPIC overlay animation (no Pool twin)

Three tiny routines called only by HorizontalMenu (HorizontalMenu, stubs e3/e4/e5) while a menu waits in a 2D area with the city backdrop (`view_Mode = 3`, `bigpic_Id = $79`, `anim_Id <> 'P'`): an element of BIGPIC 121 is animated in two phases on timers (every 1Eh and 32h hundredths, VIEW_SCREENS.md VIEW-13).
### 6A00:0007 BigPicAnimSetPos (M)
`g_8C78 := g_0A48[Mem[4CA1]]; g_8C7A := g_0A68[Mem[4CA1]]` { 6a00:000a / 001c } — column/row of the animated spot from two 32-entry image tables (DS:0A48 = 4,12,21,11,29,20,38,21,30,31,25,37,28,29,3,12,25,29,29,33,19,16,9,16,20,21,25,25,26,31,37,34; DS:0A68 = 15,8,11,4,10,4,1,2,13,15,3,5,2,8,12,13,10,12,9,9,8,6,6,3,2,2,3,2,3,4,2,1) indexed by the region-0 cell 4CA1 (the current location number, M).
### 6A00:0032 BigPicAnimPhaseA (M)
`GetPicture(g_8C78, g_8C7A, scratch_Pic); PutPicture(g_8C78, g_8C7A, g_8C7C^)` { 6a00:0045 / 005a } — saves the background under the spot into `scratch_Pic` and draws the picture `g_8C7C^` (loaded elsewhere; ENGINE) there.
### 6A00:0063 BigPicAnimPhaseB (M)
`PutPicture(g_8C78, g_8C7A, scratch_Pic)` { 6a00:0076 } — restores the saved background (the element blinks). Entries e6 = `ov27_0000` empty, e0 = init empty.

---

## ov33 (7200) — 24x24 tile sets and combat icons (Pool ov32 C000)

### 7200:002E Load24x24Set (H) — stub ov33 e2
`procedure Load24x24Set(name: string [BP+0Ch]; id [BP+0Ah]; start [BP+8]; count [BP+6]: Byte)` — name from "Start range error in Load24x24Set" (cs:C). **Changed vs Pool C000:0022 (0.84): takes the record id and the frame count and copies `count` frames** (Pool loaded record 1 and copied all). Callers: PrepareBattlefield (`('DungCom', 1, 0, 19h)`, `('WildCom', 1, 0, 21h)`, `('RandCom', 1, 22h, 6)` — pushes 3300:1059/1078/1095), RuneWheelCheck (`('tiles', 1, 0, 1Ah)`, `('tiles', 2, 1Ah, 16h)`). `RETF 0Ah`.
```pascal
if start > $30 then begin RestorePreviousVideoMode; WriteLn('Start range error in Load24x24Set'); TerminateGame end;   { 7200:0035 .. 006b }
tmp := nil; LoadPicture(name, id, 0, 0, var tmp);                           { 7200:007a }
if tile_Set <> nil then Move(tmp^.pixels, tile_Set^.pixels[start * frameSize], count * frameSize);   { 7200:00b7 / 00c0 }
FreePicture(tmp); FlushGameKeys;                                            { 7200:00e3 / 00ee }
```
### 7200:00F9 DrawTile24 (H) — stub ov33 e3
`procedure DrawTile24(col [BP+0Ch], row [BP+0Ah]: ShortInt; tile [BP+8], flags [BP+6]: Byte)` — tile < 80h -> `DrawPictureInto(col, row, tile, flags, tile_Set, view_Pic)` { 7200:014f }, else frame `tile and 7Fh` of `tile_Set2` { 7200:0126 }. Pool: C000:00F1 (the 4th argument is now passed on as the flags).
### 7200:015A FreeCombatIcon (H) — stub ov33 e4
`procedure FreeCombatIcon(slot [BP+6]: Byte)` — frees `icon_Pic[slot*8]` and `icon_Pic[slot*8+4]` if set { 7200:0186 / 01b1 }. Pool: C000:014E.
### 7200:01D4 LoadCombatIcon (H) — stub ov33 e5
`procedure LoadCombatIcon(name: string [BP+0Ah]; id [BP+8]: Byte; slot [BP+6]: Byte)` — callers: LOAD MONSTER (`('CPIC', pic, slot)`), ov14/ov10. Pool: C000:01C8 (0.93).
```pascal
if (Copy(name,1,5) = 'CHEAD') or (Copy(name,1,5) = 'CBODY') then begin   { 7200:01db / 0208 / 0214 / 022d }
  if UpCase(name[Length(name)]) = 'T' then id := id + $40;           { 7200:023c }
  name := Copy(name, 1, Length(name) - 1);                            { 7200:0256 }
  LoadPicture(name, id, 1, 0, var icon_Pic[slot*8]);                       { 7200:02a3 }
  LoadPicture(name, id + $80, 1, 0, var icon_Pic[slot*8+4]);               { 7200:02df }
end else if (name = 'COMSPR') or (name = 'ICON') then begin           { 7200:0307 / 0319 }
  LoadPicture(name, id, 1, 0, …); LoadPicture(name, id + $80, 1, 0, …);   { 7200:034f / 038b }
  if name = 'ICON' then begin RecolorPicture(@g_0B1E, @g_0B3E, 0, 0, icon); … end;   { 7200:03b0 / 03c2 / 03ea  13 -> 0 }
end else begin                                                        { monster icons: name + data set }
  LoadPicture(name + Str(DataSet), id, 1, 0, var icon_Pic[slot*8]); RecolorPicture(@g_0B1E, @g_0B2E, 0, 0, …);   { 7200:044c / 046c }
  LoadPicture(name + Str(DataSet), id + $80, 1, 0, var icon_Pic[slot*8+4]); RecolorPicture(…);   { 7200:04b0 / 04d5 }
end;
FlushGameKeys;                                                        { 7200:04fd }
```
**Delta (H, image bytes):** `g_0B2E` is the identity table (0..15) — the monster-icon recolouring is a no-op in Curse (Pool's `g_0CE2` mapped 13 -> 8); `g_0B3E` maps 13 -> 0 as Pool's `g_0CF2`.
### 7200:0508 DrawIconAt (H) — stub ov33 e6
`procedure DrawIconAt(col [BP+0Eh], row [BP+0Ch]: ShortInt; dir [BP+0Ah], pose [BP+8], slot [BP+6]: Byte)` — copies `icon_Pic[slot*8 + pose*4]` into a temporary (`AllocPicture(h, w, 1, 1, var tmp)` { 7200:056d }); `dir < 4` -> copy pixels and mask { 7200:05be / 05dc }, else `MirrorPicture(tmp, icon)` { 7200:059e }; `DrawPicture(col*3, row*3, 0, 1, tmp, view_Pic)` { 7200:0609 }; `FreePicture(tmp)` { 7200:0613 }. Pool: C000:04FC (0.98).
### 7200:0000 ov33_LoadDeps (touches ov34) · 7200:061E ov33_init empty.

---

## ov31 (6F00) — combat line of sight and target list (Pool ov30 B600)

Combat terrain bytes (`g_26A2`, 4 per tile: +0 movement cost (1 / FFh impassable), +1 height, +2 obstacle height (2 for walls, 0 for floor), +3 frame in the combat tile set — image data, first 16 tiles `(1,0,FF,0) (FF,1,2,0) (FF,1,2,1) … (1,1,0,4)…`, H). Combatant table `cb_Col/cb_Row/cb_Index/cb_Size` = g_66A3..g_66A6[n*4], n = 1..`cb_Size[0]` (count in entry 0, as Pool's g_5F27..5F2A). Target list base g_6E94: entry n (1..`tg_Count` = g_6E96) at `g_6E94 + 3n`: +0 combatant index, +1 distance, +2 direction code.
`TLine` record (word fields): +0 x0, +2 y0, +4 x1, +6 y1, +8 err, +0Ah |dx|, +0Ch |dy|, +0Eh incDiag, +10h incStraight; bytes +12h sx, +13h sy; words +14h x, +16h y; bytes +18h dist (straight step 2, diagonal 3), +19h last step direction. Pool: B600 (TLine identical).

### 6F00:0007 Sign (H)
`function Sign(n [BP+6]: Integer): Integer` = -1 / 0 / 1 { 6f00:0007 }. Pool: B600:0000 (1.00).
### 6F00:0035 SortTargets (H)
Exchange sort of `tg_List[1..tg_Count]` by distance ascending; for equal distance the lower direction code wins when its parity is not greater { 6f00:0045 .. }, 3-byte swaps with `@CopyBytes` { 6f00:00c2 / 00e0 / 00fe }. Pool: B600:002E (Ghidra split the loop into `FUN_6f00_005d/018e/0199` — one routine, 6f00:0035..019c).
### 6F00:019D LineInit (H)
`procedure LineInit(var L: TLine [BP+6])` — `L.x := L.x0; L.y := L.y0; L.adx := |x1-x0|; L.ady := |y1-y0|; L.sx := Sign(x1-x0); L.sy := Sign(y1-y0); L.err := 0; L.dist := 0` { 6f00:01a0 .. 0243; Sign calls 6f00:020b / 0225 }. **Delta vs Pool B600:01A0 (0.85): `err`, `incDiag`, `incStraight` are not pre-computed here; LineStep does the Bresenham arithmetic itself.**
### 6F00:0246 LineStep (H)
`function LineStep(var L: TLine [BP+6]): Boolean` — one step towards (x1, y1); false when already there. Pool: B600:02CC (0.86) — same effect, different arithmetic:
```pascal
ox := 1; oy := 1; LineStep := false;                                   { 6f00:024c  (1 = no step: table index below) }
if L.adx < L.ady then begin                                            { 6f00:0261  y-major }
  if L.y <> L.y1 then begin
    L.y := L.y + L.sy; oy := L.sy + 1; L.err := L.err + 2*L.adx; L.dist := L.dist + 2;   { 6f00:0274 .. }
    if L.err >= L.ady then begin L.err := L.err - 2*L.ady; L.x := L.x + L.sx; ox := L.sx + 1; L.dist := L.dist + 1 end;
    LineStep := true;
  end
end else if L.x <> L.x1 then begin                                     { x-major, axes exchanged }
  L.x := L.x + L.sx; ox := L.sx + 1; L.err := L.err + 2*L.ady; L.dist := L.dist + 2;
  if L.err >= L.adx then begin L.err := L.err - 2*L.adx; L.y := L.y + L.sy; oy := L.sy + 1; L.dist := L.dist + 1 end;
  LineStep := true;
end;
L.dir := g_2558[oy*3 + ox];                                            { 6f00:03c3  g_2558 = 7,0,1,6,8,2,5,4,3 (image, as Pool's g_25C0) }
```
### 6F00:03EA TraceLine (H)
`function TraceLine(x0 [BP+18h], y0 [BP+16h]: ShortInt; var x1 [BP+12h], y1 [BP+0Eh]: ShortInt; var range [BP+0Ah]: Word; map: ^TCombatMap [BP+6]): Boolean` — Pascal order as Pool (push order at 6f00:0acf: ac[k], ar[k], @x, @y, @range, map). Body: `L := (x0,y0)->(x1,y1); LineInit(L)` { 6f00:0424 }; height line `H` from the start tile's height to `Max(adx, ady)` { 6f00:049e } (both ends from the start tile, as compiled in Pool too); `while ((map^[6] <> 0) or (obstacle[grid[L.y,L.x]] <= H.y)) and (L.dist <= range*2 + 1) do begin LineStep(H); if not LineStep(L) then begin range := L.dist; exit(true) end end` { 6f00:04b4 .. 0519 }; else `x1 := L.x; y1 := L.y; range := L.dist; TraceLine := false` { 6f00:0522 }. Pool: B600:0422 (0.86).
### 6F00:054A InFrontArc (H)
`function InFrontArc(sx [BP+0Eh], sy [BP+0Ch], tx [BP+0Ah], ty [BP+8]: ShortInt; dir [BP+6]: Byte): Boolean` — order as Pool (pushes 6f00:0a7c: ac[k], ar[k], tc[m], tr[m], dir); false if either point is outside 50x25 { 6f00:0550 }; dir FFh -> 8 { 6f00:0580 }; `(fx, fy) := (sx, sy) + step[dir]` { 6f00:0587 }; true if target = source or = the square in front, else the eight quadrant cases per direction { 6f00:05c5 .. 08d6 }, dir 8 -> true. Pool: B600:057B (0.97, same cases).
### 6F00:08E3 BuildTargetList (H) — stub ov31 e8
`procedure BuildTargetList(col [BP+12h], row [BP+10h]: ShortInt; range [BP+0Eh]: Word; dir [BP+0Ch], size [BP+0Ah]: Byte; map: ^TCombatMap [BP+6])` — order as Pool (Ghidra param_1/2 = map = `[BP+6]`, param_3 = size, param_4 = dir, param_5 = range, param_6 = row, param_7 = col). Pool: B600:0909 (0.92):
```pascal
for k := 0 to 3 do if FootprintCell(size, k, dx, dy) then begin ac[k] := col + dx; ar[k] := row + dy end else ac[k] := -1;   { 6f00:08f2  FootprintCell = FootprintCell }
tg_Count := 0;                                                        { 6f00:0955 }
for n := 1 to cb_Size[0] do if cb_Size[n] <> 0 then begin             { 6f00:0965 }
  found := false; best := $FF;
  for m := 0 to 3 do target footprint cells tc[m], tr[m] of combatant n;   { 6f00:0994 }
  for m := 0 to 3 do if tc[m] >= 0 then for k := 0 to 3 do if ac[k] >= 0 then
    if InFrontArc(ac[k], ar[k], tc[m], tr[m], dir) then begin           { 6f00:0a4b }
      x := tc[m]; y := tr[m]; d := range;
      if TraceLine(ac[k], ar[k], x, y, d, map) and (d < best) then begin found := true; best := d; bk := k; bm := m end;   { 6f00:0aa3 }
    end;
  if found then begin
    tg_Count := tg_Count + 1; tg_List[tg_Count].who := n; tg_List[tg_Count].dist := best;   { 6f00:0b0f .. }
    if dir < 8 then d := dir else begin d := 0; while not InFrontArc(ac[bk], ar[bk], tc[bm], tr[bm], d) do d := d + 1 end;   { 6f00:0b4b }
    tg_List[tg_Count].dir := d;
  end;
end;
SortTargets;                                                          { 6f00:0ba6 }
```
### 6F00:0000 ov31_0000 empty · 6F00:0BB0 ov31_init empty.

---

## ov14 (3F00) — party movement, doors, the 3D command loop (Pool ov14 6600)

Door globals `door_CanBash/CanPick/CanKnock` g_7588/7589/758A (re-armed to 1 by StepForward3D). `view_Mode = 4` = 3D area; **there is no overland branch in Curse** (Pool's travel modes 2..4 are absent: ExploreCommand and MoveParty only act when `view_Mode = 4`). Roll = Roll(count, sides).

### 3F00:0000 ov14_LoadDeps (M) — touches ov23, ov24, ov19, ov28, ov16, ov33, ov29, ov20, ov34, ov26, ov25 { 3f00:0003 .. 0035 }.
### 3F00:003E ClosePassage (H) — **empty** (`RETF 6` at 3f00:0046; takes (x, y, dir) like OpenPassage). Pool 6600:0000 cleared the door's 2-bit field; in Curse a locked door with no possible action is left as it is (the party just does not move).
### 3F00:0153 OpenPassage (H)
`procedure OpenPassage(x [BP+0Ah], y [BP+8]: ShortInt; dir [BP+6]: Byte)` — if 0 <= x,y <= 15: set the dir's door field of plane 3 to 1 (`and 3Fh or 40h` for 6, `and CFh or 10h` for 4, `and F3h or 04h` for 2, `and FCh or 01h` for 0) { 3f00:016e .. 0284 }. Pool: 6600:0109 (0.96).
### 3F00:0288 PartyHasClass (H)
`function PartyHasClass(cls [BP+6]: Byte): Boolean` — true if some member has `c^.level[cls] > 0` (`+109h+cls`) or (`c^.prevLevel[cls] > 0` (`+111h+cls`) and `DualClassActive(c)`) { 3f00:02b3 / 02c4 / 02d4 }. **Delta vs Pool 6600:0236: the previous-class levels count when the character's dual-class condition holds** (DualClassActive = `CurrentClassLevel(c) > c+E6h`, a level comparison, PARTY lane).
### 3F00:0302 BashDoor (H)
`function BashDoor: Boolean` — Pool 6600:0294 (0.76): the same STR tables with the Curse fields `+11h` (str) / `+1Ch` (str_exc):
```pascal
ok := false; c := PartyHead;
while (c <> nil) and not ok do begin
  if GetPassage(party_MapX, party_MapY, party_Dir) = 3 then            { 3f00:0335  wizard-locked }
    case c^.str of
      18: if c^.str_exc in [91..99] then ok := Roll(1,6) = 1           { 3f00:036e }
          else if c^.str_exc = 100 then ok := Roll(1,6) < 3            { 3f00:0388 }
          else door_CanBash := 0;
      19, 20: ok := Roll(1,6) < 4;  21, 22: ok := Roll(1,6) < 5;  23: ok := Roll(1,6) < 6;   { 3f00:03af / 03ce / 03e8 }
      24: ok := Roll(1,8) < 8;  25: ok := true;                        { 3f00:0402 }
    else door_CanBash := 0 end
  else
    case c^.str of
      3..7: ok := Roll(1,6) = 1;  8..15: ok := Roll(1,6) < 3;  16, 17: ok := Roll(1,6) < 4;   { 3f00:043d / 045d / 047d }
      18: if c^.str_exc < 51 then ok := Roll(1,6) < 4 else if c^.str_exc < 100 then ok := Roll(1,6) < 5 else ok := Roll(1,6) < 6;   { 3f00:04ab / 04ca / 04e4 }
      19, 20: ok := Roll(1,8) < 8;                                              { 3f00:0503 / 0512  NEW: giant-strength rows for ordinary locks }
      21: ok := Roll(1,10) < 10;                                                { 3f00:051d / 052c }
      22, 23: ok := Roll(1,12) < 12;                                            { 3f00:053c / 054b }
      24: ok := Roll(1,20) < 20;                                                { 3f00:0556 / 0565 }
      25: ok := true;                                                           { 3f00:0587 }
    end;
  c := c^.next;
end;
if ok then begin OpenPassage(party_MapX, party_MapY, party_Dir); OpenPassage(party_MapX + dx[party_Dir], party_MapY + dy[party_Dir], (party_Dir+4) mod 8) end;   { 3f00:058d / 059d }
BashDoor := ok;
```
### 3F00:05E8 PickLock (H)
`function PickLock: Boolean` — for each member until success: `if (Roll(1,100) <= c^.thief_skill[1]) (+EBh) and (c^.status = 0) (+195h) then ok := true` { 3f00:061b }; `door_CanPick := 0` { 3f00:0646 }; if ok open both sides { 3f00:0663 / 06a1 }. Pool: 6600:04DF (0.95).
### 3F00:06B1 FindMemorizedSpell (H)
`function FindMemorizedSpell(spell [BP+0Ah]: Byte; c: ^TChar [BP+6]): Byte` — slot 0..83 of `c^.mem_spell[]` (`+1Eh..+71h`) equal to `spell`, else FFh { 3f00:06bb .. 06e7 } (Pool: 21 slots at +17h, same order).
### 3F00:06F4 FindCasterOf (H) — first member with `FindMemorizedSpell(spell, c) <> FFh`, else nil { 3f00:0719 }.
### 3F00:0749 CastKnock (H) — `c := FindCasterOf($1F)` { 3f00:0753 }; if found `c^.mem_spell[FindMemorizedSpell($1F, c)] := 0` { 3f00:076e / 0776 } and return true. Pool: 6600:0648 (1.00).
### 3F00:078E TryWalkOffMap (M)
`Mem[7ED5] := 0` { 3f00:07a2 }; if `GetPassage(party_MapX, party_MapY, party_Dir) <> 0` { 3f00:07c1 } and the square ahead lies outside 0..15: clamp the position to the edge and `Mem[7ED5] := 1` { 3f00:07d8 .. 0826 }. Pool: 6600:068D (1.00; `Mem[7ED5]` = Pool's 6DD5, region 1 +5AAh).
### 3F00:083C StepForward3D (H)
```pascal
PlayOrStopSound(snd_Step);  Delay(50);                       { 3f00:083f / 0848  NEW: Crt.Delay(50 ms) after the step sound }
party_MapX := party_MapX + dx[party_Dir];  party_MapY := party_MapY + dy[party_Dir];   { 3f00:0851 / 0860 }
wrap party_MapX, party_MapY into 0..15;                    { 3f00:086f }
party_Ahead := GetWallType(party_MapX, party_MapY, party_Dir);   { 3f00:089f }
FillChar(door_CanBash, 3, 1);                              { 3f00:08b3  re-arm Bash/Pick/Knock }
party_CellAttr := GetCellAttr(party_MapX, party_MapY);     { 3f00:08c4 }
if Mem[7ECA] and 1 = 0 then AdvanceClock(1, 1)            { 3f00:08f1 }
else AdvanceClock(1, 2);                                   { 3f00:08e4  Search mode costs more (count 1, unit 2) }
```
Pool: 6600:073B (0.97).
### 3F00:090A ExploreCommand (H) — stub ov14 e2
`function ExploreCommand: Char` — the command prompt of 3D areas; returns the last key. Pool: 6600:0989 (0.73) — the overland branch is gone, the 'A' key has a debug override, cast/view/encamp set `menu_Sel := 1`.
```pascal
Mem[7EC9] := 0;                                                      { 3f00:0911 }
if view_Mode = 4 then                                                { 3f00:091c }
  repeat
    key := HorizontalMenu('', 'Area Cast View Encamp Search Look', $0D, $0A, $0F, true, false, ext);   { 3f00:092a  options = DS:03D6 }
    if not ext then case key of
      'A': if (Mem[4BFB] = 0) or (ParamStr(2) = CopyProtWord) then begin     { 3f00:0963 / 0976 / 0991  NEW: a second command-line word (g_8C80, set at startup) unlocks the area map everywhere }
             view_AreaMap := not view_AreaMap; Draw3DView(party_MapX, party_MapY, party_Dir)   { 3f00:099e / 09ad }
           end else ShowTimedBottomPrompt('Not Here', $0E, 0);         { 3f00:09c4  fg 0Eh, bg 0 }
      'C': if SelectedChar^.status = 0 then begin menu_Sel := 1; CastMenu end;   { 3f00:09ee / 09e7  cast menu (MAGIC) }
      'V': begin menu_Sel := 1; ViewMenu(var local) end;              { 3f00:09f7 / 09fc  view character (COMBAT lane unit) }
      'E': begin done := true; menu_Sel := 1 end;                      { 3f00:0a12 }
      'S': Mem[7ECA] := Mem[7ECA] xor 1;                               { 3f00:0a2d  Search on/off }
      'L': begin Mem[7ECA] := Mem[7ECA] or 2; AdvanceClock(1, 2); ecl_PC := ecl_VecB; done := true end;   { 3f00:0a31 / 0a46 / 0a51 }
    end else case key of
      #$48 {Up}:    begin TryWalkOffMap; done := true end;             { 3f00:0a65 }
      #$50 {Down}:  begin party_Dir := (party_Dir+4) mod 8; party_Ahead := GetWallType(…); Draw3DView(…) end;   { 3f00:0a74 / 0a86 / 0a9a }
      #$4B {Left}:  begin party_Dir := (party_Dir+6) mod 8; PlayOrStopSound(snd_Step); party_Ahead := …; Draw3DView(…) end;   { 3f00:0ab2 / 0ac4 / 0acd / 0ae1 }
      #$4D {Right}: begin party_Dir := (party_Dir+2) mod 8; PlayOrStopSound(snd_Step); …; Draw3DView(…) end;   { 3f00:0af8 / 0b0a / 0b13 / 0b27 }
    else begin CycleSelectedChar(key); PartySummary(SelectedChar) end end;     { 3f00:0b3a / 0b43  select a member by key, redraw the roster }
    DrawLocationTimeStatus;                                                         { 3f00:0b50  status line }
  until done;
if text_Cleared = 0 then begin ClearRectangle(1, $11, $26, $16); text_Cleared := 1 end;   { 3f00:0b64 / 0b6b }
ExploreCommand := key;
```
### 3F00:0BAF MoveParty (H) — stub ov14 e1
Pool: 6600:0D6D (0.96). `view_Redraw := 1` is set first { 3f00:0bc8 }; no overland branch; otherwise Pool's door logic:
```pascal
if view_Mode = 4 then
  if Mem[7EC9] < $FF then begin                                      { 3f00:0bba }
    view_Redraw := 1; moved := false;
    case GetPassage(party_MapX, party_MapY, party_Dir) of             { 3f00:0bd9 }
      1: moved := true;
      2: begin opts := ''; if door_CanBash <> 0 then opts := 'Bash';   { 3f00:0c0b }
           if (door_CanPick <> 0) and PartyHasClass(6) then opts := opts + ' Pick';   { 3f00:0c1e / 0c25 }
           if (door_CanKnock <> 0) and (FindCasterOf($1F) <> nil) then opts := opts + ' Knock';   { 3f00:0c58 / 0c5f }
           opts := opts + ' Exit';
           if opts = ' Exit' then ClosePassage(party_MapX, party_MapY, party_Dir)   { 3f00:0c92 / 0ccb  (empty routine) }
           else case HorizontalMenu('Locked. ', opts, $0D, $0A, $0F, false, false, ext) of   { 3f00:0cdd }
             'B': moved := BashDoor; 'P': moved := PickLock; 'K': moved := CastKnock end;   { 3f00:0d14 / 0d21 / 0d2e }
         end;
      3: same menu (Knock when a caster has it) { 3f00:0d65 / 0d9f / 0e1d }; 'B' -> BashDoor { 3f00:0e55 }; 'P' -> door_CanPick := 0 { 3f00:0e5f }; 'K' -> CastKnock { 3f00:0e6d }; none -> ClosePassage { 3f00:0e18 };
    end;
    if moved then StepForward3D;                                      { 3f00:0e79 }
    DrawLocationTimeStatus;                                                        { 3f00:0e7d }
  end else Mem[7EC9] := 0;
FreeAnimation(enc_Anim); FreePicture(head_Pic); FreePicture(body_Pic); head_Id := $FF; body_Id := $FF;   { 3f00:0e8f / 0e99 / 0ea3 / 0eb2 }
```
**Delta vs Pool:** no bump sound on a blocked move; `ClosePassage` is a no-op; wizard-locked doors do not require a magic-user for Knock (the `PartyHasClass(5)` test is gone: both door states use `FindCasterOf($1F)`, 3f00:0da3).
### 3F00:0EBB ov14_init empty.

---

## ov32 (7000) — combat map window, occupancy, combatant placement (Pool ov31 BB00)

The combat screen shows a 7x7-square window of the 50x25 battlefield (24x24-px tiles = 3x3 text cells); window origin `cm_Map^[2]` (column) / `cm_Map^[3]` (row); `cm_Map^[4]` = cursor visible, `cm_Map^[5]` = cursor size. Footprint table `g_27A2[size*8 + k*2]` (image: size 1 {(0,0)}, 2 {(0,0),(0,1)}, 3 {(0,0),(1,0)}, 4 {(0,0),(1,0),(0,1),(1,1)}, dx < 0 = unused — identical to Pool's g_2844, H). Icon slot = `c+143h`; slot 19h = the cursor. Corpse list `g_6E52 + 7n` (n = 1..8, count `g_6E91`): +0 character far ptr, +4 col, +5 row, +6 old tile.

### 7000:0011 FootprintCell (H) — stub ov32 e2
`function FootprintCell(size [BP+10h], k [BP+0Eh]: Byte; var dx [BP+0Ah], dy [BP+6]: ShortInt): Boolean` — order as Pool (Ghidra param_1 = `@dy` = the last push); size 0 -> false; `dx := g_27A2[size*8 + k*2]; dy := g_27A3[…]`; result `dx >= 0` { 7000:0011 .. 0076 }. Pool: BB00:0000 (1.00).
### 7000:0079 UpdateScreenPositions (H) — for n := 1..cb_Size[0]: `cb_ScrCol[n] := cb_Col[n] - cm_Map^[2]; cb_ScrRow[n] := cb_Row[n] - cm_Map^[3]` { 7000:0079 }. Pool: BB00:0068.
### 7000:00F4 PaletteFlashOn (M) / 7000:0134 PaletteFlashOff (M)
EGA (`VideoMode = 1`): `SetEgaPaletteRegister(8, 0); SetEgaPaletteRegister(0, 8)` resp. `(0,0); (8,8)` { 7000:0104 / 010f ; 0144 / 014f }; **Tandy (`VideoMode = 2`, new): the same through `SetEgaPaletteRegisterRaw`** { 7000:0120 / 012b ; 0160 / 016b }. Pool: BB00:00E3/0105.
### 7000:0174 RedrawCell (H)
`procedure RedrawCell(col [BP+8], row [BP+6]: ShortInt)` — for each cursor footprint cell inside the window: `DrawTile24(sc*3, sr*3, g_26A5[grid*4], 0)` { 7000:0251 } and, if the cursor is visible, `DrawIconAt(sc, sr, 0, 0, $19)` { 7000:0284 }; then `CellAt(col, row, occupant, tile)` { 7000:02a5 }, `IsVisible(c, false)` { 7000:02c5 } and `DrawIconAt(scrCol, scrRow, c^.combatant^[9], 0, c^.iconSlot)` { 7000:0315 }. Pool: BB00:0127 (0.98).
### 7000:0320 RedrawSquare (H)
`RestoreTerrain(col - left, row - top, 0)` { 7000:035a  pushes: col delta, row delta, 0 }, then the occupant as above { 7000:0370 / 0390 / 03e0 }. Pool: BB00:02D5.
### 7000:03EB RebuildOccupancy (H) — stub ov32 e8
`FillChar(cm_Occupant, 4E2h, 0)` { 7000:03f9 }; for every combatant with size <> 0: mark its footprint cells with n { 7000:0457 .. }; update its screen position. Pool: BB00:03A0 (0.98).
### 7000:0509 CellAt (H)
`procedure CellAt(col [BP+10h], row [BP+0Eh]: ShortInt; var occupant [BP+0Ah], tile [BP+6]: Byte)` — outside 50x25 -> both 0; else `tile := cm_Map^.grid[row, col]; occupant := cm_Occupant[row*50 + col]` { 7000:0509 .. 0575 }.
### 7000:0578 RestoreTerrain (H)
`procedure RestoreTerrain(scol [BP+0Ah], srow [BP+8]: ShortInt; who [BP+6]: Byte)` — who = 0: occupant of the screen cell via CellAt { 7000:05bf }; still 0 -> redraw that tile if inside the window { 7000:0662 / 06c8 }; else every footprint cell of combatant `who` { 7000:063d / 06e1 / 0727 }. Pool: BB00:052B (0.98).
### 7000:0732 InWindow (H) := both in 0..6 { 7000:0732 }. Pool: BB00:06E9.
### 7000:0763 IsVisible (H)
`function IsVisible(c: ^TChar [BP+8]; all [BP+6]: Boolean): Boolean` — n := CombatantIndex(c) { 7000:0774 }; size 0 -> false; `all` -> every footprint cell inside the window, else any { 7000:07bb / 07ed }. Pool: BB00:071A.
### 7000:081D ScrollToShow (H)
`function ScrollToShow(col [BP+0Ah], row [BP+8]: ShortInt; margin [BP+6]: Byte): Boolean` — centre := origin + 3; if margin = FFh or the target is farther than `margin` from the centre: move the centre towards it (column 3..46, row 3..21), set the origin, redraw the 7x7 tiles `DrawTile24(c*3, r*3, frame, 0)` { 7000:09af }, UpdateScreenPositions { 7000:09cf }, true. Pool: BB00:07D4 (0.98).
### 7000:09DF FocusSquare (H)
`procedure FocusSquare(col [BP+0Ch], row [BP+0Ah]: ShortInt; margin [BP+8], dir [BP+6]: Byte)` — target := (col,row) + step[dir] (dir 8 = none); `if ScrollToShow(target, margin)` { 7000:0a20 } then draw every active (`+196h`) visible combatant { 7000:0a80 / 0ab8 }; RedrawSquare(row, col) { 7000:0ad1 }; clamp the target to the field if outside the window { 7000:0af9 }; RedrawCell { 7000:0b31 }; FlushViewDirtyLines { 7000:0b34 }. Pool: BB00:0996 (0.97).
### 7000:0B3F ShowCombatant (H) — stub ov32 e11
`procedure ShowCombatant(c: ^TChar [BP+0Ch]; dir [BP+0Ah], pose [BP+8]: Byte; noDraw [BP+6]: Boolean)` — if not fully visible (`IsVisible(c, true)` { 7000:0b5c }) **and `combat_Visible` (g_75E6)**: FocusSquare(col, row, 3, 8) { 7000:0b87 }; if the facing half changes (`dir div 4`) or pose/noDraw set, and g_75E6: RestoreTerrain(0, 0, n) { 7000:0bcd }; `c^.combatant^[9] := dir`; unless noDraw: if visible and g_75E6: DrawIconAt(scrCol, scrRow, dir, pose, slot) { 7000:0c26 } + Flush. Pool: BB00:0AF8 (0.93) — **new: the `g_75E6` gate (combat display on/off, M)**.
### 7000:0C36 CombatantCol / 0C5E CombatantRow / 0C86 CombatantSize (H) — `cb_Col/Row/Size[CombatantIndex(c)]` { 7000:0c43 / 0c6b / 0c93 }.
### 7000:0CAE CombatantIndex (H) — linear search of `cb_Char[1..cb_Size[0]]`; 0 if absent { 7000:0cae }.
### 7000:0D06 ProbeMove (H) — stub ov32 e19
`procedure ProbeMove(c: ^TChar [BP+12h]; dir [BP+10h]: Byte; var occupant [BP+0Ch], tile [BP+8], flag1E [BP+6]?, …)` — pushes at 3300:1307 `c, 8, @a, @b, @d, @e`: `(c, dir, var occupant, var tile, var hit1E, var hit1C)`; `tile := 17h; occupant := 0`; for each footprint cell of c moved one step in `dir` (8 = in place): CellAt { 7000:0de0 }; another occupant is reported; tile result: 0 if any cell is 0 (off-map), else the tile with the highest cost; **new: tiles 1Eh and 1Ch set the two extra flags instead of being reported as the tile** { 7000:0e2c .. 0e5a }. Pool: BB00:0CB9 (0.90).
### 7000:0E75 RemoveCombatant (H) — stub ov32 e20
`procedure RemoveCombatant(c: ^TChar [BP+6])` — in combat (`view_Mode = 5`) and not already in the corpse list (indexed by `local_5`, uninitialised at the first test — the Pool bug is still here, 7000:0e85): make it visible (`FocusSquare(col, row, 3, 8)` { 7000:0f0e }), RestoreTerrain { 7000:0f1c }, `PlayOrStopSound(g_25B6)` { 7000:0f23 }, animate the fall: 9 frames alternating `fallen_Pic[frame mod 2]` drawn with `DrawPicture(scrCol*3, scrRow*3, 0, 5, pic, view_Pic)` over the footprint { 7000:0ff1 } with `Delay(10)` { 7000:1008 } (**new: a two-picture death animation**); unless an extra (`combatant^[13h]`): append to the corpse list (old tile, position) and set the grid tile to 1Fh unless 1Eh { 7000:1035 .. }; MessageDelay { 7000:10d0 }; RestoreTerrain { 7000:10e0 }; `cb_Size[n] := 0`; RebuildOccupancy { 7000:10fb }; recentre `FocusSquare(left+3, top+3, 3, 8)` { 7000:111f }; clear combatant fields 0, 3, 6, 7. Outside combat: sound + MessageDelay. Pool: BB00:0E11 (0.80; Pool set the sound timer mode and drew one picture).
### 7000:115B PlaceCombatant (H) — stub ov32 e21
`function PlaceCombatant(c: ^TChar [BP+0Ch]; col [BP+0Ah], row [BP+8]: Byte; restoreTile [BP+6]: Boolean): Boolean` — in combat: `cb_Size[n] := c+DEh and 7Fh` (Pool +6Ch), position { 7000:117f .. }; ProbeMove(c, 8, …) { 7000:11d9 }; placed if no other occupant and the tile is passable (`g_26A2[tile*4] <> FFh`); with `restoreTile` and not an extra: remove c from the corpse list (restoring its tile unless 1Fh) and put the tile back if no other corpse lies there { 7000:1222 .. 1310 }; RebuildOccupancy { 7000:1343 }; else `cb_Size := 0`. Outside combat -> true. Pool: BB00:10A7 (0.97).
### 7000:1355 FocusCombatant (H) — stub ov32 e22
`procedure FocusCombatant(c: ^TChar [BP+0Ah]; margin [BP+8]: Byte; cursor [BP+6]: Boolean)` — `cm_Map^[4] := cursor; cm_Map^[5] := CombatantSize(c)`; **if g_75E6:** FocusSquare(col, row, margin, 8) { 7000:13a6 }; then `cm_Map^[4] := 0; cm_Map^[5] := 1`. Pool: BB00:1298.
### 7000:0000 ov32_LoadDeps (touches ov33, ov34) · 7000:13C1 ov32_init empty.

---

## ov26 (6800) — menus and keyboard input (Pool ov25 9D00)

`TMenuItem` (46 = 2Eh bytes): +0 text string[40], +29h `isHeader`, +2Ah next. Menu globals: `menu_Sel` g_7294 (1-based), `menu_Ext` g_7295, `menu_Timeout` g_7296/g_7298 (longint hundredths, <= 0 = none), `menu_TimeoutKey` g_729A, `menu_Top` g_7292.

### 6800:0011 ListItem (H) — `function ListItem(list [BP+8]; n [BP+6]: Integer): ^TMenuItem` (pushes 6800:08c4: list, n) { 6800:0011 }. 6800:0074 ListCount (H) { 6800:0074 }. Pool: 9D00:0000 / 0067 (0.84).
### 6800:00D5 ParseOptions (H) *nested in HorizontalMenu* — splits the options string at every character in the set cs:00B5 (`['0'..'9','A'..'Z']`, as Pool) into `optStart[k]/optEnd[k]`, `optCount` at `[BP-8Eh]` { 6800:00e8 .. 01cb }. Pool: 9D00:00CB (0.98).
### 6800:01E5 DrawOptions (H) *nested* — draws the option letters on row 24 after the prompt (hot letters in `hotColour [BP+0Eh]`, others `textColour [BP+10h]`, the selected option highlighted) { 6800:0281 / 02db / 0319 }, clears the rest of the line { 6800:0389 }. Pool: 9D00:01DA (0.98).
### 6800:03D4 HorizontalMenu (H) — stub ov26 e3
`function HorizontalMenu(prompt [BP+18h], options [BP+14h]: string[40]; promptColour [BP+12h], textColour [BP+10h], hotColour [BP+0Eh]: Byte; allowExt [BP+0Ch], animate [BP+0Ah]: Boolean; var ext: Boolean [BP+6]): Char` — `RETF 16h`. Pool: 9D00:03BD (0.89) — **changed: (1) when a 2D area shows BIGPIC 121 the ov27 overlay animation runs while waiting (two timers, 1Eh and 32h hundredths); (2) the encounter picture is drawn through `DrawPictureScreenOrView(3, 3, animate, frame)`; (3) `menu_Sel` is kept across calls (reset to 1 only when it exceeds the option count).**
```pascal
menu_Ext := false;  haveOpts := (textColour <> 0) or (hotColour <> 0);   { 6800:03ee }
ParseOptions(options);                                                  { 6800:0422 }
if menu_Sel > optCount then menu_Sel := 1;                              { 6800:0426 }
ext := false; done := false;  t0 := TimeInHundredths; tA := t0 + 1Eh; tB := t0 + 50h;   { 6800:0449 / 0454 }
if prompt <> '' then DrawText(0, 24, promptColour, 0, prompt);          { 6800:047c }
DrawOptions(menu_Sel);                                                  { 6800:04a3 }
cityAnim := (view_Mode = 3) and (bigpic_Id = $79) and (anim_Id <> 'P');   { 6800:04a7 }
if cityAnim then begin BigPicAnimSetPos; BigPicAnimPhaseA; BigPicAnimPhaseB end;   { 6800:04bc / 04c1 / 04c6 }
repeat
  if cityAnim and (TimeInHundredths >= tA) then begin BigPicAnimPhaseA; tA := tB + 1Eh end;   { 6800:04e0 / 04f1 }
  if ((Mem[4CFF] <> 0) or animate) and (enc_Anim.cur <> 0) then begin   { 6800:04f6  animate the encounter picture }
    DrawPictureScreenOrView(3, 3, animate, enc_Anim.pic[enc_Anim.cur]);   { 6800:0526 }
    if (TimeInHundredths - t0 >= enc_Anim.delay[cur] * k) or (Mem[4CFF] <> 0) then begin   { 6800:054a / 059c }
      Inc(enc_Anim.cur); if enc_Anim.cur > enc_Anim.count then enc_Anim.cur := 1; t0 := TimeInHundredths end;   { 6800:05b7 }
  end;
  if (menu_Timeout > 0) and (TimeInHundredths - t0 >= menu_Timeout) then begin key := menu_TimeoutKey; done := true end   { 6800:0778 }
  else if KeyPressed then begin                                         { 6800:05dd }
    key := ReadGameKey;                                                 { 6800:05e9 }
    case key of
      #0:  begin key := ReadGameKey; if allowExt then begin ext := true; done := true end end;   { 6800:05f7 }
      #27: begin key := #0; done := true end;
      #13: if haveOpts then begin key := options[optStart[menu_Sel]]; if key = #0 then key := #13; done := true end;   { 6800:0630  NEW: Enter returns the selected option's letter }
      ',': begin if menu_Sel = 1 then menu_Sel := optCount else Dec(menu_Sel); DrawOptions(menu_Sel) end;   { 6800:0675 }
      '.': begin if menu_Sel = optCount then menu_Sel := 1 else Inc(menu_Sel); DrawOptions(menu_Sel) end;   { 6800:0699 }
    else
      key := UpCase(key);                                               { 6800:06a0 }
      if key in [' ', '0'..'9', 'A'..'Z'] (set cs:0394) then
        if key = ' ' then done := true
        else for each option o whose start character = key do begin menu_Sel := o; DrawOptions(o); done := true end;   { 6800:0718 }
      if allowExt and (key in set cs:03B4 ['1'..'9', '\']) then begin   { 6800:072b }
        if key = '\' then key := #$37 else key := g_279D[Ord(key)];     { keypad digits -> cursor scan codes }
        ext := true; done := true;
      end;
    end;
  end;
  if cityAnim and (TimeInHundredths >= tB) then begin BigPicAnimPhaseB; tB := tA + 32h end;   { 6800:0789 }
until done;
Mem[4CFF] := 0;  if cityAnim then BigPicAnimPhaseB;  menu_Ext := ext;   { 6800:079f / 07c8 / 07cd }
HorizontalMenu := key;
```
### 6800:07E5 ClearMenuLine (M) — `ClearGlyphRun(0, 24, 0, 40)` { 6800:07f4 }. Pool: 9D00:06FB.
### 6800:07FD LastHeaderAbove (H) *nested* { 6800:07fd }. 6800:088A DrawList (H) *nested* — `ClearRectangle(window)` { 6800:08b0 }, items from `ListItem(list, top)` { 6800:08c4 } row by row in the normal/header colours { 6800:0932 / 0955 }, padded with spaces { 6800:09a4 }. Pool: 9D00:0711 / 07A4.
### 6800:09C4 FirstNonBlank / 6800:0A10 LastNonBlank (H) *nested* (1.00).
### 6800:0A56 DrawItemSelected / 6800:0AF8 DrawItemNormal (H) *nested* — rewrite item n's trimmed text at row `top + n - menu_Top` in the selection colour `[BP+20h]` { 6800:0aed } resp. normal `[BP+22h]` / header `[BP+24h]` { 6800:0b99 / 0bee }. (0.99 / 0.98)
### 6800:0BF9 SkipHeaders / 6800:0CD9 PageList / 6800:0D6B MoveSelection (H) *nested* — as Pool 9D00:0B03 / 0C33 / 0CC5 (0.83 / 1.00 / 0.79): move the index up/down wrapping inside the page and skipping headers; PageList moves `menu_Top` by a page, clamps, SkipHeaders, DrawList { 6800:0d57 / 0d62 }.
### 6800:0DF9 VerticalListMenu (H) — stub ov26 e5
`function VerticalListMenu(prompt [BP+2Ah], options [BP+26h]: string[40]; headerColour [BP+24h], normalColour [BP+22h], selColour [BP+20h]: Byte; left [BP+1Eh], top [BP+1Ch], right [BP+1Ah], bottom [BP+18h]: ShortInt; list [BP+14h]; showExit [BP+12h]: Boolean; var redraw [BP+0Eh]: Boolean; var index [BP+0Ah]: Integer; var item [BP+6]: ^TMenuItem): Char` — `RETF 28h`. Pool: 9D00:0D9A (0.97): same body — nil list -> `#0`; `menu_Sel := 1`; page/count/first-selectable { 6800:0e20 .. 0e65 }; clamp `menu_Top` { 6800:0e92 }; `index := index + 1; MoveSelection(up)` { 6800:0f2b }; DrawList when `redraw` { 6800:0f3d }; loop: DrawItemSelected { 6800:0f4f }, options + ' Next' / ' Prev' / ' Exit' (cs:DE7/DED/DF3), `key := HorizontalMenu(prompt, opts, headerColour, normalColour, selColour, true, false, ext)` { 6800:1036 }, DrawItemNormal { 6800:1044 }, ext 'G'/'O' -> MoveSelection, 'I'/'Q' -> PageList when a page exists { 6800:1059 .. 10b0 }, 'P'/'N' pages; result: Esc/'E'/#0 -> item nil, else `item := ListItem(list, index)` { 6800:10e2 }.
### 6800:112A AskYesNo (H) — stub ov26 e6
`function AskYesNo(prompt [BP+0Ch]: string[40]; c1 [BP+0Ah], c2 [BP+8], c3 [BP+6]: Byte): Char` — `menu_Sel := 2`; repeat `key := HorizontalMenu(prompt, 'Yes No', c1, c2, c3, false, false, ext)` { 6800:1174 } until key in set cs:110A ('N','Y'). Pool: 9D00:10D1 (1.00). Used by PROGRAM 8 ("You've won. Save before quitting? ").
### 6800:1199 NewMenuList (H) — `procedure NewMenuList(var list [BP+8]; n [BP+6]: Integer)` — n nodes of 2Eh bytes, text '', isHeader 0, linked by +2Ah { 6800:11a8 / 1203 }. 6800:1241 FreeMenuList (H) { 6800:1280 }. Pool: 9D00:1140 / 11F3.
### 6800:0000 ov26_LoadDeps (touches ov29, ov34) · 6800:128D ov26_init empty.

---

## ov10 (3300) — combat battlefield construction and party deployment (Pool ov10 5200)

`StartCombat` (3300:1C3E) builds the tactical map `cm_Map^` (g_6E92): GetMem(4E9h) — header bytes +0..+6 and a 25-row x 50-column grid of combat-tile numbers at +7 (`grid[row, col]` = byte `+7 + row*32h + col`). In a 3D area (`Mem[4BE6] <> 0`) the grid is derived from the 16x16 map around the party; in a 2D area it is generated from the terrain class of the current location. Tile numbers index `g_26A2` (4 bytes per tile; `g_26A5[t*4]` = frame, 16h = plain floor). The square-builder state lives in globals here (Pool: parent locals): `sq_dx` g_4A0C, `sq_dy` g_4A0D, `north` g_4A0E, `west` g_4A0F, `east` g_4A10, `south` g_4A11, `cell_Door` g_4A15, `sq_Open` g_4A16, `terrain_Loc` g_4A14; deploy state g_4A04..g_4A12 (`dep_StartX[2]` g_4A04, `dep_StartY[2]` g_4A06, `dep_Half[2]` g_4A08, `dep_Facing[2]` g_4A0A, `dep_Side` g_4A12), deploy boxes `g_47F4[side*108h + tmpl*42h + r*0Bh + c]`.

### 3300:0048 PutCombatTile (H)
`procedure PutCombatTile(col [BP+0Ah], row [BP+8], tile [BP+6]: Byte)` — `c := col + sq_dx*6 + sq_dy*5 + 21; r := row + sq_dy*5 + 10` { 3300:004b / 005d }; inside 50x25 -> `grid[r, c] := tile + 1` { 3300:0097 }. Order as Pool's 5200:0221 (H: Ghidra param_3 = the first push is added to `sq_dx*6`, param_1 = `[BP+6]` is the tile). Each 3D square becomes a 6x5 block skewed by 5 columns per map row (Pool's projection). Pool: 5200:0221 (0.64 — globals instead of parent-frame locals).
### 3300:00CC ScatterFloorDebris (H) — **changed (per square; Pool's ran over the whole field)**
`sq_Open := (one of north/west/east/south = 1 (wall)) and not (opposite walls only) and (no door (3) on any side)` { 3300:00cc .. 0139 } (an open corridor piece, M); for the inner cells (row 2..3, col 2..4) of the current square whose frame is 16h and `cell_Door` (cell attribute bit 40h) and `sq_Open` and `Roll(1,10) < 6` { 3300:019b }: tile 1Ah, then its four neighbours (`g_0349/g_034D` = (10,0),(0,-1),(1,0),(0,1)) each with `Roll(1,10) < 10` -> tile 1Bh { 3300:0250 .. 02be } (rubble around a marked cell; meaning of attribute bit 40h: M).
### 3300:02F6 ProbeSide (H) *nested in ProbeWall*
`function ProbeSide(x [BP+0Ch], y [BP+0Ah]: ShortInt; dir [BP+8]: Byte): Byte` (nested; `[BP+6]` = the frame link) — outside the map: `(y = party_MapY) and (dir in [2, 6])` -> 0 else 1 { 3300:0300 }; `GetPassage(x, y, dir) = 0` -> 1 { 3300:0320 }; `GetWallType(x, y, dir) = 0` -> 0 else 3 { 3300:033b }. Pool: 5200:012B (1.00).
### 3300:0378 ProbeWall (H) = `ProbeSide(x, y, dir) or ProbeSide(x + dx[dir], y + dy[dir], (dir+4) mod 8)` { 3300:039e / 03d4 } (`ProbeWall(x [BP+0Ah], y [BP+8], dir [BP+6])`). Pool: 5200:01AD (1.00).
### 3300:03EC FillSquareFloor (H) — rows 2..4 x cols 0..5 := 16h { 3300:0410 }; `west = 1` -> per row 2..4: tiles (row-1,row) 4, (row,row) 3, (row+1,row) 0Dh { 3300:043e / 044d / 045f }; `west = 3` -> (1,2) 8, (5,4) 0 { 3300:047b / 0488 }. Pool: 5200:02BA (0.93).
### 3300:0491 FillSquareNorth (H) — `north = 1` -> (3,0),(4,0) := 5, (3,1),(4,1) := 0Ah { 3300:04a8 .. 04cf }; else 16h x4 { 3300:04de .. 0505 }. Pool: 5200:0377 (0.93).
### 3300:050E FillSquareNW (H) / 3300:06EC FillSquareNE (H)
Corner blocks (cols 1,2 / 5,6 x rows 0,1) from `north`, `west`, `east` and the two extra probes `ProbeWall(x, y-1, 6)` / `ProbeWall(x-1, y, 0)` for NW { 3300:052a / 0547 }, `ProbeWall(x, y-1, 2)` / `ProbeWall(x+1, y, 0)` for NE { 3300:0708 / 0724 }; decision tables identical to Pool's 5200:040F / 0615 (transcribed in `ov10.c` 3300:0580..06b2 and 0760..0890; values 16h/0Dh/0/0Fh/5/12h/2/11h/10h/0Ah/14h/7/1/3/17h/15h/6 resp. 4/16h/0Fh/5/18h/1/7/0Bh/3/11h/13h/9/10h/0Ah/8/0Ch/17h/0Eh) then four PutCombatTile calls { 3300:06b9 .. 06e3 ; 0896 .. 08c0 }. Pool: 0.89 / 0.89.
### 3300:08C9 BuildDungeonField (H)
```pascal
for sq_dy := -2 to 2 do for sq_dx := -6 to 6 do begin                 { 3300:08cc / 08d6 }
  x := party_MapX + sq_dx; y := party_MapY + sq_dy;
  west := ProbeWall(x, y, 6);                                       { 3300:0903 }
  north := ProbeWall(x, y, 0);                                      { 3300:0915 }
  east := ProbeWall(x, y, 2);                                       { 3300:0927 }
  south := ProbeWall(x, y, 4);                                      { 3300:0939  NEW: south }
  FillSquareFloor; FillSquareNorth; FillSquareNW; FillSquareNE;     { 3300:094c .. 095c }
  cell_Door := GetCellAttr(x, y) and $40;                            { 3300:095f }
  ScatterFloorDebris;                                                { 3300:0971 }
end;
```
Pool: 5200:0810 (0.72).
### 3300:098D TerrainFlags (H) — `:= g_0352[terrain_Loc]` { 3300:098d }: **the 32-entry image table at DS:0352 replaces Pool's 200-case classifier** (values 0,18h,11h,15h,1,1,60h,14h,8,1,0,21h,71h,9,6,4,1,9,9,8,59h,0,11h,11h,0,0,1,11h,0,0,20h,20h; `terrain_Loc` = Mem[4CA1], the location number). Bits as Pool's OverlandTerrainFlags: 20h/10h road chance, 2/4/40h/8/80h densities.
### 3300:09A8 PlaceBoulderPair (H) — `grid[row, col+1] := 40h; grid[row+1, col+1] := 41h` (bounds-checked) { 3300:09ab / 09d8 }. Pool: 5200:0B97 (tiles 34h/35h there).
### 3300:09FE BuildRoadOrRidge (M)
chance 0, flag 20h -> 23h, flag 10h -> 4Bh { 3300:0a09 / 0a17 }; `Roll(1,100) <= chance` { 3300:0a2a }: `c := 34 - Roll(5,4)` aligned to `(c+2) mod 7 = 0` { 3300:0a46 }; for row 0..24 while c < 50: `grid[row, c] := 3Bh + Roll(1,2)` and, if c < 49, `grid[row, c+1] := 3Dh + Roll(1,2)` { 3300:0aa4 / 0ad0 }, `Roll(1,20) = 1` -> PlaceBoulderPair(c, row) { 3300:0af7 }, c + 1. Pool: 5200:0BDE (0.70; Pool used fixed tiles 32h/33h and two end boulders).
### 3300:0B0A BuildTrees (H)
Unless flag 80h: density 10; flag 2 -> 5; flag 4 -> -2; flag 40h -> +5; flag 8 -> +10; < 0 -> 1 { 3300:0b11 .. 0b72 }; for every floor cell (col 0..49, row 1..24) whose upper neighbour is floor and `Roll(1,100) <= density` { 3300:0bb0 .. }: if `Roll(1,100) > density` then `grid[row-1, col] := 1Fh + Roll(1,5); grid[row, col] := 24h + Roll(1,5)` (two-cell tree) else `grid[row, col] := 29h + Roll(1,2)` { 3300:0c19 .. 0c7a }. Pool: 5200:0D13 (0.73).
### 3300:0CA1 PutGroundCover (H) — **new helper**
`procedure PutGroundCover(col [BP+12h], row [BP+10h]: Byte; t1 [BP+0Eh], t2 [BP+0Ch], t3 [BP+0Ah], t4 [BP+8], t5 [BP+6]: Byte)` (push order at 3300:0f0d: col `[bp-1]`, row `[bp-2]`, then the five thresholds) — `r := Roll(1,100)`: `r <= t1` -> `grid[row, col] := 39h + Roll(1,2)`; `<= t1+t2` -> `2Fh + Roll(1,2)`; `<= t1+t2+t3` -> `2Bh + Roll(1,4)`; `<= t1+..+t4` -> `36h + Roll(1,3)`; `<= t1+..+t5` -> `31h + Roll(1,4)`; else nothing { 3300:0ca9 .. 0e46 } (Ghidra: param_6 = t1 … param_2 = t5).
### 3300:0E49 BuildGroundCover (H) — **changed**
`score := 50; flag 10h -> 60; +30 (20h); +20 (40h); -10 (4); -20 (2); -50 (80h)` { 3300:0e55 .. 0ea2 }; for every floor cell (col 0..49, row 0..24): by `score`: < 10 -> PutGroundCover(col, row, 0, 0, 0, 30, 15); 10..29 -> (…, 0, 1, 5, 20, 10); 30..69 -> (…, 0, 2, 5, 10, 5); 70..89 -> (…, 10, 2, 10, 10, 1); 90..110 -> (…, 15, 5, 15, 10, 1) (t1..t5 in Pascal order) { 3300:0f0d / 0f36 / 0f5e / 0f86 / 0fae }. Pool: 5200:0E9E (0.61).
### 3300:0FC7 BuildWildernessField (H)
`FillChar(grid, 4E2h, 17h)` { 3300:0fd6 }; `terrain_Loc := Mem[4CA1]` { 3300:0fe3 }; BuildRoadOrRidge; BuildTrees; BuildGroundCover { 3300:1008 / 100c / 1010 }. Pool: 5200:11B4 (0.74; no overland map here).
### 3300:102F PrepareBattlefield (H)
```pascal
if Mem[4BE6] = 0 then Load24x24Set('WildCom', 1, 0, $21) else Load24x24Set('DungCom', 1, 0, $19);   { 3300:106f / 1059 }
Load24x24Set('RandCom', 1, $22, 6);                              { 3300:108c }
cm_Map := GetMem($4E9); cm_Map^[4] := 0; cm_Map^[5] := 1; cm_Map^[6] := 0;   { 3300:109a }
if Mem[4BE6] = 0 then BuildWildernessField else BuildDungeonField;   { 3300:10d5 / 10d0 }
```
Pool: 5200:1244 (0.84).
### 3300:10DD InitPartyCombatants (H)
For each member: RecalcItems(c) { 3300:1104 }; `c^.combatant := GetMem(16h)` zero-filled { 3300:1119 }; members beyond `Mem[7F3E]` get `combatant^[13h] := 1`; `combatant^[9] := g_02FA[party_Dir div 2]` (7, 2, 3, 6), +4 mod 8 for `c+197h = 1` (enemy side); NPC extras with morale (`+F7h and 7Fh`) 0 or > 66h: `c+F7h := Mem[7EC6] - 80h` (region 1 +58Ch) { 3300:11bd }. Pool: 5200:12E1 (0.90).
### 3300:11FB OutsideDeployBox (H) := `((c < 0) or (c > 10)) and ((r < 0) or (r > 5))` { 3300:11fb }. (1.00)
### 3300:122C TryPlaceCombatant (H)
`function TryPlaceCombatant(who [BP+10h], c [BP+0Eh], r [BP+0Ch], sq_x [BP+0Ah], sq_y [BP+8], tmpl [BP+6]: ShortInt): Boolean` (order as Pool; push order at 3300:17d2: who, c, r, sq_x, sq_y, tmpl) — inside the 11x6 box and the box cell free (`g_47F4[dep_Side*108h + tmpl*42h + r*0Bh + c]`): `cb_Col[who] := c + sq_x*6 + sq_y*5 + 16h; cb_Row[who] := r + sq_y*5 + 0Ah` { 3300:1294 / 12b8 }; `ProbeMove(cb_Char[who], 8, …)` { 3300:1307 }; free and passable -> mark the box cell, true. Pool: 5200:1434 (0.90).
### 3300:1370 FindDeploySpot (M) — spiral search through the deployment template (`g_02EA` offsets, `g_02FE`/`g_0306` starts, `g_02FA` directions, `g_02DA` neighbour directions), stepping to neighbouring squares through open walls (ProbeWall { 3300:169f / 175b }; skipped when `view_Mode = 3`, no walls in 2D fields) until TryPlaceCombatant { 3300:17d2 } succeeds or the alternatives are exhausted. Pool: 5200:1577 (0.95; same algorithm).
### 3300:1800 DeployParty (H)
`CountActiveSides` { 3300:1806 }; clear `cb_Size[1..255]`; RebuildOccupancy { 3300:1832 }; `dep_StartX[0] := 0; dep_StartY[0] := 0; dep_Facing[0] := party_Dir div 2; dep_StartX[1] := Mem[7EC1]*dx[party_Dir]; dep_StartY[1] := Mem[7EC1]*dy[party_Dir]; dep_Facing[1] := ((party_Dir+4) mod 8) div 2` { 3300:183c .. 189c }; `dep_Half[side] := (g_6F90[side]+1) div 2` { 3300:18ae }; fill the 2 x 4 x 6 x 11 boxes from the row ranges `g_030E + facing*12` { 3300:18d4 .. 1983 }; for each member: `cb_Char[n] := c; dep_Side := c+197h; cb_Index[n] := n; cb_Size[n] := c+DEh and 7` { 3300:19e5 .. 1a7d }; FindDeploySpot(n) { 3300:1a8a }: not placed and extra -> dropped from the party (`SelectedChar := c; RemovePartyMember(1, 0)` { 3300:1be1 }); placed but inactive (`+196h = 0`) and no duel (`g_8B56 = 0`) and not extra -> corpse list entry, tile 1Fh { 3300:1b1f .. 1b7f }; RebuildOccupancy { 3300:1b87 }; `PollOneKey` each member { 3300:1a30 }; finally cut the list after the last kept member { 3300:1c15 }. Pool: 5200:19F5 (0.94).
### 3300:1C3E StartCombat (H) — stub ov10 e1
```pascal
TextOutputActive := 0;                                              { 3300:1c3e }
FreeAnimation(enc_Anim); FreePicture(head_Pic); FreePicture(body_Pic); FreePicture(bigpic_Pic);   { 3300:1c49 .. 1c6c }
bigpic_Id := $FF; head_Id := $FF; body_Id := $FF;
ClearMenuLine; MessageDelay;                                        { 3300:1c80 / 1c85 }
DrawText(0, 24, 10, 0, 'A battle begins...');                       { 3300:1ca5 }
MagicOn := 0; CombatRound := 0; combat_MaxRounds := $0F; AttackRollValue := 0; corpse_Count := 0; cloud_List := nil; cloud9_List := nil; treasure_Mark := nil;   { combat globals (COMBAT lane) }
FillChar(g_6E59, $38, 0); Mem[7F33] := 0;                           { 3300:1cdb / 1ce7 }
PrepareBattlefield; PollOneKey; InitPartyCombatants; PollOneKey; DeployParty; PollOneKey;   { 3300:1cf7 .. 1d0d }
AllocPicture($18, 3, 4, 1, var g_75E0);                             { 3300:1d12 }
cm_Map^[2] := CombatantCol(PartyHead) - 3; cm_Map^[3] := CombatantRow(PartyHead) - 3;   { 3300:1d2a / 1d43 }
ov24_2E05;                                                          { 3300:1d5c  draw the combat layout (COMBAT lane) }
for c in party do begin CallEffectHooks(c, 8); CallEffectHooks(c, $16) end;     { 3300:1d75 / 1d83  effect hooks 8 and 16h (NEW second hook) }
CalcEnemyHpPct;                                                          { 3300:1da3  combat main (COMBAT lane) }
view_Mode := 5;                                                     { 3300:1da8 }
```
Pool: 5200:1E31 (0.88).
### 3300:0000 ov10_LoadDeps (touches 13 units) · 3300:1DB1 ov10_init empty.

---

## Unit initialisers (all empty `RETF`, H)
3300:1DB1 ov10_init · 3F00:0EBB ov14_init · 6800:128D ov26_init · 6A00:007F ov27_init · 6B00:01B7 ov28_init · 6C00:08A2 ov29_init · 6D00:1478 ov30_init · 6F00:0BB0 ov31_init · 7000:13C1 ov32_init · 7200:061E ov33_init · 7400:02C3 ov35_init. Every unit's entry 0 (`ovNN_0000`) is an empty procedure or a chain of calls to other units' entry 0 (a dependency touch, M).

## Deltas vs Pool worth a build note
- Argument orders are Pool's throughout (argcheck); the only signature changes are `Load24x24Set(name, id, start, count)` (two new arguments), `DrawTile24`'s fourth argument now used as flags, `ProbeMove`'s two extra var flags and the new `PutGroundCover(col, row, t1..t5)`.
- No overland travel: `view_Mode` 3 = 2D area with a BIGPIC backdrop (DrawBigPic in RefreshView, LoadBigPic(79h) as the combat/area backdrop, the ov27 overlay animation on BIGPIC 121 while menus wait).
- EGA backdrop draws SKY.DAX objects (sun by hour cell 4BC9 and facing, moon when facing north, cloud strip).
- Doors: ClosePassage is empty; Knock is offered at wizard locks whenever a caster has it; giant-strength Bash rows for ordinary locks.
- Combat window: `combat_Visible` (g_75E6) gates every drawing call; a two-picture death animation; ProbeMove reports tiles 1Eh/1Ch through flags; monster-icon recolouring is the identity.
- Battlefield: ScatterFloorDebris is per square and keyed on cell-attribute bit 40h; wilderness terrain flags come from a 32-entry table by location number; ground cover is a 5-threshold helper.

## Open items (explicit unknowns)
- `DrawPicture` named DrawPicture by signature only, `FUN_01A0_0252`, `SetEgaPaletteRegisterRaw` (Tandy palette), `FlushGameKeys`: resident lane.
- `g_4FBF` (loading message / animation flag), `g_75E6` (combat display gate), `g_7294` reset on C/V/E, `g_8C80` (startup string compared with ParamStr(2)), `anim_Id = 'P'`, `Mem[4CFF]` (red tint), `Mem[4CA1]` (location number), cell-attribute bit 40h, the SKY picture roles (which record is the "moon").
- ov27's picture `g_8C7C` (loaded by another area).
- ECL-controlled cells read here (ECL_VM.md §3.3): 4BE6, 4BFB, 4BFD/4BFE, 4BC9, 7EC1, 7EC6, 7EC9, 7ECA, 7ED5, 7F33, 7F3E.

## Self-check
Method: every `{ seg:off }` citation in this file was taken from `decode/listings/<unit>.lst` (the address of a CALL, a store or a branch printed by the scratch tools `pushes.py` / `cites.py`), then a 10 % sample (seed 11, 44 of the 440 citations) was re-read against the five instructions at the address and the pseudocode statement. Sample: 6d00:00b3 ok (pushes dir 0 first) · 6d00:0532 ok · 6d00:02b2 ok · 6d00:041c ok (moon at (2,2), dir 0) · 6d00:05ef ok · 6d00:0987 ok · 6d00:10b4 ok · 6d00:12b9 ok (block, id) · 7400:00ca ok · 7400:025f ok · 6c00:004b ok · 6c00:021f ok · 6c00:0283 ok · 6c00:0462 ok · 6c00:07f8 ok · 6c00:0870 ok · 6b00:010b ok · 6b00:0172 ok · 6b00:019b ok · 6a00:0045 ok · 7200:0090 ok · 7200:0249 ok · 7200:0609 ok · 6f00:020b ok · 6f00:0a7c ok · 6f00:0acf ok · 3f00:0341 ok · 3f00:0523 ok (Roll(1,10) < 10 for str 21) · 3f00:08ea ok · 3f00:0952 ok (prompt '', options DS:03D6) · 3f00:0d05 ok · 3f00:0e94 ok · 7000:01c3 ok · 7000:0a20 ok · 7000:0ff1 ok · 7000:11d9 ok · 6800:0640 ok (Enter returns the option letter) · 6800:04bc ok · 6800:1174 ok · 3300:0967 ok · 3300:0f0d ok · 3300:1095 ok · 3300:1be1 ok · 3300:1d8c ok. Result: 44/44 consistent. Corrections made while writing: a first draft read the push lists backwards and claimed reversed orders for the map getters, DrawWallPiece, LoadWallSet/Load8x8Set, Put8x8Symbol, LoadAnimation, LoadPortrait, Show3DSprite, TraceLine/InFrontArc/BuildTargetList/FootprintCell and the ov32 window routines; argcheck (30 MISMATCH on that draft) exposed it and every signature and call was put back to the push order (= Pool's).
Fixes (lane cab-fixes-fable, 2026-10-20): STATUS `VIEW fix request #verify-47..50` applied — #47 the 105 anchors inside an instruction snapped to the containing instruction's start (`scratchpad/verify/snapgen.py`, 117 tokens including range ends); #48 the RecolorPicture calls written in Pascal order `(fromCol, toCol, frame, randomMix, pic)` as RESIDENT 0297:1626 (L254, L290, L390, L392; L393 unchanged); #49 `text_Cleared` test cited at 3f00:0b64; #50 the four giant-strength Roll arms on their own anchored lines (3f00:0503 / 051d / 053c / 0556, `25:` 0570) and `decode/names/eclview_names.json` re-keyed DS:6E94 → DS:6E97 for `tg_List` (6E94 is the cm_Map segment word). Whole-file cite pass with `scratchpad/verify/citepass4.py` (as for COMBAT): 252 anchors on 195 lines moved to the statement's first instruction (229 back to the first push/load, 9 off a preceding store, 8 off a conditional jump, 6 off a closing JMP); 5 settled by hand (6b00:00e8 / 01a2 the Mem[4BE6] branch, 6b00:00f7 GetCellAttr, 3f00:086f the map wrap, 6d00:0475 lastRow). Checks after the pass: anchorcheck 630 anchors, **0 bad**; argcheck 235 calls, **0 MISMATCH** (VIEW_ARGCHECK.md regenerated).
