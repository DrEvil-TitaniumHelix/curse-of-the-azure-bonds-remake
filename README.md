# Curse of the Azure Bonds (SSI, 1989) in the browser

A rebuild of **Curse of the Azure Bonds** (Strategic Simulations, Inc., 1989, the second Advanced Dungeons & Dragons
"Gold Box" game) that runs in a web browser. It is the **follow-up title on the Gold Box engine**: the engine itself was
decoded once, for the [Pool of Radiance remake](https://github.com/DrEvil-TitaniumHelix/pool-of-radiance-remake), and
this game reuses that work. Its own decode covers only what Curse changed: a Turbo Pascal 5 build with a different
overlay format, a script VM with 64 opcodes (three new ones and a copy-protection opcode), a 422-byte character record,
new saves, Pool of Radiance and Hillsfar character import, new screens. Every changed routine was turned into pseudocode
and translated into JavaScript ([decode/ENGINE_DELTA.md](decode/ENGINE_DELTA.md) lists what was reused and what is new).
Status: **alpha (v0.1.1-alpha)**: the game plus **Gold Box Plus**, optional modern additions (F12) around the unchanged
original; ready for community testing. Point release 0.1.1 accepts **version 1.3** of the game as well as 1.0.

**Bring your own copy.** This repository contains none of the game's files: no program, data, graphics, sound or journal
text. You need your own copy of Curse of the Azure Bonds, **version 1.0 or 1.3**; the browser checks it and plays from it on
your machine. Contains no original game files; derived from analysis of the original program, not clean-room. All
rights to the game stay with its publisher and rights holders.

- [Play](#play) · [Gold Box Plus](#gold-box-plus-optional-additions) · [Modify](#modify) · [Decode](#decode) · [Credits and licence](#credits-and-licence)

## Play

**What you need:** your own copy of *Curse of the Azure Bonds* (SSI), **version 1.0 or 1.3**: the game folder with
`START.EXE` (v1.0) or `ST.EXE` (v1.3), `ITEMS`, `GAME.OVR` and the 86 `.DAX` files (a `SAVE` folder with your old saves is
welcome but optional). The browser checks your files against `game/byoc/manifest-cab-1.0.json` or `manifest-cab-1.3.json`
(sizes + SHA-256), picks the version that matches and keeps the files in its own storage. **Version 1.3** is the one on the
WizardWorks *AD&D Gold Collector* CD (GOG also sells 1.3): its `ST.EXE` is stored as shipped and unpacked when the game
starts, and the game plays v1.3's own scripts, maps and the handful of rule fixes SSI made in that release (the copy
protection stays off by default). Other versions, folders mixed from two versions and other games' folders are refused
with a clear message. Store releases are untested; if yours is refused, open an issue with the importer's list of mismatched files (names only). A current Chrome
or Edge is recommended (folder picker); other browsers can pick or drop the files instead.

**Start:**
1. Get the game: clone this repository, or download the release zip from its *Releases* page and unpack it.
2. Serve the `game/` folder over HTTP: `python -I tools/serve.py 8189 --player` (any static web server works).
3. Open http://localhost:8189/index.html.
4. **First start:** the import screen asks for the game folder: *Choose folder*, *Choose files…*, or drop the folder onto
   the page. The files are checked, stored, and the game starts. From then on it starts directly. If the browser cannot
   store them (private window, blocked site data), the game can still run for this tab only.

**Where things live (in the browser profile, per site):** the game files in IndexedDB `cab-data`, your saves (the
game's save directory: slots A-J and character files) in IndexedDB `cab-save`, the Plus notes and settings in
`cab-plus`. The gear button (top right, outside the game screen) shows the imported version, re-imports or removes the
game files, and exports / imports saves as a zip (with your Plus notes). Removing the game files never touches the
saves. Nothing is uploaded.

**Controls:**
- Keyboard as in the original: cursor keys move / turn, the highlighted letters choose menu entries, Enter, Esc,
  Home / End select the previous / next party member and move through lists, Ctrl-S sound on/off.
- Gamepad: d-pad = cursor keys, A = Enter, B = Esc, Menu = the Plus panel.
- Mouse (an addition; it only types the keys above): menu words, list items, party members, the 3D view.
- The rune-wheel copy protection is skipped (`?wheel=1` shows it).

**Characters from earlier games:** Add Character imports Curse `.GUY` files, Pool of Radiance characters (`.CHA` and
Pool saved-game members) and Hillsfar characters, as the original does. Hillsfar import is untested (no Hillsfar file
was available).

**Known alpha limitations** (from `ACCEPTANCE.md`):
- Acceptance follows a spot-check standard: the screens whose picture is under test are compared pixel for pixel with
  the original running in DOSBox-X (5 PASS at 0 differing pixels, 1 DIFF explained by random state); the rest of the
  logic is verified by trace. Rows without a reference are marked NO-REF.
- The full new-game chain (titles, party creation, first area, a scripted fight, treasure, camp, save, reload) plays
  through; the saved game matches a DOSBox save of the same route in every defined byte (`acceptance/integration/RUN-1.md`).
- Not verified yet: most later areas and the endgame, Hillsfar import, rare combat messages.
- Where the original reads uninitialised memory or a random state, the build uses a fixed or seeded value.

**Report a problem:** open an issue in this repository: name the **screen** (what it shows, or its id from
`ACCEPTANCE.md`), attach your saves (gear button, export saves), and say which **browser** and version. If the original
game does the same, say so: such reports get the "original did this too" label.

## Gold Box Plus (optional additions)

Gold Box Plus adds modern conveniences around the original game **without changing it**: the engine stays pixel-exact
and only reports what happens; the additions listen, show their own panels and type the original keys.

**Open it:** press **F12** (a line under the game screen says so the whole time you play), click the **⚙ Plus** button
next to that line, or press the gamepad's **Menu** button. While the panel is open the game waits; **Esc** closes it.
The hint line sits outside the 320×200 game picture, never over it.

**"Play the original game"** (Helpers tab) switches every addition off at once, the hint line included: the screen and
the controls are exactly the original's. Your helper choices are kept for later.

**Tabs:**
- **Status**: save slot, place (script area, 3D map square and facing, or the overland place), game time, party.
- **Quests**: the bonds and the other quests the scripts record, with their state, named with the game's own text read
  from your files.
- **Journal**: every journal entry the game has told you to read, with when and where it did and the line it printed;
  an automatic diary (places, talks, fights, treasure) and your own notes. **Adventurer's Journal:** paste the text of
  an entry or import your own journal PDF; an entry is shown only after the game has pointed you to it. No journal text
  is included; yours stays in your browser.
- **Pedia** (Gold Box-pedia): monsters, people, places, items and spells from your files, each revealed only after you
  have met, visited or seen it.
- **Map**: an automap of the current 3D area from the game's map data (visited squares only, party marker), and the
  overland picture with the places you have been.
- **Helpers**, **Keys** (the keys of the current screen), **Games**, **About/Credits**.

**Helpers** (all off until you turn them on): crisp font · tooltips on names (pedia entries you have revealed) · combat
log panel · quick save **F5** / quick load **F9** and autosave on area entry (Plus slots outside your A-J).

**Developer tools** (`?dev=1` only): the **Cheats** tab (party from a spec through the game's own creation rules, HP /
gold / levels, teleport, clock, script flags) and the **Scenario** tab; `?scenario=<name>` starts a scenario JSON from
`game/plus/scenario/data/`. Scenario files may carry their own event scripts as listings, assembled by
`game/plus/scenario/eclasm.js`.

**Documentation:** [docs/PLUS_HOOKS.md](docs/PLUS_HOOKS.md) (events and state for additions),
[game/plus/CREDITS.md](game/plus/CREDITS.md), [CHANGELOG.md](CHANGELOG.md).

## Modify

- **Engine** (`game/engine/`): shared with the Pool of Radiance remake (forked, see [game/FORK.md](game/FORK.md)): display
  (EGA 320×200), DAX files and pictures, text, input, Turbo Pascal semantics, files and saves, the importer. The Curse
  boot and adapters are `main_cab.js`, `ecl_cab.js` (the script VM), `menus_cab.js`, `audio_cab.js`, `tiles_cab.js`;
  every change to a shared file is a profile parameter or a request listed in
  [docs/POOL_ENGINE_REQUESTS.md](docs/POOL_ENGINE_REQUESTS.md). The game profile is `game/profiles/cab.json`.
- **Game logic** (`game/areas/`): one file per original overlay (`view_ov14.js`, `combat_ov13.js`, `party_ov24.js` …);
  every routine carries the `seg:off` address of the original routine it translates, so each line traces back to
  `decode/pseudo/`. Changing a rule or a screen is an edit here.
- **Gold Box Plus** (`game/plus/`): the panel, the hooks layer (`hooks.js`) and one folder per feature.
- **Acceptance** ([ACCEPTANCE.md](ACCEPTANCE.md)): per-row verdicts and the spot-check rows, per-shot reports in
  `acceptance/reports/`. Screenshots are not committed (they show the original's art). Unit tests: `game/test/`
  (`node --test`); tests that compare against your own copy read it from `CAB_DATA` and skip without it.

## Decode

`decode/` holds what the build was made from: `pseudo/` (pseudocode of every translated routine, with addresses),
`data/` (file formats: DAX, pictures, GEO maps, items, monsters, saves), `ecl/` (the script VM, its differences from
Pool of Radiance, the journal citations and quest cells), `names/`, `GLOBALS.md`, `LAYOUT.md` and the tools that read the
original files (`decode/tools/`). The disassembly listings and the script listings are not included: they contain the
original program's bytes and texts. Evidence rule: every statement cites the original address it was read from.

Built with [Remaster DOS Games](https://github.com/DrEvil-TitaniumHelix/remaster-dos-games), method version v0.1.0.

## Credits and licence

*Curse of the Azure Bonds* was made by **Strategic Simulations, Inc.** (1989). All rights to the game, its names, texts,
pictures and the printed *Adventurer's Journal* remain with SSI's rights holders. This repository ships none of them.

Remake by **DrEvil**. The engine, importer and decode method come from the Pool of Radiance remake. Cross-check
oracle, feature list and design models: [docs/CREDITS.md](docs/CREDITS.md) and [game/plus/CREDITS.md](game/plus/CREDITS.md).

Licence: the code of this repository is MIT; the documentation and decode notes are CC BY 4.0. Both cover our own work
only, never the original game.

Disclaimer: all or part of this repository may have been written or edited by super intelligence.
