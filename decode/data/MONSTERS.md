# Monsters — MONnCHA / MONnITM / MONnSPC.DAX (n = 1..6) — deltas vs Pool

Owner: cab-data. Tool: `decode/tools/cabdata.py mon`.

**Containers: same as Pool `PoolRadianceRE/decode/data/MONSTERS.md` (same id selects CHA/SPC/ITM; ITM = n × 63-byte items, SPC = n × 9-byte effect records, link fields stale on disk). Record delta: the character record is 422 bytes, not 285.**

## Loader — `LoadMonster(var rec, id)` GAME.OVR **0x1ECD7** (`55 89 e5 81 ec 1a 01`; strings before it: `"MON"`, `"CHA"`, `".dax"`, `"Unable to load monster"`, `"SPC"`, `"ITM"`; `retf 6`) — H
```pascal
LoadDaxRecord('MON' + Str(DS:5BEE) + 'CHA.dax', id, p, size);  if size = 0 then Fatal('Unable to load monster');
Move(p^, rec, $1A6);                          { 0x1ED6E: 422 bytes (Pool $11D = 285) }
rec[+14Dh] := nil;                            { 0x1ED85: item list ptr      (Pool +C8h) }
rec[+F2h]  := nil;                            { 0x1ED94: effect list ptr    (Pool +7Fh) }
rec[+189h..+18Fh] := 0;                       { 0x1EDA3..0x1EDB7: 4 words   (Pool +104h..+10Ah) }
FreeMem(p);  DS:5CF0 := 1;                    { optional-record flag (Pool DS:557C) }
SPC: 9-byte entries, link at +5/+7 (0x1EE62/0x1EE66);  ITM: 63-byte items, link at +2Ah/+2Ch (0x1EF40/0x1EF44)
DS:5CF0 := 0;                                 { 0x1EF8A }
```
**Delta vs Pool's LoadMonster:** no `case rec[+2Eh]` / `Random(6)*11h − 80h` initialisation of `+C0h..+C6h` between the Move and the pointer clearing (Pool's equivalent block is absent at 0x1ED77..0x1EDC9) — H for absence in this routine; whether CAB does it elsewhere: open.

## Deltas
- **CHA record = 422 B (0x1A6)** in all 81 records — a different TChar layout (CAB character record). Known so far: `+00h` Pascal string name (upper case, ≤ 15 chars, as Pool); `+F2h` effect-list ptr, `+14Dh` item-list ptr, `+189h..+190h` two more far ptrs (all stale on disk). Full field map = the save-format work (SAVES.md, from a DOSBox-made save; open).
- **MONnSPC exists for all six sets** (Pool lacked set 1 and 3). SPC bytes match Pool's 9-byte effect layout: `type, dur lo, dur hi, p3=FFh, p4, next(4, stale)`, e.g. MON1SPC/53 `18 00 00 ff 00 | 00 00 77 1e` (H for layout, M for semantics).
- ITM records: 63-byte items with zero names (as Pool).

## Inventory
CHA sizes [422]; ITM multiples of 63: True; SPC multiples of 9: True; every ITM/SPC id has a CHA: True

| set | id | name (Pascal string @0) | ITM items | SPC entries (type bytes) |
|---|---|---|---|---|
| 1 | 1 | FIRE KNIFE | 5 | - |
| 1 | 8 | CROCODILE | - | - |
| 1 | 16 | RED PLUME | 5 | - |
| 1 | 17 | CULTIST | 3 | - |
| 1 | 32 | ZHENTIL FIGHTER | 5 | - |
| 1 | 53 | BLACK DRAGON | - | 2 (18 5a) |
| 1 | 60 | DRACOLICH | - | 9 (6e 77 7a 7b 87 85 80 7e 7d) |
| 1 | 80 | DISPLACER BEAST | - | - |
| 1 | 81 | HIPPOGRIFF | - | - |
| 1 | 82 | ETTIN | - | - |
| 1 | 83 | LIZARD MAN | 2 | - |
| 1 | 84 | CENTAUR | 2 | - |
| 1 | 85 | RUSTLE | 1 | - |
| 1 | 86 | BUGBEAR | 1 | - |
| 1 | 87 | WORG | - | - |
| 1 | 88 | CYNTHIA | 1 | - |
| 1 | 89 | FIGHTER | 5 | - |
| 1 | 90 | GRENDEL | 2 | - |
| 2 | 0 | ROYAL GUARD | 3 | - |
| 2 | 1 | FIRE KNIFE | 5 | - |
| 2 | 2 | THIEF | 2 | - |
| 2 | 3 | MAGE | 2 | - |
| 2 | 4 | BAR PATRON | 2 | - |
| 2 | 5 | FIGHTING DOG | - | - |
| 2 | 6 | MONKEY | 1 | - |
| 2 | 7 | TROLL | - | 2 (64 65) |
| 2 | 8 | CROCODILE | - | - |
| 2 | 9 | OTYUGH | - | - |
| 2 | 10 | NEO-OTYUGH | - | - |
| 2 | 11 | KNIGHT | 3 | - |
| 3 | 16 | RED PLUME | 5 | - |
| 3 | 17 | CULTIST | 3 | - |
| 3 | 18 | LOOTER | 2 | - |
| 3 | 19 | ZHENTRIM CLERIC | 3 | 2 (18 14) |
| 3 | 20 | ZHENTRIM FGHTR | 3 | - |
| 3 | 21 | ZHENTRIM MAGE | 3 | 3 (3f 18 29) |
| 3 | 22 | ALIAS | 5 | 3 (51 7d 8a) |
| 3 | 23 | DRAGONBAIT | 4 | 4 (51 7d 8a 2d) |
| 3 | 24 | MOGION | 5 | 1 (0a) |
| 3 | 25 | SHAMBLING MOUND | - | 5 (70 54 52 51 39) |
| 3 | 26 | BIT O' MOANDER | - | 5 (70 54 52 51 39) |
| 3 | 27 | SM VEGEPYGMY | - | 4 (87 55 6d 6c) |
| 3 | 28 | LG VEGEPYGMY | - | 4 (87 55 6d 6c) |
| 3 | 30 | GIANT SLUG | - | 1 (56) |
| 4 | 9 | OTYUGH | - | - |
| 4 | 32 | ZHENTIL FIGHTER | 5 | - |
| 4 | 33 | ZHENTIL MAGE | 3 | - |
| 4 | 34 | ZHENTIL CLERIC | 4 | - |
| 4 | 35 | OGRE | - | - |
| 4 | 37 | GRIFFON | - | - |
| 4 | 38 | MANTICORE | 1 | - |
| 4 | 39 | HOODED MEDUSA | - | 3 (40 7f 53) |
| 4 | 40 | BEHOLDER | - | 2 (81 57) |
| 4 | 41 | MINOTAUR | 4 | - |
| 4 | 43 | DARK ELF LORD | 3 | 4 (18 27 69 6b) |
| 4 | 67 | RAKSHASA | - | 4 (18 82 81 3c) |
| 4 | 72 | HIGH PRIEST | 3 | 2 (09 0a) |
| 5 | 48 | DARK ELF LORD | 3 | 4 (18 27 69 6b) |
| 5 | 49 | DK ELF FIGHTER | 5 | 2 (69 6b) |
| 5 | 50 | DARK ELF MAGE | 2 | 2 (69 6b) |
| 5 | 51 | DARK ELF CLERIC | 3 | 2 (69 6b) |
| 5 | 52 | EFREETI | - | 1 (71) |
| 5 | 53 | BLACK DRAGON | - | 2 (18 5a) |
| 5 | 54 | WYVERN | - | 1 (40) |
| 5 | 55 | OWL BEAR | - | 1 (60) |
| 5 | 56 | ANHKHEG | - | 2 (50 79) |
| 5 | 57 | SALAMANDER | - | 5 (67 77 70 6d 6c) |
| 5 | 58 | DRACANDROS | 3 | 4 (29 8a 18 3f) |
| 5 | 59 | AKABAR BEL AKAS | 2 | - |
| 5 | 60 | DRACOLICH | - | 9 (6e 77 7a 7b 87 85 80 7e 7d) |
| 6 | 64 | THRI-KREEN | - | 2 (68 43) |
| 6 | 65 | PHASE SPIDER | - | 2 (46 25) |
| 6 | 66 | GIANT SPIDER | - | 1 (40) |
| 6 | 67 | RAKSHASA | - | 4 (18 82 81 3c) |
| 6 | 68 | HELL HOUND | - | 2 (18 83) |
| 6 | 69 | MARGOYLE | - | 1 (77) |
| 6 | 70 | PRIEST OF BANE | 3 | - |
| 6 | 71 | TYRANTHRAXUS | - | 6 (18 70 4f 6a 84 87) |
| 6 | 72 | HIGH PRIEST | 3 | 2 (09 0a) |
| 6 | 73 | RAKSHASA | 2 | 4 (18 82 81 3c) |
| 6 | 89 | FIGHTER | 5 | - |
