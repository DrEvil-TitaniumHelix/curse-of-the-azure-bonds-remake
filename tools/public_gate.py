"""public_gate.py: verification gate for the public release candidate (Curse port of Pool's gate; RemasterDOSGames
RELEASE.md rule 4, rulings PR-2 A / PR-3, CR-1 A).

Usage: python -I tools/public_gate.py REPO [--originals DIR] [--workspace DIR] [--json OUT]
  REPO         the candidate (a git repo): every blob of `git rev-list --all --objects` (the tree of HEAD is a subset)
  --originals  an original game folder, read only; may be given more than once (default: env CAB_DATA or
               re-targets/goldbox/cotab/curazure = the owner's v1.0 copy, plus the v1.3 CD copy
               re-targets/goldbox/adnd-collectors-cd/WIZWORKS/CURSE when it exists; cab-v13)
  --workspace  this RE workspace, for the hashes of its own derived material (renders, saves, decode/bin extracts)

FAIL (exit 1) when any of these is found:
  (p) PATH    a forbidden path or file type in any commit (*.png *.pdf *.exe *.dax *.ovr save files, decode listings, ECL
              script listings, DOSBox reference captures, lane files, the launcher ...)
  (h) HASH    a blob whose SHA-256 is an original file (every file of the folder incl. SAVE/), a decoded DAX record, or a
              render / save / extract of the workspace; also every SHA-256 named by the BYOC manifest
  (b) BYTES   a blob holding a binary run of >= 31 bytes identical to the originals (raw files and every decoded DAX record);
              low-entropy runs (< 6 distinct values) ignored
  (x) HEXDUMP a text blob with a hex dump of >= 32 consecutive bytes that occur in the originals (a listing with code bytes)
  (L) LARGE   a binary blob (> 1 % control bytes) of more than 4 KiB: the candidate is source and text only
  (e) SECRET  an e-mail address other than GitHub noreply / anthropic.com, an access token or private key, a user path
  (j) JOURNAL CR-1 A, no journal text shipped: a journal file (PDF) or a text with three or more numbered journal-entry
              headings, each followed by prose (the paper Adventurer's Journal; players import their own)
REPORT only (PR-2 A: our pseudocode/specs may quote short texts and byte evidence):
  (t) TEXT    a printable run of >= 31 bytes from the originals (a quoted game or runtime string)
  (s) SHORTHEX a hex dump of 16..31 bytes that occurs in the originals
Only paths, offsets, lengths and counts are printed, never the matched content. Run the personal-data gate as well
(RemasterDOSGames tools/personal_gate.py, RELEASE.md rule 3).
"""
import argparse, hashlib, json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
WS_DEFAULT = os.path.dirname(HERE)
W = 16              # window; the originals are indexed every W bytes, targets probed at every offset -> runs >= 2W-1 found
MIN_DISTINCT = 6
TEXT = set(range(0x20, 0x7F)) | {9, 10, 13}
BAD_EXT = ('.png', '.pdf', '.exe', '.dax', '.ovr', '.sav', '.itm', '.spc', '.swg', '.fx', '.guy', '.cha', '.hil', '.dat',
           '.bin', '.gif', '.jpg', '.bmp', '.zip')
BAD_PREFIX = ('decode/listings/', 'decode/data/png/', 'decode/bin/', 'decode/rt/', 'acceptance/ref/',
              'acceptance/local/', 'game/assets/saves/', 'herdr/', 'ghidra_proj/')
BAD_FILES = ('STATUS.md', 'FOREMAN.md', 'RULINGS.md', 'decode/ecl/runewheel.py', 'Play Curse of the Azure Bonds.cmd')
BAD_RX = re.compile(r'^decode/ecl/scripts/.*\.ecl\.txt$')   # the script listings (the game's texts); INDEX / FLAGMAP are ours
HEX_RX = re.compile(rb'(?:\b[0-9A-Fa-f]{2}(?:[ ,]+|$)){16,}|\b(?:[0-9a-f]{2}){16,}\b')
SECRET_RX = [('e-mail', re.compile(rb'[\w.+-]+@(?!users\.noreply\.github\.com|anthropic\.com)[\w-]+\.[a-z]{2,}', re.I)),
             ('token', re.compile(rb'\b(?:ghp_|gho_|github_pat_|sk-ant-|xox[bp]-|AKIA)[A-Za-z0-9_\-]{12,}')),
             ('private-key', re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----')),
             ('user-path', re.compile(rb'(?i)c:[\\/]+users[\\/]+[a-z]|/mnt/c/users/|/home/[a-z]+/'))]
JOURNAL_HEAD = re.compile(rb'(?im)^\s*(?:journal\s+)?entry\s+\d{1,3}[.:]?\s*$')


def originals(orig_dirs, ws):
    """name -> bytes: every original file (recursive) and every decoded DAX record, over every folder given (cab-v13: the
    v1.0 owner copy and the v1.3 CD copy; keys carry the folder index when there is more than one). v1.3's ST.EXE is
    EXEPACK packed: its unpacked image is indexed too (decode/tools/unexepack.py), so neither form may leak."""
    sys.path.insert(0, os.path.join(ws, 'decode', 'tools'))
    import dax  # noqa: E402
    out = {}
    dirs = list(orig_dirs) if isinstance(orig_dirs, (list, tuple)) else [orig_dirs]
    for i, orig_dir in enumerate(dirs):
        pre = '' if len(dirs) == 1 else f'{i}:'
        for root, _, files in os.walk(orig_dir):
            for f in files:
                p = os.path.join(root, f)
                with open(p, 'rb') as fh:
                    out[pre + os.path.relpath(p, orig_dir).replace('\\', '/').upper()] = fh.read()
                if f.upper() == 'ST.EXE':
                    try:
                        import unexepack  # noqa: E402
                        out[pre + 'ST.EXE:UNPACKED'] = unexepack.unpack(out[pre + 'ST.EXE'])[0]
                    except Exception as e:  # noqa: BLE001
                        print('warning: ST.EXE not unpacked for the gate:', e)
    for name in [n for n in out if n.endswith('.DAX')]:
        data = out[name]
        try:
            _, entries = dax.read_dir(data)
        except Exception:
            continue
        for e in entries:
            try:
                out[f"{name}#{e['id']}"] = bytes(dax.record(data, e)[0])
            except Exception:
                pass
    return out


def build_index(orig):
    idx = {}
    for name, b in orig.items():
        for i in range(0, len(b) - W + 1, W):
            w = b[i:i + W]
            if len(set(w)) >= MIN_DISTINCT:
                idx.setdefault(w, (name, i))
    return idx


def derived_hashes(orig, ws):
    hs = {hashlib.sha256(b).hexdigest(): n for n, b in orig.items()}
    for root, dirs, files in os.walk(ws):
        dirs[:] = [d for d in dirs if d not in ('.git', 'node_modules', 'ghidra_proj')]
        rel = os.path.relpath(root, ws).replace('\\', '/')
        for f in files:
            if f.lower().endswith(BAD_EXT) or rel.startswith(('decode/bin', 'acceptance/local')):
                p = os.path.join(root, f)
                try:
                    with open(p, 'rb') as fh:
                        hs.setdefault(hashlib.sha256(fh.read()).hexdigest(), 'workspace:' + os.path.relpath(p, ws).replace('\\', '/'))
                except OSError:
                    pass
    for mf in ('manifest-cab-1.0.json', 'manifest-cab-1.3.json'):   # the BYOC manifests' lists of original-file hashes (cab-v13: both)
        try:
            man = json.load(open(os.path.join(ws, 'game', 'byoc', mf), encoding='utf-8'))
            for name, f in man.get('files', {}).items():
                for k in ('sha256', 'sha256Patched', 'sha256Retail'):
                    if isinstance(f.get(k), str):
                        hs.setdefault(f[k].lower(), 'manifest:' + name)
        except (OSError, ValueError):
            pass
    return hs


def runs(b, idx, orig):
    """maximal runs shared with the originals: [(offset, length, text_only, source)]"""
    found, i, n = [], 0, len(b)
    while i <= n - W:
        hit = idx.get(b[i:i + W])
        if hit is None:
            i += 1
            continue
        name, j = hit
        src = orig[name]
        s, t = i, j
        while s > 0 and t > 0 and b[s - 1] == src[t - 1]:
            s -= 1; t -= 1
        e, u = i + W, j + W
        while e < n and u < len(src) and b[e] == src[u]:
            e += 1; u += 1
        if e - s >= 2 * W - 1:
            seg = b[s:e]
            found.append((s, e - s, all(c in TEXT for c in seg), name))
        i = e
    return found


def hexdumps(b, idx, orig):
    out = []
    for m in HEX_RX.finditer(b):
        digits = re.sub(rb'[^0-9A-Fa-f]', b'', m.group(0))
        raw = bytes.fromhex(digits.decode()) if len(digits) % 2 == 0 else b''
        if len(raw) < 16:
            continue
        best = max((r[1] for r in runs(raw, idx, orig)), default=0)
        if best == 0:
            for src in orig.values():
                if raw[:16] in src:
                    best = 16
                    break
        if best:
            out.append((m.start(), len(raw), best))
    return out


def journal_like(b):
    """three or more journal-entry headings, each followed by at least 100 characters of prose before the next one"""
    heads = [m.end() for m in JOURNAL_HEAD.finditer(b)]
    if len(heads) < 3:
        return 0
    prose = 0
    for k, h in enumerate(heads):
        body = b[h:heads[k + 1] if k + 1 < len(heads) else len(b)]
        if len(re.sub(rb'\s+', b' ', body).strip()) >= 100 and re.search(rb'[a-z]{3,} [a-z]{3,} [a-z]{3,}', body, re.I):
            prose += 1
    return prose if prose >= 3 else 0


def git(repo, *a, data=None):
    return subprocess.run(['git', '-C', repo] + list(a), input=data, capture_output=True, check=True).stdout


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('repo')
    ap.add_argument('--originals', action='append')
    ap.add_argument('--workspace', default=WS_DEFAULT)
    ap.add_argument('--json')
    a = ap.parse_args()
    if not a.originals:                                  # cab-v13: default = the v1.0 owner copy + the v1.3 CD copy when present
        rt = os.path.join(os.path.dirname(WS_DEFAULT), 're-targets', 'goldbox')
        a.originals = [os.environ.get('CAB_DATA', os.path.join(rt, 'cotab', 'curazure'))]
        cd = os.environ.get('CAB_V13_DATA', os.path.join(rt, 'adnd-collectors-cd', 'WIZWORKS', 'CURSE'))
        if os.path.isfile(os.path.join(cd, 'ST.EXE')):
            a.originals.append(cd)
    for d in a.originals:
        if not (os.path.isfile(os.path.join(d, 'START.EXE')) or os.path.isfile(os.path.join(d, 'ST.EXE'))):
            sys.exit(f'originals not found: {d} (START.EXE / ST.EXE missing); the gate needs the player copy to compare against')
    print('originals folders:', ', '.join(os.path.relpath(d, WS_DEFAULT).replace(os.sep, '/') for d in a.originals))
    orig = originals(a.originals, a.workspace)
    idx = build_index(orig)
    hashes = derived_hashes(orig, a.workspace)
    print(f'originals: {len(orig)} byte sources ({sum(len(b) for b in orig.values()):,} B), index {len(idx):,} windows, '
          f'{len(hashes):,} forbidden hashes')
    rep = {k: [] for k in ('path', 'hash', 'bytes', 'hexdump', 'large', 'secret', 'journal', 'text', 'shorthex')}
    paths = set(git(a.repo, 'log', '--all', '--name-only', '--format=').decode('utf-8', 'replace').split('\n')) - {''}
    for p in sorted(paths):
        if p.lower().endswith(BAD_EXT) or p.startswith(BAD_PREFIX) or p in BAD_FILES or BAD_RX.match(p):
            rep['path'].append(p)
    objs = git(a.repo, 'rev-list', '--all', '--objects').decode('utf-8', 'replace').split('\n')
    first = {}
    for line in objs:
        if ' ' in line:
            sha, path = line.split(' ', 1)
            first.setdefault(sha, path)
    types = git(a.repo, 'cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)', data='\n'.join(first).encode()).decode().split('\n')
    blobs = [t.split()[0] for t in types if ' blob ' in t]
    total = 0
    for sha in blobs:
        b = git(a.repo, 'cat-file', 'blob', sha)
        total += len(b)
        path = first[sha]
        h = hashlib.sha256(b).hexdigest()
        if h in hashes:
            rep['hash'].append({'path': path, 'blob': sha, 'equals': hashes[h]})
            continue
        ctrl = sum(1 for c in b if c not in TEXT and c < 0x80)
        if len(b) > 4096 and ctrl > len(b) // 100:
            rep['large'].append({'path': path, 'blob': sha, 'bytes': len(b), 'control_bytes': ctrl})
        for off, ln, text, src in runs(b, idx, orig):
            (rep['text'] if text else rep['bytes']).append({'path': path, 'blob': sha, 'offset': off, 'length': ln, 'source': src})
        if ctrl <= len(b) // 100:
            for off, ln, best in hexdumps(b, idx, orig):
                (rep['hexdump'] if best >= 32 else rep['shorthex']).append({'path': path, 'blob': sha, 'offset': off, 'dump_bytes': ln, 'match_bytes': best})
        if path not in ('tools/public_gate.py', 'tools/make_public_repo.py'):   # these name the patterns they look for / replace
            for kind, rx in SECRET_RX:
                for m in rx.finditer(b):
                    rep['secret'].append({'path': path, 'blob': sha, 'kind': kind, 'offset': m.start()})
        n = journal_like(b)
        if n:
            rep['journal'].append({'path': path, 'blob': sha, 'entries_with_prose': n})
    head_files = [f for f in git(a.repo, 'ls-files').decode('utf-8', 'replace').split('\n') if f]
    fail_keys = ('path', 'hash', 'bytes', 'hexdump', 'large', 'secret', 'journal')
    fail = any(rep[k] for k in fail_keys)
    summary = {'repo': os.path.abspath(a.repo), 'head_files': len(head_files), 'commits': int(git(a.repo, 'rev-list', '--all', '--count')),
               'blobs': len(blobs), 'blob_bytes': total, **{k: len(v) for k, v in rep.items()}, 'result': 'FAIL' if fail else 'PASS'}
    print(json.dumps(summary))
    for k in fail_keys:
        for r in rep[k][:20]:
            print(f'  {k.upper()}: {r}')
    by_file = {}
    for k in ('text', 'shorthex'):
        for r in rep[k]:
            by_file[(k, r['path'])] = by_file.get((k, r['path']), 0) + 1
    for (k, p), c in sorted(by_file.items()):
        print(f'  report {k}: {p} x{c}')
    if a.json:
        with open(a.json, 'w', encoding='utf-8') as f:
            json.dump({'summary': summary, **rep}, f, indent=1)
    sys.exit(1 if fail else 0)


if __name__ == '__main__':
    main()
