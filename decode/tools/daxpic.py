#!/usr/bin/env python3
"""Render Pool of Radiance DAX picture records to PNG (EGA 16-colour default palette).

Record kinds (see decode/data/PICTURES.md):
  P  picture/tile set : 17-byte header + count frames of h*w*4 bytes (4bpp, hi nibble = left pixel)
  A  animation        : u8 count, then count x (u32 delay, P-record)
  F  1bpp 8x8 font/glyph set (8X8D1/201): 8 bytes per glyph, bit 7 = leftmost pixel

Usage:
  daxpic.py render [GROUP ...]   (decode/bin/dax/<FILE>/<id>.bin -> decode/data/png/<GROUP>/<FILE>_<id>.png)
  daxpic.py info FILE/ID
The PNG index is written to decode/data/png/INDEX.md.
"""
import os
import re
import struct
import sys

from PIL import Image

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', '..'))
BIN = os.path.join(ROOT, 'decode', 'bin', 'dax')
PNG = os.path.join(ROOT, 'decode', 'data', 'png')

# Standard IBM EGA default palette (colour index 0..15).
EGA = [(0x00, 0x00, 0x00), (0x00, 0x00, 0xAA), (0x00, 0xAA, 0x00), (0x00, 0xAA, 0xAA),
       (0xAA, 0x00, 0x00), (0xAA, 0x00, 0xAA), (0xAA, 0x55, 0x00), (0xAA, 0xAA, 0xAA),
       (0x55, 0x55, 0x55), (0x55, 0x55, 0xFF), (0x55, 0xFF, 0x55), (0x55, 0xFF, 0xFF),
       (0xFF, 0x55, 0x55), (0xFF, 0x55, 0xFF), (0xFF, 0xFF, 0x55), (0xFF, 0xFF, 0xFF)]
GAP = (0x30, 0x10, 0x30)  # separator colour between frames (not an EGA colour)

FONT_RECORDS = {('8X8D1', 201)}


def group_of(name):
    return re.sub(r'\d+$', '', name)


def parse_p(b, o=0):
    h, w, x, y, n = struct.unpack_from('<HHHHB', b, o)
    cmap = b[o + 9:o + 17]
    size = 17 + n * h * w * 4
    return {'h': h, 'w8': w, 'x': x, 'y': y, 'count': n, 'cga_map': cmap.hex(), 'size': size, 'off': o}


def classify(b):
    if len(b) >= 17:
        p = parse_p(b)
        if p['size'] == len(b) and p['h'] and p['w8']:
            return 'P', [p]
    if len(b) > 22:
        o = 1
        frames = []
        for _ in range(b[0]):
            if o + 21 > len(b):
                return '?', None
            delay = struct.unpack_from('<I', b, o)[0]
            p = parse_p(b, o + 4)
            p['delay'] = delay
            frames.append(p)
            o += 4 + p['size']
        if o == len(b):
            return 'A', frames
    return '?', None


def frame_pixels(b, p, k):
    """pixel rows of frame k of P-record p."""
    h, w = p['h'], p['w8'] * 8
    base = p['off'] + 17 + k * h * w // 2
    rows = []
    for yy in range(h):
        r = []
        row = b[base + yy * w // 2: base + (yy + 1) * w // 2]
        for byte in row:
            r.append(byte >> 4)
            r.append(byte & 15)
        rows.append(r)
    return rows


def sheet(frames, per_row):
    """frames: list of pixel-row lists (EGA indices). Tiles with 1px gaps."""
    fw = max(len(f[0]) for f in frames)
    fh = max(len(f) for f in frames)
    cols = min(per_row, len(frames))
    rows = (len(frames) + cols - 1) // cols
    W = cols * fw + (cols - 1)
    H = rows * fh + (rows - 1)
    img = Image.new('RGB', (W, H), GAP)
    px = img.load()
    for i, f in enumerate(frames):
        ox = (i % cols) * (fw + 1)
        oy = (i // cols) * (fh + 1)
        for yy, r in enumerate(f):
            for xx, c in enumerate(r):
                px[ox + xx, oy + yy] = EGA[c]
    return img


def font_frames(b):
    out = []
    for g in range(len(b) // 8):
        f = []
        for yy in range(8):
            v = b[g * 8 + yy]
            f.append([15 if v & (0x80 >> xx) else 0 for xx in range(8)])
        out.append(f)
    return out


def render_record(fname, rid, b):
    if (fname, rid) in FONT_RECORDS:
        return 'F', {'glyphs': len(b) // 8}, sheet(font_frames(b), 16)
    kind, parts = classify(b)
    if kind == 'P':
        p = parts[0]
        frames = [frame_pixels(b, p, k) for k in range(p['count'])]
        per = 16 if p['h'] <= 24 else 8
        return kind, p, sheet(frames, per)
    if kind == 'A':
        frames = []
        for p in parts:
            for k in range(p['count']):
                frames.append(frame_pixels(b, p, k))
        if re.sub(r'\d+$', '', fname) in ('PIC', 'FINAL') and len(parts) > 1:
            # ov28_00A2 (AC00:0392..03D6): frames 2..n are XOR deltas of frame 1's pixel bytes (H)
            p1 = parts[0]
            base = b[p1['off'] + 17:p1['off'] + 17 + p1['h'] * p1['w8'] * 4]
            bb = bytearray(b)
            for p in parts[1:]:
                o = p['off'] + 17
                for i in range(min(len(base), p['h'] * p['w8'] * 4)):
                    bb[o + i] ^= base[i]
            frames = [frame_pixels(bytes(bb), p, 0) for p in parts]
            return kind, parts, sheet(frames, len(frames))
        return kind, parts, sheet(frames, 8)
    return kind, None, None


def describe(kind, info):
    if kind == 'P':
        return 'P %dx%d x%d at (%d,%d) cga_map=%s' % (info['w8'] * 8, info['h'], info['count'], info['x'],
                                                      info['y'], info['cga_map'])
    if kind == 'A':
        return 'A %d frames: ' % len(info) + '; '.join(
            '%dx%d@(%d,%d) d=%d' % (p['w8'] * 8, p['h'], p['x'], p['y'], p['delay']) for p in info)
    if kind == 'F':
        return 'F 1bpp 8x8 font, %d glyphs' % info['glyphs']
    return '?'


def render(groups=None):
    index = {}
    for fname in sorted(os.listdir(BIN)):
        g = group_of(fname)
        if groups and g not in groups:
            continue
        d = os.path.join(BIN, fname)
        for fn in sorted(os.listdir(d), key=lambda s: int(s.split('.')[0])):
            rid = int(fn.split('.')[0])
            b = open(os.path.join(d, fn), 'rb').read()
            kind, info, img = render_record(fname, rid, b)
            if img is None:
                continue
            od = os.path.join(PNG, g)
            os.makedirs(od, exist_ok=True)
            pn = '%s_%d.png' % (fname, rid)
            img.save(os.path.join(od, pn), optimize=True)
            index.setdefault(g, []).append((fname, rid, len(b), describe(kind, info), '%s/%s' % (g, pn)))
    return index


def write_index(index):
    lines = ['# PNG index (generated by decode/tools/daxpic.py)', '',
             'EGA default 16-colour palette, 1 px dark-magenta (#301030) gap between frames/tiles. '
             'P = picture/tile set, A = animation (frames left to right; PIC/FINAL frames 2..n XOR-decoded against frame 1 as in ov28_00A2), F = 1bpp font. '
             'Format spec: ../PICTURES.md.', '']
    for g in sorted(index):
        lines.append('## %s' % g)
        lines.append('')
        lines.append('| record | bytes | layout | png |')
        lines.append('|---|---|---|---|')
        for fname, rid, n, desc, pn in index[g]:
            lines.append('| %s/%d | %d | %s | [%s](%s) |' % (fname, rid, n, desc, pn.split('/')[1], pn))
        lines.append('')
    with open(os.path.join(PNG, 'INDEX.md'), 'w', newline='\n') as f:
        f.write('\n'.join(lines))


def main(argv):
    if len(argv) >= 2 and argv[1] == 'render':
        idx = render(set(argv[2:]) or None)
        write_index(idx)
        print('groups=%d pngs=%d' % (len(idx), sum(len(v) for v in idx.values())))
        return 0
    if len(argv) >= 3 and argv[1] == 'info':
        fname, rid = argv[2].split('/')
        b = open(os.path.join(BIN, fname, rid + '.bin'), 'rb').read()
        kind, info = classify(b)
        print(kind, info)
        return 0
    print(__doc__)
    return 1


if __name__ == '__main__':
    sys.exit(main(sys.argv))
