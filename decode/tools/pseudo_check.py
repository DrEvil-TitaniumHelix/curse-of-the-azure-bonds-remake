"""Print random pseudocode statements of decode/pseudo/<AREA>.pas.md next to the asm at their `{ seg:off }` anchor.

Port of PoolRadianceRE decode/tools/pseudo_check.py for Curse (cab-rt). Used for the verifier's independent sample
(the lane's own self-check is separate).

Usage: python -I pseudo_check.py AREA [N | -p PCT] [--seed S] [--after K]
  AREA     COMBAT, MAGIC, ECL, VIEW, ... (reads decode/pseudo/AREA.pas.md)
  N        number of statements (default: 10 % of the anchored statements, rounded up)
  --seed   seed string (default "1989" + AREA, i.e. random.seed("1989COMBAT"))
  --after  instructions shown from the anchor on (default 10; 2 before are shown too)
Statements = lines inside ```pascal blocks carrying a `{ seg:off` anchor; the segment selects the listing (any
decode/listings/*.lst whose instructions use that segment). Output per statement: file line, anchor, statement, asm.
"""
import glob, math, os, random, re, sys

sys.stdout.reconfigure(encoding="utf-8")
R = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
args = sys.argv[1:]
if not args or args[0].startswith("-"):
    sys.exit(__doc__)
area = args.pop(0).upper()
n = pct = None; seed = "1989" + area; after = 10
while args:
    a = args.pop(0)
    if a == "--seed": seed = args.pop(0)
    elif a == "--after": after = int(args.pop(0))
    elif a == "-p": pct = float(args.pop(0))
    else: n = int(a)

lst = {}                                   # seg -> [(off, text)]
for f in sorted(glob.glob(os.path.join(R, "decode/listings/*.lst"))):
    for ln in open(f, encoding="latin-1"):
        m = re.match(r"^  ([0-9a-f]{4}):([0-9a-f]{4})  [0-9a-f]+\s+(.*)$", ln.rstrip())
        if m: lst.setdefault(m.group(1), []).append((int(m.group(2), 16), re.sub(r"\s+", " ", m.group(3))))
for v in lst.values(): v.sort()
pos = {seg: {o: i for i, (o, _) in enumerate(v)} for seg, v in lst.items()}

rows, inpas = [], False
for no, ln in enumerate(open(os.path.join(R, "decode/pseudo/%s.pas.md" % area), encoding="utf-8"), 1):
    if ln.startswith("```"):
        inpas = ln.startswith("```pascal") and not inpas; continue
    if not inpas: continue
    m = re.search(r"\{ ?([0-9a-fA-F]{4}):([0-9a-fA-F]{4})", ln)
    if m: rows.append((no, m.group(1).lower(), int(m.group(2), 16), ln.strip()))
k = n if n is not None else math.ceil(len(rows) * (pct if pct is not None else 10) / 100)
random.seed(seed)
smp = sorted(random.sample(rows, min(k, len(rows))))
print("%s: %d anchored statements, %d sampled, seed %r" % (area, len(rows), len(smp), seed))
for no, seg, off, s in smp:
    print("=" * 100)
    print("L%d %s:%04x  %s" % (no, seg, off, s[:240]))
    i = pos.get(seg, {}).get(off)
    if i is None:
        print("    (anchor not an instruction start)"); continue
    for o, t in lst[seg][max(0, i - 2):i + after]:
        print("    %s%04x %s" % (">" if o == off else " ", o, t[:120]))
