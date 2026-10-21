# ACCEPTANCE — Curse of the Azure Bonds v1.0 build vs DOSBox-X references (BUILD_PLAN.md §5)

**Standard: spot-check standard (the owner 10/21).** Screenshots only where the picture itself is under test: the six rows of the
spot check below, from references and build shots already on disk (no new DOSBox runs). Every other row without a verdict is
NO-REF — logic verified by trace (cab-build-engine TRACE.md). The per-screen rows further down keep the verdicts recorded
before the ruling.

## Spot check (the owner 10/21)
| # | what is under test | id | build shot (route) | reference | px | verdict |
|---|---|---|---|---|---|---|
| 1 | 3D view (walls, sky, party roster) | S049 | b-S049 (`sh acceptance/areas_shots.sh camp1`: camp seed, create ALPHA, Begin) | REF-S049 | 0 | **PASS** |
| 2 | big picture (BIGPIC 121 backdrop, DrawBigPic) | S053 | r2-ov50 (RUN-2 step 2: load save G, Begin) | REF-S053 | 0 | **PASS** |
| 3 | overland map (BIGPIC 121 + the blinking party marker) | S054 | r2-ov (RUN-2 step 2) | REF-S054 | 0 | **PASS** (the other blink phase: REF-S054-B = r2-ov50, 0 px) |
| 4 | font / text render (character sheet) | S095 | b-S095 (`areas_shots.sh camp2`) | REF-S095 | 0 | **PASS** |
| 5 | menu screen (shop item list + menu line) | S066 | r2-buy (RUN-2 step 3c: load save D, walk to the weapon shop, Buy) | REF-S066 | 0 | **PASS** |
| 6 | combat board (royal-guard fight) | S113 | sd4 (load save E, walk7's keys, seed 4) | REF-S113 | 3690 | **DIFF (explained: random state)** — the board itself matches: the cobble wall row (8,128)-(176,168) and the screen frame 0 px; the 3690 px are the guards' positions in the field (1345), the right panel (1543: ALPHA's menu turn in DOSBox, a guard's attack in the build) and row 24 (802). The DOSBox run was not seeded, so the placement and the turn order differ |

Spot check: **5 PASS, 1 DIFF (explained), 0 NO-REF.**

Owner of the file: cab-build-engine (sections 1, 2 and 9 engine rows); cab-build-areas appends its rows in **Areas** below.
Verdicts as Pool: **PASS** = 0 px exact RGB 320×200 vs the DOSBox-X reference · **DIFF** (cause named) · **NO-REF** ·
**BLOCKED** · **ERR-PATH** (cannot occur in the build). Method: `node acceptance/shoot.mjs "<id>?<route>"` (headless
Chrome, shared run lock of PoolRadianceRE/acceptance) → `acceptance/local/shoot/<id>.png` (gitignored, original art);
`node acceptance/cmp.mjs --pairs REF-<id>=<id>` (same rule as acceptance/ref/compare.py). Shot SHA-256 reports:
`acceptance/reports/shoot/<id>.json`. References: `acceptance/ref/REF-<id>.capture.json` (PNGs local).

## 1. Start-up (S001..S019)
| id | source | build path | reference | px | verdict |
|---|---|---|---|---|---|
| S001..S005 | RESIDENT-04..08 | — (curse.cfg is supplied by the engine, BUILD_PLAN §2) | — | — | ERR-PATH |
| S006 | RESIDENT-09 | `?screen=S006` (DOS text screen, 2 s; 640×350) | DOSBox title run frame f001 (`TANDY 1000 USERS - Make sure NUMLOCK is on.`, acceptance/ref/README.md timeline; sampled frame, not promoted to REF-S006) | 0 | **PASS** (vs f001, 640×350; f000 = the frame before the line is complete, 16 px) |
| S007..S009 | RESIDENT-10/11/17 | — (no memory / overlay errors in the build) | — | — | ERR-PATH |
| S010 | ENGINE-09 | `?screen=S010&fast=4` | REF-S010 | 0 | **PASS** |
| S011 | ENGINE-02 | `?screen=S011&fast=4` | REF-S011 | 0 | **PASS** |
| S012 | ENGINE-03 | `?screen=S012&fast=4` | REF-S012 | 0 | **PASS** |
| S013 | ENGINE-04 | `?screen=S013&fast=4` | REF-S013 | 0 | **PASS** |
| S014 | ENGINE-05 | `?screen=S014&fast=4` | REF-S014 | 0 | **PASS** |
| S015 | RESIDENT-01 | `?screen=S015&fast=4` | REF-S015 | 0 | **PASS** |
| S016 | ENGINE-06 | `?screen=S016&sting=1&seed=4444&wheel=1&keys=P&fast=4` (seed reproduces the reference draws e 11, d 6, path 1, box 5) | REF-S016 | 0 | **PASS** |
| S017 / S018 | ENGINE-07/08 | `?wheel=retail` (dead in the owner's copy) | none (needs a 0x4A56 = 74 scratch copy, O-7) | — | NO-REF |
| S019 | RESIDENT-02 | after a demo run: titles + prompt (10 s); RUN-2 step 1 shot r2-prompt | REF-S015 (same prompt state: the DOSBox demo returns to the same titles + prompt) | 0 | **PASS** |

Summary §1 (2026-10-20, after RUN-2): 9 PASS (S006, S010..S016, S019), 8 ERR-PATH, 2 NO-REF (S017/S018: the retail wheel; ref request to cab-build-areas).

## 2. Top menu, party creation, files (engine rows; S033 is in Areas)
Route base `R` = `?sting=1&seed=169084438&wheel=1&fast=4&freshsaves=1&keys=Pa{Enter}C{Enter}{Enter}{Enter}{Enter}` (titles skipped with STING, the camp-run seed 169084438 = DOS time 06:22:10.20 recovered from
REF-S016 + the record id byte EDh; `freshsaves=1` = an empty save store, as the DOSBox scratch copy).
| id | source | build path | reference | px | verdict |
|---|---|---|---|---|---|
| S020 | ENGINE-21 | `?screen=S020&sting=1&seed=4444&wheel=1&keys=Pa{Enter}&fast=4` | REF-S020 | 0 | **PASS** |
| S020-PARTY | ENGINE-21 | `?screen=S020-PARTY&R` + `NALPHA{Enter}EYYA{Enter}A{Esc}` | REF-S020-PARTY | 0 | **PASS** |
| S021 | ENGINE-22 | Load of a won game | none | — | NO-REF |
| S022 | ENGINE-23 | `E` at the top menu | none | — | NO-REF |
| S023 | ENGINE-24 | `J` with `?wooden=1` | none | — | NO-REF |
| S024 | ENGINE-25 | `?screen=S024&sting=1&seed=4444&wheel=1&keys=Pa{Enter}C&fast=4` | REF-S024 | 0 | **PASS** |
| S025 | ENGINE-26 | `?screen=S025&R` | REF-S025 | 0 | **PASS** |
| S026 | ENGINE-27 | `?screen=S026&R` + `N` | REF-S026 | 0 | **PASS** |
| S027 | ENGINE-28 | `?screen=S027&R` + `NALPHA{Enter}EY` | REF-S027 | 0 | **PASS** |
| S028 | ENGINE-29 | `?screen=S028&R` + `NALPHA{Enter}` | REF-S028 | 0 | **PASS** |
| S029 | ENGINE-30 | Drop | none | — | NO-REF |
| S030 | ENGINE-31 | `?screen=S030&R` + `NALPHA{Enter}EYYA` | REF-S030 | 0 | **PASS** |
| S031 / S032 | ENGINE-32/33 | Modify / Train | none | — | NO-REF |
| S034 | ENGINE-10 | `?screen=S034&sting=1&seed=521537026&wheel=1&fast=4&freshsaves=1&keys=Pa{Enter}C{Enter}{Enter}{Enter}{Enter}NALPHA{Enter}EYYA{Enter}A{Esc}S` (seed method: the main run's DOS-clock seed 521537026 = 06:02:31.22, recovered from its rune-wheel draws + record id byte, Pool seedsim.py TP5 LCG) | REF-S034 | 0 | **PASS** (was DIFF 60 px with the camp seed: roster AC/HP of another roll) |
| S034-CAMP | ENGINE-10 | `?screen=S034-CAMP&R` + `NALPHA{Enter}EYYA{Enter}A{Esc}B{Enter}{Enter}AAES` (camp seed) | REF-S034-CAMP | 28 | **DIFF (explained: camp animation phase)** — all 28 px inside the camp picture (bbox 42..109, 26..106): the campfire frame at the moment of the snap; text, menu and party list 0 px (as the camp rows in Areas) |
| S034-QUIT | ENGINE-10 | as S034-CAMP + `B` (Save B, `Quit to DOS Yes No`) | REF-S034-QUIT | 49 | **DIFF (explained: camp animation phase)** — same cause, all inside the camp picture |
| S035 | ENGINE-11 | `?screen=S035&wheel=1&freshsaves=1&loadsaves=1&keys={Space}{Space}{Space}{Space}Pa{Enter}L` (served saves = the camp run's B/C/D, `serve.py --saves`) | REF-S035 | 0 | **PASS** |
| S036..S044 | ENGINE-12..20 | save over / disk / file error messages | none | — | NO-REF (ref request to cab-build-areas) |

Summary §2 engine rows (2026-10-20, after RUN-2): 10 PASS (S020, S020-PARTY, S024..S028, S030, S034, S035), 2 DIFF (explained: camp animation phase; S034-CAMP / S034-QUIT), 6 NO-REF (S021..S023, S029, S031/S032) + S036..S044 NO-REF.

## Areas (cab-build-areas)

Rows: every SCREENS_INDEX id from VIEW / PARTY / MAGIC / COMBAT_SCREENS (the VIEW, PARTY, MAGIC and COMBAT units in
`game/areas/`). Generated by `python -I game/test/areas/acceptance_rows.py --write` (keeps the verdict columns).
Routes and verdicts are filled when the engine can drive the game there (ECL host, engine M2/M3); `pending` = not
run yet. Unit tests of the routines behind these screens: `node game/test/areas/run_all.mjs`.


### 2. Top menu, party creation, files
| id | source | routine / trigger | build path | reference | px | verdict |
|---|---|---|---|---|---|---|
| S033 | PARTY_SCREENS PARTY-18 | ChangeClass 6600:0ee1 (top menu `Human Change Classes`, ENGINE-21) | — | — | — | **NO-REF** — logic verified by trace (cab-build-engine TRACE.md) |

### 3. Adventure: scripts, 3D / 2D view, pictures
| id | source | routine / trigger | build path | reference | px | verdict |
|---|---|---|---|---|---|---|
| S049 | VIEW_SCREENS VIEW-01 | 3D exploration — ECL game loop -> ExploreCommand 3F00:090A with `vi... | `sh acceptance/areas_shots.sh camp1` → b-S049 | REF-S049 | 0 | **PASS** |
| S050 | VIEW_SCREENS VIEW-02 | Area map — 'A' in VIEW-01 when `Mem[4BFB] = 0` (or the second comma... | `sh acceptance/areas_shots.sh camp1` → b-S050 | REF-S050 | 0 | **PASS** |
| S051 | VIEW_SCREENS VIEW-02a | "Not Here" — 'A' where the area map is forbidden | — | — | — | **NO-REF** — logic verified by trace (cab-build-engine TRACE.md) |
| S052 | VIEW_SCREENS VIEW-03 | Locked door — step into a door of passage state 2 or 3 (MoveParty 3... | — | — | — | **NO-REF** — logic verified by trace (cab-build-engine TRACE.md) |
| S053 | VIEW_SCREENS VIEW-04 | 2D area — `view_Mode = 3` (non-3D areas) | cab-build-engine RUN-2 step 2 (save G) shot r2-ov50; re-compared by cab-build-areas | REF-S053 | 0 | **PASS** — REF-S053 = the 2D area backdrop (BIGPIC 121 + the waiting menu, walk15 snap 05, the same frame as REF-S054-B), patched save G |
| S054 | VIEW_SCREENS VIEW-13 | City overlay animation — HorizontalMenu in VIEW-04 with BIGPIC 121 ... | cab-build-engine RUN-2 step 2 (save G) shot r2-ov / r2-ov50; re-compared by cab-build-areas | REF-S054, REF-S054-B | 0 | **PASS** — both phases of the blinking party marker: REF-S054 = r2-ov 0 px, REF-S054-B = r2-ov50 0 px |
| S055 | VIEW_SCREENS VIEW-07 | Portrait — ShowHeadBodyPicture from PICTURE / SETUP MONSTER | — | REF-S055 | — | **NO-REF** — logic verified by trace (cab-build-engine TRACE.md) |
| S056 | VIEW_SCREENS VIEW-08 | Encounter picture — ECL PICTURE / sprite opcodes, HorizontalMenu wh... | `sh acceptance/areas_shots.sh refs 200 S056` → d-S056 (route = the reference's own steps, acceptance/areas_route.py; save D) | REF-S056 | 412 | **DIFF → engine fix request #14** — only row 24 differs: the build shows the script's one-option menu text `PRESS BUTTON OR RETURN TO CONTINUE.`; the original's op2B (2200:1082) replaces exactly that text by `PRESS <ENTER>/<RETURN> TO CONTINUE` (StrCompare g_1037 / StrAssign 105b), as DOSBox shows |
| S057 | COMBAT_SCREENS COMBAT-07-01 | Encounter picture — ECL SETUP MONSTER / APPROACH / ENCOUNTER MENU →... | — | — | — | **NO-REF** — logic verified by trace (cab-build-engine TRACE.md) |
| S058 | COMBAT_SCREENS COMBAT-07-02 | Script damage — ECL DAMAGE → ApplyEclDamage 2C00:2252 | — | — | — | **NO-REF (unreachable: the only DAMAGE opcodes of Tilverton are in the sewers (ECL2/3 9599) and the Fire Knives' hideout (ECL2/4 8D16), reached only through the guild chapter (jail -> thief -> guild -> sewers); not on a scripted route (a patched save could place the party there))** |
| S059 | COMBAT_SCREENS COMBAT-07-03 | Script menus — ECL MENU opcodes → MenuSelect 2C00:17EA / EclVertica... | — | REF-S059 | — | **NO-REF** — logic verified by trace (cab-build-engine TRACE.md) |
| S060 | PARTY_SCREENS PARTY-13 | PartySummary 6200:0795 (all non-combat views except mode 3) | `sh acceptance/areas_shots.sh saveD` → b-S060 | REF-S060 | 0 | **PASS** |
| S061 | PARTY_SCREENS PARTY-14 | DrawCharacterSummary 6200:0a34 (when combat_Shown DS:75E5 set) | — | — | — | **NO-REF** — logic verified by trace (cab-build-engine TRACE.md) |
| S062 | PARTY_SCREENS PARTY-15 | DrawLocationTimeStatus 6200:2baa (view modes 1, 2, 4) | `sh acceptance/areas_shots.sh saveD` → b-S060 | REF-S062 | 0 | **PASS** |
| S063 | PARTY_SCREENS PARTY-16 | ShowCharacterMessage 6200:17d6 / ShowTimedBottomMessage 177a / Lose... | — | — | — | **NO-REF** — logic verified by trace (cab-build-engine TRACE.md) |
| S064 | PARTY_SCREENS PARTY-17 | SelectPartyCharacter 6200:2e6a | — | — | — | **NO-REF** — logic verified by trace (cab-build-engine TRACE.md) |

### 4. Shop, temple, money
| id | source | routine / trigger | build path | reference | px | verdict |
|---|---|---|---|---|---|---|
| S065 | PARTY_SCREENS PARTY-01 | Shop 2B00:06f6 (ECL shop) | cab-build-engine RUN-2 step 3b (acceptance/integration/RUN-2.md) shot r2-shop; re-compared by cab-build-areas with acceptance/cmp.mjs | REF-S065 | 0 | **PASS** |
| S066 | PARTY_SCREENS PARTY-02 | ShopBuy 2B00:0474 / ShopItemsMenu 029a | cab-build-engine RUN-2 step 3c (acceptance/integration/RUN-2.md) shot r2-buy; re-compared by cab-build-areas with acceptance/cmp.mjs | REF-S066 | 0 | **PASS** |
| S067 | PARTY_SCREENS PARTY-03 | AddItemToChar 2B00:0372, ShopBuy 060b | — | — | — | **NO-REF** — logic verified by trace (cab-build-engine TRACE.md) |
| S068 | PARTY_SCREENS PARTY-04 | Shop 2B00:087d ('E' with money in the pool) | — | — | — | **NO-REF** — logic verified by trace (cab-build-engine TRACE.md) |
| S069 | PARTY_SCREENS PARTY-10 | TakeMoney 5500:0cf7 (Take) | `sh acceptance/areas_shots.sh refs 200 S069 S069-AMOUNT` → d-S069 (route = the reference's own steps, acceptance/areas_route.py; save D) + d-S069-AMOUNT | REF-S069, REF-S069-AMOUNT | 0 | **PASS** (REF-S069 and REF-S069-AMOUNT 0 px) |
| S070 | PARTY_SCREENS PARTY-11 | AddPlatinumOrPool 5500:023a, TransferCoins 050d, TakeCoins 0aa6 | — | — | — | **NO-REF (unreachable: `Overloaded.  Money will be put in Pool.` needs a character at the encumbrance limit taking coins; a level-5 party with its starting money never reaches it on the opening routes)** |
| S071 | PARTY_SCREENS PARTY-12 | AppraiseGems 5500:1b08 (Appraise) | — | — | — | **NO-REF** — logic verified by trace (cab-build-engine TRACE.md) |
| S072 | MAGIC_SCREENS MAGIC-04-01 | Temple — ECL COMBAT opcode with the temple flag → Temple 2700:0DD6 ... | cab-build-engine RUN-2 step 4a (acceptance/integration/RUN-2.md) shot r2-temple; re-compared by cab-build-areas with acceptance/cmp.mjs | REF-S072 | 0 | **PASS** |
| S073 | MAGIC_SCREENS MAGIC-04-02 | Temple services — 'H' in MAGIC-04-01 → HealMenu 2700:0B12 | cab-build-engine RUN-2 step 4b (acceptance/integration/RUN-2.md) shot r2-heal; re-compared by cab-build-areas with acceptance/cmp.mjs | REF-S073 | 0 | **PASS** |
| S074 | MAGIC_SCREENS MAGIC-04-03 | Service dialogue — a service in MAGIC-04-02 | cab-build-engine RUN-2 step 4c / 4d (acceptance/integration/RUN-2.md) shot r2-heal2, r2-price; re-compared by cab-build-areas with acceptance/cmp.mjs | REF-S074, REF-S074-PRICE | 0 | **PASS** (REF-S074 and REF-S074-PRICE 0 px) |
| S075 | MAGIC_SCREENS MAGIC-04-04 | Money left in the temple — E in MAGIC-04-01 with money in the pool | cab-build-engine RUN-2 step 4e (acceptance/integration/RUN-2.md) shot r2-tpool; re-compared by cab-build-areas with acceptance/cmp.mjs | REF-S075 | 0 | **PASS** |

### 5. Camp, rest, spells
| id | source | routine / trigger | build path | reference | px | verdict |
|---|---|---|---|---|---|---|
| S077 | MAGIC_SCREENS MAGIC-15-01 | Camp — ECL CAMP / Encamp → Camp 4000:23FC (`view_Mode := 2`) | `sh acceptance/areas_shots.sh camp1` → b-S077 | REF-S077 | 49 | **DIFF (explained: camp animation phase)** — all differing pixels lie in the camp picture (fire, seated figure, stars); the build's picture area (24,24)-(112,112) equals DOSBox frame acceptance/local/runs/areas1/10-alter.png exactly, the rest of the screen 0 px |
| S078 | MAGIC_SCREENS MAGIC-15-02 | Magic menu — 'M' in MAGIC-15-01 → MagicMenu 4000:14D2 | `sh acceptance/areas_shots.sh camp2` → b-S078 | REF-S078 | 28 | **DIFF (explained: camp animation phase)** — all differing pixels lie in the camp picture (fire, seated figure, stars); the build's picture area (24,24)-(112,112) equals DOSBox frame acceptance/local/runs/areas1/10-alter.png exactly, the rest of the screen 0 px |
| S079 | MAGIC_SCREENS MAGIC-15-03 | Cast (camp) — 'C' in MAGIC-15-02 or 'C' in the explore menu → CastM... | `sh acceptance/areas_shots.sh cleric2` → c-S079; `cleric3` → c-S079-CASTS (shot hook in ShowCasts) | REF-S079, REF-S079-CASTS | 0 | **PASS** (both: REF-S079 and REF-S079-CASTS 0 px) |
| S080 | MAGIC_SCREENS MAGIC-15-04 | Memorize — 'M' in MAGIC-15-02 → MemorizeMenu 4000:0942 | `sh acceptance/areas_shots.sh cleric` → c-S080, c-S080-LIST, c-S080-CONFIRM | REF-S080, REF-S080-CONFIRM, REF-S080-LIST | 20 | **DIFF (explained: random state)** — the DOSBox cleric runs (walk10..13) were not seeded like the build route (camp seed), so BETA's rolled abilities differ (WIS 12/16, DEX, CON); only the spell-slot digits `CLERIC SPELLS: n n n` (162,160)-(215,167) differ (slots follow WIS); REF-S080-LIST and REF-S080-CONFIRM 0 px |
| S081 | MAGIC_SCREENS MAGIC-15-05 | Scribe — 'S' in MAGIC-15-02 → ScribeMenu 4000:0B9B | — | — | — | **NO-REF** — logic verified by trace (cab-build-engine TRACE.md) |
| S082 | MAGIC_SCREENS MAGIC-15-06 | Alter menu — 'A' in MAGIC-15-01 → AlterMenu 4000:1D0A | `sh acceptance/areas_shots.sh camp1` → b-S082 | REF-S082 | 50 | **DIFF (explained: camp animation phase)** — all differing pixels lie in the camp picture (fire, seated figure, stars); the build's picture area (24,24)-(112,112) equals DOSBox frame acceptance/local/runs/areas1/04-magic.png exactly, the rest of the screen 0 px |
| S083 | MAGIC_SCREENS MAGIC-15-07 | Display effects — 'D' in MAGIC-15-02 → DisplayEffects 4000:1016 | `sh acceptance/areas_shots.sh saveD` → b-S083 | REF-S083 | 0 | **PASS** |
| S084 | MAGIC_SCREENS MAGIC-15-08 | Party order — 'O' in MAGIC-15-06 → PartyOrder 4000:1834 | `sh acceptance/areas_shots.sh saveD` → b-S084 | REF-S084 | 50 | **DIFF (explained: camp animation phase)** — all differing pixels lie in the camp picture (fire, seated figure, stars); the build's picture area (24,24)-(112,112) equals DOSBox frame acceptance/local/runs/areas1/04-magic.png exactly, the rest of the screen 0 px |
| S085 | MAGIC_SCREENS MAGIC-15-09 | Drop character — 'D' in MAGIC-15-06 → DropCharacter 4000:199C | `sh acceptance/areas_shots.sh saveD` → b-S085 | REF-S085 | 0 | **PASS** |
| S086 | MAGIC_SCREENS MAGIC-15-10 | Game speed (camp) — 'S' in MAGIC-15-06 → GameSpeedMenu 4000:1B4D | `sh acceptance/areas_shots.sh camp1` → b-S086 (+ b-S086-SLOWER = REF-S086-SLOWER 0 px) | REF-S086, REF-S086-SLOWER | 49 | **DIFF (explained: camp animation phase)** — all differing pixels lie in the camp picture (fire, seated figure, stars); the build's picture area (24,24)-(112,112) equals DOSBox frame acceptance/local/runs/areas1/10-alter.png exactly, the rest of the screen 0 px |
| S087 | MAGIC_SCREENS MAGIC-15-11 | Fix — 'F' in MAGIC-15-01 → Fix 4000:2309 | — | — | — | **NO-REF** — logic verified by trace (cab-build-engine TRACE.md) |
| S088 | MAGIC_SCREENS MAGIC-15-12 | Pictures submenu — 'P' in MAGIC-15-06 | `sh acceptance/areas_shots.sh saveD` → b-S088 | REF-S088 | 0 | **PASS** |
| S089 | PARTY_SCREENS PARTY-06 | RestLoop 5400:0d02 (show) / RestMenu 0728 | `sh acceptance/areas_shots.sh camp2` → b-S089 | REF-S089 | 0 | **PASS** |
| S090 | PARTY_SCREENS PARTY-07 | RestLoop 5400:0d3c | `sh acceptance/areas_shots.sh cleric3` → c-S091 (the same frame) | REF-S090 | 76 | **DIFF (explained: random state)** — the DOSBox cleric runs (walk10..13) were not seeded like the build route (camp seed), so BETA's rolled abilities differ (WIS 12/16, DEX, CON); only the AC/HP digits of the roster (267,32)-(311,39) differ outside the camp picture, and the picture equals DOSBox frame acceptance/local/runs/areas1/04-magic.png exactly (animation phase) |
| S091 | PARTY_SCREENS PARTY-08 | DailyHealing 5400:08c7 (every 24 h of rest) / FinishMemorize 098e /... | `sh acceptance/areas_shots.sh cleric3` → c-S091 (shot hook in ShowCasts) | REF-S091 | 76 | **DIFF (explained: random state)** — the DOSBox cleric runs (walk10..13) were not seeded like the build route (camp seed), so BETA's rolled abilities differ (WIS 12/16, DEX, CON); only the AC/HP digits of the roster (267,32)-(311,39) differ outside the camp picture, and the picture equals DOSBox frame acceptance/local/runs/areas1/04-magic.png exactly (animation phase); rest time 00:00:15 and the line as in DOSBox |
| S092 | PARTY_SCREENS PARTY-09 | RestLoop 5400:0e39 (rest encounter, VM 7ED2/7ED3) | — | — | — | **NO-REF** — logic verified by trace (cab-build-engine TRACE.md) |
| S093 | MAGIC_SCREENS MAGIC-22-01 | Spell list — ChooseSpell 5800:0219 (via ov19 SpellList: cast, memor... | `sh acceptance/areas_shots.sh cleric` → c-S093 | REF-S093 | 35 | **DIFF (explained: random state)** — the DOSBox cleric runs (walk10..13) were not seeded like the build route (camp seed), so BETA's rolled abilities differ (WIS 12/16, DEX, CON); only the spell-slot digits `CLERIC SPELLS: n n n` (162,160)-(215,167) differ (slots follow WIS) |
| S094 | MAGIC_SCREENS MAGIC-22-02 | Cast outside combat — CastSpell 5800:1263 / SelectTargetsCamp 10D2 | `sh acceptance/areas_shots.sh cleric2` → c-S094 | REF-S094 | 98 | **DIFF (explained: random state)** — the DOSBox cleric runs (walk10..13) were not seeded like the build route (camp seed), so BETA's rolled abilities differ (WIS 12/16, DEX, CON); only the AC/HP digits of the roster (267,32)-(311,39) differ outside the camp picture, and the picture equals DOSBox frame acceptance/local/runs/areas1/10-alter.png exactly (animation phase) |

### 6. Character sheet and items
| id | source | routine / trigger | build path | reference | px | verdict |
|---|---|---|---|---|---|---|
| S095 | COMBAT_SCREENS COMBAT-19-01 | Character sheet — 'V' (View) in the explore / combat / treasure men... | `sh acceptance/areas_shots.sh camp2` → b-S095 | REF-S095 | 0 | **PASS** |
| S096 | COMBAT_SCREENS COMBAT-19-02 | View menu — ViewMenu 5000:0B75 | `sh acceptance/areas_shots.sh saveD` → b-S096; `sh acceptance/areas_shots.sh refs 200 S096-ITEMS` → d-S096-ITEMS (save D route) | REF-S096, REF-S096-ITEMS | 0 | **PASS** — REF-S096-ITEMS 0 px after the ShopBuy price fix (2b00:04cc: no default factor branch, the price keeps the stack residue 0Fh; before the fix 183 px: 288 platinum + 4 gold instead of 284 platinum) |
| S097 | COMBAT_SCREENS COMBAT-19-03 | Items list — 'I' in COMBAT-19-02 or `Use` in the combat menu → Item... | `sh acceptance/areas_shots.sh refs 200 S097` → d-S097 (route = the reference's own steps, acceptance/areas_route.py; save D) | REF-S097 | 0 | **PASS** |
| S098 | COMBAT_SCREENS COMBAT-19-04 | Drop item — 'D' in COMBAT-19-03 (after MayLoseItem) | `sh acceptance/areas_shots.sh refs 200 S098` → d-S098 (route = the reference's own steps, acceptance/areas_route.py; save D) | REF-S098 | 0 | **PASS** |
| S099 | COMBAT_SCREENS COMBAT-19-05 | Trade item — 'T' in COMBAT-19-03 → TradeItem 5000:213C | `sh acceptance/areas_shots.sh refs 200 S099` → d-S099 (route = the reference's own steps, acceptance/areas_route.py; save D) | REF-S099 | 0 | **PASS** |
| S100 | COMBAT_SCREENS COMBAT-19-05a | May lose item — Trade / Drop / Sell of a readied or scribe-marked s... | — | — | — | **NO-REF** — logic verified by trace (cab-build-engine TRACE.md) |
| S101 | COMBAT_SCREENS COMBAT-19-06 | Sell item — 'S' in COMBAT-19-03 (shop, view_Mode 1) → SellItem 5000... | `sh acceptance/areas_shots.sh refs 200 S101` → d-S101 (route = the reference's own steps, acceptance/areas_route.py; save D) | REF-S101 | 0 | **PASS** |
| S102 | COMBAT_SCREENS COMBAT-19-07 | Identify item — 'I' in COMBAT-19-03 (shop) → IdentifyItem 5000:2A42 | `sh acceptance/areas_shots.sh refs 200 S102` → d-S102 (route = the reference's own steps, acceptance/areas_route.py; save D) | REF-S102 | 0 | **PASS** |
| S103 | COMBAT_SCREENS COMBAT-19-08 | Item debug dump — hidden key `V` in COMBAT-19-03 → ItemDebugView 50... | — | — | — | **NO-REF (unreachable: dead code in the original. ItemsMenu tests `V` (5000:18f9), but VerticalListMenu ends only on a key that HorizontalMenu accepts, and HorizontalMenu (6800:06c8..06e9) accepts a letter only when it occurs in the option string; the items menu offers `Ready Use Trade Drop Halve Join Sell Id Exit` — no capital V (DOSBox walk3: V does nothing))** |
| S104 | COMBAT_SCREENS COMBAT-19-09 | Trade coins — 'T' in COMBAT-19-02 → TradeCoins 5000:2C57 | — | — | — | **NO-REF** — logic verified by trace (cab-build-engine TRACE.md) |
| S105 | COMBAT_SCREENS COMBAT-19-10 | Drop coins — 'D' in COMBAT-19-02 → DropCoins 5000:2FA9 | `sh acceptance/areas_shots.sh camp2` → b-S105 (+ REF-S105-AMOUNT 0 px) | REF-S105, REF-S105-AMOUNT | 0 | **PASS** |
| S106 | COMBAT_SCREENS COMBAT-19-11 | Spell list — 'S' in COMBAT-19-02, Use of a scroll, Cast, camp Memor... | `sh acceptance/areas_shots.sh cleric2` → c-S106 | REF-S106 | 0 | **PASS** |
| S107 | COMBAT_SCREENS COMBAT-19-12 | Lay on hands — 'H' in COMBAT-19-02 → LayOnHands 5000:36D8 | — | — | — | **NO-REF** — logic verified by trace (cab-build-engine TRACE.md) |
| S108 | COMBAT_SCREENS COMBAT-19-13 | Cure disease — 'C' in COMBAT-19-02 → PaladinCureDisease 5000:37EC | — | — | — | **NO-REF** — logic verified by trace (cab-build-engine TRACE.md) |
| S109 | COMBAT_SCREENS COMBAT-19-14 | Ready item messages — 'R' in COMBAT-19-03 → ReadyItem 5000:1EE9 | — | — | — | **NO-REF** — logic verified by trace (cab-build-engine TRACE.md) |
| S110 | COMBAT_SCREENS COMBAT-19-15 | Use item — 'U' in COMBAT-19-03 / AI → UseItem 5000:248D | — | — | — | **NO-REF** — logic verified by trace (cab-build-engine TRACE.md) |

### 7. Combat
| id | source | routine / trigger | build path | reference | px | verdict |
|---|---|---|---|---|---|---|
| S112 | VIEW_SCREENS VIEW-05 | Battle start — StartCombat 3300:1C3E | — | — | — | **NO-REF** — logic verified by trace (cab-build-engine TRACE.md) |
| S113 | VIEW_SCREENS VIEW-06 | Combat map — combat (COMBAT lane) | — | REF-S113 | — | **NO-REF** — logic verified by trace (cab-build-engine TRACE.md) |
| S114 | MAGIC_SCREENS MAGIC-08-01 | Combat menu — TakeTurn → PlayerTurn → CombatMenu 2F00:076C (player-... | — | REF-S114 | — | **NO-REF** — logic verified by trace (cab-build-engine TRACE.md) |
| S115 | MAGIC_SCREENS MAGIC-08-02 | Done menu — 'D' in MAGIC-08-01 → DoneMenu 2F00:0FE8 | — | REF-S115 | — | **NO-REF** — logic verified by trace (cab-build-engine TRACE.md) |
| S116 | MAGIC_SCREENS MAGIC-08-03 | Game speed (combat) — 'S' in MAGIC-08-02 → CombatGameSpeedMenu 2F00... | — | REF-S116 | — | **NO-REF** — logic verified by trace (cab-build-engine TRACE.md) |
| S117 | MAGIC_SCREENS MAGIC-08-04 | Move/Attack line — MoveAttack 2F00:0B06 (when the key is a blank) | — | REF-S117 | — | **NO-REF** — logic verified by trace (cab-build-engine TRACE.md) |
| S118 | MAGIC_SCREENS MAGIC-08-05 | Round messages — EndOfRound 2F00:0997 | — | — | — | **NO-REF** — logic verified by trace (cab-build-engine TRACE.md) |
| S119 | MAGIC_SCREENS MAGIC-08-06 | Attack refusal — AttackTarget 2F00:0EE9 | — | — | — | **NO-REF** — logic verified by trace (cab-build-engine TRACE.md) |
| S120 | COMBAT_SCREENS COMBAT-09-01 | Computer turn line — AiMove 3100:09C7 (every step of a computer-con... | — | REF-S120 | — | **NO-REF** — logic verified by trace (cab-build-engine TRACE.md) |
| S121 | COMBAT_SCREENS COMBAT-09-02 | Morale messages — AiCombatTurn / AiMoraleCheck 3100:1388 | — | — | — | **NO-REF** — logic verified by trace (cab-build-engine TRACE.md) |
| S122 | COMBAT_SCREENS COMBAT-13-01 | Attack result — MeleeAttack → ShowAttackResult 3A00:031D | — | REF-S122-A | — | **NO-REF** — logic verified by trace (cab-build-engine TRACE.md) |
| S123 | COMBAT_SCREENS COMBAT-13-02 | Aim menu — 'A' (Aim) in the combat menu (ov08) → SelectTarget 3A00:... | — | REF-S123 | — | **NO-REF** — logic verified by trace (cab-build-engine TRACE.md) |
| S124 | COMBAT_SCREENS COMBAT-13-03 | Manual aim — 'M' or a cursor key in COMBAT-13-02 → ManualAim 3A00:33AC | — | REF-S124 | — | **NO-REF** — logic verified by trace (cab-build-engine TRACE.md) |
| S125 | COMBAT_SCREENS COMBAT-13-04 | Attack ally? — ConfirmTarget → ConfirmAttackAlly 3A00:2F3C when the... | — | — | — | **NO-REF** — logic verified by trace (cab-build-engine TRACE.md) |
| S126 | COMBAT_SCREENS COMBAT-13-05 | Turn undead — 'T' (Turn) in the combat menu / AI → TurnUndead 3A00:... | — | — | — | **NO-REF** — logic verified by trace (cab-build-engine TRACE.md) |
| S127 | COMBAT_SCREENS COMBAT-13-06 | Flee — 'F' (Flee) in the combat menu / AI → Flee 3A00:0D1C | — | — | — | **NO-REF** — logic verified by trace (cab-build-engine TRACE.md) |
| S128 | COMBAT_SCREENS COMBAT-13-07 | Spell targeting — BeginCast 3A00:275A / CollectSpellTargets 3A00:2220 | — | — | — | **NO-REF** — logic verified by trace (cab-build-engine TRACE.md) |
| S129 | COMBAT_SCREENS COMBAT-13-08 | Monster special attacks — effect handlers EffEngulf 403F, EffEyeRay... | — | — | — | **NO-REF (unreachable: engulf / eye rays / hug / fighter sweep come from monsters that do not appear in Tilverton's opening (bar patrons, royal guards))** |
| S130 | COMBAT_SCREENS COMBAT-13-09 | The Gods intervene — `-` during a computer turn (CheckCombatHotkeys... | — | — | — | **NO-REF** — logic verified by trace (cab-build-engine TRACE.md) |
| S131 | MAGIC_SCREENS MAGIC-22-03 | Cast in combat — CastSpell in `view_Mode = 5` | — | — | — | **NO-REF** — logic verified by trace (cab-build-engine TRACE.md) |
| S132 | MAGIC_SCREENS MAGIC-22-04 | Spell result messages — the handlers (MAGIC.pas.md ov22 part B) | `sh acceptance/areas_shots.sh cleric3` → c-S132 (shot hook in ShowHealingResult) | REF-S132 | 99 | **DIFF (explained: random state)** — the DOSBox cleric runs (walk10..13) were not seeded like the build route (camp seed), so BETA's rolled abilities differ (WIS 12/16, DEX, CON); only the AC/HP digits of the roster (267,32)-(311,39) differ outside the camp picture, and the picture equals DOSBox frame acceptance/local/runs/areas1/04-magic.png exactly (animation phase) |
| S133 | MAGIC_SCREENS MAGIC-22-05 | Fire Shield — Spell_FireShield 5800:4BEC (player-controlled caster) | — | — | — | **NO-REF (unreachable: Fire Shield is a 4th-level magic-user spell; a new party's magic-user (level 5) casts up to 3rd level and has no way to it on the opening routes)** |
| S134 | MAGIC_SCREENS MAGIC-22-06 | Monster powers — the effect handlers (breath / gaze, ov22 57E3..602... | — | — | — | **NO-REF (unreachable: breath / gaze / spit attacks belong to monsters of later areas)** |
| S135 | PARTY_SCREENS PARTY-05 | ov12 effect handlers (combat, ShowCharacterMessage / ShowCombatMess... | — | — | — | **NO-REF** — logic verified by trace (cab-build-engine TRACE.md) |
| S136 | COMBAT_SCREENS COMBAT-23-01 | Damage message — DamageCharacter 5F00:1FD6 (spells, rays, items) | — | — | — | **NO-REF** — logic verified by trace (cab-build-engine TRACE.md) |
| S137 | COMBAT_SCREENS COMBAT-23-02 | Effect applied — ApplyEffect 5F00:2307 | — | — | — | **NO-REF** — logic verified by trace (cab-build-engine TRACE.md) |
| S138 | COMBAT_SCREENS COMBAT-23-03 | Stinking cloud poison — StinkingCloudCheck 5F00:0E45 (combatant in ... | — | — | — | **NO-REF** — logic verified by trace (cab-build-engine TRACE.md) |
| S139 | COMBAT_SCREENS COMBAT-23-04 | Cured / revived / removed — CureEffect 5F00:1643, ReviveCombatant 5... | — | — | — | **NO-REF** — logic verified by trace (cab-build-engine TRACE.md) |

### 8. After combat
| id | source | routine / trigger | build path | reference | px | verdict |
|---|---|---|---|---|---|---|
| S140 | COMBAT_SCREENS COMBAT-05-01 | Combat result — AfterCombat → ShowCombatResult 2900:0A7E (not in De... | — | REF-S140 | — | **NO-REF** — logic verified by trace (cab-build-engine TRACE.md) |
| S141 | COMBAT_SCREENS COMBAT-05-02 | NPC hides share — AfterCombat → NpcTakesShare 2900:14AC when an NPC... | — | — | — | **NO-REF (unreachable: needs an NPC with treasure shares in the party; none joins in Tilverton's opening)** |
| S142 | COMBAT_SCREENS COMBAT-05-03 | Treasure menu — AfterCombat → TreasureMenu 2900:106C | — | REF-S142 | — | **NO-REF** — logic verified by trace (cab-build-engine TRACE.md) |
| S143 | COMBAT_SCREENS COMBAT-05-04 | Take menu — 'T' in COMBAT-05-03 | — | — | — | **NO-REF** — logic verified by trace (cab-build-engine TRACE.md) |
| S144 | COMBAT_SCREENS COMBAT-05-05 | Loot items — 'I' in COMBAT-05-04 → TakeLootItems / ChooseLootItem 2... | — | — | — | **NO-REF** — logic verified by trace (cab-build-engine TRACE.md) |
| S145 | COMBAT_SCREENS COMBAT-05-06 | Treasure left? — E/Esc in COMBAT-05-03 while money or items remain | — | — | — | **NO-REF** — logic verified by trace (cab-build-engine TRACE.md) |
| S146 | COMBAT_SCREENS COMBAT-05-07 | Party destroyed — AfterCombat 2900:1736 when `PartyDead` and no duel | — | — | — | **NO-REF** — logic verified by trace (cab-build-engine TRACE.md) |

### 9. Program exits, copy protection, finale
| id | source | routine / trigger | build path | reference | px | verdict |
|---|---|---|---|---|---|---|
| S150 | COMBAT_SCREENS COMBAT-18-01 | Finale page 1 — ECL PROGRAM 8 → EndSequence 4E00:10FF (`view_Mode :... | — | — | — | **NO-REF (unreachable: the finale pages are shown by ECL PROGRAM 8 after the last battle of the game)** |
| S151 | COMBAT_SCREENS COMBAT-18-02 | Finale page 2 — after COMBAT-18-01 | — | — | — | **NO-REF (unreachable: the finale pages are shown by ECL PROGRAM 8 after the last battle of the game)** (page 2 follows page 1) |
| S152 | COMBAT_SCREENS COMBAT-18-03 | Finale page 3 — after COMBAT-18-02 | — | — | — | **NO-REF (unreachable: the finale pages are shown by ECL PROGRAM 8 after the last battle of the game)** (page 3 follows page 2) |
| S153 | COMBAT_SCREENS COMBAT-18-04 | Finale page 4 — after COMBAT-18-03 | — | — | — | **NO-REF (unreachable: the finale pages are shown by ECL PROGRAM 8 after the last battle of the game)** (page 4 follows page 3) |
| S154 | COMBAT_SCREENS COMBAT-18-05 | Finale page 5 — after COMBAT-18-04 | — | — | — | **NO-REF (unreachable: the finale pages are shown by ECL PROGRAM 8 after the last battle of the game)** (page 5 follows page 4) |
| S155 | COMBAT_SCREENS COMBAT-18-06 | Finale page 6 + fireworks — after COMBAT-18-05 | — | — | — | **NO-REF (unreachable: the finale pages are shown by ECL PROGRAM 8 after the last battle of the game)** (page 6 follows page 5) |

### 10. Shared UI elements and error screens (any time)
| id | source | routine / trigger | build path | reference | px | verdict |
|---|---|---|---|---|---|---|
| S160 | VIEW_SCREENS VIEW-09 | List menu — VerticalListMenu 6800:0DF9 (spell/item lists etc.) | through the rows that show it | — | 0 | **PASS** (no own reference: VerticalListMenu is the list of S066 shop items, S093 grimoire, S097 items, S106 spells in memory, all 0 px) |
| S161 | VIEW_SCREENS VIEW-10 | Yes / No — AskYesNo 6800:112A | through the rows that show it | — | 0 | **PASS** (no own reference: AskYesNo is the `Quit to DOS? Yes No` of REF-S085 (Drop) and the `Memorize these spells?` of REF-S080-CONFIRM, both 0 px) |
| S162 | VIEW_SCREENS VIEW-12 | Loading line — LoadAnimation with `opt_Animation <> 0` | — | — | — | **NO-REF** — logic verified by trace (cab-build-engine TRACE.md) |
| S166 | VIEW_SCREENS VIEW-11 | Fatal load errors — missing/invalid data | — | — | — | **NO-REF** — logic verified by trace (cab-build-engine TRACE.md) |

Summary Areas: 107 rows (2 1, 3 16, 4 11, 5 18, 6 16, 7 28, 8 7, 9 6, 10 4), 52 with a DOSBox-X reference; verdicts: DIFF 12, NO-REF 66, PASS 29.

## Plus (cab-plus-shell; spot-check standard, the owner 10/21)
One headless shot per Plus tab, where the picture is what is under test; the logic is proven by the node tests named in
each row (`node --test game/test/plus/<file>`). Shots: `node game/test/plus/tabs-shot.mjs` (shared run lock; `ONLY=<id>`
reruns one) → page screenshots `acceptance/local/plus/tab-<id>.png` (gitignored: the frame shows original art), report
`acceptance/reports/plus/PLUS-TABS.json` (pedia / map reruns: `PLUS-TABS-pedia.json`, `PLUS-TABS-map.json`). Page: a new game
in the start room (areas_shots.sh B route = REF-S049), 1000×700, Plus mounted by the boot (`?plus=0` = original mode,
acceptance/plus/GATE.md). Every shot: no console error; the panel shot checks the selected tab and its content.

| id | under test | shot | check in the shot | node tests (logic) | verdict |
|---|---|---|---|---|---|
| P-HINT | the owner 10/20: "F12 opens the Plus screen" visible the whole game, outside the 320×200 frame | tab-hint (panel closed, 1000×700) | strip `position: fixed`, below the frame (hint 388,639 224×22; frame 20,35 960×600), no overlap, inside the window, game canvas pixels unchanged by Plus | shell-store 4/4 | **PASS** |
| P-FRAME | the strip outside the frame where the frame would fill the window (640×400) | tab-frame (titles prompt REF-S015) | fit() leaves the strip (plus request #6): frame 160,85 320×200, strip 208,289 below it, no overlap, canvas unchanged | — | **PASS** |
| P-STATUS | Status tab from the hooks state (step 4) | tab-status | `ECL2/1: 3D map 1, square (7, 13), facing East`, party ALPHA, clock 00:00 day 0 | status_cab 2/2, hooks_cab | **PASS** |
| P-KEYS | Keys tab: the waiting game menu's keys | tab-keys | Area Cast View Encamp Search Look + moves, F12 / pad Menu | — | **PASS** |
| P-ABOUT | About / credits | tab-about | Pool's GBP as code base, Gold Box Companion (feature list), simeonpilgrim/coab (cross-check oracle only), no shipped content | — | **PASS** |
| P-JOURNAL | Journal tab: cited entries (when / where / line), player text only, uncited hidden | tab-journal | the cited-entries section (none cited yet in the start room) | notes_cab 5/5 (46 journal sites: hooks_cab), notes 5/5 | **PASS** |
| P-NOTES | the diary (W4) inside the Journal tab | tab-notes | a personal note added through the tracker appears in the Diary with place and time | notes_cab 5/5, notes 5/5 | **PASS** |
| P-MAP | Map tab: the player's GEO map, fog, party marker | tab-map (rerun at 50 % zoom, the map in view) | `ECL2/1 — 3D map 1`, 1 cell visited (7,13) drawn with its wall sides, gold arrow facing east, the rest fogged | map 7/7 (GEO = decode/tools/geo.py pixel for pixel; overland spots = view_ov27 tables), map-fog 9/9 | **PASS** |
| P-PEDIA | Pedia tab (cab-plus-pedia's page, registered by plus request #9) | tab-pedia (rerun: catalogue built) | catalogue from the player's files, category filter, 1 discovery in the start room (3D map 1) | pedia 7/7, pedia-reveal 6/6 | **PASS** |
| P-QUESTS | Quests tab (cab-ecl-quests's page, plus request #14) | tab-quests | the empty state of a new game ("No quests met yet") | quests 5/5 | **PASS** |
| P-DEV | dev only: Cheats + Scenario tabs (`?dev=1`), one shot | tab-dev | both tabs present only with ?dev=1 (hidden in player mode: the start-room shots' tab row has neither); Cheats page drawn | cheats_cab 6/6, eclasm 3/3 (25/25 listings byte for byte) | **PASS** (dev only) |

Summary Plus: 11 shots, 11 PASS, 0 FAIL. Not shot (by the ruling): Helpers toggles and the combat log (helpers_cab 4/4,
helpers 6/6), quick save (engine entry #11). Cheats need the engine dev entry (plus request #13) before they change the game.
