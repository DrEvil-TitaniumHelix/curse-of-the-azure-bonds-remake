# Pool engine requests (PER-n) — changes the shared engine needs to carry both games (BUILD_PLAN.md §1a, §2b)

Owner: cab-build-engine. Each request is carried in the Curse fork (`game/`, pinned at Pool 85fb6d6) and marked
`// cab: PER-n` at every changed line (`grep -rn "cab: PER-" game/`). Status: **carried** = in the Curse copy, not yet
offered to the Pool foreman; **offered** = mirrored as a STATUS note in PoolRadianceRE; **accepted** = merged in Pool.

| id | file(s) | change | why both games need it | status |
|---|---|---|---|---|
| PER-1 | `engine/tp.js` | `randomReal()` = RandSeed/2^32 after @NextRandom (TP 0A54:111B, exact); TP 5 runtime noted (same LCG; seed location is storage only) | Curse ov18 uses Random without argument | carried |
| PER-2 | `engine/text.js` | every text routine takes `bg` after `fg` (Pool callers pass 0); 01A0 frame layouts as routines over DS tables; MessageDelay factor (Curse 100, Pool 225); ReadBottomLine ends in demo mode; DrawWrappedText flushes keys after "Press any key" | resident note #1; frames are per-game layouts | carried (Curse values hard-wired; Pool needs the factor/flags as parameters) |
| PER-3 | `engine/ecl.js` → `engine/ecl_cab.js` | the Curse VM as an adapter module beside Pool's ecl.js (same class shape: decoder, memory, handlers, loops; host by decode names); the shared core split (operand decoder, 6-bit text, gosub, flags, skip) is the proposed merge step | 61 shared opcodes, map shift, 3 new ops | carried (new file; Pool's ecl.js unchanged) |
| PER-4 | `engine/files.js` | save database name from `engine.storage.saves` (`configureFiles`); save-set description / roster scan / cross-game import (M3) | Curse has no roster file and imports Pool/Hillsfar characters | partly carried |
| PER-5 | `engine/byoc.js` | `configure(profile)`: storage, accepted save names, record sizes, import-source sizes; manifest `normalize` (byte accepted in several forms, hashed as one, variant recorded); `store: false` (hashed, not stored) | CR-2 A (GAME.OVR 0x4A56) | carried |
| PER-6 | `engine/audio_cab.js` | the driver as an adapter (offsets, 2-byte note entries + length table, device codes 0/1/2) | res_0713 = 08AE relocated | carried (new file; Pool's audio.js unchanged) |
| PER-7 | `engine/pictures.js` | `config` (symbolMax, curseBlits, flushAfterLoad); Curse DrawPicture (always clips; opaque rows shear), GetPicture, ConvertPicturePixels / SetEgaPaletteRegister(Raw) exports, Load8x8Set text; `state.DataSet` = `G.DataSet` | BIGPIC/SKY/TILES and the Curse blitters | carried |
| PER-8 | `plus/hooks.js` | event names `npcLeft`, `bigPicShown`, `characterImported` (Plus phase) | Curse-new emit sites | open (Plus phase) |
| PER-9 | `engine/input.js`, `engine/tp.js` | adapter hooks in ReadGameKey (demo read without wait, key hook, TerminateGame body), live `FlushGameKeys`; `ParamStr(2)` | Curse ReadGameKey 06EA:010D, `START.EXE x Wooden` | carried |
| PER-10 | `engine/dax.js` | `daxConfig`: Curse OpenWithPrompt message, sound stop/start around a record load, "tempsize" prompt + halt | Curse res_0636 | carried |
| PER-11 | `engine/display.js` | `setGraphicsMode()` after a text screen | Curse shows S006 in text mode before the EGA mode set | carried |
| PER-12 | `byoc/ui/byoc-ui.js`, `engine/byoc.js` | import-screen texts (title, version, DAX count, id prefix) from the profile (`gameInfo`); a BY-1 title longer than the 36-column line drops its ' - game files' suffix (Curse, BYOC-TEST.md finding 1) | the screens named Pool 1.3 | carried |
| PER-13 | `engine/timer.js` | **bug fix:** `TimeInHundredths` now multiplies the elapsed time by the `?fast` factor; Pool divided it, so `?fast=n` made every TimeInHundredths-based wait n times longer | dev/acceptance speed-up was inverted in Pool too | carried — Pool should take it |
