# Gold Box Plus on Curse of the Azure Bonds — trial report (S9)

**Status: 2026-10-21 02:30 MDT (cab-plus-docs).** Plus is the third implementation of the Plus layer, after Pool of
Radiance (Gold Box Plus, 2026-10-19) and Star Command (2026-10-20). It is the first time **the same engine family**
receives a second Plus. The question for this report (FOREMAN.md deliverable 4): what came over from Pool and Star
Command as it was, what became a profile parameter, and what needed a new hook or engine change.

**Framing (the owner 2026-10-21: rigor per engine, not per game).** Curse is a **Gold Box engine follow-up title**: Pool of
Radiance carried the full method for this engine, so Curse verifies only its *engine delta*. That delta is the 3 new ECL
opcodes, the PROTECTION opcode for the rune wheel, the 422-byte records, TP 5.x `TPOV` overlays, BIGPIC/TILES/SKY and
Pool/Hillsfar import. The full list, what was reused unchanged, and the times against Pool are in
[decode/ENGINE_DELTA.md](../decode/ENGINE_DELTA.md). The same rule applies to Plus: whatever this report marks
"shared" was proven on Pool and only spot-checked here.

**Short answer.** The shell, the bus, the store, the ledgers, the mods and most helpers came over almost unchanged.
The hook *contract* came over unchanged, plus three new events. Every hook *site* is new, because Curse has its own ECL
VM (`ecl_cab.js`) and its own area files. Every package that reads game data needed new readers: the Pedia (422-byte
records), the Quests (a new decode, FLAGMAP + QUESTS) and the Map (BIGPIC overland). **Not done:** S3 click, the
original-mode gate run, all Plus headless shots (the shared run lock was held by another project from 00:17 MDT), and
the Hillsfar import (no `.hil` file to test with).

**Evidence used:**
- File diff of `game/plus/` against Pool at the fork pin `PoolRadianceRE 85fb6d6` (game/FORK.md). Counts are changed
  lines (diff `<` + `>`, line endings ignored) / Pool's line count.
- `// cab:` markers (`grep -rn "cab: " game/plus`), docs/POOL_ENGINE_REQUESTS.md (PER-n), docs/PLUS_HOOKS.md, the plus
  requests #1..#16 in STATUS.md, the node tests in `game/test/plus/`.
- Star Command's report `StarCommandRE/docs/PLUS_TRIAL.md` (read-only) for the cross-project comparison.

## 1. Headline

1. **The second Gold Box game shares much more code than Star Command did.** Of Pool's 62 Plus files, 26 are
   line-for-line the same in Curse (line endings ignored): all of `click/`, `mods/`, `map/geo.js`, `map/ledger.js`,
   `map/overlay.js`, `pedia/search.js`, `pedia/pictures.js`, `helpers/crispfont.js`, `tooltips.js`, `overlay.js`,
   `presets.js`, `margins.js`, `journal/import.js`, `plus.css`, `tabs/keys.js`, `tabs/status.js`, `tabs/mods.js`.
   Another 12 changed in fewer than a quarter of their lines (changed lines / Pool's lines). Star Command's median line similarity with Pool was 0.07.
2. **The hook layer was shared as a contract, not as sites.** `hooks.js` changed in 56 of 287 lines: the record layout
   and the VM cells became profile parameters, and three events are Curse-new (PER-8). The ~40 `hooks.emit` sites are
   all new: 15 in `ecl_cab.js`, 5 in `main_cab.js`, 1 in `menus_cab.js`, 19 in the area files, plus 3 in Pool's shared
   `text.js`. Engine footprint from the first Plus commit (1f4b50f) to now: **313 lines added, 38 removed in 14 files**
   (`game/engine`, `game/areas`, `game/index.html`). Every change is a one-statement emit, a read-only getter, or a
   dev/safe-point seam (plus requests #10..#13).
3. **Game data packages needed new readers, but kept their frameworks.** The Pedia, Quests and Map frameworks (ledger
   per save slot, reveal, search, state machine, fog) were kept. The readers were rewritten: 422-byte character records
   instead of 285, 100 spell ids, the DS tables of Curse's START.EXE, script base 8000h instead of 9900h, GEO + BIGPIC
   instead of Pool's area maps.
4. **Pool's identity was hard-coded in the same places Star Command found** (`por` defaults, `por-plus` store, Pool
   DS offsets). Each became a `// cab: param` or a profile field. The `goldBoxPlus` global and the `por-plus-*` event
   names were kept on purpose: they are the Gold Box family's names.
5. **The bottleneck was verification, not code.** All Plus code was written in about 1 h 45 min of wall clock
   (00:15–02:00 MDT, 48 commits, 3 to 4 lanes). Over the same time, every headless run waited for the shared
   cross-project run lock. The node tests pass; the shots and the original-mode gate are queued.

## 2. Per package (PLUS_LAYER.md W1..W14)

Legend: **shared** = Pool's file unchanged; **param** = changed only by `// cab: param` (profile fields, ids, offsets);
**new** = Curse-specific code, a new hook, or an engine change.

| W | package | result | shared / param / new | evidence | effort |
|---|---|---|---|---|---|
| W1 | hooks | done (S1) | contract shared; record layout + VM cells **param**; 3 events + every emit site **new** | hooks.js 56/287 lines, 14 `cab:` markers; cab.json `plus` (charFields, partyCount 7F3E, clock 4BC6, map3d 4BC5); PER-8; plus requests #1..#4 (partyDrawn, treasure, turns, duplicate combat events), #10 (geoPlanes / passage getters), #11 (engine save / load), #12 (explore-menu abort), #13 (hooks.dev, dev only); #8 (item record in `treasure`) **open**; tests hooks 6/6, hooks_cab 4/4 (46 journal sites) | engine + areas lanes, ~1 h |
| W2 | shell | done (S2) | panel, tabs, settings **shared**; store name, tab row **param**; F12 hint strip outside the frame **new** (the owner's rule) | plus.js 78/104, store.js 6/40 (`cab-plus`), games.js 14/67 (cab next to por), stubs.js; plus requests #5 (mount), #6 (fit() reserve); shell-store 4/4 | shell lane |
| W3 | click | **not done** | `click/` is Pool's, unchanged, **not mounted** | S3 needs the rune-wheel prompt, the 2D BIGPIC areas (no view cells) and the combat cursor; click-to-travel also not done | — |
| W4 | notes + journal | done (S4) | tracker + Journal tab **param**; journalRef parser **new** (Curse split forms) | notes/tracker.js 23/56, tabs/journal.js 22/38; decode/ecl/JOURNAL_REFS.md (46 sites, 44 entries); ruling CR-1 A: no journal text shipped, the player imports their own; notes_cab 5/5 | shell lane |
| W5 | quests | done (code); shots pending | state machine **shared**; marks by instruction address **new**; table **new** | a new decode: decode/tools/flagmap.py → FLAGMAP.md (2250/2250 sites = listings), decode/ecl/QUESTS.md; table.js (8 quests), text.js 4/56 (base 8000h), log.js 11/98; plus requests #14 (tab), #15 (cab.json questTable), #16 (profile test, open); quests 5/5 | quests lane, ~1 h |
| W6 | pedia | done (code); shots pending | search, pictures, ledger **shared**; reveal **param**; record readers **new** | records.js 79/61, build.js 57/75, reveal.js 41/115; 81 monsters, 7 NPCs, 390 items, 128 types, 87 spells, 16 GEO + 4 BIGPIC places; plus requests #7 (pediaSources), #8 (open), #9; pedia 7/7, pedia-reveal 6/6 | pedia lane, ~1 h |
| W7 | map | done except click-to-travel | geo, ledger, overlay **shared**; fog **param**; BIGPIC overland layer **new** | fog.js 21/51, load.js 40/30, overland.js 51/35 (BIGPIC 121 + the 32 DS location spots), tabs/map.js 36/62; #10; map 7/7, map-fog 9/9. The Map page is registered by plus.js but is not in the Curse tab row yet (stubs.js) | shell lane |
| W8 | helpers | done, all off by default | crisp font, tooltips, overlay **shared**; combat log, text cells **param**; quick save **new** (engine path) | combatlog.js 7/108, textcells.js 33/58 (reads the presented canvas + the player's 8X8D1 font, not engine modules), saves.js 4/71; #11; spell presets and margins not offered | shell lane |
| W9 | mods | code shared, not offered | all 5 `mods/` files unchanged | no Mods tab in the Curse row; mods 8/8 (forked tests) | — |
| W10 | profile | done | `cab.json` next to `por` | `plus`, `pediaSources` (#7), `questTable` (#15); profile-plus 3/4 (the 4th waits on #16) | engine lane |
| W11 | cheat | done, dev only | tab API **shared**; party builder **new** | cheats/party.js 179/93, live.js 92/67, scenario.js 142/103; records built by the engine's own creation rules and checked field by field against PARTY.pas.md; #13; cheats_cab 6/6 | shell lane |
| W12 | scenario | done, dev only; map editor stub | format **param**; ECL assembler **new** | scenario/eclasm.js (Pool's tools/eclasm.py ported to JS, Curse opcodes): 25/25 listings assemble to the player's records byte for byte; eclasm 3/3, scenario 2/2 | shell lane |
| W13 | qa | **not run** | Pool's harness copied | qa-*.mjs present; shell, journal, map, pedia, quests shots and the Plus acceptance rows wait for the run lock | — |
| W14 | release | this report, README, CREDITS | — | public clone + gate only via the owner / the owner | docs lane |

## 3. Hook events: shared with Pool vs Curse-new

All 24 Pool events kept their names. Payloads are Pool's except where noted.

| event | shared with Pool | Curse site(s) | Curse change |
|---|---|---|---|
| textPrinted | yes | ecl_cab.js PRINT / PRINTCLEAR, VERTICAL MENU, ENCOUNTER | + `addr`, `block`, `dataset`, `fg`, `bg` (the instruction address makes Journal and Quests marks exact) |
| journalRef | yes (derived in hooks.js) | from textPrinted | parser handles the Curse split form ("... AS JOURNAL " + "ENTRY 30.") and the shared-subroutine form; + `addr`, `scene`, `clock` |
| areaEntered | yes | ecl_cab.js game loop, after the new block | + `DEMO` source |
| flagSet | yes | ecl_cab.js setMem wrapper (ecl_SetMem) | + `pc` |
| moved | yes | view_ov14.js step + turns | + `from`, `stepped`, `turned` (#3) |
| monsterShown, pictureShown, npcTalk, combatStart, combatEnd | yes | ecl_cab.js | combatStart / combatEnd only around the VM's single CombatMain call (#4); combatEnd payload smaller |
| combatTurn, combatCursor, menuDrawn, listDrawn, viewDrawn | yes | magic_ov08, combat_ov13, menus_cab, view_ov26, view_ov30 | — |
| partyDrawn, treasure | yes | party_ov24, combat_ov05 (#1, #2) | `treasure` item record still missing (#8) |
| inputStarted / Changed / Ended | yes | Pool's text.js (shared) | — |
| anyKeyWait / anyKeyWaitEnded | yes | engine_ov01 | no screen id |
| saveLoaded, gameSaved | yes | engine_ov16 | — |
| **npcLeft** | **Curse-new (PER-8)** | ECL op 3E DUMP | a script removes an NPC from the party |
| **bigPicShown** | **Curse-new (PER-8)** | view_ov29 LoadBigPic | the 304×120 2D backdrops (Curse has no BACPAC) |
| **characterImported** | **Curse-new (PER-8)** | engine_ov17 Add character | Curse .guy, Pool .cha / save member, Hillsfar .hil |

Seams added to `hooks` (not events): `state.geoPlanes()` / `state.passage()` (#10), `hooks.engine.save/load` (#11),
`safePointWanted` for the explore menu (#12), `hooks.dev` (dev only, #13). Star Command needed no such getters; Pool's
Plus read the engine directly, which the Curse rule ("Plus reads hooks only") forbids.

## 4. What is not done (honest list)

- **S3 click (W3):** not started. `click/` is Pool's code, unmounted. Click-to-travel on the Map is not done either.
- **Original-mode gate:** `acceptance/plus/gate.sh` (off / on) is written; it has **not run**. There is no
  `acceptance/plus/GATE.md` yet. The F12 hint strip sits outside the 320×200 frame, so canvas shots should be
  unaffected, but that is unproven until the gate runs.
- **Headless Plus shots (W13):** shell, Journal, Map, Pedia (PEDIA-3/4), Quests (Q-3/4), all queued on the shared run
  lock (held by StarCommand's release gate from 00:17 MDT).
- **Hillsfar import:** the `characterImported` path exists, but no `.hil` file was available to test it (RUN-2).
- Open requests: #8 (item record in `treasure`: until then the Pedia reveals only the item type), #16 (profile test).
- Not offered in Curse: Mods tab (code present), spell presets, margins.

## 5. Lessons

1. **Put the instruction address in the text event.** With `addr`, Journal and Quests match the exact PRINT by
   `[dataset, block, address]`. They no longer depend on text equality, and they work before the texts are decoded.
   Pool's `textPrinted` should carry it too.
2. **"Plus reads hooks only" costs a few getters, and they are worth it.** Pool's map and helpers read engine modules.
   Curse needed #10 (map planes, passages), #11 (engine save path) and #12 (a safe point). Each is a short seam that
   returns the original value when hooks are off. The rule kept Plus out of the area files, which change per game.
3. **Quests need a decode step, not a Plus step.** S4 skipped quests until FLAGMAP existed. Generated from the decoder
   (not by eye), with a check against the listings, it took about an hour and also found facts the build relies on:
   4CFF is a picture-tint cell, not a bond counter; the finale's 4CFD write bypasses flagSet.
4. **Block-local cells and carried-over cells are traps.** Curse's 4C00..4C1F are cleared on every block load, so the
   Filani visit can only be a mark. 4C21 carries a 1 from Tilverton into the drow raid. A quest table must say which
   cells persist.
5. **Number plus requests in one global sequence.** Two lanes both filed #7; the Foreman renumbered. One sequence per
   project from the start avoids this.
6. **One shared run lock across projects was the critical path.** It kept RAM safe, but one long gate held every
   other project's verification for hours. Proposal: a time limit per lock holder, and a release between gate steps.

## 6. What a third Gold Box game would get for free

Taking Curse as the second data point (Pool + Curse share an engine family):

- **As code, unchanged:** the panel and tabs (`plus.js` minus the tab row), the store, the bus + master switch +
  region registry, `games.js`, the ledgers (`map/ledger.js`, per save slot), `pedia/search.js`, `pedia/pictures.js`
  (the DAX picture format), `map/geo.js` (the GEO format), the mods manager, crisp font, tooltips, overlays, the
  journal import, the quests state machine (`log.js`, with address marks), the ECL assembler pattern.
- **As profile fields:** record layout (`plus.charFields`), VM cells (party count, clock, 3D map), store name, tab
  row, pedia sources (DS table offsets, data groups), quest table module.
- **As per-game work (budget it):** every emit site in the game's VM and area files (≈40 statements), the Pedia
  record readers (character record size, DS tables), a FLAGMAP + QUESTS decode for the quest table, the overland /
  2D layer of the map, the cheat record builder, and click (S3) for the game's own prompts.
- **Recommended before game three:** move the files that are already shared (section 1.1) into RemasterDOSGames'
  shared package. Give `textPrinted` an `addr` in Pool too. Make `flagmap.py` the standard decode step for quests.

## 7. Comparison with Star Command

Star Command is a compiled QuickBASIC game: it emits from ~7 runtime choke points and derives events in hooks.js.
Curse, like Pool, emits at decoded VM opcode sites (one statement each). The Gold Box pair shares far more code
(26 identical files) than Pool and Star Command did (6 files with similarity ≥ 0.90). Both trials found the same
hard-coded `por` identity, and both ran on the same cross-project run lock.
