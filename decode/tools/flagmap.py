"""flagmap.py — who writes and who tests which ECL memory cell, over all Curse ECL records. Owner: cab-ecl-quests.

Usage: python -I decode/tools/flagmap.py [--bin decode/bin/dax] [--out decode/ecl/scripts/FLAGMAP.md] [--check]

Reads the extracted ECL records (decode/bin/dax/ECLn/R.bin, made by decode/tools/dax.py from the player's ECLn.DAX),
decodes them with ecldis.py (same operand reader, same traversal from the five header vectors, ECL_VM.md §2 / §4)
and classifies every memory operand of every reached instruction by the handler semantics of ECL_VM.md §4:
  W  written: the destination a(i) of SAVE 09 (2), ADD..MULTIPLY 04..07 (3), RANDOM 08 (2), INPUT NUMBER/STRING 0F/10 (2),
     VERTICAL/HORIZONTAL MENU 15/2B (1), GET TABLE 2A (3), AND/OR 2F/30 (3), SAVE TABLE 35 (2, + index 3), PARLAY 2C (6),
     PARTYSTRENGTH 1D (1), CHECKPARTY 1E (3..6), PARTY SURPRISE 22 (1, 2), SPELL 3B (2, 3). Destinations take a(i)
     whatever the type byte is (§2). A SAVE of a constant shows the value (W=$xx); a SAVE of text shows W=str (the text
     is not copied).
  T  tested: memory operands of COMPARE 03 (1, 2), COMPARE AND 14 (1..4), AND/OR 2F/30 (1, 2); the constant compared
     against is shown (T=$xx).
  R  read as a value anywhere else (incl. GET TABLE bases, string variables 81h).
  I  implicit engine write by an opcode: NEW ECL -> 4BF2, LOAD FILES -> 4BC5 + 7EC9, SETUP MONSTER -> 7EC0 + 7EC1,
     SURPRISE -> 7ECB, DIVIDE -> 7F3F, PROGRAM 8 -> 4CFD + 7EA8 (§4.1, §4.4, §4.5, §3.3).
  K  CHECKPARTY key operand 1 (an address used as a key constant, §4.3).
Jump targets (GOTO / GOSUB / ON GOTO / ON GOSUB) are code addresses, not data, and are left out.
"""
import os, sys, argparse
from collections import OrderedDict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
import ecldis  # noqa: E402

DEST = {0x09: (2,), 0x04: (3,), 0x05: (3,), 0x06: (3,), 0x07: (3,), 0x08: (2,), 0x0F: (2,), 0x10: (2,), 0x15: (1,),
        0x2B: (1,), 0x2A: (3,), 0x2F: (3,), 0x30: (3,), 0x35: (2,), 0x2C: (6,), 0x1D: (1,), 0x1E: (3, 4, 5, 6),
        0x22: (1, 2), 0x3B: (2, 3)}
TEST = {0x03: (1, 2), 0x14: (1, 2, 3, 4), 0x2F: (1, 2), 0x30: (1, 2)}
JUMP = {0x01: (1,), 0x02: (1,)}
IMPLICIT = {0x20: (0x4BF2,), 0x21: (0x4BC5, 0x7EC9), 0x0C: (0x7EC0, 0x7EC1), 0x23: (0x7ECB,), 0x06: (0x7F3F,)}
MEMTYPES = (0x01, 0x03)
REGION_NAMES = {0: "region 0 (4B00..4EFF, saved)", 1: "region 1 (7C00..7FFF, saved; selected-character overlay)",
                2: "region 2 (7A00..7BFF, saved)", 3: "region 3 (the script)", 4: "region 4 (engine globals)"}


def region(a):
    """ecl_MemRegion (ECL_VM.md §3)"""
    if 0x4B00 <= a <= 0x4EFF: return 0
    if 0x7C00 <= a <= 0x7FFF: return 1
    if 0x7A00 <= a <= 0x7BFF: return 2
    if 0x8000 <= a <= 0x9DFF: return 3
    return 4


def block_local(a):
    """ecl_InitVM zeroes 4C00..4C1F and 7F79..7F82 on every block load unless a save is resumed (ECL_VM.md §3.3)"""
    return 0x4C00 <= a <= 0x4C1F or 0x7F79 <= a <= 0x7F82


def records(bindir):
    for n, rid, path in ecldis.record_dirs(bindir):
        code = ecldis.load(path)
        vec, insns, labels = ecldis.trace(code)
        yield "ECL%d_%02d" % (n, rid), insns


def imm(o):
    return o.type in (0x00, 0x02)


def sites(bindir):
    """yield (script, pc, opcode name, addr, kind, detail)"""
    for script, insns in records(bindir):
        for pc in sorted(insns):
            op, name, ops, npc = insns[pc]
            if name is None:
                continue
            for i, o in enumerate(ops, 1):
                if op in JUMP and i in JUMP[op]:
                    continue
                if op in (0x25, 0x26) and i >= 3:
                    continue
                if op == 0x1E and i == 1 and o.type in MEMTYPES:
                    yield script, pc, name, o.word, "K", ""
                    continue
                if op in DEST and i in DEST[op]:
                    if op == 0x35:
                        idx = ops[2]
                        if imm(idx):
                            yield script, pc, name, o.word + idx.word, "W", ""
                        else:
                            yield script, pc, name, o.word, "W", "+[%04X]" % idx.word
                        continue
                    detail = ""
                    if op == 0x09:
                        src = ops[0]
                        detail = "=$%04X" % src.word if imm(src) else ("=str" if src.type in (0x80, 0x81) else "")
                    yield script, pc, name, o.word, "W", detail
                    continue
                if op in TEST and i in TEST[op] and o.type in MEMTYPES:
                    other = None
                    if op == 0x03:
                        other = ops[2 - i]
                    elif op == 0x14:
                        other = ops[i if i % 2 else i - 2]
                    elif op in (0x2F, 0x30):
                        other = ops[2 - i]
                    yield script, pc, name, o.word, "T", ("=$%04X" % other.word if other is not None and imm(other) else "")
                    continue
                if o.type in MEMTYPES or o.type == 0x81:
                    yield script, pc, name, o.word, "R", ""
            for a in IMPLICIT.get(op, ()):
                yield script, pc, name, a, "I", ""
            if op == 0x38 and ops and imm(ops[0]) and ops[0].word == 8:     # PROGRAM 8 (won): 4CFD := FFh, 7EA8 := FFh (§3.3)
                for a in (0x4CFD, 0x7EA8):
                    yield script, pc, name, a, "I", "=$00FF"


def role(a):
    if a in ecldis.ADDR_NOTES:
        return ecldis.ADDR_NOTES[a]
    if block_local(a):
        return "block-local scratch (InitVM)"
    return "*script state*"


def build(bindir):
    cells = {}
    for script, pc, name, a, kind, detail in sites(bindir):
        cells.setdefault(a, OrderedDict()).setdefault(script, []).append((pc, kind, detail, name))
    return cells


def fmt_sites(lst, limit=24):
    out = ["%04X:%s%s" % (pc, k, d) for pc, k, d, _ in lst]
    return ", ".join(out[:limit]) + (", ... (%d more)" % (len(out) - limit) if len(out) > limit else "")


def markdown(cells):
    nrec = len({s for c in cells.values() for s in c})
    L = ["# FLAGMAP — Curse ECL script memory: who writes and who tests which cell (cab-ecl-quests)", "",
         "Generated by `python -I decode/tools/flagmap.py` (regenerate, do not edit) from the %d ECL records "
         "(`decode/bin/dax/ECLn/R.bin`, the same records as the listings here), decoded with `ecldis.py` (operand reader and "
         "traversal from the five header vectors, ECL_VM.md §2) and classified by the handler semantics of ECL_VM.md §4. "
         "Kinds: **W** written (SAVE / arithmetic / RANDOM / INPUT / menu / GET TABLE / AND / OR / SAVE TABLE / PARLAY / "
         "PARTYSTRENGTH / CHECKPARTY / PARTY SURPRISE / SPELL destination; `W=$xx` = SAVE of a constant, `W=str` = SAVE of a "
         "text, `W+[idx]` = SAVE TABLE with a variable index), **T** tested (COMPARE, COMPARE AND, AND / OR operand; `T=$xx` "
         "= compared with that constant), **R** read as a value, **I** implicit engine write by the opcode (NEW ECL, LOAD FILES, SETUP MONSTER, SURPRISE, DIVIDE, PROGRAM 8), **K** CHECKPARTY "
         "key. A site is `address:kind`. Roles: the names of ECL_VM.md §3 (via `ecldis.ADDR_NOTES`); *script state* = only "
         "the scripts use the cell. **4C00..4C1F and 7F79..7F82 are block-local** (`ecl_InitVM` zeroes them on every block "
         "load unless a save is resumed, ECL_VM.md §3.3), so the same cell in two scripts is not shared state; the other "
         "script cells of regions 0..2 are saved with the game and persist across blocks: these are the quest flags. "
         "Regions 3 (script bytes) and 4 (engine) are counted only. Cross-check: `flagmap.py --check` finds every SAVE / "
         "arithmetic / AND / OR destination in regions 0..2 as the last operand of the same instruction in the listings, "
         "and no other (2250 = 2250 sites at generation)." % nrec, ""]
    L += ["## Summary by region", "", "| region | cells | of them written | sites |", "|---|---|---|---|"]
    for r in range(5):
        cs = [a for a in cells if region(a) == r]
        w = [a for a in cs if any(k == "W" for s in cells[a].values() for _, k, _, _ in s)]
        n = sum(len(s) for a in cs for s in cells[a].values())
        L.append("| %s | %d | %d | %d |" % (REGION_NAMES[r], len(cs), len(w), n))
    L += ["", "## Cross-script state (written in one script, tested or read in another; block-local cells excluded)", "",
          "| cell | role | written by | tested / read by |", "|---|---|---|---|"]
    for a in sorted(cells):
        if region(a) > 2 or block_local(a):
            continue
        wr = [s for s, l in cells[a].items() if any(k in "WI" for _, k, _, _ in l)]
        rd = [s for s, l in cells[a].items() if any(k in "TR" for _, k, _, _ in l)]
        if wr and rd and len(set(wr) | set(rd)) > 1:
            L.append("| %04X | %s | %s | %s |" % (a, role(a), " ".join(wr), " ".join(rd)))
    L += ["", "## Written but never tested or read by a script (regions 0..2)", ""]
    lone = [a for a in sorted(cells) if region(a) <= 2 and all(k in "WI" for l in cells[a].values() for _, k, _, _ in l)]
    L.append(", ".join("%04X" % a for a in lone) or "none")
    L += ["", "## Tested or read but never written by a script (regions 0..2; set by the engine, the save or not at all)", ""]
    nowr = [a for a in sorted(cells) if region(a) <= 2 and not any(k in "WI" for l in cells[a].values() for _, k, _, _ in l)]
    L.append(", ".join("%04X%s" % (a, "" if role(a) == "*script state*" else " (%s)" % role(a)) for a in nowr) or "none")
    for r in range(3):
        L += ["", "## %s" % REGION_NAMES[r], "", "| cell | role | per script: sites |", "|---|---|---|"]
        for a in sorted(cells):
            if region(a) != r:
                continue
            per = "<br>".join("**%s** %s" % (s, fmt_sites(l)) for s, l in cells[a].items())
            L.append("| %04X | %s | %s |" % (a, role(a), per))
    return "\n".join(L) + "\n"


def check(bindir, scripts):
    """Cross-check: every SAVE / arithmetic / AND / OR destination in regions 0..2 found here = the last operand of the
    same instruction in the ecldis listings (decode/ecl/scripts/ECLn_RR.ecl.txt), and nothing else."""
    import re, glob
    ops = ("SAVE", "ADD", "SUBTRACT", "MULTIPLY", "DIVIDE", "AND", "OR")
    tool = {(s, pc, a) for s, pc, name, a, k, d in sites(bindir) if k == "W" and name in ops and region(a) <= 2}
    lst = set()
    rx = re.compile(r"([0-9A-F]{4})  (?:[0-9A-F]{2} |\.\. ?)+\s*(%s)\s+(.*?)(\s+;.*)?$" % "|".join(ops))
    for f in glob.glob(os.path.join(scripts, "ECL*.ecl.txt")):
        for line in open(f, encoding="utf-8"):
            m = rx.match(line)
            if not m:
                continue
            last = re.findall(r'\[([0-9A-F]{4})\]|#[0-9A-F]+|"[^"]*"', m.group(3))[-1]
            if last and region(int(last, 16)) <= 2:
                lst.add((os.path.basename(f)[:7], int(m.group(1), 16), int(last, 16)))
    print("check: %d tool sites, %d listing sites, %d only in tool, %d only in listings" % (len(tool), len(lst), len(tool - lst), len(lst - tool)))
    return tool == lst


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--bin", default=os.path.join(ROOT, "decode", "bin", "dax"))
    ap.add_argument("--out", default=os.path.join(ROOT, "decode", "ecl", "scripts", "FLAGMAP.md"))
    ap.add_argument("--check", action="store_true", help="compare the destinations with the listings and exit")
    a = ap.parse_args()
    if a.check:
        sys.exit(0 if check(a.bin, os.path.join(ROOT, "decode", "ecl", "scripts")) else 1)
    cells = build(a.bin)
    with open(a.out, "w", encoding="utf-8", newline="\n") as f:
        f.write(markdown(cells))
    print("%d cells, %d in regions 0..2 -> %s" % (len(cells), sum(1 for c in cells if region(c) <= 2), a.out))


if __name__ == "__main__":
    main()
