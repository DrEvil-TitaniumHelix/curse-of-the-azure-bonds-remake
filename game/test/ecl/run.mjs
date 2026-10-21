// ECL VM node test harness (cab fork of Pool's, cab-build-engine M2).  Run: node game/test/ecl/run.mjs [--seeds N]
// Oracle = decode/tools/ecldis.py (ECL_VM.md-driven disassembler) over decode/bin/dax/ECLn/*.bin (dax.py output).
// 1. DAX: every ECL record read by the JS reader equals the dax.py output.
// 2. Static: for every instruction ecldis decodes (14,163), the VM's decoder (readOperands + the variable-length re-read of
//    15/25/26/2B) gives the same length, operand types/bytes and unpacked texts; the 5 header vectors agree.
// 3. Dynamic: each of the 25 records x 5 vectors runs in the VM with a scripted host (seeded menu answers, dice, walls) for
//    N seeds; every dispatched PC must be an ecldis instruction start (inside the record's own code), every straight-line
//    instruction must leave the PC on ecldis's next address, and no opcode may lack a handler.
// 4. Each static instruction dispatched once on its own: straight-line successors = ecldis.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { G, newChar, newItem, setPstr, wrW } from '../../engine/state.js';
import { EclVM, EclHang, HOST_METHODS, BASE } from '../../engine/ecl_cab.js';
import { loadRecord } from './daxnode.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const argSeeds = process.argv.indexOf('--seeds');
const SEEDS = argSeeds > 0 ? +process.argv[argSeeds + 1] : 100;
let failures = 0;
const fail = (msg) => { failures++; if (failures <= 40) console.log('FAIL ' + msg); };

const oraclePath = join(tmpdir(), 'cab_ecldis_oracle.json');
execFileSync('python', ['-I', join(ROOT, 'game', 'test', 'ecl', 'ecldis_export.py'), oraclePath], { stdio: 'inherit' });
const oracle = JSON.parse(readFileSync(oraclePath, 'utf8'));
const NOPS = Object.fromEntries(Object.entries(oracle._ops).map(([k, v]) => [+k, v]));
const VARCOUNT = Object.fromEntries(Object.entries(oracle._var).map(([k, v]) => [+k, v]));
const recs = Object.keys(oracle).filter((k) => !k.startsWith('_'));

// ---- 1. DAX ----------------------------------------------------------------------------------------------
let daxOk = 0;
for (const key of recs) {
  const [n, id] = key.split('/').map(Number);
  const js = loadRecord('ECL' + n, '.DAX', id);
  const py = readFileSync(join(ROOT, 'decode', 'bin', 'dax', 'ECL' + n, id + '.bin'));
  if (js && js.length === py.length && js.every((b, i) => b === py[i])) daxOk++;
  else fail('DAX ' + key + ' differs from dax.py output');
}
console.log(`dax: ${daxOk}/${recs.length} ECL records identical to dax.py`);

// ---- world + scripted host -------------------------------------------------------------------------------
function lcg(seed) { let s = seed >>> 0; return (n) => { s = (Math.imul(s, 0x08088405) + 1) >>> 0; return n ? Math.floor(((s >>> 16) * n) / 65536) : 0; }; }

function makeWorld(rnd) {
  G.ecl_Mem4B00 = new Uint16Array(0x400); G.ecl_Mem7C00 = new Uint16Array(0x400);
  G.ecl_Mem7A00 = new Uint16Array(0x200); G.ecl_CodeBuf = new Uint8Array(0x1E00);
  let prev = null; G.PartyList = null;
  for (let i = 0; i < 6; i++) {
    const c = newChar();
    setPstr(c.b, 0, 'HERO' + i, 15);
    c.b[0x196] = 1; c.b[0x1A4] = 40; c.b[0x78] = 40; c.b[0x1A5] = 12; c.b[0x1B] = 10 + i; c.b[0x75] = i;
    wrW(c.b, 0xFB, 100);
    const it = newItem(); it.b[0x2E] = rnd(128); wrW(it.b, 0x37, rnd(500)); c.items = it;
    if (prev) prev.next = c; else G.PartyList = c;
    prev = c;
  }
  G.SelectedChar = G.PartyList; G.g_47E7 = G.PartyList; G.DataSet = 1; G.PartyDead = 0; G.ecl_Restart = 0;
  G.g_47E6 = 0; G.g_7603 = 8; G.Resuming = 0; G.DemoMode = 0; G.view_Mode = 4; G.view_PrevMode = 4;
  G.party_MapX = rnd(16); G.party_MapY = rnd(16); G.party_Dir = 2 * rnd(4);
  G.enc_Anim = { count: 2, cur: 1, delay: [0, 1, 1], pic: [null, {}, {}] };
}

function makeHost(rnd, calls) {
  const impl = {
    LoadDaxRecord: (name, ext, id) => loadRecord(name.toUpperCase(), ext.toUpperCase(), id),
    Random: (n) => rnd(n),
    Roll: (n, s) => { let t = 0; for (let i = 0; i < n; i++) t += rnd(s) + 1; return t; },
    GetWallType: () => (rnd(3) === 0 ? 1 : 0),
    GetCellAttr: () => rnd(16),
    ApproachDistance: () => rnd(3),
    MenuSelect: (t, m) => { const n = (m.match(/~/g) || []).length; return rnd(Math.max(1, n)); },
    NewMenuList: (list, n) => { let h = null; for (let i = 0; i < n; i++) h = { text: '', isHeader: 0, next: h }; list.v = h; },
    EclVerticalListMenu: (t, o, a, b, c, l, tp, r, bt, list, sx, redraw, index) => { let n = 0; for (let p = list; p; p = p.next) n++; index.v = rnd(Math.max(1, n)); },
    ReadWordNumber: () => rnd(100),
    ReadBottomLine: () => ['', 'YES', 'NO', 'RISE', 'ROLF'][rnd(5)],
    LoadMonsterRecord: (id, rec, items, effects) => { const c = newChar(); c.b[0x196] = 1; c.b[0x1A5] = 9; c.items = newItem(); rec.v = c; items.v = c.items; effects.v = null; },
    MakeTreasureItem: (t, item) => { item.b[0x2E] = t; },
    HasEffect: () => rnd(4) === 0,
    SavingThrow: () => rnd(2) === 0,
    AttackRollVsAC: () => rnd(2) === 0,
    ApplyEclDamage: (d, c) => { if (c.b[0x1A4] <= (d & 0xFF)) { c.b[0x1A4] = 0; c.b[0x196] = 0; } else c.b[0x1A4] -= d & 0xFF; },
    SelectPartyCharacter: (prompt, ax, sel) => { let c = G.PartyList, k = rnd(6); while (k-- && c.next) c = c.next; sel.v = c; },
    AddNpcToParty: () => { const c = newChar(); c.b[0x196] = 1; let p = G.PartyList; while (p.next) p = p.next; p.next = c; G.SelectedChar = c; },
    RemovePartyMember: () => { let p = G.PartyList; if (p === G.SelectedChar) { G.PartyList = p.next; G.SelectedChar = G.PartyList; return; }
      while (p && p.next !== G.SelectedChar) p = p.next; if (p) { p.next = G.SelectedChar.next; G.SelectedChar = G.PartyList; } },
    Camp: (r) => { r.v = rnd(2) === 0; },
    PartyMoveRange: (mx, mn) => { mx.v = 12; mn.v = 9; },
    SetDataSet: (v) => { G.DataSet = v; },
    LoseItem: (c, it) => { if (c.items === it) c.items = it.next; },
    TerminateGame: () => { throw new Error('TerminateGame'); },
    ExploreCommand: () => 'E',
    AskYesNo: () => 'N',
  };
  return new Proxy(impl, {
    get(t, k) {
      if (typeof k !== 'string') return undefined;
      if (k === 'DualClassActiveSync') return undefined;
      if (!HOST_METHODS.includes(k)) throw new Error('VM called undeclared host method ' + k);
      return (...a) => { calls[k] = (calls[k] || 0) + 1; return t[k] ? t[k](...a) : 0; };
    },
  });
}

function readAll(vm, op) {
  const one = (n) => { const r = []; let k = 0; for (let i = 1; i <= n; i++) { const t = vm.opType(i); r.push([t, vm.opLo(i), [1, 2, 3, 0x81].includes(t) ? vm.opHi(i) : null, t === 0x80 ? vm.str[++k] : (t === 0x81 ? (++k, null) : null)]); } return r; };
  vm.readOperands(NOPS[op]);
  let all = one(NOPS[op]);
  if (VARCOUNT[op] && [0, 2].includes(all[VARCOUNT[op] - 1][0])) {
    const cnt = all[VARCOUNT[op] - 1][1];
    vm.pc = vm.pc - 1; vm.readOperands(cnt);
    all = all.concat(one(cnt));
  }
  return all;
}

// ---- 2. static decode ---------------------------------------------------------------------------------
let staticOk = 0, staticTotal = 0;
for (const key of recs) {
  const [n, id] = key.split('/').map(Number);
  const rnd = lcg(1); makeWorld(rnd);
  const vm = new EclVM(makeHost(rnd, {}));
  const rec = loadRecord('ECL' + n, '.DAX', id);
  vm.code.set(rec.subarray(2, 2 + Math.min(rec.length - 2, vm.code.length)));
  vm.initVM();
  const vec = [G.ecl_VecA, G.ecl_VecB, G.ecl_VecC, G.ecl_VecD, G.ecl_VecE];
  if (vec.join() !== oracle[key].vec.join()) fail(`${key} vectors ${vec} != ${oracle[key].vec}`);
  const snapshot = vm.code.slice();
  for (const [pcs, [op, npc, ops, unk]] of Object.entries(oracle[key].insns)) {
    staticTotal++;
    if (unk) { fail(`${key} ${(+pcs).toString(16)} undecodable op ${op}`); continue; }
    vm.code.set(snapshot); G.ecl_Mem7A00.fill(0);
    vm.pc = +pcs;
    const got = readAll(vm, op);
    const exp = ops.map(([t, l, h, txt]) => [t, l, [1, 2, 3, 0x81].includes(t) ? h : null, t === 0x80 ? txt : null]);
    if (vm.pc !== npc || JSON.stringify(got) !== JSON.stringify(exp))
      fail(`${key} ${(+pcs).toString(16)} op ${op.toString(16)}: vm pc ${vm.pc.toString(16)} ${JSON.stringify(got)} vs ecldis ${npc.toString(16)} ${JSON.stringify(exp)}`);
    else staticOk++;
  }
}
console.log(`static: ${staticOk}/${staticTotal} instructions decode identically to ecldis.py`);

// ---- 3. dynamic runs ------------------------------------------------------------------------------------
const STRAIGHT_EXCLUDE = new Set([0x00, 0x01, 0x02, 0x13, 0x16, 0x17, 0x18, 0x19, 0x1A, 0x1B, 0x20, 0x25, 0x26, 0x38]);
let runs = 0, steps = 0, outside = 0, npcBad = 0, hangs = 0, stepLimits = 0, deaths = 0, newEcl = 0;
const outsideWhy = {}, loopsAt = [], executed = new Map(), allCalls = {};
for (const key of recs) {
  const [n, id] = key.split('/').map(Number);
  const insns = oracle[key].insns;
  const ex = new Set(); executed.set(key, ex);
  for (let seed = 1; seed <= SEEDS; seed++) {
    for (let v = 0; v < 5; v++) {
      const rnd = lcg(seed * 7919 + v * 31 + n * 1009 + id);
      makeWorld(rnd);
      G.ecl_Block = id; G.DataSet = n;
      const vm = new EclVM(makeHost(rnd, allCalls));
      vm.stepLimit = 20000;
      await vm.loadEclBlock(id);
      vm.initVM();
      vm.setM1(0x7F3E, 6);
      if (seed % 2 === 0) for (let a = 0x4C20; a < 0x4D00; a++) vm.setM0(a, [0, 1, rnd(4), rnd(256)][rnd(4)]);
      vm.setM1(0x7ECA, rnd(2));
      const vec = [G.ecl_VecA, G.ecl_VecB, G.ecl_VecC, G.ecl_VecD, G.ecl_VecE][v];
      let pending = null, foreign = false;
      vm.trace = (pc, op) => {
        if (pending && !foreign) {
          const [ppc, pop] = pending, o = insns[ppc];
          if (o && !STRAIGHT_EXCLUDE.has(pop) && o[1] !== pc && vm.lastOp === pop) { npcBad++; fail(`${key} ${ppc.toString(16)} op ${pop.toString(16)} -> ${pc.toString(16)}, ecldis ${o[1].toString(16)}`); }
        }
        pending = [pc, op];
        if (foreign) return;
        if (!insns[pc]) { outside++; const why = 'after op ' + vm.lastOp.toString(16); outsideWhy[why] = (outsideWhy[why] || 0) + 1; }
        else ex.add(pc);
      };
      const origLoad = vm.loadEclBlock.bind(vm);
      vm.loadEclBlock = async (b) => { foreign = true; newEcl++; await origLoad(b); };
      runs++;
      try { await vm.run(vec); }
      catch (e) {
        if (e instanceof EclHang && e.message === 'step limit') { stepLimits++; loopsAt.push(`${key} vec${'ABCDE'[v]} seed ${seed} pc ${vm.pc.toString(16)}`); }
        else if (e instanceof EclHang) { hangs++; fail(`${key} vec${'ABCDE'[v]} seed ${seed}: ${e.message}`); }
        else if (/Runtime error 200|TerminateGame/.test(e.message)) { /* faithful abort */ }
        else fail(`${key} vec${'ABCDE'[v]} seed ${seed}: ${e.stack}`);
      }
      if (G.PartyDead) deaths++;
      steps += vm.steps;
    }
  }
}
let cov = 0, tot = 0;
for (const key of recs) { cov += executed.get(key).size; tot += Object.keys(oracle[key].insns).length; }
console.log(`dynamic: ${runs} runs (${SEEDS} seeds x 5 vectors x ${recs.length} records), ${steps} instructions executed, coverage ${cov}/${tot} static instructions (${(100 * cov / tot).toFixed(1)}%)`);
console.log(`dynamic: PCs outside the static trace ${outside} ${JSON.stringify(outsideWhy)}; next-PC mismatches ${npcBad}; no-handler hangs ${hangs}; step-limit loops ${stepLimits}; party deaths ${deaths}; NEW_ECL ${newEcl}`);
if (loopsAt.length) console.log('step-limit runs: ' + loopsAt.slice(0, 10).join('; ') + (loopsAt.length > 10 ? ' ...' : ''));
console.log('host calls: ' + Object.entries(allCalls).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + '=' + v).join(' '));

// ---- 4. every instruction once ------------------------------------------------------------------------------
let eachOk = 0, eachTot = 0, eachSkip = 0, eachAbort = 0;
for (const key of recs) {
  const [n, id] = key.split('/').map(Number);
  const insns = oracle[key].insns;
  const code0 = new Uint8Array(0x1E00); { const r = loadRecord('ECL' + n, '.DAX', id); code0.set(r.subarray(2, 2 + Math.min(r.length - 2, 0x1E00))); }
  for (const [pcs, [op, npc]] of Object.entries(insns)) {
    eachTot++;
    const rnd = lcg(+pcs * 13 + id);
    makeWorld(rnd); G.ecl_Block = id; G.DataSet = n;
    const vm = new EclVM(makeHost(rnd, {}));
    vm.code.set(code0); vm.initVM(); vm.setM1(0x7F3E, 6);
    vm.setM0(0x4BE6, rnd(2));
    vm.pc = +pcs; vm.curOp = op;
    if (op === 0x20) {
      const save = vm.pc; vm.readOperands(1); const t = vm.v(1) & 0xFF; vm.pc = save;
      for (let d = 1; d <= 6; d++) if (loadRecord('ECL' + d, '.DAX', t)) { G.DataSet = d; break; }
    }
    try { await vm.dispatch(); }
    catch (e) { if (/Runtime error 200|TerminateGame/.test(e.message)) { eachAbort++; continue; } fail(`${key} ${(+pcs).toString(16)} op ${op.toString(16)} alone: ${e.message}`); continue; }
    if (STRAIGHT_EXCLUDE.has(op)) { eachSkip++; continue; }
    if (vm.pc !== npc) fail(`${key} ${(+pcs).toString(16)} op ${op.toString(16)} alone: pc ${vm.pc.toString(16)} != ${npc.toString(16)}`);
    else eachOk++;
  }
}
console.log(`each: ${eachTot} instructions dispatched once each; ${eachOk} straight-line successors = ecldis, ${eachSkip} control-flow ops not compared, ${eachAbort} faithful aborts`);
console.log(failures ? `RESULT: ${failures} failure(s)` : 'RESULT: PASS');
process.exit(failures ? 1 : 0);
