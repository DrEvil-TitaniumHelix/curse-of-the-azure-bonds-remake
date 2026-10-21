"""ecldiff.py - address-insensitive diff of two ECL disassemblies (decode/tools/ecldis.py output).

Usage: python -I ecldiff.py OLD.ecl.txt NEW.ecl.txt
Every code-address operand ([8xxx] / GOTO 8xxx, inside the record) becomes `L`, so an inserted instruction shows as an
insertion instead of shifting every later jump target. Comment columns (`; ...`) are dropped.
"""
import difflib, re, sys

ADDR = re.compile(r"\[([89][0-9A-F]{3})\]|\b(GOTO|GOSUB)\s+([89][0-9A-F]{3})\b")


def norm(path):
    out = []
    for l in open(path, encoding="utf-8", errors="replace"):
        l = l.rstrip("\n")
        if not re.match(r"^[89A-F][0-9A-F]{3}  ", l):
            continue
        body = l[6:]
        body = re.sub(r"^((?:[0-9A-F]{2} )+(?:\.\. )?)", "", body)   # drop the byte column
        body = body.split("   ;")[0].rstrip()
        body = ADDR.sub(lambda m: "[L]" if m.group(1) else m.group(2) + " L", body)
        out.append((l[:4], body))
    return out


def main():
    a, b = norm(sys.argv[1]), norm(sys.argv[2])
    sm = difflib.SequenceMatcher(None, [x[1] for x in a], [x[1] for x in b], autojunk=False)
    same = ins = dele = 0
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            same += i2 - i1
            continue
        print("@@ v1.0 %s..%s  v1.3 %s..%s  (%s)" % (a[i1][0] if i1 < len(a) else "end", a[i2 - 1][0] if i2 > i1 else "-",
                                                    b[j1][0] if j1 < len(b) else "end", b[j2 - 1][0] if j2 > j1 else "-", tag))
        for k in range(i1, i2):
            print("- %s  %s" % a[k]); dele += 1
        for k in range(j1, j2):
            print("+ %s  %s" % b[k]); ins += 1
    print("instructions: %d old, %d new, %d equal, %d removed, %d added" % (len(a), len(b), same, dele, ins))


if __name__ == "__main__":
    main()
