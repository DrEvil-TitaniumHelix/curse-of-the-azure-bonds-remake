#!/usr/bin/env python3
"""DAX container tool for Pool of Radiance (SSI Gold Box, 1988).

Format (derived from bytes, see decode/data/DAX.md):
  u16 LE  dir_size            (bytes of directory that follows; = 9 * entry count)
  dir_size/9 entries of 9 bytes:
      u8      id              (record id)
      u32 LE  offset          (relative to start of data area = 2 + dir_size)
      u16 LE  raw_size        (decompressed size)
      u16 LE  comp_size       (stored size)
  data area: records, RLE-compressed (PackBits-like, see rle_decode)

Usage:
  dax.py list FILE.DAX [...]
  dax.py extract FILE.DAX [...] [--out DIR]   (default decode/bin/dax/<FILE>/<id>.bin)
  dax.py verify DIR                           (all *.DAX in DIR; prints table)
  dax.py roundtrip DIR                        (re-encode every record with rle_encode, re-pack
                                               each file, compare bytes with the original)
"""
import os
import struct
import sys

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', '..'))
DEFAULT_OUT = os.path.join(ROOT, 'decode', 'bin', 'dax')


class DaxError(Exception):
    pass


def read_dir(data):
    if len(data) < 2:
        raise DaxError('short file')
    dir_size = struct.unpack_from('<H', data, 0)[0]
    if dir_size % 9:
        raise DaxError('dir_size %d not a multiple of 9' % dir_size)
    base = 2 + dir_size
    entries = []
    for i in range(dir_size // 9):
        rid, off, raw, comp = struct.unpack_from('<BIHH', data, 2 + 9 * i)
        entries.append({'index': i, 'id': rid, 'offset': off, 'file_offset': base + off,
                        'raw_size': raw, 'comp_size': comp})
    return dir_size, entries


def rle_decode(src, raw_size=None):
    """Faithful to the engine decompressor START.EXE 0802:050F (see DAX.md):
    loop while src index < comp_size; control byte c read as signed:
      0x00..0x7E -> copy next c+1 literal bytes
      0x81..0xFF -> repeat next byte (256-c) times
      0x7F, 0x80 -> engine does nothing and never advances (would hang); never
                    present in shipped data; raised as an error here.
    raw_size is only used for checking by callers."""
    out = bytearray()
    i = 0
    n = len(src)
    while i < n:
        c = src[i]
        if c <= 0x7E:
            out += src[i + 1:i + 2 + c]
            i += c + 2
        elif c >= 0x81:
            out += bytes([src[i + 1]]) * (0x100 - c)
            i += 2
        else:
            raise DaxError('control byte 0x%02x at %d (engine would hang)' % (c, i))
    return bytes(out), i


def rle_encode(raw):
    """Inverse of rle_decode that reproduces the shipped SSI encoder byte for byte
    (Curse of the Azure Bonds: 824/824 records, see decode/data/DAX.md section 2a).
    Rules recovered from the bytes, not from code:
      - a run of >= 2 equal bytes becomes a repeat token (max 127 per token);
      - other bytes collect into literal tokens of at most 126 bytes (never 127);
      - the final run of the record is always a repeat token, even a run of 1."""
    out = bytearray()
    lit = bytearray()
    i = 0
    n = len(raw)

    def flush():
        while lit:
            chunk = lit[:126]
            del lit[:126]
            out.append(len(chunk) - 1)
            out.extend(chunk)

    while i < n:
        j = i
        while j < n and raw[j] == raw[i] and j - i < 127:
            j += 1
        if j - i >= 2 or j == n:
            flush()
            out.append(0x100 - (j - i))
            out.append(raw[i])
            i = j
        else:
            lit.append(raw[i])
            i += 1
            if len(lit) == 126:
                flush()
    flush()
    return bytes(out)


def repack(ents, blobs):
    """Rebuild a DAX file from directory entries (order, ids, offsets kept) and compressed blobs."""
    head = bytearray(struct.pack('<H', 9 * len(ents)))
    body = bytearray()
    for e, b in zip(ents, blobs):
        head += struct.pack('<BIHH', e['id'], e['offset'], e['raw_size'], len(b))
        if e['offset'] != len(body):
            raise DaxError('id %d: offset %d not contiguous (%d)' % (e['id'], e['offset'], len(body)))
        body += b
    return bytes(head + body)


def load(path):
    with open(path, 'rb') as f:
        data = f.read()
    dir_size, entries = read_dir(data)
    return data, dir_size, entries


def record(data, e):
    src = data[e['file_offset']:e['file_offset'] + e['comp_size']]
    out, used = rle_decode(src, e['raw_size'])
    return out, used, src


def cmd_list(paths):
    for p in paths:
        data, dsz, ents = load(p)
        print('%s  size=%d dir=%d entries=%d' % (os.path.basename(p), len(data), dsz, len(ents)))
        for e in ents:
            out, used, _ = record(data, e)
            print('  id=%3d (0x%02x) off=0x%05x raw=%6d comp=%6d decoded=%6d used=%6d %s' % (
                e['id'], e['id'], e['file_offset'], e['raw_size'], e['comp_size'], len(out), used,
                'OK' if len(out) == e['raw_size'] and used == e['comp_size'] else 'MISMATCH'))


def cmd_extract(paths, outroot):
    for p in paths:
        data, dsz, ents = load(p)
        name = os.path.splitext(os.path.basename(p))[0]
        d = os.path.join(outroot, name)
        os.makedirs(d, exist_ok=True)
        for e in ents:
            out, _, _ = record(data, e)
            with open(os.path.join(d, '%d.bin' % e['id']), 'wb') as f:
                f.write(out)
        print('%s: %d records -> %s' % (name, len(ents), d))


def verify_file(p):
    data, dsz, ents = load(p)
    ok = 0
    exact_used = 0
    end = 2 + dsz
    for e in ents:
        out, used, _ = record(data, e)
        if len(out) == e['raw_size']:
            ok += 1
        if used == e['comp_size']:
            exact_used += 1
        end = max(end, e['file_offset'] + e['comp_size'])
    ids = [e['id'] for e in ents]
    return {'name': os.path.basename(p), 'size': len(data), 'entries': len(ents), 'ok': ok,
            'used_exact': exact_used, 'end': end, 'ids': ids,
            'raw_total': sum(e['raw_size'] for e in ents)}


def cmd_verify(d):
    rows = []
    for fn in sorted(os.listdir(d)):
        if fn.upper().endswith('.DAX'):
            rows.append(verify_file(os.path.join(d, fn)))
    print('| file | bytes | records | decoded to raw_size | comp fully consumed | dir+data == file size | raw total |')
    print('|---|---|---|---|---|---|---|')
    allgood = True
    for r in rows:
        good = r['ok'] == r['entries'] and r['end'] == r['size']
        allgood &= good
        print('| %s | %d | %d | %d/%d | %d/%d | %s | %d |' % (
            r['name'], r['size'], r['entries'], r['ok'], r['entries'], r['used_exact'], r['entries'],
            'yes' if r['end'] == r['size'] else 'NO (end=%d)' % r['end'], r['raw_total']))
    tot = sum(r['entries'] for r in rows)
    print()
    print('files=%d records=%d all_ok=%s' % (len(rows), tot, allgood))
    return allgood


def cmd_roundtrip(d):
    """Decode every record, re-encode with rle_encode, re-pack the file, compare with the original."""
    files = recs = rec_exact = file_exact = 0
    for fn in sorted(os.listdir(d)):
        if not fn.upper().endswith('.DAX'):
            continue
        data, dsz, ents = load(os.path.join(d, fn))
        blobs = []
        for e in ents:
            out, used, src = record(data, e)
            b = rle_encode(out)
            recs += 1
            if b == src:
                rec_exact += 1
            else:
                print('%s id=%d: re-encode differs (%d vs %d bytes)' % (fn, e['id'], len(b), len(src)))
            blobs.append(b)
        files += 1
        try:
            same = repack(ents, blobs) == data
        except DaxError as ex:
            print('%s: %s' % (fn, ex))
            same = False
        file_exact += same
        if not same:
            print('%s: re-packed file differs' % fn)
    print('files=%d byte-identical=%d  records=%d re-encoded byte-identical=%d' % (files, file_exact, recs, rec_exact))
    return files == file_exact and recs == rec_exact


def main(argv):
    if len(argv) < 2:
        print(__doc__)
        return 1
    cmd = argv[1]
    args = [a for a in argv[2:] if not a.startswith('--')]
    if cmd == 'list':
        cmd_list(args)
    elif cmd == 'extract':
        out = DEFAULT_OUT
        if '--out' in argv:
            out = argv[argv.index('--out') + 1]
            args = [a for a in args if a != out]
        cmd_extract(args, out)
    elif cmd == 'verify':
        return 0 if cmd_verify(args[0]) else 2
    elif cmd == 'roundtrip':
        return 0 if cmd_roundtrip(args[0]) else 2
    else:
        print(__doc__)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
