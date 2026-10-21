// ecl_cab.js — the Curse ECL VM (engine.id 'cab-1.0' adapter of engine/ecl.js; BUILD_PLAN §2 ecl row, PER-3).
// Translation of CurseAzureBondsRE decode/ecl/ECL_VM.md (spec of every handler) and decode/pseudo/ECL.pas.md (fetch loop,
// dispatch, game loop, RunAfterNewBlock, CampCheck, tracer), checked against decode/listings/ov02.lst / ov07.lst where
// the spec summarises. Structure = Pool's engine/ecl.js (VM core + host); deltas: base 8000h, the Curse memory map and
// region side effects, the 422-byte record overlay, the 3 new opcodes (3E DUMP, 3F FIND SPECIAL, 40 DESTROY ITEMS),
// 3C PROTECTION, RETURN on an empty stack = EXIT, DIVIDE remainder, the new CALL ids, the demo game loop, the tracer.
//
// Coupling:
//  - DS globals are the engine's `G` (state.js), addressed as `G.g_XXXX` (state.js maps an address to its GLOBALS.md name),
//    so the VM and the area units share one copy. VM regions: G.ecl_Mem4B00 / 7C00 (Uint16Array 400h), G.ecl_Mem7A00 (200h),
//    G.ecl_CodeBuf (Uint8Array 1E00h), allocated by ENGINE ov11_0056.
//  - `host` = every routine outside the VM, called by its decode name (decode/names/*.json): ecl_host.js passes the areas'
//    late-binding proxy (areas/view_link.js `X`), tests pass a stub. All host calls are awaited.
//  - Characters { b: Uint8Array(1A6h), next (+189h), items (+14Dh), effects (+F2h), combat (+18Dh) }; items { b(3Fh), next };
//    effects { b(9), next }. `G.enc_Shown` = [sprite shown (8B48), picture shown (8B49)].

import { G, newChar, newItem, newEffect, pstr, setPstr, rdW, wrW } from './state.js';
import { hooks, charSummary } from '../plus/hooks.js';   // GBP W1 (docs/PLUS_HOOKS.md): emit only

export const BASE = 0x8000, CODE_SIZE = 0x1E00;
const w16 = (v) => v & 0xFFFF;
const lo = (v) => v & 0xFF;
const sx8 = (v) => ((v & 0xFF) ^ 0x80) - 0x80;
const upcase = (k) => (k >= 0x61 && k <= 0x7A ? k - 0x20 : k);
const charName = (c) => pstr(c.b, 0);

// character record offsets used by the VM (ECL_VM.md §3.1, SAVES.md §2, PARTY.pas.md)
const C = { thief_skill: 0xEA, npc_flags: 0xF7, money: 0xFB, lvl_a: 0x109, lvl_b: 0x10E, prev_a: 0x111, prev_b: 0x116,
  gender: 0x119, alignment: 0x11B, cha: 0x1B, class: 0x75, icon_slot: 0x143, status: 0x195, active: 0x196, side: 0x197,
  controlled: 0x198, thac0: 0x199, ac: 0x19A, hp: 0x1A4, move: 0x1A5 };
const I = { type: 0x2E };

export class EclHang extends Error {}

// 2C00:1FF5 ecl_SkipInstruction table (ECL_VM.md §2.4): opcode -> ReadOperands count, 0 = PC+1
export const SKIP_COUNT = new Uint8Array(256);
for (const o of [0x01, 0x02, 0x0A, 0x0E, 0x11, 0x12, 0x1D, 0x20, 0x2D, 0x32, 0x34, 0x36, 0x38, 0x39, 0x3C, 0x3F, 0x40]) SKIP_COUNT[o] = 1;
for (const o of [0x03, 0x08, 0x09, 0x0F, 0x10, 0x1F, 0x22]) SKIP_COUNT[o] = 2;
for (const o of [0x04, 0x05, 0x06, 0x07, 0x0B, 0x0C, 0x21, 0x28, 0x2A, 0x2F, 0x30, 0x35, 0x37, 0x3B]) SKIP_COUNT[o] = 3;
SKIP_COUNT[0x14] = 4; SKIP_COUNT[0x23] = 4; SKIP_COUNT[0x2E] = 5; SKIP_COUNT[0x1E] = 6; SKIP_COUNT[0x2C] = 6;
SKIP_COUNT[0x27] = 8; SKIP_COUNT[0x29] = 14;

// 7300:0240 ecl_OpcodeName — SSI's own names (ov34, the built-in tracer)
export const OPCODE_NAMES = ['EXIT', 'GOTO', 'GOSUB', 'COMPARE', 'ADD', 'SUBTRAT', 'DIVIDE', 'MULTIPLY', 'RANDOM', 'SAVE',
  'LOAD CHARACTER', 'LOAD MONSTER', 'SETUP MONSTER', 'APPROACH', 'PICTURE', 'INPUT NUMBER', 'INPUT STRING', 'PRINT',
  'PRINTCLEAR', 'RETURN', 'COMPARE AND', 'VERTICAL MENU', 'IF = ', 'IF <>', 'IF <', 'IF >', 'IF <=', 'IF >=',
  'CLEARMONSTERS', 'PARTYSTRENGTH', 'CHECKPARTY', null, 'NEWECL', 'LOAD FILES', 'PARTY SURPRISE', 'SURPRISE', 'COMBAT',
  'ON GOTO', 'ON GOSUB', 'TREASURE', 'ROB', 'ENCOUNTER MENU', 'GETTABLE', 'HORIZONTAL MENU', 'PARLAY', 'CALL', 'DAMAGE',
  'AND', 'AND', 'SPRITE OFF', 'FIND ITEM', 'PRINT RETURN', 'ECL CLOCK', 'SAVE TABLE', 'ADD NPC', 'LOAD PIECES', 'PROGRAM',
  'WHO', 'DELAY', 'SPELL', 'PROTECTION', 'CLEAR BOX', 'DUMP', 'FIND SPECIAL', 'DESTROY ITEMS'];

export class EclVM {
  constructor(host) {
    this.host = host;
    EclVM.current = this;
    this.curOp = 0; this.lastOp = 0;            // ecl_CurOp g_75FF / ecl_LastOp g_75FE
    this.flags = new Uint8Array(6);             // DS:75F8..75FD EQ NE LT GT LE GE
    this.ops = new Uint8Array(0xC0);            // OpType DS:7685+i, OpHi DS:76C5+i, OpLo DS:7705+i (40h apart, overlap kept)
    this.str = new Array(256).fill('');         // Str[k] = DS:7648 + k*100h
    this.gosub = [];                            // ecl_GosubSP g_75F0 (heap list of {ret}); top = last
    this.trace = null;                          // test hook (pc, op)
    this.stepLimit = Infinity; this.steps = 0;
    if (!G.enc_Shown) G.enc_Shown = [false, false];
  }

  // ---- state in G ---------------------------------------------------------------------------------------------------
  get pc() { return G.ecl_PC ?? BASE; } set pc(v) { G.ecl_PC = w16(v); }       // g_4FB4
  get code() { return G.ecl_CodeBuf; }
  get m4B() { return G.ecl_Mem4B00; } get m7C() { return G.ecl_Mem7C00; } get m7A() { return G.ecl_Mem7A00; }
  opType(i) { return this.ops[i - 1]; }
  opHi(i) { return this.ops[0x40 + i - 1]; }
  opLo(i) { return this.ops[0x80 + i - 1]; }
  a(i) { return this.opHi(i) * 256 + this.opLo(i); }                    // MakeWord(OpLo[i], OpHi[i]) 2C00:06E8
  v(i) { return this.operandValue(i); }
  codeAt(a) { const k = w16(a - BASE); return k < CODE_SIZE ? this.code[k] : 0; }   // TODO(decode): bytes past the buffer = heap
  setCode(a, b) { const k = w16(a - BASE); if (k < CODE_SIZE) this.code[k] = lo(b); }
  m0(a) { return this.m4B[(a - 0x4B00) & 0x3FF]; } setM0(a, v) { this.m4B[(a - 0x4B00) & 0x3FF] = w16(v); }
  m1(a) { return this.m7C[(a - 0x7C00) & 0x3FF]; } setM1(a, v) { this.m7C[(a - 0x7C00) & 0x3FF] = w16(v); }
  m2(a) { return this.m7A[(a - 0x7A00) & 0x1FF]; } setM2(a, v) { this.m7A[(a - 0x7A00) & 0x1FF] = w16(v); }
  is3D() { return this.m0(0x4BE6) !== 0; }                              // Mem[4BE6] 3D-area flag
  setStr(k, s) { this.str[k & 0xFF] = s.length > 255 ? s.substring(0, 255) : s; }
  clearFlags() { this.flags.fill(0); }

  // ===================================================================================================================
  // ov07 (2C00) — the VM half: operands, InitVM, LoadEclBlock, memory, strings, compare, gosub, skip
  // ===================================================================================================================

  // 2C00:0034 ecl_ReadOperands(n)
  readOperands(n) {
    let k = 0;
    for (let i = 1; i <= (n & 0xFF); i++) {
      this.ops[i - 1] = this.codeAt(this.pc + 1);                       // OpType[i]
      this.ops[0x80 + i - 1] = this.codeAt(this.pc + 2);                // OpLo[i]
      this.pc = this.pc + 2;
      const t = this.ops[i - 1];
      if (t === 1 || t === 2 || t === 3) {
        this.pc = this.pc + 1;
        this.ops[0x40 + i - 1] = this.codeAt(this.pc);                  // OpHi[i]
      } else if (t === 0x80) {
        k++;
        if (this.opLo(i) > 0) this.unpackString(this.opLo(i), k);       // packed text, len = OpLo
        else this.setStr(k, '');
      } else if (t === 0x81) {
        k++;
        this.pc = this.pc + 1;
        this.ops[0x40 + i - 1] = this.codeAt(this.pc);
        this.getMemString(k, this.a(i));
      }                                                                 // other types: 2 bytes, OpHi stale
    }
    this.pc = this.pc + 1;
  }

  // 2C00:0173 ecl_OperandValue(i)
  operandValue(i) {
    const l = this.opLo(i), h = this.opHi(i);
    switch (this.opType(i)) {
      case 0: return l;
      case 1: case 3: case 0x80: return this.getMem(h * 256 + l);       // 0x80: meaningless value
      case 2: case 0x81: return h * 256 + l;
      default: return 0;                                                // TODO(decode): uninitialised local (not in data)
    }
  }

  // 2C00:01FC ecl_InitVM
  initVM() {
    G.g_8B62 = 0; G.g_8B64 = 0; G.g_8B52 = 0; G.g_8B53 = 0;             // 2c00:0202 .. 0211
    G.g_75E8 = 0x41; G.g_75E9 = 0x09;                                   // 2c00:0216 / 021b  3D colours
    G.g_8B67 = 1;                                                       // 2c00:0220
    G.enc_Shown = [false, false];                                       // 2c00:0231  FillChar(DS:8B48, 2, 0)
    G.g_7603 = 8;                                                       // 2c00:0236  next CPIC icon slot
    this.pc = BASE;                                                     // 2c00:023b
    G.g_7746 = 0;                                                       // 2c00:0241
    this.gosub = [];                                                    // 2c00:0248 .. 0253
    this.clearFlags();                                                  // 2c00:0262  FillChar(DS:75F8, 6, 0)
    this.setM1(0x7EE1, 0xFF); this.setM1(0x7ED2, 0); this.setM1(0x7ED3, 0);   // 2c00:0267 .. 027d
    this.setM0(0x4BE5, 0);                                              // 2c00:0288
    this.readOperands(1); G.ecl_VecA = this.a(1);                       // 2c00:0297 .. 02a6
    this.readOperands(1); G.ecl_VecB = this.a(1);
    this.readOperands(1); G.ecl_VecC = this.a(1);
    this.readOperands(1); G.ecl_VecD = this.a(1);
    this.readOperands(1); G.ecl_VecE = this.a(1);                       // 2c00:02fe
    this.setM0(0x4BE6, 1);                                              // 2c00:0305  (array write: no view-mode side effect)
    if (!G.Resuming) {                                                  // 2c00:030c
      for (let j = 1; j <= 0x20; j++) this.setM0(0x4BFF + j, 0);        // 2c00:031d  block-local 4C00..4C1F
      for (let j = 0; j <= 9; j++) this.setM1(0x7F79 + j, 0);           // 2c00:0342  7F79..7F82
    }
  }

  // 2C00:0380 LoadEclBlock(n)
  async loadEclBlock(n) {
    const h = this.host;
    this.code.fill(0);                                                  // 2c00:0394
    G.NoDiskPrompt = 0;                                                 // 2c00:0399
    await h.ClearMenuLine();                                            // 2c00:039e
    await h.DrawText(0, 0x18, 0x0A, 0, 'Loading...Please Wait');        // 2c00:03be
    let rec = null, tries = 0;
    do {
      rec = await h.LoadDaxRecord('ECL' + G.DataSet, '.dax', lo(n));    // 2c00:0415
      if (++tries > 1000) throw new EclHang('LoadEclBlock: ECL record ' + n + ' missing');
    } while (!rec || rec.length < 2);                                   // 2c00:041a
    const k = Math.min(rec.length - 2, CODE_SIZE);
    this.code.set(rec.subarray(2, 2 + k), 0);                           // 2c00:0439  Move(rec[2], CodeBuf^, size-2)
    await h.ClearMenuLine();                                            // 2c00:044b
  }

  // 2C00:0735 ecl_MemRegion(a)
  memRegion(a) {
    if (a >= 0x4B00 && a <= 0x4EFF) return 0;
    if (a >= 0x7C00 && a <= 0x7FFF) return 1;
    if (a >= 0x7A00 && a <= 0x7BFF) return 2;
    if (a >= 0x8000 && a <= 0x9DFF) return 3;
    return 4;
  }

  // 2C00:0790 PartyIndexOf(c)
  partyIndexOf(c) { let p = G.PartyList, n = 0; while (p && p !== c) { n++; p = p.next; } return n; }

  // 2C00:07F1 ecl_GetCharField(a) -> value | undefined (= not a character field)
  getCharField(a) {
    const c = G.SelectedChar;
    if (!c) return undefined;                                           // TODO(decode): nil SelectedChar never happens in play
    const b = c.b, o = a - 0x7C00;
    if (o >= 0xA5 && o <= 0xAC) return b[C.thief_skill + o - 0xA5];     // 7CA5..7CAC thief skills +EAh..+F1h
    switch (o) {
      case 0x015: return b[0x13];
      case 0x018: return b[0x19];
      case 0x072: return w16(sx8(b[0x74]));
      case 0x073: return w16(sx8(b[C.class]));
      case 0x09B: return b[0xE0];
      case 0x0A0: return w16(sx8(b[0xE5]));
      case 0x0B8: return b[C.npc_flags];
      case 0x0BB: return rdW(b, C.money);
      case 0x0BD: return rdW(b, C.money + 2);
      case 0x0BF: return rdW(b, C.money + 4);
      case 0x0C1: return rdW(b, C.money + 6);
      case 0x0C3: return rdW(b, C.money + 8);
      case 0x0C9: return lo(b[C.lvl_b] + b[C.prev_b] * this.dualClassActive(c));   // TODO(decode): DualClassActive = PARTY lane
      case 0x0D6: return w16(sx8(b[C.gender]));
      case 0x0D8: return w16(sx8(b[C.alignment]));
      case 0x0E4: return b[0x192] & 1;
      case 0x0F7: return rdW(b, 0x13C);
      case 0x0F9: return b[0x13E];
      case 0x100: if (G.g_8B6D) { G.g_8B6D = 0; return 0; } return b[C.active] === 0 ? 0x80 : 1;   // forced 0 once after a failed LOAD CHARACTER
      case 0x10C: return (b[C.side] === 0 && b[C.controlled] !== 0) ? 0x80 : (b[C.side] === 1 ? 0x81 : 0);
      case 0x10D: return 0;                                             // found, TODO(decode): value undefined (L)
      case 0x11B: return b[C.move];
      case 0x2B1: case 0x2B4: return this.partyIndexOf(c);
      case 0x2CF: {                                                     // reaction bonus from cha (+1Bh)
        const ch = b[C.cha];
        if (ch === 3) return 0; if (ch === 4) return 5; if (ch === 5) return 10; if (ch === 6) return 15;
        if (ch === 7) return 20; if (ch >= 8 && ch <= 12) return 25; if (ch === 13) return 30; if (ch === 14) return 35;
        if (ch === 15) return 40; if (ch === 16) return 50; if (ch === 17) return 55; if (ch >= 18 && ch <= 25) return 60;
        return 0;                                                       // TODO(decode): garbage for cha < 3 / > 25
      }
      case 0x312: return G.DataSet;
      case 0x33E: return this.m1(0x7F3E);
    }
    return undefined;
  }
  dualClassActive(c) { return this.host.DualClassActiveSync ? (this.host.DualClassActiveSync(c) ? 1 : 0) : 0; }

  // 2C00:0B6D ecl_SetCharField(a, v)
  async setCharField(a, v) {
    const c = G.SelectedChar, o = a - 0x7C00;
    if (o === 0x312) { await this.host.SetDataSet(lo(v)); return; }    // 7F12: select the data set
    if (o === 0x322 || o === 0x324 || o === 0x326) {                    // 7F22/24/26: v > 80h -> LoadWallSet(slot, v and 7Fh)
      if (v > 0x80) await this.host.LoadWallSet(v & 0x7F, (o - 0x320) >> 1);   // (pushes id, then slot; as Pool)
      return;
    }
    if (o === 0x000) { if (v === 0) G.g_8B53 = 1; return; }
    if (!c) return;
    const b = c.b;
    if (o >= 0x020 && o <= 0x070) { b[o - 0x20 + 0x1F] = lo(v); return; }   // spells +1Fh..+6Fh
    switch (o) {
      case 0x0B8: if (v > 0xB2) v -= 0x32; b[C.npc_flags] = lo(v); break;
      case 0x0BB: wrW(b, C.money, v); break;
      case 0x0BD: wrW(b, C.money + 2, v); break;
      case 0x0BF: wrW(b, C.money + 4, v); break;
      case 0x0C1: wrW(b, C.money + 6, v); break;
      case 0x0C3: wrW(b, C.money + 8, v); break;
      case 0x0F7: wrW(b, 0x13C, v); break;
      case 0x0F9: b[0x13E] = lo(v); break;
      case 0x100:
        if (v > 0x7F) { b[C.active] = 0; if (v === 0x87) b[C.status] = 7; }   // stoned
        if (v === 0) G.g_8B52 = 1;
        break;
      case 0x10C:
        if (v === 0) { b[C.side] = 0; b[C.controlled] = 0; }
        else if (v === 0x80) { b[C.side] = 0; b[C.controlled] = 1; }
        else if (v === 0x81) { b[C.side] = 1; b[C.controlled] = 1; }
        break;
    }
  }

  // GBP flagSet: ecl_SetMem wrapped as in Pool (setMem = read the old word, the translated routine, report)
  async setMem(a, v) {
    const old = hooks.enabled ? this.getMem(a) : 0;
    await this.setMemRaw(a, v);
    hooks.emit('flagSet', () => ({ addr: w16(a), value: w16(v), old, region: this.memRegion(w16(a)), pc: this.opPC }));   // 2c00:0d70
  }
  // 2C00:0D70 ecl_SetMem(a, v)
  async setMemRaw(a, v) {
    a = w16(a); v = w16(v);
    switch (this.memRegion(a)) {
      case 0: {
        const o = a - 0x4B00;
        if (o === 0xFD || o === 0xFE) G.g_8B6A = 1;                     // 2c00:0d99  redraw portrait
        else if (o === 0xE6 && this.m0(0x4BE6) !== v) {                 // 2c00:0da0  3D-area flag changes
          G.view_PrevMode = G.view_Mode;                                // 2c00:0db3
          G.view_Mode = v === 0 ? 3 : 4;                                // 2c00:0dbf / 0dc6
        }
        this.setM0(a, v); break;                                        // 2c00:0dd9
      }
      case 1: this.setM1(a, v); await this.setCharField(a, v); break;   // 2c00:0df4 / 0e00
      case 2: this.setM2(a, v); break;
      case 3: this.setCode(a, v); break;                                // 2c00:0e32  byte
      default:
        if (a < 0xBF68) {                                               // 2c00:0e42
          if (a === 0x03DE) G.g_8B4C = v;
          else if (a === 0x00B8) G.g_8B4E = v;
          else if (a === 0x00B9) G.g_8B50 = v;                          // 00FB / 00FC / 00B1 and others: ignored
        } else switch (a - 0xBF68) {                                    // 2c00:0e89
          case 0xE3: G.g_8B68 = 1; G.party_MapX = lo(v); break;         // C04B
          case 0xE4: G.party_MapY = lo(v); G.g_8B68 = 1; break;         // C04C
          case 0xE5: { for (;;) { if (v <= 3) { G.party_Dir = v * 2; break; } v = w16(v - 4); } G.g_8B68 = 1; break; }   // C04D
          case 0xF1: G.g_75E8 = lo(v); G.g_8B67 = 1; break;             // C059
          case 0xF7: G.g_75E9 = lo(v); G.g_8B67 = 1; break;             // C05F
        }
    }
  }

  // 2C00:0F3A ecl_GetMem(a)
  getMem(a) {
    a = w16(a);
    switch (this.memRegion(a)) {
      case 0: return this.m0(a);
      case 1: { const r = this.getCharField(a); return r === undefined ? this.m1(a) : w16(r); }
      case 2: return this.m2(a);
      case 3: return this.codeAt(a);
    }
    if (a < 0xC04B) {
      switch (a) {
        case 0x00B1: return w16(G.g_75EE ?? 0);
        case 0x00FB: return w16(G.g_75EA ?? 0);
        case 0x00FC: return w16(G.g_75EC ?? 0);
        case 0x033D: return G.party_Dir;
      }
      return 0;                                                         // 035F and others: TODO(decode): garbage (L)
    }
    switch (a - 0xC04B) {
      case 0: return w16(sx8(G.party_MapX));
      case 1: return w16(sx8(G.party_MapY));
      case 2: return G.party_Dir >> 1;
      case 3: return G.party_Ahead;
      case 4: return G.party_CellAttr;
    }
    return 0;                                                           // TODO(decode): garbage (L)
  }

  // 2C00:108D ecl_SetMemString(a, s): one character per word in regions 0..2, per byte in 3, 0-terminated; 7C00 = name
  async setMemString(addr, s) {
    addr = w16(addr);
    const region = this.memRegion(addr);
    if (region === 1 && addr === 0x7C00) { if (G.SelectedChar) setPstr(G.SelectedChar.b, 0, s, 15); return; }
    if (region === 4) return;
    const len = Math.min(s.length, 255);
    const put = (i, b) => {
      if (region === 0) this.setM0(w16(addr + i), b);
      else if (region === 1) this.setM1(w16(addr + i), b);              // char-field overlay not applied (as Pool)
      else if (region === 2) this.setM2(w16(addr + i), b);
      else this.setCode(w16(addr + i), b);
    };
    for (let i = 0; i < len; i++) put(i, s.charCodeAt(i) & 0xFF);
    put(len, 0);
  }

  // 2C00:12AE ecl_UnpackString(len, slot) / 2C00:070D ecl_SixBitChar
  unpackString(len, slot) {
    let s = '', n = 0, phase = 1, cur = 0, prev = 0, c = 0;
    const add = (c) => { if (s.length < 255) s += String.fromCharCode(c > 0x1F ? c : c + 0x40); };
    while (n < len) {
      if (phase < 4) { this.pc = this.pc + 1; prev = cur; cur = this.codeAt(this.pc); n++; }
      switch (phase) {
        case 1: c = cur >> 2; break;
        case 2: c = lo((prev << 6) + (cur >> 2)) >> 2; break;
        case 3: c = lo((prev << 4) + (cur >> 4)) >> 2; break;
        case 4: c = cur & 0x3F; break;
      }
      phase = phase < 4 ? phase + 1 : 1;
      if (c !== 0) add(c);
    }
    if (phase === 4) { c = cur & 0x3F; if (c !== 0) add(c); }
    this.setStr(slot, s);
  }

  // 2C00:145C ecl_GetMemString(slot, a)
  getMemString(slot, addr) {
    addr = w16(addr);
    const region = this.memRegion(addr);
    let s = '';
    if (region === 1 && addr === 0x7C00) s = G.SelectedChar ? charName(G.SelectedChar) : '';
    else if (region !== 4) {
      const rd = (i) => region === 0 ? this.m0(w16(addr + i)) : region === 1 ? this.m1(w16(addr + i))
        : region === 2 ? this.m2(w16(addr + i)) : this.codeAt(w16(addr + i));
      let i = 0, guard = 0;
      while (rd(i) !== 0) {
        if (s.length < 255) s += String.fromCharCode(lo(rd(i)));
        i = lo(i + 1);
        if (++guard > 0x10000) throw new EclHang('GetMemString: unterminated string at ' + addr.toString(16));
      }
    }
    this.setStr(slot, s);
  }

  // 2C00:197B ecl_CompareStrings / 2C00:1A51 ecl_CompareWords (unsigned)
  compareStrings(sa, sb) {
    this.clearFlags(); const f = this.flags;
    if (sa === sb) f[0] = 1; else f[1] = 1;
    if (sa < sb) f[2] = 1; if (sa > sb) f[3] = 1;
    if (sa <= sb) f[4] = 1; if (sa >= sb) f[5] = 1;
  }
  compareWords(a, b) {
    this.clearFlags(); const f = this.flags;
    if (a === b) f[0] = 1; else f[1] = 1;
    if (a < b) f[2] = 1; if (a > b) f[3] = 1;
    if (a <= b) f[4] = 1; if (a >= b) f[5] = 1;
  }

  // 2C00:1AB9 ecl_Gosub(i)
  doGosub(i) { this.gosub.push(this.pc); this.pc = this.a(i); }

  // 2C00:1FF5 ecl_SkipInstruction: the fixed table, not the handlers' counts; overwrites CurOp
  skipInstruction() {
    const op = this.curOp = this.codeAt(this.pc);
    const k = SKIP_COUNT[op];
    if (k) this.readOperands(k); else this.pc = this.pc + 1;
  }

  // ===================================================================================================================
  // ov02 (2200) — fetch loop, dispatcher, handlers, game loop
  // ===================================================================================================================

  // 2200:3621 ecl_Run(addr)
  async run(addr) {
    this.pc = addr;                                                     // 2200:3628
    G.ecl_Stop = 0;                                                     // 2200:362e
    while (!G.ecl_Stop && !G.PartyDead) {                               // 2200:3633 / 363a
      this.lastOp = this.curOp;                                         // 2200:3641
      this.curOp = this.codeAt(this.pc);                                // 2200:3647
      this.opPC = this.pc;                                              // GBP: the instruction's address for hook payloads (no game effect)
      if (G.DebugFlag && G.TraceEcl) console.log(OPCODE_NAMES[this.curOp] ?? '');   // 2200:3658  ov34 tracer (dev ?trace=1)
      if (this.trace) this.trace(this.pc, this.curOp);
      if (++this.steps > this.stepLimit) throw new EclHang('step limit');
      await this.dispatch();                                            // 2200:3680
    }
    G.ecl_Stop = 0;                                                     // 2200:3686
  }

  // 2200:3377 ecl_Dispatch — no else: 1Fh / > 40h leave the PC unchanged and the original spins forever
  async dispatch() {
    const fn = HANDLERS[this.curOp];
    if (!fn) throw new EclHang('ECL opcode ' + this.curOp.toString(16) + ' at ' + this.pc.toString(16) + ' has no handler (VM hangs)');
    await fn.call(this);
  }

  // 2200:0052 EXIT
  async op00_Exit() {
    if (G.g_8B64) await this.host.FrameExplore();                       // 2200:005c  FUN_01A0_0136
    if (G.g_47E2) { G.SelectedChar = G.g_47E7; G.g_47E2 = 0; }          // 2200:0061 .. 0075
    G.enc_Shown = [false, false];                                       // 2200:0086  FillChar(DS:8B48, 2, 0)
    G.g_8B62 = 0; G.g_8B64 = 0;                                         // 2200:008b / 0090
    G.ecl_Stop = 1;                                                     // 2200:0095
    this.pc = this.pc + 1;                                              // 2200:009a
    this.gosub = [];                                                    // 2200:009e .. 00d3
    G.text_Row = 0x11; G.text_Col = 1;                                  // 2200:00d5 / 00da
    G.g_8B60 = 0;                                                       // 2200:00df
  }
  async op01_Goto() { this.readOperands(1); this.pc = this.a(1); }      // 2200:00E8
  async op02_Gosub() { this.readOperands(1); this.doGosub(1); }         // 2200:0107
  // 2200:011E COMPARE
  async op03_Compare() {
    this.readOperands(2);
    if (this.opType(1) >= 0x80 || this.opType(2) >= 0x80) this.compareStrings(this.str[1], this.str[2]);
    else { const x1 = this.v(1), x2 = this.v(2); this.compareWords(x1, x2); }
  }
  // 2200:019B ADD / SUBTRAT / DIVIDE / MULTIPLY
  async op04_AddSubDivMul() {
    this.readOperands(3);
    const x1 = this.v(1), x2 = this.v(2), dest = this.a(3);
    let r;
    switch (this.curOp) {
      case 0x04: r = x1 + x2; break;
      case 0x05: r = x2 - x1; break;                                    // quirk: operand 2 minus operand 1
      case 0x06:
        if (x2 === 0) throw new Error('Runtime error 200 (ECL DIVIDE by 0)');
        r = Math.floor(x1 / x2); this.setM1(0x7F3F, x1 % x2); break;    // 2200:0210  remainder -> Mem[7F3F]
      case 0x07: r = Math.imul(x1, x2); break;
    }
    await this.setMem(dest, r);
  }
  // 2200:0244 RANDOM
  async op08_Random() {
    this.readOperands(2);
    let n = lo(this.v(1)); if (n < 0xFF) n++;
    const dest = this.a(2);
    await this.setMem(dest, lo(await this.host.Random(n)));
  }
  // 2200:02A2 SAVE
  async op09_Save() {
    this.readOperands(2);
    const dest = this.a(2);
    if (this.opType(1) >= 0x80) await this.setMemString(dest, this.str[1]);
    else await this.setMem(dest, this.v(1));
  }
  // 2200:02F0 LOAD CHARACTER
  async op0A_LoadCharacter() {
    G.g_47E2 = 1;                                                       // restore SelectedChar at EXIT
    this.readOperands(1);
    const x = lo(this.v(1)), idx = x & 0x7F;
    let c = G.PartyList, i = 0;
    while (i < idx && c) { c = c.next; i++; }
    G.g_8B6D = c ? 0 : 1;                                               // not found -> 7D00 reads 0 once
    if (c) G.SelectedChar = c;
    if ((x & 0x80) && G.g_8B52 && G.g_8B53) {                           // the character flagged by 7C00 := 0 and 7D00 := 0 leaves
      if (G.g_47E7 === G.SelectedChar) G.g_47E2 = 0;
      await this.host.RemovePartyMember(0, 1);                         // 2200:03a4 / 03aa  pushes 0, 1 (ECL_VM.md had them reversed)
      await this.host.PartySummary(G.SelectedChar);
      G.g_8B52 = 0; G.g_8B53 = 0;
    }
  }
  // 2200:0466 LOAD MONSTER
  async op0B_LoadMonster() {
    const h = this.host, savedSel = G.SelectedChar;
    this.readOperands(3);
    if ((G.g_47E6 ?? 0) >= 0x3F) return;                                // monster count limit
    const id = lo(this.v(1));
    const rec = { v: null }, items = { v: null }, effects = { v: null };
    await h.LoadMonsterRecord(id, rec, items, effects);
    let cnt = lo(this.v(2)); if (cnt === 0) cnt = 1;
    const pic = lo(this.v(3));
    await h.LoadCombatIcon('CPIC', pic, G.g_7603);
    let p = G.PartyList; while (p && p.next) p = p.next;
    for (let k = 1; k <= cnt && (G.g_47E6 ?? 0) < 0x3F; k++) {          // append cnt copies at the end of the party list
      const n = k === 1 ? rec.v : newChar();
      if (k > 1) {
        n.b.set(rec.v.b);
        for (let it = items.v; it; it = it.next) { const ni = newItem(); ni.b.set(it.b); ni.next = n.items; n.items = ni; }   // quirk: reversed
        for (let e = effects.v; e; e = e.next) { const ne = newEffect(); ne.b.set(e.b); ne.next = n.effects; n.effects = ne; }
      }
      n.b[C.icon_slot] = G.g_7603; n.next = null;
      if (p) p.next = n; else G.PartyList = n;
      p = n;
      G.g_47E6 = (G.g_47E6 ?? 0) + 1;
    }
    hooks.emit('monsterShown', () => { const r = []; for (let n = rec.v; n; n = n.next) r.push(n); return { id, dataset: G.DataSet, name: charSummary(rec.v, 0).name, pic, count: r.length, slot: G.g_7603, ref: { dax: 'MON' + G.DataSet + 'CHA', record: id }, icon: { dax: 'CPIC' + G.DataSet, record: pic }, records: r }; });   // 2200:0326
    G.g_7603 = lo(G.g_7603 + 1); G.g_8B69 = 1;                         // monsters present
    G.SelectedChar = savedSel;
  }
  // 2200:03CA SETUP MONSTER
  async op0C_SetupMonster() {
    this.readOperands(3);
    G.g_7601 = this.v(1); this.setM1(0x7EC0, this.v(2)); G.g_7602 = this.v(3);
    const d = await this.host.ApproachDistance(G.party_MapX, G.party_MapY, G.party_Dir);
    this.setM1(0x7EC1, Math.min(this.m1(0x7EC0), d));
    await this.host.ShowEncounter(lo(G.g_7601), lo(G.g_7602), lo(this.m1(0x7EC1)), G.enc_Shown);
  }
  // 2200:0801 APPROACH
  async op0D_Approach() {
    if (this.m1(0x7EC1) > 0) {
      this.setM1(0x7EC1, this.m1(0x7EC1) - 1);
      await this.host.ShowEncounter(lo(G.g_7601), lo(G.g_7602), lo(this.m1(0x7EC1)), G.enc_Shown);
    }
    this.pc = this.pc + 1;
  }
  // 2200:0841 PICTURE
  async op0E_Picture() {
    const h = this.host;
    this.readOperands(1);
    const p = lo(this.v(1));
    if (p !== 0xFF) {
      G.enc_Shown[1] = true; G.g_8B62 = 1;                              // 2200:0863 / 0868
      if (this.m1(0x7EE1) === 0xFF) {                                   // 2200:0871
        G.g_8B63 = 1;                                                   // 2200:087a
        if (p >= 0x78) { await h.LoadBigPic(p); await h.DrawBigPic(); G.view_Redraw = 0; }   // 2200:0889 .. 0893  BIGPIC 120..123
        else {
          await h.LoadAnimation('PIC', p, 0, G.enc_Anim);               // 2200:08b5
          await h.DrawPictureScreenOrView(3, 3, 1, G.enc_Anim.pic[1]);  // 2200:08cd
        }
      } else await h.ShowHeadBodyPicture(lo(this.m1(0x7EE1)), p);      // 2200:08e2
      hooks.emit('pictureShown', () => ({ pic: p, dataset: G.DataSet }));
    } else {
      if ((G.view_PrevMode !== 4 || G.view_Mode === 4) && (G.g_8B62 || G.g_8B65)) {   // 2200:08e9 .. 08fe
        G.view_Redraw = 1; await h.RefreshView();                       // 2200:0905 / 090a
        G.g_8B62 = 0; G.g_8B65 = 0; G.g_8B63 = 1;
      }
      G.enc_Shown = [false, false];                                     // 2200:091e / 0923
    }
  }
  // 2200:092C INPUT NUMBER (operand 1 unused)
  async op0F_InputNumber() {
    this.readOperands(2);
    const dest = this.a(2);
    await this.setMem(dest, await this.host.ReadWordNumber('', 0x0A, 0));
  }
  // 2200:0972 INPUT STRING (operand 1 unused)
  async op10_InputString() {
    this.readOperands(2);
    const dest = this.a(2);
    let s = await this.host.ReadBottomLine('', 0x0A, 0, 0x28);
    if (s === '') s = ' ';
    await this.setMemString(dest, s);
  }
  // 2200:09EA PRINT / PRINTCLEAR
  async op11_Print() {
    const h = this.host;
    this.readOperands(1);
    G.g_8B66 = 0; G.TextOutputActive = 1;                               // 2200:09f9 / 09fe
    if (this.opType(1) < 0x80) this.setStr(1, String(this.v(1)));       // 2200:0a19  WordToStr
    hooks.emit('textPrinted', () => ({ text: this.str[1], window: 'text', clear: this.curOp === 0x12, source: this.curOp === 0x11 ? 'PRINT' : 'PRINTCLEAR', addr: this.opPC, block: G.ecl_Block, dataset: G.DataSet, fg: 0x0A, bg: 0 }));   // 2200:0a29
    if (this.curOp === 0x11) await h.DrawWrappedText(1, 0x11, 0x26, 0x16, 0x0A, 0, 0, this.str[1]);   // 2200:0a4d
    else { G.text_Row = 0x11; G.text_Col = 1; await h.DrawWrappedText(1, 0x11, 0x26, 0x16, 0x0A, 0, 1, this.str[1]); }   // 2200:0a78
    G.TextOutputActive = 0;                                             // 2200:0a7d
  }
  // 2200:0A86 RETURN: an empty list calls the EXIT handler (Curse delta)
  async op13_Return() {
    this.pc = this.pc + 1;
    if (this.gosub.length) this.pc = this.gosub.pop();
    else await this.op00_Exit();                                        // 2200:0acf
  }
  // 2200:0AD6 COMPARE AND
  async op14_CompareAnd() {
    this.clearFlags();
    this.readOperands(4);
    const x = [0, this.v(1), this.v(2), this.v(3), this.v(4)];
    if (x[1] === x[2] && x[3] === x[4]) this.flags[0] = 1; else this.flags[1] = 1;
  }
  // 2200:0B3B IF
  async op16_If() {
    this.pc = this.pc + 1;
    if (this.flags[this.curOp - 0x16] === 0) this.skipInstruction();
  }
  // 2200:0BBB NEWECL
  async op20_NewEcl() {
    this.readOperands(1);
    this.setM0(0x4BF2, G.ecl_Block);                                    // previous block
    G.ecl_Block = lo(this.v(1));
    await this.loadEclBlock(G.ecl_Block);
    this.initVM();
    G.ecl_Stop = 1; G.ecl_Restart = 1;
    G.enc_Shown = [false, false];                                       // FillChar(DS:8B48, 2, 0)
  }
  // 2200:0C15 LOAD FILES (21) / LOAD PIECES (37)
  async op21_LoadFilesPieces() {
    const h = this.host;
    this.readOperands(3);
    const b = [0, lo(this.v(1)), lo(this.v(2)), lo(this.v(3))];
    G.g_47E3 = 1;
    if (this.curOp === 0x21) {
      G.g_47E5 = 1;
      if (b[1] !== 0xFF && b[1] !== 0x7F && this.is3D()) { this.setM0(0x4BC5, b[1]); await h.Load3DMap(b[1]); }
      this.setM1(0x7EC9, 0);
      if (b[3] !== 0xFF && !this.is3D() && G.anim_Id !== 0x50) { await h.LoadBigPic(0x79); }   // 2D backdrop (Pool: BACPAC)
    } else {
      G.g_47E4 = 1;
      if (b[1] === 0x7F) await h.LoadWallSet(0, 1);                     // (id, slot)
      else if (this.m0(0x4BE7) === 0 || this.m0(0x4BE8) === 0) {
        for (let i = 1; i <= 3; i++) {
          if (b[i] !== 0xFF) await h.LoadWallSet(b[i], i);
          else await h.ClearWallSlot(i);                                // DS:7210+4i / 7212+4i := FFFFh
        }
      } else { await h.LoadWallSet(b[1], 1); await h.LoadWallSet(b[3], 3); }
    }
    if (G.g_47E4 && G.g_47E5 && G.view_PrevMode === 3) {
      if (G.view_Mode !== 3 && G.g_8B6E) {
        await h.FrameExplore(); await h.PartySummary(G.SelectedChar); await h.DrawLocationTimeStatus();
      }
      G.g_8B6E = 0;
    }
  }
  // 2200:0DA4 AND / OR: CompareWords(0, r)
  async op2F_AndOr() {
    this.readOperands(3);
    const x1 = this.v(1), x2 = this.v(2), dest = this.a(3);
    const r = this.curOp === 0x2F ? lo(x1 & x2) : lo(x1 | x2);
    this.compareWords(0, r);
    await this.setMem(dest, r);
  }
  // 2200:0E13 GETTABLE
  async op2A_GetTable() {
    this.readOperands(3);
    const base = this.a(1), idx = lo(this.v(2)), dest = this.a(3);
    await this.setMem(dest, this.getMem(base + idx));
  }
  // 2200:0E71 SAVE TABLE
  async op35_SaveTable() {
    this.readOperands(3);
    const value = this.v(1), base = this.a(2), idx = this.v(3);
    await this.setMem(base + idx, value);
  }
  // 2200:0EBD VERTICAL MENU (as Pool 2F00:0F08): the selection is stored even after Esc
  async op15_VerticalMenu() {
    const h = this.host;
    G.g_8B66 = 0;
    this.readOperands(3);
    const dest = this.a(1), prompt = this.str[1], cnt = lo(this.v(3));
    this.pc = this.pc - 1;
    this.readOperands(cnt);
    const list = { v: null };
    await h.NewMenuList(list, cnt);
    let node = list.v;
    for (let k = 1; k <= cnt && node; k++, node = node.next) node.text = this.str[k].substring(0, 40);
    G.text_Col = 1; G.text_Row = 0x11;
    hooks.emit('textPrinted', () => ({ text: prompt, window: 'text', clear: true, source: 'VERTICAL_MENU', addr: this.opPC, block: G.ecl_Block, dataset: G.DataSet, fg: 0x0A, bg: 0 }));
    await h.DrawWrappedText(1, 0x11, 0x26, 0x16, 0x0A, 0, 1, prompt);
    const redraw = { v: true }, index = { v: 0 }, item = { v: null };
    await h.EclVerticalListMenu('', '', 0x0D, 0x0A, 0x0F, 1, G.text_Row + 1, 0x26, 0x16, list.v, 0, redraw, index, item);
    await this.setMem(dest, index.v);
    await h.FreeMenuList(list);
    await h.ClearTextRectangle(1, 0x11, 0x26, 0x16);
  }
  // 2200:1082 HORIZONTAL MENU (as Pool 2F00:10D1)
  async op2B_HorizontalMenu() {
    this.readOperands(2);
    const dest = this.a(1), cnt = lo(this.v(2));
    this.pc = this.pc - 1;
    this.readOperands(cnt);
    let menu = '', single, colA, colB;
    if (cnt === 1) {                                                    // 2200:10c5
      single = 1; colA = 0x0F; colB = 0x0F;
      if (this.str[1] === 'PRESS BUTTON OR RETURN TO CONTINUE.') this.str[1] = 'PRESS <ENTER>/<RETURN> TO CONTINUE';   // 2200:10e1 / 10f6
    } else { single = 0; colA = 0x0F; colB = 0x0A; }                   // 2200:10fd
    const hilite = (G.g_8B62 && G.g_8B63) ? 1 : 0;                      // 2200:1109 / 1110  view_RedrawPicture and g_8B63
    const last = lo(cnt - 1);                                           // quirk: cnt = 0 -> 255 items
    for (let i = 1; i <= last; i++) menu = (menu + '~' + this.str[i] + ' ').substring(0, 50);
    menu = (menu + '~' + this.str[lo(cnt)]).substring(0, 50);
    const choice = await this.host.MenuSelect('', menu, 0x0D, colB, colA, single, hilite);
    await this.setMem(dest, choice);
    await this.host.ClearTextRectangle(0, 0x18, 0x27, 0x18);
  }
  // 2200:120E CLEARMONSTERS
  async op1C_ClearMonsters() {
    this.pc = this.pc + 1;
    G.g_47E6 = 0; G.g_8B69 = 0; G.g_7603 = 8;
    G.TreasureMoney = [0, 0, 0, 0, 0, 0, 0];                            // FillChar(DS:6F70, 1Ch, 0)
    G.TreasureItems = null;                                             // DS:6F8C freed
  }
  // 2200:1271 PARTYSTRENGTH
  async op1D_PartyStrength() {
    this.readOperands(1);
    let s = 0;
    for (let c = G.PartyList; c; c = c.next) {
      const b = c.b, lv = this.dualClassActive(c);
      const ac = Math.max(b[C.ac] - 0x3C, 0), th = Math.max(b[C.thac0] - 0x27, 0);
      s = lo(s + Math.floor(((b[C.lvl_a] + b[C.prev_a] * lv) * 4 + (b[C.lvl_b] + b[C.prev_b] * lv) * 8 + b[C.hp] + ac * 5 + th * 5) / 10));
    }
    await this.setMem(this.a(1), s);
  }
  // 2200:1416 CHECKPARTY (engine bug kept: k := key - 7FFFh, 2200:14b4)
  async op1E_CheckParty() {
    this.readOperands(6);
    const key = this.opType(1) === 1 ? this.a(1) : this.v(1);
    const id = lo(this.v(2));
    const d3 = this.a(3), d4 = this.a(4), d5 = this.a(5), d6 = this.a(6);
    const k = w16(key - 0x7FFF);
    let c = G.PartyList, found = 0, minV = 0xFF, maxV = 0, avgV = 0, sum = 0, n = 0;
    const store = async () => { await this.setMem(d3, minV); await this.setMem(d4, maxV); await this.setMem(d5, avgV); await this.setMem(d6, found); };   // 2200:13B6
    const scan = async (off) => {
      for (; c; c = c.next) { n++; const x = c.b[off]; if (x < minV) minV = x; if (x > maxV) maxV = x; sum = w16(sum + x); }
      avgV = n ? lo(Math.floor(sum / n)) : 0; found = 0;
      await store();
    };
    if (k === 0x8001) {                                                 // key 0: any member has effect id
      while (c && !found) { found = (await this.host.HasEffect(c, id)) ? 1 : 0; c = c.next; }
      minV = 0; maxV = 0; avgV = 0;
      await store();
    } else if (k >= 0xA5 && k <= 0xAC) await scan(((k + 0x5C) & 0xFF) + 0xE9);   // thief skills
    else if (k === 0x9F) await scan(C.move);
  }
  // 2200:1636 PARTY SURPRISE
  async op22_PartySurprise() {
    this.readOperands(2);
    let r = 0;
    for (let c = G.PartyList; c; c = c.next) if (c.b[C.class] === 4 || c.b[C.class] === 0x0A) r = 1;
    await this.setMem(this.a(1), r);
    await this.setMem(this.a(2), 0);
  }
  // 2200:16D2 SURPRISE (= Pool)
  async op23_Surprise() {
    this.readOperands(4);
    let res = 0;
    const b = [0, lo(this.v(1)), lo(this.v(2)), lo(this.v(3)), lo(this.v(4))];
    const p = sx8(b[4] + 2 - b[1]), m = sx8(b[2] + 2 - b[3]);
    const r1 = await this.host.Roll(1, 6), r2 = await this.host.Roll(1, 6);
    if (r1 <= p) res = r2 > m ? 1 : 3;
    if (r2 <= m) res = 2;
    await this.setMem(0x7ECB, res);
  }
  // 2200:179A COMBAT
  async op24_Combat() {
    const h = this.host;
    this.pc = this.pc + 1;
    if (!G.g_8B69 && !G.g_8B56) {                                       // no monsters
      if (this.m1(0x7F6C) === 1) { this.setM1(0x7F6C, 0); await h.Shop(); }
      else if (this.m1(0x7EE2) === 1) { this.setM1(0x7EE2, 0); await h.Temple(); }
      else await h.AfterCombat();
    } else {
      const d = await h.ApproachDistance(G.party_MapX, G.party_MapY, G.party_Dir);
      if (d < this.m1(0x7EC1)) this.setM1(0x7EC1, d);
      hooks.emit('combatStart', () => { const n = hooks.state.partyCount(), all = hooks.state.party({ monsters: true }); return { monsters: all.slice(n), partyCount: n, block: G.ecl_Block, x: G.party_MapX, y: G.party_MapY }; });   // 2200:1a32
      await h.CombatMain();
      await h.AfterCombat();
      hooks.emit('combatEnd', () => ({ partyDead: !!G.PartyDead, party: hooks.state.party() }));   // after AfterCombat (result code: TODO(decode) the Curse cell of Pool's 6DC7)
      if (!this.is3D()) await h.LoadBigPic(0x79);                       // 2D backdrop again
      G.g_8B56 = 0;
    }
    G.view_Mode = this.is3D() ? 4 : 3;
    this.setM1(0x7ECA, this.m1(0x7ECA) & 1);
    G.enc_Shown = [false, false]; G.g_8B62 = 0;
    await h.RedrawCurrentMode();
  }
  // 2200:1A9B ON GOTO / ON GOSUB
  async op25_OnGotoGosub() {
    this.readOperands(2);
    const x = lo(this.v(1)), cnt = lo(this.v(2));
    this.pc = this.pc - 1;
    this.readOperands(cnt);
    if (x < cnt) { if (this.curOp === 0x25) this.pc = this.a(x + 1); else this.doGosub(x + 1); }
  }
  // 2200:1B53 TREASURE
  async op27_Treasure() {
    const h = this.host;
    this.readOperands(8);
    G.TreasureMoney = []; for (let i = 0; i <= 6; i++) G.TreasureMoney[i] = this.v(i + 1);
    const t = lo(this.v(8));
    const prepend = (b) => { const it = newItem(); it.b.set(b.subarray(0, 0x3F)); it.next = G.TreasureItems; G.TreasureItems = it; };
    if (t < 0x80) {
      const rec = await h.LoadDaxRecord('ITEM' + G.DataSet, '.dax', t);
      if (!rec || rec.length === 0) { await h.ShowBottomPromptAndReadKey(0x0F, 0, 'Unable to find item file'); await h.TerminateGame(); return; }
      for (let ofs = 0; ofs < rec.length; ofs += 0x3F) prepend(rec.subarray(ofs, ofs + 0x3F));
    } else if (t !== 0xFF) {
      for (let k = 1; k <= t - 0x80; k++) {
        const r1 = await h.Roll(1, 100);                       // 2200:1d02..1d08  pushes 1, 64h (engine fix #12)
        let typ = this.treasureTyp ?? 0;                                // quirk: unset ranges keep the previous type
        if (r1 >= 1 && r1 <= 0x3C) {
          const r2 = await h.Roll(1, 100);
          if (r2 >= 1 && r2 <= 0x2F) typ = r2 === 0x2D ? 0x3B : r2;
          else if (r2 >= 0x30 && r2 <= 0x3B) typ = r2;
          else if (r2 >= 0x3C && r2 <= 0x5A) {
            const r3 = await h.Roll(1, 10);              // 2200:1d6b..1d71
            typ = r3 <= 4 ? 0x24 : r3 <= 7 ? 0x23 : r3 === 8 ? 0x22 : r3 === 9 ? 0x25 : 0x26;   // TODO(decode): table M (ECL_VM §4.4)
          } else if (r2 >= 0x5B && r2 <= 0x5E) typ = 0x49;
          else if (r2 >= 0x5F && r2 <= 0x61) typ = 0x5D;
          else if (r2 >= 0x62 && r2 <= 0x64) typ = 0x4D;
          else typ = 0x3B;
        } else if (r1 >= 0x3D && r1 <= 0x55) typ = 0x3D;
        else if (r1 >= 0x56 && r1 <= 0x5C) typ = 0x3E;
        else if (r1 >= 0x5B && r1 <= 0x62) {
          const r4 = await h.Roll(1, 15);                // 2200:1e1f..1e25
          typ = r4 <= 7 ? 0x47 : r4 <= 11 ? 0x54 : 0x4F;                // TODO(decode): split of the d15 table M
        } else if (r1 >= 0x63 && r1 <= 0x64) typ = 0x3B;
        this.treasureTyp = typ;
        const item = { v: newItem() };
        await h.MakeTreasureItem(typ, item.v);                         // 2200:1e74  MakeTreasureItem(typ, var it) (engine fix #12)
        prepend(item.v.b);
      }
      for (let p = G.TreasureItems; p; p = p.next) await h.BuildItemName(G.SelectedChar, p, 0, 0, 0, 0);   // 2200:1f12..1f2c (engine fix #12)
    }
  }
  // 2200:1F46 ROB: f := (100 - v(2)) / 100.0; operand 3 = the item chance (Curse delta)
  async op28_Rob() {
    this.readOperands(3);
    const who = lo(this.v(1)), f = (100 - lo(this.v(2))) / 100.0, pct = lo(this.v(3));
    if (who === 0) { await this.host.RobMoney(f, G.SelectedChar); await this.host.LoseItems(pct, G.SelectedChar); }
    else for (let c = G.PartyList; c; c = c.next) { await this.host.RobMoney(f, c); await this.host.LoseItems(pct, c); }
  }
  // 2200:2086 ENCOUNTER MENU (= Pool §4.4; ECL_VM.md M)
  async op29_EncounterMenu() {
    const h = this.host;
    G.g_8B6B = 1; G.g_8B66 = 0; G.TextOutputActive = 1;
    const mm = { v: 0 }, mn = { v: 0 };
    await h.PartyMoveRange(mm, mn);
    const maxMove = mm.v, minMove = mn.v;
    this.readOperands(14);
    G.g_7601 = this.v(1); this.setM1(0x7EC0, this.v(2)); G.g_7602 = this.v(3);
    const dest = this.a(4);
    const react = []; for (let i = 0; i <= 4; i++) react[i] = lo(this.v(i + 5));
    const txt = ['', this.str[1], this.str[2], this.str[3]];
    const fleeLimit = lo(this.v(13)), monFleeLimit = lo(this.v(14));
    const d = await h.ApproachDistance(G.party_MapX, G.party_MapY, G.party_Dir);
    this.setM1(0x7EC1, Math.min(this.m1(0x7EC0), d));
    const show = () => h.ShowEncounter(lo(G.g_7601), lo(G.g_7602), lo(this.m1(0x7EC1)), G.enc_Shown);
    const approach = async () => { this.setM1(0x7EC1, this.m1(0x7EC1) - 1); await show(); };
    const wait = () => h.DrawWrappedText(1, 0x11, 0x26, 0x16, 0x0A, 0, 1, 'Both sides wait.');
    const flee = async () => { G.text_Col = 1; G.text_Row = 0x11; await h.DrawWrappedText(1, 0x11, 0x26, 0x16, 0x0A, 0, 1, 'The monsters flee.'); };
    await show();
    let again;
    do {
      const highlight = (G.g_8B62 && G.g_8B63) ? 1 : 0;                 // (Pool g_84E0 / g_84E1 = Curse 8B62 / 8B63)
      let clearIt = 1; again = false;
      G.text_Col = 1; G.text_Row = 0x11;
      let k;
      switch (this.m1(0x7EC1)) {                                        // quirk: dist > 2 keeps txt[0]
        case 0: k = 1; do { txt[0] = txt[k]; k++; } while (!(txt[0] !== '' || k > 3)); break;
        case 1: k = 2; do { txt[0] = txt[k]; k++; if (k > 3) k = 1; } while (!(txt[0] !== '' || k === 2)); break;
        case 2: k = 3; do { txt[0] = txt[k]; k++; if (k > 3) k = 1; } while (!(txt[0] !== '' || k === 3)); break;
      }
      if (txt[0] === '') clearIt = 0;
      hooks.emit('textPrinted', () => ({ text: txt[0], window: 'text', clear: !!clearIt, source: 'ENCOUNTER', addr: this.opPC, block: G.ecl_Block, dataset: G.DataSet, fg: 0x0A, bg: 0 }));
      await h.DrawWrappedText(1, 0x11, 0x26, 0x16, 0x0A, 0, clearIt, txt[0]);
      const parlayMenu = this.m1(0x7EC1) === 0 || !this.is3D();
      const items = parlayMenu ? '~COMBAT ~WAIT ~FLEE ~PARLAY' : '~COMBAT ~WAIT ~FLEE ~ADVANCE';
      let choice = await h.MenuSelect('', items, 0x0D, 0x0A, 0x0F, 0, highlight);
      if (parlayMenu && choice === 3) choice = 4;
      hooks.emit('npcTalk', () => ({ kind: 'encounter', text: txt[0], choice: ['COMBAT', 'WAIT', 'FLEE', 'ADVANCE', 'PARLAY'][choice] ?? null, distance: this.m1(0x7EC1), sprite: lo(G.g_7601), pic: lo(G.g_7602), dataset: G.DataSet }));
      const r = choice < 5 ? react[choice] : 0xFF;                      // TODO(decode): garbage for choice 0FFh
      const dist0 = this.m1(0x7EC1) === 0;
      switch (r) {
        case 0: await this.setMem(dest, choice === 2 ? (minMove >= fleeLimit ? 2 : 1) : 1); break;
        case 1:
          if (choice === 0) await this.setMem(dest, 1);
          else if (choice === 1) { again = true; await wait(); }
          else if (choice === 2) await this.setMem(dest, 2);
          else if (choice === 3) { if (!dist0) await approach(); else await wait(); again = true; }
          else if (choice === 4) { if (dist0) await this.setMem(dest, 3); else { await approach(); again = true; } }
          break;
        case 2:
          if (choice === 0) { if (monFleeLimit > maxMove) { await this.setMem(dest, 0); await flee(); } else await this.setMem(dest, 1); }
          else if (choice >= 1 && choice <= 4) { await this.setMem(dest, 0); await flee(); }
          break;
        case 3:
          if (choice === 0) await this.setMem(dest, 1);
          else if (choice === 1 || choice === 3) { if (!dist0) await approach(); else await wait(); again = true; }
          else if (choice === 2) await this.setMem(dest, 2);
          else if (choice === 4) { if (dist0) await this.setMem(dest, 3); else { await approach(); again = true; } }
          break;
        case 4:
          if (choice === 0) await this.setMem(dest, 1);
          else if (choice === 1 || choice === 3 || choice === 4) { if (dist0) await this.setMem(dest, 3); else { await approach(); again = true; } }
          else if (choice === 2) await this.setMem(dest, 2);
          break;
      }
    } while (again);
    await h.ClearTextRectangle(0, 0x18, 0x27, 0x18);
    G.TextOutputActive = 0; G.g_8B6B = 0;
  }
  // 2200:27A8 PARLAY
  async op2C_Parlay() {
    this.readOperands(6);
    const resp = []; for (let i = 0; i <= 4; i++) resp[i] = this.v(i + 1);
    const k = await this.host.MenuSelect(' ', '~HAUGHTY ~SLY ~NICE ~MEEK ~ABUSIVE', 0x0D, 0x0A, 0x0F, 0, 0);
    hooks.emit('npcTalk', () => ({ kind: 'parlay', choice: ['HAUGHTY', 'SLY', 'NICE', 'MEEK', 'ABUSIVE'][k] ?? null, result: k < 5 ? resp[k] : null }));
    await this.setMem(this.a(6), k < 5 ? resp[k] : 0);                  // TODO(decode): garbage for k = 0FFh
  }
  // 2200:2847 FIND ITEM
  async op32_FindItem() {
    this.readOperands(1);
    const id = lo(this.v(1));
    this.clearFlags(); this.flags[1] = 1;
    let found = false;
    for (let c = G.PartyList; c && !found; c = c.next)
      for (let it = c.items; it && !found; it = it.next)
        if (it.b[I.type] === id) { this.flags[0] = 1; this.flags[1] = 0; found = true; }
  }
  // 2200:28F3 DELAY
  async op3A_Delay() { this.pc = this.pc + 1; await this.host.MessageDelay(); }
  // 2200:2942 DAMAGE (= Pool §4.3 with the Curse offsets; M)
  async op2E_Damage() {
    const h = this.host, saved = G.SelectedChar;
    let all = false, c = G.PartyList, victim = 0;
    this.readOperands(5);
    const flags = this.v(1), dice = this.v(2), sides = this.v(3), bonus = this.v(4), save = this.v(5);
    let dmg = w16(bonus + await h.Roll(dice, sides));                   // 2200:29af
    if (flags & 0x40) all = true;
    else victim = await h.Roll(1, lo(this.m1(0x7F3E)));                 // 2200:29e6  party count
    if (flags & 0x80) {
      const kind = flags & 0x1F, st = save & 7;
      if (all) {
        for (; c; c = c.next) {
          if (flags & 0x20) await h.ApplyEclDamage(dmg, c);
          else if (!await h.SavingThrow(c, st, kind)) await h.ApplyEclDamage(dmg, c);
        }
      } else if (save & 0x80) {
        if (st === 0 || !await h.SavingThrow(G.SelectedChar, st - 1, kind)) await h.ApplyEclDamage(dmg, G.SelectedChar);
      } else {
        for (let k = 2; k <= victim && c; k++) c = c.next;
        if (c && !await h.SavingThrow(c, st, kind)) await h.ApplyEclDamage(dmg, c);
      }
    } else {
      for (let i = 1; i <= lo(flags); i++) {                            // flags = number of hits
        c = G.PartyList;
        victim = await h.Roll(1, lo(this.m1(0x7F3E)));                  // 2200:2b72
        for (let k = 1; k <= victim - 1 && c; k++) c = c.next;
        if (c && await h.AttackRollVsAC(c, save)) await h.ApplyEclDamage(dmg, c);   // 2200:2ba5
        dmg = w16(bonus + await h.Roll(dice, sides));                   // 2200:2bc4
      }
    }
    G.PartyDead = 1;                                                    // 2200:2bee
    for (c = G.PartyList; c; c = c.next) if (c.b[C.active] !== 0) G.PartyDead = 0;
    if (G.PartyDead) {
      await h.DrawScreenFrame();                                        // 2200:2c24
      await h.DrawWrappedText(1, 1, 0x26, 0x16, 0x0A, 0, 1, 'The entire party is killed!');   // 2200:2c57
      await h.Delay(3000);                                              // 2200:2c60
    }
    G.SelectedChar = saved;                                             // 2200:2c6a
    await h.ShowBottomPromptAndReadKey(0x0F, 0, 'press <enter>/<return> to continue');   // 2200:2c86
  }
  // 2200:2C8F SPRITE OFF
  async op31_SpriteOff() {
    this.pc = this.pc + 1;
    if (G.g_8B65) { G.view_Redraw = 1; await this.host.RefreshView(); G.g_8B65 = 0; G.g_8B62 = 0; }
  }
  // 2200:2CB5 ECL CLOCK: the handler reads 2 operands (the skip table says 1)
  async op34_EclClock() {
    this.readOperands(2);
    await this.host.AdvanceClock(this.v(1), this.v(2));                 // 2200:2ce1
  }
  // 2200:2CEA PRINT RETURN
  async op33_PrintReturn() {
    this.pc = this.pc + 1;
    G.text_Col = 1; G.text_Row = lo(G.text_Row + 1);
  }
  // 2200:2D15 CLEAR BOX (Curse: redraws the party summary and the picture)
  async op3D_ClearBox() {
    const h = this.host;
    this.pc = this.pc + 1;
    await h.FrameExplore();                                             // FUN_01A0_0136
    await h.PartySummary(G.SelectedChar);
    await h.DrawLocationTimeStatus();
    await h.DrawPictureScreenOrView(3, 3, 1, G.enc_Anim && G.enc_Anim.pic ? G.enc_Anim.pic[1] : null);   // DS:7232/7234
    await h.DrawLocationTimeStatus();
    G.g_8B6E = 0; G.g_8B60 = 1;
  }
  // 2200:2D5E WHO
  async op39_Who() {
    this.readOperands(1);
    await this.host.ClearTextRectangle(1, 0x11, 0x26, 0x16);
    const sel = { v: G.SelectedChar };
    await this.host.SelectPartyCharacter(this.str[1], 0, sel);    // 6200:2E6A (prompt, allowExit, var sel) (engine fix #12)
    G.SelectedChar = sel.v;
  }
  // 2200:2DA9 ADD NPC
  async op36_AddNpc() {
    const h = this.host;
    this.readOperands(2);
    await h.AddNpcToParty(this.v(1));                                   // selects the new character
    if (G.SelectedChar) G.SelectedChar.b[C.npc_flags] = lo((this.v(2) >> 1) | 0x80);
    await h.RecalcItems(G.SelectedChar);
    await h.PartySummary(G.SelectedChar);
  }
  // 2200:2E16 SPELL: every member searched; destinations full words (Curse delta)
  async op3B_Spell() {
    this.readOperands(3);
    const id = lo(this.v(1)), d2 = this.a(2), d3 = this.a(3);
    let k = 1, n = 0, found = false;
    for (let c = G.PartyList; c && !found; c = c.next) {
      for (k = 1; k <= 0x65; k++) if (c.b[0x1F + k] === id) { found = true; break; }
      if (!found && c.next) n++;
    }
    if (k > 0x64) k = 0xFF;
    await this.setMem(d2, k);
    await this.setMem(d3, n);
  }
  // 2200:2F02 CALL
  async op2D_Call() {
    const h = this.host;
    this.readOperands(1);
    const t = this.a(1);
    switch (t) {
      case 0x2E10:
        G.party_CellAttr = await h.GetCellAttr(G.party_MapX, G.party_MapY);
        if (G.g_47E3 && (G.g_8B62 || G.g_8B65 || G.g_8B67 || G.g_8B68 || G.g_8B6A)) {
          G.view_Redraw = 1; await h.RefreshView(); await h.DrawLocationTimeStatus();
          G.g_8B6A = 0; G.g_8B67 = 0; G.g_8B68 = 0; G.g_8B62 = 0; G.g_8B65 = 0;
          G.party_Ahead = await h.GetWallType(G.party_MapX, G.party_MapY, G.party_Dir);
        }
        break;
      case 0x8000: await h.SetupDuel(1); break;
      case 0x8001: await h.SetupDuel(0); break;
      case 0xB200: await h.PlayOrStopSound(G.g_8B4C === 10 ? 0x0B : 0x0A); break;   // DS:25C2 / DS:25C0
      case 0xC01E: await h.StepForward(); break;
      case 0xC018: if (!this.is3D()) G.party_Ahead = await h.GetWallType(G.party_MapX, G.party_MapY, G.party_Dir); break;
      case 0x6803: {                                                    // one animation frame of the current picture set (ECL1/82)
        const an = G.enc_Anim;
        if (an && an.count) {
          await h.DrawPictureScreenOrView(3, 3, 1, an.pic[an.cur]);
          an.cur = an.cur + 1 > an.count ? 1 : an.cur + 1;
        }
        await h.MessageDelay();
        break;
      }
    }                                                                   // any other id: nothing
  }
  // 2200:3073 ecl_CampCheck
  async campCheck() {
    const h = this.host;
    const rested = { v: false };
    await this.run(G.ecl_VecC);                                         // 2200:3082
    await h.Camp(rested);                                               // 2200:308a
    if (rested.v) { await h.RedrawCurrentMode(); await this.run(G.ecl_VecD); }   // 2200:3094 .. 309f
    G.view_Redraw = 1; await h.RefreshView();                           // 2200:30a7 / 30ac
    G.GameSaved = 0;                                                    // 2200:30b1
  }
  // 2200:30DD PROGRAM
  async op38_Program() {
    const h = this.host;
    if (G.g_47E2) { G.SelectedChar = G.g_47E7; G.g_47E2 = 0; }
    this.readOperands(1);
    const p = this.v(1);
    if (p === 0) {
      await h.PartyCreationMenu();
      if (G.anim_Id !== 0x50 && !this.is3D()) await h.DrawLocationTimeStatus();
    } else if (p === 8) {                                               // won
      await h.EndSequence();
      G.g_8B6F = 1; this.setM0(0x4CFD, 0xFF); this.setM1(0x7EA8, 0xFF);
      for (let c = G.PartyList; c; c = c.next) { c.b[C.hp] = c.b[0x78]; c.b[C.status] = 0; c.b[C.active] = 1; }
      await h.PartyCreationMenu();
      if ((await h.AskYesNo("You've won. Save before quitting? ", 0x0D, 0x0A, 0x0F)) === 'Y') await h.SaveGame();
      await h.TerminateGame();
    } else if (p === 9) {                                               // camp
      const pc = this.pc;
      await this.campCheck();
      this.pc = pc;
      await this.op00_Exit();
    } else if (p === 3) { G.PartyDead = 1; await this.op00_Exit(); }   // party killed (ECL5/53)
  }
  // 2200:321F PROTECTION: the operand is never used; the rune wheel (BUILD_PLAN §2a flag) then redraw
  async op3C_Protection() {
    G.enc_Shown = [false, false]; G.g_8B62 = 0;
    this.readOperands(1);
    await this.host.RuneWheelCheckOp3C();                               // 2200:3243 (bypass: returns as if answered)
    await this.host.RedrawCurrentMode();                                // 2200:3248
  }
  // 2200:3251 DUMP: the selected character (an NPC) leaves
  async op3E_Dump() {
    this.pc = this.pc + 1;
    hooks.emit('npcLeft', () => (G.SelectedChar ? { ...charSummary(G.SelectedChar, 0), block: G.ecl_Block, addr: this.opPC } : undefined));   // cab: PER-8 (the member RemovePartyMember drops)
    await this.host.RemovePartyMember(0, 1);                            // 2200:325b .. 3261  pushes 0, 1 (ECL_VM.md had them reversed)
    G.g_47E7 = G.SelectedChar;
    await this.host.PartySummary(G.SelectedChar);
  }
  // 2200:3284 FIND SPECIAL
  async op3F_FindSpecial() {
    this.clearFlags();
    this.readOperands(1);
    const id = lo(this.v(1));
    if (G.SelectedChar && await this.host.HasEffect(G.SelectedChar, id)) this.flags[0] = 1; else this.flags[1] = 1;
  }
  // 2200:32D8 DESTROY ITEMS
  async op40_DestroyItems() {
    this.readOperands(1);
    const id = lo(this.v(1));
    for (let c = G.PartyList; c; c = c.next) {
      for (let it = c.items; it;) { const nx = it.next; if (it.b[I.type] === id) await this.host.LoseItem(c, it); it = nx; }
      await this.host.RecalcItems(c);
    }
  }

  // 2200:3691 ecl_RunAfterNewBlock
  async runAfterNewBlock() {
    const h = this.host;
    do {
      await h.FreeAnimation(G.enc_Anim);                                // 2200:3694
      G.camp_AnimName = 0; G.camp_AnimId = 0xFF;                        // 2200:369e / 36a3
      G.ecl_Restart = 0;                                                // 2200:36a8
      G.party_CellAttr = await h.GetCellAttr(G.party_MapX, G.party_MapY);   // 2200:36ad
      this.setM1(0x7ED5, 0);                                            // 2200:36bd
      G.g_47E7 = G.SelectedChar;                                        // 2200:36c8
      hooks.emit('areaEntered', () => ({ ...hooks.state.position(), source: 'NEWECL' }));   // after LoadEclBlock 2C00:0380 (op20 NEW_ECL)
      await this.run(G.ecl_VecE);                                       // 2200:36d5
      if (!G.ecl_Restart) this.setM0(0x4BF2, G.ecl_Block);              // 2200:36dd
      if (!G.ecl_Restart) {
        if (((G.view_PrevMode !== 4 || G.view_Mode === 4) && G.g_47E3) || (G.view_PrevMode === 4 && G.view_Mode === 4))
          await h.RefreshView();                                        // 2200:371c
        G.ecl_Restart = 0;
        await this.run(G.ecl_VecA);                                     // 2200:3726
        if (!G.ecl_Restart) {
          await this.run(G.ecl_VecB);                                   // 2200:3735
          if (!G.ecl_Restart) { G.SelectedChar = G.g_47E7; await h.PartySummary(G.SelectedChar); }   // 2200:3744 / 3751
        }
      }
    } while (G.ecl_Restart);                                            // 2200:375e
    G.view_PrevMode = G.view_Mode;                                      // 2200:3768
  }

  // GBP (plus request #11): a pending Plus job at the explore loop's safe point (hooks.takeSafePoint; jobs installed by
  // main_cab.js installPlusSaves). false = nothing pending; 'restart' = a game was loaded. Warp / redraw (Pool #14) are
  // not offered by the Curse build yet.
  async plusSafePoint() {
    const p = hooks.takeSafePoint();
    if (!p) return false;
    if (p.job && (await p.job(this)) === 'restart') return 'restart';
    await this.host.PartySummary(G.SelectedChar);
    await this.host.DrawLocationTimeStatus();
    return true;
  }

  // 2200:3772 ecl_GameLoop
  async gameLoop() {
    const h = this.host;
    G.g_47E7 = G.SelectedChar;                                          // 2200:3778
    G.view_Redraw = 1; G.g_8B64 = 0; G.g_47E4 = 0; G.g_47E5 = 0;        // 2200:3785 .. 3794
    G.g_47E2 = 0; G.g_47E3 = 0; G.g_8B6E = 1;                           // 2200:3799 .. 37a3
    G.view_Mode = 4; G.ecl_Restart = 0;                                 // 2200:37a8 / 37ad
    if (this.m0(0x4BF2) === 0) {                                        // 2200:37b2  a new game
      G.g_8B6E = 0;
      if (!G.DemoMode) { G.ecl_Block = 1; await h.PartySummary(G.SelectedChar); }   // 2200:37c3 .. 37d6
      else G.ecl_Block = 0x52;                                          // 2200:37ca  the attract demo = ECL1 record 82
    } else G.ecl_Block = lo(this.m0(0x4BF2));                           // 2200:37e5
    if (this.m0(0x4BE6) === 0) G.view_Mode = 3;                         // 2200:37f1 / 37fd
    if (!G.Resuming || this.m0(0x4BF2) === 0) await this.loadEclBlock(G.ecl_Block);   // 2200:3802 .. 3815
    else G.g_47E3 = 1;                                                  // 2200:3820
    this.initVM();                                                      // 2200:3825
    hooks.emit('areaEntered', () => { const plusLoad = G.PlusLoad ?? null; G.PlusLoad = null; return { ...hooks.state.position(), source: G.DemoMode ? 'DEMO' : 'GAMELOOP', plusLoad }; });   // after LoadEclBlock 2C00:0380 / a resumed save (plusLoad: #11)
    await this.run(G.ecl_VecE);                                         // 2200:382a
    if (G.DemoMode) {                                                   // 2200:3832  demo over: drop everyone
      while (G.PartyList) await h.RemovePartyMember(1, 1);              // 2200:3839 / 3844
      return;
    }
    if (!G.ecl_Restart) this.setM0(0x4BF2, G.ecl_Block);                // 2200:3850 / 3857
    else await this.runAfterNewBlock();                                 // 2200:3867
    if (G.view_Mode !== 3 && G.Resuming) {                              // 2200:386b / 3872
      if (G.g_8B6E === 1) await h.RedrawCurrentMode();
      G.view_Redraw = 1; await h.RefreshView();
    }
    G.Resuming = 0;                                                     // 2200:388f
    do {
      hooks.safePointArmed = true;                                      // GBP #11: only this explore wait may end early (plus request #12)
      let key = await h.ExploreCommand();                               // 2200:3894
      hooks.safePointArmed = false;
      const sp = await this.plusSafePoint();                            // GBP #11: a Plus quick / auto save or load, then explore again
      if (sp === 'restart') return this.gameLoop();                     //   a game was loaded: the loop starts again as after the top menu's Begin
      if (sp) continue;
      G.g_47E7 = G.SelectedChar;                                        // 2200:389c
      if (!G.ecl_Restart) this.setM0(0x4BF2, G.ecl_Block);              // 2200:38a9 / 38b0
      const k = () => upcase(typeof key === 'string' ? key.charCodeAt(0) : key);
      while ((this.m1(0x7ECA) > 1 || k() === 0x45) && !G.PartyDead) {  // 2200:38be .. 38da  Look or Encamp
        if (k() === 0x45) { await this.campCheck(); }                   // 2200:38e1 .. 38f3
        else {
          G.g_8B5F = this.m1(0x7ECA) & 1;                               // 2200:38f9
          this.setM1(0x7ECA, 1);                                        // 2200:3908
          G.view_Redraw = 1; await h.RefreshView();                     // 2200:3913 / 3918
          await this.run(G.ecl_VecB);                                   // 2200:391d
          if (G.ecl_Restart) await this.runAfterNewBlock();             // 2200:3925 / 392c
          this.setM1(0x7ECA, G.g_8B5F);                                 // 2200:3930
        }
        if (!G.PartyDead) { key = await h.ExploreCommand(); G.g_47E7 = G.SelectedChar; }   // 2200:393e .. 394d
      }
      if (!G.PartyDead) await this.run(G.ecl_VecA);                     // 2200:395d / 3964
      if (G.ecl_Restart) await this.runAfterNewBlock();                 // 2200:396c / 3973
      else if (!G.PartyDead) {
        this.setM0(0x4BF0, w16(sx8(G.party_MapX))); this.setM0(0x4BF1, w16(sx8(G.party_MapY)));   // 2200:3984 / 3991
        await h.MoveParty();                                            // 2200:399e
        await h.RefreshView();                                          // 2200:39a3
        if (sx8(G.party_MapX) < 0 || w16(sx8(G.party_MapX)) !== this.m0(0x4BF0) || sx8(G.party_MapY) < 0 || w16(sx8(G.party_MapY)) !== this.m0(0x4BF1))
          await h.PlayOrStopSound(0x0A);                                // 2200:39e0  step sound g_25C0
        G.g_8B62 = 0; G.g_8B63 = 1;                                     // 2200:39e9 / 39ee
        await this.run(G.ecl_VecB);                                     // 2200:39f3
        if (G.ecl_Restart) await this.runAfterNewBlock();               // 2200:39fb / 3a02
      }
    } while (!G.PartyDead);                                             // 2200:3a06
    G.PartyDead = 0;                                                    // 2200:3a10
  }
}

// 2200:3377 ecl_Dispatch case table (1Fh absent)
const P = EclVM.prototype;
export const HANDLERS = new Array(256).fill(null);
Object.assign(HANDLERS, {
  0x00: P.op00_Exit, 0x01: P.op01_Goto, 0x02: P.op02_Gosub, 0x03: P.op03_Compare,
  0x04: P.op04_AddSubDivMul, 0x05: P.op04_AddSubDivMul, 0x06: P.op04_AddSubDivMul, 0x07: P.op04_AddSubDivMul,
  0x08: P.op08_Random, 0x09: P.op09_Save, 0x0A: P.op0A_LoadCharacter, 0x0B: P.op0B_LoadMonster,
  0x0C: P.op0C_SetupMonster, 0x0D: P.op0D_Approach, 0x0E: P.op0E_Picture, 0x0F: P.op0F_InputNumber,
  0x10: P.op10_InputString, 0x11: P.op11_Print, 0x12: P.op11_Print, 0x13: P.op13_Return, 0x14: P.op14_CompareAnd,
  0x15: P.op15_VerticalMenu, 0x16: P.op16_If, 0x17: P.op16_If, 0x18: P.op16_If, 0x19: P.op16_If, 0x1A: P.op16_If,
  0x1B: P.op16_If, 0x1C: P.op1C_ClearMonsters, 0x1D: P.op1D_PartyStrength, 0x1E: P.op1E_CheckParty,
  0x20: P.op20_NewEcl, 0x21: P.op21_LoadFilesPieces, 0x37: P.op21_LoadFilesPieces, 0x22: P.op22_PartySurprise,
  0x23: P.op23_Surprise, 0x24: P.op24_Combat, 0x25: P.op25_OnGotoGosub, 0x26: P.op25_OnGotoGosub,
  0x27: P.op27_Treasure, 0x28: P.op28_Rob, 0x29: P.op29_EncounterMenu, 0x2A: P.op2A_GetTable,
  0x2B: P.op2B_HorizontalMenu, 0x2C: P.op2C_Parlay, 0x2D: P.op2D_Call, 0x2E: P.op2E_Damage,
  0x2F: P.op2F_AndOr, 0x30: P.op2F_AndOr, 0x31: P.op31_SpriteOff, 0x32: P.op32_FindItem, 0x33: P.op33_PrintReturn,
  0x34: P.op34_EclClock, 0x35: P.op35_SaveTable, 0x36: P.op36_AddNpc, 0x38: P.op38_Program, 0x39: P.op39_Who,
  0x3A: P.op3A_Delay, 0x3B: P.op3B_Spell, 0x3C: P.op3C_Protection, 0x3D: P.op3D_ClearBox,
  0x3E: P.op3E_Dump, 0x3F: P.op3F_FindSpecial, 0x40: P.op40_DestroyItems,
});

// every host routine the VM calls (decode names; for the bindings and the test harness)
export const HOST_METHODS = [
  'ClearMenuLine', 'DrawText', 'LoadDaxRecord', 'FrameExplore', 'Random', 'RemovePartyMember', 'PartySummary',
  'LoadMonsterRecord', 'LoadCombatIcon', 'ApproachDistance', 'ShowEncounter', 'LoadBigPic', 'DrawBigPic', 'LoadAnimation',
  'DrawPictureScreenOrView', 'ShowHeadBodyPicture', 'RefreshView', 'ReadWordNumber', 'ReadBottomLine', 'DrawWrappedText',
  'Load3DMap', 'LoadWallSet', 'ClearWallSlot', 'DrawLocationTimeStatus', 'NewMenuList', 'EclVerticalListMenu', 'FreeMenuList',
  'ClearTextRectangle', 'MenuSelect', 'HasEffect', 'Roll', 'Shop', 'Temple', 'AfterCombat', 'CombatMain',
  'ShowBottomPromptAndReadKey', 'TerminateGame', 'MakeTreasureItem', 'BuildItemName', 'RobMoney', 'LoseItems',
  'PartyMoveRange', 'MessageDelay', 'SavingThrow', 'ApplyEclDamage', 'AttackRollVsAC', 'DrawScreenFrame', 'Delay',
  'AdvanceClock', 'SelectPartyCharacter', 'AddNpcToParty', 'RecalcItems', 'GetCellAttr', 'GetWallType', 'SetupDuel',
  'PlayOrStopSound', 'StepForward', 'Camp', 'RedrawCurrentMode', 'PartyCreationMenu', 'EndSequence', 'AskYesNo', 'SaveGame',
  'RuneWheelCheckOp3C', 'LoseItem', 'FreeAnimation', 'ExploreCommand', 'MoveParty', 'SetDataSet',
];
