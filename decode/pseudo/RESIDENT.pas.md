# RESIDENT — main program + resident game units (FINAL pseudocode, lane cab-mod-resident = cab-rt, Opus)

Units (herdr/assignments/cab-areas.md, resident area): main_0000, res_01A0, res_020F, res_0297, res_0542, res_0636,
res_06EA, res_0713 (+ res_097D, one statement). Not here: the empty units 0186/019B (init `55 89 E5 89 EC 5D CB` only)
and the four TP runtime units (decode/rt/RT_LEDGER.md). Screens: `RESIDENT_SCREENS.md`. Names:
`decode/names/res_names.json` (routine anchors) + `decode/names/resident_names.json` (this lane: further routines and DS globals; evidence in the sections below).
Pool twin: the resident sections of `PoolRadianceRE/decode/pseudo/ENGINE.pas.md` (03F1, 042B, 0464, 0709, 0802, 0899,
08AE). Pool's text was ported onto our addresses with `decode/tools/pooltrans.py` (instruction alignment of the twin
routines) and then **checked statement by statement against our asm** (`decode/listings/res_*.lst`); every routine has a
`Pool:` line (same / changed / new).

Conventions (as Pool ENGINE.pas.md)
- **Signatures in Pascal order**: first parameter = highest BP offset = pushed first; parameters as `name [BP+xx]`.
  Every call was written from its PUSH sequence (first pushed = first argument); Ghidra's C lists them reversed.
- `{ seg:off }` = first instruction of the statement (image-relative resident addresses, lower case as in the listings);
  `{ quirk: ... }` = behaviour a faithful port must copy.
- Globals by `decode/GLOBALS.md` name (`g_XXXX` = DS:XXXX when unnamed); Pool equivalents in GLOBALS.md's Pool column.
  Unit 0713 switches DS to its own code segment; its private variables are `cs0713_XXXX`.
- Runtime calls as the Pascal they implement (RT_LEDGER.md names). String constants passed as value parameters compile
  to `@StrCopy(temp, const)` that leaves the temp on the stack as the argument (TP convention); written as the literal.
- Overlay routines by their listing names (`ovNN_XXXX`, or the ECL/VIEW lanes' names where present).

---

## main_0000 (0000) — program body

### 0000:002F MainProgram (H)
`program Curse` — entry point of START.EXE (MZ CS:IP 0000:002F; not packed). Callers: none (DOS). Locals: `s [BP-100h]`
(ParamStr temp), two string temps `[BP-1Fh]`, `[BP-29h]`. The bytes at 0000:0000 are the Pascal strings `'STING'`,
`'Curse of the Azure Bonds v1.0 '` (0000:0006), `'Play Demo'` (0000:0025).
Pool: 0000:0006 MainProgram — **changed** (sound start/stop around every phase, the demo prompt and the demo loop,
the second command-line word that skips the copy protection, overlay pre-load calls).
```pascal
{ unit initialisation chain (48 far calls, TP order: System first, then the units in reverse segment order) }
System.Init; Crt.Init; FUN_097D_0000 {g_8C80 := 'Wooden'}; FUN_0713_0110; FUN_06EA_0282;     { 0000:002f .. }
FUN_0636_0B2F; FUN_0542_0D20; FUN_0297_21DC; StartupConfiguration {startup configuration};
ov35_init; FUN_01A0_06A5; ov34_init; FUN_019B_0000; ov33_init .. ov31_init; FUN_0186_0000; ov30_init .. ov00_init;  { .. 0000:011a  overlay inits via stub entry 0 }
{ program body }
StartSound;                                              { 0000:0126  StartSound }
if SoundTimerOn then PlayOrStopSound(SndShutdown);       { 0000:012b  g_5BEC; SndShutdown = g_25AA = $00FF }
ov11_0000;                                               { 0000:013b  pre-load overlay units (calls entry 0 of ov14, ov22, ov35, ov33, ov29, ov12, ov26, ov34) }
ov11_0056;                                               { 0000:0140  engine start-up: BIOS keyboard flags, Randomize, buffers, pictures (ENGINE lane) }
if not SoundTimerOn then StartSound;                     { 0000:0145 }
PlayOrStopSound(SndStop);                                { 0000:0151  SndStop = g_25AC = 0 }
StartSound;                                              { 0000:015a }
if ParamStr(1) <> 'STING' then                           { 0000:015f  'STING' at 0000:0000 }
  ShowTitle;                                             { 0000:017a  title + credits ("based on the tsr novel azure bonds") }
menu_Timeout := 3000;  menu_TimeoutKey := 'D';           { 0000:017f  longint g_7296/g_7298 (hundredths, 30 s), g_729A }
g_47DE := HorizontalMenu('Curse of the Azure Bonds v1.0 ', 'Play Demo', $0D, $0A, $0F, false, false, g_47DF);   { 0000:0190  HorizontalMenu (Pool 9D00:03BD); var ext = g_47DF }
menu_Timeout := 0;  menu_TimeoutKey := #0;               { 0000:01ca }
if g_47DE = 'D' then DemoMode := true;                   { 0000:01d7  g_4FBC }
repeat                                                   { 0000:020a  loop head (the demo branch jumps back here) }
  if DemoMode then begin DataSet := 1; GameSpeed := 9 end   { 0000:020a  g_5BEE / g_4FA9 }
  else DataSet := 2;                                     { 0000:021d }
  if SoundTimerOn then PlayOrStopSound(SndShutdown);     { 0000:0222 }
  ov17_0000;                                             { 0000:0232  pre-load overlay units (ov24, ov19, ov22, ov23, ov29, ov33, ov16, ov26, ov32, ov34, ov25) }
  if not SoundTimerOn then StartSound;                   { 0000:0237 }
  if not DemoMode then PartyCreationMenu;                        { 0000:0243  top menu "Choose a function" (create/load party, quit) }
  if SoundTimerOn then PlayOrStopSound(SndShutdown);     { 0000:024f }
  ov30_LoadDeps;                                             { 0000:025f  pre-load ov35, ov34 }
  if not SoundTimerOn then StartSound;                   { 0000:0264 }
  SetBackdropColours(backdrop_C0, backdrop_C1, backdrop_C2, backdrop_C3);             { 0000:0270  SetBackdropColours (stores its 4 args into 720A..720D: re-applies the current ones) }
  if SoundTimerOn then PlayOrStopSound(SndShutdown);     { 0000:0285 }
  ov02_LoadDeps;                                             { 0000:0295  pre-load 15 units for the ECL game loop }
  if not SoundTimerOn then StartSound;                   { 0000:029a }
  ecl_GameLoop;                                          { 0000:02a6  ov02 (ECL lane) }
  if SoundTimerOn then PlayOrStopSound(SndShutdown);     { 0000:02ab }
  ov11_0000;                                             { 0000:02bb }
  if not SoundTimerOn then StartSound;                   { 0000:02c0 }
  ov11_06D8;                                             { 0000:02cc  reset the game state (view buffers, ECL memory, party position 7,13 facing 2) }
  if DemoMode then begin                                 { 0000:02d1  after a demo run: the title again }
    ShowTitle;                                           { 0000:02db }
    FlushGameKeys;                                       { 0000:02e0  06EA:024C }
    menu_Timeout := 1000;  menu_TimeoutKey := 'D';       { 0000:02e5  10 s }
    g_47DE := HorizontalMenu('Curse of the Azure Bonds v1.0 ', 'Play Demo', $0D, $0A, $0F, false, false, g_47DF);   { 0000:02f6 }
    menu_Timeout := 0;  menu_TimeoutKey := #0;           { 0000:0330 }
    DemoMode := g_47DE = 'D';                            { 0000:033d }
    if (ParamStr(2) <> CopyProtWord) and not DemoMode then RuneWheelCheck;   { 0000:034d  CopyProtWord = g_8C80 = 'Wooden' }
    PlayOrStopSound(SndStop);                            { 0000:0374 }
  end;
until false;                                             { 0000:037d  JMP 020a: the body never exits; Quit is TerminateGame inside the menus }
```
The first pass (before the loop head) also runs, after the prompt: `if (ParamStr(2) <> g_8C80) and not DemoMode then
RuneWheelCheck;` `{ 0000:01e3 .. 0205 }` (ov03 entry 1, copy protection).
`{ quirk: START.EXE STING skips the credits only (in Curse the copy protection is skipped by the SECOND word: START.EXE <any> Wooden;
g_8C80 is a string[20] variable that unit 097D initialises from the typed constant DS:24EC = 'Wooden'). Pool skipped both with STING. }`
`{ quirk: any key other than D at the "Play Demo" prompt, or 30 s without a key in the first prompt, decides: the default key is 'D',
so an idle start runs the demo (matches the DOSBox reference run: prompt, then the attract demo). }`
`{ quirk: the demo uses data set 1 and GameSpeed 9; after the demo the loop shows the credits and the prompt again (10 s timeout). }`

### 097D:0000 FUN_097D_0000 — unit init (H)
`CopyProtWord := g_24EC` — `@StrAssign(DS:8C80, DS:24EC, 20)` `{ 097d:0000 }`: string[20] variable := typed constant 'Wooden'.
Pool: 0A31:0000 (empty there) — **new**.

---

## res_01A0 (01A0) — screen frame layouts and rectangle clear

Curse draws every frame cell from a per-cell symbol table (8×8 symbols of the font set 8X8D, drawn by
`Put8x8Symbol(col, row, sym, toView, masked)` = Put8x8Symbol via stub ov35 e3, name H from its own string
"Bad symbol number in Put8x8Symbol." at 7400:0150; Pool twin CA00:015D). The tables are bytes in DS (typed constants):
`FrameTop` g_0B4E[0..39], `FrameBar` g_0B76[0..39], `FrameBottom` g_0B9E[0..39], `FrameLeft` g_0BE0[0..23],
`FrameRight` g_0C09[0..23], `FrameMidCol` g_0BF8[0..16], `PicBoxTop` g_0BC4[2..14], `PicBoxBottom` g_0BD1[2..14],
`PicBoxLeft` g_0C1F[2..14], `PicBoxRight` g_0C2C[2..14], `CombatLeft` g_0C3B[0..22], `CombatMid` g_0C52[0..22],
`CombatRight` g_0C69[0..22]; symbol = table byte + 11Eh (outer frames) or + 114h (picture box). Text grid 40×25 cells.
Pool: 03F1 had DrawFrame(x1,y1,x2,y2,style) with 3 symbols per style; **changed**: Curse has fixed layouts with no parameters.

### 01A0:0000 DrawScreenFrame (H)
`procedure DrawScreenFrame` — 19 callers (ov05, ov06, ov15, ov17, ov19, ov21, ov24, RuneWheelCheck, ecl_op2E_Damage, and the
four layout routines below). Pool: no twin (Pool's DrawTitledFrame(1,1,$26,$16,...) does this job) — **new**.
```pascal
ClearRectangle(1, 1, $26, $16);                                         { 01a0:0006 }
for i := 0 to $27 do Put8x8Symbol(i, 0, FrameTop[i] + $11E, 0, 0);     { 01a0:0016 / 003d  row 0 }
for j := 0 to $17 do begin                                              { 01a0:0048 }
  Put8x8Symbol(0, j, FrameLeft[j] + $11E, 0, 0);                        { 01a0:0051 }
  Put8x8Symbol($27, j, FrameRight[j] + $11E, 0, 0);                     { 01a0:0074 }
end;
for i := 0 to $27 do Put8x8Symbol(i, $17, FrameBottom[i] + $11E, 0, 0); { 01a0:009d  row 23 }
```

### 01A0:00D3 FUN_01A0_00D3 — screen frame with bars at rows 3 and 8 (H)
Caller: ov01 (title/credits). Pool: none — **new**.
```pascal
DrawScreenFrame;                                                        { 01a0:00da }
for i := 0 to $27 do begin                                              { 01a0:00dd }
  Put8x8Symbol(i, 3, FrameBar[i] + $11E, 0, 0);                         { 01a0:00e6 }
  Put8x8Symbol(i, 8, FrameBar[i] + $11E, 0, 0);                         { 01a0:0109 }
end;
```

### 01A0:0136 FUN_01A0_0136 — explore layout: picture box, side column, text window (H)
Callers: ov02, ov17, ov24. Pool twin by role: 00BA:272A DrawStandardFrames(inner = true) — **changed** (cell tables).
```pascal
DrawScreenFrame;                                                        { 01a0:013d }
for i := 0 to $27 do Put8x8Symbol(i, $10, FrameBar[i] + $11E, 0, 0);   { 01a0:0140  bar above the text window, row 16 }
for j := 0 to $10 do Put8x8Symbol($10, j, FrameMidCol[j] + $11E, 0, 0); { 01a0:0172  column 16, rows 0..16 }
for i := 2 to $0E do begin                                              { 01a0:01a4  picture box (2,2)-(14,14) }
  Put8x8Symbol(i, 2, PicBoxTop[i] + $114, 0, 0);                        { 01a0:01ad }
  Put8x8Symbol(i, $0E, PicBoxBottom[i] + $114, 0, 0);                   { 01a0:01d0 }
end;
for j := 2 to $0E do begin                                              { 01a0:01f9 }
  Put8x8Symbol(2, j, PicBoxLeft[j] + $114, 0, 0);                       { 01a0:0202 }
  Put8x8Symbol($0E, j, PicBoxRight[j] + $114, 0, 0);                    { 01a0:0225 }
end;
```

### 01A0:0252 FUN_01A0_0252 — screen frame + text-window bar (H)
Callers: ov04, ov17, ov29. Pool twin by role: DrawStandardFrames(false) — **changed**.
```pascal
DrawScreenFrame;                                                        { 01a0:0259 }
for i := 0 to $27 do Put8x8Symbol(i, $10, FrameBar[i] + $11E, 0, 0);   { 01a0:025c }
```

### 01A0:0292 FUN_01A0_0292 — upper frame redraw (H)
Caller: ov19. Same as DrawScreenFrame + bar at row 16, but clears only rows 1..16 (the text window below is kept). **new**.
```pascal
ClearRectangle(1, 1, $26, $10);                                         { 01a0:0298 }
for i := 0 to $27 do Put8x8Symbol(i, 0, FrameTop[i] + $11E, 0, 0);     { 01a0:02a8 }
for j := 0 to $17 do begin                                              { 01a0:02da }
  Put8x8Symbol(0, j, FrameLeft[j] + $11E, 0, 0);                        { 01a0:02e3 }
  Put8x8Symbol($27, j, FrameRight[j] + $11E, 0, 0);                     { 01a0:0306 }
end;
for i := 0 to $27 do Put8x8Symbol(i, $17, FrameBottom[i] + $11E, 0, 0); { 01a0:032f }
for i := 0 to $27 do Put8x8Symbol(i, $10, FrameBar[i] + $11E, 0, 0);   { 01a0:0361 }
```

### 01A0:0397 FUN_01A0_0397 — combat layout: map window + side panel (H)
Caller: ov24. Pool twin by role: 00BA:2B88 DrawCombatLayout (two titled frames) — **changed**.
```pascal
ClearRectangle(0, 0, $27, $17);                                         { 01a0:039d  whole screen }
for i := 0 to $27 do Put8x8Symbol(i, 0, FrameTop[i] + $11E, 0, 0);     { 01a0:03ad }
for j := 0 to $16 do begin                                              { 01a0:03df }
  Put8x8Symbol(0, j, CombatLeft[j] + $11E, 0, 0);                       { 01a0:03e8 }
  Put8x8Symbol($16, j, CombatMid[j] + $11E, 0, 0);                      { 01a0:040b  column 22 }
  Put8x8Symbol($27, j, CombatRight[j] + $11E, 0, 0);                    { 01a0:042e }
end;
for i := 0 to $27 do Put8x8Symbol(i, $16, FrameBottom[i] + $11E, 0, 0); { 01a0:0457  row 22 }
```

### 01A0:048D FUN_01A0_048D — screen frame + bar at row 2 (H)
Caller: ov19. **new**.
```pascal
DrawScreenFrame;                                                        { 01a0:0494 }
for i := 0 to $27 do Put8x8Symbol(i, 2, FrameBar[i] + $11E, 0, 0);     { 01a0:0497 }
```

### 01A0:04CD ClearRectangle (H)
`procedure ClearRectangle(x1 [BP+0Ch], y1 [BP+0Ah], x2 [BP+8], y2 [BP+6]: ShortInt)` (`RETF 8`) — 30+ callers. Clears
text cells (x1,y1)-(x2,y2) to colour 0 directly in video RAM. Pool: 03F1:0137 — **same** (130/205 instructions aligned;
the differences are the DS addresses and the TP 5 frame epilogue `MOV SP,BP`).
```pascal
case VideoMode of                                                       { 01a0:04d3  VideoMode = g_4FE6 }
  0: { CGA 320x200x4: 2 banks, 80 bytes/line, 2 bytes per cell }
    for line := y1 * 4 to y2 * 4 + 3 do begin                           { 01a0:04dd }
      FillChar(Mem[$B800 : line * 80 + x1 * 2], (x2 - x1 + 1) * 2, 0);  { 01a0:0520  even scan lines }
      FillChar(Mem[$BA00 : line * 80 + x1 * 2], (x2 - x1 + 1) * 2, 0);  { 01a0:0546  odd scan lines }
    end;
  1: begin { EGA }
    FillEgaTextRectangle(x1, y1, x2, y2, 0, 0);                         { 01a0:057b }
    FillEgaTextRectangle(x1, y1, x2, y2, 1, 0);                         { 01a0:0596  5th argument 1 = second page (M) }
  end;
  2: { Tandy 320x200x16: 4 banks, 160 bytes/line, 4 bytes per cell }
    for line := y1 * 2 to y2 * 2 + 1 do begin                           { 01a0:05bb }
      FillChar(Mem[$B800 : line * 160 + x1 * 4], (x2 - x1 + 1) * 4, 0); { 01a0:0608 }
      FillChar(Mem[$BA00 : line * 160 + x1 * 4], (x2 - x1 + 1) * 4, 0); { 01a0:062b }
      FillChar(Mem[$BC00 : line * 160 + x1 * 4], (x2 - x1 + 1) * 4, 0); { 01a0:064e }
      FillChar(Mem[$BE00 : line * 160 + x1 * 4], (x2 - x1 + 1) * 4, 0); { 01a0:0671 }
    end;
end;
```

### 01A0:06A5 FUN_01A0_06A5 — unit init, empty (H)
`55 89 E5 89 EC 5D CB`. Pool: 03F1:0367 — same.

---

## res_020F (020F) — startup configuration (curse.cfg, adapter/sound prompts, overlay buffer)

Pool twin: 042B (InitConfiguration, read-only POOL.CFG made by an installer) — **changed**: Curse creates `curse.cfg`
itself on the first run by asking the adapter, the sound device and the save path; the overlay buffer is 28000h; the
config has 4 lines; SoundDevice codes are swapped (Curse 0 = PC speaker, 1 = Tandy, 2 = silent; Pool 0 = Tandy, 1 = speaker).
CS strings (020F:008F..0270): `GAME.OVR`, `*.exe`, `B:\`, `A:\`, `curse.cfg`, the messages quoted below, `SAVE`, `\`.
Files: `CfgFile` = g_4CC0 (text), `Output` = g_8DB2, `Input` = g_8CB2.

### 020F:0020 ReadMenuDigit (H)
`function ReadMenuDigit(lo [BP+8], hi [BP+6]: Byte): Byte` (`RETF 4`) — callers: the unit init (twice). Local set `[BP-21h]`.
Pool: none — **new**.
```pascal
repeat
  repeat key := ReadKey until key in ['0'..'9'];               { 020f:0026  g_4CBE; set CS:0000 = 30h..39h }
until (Ord(key) - Ord('0')) in [lo..hi];                       { 020f:003e  set built with RT_0A54_0850 / 0880 }
Write(Output, key);                                            { 020f:0065  echo }
ReadMenuDigit := Ord(key) - Ord('0');                          { 020f:007b }
```

### 020F:027C StartupConfiguration — unit init (H)
`procedure` (unit initialisation part, called from MainProgram's init chain). Locals: `path [BP-100h]`, `tmp [BP-10Ah]`,
`len [BP-0Bh]`. Pool: 042B:00A4 InitConfiguration — **changed** (see unit note).
```pascal
g_8C9A := 0;                                                   { 020f:0283 }
WaitOverlayDisk;                                               { 020f:0288  0636:0206 }
OvrInit('GAME.OVR');                                           { 020f:028d }
FSplit(FExpand('*.exe'), ProgDir, ProgName, ProgExt);          { 020f:0297  g_4EF2 (string[79]), g_4E93, g_4E9C: where START.EXE runs from }
if ProgDir[1] < 'C' then                                       { 020f:02bb  started from a floppy }
  if ProgDir[1] = 'A' then DataDir := 'B:\'                    { 020f:02c2  g_4F42 string[79] }
  else DataDir := 'A:\'                                        { 020f:02de }
else DataDir := ProgDir;                                       { 020f:02f3 }
DataDrive := DataDir[1];                                       { 020f:0306  g_4F92 }
if not FileExists('curse.cfg') then begin                      { 020f:030c  first run: ask and write the config }
  Assign(CfgFile, 'curse.cfg');  Rewrite(CfgFile);             { 020f:0327 / 0336 }
  g_4E40 := IOResult;                                          { 020f:0340 }
  if g_4E40 <> 0 then begin                                    { 020f:0348 }
    ClrScr;                                                    { 020f:034f }
    WriteLn(Output, 'Sorry, disk A can''t be write-protected.');   { 020f:0354 }
    WriteLn(Output);                                           { 020f:036b }
    WriteLn(Output, 'If these are your masters, use DISKCOPY to make duplicates.');   { 020f:0375 }
    Halt(1);                                                   { 020f:038c }
  end;
  ClrScr;                                                      { 020f:0394 }
  Write(Output, 'GRAPHICS ADAPTER TYPE:  [1] CGA  [2] EGA  [3] Tandy  ');   { 020f:0399 }
  g_4CBF := ReadMenuDigit(1, 3);                               { 020f:03b0 }
  case g_4CBF of                                               { 020f:03bd }
    1: WriteLn(CfgFile, 'C');                                  { 020f:03c7 }
    2: WriteLn(CfgFile, 'E');                                  { 020f:03e3 }
    3: WriteLn(CfgFile, 'T');                                  { 020f:03ff }
  end;
  ClrScr;                                                      { 020f:0414 }
  Write(Output, 'SOUND TYPE:  [1] PC  [2] Tandy 1000  [3] Silent  ');   { 020f:0419 }
  g_4CBF := ReadMenuDigit(1, 3);                               { 020f:0430 }
  case g_4CBF of                                               { 020f:043d }
    1: WriteLn(CfgFile, 'P');                                  { 020f:0447 }
    2: WriteLn(CfgFile, 'T');                                  { 020f:0463 }
    3: WriteLn(CfgFile, 'S');                                  { 020f:047f }
  end;
  ClrScr;                                                      { 020f:0494 }
  DefaultSavePath := DataDir + 'SAVE';                         { 020f:0499  g_4EA1 string[79] }
  Write(Output, 'PATH TO SAVE DATA (DEFAULT - ' + DefaultSavePath + '):  ');   { 020f:04c1 }
  ReadLn(Input, SavePathIn);                                   { 020f:04f7  g_4E42 string[80] }
  SavePathIn[1] := UpCase(SavePathIn[1]);                      { 020f:050f }
  if (Length(SavePathIn) < 4) or (SavePathIn[2] <> ':')        { 020f:051b / 0522 }
     or ((SavePathIn[1] in ['A', 'B']) and (SavePathIn[1] = ProgDir[1]))   { 020f:0529 / 0539  set CS:01A4: never the floppy the game runs from }
     or not (SavePathIn[1] in ['A'..'P']) then begin           { 020f:0542  set CS:01C4 }
    SavePathIn := DefaultSavePath;                             { 020f:0552 }
    WriteLn(Output, 'USING DEFAULT PATH: ' + SavePathIn);      { 020f:0565 }
    Delay(2000);                                               { 020f:0591 }
  end;
  for i := 1 to Length(SavePathIn) do SavePathIn[i] := UpCase(SavePathIn[i]);   { 020f:059a  i = g_4E41 }
  if SavePathIn[Length(SavePathIn)] <> '\' then SavePathIn := SavePathIn + '\';   { 020f:05d6 }
  WriteLn(CfgFile, SavePathIn);                                { 020f:060c }
  WriteLn(CfgFile, 'F');                                       { 020f:0623 }
  Close(CfgFile);                                              { 020f:0638 }
end;
ClrScr;                                                        { 020f:0642 }
WriteLn(Output, 'TANDY 1000 USERS - Make sure NUMLOCK is on.');   { 020f:0647 }
Delay(2000);                                                   { 020f:065e }
Assign(CfgFile, 'curse.cfg');  Reset(CfgFile);                 { 020f:0667 / 0676 }
Read(CfgFile, CfgChar);  ReadLn(CfgFile);                      { 020f:0680  line 1: adapter; CfgChar = g_4CBE }
Regs.AH := $0F;  Intr($10, Regs);                              { 020f:0692  get the BIOS video mode; Regs = g_4FCA }
PrevBiosVideoMode := Regs.AL;  CurBiosVideoMode := PrevBiosVideoMode;   { 020f:06a4 / 06aa }
if CfgChar = 'E' then begin                                    { 020f:06b0 }
  VideoMode := 1;  SetVideoMode($0D);                          { 020f:06b7 / 06bc  EGA 320x200x16 }
  g_4FE3 := 0;  CurrentDrawPage := 0;                          { 020f:06c4 / 06c9  g_4FE3 = displayed page (M) }
  SetDisplayPage(g_4FE3);  SetDrawPage(CurrentDrawPage);       { 020f:06ce / 06d7 }
end else if CfgChar = 'T' then begin                           { 020f:06e2 }
  VideoMode := 2;                                              { 020f:06e6  Tandy }
  g_4CBA := Ptr(Seg(FreePtr^) - $400, Ofs(FreePtr^));          { 020f:06eb  16 KB below the free-list top }
  Move(FreePtr^, g_4CBA^, 8);                                  { 020f:06fd  carry the top free-list record down }
  FreePtr := g_4CBA;                                           { 020f:0712 }
  SetVideoMode(9);                                             { 020f:071f  Tandy 320x200x16 }
end else begin
  VideoMode := 0;  SetVideoMode(4);                            { 020f:0729 / 072e  CGA 320x200x4 }
end;
if MemAvail < $28000 - OvrGetBuf then begin                    { 020f:0736  signed 32-bit compare }
  RestorePreviousVideoMode;                                    { 020f:076b }
  WriteLn(Output, 'Not enough memory to run game.  You need ', $28000 - OvrGetBuf - MemAvail, ' more bytes.');   { 020f:0770 }
  Halt(0);                                                     { 020f:07be }
end;
OvrSetBuf($28000);                                             { 020f:075c  163840-byte overlay buffer }
if OvrResult <> 0 then begin                                   { 020f:07c5 }
  RestorePreviousVideoMode;                                    { 020f:07cc }
  WriteLn(Output, 'Overlay error, program abort!');            { 020f:07d1 }
  Halt(0);                                                     { 020f:07e8 }
end;
Read(CfgFile, CfgChar);  ReadLn(CfgFile);                      { 020f:07ef  line 2: sound }
if CfgChar = 'T' then SoundDevice := 1                         { 020f:0801  1 = Tandy PSG }
else if CfgChar = 'P' then SoundDevice := 0                    { 020f:080f  0 = PC speaker }
else SoundDevice := 2;                                         { 020f:081a  2 = silent }
FreeMin := $50;                                                { 020f:081f }
g_8B70 := FreePtr;                                             { 020f:0825  saved (far pointer g_8B70/g_8B72) }
ReadLn(CfgFile, SavePath);                                     { 020f:0832  line 3 → g_5BF0 string[255] }
Read(CfgFile, CfgChar);  ReadLn(CfgFile);                      { 020f:084a  line 4 }
g_4F98 := CfgChar = 'F';                                       { 020f:085c  always 'F' in a config written above; gates the TITLE/2 picture (cab-data, L) }
Close(CfgFile);                                                { 020f:086f }
```
`{ quirk: unlike Pool, the shortfall printed is the real one: $28000 - OvrGetBuf - MemAvail. }`
`{ quirk: curse.cfg = 4 lines: adapter C/E/T, sound P/T/S, save path with trailing '\', 'F'. A port reads the player's own curse.cfg
or asks the same two questions. }`

---
## res_0297 (0297) — pictures: load/convert, blits into pictures and to the screen, mirror, recolour, view flush, video mode

Pool twin: 0464 (parts Q, R1, R2 of ENGINE.pas.md). 18 routines align with Pool by instruction shape; the differences
found by `pooltrans.py --diff` are listed per routine. Most are TP 5 vs TP 6 code generation only (`SHL AX,CL` for a
shift by 2, `IDIV` for `div 2` of an Integer, `NEG` for Abs, `GetMem(var p, n)` / `FreeMem(var p, n)` forms, the
`MOV SP,BP` epilogue). **Real changes:** (1) the EGA transparency mask has one byte per plane byte (4 per 8 pixels;
Pool: 1), so masks are always as large as the pixel data and every masked blit uses the same byte-wise AND/OR;
(2) the picture-into-picture blits (DrawPictureInto, DrawPicture) are hand-written assembly (0297:21E3..2AAA, `55 8B EC`
frames, near RET) behind small Pascal dispatchers, with Pool's semantics; (3) DrawPicture always clips; (4) the
screen-to-picture copy GetPicture (0297:0EFF) is new and the Pool-style PutPicture is 0297:1110 (**correction** of the
step-2 anchor, which named 0EFF PutPicture by shape: same loops, opposite Move direction).

Picture record (`PPicture`; PICTURES.md, as Pool): `+0 height` (pixel lines), `+2 width` (8-pixel cells), `+4 x`, `+6 y`,
`+8 count` (frames), `+9 cgaMap[8]`, `+11h frameSize` (bytes per frame), `+13h mask` (far ptr, nil = opaque),
`+17h data` (frames back to back). `VideoMode` (g_4FE6): 0 = CGA 2 bpp (2 bytes per cell row), 1 = EGA planar (4 bytes
per cell row, one per plane), 2 = Tandy 4 bpp packed (4 bytes per cell row).
View dirty tables (as Pool, H): `view_LineDirty[line]` (g_5000), `view_SpanScreenX[line]` (g_50A8), `view_SpanFirst[line]`
(g_51F8, reset FFFFh), `view_SpanLast[line]` (g_5348); screen line tables `cga_LineSeg` (g_5738), `ega_LineOfs` (g_58C8),
`m2_LineSeg` (g_5A58). The off-screen view picture is `g_4FE8^` (Pool g_4A20), the DrawPicture save buffer `g_4FEC^` (far
pointer g_4FEC/g_4FEE; Pool g_4A24).
### 0297:0000 MaskByte (H)
Pool: 0464:0000 MaskByte — **same** (47/47 instructions aligned; only jump targets differ).
`function MaskByte(colour [BP+0Ah]: Byte; pix [BP+6]: array[0..3] of Byte): Byte` (retf 6; `pix` = 4 packed source
bytes = 8 pixels, passed by value). Name: Pool's (PICTURES.md) and the body.
Result: bit (7−i) set where pixel i (0..7, high nibble first) equals `colour` (transparent pixel mask).
Curse callers: ConvertPicturePixels. Callees: -.
```pascal
res := 0;                                                    { 0297:0006 }
hi := colour shl 4;                                          { 0297:000a }
bit := $80;                                                  { 0297:0017 }
for i := 0 to 3 do begin                                     { 0297:001b }
  if (pix[i] and $F0) = hi then res := res + bit;            { 0297:002b  left pixel }
  bit := bit shr 1;                                          { 0297:003b }
  if (pix[i] and $0F) = colour then res := res + bit;        { 0297:004c  right pixel }
  bit := bit shr 1;                                          { 0297:005c }
end;
MaskByte := res;                                             { 0297:006c }
```

### 0297:007B GetCgaMapEntry (H)
Pool: 0464:007B GetCgaMapEntry — **same** (35/41; `n div 2` compiles to IDIV in TP 5, SHR in TP 6).
`function GetCgaMapEntry(n [BP+0Ah]: Byte; map [BP+6]: array[0..7] of Byte): Byte` (retf 6; `map` passed by
reference and copied to a local, i.e. a Pascal value parameter of 8 bytes) 
Curse callers: ConvertPicturePixels, FillPictureRect, RecolorPicture. Callees: System.@CopyBytes.
```pascal
local := map;                                                { 0297:0081  CopyBytes 8 }
if Odd(n) then GetCgaMapEntry := local[n shr 1] and $0F      { 0297:0094 }
else GetCgaMapEntry := (local[n shr 1] and $F0) shr 4;       { 0297:00b2 }
```
(even n = high nibble, odd n = low nibble, as PICTURES.md cga_map.)

### 0297:00D7 SetVideoMode (H)
Pool: 0464:00CF SetVideoMode — **same** (19/19).
`procedure SetVideoMode(mode [BP+6]: Byte)` (retf 2) 
`Regs` = a Dos `Registers` record (AL at +0, AH at +1).
Curse callers: StartupConfiguration, RestorePreviousVideoMode. Callees: Dos.Intr.
```pascal
PrevBiosVideoMode := CurBiosVideoMode;                                            { 0297:00dd  previous BIOS mode := current }
Regs.AH := 0;                                                { 0297:00e3  g_4FCB }
Regs.AL := mode;                                             { 0297:00e8  Regs }
Intr($10, Regs);                                             { 0297:00ee  BIOS set video mode }
CurBiosVideoMode := mode;                                              { 0297:00fb  current BIOS mode }
```

### 0297:0107 RestorePreviousVideoMode (H)
Pool: 0464:00FF RestorePreviousVideoMode — **same** (8/9).
`procedure RestorePreviousVideoMode` 
Curse callers: StartupConfiguration, Load3DMap, LoadWallSet, Show3DSprite, Load24x24Set, Load8x8Set, Put8x8Symbol. Callees: SetVideoMode.
```pascal
SetVideoMode(PrevBiosVideoMode);                                        { 0297:010a }
```
(The bytes at 0297:0116 = Pascal string `'.dax'` used by LoadPicture.)

### 0297:011B LoadPicture (H)
Pool: 0464:0111 LoadPicture — **same** except the last call: FlushGameKeys (06EA:024C, active) where Pool called the disabled FUN_0899_0104 (152/155).
`procedure LoadPicture(name [BP+10h]: String; id [BP+0Eh]: Byte; maskFlags [BP+0Ch]: Byte; transpColour [BP+0Ah]: Byte;
var pic [BP+6]: PPicture)` (retf 0Eh). Name: Pool's (PICTURES.md); the body loads a P-record (H).
Curse callers: ShowTitle, ov11_0056, LoadPortrait, LoadBigPic, Load24x24Set, LoadCombatIcon, Load8x8Set. Callees: AllocPicture, ConvertPicturePixels, FlushGameKeys, FreePicture, LoadDaxRecord, System.@CopyBytes, System.@StrAssign, System.@StrCopy, System.FreeMem, System.Move.
```pascal
s := name;                                                   { 0297:0122  string[255] }
if pic <> nil then FreePicture(pic);                       { 0297:0136  free the previous picture (var pic) }
LoadDaxRecord(s, '.dax', id, size, buf);                     { 0297:014b  push order: name, ext, id, var size, var buf }
if size = 0 then Exit;                                       { 0297:0176 }
Move(buf^[0], height, 2);                                    { 0297:0180  P-record header (PICTURES.md §1) }
Move(buf^[2], width8, 2);                                    { 0297:0195 }
Move(buf^[4], x, 2);                                         { 0297:01ae }
Move(buf^[6], y, 2);                                         { 0297:01c7 }
Move(buf^[8], count, 1);                                     { 0297:01e0 }
Move(buf^[9], cgaMap, 8);                                    { 0297:01f9 }
AllocPicture(height, width8, count, maskFlags, pic);         { 0297:0212  push order: height, width8, count, maskFlags, var pic }
pic^.x := x;                                                 { 0297:023a }
pic^.y := y;                                                 { 0297:0246 }
pic^.cgaMap := cgaMap;                                       { 0297:0252  CopyBytes 8 }
ofs := $11;                                                  { 0297:026b  pixel data start in the record }
ConvertPicturePixels(buf, ofs, maskFlags, transpColour, pic);{ 0297:0271  push order: buf, ofs, maskFlags, transpColour, pic (value) }
FreeMem(buf, size);                                          { 0297:0293 }
FlushGameKeys;                                               { 0297:02a2  06EA:024C: while KeyPressed do ReadGameKey }
```
`{ quirk: the pixel data offset passed is 11h = 17, i.e. directly after the 17-byte header; size 0 (record missing)
returns silently with pic unchanged (nil after the free) }`.

### 0297:02AD ConvertPicturePixels (H)
Pool: 0464:02A5 ConvertPicturePixels — **changed** in the EGA mask (4 identical mask bytes per 8 pixels, FillChar); rest same (588/617; TP 5 div/shift code).
`procedure ConvertPicturePixels(src [BP+10h]: Pointer; ofs [BP+0Eh]: Word; maskFlags [BP+0Ch]: Byte;
transpColour [BP+0Ah]: Byte; pic [BP+6]: PPicture)` (retf 0Eh) 
 Converts the 4-bpp DAX pixels (`src^[ofs..]`) into the current video format
in `pic^.pixels`, building `pic^.mask` (if allocated) from `transpColour`. `maskFlags` is not read (the mask pointer
decides). `pi` = output index (+17h base), `mi` = mask index.
Curse callers: LoadPicture, LoadAnimation. Callees: GetCgaMapEntry, MaskByte, System.FillChar, System.Move.
```pascal
if pic = nil then Exit;                                      { 0297:02b3 }
pi := 0;  mi := 0;                                           { 0297:02c7 }
case VideoMode of                                            { 0297:02d1 }
0: { CGA: 8 source pixels -> 2 bytes }
  for f := 1 to pic^.count do                                { 0297:02db }
    for r := 0 to pic^.height - 1 do                         { 0297:02f7 }
      for c := 0 to pic^.width8 - 1 do begin                 { 0297:0313 }
        Move(src^[ofs], b, 4);                               { 0297:0330  b: array[0..3] of Byte }
        if pic^.mask <> nil then begin                       { 0297:0348 }
          m := MaskByte(transpColour, b);                    { 0297:0355  push order: colour, b }
          bit := $80;                                        { 0297:0366 }
          for half := 1 to 2 do begin                        { 0297:036a }
            for k := 4 to 7 do begin                         { 0297:0373 }
              if (bit and m) > 0 then
                pic^.mask^[mi] := pic^.mask^[mi] or Lo(CgaPixelMaskTab[k]);  { 0297:037c  CGA pixel mask C0/30/0C/03 }
              bit := bit shr 1;                              { 0297:03b7 }
            end;
            Inc(mi);                                         { 0297:03c7 }
          end;
        end;
        for j := 0 to 3 do begin                             { 0297:03d0  first CGA byte = pixels 0..3 }
          if Odd(j) then e := GetCgaMapEntry(b[j shr 1] and $0F, pic^.cgaMap)             { 0297:03e0 }
          else e := GetCgaMapEntry((b[j shr 1] and $F0) shr 4, pic^.cgaMap);              { 0297:0433 }
          pic^.pixels[pi] := pic^.pixels[pi] or CgaColourPosTab[e*4 + j];                          { 0297:0411 }
        end;
        if pic^.mask <> nil then pic^.pixels[pi] := pic^.pixels[pi] and not pic^.mask^[mi-2];  { 0297:0494 }
        Inc(pi);                                             { 0297:04d3 }
        for j := 4 to 7 do begin                             { 0297:04d6  second CGA byte = pixels 4..7 }
          if Odd(j) then e := GetCgaMapEntry(b[j shr 1] and $0F, pic^.cgaMap)             { 0297:04e6 }
          else e := GetCgaMapEntry((b[j shr 1] and $F0) shr 4, pic^.cgaMap);              { 0297:053c }
          pic^.pixels[pi] := pic^.pixels[pi] or CgaColourPosTab[e*4 + (j-4)];                      { 0297:051a }
        end;
        if pic^.mask <> nil then pic^.pixels[pi] := pic^.pixels[pi] and not pic^.mask^[mi-1];  { 0297:05a0 }
        Inc(pi);                                             { 0297:05dd }
        ofs := ofs + 4;                                      { 0297:05e0 }
      end;
1: { EGA planar: 8 source pixels -> 4 plane bytes + 1 mask byte }
  for f := 1 to pic^.count do                                { 0297:060f }
    for r := 0 to pic^.height - 1 do                         { 0297:062b }
      for c := 0 to pic^.width8 - 1 do begin                 { 0297:0647 }
        Move(src^[ofs], b, 4);                               { 0297:0664 }
        if pic^.mask <> nil then
          FillChar(pic^.mask^[pi], 4, MaskByte(transpColour, b));   { 0297:067c / 0689  one mask byte per plane byte }
        bit := $80;                                          { 0297:06af }
        for j := 0 to 7 do begin                             { 0297:06b3  pixel j }
          if Odd(j) then nib := b[j shr 1] and $0F           { 0297:06c3 }
          else nib := b[j shr 1] shr 4;                      { 0297:06da }
          for p := 0 to 3 do                                 { 0297:06f4  plane p }
            if (EgaPlaneBitTab[p] and nib) > 0 then
              pic^.pixels[pi + p] := pic^.pixels[pi + p] or bit;  { 0297:06fd }
          bit := bit shr 1;                                  { 0297:073c }
        end;
        if pic^.mask <> nil then
          for p := 0 to 3 do
            pic^.pixels[pi + p] := pic^.pixels[pi + p] and not pic^.mask^[pi + p];  { 0297:074f }
        pi := pi + 4;                                        { 0297:07a4 }
        ofs := ofs + 4;                                      { 0297:07a8 }
      end;
2: { 4-bpp linear: copy whole frames }
  for f := 1 to pic^.count do begin                          { 0297:07d7 }
    Move(src^[ofs], pic^.pixels[pi], pic^.frameSize);        { 0297:07f3 }
    if pic^.mask <> nil then
      for k := pi to pi + pic^.frameSize - 1 do begin        { 0297:0817 }
        if (pic^.pixels[k] shr 4) = transpColour then pic^.mask^[k] := $F0;        { 0297:0848 }
        if (pic^.pixels[k] and $0F) = transpColour then pic^.mask^[k] := pic^.mask^[k] + $0F;  { 0297:0876 }
        pic^.pixels[k] := pic^.pixels[k] and not pic^.mask^[k];                     { 0297:0899 }
      end;
    pi := pi + pic^.frameSize;                               { 0297:08d3 }
    ofs := ofs + pic^.frameSize;                             { 0297:08dd }
  end;
end;  { other VideoMode values: nothing }
```
Quirks: `{ quirk: mode 2 sets mask^[k] := F0h only when the left pixel is transparent and otherwise adds 0Fh to the
existing byte; correct only because AllocPicture zero-fills the mask }`; mode 0 uses one mask byte per CGA byte, modes 1 and 2 one per
data byte. D-Pool: mode 1 writes the mask byte 4 times (pi..pi+3) and ANDs each plane byte with its own copy; Pool kept one
mask byte per 8 pixels (`mi`).

### 0297:08F8 DrawPictureInto (H)
Pool: 0464:08D4 DrawPictureInto — **changed**: same semantics, the body is now 6 assembly blitters (CGA/EGA/Tandy ×
opaque/masked) sharing two row loops; no byte-counter quirk.
`procedure DrawPictureInto(x [BP+14h], y [BP+12h]: Word; frame [BP+10h], flags [BP+0Eh]: Byte; src [BP+0Ah], dst [BP+6]: PPicture)`
(`RETF 10h`) — copies frame `frame` of `src` into the picture `dst` at cell (x, y) (x in 8-pixel cells, y ×8 lines),
transparent when `flags and 1` and `src^.mask <> nil`, and records the touched span per line in the view dirty tables.
Curse callers: DrawTile24 (24×24 tiles), Put8x8Symbol Put8x8Symbol. Callees: the blitters below.
```pascal
useMask := ((flags and 1) <> 0) and (src^.mask <> nil);                   { 0297:08fe }
case VideoMode of                                                         { 0297:091d }
  0: if useMask then BlitCgaMasked(x, y, frame, src, dst)                 { 0297:0924 / 092a  0297:226A }
     else BlitCga(x, y, frame, src, dst);                                 { 0297:0945  0297:21E3 }
  1: if useMask then BlitEgaMasked(x, y, frame, src, dst)                 { 0297:0964 / 096a  0297:24F2 }
     else BlitEga(x, y, frame, src, dst);                                 { 0297:0985  0297:2463 }
  2: if useMask then BlitTandyMasked(x, y, frame, src, dst)               { 0297:09a4 / 09aa  0297:279F }
     else BlitTandy(x, y, frame, src, dst);                               { 0297:09c5  0297:270A }
end;
```
The six blitters (near `RET 0Eh`; arguments pushed x, y, frame, src, dst) only set up the geometry in their frame and
call a shared row loop; with `k` = bytes per cell row (CGA 2, EGA 4, Tandy 4):
```pascal
{ 0297:21E3 BlitCga / 2463 BlitEga / 270A BlitTandy (opaque);  0297:226A / 24F2 / 279F (masked, also load src^.mask) }
line := y * 8;                                                            { 0297:21f2 }
d := line * dst^.width * k;                                               { 0297:21fc  .. 2248 }
xs := x * k;  xb := x * k;                                                { 0297:2205  quirk (EGA 2463/24F2): xb = x unscaled, as Pool }
gap := (dst^.width - src^.width - x) * k;                                 { 0297:220b }
rowBytes := src^.width * k;                                               { 0297:2225 }
s := frame * src^.frameSize;                                              { 0297:223a }
save := false;                                                            { 0297:2251 }
RowCopy(line, src^.height);                                               { 0297:225f  0297:29B9 opaque / 0297:2A18 masked }
```

### 0297:29B9 RowCopy — opaque row loop of the blitters (H)
Near routine, works in its caller's frame (BX = line, CX = rows). Pool: the opaque branch of DrawPictureInto (0464:0B11).
```pascal
repeat
  view_LineDirty[line] := 1;                                              { 0297:29b9 }
  d := d + xs;                                                            { 0297:29c0 }
  if d <= view_SpanFirst[line] then begin                                 { 0297:29c6 }
    view_SpanFirst[line] := d;  view_SpanScreenX[line] := xb end;         { 0297:29cf }
  Move(src^.data[s], dst^.data[d], rowBytes);                             { 0297:29da  REP MOVSB }
  s := s + rowBytes;  d := d + rowBytes;                                  { 0297:29f5 }
  if d - 1 >= view_SpanLast[line] then view_SpanLast[line] := d - 1;      { 0297:29fe }
  d := d + gap;  line := line + 1;                                        { 0297:2a0c }
  Dec(rows);
until rows = 0;                                                           { 0297:2a15  LOOP }
```
`{ quirk: the source is not advanced past clipped cells (DrawPicture's clipL/clipR), so an opaque DrawPicture that is clipped
left/right shears the picture; the masked loop below does skip them. }`

### 0297:2A18 RowCopyMasked — masked row loop (H)
Pool: the masked branch of DrawPictureInto/DrawPicture. Extra frame fields: `clipL` [-18h], `clipR` [-16h], `si` save index
[-1Ch], `save` [-1Ah], save buffer far pointer [BP+14h] (DrawPicture only).
```pascal
repeat
  view_LineDirty[line] := 1;                                              { 0297:2a18 }
  s := s + clipL;  d := d + xs;                                           { 0297:2a1f }
  if d < view_SpanFirst[line] then begin                                  { 0297:2a2b }
    view_SpanFirst[line] := d;  view_SpanScreenX[line] := xb end;         { 0297:2a34 }
  for n := 1 to rowBytes do begin                                         { 0297:2a3f }
    if save then saveBuf^.data[si] := dst^.data[d];                       { 0297:2a4a  keep what was under the picture }
    dst^.data[d] := (dst^.data[d] and src^.mask^[s]) or src^.data[s];     { 0297:2a5d }
    Inc(s);  Inc(si);  Inc(d);                                            { 0297:2a76 }
  end;
  if d - 1 > view_SpanLast[line] then view_SpanLast[line] := d - 1;       { 0297:2a84 }
  d := d + gap;  s := s + clipR;  si := si + clipR;  line := line + 1;    { 0297:2a92 }
  Dec(rows);
until rows = 0;                                                           { 0297:2aa4 }
```
Note: the mask is read at the same offset as the pixel byte (`src^.mask^[s]`), which is why the EGA mask is byte-per-byte
(ConvertPicturePixels); Pool kept one EGA mask byte per 4 data bytes.
### 0297:09E4 DrawPicture (H)
Pool: 0464:0D71 DrawPicture — **changed**: same arguments and flags, assembly bodies (CGA 0297:22FE, EGA 258F, Tandy 2841),
clipping always on (Pool clipped only when g_5370 <> 0).
`procedure DrawPicture(col [BP+14h], row [BP+12h]: Integer; frame [BP+10h], flags [BP+0Eh]: Byte; src [BP+0Ah], dst [BP+6]: PPicture)`
(`RETF 10h`). `flags` bit 0 = use `src^.mask`, bit 2 = first save every covered destination byte into `g_4FEC^` (laid out
with the source geometry, so the area can be restored). Curse callers: PlayFinaleAnimation, AnimateAlongPath, ShowCombatMessageAnimation, DrawPictureScreenOrView, Show3DSprite,
DrawBackdrop, RemoveCombatant, ov33 (8 sites). Name: the Pool twin's (H by arguments and behaviour).
```pascal
case VideoMode of                                                         { 0297:09ea }
  0: DrawPicCga(col, row, frame, flags, src, dst, PicSaveBuf);                { 0297:09f1  0297:22FE }
  1: DrawPicEga(col, row, frame, flags, src, dst, PicSaveBuf);                { 0297:0a1c  0297:258F }
  2: DrawPicTandy(col, row, frame, flags, src, dst, PicSaveBuf);              { 0297:0a47  0297:2841 }
end;
```

### 0297:22FE DrawPicCga / 0297:258F DrawPicEga / 0297:2841 DrawPicTandy (H)
Near `RET 14h`; identical except the scale `k` (CGA 2, EGA/Tandy 4; EGA keeps `xb` unscaled). Statement addresses are the CGA copy.
```pascal
if col < 0 then begin clipL := -col; xs := 0 end                          { 0297:231d }
else begin clipL := 0; xs := col end;                                     { 0297:2333 }
if col + src^.width > dst^.width then begin                               { 0297:233b }
  clipR := col + src^.width - dst^.width;  gap := 0 end                   { 0297:2344 }
else begin clipR := 0;  gap := dst^.width - col - src^.width end;         { 0297:2353 }
if row < 0 then begin                                                     { 0297:2365 }
  rows := src^.height + row*8;  s := -row*8 * src^.width;  line := 0;  d := 0   { 0297:236d }
end else begin
  s := 0;  line := row*8;  d := line * dst^.width;                        { 0297:2391 }
  if line + src^.height > dst^.height then rows := dst^.height - line     { 0297:23a7 }
  else rows := src^.height;                                               { 0297:23bd }
end;
if (src^.width < clipL) or (src^.width < clipR) or (s > src^.frameSize)   { 0297:23c2  nothing visible: return }
   or (d > dst^.frameSize) or (rows > src^.height) then Exit;
xs := xs * k;  xb := xs;  rowBytes := (src^.width - clipL - clipR) * k;   { 0297:23f3 }
clipL := clipL * k;  clipR := clipR * k;  gap := gap * k;  s := s * k;  d := d * k;   { 0297:240c }
si := s;                                                                  { 0297:241b  save-buffer index }
s := s + frame * src^.frameSize;                                          { 0297:2421 }
if flags and 1 = 0 then RowCopy(line, rows)                               { 0297:2439 / 243f  29B9 }
else begin
  save := (flags and 4) <> 0;                                             { 0297:244a }
  RowCopyMasked(line, rows);                                              { 0297:2458  2A18 }
end;
```
### 0297:0A72 ReverseBits (H)
Pool: 0464:1484 ReverseBits — **same** (54/54).
`function ReverseBits(b [BP+6]: Byte): Byte` (retf 2) — caller: MirrorPicture (EGA plane bytes and EGA mask).
Curse callers: MirrorPicture. Callees: -.
```pascal
r := Byte(b shl 7);                                                        { 0297:0a78  bit0 → bit7 }
r := r + (b and $02) shl 5 + (b and $04) shl 3 + (b and $08) shl 1;        { 0297:0a85 }
r := r + (b and $10) shr 1 + (b and $20) shr 3 + (b and $40) shr 5 + (b and $80) shr 7;   { 0297:0aaf }
ReverseBits := r;                                                          { 0297:0ae8  = the 8 bits in reverse order }
```

### 0297:0AF7 MirrorCgaWord (H)
Pool: 0464:1509 MirrorCgaWord — **same** (49/49).
`function MirrorCgaWord(w [BP+6]: Word): Word` (retf 2) — caller: MirrorPicture (CGA mode).
Reverses the order of the eight 2-bit fields of `w` using the mask table `CgaPixelMaskTab..g_258B` = C000h, 3000h, 0C00h,
0300h, 00C0h, 0030h, 000Ch, 0003h (image words, H). Because the word holds two CGA bytes little-endian, the result
stored back is the 8-pixel group mirrored left↔right.
Curse callers: MirrorPicture. Callees: -.
```pascal
r := (w and g_258B) shl 14;                                                { 0297:0afd  0003h }
r := r + (w and g_2589) shl 10 + (w and g_2587) shl 6 + (w and g_2585) shl 2;   { 0297:0b0c  000Ch, 0030h, 00C0h }
r := r + (w and g_2583) shr 2 + (w and g_2581) shr 6;                      { 0297:0b39  0300h, 0C00h }
r := r + (w and g_257F) shr 10 + (w and CgaPixelMaskTab) shr 14;                    { 0297:0b57  3000h, C000h }
MirrorCgaWord := r;                                                        { 0297:0b75 }
```

### 0297:0B84 SwapNibbles (H)
Pool: 0464:1596 SwapNibbles — **same** (20/20).
`function SwapNibbles(b [BP+6]: Byte): Byte` (retf 2) — caller: MirrorPicture (packed 4-bpp mode 2).
Curse callers: MirrorPicture. Callees: -.
```pascal
SwapNibbles := Byte(b shl 4) + (b and $F0) shr 4;                          { 0297:0b8a }
```

### 0297:0BB5 MirrorPicture (H)
Pool: 0464:15C7 MirrorPicture — **changed** in the EGA mask (mirrored byte per plane byte inside the plane loop; Pool had a separate width8-per-row mask loop); rest same (290/340).
`procedure MirrorPicture(src [BP+0Ah], dst [BP+6]: PPicture)` (retf 8)
Writes into `dst` (already allocated with the same geometry) the left↔right mirror image of `src`'s **first frame**
(only `height` rows are processed — quirk: frames 2.. are not mirrored) and of its mask. Name: Pool's (H by body).
Curse callers: CopyCombatAnimationFrame, DrawIconAt. Callees: MirrorCgaWord, ReverseBits, SwapNibbles, System.Move.
```pascal
if (src = nil) or (dst = nil) then Exit;                                   { 0297:0bbb }
p := src;                                                                  { 0297:0bce }
Move(p^.cga_map, dst^.cga_map, 8);                                         { 0297:0bd7 }
case VideoMode of                                                          { 0297:0bf2 }
  0: begin                                                                 { 0297:0bfc  CGA: 2 bytes per 8 px }
    rowBytes := p^.width8 * 2;                                             { 0297:0bfc }
    srcEnd := rowBytes - 2;                                                { 0297:0c08  last word of row 1 }
    di := 0;                                                               { 0297:0c11 }
    for y := 1 to p^.height do begin                                       { 0297:0c16 }
      rowStart := di;                                                      { 0297:0c32 }
      for c := 0 to p^.width8 - 1 do begin                                 { 0297:0c38 }
        Move(p^.pix[srcEnd - di + rowStart], w, 2);                        { 0297:0c55  mirrored source word }
        w := MirrorCgaWord(w);                                             { 0297:0c77 }
        Move(w, dst^.pix[di], 2);                                          { 0297:0c81 }
        if p^.mask <> nil then begin                                       { 0297:0c9d }
          Move(p^.mask^[srcEnd - di + rowStart], w, 2);                    { 0297:0caa }
          w := MirrorCgaWord(w);                                           { 0297:0ccc }
          Move(w, dst^.mask^[di], 2);                                      { 0297:0cd6  quirk: dst^.mask not checked for nil }
        end;
        di := di + 2;                                                      { 0297:0cf2 }
      end;
      srcEnd := srcEnd + rowBytes;                                         { 0297:0d01 }
    end;
  end;
  1: begin                                                                 { 0297:0d1c  EGA: 4 plane bytes per 8 px }
    rowBytes := p^.width8 * 4;                                             { 0297:0d1c }
    srcEnd := rowBytes - 4;                                                { 0297:0d2b }
    di := 0;                                                               { 0297:0d34 }
    for y := 1 to p^.height do begin                                       { 0297:0d39 }
      rowStart := di;                                                      { 0297:0d55 }
      for c := 1 to p^.width8 do begin                                     { 0297:0d5b }
        for plane := 0 to 3 do begin                                       { 0297:0d78 }
          dst^.pix[di + plane] := ReverseBits(p^.pix[srcEnd - di + rowStart + plane]);   { 0297:0d81 }
          if p^.mask <> nil then                                           { 0297:0db4 }
            dst^.mask^[di + plane] := ReverseBits(p^.mask^[srcEnd - di + rowStart + plane]);   { 0297:0dc1  quirk: dst^.mask not checked }
        end;
        di := di + 4;                                                      { 0297:0e03 }
      end;
      srcEnd := srcEnd + rowBytes;                                         { 0297:0e12 }
    end;
  end;
  2: begin                                                                 { 0297:0e2d  packed 4 bpp: 4 bytes per 8 px }
    rowBytes := p^.width8 * 4;                                             { 0297:0e2d }
    srcEnd := rowBytes - 1;                                                { 0297:0e3c  last byte of row 1 }
    di := 0;                                                               { 0297:0e43 }
    for y := 1 to p^.height do begin                                       { 0297:0e48 }
      rowStart := di;                                                      { 0297:0e64 }
      for c := 1 to rowBytes do begin                                      { 0297:0e6a }
        dst^.pix[di] := SwapNibbles(p^.pix[srcEnd - di + rowStart]);       { 0297:0e80 }
        if p^.mask <> nil then
          dst^.mask^[di] := SwapNibbles(p^.mask^[srcEnd - di + rowStart]); { 0297:0ea5  quirk: dst^.mask not checked }
        Inc(di);                                                           { 0297:0edd }
      end;
      srcEnd := srcEnd + rowBytes;                                         { 0297:0ee8 }
    end;
  end;
end;                                                                       { other modes: only cga_map copied }
```

### 0297:0EFF GetPicture (H)
`procedure GetPicture(col [BP+0Ch], row [BP+0Ah]: Integer; pic [BP+6]: PPicture)` (`RETF 8`) — copies the screen area under
`pic` (frame 0 geometry, top-left at text cell (col, row)) **into** `pic^.data`. Name: behaviour (the inverse of PutPicture
1110: same loops, Move from video RAM to the picture; EGA reads each plane with Read Map Select). Pool: no twin (Pool's
PutPicture 0464:1951 has the same shape but writes the screen) — **new**. Curse callers: BigPicAnimPhaseA (saves the screen
under the view picture before PutPicture; BigPicAnimPhaseB puts it back).
```pascal
if pic = nil then Exit;                                                   { 0297:0f05 }
if VideoMode = 0 then begin                                               { 0297:0f19  CGA }
  lineBytes := pic^.width * 2;  src := 0;                                 { 0297:0f23 / 0f2f }
  for y := row*8 to row*8 + pic^.height - 1 do begin                      { 0297:0f34 }
    Move(Ptr(cga_LineSeg[y], col*2)^, pic^.data[src], lineBytes);         { 0297:0f6a }
    src := src + lineBytes;                                               { 0297:0f90 }
  end;
end else if VideoMode = 1 then begin                                      { 0297:0fa1  EGA }
  src := 0;                                                               { 0297:0fa8 }
  PortW[$3CE] := 5;  Port[$3CF] := 0;  Port[$3CE] := 4;                   { 0297:0fd9  mode register := read mode 0; select Read Map Select }
  for y := row*8 to row*8 + pic^.height - 1 do                            { 0297:0feb }
    for x := col to col + pic^.width - 1 do                               { 0297:1001 }
      for p := 0 to 3 do begin                                            { 0297:1017 }
        Port[$3CF] := p;                                                  { 0297:1020  read plane p }
        pic^.data[src] := Mem[$A000 : ega_LineOfs[y] + x];                { 0297:1027 }
        Inc(src);                                                         { 0297:1054 }
      end;
  Port[$3CE] := 5;  Port[$3CF] := 0;                                      { 0297:106d }
end else if VideoMode = 2 then begin                                      { 0297:1082  Tandy }
  lineBytes := pic^.width * 4;  src := 0;                                 { 0297:1089 }
  for y := row*8 to row*8 + pic^.height - 1 do begin                      { 0297:109d }
    Move(Ptr(m2_LineSeg[y], col*4)^, pic^.data[src], lineBytes);          { 0297:10d6 }
    src := src + lineBytes;                                               { 0297:10fc }
  end;
end;
```

### 0297:1110 PutPicture (H)
`procedure PutPicture(col [BP+0Ch], row [BP+0Ah]: Integer; pic [BP+6]: PPicture)` (`RETF 8`) — copies frame 0 of `pic` straight
to video memory at text cell (col, row); no clipping, no mask. Pool: 0464:1951 PutPicture — **same** (by body; Curse's
listing names it PutPicture). Curse callers: ShowTitle, BigPicAnimPhaseA, BigPicAnimPhaseB, ov29 (6 sites).
```pascal
if pic = nil then Exit;                                                   { 0297:1116 }
if VideoMode = 0 then begin                                               { 0297:112a  CGA }
  lineBytes := pic^.width * 2;  src := 0;                                 { 0297:1134 / 1140 }
  for y := row*8 to row*8 + pic^.height - 1 do begin                      { 0297:1145 }
    Move(pic^.data[src], Ptr(cga_LineSeg[y], col*2)^, lineBytes);         { 0297:117b }
    src := src + lineBytes;                                               { 0297:11a1 }
  end;
end else if VideoMode = 1 then begin                                      { 0297:11b2  EGA }
  src := 0;                                                               { 0297:11b9 }
  Port[$3C4] := 2;                                                        { 0297:11ea  sequencer: map mask register }
  for y := row*8 to row*8 + pic^.height - 1 do                            { 0297:11f0 }
    for x := col to col + pic^.width - 1 do                               { 0297:1209 }
      for p := 0 to 3 do begin                                            { 0297:121f }
        Port[$3C5] := EgaPlaneBitTab[p];                                  { 0297:1228  write plane p }
        Mem[$A000 : ega_LineOfs[y] + x] := pic^.data[src];                { 0297:1237 }
        Inc(src);                                                         { 0297:1266 }
      end;
  Port[$3C5] := $0F;                                                      { 0297:127f  all planes again }
end else if VideoMode = 2 then begin                                      { 0297:1288  Tandy }
  lineBytes := pic^.width * 4;  src := 0;                                 { 0297:128f / 129e }
  for y := row*8 to row*8 + pic^.height - 1 do begin                      { 0297:12a3 }
    Move(pic^.data[src], Ptr(m2_LineSeg[y], col*4)^, lineBytes);          { 0297:12dc }
    src := src + lineBytes;                                               { 0297:1302 }
  end;
end;
```
Loop bounds are signed (`JG`).
### 0297:1316 FlushViewDirtyLines (H)
Pool: 0464:1B52 FlushViewDirtyLines — **same** (299/305; `div 4` compiles to DIV).
`procedure FlushViewDirtyLines` (retf).
Copies the changed span of every dirty line of the view picture `g_4FE8^` (168 lines) to the screen at pixel (8, line+8), then
resets the dirty tables.
Curse callers: RuneWheelCheck, DrawIconPreview, PlayFinaleAnimation, RemoveFromCombat, AnimateAlongPath, ShowCombatMessageAnimation, DrawPictureScreenOrView, Show3DSprite, DrawAreaMap, Draw3DView, FocusSquare, ShowCombatant +1. Callees: System.FillChar, System.Move.
```pascal
if VideoMode = 0 then begin                                               { 0297:131d  CGA }
  for line := 0 to $A7 do                                                 { 0297:1324 }
    if view_LineDirty[line] <> 0 then                                             { 0297:132e }
      Move(view_Pic^.data[view_SpanFirst[line]],                                    { 0297:1338 }
           Ptr(cga_LineSeg[line+8], view_SpanScreenX[line] + 2)^,
           view_SpanLast[line] - view_SpanFirst[line] + 1);                              { 0297:1381 }
end else if VideoMode = 1 then begin                                      { 0297:1390  EGA }
  Port[$3C4] := 2;                                                        { 0297:1397  map mask }
  for line := 0 to $A7 do begin                                           { 0297:139d }
    if view_LineDirty[line] <> 0 then begin                                       { 0297:13a7 }
      dst := ega_LineOfs[line+8] + view_SpanScreenX[line] + 1;                           { 0297:13b4 }
      for p := 0 to 3 do begin                                            { 0297:13cf  unrolled 4x in the code }
        Port[$3C5] := EgaPlaneBitTab[p];                                          { 0297:13cf / 1415 / 145c / 14a5 }
        s := view_SpanFirst[line] + p;  d := dst;                                 { 0297:13d6 }
        repeat                                                            { 0297:13e8 }
          Mem[$A200 : d] := view_Pic^.data[s];                              { 0297:13e8  off-screen VRAM page at A000:2000 }
          s := s + 4;  d := d + 1;                                        { 0297:1400 }
        until s > view_SpanLast[line];                                           { 0297:1407  JBE: unsigned }
      end;
    end;
  end;
  Port[$3C5] := $0F;                                                      { 0297:14f8 }
  d := g_58D8 + 1;                                                        { 0297:14fe  g_58D8 = ega_LineOfs[8] (line 8) }
  PortW[$3CE] := $0105;                                                   { 0297:1505  graphics ctrl reg 5 := 1: write mode 1 (latch copy) }
  for line := 0 to $A7 do begin                                           { 0297:1511 }
    if view_LineDirty[line] <> 0 then                                             { 0297:151b }
      Move(Mem[$A200 : d + view_SpanScreenX[line]], Mem[$A000 : d + view_SpanScreenX[line]],  { 0297:1525 }
           (view_SpanLast[line] - view_SpanFirst[line]) div 4 + 1);                      { 0297:156a }
    d := d + $28;                                                         { 0297:156f  40 bytes per EGA line }
  end;
  Port[$3CF] := 0;                                                        { 0297:157a  write mode 0 }
end else if VideoMode = 2 then begin                                      { 0297:1582 }
  for line := 0 to $A7 do                                                 { 0297:1586 }
    if view_LineDirty[line] <> 0 then                                             { 0297:1590 }
      Move(view_Pic^.data[view_SpanFirst[line]],                                    { 0297:159a }
           Ptr(m2_LineSeg[line+8], view_SpanScreenX[line] + 4)^,
           view_SpanLast[line] - view_SpanFirst[line] + 1);                              { 0297:15e3 }
end;
FillChar(view_LineDirty, $A8, 0);                                                 { 0297:15ef  no line dirty }
FillChar(view_SpanFirst, $150, $FF);                                              { 0297:1600  lowest offset := FFFFh }
FillChar(view_SpanLast, $150, 0);                                                { 0297:1611  highest offset := 0 }
```
Quirks: the EGA path writes the planes into the off-screen page (A200h) first and then copies with the latch write mode, so the
visible page never shows a half-written line; `Move` between two VRAM addresses works only because write mode 1 copies the
latches (every read loads all 4 planes, every write stores them). The EGA second pass uses `g_58D8 + 1 + 40*line` instead of the
table (equal when the table is linear, H for EGA). The flush is driven by line index only: the screen x is `view_SpanScreenX[line]` + 8 px.

### 0297:1626 RecolorPicture (M)
Pool: 0464:1E5C RecolorPicture — **same** (602/604).
`procedure RecolorPicture(const fromCol [BP+12h], toCol [BP+0Eh]: array[0..15] of Byte; frame [BP+0Ch]: Integer;
randomMix [BP+0Ah]: Boolean; pic [BP+6]: PPicture)` (retf 10h)
For every colour i with `fromCol[i] <> toCol[i]`, pixels of colour `fromCol[i]` in `pic` become `toCol[i]` — all 16 replacements
are tested against the *unchanged* original and written into a copy, so the remap is simultaneous (no chains). `frame < 0` = all
frames. `randomMix` replaces only about 1/4 of the matching pixels (dithered fade). Name M (behaviour).
Curse callers: LoadCharacterIcon, CopyIconSlot, DrawPictureScreenOrView, LoadAnimation, LoadCombatIcon. Callees: AllocPicture, FreePicture, GetCgaMapEntry, System.@CopyBytes, System.@LongMul, System.Move, System.RandomWord.
```pascal
from := fromCol;  to_ := toCol;                                            { 0297:162c  CopyBytes 16 each }
if pic = nil then Exit;                                                   { 0297:1652 }
if frame < 0 then begin frame := 0; n := pic^.count end                    { 0297:1666 }
else n := 1;                                                              { 0297:167d }
src := frame * pic^.frameSize;                                            { 0297:1681  LongMul, low word }
dst := 0;                                                                 { 0297:169a }
AllocPicture(pic^.height, pic^.width, n, 0, tmp);                         { 0297:169f  push height, width, n, 0, @tmp }
tmp^.cgaMap := pic^.cgaMap;                                               { 0297:16bc  CopyBytes 8 }
Move(pic^.data[src], tmp^.data[dst], tmp^.count * tmp^.frameSize);        { 0297:16d7 }
for i := 0 to 15 do begin                                                 { 0297:1709 }
  if frame < 0 then ... else ...;                                         { 0297:171b  n recomputed exactly as above (frame is already >= 0 here) }
  src := frame * pic^.frameSize;  dst := 0;                               { 0297:1736 }
  if from[i] = to_[i] then Continue;                                      { 0297:1754 }
  case VideoMode of
  0: begin                                                                { 0297:1778  CGA, 2 bpp }
       lineBytes := tmp^.width * 2;                                       { 0297:1782 }
       for gfx_LoopCounter := frame to frame + n - 1 do                            { 0297:178e  quirk: loop counter is a global byte, signed compare }
         for y := 1 to tmp^.height do                                     { 0297:17ae }
           for x := 1 to lineBytes do begin                               { 0297:17ca }
             for p := 0 to 3 do                                           { 0297:17e3 }
               if (pic^.data[src] and CgaPixelMaskTab[p+4]) =                        { 0297:17ec }
                  CgaColourPosTab[GetCgaMapEntry(from[i], tmp^.cgaMap)*4 + p] then  {   CGA colour of from[i], bits at pixel p }
                 if (not randomMix) or (Random(4) = 0) then               { 0297:1844  quirk: randomMix tested twice }
                   tmp^.data[dst] := (tmp^.data[dst] and not CgaPixelMaskTab[p+4])   { 0297:185d }
                     or CgaColourPosTab[GetCgaMapEntry(to_[i], tmp^.cgaMap)*4 + p];
             src := src + 1;  dst := dst + 1;                             { 0297:18cb }
           end;
     end;
  1: begin                                                                { 0297:18f5  EGA planar }
       for p := 0 to 3 do                                                 { 0297:18fc }
         if (from[i] and EgaPlaneBitTab[p]) > 0 then want[p] := 0 else want[p] := $FF;  { 0297:1905 }
       for gfx_LoopCounter := frame to frame + n - 1 do                            { 0297:193e }
         for y := 1 to tmp^.height do                                     { 0297:195e }
           for x := 1 to tmp^.width do begin                              { 0297:197a }
             if randomMix then m := Random(256) and Random(256)           { 0297:1997  ~1/4 of the bits }
             else m := $FF;                                               { 0297:19b8 }
             for p := 0 to 3 do                                           { 0297:19bc }
               m := m and (pic^.data[src+p] xor want[p]);                 { 0297:19c5  bits of pixels whose colour = from[i] }
             for p := 0 to 3 do                                           { 0297:19ee }
               if (to_[i] and EgaPlaneBitTab[p]) > 0 then                         { 0297:19f7 }
                 tmp^.data[dst+p] := tmp^.data[dst+p] or m                { 0297:1a12 }
               else
                 tmp^.data[dst+p] := tmp^.data[dst+p] and not m;          { 0297:1a3b }
             src := src + 4;  dst := dst + 4;                             { 0297:1a6e }
           end;
     end;
  2: begin                                                                { 0297:1a9a  4 bpp packed }
       lineBytes := tmp^.width * 4;                                       { 0297:1aa1 }
       hiFrom := from[i] shl 4;  hiTo := to_[i] shl 4;                    { 0297:1ab0 }
       for gfx_LoopCounter := frame to frame + n - 1 do                            { 0297:1ad8 }
         for y := 1 to tmp^.height do                                     { 0297:1af8 }
           for x := 1 to lineBytes do begin                               { 0297:1b14 }
             if (pic^.data[src] and $F0) = hiFrom then                    { 0297:1b2d  left pixel }
               if (not randomMix) or (Random(4) = 0) then                 { 0297:1b40 }
                 tmp^.data[dst] := (tmp^.data[dst] and $0F) or hiTo;      { 0297:1b59 }
             if (pic^.data[src] and $0F) = from[i] then                   { 0297:1b78  right pixel }
               if (not randomMix) or (Random(4) = 0) then                 { 0297:1b94 }
                 tmp^.data[dst] := (tmp^.data[dst] and $F0) or to_[i];    { 0297:1bad }
             src := src + 1;  dst := dst + 1;                             { 0297:1bd5 }
           end;
     end;
  end;
end;
Move(tmp^.data[0], pic^.data[frame * pic^.frameSize], n * pic^.frameSize);  { 0297:1c05  copy the result back }
FreePicture(tmp);                                                         { 0297:1c4a }
```
Quirks: `gfx_LoopCounter` (a DS byte) is the frame loop variable; the frame loop only repeats the same offsets per frame because `src`/`dst`
are not reset per frame — they continue through the frames, so all n frames are processed in sequence (H). The mask `+13h` is
not updated.

### 0297:1C59 AllocPicture (H)
Pool: 0464:248E AllocPicture — **changed**: no EGA case, the mask is always `total` bytes (68/95).
`procedure AllocPicture(height [BP+10h], width [BP+0Eh]: Word; count [BP+0Ch]: Byte; flags [BP+0Ah]: Byte;
var pic [BP+6]: PPicture)` (retf 0Ch).
Curse callers: LoadPicture, RecolorPicture, StartCombat, ov11_0056, CopyCombatAnimationFrame, LoadAnimation, DrawIconAt. Callees: System.FillChar, System.GetMem.
```pascal
frameSize := height * width * 2;                                          { 0297:1c5f  CGA: 2 bytes per cell row }
if VideoMode <> 0 then frameSize := frameSize * 2;                        { 0297:1c6a  EGA / mode 2: 4 bytes }
total := count * frameSize;                                               { 0297:1c79 }
GetMem(pic, total + $17);                                                 { 0297:1c89 }
FillChar(pic^, total + $17, 0);                                           { 0297:1c95 }
pic^.height := height;                                                    { 0297:1cac }
pic^.width := width;                                                      { 0297:1cb8 }
pic^.frameSize := frameSize;                                              { 0297:1cc5 }
pic^.count := count;                                                      { 0297:1cd2 }
if (flags and 1) > 0 then                                                 { 0297:1cdf  with transparency mask }
  begin
    GetMem(pic^.mask, total);                                             { 0297:1ce8 }
    FillChar(pic^.mask^, total, 0);                                       { 0297:1cfc }
  end;
```
Quirk: the mask is always as large as the data (one mask byte per data byte, all modes); `+4 x`, `+6 y`, `cgaMap` stay 0.

### 0297:1D19 FreePicture (H)
Pool: 0464:2595 FreePicture — **changed**: no EGA case (37/52).
`procedure FreePicture(var pic [BP+6]: PPicture)` (retf 4).
Curse callers: LoadPicture, RecolorPicture, ShowTitle, EndCombat, StartCombat, MoveParty, CopyCombatAnimationFrame, FreeAnimation, Load24x24Set, FreeCombatIcon, DrawIconAt. Callees: System.FreeMem.
```pascal
if pic = nil then Exit;                                                   { 0297:1d1f }
total := pic^.count * pic^.frameSize;                                     { 0297:1d39 }
if pic^.mask <> nil then                                                  { 0297:1d4c }
  FreeMem(pic^.mask, total);                                              { 0297:1d59 }
FreeMem(pic, total + $17);                                                { 0297:1d6a }
pic := nil;                                                               { 0297:1d7b }
```
Note: the mask pointer itself is not cleared (the record is freed anyway).

### 0297:1D8D FillPictureRect (H)
Pool: 0464:2632 FillPictureRect — **same** (372/392; Abs via NEG, SHL by CL).
`procedure FillPictureRect(x [BP+16h], y [BP+14h]: Integer; w [BP+12h], h [BP+10h]: Word; colour [BP+0Eh]: Byte;
const cgaMap [BP+0Ah]: TCgaMap; pic [BP+6]: PPicture)` (retf 12h)
Fills the rectangle of w cells × h lines at cell column x, pixel line y of `pic` (frame 0) with `colour`, clipped to the picture,
and records the changed spans in the view dirty tables.
Curse callers: DrawIconPreview, DrawBackdrop. Callees: GetCgaMapEntry, System.@CopyBytes, System.FillChar, System.Move.
```pascal
map := cgaMap;                                                            { 0297:1d93  CopyBytes 8 }
if pic = nil then Exit;                                                   { 0297:1da6 }
if x < 0 then begin skipL := Abs(x); x0 := 0 end                          { 0297:1db1 }
else begin skipL := 0; x0 := x end;                                       { 0297:1dca }
if pic^.width < x + w then begin                                          { 0297:1dd5  32-bit signed compare }
  skipR := x + w - pic^.width;  tail := 0                                 { 0297:1dfd }
end else begin
  skipR := 0;  tail := pic^.width - (x + w)                               { 0297:1e29 }
end;
if y < 0 then begin                                                       { 0297:1e53 }
  ofs := 0;  line := 0;                                                   { 0297:1e59 }
  last := h - Abs(y);                                                     { 0297:1e63  quirk: no "- 1" here, one extra line; no bottom clip }
end else begin
  line := y;                                                              { 0297:1e7f }
  ofs := line * pic^.width;                                               { 0297:1e85 }
  last := h - 1;                                                          { 0297:1e92 }
  if pic^.height < y + h then last := pic^.height - 1 - y;                { 0297:1e99 }
end;
if (VideoMode = 0) or (VideoMode = 2) then begin                          { 0297:1ee1  byte-packed modes }
  if VideoMode = 0 then begin                                             { 0297:1eef }
    spanX := x0 * 2;  rowBytes := (w - skipL - skipR) * 2;                { 0297:1ef6 }
    x0 := x0 * 2;  tail := tail * 2;  ofs := ofs * 2;                     { 0297:1f0c }
  end else begin
    rowBytes := (w - skipL - skipR) * 4;                                  { 0297:1f26 }
    x0 := x0 * 4;  tail := tail * 4;  ofs := ofs * 4;                     { 0297:1f37 }
    spanX := x0;                                                          { 0297:1f58 }
  end;
  for r := 0 to last do begin                                             { 0297:1f5e  unsigned bound }
    view_LineDirty[line] := 1;                                                    { 0297:1f76  line dirty }
    ofs := ofs + x0;                                                      { 0297:1f7e }
    if view_SpanFirst[line] > ofs then begin                                      { 0297:1f84 }
      view_SpanScreenX[line] := spanX;  view_SpanFirst[line] := ofs                         { 0297:1f92 }
    end;
    if VideoMode = 0 then                                                 { 0297:1faa }
      FillChar(pic^.data[ofs], rowBytes, g_0C80[GetCgaMapEntry(colour, map)])  { 0297:1fb1  CGA fill byte 00/55/AA/FF }
    else
      FillChar(pic^.data[ofs], rowBytes, g_0C84[colour]);                 { 0297:1fdf  colour*11h }
    ofs := ofs + rowBytes;                                                { 0297:2001 }
    if ofs - 1 > view_SpanLast[line] then view_SpanLast[line] := ofs - 1;               { 0297:2007 }
    ofs := ofs + tail;                                                    { 0297:2023 }
    line := line + 1;                                                     { 0297:2029 }
  end;
end else if VideoMode = 1 then begin                                      { 0297:203a  EGA }
  spanX := x0;                                                            { 0297:2041 }
  cells := w - skipL - skipR;                                             { 0297:2047 }
  x0 := x0 * 4;  tail := tail * 4;  ofs := ofs * 4;                       { 0297:2053 }
  FillChar(planeByte, 4, 0);                                              { 0297:2074 }
  for p := 0 to 3 do                                                      { 0297:2085 }
    if (EgaPlaneBitTab[p] and colour) > 0 then planeByte[p] := $FF;               { 0297:208e }
  for r := 0 to last do begin                                             { 0297:20b1 }
    view_LineDirty[line] := 1;                                                    { 0297:20c9 }
    ofs := ofs + x0;                                                      { 0297:20d1 }
    if view_SpanFirst[line] > ofs then begin                                      { 0297:20d7 }
      view_SpanScreenX[line] := spanX;  view_SpanFirst[line] := ofs                         { 0297:20e5 }
    end;
    for gfx_LoopCounter := 1 to ShortInt(cells) do begin                           { 0297:20fd  quirk: global byte counter, signed: > 127 cells fills nothing }
      Move(planeByte, pic^.data[ofs], 4);                                 { 0297:2113 }
      ofs := ofs + 4;                                                     { 0297:212f }
    end;
    if ofs - 1 > view_SpanLast[line] then view_SpanLast[line] := ofs - 1;               { 0297:213b }
    ofs := ofs + tail;                                                    { 0297:2157 }
    line := line + 1;                                                     { 0297:215d }
  end;
end;
```
Quirks: the dirty tables are updated whatever picture is filled (they only make sense for the view picture `g_4FE8^`; every
current caller passes it). The data offset uses frame 0 only.

### 0297:2171 SetEgaPaletteRegister (H)
Pool: 0464:2A0D SetEgaPaletteRegister — **same** (23/24).
`procedure SetEgaPaletteRegister(index [BP+8], colour [BP+6]: Byte)` (retf 4).
Curse callers: FlashPalette, PaletteFlashOn, PaletteFlashOff. Callees: Dos.Intr.
```pascal
Regs.AH := $10;  Regs.AL := 0;                                            { 0297:2174  g_4FCB / Regs: INT 10h AX=1000h set palette register }
if colour < 8 then Regs.BH := colour                                      { 0297:217e }
else Regs.BH := colour + 8;                                               { 0297:218c  8..15 -> 10h..17h }
Regs.BL := index;                                                         { 0297:2197 }
Intr($10, Regs);                                                          { 0297:219d  Regs = Regs (TP Registers record) }
```
Note: BH is the EGA palette value. Colours 8..15 become 10h..17h (bit 4 set), not the 350-line bright values 38h..3Fh: in the
200-line EGA modes the monitor reads bit 4 as intensity, so 10h..17h are the bright colours there (M: depends on the video mode set
by ov11; the arithmetic is H).

### 0297:21B0 SetEgaPaletteRegisterRaw (H)
`procedure SetEgaPaletteRegisterRaw(index [BP+8], value [BP+6]: Byte)` (`RETF 4`) — INT 10h AX=1000h with BL = index, BH = value
unchanged (SetEgaPaletteRegister 2171 maps colours 8..15 to 10h..17h; this one passes the raw value). Callers: FlashPalette,
PaletteFlashOn, PaletteFlashOff. Pool: none — **new**.
```pascal
Regs.AH := $10;  Regs.AL := 0;                                            { 0297:21b3 }
Regs.BH := value;  Regs.BL := index;                                      { 0297:21bd }
Intr($10, Regs);                                                          { 0297:21c9 }
```

### 0297:21DC FUN_0297_21DC — unit init, empty (H)
`55 89 E5 89 EC 5D CB`. Pool: 0464:2A4A Init0464 — same.

---
## res_0542 (0542) — text cells, 8×8 font, EGA pages, bottom-line prompts and input

Pool twin: 0709 (part S of ENGINE.pas.md); 20 of 23 routines align. **The main delta (H): every text routine has a
background colour.** DrawRepeatedGlyph takes `fg, bg` where Pool had one `colour` (Pool's background was always palette
index 0), and DrawText, DrawWrappedText, ReadBottomLine, ReadWordNumber, ShowBottomPromptAndReadKey and
ShowTimedBottomPrompt each have one more byte parameter (`bg`, right after the foreground colour), so their RETF grows
by 2. **Every caller in the other areas pushes one more byte than in Pool**; module lanes must take the Curse signatures
below (argument-order error class). ClearGlyphRun keeps Pool's signature and passes its colour as both fg and bg. The
glyph drawing itself is assembly (0542:0D27 CGA, 0DC6 EGA, 0E26 Tandy) and, in EGA, draws on one page (A000h, page 0)
where Pool wrote both pages. MessageDelay waits `GameSpeed * 100` ms (Pool * 225).
Globals: `FontPtr` (g_6594, 64 glyphs × 8 bytes), `GlyphBuf` g_6598 (8 bytes: the current glyph), `text_Col`/`text_Row`
(g_65A0/65A1), `CgaColourMap` g_256D (16 bytes: EGA colour → CGA colour 0..3; Pool g_25D5).
### 0542:0000 ResetEgaRegisters (H)
Pool: 0709:0000 ResetEgaRegisters — **same** (58/59).
`procedure ResetEgaRegisters` — port writes only.
Curse callers: FillEgaTextRectangle. Callees: -.
```pascal
Port[$3CE] := 0; Port[$3CF] := 0;      { 0542:0003  GC 0 set/reset := 0 }
Port[$3CE] := 1; Port[$3CF] := 0;      { 0542:000f  GC 1 enable set/reset := 0 }
Port[$3CE] := 2; Port[$3CF] := 0;      { 0542:001b  GC 2 colour compare := 0 }
Port[$3CE] := 3; Port[$3CF] := 0;      { 0542:0027  GC 3 rotate/function := 0 }
Port[$3CE] := 4; Port[$3CF] := 0;      { 0542:0033  GC 4 read map := 0 }
Port[$3CE] := 5; Port[$3CF] := 0;      { 0542:003f  GC 5 mode := write mode 0 }
Port[$3CE] := 7; Port[$3CF] := $0F;    { 0542:004b  GC 7 colour don't care := 0Fh }
Port[$3CE] := 8; Port[$3CF] := $FF;    { 0542:0057  GC 8 bit mask := FFh }
Port[$3C4] := 2; Port[$3C5] := $0F;    { 0542:0063  sequencer map mask := all planes }
```

### 0542:0073 SetDisplayPage (H)
Pool: 0709:0071 SetDisplayPage — **same** (19/20).
`procedure SetDisplayPage(page [BP+6]: Byte)` 
Curse callers: StartupConfiguration. Callees: Dos.Intr.
```pascal
Regs.AH := 5;                     { 0542:0076  g_4FCB }
Regs.AL := page;                  { 0542:007b  Regs }
Intr($10, Regs);                  { 0542:0081  BIOS: select active display page }
DisplayPageSeg := $A000 + page shl 9;  { 0542:008e  g_4FDE: 8 KB per page }
```

### 0542:00A4 SetDrawPage (H)
Pool: 0709:00A0 SetDrawPage — **same** (10/11).
`procedure SetDrawPage(page [BP+6]: Byte)` 
Curse callers: StartupConfiguration, FillEgaTextRectangle. Callees: -.
```pascal
DrawPageSeg := $A000 + page shl 9;     { 0542:00a7  DrawPageSeg }
```

### 0542:00BD FillEgaTextRectangle (H)
Pool: 0709:00B7 FillEgaTextRectangle — **same** (85/89).
`procedure FillEgaTextRectangle(x1 [BP+10h], y1 [BP+0Eh], x2 [BP+0Ch], y2 [BP+0Ah]: ShortInt; page [BP+8], colour [BP+6]: Byte)`
 
Fills the cell rectangle (x1,y1)-(x2,y2) of EGA page `page` with `colour` (write mode 2: the written byte value is the colour of all 8 pixels).
Curse callers: ClearRectangle, ClearScreen, ClearTextRectangle. Callees: ResetEgaRegisters, SetDrawPage, System.FillChar.
```pascal
saved := CurrentDrawPage;                              { 0542:00c3  CurrentDrawPage }
ofs := y1 * 40 * 8 + x1;                               { 0542:00c9  byte offset of the first scan line (signed byte args) }
lastLine := (y2 - y1 + 1) * 8 - 1;                     { 0542:00e9 }
SetDrawPage(page);                                     { 0542:00ff }
ResetEgaRegisters;                                     { 0542:0107 }
Port[$3CE] := 5; Port[$3CF] := 2;                      { 0542:010b  write mode 2 }
for line := 0 to lastLine do begin                     { 0542:0117 }
  FillChar(Ptr(DrawPageSeg, ofs)^, x2 - x1 + 1, colour); { 0542:012c }
  ofs := ofs + 40;                                     { 0542:014d }
end;
Port[$3CE] := 5; Port[$3CF] := 0;                      { 0542:0159  write mode 0 }
CurrentDrawPage := saved;                              { 0542:0165 }
SetDrawPage(CurrentDrawPage);                          { 0542:016b }
```

### 0542:0184 LoadTextFont (H)
Pool: 0709:017C LoadTextFont — **same** (42/45; TP 5 FreeMem form).
`procedure LoadTextFont`
Curse callers: ov11_0056. Callees: LoadDaxRecord, System.@StrCopy, System.FreeMem, System.Move.
```pascal
LoadDaxRecord('8X8d1', '.dax', $C9, size, p);          { 0542:018a  args pushed: name, ext, id C9h, var size, var ptr }
if size <> 0 then begin                                { 0542:01ba }
  Move(p^, FontPtr^, size);                            { 0542:01c2  FontPtr: preallocated 8-bytes-per-glyph font }
  FreeMem(p, size);                                    { 0542:01d5 }
end;
```

### 0542:01E6 DrawRepeatedGlyph (H)
Pool: 0709:01DF DrawRepeatedGlyph — **changed**: background colour parameter; per-mode bodies in assembly (52/403 aligned).
`procedure DrawRepeatedGlyph(col [BP+12h], row [BP+10h], fg [BP+0Eh], bg [BP+0Ch], count [BP+0Ah]: Byte; ch [BP+8]: Char; textMap [BP+6]: Boolean)`
(`RETF 0Eh`) — draws glyph `ch` `count` times from (col,row) rightwards: font pixels in `fg`, the others in `bg`.
With `textMap` the glyph index is `UpCase(ch) mod 64` (the 64-glyph 6-bit set), else `ch` itself.
Curse callers: ClearGlyphRun, DrawText, RenderWrappedRun, DrawOptions, DrawList. Callees: System.UpCase, System.Move, the three renderers.
```pascal
if (col > 39) or (row > 24) or (FontPtr = nil) then Exit;               { 0542:01ec / 01f8 }
if textMap then g := Ord(UpCase(ch)) mod 64                             { 0542:0204 }
else g := Ord(ch);                                                      { 0542:0221 }
Move(FontPtr^[g*8], GlyphBuf, 8);                                       { 0542:0227 }
case VideoMode of                                                       { 0542:0246 }
  0: for i := 1 to count do begin GlyphCga(col, row, fg, bg, g); Inc(col) end;     { 0542:024d / 027a / 027d }
  1: for i := 1 to count do begin GlyphEga(col, row, fg, bg, g); Inc(col) end;     { 0542:028f / 02bc / 02bf }
  2: for i := 1 to count do begin GlyphTandy(col, row, fg, bg, g); Inc(col) end;   { 0542:02d0 / 02fd / 0300 }
end;
```
`{ quirk: the column bound is tested once, before the loop; a run that starts at col <= 39 and is long enough writes past
column 39 (CGA/Tandy: into the next text row's bytes). Pool re-applied CgaColourMap per repetition (count > 1 mapped twice);
Curse maps once per glyph in the renderer, so that Pool quirk is gone. }`

### 0542:0D27 GlyphCga (H)
Near `RET 0Ah`, assembly; args col [BP+0Ch], row [BP+0Ah], fg [BP+8], bg [BP+6], g [BP+4] (g unused: the glyph is in GlyphBuf).
```pascal
ofs := row * 320 + col * 2;                                             { 0542:0d2c  row*4 line pairs * 80 }
fgByte := CgaColourMap[fg];  bgByte := CgaColourMap[bg];                { 0542:0d3d  colour index 0..3 in the low 2 bits }
for pair := 0 to 3 do begin                                             { 0542:0d51 }
  { even line -> B800, odd line -> BA00; each 8-pixel row = 2 bytes written right byte first }
  for each of the 8 pixels p (bit p of GlyphBuf[line], LSB = leftmost pixel of the low byte half):   { 0542:0d64 }
    pixel := fgByte if bit set else bgByte;                             { 0542:0d6a / 0d6f }
  MemW[$B800 : ofs] := the 8 pixels of GlyphBuf[2*pair];                { 0542:0d7d }
  MemW[$BA00 : ofs] := the 8 pixels of GlyphBuf[2*pair+1];              { 0542:0db2 }
  ofs := ofs + 80;                                                      { 0542:0dba }
end;
```
Bit order (H from the loop): AH starts at 01h and the colour fields rotate left by 2 for each tested bit, writing the
second byte first (`INC DI` then `DEC DI`), so the 8 font bits map to the 8 pixels in the same left-to-right order as Pool's
`$80 shr bit` loop (L: equivalence by construction, not checked against a capture).

### 0542:0DC6 GlyphEga (H)
Near `RET 0Ah`; same arguments. EGA write mode 2: each font row is written twice through the bit mask register.
```pascal
ofs := row * 320 + col;                                                 { 0542:0dcb  A000h, page 0 only }
PortW[$3CE] := $0A05;  PortW[$3CE] := $0003;  PortW[$3CE] := $0007;     { 0542:0ddd  write mode 2 / read mode 1; replace; colour don't care 0 }
for fl := 0 to 7 do begin                                               { 0542:0def }
  PortW[$3CE] := GlyphBuf[fl] shl 8 + 8;                                { 0542:0df2  bit mask := font row }
  Mem[$A000 : ofs] := Mem[$A000 : ofs] and fg;                          { 0542:0df9  latch read, write colour fg to the masked bits }
  PortW[$3CE] := (not GlyphBuf[fl]) shl 8 + 8;                          { 0542:0dff }
  Mem[$A000 : ofs] := Mem[$A000 : ofs] and bg;                          { 0542:0e04 }
  ofs := ofs + 40;                                                      { 0542:0e0a }
end;
PortW[$3CE] := $0005;  PortW[$3CE] := $FF08;  PortW[$3CE] := $0003;  PortW[$3CE] := $0F07;   { 0542:0e10  restore }
```

### 0542:0E26 GlyphTandy (H)
Near `RET 0Ah`; same arguments. Writes 4 bytes (8 pixels, a nibble each) per glyph row: glyph rows 0..3 go to the banks
B800/BA00/BC00/BE00 at offset row*320 + col*4, rows 4..7 to the same banks 160 bytes further (`ADD DI,0A1h` after the
`DEC DI` walk); pixel = `fg` where the font bit is set, else `bg` (raw colour numbers, no map) `{ 0542:0e2b .. 0f24 }`. Pool: the mode-2 branch of DrawRepeatedGlyph (same layout,
background 0 there).
### 0542:0311 ClearGlyphRun (H)
Pool: 0709:05EB ClearGlyphRun — **changed** call only: passes `colour` as both fg and bg (27/30).
`procedure ClearGlyphRun(col [BP+0Ch], row [BP+0Ah], colour [BP+8], count [BP+6]: Byte)` 
Curse callers: ReadBottomLine, ShowBottomPromptAndReadKey, ShowTimedBottomPrompt, DrawModifyField, InputNumber, ClearMenuLine, LoadAnimation. Callees: DrawRepeatedGlyph.
```pascal
if (col <= 39) and (row <= 24) then                          { 0542:0314 }
  DrawRepeatedGlyph(col, row, colour, colour, count, ' ', True);    { 0542:032e  blank cells: fg = bg = colour }
```

### 0542:0352 DrawText (H)
Pool: 0709:0626 DrawText — **changed** signature: `bg` parameter added (51/53).
`procedure DrawText(col [BP+10h], row [BP+0Eh], fg [BP+0Ch], bg [BP+0Ah]: Byte; const s [BP+6]: String)` (`RETF 0Ch`) — ~50 callers (status lines, menus, sheets, LoadEclBlock "Loading...Please Wait").
Curse callers: LoadEclBlock, PartySummary, ReadBottomLine, RuneWheelCheck, ShowBottomPromptAndReadKey, ShowTimedBottomPrompt, ShowCredits, HealMenu, ShowCombatResult, AiMove, StartCombat, ov11_0056 +41. Callees: DrawRepeatedGlyph, System.@StrAssign.
```pascal
t := s;                                                      { 0542:0359  local String[255] }
if (col > 39) or (row > 39) then Exit;                       { 0542:036d  quirk: row tested against 39, not 24 }
for k := 1 to Length(t) do begin                             { 0542:037b }
  DrawRepeatedGlyph(col, row, fg, bg, 1, t[k], True);       { 0542:039d }
  Inc(col);                                                  { 0542:03c4  no clipping at column 39 (DrawRepeatedGlyph drops cells > 39) }
end;
```

### 0542:03D7 RenderWrappedRun (nested in DrawWrappedText, H)
Pool: 0709:06A7 RenderWrappedRun — **changed**: passes the parent's fg and bg (39/45).
`procedure RenderWrappedRun(parentBP [BP+6])` — uses the frame of DrawWrappedText: `t` (text), `i` (next char), `j` (end of run), `fg` (parent [BP+0Eh]), `bg` (parent [BP+0Ch]).
Curse callers: DrawWrappedText. Callees: Crt.Delay, DrawRepeatedGlyph.
```pascal
while i <= j do begin                                        { 0542:03da }
  DrawRepeatedGlyph(text_Col, text_Row, fg, bg, 1, t[i], True);  { 0542:03ec  text_Col / text_Row }
  if TextOutputActive then Delay(GameSpeed * 10);            { 0542:0423  TextOutputActive (ecl_names), GameSpeed: typewriter effect }
  Inc(i);                                                    { 0542:043a }
  Inc(text_Col);                                             { 0542:0442 }
end;
```

### 0542:044E SkipLeadingSpaces (nested in DrawWrappedText, H)
Pool: 0709:0714 SkipLeadingSpaces — **same** (19/20).
`procedure SkipLeadingSpaces(parentBP [BP+6])`
Curse callers: DrawWrappedText. Callees: -.
```pascal
while (i < len) and (t[i] = ' ') do Inc(i);                  { 0542:0451 }
```

### 0542:04A4 DrawWrappedText (H)
Pool: 0709:0768 DrawWrappedText — **changed** signature: `bg` parameter added (246/248).
`procedure DrawWrappedText(x1 [BP+16h], y1 [BP+14h], x2 [BP+12h], y2 [BP+10h], fg [BP+0Eh], bg [BP+0Ch]: Byte; clear [BP+0Ah]: Boolean; const s [BP+6]: String)` (`RETF 12h`)


Word-wrapped output inside the window (x1,y1)-(x2,y2) from the text cursor `text_Col/text_Row` (text_Col/text_Row).
`Punct` = the set constant at DS:0D16 = `['!', ',', '-', '.', ':', ';', '?']` (image bytes 02 70 00 8C, elements 32..63).
Curse callers: ecl_op11_Print, ecl_op15_VerticalMenu, ecl_op29_EncounterMenu, ecl_op2E_Damage, PayForCure, Temple, TreasureMenu, NpcTakesShare, AfterCombat, Shop, ApplyEclDamage, ShowAttackResult +7. Callees: ClearTextRectangle, FlushGameKeys, RenderWrappedRun, ShowBottomPromptAndReadKey, SkipLeadingSpaces, System.@SetExpand, System.@SetIn, System.@StrAssign, System.@StrCopy.
```pascal
t := s;                                                      { 0542:04ab }
if (x1 > 39) or (y1 > 24) or (x2 > 39) or (y2 > 39) then Exit;  { 0542:04bf  quirk: y2 tested against 39 }
if (text_Col < x1) or (text_Col > x2) or (text_Row < y1) or (text_Row > y2) then begin  { 0542:04da }
  text_Col := x1;  text_Row := y1;                           { 0542:04fa  cursor outside the window -> top left }
end;
if clear then begin                                          { 0542:0506 }
  ClearTextRectangle(x1, y1, x2, y2);                        { 0542:050c }
  text_Col := x1;  text_Row := y1;                           { 0542:0520 }
end;
i := 1;                                                      { 0542:052c }
len := Length(t);                                            { 0542:0531 }
if len = 0 then Exit;                                        { 0542:0539 }
width := x2 - x1 + 1;                                        { 0542:0543  computed, never used }
repeat
  j := i;                                                    { 0542:0556 }
  while (j < len) and (t[j] in Punct) do Inc(j);             { 0542:055e  leading punctuation belongs to the run }
  while (j < len) and not (t[j] in Punct) and (t[j] <> ' ') do Inc(j);  { 0542:0596  the word }
  if t[j] <> ' ' then                                        { 0542:05dd }
    while (j + 1 < len) and (t[j+1] in Punct) do Inc(j);     { 0542:05ec  trailing punctuation }
  if (j - i) + text_Col > x2 then begin                      { 0542:062e  run does not fit on this line }
    if ((j - i) + text_Col = x2) and (t[j] = ' ') then begin { 0542:0655  quirk: dead test (> x2 already holds) }
      Dec(j);  RenderWrappedRun;                             { 0542:0688 }
    end;
    text_Col := x1;  Inc(text_Row);                          { 0542:0691  new line }
    SkipLeadingSpaces;                                       { 0542:069b }
    if (text_Row > y2) and (i < len) then begin              { 0542:06a0  window full, text left }
      text_Col := x1;  text_Row := y1;                       { 0542:06b2 }
      ShowBottomPromptAndReadKey($0D, 0, 'Press any key to continue');  { 0542:06be  string at 0542:048A }
      FlushGameKeys;                                         { 0542:06d8  06EA:024C (Pool: the disabled FUN_0899_0104) }
      ClearTextRectangle(x1, y1, x2, y2);                    { 0542:06dd }
      RenderWrappedRun;                                      { 0542:06f1  quirk: run printed without re-checking its width }
    end;
    { else: the run is re-scanned and printed in the next iteration }
  end else
    RenderWrappedRun;                                        { 0542:06f8 }
until i > len;                                               { 0542:06fd }
if text_Col > x2 then begin                                  { 0542:070a }
  text_Col := x1;  Inc(text_Row);                            { 0542:0712 }
end;
```
Notes: a run wider than the window is printed anyway on the new line (text_Col then passes x2; cells beyond col 39 are
dropped by DrawRepeatedGlyph). The scans stop at `j < len`, so the final run always ends at `len`.

### 0542:0722 ReadBottomLine (H)
Pool: 0709:09E3 ReadBottomLine — **changed**: `bg` parameter, and the demo ends the input (165/171).
`function ReadBottomLine(const prompt [BP+0Ch]: String[40]; fg [BP+0Ah], bg [BP+8], maxLen [BP+6]: Byte): String[40]` (`RETF 0Ah`; result pointer at [BP+10h])
 
Curse callers: ReadWordNumber, RuneWheelCheck, ecl_op10_InputString, WriteCharacter, CreateCharacter. Callees: ClearGlyphRun, DrawText, ReadGameKey, System.@CharToStr, System.@StrAppend, System.@StrAssign, System.@StrCopy, System.Copy, System.UpCase.
```pascal
p := prompt;                                                 { 0542:0729 }
ClearGlyphRun(0, 24, 0, 40);                                 { 0542:073c  clear the bottom row }
DrawText(0, 24, fg, bg, p);                                  { 0542:074c }
x := Length(p);                                              { 0542:0763 }
s := '';                                                     { 0542:0769 }
repeat
  k := ReadGameKey;                                          { 0542:076e }
  if (k >= ' ') and (k <= 'z') then begin                    { 0542:077b }
    if Length(s) < maxLen then begin                         { 0542:0783 }
      s := s + k;                                            { 0542:078c }
      Inc(x);                                                { 0542:07c1 }
      DrawText(x, 24, $0F, 0, k);                            { 0542:07c4  typed text white on 0; first char at col Length(prompt)+1 }
    end;
  end else if (k = #8) and (Length(s) > 0) then begin        { 0542:07e7 }
    s := Copy(s, 1, Length(s) - 1);                          { 0542:07f2 }
    ClearGlyphRun(x, 24, 0, 1);                              { 0542:081e }
    Dec(x);                                                  { 0542:082f }
  end;
until (k = #13) or (k = #27) or DemoMode;                    { 0542:0832  quirk: Esc also returns the typed text; D-Pool: the demo (g_4FBC) ends the input after one key }
ClearGlyphRun(0, 24, 0, 40);                                 { 0542:084a }
for n := 1 to Length(s) do s[n] := UpCase(s[n]);             { 0542:085a }
ReadBottomLine := s;                                         { 0542:0899 }
```

### 0542:08B3 ReadWordNumber (H)
Pool: 0709:0B66 ReadWordNumber — **changed** signature: `bg` (60/62).
`function ReadWordNumber(const prompt [BP+0Ah]: String[40]; fg [BP+8], bg [BP+6]: Byte): Word` (`RETF 8`)
Curse callers: ecl_op0F_InputNumber. Callees: ReadBottomLine, System.@StrAssign, System.@ValLong.
```pascal
p := prompt;                                                 { 0542:08ba }
repeat
  s := ReadBottomLine(p, fg, bg, 6);                         { 0542:08cd  up to 6 characters }
  Val(s, n, code);                                           { 0542:08f5  n: LongInt }
  if (code = 0) and ((n > 65536) or (n < 0)) then code := 1; { 0542:090a  quirk: 65536 accepted (returns 0) }
until code = 0;                                              { 0542:0931 }
ReadWordNumber := Word(n);                                   { 0542:0937 }
```

### 0542:0946 ShowBottomPromptAndReadKey (H)
Pool: 0709:0BF5 ShowBottomPromptAndReadKey — **changed** signature: `bg` (38/40).
`procedure ShowBottomPromptAndReadKey(fg [BP+0Ch], bg [BP+0Ah]: Byte; const s [BP+6]: String[40])` (`RETF 8`)
Curse callers: DrawWrappedText, LoseItem, ecl_op27_Treasure, ecl_op2E_Damage, HeapErrorHandler, AfterCombat, ApplyEclDamage, CheckSaveDisk, WriteCharacter, LoadMonster, SaveGame, PartyCreationMenu +4. Callees: ClearGlyphRun, DrawText, ReadGameKey, System.@StrAssign.
```pascal
t := s;                                                      { 0542:094c }
ClearGlyphRun(0, 24, 0, 40);                                 { 0542:095f }
DrawText(0, 24, fg, bg, t);                                  { 0542:096f }
key := ReadGameKey;                                          { 0542:0986  result discarded; the prompt stays on screen }
```

### 0542:0994 TimeInHundredths (H)
Pool: 0709:0C3F TimeInHundredths — **same** (38/56; the products use @LongMul in TP 5).
`function TimeInHundredths: LongInt` 
Curse callers: WaitSecondsOrKey, PlayFinaleAnimation, HorizontalMenu. Callees: Dos.GetTime, System.@LongMul.
```pascal
GetTime(h, m, sec, hund);                                    { 0542:099a  Dos.GetTime(var h, m, s, s100) }
TimeInHundredths := h * 360000 + m * 6000 + sec * 100 + hund;  { 0542:09b3  360000 = 5:7E40h }
```

### 0542:0A0E ClearScreen (H)
Pool: 0709:0CAB ClearScreen — **same** (83/102; segment constants loaded through ES).
`procedure ClearScreen` 
Curse callers: ShowTitle. Callees: FillEgaTextRectangle, System.FillChar.
```pascal
case VideoMode of                                            { 0542:0a11 }
  0: begin FillChar(Ptr($BA00, 0)^, 8000, 0); FillChar(Ptr($B800, 0)^, 8000, 0) end;    { 0542:0a1d }
  1: begin FillEgaTextRectangle(0, 0, 39, 24, 0, 0);         { 0542:0a4b  page 0 }
           FillEgaTextRectangle(0, 0, 39, 24, 1, 0) end;     { 0542:0a61  page 1 }
  2: for bank := 0 to 3 do FillChar(Ptr($B800 + bank*$200, 0)^, 8000, 0);              { 0542:0a82  unrolled ×4 }
end;
```

### 0542:0AD9 ShowTimedBottomPrompt (H)
Pool: 0709:0D68 ShowTimedBottomPrompt — **changed** signature: `bg` (48/50).
`procedure ShowTimedBottomPrompt(const s [BP+0Ah]: String[40]; fg [BP+8], bg [BP+6]: Byte)` (`RETF 8`)
Curse callers: ExploreCommand, ModifyCharacter, IconEditor, TrainCharacter, ChangeClass. Callees: ClearGlyphRun, DrawText, MessageDelay, System.@StrAssign.
```pascal
t := s;                                                      { 0542:0adf }
ClearGlyphRun(0, 24, 0, 40);                                 { 0542:0af2 }
DrawText(0, 24, fg, bg, t);                                  { 0542:0b02 }
MessageDelay;                                                { 0542:0b19 }
ClearGlyphRun(0, 24, 0, 40);                                 { 0542:0b1d }
```
Note the argument order differs from ShowBottomPromptAndReadKey: here the string is the first parameter.

### 0542:0B33 MessageDelay (H)
Pool: 0709:0DBE MessageDelay — **changed**: `GameSpeed * 100` (Pool * 225) (8/11).
`procedure MessageDelay` — ~20 callers (ecl_op3A_Delay, combat, magic, sheets).
Curse callers: ShowTimedBottomPrompt, ecl_op2D_Call, ecl_op3A_Delay, StartCombat, PoisonOpponent, ShowAttackResult, TurnUndead, AddCharacterMenu, UseItem, IdentifyItem, DailyHealing, RestLoop +10. Callees: Crt.Delay.
```pascal
Delay(GameSpeed * 100);                                      { 0542:0b36  GameSpeed 0..9 -> 0..900 ms (signed IMUL) }
```

### 0542:0B4A ClearTextRectangle (H)
Pool: 0709:0DD3 ClearTextRectangle — **same** (153/207; segment constants through ES, shifts by CL).
`procedure ClearTextRectangle(x1 [BP+0Ch], y1 [BP+0Ah], x2 [BP+8], y2 [BP+6]: ShortInt)` (RETF 8) 
Clears cells (x1,y1)-(x2,y2) to colour 0.
Curse callers: DrawWrappedText, ecl_op15_VerticalMenu, ecl_op2B_HorizontalMenu, ecl_op39_Who, HealMenu, Temple, TreasureMenu, Shop, ApplyEclDamage, RestLoop, AppraiseGems. Callees: FillEgaTextRectangle, System.FillChar.
```pascal
case VideoMode of                                            { 0542:0b50 }
  0: for line := y1*4 to y2*4 + 3 do begin                   { 0542:0b5a  CGA: 4 line pairs per cell row }
       FillChar(Ptr($B800, line*80 + x1*2)^, (x2 - x1 + 1) * 2, 0);  { 0542:0b9d }
       FillChar(Ptr($BA00, line*80 + x1*2)^, (x2 - x1 + 1) * 2, 0);  { 0542:0bc3 }
     end;
  1: begin FillEgaTextRectangle(x1, y1, x2, y2, 0, 0);       { 0542:0bf8 }
           FillEgaTextRectangle(x1, y1, x2, y2, 1, 0) end;   { 0542:0c12 }
  2: for line := y1*2 to y2*2 + 1 do                         { 0542:0c36  4 banks, 2 lines per bank per cell row }
       for bank := 0 to 3 do                                 { 0542:0c83  unrolled: 4 FillChar calls }
         FillChar(Ptr($B800 + bank*$200, line*160 + x1*4)^, (x2 - x1 + 1) * 4, 0);
end;
```

### 0542:0D20 FUN_0542_0D20 — unit init, empty (H)
`55 89 E5 89 EC 5D CB`. Pool: 0709:0F82 Unit0709Init — same.

---

## res_0636 (0636) — DAX files, file/disk prompts, BIOS text line, memory blocks, data set

Pool twin: 0802 (part T of ENGINE.pas.md). 17 of 20 routines pair with Pool. **Deltas (H):** the unit is compiled
{$I-} (no `@IOCheck` after Close/Reset/BlockRead/Seek); files are found with `Dos.FindFirst` (FileExists) and opened by
OpenWithPrompt, which splits the name with `Dos.FSplit`, defaults the directory to ProgDir (020F) and swaps ProgDir/DataDir
when the file is not where the program runs (floppy installs); the disk prompt comes from a per-data-set table `DiskPrompt`
(DS:25AE + 1Eh × DataSet: 'Insert disk B in drive ', 'Insert disk B in drive ', 'Insert disk C in drive ' for sets 1..3);
LoadDaxRecord stops the sound player around the disk access; BIOS text goes to page 0 only; two routines are new (delete a
file, read a volume label).
Variables: `NoDiskPrompt` g_5CF0 (byte: quiet open), `DaxPackBuf` g_5CF2 (far ptr: packed-record buffer), `DataSet` g_5BEE /
`PrevDataSet` g_5BEF, `DelFile` g_6512 (untyped file used by DeleteFileIfExists).
### 0636:0000 FreeBlock (H)
Pool: 0802:0000 FreeBlock — **same** (10/13; TP 5 `FreeMem(var p, n)` form).
`procedure FreeBlock(var p [BP+8]: Pointer; size [BP+6]: Word)` (retf 6) 
Curse callers: LoadDaxRecord. Callees: System.FreeMem.
```pascal
FreeMem(p, (size + 7) and $FFF8);                       { 0636:0003  size rounded up to 8 }
```

### 0636:001D AllocBlock (H)
Pool: 0802:0020 AllocBlock — **same** (9/13; TP 5 `GetMem(var p, n)` form).
`procedure AllocBlock(var p [BP+8]: Pointer; size [BP+6]: Word)` (retf 6) 
Curse callers: LoadDaxRecord. Callees: System.GetMem.
```pascal
GetMem(p, (size + 7) and $FFF8);                        { 0636:0025 }
```

### 0636:003A BiosPutChars (H)
Pool: 0802:0040 BiosPutChars — **changed**: page 0 always, no second EGA write (37/72).
`procedure BiosPutChars(col [BP+0Eh], row [BP+0Ch], colour [BP+0Ah], count [BP+8], ch [BP+6]: Byte)` (`RETF 0Ah`) — BIOS INT 10h:
set cursor (AH=2) then write `count` copies of `ch` with attribute (AH=9) on page 0. Curse callers: BiosFillChars, BiosWriteString.
```pascal
Regs.AH := 2;  Regs.BH := 0;  Regs.DH := row;  Regs.DL := col;          { 0636:003d  set cursor }
Intr($10, Regs);                                                       { 0636:0053 }
Regs.AH := 9;  Regs.AL := ch;  Regs.BH := 0;                           { 0636:0060  write char + attribute }
if VideoMode = 0 then Regs.BL := CgaColourMap[colour]                  { 0636:0070  CGA: colour map }
else Regs.BL := colour;                                                { 0636:0087 }
Regs.CX := count;                                                      { 0636:008d }
Intr($10, Regs);                                                       { 0636:0095 }
```
### 0636:00A8 BiosWriteString (H)
Pool: 0802:0105 BiosWriteString — **same** (44/44).
`procedure BiosWriteString(col [BP+0Eh], row [BP+0Ch], colour [BP+0Ah]: Byte; s [BP+6]: String)` (retf 0Ah) 
Curse callers: BiosPromptLine. Callees: BiosPutChars, System.@StrAssign.
```pascal
t := s;                                                                { 0636:00af }
for i := 1 to Length(t) do begin                                       { 0636:00c3 }
  BiosPutChars(col, row, colour, 1, t[i]);                             { 0636:00e5  push col,row,colour,1,ch }
  Inc(col);                                                            { 0636:0105 }
end;
```

### 0636:0118 BiosFillChars (H)
Pool: 0802:0175 BiosFillChars — **same** (16/17).
`procedure BiosFillChars(col [BP+0Ch], row [BP+0Ah], colour [BP+8], count [BP+6]: Byte)` (retf 8) 
Curse callers: BiosPromptLine. Callees: BiosPutChars.
```pascal
BiosPutChars(col, row, colour, count, #$DB);                          { 0636:011b  full block character }
```

### 0636:0138 BiosPromptLine (H)
Pool: 0802:0193 BiosPromptLine — **same** (48/48).
`procedure BiosPromptLine(colour [BP+0Ah]: Byte; s [BP+6]: String[40])` (retf 6)
Curse callers: LoadDaxRecord, OpenWithPrompt. Callees: BiosFillChars, BiosWriteString, ReadGameKey, System.@StrAssign.
```pascal
t := s;                                                                { 0636:013e }
BiosFillChars(0, 24, 0, 40);                                           { 0636:0151  clear row 24 (blocks in colour 0) }
BiosWriteString(0, 24, colour, t);                                     { 0636:0161 }
key := ReadGameKey;                                                  { 0636:0174  result unused }
BiosFillChars(0, 24, 0, 40);                                           { 0636:017c }
```

### 0636:0192 DeleteFileIfExists (H)
`procedure DeleteFileIfExists(name [BP+6]: String[80])` (`RETF 4`) — Curse callers: ov16 (saves). Pool: none — **new**.
```pascal
n := name;                                                             { 0636:0198 }
if FileExists(n) then begin                                            { 0636:01ab }
  Assign(DelFile, n);  Close(DelFile);  Erase(DelFile);                { 0636:01b8 / 01c7 / 01d1  Close of an unopened file: InOutRes, ignored ({$I-}) }
end;
```
### 0636:0206 WaitOverlayDisk (H)
Pool: 0802:0212 WaitOverlayDisk — **same** (32/32).
`procedure WaitOverlayDisk`
Curse callers: StartupConfiguration. Callees: FileExists, ReadGameKey, System.@StrCopy, System.@WriteLn, System.@WriteStr.
```pascal
repeat                                                                 { 0636:020c }
  ok := FileExists('game.ovr');                                        { 0636:020c }
  if not ok then begin                                                 { 0636:0222 }
    WriteLn(Output, 'Please insert overlay disk.');                    { 0636:0228 }
    key := ReadGameKey;                                              { 0636:023f }
  end;
until ok;                                                              { 0636:0247 }
```

### 0636:0257 GetVolumeLabel (H)
`procedure GetVolumeLabel(drive [BP+0Ah]: String[2]; var lbl [BP+6]: String[40])` (`RETF 8`) — Curse callers: ov16 (save disk
check). Pool: none — **new**. Name: behaviour (FindFirst with attribute 8 = VolumeID on `drive + ':\*.*'`).
```pascal
d := drive;                                                            { 0636:025e }
FillChar(sr.Name, 13, 0);                                              { 0636:0271 }
FindFirst(d + ':\*.*', VolumeID, sr);                                  { 0636:0282  ':\*.*' at 0636:0251 }
lbl := sr.Name;                                                        { 0636:02aa  empty when there is no label }
```

### 0636:02E5 OpenWithPrompt (H)
`function OpenWithPrompt(name [BP+10h], prompt [BP+0Ch]: String[80]; quiet [BP+0Ah]: Boolean; var f [BP+6]: File): Boolean`
(`RETF 0Eh`) — Curse callers: OpenDax, ov11, ov16. Locals: `dir` [BP-138h] string[67], `nm` [BP-13Dh], `ext` [BP-142h].
Pool: 0802:025D OpenWithPrompt — **changed** (54/219): directory search with FSplit and the ProgDir/DataDir swap.
```pascal
n := name;  p := prompt;                                               { 0636:02ec / 02ff }
FSplit(n, dir, nm, ext);                                               { 0636:0313 }
if dir = '' then dir := ProgDir;                                       { 0636:032f }
repeat                                                                 { 0636:034a }
  found := FileExists(dir + nm + ext);                                 { 0636:034a }
  if not found and (dir = ProgDir) then begin                          { 0636:0379 / 0383 }
    tmp := ProgDir;  ProgDir := DataDir;  DataDir := tmp;              { 0636:0398  try the other directory once, and keep it }
    dir := ProgDir;                                                    { 0636:03d3 }
    found := FileExists(dir + nm + ext);                               { 0636:03e7 }
  end;
  if not found and not quiet then                                      { 0636:0416 / 041d }
    if dir[1] < 'C' then                                               { 0636:0423  floppy: ask for the disk }
      BiosPromptLine($0E, p + DataDrive + ':')                         { 0636:042a  e.g. 'Insert disk B in drive A:' }
    else
      BiosPromptLine($0E, 'Couldn''t find ' + nm + ext + '. Check install.');   { 0636:0462 }
until found or quiet;                                                  { 0636:0499 }
if found then begin                                                    { 0636:04a9 }
  Assign(f, dir + nm + ext);  Reset(f, 1);                             { 0636:04b0 / 04e1 }
end;
OpenWithPrompt := found;                                               { 0636:04f3 }
```

### 0636:04FF FileExists (H)
`function FileExists(name [BP+6]: String[80]): Boolean` (`RETF 4`). Pool: 0802:02EB FileExists — **changed**: FindFirst instead of
Assign/Reset/Close/IOResult (30/43).
```pascal
n := name;                                                             { 0636:0505 }
FindFirst(n, 0, sr);                                                   { 0636:0518  attribute 0: normal files }
FileExists := (DosError = 0) and (n <> '');                            { 0636:052a }
```
### 0636:0549 DeleteAll (H)
Pool: 0802:0356 DeleteAll — **same** (82/82).
`function DeleteAll(s [BP+0Ah], sub [BP+6]: String): String` (retf 8; result buffer [BP+0Eh]) — caller: MakeDosName.
Curse callers: MakeDosName, WriteCharacter, LoadGame. Callees: System.@StrAssign, System.@StrCompare, System.Copy, System.Delete.
```pascal
a := s; b := sub;                                                      { 0636:0550 }
n := Length(a) - Length(b) + 1;                                        { 0636:0578  computed once }
for i := 1 to n do                                                     { 0636:059d }
  if Copy(a, i, Length(b)) = b then Delete(a, i, Length(b));           { 0636:05af }
DeleteAll := a;                                                        { 0636:05fe }
```
{ quirk: the loop bound is not reduced after a deletion and i still advances, so two adjacent occurrences leave the second one. }

### 0636:0618 MakeDosName (H)
Pool: 0802:0425 MakeDosName — **same** (91/91).
`function MakeDosName(s [BP+6]: String): String[40]` (retf 4; result buffer [BP+0Ah]) 
Curse callers: DeleteCharacterFiles, WriteCharacter, ReadCharacter, LoadGame. Callees: DeleteAll, System.@CharToStr, System.@StrAssign, System.Copy, System.UpCase.
```pascal
a := s;                                                                { 0636:061f }
for i := 1 to 10 do                                                    { 0636:0633 }
  a := DeleteAll(a, g_0C97[i]);                                        { 0636:063e  removes ' ' . * , ? / \ : ; | }
a := Copy(a, 1, 8);                                                    { 0636:067c }
for i := 1 to Length(a) do a[i] := UpCase(a[i]);                       { 0636:06a4 }
MakeDosName := a;                                                      { 0636:06e8 }
```

### 0636:0702 DaxRleDecode (H)
Pool: 0802:050F DaxRleDecode — **same** (77/83; the signed byte compares use CBW).
`procedure DaxRleDecode(var src [BP+12h], dst [BP+0Eh]: Pointer; var compSize [BP+0Ah], rawSize [BP+6]: Word)` (retf 10h) — caller: LoadDaxRecord. rawSize is not used.
Curse callers: LoadDaxRecord. Callees: System.FillChar, System.Move.
```pascal
si := 0; di := 0;                                                      { 0636:0708 }
repeat
  c := ShortInt(src^[si]);                                             { 0636:0712 }
  if (c >= 0) and (c <= $7E) then begin                                { 0636:0726 }
    Move(src^[si+1], dst^[di], c + 1);                                 { 0636:0731  literal run }
    si := si + c + 2;  di := di + c + 1;                               { 0636:0757 }
  end else if (c >= -127) and (c <= -1) then begin                     { 0636:076b }
    FillChar(dst^[di], -c, src^[si+1]);                                { 0636:0775  repeat run }
    si := si + 2;  di := di - c;                                       { 0636:07a5 }
  end;                                                                 { quirk: c = 7Fh or 80h: no progress -> endless loop (not in data) }
until si >= compSize;                                                  { 0636:07b0 }
```

### 0636:07C4 OpenDax (H)
`function OpenDax(name [BP+16h], ext [BP+12h]: String[20]; var dataStart [BP+0Eh]: Word; var fData [BP+0Ah], fDir [BP+6]: File): Boolean`
(`RETF 14h`) — opens the DAX file twice (one handle walks the directory, one reads data). Caller: LoadDaxRecord.
Pool: 0802:05CD OpenDax — **changed** (93/118): the name is not prefixed with DataPath here (OpenWithPrompt finds the directory),
the disk prompt is DiskPrompt[DataSet], `quiet` = NoDiskPrompt.
```pascal
nm := name;  ex := ext;                                                { 0636:07cb / 07de }
if not OpenWithPrompt(nm + ex, DiskPrompt[DataSet], NoDiskPrompt, fData) then Exit(false);   { 0636:07f1 / 0827 }
if not OpenWithPrompt(nm + ex, DiskPrompt[DataSet], NoDiskPrompt, fDir) then Exit(false);    { 0636:082e / 0864 }
BlockRead(fDir, dataStart, 2);                                         { 0636:0871  directory length word }
dataStart := dataStart + 2;                                            { 0636:0889  first data byte }
Seek(fData, dataStart);                                                { 0636:0890 }
OpenDax := true;                                                       { 0636:08a4 }
```
`{ quirk: if the second open fails the first file stays open (no Close). }`

### 0636:08B7 CloseDax (H)
`procedure CloseDax(var fData [BP+0Ah], fDir [BP+6]: File)` (`RETF 8`). Pool: 0802:06E7 — same without the @IOCheck calls.
```pascal
Close(fData);  Close(fDir);                                            { 0636:08ba / 08c4 }
```

### 0636:08DE LoadDaxRecord (H)
`procedure LoadDaxRecord(name [BP+14h], ext [BP+10h]: String[80]; id [BP+0Eh]: Byte; var size [BP+0Ah]: Word; var buf [BP+6]: Pointer)`
(`RETF 12h`) — ~10 callers (LoadPicture, LoadTextFont, LoadWallSet, LoadEclBlock, ov16, ov29 ...). Directory entry = 9 bytes:
id (1), offset (4, from dataStart), raw size (2), packed size (2) (decode/data/DAX.md). Pool: 0802:0716 — **changed** (205/242):
sound pause around the disk access; no DataPath prefix; {$I-}.
```pascal
nm := name;  ex := ext;                                                { 0636:08e5 / 08f8 }
PlayOrStopSound(SndStop);                                              { 0636:090c  stop the channels while the disk is read }
if not OpenDax(nm, ex, dataStart, fData, fDir) then begin              { 0636:0915 }
  size := 0;  buf := nil;                                              { 0636:093a }
  PlayOrStopSound(SndOutputOn);                                        { 0636:094e  g_25AE = 1 }
  Exit;
end;
repeat
  BlockRead(fDir, eid, 1);  BlockRead(fDir, eofs, 4);                  { 0636:095a / 0975 }
  BlockRead(fDir, size, 2);  BlockRead(fDir, packed, 2);               { 0636:0990 / 09aa }
  if packed > 36000 then begin                                         { 0636:09c5  8CA0h = the DaxPackBuf limit }
    BiosPromptLine($0E, 'tempsize ' + Str(packed));                    { 0636:09cd  'tempsize ' at 0636:08D4 }
    TerminateGame;                                                     { 0636:0a09 }
  end;
until (eid = id) or (FilePos(fDir) >= dataStart);                      { 0636:0a0e / 0a17 }
if eid = id then begin                                                 { 0636:0a3c }
  AllocBlock(DaxPackBuf, packed);                                      { 0636:0a75 }
  GetMem(buf, size);                                                   { 0636:0a82 }
  Seek(fData, dataStart + eofs);                                       { 0636:0a92 }
  BlockRead(fData, DaxPackBuf^, packed);                               { 0636:0aad }
  CloseDax(fData, fDir);                                               { 0636:0ac8 }
  DaxRleDecode(DaxPackBuf, buf, packed, size);                         { 0636:0ad8 }
  FreeBlock(DaxPackBuf, packed);                                       { 0636:0af1 }
  PlayOrStopSound(SndOutputOn);                                        { 0636:0afe }
end else begin
  size := 0;  buf := nil;                                              { 0636:0a45 }
  CloseDax(fData, fDir);                                               { 0636:0a59 }
  PlayOrStopSound(SndOutputOn);                                        { 0636:0a69 }
end;
```
### 0636:0B0D SetDataSet (H)
Pool: 0802:094A SetDataSet — **same** (8/9).
`procedure SetDataSet(n [BP+6]: Byte)` (retf 2) 
Curse callers: ecl_SetCharField, LoadCharacterIcon. Callees: -.
```pascal
PrevDataSet := DataSet;                                                     { 0636:0b10  remember the previous one }
DataSet := n;                                                          { 0636:0b16 }
```
No disk prompt here (the prompt comes from OpenDax when a file is opened).

### 0636:0B22 RestoreDataSet (H)
Pool: 0802:095D RestoreDataSet — **same** (6/7).
`procedure RestoreDataSet` 
Curse callers: LoadCharacterIcon. Callees: -.
```pascal
DataSet := PrevDataSet;                                                     { 0636:0b25 }
```

### 0636:0B2F FUN_0636_0B2F — unit init, empty (H)
`55 89 E5 89 EC 5D CB`. Pool: 0802:0968 Unit0802_Init — same.

---

## res_06EA (06EA) — key input, hot keys, debug log, program exit

Pool twin: 0899 (ENGINE.pas.md). **Deltas (H):** ReadGameKey does not wait in the demo (returns #0 when no key is down);
^S mutes/unmutes through PlayOrStopSound(SndStop / SndOutputOn) instead of Pool's ResetSound; the `STING` debug keys are
^D = toggle a log file `debug.txt` (text file `DebugLog` g_8B76) and ^Z = dump every party member's effect list into it
(Pool: ^D only toggled DebugFlag); TerminateGame closes the log and restores the BIOS keyboard flags; the key flush that was
disabled in Pool (0899:0104) is active (FlushGameKeys). CS constants: set `[0, 1]` at 06EA:00DD, `'who: '` 0055,
`'  sp#: '` 005B, `'STING'` 00FD, `'debug.txt'` 0103.

### 06EA:0000 TerminateGame (H)
`procedure TerminateGame` — restores the sound and video state and halts. Callers: ReadGameKey (^C in STING mode), LoadDaxRecord
("tempsize"), RuneWheelCheck, many overlay error paths (functions.tsv). Pool: 0899:0000 — **changed** (log close, BIOS flags).
```pascal
SoundDevice := SoundDeviceSaved;                                       { 06ea:0006  undo a ^S mute }
PlayOrStopSound(SndShutdown);                                          { 06ea:000c  $FF: stop and remove the timer }
Regs.AH := 0;  Regs.AL := PrevBiosVideoMode;                           { 06ea:0015 }
Intr($10, Regs);                                                       { 06ea:0020  back to the start-up video mode }
if DebugFlag then Close(DebugLog);                                     { 06ea:002d  g_4FC1, g_8B76 }
Mem[$0040:$0017] := BiosKbdFlags;                                            { 06ea:003e  BIOS keyboard shift flags saved by ov11_0056 at start-up }
Halt(0);                                                               { 06ea:004a }
```

### 06EA:0063 DumpCharacterEffects (H)
`procedure DumpCharacterEffects(c [BP+6]: PChar)` (`RETF 4`) — writes one log line per active effect of `c`. Caller: ReadGameKey
(^Z). Pool: none — **new**. Record offsets: name string at +0, effect list head at +F2h (effect: id byte at +0, next at +5;
cab-ecl ECL_VM.md CHECKPARTY).
```pascal
e := c^.effects;                                                       { 06ea:0069  c + F2h }
while e <> nil do begin                                                { 06ea:0079 }
  WriteLn(DebugLog, 'who: ', c^.name, '  sp#: ', e^.id);               { 06ea:0081 .. 00c1 }
  e := e^.next;                                                        { 06ea:00c6  e + 5 }
end;
```

### 06EA:010D ReadGameKey (H)
`function ReadGameKey: Char` — the game's key reader. ~40 callers (prompts, menus, ReadBottomLine, overlays).
Pool: 0899:0059 ReadGameKey — **changed** (see unit note).
```pascal
if DemoMode then begin                                                 { 06ea:0114  g_4FBC }
  if KeyPressed then ch := ReadKey else ch := #0                       { 06ea:011b / 012e }
end else ch := ReadKey;                                                { 06ea:0134 }
if ch = ^S then begin                                                  { 06ea:013c  sound on/off }
  if SoundDevice <> 2 then begin                                       { 06ea:0142 }
    SoundDeviceSaved := SoundDevice;                                   { 06ea:0149 }
    PlayOrStopSound(SndStop);                                          { 06ea:014f  0: stop the channels }
    SoundDevice := 2;                                                  { 06ea:0158  silent }
  end else if SoundDeviceSaved in [0, 1] then begin                    { 06ea:015f  set CS:00DD }
    SoundDevice := SoundDeviceSaved;                                   { 06ea:016f }
    PlayOrStopSound(SndOutputOn);                                      { 06ea:0175  1 }
  end;
end;
if ParamStr(1) = 'STING' then                                          { 06ea:017e  debug keys }
  case ch of
    ^D: begin                                                          { 06ea:019c }
          DebugFlag := not DebugFlag;                                  { 06ea:01a3 }
          if DebugFlag then begin Assign(DebugLog, 'debug.txt'); Rewrite(DebugLog) end   { 06ea:01b3 / 01ba / 01c9 }
          else Close(DebugLog);                                        { 06ea:01d5 }
        end;
    ^Z: if DebugFlag then begin                                        { 06ea:01e1 / 01e5 }
          p := PartyList;                                              { 06ea:01ec  g_650A }
          while p <> nil do begin DumpCharacterEffects(p); p := p^.next end;   { 06ea:01f8 / 0200 / 020a  next at +189h }
        end;
    ^C: TerminateGame;                                                 { 06ea:021e }
  end;
if ch <> #0 then                                                       { 06ea:0226 }
  while KeyPressed do ch := ReadKey;                                   { 06ea:022c  quirk (as Pool): drains type-ahead, the LAST key wins }
ReadGameKey := ch;                                                     { 06ea:023f }
```
`{ quirk: an extended key returns #0 and leaves the scan code for the next call; only non-zero keys drain the buffer. }`

### 06EA:024C FlushGameKeys (H)
`procedure FlushGameKeys` — Callers: MainProgram (after the demo), LoadPicture, DrawWrappedText, 13 overlay sites.
Pool: 0899:0104 FUN_0899_0104 — **changed**: the loop is live here (Pool skipped it with a JMP).
```pascal
while KeyPressed do dummy := ReadGameKey;                              { 06ea:0252 / 025c }
```

### 06EA:0268 PollOneKey (H)
`procedure PollOneKey` — callers: ov10 (2 sites). Pool: 0899:0122 — **same**.
```pascal
if KeyPressed then dummy := ReadGameKey;                               { 06ea:026e  result discarded }
```

### 06EA:0282 FUN_06EA_0282 — unit init, empty (H)
`55 89 E5 89 EC 5D CB`. Pool: 0899:013C — same.

---

## res_0713 (0713) — sound driver (PC speaker / Tandy PSG timer player)

Pool twin: 08AE (ENGINE.pas.md). The timer-driven part (0713:21F0..2697) is Pool's code relocated: every CS variable sits
B7h lower than in Pool (Pool CS:01D7 → Curse CS:0120 etc.), the routines run with `DS = CS = 0713`, and their variables are
`cs0713_XXXX`. **Deltas (H):** no transient mode — the timer is installed once by StartSound and removed only by
PlayOrStopSound($FF) (Pool's TimeInHundredths_08AE, WaitHundredths, ResetSound, SetSoundTimerMode are not linked);
SoundDevice codes are 0 = speaker, 1 = Tandy PSG, 2 = silent (Pool 1 = speaker, 0 = PSG); the note list has 2-byte entries
with a length table (Pool: 3-byte entries) and plays notes on any channel of the bank (Pool: channel 0 only); a noteOff gap
field (+10h) shortens notes; sound id 15 arms the hidden countdown.
CS data (image bytes, H): `0000` set `[0..15, 255]` (accepted sound ids), `0120` tick divider (0Dh), `0121` busy flag,
`0122` channel loop counter, `0123` channel record size (30h), `0124` countdown word (0), `0126..0146` 33 bytes
`'Run-time  Error 209 at 0BAD:0038'#10` with bit 7 set, `0148` current sound index, `014A` current channel pointer,
`014C` channel array base, `014E` note-table pointer, `0150` subroutine return pointer, `0152..0155` sound index per channel,
`0156` output enable, `0157..0169` note-length table (19 bytes: 00 00 00 02 00 03 04 00 06 08 00 0C 10 00 18 20 00 30 40),
`016A` command jump table (FA..FF → 24C2, 2520, 2527, 24B9, 24A2, 24F3), `0176` 4 speaker channel records (30h each),
`02F6` speaker note table, `030E` loudest speaker channel, `0310` 4 PSG channel records, `0490` PSG note table,
`04A8` speaker sound table (word per channel, 8 bytes per sound), `0548` PSG sound table, `21EC/21EE` saved INT 08 vector.
DS constants used as arguments everywhere: `SndShutdown` g_25AA = FFh, `SndStop` g_25AC = 0, `SndOutputOn` g_25AE = 1,
then g_25B0..g_25C8 = 2..0Eh (the sound effects; g_25C0 = 0Ah is the step sound), g_25CA = 0Fh (never pushed by any caller).

### 0713:0020 PlayOrStopSound (H)
`procedure PlayOrStopSound(snd [BP+6]: Word)` (`RETF 2`) — ~60 call sites, every one pushes one of the DS words g_25AA..g_25C6
(functions.tsv). Pool: 08AE:00DC — **changed** (no transient install/wait/remove; device codes; id 15).
```pascal
if not (Lo(snd) in [0..15, 255]) then Exit;                            { 0713:0023  set CS:0000 }
case snd of                                                            { 0713:0036 }
  0:   if SoundDevice <> 2 then begin StartPsgChannels(0); StartSpeakerChannels(0) end;   { 0713:003e  silence all channels }
  1:   if SoundDevice <> 2 then SetSoundOutput(1);                     { 0713:005a  output on }
  $FF: if SoundDevice <> 2 then begin                                  { 0713:0070 }
         StartPsgChannels(0);  StartSpeakerChannels(0);                { 0713:0077 }
         RemoveSoundTimer;  SoundTimerOn := false;                     { 0713:0085  g_5BEC }
       end;
  2..14: if SoundDevice <> 2 then                                      { 0713:0090 }
         if SoundDevice = 0 then StartSpeakerChannels(snd - 1)         { 0713:00a1 }
         else if SoundDevice = 1 then StartPsgChannels(snd - 1);       { 0713:00b3 }
  15:  CountdownPtr^ := 5000;                                          { 0713:00c2  g_4F94 → CS:0124: arms the countdown (see the ISR) }
end;
```
`{ quirk: id 15 arms the "Run-time Error 209" timebomb (about 21 s at 236.7 Hz, then exit code 255). No caller pushes g_25CA (=15)
in any listing (all sites checked), so it never fires in the shipped game; a port need not implement it. }`
`{ note: the stop case 0 does not clear the output enable; 1 sets it. LoadDaxRecord brackets disk access with 0 ... 1. }`

### 0713:00D6 StartSound (H)
`procedure StartSound` — callers: MainProgram (start and after every phase), the timer is (re)installed when SoundTimerOn = false.
Pool: none (Pool used ResetSound / transient installs) — **new**.
```pascal
CountdownPtr := Ptr($0713, $0124);                                     { 0713:00d9  g_4F94/g_4F96 }
SoundDeviceSaved := SoundDevice;                                       { 0713:00e6  g_5BEB }
SoundTimerOn := true;                                                  { 0713:00ec }
if SoundDevice <> 2 then begin                                         { 0713:00f1 }
  InstallSoundTimer;                                                   { 0713:00fa }
  StartSpeakerChannels(0);  StartPsgChannels(0);                       { 0713:00fe / 0105 }
end;
```

### 0713:0110 FUN_0713_0110 — unit init (H)
```pascal
CountdownPtr^ := 0;                                                    { 0713:0113 }
```
`{ quirk: runs in the init chain before StartSound has set CountdownPtr, so the pointer is still nil (BSS) and the word 0 is
written to 0000:0000 = the offset of the INT 00h vector (H by order: init at MainProgram 0000:003E, StartSound at 0000:0126).
System.Init has already hooked INT 00h, so a later divide error would jump to <its segment>:0000. Harmless unless a division by
zero happens; a port ignores it. }`

### 0713:21F0 InstallSoundTimer (H)
`procedure InstallSoundTimer` (far, no frame) — callers: StartSound. Pool: 08AE:137C — **same** (saved vector at CS:21EC/21EE).
```pascal
GetIntVec($08, cs0713_SavedInt08);                                     { 0713:21f7  INT 21h AX=3508h }
SetIntVec($08, @SoundTimerInterrupt);                                  { 0713:2206  DS:DX = 0713:225E }
Port[$43] := $B6;                                                      { 0713:2215  (as Pool: counter-2 control word, then the reload goes to port 40h) }
Port[$40] := Lo($13B1);  Port[$40] := Hi($13B1);                       { 0713:2219  INT 08 at 236.7 Hz }
```

### 0713:2225 RemoveSoundTimer (H)
Pool: 08AE:13B1 — **same**.
```pascal
SetIntVec($08, cs0713_SavedInt08);                                     { 0713:222b }
Port[$40] := $FF;  Port[$40] := $FF;                                   { 0713:223d  18.2 Hz again }
Port[$61] := Port[$61] and $FC;                                        { 0713:2246  speaker off }
Port[$C0] := $9F;  Port[$C0] := $BF;  Port[$C0] := $DF;  Port[$C0] := $FF;   { 0713:224c  PSG: all channels silent }
```

### 0713:225E SoundTimerInterrupt (H) — interrupt handler, not a Ghidra function
Pool: 08AE:13EA — **same** (variables relocated).
```pascal
EnableInterrupts;                                                      { 0713:225e }
if cs0713_Countdown <> 0 then begin                                    { 0713:2269  CS:0124 }
  Dec(cs0713_Countdown);                                               { 0713:2270 }
  if cs0713_Countdown = 0 then begin                                   { 0713:2274 }
    { INT 10h AH=0Fh / AH=0: re-set the video mode }                   { 0713:2276 }
    for i := 0 to 32 do cs0713_Msg[i] := cs0713_Msg[i] and $7F;        { 0713:227e  'Run-time  Error 209 at 0BAD:0038' }
    { INT 10h AH=13h: write it at row 0, col 0, attribute 7 }          { 0713:2298 }
    { INT 21h AX=4CFFh: terminate, exit code 255 }                     { 0713:22af }
  end;
end;
if cs0713_Busy = 0 then begin                                          { 0713:22b5  CS:0121 }
  cs0713_Busy := 1;                                                    { 0713:22bc }
  SpeakerChannelTick;  PsgChannelTick;                                 { 0713:22c1 / 22c4 }
  cs0713_Busy := 0;                                                    { 0713:22c7 }
end;
Dec(cs0713_TickDiv);                                                   { 0713:22cc  CS:0120 }
if cs0713_TickDiv = 0 then begin
  cs0713_TickDiv := $0D;                                               { 0713:22d2 }
  JumpFar(cs0713_SavedInt08);                                          { 0713:22dc  every 13th tick to the BIOS handler }
end else
  Port[$20] := $20;                                                    { 0713:22e1  EOI; IRET }
```

### 0713:22EB SpeakerChannelTick (H) — not a Ghidra function
Pool: 08AE:1477 — **same** (channels CS:0176, note table 02F6, loudest 030E, output enable 0156).
```pascal
if cs0713_CurSound = 0 then begin gate := 0; goto Out end;             { 0713:22eb  CS:0148 }
loudest := nil;                                                        { 0713:22f4 }
cs0713_NoteTab := @SpeakerNoteTable;  cs0713_ChanBase := @SpeakerChannels;   { 0713:22ff / 2306 }
for k := 1 to 4 do begin                                               { 0713:22fa  counter CS:0122 }
  ch := @SpeakerChannels[k];
  if ch^.duration <> 0 then begin                                      { 0713:230d }
    SoundChannelStep(ch);                                              { 0713:2312 }
    if (loudest = nil) and (ch^.volume <> 0) and (ch^.duration <> 0) then loudest := ch;   { 0713:2315 }
  end;
end;
gate := cs0713_OutputOn;                                               { 0713:2334 }
if (gate <> 0) and (loudest <> nil) then begin                         { 0713:2338 / 233d }
  Port[$42] := Lo(loudest^.divisor);  Port[$42] := Hi(loudest^.divisor);   { 0713:2348 }
  gate := loudest^.volume and 3;                                       { 0713:2351 }
end;
Out:
Port[$61] := (Port[$61] and $FC) or gate;                              { 0713:2357 }
```

### 0713:2360 PsgChannelTick (H) — not a Ghidra function
Pool: 08AE:14EC — **same** (channels CS:0310, note table 0490); SN76489 on port C0h, packing as coded (M, as Pool).
```pascal
if cs0713_CurSound = 0 then goto Silence;                              { 0713:2360 }
cs0713_NoteTab := @PsgNoteTable;  cs0713_ChanBase := @PsgChannels;     { 0713:236e / 2375 }
for k := 1 to 4 do if PsgChannels[k].duration <> 0 then ChannelStep(@PsgChannels[k]);   { 0713:2369 / 237c }
if cs0713_OutputOn = 0 then goto Silence;                              { 0713:238d }
latch := $80;                                                          { 0713:239c }
for k := 1 to 4 do begin                                               { 0713:2394 }
  f := PsgChannels[k].divisor shr 2;                                   { 0713:239e }
  Port[$C0] := latch xor (Lo(f) shr 4);                                { 0713:23a5 }
  if latch <> $E0 then Port[$C0] := Hi(f);                             { 0713:23b1 }
  Port[$C0] := (latch xor (Hi($FFFF - PsgChannels[k].volume) shr 4)) + $10;   { 0713:23ba }
  latch := latch + $20;                                                { 0713:23d0 }
end;
Exit;
Silence:
Port[$C0] := $9F;  Port[$C0] := $BF;  Port[$C0] := $DF;  Port[$C0] := $FF;   { 0713:23dd }
```

### 0713:23EE SoundChannelStep (H) — not a Ghidra function
Pool: 08AE:157A SoundChannelStep — **same** instruction for instruction (fields: +0 duration, +2 cmdPtr, +4 pitch, +6 slide,
+8 divisor, +0Ah volume, +0Ch volDelta, +0Eh tempo, +10h gap (Curse use, see NoteList), +12h transpose, +14h noteOff,
+16h envTable, +18h envIndex, +1Ah envCount, +1Ch vibTable, +1Eh vibPhase, +20h vibRate, +22h vibDepth, +24h vibLength).
```pascal
ch^.volume := ch^.volume + ch^.volDelta;                               { 0713:23f0 }
ch^.pitch := ch^.pitch + ch^.slide;                                    { 0713:23f6 }
vib := 0;  p := ch^.vibPhase + ch^.vibRate;                            { 0713:23fc / 23fe }
if p <> 0 then begin
  if p >= ch^.vibLength then p := p - ch^.vibLength;                   { 0713:2406 }
  ch^.vibPhase := p;                                                   { 0713:240e }
  vib := HiWord(SmallInt(ch^.vibTable^[p sar 4] shl 8) * ch^.vibDepth);   { 0713:2411  IMUL high word }
end;
ch^.divisor := ch^.pitch + vib;                                        { 0713:2421 }
if ch^.noteOff <> 0 then begin                                         { 0713:2427 }
  Dec(ch^.noteOff);                                                    { 0713:242d }
  if ch^.noteOff = 0 then begin ch^.envIndex := $10; ch^.envCount := 1 end;   { 0713:2432  release }
end;
Dec(ch^.duration);                                                     { 0713:243c }
if ch^.duration = 0 then ReadSoundCommands(ch);                        { 0713:2440 }
if ch^.envCount <> 0 then begin                                        { 0713:2443 }
  Dec(ch^.envCount);                                                   { 0713:2449 }
  if ch^.envCount = 0 then
    repeat                                                             { 0713:244e }
      e := ch^.envTable + ch^.envIndex;
      if e^.count = $FFFF then begin                                   { 0713:2454 }
        ch^.volume := e^.value;  if e^.value = 0 then ch^.volDelta := 0;   { 0713:245a }
        ch^.envIndex := ch^.envIndex + 4;                              { 0713:2467 }
      end else begin
        ch^.volDelta := e^.value;  ch^.envCount := e^.count;           { 0713:246d }
        ch^.envIndex := ch^.envIndex + 4;  Break;                      { 0713:2478 }
      end;
    until False;
end;
```

### 0713:247F ReadSoundCommands (H) — not a Ghidra function
Pool: 08AE:160B — **changed** in the note list (below); the FA..FF commands are the same (jump table CS:016A).
```pascal
p := ch^.cmdPtr;  if p = nil then Exit;                                { 0713:247f }
cs0713_CurChan := ch;                                                  { 0713:2488  CS:014A }
repeat
  op := p^;  Inc(p);                                                   { 0713:248c }
  if op < $FA then begin NoteList(op); Exit end;                       { 0713:248f → 2538 }
  case op of                                                           { 0713:249e  JMP [016Ah + 2*(op-FAh)] }
    $FA: ResetChannel(ch);                                             { 0713:24c2  clears +04..+0C, +10, +12, +16..+24 }
    $FB: p := cs0713_RetPtr;                                           { 0713:2520 }
    $FC: begin cs0713_RetPtr := p + 2;  p := PWord(p)^ end;            { 0713:2527 }
    $FD: begin ch := cs0713_ChanBase + PWord(p)^;  Inc(p, 2);  ResetChannel(ch) end;   { 0713:24b9  (as Pool: SI stays on that channel) }
    $FE: begin f := p^;  target := PWord(p+1)^;  Inc(p, 3);            { 0713:24a2  loop on field f }
           if PWord(@ch^ + f)^ <> 0 then begin Dec(PWord(@ch^ + f)^); if PWord(@ch^ + f)^ = 0 then Continue end;
           p := target end;
    $FF: begin f := p^;  PWord(@ch^ + f)^ := PWord(p+1)^;  Inc(p, 3);  { 0713:24f3  set field f }
           if f = 0 then begin FinishStep; Exit end end;
  end;
until False;
FinishStep:                                                            { 0713:2503 }
  ch := cs0713_CurChan;
  if ch^.duration = 0 then begin cs0713_SndIdx[4 - cs0713_Loop] := 0;  p := nil end;   { 0713:2507 / 250c }
  ch^.cmdPtr := p;                                                     { 0713:251c }
NoteList (0713:2535..25AD): **2-byte entries {e0, e1}**, e0 = channel (bits 7..5) + length index (bits 4..0), e1 = note
(bit 7 = last entry of the list, 7Fh = rest):
  repeat
    dst := cs0713_ChanBase + (e0 shr 5) * cs0713_RecSize;              { 0713:2539 }
    t := Lo(ch^.tempo);  if t = 0 then t := 1;                         { 0713:254c }
    ch^.duration := t * LenTable[e0 and $1F];                          { 0713:2555  CS:0157 }
    n := e1 and $7F;                                                   { 0713:255d }
    if n <> $7F then begin                                             { 0713:2562 }
      dst^.duration := ch^.duration;                                   { 0713:2567 }
      dst^.noteOff := ch^.duration - dst^.gap;                         { 0713:256b  +10h: note sounds `gap` ticks shorter }
      n := n + dst^.transpose;                                         { 0713:2571 }
      dst^.envIndex := 0;  dst^.envCount := 1;                         { 0713:2574  attack }
      octave := n div 12;  n := n mod 12;                              { 0713:257e }
      dst^.pitch := NoteTable[n] shr octave;  dst^.divisor := dst^.pitch;   { 0713:2595 }
    end;
  until e1 and $80 <> 0;                                               { 0713:25a3 }
  then FinishStep.
```
`{ quirk: LenTable has 19 entries; length indexes 19..31 read the jump-table bytes that follow it (not used by the data, L). }`
`{ quirk: CMP DI,3A0h / JNE to the next instruction at 0713:258f is a no-op. }`

### 0713:25B0 StartSpeakerChannels (H)
`procedure StartSpeakerChannels(snd [BP+6]: Word)` (`RETF 2`, preserves registers, DS := 0713) — callers: PlayOrStopSound, StartSound.
Pool: 08AE:1742 — **same** (tables relocated).
```pascal
cs0713_CurSound := snd;                                                { 0713:25bd }
cs0713_Busy := 1;                                                      { 0713:25ca  keep the ISR out }
for k := 0 to 3 do begin                                               { 0713:25cf }
  seq := SpeakerSoundTable[snd*4 + k];                                 { 0713:25d7  word at 04A8h + snd*8 + k*2 }
  if seq <> 0 then begin
    FillChar(SpeakerChannels[k], $30, 0);                              { 0713:25e0 }
    SpeakerChannels[k].cmdPtr := seq;                                  { 0713:25ec }
    cs0713_SndIdx[k] := Lo(snd);                                       { 0713:25ef }
    SpeakerChannels[k].duration := 1;                                  { 0713:25fe }
  end;
end;
cs0713_Busy := 0;                                                      { 0713:260e }
```

### 0713:261A StartPsgChannels (H)
Same as StartSpeakerChannels with `PsgSoundTable` (CS:0548) and `PsgChannels` (CS:0310) `{ 0713:2627 .. 2678 }`. Pool: 08AE:17AE — same.

### 0713:2684 SetSoundOutput (H)
`procedure SetSoundOutput(on [BP+6]: Word)` (`RETF 2`). Pool: 08AE:181A — same.
```pascal
cs0713_OutputOn := Lo(on);                                             { 0713:268e }
```

---

## Unknowns (explicit)
- 0186 / 019B: empty units, source role unknown (L). 097D only sets CopyProtWord.
- 01A0: the meaning of the per-cell frame tables (which 8X8D symbols they select) is data, not decoded here (cab-data).
- 020F: g_4F98 ('F' on config line 4) gates TITLE/2 (cab-data note, L); g_8C9A, g_4E40 roles beyond what is shown: unknown.
- 0297: the 0EFF/1110 names are by behaviour (Get/Put); DrawPicture's clipping is always on (Pool's g_5370 switch has no Curse twin found).
- 0542: GlyphCga bit order is by construction (L), not checked against a capture.
- 0636: DiskPrompt entry 0 overlaps the sound constants (DataSet 0 is never opened with a prompt, L).
- 0713: note-length table entries 19..31 (read the jump table, never used by the data, L); timebomb id 15 has no caller.
- Pool names kept without a Curse-specific check of their callers' meaning: SetDisplayPage/SetDrawPage page semantics (M).

## Self-check
Method: `scratchpad/sample.py` (seed 20261020) drew 99 of the 998 anchored Pascal statements (10%) at random; each was
re-read against the instructions at its address (capstone decode of START.EXE). Sample (line numbers of this file at the
time of the check): main 44, 70, 77; 01A0 116, 125, 126, 151, 160, 196; 020F 231, 233, 240, 242, 262, 280, 290, 301, 307,
311, 314, 328; 0297 400, 401, 429, 430, 432, 435, 451, 452, 455, 462, 496, 549, 555, 631, 633, 646, 648, 660, 729, 781, 786,
789, 791, 797, 830, 869, 883, 885, 892, 912, 933, 953, 956, 967, 1002, 1017, 1031, 1036, 1072; 0542 1114, 1117, 1173, 1192,
1237, 1252, 1289, 1290, 1324, 1326, 1333, 1343, 1365, 1426; 0636 1472, 1485, 1527, 1537, 1548, 1596, 1600, 1610, 1627, 1633,
1649, 1651, 1684; 0713 1817, 1867, 1887, 1933, 1945, 1955, 1961, 1969, 1979, 1999, 2015, 2032.
Result: 99/99 agree with the asm (operands, constants, push order, branch sense). Notes: BlitCga's `save := false`
(0297:2251) also zeroes clipL/clipR (stated in the frame description); the masked-row and EGA write-mode details agree.
Argument order: `python -I decode/tools/argcheck.py RESIDENT` → 472 calls, OK 84, **MISMATCH 0**, UNSURE 388
(`RESIDENT_ARGCHECK.md`); its one first-run MISMATCH (01A0:02DA, two calls on one line sharing one anchor) was split into
separate anchored statements. All multi-argument calls written new for Curse were taken from their PUSH sequences.
Anchors: `python -I decode/tools/anchorcheck.py decode/pseudo/RESIDENT.pas.md` → every `{ seg:off }` is an instruction start.

**DOSBox oracle #ref-1 (cab-ref-fixes):** RESIDENT-01 claimed the credits stay behind the `Play Demo` prompt; ShowTitle
ends with `ClearScreen` 2100:076b, so the prompt is on a black screen (REF-S015). SCREENS row corrected; no statement here
was affected.
