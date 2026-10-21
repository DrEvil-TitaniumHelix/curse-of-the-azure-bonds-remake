"""Check that every `{ seg:off` anchor (and `/ off` follow-ups) in a pseudocode file is an instruction start in the
listings (cab-rt). Usage: python -I anchorcheck.py decode/pseudo/RESIDENT.pas.md [SEG ...]"""
import glob, os, re, sys
R = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
ins = set()
for f in glob.glob(os.path.join(R, "decode/listings/*.lst")):
    for ln in open(f, encoding="latin-1"):
        m = re.match(r"^  ([0-9a-f]{4}:[0-9a-f]{4})  ", ln)
        if m: ins.add(m.group(1))
# code Ghidra did not make functions of (timer-driven sound routines): linear decode of the image (start, end)
LINEAR = {"0713": (0x21F0, 0x2698)}
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mz
from capstone import Cs, CS_ARCH_X86, CS_MODE_16
_lm = mz.load(os.path.join(R, "decode/bin/START.EXE"))["lm"]
for _seg, (_a, _b) in LINEAR.items():
    _base = int(_seg, 16) * 16
    for _i in Cs(CS_ARCH_X86, CS_MODE_16).disasm(_lm[_base + _a:_base + _b], _a):
        ins.add("%s:%04x" % (_seg, _i.address))
segs = {s.lower() for s in sys.argv[2:]}
bad = n = 0
for no, ln in enumerate(open(sys.argv[1], encoding="utf-8"), 1):
    for m in re.finditer(r"\{ ?([0-9a-f]{4}):([0-9a-f]{4})((?:\s*/\s*[0-9a-f]{4})*)", ln):
        seg = m.group(1)
        if segs and seg not in segs: continue
        offs = [m.group(2)] + re.findall(r"[0-9a-f]{4}", m.group(3))
        for o in offs:
            n += 1
            if seg + ":" + o not in ins:
                bad += 1; print("L%d %s:%s not an instruction start" % (no, seg, o))
print("anchors %d, bad %d" % (n, bad))
