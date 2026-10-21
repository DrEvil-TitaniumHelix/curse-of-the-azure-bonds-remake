"""make_copies.py (cab-build-engine, step 0 of herdr/assignments/cab-plus-hooks.md) - scratch copies of the owner's Curse
folder for the BYOC import UI test (acceptance/byoc/BYOC-TEST.md). The original folder is only read; every copy goes to the
gitignored acceptance/local/byoc/<case>/ (original bytes never leave acceptance/local/).

  owner      the owner's folder as it is (GAME.OVR byte 0x4A56 = EBh, the patched rune-wheel jump)
  retail74   GAME.OVR 0x4A56 = 74h (the unpatched retail byte; manifest-cab-1.0 accepts both, CR-2 A)
  badbyte    GAME.OVR 0x4A56 = 75h (any other byte: must be refused)
  otherver   START.EXE version string 'Curse of the Azure Bonds v1.0' -> 'v1.1' (a simulated other release: no other
             version of the game is on this machine)

Usage: python -I acceptance/byoc/make_copies.py [source folder]   (default ../re-targets/goldbox/cotab/curazure)
"""
import hashlib, json, os, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(ROOT), 're-targets', 'goldbox', 'cotab', 'curazure')
OUT = os.path.join(ROOT, 'acceptance', 'local', 'byoc')
VERSION_AT = 0x7B7 + len('Curse of the Azure Bonds v1.')   # START.EXE: the '0' of 'v1.0'


def patch(case, name, offset, value):
    p = os.path.join(OUT, case, name)
    b = bytearray(open(p, 'rb').read())
    old = b[offset]
    b[offset] = value
    open(p, 'wb').write(bytes(b))
    return {'file': name, 'offset': hex(offset), 'old': hex(old), 'new': hex(value)}


def main():
    names = sorted(f for f in os.listdir(SRC) if os.path.isfile(os.path.join(SRC, f)))
    log = {'source': os.path.relpath(SRC, ROOT).replace('\\', '/'), 'files': len(names), 'cases': {}}
    for case in ('owner', 'retail74', 'badbyte', 'otherver'):
        d = os.path.join(OUT, case)
        if os.path.isdir(d):
            shutil.rmtree(d)                       # only our own scratch folder under acceptance/local/byoc
        os.makedirs(d)
        for f in names:
            shutil.copyfile(os.path.join(SRC, f), os.path.join(d, f))
        log['cases'][case] = []
    log['cases']['retail74'].append(patch('retail74', 'GAME.OVR', 0x4A56, 0x74))
    log['cases']['badbyte'].append(patch('badbyte', 'GAME.OVR', 0x4A56, 0x75))
    s = open(os.path.join(OUT, 'otherver', 'START.EXE'), 'rb').read()
    assert s[0x7B7:VERSION_AT + 1] == b'Curse of the Azure Bonds v1.0', s[0x7B7:VERSION_AT + 1]
    log['cases']['otherver'].append(patch('otherver', 'START.EXE', VERSION_AT, ord('1')))
    for case in log['cases']:
        h = hashlib.sha256()
        for f in names:
            h.update(f.encode() + b'\0' + open(os.path.join(OUT, case, f), 'rb').read())
        log['cases'][case] = {'patches': log['cases'][case], 'folderSha256': h.hexdigest()}
    print(json.dumps(log, indent=1))


if __name__ == '__main__':
    main()
