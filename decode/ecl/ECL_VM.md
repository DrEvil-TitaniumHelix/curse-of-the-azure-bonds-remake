# ECL_VM — the Curse of the Azure Bonds event-script virtual machine (cab-ecl, 2026-10-20)

Owner: cab-ecl. Tools: `decode/tools/ecldis.py` (disassembler, driven by this spec; `--all` writes
`decode/ecl/scripts/ECL<n>_<rec>.ecl.txt` + `INDEX.md` with coverage, usage, operand types, CALL ids),
`decode/ecl/runewheel.py` (copy-protection answer, section 8). Names: `decode/names/ecl_names.json`. Gate-test diff:
`decode/ecl/ECL_DIFF.md`. First-party prior art: `PoolRadianceRE/decode/ecl/ECL_VM.md` ("Pool §n" below).

Address convention: overlay unit N is at the analysis segment of `decode/LAYOUT.md`: **ov02 = 2200** (the script
unit: dispatch + every handler), **ov07 = 2C00** (operands, VM memory, helpers), ov34 = 7300 (opcode-name table),
ov03 = 2600 (rune wheel). `DS` = 0C1C. "asm" = verified on the instruction bytes (`decode/listings/*.lst`); "dec" =
read from the Ghidra decompile (`*.c`; TP far-proc parameters appear right-to-left, corrected here); "shape" = the
instruction-shape similarity to Pool's handler from ECL_DIFF.md (1.00 = identical code modulo addresses).
Confidence H/M/L per item. Pascal pseudocode: `v(i)` = `ecl_OperandValue(i)`, `a(i)` = address `OpHi[i]*256+OpLo[i]`
(`MakeWord`), `S(k)` = string slot k, `Mem[x]` = VM cell x (`ecl_GetMem`/`ecl_SetMem`), `c` = a character record
(422 B, `decode/data/MONSTERS.md`; list links: next member `+189h`, item list `+14Dh` (63-byte items, next `+2Ah`,
type `+2Eh`), effect list `+F2h` (9-byte effects, id `+0`, next `+5`), icon slot `+143h`).

Decompiler artifact to read around: the code buffer is addressed as `CodeBuf + PC + 8000h` = byte
`CodeBuf[PC - 8000h]`; region arrays as `DS:4F99 + a*2 + 6A00h` (= word `a - 4B00h`), `DS:4F9D + a*2 + 800h`
(= word `a - 7C00h`), `DS:4FA1 + a*2 + C00h` (= word `a - 7A00h`).

---------------------------------------------------------------------------------------------------------
## 1. Where the interpreter lives — H

| routine | address | role | evidence |
|---|---|---|---|
| `LoadEclBlock(n)` | LoadEclBlock 2C00:0380 | `FillChar(CodeBuf^, 1E00h, 0)` (CodeBuf = DS:4FA5); `DS:5CF0 := 0`; repeat `LoadDaxRecord('ECL'+Str(DS:5BEE)+'.dax', n)` (LoadDaxRecord) until size >= 2; `Move(rec[2], CodeBuf^, size-2)`; FreeMem | dec + strings `[ps] "ECL"` 2C00:0377, `".dax"` 037B; shape 0.93 vs Pool 4300:0341 |
| `ecl_InitVM` | ecl_InitVM 2C00:01FC | clears flags `DS:8B62/8B64/8B52/8B53`, 3D colours `DS:75E8 := 41h, 75E9 := 09h`, `8B67 := 1`, `8B48..49 := 0`, next-icon slot `DS:7603 := 8`, **`PC := 8000h`** (asm 2C00:023B `C7 06 B4 4F 00 80`), `DS:7746 := 0`, gosub stack `DS:75F0..75F6 := nil`, 6 flags `DS:75F8..75FD := 0`, `Mem[7EE1] := FFh` (sprite id), `Mem[7ED2] := 0; Mem[7ED3] := 0; Mem[4BE5] := 0`; reads the 5 header vectors with `ReadOperands(1)` + `MakeWord` into `DS:4FAA/4FAC/4FAE/4FB0/4FB2` (vecA..E); `Mem[4BE6] := 1` (3D-area flag); unless resuming a save (`DS:4FC2`): `Mem[4C00..4C1F] := 0` and `Mem[7F79..7F82] := 0` (block-local cells) | dec; shape 0.99 vs Pool 4300:01B6 |
| `ecl_Run(addr)` | ecl_Run **2200:3621** | the fetch loop (below) | asm 2200:3621..368E |
| `ecl_Dispatch` | ecl_Dispatch **2200:3377** | `case CurOp of` — a TP compare chain (`CMP AX,n / JNZ / CALL handler / JMP 361D`), no jump table; **00..40h, 1Fh absent**; shared handlers 04..07, 11/12, 16..1B, 21/37, 25/26, 2F/30 | asm 2200:337A..361A |
| `ecl_ReadOperands(n)` | ecl_ReadOperands 2C00:0034 | operand decoder (§2) | asm; shape 0.89 |
| `ecl_OperandValue(i)` | ecl_OperandValue 2C00:0173 | value of decoded operand i (§2) | asm; shape 0.87 |
| `MakeWord(hi, lo)` | MakeWord | `hi*100h + lo` | asm |
| `ecl_MemRegion(a)` | ecl_MemRegion | region selector (§3) | dec |
| `ecl_GetMem(a)` / `ecl_SetMem(v, a)` | ecl_GetMem / ecl_SetMem | VM memory (§3) | dec; shape 0.92 / 0.86 |
| `ecl_GetCharField` / `ecl_SetCharField` | ecl_GetCharField / ecl_SetCharField | region-1 character overlay (§3.1) | dec |
| `ecl_GetMemString(a, k)` / `ecl_SetMemString(a, s)` | ecl_GetMemString / ecl_SetMemString | string variables | shape 0.96 / 0.93 (Pool §3) |
| `ecl_UnpackString(k, len)` / `ecl_SixBitChar` | ecl_UnpackString / ecl_SixBitChar | packed text (§2.2) | shape 0.97 / 1.00 |
| `ecl_SkipInstruction` | ecl_SkipInstruction 2C00:1FF5 | used by IF when the condition is false (§2.4) | asm |
| `ecl_CompareWords(a, b)` / `ecl_CompareStrings(a, b)` | ecl_CompareWords / ecl_CompareStrings | set the 6 condition flags `DS:75F8..75FD` | shape 0.99 / 1.00 (Pool §2.3) |
| `ecl_Gosub(i)` | ecl_Gosub | push PC on the heap list `DS:75F0` (6-byte nodes {ret, next}), `PC := a(i)` | dec |
| `PartyIndexOf(c)` | PartyIndexOf | 0-based party position | dec (used by 7EB1/7EB4) |
| `ApproachDistance(dir, y, x)` | ApproachDistance | free squares ahead, max 2; 2 when not 3D (`Mem[4BE6] = 0`, also stores 2 into `Mem[7EC1]`) | dec |
| `ShowEncounter(var shown; sprite, pic, dist)` | ShowEncounter | SPRIT sprite at distance (`LoadAnimation(&DS:722C, 1, sprite, 'SPRIT')`, `Show3DSprite` at `dist+1`) or the PIC/HEAD+BODY picture when `Mem[7EE1]` says so | dec (strings "SPRIT" 2C00:0587, "PIC" 058D) |
| `ShowHeadBodyPicture(body, head)` | ShowHeadBodyPicture | `DS:4FC5 := head; 4FC6 := body; LoadPortrait(body, head); DrawPortrait(1,3,3)` | dec |
| `LoadMonsterRecord(var items, var effects, var rec; id)` | LoadMonsterRecord | `GetMem(rec, 1A6h)`; `LoadMonster(rec, id)` = LoadMonster (MONSTERS.md); returns the record's item list `+14Dh` and effect list `+F2h` | dec |
| `SetupDuel(flag)` | SetupDuel | CALL 8000h/8001h (M: as Pool's ov07_1A6F) | callee of ecl_op2D_Call |
| `StepForward` | StepForward | CALL C01Eh | callee |
| `RobMoney(c, f)` / `LoseItems(c, pct)` | RobMoney / LoseItems | ROB helpers | callees |
| `ecl_GameLoop` | ecl_GameLoop 2200:3772 | adventure loop: calls the VM through the vectors (§5) | dec |
| `ecl_RunAfterNewBlock` | ecl_RunAfterNewBlock | restart after NEW_ECL (§5) | dec |
| `ecl_CampCheck` | ecl_CampCheck | Encamp: vecC, camp menu, vecD (§5) | dec |
| `ecl_OpcodeName(op, var s)` | ecl_OpcodeName 7300:0240 | **new**: 64-entry `case` of SSI's own opcode names ("EXIT".."DESTROY ITEMS", "SUBTRAT" sic); called by the fetch loop when the trace flag `DS:4FC1` is set, then `WriteLn` (2200:365F..367B) = built-in script tracer | asm 7300:0243.. |

Fetch loop (asm 2200:3621):
```pascal
procedure ecl_Run(addr: word);                 { 2200:3621 }
begin
  ecl_PC := addr;                              { DS:4FB4 }
  ecl_Stop := false;                           { DS:47E0 }
  while not ecl_Stop and not PartyDead do      { DS:4FC7 }
  begin
    ecl_LastOp := ecl_CurOp;                   { DS:75FE := DS:75FF }
    ecl_CurOp  := CodeBuf^[ecl_PC - $8000];    { ES:[DI+8000h] }
    if TraceFlag then WriteLn(ecl_OpcodeName(ecl_CurOp));   { DS:4FC1 }
    ecl_Dispatch;                              { 2200:3377 }
  end;
  ecl_Stop := false;
end;
```
Each handler advances `ecl_PC` (`ecl_ReadOperands` leaves it on the next opcode; operand-less handlers do
`INC word [4FB4]`). **Opcode 1Fh and any opcode > 40h have no handler: the PC is not advanced and the loop spins
forever** (H, asm: the chain ends at `CMP AX,40h / JNZ 361D`). No such opcode is reachable in the shipped scripts (§7).

---------------------------------------------------------------------------------------------------------
## 2. Operand encoding — H (asm 2C00:0034..0170, 2C00:0173..01F9) — unchanged from Pool §2

`ecl_ReadOperands(n)` decodes n operands that follow the byte at `PC` into three parallel 1-based byte arrays
`OpType[i]` = DS:7685+i, `OpHi[i]` = DS:76C5+i, `OpLo[i]` = DS:7705+i (Pool 7006/7046/7086), and string operands
into the string slots `Str[k]` = `DS:7648 + k*100h` (string[255]; k counts string operands of this call, 1, 2, ...):

| type byte | bytes | meaning | value (`ecl_OperandValue`) |
|---|---|---|---|
| `00` | `00 bb` | immediate byte | `bb` |
| `01` | `01 lo hi` | memory reference | `Mem[hi*256+lo]` |
| `02` | `02 lo hi` | immediate word | `hi*256+lo` |
| `03` | `03 lo hi` | memory reference (same as 01) | `Mem[hi*256+lo]` (not in data) |
| `80` | `80 len b1..blen` | packed text, unpacked into `Str[k]` (§2.2); `len = 0` -> empty string | `Mem[OpHi*256+len]` (meaningless, never used) |
| `81` | `81 lo hi` | string variable at `hi*256+lo`, copied into `Str[k]` by `ecl_GetMemString` | `hi*256+lo` |
| other | `tt bb` | (2 bytes consumed) | unassigned local -> undefined; not present in data |

Handlers that need an **address** (a destination) take `a(i)` = `MakeWord(OpHi[i], OpLo[i])` directly, whatever the
type byte is. The operand index is sign-extended (`CBW` 2C00:017C); indexes >= 80h would misbehave (not in data).
The decoder is Pool's (shape 0.89; the differences are the DS addresses): see Pool §2 for the Pascal form.
Operand types actually used per opcode operand: `decode/ecl/scripts/INDEX.md` "Operand types".

### 2.1 Variable-length instructions — H
Handlers 15h (VERTICAL MENU), 25h/26h (ON GOTO/ON GOSUB) and 2Bh (HORIZONTAL MENU) read their fixed operands,
then `DEC word [4FB4]` and `ecl_ReadOperands(count)` again, count = the value of their last fixed operand (15h:
operand 3; 25h/26h/2Bh: operand 2). The second call overwrites operand slots 1..count and restarts string slot
numbering at 1 (shape 0.95 / 1.00 / 1.00 vs Pool 2F00:0F08 / 18F8 / 10D1). Encoded form: `op fixed... extra[1..count]`.
Largest in data: ON_GOTO with 45 targets (ECL5/53), VERTICAL_MENU with 4 items, HORIZONTAL_MENU with 6.

### 2.2 Packed text — H (ecl_UnpackString shape 0.97, ecl_SixBitChar shape 1.00 vs Pool 4300:1153 / 06D3)
Every 3 bytes hold four 6-bit codes, most significant first; code 0 is skipped; codes `01..1F` -> `chr(code+40h)`,
`20..3F` -> `chr(code)`. Identical to Pool §2.2; all 3,048 text operands of the 25 records decode to clean upper-case
text with this rule (every listing in `decode/ecl/scripts/`).

### 2.3 Condition flags — H
Six bytes `DS:75F8..75FD` = EQ, NE, LT, GT, LE, GE (Pool 6F78..6F7D), all cleared then set by `CompareWords(a, b)`
(unsigned 16-bit) or `CompareStrings(s1, s2)` (TP `@StrCompare`). Also written by COMPARE AND (14h, EQ/NE only),
AND/OR (2Fh/30h: `CompareWords(0, r)`), FIND ITEM (32h, EQ/NE) and **FIND SPECIAL (3Fh, EQ/NE)**.

### 2.4 IF and the skip table — H (asm 2200:0B3B, 2C00:1FF5..2136)
`IF_xx` (16h..1Bh) has no operands: `PC := PC+1`; if the flag (16 EQ `75F8`, 17 NE `75F9`, 18 LT `75FA`, 19 GT `75FB`,
1A LE `75FC`, 1B GE `75FD`) is **false** the next instruction is skipped by `ecl_SkipInstruction`, which sets
`ecl_CurOp := Code[PC]` (2C00:2006, overwriting the IF opcode) and does `ecl_ReadOperands(k)` with k from a fixed table:

| k | opcodes | delta vs Pool §2.4 |
|---|---|---|
| 1 | 01 02 0A 0E 11 12 1D 20 2D 32 34 36 38 39 3C 3F 40 | + 3F 40 |
| 2 | 03 08 09 0F 10 1F 22 | 0C removed (Pool's mismatch fixed) |
| 3 | 04..07 0B 0C 21 28 2A 2F 30 35 37 3B | + 0C |
| 4 | 14 23 | same |
| 5 | 2E | same |
| 6 | 1E 2C | same |
| 8 | 27 | same |
| 0Eh | 29 | same |
| 0 (PC+1) | all others: 00 0D 13 15 16..1B 1C 24 25 26 2B 31 33 3A 3D 3E | same |

Engine quirks (H): the table disagrees with the handlers for **34h** (table 1, handler reads 2: an IF-skipped
ECL CLOCK lands one operand short — not in data: both ECL CLOCK uses follow a GOSUB target, not an IF), **36h** (table
1, handler 2 — as Pool) and the variable-length **15h/25h/26h/2Bh** (only the opcode byte is skipped; the PC then lands
inside the operands). `ecldis.py` follows the table for the skip successor (`SKIPCOUNT`).

---------------------------------------------------------------------------------------------------------
## 3. VM memory map — H (dec ecl_MemRegion, ecl_GetMem, ecl_SetMem)

`ecl_MemRegion(a)`: `4B00..4EFF` -> 0, `7C00..7FFF` -> 1, `7A00..7BFF` -> 2, `8000..9DFF` -> 3, else 4. **Delta vs
Pool:** region 0 = Pool + 200h, region 1 = Pool + 1100h, region 2 = Pool - 1D00h, script = Pool - 1900h; every
relative cell the engine uses keeps its Pool offset (e.g. 3D flag +E6h, previous block +F2h, sprite id region-1 +2E1h).

| region | ECL addresses | storage | read | write |
|---|---|---|---|---|
| 0 | 4B00..4EFF | word array at far ptr `DS:4F99` (saved with the game: cab-data saves) | word | word; writing 4BFD or 4BFE also sets redraw flag `DS:8B6A`; **writing 4BE6 (3D-area flag) with a value different from the stored one also sets the view mode `DS:4FBA := 3` (value 0) / `4` (else) and saves the old mode in `DS:4FBB`** (new) |
| 1 | 7C00..7FFF | word array at `DS:4F9D` **overlaid by fields of the selected character** `DS:6506` | `ecl_GetCharField` first (§3.1); array if not a char field | array always, then `ecl_SetCharField` |
| 2 | 7A00..7BFF | word array at `DS:4FA1` | word | word |
| 3 | 8000..9DFF | the loaded script itself, **bytes** (`DS:4FA5`, 1E00h) | byte | byte |
| 4 | everything else | engine globals (§3.2) | listed cases; others -> uninitialised local (L: garbage) | listed cases; others ignored |

Strings (`ecl_SetMemString`/`ecl_GetMemString`): one character per **word** in regions 0..2, per byte in region 3,
0-terminated; region-1 address 7C00 = the selected character's name (string, `c+00h`; writing value 0 to 7C00 sets
`DS:8B53`). The scripts keep their string variables in region 2 (`$[7B00]`, `$[7BF4]`...).

### 3.1 Region 1 character overlay (ecl_GetCharField get / ecl_SetCharField set; dec) — H for the code, field names M/L
`c` = record at `DS:6506` (the selected character, 422 B). ECL offset = `a - 7C00h`.

| ECL addr | get | set | Pool twin (Pool §3.1) / note |
|---|---|---|---|
| 7C00 | (array) | value 0 -> `DS:8B53 := 1`; string = name | 6B00 name |
| 7C15 | byte `c+13h` | — | 6B18 (`+14h` con) — different offsets (M) |
| 7C18 | byte `c+19h` | — | — |
| 7C20..7C70 | (array) | byte `c[a-7C20h+1Fh]` (`+1Fh..+6Fh`) | 6B20..6B70 spells (`+18h..+68h`) |
| 7C72 | shortint `c+74h` | — | — |
| 7C73 | shortint `c+75h` | — | class (PARTY SURPRISE tests `c+75h` = 4 / 0Ah) |
| 7C9B | byte `c+E0h` | — | 6B9B save[1] (`+6Eh`) |
| 7CA0 | shortint `c+E5h` | — | 6BA0 |
| 7CA5..7CAC | byte `c+EAh..+F1h` | — | 6BA5..6BAC thief_skill[0..7] (`+77h..+7Eh`) |
| 7CB8 | byte `c+F7h` | byte `c+F7h` (value > B2h: -32h) | 6BB8 npc_flags (`+84h`) |
| 7CBB,7CBD,7CBF,7CC1,7CC3 | word `c+FBh,+FDh,+FFh,+101h,+103h` | same | money copper..platinum (`+88h..+90h`) |
| 7CC9 | `c+10Eh + c+116h * DualClassActive(c)` (DualClassActive = `CurrentClassLevel(c) > c+E6h`, a level test, M) | — | new (hit points? M) |
| 7CD6 | shortint `c+119h` | — | — |
| 7CD8 | shortint `c+11Bh` | — | 6BD8 alignment (`+A0h`) |
| 7CE4 | `c+192h and 1` | — | new |
| 7CF7 | word `c+13Ch` | word | 6BF7 (`+B8h`) |
| 7CF9 | byte `c+13Eh` | byte | 6BF9 (`+BAh`) |
| 7D00 | `c+196h = 0` -> 80h else 1; forced 0 once after a failed LOAD CHARACTER (`DS:8B6D`) | v > 7Fh: `c+196h := 0`, v = 87h: `c+195h := 7` (stoned); v = 0: `DS:8B52 := 1` | 6C00 active/status (`+10Dh/+10Ch`) |
| 7D0C | `c+197h = 0 and c+198h <> 0` -> 80h; `c+197h = 1` -> 81h; else 0 | 0 / 80h / 81h -> (+197h,+198h) = (0,0)/(0,1)/(1,1) | 6C0C |
| 7D0D | found, value undefined (L) | — | 6C0D |
| 7D1B | byte `c+1A5h` | — | 6C1B move (`+11Ch`) |
| 7EB1, 7EB4 | 0-based party position (PartyIndexOf) | — | 6DB1/6DB4 |
| 7ECF | reaction bonus from `c+1Bh` (cha): 3->0, 4->5, 5->10, 6->15, 7->20, 8..12->25, 13->30, 14->35, 15->40, 16->50, 17->55, 18..25->60 | — | 6DCF (same table) |
| 7F12 | `DS:5BEE` (current data set 1..6) | `SetDataSet(byte v)` (select data set) | 6E12 |
| 7F22,7F24,7F26 | (array) | v > 80h: `LoadWallSet(slot 1/2/3, v and 7Fh)` (LoadWallSet) | 6E22.. (same) |
| 7F3E | word array +67Ch (= party member count) | (array) | 6E3E |

The character record offsets `+1Fh..+6Fh`, `+EAh..`, `+F7h`, `+FBh..`, `+13Ch`, `+195h/196h`, `+1A5h` = Pool's TChar
field + 7 / + 73h / + 89h (the record grew in three places); the full field map is the saves lane's (SAVES.md).

### 3.2 Region 4 engine globals (ecl_GetMem / ecl_SetMem; dec) — H, same ECL address set as Pool §3.2

| ECL addr | read | write |
|---|---|---|
| 00B1 | `DS:75EE` | ignored |
| 00FB / 00FC | `DS:75EA` / `DS:75EC` | ignored |
| 00B8 / 00B9 | — | `DS:8B4E` / `DS:8B50` |
| 033D | party facing `DS:7211` | — |
| 03DE | — | `DS:8B4C` (selector used by CALL B200h) |
| C04B | party X `DS:720F` | X, `DS:8B68 := 1` (view redraw) |
| C04C | party Y `DS:7210` | Y, redraw |
| C04D | facing / 2 (0..3) | `DS:7211 := 2*(v mod 4)`, redraw |
| C04E | `DS:7212` (wall type ahead) | — |
| C04F | `DS:7213` (cell attribute) | — |
| C059 / C05F | — | `DS:75E8` / `DS:75E9` + `DS:8B67 := 1` (3D backdrop colours, InitVM sets 41h / 09h) |

### 3.3 Well-known fixed cells used by the engine around ECL (H where the code is cited)
- `4BC6..4BCC` region 0: game clock, 7 counters (AdvanceClock AdvanceClock reads/writes them). `4BC5`: current 3D map id
  (LOAD FILES). `4BE5`: zeroed by InitVM. `4BE6`: **3D-area flag** (0 = not 3D). `4BF0/4BF1`: party X/Y saved by the
  game loop before vecB. `4BF2`: previous ECL block number. `4CFD`: set to FFh by PROGRAM 8 (won).
- `7EA8`: set to FFh by PROGRAM 8. `7EC0`/`7EC1`: encounter distance (requested / actual). `7EC9`: zeroed by LOAD
  FILES. `7ECA`: search/look state bits (game loop §5). `7ECB`: SURPRISE result. `7ED2/7ED3/7ED5`: zeroed by
  InitVM / RunAfterNewBlock. `7EE1`: 3D sprite id (FFh = PICTURE loads a full PIC/BIGPIC). `7EE2` / `7F6C`: COMBAT with no
  monsters -> temple (ov04) / shop (ov06). `7F3E`: party member count. `7F3F`: **DIVIDE remainder** (new).
- `4C00..4C1F` (region 0) and `7F79..7F82` (region 1): **block-local** — `ecl_InitVM` zeroes them on every block load
  unless a save is being resumed (`DS:4FC2`). The scripts use `7F79..7F82` as their scratch variables (menu results,
  ON GOTO selectors). Persistent quest flags are the other script-only region-0 cells (`4C20` and up).

---------------------------------------------------------------------------------------------------------
## 4. Opcodes — every handler

Columns: op, SSI name (ecl_OpcodeName), handler (ov02 offset, seg 2200), fixed operand count `n` (the handler's
`ecl_ReadOperands(n)`), semantics, confidence. "= Pool §4.x" = the code is Pool's handler modulo addresses (shape
>= 0.95 and spot check of the decompile); only the address deltas are given. Pool's own quirk list applies to those.

### 4.1 Control flow, arithmetic, memory

| op | SSI name | handler | n | semantics | conf |
|---|---|---|---|---|---|
| 00 | EXIT | 0052 | 0 | if `DS:8B64` then `FUN_01A0_0136` (clear the picture box, M); if `DS:47E2` restore `SelectedChar (6506) := DS:47E7` and clear 47E2; `FillChar(DS:8B48, 2, 0)`; `8B62 := 0; 8B64 := 0`; **`ecl_Stop := true`** (47E0); `PC+1`; free the whole gosub list (`DS:75F0`, 6-byte nodes); text cursor `DS:65A1 := 11h; 65A0 := 1` (row 17, col 1); `DS:8B60 := 0`. **Delta vs Pool §4.1 EXIT:** no frame drawing (Pool drew the picture-box frames here). | H asm 2200:0052..00E7 |
| 01 | GOTO | 00E8 | 1 | `PC := a(1)` | H = Pool (0.96) |
| 02 | GOSUB | 0107 | 1 | `ecl_Gosub(1)`: push `PC` (already past the operand) on the heap list `DS:75F0`, `PC := a(1)` | H = Pool (0.95; ecl_Gosub dec: node = {ret word, next far ptr}) |
| 03 | COMPARE | 011E | 2 | if `OpType[1] >= 80h or OpType[2] >= 80h` then `CompareStrings(S(1), S(2))` else `CompareWords(v(1), v(2))` | H = Pool (1.00) |
| 04 | ADD | 019B | 3 | `SetMem(a(3), v(1) + v(2))` (16-bit wrap) | H dec |
| 05 | SUBTRAT [sic] | 019B | 3 | `SetMem(a(3), v(2) - v(1))` — **operand 2 minus operand 1** (as Pool) | H dec (`local_6 - local_8`) |
| 06 | DIVIDE | 019B | 3 | `SetMem(a(3), v(1) div v(2))`; **new: `Mem[7F3F] := v(1) mod v(2)`** (region-1 word +67Eh); v(2)=0 -> divide fault (TP runtime error 200) | H dec (2200:019B..0243) |
| 07 | MULTIPLY | 019B | 3 | `SetMem(a(3), v(1) * v(2))` (low word) | H dec |
| 08 | RANDOM | 0244 | 2 | `n := byte(v(1)); if n < 255 then n := n+1; SetMem(a(2), byte(Random(n)))` -> 0..v(1) | H = Pool (1.00) |
| 09 | SAVE | 02A2 | 2 | if `OpType[1] >= 80h` then `SetMemString(a(2), S(1))` else `SetMem(a(2), v(1))` | H = Pool (1.00) |
| 13 | RETURN | 0A86 | 0 | `PC+1`; if the gosub list is not empty: `PC := pop` (node freed). **Delta vs Pool: with an empty list it calls the EXIT handler** (asm 2200:0ACE `CALL 0052`): a RETURN outside any GOSUB ends the script (Pool fell through to the next instruction). | H asm |
| 14 | COMPARE AND | 0AD6 | 4 | clear flags; if `v(1)=v(2) and v(3)=v(4)` then EQ else NE | H = Pool (1.00) |
| 16..1B | IF = <> < > <= >= | 0B3B | 0 | `PC+1`; if not flag then `ecl_SkipInstruction` (§2.4) | H dec (flags 75F8..75FD; shape 0.83 only because of the six DS addresses) |
| 25 | ON GOTO | 1A9B | 2+v(2) | `x := v(1); cnt := v(2); PC-1; ReadOperands(cnt)`; if `x < cnt` then `PC := a(x+1)` else fall through | H = Pool (1.00) |
| 26 | ON GOSUB | 1A9B | 2+v(2) | same, but `ecl_Gosub(x+1)` | H = Pool |
| 2A | GETTABLE | 0E13 | 3 | `SetMem(a(3), Mem[a(1) + byte(v(2))])` | H = Pool (1.00) |
| 2F | AND | 0DA4 | 3 | `r := byte(v(1) and v(2)); CompareWords(0, r); SetMem(a(3), r)` (EQ/GE iff r = 0, NE/LT iff r <> 0, LE always) | H = Pool (1.00) |
| 30 | OR (no own name-table entry; shares AND's) | 0DA4 | 3 | same with `or` | H = Pool |
| 35 | SAVE TABLE | 0E71 | 3 | `SetMem(a(2) + v(3), v(1))` | H = Pool (1.00) |
| 1F | — | none | — | no handler: VM hangs. Not in data. | H |

### 4.2 Text, input, menus

Window conventions (M): `DrawWrappedText(x1, y1, x2, y2, colour, clear, s)` = word-wrapped print in the text window
(rows 17..22), `DS:65A0/65A1` = text cursor column/row, `DrawText` = print at (x, y, colour), `MessageDelay` =
delay by game speed, `ClearTextRectangle` = menu select, `ReadBottomLine` = ReadBottomLine, `ReadWordNumber` = ReadWordNumber.

| op | SSI name | handler | n | semantics | conf |
|---|---|---|---|---|---|
| 11 | PRINT | 09EA | 1 | `DS:8B65 := 0` (M); if `OpType[1] < 80h` then `S(1) := IntToStr(v(1))` (WordToStr); print `S(1)` continuing at the cursor (clear flag 0) | H = Pool (0.97) |
| 12 | PRINTCLEAR | 09EA | 1 | same, cursor := (1, 11h) and clear flag 1 (clears the window first) | H = Pool |
| 33 | PRINT RETURN | 2CEA | 0 | `PC+1`; new line (row+1, col 1) | H = Pool (0.96) |
| 3D | CLEAR BOX | 2D15 | 0 | `PC+1`; `FUN_01A0_0136` (clear picture box, M); `PartySummary(SelectedChar)` (party summary "Name AC HP"); `DrawLocationTimeStatus` (status line); `DrawPictureScreenOrView(DS:7232, DS:7234, 1, 3, 3)` (draw the current picture at (3,3)); `DrawLocationTimeStatus`; `DS:8B6E := 0; 8B60 := 1`. **Delta vs Pool (31 B -> 73 B):** redraws the party summary and the picture instead of only clearing the box. | H dec |
| 0F | INPUT NUMBER | 092C | 2 | `n := ReadWordNumber('', 0Ah)`; `SetMem(a(2), n)`; operand 1 unused (not in data) | H = Pool (0.96) |
| 10 | INPUT STRING | 0972 | 2 | `s := ReadBottomLine('', 0Ah, 28h)`; if s = '' then s := ' '; `SetMemString(a(2), s)`; operand 1 unused | H = Pool (0.98) |
| 15 | VERTICAL MENU | 0EBD | 3+v(3) | `dest := a(1); prompt := S(1); cnt := v(3); PC-1; ReadOperands(cnt)`; list picker (NewMenuList / FreeMenuList / EclVerticalListMenu), `SetMem(dest, chosen index)`; clear text window | H = Pool (0.95) |
| 2B | HORIZONTAL MENU | 1082 | 2+v(2) | `dest := a(1); cnt := v(2); PC-1; ReadOperands(cnt)`; menu string `'~'+S(1)+' '...`; `k := MenuSelect` (MenuSelect); `SetMem(dest, k)` (0-based); single-item menus get the highlight colours (0Fh,0Fh) | H = Pool (1.00) |
| 39 | WHO | 2D5E | 1 | clear text window; `SelectPartyCharacter(var SelectedChar, 0, S(1))` = "Select / Exit" party picker with prompt `S(1)` | H = Pool (1.00) |
| 3A | DELAY | 28F3 | 0 | `PC+1; MessageDelay` | H = Pool (0.92; same two calls) |

### 4.3 Party / characters

| op | SSI name | handler | n | semantics | conf |
|---|---|---|---|---|---|
| 0A | LOAD CHARACTER | 02F0 | 1 | `DS:47E2 := 1` (restore SelectedChar at EXIT); `x := byte(v(1)); idx := x and 7Fh`; walk the party list `DS:650A` idx links (`+189h`); `DS:8B6D := (not found)`; if found `SelectedChar := it`; if `x and 80h` and `DS:8B52` and `DS:8B53`: (if it is the char saved in `DS:47E7` then `47E2 := 0`); `RemovePartyMember(1, 0)` (**remove** the selected character from the party, §4.6 DUMP), `PartySummary(SelectedChar)`; clear 8B52/8B53 | H dec (= Pool §4.3 with `RemovePartyMember` where Pool redrew; the 80h path removes the character that was flagged by writes of 0 to 7C00 and 7D00 = "character leaves") |
| 1D | PARTYSTRENGTH | 1271 | 1 | `s := 0`; for each member c: `s := byte(s + ((c+109h + c+111h*lv) * 4 + (c+10Eh + c+116h*lv) * 8 + c+1A4h + max(c+19Ah-3Ch,0)*5 + max(c+199h-27h,0)*5) div 10)` with `lv := DualClassActive(c)` (0/1, §3.1); `SetMem(a(1), s)`. **Delta vs Pool:** two of the five terms are now `base + per-level * lv` pairs (Pool: `level[0]*4 + hp + ...`); field names M. | H dec |
| 1E | CHECKPARTY | 1416 | 6 | `key := a(1)` if `OpType[1] = 1` else `v(1)`; `id := v(2)`; dest3..6 := a(3..6); `k := key - 7FFFh`. k = 8001h (key 0): found := any member `HasEffect(id)` (HasEffect: effect list `+F2h`, id byte at +0, next +5); min/max/avg := 0; store 4. k in A5h..ACh (**key 80A4h..80ABh**): min/max/avg over members of byte `c[(k+5Ch) and FFh + E9h]` (= `+EAh..+F1h`, the thief skills) and found := 0. k = 9Fh (key 809Eh): min/max/avg of `c+1A5h` (move). Other keys: nothing stored. **Engine bug (H, asm 2200:14B4 `SUB word [bp-2],7FFFh`): the subtrahend should be 7BFFh for region-1 keys; the data's only use, ECL4/32 @8A38 `CHECK_PARTY [7CA5], #00, [7F82], [7F79], [7F82], [7F82]` (thief-skill test for the "bulging purses" pickpocket scene), computes k = FCA6h, stores nothing, and the following `COMPARE [7F79],#00; IF_EQ GOTO 8D84` always skips the scene (7F79 is 0 there).** | H dec+asm |
| 22 | PARTY SURPRISE | 1636 | 2 | `r := 1 if any member c+75h in {4, 0Ah} (Ranger, C/R) else 0; SetMem(a(1), r); SetMem(a(2), 0)` (not in data) | H dec (= Pool with `+75h` for `+2Fh`) |
| 23 | SURPRISE | 16D2 | 4 | = Pool §4.3 (0.96): `p := v(4)+2-v(1); m := v(2)+2-v(3)`; two d6; `SetMem(7ECBh, res)`; only 0, 1, 2 occur (not in data) | H = Pool |
| 28 | ROB | 1F46 | 3 | `who := v(1); f := (100 - v(2)) / 100.0` (TP real); `pct := v(3)`; for the selected char (who = 0) or every member: `RobMoney(c, f)` (RobMoney), `LoseItems(c, pct)` (LoseItems). **Delta vs Pool: operand 3 is now used (Pool ignored it and used operand 2 for the item chance).** | H dec |
| 2E | DAMAGE | 2942 | 5 | = Pool §4.3 DAMAGE (0.86; same strings "The entire party is killed!", "press <enter>/<return> to continue"; helpers Roll Roll, ApplyEclDamage, SavingThrow/11D7 saving throws, `PartyDead (4FC7)`); the saving-throw and target-selection branches are Pool's; the +32 B are the new party-list offsets | M dec |
| 32 | FIND ITEM | 2847 | 1 | `id := byte(v(1))`; clear flags, NE := 1; for each member, each item: `item+2Eh = id` -> EQ := 1, NE := 0, stop | H dec |
| 36 | ADD NPC | 2DA9 | 2 | `AddNpcToParty(v(1))` (load NPC character, M); `SelectedChar+F7h := (v(2) shr 1) or 80h` (NPC flag + morale); `RecalcItems(SelectedChar)` (recalc item slots/weight); `PartySummary` (party summary). **Delta vs Pool:** no `+10Eh := (v(1) = 18h)` special case. | H dec |
| 3B | SPELL | 2E16 | 3 | `id := byte(v(1)); d2 := a(2); d3 := a(3)` (full words — **Pool's low-byte truncation bug is gone**); `k := 1; n := 0`; for each member c (until found): search `c[1Fh + k]`, k = 1..65h, for id; if not found and another member follows: `n := n+1`; if k > 64h then k := FFh; `SetMem(d2, k); SetMem(d3, n)`. **Delta vs Pool:** every member is searched (Pool: first only); `n` = index of the member that has it. Uses: ECL3/16, ECL5/51 (`SPELL #xx,[..],[..]`). | H dec |

### 4.4 Monsters, encounters, combat, treasure

| op | SSI name | handler | n | semantics | conf |
|---|---|---|---|---|---|
| 0B | LOAD MONSTER | 0466 | 3 | if `DS:47E6 >= 3Fh` (monster count limit) nothing. `id := v(1)`: `LoadMonsterRecord(items, effects, rec, id)` (LoadMonsterRecord; 1A6h-byte record copy into a local); `cnt := max(v(2),1); pic := v(3)`: `LoadCombatIcon(slot DS:7603, pic, 'CPIC')` (combat icon from CPICn.DAX, literal "CPIC" 2200:0461); append cnt copies to the **end of the party list `DS:650A`** (`+189h` links), each with its own item-list (`+14Dh`, 3Fh-byte nodes, next `+2Ah`) and effect-list (`+F2h`, 9-byte nodes, next `+5`) copies and icon slot `+143h := DS:7603`; `DS:47E6 += 1` per copy, stop at 3Fh; `DS:7603 += 1; DS:8B69 := 1` (monsters present); SelectedChar restored | H dec (= Pool §4.4 with the new offsets; shape 0.83 from the list code) |
| 0C | SETUP MONSTER | 03CA | 3 | `DS:7601 := v(1)` (sprite id); `Mem[7EC0] := v(2)`; `DS:7602 := v(3)` (picture id); `Mem[7EC1] := min(7EC0, ApproachDistance(dir, y, x))`; `ShowEncounter(var DS:8B48; 7601, 7602, 7EC1)` | H = Pool (1.00) (DS names M) |
| 0D | APPROACH | 0801 | 0 | if `Mem[7EC1] > 0`: `7EC1 -= 1`, `ShowEncounter` again; `PC+1` | H = Pool (0.98) |
| 0E | PICTURE | 0841 | 1 | `p := byte(v(1))`. p = FFh: if `((DS:4FBB <> 4) or (4FBA = 4)) and (8B62 or 8B65)`: `DS:7580 := 1; RefreshView; 8B62 := 0; 8B65 := 0; 8B63 := 1`; then `8B48 := 0; 8B49 := 0`. p <> FFh: `8B49 := 1; 8B62 := 1`; if `Mem[7EE1] = FFh`: `8B63 := 1`; **if p < 78h: load 'PIC' record p into `DS:722C` (LoadAnimation) and draw it at (3,3) (DrawPictureScreenOrView(7232, 7234, 1, 3, 3)); else `LoadBigPic(p)` + `DrawBigPic` = BIGPIC load + draw (BIGPIC ids 120..123 = 78h..7Bh, cab-data BIGPIC.md), `DS:7580 := 0`**; else `ShowHeadBodyPicture(p, Mem[7EE1])` (ShowHeadBodyPicture: HEAD id 7EE1, BODY id p). **Delta vs Pool:** the >= 78h BIGPIC branch and no frame drawing. | H dec |
| 1C | CLEARMONSTERS | 120E | 0 | `PC+1; DS:47E6 := 0; 8B69 := 0; 7603 := 8`; `FillChar(DS:6F70, 1Ch, 0)` (treasure money, 7 longints); free the treasure item list `DS:6F8C` (3Fh-byte nodes, next `+2Ah`) | H dec (= Pool, new DS) |
| 24 | COMBAT | 179A | 0 | `PC+1`. No monsters (`8B69 = 0 and 8B56 = 0`): `Mem[7F6C] = 1` -> `7F6C := 0`, shop (ov06_0000, Shop); elif `Mem[7EE2] = 1` -> `7EE2 := 0`, temple (ov04_LoadDeps, Temple); else `ov05_LoadDeps; AfterCombat` (after-combat / treasure screen, M); then if not 3D: `ov27_0000` (2D backdrop) else `ov30_LoadDeps` (3D redraw). Monsters: combat unit inits `ov08_LoadDeps, ov10_LoadDeps, ov09_LoadDeps, ov13_LoadDeps, ov32_0000, ov31_0000`; `Mem[7EC1] := min(7EC1, ApproachDistance)`; **`CombatMain` = the combat**; `ov05_LoadDeps; AfterCombat`; not 3D: `ov27_0000` + BIGPIC 79h (`LoadBigPic(79h)`) else `ov30_LoadDeps`; `8B56 := 0`. Then `DS:4FBA := 3` if not 3D else 4; `Mem[7ECA] := 7ECA and 1`; clear `8B48..49`, `8B62`; `RedrawCurrentMode` (redraw by view mode). Every unit switch is bracketed by `PlayOrStopSound(DS:25AA)` / `StartSound` when `DS:5BEC` (video-mode save/restore, M). **Delta vs Pool (349 B -> 769 B):** the video-mode brackets and the BIGPIC backdrop. | H dec (callee roles M) |
| 27 | TREASURE | 1B53 | 8 | `DS:6F70[i] := (v(i+1), 0)` for i = 0..6 (money pool, 7 longints); `t := v(8)`: `t < 80h`: `LoadDaxRecord('ITEM'+Str(5BEE)+'.dax', t)` (abort "Unable to find item file" (2200:1B3A) if size 0); prepend each 3Fh-byte item to the treasure list `DS:6F8C`; `80h <= t < FFh`: generate `t-80h` random items: `r := Roll(100, 1)` (Roll): `1..3Ch` -> second roll d100 -> type (1..2Fh: itself (2Dh -> 3Bh); 30h..3Bh: itself; 3Ch..5Ah: d10 -> 24h/23h/22h/25h/26h; 5Bh..5Eh: 49h; 5Fh..61h: 5Dh; 62h..64h: 4Dh; else 3Bh); `3Dh..55h` -> 3Dh; `56h..5Ch` -> 3Eh; `5Bh..62h` -> d15 -> 47h/54h/4Fh; `63h..64h` -> 3Bh (quirk: rolls 0 and some ranges leave the type unset); `MakeTreasureItem(item, type)` (make the item, 109-way case), prepend; then **every item of the list is named** (`BuildItemName(…, item, SelectedChar)`) — on the random branch only; t = FFh: money only. **Delta vs Pool:** a different random table (Pool: d100/d16/d10 with 48/49 unset). | H dec (table M: read from the compare ladder) |
| 29 | ENCOUNTER MENU | 2086 | 14 | = Pool §4.4 ENCOUNTER MENU (0.93; same menus `~COMBAT ~WAIT ~FLEE ~PARLAY` / `~COMBAT ~WAIT ~FLEE ~ADVANCE`, texts "Both sides wait.", "The monsters flee."; helpers PartyMoveRange party move range, ApproachDistance, ShowEncounter, MenuSelect MenuSelect); outcome table = Pool's; result 0 = monsters fled, 1 = combat, 2 = party fled, 3 = parlay | M dec (spot check of strings/callees; the +79 B are list offsets) |
| 2C | PARLAY | 27A8 | 6 | `resp[0..4] := v(1..5)`; `k := MenuSelect('~HAUGHTY ~SLY ~NICE ~MEEK ~ABUSIVE')`; `SetMem(a(6), resp[k])` | H = Pool (1.00) |
| 31 | SPRITE OFF | 2C8F | 0 | `PC+1`; if `DS:8B65`: `7580 := 1`, RefreshView, `8B65 := 0, 8B62 := 0` | H dec (= Pool) |

### 4.5 Engine calls, data loading

| op | SSI name | handler | n | semantics | conf |
|---|---|---|---|---|---|
| 20 | NEWECL | 0BBB | 1 | `Mem[4BF2] := DS:8B5E` (previous block); `8B5E := byte(v(1))`; `LoadEclBlock(8B5E)`; `ecl_InitVM`; `ecl_Stop := true (47E0); Restart := true (47E1)`; `FillChar(DS:8B48, 2, 0)`. **Delta vs Pool:** no "Insert disk" check (Pool's ov17_22D5) — the game installs on one drive. | H dec |
| 21 | LOAD FILES | 0C15 | 3 | `b1,b2,b3 := v(1..3)`; `DS:47E3 := 1; 47E5 := 1`; if b1 not in {FFh, 7Fh} and 3D: `Mem[4BC5] := b1; Load3DMap(b1)` (Load3DMap "Unable to load geo in Load3DMap."); `Mem[7EC9] := 0`; if b3 <> FFh and not 3D and `DS:728A <> 'P'`: **BIGPIC 79h** (`LoadBigPic(79h)`, the 2D backdrop; Pool loaded 'BACPAC'); b2 unused | H dec |
| 37 | LOAD PIECES | 0C15 | 3 | `DS:47E3 := 1; 47E4 := 1`; b1 = 7Fh: `LoadWallSet(1, 0)`; elif `Mem[4BE7] = 0 or Mem[4BE8] = 0`: for slot 1..3: b(slot) <> FFh -> `LoadWallSet(slot, b)` (LoadWallSet), FFh -> `DS:7210+4*slot := FFFFh, 7212+4*slot := FFFFh`; else `LoadWallSet(1, b1); LoadWallSet(3, b3)`. After either 21/37: if `47E4 and 47E5 and DS:4FBB = 3`: (if `4FBA <> 3 and 8B6E`: clear box, party summary, status) `8B6E := 0` | H dec (= Pool §4.5 incl. the 4BE7/4BE8 condition = Pool 49E7/49E8) |
| 2D | CALL | 2F02 | 1 | `t := a(1)` selects an engine routine: **2E10h**: `DS:7213 := GetCellAttr(y, x)` (GetCellAttr); if `47E3` and a redraw flag (8B62/8B65/8B67/8B68/8B6A): `7580 := 1`, RefreshView, status (DrawLocationTimeStatus), clear the flags, `7212 := WallTypeAhead(dir, y, x)` (GetWallType). **8000h / 8001h**: `SetupDuel(1)` / `SetupDuel(0)` (SetupDuel). **B200h**: `PlayOrStopSound(DS:25C2)` if `DS:8B4C = 10` else `PlayOrStopSound(DS:25C0)` (mode/sound call selected by the region-4 cell 03DE, M). **C01Eh**: `StepForward` (StepForward). **C018h**: if not 3D: `7212 := WallTypeAhead`. **6803h (new)**: draw picture slot `DS:722D` of the `DS:722C` set (`DrawPictureScreenOrView(DS:722A[722D*4], DS:722C[722D*8], 1, 3, 3)`), `722D += 1` wrapping to 1 after `722C`, `MessageDelay` delay = **one animation frame** (used 11x by ECL1/82, the title/intro script). Others: nothing. Data uses only 2E10h (124), B200h (19), C01Eh (13), 6803h (11): §7. **Delta vs Pool:** ids 2C90h/BA03h became 2E10h/B200h, 6803h added. | H dec |
| 38 | PROGRAM | 30DD | 1 | if `47E2`: restore SelectedChar; `p := v(1)`: **0** -> `ov17_0000` (title/start) + `PartyCreationMenu` (the "Choose a function" menu), then status redraw unless `DS:728A = 'P'` or 3D; **8** (won) -> `EndSequence` (end sequence), `DS:8B6F := 1; Mem[4CFD] := FFh; Mem[7EA8] := FFh`; every member: `c+1A4h := c+78h` (hp := max, M), `c+195h := 0; c+196h := 1` (healed, active); `PartyCreationMenu`; prompt "You've won. Save before quitting? " (2200:30BA, AskYesNo) 'Y' -> `SaveGame` (save game); `TerminateGame` (halt); **9** -> camp: save PC, `ov15_LoadDeps`, `ecl_CampCheck` (3073), restore PC, call the EXIT handler; **3 (new)** -> `PartyDead (4FC7) := 1`, EXIT handler (= party killed, used by ECL5/53). **Delta vs Pool:** ids 3 and the "won" sequence. Data uses 0 (4x), 3 (1x), 8 (1x), 9 (7x). | H dec |

### 4.6 The three new opcodes and PROTECTION (H dec unless noted)

| op | SSI name | handler | n | semantics |
|---|---|---|---|---|
| 3C | PROTECTION | 321F | 1 | `FillChar(DS:8B48, 2, 0); 8B62 := 0`; `ReadOperands(1)` (**the operand is never used**, data passes `[7F79]`); `RuneWheelCheck` = the rune-wheel check (§8); `RedrawCurrentMode` (redraw by view mode). Pool's 3C (PRINT_MEM, glyph printer) does not exist in Curse. Used once: ECL1/80 @9B6F after "WHAT DOES THIS MEAN?", then "YOU MAY PASS." |
| 3E | DUMP | 3251 | 0 | `PC+1`; `RemovePartyMember(1, 0)` = **remove the selected character from the party list** (dec: unlink `DS:6506` from `DS:650A`, free its icon slot `+143h` (ov33 entry 4), `FreeCharacter` (free record), `Mem[7F3E] -= 1` (member count) since the 2nd argument is 0); `DS:47E7 := SelectedChar` (the list head / next member becomes selected); `PartySummary` (party summary). Used 5x after an NPC story ("DUMP" = the NPC leaves). |
| 3F | FIND SPECIAL | 3284 | 1 | `FillChar(DS:75F8, 6, 0)`; `id := v(1)`; `if HasEffect(SelectedChar, id) (HasEffect) then EQ := 1 else NE := 1`. Used 2x (ECL5/50, `#14`). |
| 40 | DESTROY ITEMS | 32D8 | 1 | `id := v(1)`; for every member c (`DS:650A`, `+189h`): for every item (`+14Dh`, `+2Ah`): if `item+2Eh = id` then `LoseItem(item, c)` (unlink + FreeMem 3Fh; "Tried to Lose item & couldn't find it!" if absent); then `RecalcItems(c)` (recompute item slots/weight). Used 13x with ids 5Eh, 60h, 61h (the bond-related items handed over, M). |

---------------------------------------------------------------------------------------------------------
## 5. How the engine calls into the VM — H (dec ecl_GameLoop, ecl_RunAfterNewBlock, ecl_CampCheck)

Record layout: `[2 bytes, skipped by LoadEclBlock]` + script, loaded at 8000h. The header is `88 13` (= 5000) in
all 25 records; the engine never reads it (`Move(rec[2], ...)`; the `size < 2` retry loop only guards the length):
**meaning unknown** (same value as Pool's records). The script starts with **five GOTO instructions** (`01 01 lo hi`,
20 bytes); `ecl_InitVM` reads their operands as vectors:

| vector | DS | run by | when |
|---|---|---|---|
| A | 4FAA | game loop | every adventure command that is not Encamp and not a search/look state, **before** the move |
| B | 4FAC | game loop | **after** the move; also with `Mem[7ECA] := 1` when the input routine left a search/look state (`7ECA > 1`), restoring it afterwards |
| C | 4FAE | `ecl_CampCheck` | on the Encamp key ('E') before the camp menu (ov15_LoadDeps / Camp) |
| D | 4FB0 | `ecl_CampCheck` | after the camp menu if it reported a rest |
| E | 4FB2 | game loop start + after every NEW ECL | block init (load map/walls/pictures, set variables) |

```pascal
procedure ecl_GameLoop;                        { ecl_GameLoop }
begin
  DS:47E7 := SelectedChar; 7580 := 1; 8B64 := 0; 47E4 := 0; 47E5 := 0; 47E2 := 0; 47E3 := 0; 8B6E := 1;
  ViewMode (4FBA) := 4; Restart (47E1) := false;
  if Mem[4BF2] = 0 then begin 8B6E := 0; if not Demo (4FBC) then begin Block (8B5E) := 1; party summary end
                                           else Block := 52h end           { demo starts in block 82 of ECL1 }
  else Block := Mem[4BF2];
  if Mem[4BE6] = 0 then ViewMode := 3;
  if (not Resuming (4FC2)) or (Mem[4BF2] = 0) then LoadEclBlock(Block) else 47E3 := 1;
  ecl_InitVM;  ecl_Run(vecE);
  if Demo then begin repeat RemovePartyMember(1, 1) until party list empty; exit end;   { demo: drop everyone, return }
  if not Restart then Mem[4BF2] := Block else ecl_RunAfterNewBlock;
  if (ViewMode <> 3) and Resuming then begin if 8B6E = 1 then RedrawCurrentMode; 7580 := 1; RefreshView end;
  Resuming := false;
  repeat
    key := ExploreCommand;                          { adventure command input }
    DS:47E7 := SelectedChar;  if not Restart then Mem[4BF2] := Block;
    while ((Mem[7ECA] > 1) or (UpCase(key) = 'E')) and not PartyDead do begin
      if UpCase(key) = 'E' then begin ov15_LoadDeps; ecl_CampCheck end
      else begin save := 7ECA and 1; Mem[7ECA] := 1; 7580 := 1; RefreshView; ecl_Run(vecB);
                 if Restart then ecl_RunAfterNewBlock; Mem[7ECA] := save end;
      if not PartyDead then begin key := ExploreCommand; DS:47E7 := SelectedChar end
    end;
    if not PartyDead then ecl_Run(vecA);
    if Restart then ecl_RunAfterNewBlock
    else if not PartyDead then begin
      Mem[4BF0] := X; Mem[4BF1] := Y; MoveParty (move/door handling); RefreshView;
      if (X, Y) changed (or negative) then PlayOrStopSound(DS:25C0) (step sound);
      8B62 := 0; 8B63 := 1; ecl_Run(vecB); if Restart then ecl_RunAfterNewBlock
    end
  until PartyDead;
  PartyDead := false;
end;
```
`ecl_RunAfterNewBlock` (ecl_RunAfterNewBlock): repeat { `FreeAnimation(&DS:722C)` (release pictures); `DS:7281 := 0; 728B := FFh;
Restart := false`; `7213 := GetCellAttr`; `Mem[7ED5] := 0`; `47E7 := SelectedChar`; `ecl_Run(vecE)`; if not Restart:
`Mem[4BF2] := Block`; redraw (RefreshView when the view mode changed or `47E3`); `ecl_Run(vecA)`; if not Restart:
`ecl_Run(vecB)`; if still not Restart: restore SelectedChar and redraw the party summary } until not Restart;
`DS:4FBB := 4FBA`. `ecl_CampCheck` (ecl_CampCheck): `ov15_LoadDeps`; `ecl_Run(vecC)`; `Camp(var rested)` (camp menu);
if rested: `RedrawCurrentMode; ecl_Run(vecD)`; `7580 := 1; RefreshView; DS:5CF1 := 0`.

---------------------------------------------------------------------------------------------------------
## 6. VM state summary

| DS | name | meaning |
|---|---|---|
| 4FA5 | ecl_CodeBuf | far ptr, 1E00h-byte script buffer (VM 8000..9DFF) |
| 4F99 / 4F9D / 4FA1 | ecl_Mem4B00 / 7C00 / 7A00 | far ptrs to the 3 word arrays (saved with the game) |
| 4FB4 | ecl_PC | |
| 4FAA..4FB2 | ecl_VecA..E | |
| 75FF / 75FE | ecl_CurOp / LastOp | |
| 75F8..75FD | flags EQ NE LT GT LE GE | |
| 7685/76C5/7705 (+i) | OpType/OpHi/OpLo[i] | arrays 40h apart: more than 64 operands would overlap; max in data = 45 ON GOTO targets + 2 |
| 7648 + k*100h | Str[k] | string slots |
| 75F0 | ecl_GosubSP | linked stack on the heap (no depth limit; freed by EXIT) |
| 47E0 / 47E1 | Stop / Restart | |
| 4FC7 | PartyDead | ends ecl_Run and the game loop; set by PROGRAM 3 and DAMAGE |
| 4FC1 | TraceFlag | prints every opcode name (ecl_OpcodeName) |
| 4FC2 | Resuming | a save is being resumed (InitVM keeps the block-local cells) |
| 4FBA / 4FBB | ViewMode / previous | 3 = 2D (not 3D), 4 = 3D, 0/1/2/6 other screens (RedrawCurrentMode) |
| 4FBC | Demo | 'D' at the "Play Demo" prompt |
| 8B5E | current ECL block number (record id) | |
| 5BEE | current data set (file digit of ECLn/GEOn/ITEMn...) | |
| 47E6, 7603, 8B69 | monster count / next CPIC slot (starts 8) / monsters-present flag | |
| 6506 / 650A | SelectedChar / party list head | |
| 47E7 | saved SelectedChar (restored by EXIT when 47E2) | |
| 8B48, 8B49, 8B62..8B6A | display state flags (sprite shown, picture shown, redraw requests) | M |
| 6F70 / 6F8C | treasure money (7 longints) / treasure item list | |
| 7580 | RefreshView request (RefreshView) | M |

---------------------------------------------------------------------------------------------------------
## 7. Usage in the shipped scripts — `python decode/tools/ecldis.py --all` (`decode/ecl/scripts/INDEX.md`)

25 records (ECL1 80,81,82; ECL2 1..4; ECL3 16,17,18,21; ECL4 32,33,34,35,37; ECL5 48,49,50,51,53; ECL6 64,66,67,69),
recursive traversal from the 5 vectors (IF: both successors; ON GOTO/GOSUB tables; data tables named by
GET TABLE/SAVE TABLE are not executed). **138,255 script bytes, 14,163 instructions, 0 undecodable operands, 0
unhandled opcodes reached; 61 distinct opcodes occur** (all handlers except 0F INPUT NUMBER, 22 PARTY SURPRISE,
23 SURPRISE). Coverage: **134,131 bytes decoded as header/instructions (97.0%)**, 4,124 bytes listed as `db` (data
tables, text after an ON GOTO whose selector is always in range, and the 1 trailing byte most records end with);
per record 79.2% (ECL5/53, 49 data tables) .. 100.0%. Counts: EXIT 651, GOTO 1777, GOSUB 1087, COMPARE 1240, ADD 364,
SUBTRACT 63, DIVIDE 6, MULTIPLY 24, RANDOM 174, SAVE 1913, LOAD CHARACTER 42, LOAD MONSTER 276, SETUP MONSTER 197,
APPROACH 20, PICTURE 199, INPUT STRING 5, PRINT 1310, PRINTCLEAR 1053, RETURN 268, COMPARE AND 66, VERTICAL MENU 22,
IF = 789, IF <> 442, IF < 87, IF > 216, IF <= 25, IF >= 64, CLEARMONSTERS 206, PARTYSTRENGTH 2, CHECKPARTY 1, NEWECL 61,
LOAD FILES 22, COMBAT 199, ON GOTO 179, ON GOSUB 6, TREASURE 63, ROB 10, ENCOUNTER MENU 21, GETTABLE 151, HORIZONTAL
MENU 156, PARLAY 15, CALL 167, DAMAGE 24, AND 161, OR 13, SPRITE OFF 3, FIND ITEM 8, PRINT RETURN 120, ECL CLOCK 2,
SAVE TABLE 8, ADD NPC 9, LOAD PIECES 23, PROGRAM 13, WHO 7, DELAY 87, SPELL 2, PROTECTION 1, CLEAR BOX 17, DUMP 5,
FIND SPECIAL 2, DESTROY ITEMS 13. Operand-type matrix, CALL ids and the CHECK PARTY/PROTECTION sites: INDEX.md.

Static-only caveat (as Pool): bytes after an ON GOTO whose selector is always in range are not followed; the
listings show unreached bytes as `db`.

---------------------------------------------------------------------------------------------------------
## 8. Copy protection — op 3C PROTECTION and the rune translation wheel (RuneWheelCheck, 2600:011A) — H

Called (a) by op 3C (ECL1/80 @9B6F: "WHAT IS YOUR FAVORITE FRUIT?" / INPUT STRING / "WHAT DOES THIS MEAN?" /
PROTECTION / "YOU MAY PASS.") and (b) by the main program before the first game screen when not in demo mode
(`main_0000`, `stub_ov03_e1`). Tiles: `TILES.DAX` record 1 = 26 **espruar** tiles, record 2 = 22 **dethek** tiles
(cab-data `decode/data/TILES.md`), loaded as one 48-slot set (`Load24x24Set(1Ah, 0, 1, 'tiles')`, `(16h, 1Ah, 2, 'tiles')`).

```pascal
function RuneCheck: boolean;                         { RuneWheelCheck; asm cited in decode/ecl/runewheel.py }
begin
  Load24x24Set(1, 0, 26, 'tiles'); Load24x24Set(2, 26, 22, 'tiles'); ClearBox;
  Print(2,3 "Align the espruar and dethek runes"); Print(3,3 "shown below, on translation wheel"); Print(4,3 "like this:");
  attempts := 0;
  repeat                                              { 2600:01C4 }
    e := Random(26); d := Random(22);                 { [bp-6], [bp-7] }
    DrawTile(e, 3, 11h); DrawTile(d + 26, 7, 11h);    { DrawTile24: the two runes, side by side }
    path := Random(3);  pathStr := ('-..-..-..', '- - - - -', '.........')[path];
    row := Random(6);   Print(12,3 'Type the character in box number ' + Str(6 - row));
    Print(13,3 'under the '); Print(13,0Eh pathStr); Print(13,19h 'path.');
    pos := (e + 34 - d + path*12 + (5 - row)*2) mod 36;          { 2600:0314..035E }
    expected := DS:[row*37 + pos + 1];                            { 2600:0360..0378: six '$'+36-char rows at DS:0000 }
    typed := ReadBottomLine(1, 0, 13, 'type character and press return: ')[1];   { ' ' if empty }
    Inc(attempts);
    { retail logic, present in the unit but dead in this copy, see below }
    if typed <> expected then Print(14 "Sorry, that's incorrect.");
  until (typed = expected) or (attempts >= 3);
  if attempts >= 3 then begin Mode(DS:25AE); Mode(DS:25B6); DS:4FA9 := 9;
     Print(14 'An unseen force hurls you into the abyss!'); Delay(1000); Halt end   { 2600:0407..0445 }
end;
```
The six answer rows (`python decode/ecl/runewheel.py --table`, bytes at image 0xC1C0 = DS:0000):
```
row 0 (box 6): CWLNRTESSCEDCSHSISERRRNSHSSTSSNNHSHN
row 1 (box 5): LAASRDAIILIDSUGADAEEOEGRLSELIITESOIO
row 2 (box 4): LRUNIMMORIIGRRIUPTIIUELIMLHMIXACGRIL
row 3 (box 3): Z0LIOHEUVNODSGEOGXYWISIOCRARLRARRHOI
row 4 (box 2): AMTELRLUIYNAEOOITOUELRREREUIMADPPFAB
row 5 (box 1): ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890
```
**Oracle answer sheet:** `python decode/ecl/runewheel.py E D PATH BOX` (E = index of the shown espruar tile in
TILES/1, 0..25, D = index of the dethek tile in TILES/2, 0..21 — identify them against cab-data's renders
`decode/data/png/TILES/`; PATH 0/1/2 as printed; BOX as printed) prints the expected character; `--sheet` prints
every combination. Example: e=0, d=0, path 0, box 1 -> '9'; e=25, d=21, path 2, box 6 -> 'C'.

**Finding (H, bytes): this copy's check is disabled by a one-byte patch.** At 2600:03CE the instruction after
`CMP AL,[bp-3]` (typed vs expected) is `EB 1C` = `JMP 03EC` -> `JMP 0446` = return, unconditionally; the bytes
2600:03D0..03EB ("Sorry, that's incorrect." print) and 03EE..0445 (re-compare, retry loop back to 01C4 while
`attempts <= 2`, then the abyss/halt sequence) are never executed — Ghidra lists them as undefined, capstone shows the
retail flow above. A `74 1C` (JZ) at 03CE gives exactly the retail behaviour (3 tries, then abort). GAME.OVR file
offset of the byte: 0x4688 + 0x3CE = **0x4A56** (`EB`). The ECL op 3C and the startup call are therefore no-ops that
only show the prompt and accept any key in the files at hand. For the Plus build: implement the retail check behind
the copy-protection flag with the formula above (bypass = default per FOREMAN.md); for the DOSBox oracle on this copy
any character passes (type anything); on a retail copy use the sheet. Whether this is SSI's shipped v1.0 or a cracked
master is **unknown** (cab-data's DOSBox run did not reach the prompt; the installer batch files do not patch).

---------------------------------------------------------------------------------------------------------
## 9. Cross-check vs simeonpilgrim/coab (oracle only; read in a scratch clone, nothing copied) — H for what is stated

coab (`engine/ovr003.cs` CommandTable, `CMD_*`; `engine/ovr004.cs copy_protection`) is a C# port of this EXE.
- **Agrees** with this spec: the opcode set 00..40h with 1Fh "notsure" (coab gives 1F 2 operands = our skip-table count),
  every name (coab uses SSI's names: "LOAD CHARACTER", "PROTECTION", "DUMP", "FIND SPECIAL", "DESTROY ITEMS"), the fixed
  operand counts for every opcode including **ECL CLOCK = 1 in coab vs 2 here** (coab's table says 1; its
  `CMD_EclClock` body is the thing to compare — the binary reads `ReadOperands(2)` at 2200:2CB5, asm `MOV AL,2; PUSH AX;
  CALLF ecl_ReadOperands`, so the handler count is 2 and the skip-table count is 1; coab's single count collapses the two),
  VERTICAL/HORIZONTAL MENU and ON GOTO/GOSUB as 0 fixed + variable (coab counts the variable part itself), the script
  base 8000h (`gbl.ecl_ptr[gbl.ecl_offset + 0x8000]`), `EclBlock` size 1E00h, CMD_Protection = clear two encounter
  flags + sprite flag, `vm_LoadCmdSets(1)`, copy_protection, LoadPic (= our 3C body), CMD_Dump = `FreeCurrentPlayer(sel,
  true, false)` + party summary (= RemovePartyMember(1,0) + PartySummary), CMD_FindSpecial = clear 6 flags, `HasAffect` -> flag 0/1
  (= ours), the rune check: `Random(26)`, `Random(22)`, `Random(3)`, `Random(6)`, `index = e + 0x22 - d + path*12 +
  ((5-row) << 1)` wrapped into 0..35, `codeWheel[row][index]`, 3 attempts then "An unseen force hurls you into the
  abyss!", `SysDelay(0x3E8)` and exit — **identical to our decode**, and coab implements the conditional (its IDA base
  had the retail branch or the author restored it: supports the one-byte-patch reading of our copy).
- **Differs / binary-only here:** coab has no notion of the skip-table mismatches (34h, 36h, 15h/25h/26h/2Bh), the
  CHECK PARTY 7FFFh bug, the DIVIDE remainder cell 7F3Fh, the RETURN-on-empty-stack = EXIT behaviour, the trace flag,
  or the disabled check in this copy; those are facts of the bytes. coab's `SkipCopyProtection` setting defaults to
  true (its own choice, not evidence).
- Not compared (out of gate scope): coab's per-handler semantics for 0B/0E/24/27/29/2E and its memory-overlay table;
  the module lanes may use `engine/ovr003.cs` as an oracle per handler.

---------------------------------------------------------------------------------------------------------
## 10. Unknowns (explicit)
- The 2-byte record header `88 13` (ignored by the engine).
- Names/roles of the character fields read through the overlay (§3.1: +13h, +19h, +74h, +E0h, +E5h, +10Eh/+116h,
  +119h, +13Ch, +13Eh, +192h) and of `DS:8B4C`-selected modes in CALL B200h; the exact meaning of the 7 clock counters
  (ECL CLOCK uses counter 4 with the count from `Mem[4C06]`); `DS:728A = 'P'` (a display-mode letter, M).
- The item ids 5Eh/60h/61h destroyed by DESTROY ITEMS and effect id 14h of FIND SPECIAL (cab-data ITEMS.md / effects).
- Whether the retail v1.0 shipped with the rune check enabled (§8).
- Region-4 reads of unlisted addresses return an uninitialised local (garbage); none of the 25 scripts reads one
  (the only region-4 cells in the listings are C04B..C04F, 033D, 03DE, 00B1, 00FB/00FC, 00B8/00B9).
