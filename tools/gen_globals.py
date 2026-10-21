"""gen_globals.py: decode/names/globals.json + resident_names.json (DS 0C1C globals) -> game/state/globals.json {"XXXX": "name"}.

Curse fork of Pool's generator (Pool read 0C7C names from the per-lane files; Curse keeps the merged DS names in
decode/names/globals.json, GLOBALS.md). Precedence: globals.json first, then resident_names.json; the generic g_XXXX
names are not emitted (state.js aliases g_XXXX to the named property itself).
Usage: python -I tools/gen_globals.py
"""
import json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NAMES = os.path.join(ROOT, 'decode', 'names')
ORDER = ['globals', 'resident_names']

out = {}
for lane in ORDER:
    p = os.path.join(NAMES, lane + '.json')
    if not os.path.exists(p):
        continue
    for k, v in json.load(open(p, encoding='utf-8')).items():
        m = re.fullmatch(r'0C1C:([0-9A-Fa-f]{4})', k)
        if not m or not isinstance(v, str) or re.fullmatch(r'g_[0-9A-Fa-f]{4}(_hi)?', v):
            continue
        a = m.group(1).upper()
        if a not in out and v not in out.values():
            out[a] = v
os.makedirs(os.path.join(ROOT, 'game', 'state'), exist_ok=True)
with open(os.path.join(ROOT, 'game', 'state', 'globals.json'), 'w', encoding='utf-8', newline='\n') as f:
    json.dump(dict(sorted(out.items())), f, indent=1)
print(len(out), 'named DS globals')
