"""ecldis.py — Curse of the Azure Bonds ECL (event script) disassembler. Owner: cab-ecl.

Spec: decode/ecl/ECL_VM.md (every rule below cites the engine routine it comes from). Derived from Pool of
Radiance's decode/tools/ecldis.py (PoolRadianceRE); deltas: script base 8000h, opcodes 3E/3F/40, the ov07_1FF5 skip
table, Curse VM addresses in the notes, six ECL files, coverage report + INDEX.md.

Usage:
  ecldis.py FILE.bin                          disassemble one extracted ECL record (decode/bin/dax/ECLn/R.bin)
  ecldis.py --all [--bin DIR] [--out DIR]     all records of ECL1..6.DAX -> decode/ecl/scripts/ + INDEX.md,
                                              prints the opcode usage table
  ecldis.py --stats                           opcode usage table only (markdown)

Record -> VM memory (LoadEclBlock ov07_0380 2C00:0380): the first 2 bytes of the record are skipped, the rest is
copied to the 1E00h code buffer, which the VM addresses as 8000h + offset (ecl_Run 2200:3641: byte at
CodeBuf[PC-8000h]; ecl_InitVM 2C00:023B sets PC := 8000h).
"""
import os, sys, argparse, re
from collections import OrderedDict

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "decode", "tools"))
BASE = 0x8000          # ecl_Run 2200:3650 MOV AL,ES:[DI+8000h]; InitVM 2C00:023B MOV [4FB4],8000h
BUFSIZE = 0x1E00       # LoadEclBlock FillChar(CodeBuf^, 1E00h, 0)

# opcode -> (mnemonic, fixed operand count). Mnemonics = SSI's own names from the trace table ov34_0240
# (7300:0240; "SUBTRAT" sic -> SUBTRACT; 30h shares the AND entry -> OR), spaces as underscores.
# fixed count = the ReadOperands(n) call at the start of each handler (ov02, ECL_VM.md section 4).
OPS = {
    0x00: ("EXIT", 0), 0x01: ("GOTO", 1), 0x02: ("GOSUB", 1), 0x03: ("COMPARE", 2),
    0x04: ("ADD", 3), 0x05: ("SUBTRACT", 3), 0x06: ("DIVIDE", 3), 0x07: ("MULTIPLY", 3),
    0x08: ("RANDOM", 2), 0x09: ("SAVE", 2), 0x0A: ("LOAD_CHARACTER", 1), 0x0B: ("LOAD_MONSTER", 3),
    0x0C: ("SETUP_MONSTER", 3), 0x0D: ("APPROACH", 0), 0x0E: ("PICTURE", 1), 0x0F: ("INPUT_NUMBER", 2),
    0x10: ("INPUT_STRING", 2), 0x11: ("PRINT", 1), 0x12: ("PRINTCLEAR", 1), 0x13: ("RETURN", 0),
    0x14: ("COMPARE_AND", 4), 0x15: ("VERTICAL_MENU", 3), 0x16: ("IF_EQ", 0), 0x17: ("IF_NE", 0),
    0x18: ("IF_LT", 0), 0x19: ("IF_GT", 0), 0x1A: ("IF_LE", 0), 0x1B: ("IF_GE", 0),
    0x1C: ("CLEAR_MONSTERS", 0), 0x1D: ("PARTY_STRENGTH", 1), 0x1E: ("CHECK_PARTY", 6),
    0x20: ("NEW_ECL", 1), 0x21: ("LOAD_FILES", 3), 0x22: ("PARTY_SURPRISE", 2), 0x23: ("SURPRISE", 4),
    0x24: ("COMBAT", 0), 0x25: ("ON_GOTO", 2), 0x26: ("ON_GOSUB", 2), 0x27: ("TREASURE", 8),
    0x28: ("ROB", 3), 0x29: ("ENCOUNTER_MENU", 14), 0x2A: ("GET_TABLE", 3), 0x2B: ("HORIZONTAL_MENU", 2),
    0x2C: ("PARLAY", 6), 0x2D: ("CALL", 1), 0x2E: ("DAMAGE", 5), 0x2F: ("AND", 3), 0x30: ("OR", 3),
    0x31: ("SPRITE_OFF", 0), 0x32: ("FIND_ITEM", 1), 0x33: ("PRINT_RETURN", 0), 0x34: ("ECL_CLOCK", 2),
    0x35: ("SAVE_TABLE", 3), 0x36: ("ADD_NPC", 2), 0x37: ("LOAD_PIECES", 3), 0x38: ("PROGRAM", 1),
    0x39: ("WHO", 1), 0x3A: ("DELAY", 0), 0x3B: ("SPELL", 3), 0x3C: ("PROTECTION", 1), 0x3D: ("CLEAR_BOX", 0),
    0x3E: ("DUMP", 0), 0x3F: ("FIND_SPECIAL", 1), 0x40: ("DESTROY_ITEMS", 1),
}
VARCOUNT = {0x15: 3, 0x25: 2, 0x26: 2, 0x2B: 2}   # opcode -> index of the operand holding the extra count
# IF-skip operand counts (ecl_SkipInstruction ov07_1FF5 2C00:1FF5) where they differ from the handler's count:
# 15/25/26/2B: only the opcode byte is skipped; 1F: 2 (no handler); 34: 1 (handler reads 2); 36: 1 (handler 2).
SKIPCOUNT = {0x15: 0, 0x1F: 2, 0x25: 0, 0x26: 0, 0x2B: 0, 0x34: 1, 0x36: 1}
ENDS = {0x00, 0x01, 0x13, 0x20}   # no fall-through (EXIT, GOTO, RETURN, NEW_ECL)


def six_bit_char(v):
    """ecl_SixBitChar ov07_070D (shape-identical to Pool 4300:06D3): v < 20h -> v + 40h, else v."""
    return chr(v + 0x40) if v < 0x20 else chr(v)


def unpack_string(data):
    """ecl_UnpackString ov07_12AE (shape 0.97 vs Pool 4300:1153): 3 bytes -> 4 six-bit codes, MSB first; code 0 dropped."""
    out = []
    phase, cur, prev, i = 1, 0, 0, 0
    n = len(data)
    while i < n:
        if phase < 4:
            prev, cur = cur, data[i]
            i += 1
        if phase == 1:
            c = cur >> 2
        elif phase == 2:
            c = (((prev << 6) & 0xFF) + (cur >> 2) & 0xFF) >> 2
        elif phase == 3:
            c = (((prev << 4) & 0xFF) + (cur >> 4) & 0xFF) >> 2
        else:
            c = cur & 0x3F
        phase = phase + 1 if phase < 4 else 1
        if c:
            out.append(six_bit_char(c))
    if phase == 4 and (cur & 0x3F):
        out.append(six_bit_char(cur & 0x3F))
    return "".join(out)


# known VM addresses (ECL_VM.md section 3) -> comment text in listings
ADDR_NOTES = {
    # region 4 (engine globals, ov07_0F3A / ov07_0D70)
    0xC04B: "party X (DS:720F)", 0xC04C: "party Y (DS:7210)", 0xC04D: "facing/2 (DS:7211)", 0xC04E: "wall type ahead (DS:7212)",
    0xC04F: "cell attribute (DS:7213)", 0xC059: "DS:75E8 (3D colour)", 0xC05F: "DS:75E9 (3D colour)", 0x033D: "facing (DS:7211)",
    0x03DE: "sound/mode selector DS:8B4C", 0x00B1: "DS:75EE", 0x00FB: "DS:75EA", 0x00FC: "DS:75EC", 0x00B8: "DS:8B4E", 0x00B9: "DS:8B50",
    # region 0 (4B00..4EFF, word array DS:4F99)
    0x4BE6: "3D-area flag (write: view mode DS:4FBA)", 0x4BC5: "3D map id", 0x4BF2: "previous ECL block", 0x4BF0: "saved party X",
    0x4BF1: "saved party Y", 0x4BFD: "write sets redraw DS:8B6A", 0x4BFE: "write sets redraw DS:8B6A", 0x4CFD: "endgame flag (PROGRAM 8)",
    # region 1 (7C00..7FFF, word array DS:4F9D + selected-character overlay ov07_07F1/ov07_0B6D)
    0x7EC0: "encounter distance", 0x7EC1: "encounter distance (actual)", 0x7ECB: "SURPRISE result", 0x7EE1: "3D sprite id (FF = full picture)",
    0x7EE2: "COMBAT->temple flag", 0x7F6C: "COMBAT->shop flag", 0x7F22: "wall set slot 1 load", 0x7F24: "wall set slot 2 load",
    0x7F26: "wall set slot 3 load", 0x7F3E: "party member count", 0x7F3F: "DIVIDE remainder", 0x7ECA: "search/look state",
    0x7EC9: "cleared by LOAD_FILES", 0x7EA8: "endgame (PROGRAM 8)", 0x7ED5: "cleared by RunAfterNewBlock",
    0x7C00: "selected char name", 0x7C15: "char +13h", 0x7C18: "char +19h", 0x7C72: "char +74h", 0x7C73: "char +75h (class)",
    0x7C9B: "char +E0h", 0x7CA0: "char +E5h", 0x7CB8: "char NPC flags +F7h", 0x7CBB: "char copper", 0x7CBD: "char silver",
    0x7CBF: "char electrum", 0x7CC1: "char gold", 0x7CC3: "char platinum", 0x7CC9: "char hp (+10E,+116 x lvl)", 0x7CD6: "char +119h",
    0x7CD8: "char alignment +11Bh", 0x7CE4: "char +192h bit0", 0x7CF7: "char +13Ch", 0x7CF9: "char +13Eh", 0x7D00: "char active/status",
    0x7D0C: "char +197h/+198h", 0x7D1B: "char move +1A5h", 0x7EB1: "char party index", 0x7EB4: "char party index",
    0x7ECF: "char reaction bonus (CHA)", 0x7F12: "data set digit (ECLn)",
}
for _i in range(7):
    ADDR_NOTES[0x4BC6 + _i] = "game clock[%d]" % _i
for _i in range(8):
    ADDR_NOTES[0x7CA5 + _i] = "char thief skill[%d] +%Xh" % (_i, 0xEA + _i)
# CALL ids implemented by ov02_2F02 (ECL_VM.md section 4.5); everything else is a no-op
CALL_NOTES = {0x2E10: "cell attr + redraw", 0x8000: "SetupDuel(1) ov07_1BE0", 0x8001: "SetupDuel(0) ov07_1BE0",
              0xB200: "mode/sound call by DS:8B4C", 0xC01E: "step forward ov07_1B3F", 0xC018: "wall type ahead",
              0x6803: "next picture frame DS:722D + delay"}


class Operand:
    __slots__ = ("type", "lo", "hi", "text", "size")

    def __init__(self, t, lo, hi=None, text=None, size=2):
        self.type, self.lo, self.hi, self.text, self.size = t, lo, hi, text, size

    @property
    def word(self):
        return (self.hi or 0) * 256 + self.lo

    def fmt(self):
        t = self.type
        if t == 0x00:
            return "#%02X" % self.lo
        if t in (0x01, 0x03):
            return "[%04X]%s" % (self.word, ("" if t == 1 else "'"))
        if t == 0x02:
            return "#%04X" % self.word
        if t == 0x80:
            return '"%s"' % self.text
        if t == 0x81:
            return "$[%04X]" % self.word
        return "?t%02X:%02X" % (t, self.lo)


def read_operands(code, pc, n):
    """ecl_ReadOperands ov07_0034 (2C00:0034). pc = address of the opcode (or the byte before the first operand).
    Returns (operands, new_pc) where new_pc = address after the last operand."""
    ops = []
    for _ in range(n):
        t = code.get(pc + 1)
        lo = code.get(pc + 2)
        if t is None or lo is None:
            raise IndexError("operand past end at %04X" % pc)
        pc += 2
        if t in (1, 2, 3):
            pc += 1
            ops.append(Operand(t, lo, code[pc], size=3))
        elif t == 0x80:
            data = bytes(code[pc + 1 + k] for k in range(lo))
            pc += lo
            ops.append(Operand(t, lo, text=unpack_string(data), size=2 + lo))
        elif t == 0x81:
            pc += 1
            ops.append(Operand(t, lo, code[pc], size=3))
        else:
            ops.append(Operand(t, lo))
    return ops, pc + 1


class Code(dict):
    pass


def load(path):
    raw = open(path, "rb").read()
    code = Code()
    for i, b in enumerate(raw[2:]):
        code[BASE + i] = b
    code.hdr = raw[:2]
    code.end = BASE + len(raw) - 2
    return code


def decode_at(code, pc):
    op = code[pc]
    if op not in OPS:
        return op, None, [], pc + 1
    name, n = OPS[op]
    ops, npc = read_operands(code, pc, n)
    if op in VARCOUNT:
        k = VARCOUNT[op]
        cnt = ops[k - 1].lo if ops[k - 1].type in (0, 2) else None
        if cnt is None:
            return op, name, ops, npc   # count from memory: cannot follow statically
        more, npc = read_operands(code, npc - 1, cnt)
        ops += more
    return op, name, ops, npc


def header(code):
    vec = []
    pc = BASE
    for _ in range(5):
        ops, pc = read_operands(code, pc, 1)
        vec.append(ops[0].word)
    return vec


# operand index (1-based) that is the base address of an in-script data table
TABLE_OPERAND = {0x2A: 1, 0x35: 2}


def trace(code):
    """Recursive traversal from the five header vectors (ecl_InitVM 2C00:01FC), repeated until the set
    of data-table addresses (GET_TABLE/SAVE_TABLE bases) is stable; traversal stops there."""
    data = set()
    while True:
        vec, insns, labels = _trace(code, data)
        nd = set()
        for op, name, ops, npc in insns.values():
            k = TABLE_OPERAND.get(op)
            if k and len(ops) >= k and ops[k - 1].type in (1, 2, 3) and ops[k - 1].word >= BASE:
                nd.add(ops[k - 1].word)
        if nd <= data:
            code.data = data
            return vec, insns, labels
        data |= nd


def _trace(code, data):
    vec = header(code)
    insns, todo, labels = {}, list(vec), set(vec)
    while todo:
        pc = todo.pop()
        while BASE + 20 <= pc < code.end and pc not in insns and pc not in data:
            try:
                op, name, ops, npc = decode_at(code, pc)
            except (IndexError, KeyError):
                break
            insns[pc] = (op, name, ops, npc)
            if name is None:
                break
            if op in (0x01, 0x02):
                if ops[0].type in (1, 2, 3):
                    labels.add(ops[0].word); todo.append(ops[0].word)
            if op in (0x25, 0x26):
                for o in ops[2:]:
                    labels.add(o.word); todo.append(o.word)
            if 0x16 <= op <= 0x1B:
                # true: next insn; false: skip next insn (ecl_SkipInstruction) -> both successors
                try:
                    nop = code[npc]
                    if nop in OPS or nop == 0x1F:
                        cnt = SKIPCOUNT.get(nop, OPS[nop][1] if nop in OPS else 0)
                        _, skip_end = read_operands(code, npc, cnt)
                        todo.append(skip_end); labels.add(skip_end)
                except (IndexError, KeyError):
                    pass
            if op in ENDS:
                break
            pc = npc
    return vec, insns, labels


VECNAMES = ["vecA (before each player command)", "vecB (after move / location)", "vecC (camp check)",
            "vecD (after rest)", "vecE (block init)"]


def listing(path, title):
    code = load(path)
    vec, insns, labels = trace(code)
    out = ["; %s - generated by decode/tools/ecldis.py from %s; regenerate, do not edit" % (title, os.path.basename(path)),
           "; record header (skipped by LoadEclBlock): %s ; code %04X..%04X (%d bytes)" % (code.hdr.hex(" "), BASE, code.end - 1, code.end - BASE),
           ";"]
    for i, v in enumerate(vec):
        out.append("; %-36s = %04X" % (VECNAMES[i], v))
    out.append("")
    covered = set()
    for a, (op, name, ops, npc) in insns.items():
        covered.update(range(a, npc))
    covered.update(range(BASE, BASE + 20))
    for i in range(5):
        a = BASE + 4 * i
        out.append("%04X  %-24s GOTO %04X        ; header vector %d" % (a, " ".join("%02X" % code[a + k] for k in range(4)), vec[i], i + 1))
    pc = BASE + 20
    unreached = 0
    while pc < code.end:
        if pc in insns:
            op, name, ops, npc = insns[pc]
            if pc in labels:
                out.append("L%04X:" % pc)
            bs = " ".join("%02X" % code[k] for k in range(pc, min(npc, pc + 8))) + (" .." if npc - pc > 8 else "")
            if name is None:
                out.append("%04X  %-24s ??? opcode %02X (no handler in ecl_Dispatch)" % (pc, bs, op))
            else:
                notes = []
                if op == 0x2D:
                    notes.append(CALL_NOTES.get(ops[0].word, "no-op in CAB"))
                for o in ops:
                    if o.type in (1, 3, 0x81) or (op in (0x09, 0x35) and o is ops[-2 if op == 0x35 else -1]):
                        n = ADDR_NOTES.get(o.word)
                        if n and op != 0x2D:
                            notes.append("%04X=%s" % (o.word, n))
                text = "%04X  %-24s %-15s %s" % (pc, bs, name, ", ".join(o.fmt() for o in ops))
                out.append(text + ("   ; " + "; ".join(notes) if notes else ""))
            pc = npc
        else:
            a = pc
            if pc in code.data:
                out.append("T%04X:                          ; data table (GET_TABLE/SAVE_TABLE base)" % pc)
            while pc < code.end and pc not in covered:
                pc += 1
            if pc == a:
                pc += 1
                continue
            unreached += pc - a
            for k in range(a, pc, 16):
                chunk = [code[j] for j in range(k, min(pc, k + 16))]
                out.append("%04X  db %-47s ; %s" % (k, " ".join("%02X" % c for c in chunk),
                                                   "".join(chr(c) if 32 <= c < 127 else "." for c in chunk)))
    code.unreached = unreached
    code.covered = len(covered & set(range(BASE, code.end)))
    code.vec = vec
    return out, insns, code


def record_dirs(bindir):
    for n in range(1, 7):
        d = os.path.join(bindir, "ECL%d" % n)
        if not os.path.isdir(d):
            continue
        for f in sorted(os.listdir(d), key=lambda s: int(s.split(".")[0])):
            yield n, int(f.split(".")[0]), os.path.join(d, f)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("file", nargs="?")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--stats", action="store_true")
    ap.add_argument("--bin", default=os.path.join(ROOT, "decode", "bin", "dax"))
    ap.add_argument("--out", default=os.path.join(ROOT, "decode", "ecl", "scripts"))
    a = ap.parse_args()
    if a.file:
        print("\n".join(listing(a.file, os.path.basename(a.file))[0]))
        return
    usage, recs, rows = {}, 0, []
    optypes = {}          # (op, operand index) -> {type byte: count}
    calls, checkparty, journal = {}, [], []
    if a.all:
        os.makedirs(a.out, exist_ok=True)
    for n, rid, path in record_dirs(a.bin):
        out, insns, code = listing(path, "ECL%d record %d" % (n, rid))
        recs += 1
        strings = 0
        for pc, (op, name, ops, npc) in insns.items():
            usage.setdefault(op, [0, set()])
            usage[op][0] += 1
            usage[op][1].add("ECL%d/%d" % (n, rid))
            for i, o in enumerate(ops):
                optypes.setdefault((op, i + 1), {}).setdefault(o.type, 0)
                optypes[(op, i + 1)][o.type] += 1
                if o.type == 0x80:
                    strings += 1
                    if "JOURNAL" in o.text:
                        journal.append((n, rid, pc, name, o.text))
            if op == 0x2D:
                calls.setdefault(ops[0].word, [0, set()])
                calls[ops[0].word][0] += 1
                calls[ops[0].word][1].add("ECL%d/%d" % (n, rid))
            if op == 0x1E:
                checkparty.append((n, rid, pc, ", ".join(o.fmt() for o in ops)))
        total = code.end - BASE
        rows.append((n, rid, total, len(insns), code.covered, code.unreached, len(code.data), strings, code.vec, code.hdr.hex(" ")))
        if a.all:
            with open(os.path.join(a.out, "ECL%d_%02d.ecl.txt" % (n, rid)), "w", encoding="utf-8", newline="\n") as f:
                f.write("\n".join(out) + "\n")
    lines = ["| op | mnemonic | count | records |", "|---|---|---|---|"]
    for op in sorted(usage):
        name = OPS[op][0] if op in OPS else "??? (no handler)"
        lines.append("| %02X | %s | %d | %d |" % (op, name, usage[op][0], len(usage[op][1])))
    unused = [op for op in sorted(OPS) if op not in usage]
    lines.append("")
    lines.append("records=%d distinct opcodes=%d unused handlers: %s" % (recs, len(usage), " ".join("%02X" % o for o in unused) or "none"))
    print("\n".join(lines))
    if a.all:
        idx = ["# ECL scripts index (generated by decode/tools/ecldis.py --all; regenerate, do not edit)", "",
               "Per record: `ECL<n>_<rec>.ecl.txt` = disassembly from the 5 header vectors (recursive traversal; IF: both "
               "successors; ON_GOTO/ON_GOSUB tables; data tables named by GET_TABLE/SAVE_TABLE are not executed). "
               "Addresses are VM addresses (record byte 2 = 8000h). Spec: `decode/ecl/ECL_VM.md`.", "",
               "## Coverage (every record byte is either decoded as an instruction/header or listed as `db`)", "",
               "| file | rec | header | bytes | instructions | reached bytes | unreached (`db`) | coverage | data tables | strings | vecA | vecB | vecC | vecD | vecE |",
               "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|"]
        tb = tr = tu = ti = 0
        for n, rid, total, ni, cov, unr, nd, ns, vec, hdr in rows:
            idx.append("| ECL%d | %d | %s | %d | %d | %d | %d | %.1f%% | %d | %d | %s |" % (
                n, rid, hdr, total, ni, cov, unr, 100.0 * cov / total, nd, ns, " | ".join("%04X" % v for v in vec)))
            tb += total; tr += cov; tu += unr; ti += ni
        idx.append("| **all** | %d | | %d | %d | %d | %d | %.1f%% | | | | | | | |" % (recs, tb, ti, tr, tu, 100.0 * tr / tb))
        idx += ["", "## Opcode usage", ""] + lines
        idx += ["", "## Operand types seen per opcode operand (type byte: count)", "",
                "| op | mnemonic | operand | 00 byte | 01 mem | 02 word | 03 mem' | 80 text | 81 strvar |", "|---|---|---|---|---|---|---|---|---|"]
        for (op, i) in sorted(optypes):
            t = optypes[(op, i)]
            idx.append("| %02X | %s | %d | %s |" % (op, OPS[op][0], i, " | ".join(str(t.get(k, "")) for k in (0, 1, 2, 3, 0x80, 0x81))))
        idx += ["", "## CALL ids used by the scripts", "", "| id | engine action (ov02_2F02) | count | records |", "|---|---|---|---|"]
        for cid in sorted(calls):
            idx.append("| %04X | %s | %d | %s |" % (cid, CALL_NOTES.get(cid, "no-op"), calls[cid][0], ", ".join(sorted(calls[cid][1]))))
        idx += ["", "## CHECK_PARTY uses", ""] + ["- ECL%d/%d @ %04X: %s" % c for c in checkparty]
        idx += ["", "## PRINT texts containing JOURNAL (detail: decode/ecl/JOURNAL_REFS.md)", ""] + \
               ["- ECL%d/%d @ %04X %s \"%s\"" % j for j in journal]
        with open(os.path.join(a.out, "INDEX.md"), "w", encoding="utf-8", newline="\n") as f:
            f.write("\n".join(idx) + "\n")


if __name__ == "__main__":
    main()
