# CROSSREF — cross-area consistency (lane cab-crossref, cab-rt / Opus)

Gate items 7 and 9 (with `decode/pseudo/SCREENS_INDEX.md`). Sections: 1 unit map, 2 routine names, 3 shared globals,
4 cross-area calls + main loop, 5 unknowns, 6 data <-> code. Generated parts: `python -I decode/tools/crossref.py s1..s5`;
decisions and evidence are written inline. Pool model: PoolRadianceRE/decode/CROSSREF.md.

## 1. Unit -> area -> pseudo file (canonical)

Every code unit (36 overlays ov00..ov35 + 11 resident units + the TP runtime + the stub segment = 52 rows of
`decode/listings/functions.tsv`) has exactly one canonical home: the area map `herdr/assignments/cab-areas.md`
(Foreman-accepted). *documented* = the function's start address, its `ovNN_XXXX` / `FUN_SSSS_OOOO` name, or (in a
combined header `### SEG:OOOO A / OOOO B`) its offset or real name appears in the canonical file. Result: **every
function of every unit is documented in its canonical file** (961 / 961 outside the runtime ledger and the stubs).

| unit | seg | area | canonical file | functions | documented | missing (addr name) |
|---|---|---|---|---|---|---|
| main_0000 | 0000 | RESIDENT | decode/pseudo/RESIDENT.pas.md | 1 | 1 |  |
| res_0186 | 0186 | RESIDENT | decode/pseudo/RESIDENT.pas.md | 1 | 1 |  |
| res_019B | 019B | RESIDENT | decode/pseudo/RESIDENT.pas.md | 1 | 1 |  |
| res_01A0 | 01A0 | RESIDENT | decode/pseudo/RESIDENT.pas.md | 9 | 9 |  |
| res_020F | 020F | RESIDENT | decode/pseudo/RESIDENT.pas.md | 2 | 2 |  |
| res_0297 | 0297 | RESIDENT | decode/pseudo/RESIDENT.pas.md | 33 | 33 |  |
| res_0542 | 0542 | RESIDENT | decode/pseudo/RESIDENT.pas.md | 23 | 23 |  |
| res_0636 | 0636 | RESIDENT | decode/pseudo/RESIDENT.pas.md | 20 | 20 |  |
| res_06EA | 06EA | RESIDENT | decode/pseudo/RESIDENT.pas.md | 6 | 6 |  |
| res_0713 | 0713 | RESIDENT | decode/pseudo/RESIDENT.pas.md | 8 | 8 |  |
| res_097D | 097D | RESIDENT | decode/pseudo/RESIDENT.pas.md | 1 | 1 |  |
| ov00 | 2000 | ENGINE | decode/pseudo/ENGINE.pas.md | 2 | 2 |  |
| ov01 | 2100 | ENGINE | decode/pseudo/ENGINE.pas.md | 4 | 4 |  |
| ov02 | 2200 | ECL | decode/pseudo/ECL.pas.md | 60 | 60 |  |
| ov03 | 2600 | ENGINE | decode/pseudo/ENGINE.pas.md | 3 | 3 |  |
| ov04 | 2700 | MAGIC | decode/pseudo/MAGIC.pas.md | 13 | 13 |  |
| ov05 | 2900 | COMBAT | decode/pseudo/COMBAT.pas.md | 13 | 13 |  |
| ov06 | 2B00 | PARTY | decode/pseudo/PARTY.pas.md | 6 | 6 |  |
| ov07 | 2C00 | COMBAT | decode/pseudo/COMBAT.pas.md | 34 | 34 |  |
| ov08 | 2F00 | MAGIC | decode/pseudo/MAGIC.pas.md | 14 | 14 |  |
| ov09 | 3100 | COMBAT | decode/pseudo/COMBAT.pas.md | 16 | 16 |  |
| ov10 | 3300 | VIEW | decode/pseudo/VIEW.pas.md | 25 | 25 |  |
| ov11 | 3500 | ENGINE | decode/pseudo/ENGINE.pas.md | 4 | 4 |  |
| ov12 | 3600 | PARTY | decode/pseudo/PARTY.pas.md | 134 | 134 |  |
| ov13 | 3A00 | COMBAT | decode/pseudo/COMBAT.pas.md | 45 | 45 |  |
| ov14 | 3F00 | VIEW | decode/pseudo/VIEW.pas.md | 14 | 14 |  |
| ov15 | 4000 | MAGIC | decode/pseudo/MAGIC.pas.md | 31 | 31 |  |
| ov16 | 4300 | ENGINE | decode/pseudo/ENGINE.pas.md | 20 | 20 |  |
| ov17 | 4800 | ENGINE | decode/pseudo/ENGINE.pas.md | 20 | 20 |  |
| ov18 | 4E00 | COMBAT | decode/pseudo/COMBAT.pas.md | 11 | 11 |  |
| ov19 | 5000 | COMBAT | decode/pseudo/COMBAT.pas.md | 28 | 28 |  |
| ov20 | 5400 | PARTY | decode/pseudo/PARTY.pas.md | 16 | 16 |  |
| ov21 | 5500 | PARTY | decode/pseudo/PARTY.pas.md | 23 | 23 |  |
| ov22 | 5800 | MAGIC | decode/pseudo/MAGIC.pas.md | 116 | 116 |  |
| ov23 | 5F00 | COMBAT | decode/pseudo/COMBAT.pas.md | 30 | 30 |  |
| ov24 | 6200 | PARTY | decode/pseudo/PARTY.pas.md | 53 | 53 |  |
| ov25 | 6600 | PARTY | decode/pseudo/PARTY.pas.md | 14 | 14 |  |
| ov26 | 6800 | VIEW | decode/pseudo/VIEW.pas.md | 21 | 21 |  |
| ov27 | 6A00 | VIEW | decode/pseudo/VIEW.pas.md | 5 | 5 |  |
| ov28 | 6B00 | VIEW | decode/pseudo/VIEW.pas.md | 6 | 6 |  |
| ov29 | 6C00 | VIEW | decode/pseudo/VIEW.pas.md | 12 | 12 |  |
| ov30 | 6D00 | VIEW | decode/pseudo/VIEW.pas.md | 13 | 13 |  |
| ov31 | 6F00 | VIEW | decode/pseudo/VIEW.pas.md | 12 | 12 | (018E / 0199 are Ghidra splits of the sort loop 6F00:0035..019C, documented in its header as `FUN_6f00_005d/018e/0199`) |
| ov32 | 7000 | VIEW | decode/pseudo/VIEW.pas.md | 24 | 24 |  |
| ov33 | 7200 | VIEW | decode/pseudo/VIEW.pas.md | 7 | 7 |  |
| ov34 | 7300 | ECL | decode/pseudo/ECL.pas.md | 3 | 3 |  |
| ov35 | 7400 | VIEW | decode/pseudo/VIEW.pas.md | 4 | 4 |  |
| crt_09AB | 09AB | RUNTIME | decode/rt/RT_LEDGER.md | 18 | (ledger) | |
| dos_097F | 097F | RUNTIME | decode/rt/RT_LEDGER.md | 13 | (ledger) | |
| overlay_0A0D | 0A0D | RUNTIME | decode/rt/RT_LEDGER.md | 8 | (ledger) | |
| stubs | 0039 | LAYOUT | decode/LAYOUT.md | 853 | (ledger) | |
| system_0A54 | 0A54 | RUNTIME | decode/rt/RT_LEDGER.md | 114 | (ledger) | |

| area | functions | documented |
|---|---|---|
| RESIDENT | 105 | 105 |
| ENGINE | 53 | 53 |
| ECL | 63 | 63 |
| VIEW | 143 | 143 |
| COMBAT | 177 | 177 |
| MAGIC | 174 | 174 |
| PARTY | 246 | 246 |

Pointers (one canonical section, the other files refer to it):
- **ov07** (COMBAT): the ECL VM support routines (operand reader 2C00:0034, `ecl_GetMem/SetMem`, `ecl_Get/SetCharField`,
  `ecl_Get/SetMemString`, `ecl_CompareWords/Strings`, LoadEclBlock 2C00:0380) are specified in `decode/ecl/ECL_VM.md`
  §1–3 (spec of record); COMBAT.pas.md §ov07 carries the encounter / duel / damage helpers and points at ECL_VM.md for
  the four VM routines it does not repeat (0B6D, 0F3A, 145C, 1A51). ECL.pas.md §1 points there too.
- **ov08** (MAGIC): combat round loop + player turn menu live in MAGIC.pas.md (as in Pool); COMBAT.pas.md links to it.
- **ov19** (COMBAT): character sheet / View / Items / Trade / coins / spell list — 90 % PARTY UI, kept in COMBAT as
  assigned (cab-mod-combat STATUS note; Foreman decision, no move).
- **ov17** (ENGINE): top menu + character creation; PARTY.pas.md cites it (no duplicate).
- **ov12** (PARTY): the 134 effect handlers (Pool had them in PARTY too); COMBAT ov23 dispatches to them via DS:6FA6.
- **ov24** (PARTY): Pool's resident unit 00BA moved into an overlay in Curse (PARTY.pas.md §ov24 header).
- **ov02 / ov34** (ECL): ECL.pas.md §1 is an index into ECL_VM.md §4 for the 59 opcode handlers (52 rows checked in
  ECL_VERIFY.md: address, name, operand count).
- **RUNTIME** (System 0A54, Crt 09AB, Dos 097F, Overlay 0A0D): `decode/rt/RT_LEDGER.md`; **stubs** (853 overlay
  thunks): `decode/LAYOUT.md`. Empty units 0186 / 019B (init only) and 097D (CopyProtWord typed constant) are listed in
  RESIDENT.pas.md.

## 2. Routine name consistency

Union of the routine names in `decode/names/*.json` (keys `SEG:OOOO`, DS keys excluded — those are §3) against the
listings (`functions.tsv`) and every pseudo file. Generated by `python -I decode/tools/crossref.py s2`.

### 2a. Same address, different real names
**0** conflicts between the names files (CabExport NAMES_REPORT: the only two remaining conflicts are DS globals,
6E94 / 758E, §3).

### 2b. One real name on several addresses (resolved)

| name | addresses | decision | evidence | status |
|---|---|---|---|---|
| DropCharacter | 4000:199C (MAGIC ov15), 4800:260C (ENGINE ov17) | ENGINE's renamed **DropCharacterForever**; MAGIC keeps DropCharacter | 4800:260C asks `Drop NAME forever?` / `Are you sure?` and deletes the character; 4000:199C drops the member from the camp party (or quits to DOS when it is the last) | **APPLIED** (engine_names.json, ENGINE.pas.md, ENGINE_SCREENS.md) |
| CureDisease | 2700:0324 (MAGIC ov04 temple service), 5000:37EC (COMBAT ov19 paladin Cure) | COMBAT's -> **PaladinCureDisease** | 5000:37EC is the View-menu 'C' paladin cure (effect 8Dh, cures_left +191h); 2700:0324 is the temple's paid service | COMBAT fix request #xref-1 |
| EffSpitAcid | 3600:2657 (PARTY ov12, effect type 79h, Pool 5C00:2C1C), 5800:5974 (MAGIC ov22, effect 56h, new) | MAGIC's -> **EffSpitAcidRanged** (PARTY keeps the Pool name) | 5800:5974 adds the `Distance < 7` range test (5800:59ba) and the SpellHandlers[0] target call; different effect type | MAGIC fix request #xref-2 |
| GameSpeedMenu | 2F00:11DF (MAGIC ov08 combat DoneMenu 'S'), 4000:1B4D (MAGIC ov15 camp AlterMenu 'S') | ov08's -> **CombatGameSpeedMenu** | two copies of one Pool routine in two units (Pool 4800:10F6 / 6B00:1A97) | MAGIC fix request #xref-2 |

### 2c. Placeholders where the names map has a real name

Every `ovNN_XXXX` / `FUN_SSSS_OOOO` token in a pseudo file whose address has a real name in the merged map.
**Applied in the files cab-rt owns** (`python -I decode/tools/crossref.py apply2c RESIDENT ENGINE PARTY`): RESIDENT 144,
ENGINE 50, PARTY 74 replacements (argcheck stays 0 MISMATCH; OK rose RESIDENT 81 -> 87, ENGINE 56 -> 63 as more targets
resolve). Remaining in the Fable-lane files (fix requests #xref-1..4):

| file | placeholder | real name | uses |
|---|---|---|---|
| ECL | `ov15_0000` | ov15_LoadDeps | 4 |
| ECL | `ov15_23FC` | Camp | 2 |
| ECL | `ov24_2A6D` | RedrawCurrentMode | 5 |
| VIEW | `FUN_0297_09E4` | DrawPicture | 2 |
| VIEW | `FUN_0297_1110` | PutPicture | 1 |
| VIEW | `FUN_0297_21B0` | SetEgaPaletteRegisterRaw | 2 |
| VIEW | `FUN_06EA_024C` | FlushGameKeys | 7 |
| VIEW | `ov07_0552` | ShowHeadBodyPicture | 1 |
| VIEW | `ov13_2E22` | CalcEnemyHpPct | 1 |
| VIEW | `ov15_04CB` | CastMenu | 1 |
| VIEW | `ov19_0B75` | ViewMenu | 1 |
| VIEW | `ov19_32DC` | CycleSelectedChar | 1 |
| VIEW | `ov23_03FE` | CallEffectHooks | 2 |
| VIEW | `ov23_137F` | Roll | 2 |
| VIEW | `ov24_25D4` | CountActiveSides | 1 |
| VIEW | `ov24_2A6D` | RedrawCurrentMode | 2 |
| VIEW | `ov24_2BAA` | DrawLocationTimeStatus | 3 |
| VIEW | `ov25_134A` | CurrentClassLevel | 1 |
| VIEW | `ov25_13BC` | DualClassActive | 3 |
| VIEW | `ov26_03D4` | HorizontalMenu | 1 |
| VIEW | `ov28_00CC` | RefreshView | 2 |
| VIEW | `ov30_0000` | ov30_LoadDeps | 1 |
| VIEW | `ov32_0011` | FootprintCell | 1 |
| COMBAT | `ov06_0355` | AddItemToChar | 3 |
| COMBAT | `ov13_0124` | CalcMove | 2 |
| COMBAT | `ov13_074F` | StepCombatant | 2 |
| COMBAT | `ov13_095A` | AttacksOfOpportunity | 2 |
| COMBAT | `ov13_0D1C` | Flee | 2 |
| COMBAT | `ov13_0DD9` | CalcAttacks | 2 |
| COMBAT | `ov13_0F46` | FighterSweep | 2 |
| COMBAT | `ov13_1144` | CanAttack | 3 |
| COMBAT | `ov13_1227` | TurnUndead | 2 |
| COMBAT | `ov13_1433` | FindTurnTarget | 2 |
| COMBAT | `ov13_194A` | FaceAttacker | 2 |
| COMBAT | `ov13_19D8` | Attack | 2 |
| COMBAT | `ov13_1D9D` | ov13_LoadDeps | 1 |
| COMBAT | `ov13_1DF6` | FindHealTarget | 2 |
| COMBAT | `ov13_275A` | BeginCast | 2 |
| COMBAT | `ov13_29A2` | DirectionTo | 4 |
| COMBAT | `ov13_2E22` | CalcEnemyHpPct | 1 |
| COMBAT | `ov13_2EAC` | MaxEnemyMove | 2 |
| COMBAT | `ov13_3E56` | AutoTarget | 4 |
| COMBAT | `ov13_48DC` | GodsIntervene | 2 |
| COMBAT | `ov16_3254` | LoadMonster | 3 |
| COMBAT | `ov19_0B75` | ViewMenu | 3 |
| COMBAT | `ov19_1EE9` | ReadyItem | 8 |
| COMBAT | `ov19_248D` | UseItem | 3 |
| COMBAT | `ov19_32DC` | CycleSelectedChar | 7 |
| COMBAT | `ov19_3474` | SpellList | 3 |
| COMBAT | `ov21_0073` | WouldOverload | 3 |
| COMBAT | `ov21_00C7` | MoneyValueInGold | 3 |
| COMBAT | `ov21_0149` | SetCharMoneyGold | 3 |
| COMBAT | `ov21_019E` | SetPoolMoneyGold | 3 |
| COMBAT | `ov21_02AD` | InputNumber | 4 |
| COMBAT | `ov21_046B` | TransferCoins | 3 |
| COMBAT | `ov21_0527` | PoolMoney | 3 |
| COMBAT | `ov21_064F` | ShareMoney | 3 |
| COMBAT | `ov21_0A03` | DropCoinsToPool | 2 |
| COMBAT | `ov21_0B91` | CoinFromText | 4 |
| COMBAT | `ov21_0CF0` | TakeMoney | 4 |
| COMBAT | `ov21_0F5B` | TreasurePoolStatus | 6 |
| COMBAT | `ov22_0219` | ChooseSpell | 3 |
| COMBAT | `ov22_09FC` | BuildSpellList | 3 |
| COMBAT | `ov22_0D67` | SpellRange | 7 |
| COMBAT | `ov22_1263` | CastSpell | 18 |
| COMBAT | `ov22_612E` | IsScroll | 12 |
| COMBAT | `ov22_617B` | UseScrollSpell | 3 |
| COMBAT | `ov23_0016` | KillCombatant | 5 |
| COMBAT | `ov23_00C9` | CallEffectHandler | 8 |
| COMBAT | `ov23_010E` | RemoveEffect | 22 |
| COMBAT | `ov23_03FE` | CallEffectHooks | 22 |
| COMBAT | `ov23_0E45` | StinkingCloudCheck | 3 |
| COMBAT | `ov23_123F` | AttackRoll | 3 |
| COMBAT | `ov23_12EB` | SavingThrow | 2 |
| COMBAT | `ov23_137F` | Roll | 1 |
| COMBAT | `ov23_13CA` | RollDice | 5 |
| COMBAT | `ov23_13EE` | AddEffect | 12 |
| COMBAT | `ov23_149D` | RemoveFromCombat | 6 |
| COMBAT | `ov23_15A1` | RemoveCombatEffects | 3 |
| COMBAT | `ov23_18D8` | RecalcAbility | 12 |
| COMBAT | `ov23_1FD6` | DamageCharacter | 6 |
| COMBAT | `ov23_23FB` | HealCharacter | 3 |
| COMBAT | `ov24_0467` | BuildItemName | 22 |
| COMBAT | `ov24_0939` | DrawAC | 3 |
| COMBAT | `ov24_09C1` | DrawHP | 3 |
| COMBAT | `ov24_0A34` | DrawCharacterSummary | 16 |
| COMBAT | `ov24_0BE3` | IsHelpless | 14 |
| COMBAT | `ov24_10CB` | ByteToStr | 29 |
| COMBAT | `ov24_1107` | WordToStr | 14 |
| COMBAT | `ov24_1141` | LongToStr | 3 |
| COMBAT | `ov24_120A` | DexMissileAdj | 3 |
| COMBAT | `ov24_148F` | StrWeightAllowance | 3 |
| COMBAT | `ov24_1583` | ForgetMemorizedSpell | 5 |
| COMBAT | `ov24_16E6` | AppendItemCopy | 3 |
| COMBAT | `ov24_177A` | ShowTimedBottomMessage | 38 |
| COMBAT | `ov24_17D6` | ShowCharacterMessage | 40 |
| COMBAT | `ov24_18BE` | ClearCharacterMessage | 19 |
| COMBAT | `ov24_18F3` | DrawCharacterName | 12 |
| COMBAT | `ov24_1975` | CopyCombatAnimationFrame | 14 |
| COMBAT | `ov24_1AAA` | BuildFourAnimationFrames | 6 |
| COMBAT | `ov24_1AF7` | AnimateAlongPath | 7 |
| COMBAT | `ov24_21DD` | ShowCombatMessageAnimation | 6 |
| COMBAT | `ov24_2421` | ApplyDamage | 8 |
| COMBAT | `ov24_25B0` | IsSideZero | 11 |
| COMBAT | `ov24_25D4` | CountActiveSides | 7 |
| COMBAT | `ov24_2628` | CollectOppositeSideTargets | 25 |
| COMBAT | `ov24_274C` | TargetDistance | 14 |
| COMBAT | `ov24_2828` | ClearCombatantActionFlags | 38 |
| COMBAT | `ov24_2877` | SetGuarding | 3 |
| COMBAT | `ov24_28B3` | SpellCasterLevel | 4 |
| COMBAT | `ov24_2A6D` | RedrawCurrentMode | 21 |
| COMBAT | `ov24_2E6A` | SelectPartyCharacter | 9 |
| COMBAT | `ov24_3018` | WeaponIsRanged | 16 |
| COMBAT | `ov24_30A0` | GetMissileAmmo | 11 |
| COMBAT | `ov24_3387` | BandageDying | 4 |
| COMBAT | `ov25_0AD8` | UpdateThiefSkills | 5 |
| COMBAT | `ov25_1292` | FormerClass | 4 |
| COMBAT | `ov25_12EE` | CurrentClass | 4 |
| COMBAT | `ov25_134A` | CurrentClassLevel | 3 |
| COMBAT | `ov25_13BC` | DualClassActive | 17 |
| MAGIC | `ov13_2220` | CollectSpellTargets | 1 |
| MAGIC | `ov19_0B75` | ViewMenu | 2 |
| MAGIC | `ov19_32DC` | CycleSelectedChar | 8 |
| MAGIC | `ov20_0C9C` | RestLoop | 3 |
| MAGIC | `ov21_00C7` | MoneyValueInGold | 2 |
| MAGIC | `ov21_0149` | SetCharMoneyGold | 2 |
| MAGIC | `ov21_019E` | SetPoolMoneyGold | 2 |
| MAGIC | `ov21_0527` | PoolMoney | 3 |
| MAGIC | `ov21_064F` | ShareMoney | 3 |
| MAGIC | `ov21_0CF0` | TakeMoney | 3 |
| MAGIC | `ov21_0F5B` | TreasurePoolStatus | 4 |
| MAGIC | `ov21_198C` | AppraiseGems | 3 |
| MAGIC | `ov22_10D2` | SelectTargetsCamp | 1 |
| MAGIC | `ov22_2799` | Spell_StinkingCloud | 1 |
| MAGIC | `ov22_2BF9` | Spell_Strength | 1 |
| MAGIC | `ov22_2DB6` | Spell_AnimateDead | 2 |
| MAGIC | `ov22_317E` | Spell_DispelMagic | 2 |
| MAGIC | `ov22_3599` | Spell_RemoveCurse | 3 |
| MAGIC | `ov22_370E` | Spell_Fireball | 2 |
| MAGIC | `ov22_3D27` | Spell_Restoration | 1 |
| MAGIC | `ov22_4F3E` | Spell_CloudKill | 1 |
| MAGIC | `ov24_0A34` | DrawCharacterSummary | 4 |
| MAGIC | `ov24_0BE3` | IsHelpless | 3 |
| MAGIC | `ov24_10CB` | ByteToStr | 11 |
| MAGIC | `ov24_1107` | WordToStr | 2 |
| MAGIC | `ov24_1583` | ForgetMemorizedSpell | 4 |
| MAGIC | `ov24_177A` | ShowTimedBottomMessage | 17 |
| MAGIC | `ov24_17D6` | ShowCharacterMessage | 39 |
| MAGIC | `ov24_18BE` | ClearCharacterMessage | 12 |
| MAGIC | `ov24_18F3` | DrawCharacterName | 2 |
| MAGIC | `ov24_1AAA` | BuildFourAnimationFrames | 10 |
| MAGIC | `ov24_1AF7` | AnimateAlongPath | 9 |
| MAGIC | `ov24_21DD` | ShowCombatMessageAnimation | 8 |
| MAGIC | `ov24_2543` | ShowHealingResult | 4 |
| MAGIC | `ov24_25B0` | IsSideZero | 3 |
| MAGIC | `ov24_25D4` | CountActiveSides | 4 |
| MAGIC | `ov24_2628` | CollectOppositeSideTargets | 2 |
| MAGIC | `ov24_274C` | TargetDistance | 1 |
| MAGIC | `ov24_2828` | ClearCombatantActionFlags | 16 |
| MAGIC | `ov24_2877` | SetGuarding | 2 |
| MAGIC | `ov24_28B3` | SpellCasterLevel | 1 |
| MAGIC | `ov24_2A6D` | RedrawCurrentMode | 17 |
| MAGIC | `ov24_2BAA` | DrawLocationTimeStatus | 6 |
| MAGIC | `ov24_2E6A` | SelectPartyCharacter | 2 |
| MAGIC | `ov24_3018` | WeaponIsRanged | 3 |
| MAGIC | `ov24_3162` | RacialLevelLimitReached | 3 |
| MAGIC | `ov24_3387` | BandageDying | 4 |
| MAGIC | `ov25_03B1` | UpdateLevelStats | 3 |
| MAGIC | `ov25_13BC` | DualClassActive | 4 |

169 placeholder/name pairs


### 2d. Header names vs the listings
One difference: `0000:002F MainProgram` (RESIDENT) is Ghidra's `entry` — kept (the TP program body; `entry` is the
loader's name for the MZ entry point).

### 2e. Call signatures across files (argument order and count)
Scripted comparison of every call in every pseudo file (number of arguments, position of the string argument) for
routines called from two or more files. Found and **APPLIED** in the cab-rt files:
- `AskYesNo(prompt, c1, c2, c3)` (VIEW 6800:112A, pushes the string first: e.g. 4800:262f..2656): ENGINE had 8 calls
  and PARTY 1 call written `AskYesNo(c1, c2, c3, prompt)` — reordered.
- `HorizontalMenu(prompt, options, c1, c2, c3, allowExt, animate, var ext)`: 4 ENGINE calls (4300:0f25, 381a, 3f10,
  4800:36a4) omitted the pushed `var ext` (e.g. 4300:0f1f..0f24 `LEA DI,[BP-0EFh]; PUSH SS; PUSH DI`) — added.
Remaining differences are benign: TP intrinsics with optional arguments (BlockRead, Reset, Rewrite, Str, Val, Inc,
WriteLn, GetMem in VIEW's prose), `MenuSelect` / `HorizontalMenu` calls whose prompt is a variable, and
`LoadDaxRecord` written with 4 arguments in VIEW prose (L271 `LoadDaxRecord(name + Str(DataSet) + '.dax', id, p, size)`
— RESIDENT 0636:08DE takes `(name, ext, id, var size, var buf)`: VIEW folds the extension into the name and swaps
p / size; VIEW fix request #xref-3).

## 3. Shared globals (DS 0C1C, used by >= 2 areas)

Every DS offset that code of two or more areas references (`decode/globals_xref.tsv`, unit -> area as §1; TP runtime
references ignored), with its one name (`decode/names/globals.json` = lane names > evidence names > unanimous Pool votes),
the type guess of GLOBALS.md, and per area whether it writes (W) or only reads (R). Generated by
`python -I decode/tools/crossref.py s3` after `globals.py`. Full per-reference detail: GLOBALS.md / globals_xref.tsv.

Applied in this pass (decode/tools/globals.py `EVID`, regenerated GLOBALS.md / globals.json):
- names already used by the pseudo files / ECL_VM.md §6 but missing from every names file: `ecl_Restart` 47E1,
  `ecl_LastOp` 75FE, `ecl_VecA` 4FAA, `ecl_VecB` 4FAC, `ecl_Block` 8B5E, `DebugFlag` 4FC1, `Resuming` 4FC2,
  `PartyDead` 4FC7, `VideoMode` 4FE6, `ecl_OpType/OpHi/OpLo` 7685/76C5/7705, `snd_Step` 25C0 (M);
- record fields read through constant displacements (folded `table[i].field`): `spells_Table_level/range/target/
  harmless/saveType/effect/aiValue/needsTarget/areaSize` (37DB..37E9, field names from COMBAT §header and the MAGIC
  spell table) and `ItemTypeTable_hands/range/usableBy/wflags2` (5CF7, 5D02..5D04);
- segment words / inner words take the final name of their parent (`SelectedChar_hi`, `PartyList_hi`, `view_Pic_hi`,
  `cloud_List_hi`, ...: 19 rows) instead of `g_XXXX_hi`;
- globals request #3 (MAGIC) was served at a320232: `combat_MaxRounds` 758E (+ `foe_List` 758F), `cm_Map_hi` 6E94
  (+ `tg_List` 6E97), `opt_Pics` 4FBE, `opt_Animation` 4FBF. The only open export conflicts are the two lane files
  that still key `foe_List` at 758E (combat_names.json) and `tg_List` at 6E94 (eclview_names.json): VIEW fix request
  #verify-50 / COMBAT_VERIFY note. No other `globals request` is open in STATUS.md.

Remaining placeholders among the shared globals (56; owners and meaning in §5): mostly display-state bytes of the
ECL / COMBAT hand-off (8B48..8B6F, ECL_VM.md §6 "display state flags", M), DS:00A8..0150 small displacements
through DS pointers (L), the 1-based array bases (7431 = SpellTargets - 4, 65DA = icon_Pic + 4), and table copies
used by one statement each.

| DS | name | type | areas: W = writes, R = reads only | meaning / evidence |
|---|---|---|---|---|
| 00A8 | g_00A8 | var/record (address taken) | RESIDENT R, ENGINE R | small displacement without a direct reference: probably a record field via a DS pointer |
| 00D8 | g_00D8 | var/record (address taken) | RESIDENT R, COMBAT R, PARTY R | small displacement without a direct reference: probably a record field via a DS pointer |
| 00FF | g_00FF | var/record (address taken) | RESIDENT R, ECL R, COMBAT R | small displacement without a direct reference: probably a record field via a DS pointer |
| 0150 | g_0150 | var/record (address taken) | RESIDENT R, ENGINE R, VIEW R |  |
| 04E9 | g_04E9 | var/record (address taken) | VIEW R, MAGIC R |  |
| 0AC8 | g_0AC8 | var/record (address taken) | VIEW R, COMBAT R |  |
| 0CA2 | CoinValue | array (elem 4 B?) | ENGINE R, COMBAT R, PARTY R | name from combat_names.json |
| 0CAE | g_0CAE | far pointer | COMBAT R, PARTY R |  |
| 25A2 | g_25A2 | var/record (address taken) | ENGINE R, VIEW R |  |
| 25AA | SndShutdown | word | RESIDENT R, ECL R | name from resident_names.json |
| 25C0 | snd_Step | word | ECL R, VIEW R, COMBAT R | sound word played for a party step (ecl_GameLoop 2200:39e4, VIEW StepForward3D, COMBAT 3a00:091e combatant ... |
| 25C2 | g_25C2 | word | ECL R, MAGIC R |  |
| 2694 | step_dx | array (elem 1 B?) | VIEW R, COMBAT R, MAGIC R, PARTY R | name from combat_names.json |
| 269D | step_dy | array (elem 1 B?) | VIEW R, COMBAT R, MAGIC R, PARTY R | name from combat_names.json |
| 26A2 | CombatTerrain | array (elem 1 B?) | VIEW R, COMBAT R, MAGIC R | name = Pool 2744 CombatTerrain (9/9 aligned) |
| 27C9 | HelplessEffectIds | array (elem 1 B?) | COMBAT R, PARTY R | name from combat_names.json |
| 27D7 | CloudSquareDir | array (elem 1 B?) | MAGIC R, PARTY R | name = Pool 290D CloudSquareDir (4/4 aligned) |
| 27DB | CloudDirs9 | array (elem 1 B?) | MAGIC R, PARTY R | name from magic_names.json |
| 37DA | spells_Table | array (elem 1 B?) | COMBAT R, MAGIC R, PARTY R | name from combat_names.json |
| 37DB | spells_Table_level | array (elem 1 B?) | COMBAT R, MAGIC R, PARTY R | spells_Table (37DA, 16-byte records by spell id) +1: spell level (MAGIC Spell table `lvl`) |
| 37E0 | spells_Table_target | array (elem 1 B?) | COMBAT R, MAGIC R | spells_Table +6: target code, low nibble (COMBAT 3a00:2262 `and 0Fh`) |
| 37E2 | spells_Table_harmless | array (elem 1 B?) | COMBAT R, MAGIC R, PARTY R | spells_Table +8 (COMBAT name `harmless`, M) |
| 37E3 | spells_Table_saveType | array (elem 1 B?) | COMBAT R, MAGIC R | spells_Table +9: saving-throw type (COMBAT, AiSpellUseful 3100:0390) |
| 37E4 | spells_Table_effect | array (elem 1 B?) | COMBAT R, MAGIC R | spells_Table +0Ah: effect type given (MAGIC Spell table `eff`) |
| 3E38 | BaseThac0 | array (elem 1 B?) | ENGINE R, PARTY R | name from party_names.json |
| 3EA0 | ClassBit | array (elem 1 B?) | ENGINE R, PARTY R | name from party_names.json |
| 3EB9 | LevelCap | array (elem 1 B?) | ENGINE R, COMBAT R | name from combat_names.json |
| 3FF8 | RaceClasses | array (elem 1 B?) | ENGINE R, PARTY R | name from party_names.json |
| 4172 | ClassPrimeReq | array (elem 1 B?) | ENGINE R, PARTY R | name from party_names.json |
| 41D8 | ClassAligns | array (elem 1 B?) | ENGINE R, PARTY R | name from party_names.json |
| 4291 | XpTable | array (elem 4 B?) | ENGINE R, MAGIC R | name from magic_names.json |
| 4293 | XpTable_hi | array (elem 2 B?) | ENGINE R, MAGIC R | inside XpTable (+2h) |
| 44A9 | SpellSlotTable | array (elem 1 B?) | COMBAT R, PARTY R | name from combat_names.json |
| 4F98 | g_4F98 | byte | RESIDENT W, ENGINE R |  |
| 4F99 | ecl_Mem4B00 | far pointer | ENGINE R, ECL R, VIEW R, COMBAT R, MAGIC R, PARTY R | name from engine_names.json |
| 4F9D | ecl_Mem7C00 | far pointer | ENGINE R, ECL R, VIEW R, COMBAT R, MAGIC R, PARTY R | name from engine_names.json |
| 4FA1 | ecl_Mem7A00 | far pointer | ENGINE R, COMBAT R | name from engine_names.json |
| 4FA5 | ecl_CodeBuf | far pointer | ENGINE R, ECL R, COMBAT R | name = Pool 49DE ecl_CodeBuf (17/17 aligned) |
| 4FA9 | GameSpeed | byte | RESIDENT W, ENGINE W, COMBAT R, MAGIC W, PARTY R | name = Pool 49E2 GameSpeed (20/20 aligned) |
| 4FAA | ecl_VecA | word | ECL R, COMBAT W | ECL_VM.md §6 vectors A..E (4FAA..4FB2); ecl_GameLoop runs it before the move (2200:3964) |
| 4FAC | ecl_VecB | word | ECL R, VIEW R, COMBAT W | ECL_VM.md §6; ecl_GameLoop runs it after the move / for Look (2200:39f8, 3922) |
| 4FAE | ecl_VecC | word | ECL R, COMBAT W | name = Pool 49E7 ecl_VecC (2/2 aligned) |
| 4FB0 | ecl_VecD | word | ECL R, COMBAT W | name = Pool 49E9 ecl_VecD (2/2 aligned) |
| 4FB2 | ecl_VecE | word | ECL R, COMBAT W | name = Pool 49EB ecl_VecE (2/2 aligned) |
| 4FB4 | ecl_PC | word | ENGINE W, ECL W, VIEW W, COMBAT W | name = Pool 49ED ecl_PC (37/37 aligned) |
| 4FBA | view_Mode | byte | ENGINE W, ECL W, VIEW W, COMBAT W, MAGIC W, PARTY W | name from eclview_names.json |
| 4FBB | view_PrevMode | byte | ENGINE W, ECL W, COMBAT W | name from eclview_names.json |
| 4FBC | DemoMode | byte | RESIDENT W, ENGINE W, ECL R, COMBAT R, MAGIC R | name from resident_names.json |
| 4FBE | opt_Pics | byte | ENGINE W, MAGIC W | camp Pics on/off toggle (ov15 4000:1E9A test / 1EA7 store); Pool vote was opt_MonsterPics |
| 4FBF | opt_Animation | byte | ENGINE W, VIEW R, MAGIC W | camp Animation on/off toggle (ov15 4000:1EB0 test / 1EBD store); Pool vote was opt_Portraits |
| 4FC1 | DebugFlag | byte | RESIDENT W, ENGINE W, ECL R, PARTY R | ECL_VM.md §6 TraceFlag: ecl_Run 2200:3658 prints every opcode name (ov34) when <> 0 |
| 4FC2 | Resuming | byte | ENGINE W, ECL W, COMBAT R | ECL_VM.md §6: a loaded save is being resumed (ecl_GameLoop 2200:3802 / 388f) |
| 4FC3 | RestEncCounter | word | ENGINE W, PARTY W | name from party_names.json |
| 4FC5 | pic_HeadId | ? | COMBAT W, PARTY R | name from combat_names.json |
| 4FC6 | pic_BodyId | ? | COMBAT W, PARTY R | name from combat_names.json |
| 4FC7 | PartyDead | byte | ENGINE W, ECL W, VIEW R, COMBAT W | ECL_VM.md §6: ends ecl_Run (2200:363a) and the game loop (3a06); set by PROGRAM 3, DAMAGE, AfterCombat |
| 4FC9 | TextOutputActive | byte | RESIDENT R, ENGINE W, ECL W, VIEW W, COMBAT W, MAGIC W | name = Pool 4A00 TextOutputActive (6/6 aligned) |
| 4FCA | Regs | byte | RESIDENT W, COMBAT W | name = Pool 4A02 Regs (5/5 aligned) |
| 4FCB | g_4FCB | byte | RESIDENT W, COMBAT W |  |
| 4FCD | g_4FCD | byte | RESIDENT W, COMBAT W |  |
| 4FCE | g_4FCE | ? | RESIDENT W, COMBAT W |  |
| 4FD0 | g_4FD0 | ? | RESIDENT W, COMBAT W |  |
| 4FE6 | VideoMode | byte | RESIDENT W, ENGINE R, VIEW R, COMBAT R | 0 = CGA, 1 = EGA ... (RESIDENT startup configuration; VIEW frame-size test 6c00:03c3, COMBAT finale 4e00:006d) |
| 4FE8 | view_Pic | far pointer | RESIDENT R, ENGINE R, VIEW R, COMBAT R, PARTY R | name from eclview_names.json |
| 4FEA | view_Pic_hi | word | ENGINE R, VIEW R, COMBAT R, PARTY R | inside view_Pic (+2h) |
| 4FEC | PicSaveBuf | word | RESIDENT R, ENGINE R, PARTY R | name from resident_names.json |
| 4FEE | g_4FEE | word | RESIDENT R, PARTY R |  |
| 5000 | view_LineDirty | array (elem 1 B?) | RESIDENT W, ENGINE R | name = Pool 4A28 view_LineDirty (6/6 aligned) |
| 50A8 | view_SpanScreenX | array (elem 2 B?) | RESIDENT W, ENGINE R | name = Pool 4AD0 view_SpanScreenX (7/7 aligned) |
| 51F8 | view_SpanFirst | array (elem 2 B?) | RESIDENT W, ENGINE R | name = Pool 4C20 view_SpanFirst (12/12 aligned) |
| 5348 | view_SpanLast | array (elem 2 B?) | RESIDENT W, ENGINE R | name = Pool 4D70 view_SpanLast (10/10 aligned) |
| 5738 | cga_LineSeg | array (elem 2 B?) | RESIDENT R, ENGINE W | name = Pool 4EC0 cga_LineSeg (2/2 aligned) |
| 58C8 | ega_LineOfs | array (elem 2 B?) | RESIDENT R, ENGINE W | name = Pool 5050 ega_LineOfs (2/2 aligned) |
| 5A58 | m2_LineSeg | array (elem 2 B?) | RESIDENT R, ENGINE W | name = Pool 51E0 m2_LineSeg (2/2 aligned) |
| 5BEC | SoundTimerOn | byte | RESIDENT W, ENGINE W, ECL R | name from resident_names.json |
| 5BEE | DataSet | byte | RESIDENT W, ENGINE W, ECL R, VIEW R, COMBAT R | name = Pool 5376 DataSet (17/17 aligned) |
| 5BEF | PrevDataSet | byte | RESIDENT W, ENGINE W | name = Pool 5377 PrevDataSet (2/2 aligned) |
| 5BF0 | SavePath | var/record (address taken) | RESIDENT R, ENGINE R | name from resident_names.json |
| 5CF0 | NoDiskPrompt | byte | RESIDENT R, ENGINE W, COMBAT W | name = Pool 557C NoDiskPrompt (4/4 aligned) |
| 5CF1 | GameSaved | byte | ENGINE W, ECL W, PARTY R | name from engine_names.json |
| 5CF6 | ItemTypeTable | array (elem 1 B?) | ENGINE R, COMBAT R, MAGIC R, PARTY R | name from engine_names.json |
| 5CF7 | ItemTypeTable_hands | array (elem 1 B?) | COMBAT R, PARTY R | ItemTypeTable (5CF6, 16-byte records by item type) +1: hands (COMBAT 3100:1687) |
| 5D02 | ItemTypeTable_range | array (elem 1 B?) | COMBAT R, PARTY R | ItemTypeTable +0Ch: range (COMBAT 3100:0eea, PARTY ov24) |
| 5D03 | ItemTypeTable_usableBy | array (elem 1 B?) | COMBAT R, PARTY R | ItemTypeTable +0Dh: class mask of the users (COMBAT 3100:178c) |
| 5D04 | ItemTypeTable_wflags2 | array (elem 1 B?) | COMBAT R, PARTY R | ItemTypeTable +0Eh: weapon flags (2 = missile/DEX, 8 / 10h = missile kinds; PARTY 6200:005f, COMBAT 3100:17d2) |
| 6506 | SelectedChar | far pointer | ENGINE W, ECL W, VIEW W, COMBAT W, MAGIC W, PARTY R | name = Pool 5D92 SelectedChar (335/335 aligned) |
| 6508 | SelectedChar_hi | word | ENGINE W, ECL W, VIEW W, COMBAT W, MAGIC W, PARTY R | inside SelectedChar (+2h) |
| 650A | PartyList | far pointer | RESIDENT R, ENGINE W, ECL R, VIEW R, COMBAT R, MAGIC W, PARTY R | name from resident_names.json |
| 650C | PartyList_hi | word | ENGINE W, ECL R, VIEW R, MAGIC W, PARTY R | inside PartyList (+2h) |
| 650E | treasure_Mark | word | VIEW W, COMBAT W | name from combat_names.json |
| 6510 | g_6510 | word | VIEW W, COMBAT W |  |
| 6594 | FontPtr | far pointer | RESIDENT R, ENGINE R | name = Pool 5E20 FontPtr (3/3 aligned) |
| 65A0 | text_Col | byte | RESIDENT W, ECL W, COMBAT W | name = Pool 5E24 text_Col (22/22 aligned) |
| 65A1 | text_Row | byte | RESIDENT W, ECL W, COMBAT W, PARTY W | name = Pool 5E25 text_Row (25/25 aligned) |
| 65B6 | sym_Block | array (elem 4 B?) | ENGINE R, VIEW R | name from eclview_names.json |
| 65CA | scratch_Pic | far pointer | ENGINE R, VIEW R | name from eclview_names.json |
| 65CE | tile_Set | far pointer | ENGINE R, VIEW R | name from eclview_names.json |
| 65D6 | icon_Pic | array (elem 4 B?) | ENGINE R, VIEW R, PARTY R | name from eclview_names.json |
| 65D8 | icon_Pic_hi | array (elem 2 B?) | ENGINE R, VIEW R, PARTY R | inside icon_Pic (+2h) |
| 65DA | g_65DA | array (elem 4 B?) | ENGINE R, VIEW R |  |
| 65DC | g_65DA_hi | array (elem 2 B?) | ENGINE R, VIEW R | inside g_65DA (+2h) |
| 66A3 | cb_Col | array (elem 1 B?) | VIEW W, COMBAT W | name from eclview_names.json |
| 66A4 | cb_Row | array (elem 1 B?) | VIEW W, COMBAT W | name from eclview_names.json |
| 66A6 | cb_Size | byte | VIEW W, COMBAT W | name from eclview_names.json |
| 67C6 | cb_ScrCol | array (elem 1 B?) | VIEW W, PARTY R | name from eclview_names.json |
| 680E | cb_ScrRow | array (elem 1 B?) | VIEW W, PARTY R | name from eclview_names.json |
| 6D35 | cb_Char | array (elem 4 B?) | VIEW W, COMBAT R, MAGIC R, PARTY R | name from eclview_names.json |
| 6D37 | cb_Char_hi | array (elem 2 B?) | VIEW W, COMBAT R, MAGIC R | inside cb_Char (+2h) |
| 6E52 | corpse_List | array (elem 4 B?) | VIEW W, COMBAT R, PARTY R | name from eclview_names.json |
| 6E54 | corpse_List_hi | array (elem 2 B?) | VIEW W, COMBAT R, PARTY R | inside corpse_List (+2h) |
| 6E56 | g_6E56 | array (elem 1 B?) | VIEW W, COMBAT R, MAGIC R, PARTY R |  |
| 6E57 | g_6E57 | array (elem 1 B?) | VIEW W, COMBAT R, MAGIC R, PARTY R |  |
| 6E58 | g_6E58 | array (elem 1 B?) | VIEW W, MAGIC R |  |
| 6E91 | corpse_Count | byte | VIEW W, COMBAT R, MAGIC R, PARTY R | name from eclview_names.json |
| 6E92 | cm_Map | far pointer | VIEW R, COMBAT R, MAGIC W, PARTY R | name from eclview_names.json |
| 6E94 | cm_Map_hi | word | VIEW W, COMBAT R, MAGIC W, PARTY R | segment word of the cm_Map far pointer (PUSH [6E94] / PUSH [6E92]; ov08 EndCombat 2F00:00CD..00D0 zeroes both) |
| 6E95 | cm_Map_3 | array (elem 1 B?) | VIEW W, PARTY R | inside cm_Map (+3h) |
| 6E96 | tg_Count | byte | VIEW W, COMBAT R, MAGIC R, PARTY W | name from eclview_names.json |
| 6E97 | tg_List | var/record (address taken) | COMBAT R, PARTY R | 1-based 3-byte records indexed [DI*3+6E94/6E95/6E96], i >= 1 (element 0 overlaps cm_Map_hi and tg_Count) |
| 6F70 | TreasureMoney | far pointer | ECL W, COMBAT W, MAGIC R, PARTY W | name = Pool 67F4 TreasureMoney (17/17 aligned) |
| 6F72 | TreasureMoney_hi | array (elem 2 B?) | ECL W, COMBAT W, PARTY W | inside TreasureMoney (+2h) |
| 6F7C | g_6F7C | far pointer | COMBAT R, PARTY W |  |
| 6F80 | g_6F80 | far pointer | COMBAT W, PARTY W |  |
| 6F82 | g_6F80_hi | word | COMBAT W, PARTY W | inside g_6F80 (+2h) |
| 6F8C | TreasureItems | far pointer | ENGINE W, ECL W, COMBAT W, PARTY R | name = Pool 6810 TreasureItems (24/24 aligned) |
| 6F8E | TreasureItems_hi | word | ENGINE W, ECL W, COMBAT W, PARTY R | inside TreasureItems (+2h) |
| 6F90 | side_ActiveCount | byte | VIEW R, COMBAT R, MAGIC R, PARTY W | name from combat_names.json |
| 6F91 | g_6F91 | byte | MAGIC R, PARTY W |  |
| 6F92 | SaveRoll | byte | COMBAT W, PARTY W | name from combat_names.json |
| 6F93 | EffectToApply | byte | COMBAT W, MAGIC W, PARTY W | name from combat_names.json |
| 6F94 | DamageAmount | byte | COMBAT W, MAGIC W, PARTY W | name = Pool 6818 DamageAmount (44/44 aligned) |
| 6F95 | DamageType | byte | COMBAT W, MAGIC W, PARTY W | name from combat_names.json |
| 6F96 | StatValue | byte | COMBAT W, PARTY W | name = Pool 681A StatValue (12/12 aligned) |
| 6F97 | sp_Current | byte | MAGIC W, PARTY R | name from party_names.json |
| 6F98 | LastDiceCount | byte | COMBAT W, PARTY R | name from combat_names.json |
| 6F9A | StatKind | byte | COMBAT W, PARTY R | name from combat_names.json |
| 6F9B | AttackBlocked | byte | COMBAT W, PARTY W | name from combat_names.json |
| 6F9C | cure_InProgress | byte | COMBAT W, MAGIC W, PARTY W | name from combat_names.json |
| 6F9D | SpellArea | byte | COMBAT W, MAGIC W, PARTY R | name from combat_names.json |
| 6F9E | ItemsChanged | byte | COMBAT W, MAGIC W | name from combat_names.json |
| 6F9F | AttackRollValue | byte | VIEW W, COMBAT W, PARTY W | name from combat_names.json |
| 6FA0 | SlotHits | byte | COMBAT W, PARTY W | name from combat_names.json |
| 6FA2 | morale_Value | byte | COMBAT W, PARTY W | name from combat_names.json |
| 6FA3 | hold_Victim | far pointer | COMBAT W, MAGIC W, PARTY W | name from combat_names.json |
| 6FA5 | hold_Victim_hi | word | COMBAT W, MAGIC W, PARTY W | inside hold_Victim (+2h) |
| 6FA7 | SaveType | byte | COMBAT W, PARTY R | name from combat_names.json |
| 6FA8 | SaveResult | byte | COMBAT W, PARTY R | name from combat_names.json |
| 719E | g_719E | ? | MAGIC W, PARTY W |  |
| 71A0 | g_71A0 | word | MAGIC W, PARTY W |  |
| 71F2 | item_HookProc | ? | COMBAT R, PARTY W | name from combat_names.json |
| 7202 | wall_Buf | far pointer | ENGINE R, VIEW R | name from eclview_names.json |
| 7206 | map_Buf | far pointer | ENGINE R, VIEW R | name from eclview_names.json |
| 720A | backdrop_C0 | byte | RESIDENT R, VIEW W | name from eclview_names.json |
| 720B | backdrop_C1 | ? | RESIDENT R, VIEW W | name from eclview_names.json |
| 720C | backdrop_C2 | ? | RESIDENT R, VIEW W | name from eclview_names.json |
| 720D | backdrop_C3 | byte | RESIDENT R, VIEW W | name from eclview_names.json |
| 720E | view_AreaMap | byte | ENGINE W, VIEW W, COMBAT W | name from eclview_names.json |
| 720F | party_MapX | byte | ENGINE W, ECL R, VIEW W, COMBAT W, PARTY R | name from eclview_names.json |
| 7210 | party_MapY | word | ENGINE W, ECL W, VIEW W, COMBAT W, PARTY R | name from eclview_names.json |
| 7211 | party_Dir | byte | ENGINE W, ECL R, VIEW W, COMBAT W, PARTY R | name from eclview_names.json |
| 7212 | party_Ahead | word | ENGINE W, ECL W, VIEW W, COMBAT W | name from eclview_names.json |
| 7213 | party_CellAttr | byte | ECL W, VIEW W, COMBAT W | name from eclview_names.json |
| 7220 | sky_Moon | word | ENGINE W, VIEW R | name from eclview_names.json |
| 7222 | g_7222 | word | ENGINE W, VIEW R |  |
| 7224 | sky_Sun | word | ENGINE W, VIEW R | name from eclview_names.json |
| 7226 | g_7226 | far pointer | ENGINE W, VIEW R |  |
| 7228 | sky_Strip | word | ENGINE W, VIEW R | inside g_7226 (+2h); name from eclview_names.json |
| 722A | g_722A | word | ENGINE W, ECL R, VIEW R |  |
| 722C | enc_Anim | word | ENGINE R, ECL R, VIEW R, COMBAT R, MAGIC R, PARTY R | name from eclview_names.json |
| 722D | g_722D | byte | ECL W, VIEW W |  |
| 7232 | g_7232 | word | ECL R, COMBAT R, PARTY R |  |
| 7234 | g_7234 | word | ECL R, COMBAT R, PARTY R |  |
| 7278 | anim_Name | byte | ENGINE W, VIEW W, MAGIC R | name from eclview_names.json |
| 7281 | camp_AnimName | byte | ENGINE W, ECL W, MAGIC R | name from magic_names.json |
| 728A | anim_Id | byte | ENGINE W, ECL R, VIEW W, MAGIC R, PARTY R | name from eclview_names.json |
| 728B | camp_AnimId | byte | ENGINE W, ECL W, MAGIC W | name from magic_names.json |
| 728C | bigpic_Pic | word | ENGINE W, VIEW R | name from eclview_names.json |
| 728E | g_728E | word | ENGINE W, VIEW R |  |
| 7290 | bigpic_Id | byte | ENGINE W, VIEW W | name from eclview_names.json |
| 7292 | menu_Top | word | ENGINE W, VIEW W | name from eclview_names.json |
| 7294 | menu_Sel | byte | ENGINE W, VIEW W, MAGIC W, PARTY W | name from resident_names.json |
| 7295 | menu_Ext | byte | VIEW W, COMBAT R, MAGIC R | name from resident_names.json |
| 7296 | menu_Timeout | word | RESIDENT W, VIEW R | name from resident_names.json |
| 7298 | g_7298 | word | RESIDENT W, VIEW R |  |
| 729A | menu_TimeoutKey | byte | RESIDENT W, VIEW R | name from resident_names.json |
| 729C | ScrollItem | far pointer | COMBAT W, MAGIC W | name from combat_names.json |
| 729E | ScrollItem_hi | word | COMBAT W, MAGIC W | inside ScrollItem (+2h) |
| 7431 | g_7431 | array (elem 4 B?) | COMBAT W, MAGIC W |  |
| 7433 | g_7431_hi | array (elem 2 B?) | COMBAT W, MAGIC W | inside g_7431 (+2h) |
| 7434 | SpellTargetCount | byte | COMBAT W, MAGIC W | inside g_7431 (+3h); name from combat_names.json |
| 7435 | SpellTargets | far pointer | COMBAT W, MAGIC W | name from combat_names.json |
| 7437 | SpellTargets_hi | word | COMBAT W, MAGIC W | inside SpellTargets (+2h) |
| 7559 | SpellX | byte | COMBAT W, MAGIC W | name from combat_names.json |
| 755A | SpellY | byte | COMBAT W, MAGIC W | name from combat_names.json |
| 755B | cloud_List | far pointer | VIEW W, COMBAT R, MAGIC W, PARTY W | name from combat_names.json |
| 755D | cloud_List_hi | word | VIEW W, COMBAT R, MAGIC W, PARTY W | inside cloud_List (+2h) |
| 755F | cloud9_List | far pointer | VIEW W, MAGIC W, PARTY W | name from party_names.json |
| 7561 | cloud9_List_hi | word | VIEW W, MAGIC W, PARTY W | inside cloud9_List (+2h) |
| 7563 | ItemCast | byte | COMBAT W, MAGIC W, PARTY R | name from combat_names.json |
| 7564 | PoolHasMoney | byte | MAGIC W, PARTY W | name from party_names.json |
| 7566 | RestClock | array (elem 2 B?) | MAGIC R, PARTY W | name from party_names.json |
| 7568 | g_7568 | word | MAGIC W, PARTY W |  |
| 756A | g_756A | word | MAGIC W, PARTY R |  |
| 756C | g_756C | word | MAGIC W, PARTY R |  |
| 757C | HealCounter | word | MAGIC W, PARTY W | name from party_names.json |
| 757E | RestActive | byte | ENGINE W, PARTY W | name from party_names.json |
| 7580 | view_Redraw | byte | ECL W, VIEW W, COMBAT W, PARTY W | name from eclview_names.json |
| 7582 | item_HookMode | byte | ENGINE W, COMBAT W, MAGIC W, PARTY W | name from combat_names.json |
| 7588 | door_CanBash | byte | ENGINE R, VIEW W | name from eclview_names.json |
| 758D | CombatRound | byte | VIEW W, COMBAT R, MAGIC W, PARTY R | name from combat_names.json |
| 758E | combat_MaxRounds | byte | VIEW W, COMBAT W, MAGIC R, PARTY W | scalar: ov08 EndOfRound 2F00:0A84 CMP AL(CombatRound),[758E]; ov13 3A00:19E8 stores CombatRound+0Fh; foe_Li... |
| 75DA | MagicOn | byte | VIEW W, COMBAT W, MAGIC W | name from combat_names.json |
| 75DB | dummy_Done | var/record (address taken) | COMBAT W, MAGIC R | name from combat_names.json |
| 75E0 | g_75E0 | far pointer | VIEW R, COMBAT R, MAGIC R, PARTY R |  |
| 75E5 | combat_Shown | byte | COMBAT W, MAGIC W, PARTY W | name from combat_names.json |
| 75E6 | combat_Visible | byte | ENGINE W, VIEW R, COMBAT W, MAGIC W | name from eclview_names.json |
| 75E8 | backdrop_Key3 | byte | ENGINE W, VIEW R, COMBAT W | name = Pool 6F68 backdrop_Key3 (3/3 aligned) |
| 75E9 | backdrop_Key12 | byte | ENGINE W, VIEW R, COMBAT W | name = Pool 6F69 backdrop_Key12 (4/4 aligned) |
| 75F0 | ecl_GosubSP | far pointer | ECL W, COMBAT W | name = Pool 6F70 ecl_GosubSP (12/12 aligned) |
| 75F2 | ecl_GosubSP_seg | word | ECL W, COMBAT W | inside g_75F0 (+2h); name = Pool 6F72 ecl_GosubSP_seg (6/6 aligned) |
| 75F4 | ecl_GosubTmp | far pointer | ECL W, COMBAT W | name = Pool 6F74 ecl_GosubTmp (4/4 aligned) |
| 75F6 | ecl_GosubTmp_hi | word | ECL W, COMBAT W | inside ecl_GosubTmp (+2h) |
| 75F8 | ecl_FlagEQ | byte | ECL W, COMBAT W | name = Pool 6F78 ecl_FlagEQ (5/5 aligned) |
| 75F9 | ecl_FlagNE | byte | ECL W, COMBAT W | name = Pool 6F79 ecl_FlagNE (6/6 aligned) |
| 75FA | ecl_FlagLT | byte | ECL R, COMBAT W | name = Pool 6F7A ecl_FlagLT (3/3 aligned) |
| 75FB | ecl_FlagGT | byte | ECL R, COMBAT W | name = Pool 6F7B ecl_FlagGT (3/3 aligned) |
| 75FC | ecl_FlagLE | byte | ECL R, COMBAT W | name = Pool 6F7C ecl_FlagLE (3/3 aligned) |
| 75FD | ecl_FlagGE | byte | ECL R, COMBAT W | name = Pool 6F7D ecl_FlagGE (3/3 aligned) |
| 75FF | ecl_CurOp | byte | ECL W, COMBAT W | name = Pool 6F7F ecl_CurOp (11/11 aligned) |
| 7603 | enc_NextIconSlot | byte | ECL W, COMBAT W | name = Pool 6F83 enc_NextIconSlot (8/8 aligned) |
| 76C5 | ecl_OpHi | array (elem 1 B?) | ECL R, COMBAT W | ECL_VM.md §6 operand arrays (7685 + 40h) |
| 76C6 | ecl_OpHi | ? | ECL R, COMBAT R | name = Pool 7046 ecl_OpHi (13/13 aligned) |
| 7705 | ecl_OpLo | array (elem 1 B?) | ECL R, COMBAT W | ECL_VM.md §6 operand arrays (7685 + 80h) |
| 7706 | ecl_OpLo | ? | ECL R, COMBAT R | name = Pool 7086 ecl_OpLo (13/13 aligned) |
| 7746 | g_7746 | byte | COMBAT W, MAGIC W |  |
| 7747 | gfx_LoopCounter | byte | RESIDENT W, ENGINE W, VIEW W, COMBAT W, MAGIC W, PARTY W | name = Pool 70C7 gfx_LoopCounter (16/16 aligned) |
| 8B48 | g_8B48 | byte | ECL W, COMBAT R |  |
| 8B4C | g_8B4C | ? | ECL R, COMBAT W |  |
| 8B52 | g_8B52 | byte | ECL W, COMBAT W |  |
| 8B53 | g_8B53 | byte | ECL W, COMBAT W |  |
| 8B54 | g_8B54 | byte | MAGIC W, PARTY W |  |
| 8B56 | DuelActive | byte | ENGINE W, ECL W, VIEW R, COMBAT W | name from combat_names.json |
| 8B5E | ecl_Block | byte | ECL W, VIEW R | ECL_VM.md §6 current ECL block number; ecl_GameLoop 2200:37ca / 37d1 / 3857 (Mem[4BF2] := ecl_Block) |
| 8B5F | g_8B5F | byte | ENGINE W, ECL W |  |
| 8B60 | g_8B60 | byte | ENGINE W, ECL W |  |
| 8B61 | g_8B61 | byte | ENGINE W, ECL W |  |
| 8B62 | view_RedrawPicture | byte | ENGINE W, ECL W, COMBAT W | name = Pool 84E0 view_RedrawPicture (12/12 aligned) |
| 8B63 | g_8B63 | byte | ECL W, COMBAT W |  |
| 8B64 | g_8B64 | byte | ECL W, COMBAT W |  |
| 8B65 | enc_SpriteOnScreen | byte | ENGINE W, ECL W, COMBAT W | name = Pool 84E3 enc_SpriteOnScreen (7/7 aligned) |
| 8B66 | text_Cleared | byte | ECL W, VIEW W | name from eclview_names.json |
| 8B67 | view_RedrawParams | byte | ECL W, VIEW R, COMBAT W | name = Pool 84E5 view_RedrawParams (5/5 aligned) |
| 8B68 | view_RedrawPos | byte | ECL W, COMBAT W | name = Pool 84E6 view_RedrawPos (5/5 aligned) |
| 8B6A | view_RedrawPortrait | byte | ECL W, COMBAT W | name = Pool 84E8 view_RedrawPortrait (2/2 aligned) |
| 8B6B | enc_MenuActive | byte | ENGINE W, ECL W, COMBAT R | name = Pool 84E9 enc_MenuActive (3/3 aligned) |
| 8B6D | g_8B6D | byte | ECL W, COMBAT W |  |
| 8B6E | g_8B6E | byte | ECL W, PARTY W |  |
| 8B6F | g_8B6F | byte | ENGINE W, ECL W |  |
| 8B76 | DebugLog | var/record (address taken) | RESIDENT R, ECL R | name from resident_names.json |
| 8C7C | g_8C7C | far pointer | ENGINE R, VIEW R |  |
| 8C80 | CopyProtWord | var/record (address taken) | RESIDENT R, ENGINE R, VIEW R, COMBAT R | name from resident_names.json |
| 8C96 | BiosKbdFlags | ? | RESIDENT R, ENGINE W | name from resident_names.json |
| 8C98 | DosError | word | RESIDENT R, ENGINE R | FindFirst/FindNext tail 097F:016A stores AX / 0 |
| 8DB2 | Output | var/record (address taken) | RESIDENT R, VIEW R | name from resident_names.json |

264 DS offsets used by >= 2 areas; per area: RESIDENT 48, ENGINE 103, ECL 85, VIEW 104, COMBAT 166, MAGIC 89, PARTY 114
placeholder-named among them: 56


## 4. Cross-area call graph and the main game loop

Generated by `python -I decode/tools/crossref.py s4` from the callee lists of `decode/listings/functions.tsv`
(stub thunks resolved to the routine they reach). Counts are distinct caller -> callee function pairs whose units lie in
different areas. Note: ECL -> COMBAT is large because the VM support routines of ov07 (operand reader, ecl_GetMem /
SetMem / GetCharField, LoadEclBlock) sit in the COMBAT unit ov07 (§1); COMBAT -> PARTY / MAGIC -> PARTY are the
effect-handler, character-record and message helpers of ov12 / ov24.

### 4a. Area x area (rows call columns; distinct caller->callee function pairs)

| caller \ callee | RESIDENT | ENGINE | ECL | VIEW | COMBAT | MAGIC | PARTY | RUNTIME |
|---|---|---|---|---|---|---|---|---|
| **RESIDENT** |  | 13 | 4 | 21 | 7 | 4 | 6 | 164 |
| **ENGINE** | 76 |  | 4 | 54 | 17 | 4 | 37 | 166 |
| **ECL** | 24 | 10 |  | 37 | 152 | 8 | 32 | 48 |
| **VIEW** | 93 | 4 | 8 |  | 15 | 1 | 13 | 99 |
| **COMBAT** | 69 | 4 | 6 | 148 |  | 19 | 256 | 205 |
| **MAGIC** | 27 | 4 | 4 | 114 | 177 |  | 197 | 179 |
| **PARTY** | 48 |  | 6 | 59 | 92 | 5 |  | 138 |
| **RUNTIME** |  |  |  |  |  |  |  |  |

### 4b. Unit -> unit edges across areas (callee unit: routines called)

| caller unit (area) | callee unit (area) | routines called |
|---|---|---|
| main_0000 (RESIDENT) | ov00 (ENGINE) | ov00_init |
| main_0000 (RESIDENT) | ov01 (ENGINE) | ShowTitle, ov01_init |
| main_0000 (RESIDENT) | ov02 (ECL) | ecl_GameLoop, ov02_LoadDeps, ov02_init |
| main_0000 (RESIDENT) | ov03 (ENGINE) | RuneWheelCheck, ov03_init |
| main_0000 (RESIDENT) | ov04 (MAGIC) | ov04_init |
| main_0000 (RESIDENT) | ov05 (COMBAT) | ov05_init |
| main_0000 (RESIDENT) | ov06 (PARTY) | ov06_init |
| main_0000 (RESIDENT) | ov07 (COMBAT) | ov07_init |
| main_0000 (RESIDENT) | ov08 (MAGIC) | ov08_init |
| main_0000 (RESIDENT) | ov09 (COMBAT) | ov09_init |
| main_0000 (RESIDENT) | ov10 (VIEW) | ov10_init |
| main_0000 (RESIDENT) | ov11 (ENGINE) | ov11_0000, ov11_0056, ov11_06D8, ov11_init |
| main_0000 (RESIDENT) | ov12 (PARTY) | ov12_init |
| main_0000 (RESIDENT) | ov13 (COMBAT) | ov13_init |
| main_0000 (RESIDENT) | ov14 (VIEW) | ov14_init |
| main_0000 (RESIDENT) | ov15 (MAGIC) | ov15_init |
| main_0000 (RESIDENT) | ov16 (ENGINE) | ov16_init |
| main_0000 (RESIDENT) | ov17 (ENGINE) | PartyCreationMenu, ov17_0000, ov17_init |
| main_0000 (RESIDENT) | ov18 (COMBAT) | ov18_init |
| main_0000 (RESIDENT) | ov19 (COMBAT) | ov19_init |
| main_0000 (RESIDENT) | ov20 (PARTY) | ov20_init |
| main_0000 (RESIDENT) | ov21 (PARTY) | ov21_init |
| main_0000 (RESIDENT) | ov22 (MAGIC) | ov22_init |
| main_0000 (RESIDENT) | ov23 (COMBAT) | ov23_init |
| main_0000 (RESIDENT) | ov24 (PARTY) | ov24_init |
| main_0000 (RESIDENT) | ov25 (PARTY) | ov25_init |
| main_0000 (RESIDENT) | ov26 (VIEW) | HorizontalMenu, ov26_init |
| main_0000 (RESIDENT) | ov27 (VIEW) | ov27_init |
| main_0000 (RESIDENT) | ov28 (VIEW) | ov28_init |
| main_0000 (RESIDENT) | ov29 (VIEW) | ov29_init |
| main_0000 (RESIDENT) | ov30 (VIEW) | SetBackdropColours, ov30_LoadDeps, ov30_init |
| main_0000 (RESIDENT) | ov31 (VIEW) | ov31_init |
| main_0000 (RESIDENT) | ov32 (VIEW) | ov32_init |
| main_0000 (RESIDENT) | ov33 (VIEW) | ov33_init |
| main_0000 (RESIDENT) | ov34 (ECL) | ov34_init |
| main_0000 (RESIDENT) | ov35 (VIEW) | ov35_init |
| res_01A0 (RESIDENT) | ov35 (VIEW) | Put8x8Symbol |
| ov00 (ENGINE) | res_0542 (RESIDENT) | ShowBottomPromptAndReadKey |
| ov00 (ENGINE) | res_06EA (RESIDENT) | TerminateGame |
| ov01 (ENGINE) | res_01A0 (RESIDENT) | FUN_01a0_00d3 |
| ov01 (ENGINE) | res_0297 (RESIDENT) | FreePicture, LoadPicture, PutPicture |
| ov01 (ENGINE) | res_0542 (RESIDENT) | ClearScreen, DrawText, TimeInHundredths |
| ov01 (ENGINE) | res_06EA (RESIDENT) | FlushGameKeys |
| ov01 (ENGINE) | res_0713 (RESIDENT) | PlayOrStopSound |
| ov03 (ENGINE) | ov33 (VIEW) | DrawTile24, Load24x24Set |
| ov03 (ENGINE) | ov34 (ECL) | ov34_0000 |
| ov03 (ENGINE) | res_01A0 (RESIDENT) | DrawScreenFrame |
| ov03 (ENGINE) | res_0297 (RESIDENT) | FlushViewDirtyLines |
| ov03 (ENGINE) | res_0542 (RESIDENT) | DrawText, ReadBottomLine |
| ov11 (ENGINE) | ov12 (PARTY) | InstallEffectHandlers, ov12_0000 |
| ov11 (ENGINE) | ov14 (VIEW) | ov14_LoadDeps |
| ov11 (ENGINE) | ov22 (MAGIC) | InitSpellTable, ov22_LoadDeps |
| ov11 (ENGINE) | ov26 (VIEW) | ClearMenuLine, ov26_0000 |
| ov11 (ENGINE) | ov29 (VIEW) | ov29_0000 |
| ov11 (ENGINE) | ov33 (VIEW) | LoadCombatIcon, ov33_0000 |
| ov11 (ENGINE) | ov34 (ECL) | ov34_0000 |
| ov11 (ENGINE) | ov35 (VIEW) | Load8x8Set, ov35_0000 |
| ov11 (ENGINE) | res_0297 (RESIDENT) | AllocPicture, LoadPicture |
| ov11 (ENGINE) | res_0542 (RESIDENT) | DrawText, LoadTextFont |
| ov11 (ENGINE) | res_0636 (RESIDENT) | OpenWithPrompt |
| ov16 (ENGINE) | ov19 (COMBAT) | MoneyInGold |
| ov16 (ENGINE) | ov21 (PARTY) | AddPlatinumOrPool, DropCoinsToPool |
| ov16 (ENGINE) | ov23 (COMBAT) | AddEffect, ov23_LoadDeps |
| ov16 (ENGINE) | ov24 (PARTY) | AppendItemCopy, ByteToStr, MakeItem, RecalcItems, ov24_0000 |
| ov16 (ENGINE) | ov25 (PARTY) | UpdateLevelStats, ov25_0000 |
| ov16 (ENGINE) | ov26 (VIEW) | AskYesNo, ClearMenuLine, HorizontalMenu |
| ov16 (ENGINE) | ov29 (VIEW) | LoadBigPic |
| ov16 (ENGINE) | ov30 (VIEW) | Load3DMap, LoadWallSet |
| ov16 (ENGINE) | ov33 (VIEW) | FreeCombatIcon, LoadCombatIcon, ov33_0000 |
| ov16 (ENGINE) | ov34 (ECL) | ov34_0000 |
| ov16 (ENGINE) | res_0297 (RESIDENT) | RecolorPicture |
| ov16 (ENGINE) | res_0542 (RESIDENT) | DrawText, ReadBottomLine, ShowBottomPromptAndReadKey |
| ov16 (ENGINE) | res_0636 (RESIDENT) | DeleteAll, DeleteFileIfExists, FileExists, GetVolumeLabel, LoadDaxRecord, MakeDosName, OpenWithPrompt, RestoreDataSet (+1) |
| ov16 (ENGINE) | res_06EA (RESIDENT) | FlushGameKeys, TerminateGame |
| ov17 (ENGINE) | ov15 (MAGIC) | DropCharacter |
| ov17 (ENGINE) | ov19 (COMBAT) | CycleSelectedChar, DrawAbility, DrawCombatStats, DrawMoney, MoneyInGold, SpellList, ViewMenu, ov19_LoadDeps |
| ov17 (ENGINE) | ov22 (MAGIC) | ov22_LoadDeps |
| ov17 (ENGINE) | ov23 (COMBAT) | AddEffect, Roll, ov23_LoadDeps |
| ov17 (ENGINE) | ov24 (PARTY) | ByteToStr, DrawCharacterName, DrawHP, PartySummary, RecalcItems, ShowTimedBottomMessage, ov24_0000 |
| ov17 (ENGINE) | ov25 (PARTY) | ChangeClass, CurrentClassLevel, FormerClass, IsHuman, UpdateLevelStats, UpdateSaves, UpdateThiefSkills, WisdomBonusSpells (+1) |
| ov17 (ENGINE) | ov26 (VIEW) | AskYesNo, ClearMenuLine, FreeMenuList, HorizontalMenu, ListItem, NewMenuList, VerticalListMenu, ov26_0000 |
| ov17 (ENGINE) | ov29 (VIEW) | ov29_0000 |
| ov17 (ENGINE) | ov32 (VIEW) | PaletteFlashOff, PaletteFlashOn, ov32_0000 |
| ov17 (ENGINE) | ov33 (VIEW) | DrawIconAt, FreeCombatIcon, ov33_0000 |
| ov17 (ENGINE) | ov34 (ECL) | ov34_0000 |
| ov17 (ENGINE) | res_01A0 (RESIDENT) | ClearRectangle, DrawScreenFrame, FUN_01a0_0136, FUN_01a0_0252 |
| ov17 (ENGINE) | res_0297 (RESIDENT) | FillPictureRect, FlushViewDirtyLines, RecolorPicture |
| ov17 (ENGINE) | res_0542 (RESIDENT) | ClearGlyphRun, DrawText, MessageDelay, ReadBottomLine, ShowBottomPromptAndReadKey, ShowTimedBottomPrompt |
| ov17 (ENGINE) | res_06EA (RESIDENT) | ReadGameKey, TerminateGame |
| ov02 (ECL) | ov03 (ENGINE) | RuneWheelCheck, ov03_0000 |
| ov02 (ECL) | ov04 (MAGIC) | Temple, ov04_LoadDeps |
| ov02 (ECL) | ov05 (COMBAT) | AfterCombat, ov05_LoadDeps |
| ov02 (ECL) | ov06 (PARTY) | Shop, ov06_0000 |
| ov02 (ECL) | ov07 (COMBAT) | ApplyEclDamage, ApproachDistance, EclVerticalListMenu, LoadEclBlock, LoadMonsterRecord, LoseItems, MakeWord, MenuSelect (+17) |
| ov02 (ECL) | ov08 (MAGIC) | CombatMain, ov08_LoadDeps |
| ov02 (ECL) | ov09 (COMBAT) | ov09_LoadDeps |
| ov02 (ECL) | ov10 (VIEW) | ov10_LoadDeps |
| ov02 (ECL) | ov13 (COMBAT) | ov13_LoadDeps |
| ov02 (ECL) | ov14 (VIEW) | ExploreCommand, MoveParty, ov14_LoadDeps |
| ov02 (ECL) | ov15 (MAGIC) | Camp, ov15_LoadDeps |
| ov02 (ECL) | ov16 (ENGINE) | AddNpcToParty, SaveGame, ov16_0000 |
| ov02 (ECL) | ov17 (ENGINE) | PartyCreationMenu, RemovePartyMember, ov17_0000 |
| ov02 (ECL) | ov18 (COMBAT) | EndSequence |
| ov02 (ECL) | ov19 (COMBAT) | ov19_LoadDeps |
| ov02 (ECL) | ov20 (PARTY) | AdvanceClock, ov20_0000 |
| ov02 (ECL) | ov21 (PARTY) | MakeTreasureItem, ov21_0000 |
| ov02 (ECL) | ov23 (COMBAT) | AttackRollVsAC, Roll, SavingThrow, ov23_LoadDeps |
| ov02 (ECL) | ov24 (PARTY) | BuildItemName, DrawLocationTimeStatus, HasEffect, LoseItem, PartySummary, RecalcItems, RedrawCurrentMode, SelectPartyCharacter (+2) |
| ov02 (ECL) | ov25 (PARTY) | DualClassActive, ov25_0000 |
| ov02 (ECL) | ov26 (VIEW) | AskYesNo, ClearMenuLine, FreeMenuList, NewMenuList, ov26_0000 |
| ov02 (ECL) | ov27 (VIEW) | ov27_0000 |
| ov02 (ECL) | ov28 (VIEW) | RefreshView, ov28_0000 |
| ov02 (ECL) | ov29 (VIEW) | DrawBigPic, DrawPictureScreenOrView, FreeAnimation, LoadAnimation, LoadBigPic, ov29_0000 |
| ov02 (ECL) | ov30 (VIEW) | GetCellAttr, GetWallType, Load3DMap, LoadWallSet, ov30_LoadDeps |
| ov02 (ECL) | ov31 (VIEW) | ov31_0000 |
| ov02 (ECL) | ov32 (VIEW) | ov32_0000 |
| ov02 (ECL) | ov33 (VIEW) | LoadCombatIcon, ov33_0000 |
| ov02 (ECL) | res_01A0 (RESIDENT) | DrawScreenFrame, FUN_01a0_0136 |
| ov02 (ECL) | res_0542 (RESIDENT) | ClearTextRectangle, DrawWrappedText, MessageDelay, ReadBottomLine, ReadWordNumber, ShowBottomPromptAndReadKey |
| ov02 (ECL) | res_0636 (RESIDENT) | LoadDaxRecord |
| ov02 (ECL) | res_06EA (RESIDENT) | TerminateGame |
| ov02 (ECL) | res_0713 (RESIDENT) | PlayOrStopSound, StartSound |
| ov10 (VIEW) | ov13 (COMBAT) | CalcEnemyHpPct, ov13_LoadDeps |
| ov10 (VIEW) | ov16 (ENGINE) | ov16_0000 |
| ov10 (VIEW) | ov17 (ENGINE) | RemovePartyMember, ov17_0000 |
| ov10 (VIEW) | ov19 (COMBAT) | ov19_LoadDeps |
| ov10 (VIEW) | ov23 (COMBAT) | CallEffectHooks, Roll, ov23_LoadDeps |
| ov10 (VIEW) | ov24 (PARTY) | CountActiveSides, RecalcItems, ov24_0000, ov24_2E05 |
| ov10 (VIEW) | ov34 (ECL) | ov34_0000 |
| ov10 (VIEW) | res_0297 (RESIDENT) | AllocPicture, FreePicture |
| ov10 (VIEW) | res_0542 (RESIDENT) | DrawText, MessageDelay |
| ov10 (VIEW) | res_06EA (RESIDENT) | PollOneKey |
| ov14 (VIEW) | ov15 (MAGIC) | CastMenu |
| ov14 (VIEW) | ov16 (ENGINE) | ov16_0000 |
| ov14 (VIEW) | ov19 (COMBAT) | CycleSelectedChar, ViewMenu, ov19_LoadDeps |
| ov14 (VIEW) | ov20 (PARTY) | AdvanceClock, ov20_0000 |
| ov14 (VIEW) | ov23 (COMBAT) | Roll, ov23_LoadDeps |
| ov14 (VIEW) | ov24 (PARTY) | DrawLocationTimeStatus, PartySummary, ov24_0000 |
| ov14 (VIEW) | ov25 (PARTY) | DualClassActive, ov25_0000 |
| ov14 (VIEW) | ov34 (ECL) | ov34_0000 |
| ov14 (VIEW) | res_01A0 (RESIDENT) | ClearRectangle |
| ov14 (VIEW) | res_0297 (RESIDENT) | FreePicture |
| ov14 (VIEW) | res_0542 (RESIDENT) | ShowTimedBottomPrompt |
| ov14 (VIEW) | res_0713 (RESIDENT) | PlayOrStopSound |
| ov26 (VIEW) | ov34 (ECL) | ov34_0000 |
| ov26 (VIEW) | res_01A0 (RESIDENT) | ClearRectangle |
| ov26 (VIEW) | res_0542 (RESIDENT) | ClearGlyphRun, DrawRepeatedGlyph, DrawText, TimeInHundredths |
| ov26 (VIEW) | res_06EA (RESIDENT) | ReadGameKey |
| ov27 (VIEW) | res_0297 (RESIDENT) | GetPicture, PutPicture |
| ov28 (VIEW) | ov34 (ECL) | ov34_0000 |
| ov29 (VIEW) | ov34 (ECL) | ov34_0000 |
| ov29 (VIEW) | res_01A0 (RESIDENT) | FUN_01a0_0252 |
| ov29 (VIEW) | res_0297 (RESIDENT) | AllocPicture, ConvertPicturePixels, DrawPicture, FlushViewDirtyLines, FreePicture, LoadPicture, PutPicture, RecolorPicture (+1) |
| ov29 (VIEW) | res_0542 (RESIDENT) | ClearGlyphRun, DrawText, ShowBottomPromptAndReadKey |
| ov29 (VIEW) | res_0636 (RESIDENT) | LoadDaxRecord |
| ov29 (VIEW) | res_06EA (RESIDENT) | FlushGameKeys, TerminateGame |
| ov30 (VIEW) | ov34 (ECL) | ov34_0000 |
| ov30 (VIEW) | res_0297 (RESIDENT) | DrawPicture, FillPictureRect, FlushViewDirtyLines, RestorePreviousVideoMode |
| ov30 (VIEW) | res_0636 (RESIDENT) | LoadDaxRecord |
| ov30 (VIEW) | res_06EA (RESIDENT) | ReadGameKey, TerminateGame |
| ov32 (VIEW) | ov34 (ECL) | ov34_0000 |
| ov32 (VIEW) | res_0297 (RESIDENT) | DrawPicture, FlushViewDirtyLines, SetEgaPaletteRegister, SetEgaPaletteRegisterRaw |
| ov32 (VIEW) | res_0542 (RESIDENT) | MessageDelay |
| ov32 (VIEW) | res_0713 (RESIDENT) | PlayOrStopSound |
| ov33 (VIEW) | ov34 (ECL) | ov34_0000 |
| ov33 (VIEW) | res_0297 (RESIDENT) | AllocPicture, DrawPicture, DrawPictureInto, FreePicture, LoadPicture, MirrorPicture, RecolorPicture, RestorePreviousVideoMode |
| ov33 (VIEW) | res_06EA (RESIDENT) | FlushGameKeys, TerminateGame |
| ov35 (VIEW) | res_0297 (RESIDENT) | DrawPictureInto, LoadPicture, PutPicture, RestorePreviousVideoMode |
| ov35 (VIEW) | res_06EA (RESIDENT) | FlushGameKeys, ReadGameKey, TerminateGame |
| ov05 (COMBAT) | ov06 (PARTY) | AddItemToChar, ov06_0000 |
| ov05 (COMBAT) | ov17 (ENGINE) | RemovePartyMember |
| ov05 (COMBAT) | ov21 (PARTY) | PoolMoney, ShareMoney, TakeMoney, TreasurePoolStatus, ov21_0000 |
| ov05 (COMBAT) | ov22 (MAGIC) | CastSpell, ov22_LoadDeps |
| ov05 (COMBAT) | ov24 (PARTY) | BuildItemName, PartySummary, RecalcItems, RedrawCurrentMode, ov24_0000 |
| ov05 (COMBAT) | ov26 (VIEW) | HorizontalMenu, VerticalListMenu, ov26_0000 |
| ov05 (COMBAT) | ov33 (VIEW) | ov33_0000 |
| ov05 (COMBAT) | ov34 (ECL) | ov34_0000 |
| ov05 (COMBAT) | res_01A0 (RESIDENT) | DrawScreenFrame |
| ov05 (COMBAT) | res_0542 (RESIDENT) | ClearTextRectangle, DrawText, DrawWrappedText, ShowBottomPromptAndReadKey |
| ov07 (COMBAT) | ov16 (ENGINE) | LoadMonster, ov16_0000 |
| ov07 (COMBAT) | ov24 (PARTY) | ApplyDamage, HasEffect, LoseItem, PartySummary, ov24_0000 |
| ov07 (COMBAT) | ov25 (PARTY) | DualClassActive |
| ov07 (COMBAT) | ov26 (VIEW) | ClearMenuLine, HorizontalMenu, VerticalListMenu, ov26_0000 |
| ov07 (COMBAT) | ov28 (VIEW) | RefreshView, ov28_0000 |
| ov07 (COMBAT) | ov29 (VIEW) | DrawPictureScreenOrView, DrawPortrait, LoadAnimation, LoadPortrait, Show3DSprite, ov29_0000 |
| ov07 (COMBAT) | ov30 (VIEW) | GetCellAttr, GetWallType, LoadWallSet |
| ov07 (COMBAT) | ov33 (VIEW) | LoadCombatIcon, ov33_0000 |
| ov07 (COMBAT) | ov34 (ECL) | ov34_0000 |
| ov07 (COMBAT) | res_0542 (RESIDENT) | ClearTextRectangle, DrawText, DrawWrappedText, ShowBottomPromptAndReadKey |
| ov07 (COMBAT) | res_0636 (RESIDENT) | LoadDaxRecord, SetDataSet |
| ov09 (COMBAT) | ov22 (MAGIC) | CastSpell, IsScroll, SpellRange, ov22_LoadDeps |
| ov09 (COMBAT) | ov24 (PARTY) | BandageDying, ByteToStr, ClearCharacterMessage, ClearCombatantActionFlags, CollectOppositeSideTargets, DrawCharacterSummary, GetMissileAmmo, HasEffect (+10) |
| ov09 (COMBAT) | ov25 (PARTY) | ov25_0000 |
| ov09 (COMBAT) | ov26 (VIEW) | ClearMenuLine, ov26_0000 |
| ov09 (COMBAT) | ov30 (VIEW) | ov30_LoadDeps |
| ov09 (COMBAT) | ov31 (VIEW) | BuildTargetList, TraceLine, ov31_0000 |
| ov09 (COMBAT) | ov32 (VIEW) | CombatantCol, CombatantRow, FocusSquare, IsVisible, ProbeMove, ShowCombatant, ov32_0000 |
| ov09 (COMBAT) | ov34 (ECL) | ov34_0000 |
| ov09 (COMBAT) | res_0542 (RESIDENT) | DrawText |
| ov09 (COMBAT) | res_06EA (RESIDENT) | FlushGameKeys, ReadGameKey |
| ov13 (COMBAT) | ov22 (MAGIC) | CastSpell, SpellRange, ov22_LoadDeps |
| ov13 (COMBAT) | ov24 (PARTY) | AnimateAlongPath, ApplyDamage, BuildFourAnimationFrames, ByteToStr, ClearCharacterMessage, ClearCombatantActionFlags, CollectOppositeSideTargets, CopyCombatAnimationFrame (+21) |
| ov13 (COMBAT) | ov25 (PARTY) | DualClassActive, ov25_0000 |
| ov13 (COMBAT) | ov26 (VIEW) | AskYesNo, ClearMenuLine, HorizontalMenu, ov26_0000 |
| ov13 (COMBAT) | ov31 (VIEW) | BuildTargetList, InFrontArc, TraceLine, ov31_0000 |
| ov13 (COMBAT) | ov32 (VIEW) | CellAt, CombatantCol, CombatantIndex, CombatantRow, CombatantSize, FocusCombatant, FocusSquare, InWindow (+7) |
| ov13 (COMBAT) | ov33 (VIEW) | ov33_0000 |
| ov13 (COMBAT) | ov34 (ECL) | ov34_0000 |
| ov13 (COMBAT) | res_01A0 (RESIDENT) | ClearRectangle |
| ov13 (COMBAT) | res_0542 (RESIDENT) | DrawText, DrawWrappedText, MessageDelay |
| ov13 (COMBAT) | res_06EA (RESIDENT) | FlushGameKeys |
| ov13 (COMBAT) | res_0713 (RESIDENT) | PlayOrStopSound |
| ov18 (COMBAT) | ov24 (PARTY) | RedrawCurrentMode |
| ov18 (COMBAT) | ov26 (VIEW) | ClearMenuLine |
| ov18 (COMBAT) | ov29 (VIEW) | DrawBigPic, DrawPictureScreenOrView, DrawPortrait, FreeAnimation, LoadAnimation, LoadBigPic, LoadPortrait |
| ov18 (COMBAT) | res_0297 (RESIDENT) | DrawPicture, FlushViewDirtyLines, SetEgaPaletteRegister, SetEgaPaletteRegisterRaw |
| ov18 (COMBAT) | res_0542 (RESIDENT) | DrawWrappedText, ShowBottomPromptAndReadKey, TimeInHundredths |
| ov19 (COMBAT) | ov04 (MAGIC) | CureDisease |
| ov19 (COMBAT) | ov20 (PARTY) | ov20_0000 |
| ov19 (COMBAT) | ov21 (PARTY) | CoinFromText, DropCoinsToPool, InputNumber, MoneyValueInGold, SetCharMoneyGold, SetPoolMoneyGold, TransferCoins, WouldOverload (+1) |
| ov19 (COMBAT) | ov22 (MAGIC) | BuildSpellList, CastSpell, ChooseSpell, IsScroll, UseScrollSpell, ov22_LoadDeps |
| ov19 (COMBAT) | ov24 (PARTY) | AppendItemCopy, BuildItemName, ByteToStr, ClearCharacterMessage, ClearCombatantActionFlags, DrawAC, DrawCharacterName, DrawHP (+12) |
| ov19 (COMBAT) | ov25 (PARTY) | CurrentClass, CurrentClassLevel, DualClassActive, FormerClass, UpdateThiefSkills, ov25_0000 |
| ov19 (COMBAT) | ov26 (VIEW) | AskYesNo, FreeMenuList, HorizontalMenu, VerticalListMenu, ov26_0000 |
| ov19 (COMBAT) | ov28 (VIEW) | ov28_0000 |
| ov19 (COMBAT) | ov29 (VIEW) | ov29_0000 |
| ov19 (COMBAT) | ov32 (VIEW) | PaletteFlashOff, PaletteFlashOn |
| ov19 (COMBAT) | ov34 (ECL) | ov34_0000 |
| ov19 (COMBAT) | res_01A0 (RESIDENT) | ClearRectangle, DrawScreenFrame, FUN_01a0_0292, FUN_01a0_048d |
| ov19 (COMBAT) | res_0542 (RESIDENT) | DrawText, DrawWrappedText, MessageDelay, ShowBottomPromptAndReadKey |
| ov23 (COMBAT) | ov24 (PARTY) | ApplyDamage, ByteToStr, ClearCharacterMessage, ClearCombatantActionFlags, CountActiveSides, ForgetMemorizedSpell, HasEffect, PartySummary (+3) |
| ov23 (COMBAT) | ov25 (PARTY) | ov25_0000 |
| ov23 (COMBAT) | ov31 (VIEW) | BuildTargetList |
| ov23 (COMBAT) | ov32 (VIEW) | CombatantCol, CombatantIndex, CombatantRow, CombatantSize, FocusCombatant, PlaceCombatant, ProbeMove, RebuildOccupancy (+2) |
| ov23 (COMBAT) | ov34 (ECL) | ov34_0000 |
| ov23 (COMBAT) | res_0297 (RESIDENT) | FlushViewDirtyLines |
| ov23 (COMBAT) | res_0542 (RESIDENT) | MessageDelay |
| ov04 (MAGIC) | ov07 (COMBAT) | MenuSelect, ov07_LoadDeps |
| ov04 (MAGIC) | ov19 (COMBAT) | CycleSelectedChar, MoneyInGold, ViewMenu, ov19_LoadDeps |
| ov04 (MAGIC) | ov21 (PARTY) | AppraiseGems, MoneyValueInGold, PoolMoney, SetCharMoneyGold, SetPoolMoneyGold, ShareMoney, TakeMoney, TreasurePoolStatus (+1) |
| ov04 (MAGIC) | ov23 (COMBAT) | HealCharacter, RecalcAbility, RemoveEffect, Roll, ov23_LoadDeps |
| ov04 (MAGIC) | ov24 (PARTY) | ClearCharacterMessage, HasEffect, PartySummary, RedrawCurrentMode, ShowCharacterMessage, ShowTimedBottomMessage, WordToStr, ov24_0000 |
| ov04 (MAGIC) | ov25 (PARTY) | ov25_0000 |
| ov04 (MAGIC) | ov26 (VIEW) | AskYesNo, FreeMenuList, HorizontalMenu, NewMenuList, VerticalListMenu, ov26_0000 |
| ov04 (MAGIC) | ov34 (ECL) | ov34_0000 |
| ov04 (MAGIC) | res_01A0 (RESIDENT) | FUN_01a0_0252 |
| ov04 (MAGIC) | res_0542 (RESIDENT) | ClearTextRectangle, DrawText, DrawWrappedText |
| ov08 (MAGIC) | ov09 (COMBAT) | AiCombatTurn, ov09_LoadDeps |
| ov08 (MAGIC) | ov10 (VIEW) | StartCombat, ov10_LoadDeps |
| ov08 (MAGIC) | ov13 (COMBAT) | Attack, AttacksOfOpportunity, BeginCast, CalcAttacks, CalcEnemyHpPct, ConfirmAttackAlly, FaceAttacker, FighterSweep (+7) |
| ov08 (MAGIC) | ov19 (COMBAT) | ItemsMenu, ViewMenu, ov19_LoadDeps |
| ov08 (MAGIC) | ov20 (PARTY) | AdvanceClock, ov20_0000 |
| ov08 (MAGIC) | ov23 (COMBAT) | CallEffectHooks, Roll, StinkingCloudCheck, ov23_LoadDeps |
| ov08 (MAGIC) | ov24 (PARTY) | BandageDying, ByteToStr, ClearCombatantActionFlags, CountActiveSides, DrawCharacterSummary, IsHelpless, RecalcItems, SetGuarding (+5) |
| ov08 (MAGIC) | ov25 (PARTY) | DualClassActive, ov25_0000 |
| ov08 (MAGIC) | ov26 (VIEW) | AskYesNo, ClearMenuLine, HorizontalMenu, ov26_0000 |
| ov08 (MAGIC) | ov31 (VIEW) | ov31_0000 |
| ov08 (MAGIC) | ov32 (VIEW) | CombatantCol, CombatantIndex, CombatantRow, FocusCombatant, FocusSquare, IsVisible, PaletteFlashOff, PlaceCombatant (+5) |
| ov08 (MAGIC) | ov33 (VIEW) | ov33_0000 |
| ov08 (MAGIC) | ov34 (ECL) | ov34_0000 |
| ov08 (MAGIC) | res_01A0 (RESIDENT) | ClearRectangle |
| ov08 (MAGIC) | res_0297 (RESIDENT) | FreePicture |
| ov08 (MAGIC) | res_06EA (RESIDENT) | FlushGameKeys |
| ov15 (MAGIC) | ov16 (ENGINE) | SaveGame, ov16_0000 |
| ov15 (MAGIC) | ov17 (ENGINE) | IconEditor, RemovePartyMember |
| ov15 (MAGIC) | ov19 (COMBAT) | CycleSelectedChar, SpellList, ViewMenu, ov19_LoadDeps |
| ov15 (MAGIC) | ov20 (PARTY) | RestLoop, ov20_0000 |
| ov15 (MAGIC) | ov23 (COMBAT) | HealCharacter, Roll, ov23_LoadDeps |
| ov15 (MAGIC) | ov24 (PARTY) | ByteToStr, ClearCharacterMessage, DrawLocationTimeStatus, PartySummary, RedrawCurrentMode, ShowCharacterMessage, ShowTimedBottomMessage, ov24_0000 |
| ov15 (MAGIC) | ov26 (VIEW) | AskYesNo, ClearMenuLine, FreeMenuList, HorizontalMenu, VerticalListMenu, ov26_0000 |
| ov15 (MAGIC) | ov28 (VIEW) | ov28_0000 |
| ov15 (MAGIC) | ov29 (VIEW) | LoadAnimation |
| ov15 (MAGIC) | ov34 (ECL) | ov34_0000 |
| ov15 (MAGIC) | res_01A0 (RESIDENT) | ClearRectangle, DrawScreenFrame |
| ov15 (MAGIC) | res_0542 (RESIDENT) | DrawText |
| ov15 (MAGIC) | res_06EA (RESIDENT) | TerminateGame |
| ov22 (MAGIC) | ov23 (COMBAT) | AddEffect, ApplyEffect, AttackRoll, CallEffectHandler, CallEffectHooks, CureEffect, DamageCharacter, HealCharacter (+11) |
| ov22 (MAGIC) | ov24 (PARTY) | AnimateAlongPath, BuildFourAnimationFrames, ByteToStr, ClearCharacterMessage, ClearCombatantActionFlags, CollectOppositeSideTargets, DrawCharacterName, ForgetMemorizedSpell (+14) |
| ov22 (MAGIC) | ov25 (PARTY) | DualClassActive, UpdateLevelStats, ov25_0000 |
| ov22 (MAGIC) | ov26 (VIEW) | AskYesNo, FreeMenuList, HorizontalMenu, VerticalListMenu, ov26_0000 |
| ov22 (MAGIC) | ov31 (VIEW) | BuildTargetList, InFrontArc, LineInit, LineStep, Sign, TraceLine |
| ov22 (MAGIC) | ov32 (VIEW) | CellAt, CombatantCol, CombatantIndex, CombatantRow, FocusSquare, IsVisible, PlaceCombatant, RestoreTerrain (+1) |
| ov22 (MAGIC) | ov34 (ECL) | ov34_0000 |
| ov22 (MAGIC) | res_01A0 (RESIDENT) | ClearRectangle |
| ov22 (MAGIC) | res_0542 (RESIDENT) | DrawText, MessageDelay |
| ov22 (MAGIC) | res_0713 (RESIDENT) | PlayOrStopSound |
| ov06 (PARTY) | ov07 (COMBAT) | MenuSelect, ov07_LoadDeps |
| ov06 (PARTY) | ov19 (COMBAT) | CycleSelectedChar, ItemOverloads, MoneyInGold, ViewMenu, ov19_LoadDeps |
| ov06 (PARTY) | ov26 (VIEW) | HorizontalMenu, VerticalListMenu, ov26_0000 |
| ov06 (PARTY) | ov34 (ECL) | ov34_0000 |
| ov06 (PARTY) | res_01A0 (RESIDENT) | DrawScreenFrame |
| ov06 (PARTY) | res_0542 (RESIDENT) | ClearTextRectangle, DrawWrappedText |
| ov12 (PARTY) | ov19 (COMBAT) | ReadyItem |
| ov12 (PARTY) | ov23 (COMBAT) | AddEffect, ApplyEffect, CallEffectHandler, CallEffectHooks, DamageCharacter, HealCharacter, KillCombatant, RemoveCombatEffects (+6) |
| ov12 (PARTY) | ov31 (VIEW) | BuildTargetList |
| ov12 (PARTY) | ov32 (VIEW) | CombatantCol, CombatantRow, CombatantSize, RemoveCombatant |
| ov12 (PARTY) | ov34 (ECL) | ov34_0000 |
| ov12 (PARTY) | res_0542 (RESIDENT) | MessageDelay |
| ov20 (PARTY) | ov22 (MAGIC) | IsScroll, ShowCasts, UseScrollSpell, ov22_LoadDeps |
| ov20 (PARTY) | ov23 (COMBAT) | HealCharacter, RemoveEffect, Roll, ov23_LoadDeps |
| ov20 (PARTY) | ov26 (VIEW) | AskYesNo, ClearMenuLine, HorizontalMenu, ov26_0000 |
| ov20 (PARTY) | ov34 (ECL) | ov34_0000 |
| ov20 (PARTY) | res_0542 (RESIDENT) | ClearTextRectangle, DrawText, MessageDelay |
| ov21 (PARTY) | ov23 (COMBAT) | Roll, ov23_LoadDeps |
| ov21 (PARTY) | ov26 (VIEW) | FreeMenuList, HorizontalMenu, VerticalListMenu, ov26_0000 |
| ov21 (PARTY) | ov34 (ECL) | ov34_0000 |
| ov21 (PARTY) | res_01A0 (RESIDENT) | DrawScreenFrame |
| ov21 (PARTY) | res_0542 (RESIDENT) | ClearGlyphRun, ClearTextRectangle, DrawText |
| ov21 (PARTY) | res_06EA (RESIDENT) | ReadGameKey |
| ov24 (PARTY) | ov26 (VIEW) | HorizontalMenu, ov26_0000 |
| ov24 (PARTY) | ov28 (VIEW) | RefreshView, ov28_0000 |
| ov24 (PARTY) | ov29 (VIEW) | DrawPictureScreenOrView, DrawPortrait, LoadAnimation, LoadPortrait, ov29_0000 |
| ov24 (PARTY) | ov31 (VIEW) | BuildTargetList, LineInit, LineStep, Sign |
| ov24 (PARTY) | ov32 (VIEW) | CombatantCol, CombatantIndex, CombatantRow, CombatantSize, FocusSquare, InWindow, IsVisible, PaletteFlashOn |
| ov24 (PARTY) | ov33 (VIEW) | ov33_0000 |
| ov24 (PARTY) | ov34 (ECL) | ov34_0000 |
| ov24 (PARTY) | res_01A0 (RESIDENT) | ClearRectangle, DrawScreenFrame, FUN_01a0_0136, FUN_01a0_0397 |
| ov24 (PARTY) | res_0297 (RESIDENT) | AllocPicture, DrawPicture, FlushViewDirtyLines, FreePicture, MirrorPicture |
| ov24 (PARTY) | res_0542 (RESIDENT) | DrawText, DrawWrappedText, MessageDelay, ShowBottomPromptAndReadKey |
| ov24 (PARTY) | res_0713 (RESIDENT) | PlayOrStopSound |
| ov25 (PARTY) | ov26 (VIEW) | FreeMenuList, VerticalListMenu, ov26_0000 |
| ov25 (PARTY) | ov34 (ECL) | ov34_0000 |
| ov25 (PARTY) | res_0542 (RESIDENT) | ShowTimedBottomPrompt |

### 4c. Main game loop path (evidence: RESIDENT.pas.md MainProgram, ENGINE.pas.md PartyCreationMenu, ECL.pas.md ecl_GameLoop, ECL_VM.md §4.4 COMBAT, VIEW.pas.md ExploreCommand / StartCombat, MAGIC.pas.md CombatMain / Camp, COMBAT.pas.md AfterCombat)

```
MainProgram 0000:002F (RESIDENT)
 ├─ unit inits (System, Crt, resident units, ov35_init .. ov00_init)                 0000:002f..011a
 ├─ StartSound; ov11_0000 (pre-load); ov11_0056 engine start-up (ENGINE ov11)          0000:0126..0140
 ├─ ShowTitle (ENGINE ov01) unless ParamStr(1) = 'STING'                               0000:017a
 ├─ HorizontalMenu 'Play Demo' (VIEW ov26, 30 s timeout -> 'D' = DemoMode)             0000:0190
 └─ repeat                                                                             0000:020a
     ├─ PartyCreationMenu 4800:01DD (ENGINE ov17) unless DemoMode — top menu
     │    create (CreateCharacter, ov17), load / save game (ov16), add / drop / train, icon editor,
     │    'B' (begin adventuring) leaves; 'Quit to DOS' = TerminateGame (RESIDENT 06EA)
     ├─ SetBackdropColours (VIEW ov30); ov02_LoadDeps
     ├─ ecl_GameLoop 2200:3772 (ECL ov02)
     │    LoadEclBlock (COMBAT ov07) / ecl_InitVM; ecl_Run(vecE) (block init: LOAD FILES -> VIEW map / wall sets)
     │    repeat
     │      key := ExploreCommand 3F00:090A (VIEW ov14) — 3D view (Draw3DView ov30, RefreshView ov28),
     │             'C' cast ov15_04CB (MAGIC), 'V' ViewMenu 5000:0B75 (COMBAT ov19), 'E' camp, 'L'/'S' look / search
     │      'E' -> ecl_CampCheck: ecl_Run(vecC); Camp ov15_23FC (MAGIC: rest = PARTY ov20 RestLoop, memorise,
     │             scribe, alter: order / drop / speed / pics); after a rest ecl_Run(vecD)
     │      ecl_Run(vecA); MoveParty 3F00:0BAF (VIEW: doors, Bash / Pick / Knock) ; snd_Step; ecl_Run(vecB)
     │      inside ecl_Run: opcode handlers (ECL) -> PRINT / menus (RESIDENT 0542 text, VIEW ov26 menus),
     │             PICTURE (VIEW ov29), TREASURE / DAMAGE / AddNpc (COMBAT ov07, PARTY ov24), PROGRAM (ENGINE ov16
     │             save, ov18 finale), COMBAT 24h:
     │               no monsters: shop Shop 2B00:06F6 (PARTY ov06) / Temple 2700:0DD6 (MAGIC ov04) / AfterCombat
     │               monsters: CombatMain 2F00:00F3 (MAGIC ov08) -> StartCombat 3300:1C3E (VIEW ov10 battlefield)
     │                 rounds: StartCombatRound, NextToAct, TakeTurn (player menu MAGIC ov08 / AI COMBAT ov09
     │                 -> attacks COMBAT ov13, spells MAGIC ov22, effects COMBAT ov23 + PARTY ov12), EndOfRound
     │                 -> AfterCombat 2900:1736 (COMBAT ov05: XP, treasure menu -> PARTY ov21 money)
     │               then the view is redrawn (ov24_2A6D RedrawCurrentMode, PARTY)
     │      ecl_RunAfterNewBlock after NEW ECL (next block)
     │    until PartyDead
     ├─ ov11_06D8 reset game state (ENGINE ov11)
     └─ DemoMode: ShowTitle, 'Play Demo' menu again (10 s), RuneWheelCheck (ENGINE ov03) unless ParamStr(2) = 'Wooden'
    until false (exit only through TerminateGame)
```

## 5. Unknown roll-up

Every remaining placeholder in the pseudo files, ECL_VM.md, the SCREENS files and decode/data/*.md:
`g_XXXX` (DS global; split into "no name anywhere" and "named in globals.json but written as g_ here"), `FUN_SSSS_OOOO`,
`ovNN_XXXX` (split into "no real name" and "a real name exists" = §2c), `unk_` / `DAT_`. Generated by
`python -I decode/tools/crossref.py s5`. Owner = the lane of the file.

Applied in the cab-rt files in this pass: §2c routine placeholders (RESIDENT 144, ENGINE 50, PARTY 74) and the DS
globals that have a name in globals.json, inside the Pascal code (`crossref.py apply5`: RESIDENT 11, ENGINE 53,
PARTY 14). The `g_ named` counts left in the cab-rt files are prose alias lists and `{ ... }` cites
(`ImportSource = g_7584`, `{ ... g_37E7 }`) that keep the address on purpose. The Fable-lane files carry the same
mechanical work as fix requests #xref-1..4 (§2c; `apply5` does the globals the same way). The `g_ — no name anywhere`
column is the real unknown list: 5b gives each offset with the files that mention it; meanings are in GLOBALS.md
(writers / readers) and the files' Unknowns sections.

Applied in the Fable-lane files (cab-fixes: names, 2026-10-20): `apply2c` placeholders (COMBAT 735, MAGIC 246, VIEW 36, ECL 11, ECL_VM.md 179, the four
SCREENS files 19) and `apply5` globals inside the Pascal code (COMBAT 7, MAGIC 2, VIEW 65, ECL 5; VIEW_SCREENS 6 and ECL_SCREENS 7 named globals in
the rows). What is left in those files is unnamed (5b / 5c), or an address kept on purpose in prose and `{ ... }` cites.

### 5a. Per file (tokens / distinct)

| file | owner | g_XXXX (no name anywhere) | g_XXXX (named in globals.json) | FUN_ | ovNN_XXXX (no real name) | ovNN_XXXX (real name exists) | unk_ / DAT_ |
|---|---|---|---|---|---|---|---|
| decode/pseudo/RESIDENT.pas.md | cab-rt | 60 / 36 | 79 / 60 | 25 / 16 | 10 / 4 |  |  |
| decode/pseudo/ENGINE.pas.md | cab-rt | 51 / 19 | 30 / 16 | 4 / 3 | 25 / 12 |  |  |
| decode/pseudo/ECL.pas.md | Fable (eclview) | 18 / 8 | 27 / 25 |  | 1 / 1 |  |  |
| decode/pseudo/VIEW.pas.md | Fable (eclview) | 98 / 65 | 143 / 91 | 3 / 2 | 6 / 5 |  |  |
| decode/pseudo/COMBAT.pas.md | Fable (combat) | 60 / 37 | 169 / 125 | 12 / 3 | 33 / 4 |  |  |
| decode/pseudo/MAGIC.pas.md | Fable (magic) | 41 / 19 | 91 / 65 | 2 / 1 | 99 / 75 |  |  |
| decode/pseudo/PARTY.pas.md | cab-rt | 27 / 10 | 3 / 3 | 6 / 2 | 13 / 9 |  | 1 / 1 |
| decode/ecl/ECL_VM.md | Fable (eclview) |  |  | 2 / 1 | 8 / 7 |  |  |
| decode/data/BIGPIC.md | cab-data |  |  |  |  |  |  |
| decode/data/DAX.md | cab-data |  |  |  |  |  |  |
| decode/data/GEO.md | cab-data |  |  |  | 1 / 1 |  |  |
| decode/data/INDEX.md | cab-data |  |  |  | 3 / 1 |  |  |
| decode/data/ITEM.md | cab-data |  |  | 2 / 2 |  |  |  |
| decode/data/ITEMS.md | cab-data |  |  |  | 1 / 1 |  |  |
| decode/data/MONSTERS.md | cab-data |  |  |  |  |  |  |
| decode/data/PICTURES.md | cab-data |  |  |  |  |  |  |
| decode/data/SKY.md | cab-data |  |  |  |  |  |  |
| decode/data/TILES.md | cab-data |  |  |  |  |  |  |
| decode/data/WALLDEF.md | cab-data |  |  |  | 1 / 1 |  |  |
| decode/pseudo/COMBAT_SCREENS.md | Fable (combat) |  |  |  |  |  |  |
| decode/pseudo/ECL_SCREENS.md | Fable (eclview) | 1 / 1 |  |  | 1 / 1 |  |  |
| decode/pseudo/ENGINE_SCREENS.md | cab-rt |  |  |  | 1 / 1 | 1 / 1 |  |
| decode/pseudo/MAGIC_SCREENS.md | Fable (magic) | 3 / 3 |  | 1 / 1 |  |  |  |
| decode/pseudo/PARTY_SCREENS.md | cab-rt |  |  |  |  |  |  |
| decode/pseudo/RESIDENT_SCREENS.md | cab-rt |  |  |  |  |  |  |
| decode/pseudo/VIEW_SCREENS.md | Fable (eclview) | 3 / 3 |  |  |  |  |  |

Totals: g_ unnamed 362, g_ with a name in globals.json 542, FUN_ 57 (+0 with a real name), ovNN_ unnamed 203, ovNN_ with a real name 1, unk_/DAT_ 1.

### 5b. DS globals still without a name (by number of mentions)

| DS | mentions | files |
|---|---|---|
| 4A1C | 22 | ENGINE |
| 75E0 | 13 | MAGIC, PARTY, VIEW |
| 7746 | 10 | MAGIC |
| 8B54 | 9 | MAGIC, PARTY |
| 25A2 | 8 | VIEW |
| 8C7C | 7 | ENGINE, VIEW, VIEW_SCREENS |
| 25B0 | 6 | ENGINE, MAGIC, MAGIC_SCREENS, RESIDENT |
| 4FC8 | 5 | ENGINE |
| 47E3 | 5 | ECL, ECL_SCREENS |
| 8B6E | 5 | ECL, PARTY |
| 47DE | 4 | RESIDENT |
| 4CBF | 4 | RESIDENT |
| 7214 | 4 | ENGINE, VIEW |
| 8B5F | 4 | ECL, ENGINE |
| 7586 | 4 | ENGINE |
| 8B63 | 4 | COMBAT, ECL |
| 0B08 | 4 | VIEW |
| 25BE | 4 | COMBAT |
| 27BD | 4 | MAGIC |
| 47EE | 4 | PARTY |
| 7298 | 3 | RESIDENT, VIEW |
| 47DF | 3 | RESIDENT |
| 4E40 | 3 | RESIDENT |
| 4FE3 | 3 | RESIDENT |
| 4CBA | 3 | RESIDENT |
| 4F98 | 3 | ENGINE, RESIDENT |
| 4FCB | 3 | RESIDENT |
| 58D8 | 3 | RESIDENT |
| 0AF6 | 3 | VIEW |
| 0B1C | 3 | VIEW |
| 7232 | 3 | COMBAT, PARTY |
| 37E5 | 3 | COMBAT |
| 25BA | 3 | COMBAT |
| 25C4 | 3 | COMBAT |
| 25B8 | 3 | COMBAT |
| 25C2 | 3 | MAGIC, MAGIC_SCREENS |
| 25BC | 3 | MAGIC, MAGIC_SCREENS |
| 6E9A | 3 | PARTY |
| 8C9A | 2 | RESIDENT |
| 8B70 | 2 | RESIDENT |
| 5370 | 2 | RESIDENT |
| 258B | 2 | RESIDENT |
| 25C8 | 2 | ENGINE, RESIDENT |
| 25CA | 2 | RESIDENT |
| 25C6 | 2 | ENGINE, RESIDENT |
| 25B6 | 2 | ENGINE, VIEW |
| 7216 | 2 | ENGINE |
| 8B64 | 2 | ECL |
| 47E4 | 2 | ECL |
| 0B0A | 2 | VIEW |
| 0AF8 | 2 | VIEW |
| 0B0C | 2 | VIEW |
| 0AFC | 2 | VIEW |
| 0B10 | 2 | VIEW |
| 0B02 | 2 | VIEW |
| 0B16 | 2 | VIEW |
| 2680 | 2 | VIEW |
| 0A48 | 2 | VIEW, VIEW_SCREENS |
| 0A68 | 2 | VIEW, VIEW_SCREENS |
| 0B1E | 2 | VIEW |
| 0B3E | 2 | VIEW |
| 0B2E | 2 | VIEW |
| 2558 | 2 | VIEW |
| 27A2 | 2 | VIEW |
| 26A5 | 2 | VIEW |
| 02FA | 2 | VIEW |
| 47F2 | 2 | COMBAT |
| 37E6 | 2 | COMBAT |
| 5CFB | 2 | COMBAT |
| 0F85 | 2 | COMBAT |
| 0E9C | 2 | COMBAT |
| 0EEC | 2 | COMBAT |
| 0CB6 | 2 | COMBAT |
| 0FE0 | 2 | COMBAT |
| 0CAE | 2 | COMBAT |
| 756C | 2 | MAGIC |
| 24EC | 1 | RESIDENT |
| 4E93 | 1 | RESIDENT |
| 4E9C | 1 | RESIDENT |
| 4E41 | 1 | RESIDENT |
| 8B72 | 1 | RESIDENT |
| 4FEE | 1 | RESIDENT |
| 4A24 | 1 | RESIDENT |
| 2589 | 1 | RESIDENT |
| 2587 | 1 | RESIDENT |
| 2585 | 1 | RESIDENT |
| 2583 | 1 | RESIDENT |
| 2581 | 1 | RESIDENT |
| 257F | 1 | RESIDENT |
| 0C80 | 1 | RESIDENT |
| 0C84 | 1 | RESIDENT |
| 25D5 | 1 | RESIDENT |
| 4FDE | 1 | RESIDENT |
| 0C97 | 1 | RESIDENT |
| 8C9E | 1 | ENGINE |
| 8B60 | 1 | ENGINE |
| 8B61 | 1 | ENGINE |
| 5BE8 | 1 | ENGINE |
| 8C76 | 1 | ENGINE |
| 8C77 | 1 | ENGINE |
| 8B6F | 1 | ENGINE |
| 557D | 1 | ECL |
| 47E5 | 1 | ECL |
| 2736 | 1 | VIEW |
| 273F | 1 | VIEW |
| 6698 | 1 | VIEW |
| 260A | 1 | VIEW |
| 0AD8 | 1 | VIEW |
| 0AE2 | 1 | VIEW |
| 0AEC | 1 | VIEW |
| 0AFA | 1 | VIEW |
| 0AFE | 1 | VIEW |
| 0B12 | 1 | VIEW |
| 0B00 | 1 | VIEW |
| 0B14 | 1 | VIEW |
| 0B04 | 1 | VIEW |
| 0B18 | 1 | VIEW |
| 0B06 | 1 | VIEW |
| 0B1A | 1 | VIEW |
| 2682 | 1 | VIEW |
| 6AB2 | 1 | VIEW |
| 268A | 1 | VIEW |
| 0A98 | 1 | VIEW |
| 0AA8 | 1 | VIEW |
| 0AB8 | 1 | VIEW |
| 0AC8 | 1 | VIEW |
| 0C26 | 1 | VIEW |
| 0CE2 | 1 | VIEW |
| 0CF2 | 1 | VIEW |
| 5F27 | 1 | VIEW |
| 2844 | 1 | VIEW |
| 27A3 | 1 | VIEW |
| 279D | 1 | VIEW |
| 0349 | 1 | VIEW |
| 034D | 1 | VIEW |
| 0352 | 1 | VIEW |
| 02EA | 1 | VIEW |
| 02FE | 1 | VIEW |
| 0306 | 1 | VIEW |
| 02DA | 1 | VIEW |
| 030E | 1 | VIEW |
| 6E59 | 1 | VIEW |
| 5D9A | 1 | COMBAT |
| 02A8 | 1 | COMBAT |
| 6510 | 1 | COMBAT |
| 02A7 | 1 | COMBAT |
| 84E1 | 1 | COMBAT |
| 02BB | 1 | COMBAT |
| 6825 | 1 | COMBAT |
| 6DE4 | 1 | COMBAT |
| 286C | 1 | COMBAT |
| 6819 | 1 | COMBAT |
| 6826 | 1 | COMBAT |
| 6E31 | 1 | COMBAT |
| 6E56 | 1 | COMBAT |
| 6E57 | 1 | COMBAT |
| 0828 | 1 | COMBAT |
| 6821 | 1 | COMBAT |
| 5CF8 | 1 | COMBAT |
| 5CF9 | 1 | COMBAT |
| 0A30 | 1 | COMBAT |
| 0A44 | 1 | COMBAT |
| 0A2F | 1 | COMBAT |
| 00E4 | 1 | MAGIC |
| 00DE | 1 | MAGIC |
| 00DD | 1 | MAGIC |
| 04A4 | 1 | MAGIC |
| 04CD | 1 | MAGIC |
| 7568 | 1 | MAGIC |
| 756A | 1 | MAGIC |
| 0875 | 1 | MAGIC |
| 7430 | 1 | MAGIC |
| 0A10 | 1 | MAGIC |
| 37E1 | 1 | MAGIC |
| 4846 | 1 | PARTY |
| 6E36 | 1 | PARTY |
| 25B4 | 1 | PARTY |
| 25B2 | 1 | PARTY |

### 5c. Routines still without a real name (ovNN_XXXX, by mentions)

| routine | mentions | files |
|---|---|---|
| ov11_0056 | 19 | ENGINE, ENGINE_SCREENS, INDEX, PARTY, RESIDENT |
| ov24_305b | 17 | COMBAT, MAGIC, PARTY |
| ov24_2e05 | 16 | COMBAT, MAGIC, PARTY, VIEW |
| ov23_1569 | 11 | COMBAT, MAGIC |
| ov22_1e0f | 8 | MAGIC |
| ov11_06d8 | 6 | ENGINE, RESIDENT |
| ov23_1603 | 6 | COMBAT |
| ov22_1dd5 | 6 | MAGIC |
| ov11_0000 | 4 | ENGINE, RESIDENT |
| ov17_0000 | 4 | ECL_SCREENS, ECL_VM, ENGINE, RESIDENT |
| ov34_0000 | 4 | ECL, ENGINE, VIEW |
| ov35_0000 | 3 | ENGINE, VIEW |
| ov27_0000 | 3 | ECL_VM, VIEW |
| ov22_23f2 | 3 | MAGIC |
| ov12_0000 | 2 | ENGINE, PARTY |
| ov31_0000 | 2 | ECL_VM, VIEW |
| ov22_2682 | 2 | MAGIC |
| ov22_36a7 | 2 | MAGIC |
| ov06_0000 | 2 | ECL_VM, PARTY |
| ov24_0000 | 2 | PARTY |
| ov03_0000 | 1 | ENGINE |
| ov33_0000 | 1 | ENGINE |
| ov29_0000 | 1 | ENGINE |
| ov26_0000 | 1 | ENGINE |
| ov16_0000 | 1 | ENGINE |
| ov22_1cf9 | 1 | MAGIC |
| ov22_1d2a | 1 | MAGIC |
| ov22_1d55 | 1 | MAGIC |
| ov22_1d93 | 1 | MAGIC |
| ov22_1e4e | 1 | MAGIC |
| ov22_1e7c | 1 | MAGIC |
| ov22_1ec9 | 1 | MAGIC |
| ov22_1fa0 | 1 | MAGIC |
| ov22_20e1 | 1 | MAGIC |
| ov22_2180 | 1 | MAGIC |
| ov22_21c7 | 1 | MAGIC |
| ov22_2232 | 1 | MAGIC |
| ov22_2260 | 1 | MAGIC |
| ov22_22b4 | 1 | MAGIC |
| ov22_245b | 1 | MAGIC |
| ov22_2494 | 1 | MAGIC |
| ov22_24cd | 1 | MAGIC |
| ov22_2580 | 1 | MAGIC |
| ov22_262f | 1 | MAGIC |
| ov22_26bb | 1 | MAGIC |
| ov22_26f6 | 1 | MAGIC |
| ov22_2754 | 1 | MAGIC |
| ov22_2f5e | 1 | MAGIC |
| ov22_2fa4 | 1 | MAGIC |
| ov22_3076 | 1 | MAGIC |
| ov22_3093 | 1 | MAGIC |
| ov22_352d | 1 | MAGIC |
| ov22_36e0 | 1 | MAGIC |
| ov22_391d | 1 | MAGIC |
| ov22_3c98 | 1 | MAGIC |
| ov22_3ced | 1 | MAGIC |
| ov22_3ee2 | 1 | MAGIC |
| ov22_3f23 | 1 | MAGIC |
| ov22_3f6f | 1 | MAGIC |
| ov22_3ff4 | 1 | MAGIC |
| ov22_4043 | 1 | MAGIC |
| ov22_407a | 1 | MAGIC |
| ov22_40d5 | 1 | MAGIC |
| ov22_4103 | 1 | MAGIC |
| ov22_413f | 1 | MAGIC |
| ov22_4194 | 1 | MAGIC |
| ov22_4289 | 1 | MAGIC |
| ov22_4311 | 1 | MAGIC |
| ov22_43a7 | 1 | MAGIC |
| ov22_43ea | 1 | MAGIC |
| ov22_4432 | 1 | MAGIC |
| ov22_4493 | 1 | MAGIC |
| ov22_44d3 | 1 | MAGIC |
| ov22_45b5 | 1 | MAGIC |
| ov22_4672 | 1 | MAGIC |
| ov22_472c | 1 | MAGIC |
| ov22_4759 | 1 | MAGIC |
| ov22_4791 | 1 | MAGIC |
| ov22_4822 | 1 | MAGIC |
| ov22_48e4 | 1 | MAGIC |
| ov22_4a8f | 1 | MAGIC |
| ov22_4bec | 1 | MAGIC |
| ov22_4da0 | 1 | MAGIC |
| ov22_4eb4 | 1 | MAGIC |
| ov22_4ef7 | 1 | MAGIC |
| ov22_54eb | 1 | MAGIC |
| ov22_5590 | 1 | MAGIC |
| ov22_563b | 1 | MAGIC |
| ov22_5669 | 1 | MAGIC |
| ov22_5697 | 1 | MAGIC |
| ov22_56c4 | 1 | MAGIC |
| ov22_578b | 1 | MAGIC |
| ov20_0000 | 1 | PARTY |
| ov21_0000 | 1 | PARTY |
| ov25_0000 | 1 | PARTY |
| ov07_1a6f | 1 | ECL_VM |
| ov32_0000 | 1 | ECL_VM |
| ov17_22d5 | 1 | ECL_VM |
| ov29_10c7 | 1 | GEO |
| ov11_002d | 1 | ITEMS |
| ov29_0e08 | 1 | WALLDEF |

## 6. Data <-> code

### 6a. decode/data/INDEX.md `loader (code)` column — every loader resolved

The OVR file offsets of INDEX.md were converted to `seg:off` (`decode/bin/ovl_layout.json` file offsets + `functions.tsv`
ranges) and, for string references, to the routine that loads the string (`MOV DI,cs-offset`). Written into INDEX.md
(commit bed3d63) because cab-data is paused (STATUS note). Result:

| file(s) | loader |
|---|---|
| TITLE | ShowTitle 2100:0635 (ENGINE ov01) |
| PIC1..6 | LoadAnimation 6C00:01A7 (VIEW ov29) |
| SPRIT1..6 | ShowEncounter 2C00:05DA (COMBAT ov07); INDEX's second offset 0x41C85 is ov34's tracer text "SPRITE OFF", not a loader (corrected) |
| HEAD / BODY | LoadPortrait 6C00:0619 / 0685 (VIEW ov29) |
| CHEAD / CBODY | LoadCharacterIcon 4300:0A9D (ENGINE ov16), LoadCombatIcon 7200:0208 (VIEW ov33) |
| CPIC1..6 | ecl_op0B_LoadMonster 2200:0520 (ECL), SetupDuel 2C00:1C52 (COMBAT), AddNpcToParty 4300:3566 and LoadGame 4300:3C50 (ENGINE) |
| COMSPR, SKY, ITEMS | ov11_0056 engine start-up 3500:05A5 / 05EB / 065D (ENGINE ov11) |
| DUNGCOM / WILDCOM / RANDCOM | PrepareBattlefield 3300:1046 (VIEW ov10) |
| 8X8D1..6 | Load8x8Set 7400:009B (VIEW ov35); 8X8d1 font: res_0542 0542:018A (RESIDENT) |
| WALLDEF2..6 | LoadWallSet 6D00:104C (VIEW ov30) |
| GEO2..6 | Load3DMap 6D00:133A (VIEW ov30) |
| ECL1..6 | LoadEclBlock 2C00:03E3 (COMBAT ov07, ECL_VM.md §1) |
| MON1..6 CHA / ITM / SPC | LoadMonster 4300:3254 (ENGINE ov16) |
| ITEM1..6 | ecl_op27_Treasure 2200:1B53 (ECL) |
| BIGPIC1/2/6 | LoadBigPic 6C00:0813 (VIEW ov29) |
| TILES | RuneWheelCheck 2600:0126 via Load24x24Set (ENGINE ov03 -> VIEW ov33) |
| CURSE.CFG | StartupConfiguration 020F:027C (RESIDENT): written 020F:030C..0638, read 020F:0667..086F — was "open: reader not yet located" |
| DAX container | LoadDaxRecord 0636:08DE (RESIDENT) for every `.DAX` above |

### 6b. Spec fields and their readers in the code

| spec | fields | reader(s) | result |
|---|---|---|---|
| DAX.md container | file header (record count, directory id / offset / raw / packed size), RLE records | LoadDaxRecord 0636:08DE (RESIDENT: directory scan, size check, decode into the caller's buffer) | all fields read — confirmed |
| PICTURES.md P / A / F | picture header (height, width, x, y, frame count / size at `+11h`), EGA planes, animation frame deltas, 8x8 font | LoadPicture 0297:011B, DrawPicture 0297:09E4, PutPicture 0297:1110 (RESIDENT); LoadAnimation / FreeAnimation 6C00 (VIEW: XOR delta frames 6c00:0458..047d, frame size `+11h` 6c00:03dc); font 0542:018A | confirmed (header words, frame size, plane layout, delta frames) |
| ITEMS.md (16-byte item-type record j0..j15) | j0 slot, j1 hands, j2 / j3, j5, j6, j7 flags, j9..j11 damage, j12 range, j13 usable_by (bit 7 new), j14 wflags2 | j0: ReadyItem, RecalcItems, AddItemAC, ArmourMoveLimit, IsScroll, AiReadyBestWeapon; j1: RecalcItems, ReadyItem; j2 / j3: ItemDebugView only; j5: CalcAttacks; j6: AddItemAC; j7: EffHalveEdged / EffHalveWeapon / EffOneDamageFromWflag1 (ov12); j9..j11: RecalcWeaponStats; j12: WeaponIsRanged, RangePenalty, SelectTarget, AiMoveAttack; j13: ReadyItem, UpdateLevelStats, ChangeClass, AiReadyBestWeapon; j14: RecalcWeaponStats, GetMissileAmmo, ov24_305B (globals_xref.tsv, DS 5CF6..5D04) | 12 of 16 bytes read by constant displacement; **j4, j8, j15 have no direct reader** (whole-record copies `t := ITEMS[...]` at 3100:1566 / 3a00:162b may read them through the copy — open, L) |
| ITEM.md / MONSTERS.md ITM (63-byte item record) | +0 name, +2Ah next, +2Eh type, +2Fh..+31h name words, +32h / +33h plus, +34h readied, +35h hidden, +36h cursed, +37h weight, +39h count, +3Ah value, +3Bh..+3Eh powers | PARTY.pas.md `## Character record` item notes (BuildItemName, ReadyItem, RecalcItems, ShopItemsMenu, MakeTreasureItem, ov12 item hooks; COMBAT ov19 ItemDebugView names every field) | every field has a reader — confirmed |
| MONSTERS.md CHA (422-byte record = the character record) | 1A6h bytes | PARTY.pas.md `## Character record` (field table with readers per offset; LoadMonster 4300:3254 reads the record, ConvertPoolCharacter maps Pool's) | confirmed except the L rows of that table (+E7h/+E8h, +F6h, +F8h..+FAh, +135h/+136h, +143h, +192h: copied only) |
| MONSTERS.md SPC (9-byte effect record) | +0 type, +1 duration, +3 p3, +4 callOnRemove, +5 next | AddEffect / RemoveEffect / TickEffects (COMBAT ov23), ov12 handlers | confirmed |
| GEO.md (1026-byte map: 4 planes of 100h + header) | wall-type nibbles, passage states, cell attribute byte | Load3DMap 6D00:133A (4 × Move 100h after the 2-byte header), GetWallType 6D00:06BD, GetCellAttr 6D00:07C6, MoveParty / doors (VIEW ov14) | confirmed |
| WALLDEF.md (780-byte blocks, 5 wall types × 156) | block size 30Ch, slot rebasing, 8X8D pairing | LoadWallSet 6D00:104C (size checks, slot), Draw3DView wall pieces (VIEW ov30), Put8x8Symbol / Load8x8Set (VIEW ov35) | confirmed (the 8X8D1/202 40-tile delta vs Put8x8Symbol's base table stays open in WALLDEF.md) |
| BIGPIC.md (304×120) | records 120..123 | LoadBigPic 6C00:0813, DrawBigPic 6C00:0881 (VIEW), ov27 overlay animation (BIGPIC 121) | confirmed |
| SKY.md (250 / 251 / 252) | sun strip, moon, sky strip | ov11_0056 loads (3500:05EB), DrawBackdrop 6D00 (VIEW: sky_Sun / sky_Moon / sky_Strip by party_Dir and the clock) | confirmed; which DS pointer holds which record is noted open in VIEW (L72) |
| TILES.md (26 + 22 runes) | records 1, 2 | RuneWheelCheck 2600:011A: Load24x24Set('tiles', 1, 0, 1Ah) / ('tiles', 2, 1Ah, 16h) | confirmed |
| CURSE.CFG | 4 lines | StartupConfiguration 020F (above) | confirmed (new row) |
| saves (`.guy/.swg/.fx`, `CHRDAT*.sav`) | character / item / effect records + game file | ENGINE.pas.md ov16 file table (WriteCharacter, SaveGame, LoadGame) | code side complete; a DOSBox-made save to check it against is still open (gate item 6) |
