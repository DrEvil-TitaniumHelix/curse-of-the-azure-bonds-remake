# Changelog

## v0.1.0-alpha (candidate)

First public alpha of the Curse of the Azure Bonds remake, the follow-up title on the Gold Box engine of the Pool of
Radiance remake.

**What plays**
- Titles, the rune-wheel prompt (skipped by default, `?wheel=1`), the top menu, party creation (race, class, alignment,
  rolls, names, icons), adding characters from Curse, Pool of Radiance and Hillsfar files.
- The game's script VM (64 opcodes), the 3D areas, 2D big pictures, the overland map with its blinking party marker,
  shops, temples, camp (memorise, rest), the character sheet, combat, treasure, saves and loads.
- A new game through Tilverton's first scripted fight, treasure, camp, save and reload; the save matches a DOSBox save
  of the same route in every defined byte (`acceptance/integration/RUN-1.md`). The demo and loading a DOSBox save
  (`RUN-2.md`).
- **Gold Box Plus** (F12, the hint line under the game screen; "Play the original game" turns it all off): Status,
  Quests, Journal (cited entries, diary, your own notes and journal text), Pedia, Map (3D automap and the overland
  places), Helpers (crisp font, tooltips, combat log, quick save / autosave; all off by default), Keys, Games, About;
  developer Cheats / Scenario tabs with `?dev=1`.

**Known broken or unverified** (the open rows of `ACCEPTANCE.md`)
- Acceptance is a spot check (screens whose picture is under test: 5 PASS at 0 px, 1 DIFF explained by random state);
  most per-screen rows are NO-REF, verified by trace.
- Later areas, the endgame and Hillsfar import are not verified. The newest Plus parts (quick save / autosave through
  the game's own save routine, the developer cheats and scenarios) are checked by unit tests and one screenshot per tab,
  not yet by long play.

**Bring your own copy**
- Curse of the Azure Bonds **v1.0**: `START.EXE`, `ITEMS`, `GAME.OVR` and the 86 `.DAX` files, checked against
  `game/byoc/manifest-cab-1.0.json`. Other versions are refused. The copy-protection byte of `GAME.OVR` may be either
  the retail value or the common patched value; both are accepted.
