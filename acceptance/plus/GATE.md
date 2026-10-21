# GATE — Gold Box Plus, original mode unchanged (cab-build-engine, 2026-10-21)

**Result: PASS.** With Plus mounted, the six spot-check screens (ACCEPTANCE.md "Spot check", the owner 10/21) and RUN-1
give the same pixels as before Plus, both with the master switch off (`?plus=0`, "Play the original game") and with Plus
on and no Plus UI open. The game logic is proven without pictures in acceptance/TRACE.md.

Script: `sh acceptance/plus/gate.sh off|on [id ...]` (shared run lock; server `python -I tools/serve.py 8189 --dev --saves
acceptance/local/gatesaves` = the DOSBox saves B C D (camp run), E (walk7), G (patched overland), local). Shots:
`acceptance/local/shoot/g0-<id>.png` (off) and `g1-<id>.png` (on), SHA-256 in `acceptance/reports/shoot/g0-*.json` /
`g1-*.json`. Build: Plus mounted by main_cab.js (plus requests #5..#13: hooks, panel, F12 hint strip outside the
frame, click layer, quick save entry, dev entry).

| # | under test | id | route | reference | off (`?plus=0`) | on (no UI) | SHA-256 off = on | verdict |
|---|---|---|---|---|---|---|---|---|
| 1 | 3D view | S049 | camp seed, ALPHA, Begin (= RUN-1 step 1) | REF-S049 | 0 px | 0 px | 13a50c94… = | **PASS** |
| 2 | big picture (BIGPIC 121) | S053 | load save G, Begin, 50 s | REF-S053 / REF-S054 (the two phases of the blinking party marker) | 0 px vs REF-S053 | 0 px vs REF-S054 | the 50 s shot caught the other blink phase (64 px only at the marker 32,120..39,127) | **PASS** (each shot = one DOSBox phase) |
| 3 | overland + party marker | S054 | load save G, Begin | REF-S054 | 0 px | 0 px | 65fb4aeb… = | **PASS** |
| 4 | text (character sheet) | S095 | camp seed, ALPHA, camp, … View | REF-S095 | 0 px | 0 px | 50f9dc90… = | **PASS** |
| 5 | menu screen (shop list) | S066 | load save D, walk to the weapon shop, Y, B | REF-S066 | 0 px | 0 px | fc2d4502… = | **PASS** |
| 6 | combat board | S113 | load save E, walk7's keys, seed 4 | REF-S113: DIFF explained (random placement, unseeded DOSBox run) | **= the recorded build shot sd4, 0 px** (3690 px vs REF-S113, as before) | = sd4, 0 px | 319280c1… = | **PASS** (unchanged; the row stays DIFF explained) |
| RUN-1 | area map | r1-map | step 1 + A | REF-S050 | 0 px | 0 px | 65d75343… = | **PASS** |
| RUN-1 | the save | — | the camp run's route, Save B | DOSBox SAVGAMB.DAT / CHRDATB1.* | in node (TRACE.md run1): identical in every defined byte | — | — | **PASS** |

Also run in original mode (`?plus=0`) before the spot-check ruling, all at their earlier verdicts:
- 0 px: S010..S016, S019 (= REF-S015), S020, S020-PARTY, S024..S028, S030, S034 (seeded), S035.
- S006 ready, no errors.

Every shot: `ready`, no console errors.

Note: a first `r1-begin` row used the six-member party route against REF-S049 (one member) and differed only in the
roster (1140 px). That was the wrong route, not Plus. With RUN-1's own one-member route (row 1) it is 0 px.
