"""Shape-match Curse resident game units against their Pool twins (cab-rt; same token/score/align as rtcensus.py).

Usage: python -I resmatch.py CURSE_START.EXE functions.tsv POOL_START.unpacked.exe POOL_names_dir
Curse entries = Ghidra function starts of each unit (decode/listings/functions.tsv); Pool entries = every name in the
Pool names json files for the twin segment. Prints: curse addr, bytes, pool name, score (token prefix; +4 = same RET).
"""
import csv, glob, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mz
from rtcensus import tokens, score, align

TWINS = {0x01A0: (0x020F, 0x03F1, 0x042B), 0x020F: (0x0297, 0x042B, 0x0464), 0x0297: (0x0542, 0x0464, 0x0709),
         0x0542: (0x0636, 0x0709, 0x0802), 0x0636: (0x06EA, 0x0802, 0x0899), 0x06EA: (0x0713, 0x0899, 0x08AE),
         0x0713: (0x097D, 0x08AE, 0x0A31)}


def main():
    cexe, tsv, pexe, pdir = sys.argv[1:5]
    lm, plm = mz.load(cexe)["lm"], mz.load(pexe)["lm"]
    rows = list(csv.DictReader(open(tsv, encoding="utf-8"), delimiter="\t"))
    pn = {}
    for f in sorted(glob.glob(os.path.join(pdir, "*.json"))):
        for k, v in json.load(open(f)).items():
            pn[k.upper()] = v
    for seg, (end, pseg, pend) in TWINS.items():
        buf, pbuf = lm[seg * 16:end * 16], plm[pseg * 16:pend * 16]
        ents = sorted(int(r["addr"].split(":")[1], 16) for r in rows if int(r["addr"].split(":")[0], 16) == seg)
        pents = sorted(int(k.split(":")[1], 16) for k in pn if ":" in k and int(k.split(":")[0], 16) == pseg)
        if not pents:
            continue
        ct = {e: tokens(buf, e) for e in ents}
        pt = {e: tokens(pbuf, e) for e in pents}
        S = [[score(ct[c], pt[p]) for p in pents] for c in ents]
        pairs = align(ents, pents, S, thr=6)
        print("== %04X vs Pool %04X: %d functions, %d Pool names, %d matched" % (seg, pseg, len(ents), len(pents), len(pairs)))
        for e in ents:
            if e in pairs:
                p, s = pairs[e]
                print("  %04X:%04X  %-28s %04X:%04X score %d" % (seg, e, pn["%04X:%04X" % (pseg, p)], pseg, p, s))


if __name__ == "__main__":
    main()
