# BYOC-TEST — the v1.0 importer end to end through the UI (cab-build-engine, 2026-10-21)

Step 0 of herdr/assignments/cab-plus-hooks.md (the owner order item 2). **Result: PASS.** Both accepted forms import and boot the
game from the browser store only. Both refused cases are stopped on BY-4 with the version message and the file that differs.

## Setup
- Server in **player mode**: `python -I tools/serve.py 8190 --player`. It serves `game/` only: `/devdata/?list` and `/data/*`
  answer 404, so there is no dev auto-import and the page must show BY-1.
- Scratch copies: `python -I acceptance/byoc/make_copies.py`. It reads `re-targets/goldbox/cotab/curazure` (96 files) and
  writes the gitignored `acceptance/local/byoc/<case>/`. The original folder is never written.

  | case | change against the owner's folder |
  |---|---|
  | owner | none (GAME.OVR 0x4A56 = EBh, the owner's patched copy) |
  | retail74 | GAME.OVR 0x4A56 EBh -> 74h (the retail byte) |
  | badbyte | GAME.OVR 0x4A56 EBh -> 75h |
  | otherver | START.EXE 0x7D3 '0' -> '1' (`Curse of the Azure Bonds v1.1`: a simulated other release, because no other version of the game is on this machine) |
  | poolrad | the player's Pool of Radiance folder `re-targets/goldbox/por/POOLRAD`, picked in place (another Gold Box game) |
- Runner: `node acceptance/byoc/byoc_ui_test.mjs [case ...]`. It uses headless Chrome under the shared run lock, with one
  Chrome and a fresh browser store per case, and opens `index.html?screen=S010&fast=4`. On BY-1 it presses **S**
  (`SELECT FILES OR FOLDER`). The browser's file chooser opens (mode `selectMultiple`, folder input); CDP intercepts it
  and answers with the case folder, i.e. what a player picks. Then BY-2 checking runs, then BY-3 or BY-4. On BY-3 the
  runner presses **S** `START` and waits for the first title, then reloads the page.
- Shots (original art, local): `acceptance/local/byoc/shots/<case>-<n>-<screen>.png` (320×200). Results and SHA-256:
  `acceptance/reports/byoc/<case>.json`.

## Results (run 2026-10-21, after the BY-1 title fix below)
| case | BY-1 | check (window.__byocReport) | screen | boot | reload | verdict |
|---|---|---|---|---|---|---|
| owner | 651ae1e0… | ok, cab-1.0, 89/89, GAME.OVR match, variant `patched-4A56` | BY-3 "Version 1.0 recognised - 89 files." f37a2609… | S010 2568ef73…: **= REF-S010 at 0 px**; 0 requests to /data or /devdata after START; IndexedDB `cab-data` stores files + meta | S010 directly, BY-1 not shown (same hash) | **PASS (accepted)** |
| retail74 | 651ae1e0… | ok, 89/89, GAME.OVR match, variant `retail` | BY-3 f37a2609… | S010 2568ef73… (same as owner) | S010 directly | **PASS (accepted, CR-2 A)** |
| badbyte | 651ae1e0… | refused, 88/89, GAME.OVR mismatch, bad `GAME.OVR:hash` | BY-4 f8fef8c9…: "This looks like a different version of Curse of the Azure Bonds (1 of 89 files differ). This reproduction supports version 1.0 only." + `GAME.OVR  DIFFERENT CONTENT` | — | — | **PASS (refused)** |
| otherver | 651ae1e0… | refused, 88/89, bad `START.EXE:hash` | BY-4 a0bb7ad7…: the same version message + `START.EXE  DIFFERENT CONTENT` | — | — | **PASS (refused with the version message)** |
| poolrad | 651ae1e0… | refused, 4/89 (85 missing or different) | BY-4 9ec003ea…: version message + the list (START.EXE SIZE 65231 NEED 69968, ...) | — | — | refused (see finding 2) |

Console errors: none in any case.

## Findings
1. **Fixed (PER-12, `game/byoc/ui/byoc-ui.js`):** the BY-1 title `Curse of the Azure Bonds - game files` is 37 characters,
   longer than the 36-column title line, so it showed as `...BONDS - GAME FILE`. A title that does not fit now drops the
   suffix (`CURSE OF THE AZURE BONDS`). Pool's title fits and is unchanged. The first run's BY-1 hash was b246531e…; it is
   651ae1e0… after the fix.
2. **Open (wording only, shared Pool code `classify()`):** a folder that holds most of the same file names counts as
   "another version". A one-byte damage (badbyte) and the Pool of Radiance folder therefore both get "This looks like a
   different version of Curse of the Azure Bonds". Pool and Curse share 8X8D*.DAX, ITEMS, START.EXE and other names, so
   ≥ 80 % of the names hit. The files are refused correctly. A clearer text, e.g. naming another known game when its
   START.EXE hash matches that game's manifest, would be a PER for the shared BYOC UI. Not changed here.

## v1.3 — the WizardWorks CD copy (cab-v13, 2026-10-21; decode/V13_DELTA.md 4.3, requests v13-1 .. v13-4)
**Result: PASS.** The importer knows two manifests (`manifest-cab-1.0.json`, `manifest-cab-1.3.json`) and accepts the one the
whole folder matches (`engine/byoc.js validate`, v13-4). A v1.3 copy boots through the profile overlay `game/profiles/cab-1.3.json`
(`ST.EXE` unpacked, DS map, sound segment 0699, behaviour switch `cab-1.3`; v13-1 .. v13-3). The v1.0 cases above are unchanged.

### Node tests (`node --test game/test/byoc/byoc.test.mjs game/test/engine/v13.test.mjs game/test/profiles/profile.test.mjs`, 23 pass)
| plan | case | result |
|---|---|---|
| T1 / T2 | owner copy (0x4A56 = EB) / retail form (74) | accepted as cab-1.0 `patched-4A56` / `retail`; after a v1.3 import the owner copy still matches cab-1.0 and the active manifest follows the import |
| T3 | the CD folder (incl. its `SAVE/`) | accepted as **cab-1.3**, version `1.3`, variant `retail` (0x4A9C = 74), 89/89, GAME.OVR match; `ST.EXE` (57,789 B, packed) stored, GAME.OVR not stored; 88 files in the store; both versions tried |
| T4 | CD folder with GAME.OVR 0x4A9C = EB / = 75 | accepted as `patched-4A9C` / refused (`GAME.OVR:hash`, cab-1.3 report) |
| T5 | CD data files + v1.0 START.EXE and GAME.OVR; v1.0 data files + v1.3 ST.EXE and GAME.OVR | both refused by both manifests (`likelyOtherVersion`), the changed DAX files named |
| T6 | START.BAT, CURSE.CFG, COPYCURS.EXE, DKK on the CD; `SAVE/` | not in the report (ignored); 21 save files scanned and all valid (SAVGAMA.DAT 13,149 B, CHRDAT* 422 B, .FX 9 / 27 B) |
| T7 | run checks | `CAB_PROFILE=cab-1.3 CAB_DEV_DATA=<CD copy> node acceptance/trace.mjs all`: the four routes (RUN-1 new game + camp save, RUN-1 inn/bar/brawl, RUN-2 load D, RUN-2 load G overland) give the **same texts, memory writes, checkpoint states and save-byte results as v1.0** (`acceptance/reports/trace/<route>-v13.json` vs `<route>.json`); dsMap / overlay / executable proven by `v13.test.mjs` (the v1.3 DS equals the v1.0 DS byte for byte, title string `v1.3`, driver tables, handlers 53h / 7Eh, spell-list order, STR clamp). Sound and the gaze fight: unit level only (no DOSBox reference for v1.3 sound) |
| T8 | Pool of Radiance folder; CD copy without GAME.OVR; v1.0 copy with one damaged byte | refused (4/89); refused (`GAME.OVR missing`, gameOvr `absent`); refused (cab-1.0 report, `hash`) |

### Headless UI run (`node acceptance/byoc/byoc_ui_test.mjs cd13 cd13patched mixed13`; scratch copies `python -I acceptance/byoc/make_copies_v13.py`)
Server `python -I tools/serve.py 8190 --player`; shared run lock; one Chrome and a fresh browser store per case. The runner now also
records what booted (`window.E.profile`: version, overlay, executable; the first bytes of the engine's DS image; the title string
of the unpacked image; the sound segment).
| case | folder | check (window.__byocReport) | screen | boot (S010) | reload | verdict |
|---|---|---|---|---|---|---|
| cd13 | the CD folder as it is (114 files incl. SAVE/) | ok, **cab-1.3**, 89/89, GAME.OVR match, variant `retail`, 21 saves | BY-3 422ce4e8… "Version 1.3 recognised - 89 files." | S010 **2568ef73… = the v1.0 S010 (= REF-S010 at 0 px)**; booted version `1.3`, overlay `cab-1.3`, executable `ST.EXE`, DS 36,640 B with rune row 0 `CWLNRTESSCED…` at DS:0000, image title `Curse of the Azure Bonds v1.3 `, audio segment 0699; 0 requests to /data or /devdata; IndexedDB `cab-data` files + meta | S010 directly (no BY-1), same hash | **PASS (accepted, boots to the title from the browser store)** |
| cd13patched | GAME.OVR 0x4A9C 74 -> EB | ok, cab-1.3, 89/89, variant `patched-4A9C`, 21 saves | BY-3 422ce4e8… | S010 2568ef73…, same boot record | same | **PASS (accepted)** |
| mixed13 | CD data files + v1.0 START.EXE / GAME.OVR (89 files) | refused: best report cab-1.0, 84/89, `likelyOtherVersion`, bad `ECL1/3/4/5.DAX:size`, `GEO4.DAX:size` | BY-4 afdc4238… "This looks like a different version … supports versions 1.0 and 1.3 only." + the five files | — | — | **PASS (refused with the version message)** |

Console errors: none in any case. Reports: `acceptance/reports/byoc/cd13.json`, `cd13patched.json`, `mixed13.json`; shots local.

### Findings
3. **Fixed (`acceptance/byoc/byoc_ui_test.mjs`):** the scratch-copy check looked for `START.EXE` only; a v1.3 folder has `ST.EXE`.
4. **Note (view_ov26.js, v13-3):** the accepted v1.0 build's `SkipHeaders` / `MoveSelection` already carry the `count-1` clamps that the
   v1.0 asm (ov26.c) does not have and v1.3 adds; left as accepted (behind no switch), only the v1.3 `count <= page` top reset is new.
