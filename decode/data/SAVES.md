# Saves — Curse of the Azure Bonds v1.0 (DOSBox-made saves, cab-saves-ref)

Owner: cab-saves-ref (= cab-data). Tool: `decode/tools/cabsave.py` (`dump DIR`, `diff DIR_A DIR_B`; field names from this file).
Code: ENGINE.pas.md ov16 (WriteCharacter 4300:0DEA, ReadCharacter 4300:228E, LoadGame 4300:3748, SaveGame 4300:3EDD); the
422-byte record map is PARTY.pas.md `## Character record`; VM regions ECL_VM.md §3. No save ships with the game (FOREMAN.md).

## 0. How the saves were made — evidence base
Original START.EXE under DOSBox-X in a scratch copy (acceptance/ref/README.md, scripts `acceptance/ref/scripts/runs/*.txt`), no
patches. The save files contain the current ECL block (original game data), so they stay local: `acceptance/local/saves/<run>/`.

| run | what was done | files written |
|---|---|---|
| explore8 | create ALPHA (dwarf, male, fighter, lawful good; first roll), `Save ALPHA?` Y | `ALPHA.GUY` 422, `ALPHA.FX` 27 |
| saveA | as above + Add to party, top menu `Save Current Game` A | `SAVGAMA.DAT` 13149, `CHRDATA1.SAV` 422, `CHRDATA1.FX` 27 (`ALPHA.GUY/.FX` deleted) |
| camp (camp.txt, one run, one character) | Begin → 3D start room (7,13 E) → Encamp → Save **B**; Alter/Speed/Slower (4→5) → Save **C**; View/Drop 10 platinum (300→290) → Save **D** | `SAVGAM{B,C,D}.DAT`, `CHRDAT{B,C,D}1.SAV/.FX` |

Controlled changes (`cabsave.py diff`, files renamed to a common name first):
- **B → C (game speed 4 → 5 only):** `.SAV` and `.FX` identical; `SAVGAM` data differs in exactly one byte, **0x1F9 = VM 4B00 + 1F8h (word 4BFC) 04 → 05** — confirms the game-speed slot (SaveGame 4300:4125 `ecl_Mem4B00^.w[1F8h div 2] := GameSpeed`) — H. The other 74 differing bytes are the name `'CHRDATB1'→'CHRDATC1'` (+0x321C) and unused tails of the name strings (§1, note on stale bytes).
- **C → D (drop 10 platinum only):** `.SAV` differs in exactly two places: **+103h** (money[4] = platinum, word) `2C 01 → 22 01` (300 → 290) and **+187h** (encumbrance, word) `2C 01 → 22 01` (coins weigh 1 each) — H; `SAVGAM` again only the name letter and stale name tails.
- Field values of D checked against the on-screen sheet of the same run (REF-S095): name, age 51, STR..CHA 17/17/13/16/12/11, platinum, level 5, EXP 25000, AC 8 (= 60 − 34h), THAC0 15 (= 60 − 2Dh), damage 1d2+1, HP 44, movement 12 — all agree (§2).

## 1. `SAVGAM<k>.DAT` (k = A..J) — 13,149 bytes (335Dh), fixed size — H
Written by SaveGame 4300:415a..434e, read by LoadGame 4300:3945..3aaf in the same order. Size of all four DOSBox saves = 13149 (H).

| off | size | content | observed (A = top menu before Begin; D = in camp) | conf |
|---|---|---|---|---|
| 0000 | 1 | DataSet (DS:5BEE) | 02 in all | H |
| 0001 | 800h | VM 4B00..4EFF (word array, ecl_Mem4B00^; VM word w at byte 2·(w − 4B00h)) | A: 4BE6=1, 4BFC=4, 4BFF=3; D: also 4BC5=1, 4BF2=1, 4BFD=0Bh, 4BFE=09 | H (layout) |
| 0801 | 800h | VM 7C00..7FFF (ecl_Mem7C00^) | A and D: 7F12=2 (data set, SaveGame 4300:414c), 7F3E=1 (party size); D also 7EC6=63h, 7EE1=FFh | H (layout) |
| 1001 | 400h | VM 7A00..7BFF (ecl_Mem7A00^) | all zero at this point of the game | H (layout) |
| 1401 | 1E00h | ecl_CodeBuf^ = the current ECL block | A: all zero (no block loaded yet); B/C/D: **= ECL2.DAX record 1 without its first 2 bytes, rest zero** (byte compare) | H |
| 3201 | 5 | DS:720F party_MapX, 7210 party_MapY, 7211 party_Dir (×2), 7212 wall type ahead, 7213 cell attribute | A: 07 0D 00 00 00; D: 07 0D 02 06 80 (screen `7,13 E`) | H (names: ECL_VM C04B..C04F) |
| 3206 | 1 | view_PrevMode (DS:4FBB) | A 0, D 0 | H |
| 3207 | 1 | view_Mode (DS:4FBA) | A 0 (top menu), D 2 (camp) | H |
| 3208 | 12 | wall-set slots i = 1..3: word DS:7210+4i (id), word DS:7212+4i (slot) | A: (0,1), (FFFF,FFFF), (FFFF,FFFF); D: (1,1), (2,2), (3,3) | H (layout) / M (id vs slot order) |
| 3214 | 1 | member count | 1 | H |
| 3215 | 148h | member file names, `array[1..8] of string[40]` (41 B each): `'CHRDAT' + k + n` | `08 'CHRDATD1'` then garbage | H |

Game-speed and picture options live inside the 4B00 region: **+1F8h = 4BFC game speed** (proven by B→C), **+1FEh = 4BFF = pics·2 + animation** (3 = both on; LoadGame 4300:3aba/3acd) — H / M (the 1FEh value not varied).
Stale bytes: only the length-counted part of each name string is written by the code; the rest of the 148h-byte local array is stack garbage (B→C/C→D differ there by 70+ bytes, including menu text fragments like `Alter:` / `Trade Drop Exit`). A reader must ignore everything after each string's length and every entry beyond `count` — H.

## 2. Character record `CHRDAT<k><n>.SAV` / `<NAME>.GUY` — 422 bytes (1A6h) — H (size)
Same bytes in both file kinds (WriteCharacter BlockWrite(f, ch, 1A6h); `.guy` for stand-alone characters, `CHRDAT…` for saved-game members). Field map = PARTY.pas.md `## Character record`; this table lists what the DOSBox saves **confirm** (value observed = save D, ALPHA, checked against REF-S095) — everything else keeps the PARTY confidence and is not repeated here.

| off | size | field | observed (D) | check | conf |
|---|---|---|---|---|---|
| 00 | 16 | name string[15] | `05 'ALPHA'` | sheet | H |
| 10..1B | 12 | ability max/cur pairs STR INT WIS DEX CON CHA | 11 11 11 11 0D 0D 10 10 0C 0C 0B 0B | sheet 17 17 13 16 12 11 | H |
| 1C/1D | 2 | str_exc max/cur | 0/0 | STR 17 (no exceptional) | H |
| 73 | 1 | base_thac0 (60 − THAC0) | 2Ch (16) | — | M |
| 74 | 1 | race | 01 = dwarf (first list entry) | sheet `DWARF` | H |
| 75 | 1 | class | 02 = fighter | sheet | H |
| 76 | 2 | age | 0033h = 51 | sheet `AGE 51` | H |
| 78 | 1 | hp_max | 2Ch = 44 | sheet HP 44 | H |
| DD | 1 | fighter_lvl_eff | 5 | level 5 | M |
| DF..E3 | 5 | save[0..4] | 0E 0C 0D 0D 0E | — | L (not shown on screen) |
| E4 | 1 | base_move | 0Ch = 12 | sheet MOVEMENT 12 | H |
| E5 | 1 | level_main | 5 | sheet LEVEL 5 | H |
| F2 | 4 | effects ptr (stale) | 09 00 FA 58 (non-zero although meaningless) | ReadCharacter clears it | H |
| FB..108 | 14 | money[0..6] words | platinum (index 4, +103h) 290 | **diff C→D**, sheet | H |
| 109..110 | 8 | level[0..7] | fighter (index 2, +10Bh) = 5 | sheet | H |
| 119 | 1 | gender | 0 = male | sheet | H |
| 11B | 1 | alignment | 0 = lawful good | sheet | H |
| 11C | 1 | attacks (half attacks) | 2 | — | M |
| 11E..123 | 6 | base dmg dice/sides/bonus ×2 | 01 00 02 00 00 00 = 1d2 | sheet base | H |
| 124 | 1 | base_ac (60 − AC) | 32h = AC 10 | — | M |
| 125 | 1 | STR bonus flag | 1 | — | M |
| 126 | 1 | id (random) | EDh | — | M |
| 127 | 4 | xp | 000061A8h = 25000 | sheet EXP 25000 | H |
| 12B | 1 | class_mask | 08 (fighter) | ITEMS usable mask bit 8 | H |
| 12C | 1 | hp_rolled | 2Ch | — | M |
| 13F..142 | 4 | head_pic, body_pic, icon_head, icon_body | 00 00 00 00 | — | M |
| 143 | 1 | `unk_143` (PARTY: `:= 0Ah for new characters`) | **0Ah in ALPHA.GUY right after creation (explore7, explore8) — agrees; 00 in every CHRDAT…SAV**, including save A made at the top menu before Begin | something between Add-to-party and SaveGame clears it (writer not located) | M (creation value) / L (meaning) |
| 144 | 1 | icon_size | 1 (small) | icon editor default | H |
| 145..14A | 6 | icon_colours | 91 A2 B3 C4 E6 F7 | — | M |
| 14C | 1 | item_count | 0 | no items | H |
| 14D | 4 | items ptr | 0 (no items) | — | H |
| 187 | 2 | encumbrance | 0122h = 290 | **diff C→D**, sheet 300 before | H |
| 189 / 18D | 4+4 | next / combatant ptrs | 0 | — | H |
| 195 | 1 | status | 0 = okay | sheet `STATUS OKAY` | H |
| 196 | 1 | active | 1 | — | H |
| 199 | 1 | thac0 (current) | 2Dh = THAC0 15 | sheet THAC0 15 | H |
| 19A / 19B | 1+1 | ac / ac_rear | 34h = AC 8 / 30h | sheet AC 8 | H / M |
| 19E..1A3 | 6 | dmg dice/sides/bonus ×2 | 01 00 02 00 01 00 = 1d2+1 | sheet DAMAGE 1D2+1 | H |
| 1A4 | 1 | hp | 2Ch = 44 | sheet | H |
| 1A5 | 1 | move | 0Ch = 12 | sheet | H |

All other bytes of D are 0 (spell arrays +1E..+71, +79..+DC, thief skills +EA..+F1 for a fighter; +F6..+FA, +111..+118, +12D..+13E, +151..+184, +191..+194). Unknown fields keep their PARTY names `unk_F6`, `unk_F8..FA`, `unk_135..136`, `unk_143`, `unk_192..194`.

## 3. `.SWG` — items, n × 63 bytes; `.FX` — effects, n × 9 bytes — H (layout)
- `.FX`: ALPHA (dwarf) has 3 effects in every file: `61 00 00 FF 00 | 02 00 FB 58`, `1A 00 00 FF 00 | 0B 00 FB 58`, `2F 00 00 FF 00 | 00 00 00 00` = type, duration word 0, p3 FFh, callOnRemove 0, next ptr (stale; **the last entry's link is 0**) — H for layout (= Pool 9-byte effect, MONSTERS.md). Types 61h/1Ah/2Fh are the dwarf's racial effects (M, effect names: MAGIC lane).
- `.SWG`: not produced — a new character owns no items, and WriteCharacter writes the file only for a non-empty list (ENGINE quirk 4300:1249, confirmed: no `.SWG` in any run). Layout therefore by code only (63-byte item, PARTY.pas.md / ITEM.md) — H (code), not DOSBox-confirmed.
- Stand-alone files are deleted when the character becomes part of a saved game: `ALPHA.GUY/.FX` gone after Save A (ENGINE quirks 3be6 / SaveGame 43d5) — H (observed).

## 4. Open
- Vary the 4BFF picture option and a character with items (to confirm `.SWG` from a DOSBox save); a multi-member party (names array entries 2..8, list order).
- `+143`: 0Ah at creation (agrees with PARTY.pas.md), 00 in every saved-game member: which routine clears it (AddToParty / SaveGame path).
