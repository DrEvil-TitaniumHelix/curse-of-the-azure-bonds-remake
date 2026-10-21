#!/usr/bin/env python3
"""areas_route.py REF-ID [extra keys] (cab-build-areas): the build key route of a DOSBox-X reference, from its sidecar
acceptance/ref/REF-<id>.capture.json (`steps_so_far` = every drive.py step up to the capture). The DOSBox keys map 1:1 to
the dev key script (game/engine/dev.js parseKeys): Return {Enter}, Escape {Esc}, space {Space}, cursor keys {Left} ...,
letters as typed; `dismiss T n ok` pressed Return n times (the crowd texts and signs of that run) -> n x {Enter}; waits,
snaps and captures type nothing. A run that loaded a DOSBox save (L + letter at the top menu) needs ?loadsaves=1 and the
save served (tools/serve.py --saves DIR). Prints the keys. Usage (repo root): python -I acceptance/areas_route.py S097"""
import json, sys
from pathlib import Path

ref = Path(__file__).resolve().parent / 'ref'
ident = sys.argv[1] if sys.argv[1].startswith('REF-') else 'REF-' + sys.argv[1]
steps = json.loads((ref / f'{ident}.capture.json').read_text())['steps_so_far']
NAMED = {'Return': '{Enter}', 'Escape': '{Esc}', 'space': '{Space}', 'Left': '{Left}', 'Right': '{Right}', 'Up': '{Up}',
         'Down': '{Down}', 'Home': '{Home}', 'End': '{End}'}
out = []
for s in steps:
    op, *a = s.split()
    if op == 'key':
        for k in a:
            if k in NAMED: out.append(NAMED[k])
            elif len(k) == 1: out.append(k)
            else: raise SystemExit(f'{ident}: no dev key for {k!r}')
    elif op == 'type':
        out.append(s.split(None, 1)[1])
    elif op == 'dismiss':
        out.append('{Enter}' * int(a[1]))
print(''.join(out) + (sys.argv[2] if len(sys.argv) > 2 else ''))
