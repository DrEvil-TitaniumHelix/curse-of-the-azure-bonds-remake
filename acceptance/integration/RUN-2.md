# RUN-2 — load, import, demo (BUILD_PLAN.md §5) — cab-build-engine — PASS (Hillsfar not run: no file)

Headless Chrome from `index.html`, keys only; shot points `t<s>` (seconds after load), `DEMO-END`, `S019`, `idle`.
Shots `acceptance/local/shoot/<id>.png` (local); SHA-256 + state in `acceptance/reports/shoot/<id>.json`. DOSBox frames:
`acceptance/local/ref/frames/` (the cab-data title run, no input: the attract demo from 41 s).
Saves are served read-only by `python -I tools/serve.py 8189 --dev --saves acceptance/local/run2saves` (gitignored copy of the
DOSBox camp-run saves + the player's Pool of Radiance saved game J from re-targets/goldbox/por/POOLRAD/SAVE) and copied into the
browser save store with `?loadsaves=1` (as BYOC imports a player's SAVE folder).

| # | step | route | shot | SHA-256 (PNG) | state / check | result |
|---|---|---|---|---|---|---|
| 1a | idle start: no key at the Play Demo prompt -> after 30 s the demo runs | `?screen=t75` | r2-demo | a9c8ffe1…07d56c | DemoMode 1, **data set 1, GameSpeed 9**, block 52h (ECL1/82), party RUSTLE / CYNTHIA / GRENDEL at 7,13 N; vs DOSBox frame f024: **60 px**, all in the line being typed (x 105..119, y 152..158 = typewriter timing, one glyph) | PASS (DIFF explained: timing) |
| 1b | the demo's 2D overland: BIGPIC 121, view mode 3, "YOUR ONLY HOPE" | `?screen=t100` | r2-d100 | 65fad2d8…1ad6d8 | **= DOSBox frame f055 at 0 px** | PASS |
| 1c | demo end (the villain's picture: "…free of the Curse of the Azure Bonds.") | `?screen=DEMO-END` | r2-demoend | 10f5158d…1c9475 | t 210 s, demo party dropped | PASS |
| 1d | back to the prompt after the demo (titles again, then the prompt with the 10 s timeout) | `?screen=S019` | r2-prompt | 8074cbd8…83eba1 | **= REF-S015 at 0 px**, menu_Timeout 1000, GameSpeed 4 again | PASS |
| 2 | load save **G** (DOSBox, patched to the overland by cab-build-areas' patch_overland.py: data set 1, ECL1 block 50h, view mode 3; local) -> the 2D BIGPIC 121 area, the menu waits ('GUARDS BAR YOUR WAY.' + PRESS <ENTER>/<RETURN> TO CONTINUE) while the city overlay animation runs (VIEW-13) | `…P a{Enter} L G B` (served from acceptance/local/run2saves) | r2-ov / r2-ov50 | 65fb4aeb…be95e7 / e83e91b2…c94888 | view mode 3, data set 1, block 80, BIGPIC 121; animation phase A **= REF-S054 at 0 px**, phase B **= REF-S054-B at 0 px** (the two phases differ only in the blinking cell (32,120)). First run found an engine bug: VM op 2Bh's single-item text swap 'PRESS BUTTON OR RETURN TO CONTINUE.' -> 'PRESS <ENTER>/<RETURN> TO CONTINUE' (2200:10e1..10f6) was missing, and the highlight flag is 8B62 && 8B63 (2200:1109; also ENCOUNTER MENU 2200:21d5) — fixed in engine/ecl_cab.js | PASS |
| 3a | load the DOSBox-made save D (camp run: ALPHA in camp at 7,13): titles, P, wheel, **L**, `Load Which Game: B C D` -> D, Begin; walk to the weapon shop as the DOSBox route walk2 (crowd texts dismissed with Enter as there) | `?loadsaves=1&keys=…P a{Enter} L D B {Left}{Left}{Up}{Enter}{Enter}{Right}{Up}{Enter}{Left}{Up}{Up}{Up}{Enter}{Up}` | r2-shop0 | b3205a4b…82a904 | party ALPHA from save D; 2,12 W 00:06 "WE HAVE A SELECTION OF THE FINEST CORMYR STEEL. INTERESTED?" | PASS |
| 3b | shop: Y | + `Y` | r2-shop | d43fbf46…3fe8ee | **= REF-S065 at 0 px** | PASS |
| 3c | shop: Buy (the item list) | + `B` | r2-buy | fc2d4502…22df0c | **= REF-S066 at 0 px** | PASS |
| 4a | from save D walk to the Temple of Gond as the DOSBox route walk4 | `…L D B {Left}{Left}{Up}{Enter}{Enter}{Right}{Up}{Enter}{Left}{Up}{Right}{Up}{Up}{Enter}{Up}{Up}{Up}{Left}{Up}{Enter}{Up}{Enter}{Up}{Up}{Up}` | r2-temple | 4b7ebcd7…360ea7 | 0,7 W, view mode 1; **= REF-S072 at 0 px** | PASS |
| 4b | Heal | + `H` | r2-heal | 54e54dd0…c75d65 | **= REF-S073 at 0 px** | PASS |
| 4c | service dialogue | + `{Enter}` | r2-heal2 | 2dc48df0…88c036 | **= REF-S074 at 0 px** | PASS |
| 4d | price | + `Y` | r2-price | 9bab0a87…c7196c | **= REF-S074-PRICE at 0 px** | PASS |
| 4e | refuse, exit, pool the money, exit | + `NEPE` | r2-tpool | dfba5636…551d16 | **= REF-S075 at 0 px** | PASS |
| 5a | import a Pool of Radiance character: after Load D, top menu **A**dd -> `Add from where? Curse Pool Hillsfar Exit` -> **P** (ImportSource 1): the scan lists the player's Pool saved game J (`*.SAV` of 11Dh bytes, read-only copy of POOLRAD/SAVE) | `…L D A P` | r2-import | de4ee46c…81343b | THRENDER GRONE / … / PHINEAS "FROM SAVED GAME J" | PASS |
| 5b | add THRENDER GRONE (ConvertPoolCharacter) | + `A{Esc}` | r2-added | 6a84fbd9…d64184 | party ALPHA + THRENDER GRONE | PASS |
| 5c | character sheet of the imported character | + `V` | r2-sheet | 1876d435…0cebc5 | male dwarf, age 52, lawful good fighter, level 1, EXP 48, HP 11, STR..CHA 17/12/12/17/16/15 = the Pool record (+10..+15, +2E/+2F, +30, +32, +AC, +A0, +9E); platinum 300 (ConvertPoolCharacter sets +103h := 300). Faithful quirk (listing 4300:2e09): the .swg/.fx/.spc beside a Pool member are looked up by **MakeDosName(name)** (THRENDER.*), not by the file it came from (CHRDATJ1.*), so a saved-game member arrives without its items and effects, as in the original | PASS |
| 5d | Hillsfar `.hil` import | — | — | — | no Hillsfar file exists on this machine (searched the home folder, re-targets) | NOT RUN (no file) |
| 6 | save: Exit the sheet, **S**ave, game **E** | + `ESE` | r2-savemenu / r2-saved | 200591ff…1d26f3 / 7e149118…3e4a3b | `SAVGAME.DAT` 13149 B, member count 2; `CHRDATE1.SAV` / `CHRDATE2.SAV` 422 B each, CHRDATE2 = THRENDER GRONE in the Curse record; GameSaved = 1 | PASS |

**Status: PASS except the Hillsfar import (no file).** The idle demo (data set 1, GameSpeed 9), the overland BIGPIC 121 (= DOSBox frame at 0 px), the return to the prompt (0 px), a DOSBox-made save loaded and played into the shop (S065/S066 0 px) and the temple (S072..S075 0 px), the Pool of Radiance import with the converted sheet, and the save all pass.
Step 2 ran with save G (REF-S054 / S054-B, cab-build-areas 46e1778). Not run: the Hillsfar import (no .hil file).
Server for steps 3..6: `python -I tools/serve.py 8189 --dev --saves acceptance/local/run2saves`; the folder = `acceptance/local/saves/camp/*` + `re-targets/goldbox/por/POOLRAD/SAVE/CHRDATJ*` (copies, local).
