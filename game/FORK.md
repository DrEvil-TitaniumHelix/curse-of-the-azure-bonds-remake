# game/ — fork of Pool of Radiance's engine (BUILD_PLAN.md §1a)

- **Pin:** `PoolRadianceRE` commit **85fb6d6** (2026-10-20, "v0.2.0-alpha PUBLISHED"), copied 2026-10-20 by cab-build-engine
  with `git archive 85fb6d6 game tools/serve.py tools/gen_globals.py`.
- **Copied:** `engine/`, `byoc/` (without `manifest-por-1.3.json`), `plus/`, `profiles/` (PORONLY.md, README.md; `por.json`
  left out: the catalog of this build is `cab.json`), `state/` (regenerated for Curse), `mods/`, `scenarios/`, `index.html`,
  `test/byoc`, `test/byoc-ui`, `test/ecl`, `test/profiles`, `test/plus`; `tools/serve.py`, `tools/gen_globals.py`.
- **Not copied:** `areas/` (Pool's area files are the model for structure only; read them in PoolRadianceRE at the pin),
  `assets/saves` (Pool test saves), `test/{combat,magic,party,res00ba,view}` (Pool area tests).
- **Rule (no silent fork):** every change to a copied file under `engine/`, `byoc/`, `plus/` is either a profile parameter
  (`profiles/cab.json`, marked `// cab: param`) or a Pool engine request, marked `// cab: PER-n` and listed in
  `docs/POOL_ENGINE_REQUESTS.md`. `grep -rn "cab: " game/engine game/byoc game/plus` lists them all.
- **Curse adapter modules** (engine.id `cab-1.0`, new files, not Pool's): `engine/main_cab.js` (boot), `engine/audio_cab.js`
  (res_0713), `engine/menus_cab.js` (ov26), `engine/tiles_cab.js` (ov33), `engine/ecl_cab.js` (ECL VM, M2).
- Re-sync with Pool is a deliberate step (O-4), never automatic.
