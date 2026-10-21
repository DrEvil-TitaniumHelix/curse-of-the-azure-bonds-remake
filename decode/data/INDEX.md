# Data file index — Curse of the Azure Bonds v1.0 (`re-targets/goldbox/cotab/curazure`, 96 files)

Owner: cab-data. Every file → group, record ids, spec, status. Container for all 86 `.DAX`: [DAX.md](DAX.md) — all 824 records decode to their declared size and re-encode + re-pack byte-identical (86/86 files). `n` in a name = data set / disk number = byte `DS:5BEE` (Pool `DS:5376`), used to build `<name><n>.dax` and to pick the data path `DS:25AE + n*1Eh`.
Code addresses: START.EXE = load-module image offsets; GAME.OVR = file offsets (TPOV; seg:off names from cab-tooling LAYOUT.md when available).
Code column: OVR file offsets resolved to `seg:off` + routine by cab-crossref (CROSSREF.md §6; cab-data paused).
Status: **same** = Pool spec applies unchanged (checked); **delta** = Pool spec + documented deltas; **new** = first decode here; **container** = only the DAX level here.

| file(s) | group | records (ids) | spec | loader (code) | status |
|---|---|---|---|---|---|
| TITLE.DAX | TITLE | 1, 2 (320×200), 3 (240×112), 4 (320×112) | [PICTURES.md](PICTURES.md) P | OVR 0x6A8 (string "title") = ov01 2100:0635 in **ShowTitle** (ENGINE) | delta (4 records, sequence) |
| PIC1..6.DAX | PIC | 56 animations 88×88 (ids per file in png/INDEX.md) | PICTURES.md A | strings "PIC" OVR 0x3D74F = ov29 6C00:00EF, used by **LoadAnimation** 6C00:01A7 (VIEW) | same |
| SPRIT1..6.DAX | SPRIT | 46 sprites, 3 distances | PICTURES.md A | strings "SPRIT" OVR 0x85B7 = ov07 2C00:0588, used by **ShowEncounter** 2C00:05DA (COMBAT); 0x41C85 is ov34's tracer text "SPRITE OFF" (ecl_OpcodeName), not a loader | same (SPRIT1 = Pool's file) |
| HEAD2..6 / BODY2..6.DAX | HEAD, BODY | 40 heads 88×40, 31 bodies 88×48 | PICTURES.md P | OVR 0x3DC25 / 0x3DC39 = ov29 6C00:05C5 / 05D9 ("HEAD" / "BODY"), used by **LoadPortrait** 6C00:0619 / 0685 (VIEW) | same |
| CHEAD.DAX / CBODY.DAX | CHEAD, CBODY | 56 / 128 | PICTURES.md P | OVR 0x1C4F6 = ov16 4300:0A73, used by **LoadCharacterIcon** 4300:0A9D (ENGINE); 0x415FA = ov33 7200:01BD, used by **LoadCombatIcon** 7200:0208 (VIEW) | same (byte-identical files to Pool) |
| CPIC1..6.DAX | CPIC | 156 icons (pairs id / id+128) | PICTURES.md P | strings "CPIC": ov02 2200:0462 (**ecl_op0B_LoadMonster** 2200:0520, ECL), ov07 2C00:1BD7 (**SetupDuel** 2C00:1C52, COMBAT), ov16 4300:3518 (**AddNpcToParty** 4300:3566) and 4300:3744 (**LoadGame** 4300:3C50, ENGINE) | same |
| COMSPR.DAX | COMSPR | 0..25 (26 × 24×24) | PICTURES.md P | startup OVR 0xFA9F = ov11 3500:05A5 in **ov11_0056** (engine start-up, ENGINE) | same (byte-identical to Pool) |
| DUNGCOM / WILDCOM / RANDCOM.DAX | combat terrain | 1 each (25 / 34 / 6 tiles) | PICTURES.md P | strings OVR 0xE6CA/0xE6D2/0xE6DA = ov10 3300:1018.., used by **PrepareBattlefield** 3300:1046 (VIEW) | same |
| 8X8D1..6.DAX | 8X8D | wall tile sets = WALLDEF ids (multi-block id·10+k); 8X8D1: 201 font, 202 (40 tiles), 203 (45) | PICTURES.md P/F, [WALLDEF.md](WALLDEF.md) | string "8x8d" OVR 0x42486 = ov35 7400:0028, used by **Load8x8Set** 7400:009B (VIEW); START.EXE "8X8d1.dax" = the font load 0542:018a (RESIDENT) | delta (202: 40 tiles) |
| WALLDEF2..6.DAX | WALLDEF | 20 records (ids in WALLDEF.md) | [WALLDEF.md](WALLDEF.md) | OVR 0x3EFD3 = ov30 6D00:104C **LoadWallSet** (VIEW) | same |
| GEO2..6.DAX | GEO | 16 maps: 1,3,4 · 16,17,21 · 32,33,37 · 50,51,53 · 64,66,67,69 | [GEO.md](GEO.md) | OVR 0x3F2C1 = ov30 6D00:133A in **Load3DMap** (VIEW) | same |
| ECL1..6.DAX | ECL | see below | container only (bytecode = cab-tooling / ECL lane) | strings "ECL" OVR 0x83A7 = ov07 2C00:0378, used by **LoadEclBlock** 2C00:03E3 (COMBAT unit, ECL_VM.md §1) | container |
| MON1..6CHA.DAX | monsters | 81 × **422 B** | [MONSTERS.md](MONSTERS.md) | OVR 0x1ECD7 = ov16 4300:3254 **LoadMonster** (ENGINE) | delta (record 422 B) |
| MON1..6ITM.DAX | monster items | 44, n × 63 B | MONSTERS.md / Pool SAVES.md §4 | ov16 4300:3254 **LoadMonster** (ENGINE) | same |
| MON1..6SPC.DAX | monster effects | 39, n × 9 B | MONSTERS.md / Pool SAVES.md §5 | ov16 4300:3254 **LoadMonster** (ENGINE) | same |
| ITEM1..6.DAX | treasure lists | 23, n × 63 B | [ITEM.md](ITEM.md) | OVR 0x23F9 = ov02 2200:1B53 **ecl_op27_Treasure** (ECL) | delta (names stored) |
| ITEMS | item-type table (2050 B, not DAX) | 128 × 16 | [ITEMS.md](ITEMS.md) | startup OVR 0xFB57 = ov11 3500:065D in **ov11_0056** (Seek 2, BlockRead 810h; ENGINE) | delta (j13 bit 80h, 20 rows) |
| BIGPIC1/2/6.DAX | BIGPIC | 121, 123 / 120 / 122 (304×120) | [BIGPIC.md](BIGPIC.md) | OVR 0x3DE73 = ov29 6C00:0813 **LoadBigPic** (VIEW) | new |
| TILES.DAX | TILES | 1 (26), 2 (22) × 24×24 runes | [TILES.md](TILES.md) | OVR 0x47AE = ov03 2600:0126 in **RuneWheelCheck** (ENGINE) | new |
| SKY.DAX | SKY | 250 (88×16), 251 (24×24), 252 (88×48) | [SKY.md](SKY.md) | startup OVR 0xFAE5 = ov11 3500:05EB in **ov11_0056** (ENGINE) | new |
| START.EXE, GAME.OVR | code | — | cab-tooling (`decode/LAYOUT.md`) | — | not data |
| CURSE.CFG (28 B) | config | 4 text lines: adapter `C`/`E`/`T`, sound `P`/`T`/`S`, save path (upper case, ends in `\`), `F` | RESIDENT.pas.md res_020F | **StartupConfiguration** 020F:027C (RESIDENT): written on first run 020F:030C..0638, read 020F:0667..086F (line 1 -> VideoMode 0/1/2, line 2 -> SoundDevice, line 3 -> SavePath DS:5BF0, line 4 'F' -> DS:4F98) | **decoded** (code column completed by cab-crossref) |
| COPYSAVE.BAT, COPYCURS.EXE, COPR.BAT, HD525.BAT, MAKENEWA.BAT | install / save-transfer tools | — | out of scope for the data lane | — | — |
| dosbox.conf | third-party (GOG-style) DOSBox config | — | out of scope | — | — |
| (no SAVE/ folder shipped) | saves | — | to decode from a DOSBox-made save (open) | — | open |

## ECL container — H (container level only)

| file | ids (raw bytes) | ids without a GEO map |
|---|---|---|
| ECL1 | 80 (7516), 81 (7591), 82 (924) | 80, 81, 82 |
| ECL2 | 1 (7624), 2 (3550), 3 (7235), 4 (5972) | 2 |
| ECL3 | 16 (7665), 17 (6432), 18 (7360), 21 (3332) | 18 |
| ECL4 | 32 (7409), 33 (5456), 34 (5396), 35 (2899), 37 (5600) | 34, 35 |
| ECL5 | 48 (585), 49 (3774), 50 (6048), 51 (7392), 53 (6800) | 48, 49 |
| ECL6 | 64 (7148), 66 (6300), 67 (5363), 69 (2934) | - |


GEO ids without ECL: none; ECL with GEO always in the same-numbered file: True; max raw 7665 (buffer 0x1E00 + 2 skipped)

Every GEO id has an ECL record in the same-numbered file (H). The largest ECL record (7665 B) fits the 1E00h-byte script buffer allocated at startup (OVR 0xF5B9: GetMem(1E00h) into `DS:4FA5`; M — Pool loaded ECL into a 1E00h buffer after skipping 2 bytes; the CAB ECL loader is the ECL lane's). ECL1 (set 1, ids 80..82) has no GEO maps at all: set 1 has no 3D areas here (no GEO1/WALLDEF1) — M.
