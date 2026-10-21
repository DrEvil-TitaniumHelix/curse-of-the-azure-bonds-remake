"""Turbo Pascal overlay layout: FBOV (TP 5.5-7.0, Pool of Radiance) and TPOV (TP 5.0, Curse of the Azure Bonds).

Usage: python tpovl.py START.EXE GAME.OVR [--json out.json] [--extract DIR] [--units]

GAME.OVR header (evidence in decode/LAYOUT.md):
  FBOV: 'FBOV' + dword (file size - 8); unit data starts at 8.
  TPOV: 'TPOV' only (4 bytes); unit data starts at 4 (Curse: first unit FileOfs = 4, bytes 4.. = its code).
Then per unit, back to back: code[CodeSize] + fixups[FixupSize]. Each fixup word = offset in the unit code of a
16-bit image-relative segment value (runtime adds PrefixSeg+10h, same as MZ relocations).

Overlay stub segment (one per overlaid unit, in the resident image, paragraph aligned):
  +00 CD 3F        INT 3Fh (overlay manager trap)
  +02 word         ReturnAddr (runtime, 0 on disk)
  +04 dword        FileOfs   absolute offset of the unit's code in GAME.OVR
  +08 word         CodeSize
  +0A word         FixupSize (bytes; 2 bytes per fixup)
  +0C word         EntryPts  (count)
  +0E word         CodeListNext (previous stub segment, image-relative; 0 = first)
  +10..+1F         runtime fields (LoadSeg, Reprieved, LoadListNext, ...) 0 on disk
  +20 + 5*i        entry i: CD 3F <word offset into unit code> 00
TPOV delta: an entry offset of FFFF is a dead slot (no routine; Curse has 42 of them) - the stub still occupies
5 bytes, the resident caller never references it. Entry 0 of a unit with a non-FFFF offset is the unit init
(called from the main program's init chain).
"""
import json, os, struct, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mz

HEADERS = {b"FBOV": 8, b"TPOV": 4}


def parse(exe, ovr):
    m = mz.load(exe)
    lm = m["lm"]
    o = open(ovr, "rb").read()
    magic = o[:4]
    assert magic in HEADERS, "not a TP overlay file: %r" % magic
    data_start = HEADERS[magic]
    ovr_len = struct.unpack_from("<I", o, 4)[0] if magic == b"FBOV" else len(o) - 4
    stubs = []
    # stubs are paragraph aligned; scan for valid headers
    for p in range(0, len(lm) - 0x20, 16):
        if lm[p:p + 2] != b"\xCD\x3F" or lm[p + 2:p + 4] != b"\0\0":
            continue
        fofs, csz, fsz, nent, nxt = struct.unpack_from("<IHHHH", lm, p + 4)
        if not (data_start <= fofs < len(o) and nent and fofs + csz + fsz <= len(o)):
            continue
        if lm[p + 0x10:p + 0x20] != bytes(16):
            continue
        ents = []
        for i in range(nent):
            q = p + 0x20 + 5 * i
            if lm[q:q + 2] != b"\xCD\x3F" or lm[q + 4] != 0:
                break
            ents.append(struct.unpack_from("<H", lm, q + 2)[0])
        if len(ents) != nent:
            continue
        code = o[fofs:fofs + csz]
        fix = [struct.unpack_from("<H", o, fofs + csz + 2 * i)[0] for i in range(fsz // 2)]
        fixsegs = sorted(set(struct.unpack_from("<H", code, f)[0] for f in fix))
        live = [e for e in ents if e != 0xFFFF]
        stubs.append(dict(stub_seg=p // 16, file_ofs=fofs, code_size=csz, fixup_size=fsz,
                          n_fixups=len(fix), entries=ents, live_entries=len(live), code_list_next=nxt,
                          stub_size=0x20 + 5 * nent, fixups=fix, fixup_target_segs=fixsegs))
    stubs.sort(key=lambda s: s["file_ofs"])
    # resident segments: every segment value named by an MZ relocation
    rel_targets = sorted(set(struct.unpack_from("<H", lm, s * 16 + off)[0] for off, s in m["relocs"]))
    return m, o, ovr_len, stubs, rel_targets, magic.decode()


def main():
    a = [x for x in sys.argv[1:] if not x.startswith("--")]
    m, o, ovr_len, stubs, rel_targets, magic = parse(a[0], a[1])
    stub_segs = {s["stub_seg"] for s in stubs}
    print("%s payload length %#x (file %#x), data start %d" % (magic, ovr_len, len(o), HEADERS[magic.encode()]))
    print("overlay units: %d, stub entries: %d (live %d, FFFF %d), code bytes: %#x, fixup bytes: %#x" % (
        len(stubs), sum(len(s["entries"]) for s in stubs), sum(s["live_entries"] for s in stubs),
        sum(len(s["entries"]) - s["live_entries"] for s in stubs),
        sum(s["code_size"] for s in stubs), sum(s["fixup_size"] for s in stubs)))
    end = HEADERS[magic.encode()]
    ok = True
    for i, s in enumerate(stubs):
        gap = s["file_ofs"] - end
        ok &= gap == 0
        end = s["file_ofs"] + s["code_size"] + s["fixup_size"]
        print("ov%02d stub %04X fofs %06X code %04X fix %3d ent %3d(live %3d) next %04X gap %d tseg %s" % (
            i, s["stub_seg"], s["file_ofs"], s["code_size"], s["n_fixups"], len(s["entries"]), s["live_entries"],
            s["code_list_next"], gap, " ".join("%04X%s" % (t, "s" if t in stub_segs else "")
                                               for t in s["fixup_target_segs"])))
    print("end of last unit %#x, file %#x -> %s" % (end, len(o), "every byte accounted for" if ok and end == len(o) else "MISMATCH"))
    print("resident reloc target segs:", " ".join("%04X%s" % (t, "s" if t in stub_segs else "")
                                                    for t in rel_targets))
    if "--json" in sys.argv:
        out = sys.argv[sys.argv.index("--json") + 1]
        json.dump(dict(magic=magic, ovr_payload_len=ovr_len, units=stubs, reloc_target_segs=rel_targets),
                  open(out, "w"), indent=1)
    if "--extract" in sys.argv:
        d = sys.argv[sys.argv.index("--extract") + 1]
        os.makedirs(d, exist_ok=True)
        for i, s in enumerate(stubs):
            open(os.path.join(d, "ov%02d_%04X.bin" % (i, s["stub_seg"])), "wb").write(
                o[s["file_ofs"]:s["file_ofs"] + s["code_size"]])


if __name__ == "__main__":
    main()
