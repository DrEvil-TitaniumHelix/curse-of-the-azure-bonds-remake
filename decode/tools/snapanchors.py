"""snapanchors.py FILE [--apply] [--map seg:off=off,...] : move every `{ seg:off }` anchor token (incl. `/ off` and `.. off`) that
is not an instruction start to the start of the instruction containing it. --map overrides single tokens."""
import re, sys, glob
sys.stdout.reconfigure(encoding='utf-8')
import os
R = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')) + '/'
p = sys.argv[1]; apply = '--apply' in sys.argv
override = {}
if '--map' in sys.argv:
    for kv in sys.argv[sys.argv.index('--map') + 1].split(','):
        k, v = kv.split('='); override[k.lower()] = v.lower()
text = open(p, encoding='utf-8').read()
segs = set(re.findall(r'\{ ?([0-9a-f]{4}):[0-9a-f]{4}', text))
lst = {}
for f in glob.glob(R + 'decode/listings/*.lst'):
    for ln in open(f, encoding='latin-1'):
        m = re.match(r'^  ([0-9a-f]{4}):([0-9a-f]{4})  ([0-9a-f]+)\s', ln)
        if m and m[1] in segs: lst.setdefault(m[1], {})[int(m[2], 16)] = len(m[3]) // 2
n = snapped = unfixed = 0; log = []
def fix(m):
    global n, snapped, unfixed
    body = m[1]
    sm = re.match(r'\s*([0-9a-f]{4}):', body)
    if not sm or sm[1] not in lst: return m[0]
    seg = sm[1]; d = lst[seg]
    def tok(t):
        global n, snapped, unfixed
        a = t[0]
        if a == seg: return a
        key = seg + ':' + a
        if key in override: snapped += 1; log.append('%s -> %s (map)' % (key, override[key])); return override[key]
        o = int(a, 16); n += 1
        if o in d: return a
        prev = max([k for k in d if k < o], default=None)
        if prev is not None and o < prev + d[prev]:
            snapped += 1; log.append('%s -> %04x' % (key, prev)); return '%04x' % prev
        unfixed += 1; log.append('%s UNFIXED' % key); return a
    head = body[:body.index(':') + 1]
    rest = re.sub(r'(?<![0-9a-f])([0-9a-f]{4})(?![0-9a-f])', tok, body[body.index(':') + 1:])
    return '{' + head + rest + '}'
out = re.sub(r'\{([^}]*)\}', fix, text)
for l in log: print(l)
print('tokens', n, 'snapped', snapped, 'unfixed', unfixed)
if apply:
    open(p, 'w', encoding='utf-8', newline='\n').write(out); print('written')
