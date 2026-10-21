# VIEW — independent verification (cab-verify, cab-rt / Opus)

Verified file: `decode/pseudo/VIEW.pas.md` at 65890c1 (SHA-256 prefix `979f2ffab4c51430`, 253 anchored statements in
```pascal blocks) and `decode/pseudo/VIEW_SCREENS.md` (14 rows). Author lane: cab-mod-eclview (Fable). The area file was
not edited; DISAGREEs are fix requests in STATUS.md (`VIEW fix request #verify-47` .. `#verify-50`).

## Summary

| check | result |
|---|---|
| argcheck (fresh run, `--out` scratch) | 235 calls, **3 MISMATCH**, 71 OK, 161 UNSURE (committed VIEW_ARGCHECK.md: 0 MISMATCH / 61 OK — the listings now name `Roll`, so more calls resolve). The 3 MISMATCH are one line (L488, 3f00:0509) carrying four Roll calls on one anchor: the code agrees (0509 Roll(1,8), 0523 Roll(1,10), 0542 Roll(1,12), 055c Roll(1,20)); the line needs one anchor per call (#verify-50) |
| anchorcheck | 625 anchors, **105 bad** (not instruction starts) — #verify-47, full list below |
| 10 % sample (26 statements, seed `"1989VIEW"`) | **13 AGREE, 13 DISAGREE, 0 UNSURE** |
| — DISAGREE: code / semantics | 1 (RecolorPicture argument order, 6c00:004b — and the same at 3 more call lines) |
| — DISAGREE: anchor inside an instruction | 11 (content agrees in all 11) |
| — DISAGREE: cite in another statement | 1 (3f00:0b5e) |
| sweeps | 1 DISAGREE class (RecolorPicture argument order, 4 call lines); the rest clean |
| SCREENS | 14 rows, 13 addresses all instruction starts, every literal text fragment found (the not-found ones are code expressions / routine names); no DISAGREE; no acceptance/ref capture covers VIEW |
| fix requests posted | **4** (#verify-47 .. #verify-50) |

Assessment: the VIEW content is right in every sampled statement except one call written in Ghidra (reversed) argument
order. The anchors were never snapped to instruction starts (17 % of all anchors, 11 of 26 sampled statements), so a
snap pass as done for COMBAT / MAGIC is needed before a port uses them as cross-references.

## Method

`python -I decode/tools/pseudo_check.py VIEW --after 9` (seed `"1989VIEW"`, 253 -> 26); for the 11 anchors that are not
instruction starts the routine was dumped around the anchor and the statement read against the instructions that hold
it. Sweeps as in COMBAT_VERIFY.md, plus the decoded `System.@SetIn` constants of all VIEW units.

## Sweep results

| class | result |
|---|---|
| call-argument order | argcheck: 3 MISMATCH = shared-anchor artifact (above). **RecolorPicture** (0297:1626, RESIDENT: `RecolorPicture(fromCol, toCol, frame, randomMix, pic)`, first pushed = first parameter): every VIEW call is written in reverse — L254 `RecolorPicture(pic, 1, 0, @g_0AA8, @g_0A98)` is pushed @0A98, @0AA8, 0, 1, pic (6c00:0035..0048) = `RecolorPicture(@g_0A98, @g_0AA8, 0, 1, pic)`; L290 (6c00:04c4..04e3, pic pushed last), L390 / L392 / L393 (7200:03bb.., 048f, 04f8) the same pattern. argcheck rates these UNSURE (pointer arguments), so it did not catch them. DISAGREE #verify-48 |
| signed vs unsigned | no signed jump after a byte compare without a signed marker; the clamps in L29 (JGE/JLE) are on ShortInt locals as written |
| byte vs word | no `Mem[]` cell read as a byte without `Lo()` |
| folded constant index | `step_dx` / `step_dy` (2694 / 269D) indexed by party_Dir as arrays (3f00:0858 / 0867) — agree; `tg_List` now keyed at 6E97 in GLOBALS (globals request #3; VIEW's `eclview_names.json` still says DS:6E94, which is the cm_Map segment word — re-key, naming only) |
| Abs idioms | none |
| set tests | 7 SetIn constants decoded: 7400:0057 [0..4] = L211; 6800:0734 ['1'..'9','\'] = L651; 6800:1183 ['N','Y'] (AskYesNo, L670); 3f00:0374 `[91..99]` compare chain (5Bh..63h) = L478; 6d00:11db [1..3], 6800:0135 / 029d / 06b5 (alphanumeric hot-key sets) are in routines described in prose (no statement to compare) — agree |
| string length byte | 4 hits, all `[0]` array indexes — agree |
| cite anchors | **105 not instruction starts** (table below) |
| Curse text routines (bg colour) | 0 arity violations (resident note #1 applied) |
| GetPicture / PutPicture | L236 7400:02b8 and L252 6c00:0086 call 0297:1110 (`9A 10 11 97 02`) = PutPicture with (col, row, pic) — agree |
| string literals | 27 literals, all present in the binary |

## SCREENS check

All 14 rows: 13 addresses are instruction starts; the text fragments not in the binary are code (`view_Mode = 4`,
`LoadBigPic 6C00:0813`, `fallen_Pic`, `(3, 3, true)`, `from WALLDEFn`, ...), not displayed strings. No DISAGREE.

## Anchors that are not instruction starts (#verify-47)

Containing instruction and the next instruction start (the intended cite is one of the two, or the statement's first
instruction where the containing one belongs to the previous statement — see the sample rows).

| line | anchor | containing instruction | next start |
|---|---|---|---|
| L28 | 6d00:0017 | 0014 SUB SP,0x10a | 0018 |
| L29 | 6d00:0044 | 0042 MOV byte ptr [BP + -0x1],AL | 0045 |
| L30 | 6d00:0071 | 006f MOV byte ptr [BP + -0x2],AL | 0072 |
| L59 | 6d00:02c0 | 02bc CMP byte ptr [0x720a],0xb ; backdrop_C0 | 02c1 |
| L60 | 6d00:02c5 | 02c3 JMP 0x6000:d421 | 02c6 |
| L61 | 6d00:02d7 | 02d6 LES DI,[0x4f99] ; ecl_Mem4B00 | 02da |
| L80 | 6d00:0470 | 046f ADD AX,DX | 0471 |
| L81 | 6d00:0484 | 0482 MOV AL,byte ptr [DI + 0xaec] | 0486 |
| L97 | 6d00:05a3 | 05a2 JZ 0x6000:d5ab | 05a4 |
| L99 | 6d00:05b0 | 05af JMP 0x6000:d6b4 | 05b2 |
| L100 | 6d00:05c7 | 05c4 MOV byte ptr [BP + 0xa],0xf | 05c8 |
| L103 | 6d00:0600 | 05fe CMP AX,0x6 | 0601 |
| L124 | 6d00:0848 | 0847 CMP byte ptr [0x720e],0x0 ; view_AreaMap | 084c |
| L126 | 6d00:0867 | 0865 MOV AL,byte ptr [BP + 0x6] | 0868 |
| L127 | 6d00:08b2 | 08b0 MOV AL,byte ptr [DI + 0x2694] | 08b4 |
| L128 | 6d00:08d2 | 08d0 IMUL word ptr [BP + -0x9] | 08d3 |
| L131 | 6d00:08dc | 08db IMUL word ptr [BP + -0xb] | 08de |
| L160 | 6d00:0c9e | 0c9c MOV word ptr [BP + -0xf],AX | 0c9f |
| L166 | 6d00:0d6e | 0d6d ADD AX,word ptr [BP + -0xd] | 0d70 |
| L174 | 6d00:0e5c | 0e59 MOV AL,byte ptr [DI + 0x269d] | 0e5d |
| L196 | 6d00:11ca | 11c9 INC word ptr [BP + -0xd] | 11cc |
| L196 | 6d00:11dd | 11db CALLF 0x0000:ae14 ; System.@SetIn | 11e0 |
| L196 | 6d00:11ef | 11ee MOV DI,AX | 11f0 |
| L196 | 6d00:1235 | 1233 MOV AL,byte ptr [BP + 0x6] | 1236 |
| L196 | 6d00:12f8 | 12f7 XOR AH,AH | 12f9 |
| L196 | 6d00:130e | 130d RETF 0x4 | 133a |
| L199 | 6d00:13a0 | 139e CMP word ptr [BP + -0x2],0x402 | 13a3 |
| L199 | 6d00:1465 | 1464 MOV AL,byte ptr [BP + 0x6] | 1467 |
| L227 | 7400:01c7 | 01c6 MOV byte ptr [BP + -0x1],0x4 | 01ca |
| L230 | 7400:0210 | 020f MOV AX,word ptr [DI + 0x65b6] | 0213 |
| L231 | 7400:0224 | 0223 SHL DI,0x1 | 0225 |
| L232 | 7400:0231 | 0230 JZ 0x7000:4266 | 0232 |
| L251 | 6c00:0013 | 0012 OR AX,word ptr [BP + 0x8] | 0015 |
| L252 | 6c00:0022 | 0021 JA 0x6000:c029 | 0023 |
| L267 | 6c00:0130 | 012f CALLF 0x0000:ac64 ; System.@StrCompare | 0134 |
| L268 | 6c00:0146 | 0145 JMP 0x6000:c555 | 0148 |
| L269 | 6c00:019b | 0197 CALLF 0x0000:ab8e ; System.@StrAssign | 019c |
| L270 | 6c00:01b5 | 01b3 LEA DI,[BP + -0x9] | 01b6 |
| L274 | 6c00:0252 | 0250 LES DI,[BP + 0x6] | 0253 |
| L275 | 6c00:0283 | 0280 CMP byte ptr [BP + -0x21],0x0 | 0284 |
| L285 | 6c00:03c9 | 03c8 JNZ 0x6000:c3e8 | 03ca |
| L288 | 6c00:0462 | 0461 ADD DI,AX | 0463 |
| L305 | 6c00:05fd | 05f9 CALLF 0x0000:b7eb ; System.@StrLong | 05fe |
| L305 | 6c00:0666 | 0664 MOV AL,byte ptr [BP + 0x8] | 0667 |
| L305 | 6c00:0671 | 0670 CMP byte ptr [0x7273],0xff ; body_Id | 0675 |
| L305 | 6c00:06d2 | 06d0 MOV AL,byte ptr [BP + 0x6] | 06d3 |
| L314 | 6c00:087a | 0878 MOV [0x7290],AL ; bigpic_Id | 087b |
| L330 | 6b00:00dc | 00d9 MOV byte ptr [0x7580],0x0 ; view_Redraw | 00de |
| L332 | 6b00:00f6 | 00f4 JMP 0x6000:b1a2 | 00f7 |
| L335 | 6b00:010b | 0107 CMP byte ptr [0x7213],0x7f ; party_CellAttr | 010c |
| L337 | 6b00:0133 | 0130 CMP byte ptr [0x4fe6],0x0 ; g_4FE6 | 0135 |
| L338 | 6b00:013a | 0137 CMP byte ptr [0x8b67],0x0 ; view_RedrawParams | 013c |
| L358 | 6a00:001e | 001c LES DI,[0x4f99] ; ecl_Mem4B00 | 0020 |
| L371 | 7200:0048 | 0044 CALLF 0x0000:ab8e ; System.@StrAssign | 0049 |
| L373 | 7200:00b5 | 00b3 MOV word ptr [BP + 0xfef8],AX | 00b7 |
| L412 | 6f00:0046 | 0045 MOV AL,[0x6e96] ; tg_Count | 0048 |
| L412 | 6f00:00c3 | 00c2 CMP AL,CL | 00c4 |
| L412 | 6f00:00e1 | 00e0 MOV DI,AX | 00e2 |
| L412 | 6f00:0100 | 00fe MOV CX,0x2 | 0101 |
| L419 | 6f00:0260 | 025e MOV word ptr [BP + -0x5],ES | 0261 |
| L421 | 6f00:0270 | 026f JGE 0x6000:f274 | 0271 |
| L433 | 6f00:04b5 | 04b4 MOV AX,word ptr [BP + -0x9] | 04b7 |
| L433 | 6f00:0523 | 0522 JMP 0x6000:f526 | 0524 |
| L435 | 6f00:0553 | 0550 CMP byte ptr [BP + 0xe],0x0 | 0554 |
| L435 | 6f00:058a | 0587 CMP byte ptr [BP + 0x6],0xff | 058b |
| L435 | 6f00:05c6 | 05c5 JNZ 0x6000:f5cf | 05c7 |
| L440 | 6f00:0957 | 0955 MOV AL,[0x66a6] ; cb_Size | 0958 |
| L450 | 6f00:0b0e | 0b0c JMP 0x6000:fb9b | 0b0f |
| L468 | 3f00:0170 | 016e JMP 0x3000:f282 | 0171 |
| L470 | 3f00:02b4 | 02b3 ADD DI,AX | 02b5 |
| L470 | 3f00:02c5 | 02c4 ADD DI,AX | 02c6 |
| L496 | 3f00:0647 | 0646 MOV word ptr [BP + -0x3],DX | 0649 |
| L500 | 3f00:0777 | 0776 ADD DI,AX | 0778 |
| L502 | 3f00:07a4 | 07a2 MOV AL,[0x7211] ; party_Dir | 07a5 |
| L507 | 3f00:0864 | 0863 XOR AH,AH | 0865 |
| L523 | 3f00:0969 | 0968 JNZ 0x3000:f9d2 | 096a |
| L523 | 3f00:0990 | 098f JNZ 0x3000:f9b4 | 0991 |
| L530 | 3f00:0a53 | 0a51 MOV AX,[0x4fac] ; g_4FAC | 0a54 |
| L533 | 3f00:0a7e | 0a7d MOV CX,0x8 | 0a80 |
| L543 | 3f00:0bcb | 0bc8 CMP word ptr ES:[DI + 0x592],0xff | 0bcf |
| L546 | 3f00:0bbb | 0bba MOV AL,[0x4fba] ; view_Mode | 0bbd |
| L550 | 3f00:0c0d | 0c0b MOV DI,0xb8e ; [ps] cs:"Bash" | 0c0e |
| L551 | 3f00:0c22 | 0c1e CMP byte ptr [0x7589],0x0 ; door_CanPick | 0c23 |
| L552 | 3f00:0c5c | 0c58 CMP byte ptr [0x758a],0x0 ; door_CanKnock | 0c5d |
| L554 | 3f00:0cc0 | 0cbf MOV DI,0xba0 ; [ps] cs:" Exit" | 0cc2 |
| L558 | 3f00:0e60 | 0e5f JNZ 0x3000:fe68 | 0e61 |
| L622 | 6800:03f4 | 03f3 LEA DI,[BP + -0x53] | 03f6 |
| L624 | 6800:042c | 0429 CMP AL,byte ptr [BP + 0xff72] | 042d |
| L628 | 6800:04ab | 04a7 CMP byte ptr [0x4fba],0x3 ; view_Mode | 04ac |
| L632 | 6800:04fd | 04fb ADD AX,0x1e | 04fe |
| L643 | 6800:0640 | 063f MOV DI,AX | 0641 |
| L651 | 6800:0738 | 0734 CALLF 0x0000:ae14 ; System.@SetIn | 0739 |
| L659 | 6800:07a0 | 079f CMP byte ptr [BP + -0x63],0x0 | 07a3 |
| L681 | 3300:005f | 005d MOV CX,0x6 | 0060 |
| L681 | 3300:0098 | 0097 CMP byte ptr [BP + -0x2],0x0 | 009b |
| L683 | 3300:019c | 019b ADD AX,BX | 019d |
| L706 | 3300:09d9 | 09d8 JGE 0x3000:39f8 | 09da |
| L710 | 3300:0c1a | 0c19 MOV AL,byte ptr [BP + -0x3] | 0c1c |
| L716 | 3300:0fe4 | 0fe3 LES DI,[0x4f99] ; ecl_Mem4B00 | 0fe7 |
| L726 | 3300:11c0 | 11bd CMP byte ptr ES:[DI + 0x13],0x1 | 11c2 |
| L729 | 3300:12b9 | 12b8 MOV AL,byte ptr [BP + 0x8] | 12bb |
| L732 | 3300:1840 | 183c MOV byte ptr [0x4a06],0x0 ; dep_StartY | 1841 |
| L732 | 3300:19e7 | 19e5 JMP 0x3000:4936 | 19e8 |
| L732 | 3300:1c16 | 1c15 JMP 0x3000:4a25 | 1c18 |
| L741 | 3300:1ceb | 1ce7 CALLF 0x0000:c020 ; System.FillChar | 1cec |

## Sample table

Seed `"1989VIEW"`, 26 of 253 statements. Line = VIEW.pas.md line.

| line | address | statement | verdict | evidence |
|---|---|---|---|---|
| L29 | 6d00:0044 | `y0 := y - 5;  if y0 < 0 then y0 := 0;  if y0 > 5 then y0 := 5;` | DISAGREE | anchor 6d00:0044 is inside 0042 (the x0 store of the previous statement); y0 := y - 5 starts 0045; content agrees (signed JGE/JLE clamps) — in #verify-47 |
| L35 | 6d00:00e0 | `if GetWallType(x0+c, y0+r, 4) <> 0 then sym := sym + 4;` | AGREE | asm matches |
| L102 | 6d00:05ef | `if GetWallType(x, y, dir) <> 0 then` | AGREE | asm matches |
| L126 | 6d00:0867 | `left := (dir + 6) mod 8;  back := (dir + 4) mod 8;  right := (dir + 2) mod 8;` | DISAGREE | anchor 6d00:0867 inside 0865 (its own first instruction); content agrees — in #verify-47 |
| L128 | 6d00:08d2 | `for dist := 2 downto 0 do begin` | DISAGREE | anchor 6d00:08d2 inside 08d0 IMUL; `for dist := 2 downto 0` starts 08c7 — in #verify-47 |
| L213 | 7400:00ca | `LoadPicture(name, id, 1, $0D, var sym_Block[block]);` | AGREE | asm matches |
| L254 | 6c00:004b | `if Mem[4CFF] <> 0 then RecolorPicture(pic, 1, 0, @g_0AA8, @g_0A98);` | DISAGREE | argument order: pushes are @g_0A98, @g_0AA8, 0, 1, pic (6c00:0035..0048) = RecolorPicture(fromCol, toCol, frame, randomMix, pic) as RESIDENT 0297:1626; the Pascal writes them reversed (#verify-48) |
| L255 | 6c00:006e | `DrawPicture(col-1, row-1, 0, 0, pic, view_Pic);` | AGREE | asm matches |
| L285 | 6c00:03c9 | `len := frameSize (x2 when VideoMode = 0 / CGA);` | DISAGREE | anchor 6c00:03c9 inside 03c8 JNZ (VideoMode test 03c3); content agrees — in #verify-47 |
| L288 | 6c00:0462 | `else for i := 0 to len-1 do p^[o+i] := p^[o+i] xor base^[i];` | DISAGREE | anchor 6c00:0462 inside 0461 ADD DI,AX; content agrees (XOR delta 0458..047d) — in #verify-47 |
| L297 | 6c00:0550 | `if g_4FBF <> 0 then ClearGlyphRun(0, 24, 0, 40);` | AGREE | asm matches |
| L330 | 6b00:00dc | `if not PartyDead then begin` | DISAGREE | anchor 6b00:00dc inside 00d9 (view_Redraw := 0 of the previous statement); `if not PartyDead` is 00de — in #verify-47 |
| L338 | 6b00:013a | `if g_8B67 <> 0 then begin` | DISAGREE | anchor 6b00:013a inside 0137 CMP [8B67],0 (its own test); content agrees — in #verify-47 |
| L371 | 7200:0048 | `if start > $30 then begin RestorePreviousVideoMode; WriteLn('Start range error in Load24x24Set'); Terminate...` | DISAGREE | anchor 7200:0048 inside 0044 CALLF @StrAssign (previous statement); the test is 0049 (JBE: start <= 30h) — in #verify-47 |
| L439 | 6f00:0904 | `for k := 0 to 3 do if FootprintCell(size, k, dx, dy) then begin ac[k] := col + dx; ar[k] := row + dy end el...` | AGREE | asm matches |
| L447 | 6f00:0acf | `if TraceLine(ac[k], ar[k], x, y, d, map) and (d < best) then begin found := true; best := d; bk := k; bm :=...` | AGREE | (JNC: d < best unsigned) |
| L506 | 3f00:0851 | `party_MapX := party_MapX + dx[party_Dir];  party_MapY := party_MapY + dy[party_Dir];` | AGREE | asm matches |
| L534 | 3f00:0ab7 | `#$4B {Left}:  begin party_Dir := (party_Dir+6) mod 8; PlayOrStopSound(g_25C0); party_Ahead := …; Draw3DView...` | AGREE | asm matches |
| L539 | 3f00:0b5e | `if text_Cleared = 0 then begin ClearRectangle(1, $11, $26, $16); text_Cleared := 1 end;` | DISAGREE | cite: 3f00:0b5e is the JMP ending the previous case branch; the text_Cleared test is 0b64 |
| L546 | 3f00:0bbb | `if Mem[7EC9] < $FF then begin` | DISAGREE | anchor 3f00:0bbb inside 0bba (the view_Mode test of the previous statement); `Mem[7EC9] < $FF` is 0bc4 / 0bc8 (JC) — in #verify-47 |
| L622 | 6800:03f4 | `menu_Ext := false;  haveOpts := (textColour <> 0) or (hotColour <> 0);` | DISAGREE | anchor 6800:03f4 inside the StrAssign push sequence (03ee..03fc, previous statement); menu_Ext := false is 0401 — in #verify-47 |
| L623 | 6800:0423 | `ParseOptions(options);` | AGREE | asm matches |
| L624 | 6800:042c | `if menu_Sel > optCount then menu_Sel := 1;` | DISAGREE | anchor 6800:042c inside 0429 CMP (own test, starts 0426); content agrees (JBE) — in #verify-47 |
| L629 | 6800:04bc | `if cityAnim then begin BigPicAnimSetPos; BigPicAnimPhaseA; BigPicAnimPhaseB end;` | AGREE | (cityAnim from 04ab, anim_Id <> 50h) |
| L645 | 6800:069a | `'.': begin if menu_Sel = optCount then menu_Sel := 1 else Inc(menu_Sel); DrawOptions(menu_Sel) end;` | AGREE | asm matches |
| L744 | 3300:1d32 | `cm_Map^[2] := CombatantCol(PartyHead) - 3; cm_Map^[3] := CombatantRow(PartyHead) - 3;` | AGREE | asm matches |
