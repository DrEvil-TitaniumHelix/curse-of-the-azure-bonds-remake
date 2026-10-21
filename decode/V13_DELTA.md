# V13_DELTA — Curse of the Azure Bonds **v1.0** (owner's copy) vs **v1.3** (WizardWorks / AD&D Collectors CD)

Lane cab-v13 (Fable), 2026-10-21. Assignment: `herdr/assignments/cab-v13.md`; rigor per engine (`decode/ENGINE_DELTA.md`, the owner
10/21): verify the delta only, never redo the decode. Originals untouched (CD folder read-only); working copies under
`decode/bin/v13/` (gitignored). Evidence that is committed: this file, `decode/v13/V13_MATCH.md` (generated routine match
tables + diffs), `decode/v13/v13_offsets.json` (the offset map), `decode/v13/ECL_DIFF_V13.txt` (address-insensitive script
diffs), `decode/v13/ECL_V13_INDEX.md` (ecldis coverage of the v1.3 records). Tools: `decode/tools/unexepack.py` (Pool's,
copied in), `decode/tools/tpovl.py` (FBOV path), **`decode/tools/v13match.py`** (new: routine shape-match with a TP 5 -> TP 6
code-generation normaliser), **`decode/tools/ecldiff.py`** (new).

H = read from the bytes, M = by shape/structure, L = inferred.

## 0. Verdict in one paragraph
v1.3 is the **same Pascal program rebuilt with Turbo Pascal 6.0** (v1.0: TP 5.x) plus a small point-release patch. Of the
996 v1.0 routines (overlay + resident + runtime), **984 pair 1:1 by shape** (336 identical, 606 identical after the
compiler idioms and the moved operands are normalised, 4 differ only in sound-driver CS addresses, 38 really changed), 12
are removed and 17 are new (TP 6 runtime, one moved game routine, one split unit init); the real source changes are **13
game routines + the sound driver's note-list format**, plus **5 ECL records and 1 GEO record**. The DS image is the v1.0 image
shifted by +2 bytes (byte-identical), so every table the engine reads moves by a constant. The CD's GAME.OVR ships the
**rune-wheel copy protection enabled** (JZ 74 at 0x4A9C; v1.0's copy has the JMP EB patch at 0x4A56). Result (section 4):
**v1.3 = profile overlay + manifest + 4 engine requests (v13-1 .. v13-4, STATUS.md)**; no new decode work, the two rewritten routines have their v1.3 pseudocode in 3.5.

## 1. Layout (step 1) — H

### 1.1 Executables
| | v1.0 START.EXE | v1.3 ST.EXE |
|---|---|---|
| file | 69,968 B, MZ, 483 relocations, not packed | 57,789 B, MZ, **Microsoft EXEPACK** ("Packed file is corrupt" stub at CS 0DAB:0012, header 18 B with 'RB', 0x3AD commands, 8 bytes FF padding) |
| unpacked | — | `unexepack.py`: image 62,432 B (0xF3E paragraphs), 480 relocations, output 64,384 B |
| entry / stack | 0000:002F / 150C:2710 | 0000:002F / **13B0:4000** |
| title string | 0000:0006 "Curse of the Azure Bonds v1.0 " | 0000:0006 "Curse of the Azure Bonds v1.3 " (only string change in the main program) |
| compiler | TP 5.x: TPOV overlays, no Borland copyright, FreePtr heap | **TP 6.0**: FBOV overlays, TP 6 System/Overlay/Dos/Crt units (System `GetMem` is a DX:AX function, `FreeMem`/`Val`/`Read`/`Write` runtime replaced: 7 removed, 14 new runtime routines), smart-linked stub entries |
| DS | 0C1C (image 0C1C0..109A0 = 0x47E0 B; DS+BSS 0x8F00) | **0ABE** (image 0ABE0..0F3E0 = **0x4800 B**; DS+BSS **0x8F20**) |
| resident segments | 15 code + DS | 15 code + DS, same order, one-to-one (table below) |

Resident segment map (every v1.0 segment has exactly one v1.3 twin; sizes within a few bytes except the sound unit):
| unit | v1.0 | v1.3 | size v1.0 -> v1.3 | routines | result |
|---|---|---|---|---|---|
| main program | 0000 | 0000 | 0390 -> 0360 | 2 -> 2 | body: 4 string temps dropped (TP 6 passes string constants directly); STING / `Wooden` ParamStr logic identical |
| empty-init units | 0186, 019B | 011B, 012F | 10 / 10 | 1 / 1 | unchanged |
| frames | 01A0 | 0133 | 06B0 -> 06D0 | 9 -> 9 | 8 unchanged; ClearRectangle = compiler (shift/mul idioms) |
| config | 020F | 01A0 | 0880 -> 0860 | 2 -> 2 | StartupConfiguration: TP 6 `OvrInit` sequence and heap-size arithmetic differ; CURSE.CFG parsing (CGA/EGA/Tandy 1/2/3, sound 1/2/3) identical |
| pictures | 0297 | 0226 | 2AB0 -> 2A80 | 31 -> 31 | 30 unchanged; AllocPicture = GetMem convention |
| text | 0542 | 04CE | 0F40 -> 0EF0 | 23 -> 23 | all unchanged after normalisation |
| dax | 0636 | 05BD | 0B40 -> 0B30 | 20 -> 20 | 19 unchanged; AllocBlock = GetMem convention |
| keys | 06EA | 0670 | 0290 -> 0290 | 6 -> 6 | unchanged |
| **sound** | 0713 | **0699** | **26A0 -> 1780** | 6 -> 6 | **changed** (3.3): CS variables -6, timer code -0xF31, note-list format, 3.8 KB of stale data dropped (the v1.0 segment carried class-name strings and other leftovers) |
| str-const unit | 097D | 0811 | 20 / 20 | 1 / 1 | unchanged |
| Dos / Crt / Overlay / System | 097F / 09AB / 0A0D / 0A54 | 0813 / 083F / 08A1 / 08F7 | 2C0 / 620 / 470 / 1C80 -> 2C0 / 620 / 560 / 1C70 | TP runtime | TP 6.0 runtime; `@NextRandom` keeps the same LCG shape (08F7:1639 = Pool's 0AF8:120F = v1.0 0A54:1154), so `Random` is unchanged (PER-1 holds) |

### 1.2 GAME.OVR
| | v1.0 | v1.3 |
|---|---|---|
| header | `TPOV`, 4 bytes | **`FBOV` + dword payload 0x42701**, 8 bytes (Pool's format; `tpovl.py` FBOV path, no code change) |
| size | 272,218 B | 272,137 B |
| units | 36, back to back, every byte accounted for | **36**, same order, every byte accounted for (code 0x3FB1B + fixups 0x2BE6) |
| stub entries | 871 (853 live, 18 `FFFF` dead) | **536, all live**: TP 6 emits a stub entry only for routines called from another unit (e.g. ov02 60 -> 3, ov12 136 -> 124, ov22 116 -> 99); every v1.3 entry maps to a v1.0 routine (`V13_MATCH.md` entry maps) |
| stub segments | 0039..020B | 0036..019C (same order, 3 paragraphs lower: the main program is 0x30 B shorter) |
| copy-protection byte | 0x4A56 = `EB` (JMP, check bypassed; CR-2) | **0x4A9C = `74`** (JZ: retail 3-tries/abyss logic live); byte 0x4A56 is unrelated code (`50`) |

Per-unit sizes, stub segments, entry counts and the routine verdict counts: `decode/v13/V13_MATCH.md` "Overlay units"
(36 rows) and "Resident segments". Unit file offsets: `decode/v13/v13_offsets.json` `gameOvr.unitFileOffsets_v13`.

### 1.3 Routine shape-match (method and result)
`v13match.py`: routine starts = TP prologues (`55 89 E5` / `55 8B EC`) + stub entries; routine = linear disassembly to the
last RET; two token streams per routine (shape: every number masked; const: immediates kept); monotone alignment per unit
pair (TP keeps source order) on difflib ratios. The first pass showed 3,414 diff hunks, almost all **TP 5 -> TP 6
code-generation idioms**; the normaliser cancels them on both sides (tally-driven, each rule from a hunk class seen >= 5
times): `les ax,X; mov dx,es` = `mov ax,X; mov dx,X+2`; `mov sp,bp` epilogue; `xor ah,ah; cmp ax,n` = `cmp al,n`;
signed/unsigned jcc pairs (jl/jb ...); `idiv`/`div`, `imul`/`mul`, constant multiplies as shifts (`shl`, `mov si,ax; shl;
add ax,si` = x3/x5/x9, scaling on di), divisions as `shr`; boolean materialisation (`je; mov al,0; jmp; mov al,1` =
`mov al,0; jne; inc ax`); abs; `add ax,2` = `inc ax; inc ax`; pointer pushes (`lea di,[bp-n]; push ss; push di` =
`push [bp-n+2]; push [bp-n]`, `push es; push di` = `push es:[di+2]; push es:[di]`, segment-constant pushes); TP 5's hidden
result pointer for 4-byte function results vs TP 6's `DX:AX` + store (both -> `RES` marker); `cwde`; `jcc; jmp` inversion;
temp register choice bx/cx/dx. Constant differences are then classified: DS global (via the DS map of 1.4), CS literal
(shift equal to the routine's own shift), segment constant (stub/segment pairs), else real.

Result over 996 v1.0 routines (overlay + resident, incl. runtime):
| verdict | count | meaning |
|---|---|---|
| unchanged | 336 | identical token streams after normalisation, constants included |
| moved operands | 606 | identical streams; only DS addresses, CS literal offsets or segment constants differ |
| const | 4 | only the sound unit's CS-local variables (-6) |
| **changed** | **38** | real stream differences: 13 game routines (3.4), 1 driver + 1 unit init (3.3), 2 compiler-structure cases (HeapErrorHandler TP 6 protocol, main program string temps), 6 expression-order/with-temp cases (PartyStrength, PutCombatTile, ScatterFloorDebris, TryPlaceCombatant, RestTimeNeeded, AddLine, TickEffects, HpPerLevel, SpellRange, LoseItem, FireworksShow, LoadAnimation = compiler), 13 TP runtime routines (Dos.FExpand, Crt.Init, Overlay x2, System.Delete, @WriteLong, ...) |
| removed / new | 12 / 17 | EffStoneGaze + EffParalyzingGaze left ov12 (one new ov22 routine, 3.4); the sound unit init became a separate routine; TP 6 runtime replacements (System 7 removed / 14 new, Overlay 2 / 1) |

## 2. What the engine reads from the binaries, and where it is in v1.3 (step 2) — H

Inventory (grep of `game/engine`, `game/areas`, `game/plus`, `game/byoc`, `game/profiles/cab.json`): the engine never
reads GAME.OVR bytes (byoc.js hashes it, with the CR-2 A normalisation of one byte); from START.EXE it reads (a) the **DS
image** into `G.ds` (state.js: `headerBytes 1968`, `dsImageOffset 49600`, `dsBytes 36608`) and addresses it with v1.0
offsets everywhere (25 distinct literal `G.ds[...]` reads, 00DD..3C76 in the image plus runtime cells; `globals.json`
names; `pediaSources` item name words 4160 / spell definitions 14298 / spell names 10173; plus/map, plus/pedia,
plus/cheats via `dsImageOffset + 0x...`); (b) the **sound driver segment** 0713 as `G.image.slice(0x7130, +0x2700)`
(audio_cab.js CS variables and tables); (c) the title string / version is not read (profile data).

| what | v1.0 | v1.3 | how to carry it |
|---|---|---|---|
| load module | file[0x7B0..] (not packed) | **unexepack(ST.EXE)** = 62,432 B image | `exepack: true` (state.js already does this for Pool) |
| DS image | 0C1C0, 0x47E0 B | **0ABE0**, 0x4800 B | `dsImageOffset 44000`, `dsBytes 36640` |
| every game table/string in the image (rune rows DS:0000, class tables 3E38.., item name words 1040, spell names 27BD, spell table 37DA, 3D step/wall/sky tables, CombatTerrain 26A2, ...) | DS:x | **DS:x + 2** (v1.0 bytes 0000..47A1 == v1.3 bytes 0002..47A3, byte for byte) | `dsMap [{from 2, to 0, length 0x47A2}]`: the engine builds a v1.0-shaped `G.ds`, nothing else changes |
| System unit initialised words | 47A6..47DF | 47BE..47F7 (identical) | `dsMap` second range (not read by the engine; completeness) |
| BSS globals (names in globals.json; the ECL VM cells keep their numbers by construction) | x | x+24 (47D2..4F92), x+25 (4F98..4FC9), x+26 (4FCA..8CAB): two new byte variables, one of them 4FB0 = the heap-warning flag | nothing: BSS is engine state, addressed symbolically |
| rune rows | DS:0000 | DS:0002 (`[di+2]` in v1.3 RuneWheelCheck) | covered by dsMap |
| sound driver segment | 0713, 0x2700 B copied | **0699, 0x1780 B**; CS variables **-6** (busy 011B, loop 011C, recsize 011D, countdown 011E, sndIdx 0142, cur 0144, chanBase 0146, noteTab 0148, ret 014A, sndIdx[4] 014C, output 0150, lengthTable 0151, jump table 0164, speaker channels 0170, speaker notes 02F0, loudest 0308, PSG channels 030A, PSG notes 048A, speaker sound table 04A2, PSG sound table 0542); timer/ISR code at v1.0 - 0xF31 (InstallSoundTimer 12BF, RemoveSoundTimer 12F4, ISR 132D, SpeakerChannelTick 13BA, SoundChannelStep 14BD, ReadSoundCommands 154E, NoteList 1604, StartSpeakerChannels 1685, StartPsgChannels 16F1, SetSoundOutput 175D); note tables and command lists identical (pointers aside); **note-list entry format changed** (3.3) | `audio.segment 0x699`, `variableDelta -6`, `noteEntryBytes 3`, `notesOnChannel0Only`, `noteOffGap false` |
| GAME.OVR copy-protection byte | 0x4A56 `EB`/`74` | **0x4A9C** `74` (`EB` would be a patch) | manifest `normalize` offset 19100 |
| save files, record sizes, DAX formats | 13,149 / 422 / 63 / 9 B | identical (SAVE/ on the CD: SAVGAMA 13,149 B, CHRDAT* 422 B, .FX 9/27 B) | nothing |

The complete machine-readable map: **`decode/v13/v13_offsets.json`**; the profile form: `game/profiles/cab-1.3.json`.

## 3. Behaviour changes (step 3)

### 3.1 Copy protection — H
v1.3 ov03 RuneWheelCheck (0118, 360 instr) = v1.0 011A with two differences: the answer rows are read at `[di+2]` (DS shift) and
the compare after `cmp al,[bp-3]` is **`74 1C` JZ** at ov03:03C6 = **GAME.OVR 0x4A9C** (v1.0: `EB 1C` at 0x4A56). The retry
compare at 03EC (0x4AC2) is `74 09`. So the CD copy has the **retail logic live: 3 tries, then "An unseen force hurls you
into the abyss!" and Halt**, both at start-up (unless demo / `Wooden`) and at ECL op 3C (ECL1/80 unchanged). The formula,
tiles and rows are v1.0's (`decode/ecl/runewheel.py` applies with the DS shift). Class: **protection**. Engine: our flag
(bypass by default) is unchanged; the manifest records which form the player has (section 4).

### 3.2 ECL scripts and GEO4 — H
Changed DAX files: ECL1/3/4/5, GEO4. Of their 20 records, **14 are byte-identical**; the 6 changed ones (`dax.py` round trip
OK, `ecldis.py` on the v1.3 records, `ecldiff.py` address-insensitive diff in `decode/v13/ECL_DIFF_V13.txt`):
| record | v1.0 -> v1.3 | change (class) |
|---|---|---|
| ECL1/81 (+3 B) | 93E9 `GOTO 93F0` | `NEW_ECL #50` after "...a great feast and parade are held in your honor" + `SAVE #02,[4C86]`: the Dagger Falls reward now switches to block 50 instead of running on into the "long road" text (**bug fix**: the old GOTO bytes stay as dead code at 93EC) |
| ECL3/18 (same size) | 832D `SAVE #03,[4C02]` | `SAVE #01,[4C02]` (**balance/logic**: encounter counter set to 1) |
| ECL4/32 (+10 B) | 8084 `IF_GT EXIT` | `IF_EQ GOTO 8090; SAVE #00,[4CE4]; EXIT`: entering block 32 with [4CE4] set now clears it and exits instead of comparing (**bug fix**, entry guard) |
| ECL5/49 (+4 B) | 8433 `GOTO 8EA3` after "...heading back to the wilderness. Do you want to continue?" | `SAVE #FF,[7EC9]; IF_EQ EXIT`: a "no" answer exits the vector instead of jumping (**bug fix**) |
| ECL5/50 (+58 B) | vecB / entry at 811D and 85B5 | two 7-instruction clamps inserted: `COMPARE [C04B],#06; IF_LT SAVE #FF,[7EC9]; IF_LT SAVE #0F,[C04B]; IF_LT SAVE #0F,[C04C]` (party X < 6 -> reload files, X := Y := 15) and the same wilderness-exit guard as ECL5/49 at 84D1 (**bug fix**: party position after a wilderness return) |
| GEO4/32 | plane 3 (passage/door state) cell (1,5) `04` (E side) | `00`; cell (2,5) `00` -> `40` (W side): the door flag moved to the other side of the same wall (**map fix**) |
Trailing record bytes (03/02/15/FF -> 00) are padding. **Opcode set unchanged**: ov02 holds 60 handlers in both versions
matched 1:1 (only PartyStrength differs, by expression order), ov07 (operands, memory, GOSUB, skip table routine
ov07_1FF5) 34/34 unchanged, ov34's 58 opcode names identical; the 17 v1.3 records disassemble with 58 distinct opcodes and
the same coverage as v1.0 (`ECL_V13_INDEX.md`). The engine reads scripts and maps from the player's DAX files: **no engine
change**, only trace/acceptance expectations.

### 3.3 Sound driver (res_0713 -> res_0699) — H
Pascal half: PlayOrStopSound 0020 identical (device codes 0/1/2, id 15 countdown), StartSound 00D4 no longer sets
CountdownPtr (a new unit init at 00FF sets `CountdownPtr := 0699:011E` once), Start*Channels / SetSoundOutput identical
(CS variables -6). Timer half (484 vs 482 instructions, same code at -0xF31) with **one real change in NoteList**
(v1.0 2535 / v1.3 1604):
```
v1.0: bl := e0; dst := chanBase + (e0>>5)*30h; duration := Lo(tempo or 1) * LengthTable[e0 and 1Fh]   (2-byte entries)
      n := e1 and 7Fh; if n <> 7Fh then dst.duration := duration; dst.noteOff := duration - dst.gap(+10h); ... (any channel)
v1.3: cl := e0>>5; dst := chanBase + cl*30h; duration := e2 (if tempo <= 1) else tempo * e2                (3-byte entries)
      n := e1 and 7Fh; if (n <> 7Fh) and (cl = 0) then dst.duration := duration; dst.noteOff := duration; ...  (channel 0 only)
      di += 3
```
That is **Pool's 08AE driver again** (3-byte note entries, channel 0, no note-off gap); the length table at 0151 is still in
the data but unread; the note data was re-encoded accordingly (0x05F2..0x11D8); speaker/PSG pitch tables and the sound
command lists are identical. Class: **bug fix / revert** (the v1.0 2-byte format was the Curse-only variant). Engine:
audio_cab.js needs the v1.3 constants and the Pool-style note parser (request v13-2); the data itself comes from the player's
ST.EXE, no transcription.

### 3.4 Game routines that really changed (13) — H unless marked
| unit:routine (v1.0 -> v1.3) | change | class | engine |
|---|---|---|---|
| ov12 EffStoneGaze 1A65, EffParalyzingGaze 289C -> **ov22 585E** (new), ov12 InstallEffectHandlers 2E3C -> 2AD8, ov22 InitSpellTable 630B -> 658F | The two gaze handlers left the party unit. `EffectHandler[53h]` (stone gaze) is now installed by InitSpellTable (`[710C] := 00C2:01E7` = ov22 585E); ov12 no longer writes `[7Eh]`, so ov22's own `EffParalysingGaze` 6022 (v1.0 shadowed by ov12's, ENGINE_DELTA "ov12's must win") is **the live 7Eh handler in v1.3**. 585E = EffStoneGaze with a new prologue: `c^.p18D^.target := nil; SpellHandlers[0](41h, 1, @DS:7746)` (the camp/combat target selector) `; if c^.p18D^.target = nil then exit` before the gaze/mirror/save logic. The item hook pointers (`item_HookProc`, g_71EE) are still set in v1.3 ov12 (31D6/31E3). | bug fix (gaze targeting via the selector; paralysis via the magic-unit handler) | v13-3 |
| ov22 HasteSlow 3804 -> 387B | after the inner `call 0F06` the v1.0 loop `for i := 1 to SpellTargetCount do CallEffectHooks(12h, SpellTargets[i])` (21 instr) is **removed** | bug fix (no extra 12h hook per target) | v13-3 |
| ov22 AddSpellLineCounted 05B4 -> 05B9 (291 -> 317) | spell-list line insertion rewritten: the spell level `SpellTable[spell and 7Fh].level` (37DB) is fetched once up front, the insertion search compares `entry.level > new.level` (`jg`) with an "inserted" flag [bp-11], duplicate test against the id list 4B9C kept; new node from GetMem(2Eh) as before | bug fix (spell list order in Memorize/Scribe); v1.3 pseudocode in 3.5 | v13-3 |
| ov26 VerticalListMenu 0DF9 -> 0E9F, SkipHeaders 0BF9 -> 0C08 (77 -> 103), MoveSelection 0D6B -> 0DCA (44 -> 68) | VerticalListMenu: `if count <= visible then menu_Top := 0`; SkipHeaders/MoveSelection: after each step `if sel-1 < top then top := menu_Top / sel-1` clamps (two blocks each, through the parent frame `ss:[di-56h]`, `ss:[di+0A]`) | bug fix (list scrolling when the selection leaves the window). Note: the accepted v1.0 build's view_ov26.js already carries the SkipHeaders / MoveSelection `count-1` clamps (the v1.0 asm has only the menu_Top clamps: ov26.c SkipHeaders / MoveSelection), so the only v1.3 line the JS adds is the VerticalListMenu `count <= page` reset | v13-3 (view_ov26.js) |
| ov17 PartyCreationMenu 01DD -> 01CC | `L`oad: after LoadGame the v1.0 abort `if ECL[4EFA] <> 0 then ShowBottomPromptAndReadKey('You''ve already defeated Tyranthraxus.'); TerminateGame` (17 instr, string 0168) is **removed**. `B`egin (v1.3 0569..058C): `if on(10) and ((PartyList <> nil) and (ECL[4EFA] = 0) or DemoMode) then begin ...` — with the won flag set and no demo, Begin does nothing (v1.0: `PartyList <> nil or DemoMode`). Text "You've already defeated Tyranthraxus." no longer exists in v1.3. | bug fix / text (a finished game loads again; it cannot be continued with Begin) | v13-3 |
| ov16 ConvertPoolCharacter 1490 -> 14B3 | the exceptional-strength clamp at the end of the stat loop (i = 5): v1.0 (4300:191A..195B) tests and raises `stat[10h + 2*i]` = **+1Ah CHA maximum** (the loop variable left at 5: the quirk noted in engine_ov16.js); v1.3 (14B3 + 1933..196C) tests and raises **+10h STR** against the same table byte `RaceAbilityLimits[race*16 + sex] + 4` (DS:3F8A, v1.3 3F8C) | bug fix (the clamp lands on STR instead of CHA max); pseudocode 3.5 | v13-3 (engine_ov16.js) |
| ov11 ov11_0056 (InitGame) / ov11_06D8 | new byte flag (v1.3 4FB0; = the inserted BSS byte before v1.0 4F98): `:= 0` in InitGame's `[4A1C] = 3` branch, `:= 1` at the start of ov11_06D8; read by HeapErrorHandler | support for the heap warning | none (browser: no heap limit) |
| ov00 HeapErrorHandler 0017 -> 0042 (23 -> 44) | TP 6 HeapError protocol (`if size = 0 then exit`); texts changed: "Time to save your game" -> **"WARNING: Insufficient Memory"** (when the 4FB0 flag is set: calls ov16 e2, then `GameSaved`), else **"Insufficient Memory. Exiting Program"** + TerminateGame | text + robustness; not reachable in the browser engine (no 640 KB heap) | none |
| ov24 CollectOppositeSideTargets 2628 -> 25E0 | only `[6E96]` -> `[6EB0]` (+26, the DS map) | moved operand | none |

Everything else in the 36 overlay units and the resident game units is the same source compiled by TP 6.0 (section 1.3).
The TP runtime differences (System/Overlay/Dos/Crt) do not reach the engine except through `Random` (same LCG, verified)
and the heap (irrelevant). Faithful v1.0 quirks kept by the engine (ENGINE_DELTA §2) are **still present in v1.3**: the
shop price code is compiler-identical (ShopBuy/ShopItemsMenu only differ by `div`->`shr`), CHECK PARTY and the opcode-1F
hazard are in the unchanged ov02/ov07 code.

**What a build must change to play v1.3 faithfully:** (1) load ST.EXE through unexepack and the DS map (v13-1); (2) the
sound adapter's constants and the 3-byte note parser (v13-2); (3) the seven behaviour items above behind
`engine.behaviour.id = 'cab-1.3'` (v13-3); (4) the manifest's copy-protection byte offset and manifest selection (v13-4);
(5) nothing for scripts/maps (player's DAX).

### 3.5 Pseudocode of the two rewritten routines (v1.3 bytes; H) — written for v13-3
Addresses are v1.3 unit offsets (ov22 = GAME.OVR 02DFB5 + ofs, ov16 = 01B731 + ofs); v1.3 DS names in v1.0 numbering (-2 /
-26): `sl_List` 4B5C (v1.0 4B44), `sl_Counts` 4B60 (4B48), `sl_Ids` 4BB4 (4B9C), `SpellTable` 37DC (37DA), `SpellNames` 27BF (27BD).

```pascal
procedure AddSpellLineCounted(id [BP+6]: Byte);     { v1.3 ov22 05B9, RETF 2, 317 instructions; v1.0 05B4 = MAGIC.pas.md }
var p, q, new: PLine; n, lvl, k, t, carry: Byte; done: Boolean;
begin
  p := sl_List;  done := false;                                           { 05C0 .. 05CD }
  lvl := SpellTable[id and $7F].level;                                    { 05D1 .. 05E2  (+1 of the 16-byte row) }
  if sl_List = nil then begin                                             { 05E5 }
    FillChar(sl_Counts, $54, 0);  New(p);  p^.next := nil;  sl_List := p;   { 05EE .. 0624  GetMem(2Eh) }
    n := 0;  sl_Counts[0] := 1;                                           { 0628 .. 0632 }
  end else begin
    n := 0;                                                               { 063A }
    while (p <> nil) and not done do                                      { 063E .. 064A }
      if p^.header = 0 then begin                                         { 064C }
        if SpellTable[sl_Ids[n]].level > lvl then done := true            { 0656 .. 066F  first line of a higher level }
        else if sl_Ids[n] = (id and $7F) then done := true                { 0671 .. 0684  the same spell }
        else begin Inc(n); p := p^.next end                               { 0686 .. 069A }
      end else begin p := p^.next; Inc(n) end;                            { 06A2 .. 06B3  a heading line counts too }
    if sl_Ids[n] = (id and $7F) then Inc(sl_Counts[n])                    { 06B8 .. 06CD -> 07CF  one more copy }
    else begin                                                            { a new line BEFORE p }
      q := sl_List;                                                       { 06D0 }
      if q = p then begin New(new); new^.next := p; sl_List := new; p := new end     { 06E3 -> 0759 .. 078F  at the head }
      else begin
        while q^.next <> p do q := q^.next;                               { 06ED .. 0713  p = nil: after the last line }
        New(new);  new^.next := q^.next;  q^.next := new;  p := new;      { 0715 .. 0754 }
      end;
      carry := 1;                                                         { 0792 }
      for k := n to $53 do begin t := sl_Counts[k]; sl_Counts[k] := carry; carry := t end;   { 0796 .. 07CB }
    end;
  end;
  if id > $7F then p^.text := ' *' else p^.text := '  ';                   { 07D9 .. 0807  CS:05AE / 05B1 }
  p^.text := p^.text + SpellNames[id and $7F];                            { 0807 .. 083E }
  p^.header := 0;                                                         { 083E }
  if sl_Counts[n] > 1 then p^.text := p^.text + ' (' + ByteToStr(sl_Counts[n]) + ')';   { 0846 .. 089B  CS:05B4 / 05B7 }
  if sl_Ids[n] <> (id and $7F) then begin                                 { 08A0 .. 08B3 }
    t := sl_Ids[n];  sl_Ids[n] := id and $7F;                             { 08B5 .. 08CF }
    for k := n + 1 to $53 do begin carry := sl_Ids[k]; sl_Ids[k] := t; t := carry end;   { 08D3 .. 090A }
  end;
end;
```
Against v1.0 (MAGIC.pas.md 05B4; game/areas/magic_ov22.js AddSpellLineCounted): v1.0 walks `while (p^.next <> nil) and
(level(sl_Ids[n]) <= lvl)` comparing `sl_Ids[n-1]`, and links the new node **after** p; v1.3 stops at the first line whose
level is higher (or the same spell), links the new node **before** it (or at the head, or after the last line), and a
heading line also advances n. The text and the `sl_Ids` shift are the same.

```pascal
{ ConvertPoolCharacter, the stat loop's last iteration (v1.3 ov16 1906 .. 196C; v1.0 4300:18E3 .. 195F) }
if i = 5 then begin                                                       { 1906 }
  ch.excStr(+1Ch) := pool[+16h];                                          { 190F .. 191E }
  { v1.0: if ch.stat[10h + 2*i] < RaceAbilityLimits[race*16 + sex + 4] then ch.stat[10h + 2*i] := that   (i = 5 -> +1Ah CHA max) }
  if ch.STR(+10h) < RaceAbilityLimits[ch.race(+74h)*16 + ch.sex(+119h) + 4]   { 1922 .. 1948  table DS:3F8C (v1.0 3F8A) }
    then ch.STR(+10h) := RaceAbilityLimits[ch.race*16 + ch.sex + 4];      { 194A .. 196C }
end;
```
Table bytes (v1.0 DS:3F86, 16 per race: STR min m/f, STR max m/f, column +4/+5 m/f, then INT/WIS/DEX/CON/CHA min/max): human
(race 7) `03 03 12 12 64 32 ...`, so column +4 is 100 for a human male and 50 for a human female (the v1.0 JS calls it the
exceptional-STR maximum; the meaning is M). Faithful port: v1.3 raises `+10h` to that byte, v1.0 raised `+1Ah`.

## 4. Profile, manifest, BYOC (step 4)

### 4.1 Files proposed in this commit
- **`game/profiles/cab-1.3.json`** — an *overlay* profile (`basedOn: cab.json`; `supported: false` until the engine
  requests land): `manifest.url`, `engine.state` (ST.EXE, `exepack: true`, `dsSegment 0ABE`, `dsImageOffset 44000`,
  `dsBytes 36640`, **`dsMap`** two ranges), `engine.audio` (segment 0699, delta -6, 3-byte notes, channel 0, no gap),
  `engine.copyProtection` (retail check live, GAME.OVR 0x4A9C), `engine.behaviour.id 'cab-1.3'`, `areas.scriptsDelta`
  (information for the trace lane). Alternative accepted by the assignment: the same keys as a `variants["1.3"]` block in
  cab.json; the overlay file keeps cab.json untouched (cab-build-engine's file).
- **`game/byoc/manifest-cab-1.3.json`** (generated by **`tools/mkmanifest13.py`**, sibling of mkmanifest.py): 89 files,
  SHA-256 + size only. `ST.EXE` hashed **as shipped** (EXEPACK; entry carries `exepack: true`, `unpackedSize 62432`; the
  importer stores the packed file and state.js unpacks at load = Pool's BYOC precedent). `GAME.OVR` required, hashed, not
  stored, `normalize` at **offset 19100 (0x4A9C): accept 74 (retail) / EB (patched), hashAs 74**. The other 87 files: 82
  have the v1.0 hashes, ECL1/3/4/5 and GEO4 are new. CURSE.CFG, START.BAT, COPYCURS.EXE, DKK, SAVE/ are not listed (the
  importer ignores them; SAVE/ is picked up by the save scan as for v1.0).

### 4.2 Engine requests (cab-build-engine; STATUS.md "engine request #n")
- **v13-1 profile overlay + exepack + dsMap**: load `cab-1.3.json` over `cab.json` (or a `variants` block), `exepack: true`
  path for ST.EXE (state.js has `unexepack`), and `engine.state.dsMap` applied when building `G.ds` (copy ranges from the
  unpacked image into v1.0 positions). After that every `G.ds[...]`, globals.json, pediaSources, plus/map and plus/pedia
  read works unchanged.
- **v13-2 audio_cab.js v1.3 variant**: `SEG`/segment length and the CS constants from `engine.audio` (all -6; jump table
  0164; channel records 0170/030A; tables 04A2/0542), the timer-code offsets only matter for comments; the note parser
  per 3.3 (3-byte entries, `duration = (tempo <= 1 ? e2 : tempo*e2)`, notes on channel 0 only, `noteOff = duration`, `di += 3`).
- **v13-3 behaviour switch `cab-1.3`** for the 3.4 items: EffectHandler[53h] := gaze-with-target-selector (and 7Eh := ov22's
  EffParalysingGaze), HasteSlow without the per-target 12h hook, AddSpellLineCounted v1.3 ordering, VerticalListMenu /
  SkipHeaders / MoveSelection clamps (view_ov26.js), PartyCreationMenu Load/Begin won-flag guard, ConvertPoolCharacter stat
  clamp. The two routines AddSpellLineCounted and ConvertPoolCharacter have their v1.3 pseudocode in 3.5 (the v1.3 listing is `decode/bin/v13/ovl/ov22_00C2.bin` / `ov16_00A1.bin`
  via `tpovl.py --extract`, no Ghidra needed for two routines).
- **v13-4 BYOC manifest selection**: the importer tries every manifest in `game/byoc/` (cab-1.0, cab-1.3) and picks the one
  whose required files all match; the report names the version and the GAME.OVR variant; the active profile follows the
  manifest id (`engine.id`). Refusal text for a mixed folder stays as today.

### 4.3 BYOC test plan for the CD copy (acceptance, after v13-1 .. v13-4)
| case | folder | expected |
|---|---|---|
| T1 v1.0 owner's copy (re-targets/goldbox/cotab/curazure) | 89 files, GAME.OVR 0x4A56 = EB | manifest cab-1.0, variant `patched-4A56`, profile cab (unchanged behaviour; existing gate) |
| T2 v1.0 retail form | T1 with 0x4A56 = 74 | manifest cab-1.0, variant `retail` |
| T3 **v1.3 CD copy** (WIZWORKS/CURSE) | ST.EXE 57,789 B + GAME.OVR 272,137 B + 88 data files | **manifest cab-1.3**, variant `retail` (0x4A9C = 74), profile cab-1.3; title screen shows the v1.3 string from the player's DS (`0000:0006` is in the code segment, so the profile `version` is shown); the rune wheel appears at start-up unless the engine flag bypasses it (default) |
| T4 v1.3 with a 0x4A9C = EB patch | T3 with one byte changed | manifest cab-1.3, variant `patched-4A9C` |
| T5 mixed folder (v1.3 DAX + v1.0 START.EXE, or v1.0 DAX + ST.EXE) | | **refused** by both manifests (`likelyOtherVersion: yes`, names the 6/7 mismatching files); no partial import |
| T6 v1.3 START.BAT/CURSE.CFG/DKK/COPYCURS.EXE present | | ignored; CURSE.CFG rebuilt by the engine (`E/P/C:\SAVE\/F`); SAVE/ on the CD imported as saves (SAVGAMA.DAT 13,149 B + CHRDATA*/CHRDATC* 422 B) |
| T7 run checks on T3 | | RUN-1 first 3D area walk; the 6 changed records are reached by the trace lane (ECL1/81 reward, ECL3/18, ECL4/32 entry, ECL5/49, ECL5/50 wilderness return, GEO4/32 door); sound id 2..14 play with the 3-byte parser (compare one speaker divisor sequence against DOSBox); gaze monster fight with a target selected |
| T8 refuse the others | Pool of Radiance folder, Hillsfar, a Curse copy missing GAME.OVR | refused as today (`nofolder` / missing required) |

## 5. Unknowns (explicit)
- AddSpellLineCounted and the ConvertPoolCharacter clamp are now in 3.5 (from the v1.3 bytes); the meaning of the table
  column +4 of RaceAbilityLimits (100 / 50 for humans) stays M.
- PartyCreationMenu `B`egin with the won flag set: v1.3 skips Begin unless DemoMode (3.4, read from 0569..058C; H).
- Whether SSI's retail v1.0 shipped the rune check enabled stays open (ECL_VM.md §8); v1.3 on the CD has it enabled.
- The 7 TP 6 runtime "new" System routines are not named (runtime lane work, not needed by the engine).
