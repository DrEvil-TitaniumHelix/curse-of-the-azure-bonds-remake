# ECL_DIFF — Curse of the Azure Bonds ECL interpreter vs Pool of Radiance (cab-tooling, gate test, 2026-10-20)

Scope: locate the interpreter in this binary and diff it opcode-by-opcode against Pool's `decode/ecl/ECL_VM.md`
(61 opcodes). Semantics beyond what is cited here are the cab-ecl lane's job (`decode/ecl/ECL_VM.md` for Curse).
Addresses: Curse overlay unit N at the analysis segment of `decode/LAYOUT.md` (ov02 = `2200`, ov07 = `2C00`,
ov34 = `7300`), DS = 0C1C. Pool: ov03 = `2F00`, ov07 = `4300`, DS = 0C7C. "asm" = read on the instruction bytes in
`decode/listings/*.lst`; "dec" = Ghidra decompile (`*.c`); "shape" = instruction-shape similarity (capstone mnemonic +
operand shape with immediates/displacements masked, difflib ratio Pool handler vs Curse handler; 1.00 = identical
code modulo addresses). Confidence H/M/L.

## 1. Where the interpreter lives — H

Same architecture as Pool: a fetch loop + a `case` compare chain in the big script unit, operand decoding and VM memory
in a helper unit. Curse's script unit is **ov02** (0x3A20 B, 60 entries; strings "PRESS BUTTON OR RETURN TO CONTINUE",
"Unable to find item file" = the same literals as Pool's ov03), the helper unit is **ov07** (same unit number as Pool).

| routine | Curse | Pool | shape | evidence |
|---|---|---|---|---|
| `ecl_Run(addr)` fetch loop | ov02_3621 **2200:3621** | 2F00:3171 | - | asm 2200:3621..368E (below) |
| `ecl_Dispatch` case chain | ov02_3377 **2200:3377** | 2F00:2F2D | - | asm 2200:337A `MOV AL,[75FF]` then 64 `CMP AX,n / JNZ / CALL handler / JMP 361D` (2200:337F..361A); **00..40h, 1Fh absent** |
| `ecl_ReadOperands(n)` | ov07_0034 **2C00:0034** | 4300:0000 | 0.89 | asm (section 2) |
| `ecl_OperandValue(i)` | ov07_0173 2C00:0173 | 4300:0136 | 0.87 | asm |
| `MakeWord(hi,lo)` | ov07_06E8 | 4300:06AF | 0.94 | |
| `ecl_SixBitChar` | ov07_070D | 4300:06D3 | 1.00 | shape search over ov07 |
| `ecl_UnpackString` | ov07_12AE | 4300:1153 | 0.97 | |
| `ecl_MemRegion(a)` | ov07_0735 | ov07_06FB | - | dec (section 4) |
| `ecl_GetMem` / `ecl_SetMem` | ov07_0F3A / ov07_0D70 | 4300:0E0C / 4300:0C77 | 0.92 / 0.86 | dec |
| `ecl_GetMemString` / `ecl_SetMemString` | ov07_145C / ov07_108D | 4300:12FB / 4300:0F53 | 0.96 / 0.93 | |
| `ecl_SkipInstruction` | ov07_1FF5 **2C00:1FF5** | 4300:1EA6 | 0.65 | asm (section 3; the table changed) |
| `ecl_CompareWords` / `ecl_CompareStrings` | ov07_1A51 / ov07_197B | 4300:18EB / 4300:1815 | 0.99 / 1.00 | |
| `ecl_Gosub` | ov07_1AB9 | 4300:1951 | 0.80 | |
| `LoadEclBlock(n)` | ov07_0380 **2C00:0380** | 4300:0341 | 0.93 | dec: `FillChar(CodeBuf^ (DS:4FA5), 1E00h, 0)`; repeat `LoadDaxRecord('ECL'+Str(DS:5BEE)+'.dax', n)` (FUN_0636_08DE) until size >= 2; `Move(rec+2, CodeBuf^, size-2)`; FreeMem. Strings `[ps] "ECL"` 2C00:0377, `".dax"` 037B |
| `ecl_InitVM` | ov07_01FC 2C00:01FC | 4300:01B6 | 0.99 | dec: `PC := 8000h` (asm 2C00:023B `C7 06 B4 4F 00 80`), 5 x `ReadOperands(1)` + MakeWord into DS:4FAA/4FAC/4FAE/4FB0/4FB2 (vecA..E), block-local zeroing of region-0 cells +100h..+11Fh and region-1 cells +379h..+382h unless DS:4FC2 (resume) |
| `ecl_GameLoop` | ov02_3772 (679 B) | ov03_32F8 | - | callers of ecl_Run: ov02_3772, ov02_3691 (= RunAfterNewBlock, Pool 2F00:31B4), ov02_3073 (= CampCheck, Pool 2F00:2DD3, called from PROGRAM 9 and the loop) |
| opcode-name table (**new**) | ov34_0240 **7300:0240** | none | - | `case CurOp of 0: 'EXIT' ... 40h: 'DESTROY ITEMS'` (64 names, SSI's own, asm 7300:0248..); called from the fetch loop when the trace flag DS:4FC1 is set, printed with WriteLn (2200:365F..367B) = a built-in script tracer |

Fetch loop (asm 2200:3621):
```pascal
procedure ecl_Run(addr: word);                 { 2200:3621 }
begin
  ecl_PC := addr;                              { DS:4FB4  (Pool 49ED) }
  ecl_Stop := false;                           { DS:47E0  (Pool 442E) }
  while not ecl_Stop and not PartyDead do      { DS:4FC7  (Pool 49FF) }
  begin
    ecl_LastOp := ecl_CurOp;                   { DS:75FE := DS:75FF (Pool 6F7E/6F7F) }
    ecl_CurOp  := CodeBuf^[ecl_PC - $8000];    { ES:[DI+8000h], CodeBuf = DS:4FA5 (Pool 49DE, -9900h) }
    if TraceFlag then WriteLn(OpcodeName(ecl_CurOp));   { DS:4FC1, ov34_0240 - new }
    ecl_Dispatch;                              { 2200:3377 }
  end;
  ecl_Stop := false;
end;
```
Opcode 1Fh and > 40h: no handler, PC not advanced, the loop spins (same hazard as Pool; not in data, section 6).

## 2. Operand encoding — H, **unchanged**

`ecl_ReadOperands(n)` (asm 2C00:0034..0170) is Pool's routine with the globals moved: `OpType[i]` = DS:7685+i,
`OpHi[i]` = DS:76C5+i, `OpLo[i]` = DS:7705+i (Pool 7006/7046/7086: same 40h spacing, same order), string slots
`Str[k]` = DS:7648 + k*100h (Pool 6FC8), PC = DS:4FB4. Type bytes `00` (byte), `01`/`02`/`03` (+ hi byte, asm 00A2..00CA),
`80` (packed text, len byte, `ov07_12AE(k, len)` asm 00D1..0108; len 0 -> empty slot), `81` (string var: hi byte,
`MakeWord`, `ecl_GetMemString`, asm 010F..015B), then `INC PC` (0169). `ecl_OperandValue` (asm 2C00:0173): type 0 ->
lo; 1/3/80h -> `GetMem(hi*256+lo)`; 2/81h -> `hi*256+lo`. Same as Pool section 2 including the `CBW` sign-extension of
the index (2C00:017C). Variable-length instructions 15h/25h/26h/2Bh: same `DEC PC; ReadOperands(count)` pattern
(callee lists of ov02_0EBD, ov02_1A9B, ov02_1082 contain a second ov07_0034 call; "3,?" / "2,?" in the table below).
Packed text: `ecl_UnpackString` shape 0.97 and `ecl_SixBitChar` shape 1.00 -> same 6-bit packing (H); every string in
the 25 shipped records decodes to clean upper-case text with Pool's rule (section 6).

## 3. IF-skip table (`ecl_SkipInstruction` ov07_1FF5, asm 2C00:1FF5..2136) — H

Same mechanism: `CurOp := Code[PC]` (2C00:2006 writes DS:75FF, as Pool does), then a fixed operand count by opcode
and `ReadOperands(k)`; opcodes not listed: `INC PC` only (2C00:212F).

| k | Curse opcodes | delta vs Pool |
|---|---|---|
| 1 | 01 02 0A 0E 11 12 1D 20 2D 32 34 36 38 39 3C **3F 40** | + 3F 40 (new opcodes) |
| 2 | 03 08 09 0F 10 1F 22 | **0C removed** (now 3 = its handler's count: Pool's 0C mismatch is fixed) |
| 3 | 04..07 0B **0C** 21 28 2A 2F 30 35 37 3B | + 0C |
| 4 | 14 23 | same |
| 5 | 2E | same |
| 6 | 1E 2C | same |
| 8 | 27 | same |
| 0Eh | 29 | same |
| 0 | all others incl. 15 25 26 2B **3E** | same quirk for the variable-length opcodes (only the opcode byte is skipped) |

Remaining mismatches between table and handler: **36h** (table 1, handler 2 — as in Pool) and **34h** (table 1,
handler now reads **2** operands — new in Curse, see opcode 34 below). 1Fh is still in the table (count 2) without a
handler.

## 4. VM memory map — H (dec ov07_0735, ov07_0F3A, ov07_0D70)

| region | Curse ECL addresses | Pool | storage (Curse) | notes |
|---|---|---|---|---|
| 0 | **4B00..4EFF** | 4900..4CFF | word array at far ptr DS:4F99 | +200h; same relative cells: writes to 4BFD/4BFE set the redraw flag DS:8B6A (Pool 49FD/49FE); **new:** writing 4BE6 (3D-area flag, +E6h as Pool's 49E6) switches the view mode DS:4FBA to 3 (value 0) / 4 (else) and saves the old mode in DS:4FBB |
| 1 | **7C00..7FFF** | 6B00..6EFF | word array at DS:4F9D, overlaid by selected-character fields (`ov07_07F1` get, `ov07_0B6D` set) | +1100h; the character record is larger in Curse (list links at +189h, items at +14Dh, item next at +2Ah, item type at +2Eh: from DESTROY_ITEMS), so the overlay table (Pool section 3.1) must be re-derived by cab-ecl |
| 2 | **7A00..7BFF** | 9700..98FF | word array at DS:4FA1 | -1D00h |
| 3 | **8000..9DFF** | 9900..B6FF | the loaded script (bytes), DS:4FA5, 1E00h | -1900h; record = 2-byte header + script, loaded at 8000h (vectors in the data: ECL1/80 `01 01 6A 80 ...`) |
| 4 | everything else | same | engine globals: reads 00B1, 00FB, 00FC, 033D, C04B..C04F; writes 00B8, 00B9, 03DE, C04B..C04D, C059, C05F | **identical address set to Pool** (dec ov07_0F3A/ov07_0D70); C04B/C04C = party X/Y DS:720F/7210, C04D facing DS:7211 (stored x2), C04E/C04F DS:7212/7213 |

## 5. Opcodes — every handler, Curse vs Pool

Columns: SSI name = the engine's own name table (ov34_0240); Pool mnemonic = Pool ECL_VM.md; n = fixed operand count
(`ReadOperands(n)` at the start of the handler, asm ov02.lst; "+" = variable part); skip = Curse table count (section
3); shape = instruction-shape similarity; verdict: **same** >= 0.95 (same code modulo addresses, H), **minor** 0.85..0.95
(same structure, a few inserted/changed instructions: cab-ecl verifies), **changed** < 0.85 (read it), **new**.

| op | SSI name | Pool mnemonic | Curse handler | bytes | Pool handler | bytes | n (Curse/Pool) | skip | shape | verdict / note |
|---|---|---|---|---|---|---|---|---|---|---|
| 00 | EXIT | EXIT | ov02_0052 | 150 | 2F00:0001 | 243 | 0/0 | 0 | 0.57 | **changed**: no frame drawing (Pool drew the picture-box frames); keeps: restore SelectedChar (DS:47E2/47E7 -> DS:6506), clear DS:8B48 (2 B), 8B62, 8B64; Stop := 1 (47E0); PC+1; free the whole gosub list (DS:75F0, 6-byte nodes); cursor DS:65A1 := 11h, 65A0 := 1; 8B60 := 0 (dec) |
| 01 | GOTO | GOTO | ov02_00E8 | 31 | 00F4 | 29 | 1/1 | 1 | 0.96 | same |
| 02 | GOSUB | GOSUB | ov02_0107 | 23 | 0111 | 21 | 1/1 | 1 | 0.95 | same (ecl_Gosub ov07_1AB9 shape 0.80: verify the node layout) |
| 03 | COMPARE | COMPARE | ov02_011E | 125 | 0126 | 125 | 2/2 | 2 | 1.00 | same |
| 04 | ADD | ADD | ov02_019B | 169 | 01A3 | 145 | 3/3 | 3 | 0.88 | minor (shared 04..07 handler, 24 B longer: verify operand order of SUBTRACT/DIVIDE) |
| 05 | SUBTRAT [sic] | SUBTRACT | ov02_019B | | | | 3/3 | 3 | | minor (as 04) |
| 06 | DIVIDE | DIVIDE | ov02_019B | | | | 3/3 | 3 | | minor (as 04) |
| 07 | MULTIPLY | MULTIPLY | ov02_019B | | | | 3/3 | 3 | | minor (as 04) |
| 08 | RANDOM | RANDOM | ov02_0244 | 94 | 0234 | 94 | 2/2 | 2 | 1.00 | same |
| 09 | SAVE | SAVE | ov02_02A2 | 78 | 0292 | 78 | 2/2 | 2 | 1.00 | same |
| 0A | LOAD CHARACTER | LOAD_CHARACTER | ov02_02F0 | 218 | 02E0 | 212 | 1/1 | 1 | 0.87 | minor (redraw callees ov17_3A56, ov24_0795 instead of ov16_3291/FUN_00BA_0767) |
| 0B | LOAD MONSTER | LOAD_MONSTER | ov02_0466 | 923 | 0450 | 967 | 3/3 | 3 | 0.83 | **changed** (−44 B; monster record/icon loading via ov07_0456, ov33_01D4 (CHEAD/CBODY unit) instead of CPIC) |
| 0C | SETUP MONSTER | SETUP_MONSTER | ov02_03CA | 151 | 03B4 | 151 | 3/3 | 3 | 1.00 | same (skip table fixed to 3) |
| 0D | APPROACH | APPROACH | ov02_0801 | 60 | 0817 | 58 | 0/0 | 0 | 0.98 | same |
| 0E | PICTURE | PICTURE | ov02_0841 | 235 | 0856 | 251 | 1/1 | 1 | 0.76 | **changed** (callees ov29_0813/0881/010B/000C, ov07_0552, ov28_00CC: picture pipeline differs — BIGPIC/HEAD/BODY, cab-data) |
| 0F | INPUT NUMBER | INPUT_NUMBER | ov02_092C | 68 | 0951 | 65 | 2/2 | 2 | 0.96 | same (unused in the shipped scripts) |
| 10 | INPUT STRING | INPUT_STRING | ov02_0972 | 120 | 0994 | 117 | 2/2 | 2 | 0.98 | same |
| 11 | PRINT | PRINT | ov02_09EA | 156 | 0A09 | 150 | 1/1 | 1 | 0.97 | same |
| 12 | PRINTCLEAR | PRINTCLEAR | ov02_09EA | | | | 1/1 | 1 | | same |
| 13 | RETURN | RETURN | ov02_0A86 | 80 | 0A9F | 78 | 0/0 | 0 | 0.69 | **changed**: Curse's RETURN calls the EXIT handler ov02_0052 (callee list) — on an empty gosub stack Pool fell through, Curse apparently exits (M: read the branch) |
| 14 | COMPARE AND | COMPARE_AND | ov02_0AD6 | 101 | 0AED | 101 | 4/4 | 4 | 1.00 | same |
| 15 | VERTICAL MENU | VERTICAL_MENU | ov02_0EBD | 378 | 0F08 | 381 | 3+/3+ | 0 | 0.95 | same |
| 16..1B | IF = <> < > <= >= | IF_EQ..IF_GE | ov02_0B3B | 128 | 0B52 | 118 | 0/0 | 0 | 0.83 | **changed** (+10 B; flags at DS:75F8..75FD; verify the flag->opcode mapping) |
| 1C | CLEARMONSTERS | CLEAR_MONSTERS | ov02_120E | 99 | 125D | 105 | 0/0 | 0 | 0.82 | **changed** (no callees; treasure/monster globals moved) |
| 1D | PARTYSTRENGTH | PARTY_STRENGTH | ov02_1271 | 325 | 12C6 | 273 | 1/1 | 1 | 0.71 | **changed** (+52 B, calls ov25_13BC: formula differs) |
| 1E | CHECKPARTY | CHECK_PARTY | ov02_1416 | 544 | 1435 | 500 | 6/6 | 6 | 0.82 | **changed** (calls ov24_2396 = effect/special test shared with FIND_SPECIAL, helper ov02_13B6) |
| 1F | — | — | none | | none | | | 2 | | no handler in either engine |
| 20 | NEWECL | NEW_ECL | ov02_0BBB | 90 | 0BD1 | 156 | 1/1 | 1 | 0.54 | **changed**: `Mem[region0 +1E4h] := block (DS:8B5E)`; `8B5E := v(1)`; `LoadEclBlock`; `ecl_InitVM`; Stop := 1 (47E0), Restart := 1 (47E1); clear DS:8B48 — **no disk-check call** (Pool's ov17_22D5 "Insert disk" step is gone; the whole game ships on one install) (dec) |
| 21 | LOAD FILES | LOAD_FILES | ov02_0C15 | 399 | 0C74 | 379 | 3/3 | 3 | 0.92 | minor (Load3DMap = ov30_133A "Unable to load geo in Load3DMap.", LoadWallSet = ov30_104C) |
| 22 | PARTY SURPRISE | PARTY_SURPRISE | ov02_1636 | 156 | 1629 | 160 | 2/2 | 2 | 0.93 | minor (unused in data) |
| 23 | SURPRISE | SURPRISE | ov02_16D2 | 200 | 16C9 | 198 | 4/4 | 4 | 0.96 | same (unused in data) |
| 24 | COMBAT | COMBAT | ov02_179A | 769 | 179B | 349 | 0/0 | 0 | 0.45 | **changed** (2.2x: video-mode switches FUN_0713_0020/00D6 around combat, ov06 shop, ov04 temple, ov27/ov30 calls) |
| 25 | ON GOTO | ON_GOTO | ov02_1A9B | 149 | 18F8 | 149 | 2+/2+ | 0 | 1.00 | same |
| 26 | ON GOSUB | ON_GOSUB | ov02_1A9B | | | | 2+/2+ | 0 | | same |
| 27 | TREASURE | TREASURE | ov02_1B53 | 1011 | 19B0 | 1025 | 8/8 | 8 | 0.75 | **changed** (random-item generation ov21_0FED (109 compares), item naming ov24_0467) |
| 28 | ROB | ROB | ov02_1F46 | 227 | 1DB1 | 234 | 3/3 | 3 | 0.92 | minor |
| 29 | ENCOUNTER MENU | ENCOUNTER_MENU | ov02_2086 | 1791 | 1EF8 | 1712 | 14/14 | 0Eh | 0.93 | minor (+79 B) |
| 2A | GETTABLE | GET_TABLE | ov02_0E13 | 94 | 0E5E | 94 | 3/3 | 3 | 1.00 | same |
| 2B | HORIZONTAL MENU | HORIZONTAL_MENU | ov02_1082 | 396 | 10D1 | 396 | 2+/2+ | 0 | 1.00 | same |
| 2C | PARLAY | PARLAY | ov02_27A8 | 159 | 25CB | 159 | 6/6 | 6 | 1.00 | same |
| 2D | CALL | CALL | ov02_2F02 | 369 | 2CCF | 260 | 1/1 | 1 | 0.82 | **changed** (+109 B: more engine entry points implemented — callees ov30_07C6, ov28_00CC, ov24_2BAA, ov30_06BD, ov07_1BE0, FUN_0713_0020; cab-ecl lists the CALL ids used by the scripts) |
| 2E | DAMAGE | DAMAGE | ov02_2942 | 845 | 2775 | 813 | 5/5 | 5 | 0.86 | minor |
| 2F | AND | AND | ov02_0DA4 | 111 | 0DEF | 111 | 3/3 | 3 | 1.00 | same |
| 30 | (name table: shares the AND entry, no separate string) | OR | ov02_0DA4 | | | | 3/3 | 3 | | same |
| 31 | SPRITE OFF | SPRITE_OFF | ov02_2C8F | 38 | 2AA2 | 31 | 0/0 | 0 | 0.91 | minor |
| 32 | FIND ITEM | FIND_ITEM | ov02_2847 | 172 | 266A | 181 | 1/1 | 1 | 0.87 | minor |
| 33 | PRINT RETURN | PRINT_RETURN | ov02_2CEA | 43 | 2AEB | 41 | 0/0 | 0 | 0.96 | same |
| 34 | ECL CLOCK | ECL_CLOCK | ov02_2CB5 | 53 | 2AC1 | 42 | **2**/1 | 1 | 0.80 | **changed**: `ReadOperands(2); AdvanceClock(v(2), v(1))` (ov20_03B9; Pool had 1 operand and an uninitialised index) — the skip table still says 1: an IF-skipped ECL_CLOCK lands one operand short (new quirk, H asm 2C00:2040 vs ov02_2CB5) |
| 35 | SAVE TABLE | SAVE_TABLE | ov02_0E71 | 76 | 0EBC | 76 | 3/3 | 3 | 1.00 | same |
| 36 | ADD NPC | ADD_NPC | ov02_2DA9 | 109 | 2B7E | 133 | 2/2 | 1 | 0.86 | minor (callees ov16_351C, ov24_0C28, ov24_0795) |
| 37 | LOAD PIECES | LOAD_PIECES | ov02_0C15 | | | | 3/3 | 3 | | minor (as 21) |
| 38 | PROGRAM | PROGRAM | ov02_30DD | 322 | 2E10 | 109 | 1/1 | 1 | 0.44 | **changed** (3x: program ids dispatch to ov17_0000, ov17_01DD (main menu), ov24_2A6D, ov18_10FF, ov26_112A, ov16_3EDD, plus CampCheck ov02_3073) |
| 39 | WHO | WHO | ov02_2D5E | 75 | 2B33 | 75 | 1/1 | 1 | 1.00 | same |
| 3A | DELAY | DELAY | ov02_28F3 | 16 | 271F | 14 | 0/0 | 0 | 0.92 | minor |
| 3B | SPELL | SPELL | ov02_2E16 | 236 | 2C03 | 204 | 3/3 | 3 | 0.78 | **changed** (+32 B; check whether Pool's address-truncation bug persists) |
| 3C | **PROTECTION** | PRINT_MEM | ov02_321F | 50 | 2E7D | 176 | 1/1 | 1 | 0.48 | **changed, different opcode**: clear DS:8B48 (2 B), 8B62 := 0, `ReadOperands(1)`, `ov03_011A`, `ov24_2A6D` (dec) — the SSI name is PROTECTION; Pool's glyph printer is gone. 1 use in data (section 6) |
| 3D | CLEAR BOX | CLEAR_BOX | ov02_2D15 | 73 | 2B14 | 31 | 0/0 | 0 | 0.53 | **changed** (calls FUN_01A0_0136, ov24_0795, ov24_2BAA, ov29_000C: redraw pipeline) |
| 3E | **DUMP** | — | ov02_3251 | 51 | — | | 0 | 0 | — | **new**: `PC+1`; `ov17_3A56(1, ...)`; `DS:47E7 := SelectedChar (DS:6506)`; `ov24_0795(SelectedChar)` (dec; M: shows/dumps the selected character) |
| 3F | **FIND SPECIAL** | — | ov02_3284 | 84 | — | | 1 | 1 | — | **new**: clear the 6 flags (DS:75F8, 6 B); `ReadOperands(1)`; `if ov24_2396(v(1), SelectedChar) then EQ := 1 else NE := 1` (dec; ov24_2396 is also CHECK_PARTY's per-member test = "has special/effect id") |
| 40 | **DESTROY ITEMS** | — | ov02_32D8 | 159 | — | | 1 | 1 | — | **new**: `ReadOperands(1)`; for every character in the party list (DS:650A, next at +189h) for every item (list at +14Dh, next at +2Ah): `if item[+2Eh] = v(1) then ov24_15FF(item, char)` (remove, M); then `ov24_0C28(char)` (recalc, M) (dec) |

Totals: **61 Pool opcodes present** (24 same, 15 minor, 22 changed by code shape), **3 new** (3E, 3F, 40), **0
removed**, 1Fh absent in both. Operand counts identical except **34h (1 -> 2)**. The opcode numbering, operand type
bytes, 6-bit text, 5-vector header and IF-skip mechanism carry over unchanged; the memory map shifts (section 4).

## 6. `ecldis.py` on the shipped ECL records (cab-data extracts `decode/bin/dax/ECLn/<rec>.bin`, 25 records)

- **Pool's `decode/tools/ecldis.py` unchanged** (base 9900h, loop ECL1..8): fails at once on the missing ECL7 folder;
  with the loop limited to ECL1..6 it "disassembles" 25 records to garbage: the 5 header vectors (806A, 806B, 9BF4,
  9C01, 8014 in ECL1/80) lie outside its 9900..B6FF code range, so nothing is followed; usage table = 9 opcodes
  (GOTO x3, GOSUB, COMPARE, SAVE, SETUP_MONSTER, COMPARE_AND x2, NEW_ECL, CLEAR_BOX, one `E1 ??? (no handler)`),
  the rest `db`. **Divergence = the base address**, nothing else.
- **Three-line patch** (`BASE = 0x8000`; `OPS` + `0x3E: ("DUMP", 0), 0x3F: ("FIND_SPECIAL", 1), 0x40: ("DESTROY_ITEMS", 1)`;
  `SKIPCOUNT = {0x15: 0, 0x1F: 2, 0x25: 0, 0x26: 0, 0x2B: 0, 0x34: 1, 0x36: 1}`): **all 25 records disassemble
  cleanly — 0 undecodable operands, 0 unhandled opcodes reached, 61 distinct opcodes used**, every string decodes
  (e.g. ECL1/80 at 8000: the 5 vectors, then `SAVE #00,[4BE6]; LOAD_FILES #7F,#7F,#7F; PICTURE #79; COMPARE [4BF2],#51;
  IF_EQ ...`). Unused handlers in the data: **0F INPUT_NUMBER, 22 PARTY_SURPRISE, 23 SURPRISE**. Unreached bytes
  (`db` lines, data tables / fall-through after ON_GOTO) per record: ECL1 27/23/1, ECL2 4/5/3/7, ECL3 7/3/16/35,
  ECL4 11/6/2/8/1, ECL5 1/1/5/8/89, ECL6 4/6/3/38 — ECL5/53 (89) and ECL6/69 (38) are the ones to look at first.
  Patched copy and listings: `%TEMP%\claude\...\scratchpad\..\ecl\ecldis_cab.py`, `out_cab\ECLn_rr.ecl.txt`
  (scratch; cab-ecl owns `decode/tools/ecldis.py` and `decode/ecl/listings/`, apply the patch there).

Usage (patched run, counts over the 25 records): EXIT 653, GOTO 1775, GOSUB 1087, COMPARE 1240, SAVE 1913, PRINT 1310,
PRINTCLEAR 1053, IF_EQ 789, IF_NE 442, ADD 364, LOAD_MONSTER 276, RETURN 268, IF_GT 216, CLEAR_MONSTERS 206, COMBAT 199,
PICTURE 199, SETUP_MONSTER 197, ON_GOTO 179, RANDOM 174, CALL 167, AND 161, HORIZONTAL_MENU 156, GET_TABLE 151,
PRINT_RETURN 120, IF_LT 87, DELAY 87, COMPARE_AND 66, IF_GE 64, TREASURE 63, SUBTRACT 63, NEW_ECL 58, LOAD_CHARACTER 42,
IF_LE 25, MULTIPLY 24, DAMAGE 24, LOAD_PIECES 23, VERTICAL_MENU 22, LOAD_FILES 22, ENCOUNTER_MENU 21, APPROACH 20,
CLEAR_BOX 17, PARLAY 15, OR 13, PROGRAM 13, DESTROY_ITEMS 13, ROB 10, ADD_NPC 9, FIND_ITEM 8, SAVE_TABLE 8, WHO 7,
DIVIDE 6, ON_GOSUB 6, DUMP 5, INPUT_STRING 5, SPRITE_OFF 3, PARTY_STRENGTH 2, ECL_CLOCK 2, SPELL 2, FIND_SPECIAL 2,
CHECK_PARTY 1, PROTECTION(3C) 1.

## 7. VM state summary (Curse DS, with the Pool cell for cross-reading)

| Curse DS | Pool DS | name |
|---|---|---|
| 4FA5 | 49DE | ecl_CodeBuf (far ptr, 1E00h; VM 8000..9DFF) |
| 4F99 / 4F9D / 4FA1 | 49D2 / 49D6 / 49DA | region 0 / 1 / 2 word arrays (saved with the game: cab-data saves format) |
| 4FB4 | 49ED | ecl_PC |
| 4FAA..4FB2 | 49E3..49EB | vecA..E |
| 75FF / 75FE | 6F7F / 6F7E | CurOp / LastOp |
| 75F8..75FD | 6F78..6F7D | flags EQ NE LT GT LE GE |
| 7685 / 76C5 / 7705 (+i) | 7006 / 7046 / 7086 | OpType / OpHi / OpLo |
| 7648 + k*100h | 6FC8 + k*100h | Str[k] |
| 75F0 | 6F70 | gosub stack head |
| 47E0 / 47E1 | 442E / 442F | Stop / Restart |
| 4FC7 | 49FF | PartyDead |
| 8B5E | 84DC | current ECL block number |
| 5BEE | 5376 | current data set digit (ECLn/GEOn/...) |
| 4FC1 | — | **trace flag** (prints opcode names) |
| 4FC2 | 49F8 | resuming-a-save flag (InitVM) |
| 4FBA / 4FBB | 49F3 ? | view mode (3/4) / previous |
| 6506 / 650A | 5D92 / 5D96 | SelectedChar / party list head |

## 8. Open questions (for cab-ecl)
- Full semantics of the 22 "changed" handlers (above all 00, 13, 20, 24, 27, 2D, 38, 3C, 3D) and of 3E/3F/40.
- Region-1 character overlay table (ov07_07F1 / ov07_0B6D) for the larger Curse character record.
- Meaning of the 2-byte record header (ECL1/80 `88 13` = 5000, same value as Pool's ECL1/18).
- Whether Pool's SPELL address truncation and ROB unused-operand quirks persist (shape 0.78 / 0.92).
- Cross-check with simeonpilgrim/coab `Classes/EclBlock.cs` (oracle only): not done in the gate test.
