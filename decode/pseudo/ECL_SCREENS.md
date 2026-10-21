# ECL_SCREENS — what the event scripts put on screen (lane cab-mod-eclview)

Routines: decode/pseudo/ECL.pas.md (ov02/ov34). Opcode semantics: decode/ecl/ECL_VM.md. Script texts: decode/ecl/scripts/ (every PRINT of the 25 records, with addresses; journal citations in decode/ecl/JOURNAL_REFS.md).

Screen geometry (from the call arguments, H unless noted): 40x25 text cells of 8x8 glyphs from the game font (8X8D), not BIOS text. Cells are (col, row), 0-based.

| region | cells | used for |
|---|---|---|
| picture box | (1,1)-(15,15) | 3D view / encounter pictures (drawn with top-left cell (3,3)); 2D areas: the BIGPIC backdrop at (1,1) |
| roster | (17,1)-(38,15) | party list `PartySummary` ("Name AC HP"), redrawn after damage / selection |
| text window | (1,17)-(38,22) | PRINT / PRINTCLEAR / prompts, word-wrapped by `DrawWrappedText 0542:04A4`, cursor `text_Col/text_Row` (col/row; EXIT resets it to (1,17)) |
| menu line | row 24 (cols 0..39) | horizontal menus, "Loading...Please Wait", continue prompts, the "A battle begins..." line |

Colours: 0Ah light green = script text, 0Fh white = highlights, messages, prompts; 0Dh = menu prompt colour. Script text is upper case (6-bit character set, ECL_VM.md §2.2).

---

### ECL-01 Loading block
- Trigger: `LoadEclBlock` (LoadEclBlock) — game start, NEW ECL (20h).
- Screen: nothing of its own in Curse (no "Loading" line here; no disk prompt — the "Insert disk" step of Pool's NEW ECL is gone); the LoadAnimation of the first PICTURE shows VIEW-12 when `opt_Animation <> 0`.
- Next: ECL-02.

### ECL-02 Block init / area entry
- Trigger: vector E after load (`ecl_GameLoop` 2200:3772, `ecl_RunAfterNewBlock` 2200:3691).
- Screen: whatever the init script does (LOAD FILES / LOAD PIECES load map and wall sets, PICTURE loads the area picture or a BIGPIC); RefreshView when the view mode changed or `g_47E3` (a loaded save); the roster is redrawn after vector B (`PartySummary`).
- Next: ECL-03.

### ECL-03 Exploration turn
- Trigger: each pass of the game loop: `ExploreCommand` (VIEW-01), then vector A, the move (`MoveParty`, VIEW-03 for doors), step sound, vector B.
- Screen: the scripts print into the text window (PRINT / PRINTCLEAR, 2200:09EA), run menus (HORIZONTAL MENU on row 24, VERTICAL MENU in the text window, ENCOUNTER MENU `~COMBAT ~WAIT ~FLEE ~ADVANCE/~PARLAY`, PARLAY `~HAUGHTY ~SLY ~NICE ~MEEK ~ABUSIVE`), show pictures (PICTURE: PIC/HEAD+BODY at (3,3) or a BIGPIC; SETUP MONSTER: SPRIT sprite at the encounter distance), and ask for input (INPUT STRING on the bottom line; WHO = the "Select / Exit" party picker).
- Next: ECL-03 again, ECL-04 on 'E', ECL-05 on COMBAT, ECL-06 on PROGRAM.

### ECL-04 Camp
- Trigger: 'E' in ExploreCommand -> `ecl_CampCheck` 2200:3073 (also PROGRAM 9).
- Screen: vector C runs first (scripts may print or refuse), then the camp menu of ov15 (`Camp`; PARTY/MAGIC lane: rest, memorise, …); on a rest vector D runs; then RefreshView.
- Next: ECL-03.

### ECL-05 Combat
- Trigger: COMBAT (24h) with monsters loaded (`MonstersPresent`) or a duel (`DuelActive`).
- Screen: VIEW-05 "A battle begins..." then VIEW-06; video-mode switches around every unit change (`PlayOrStopSound(SndShutdown)` / `StartSound`); without monsters: the shop (ov06, `Mem[7F6C]`), the temple (ov04, `Mem[7EE2]`) or the after-combat screen (ov05); afterwards the 2D backdrop (BIGPIC 79h) or the 3D redraw and `RedrawCurrentMode`.
- Next: ECL-03.

### ECL-06 Program exits
- Trigger: PROGRAM (38h) p = 0: `ov17_0000` + the top menu `PartyCreationMenu` ("Choose a function", ENGINE_SCREENS); p = 8: the end sequence `EndSequence`, every member healed and activated, the top menu, then `AskYesNo('You've won. Save before quitting? ')` (VIEW-10) -> `SaveGame` saves; the program halts; p = 9: camp (ECL-04) then EXIT; p = 3: PartyDead := 1 -> the loop ends (the scripts' "party killed" exit).
- Next: title / DOS.

### ECL-07 Copy protection
- Trigger: PROTECTION (3Ch) in ECL1/80 ("WHAT DOES THIS MEAN?") and the main program before the first area.
- Screen: `RuneWheelCheck` (RuneWheelCheck, ECL_VM.md §8): two 24x24 rune tiles (TILES.DAX) at (3,11h) and (7,11h), the texts "Align the espruar and dethek runes" / "shown below, on translation wheel" / "like this:" + the path pattern, "Type the character in box number N" / "under the <path> path.", input "type character and press return: "; retail: "Sorry, that's incorrect." (3 tries) then "An unseen force hurls you into the abyss!" and halt — dead code in this copy (any key passes).
- Next: "YOU MAY PASS." (script), ECL-03.

### ECL-08 Tracer (debug)
- Trigger: `DebugFlag` (DebugFlag) <> 0 while scripts run.
- Screen: every opcode name (ov34 table: "EXIT", "GOTO", … "DESTROY ITEMS") written with WriteLn to the Pascal `Output` (the BIOS text screen, row by row) before it executes. Not reachable from the game's keys (the flag is set only by code paths not found in the shipped build; M).
- Next: the script continues (the tracer only prints before each opcode); the caller's screen, i.e. ECL-03.

### ECL-09 Script-controlled view effects
- `Mem[4BE6]` write: switches the view mode (3D / 2D, ECL_VM.md §3); `Mem[4BFD/4BFE]`: sky colours by cell-attribute bit 7; `C059h/C05Fh`: backdrop colour keys (CGA bands); `Mem[4BFB]`: forbids the area map ("Not Here"); `Mem[4CFF]`: tints every picture light red and auto-advances the encounter animation (6800:0507 / 050b (the `Mem[4CFF]` test in HorizontalMenu)); CLEAR BOX: redraws roster + picture; SPRITE OFF: removes the 3D sprite (RefreshView).

- Next: no screen of its own: the effects apply to the caller's view, which continues as ECL-03 (combat: COMBAT screens).