"""Prepare inputs for the overlay-aware Ghidra project (CabBuild.java) - Curse of the Azure Bonds (TPOV).

Usage: python ghidra_prep.py START.EXE GAME.OVR OUTDIR

Writes OUTDIR/resident.bin  load module (START.EXE is not packed), every LIVE overlay stub entry
                            `CD 3F off 00` rewritten to `EA off ovseg` (JMP FAR to the unit's routine at its
                            analysis segment); dead entries (offset FFFF, TPOV) are left as they are.
       OUTDIR/ovNN.bin      overlay unit NN code (fixups need no change: resident base = 0000)
       OUTDIR/layout.txt    one line per block, read by CabBuild.java:
            R <seg> <size> <name>                         resident segment (bytes from resident.bin)
            B <seg> <size> <name>                         uninitialised (stack)
            O <idx> <seg> <size> <stubseg> <e0,e1,...>    overlay unit; a dead entry is written as '-'
            E <seg:off> <name>                            seed entry point
Analysis segments: units are placed back to back from OVBASE, each rounded up to a 0x100-paragraph boundary
(unit sizes range 0x65..0x68AC B, so Pool's uniform 0x500 step cannot be used). The mapping is in layout.txt
and decode/LAYOUT.md.
"""
import os, re, struct, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tpovl

OVBASE, OVALIGN = 0x2000, 0x100
DS, SS, SP = 0x0C1C, 0x150C, 0x2710
# resident unit segment starts (LAYOUT.md "Resident code segments"); stubs are separate segments
RES = [0x0000, 0x0186, 0x019B, 0x01A0, 0x020F, 0x0297, 0x0542, 0x0636, 0x06EA, 0x0713,
       0x097D, 0x097F, 0x09AB, 0x0A0D, 0x0A54]
RES_NAMES = {0x0000: "main", 0x097F: "dos", 0x09AB: "crt", 0x0A0D: "overlay", 0x0A54: "system"}
MAIN_END = 0x0039  # first stub segment


def unit_segments(units):
    segs, seg = [], OVBASE
    for u in units:
        segs.append(seg)
        paras = (u["code_size"] + 15) // 16
        seg = (seg + paras + OVALIGN - 1) // OVALIGN * OVALIGN
    return segs


def main():
    exe, ovr, out = sys.argv[1:4]
    os.makedirs(out, exist_ok=True)
    m, o, _, units, _, magic = tpovl.parse(exe, ovr)
    img = bytearray(m["lm"])
    lines = []
    stub_ranges = []
    segs = unit_segments(units)
    for i, u in enumerate(units):
        seg = segs[i]
        base = u["stub_seg"] * 16
        for k, e in enumerate(u["entries"]):
            q = base + 0x20 + 5 * k
            assert img[q:q + 2] == b"\xCD\x3F"
            if e == 0xFFFF:
                continue
            img[q:q + 5] = b"\xEA" + struct.pack("<HH", e, seg)
        stub_ranges.append((u["stub_seg"], u["stub_size"]))
        open(os.path.join(out, "ov%02d.bin" % i), "wb").write(
            o[u["file_ofs"]:u["file_ofs"] + u["code_size"]])
    img_end = len(img) // 16
    img += bytes((SS - img_end) * 16)  # DS bss zero-filled so all DS data is one block at DS
    open(os.path.join(out, "resident.bin"), "wb").write(img)
    starts = sorted(set(RES) | {s for s, _ in stub_ranges} | {DS})
    stubset = {s: i for i, (s, _) in enumerate(stub_ranges)}
    for j, s in enumerate(starts):
        e = starts[j + 1] if j + 1 < len(starts) else img_end
        if s == 0x0000:
            e = MAIN_END
        if s in stubset:
            name = "stub_ov%02d" % stubset[s]
            size = stub_ranges[stubset[s]][1]
        elif s == DS:
            name, size = "dseg", (SS - s) * 16
        else:
            name = "res_%04X" % s if s not in RES_NAMES else "%s_%04X" % (RES_NAMES[s], s)
            size = (e - s) * 16
        lines.append("R %04X %X %s" % (s, size, name))
    lines.append("B %04X %X %s" % (SS, SP, "stack"))
    for i, u in enumerate(units):
        lines.append("O %d %04X %X %04X %s" % (i, segs[i], u["code_size"], u["stub_seg"],
                                                ",".join("-" if e == 0xFFFF else "%X" % e for e in u["entries"])))
    lines.append("E %04X:%04X entry" % (m["cs"], m["ip"]))
    rtn = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "names", "rt_names.json")
    if os.path.exists(rtn):
        import json
        for a, n in sorted(json.load(open(rtn)).items()):
            lines.append("E %s %s" % (a, re.sub(r"[^A-Za-z0-9_]", "_", n)))
    open(os.path.join(out, "layout.txt"), "w", newline="\n").write("\n".join(lines) + "\n")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
