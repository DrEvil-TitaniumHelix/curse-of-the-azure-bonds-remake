# PARTY — verification (lane cab-verify-fable, 2026-10-20)

Area file: `decode/pseudo/PARTY.pas.md` (author cab-rt; ov06, ov12, ov20, ov21, ov24, ov25; 3222 lines) and `PARTY_SCREENS.md` (18 rows). Verified per `herdr/assignments/cab-verify.md`: fresh argcheck, a seeded 10 % sample re-read against the listings, targeted sweeps over the whole area, every SCREENS row against the code. The area file was not edited; the fix requests are in STATUS.md (`PARTY fix request #verify-n`).

## Summary

| check | result |
|---|---|
| argcheck (`python -I decode/tools/argcheck.py PARTY`, output to scratch) | 710 calls: OK 127, **MISMATCH 0**, UNSURE 583 |
| anchorcheck (`decode/tools/anchorcheck.py decode/pseudo/PARTY.pas.md`) | 1977 anchors, **0 bad** |
| sample (`pseudo_check.py PARTY`, seed `1989PARTY`) | 1448 anchored statements, 145 sampled: **AGREE 144**, **DISAGREE 1**, UNSURE 0 |
| sweeps | 1 further disagreement (a swapped anchor at 6200:27ef); type and naming notes |
| SCREENS | 18 rows, 18 agree with the code; no `acceptance/ref` capture covers a PARTY screen |
| fix requests | **2** (#verify-1 2b00:07ee case-arm anchor, #verify-2 6200:27ef Move anchor) |

## Sample

Method: `python -I decode/tools/pseudo_check.py PARTY` (default seed `random.seed('1989PARTY')`, 10 % of the 1448 anchored statements). Each statement was re-read against the instructions at its anchor in `decode/listings/ov06|12|20|21|24|25.lst` (operand sizes and offsets, constants, push order, branch sense, signedness).

Verdicts: AGREE = statement, operands and constants match the code at the anchor; DISAGREE = the code says something else (→ fix request); UNSURE = not decidable from the listing.

| line | anchor | statement | verdict | evidence |
|---|---|---|---|---|
| L50 | 2b00:011d | `8: Str(LongInt(item^.value div 2), num);` | AGREE | 011d CMP AX,8; value word +3Ah; XOR DX; DIV CX(2); PUSH DX:AX → StrLong |
| L53 | 2b00:0195 | `$80: Str(LongInt(item^.value * 8), num);` | AGREE | 0195 CMP AX,80h; value +3Ah SHL 3; XOR DX; PUSH DX:AX → StrLong |
| L62 | 2b00:0295 | `menu_Sel := 0;` | AGREE | 0295 MOV byte [7294],0 (menu_Sel) |
| L78 | 2b00:0390 | `failed := false;` | AGREE | 0390 LES DI,[BP+6] (var failed); MOV byte ES:[DI],0 |
| L103 | 2b00:059a | `if not failed then SetCharMoneyGold(gold - price);` | AGREE | 059a CMP byte failed,0; JNZ; gold - price → PUSH; CALLF SetCharMoneyGold (stub_ov21_e15) |
| L128 | 2b00:074c | `while item <> nil do begin BuildItemName(nil, item, 0, 0, 0, 0); item := item^.next end;` | AGREE | 074c LES AX,[6F8C] TreasureItems; OR test; 0760 PUSH 0:0 (nil), item seg:off, 0, 0, 0, 0; CALLF BuildItemName; item := item^.next (+2Ah) |
| L135 | 2b00:07ee | `'B': ShopBuy;` | DISAGREE | 07ee is `MOV [BP-2Eh],AL` = the store of the HorizontalMenu result (L133 `key := HorizontalMenu(...)`); the case test `CMP AL,42h` is 07f4 and the call `CALL ShopBuy` 07f8. Anchor one statement early. |
| L139 | 2b00:082e | `'S': ShareMoney;` | AGREE | 082e CMP AL,53h ('S'); CALLF ShareMoney (stub_ov21_e7) |
| L152 | 2b00:091a | `'G', 'O': CycleSelectedChar(key);` | AGREE | 0916 CMP AL,47h; 091a PUSH key; CALLF CycleSelectedChar; 0925 CMP AL,4Fh; 0929 same call |
| L192 | 3600:001e | `if (type = 0) or (EffectToApply = type) then begin` | AGREE | 001e CMP byte [BP+6],0; JZ then; 0024 MOV AL,[6F93] EffectToApply; CMP [BP+6]; JNZ exit |
| L255 | 3600:01d8 | `AttackRollValue := AttackRollValue + b;  DamageAmount := DamageAmount + b;` | AGREE | 01d8 MOV AL,b; ADD byte [6F9F],AL (AttackRollValue); 01df ADD byte [6F94],AL (DamageAmount) |
| L278 | 3600:02b2 | `DamageAmount := DamageAmount div 2;  SaveRoll := SaveRoll + 3;` | AGREE | 02b2 MOV AL,[6F94]; XOR AH; CWD; IDIV 2 → [6F94]; 02c0 ADD byte [6F92],3 (SaveRoll) |
| L306 | 3600:03a6 | `if e^.p3 = 0 then KillCombatant(c, 6, 'Suffocates')` | AGREE | 03a6 LES e; CMP byte ES:[DI+3],0 (p3); JNZ; 03b0 PUSH c; PUSH 6; PUSH 'Suffocates'; KillCombatant |
| L353 | 3600:04ea | `if cr(c)^.mayUseItems <> 0 then ShowCharacterMessage(c, 'is silenced', $0A, 1);` | AGREE | 04ea LES c; LES DI,ES:[DI+18Dh] (cr record); CMP byte ES:[DI+2],0; JZ; 04f9 PUSH c; 'is silenced' (CS:04D8); ShowCharacterMessage |
| L375 | 3600:0648 | `GetMem(p, $3F);  FillChar(p^, $3F, 0);` | AGREE | 0648 LEA p; PUSH 3Fh; CALLF GetMem; 0656 LES p; PUSH 3Fh; PUSH 0; FillChar |
| L390 | 3600:06f8 | `if (mode = 0) and not HasEffect(SelectedChar, $18, p) then begin` | AGREE | 06f8 CMP byte mode,0; JNZ; 06fe PUSH SelectedChar; PUSH 18h; LEA p; CALLF HasEffect |
| L458 | 3600:0a37 | `RemoveEffect(c, $23, nil);` | AGREE | 0a37 PUSH c; PUSH 23h; PUSH 0:0; CALLF RemoveEffect (stub_ov23_e3) |
| L472 | 3600:0b4f | `81..100: begin` | AGREE | 0b4f CMP AX,51h; JL; CMP AX,64h; JG — 81..100 |
| L489 | 3600:0bc5 | `if cr(c)^.initiative = 0 then begin` | AGREE | 0bc5 LES c; LES cr (+18Dh); 0bcd CMP byte ES:[DI+3],0; JNZ; AttackBlocked := 1; AttackRollValue := FFh |
| L500 | 3600:0c2f | `c^.age := c^.age + 1;` | AGREE | 0c2f LES c; INC word ES:[DI+76h] (age) |
| L511 | 3600:0c67 | `id := e^.p3 div 16;  found := false;  a := cloud_List;` | AGREE | 0c67 LES e; MOV AL,ES:[DI+3]; CWD; IDIV 10h → id; 0c79 found := 0; 0c7d LES AX,[755B] cloud_List |
| L515 | 3600:0ccc | `if not found then Exit;` | AGREE | 0ccc CMP byte found,0; JNZ; JMP exit |
| L535 | 3600:0f17 | `p := p^.next;` | AGREE | 0f17 LES p; LES AX,ES:[DI+4] (next) → p |
| L544 | 3600:0f4f | `if TargetDistance(SelectedChar, c) > 1 then` | AGREE | 0f4f PUSH SelectedChar; PUSH c; CALLF TargetDistance; CMP AL,1; JBE skip |
| L580 | 3600:109c | `ShowCharacterMessage(c, 'is weakened', $0A, 1);` | AGREE | 109c PUSH c; 'is weakened' (CS:1063); 0Ah; 1 → ShowCharacterMessage |
| L589 | 3600:10fc | `if AddEffectUnlessCuring(c, $2C, e^.p3, 10) then` | AGREE | 10fc is the `SUB SP,4` of the prologue; the pushes start 10ff: PUSH c; PUSH 2Ch; PUSH e^.p3; PUSH 0Ah; AddEffectUnlessCuring — anchor on the frame setup, same routine entry |
| L592 | 3600:1140 | `if view_Mode <> 5 then PartySummary(SelectedChar);` | AGREE | 1140 CMP byte [4FBA],5; JZ; 1147 PUSH SelectedChar; CALLF PartySummary |
| L615 | 3600:1206 | `side := (e^.p3 and $10) div $10;` | AGREE | 1206 LES e; MOV AL,ES:[DI+3]; AND AL,10h; XOR AH; CWD; IDIV 10h → side |
| L633 | 3600:12a1 | `DamageAmount := DamageAmount shl 1;` | AGREE | 12a1 MOV AL,[6F94]; XOR AH; SHL AX,1; MOV [6F94],AL |
| L711 | 3600:152b | `ShowCombatMessageAnimation(hold_Victim, 1, 'is Paralyzed');` | AGREE | 152b PUSH [6FA5]:[6FA3] hold_Victim; PUSH 1; 'is Paralyzed' (CS:14EC); ShowCombatMessageAnimation |
| L731 | 3600:15ec | `c^.int := 7;  c^.wis := 7;` | AGREE | 15ec MOV byte ES:[DI+13h],7; 15f4 MOV byte ES:[DI+15h],7 |
| L746 | 3600:168d | `if SelectedChar^.creature_type = $13 then begin` | AGREE | 168d LES [6506]; CMP byte ES:[DI+11Ah],13h; JNZ |
| L747 | 3600:1699 | `if not HasEffect(SelectedChar, $18, p) then AttackBlocked := 1;` | AGREE | 1699 PUSH SelectedChar; PUSH 18h; LEA p; CALLF HasEffect; OR AL; JNZ; 16b2 MOV byte [6F9B],1 |
| L748 | 3600:16b7 | `AttackRollValue := AttackRollValue - 4;` | AGREE | 16b7 SUB byte [6F9F],4 |
| L799 | 3600:1818 | `c^.controlled := 1;` | AGREE | 1818 LES c; MOV byte ES:[DI+198h],1 |
| L811 | 3600:190a | `if c^.npc_morale = $B3 then c^.npc_morale := 0;` | AGREE | 190a CMP byte ES:[DI+F7h],0B3h; JNZ; 1915 MOV byte ES:[DI+F7h],0 |
| L812 | 3600:191e | `c^.side := 0;` | AGREE | 191e LES c; MOV byte ES:[DI+197h],0 |
| L853 | 3600:1b2e | `if (it^.readied <> 0) and ((it^.b[$2F] = $76) or (it^.b[$30] = $76) or (it^.b[$31] = $76)) t...` | AGREE | 1b2e CMP byte ES:[DI+34h],0 (readied); JNZ 1b3b; CMP +2Fh/+30h/+31h with 76h |
| L855 | 3600:1b7b | `AnimateAlongPath(CombatantCol(hold_Victim), CombatantRow(hold_Victim), CombatantCol(c), Comb...` | AGREE | 1b7b PUSH hold_Victim; CombatantCol; CBW; PUSH; PUSH hold_Victim; CombatantRow; PUSH; (c col/row, 4, 2Dh follow); AnimateAlongPath |
| L870 | 3600:1c40 | `c^.hp := c^.hp + 8;` | AGREE | 1c40 LES c; ADD byte ES:[DI+1A4h],8 |
| L897 | 3600:1d6a | `ShowTimedBottomMessage('The air clears a little...');` | AGREE | 1d6a StrCopy 'The air clears a little...' (CS:1CDB); CALLF ShowTimedBottomMessage |
| L910 | 3600:1fea | `p := CurrentAttackItem(SelectedChar);` | AGREE | 1fea PUSH SelectedChar; CALL CurrentAttackItem; DX:AX → p |
| L940 | 3600:2132 | `n := 0;` | AGREE | 2132 MOV byte [BP-1],0 |
| L943 | 3600:2177 | `if (n > 0) and ReviveCombatant(c, n) then begin` | AGREE | 2177 CMP byte n,0; JBE skip; 217d PUSH c; PUSH n; CALLF ReviveCombatant; OR AL; JZ |
| L1007 | 3600:23c4 | `CancelDamageAndEffect($35);` | AGREE | 23c4 PUSH 35h; CALL CancelDamageAndEffect; 23cb PUSH 0Bh; CALL again (as the comment says) |
| L1022 | 3600:23f2 | `CancelDamageAndEffect($34);` | AGREE | 23f2 PUSH 34h; CALL CancelDamageAndEffect |
| L1100 | 3600:26cc | `BuildFourAnimationFrames($17);` | AGREE | 26cc PUSH 17h; CALLF BuildFourAnimationFrames (stub_ov24_e24) |
| L1113 | 3600:27b9 | `AddEffect(hold_Victim, $34, 0, $FF, 0);` | AGREE | 27b9 PUSH hold_Victim; PUSH 34h; PUSH 0; PUSH 0FFh; PUSH 0; AddEffect |
| L1205 | 3600:2b4a | `c^.controlled := 1;` | AGREE | 2b4a LES c; MOV byte ES:[DI+198h],1 |
| L1258 | 3600:2df3 | `RemoveEffect(SelectedChar, $91, nil);` | AGREE | 2df3 PUSH SelectedChar; PUSH 91h; PUSH 0:0; CALLF RemoveEffect |
| L1329 | 5400:008a | `while u > 1 do begin minutes := ClockLimits[u - 1] * minutes; u := u - 1 end;` | AGREE | 008a CMP byte u,1; JLE exit; 0090 u-1 → ClockLimits[DS:3E2A + 2(u-1)] MUL minutes; 00a4 DEC |
| L1331 | 5400:00b7 | `if minutes > 10 then chunk := 10 else chunk := minutes;` | AGREE | 00b7 CMP word minutes,0Ah; JBE → chunk := minutes; else chunk := 10 |
| L1348 | 5400:022b | `prev := c^.effects;` | AGREE | 022b LES c; LES AX,ES:[DI+F2h] (effects) → prev |
| L1369 | 5400:0305 | `if i = 6 then begin` | AGREE | 0305 CMP byte i,6; JZ 0349 |
| L1370 | 5400:0349 | `c := PartyList;  while c <> nil do begin c^.age := c^.age + 1;  c := c^.next end;` | AGREE | 0349 LES AX,[650A] PartyList; OR; JZ; 035d INC word ES:[DI+76h]; 0364 next |
| L1372 | 5400:030b | `clk[i + 1] := clk[i + 1] + 1;` | AGREE | 030b MOV AL,i; INC; CBW; SHL 1; LES clk; ADD DI; INC word ES:[DI] |
| L1403 | 5400:04a3 | `while (RestClock[k] = 0) and (k < 5) do k := k + 1;` | AGREE | 04a3 k → DI*2; CMP word [7566+DI],0 (RestClock); JNZ exit; CMP byte k,5; JGE exit; 04b8 INC |
| L1473 | 5400:08a8 | `c := c^.next;` | AGREE | 08a8 LES c; LES AX,ES:[DI+189h] (next) → c |
| L1489 | 5400:093d | `if c^.mem_spell[k] > $7F then` | AGREE | 093d k → DI; CMP byte ES:[DI+1Eh],7Fh (mem_spell); JBE skip |
| L1553 | 5400:0be5 | `while c <> nil do begin` | AGREE | 0be5 OR of the two pointer words; JZ exit |
| L1574 | 5400:0cba | `while c <> nil do begin StudyTimer[i] := 0;  Inc(i);  c := c^.next end;` | AGREE | 0cba OR of the pointer words; JZ; 0cc2 i → DI; MOV byte [7573+DI],0 (StudyTimer); 0cce INC i; 0cd1 next (+189h) |
| L1576 | 5400:0cf4 | `hourTick := 0;  redrawTick := 0;` | AGREE | 0cf4 MOV byte [BP-0Ch],0; 0cf8 MOV byte [BP-0Dh],0 |
| L1582 | 5400:0d73 | `DrawRestTime(0);` | AGREE | 0d73 PUSH 0; CALL DrawRestTime (5400:45D4) |
| L1584 | 5400:0da1 | `else ClearMenuLine;` | AGREE | 0da1 CALLF ClearMenuLine (stub_ov26_e4) |
| L1600 | 5400:0e59 | `stop := true;  interrupted := true;` | AGREE | 0e59 MOV byte [BP-0Eh],1 (stop); 0e5d MOV byte [BP-1],1 (interrupted); MessageDelay follows |
| L1734 | 5500:0362 | `v := Val(num, code);` | AGREE | 0362 LEA code; LEA num; CALLF System.@ValLong; DX:AX → v (the function form `v := Val(num, code)` stands for Val(num, v, code)) |
| L1737 | 5500:038d | `num := maxStr;` | AGREE | 038d LEA num; LEA maxStr; PUSH 6; CALLF StrAssign |
| L1747 | 5500:0412 | `until (k = #13) or (k = #27);` | AGREE | 0412 CMP byte k,0Dh; JZ; CMP byte k,1Bh; JZ; JMP loop |
| L1760 | 5500:0493 | `src^.money[coin] := src^.money[coin] - amount;` | AGREE | 0493 coin*2 → AX; LES DI,[BP+0Eh]; LES DI,ES:[DI] (src^); money word at +FBh+2*coin; SUB amount; store |
| L1777 | 5500:0549 | `if (p^.npc_morale = 0) or (p^.npc_morale = $B3) then begin` | AGREE | 0549 CMP byte ES:[DI+F7h],0; JZ; CMP 0B3h; JZ; else skip |
| L1798 | 5500:0642 | `CountMoneySharers := n;` | AGREE | 0642 MOV AL,n → result; RETF |
| L1811 | 5500:06a1 | `if TreasureMoney[k] > 0 then begin` | AGREE | 06a1 CMP word [6F72+DI],0 (hi word); JG; JL; CMP word [6F70+DI],0 (lo); JBE — 32-bit signed > 0 |
| L1813 | 5500:06de | `rest[k]  := TreasureMoney[k] mod n;` | AGREE | 06de n → CX:BX; TreasureMoney[k] 32-bit; LongInt mod → rest[k] |
| L1824 | 5500:07bb | `if rest[k] > 0 then` | AGREE | 07bb k → DI*2; CMP word [BP+DI-28h],0; JBE skip |
| L1838 | 5500:0894 | `for k := 6 downto 0 do` | AGREE | 0894 MOV byte k,6; JMP 089d; 089a DEC k; loop body test (L1839) follows |
| L1840 | 5500:08ae | `p := PartyList;` | AGREE | 08ae LES AX,[650A] PartyList → p |
| L1847 | 5500:0925 | `rest[k] := rest[k] - room;` | AGREE | 0925 rest[k] - room ([BP-0Ch]) → rest[k] |
| L1851 | 5500:0986 | `rest[k] := 0;` | AGREE | 0986 k → DI*2; XOR AX; MOV word [BP+DI-28h],AX |
| L1900 | 5500:0c3d | `'E': begin coinName := 'electrum '; result := 2 end;` | AGREE | 0c3d CMP AL,45h ('E'); 'electrum ' (CS:0B6E) → StrAssign(coinName, FFh); result := 2 follows |
| L1914 | 5500:0cf7 | `DrawScreenFrame;` | AGREE | 0cf7 CALLF DrawScreenFrame |
| L1938 | 5500:0ed3 | `amount := InputNumber(TreasureMoney[coin], s, $0A);` | AGREE | 0ed3 coin*4 → DI; PUSH word [6F70+DI] (low word of the pool amount); LEA s; PUSH 0Ah; InputNumber |
| L1953 | 5500:0f61 | `hasMoney := False;  hasItems := False;` | AGREE | 0f61 LES [BP+0Ah]; MOV byte ES:[DI],0; 0f68 LES [BP+6]; MOV byte ES:[DI],0 (both var params) |
| L1954 | 5500:0f6f | `for k := 0 to 6 do` | AGREE | 0f6f MOV byte k,0; JMP 0f78; INC |
| L1955 | 5500:0f78 | `if TreasureMoney[k] <> 0 then hasMoney := True;` | AGREE | 0f78 k*4 → DI; MOV AX,[6F70+DI]; OR AX,[6F72+DI]; JZ; MOV byte hasMoney^,1 |
| L1975 | 5500:0ff3 | `FillChar(it, 63, 0);  rec := 0;` | AGREE | 0ff3 LES it (var); PUSH 3Fh; PUSH 0; FillChar; 1004 MOV byte rec,0 |
| L1977 | 5500:1033 | `it.readied := 0;  it.hidden := 6;  it.magic_flag := 0;` | AGREE | 1033 MOV byte ES:[DI+34h],0; 103b ES:[DI+35h],6; 1043 ES:[DI+36h],0 |
| L1980 | 5500:106a | `if (typ in [1..59]) or (typ = 73) or (typ = 77) or (typ = 93) then begin` | AGREE | 106a MOV AL,ES:[DI+2Eh] (type); CMP 1 JL; CMP 3Bh JLE; CMP 49h JZ; CMP 4Dh … |
| L2029 | 5500:1770 | `it.value := it.value + lvl * 300;` | AGREE | 1770 lvl → AX; IMUL 12Ch; ADD ES:[DI+3Ah] (value); store |
| L2037 | 5500:17d8 | `if r in [1..5] then rec := $11` | AGREE | 17d8 CMP AX,1 JL; CMP AX,5 JG; 17e7 MOV byte rec,11h |
| L2061 | 5500:19c7 | `changed := False;` | AGREE | 19c7 LES [BP+6] (var changed); MOV byte ES:[DI],0 |
| L2086 | 5500:1b80 | `if SelectedChar^.money[5] <> 0 then opts := '  Gems';` | AGREE | 1b80 LES [6506]; CMP word ES:[DI+105h],0 (money[5]); JZ; '  Gems' (CS:191C) → StrAssign(opts, 28h) |
| L2088 | 5500:1bd3 | `opts := opts + ' Exit';` | AGREE | 1bd3 StrCopy opts; StrAppend ' Exit' (CS:192D) |
| L2193 | 6200:0046 | `t := w^.type;` | AGREE | 0046 LES w; MOV AL,ES:[DI+2Eh] → t |
| L2207 | 6200:01e9 | `c^.dmg_dice[1] := ItemTypeTable[t].dice;  c^.dmg_sides[1] := ItemTypeTable[t].sides;` | AGREE | 01e9 t SHL 4 → DI; MOV AL,[DI+5CFF] (dice) → ES:[c+19Eh]; 0200 same for sides |
| L2214 | 6200:0220 | `if ItemTypeTable[item^.type].slot = 2 then begin` | AGREE | 0220 LES item; type +2Eh SHL 4; CMP byte [DI+5CF6],2 (slot); JNZ |
| L2217 | 6200:0259 | `else if (w >= 151) and (w <= 399) then c^.move := 9` | AGREE | 0259 CMP AX,97h JL; CMP AX,18Fh JG; MOV byte ES:[DI+1A5h],9 — 151..399 signed |
| L2226 | 6200:02ad | `acv := ItemTypeTable[item^.type].ac_value;` | AGREE | 02ad LES item; type SHL 4; MOV AL,[DI+5CFC] (ac_value) → acv |
| L2245 | 6200:03f9 | `if (e >= 0) and (e <= 512) then m := c^.move` | AGREE | 03f9 CMP AX,0 JL; CMP AX,200h JG; MOV AL,ES:[DI+1A5h] (move) → m — e is the 16-bit low word (see sweeps) |
| L2267 | 6200:0596 | `shown := 0;` | AGREE | 0596 MOV byte shown,0; 059a k := 1 |
| L2269 | 6200:05a3 | `if (item^.word[k] <> 0) and (((item^.hidden shr (3 - k)) and 1) = 0) then shown := shown + (...` | AGREE | 05a3 k → DI; CMP byte ES:[DI+2Eh],0 (word[k]); JZ; 05b4 3-k shift of hidden follows |
| L2270 | 6200:05ee | `plural := false;` | AGREE | 05ee MOV byte plural,0; 05f2 k := 3 downto |
| L2277 | 6200:06de | `or ((item^.word[3] <> $87) and (item^.type in [$49, $1C]) and (item^.word[3] <> $B1)) then b...` | AGREE | 06de CMP byte ES:[DI+31h],87h (word[3]); JZ; 06e8 CMP type 49h; JZ; 06f2 CMP type 1Ch; JNZ |
| L2318 | 6200:09c8 | `if c^.hp < c^.hp_max then colour := $0E else colour := $0A;` | AGREE | 09c8 MOV AL,ES:[DI+1A4h] (hp); CMP AL,ES:[DI+78h] (hp_max); JNC → 0Ah; else 0Eh |
| L2327 | 6200:0a3a | `if combat_Shown = 0 then Exit;` | AGREE | 0a3a CMP byte [75E5],0 (combat_Shown); JNZ; JMP exit |
| L2338 | 6200:0b10 | `y := y + 2;` | AGREE | 0b10 ADD byte y,2 |
| L2339 | 6200:0b18 | `BuildItemName(c, c^.readied[0], 0, 0, 0, 0);` | AGREE | 0b18 PUSH c; PUSH ES:[DI+153h]:[151h] (readied[0]); PUSH 0,0,0,0; BuildItemName |
| L2370 | 6200:0cf6 | `if s <= 8 then c^.readied[s] := it` | AGREE | 0cf6 s (byte, zero-extended): CMP AX,0 JL; CMP AX,8 JG — `s <= 8` (the >= 0 half is always true for a byte) |
| L2405 | 6200:0fdd | `EncumbranceMoveLimit(c);` | AGREE | 0fdd PUSH c; CALL EncumbranceMoveLimit (6200:23C5) |
| L2410 | 6200:108c | `c^.fighter_lvl_eff := c^.level[2] + c^.old_level[2] * ov25_13BC(c)` | AGREE | 108c PUSH c; CALLF DualClassActive (stub_ov25_e10 = the pseudocode's ov25_13BC); CBW; IMUL old_level[2] (+113h); ADD level[2] (+10Bh); → ES:[DI+DDh] |
| L2426 | 6200:1180 | `else r := 0 end;` | AGREE | 1180 is the first instruction of the case statement that starts on L2425 (LES c; MOV AL,ES:[DI+17h] dex; CMP 1/3 → FCh …); the `else r := 0` branch itself is the fall-through at the end of the chain — the anchor cites the statement's first instruction, placed on its last line |
| L2444 | 6200:1330 | `else if (c^.str >= 19) and (c^.str <= 25) then r := c^.str + 5;` | AGREE | 1330 MOV AL,ES:[DI+11h] (str); ADD AX,5 → r (the 19..25 test is 1321–132b) |
| L2539 | 6200:18db | `else ClearRectangle(1, $12, $26, $16);` | AGREE | 18db PUSH 1, 12h, 26h, 16h; CALLF ClearRectangle |
| L2557 | 6200:198f | `AllocPicture($18, 3, 1, 1, tmp);` | AGREE | 198f PUSH 18h; PUSH 3; PUSH 1; PUSH 1; LEA tmp; AllocPicture |
| L2611 | 6200:22a1 | `px := cb_ScrCol[k] * 3;  py := cb_ScrRow[k] * 3;` | AGREE | 22a1 CombatantIndex → DI; MOV AL,[DI+67C6] (cb_ScrCol); IMUL 3 → px; 22b3 same for cb_ScrRow (680E) |
| L2614 | 6200:22f8 | `DrawPicture(px, py, f, 5, g_75E0, view_Pic);` | AGREE | 22f8 PUSH px, py, f, 5, [75E0], view_Pic; DrawPicture |
| L2646 | 6200:24d7 | `c^.active := 0;  c^.hp := 0;` | AGREE | 24d7 MOV byte ES:[DI+196h],0 (active); 24e0 MOV byte ES:[DI+1A4h],0 (hp) |
| L2674 | 6200:2681 | `for i := 1 to n do` | AGREE | 2681 MOV AL,1; CMP AL,n; JA skip; MOV i,AL; 268d INC |
| L2686 | 6200:2770 | `BuildTargetList(CombatantCol(c), CombatantRow(c), $FF, $FF, CombatantSize(c), cm_Map);` | AGREE | 2770 PUSH c; CombatantCol; PUSH; PUSH c; CombatantRow; PUSH; PUSH 0FFh; … CombatantSize; cm_Map; BuildTargetList 279a |
| L2689 | 6200:27f5 | `d := tg_List[i].dist div 2;` | AGREE | 27f5 `MOV DX,3; MUL` is the index*3 of this statement; its first instruction is 27ef `MOV AL,[BP-2FFh]` (i), then [DI+6E95] (dist), CWD, IDIV 2 → d at 2808. The following L2690 `Move(save, g_6E97, $D8)` cites 27ef but is at 280b–281a (LEA save; PUSH DS:6E97; PUSH 0D8h; CALLF System.Move) — see sweeps |
| L2724 | 6200:2a78 | `case view_Mode of` | AGREE | 2a78 MOV AL,[4FBA] view_Mode; CMP 0 / 1 / 2 chain |
| L2725 | 6200:2a7f | `0: DrawScreenFrame;` | AGREE | 2a7f CALLF DrawScreenFrame |
| L2729 | 6200:2ab8 | `else begin LoadPortrait(g_4FC5, g_4FC6);  DrawPortrait(3, 3, 1) end;` | AGREE | 2ab8 PUSH [4FC5] (pic_HeadId); PUSH [4FC6] (pic_BodyId); CALLF LoadPortrait; 2ac5 PUSH 3, 3, 1; DrawPortrait |
| L2730 | 6200:2ad3 | `PartySummary(SelectedChar);  DrawLocationTimeStatus;` | AGREE | 2ad3 PUSH SelectedChar; CALL PartySummary (6200:2795); 2ae0 CALL DrawLocationTimeStatus (6200:4BAA) |
| L2752 | 6200:2d06 | `s := s + hh + ':' + mm;` | AGREE | 2d06 StrCopy s; hh; ':' ; mm appended |
| L2764 | 6200:2e0d | `FUN_01A0_0397;` | AGREE | 2e0d CALLF 01A0:0397 (FUN_01a0_0397, RESIDENT combat layout) |
| L2786 | 6200:2fe6 | `else if allowExit and ((key = 'E') or (key = #0)) then c := nil;` | AGREE | 2fe6 CMP byte allowExit,0; JZ; 2fec CMP key,45h; JZ 2ff8; CMP key,0; JNZ; 2ff8 c := nil |
| L2806 | 6200:3109 | `if f and $01 <> 0 then ammo := c^.readied[11];` | AGREE | 3109 MOV AL,f; AND AL,1; JZ; LES c; LES AX,ES:[DI+17Dh] (readied[11]) → ammo^ |
| L2820 | 6200:319a | `1: if cls = 2 then r := ((lvl = 8) and (c^.str = 17)) or ((lvl = 7) and (c^.str < 17));` | AGREE | 319a CMP byte cls,2; JNZ; CMP lvl,8; JNZ 31b0; CMP byte ES:[DI+11h],11h; JZ true; 31b0 CMP lvl,7; JNZ; str < 17 (JNC) |
| L2822 | 6200:3202 | `3: if cls = 2 then r := (lvl = 6) or ((lvl = 5) and (c^.str < 18));` | AGREE | 3202 CMP cls,2; CMP lvl,6 JZ true; CMP lvl,5; CMP str,12h JNC false; true |
| L2849 | 6200:33a5 | `if (cr(p)^.b[$13] = 0) and (p^.side = 0) and (p^.status = 5) then begin` | AGREE | 33a5 LES p; LES cr (+18Dh); CMP byte ES:[DI+13h],0; 33b4 CMP side (+197h),0; 33bf CMP status (+195h),5 |
| L2888 | 6600:0094 | `0: begin c^.b[$12D] := c^.b[$12D] + 1;` | AGREE | 0094 LES c; INC byte ES:[DI+12Dh] |
| L2889 | 6600:009c | `for L := 2 to lvl do for k := 1 to 5 do c^.b[$12C + k] := c^.b[$12C + k] + ClericSlots[L * 5...` | AGREE | 009c lvl → [BP-0Fh]; MOV AL,2; CMP AL,lvl; JG skip; L := 2; 00b1 k := 1 .. 5 inner loop |
| L2912 | 6600:035b | `if (it^.b[$3E] = $81) and (it^.readied <> 0) then` | AGREE | 035b CMP byte ES:[DI+3Eh],81h; JNZ; 0365 CMP byte ES:[DI+34h],0 (readied); JZ |
| L2914 | 6600:039a | `it := it^.next;` | AGREE | 039a LES it; LES AX,ES:[DI+2Ah] (next) |
| L2930 | 6600:0478 | `RecalcSpellSlots(c);  UpdateSaves(c);` | AGREE | 0478 PUSH c; CALL RecalcSpellSlots (6600:6011); 0482 PUSH c; CALL UpdateSaves (6600:67E3) |
| L2931 | 6600:048c | `if c^.level[6] > 0 then UpdateThiefSkills(c);` | AGREE | 048c CMP byte ES:[DI+10Fh],0 (level[6]); JLE skip; 0497 PUSH c; CALL UpdateThiefSkills |
| L2957 | 6600:06b7 | `for k := 2 to 5 do c^.b[$12C + k] := 0;  c^.b[$12D] := 1;` | AGREE | 06b7 k := 2; 06c0 MOV byte ES:[DI+12Ch+k],0; CMP k,5; JNZ; 06d5 [12Dh] := 1 follows |
| L2962 | 6600:0769 | `if (c^.wis > 14) and (c^.b[$12E] > 0) then Inc(c^.b[$12E]);` | AGREE | 0769 CMP byte ES:[DI+15h],0Eh (wis); JBE; CMP byte ES:[DI+12Eh],0; JBE; INC |
| L2976 | 6600:084b | `for s := 0 to 4 do begin` | AGREE | 084b MOV byte s,0; JMP 0854; s → DI; MOV byte ES:[DI+DFh],14h (save[s] := 20 first) |
| L3007 | 6600:0ba4 | `for k := 1 to 8 do begin` | AGREE | 0ba4 MOV byte k,1; JMP 0bad; 0baa INC |
| L3011 | 6600:0bec | `adj := RaceSkillAdj[c^.race * 8 + k];` | AGREE | 0bec k → DX; race (+74h) SHL 3 → DI; ADD DX; MOV AL,[DI+3F1E] (RaceSkillAdj) → adj |
| L3033 | 6600:0e2c | `k := 1;  while (ClassAligns[cls * 10] >= k) and (ClassAligns[cls * 10 + k] <> c^.alignment) ...` | AGREE | 0e2c MOV byte k,1; 0e30 cls*10 → DI; MOV AL,[DI+41D8] (ClassAligns); CMP AL,k; JC exit; 0e44 compare entry k with alignment |
| L3034 | 6600:0e6f | `ok := ok and (ClassAligns[cls * 10] >= k);` | AGREE | 0e6f CMP byte ok,0; JZ; cls*10; CMP [41D8+DI],k; JNC → ok stays |
| L3074 | 6600:11a3 | `c^.class := cls;` | AGREE | 11a3 MOV AL,cls; MOV byte ES:[DI+75h],AL |
| L3081 | 6600:127b | `it := it^.next;` | AGREE | 127b LES it; LES AX,ES:[DI+2Ah] (next) |

Notes from the sample (no action needed): L589 3600:10fc cites the `SUB SP,4` of the handler's prologue, the pushes start at 10ff (same routine entry). L2426 6200:1180 is the first instruction of the DexDefenseAdj case statement that begins on L2425; the anchor sits on the statement's last line. L1734 `v := Val(num, code)` stands for `Val(num, v, code)` (System.@ValLong). L2370 `s <= 8` is compiled as `0 <= s <= 8` (JL/JG) on a zero-extended byte. L2410/L2409 call the routine `ov25_13BC` that the listing (and L2886 of this file) names `DualClassActive`. L2729 writes `g_4FC5` / `g_4FC6` where the listing labels them `pic_HeadId` / `pic_BodyId` (COMBAT names).

## Sweeps (whole area)

- **Call-argument order.** argcheck 0 MISMATCH (127 OK, 583 UNSURE). Text-routine argument counts over the whole area: DrawWrappedText 4 calls, ClearTextRectangle 4, DrawText 27, ClearRectangle 10, ShowBottomPromptAndReadKey 2, ShowTimedBottomPrompt 2 — all with the Curse counts (bg colour present). The sampled multi-argument calls (L128/L2339 BuildItemName 6, L306 KillCombatant 3, L353/L580 ShowCharacterMessage 4, L711 ShowCombatMessageAnimation 3, L855 AnimateAlongPath 6, L1113 AddEffect 5, L458/L1258 RemoveEffect 3, L1938 InputNumber 3, L2557 AllocPicture 5, L2614 DrawPicture 6, L2686 BuildTargetList 6, L2729 LoadPortrait 2 / DrawPortrait 3) are in push order; the three `var` boolean out-parameters (L78, L1953, L2061) are written through `LES DI,[BP+n]`.
- **Signed vs unsigned compares.** 196 anchored compare statements paired with the first conditional jump. Unsigned jumps sit on bytes/words/pointers (AC and HP bytes, morale `<= $7F` JA, `Roll(1,100) <= chance` JA, `Length(num) > 0` JBE, encumbrance words, `mem_spell[k] > $7F` JBE, list pointers via OR/JZ); signed jumps sit on values the pseudocode gives a signed meaning (`p^.plus < 3` JGE, 32-bit TreasureMoney `> 0` JG/JL on the high word then JBE on the low word (L1811, L1919, L1943), the weight bands 151..399 / 513..768 JL/JG, `e < 0` JGE, STR/DEX/level bytes compared with CWD/CBW, `for cls := 0 to 7` JG, `ClassAligns[..] >= k` JC on bytes). No inconsistency.
- **Byte vs word operands.** The ov06 price lines (L47–L54 `Str(LongInt(item^.value div n))`) are a word `DIV`/`SHL` with `XOR DX` before the LongInt push — as written. L100 `gold := Word(MoneyInGold(..))` keeps AX only; L108 `Word(pool - price)` ditto. **Type note (no fix needed):** L2243 `e := LongInt(c^.encumbrance) - StrWeightAllowance(c)` — the code forms the 32-bit difference (SUB/SBB, 6200:03e4–03e6) but stores and compares only the low word (`[BP-2]`, CMP AX / JL / JG at 03eb–0428), so `e` is a 16-bit Integer; the comparisons on L2244–L2247 are 16-bit signed as sampled at L2245.
- **Folded constant array indexes.** Table reads in the sample (ClockLimits 3E2A [u-1], RestClock 7566 [k], StudyTimer 7573 [i], TreasureMoney 6F70 [k*4], ItemTypeTable 5CF4 + type*16 fields 5CF6/5CFC/5CFF, RaceSkillAdj 3F1E [race*8+k], ClassAligns 41D8 [cls*10], cb_ScrCol/cb_ScrRow 67C6/680E, tg_List 6E95 [i*3], ConBonus-type DS tables) all carry a computed index in the code. None read as a scalar.
- **ABS idioms.** Eight NEG-after-JNS sequences in the area's segments: 6200:0957 is written `Abs` (L2310); 6600:0c31 is the `Abs(adj) + bonus` of L3012 (anchored 0c03/0c0a/0c54); 6200:1c39/1c48/1e55/1e83/2090/20be are inside AnimateAlongPath, which the pseudocode summarises in prose (L2590 `|dx|,|dy| <= 6`, L2592 `scrolling with Sign`) — covered, coverage note only.
- **Pascal set tests.** Three `System.@SetIn` calls in the area's segments (5400:0837, 6200:24d0, 6200:2eae), all written `in [...]` at their statements (L1461, L2644, L2773) with the right sense; the other range tests (L472 `81..100`, L1980 `typ in [1..59]`, L2037 `r in [1..5]`, L2425 the DEX case) are compiled as CMP/JL/JG chains, as the pseudocode's ranges say.
- **String length bytes.** L1742 `Length(num) > 0` reads the length byte (JBE); L56/L57 `for k := 1 to Length(..)` loops are bounded by the length byte (JA); L2086/L2088 string assigns copy with the 28h/FFh length limits.
- **Anchors.** anchorcheck 1977 / 0 bad. Two misplaced anchors found: **L135 2b00:07ee** (`'B': ShopBuy`) is the store of the HorizontalMenu result of L133; the case test is 07f4 → **fix request #verify-1**. **L2690 6200:27ef** (`Move(save, g_6E97, $D8)`) is the first instruction of the previous statement `d := tg_List[i].dist div 2` (L2689, whose own anchor 27f5 is mid-statement); the Move is 280b–281a → **fix request #verify-2**.
- **Curse deltas.** Background colour argument present in every text call (sweep D). PARTY uses DrawPicture / AllocPicture / LoadPortrait (L2557, L2614, L2729) with the Curse argument lists; no GetPicture/PutPicture site in the area.

## SCREENS (`PARTY_SCREENS.md`, 18 rows)

Every quoted text was located in the listings' `[ps] cs:"…"` references (ov06 029f `Items: `, 02ae `Buy`, 0377 `OverLoaded`, 0610 `Not enough Money.`, 07a3 / 07b8 the two shop menus, 086a `~Yes ~No`, 0898 / 08c1 the shopkeeper lines; ov20 0615 `Rest Time:`, 073c the rest menu, 08d8 `The Whole Party Is Healed`, 0999 `has memorized`, 0ac4 `has scribed`, 0d7f `Stop Resting? `, 0e4a `Your repose is suddenly interrupted!`; ov21 023f / 0512 / 0aab the overload messages, 0bf1–0c98 the coin names, 0e20 `Select type of coin `, 0e30 `Select`, 0ea5 `How much ` / 0eba `will you take? `, 19b8–1d8a and 2044–20e6 the appraisal texts and menus; ov24 07cd `Name`, 07ee `AC  HP`, 0a96 `Hitpoints`, 0bce `(Helpless)`, 1618 / 16a0 the LoseItem messages, 255a / 256f / 33f5 healing messages, 289c `Guarding`, 2d88 ` camping`, 2dc2 ` search`, 2e92 ` Exit`, 2efe `Select`; ov25 0f2c `Pick New Class`, 1001 ` doesn't qualify.`, 104f `Select`, 11bd ` is now a 1st level `; the ov12 effect messages seen in the sample at 3600:04d8, 1063, 14ec, 15cf, 0c46/1cdb). Colours checked at the push sequences: PARTY-04 `DrawWrappedText(1, 17, 38, 22, 0Ah, 0, 1, …)` then `(…, 0Fh, 0, 0, …)` (2b00:087d–08cb); PARTY-08 row 19 colour 0Ah (5400:08c7–08d2); PARTY-09 row 19 colour 0Fh (5400:0e39–0e44); PARTY-13 `Name` / `AC  HP` in 0Fh on 0 (6200:07c2–07f8); PARTY-18 `ShowTimedBottomPrompt(s, 4, 0Fh)` (6600:100b–1011) = "4 on 0Fh".

| row | result |
|---|---|
| PARTY-01 .. PARTY-18 | agree (strings, colours, windows and triggers as cited; the menus at 2b00:07cb `HorizontalMenu(prompt, opts, 0Dh, 0Ah, 0Fh, 1, 0, ext)` and 5400:073c match the key lists) |

`acceptance/ref/` holds only the title-screen captures (ENGINE / RESIDENT-01); no PARTY screen has a reference capture.
