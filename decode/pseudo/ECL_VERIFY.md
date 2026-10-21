# ECL — independent verification (cab-verify, cab-rt / Opus)

Verified file: `decode/pseudo/ECL.pas.md` at 0017788 (SHA-256 prefix `3f4768b5297c95e9`; 102 anchored statements in
```pascal blocks — §2 loop routines and §3 tracer — plus the 52-row handler index of §1) and `decode/pseudo/ECL_SCREENS.md`
(9 screens + region table). Author lane: cab-mod-eclview (Fable). The handler bodies live in `decode/ecl/ECL_VM.md`
(spec of record, not part of this area file); only the §1 index into it was checked. The area file was not edited;
DISAGREEs are fix requests in STATUS.md (`ECL fix request #verify-45`, `#verify-46`).

## Summary

| check | result |
|---|---|
| argcheck (fresh run, `--out` scratch) | 93 calls, **0 MISMATCH**, 71 OK, 22 UNSURE |
| anchorcheck | 229 anchors, **18 bad** (not instruction starts) — DISAGREE #verify-45 |
| 10 % sample (11 statements, seed `"1989ECL"`) | **11 AGREE, 0 DISAGREE, 0 UNSURE** |
| §1 handler index (all 52 rows) | every address is a function start in `functions.tsv` with the same name, and every `ReadOperands` count equals the `MOV AL,n` before the handler's first `ecl_ReadOperands` call (`—` rows have none) — 52 / 52 agree |
| sweeps | clean (details below) |
| SCREENS | 6 addresses, 1 not an instruction start (ECL-09 `6800:04fd`) — DISAGREE #verify-46; texts: all literal fragments found (script-side texts such as the encounter menu come from the ECL data, not the EXE) |
| fix requests posted | **2** (#verify-45, #verify-46) |

## Method

`python -I decode/tools/pseudo_check.py ECL --after 9` (seed `"1989ECL"`, 102 statements -> 11), each read against
`decode/listings/ov02.lst` / `ov34.lst`; the handler index checked by script against `functions.tsv` and the
operand-count immediate; sweeps as in COMBAT_VERIFY.md.

## Sweep results

| class | result |
|---|---|
| call-argument order | argcheck 0 MISMATCH (93 calls) |
| signed vs unsigned | 0 statements with a signed jump after a byte compare and no signed marker in the Pascal |
| byte vs word | the one VM cell read as a byte (2200:37e5 `MOV AL,ES:[DI+1E4h]`) is written `Lo(Mem[4BF2])` — agree; `Mem[4BF2] := ecl_Block` stores a word (XOR AH,AH / MOV word) — agree |
| folded constant index | none (ecl_VecA..E are scalars g_4FAA..4FB2, as written) |
| Abs / set tests | none in the anchored statements |
| string length byte | none |
| cite anchors | **18 anchors inside an instruction** (§1 table and L120); each with the containing instruction and the next start: 0116 (in 0115 CALLF ecl_Gosub -> 0115), 0124 (in 0121 SUB SP -> 0125), 0211 (in 0210 MOV [BP-9],AX -> 0210), 0472 (in 0471 -> 0473), 0978 (in 0975 SUB SP -> 0979), 09f0 (in 09ed -> 09f1), 0ec3 (in 0ec0 -> 0ec4), 0f1b (in 0f17 CALLF ecl_ReadOperands -> 0f17), 1b59 (in 1b56 -> 1b5a), 208c (in 2089 -> 208d), 1088 (in 1085 -> 1089), 10be (in 10bc CALLF ecl_ReadOperands -> 10bc), 27ae (in 27ab -> 27af), 30f9 (in 30f7 MOV [47E2],0 -> 30f7 / 30fc), 2d64 (in 2d61 -> 2d65), 2e1e (in 2e1c -> 2e1c), 329c (in 329b MOV AL,1 -> 329b), 3097 (L120, in 3094 CMP [BP-1],0 -> 3094). The pattern (byte 3 or 4 of `SUB SP,imm16`) suggests C-export statement addresses that were not snapped (COMBAT / MAGIC snapped theirs) |
| Curse text routines (bg colour) | no text-routine calls in the anchored statements |
| GetPicture / PutPicture | none |
| string literals | 63 literals (§3 opcode names etc.), all present in the binary as Pascal strings |

Note (naming, not a disagreement): `g_7281` / `g_728B` (L131) are now `camp_AnimName` / `camp_AnimId` (MAGIC lane,
globals request #3); the listing shows `ecl_Restart` (47E1) and `PartyDead` (4FC7) as `g_47E1` / `g_4FC7` because no
names file registers them yet (ECL_VM.md §6 names them).

## SCREENS check

ECL-01 .. ECL-09 and the region table: addresses 2200:3772, 2200:3691, 2200:09EA, 2200:3073, 0542:04A4 are
instruction starts; **ECL-09** cites `HorizontalMenu 6800:04fd` for the `Mem[4CFF]` auto-advance, but 6800:04fd lies
inside `ADD AX,1Eh` (6800:04fb); the `Mem[4CFF]` test is 6800:0507 / 050b (`CMP word ptr ES:[DI+3FEh],0`). DISAGREE
(#verify-46). The PRINT / menu texts are script data (decode/ecl/scripts/), so only the EXE-side strings were compared;
no acceptance/ref capture covers ECL.

## Sample table

Seed `"1989ECL"`, 11 of 102 statements. Line = ECL.pas.md line.

| line | address | statement | verdict | evidence |
|---|---|---|---|---|
| L84 | 2200:34ef | `$24: ecl_op24_Combat;  $25, $26: ecl_op25_OnGotoGosub;  $27: ecl_op27_Treasure;  $28: ecl_op28_Rob;` | AGREE | asm matches |
| L85 | 2200:3524 | `$29: ecl_op29_EncounterMenu;  $2A: ecl_op2A_GetTable;  $2B: ecl_op2B_HorizontalMenu;  $2C: ecl_op2C_Parlay;` | AGREE | asm matches |
| L88 | 2200:35b7 | `$36: ecl_op36_AddNpc;  $38: ecl_op38_Program;  $39: ecl_op39_Who;  $3A: ecl_op3A_Delay;` | AGREE | asm matches |
| L89 | 2200:35e3 | `$3B: ecl_op3B_Spell;  $3C: ecl_op3C_Protection;  $3D: ecl_op3D_ClearBox;` | AGREE | asm matches |
| L109 | 2200:3686 | `ecl_Stop := false;` | AGREE | asm matches |
| L132 | 2200:36a8 | `ecl_Restart := false;` | AGREE | (47E1 = ecl_Restart) |
| L137 | 2200:36dd | `if not ecl_Restart then Mem[4BF2] := ecl_Block;` | AGREE | (4B00 + 1E4h/2 = 4BF2) |
| L152 | 2200:3768 | `view_PrevMode := view_Mode;` | AGREE | asm matches |
| L165 | 2200:37ca | `else ecl_Block := $52;` | AGREE | asm matches |
| L176 | 2200:3850 | `if not ecl_Restart then Mem[4BF2] := ecl_Block` | AGREE | asm matches |
| L199 | 2200:395d | `if not PartyDead then ecl_Run(ecl_VecA);` | AGREE | (4FC7 = PartyDead, 4FAA = ecl_VecA) |
