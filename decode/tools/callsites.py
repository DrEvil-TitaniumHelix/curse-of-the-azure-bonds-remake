"""List the calls of one routine with their arguments in Pascal order, read from the PUSH sequences (cab-rt drafting aid).

Usage: python -I callsites.py UNIT FUNCNAME [--stmts | --starts]   (e.g. ov01 ov01_01DF)
--starts: the anchor of each call is the start of its statement (after the previous store / jump / call), as --stmts.
Per call: anchor (first instruction after the previous call), callee (listing comment), arguments in push order:
constants (`MOV AL/AX,imm` + PUSH), DS words/bytes (`[0xNNNN]`), BP slots, `@StrCopy` string literals ([ps] cs:"..."),
`addr DS:NNNN` for MOV DI,imm + PUSH DS. Anything else prints as `?`. A draft: every line is checked against the asm.
"""
import os, re, sys
R = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
LINE = re.compile(r"^  ([0-9a-f]{4}:[0-9a-f]{4})  [0-9a-f]+\s+(\S+)\s*([^;]*?)\s*(?:;\s*(.*))?$")


def stmts(ins):
    """--stmts: one line per statement end (memory store, call, jump target or branch); start = first instruction after the
    previous end. Prints start, end instruction and its comment."""
    start = None
    for a, mn, ops, cm in ins:
        if start is None: start = a
        end = (mn in ("CALL", "CALLF") and "StrCopy" not in (cm or "")) or mn.startswith("J") or mn in ("RET", "RETF")             or (mn in ("MOV", "INC", "DEC", "ADD", "SUB", "OR", "AND") and re.match(r"(byte |word )?(ptr )?(ES:)?\[", ops) and "BP" not in ops.split(",")[0])
        if end:
            print("%s  %-6s %-40s %s" % (start, mn, ops[:40], (cm or "")[:60]))
            start = None


def main():
    unit, fn = sys.argv[1], sys.argv[2]
    ins, cur = [], None
    for ln in open(os.path.join(R, "decode/listings/%s.lst" % unit), encoding="latin-1"):
        if ln.startswith(";==== "):
            cur = ln.split()[1]; continue
        m = LINE.match(ln.rstrip("\n"))
        if m and cur == fn:
            ins.append(m.groups())
    if "--stmts" in sys.argv:
        return stmts(ins)
    starts = "--starts" in sys.argv
    start, args, al, di, strs = None, [], None, None, None
    for a, mn, ops, cm in ins:
        if start is None: start = a
        cm = cm or ""
        if starts and not args and (mn.startswith("J") or (mn in ("MOV", "INC", "DEC", "ADD", "SUB", "OR", "AND")
                and re.match(r"(byte |word )?(ptr )?(ES:)?\[", ops) and "BP" not in ops.split(",")[0])):
            start = None    # a statement ended here: the call's statement starts after it
            continue
        if mn == "MOV" and re.match(r"A[LX],0x[0-9a-f]+$", ops):
            al = "$%X" % int(ops.split(",")[1], 16)
        elif mn == "MOV" and re.match(r"A[LX],(byte |word )?(ptr )?\[", ops):
            al = cm.split(" ")[0] if cm and not cm.startswith("[") else ops.split(",")[1]
        elif mn == "XOR" and ops in ("AX,AX", "AL,AL"):
            al = "0"
        elif mn == "MOV" and ops.startswith("DI,0x"):
            di = int(ops.split(",")[1], 16)
            mm = re.search(r'cs:"(.*)', cm)
            strs = ("'" + mm.group(1).rstrip('"') + "'") if mm else None
        elif mn == "PUSH":
            if ops in ("AX",): args.append(al or "?")
            elif ops.startswith("word ptr"): args.append(cm.split(" ")[0] if cm else ops)
            elif ops == "DS" and di is not None: args.append("addr DS:%04X" % di)
            elif ops == "CS" and strs: args.append(strs)
            elif ops in ("SS", "DI", "ES", "DS", "CS"): pass
            else: args.append("?" + ops)
        elif mn in ("CALL", "CALLF"):
            callee = cm.split(" (")[0] if cm else ops
            if callee.startswith("System.@StrCopy"):
                continue    # the literal stays on the stack as the argument
            # PUSH CS before a near call is the return segment, not an argument
            print("%s  %s(%s)" % (start, callee, ", ".join(args)))
            start, args, al, di, strs = None, [], None, None, None
        elif mn.startswith("J") or mn in ("RET", "RETF"):
            pass


if __name__ == "__main__":
    main()
