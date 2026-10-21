# Changelog

## v0.1.1-alpha (candidate)

Point release: **Curse of the Azure Bonds v1.3 is accepted** next to v1.0 (the WizardWorks / AD&D Collectors CD copy;
GOG also sells 1.3). The decode of the version delta is `decode/V13_DELTA.md`; the offset map `decode/v13/v13_offsets.json`.

**Bring your own copy**
- The importer knows two manifests (`game/byoc/manifest-cab-1.0.json`, `manifest-cab-1.3.json`) and accepts the one that
  matches the whole folder; it names the version it recognised. v1.3's `ST.EXE` (Microsoft EXEPACK) is stored as shipped
  and unpacked at start; its `GAME.OVR` is checked (the rune-wheel byte at 0x4A9C, retail or patched) and not stored.
  Folders mixed from two versions, other versions and other games are refused.
- Saves on the CD (`SAVE/`) import like the player's own.

**What changes when a v1.3 copy is imported** (profile overlay `game/profiles/cab-1.3.json`, all behind the version switch;
v1.0 is unchanged)
- The game's data tables are read from the v1.3 image (its DS layout differs from v1.0 by a constant; a two-range map).
- The sound driver of v1.3 (segment 0699, 3-byte note lists as in Pool of Radiance, notes on channel 0 only).
- SSI's v1.3 rule fixes: the stone gaze picks its victim through the target selector and the paralysing gaze uses the
  magic unit's handler; Haste / Slow no longer runs an extra effect hook per target; the Memorize / Scribe spell list is
  sorted by level the v1.3 way; a list menu that fits its window starts at the top; a finished game can be loaded again
  (v1.0 quit with "You've already defeated Tyranthraxus."), while Begin is refused for it; the Pool of Radiance import
  clamps Strength where v1.0 clamped the Charisma maximum.
- v1.3's own scripts and maps (ECL1/3/4/5, GEO4) play as shipped: the Dagger Falls reward continues into the right block,
  wilderness exits and the party position after a wilderness return are guarded, one door in GEO4 is on the right side.
- The CD ships the rune-wheel copy protection enabled; the build still skips the wheel by default (`?wheel=1` shows it).

**Unchanged for v1.0 owners:** the 142 unit tests and the four logic-trace routes (RUN-1 / RUN-2, plain node, text and
memory-write checks against the decoded scripts) give the same results as v0.1.0-alpha.

## v0.1.0-alpha

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
