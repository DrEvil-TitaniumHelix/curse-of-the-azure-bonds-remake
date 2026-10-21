# MAGIC — independent verification (cab-verify, cab-rt / Opus)

Verified file: `decode/pseudo/MAGIC.pas.md` at 3a287eb (SHA-256 prefix `47f8740ac384622b`, 827 anchored statements in
```pascal blocks) and `decode/pseudo/MAGIC_SCREENS.md` (28 rows). Author lane: cab-mod-magic (Fable). Started after the
MAGIC STATUS block was posted DONE (03:52). The area file was not edited; every DISAGREE is a fix request in STATUS.md
(`MAGIC fix request #verify-32` .. `#verify-44`).

## Summary

| check | result |
|---|---|
| argcheck (fresh run, `--out` scratch) | 485 calls, **0 MISMATCH**, 81 OK, 404 UNSURE (committed MAGIC_ARGCHECK.md: 82 OK / 403 UNSURE — listings-name drift, no new MISMATCH) |
| anchorcheck | 1745 anchors, **0 bad** |
| 10 % sample (83 statements, seed `"1989MAGIC"`) | **72 AGREE, 11 DISAGREE, 0 UNSURE** |
| — DISAGREE: code / semantics | 2 (5800:06af `sl_Ids[n]` is `sl_Ids[n-1]`; 5800:344e the cloud-effect search loop condition) |
| — DISAGREE: cite lands in another statement | 9 (three routines shifted by one statement: ov15 ScribeMenu 0d71..0dda, ov22 AddSpellLineCounted 0696..079c, ov15 PartyOrder 188e..18f8) |
| sweeps (whole area) | 1 DISAGREE found while reading context (4000:053c phantom `idx := -1` in the camp Cast loop); everything else clean |
| SCREENS rows | 28 rows, 22 addresses all instruction starts, 210 text fragments: **1 DISAGREE** (MAGIC-22-01 ` (xN)` is ` (N)`) |
| fix requests posted | **13** (#verify-32 .. #verify-44) |

Assessment: the MAGIC code is in good shape (2 semantic slips in 83 statements, both in less common paths); the cite
shift seen in COMBAT occurs here too but clustered in three routines (11 % of the sample), so a per-routine cite pass
of those three is enough.

## Method

As COMBAT_VERIFY.md: `python -I decode/tools/pseudo_check.py MAGIC --after 9` (seed `"1989MAGIC"`, 827 statements,
10 % rounded up = 83), each statement read against the listing (plus full dumps of the surrounding routine where the
statement's meaning depended on it); cite rule: AGREE when the anchor lies inside the statement's own instructions.
Sweeps: the same scratch scripts as for COMBAT (signedness, VM byte access, Abs, sets incl. every `System.@SetIn`
constant decoded from GAME.OVR, Curse text-routine arity, Get/PutPicture, Length, string literals vs the binary and vs
the CS strings each statement loads).

## Sweep results

| class | result |
|---|---|
| call-argument order | argcheck 0 MISMATCH over 485 calls |
| signed vs unsigned | 0 statements with a signed jump after a byte compare and no signed marker in the Pascal; the signed level / old_level compares are written `ShortInt(..)` (e.g. 5800:2c3a) — agree |
| byte vs word | no `Mem[..]` cell read as a byte without `Lo(..)` |
| folded constant index / array base | `sl_Ids` (DS:4B9C, `[0..83]`) is read at `[DI+4B9Ch]` with `DI = n - 1` in AddSpellLineCounted (0661, 06a4, 06b6) but with `DI = n` at 0681 — the Pascal writes `sl_Ids[n]` for all four (DISAGREE #verify-39). SpellTargets is consistently 1-based (`[DI*4+7431h]`, base 7435) — agree. `combat_MaxRounds` (758E) / `foe_List` (758F) and `cm_Map_hi` (6E94): MAGIC's own finding, served as globals request #3 (a320232) |
| Abs idioms | none in ov04/08/15/22 (no `NEG`) |
| set tests | all 14 `System.@SetIn` sites decoded (2f00:0943 / 095d, 10d1, 11f3; 4000:14f1, 184b, 18e2, 1c96, 1d1e, 1ec9, 2497; 5800:0299, 0356, 03a3) — each matches the Pascal set or its `CS:XXXX` reference; compare-chain sets (4000:10b1 effect-type list, 5800:3360 `[$1C, $1E]`) agree |
| string length byte | 12 hits, all `readied[0]` / `level[0]` / `[0]` indexes or `Length(name)` columns — agree |
| cite anchors | anchorcheck 0 bad (cite shifts above) |
| Curse text routines (bg colour) | 0 arity violations |
| GetPicture / PutPicture | not called |
| string literals | 136 literals, all present in the binary as Pascal strings; cs-string per statement check: no wrong string (window-only misses) |
| context finding | **4000:053c** (ov15 Cast loop, L596 `idx := -1`): 053c is `JMP 056C` right after `CastSpell`; there is no store to idx ([BP-2]) inside the loop — only the initial `idx := -1` at 04d5. Lines 590/591 also cite 0570 / 0572 for `else cast := true` / `ok := false` (the `found` branch is 053e..0548, `cast := true` = 0544; there is no `ok` variable: the loop is `if CanUseMagic(1) then repeat .. until s = 0`, 056c). DISAGREE #verify-43 |

## SCREENS check

28 rows; all 22 addresses are instruction starts; 210 text fragments against the binary — all found except code
expressions (`view_Mode := 1`, `menu_Sel := 2`, ...), composite strings (`is in no condition to ` + `cast any spells` /
`memorize spells` / `scribe any scrolls`, `Pics off  ` + `Exit`) and:
- **MAGIC-22-01** Spell list: "` (xN)` = N copies in memory" — the line gets `' ('` + ByteToStr(count) + `')'`
  (5800:07f2 cs:05AF `' ('`, 0817 cs:05B2 `')'`), i.e. ` (3)`, no `x`. DISAGREE (#verify-44).
No acceptance/ref capture covers MAGIC.

## Sample table

Seed `"1989MAGIC"`, 83 of 827 statements. Line = MAGIC.pas.md line.

| line | address | statement | verdict | evidence |
|---|---|---|---|---|
| L21 | 2700:005d | `s := msg;` | AGREE | asm matches |
| L22 | 2700:0076 | `ov24_17D6(SelectedChar, s, 0, 0);` | AGREE | asm matches |
| L30 | 2700:0109 | `s := service;` | AGREE | asm matches |
| L62 | 2700:0327 | `diseased := false;  ok := 'Y';` | DISAGREE | cite: 0327 is the prologue `SUB SP,118h`; the statement is three stores 032b ([BP-107h] := 0), 0330 ([BP-104h] := 0), 0335 ([BP-105h] := 'Y') — one of the two zeroed locals is unnamed in the Pascal, and the next line's for loop (cited 0335) starts at 033a |
| L65 | 2700:0398 | `if ok = 'Y' then` | AGREE | asm matches |
| L99 | 2700:0662 | `if c^.status in [6, 1] then dead := true;` | AGREE | asm matches |
| L101 | 2700:06a3 | `if ok = 'Y' then begin` | AGREE | asm matches |
| L112 | 2700:077b | `if c^.con > 13 then begin` | AGREE | (JNC: con >= 14) |
| L148 | 2700:09bd | `it := it^.next;` | AGREE | asm matches |
| L183 | 2700:0bbf | `DrawText(1, 1, 15, 0, SelectedChar^.name + ', how can we help you?');` | AGREE | asm matches |
| L184 | 2700:0bfc | `key := VerticalListMenu('', 'Heal Exit', 13, 10, 15, 2, 4, $26, $0F, list, 0, redraw, idx, sel);` | AGREE | asm matches |
| L189 | 2700:0c75 | `2: CureWounds(1);` | AGREE | asm matches |
| L192 | 2700:0c9f | `5: CureWounds(4);` | AGREE | asm matches |
| L212 | 2700:0e19 | `FillChar(TreasureMoney, $1C, 0);` | AGREE | asm matches |
| L241 | 2700:100d | `PartySummary(SelectedChar);` | AGREE | asm matches |
| L310 | 2f00:0271 | `cb^[$0F] := 0;  cb^[$12] := 0;  cb^[7] := 0;` | AGREE | asm matches |
| L334 | 2f00:042b | `dummy := ov24_2828(c);` | AGREE | asm matches |
| L337 | 2f00:043a | `while not done do begin` | AGREE | asm matches |
| L363 | 2f00:06b5 | `else ov24_177A('That doesn''t work');` | AGREE | asm matches |
| L399 | 2f00:09e5 | `if c^.status = 5 then begin` | AGREE | asm matches |
| L408 | 2f00:0a73 | `if (side_ActiveCount[0] = 0) or (side_ActiveCount[1] = 0) or (combat_MaxRounds <= CombatRound) then over :=...` | AGREE | (JC: over unless CombatRound < combat_MaxRounds) |
| L410 | 2f00:0ab0 | `if AskYesNo('Continue Battle:', 13, 10, 15) = 'Y' then over := false;` | AGREE | asm matches |
| L433 | 2f00:0d1c | `ProbeMove(c, dir, occ, tile, hit1E, hit1C);` | AGREE | asm matches |
| L434 | 2f00:0d21 | `if occ <> 0 then AttackTarget(c, cb_Char[occ], done)` | AGREE | asm matches |
| L436 | 2f00:0d5c | `case AskYesNo('Flee:', 13, 10, 15) of` | AGREE | asm matches |
| L501 | 2f00:127b | `if GameSpeed <> 0 then opts := opts + 'Faster ';` | AGREE | asm matches |
| L540 | 4000:0091 | `lvMem := lvMem + lv;` | AGREE | asm matches |
| L574 | 4000:029a | `if (SelectedChar^.mem_spell[i] <> 0) and (SpellTable[id and $7F].level = level) and (SpellTable[id and $7F]...` | AGREE | asm matches |
| L586 | 4000:04f0 | `while ok do begin` | AGREE | (equivalent: `if CanUseMagic(1) then repeat .. until s = 0`; no `ok` variable in the binary) |
| L587 | 4000:0505 | `s := SpellList(0, 1, idx, found);` | AGREE | asm matches |
| L593 | 4000:0513 | `cast := true;` | AGREE | asm matches |
| L594 | 4000:0523 | `ClearRectangle(1, $11, $26, $16);` | AGREE | asm matches |
| L620 | 4000:0745 | `DrawText(1, row + $11, 10, 0, s);` | AGREE | asm matches |
| L623 | 4000:079c | `row := row + 1;` | DISAGREE | cite: 079c is the `has[cls]` loop end test (CMP [BP-5Bh],2); row := row + 1 is 0799 (INC [BP-5Eh]) |
| L659 | 4000:0a59 | `k := 0;  while SelectedChar^.mem_spell[k] <> 0 do k := k + 1;` | AGREE | asm matches |
| L689 | 4000:0c78 | `if SelectedChar^.known_spell[s] <> 0 then ov24_177A('You already know that spell')` | AGREE | asm matches |
| L699 | 4000:0d3a | `if SelectedChar^[$12C + SpellTable[s].class*5 + SpellTable[s].level] = 0 then ov24_177A('You can not scribe...` | AGREE | asm matches |
| L701 | 4000:0d85 | `it := SelectedChar^.items;` | DISAGREE | cite: 0d85 is the while test (OR AX / JZ); it := SelectedChar^.items is 0d71..0d7f. The routine is shifted one statement from here: the while line cites 0d90.. (= k := 1), `k := 1` cites 0da2 (= the compare), the special[k] line 0da5.. (its JNZ), `it := it^.next` 0dd8 (the until JZ; the load is 0dda) |
| L706 | 4000:0dc7 | `k := k + 1;` | DISAGREE | cite: 0dc7 is `marked := true` ([BP-0Dh] := 1) of the previous line; k := k + 1 is 0dcb |
| L707 | 4000:0dcb | `until (k >= 4) or marked;` | DISAGREE | cite: 0dcb is k := k + 1; the until test is 0dce / 0dd4 |
| L728 | 4000:105e | `c := PartyHead;` | AGREE | asm matches |
| L734 | 4000:10a1 | `show := true;  t := e^.type;` | AGREE | asm matches |
| L784 | 4000:1842 | `while not (key in [#0, 'E']) do begin` | AGREE | (SetIn cs:17D4) |
| L786 | 4000:188e | `if ext = 0 then begin` | DISAGREE | cite: 188e is the store of key (previous line's HorizontalMenu result); `if ext = 0` is 1891 (JZ 18d9) |
| L789 | 4000:18f1 | `if place then ov24_17D6(SelectedChar, 'has been selected', 10, 0) else ov24_18BE;` | DISAGREE | cite: 18f1 is the JMP inside the previous line's `place := not place` (18e9..18f5); the if is 18f8 |
| L819 | 4000:1b7a | `DrawText(1, $12, 10, 0, 'Game Speed = ' + ov24_10CB(GameSpeed) + ' (0=fastest 9=slowest)');` | AGREE | asm matches |
| L824 | 4000:1c45 | `key := HorizontalMenu('Game Speed:', opts, 13, 10, 15, 1, 1, ext);` | AGREE | asm matches |
| L843 | 4000:1dae | `'P': repeat` | AGREE | asm matches |
| L844 | 4000:1db3 | `if opt_Pics = 0 then opts := 'Pics off  '` | AGREE | (opt_Pics <> 0 -> 'Pics on ' at 1dba, = 0 -> 1e28) |
| L847 | 4000:1e8b | `k := HorizontalMenu('', opts, 13, 10, 15, 0, 1, ext);` | AGREE | asm matches |
| L944 | 4000:256b | `'F': Fix(done);` | AGREE | asm matches |
| L949 | 4000:25bb | `CancelAllStudy;` | AGREE | asm matches |
| L977 | 5800:0102 | `2: if c^.int < 9 then Result := false` | AGREE | (JBE: int <= 8) |
| L978 | 5800:010c | `else if (c^.race <> 7) or (c^.readied[2] = nil) or (view_Mode <> 5) then Result := true` | AGREE | (+159h = readied[2]) |
| L1003 | 5800:03e1 | `FreeMenuList(sl_List);` | AGREE | asm matches |
| L1025 | 5800:06c0 | `prevLevel := SpellTable[sl_Ids[n]].level;` | DISAGREE | index: 06af..06c6 reads sl_Ids at [DI+4B9Ch] with DI = n - 1 (06b3 DEC AX), i.e. sl_Ids[n-1] of the [0..83] array at 4B9Ch, not sl_Ids[n]; the same n-1 index is used by the loop test 0661 (L1019) and the `same spell again` test 06a4 (L1022), while 0681 (L1020) really reads sl_Ids[n] |
| L1030 | 5800:0747 | `if id < $80 then p^.text := '  ' else p^.text := ' *';` | DISAGREE | cite: 0747..0764 is the `same spell again` branch (n := n - 1; prevLevel := ..; Inc(sl_Counts[n]) — L1023 cites it at 06af..06cc, which is the else branch); `if id < $80` is 0768 (CMP [BP+6],7Fh / JBE; cs:05AC '  ', cs:05A9 ' *') |
| L1031 | 5800:077c | `p^.text := p^.text + SpellNames[id and $7F];  p^.header := 0;` | DISAGREE | cite: 077c is the StrAssign of ' *' (previous line); the text + SpellNames append starts 0796..079c |
| L1068 | 5800:0b50 | `2: begin AddItemSpells(false); headings := false end;` | AGREE | asm matches |
| L1084 | 5800:0cde | `GetMem(h, $2E);  h^.next := p^.next;  p^.next := h;  p := h;` | AGREE | asm matches |
| L1106 | 5800:0f3c | `if level = 0 then level := SpellCasterLevel(spell);` | AGREE | asm matches |
| L1109 | 5800:0f91 | `t := SpellTargets[k];` | AGREE | (SpellTargets 1-based: [DI*4+7431h]) |
| L1111 | 5800:0fd6 | `if SpellTable[sp_Current].range = $FF then begin` | AGREE | asm matches |
| L1134 | 5800:1179 | `4: begin SpellTargets[1] := PartyHead;` | AGREE | (index is SpellTargetCount, = 1 from 10fb) |
| L1149 | 5800:12bd | `DrawText(1, $13, 10, 0, SpellNames[spell]);` | AGREE | asm matches |
| L1156 | 5800:137c | `announce := 0;  again := false;` | AGREE | asm matches |
| L1158 | 5800:1392 | `if HasEffect(caster, $4A, e) then` | AGREE | asm matches |
| L1160 | 5800:13d8 | `if (announce <> 0) and (ItemCast = 0) then ShowCasts(caster, 'casts', spell);` | AGREE | asm matches |
| L1163 | 5800:1418 | `if used then begin` | AGREE | asm matches |
| L1166 | 5800:1435 | `ov24_1AAA($12);` | AGREE | asm matches |
| L1169 | 5800:147c | `combat_Visible := 1;  ShowCombatant(caster, dir, 1, 0);` | AGREE | asm matches |
| L1191 | 5800:15dd | `if view_Mode = 5 then ClearRectangle(0, $17, $27, $17);` | AGREE | asm matches |
| L1220 | 5800:1bcb | `if ((t^.creature_type > 1) or (t^.size > 1)) and (sp_Current <> $5E) then saved := true;` | AGREE | asm matches |
| L1322 | 5800:27b4 | `r := cloud_List;` | AGREE | asm matches |
| L1326 | 5800:2847 | `FillChar(r^, $1E, 0);` | AGREE | asm matches |
| L1341 | 5800:2b5f | `FocusSquare(SpellX, SpellY, $FF, 8);  MessageDelay;  ov24_18BE;` | AGREE | asm matches |
| L1343 | 5800:2bc0 | `for k := 1 to 4 do if occ[k] <> 0 then StinkingCloudCheck(cb_Char[occ[k]], 1);` | AGREE | asm matches |
| L1351 | 5800:2c3a | `if (ShortInt(t^.level[0]) > 0) or (t^.old_level_cap < t^.old_level[0]) or (ShortInt(t^.level[6]) > 0) or (t...` | AGREE | (signed JG on level[0]; old_level vs cap signed) |
| L1370 | 5800:2df2 | `if (c^.status = 6) and (c^.creature_type = 0) then` | AGREE | asm matches |
| L1402 | 5800:31e7 | `if e^.p3 <> $FF then begin` | AGREE | (JC: p3 < FFh) |
| L1420 | 5800:344e | `while (e <> nil) and not ((e^.type = $5B) and (tile = $1C) or (e^.type = $28) and (tile = $1E)) or (e^.p3 d...` | DISAGREE | expression: as written `(e <> nil) and not (X) or (e^.p3 div 16 <> q^.index)` parses as `((e <> nil) and not X) or (...)` and dereferences e = nil; the binary (3449..34ad) is `found := false; while (e <> nil) and not found do if (X) and (e^.p3 div 16 = q^.index) then found := true else e := e^.next`, and the next line tests found (34af [BP-8]), not e |
| L1460 | 5800:37e4 | `ApplySpell(sp_Current, 0, 0, RollDice(dice, 6), 9, '');` | AGREE | (cs:370D = '') |
| L1474 | 5800:39f3 | `ov24_1AAA($13);  DamageType := 0;` | AGREE | asm matches |
