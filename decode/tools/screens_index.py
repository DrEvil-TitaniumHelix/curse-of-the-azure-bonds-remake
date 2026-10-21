"""Build decode/pseudo/SCREENS_INDEX.md from the seven <AREA>_SCREENS.md files (cab-crossref, cab-rt).
Usage: python -I screens_index.py > decode/pseudo/SCREENS_INDEX.body.md   (the hand-written head is kept in the file)
Rows keep the source texts in full (the index must be enough to rebuild each screen); the game order is the ORDER list."""
import collections, os, re, sys
sys.stdout.reconfigure(encoding="utf-8")
R = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
AREAS = ["RESIDENT", "ENGINE", "ECL", "VIEW", "PARTY", "MAGIC", "COMBAT"]
OWNER = {"RESIDENT": "cab-rt", "ENGINE": "cab-rt", "PARTY": "cab-rt", "ECL": "eclview", "VIEW": "eclview",
         "COMBAT": "combat", "MAGIC": "magic"}


def parse():
    rows = {}
    for a in AREAS:
        t = open(os.path.join(R, "decode/pseudo/%s_SCREENS.md" % a), encoding="utf-8").read()
        if a == "ECL":
            for m in re.finditer(r"^### (ECL-\d+) (.+?)\n(.*?)(?=^### |\Z)", t, re.M | re.S):
                body = m.group(3)
                def bullet(k):
                    mm = re.search(r"^- %s:\s*(.*?)(?=^- |\Z)" % k, body, re.M | re.S)
                    return re.sub(r"\s+", " ", mm.group(1)).strip() if mm else ""
                rest = re.sub(r"\s+", " ", body).strip() if not bullet("Trigger") else ""
                rows[m.group(1)] = dict(area=a, name=m.group(2).strip(), trigger=bullet("Trigger"),
                                        text=bullet("Screen") or rest, keys=bullet("Keys"), pics=bullet("Pictures"),
                                        next=bullet("Next"))
            continue
        hdr = None
        for ln in t.split("\n"):
            if ln.startswith("| id") or ln.startswith("| ID"):
                hdr = [c.strip().lower() for c in ln.strip().strip("|").split("|")]; continue
            if not hdr or not re.match(r"^\| [A-Z]+-[0-9A-Za-z-]+ \|", ln): continue
            cells = [c.strip() for c in re.split(r"(?<!\\)\|", ln.strip().strip("|"))]
            d = dict(zip(hdr, cells))
            if len(hdr) == 7:
                name, trig, text = d.get("screen / message", ""), d.get("trigger", ""), d.get("content and layout", "")
                pics, nxt = d.get("pictures / data", ""), d.get("next", "")
            else:
                trig, text, pics, nxt = d.get("trigger", ""), d.get("text / window", ""), d.get("pictures", ""), d.get("next", "")
                name = ""
            rows[cells[0]] = dict(area=a, name=name, trigger=trig, text=text, keys=d.get("keys", ""), pics=pics, next=nxt)
    return rows


ORDER = [
    ("1. Start-up", "RESIDENT-04 RESIDENT-05 RESIDENT-06 RESIDENT-07 RESIDENT-08 RESIDENT-09 RESIDENT-10 RESIDENT-11 RESIDENT-17 ENGINE-09 ENGINE-02 ENGINE-03 ENGINE-04 ENGINE-05 RESIDENT-01 ENGINE-06 ENGINE-07 ENGINE-08 RESIDENT-02"),
    ("2. Top menu, party creation, files", "ENGINE-21 ENGINE-22 ENGINE-23 ENGINE-24 ENGINE-25 ENGINE-26 ENGINE-27 ENGINE-28 ENGINE-29 ENGINE-30 ENGINE-31 ENGINE-32 ENGINE-33 PARTY-18 ENGINE-10 ENGINE-11 ENGINE-12 ENGINE-13 ENGINE-14 ENGINE-15 ENGINE-16 ENGINE-17 ENGINE-18 ENGINE-19 ENGINE-20"),
    ("3. Adventure: scripts, 3D / 2D view, pictures", "ECL-01 ECL-02 ECL-03 ECL-09 VIEW-01 VIEW-02 VIEW-02a VIEW-03 VIEW-04 VIEW-13 VIEW-07 VIEW-08 COMBAT-07-01 COMBAT-07-02 COMBAT-07-03 PARTY-13 PARTY-14 PARTY-15 PARTY-16 PARTY-17"),
    ("4. Shop, temple, money", "PARTY-01 PARTY-02 PARTY-03 PARTY-04 PARTY-10 PARTY-11 PARTY-12 MAGIC-04-01 MAGIC-04-02 MAGIC-04-03 MAGIC-04-04"),
    ("5. Camp, rest, spells", "ECL-04 MAGIC-15-01 MAGIC-15-02 MAGIC-15-03 MAGIC-15-04 MAGIC-15-05 MAGIC-15-06 MAGIC-15-07 MAGIC-15-08 MAGIC-15-09 MAGIC-15-10 MAGIC-15-11 MAGIC-15-12 PARTY-06 PARTY-07 PARTY-08 PARTY-09 MAGIC-22-01 MAGIC-22-02"),
    ("6. Character sheet and items", "COMBAT-19-01 COMBAT-19-02 COMBAT-19-03 COMBAT-19-04 COMBAT-19-05 COMBAT-19-05a COMBAT-19-06 COMBAT-19-07 COMBAT-19-08 COMBAT-19-09 COMBAT-19-10 COMBAT-19-11 COMBAT-19-12 COMBAT-19-13 COMBAT-19-14 COMBAT-19-15"),
    ("7. Combat", "ECL-05 VIEW-05 VIEW-06 MAGIC-08-01 MAGIC-08-02 MAGIC-08-03 MAGIC-08-04 MAGIC-08-05 MAGIC-08-06 COMBAT-09-01 COMBAT-09-02 COMBAT-13-01 COMBAT-13-02 COMBAT-13-03 COMBAT-13-04 COMBAT-13-05 COMBAT-13-06 COMBAT-13-07 COMBAT-13-08 COMBAT-13-09 MAGIC-22-03 MAGIC-22-04 MAGIC-22-05 MAGIC-22-06 PARTY-05 COMBAT-23-01 COMBAT-23-02 COMBAT-23-03 COMBAT-23-04"),
    ("8. After combat", "COMBAT-05-01 COMBAT-05-02 COMBAT-05-03 COMBAT-05-04 COMBAT-05-05 COMBAT-05-06 COMBAT-05-07"),
    ("9. Program exits, copy protection, finale", "ECL-06 ECL-07 ECL-08 COMBAT-18-01 COMBAT-18-02 COMBAT-18-03 COMBAT-18-04 COMBAT-18-05 COMBAT-18-06"),
    ("10. Shared UI elements and error screens (any time)", "RESIDENT-03 RESIDENT-12 RESIDENT-13 RESIDENT-18 VIEW-09 VIEW-10 VIEW-12 RESIDENT-14 RESIDENT-15 RESIDENT-16 VIEW-11 ENGINE-01"),
]

DAXFILES = ["TITLE", "PIC", "SPRIT", "HEAD", "BODY", "CHEAD", "CBODY", "CPIC", "COMSPR", "DUNGCOM", "WILDCOM", "RANDCOM",
            "8X8D", "WALLDEF", "GEO", "ECL", "MON", "ITEM", "ITEMS", "BIGPIC", "TILES", "SKY"]


OPEN = {  # fix requests already posted against a row (STATUS.md)
    "COMBAT-19-02": "prompt is empty, not `View:` (COMBAT fix request #verify-30)",
    "COMBAT-19-03": "list prompt is empty, not `Items:` (COMBAT fix request #verify-31)",
    "MAGIC-22-01": "count shown as ` (N)`, not ` (xN)` (MAGIC fix request #verify-44)",
    "ECL-09": "address 6800:04fd is mid-instruction, the Mem[4CFF] test is 6800:0507 (ECL fix request #verify-46)",
}


# backticked capitalised phrases that are messages, or menus whose other keys are described as "any other key"
NOTMENU = {"RESIDENT-01", "ENGINE-33", "MAGIC-15-07", "COMBAT-19-07"}


def esc(s): return s.replace("|", "\\|").replace("\n", " ")


def main():
    rows = parse()
    seq = [i for _, ids in ORDER for i in ids.split()]
    missing_in_order = [i for i in rows if i not in seq]
    unknown = [i for i in seq if i not in rows]
    sid = {i: "S%03d" % (k + 1) for k, i in enumerate(seq) if i in rows}
    gaps = collections.defaultdict(list)
    idre = re.compile(r"\b(?:RESIDENT|ENGINE|ECL|VIEW|PARTY|MAGIC|COMBAT)-[0-9]+(?:-[0-9]+)?[a-z]?\b")
    index_txt = open(os.path.join(R, "decode/data/INDEX.md"), encoding="utf-8").read().upper()
    for i in seq:
        r = rows.get(i)
        if not r: continue
        for t in set(idre.findall(r["next"] + " " + r["keys"] + " " + r["text"])):
            if t not in rows: gaps[i].append("refers to `%s`, which no SCREENS file defines" % t)
        for f in set(re.findall(r"\b(TITLE|PIC|SPRIT|HEAD|BODY|CHEAD|CBODY|CPIC|COMSPR|DUNGCOM|WILDCOM|RANDCOM|8X8D|WALLDEF|GEO|BIGPIC|TILES|SKY)\b", r["pics"].upper())):
            if f not in index_txt: gaps[i].append("picture file %s not in decode/data/INDEX.md" % f)
        # menu letters vs keys: capitals of a backticked option line that the keys column does not mention
        for opt in ([] if i in NOTMENU else re.findall(r"`([A-Z][a-z]+(?: [A-Z][a-z]*)+)`", r["text"])):
            letters = [w[0] for w in opt.split()]
            kt = r["keys"]
            if kt and kt not in ("-", "—", "any key", "any"):
                miss = [L for L in letters if not re.search(r"(?<![A-Za-z])%s(?![a-z])" % L, kt) and opt.split()[letters.index(L)] not in kt]
                if miss and len(miss) < len(letters):
                    gaps[i].append("menu `%s`: key(s) %s not described in the keys column" % (opt, "/".join(miss)))
        if i in OPEN: gaps[i].append(OPEN[i])
        if not r["keys"] and r["area"] != "ECL": gaps[i].append("keys column empty")
        if not r["next"]: gaps[i].append("no transition given")
    for title, ids in ORDER:
        print("\n## %s\n" % title)
        print("| id | source | screen / trigger | text and layout | pictures (DAX) | keys | transitions | gaps |")
        print("|---|---|---|---|---|---|---|---|")
        for i in ids.split():
            r = rows.get(i)
            if not r: continue
            nxt = idre.sub(lambda m: "%s (%s)" % (sid.get(m.group(0), "?"), m.group(0)), r["next"])
            name = (r["name"] + " — " if r["name"] else "") + r["trigger"]
            print("| %s | %s_SCREENS %s | %s | %s | %s | %s | %s | %s |" % (sid[i], r["area"], i, esc(name), esc(r["text"]), esc(r["pics"]),
                  esc(r["keys"]), esc(nxt), esc("; ".join(gaps[i]))))
    print("\n<!-- stats: %d rows; not placed: %s; placed but undefined: %s -->" % (len(sid), missing_in_order, unknown))
    print("\nGAPS", sum(len(v) for v in gaps.values()), file=sys.stderr)
    for i, g in gaps.items():
        for x in g: print("GAP", sid.get(i), i, x, file=sys.stderr)


if __name__ == "__main__":
    main()
