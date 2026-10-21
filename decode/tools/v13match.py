"""v13match.py - routine shape-match Curse v1.0 (START.EXE/GAME.OVR, TPOV) against v1.3 (ST.EXE unpacked/GAME.OVR, FBOV).

Usage: python -I v13match.py V10_START.EXE V10_GAME.OVR V13_ST.unpacked.exe V13_GAME.OVR functions.tsv OUT_DIR

Method (same idea as rtcensus.py / resmatch.py, extended to whole routines):
  1. Both layouts via tpovl.parse. Unit pairs = same overlay index (36 units in both; sizes within 0.5%), resident
     pairs = MZ relocation-target segments in order (RES_PAIRS below, checked by size).
  2. Routine starts = every Turbo Pascal prologue `55 89 E5` (and the runtime's `55 8B EC`) in the unit code, plus the
     live stub entries. A routine = linear disassembly (capstone, 16-bit) from its start to the next start, truncated
     after the last RET/RETF/IRET (the bytes after it are the next routine's typed constants / string literals).
  3. Two token streams per routine:
       shape : mnemonic + operands with EVERY number replaced by '#'   (addresses and constants masked)
       const : mnemonic + operands with memory displacements, far-pointer words and branch targets masked, but
               IMMEDIATE operands kept (so a changed constant shows, a moved global does not)
  4. Alignment: routines of a unit pair are aligned monotonically (TP keeps source order) by dynamic programming on
     difflib ratios of the shape streams (threshold 0.6).
  5. Verdict per v1.0 routine: unchanged (shape and const streams equal), const (shape equal, an immediate differs),
     changed (shape differs; a unified token diff is written), removed (no v1.3 partner); v1.3 routines without a
     partner = new. v1.0 names come from functions.tsv (Ghidra export, decode/listings).
Outputs OUT_DIR/v13match.json (everything) and OUT_DIR/v13match.md (tables + diffs of the changed routines).
"""
import csv, difflib, json, os, re, struct, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tpovl
from capstone import Cs, CS_ARCH_X86, CS_MODE_16

md = Cs(CS_ARCH_X86, CS_MODE_16)
md.detail = True
NUM = re.compile(r"0x[0-9a-f]+|\b\d+\b")
DISP = re.compile(r"\[([^\]]*)\]")

# v1.0 resident segment -> v1.3 resident segment (from the MZ relocation-target lists of both images, in order)
RES_PAIRS = [(0x0000, 0x0000, "main"), (0x0186, 0x011B, "res_0186"), (0x019B, 0x012F, "res_019B"),
             (0x01A0, 0x0133, "res_01A0 frames"), (0x020F, 0x01A0, "res_020F config"), (0x0297, 0x0226, "res_0297 pictures"),
             (0x0542, 0x04CE, "res_0542 text"), (0x0636, 0x05BD, "res_0636 dax"), (0x06EA, 0x0670, "res_06EA keys"),
             (0x0713, 0x0699, "res_0713 sound"), (0x097D, 0x0811, "res_097D"), (0x097F, 0x0813, "dos"),
             (0x09AB, 0x083F, "crt"), (0x0A0D, 0x08A1, "overlay"), (0x0A54, 0x08F7, "system")]
RES_END = {0x0000: 0x0039, 0x0186: 0x0187, 0x019B: 0x019C, 0x01A0: 0x020B, 0x020F: 0x0297, 0x0297: 0x0542, 0x0542: 0x0636,
           0x0636: 0x06EA, 0x06EA: 0x0713, 0x0713: 0x097D, 0x097D: 0x097F, 0x097F: 0x09AB, 0x09AB: 0x0A0D, 0x0A0D: 0x0A54,
           0x0A54: 0x0C1C}
RES_END13 = {0x0000: 0x0036, 0x011B: 0x011C, 0x012F: 0x0130, 0x0133: 0x019C, 0x01A0: 0x0226, 0x0226: 0x04CE, 0x04CE: 0x05BD,
             0x05BD: 0x0670, 0x0670: 0x0699, 0x0699: 0x0811, 0x0811: 0x0813, 0x0813: 0x083F, 0x083F: 0x08A1, 0x08A1: 0x08F7,
             0x08F7: 0x0ABE}
ANALYSIS_SEG = {}  # v1.0 ovNN -> Ghidra analysis segment (from functions.tsv addresses)


def starts(code, extra=()):
    s = set(extra)
    for pat in (b"\x55\x89\xE5", b"\x55\x8B\xEC"):
        p = code.find(pat)
        while p >= 0:
            s.add(p)
            p = code.find(pat, p + 1)
    s.discard(0xFFFF)
    return sorted(x for x in s if x < len(code))


def disasm(code, a, b):
    ins = list(md.disasm(code[a:b], a))
    last = None
    for i, x in enumerate(ins):
        if x.mnemonic in ("ret", "retf", "iret", "iretd"):
            last = i
    if last is not None:
        ins = ins[:last + 1]
    return ins


def shape_tok(x):
    return x.mnemonic + " " + NUM.sub("#", x.op_str)


def const_tok(x):
    op = x.op_str
    if x.mnemonic.startswith("j") or x.mnemonic in ("call", "lcall", "ljmp", "loop", "loope", "loopne"):
        return x.mnemonic + " " + NUM.sub("#", op)
    op = DISP.sub(lambda m: m.group(0) if re.fullmatch(r"\[(0x[0-9a-f]+|\d+)\]", m.group(0)) else "[" + NUM.sub("#", m.group(1)) + "]", op)
    return x.mnemonic + " " + op


# ---- TP 5.0 -> TP 6.0 code-generation idioms (tally of the diff hunks before normalisation; decode/V13_DELTA.md) ----
BASE = re.compile(r"\s*[+-]\s*(0x[0-9a-f]+|\d+|#)\]")
JCC = {"jl": "JLT", "jb": "JLT", "jg": "JGT", "ja": "JGT", "jle": "JLE", "jbe": "JLE", "jge": "JGE", "jae": "JGE"}
JALL = {"je", "jne", "jl", "jb", "jg", "ja", "jle", "jbe", "jge", "jae", "js", "jns", "jo", "jno"}


def nums(t):
    return [int(v, 16) if v.startswith("0x") else int(v) for v in NUM.findall(t)]


def num0(t):
    v = nums(t)
    return v[0] if v else 0


def base(op):
    """memory operand without its displacement: '[bp - 2]' -> '[bp]', '[0x1234]' -> '[]', 'es:[di + 4]' -> 'es:[di]'"""
    return BASE.sub("]", op)


def m(tok, pat):
    """masked token == pattern (pattern uses # for any number)"""
    return NUM.sub("#", tok) == pat


def normalise(ins):
    """ins: list of (shape_token, const_token) -> normalised list (both streams rewritten together)"""
    out = list(ins)
    for _ in range(3):
        o, i, n = [], 0, len(out)
        changed = False
        while i < n:
            s, c = out[i]
            s1, c1 = out[i + 1] if i + 1 < n else ("", "")
            s2, c2 = out[i + 2] if i + 2 < n else ("", "")
            s3, c3 = out[i + 3] if i + 3 < n else ("", "")
            # R1 four-byte load: les R, X ; mov R2, es  ==  mov R, word ptr X ; mov R2, word ptr X+2
            mm = re.match(r"les (\w+), ptr (.*)", s)
            if mm and re.match(r"mov \w+, es$", s1):
                o.append(("LDFAR %s %s" % (mm.group(1), base(mm.group(2))), "LDFAR %s %s" % (mm.group(1), re.sub(r"(word )?ptr ", "", mm.group(2))))); i += 2; changed = True; continue
            mm = re.match(r"mov (\w+), word ptr (.*)", s)
            m1 = re.match(r"mov (\w+), word ptr (.*)", s1)
            if mm and m1 and mm.group(1) != m1.group(1) and base(mm.group(2)) == base(m1.group(2)) and \
                    mm.group(1) in ("ax", "cx", "di", "si") and m1.group(1) in ("dx", "bx", "es", "ax", "cx"):
                o.append(("LDFAR %s %s" % (mm.group(1), base(mm.group(2))), "LDFAR %s %s" % (mm.group(1), re.sub(r"(word )?ptr ", "", mm.group(2))))); i += 2; changed = True; continue
            # R2 epilogue
            if s == "mov sp, bp":
                i += 1; changed = True; continue
            # R3 byte compare
            if s == "xor ah, ah" and m(s1, "cmp ax, #"):
                o.append(("CMPB #", "CMPB %d" % (num0(c1) & 0xFF))); i += 2; changed = True; continue
            if m(s, "cmp ax, #") or m(s, "cmp al, #"):
                o.append(("CMPB #", "CMPB %d" % (num0(c) & 0xFF))); i += 1; changed = True; continue
            # R8 boolean materialisation (before R4/R7 touch its parts)
            if s.split(" ")[0] in JALL and m(s1, "mov al, #") and m(s2, "jmp #") and m(s3, "mov al, #"):
                o.append(("BOOL", "BOOL")); i += 4; changed = True; continue
            if m(s, "mov al, #") and s1.split(" ")[0] in JALL and s2 == "inc ax":
                o.append(("BOOL", "BOOL")); i += 3; changed = True; continue
            # R4 signed/unsigned conditional jumps
            w0 = s.split(" ")[0]
            if w0 in JCC:
                o.append((JCC[w0] + " #", JCC[w0] + " #")); i += 1; changed = True; continue
            # R9 abs
            if s == "or ax, ax" and s1 == "jns #" and s2 == "neg ax":
                o.append(("ABS", "ABS")); i += 3; changed = True; continue
            if s == "cdq " and s1 == "xor ax, dx" and s2 == "sub ax, dx":
                o.append(("ABS", "ABS")); i += 3; changed = True; continue
            # R5 multiply / divide / shift
            if m(s, "mov ax, word ptr [bp - #]") and m(s1, "mov dx, #") and s2 == "mul dx":
                o.append(("MULM [bp - #] #", "MULM %s %d" % (c.split("ptr ")[1], num0(c1)))); i += 3; changed = True; continue
            if m(s, "mov ax, #") and m(s1, "mul word ptr [bp - #]"):
                o.append(("MULM [bp - #] #", "MULM %s %d" % (c1.split("ptr ")[1], num0(c)))); i += 2; changed = True; continue
            if (m(s, "mov cx, #") and s1 in ("imul cx", "mul cx")) or (m(s, "mov dx, #") and s1 in ("imul dx", "mul dx")):
                o.append(("MULC #", "MULC %d" % num0(c))); i += 2; changed = True; continue
            if m(s, "mov si, ax") and m(s1, "shl ax, #") and m(s2, "shl ax, #") and s3 == "add ax, si":
                o.append(("MULC #", "MULC %d" % ((1 << (num0(c1) + num0(c2))) + 1))); i += 4; changed = True; continue
            if m(s, "mov si, ax") and m(s1, "shl ax, #") and s2 == "add ax, si":
                o.append(("MULC #", "MULC %d" % ((1 << num0(c1)) + 1))); i += 3; changed = True; continue
            if m(s, "mov si, di") and m(s1, "shl di, #") and s2 == "add di, si":
                o.append(("MULCDI #", "MULCDI %d" % ((1 << num0(c1)) + 1))); i += 3; changed = True; continue
            if s in ("imul dx", "mul dx", "imul cx", "mul cx", "imul bx", "mul bx"):
                o.append(("MUL", "MUL")); i += 1; changed = True; continue
            if s == "cdq " and m(s1, "mov cx, #") and s2 == "idiv cx":
                o.append(("DIVC #", "DIVC %d" % num0(c1))); i += 3; changed = True; continue
            if s == "xor dx, dx" and m(s1, "mov cx, #") and s2 == "div cx":
                o.append(("DIVC #", "DIVC %d" % num0(c1))); i += 3; changed = True; continue
            if m(s, "mov cl, #") and s1 == "shr ax, cl":
                o.append(("DIVC #", "DIVC %d" % (1 << num0(c)))); i += 2; changed = True; continue
            if m(s, "shr ax, #") and m(s1, "shr ax, #"):
                o.append(("DIVC #", "DIVC %d" % (1 << (num0(c) + num0(c1))))); i += 2; changed = True; continue
            if m(s, "shr ax, #"):
                o.append(("DIVC #", "DIVC %d" % (1 << num0(c)))); i += 1; changed = True; continue
            if s in ("idiv cx", "div cx", "idiv bx", "div bx"):
                o.append(("DIV", "DIV")); i += 1; changed = True; continue
            if m(s, "mov cx, #") and s1 == "shl ax, cl":
                o.append(("SHLC #", "SHLC %d" % num0(c))); i += 2; changed = True; continue
            if m(s, "shl ax, #") and m(s1, "shl ax, #"):
                o.append(("SHLC #", "SHLC %d" % (num0(c) + num0(c1)))); i += 2; changed = True; continue
            if m(s, "shl ax, #"):
                o.append(("SHLC #", "SHLC %d" % num0(c))); i += 1; changed = True; continue
            if s.startswith("mov ax, word ptr ") and s1 == "mov cx, ax":
                o.append(("mov cx, word ptr " + s[len("mov ax, word ptr "):], "mov cx, " + c[len("mov ax, "):])); i += 2; changed = True; continue
            # R5b more shift / divide / multiply spellings
            if m(s, "mov cl, #") and s1 == "shl ax, cl":
                o.append(("SHLC #", "SHLC %d" % num0(c))); i += 2; changed = True; continue
            if s == "cdq " and m(s1, "mov cx, #") and s2 in ("div cx", "idiv cx"):
                o.append(("DIVC #", "DIVC %d" % num0(c1))); i += 3; changed = True; continue
            if m(s, "mov si, di") and m(s1, "shl di, #") and m(s2, "shl di, #") and s3 == "add di, si":
                o.append(("MULCDI #", "MULCDI %d" % ((1 << (num0(c1) + num0(c2))) + 1))); i += 4; changed = True; continue
            mm = re.match(r"mov ax, word ptr (.*)", s)
            if mm and m(s1, "MULC #"):
                o.append(("MULM %s #" % mm.group(1), "MULM %s %s" % (c.split("ptr ")[1], c1.split(" ")[1]))); i += 2; changed = True; continue
            mm = re.match(r"mov ax, word ptr (.*)", s)
            if mm and (m(s1, "mov dx, #") or m(s1, "mov cx, #")) and s2 in ("mul dx", "imul dx", "mul cx", "imul cx"):
                o.append(("MULM %s #" % mm.group(1), "MULM %s %d" % (c.split("ptr ")[1], num0(c1)))); i += 3; changed = True; continue
            m1 = re.match(r"i?mul word ptr (.*)", s1)
            if m(s, "mov ax, #") and m1:
                o.append(("MULM %s #" % m1.group(1), "MULM %s %d" % (c1.split("ptr ")[1], num0(c)))); i += 2; changed = True; continue
            # R6b push the far pointer held at es:[di(+n)]: TP5 address form vs TP6 value form
            if s == "push es" and s1 == "push di":
                o.append(("LESPUSH", "LESPUSH")); i += 2; changed = True; continue
            if (s == "PUSHI" or m(s, "PUSHI #")) and s1 == "push di":
                o.append(("LESPUSH", "LESPUSH")); i += 2; changed = True; continue
            if m(s, "mov ax, #") and s1 == "push ax" and s2 == "push di":
                o.append(("LESPUSH", "LESPUSH")); i += 3; changed = True; continue
            if m(s, "add di, #") and s1 == "push es" and s2 == "push di":
                o.append(("LESPUSH #", "LESPUSH %d" % num0(c))); i += 3; changed = True; continue
            if m(s, "push word ptr es:[di + #]") and s1 == "push word ptr es:[di]":
                o.append(("LESPUSH", "LESPUSH")); i += 2; changed = True; continue
            if m(s, "push word ptr es:[di + #]") and m(s1, "push word ptr es:[di + #]"):
                o.append(("LESPUSH #", "LESPUSH %d" % num0(c1))); i += 2; changed = True; continue
            # R6 push a 4-byte thing about a local / global
            if m(s, "lea di, [bp - #]") and s1 == "push ss" and s2 == "push di":
                o.append(("PUSHP [bp-#]", "PUSHP " + c.split("lea di, ")[1])); i += 3; changed = True; continue
            if m(s, "push word ptr [bp - #]") and m(s1, "push word ptr [bp - #]"):
                o.append(("PUSHP [bp-#]", "PUSHP " + c1.split("push word ptr ")[1])); i += 2; changed = True; continue
            if m(s, "mov di, #") and s1 == "push ds" and s2 == "push di":
                o.append(("PUSHP ds:#", "PUSHP ds:%d" % num0(c))); i += 3; changed = True; continue
            if m(s, "push word ptr [#]") and m(s1, "push word ptr [#]"):
                o.append(("PUSHP ds:#", "PUSHP ds:%d" % num0(c))); i += 2; changed = True; continue
            # R10 segment constant pushes
            if m(s, "mov si, #") and s1 == "mov es, si":
                i += 2; changed = True; continue
            if s == "push es":
                o.append(("PUSHI", "PUSHI")); i += 1; changed = True; continue
            if m(s, "mov ax, #") and s1 == "push ax":
                o.append(("PUSHI", "PUSHI %d" % num0(c))); i += 2; changed = True; continue
            # R7 add/sub small constants
            if s == "inc ax" or m(s, "add ax, #"):
                v = 1 if s == "inc ax" else num0(c)
                if o and o[-1][0] == "ADDC ax":
                    o[-1] = ("ADDC ax", "ADDC ax %d" % (nums(o[-1][1])[0] + v))
                else:
                    o.append(("ADDC ax", "ADDC ax %d" % v))
                i += 1; changed = True; continue
            if s == "dec ax" or m(s, "sub ax, #"):
                v = 1 if s == "dec ax" else num0(c)
                if o and o[-1][0] == "SUBC ax":
                    o[-1] = ("SUBC ax", "SUBC ax %d" % (nums(o[-1][1])[0] + v))
                else:
                    o.append(("SUBC ax", "SUBC ax %d" % v))
                i += 1; changed = True; continue
            # R11 / R12
            if s in ("retf ", "retf #"):
                o.append(("RETF", "RETF")); i += 1; changed = True; continue
            if m(s, "mov cx, #") or m(s, "mov cl, #"):
                o.append(("MOVC cx #", "MOVC cx %d" % num0(c))); i += 1; changed = True; continue
            o.append((s, c)); i += 1
        out = o
        if not changed:
            break
    return stage2(out)


INV = {"je": "jne", "jne": "je", "JLT #": "JGE #", "JGE #": "JLT #", "JGT #": "JLE #", "JLE #": "JGT #", "js": "jns", "jns": "js"}
TREG = re.compile(r"\b(bx|cx|dx)\b")
TREGL = re.compile(r"\b(bl|cl|dl)\b")
TREGH = re.compile(r"\b(bh|ch|dh)\b")


def stage2(ins):
    """TP 5 hidden result pointer for 4-byte function results vs TP 6 DX:AX store (both -> `RES` after the call); scaling
    on di; temp register choice; cwde; jcc+jmp inversion. Applied to both versions."""
    o, i, n, pending_res = [], 0, len(ins), False
    while i < n:
        s, c = ins[i]
        nxt = [x[0] for x in ins[i + 1:i + 5]]
        # A: TP5 pushes a pointer to the result temp right before the arguments of a far call
        if s in ("PUSHP [bp-#]", "PUSHP ds:#") and any(t.startswith("lcall") for t in nxt[:3]):
            pending_res = True; i += 1; continue
        if s.startswith("les di, ptr") and nxt and (nxt[0] == "LESPUSH" or m(nxt[0], "LESPUSH #")) and \
                any(t.startswith("lcall") for t in [x[0] for x in ins[i + 2:i + 5]]):
            pending_res = True; i += 2; continue
        # B: TP6 stores DX:AX into the result temp right after the far call
        if s.startswith("lcall"):
            o.append((s, c))
            res = False
            if len(nxt) >= 2 and m(nxt[0], "mov word ptr [bp - #], ax") and m(nxt[1], "mov word ptr [bp - #], dx"):
                i += 3; res = True
            elif len(nxt) >= 2 and m(nxt[0], "mov word ptr [#], ax") and m(nxt[1], "mov word ptr [#], dx"):
                i += 3; res = True
            elif len(nxt) >= 3 and nxt[0].startswith("les di, ptr") and m(nxt[1], "mov word ptr es:[di + #], ax") and m(nxt[2], "mov word ptr es:[di + #], dx"):
                i += 4; res = True
            elif len(nxt) >= 3 and nxt[0].startswith("les di, ptr") and m(nxt[1], "mov word ptr es:[di], ax") and m(nxt[2], "mov word ptr es:[di + #], dx"):
                i += 4; res = True
            else:
                i += 1
            if res or pending_res:
                o.append(("RES", "RES"))
            pending_res = False
            continue
        # C: scaling on di
        if m(s, "MULC #") and nxt and nxt[0] == "mov di, ax":
            o.append(("MULDI #", "MULDI " + c.split(" ")[1])); i += 2; continue
        if s == "mov di, ax" and nxt and m(nxt[0], "MULCDI #"):
            o.append(("MULDI #", "MULDI " + ins[i + 1][1].split(" ")[1])); i += 2; continue
        # D: cwde
        if s == "cwde ":
            i += 1; continue
        # E: jcc + jmp == inverted jcc
        w0 = s.split(" ")[0]
        if nxt and nxt[0] == "jmp #":
            if w0 in ("je", "jne", "js", "jns"):
                o.append((INV[w0] + " #", INV[w0] + " #")); i += 2; continue
            if s in INV:
                o.append((INV[s], INV[s])); i += 2; continue
        o.append((s, c)); i += 1
    # F: temp register choice bx/cx/dx (TP 6 prefers dx where TP 5 used bx/cx)
    return [(TREGH.sub("Th", TREGL.sub("Tl", TREG.sub("T", a))), TREGH.sub("Th", TREGL.sub("Tl", TREG.sub("T", b)))) for a, b in o]


def routines(code, extra=()):
    st = starts(code, extra)
    out = []
    for i, a in enumerate(st):
        b = st[i + 1] if i + 1 < len(st) else len(code)
        ins = disasm(code, a, b)
        if not ins:
            continue
        raw = [(shape_tok(x), const_tok(x)) for x in ins]
        nm = normalise(raw)
        out.append(dict(ofs=a, end=ins[-1].address + ins[-1].size, n=len(ins),
                        shape=[s for s, c in nm], const=[c for s, c in nm],
                        raw_shape=[s for s, c in raw], full=[x.mnemonic + " " + x.op_str for x in ins]))
    return out


def align(A, B, thr=0.5):
    """monotone DP alignment maximising summed ratio; returns {ia: (ib, score)}"""
    n, m = len(A), len(B)
    S = [[0.0] * m for _ in range(n)]
    for i, a in enumerate(A):
        sa = a["shape"]
        for j, b in enumerate(B):
            sm = difflib.SequenceMatcher(None, sa, b["shape"], autojunk=False)
            if sm.real_quick_ratio() < thr or sm.quick_ratio() < thr:
                continue
            r = sm.ratio()
            if r >= thr:
                S[i][j] = r
    D = [[0.0] * (m + 1) for _ in range(n + 1)]
    P = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            best, p = D[i - 1][j], 1
            if D[i][j - 1] > best:
                best, p = D[i][j - 1], 2
            if S[i - 1][j - 1] > 0 and D[i - 1][j - 1] + S[i - 1][j - 1] > best:
                best, p = D[i - 1][j - 1] + S[i - 1][j - 1], 3
            D[i][j], P[i][j] = best, p
    pairs = {}
    i, j = n, m
    while i > 0 and j > 0:
        p = P[i][j]
        if p == 3:
            pairs[i - 1] = (j - 1, S[i - 1][j - 1]); i -= 1; j -= 1
        elif p == 1:
            i -= 1
        else:
            j -= 1
    return pairs


def names_from_tsv(tsv):
    """{(unit, offset): name} for overlay units (analysis seg) and resident segments"""
    nm = {}
    for r in csv.DictReader(open(tsv, encoding="utf-8"), delimiter="\t"):
        seg, off = r["addr"].split(":")
        seg, off = int(seg, 16), int(off, 16)
        u = r["unit"]
        if u.startswith("ov"):
            ANALYSIS_SEG[u] = seg
            nm[(u, off)] = r["name"]
        elif u != "stubs":
            nm[("%04X" % seg, off)] = r["name"]
    return nm


DSMAP = {}      # v1.0 DS displacement -> {v1.3 displacement: votes}
CALLMAP = {}    # v1.0 far target "seg:off" -> {v1.3 "seg:off": votes}
DISPN = re.compile(r"\[(0x[0-9a-f]+|\d+)\]")
LCALL = re.compile(r"lcall (0x[0-9a-f]+|\d+), (0x[0-9a-f]+|\d+)")


def collect_pairs(fa, fb):
    """fa, fb: full instruction texts of two same-shape routines (only used when the raw instruction counts agree)"""
    if len(fa) != len(fb):
        return
    for a, b in zip(fa, fb):
        da, db = DISPN.findall(a), DISPN.findall(b)
        if len(da) == len(db):
            for x, y in zip(da, db):
                x, y = nums(x)[0], nums(y)[0]
                DSMAP.setdefault(x, {}).setdefault(y, 0)
                DSMAP[x][y] += 1
        la, lb = LCALL.match(a), LCALL.match(b)
        if la and lb:
            k = "%04X:%04X" % tuple(nums(la.group(1) + " " + la.group(2)))
            v = "%04X:%04X" % tuple(nums(lb.group(1) + " " + lb.group(2)))
            CALLMAP.setdefault(k, {}).setdefault(v, 0)
            CALLMAP[k][v] += 1


PENDING = []
SEGMAP = {}


def finish_consts():
    """second pass: classify every differing immediate with the DS map / segment map / CS-literal shift"""
    for row, ca, cb in PENDING:
        row["const_diff"] = classify_consts(ca, cb, row["v10"], row["v13"])
        if all(k != "real" for _, _, _, k in row["const_diff"]):
            row["verdict"] = "moved-operands"


def ds_lookup(x):
    """v1.3 DS offset of v1.0 offset x: image rule for the initialised part, else the collected map (nearest lower entry)"""
    d = ds_delta(x)
    if d is not None:
        return d
    if x in DSMAP:
        return int(max(DSMAP[x].items(), key=lambda t: t[1])[0])
    lower = [k for k in DSMAP if k <= x]
    if lower:
        k = max(lower)
        return x + int(max(DSMAP[k].items(), key=lambda t: t[1])[0]) - k
    return None


def ds_delta(x):
    """expected v1.3 DS offset of v1.0 offset x inside the initialised image (image diff: +2 / +18h), else None"""
    if x < 0x47A2:
        return x + 2
    if 0x47A6 <= x < 0x47E0:
        return x + 0x18
    return None


def classify_consts(ca, cb, oa, ob):
    out = []
    for k, (a, b) in enumerate(zip(ca, cb)):
        if a == b:
            continue
        na, nb = nums(a), nums(b)
        kinds = set()
        if len(na) != len(nb) or NUM.sub("#", a) != NUM.sub("#", b):
            kinds.add("real")
        else:
            for x, y in zip(na, nb):
                if x == y:
                    continue
                if (x, y) in SEGMAP:
                    kinds.add("segment")
                elif ds_lookup(x) == y:
                    kinds.add("ds-global")
                elif (x > 0x20 or a.startswith("mov di") or a.startswith("mov si")) and abs((y - x) - (ob - oa)) <= 0x60:
                    kinds.add("cs-literal")
                else:
                    kinds.add("real")
        kind = "real" if "real" in kinds else "+".join(sorted(kinds))
        out.append((k, a, b, kind))
    return out


def compare_unit(label, c10, c13, ex10, ex13, names, unit_key):
    R10, R13 = routines(c10, ex10), routines(c13, ex13)
    pairs = align(R10, R13)
    rows, used = [], set()
    for i, r in enumerate(R10):
        name = names.get((unit_key, r["ofs"]), "")
        row = dict(v10=r["ofs"], v10_end=r["end"], name=name, n10=r["n"])
        if i in pairs:
            j, sc = pairs[i]
            used.add(j)
            q = R13[j]
            row.update(v13=q["ofs"], v13_end=q["end"], n13=q["n"], score=round(sc, 3))
            if r["shape"] == q["shape"]:
                collect_pairs(r["full"], q["full"])
                if r["const"] == q["const"]:
                    row["verdict"] = "unchanged"
                else:
                    row["verdict"] = "const"
                    PENDING.append((row, r["const"], q["const"]))
            else:
                row["verdict"] = "changed"
                row["diff"] = [l for l in difflib.unified_diff(r["shape"], q["shape"], "v1.0", "v1.3", n=1, lineterm="")]
        else:
            row["verdict"] = "removed"
        rows.append(row)
    new = [dict(v13=q["ofs"], v13_end=q["end"], n13=q["n"], verdict="new", shape=q["shape"][:12])
           for j, q in enumerate(R13) if j not in used]
    return dict(unit=label, n_v10=len(R10), n_v13=len(R13), rows=rows, new=new)


def main():
    exe10, ovr10, exe13, ovr13, tsv, out = sys.argv[1:7]
    os.makedirs(out, exist_ok=True)
    names = names_from_tsv(tsv)
    m10, o10, _, st10, rel10, mg10 = tpovl.parse(exe10, ovr10)
    m13, o13, _, st13, rel13, mg13 = tpovl.parse(exe13, ovr13)
    assert len(st10) == len(st13) == 36
    for a, b in zip(st10, st13):
        SEGMAP[(a["stub_seg"], b["stub_seg"])] = 1
    for s10, s13, _ in RES_PAIRS:
        SEGMAP[(s10, s13)] = 1
    SEGMAP[(0x0C1C, 0x0ABE)] = 1
    units = []
    for i, (a, b) in enumerate(zip(st10, st13)):
        c10 = o10[a["file_ofs"]:a["file_ofs"] + a["code_size"]]
        c13 = o13[b["file_ofs"]:b["file_ofs"] + b["code_size"]]
        u = compare_unit("ov%02d" % i, c10, c13, a["entries"], b["entries"], names, "ov%02d" % i)
        u.update(stub10="%04X" % a["stub_seg"], stub13="%04X" % b["stub_seg"], size10=a["code_size"], size13=b["code_size"],
                 ent10=len(a["entries"]), live10=a["live_entries"], ent13=len(b["entries"]), fix10=a["n_fixups"], fix13=b["n_fixups"],
                 fofs10=a["file_ofs"], fofs13=b["file_ofs"])
        # entry mapping: v1.3 entry k -> matched v1.0 routine
        v13_to_v10 = {r["v13"]: r for r in u["rows"] if "v13" in r}
        u["entry_map"] = [dict(e13=k, ofs13=e, v10=v13_to_v10.get(e, {}).get("v10"), name=v13_to_v10.get(e, {}).get("name", ""),
                               e10=(a["entries"].index(v13_to_v10[e]["v10"]) if e in v13_to_v10 and v13_to_v10[e]["v10"] in a["entries"] else None))
                          for k, e in enumerate(b["entries"])]
        units.append(u)
        print("%s %s" % (u["unit"], summary(u)))
    res = []
    lm10, lm13 = m10["lm"], m13["lm"]
    for s10, s13, label in RES_PAIRS:
        c10 = lm10[s10 * 16:RES_END[s10] * 16]
        c13 = lm13[s13 * 16:RES_END13[s13] * 16]
        ex10 = [0x2F] if s10 == 0 else []
        ex13 = [m13["ip"]] if s13 == 0 else []
        u = compare_unit(label, c10, c13, ex10, ex13, names, "%04X" % s10)
        u.update(seg10="%04X" % s10, seg13="%04X" % s13, size10=len(c10), size13=len(c13))
        res.append(u)
        print("%s %s" % (label, summary(u)))
    finish_consts()
    dsmap = {("%04X" % k): {("%04X" % a): b for a, b in v.items()} for k, v in sorted(DSMAP.items())}
    json.dump(dict(units=units, resident=res, ds10="0C1C", ds13="0ABE", dsmap=dsmap, callmap=CALLMAP,
                   reloc_targets10=["%04X" % t for t in rel10], reloc_targets13=["%04X" % t for t in rel13]),
              open(os.path.join(out, "v13match.json"), "w"), indent=1)
    write_md(units, res, os.path.join(out, "v13match.md"))


def summary(u):
    c = {}
    for r in u["rows"]:
        c[r["verdict"]] = c.get(r["verdict"], 0) + 1
    return "routines %d -> %d: unchanged %d moved-operands %d const %d changed %d removed %d new %d" % (
        u["n_v10"], u["n_v13"], c.get("unchanged", 0), c.get("moved-operands", 0), c.get("const", 0), c.get("changed", 0),
        c.get("removed", 0), len(u["new"]))


def write_md(units, res, path):
    L = ["# v13match output (generated by decode/tools/v13match.py; evidence tables for decode/V13_DELTA.md)", ""]
    L.append("## Overlay units")
    L.append("| unit | stub v1.0 | stub v1.3 | code v1.0 | code v1.3 | entries v1.0 (live) | entries v1.3 | fixups | routines v1.0 -> v1.3 | unchanged | moved operands | const | changed | removed | new |")
    L.append("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|")
    for u in units:
        c = {}
        for r in u["rows"]:
            c[r["verdict"]] = c.get(r["verdict"], 0) + 1
        L.append("| %s | %s | %s | %04X | %04X | %d (%d) | %d | %d / %d | %d -> %d | %d | %d | %d | %d | %d | %d |" % (
            u["unit"], u["stub10"], u["stub13"], u["size10"], u["size13"], u["ent10"], u["live10"], u["ent13"], u["fix10"], u["fix13"],
            u["n_v10"], u["n_v13"], c.get("unchanged", 0), c.get("moved-operands", 0), c.get("const", 0), c.get("changed", 0),
            c.get("removed", 0), len(u["new"])))
    L.append("")
    L.append("## Resident segments")
    L.append("| unit | seg v1.0 | seg v1.3 | size v1.0 | size v1.3 | routines v1.0 -> v1.3 | unchanged | moved operands | const | changed | removed | new |")
    L.append("|---|---|---|---|---|---|---|---|---|---|---|---|")
    for u in res:
        c = {}
        for r in u["rows"]:
            c[r["verdict"]] = c.get(r["verdict"], 0) + 1
        L.append("| %s | %s | %s | %04X | %04X | %d -> %d | %d | %d | %d | %d | %d | %d |" % (
            u["unit"], u["seg10"], u["seg13"], u["size10"], u["size13"], u["n_v10"], u["n_v13"],
            c.get("unchanged", 0), c.get("moved-operands", 0), c.get("const", 0), c.get("changed", 0), c.get("removed", 0), len(u["new"])))
    L.append("")
    L.append("## Changed / const / removed / new routines (every one)")
    for u in units + res:
        items = [r for r in u["rows"] if r["verdict"] not in ("unchanged", "moved-operands")]
        if not items and not u["new"]:
            continue
        L.append("### %s" % u["unit"])
        for r in items:
            if r["verdict"] == "removed":
                L.append("- **removed** v1.0 %04X %s (%d instr)" % (r["v10"], r["name"], r["n10"]))
                continue
            L.append("- **%s** v1.0 %04X -> v1.3 %04X %s (%d -> %d instr, ratio %s)" % (
                r["verdict"], r["v10"], r["v13"], r["name"], r["n10"], r["n13"], r["score"]))
            if r["verdict"] == "const":
                for k, a, b, kind in r["const_diff"]:
                    L.append("  - instr %d: `%s` -> `%s` (%s)" % (k, a, b, kind))
            elif r["verdict"] == "changed":
                L.append("  ```diff")
                L.extend("  " + l for l in r["diff"][2:])
                L.append("  ```")
        for q in u["new"]:
            L.append("- **new** v1.3 %04X (%d instr): `%s`" % (q["v13"], q["n13"], " ; ".join(q["shape"])))
        L.append("")
    open(path, "w", encoding="utf-8").write("\n".join(L))


if __name__ == "__main__":
    main()
