# DECODE GATE — Curse of the Azure Bonds — **MET** (06:40 MDT 2026-10-20; 10 of 10, pending the owner declaration to the owner)

Gate rule (FOREMAN.md): no game-building until every item below is ticked with evidence. the owner declares the gate to the owner.

| # | item | evidence file(s) | state |
|---|---|---|---|
| 1 | Every code unit listed and owned (resident + every TPOV overlay unit, sizes, load segments) | decode/LAYOUT.md, decode/listings/INDEX.md, decode/CROSSREF.md §1 | **met**: 36 TPOV overlay units + resident units, every byte of GAME.OVR accounted for; CROSSREF §1 gives every unit one canonical file |
| 2 | Runtime + overlay manager understood (TP 5.0 System/Crt/Dos/Overlay, TPOV stubs/fixups) | decode/LAYOUT.md, decode/rt/RT_LEDGER.md | **met**: TPOV loader proven from OvrInit bytes; 182 runtime entries (99 named) by shape + body; TP 5.0 vs 5.5 left open (no effect on the decode) |
| 3 | Every routine the game uses named with evidence or marked unknown | decode/pseudo/*.pas.md, decode/names/*.json, CROSSREF §5 | **met**: all 7 areas final; remaining unknowns listed per file with owner (CROSSREF §5b) |
| 4 | ECL script VM fully specified (opcode set diffed against Pool, operands, memory, vectors) | decode/ecl/ECL_VM.md, ECL_DIFF.md, decode/tools/ecldis.py | **met**: 64 opcodes (00..40h, 1Fh absent) diffed against Pool, operands, memory map, vectors |
| 5 | All ECL scripts decoded (ECL1-6) | decode/ecl/scripts/*.ecl.txt + INDEX.md | **met**: 25 records, 14,163 instructions, 0 unhandled opcodes; every byte decoded or listed as db |
| 6 | Every data format specified (deltas vs Pool + BIGPIC, TILES, SKY, saves) | decode/data/*.md + INDEX.md, decode/data/SAVES.md, PNG renders | **met**: all DAX groups + BIGPIC/TILES/SKY; SAVES.md from DOSBox-made saves (SAVGAM 13,149 B by region, 422-B record with 28 fields confirmed, controlled diffs B->C speed, C->D platinum); open items listed in SAVES.md §4 |
| 7 | Screens inventoried | decode/pseudo/*_SCREENS.md, SCREENS_INDEX.md | **met**: 167 screens in game order, consistency section clean after #scr-1/2 |
| 8 | Verification passes (self-check, argcheck, independent verify, fable-confirm, DOSBox-X oracle) | *_VERIFY.md, acceptance/ref/DECODE_CHECKS.md | **met**: self-check, argcheck 0 MISMATCH and anchorcheck 0 bad in all 7 areas; cross-model independent verify of all 7 (532 sampled statements, 4 semantic errors; 50 fix requests applied); DOSBox-X oracle 31 claims 23 PASS / 8 DIFF -> all 8 applied (7fcd502), 2 of them code-reading errors fixed in the pseudocode. Not covered: a combat reference (no encounter on a short path) |
| 9 | Cross-area consistency (shared globals, names, call graph) | decode/CROSSREF.md | **met**: §1-6 (units, names, shared globals, call graph, unknowns, data<->code); 6 requests applied |
| 10 | Copy protection understood (bypass flag) | ENGINE.pas.md ov03, ECL_VM.md §8, decode/ecl/runewheel.py | **met**: rune-wheel check + answer formula; this copy patched (GAME.OVR 0x4A56 EB, CR-2); bypass point named |
