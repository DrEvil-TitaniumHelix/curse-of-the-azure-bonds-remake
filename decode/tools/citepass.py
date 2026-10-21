"""citepass.py AREA [--apply] : move every `{ seg:off [/ off ..] }` anchor to the first instruction of its statement.

Classes (statement = the pascal text before the `{`):
  jmp       anchor on an unconditional JMP: Exit/continue/break/goto/end/until keep it; `for` takes the MOV init before
            the JMP; anything else takes the next instruction (the JMP closes the previous statement or branch).
  jcc       anchor on a conditional jump: a conditional statement walks back over its own test; any other statement takes
            the next instruction.
  epilogue  anchor on MOV SP,BP / POP BP / RET: next instruction.
  store     a conditional statement anchored on a store: the first test (instruction followed by a Jcc) after the anchor,
            walked back to its first load.
  back      otherwise walk back over setup instructions (PUSH, LEA, loads, register arithmetic, nested calls whose result
            is pushed, string helpers that keep building arguments) to the statement's first instruction; stops at a store,
            a jump, a statement-level call, a label (which is the start) or the previous anchored line's anchor.
REVIEW (not applied): a first anchor whose walk-back reaches the previous line's anchor (the anchor sits inside the
previous statement): the instruction after that statement's last store / jump / call is printed as the candidate.
Secondary anchors (`/ off`) move only when the walk stays above the line's first anchor. Conflicts are resolved in file
order: a proposal already used by another anchor falls back to the next instruction (jump classes) or is kept.
"""
import re, sys, glob, collections
sys.stdout.reconfigure(encoding='utf-8')
import os
R = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')) + '/'
area = sys.argv[1]; apply = '--apply' in sys.argv
p = R + f'decode/pseudo/{area}.pas.md'
lines = open(p, encoding='utf-8').read().split('\n')
segs = set(re.findall(r'\{ ?([0-9a-f]{4}):[0-9a-f]{4}', '\n'.join(lines)))
lst = {}
for f in glob.glob(R + 'decode/listings/*.lst'):
    for ln in open(f, encoding='latin-1'):
        m = re.match(r'^  ([0-9a-f]{4}):([0-9a-f]{4})  ([0-9a-f]+)\s+(\S+)\s*(.*)$', ln.rstrip())
        if m and m[1] in segs:
            ops = m[5].split(';')[0].strip(); cmt = m[5].split(';')[1].strip() if ';' in m[5] else ''
            lst.setdefault(m[1], {})[int(m[2], 16)] = (m[4].upper(), ops, cmt)
order = {s: sorted(d) for s, d in lst.items()}
pos = {s: {o: i for i, o in enumerate(v)} for s, v in order.items()}
JCC = {'JZ','JNZ','JC','JNC','JA','JAE','JB','JBE','JG','JGE','JL','JLE','JS','JNS','JO','JNO','JP','JNP','JE','JNE','JCXZ','LOOP'}
targets = {s: set() for s in lst}
for s, d in lst.items():
    base = int(s, 16) * 16
    for o, (mn, ops, cmt) in d.items():
        if mn == 'JMP' or mn in JCC:
            m = re.match(r'0x([0-9a-f]+):([0-9a-f]+)$', ops)
            if m:
                t = int(m[1], 16) * 16 + int(m[2], 16) - base
                if t in d: targets[s].add(t)
def ins(seg, off): return lst[seg][off]
def nxt(seg, off, k=1):
    i = pos[seg][off] + k
    return order[seg][i] if 0 <= i < len(order[seg]) else None
def is_store(mn, ops):
    if mn in ('INC','DEC','NEG','NOT') and '[' in ops: return True
    if mn in ('MOV','ADD','SUB','OR','AND','XOR','ADC','SBB','SHL','SHR','SAR') and ops.split(',')[0].strip().endswith(']'): return True
    if mn in ('STOSB','STOSW','MOVSB','MOVSW','REP','REPE','REPNE','OUT'): return True
    return False
def is_jump(mn): return mn == 'JMP' or mn in JCC
SYSHELP = re.compile(r'System\.@(Str|Long|Char|Val|Set|PStr|Load|Store|Sfix|Sload|Sstore)|System\.(Str|Random)')
def result_pushed(seg, off):
    q = nxt(seg, off)
    for _ in range(4):
        if q is None: return False
        mn, ops, _c = ins(seg, q)
        if mn == 'PUSH' and ops in ('AX', 'DX'): return True
        if (mn, ops) in (('CBW',''), ('CWD',''), ('XOR','AH,AH'), ('XOR','DX,DX'), ('MOV','DX,ES')): q = nxt(seg, q); continue
        return False
    return False
def transparent(seg, off):
    mn, ops, cmt = ins(seg, off)
    if result_pushed(seg, off): return True
    if SYSHELP.search(cmt):
        q = nxt(seg, off)
        if q is None: return False
        m2, o2, c2 = ins(seg, q)
        if m2 in ('PUSH', 'LEA') or (m2 == 'MOV' and o2.startswith('DI,')) or (m2 in ('CALL','CALLF') and SYSHELP.search(c2)): return True
    return False
SETUP_MN = {'PUSH','LEA','LES','CBW','CWD','XOR','MOV','ADD','SUB','SHL','SHR','SAR','IMUL','MUL','IDIV','DIV','NEG','NOT','AND','OR','INC','DEC','ADC','SBB','TEST','CMP','XCHG','CMC','CLC','STC','LDS'}
def setup(seg, off):
    mn, ops, cmt = ins(seg, off)
    if mn in ('CALL','CALLF'): return transparent(seg, off)
    if mn == 'PUSH' and ops == 'BP': return False
    if mn == 'MOV' and ops == 'BP,SP': return False
    if mn == 'SUB' and ops.startswith('SP,'): return False
    if is_store(mn, ops) or is_jump(mn): return False
    return mn in SETUP_MN
def is_test(seg, q):
    mn, ops, cmt = ins(seg, q); n2 = nxt(seg, q)
    return mn in ('CMP','TEST','OR','AND') and n2 is not None and ins(seg, n2)[0] in JCC
def walkback(seg, off, floor, inclusive):
    """(start, reached_floor): first instruction of the statement containing off, not below floor"""
    q = off; start = off
    while True:
        if q in targets[seg]: return start, False
        pr = nxt(seg, q, -1)
        if pr is None: return start, False
        if pr < floor or (not inclusive and pr <= floor): return start, True
        ok = setup(seg, pr)
        if not ok and ins(seg, pr)[0] in ('CALL','CALLF') and is_test(seg, q) and ins(seg, q)[1] in ('AL,AL','AX,AX','AL,0x0','AL,0x1','AX,0x0'): ok = True
        if pr in targets[seg]:
            if ok: start = pr
            return start, False
        if not ok: return start, False
        q = pr; start = pr
def stmt_end(seg, off, limit=40):
    """last instruction of the statement starting at off: the run of stores / a jump / a statement-level call / RET"""
    q = off
    for _ in range(limit):
        mn, ops, cmt = ins(seg, q)
        if is_jump(mn) or mn in ('RET','RETF'): return q
        if mn in ('CALL','CALLF') and not transparent(seg, q): return q
        if is_store(mn, ops):
            while True:
                n2 = nxt(seg, q)
                if n2 is None: return q
                m2, o2, c2 = ins(seg, n2)
                if is_store(m2, o2) or (m2, o2) == ('MOV', 'DX,ES'): q = n2; continue
                return q
        q = nxt(seg, q)
        if q is None: return None
    return None
STRUCT = re.compile(r"^\s*(else\b|end\b|begin\b|repeat\b|end else\b|\}|$)")
COND = re.compile(r"^\s*(if\b|while\b|until\b|else if\b|for\b|repeat\b|'.'\s*[:,]|#\$?[0-9A-Fa-f]+\s*[:,]|\$?[0-9A-Fa-f]+(\.\.\$?[0-9A-Fa-f]+)?(\s*,\s*\$?[0-9A-Fa-f]+(\.\.\$?[0-9A-Fa-f]+)?)*\s*:)")
EXITS = re.compile(r"\b(Exit|continue|break|goto|Halt|Continue|Break)\b|^\s*end\b|^\s*until\b|^\s*repeat\b")
anchors = []
inpas = False
for no, l in enumerate(lines):
    if l.startswith('```'):
        inpas = l.startswith('```pascal') and not inpas; continue
    if not inpas: continue
    m = re.search(r'\{ ?([0-9a-f]{4}):([0-9a-f]{4})((?:\s*/\s*[0-9a-f]{4})*)', l)
    if not m: continue
    offs = [int(m[2], 16)] + [int(x, 16) for x in re.findall(r'[0-9a-f]{4}', m[3])]
    anchors.append([no, m[1], offs, l.split('{')[0].strip(), m.start(), m.end()])
prev_line = {}; next_line = {}; last = {}
for idx, (no, seg, offs, stmt, a, b) in enumerate(anchors):
    prev_line[idx] = last.get(seg); last[seg] = idx
last = {}
for idx in range(len(anchors) - 1, -1, -1):
    seg = anchors[idx][1]; next_line[idx] = last.get(seg); last[seg] = idx
props = {}; review = []
for idx, (no, seg, offs, stmt, a, b) in enumerate(anchors):
    if seg not in lst: continue
    pi = prev_line.get(idx); ni = next_line.get(idx)
    prev_anchor = anchors[pi][2][0] if pi is not None else -1
    prev_struct = bool(STRUCT.match(anchors[pi][3])) if pi is not None else True
    next_anchor = anchors[ni][2][0] if ni is not None else 1 << 30
    cond = bool(COND.match(stmt))
    for k, off in enumerate(offs):
        if off not in lst[seg]: continue
        mn, ops, cmt = ins(seg, off)
        cls = None; prop = None
        if k == 0:
            floor = prev_anchor if (pi is not None and prev_anchor < off) else -1; inclusive = True
        else:
            floor = props.get((idx, 0), (None, offs[0]))[1]; inclusive = False
        if mn == 'JMP' and not EXITS.search(stmt):
            cls = 'jmp'; prop = nxt(seg, off)
            pr = nxt(seg, off, -1)
            if stmt.lstrip().startswith('for ') and pr is not None and is_store(*ins(seg, pr)[:2]): prop = pr
        elif mn in JCC:
            cls = 'jcc'
            if cond and k == 0:
                prop, hit = walkback(seg, off, floor, inclusive)
                if hit: prop = None
            else: prop = nxt(seg, off)
        elif (mn in ('RET','RETF') or (mn == 'MOV' and ops.startswith('SP,BP')) or (mn == 'POP' and ops == 'BP')) and not EXITS.search(stmt):
            cls = 'epilogue'; prop = nxt(seg, off)
        elif k == 0 and cond and is_store(mn, ops):
            cls = 'store'; q = off; t_ = None
            for _ in range(14):
                q = nxt(seg, q)
                if q is None or q >= next_anchor: break
                if is_test(seg, q): t_ = q; break
            if t_: prop = walkback(seg, t_, off, False)[0]
        else:
            start, hit = walkback(seg, off, floor, inclusive)
            if k == 0 and pi is not None and not prev_struct and floor >= 0 and (hit or start == floor):
                e = stmt_end(seg, floor)
                cand = nxt(seg, e) if e is not None else None
                review.append((no, seg, off, stmt, floor, cand, next_anchor))
                continue
            if hit: continue
            if start != off: cls = 'back'; prop = start
        if cls and prop is not None and prop != off: props[(idx, k)] = (cls, prop)
# conflict resolution in file order
taken = collections.defaultdict(set)
for idx, (no, seg, offs, stmt, a, b) in enumerate(anchors):
    for k, off in enumerate(offs):
        if (idx, k) not in props: taken[seg].add(off)
final = {}; log = []
for (idx, k) in sorted(props):
    cls, prop = props[(idx, k)]
    no, seg, offs, stmt, a, b = anchors[idx]
    if prop in taken[seg] and not STRUCT.match(stmt):
        alt = nxt(seg, offs[k]) if cls in ('jmp', 'jcc', 'epilogue', 'store') else None
        if alt is not None and alt not in taken[seg] and alt != prop:
            final[(idx, k)] = (cls + '*', alt); taken[seg].add(alt)
        else:
            log.append('CONFLICT L%d %s:%04x%s [%s] -> %04x taken; kept' % (no + 1, seg, offs[k], '' if k == 0 else '(/%d)' % k, cls, prop)); taken[seg].add(offs[k])
        continue
    final[(idx, k)] = (cls, prop); taken[seg].add(prop)
cnt = collections.Counter(c.rstrip('*') for c, p_ in final.values())
print('anchored lines', len(anchors), 'moved', len(final), dict(cnt), 'conflicts', len(log), 'review', len(review))
for l in log: print(l)
for no, seg, off, stmt, floor, cand, na in review:
    print('REVIEW L%d %s:%04x (%s %s) | %s | prev anchor %04x, candidate %s, next anchor %04x' % (no + 1, seg, off, ins(seg, off)[0], ins(seg, off)[1][:20], stmt[:60], floor, ('%04x %s %s' % (cand, ins(seg, cand)[0], ins(seg, cand)[1][:20])) if cand else '?', na if na < (1 << 30) else 0))
for (idx, k), (cls, prop) in sorted(final.items()):
    no, seg, offs, stmt, a, b = anchors[idx]; off = offs[k]
    print('L%d %s:%04x%s [%s %+d] %s %s | %s -> %04x %s' % (no + 1, seg, off, '' if k == 0 else '(/%d)' % k, cls, pos[seg][prop] - pos[seg][off], ins(seg, off)[0], ins(seg, off)[1][:22], stmt[:66], prop, ins(seg, prop)[0] + ' ' + ins(seg, prop)[1][:22]))
if apply:
    byline = collections.defaultdict(dict)
    for (idx, k), (cls, prop) in final.items(): byline[idx][k] = prop
    for idx, reps in byline.items():
        no, seg, offs, stmt, a, b = anchors[idx]
        l = lines[no]; body = l[a:b]; i = body.index(':') + 1
        cnt_ = [-1]
        def rep(mm):
            cnt_[0] += 1
            return ('%04x' % reps[cnt_[0]]) if cnt_[0] in reps else mm[0]
        lines[no] = l[:a] + body[:i] + re.sub(r'[0-9a-f]{4}', rep, body[i:]) + l[b:]
    open(p, 'w', encoding='utf-8', newline='\n').write('\n'.join(lines))
    print('applied lines', len(byline))
