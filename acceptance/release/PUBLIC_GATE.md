# PUBLIC GATE — Curse of the Azure Bonds remake, release candidate v0.1.0-alpha (cab-release, 2026-10-21)

**Result: PASS** (game gate) · **PASS** (personal-data gate) · candidate **not published** (the Foreman publishes).

## Candidate
- Path: `../CurseAzureBondsRE-public` (next to this repo), built by `python -I tools/make_public_repo.py --replace` from
  this repo's HEAD, i.e. the commit that adds this report (committed content only; the shared work tree's uncommitted
  files never enter).
- **541 files** at the last build (538 kept of 896 tracked + 3 public templates: README.md, CHANGELOG.md,
  .personal-gate-allow): game 250, acceptance 182, decode 92, docs 4, tools 5, top level 8. The count follows HEAD
  (other lanes keep adding acceptance reports); the exact numbers of a build are in its `.git/public_gate.json`.
- **Fresh history: 1 commit**, author and committer `DrEvil <…+DrEvil-TitaniumHelix@users.noreply.github.com>`
  (RELEASE.md rule 1), annotated tag **v0.1.0-alpha** (local). No remote; nothing pushed. Clean work tree.
- Kept (PR-2 A): the engine and the Curse adapters, the BYOC importer and manifest, Gold Box Plus, the area translations,
  the profile, the pseudocode and specs (`decode/pseudo`, `decode/data/*.md`, `decode/ecl/*.md`, the ECL `INDEX` and
  `FLAGMAP` tables, names, `GLOBALS.md`, `LAYOUT.md`, `ENGINE_DELTA.md`), the decode tools, the acceptance tools and
  reports, the docs.
- Removed: every original byte and direct extract: DAX / EXE / OVR / save files and every binary or render by
  extension, `decode/listings` (raw code bytes), the ECL script listings `decode/ecl/scripts/*.ecl.txt` (the game's
  texts), `decode/bin`, `decode/rt`, `decode/data/png`, the DOSBox reference captures `acceptance/ref`, `acceptance/local`,
  the code-wheel tool, Pool's scenario samples, the lane files (`herdr/`, STATUS, FOREMAN, RULINGS) and the local launcher.
- **Scrub pass** (candidate only, this repo unchanged): 34 replacements in 13 files. Workspace paths become relative or
  `$HOME`; the owner's own names become "the owner" through a private list outside every repo.

## Game gate (`python -I tools/public_gate.py ../CurseAzureBondsRE-public`)
Compared against the player's v1.0 folder: 920 byte sources (2,704,768 B: every file and every decoded DAX record),
109,178 indexed windows, 2,167 forbidden hashes (originals, records, workspace renders / extracts, the BYOC manifest).

| check | what fails | found |
|---|---|---|
| (p) PATH | forbidden path or file type in any commit | **0** |
| (h) HASH | a blob equal to an original file, a DAX record, a workspace render / extract, a manifest hash | **0** |
| (b) BYTES | a binary run of ≥ 31 bytes from the originals | **0** |
| (x) HEXDUMP | a hex dump of ≥ 32 bytes from the originals | **0** |
| (L) LARGE | a binary blob over 4 KiB | **0** |
| (e) SECRET | e-mail (other than noreply), token, private key, user path | **0** |
| (j) JOURNAL | CR-1 A: journal file or numbered journal-entry prose | **0** |
| (t) TEXT, report only | printable runs ≥ 31 B from the originals: quoted game / runtime strings in pseudocode and code (PR-2 A) | 408 in 59 files (decode/pseudo 261, game/areas 57, GLOBALS 28, decode/ecl 19, LAYOUT 11, game/engine 11, others) |
| (s) SHORTHEX, report only | hex dumps of 16..31 bytes found in the originals | 3 (COMBAT.pas.md 2, RESIDENT.pas.md 1; 16-byte matches) |

541 blobs, about 5.71 MB, 1 commit. Full report: `.git/public_gate.json` in the candidate (paths, offsets, lengths only).

## Personal-data gate (`python -I ../RemasterDOSGames/tools/personal_gate.py ../CurseAzureBondsRE-public`)
**0 hits → PASS** (generic + the owner's private patterns). `.personal-gate-allow` lists the game's own text that
matches a pattern, each with its reason: the combat prompt "Attack Ally", the VM cell name "ally-attacked", the
combat-screen notes on choosing a friendly target; and the two release tools, which name the path patterns they look for.

## Checks in the candidate
- `python -I tools/serve.py 8192 --player`: index.html, the engine, Plus, the manifest, the profile and the importer UI
  are served (200); `/devdata/` and `/data/` are not (404). The game reads only what the player imports.
- Unit tests `node --test` on all 30 test files: **122 pass, 3 skipped, 3 fail**. All 3 fail because the tests read the
  ECL script listings, which stay private:
  - `game/test/plus/hooks_cab.test.mjs`: 1 test (the 46 journal sites, texts from the listings): plus request #18.
  - `game/test/plus/quests.test.mjs`: 2 tests (the table text addresses and texts compared with the listings): plus request #19.
  Both should skip without the listings, as `eclasm`, `notes_cab` and `map` already do.
- Note for the owners of `game/engine/input.js` and `game/areas/view_ov14.js`: 4 string literals hold a raw NUL
  character in place of the `'\x00'` escape. It works, but some tools treat the files as binary. Not a gate failure.

## Not done here (Foreman)
Publishing: `release.py publish` / `gh repo create` and the GitHub release are the Foreman's after review (RELEASE.md rule 5).
