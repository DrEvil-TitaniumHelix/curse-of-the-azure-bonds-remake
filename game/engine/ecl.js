// game/engine/ecl.js — the ECL event-script VM (ov03 = 2F00 handlers + game loop, ov07 = 4300 decoder/memory/helpers).
// Owner: por-build-ecl. Translated routine by routine from decode/pseudo/ECL.pas.md (spec decode/ecl/ECL_VM.md);
// every function keeps the `seg:off` of its pseudo routine, statements keep the address where it matters.
// Quirks of the original are reproduced and marked `quirk:`; values the original leaves uninitialised are
// marked `TODO(decode): garbage` and replaced by a fixed value.
//
// Engine coupling:
//  - `g`    = the DS globals the VM shares with the engine (names below, DS address in ECL_GLOBALS). The engine
//             (state.js) passes its own object; the VM only reads/writes the named properties.
//  - `host` = every routine outside ov03/ov07 (text, menus, pictures, combat, shops, map, party...). All host calls
//             are awaited. Missing host methods are a programming error (thrown), so bindings stay explicit.
//  - Characters are objects { b: Uint8Array(0x11D) (TChar, SAVES.md §3), next, items, effects } — the far pointers
//    at +104h/+C8h/+7Fh are JS references. Items { b: Uint8Array(0x3F), next }, effects { b: Uint8Array(9), next }.

import { hooks, charSummary } from '../plus/hooks.js';   // GBP W1: one-line event call sites (docs/PLUS_HOOKS.md)

// por-only: record sizes and VM base/code buffer (profile: recordSizes / ecl; game/profiles/PORONLY.md)
export const CHAR_SIZE = 0x11D, ITEM_SIZE = 0x3F, EFFECT_SIZE = 9;
export const BASE = 0x9900, CODE_SIZE = 0x1E00;

// DS address of every engine global the VM touches (names as in ECL.pas.md / GLOBALS.md where named).
// por-only: Pool DS globals and VM memory layout (profile: engine.id (decoded adapter) / engine.state.globals; game/profiles/PORONLY.md)
export const ECL_GLOBALS = {
  SelectedChar: 0x5D92, PartyHead: 0x5D96, ecl_Stop: 0x442E, ecl_Restart: 0x442F, PartyDead: 0x49FF,
  ecl_Block: 0x84DC, DataSet: 0x5376, MonsterCount: 0x4435, enc_NextIconSlot: 0x6F83, enc_SpriteId: 0x6F81,
  enc_PicId: 0x6F82, party_MapX: 0x6AAD, party_MapY: 0x6AAE, party_Dir: 0x6AAF, party_Ahead: 0x6AB0,
  party_CellAttr: 0x6AB1, view_AreaMap: 0x6AAC, travel_Mode: 0x49FA, g_49F9: 0x49F9, g_49F3: 0x49F3,
  g_49F6: 0x49F6, g_49F8: 0x49F8, g_49FD: 0x49FD, g_49FE: 0x49FE, text_Col: 0x5E24, text_Row: 0x5E25,
  g_4430: 0x4430, g_4431: 0x4431, g_4432: 0x4432, g_4433: 0x4433, g_4434: 0x4434, g_4436: 0x4436,
  g_4A00: 0x4A00, g_84C8: 0x84C8, g_84C9: 0x84C9, g_84CC: 0x84CC, g_84CE: 0x84CE, g_84D0: 0x84D0,
  g_84D2: 0x84D2, g_84D3: 0x84D3, g_84D4: 0x84D4, g_84DD: 0x84DD, g_84DE: 0x84DE, g_84DF: 0x84DF,
  g_84E0: 0x84E0, g_84E1: 0x84E1, g_84E2: 0x84E2, g_84E3: 0x84E3, g_84E4: 0x84E4, g_84E5: 0x84E5,
  g_84E6: 0x84E6, g_84E7: 0x84E7, g_84E8: 0x84E8, g_84E9: 0x84E9, g_84EA: 0x84EA, g_6F68: 0x6F68,
  g_6F69: 0x6F69, g_6F6A: 0x6F6A, g_6F6C: 0x6F6C, g_6F6E: 0x6F6E, g_70C6: 0x70C6, g_557C: 0x557C,
  g_557D: 0x557D, g_547C: 0x547C, g_2628: 0x2628, g_262A: 0x262A,
  TreasureMoney: 0x67F4, TreasureItems: 0x6810,
};

export function makeGlobals() {
  const g = {};
  for (const k of Object.keys(ECL_GLOBALS)) g[k] = 0;
  g.SelectedChar = null; g.PartyHead = null; g.g_4436 = null; g.TreasureItems = null;
  g.TreasureMoney = [0, 0, 0, 0, 0, 0, 0];
  g.g_547C = ''; g.DataSet = 1; g.enc_NextIconSlot = 8;
  return g;
}

// ---- record helpers (TChar / item / effect) ----------------------------------------------------------------
export function newChar() { return { b: new Uint8Array(CHAR_SIZE), next: null, items: null, effects: null }; }
export function newItem() { return { b: new Uint8Array(ITEM_SIZE), next: null }; }
export function newEffect() { return { b: new Uint8Array(EFFECT_SIZE), next: null }; }
export const rdW = (b, o) => b[o] | (b[o + 1] << 8);
export const wrW = (b, o, v) => { b[o] = v & 0xFF; b[o + 1] = (v >> 8) & 0xFF; };
export function pstr(b, o) { let s = ''; for (let i = 1; i <= b[o]; i++) s += String.fromCharCode(b[o + i]); return s; }
export function setPstr(b, o, s, max) {
  s = s.substring(0, max); b[o] = s.length;
  for (let i = 0; i < s.length; i++) b[o + 1 + i] = s.charCodeAt(i) & 0xFF;
}
const charName = (c) => pstr(c.b, 0);              // TChar +00h string[15]
const sx8 = (v) => ((v & 0xFF) ^ 0x80) - 0x80;     // ShortInt
const w16 = (v) => v & 0xFFFF;
const lo = (v) => v & 0xFF;
const upcase = (k) => (k >= 0x61 && k <= 0x7A) ? k - 0x20 : k;
const isHotkeyChar = (k) => (k >= 0x30 && k <= 0x39) || (k >= 0x41 && k <= 0x5A);   // set CS:154D ['0'..'9','A'..'Z']

// TChar offsets used by the VM (SAVES.md §3)
const C = { con: 0x14, cha: 0x15, mem_spell: 0x17, class: 0x2F, save1: 0x6E, unk_73: 0x73, thief_skill: 0x77,
  npc_flags: 0x84, money: 0x88, lvl0: 0x96, lvl5: 0x9B, alignment: 0xA0, party_slot: 0xBF, status: 0x10C,
  active: 0x10D, unk_10E: 0x10E, unk_10F: 0x10F, thac0: 0x110, ac: 0x111, hp: 0x11B, move: 0x11C };
const I = { type: 0x2E, weight: 0x37 };

export class EclHang extends Error {}

export class EclVM {
  constructor(host, g = makeGlobals()) {
    this.host = host; this.g = g;
    EclVM.current = this;
    this.code = new Uint8Array(CODE_SIZE);       // DS:49DE ecl_CodeBuf, VM 9900..B6FF
    this.mem4900 = new Uint16Array(0x400);       // DS:49D2 region 0 (SAVGAM block 1)
    this.mem6B00 = new Uint16Array(0x400);       // DS:49D6 region 1 (SAVGAM block 2)
    this.mem9700 = new Uint16Array(0x200);       // DS:49DA region 2 (SAVGAM block 3)
    this.pc = 0;                                 // DS:49ED
    this.curOp = 0; this.lastOp = 0;             // DS:6F7F / 6F7E
    this.flags = new Uint8Array(6);              // DS:6F78..6F7D EQ NE LT GT LE GE
    this.ops = new Uint8Array(0x200);            // DS:7006: OpType[i]=[i-1], OpHi[i]=[40h+i-1], OpLo[i]=[80h+i-1] (overlap kept)
    this.str = new Array(256).fill('');          // Str[k] = DS:6FC8 + k*100h
    this.gosub = [];                             // DS:6F70 linked list of {ret}; top = last
    this.vecA = this.vecB = this.vecC = this.vecD = this.vecE = 0;   // DS:49E3..49EB
    this.treasureTyp = 0;                        // TREASURE local [BP-65h] (stale across items, see quirk)
    this.trace = null;                           // test hook: (pc, op) before each dispatch
    this.stepLimit = Infinity; this.steps = 0;
  }

  // ---- small accessors ------------------------------------------------------------------------------------
  opType(i) { return this.ops[i - 1]; }
  opHi(i) { return this.ops[0x40 + i - 1]; }
  opLo(i) { return this.ops[0x80 + i - 1]; }
  a(i) { return this.opHi(i) * 256 + this.opLo(i); }                     // MakeWord(OpLo[i], OpHi[i]) 4300:06AF
  v(i) { return this.operandValue(i); }
  codeAt(a) { const k = w16(a - BASE); return k < CODE_SIZE ? this.code[k] : 0; }   // TODO(decode): bytes past the buffer = heap
  setCode(a, b) { const k = w16(a - BASE); if (k < CODE_SIZE) this.code[k] = b & 0xFF; }
  m0(a) { return this.mem4900[(a - 0x4900) & 0x3FF]; }  setM0(a, v) { this.mem4900[(a - 0x4900) & 0x3FF] = v; }
  m1(a) { return this.mem6B00[(a - 0x6B00) & 0x3FF]; }  setM1(a, v) { this.mem6B00[(a - 0x6B00) & 0x3FF] = v; }
  m2(a) { return this.mem9700[(a - 0x9700) & 0x1FF]; }  setM2(a, v) { this.mem9700[(a - 0x9700) & 0x1FF] = v; }
  is3D() { return this.m0(0x49E6) !== 0; }                               // Mem[49E6] 3D-area flag
  setStr(k, s) { this.str[k & 0xFF] = s.length > 255 ? s.substring(0, 255) : s; }
  clearFlags() { this.flags.fill(0); }

  // ======================================================================================================
  // ov07 (4300) part D — operand decoder, VM init/loader, encounter display, VM memory
  // ======================================================================================================

  // 4300:0000
  readOperands(n) {
    let k = 0;
    for (let i = 1; i <= (n & 0xFF); i++) {
      this.ops[i - 1] = this.codeAt(this.pc + 1);                       // 4300:0022 OpType[i]
      this.ops[0x80 + i - 1] = this.codeAt(this.pc + 2);                // 4300:003C OpLo[i]
      this.pc = w16(this.pc + 2);
      const t = this.ops[i - 1];
      if (t === 1 || t === 2 || t === 3) {
        this.pc = w16(this.pc + 1);                                     // 4300:0076
        this.ops[0x40 + i - 1] = this.codeAt(this.pc);
      } else if (t === 0x80) {
        k++;                                                            // 4300:009A
        if (this.opLo(i) > 0) this.unpackString(this.opLo(i), k);       // 4300:00B3
        else this.setStr(k, '');
      } else if (t === 0x81) {
        k++;                                                            // 4300:00D7
        this.pc = w16(this.pc + 1);
        this.ops[0x40 + i - 1] = this.codeAt(this.pc);
        this.getMemString(k, this.a(i));                                // 4300:00F7
      }                                                                 // other types: 2 bytes, OpHi stale
    }
    this.pc = w16(this.pc + 1);                                         // 4300:012C
  }

  // 4300:0136
  operandValue(i) {
    const l = this.opLo(i), h = this.opHi(i);
    switch (this.opType(i)) {
      case 0: return l;
      case 1: case 3: case 0x80: return this.getMem(h * 256 + l);       // 0x80: meaningless value
      case 2: case 0x81: return h * 256 + l;
      default: return 0;                                                // TODO(decode): garbage (uninitialised [bp-2])
    }
  }

  // 4300:01B6
  initVM() {
    const g = this.g;
    g.g_84E0 = 0; g.g_84E2 = 0; g.g_84D2 = 0; g.g_84D3 = 0;
    g.g_6F68 = 0x41; g.g_6F69 = 9;                                      // 4300:01D0
    g.g_84E5 = 1;
    g.g_84C8 = 0; g.g_84C9 = 0;
    g.enc_NextIconSlot = 8;
    this.pc = BASE;                                                     // 4300:01F5
    g.g_70C6 = 0;
    this.gosub = [];
    this.clearFlags();
    this.setM1(0x6DE1, 0xFF);                                           // 4300:0225
    this.setM1(0x6DD2, 0); this.setM1(0x6DD3, 0);
    this.setM0(0x49E5, 0);
    this.readOperands(1); this.vecA = this.a(1);                        // 4300:0251
    this.readOperands(1); this.vecB = this.a(1);
    this.readOperands(1); this.vecC = this.a(1);
    this.readOperands(1); this.vecD = this.a(1);
    this.readOperands(1); this.vecE = this.a(1);                        // 4300:02A9
    this.setM0(0x49E6, 1);                                              // 4300:02BF
    if (g.g_49F8 === 0) {                                               // 4300:02C6
      for (let j = 1; j <= 0x20; j++) this.setM0(0x49FF + j, 0);        // 4A00..4A1F block-local
      for (let j = 0; j <= 9; j++) this.setM1(0x6E79 + j, 0);           // 6E79..6E82
    } else g.g_49F8 = 0;                                                // 4300:0319
  }

  // 4300:0341
  async loadEclBlock(block) {
    const h = this.host;
    this.code.fill(0);                                                  // 4300:0355
    this.g.g_557C = 0;
    let rec = null, tries = 0;
    do {                                                                // quirk: retries forever (disk prompt loop)
      await h.clearMenuLine();                                          // 4300:035F
      await h.drawText(0, 0x18, 0x0F, 'Loading...Please Wait');         // 4300:037C
      const ds = String(this.g.DataSet);
      rec = await h.loadDaxRecord('ECL' + ds, '.dax', block & 0xFF);    // 4300:03D3 -> Uint8Array | null
      if (++tries > 1000) throw new EclHang('LoadEclBlock: ECL record ' + block + ' missing');
    } while (!rec || rec.length < 2);                                   // 4300:03D8
    const n = Math.min(rec.length - 2, CODE_SIZE);                      // TODO(decode): > 1E00h would overrun the heap block
    this.code.set(rec.subarray(2, 2 + n), 0);                           // 4300:03F3 Move(p^[2], CodeBuf^, size-2)
    await h.clearMenuLine();                                            // 4300:0406
  }

  // 4300:0482  ApproachDistance(x, y: ShortInt; dir): free squares ahead, max 2; 2 outside 3D areas
  async approachDistance(x, y, dir) {
    let steps = 0, blocked = false, r = 0;
    x = sx8(x); y = sx8(y);
    if (!this.is3D()) { r = 2; this.setM1(0x6DC1, 2); }                // 4300:0494
    else while (steps < 2 && !blocked) {
      if (await this.host.getWallType(x, y, dir) === 0) {               // 4300:04C9
        steps++; r = steps;
        switch (dir) { case 0: y--; break; case 2: x++; break; case 4: y++; break; case 6: x--; break; }
      } else blocked = true;
    }
    return r;
  }

  // 4300:0511 ShowHeadBodyPicture(head, body)
  async showHeadBodyPicture(head, body) {
    const g = this.g;
    g.g_84E1 = 0;
    g.g_49FD = head; g.g_49FE = body;                                   // 4300:0519
    await this.host.loadPortrait(head, body);                           // 4300:052D
    await this.host.drawPortrait(3, 3, 1);                              // 4300:053B
  }

  // 4300:054E ShowEncounter(sprite, pic, dist; var shown = g_84C8/g_84C9)
  async showEncounter(sprite, pic, dist) {
    const g = this.g, h = this.host;
    if (!g.g_84C9 && g.g_84C8) await h.refreshView();                  // 4300:0554
    const size = lo(dist + 1);
    if (!g.g_84C9) {
      if (!g.g_84C8) {
        if (g.view_AreaMap !== 0) { g.view_AreaMap = 0; await h.refreshView(); }   // 4300:0588
        await h.loadAnimation('SPRIT', sprite, 1);                      // 4300:05B4 into g_6ABE
        g.g_84C8 = 1; g.g_84E3 = 1;                                     // 4300:05B9
      }
      if (g.travel_Mode === 1) await h.show3DSprite(size);              // 4300:05C5
      else await h.show3DSprite(2);
    }
    if (g.g_84C9 && g.g_84EA === this.m1(0x6DE1)) return;              // 4300:05E9
    if (dist !== 0) return;
    if (g.travel_Mode !== 1) return;
    if (g.g_84E9 !== 0 && g.g_49F6 === 0) return;                      // 4300:0619
    g.g_84EA = lo(this.m1(0x6DE1));
    g.g_84E0 = 1;
    if (this.m1(0x6DE1) === 0xFF) {                                     // 4300:063B
      await h.loadAnimation('PIC', pic, 0);
      g.g_84C9 = 1;
      await h.drawPictureScreenOrView(3, 3, 1);                         // 4300:0683
    } else {
      await this.showHeadBodyPicture(lo(this.m1(0x6DE1)), pic);         // 4300:0699
      g.g_84C9 = 1; g.g_84E1 = 0;
    }
  }

  // 4300:06FB
  memRegion(a) {
    if (a >= 0x4900 && a <= 0x4CFF) return 0;
    if (a >= 0x6B00 && a <= 0x6EFF) return 1;
    if (a >= 0x9700 && a <= 0x98FF) return 2;
    if (a >= 0x9900 && a <= 0xB6FF) return 3;
    return 4;
  }

  // 4300:0756
  partyIndexOf(c) {
    let p = this.g.PartyHead, n = 0;
    while (p && p !== c) { n++; p = p.next; }
    return n;
  }

  // 4300:07BC  -> value | undefined (= not a character field)
  getCharField(a) {
    const c = this.g.SelectedChar;
    if (!c) return 0;                                                   // TODO(decode): nil SelectedChar never happens in play
    const b = c.b, o = a - 0x6B00;
    if (o >= 0xA5 && o <= 0xAC) return b[C.thief_skill + o - 0xA5];     // 4300:081D
    switch (o) {
      case 0x018: return b[C.con];
      case 0x09B: return b[C.save1];
      case 0x0A0: return w16(sx8(b[C.unk_73]));
      case 0x0B8: return b[C.npc_flags];
      case 0x0BB: return rdW(b, C.money);
      case 0x0BD: return rdW(b, C.money + 2);
      case 0x0BF: return rdW(b, C.money + 4);
      case 0x0C1: return rdW(b, C.money + 6);
      case 0x0C3: return rdW(b, C.money + 8);
      case 0x0D8: return w16(sx8(b[C.alignment]));
      case 0x0F7: return rdW(b, 0xB8);
      case 0x0F9: return b[0xBA];
      case 0x100: return b[C.active] !== 0 ? 1 : 0x80;                  // 4300:08FB
      case 0x10C: return (b[C.unk_10E] === 0 && b[C.unk_10F] !== 0) ? 0x80 : (b[C.unk_10E] === 1 ? 0x81 : 0);
      case 0x10D: return 0;                                             // quirk: found, TODO(decode): garbage value
      case 0x11B: return b[C.move];
      case 0x2B1: case 0x2B4: return this.partyIndexOf(c);
      case 0x2CF: {                                                     // 4300:09AD reaction adjustment from cha
        const ch = b[C.cha];
        if (ch === 3) return 0; if (ch === 4) return 5; if (ch === 5) return 10; if (ch === 6) return 15;
        if (ch === 7) return 20; if (ch >= 8 && ch <= 12) return 25; if (ch === 13) return 30; if (ch === 14) return 35;
        if (ch === 15) return 40; if (ch === 16) return 50; if (ch === 17) return 55; if (ch >= 18 && ch <= 25) return 60;
        return 0;                                                       // TODO(decode): garbage for cha < 3 / > 25
      }
      case 0x312: return this.g.DataSet;
      case 0x33E: return this.m1(0x6E3E);
    }
    return undefined;
  }

  // 4300:0A74
  async setCharField(a, v) {
    const c = this.g.SelectedChar, o = a - 0x6B00;
    if (o === 0x312) { await this.host.setDataSet(lo(v)); return; }    // 4300:0C03
    if (o === 0x322 || o === 0x324 || o === 0x326) {                    // 4300:0C0F (pushes id, then slot)
      if (v > 0x80) await this.host.loadWallSet(v & 0x7F, (o - 0x320) >> 1);
      return;
    }
    if (o === 0x000) { if (v === 0) this.g.g_84D3 = 1; return; }
    if (!c) return;
    const b = c.b;
    if (o >= 0x020 && o <= 0x070) { b[0x17 + (o - 0x1F)] = lo(v); return; }   // 4300:0AA3 c+18h..c+68h
    switch (o) {
      case 0x0B8: if (v > 0xB2) v -= 0x32; b[C.npc_flags] = lo(v); break;
      case 0x0BB: wrW(b, C.money, v); break;
      case 0x0BD: wrW(b, C.money + 2, v); break;
      case 0x0BF: wrW(b, C.money + 4, v); break;
      case 0x0C1: wrW(b, C.money + 6, v); break;
      case 0x0C3: wrW(b, C.money + 8, v); break;
      case 0x0F7: wrW(b, 0xB8, v); break;
      case 0x0F9: b[0xBA] = lo(v); break;
      case 0x100:                                                       // 4300:0B71
        if (v >= 0x80) { b[C.active] = 0; if (v === 0x87) b[C.status] = 7; }
        if (v === 0) this.g.g_84D2 = 1;
        break;
      case 0x10C:
        if (v === 0) { b[C.unk_10E] = 0; b[C.unk_10F] = 0; }
        else if (v === 0x80) { b[C.unk_10E] = 0; b[C.unk_10F] = 1; }
        else if (v === 0x81) { b[C.unk_10E] = 1; b[C.unk_10F] = 1; }
        break;
    }
  }

  // 4300:0C77 ecl_SetMem + GBP flagSet after the write (the write itself is setMemRaw)
  async setMem(a, v) {
    const old = hooks.enabled ? this.peekMem(w16(a)) : 0;
    await this.setMemRaw(a, v);
    hooks.emit('flagSet', () => ({ addr: w16(a), value: w16(v), old, region: this.memRegion(w16(a)) }));   // 4300:0C77
  }
  peekMem(a) { const r = this.memRegion(a); return r === 0 ? this.m0(a) : r === 1 ? this.m1(a) : r === 2 ? this.m2(a) : r === 3 ? this.codeAt(a) : undefined; }

  // 4300:0C77
  async setMemRaw(a, v) {
    a = w16(a); v = w16(v);
    const g = this.g;
    switch (this.memRegion(a)) {
      case 0: this.setM0(a, v); if (a === 0x49FD || a === 0x49FE) g.g_84E8 = 1; return;
      case 1: this.setM1(a, v); await this.setCharField(a, v); return;
      case 2: this.setM2(a, v); return;
      case 3: this.setCode(a, v); return;                               // 4300:0CF9
    }
    if (a < 0xBF68) {                                                   // 4300:0D1B
      if (a === 0x03DE) g.g_84CC = v;
      else if (a === 0x00B8) g.g_84CE = v;
      else if (a === 0x00B9) g.g_84D0 = v;
      return;                                                           // 00FB/00FC/00B1 and others: ignored
    }
    switch (a) {
      case 0xC04B: g.g_84E6 = 1; g.party_MapX = lo(v); break;           // 4300:0D6C
      case 0xC04C: g.party_MapY = lo(v); g.g_84E6 = 1; break;
      case 0xC04D: {                                                    // 4300:0D91 facing 0..3 -> 0,2,4,6
        for (;;) {
          if (v <= 3) { g.party_Dir = v * 2; break; }
          v = w16(v - 4);
        }
        g.g_84E6 = 1; break;
      }
      case 0xC059: g.g_6F68 = lo(v); g.g_84E5 = 1; break;               // 4300:0DE2
      case 0xC05F: g.g_6F69 = lo(v); g.g_84E5 = 1; break;
    }
  }

  // 4300:0E0C
  getMem(a) {
    a = w16(a);
    const g = this.g;
    switch (this.memRegion(a)) {
      case 0: return this.m0(a);
      case 1: { const r = this.getCharField(a); return r === undefined ? this.m1(a) : w16(r); }
      case 2: return this.m2(a);
      case 3: return this.codeAt(a);
    }
    if (a < 0xC04B) {
      switch (a) {
        case 0x00B1: return g.g_6F6E;
        case 0x00FB: return g.g_6F6A;
        case 0x00FC: return g.g_6F6C;
        case 0x033D: return g.party_Dir;
      }
      return 0;                                                         // 035F and others: TODO(decode): garbage
    }
    switch (a) {
      case 0xC04B: return w16(sx8(g.party_MapX));
      case 0xC04C: return w16(sx8(g.party_MapY));
      case 0xC04D: return g.party_Dir >> 1;
      case 0xC04E: return g.party_Ahead;
      case 0xC04F: return g.party_CellAttr;
    }
    return 0;                                                           // C059 and others: TODO(decode): garbage
  }

  // ======================================================================================================
  // ov07 (4300) part E — strings, menus, compare, gosub, CALL helpers, ROB/DAMAGE helpers, IF skip
  // ======================================================================================================

  // 4300:0F53  quirk: empty string writes 256 entries of the local buffer (tail = 0 here, TODO(decode) garbage)
  setMemString(addr, s) {
    addr = w16(addr);
    const t = new Uint8Array(256);
    for (let i = 0; i < s.length && i < 255; i++) t[i + 1] = s.charCodeAt(i) & 0xFF;
    const len = Math.min(s.length, 255), last = lo(len - 1);
    const region = this.memRegion(addr);
    const put = (i, b) => {
      if (region === 0) this.setM0(w16(addr + i), b);
      else if (region === 1) this.setM1(w16(addr + i), b);            // char-field overlay NOT applied (4300:1034)
      else if (region === 2) this.setM2(w16(addr + i), b);
      else if (region === 3) this.setCode(w16(addr + i), b);
    };
    if (region === 1 && addr === 0x6B00) {                              // 4300:1000 name, string[15]
      if (this.g.SelectedChar) setPstr(this.g.SelectedChar.b, 0, s, 15);
      return;
    }
    if (region === 4) return;
    for (let i = 0; i <= last; i++) put(i, t[i + 1]);
    put(len, 0);
  }

  // 4300:1153
  unpackString(len, slot) {
    let s = '', n = 0, phase = 1, cur = 0, prev = 0, c = 0;
    const add = (c) => { if (s.length < 255) s += String.fromCharCode(c > 0x1F ? c : c + 0x40); };   // 4300:06D3
    while (n < len) {
      if (phase < 4) { this.pc = w16(this.pc + 1); prev = cur; cur = this.codeAt(this.pc); n++; }
      switch (phase) {
        case 1: c = cur >> 2; break;
        case 2: c = lo((prev << 6) + (cur >> 2)) >> 2; break;
        case 3: c = lo((prev << 4) + (cur >> 4)) >> 2; break;
        case 4: c = cur & 0x3F; break;
      }
      phase = phase < 4 ? phase + 1 : 1;
      if (c !== 0) add(c);
    }
    if (phase === 4) { c = cur & 0x3F; if (c !== 0) add(c); }           // 4300:128C
    this.setStr(slot, s);
  }

  // 4300:12FB  quirk: byte index — no terminator within 256 entries loops forever in the original
  getMemString(slot, addr) {
    addr = w16(addr);
    const region = this.memRegion(addr);
    let s = '';
    if (region === 1 && addr === 0x6B00) s = this.g.SelectedChar ? charName(this.g.SelectedChar) : '';
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

  // 4300:156D  returns { s, keys }; works on a 256-byte Pascal buffer to keep the read-past-end quirk
  menuHotkeys(str) {
    const buf = new Uint8Array(257);
    buf[0] = Math.min(str.length, 255);
    for (let i = 0; i < buf[0]; i++) buf[i + 1] = str.charCodeAt(i) & 0xFF;
    let keys = '';
    const n = buf[0];
    for (let i = 1; i <= n; i++) {
      if (isHotkeyChar(buf[i])) buf[i] += 0x20;                         // 4300:15B0 quirk: digits -> 'P'..'Y'
      if (buf[i] === 0x7E) {                                            // '~'
        const len = buf[0];                                             // Delete(s, i, 1)
        if (i <= len) { for (let j = i; j < len; j++) buf[j] = buf[j + 1]; buf[0] = len - 1; }
        buf[i] = upcase(buf[i]);                                        // 4300:15F5
        if (keys.length < 40) keys += String.fromCharCode(buf[i]);
      }
    }
    let s = ''; for (let i = 1; i <= buf[0]; i++) s += String.fromCharCode(buf[i]);
    return { s, keys };
  }

  // 4300:1684 MenuSelect(title, items, c0E, c0C, c0A, acceptEnter, animate): 0-based index, 0FFh for a non-hotkey
  async menuSelect(title, items, c0E, c0C, c0A, acceptEnter, animate) {
    const t = title.substring(0, 40);
    const { s: m, keys } = this.menuHotkeys(items);
    let key;
    for (;;) {
      const r = await this.host.horizontalMenu(t, m, c0E, c0C, c0A, 1, animate);   // 4300:16C2 -> { key, special }
      key = r.key;
      if (r.special) {                                                  // 4300:16EF
        await this.host.cycleSelectedChar(key);
        await this.host.drawPartyRoster(this.g.SelectedChar);
        key = 0;
      }
      if (isHotkeyChar(key) || (key === 13 && acceptEnter)) break;      // 4300:1712
    }
    if (key === 13) return 0;
    const k = keys.indexOf(String.fromCharCode(key));
    return k >= 0 ? k : 0xFF;                                           // 4300:177B
  }

  // 4300:1815
  compareStrings(sa, sb) {
    this.clearFlags();
    const f = this.flags;
    if (sa === sb) f[0] = 1; else f[1] = 1;
    if (sa < sb) f[2] = 1; if (sa > sb) f[3] = 1;                       // TP @StrCompare = byte-wise, shorter prefix first
    if (sa <= sb) f[4] = 1; if (sa >= sb) f[5] = 1;
  }

  // 4300:18EB (unsigned)
  compareWords(a, b) {
    this.clearFlags();
    const f = this.flags;
    if (a === b) f[0] = 1; else f[1] = 1;
    if (a < b) f[2] = 1; if (a > b) f[3] = 1;
    if (a <= b) f[4] = 1; if (a >= b) f[5] = 1;
  }

  // 4300:1951
  doGosub(i) {
    this.gosub.push(this.pc);                                           // 4300:19AE PC already past the operands
    this.pc = this.a(i);
  }

  // GBP combatStart payload: the party, then the last MonsterCount records of the list (LoadMonster appends at the end)
  combatants() {
    const all = []; for (let c = this.g.PartyHead; c; c = c.next) all.push(c);
    const n = this.g.MonsterCount, first = Math.max(0, all.length - n);
    return { monsters: all.slice(first).map((c, i) => charSummary(c, first + i, 0)), duel: this.g.g_84D4 !== 0, partyCount: this.m1(0x6E3E) };
  }

  // 4300:19DB
  async stepForward() {
    const g = this.g;
    switch (g.party_Dir) {
      case 0: g.party_MapY = sx8(g.party_MapY) > 0 ? lo(g.party_MapY - 1) : 15; break;
      case 2: g.party_MapX = sx8(g.party_MapX) < 15 ? lo(g.party_MapX + 1) : 0; break;
      case 4: g.party_MapY = sx8(g.party_MapY) < 15 ? lo(g.party_MapY + 1) : 0; break;
      case 6: g.party_MapX = sx8(g.party_MapX) > 0 ? lo(g.party_MapX - 1) : 15; break;
    }
    g.party_CellAttr = await this.host.getCellAttr(g.party_MapX, g.party_MapY);               // 4300:1A3F
    g.party_Ahead = await this.host.getWallType(g.party_MapX, g.party_MapY, g.party_Dir);    // 4300:1A4F
  }

  // 4300:1A6F SetupDuel(withOpponent)
  async setupDuel(withOpponent) {
    const g = this.g;
    g.g_84D4 = 1;
    this.setM1(0x6DE6, w16(withOpponent));
    const me = g.SelectedChar;
    for (let c = g.PartyHead; c; c = c.next)                            // 4300:1AA9
      if (charName(c) !== charName(me)) c.b[C.active] = 0;
    if (withOpponent !== 0) {
      await this.host.loadCombatIcon('CPIC', 0x0B, g.enc_NextIconSlot); // 4300:1AE1
      let c = g.PartyHead; while (c.next) c = c.next;
      const r = newChar(); r.b.set(me.b);                               // 4300:1B3C
      r.b[C.active] = 1; setPstr(r.b, 0, 'ROLF', 15);
      r.b[C.unk_10F] = 1; r.b[C.unk_10E] = 1; r.b[C.npc_flags] = 0xB2; r.b[C.party_slot] = g.enc_NextIconSlot;
      c.next = r;
      for (let it = me.items; it; it = it.next) {                       // quirk: prepend -> reverse order
        const n = newItem(); n.b.set(it.b); n.next = r.items; r.items = n;
      }
    }
  }

  // 4300:1CC3  TODO(decode): 6-byte Real arithmetic approximated by doubles
  scaleMoney(f, c) {
    for (let k = 0; k < 7; k++) wrW(c.b, C.money + 2 * k, w16(Math.trunc(rdW(c.b, C.money + 2 * k) * f)));
  }

  // 4300:1DF0  quirk: p is reduced cumulatively
  async loseItemsChance(p, c) {
    let it = c.items;
    while (it) {
      const wt = rdW(it.b, I.weight);
      if (wt > 0xFF) p = p > 0x5A ? p - 0x5A : 0;
      else if (wt > 0x18) p = p > 0x32 ? p - 0x32 : 0;
      const r = await this.host.roll(1, 100);                           // 4300:1E59
      const nxt = it.next;
      if (r <= p) await this.host.loseItem(c, it);
      it = nxt;
    }
  }

  // 4300:1EA6  quirk: uses this fixed table, not the handlers' counts; overwrites CurOp
  skipInstruction() {
    const op = this.curOp = this.codeAt(this.pc);
    const k = SKIP_COUNT[op];
    if (k) this.readOperands(k); else this.pc = w16(this.pc + 1);
  }

  // 4300:1FB1 PartyMoveRange -> { maxMove, minMove }
  async partyMoveRange() {
    let c = this.g.PartyHead;
    let maxMove = c ? c.b[C.move] : 0, minMove = maxMove;               // quirk: dereferenced before the nil test
    while (c) {
      let m = c.b[C.move];
      if (await this.host.hasEffect(c, 0x27)) m = lo(m * 2);
      else if (await this.host.hasEffect(c, 0x2A)) m = m >> 1;
      if (m > maxMove) maxMove = m;
      if (m < minMove) minMove = m;
      c = c.next;
    }
    return { maxMove, minMove };
  }

  // 4300:20CC ApplyEclDamage(dmg, c)
  async applyEclDamage(dmg, c) {
    const g = this.g, h = this.host;
    if (c.b[C.status] === 6) return;                                    // dead
    let clear = 0;
    const num = String(dmg).substring(0, 3);                            // 4300:20E6 Str(dmg) into string[3], width 0
    const s = (c.b[C.hp] + 10 < dmg) ? '  ' + charName(c) + ' dies. '
      : '  ' + charName(c) + ' is hit FOR ' + num + ' points of Damage.';
    if (g.text_Row > 0x16) {                                            // 4300:218E
      g.text_Row = 0x11; clear = 1;
      await h.showBottomPromptAndReadKey(0x0F, 'press <enter>/<return> to continue');
    } else clear = 0;
    g.text_Col = 0x26;                                                  // 4300:21BE
    await h.drawWrappedText(1, 0x11, 0x26, 0x16, 0x0F, clear, s);
    await h.applyDamage(c, lo(dmg));                                    // 4300:21E2
    await h.clearTextRectangle(0x11, 1, 0x26, 0x0F);
    await h.drawPartyRoster(g.SelectedChar);
  }

  // ======================================================================================================
  // ov03 (2F00) — fetch loop, dispatcher, opcode handlers, game loop
  // ======================================================================================================

  // 2F00:3171
  async run(addr) {
    const g = this.g;
    this.pc = w16(addr);
    g.ecl_Stop = 0;
    while (!g.ecl_Stop && !g.PartyDead) {
      this.lastOp = this.curOp;
      this.curOp = this.codeAt(this.pc);
      if (this.trace) this.trace(this.pc, this.curOp);
      if (++this.steps > this.stepLimit) throw new EclHang('step limit');
      await this.dispatch();
    }
    g.ecl_Stop = 0;
  }

  // 2F00:2F2D  quirk: 1Fh and > 3Dh have no handler, PC is not advanced and the original spins forever
  async dispatch() {
    const op = this.curOp;
    const fn = HANDLERS[op];
    if (!fn) throw new EclHang('ECL opcode ' + op.toString(16) + ' at ' + this.pc.toString(16) + ' has no handler (VM hangs)');
    await fn.call(this);
  }

  // 2F00:0001
  async op00_Exit() {
    const g = this.g, h = this.host;
    if (g.g_84E2 !== 0) {
      await h.drawTitledFrame(1, 1, 0x0F, 0x0F, 0, 0x0F, '');           // 2f00:000e
      if (this.is3D()) await h.drawTitledFrame(3, 3, 0x0D, 0x0D, 0, 0x0F, '');
    }
    if (g.g_4430 !== 0) { g.SelectedChar = g.g_4436; g.g_4430 = 0; }   // 2f00:0066
    g.g_84C8 = 0; g.g_84C9 = 0; g.g_84E0 = 0; g.g_84E2 = 0;
    g.ecl_Stop = 1;
    this.pc = w16(this.pc + 1);
    this.gosub = [];                                                    // 2f00:00a4 free the whole stack
    g.text_Row = 0x11; g.text_Col = 1;                                  // 2f00:00e1
    g.g_84DE = 0;
  }

  // 2F00:00F4
  async op01_Goto() { this.readOperands(1); this.pc = this.a(1); }
  // 2F00:0111
  async op02_Gosub() { this.readOperands(1); this.doGosub(1); }

  // 2F00:0126  quirk: one string + one number operand compares a stale Str[2]
  async op03_Compare() {
    this.readOperands(2);
    if (this.opType(1) >= 0x80 || this.opType(2) >= 0x80) this.compareStrings(this.str[1], this.str[2]);
    else { const x1 = this.v(1), x2 = this.v(2); this.compareWords(x1, x2); }
  }

  // 2F00:01A3
  async op04_AddSubDivMul() {
    this.readOperands(3);
    const x1 = this.v(1), x2 = this.v(2), dest = this.a(3);
    let r;
    switch (this.curOp) {
      case 0x04: r = x1 + x2; break;
      case 0x05: r = x2 - x1; break;                                    // 2f00:01fc quirk: operand 2 minus operand 1
      case 0x06: if (x2 === 0) throw new Error('Runtime error 200 (ECL DIVIDE by 0)'); r = Math.floor(x1 / x2); break;
      case 0x07: r = Math.imul(x1, x2); break;
    }
    await this.setMem(dest, w16(r));
  }

  // 2F00:0234
  async op08_Random() {
    this.readOperands(2);
    let n = lo(this.v(1));
    if (n < 0xFF) n++;
    const dest = this.a(2);
    const r = lo(await this.host.random(n));                            // 2f00:0266 TP Random(n) -> 0..n-1
    await this.setMem(dest, r);
  }

  // 2F00:0292
  async op09_Save() {
    this.readOperands(2);
    const dest = this.a(2);
    if (this.opType(1) < 0x80) await this.setMem(dest, this.v(1));
    else this.setMemString(dest, this.str[1]);
  }

  // 2F00:02E0
  async op0A_LoadCharacter() {
    const g = this.g;
    g.g_4430 = 1;
    this.readOperands(1);
    let i = 0, x = lo(this.v(1));
    let c = g.PartyHead;
    const hi = x & 0x80; x &= 0x7F;
    if (x > 0) while (i < x && c) { c = c.next; i++; }
    if (c) g.SelectedChar = c;                                          // 2f00:034d
    if (hi !== 0 && g.g_84D2 !== 0 && g.g_84D3 !== 0) {
      if (g.g_4436 === g.SelectedChar) g.g_4430 = 0;
      await this.host.removeFromParty(0, 1);                            // 2f00:038e ov16_3291 (role unknown, M)
      await this.host.drawPartyRoster(g.SelectedChar);
      g.g_84D2 = 0; g.g_84D3 = 0;
    }
  }

  // 2F00:03B4
  async op0C_SetupMonster() {
    const g = this.g;
    this.readOperands(3);
    g.enc_SpriteId = this.v(1);
    this.setM1(0x6DC0, this.v(2));                                      // direct array writes (no char-field side effects)
    g.enc_PicId = this.v(3);
    this.setM1(0x6DC1, await this.approachDistance(g.party_MapX, g.party_MapY, g.party_Dir));
    if (this.m1(0x6DC0) < this.m1(0x6DC1)) this.setM1(0x6DC1, this.m1(0x6DC0));
    await this.showEncounter(lo(g.enc_SpriteId), lo(g.enc_PicId), lo(this.m1(0x6DC1)));   // 2f00:042b
  }

  // 2F00:0450
  async op0B_LoadMonster() {
    const g = this.g, h = this.host;
    const savedSel = g.SelectedChar;
    let k = 1;
    this.readOperands(3);
    if (g.MonsterCount >= 0x3F) return;                                 // 2f00:0470
    const id = lo(this.v(1));
    const rec = await h.loadMonster(id);                                // 4300:0411 GetMem(11Dh) + LoadMonster
    const tmpl = new Uint8Array(rec.b);
    const itemsHead = rec.items, effHead = rec.effects;
    let cnt = lo(this.v(2)); if (cnt === 0) cnt = 1;
    const pic = lo(this.v(3));
    let p = g.PartyHead;
    await h.loadCombatIcon('CPIC', pic, g.enc_NextIconSlot);            // 2f00:0524
    while (p.next) p = p.next;
    p.next = rec; p = p.next;                                           // 2f00:055b the loaded record itself
    p.b[C.party_slot] = g.enc_NextIconSlot; p.next = null;
    g.MonsterCount++; k++;
    while (k <= cnt && g.MonsterCount < 0x3F) {                         // 2f00:05a2
      const n = newChar(); p.next = n; p = n;
      p.b.set(tmpl);
      p.b[C.party_slot] = g.enc_NextIconSlot;
      k++; g.MonsterCount++;
      for (let it = itemsHead; it; it = it.next) {                      // quirk: prepended -> reverse order
        const ni = newItem(); ni.b.set(it.b); ni.next = p.items; p.items = ni;
      }
      for (let e = effHead; e; e = e.next) {
        const ne = newEffect(); ne.b.set(e.b); ne.next = p.effects; p.effects = ne;
      }
    }
    hooks.emit('monsterShown', () => ({ id, dataset: g.DataSet, name: charName(rec), pic, count: k - 1, slot: g.enc_NextIconSlot,
      ref: { dax: 'MON' + g.DataSet + 'CHA', record: id }, icon: { dax: 'CPIC' + g.DataSet, record: pic }, records: (() => { const r = []; for (let q = rec; q; q = q.next) r.push(q); return r; })() }));   // 2f00:07fd
    g.enc_NextIconSlot = lo(g.enc_NextIconSlot + 1);                    // 2f00:07fd
    g.g_84E7 = 1;
    g.SelectedChar = savedSel;
  }

  // 2F00:0817
  async op0D_Approach() {
    const g = this.g;
    if (this.m1(0x6DC1) > 0) {
      this.setM1(0x6DC1, this.m1(0x6DC1) - 1);
      await this.showEncounter(lo(g.enc_SpriteId), lo(g.enc_PicId), lo(this.m1(0x6DC1)));
    }
    this.pc = w16(this.pc + 1);
  }

  // 2F00:0856
  async op0E_Picture() {
    const g = this.g, h = this.host;
    this.readOperands(1);
    const p = lo(this.v(1));
    if (!this.is3D() && p !== 0xFF) await h.drawTitledFrame(3, 3, 0x0D, 0x0D, 0, 0x0F, '');   // 2f00:0881
    if (p !== 0xFF) {
      hooks.emit('pictureShown', () => ({ pic: p, dataset: g.DataSet, head: this.m1(0x6DE1) === 0xFF ? null : lo(this.m1(0x6DE1)),
        ref: this.m1(0x6DE1) === 0xFF ? { dax: 'PIC' + g.DataSet, record: p } : null }));   // 2f00:08b7
      g.g_84C9 = 1; g.g_84E0 = 1;
      if (this.m1(0x6DE1) === 0xFF) {                                   // 2f00:08b7
        await h.loadAnimation('PIC', p, 0);                             // 2f00:08d3 into g_6ABE
        await h.drawPictureScreenOrView(3, 3, 1);
      } else await this.showHeadBodyPicture(lo(this.m1(0x6DE1)), p);
    } else {
      if (g.g_49F9 > 1 || g.travel_Mode === 1)                         // 2f00:0913
        if (g.g_84E0 !== 0 || g.g_84E3 !== 0) {
          await h.refreshView();
          g.g_84E0 = 0; g.g_84E3 = 0; g.g_84E1 = 1;
        }
      g.g_84C8 = 0; g.g_84C9 = 0;
    }
  }

  // 2F00:0951  quirk: operand 1 unused
  async op0F_InputNumber() {
    this.readOperands(2);
    const dest = this.a(2);
    const n = await this.host.readWordNumber('', 0x0A);                 // 2f00:0973 prompt = local byte 0 = ''
    await this.setMem(dest, n);
  }

  // 2F00:0994  quirk: operand 1 unused
  async op10_InputString() {
    this.readOperands(2);
    const dest = this.a(2);
    let s = await this.host.readBottomLine('', 0x0A, 0x28);             // 2f00:09b7 prompt = local byte 0 = ''
    if (s === '') s = ' ';
    this.setMemString(dest, s);
  }

  // 2F00:0A09  (11 PRINT, 12 PRINTCLEAR)
  async op11_Print() {
    const g = this.g, h = this.host;
    this.readOperands(1);
    g.g_84E4 = 0; g.g_4A00 = 1;
    if (this.opType(1) < 0x80) this.setStr(1, String(this.v(1)));       // 2f00:0a29 WordToDecimalString
    hooks.emit('textPrinted', () => ({ text: this.str[1], window: 'text', clear: this.curOp === 0x12, source: this.curOp === 0x11 ? 'PRINT' : 'PRINTCLEAR' }));   // 2f00:0a29
    if (this.curOp === 0x11) await h.drawWrappedText(1, 0x11, 0x26, 0x16, 0x0A, 0, this.str[1]);
    else {
      g.text_Row = 0x11; g.text_Col = 1;
      await h.drawWrappedText(1, 0x11, 0x26, 0x16, 0x0A, 1, this.str[1]);
    }
    g.g_4A00 = 0;
  }

  // 2F00:0A9F  quirk: empty stack -> continue after the RETURN
  async op13_Return() {
    this.pc = w16(this.pc + 1);
    if (this.gosub.length) this.pc = this.gosub.pop();
  }

  // 2F00:0AED
  async op14_CompareAnd() {
    this.clearFlags();
    this.readOperands(4);
    const x = [0, this.v(1), this.v(2), this.v(3), this.v(4)];
    if (x[1] === x[2] && x[3] === x[4]) this.flags[0] = 1; else this.flags[1] = 1;
  }

  // 2F00:0B52  (16..1B)
  async op16_If() {
    this.pc = w16(this.pc + 1);
    if (this.flags[this.curOp - 0x16] === 0) this.skipInstruction();
  }

  // 2F00:0BD1
  async op20_NewEcl() {
    const g = this.g;
    this.readOperands(1);
    this.setM0(0x49F2, g.ecl_Block);                                    // 2f00:0be0
    const n = lo(this.v(1));
    g.ecl_Block = n;
    const num = String(g.DataSet).substring(0, 1);                      // Str into string[1]
    await this.host.checkEclDisk(g.g_547C + 'ECL' + num + '.dax');      // 2f00:0c19
    await this.loadEclBlock(n);
    this.initVM();
    g.ecl_Stop = 1; g.ecl_Restart = 1;                                  // 2f00:0c5a
    g.g_4431 = 0;
  }

  // 2F00:0C74  (21 LOAD_FILES, 37 LOAD_PIECES)
  async op21_LoadFilesPieces() {
    const g = this.g, h = this.host;
    this.readOperands(3);
    g.g_4431 = 1;                                                       // 2f00:0c82
    const b = [0, lo(this.v(1)), lo(this.v(2)), lo(this.v(3))];
    if (this.curOp === 0x21) {
      g.g_4434 = 1;
      if (b[1] !== 0xFF && b[1] !== 0x7F && this.is3D()) {              // 2f00:0cb7
        this.setM0(0x49C5, b[1]);
        await h.load3DMap(b[1]);
        this.setM1(0x6DC9, 0);
      }
      if (b[3] !== 0xFF && !this.is3D()) await h.load24x24Set('BACPAC', 0, 0x28);   // 2f00:0d12
    } else {
      g.g_4433 = 1;
      if (b[1] === 0x7F) await h.loadWallSet(0, 1);                     // 2f00:0d2b (id, slot)
      else if (this.m0(0x49E7) !== 0 && this.m0(0x49E8) !== 0) {        // 2f00:0d39
        await h.loadWallSet(b[1], 1);
        await h.loadWallSet(b[3], 3);
      } else for (let i = 1; i <= 3; i++) {
        if (b[i] !== 0xFF) await h.loadWallSet(b[i], i);
        else await h.clearWallSlot(i);                                  // 2f00:0d97 g_6AAE+i*4 := FFFFh, g_6AB0+i*4 := FFFFh
      }
    }
    if (g.g_4432 !== 0 && g.g_4433 !== 0 && g.g_4434 !== 0) {           // 2f00:0dbf
      await h.redrawCurrentMode();
      await h.drawPartyRoster(g.SelectedChar);
      g.g_4432 = 0;
    }
  }

  // 2F00:0DEF  (2F AND, 30 OR)  quirk: CompareWords(0, r)
  async op2F_AndOr() {
    this.readOperands(3);
    const x1 = this.v(1), x2 = this.v(2), dest = this.a(3);
    const r = this.curOp === 0x2F ? lo(x1 & x2) : lo(x1 | x2);
    this.compareWords(0, r);
    await this.setMem(dest, r);
  }

  // 2F00:0E5E
  async op2A_GetTable() {
    this.readOperands(3);
    const base = this.a(1), idx = lo(this.v(2)), dest = this.a(3);
    await this.setMem(dest, this.getMem(base + idx));
  }

  // 2F00:0EBC
  async op35_SaveTable() {
    this.readOperands(3);
    const value = this.v(1), base = this.a(2), idx = this.v(3);
    await this.setMem(base + idx, value);
  }

  // 2F00:0F08  quirk: the selection is stored even after Esc
  async op15_VerticalMenu() {
    const g = this.g, h = this.host;
    g.g_84E4 = 0;
    this.readOperands(3);
    const dest = this.a(1);
    const prompt = this.str[1];
    const cnt = lo(this.v(3));
    this.pc = w16(this.pc - 1);                                         // 2f00:0f5a
    this.readOperands(cnt);
    const items = [];
    for (let k = 1; k <= cnt; k++) items.push(this.str[k].substring(0, 40));   // NewMenuList + node texts
    g.text_Col = 1; g.text_Row = 0x11;
    hooks.emit('textPrinted', () => ({ text: prompt, window: 'text', clear: true, source: 'VERTICAL_MENU' }));   // 2f00:0f92
    await h.drawWrappedText(1, 0x11, 0x26, 0x16, 0x0A, 1, prompt);     // 2f00:0f92
    // 4300:1788 EclVerticalListMenu('', '', 0Dh, 0Ah, 0Fh, 1, row+1, 26h, 16h, list, 0, ...)
    const { s: m } = this.menuHotkeys('');
    const sel = await h.verticalListMenu({ title: '', keys: m, c24: 0x0D, c22: 0x0A, c20: 0x0F,
      x1: 1, y1: g.text_Row + 1, x2: 0x26, y2: 0x16, items, b12: 0 });
    await this.setMem(dest, sel);                                       // 2f00:1058
    await h.clearTextRectangle(1, 0x11, 0x26, 0x16);
  }

  // 2F00:10D1
  async op2B_HorizontalMenu() {
    const g = this.g;
    this.readOperands(2);
    const dest = this.a(1);
    const cnt = lo(this.v(2));
    this.pc = w16(this.pc - 1);
    this.readOperands(cnt);
    let menu = '', single, colA, colB;
    if (cnt === 1) {
      single = 1; colA = 0x0F; colB = 0x0F;
      if (this.str[1] === 'PRESS <RETURN> OR BUTTON TO CONTINUE') this.str[1] = 'PRESS <ENTER>/<RETURN> TO CONTINUE';
    } else { single = 0; colA = 0x0F; colB = 0x0A; }
    const hilite = (g.g_84E0 !== 0 && g.g_84E1 !== 0) ? 1 : 0;
    const last = lo(cnt - 1);                                           // quirk: cnt = 0 -> 255 items
    for (let i = 1; i <= last; i++) menu = (menu + '~' + this.str[i] + ' ').substring(0, 50);
    menu = (menu + '~' + this.str[lo(cnt)]).substring(0, 50);
    const choice = await this.menuSelect('', menu, 0x0D, colB, colA, single, hilite);   // 2f00:1215
    await this.setMem(dest, choice);
    await this.host.clearTextRectangle(0, 0x18, 0x27, 0x18);
  }

  // 2F00:125D  note: monster records stay in the party list (only the count is reset)
  async op1C_ClearMonsters() {
    const g = this.g;
    this.pc = w16(this.pc + 1);
    g.MonsterCount = 0; g.g_84E7 = 0; g.enc_NextIconSlot = 8;
    g.TreasureMoney = [0, 0, 0, 0, 0, 0, 0];
    g.TreasureItems = null;
  }

  // 2F00:12C6
  async op1D_PartyStrength() {
    this.readOperands(1);
    let s = 0;
    for (let c = this.g.PartyHead; c; c = c.next) {
      const b = c.b;
      let ac = b[C.ac], th = b[C.thac0];
      ac = ac > 0x3C ? ac - 0x3C : 0;
      th = th > 0x27 ? th - 0x27 : 0;
      s = lo(s + Math.floor((b[C.hp] + ac * 5 + th * 5 + b[C.lvl5] * 8 + b[C.lvl0] * 4) / 10));
    }
    await this.setMem(this.a(1), s);
  }

  // 2F00:1435 (+ nested 2F00:13D7 ecl_CheckPartyStore)
  async op1E_CheckParty() {
    this.readOperands(6);
    let c = this.g.PartyHead, found = 0;
    const key = this.opType(1) === 1 ? this.a(1) : this.v(1);
    const id = lo(this.v(2));
    const d3 = this.a(3), d4 = this.a(4), d5 = this.a(5), d6 = this.a(6);
    let sum = 0, n = 0, minV = 0xFF, maxV = 0, avgV = 0;
    const store = async () => {
      await this.setMem(d3, minV); await this.setMem(d4, maxV); await this.setMem(d5, avgV); await this.setMem(d6, found);
    };
    const scan = async (off) => {
      for (; c; c = c.next) {
        n++; const x = c.b[off];
        if (x < minV) minV = x; if (x > maxV) maxV = x;
        sum = w16(sum + x);
      }
      avgV = lo(Math.floor(sum / n));                                   // n = 0 -> divide error (never)
      await store();
    };
    if (key === 0) {
      while (c && found === 0) { found = (await this.host.hasEffect(c, id)) ? 1 : 0; c = c.next; }
      minV = 0; maxV = 0; avgV = 0;
      await store();
    } else if (key === 0x6BA7) await scan(0x79);
    else if (key === 0x6C1B) await scan(C.move);
  }

  // 2F00:1629  quirk: operand 2 always receives 0
  async op22_PartySurprise() {
    this.readOperands(2);
    let r = 0;
    for (let c = this.g.PartyHead; c; c = c.next) if (c.b[C.class] === 4 || c.b[C.class] === 10) r = 1;
    await this.setMem(this.a(1), r);
    await this.setMem(this.a(2), 0);
  }

  // 2F00:16C9  quirk: result 3 is always overwritten by 2
  async op23_Surprise() {
    this.readOperands(4);
    let res = 0;
    const b = [0, lo(this.v(1)), lo(this.v(2)), lo(this.v(3)), lo(this.v(4))];
    const p = sx8(b[4] + 2 - b[1]), m = sx8(b[2] + 2 - b[3]);
    const r1 = await this.host.roll(1, 6), r2 = await this.host.roll(1, 6);
    if (r1 <= p) res = r2 > m ? 1 : 3;
    if (r2 <= m) res = 2;
    await this.setMem(0x6DCB, res);
  }

  // 2F00:179B
  async op24_Combat() {
    const g = this.g, h = this.host;
    this.pc = w16(this.pc + 1);
    if (g.g_84E7 === 0 && g.g_84D4 === 0) {
      if (this.m1(0x6E6C) === 1) { this.setM1(0x6E6C, 0); await h.shop(); }
      else if (this.m1(0x6DE2) === 1) { this.setM1(0x6DE2, 0); await h.temple(); }
      else await h.afterCombat();
    } else {
      const d = await this.approachDistance(g.party_MapX, g.party_MapY, g.party_Dir);
      if (d < this.m1(0x6DC1)) this.setM1(0x6DC1, d);
      hooks.emit('combatStart', () => this.combatants());               // 2f00:1827
      await h.combatMain();                                             // 2f00:1827 ov08_007A
      await h.afterCombat();                                            // ov05_1527
      hooks.emit('combatEnd', () => ({ result: ({ 0: 'won', 0x80: 'partyDead', 0x81: 'fled' })[this.m1(0x6DC7)] ?? this.m1(0x6DC7),
        code: this.m1(0x6DC7), xp: g.CombatXP | 0, party: hooks.state.party() }));   // 2f00:182c (after ov05_1527)
      if (!this.is3D()) {
        await h.load24x24Set('BACPAC', 0, 0x28);
        await h.loadCombatIcon('ICON', 0, 9);
        await h.loadCombatIcon('ICON', 1, 0x0A);
        await h.loadCombatIcon('ICON', 2, 0x0B);
      }
      if (g.g_84D4 !== 0) g.g_84D4 = 0;
    }
    g.g_49F3 = g.travel_Mode === 1 ? 4 : 3;
    this.setM1(0x6DCA, this.m1(0x6DCA) & 1);
    g.g_84C8 = 0; g.g_84C9 = 0; g.g_84E0 = 0;
    await h.redrawCurrentMode();
  }

  // 2F00:18F8  (25 ON_GOTO, 26 ON_GOSUB)
  async op25_OnGotoGosub() {
    this.readOperands(2);
    const x = lo(this.v(1)), cnt = lo(this.v(2));
    this.pc = w16(this.pc - 1);
    this.readOperands(cnt);
    if (x < cnt) {
      if (this.curOp === 0x25) this.pc = this.a(x + 1);
      else this.doGosub(x + 1);
    }
  }

  // 2F00:19B0
  async op27_Treasure() {
    const g = this.g, h = this.host;
    this.readOperands(8);
    for (let i = 0; i <= 6; i++) g.TreasureMoney[i] = this.v(i + 1);
    const t = lo(this.v(8));
    const prepend = (b) => { const it = newItem(); it.b.set(b.subarray(0, ITEM_SIZE)); it.next = g.TreasureItems; g.TreasureItems = it; };
    if (t < 0x80) {
      const rec = await h.loadDaxRecord('ITEM' + g.DataSet, '.dax', t); // 2f00:1a4a
      if (!rec || rec.length === 0) {
        await h.showBottomPromptAndReadKey(0x0F, 'Unable to find item file');
        await h.terminateGame();
        return;
      }
      let ofs = 0;
      do {                                                              // 2f00:1a85
        const buf = new Uint8Array(ITEM_SIZE); buf.set(rec.subarray(ofs, ofs + ITEM_SIZE));
        prepend(buf);
        ofs += ITEM_SIZE;
      } while (ofs < rec.length);
    } else if (t !== 0xFF) {
      const n = t - 0x80;
      for (let k = 1; k <= n; k++) {
        const r1 = await h.roll(1, 100);
        let typ = this.treasureTyp;                                     // quirk: 48/49 keep the previous type
        if (r1 >= 1 && r1 <= 60) {
          const r2 = await h.roll(1, 100);
          if ((r2 >= 1 && r2 <= 47) || (r2 >= 50 && r2 <= 59)) typ = r2 === 45 ? 0x3B : r2;
          else if (r2 >= 60 && r2 <= 90) {
            const r3 = await h.roll(1, 10);
            if (r3 <= 4) typ = 0x24; else if (r3 <= 7) typ = 0x23; else if (r3 === 8) typ = 0x22;
            else if (r3 === 9) typ = 0x25; else if (r3 === 10) typ = 0x26;
          } else if (r2 >= 91 && r2 <= 94) typ = 0x49;
          else if (r2 >= 95 && r2 <= 97) typ = 0x5D;
          else if (r2 >= 98 && r2 <= 100) typ = 0x4D;
        } else if (r1 >= 61 && r1 <= 85) typ = 0x3D;
        else if (r1 >= 86 && r1 <= 92) typ = 0x3E;
        else if (r1 >= 91 && r1 <= 98) {
          const r4 = await h.roll(1, 16);
          if (r4 <= 7) typ = 0x47; else if (r4 <= 9) typ = 0x46; else if (r4 === 10) typ = 0x54;
          else if (r4 <= 12) typ = 0x4E; else if (r4 <= 14) typ = 0x4F; else if (r4 === 15) typ = 0x5C; else typ = 0x43;
        } else if (r1 === 99 || r1 === 100) typ = 0x45;
        this.treasureTyp = typ;
        const item = await h.makeTreasureItem(typ);                     // 2f00:1ccd -> item { b }
        prepend(item.b);
      }
      for (let p = g.TreasureItems; p; p = p.next) await h.buildItemName(g.SelectedChar, p, 0, 0, 0, 0);   // 2f00:1d7b
    }
  }

  // 2F00:1DB1  quirk: operand 3 unused, the item chance is operand 2
  async op28_Rob() {
    this.readOperands(3);
    const who = lo(this.v(1)), pct = lo(this.v(2));
    const f = (100 - pct) / 100.0;
    const loss = lo(this.v(2));
    if (who === 0) { this.scaleMoney(f, this.g.SelectedChar); await this.loseItemsChance(loss, this.g.SelectedChar); }
    else for (let c = this.g.PartyHead; c; c = c.next) { this.scaleMoney(f, c); await this.loseItemsChance(loss, c); }
  }

  // 2F00:1EF8
  async op29_EncounterMenu() {
    const g = this.g, h = this.host;
    g.g_84E9 = 1; g.g_84E4 = 0; g.g_4A00 = 1;
    const { maxMove, minMove } = await this.partyMoveRange();           // 2f00:1f0e
    this.readOperands(14);
    g.enc_SpriteId = this.v(1);
    this.setM1(0x6DC0, this.v(2));
    g.enc_PicId = this.v(3);
    const dest = this.a(4);
    const react = []; for (let i = 0; i <= 4; i++) react[i] = lo(this.v(i + 5));
    const txt = ['', this.str[1], this.str[2], this.str[3]];
    const fleeLimit = lo(this.v(13)), monFleeLimit = lo(this.v(14));
    this.setM1(0x6DC1, await this.approachDistance(g.party_MapX, g.party_MapY, g.party_Dir));
    if (this.m1(0x6DC0) < this.m1(0x6DC1)) this.setM1(0x6DC1, this.m1(0x6DC0));
    const show = () => this.showEncounter(lo(g.enc_SpriteId), lo(g.enc_PicId), lo(this.m1(0x6DC1)));
    const approach = async () => { this.setM1(0x6DC1, this.m1(0x6DC1) - 1); await show(); };
    const wait = () => h.drawWrappedText(1, 0x11, 0x26, 0x16, 0x0A, 1, 'Both sides wait.');
    const flee = async () => { g.text_Col = 1; g.text_Row = 0x11; await h.drawWrappedText(1, 0x11, 0x26, 0x16, 0x0A, 1, 'The monsters flee.'); };
    await show();                                                       // 2f00:202b
    let again;
    do {
      const highlight = (g.g_84E0 !== 0 && g.g_84E1 !== 0) ? 1 : 0;
      let clearIt = 1; again = false;
      g.text_Col = 1; g.text_Row = 0x11;
      let k;
      switch (this.m1(0x6DC1)) {                                        // 2f00:2073 quirk: dist > 2 keeps txt[0]
        case 0: k = 1; do { txt[0] = txt[k]; k++; } while (!(txt[0] !== '' || k > 3)); break;
        case 1: k = 2; do { txt[0] = txt[k]; k++; if (k > 3) k = 1; } while (!(txt[0] !== '' || k === 2)); break;
        case 2: k = 3; do { txt[0] = txt[k]; k++; if (k > 3) k = 1; } while (!(txt[0] !== '' || k === 3)); break;
      }
      if (txt[0] === '') clearIt = 0;
      if (txt[0] !== '') hooks.emit('textPrinted', () => ({ text: txt[0], window: 'text', clear: true, source: 'ENCOUNTER' }));   // 2f00:215c
      await h.drawWrappedText(1, 0x11, 0x26, 0x16, 0x0A, clearIt, txt[0]);   // 2f00:215c
      const parlayMenu = this.m1(0x6DC1) === 0 || !this.is3D();
      const items = parlayMenu ? '~COMBAT ~WAIT ~FLEE ~PARLAY' : '~COMBAT ~WAIT ~FLEE ~ADVANCE';
      let choice = await this.menuSelect('', items, 0x0D, 0x0A, 0x0F, 0, highlight);   // 2f00:21bd
      if (parlayMenu && choice === 3) choice = 4;
      hooks.emit('npcTalk', () => ({ kind: 'encounter', text: txt[0], choice: ['COMBAT', 'WAIT', 'FLEE', 'ADVANCE', 'PARLAY'][choice] ?? null,
        distance: this.m1(0x6DC1), sprite: lo(g.enc_SpriteId), pic: lo(g.enc_PicId), dataset: g.DataSet }));   // 2f00:21bd
      const r = choice < 5 ? react[choice] : 0xFF;                      // TODO(decode): garbage for choice 0FFh (r >= 5: nothing)
      const dist0 = this.m1(0x6DC1) === 0;
      switch (r) {
        case 0:
          if (choice === 2) await this.setMem(dest, minMove >= fleeLimit ? 2 : 1);
          else await this.setMem(dest, 1);
          break;
        case 1:
          if (choice === 0) await this.setMem(dest, 1);
          else if (choice === 1) { again = true; await wait(); }
          else if (choice === 2) await this.setMem(dest, 2);
          else if (choice === 3) { if (!dist0) await approach(); else await wait(); again = true; }
          else if (choice === 4) { if (dist0) await this.setMem(dest, 3); else { await approach(); again = true; } }
          break;
        case 2:
          if (choice === 0) {
            if (monFleeLimit > maxMove) { await this.setMem(dest, 0); await flee(); }
            else await this.setMem(dest, 1);
          } else if (choice >= 1 && choice <= 4) { await this.setMem(dest, 0); await flee(); }
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
    await h.clearTextRectangle(0, 0x18, 0x27, 0x18);                    // 2f00:2589
    g.g_4A00 = 0; g.g_84E9 = 0;
  }

  // 2F00:25CB
  async op2C_Parlay() {
    this.readOperands(6);
    const resp = []; for (let i = 0; i <= 4; i++) resp[i] = this.v(i + 1);
    const k = await this.menuSelect(' ', '~HAUGHTY ~SLY ~NICE ~MEEK ~ABUSIVE', 0x0D, 0x0A, 0x0F, 0, 0);
    hooks.emit('npcTalk', () => ({ kind: 'parlay', choice: ['HAUGHTY', 'SLY', 'NICE', 'MEEK', 'ABUSIVE'][k] ?? null, result: k < 5 ? resp[k] : 0 }));   // 2f00:25cb
    await this.setMem(this.a(6), k < 5 ? resp[k] : 0);                  // TODO(decode): garbage for k = 0FFh
  }

  // 2F00:266A
  async op32_FindItem() {
    this.readOperands(1);
    const id = this.v(1);
    this.clearFlags(); this.flags[1] = 1;
    let found = false;
    for (let c = this.g.PartyHead; c && !found; c = c.next)
      for (let it = c.items; it && !found; it = it.next)
        if (it.b[I.type] === id) { this.flags[0] = 1; this.flags[1] = 0; found = true; }
  }

  // 2F00:271F
  async op3A_Delay() { this.pc = w16(this.pc + 1); await this.host.messageDelay(); }

  // 2F00:2775
  async op2E_Damage() {
    const g = this.g, h = this.host;
    const saved = g.SelectedChar;
    let all = false, c = g.PartyHead, victim = 0;
    this.readOperands(5);
    const flags = this.v(1), dice = this.v(2), sides = this.v(3), bonus = this.v(4), save = this.v(5);
    let dmg = w16(bonus + await h.roll(dice, sides));                   // 2f00:27dc
    if (flags & 0x40) all = true;
    else victim = await h.roll(1, this.m1(0x6E3E));                     // 2f00:2806
    if (flags & 0x80) {
      const kind = flags & 0x1F, st = save & 7;
      if (all) {
        for (; c; c = c.next) {                                         // quirk: monsters in the list too
          if (flags & 0x20) await this.applyEclDamage(dmg, c);
          else if (!await h.savingThrow(c, st, kind)) await this.applyEclDamage(dmg, c);
        }
      } else if (save & 0x80) {
        if (st === 0 || !await h.savingThrow(g.SelectedChar, st - 1, kind)) await this.applyEclDamage(dmg, g.SelectedChar);
      } else {
        for (let k = 2; k <= victim; k++) c = c.next;
        if (!await h.savingThrow(c, st, kind)) await this.applyEclDamage(dmg, c);
      }
    } else {
      for (let i = 1; i <= lo(flags); i++) {                            // 2f00:2930 flags = number of hits
        c = g.PartyHead;
        victim = await h.roll(1, this.m1(0x6E3E));
        for (let k = 1; k <= victim - 1; k++) c = c.next;
        if (await h.attackRollVsAC(c, save)) await this.applyEclDamage(dmg, c);
        dmg = w16(bonus + await h.roll(dice, sides));
      }
    }
    g.PartyDead = 1;                                                    // 2f00:29d5
    for (c = g.PartyHead; c; c = c.next) if (c.b[C.active] !== 0) g.PartyDead = 0;
    if (g.PartyDead) {
      await h.drawTitledFrame(1, 1, 0x26, 0x16, 0, 0x0F, 'The END!');
      g.text_Col = 2; g.text_Row = 2;
      await h.drawWrappedText(1, 1, 0x26, 0x16, 0x0A, 1, 'The entire party is killed!');
      await h.delay(3000);
    }
    g.SelectedChar = saved;
    await h.showBottomPromptAndReadKey(0x0F, 'press <enter>/<return> to continue');
  }

  // 2F00:2AA2
  async op31_SpriteOff() {
    const g = this.g;
    this.pc = w16(this.pc + 1);
    if (g.g_84E3 !== 0) { await this.host.refreshView(); g.g_84E3 = 0; g.g_84E0 = 0; }
  }

  // 2F00:2AC1  quirk: operand index i is an uninitialised local
  async op34_EclClock() {
    this.readOperands(1);
    const n = this.v(1);                                                // TODO(decode): garbage index [BP-1]; 1 assumed
    await this.host.advanceClock(lo(n), 1);
  }

  // 2F00:2AEB
  async op33_PrintReturn() {
    const g = this.g;
    this.pc = w16(this.pc + 1);
    g.text_Col = 1; g.text_Row = lo(g.text_Row + 1); g.g_84DF = 0;
  }

  // 2F00:2B14
  async op3D_ClearBox() {
    this.pc = w16(this.pc + 1);
    await this.host.clearTextRectangle(1, 1, 0x0F, 0x0F);
    this.g.g_84DE = 1;
  }

  // 2F00:2B33
  async op39_Who() {
    this.readOperands(1);
    await this.host.clearTextRectangle(1, 0x11, 0x26, 0x16);
    const prompt = this.str[1];
    this.g.SelectedChar = await this.host.selectPartyCharacter(prompt, 0, this.g.SelectedChar);   // 00BA:2C48
  }

  // 2F00:2B7E
  async op36_AddNpc() {
    const g = this.g, h = this.host;
    this.readOperands(2);
    const id = this.v(1);
    await h.addNpcToParty(id);                                          // selects the new character (M)
    const m = (this.v(2) >> 1) | 0x80;
    g.SelectedChar.b[C.npc_flags] = lo(m);
    g.SelectedChar.b[C.unk_10E] = id === 0x18 ? 1 : 0;
    await h.recalcCharacter(g.SelectedChar);
    await h.drawPartyRoster(g.SelectedChar);
  }

  // 2F00:2C03  quirks: destinations truncated to a byte (region 4, ignored); only the first member searched
  async op3B_Spell() {
    this.readOperands(3);
    const id = this.v(1);
    const dSlot = lo(this.a(2)), dWho = lo(this.a(3));
    let k = 1, who = 0, found = false;                                  // TODO(decode): found [BP-8] is garbage; 0 assumed
    for (let c = this.g.PartyHead; c && !found; c = c.next) {
      do {
        if (c.b[0x17 + k] === id) found = true;
        else if (k <= 0x51) k++;
        else { k = 0xFF; found = true; }
      } while (!found);
      who++;
    }
    await this.setMem(dSlot, k);
    await this.setMem(dWho, who);
  }

  // 2F00:2CCF
  async op2D_Call() {
    const g = this.g, h = this.host;
    this.readOperands(1);
    const t = this.a(1);
    switch (t) {
      case 0x2C90:
        g.party_CellAttr = await h.getCellAttr(g.party_MapX, g.party_MapY);
        if (g.g_4431 !== 0 && (g.g_84E0 || g.g_84E3 || g.g_84E5 || g.g_84E6 || g.g_84E8)) {
          await h.refreshView();
          await h.drawLocationTimeStatus();
          g.g_84E8 = 0; g.g_84E5 = 0; g.g_84E6 = 0; g.g_84E0 = 0; g.g_84E3 = 0;
        }
        break;
      case 0x8000: await this.setupDuel(1); break;
      case 0x8001: await this.setupDuel(0); break;
      case 0xBA03:
        if (g.g_84CC === 8) await h.playOrStopSound(g.g_2628);
        else if (g.g_84CC === 10) await h.playOrStopSound(g.g_262A);
        break;
      case 0xC01E: await this.stepForward(); break;
      case 0xC018:
        if (g.travel_Mode === 1) g.party_Ahead = await h.getWallType(g.party_MapX, g.party_MapY, g.party_Dir);
        break;
    }                                                                   // any other address: no-op
  }

  // 2F00:2DD3
  async campCheck() {
    const h = this.host;
    await this.run(this.vecC);
    const rested = await h.camp();                                      // camp menu, var result
    if (rested) { await h.redrawCurrentMode(); await this.run(this.vecD); }
    await h.refreshView();
    this.g.g_557D = 0;
  }

  // 2F00:2E10
  async op38_Program() {
    const g = this.g, h = this.host;
    if (g.g_4430 !== 0) { g.SelectedChar = g.g_4436; g.g_4430 = 0; }
    this.readOperands(1);
    const p = this.v(1);
    if (p === 0) { await h.partyCreationMenu(); await h.redrawCurrentMode(); }
    else if (p === 8) await h.dragonFinale();
    else if (p === 9) {
      const pc = this.pc;
      await this.campCheck();
      this.pc = pc;
      await this.op00_Exit();                                           // 2f00:2e76 near CALL 0001
    }
  }

  // 2F00:2E7D
  async op3C_PrintMem() {
    const g = this.g;
    g.g_84C8 = 0; g.g_84C9 = 0; g.g_84E0 = 0;
    this.readOperands(1);
    const base = this.a(1);
    let i = 0;
    if (g.g_84DE !== 0 && g.text_Row > 0x0D) { g.text_Row = 5; g.text_Col = 2; g.g_84E2 = 1; }
    g.g_84DF = 1;
    for (;;) {
      const gl = lo(this.getMem(base + i) + 1);                         // quirk: glyph = value + 1
      if (gl > 1) {
        await this.host.drawRepeatedGlyph(g.text_Col, g.text_Row, 0x0F, 1, gl, 0);
        g.text_Col = lo(g.text_Col + 1); i++;
        if (i > 0xFFFF) throw new EclHang('PRINT_MEM unterminated');
      } else break;
    }
    g.text_Row = lo(g.text_Row + 1);
  }

  // GBP hooks request #14 (gbp-cheat): apply a pending Plus warp / redraw at the top of the explore loop, between two
  // explore commands, where the original is idle. A warp to another block or data set goes the NEW_ECL way (2F00:0BD1:
  // Mem[49F2], ecl_Block, LoadEclBlock, InitVM) and then RunAfterNewBlock, so the block's own init script loads its map
  // and walls; inside the block the party is placed and the view refreshed. Nothing happens unless a Plus tab asked
  // (hooks.requestWarp / requestRedraw refuse in original mode).
  async plusSafePoint() {
    const p = hooks.takeSafePoint();
    if (!p) return false;
    const g = this.g, h = this.host;
    if (p.job && (await p.job(this)) === 'restart') return 'restart';   // GBP #16: Plus quick save/load; a load restarts the loop
    if (p.warp) {
      const w = p.warp, newDs = w.dataset != null && w.dataset !== g.DataSet;
      if (newDs) await h.setDataSet(w.dataset);
      g.party_MapX = lo(w.x); g.party_MapY = lo(w.y); g.party_Dir = (w.facing & 3) * 2;
      if (newDs || (w.block != null && w.block !== g.ecl_Block)) {
        this.setM0(0x49F2, g.ecl_Block);
        g.ecl_Block = lo(w.block ?? g.ecl_Block);
        await this.loadEclBlock(g.ecl_Block);
        this.initVM();
        g.ecl_Restart = 1; g.g_4431 = 0;
        await this.runAfterNewBlock();
      } else {
        g.party_CellAttr = await h.getCellAttr(g.party_MapX, g.party_MapY);
        g.party_Ahead = await h.getWallType(g.party_MapX, g.party_MapY, g.party_Dir);
        await h.refreshView();
      }
    }
    if (p.redraw && !p.warp) await h.refreshView();
    await h.drawPartyRoster(g.SelectedChar);
    await h.drawLocationTimeStatus();
    return true;
  }

  // 2F00:31B4
  async runAfterNewBlock() {
    const g = this.g, h = this.host;
    do {
      g.party_CellAttr = await h.getCellAttr(g.party_MapX, g.party_MapY);
      this.setM1(0x6DD5, 0);
      const saved = g.SelectedChar;
      g.g_49F9 = g.travel_Mode;
      g.travel_Mode = 1;
      hooks.emit('areaEntered', () => ({ ...hooks.state.position(), source: 'NEWECL' }));   // 2f00:31ed (before ecl_Run(VecE))
      await this.run(this.vecE);
      g.g_49F3 = 4;
      if (!this.is3D()) {
        if (g.ecl_Block === 0x19) { g.travel_Mode = 2; g.g_49F3 = 3; }
        else if (g.ecl_Block === 0x1A) {
          g.travel_Mode = 3; g.g_49F3 = 3;
          if (this.m0(0x4AB3) === 0xFE && this.m0(0x4AA2) === 0) await h.recolourOverlandTiles(1);
        } else if (g.ecl_Block === 0x1B) { g.travel_Mode = 4; g.g_49F3 = 3; }
      }
      if (g.g_49F9 > 1 && g.travel_Mode === 1) await h.drawTitledFrame(3, 3, 0x0D, 0x0D, 0, 0x0A, '');
      if (((g.g_49F9 > 1 || g.travel_Mode === 1) && g.g_4431 !== 0) || (g.g_49F9 === 1 && g.travel_Mode === 1))
        await h.refreshView();
      g.ecl_Restart = 0;
      await this.run(this.vecA);
      if (!g.ecl_Restart) {
        await this.run(this.vecB);
        g.SelectedChar = saved;
        await h.drawPartyRoster(g.SelectedChar);
      }
    } while (g.ecl_Restart);
  }

  // 2F00:32F8
  async gameLoop() {
    const g = this.g, h = this.host;
    g.g_4433 = 0; g.g_4434 = 0; g.g_4430 = 0; g.g_4431 = 0;
    g.g_4432 = 1; g.g_49F3 = 4; g.ecl_Restart = 0;
    g.ecl_Block = lo(this.m0(0x49F2));
    if ((g.ecl_Block === 0x19 || g.ecl_Block === 0x1A || g.ecl_Block === 0x1B) && !this.is3D()) g.g_49F3 = 3;
    if (g.g_49F8 === 0) await this.loadEclBlock(g.ecl_Block);           // 2f00:334d
    this.initVM();
    hooks.emit('areaEntered', () => ({ ...hooks.state.position(), source: 'GAMELOOP' }));   // 2f00:3362 (before ecl_Run(VecE))
    await this.run(this.vecE);
    if (g.g_49F3 !== 3) {
      if (g.g_4432 === 1) { await h.redrawCurrentMode(); g.g_4432 = 0; }
      await h.refreshView();
    }
    this.setM0(0x49F2, g.ecl_Block);
    do {
      hooks.safePointArmed = true;                                      // GBP #14: only this explore wait may end early
      let key = await h.exploreCommand();                               // 2f00:3395 -> char code
      hooks.safePointArmed = false;
      const sp = await this.plusSafePoint();                            // GBP #14: Plus warp / redraw, then explore again
      if (sp === 'restart') { g.g_49F8 = 1; return this.gameLoop(); }   // GBP #16: a game was loaded (as 7000:040b, then 0000:013D)
      if (sp) continue;
      g.g_4436 = g.SelectedChar;
      this.setM0(0x49F2, g.ecl_Block);
      while ((this.m1(0x6DCA) > 1 || upcase(key) === 0x45) && !g.PartyDead) {   // 'E'
        if (upcase(key) === 0x45) await this.campCheck();
        else {
          g.g_84DD = this.m1(0x6DCA) & 1;
          this.setM1(0x6DCA, 1);
          await h.refreshView();
          await this.run(this.vecB);
          if (g.ecl_Restart) await this.runAfterNewBlock();
          this.setM1(0x6DCA, g.g_84DD);
        }
        if (!g.PartyDead) { key = await h.exploreCommand(); g.g_4436 = g.SelectedChar; }
      }
      if (!g.PartyDead) await this.run(this.vecA);
      if (g.ecl_Restart) await this.runAfterNewBlock();
      else if (!g.PartyDead) {
        this.setM0(0x49F0, w16(sx8(g.party_MapX)));
        this.setM0(0x49F1, w16(sx8(g.party_MapY)));
        await h.moveParty();
        await h.refreshView();
        hooks.emit('moved', () => ({ ...hooks.state.position(), from: { x: this.m0(0x49F0), y: this.m0(0x49F1) },
          stepped: w16(sx8(g.party_MapX)) !== this.m0(0x49F0) || w16(sx8(g.party_MapY)) !== this.m0(0x49F1) }));   // 2f00:348d
        if (w16(sx8(g.party_MapX)) !== this.m0(0x49F0) || w16(sx8(g.party_MapY)) !== this.m0(0x49F1))
          await h.playOrStopSound(g.g_2628);                            // step sound
        g.g_84E0 = 0; g.g_84E1 = 1;
        await this.run(this.vecB);
        if (g.ecl_Restart) await this.runAfterNewBlock();
      }
    } while (!g.PartyDead);
    g.PartyDead = 0;
  }
}

// 4300:1EA6 skip table (opcode -> ReadOperands count; 0 = PC+1)
// por-only: Pool opcode skip/dispatch tables and handlers (profile: ecl.opcodeTableVersion / ecl.implementation; game/profiles/PORONLY.md)
export const SKIP_COUNT = new Uint8Array(256);
for (const o of [0x01, 0x02, 0x0A, 0x0E, 0x11, 0x12, 0x1D, 0x20, 0x2D, 0x32, 0x34, 0x36, 0x38, 0x39, 0x3C]) SKIP_COUNT[o] = 1;
for (const o of [0x03, 0x08, 0x09, 0x0C, 0x0F, 0x10, 0x1F, 0x22]) SKIP_COUNT[o] = 2;
for (const o of [0x04, 0x05, 0x06, 0x07, 0x0B, 0x21, 0x28, 0x2A, 0x2F, 0x30, 0x35, 0x37, 0x3B]) SKIP_COUNT[o] = 3;
SKIP_COUNT[0x14] = 4; SKIP_COUNT[0x23] = 4; SKIP_COUNT[0x2E] = 5; SKIP_COUNT[0x1E] = 6; SKIP_COUNT[0x2C] = 6;
SKIP_COUNT[0x27] = 8; SKIP_COUNT[0x29] = 14;

// 2F00:2F2D ecl_Dispatch case table (1Fh absent)
const P = EclVM.prototype;
const HANDLERS = new Array(256).fill(null);
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
  0x3A: P.op3A_Delay, 0x3B: P.op3B_Spell, 0x3C: P.op3C_PrintMem, 0x3D: P.op3D_ClearBox,
});

// Every host method the VM calls (for bindings and the test harness).
export const HOST_METHODS = [
  'clearMenuLine', 'drawText', 'loadDaxRecord', 'checkEclDisk', 'getWallType', 'getCellAttr', 'loadPortrait',
  'drawPortrait', 'refreshView', 'loadAnimation', 'show3DSprite', 'drawPictureScreenOrView', 'setDataSet',
  'loadWallSet', 'clearWallSlot', 'horizontalMenu', 'cycleSelectedChar', 'drawPartyRoster', 'verticalListMenu',
  'loadCombatIcon', 'roll', 'random', 'loseItem', 'hasEffect', 'showBottomPromptAndReadKey', 'drawWrappedText',
  'applyDamage', 'clearTextRectangle', 'drawTitledFrame', 'removeFromParty', 'loadMonster', 'readWordNumber',
  'readBottomLine', 'load3DMap', 'load24x24Set', 'redrawCurrentMode', 'shop', 'temple', 'afterCombat', 'combatMain',
  'terminateGame', 'makeTreasureItem', 'buildItemName', 'messageDelay', 'savingThrow', 'attackRollVsAC', 'delay',
  'advanceClock', 'selectPartyCharacter', 'addNpcToParty', 'recalcCharacter', 'drawLocationTimeStatus',
  'playOrStopSound', 'camp', 'partyCreationMenu', 'dragonFinale', 'drawRepeatedGlyph', 'recolourOverlandTiles',
  'exploreCommand', 'moveParty',
];

// 4300:1684 MenuSelect(title, items, c0E, c0C, c0A, acceptEnter, animate) for the other areas (ov04/ov05/ov06 call it
// through the ov07 stub): runs on the current VM's host (bound by ecl_host.js).
export async function MenuSelect(title, items, c0E, c0C, c0A, acceptEnter, animate) {
  if (!EclVM.current) throw new Error('MenuSelect: no ECL VM bound (ecl_host.bindEclHost)');
  return EclVM.current.menuSelect(title, items, c0E, c0C, c0A, acceptEnter, animate);
}
