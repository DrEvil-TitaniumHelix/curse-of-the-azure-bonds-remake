#!/usr/bin/env python3
"""Conservative Pascal argument audit; run: python -I decode/tools/argcheck.py RESIDENT
(or --file X.pas.md --out Y.md for any file).

Ported from PoolRadianceRE/decode/tools/argcheck.py by cab-rt for Curse: DS = 0C1C, ECL operand arrays
OpType/OpHi/OpLo = DS:7685/76C5/7705 (decode/ecl/ECL_VM.md), any area name, CabExport listings (same .lst format
as Pool's PorExport). Turbo Pascal pushes arguments left to right; Ghidra lists them reversed.

Only annotated calls inside Pascal fences are audited. Inline intrinsics and
expressions without a safely identifiable native call remain visible as UNSURE.
No pseudocode is changed. Uses only Python's standard library.
"""
import argparse
import collections
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ADDR = r'([0-9a-fA-F]{4}):([0-9a-fA-F]{4})'
INLINE = set('inc dec ord chr byte word integer shortint longint boolean lo hi length sizeof abs succ pred ptr addr'.split())
KEYWORDS = set('if while for case and or not until with array string'.split())


def number(s):
    s = s.strip().lower()
    try:
        if s.startswith('$'):
            return int(s[1:], 16)
        if s.endswith('h'):
            return int(s[:-1], 16)
        return int(s, 0) if '0x' in s else int(s)
    except ValueError:
        return None


def arguments(s):
    result, start, depth, quote = [], 0, 0, False
    for i, c in enumerate(s):
        if c == "'":
            quote = not quote
        if quote:
            continue
        if c in '([':
            depth += 1
        elif c in ')]':
            depth -= 1
        elif c == ',' and depth == 0:
            result.append(s[start:i].strip())
            start = i + 1
    if s.strip():
        result.append(s[start:].strip())
    return result


def calls(s):
    """Keep nested calls as separate audit rows; ignore quoted/comment text."""
    masked = re.sub(r"'(?:''|[^'])*'|\{[^}]*\}", lambda m: ' ' * len(m[0]), s)
    result = []
    for m in re.finditer(r'\b([A-Za-z_]\w*(?:\.\w+)*)\s*\(', masked):
        name = m[1]
        if name.lower() in KEYWORDS:
            continue
        start = masked.index('(', m.start())
        depth = 1
        end = start + 1
        while end < len(masked) and depth:
            depth += (masked[end] == '(') - (masked[end] == ')')
            end += 1
        if depth == 0:
            result.append((name, arguments(s[start + 1:end - 1]), s[m.start():end]))
    # Zero-argument procedure statements, including inline case/then bodies.
    for m in re.finditer(r'(?:^|;|\bthen\b|\belse\b|\bbegin\b|:)\s*([A-Za-z_]\w*)\s*(?=;|$)', masked):
        if m[1].lower() not in KEYWORDS | {'begin', 'end', 'exit', 'break', 'continue'}:
            result.append((m[1], [], m[1]))
    return result


def load():
    aliases = collections.defaultdict(set)
    globals_ = {}
    for p in sorted((ROOT / 'decode/names').glob('*.json')):
        data = json.loads(p.read_text(encoding='utf-8-sig'))
        if not isinstance(data, dict):
            continue
        for address, name in data.items():
            if isinstance(address, str) and address.upper().startswith('DS:'):
                address = '0C1C:' + address[3:]
            if not isinstance(name, str) or not re.fullmatch(ADDR, address):
                continue
            key = address.lower()
            aliases[name.lower()].add(key)
            aliases[name.lower().split('.')[-1].lstrip('@')].add(key)
            if key.startswith('0c1c:'):
                globals_[name.lower()] = int(key[5:], 16)
    for p in sorted((ROOT / 'decode/pseudo').glob('*.pas.md')):
        for m in re.finditer(r'^###\s+' + ADDR + r'\s+([\w.]+)', p.read_text(encoding='utf-8-sig'), re.M):
            aliases[m[3].lower()].add(f'{m[1]}:{m[2]}'.lower())
    functions, byaddr = [], {}
    for p in sorted((ROOT / 'decode/listings').glob('*.lst')):
        current = None
        for line in p.read_text(encoding='utf-8-sig').splitlines():
            h = re.match(r';==== (\S+) @ ' + ADDR, line)
            if h:
                address = f'{h[2]}:{h[3]}'.lower()
                current = {'name': h[1], 'address': address, 'ins': [], 'unit': p.stem}
                functions.append(current)
                byaddr[address] = current
                aliases[h[1].lower()].add(address)
            m = re.match(r'\s+' + ADDR + r'\s+([0-9a-f]+)\s+(\w+)\s*(.*)', line)
            if m and current is not None:
                op, _, comment = m[5].partition(';')
                current['ins'].append({'addr': f'{m[1]}:{m[2]}'.lower(), 'off': int(m[2], 16), 'bytes': bytes.fromhex(m[3]), 'op': m[4], 'arg': op.strip(), 'comment': comment.strip()})
    return aliases, globals_, functions, byaddr


def target(ins):
    b = ins['bytes']
    if b[0] == 0x9a:
        return f'{int.from_bytes(b[3:5], "little"):04x}:{int.from_bytes(b[1:3], "little"):04x}'
    if b[0] == 0xe8:
        return ins['addr'][:5] + f'{(ins["off"] + len(b) + int.from_bytes(b[1:3], "little", signed=True)) & 65535:04x}'
    return None


def windows(fn):
    regs, pushes, result = {}, [], []
    def source(s):
        s = s.strip().lower()
        if s in regs:
            return regs[s]
        n = number(s)
        if n is not None:
            return ('const', n & 65535)
        if s in ('ds', 'ss', 'cs'):
            return ('segment', s)
        if '[' in s:
            normalized = re.sub(r'\s+|(?:byte|word) ptr', '', s).replace('+-', '-')
            bp = re.fullmatch(r'\[bp\+0x([0-9a-f]+)\]', normalized)
            if bp and int(bp[1], 16) >= 32768:
                normalized = f'[bp-0x{65536 - int(bp[1], 16):x}]'
            return ('mem', normalized)
        return ('unknown', s)
    for ins in fn['ins']:
        op, args = ins['op'], arguments(ins['arg'])
        if op == 'PUSH':
            if ins['arg'] != 'BP':
                pushes.append((ins['addr'], ins['arg'], source(ins['arg'])))
        elif op in ('MOV', 'LEA') and len(args) == 2:
            dst, src = args[0].lower(), args[1]
            value = source(src) if op == 'MOV' else ('address', re.sub(r'\s+', '', src.lower()).replace('+-', '-'))
            if re.fullmatch(r'(?:[abcd][xhl]|[sd]i|[bsi]p|[cdes]s)', dst):
                regs[dst] = value
            if dst in ('al', 'ah', 'bl', 'bh', 'cl', 'ch', 'dl', 'dh'):
                full = dst[0] + 'x'
                regs[full] = ('low', value) if dst[1] == 'l' else ('unknown', full)
            elif dst in ('ax', 'bx', 'cx', 'dx'):
                regs[dst[0] + 'l'] = ('const', value[1] & 255) if value[0] == 'const' else ('unknown', dst)
        elif op == 'XOR' and len(args) == 2 and args[0] == args[1]:
            regs[args[0].lower()] = ('const', 0)
        elif op in ('CALL', 'CALLF'):
            # PUSH CS / near CALL implements a far return, not a parameter.
            actual = pushes[:-1] if ins['bytes'][0] == 0xe8 and pushes and pushes[-1][1] == 'CS' and int(pushes[-1][0][5:], 16) + 1 == ins['off'] else pushes[:]
            result.append((ins, actual))
            pushes, regs = [], {}
        elif op.startswith('J') or op in ('LOOP', 'RET', 'RETF', 'LEAVE', 'POP'):
            regs = {}
            if op in ('RET', 'RETF', 'LEAVE'):
                pushes = []
        elif args and args[0].lower() in ('ax', 'bx', 'cx', 'dx', 'si', 'di', 'al', 'ah') and op not in ('CMP', 'TEST', 'PUSH'):
            regs[args[0].lower()] = ('unknown', ins['arg'])
    return result


def layout(fn):
    if not fn:
        return None
    sizes = set()
    pointers, byte_slots = set(), set()
    for i in fn['ins']:
        if i['op'] in ('RET', 'RETF'):
            sizes.add(number(i['arg']) or 0)
        bp = re.search(r'\[BP \+ (0x[0-9a-f]+)\]', i['arg'])
        if bp:
            slot = int(bp[1], 16)
            if i['op'] in ('LES', 'LDS'):
                pointers.add(slot)
            if 'byte ptr' in i['arg'] or re.match(r'[ABCD][HL],', i['arg']):
                byte_slots.add(slot)
    if len(sizes) != 1:
        return None
    size = sizes.pop()
    if size % 2 or size > 128:
        return None
    groups, slot = [], 6
    while slot < size + 6:
        width = 4 if slot in pointers else 2
        groups.append((width, slot in byte_slots))
        slot += width
    return list(reversed(groups)) if slot == size + 6 else None


def expected(expr, globals_):
    expr = expr.strip().lower()
    n = number(expr)
    if n is not None:
        return ('const', n & 65535)
    if expr in ('true', 'false'):
        return ('const', int(expr == 'true'))
    if re.fullmatch(r'g_[0-9a-f]{4}', expr):
        return ('mem', f'[{int(expr[2:], 16):#x}]')
    if expr in globals_:
        return ('mem', f'[{globals_[expr]:#x}]')
    m = re.fullmatch(r'op(lo|hi|type)\[(\d+)\]', expr)
    if m:
        base = {'lo': 0x7705, 'hi': 0x76C5, 'type': 0x7685}[m[1]]
        return ('mem', f'[{base + int(m[2]):#x}]')
    return None


def audit(area, src=None, out=None):
    aliases, globals_, functions, byaddr = load()
    source = Path(src).resolve() if src else ROOT / f'decode/pseudo/{area}.pas.md'
    content = source.read_text(encoding='utf-8-sig')
    anchors = collections.defaultdict(set)
    fenced = False
    for text in content.splitlines():
        if text.startswith('```'):
            fenced = not fenced if fenced else text.lower().startswith('```pascal')
        if fenced:
            for m in re.finditer(r'\{\s*' + ADDR, text):
                anchors[m[1].lower()].add(int(m[2], 16))
    rows, inside, owner, locals_ = [], False, None, {}
    for lineno, line in enumerate(content.splitlines(), 1):
        heading = re.match(r'^###\s+' + ADDR, line)
        if heading:
            owner = byaddr.get(f'{heading[1]}:{heading[2]}'.lower())
            locals_ = {}
        for m in re.finditer(r'(\w+)\s*\[BP\s*([+-])\s*(?:0x|\$)?([0-9a-fA-F]+)h?\]', line):
            offset = int(m[3], 16) * (1 if m[2] == '+' else -1)
            locals_[m[1].lower()] = ('mem', f'[bp{"+" if offset >= 0 else "-"}0x{abs(offset):x}]')
        if line.startswith('```'):
            inside = not inside if inside else line.lower().startswith('```pascal')
            continue
        if not inside:
            continue
        annotation = re.search(r'\{\s*' + ADDR, line)
        if not annotation:
            continue
        address = f'{annotation[1]}:{annotation[2]}'.lower()
        for name, exprs, pseudo in calls(line):
            verdict, reason, selected = 'UNSURE', 'native target not resolved in this routine', None
            known = aliases.get(name.lower(), set())
            raw = re.fullmatch(r'FUN_([0-9a-fA-F]{4})_([0-9a-fA-F]{4})', name)
            if raw:
                known = {f'{raw[1]}:{raw[2]}'.lower()}
            candidates = [(i, p) for i, p in windows(owner) if i['off'] >= int(address[5:], 16)] if owner and address[:4] == owner['address'][:4] else []
            boundary = min((off for off in anchors[address[:4]] if off > int(address[5:], 16)), default=65536)
            candidates = [(i, p) for i, p in candidates if i['off'] < boundary]
            for i, p in candidates:
                comment_name = i['comment'].split(' (')[0].lower()
                if target(i) in known or comment_name == name.lower() or known.intersection(aliases.get(comment_name, set())):
                    selected = (i, p)
                    break
            identity_proved = selected is not None
            if selected is None and candidates:
                selected = candidates[0]
            if name.lower() in INLINE:
                reason = 'compiler intrinsic; no independent native call required'
                selected = None
            elif selected and identity_proved:
                i, pushes = selected
                callee = byaddr.get(target(i))
                # Overlay stub comments preserve exported names when target is resident.
                if not callee or callee['unit'] == 'stubs':
                    for f in functions:
                        if f['name'].lower() == i['comment'].split(' (')[0].lower():
                            callee = f
                            break
                groups = layout(callee)
                runtime = name.lower().split('.')[-1]
                if runtime == 'fillchar':
                    groups = [(4, False), (2, False), (2, True)]
                elif runtime == 'move':
                    groups = [(4, False), (4, False), (2, False)]
                elif runtime == 'freemem':
                    groups = [(4, False), (2, False)]
                native_exprs = exprs[1:] if runtime == 'getmem' and len(exprs) == 2 else exprs
                reason = 'callee layout or nested-call argument window is incomplete'
                if groups is not None and len(groups) == len(native_exprs) and sum(w // 2 for w, _ in groups) == len(pushes):
                    comparisons, cursor = [], 0
                    for expr, (width, byte) in zip(native_exprs, groups):
                        want = expected(expr, globals_) or locals_.get(expr.lower())
                        got = pushes[cursor][2]
                        cursor += width // 2
                        if width != 2 or want is None:
                            comparisons.append(None)
                            continue
                        if got[0] == 'low':
                            got = got[1] if byte else ('unknown', 'AH unspecified')
                        if got[0] in ('const', 'mem') and want[0] == got[0]:
                            comparisons.append(want == got)
                        else:
                            comparisons.append(None)
                    if False in comparisons:
                        verdict, reason = 'MISMATCH', 'known argument differs at position(s) ' + ', '.join(str(n + 1) for n, v in enumerate(comparisons) if v is False)
                    elif all(v is True for v in comparisons):
                        verdict, reason = 'OK', 'all native argument words agree'
                    else:
                        reason = 'complex expression, far pointer, or unproved register source'
                reason += f'; native {i["addr"]} → {i["comment"] or target(i) or i["arg"]}'
                if native_exprs is not exprs:
                    reason += '; GetMem output variable is supplied by returned DX:AX'
            elif selected:
                reason = f'first native call is {selected[0]["addr"]} ({selected[0]["comment"] or selected[0]["arg"]}); pseudo target identity unproved'
            pushes_text = '—'
            if selected:
                pushes_text = '; '.join(f'{a}: PUSH {operand} ← {value}' for a, operand, value in selected[1]) or '(none)'
            rows.append((address, lineno, pseudo, pushes_text, verdict, reason))
    counts = collections.Counter(r[4] for r in rows)
    def cell(s):
        return str(s).replace('|', '\\|').replace('\n', ' ')
    output = [f'# {area} call argument audit', '', f'Input: `{source.relative_to(ROOT).as_posix() if source.is_relative_to(ROOT) else source.name}`; SHA-256 `{hashlib.sha256(source.read_bytes()).hexdigest()}`.', '', f'Calls: **{len(rows)}**; OK **{counts["OK"]}**, MISMATCH **{counts["MISMATCH"]}**, UNSURE **{counts["UNSURE"]}**.', '', 'Reproduce: `python decode/tools/argcheck.py ' + area + '`.', '', 'Pushes appear in assembly execution order since the preceding call (excluding BP prologues and near-call return CS). Values are conservative register provenance, not runtime values. Targets use encoded relative/far operands and exported names. Pascal first arguments occupy the highest BP slots; callee RET cleanup and LES/LDS accesses determine word grouping. Byte arguments compare AL only when the callee reads a byte. A mismatch identifies a proven differing scalar slot; unresolved widths/counts, string helpers, nested pending arguments, pointers and complex expressions remain UNSURE. Compiler intrinsics are retained as UNSURE. Semantic wrappers can differ from the native ABI. OK covers the displayed argument sources only. No unannotated statements are audited.', '', '| Address / source line | Pseudo call | Pushes in asm order | Verdict | Evidence / limitation |', '|---|---|---|---|---|']
    output += ['| ' + ' | '.join(map(cell, (a + f' / L{line}', '`' + p + '`', pushes, verdict, reason))) + ' |' for a, line, p, pushes, verdict, reason in rows]
    dest = Path(out) if out else ROOT / f'decode/pseudo/{area}_ARGCHECK.md'
    dest.write_text('\n'.join(output) + '\n', encoding='utf-8')
    print(f'{area}: {len(rows)} calls; ' + ', '.join(f'{k}={counts[k]}' for k in ('OK', 'MISMATCH', 'UNSURE')))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('area', help='AREA of decode/pseudo/AREA.pas.md (RESIDENT, ECLVIEW, COMBAT, MAGIC, PARTY, ENGINE ...)')
    parser.add_argument('--file', help='audit this .pas.md instead')
    parser.add_argument('--out', help='write the report here instead of decode/pseudo/AREA_ARGCHECK.md')
    a = parser.parse_args()
    audit(a.area, a.file, a.out)
