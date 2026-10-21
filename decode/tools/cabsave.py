#!/usr/bin/env python3
"""Dump / diff Curse of the Azure Bonds save files (spec: decode/data/SAVES.md).

  savgam<k>.dat   13,149 B: DataSet(1) VM4B00(800h) VM7C00(800h) VM7A00(400h) CodeBuf(1E00h) MapXY..(5)
                  view_PrevMode(1) view_Mode(1) wallslots 3 x (word, word) count(1) names 8 x string[40]
  CHRDAT<k><n>.sav / <NAME>.guy   422-byte character record (PARTY.pas.md "Character record")
  .swg   n x 63-byte item records;   .fx   n x 9-byte effect records

Usage:
  cabsave.py dump DIR                 every save file in DIR
  cabsave.py diff DIR_A DIR_B         byte differences of same-named files, labelled with the field names
"""
import os
import struct
import sys

GAME = [  # (offset, size, name)
    (0x0000, 1, 'DataSet (DS:5BEE)'),
    (0x0001, 0x800, 'VM 4B00 region (ecl_Mem4B00^)'),
    (0x0801, 0x800, 'VM 7C00 region (ecl_Mem7C00^)'),
    (0x1001, 0x400, 'VM 7A00 region (ecl_Mem7A00^)'),
    (0x1401, 0x1E00, 'ecl_CodeBuf^ (current ECL block)'),
    (0x3201, 5, 'party_MapX.. (DS:720F..7213)'),
    (0x3206, 1, 'view_PrevMode (DS:4FBB)'),
    (0x3207, 1, 'view_Mode (DS:4FBA)'),
    (0x3208, 12, 'wall-set slots 1..3 (DS:7214+4i, DS:7216+4i words)'),
    (0x3214, 1, 'member count'),
    (0x3215, 0x148, 'member names array[1..8] of string[40]'),
]
GAME_SIZE = 0x335D

CHAR = [  # offset, size, name (PARTY.pas.md map; '?' = unknown there)
    (0x00, 16, 'name string[15]'), (0x10, 12, 'abilities max/cur x6 (STR INT WIS DEX CON CHA)'),
    (0x1C, 1, 'str_exc max'), (0x1D, 1, 'str_exc cur'), (0x1E, 84, 'mem_spell[0..83]'),
    (0x72, 1, 'rest_need'), (0x73, 1, 'base_thac0'), (0x74, 1, 'race'), (0x75, 1, 'class'), (0x76, 2, 'age'),
    (0x78, 1, 'hp_max'), (0x79, 100, 'known_spell[1..100]'), (0xDD, 1, 'fighter_lvl_eff'), (0xDE, 1, 'size'),
    (0xDF, 5, 'save[0..4]'), (0xE4, 1, 'base_move'), (0xE5, 1, 'level_main'), (0xE6, 1, 'level_main at class change'),
    (0xE7, 1, 'levels_drained'), (0xE8, 1, 'hp_drained'), (0xE9, 1, 'undead/ai type'), (0xEA, 8, 'thief_skill[1..8]'),
    (0xF2, 4, 'effects ptr (stale)'), (0xF6, 1, 'unk_F6'), (0xF7, 1, 'npc_morale'), (0xF8, 3, 'unk_F8..FA'),
    (0xFB, 14, 'money[0..6] words'), (0x109, 8, 'level[0..7]'), (0x111, 8, 'old_level[0..7]'), (0x119, 1, 'gender'),
    (0x11A, 1, 'creature_type'), (0x11B, 1, 'alignment'), (0x11C, 1, 'attacks'), (0x11D, 1, 'attacks2'),
    (0x11E, 6, 'base_dmg dice/sides/bonus x2'), (0x124, 1, 'base_ac'), (0x125, 1, 'STR bonus flag'), (0x126, 1, 'id'),
    (0x127, 4, 'xp'), (0x12B, 1, 'class_mask'), (0x12C, 1, 'hp_rolled'), (0x12D, 5, 'cleric slots 1..5'),
    (0x132, 3, 'druid slots 1..3'), (0x135, 2, 'unk_135..136'), (0x137, 5, 'mu slots 1..5'), (0x13C, 2, 'xp_value'),
    (0x13E, 1, 'xp_per_hp'), (0x13F, 4, 'head_pic body_pic icon_head icon_body'), (0x143, 1, 'unk_143'),
    (0x144, 1, 'icon_size'), (0x145, 6, 'icon_colours'), (0x14B, 1, 'monster-kind flags'), (0x14C, 1, 'item_count'),
    (0x14D, 4, 'items ptr (stale)'), (0x151, 52, 'readied[0..12] ptrs'), (0x185, 1, 'hands_used'),
    (0x186, 1, 'ac_item_bonus'), (0x187, 2, 'encumbrance'), (0x189, 4, 'next ptr (stale)'), (0x18D, 4, 'combatant ptr'),
    (0x191, 1, 'cures_left'), (0x192, 1, 'unk_192 (bit0 = ECL 7CE4)'), (0x193, 2, 'unk_193..194'), (0x195, 1, 'status'),
    (0x196, 1, 'active'), (0x197, 1, 'side'), (0x198, 1, 'controlled'), (0x199, 1, 'thac0'), (0x19A, 1, 'ac'),
    (0x19B, 1, 'ac_rear'), (0x19C, 2, 'attacks_left[1..2]'), (0x19E, 6, 'dmg dice/sides/bonus x2'), (0x1A4, 1, 'hp'),
    (0x1A5, 1, 'move'),
]
ITEM = [(0x00, 42, 'name string[40]'), (0x2A, 4, 'next (stale)'), (0x2E, 1, 'type'), (0x2F, 3, 'word[1..3]'),
        (0x32, 1, 'plus'), (0x33, 1, 'plus2'), (0x34, 1, 'readied'), (0x35, 1, 'hidden'), (0x36, 1, 'magic/cursed'),
        (0x37, 2, 'weight'), (0x39, 1, 'count'), (0x3A, 2, 'value'), (0x3C, 3, 'power[1..3]')]
EFFECT = [(0, 1, 'type'), (1, 2, 'duration'), (3, 1, 'p3'), (4, 1, 'callOnRemove'), (5, 4, 'next (stale)')]


def field(table, off, recsize=None):
    if recsize:
        k, off = divmod(off, recsize)
    for o, n, name in table:
        if o <= off < o + n:
            s = '%s +%d' % (name, off - o) if n > 1 else name
            return ('[%d] ' % k + s) if recsize else s
    return 'unk_%02X' % off


def kind(fn):
    f = fn.lower()
    if f.startswith('savgam') and f.endswith('.dat'):
        return GAME, None
    if f.endswith('.sav') or f.endswith('.guy'):
        return CHAR, None
    if f.endswith('.swg'):
        return ITEM, 63
    if f.endswith('.fx'):
        return EFFECT, 9
    return None, None


def pstr(b, o, cap):
    n = min(b[o], cap)
    return b[o + 1:o + 1 + n].decode('latin1')


def dump(d):
    for fn in sorted(os.listdir(d)):
        b = open(os.path.join(d, fn), 'rb').read()
        t, rs = kind(fn)
        print('== %s  %d bytes' % (fn, len(b)))
        if t is GAME:
            print('   size ok: %s; DataSet %d; MapXY.. %s; view_PrevMode %d view_Mode %d; wallslots %s; count %d' % (
                len(b) == GAME_SIZE, b[0], b[0x3201:0x3206].hex(' '), b[0x3206], b[0x3207],
                struct.unpack_from('<6H', b, 0x3208), b[0x3214]))
            print('   names: %s' % [pstr(b, 0x3215 + 41 * i, 40) for i in range(8)])
            print('   VM4B00 +1F8h (game speed) %02x, +1FEh (pics*2+anim) %04x; VM7C00 +624h (data set) %04x, +67Ch (party size) %04x' % (
                b[1 + 0x1F8], struct.unpack_from('<H', b, 1 + 0x1FE)[0], struct.unpack_from('<H', b, 0x801 + 0x624)[0],
                struct.unpack_from('<H', b, 0x801 + 0x67C)[0]))
        elif t is CHAR:
            print('   size ok: %s; name %r; race %d class %d gender %d align %d; STR %d/%d(%d) INT %d WIS %d DEX %d CON %d CHA %d' % (
                len(b) == 0x1A6, pstr(b, 0, 15), b[0x74], b[0x75], b[0x119], b[0x11B], b[0x10], b[0x11], b[0x1C],
                b[0x13], b[0x15], b[0x17], b[0x19], b[0x1B]))
            print('   hp %d/%d rolled %d; ac %d base_ac %d; thac0 %d; xp %d; levels %s; money %s; items %d; age %d; status %d' % (
                b[0x1A4], b[0x78], b[0x12C], b[0x19A], b[0x124], b[0x199], struct.unpack_from('<I', b, 0x127)[0],
                list(b[0x109:0x111]), list(struct.unpack_from('<7H', b, 0xFB)), b[0x14C], struct.unpack_from('<H', b, 0x76)[0], b[0x195]))
        elif t is ITEM:
            for k in range(len(b) // 63):
                r = b[63 * k:63 * k + 63]
                print('   item %d: type %02x words %s plus %d readied %d weight %d count %d value %d name %r' % (
                    k, r[0x2E], r[0x2F:0x32].hex(' '), r[0x32] - 256 * (r[0x32] > 127), r[0x34],
                    struct.unpack_from('<H', r, 0x37)[0], r[0x39], struct.unpack_from('<H', r, 0x3A)[0], pstr(r, 0, 40)))
            print('   size multiple of 63: %s' % (len(b) % 63 == 0))
        elif t is EFFECT:
            for k in range(len(b) // 9):
                print('   effect %d: %s' % (k, b[9 * k:9 * k + 9].hex(' ')))


def diff(a, b):
    for fn in sorted(set(os.listdir(a)) | set(os.listdir(b))):
        pa, pb = os.path.join(a, fn), os.path.join(b, fn)
        if not (os.path.exists(pa) and os.path.exists(pb)):
            print('== %s only in %s' % (fn, a if os.path.exists(pa) else b))
            continue
        x, y = open(pa, 'rb').read(), open(pb, 'rb').read()
        t, rs = kind(fn)
        diffs = [i for i in range(min(len(x), len(y))) if x[i] != y[i]]
        print('== %s  %d/%d bytes, %d differ%s' % (fn, len(x), len(y), len(diffs), '' if len(x) == len(y) else ' (SIZE DIFFERS)'))
        runs = []
        for i in diffs:
            if runs and i == runs[-1][1] + 1:
                runs[-1][1] = i
            else:
                runs.append([i, i])
        for s, e in runs[:80]:
            print('   %05X..%05X  %s -> %s   %s' % (s, e, x[s:e + 1].hex(' ')[:48], y[s:e + 1].hex(' ')[:48],
                                                  field(t, s, rs) if t else ''))
        if len(runs) > 80:
            print('   ... %d more runs' % (len(runs) - 80))


def main(argv):
    if len(argv) >= 3 and argv[1] == 'dump':
        dump(argv[2])
    elif len(argv) >= 4 and argv[1] == 'diff':
        diff(argv[2], argv[3])
    else:
        print(__doc__)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
