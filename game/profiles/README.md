# Game profiles

`por.json` describes the supported Pool of Radiance v1.3 decode. It contains metadata and file names, not game bytes. The referenced BYOC manifest is authoritative for required/optional files, sizes and hashes; `manifest.files` includes optional GAME.OVR as well as the 115 required files. All URLs inside a profile are relative to that profile file. Documentation source paths are relative to the repository root.

`recordSizes`, `saveFormat`, `ecl` and `daxGroups` describe the existing decode. `areas` preserves the names and candidate qualifications from the verified ECL index; dataset plus block identifies a script. Blocks 8, 11 and 19 have no GEO record. GEO-only shared maps 30–32 are not invented as additional event scripts. `questTable.entries` is intentionally empty pending W5. Pedia sources identify the player's data to read; MONnSPC is active effects, while spell definitions and names come from the unpacked START.EXE DS image.

`engine` describes the Pool-specific adapter, state image, font, storage names and configuration. It does not imply that changing JSON can execute a sequel: each sequel needs its own decoded engine adapter. PORONLY.md inventories current boundaries for the hooks lane; existing constants stay authoritative until that lane integrates the profile.

The static-host catalog is `PROFILE_URLS` in `plus/games.js`. Add each new profile JSON there; the tests compare the catalog against every JSON in this directory, preventing omitted games without requiring server directory listings or a bundler. Use a distinct profile id, manifest and save-format id. Do not share saves between incompatible decodes.

Boot integration (gbp-hooks owns engine edits):

```js
const games = await import('../plus/games.js');
const profile = await games.chooseProfile(); // waits for Start if ?profile is absent
const manifestURL = games.profileResource(profile, profile.manifest.url);
// fetch manifestURL and pass the parsed manifest to byoc.setManifest before openGameFiles
// retain the chosen profile for Plus scope, and invoke the matching decoded adapter
```

`chooseProfile({id:'por'})` loads explicitly and rejects unknown/unsupported ids. It never silently falls back to another game. A missing id shows Games and resolves only after Start. Existing acceptance/launcher URLs should select `profile=por` when automatic boot is required. `registerGamesTab(plus)` installs the same selector in Plus; its Start action navigates with `?profile=<id>` and retains the existing URL options. A caller may supply `onStart(profile)` instead. There are no automatic imports or state mutations on module load.

Validation: `node --test game/test/profiles/*.test.mjs`.
