# ENGINE — verification (lane cab-verify-fable, 2026-10-20)

Area file: `decode/pseudo/ENGINE.pas.md` (author cab-rt; ov00, ov01, ov03, ov11, ov16, ov17; 1035 lines) and `ENGINE_SCREENS.md` (33 rows). Verified per `herdr/assignments/cab-verify.md`: fresh argcheck, a seeded 10 % sample re-read against the listings, targeted sweeps over the whole area, every SCREENS row against the code and against the `acceptance/ref` title captures. The area file was not edited; the fix requests are in STATUS.md (`ENGINE fix request #verify-n`).

## Summary

| check | result |
|---|---|
| argcheck (`python -I decode/tools/argcheck.py ENGINE`, output to scratch) | 403 calls: OK 58, **MISMATCH 0**, UNSURE 345 |
| anchorcheck (`decode/tools/anchorcheck.py decode/pseudo/ENGINE.pas.md`) | 681 anchors, **0 bad** |
| sample (`pseudo_check.py ENGINE`, seed `1989ENGINE`) | 506 anchored statements, 51 sampled: **AGREE 47**, **DISAGREE 3**, UNSURE 1 |
| sweeps | 1 further disagreement (the new-character hit-point formula, 4800:21ef–2266); coverage notes |
| SCREENS | 33 rows, 33 agree with the code; ENGINE-02 agrees with the REF-TITLE-1 capture (0 pixels differ) |
| fix requests | **4** (#verify-1 WriteCharacter argument order, #verify-2 Close(f) anchor, #verify-3 else-if anchor, #verify-4 hit-point formula) |

## Sample

Method: `python -I decode/tools/pseudo_check.py ENGINE` (default seed `random.seed('1989ENGINE')`, 10 % of the 506 anchored statements). Each statement was re-read against the instructions at its anchor in `decode/listings/ov00|01|03|11|16|17.lst` (operand sizes and offsets, constants, push order, branch sense, signedness); for the three WriteCharacter sites the callee body was read as well.

Verdicts: AGREE = statement, operands and constants match the code at the anchor; DISAGREE = the code says something else (→ fix request); UNSURE = not decidable from the listing.

| line | anchor | statement | verdict | evidence |
|---|---|---|---|---|
| L38 | 2000:001d | `ShowBottomPromptAndReadKey($0E, 0, 'Time to save your game');` | AGREE | 001d MOV AL,0Eh; PUSH; MOV AL,0; PUSH; LEA DI (string copy of 'Time to save your game' at CS:0028); CALL ShowBottomPromptAndReadKey — (fg, bg, s) |
| L77 | 2100:024a | `DrawText($14, $2, $A, $0, 'and');` | AGREE | 024a PUSH 14h, 2, 0Ah, 0, 'and' (CS:025b); DrawText |
| L97 | 2100:04ca | `DrawText($16, $B, $E, $0, 'graphic arts:');` | AGREE | 04ca PUSH 16h, 0Bh, 0Eh, 0, 'graphic arts:' (CS:04db) |
| L98 | 2100:04ea | `DrawText($16, $C, $B, $0, 'tom wahl');` | AGREE | 04ea PUSH 16h, 0Ch, 0Bh, 0, 'tom wahl' (CS:04fb) |
| L126 | 2100:0736 | `PutPicture(0, $0B, pic);` | AGREE | 0736 PUSH 0; PUSH 0Bh; PUSH [BP-2],[BP-4] (pic far pointer); CALLF PutPicture — (col, row, pic) |
| L161 | 2600:0160 | `DrawText(3, 2, $0A, 0, 'Align the espruar and dethek runes');` | AGREE | 0160 PUSH 3, 2, 0Ah, 0, 'Align the espruar and dethek runes' (CS:0171) |
| L165 | 2600:01c4 | `repeat` | AGREE | 01c4 MOV AX,1Ah; CALLF RandomWord → byte local; 01d0 RandomWord(16h) — loop head of the rune draw as written |
| L170 | 2600:020a | `path := Random(3);` | AGREE | 020a PUSH 3; CALLF System.RandomWord; MOV [BP-14h],AL; then CMP 0 / 1 / 2 selects the three path strings (CS:0220 '-..-..-..', 023a, 0254) |
| L253 | 3500:0193 | `FillChar(view_SpanFirst, $150, $FF);` | AGREE | 0193 PUSH DS:51F8 (view_SpanFirst); PUSH 150h; PUSH 0FFh; CALLF FillChar |
| L254 | 3500:01a4 | `FillChar(view_SpanLast, $150, 0);` | AGREE | 01a4 PUSH DS:5348 (view_SpanLast); PUSH 150h; PUSH 0; CALLF FillChar |
| L272 | 3500:0387 | `for g_4A1C := 1 to 2 do begin` | AGREE | 0387 MOV byte [4A1C],1; JMP 0392; 038e INC [4A1C]; ... bound 2 tested at the loop end |
| L273 | 3500:0392 | `Slot[g_4A1C].id := $FF;  Slot[g_4A1C].pic := nil;` | AGREE | 0392 AL = [4A1C]; MUL 5; MOV byte [DI+7269],0FFh (id of the 5-byte record); 03a3 same index for the pic pointer — records at 7269 + 5*i as written (i = 1 → 726E head_Id, 2 → 7273 body_Id in globals.json) |
| L282 | 3500:0593 | `Load8x8Set($CB, 0);` | AGREE | 0593 PUSH 0CBh; PUSH 0; CALLF Load8x8Set (via stub_ov35_e2) |
| L304 | 3500:03f2 | `party_MapX := 7;  party_MapY := $0D;  party_Dir := 0;` | AGREE | 03f2 MOV byte [720F],7; 03f7 [7210],0Dh; 03fc [7211],0 |
| L305 | 3500:0401 | `FillChar(door_CanBash, 3, 1);` | AGREE | 0401 PUSH DS:7588; PUSH 3; PUSH 1; CALLF FillChar |
| L306 | 3500:0412 | `g_7214 := 0;  g_7216 := 1;` | AGREE | 0412 XOR AX,AX; MOV [7214],AX; 0417 MOV word [7216],1 |
| L319 | 3500:0519 | `g_8C76 := 0;  g_8C77 := 0;  g_4FC8 := 0;` | AGREE | 0519 MOV byte [8C76],0; 051e [8C77],0; 0523 [4FC8],0 |
| L387 | 4300:037b | `Close(f);` | DISAGREE | 037b is `XOR AX,AX; MOV [BP-55h],AX; MOV [BP-53h],AX; MOV [BP-5Dh],AX; MOV [BP-5Bh],AX` = nameEntry := nil; fileEntry := nil (after the two FreeMem at 035f/036d), followed by 038b `if nameEntry <> nil then` (append to the lists). The Close(f) is 4300:041c–0422 (LEA f; CALLF System.CloseFile), just before FindNext 0427. Wrong anchor and the nil assignments / the append test are not in the pseudocode. |
| L400 | 4300:0590 | `2: ScanCharFiles('*.hil', ...table[2]...);` | AGREE | 0590 AL = [7584] ImportSource (= 2 in this case arm); PUSH byte CS:[506+i]; PUSH word CS:[509+2i]; PUSH word CS:[50F+2i]; PUSH names, files; PUSH BP; CALL ScanCharFiles — the three table values are indexed by ImportSource at run time (same values as the written `table[2]`); '*.hil' at CS:0586 |
| L414 | 4300:06c0 | `FindFirst(Copy(SavePath, 1, Length(SavePath)), $10, sr);  err := DosError;` | AGREE | 06c0 LEA tmp; PUSH DS:5BF0 SavePath; PUSH 1; PUSH Length(SavePath) → Copy; PUSH 10h; PUSH sr; CALLF FindFirst |
| L418 | 4300:0717 | `if AskYesNo($0D, $0A, $0F, 'Is your save disk in drive ' + g_5BF1 + ':? ') <> 'Y' then` | AGREE | 0717 StrCopy 'Is your save disk in drive ' (CS:071d); + g_5BF1 char; + ':? ' (CS:073b); AskYesNo(0Dh, 0Ah, 0Fh, s); CMP 'Y' at 0756 |
| L425 | 4300:0805 | `ShowBottomPromptAndReadKey($0E, 0, 'Unexpected error during save: ' + ov24_10CB(err));` | AGREE | 0805 PUSH 0Eh; PUSH 0; StrCopy 'Unexpected error during save: ' (CS:0811) + ov24_10CB(err); ShowBottomPromptAndReadKey |
| L433 | 4300:0867 | `FindFirst(Copy(SavePath, 1, Length(SavePath)), $10, sr);  err := DosError;` | AGREE | 0867 same FindFirst(Copy(SavePath,..), 10h, sr) sequence as 06c0 |
| L453 | 4300:0cf6 | `DeleteFileIfExists(base + '.fx');` | AGREE | 0cf6 StrCopy base; StrAppend '.fx' (CS:0d06); CALLF DeleteFileIfExists |
| L482 | 4300:10b3 | `choice := 'N';` | AGREE | 10b3 MOV byte [BP-0B8h],4Eh ('N') |
| L548 | 4300:27e4 | `else if FindTwinFile('.cha') <> '' then begin` | DISAGREE | 27e4 is the `JMP 2dc6` that ends the previous branch; the else-if starts at 27e7 (LEA; CStringToPascal 27f8 … FindTwinFile('.cha') 280a, compare 281e). Anchor one instruction early. |
| L574 | 4300:3530 | `GetMem(ch, $1A6);` | AGREE | 3530 LEA ch; PUSH 1A6h; CALLF System.GetMem |
| L606 | 4300:39cb | `BlockRead(f, party_MapX, 5);  BlockRead(f, view_PrevMode, 1);  BlockRead(f, view_Mode, 1);` | AGREE | 39cb PUSH f; PUSH DS:720F party_MapX; PUSH 5; CALLF BlockRead; 39e5 view_PrevMode 1; 39ff view_Mode 1 |
| L613 | 4300:3af3 | `for i := 1 to count do begin` | AGREE | 3af3 count → [BP-212h]; MOV AL,1; CMP AL,count; JBE body; INC at 3b0c |
| L636 | 4300:3d1f | `FlushGameKeys;  ClearMenuLine;` | AGREE | 3d1f CALLF FlushGameKeys; 3d24 CALLF ClearMenuLine (via stub_ov26_e4) |
| L651 | 4300:3f3e | `if k = #0 then Exit;` | AGREE | 3f3e CMP byte [BP-1FAh],0; JNZ continue; JMP 7401 (exit) |
| L673 | 4300:415a | `BlockWrite(f, DataSet, 1);` | AGREE | 415a PUSH f; PUSH DS:5BEE (DataSet); PUSH 1; PUSH 0 (no result var); CALLF BlockWrite |
| L675 | 4300:41a4 | `BlockWrite(f, ecl_Mem7A00^, $400);  BlockWrite(f, ecl_CodeBuf^, $1E00);` | AGREE | 41a4 PUSH f; LES ecl_Mem7A00 [4FA1]; PUSH 400h; 41bd ecl_CodeBuf, 1E00h; CALLF BlockWrite |
| L678 | 4300:427a | `count := 0;  ch := PartyList;` | AGREE | 427a MOV byte count,0; 427f LES AX,[650A] PartyList → ch |
| L679 | 4300:428d | `while ch <> nil do begin Inc(count); names[count] := 'CHRDAT' + k + Str(count); ch := ch^.ne...` | AGREE | 428d OR of the two pointer words; JNZ body; 429a INC count; 'CHRDAT' (CS:42c0) + k + Str(count) built below |
| L682 | 4300:436c | `while ch <> nil do begin` | AGREE | 436c OR of the pointer words; JNZ body (4379 INC count) |
| L727 | 4800:01e4 | `savedMode := view_Mode;  view_Mode := 0;` | AGREE | 01e4 MOV AL,[4FBA] view_Mode → [BP-10h]; 01ea MOV byte [4FBA],0 |
| L728 | 4800:01ef | `redraw := true;  g_7587 := 0;` | AGREE | 01ef MOV byte [BP-0Fh],1 (redraw); 01f3 MOV byte [7587],0 (FreeTraining) |
| L731 | 4800:0201 | `DrawScreenFrame;` | AGREE | 0201 CALLF DrawScreenFrame (reached from the `while redraw` test at 01f8) |
| L751 | 4800:0377 | `key := HorizontalMenu('Choose a function ', 'C D M T H V A R L S B E J', $0D, 0, 0, 1, 0, ext);` | AGREE | 0377 StrCopy 'Choose a function ' (CS:037c); PUSH DS:0528 (letter list); then 0Dh, 0, 0, 1, 0, ext; CALLF HorizontalMenu (via stub_ov26_e3); result → [BP-2] at 03a4 |
| L752 | 4800:03a7 | `ClearMenuLine;` | AGREE | 03a7 CALLF ClearMenuLine (via stub_ov26_e4) |
| L766 | 4800:0490 | `'M': if TopMenu[2].on <> 0 then ModifyCharacter;` | AGREE | 048c CMP AL,'M'; 0490 CMP byte [05CE],0 (TopMenu[2].on); JZ skip; CALL ModifyCharacter 0498 |
| L834 | 4800:091e | `key := VerticalListMenu('', 'Select', $0D, $0A, $0F, 1, 2, $26, $16, list, showExit, redraw,...` | AGREE | 091e LES AX,[BP-0Ch] list; index 1; flags 1,1; '' and 'Select' (CS:094a) copied; the VerticalListMenu pushes follow (0Dh, 0Ah, 0Fh, 1, 2, 26h, 16h); call at 0982 |
| L839 | 4800:09d0 | `case ch^.race of` | AGREE | 09d0 MOV AL,ES:[DI+74h] (race); CMP AL,5 first arm, then the other race values |
| L843 | 4800:0abb | `2: begin ch^.b[$144] := 2; AddEffect(ch, $6B, 0, $FF, 0) end;` | AGREE | 0abb CMP AL,2; MOV byte ES:[DI+144h],2; PUSH ch; PUSH 6Bh; PUSH 0; PUSH 0FFh; PUSH 0; CALLF AddEffect (via stub_ov23_e11) |
| L856 | 4800:0e53 | `4: begin ch^.level[4] := 1; AddEffect(ch, $86, 0, $FF, 0) end;` | AGREE | 0e53 CMP AL,4; MOV byte ES:[DI+10Dh],1 (level[4] = +109h+4); PUSH ch, 86h, 0, 0FFh, 0; AddEffect |
| L882 | 4800:21cb | `ch^.b[$12C] := RollHitDice(ch, $FF);  ch^.b[$78] := ch^.b[$12C];` | AGREE | 21cb PUSH ch; PUSH 0FFh; CALL RollHitDice; MOV ES:[DI+12Ch],AL; 21e3 MOV AL,ES:[DI+12Ch]; → ES:[DI+78h] |
| L891 | 4800:22d4 | `levels := '';` | AGREE | 22d4 MOV byte [BP-25h],0 (levels := ''); 22d8 [BP-4Eh],0; 22dc cls := 0 |
| L893 | 4800:22e5 | `if (ch^.level[cls] > 0) or (ch^.b[$111+cls] > 0) and (ch^.b[$111+cls] >= ov25 e?(ch)) then b...` | UNSURE | 22e5 cls → DI; CMP byte ES:[DI+109h],0; JG then-part (signed compare on the level byte); else PUSH SelectedChar; CALLF CurrentClassLevel (listing: stub_ov25_e9, 2304 MOV DL,AL) … The statement's `ov25 e?(ch)` is a placeholder for CurrentClassLevel (listing name); the structure matches, the callee name is left open by the author. |
| L908 | 4800:24dd | `WriteCharacter('', ch^);` | DISAGREE | 24dd PUSH [BP-2],[BP-4] (ch far pointer) FIRST, then LEA/StrCopy '' (CS:0709) pushed SECOND, then CALLF WriteCharacter. Pascal order is therefore WriteCharacter(ch, fname): the callee reads the record through [BP+0Ah] (0e20 `LES DI,[BP+0Ah]; MOV AX,ES:[DI+14Dh]`, 0e2f, 0e64 …) and the string through [BP+6] (0df1 `LES DI,[BP+6]` → StrAssign into the 8-char local). The header at L457 `WriteCharacter(fname [BP+0Ah]: string; var ch [BP+6])` and the three call sites (4300:4379 L684, 4800:0515 L773, 4800:24dd L908) have the two arguments swapped; the 4300:43a7 site pushes ch (43a6 region) before the 'CHRDAT'+k+n string too. |
| L988 | 4800:4638 | `bonus := bonus + ConBonus[ch.b[$19]];` | AGREE | 4638 LES ch; MOV AL,ES:[DI+19h] (CON); table CS? no: DS:427F indexed; ADD byte bonus,AL |

Notes from the sample: L400 4300:0590 — the `...table[2]...` paraphrase stands for three CS-table values that the code indexes by `ImportSource` at run time (CS:0506 + i, 0509 + 2i, 050F + 2i); inside the `2:` arm that is the same value. L273 3500:0392 — the 5-byte slot records are addressed as 7269 + 5*i (i = 1 → 726E `head_Id`, 2 → 7273 `body_Id` in globals.json), as the comment says. L893 4800:22e5 — the structure (signed `JG` on the level byte, then a far call) matches; the callee written `ov25 e?` is `CurrentClassLevel` in the listing (stub_ov25_e9 at 22ff), left open by the author.

## Sweeps (whole area)

- **Call-argument order.** argcheck 0 MISMATCH (58 OK, 345 UNSURE). The sweep counted the arguments of every text-routine call: ShowBottomPromptAndReadKey 14 calls, DrawText 48, ReadBottomLine 3, ClearRectangle 1 — all with the Curse argument counts. The sampled multi-argument calls (L38, L77, L97, L98, L126, L161, L253, L254, L282, L305, L414, L418, L425, L453, L574, L606, L673, L675, L751, L834, L843, L856, L882) are in push order. **Exception: WriteCharacter** (4300:0DEA). The callee reads the character record through `[BP+0Ah]` (0e20, 0e2f, 0e64, 0e73, 0f5e, 11c5 … `LES DI,[BP+0Ah]; … ES:[DI+14Dh]`) and the file-name string through `[BP+6]` (0df1 `LES DI,[BP+6]` → `StrAssign` into an 8-char local); every call site pushes the record first and the string second (4300:43a6–43d2, 4800:052c region, 4800:24dd–24f2). Pascal order is therefore `WriteCharacter(var ch; fname: string)`; the header at L457 and the three calls (L684, L773, L908) have the arguments swapped → **fix request #verify-1**.
- **Signed vs unsigned compares.** 28 anchored compare statements paired with the first conditional jump: LongInt time compare 2100:002c JG/JL/JC (`TimeInHundredths < target`), the rune-wheel `pos` wrap 2600:0348/0354 JGE/JLE (Integer), `UpCase(drive) < 'C'` JC/JNC (char), `ecl_Mem7C00^.w[$67C] <= 7` JBE (word), `for i := 1 to count` JBE (byte), `b[$F7] < $80` JNC (byte), `TopMenu[n].on`, `count > 5` JA (byte/word), `for cls := 0 to 7` and `ch^.level[cls] > 0` JLE/JG (the class index and the level byte are compared signed — ShortInt in the compiler's eyes; the pseudocode writes plain `> 0`, same result for 0..127), `for k := 1 to 7` / `k in [1..5]` JL/JG. No inconsistency.
- **Byte vs word operands.** L65 2100:000b `target := TimeInHundredths + LongInt(Word(secs * 100))`: MUL CX (word product), XOR DX, ADD/ADC to the 32-bit time — as written. L307 3500:041d–0444 `PWord(@party_MapY[g_4A1C*4])^ := $FFFF` / `party_Ahead`: SHL DI,1 twice (×4), word stores at 7210 + 4i and 7212 + 4i — as written. L827 4800:0823 `b[$126] := RandomWord(256)` byte store of a word result — as written.
- **Folded constant array indexes.** The sampled table reads (4300:0590 CS:0506/0509/050F by ImportSource, 4800:4638 `ConBonus[ch.b[$19]]` DS:427F, 4800:09d0 race switch) carry computed indexes in the code. None found read as a scalar.
- **ABS idioms.** Two NEG-after-JNS sequences in the area's segments, both on the result of ConHpBonus: **4800:2211** (CreateCharacter, L883 `ch^.b[$78] := ch^.b[$78] + ConHpBonus(ch) (at least 1)`, anchored as the range 21ef..2266) and **4800:476c** (MinHitPoints 46EC, not expanded — "same logic as Pool"). The code at 21f6–2266 is: `n := nClasses` (the byte at [BP-20h], zeroed at 20b9 and incremented once per class at 21b5); `bonus := ConHpBonus(ch)` (CBW); if `bonus >= 0` then `hp := (hp + bonus) div n` (224d–2266: ADD, CWD, IDIV CX) else if `hp > n + Abs(bonus)` then `hp := (hp + bonus) div n` (2224–223d) else `hp := 1` (2243). The pseudocode omits the division by the number of classes and the `n + Abs(bonus)` threshold → **fix request #verify-4** (the same shape at 4754–4790 in MinHitPoints should be written out when that routine is expanded).
- **Pascal set tests.** 15 `System.@SetIn` calls in the area's segments. Nine are written `in [...]` at their statement (4300:0840 L428, 0853 L429, 1007 L474, 3858 L597, 3f37 L650, 405b L661, 40f5 L667, 4800:03be L754, 0459 L762) with the right sense (JZ/JNZ). Six lie in ranges the pseudocode summarises in prose or elides: 4300:315c (ReadCharacter, the `.spc` block before 3207), 4300:364c (AddToParty: the prose at L584 says "SetIn 362a"; the call is 364c, the set is CS:3588), 4800:1c90 (CreateCharacter, set CS:0737 on the class byte +75h), 4800:419b / 4214 / 4540 (IconEditor, set CS:3EB1 on the menu key). Coverage note, no disagreement.
- **String length bytes.** L414/L433 `Copy(SavePath, 1, Length(SavePath))` pushes the length byte of DS:5BF0 (06cf `MOV AL,[5BF0]; XOR AH,AH`); L891 `levels := ''` stores 0 to the length byte; L418 `+ g_5BF1 + ':? '` uses CharToStr/StrAppend — all as written.
- **Anchors.** anchorcheck 681 / 0 bad. Two sample anchors are off: L387 4300:037b (`Close(f)`) sits on the nil assignments after the FreeMem pair; the CloseFile call is 041c–0422 → **fix request #verify-2**. L548 4300:27e4 is the JMP that ends the previous branch; the `else if FindTwinFile('.cha')` starts at 27e7 → **fix request #verify-3**.
- **Curse deltas.** Background colour argument present in every text call (sweep D). The title pictures use `PutPicture(col, row, pic)` (L126 0736: 0, 0Bh, pic) and LoadPicture through the Curse LoadDaxRecord/OpenWithPrompt path as the ShowTitle header says.

## SCREENS (`ENGINE_SCREENS.md`, 33 rows)

Every quoted text was located in the listings' `[ps] cs:"…"` references (ov00 2000:0028; ov01 credits 01fb–061b and `title` 0647/068c/06c9/0710; ov03 0171/0191/01b1/02a5/02cf/0305/0399; ov11 0579; ov16 0691, 071d, 0811, 0ee1, 0ef6, 0f06, 1103, 1153, 2354, 32cd, 3820, 3931, 3eea, 3efa, 3fe5, 4116; ov17 037c, 056b, 0626, 065c, 06cb, 06e2, 0853, 094a, 0b30, 0c75, 1109, 23e4, 2418, 248c, 262f–2702, 28db, 29b0, 29bf, 36a9, 36b8, 3740, 374f, 39a2, 39ce, 3a0a, 3f99–403d, 40da, 410b, 4134, 4165, 45bc, 4d49, 4d94, 527e, 52b3, 5334, 5390, 53f5, 5453, 5477). Colours checked at the push sequences: ENGINE-01 0Eh/0 (2000:001d), ENGINE-09 `DrawText(0, 24, 0Ah, 0, …)` (3500:0568–0573), ENGINE-10 0Dh/0Ah/0Fh (4300:3f04–3f0f), ENGINE-22 0Eh/0 (4800:0560), ENGINE-16/17 strings at 4300:0ee1/0ef6/0f06, ENGINE-06 0Ah (2600:0166).

| row | result |
|---|---|
| ENGINE-01, 05, 06, 09–33 | agree (strings, colours and triggers as cited) |
| ENGINE-02 | agree with the code (`LoadPicture('title', 1); PutPicture(0, 0, pic); WaitSecondsOrKey(5)` 2100:0642–0675) **and with the reference capture**: `acceptance/ref/reports/TITLE-1.md` compares `decode/data/png/TITLE/TITLE_1.png` with REF-TITLE-1 — 0 / 64,000 pixels differ. The TITLE-1-PLAYDEMO report (frame f008 vs TITLE_1) differs only in rows 192–199, i.e. the bottom text row carrying the Play Demo prompt (RESIDENT-01 over the title picture). |
| ENGINE-03, 04 | agree with the code (TITLE 2 at (0,0), TITLE 3 at (6, 11), TITLE 4 at (0, 11) + sound g_25C6, 10 s waits); no capture |
| ENGINE-07, 08 | agree: the strings are in GAME.OVR at ov03 CS:00D7 / 00F0 (file 0x4760 / 0x4779) and the dead code at 2600:03d0 / 041e pushes them with 0Eh, 0 into ShowTimedBottomPrompt (capstone decode of file 0x4A58..); the patched byte at file 0x4A56 is `EB` as the area file states |
