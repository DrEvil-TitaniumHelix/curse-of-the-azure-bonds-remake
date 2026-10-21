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
