"""Port a Pool pseudocode section onto Curse addresses (cab-rt; a drafting aid, the asm check stays manual).

Usage: python -I pooltrans.py POOL_SEG CURSE_SEG [--pool-file ENGINE.pas.md] > draft.md

For every `### SSSS:OOOO Name` routine of Pool segment POOL_SEG in Pool's pseudocode file, finds the Curse routine
with the same name (decode/listings, names from decode/names) and aligns the two instruction streams (difflib on
mnemonic + operands with numbers masked). Then rewrites:
  - `{ pppp:oooo ... }` anchors and the heading address to the aligned Curse instruction (lower case seg:off);
    an anchor that falls on an unaligned instruction becomes `{ ?pppp:oooo }` = check by hand;
  - Pool DS globals `g_XXXX` to the Curse offset with the most aligned votes (decode/tools/globals.py poolmap),
    printed as the Curse GLOBALS.md name; unmapped ones become `g_?XXXX`.
Prints per routine: aligned instruction share, anchors mapped/unmapped. Output is a DRAFT for statement-by-statement review.
"""
import collections, difflib, glob, json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import globals as G

R, POOL = G.R, G.POOL
LINE = G.LINE
NUM = re.compile(r"0x[0-9a-f]+(?::[0-9a-f]+)?")


def listing(root):
    """name -> [(addr 'ssss:oooo', mnemonic, operands)], addr -> function name"""
    fn, owner = {}, {}
    for f in sorted(glob.glob(os.path.join(root, "decode/listings/*.lst"))):
        if f.endswith("stubs.lst"): continue
        cur = None
        for ln in open(f, encoding="latin-1"):
            if ln.startswith(";==== "):
                cur = fn.setdefault(ln.split()[1], []); name = ln.split()[1]; continue
            m = LINE.match(ln.rstrip(chr(10)))
            if m and cur is not None:
                a = m.group(1) + ":" + m.group(2)
                cur.append((a, m.group(4), m.group(5))); owner[a] = name
    return fn, owner


def diff(cname, pname):
    """print the non-matching instruction runs of a paired routine (Curse vs Pool); MOV SP,BP (TP 5 epilogue) ignored"""
    cf, _ = listing(R); pf, _ = listing(POOL)
    ca = [x for x in cf[cname] if not (x[1] == "MOV" and x[2] == "SP,BP")]
    pb = [x for x in pf[pname] if not (x[1] == "MOV" and x[2] == "SP,BP")]
    tok = lambda x: x[1] + " " + NUM.sub("#", x[2])
    sm = difflib.SequenceMatcher(None, [tok(x) for x in ca], [tok(x) for x in pb], autojunk=False)
    for op, a1, a2, b1, b2 in sm.get_opcodes():
        if op == "equal": continue
        print("--- %s  curse %s  pool %s" % (op, ca[a1][0] if a1 < len(ca) else "end", pb[b1][0] if b1 < len(pb) else "end"))
        for x in ca[a1:a2]: print("  C %s %s %s" % x)
        for x in pb[b1:b2]: print("  P %s %s %s" % x)


TSV = {}
for _r in __import__("csv").DictReader(open(os.path.join(R, "decode/listings/functions.tsv"), encoding="utf-8"), delimiter="	"):
    TSV[_r["name"]] = (", ".join(_r["callers"].split(",")[:12]) + (" +%d" % (len(_r["callers"].split(",")) - 12) if len(_r["callers"].split(",")) > 12 else ""),
                       ", ".join(_r["callees"].split(",")[:14]))


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    if sys.argv[1] == "--diff":
        return diff(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else sys.argv[2])
    pseg, cseg = sys.argv[1].lower(), sys.argv[2].lower()
    pfile = sys.argv[sys.argv.index("--pool-file") + 1] if "--pool-file" in sys.argv else "ENGINE.pas.md"
    text = open(os.path.join(POOL, "decode/pseudo", pfile), encoding="utf-8").read()
    cf, cown = listing(R)
    pf, pown = listing(POOL)
    votes, _ = G.poolmap()
    rev = collections.defaultdict(collections.Counter)
    for c, cnt in votes.items():
        for p, n in cnt.items(): rev[p][c] += n
    gl = json.load(open(os.path.join(R, "decode/names/globals.json")))
    for f in sorted(glob.glob(os.path.join(R, "decode/names/*.json"))):
        if not f.endswith("globals.json"):
            for k, v in json.load(open(f)).items():
                if k.upper().startswith("0C1C:"): gl[k.upper()] = v
    # split Pool text into routine blocks of this segment
    cseg_funcs = {n: i for n, i in cf.items() if i and i[0][0][:4] == cseg} if "--shape" in sys.argv else None
    blocks = re.split(r"(?m)^(?=### )", text)
    out = []
    for b in blocks:
        m = re.match(r"### ([0-9A-Fa-f]{4}):([0-9A-Fa-f]{4}) (\S+)", b)
        if not m or m.group(1).lower() != pseg: continue
        pname = m.group(3)
        paddr = (m.group(1) + ":" + m.group(2)).lower()
        pins = pf.get(pown.get(paddr, pname), [])
        cname = pname if pname in cf else None
        if cname is None and cseg_funcs is not None and pins:
            # pair by shape inside the Curse unit: best difflib ratio of masked instruction streams (>= 0.5)
            tk = lambda x: x[1] + " " + NUM.sub("#", x[2])
            pt = [tk(x) for x in pins]
            best = (0.0, None)
            for n2, ci in cseg_funcs.items():
                r = difflib.SequenceMatcher(None, pt, [tk(x) for x in ci], autojunk=False).quick_ratio()
                if r > best[0]:
                    best = (difflib.SequenceMatcher(None, pt, [tk(x) for x in ci], autojunk=False).ratio(), n2) if r > 0.5 else best
            if best[1] and best[0] >= 0.5:
                cname = best[1]
        cins = cf.get(cname, []) if cname else []
        amap = {}
        if pins and cins:
            tok = lambda x: x[1] + " " + NUM.sub("#", x[2])
            sm = difflib.SequenceMatcher(None, [tok(x) for x in pins], [tok(x) for x in cins], autojunk=False)
            for blk in sm.get_matching_blocks():
                for k in range(blk.size): amap[pins[blk.a + k][0]] = cins[blk.b + k][0]
        ok = bad = 0

        def anchor(mm):
            nonlocal ok, bad
            a = (mm.group(1) + ":" + mm.group(2)).lower()
            if a[:4] != pseg: return mm.group(0)
            if a in amap: ok += 1; return amap[a]
            bad += 1; return "?" + a

        def glob_(mm):
            p = int(mm.group(1), 16)
            if p in rev:
                c = rev[p].most_common(1)[0][0]
                return gl.get("0C1C:%04X" % c, "g_%04X" % c)
            return "g_?" + mm.group(1)
        head, _, body = b.partition("\n")
        # Pool caller/callee prose does not carry over: strip it, add Curse's from functions.tsv
        pre, sep, code = body.partition("```")
        pre = re.sub(r"(?:— *)?\b[Cc]all(?:ers|ees)(?: \(\d+\))?:[^.]*\.", "", pre)
        if cname and cname in TSV:
            pre = pre.rstrip("\n") + "\nCurse callers: %s. Callees: %s.\n" % (TSV[cname][0] or "-", TSV[cname][1] or "-")
        body = pre + sep + code
        body = re.sub(r"\b([0-9a-fA-F]{4}):([0-9a-fA-F]{4})\b", anchor, body)
        body = re.sub(r"\bg_([0-9A-Fa-f]{4})\b", glob_, body)
        caddr = amap.get(pins[0][0]) if pins else None
        share = "%d/%d" % (len(amap), max(len(pins), len(cins))) if pins else "no Pool listing"
        out.append("### %s %s%s\n<!-- pooltrans: Pool %s, Curse %s, aligned %s, anchors ok %d / unmapped %d -->\nPool: %s %s — aligned %s instructions.\n%s" % (
            (caddr or "????:????").upper(), pname, head[len(m.group(0)):], paddr, cname or "NOT FOUND", share, ok, bad,
            paddr.upper(), pname, share, body))
    sys.stdout.write("".join(out))


if __name__ == "__main__":
    main()
