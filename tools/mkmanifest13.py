"""mkmanifest13.py: game/byoc/manifest-cab-1.3.json from the WizardWorks CD copy of Curse of the Azure Bonds v1.3
(decode/V13_DELTA.md, lane cab-v13). Sibling of tools/mkmanifest.py (v1.0); the v1.0 tool is untouched.

Reads the CD folder read-only (default re-targets/goldbox/adnd-collectors-cd/WIZWORKS/CURSE next to this repo, env
CAB_V13_DATA) and writes sizes + SHA-256 only (no game bytes).
  - ST.EXE is hashed AS SHIPPED (Microsoft EXEPACK packed, 57,789 B); the engine unpacks it at load like Pool's START.EXE
    (state.js `exepack: true`, Pool BYOC precedent). `exepack: true` is recorded on the entry for the importer/UI.
  - GAME.OVR: required, hashed, not stored (as v1.0). The rune-wheel branch byte is at 0x4A9C in v1.3 (JZ 74 = retail check
    enabled on the CD; EB would be the v1.0-style bypass patch): accepted as 74 or EB, hashed as 74, variant recorded.
  - ITEMS and every *.DAX: required + stored. CURSE.CFG, START.BAT, COPYCURS.EXE, DKK and SAVE/ are not listed.
Usage: python -I tools/mkmanifest13.py
"""
import hashlib, json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.environ.get('CAB_V13_DATA') or os.path.join(os.path.dirname(ROOT), 're-targets', 'goldbox', 'adnd-collectors-cd',
                                                        'WIZWORKS', 'CURSE')
NORM = {'file': 'GAME.OVR', 'offset': 0x4A9C, 'accept': [0x74, 0xEB], 'hashAs': 0x74,
        'variants': {'116': 'retail', '235': 'patched-4A9C'}}

names = sorted(f.upper() for f in os.listdir(DATA) if os.path.isfile(os.path.join(DATA, f)))
want = ['ST.EXE', 'ITEMS'] + [n for n in names if n.endswith('.DAX')] + ['GAME.OVR']
files = {}
for n in want:
    real = next(f for f in os.listdir(DATA) if f.upper() == n)
    b = bytearray(open(os.path.join(DATA, real), 'rb').read())
    e = {'size': len(b)}
    if n == NORM['file']:
        assert b[NORM['offset']] in NORM['accept'], 'GAME.OVR byte 0x4A9C is neither 74 nor EB'
        b[NORM['offset']] = NORM['hashAs']
        e['store'] = False
    if n == 'ST.EXE':
        assert b[:2] == b'MZ' and b[0x18:0x1A] != b'RB'
        e['exepack'] = True
        e['unpackedSize'] = 62432          # load module after decode/tools/unexepack.py (0xF3E paragraphs)
    e['sha256'] = hashlib.sha256(bytes(b)).hexdigest()
    e['required'] = True
    files[n] = e
man = {
    'id': 'cab-1.3',
    'title': 'Curse of the Azure Bonds (SSI), version 1.3 (ST.EXE string 0000:0006; WizardWorks / AD&D Collectors CD)',
    'note': 'SHA-256 of the files the engine reads (decode/V13_DELTA.md section 4). Our data, no game bytes. ST.EXE is '
            'EXEPACK packed and hashed as shipped (the engine unpacks it, Pool precedent). GAME.OVR is checked (byte 0x4A9C '
            'normalised: 74 retail / EB patched, hashed as 74) but not stored; CURSE.CFG is built by the engine. 83 of the '
            '90 files are byte-identical to v1.0 (same hashes as manifest-cab-1.0.json).',
    'requiredCount': len(files),
    'normalize': [NORM],
    'files': files,
}
out = os.path.join(ROOT, 'game', 'byoc', 'manifest-cab-1.3.json')
with open(out, 'w', encoding='utf-8', newline='\n') as f:
    json.dump(man, f, indent=1)
    f.write('\n')
print(out, len(files), 'files')
