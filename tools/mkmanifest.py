"""mkmanifest.py: game/byoc/manifest-cab-1.0.json from the owner's Curse of the Azure Bonds v1.0 copy (BUILD_PLAN §4).

Reads the original folder read-only (default re-targets/goldbox/cotab/curazure next to this repo, env CAB_DEV_DATA) and
writes sizes + SHA-256 only (no game bytes). Required + stored: START.EXE, ITEMS, every *.DAX. GAME.OVR: required,
hashed, not stored (O-3), with the CR-2 A normalisation of byte 0x4A56 (EB patched / 74 retail, hashed as 74; PER-5).
CURSE.CFG and the install tools are not listed (ignored by the importer).
Usage: python -I tools/mkmanifest.py
"""
import hashlib, json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.environ.get('CAB_DEV_DATA') or os.path.join(os.path.dirname(ROOT), 're-targets', 'goldbox', 'cotab', 'curazure')
NORM = {'file': 'GAME.OVR', 'offset': 0x4A56, 'accept': [0xEB, 0x74], 'hashAs': 0x74,
        'variants': {'235': 'patched-4A56', '116': 'retail'}}

names = sorted(f.upper() for f in os.listdir(DATA) if os.path.isfile(os.path.join(DATA, f)))
want = ['START.EXE', 'ITEMS'] + [n for n in names if n.endswith('.DAX')] + ['GAME.OVR']
files = {}
for n in want:
    real = next(f for f in os.listdir(DATA) if f.upper() == n)
    b = bytearray(open(os.path.join(DATA, real), 'rb').read())
    e = {'size': len(b)}
    if n == NORM['file']:
        assert b[NORM['offset']] in NORM['accept'], 'GAME.OVR byte 0x4A56 is neither EB nor 74'
        b[NORM['offset']] = NORM['hashAs']
        e['store'] = False
    e['sha256'] = hashlib.sha256(bytes(b)).hexdigest()
    e['required'] = True
    files[n] = e
man = {
    'id': 'cab-1.0',
    'title': 'Curse of the Azure Bonds (SSI), version 1.0 (START.EXE string 0000:0006)',
    'note': 'SHA-256 of the files the engine reads (BUILD_PLAN.md §4). Our data, no game bytes. GAME.OVR is checked '
            '(byte 0x4A56 normalised, CR-2 A) but not stored; CURSE.CFG is built by the engine.',
    'requiredCount': len(files),
    'normalize': [NORM],
    'files': files,
}
out = os.path.join(ROOT, 'game', 'byoc', 'manifest-cab-1.0.json')
with open(out, 'w', encoding='utf-8', newline='\n') as f:
    json.dump(man, f, indent=1)
    f.write('\n')
print(out, len(files), 'files')
