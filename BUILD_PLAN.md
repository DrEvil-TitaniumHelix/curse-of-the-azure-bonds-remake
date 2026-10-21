# BUILD PLAN — Curse of the Azure Bonds reproduction (phase 2)

Status: **ACTIVE 06:41 MDT 2026-10-20** (decode gate MET 06:40; cab-foreman started the 2-lane build: cab-build-engine + cab-build-areas). Drafted by lane cab-build-plan.
**No game code before the gate:** `DECODE_GATE.md` is 8 of 10 (item 6 saves and the DOSBox-X oracle part of item 8 wait
for cab-saves-ref). The build lanes below start the moment the owner declares the gate met. Not clean-room (the owner
2026-10-16, applied to this repo by FOREMAN.md): verified pseudocode is translated directly; the build reads the
player's own v1.0 files. Model and code base: `PoolRadianceRE/BUILD_PLAN.md`, `ACCEPTANCE.md`, `docs/BYOC.md`,
`game/`; Plus model: `RemasterDOSGames/docs/PLUS_LAYER.md`.

Decode inputs (every row below cites one of them): `decode/pseudo/SCREENS_INDEX.md` (167 screens S001..S167),
`decode/pseudo/<AREA>.pas.md` for RESIDENT, ENGINE, ECL, VIEW, PARTY, MAGIC, COMBAT (+ `_SCREENS`, `_VERIFY`,
`_ARGCHECK`), `decode/ecl/ECL_VM.md` + `ECL_DIFF.md`, `decode/CROSSREF.md`, `decode/GLOBALS.md`,
`decode/data/INDEX.md` + the format files, `decode/rt/RT_LEDGER.md`, `decode/LAYOUT.md`, `RULINGS.md` (CR-1, CR-2).

---

## 1. What is built

**The same product form as Pool of Radiance.** It is a zero-install HTML5 game in `game/`: `index.html` plus vanilla ES modules,
with no build step. It is served by `python -I tools/serve.py` and played in Chrome (app window) on a Windows desktop or handheld. The screen is EGA
320x200 with 16 colours, integer-scaled and nearest-neighbour. Input is keyboard, Gamepad API and mouse (mouse and pad are key synthesizers only).
**BYOC v1.0**: the player imports their own copy once. The browser hash-checks it against `game/byoc/manifest-cab-1.0.json`
and keeps it in IndexedDB (`cab-data`). Saves live in `cab-save`. No original byte is committed (Pool BYOC tiers T1..T3
apply unchanged). Launcher `Play Curse of the Azure Bonds.cmd` + Desktop `.lnk` (as Pool §3b). Gold Box Plus is mounted
on top later (§6), and original mode has to stay at 0 px.

**Data at runtime = the original files, read in place:** the engine decodes DAX records itself, the ECL VM runs the
original ECL1..6 bytecode, the DS image (tables, strings, the rune answer rows at DS:0000, the sound driver) comes from
the player's START.EXE. START.EXE is **not EXEPACK-packed** (LAYOUT.md §START.EXE), so Pool's `unexepack()` step is
skipped: the DS image is a plain slice of the load module.

### 1a. How the engine is shared (FOREMAN.md: "keep the shared engine shared")
- **Fork, pinned:** copy `PoolRadianceRE/game/` (engine/, areas/ as reference only, byoc/, plus/, profiles/, test/
  harness) at Pool commit **85fb6d6** (2026-10-20) into `CurseAzureBondsRE/game/`. The pin and the copy date go in
  `game/FORK.md`. `game/areas/` is rewritten for Curse (Pool's area files are not reused as code; their structure is).
- **No silent fork.** Every change a Curse lane makes to a file under `game/engine/`, `game/byoc/` or `game/plus/` must be
  one of two kinds:
  (a) a **profile parameter**. These are Pool's own boundary list `PoolRadianceRE/game/profiles/PORONLY.md`, where each
      Pool-only line already names its profile field (`engine.configuration`, `recordSizes`, `ecl`, `engine.font`,
      `saveFormat`, ...). Curse fills `game/profiles/cab.json`.
  (b) a **Pool engine request** `PER-n` (§2b): a change the shared engine needs to carry both games, written as a
      request in `docs/POOL_ENGINE_REQUESTS.md` (this repo) and mirrored as a tagged STATUS note for the Pool foreman.
      Until Pool accepts it, the Curse copy carries the change in place. Each changed line is marked `// cab: PER-n`,
      so the later merge to one shared engine is a grep, not an archaeology job.
- Files that are game-specific translations by nature (`ecl.js` handlers, `audio.js` driver, `menus.js`) go behind the
  `engine.id` adapter switch that PORONLY.md already foresees: `engine.id = 'cab-1.0'` selects the Curse adapter module,
  and the shared part stays shared.
- `docs/PLUS_TRIAL.md` (FOREMAN deliverable 4) is written from `docs/POOL_ENGINE_REQUESTS.md` + the Plus hook diff: it
  records what was shared unchanged, what was parameterised and what needed a new hook.

---

## 2. Engine modules: Pool module -> Curse delta

"same" = the Pool module runs unchanged with the Curse profile; "param" = PORONLY boundary filled from `cab.json`;
"adapter" = a Curse-specific module behind `engine.id`; "PER" = Pool engine request (§2b). Every delta cites the decode.

| Pool module | Curse delta | kind | decode evidence |
|---|---|---|---|
| `tp.js` (TP semantics, Random) | **TP 5.x runtime**, not 6.0. `@NextRandom` 0A54:1154 has the same body as Pool 0AF8:120F (shape score 26 > 24 = same RET reached), so the LCG is `RandSeed*08088405h+1` unchanged; RandSeed moves from DS:4428/442A to **DS:47D8/47DA**. `Random(n)` = RandomWord 0A54:1105 (34 call sites); Randomize 0A54:118C seeds from the DOS clock (ov11). **New use: `Random` without argument** = RandomReal 0A54:111B (6-byte real in [0,1), ov18 finale only) → add `randomReal()` with the exact real normalisation. Strings, sets and byte wrap are unchanged. Heap: TP 4-5.5 free-list heap (FreePtr DS:47BE). It is only relevant where the code reads MemAvail (S007 "Not enough memory") = ERR-PATH. | param + PER-1 | RT_LEDGER.md §Compiler version, rows 0A54:1105/111B/1154/118C |
| `display.js` | Same EGA framebuffer and palette. CGA (`C`) and Tandy (`T`) paths exist in the original (DrawPicCga/Ega/Tandy 0297:22FE/258F/2841, GlyphCga/Ega/Tandy 0542:0D27/0DC6/0E26). As in Pool they are **not built**: the cfg is EGA. EGA palette register writes SetEgaPaletteRegister 0297:2171 (finale/flash effects) to verify against Pool. | same | RESIDENT.pas.md res_0297, res_0542 |
| `text.js` | **Every text routine takes a background colour** (resident note #1): `DrawText(col,row,fg,bg,s)` 0542:0352, `DrawWrappedText(x1,y1,x2,y2,fg,bg,clear,s)` 0542:04A4, `ReadBottomLine(prompt,fg,bg,maxLen)` 0542:0722, `ShowBottomPromptAndReadKey(fg,bg,s)` 0542:0946, `DrawRepeatedGlyph(col,row,fg,bg,n,ch,..)` 0542:01E6. Quirk to copy: DrawText tests `row > 39`, not 24. Font = 8X8D1.DAX record 201 as Pool (LoadTextFont 0542:0184). Frame/layout routines DrawScreenFrame 01A0:0000 + 01A0:00D3/0136/0252/0292/0397/048D replace Pool's `DrawTitledFrame(...)`. | PER-2 (signature gains `bg`, Pool passes its implicit 0) | RESIDENT.pas.md res_0542, res_01A0; SCREENS_INDEX §0 |
| `dax.js` | The container is unchanged: all 824 records of the 86 DAX files decode to their declared size and re-pack byte-identical. The data set byte is **DS:5BEE** (Pool DS:5376), with 6 sets instead of 8 and the data path `DS:25AE + n*1Eh`. Disk-prompt table and dataset suffix go per profile. LoadDaxRecord 0636:08DE = `(name, ext, id, var size, var buf)` (ext is a separate argument, #xref-3). | param | data/DAX.md, data/INDEX.md, RESIDENT res_0636 |
| `pictures.js` | P/A/F records unchanged (PIC/SPRIT/HEAD/BODY/CPIC/COMSPR "same"). **New groups, all Pool P-records:** BIGPIC1/2/6 (ids 120..123, **304×120** 2D backdrops, LoadBigPic 6C00:0813; city overlay animation while menus wait, VIEW-13), **SKY** 250 (88×16 sun strip), 251 (24×24 moon), 252 (88×48 sky strip) loaded at start-up (ov11 3500:05EB) and drawn by DrawBackdrop 6D00 by `party_Dir` + clock, **TILES** 1 (26) + 2 (22) 24×24 runes for the rune wheel (Load24x24Set, 2600:0126). 8X8D1 record 202 has 40 tiles (delta). View buffer geometry and symbol tile bases → profile/adapter. RecolorPicture 0297:1626 Pascal order `(fromCol,toCol,frame,randomMix,pic)` (#verify-48). | param + adapter | data/BIGPIC.md, SKY.md, TILES.md, PICTURES.md, WALLDEF.md; VIEW.pas.md ov29/ov30 |
| `state.js` | Globals from `decode/names/*.json` → `game/state/globals.json` (generator `tools/gen_globals.py`, Curse DS = 0C1C). **Character record 422 B (1A6h)** instead of 285 B. The field map is `PARTY.pas.md ## Character record`: status +195h, active +196h, hp +1A4h, maxhp +78h, items +14Dh, effects +F2h, next +189h, combatant +18Dh, icon slot +143h, money +FBh..+107h, xp +127h. Items 63 B and effects 9 B are unchanged; combatant 22 B. MONnCHA monster records are 422 B as well (MONSTERS.md). | param (`recordSizes`) + adapter field map | PARTY.pas.md §Character record, MONSTERS.md, COMBAT.pas.md conventions |
| `ecl.js` | **Base 8000h** (Pool 9900h), code buffer 1E00h, `ecl_InitVM` sets PC := 8000h (2C00:023B). **Memory map shifted**: region 0 = 4B00..4EFF, region 1 = 7C00..7FFF (selected-character overlay), region 2 = 7A00..7BFF, region 3 = 8000..9DFF (script bytes), the rest = engine globals; relative offsets keep Pool's values. **New side effect:** a write to 4BE6 that changes it sets `view_Mode` 3/4 and `view_PrevMode`. **Opcodes:** 64 (00..40h, 1Fh absent) = 61 Pool (24 same, 15 minor, 22 changed by shape) + **3 new**: 3E DUMP (NPC leaves: RemovePartyMember), 3F FIND SPECIAL (HasEffect → EQ/NE), 40 DESTROY ITEMS (LoseItem by type + RecalcItems). **Op 3C = PROTECTION** (calls RuneWheelCheck; its operand is never used), which replaces Pool's PRINT_MEM. Op 34h has 2 operands (Pool 1). Skip table per ECL_DIFF §3. **Tracer:** ov34 opcode-name table 7300:0240 (SSI's 64 names) printed when `DebugFlag` DS:4FC1 is set (2200:3658) → dev-only console trace (`?trace=1`), never in original mode output. | adapter (`ecl.opcodeTableVersion = 'cab'`) + PER-3 | ECL_VM.md §1-§6, §4.6, §8; ECL_DIFF.md §3-§5; ECL.pas.md §1-§3 |
| `files.js` | **Save formats** (ENGINE ov16; byte layout of SAVES.md pending gate item 6): `<DOS>.guy` (1A6h) + `.swg` (n×63) + `.fx` (n×9) per character. Saved game k = A..J: `CHRDAT<k><n>.sav/.swg/.fx` + `savgam<k>.dat` (DataSet 1, Mem4B00 800h, Mem7C00 800h, Mem7A00 400h, CodeBuf 1E00h, position 5, view modes 2, wall-set slots, member count, member names 8×string[40]). There is **no roster file** (directory scan, BuildCharacterFileList 4300:0453). **Import, read-only:** `ImportSource` g_7584 = 0 Curse `*.guy`, 1 **Pool** `*.cha` / `*.sav` members (11Dh, ConvertPoolCharacter 4300:1490), 2 **Hillsfar** `*.hil` (BCh, name C-string at +4, ApplyHillsfarMinimums 4300:1F21). Plus option: offer the player's Pool saves from the Pool build's own IndexedDB store `por-save` (same origin) as an import source (PER-4). | adapter + PER-4 | ENGINE.pas.md §Save file formats, 4300:0DEA/1490/1F21/2400.., data/INDEX.md (saves row) |
| `audio.js` | **Sound driver res_0713 = Pool 08AE relocated** (every CS variable B7h lower). It is installed once by StartSound 0713:00D6 and removed only by `PlayOrStopSound($FF)` 0713:0020 (no transient mode). **SoundDevice codes swapped:** 0 = speaker, 1 = Tandy PSG, 2 = silent. Note list has 2-byte entries + a length table (Pool 3-byte), notes on any channel, noteOff gap field +10h, sound id 15 arms a hidden countdown; accepted ids `[0..15, 255]`. MainProgram starts/stops the sound around every phase (0000:0126..02c0). The Tandy PSG path is not built (as CGA). | adapter | RESIDENT.pas.md res_0713 (0713:0020..2684) |
| `input.js` | Same BIOS key semantics: ReadGameKey 06EA:010D drains type-ahead, FlushGameKeys 06EA:024C. Menus: HorizontalMenu 6800:03D4 (row 24, `,`/`.` move, ext keys), VerticalListMenu 6800:0DF9, AskYesNo 6800:112A, MenuSelect 2C00:17EA. The STING developer start becomes **`START.EXE x Wooden`** (skips the rune wheel), mapped to `?wooden=1`. | adapter (menus.js) | RESIDENT res_06EA, VIEW.pas.md ov26, SCREENS_INDEX §0 / S015 |
| `main.js` (boot, config) | **CURSE.CFG = 4 lines** (adapter C/E/T, sound P/T/S, save path ending in `\`, `F`), not POOL.CFG's 5. StartupConfiguration 020F:027C reads it 020F:0667..086F (line 4 `F` → DS:4F98 = show the long title sequence S012..S014). As in Pool, it is **not imported**: the engine builds `E`,`P`,`C:\SAVE\`,`F` itself. The first-run prompts S001..S005 and the NUMLOCK note S006 become ERR-PATH/no-op rows. Overlay buffer 28000h, overlay errors S008/S009 = ERR-PATH (no overlay file in the build). Start flow (MainProgram 0000:002F): titles → credits → **Play Demo prompt** S015 (30 s timeout → demo, data set 1, GameSpeed 9) → rune wheel → top menu. | param (`engine.configuration`) + adapter entry | RESIDENT.pas.md main_0000, res_020F; data/INDEX.md CURSE.CFG row; SCREENS_INDEX §1 |
| `byoc.js` | Manifest `cab-1.0` (§4), the 0x4A56 normalisation (CR-2 A), the accepted save names (`*.guy/.swg/.fx`, `CHRDAT*`, `savgam*.dat`) plus the import patterns (`*.cha`, `*.sav`, `*.hil`), the size checks 1A6h/11Dh/BCh. | param + PER-5 | §4; ENGINE ov16 import table |
| `timer.js` | Same tick units; MessageDelay 0542:0B33 = GameSpeed × 100 ms, TimeInHundredths 0542:0994. | same | RESIDENT res_0542 |
| `errors.js` | Fatal-data / disk / overlay prompts S007..S009, S163.. as Pool's error screens with the Curse texts. | adapter texts | SCREENS_INDEX §1, §10 |
| `dev.js` | Routes for acceptance: `?wooden=1`, `?wheel=1` / `?wheel=retail` (§2a), `?demo=1`, `?trace=1`, `?testparty=1` (built in the browser from the player's files, as Pool BYOC §7, with the 422-B record). | adapter | §5 |

### 2a. The rune-wheel bypass flag (gate item 10, ECL_VM.md §8, CR-2)
RuneWheelCheck 2600:011A runs at start-up (unless demo or `Wooden`) and from ECL op 3C (ECL1/80 @9B6F). The build
implements the **retail** logic from the decode: the two runes from TILES 1/2, path and box chosen by `Random`, and
answer `pos := (e + 34 - d + path*12 + (5-row)*2) mod 36` looked up in the six rows at DS:0000. On a wrong answer it
prints "Sorry, that's incorrect.", allows 3 tries, then shows "An unseen force hurls you into the abyss!" and halts.
Flag `cp` in the store and URL:
- `cp=bypass` (**default**, FOREMAN/RULINGS standing decision): the start-up check is skipped as with `Wooden`.
  Op 3C returns as if answered correctly (RedrawCurrentMode only).
- `?wheel=1`: shows S016 and accepts any input. That is exactly the owner's patched copy (0x4A56 = EB), and it is what the
  DOSBox oracle on this copy shows, so it is the setting for acceptance shots.
- `?wheel=retail`: the full retail check (S016 → S017 → S018). Its reference needs a retail copy or a scratch copy with
  0x4A56 = 74 (oracle answer sheet: `decode/ecl/runewheel.py`).
The flag is our own setting and is independent of which GAME.OVR form the player imported (CR-2 A).

### 2b. Pool engine requests (filed in `docs/POOL_ENGINE_REQUESTS.md` when the build starts)
| id | request | why both games need it |
|---|---|---|
| PER-1 | `tp.js`: RandSeed location and Randomize source from the profile. Add `randomReal()` (TP 6-byte real normalisation). | Curse DS:47D8; ov18 uses Random without an argument |
| PER-2 | `text.js` / `menus.js`: text primitives take an explicit `bg` (Pool callers pass 0). Frame layouts become a per-game table instead of Pool's `DrawTitledFrame` arguments. | resident note #1, 01A0 layouts |
| PER-3 | `ecl.js`: split into a shared core (operand decoder, 6-bit text, gosub list, compare flags, skip mechanism, the vector header) and a per-game handler table + memory map. Base, regions and code size come from `profile.ecl`. Add a trace hook for SSI's name table. | 61 shared opcodes, map shift, 3 new ops + 3C |
| PER-4 | `files.js`: save-set description from `saveFormat` (file names per member, slot letters, the game-file layout), a directory-scan roster mode, and a read-only **cross-game import source** (another profile's save store). | Curse has no roster file and imports Pool/Hillsfar characters |
| PER-5 | `byoc.js`: per-manifest **normalised bytes** (`{file, offset, accept: [bytes], hashAs}`) and a recorded variant, so one manifest accepts patched and unpatched forms. | CR-2 A (0x4A56); future versions with known one-byte variants |
| PER-6 | `audio.js`: the driver offsets and note-entry format come from the adapter, and the SoundDevice code map is per game. | res_0713 = 08AE relocated, codes swapped |
| PER-7 | `pictures.js`: picture groups and the 2D backdrop slot (304×120 at the BIGPIC position) as data; the sky backdrop as an optional view layer. | BIGPIC / SKY are new in Curse and recur in later Gold Box games |
| PER-8 | `plus/hooks.js`: event names unchanged; add `npcLeft` (op 3E DUMP), `bigPicShown`, `characterImported` (source 0/1/2). The derived `journalRef` stays in hooks.js. | Curse-new emit sites (§6) |

---

## 3. Area translation plan

Areas are translated **unit by unit into `game/areas/*.js`**, as Pool did: async JS over the awaitable engine API,
routine by routine, with each pseudo routine's `{ seg:off }` kept as a comment so every JS line traces to
`decode/pseudo/<AREA>.pas.md`. One owner per file. Names come from `decode/names/*.json` and CROSSREF §2.

| area (pseudo file) | Curse units | target files | Pool twin to imitate (structure only) |
|---|---|---|---|
| RESIDENT | main_0000, res_01A0, 020F, 0297, 0542, 0636, 06EA, 0713 | mostly `game/engine/*` (text, pictures, dax, input, audio); `game/areas/startup.js` (MainProgram, demo loop) | Pool `startup.js`, engine/ |
| ECL | ov02 (VM, game loop), ov34 (tracer) + the VM half of ov07 (operands, memory, LoadEclBlock, InitVM) | `game/engine/ecl.js` (core + `ecl_cab.js` handlers), `game/areas/ecl_host.js` (game loop, RunAfterNewBlock, CampCheck) | Pool `ecl.js`, `ecl_host.js` |
| ENGINE | ov00, ov01 (title/credits), ov03 (rune wheel), ov11 (start-up load), ov16 (save/load/import), ov17 (top menu, creation) | `engine_ov01.js`, `engine_ov03.js`, `engine_ov11.js`, `engine_ov16.js`, `engine_ov17.js` (ov00 inline) | Pool `party_ov16*/ov17.js` |
| VIEW | ov10, ov14, ov26..ov33, ov35 | `view_ov10.js` … `view_ov35.js` (ov26 menus may live in `engine/menus.js`) | Pool `view_ov*.js` (Curse unit = Pool unit shifted, VIEW.pas.md header) |
| PARTY | ov06, ov12, ov20, ov21, ov24 (= Pool resident 00BA), ov25 (class change, new) | `party_ov06.js` … `party_ov25.js` | Pool `party_*`, `res_00ba_*.js` |
| MAGIC | ov04 (temple), ov08 (combat round loop + player menu), ov15 (camp), ov22 (spells) | `magic_ov04.js`, `magic_ov08.js`, `magic_ov15.js`, `magic_ov22.js` | Pool `magic_*` |
| COMBAT | ov05, ov07 (non-VM half), ov09, ov13, ov18 (finale), ov19, ov23 | `combat_ov05.js` … `combat_ov23.js` | Pool `combat_*` |

**Order (as Pool: engine + ECL first).** Milestones are screen ids from SCREENS_INDEX.md:
1. **M1 engine core + start:** fork + `cab.json` + BYOC import of v1.0. Display, dax, pictures (incl. BIGPIC/SKY/TILES), text with bg,
   input, tp (TP 5 Random), timer, audio adapter. Then title/credits/Play Demo (SCREENS_INDEX §1, S010..S015) pixel-identical to
   REF-TITLE-1/2 (REF-TITLE-1 already 0 px vs the decoded render). Launcher at M1.
2. **M2 ECL VM:** `ecl.js` Curse table, 64 opcodes, unit-tested op by op against `decode/ecl/scripts/*.ecl.txt` (all
   25 records step without an unhandled op), tracer behind `?trace=1`. Demo mode (data set 1) is the first script
   run that needs no party.
3. **M3 ENGINE + PARTY:** top menu, creation, the directory-scan roster, save/load in the v1.0 formats, Pool/Hillsfar
   import, shop/temple/money (§2 S020..S044, §4 S065..S075, §6 S095..S110).
4. **M4 VIEW:** 3D view with sky, 2D BIGPIC areas with the city overlay animation, area map, doors, encounters
   (§3 S045..S064).
5. **M5 MAGIC/camp** (§5 S076..S094), then **M6 COMBAT** + after-combat + exits/finale (§7..§9 S111..S155); §10
   S156..S167 (shared UI/errors) along the way.
6. Integration runs RUN-1 / RUN-2 (§5).

**Lane split** (lane names `cab-` prefixed; Opus finals, codex drafts allowed for large units as in Pool; one owner per file):
- **2-lane cap (today, while Star Command Plus runs):**
  - `cab-build-engine` (Opus): fork, profile, BYOC, all of `game/engine/` incl. `ecl.js`, `startup.js`, `ecl_host.js`,
    then ENGINE ov01/03/11/16/17, the launcher and `docs/POOL_ENGINE_REQUESTS.md`.
  - `cab-build-areas` (Opus, codex drafts for COMBAT/MAGIC): VIEW → PARTY → MAGIC → COMBAT in that order, each unit
    starting once its engine dependencies are posted (`engine done #n`).
  - Reference shots and ACCEPTANCE.md are taken by `cab-build-areas` between areas, and the DOSBox runs by the Foreman
    reassigning `cab-saves-ref` once it is free. Expect the playable chain later than Pool's one day.
- **4-lane cap (when the owner raises it):**
  - `cab-build-engine` (Opus): engine + ECL VM + startup + ENGINE units.
  - `cab-build-view` (Opus): VIEW + PARTY (2D/3D view, menus, shop, effects, money, class change).
  - `cab-build-combat` (codex draft → Opus): COMBAT + MAGIC (round loop, spells, camp, temple, finale).
  - `cab-dosbox-ref` + `cab-accept` (one Opus lane): reference shots per S-id, compare, ACCEPTANCE.md, RUN-1/RUN-2.
- Requests between lanes as tagged STATUS notes: `engine request #n` / `engine done #n`, `ref request <S-id>`,
  `fix request <S-id>`.

---

## 4. BYOC v1.0 manifest (`game/byoc/manifest-cab-1.0.json`, PR-4 A: v1.0 only, others refused with a clear message)

| file(s) | count / size | used for | manifest |
|---|---|---|---|
| `START.EXE` | 1 / 69,968 B (MZ, 483 relocations, not packed; "Curse of the Azure Bonds v1.0") | DS image (tables, strings, rune rows DS:0000), res_0713 sound driver data | **required**, SHA-256 |
| `*.DAX` | 86 (8X8D1-6, BIGPIC1/2/6, BODY2-6, CBODY, CHEAD, COMSPR, CPIC1-6, DUNGCOM, ECL1-6, GEO2-6, HEAD2-6, ITEM1-6, MON1-6 CHA/ITM/SPC, PIC1-6, RANDCOM, SKY, SPRIT1-6, TILES, TITLE, WALLDEF2-6, WILDCOM; exact list from data/INDEX.md) | pictures, maps, walls, scripts, monsters, items | **required**, SHA-256 each |
| `ITEMS` | 1 / 2,050 B | item-type table (ov11 3500:065D) | **required**, SHA-256 |
| `GAME.OVR` | 1 / 272,218 B | nothing at runtime (the overlay code is translated) | **hashed, not stored**, with the CR-2 normalisation below; required or optional is **open item O-3** |
| `CURSE.CFG` | 28 B | — | **not imported**: the engine writes its own 4 lines |
| saves `*.guy/.swg/.fx`, `CHRDAT*`, `savgam*.dat` | any | the player's saves | optional, size/format check only (1A6h / 3Fh / 9h; savgam layout from SAVES.md) |
| import `*.cha` / `*.sav` (Pool), `*.hil` (Hillsfar) | any | ImportSource 1/2 | optional, size check 11Dh / BCh; never hashed |
| `COPYSAVE.BAT`, `COPYCURS.EXE`, `COPR.BAT`, `HD525.BAT`, `MAKENEWA.BAT`, `dosbox.conf` | — | install/transfer tools, third party | ignored |

**CR-2 under default A (accept both forms).** For `GAME.OVR` the importer reads byte **0x4A56** (= 2600:03CE in
RuneWheelCheck). If it is `EB` (this copy, check disabled) or `74` (retail JZ), it hashes the file **as if the byte
were `74`** and compares that against the manifest hash. Every other byte is checked exactly. The import records
`variant: "patched-4A56"` or `"retail"` in the `cab-data` meta, shows it on the BYOC status line, and changes no
behaviour: the rune-wheel flag (§2a) is ours. Any other value at 0x4A56, or any other difference, means "not v1.0" →
refusal with the message and the found SHA-256. The manifest carries the rule as data
(`normalize: [{file:"GAME.OVR", offset:0x4A56, accept:[0xEB,0x74], hashAs:0x74}]`, PER-5). It is generated by
`tools/mkmanifest.py` from the owner's copy, which also writes the normalised GAME.OVR hash. Should the owner rule CR-2 = B,
the `normalize` entry is dropped and only `EB` is accepted.

---

## 5. Acceptance

**`ACCEPTANCE.md`** (owner: the acceptance lane) uses the Pool structure and verdicts: PASS = 0 px exact RGB 320×200 vs the
DOSBox-X reference · DIFF (cause named: explained / real / unresolved) · NO-REF · BLOCKED · ERR-PATH. There is one row per
SCREENS_INDEX id **S001..S167**, grouped by the SCREENS_INDEX sections (1 Start-up 19, 2 Top menu/creation/files 25,
3 Adventure 20, 4 Shop/temple/money 11, 5 Camp/rest/spells 19, 6 Character sheet/items 16, 7 Combat 29, 8 After
combat 7, 9 Exits/copy protection/finale 9, 10 Shared UI/errors 12). Each row carries the source row
(`<AREA>_SCREENS <id>`), the build path (URL + key route), the reference id `REF-S<nnn>[-variant]`, px and verdict, plus a
summary table per section and the DIFF split. Artefacts (PNGs) stay in gitignored `acceptance/local/`. Reports with
SHA-256 + px are committed in `acceptance/reports/` (Pool BYOC step 7). Expected ERR-PATH rows: S001..S005 (first-run
cfg prompts), S007..S009 (memory/overlay). S006 (NUMLOCK note) is shown by the build for 2 s or recorded as ERR-PATH
by ruling of the acceptance lane.

**DOSBox-X reference lane** (`cab-dosbox-ref`; harness already exists: `acceptance/ref/README.md`, `scripts/shoot.sh`
→ `worker.sh` → `sample.py`, `compare.py` = Pool's). Headless WSL, private Xvfb, `machine=ega`, `cycles=fixed 3000`, on a
**scratch copy** only, under the **shared run lock** (`PoolRadianceRE/acceptance/lock.sh`; one DOSBox/Chrome run across
all projects). It extends the harness from "no keys" to **scripted key routes** (Pool `session_commands` + `acc/gen.py`
→ run files replayed by `acc/run_at.mjs` in headless Chrome; `acc/cmp.py` merges the diffs). Every committed reference
has a sidecar `acceptance/ref/<id>.capture.json` (route, time, SHA-256). The rune wheel on this copy accepts any key;
the retail path uses a scratch copy with 0x4A56 = 74 and `runewheel.py` answers. Random-dependent screens use Pool's
seed method (`seedsim.py` with the TP 5 LCG, `setRandSeed` before the rolling key); screens after many draws are DIFF
(random state).

**Integration runs** (`acceptance/integration/RUN-n.md`, played in Chrome from `index.html` without dev jumps, every step
shot and hashed):
- **RUN-1 new game chain:** BYOC import → titles → Play Demo prompt (any key) → rune wheel (`?wheel=1`, any key) →
  top menu → create a party of fixed choices (seeded) → start the game → first 3D area → the first scripted
  encounter / combat → after-combat treasure → camp (rest, memorize) → save to slot A → quit → reload A → same view,
  clock and party (byte-compare `savgamA.dat` against a DOSBox save on the same route where the run lock allows).
- **RUN-2 load, import, demo:** idle start → the 30 s timeout runs the **demo** (data set 1, GameSpeed 9) → back to
  the prompt. Then load a DOSBox-made save (cab-saves-ref) → 2D BIGPIC area with the overlay animation → shop and temple →
  **import a Pool of Radiance character** (`.cha` from the player's Pool copy, ConvertPoolCharacter) and a Hillsfar
  `.hil` if a file is available (else recorded as not run) → character sheet → save. The DOSBox Pool import route is
  the reference.
- Behavioural scenario runs with a fixed seed compare a DOSBox run on the same key script where feasible. A "finding
  about the original" counts only when DOSBox confirms it (SC lesson).

---

## 6. The Plus layer (outline only; after the faithful build passes its regression table)

Packages S1..S9 as FOREMAN.md lists them, mapped to PLUS_LAYER.md W-numbers. Code is forked from Pool `game/plus/` like
the engine, with the same rule: the shared shape stays shared, and Curse-new hook sites go into PER-8 and
`docs/PLUS_TRIAL.md`.
| step | package | Curse specifics |
|---|---|---|
| S1 hooks (W1) | event bus + read-only state + region registry + master switch | emit sites per Curse routine (text: DrawText/DrawWrappedText with bg; `areaEntered` from LoadEclBlock 2C00:0380; `flagSet` from ecl_SetMem regions 0..2; new `npcLeft` op 3E, `bigPicShown`, `characterImported`) |
| S2 shell (W2 + W10) | F12 / gear / pad Menu panel, store `cab-plus`, Status/Keys/About, profile `cab.json` in the Games selector | the second Gold Box profile next to `por` |
| S3 click (W3) | hit regions → keys | the rune-wheel line prompt, the 2D BIGPIC areas (no view cells), combat cursor as Pool |
| S4 notes + journal (W4 + W5) | automatic diary; **Journal tab** | fed by `decode/ecl/JOURNAL_REFS.md` (46 citation sites, 44 distinct entry numbers, incl. the table-driven 24/35/42 note at ECL1/80 9A7C). `journalRef` is derived in hooks.js from `textPrinted` ("JOURNAL ENTRY " + number) and keyed to the citing script address, so the tab shows entry N, where (area/block), when (game clock) and the scene line. **CR-1 default A: no journal text is shipped.** The player types the text or imports it from their own book (PDF/paste), and it is shown only after the game has cited it. Quests table keyed by script flag addresses (W5) as a follow-up. |
| S5 pedia (W6) | catalogue + reveal on encounter | monsters MONnCHA (81 × 422 B), items ITEM/ITEMS, spells from the DS spell table (MAGIC ov22 init), places from the 16 GEO maps + the 2D areas; how-to pages hand-written |
| S6 helpers (W7 + W8) | **Map tab** (automap from GEO, fog per slot, click-to-travel) + crisp font, tooltips, combat log, quick save via the game's own save path | the overland BIGPIC 121 region map as a map layer (2D areas have no GEO grid: positions come from the script vectors, open item O-6) |
| S7 cheat (W11 + W12) | dev-only state injection, `?scenario=` | record builder for the 422-B record via the creation rules (ENGINE ov17) |
| S8 qa (W13) | headless routes per tab, isolated committed tree, source fingerprint | **gate: the full original regression table at 0 px with Plus mounted** |
| S9 docs (W14) | `docs/PLUS_TRIAL.md` (shared with Pool/Star Command vs new hooks), README, CREDITS (incl. simeonpilgrim/coab as cross-check oracle, Gold Box Companion as the feature list) | public release only via the owner/the owner (RELEASE.md) |

---

## 7. Risks and open items

| id | item | effect on the build | owner / next step |
|---|---|---|---|
| O-1 | **Gate items 6 and 8 open**: `decode/data/SAVES.md` from a DOSBox-made save, and the DOSBox-X oracle checks (`acceptance/ref/DECODE_CHECKS.md`) | `files.js` save layout and the savgam byte layout unverified; no reference beyond the titles | cab-saves-ref (waits for the shared run lock); the build does not start before the gate |
| O-2 | CR-1 / CR-2 unanswered (defaults A apply) | Journal tab without text; the manifest accepts both forms of 0x4A56 | the owner via the owner |
| O-3 | GAME.OVR required or optional in the manifest | Pool made it optional. Curse's version check could rest on START.EXE alone. Making it required gives CR-2 its meaning | Foreman ruling at build start (recommend: required, hashed with normalisation, not stored) |
| O-4 | Fork drift: Pool's engine is still being changed by its Plus lanes | Curse fork falls behind the pin. Merging gets harder | pin 85fb6d6. Every Curse change is a PER or a profile field. Re-sync is a deliberate step, never automatic |
| O-5 | TP 5.0 vs 5.5 runtime unsettled (RT_LEDGER) | none known for the build: the Random LCG is the same body. RandomReal's normalisation is to be unit-tested against DOSBox draws in the finale | build-engine |
| O-6 | 2D areas (view_Mode 3, BIGPIC) have no GEO grid | Map tab / click-to-travel need another position source | Plus S6 |
| O-7 | Retail rune-wheel behaviour can only be referenced on a patched scratch copy | `?wheel=retail` rows are DOSBox-confirmed only that way | dosbox-ref |
| O-8 | Unknown character fields (ECL_VM.md §10: +13h, +19h, +74h, +E0h, +E5h, +10Eh/+116h, +119h, +13Ch, +13Eh, +192h) and region-4 reads of unlisted addresses (garbage in the original) | copied as bytes. A script reading an unlisted region-4 cell gets 0 in the build (none of the 25 scripts does) | SAVES.md closes most fields |
| O-9 | Demo mode and the 30 s Play Demo timeout | an idle acceptance run drifts into the demo. Routes must press a key at S015 | acceptance routes |
| O-10 | CPU-speed-bound delays | timing differs from DOSBox `cycles=fixed 3000` | yardstick = the harness cycles (as Pool) |
| O-11 | Pool/Hillsfar import needs the player's other games' files | RUN-2 import steps may be "not run" | optional in BYOC; Pool build store as a source (PER-4) |
| O-12 | Lane cap 2 | M1..M6 are serial in practice | the owner raises the cap when Star Command Plus closes; the 4-lane split is ready (§3) |
| O-13 | Pool's ov18-style finale text in Curse ov18 (S150/S151 mention Tyranthraxus / the Pool) | it is what the code prints, so reproduce it. Whether it is reachable from the shipped scripts is to be checked in the build (PROGRAM 8 use) | build-combat |
| R-1 | Shared-engine discipline costs time on day one | PER bookkeeping slows the first lanes slightly | accepted: it is the point of the trial (PLUS_TRIAL.md) |
