# ENGINE — the overlaid game shell: heap error, title/credits, copy protection, start-up, save/load, top menu + character creation (FINAL pseudocode, lane cab-mod-engine = cab-rt, Opus)

Units (herdr/assignments/cab-areas.md, ENGINE): ov00, ov01, ov03, ov11, ov16, ov17. Screens: `ENGINE_SCREENS.md`.
Names: `decode/names/engine_names.json`. Pool twins (cab-areas.md): the overlay sections of Pool's
`PoolRadianceRE/decode/pseudo/PARTY.pas.md` (Pool ov00, ov01, ov02 code wheel, ov11, ov17 = our ov16 save/load, ov16 = our
ov17 menu/creation); every routine has a `Pool:` line (same / changed / new).
Evidence: `decode/listings/ovNN.lst` (asm); `.c` was only a checklist. Call arguments were read from the PUSH sequences
(`decode/tools/callsites.py` lists them; each line was checked against the asm).

Conventions (as RESIDENT.pas.md)
- **Signatures in Pascal order**: first parameter = highest BP offset = pushed first; parameters as `name [BP+xx]`.
- `{ seg:off }` = first instruction of the statement (overlay analysis segments: ov00 2000, ov01 2100, ov03 2600, ov11 3500,
  ov16 4300, ov17 4800); `{ quirk: ... }` = behaviour a faithful port must copy.
- Resident callees by RESIDENT.pas.md names and **Curse signatures** (text routines carry a background colour:
  `DrawText(col, row, fg, bg, s)`, `ShowBottomPromptAndReadKey(fg, bg, s)`, `ReadBottomLine(prompt, fg, bg, maxLen)`, ...).
  Other lanes' overlay routines by their names (ECL.pas.md, VIEW.pas.md) or `ovNN_XXXX`.
- Globals by `decode/GLOBALS.md` name (`g_XXXX` = DS:XXXX when unnamed). Names introduced by this lane (engine_names.json,
  now in GLOBALS.md; the bodies keep the `g_` form where they were written first): ImportSource = g_7584 (H, the Curse/Pool/
  Hillsfar switch of ov16), GameSaved = g_5CF1 (H, Pool equivalent), FreeTraining = g_7587 (M), TopMenu = DS:0551 (H, the
  table texts), ecl_Mem4B00 / ecl_Mem7C00 / ecl_Mem7A00 = g_4F99 / g_4F9D / g_4FA1 (H, ECL_VM.md §2; **word-indexed**: byte
  offset o of a region = VM word base + o/2), ItemsFound / ItemsFile / ItemTypeTable / ItemsReadCount = g_4A20 / 4A4C / 5CF6 /
  6592 (M, ov11 ITEMS load). Sound ids are the DS words g_25AA.. (RESIDENT res_0713:
  g_25AE = 1, g_25B0..g_25C8 = 2..0Eh; `PlayOrStopSound(n)` for n >= 2 plays effect n-1).

---

## ov00 (2000) — heap-error handler "Time to save your game"

Pool twin: Pool ov00 (2000) — **changed**: one message, always offers the save, no size test.
CS literal 2000:0000 `'Time to save your game'`.

### 2000:0017 HeapErrorHandler (H)
`function HeapErrorHandler(size [BP+6]: Word): Integer` (`RETF 2`) — installed in `HeapError` by the unit init; GetMem
(0A54:0329) calls it when the heap is exhausted. Name H: HeapError := 0039:0025 = stub ov00 entry 1 → 2000:0017.
Callees: ShowBottomPromptAndReadKey, SaveGame (save game, ENGINE ov16), TerminateGame.
```pascal
repeat
  ShowBottomPromptAndReadKey($0E, 0, 'Time to save your game');  { 2000:001d }
  SaveGame;                                                     { 2000:0037  the save menu (ov16) }
until GameSaved <> 0;                                               { 2000:003c  set by the save routine when a game was saved (M) }
TerminateGame;                                                   { 2000:0043  never returns }
HeapErrorHandler := result;                                      { 2000:0048  quirk: [BP-2] never assigned }
```
`{ quirk: the player cannot decline: the prompt repeats until a save succeeds, then the game exits to DOS. }`

### 2000:0051 ov00_init (H)
```pascal
HeapError := Ptr($0039, $0025);                                  { 2000:0054  stub ov00 entry 1 }
```
Pool: 2000:00AC — same.

---

## ov01 (2100) — title pictures and credits

Pool twin: Pool ov01 (2500) — **changed**: four TITLE pictures with a sound, a new credits page (the novel, TSR, SSI staff),
key flushes before and after every wait, no lightning. CS literals 2100:0051.. (credits) and 2100:062E `'title'`.
Called by MainProgram (RESIDENT 0000:017a / 02db) unless `ParamStr(1) = 'STING'`.

### 2100:0000 WaitSecondsOrKey (H)
`procedure WaitSecondsOrKey(secs [BP+6]: Word)` (`RETF 2`, near-called) — callers: ShowTitle.
Pool: 2500:0000 — **changed**: flushes the keys before and after (Pool left the key pending).
```pascal
FlushGameKeys;                                                   { 2100:0006 }
target := TimeInHundredths + LongInt(Word(secs * 100));          { 2100:000b  16-bit MUL }
while not KeyPressed and (TimeInHundredths < target) do ;        { 2100:002c / 0035  signed 32-bit compare }
FlushGameKeys;                                                   { 2100:0046  the key is consumed }
```

### 2100:01DF ShowCredits (H)
`procedure ShowCredits` (near) — caller: ShowTitle. Pool: 2500:0206 — **changed** (texts, layout, bg colour 0).
```pascal
FUN_01A0_00D3;                                                   { 2100:01df  screen frame with bars at rows 3 and 8 (RESIDENT) }
DrawText($2, $1, $A, $0, 'based on the tsr novel "azure bonds"');           { 2100:01ea }
DrawText($6, $2, $A, $0, 'by:');                                            { 2100:020a }
DrawText($9, $2, $B, $0, 'kate novak');                                     { 2100:022a }
DrawText($14, $2, $A, $0, 'and');                                           { 2100:024a }
DrawText($18, $2, $B, $0, 'jeff grubb');                                    { 2100:026a }
DrawText($A, $4, $A, $0, 'scenario created by:');                           { 2100:028a }
DrawText($B, $5, $E, $0, 'tsr, inc.');                                      { 2100:02aa }
DrawText($15, $5, $A, $0, 'and');                                           { 2100:02ca }
DrawText($19, $5, $E, $0, 'ssi');                                           { 2100:02ea }
DrawText($E, $6, $B, $0, 'jeff grubb');                                     { 2100:030a }
DrawText($B, $7, $B, $0, 'george mac donald');                              { 2100:032a }
DrawText($1, $9, $A, $0, 'game created by:');                               { 2100:034a }
DrawText($12, $9, $E, $0, 'ssi special projects');                          { 2100:036a }
DrawText($2, $B, $E, $0, 'project leader:');                                { 2100:038a }
DrawText($2, $C, $B, $0, 'george mac donald');                              { 2100:03aa }
DrawText($2, $E, $E, $0, 'programming:');                                   { 2100:03ca }
DrawText($2, $F, $B, $0, 'scot bayless');                                   { 2100:03ea }
DrawText($2, $10, $B, $0, 'russ brown');                                    { 2100:040a }
DrawText($2, $11, $B, $0, 'michael mancuso');                               { 2100:042a }
DrawText($2, $13, $E, $0, 'development:');                                  { 2100:044a }
DrawText($2, $14, $B, $0, 'david shelley');                                 { 2100:046a }
DrawText($2, $15, $B, $0, 'michael mancuso');                               { 2100:048a }
DrawText($2, $16, $B, $0, 'oran kangas');                                   { 2100:04aa }
DrawText($16, $B, $E, $0, 'graphic arts:');                                 { 2100:04ca }
DrawText($16, $C, $B, $0, 'tom wahl');                                      { 2100:04ea }
DrawText($16, $D, $B, $0, 'fred butts');                                    { 2100:050a }
DrawText($16, $E, $B, $0, 'susan manley');                                  { 2100:052a }
DrawText($16, $F, $B, $0, 'mark johnson');                                  { 2100:054a }
DrawText($16, $10, $B, $0, 'cyrus lum');                                    { 2100:056a }
DrawText($16, $12, $E, $0, 'playtesting:');                                 { 2100:058a }
DrawText($16, $13, $B, $0, 'jim jennings');                                 { 2100:05aa }
DrawText($16, $14, $B, $0, 'james kucera');                                 { 2100:05ca }
DrawText($16, $15, $B, $0, 'rick white');                                   { 2100:05ea }
DrawText($16, $16, $B, $0, 'robert daly');                                  { 2100:060a }
```
Texts and positions are exactly the CS literals 2100:0051..01DE; colours 0Ah green headings, 0Eh yellow, 0Bh cyan names, all on 0.

### 2100:0634 ShowTitle (H)
`procedure ShowTitle` (far, stub ov01 e1) — caller: MainProgram. Pool: 2500:0627 — **changed** (4 pictures, no lightning, no
DataPath swap: Curse's LoadDaxRecord finds TITLE.DAX through OpenWithPrompt).
```pascal
pic := nil;                                                      { 2100:063a }
LoadPicture('title', 1, 0, 0, pic);  PutPicture(0, 0, pic);      { 2100:0642 / 0664 }
WaitSecondsOrKey(5);                                             { 2100:0675 }
if g_4F98 = 0 then Exit;                                         { 2100:067d  curse.cfg line 4 <> 'F': title 1 only (picture not freed) }
LoadPicture('title', 2, 0, 0, pic);  PutPicture(0, 0, pic);      { 2100:0687 / 06a9 }
FreePicture(pic);                                                { 2100:06ba }
LoadPicture('title', 3, 0, 0, pic);  PutPicture(6, $0B, pic);    { 2100:06c4 / 06e6  at cell (6, 11) over title 2 }
FreePicture(pic);                                                { 2100:06f9 }
WaitSecondsOrKey(10);                                            { 2100:0703 }
LoadPicture('title', 4, 0, 0, pic);                              { 2100:070b }
PlayOrStopSound(g_25C6);                                         { 2100:072d  effect 0Dh-1 }
PutPicture(0, $0B, pic);                                         { 2100:0736  at cell (0, 11) }
FreePicture(pic);                                                { 2100:0748 }
WaitSecondsOrKey(10);                                            { 2100:0752 }
ClearScreen;                                                     { 2100:075a }
ShowCredits;                                                     { 2100:075f }
WaitSecondsOrKey(10);                                            { 2100:0763 }
ClearScreen;                                                     { 2100:076b }
```
`{ quirk: a key during any wait only shortens that wait (it is flushed); every config the game writes has 'F', so all four
pictures and the credits always run. }`

### 2100:0774 ov01_init — empty (H)
Pool: 2500:0809 — same.

---

## ov03 (2600) — rune translation wheel (copy protection)

Pool twin: Pool ov02 CodeWheelCheck (2A00:00FD) — **changed** (rune tiles instead of the code wheel, one character answer).
Spec: `decode/ecl/ECL_VM.md` §8 (formula, answer table, oracle sheet `decode/ecl/runewheel.py`) and RULINGS.md **CR-2**.
Callers: MainProgram (RESIDENT 0000:0205 / 036f, when not in the demo and `ParamStr(2) <> 'Wooden'`) and ECL op 3C PROTECTION
(ECL1/80). Name RuneWheelCheck: cab-ecl (ecl_names.json), H by the strings.
CS literals: `'tiles'` 2600:000C, the prompts 2600:0015..0058, path patterns `'-..-..-..'` 0062, `'- - - - -'` 006C, `'.........'`
0076, `'Type the character in box number '` 0080, `'under the '` 00A2, `'path.'` 00AD, `' '` 00B3, `'type character and press return: '`
00B5, `"Sorry, that's incorrect."` 00D7, `'An unseen force hurls you into the abyss!'` 00F0.
Answer table: six `string[36]` rows at DS:0000 (stride 37 = length byte + 36 chars; rows listed in ECL_VM.md §8).

### 2600:011A RuneWheelCheck (H)
`procedure RuneWheelCheck` (far, stub ov03 e1). Locals: `attempts` [BP-1], `typed` [BP-2], `expected` [BP-3], `pos` [BP-5] (Integer),
`e` [BP-6] (espruar tile 0..25), `d` [BP-7] (dethek tile 0..21), `pathStr` [BP-11h] string[9], `path` [BP-14h], `row` [BP-15h],
`answer` [BP-17h] string[1].
```pascal
Load24x24Set('tiles', 1, 0, $1A);                                { 2600:0121  TILES/1: 26 espruar runes into slots 0..25 }
Load24x24Set('tiles', 2, $1A, $16);                              { 2600:013e  TILES/2: 22 dethek runes into slots 26..47 }
DrawScreenFrame;                                                 { 2600:015b }
DrawText(3, 2, $0A, 0, 'Align the espruar and dethek runes');    { 2600:0160 }
DrawText(3, 3, $0A, 0, 'shown below, on translation wheel');     { 2600:0180 }
DrawText(3, 4, $0A, 0, 'like this:');                            { 2600:01a0 }
attempts := 0;                                                   { 2600:01c0 }
repeat                                                           { 2600:01c4  (the retail retry loop jumps back here) }
  e := Random($1A);  d := Random($16);                           { 2600:01c4 / 01d0 }
  DrawTile24($11, 3, e, 0);                                      { 2600:01dc  espruar rune: view cell (17, 3) = screen cell (18, 4), pixel (144, 32) }
  DrawTile24($11, 7, d + $1A, 0);                                { 2600:01ee  dethek rune: view cell (17, 7) = screen cell (18, 8), pixel (144, 64) }
  FlushViewDirtyLines;                                           { 2600:0205 }
  path := Random(3);                                             { 2600:020a }
  case path of                                                   { 2600:0216 }
    0: pathStr := '-..-..-..';  1: pathStr := '- - - - -';  2: pathStr := '.........';   { 2600:0220 / 023a / 0254 }
  end;
  row := Random(6);                                              { 2600:0267 }
  DrawText(3, $0C, $0A, 0, 'Type the character in box number ' + Str(6 - row));   { 2600:0273 / 0293 }
  DrawText(3, $0D, $0A, 0, 'under the ');                        { 2600:02be }
  DrawText($0E, $0D, $0F, 0, pathStr);                           { 2600:02de  the path pattern in white }
  DrawText($19, $0D, $0A, 0, 'path.');                           { 2600:02f4 }
  pos := e + 34 - d + path * 12 + (5 - row) * 2;                 { 2600:0314 }
  while pos < 0 do pos := pos + 36;                              { 2600:0348 }
  while pos > 35 do pos := pos - 36;                             { 2600:0354 }
  expected := AnswerRow[row][pos + 1];                           { 2600:0360  DS:[row*37 + pos + 1] }
  answer := ' ';                                                 { 2600:037b }
  answer := ReadBottomLine('type character and press return: ', $0D, 0, 1);   { 2600:038e / 03b1  one character }
  typed := answer[1];                                            { 2600:03bf  ' ' when nothing was typed }
  Inc(attempts);                                                 { 2600:03c5 }
  { compare typed with expected }                                { 2600:03c8 }
  Exit;                                                          { 2600:03ce  PATCHED: `EB 1C` = JMP 03EC -> JMP 0446 (return). }
  { ---- retail path, dead in this copy (bytes 2600:03D0..0445, decoded with capstone; Ghidra leaves them undefined) ---- }
  if typed <> expected then
    ShowTimedBottomPrompt('Sorry, that''s incorrect.', $0E, 0);  { 03d0 }
until (typed = expected) or (attempts > 2);                      { 03ee / 03f6  JMP 01C4 while wrong and attempts <= 2 }
if attempts >= 3 then begin                                      { 03ff }
  PlayOrStopSound(SndOutputOn);  PlayOrStopSound(g_25B6);        { 0407 / 0410  output on, effect 5-1 }
  GameSpeed := 9;                                                { 0419  slowest messages }
  ShowTimedBottomPrompt('An unseen force hurls you into the abyss!', $0E, 0);   { 041e }
  Delay(1000);                                                   { 0438 }
  TerminateGame;                                                 { 0441 }
end;
```
**Patch (H, bytes):** with `74 1C` (JZ) at 2600:03CE the routine runs the retail logic: a correct answer jumps to the
`until` test, a wrong one shows "Sorry, that's incorrect." first. GAME.OVR file offset of the byte = ov03 FileOfs 0x4688 +
0x3CE = **0x4A56** (`EB` in the owner's copy, `74` retail); CR-2 A: the importer hashes it as `74` and records which form the
player had.
**Bypass flag (port):** implement the retail body; the copy-protection flag decides at the compare (2600:03CB): flag off
(default) = behave like the `EB` copy (accept any input after the prompt; still show the prompt so ECL1/80 looks the same),
flag on = the retail branch. MainProgram's own skip (`START.EXE <x> Wooden`, RESIDENT) stays as an independent original switch.
`{ quirk (retail path): the abort test is attempts >= 3 without re-testing the answer, so a correct answer on the third try
still ends the game. }` (H, 03FF follows 03F4 JE for a correct answer.)
`{ quirk: the runes and the box are re-rolled on every try; the screen keeps the old prompt lines (they are overdrawn). }`

### 2600:0000 ov03_0000 — empty procedure (H)
Body: one far call to ov34 entry 2 (ov34_0000), i.e. this unit's member of the overlay pre-load chains (ov02_LoadDeps calls
ov03 entry 2 = this routine; RESIDENT MainProgram notes) `{ 2600:0003 }`. Pool: — **new**.

### 2600:044A ov03_init — empty (H)

---

## ov11 (3500) — engine start-up and new-game reset

Pool twin: Pool ov11 InitGameState (5700:002D) — **changed**: Curse splits it into a one-time start-up (ov11_0056) and a reset
called after every game/demo (ov11_06D8), sets the BIOS keyboard flags, allocates two more pictures, loads the SKY pictures,
starts at map position (7,13), ECL PC 8000h, GameSpeed 4. CS literals: `'Loading...Please Wait'` 3500:002F, `'COMSPR'` 0045,
`'sky'` 004C, `'ITEMS'` 0050. ECL VM regions (ECL_VM.md §2): `ecl_Mem4B00` g_4F99 (800h, VM 4B00..4EFF), `ecl_Mem7C00` g_4F9D
(800h, 7C00..7FFF), `ecl_Mem7A00` g_4FA1 (400h, 7A00..7BFF), `ecl_CodeBuf` g_4FA5 (1E00h, script 8000..9DFF).

### 3500:0000 ov11_0000 — pre-load overlay units (H)
`procedure ov11_0000` — callers: MainProgram (0000:013b, 02bb). Calls the empty entry routines of ov14, ov22, ov35, ov33, ov29,
ov12, ov26, ov34 in this order, so the overlay manager loads those units now (and evicts the rest of the ring buffer).
Pool: none — **new**.
```pascal
ov14_LoadDeps; ov22_LoadDeps; ov35_0000; ov33_0000; ov29_0000; ov12_0000; ov26_0000; ov34_0000;   { 3500:0003 .. 0026 }
```

### 3500:0056 ov11_0056 — engine start-up (H)
`procedure ov11_0056` (far, stub ov11 e1) — caller: MainProgram (0000:0140), once. Pool: 5700:002D InitGameState — **changed**.
```pascal
BiosKbdFlags := Mem[$40:$17];                                    { 3500:0056  restored by TerminateGame }
Mem[$40:$17] := Mem[$40:$17] or $20;                             { 3500:0068  NumLock on }
Mem[$40:$18] := Mem[$40:$18] or $20;                             { 3500:007c }
Randomize;                                                       { 3500:0090 }
GetMem(ecl_Mem4B00, $800);  GetMem(ecl_Mem7C00, $800);  GetMem(ecl_Mem7A00, $400);   { 3500:0095 / 00a3 / 00b1 }
GetMem(ecl_CodeBuf, $1E00);                                      { 3500:00bf }
GetMem(FontPtr, $588);  GetMem(wall_Buf, $924);  GetMem(map_Buf, $400);   { 3500:00cd / 00db / 00e9 }
AllocPicture(8, 1, 1, 0, scratch_Pic);                           { 3500:00f7  8×8 scratch (Put8x8Symbol) }
AllocPicture(8, 1, 1, 0, g_8C7C);                                { 3500:010f  second 8×8 picture (new) }
FillChar(g_8C7C^.data, g_8C7C^.frameSize, $FF);                  { 3500:0127 }
AllocPicture($A8, $15, 1, 0, view_Pic);                          { 3500:0141  off-screen view 168 lines × 21 cells }
AllocPicture($18, 3, 1, 0, PicSaveBuf);                          { 3500:0159  24×24 save buffer (DrawPicture flag 4) }
FillChar(view_LineDirty, $A8, 0);                                { 3500:0171 }
FillChar(view_SpanScreenX, $150, 0);                             { 3500:0182 }
FillChar(view_SpanFirst, $150, $FF);                             { 3500:0193 }
FillChar(view_SpanLast, $150, 0);                                { 3500:01a4 }
g_4A1C := 0;                                                     { 3500:01b5  loop counter is a DS byte (as Pool InitIdx) }
repeat                                                           { 3500:01c0  screen line tables, lines 0..199 }
  if Odd(g_4A1C) then cga_LineSeg[g_4A1C] := $BA00 + (g_4A1C shr 1) * 5   { 3500:01c7 }
  else cga_LineSeg[g_4A1C] := $B800 + (g_4A1C shr 1) * 5;        { 3500:01eb }
  ega_LineOfs[g_4A1C] := g_4A1C * 40;                            { 3500:020d }
  m2_LineSeg[g_4A1C] := $B800 + $200 * (g_4A1C mod 4) + (g_4A1C shr 2) * 10;   { 3500:0226 .. 02b2  case of 4 banks }
  if g_4A1C = 199 then Break;  Inc(g_4A1C);                      { 3500:02d4 / 01bc }
until False;
FillChar(sym_Block, $14, 0);                                     { 3500:02de  5 symbol-set pointers }
FillChar(tile_Set, 8, 0);                                        { 3500:02ef }
AllocPicture($18, 3, $30, 0, tile_Set);                          { 3500:0300  48-frame 24×24 tile set (new: Pool loaded SQRPACI) }
FillChar(ecl_Mem4B00^, $800, 0);                                 { 3500:0318 }
ecl_Mem4B00^.w[$1CC div 2] := 1;  ecl_Mem4B00^.w[$1E4 div 2] := 0;   { 3500:032a / 0335  VM words 4BE6 := 1, 4BF2 := 0 (4BE6 = the 3D-area flag, ECL_VM §2) }
FillChar(ecl_Mem7C00^, $800, 0);                                 { 3500:0340 }
FillChar(ecl_Mem7A00^, $400, 0);                                 { 3500:0352 }
FillChar(ecl_CodeBuf^, $1E00, 0);                                { 3500:0364 }
FillChar(icon_Pic, $D0, 0);                                      { 3500:0376 }
for g_4A1C := 1 to 2 do begin                                    { 3500:0387  portrait slots head/body }
  Slot[g_4A1C].id := $FF;  Slot[g_4A1C].pic := nil;             { 3500:0392 / 03a3  5-byte records at DS:7269: 1 = head_Id/head_Pic 726E/726F, 2 = body_Id/body_Pic 7273/7274 }
end;
FillChar(enc_Anim, $42, 0);                                      { 3500:03c0 }
bigpic_Pic := nil;  TreasureItems := nil;                        { 3500:03d1 / 03d9 }
{ new-game reset block: statements 3500:03e1 .. 0559, listed below }
LoadTextFont;                                                    { 3500:055e }
ClearMenuLine;                                                   { 3500:0563 }
DrawText(0, $18, $0A, 0, 'Loading...Please Wait');               { 3500:0568 }
Load8x8Set($CA, 4);                                              { 3500:0588  8X8D1 record 202 }
Load8x8Set($CB, 0);                                              { 3500:0593  record 203 }
for g_4A1C := 0 to 11 do LoadCombatIcon('COMSPR', g_4A1C, g_4A1C + $0D);   { 3500:059e / 05a9 }
LoadCombatIcon('COMSPR', $19, $19);                              { 3500:05d1 }
if VideoMode <> 0 then begin                                     { 3500:05eb  no sky in CGA }
  LoadPicture('sky', $FA, 1, $0D, sky_Moon);                     { 3500:05f2  SKY.DAX 250..252 (cab-data SKY.md: transparent colour 13) }
  LoadPicture('sky', $FB, 1, $0D, sky_Sun);                      { 3500:0614 }
  LoadPicture('sky', $FC, 1, $0D, sky_Strip);                    { 3500:0636 }
end;
ItemsFound := OpenWithPrompt('ITEMS', DiskPrompt[DataSet], NoDiskPrompt, ItemsFile);   { 3500:0658  g_4A20, g_4A4C }
Reset(ItemsFile, 1);                                             { 3500:0689 }
Seek(ItemsFile, 2);                                              { 3500:0697 }
BlockRead(ItemsFile, ItemTypeTable, $810, ItemsReadCount);       { 3500:06a8  g_5CF6, count g_6592 (ITEMS.md) }
Close(ItemsFile);                                                { 3500:06c0 }
InitSpellTable;                                                       { 3500:06ca  spell table set-up (MAGIC; Pool InitSpellTable) }
InstallEffectHandlers;                                                       { 3500:06cf  effect handler table (PARTY ov12; Pool InstallEffectHandlers) }
```
`{ quirk (as Pool): ITEMS is opened with NoDiskPrompt = false after the reset, so the prompt repeats until the file is found;
BlockRead asks 810h bytes, the shipped file has fewer; a longer file would overwrite DS:5CF6+810h. }`

The **new-game reset** block (shared word for word with ov11_06D8 except where noted; statements of ov11_0056):
```pascal
FillChar(party_MapX, 5, 0);                                      { 3500:03e1 }
party_MapX := 7;  party_MapY := $0D;  party_Dir := 0;            { 3500:03f2 / 03f7 / 03fc  ov11_06D8: party_Dir := 2 }
FillChar(door_CanBash, 3, 1);                                    { 3500:0401 }
g_7214 := 0;  g_7216 := 1;                                       { 3500:0412 / 0417  wall-set slot 1 }
for g_4A1C := 2 to 3 do begin  PWord(@party_MapY[g_4A1C*4])^ := $FFFF;  PWord(@party_Ahead[g_4A1C*4])^ := $FFFF  end;   { 3500:041d / 0428 / 0439  wall-set slots 2, 3 empty }
opt_Animation := 1;  opt_Pics := 1;                                       { 3500:0451 / 0456  only in ov11_0056 (Pool opt_Portraits/opt_MonsterPics, M) }
DebugFlag := 0;  TextOutputActive := 1;  Resuming := 0;  RestEncCounter := 0;   { 3500:045b .. 046a }
PartyList := nil;  SelectedChar := nil;                          { 3500:046f / 0477 }
ecl_PC := $8000;  GameSpeed := 4;                                { 3500:047f / 0485 }
DemoMode := false;                                               { 3500:048a  only in ov11_0056 }
DataSet := 1;  PrevDataSet := 1;  view_AreaMap := 0;  g_8C9E := 1;   { 3500:048f .. 049e }
ecl_Mem7C00^.w[$67C div 2] := 0;                                 { 3500:04a4  VM word 7F3E }
menu_Top := 1;  DuelActive := 0;  RestActive := 0;  g_8B5F := 0;  g_8B60 := 0;  g_8B61 := 0;   { 3500:04af .. 04c9 }
view_RedrawPicture := 0;  PartyDead := 0;  g_5BE8 := 1;  enc_SpriteOnScreen := 0;  NoDiskPrompt := 0;   { 3500:04ce .. 04e2 }
anim_Name := '';  camp_AnimName := 0;  anim_Id := $FF;  camp_AnimId := $FF;  GameSaved := 0;   { 3500:04e7 .. 04fb }
backdrop_Key12 := $E8;  backdrop_Key3 := $DB;  enc_MenuActive := 0;  combat_Visible := 1;  bigpic_Id := $FF;   { 3500:0500 .. 0514 }
g_8C76 := 0;  g_8C77 := 0;  g_4FC8 := 0;                         { 3500:0519 .. 0523 }
menu_Sel := 1;  view_Mode := 4;  view_PrevMode := 0;  SoundTimerOn := true;  item_HookMode := 0;   { 3500:0528 .. 053c  (06D8 calls ClearMenuLine before these) }
sky_Moon := nil;  sky_Sun := nil;  sky_Strip := nil;             { 3500:0541 .. 0551  only in ov11_0056 }
g_8B6F := 0;                                                     { 3500:0559 }
```
`{ quirk: SoundTimerOn := true is only the flag; the timer was removed by MainProgram's PlayOrStopSound($FF) before this call, so
the flag is wrong until MainProgram's unconditional StartSound at 0000:015a (its `if not SoundTimerOn` test at 0000:0145 is skipped
because of this store). }` (H by the call order in RESIDENT MainProgram.)

### 3500:06D8 ov11_06D8 — new-game reset (H)
`procedure ov11_06D8` (stub ov11 e2) — caller: MainProgram (0000:02cc), after every game session or demo. Clears the view
dirty tables (`{ 3500:06d8 }` .. 070e) and the four ECL regions (with VM words 4BE6 := 1, 4BF2 := 0) like ov11_0056, then the reset
block above **without** g_4FBF/g_4FBE, DemoMode and the sky pointers, with `party_Dir := 2` (`{ 3500:0798 }`), and calls
`ClearMenuLine` (ov26 e4) before `menu_Sel := 1` (`{ 3500:08b5 }`). Pool: none — **new** (Pool restarted the program instead).

### 3500:08DC ov11_init — empty (H)

---

## ov16 (4300) — character files, import, save and load game

Pool twin: Pool ov17 (7500) "character roster, character / monster / NPC files, party list, save and load game" — **changed**:
no roster file (Pool ReadCharList/WriteCharList are gone; the character list is a directory scan), import of Pool and Hillsfar
characters, a volume-label check against saving on the game disk, item / effect files beside every character.
CS literals: `'.SAV'`, `'from saved game '`, `'*.guy'` `'*.cha'` `'*.sav'` `'*.hil'`, `'CURSE'`, `'Put save disk in '`,
`'Is your save disk in drive '` `':? '`, `'Unexpected error during save: '`, `'CHEAD'` `'CBODY'`, `'.guy'` `'.swg'` `'.fx'`
`'.cha'` `'.spc'`, `"Can't save.  No room on this disk."`, `'Lose character? '` `'Ok  Try another disk'`, `'Overwrite '`,
`'New file name: '`, `'Loading...Please Wait'`, `'MON'` `'CHA'` `'.dax'` `'Unable to load monster'` `'SPC'` `'ITM'`, `'CPIC'`,
`'savgam'` `'.dat'`, `'Load Which Game: '`, `'Save Which Game: '` `'A B C D E F G H I J'`, `'Saving...Please Wait'`, `'CHRDAT'`.

### Save file formats (for the saves lane; H by the BlockRead/BlockWrite sizes)
All files live in `SavePath` (DS:5BF0, string; `SavePath[1]` = g_5BF1 = the drive letter).
| file | written by | content |
|---|---|---|
| `<DOSNAME>.guy` | WriteCharacter (stand-alone character) | one character record, **1A6h = 422 bytes** (the in-memory record; the four far pointers +F2h effects, +14Dh items, +189h next, +18Dh are written but cleared on read) |
| `<DOSNAME>.swg` | WriteCharacter | the character's items: n × **3Fh = 63 bytes** (in-memory item records, list +14Dh, next pointer at item +2Ah) |
| `<DOSNAME>.fx` | WriteCharacter | the character's effects: n × **9 bytes** (list +F2h, next pointer at effect +5) |
| `CHRDAT<k><n>.sav` / `.swg` / `.fx` | SaveGame → WriteCharacter(name) | member n (1..) of saved game k, same three formats |
| `savgam<k>.dat` (k = A..J) | SaveGame | `DataSet` (1 byte, DS:5BEE), `ecl_Mem4B00^` 800h, `ecl_Mem7C00^` 800h, `ecl_Mem7A00^` 400h, `ecl_CodeBuf^` 1E00h, `party_MapX..` 5 bytes (DS:720F..7213), `view_PrevMode` 1 (DS:4FBB), `view_Mode` 1 (DS:4FBA), wall-set slots 1..3: word DS:7210+4i, word DS:7212+4i (2+2 each), member count (1 byte), member names `array[1..8] of string[40]` = 148h bytes (`'CHRDAT'+k+n`) — fixed size 335Dh bytes (SaveGame estimates 3208h); game speed and the two picture options are inside the 4B00 region (byte offsets 1F8h / 1FEh = VM words 4BFC / 4BFF), the data set in the 7C00 region (624h = VM 7F12) |
Import formats (read only, g_7584 = import source; DS tables at 0506 byte[3] name offset 0/0/4, 0509 word[3] flag-byte offset
F7h/84h/13h — a flag byte >= 80h hides the file; Hillsfar's is forced 0 —, 050F word[3] file size 1A6h/11Dh/BCh):
| g_7584 | game | pattern | record |
|---|---|---|---|
| 0 | Curse | `*.guy` | 1A6h |
| 1 | Pool of Radiance | `*.cha` (+ `*.sav` saved-game members) | 11Dh = 285 bytes, converted by ConvertPoolCharacter; `.swg`/`.fx`/`.spc` files beside it |
| 2 | Hillsfar | `*.hil` | BCh = 188 bytes, name a C string at +4; merged by ApplyHillsfarMinimums |

### 4300:0000 ov16_0000 — pre-load overlay units (H)
Calls the empty entries of ov33, ov34, ov25, ov23, ov24 `{ 4300:0003 }` (overlay pre-load chain). Pool: — **new**.

### 4300:0020 CStringToPascal (M)
`procedure CStringToPascal(src [BP+0Ah]: PChar; var dst [BP+6]: string)` — copies bytes up to the 0 terminator into `dst`
(used for the Hillsfar name, record +4). Pool: — **new**. Name M (behaviour, no string).

### 4300:008D ScanCharFiles (M) *nested in BuildCharacterFileList*
`procedure ScanCharFiles(pattern [BP+16h]: string; nameOfs [BP+14h]: Byte; flagOfs [BP+12h]: Word; fileSize [BP+10h]: Word;
var names [BP+0Ch]; var files [BP+8])` (parent frame [BP+4]). Pool: 7500:0010 ReadCharList — **changed** (directory scan instead
of the roster file).
```pascal
FindFirst(SavePath + pattern, 0, sr);                            { 4300:00a7 }
while DosError = 0 do begin
  if sr.Size = fileSize then begin                               { 4300:00e0 }
    Assign(f, SavePath + sr.Name);  Reset(f, 1);                  { 4300:00f4 / 00f9 }
    GetMem(nameEntry, $2E);  GetMem(fileEntry, $2E);             { 4300:0113 / 0138  menu list records, next at +2Ah }
    Seek(f, nameOfs);  BlockRead(f, nm, $10);                    { 4300:0168 / 017a  16-byte name; Hillsfar: C string -> CStringToPascal 019c }
    Seek(f, flagOfs);  BlockRead(f, flag, 1);                    { 4300:01d6 / 01e8 }
    if Copy(sr.Name, 9, 4) = '.SAV' then nm := Copy(nm, 1, 15) + ' from saved game ' + sr.Name[7];   { 4300:0222 / 023a }
    { the entry is dropped (FreeMem 0368 / 0376) when flag >= 80h or the name is already in PartyList (StrCompare 0337):
      nameEntry := nil;  fileEntry := nil  (4300:037b / 0383) }
    if nameEntry <> nil then append nameEntry / fileEntry to the two menu lists;   { 4300:038b .. 0419 }
    Close(f);                                                    { 4300:041c }
  end;
  FindNext(sr);                                                  { 4300:0427 }
end;
```

### 4300:0453 BuildCharacterFileList (M)
`procedure BuildCharacterFileList(var names, var files)` — caller: ov17 (Add Character menu). Pool: 7500:0010 — **changed**.
```pascal
if not CheckSaveDisk then Exit;                                  { 4300:0453 }
case ImportSource of
  0: ScanCharFiles('*.guy', ...table[0]...);                     { 4300:049e }
  1: begin ScanCharFiles('*.cha', ...table[1]...);  ScanCharFiles('*.sav', ...table[1]...) end;   { 4300:04f6 / 0544 }
  2: ScanCharFiles('*.hil', ...table[2]...);                     { 4300:0590 }
end;
```

### 4300:0643 CheckSaveDisk (H)
`function CheckSaveDisk: Boolean` (near and stub ov16) — callers: BuildCharacterFileList, WriteCharacter, LoadGame, SaveGame.
Pool: 7500:02AE EnsureSaveDir — **changed** (volume label, floppy prompts). Locals: `err` [BP-3].
```pascal
CheckSaveDisk := false;                                          { 4300:064a }
if ImportSource = 0 then begin
  repeat
    while (GetVolumeLabel(SaveDrive) = 'CURSE') and (SaveDrive < 'C') do   { 4300:0658 / 0672 / 067e  never save on a game disk }
      ShowBottomPromptAndReadKey($0E, 0, 'Put save disk in ' + SaveDrive + ':');   { 4300:0685 }
    repeat
      FindFirst(Copy(SavePath, 1, Length(SavePath)), $10, sr);  err := DosError;   { 4300:06c0 / 06e9  the directory }
      if err = 0 then Break                                      { 4300:06f2 }
      else if err in [2, $12] then begin                         { 4300:06fa }
        if UpCase(SaveDrive) < 'C' then                             { 4300:0707 }
          if AskYesNo('Is your save disk in drive ' + SaveDrive + ':? ', $0D, $0A, $0F) <> 'Y' then   { 4300:0717 / 0756 }
            ShowBottomPromptAndReadKey($0E, 0, 'Put save disk in ' + SaveDrive + ':');   { 4300:075c }
        MkDir(Copy(SavePath, 1, Length(SavePath)));  err := DosError;   { 4300:0795 / 07b5 }
      end
      else if UpCase(SaveDrive) < 'C' then                          { 4300:07bd }
        ShowBottomPromptAndReadKey($0E, 0, 'Put save disk in ' + SaveDrive + ':')   { 4300:07ca }
      else begin
        ShowBottomPromptAndReadKey($0E, 0, 'Unexpected error during save: ' + ByteToStr(err));   { 4300:0805 }
        Exit;                                                    { 4300:0834 }
      end;
    until err in [0, 5];                                         { 4300:0837  CS:0623 = [0,5] }
  until err in [0, 5];                                           { 4300:084a  (re-test from the volume check) }
end
else  { g_7584 = 1 or 2: the import directory must exist }
  repeat
    FindFirst(Copy(SavePath, 1, Length(SavePath)), $10, sr);  err := DosError;   { 4300:0867 / 0890  (0929 / 0952 for 2) }
    if err <> 0 then
      if UpCase(SaveDrive) < 'C' then ShowBottomPromptAndReadKey($0E, 0, 'Put save disk in ' + SaveDrive + ':')   { 4300:089c }
      else begin ShowBottomPromptAndReadKey($0E, 0, 'Unexpected error during save: ' + ByteToStr(err)); Exit end;   { 4300:08e4 }
  until err = 0;                                                 { 4300:0916 }
CheckSaveDisk := true;                                           { 4300:09e0 }
```
`{ quirk: error 5 (access denied, MkDir of an existing directory) counts as success; with the wrong disk answered 'N' the
directory is still created on whatever disk is in the drive. }` ByteToStr = DOS error text (ov24, M).

### 4300:09EB OverlayIconPicture (M) / 4300:0A7E LoadCharacterIcon (H)
Pool: 7500:032F / 7500:0482 — **same** (instruction-for-instruction, 183/183 aligned by pooltrans.py; `'CHEAD'`, `'CBODY'`).
The Pool section applies with Curse addresses (`{ 4300:0a7e }` ..).

### 4300:0C7E DeleteCharacterFiles (H)
`procedure DeleteCharacterFiles(var ch [BP+6]: TCharacter)` (`RETF 4`). Pool: — **new**.
```pascal
base := SavePath + MakeDosName(ch.name);                         { 4300:0c7e }
DeleteFileIfExists(base + '.guy');                               { 4300:0cb8 }
DeleteFileIfExists(SavePath + name + '.swg');                               { 4300:0cd7 }
DeleteFileIfExists(base + '.fx');                                { 4300:0cf6 }
```

### 4300:0DEA WriteCharacter (H)
`procedure WriteCharacter(var ch [BP+0Ah]: TCharacter; fname [BP+6]: string)` (`RETF 8`; the string is read at 0df1 `LES DI,[BP+6]`, the record at 0e20 `LES DI,[BP+0Ah]`; callers push ch first) — callers: SaveGame (fname =
`'CHRDAT'+k+n`), ov17 (save / drop character, fname = ''). Pool: 7500:069E — **changed** (disk-space check, item and effect files).
```pascal
ImportSource := 0;                                                     { 4300:0e04 }
repeat
  if not CheckSaveDisk then Exit;                                { 4300:0e09 }
  need := $1A6 + $3F * Count(ch.items) + 9 * Count(ch.effects);  { 4300:0e14 .. 0ea6  lists +14Dh (next +2Ah), +F2h (next +5) }
  choice := 'O';                                                 { 4300:0ea8 }
  if DiskFree(Ord(UpCase(SaveDrive)) - $40) < need then begin       { 4300:0ead }
    ShowBottomPromptAndReadKey($0E, 0, 'Can''t save.  No room on this disk.');   { 4300:0ed5 }
    choice := HorizontalMenu('Lose character? ', 'Ok  Try another disk', $0D, $0A, $0F, 0, 0, ext);   { 4300:0ef0 }
  end;
until choice = 'O';                                              { 4300:0f2e }
if fname = '' then begin name := MakeDosName(DeleteAll(ch.name, '.')); ext := '.guy' end   { 4300:0f38 / 0f52 / 0f78 }
else begin ext := '.sav'; name := fname end;                     { 4300:0f8e / 0fa7  name [BP-0B2h] string[40], ext [BP-0B7h] }
repeat                                                           { 4300:0fb6  existence test through Reset }
  Assign(f, SavePath + name + ext);  Reset(f, 1);  err := DosError;   { 4300:0fb6 / 0fe7 / 0ff6 }
  if not (err in [0, 2]) then                                    { 4300:0ffd  CS:0D70 }
    if UpCase(SaveDrive) < 'C' then ShowBottomPromptAndReadKey($0E, 0, 'Put save disk in ' + SaveDrive + ':')   { 4300:1011 }
    else begin
      ShowBottomPromptAndReadKey($0E, 0, 'Unexpected error during save: ' + ByteToStr(err));   { 4300:1059 }
      Close(f);  Exit;                                           { 4300:1089 / 1094 }
    end;
until err in [0, 2];                                             { 4300:1097 }
Close(f);                                                        { 4300:10a8  also when the file did not open (err 2) }
choice := 'N';                                                   { 4300:10b3 }
while (choice = 'N') and (fname = '') and FileExists(SavePath + name + ext) do begin   { 4300:10b8 / 10c2 / 10f1 }
  choice := AskYesNo('Overwrite ' + name + '? ', $0E, $0A, $0F);   { 4300:10fd / 1122 }
  if choice = 'N' then begin
    name := '';                                                  { 4300:113b }
    while name = '' do name := ReadBottomLine('New file name: ', $0A, 0, 8);   { 4300:1140 / 1147 }
  end;
end;
Assign(f, SavePath + name + ext);  Rewrite(f, 1);  BlockWrite(f, ch, $1A6);  Close(f);   { 4300:11ab / 11b0 / 11bf / 11d7 }
DeleteFileIfExists(SavePath + name + '.swg');                               { 4300:1207 }
if ch.items <> nil then begin Assign; Rewrite(f, 1); for each item: BlockWrite(f, item^, $3F); Close end;   { 4300:1249 / 125d / 1292 }
DeleteFileIfExists(SavePath + name + '.fx');                     { 4300:12d6 }
if ch.effects <> nil then begin Assign; Rewrite(f, 1); for each effect: BlockWrite(f, eff^, 9); Close end;   { 4300:1318 / 132c / 1361 }
```
`{ quirk: "Lose character? Ok" does not cancel: the record is written anyway to the full disk (DOS truncates it); only
"Try another disk" re-checks. }`
`{ quirk: the '.swg'/'.fx' files are deleted and rewritten only when the lists are non-empty, so an emptied inventory leaves no
file and an old one cannot come back. }`

### 4300:1388 FindTwinFile (M) *nested in ReadCharacter*
Searches `SavePath + '*' + ext` (ext = `.guy` or `.cha`) for a file whose 16-byte name equals the Hillsfar character's name;
returns the file name or ''. Pool: — **new**.

### 4300:1490 ConvertPoolCharacter (H) *nested in ReadCharacter*
Converts the 11Dh-byte Pool record (parent buffer) into the Curse record. Pool: — **new**. Field map (Curse offset ← Pool offset,
bytes; H by the MOV pairs 4300:1490..1F20):
| Curse | Pool | | Curse | Pool | | Curse | Pool |
|---|---|---|---|---|---|---|---|
| +00 name str15 | +00 | | +0E4 | +072 | | +13C (2) | +0B8 |
| +10+2i (i=0..5) stat, clamped to race/sex min-max tables DS:3F86.. (race +74 × 16, sex +119); +11+2i := +10+2i | +10+i | | +0E5, +0E6 := +0E5 | +073 | | +13E..142 | +0BA..0BE |
| +1C, +1D | +16 | | +0E7..0EA (8) | +074..077 | | +144 | +0C0 |
| +073..076 (2) | +02D..030 | | +0F6..0FA | +083..087 | | +145 (6) | +0C1 |
| +078, +079 (56) | +032, +033 | | +103 := 300 | — | | +14C | +0C7 |
| +09C := 0 | — | | +109 (8) | +096 | | +151 (52) | +0CC |
| +0DD, +0DE, +0DF (5) | +06B, +06C, +06D | | +119..11B | +09E..0A0 | | +185, +186, +187 (2) | +100..102 |
| +11C/11E/120/122 (2 each) | +0A1/0A3/0A5/0A7 | | +124..126 | +0A9..0AB | | +195..197 | +10C..10E |
| +127 (dword) | +0AC | | +12B, +12C, +12D..12F | +0B0, +0B1, +0B2..0B4 | | +199, +19A..1A2 (2 each), +1A4, +1A5 | +110, +111..119, +11B, +11C |
| +137..139 | +0B5..0B7 | | | | | | |
(n) = byte count when more than one. Field meanings: PARTY.pas.md (character record).

### 4300:1F21 ApplyHillsfarMinimums (M) *nested in ReadCharacter*
Raises the loaded character's stats, hit points, experience and money to the Hillsfar record's values (parent buffer BCh), copies
the Hillsfar flags +B7..BA to +109/+10E/+10B/+10F, sets +E5 := 1, +192 from +26, +78 from +21, `+12C := +78 - ov17 e7`, +1A4 from
+20, and re-runs the level loop ov17 e6 with g_4FC8. Pool: — **new**. Name M (behaviour).

### 4300:228E ReadCharacter (H)
`procedure ReadCharacter(fname [BP+0Eh]: string; var ch [BP+0Ah]: TCharacter; unused [BP+8]: Byte; fromSaveDisk [BP+6]: Boolean)`
(`RETF 0Ch`) — callers: LoadGame (`'CHRDAT'+k+n+'.sav'`, 1, 1), ov17 Add Character (0, 1). The format is g_7584.
Pool: 7500:0AEC — **changed** (three formats, item/effect files).
```pascal
if fromSaveDisk then prompt := 'Put save disk in ' + SaveDrive + ':'   { 4300:22a9 }
else prompt := DiskPrompt[DataSet];                              { 4300:22ee  DS:25AE + 1Eh*DataSet }
OpenWithPrompt(SavePath + fname, prompt, 0, f);                  { 4300:230f / 232a }
DrawText(0, $18, $0A, 0, 'Loading...Please Wait');               { 4300:233e }
case ImportSource of
  0: begin FillChar(ch, $1A6, 0); BlockRead(f, ch, $1A6); Close(f);   { 4300:2363 / 2374 / 2395 }
       ch.effects := nil; ch.items := nil; ch.p18D := nil; ch.next := nil end;
  1: begin GetMem(pool, $11D); BlockRead(f, pool^, $11D); Close(f);   { 4300:23a0 / 23f5 / 2410 }
       ConvertPoolCharacter; FreeMem(pool, $11D) end;            { 4300:241b / 245c }
  2: begin GetMem(hil, $BC); BlockRead(f, hil^, $BC); Close(f);   { 4300:246b / 2484 / 249f }
       CStringToPascal(@hil^[4], nm);                            { 4300:24aa }
       if FindTwinFile('.guy') <> '' then begin                  { 4300:251d }
         { load that .guy (Curse record) as source 0, 258b..25bd }
         ApplyHillsfarMinimums;                                  { 4300:25c8 }
         { starting money items: MakeItem + AppendItemCopy four times (2623..27c9) from Hillsfar +1D, +23, +86, +87 }
       end
       else if FindTwinFile('.cha') <> '' then begin             { 4300:27e7 / 281e }
         { load the Pool .cha (11Dh) and ConvertPoolCharacter 28d9, then ApplyHillsfarMinimums 28ed }
       end
       else begin
         { new character from the Hillsfar record: defaults, race := hil+2Dh + 1 (6 -> 7), RandomWord(256) at 290c,
           class spells via AddEffect (2a31..2c05), TrainCharacter, AddPlatinumOrPool($12C), ConHpBonus }
       end;
       FreeMem(hil, $BC);                                        { 4300:2dc6 }
     end;
end;
{ items: if FileExists(SavePath + base + '.swg') read 3Fh-byte records until EOF into a new list (2e42 .. 2f51) }
{ effects: '.fx', 9-byte records (2f85 .. 3094); Pool source also '.spc', 9-byte records (30d2 .. 31f8) }
FlushGameKeys;                                                   { 4300:3207 }
RecalcItems(ch);                                                 { 4300:320c }
UpdateLevelStats(ch);                                                   { 4300:3217 }
```

### 4300:3254 LoadMonster (H)
`procedure LoadMonster(id [BP+0Ah]: Byte; var ch [BP+6])`. Pool: 7500:0EC4 — **same** structure (240/341 instructions aligned):
`'MON'+id+'CHA'+'.dax'` record (1A6h); a missing record shows `'Unable to load monster'` and ends the game
(ShowBottomPromptAndReadKey 32d7, TerminateGame `{ 4300:32dc }`); then `'SPC'` effects and `'ITM'` items records.

### 4300:351C AddNpcToParty (M)
`procedure AddNpcToParty(id [BP+6]: Byte)`. Pool: 7500:1262 — **changed**.
```pascal
if ecl_Mem7C00^.w[$67C div 2] <= 7 then begin                    { 4300:3526  VM word 7F3E = party size (M) }
  GetMem(ch, $1A6);                                              { 4300:3530 }
  LoadMonster(id, ch^);                                          { 4300:353e }
  ch^.b[$126] := id;                                             { 4300:354c }
  AddToParty(ch^);                                               { 4300:3557 }
  LoadCombatIcon('CPIC', id, id);                                { 4300:3561 }
end;
```

### 4300:35A8 AddToParty (H)
`procedure AddToParty(var ch [BP+6])`. Pool: 7500:1446 — **same** (79/99 aligned): appends to `PartyList` (next +189h), clears
the 8-byte slot, sets the combat icon id from the free set (SetIn 362a), `UpdateLevelStats(ch)` `{ 4300:3651 }`.

### 4300:3748 LoadGame (H)
`procedure LoadGame` (far, stub ov16). Pool: 7500:1602 — **changed** (A..J, item/effect files, CHRDAT names).
```pascal
ImportSource := 0;  if not CheckSaveDisk then Exit;                    { 4300:3748 / 3754 }
menu := '';
for k := 'A' to 'J' do                                           { 4300:375f }
  if FileExists(SavePath + 'savgam' + k + '.dat') then menu := menu + k + ' ';   { 4300:376f / 37b1 }
if menu = '' then Exit;                                          { 4300:37fa }
Delete(menu, Length(menu), 1);                                   { 4300:3804 }
repeat
  k := HorizontalMenu('Load Which Game: ', menu, $0D, $0A, $0F, 0, 0, ext);   { 4300:381a }
until (k in ['A'..'J']) and FileExists(SavePath + 'savgam' + k + '.dat') or (k = #0);   { 4300:384e / 3898 / 38a1 }
if k = #0 then Exit;                                             { 4300:38ab }
OpenWithPrompt(SavePath + 'savgam' + k + '.dat', 'Put save disk in ' + SavePath, 1, f);   { 4300:38b5 }
ClearMenuLine;                                                   { 4300:391a }
DrawText(0, $18, $0A, 0, 'Loading...Please Wait');               { 4300:391f }
Resuming := 1;                                                     { 4300:3940 }
BlockRead(f, DataSet, 1);                                        { 4300:3945 }
BlockRead(f, ecl_Mem4B00^, $800);  BlockRead(f, ecl_Mem7C00^, $800);   { 4300:395f / 397a }
BlockRead(f, ecl_Mem7A00^, $400);  BlockRead(f, ecl_CodeBuf^, $1E00);   { 4300:3995 / 39b0 }
BlockRead(f, party_MapX, 5);  BlockRead(f, view_PrevMode, 1);  BlockRead(f, view_Mode, 1);   { 4300:39cb / 39e5 / 39ff }
for i := 1 to 3 do begin BlockRead(f, Mem[DS:$7210+4*i], 2); BlockRead(f, Mem[DS:$7212+4*i], 2) end;   { 4300:3a19 / 3a24 / 3a4b }
BlockRead(f, count, 1);  BlockRead(f, names, $148);  Close(f);  { 4300:3a79 / 3a94 / 3aaf }
opt_Pics := ecl_Mem4B00^.w[$1FE div 2] div 2;                      { 4300:3aba }
opt_Animation := ecl_Mem4B00^.w[$1FE div 2] and 1;                      { 4300:3acd }
GameSpeed := ecl_Mem4B00^.b[$1F8];                               { 4300:3adc }
ecl_Mem7C00^.w[$67C div 2] := 0;                                 { 4300:3ae8  party size, AddToParty counts again (M) }
for i := 1 to count do begin                                     { 4300:3af3 }
  if FileExists(SavePath + names[i] + '.sav') then begin         { 4300:3b0c .. 3b7d  (DeleteAll / MakeDosName on the name) }
    GetMem(ch, $1A6);                                            { 4300:3b86 }
    ReadCharacter(names[i] + '.sav', ch^, 1, 1);                 { 4300:3b95 }
    AddToParty(ch^);                                             { 4300:3bc2 }
    if not CheckSaveDisk then Exit;                              { 4300:3bce }
  end;
end;
ch := PartyList;                                                 { 4300:3be6 }
while ch <> nil do begin DeleteCharacterFiles(ch^); ch := ch^.next end;   { 4300:3bf4 .. 3c0a }
SelectedChar := PartyList;                                       { 4300:3c1f }
while SelectedChar <> nil do begin                               { 4300:3c2c }
  if ... then LoadCharacterIcon(1)                               { 4300:3c35 / 3c41 }
  else LoadCombatIcon('CPIC', id, id);                           { 4300:3c4a }
  SelectedChar := SelectedChar^.next;                            { 4300:3c73 }
end;
SelectedChar := PartyList;  DataSet := ...;                      { 4300:3c87 / 3c94 }
if ... then begin
  if ... > 0 then Load3DMap(...);                                { 4300:3cba }
  for i := 1 to 3 do                                             { 4300:3cd0 }
    if slot i used then LoadWallSet(Mem[DS:$7210+4*i], Mem[DS:$7212+4*i]);   { 4300:3ce7  wall-set slot i (i = 1: g_7214, g_7216) }
end
else LoadBigPic($79);                                            { 4300:3d17 }
FlushGameKeys;  ClearMenuLine;                                   { 4300:3d1f / 3d24 }
view_PrevMode := ...;  view_Mode := 0;                           { 4300:3d29 / 3d2f }
```
`{ quirk: loading a game deletes the stand-alone .guy/.swg/.fx files of every member by name (3be6): the saved game owns them now
(Pool did the same with its .CHA files). }` The conditions marked `...` at 3c2c..3d29 are not resolved here (L) — see Unknowns.

### 4300:3D38 SaveSize (H) *nested in SaveGame*
Returns Σ over `PartyList` of `1A6h + 3Fh × items + 9 × effects` (Word). Pool: — **new**.

### 4300:3EDD SaveGame (H)
`procedure SaveGame` (far, stub ov16; also from HeapErrorHandler). Pool: 7500:1D58 — **changed**.
```pascal
repeat
  k := HorizontalMenu('Save Which Game: ', 'A B C D E F G H I J', $0D, $0A, $0F, 0, view_Mode = 2, ext);   { 4300:3edd / 3f10 }
until k in [#0, 'A'..'J'];                                       { 4300:3f2d  CS:3E1F }
if k = #0 then Exit;                                             { 4300:3f3e }
ImportSource := 0;                                                     { 4300:3f48 }
if not CheckSaveDisk then Exit;                                  { 4300:3f4e }
if FileExists(SavePath + 'savgam' + k + '.dat') then need := 0 else need := $3208;   { 4300:3f58 / 3f9a / 3fa2 }
need := need + SaveSize;                                         { 4300:3fa8 }
if DiskFree(Ord(UpCase(SaveDrive)) - $40) < need then begin         { 4300:3fb1 }
  ShowBottomPromptAndReadKey($0E, 0, 'Can''t save.  No room on this disk.');  Exit;   { 4300:3fd9 / 3ff4 }
end;
repeat                                                           { 4300:3ff7 }
  Assign(f, SavePath + 'savgam' + k + '.dat');  Rewrite(f, 1);  err := DosError;   { 4300:3ff7 / 403b / 404a }
  if not (err in [0, 2, $12]) then                               { 4300:4051  CS:3E6E }
    if UpCase(SaveDrive) < 'C' then ShowBottomPromptAndReadKey($0E, 0, 'Put save disk in ' + SaveDrive + ':')   { 4300:4065 }
    else begin
      ShowBottomPromptAndReadKey($0E, 0, 'Unexpected error during save: ' + ByteToStr(err));   { 4300:40ad }
      Close(f);  Exit;                                           { 4300:40dd / 40e8 }
    end;
until err in [0, 2, $12];                                        { 4300:40eb }
ClearMenuLine;                                                   { 4300:40ff }
DrawText(0, $18, $0A, 0, 'Saving...Please Wait');                { 4300:4104 }
ecl_Mem4B00^.w[$1F8 div 2] := GameSpeed;                         { 4300:4125 }
ecl_Mem4B00^.w[$1FE div 2] := opt_Pics * 2 + opt_Animation;               { 4300:4133 }
ecl_Mem7C00^.w[$624 div 2] := DataSet;                           { 4300:414c  VM word 7F12 }
BlockWrite(f, DataSet, 1);                                       { 4300:415a }
BlockWrite(f, ecl_Mem4B00^, $800);  BlockWrite(f, ecl_Mem7C00^, $800);   { 4300:4172 / 418b }
BlockWrite(f, ecl_Mem7A00^, $400);  BlockWrite(f, ecl_CodeBuf^, $1E00);   { 4300:41a4 / 41bd }
BlockWrite(f, party_MapX, 5);  BlockWrite(f, view_PrevMode, 1);  BlockWrite(f, view_Mode, 1);   { 4300:41d6 / 41ee / 4206 }
for i := 1 to 3 do begin BlockWrite(f, Mem[DS:$7210+4*i], 2); BlockWrite(f, Mem[DS:$7212+4*i], 2) end;   { 4300:421e .. 426e }
count := 0;  ch := PartyList;                                    { 4300:427a }
while ch <> nil do begin Inc(count); names[count] := 'CHRDAT' + k + Str(count); ch := ch^.next end;   { 4300:428d .. 4319 }
BlockWrite(f, count, 1);  BlockWrite(f, names, $148);  Close(f);   { 4300:431c / 4335 / 434e }
n := 0;  ch := PartyList;                                        { 4300:4359 }
while ch <> nil do begin                                         { 4300:436c }
  Inc(n);
  WriteCharacter(ch^, 'CHRDAT' + k + Str(n));                    { 4300:43a6 / 43d2 }
  DeleteCharacterFiles(ch^);                                     { 4300:43d5 }
  ch := ch^.next;                                                { 4300:43e1 }
end;
GameSaved := 1;                                                     { 4300:43f7  game saved (Pool GameSaved) }
ClearMenuLine;                                                   { 4300:43fc }
```
`{ quirk: a new save file is assumed to need 3208h bytes + the characters, an existing one nothing (it is overwritten in place);
the members' stand-alone .guy files are deleted after the save, as on load. }`

### 4300:4405 ov16_init — empty (H)

---

## ov17 (4800) — top menu, character creation, drop / modify / train, add / remove, icon editor, hit points

Pool twin: Pool ov16 (7000) — **changed**: 12 menu entries (new: Human Change Classes), training from the menu, import from
Pool/Hillsfar in Add Character, a new character is trained with starting experience before it is saved, a CON hit-point
table that knows the fighter classes. Routine pairs below are from `pooltrans.py 7000 4800 --shape` (Pool PARTY.pas.md ov16
sections); "aligned a/b" = instructions matched by difflib.
Record offsets are **Curse** (1A6h record, ENGINE ov16 / PARTY.pas.md): +0 name str15, +10h+2i max / +11h+2i current ability i
(STR INT WIS DEX CON CHA), +1Ch/+1Dh exceptional STR, +73h THAC0, +74h race, +75h class, +76h age (word), +78h HP max, +109h+c
level in base class c (0 Cleric .. 7 Monk), +111h+c former-class levels (M), +119h gender, +11Bh alignment, +124h AC, +125h,
+126h random id, +127h experience (dword), +12Bh class mask, +12Ch HP, +103h money (word), +143h, +144h icon size,
+145h..14Ah icon colours, +195h, +196h NPC flag (M), +1A4h current HP (M).
DS tables (START.EXE image): RaceName string[9] at DS:0E9C (stride 10: Monster Dwarf Elf Gnome Half-Elf Halfling Half-Orc Human),
ClassName string[26] at DS:0CB6 (stride 1Bh, 17 classes Cleric .. Magic-User/Thief), RaceClasses DS:3FF8 (stride 14: count, then
class ids; dwarf / gnome / halfling F T F/T, elf 7, half-elf 13, half-orc 6, human C F MU T Pa Ra), ClassAligns DS:41D8 (stride 10),
TopMenu DS:0551 (12 × 2Ah: string[40] + enabled byte at +29h).

### 4800:0000 ov17_0000 — pre-load overlay units (H)
Calls the empty entries of ov24, ov19, ov22, ov23, ov29, ov33, ov16, ov26, ov32, ov34, ov25 `{ 4800:0000 }`. Pool: — **new**.

### 4800:003E FreeCharacter (H)
`procedure FreeCharacter(var ch [BP+6]: PChar)` — caller: RemovePartyMember. Pool: 7000:0000 — **changed** (51/79): frees the
16h-byte block, the item list (3Fh each `{ 4800:0071 }`), the effect list (9 each `{ 4800:00b1 }`) and the 1A6h record
`{ 4800:00f3 }`, then `ch := nil`.

### 4800:01DD PartyCreationMenu (H)
`procedure PartyCreationMenu` (far, stub ov17) — caller: MainProgram (RESIDENT). Pool: 7000:0161 — **changed** (302/462).
Locals: `savedMode` [BP-10h], `redraw` [BP-0Fh], `row` [BP-0Eh], `i` [BP-1], `ext` [BP-3], `key` [BP-2], `wasHuman` [BP-11h].
Name H (strings `'Choose a function '`, `'Quit to DOS '`; TopMenu texts).
```pascal
savedMode := view_Mode;  view_Mode := 0;                         { 4800:01e4 / 01ea }
redraw := true;  FreeTraining := 0;                                    { 4800:01ef / 01f3  FreeTraining off }
repeat
  if redraw then begin                                           { 4800:01f8 }
    DrawScreenFrame;                                             { 4800:0201 }
    if SelectedChar <> nil then begin                            { 4800:0206 }
      PartySummary(SelectedChar);                                { 4800:0212 }
      TopMenu[1].on := 1;  TopMenu[2].on := 1;                   { 4800:021f / 0224  Drop, Modify }
      if (ecl_Mem7C00^.w[$550 div 2] > 0) or (FreeTraining <> 0) then TopMenu[3].on := 1;   { 4800:0229  Train: VM word 7EA8 = training hall (M) }
      TopMenu[4].on := ((ecl_Mem7C00^.w[$550 div 2] > 0) or (FreeTraining <> 0)) and IsHuman(SelectedChar)
                       and (FormerClass(SelectedChar) = $11);      { 4800:0241 / 027c  Human Change Classes (ov25: may dual-class, M) }
      TopMenu[5].on := 1;  TopMenu[7].on := 1;  TopMenu[8].on := 0;  TopMenu[9].on := 1;  TopMenu[10].on := 1;   { 4800:027f .. 0293  View, Remove, Load off, Save, BEGIN }
    end else begin
      TopMenu[1..5].on := 0;  TopMenu[7].on := 0;  TopMenu[8].on := 1;  TopMenu[9].on := 0;  TopMenu[10].on := 0;   { 4800:029a .. 02c2 }
    end;
    row := 0;                                                    { 4800:02c7 }
    for i := 0 to 11 do                                          { 4800:02cb }
      if TopMenu[i].on <> 0 then begin                           { 4800:02d4 }
        DrawText(2, row + 12, $0F, 0, TopMenu[i].text[1]);       { 4800:02ea  hot letter white }
        DrawText(3, row + 12, $0A, 0, Copy(TopMenu[i].text, 2, Length(TopMenu[i].text) - 1));   { 4800:031c }
        Inc(row);                                                { 4800:0367 }
      end;
    redraw := false;                                             { 4800:0373 }
  end;
  key := HorizontalMenu('Choose a function ', 'C D M T H V A R L S B E J', $0D, 0, 0, 1, 0, ext);   { 4800:0377  DS:0528 }
  ClearMenuLine;                                                 { 4800:03a7 }
  if ext then begin                                              { 4800:03ac }
    if key in ['G', 'O'] then begin                              { 4800:03b5  Home / End }
      wasHuman := IsHuman(SelectedChar) and (FormerClass(SelectedChar) = $11);   { 4800:03c8 / 03f0 }
      CycleSelectedChar(key);                                            { 4800:03f3  select previous / next member }
      PartySummary(SelectedChar);                                { 4800:03fc }
      redraw := (wasHuman xor <same test for the new member>) and (VM 7EA8 > 0 ...);   { 4800:0409 .. 044a  menu changes only then }
    end;
    Continue;                                                    { 4800:044d }
  end;
  if not (key in ['E', 'S']) then GameSaved := 0;                   { 4800:0450 / 0460  "game saved" cleared }
  case key of                                                    { 4800:0465 }
    'C': if TopMenu[0].on <> 0 then CreateCharacter;             { 4800:046c }
    'D': if TopMenu[1].on <> 0 then DropCharacterForever;               { 4800:047e }
    'M': if TopMenu[2].on <> 0 then ModifyCharacter;             { 4800:0490 }
    'T': if TopMenu[3].on <> 0 then TrainCharacter;              { 4800:04a2 }
    'H': if TopMenu[4].on <> 0 then ChangeClass(SelectedChar);     { 4800:04b4  human class change (ov25) }
    'V': if TopMenu[5].on <> 0 then ViewMenu(turnUsed);         { 4800:04cf  view character (ov19) }
    'A': if TopMenu[6].on <> 0 then AddCharacterMenu;            { 4800:04e7 }
    'R': if (TopMenu[7].on <> 0) and (SelectedChar <> nil) then  { 4800:04f9 }
           if SelectedChar^.b[$F7] < $80 then begin              { 4800:0509 }
             WriteCharacter(SelectedChar^, '');                  { 4800:0515  back to <name>.guy }
             RemovePartyMember(0, 1);                            { 4800:0531 }
           end else DropCharacterForever;                               { 4800:053d  flag >= 80h (an NPC): dropped instead }
    'L': if TopMenu[8].on <> 0 then begin                        { 4800:0548 }
           LoadGame;                                             { 4800:054f }
           if ecl_Mem4B00^.w[$3FA div 2] <> 0 then begin         { 4800:0554  VM word 4CFD }
             ShowBottomPromptAndReadKey($0E, 0, 'You''ve already defeated Tyranthraxus.');   { 4800:0560 }
             TerminateGame;                                      { 4800:057a }
           end;
         end;
    'S': if (TopMenu[9].on <> 0) and (PartyList <> nil) then SaveGame;   { 4800:0586 / 0596 }
    'B': if (TopMenu[10].on <> 0) and ((PartyList <> nil) or DemoMode) then begin   { 4800:05a2 / 05a9 / 05b2 }
           view_Mode := savedMode;                               { 4800:05b9 }
           if (Resuming = 0) and (anim_Id <> $50) then begin       { 4800:05bf / 05c6 }
             if view_Mode = 3 then FUN_01A0_0252 else FUN_01A0_0136;   { 4800:05cd / 05d4 / 05db  screen layout (RESIDENT) }
             PartySummary(SelectedChar);                         { 4800:05e0 }
           end
           else if ecl_Mem4B00^.w[$1E4 div 2] = 0 then FUN_01A0_0136;   { 4800:05ef / 05fb }
           ClearMenuLine;                                        { 4800:0600 }
           ecl_Mem7C00^.w[$550 div 2] := 0;                      { 4800:0605  leave the training hall }
           Exit;                                                 { 4800:0610 }
         end;
    'E': if TopMenu[11].on <> 0 then begin                       { 4800:0616 }
           key := AskYesNo('Quit to DOS ', $0E, $0A, $0F);       { 4800:0621 }
           if key = 'Y' then begin                               { 4800:0641 }
             if (PartyList <> nil) and (GameSaved = 0) then begin   { 4800:0647 / 0650 }
               key := AskYesNo('Game not saved.  Quit anyway? ', $0E, $0A, $0F);   { 4800:0657 }
               if key = 'N' then SaveGame;                       { 4800:0677 / 067d }
             end;
             if key = 'Y' then TerminateGame;                    { 4800:0682 / 0688 }
           end;
         end;
    'J': if ParamStr(2) = CopyProtWord then begin                { 4800:068f / 06a7  'Wooden' }
           FreeTraining := not FreeTraining;                                 { 4800:06ae / 06bb }
           if FreeTraining <> 0 then ShowTimedBottomMessage('Free training on')     { 4800:06be / 06c5 }
           else ShowTimedBottomMessage('Free training off');                  { 4800:06dc }
         end;
  end;
  redraw := true;                                                { 4800:06f1 }
until False;                                                     { 4800:06f5 }
```
`{ quirk: "Quit anyway?" N saves and then quits only if SaveGame made the answer 'Y' — it does not, so N saves and returns to
the menu; Y quits without saving. }` (H: key is re-tested at 0682 after SaveGame.) `{ quirk: J toggles free training only with
the start-up parameter 'Wooden' (CopyProtWord, RESIDENT), Pool's STING mode is gone. }` g_7587 = FreeTraining (M).

### 4800:0782 CreateCharacter (H)
`procedure CreateCharacter` (near) — caller: PartyCreationMenu 'C'. Pool: 7000:056C — **changed** (2410/2882 aligned; most
other hunks are the doubled ability stride `SHL AX,1`). Locals: `ch` [BP-4], `p` [BP-53h], `list` [BP-0Ch], `index` [BP-12h],
`key` [BP-16h], `k` [BP-13h]/[BP-17h]/[BP-18h], `abil` [BP-1Bh], `try` [BP-14h], `r` [BP-15h], `cls` [BP-19h], `saved` [BP-8].
```pascal
GetMem(ch, $1A6);  FillChar(ch^, $1A6, 0);                       { 4800:0789 / 0797 }
for k := 1 to 6 do ch^.b[$144 + k] := (IconCol[k] + 8) * 16 + IconCol[k];   { 4800:07b1  DS:3EC1.. = 1 2 3 4 6 7 }
ch^.b[$124] := $32;  ch^.b[$73] := $28;                          { 4800:07f7 / 0800  AC, THAC0 }
ch^.b[$195] := 0;  ch^.b[$196] := 1;  ch^.b[$DE] := 1;           { 4800:0808 / 0811 / 081a }
ch^.b[$126] := RandomWord(256);  ch^.b[$143] := $0A;             { 4800:0823 / 0834 }
{ race }
NewMenuList(7, list);  list^.isHeader := 1;  list^.text := 'Pick Race';   { 4800:083d / 084b / 0853 }
for k := 1 to 7 do                                               { 4800:0866 }
  if k in [1..5] then ListItem(k, list)^.text := '  ' + RaceName[k]   { 4800:0872 }
  else if k = 7 then ListItem(6, list)^.text := '  ' + RaceName[7];   { 4800:08c6  Half-Orc not offered }
repeat
  key := VerticalListMenu('', 'Select', $0D, $0A, $0F, 1, 2, $26, $16, list, showExit, redraw, index, item);   { 4800:091e / 0982 }
  { showExit = 1 (4800:092e): the menu line is `Select Exit`. index = 1 (0929) clamps menu_Top to <= 1 (6800:0ef0), and with menu_Top = 1
    DrawList starts at ListItem(list, 1): the header item 0 `Pick Race` is scrolled off, Dwarf is on row 2 (DOSBox REF-S024, #ref-5); same for gender / class / alignment }
  if key = #0 then begin FreeMenuList(list); FreeMem(ch, $1A6); Exit end;   { 4800:098a / 0995 / 09a3 }
until key = 'S';                                                 { 4800:09ab }
if index = 6 then index := 7;                                    { 4800:09b1 }
ch^.race := index;                                               { 4800:09c9 }
case ch^.race of                                                 { 4800:09d0  icon size + innate effects (AddEffect = AddEffect, ov23) }
  5: begin ch^.b[$144] := 1; AddEffect(ch, $61, 0, $FF, 0) end;                       { 4800:09d8 }
  1: begin ch^.b[$144] := 1; AddEffect(ch, $61..); AddEffect(ch, $1A..); AddEffect(ch, $2F..) end;   { 4800:09fb }
  3: begin ch^.b[$144] := 1; AddEffect $61, $12, $2F, $30 end;                         { 4800:0a50 }
  2: begin ch^.b[$144] := 2; AddEffect(ch, $6B, 0, $FF, 0) end;                         { 4800:0abb }
  4: begin ch^.b[$144] := 2; AddEffect(ch, $7C, 0, $FF, 0) end;                         { 4800:0ae1 }
else ch^.b[$144] := 2;                                           { 4800:0b07 }
end;
FreeMenuList(list);                                              { 4800:0b10 }
{ gender: 'Pick Gender', Male / Female, as race }                { 4800:0b1a .. 0c41 }
ch^.b[$119] := index - 1;                                        { 4800:0c2e }
{ class: 'Pick Class' from RaceClasses[race] }                   { 4800:0c46 .. 0d96 }
ch^.l[$127] := 25000;                                            { 4800:0d9c  experience of a single class }
ch^.class := RaceClasses[race][index];  ch^.b[$E5] := 1;         { 4800:0db6 / 0dd7 }
case ch^.class of                                                { 4800:0de0  level 1 in the base classes; multi-class XP }
  0..2, 5..7: ch^.level[class] := 1;                             { 4800:0de3 }
  3: begin ch^.b[$191] := 1; ch^.level[3] := 1; AddEffect(ch, 8, 0, $FF, 0) end;   { 4800:0e23 }
  4: begin ch^.level[4] := 1; AddEffect(ch, $86, 0, $FF, 0) end;  { 4800:0e53 }
  8: C+F, XP 12500;  9: C+F+MU, XP 8333;  10: C+R + AddEffect $86, XP 12500;  11: C+MU, 12: C+T, 13: F+MU, 14: F+T, XP 12500;
  15: F+MU+T, XP 8333;  16: MU+T, XP 8333;                       { 4800:0e7a .. 1011 }
end;
if ch^.level[6] > 0 then UpdateThiefSkills(ch);                          { 4800:101b / 1029  thief skills }
ch^.b[$12B] := 0;  ch^.b[$73] := 0;                              { 4800:1031 / 103a }
for cls := 0 to 7 do if ch^.level[cls] > 0 then begin            { 4800:103f / 1051 }
  if BaseThac0[cls] > ch^.b[$73] then ch^.b[$73] := BaseThac0[cls];   { 4800:1077 / 10a9  DS:3E38 }
  ch^.b[$12B] := ch^.b[$12B] + ClassBit[cls];                    { 4800:10b3  DS:3EA0 = 2 16 8 64 64 1 4 32 }
end;
UpdateSaves(ch);                                                   { 4800:10c5  saving throws }
{ alignment: 'Pick Alignment' from ClassAligns[class] }          { 4800:10d0 .. 122a }
ch^.b[$11B] := ClassAligns[class][index];                        { 4800:1246 }
{ age (word +76h): single class base + Roll(dice, sides) from DS:404C.. (race × 28, class × 4); multi-class: maximum of the
  cleric / magic-user / fighter entry, as Pool }                 { 4800:125c .. 15a9 }
saved := SelectedChar;  SelectedChar := ch;  ov19 e1;            { 4800:15b6 / 15c5  character sheet }
reroll:
for cls := 0 to 7 do if ch^.level[cls] > 0 then ch^.level[cls] := 1;   { 4800:15ca / 15ef  back to level 1 }
{ abilities: Pool's best-of-six 3d6 rolls with race / class minimums and exceptional strength (current value +11h+2i);
  Curse: exceptional STR also for a fighter, paladin or ranger level (+10Bh / +10Ch / +10Dh) }   { 4800:15fb .. 2094 }
ch^.b[$125] := 1;  ch^.b[$E4] := $0C;                            { 4800:20a3 / 20ac }
FillChar(ch^.b[$12D], $0F, 0);                                   { 4800:20bd  new }
for cls := 0 to 7 do if ch^.level[cls] > 0 then ...              { 4800:20d2 .. 2130  +12Dh/+137h flags, Roll rolls }
WisdomBonusSpells(ch);                                                   { 4800:2130 }
{ +78h/+83h/+84h/+8Ah/+8Dh flags as Pool }                       { 4800:2145 .. 21af }
ch^.w[$103] := 300;                                              { 4800:21c4  money: fixed 300 (Pool rolled gold) }
ch^.b[$12C] := RollHitDice(ch, $FF);  ch^.b[$78] := ch^.b[$12C];   { 4800:21cb / 21e3 }
n := number of classes with level > 0;                          { 4800:20b9 / 21b5  [BP-20h] }
bonus := ConHpBonus(ch);                                         { 4800:21f6 / 21fa }
if bonus >= 0 then ch^.b[$78] := (ch^.b[$78] + bonus) div n      { 4800:21fd / 224d .. 2266 }
else if ch^.b[$78] > n + Abs(bonus) then ch^.b[$78] := (ch^.b[$78] + bonus) div n   { 4800:2203 .. 223d }
else ch^.b[$78] := 1;                                            { 4800:2243 }
ch^.b[$1A4] := ch^.b[$78];                                       { 4800:226d }
{ new: train the character up to its starting experience }
oldHall := ecl_Mem7C00^.b[$550];  ecl_Mem7C00^.w[$550 div 2] := $FF;   { 4800:2295 / 22a1 }
g_7586 := 0;  g_4FC8 := 1;                                       { 4800:22ac / 22b1 }
TrainCharacter;                                                  { 4800:22b6 }
if g_7586 <> 0 then ... ;                                        { 4800:22ba }
ecl_Mem7C00^.w[$550 div 2] := oldHall;  g_4FC8 := 0;             { 4800:22c1 / 22cf }
levels := '';                                                    { 4800:22d4 }
for cls := 0 to 7 do                                             { 4800:22dc }
  if (ch^.level[cls] > 0) or (ch^.b[$111+cls] > 0) and (ch^.b[$111+cls] >= ov25 e?(ch)) then begin   { 4800:22e5 .. 232c }
    if levels <> '' then levels := levels + '/';                 { 4800:2331 }
    levels := levels + ByteToStr(ch^.b[$111+cls] + ch^.level[cls]);   { 4800:235f }
  end;
DrawText(7, $0F, $0F, 0, levels);                                { 4800:23bf }
DrawCombatStats;  DrawMoney;                                           { 4800:23d5 / 23da  redraw the sheet }
if AskYesNo('Reroll stats? ', $0D, $0A, $0F) <> 'N' then goto reroll;   { 4800:23df / 23ff / 2405 }
ov19 e1;                                                         { 4800:2408 }
repeat ch^.name := ReadBottomLine('Character name: ', $0D, 0, $0F) until ch^.name <> '';   { 4800:240d / 243e }
IconEditor;                                                      { 4800:2448 }
for abil := 0 to 5 do ch^.b[$10 + 2*abil] := ch^.b[$11 + 2*abil];   { 4800:244b  max := current }
ch^.b[$1D] := ch^.b[$1C];                                        { 4800:2478 }
if AskYesNo('Save ' + ch^.name + '? ', $0D, $0A, $0F) = 'N' then begin   { 4800:2486 / 24bb }
  FreeMem(ch, $1A6);  SelectedChar := saved;  Exit;              { 4800:24c1 / 24cf }
end;
WriteCharacter(ch^, '');                                         { 4800:24dd }
FreeMem(ch, $1A6);  SelectedChar := saved;                       { 4800:24f7 / 2505 }
```
`{ quirk: the created character is only written to disk (<name>.guy), not added to the party; Add Character loads it. }`
`{ quirk: Esc in any of the four menus frees the list and the record (Pool leaked them). }` The ability-roll block and the
age tables are Pool's (PARTY.pas.md 7000:056C, lines "ability rolls") with the Curse stride; their statements are not repeated
here (Unknowns).

### 4800:2515 ConHpAdj (M)
`function ConHpAdj(cls [BP+6]: Byte): ShortInt` (`RETF 2`) — callers: ModifyCharacter, MaxHitPoints. CON of SelectedChar
(+19h current): 3 → -2, 4..6 → -1, 7..14 → 0, 15 → 1, 16 → 2, 17..19 → CON-14 for cls in [2,3,4] (fighter, paladin, ranger) else 2
`{ 4800:251b .. 2598 }`. Pool: — **new** (Pool 7000:3F31 had no class test). Name M (AD&D table).

### 4800:260C DropCharacterForever (H)
`procedure DropCharacterForever` — (renamed from Pool's DropCharacter: MAGIC 4000:199C keeps that name; this one deletes the character, prompt `Drop NAME forever?`) callers: PartyCreationMenu 'D' and 'R' (NPC). Pool: 7000:1F37 — **changed** (texts).
```pascal
if SelectedChar = nil then Exit;                                 { 4800:2613 }
if AskYesNo('Drop ' + SelectedChar^.name + ' forever? ', $0E, $0A, $0F) = 'Y' then   { 4800:261f / 265b }
  if AskYesNo('Are you sure? ', $0E, $0A, $0F) = 'Y' then begin   { 4800:2662 / 2680 }
    if SelectedChar^.b[$196] = 0 then ShowTimedBottomMessage('You dump ' + name + ' out back.')   { 4800:2684 / 26b3 }
    else ShowTimedBottomMessage(name + ' bids you farewell.');                { 4800:26ba / 26d4 }
    DeleteCharacterFiles(SelectedChar^);                         { 4800:26d9 }
    RemovePartyMember(0, 1);                                     { 4800:26e6 }
    Exit;
  end;
ShowTimedBottomMessage(name + ' breathes a sigh of relief.');                 { 4800:26f2 / 270c }
PartySummary(SelectedChar);                                      { 4800:2711 }
```

### 4800:2724 DrawModifyField (M) *nested in ModifyCharacter*
Draws one stat line of the Modify screen: DrawAbility, DrawHP(SelectedChar, 4, $12, field), ClearGlyphRun, DrawText rows 1
(`{ 4800:2724 }` .. 2822). Pool: 7000:2033 — **changed**.

### 4800:2868 ModifyCharacter (H)
`procedure ModifyCharacter` — caller: 'M'. Pool: 7000:209F — **changed** (674/1290): `'Modify: '` menu `'Keep Exit'`, cursor keys
by ReadGameKey, `name + " can't be modified."` (ShowTimedBottomPrompt), RecalcItems ×3, WisdomBonusSpells, DrawCombatStats; the HP range uses
MinHitPoints / MaxHitPoints / ConHpAdj. Statements follow Pool's body with the Curse offsets (Unknowns).

### 4800:3680 AddCharacterMenu (H)
`procedure AddCharacterMenu` — caller: 'A'. Pool: 7000:306D — **changed** (192/378: import).
```pascal
ClearRectangle(1, 1, $26, $16);                                  { 4800:3680 }
key := HorizontalMenu('Add from where? ', 'Curse Pool Hillsfar Exit', $0D, $0A, $0F, 0, 0, ext);   { 4800:36a4 }
case key of 'C': ImportSource := 0;  'P': ImportSource := 1;  'H': ImportSource := 2;   { 4800:36db / 36ec / 36f7 }
  'E', #0: Exit;                                                 { 4800:3702 }
end;
if not BuildCharacterFileList(names, files) then Exit;           { 4800:370d / 3722 }
repeat
  key := VerticalListMenu('Add a character: ', 'Add ', $0D, $0A, $0F, 1, 2, $26, $16, names, ...);   { 4800:373b / 3787 }
  if (key in [#13, 'A']) and (item^.text[1] <> '*') then begin   { 4800:378f / 37a1 }
    ClearMenuLine;                                               { 4800:37ab }
    GetMem(ch, $1A6);                                            { 4800:37b0 }
    ReadCharacter(ListItem(index, files)^.text, ch^, 0, 1);      { 4800:37be / 37cc }
    { checks before AddToParty (3810 / 38d3) + LoadCharacterIcon(1) (3833 / 3961): 'paladins do not join with evil scum',
      'too many rangers in party' (ranger level +10Dh > 0 and already more than 2, 39bb), paladin + evil member:
      name + ' will tolerate no evil!' (3a14); a rejected record is freed (3a22) }
  end;
until (key in ['E', #0]) or (count > 5) or (ecl_Mem7C00^.w[$67C div 2] > 7);   { 4800:3a27 .. 3a43 }
FreeMenuList(names);                                             { 4800:3a48 }
```

`{ quirk: only the name list is freed; the file-name list (files) leaks on every visit. }` (H: one FreeMenuList call, 3a4d.)

### 4800:3A56 RemovePartyMember (H)
`procedure RemovePartyMember(free [BP+8], redraw [BP+6]: Byte)` — name from ecl_names.json (cab-ecl). Pool: 7000:3291
RemoveFromParty — **same** (73/104): unlinks SelectedChar from PartyList, FreeCombatIcon `{ 4800:3a56 }`, FreeCharacter
`{ 4800:3ae3 }` / `{ 4800:3b36 }`, selects the next member.

### 4800:3B99 DrawIconPreview (M) / 4800:3C78 CopyIconSlot (M) / 4800:3EE3 IconEditor (H)
Pool: 7000:34DF / 35BE / 382D — **same** (92/102, 200/206, 661/713); IconEditor strings `'Sorry, not in CGA'`, `'Small'`
`'Large'`, `'Face'` `'Hair'`, `'old'` `'new'`, `'ready   action'`, `'Is this icon ok? '`. Menus (DS typed constants, `IconMenu[k]` = DS:0721 + k*29h, shown by HorizontalMenu 4800:409a): 1 `Parts 1st-color 2nd-color Size Exit`, 2 `Head Weapon Exit`, 3 `Weapon Body xxxx Shield Arm Leg Exit` (`xxxx` := `Hair` for key 1 / `Face` for key 2, Delete + Insert at position 0Dh, 4800:40f9 / 4153), 4 ` Keep Exit`, 5 `Next Prev Keep Exit` (#ref-8). The Pool sections apply with the Curse
icon fields (+144h size, +145h..14Ah colours). Pool's PortraitMenu (7000:33E7) has no Curse twin (no portraits).

### 4800:45E9 ConHpBonus (H)
`function ConHpBonus(var ch [BP+6]): ShortInt` (`RETF 4`) — callers: CreateCharacter, MinHitPoints, TrainCharacter, ov16
ReadCharacter. Pool: 7000:3F31 — **changed** (37/93).
```pascal
bonus := 0;                                                      { 4800:45ef }
for cls := 0 to 7 do                                             { 4800:45fc }
  if (ch.level[cls] > 0) and (ch.level[cls] < HitDiceLevels[cls]) then begin   { 4800:4605 / 4619  DS:3EB9 = 10 15 10 10 11 12 11 19 }
    bonus := bonus + ConBonus[ch.b[$19]];                        { 4800:4638  DS:427F }
    if ch.class in [2, 3, 4] then case ch.b[$19] of 17: +1; 18: +2; 19, 20: +3; 21..23: +4; 24, 25: +5 end;   { 4800:464a .. 46b0 }
    if (cls = 4) and (ch.level[4] = 1) then bonus := bonus * 2;  { 4800:46b4  ranger: two dice at level 1 }
  end;
ConHpBonus := bonus;                                             { 4800:46dd }
```

### 4800:46EC MinHitPoints (M) / 4800:47C6 MaxHitPoints (M) / 4800:4A12 RollHitDice (H) / 4800:4B12 PayGold (H)
Pool: 7000:3FB3 (83/88), 408C (119/242), 4235 (49/98), 42ED (109/127) — **same** logic; MinHitPoints calls ConHpBonus and divides by the number of classes exactly as CreateCharacter 4800:21ef..2266 (`{ 4800:4754 .. 4790 }`)
`{ 4800:46ec }`, MaxHitPoints ConHpAdj `{ 4800:47c6 }`, RollHitDice `Roll(level, HitDie[cls])` (DS:0820) `{ 4800:4a12 }`,
PayGold the LongMul/LongDivMod coin conversion `{ 4800:4b12 }`.

### 4800:4D2A TrainCharacter (H)
`procedure TrainCharacter` — callers: 'T', CreateCharacter, ov16 ReadCharacter (Hillsfar). Pool: 7000:29AE — **changed**
(602/899): `'we only train conscious people'`, `"We don't train that class here"` (VM 7EA8 hall mask), `'Not Enough Experience'`,
`'Training costs 1000 gp.'` `'Do you wish to train? '` (skipped when g_4FC8 = 1 or FreeTraining g_7587), `' will become:'`,
`'and a level '` / `'    a level '`, `'Congratulations...'`; ConHpBonus / RollHitDice for the new hit points, PayGold, UpdateLevelStats.
g_7586 = "trained" result flag read by CreateCharacter (M).

### 4800:56BC ov17_init — empty (H)

---

## Unknowns (explicit)
- ov00: HeapErrorHandler's result [BP-2] is never assigned (returns stack garbage; never used because TerminateGame does not return).
- ov11: g_4FBE / g_4FBF meanings (saved as one word 4BFF = g_4FBE*2 + g_4FBF; Pool opt_MonsterPics / opt_Portraits by position, M).
- ov16: ReadCharacter's Hillsfar "new character" branch (4300:2905 .. 2d9d) is summarised, not written statement by statement;
  LoadGame's icon / map conditions 4300:3c2c .. 3d29 are marked `...` (L); ScanCharFiles' 16-byte name filter details (StrCompare
  0337) are summarised. ApplyHillsfarMinimums is summarised from its stores (M).
- ov17: the ability-roll block of CreateCharacter (4800:15fb .. 2094), the age tables and ModifyCharacter / TrainCharacter /
  IconEditor bodies follow Pool's PARTY.pas.md text (instruction-aligned, Curse stride / offsets) and are not repeated here
  statement by statement; g_7586 (TrainCharacter result) and VM word 7EA8 (training hall) are M; IsHuman / FormerClass = $11
  (the Human Change Classes test) are other lanes' routines, meaning M; +111h+c "former class level" is M.
- Record fields named here by behaviour only (no strings): +125h, +143h, +195h, +196h (NPC flag, M from DropCharacterForever's two
  messages), +DEh, +E4h, +E5h.

## Self-check
Method: `scratchpad/sample_eng.py` (seed 20261020) drew 50 of the 506 anchored Pascal statements (10%) at random; each was
re-read against the listing instructions at its address (decode/listings/ov00..ov17.lst). Sample (line numbers at the time of
the check): ov01 74, 77, 83, 89, 91, 99, 111, 123; ov03 165, 169, 172; ov11 244, 245, 248, 249, 253, 267, 280, 283, 310, 315;
ov16 458, 469, 481, 528, 532, 550, 571, 589, 600, 616, 671, 684; ov17 733, 744, 761, 778, 779, 781, 797, 801, 802, 818, 822, 835,
859, 896, 953, 954, 961.
Result: **48 / 50 agree**. Fixed: L550 `FreeMem(hil, $BC)` anchor 2d9d → 2dc6 (2d9d starts the preceding HP stores);
L961 AddCharacterMenu frees only one list (the second `FreeMenuList(files)` was not in the asm; added as a quirk).
Earlier checks in this unit: `anchorcheck.py` on the whole file (every `{ seg:off }` is an instruction start), argcheck (0
MISMATCH after splitting four two-call lines and correcting LoadGame's LoadWallSet arguments to the slot words
`[7210h+4i]/[7212h+4i]`), and the ECL region index rule (VM addresses quoted for 7C00/4B00 byte offsets corrected to
word indexing: 7EA8, 7F12, 4CFD).

**DOSBox oracle (acceptance/ref/DECODE_CHECKS.md, #ref-2..5, #ref-8), applied by cab-ref-fixes:** (1) #ref-2 is a
code-reading error in the comments: `DrawTile24(col, row, ...)` draws into the view picture, which FlushViewDirtyLines
0297:1316 shows at pixel (8, 8), so the runes of RuneWheelCheck appear at screen cells (18, 4) / (18, 8), not at the
argument cells (17, 3) / (17, 7) — comments at 2600:01dc / 01ee and ENGINE-06 corrected (statements unchanged).
(2) #ref-5: the `Pick Race` / `Gender` / `Class` / `Alignment` header items exist but are scrolled off (menu_Top
clamped to index = 1, 6800:0ef0) and the menu line is `Select Exit` (showExit = 1) — comment added at 4800:091e, ENGINE-25
corrected. (3) #ref-4 was not a code error: the `Game not saved.  Quit anyway? ` prompt is a second question after Y to
`Quit to DOS ` (4800:0647..0657, GameSaved cleared by every top-menu key except E / S at 4800:0450); ENGINE-23 now says
so. (4) #ref-3 / #ref-8 were SCREENS wording / completeness (the visible 0Dh prompt; the five IconMenu strings DS:074A..07EE).
