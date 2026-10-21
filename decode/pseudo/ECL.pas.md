# ECL — the event-script VM unit and its tracer (FINAL pseudocode, lane cab-mod-eclview)

Units (herdr/assignments/cab-areas.md): **ov02** (2200: the ECL VM — 59 handlers + dispatch, fetch loop, game loop) and **ov34** (7300: SSI's opcode-name table / script tracer). Pool twin: `PoolRadianceRE/decode/pseudo/ECL.pas.md` (Pool ov03 2F00 + ov07 4300; Curse's ov07 belongs to COMBAT and is specified in `decode/ecl/ECL_VM.md` §1-3).
Spec of record: **`decode/ecl/ECL_VM.md`** (every opcode handler: address, `ReadOperands(n)`, Pascal semantics, confidence, Pool delta). This file does not repeat the handler bodies: §1 lists them with their citation addresses and points at the spec section; §2 writes in full the routines the spec only summarises (game loop, RunAfterNewBlock, CampCheck, Run, Dispatch, the dependency touch) and §3 the tracer.
Sources: `decode/listings/ov02.lst` / `ov34.lst` (evidence, names from `decode/names/ecl_names.json`), `.c` (Ghidra aid). Conventions as VIEW.pas.md (Pascal order = push order, checked with `decode/tools/argcheck.py` -> ECL_ARGCHECK.md). Globals: ECL_VM.md §6 (`ecl_PC` g_4FB4, `ecl_Stop` g_47E0, `ecl_Restart` g_47E1, `ecl_CurOp` g_75FF, `ecl_LastOp` g_75FE, `ecl_CodeBuf` g_4FA5, `ecl_VecA..E` g_4FAA..4FB2, `ecl_Block` g_8B5E, `PartyDead` g_4FC7, `DebugFlag` g_4FC1 (trace), `Resuming` g_4FC2, `Demo` g_4FBC, `view_Mode` g_4FBA, `view_PrevMode` g_4FBB, `ecl_SavedSelectedChar` g_47E7, `ecl_RestoreSelPending` g_47E2, `SelectedChar` g_6506, `PartyHead` g_650A, `view_Redraw` g_7580), VIEW names for ov14/ov28 (ExploreCommand 3F00:090A, MoveParty 3F00:0BAF, RefreshView 6B00:00CC, FreeAnimation 6C00:055B).

---

## 1. ov02 (2200) — opcode handlers (spec: ECL_VM.md §4)

| address | name | ReadOperands | spec | callers |
|---|---|---|---|---|
| 2200:0052 | ecl_op00_Exit (H) | — (`INC ecl_PC` 2200:009a) | §4.1 EXIT; body asm 2200:0052..00E7 (gosub list freed 009e..00d3) | ecl_Dispatch, ecl_op13_Return, ecl_op38_Program |
| 2200:00E8 | ecl_op01_Goto (H) | 1 { 2200:00ee } | §4.1 | ecl_Dispatch |
| 2200:0107 | ecl_op02_Gosub (H) | 1 { 2200:010d }; ecl_Gosub(1) { 2200:0115 } | §4.1 | |
| 2200:011E | ecl_op03_Compare (H) | 2 { 2200:0125 } | §4.1 | |
| 2200:019B | ecl_op04_AddSubDivMul (H) | 3 { 2200:01a1 }; case on ecl_CurOp 04..07 { 2200:01d1.. } | §4.1 (DIVIDE remainder -> Mem[7F3F] { 2200:0210 }) | |
| 2200:0244 | ecl_op08_Random (H) | 2 { 2200:024a } | §4.1 | |
| 2200:02A2 | ecl_op09_Save (H) | 2 { 2200:02a8 } | §4.1 | |
| 2200:02F0 | ecl_op0A_LoadCharacter (H) | 1 { 2200:02fb } | §4.3 | |
| 2200:0466 | ecl_op0B_LoadMonster (H) | 3 { 2200:0473 } | §4.4 | |
| 2200:03CA | ecl_op0C_SetupMonster (H) | 3 { 2200:03d0 } | §4.4 | |
| 2200:0801 | ecl_op0D_Approach (H) | — | §4.4 | |
| 2200:0841 | ecl_op0E_Picture (H) | 1 { 2200:0847 } | §4.4 (BIGPIC branch 2200:08f0..) | |
| 2200:092C | ecl_op0F_InputNumber (H) | 2 { 2200:0932 } | §4.2 | |
| 2200:0972 | ecl_op10_InputString (H) | 2 { 2200:0979 } | §4.2 | |
| 2200:09EA | ecl_op11_Print (H) | 1 { 2200:09f1 }; PRINTCLEAR when ecl_CurOp = 12h | §4.2 | |
| 2200:0A86 | ecl_op13_Return (H) | — (`INC ecl_PC` 2200:0a89; empty list -> `CALL ecl_op00_Exit` 2200:0acf) | §4.1 | |
| 2200:0AD6 | ecl_op14_CompareAnd (H) | 4 { 2200:0adc } | §4.1 | |
| 2200:0EBD | ecl_op15_VerticalMenu (H) | 3 + count { 2200:0ec4 / 0f17 } | §4.2 | |
| 2200:0B3B | ecl_op16_If (H) | — (`INC ecl_PC` 2200:0b3e; flag test per opcode 2200:0b42..0bb0; ecl_SkipInstruction when false) | §2.4 | |
| 2200:120E | ecl_op1C_ClearMonsters (H) | — | §4.4 | |
| 2200:1271 | ecl_op1D_PartyStrength (H) | 1 { 2200:1277 } | §4.3 | |
| 2200:1416 | ecl_op1E_CheckParty (H) | 6 { 2200:141c }; helper ecl_op1E_StoreResults 2200:13B6 (four SetMem) | §4.3 (7FFFh bug at 2200:14b4) | |
| 2200:0BBB | ecl_op20_NewEcl (H) | 1 { 2200:0bc1 } | §4.5 | |
| 2200:0C15 | ecl_op21_LoadFilesPieces (H) | 3 { 2200:0c1b }; LOAD FILES when ecl_CurOp = 21h { 2200:0c4c } | §4.5 | |
| 2200:1636 | ecl_op22_PartySurprise (H) | 2 { 2200:163c } | §4.3 | |
| 2200:16D2 | ecl_op23_Surprise (H) | 4 { 2200:16d8 } | §4.3 | |
| 2200:179A | ecl_op24_Combat (H) | — | §4.4 | |
| 2200:1A9B | ecl_op25_OnGotoGosub (H) | 2 + count { 2200:1aa1 / 1aea } | §4.1 | |
| 2200:1B53 | ecl_op27_Treasure (H) | 8 { 2200:1b5a } | §4.4 | |
| 2200:1F46 | ecl_op28_Rob (H) | 3 { 2200:1f4c } | §4.3 | |
| 2200:2086 | ecl_op29_EncounterMenu (M) | 14 { 2200:208d } | §4.4 | |
| 2200:0E13 | ecl_op2A_GetTable (H) | 3 { 2200:0e19 } | §4.1 | |
| 2200:1082 | ecl_op2B_HorizontalMenu (H) | 2 + count { 2200:1089 / 10bc } | §4.2 | |
| 2200:27A8 | ecl_op2C_Parlay (H) | 6 { 2200:27af } | §4.4 | |
| 2200:2F02 | ecl_op2D_Call (H) | 1 { 2200:2f08 }; ids 2E10h / 8000h / 8001h / B200h / C01Eh / C018h / 6803h | §4.5 | |
| 2200:2942 | ecl_op2E_Damage (M) | 5 { 2200:2948 } | §4.3 | |
| 2200:0DA4 | ecl_op2F_AndOr (H) | 3 { 2200:0daa }; OR when ecl_CurOp = 30h { 2200:0dd8 } | §4.1 | |
| 2200:2C8F | ecl_op31_SpriteOff (H) | — | §4.4 | |
| 2200:2847 | ecl_op32_FindItem (H) | 1 { 2200:284d } | §4.3 | |
| 2200:2CEA | ecl_op33_PrintReturn (H) | — | §4.2 | |
| 2200:2CB5 | ecl_op34_EclClock (H) | 2 { 2200:2cbb }; `AdvanceClock(v(1), v(2))` { 2200:2ce1 } | §4.3 (skip table says 1) | |
| 2200:0E71 | ecl_op35_SaveTable (H) | 3 { 2200:0e77 } | §4.1 | |
| 2200:2DA9 | ecl_op36_AddNpc (H) | 2 { 2200:2daf } | §4.3 | |
| 2200:30DD | ecl_op38_Program (H) | 1 { 2200:30f7 }; ids 0 / 3 / 8 / 9 | §4.5 | |
| 2200:2D5E | ecl_op39_Who (H) | 1 { 2200:2d65 } | §4.2 | |
| 2200:28F3 | ecl_op3A_Delay (H) | — | §4.2 | |
| 2200:2E16 | ecl_op3B_Spell (H) | 3 { 2200:2e1c } | §4.3 | |
| 2200:321F | ecl_op3C_Protection (H) | 1 { 2200:323e } (unused); RuneWheelCheck { 2200:3243 }; RedrawCurrentMode { 2200:3248 } | §4.6, §8 | |
| 2200:2D15 | ecl_op3D_ClearBox (H) | — | §4.2 | |
| 2200:3251 | ecl_op3E_Dump (H) | — (`INC ecl_PC` 2200:3254); RemovePartyMember(1, 0) { 2200:3261 } | §4.6 | |
| 2200:3284 | ecl_op3F_FindSpecial (H) | 1 { 2200:329b } | §4.6 | |
| 2200:32D8 | ecl_op40_DestroyItems (H) | 1 { 2200:32de } | §4.6 | |

Handlers with the Pool code modulo addresses (ECL_VM.md "= Pool"): 01, 02, 03, 08, 09, 0C, 0D, 0F, 10, 11/12, 14, 15, 23, 25/26, 2A, 2B, 2C, 2F/30, 33, 35, 39 — Pool's ECL.pas.md part A-C text applies with the Curse addresses of the table above; the changed ones are written in ECL_VM.md §4 from the Curse bodies.

---

## 2. ov02 (2200) — the loop around the VM

### 2200:3377 ecl_Dispatch (H)
`procedure ecl_Dispatch` — caller ecl_Run. A TP `case` on `ecl_CurOp` compiled as a compare chain (`CMP AX,n / JNZ / CALL / JMP 361D`), 64 cases, no `else`.
```pascal
case ecl_CurOp of                                         { 2200:337a  MOV AL,[75FF] }
  $00: ecl_op00_Exit;  $01: ecl_op01_Goto;  $02: ecl_op02_Gosub;  $03: ecl_op03_Compare;   { 2200:3384 / 3390 / 339c / 33a8 }
  $04..$07: ecl_op04_AddSubDivMul;  $08: ecl_op08_Random;  $09: ecl_op09_Save;             { 2200:33c3 / 33cf / 33db }
  $0A: ecl_op0A_LoadCharacter;  $0B: ecl_op0B_LoadMonster;  $0C: ecl_op0C_SetupMonster;     { 2200:33e7 / 33f3 / 33ff }
  $0D: ecl_op0D_Approach;  $0E: ecl_op0E_Picture;  $0F: ecl_op0F_InputNumber;  $10: ecl_op10_InputString;   { 2200:340b / 3417 / 3423 / 342f }
  $11, $12: ecl_op11_Print;  $13: ecl_op13_Return;  $14: ecl_op14_CompareAnd;  $15: ecl_op15_VerticalMenu;   { 2200:3440 / 344c / 3458 / 3464 }
  $16..$1B: ecl_op16_If;  $1C: ecl_op1C_ClearMonsters;  $1D: ecl_op1D_PartyStrength;  $1E: ecl_op1E_CheckParty;   { 2200:3489 / 3495 / 34a1 / 34ad }
  { $1F: no entry }
  $20: ecl_op20_NewEcl;  $21, $37: ecl_op21_LoadFilesPieces;  $22: ecl_op22_PartySurprise;  $23: ecl_op23_Surprise;   { 2200:34b9 / 34ca / 34d6 / 34e2 }
  $24: ecl_op24_Combat;  $25, $26: ecl_op25_OnGotoGosub;  $27: ecl_op27_Treasure;  $28: ecl_op28_Rob;   { 2200:34ee / 34ff / 350b / 3517 }
  $29: ecl_op29_EncounterMenu;  $2A: ecl_op2A_GetTable;  $2B: ecl_op2B_HorizontalMenu;  $2C: ecl_op2C_Parlay;   { 2200:3523 / 352f / 353b / 3547 }
  $2D: ecl_op2D_Call;  $2E: ecl_op2E_Damage;  $2F, $30: ecl_op2F_AndOr;  $31: ecl_op31_SpriteOff;   { 2200:3553 / 355f / 3570 / 357c }
  $32: ecl_op32_FindItem;  $33: ecl_op33_PrintReturn;  $34: ecl_op34_EclClock;  $35: ecl_op35_SaveTable;   { 2200:3588 / 3594 / 35a0 / 35ab }
  $36: ecl_op36_AddNpc;  $38: ecl_op38_Program;  $39: ecl_op39_Who;  $3A: ecl_op3A_Delay;   { 2200:35b6 / 35c1 / 35cc / 35d7 }
  $3B: ecl_op3B_Spell;  $3C: ecl_op3C_Protection;  $3D: ecl_op3D_ClearBox;                  { 2200:35e2 / 35ed / 35f8 }
  $3E: ecl_op3E_Dump;  $3F: ecl_op3F_FindSpecial;  $40: ecl_op40_DestroyItems;              { 2200:3603 / 360e / 3619 }
end;                                                      { 2200:361d  no else: 1Fh / > 40h leave ecl_PC unchanged -> endless loop }
```
Pool: 2F00:2F2D (0.75: three more cases, 3C's target changed).

### 2200:3621 ecl_Run (H)
`procedure ecl_Run(addr [BP+6]: Word)` — callers: ecl_CampCheck, ecl_RunAfterNewBlock, ecl_GameLoop. `RETF 2`.
```pascal
ecl_PC := addr;                                           { 2200:3628 }
ecl_Stop := false;                                        { 2200:362e }
while not ecl_Stop and not PartyDead do begin             { 2200:3633 / 363a }
  ecl_LastOp := ecl_CurOp;                                { 2200:3641 }
  ecl_CurOp := ecl_CodeBuf^[ecl_PC - $8000];              { 2200:3647 .. 3655  ES:[DI+8000h] }
  if DebugFlag <> 0 then begin                            { 2200:3658  NEW: built-in tracer }
    ecl_OpcodeName(@DebugLog, name, ecl_CurOp);             { 2200:365f  (ov34 e3; only the var string is used) }
    Write(Output, name); WriteLn(Output);                 { 2200:3673 / 367b  (System @WriteStr(0 width) + @WriteLn) }
  end;
  ecl_Dispatch;                                           { 2200:3680 }
end;
ecl_Stop := false;                                        { 2200:3686 }
```
Pool: 2F00:3171 (0.69; the tracer block is new).

### 2200:3073 ecl_CampCheck (H)
`procedure ecl_CampCheck` — callers: ecl_GameLoop ('E'), ecl_op38_Program (9).
```pascal
ov15_LoadDeps;                                                { 2200:3079  touch the camp unit (MAGIC/PARTY; Pool had no such call) }
rested := false;                                          { 2200:307e }
ecl_Run(ecl_VecC);                                        { 2200:3082 }
Camp(var rested);                                    { 2200:308a  the camp menu (ov15 e1; "The party makes camp..." — PARTY lane) }
if rested then begin RedrawCurrentMode; ecl_Run(ecl_VecD) end;    { 2200:3094 / 309a / 309f  redraw by view mode, then the after-rest vector }
view_Redraw := 1;  RefreshView;                           { 2200:30a7 / 30ac }
GameSaved := 0;                                              { 2200:30b1  (Pool g_557D; role L) }
```
Pool: 2F00:2DD3 (0.96).

### 2200:3691 ecl_RunAfterNewBlock (H)
`procedure ecl_RunAfterNewBlock` — caller ecl_GameLoop after any vector that executed NEW ECL. Pool: 2F00:31B4 (0.52) — **the travel-mode / block 19h..1Bh overland logic is gone; what remains is the picture release, the cell attribute and the three vectors.**
```pascal
repeat
  FreeAnimation(enc_Anim);                                { 2200:3694  (ov29 e5 on g_722C) }
  camp_AnimName := 0;  camp_AnimId := $FF;                            { 2200:369e / 36a3  (animation state bytes next to anim_Name/anim_Id, M) }
  ecl_Restart := false;                                   { 2200:36a8 }
  party_CellAttr := GetCellAttr(party_MapX, party_MapY);  { 2200:36ad }
  Mem[7ED5] := 0;                                         { 2200:36bd  region 1 +5AAh }
  ecl_SavedSelectedChar := SelectedChar;                  { 2200:36c8 }
  ecl_Run(ecl_VecE);                                      { 2200:36d5 }
  if not ecl_Restart then Mem[4BF2] := ecl_Block;         { 2200:36dd / 36e4  previous-block cell }
  if not ecl_Restart then begin                           { 2200:36f2 }
    if (((view_PrevMode <> 4) or (view_Mode = 4)) and (g_47E3 <> 0)) or ((view_PrevMode = 4) and (view_Mode = 4)) then   { 2200:36f9 .. 3715 }
      RefreshView;                                        { 2200:371c }
    ecl_Restart := false;                                 { 2200:3721 }
    ecl_Run(ecl_VecA);                                    { 2200:3726 }
    if not ecl_Restart then begin                         { 2200:372e }
      ecl_Run(ecl_VecB);                                  { 2200:3735 }
      if not ecl_Restart then begin                       { 2200:373d }
        SelectedChar := ecl_SavedSelectedChar;            { 2200:3744 }
        PartySummary(SelectedChar);                       { 2200:3751 }
      end
    end
  end
until not ecl_Restart;                                    { 2200:375e }
view_PrevMode := view_Mode;                               { 2200:3768 }
```

### 2200:3772 ecl_GameLoop (H) — stub ov02 e1
`procedure ecl_GameLoop` — called from the main program body (0000:011F, through stub ov02 e1) once per game session. Callees: LoadEclBlock, ecl_InitVM, ecl_Run, RemovePartyMember, RedrawCurrentMode, RefreshView, ExploreCommand, ecl_CampCheck, ov15_LoadDeps, ecl_RunAfterNewBlock, MoveParty, PlayOrStopSound. Pool: 2F00:32F8 (0.80) — **changed: the demo branch (block 52h = ECL1/82, the attract demo; afterwards every member is dropped), the `Resuming` handling, the view-mode bookkeeping; the Look/Encamp inner loop and the move step are Pool's.**
```pascal
ecl_SavedSelectedChar := SelectedChar;                    { 2200:3778 }
view_Redraw := 1;  g_8B64 := 0;  g_47E4 := 0;  g_47E5 := 0;   { 2200:3785 .. 3794 }
ecl_RestoreSelPending := 0;  g_47E3 := 0;  g_8B6E := 1;   { 2200:3799 .. 37a3 }
view_Mode := 4;  ecl_Restart := false;                    { 2200:37a8 / 37ad }
if Mem[4BF2] = 0 then begin                               { 2200:37b2  no block to resume: a new game }
  g_8B6E := 0;                                            { 2200:37be }
  if Demo = 0 then begin ecl_Block := 1; PartySummary(SelectedChar) end   { 2200:37c3 / 37d1 / 37d6 }
  else ecl_Block := $52;                                  { 2200:37ca  the attract demo = ECL1 record 82 }
end else ecl_Block := Lo(Mem[4BF2]);                      { 2200:37e5 / 37ee }
if Mem[4BE6] = 0 then view_Mode := 3;                     { 2200:37f1 / 37fd  not a 3D area }
if (Resuming = 0) or (Mem[4BF2] = 0) then LoadEclBlock(ecl_Block)   { 2200:3802 / 3809 / 3815 }
else g_47E3 := 1;                                         { 2200:3820  a loaded save already holds the script }
ecl_InitVM;                                               { 2200:3825 }
ecl_Run(ecl_VecE);                                        { 2200:382a }
if Demo <> 0 then begin                                   { 2200:3832 }
  repeat RemovePartyMember(1, 1) until PartyHead = nil;   { 2200:3839 / 3844  demo over: drop everyone, back to the title }
  exit;
end;
if not ecl_Restart then Mem[4BF2] := ecl_Block            { 2200:3850 / 3857 }
else ecl_RunAfterNewBlock;                                { 2200:3867 }
if (view_Mode <> 3) and (Resuming <> 0) then begin        { 2200:386b / 3872 }
  if g_8B6E = 1 then RedrawCurrentMode;                           { 2200:3879 / 3880 }
  view_Redraw := 1;  RefreshView;                         { 2200:3885 / 388a }
end;
Resuming := 0;                                            { 2200:388f }
repeat
  key := ExploreCommand;                                  { 2200:3894 }
  ecl_SavedSelectedChar := SelectedChar;                  { 2200:389c }
  if not ecl_Restart then Mem[4BF2] := ecl_Block;         { 2200:38a9 / 38b0 }
  while ((Mem[7ECA] > 1) or (UpCase(key) = 'E')) and not PartyDead do begin   { 2200:38be / 38ca / 38da  Look (bit 1) or Encamp }
    if UpCase(key) = 'E' then begin ov15_LoadDeps; ecl_CampCheck end   { 2200:38e1 / 38ee / 38f3 }
    else begin                                            { Look: run vecB as if searching this square }
      g_8B5F := Mem[7ECA] and 1;                          { 2200:38f9 / 3905  keep the Search bit }
      Mem[7ECA] := 1;                                     { 2200:3908 }
      view_Redraw := 1;  RefreshView;                     { 2200:3913 / 3918 }
      ecl_Run(ecl_VecB);                                  { 2200:391d }
      if ecl_Restart then ecl_RunAfterNewBlock;           { 2200:3925 / 392c }
      Mem[7ECA] := g_8B5F;                                { 2200:3930 / 3935 }
    end;
    if not PartyDead then begin key := ExploreCommand; ecl_SavedSelectedChar := SelectedChar end;   { 2200:393e / 3945 / 394d }
  end;
  if not PartyDead then ecl_Run(ecl_VecA);                { 2200:395d / 3964 }
  if ecl_Restart then ecl_RunAfterNewBlock                { 2200:396c / 3973 }
  else if not PartyDead then begin                        { 2200:397a }
    Mem[4BF0] := ShortInt(party_MapX);  Mem[4BF1] := ShortInt(party_MapY);   { 2200:3984 / 3991 }
    MoveParty;                                            { 2200:399e }
    RefreshView;                                          { 2200:39a3 }
    if (party_MapX < 0) or (party_MapX <> Mem[4BF0]) or (party_MapY < 0) or (party_MapY <> Mem[4BF1]) then   { 2200:39a8 .. 39d3 }
      PlayOrStopSound(snd_Step);                            { 2200:39e0  step sound (a different sound word than StepForward3D's? no: the same g_25C0) }
    view_RedrawPicture := 0;  g_8B63 := 1;                { 2200:39e9 / 39ee }
    ecl_Run(ecl_VecB);                                    { 2200:39f3 }
    if ecl_Restart then ecl_RunAfterNewBlock;             { 2200:39fb / 3a02 }
  end
until PartyDead;                                          { 2200:3a06 }
PartyDead := false;                                       { 2200:3a10 }
```
Note (as Pool): `Mem[7ECA]` bit 0 = Search toggled by 'S', bit 1 = Look set by 'L' (ExploreCommand, VIEW.pas.md 3F00:0A26/0A3A), so Look runs vecB with only bit 0 = 1, then restores the Search bit.

### 2200:0000 ov02_LoadDeps (M)
Calls the entry-0 routine of ov19, ov29, ov33, ov20, ov26, ov16, ov23, ov14, ov24, ov28, ov07, ov21, ov34, ov25, ov03 { 2200:0003 .. 0049 } — a dependency touch that makes the overlay manager load every unit the VM can reach (M). Pool's ov03 had no equivalent (0.42 against an unrelated routine).
### 2200:3A19 ov02_init (H) — empty (`RETF` at 2200:3a1f).

---

## 3. ov34 (7300) — opcode-name table (the script tracer)

### 7300:0240 ecl_OpcodeName (H) — stub ov34 e3
`procedure ecl_OpcodeName(p: Pointer [BP+0Ch]; var s: string [BP+8]; op: Byte [BP+6])` — caller ecl_Run (2200:366e, pushes `@g_8B76, @name, ecl_CurOp`). **Only `s` is used: the routine reads the opcode from `ecl_CurOp` (g_75FF) itself (7300:0243 `MOV AL,[75FF]`) and ignores `p` and `op`** (H, the body never reads `[BP+6]` or `[BP+0Ch]`). A 64-case compare chain, each `StrAssign(s, 255, literal)` (System @StrAssign, 7300:025b first case):
```pascal
case ecl_CurOp of                                   { 7300:0243 }
  $00: s := 'EXIT';  $01: s := 'GOTO';  $02: s := 'GOSUB';  $03: s := 'COMPARE';  $04: s := 'ADD';  $05: s := 'SUBTRAT';   { sic }
  $06: s := 'DIVIDE';  $07: s := 'MULTIPLY';  $08: s := 'RANDOM';  $09: s := 'SAVE';  $0A: s := 'LOAD CHARACTER';
  $0B: s := 'LOAD MONSTER';  $0C: s := 'SETUP MONSTER';  $0D: s := 'APPROACH';  $0E: s := 'PICTURE';  $0F: s := 'INPUT NUMBER';
  $10: s := 'INPUT STRING';  $11: s := 'PRINT';  $12: s := 'PRINTCLEAR';  $13: s := 'RETURN';  $14: s := 'COMPARE AND';
  $15: s := 'VERTICAL MENU';  $16: s := 'IF = ';  $17: s := 'IF <>';  $18: s := 'IF <';  $19: s := 'IF >';  $1A: s := 'IF <=';  $1B: s := 'IF >=';
  $1C: s := 'CLEARMONSTERS';  $1D: s := 'PARTYSTRENGTH';  $1E: s := 'CHECKPARTY';  $20: s := 'NEWECL';  $21: s := 'LOAD FILES';
  $37: s := 'LOAD PIECES';  $22: s := 'PARTY SURPRISE';  $23: s := 'SURPRISE';  $24: s := 'COMBAT';  $25: s := 'ON GOTO';
  $26: s := 'ON GOSUB';  $27: s := 'TREASURE';  $28: s := 'ROB';  $29: s := 'ENCOUNTER MENU';  $2A: s := 'GETTABLE';
  $2B: s := 'HORIZONTAL MENU';  $2C: s := 'PARLAY';  $2D: s := 'CALL';  $2E: s := 'DAMAGE';  $2F, $30: s := 'AND';
  $31: s := 'SPRITE OFF';  $32: s := 'FIND ITEM';  $33: s := 'PRINT RETURN';  $34: s := 'ECL CLOCK';  $35: s := 'SAVE TABLE';
  $36: s := 'ADD NPC';  $38: s := 'PROGRAM';  $39: s := 'WHO';  $3A: s := 'DELAY';  $3B: s := 'SPELL';  $3C: s := 'PROTECTION';
  $3D: s := 'CLEAR BOX';  $3E: s := 'DUMP';  $3F: s := 'FIND SPECIAL';  $40: s := 'DESTROY ITEMS';   { 7300:08ee last case }
end;                                                { no else: 1Fh leaves s unchanged }
```
Chain order in the bytes: 00..21, 37, 22..2F, then 30 shares the AND literal (the `CMP AX,30h` test jumps to the same StrAssign: 7300:06c9..), 31..36, 38..40. Literal offsets in the unit: cs:0007 "EXIT" .. cs:0232 "DESTROY ITEMS" (ov34.c header). `RETF 8`. No Pool twin (Pool's ov34 was the 8x8 symbol unit; Pool had no tracer).
### 7300:0000 ov34_0000 (H) — empty (`RETF`), the entry-0 touch target of every VM-related unit. 7300:0907 ov34_init — empty.

---

## Unknowns (explicit)
- `g_8B64`, `g_8B6E`, `g_47E3`, `g_47E4/47E5` (set by the loop, read by RefreshView / LOAD FILES: redraw bookkeeping, M), `g_7281`/`g_728B`, `g_5CF1`, `g_8B5F` (temporary for the Search bit), the trace string buffer `g_8B76` passed unused to ecl_OpcodeName.
- `ov15_LoadDeps` (touch), `Camp` (camp menu), `RedrawCurrentMode` (redraw by view mode), `RemovePartyMember(1, 1)` in the demo tail: other lanes.
- Handler-level unknowns: ECL_VM.md §10.

## Self-check
Every `{ seg:off }` in §2 and §3 comes from `decode/listings/ov02.lst` / `ov34.lst` (scratch `cites.py`: addresses of the CALLs, DS stores and compares of each routine). 10 % sample (seed 5, 14 of 138 citations) re-read against the five instructions at the address: 2200:362b ok · 2200:3658 ok (CMP [4FC1],0) · 2200:366e ok (CALLF stub ov34 e3 after three pushes) · 2200:3087 ok · 2200:308f ok (LEA [bp-1] pushed = var rested) · 2200:36b5 ok (pushes [720F],[7210] = x, y) · 2200:36dd ok · 2200:3744 ok · 2200:37ca ok (MOV [8B5E],52h) · 2200:383f ok (pushes 1, 1) · 2200:38ce ok · 2200:3984 ok · 2200:39e4 ok · 7300:0243 ok. Result: 14/14 consistent. argcheck: ECL_ARGCHECK.md (run after writing; mismatches fixed in place).
Fixes (lane cab-fixes-fable, 2026-10-20): STATUS `ECL fix request #verify-45/46` applied — the 18 anchors of the §1 handler index and L120 that lay inside an instruction moved to the instruction starts the verifier listed (`scratchpad/verify/snapgen.py --map`: 0116→0115, 0124→0125, 0211→0210, 0472→0473, 0978→0979, 09f0→09f1, 0ec3→0ec4, 0f1b→0f17, 1b59→1b5a, 208c→208d, 1088→1089, 10be→10bc, 27ae→27af, 30f9→30f7, 2d64→2d65, 2e1e→2e1c, 329c→329b, 3097→3094); ECL_SCREENS ECL-09 cites the `Mem[4CFF]` test at 6800:0507 / 050b instead of 6800:04fd. Cite pass with `scratchpad/verify/citepass4.py` (as for COMBAT): 82 anchors on 43 lines moved from the CALL to the statement's first push / load. Checks after the pass: anchorcheck 229 anchors, **0 bad**; argcheck 93 calls, **0 MISMATCH** (ECL_ARGCHECK.md regenerated).
