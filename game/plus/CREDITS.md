# Gold Box Plus credits

Gold Box Plus for *Curse of the Azure Bonds* is written in JavaScript. It is the Gold Box Plus layer of the Pool of
Radiance project (PoolRadianceRE, `game/plus/`: shell, hooks, store, helpers), forked and adapted for Curse (game/FORK.md).
It borrows designs, never code, from the projects below (ruling GBP-3). No original game file, journal text or asset is
included: players supply their own game (v1.0) and journal.

## Sources for the Curse build

- **Pool of Radiance Gold Box Plus** (this project family): the code base of this layer, adapted, not rewritten.
- **Gold Box Companion** (gbc.zorbus.net, closed freeware): the feature list Plus works from (automap, quick saves, notes,
  helpers). Inspiration only; nothing copied.
- **simeonpilgrim/coab** (github.com/simeonpilgrim/coab, a C# port of the Gold Box engine for Curse): used only as a
  cross-check oracle while decoding the original program. No code copied; every decode is from the original listings.

## Darklands+ (MIT licence, © the Darklands+ contributors)

Darklands+ allows copying with credit; Gold Box Plus copied **no source file or code**. These Darklands+ files were the
design references, feature by feature:

| Gold Box Plus feature | Darklands+ design reference |
|---|---|
| F12 window, tabs, Helpers settings, "Play the original game" switch (`plus.js`, `tabs/`) | `port/ui/settings.cpp`, `port/ui/uitabs.h` |
| Event bus, read-only state access, mouse regions, one master switch (`hooks.js`, `docs/PLUS_HOOKS.md`) | `port/runtime/hooks.c`, `docs/NATIVE_SCREENS.md` |
| Automatic diary and quest/battle journal (`notes/`, `tabs/journal.js`) | `port/ui/quests.cpp`, `port/ui/battlelog.cpp` |
| Mods: folder model, stack order, original files untouched (`mods/`, `docs/MODDING.md`) | `docs/MODDING.md`, `port/mods/datamods.c` |
| Right-click menus and information under the pointer (`click/`) | the Darklands+ right-click menu bar and battle info under the pointer (`port/ui/`) |
| Helpers: combat log, tooltips, margins, crisp font (`helpers/`) | the Darklands+ helper feature list (`port/ui/battlelog.cpp`, battle log; its margins and high-resolution text helpers by name only) |

Darklands+ licence: MIT, see its `LICENSE` ("Copyright (c) 2026 the Darklands+ contributors").

## Inspiration and design references only (no code, no assets)

- **Dungeon Craft / uaf** (GPL-2.0): editor design and data knowledge only. No code copied (GPL code would not fit this
  MIT project).
- **Forgotten Realms Unlimited Adventures** (SSI, commercial): scenario editor design reference only. No code or assets.

## Third-party code used at run time

- **Mozilla PDF.js** 6.4.299 (Apache-2.0), loaded on demand from jsDelivr only when the player imports their own
  *Adventurer's Journal* PDF (`journal/import.js`). Project: https://github.com/mozilla/pdf.js · licence:
  https://github.com/mozilla/pdf.js/blob/v6.4.299/LICENSE . The PDF stays in the browser.

## The game

*Curse of the Azure Bonds* © 1989 Strategic Simulations, Inc.; all rights to the game, its names and its texts stay with SSI's
rights holders. Gold Box Plus reads the player's own copy at run time and shows the game's texts from it; it ships none.
