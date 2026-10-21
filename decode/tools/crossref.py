"""CROSSREF generators (cab-crossref, cab-rt). Usage: python -I crossref.py s1|s2|s3|s4|s5 > fragment.md
Inputs: decode/listings/functions.tsv + *.lst, decode/pseudo/*.pas.md, decode/names/*.json, decode/GLOBALS.md data.
Fragments are pasted into decode/CROSSREF.md (decisions and evidence are written there by hand)."""
import collections, glob, json, os, re, sys
sys.stdout.reconfigure(encoding="utf-8")
R = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
P = lambda *a: os.path.join(R, *a)

# unit -> canonical area / file (herdr/assignments/cab-areas.md, Foreman-accepted area map)
AREA = {}
for u in "ov00 ov01 ov03 ov11 ov16 ov17".split(): AREA[u] = "ENGINE"
for u in "ov02 ov34".split(): AREA[u] = "ECL"
for u in "ov10 ov14 ov26 ov27 ov28 ov29 ov30 ov31 ov32 ov33 ov35".split(): AREA[u] = "VIEW"
for u in "ov05 ov07 ov09 ov13 ov18 ov19 ov23".split(): AREA[u] = "COMBAT"
for u in "ov04 ov08 ov15 ov22".split(): AREA[u] = "MAGIC"
for u in "ov06 ov12 ov20 ov21 ov24 ov25".split(): AREA[u] = "PARTY"
for u in "main_0000 res_0186 res_019B res_01A0 res_020F res_0297 res_0542 res_0636 res_06EA res_0713 res_097D".split():
    AREA[u] = "RESIDENT"
for u in "crt_09AB dos_097F overlay_0A0D system_0A54".split(): AREA[u] = "RUNTIME"
AREA["stubs"] = "LAYOUT"
FILE = {a: "decode/pseudo/%s.pas.md" % a for a in ("ENGINE", "ECL", "VIEW", "COMBAT", "MAGIC", "PARTY", "RESIDENT")}
FILE["RUNTIME"] = "decode/rt/RT_LEDGER.md"; FILE["LAYOUT"] = "decode/LAYOUT.md"
AREAS = ["RESIDENT", "ENGINE", "ECL", "VIEW", "COMBAT", "MAGIC", "PARTY"]


PH = re.compile(r"^(FUN_|ov\d\d_[0-9A-Fa-f]{4}$|g_|LAB_|DAT_|stub_)")


def functions():
    out = collections.defaultdict(list)
    for ln in open(P("decode/listings/functions.tsv"), encoding="latin-1"):
        c = ln.rstrip("\n").split("\t")
        if len(c) < 3 or c[0] == "unit": continue
        out[c[0]].append((c[2].lower(), c[1], c[4] if len(c) > 4 else "", c[5] if len(c) > 5 else ""))
    return out


def text(area):
    return open(P(FILE[area]), encoding="utf-8").read().lower()


def s1():
    fn = functions()
    print("| unit | seg | area | canonical file | functions | documented | missing (addr name) |")
    print("|---|---|---|---|---|---|---|")
    order = sorted(fn, key=lambda u: (u != "main_0000", not u.startswith("res_"), u.startswith(("crt", "dos", "overlay", "system", "stubs")), u))
    tot = collections.Counter()
    for u in order:
        a = AREA.get(u, "?"); fs = fn[u]
        seg = fs[0][0][:4].upper() if fs else "?"
        if a in ("RUNTIME", "LAYOUT"):
            print("| %s | %s | %s | %s | %d | (ledger) | |" % (u, seg, a, FILE[a], len(fs))); continue
        t = text(a) + (open(P("decode/ecl/ECL_VM.md"), encoding="utf-8").read().lower() if u == "ov07" else "")
        heads = "\n".join(l for l in t.split("\n") if l.startswith("### " + seg.lower() + ":"))
        def doc(ad, nm):
            off = ad[5:]
            return (ad in t or ("%s_%s" % (u, off)) in t or ("fun_%s_%s" % (ad[:4], off)) in t
                    or (not PH.match(nm) and re.search(r"\b%s\b" % re.escape(nm.lower()), heads) is not None)
                    or re.search(r"/ %s\b" % off, heads) is not None)
        miss = [(ad, nm) for ad, nm, *_ in fs if not doc(ad, nm)]
        tot[a, "f"] += len(fs); tot[a, "d"] += len(fs) - len(miss)
        print("| %s | %s | %s | %s | %d | %d | %s |" % (u, seg, a, FILE[a], len(fs), len(fs) - len(miss),
              ", ".join("%s %s" % (ad[5:].upper(), nm) for ad, nm in miss) or ""))
    print()
    print("| area | functions | documented |")
    print("|---|---|---|")
    for a in AREAS: print("| %s | %d | %d |" % (a, tot[a, "f"], tot[a, "d"]))


def names():
    """address -> [(name, file)] over decode/names/*.json (routines only, seg:off keys outside DS)."""
    out = collections.defaultdict(list)
    for f in sorted(glob.glob(P("decode/names/*.json"))):
        try: d = json.load(open(f, encoding="utf-8"))
        except Exception: continue
        for k, v in d.items():
            if not isinstance(v, str): continue
            ku = k.upper()
            if ku.startswith(("DS:", "0C1C:")): continue
            if re.match(r"^[0-9A-F]{4}:[0-9A-F]{4}$", ku): out[ku].append((v, os.path.basename(f)))
    return out




def s2():
    nm = names(); fn = functions()
    addr2unit = {ad.upper(): (u, n) for u, fs in fn.items() for ad, n, *_ in fs}
    # (a) same address, different real names
    print("### 2a. Same address, different real names in the names files")
    print("| addr | names (file) |"); print("|---|---|")
    k = 0
    for a, lst in sorted(nm.items()):
        real = {v for v, f in lst if not PH.match(v)}
        if len(real) > 1:
            k += 1; print("| %s | %s |" % (a, "; ".join("%s (%s)" % (v, f) for v, f in lst)))
    print("\n%d conflicts\n" % k)
    # (b) one name, several addresses
    print("### 2b. One real name, several addresses")
    by = collections.defaultdict(set)
    for a, lst in nm.items():
        for v, f in lst:
            if not PH.match(v): by[v].add(a)
    print("| name | addresses |"); print("|---|---|")
    k = 0
    for v, s in sorted(by.items()):
        if len(s) > 1: k += 1; print("| %s | %s |" % (v, ", ".join(sorted(s))))
    print("\n%d names on several addresses\n" % k)
    # (c) placeholders used in pseudo files although a real name exists
    print("### 2c. Placeholder `ovNN_XXXX` / `FUN_SSSS_OOOO` in the pseudo files where the merged names map has a real name")
    seg_of = {}
    for u, fs in fn.items():
        if fs and u.startswith("ov"): seg_of[u[2:]] = fs[0][0][:4].upper()
    real = {}
    for a, lst in nm.items():
        r = [v for v, f in lst if not PH.match(v)]
        if r: real[a] = r[-1]
    for ad, (u, n) in addr2unit.items():
        if ad not in real and not PH.match(n): real[ad] = n
    print("| file | placeholder | real name | uses |"); print("|---|---|---|---|")
    k = 0
    for a in AREAS:
        t = open(P(FILE[a]), encoding="utf-8").read()
        c = collections.Counter()
        for m in re.finditer(r"\bov(\d\d)_([0-9A-Fa-f]{4})\b", t):
            s = seg_of.get(m.group(1))
            if not s: continue
            key = "%s:%s" % (s, m.group(2).upper())
            if key in real: c[(m.group(0), real[key])] += 1
        for m in re.finditer(r"\bFUN_([0-9a-fA-F]{4})_([0-9a-fA-F]{4})\b", t):
            key = "%s:%s" % (m.group(1).upper(), m.group(2).upper())
            if key in real: c[(m.group(0), real[key])] += 1
        for (ph, rn), n in sorted(c.items()):
            k += 1; print("| %s | `%s` | %s | %d |" % (a, ph, rn, n))
    print("\n%d placeholder/name pairs\n" % k)
    # (d) headers whose name differs from the merged names map
    print("### 2d. Routine headers whose name differs from the names map / listings")
    print("| file | addr | header name | names map / listing |"); print("|---|---|---|---|")
    k = 0
    for a in AREAS:
        for ln in open(P(FILE[a]), encoding="utf-8"):
            m = re.match(r"^### ([0-9A-Fa-f]{4}):([0-9A-Fa-f]{4}) (\w+)", ln)
            if not m: continue
            key = "%s:%s" % (m.group(1).upper(), m.group(2).upper()); h = m.group(3)
            want = real.get(key) or (addr2unit.get(key, (None, None))[1])
            if want and h != want and not PH.match(want):
                k += 1; print("| %s | %s | %s | %s |" % (a, key, h, want))
    print("\n%d header differences" % k)



def realmap():
    nm = names(); fn = functions()
    seg_of = {u[2:]: fs[0][0][:4].upper() for u, fs in fn.items() if fs and u.startswith("ov")}
    real = {}
    for a, lst in nm.items():
        r = [v for v, f in lst if not PH.match(v)]
        if r: real[a] = r[-1]
    for u, fs in fn.items():
        for ad, n, *_ in fs:
            if ad.upper() not in real and not PH.match(n): real[ad.upper()] = n
    return seg_of, real


def apply2c():
    """Replace ovNN_XXXX / FUN_SSSS_OOOO placeholders by the real name in the given pseudo files (owner's files only)."""
    seg_of, real = realmap()
    for a in sys.argv[2:]:
        p = P(FILE[a]); t = open(p, encoding="utf-8").read(); n = 0
        def rep(m):
            nonlocal n
            if m.group(1):
                s = seg_of.get(m.group(2)); key = "%s:%s" % (s, m.group(3).upper()) if s else None
            else:
                key = "%s:%s" % (m.group(4).upper(), m.group(5).upper())
            if key and key in real: n += 1; return real[key]
            return m.group(0)
        t = re.sub(r"\b(ov(\d\d)_([0-9A-Fa-f]{4}))\b|\bFUN_([0-9a-fA-F]{4})_([0-9a-fA-F]{4})\b", rep, t)
        # "Name (Name)" / "`Name` = Name" left by the replacement
        t = re.sub(r"\b(\w+) \(\1\)", r"\1", t)
        open(p, "w", encoding="utf-8").write(t); print(a, n, "placeholders replaced")



def s3():
    """DS globals referenced from >= 2 areas: name, type, meaning, writers / readers per area."""
    g = json.load(open(P("decode/names/globals.json"), encoding="utf-8"))
    rows = {}
    for ln in open(P("decode/GLOBALS.md"), encoding="utf-8"):
        c = [x.strip() for x in ln.split("|")]
        if len(c) > 13 and re.match(r"^[0-9A-F]{4}$", c[1]): rows[c[1]] = c
    acc = collections.defaultdict(lambda: collections.defaultdict(set))
    for ln in open(P("decode/globals_xref.tsv"), encoding="latin-1"):
        c = ln.rstrip("\n").split("\t")
        if c[0] == "ds_off": continue
        a = AREA.get(c[5], "?")
        acc[c[0].upper()][a].add("W" if "W" in c[4] else "R")
    print("| DS | name | type | areas: W = writes, R = reads only | meaning / evidence |")
    print("|---|---|---|---|---|")
    n = 0; per = collections.Counter()
    for off in sorted(acc):
        ar = {a: s for a, s in acc[off].items() if a not in ("RUNTIME", "?")}
        if len(ar) < 2: continue
        n += 1
        nm = g.get("0C1C:" + off, "g_" + off); r = rows.get(off)
        typ = r[3] if r else ""
        note = (r[13] if r else "")
        note = re.sub(r"\s+", " ", note)
        if len(note) > 110: note = note[:107] + "..."
        cells = ", ".join("%s %s" % (a, "W" if "W" in s else "R") for a, s in sorted(ar.items(), key=lambda x: AREAS.index(x[0]) if x[0] in AREAS else 9))
        for a in ar: per[a] += 1
        print("| %s | %s | %s | %s | %s |" % (off, nm, typ, cells, note.replace("|", "/")))
    print("\n%d DS offsets used by >= 2 areas; per area: %s" % (n, ", ".join("%s %d" % (a, per[a]) for a in AREAS)))
    print("placeholder-named among them: %d" % sum(1 for off in acc if len({a for a in acc[off] if a not in ('RUNTIME','?')}) >= 2 and g.get("0C1C:" + off, "g_").startswith("g_")))



def s4():
    """Area x area and unit -> unit call edges (functions.tsv callees; stub thunks resolved by name)."""
    fn = functions()
    name2unit = {}
    for u, fs in fn.items():
        for ad, n, *_ in fs:
            if u != "stubs": name2unit.setdefault(n, u)
    rows = []
    for ln in open(P("decode/listings/functions.tsv"), encoding="latin-1"):
        c = ln.rstrip("\n").split("\t")
        if len(c) < 6 or c[0] in ("unit", "stubs"): continue
        rows.append((c[0], c[1], [x for x in c[5].split(",") if x]))
    A = AREAS + ["RUNTIME"]
    mat = collections.Counter(); edges = collections.defaultdict(set)
    for u, n, callees in rows:
        for cal in callees:
            v = name2unit.get(cal)
            if not v: continue
            a, b = AREA.get(u), AREA.get(v)
            if a and b and a != b:
                mat[a, b] += 1; edges[u, v].add(cal)
    print("### 4a. Area x area (rows call columns; distinct caller->callee function pairs)\n")
    print("| caller \\ callee | " + " | ".join(A) + " |"); print("|---" * (len(A) + 1) + "|")
    for a in A:
        print("| **%s** | " % a + " | ".join(str(mat[a, b]) if mat[a, b] else "" for b in A) + " |")
    print("\n### 4b. Unit -> unit edges across areas (callee unit: routines called)\n")
    print("| caller unit (area) | callee unit (area) | routines called |"); print("|---|---|---|")
    for (u, v) in sorted(edges, key=lambda x: (AREAS.index(AREA[x[0]]) if AREA[x[0]] in AREAS else 9, x[0], x[1])):
        if AREA.get(v) == "RUNTIME": continue
        names_ = sorted(edges[u, v])
        s = ", ".join(names_[:8]) + (" (+%d)" % (len(names_) - 8) if len(names_) > 8 else "")
        print("| %s (%s) | %s (%s) | %s |" % (u, AREA[u], v, AREA[v], s))



OWNER = {"RESIDENT": "cab-rt", "ENGINE": "cab-rt", "PARTY": "cab-rt", "ECL": "Fable (eclview)", "VIEW": "Fable (eclview)",
         "COMBAT": "Fable (combat)", "MAGIC": "Fable (magic)"}


def s5():
    """Placeholder roll-up over the pseudo files, ECL_VM.md and decode/data/*.md."""
    seg_of, real = realmap()
    g = json.load(open(P("decode/names/globals.json"), encoding="utf-8"))
    files = [(a, FILE[a]) for a in AREAS] + [("ECL_VM", "decode/ecl/ECL_VM.md")] + \
            [(os.path.basename(f)[:-3], os.path.relpath(f, R).replace("\\", "/")) for f in sorted(glob.glob(P("decode/data/*.md")))] + \
            [(os.path.basename(f)[:-3], os.path.relpath(f, R).replace("\\", "/")) for f in sorted(glob.glob(P("decode/pseudo/*_SCREENS.md")))]
    print("### 5a. Per file (tokens / distinct)\n")
    print("| file | owner | g_XXXX (no name anywhere) | g_XXXX (named in globals.json) | FUN_ | ovNN_XXXX (no real name) | ovNN_XXXX (real name exists) | unk_ / DAT_ |")
    print("|---|---|---|---|---|---|---|---|")
    gl = collections.Counter(); glf = collections.defaultdict(set); fu = collections.Counter(); fuf = collections.defaultdict(set)
    tot = collections.Counter()
    for a, f in files:
        t = open(P(f), encoding="utf-8").read()
        c = collections.Counter(); d = collections.defaultdict(set)
        for m in re.finditer(r"\bg_([0-9A-Fa-f]{4})\b(?!_)", t):
            off = m.group(1).upper(); nm = g.get("0C1C:" + off, "g_")
            k = "g_named" if not nm.startswith("g_") else "g_none"
            c[k] += 1; d[k].add(off)
            if k == "g_none": gl[off] += 1; glf[off].add(a)
        for m in re.finditer(r"\bFUN_([0-9a-fA-F]{4})_([0-9a-fA-F]{4})\b", t):
            key = ("%s:%s" % (m.group(1), m.group(2))).upper()
            k = "fun_real" if key in real else "fun"
            c[k] += 1; d[k].add(key)
        for m in re.finditer(r"\bov(\d\d)_([0-9A-Fa-f]{4})\b", t):
            s = seg_of.get(m.group(1)); key = "%s:%s" % (s, m.group(2).upper()) if s else None
            k = "ov_real" if key and key in real else "ov_none"
            c[k] += 1; d[k].add(m.group(0).lower())
            if k == "ov_none": fu[m.group(0).lower()] += 1; fuf[m.group(0).lower()].add(a)
        for m in re.finditer(r"\b(unk_\w+|DAT_[0-9a-fA-F_]+)\b", t):
            c["unk"] += 1; d["unk"].add(m.group(0))
        for k in c: tot[k] += c[k]
        cell = lambda k: "%d / %d" % (c[k], len(d[k])) if c[k] else ""
        print("| %s | %s | %s | %s | %s | %s | %s | %s |" % (f, OWNER.get(a, "cab-data" if "/data/" in f else ("Fable (eclview)" if a == "ECL_VM" else OWNER.get(a.split("_")[0], ""))),
              cell("g_none"), cell("g_named"), cell("fun") + ((" (+%s with a real name)" % cell("fun_real")) if c["fun_real"] else ""),
              cell("ov_none"), cell("ov_real"), cell("unk")))
    print("\nTotals: g_ unnamed %d, g_ with a name in globals.json %d, FUN_ %d (+%d with a real name), ovNN_ unnamed %d, ovNN_ with a real name %d, unk_/DAT_ %d.\n"
          % (tot["g_none"], tot["g_named"], tot["fun"], tot["fun_real"], tot["ov_none"], tot["ov_real"], tot["unk"]))
    print("### 5b. DS globals still without a name (by number of mentions)\n")
    print("| DS | mentions | files |"); print("|---|---|---|")
    for off, n in gl.most_common():
        print("| %s | %d | %s |" % (off, n, ", ".join(sorted(glf[off]))))
    print("\n### 5c. Routines still without a real name (ovNN_XXXX, by mentions)\n")
    print("| routine | mentions | files |"); print("|---|---|---|")
    for r, n in fu.most_common():
        print("| %s | %d | %s |" % (r, n, ", ".join(sorted(fuf[r]))))



def apply5():
    """g_XXXX -> globals.json name in the given (owner's) files; `name{g_XXXX}` aliases are left as they are."""
    g = json.load(open(P("decode/names/globals.json"), encoding="utf-8"))
    for a in sys.argv[2:]:
        p = P(FILE[a]); t = open(p, encoding="utf-8").read(); n = 0
        def rep(m):
            nonlocal n
            nm = g.get("0C1C:" + m.group(1).upper())
            if nm and not nm.startswith("g_"): n += 1; return nm
            return m.group(0)
        out, inpas = [], False
        for ln in t.split("\n"):
            if ln.startswith("```"):
                inpas = ln.startswith("```pascal") and not inpas
            elif inpas:   # code only (not the `{ ... }` cites); prose keeps its `Name = g_XXXX` alias lists
                code, sep, com = ln.partition("{ ")
                ln = re.sub(r"(?<![{\w])g_([0-9A-Fa-f]{4})\b(?!_)", rep, code) + sep + com
            out.append(ln)
        open(p, "w", encoding="utf-8").write("\n".join(out)); print(a, n, "globals renamed")


if __name__ == "__main__":
    globals()[sys.argv[1]]()
