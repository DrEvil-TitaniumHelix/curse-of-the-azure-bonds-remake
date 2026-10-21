# Credits — Curse of the Azure Bonds remake and Gold Box Plus

This project rebuilds *Curse of the Azure Bonds* (SSI, 1989, v1.0) as an HTML5 game from a decode of the original
program. It reads the player's own game files at run time and ships none of them. The Gold Box Plus layer keeps its
own per-feature credit list in `game/plus/CREDITS.md` (shown in the Plus panel under About/Credits). This file covers
the whole project.

## First-party prior work

- **Pool of Radiance remake** (PoolRadianceRE, this project family): the engine (`game/engine`, forked at commit 85fb6d6,
  see game/FORK.md), the BYOC importer, the decode method and tools, and the Gold Box Plus layer this build adapts.
  Every change to the shared engine is listed as a PER-n request in docs/POOL_ENGINE_REQUESTS.md.
- **Star Command remake** (StarCommandRE): the second Plus implementation, its trial report and the shared
  cross-project run lock protocol.
- **Turbo Pascal runtime identification method:** a census of every far call into the runtime segments (MZ
  relocations and overlay fixups), followed by a shape match of each entry's first instructions against the runtime
  routines already verified in the Pool of Radiance decode (`decode/tools/rtcensus.py`, decode/LAYOUT.md). It names the
  Turbo Pascal runtime routines from the program's own bytes. No runtime source was copied. The Turbo Pascal 5.x
  overlay format (TPOV) reader `decode/tools/tpovl.py` extends the FBOV (TP 6.0) reader from the Pool decode.

## Cross-check oracle (no code or data copied)

- **simeonpilgrim/coab** (github.com/simeonpilgrim/coab): a C# reimplementation of this game. It was used only as a
  cross-check oracle while decoding: where our reading of the original listings disagreed with it, we went back to the
  original bytes (ECL_VM.md §9 records what was compared). No code, names or data were copied from it. It has no licence
  file, and its repository ships original data files, which this project does not use.

## Feature list

- **Gold Box Companion** (gbc.zorbus.net, closed freeware for the v1.3 DOS games): the list of quality-of-life features
  Plus works from (automap, quick saves, notes, helpers). Its feature list was the target; none of its code was used.

## Model for the Plus layer

- **Darklands+** by bouchacha (github.com/bouchacha/Darklands-plus, MIT licence): the model for the whole Plus idea. It
  provided the F12 window with tabs and a single "play the original" switch, the event hooks with read-only state, the
  automatic diary and battle log, the mod folder model, and the right-click menus. Gold Box Plus follows these designs
  (the feature-by-feature table is in `game/plus/CREDITS.md`). No Darklands+ source was copied.

## Run-time third-party code

- **Mozilla PDF.js** (Apache-2.0), loaded on demand only when players import their own *Adventurer's Journal* PDF
  (details in `game/plus/CREDITS.md`).

## The game

*Curse of the Azure Bonds* © 1989 Strategic Simulations, Inc. All rights to the game, its names, texts, pictures and
the printed *Adventurer's Journal* remain with SSI's rights holders. This project ships none of them. The build runs
only from files players import from their own copy (BYOC, v1.0).
