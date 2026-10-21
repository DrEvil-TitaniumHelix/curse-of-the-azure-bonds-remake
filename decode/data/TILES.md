# TILES — copy-protection rune tiles (TILES.DAX) — new in CAB

Owner: cab-data. Format: **Pool P-record** (PICTURES.md §1), tile sets. Renders: `png/TILES/` (local).

## Records — H (bytes)

| id | raw | layout | cga_map | content (render) |
|---|---|---|---|---|
| 1 | 7505 | P 24×24 × **26** | 00 12 00 03 20 11 22 33 | 26 flowing, cursive runes on green tiles |
| 2 | 6353 | P 24×24 × **22** | 00 12 00 03 20 11 22 33 | 22 angular runes on green tiles |

Size check: 17 + 26×24×3×4 = 7505; 17 + 22×24×3×4 = 6353.

## Use — copy protection, GAME.OVR unit with code base 0x4688 — H for the strings and record ids, M for the rune-set names
String table (length-prefixed, offset = base + n): `"tiles"` (0x4694), `"Align the espruar and dethek runes"`, `"shown below, on translation wheel"`, `"like this:"`, `"-..-..-.."`, `"- - - - -"`, `"........."`, `"Type the character in box number "`, `"under the "`, `"path."`, `"type character and press return: "`, `"Sorry, that's incorrect."`, `"An unseen force hurls you into the abyss!"`.
Code at 0x47AE..0x47DE: `"tiles"` record **1** loaded with byte arguments (1, 0, 1Ah) and record **2** with (2, 1Ah, 16h) through `0196:002A` — read as (id, first slot, count): slots 0..25 and 26..47 of one 48-tile table (M; 1Ah = 26, 16h = 22 = the tile counts, H); 0x484C/0x4858: `Random(1Ah)` and `Random(16h)` (`0A54:1105`) pick one tile of each set. So the check shows one rune of each set and asks for a character read off the paper translation wheel.
Naming: record 1 = **Espruar** (the elven script, cursive) and record 2 = **Dethek** (the dwarven runes, angular) — from the order in the prompt string and the look of the glyphs (M). The answer table is on the paper wheel, not in the data (the oracle run needs the decode of the check routine: cab-tooling/ECL lanes; bypass by default per FOREMAN.md).
