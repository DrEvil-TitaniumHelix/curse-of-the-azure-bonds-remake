# ITEM1..6.DAX — fixed treasure item lists — deltas vs Pool

Owner: cab-data. Tool: `decode/tools/cabdata.py item`.

**Spec: same as Pool `PoolRadianceRE/decode/data/ITEM.md` (record = n × 63-byte item records; item layout = Pool SAVES.md §4).** Confidence H for the container, M for the item fields until the CAB item code is read (ITEMS.md shows the type table changed).

## Loader — treasure routine GAME.OVR **0x23F9** (`55 89 e5`; strings before it: `"ITEM"`, `".dax"`, `"Unable to find item file"`) — H for the steps
Same shape as Pool FUN_2f00_19b0: `cmp byte [bp-2], 80h` (0x2446) → below 80h: `LoadDaxRecord('ITEM' + Str(DS:5BEE) + '.dax', k)`, error string if size 0 (0x24A6); copies **63-byte** items (`mov ax,3Fh` + Move 0x24E0; `add [bp-67h],3Fh` 0x24F1), GetMem(3Fh) per item, link at `+2Ah/+2Ch` (0x2559/0x255D); `cmp [bp-2],0FFh` (0x257C) / `sub ax,80h` (0x258A) → k − 80h random items otherwise. Loop bound on the ECL operands: `cmp byte [bp-1], 6` (0x2435) where Pool took 7 values + the record id (L: operand count to be confirmed by cab-ecl).

## Deltas
- **Files/records:** ITEM1..6, 23 records, all multiples of 63 (H).
- **Name field (+00h, string[40]) is filled in the DAX records** (Pool: all zeros). Values are Pascal strings such as "Banded Mail", "1 Oil", "Clerical Scroll With 3 Spells", but also nonsense combinations ("Small Raft Sling", "Dart of Bowl", "Wand of Beaker") — i.e. names left over from the authoring tool, not trustworthy (L). If CAB's loader rebuilds the name like Pool's FUN_00BA_0442 the stored string is irrelevant; not yet checked (open).
- **Shared records:** ITEM1/5, ITEM2/5, ITEM4/5 are 58-item lists starting "Small Raft Sling, Shield, Plate Mail" (same id 5 in three sets, M: a common shop/stock list); ITEM2/1, ITEM4/1, ITEM5/1 = "1 Oil, Silver Mirror".

## Records (types = byte +2Eh of each item; names = stored +00h strings, first 3)
| file | id | items | rem | types (+2Eh) | stored names (+0, first 3) |
|---|---|---|---|---|---|
| ITEM1 | 5 | 58 | 0 | 65 3b 3a 39 38 37 36 35 34 33 32 49 2e 2f 2c 2b 2a 29 28 27 26 25 24 23 22 21 20 1f 1e 1d 1c 1b 1a 19 18 17 16 15 14 13 12 11 10 0f 0e 0d 0c 0b 0a 09 08 07 06 05 04 03 02 01 | Small Raft Sling; Shield; Plate Mail |
| ITEM2 | 1 | 2 | 0 | 56 47 | 1 Oil; Silver Mirror |
| ITEM2 | 2 | 10 | 0 | 39 24 47 3d 3d 46 46 47 47 54 | Banded Mail; Long Sword; Potion |
| ITEM2 | 3 | 7 | 0 | 0c 17 4d 24 24 5f 46 | Flail; Mace; Bracers |
| ITEM2 | 4 | 5 | 0 | 65 0c 46 41 4d | Small Raft Sling; Flail; Instrument Medallion Net |
| ITEM2 | 5 | 58 | 0 | 65 3b 3a 39 38 37 36 35 34 33 32 49 2e 2f 2c 2b 2a 29 28 27 26 25 24 23 22 21 20 1f 1e 1d 1c 1b 1a 19 18 17 16 15 14 13 12 11 10 0f 0e 0d 0c 0b 0a 09 08 07 06 05 04 03 02 01 | Small Raft Sling; Shield; Plate Mail |
| ITEM3 | 16 | 2 | 0 | 3e 3f | Clerical Scroll With 3 Spells; Deck |
| ITEM3 | 17 | 2 | 0 | 4f 4e | Wand of Beaker; Wand |
| ITEM4 | 1 | 2 | 0 | 56 47 | 1 Oil; Silver Mirror |
| ITEM4 | 5 | 58 | 0 | 65 3b 3a 39 38 37 36 35 34 33 32 49 2e 2f 2c 2b 2a 29 28 27 26 25 24 23 22 21 20 1f 1e 1d 1c 1b 1a 19 18 17 16 15 14 13 12 11 10 0f 0e 0d 0c 0b 0a 09 08 07 06 05 04 03 02 01 | Small Raft Sling; Shield; Plate Mail |
| ITEM4 | 32 | 12 | 0 | 49 64 3d 3d 3d 3d 3d 4f 47 47 47 15 | 10 Arrow +1; Dart of Bowl; Magic User Scroll With 3 Spells |
| ITEM4 | 35 | 3 | 0 | 49 4e 24 | 20 Arrow; Wand; Long Sword |
| ITEM5 | 1 | 2 | 0 | 56 47 | 1 Oil; Silver Mirror |
| ITEM5 | 48 | 3 | 0 | 3d 3f 3c | Magic User Scroll; Gauntlets; Scroll |
| ITEM5 | 49 | 8 | 0 | 3d 3d 3d 42 46 63 4f 4f | Magic User Scroll; Magic User Scroll; Magic User Scroll |
| ITEM5 | 50 | 4 | 0 | 17 46 24 3c | Mace; Instrument Libram; Long Sword |
| ITEM6 | 64 | 8 | 0 | 24 24 42 42 40 3f 4d 3a | Long Sword; Long Sword; Robe |
| ITEM6 | 65 | 6 | 0 | 65 5d 3c 45 2e 1c | Small Raft Sling; Ring; Scroll |
| ITEM6 | 67 | 3 | 0 | 3f 41 24 | Gauntlets; Girdle; Long Sword |
