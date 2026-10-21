# ENGINE DELTA — Curse of the Azure Bonds (Gold Box #2) vs Pool of Radiance (Gold Box #1)

the owner, 2026-10-21: *"Make the rule engine-unique. The first decode on an engine is intense; follow-up decodes should be fast."* Rigor is set **per engine, not per game**. Pool of Radiance carried the full method for the SSI Gold Box engine. Curse is a **follow-up title on the same engine**. This file records exactly what changed and what was reused unchanged, so the next Gold Box title (Secret of the Silver Blades, Pools of Darkness, ...) starts from here and verifies only its own delta.

Evidence is in the files cited; nothing here is new evidence. Pool references point to `../PoolRadianceRE\decode\`.

## 1. Reused unchanged (verify by spot check only, never re-derive)
| layer | what | evidence |
|---|---|---|
| DAX container | header, directory, RLE scheme, encoder rule; Pool's `dax.py` ran unchanged on 86 files / 824 records, byte-identical round trip | data/DAX.md |
| Picture formats | P/A/F records, 8x8 symbol sets, wall sets, portraits, GEO, WALLDEF, the ITM/SPC containers | data/PICTURES.md, GEO.md, WALLDEF.md |
| Byte-identical assets | CHEAD, CBODY, COMSPR, SPRIT1, the 8x8D1/201 font | data/INDEX.md |
| ECL operand encoding | type bytes 00/01/02/03/80/81, operand slots, string slots (globals moved, layout same) | ecl/ECL_DIFF.md §2 |
| ECL opcodes | 24 handlers identical to Pool modulo addresses (shape 1.00), 15 minor | ecl/ECL_DIFF.md |
| Resident structure | the same game-resident units (frames, config, pictures/video, text/font, DAX files, keys, sound), each with a Pool twin by instruction shape | LAYOUT.md "Resident game units", pseudo/RESIDENT.pas.md |
| Overlay areas | every overlay unit maps to a Pool twin, so area pseudocode diffs against one Pool file | herdr/assignments/cab-areas.md |
| TP runtime | same System/Crt/Dos/Overlay routines by shape; 99 of 182 named directly from Pool's ledger | rt/RT_LEDGER.md |
| Engine code (game/) | forked from Pool @85fb6d6; Curse changes are only profile params or PER-n requests | game/FORK.md, docs/POOL_ENGINE_REQUESTS.md |
| Plus layer | 26 of 62 game/plus/ files identical to Pool; hook contract shape unchanged | docs/PLUS_TRIAL.md |

## 2. The engine delta (what needed real work)
**Compiler and overlays**
- Turbo Pascal **5.x** (probably 5.0) instead of 6.0. The overlay file is `TPOV` instead of `FBOV`. The stub layout is the same, plus one new rule: entry `FFFF` = dead entry (18 of 871). There are 36 overlay units, and no EXEPACK. `tools/tpovl.py` TPOV variant; LAYOUT.md.
- Unit numbers shift against Pool after ov15. Pool's resident unit 00BA moved into an overlay (Curse ov24). cab-areas.md.
- DS = 0C1C; every global moved, but every engine-used ECL cell keeps its Pool offset. GLOBALS.md, ECL_VM.md.

**ECL script VM** (ecl/ECL_VM.md, ECL_DIFF.md)
- 64 opcodes (00..40h; 1Fh absent) vs Pool's 61.
- **3 new:** 3E DUMP, 3F FIND SPECIAL, 40 DESTROY ITEMS.
- **3C is now PROTECTION**, the rune-wheel copy protection (ENGINE ov03; answer formula in ecl/runewheel.py). In the owner's copy it is disabled by one byte, GAME.OVR 0x4A56 = EB (ruling CR-2).
- 22 handlers changed by shape; the skip table changed (0C fixed to 3, 34 now 1). Script base 8000h (Pool 9900h); record header `88 13`.
- SSI's own opcode-name table and a script tracer (ov34), new.

**Record layouts and data**
- Character record **422 B** (Pool 285). Monster record MONnCHA **422 B** (Pool 285). data/MONSTERS.md, data/SAVES.md, PARTY.pas.md `## Character record`.
- Saves: `SAVGAM<k>.DAT` 13,149 B fixed; `CHRDAT<k><n>.SAV` / `.GUY` 422 B; `.SWG` 63-B items; `.FX` 9-B effects. data/SAVES.md.
- **Pool of Radiance and Hillsfar character import** (ENGINE ov16): new.
- ITEMS: class-mask bit 80h, 20 rows changed. TITLE: 4 records; 8X8D1/202: 40 tiles.

**New subsystems and screens**
- **BIGPIC** (304×120 full-width 2D areas, the overland city map with its overlay animation), **TILES** (rune tiles for the wheel), **SKY** (3D-view sky strip/sun/ground). data/BIGPIC.md, TILES.md, SKY.md.
- Text routines all take a **background colour** (one byte more than Pool). RESIDENT.pas.md res_0542.
- Sound driver relocated, with 2-byte note lists (res_0713).
- CURSE.CFG start-up configuration (res_020F).
- Copy protection = rune wheel (not Pool's code wheel).
- 167 screens in SCREENS_INDEX.md. The new ones are the rune wheel, BIGPIC areas, import, camp Fix, class change and the finale.

**Engine requests carried by the Curse fork:** PER-1..13 (docs/POOL_ENGINE_REQUESTS.md). They cover TP 5 Random, text bg, the Curse VM adapter, save storage, BYOC profile/normalisation, the sound adapter, picture config, Plus events, key reader, DAX prompts, display mode, import texts, and a **Pool timer bug fix** (PER-13).

**Faithful quirks of the original, kept:** the shop price bug for factor 10h (stack residue 0Fh); the CHECK PARTY 7FFFh bug; healing times carried across members (camp); the dead opcode-1F hazard.

## 3. Time: Curse vs Pool (clock times from git; MDT)
| milestone | Pool (Gold Box #1, full method) | Curse (Gold Box #2) |
|---|---|---|
| lanes | up to 6 | **2** (cap while Star Command ran) |
| gate test (layout, Ghidra, ECL dispatch, DAX, 1 DOSBox shot) | n/a | **22 min** (00:58 to 01:20) |
| decode gate met | ~3 h (09:16 to 12:16) | **5 h 42 min** (00:58 to 06:40) |
| playable (walk the first 3D area) | ~3 h 10 min (to 12:25) | **7 h 42 min** after kickoff (08:40) |
| new-game run-through, save = DOSBox | RUN-2 overnight | RUN-1 PASS 11:19 (SAVGAMB byte-identical) |
| Plus layer | ~4 h 45 min (08:45 to 13:31, 2026-10-19), up to 4 lanes | ~3 h from the resume at 00:06 to all packages except S3 click coded (~03:00), 2-4 lanes, often blocked by the shared run lock |

**Honest note:** Curse's decode gate took *longer* than Pool's, with a third of the lanes. Under the owner's new rule it would have been faster: Curse re-derived full per-routine pseudocode for all 7 areas, including the many routines whose code matches a Pool twin by instruction shape (per-unit match counts in herdr/assignments/cab-areas.md, Pool-twin column; not totalled here). With this file in hand, a follow-up title should do the following:
1. the layout and Ghidra gate test (about 20 min);
2. a shape-match of every routine against the previous title, accepting matches with a spot check and writing full pseudocode only for changed or new routines;
3. the ECL opcode diff;
4. a data-format diff with round trip;
5. the run-throughs, node trace checks and about 6 picture shots.

## 4. Checklist for the next Gold Box title
1. Compiler/overlay: TPOV/FBOV (or another)? Stub rules? → tpovl.py, gate test.
2. Routine shape-match against Curse *and* Pool (decode/tools/resmatch.py, rtcensus.py): changed/new list = the work list.
3. ECL: dispatch case chain, opcode count, new opcodes, skip table, script base → ECL_DIFF.md method.
4. Records: character/monster record size, save file set, import paths.
5. New data groups (like BIGPIC/TILES/SKY) and new screens.
6. Copy protection kind + bypass byte.
7. Verify: DAX round trip, ECL assembler round trip, RUN-1/RUN-2 with byte-identical save vs DOSBox, node trace checks, ~6 picture shots. No full acceptance table (the owner 10/21).
