"""DS (0C1C) globals cross-reference from the Ghidra listings (ported from Pool by cab-rt).

Usage: python -I globals.py         -> decode/GLOBALS.md, decode/names/globals.json, decode/globals_xref.tsv
Pool equivalents: functions present in both games (same real name in decode/names vs Pool's names, or a unique
instruction-shape match >= 16 tokens) are aligned instruction by instruction (difflib on mnemonic + operands with numbers masked); every aligned
pair of DS operands votes Curse offset -> Pool offset. Needs ../PoolRadianceRE (read-only).

Reference kinds (parsed from decode/listings/*.lst, Ghidra x86 real mode, DS context = 0C1C):
  direct   [0xN] with no segment override (DS default)                         conf H
  indexed  [BX|SI|DI + 0xN] with no override and no BP (DS default): array base  conf M
  addr     MOV r16,0xN adjacent (+-2 instr) to PUSH DS: address of a global
           passed as var/pointer argument (TP `push ds; push di`)                  conf M
Functions that load DS themselves (MOV DS,/LDS) are flagged: their refs may not be DS 0C1C (conf L).
Access: W = MOV-type store, RW = read-modify-write, R = read (incl. CMP/TEST/PUSH/LES/LDS), A = address taken.
"""
import collections, glob, json, os, re, struct, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mz

R = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
DS, DSEND, INIT = 0x0C1C, 0x8F00, 0x47E0   # dseg size (SS 150C - DS)*16; initialised part from the image
lm = mz.load(os.path.join(R, "decode/bin/START.EXE"))["lm"]
POOL = os.path.normpath(os.path.join(R, "..", "PoolRadianceRE"))
dsimg = lm[DS * 16:DS * 16 + INIT]

# names with byte evidence (System/Crt/Overlay variables, verified in decode/rt/RT_LEDGER.md pass)
EVID = {
    0x47A2: ("OvrCodeList", "head of the stub chain (+0Eh links, LAYOUT.md); System/Overlay use", "M"),
    0x47A4: ("OvrHeapSize", "OvrSetBuf minimum (0A0D:0169 CMP AX,[47A4])", "M"),
    0x47A6: ("OvrDebugPtr", "far proc ptr called by @Int3F after a load if non-nil (0A0D:0288..0291)", "H"),
    0x47AA: ("OvrHeapOrg", "OvrGetBuf = [47AE]-[47AA]; OvrClearBuf copies it to OvrHeapPtr", "H"),
    0x47AC: ("OvrHeapPtr", "load position of the ring buffer (0A0D:02C4, 0368)", "H"),
    0x47AE: ("OvrHeapEnd", "OvrGetBuf; OvrSetBuf stores the new end", "H"),
    0x47B0: ("OvrLoadList", "OvrSetBuf refuses if <>0; OvrClearBuf/02A4 walk it via ES:[14h]", "H"),
    0x47B2: ("OvrDosHandle", "OvrInit stores the handle; default reader 0A0D:01E0 MOV BX,[47B2]", "H"),
    0x47B6: ("HeapOrg", "far ptr (seg 47B8); OvrSetBuf requires HeapOrg = HeapPtr; free core bounds check", "H"),
    0x47BA: ("HeapPtr", "far ptr (seg 47BC); MemAvail/alloc core", "H"),
    0x47BE: ("FreePtr", "far ptr (seg 47C0 = PSP:[2]-1000h in System.Init); TP 4-5.5 free list grows down from it", "H"),
    0x47C2: ("FreeMin", "word; heap free-list grow check (0A54:05D6)", "M"),
    0x47C4: ("HeapError", "far proc ptr; GetMem calls it when non-nil (0A54:0334..0340)", "H"),
    0x47D2: ("PrefixSeg", "System.Init stores the PSP (0A54:0006 MOV [47D2],ES)", "H"),
    0x47D6: ("InOutRes", "IOResult XCHG with 0; @IOCheck tests it; text open sets 66h/67h", "H"),
    0x47D8: ("RandSeed", "LongInt; Randomize (AH=2C) stores CX/DX, @NextRandom LCG", "H"),
    0x47DC: ("FileMode", "byte; ResetFile `A0 DC 47` = AL for AH=3D", "H"),
    0x8C98: ("DosError", "FindFirst/FindNext tail 097F:016A stores AX / 0", "H"),
    0x8CA0: ("TextAttr", "Crt.ClrScr BH for AH=06 scroll", "H"),
    0x8CA2: ("WindMin", "Crt.ClrScr CX; cursor home", "H"),
    0x8CA4: ("WindMax", "Crt.ClrScr DX", "H"),
    0x8CA6: ("Crt_DelayCnt", "Crt.Delay per-ms loop count (calibrated in Crt init)", "H"),
    0x8CAB: ("Crt_ScanCode", "Crt.ReadKey buffered extended scan code; KeyPressed tests it", "H"),
    0x8CAC: ("Crt_BreakFlag", "Ctrl-Break pending flag tested by 09AB:0145", "M"),
    0x8CAE: ("OvrResult", "OvrSetBuf/OvrClearBuf store 0; OvrInit result", "H"),
    0x8CB0: ("OvrReadBuf", "near proc ptr; the loader calls [8CB0] (0A0D:039E), OvrInit stores 01DF", "H"),
    # globals request #3 (cab-mod-magic) + cab-verify COMBAT: element 0 of a 1-based array is a separate variable
    0x4FBE: ("opt_Pics", "camp Pics on/off toggle (ov15 4000:1E9A test / 1EA7 store); Pool vote was opt_MonsterPics", "M"),
    0x4FBF: ("opt_Animation", "camp Animation on/off toggle (ov15 4000:1EB0 test / 1EBD store); Pool vote was opt_Portraits", "M"),
    0x758E: ("combat_MaxRounds", "scalar: ov08 EndOfRound 2F00:0A84 CMP AL(CombatRound),[758E]; ov13 3A00:19E8 stores CombatRound+0Fh; foe_List is the 1-based byte array from 758F ([DI+758E], i >= 1)", "M"),
    0x758F: ("foe_List", "1-based byte array of combatant indexes, indexed [DI+758E] with i = 1..n (COMBAT)", "M"),
    0x6E94: ("cm_Map_hi", "segment word of the cm_Map far pointer (PUSH [6E94] / PUSH [6E92]; ov08 EndCombat 2F00:00CD..00D0 zeroes both)", "H"),
    # cab-crossref §3: shared globals named in the pseudo files / ECL_VM.md §6 without a names-file entry
    0x47E1: ("ecl_Restart", "ECL_VM.md §6 Stop / Restart pair (47E0 ecl_Stop); set by NEW ECL, tested by ecl_RunAfterNewBlock 2200:36dd", "H"),
    0x75FE: ("ecl_LastOp", "ECL_VM.md §6; ecl_Run 2200:3641 `ecl_LastOp := ecl_CurOp`", "H"),
    0x4FAA: ("ecl_VecA", "ECL_VM.md §6 vectors A..E (4FAA..4FB2); ecl_GameLoop runs it before the move (2200:3964)", "H"),
    0x4FAC: ("ecl_VecB", "ECL_VM.md §6; ecl_GameLoop runs it after the move / for Look (2200:39f8, 3922)", "H"),
    0x8B5E: ("ecl_Block", "ECL_VM.md §6 current ECL block number; ecl_GameLoop 2200:37ca / 37d1 / 3857 (Mem[4BF2] := ecl_Block)", "H"),
    0x4FC1: ("DebugFlag", "ECL_VM.md §6 TraceFlag: ecl_Run 2200:3658 prints every opcode name (ov34) when <> 0", "H"),
    0x4FC2: ("Resuming", "ECL_VM.md §6: a loaded save is being resumed (ecl_GameLoop 2200:3802 / 388f)", "H"),
    0x4FC7: ("PartyDead", "ECL_VM.md §6: ends ecl_Run (2200:363a) and the game loop (3a06); set by PROGRAM 3, DAMAGE, AfterCombat", "H"),
    0x4FE6: ("VideoMode", "0 = CGA, 1 = EGA ... (RESIDENT startup configuration; VIEW frame-size test 6c00:03c3, COMBAT finale 4e00:006d)", "M"),
    0x7685: ("ecl_OpType", "ECL_VM.md §6 operand arrays OpType/OpHi/OpLo[i], 40h apart", "H"),
    0x76C5: ("ecl_OpHi", "ECL_VM.md §6 operand arrays (7685 + 40h)", "H"),
    0x7705: ("ecl_OpLo", "ECL_VM.md §6 operand arrays (7685 + 80h)", "H"),
    0x25C0: ("snd_Step", "sound word played for a party step (ecl_GameLoop 2200:39e4, VIEW StepForward3D, COMBAT 3a00:091e combatant move)", "M"),
    0x37DB: ("spells_Table_level", "spells_Table (37DA, 16-byte records by spell id) +1: spell level (MAGIC Spell table `lvl`)", "M"),
    0x37DC: ("spells_Table_range", "spells_Table +2: range (MAGIC `range`; FFh = touch, 5800:0fe1)", "M"),
    0x37E0: ("spells_Table_target", "spells_Table +6: target code, low nibble (COMBAT 3a00:2262 `and 0Fh`)", "M"),
    0x37E2: ("spells_Table_harmless", "spells_Table +8 (COMBAT name `harmless`, M)", "M"),
    0x37E3: ("spells_Table_saveType", "spells_Table +9: saving-throw type (COMBAT, AiSpellUseful 3100:0390)", "M"),
    0x37E4: ("spells_Table_effect", "spells_Table +0Ah: effect type given (MAGIC Spell table `eff`)", "M"),
    0x37E7: ("spells_Table_aiValue", "spells_Table +0Dh: AI value (COMBAT AiSpellUseful 3100:03c6)", "M"),
    0x37E8: ("spells_Table_needsTarget", "spells_Table +0Eh (COMBAT AiSpellUseful 3100:03e3)", "M"),
    0x37E9: ("spells_Table_areaSize", "spells_Table +0Fh (COMBAT 3100:0434 / 02f9)", "M"),
    0x5CF7: ("ItemTypeTable_hands", "ItemTypeTable (5CF6, 16-byte records by item type) +1: hands (COMBAT 3100:1687)", "M"),
    0x5D02: ("ItemTypeTable_range", "ItemTypeTable +0Ch: range (COMBAT 3100:0eea, PARTY ov24)", "M"),
    0x5D03: ("ItemTypeTable_usableBy", "ItemTypeTable +0Dh: class mask of the users (COMBAT 3100:178c)", "M"),
    0x5D04: ("ItemTypeTable_wflags2", "ItemTypeTable +0Eh: weapon flags (2 = missile/DEX, 8 / 10h = missile kinds; PARTY 6200:005f, COMBAT 3100:17d2)", "M"),
    0x6E97: ("tg_List", "1-based 3-byte records indexed [DI*3+6E94/6E95/6E96], i >= 1 (element 0 overlaps cm_Map_hi and tg_Count)", "M"),
}

EVSIZE = {0x47A6: 4, 0x47B6: 4, 0x47BA: 4, 0x47BE: 4, 0x47C4: 4, 0x47D8: 4}

WRITE = {"MOV", "POP", "STOSB", "STOSW"}
RMW = {"ADD", "SUB", "INC", "DEC", "OR", "AND", "XOR", "ADC", "SBB", "NEG", "NOT", "SHL", "SHR", "SAR",
       "RCL", "RCR", "ROL", "ROR", "XCHG"}
LINE = re.compile(r"^  ([0-9a-f]{4}):([0-9a-f]{4})  ([0-9a-f]+)\s+(\S+)\s*([^;]*?)\s*(?:;.*)?$")


def split_ops(s):
    out, depth, cur = [], 0, ""
    for c in s:
        if c == "[": depth += 1
        if c == "]": depth -= 1
        if c == "," and depth == 0:
            out.append(cur.strip()); cur = ""
        else:
            cur += c
    if cur.strip(): out.append(cur.strip())
    return out


def parse():
    refs = []   # (off, kind, size, access, unit, func, addr, text)
    dsfuncs = set()
    for f in sorted(glob.glob(os.path.join(R, "decode/listings/*.lst"))):
        unit = os.path.basename(f)[:-4]
        if unit == "stubs": continue
        func = None; ins = []
        for ln in open(f, encoding="latin-1"):
            if ln.startswith(";==== "):
                func = ln.split()[1]; continue
            m = LINE.match(ln.rstrip("\n"))
            if m: ins.append((func, m.group(1) + ":" + m.group(2), m.group(4), m.group(5)))
        for k, (fn, ad, mn, ops) in enumerate(ins):
            if mn == "LDS":
                dsfuncs.add((unit, fn))
            elif mn == "MOV" and ops.startswith("DS,"):
                reg = ops.split(",")[1].strip()
                prev = [ins[j][2] + " " + ins[j][3] for j in range(max(0, k - 3), k)]
                if ("MOV %s,0xc1c" % reg) not in prev:
                    dsfuncs.add((unit, fn))
        for k, (fn, ad, mn, ops) in enumerate(ins):
            ol = split_ops(ops)
            for i, op in enumerate(ol):
                if "[" not in op: continue
                if re.search(r"\b(ES|SS|CS):", op) or "BP" in op: continue
                inner = op[op.index("[") + 1:op.rindex("]")]
                nums = re.findall(r"0x([0-9a-f]+)", inner)
                regs = re.findall(r"\b(BX|SI|DI)\b", inner)
                if not nums: continue
                off = int(nums[0], 16)
                if "-" in inner or off >= DSEND: continue
                kind = "indexed" if regs else "direct"
                size = {"byte": 1, "word": 2, "dword": 4}.get(op.split()[0], 0)
                if mn in ("LES", "LDS"): size = 4
                if i == 0 and mn in WRITE: acc = "W"
                elif i == 0 and mn in RMW: acc = "RW"
                else: acc = "R"
                if mn == "XCHG": acc = "RW"
                refs.append((off, kind, size, acc, unit, fn, ad, mn + " " + ops))
            # address-taken: MOV r16,imm next to PUSH DS
            if mn == "MOV" and len(ol) == 2 and ol[0] in ("AX", "BX", "CX", "DX", "SI", "DI") and re.fullmatch(r"0x[0-9a-f]+", ol[1]):
                v = int(ol[1], 16)
                near = [ins[j][2] + " " + ins[j][3] for j in range(max(0, k - 2), min(len(ins), k + 3)) if j != k]
                if 0x40 <= v < DSEND and v != DS and "PUSH DS" in [x.strip() for x in near]:
                    refs.append((v, "addr", 0, "A", unit, fn, ad, mn + " " + ops))
    return refs, dsfuncs


def pstr(off):
    if off >= INIT: return None
    n = dsimg[off]
    if 2 <= n and off + 1 + n <= INIT and all(32 <= c < 127 for c in dsimg[off + 1:off + 1 + n]):
        return dsimg[off + 1:off + 1 + n].decode()
    return None


PH = re.compile(r"^(g_[0-9A-Fa-f]{4}(_hi|_[0-9A-Fa-f]+)?|RT_[0-9A-Fa-f]{4}_[0-9A-Fa-f]{4}|FUN_.*|DAT_.*|LAB_.*)$")


def lane_names():
    """Real DS names from other decode/names/*.json files (same precedence as PorExport: later file wins)."""
    out = {}
    for f in sorted(glob.glob(os.path.join(R, "decode/names/*.json"))):
        if os.path.basename(f) == "globals.json": continue
        for k, v in json.load(open(f)).items():
            ku = k.upper()
            if ku.startswith(("0C1C:", "DS:")) and not PH.match(v):
                out[int(ku.split(":")[1], 16)] = (v, os.path.basename(f))
    return out


NUMRE = re.compile(r"0x[0-9a-f]+")
DSOP = re.compile(r"(?<![A-Z]:)\[(?:(?:BX|SI|DI) \+ )?0x([0-9a-f]+)\]")


def read_funcs(root):
    """{name: [(mnemonic, operands)]} from <root>/decode/listings/*.lst (stubs excluded)."""
    out = {}
    for f in sorted(glob.glob(os.path.join(root, "decode/listings/*.lst"))):
        if f.endswith("stubs.lst"): continue
        cur = None
        for ln in open(f, encoding="latin-1"):
            if ln.startswith(";==== "):
                cur = out.setdefault(ln.split()[1], []); continue
            m = LINE.match(ln.rstrip(chr(10)))
            if m and cur is not None:
                cur.append((m.group(4), m.group(5)))
    return out


def dsoff(mn, ops):
    if "BP" in ops or re.search(r"(ES|SS|CS):", ops): return None
    m = DSOP.search(ops)
    return int(m.group(1), 16) if m else None


def poolmap():
    """Curse DS offset -> Counter(Pool DS offset) from aligned instructions of paired functions."""
    import difflib
    if not os.path.isdir(os.path.join(POOL, "decode/listings")): return {}, 0
    cf, pf = read_funcs(R), read_funcs(POOL)
    real = lambda n: not re.match(r"^(FUN_|LAB_|stub_|entry$|ov[0-9][0-9]_|thunk_)", n)
    pairs = [(n, n) for n in cf if real(n) and n in pf]
    shape = lambda ins: tuple(mn + " " + NUMRE.sub("#", o) for mn, o in ins[:16])
    pidx = collections.defaultdict(list)
    for n, ins in pf.items():
        if len(ins) >= 16: pidx[shape(ins)].append(n)
    named = {a for a, _ in pairs}
    for n, ins in cf.items():
        if n in named or len(ins) < 16: continue
        c = pidx.get(shape(ins), [])
        if len(c) == 1: pairs.append((n, c[0]))
    votes = collections.defaultdict(collections.Counter)
    for a, b in pairs:
        ca, pb = cf[a], pf[b]
        tok = lambda x: x[0] + " " + NUMRE.sub("#", x[1])
        sm = difflib.SequenceMatcher(None, [tok(x) for x in ca], [tok(x) for x in pb], autojunk=False)
        for blk in sm.get_matching_blocks():
            for k in range(blk.size):
                x, y = ca[blk.a + k], pb[blk.b + k]
                ox, oy = dsoff(*x), dsoff(*y)
                if ox is not None and oy is not None and ox < DSEND:
                    votes[ox][oy] += 1
    return votes, len(pairs)


def pool_names():
    out = {}
    for f in sorted(glob.glob(os.path.join(POOL, "decode/names/*.json"))):
        for k, v in json.load(open(f)).items():
            if k.upper().startswith("0C7C:"):
                o = int(k[5:], 16)
                if o not in out or not PH.match(v): out[o] = v
    return out


def main():
    refs, dsfuncs = parse()
    votes, npairs = poolmap()
    pnames = pool_names()
    lanes = lane_names()
    by = collections.defaultdict(list)
    for r in refs:
        by[r[0]].append(r)
    offs = sorted(by)
    names = {}
    rows = []
    parent = None  # (off, size, name) of the last row that has a known extent
    for j, off in enumerate(offs):
        rs = by[off]
        nxt = offs[j + 1] if j + 1 < len(offs) else DSEND
        sizes = collections.Counter(r[2] for r in rs if r[2])
        kinds = collections.Counter(r[1] for r in rs)
        ds_only = all((r[4], r[5]) in dsfuncs for r in rs)
        size = max(sizes) if sizes else 0
        inside = parent and parent[0] < off < parent[0] + parent[1] and off not in EVID
        if off in EVID:
            name, ev, conf = EVID[off]
        elif inside:
            d = off - parent[0]
            name = "%s_%s" % (parent[2], "hi" if parent[1] == 4 and d == 2 else "%X" % d)
            ev, conf = "inside %s (+%Xh)" % (parent[2], d), ("L" if ds_only else ("H" if kinds.get("direct") else "M"))
        else:
            name, ev, conf = "g_%04X" % off, "", ("L" if ds_only else ("H" if kinds.get("direct") else "M"))
            if off < 0x100 and not kinds.get("direct"):
                conf, ev = "L", "small displacement without a direct reference: probably a record field via a DS pointer"
        # type guess
        init = None
        ps = pstr(off)
        if kinds.get("indexed") and not kinds.get("direct"):
            t = "array (elem %s B?)" % (size or "?")
        elif size == 4 and any(r[7].startswith(("LES", "LDS")) for r in rs):
            t = "far pointer"
        elif ps is not None and kinds.get("addr"):
            t = "string[%d] (Pascal)" % dsimg[off]
        elif kinds.get("addr") and not size:
            t = "var/record (address taken)"
        else:
            t = {1: "byte", 2: "word", 4: "dword"}.get(size, "?")
        if off < INIT:
            n = max(1, min(size or (len(ps) + 1 if ps else 2), 8))
            init = dsimg[off:off + n].hex(" ")
            if ps: init = "'%s'" % ps[:40]
        else:
            init = "bss"
        span = nxt - off
        ext = EVSIZE.get(off) or (4 if t == "far pointer" or size == 4 else 0)
        if not inside and ext:
            parent = (off, ext, lanes[off][0] if (off in lanes and off not in EVID) else name)
        units = collections.defaultdict(lambda: [set(), set()])
        for r in rs:
            u = units[r[4]]
            if r[3] in ("W", "RW"): u[1].add(r[5])
            if r[3] in ("R", "RW", "A"): u[0].add(r[5])
        names["%04X:%04X" % (DS, off)] = name   # globals.json keeps the placeholder/evidence name
        if off in lanes and off not in EVID:
            name = lanes[off][0]
            names["%04X:%04X" % (DS, off)] = name   # keep globals.json equal to the lane name (no export conflict)
            ev = ("%s; " % ev if ev else "") + "name from " + lanes[off][1]
        pv = votes.get(off)
        if pv:
            po, nv = pv.most_common(1)[0]; tot = sum(pv.values())
            pool = "%04X %s (%d/%d)" % (po, pnames.get(po, "g_%04X" % po), nv, tot)
        else:
            pool = ""
        rows.append(dict(pool=pool, off=off, name=name, t=t, size=size, span=span, init=init, conf=conf, ev=ev,
                         nref=len(rs), kinds=kinds, units=units, ds_only=ds_only))
    # lane-named offsets without a static code reference (tables reached via a computed base)
    for off, (nm, src) in sorted(lanes.items()):
        if off in by or off >= DSEND: continue
        init = ("'%s'" % pstr(off)[:40]) if pstr(off) else (dsimg[off:off + 8].hex(" ") if off < INIT else "bss")
        rows.append(dict(pool="", off=off, name=nm, t="(named, no direct ref)", size=0, span=0, init=init, conf="M",
                         ev="name from %s; no static operand references it (computed address)" % src,
                         nref=0, kinds=collections.Counter(), units={}, ds_only=False))
    rows.sort(key=lambda r: r["off"])
    # Pool names for unanimous mappings with >= 2 votes (conf M; the lane confirms by body)
    nadopt = 0
    for r in rows:
        pv = votes.get(r["off"])
        if not pv or r["off"] in EVID or r["off"] in lanes or not PH.match(r["name"]): continue
        po, nv = pv.most_common(1)[0]
        pn = pnames.get(po)
        if (nv >= 2 and nv == sum(pv.values()) and pn and not PH.match(pn) and r["conf"] != "L"
                and not re.search(r"[0-9A-Fa-f]{4}", pn)):   # address-derived Pool names do not carry over
            r["name"] = pn; r["conf"] = "M"
            r["ev"] = ("%s; " % r["ev"] if r["ev"] else "") + "name = Pool %04X %s (%d/%d aligned)" % (po, pn, nv, nv)
            names["%04X:%04X" % (DS, r["off"])] = pn
            nadopt += 1
    print("Pool names adopted", nadopt)
    # segment words of far pointers / fields inside a record take the final (lane / Pool / evidence) name of the parent
    byoff = {r["off"]: r for r in rows}
    nhi = 0
    for r in rows:
        m = re.match(r"^inside g_([0-9A-F]{4}) \(\+([0-9A-F]+)h\)", r["ev"])
        if not m or not PH.match(r["name"]) or r["off"] in lanes: continue
        par = byoff.get(int(m.group(1), 16))
        if par and not PH.match(par["name"]):
            d = int(m.group(2), 16)
            r["name"] = "%s_%s" % (par["name"], "hi" if d == 2 and par["t"] == "far pointer" or d == 2 and par["size"] == 4 else "%X" % d)
            r["ev"] = r["ev"].replace("g_%s" % m.group(1), par["name"])
            names["%04X:%04X" % (DS, r["off"])] = r["name"]
            nhi += 1
    print("parent-named inner offsets", nhi)
    # outputs
    json.dump(names, open(os.path.join(R, "decode/names/globals.json"), "w"), indent=1, sort_keys=True)
    disp = {r["off"]: r["name"] for r in rows}
    with open(os.path.join(R, "decode/globals_xref.tsv"), "w", newline="\n") as f:
        f.write("ds_off\tname\tkind\tsize\taccess\tunit\tfunction\taddr\tinstruction\n")
        for r in sorted(refs):
            f.write("%04X\t%s\t%s\t%d\t%s\t%s\t%s\t%s\t%s\n" % (r[0], disp[r[0]], r[1], r[2], r[3], r[4], r[5], r[6], r[7]))
    nunits = collections.Counter()
    for row in rows:
        nunits[len(row["units"])] += 1
    md = ["# GLOBALS — DS 0C1C cross-reference (generated by decode/tools/globals.py; regenerate, do not edit)", "",
          "The CROSSREF base for every module lane. Source: Ghidra listings (`decode/listings/*.lst`), DS context 0C1C on all code.",
          "One row per DS offset referenced by code. **Kinds:** `direct` = `[0xN]` operand (H); `indexed` = `[BX/SI/DI+0xN]` (DS default), i.e. an array/table base (M); `addr` = `MOV r,0xN` next to `PUSH DS`, i.e. address passed as a var/pointer argument (M).",
          "**Type** is a guess from operand sizes and kinds. **Span** = distance to the next referenced offset (an upper bound on the size). **Init** = image bytes for offsets < 47E0h (typed constants / initialised data); `bss` = zero-filled at start. The range 47E0..8F00 is BSS.",
          "**Names:** evidence names for TP System/Crt/Overlay variables (RT_LEDGER pass); Pool names where the Pool mapping is unanimous with >= 2 votes, the row is not conf L and the Pool name is not address-derived (conf M, `name = Pool ...` in the notes); real names from lane files (`decode/names/<lane>_names.json`, noted in the last column); otherwise `g_XXXX`. Module lanes: put evidence-backed names in `decode/names/<lane>_names.json` (key `0C1C:XXXX`); later files override `globals.json` on export. Cite the evidence in your pseudo file. Owner: cab-rt; ask with a `globals request #n: <offset> <name> <evidence>` line at the top of STATUS.md (cab-rt adds it, regenerates this file and the listings).",
          "Per-reference detail (instruction, address, access) is in `decode/globals_xref.tsv`. Reader/writer lists: `unit: functions`. **R** = read/address taken, **W** = written.",
          "Refs inside functions that load DS themselves (System/Crt/Dos helpers) may not be DS 0C1C; such rows have conf L and are marked `dsswitch`.", "",
          "Totals: %d DS offsets, %d references; %d evidence-named; offsets used by >= 2 units: %d." % (
              len(rows), len(refs), sum(1 for r in rows if r["off"] in EVID), sum(v for k, v in nunits.items() if k >= 2)), "",
          "**Pool** = Pool of Radiance DS offset and name (`votes/total` aligned instruction pairs from %d functions paired by name or by a unique 16-instruction shape; a vote is an aligned instruction whose DS operand is this offset in Curse and that offset in Pool). Agreement of all votes and >= 2 votes = strong; one vote = weak; split votes = a field of a record or a reused register slot, check by hand." % npairs, "",
          "| DS off | name | type | size | span | init | conf | kinds | refs | Pool | readers | writers | evidence/notes |",
          "|---|---|---|---|---|---|---|---|---|---|---|---|---|"]

    def fl(units, i):
        return "; ".join("%s: %s" % (u, ", ".join(sorted(v[i]))) for u, v in sorted(units.items()) if v[i]).replace("|", "/")
    for r in rows:
        md.append("| %04X | %s | %s | %s | %X | %s | %s | %s | %d | %s | %s | %s | %s |" % (
            r["off"], r["name"], r["t"], r["size"] or "", r["span"], r["init"].replace("|", "/"), r["conf"],
            ",".join("%s%d" % (k, v) for k, v in sorted(r["kinds"].items())), r["nref"], r["pool"], fl(r["units"], 0), fl(r["units"], 1),
            (r["ev"] + (" dsswitch" if r["ds_only"] and r["off"] not in EVID and not r["ev"].startswith("inside") else "")).strip()))
    open(os.path.join(R, "decode/GLOBALS.md"), "w", encoding="utf-8").write("\n".join(md) + "\n")
    print("offsets %d refs %d evid %d multiunit %d dsswitch-only %d" % (
        len(rows), len(refs), sum(1 for r in rows if r["off"] in EVID), sum(v for k, v in nunits.items() if k >= 2),
        sum(1 for r in rows if r["ds_only"])))
    print(collections.Counter(r[1] for r in refs))
    print("pool pairs %d, offsets with a Pool equivalent %d" % (npairs, sum(1 for r in rows if r["pool"])))


if __name__ == "__main__":
    main()
