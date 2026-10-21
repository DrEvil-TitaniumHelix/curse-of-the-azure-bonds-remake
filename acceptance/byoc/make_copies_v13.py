"""make_copies_v13.py (cab-v13) - scratch copies of the WizardWorks CD copy of Curse (v1.3) for the BYOC import UI test
(acceptance/byoc/BYOC-TEST.md, decode/V13_DELTA.md 4.3 T3 / T4 / T5). The CD folder is only read; every copy goes to
the gitignored acceptance/local/byoc/<case>/ (original bytes never leave acceptance/local/). Sibling of make_copies.py
(the v1.0 cases), which is untouched.

  cd13         the CD folder as it is: ST.EXE (EXEPACK), GAME.OVR (FBOV, 0x4A9C = 74h retail check), 88 data files, SAVE/
  cd13patched  GAME.OVR 0x4A9C 74h -> EBh (the v1.0-style bypass patch applied to v1.3: manifest-cab-1.3 accepts both)
  mixed13      the CD's data files with the v1.0 START.EXE and GAME.OVR (a folder mixed from two versions: refused)

Usage: python -I acceptance/byoc/make_copies_v13.py [CD folder] [v1.0 folder]
  defaults ../re-targets/goldbox/adnd-collectors-cd/WIZWORKS/CURSE and ../re-targets/goldbox/cotab/curazure
"""
import hashlib, json, os, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
RT = os.path.join(os.path.dirname(ROOT), 're-targets', 'goldbox')
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(RT, 'adnd-collectors-cd', 'WIZWORKS', 'CURSE')
SRC10 = sys.argv[2] if len(sys.argv) > 2 else os.path.join(RT, 'cotab', 'curazure')
OUT = os.path.join(ROOT, 'acceptance', 'local', 'byoc')


def copy_tree(case, src, names, saves=True):
    d = os.path.join(OUT, case)
    if os.path.isdir(d):
        shutil.rmtree(d)                       # only our own scratch folder under acceptance/local/byoc
    os.makedirs(d)
    for f in names:
        shutil.copyfile(os.path.join(src, f), os.path.join(d, f))
    if saves and os.path.isdir(os.path.join(src, 'SAVE')):
        shutil.copytree(os.path.join(src, 'SAVE'), os.path.join(d, 'SAVE'))
    return d


def patch(case, name, offset, value):
    p = os.path.join(OUT, case, name)
    b = bytearray(open(p, 'rb').read())
    old = b[offset]
    b[offset] = value
    open(p, 'wb').write(bytes(b))
    return {'file': name, 'offset': hex(offset), 'old': hex(old), 'new': hex(value)}


def folder_hash(case):
    d = os.path.join(OUT, case)
    h = hashlib.sha256()
    for root, _, files in sorted(os.walk(d)):
        for f in sorted(files):
            p = os.path.join(root, f)
            h.update(os.path.relpath(p, d).replace('\\', '/').encode() + b'\0' + open(p, 'rb').read())
    return h.hexdigest()


def main():
    names = sorted(f for f in os.listdir(SRC) if os.path.isfile(os.path.join(SRC, f)))
    log = {'source': os.path.relpath(SRC, ROOT).replace('\\', '/'), 'files': len(names), 'cases': {}}
    copy_tree('cd13', SRC, names)
    log['cases']['cd13'] = {'patches': []}
    copy_tree('cd13patched', SRC, names)
    assert open(os.path.join(OUT, 'cd13patched', 'GAME.OVR'), 'rb').read()[0x4A9C] == 0x74, 'CD GAME.OVR 0x4A9C is not 74h'
    log['cases']['cd13patched'] = {'patches': [patch('cd13patched', 'GAME.OVR', 0x4A9C, 0xEB)]}
    mixed = [n for n in names if n.upper() not in ('ST.EXE', 'GAME.OVR', 'START.BAT', 'CURSE.CFG', 'COPYCURS.EXE', 'DKK')]
    copy_tree('mixed13', SRC, mixed, saves=False)
    for f in ('START.EXE', 'GAME.OVR'):
        real = next(x for x in os.listdir(SRC10) if x.upper() == f)
        shutil.copyfile(os.path.join(SRC10, real), os.path.join(OUT, 'mixed13', f))
    log['cases']['mixed13'] = {'patches': [], 'note': 'CD data files + v1.0 START.EXE and GAME.OVR'}
    for case in log['cases']:
        log['cases'][case]['folderSha256'] = folder_hash(case)
        log['cases'][case]['files'] = sum(len(fs) for _, _, fs in os.walk(os.path.join(OUT, case)))
    print(json.dumps(log, indent=1))


if __name__ == '__main__':
    main()
