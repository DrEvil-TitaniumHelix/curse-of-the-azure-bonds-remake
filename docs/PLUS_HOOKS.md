# Gold Box Plus hooks (W1 / S1) — Curse of the Azure Bonds — `game/plus/hooks.js`

The contract is Pool's (`PoolRadianceRE/docs/PLUS_HOOKS.md`, RemasterDOSGames `docs/PLUS_LAYER.md` §2): the engine
(`game/engine`, `game/areas`) stays pixel-exact and only **emits** events (one statement per site, payload built by a thunk
that runs only when somebody listens). Plus (`game/plus/*`) listens, reads state through `hooks.state`, registers regions,
and never writes game state through this layer. This file lists the **Curse** emit sites. The API (bus, master switch,
regions, warp/redraw entry, DAX resolver, `?hooklog=1`) is unchanged from Pool and is documented there. Owner:
cab-build-engine (hooks.js, main_cab.js, index.html, the ENGINE units and the VM); area files belong to cab-build-areas,
whose sites are requested as `plus request #n` (STATUS.md).

## 0. What is Curse-specific
- **PER-8:** three Curse-new events (`npcLeft`, `bigPicShown`, `characterImported`); the journal parser also handles the
  Curse split forms (below); `journalRef` carries the citing address.
- **Profile parameters** (`game/profiles/cab.json` → `"plus"`, applied by `hooks.configure` in main_cab.js): the 422-byte
  character record (race 74h, class 75h, levels 109h, hp 1A4h, hp max 78h, AC 19Ah, THAC0 199h, status 195h, side 197h,
  NPC F7h, XP 127h, money FBh), the party list head `G.PartyList`, and the VM cells party count **7F3E**, clock
  **4BC6..4BCC** and 3D map **4BC5** (Pool: 6E3E / 49C6 / 49C5). The defaults in hooks.js stay Pool's.
- **Mounted** by main_cab.js after the BYOC gear (plus request #5, shell by lane cab-plus-shell): hooks on by default;
  `?plus=0` or the setting "Play the original game" = hooks off. `?hooklog=1` = the event log (`window.__hookLog`).

## 1. Events (Curse sites)
Address = the decoded statement next to the call site. "Pool" = same event and payload shape as Pool; "Curse" = new or
changed.

| event | payload | site (file, address) | fires | |
|---|---|---|---|---|
| `textPrinted` | `{ text, window: 'text', clear, source, addr, block, dataset, fg, bg }`. source `PRINT` / `PRINTCLEAR` / `VERTICAL_MENU` / `ENCOUNTER`. `addr` = the ECL instruction's VM address | ecl_cab.js op11/12 2200:0a29, op15 VERTICAL MENU 2200:0f92ff, op29 ENCOUNTER MENU (before DrawWrappedText of the approach text) | when an ECL text is about to be drawn into the text window by `DrawWrappedText(1, 11h, 26h, 16h, fg 0Ah, bg 0, clear, s)` | Pool + `addr/block/dataset/fg/bg` |
| `journalRef` | `{ n, kind: 'entry', text, source, addr, block, dataset, scene, clock }`. `scene` = the last cleared text, `clock` = 'hh:mm' | derived in hooks.js from `textPrinted` | for every journal entry the printed text cites. All 46 sites of decode/ecl/JOURNAL_REFS.md are covered: one PRINT ("... AS JOURNAL ENTRY 22."), the shared subroutine " AND YOU RECORD IT IN JOURNAL ENTRY " + the caller's number, the ECL1/80 9A7C table number (24 / 35 / 42), and the split "... AS JOURNAL " + "ENTRY 30." (ECL2/2 852D, ECL4/34 81F1, ECL5/50 8C12). Test: game/test/plus/hooks_cab.test.mjs | Curse (PER-8) |
| `areaEntered` | position (below) + `source`: `GAMELOOP` (new game / load), `DEMO`, `NEWECL` | ecl_cab.js gameLoop 2200:382a and runAfterNewBlock 2200:36d5, each right before `run(VecE)`, i.e. after LoadEclBlock 2C00:0380 | once per block entry, before the block's init script | Pool (+ DEMO) |
| `flagSet` | `{ addr, value, old, region, pc }`. region 0 = VM 4B00.., 1 = 7C00.. (character fields mapped), 2 = 7A00.., 3 = code 8000.., 4 = engine cells (C04B position etc.) | ecl_cab.js setMem (wrapper) around setMemRaw = ecl_SetMem 2C00:0D70 | after every ECL memory write (regions 0..2 are the script flags; 3 and 4 are reported as in Pool) | Pool + `pc` |
| `monsterShown` | `{ id, dataset, name, pic, count, slot, ref: { dax: 'MON<ds>CHA', record }, icon: { dax: 'CPIC<ds>', record } }` (the records are tagged in a WeakMap, so later summaries carry `monsterId`) | ecl_cab.js op0B LOAD MONSTER, after the copies are appended | per LOAD MONSTER | Pool |
| `pictureShown` | `{ pic, dataset }` (ECL PICTURE); area: `{ kind: 'animation' \| 'portrait', ... }` | ecl_cab.js op0E 2200:0841; view_ov29.js (cab-build-areas) | when a picture / portrait is shown | Pool |
| `bigPicShown` | `{ id }` (BIGPIC 120..123, the 304×120 2D backdrops) | view_ov29.js:143 (cab-build-areas) | when a 2D backdrop is loaded | Curse (PER-8) |
| `npcTalk` | encounter `{ kind: 'encounter', text, choice: COMBAT/WAIT/FLEE/ADVANCE/PARLAY, distance, sprite, pic, dataset }`; parlay `{ kind: 'parlay', choice: HAUGHTY/SLY/NICE/MEEK/ABUSIVE, result }` | ecl_cab.js op29 ENCOUNTER MENU (after MenuSelect), op2C PARLAY 2200:27A8 | after each choice | Pool |
| `npcLeft` | char summary of the member that leaves + `{ block, addr }` | ecl_cab.js op3E DUMP 2200:3250, right before RemovePartyMember(0, 1) (which drops SelectedChar) | when a script drops an NPC | Curse (PER-8) |
| `combatStart` | `{ monsters: [char summary], partyCount, block, x, y }` | ecl_cab.js op24 COMBAT, before CombatMain (its only caller) | per fight | Pool |
| `combatEnd` | `{ partyDead, party: [char summary] }` | ecl_cab.js op24 after AfterCombat | after the result / XP / treasure screens. TODO(decode): the Curse cell of Pool's result code 6DC7 | Pool (payload smaller) |
| `combatTurn`, `combatCursor` | as Pool | magic_ov08.js, combat_ov13.js (cab-build-areas) | | Pool |
| `moved` | `{ x, y, facing, block }` | view_ov14.js StepForward 3f00:08f7 (cab-build-areas); turns: plus request #3 | after every step | Pool |
| `menuDrawn` / `listDrawn` | as Pool | menus_cab.js HorizontalMenu, view_ov26.js VerticalListMenu | when a menu / list starts waiting | Pool |
| `viewDrawn` | as Pool | view_ov30.js 3D view / area map | after the view is drawn | Pool |
| `partyDrawn` | as Pool | plus request #1 (party_ov24.js PartySummary 6200:0795) | every roster draw | pending |
| `treasure` | as Pool | plus request #2 (combat_ov05.js TreasureMenu 2900:1086) | when the treasure menu opens | pending |
| `inputStarted` / `inputChanged` / `inputEnded` | as Pool | text.js ReadBottomLine 0542:0722 (0542:076e / 0832 / 084a) | line prompts (names, ECL INPUT STRING / NUMBER) | Pool |
| `anyKeyWait` / `anyKeyWaitEnded` | `{ seconds }` | engine_ov01.js WaitSecondsOrKey 2100:0000 (titles, credits) | when a title / credits screen starts / stops waiting | Pool (no screen id) |
| `saveLoaded` | `{ slot, members: [names], dataset }` (sets `hooks.state.slot`) | engine_ov16.js LoadGame, end (4300:3d2f) | after a saved game A..J was read | Pool |
| `gameSaved` | `{ slot, members }` | engine_ov16.js SaveGame after GameSaved := 1 (4300:43f7) | after a game was saved | Pool |
| `characterImported` | `{ source: 0 \| 1 \| 2, from: 'curse' \| 'pool' \| 'hillsfar', file, ...char summary }` | engine_ov17_edit.js Add a character, after ReadCharacter 4800:37e3 | a character file was read for Add (Curse .guy, Pool .cha / saved-game member, Hillsfar .hil; ConvertPoolCharacter / ApplyHillsfarMinimums done), before the party checks | Curse (PER-8) |

Not reported, as in Pool: the engine's fixed texts (`Both sides wait.`, combat messages, `Loading...Please Wait`). The
plain `DrawText` / `DrawWrappedText` primitives draw menus, rosters and status lines as well, which are covered by
`menuDrawn` / `listDrawn` / `partyDrawn`. Hooking the primitives themselves would report every glyph run, so the
`textPrinted` sites are their ECL text-window callers.

## 2. State (read-only)
Bound by `areas/ecl_host.js bindEclHost` (`hooks.bind({ G, vm })`). Same calls as Pool: `party()`, `partyCount()`
(VM 7F3E), `position()` `{ block, dataset, x, y, facing, dir, travelMode, gameMode, map3d (VM 4BC5), is3D (VM 4BE6) }`,
`mem(a)` / `flag(a)` (ecl_GetMem 2C00:0F3A, no side effects), `clock()` (VM 4BC6..4BCC), `slot`, `combat()`,
`combatant(c)`.

## 3. Proof
- `node --test game/test/plus/hooks.test.mjs game/test/plus/hooks_cab.test.mjs`: Pool's bus / switch / regions / state
  tests with the Pool defaults, plus the Curse tests (46 journal sites, the cab.json layout, PER-8 events).
- `node game/test/ecl/run.mjs`: the VM harness with the hooks on (every handler once): PASS.
- Event log of the RUN-1 route: `sh acceptance/plus/hooklog.sh <name> <keys>` (`acceptance/plus/HOOKS-LOG.md`).
- Original mode: `acceptance/plus/GATE.md`.
