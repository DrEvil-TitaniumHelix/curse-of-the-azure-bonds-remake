"""Export decode/tools/ecldis.py's static decoding of every ECL record as JSON (test oracle for ecl.js).
Usage: python -I game/test/ecl/ecldis_export.py OUT.json   (reads decode/bin/dax/ECLn/*.bin, as ecldis --all)"""
import json, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
sys.path.insert(0, os.path.join(ROOT, "decode", "tools"))
import ecldis

out = {}
bindir = os.path.join(ROOT, "decode", "bin", "dax")
for n in range(1, 7):
    d = os.path.join(bindir, "ECL%d" % n)
    for f in sorted(os.listdir(d), key=lambda s: int(s.split(".")[0])):
        rid = int(f.split(".")[0])
        code = ecldis.load(os.path.join(d, f))
        vec, insns, labels = ecldis.trace(code)
        out["%d/%d" % (n, rid)] = {
            "size": code.end - ecldis.BASE,
            "vec": vec,
            "insns": {str(pc): [op, npc, [[o.type, o.lo, o.hi, o.text] for o in ops], name is None]
                      for pc, (op, name, ops, npc) in insns.items()},
        }
out["_ops"] = {str(k): v[1] for k, v in ecldis.OPS.items()}
out["_var"] = {str(k): v for k, v in ecldis.VARCOUNT.items()}
json.dump(out, open(sys.argv[1], "w"))
print("records", len(out) - 2, "insns", sum(len(r["insns"]) for k, r in out.items() if not k.startswith("_")))
