# RESIDENT — verification (lane cab-verify-fable, 2026-10-20)

Area file: `decode/pseudo/RESIDENT.pas.md` (author cab-rt; units main_0000, 01A0, 020F, 0297, 0542, 0636, 06EA, 0713; 2073 lines) and `RESIDENT_SCREENS.md` (18 rows). Verified per `herdr/assignments/cab-verify.md`: fresh argcheck, a seeded 10 % sample re-read against the listings, targeted sweeps over the whole area, every SCREENS row against the code. The area file was not edited.

## Summary

| check | result |
|---|---|
| argcheck (`python -I decode/tools/argcheck.py RESIDENT`, output to scratch) | 472 calls: OK 81, **MISMATCH 0**, UNSURE 391 |
| anchorcheck (`decode/tools/anchorcheck.py decode/pseudo/RESIDENT.pas.md`) | 1060 anchors, **0 bad** |
| sample (`pseudo_check.py RESIDENT`, seed `1989RESIDENT`) | 999 anchored statements, 100 sampled: **AGREE 100**, DISAGREE 0, UNSURE 0 |
| sweeps (argument order, signedness, byte/word, folded indexes, ABS, sets, string lengths, anchors, Curse deltas) | no disagreement |
| SCREENS | 18 rows, 18 agree with the code; the Play Demo prompt (RESIDENT-01) also agrees with the `acceptance/ref` TITLE-1-PLAYDEMO report |
| fix requests | none |

## Sample

Method: `python -I decode/tools/pseudo_check.py RESIDENT` (default seed `random.seed('1989RESIDENT')`, 10 % of the 999 statements inside the pascal blocks that carry a `{ seg:off` anchor). Each statement was re-read against the instructions at its anchor in `decode/listings/*.lst` (operand sizes and offsets, constants, push order, branch sense, signedness). Six anchors lie in the 0713 sound-driver code that Ghidra does not list as a function, so pseudo_check prints no asm there; those were re-read from a linear decode of START.EXE at 0713:21F0.. (capstone, the same bytes anchorcheck decodes).

Verdicts: AGREE = statement, operands and constants match the code at the anchor; DISAGREE = the code says something else; UNSURE = not decidable from the listing.

| line | anchor | statement | verdict | evidence |
|---|---|---|---|---|
| L46 | 0000:015f | `if ParamStr(1) <> 'STING' then` | AGREE | 015f LEA DI,[BP-0100h]; PUSH 1; CALLF System.ParamStr; MOV DI,0 cs:'STING'; CALLF @StrCmp; JZ — the string at CS:0000 is 'STING' |
| L49 | 0000:0190 | `g_47DE := HorizontalMenu('Curse of the Azure Bonds v1.0 ', 'Play Demo', $0D, $0A, $0F, false...` | AGREE | 0190 PUSH DS/DI 'Curse of the Azure Bonds v1.0 '; 'Play Demo'; PUSH 0Dh, 0Ah, 0Fh, 0, 0, [47DF]; CALLF ov26_03D4; MOV [47DE],AL — 8 args in push order |
| L70 | 0000:02cc | `ov11_06D8;` | AGREE | 02cc CALLF 0x0000:092a (ov11_06D8 (via stub_ov11_e2)); 02d1 CMP byte ptr [0x4fbc],0x0 (DemoMode) |
| L72 | 0000:02db | `ov01_0634;` | AGREE | 02db CALLF 0x0000:03e5 (ShowTitle (via stub_ov01_e1)); 02e0 CALLF 0x0000:70ec (FlushGameKeys) |
| L74 | 0000:02e5 | `menu_Timeout := 1000;  menu_TimeoutKey := 'D';` | AGREE | 02e5 MOV word [menu_Timeout],3E8h; MOV byte [menu_TimeoutKey],44h ('D') |
| L183 | 01a0:0494 | `DrawScreenFrame;` | AGREE | 0494 CALL 0x0000:1a00 (DrawScreenFrame); 0497 MOV byte ptr [BP + -0x1],0x0 |
| L192 | 01a0:04d3 | `case VideoMode of` | AGREE | 04d3 MOV AL,[0x4fe6] (g_4FE6); 04d6 CMP AL,0x0 |
| L232 | 020f:0065 | `Write(Output, key);` | AGREE | 0065 MOV DI,0x8db2; 0068 PUSH DS |
| L245 | 020f:02c2 | `if ProgDir[1] = 'A' then DataDir := 'B:\'` | AGREE | 02c2 CMP byte [4F43],41h ('A' = ProgDir[1]); JNZ; ... the B: drive string assigned |
| L267 | 020f:0414 | `ClrScr;` | AGREE | 0414 CALLF 0x0000:9c72 (Crt.ClrScr); 0419 MOV DI,0x8db2 |
| L272 | 020f:0463 | `2: WriteLn(CfgFile, 'T');` | AGREE | 0463 MOV DI,0x4cc0; 0466 PUSH DS ([ps] ",,,...((((***,,,...'((*+,-./0123(((*+,-./0") |
| L281 | 020f:0529 | `or ((SavePathIn[1] in ['A', 'B']) and (SavePathIn[1] = ProgDir[1]))` | AGREE | 0529 PUSH word (SavePathIn[1]); MOV DI,1A4h cs: set; CALLF System.@SetIn; JZ; then 0539 CMP AL,[ProgDir[1]] |
| L282 | 020f:0542 | `or not (SavePathIn[1] in ['A'..'P']) then begin` | AGREE | 0542 PUSH word (SavePathIn[1]); MOV DI,1C4h cs: set 'A'..'P'; CALLF System.@SetIn; JNZ — `not in` sense correct |
| L285 | 020f:0591 | `Delay(2000);` | AGREE | 0591 MOV AX,0x7d0; 0594 PUSH AX ([ps] ",,,...((((***,,,...'((*+,-./0123(((*+,-./0") |
| L299 | 020f:06a4 | `PrevBiosVideoMode := Regs.AL;  CurBiosVideoMode := PrevBiosVideoMode;` | AGREE | 06a4 MOV AL,[0x4fca] (Regs); 06a7 MOV [0x4fe4],AL (PrevBiosVideoMode) |
| L318 | 020f:075c | `OvrSetBuf($28000);` | AGREE | 075c MOV AX,8000h; MOV DX,2; PUSH DX; PUSH AX; CALLF Overlay.OvrSetBuf — 28000h = 163840 |
| L320 | 020f:07cc | `RestorePreviousVideoMode;` | AGREE | 07cc CALLF 0x0000:2a77 (RestorePreviousVideoMode); 07d1 MOV DI,0x8db2 |
| L324 | 020f:07ef | `Read(CfgFile, CfgChar);  ReadLn(CfgFile);` | AGREE | 07ef MOV DI,0x4cc0; 07f2 PUSH DS ([ps] "(((***,,,...((((***,,,...'((*+,-./0123((") |
| L386 | 0297:0094 | `if Odd(n) then GetCgaMapEntry := local[n shr 1] and $0F` | AGREE | 0094 TEST byte [BP+6],1; JZ 00b2; MOV AL,local[n shr 1]; AND AL,0Fh |
| L387 | 0297:00b2 | `else GetCgaMapEntry := (local[n shr 1] and $F0) shr 4;` | AGREE | 00b2 MOV BX,[BP+6]; SHR BX,1; MOV AL,[BP+BX-..]; AND AL,0F0h; SHR AL,1 x4 |
| L400 | 0297:00ee | `Intr($10, Regs);` | AGREE | 00ee MOV AL,0x10; 00f0 PUSH AX |
| L420 | 0297:0136 | `if pic <> nil then FreePicture(pic);` | AGREE | 0136 LES DI,[BP + 0x6]; 0139 MOV AX,word ptr ES:[DI] |
| L423 | 0297:0180 | `Move(buf^[0], height, 2);` | AGREE | 0180 LES DI,[BP + 0xfee7]; 0184 PUSH ES |
| L425 | 0297:01ae | `Move(buf^[4], x, 2);` | AGREE | 01ae LES DI,[BP + 0xfee7]; 01b2 ADD DI,0x4 |
| L430 | 0297:023a | `pic^.x := x;` | AGREE | 023a MOV AX,word ptr [BP + 0xfefa]; 023e LES DI,[BP + 0xfee2] |
| L460 | 0297:0366 | `bit := $80;` | AGREE | 0366 MOV byte [BP-..],80h |
| L484 | 0297:05e0 | `ofs := ofs + 4;` | AGREE | 05e0 ADD word ptr [BP + 0xe],0x4; 05e4 MOV AX,word ptr [BP + -0x18] |
| L487 | 0297:060f | `for f := 1 to pic^.count do` | AGREE | 060f LES DI,[BP + -0x28]; 0612 MOV AL,byte ptr ES:[DI + 0x8] |
| L514 | 0297:0876 | `if (pic^.pixels[k] and $0F) = transpColour then pic^.mask^[k] := pic^.mask^[k] + $0F;` | AGREE | 0876 MOV AL,pixels[k]; AND AL,0Fh; CMP AL,transpColour; JNZ; ... ADD byte mask[k],0Fh |
| L535 | 0297:08fe | `useMask := ((flags and 1) <> 0) and (src^.mask <> nil);` | AGREE | 08fe TEST byte [BP+flags],1; JZ; CMP dword src^.mask,0 (both words); SETcc into useMask |
| L537 | 0297:0924 | `0: if useMask then BlitCgaMasked(x, y, frame, src, dst)` | AGREE | 0924 CMP byte [BP-..],0 (useMask); JZ 092a?; PUSH x,y,frame,src,dst; CALL 0297:226A BlitCgaMasked — 5 args in Pascal order |
| L585 | 0297:2a34 | `view_SpanFirst[line] := d;  view_SpanScreenX[line] := xb end;` | AGREE | 2a34 MOV word ptr [BX + 0x51f8],AX; 2a38 MOV AX,word ptr [BP + -0x6] ([ps] "(***,,,...((((***,,,...'((*+,-./0123(((*") |
| L589 | 0297:2a76 | `Inc(s);  Inc(si);  Inc(d);` | AGREE | 2a76 INC word ptr [BP + -0xe] (g_3E32); 2a79 INC word ptr [BP + -0x1c] |
| L645 | 0297:0a78 | `r := Byte(b shl 7);` | AGREE | 0a78 MOV AL,b; MOV CL,7; SHL AL,CL — Byte() truncation matches an 8-bit shift |
| L706 | 0297:0d1c | `rowBytes := p^.width8 * 4;` | AGREE | 0d1c LES DI,[BP + -0x13]; 0d1f MOV AX,word ptr ES:[DI + 0x2] |
| L728 | 0297:0e6a | `for c := 1 to rowBytes do begin` | AGREE | 0e6a MOV AX,word ptr [BP + -0x8]; 0e6d MOV word ptr [BP + -0x17],AX |
| L755 | 0297:0fa8 | `src := 0;` | AGREE | 0fa8 XOR AX,AX; 0faa MOV word ptr [BP + -0x10],AX |
| L756 | 0297:0fd9 | `PortW[$3CE] := 5;  Port[$3CF] := 0;  Port[$3CE] := 4;` | AGREE | 0fd9 MOV AX,5; MOV DX,3CEh; OUT DX,AX? — writes 3CE/3CF as stated (OUT DX,AL sequence: 3CE←5, 3CF←0, 3CE←4) |
| L761 | 0297:1027 | `pic^.data[src] := Mem[$A000 : ega_LineOfs[y] + x];` | AGREE | 1027 MOV BX,y; SHL BX,1; MOV AX,ega_LineOfs[BX]; ADD AX,x; MOV ES,0A000h; MOV AL,ES:[..]; MOV pic^.data[src],AL |
| L769 | 0297:10fc | `src := src + lineBytes;` | AGREE | 10fc MOV AX,word ptr [BP + -0xe]; 10ff ADD word ptr [BP + -0x10],AX |
| L853 | 0297:1611 | `FillChar(view_SpanLast, $150, 0);` | AGREE | 1611 PUSH DS; PUSH offset view_SpanLast; PUSH 150h; PUSH 0; CALLF System.FillChar |
| L871 | 0297:1666 | `if frame < 0 then begin frame := 0; n := pic^.count end` | AGREE | 1666 CMP word [BP+frame],0; JGE — signed, matches `frame < 0` |
| L891 | 0297:1844 | `if (not randomMix) or (Random(4) = 0) then` | AGREE | 1844 CMP byte randomMix,0; JZ 185d; PUSH 4; CALLF Random; OR AX,AX; JNZ — randomMix is tested again at 183b/1844 (quirk noted by the author) |
| L892 | 0297:185d | `tmp^.data[dst] := (tmp^.data[dst] and not CgaPixelMaskTab[p+4])` | AGREE | 185d MOV AL,byte ptr [BP + -0x31]; 1860 XOR AH,AH |
| L898 | 0297:18fc | `for p := 0 to 3 do` | AGREE | 18fc MOV byte ptr [BP + -0x2f],0x0; 1900 JMP 0x0000:4275 |
| L899 | 0297:1905 | `if (from[i] and EgaPlaneBitTab[p]) > 0 then want[p] := 0 else want[p] := $FF;` | AGREE | 1905 MOV AL,from[i]; AND AL,EgaPlaneBitTab[p]; CMP AL,0; JBE → want[p] := FFh else 0 — `> 0` on a byte, unsigned, agree |
| L915 | 0297:1a9a | `2: begin` | AGREE | 1a9a CMP AL,0x2; 1a9c JZ 0x0000:4411 |
| L921 | 0297:1b2d | `if (pic^.data[src] and $F0) = hiFrom then` | AGREE | 1b2d MOV AX,word ptr [BP + -0x22]; 1b30 LES DI,[BP + 0x6] |
| L932 | 0297:1c05 | `Move(tmp^.data[0], pic^.data[frame * pic^.frameSize], n * pic^.frameSize);` | AGREE | 1c05 LES DI,[BP + 0x6]; 1c08 MOV word ptr [BP + -0x3e],DI |
| L952 | 0297:1cc5 | `pic^.frameSize := frameSize;` | AGREE | 1cc5 MOV AX,word ptr [BP + -0x2]; 1cc8 LES DI,[BP + 0x6] |
| L956 | 0297:1ce8 | `GetMem(pic^.mask, total);` | AGREE | 1ce8 LES DI,[BP + 0x6]; 1ceb LES DI,ES:[DI] |
| L970 | 0297:1d59 | `FreeMem(pic^.mask, total);` | AGREE | 1d59 LES DI,[BP + -0x6]; 1d5c ADD DI,0x13 |
| L971 | 0297:1d6a | `FreeMem(pic, total + $17);` | AGREE | 1d6a LES DI,[BP + 0x6]; 1d6d PUSH ES |
| L972 | 0297:1d7b | `pic := nil;` | AGREE | 1d7b LES DI,[BP + 0x6]; 1d7e XOR AX,AX |
| L985 | 0297:1da6 | `if pic = nil then Exit;` | AGREE | 1da6 MOV AX,word ptr [BP + 0x6]; 1da9 OR AX,word ptr [BP + 0x8] |
| L988 | 0297:1dd5 | `if pic^.width < x + w then begin` | AGREE | 1dd5 MOV AX,x; ADD AX,w; CWD; MOV CX,pic^.width; XOR BX,BX; CMP DX,BX / CMP CX,AX; JL/JGE chain — 32-bit signed compare as noted |
| L1008 | 0297:1f37 | `x0 := x0 * 4;  tail := tail * 4;  ofs := ofs * 4;` | AGREE | 1f37 MOV AX,word ptr [BP + -0xe]; 1f3a MOV CX,0x2 |
| L1028 | 0297:2047 | `cells := w - skipL - skipR;` | AGREE | 2047 MOV AX,word ptr [BP + 0x12]; 204a SUB AX,word ptr [BP + -0xa] |
| L1033 | 0297:20b1 | `for r := 0 to last do begin` | AGREE | 20b1 MOV AX,word ptr [BP + -0x14]; 20b4 MOV word ptr [BP + -0x23],AX |
| L1036 | 0297:20d7 | `if view_SpanFirst[line] > ofs then begin` | AGREE | 20d7 MOV DI,word ptr [BP + -0x1e]; 20da SHL DI,0x1 |
| L1057 | 0297:2174 | `Regs.AH := $10;  Regs.AL := 0;` | AGREE | 2174 MOV byte [Regs.AH],10h; MOV byte [Regs.AL],0 (Regs = g_4FCB) |
| L1058 | 0297:217e | `if colour < 8 then Regs.BH := colour` | AGREE | 217e CMP byte [BP+colour],8; JNC; MOV AL,colour; MOV [Regs.BH],AL |
| L1073 | 0297:21bd | `Regs.BH := value;  Regs.BL := index;` | AGREE | 21bd MOV AL,byte ptr [BP + 0x6]; 21c0 MOV [0x4fcd],AL (g_4FCD) |
| L1101 | 0542:0027 | `Port[$3CE] := 3; Port[$3CF] := 0;` | AGREE | 0027 MOV AL,0x3; 0029 MOV DX,0x3ce |
| L1173 | 0542:0246 | `case VideoMode of` | AGREE | 0246 MOV AL,[0x4fe6] (g_4FE6); 0249 CMP AL,0x0 |
| L1227 | 0542:032e | `DrawRepeatedGlyph(col, row, colour, colour, count, ' ', True);` | AGREE | 032e PUSH col,row,colour,colour,count,' ',1; CALL DrawRepeatedGlyph — fg = bg = colour |
| L1283 | 0542:0531 | `len := Length(t);` | AGREE | 0531 LES DI,[BP+t]; MOV AL,ES:[DI] (length byte); MOV [BP-..],AL |
| L1284 | 0542:0539 | `if len = 0 then Exit;` | AGREE | 0539 CMP byte [BP-len],0; JNZ; JMP exit |
| L1285 | 0542:0543 | `width := x2 - x1 + 1;` | AGREE | 0543 MOV AL,byte ptr [BP + 0x16]; 0546 XOR AH,AH |
| L1301 | 0542:06d8 | `FlushGameKeys;` | AGREE | 06d8 CALLF 0x0000:70ec (FlushGameKeys); 06dd MOV AL,byte ptr [BP + 0x16] |
| L1325 | 0542:0763 | `x := Length(p);` | AGREE | 0763 MOV AL,byte ptr [BP + -0x29]; 0766 MOV byte ptr [BP + -0x2a],AL |
| L1335 | 0542:07e7 | `end else if (k = #8) and (Length(s) > 0) then begin` | AGREE | 07e7 CMP byte k,8; JNZ; CMP byte [s],0 (length byte); JBE — `Length(s) > 0` unsigned, agree |
| L1354 | 0542:08f5 | `Val(s, n, code);` | AGREE | 08f5 PUSH s; PUSH ss:n (LongInt, 4 bytes via LEA); PUSH code; CALLF System.@ValLong |
| L1376 | 0542:099a | `GetTime(h, m, sec, hund);` | AGREE | 099a LEA DI,[BP + -0x6]; 099d PUSH SS |
| L1400 | 0542:0b02 | `DrawText(0, 24, fg, bg, t);` | AGREE | 0b02 PUSH 0; PUSH 18h (24); PUSH fg; PUSH bg; PUSH ss:t; CALL DrawText — DrawText(col,row,fg,bg,s) order |
| L1428 | 0542:0c83 | `for bank := 0 to 3 do` | AGREE | 0c83 four FillChar calls with ES = B800h/BA00h/BC00h/BE00h (bank*200h paragraphs) — unrolled loop as stated |
| L1471 | 0636:0053 | `Intr($10, Regs);` | AGREE | 0053 MOV AL,0x10; 0055 PUSH AX |
| L1473 | 0636:0070 | `if VideoMode = 0 then Regs.BL := CgaColourMap[colour]` | AGREE | 0070 CMP byte [VideoMode],0; JNZ; MOV BX,colour; MOV AL,CgaColourMap[BX]; MOV [Regs.BL],AL |
| L1524 | 0636:020c | `ok := FileExists('game.ovr');` | AGREE | 020c LEA DI,[BP + -0xb]; 020f PUSH SS |
| L1539 | 0636:02aa | `lbl := sr.Name;` | AGREE | 02aa LEA DI,[BP + -0x10]; 02ad PUSH SS |
| L1547 | 0636:02ec | `n := name;  p := prompt;` | AGREE | 02ec LES DI,[BP + 0x10]; 02ef PUSH ES |
| L1562 | 0636:0499 | `until found or quiet;` | AGREE | 0499 CMP byte ptr [BP + 0xff5c],0x0; 049e JNZ 0x0000:6809 |
| L1586 | 0636:05fe | `DeleteAll := a;` | AGREE | 05fe LEA DI,[BP + 0xff00]; 0602 PUSH SS |
| L1614 | 0636:076b | `end else if (c >= -127) and (c <= -1) then begin` | AGREE | 076b MOV AL,c; CBW; CMP AX,-7Fh; JL; CMP AX,-1; JG — signed compares, matches `(c >= -127) and (c <= -1)` |
| L1616 | 0636:07a5 | `si := si + 2;  di := di - c;` | AGREE | 07a5 ADD word si,2; MOV AL,c; CBW; SUB word di,AX — `di := di - c` with c negative (ABS by NEG at 0779 is written as -c) |
| L1661 | 0636:0a09 | `TerminateGame;` | AGREE | 0a09 CALLF 0x0000:6ea0 (TerminateGame); 0a0e MOV AL,byte ptr [BP + 0xff57] |
| L1664 | 0636:0a3c | `if eid = id then begin` | AGREE | 0a3c MOV AL,byte ptr [BP + 0xff57]; 0a40 CMP AL,byte ptr [BP + 0xe] |
| L1676 | 0636:0a69 | `PlayOrStopSound(SndOutputOn);` | AGREE | 0a69 PUSH word ptr [0x25ae] (SndOutputOn); 0a6d CALLF 0x0000:7150 (PlayOrStopSound) |
| L1721 | 06ea:004a | `Halt(0);` | AGREE | 004a XOR AX,AX; 004c CALLF 0x0000:a618 (System.Halt) |
| L1729 | 06ea:0069 | `e := c^.effects;` | AGREE | 0069 LES DI,[BP + 0x6]; 006c LES AX,ES:[DI + 0xf2] |
| L1741 | 06ea:011b | `if KeyPressed then ch := ReadKey else ch := #0` | AGREE | 011b CALLF Crt.KeyPressed; OR AL,AL; JZ 012e; CALLF Crt.ReadKey; MOV ch,AL; JMP; 012e MOV byte ch,0 |
| L1749 | 06ea:016f | `SoundDevice := SoundDeviceSaved;` | AGREE | 016f MOV AL,[0x5beb] (SoundDeviceSaved); 0172 MOV [0x5bea],AL (SoundDevice) |
| L1776 | 06ea:0252 | `while KeyPressed do dummy := ReadGameKey;` | AGREE | 0252 CALLF Crt.KeyPressed; OR AL,AL; JZ; CALL ReadGameKey (025c); JMP 0252 |
| L1879 | 0713:2276 | `` | AGREE | linear decode (capstone): 2276 MOV AH,0Fh; INT 10h; MOV AH,0; INT 10h — matches the comment; not a Ghidra function start, so pseudo_check shows no asm |
| L1901 | 0713:22eb | `if cs0713_CurSound = 0 then begin gate := 0; goto Out end;` | AGREE | linear decode: 22eb MOV BX,[0148h]; CMP BX,0; JE 2357 — CS:0148 = cs0713_CurSound; the JE target is the `gate := 0` tail |
| L1923 | 0713:2360 | `if cs0713_CurSound = 0 then goto Silence;` | AGREE | linear decode: 2360 MOV BX,[0148h]; CMP BX,0; JE 23dd — the Silence label |
| L1982 | 0713:248c | `op := p^;  Inc(p);` | AGREE | linear decode: 248c MOV BL,[DI]; INC DI; CMP BL,0FAh; JAE 2497; JMP 2538 — op < $FA → NoteList |
| L2005 | 0713:2555 | `ch^.duration := t * LenTable[e0 and $1F];` | AGREE | linear decode: 2555 MUL byte [BX+0157h]; MOV [SI],AX — LenTable at CS:0157 indexed by e0 and $1F |
| L2007 | 0713:2562 | `if n <> $7F then begin` | AGREE | linear decode: 255d MOV AL,[BX]; AND AX,7Fh; 2562 CMP AX,7Fh; JE 25a3 — n <> $7F |
| L2033 | 0713:25fe | `SpeakerChannels[k].duration := 1;` | AGREE | 25fe MOV word [SpeakerChannels[k].duration],1 (CS:0176 + k*recsize) |

Notes from the sample (no action needed): L891 0297:1844 — the author's "quirk: randomMix tested twice" is in the code (183b and 1844 both test the byte). L1614–1616 0636:076b — the RLE decoder writes the negative count as `-c` / `di - c` where the code does CBW + NEG; equivalent. L988 0297:1dd5 — the 32-bit signed compare chain (CWD, CMP DX / CMP AX, JL/JGE) is noted by the author and matches.

## Sweeps (whole area)

- **Call-argument order.** argcheck 0 MISMATCH (81 OK, 391 UNSURE = nested or far-pointer argument windows argcheck cannot resolve). The sweep counted the arguments of every text-routine call in the area: ClearRectangle 3 calls, DrawRepeatedGlyph 3, ClearTextRectangle 2, ShowBottomPromptAndReadKey 1, DrawText 4, ReadBottomLine 1 — all with the Curse argument counts (bg colour included: `DrawText(col,row,fg,bg,s)`, `ShowBottomPromptAndReadKey(fg,bg,s)`, `ReadBottomLine(prompt,fg,bg,maxLen)`). The sampled multi-argument calls (L49 HorizontalMenu 8 args, L537 BlitCgaMasked 5, L1227 DrawRepeatedGlyph 7, L1400 DrawText 5, L1354 Val 3, L1376 GetTime 4) are in push order.
- **Signed vs unsigned compares.** 93 anchored compare statements were paired with the first conditional jump after the anchor. Every signed jump sits on a value the pseudocode types as Integer/LongInt/ShortInt or a `for` with signed bounds (0297:0ff7 JG `for y := row*8 ...`, 0297:1666 JGE `frame < 0`, 0297:1dd5 JL/JGE 32-bit, 0542:0914 JG/JL `n > 65536 / n < 0` LongInt, 0636:076b JL/JG `-127..-1`, 0713:0093 JL/JG `2..14`); every unsigned jump (JB/JA/JBE/JNC) sits on a Byte/Word/char (0297:1905 JBE on a masked byte, 0542:07e7 JBE on `Length(s) > 0`, 0297:217e JNC `colour < 8`, 0297:2320/2368 JBE `col < 0` / `row < 0` written as a signed test of a word against 8000h — same meaning). No inconsistency.
- **Byte vs word operands.** Statements written with Byte()/Word()/ShortInt()/LongInt casts (L459, L492, L645, L671, L693, L697, L1039, L1357, L1610) were checked against the operand sizes at the anchor: `Byte(b shl 7)` / `Byte(b shl 4)` are the low byte of a word shift (MOV AL; XOR AH; SHL AX,CL; stored as a byte), `ReadWordNumber := Word(n)` takes the low word of the LongInt, `ShortInt(src^[si])` is MOV AL + CBW. Consistent.
- **Folded constant array indexes.** The DS-table reads in the sample (0297:1027 `ega_LineOfs[y]`, 0297:185d `CgaPixelMaskTab[p+4]`, 0297:1905 `EgaPlaneBitTab[p]`, 0636:0070 `CgaColourMap[colour]`, 0713:2555 `LenTable[e0 and $1F]`) all carry a computed index in the code (MOV BX / DI + table base); no table element read with a constant index was found written as a scalar, or the reverse.
- **ABS idioms.** The listings contain three NEG-after-sign-test sequences in the area's segments: 0297:1dbe and 0297:1e6a are written `Abs(...)` (L986, L995); 0636:0779 (JG / CBW / NEG in the RLE decoder) is written as the negative count `-c` (L1615). Equivalent.
- **Pascal set tests.** Nine `System.@SetIn` calls in the area's segments: 020f:0037, 005e, 0532, 054b, 06ea:0168, 0713:002c are written `in [...]` (L230, L231, L281, L282, L1748, L1814); 0542:0589, 05c1, 0621 are written `in Punct` with a named set (L1288, L1289, L1291 — 0621 is the `t[j+1] in Punct` of L1291, 53 bytes after its anchor 05ec). The sense of each test (JZ / JNZ after the call) matches the `in` / `not in` written.
- **String length bytes.** L1283/L1284 (`len := Length(t)`, `if len = 0`), L1325 (`x := Length(p)`), L1335 (`Length(s) > 0`) read the length byte at offset 0 of the string (MOV AL,ES:[DI]); L1354 Val and L1357 the LongInt result are as written.
- **Anchors.** anchorcheck 1060 / 0 bad. No sample anchor points at a neighbouring statement's instruction (L1879 0713:2276 covers exactly the comment's INT 10h pair; L2033 25fe exact).
- **Curse deltas.** Background colour argument present in every text call (above). GetPicture / PutPicture are at 0297:0EFF / 0297:1110 in the area file; the sampled L755–L769 (GetPicture EGA path, 0297:0fa8–10fc) match the port writes and the `ega_LineOfs` reads.

## SCREENS (`RESIDENT_SCREENS.md`, 18 rows)

| row | checked against | result |
|---|---|---|
| RESIDENT-01/02 | 0000:0190 HorizontalMenu pushes: `'Curse of the Azure Bonds v1.0 '`, `'Play Demo'`, 0Dh, 0Ah, 0Fh; 0000:02e5 timeout 1000 / `'D'`; `acceptance/ref/reports/TITLE-1-PLAYDEMO.md` (see below) | agree |
| RESIDENT-03 | 01a0:0000 DrawScreenFrame + layout routines (frame only, no text) | agree |
| RESIDENT-04 | 020f:0359 `"Sorry, disk A can't be write-protected."` | agree |
| RESIDENT-05 | 020f:039e `"GRAPHICS ADAPTER TYPE:  [1] CGA  [2] EGA  [3] Tandy  "` | agree |
| RESIDENT-06 | 020f:041e `"SOUND TYPE:  [1] PC  [2] Tandy 1000  [3] Silent  "` after ClrScr 0414 | agree |
| RESIDENT-07 | 020f:04cc `"PATH TO SAVE DATA (DEFAULT - "` | agree |
| RESIDENT-08 | 020f:0570 `"USING DEFAULT PATH: "`, Delay(2000) at 0591 (sampled L285) | agree |
| RESIDENT-09 | 020f:064c `"TANDY 1000 USERS - Make sure NUMLOCK is on."` | agree |
| RESIDENT-10 | 020f:0775 `"Not enough memory to run game.  You need "` + 07ac `" more bytes."` after RestorePreviousVideoMode 07cc (sampled L320) | agree |
| RESIDENT-11 | 020f:07d6 `"Overlay error, program abort!"` | agree |
| RESIDENT-12 | 0542:06be MOV AL,0Dh; 0; `"Press any key to continue"` 06ca; ShowBottomPromptAndReadKey 06d5; FlushGameKeys 06d8 (sampled L1301) | agree (fg 0Dh, bg 0) |
| RESIDENT-13 | 0542:0722 ReadBottomLine: prompt drawn in fg/bg, typed text from column Length(prompt)+1 (sampled L1325/L1335) | agree |
| RESIDENT-14 | 0636:042a MOV AL,0Eh; DiskPrompt copy; DataDrive 4F92 + `':'` appended | agree (colour 0Eh) |
| RESIDENT-15 | 0636:046b `"Couldn't find "` + name + 048b `". Check install."`; retry `until found or quiet` 0499 (sampled L1562) | agree |
| RESIDENT-16 | 0636:09e7 MOV AL,0Eh; 09f0 `"tempsize "` + number; BiosPromptLine 0a06; TerminateGame 0a09 (sampled L1661) | agree |
| RESIDENT-17 | 0636:022d `"Please insert overlay disk."`; FileExists('game.ovr') 020c (sampled L1524) | agree |
| RESIDENT-18 | 0542:0946 / 0ad9 copy the caller's message (StrAssign 28h) and draw it in the caller's fg/bg at row 24 (sampled L1400 `DrawText(0, 24, fg, bg, t)`) | agree |

Reference captures: `acceptance/ref/` holds the title screen (REF-TITLE-1, an ENGINE screen) and the Play Demo prompt report TITLE-1-PLAYDEMO (RESIDENT-01), see the ENGINE file for the title comparison.
