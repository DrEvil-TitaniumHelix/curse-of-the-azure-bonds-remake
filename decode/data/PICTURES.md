# Picture records — Curse of the Azure Bonds v1.0 (deltas vs Pool)

Owner: cab-data. Tools: `decode/tools/dax.py` (container), `decode/tools/daxpic.py` (Pool's renderer, copied unchanged). Renders: `decode/data/png/<GROUP>/<FILE>_<id>.png` (local only, `png/.gitignore`), per-record index with header values: [png/INDEX.md](png/INDEX.md) (committed).

**Spec: same as Pool `PoolRadianceRE/decode/data/PICTURES.md` §1 (P-record), §2 (A-record, PIC frames 2..n XOR frame 1), §3 (F-record font).** No format delta: every picture record of every CAB picture group satisfies Pool's size rule (`17 + count*h*w8*4 == raw_size` for P; frame chain ends exactly at raw_size for A); `daxpic.py classify` leaves no picture record unclassified (the only "?" records are the non-picture groups ECL, GEO, ITEM, MON*, WALLDEF). Confidence H for layout.

Evidence beyond the size rule: renders are clean images (TITLE/1 = the SSI/TSR title, multi-frame PIC records animate correctly only with the XOR decode — e.g. PIC2/9 (8 frames), PIC3/27 (5 frames), checked visually).

GAME.OVR offsets below are **file offsets in GAME.OVR** (TPOV; segment:offset names come from cab-tooling's LAYOUT.md). Resident `0297:011B` = the routine every picture loader calls with `(name, id, flag, maskColour, var pic)` pushed in that order (Pascal left-to-right) — the role of Pool's LoadPicture 0464:0111 (M: identified by its callers, body not yet read here). `0297:1110` = draw picture `(pic, a, b)` (M).

## Deltas per group

| group | files | records / layout | delta vs Pool |
|---|---|---|---|
| TITLE | TITLE.DAX | **4** records: 1, 2 = P 320×200; 3 = P 240×112; 4 = P 320×112 | Pool: 2 records. Title sequence routine at OVR **0x6A8** (string `"title"` at 0x6A2): load 1 → draw (0,0) → wait 5 → if byte `DS:4F98` ≠ 0: load 2 → draw (0,0) → free; load 3 → draw with args (6, 0Bh) → free → wait 10; load 4 → draw with args (0, 0Bh) (OVR 0x7A9..0x7B6) → wait 10 (H for the sequence of ids; meaning of `DS:4F98` unknown). Content (H, renders): 1 = "SSI presents an Official AD&D computer product", 2 = full-screen blue-toned portrait art, 3 = "Curse of the Azure Bonds" logo, 4 = "A Forgotten Realms Fantasy Role-Playing Epic Vol. II" banner. Args are pushed (first, second) = (6, 0Bh) for 3 and (0, 0Bh) for 4; 4 (320 wide) fits only with first = column 0, so first = column, second = row in 8-px cells: 3 at (48, 88), 4 at (0, 88), both ending at row 200 — M |
| PIC | PIC1..6 | 56 records, A 88×88, 1–8 frames | none. Every file has id 1 and id 29 (common event pictures per data set, M) |
| SPRIT | SPRIT1..6 | 46 records, A 3 frames (3 distances) | none. **SPRIT1.DAX is byte-identical to Pool's SPRIT1.DAX** |
| HEAD / BODY | HEAD2..6, BODY2..6 (no set 1) | 40 heads P 88×40, 31 bodies P 88×48 | none in format; Pool had sets 1..8 |
| CHEAD / CBODY | CHEAD, CBODY | 56 / 128 records | **byte-identical files to Pool** |
| COMSPR | COMSPR | 26 × P 24×24 | **byte-identical file to Pool**. Loaded at startup (OVR 0xFA9F loop, string `"COMSPR"` at 0xF540) |
| CPIC | CPIC1..6 | 156 records: P 24×24 (100), 24×48 (20), 48×24 (24), 48×48 (12) | none. Ids come in pairs `id` / `id+128` (e.g. CPIC1 1..90 and 129..218) — two poses per monster icon (M, from renders) |
| DUNGCOM / WILDCOM / RANDCOM | 1 file each | P 24×24 × 25 / × 34 / × 6 | none (same tile counts as Pool; content differs). Strings `DungCom`/`WildCom`/`RandCom` at OVR 0xE6CA/0xE6D2/0xE6DA |
| 8X8D | 8X8D1..6 | 70-tile wall sets (ids = WALLDEF ids, multi-block id*10+k), 8X8D1: 201 font, 202, 203 | 201 font: **byte-identical to Pool's 8X8D1/201**. **202 has 40 tiles (Pool: 31)** → symbol block 4 would cover 256..295 instead of 256..286 if the Put8x8Symbol base table is unchanged (to verify in code: string "Bad symbol number in Put8x8Symbol." at OVR 0x425C4). 203 = 45 tiles as in Pool. See [WALLDEF.md](WALLDEF.md) |
| BIGPIC | BIGPIC1/2/6 | **new**, see [BIGPIC.md](BIGPIC.md) | P 304×120 full-width pictures |
| TILES | TILES | **new**, see [TILES.md](TILES.md) | P 24×24 × 26 / × 22, copy-protection runes |
| SKY | SKY | **new**, see [SKY.md](SKY.md) | P 88×16, 24×24, 88×48 with colour-13 key |

Groups of Pool that do **not exist** in CAB: ICON, BACPAC, SQRPACI (overland tiles), FINAL. (CAB's overland map picture is BIGPIC1/121, see BIGPIC.md.)

## Open questions
- Body of `0297:011B` / `0297:1110` not yet read here (cab-tooling listings): confirm argument meaning (mask colour, flag, x/y) for each caller.
- `DS:4F98` (TITLE/2 shown only when set) and `DS:4FE6` (SKY loaded only when set): what they hold (video mode / config?) — unknown.
- 8X8D1/202 at 40 tiles: symbol range of block 4 (see above).
