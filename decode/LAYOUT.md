# LAYOUT — START.EXE + GAME.OVR code units (cab-tooling, 2026-10-20)

All segments are **image-relative** (paragraphs from the start of the MZ load module = the values the MZ
relocations and overlay fixups contain; runtime adds PrefixSeg+10h). Analysis load base for the resident image =
segment 0000. Tools: `decode/tools/tpovl.py` (`--json decode/bin/ovl_layout.json`, `--extract DIR`),
`decode/tools/ghidra_prep.py`, `decode/tools/ghidra_build.sh`. Prior art: `PoolRadianceRE/decode/LAYOUT.md` (FBOV,
TP 6.0); every delta vs Pool is marked **D-Pool**.

## START.EXE (step 1) — not packed (H)
Evidence (START.EXE, 69,968 B): MZ header words `4D5A 0150 0089 01E3 007B ...`: e_cblp 0150, e_cp 0089 -> file size
0x88*512+0x150 = 69,968 = whole file; **e_crlc 01E3 = 483 relocations** at e_lfarlc 001C; header 0x7B paras (0x7B0 B);
load module 0x7B0..0x11150 = **0x109A0 B (0x109A paras)**; CS:IP **0000:002F**, SS:SP **150C:2710**.
No EXEPACK signature ('RB' absent, 483 real relocs; Pool had 0 relocs + an EXEPACK stub). **D-Pool: no unpack step.**
Image starts with Pascal string constants of the main program: `05 "STING" 1E "Curse of the Azure Bonds v1.0 " 09 "Play Demo"`.

## Compiler (H/M)
- Turbo Pascal: "Runtime error " / " at " / ".\r\n" at 0A54:01DF (image 0A733) in the System unit; TP procedure
  prologue `55 89 E5` on all 853 live overlay entries; `9A` far-call init chain (below).
- **Version: Turbo Pascal 5.x, most likely 5.0 (M).** Evidence: (a) overlay signature `TPOV` (Pool's TP 6.0 file is
  `FBOV`; Wikidata Q105855587 lists 54504F56 'TPOV' as the "Turbo Pascal Overlay" magic); (b) **no** "Portions
  Copyright (c) 1983,9x Borland" string anywhere in the image (Pool/TP 6.0 has it); (c) System init 0A54:0000 computes
  the `FreePtr` segment as `PSP:[2] - 0x1000` (0A56B `26 A1 02 00 2D 00 10 A3 C0 47`) = the TP 4.0-5.5 heap manager with
  a 64 KB free list below the top of memory (TP 6.0+ uses HeapEnd/FreeList); (d) the Overlay unit installs an
  `OvrReadBuf` hook (DS:8CB0, `call word ptr [8CB0]` at 0A0D:039E) = TP 5.0+ Overlay unit; (e) release year 1989
  (TP 5.5 shipped May 1989). 5.0 vs 5.5 cannot be separated by these signatures: **open question** for the runtime lane
  (`decode/rt/RT_LEDGER.md`).

## Data segment / stack (H)
- DS = **0C1C**: relocated `B8 1C 0C 8E D8` (MOV AX,0C1C; MOV DS,AX) at image 09BE1 (= 09AB:0131, Crt unit Ctrl-Break
  handler) and 0A32F (= 0A0D:025F, the Overlay unit's INT 3Fh handler); System init 0A54:0000 = `BA 1C 0C 8E DA`
  (MOV DX,0C1C; MOV DS,DX). 5 MZ relocations name segment 0C1C. **D-Pool: 0C7C.**
- Initialised data in the image: 0C1C..109A = **0x47E0 B** (spell names "Cure Blindness", "Cure Disease", class-name
  letter tables...). SS:SP = 150C:2710 (MZ header) -> DS+BSS = 0C1C..150C = **0x8F00 B**, stack 0x2710 B (= `$M 10000`)
  above it, heap above the stack. **D-Pool: SS 14F2:4000.**
- System variables (from 0A54:0000 and the Overlay unit): DS:47A2 OvrCodeList, 47A4 OvrHeapSize, 47A6 OvrDebugPtr,
  47AA OvrHeapOrg, 47AC OvrHeapPtr, 47AE OvrHeapEnd, 47B0 OvrLoadList, 47B2 overlay file handle, 47B8 HeapOrg (segment word; pointer 47B6, cab-rt),
  47BC HeapPtr, 47C0 FreePtr(seg), 47D2 PrefixSeg; 8CAE OvrResult, 8CB0 OvrReadBuf (all M, by use; names from the TP
  System/Overlay interface order).

## Unit order (H)
Main program at 0000:002F is a chain of **48** `9A` far calls to unit initialisers (System first, then units in reverse
segment order = `uses` order), ending at 0000:011F = `55 89 E5 81 EC 00 01` = the PROGRAM body. Overlay units' inits
are called through their stub entry 0 (stub:0020). Chain: 0A54:0000 (System), 09AB:0000 (Crt), 097D:0000, 0713:0110,
06EA:0282, 0636:0B2F, 0542:0D20, 0297:21DC, 020F:027C, ov35, 01A0:06A5, ov34, 019B:0000, ov33, ov32, ov31, 0186:0000,
ov30, ov29 ... ov00 (36 overlay inits + 12 resident inits; 097F and 0A0D have no init, like Pool's Dos and Overlay).
**D-Pool: 47 calls, 35 overlay units; Pool's big resident game unit 00BA (0x30B0 B) has no counterpart here.**

## Resident code segments (15 code + DS)
Segment starts = the set of MZ-relocation target segments plus init-chain targets (every inter-unit far call is a
relocated `9A seg:off`); ends = next start. Stub segments are interleaved in unit order (see below).

| seg | end | size | unit / role (evidence) | TP std unit | Pool twin | conf |
|---|---|---|---|---|---|---|
| 0000 | 0039 | 00390 | main program: consts "STING","Curse of the Azure Bonds v1.0 ","Play Demo"; init chain 0000:002F; body 0000:011F | - | 0000 | H |
| 0186 | 0187 | 00010 | unit with empty init only (`55 89 E5 89 EC 5D CB`) | unknown | 03DA | H(bytes)/L(role) |
| 019B | 019C | 00010 | unit with empty init only (same bytes) | unknown | 03ED | H/L |
| 01A0 | 020B | 006B0 | **frame/rectangle unit** (cab-rt): DrawFrame 01A0:0000, ClearRectangle 04CD (Pool 03F1 twin, see "Resident game units"); init 01A0:06A5 | game | 03F1 | M |
| 020F | 0297 | 00880 | startup/config unit, init 020F:027C: "GAME.OVR","*.exe","B:\","A:\","curse.cfg","PATH TO SAVE DATA (DEFAULT - ","USING DEFAULT PATH: ","TANDY 1000 USERS - Make sure NUMLOCK is on.","Not enough memory to run game.  You need"," more bytes.","Overlay error, program abort!","GRAPHICS ADAPTER TYPE: [1] CGA [2] EGA [3] Tandy","SOUND TYPE: [1] PC [2] Tandy 1000 [3] Silent" | unknown | 042B | M |
| 0297 | 0542 | 02AB0 | **picture/video unit** (cab-rt): LoadPicture 0297:011B (".dax" at 0116), DrawPicture/PutPicture/Mirror/Recolor..., SetVideoMode, EGA palette; 18 routines shape-matched to Pool 0464; init 0297:21DC | game | 0464 | H |
| 0542 | 0636 | 00F40 | **EGA text/font + prompt unit** (cab-rt): LoadTextFont 0542:0184 ("8X8d1",".dax"), DrawText, DrawWrappedText ("Press any key to continue"), bottom-line input, ClearScreen; 20 routines matched to Pool 0709; init 0542:0D20 | game | 0709 | H |
| 0636 | 06EA | 00B40 | **file/DAX/memory unit** (cab-rt): LoadDaxRecord 0636:08DE, OpenDax/CloseDax, DaxRleDecode, OpenWithPrompt ("Couldn't find ... Check install."), WaitOverlayDisk ("game.ovr","Please insert overlay disk."), Alloc/FreeBlock, BIOS text output, SetDataSet; init 0636:0B2F | game | 0802 | H |
| 06EA | 0713 | 00290 | **keyboard/terminate/debug unit** (cab-rt): TerminateGame 06EA:0000, ReadGameKey 010D (hot keys; with `STING`: debug.txt log, dump "who: / sp#:"), PollOneKey 0268; init 06EA:0282 (empty) | game | 0899 | H |
| 0713 | 097D | 026A0 | **sound driver unit** (cab-rt; was "resident unit"): PIT/speaker (ports 43h/40h/61h) + Tandy PSG (port C0h) timer-interrupt player, data in its own code segment (`B8 13 07 8E D8` x4), PlayOrStopSound 0713:0020, Install/RemoveSoundTimer 21F0/2225, ISR 225E; init 0713:0110; text "Runtime Error 209 at 0BAD:0038" with high bits at 0713:0120 lies in the sound data area (role unknown) | game | 08AE | H |
| 097D | 097F | 00020 | unit whose init is only `@StrAssign(DS:8C80, DS:24EC, 14h)` (System 0A54:064E: a string[20] variable set from a typed constant; cab-rt) | game | 0A31 | M |
| 097F | 09AB | 002C0 | TP **Dos** unit: Intr, Get/SetDate, Get/SetTime, DiskFree, FindFirst/FindNext, FExpand, FSplit (decode/rt/RT_LEDGER.md) | Dos | 0A32 | H |
| 09AB | 0A0D | 00620 | (RT_LEDGER.md: Init, ClrScr, ClrEol, Delay, KeyPressed, ReadKey, AssignCrt + callbacks, H) init 09AB:0000; INT 16h x4, INT 10h, BIOS data `MOV AX,0040; MOV DS,AX` x3, Ctrl-Break handler sets DS=0C1C -> TP **Crt** unit (same size as Pool's Crt, 0x620) | Crt | 0A40 | M |
| 0A0D | 0A54 | 00470 | no-init; "PATH=" at 0A0D:0013-0017 (OvrInit path search; OvrInit itself starts at 0A0D:0018, RT_LEDGER.md), signature check, loader, INT 3Fh handler (bytes below) -> TP **Overlay** unit | Overlay | 0AA2 | H |
| 0A54 | 0C1C | 01C80 | **System** unit: init 0A54:0000 called first; "Runtime error" at 0A54:01DF; 304 relocations target it (every unit calls it) | System | 0AF8 | H |
| 0C1C | 150C | 08F00 | DS: 0x47E0 initialised + BSS to SS | - | 0C7C | H |

Stub segments (36) occupy 0039..0186, 0187..019B, 019C..01A0 and 020B..020F (interleaved with the resident units
0186, 019B, 01A0 in unit order; ov35's stub sits after 01A0).

## TPOV overlay file (H)
GAME.OVR (272,218 B = 0x4275A) = `54 50 4F 56` **'TPOV'** and **nothing else in the header**: the first unit's code
starts at file offset **4** (bytes 4.. = `16 "Time to save your game" 55 89 E5 ...` = ov00, FileOfs 4 in its stub).
Then the 36 units back to back: code[CodeSize] then fixups[FixupSize]; no gaps; last unit ends exactly at EOF
(tpovl.py: "end of last unit 0x4275a, file 0x4275a -> every byte accounted for"). Totals: code 0x3FB54 + fixups
0x2C02 + header 4 = 0x4275A. **D-Pool: FBOV has an 8-byte header ('FBOV' + dword payload length); TPOV has 4.**

Proof from the loader, not from the file alone (Overlay unit 0A0D):
- **OvrInit** (0A0D:0018 — corrected by cab-rt; 0013 is the "PATH=" literal — `55 8B EC 81 EC 80 00 FC 83 3E A2 47 00 ...`): opens the file (search order: as given,
  then the EXE directory on DOS 3+ (`B4 30 CD 21 3C 03`), then PATH=), then `B9 04 00 B4 3F CD 21` **reads 4 bytes**
  and `81 7E FC 54 50` / `81 7E FE 4F 56` compares them with 'TP','OV' (0A0D:0048/004F); on success stores the handle
  in DS:47B2, sets OvrReadBuf = 0A0D:01DF, hooks INT 3Fh to 0A0D:0248 (`BA 48 02 ... B8 3F 25 CD 21`), OvrResult 0.
  Failure paths return -1 (ovrError) / -2 (ovrNotFound).
- **Default reader** (0A0D:01DF): `mov dx,es:[4]; mov cx,es:[6]; mov ax,4200h; int 21h` (seek to the stub's dword
  FileOfs), `mov ds,es:[10h]; xor dx,dx; mov cx,es:[8]; mov ah,3Fh; int 21h` (read CodeSize bytes to LoadSeg:0000),
  then `mov cx,es:[0Ah]; int 21h` (read FixupSize bytes after the code), then
  `shr cx,1; lodsw; mov bx,ax; add es:[bx],di` with DI = PrefixSeg+10h over every fixup word = **each fixup is the
  offset of a 16-bit image-relative segment value in the unit code** (identical to FBOV / MZ relocations).
- **INT 3Fh handler** (0A0D:0248): pops the trap's return address into cs:[0F]/[11], saves regs, `MOV AX,0C1C; MOV DS,AX`,
  loads the unit if it is not resident, then calls OvrDebugPtr (DS:47A6) if set. The 908th `CD 3F` in the image
  is the immediate of `B8 CD 3F AB` (MOV AX,3FCDh; STOSW) at 0A0D:045E: the manager rewriting entry vectors.

Stub segment layout (evidence: image 0x390 = `cd 3f 00 00 04 00 00 00 65 00 0a 00 03 00 00 00` + 16 zero bytes,
entries at 0x3B0 `cd 3f 51 00 00 cd 3f 17 00 00 cd 3f ff ff 00`):
`+00 CD 3F` INT 3Fh ; `+02` ReturnAddr (0) ; `+04 dword` FileOfs (absolute in GAME.OVR) ; `+08` CodeSize ; `+0A` FixupSize
(bytes) ; `+0C` EntryPts ; `+0E` CodeListNext (previous stub seg; 0 for the first) ; `+10` LoadSeg (runtime) ; `+12..+1F`
runtime (0 on disk) ; `+20+5i` entry i = `CD 3F <offset> 00`. Same as FBOV. The stub table is **not** separate: it is the
36 stub segments in the resident image, chained through +0E (ov35 -> ov34 -> ... -> ov00 -> 0), head = DS:47A2 OvrCodeList.
**D-Pool: an entry offset FFFF is a dead slot** (18 of 871: ov00 e2, ov01 e2, ov03 e3, ov12 e30/e134, ov14 e14, ov16 e13,
ov18 e2, ov20 e1, ov27 e1/e2/e7, ov30 e1/e10, ov32 e1, ov33 e1, ov34 e1, ov35 e1); no MZ relocation or fixup refers to
one (interface routines the linker dropped). `INT 3Fh` count: 36 headers + 871 entries + 1 immediate = **908**.
Every one of the **853 live entries lands on `55 89 E5`** (853/853, H). Entry 0 = the unit init, last routine in the
unit's code (init offset = CodeSize - 7 in every unit), called from the main chain.

Analysis load segments: units are packed from **2000** upward, each rounded up to a 0x100-paragraph boundary (sizes
range 0x65..0x68AC B, so Pool's uniform 2000+N*500 does not fit; **D-Pool**). Mapping below and in
`decode/bin/ghidra/layout.txt`. In the Ghidra project each live stub entry `CD 3F off 00` is rewritten to `EA off ovseg`
(JMP FAR, same 5 bytes) so far calls into stubs resolve to the unit's routine; dead entries keep their bytes and get the
label `stub_ovNN_eK_dead`.

| unit | stub seg | analysis seg | GAME.OVR ofs | code | fixups | entries (live/dead) | init | sample strings |
|---|---|---|---|---|---|---|---|---|
| ov00 | 0039 | 2000 | 000004 | 0065 | 5 | 3 (2/1) | 0051 | Time to save your game |
| ov01 | 003C | 2100 | 000073 | 077B | 92 | 5 (4/1) | 0774 | based on the tsr novel "azure bonds"; kate novak |
| ov02 | 0040 | 2200 | 0008A6 | 3A20 | 481 | 60 (60/0) | 3A19 | PRESS BUTTON OR RETURN TO CONTINUE; Unable to find item file |
| ov03 | 0055 | 2600 | 004688 | 0451 | 43 | 4 (3/1) | 044A | tiles; like this: |
| ov04 | 0059 | 2700 | 004B2F | 1026 | 115 | 13 (13/0) | 101F | cast cure anyway: ;  will only cost  |
| ov05 | 0060 | 2900 | 005C3B | 1900 | 131 | 13 (13/0) | 18F9 | The party has fled.; You have lost the fight. |
| ov06 | 0067 | 2B00 | 007641 | 0974 | 61 | 6 (6/0) | 096D | Items: ; OverLoaded |
| ov07 | 006B | 2C00 | 00802F | 23A8 | 150 | 34 (34/0) | 23A1 | Loading...Please Wait; SPRIT |
| ov08 | 0078 | 2F00 | 00A503 | 136C | 176 | 14 (14/0) | 1365 | Magic On; Magic Off |
| ov09 | 007F | 3100 | 00B9CF | 1BCD | 139 | 16 (16/0) | 1BC6 | flees in panic; Move/Attack, Move Left =  |
| ov10 | 0086 | 3300 | 00D6B2 | 1DB8 | 72 | 25 (25/0) | 1DB1 | DungCom; WildCom |
| ov11 | 0090 | 3500 | 00F4FA | 08E3 | 71 | 4 (4/0) | 08DC | Loading...Please Wait; COMSPR |
| ov12 | 0094 | 3600 | 00FE6B | 3573 | 361 | 136 (134/2) | 356C | is fighting with snakes; Suffocates |
| ov13 | 00C1 | 3A00 | 0136B0 | 49B9 | 390 | 45 (45/0) | 49B2 | -Backstabs-; slays helpless |
| ov14 | 00D2 | 3F00 | 018375 | 0EC2 | 91 | 15 (14/1) | 0EBB | Not Here;  Pick |
| ov15 | 00D9 | 4000 | 0192ED | 25E8 | 215 | 31 (31/0) | 25E1 | cannot cast spells in this area; is in no condition to  |
| ov16 | 00E5 | 4300 | 01BA83 | 440C | 531 | 21 (20/1) | 4405 | from saved game ; *.guy |
| ov17 | 00EE | 4800 | 0202B5 | 56C3 | 338 | 20 (20/0) | 56BC | Choose a function ; You've already defeated Tyranthrax |
| ov18 | 00F7 | 4E00 | 025C1C | 15F7 | 134 | 12 (11/1) | 15F0 | Tyranthraxus' spirit coalesces ove; Press any key to continue. |
| ov19 | 00FD | 5000 | 02731F | 396A | 456 | 28 (28/0) | 3963 | (NPC); Level |
| ov20 | 0108 | 5400 | 02B019 | 0E8F | 49 | 17 (16/1) | 0E88 | Rest Time:; Rest Days Hours Mins Add Subtract  |
| ov21 | 0110 | 5500 | 02BF0A | 224E | 158 | 23 (23/0) | 2247 | Overloaded.  Money will be put in ; Overloaded |
| ov22 | 011A | 5800 | 02E294 | 68AC | 646 | 116 (116/0) | 68A5 | Memorize; Scribe |
| ov23 | 0141 | 5F00 | 03504C | 25BD | 119 | 30 (30/0) | 25B6 | starts to cough; chokes and gags from nausea |
| ov24 | 014D | 6200 | 0376F7 | 3436 | 212 | 53 (53/0) | 342F |  Yes  ; Hitpoints |
| ov25 | 0160 | 6600 | 03ACD5 | 13EF | 23 | 14 (14/0) | 13E8 | Pick New Class;  doesn't qualify. |
| ov26 | 0167 | 6800 | 03C0F2 | 1294 | 65 | 21 (21/0) | 128D |  Next;  Prev |
| ov27 | 0170 | 6A00 | 03D408 | 0086 | 3 | 8 (5/3) | 007F |  |
| ov28 | 0175 | 6B00 | 03D494 | 01BE | 7 | 6 (6/0) | 01B7 |  |
| ov29 | 0179 | 6C00 | 03D660 | 08A9 | 63 | 12 (12/0) | 08A2 | Loading...Please Wait; FINAL |
| ov30 | 017F | 6D00 | 03DF87 | 147F | 57 | 15 (13/2) | 1478 | WALLDEF; Unable to load  |
| ov31 | 0187 | 6F00 | 03F478 | 0BB7 | 5 | 9 (9/0) | 0BB0 |  |
| ov32 | 018C | 7000 | 040039 | 13C8 | 30 | 25 (24/1) | 13C1 |  |
| ov33 | 0196 | 7200 | 04143D | 0625 | 55 | 8 (7/1) | 061E | Start range error in Load24x24Set; CHEAD |
| ov34 | 019C | 7300 | 041AD0 | 090E | 64 | 4 (3/1) | 0907 | GOSUB; COMPARE (ECL opcode-name table: see decode/ecl/ECL_DIFF.md) |
| ov35 | 020B | 7400 | 04245E | 02CA | 25 | 5 (4/1) | 02C3 | Unable to load ;  from 8x8D |

Totals: **36 overlay units, 871 stub entries (853 live), 0x3FB54 B overlay code, 0x2C02 B fixups (5,633 fixups)**;
fixup targets = 34 stub segments + resident 01A0, 020B(stub), 0297, 0542, 0636, 06EA, 0713, 097F, 09AB, 0A54 (no fixup
names DS: overlay code reaches DS through the DS register only). Resident code 0x390 (main) + 0x1D20 (36 stubs) +
unit segments as tabled. **D-Pool: 35 units / 406 entries / 0x30409 B; Curse carries 2.3x the overlay code and
2.1x the entries (Pool kept 0x30B0 B of game code resident in 00BA; Curse overlays nearly everything).**

## Ghidra project (step 2)
- Build: `wsl.exe -d Ubuntu -- bash $HOME/IdeaProjects/CurseAzureBondsRE/decode/tools/ghidra_build.sh build`
  (about 4 min; run from PowerShell, Git Bash mangles the `/mnt/c` path); after editing `decode/names/*.json`:
  `... ghidra_build.sh export` (about 1 min). One Ghidra at a time on this machine (the script refuses if an
  analyzeHeadless JVM is running). Project `ghidra_proj/cab` (gitignored), program `resident.bin`, x86:LE:16:Real Mode.
- `decode/tools/ghidra_prep.py` -> `decode/bin/ghidra/` (resident.bin with the 853 live stub entries rewritten
  `CD 3F off 00` -> `EA off ovseg`, dead FFFF entries untouched; ovNN.bin; layout.txt). **D-Pool:** no unpack, DS 0C1C,
  SS 150C:2710, 15 resident segments, overlay analysis segments 0x100-aligned from 2000 (table above), `-` in the
  entry list for a dead entry.
- `decode/ghidra_scripts/CabBuild.java` (from PorBuild): one memory block per resident segment, stub segment and
  overlay unit at seg:0000; `dseg` = 0C1C..150C (initialised data + zero-filled BSS), `stack` 150C:0000+2710; context
  DS=0C1C and CS=block segment on all code; seeds = 853 overlay entries (`ovNN_init` = entry 0, `ovNN_XXXX`) + 853 stub
  thunks (`stub_ovNN_eK`) + entry 0000:002F; dead entries get the label `stub_ovNN_eK_dead` and no function; then
  auto-analysis, the near-branch 64 KB fix (34 E8/E9 targets corrected, in units whose linear range crosses a 64 KB
  page: ov08 2F00, ov23 5F00, ...), prologue scan, orphan cleanup. `CabExport.java` (from PorExport; refuses to export
  below 600 functions) applies `decode/names/*.json`, exports `decode/listings/<unit>.lst` + `.c` + `functions.tsv`;
  `decode/tools/listings_index.py` writes `decode/listings/INDEX.md`.
- Result (build.log): seeded 1706 of 1707 (one seed coincided with an existing function), 1972 functions after
  analysis, **1967 after fixes, 0 decompile failures, 52 units (15 resident + dseg/stack + 36 overlay), DS view check 0
  stray `DAT_109a_`**. The orphan pass removes the same 10 frameless routines in `dos_097F`, `crt_09AB`, `system_0A54`
  every round (asm runtime routines without `55 89 E5`, re-created by analysis; harmless, they are listed inside their
  predecessor until `decode/names/rt_names.json` seeds them — cab-rt). Calls into stubs show the real target
  (`CALLF ... ; ov26_1199 (via stub_ov26_e7)`), decompiles call `stub_ovNN_eK()` thunks resolving to the unit routine.
- Same known artifacts as Pool: CALLF operands print linear `0x0000:XXXX` (use the `;` comment); `PUSH CS` after a
  far call decompiles with the callee's segment; Ghidra's default `__stdcall16far` reverses the TP left-to-right
  parameter order (argument-order error class: every pseudocode needs an independent verify).

## Gate check (step 3) — 3 real engine functions decompile sensibly
1. **ov30_104C @ 6D00:104C = LoadWallSet(slot, id)** (name H: literals at 6D00:0FFF "WALLDEF", 1007 ".dax", 100C
   "Unable to load ", 101C " from WALLDEF"). Decompile (`ov30.c`): guards `slot in 1..3`; builds
   `'WALLDEF' + IntToStr(DS:5BEE) + '.dax'` (FUN_0A54_12AB Str, 0634 StrCopy, 06C1 StrConcat), loads record `id` with
   `FUN_0636_08DE` (the DAX loader, item 2); on size 0 or `size/30Ch + slot > 4` prints the error via the debug writer
   (FUN_0A54_173B/17D1/1673, FUN_06EA_010D) and aborts (FUN_06EA_0000); else copies 30Ch-byte wall-set records into the
   far buffer DS:7202 at the slot, rebases tile bytes `>= DS:268A` by `DS:2680[slot] - DS:2682` over 5 x 9Ch entries,
   calls ov35 entry 2 (the 8x8D loader, "Unable to load N from 8x8D") per set, and records the slot ids in
   DS:7210/7212. **Mirrors Pool's ov29_0E08 1:1** (Pool: buffer DS:6A58, threshold 272C, ov34 entry 1).
2. **FUN_0636_08DE @ 0636:08DE = LoadDaxRecord(var buf, var size, id, name, ext)** (literal "tempsize " at 0636:08D4;
   twin of Pool's FUN_0802_0716). Decompile (`res_0636.c`): sound call PlayOrStopSound FUN_0713_0020(DS:25AC) (cab-rt: 0713 is the sound driver, not a video guard); opens the file via
   FUN_0636_07C4 -> FUN_0636_02E5 (the "Couldn't find <name>. Check install." retry loop, path from DS:4EF2/4F42,
   directory probe FUN_0636_0257 = dir + ":\*.*" with the Dos-unit FindFirst FUN_097F_0112); walks the record
   directory with BlockRead (FUN_0A54_1933: 1-byte id, 4-byte offset, 2-byte raw size, 2-byte packed size) until the
   id matches or FilePos (FUN_0A54_19CB) reaches the directory end; packed size above the temp buffer limit ->
   "tempsize " error + abort; on a match GetMem(size) (FUN_0A54_0329), Seek(dirlen + offset) (FUN_0A54_199B),
   BlockRead(packed) into the temp buffer DS:5CF2, close (FUN_0636_08B7), decompress FUN_0636_0702 (packed -> buf,
   = the DAX RLE of `decode/data/DAX.md`), free temp (FUN_0636_0000); no match -> buf := nil, size := 0. Generic
   caller **FUN_0297_011B @ 0297:011B** (".dax" at 0297:0116; twin of Pool's FUN_0464_0111): StrAssign(name), free the
   previous buffer if non-nil (FUN_0297_1D19), append ".dax", LoadDaxRecord, then unpack the 17-byte picture header
   (4 words, 1 byte, 8 bytes via System.Move FUN_0A54_1ABD) and call the decoder FUN_0297_1C59 / blitter FUN_0297_02AD.
   LoadEclBlock (ov07_0380) uses the same loader with 'ECL' + n + '.dax' (ECL_DIFF.md).
3. **entry @ 0000:002F = main program + ov17_01DD @ 4800:01DD = top menu loop.** The entry decompile (`main_0000.c`)
   is the 48-call init chain followed by the body: sound init (FUN_0713_00D6 starts the timer player / PlayOrStopSound FUN_0713_0020 with sound ids DS:25AA/25AC; cab-rt correction: not video),
   ov11 entries 3 and 1 (startup unit: "Loading...Please Wait", COMSPR), `ParamStr(1)` (FUN_0A54_1AF4(1)) compared with
   the main-program literal 'STING' at 0000:0000 (FUN_0A54_0724) which gates the credits unit ov01 entry 1 ("based on
   the tsr novel azure bonds", "kate novak") (M: the decompiler merges the two flags), the 'Play Demo' key prompt
   (ov26 entry 3; 'D' -> demo flag DS:4FBC), then a `repeat` loop: data set DS:5BEE := 1 (demo, DS:4FA9 := 9) or 2,
   video switch, ov17 entry 5 (= ov17_0000, title/start), and when not demo **ov17 entry 1 = ov17_01DD**, a `do {}`
   loop with the literals 4800:0115 "Choose a function ", 018E "Quit to DOS ", 019B "Game not saved.  Quit anyway? ",
   0168 "You've already defeated Tyranthraxus.", 01BA/01CB "Free training on/off" (a training cheat toggle, M), then
   the wall-set/3D setup (ov30 entries 11 and 2) and ov02 entry 2 (the script unit). Coherent control flow, globals
   in DS 0C1C. **Finding (M): `START.EXE STING` again skips the credits/code-wheel path** (same switch as Pool; the
   code-wheel text lives in ov03 "tiles" / "like this:"; the copy-protection lane verifies).

Gate verdict (layout): **PASS** — every unit loads at its own segment with fixups applied, stub entries resolve, 1967
functions, 0 decompile failures, the three engine routines above read as coherent Pascal.

Open: exact TP version (5.0 vs 5.5; evidence checked in `decode/rt/RT_LEDGER.md`), roles of the empty-init units
0186/019B, the unnamed routines of the resident game units (module lanes). Runtime routines (including the 10
frameless ones) are named or kept `RT_` in `decode/names/rt_names.json` (cab-rt).

## Resident game units (cab-rt, step 2)

Method: the Pool twins (same unit order, same role strings) carry verified Pool names (`PoolRadianceRE/decode/names/*.json`);
`decode/tools/resmatch.py` aligns every Ghidra function of a Curse unit with the twin's named routines by instruction
shape (same token score as `decode/tools/rtcensus.py`; score = common token prefix of 24, >24 = same RET reached), and
each anchor below was read (body) where the score is below 16. Names go to `decode/names/res_names.json` (69 names).
Ranges are image-relative, end exclusive; "callers" = Ghidra caller count from `decode/listings/functions.tsv`.

| unit | range | size | role | evidence | conf |
| --- | --- | --- | --- | --- | --- |
| 0000 | 0000:0000-0390 | 0390 | main program | init chain + body (above) | H |
| 0186, 019B | 0186:0000-0010, 019B:0000-0010 | 0010 each | empty units (init `55 89 E5 89 EC 5D CB` only) | Pool 03DA/03ED are the same; source role unknown | H bytes / L role |
| 01A0 | 01A0:0000-06B0 | 06B0 | frames and screen rectangles | ClearRectangle 04CD (score 9; body: per row FillChar CGA B800/BA00 or EGA path by DS:4FE6), DrawFrame 0000 (19 callers; first call ClearRectangle(1,1,26h,16h), then border glyphs from tables DS:0B4E/0BE0 via ov35 entry 3); 01A0:0136/0252/0292/0397/048D unnamed | M |
| 020F | 020F:0000-0880 | 0880 | startup configuration | strings in the table above; 020F:0020 reads a digit key within a set range (set constructor 0A54:0850/0880) for the adapter/sound prompts | H |
| 0297 | 0297:0000-2AB0 | 2AB0 | pictures / video mode / EGA palette | 18 of 33 functions aligned with Pool 0464 (14 at score >= 16) | H |
| 0542 | 0542:0000-0F40 | 0F40 | EGA text, font, prompts, timing | 20 of 23 aligned with Pool 0709 (12 at >= 16); MessageDelay 0B33 = `Delay(DS:4FA9 * 100)` (Pool: * 225, **D-Pool**) | H |
| 0636 | 0636:0000-0B40 | 0B40 | files: DAX open/load/decode, overlay disk prompt, memory blocks, BIOS text | 16 aligned with Pool 0802 + FreeBlock 0000 / AllocBlock 001D (FreeMem/GetMem with size rounded up to 8), BiosPutChars 003A (INT 10h via Dos.Intr: AH=02 cursor, AH=09 chars) by body | H |
| 06EA | 06EA:0000-0290 | 0290 | game key input, hot keys, terminate, debug log | PollOneKey 0268 (score 16); TerminateGame 0000 (body: PlayOrStopSound(DS:25AA), INT 10h set mode DS:4FE4 via Dos.Intr, CloseText(debug file DS:8B76) if logging, restore BIOS shift flags 0040:0017, Halt); ReadGameKey 010D (body: ReadKey; Ctrl-S toggles sound; with `ParamStr(1)='STING'`: Ctrl-D toggles debug.txt logging, Ctrl-Z dumps the list at DS:650A with "who: / sp#:", Ctrl-C TerminateGame) | M (0000/010D by role) / H (0268) |
| 0713 | 0713:0000-26A0 | 26A0 | sound driver (PC speaker / Tandy PSG / silent by DS:5BEA) | 9 routines matched to Pool 08AE at score 11-28 (Install/RemoveSoundTimer: INT 21h AH=35/25 vector swap + PIT ports 43h/40h; ISR 225E ends IRET; Speaker/PSG ticks write ports 61h / C0h); PlayOrStopSound 0020 by role (0 stop, FFh stop all + remove timer, 1 SetSoundOutput, 2..0Eh start sound n-1 on the speaker or PSG channels); Ghidra found only 8 functions: the timer-driven routines have no static callers | H (unit) / M (0020) |
| 097D | 097D:0000-0020 | 0020 | string constant initialiser | init = `@StrAssign(DS:8C80, DS:24EC, 14h)` | M |

Anchors (all in `decode/names/res_names.json`; Pool equivalent = same name at the Pool twin address):

| addr | name | score / basis | conf |
| --- | --- | --- | --- |
| 0297:011B | LoadPicture | 24 (Pool 0464:0111; gate check: StrAssign + ".dax" + LoadDaxRecord + 17-byte header) | H |
| 0297:00D7 / 0107 | SetVideoMode / RestorePreviousVideoMode | 23 / 6 + body (`mov al,[4FE4]; call 00D7`, Pool `[4A1C]`) | H |
| 0297:0EFF, 0BB5, 1626, 1C59, 1D19 | PutPicture, MirrorPicture, RecolorPicture, AllocPicture, FreePicture | 21, 24, 24, 16, 22 | H |
| 0297:08F8 | DrawPictureInto | 6 (prologue + `and al,1` flag test, same position in unit order) | M |
| 0542:0184 / 0352 / 04A4 | LoadTextFont / DrawText / DrawWrappedText | 24 / 24 / 24 | H |
| 0542:0722 / 0946 / 0AD9 | ReadBottomLine / ShowBottomPromptAndReadKey / ShowTimedBottomPrompt | 24 / 24 / 24 | H |
| 0542:0A0E / 0B33 / 0B4A | ClearScreen / MessageDelay / ClearTextRectangle | body (FillChar both pages per adapter) / body / 9 | H / H / M |
| 0636:08DE | LoadDaxRecord | 21 (Pool 0802:0716; gate check) | H |
| 0636:0702 / 07C4 / 08B7 | DaxRleDecode / OpenDax / CloseDax | 14 / 24 / 6 + body (Close then the next arg; no @IOCheck: game built {$I-}) | H |
| 0636:02E5 / 0206 | OpenWithPrompt / WaitOverlayDisk | 24 / 24 | H |
| 0636:0B0D / 0B22 | SetDataSet / RestoreDataSet | body: DS:5BEF := DS:5BEE, DS:5BEE := arg / DS:5BEE := DS:5BEF (Pool 5376/5377) | H |
| 06EA:0000 / 010D / 0268 | TerminateGame / ReadGameKey / PollOneKey | role / role / 16 | M / M / H |
| 0713:21F0 / 2225 / 225E | InstallSoundTimer / RemoveSoundTimer / SoundTimerInterrupt | 28 / 24 / 24 | H |
| 0713:0020 | PlayOrStopSound | role (sound-id dispatch above; Pool 08AE:00DC) | M |
| 01A0:0000 / 04CD | DrawFrame / ClearRectangle | role / 9 | M |

**Corrections to the gate-check text above (cab-rt):** FUN_0713_0020 is PlayOrStopSound (DS:25AA/25AC/25AE are
sound ids, DS:5BEA the sound device 0 speaker / 1 Tandy / 2 silent), not a video-mode guard; OvrInit is at 0A0D:0018.
Unit 0297 is the picture unit (its ".dax" is LoadPicture's); the DAX loader proper is 0636.
