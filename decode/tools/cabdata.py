#!/usr/bin/env python3
"""Structural checks + inventories for the non-picture DAX groups of Curse of the Azure Bonds.

Reads the extracted records in decode/bin/dax/<FILE>/<id>.bin (run `dax.py extract` first) and,
for ITEMS, the original file. Prints markdown fragments used in decode/data/*.md.

Usage:
  cabdata.py geo | walldef | ecl | item | mon | items GAMEDIR [POOLDIR] | all GAMEDIR [POOLDIR]
"""
import os
import sys

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', '..'))
BIN = os.path.join(ROOT, 'decode', 'bin', 'dax')


def group(prefix, suffix=''):
    """{file: {id: bytes}} for files <prefix><digit><suffix>."""
    out = {}
    for f in sorted(os.listdir(BIN)):
        mid = f[len(prefix):len(f) - len(suffix)] if suffix else f[len(prefix):]
        if f.startswith(prefix) and f.endswith(suffix) and mid.isdigit():
            d = os.path.join(BIN, f)
            out[f] = {int(x[:-4]): open(os.path.join(d, x), 'rb').read() for x in os.listdir(d)}
    return out


def pstr(b, o=0):
    return b[o + 1:o + 1 + b[o]].decode('latin1')


def geo():
    g = group('GEO')
    ids = [i for v in g.values() for i in v]
    print('| file | ids | sizes | header |')
    print('|---|---|---|---|')
    for f, v in g.items():
        print('| %s | %s | %s | %s |' % (f, ', '.join(map(str, sorted(v))), sorted(set(map(len, v.values()))),
                                        sorted(set(b[:2].hex(' ') for b in v.values()))))
    print('\nrecords=%d, ids unique across files: %s' % (len(ids), len(ids) == len(set(ids))))
    return g


def walldef():
    w, x = group('WALLDEF'), group('8X8D')
    print('| file | id | bytes | blocks | max byte | paired 8X8D records |')
    print('|---|---|---|---|---|---|')
    ok = True
    for f, v in w.items():
        n = f[-1]
        for i, b in sorted(v.items()):
            blocks, rem = divmod(len(b), 780)
            want = [i] if blocks == 1 else [(10 if i == 0 else i) * 10 + k for k in range(1, blocks + 1)]
            have = all(k in x['8X8D' + n] for k in want)
            ok &= have and rem == 0
            print('| %s | %d | %d | %d%s | %d | %s %s |' % (f, i, len(b), blocks, '' if rem == 0 else ' rem %d' % rem,
                                                          max(b), ', '.join('8X8D%s/%d' % (n, k) for k in want),
                                                          'ok' if have else 'MISSING'))
    print('\n8X8D ids: ' + '; '.join('%s {%s}' % (f, ', '.join(map(str, sorted(v)))) for f, v in x.items()))
    print('all WALLDEF records multiples of 780 and paired: %s' % ok)


def ecl():
    e, g = group('ECL'), group('GEO')
    gids = {i: f for f, v in g.items() for i in v}
    print('| file | ids (raw bytes) | ids without GEO map |')
    print('|---|---|---|')
    for f, v in e.items():
        print('| %s | %s | %s |' % (f, ', '.join('%d (%d)' % (i, len(b)) for i, b in sorted(v.items())),
                                    ', '.join(str(i) for i in sorted(v) if i not in gids) or '-'))
    same = all(gids[i][-1] == f[-1] for f, v in e.items() for i in v if i in gids)
    eids = {i for v in e.values() for i in v}
    print('\nGEO ids without ECL: %s; ECL with GEO always in the same-numbered file: %s; max raw %d (buffer 0x1E00 + 2 skipped)'
          % (sorted(set(gids) - eids) or 'none', same, max(len(b) for v in e.values() for b in v.values())))


def item():
    it = group('ITEM')
    print('| file | id | items | rem | types (+2Eh) | stored names (+0, first 3) |')
    print('|---|---|---|---|---|---|')
    for f, v in it.items():
        for i, b in sorted(v.items()):
            n, rem = divmod(len(b), 63)
            print('| %s | %d | %d | %d | %s | %s |' % (f, i, n, rem, ' '.join('%02x' % b[k * 63 + 0x2E] for k in range(n)),
                                                    '; '.join(pstr(b, k * 63) for k in range(min(3, n)))))


def mon():
    cha, itm, spc = group('MON', 'CHA'), group('MON', 'ITM'), group('MON', 'SPC')
    sizes = sorted(set(len(b) for v in cha.values() for b in v.values()))
    print('CHA sizes %s; ITM multiples of 63: %s; SPC multiples of 9: %s; every ITM/SPC id has a CHA: %s\n' % (
        sizes, all(len(b) % 63 == 0 for v in itm.values() for b in v.values()),
        all(len(b) % 9 == 0 for v in spc.values() for b in v.values()),
        all(i in cha[f[:4] + 'CHA'] for d in (itm, spc) for f, v in d.items() for i in v)))
    print('| set | id | name (Pascal string @0) | ITM items | SPC entries (type bytes) |')
    print('|---|---|---|---|---|')
    for f, v in cha.items():
        n = f[3]
        for i, b in sorted(v.items()):
            ib = itm.get('MON%sITM' % n, {}).get(i)
            sb = spc.get('MON%sSPC' % n, {}).get(i)
            print('| %s | %d | %s | %s | %s |' % (n, i, pstr(b), len(ib) // 63 if ib else '-',
                                                 '%d (%s)' % (len(sb) // 9, ' '.join('%02x' % sb[k * 9] for k in range(len(sb) // 9)))
                                                 if sb else '-'))


def items(gamedir, pooldir=None):
    c = open(os.path.join(gamedir, 'ITEMS'), 'rb').read()
    print('ITEMS: %d bytes, first 2 bytes %s, 128 x 16 = %d' % (len(c), c[:2].hex(' '), len(c) - 2))
    if not pooldir:
        return
    p = open(os.path.join(pooldir, 'ITEMS'), 'rb').read()
    only80, other = [], []
    for t in range(128):
        a, b = bytearray(p[2 + 16 * t:18 + 16 * t]), bytearray(c[2 + 16 * t:18 + 16 * t])
        if a == b:
            continue
        a2 = bytearray(a)
        a2[13] |= 0x80
        (only80 if a2 == b else other).append(t)
    print('rows identical to Pool: %d; differing only by j13 |= 80h: %d; other differences: %d\n'
          % (128 - len(only80) - len(other), len(only80), len(other)))
    print('| t | Pool j0..j15 | CAB j0..j15 | changed j |')
    print('|---|---|---|---|')
    for t in other:
        a, b = p[2 + 16 * t:18 + 16 * t], c[2 + 16 * t:18 + 16 * t]
        print('| %d | `%s` | `%s` | %s |' % (t, a.hex(' '), b.hex(' '), ', '.join(str(j) for j in range(16) if a[j] != b[j])))


def main(argv):
    if len(argv) < 2:
        print(__doc__)
        return 1
    cmd = argv[1]
    fns = {'geo': geo, 'walldef': walldef, 'ecl': ecl, 'item': item, 'mon': mon}
    if cmd in fns:
        fns[cmd]()
    elif cmd == 'items':
        items(*argv[2:4])
    elif cmd == 'all':
        for k in ('geo', 'walldef', 'ecl', 'item', 'mon'):
            print('\n## %s\n' % k)
            fns[k]()
        print('\n## items\n')
        items(*argv[2:4])
    else:
        print(__doc__)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
