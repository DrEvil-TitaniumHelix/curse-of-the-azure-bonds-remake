# RUN-1 — new game chain (BUILD_PLAN.md §5) — cab-build-engine — PASS (19/19 after #run1-1)

Played in headless Chrome from `index.html` with keys only (no `?screen=` jumps into the game; the shot point is `idle` =
the key script is done and the game waits, or `t<s>` = after s seconds). Replay script: `acceptance/run1.sh <shot> <extra keys>`
(base route: titles by Space x4 as the DOSBox route, `P` at the Play Demo prompt, rune wheel `?wheel=1` + `a` Enter,
create the fixed party, Add all, Begin). Seed `169084438` = the DOSBox camp run's DOS-clock seed (06:22:10.20), empty save
store (`freshsaves=1`). Shots: `acceptance/local/shoot/<id>.png` (local, original art); SHA-256 and state in
`acceptance/reports/shoot/<id>.json`. Map positions from GEO2 record 1 (BFS over its wall/passage planes).

| # | step | keys after the base | shot | SHA-256 (PNG) | state / check | result |
|---|---|---|---|---|---|---|
| 1 | titles -> prompt -> wheel -> top menu -> create ALPHA -> add -> Begin: first 3D area | (base, one-member party) | r1-begin | 13a50c94…97137 | 7,13 E, block 1, data set 2; **= REF-S049 at 0 px** | PASS |
| 2 | area map | `A` | r1-map | 65d75343…3d20f | **= REF-S050 at 0 px** | PASS |
| 3 | walk W into the inn: first scripted encounter (innkeeper, portrait, journal entry 31) | `{Down}{Up}` | w-w | 0858be91…36f83f0 | 6,13 W, clock 00:01 | PASS |
| 4 | the innkeeper's explanation ("JOURNAL ENTRY 31") | `{Down}{Up}{Enter}` | r1-a | 9c5f2dc4…cdb7c | text window, 6,13 | PASS |
| 5 | N / W / N / N to the tavern sign "THE CURSE" (5,10) | route to 5,10 | r1-c | e69810c7…66eccd | 5,10 N 00:05, sky + walls | PASS |
| 6 | E into the bar: "WHAT'S YOUR PLEASURE?" PUNCH BARKEEP / HAVE A DRINK / LEAVE | + `{Enter}{Right}{Up}` | r1-d | dc685376…41fe | 6,10 E 00:06, bartender portrait | PASS |
| 7 | PUNCH BARKEEP: the brawl (10 bar patrons), combat screen | + `P` | r1-e | e07d10dd…aa23d9 | view_Mode 5, 11 combatants | PASS (no DOSBox combat reference) |
| 8 | one-member party, Quick: the combat runs 7 rounds and the party is destroyed | + `PQ…` | r1-h | 643c7eca…d57227 | "The monsters rejoice for the party has been destroyed" | ran (a loss: party too small) |
| 9 | fixed party of six (five dwarf fighters, human magic-user ZETA) begins | (base) | r1-party | adf56a1a…cd25 | 6 members, 7,13 E | PASS |
| 10 | the brawl with six, Quick for everyone (after #run1-1, 1524d4c) | route + `P` + `QN` x150 | r1-fight / r1-after | 779d4870…56b801 / dbedbc2c…0147cb | the patrons fall (all 0 HP; `CONTINUE BATTLE: YES NO` answered N), DELTA and GAMMA down; **"THE PARTY HAS WON. EACH CHARACTER RECEIVES 87 EXPERIENCE POINTS."** | PASS (was BLOCKED: StinkingCloudCheck made every AI combatant helpless) |
| 11 | camp (Encamp) in the start room | `E` | r1-camp | 56ad5c3f…659b1b | view_Mode 2 | PASS |
| 12 | camp: select ZETA, Magic, Memorize: ZETA's grimoire (MU slots 4 / 2 / 1) | `E{End}x6MM` | r1-mem | bf776f98…25d80d | spell list drawn | PASS |
| 13 | memorize Stinking Cloud (2), confirm, Rest menu: rest time 00:05:00 | + `MMMMMEEY R` | r1-rest | d12079fa…0ebcba | `Rest Days Hours Mins Add Subtract Exit` | PASS |
| 14 | rest | + `R` | r1-rested | 94824e62…0dc844 | clock 05:00 CAMPING; ZETA +70h/+71h = 22h (Stinking Cloud x2 memorized) | PASS |
| 15 | Exit, Save, game A: `Quit to DOS Yes No` | + `ESA` | r1-save | 3388c293…4d91de | 7,13 E 05:00, six members (as REF-S034-QUIT's flow) | PASS |
| 16 | quit: Y | + `Y` | r1-quit | 4420bbc3…6b9867 | TerminateGame (DOS text screen) | PASS |
| 17 | new tab, same browser save store: titles, P, wheel, **L** (Load Which Game: A), Begin | `{Space}x4 Pa{Enter}LAB` | r1-reload | 9e6d125b…c006bd | **same view 7,13 E, clock 05:00, same six members with the same AC/HP, ZETA's memorized spells kept** | PASS |
| 18 | after-combat treasure | + `{Enter}` | r1-treasure | a39dfee4…5f4a83 | treasure picture, menu `View Take Pool Exit`, the downed members in red | PASS (no DOSBox reference of this screen) |
| 19 | **save byte compare vs DOSBox**: the DOSBox camp run's own route (ALPHA, Begin, area map on/off, Encamp, Save **B**) with its seed, files read back from the browser store | base (one member) + `AAESB` | r1-saveB | 18e70d9a…0ff3a4 | `SAVGAMB.DAT` 13149 B: bytes 0000..3214 **identical** (data set, VM 4B00/7C00/7A00, script buffer, position, view modes, wall slots, member count) and the counted name `CHRDATB1` identical; the 239 other differing bytes are all in the name array's undefined part (after the counted string / entries past the count; SAVES.md §1 "stale bytes"). `CHRDATB1.SAV` 422 B: only +F2h..+F5h differ (the stale effects pointer, SAVES.md §2). `CHRDATB1.FX` 27 B: only the next-pointer bytes (+5..+8 of each 9-byte entry, SAVES.md §3) | PASS |

Scripts: `acceptance/run1.sh` (steps 1..14), `acceptance/run1_reload.sh` (15..17, two tabs of one Chrome = one save store).

Scripts: `acceptance/run1.sh` (1..14, 10, 18), `acceptance/run1_reload.sh` (15..17), `acceptance/run1_savecmp.sh` (19; DOSBox
files from `acceptance/local/saves/camp/`, local only).

**Status: PASS.** Every step of the chain runs in the build; the start room and area map are 0 px against DOSBox, and the
saved game is byte-identical to the DOSBox save of the same route in every defined byte. No new DOSBox run was needed: the
camp run (made by cab-saves-ref) already is this route up to the save, and its seed is the one the build replays.
