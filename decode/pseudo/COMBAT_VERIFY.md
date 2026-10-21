# COMBAT — independent verification (cab-verify, cab-rt / Opus)

Verified file: `decode/pseudo/COMBAT.pas.md` at c80a8dd (SHA-256 prefix `cb0762fe44273f6d`, 2155 anchored statements in
```pascal blocks) and `decode/pseudo/COMBAT_SCREENS.md` (47 rows). Author lane: cab-mod-combat (Fable). The area file was
not edited; every DISAGREE is a fix request in STATUS.md (`COMBAT fix request #verify-1` .. `#verify-31`).

## Summary

| check | result |
|---|---|
| argcheck (fresh run, `argcheck.py COMBAT --out` scratch) | 1213 calls, **0 MISMATCH**, 117 OK, 1096 UNSURE (the committed COMBAT_ARGCHECK.md says 147 OK / 1066 UNSURE: drift from the listings re-export at c2c1dce, no new MISMATCH) |
| anchorcheck | 2856 anchors, **0 bad** |
| 10 % sample (216 statements, seed `"1989COMBAT"`) | **186 AGREE, 29 DISAGREE, 1 UNSURE** |
| — of the DISAGREEs: code / semantics | 1 (2941: loop variable is the global DS:7747) |
| — of the DISAGREEs: cite lands in another statement | 28 |
| sweeps (whole area) | 2 DISAGREE (phantom menu prompts `View:` / `Items:`), rest clean (details below) |
| SCREENS rows | 47 rows, 48 addresses all instruction starts; **2 DISAGREE** (COMBAT-19-02 / 19-03 prompts, same cause as the sweep finding); no acceptance/ref capture covers COMBAT (only REF-TITLE-1) |
| fix requests posted | **31** (#verify-1 .. #verify-31) |

Assessment: the code is sound — one semantic deviation in 216 sampled statements, and argcheck / set / Abs / signedness /
text-arity sweeps are clean. The cites are the weak point: 28 / 216 (13 %) point one statement early (the anchor is an
instruction of the previous statement: its last store, its closing JMP, or the loop-end test before it). That matches
the author's own self-check (13 cites corrected) and suggests the same shift exists in roughly one cite in eight
outside the sample; a cite pass over the whole file (anchor = first instruction of the statement's own code) is
recommended rather than fixing only the 28 listed.

## Method

- Sample: `python -I decode/tools/pseudo_check.py COMBAT --after 9` (ported from Pool, this lane): every ```pascal line
  with a `{ seg:off` anchor (2155), `random.seed("1989COMBAT")`, 10 % rounded up = 216; each statement read against
  the listing from its anchor (plus `rng`-style dumps of the surrounding code where the window was not enough).
- Cite rule used: AGREE when the anchor lies inside the statement's own instruction range (an `else` may cite its
  else-jump, a call statement may cite its CALL); DISAGREE when the anchor is an instruction of another statement.
- Sweeps: scratch scripts over all 2155 statements (window = anchor up to the next anchor of the same segment):
  signed/unsigned conditional jumps after byte compares vs. the Pascal comparison, VM cell (`Mem[]`) accessed as a byte,
  Abs idioms (`OR AX,AX / JNS / NEG AX`, `CWD / XOR / SUB`), `in [..]` sets (compare chains, and `System.@SetIn`
  constants read from GAME.OVR at the CS offset), text routines' arity with the Curse bg colour, GetPicture /
  PutPicture, `Length` / `[0]` uses, every string literal against GAME.OVR + START.EXE, and per statement the CS
  strings actually loaded (`MOV DI,0xNNNN / PUSH CS`) vs. the literals of the statement.

## Sweep results

| class | result |
|---|---|
| call-argument order | argcheck 0 MISMATCH over 1213 calls (Pascal left-to-right push order holds wherever provable) |
| signed vs unsigned | 10 statements compile to signed jumps (JL/JG/JLE/JGE) after a byte compare with no ShortInt marker in the Pascal: party_MapX/Y (2c00:1b65/1b7e), cb^.initiative (3a00:00b4), v (3a00:135d), AttackRollValue (3a00:4818, 5f00:11ee, 5f00:1260), level[]/old_level[] (5000:261a, 5f00:1b85, 5f00:1bc8). All consistent with the fields being ShortInt in the source; the Pascal reads correctly for the value ranges involved. **Note for the port:** level[], old_level[], initiative, AttackRollValue are signed bytes (also 5000:35f7 `old_level[3] > 0` = JLE). 1 regex hit on `v < 0` (3a00:13d5) is a correct JGE. No DISAGREE |
| byte vs word | VM cells: 3 byte reads of a VM word (2c00:0663, 2c00:06c3, 5f00:128d) are all written `Lo(Mem[..])` — correct. No DISAGREE |
| folded constant index read as scalar | Pascal uses scalar `g_XXXX` names for 11 globals; none is a folded element of an array except **DS:758E**: 3a00:19e8 writes `CombatRound + 0Fh` to DS:758E while combat_names.json registers DS:758E as `foe_List` (the code indexes it from 1, `[DI+758E]`, i = 1..n). 758E is a separate byte (`combat_MaxRounds`: ov08 2F00:0A84 ends the battle when CombatRound reaches it; MAGIC lane, globals request #3) and foe_List is the 1-based array declared at 758F — GLOBALS now says so (a320232); `combat_names.json` should re-key foe_List to DS:758F (naming only, the Pascal `foe_List[i]` reads are right). Stale scalar names where COMBAT itself registered a name: g_6F95 (= DamageType, 3a00:022f, ov19 L2624), g_7582 (= item_HookMode), g_71F2 (= item_HookProc), g_758E (above) |
| Abs idioms | 4 `OR AX,AX / JNS / NEG AX` sites in the COMBAT units (3a00:1324, 29ea, 29f9; 5000:084c), all rendered `Abs(..)` |
| set tests | 30 `in [..]` uses; 4 SetIn constants decoded from GAME.OVR (3a00:1f6f [6,7,8], 3a00:3c07 [#0,'E'], 5000:0e50 ['I','S','T'], and the `[0..5]` case chain 5000:1dab..1e17) — all agree |
| string length byte | 32 `Length(..)` / `[0]` statements (most are `readied[0]` / `level[0]` hits); of the 11 real Length uses, 6 were read against the asm (2c00:16e1, 2c00:18a9, 5000:00b2, 5000:060b, 5000:0f46, 5000:2d64): each reads the length byte (`MOV AL,ES:[DI]` / `[BP+x]`, CoinName stride 0Bh) — agree; the other 5 not individually checked |
| cite anchors on instruction starts | anchorcheck 0 bad (but see the cite-shift finding above) |
| Curse text routines (bg colour) | every `DrawText` (5 args), `DrawWrappedText` (8), `ShowBottomPromptAndReadKey` (3), `ShowTimedBottomPrompt` (3), `ReadBottomLine` (4), `ReadWordNumber` (3) call in the Pascal has the Curse arity — 0 violations |
| GetPicture / PutPicture | not called by the COMBAT units |
| string literals | 215 literals checked against the binary: 3 not found. `' takes and hides his share.'` / `'... her share.'` (2900:1619/1669) are built from `' takes and hides '` + `'his'`/`'her'` + `' share.'` — equivalent, note only. **`'View:'` (5000:0daa) and `'Items:'` (5000:18a1) do not exist: both prompts are the empty string** — `MOV DI,0B09h` / `MOV DI,14F4h` point at a zero byte (cs:0B09 is inside the set constant [#0,'E'] at cs:0B08, cs:14F4 likewise a 0 byte); the strings `'Items: '` (with a space) in the binary belong to ov05 / ov06. DISAGREE (#verify-30, #verify-31) |

## SCREENS check

All 47 rows: trigger addresses are instruction starts (48 / 48); 226 text fragments compared with the binary — every
one found except composite or symbolic ones (`<name> takes and hides his share.` = three strings; finale pages = 4
strings each; `'s Items` / `'s Spells in Memory` = DrawCharacterName possessive + `Items` / `Spells ` + mode string;
`STR INT WIS DEX CON CHA` = six strings) and two real deviations:
- **COMBAT-19-02** View menu: "prompt `View:`" — the prompt is empty (5000:0da5 `MOV DI,0B09h`, zero-length). DISAGREE (#verify-30).
- **COMBAT-19-03** Items list: "list prompt `Items:`" — empty (5000:189c `MOV DI,14F4h`). DISAGREE (#verify-31).
Layout spot checks against the asm: 19-01 (`(NPC)` at Length(name)+3, colour 10, 5000:00b2), 19-03 (row 3 col 1
colour 15 `Ready Item`, 5000:186a), 13-01 (`point ` / `points ` + `of damage` strings); against the (sampled, AGREE)
Pascal: 05-01 (row 3 col 1 colour 10), 05-06 (window 1,17..38,22, question colour 15) — agree. acceptance/ref has no COMBAT capture (only REF-TITLE-1), so no capture comparison was possible.

## Sample table

Seed `"1989COMBAT"`, 216 of 2155 statements. Line = COMBAT.pas.md line.

| line | address | statement | verdict | evidence |
|---|---|---|---|---|
| L54 | 2900:01a1 | `TreasureItems^.next := old;` | AGREE | (01a1 path: list empty, old=nil, next:=nil; 020a: next:=old) |
| L67 | 2900:02cb | `it := TreasureItems;` | AGREE | asm matches |
| L72 | 2900:031f | `xp := total div Word(Mem[7F3E] - NonSharing);` | AGREE | asm matches |
| L85 | 2900:03a2 | `0: if c^.wis > 15 then share := xp div 10 + xp;` | AGREE | asm matches |
| L114 | 2900:05e4 | `c := c^.next;` | AGREE | asm matches |
| L122 | 2900:068a | `PartyDead := 0;` | AGREE | note: g_4FC7 called PartyDead, not registered |
| L129 | 2900:0715 | `ComputeCombatXP(CombatXP);` | AGREE | asm matches |
| L146 | 2900:0821 | `if c^.status = 3 then begin c^.status := 0; c^.active := 1; c := c^.next end` | AGREE | asm matches |
| L155 | 2900:087c | `c := PartyHead;  stop := false;` | AGREE | asm matches |
| L161 | 2900:08d8 | `Mem[7F3E] := 0;` | AGREE | asm matches |
| L171 | 2900:0947 | `c := PartyHead;` | AGREE | asm matches |
| L175 | 2900:098e | `c := c^.next;` | AGREE | asm matches |
| L188 | 2900:0aa0 | `else if PartyFled = 0 then begin` | AGREE | asm matches |
| L213 | 2900:0cec | `redraw := 1;` | AGREE | asm matches |
| L216 | 2900:0d01 | `while it <> nil do begin` | AGREE | asm matches |
| L236 | 2900:0e18 | `if TreasureItems = sel then TreasureItems := sel^.next` | AGREE | asm matches |
| L243 | 2900:0e86 | `if sel <> nil then FreeMem(sel, $3F);` | DISAGREE | 0e86 is the hi-word store of sel^.next:=nil; statement starts 0e8a |
| L244 | 2900:0ea0 | `if TreasureItems = nil then done := true;` | AGREE | asm matches |
| L248 | 2900:0eb6 | `ov24_2A6D;` | AGREE | asm matches |
| L255 | 2900:0ee1 | `if not money then begin TakeLootItems; exit end;` | AGREE | asm matches |
| L298 | 2900:1262 | `ov21_0F5B(money, items);` | AGREE | asm matches |
| L303 | 2900:12d4 | `DrawWrappedText(1, 17, 38, 22, 15, 0, 0, 'Do you want to go back and claim your treasure?');` | AGREE | asm matches |
| L305 | 2900:131c | `else ClearTextRectangle(1, 17, 38, 22);` | AGREE | asm matches |
| L308 | 2900:1333 | `'G', 'O': begin ov19_32DC(key); PartySummary(SelectedChar) end;` | AGREE | asm matches |
| L378 | 2900:175d | `RemoveMonstersAfterCombat;` | AGREE | asm matches |
| L394 | 2900:1820 | `while it <> nil do begin n := it^.next; FreeMem(it, $3F); it := n end;` | AGREE | asm matches |
| L397 | 2900:185c | `Mem[7EC7] := $80;` | AGREE | asm matches |
| L401 | 2900:18af | `ShowBottomPromptAndReadKey(13, 0, 'Press any key to continue');` | AGREE | asm matches |
| L405 | 2900:18d4 | `Mem[7EE3] := 0;` | DISAGREE | 18d4 stores +6E4 (Mem[7F72]); Mem[7EE3] (+5C6) is 18df |
| L406 | 2900:18df | `Mem[7EE6] := 0;` | DISAGREE | 18df stores +5C6 (Mem[7EE3]); Mem[7EE6] (+5CC) is 18ea |
| L458 | 2c00:04ec | `while (steps < 2) and not blocked do` | AGREE | asm matches |
| L469 | 2c00:0555 | `pic_HeadId := head;  pic_BodyId := body;` | DISAGREE | cite: 0555 is `g_8B63 := 0` (the previous line, same anchor); pic_HeadId := head is 055a / pic_BodyId 0560 |
| L478 | 2c00:05a0 | `if not shown[1] then begin` | AGREE | asm matches |
| L492 | 2c00:0648 | `if view_Mode <> 4 then exit;` | AGREE | asm matches |
| L544 | 2c00:1861 | `ov19_32DC(key);  PartySummary(SelectedChar);  key := #0;` | AGREE | asm matches |
| L550 | 2c00:18a9 | `while (k <= Length(keys)) and (keys[k] <> key) do k := k + 1;` | AGREE | asm matches |
| L593 | 2c00:1cb1 | `r^ := me^;` | AGREE | asm matches |
| L617 | 2c00:1e19 | `for k := 0 to 6 do c^.money[k] := Trunc(c^.money[k] * f);` | AGREE | asm matches |
| L637 | 2c00:213d | `c := PartyHead;` | AGREE | asm matches |
| L652 | 2c00:2259 | `if c^.status = 6 then exit;` | AGREE | asm matches |
| L705 | 3100:0169 | `else if cb^.castingSpell <> 0 then begin` | AGREE | (0169 = the else jump) |
| L714 | 3100:0206 | `if ov13_3E56(c, $FF, 1, 0) and (cb^.initiative > 0) and (c^.active <> 0) then` | AGREE | asm matches |
| L735 | 3100:02f9 | `BuildTargetList(x, y, spells_Table[spell].areaSize, $FF, 1, cm_Map);` | AGREE | asm matches |
| L758 | 3100:049d | `Result := true;` | AGREE | asm matches |
| L760 | 3100:04a1 | `end else Result := true;` | DISAGREE | cite: 04a1 is the shared exit; the outer else (Result := true) is 3100:0404 (reached from 03e8 JZ / 0402 FindHealTarget true); semantics agree |
| L777 | 3100:05ae | `if AiSpellUseful(c, sp, minValue) then chosen := it;` | AGREE | asm matches |
| L793 | 3100:0612 | `if cb^.mayCast <> 0 then` | AGREE | (0612 2nd instr of statement) |
| L821 | 3100:07b6 | `if CombatTerrain[tile] = $FF then exit;` | AGREE | asm matches |
| L823 | 3100:07f1 | `if (occupant = 0) and (cost < cb^.moveLeft) then begin` | DISAGREE | cite: 07f1 / 07fc are the even-dir cost (previous statement); the test is 0807 (occupant [BP-8]) / 0810 (cost < moveLeft, JC); next line's hit1E test 0807 is really 0824 |
| L837 | 3100:098a | `if cost <= cb^.moveLeft then Result := true;` | AGREE | (098a 2nd instr) |
| L866 | 3100:0c40 | `ai_StuckCount := ai_StuckCount + 1;` | AGREE | asm matches |
| L885 | 3100:0d97 | `ov23_0E45(c, 1);` | AGREE | asm matches |
| L888 | 3100:0da5 | `end else AiEndTurn(c);` | AGREE | asm matches |
| L894 | 3100:0db7 | `ai_LastStepDir := 8;  ai_StuckCount := 0;  g_47F2 := 0;` | AGREE | asm matches |
| L899 | 3100:0e13 | `while not done and going do begin` | DISAGREE | cite: 0e13 `MOV [BP-3],0` is the then-part of `if initiative = 0 then going := false`; the while test is 0e17 / 0e20 |
| L904 | 3100:0ea8 | `steps := steps + 1;` | DISAGREE | cite: 0ea8 is the JMP of the `continue` line; steps := steps + 1 is 0eab (the `continue` line itself cites 0e13, should be 0e99) |
| L908 | 3100:0ed8 | `if c^.readied[0] <> nil then range := ITEMS[c^.readied[0]^.itype].range - 1;` | AGREE | asm matches |
| L911 | 3100:0f29 | `if (tgt^.active = 0) or (tgt^.side = 0) then tgt := nil;` | AGREE | asm matches |
| L916 | 3100:0f9d | `if TraceLine(CombatantCol(c), CombatantRow(c), tx, ty, dist, cm_Map) and (dist div 2 <= range) then` | AGREE | asm matches |
| L933 | 3100:10e9 | `FocusSquare(CombatantCol(c), CombatantRow(c), 2, ov13_29A2(c, tgt));` | AGREE | asm matches |
| L940 | 3100:1186 | `if ov24_305B(c) and (ov24_274C(c, tgt) = 1) then ammo := nil;` | AGREE | asm matches |
| L990 | 3100:13d6 | `ov24_17D6(c, 'is forced to flee', 10, 1);` | AGREE | asm matches |
| L998 | 3100:145b | `saved := morale_Value;` | AGREE | asm matches |
| L1002 | 3100:14a7 | `if ov13_2EAC(c) > ov13_0124(c) div 2 then begin` | AGREE | asm matches |
| L1047 | 3100:17f5 | `if s > missileScore then begin bestMissile := it; missileScore := s end;` | DISAGREE | cite: 17f5 is the JZ of the wflags2 and $10 test (previous line); s > missileScore is 17f7 |
| L1067 | 3100:1970 | `if (ammo <> nil) or (fl = $0A) then canShoot := true;` | AGREE | asm matches |
| L1088 | 3100:1b88 | `RecalcItems(c);` | AGREE | asm matches |
| L1122 | 3a00:0042 | `CalcAttacks(c);` | AGREE | asm matches |
| L1124 | 3a00:0050 | `StatKind := 0;` | AGREE | asm matches |
| L1133 | 3a00:00fe | `end else cb^.initiative := 0;` | AGREE | (else jump) |
| L1158 | 3a00:023d | `ov23_03FE(4, att);` | AGREE | asm matches |
| L1167 | 3a00:0386 | `row := $0C;` | AGREE | asm matches |
| L1180 | 3a00:04db | `if tgt^.status <> 8 then DrawWrappedText($17, row, $26, row + 3, 10, 0, 1, s);` | AGREE | asm matches |
| L1194 | 3a00:05bf | `if tgt^.status = 5 then DrawText($17, row, 10, 0, 'and is Dying');` | AGREE | asm matches |
| L1199 | 3a00:063e | `if tgt^.active = 0 then RemoveCombatant(tgt) else MessageDelay;` | AGREE | asm matches |
| L1214 | 3a00:071d | `FaceAttacker(e, c);` | AGREE | asm matches |
| L1223 | 3a00:075b | `idx := CombatantIndex(c);` | AGREE | asm matches |
| L1225 | 3a00:0775 | `nx := ox + step_dx[dir];  ny := oy + step_dy[dir];` | DISAGREE | cite: 0775 / 0780 compute oy := cb_Row[idx] ([BP-6], 66A4h) of the previous line; nx/ny start at 0787 (previous line's ox is 076e, not 076a) |
| L1240 | 3a00:091e | `PlayOrStopSound(g_25C0);` | AGREE | asm matches |
| L1269 | 3a00:0b7d | `for k := cb(e)^.facing + 6 to cb(e)^.facing + 10 do` | AGREE | asm matches |
| L1323 | 3a00:0ec3 | `if (cb^.attacked = 0) or (n < old) or ((n < 2 * old) and not missile) then` | AGREE | asm matches |
| L1324 | 3a00:0f04 | `c^.attacks_left[1] := n;` | AGREE | asm matches |
| L1346 | 3a00:0ffe | `if cnt <= att^.attacks_left[1] then exit;` | DISAGREE | cite: 0ffe is the for-loop end test (CMP [BP-0Ah]); `if cnt <= attacks_left[1]` is 1003 (JA 1013 / JMP exit) |
| L1373 | 3a00:1188 | `saved := cb(att)^.target;  cb(att)^.target := tgt;` | AGREE | asm matches |
| L1385 | 3a00:1257 | `any := false;  stop := false;` | AGREE | asm matches |
| L1392 | 3a00:12b6 | `else if (lv >= 9) and (lv <= 13) then col := 9 else col := 10;` | DISAGREE | cite: 12b6 is the `lv <= 8` test of the previous line; the else-if test is 12c7 / 12cb |
| L1393 | 3a00:12e5 | `while FindTurnTarget(c, u) and (count <> 0) and not stop do begin` | AGREE | asm matches |
| L1405 | 3a00:1363 | `cb(u)^.turned := 1;` | AGREE | asm matches |
| L1417 | 3a00:1428 | `ov24_18BE;` | AGREE | asm matches |
| L1438 | 3a00:14f4 | `done := 0;` | AGREE | asm matches |
| L1439 | 3a00:14fb | `SlotHits[1] := 0;  SlotHits[2] := 0;  SlotSwings[1] := 0;  SlotSwings[2] := 0;` | AGREE | asm matches |
| L1447 | 3a00:15a5 | `ShowAttackResult(att, tgt, 3, tgt^.hp + 5, 1, 1);` | AGREE | asm matches |
| L1449 | 3a00:15b3 | `for k := 1 to 2 do att^.attacks_left[k] := 0;` | AGREE | asm matches |
| L1452 | 3a00:15d2 | `if (att^.readied[0] <> nil) and ((tgt^.size > $80) or ((tgt^.size and 7) > 1)) then begin` | DISAGREE | cite: 15d2..15dd is the previous line `anyHit := true; done := 1` (that line cites 15c6 = the attacks_left loop store); the if is 15e0 / 15ef |
| L1480 | 3a00:183b | `if tgt^.active = 0 then stop := true;` | AGREE | asm matches |
| L1485 | 3a00:1891 | `for k := 1 to 2 do att^.attacks_left[k] := 0;` | AGREE | asm matches |
| L1503 | 3a00:1972 | `diff := (d - cb(def)^.facing + 8) mod 8;` | AGREE | asm matches |
| L1530 | 3a00:1b6b | `savedSel := SelectedChar;  SelectedChar := att;` | AGREE | asm matches |
| L1557 | 3a00:1d07 | `else band := dist;` | DISAGREE | cite: 1d07 is the OR AL,AL test of the WeaponIsRanged if; band := dist is 1d31 |
| L1558 | 3a00:1d37 | `if ShortInt(dist) - ShortInt(band) > 0 then begin dist := dist - band; ac := ac + 2 end;` | AGREE | asm matches |
| L1568 | 3a00:1dfc | `best := nil;  body := 0;  minHp := $FF;` | AGREE | asm matches |
| L1605 | 3a00:2122 | `t := cb(SelectedChar)^.target;` | AGREE | asm matches |
| L1624 | 3a00:2226 | `ok := 1;  SpellTargetCount := 0;  SpellArea := 0;` | AGREE | asm matches |
| L1626 | 3a00:2257 | `code := spells_Table[spell].target and $0F;` | AGREE | asm matches |
| L1672 | 3a00:2659 | `if not dup then begin` | DISAGREE | cite: 2659 `MOV [BP-0Dh],1` is dup := true inside the scan loop; `if not dup` is 2665 |
| L1677 | 3a00:26cc | `RedrawSquare(CombatantCol(t.char), CombatantRow(t.char));` | AGREE | asm matches |
| L1730 | 3a00:29ae | `ax := CombatantCol(a);  ay := CombatantRow(a);  bx := CombatantCol(b);  by := CombatantRow(b);` | AGREE | asm matches |
| L1760 | 3a00:2cdb | `else ov24_1975($0D + d mod 4, d div 4, 0, 0);` | AGREE | asm matches |
| L1795 | 3a00:2eb6 | `p := PartyHead;` | AGREE | asm matches |
| L1818 | 3a00:2ffb | `ov24_25D4;` | AGREE | asm matches |
| L1870 | 3a00:3444 | `if cx < 0 then cx := 0;  if cy < 0 then cy := 0;  if cx > $31 then cx := $31;  if cy > $18 then cy := $18;` | AGREE | (signed JGE/JLE match ShortInt cx/cy) |
| L1879 | 3a00:3546 | `under := nil;` | DISAGREE | cite: 3546 is the DIV of the previous statement; under := nil is 354b (BP+16h/18h) |
| L1885 | 3a00:35d8 | `if under <> nil then begin combat_Shown := 1; ov24_0A34(under) end` | DISAGREE | cite: 35d8 is the until-test of the previous loop (CMP [BP-30h],[BP-3Ah] / JNZ); `if under <> nil` is 35e0 |
| L1905 | 3a00:379f | `if mode = 1 then ConfirmTarget(att, tgt.char, 1, ok, tgt) else ok := 1;` | AGREE | asm matches |
| L1932 | 3a00:39e3 | `if cur > n then cur := 1;` | DISAGREE | cite: one-statement shift in this routine: 39d0 is cur := cur + step's ADD, `if cur = 0` is 39d5; 39e3 is `cur := n`, `if cur > n` is 39f0 (JBE, unsigned); the next line `t := ...` (39f0) is 3a0b |
| L1963 | 3a00:3c93 | `'M', 'H', 'K', 'G', 'O', 'Q', 'I': begin` | DISAGREE | cite: 3c93 is the JMP ending the 'P' branch; the label tests start 3c96. Note: the binary tests 4Dh,48h,50h,4Dh,4Bh,47h,4Fh,51h,49h — 'P' (dead, taken at 3c85) and 'M' twice; Pascal list equivalent |
| L1978 | 3a00:3e03 | `t := NextTarget(move, Ord((ok = 0) and not (key in [#0, 'E'])));` | AGREE | asm matches |
| L1999 | 3a00:3f4b | `r := Roll(1, n);` | AGREE | asm matches |
| L2023 | 3a00:409a | `and not HasEffect(tgt, $0D, e) then begin` | AGREE | asm matches |
| L2058 | 3a00:4350 | `tries := tries - 1;` | DISAGREE | cite: 4350 stores TargetDistance into dist [BP-3] (previous statement); tries := tries - 1 is 4353 |
| L2061 | 3a00:436c | `used := used or 1;` | DISAGREE | cite: 436c is the OR AL,AL of the `(used and 1) = 0` test; used := used or 1 is 4370 |
| L2066 | 3a00:43da | `end else if (dist < 4) and ((used and 2) = 0) then begin` | AGREE | (else jump) |
| L2074 | 3a00:4480 | `ov24_17D6(c, 'fires a death ray', 10, 1);` | AGREE | asm matches |
| L2084 | 3a00:453e | `end else if (used and $10) = 0 then begin ov22_1263($54, 1, 1, x); used := used or $10 end` | AGREE | asm matches |
| L2119 | 3a00:47ea | `ov23_010E(c, $90, nil);` | AGREE | asm matches |
| L2124 | 3a00:475e | `if event = 0 then begin eff^.p4 := 0; ov23_010E(c, $90, eff) end;` | AGREE | asm matches |
| L2144 | 3a00:48f1 | `if ParamStr(2) = CopyProtWord then begin` | AGREE | asm matches |
| L2176 | 4e00:0027 | `Intr($10, Regs);` | AGREE | asm matches |
| L2190 | 4e00:006d | `if VideoMode = 1 then begin` | AGREE | note: VideoMode = g_4FE6 (unregistered) |
| L2191 | 4e00:007a | `SetEgaPaletteRegister(9, 15);  Delay(1);` | AGREE | asm matches |
| L2286 | 4e00:09ef | `fw_Key := #0;` | AGREE | asm matches |
| L2294 | 4e00:0a9a | `fw_VX0 := fw_VX;  fw_VY0 := fw_VY;` | AGREE | asm matches |
| L2337 | 4e00:12c7 | `page 3: '''I am trapped without escape, you have succeeded ' … 'nothingness.'` | AGREE | asm matches |
| L2343 | 4e00:1445 | `Mem[4CFF] := 0;` | AGREE | (4B00 + 3FEh/2 = 4CFF) |
| L2345 | 4e00:148d | `page 5: 'The Knights of Myth Drannor rush in, '' … 'this  foul place, to a fine feast.'''` | AGREE | asm matches |
| L2350 | 4e00:15e1 | `view_Mode := view_PrevMode;` | AGREE | asm matches |
| L2351 | 4e00:15e7 | `ov24_2A6D;` | AGREE | asm matches |
| L2387 | 5000:0225 | `DrawText(1, 5, 15, 0, ClassName[ViewChar^.class]);` | AGREE | asm matches |
| L2390 | 5000:02ff | `DrawText(1, i + 7, 10, 0, s);` | AGREE | asm matches |
| L2411 | 5000:04eb | `if ViewChar^.readied[2] <> nil then begin` | AGREE | asm matches |
| L2413 | 5000:0540 | `ov24_0467(ViewChar, ViewChar^.readied[2], 8, row, 0, 1);` | AGREE | asm matches |
| L2415 | 5000:0545 | `row := row + 1;` | AGREE | asm matches |
| L2417 | 5000:058e | `DrawText(8, row, 10, 0, StatusName[ViewChar^.status]);` | AGREE | asm matches |
| L2425 | 5000:05b3 | `for i := 6 downto 0 do` | AGREE | asm matches |
| L2430 | 5000:063e | `row := row + 1;` | AGREE | asm matches |
| L2444 | 5000:0729 | `col := 8;` | AGREE | asm matches |
| L2447 | 5000:0796 | `s := ov24_10CB(c^.dmg_dice[1]) + 'd' + ov24_10CB(c^.dmg_sides[1]);` | AGREE | asm matches |
| L2451 | 5000:08ab | `DrawText(col + 7, row + 1, 10, 0, s);` | AGREE | asm matches |
| L2466 | 5000:09ca | `col := 5;` | AGREE | asm matches |
| L2470 | 5000:0a34 | `if (stat = 0) and (SelectedChar^.str = 18) and (SelectedChar^.str_exc <> 0) then begin` | AGREE | asm matches |
| L2473 | 5000:0aae | `if SelectedChar^.str_exc = 100 then s := '00';` | AGREE | asm matches |
| L2517 | 5000:0ecf | `if item^.ready <> 0 then ov24_177A('Must be unreadied')` | AGREE | asm matches |
| L2519 | 5000:0f06 | `else if (item^.special[1] > $7F) or (item^.special[2] > $7F) or (item^.special[3] > $7F) then begin` | AGREE | (+3Ch..+3Eh, JA unsigned) |
| L2534 | 5000:12de | `DrawText(20, 2..4, 10, 0, ov24_10CB(item^.namenum[k]));` | AGREE | asm matches |
| L2536 | 5000:13b6 | `DrawText(20, 8, …, identified);  DrawText(20, 9, …, cursed);` | AGREE | asm matches |
| L2560 | 5000:1756 | `if ((c^.npc_morale < $80) or (c^.active = 0) or (c^.status = 1)) and (view_Mode = 1) then` | AGREE | asm matches |
| L2576 | 5000:1919 | `'R': ReadyItem(sel);` | AGREE | asm matches |
| L2587 | 5000:1a3d | `if AskYesNo('Drop It? ', 13, 10, 15) = 'Y' then begin LoseItem(SelectedChar, sel); redraw := 1 end;` | AGREE | asm matches |
| L2592 | 5000:1aaf | `'S': if MayLoseItem(sel) then SellItem(sel) else key := ' ';` | AGREE | asm matches |
| L2608 | 5000:1b89 | `1: if not onReady then begin` | DISAGREE | cite: 1b89 is the end test of the onReady slot-doubling loop; case label 1 is 1b56, `if not onReady` 1b5e (JZ 1b92). The line-2619 else (doubling) cites 1cce..1ce4 (= mem_spell := 0 and the case-2 test); it is 1b64..1b8d. Semantics agree |
| L2617 | 5000:1cab | `if c^.spell_slots[L] < cnt[L] then c^.mem_spell[d] := 0;` | AGREE | asm matches |
| L2620 | 5000:1ced | `2: begin ov23_18D8(c, 3); ov25_0AD8(c) end;` | AGREE | asm matches |
| L2630 | 5000:1d84 | `6: begin ov23_18D8(c, 4);` | AGREE | asm matches |
| L2635 | 5000:1e6a | `$0B: ov25_0AD8(c);` | AGREE | asm matches |
| L2636 | 5000:1e7f | `$0C: ov23_18D8(c, 1);` | AGREE | asm matches |
| L2648 | 5000:1f1c | `if item^.cursed <> 0 then ov24_177A('It''s Cursed')` | AGREE | asm matches |
| L2649 | 5000:1f3c | `else begin item^.ready := 0; if hasHook then ItemReadyEffect(item, 0) end;` | AGREE | asm matches |
| L2653 | 5000:1f87 | `slot := ITEMS[item^.itype].slot;` | AGREE | asm matches |
| L2656 | 5000:1fe3 | `if (item^.itype = $49) and (c^.readied[11] <> nil) then begin err := 2; slot := 11 end;` | AGREE | asm matches |
| L2660 | 5000:2052 | `0: begin item^.ready := 1; if hasHook then ItemReadyEffect(item, 1) end;` | AGREE | asm matches |
| L2684 | 5000:21f9 | `half := item^.count div 2;` | AGREE | asm matches |
| L2700 | 5000:22dd | `nxt := p^.next;` | AGREE | asm matches |
| L2701 | 5000:22ec | `if (p <> target) and (p^.count <> 0) and (p^.namenum[1..3] = target^.namenum[1..3]) and (p^.itype = target^...` | AGREE | asm matches |
| L2714 | 5000:2493 | `spellIdx := -1;  ItemCast := 0;  spell := 0;` | AGREE | asm matches |
| L2715 | 5000:24a7 | `if ov22_612E(item) then begin` | AGREE | asm matches |
| L2759 | 5000:2881 | `DrawWrappedText(1, 21, 38, 22, 14, 0, 1, 'I''ll give you ' + ov24_1107(price) + ' gold pieces for your ' + ...` | AGREE | asm matches |
| L2786 | 5000:2b01 | `m := ov21_00C7(@TreasureMoney);` | AGREE | asm matches |
| L2792 | 5000:2b52 | `if item^.identified = 0 then DrawWrappedText(1, 21, 38, 22, 14, 0, 1, 'I can''t tell anything new about you...` | AGREE | asm matches |
| L2827 | 5000:2e0d | `list := head;  index := 0;  redraw := 1;` | AGREE | asm matches |
| L2853 | 5000:327c | `w := item^.weight;` | AGREE | asm matches |
| L2883 | 5000:3540 | `count := ov22_09FC(mode);` | AGREE | asm matches |
| L2884 | 5000:3548 | `if count = 0 then Result := 0` | DISAGREE | cite: 3548 is the `count^ := AL` store of the previous statement (count := BuildSpellList(mode)); `if count = 0` is 354b / 354e |
| L2897 | 5000:35f7 | `Result := ((c^.class = 3) or ((c^.old_level[3] > 0) and (ov25_13BC(c) <> 0))) and` | AGREE | note: old_level[3] > 0 compiled as JLE (signed) — the field is ShortInt-typed in the source |
| L2915 | 5000:3727 | `lv := c^.level[3] + c^.old_level[3] * ov25_13BC(c);` | AGREE | asm matches |
| L2941 | 5000:38c5 | `for k := 1 to 6 do ov23_010E(whom, DiseaseEffects[k], nil);` | DISAGREE | the loop variable is the global DS:7747 (gfx_LoopCounter: MOV [7747],1 / INC [7747] / MOV AL,[7747]), not a local k; a port must leave DS:7747 = 6 after the cure (any later reader sees it) |
| L2995 | 5f00:011f | `if p = nil then begin` | AGREE | asm matches |
| L3005 | 5f00:01f2 | `q^.next := p^.next;` | AGREE | asm matches |
| L3008 | 5f00:0211 | `if type = $0E then RecalcAbility(c, 5);` | AGREE | asm matches |
| L3030 | 5f00:03d8 | `if found then CallEffectHandler(type, c, e, 0);` | AGREE | asm matches |
| L3045 | 5f00:081e | `$09: [69, 6A, 6B, 6C, 6D, 6E, 6F, 70, 7C, 7D, 3F, 81];` | AGREE | asm matches |
| L3050 | 5f00:0acc | `$0E: [53, 58, 79, 56, 57, 5A, 7E, 80, 83, 84, 8B];` | AGREE | asm matches |
| L3059 | 5f00:0cfe | `$17: [4A];` | AGREE | asm matches |
| L3067 | 5f00:0d0d | `p := list;  found := false;` | AGREE | asm matches |
| L3073 | 5f00:0dd5 | `if found then Result := p^.owner else Result := PartyHead;` | AGREE | asm matches |
| L3081 | 5f00:0e7b | `if (tile = 0) or not poison then exit;` | AGREE | asm matches |
| L3086 | 5f00:0f02 | `saved := SavingThrow(c, 0, 0);` | AGREE | asm matches |
| L3097 | 5f00:1010 | `ApplyEffect(c, $1F, Roll(1, 4) + 1, $FF, 0, 0, saved, 'chokes and gags from nausea');` | AGREE | asm matches |
| L3114 | 5f00:11f5 | `if AttackRollValue = 20 then AttackRollValue := 100;` | AGREE | asm matches |
| L3125 | 5f00:1260 | `if AttackRollValue <= 1 then exit;` | AGREE | (JLE signed, AttackRollValue ShortInt) |
| L3165 | 5f00:145f | `e^.next := nil;  e^.type := type;  e^.duration := duration;  e^.callOnRemove := callOnRemove;  e^.p3 := p3;` | DISAGREE | cite: 145f is the hi-word store of the previous statement (link into the list); `e^.next := nil ...` starts 1463 |
| L3202 | 5f00:165c | `if HasEffect(c, type, e) then begin` | AGREE | asm matches |
| L3204 | 5f00:1696 | `RemoveEffect(c, type, e);` | AGREE | asm matches |
| L3237 | 5f00:17e3 | `if (class = 4) and ((c^.old_level_cap = 0) or (c^.old_level[4] = c^.old_level_cap)) then levels := levels + 1;` | AGREE | asm matches |
| L3246 | 5f00:18de | `new := 0;  newExc := 0;  fixed := $FF;` | UNSURE | four locals are cleared (BP-0Ah, BP-2, BP-4 := 0, BP-11h := FFh); the line names three (new, newExc, fixed) — which local is unnamed is not stated |
| L3249 | 5f00:1909 | `while it <> nil do begin` | DISAGREE | cite: 1909 / 190d is `cur := c^.base_abil[n]` ([BP-1]) and 1910..1917 curExc ([BP-3]) of the previous line; the while test is 191a |
| L3255 | 5f00:19b9 | `else if (kind = 8) and (c^.base_str < 18) and (it^.special[2] = 0) then begin new := c^.base_str + 1; newEx...` | AGREE | asm matches |
| L3259 | 5f00:19f8 | `4: if kind = 6 then cur := cur + 1` | AGREE | asm matches |
| L3293 | 5f00:1cb4 | `for k := 0 to 7 do begin` | DISAGREE | cite: 1cb4 / 1cb7 is the +78h := +12Ch store of the previous line (maxhp := maxhp_base); the for loop is 1cbb |
| L3295 | 5f00:1ce8 | `lv := c^.level[k];  if lv > LevelCap[k] then lv := LevelCap[k];` | AGREE | asm matches |
| L3300 | 5f00:1dd1 | `c^.con := cur;` | DISAGREE | cite: 1dd1 is the hp decrease of the previous line (SUB +1A4h); c^.con := cur is 1de1 / 1de7 |
| L3323 | 5f00:2197 | `ov24_21DD(c, 0, s);` | AGREE | asm matches |
| L3339 | 5f00:22c1 | `RemoveCombatEffects(c);  CallEffectHooks($0D, c);` | AGREE | asm matches |
| L3349 | 5f00:231b | `s := msg;` | AGREE | asm matches |
| L3367 | 5f00:2478 | `if c^.active = 0 then begin` | AGREE | asm matches |
| L3369 | 5f00:2491 | `if (c^.status = 4) and (view_Mode <> 5) then CallEffectHandler($4E, c, nil, 1);` | DISAGREE | cite: 2491 is `status := 4` (previous line, if status = 5); the test is 2497 / 24a2 |
| L3381 | 5f00:2555 | `if c^.side = 1 then s := 'stands up and grins' else s := 'gets back up';` | AGREE | asm matches |
