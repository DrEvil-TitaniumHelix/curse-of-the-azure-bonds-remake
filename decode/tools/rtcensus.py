"""Turbo Pascal runtime census + shape match against Pool of Radiance's verified ledger (cab-rt).

Usage: python -I rtcensus.py CURSE_START.EXE CURSE_GAME.OVR POOL_START.unpacked.exe POOL_GAME.OVR POOL_rt_names.json OUT.json

1. Far sites: every MZ relocation / overlay fixup whose segment word names a runtime segment and sits behind a
   9A (CALL FAR) or EA (JMP FAR) opcode -> entry target + caller unit. Other relocations naming a runtime segment
   (far pointers in code: vectors, callbacks) are listed as 'refs'.
2. Near closure: from every entry, follow near CALL/Jcc/JMP inside the runtime segment (capstone, 16-bit);
   near CALL targets become entries; unique near CALL sites are counted.
3. Shape match: tokens = mnemonic + operands with every number replaced by '#', first 24 linear instructions.
   Score = length of the common token prefix (+ bonus when both stop at the same RET). Curse and Pool entries of
   each unit pair are aligned monotonically (same library object order) by dynamic programming.
"""
import json, os, struct, sys, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tpovl
from capstone import Cs, CS_ARCH_X86, CS_MODE_16

md = Cs(CS_ARCH_X86, CS_MODE_16)
NUM = re.compile(r"0x[0-9a-f]+|\b\d+\b")


def segs_of(lm, segs):
    """segs: {name: (start, end)} -> bytes per segment"""
    return {s: lm[a * 16:b * 16] for s, (a, b) in segs.items()}


def far_sites(m, stubs, rt, unit_of):
    lm = m["lm"]
    sites, refs = [], []
    def check(buf, pos, caller):
        v = struct.unpack_from("<H", buf, pos)[0]
        if v not in rt or pos < 3:
            return
        off = struct.unpack_from("<H", buf, pos - 2)[0]
        op = buf[pos - 3]
        if op in (0x9A, 0xEA):
            sites.append(dict(target="%04X:%04X" % (v, off), caller=caller, at=pos - 3, op="call" if op == 0x9A else "jmp"))
        else:
            refs.append(dict(seg="%04X" % v, caller=caller, at=pos, ctx=buf[max(0, pos - 6):pos + 4].hex(" ")))
    for off, s in m["relocs"]:
        p = s * 16 + off
        check(lm, p, unit_of(p // 16, p % 16))
    for i, st in enumerate(stubs):
        code = m["ovr"][st["file_ofs"]:st["file_ofs"] + st["code_size"]]
        for f in st["fixups"]:
            check(code, f, "ov%02d:%04X" % (i, f - 3))
    return sites, refs


def insns(buf, off, n=400):
    return list(md.disasm(buf[off:off + n], off))


def closure(buf, entries):
    """follow near flow from entries; return (insn starts, near call edges {target: set(sites)})"""
    seen, calls, todo = set(), {}, list(entries)
    while todo:
        o = todo.pop()
        while 0 <= o < len(buf) and o not in seen:
            seen.add(o)
            ins = next(md.disasm(buf[o:o + 16], o), None)
            if ins is None:
                break
            mn = ins.mnemonic
            tgt = None
            if ins.op_str.startswith("0x") and (mn.startswith("j") or mn == "call" or mn.startswith("loop")) and ":" not in ins.op_str:
                try:
                    tgt = int(ins.op_str, 16)
                except ValueError:
                    tgt = None
            if mn == "call" and tgt is not None:
                calls.setdefault(tgt, set()).add(o)
                todo.append(tgt)
            elif mn == "jmp":
                if tgt is not None:
                    todo.append(tgt)
                break
            elif tgt is not None:
                todo.append(tgt)
            if mn in ("ret", "retf", "iret") or (mn == "jmp" and tgt is None) or mn == "ljmp":
                break
            o += ins.size
    return seen, calls


def tokens(buf, off, n=24):
    out = []
    for ins in md.disasm(buf[off:off + 160], off):
        out.append(ins.mnemonic + " " + NUM.sub("#", ins.op_str))
        if len(out) >= n:
            break
    return out


def score(a, b):
    k = 0
    for x, y in zip(a, b):
        if x != y:
            break
        k += 1
        if x.split()[0] in ("ret", "retf", "iret"):
            return k + 4
    return k


def align(cl, pl, S, thr=2):
    """monotone alignment maximising sum of scores >= thr"""
    n, mm = len(cl), len(pl)
    D = [[0] * (mm + 1) for _ in range(n + 1)]
    B = [[None] * (mm + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        for j in range(1, mm + 1):
            best, bk = D[i - 1][j], "u"
            if D[i][j - 1] > best:
                best, bk = D[i][j - 1], "l"
            s = S[i - 1][j - 1]
            if s >= thr and D[i - 1][j - 1] + s > best:
                best, bk = D[i - 1][j - 1] + s, "d"
            D[i][j], B[i][j] = best, bk
    i, j, pairs = n, mm, {}
    while i and j:
        bk = B[i][j]
        if bk == "d":
            pairs[cl[i - 1]] = (pl[j - 1], S[i - 1][j - 1]); i -= 1; j -= 1
        elif bk == "u":
            i -= 1
        else:
            j -= 1
    return pairs


# entries proven from other evidence (vector/hook stores; decode/rt/RT_LEDGER.md cites them)
EXTRA = {"Overlay": [0x01B0, 0x01DF, 0x0248]}


def load(exe, ovr):
    m, o, _, stubs, _, magic = tpovl.parse(exe, ovr)
    m["ovr"] = o
    return m, stubs


def main():
    cexe, covr, pexe, povr, pnames, out = sys.argv[1:7]
    C_RT = {"Dos": (0x097F, 0x09AB), "Crt": (0x09AB, 0x0A0D), "Overlay": (0x0A0D, 0x0A54), "System": (0x0A54, 0x0C1C)}
    P_RT = {"Dos": (0x0A32, 0x0A40), "Crt": (0x0A40, 0x0AA2), "Overlay": (0x0AA2, 0x0AF8), "System": (0x0AF8, 0x0C7C)}
    C_RES = [0x0000, 0x0186, 0x019B, 0x01A0, 0x020F, 0x0297, 0x0542, 0x0636, 0x06EA, 0x0713, 0x097D, 0x097F, 0x09AB, 0x0A0D, 0x0A54]
    cm, cst = load(cexe, covr)
    pm, pst = load(pexe, povr)
    stubsegs = {s["stub_seg"]: i for i, s in enumerate(cst)}

    def unit_of(seg, off):
        best = max([r for r in C_RES if r <= seg] + [s for s in stubsegs if s <= seg])
        if best in stubsegs:
            return "stub_ov%02d" % stubsegs[best]
        return "%04X:%04X" % (best, (seg - best) * 16 + off)

    rtsegs = {a for a, b in C_RT.values()}
    sites, refs = far_sites(cm, cst, rtsegs, unit_of)
    lm = cm["lm"]
    plm = pm["lm"]
    pn = json.load(open(pnames))
    res = {"units": {}, "refs": refs}
    for u, (a, b) in C_RT.items():
        buf = lm[a * 16:b * 16]
        far = {}
        for s in sites:
            sg, of = s["target"].split(":")
            if int(sg, 16) == a:
                far.setdefault(int(of, 16), []).append(s["caller"])
        pa, pb = P_RT[u]
        pbuf = plm[pa * 16:pb * 16]
        pents = sorted(int(k.split(":")[1], 16) for k in pn if int(k.split(":")[0], 16) == pa)
        pt = {e: tokens(pbuf, e) for e in pents}
        # shape scan: Pool entries (callbacks, linked-but-uncalled routines) located at any Curse offset
        seeds = {}
        for p in pents:
            best, bo, tie = 0, None, False
            for o in range(len(buf)):
                if buf[o] in (0x00,):
                    continue
                sc = score(tokens(buf, o, len(pt[p])), pt[p])
                if sc > best:
                    best, bo, tie = sc, o, False
                elif sc == best and sc:
                    tie = True
            if best >= 8 and not tie:
                seeds[bo] = "%04X:%04X" % (pa, p)
        seen, ncalls = closure(buf, list(far) + list(seeds) + EXTRA.get(u, []))
        ents = sorted(set(far) | set(ncalls) | set(seeds) | set(EXTRA.get(u, [])))
        ct = {e: tokens(buf, e) for e in ents}
        S = [[score(ct[c], pt[p]) for p in pents] for c in ents]
        pairs = align(ents, pents, S, thr=4)
        used = {v[0] for v in pairs.values()}
        for i, e in enumerate(ents):       # unordered rescue: unique best >= 8 (TP 5 vs 6 object order differs)
            if e in pairs or not pents:
                continue
            row = S[i]
            bj = max(range(len(pents)), key=lambda j: row[j])
            if row[bj] >= 8 and row.count(row[bj]) == 1 and pents[bj] not in used:
                pairs[e] = (pents[bj], row[bj]); used.add(pents[bj])
        rows = []
        for e in ents:
            pm_ = pairs.get(e)
            prow = None
            if pm_:
                pk = "%04X:%04X" % (pa, pm_[0])
                prow = dict(addr=pk, name=pn[pk], score=pm_[1], ntok=len(pt[pm_[0]]))
            # best unaligned candidate for review
            i = ents.index(e)
            bj = max(range(len(pents)), key=lambda j: S[i][j]) if pents else None
            rows.append(dict(addr="%04X:%04X" % (a, e), seed=seeds.get(e) or ("extra" if e in EXTRA.get(u, []) else None), sig=buf[e:e + 12].hex(" "), far=len(far.get(e, [])),
                             far_callers=sorted(set(far.get(e, []))), near=len(ncalls.get(e, ())),
                             pool=prow, best=dict(addr="%04X:%04X" % (pa, pents[bj]), name=pn["%04X:%04X" % (pa, pents[bj])], score=S[i][bj]) if bj is not None else None,
                             tok=ct[e][:6]))
        res["units"][u] = dict(seg="%04X" % a, size=len(buf), insn_reached=len(seen), entries=rows)
    json.dump(res, open(out, "w"), indent=1)
    for u, d in res["units"].items():
        print(u, d["seg"], "entries", len(d["entries"]), "matched", sum(1 for r in d["entries"] if r["pool"]), "far sites", sum(r["far"] for r in d["entries"]))
    print("refs", len(refs))


if __name__ == "__main__":
    main()
