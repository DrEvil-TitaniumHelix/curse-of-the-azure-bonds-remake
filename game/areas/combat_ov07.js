// game/areas/combat_ov07.js — COMBAT ov07 (2C00), the non-VM half: encounter pictures, approach distance, ECL menus,
// duel set-up, rob, ECL damage.
// Owner: cab-build-areas. Source: decode/pseudo/COMBAT.pas.md ov07 (2C00:0456..23A1); the VM half of ov07 (operands,
// memory regions, LoadEclBlock, InitVM, gosub, skip) is cab-build-engine's engine/ecl.js (ECL_VM.md). Pool twin ov07 4300
// (Pool keeps these helpers inside its ecl.js; Curse's ECL handlers call them here by name).
// Character fields: +0 name string[15], +F7h npc_morale, +FBh..+107h money words, +14Dh items (item +37h weight word),
// +F2h effects, +143h icon slot, +195h status, +196h active, +197h side, +198h controlled, +1A4h hp, +1A5h move.

import { G, newChar, newItem, pstr, setPstr, rdW, wrW } from '../engine/state.js';
import { DrawWrappedText, ShowBottomPromptAndReadKey, ClearTextRectangle, text } from '../engine/text.js';
import { UpCase } from '../engine/tp.js';
import { view, GetWallType, GetCellAttr } from './view_ov30.js';
import { RefreshView } from './view_ov28.js';
import { LoadAnimation, Show3DSprite, DrawPictureScreenOrView, LoadPortrait, DrawPortrait } from './view_ov29.js';
import { LoadCombatIcon } from './view_ov33.js';
import { HorizontalMenu, VerticalListMenu } from './view_ov26.js';
import { X } from './view_link.js';

const HOT = /[0-9A-Z]/;                                                  // sets CS:16B3 / CS:17CA

// 2C00:0456 LoadMonsterRecord(id, var rec, var items, var effects)
export async function LoadMonsterRecord(id, rec, items, effects) {
  rec.v = null;                                                          // 2c00:045c
  rec.v = newChar();                                                     // 2c00:0468 GetMem($1A6)
  await X.LoadMonster(id, rec.v);                                        // 2c00:0476 (ENGINE ov16)
  items.v = rec.v.items;                                                 // 2c00:0489 +14Dh
  effects.v = rec.v.effects;                                             // 2c00:04a0 +F2h
}

// 2C00:04BD ApproachDistance(x, y, dir): open squares (0..2) in front of the party; 2 outside 3D areas
export function ApproachDistance(x, y, dir) {
  let steps = 0, blocked = false, r = 0;                                 // 2c00:04c3 .. 04cb
  if (view.mem(0x4BE6) === 0) { r = 2; view.setMem(0x7EC1, 2); }         // 2c00:04cf / 04db / 04df
  else while (steps < 2 && !blocked) {                                   // 2c00:04ec
    if (GetWallType(x, y, dir) === 0) {                                  // 2c00:04f8
      steps++; r = steps;                                                // 2c00:050d / 0510
      switch (dir) { case 0: y--; break; case 2: x++; break; case 4: y++; break; case 6: x--; break; }   // 2c00:0516 .. 053e
    } else blocked = true;                                               // 2c00:0543
  }
  return r;
}

// 2C00:0552 ShowHeadBodyPicture(head, body)
export async function ShowHeadBodyPicture(head, body) {
  G.g_8B63 = 0;                                                          // 2c00:0555
  G.pic_HeadId = head; G.pic_BodyId = body;                              // 2c00:055a / 0560
  await LoadPortrait(head, body);                                        // 2c00:0566
  DrawPortrait(3, 3, true);                                              // 2c00:0573
}

// 2C00:0591 ShowEncounter(sprite, pic, dist, var shown[0..1])
export async function ShowEncounter(sprite, pic, dist, shown) {
  const size = dist + 1;                                                 // 2c00:0597 frame 1..3
  if (!shown[1]) {                                                       // 2c00:05a0
    if (!shown[0]) {                                                     // 2c00:05aa
      if (G.view_AreaMap !== 0) { G.view_AreaMap = 0; G.view_Redraw = 1; RefreshView(); }   // 2c00:05b3 .. 05c4
      if (view.mem(0x4BE6) !== 0) {                                      // 2c00:05c9 3D area
        await LoadAnimation('SPRIT', sprite, 1, G.enc_Anim);             // 2c00:05e4
        shown[0] = true; G.enc_SpriteOnScreen = 1;                       // 2c00:05f5 / 05fc
      }
    } else { G.view_Redraw = 1; RefreshView(); }                         // 2c00:0603 / 0608 erase the old sprite
    if (G.view_Mode === 4) Show3DSprite(size, G.enc_Anim);               // 2c00:060d / 0614
  }
  if (shown[1] && G.enc_LastHeadId === (view.mem(0x7EE1) & 0xFF)) return;   // 2c00:0622 .. 063a
  if (dist !== 0) return;                                                // 2c00:063f
  if (G.view_Mode !== 4) return;                                         // 2c00:0648
  if (G.enc_MenuActive !== 0 && G.opt_MonsterPics === 0) return;         // 2c00:0652 / 0659
  G.enc_LastHeadId = view.mem(0x7EE1) & 0xFF;                            // 2c00:0663
  G.view_RedrawPicture = 1;                                              // 2c00:066f
  if (view.mem(0x7EE1) === 0xFF) {                                       // 2c00:0674 no head: full picture
    await LoadAnimation('PIC', pic, 0, G.enc_Anim);                      // 2c00:0690
    shown[1] = true;                                                     // 2c00:06a1
    DrawPictureScreenOrView(3, 3, true, G.enc_Anim.pic[1]);              // 2c00:06a9
  } else {
    await ShowHeadBodyPicture(view.mem(0x7EE1) & 0xFF, pic);             // 2c00:06d2
    shown[1] = true; G.g_8B63 = 0;                                       // 2c00:06d5 / 06dd
  }
}

// 2C00:06E8 MakeWord(lo, hi)
export function MakeWord(lo, hi) { return ((hi & 0xFF) * 256 + (lo & 0xFF)) & 0xFFFF; }   // 2c00:06ee

// 2C00:0790 PartyIndexOf(c): 0-based list position (list length when absent)
export function PartyIndexOf(c) {
  let n = 0;
  for (let p = G.PartyList; p; p = p.next) { if (p === c) return n; n++; }   // 2c00:0796 .. 07d0
  return n;                                                              // 2c00:07e2
}

// 2C00:16D3 MenuHotkeys(var s, var keys): lower-cases the text, collects the letter after each '~'
export function MenuHotkeys(s, keys) {
  keys.v = '';                                                           // 2c00:16da
  const a = s.v.split('');
  const n = a.length;                                                    // 2c00:16e1 taken once
  for (let i = 1; i <= n; i++) {                                         // 2c00:16ea
    if (i <= a.length && HOT.test(a[i - 1])) a[i - 1] = String.fromCharCode(a[i - 1].charCodeAt(0) + 0x20);   // 2c00:16fc / 1716 (digits -> P..Y)
    if (i <= a.length && a[i - 1] === '~') {                             // 2c00:1737
      a.splice(i - 1, 1);                                                // 2c00:1747 Delete(s, i, 1)
      if (i <= a.length) a[i - 1] = UpCase(a[i - 1]);                    // 2c00:175b (TODO(decode): past the end reads a stale byte)
      keys.v = (keys.v + (a[i - 1] ?? '')).slice(0, 40);                 // 2c00:177d .. 17b4
    }
  }
  s.v = a.join('');
}

// 2C00:17EA MenuSelect(title, items, promptColour, textColour, hotColour, acceptEnter, animate): Byte
export async function MenuSelect(title, items, promptColour, textColour, hotColour, acceptEnter, animate) {
  const m = { v: String(items) }, keys = { v: '' };
  MenuHotkeys(m, keys);                                                  // 2c00:1818
  let key;
  do {
    const r = await HorizontalMenu(String(title).slice(0, 40), m.v, promptColour, textColour, hotColour, true, !!animate);   // 2c00:1828
    key = r.key;
    if (r.ext) { await X.CycleSelectedChar(key); await X.PartySummary(G.SelectedChar); key = '\0'; }   // 2c00:1855 .. 1873
  } while (!(HOT.test(key) && key.length === 1) && !(key === '\r' && acceptEnter));   // 2c00:1878 .. 1894
  if (key === '\r') return 0;                                            // 2c00:1896 / 189e
  let k = 1;                                                             // 2c00:18a4
  while (k <= keys.v.length && keys.v[k - 1] !== key) k++;               // 2c00:18a9 .. 18c9
  return k <= keys.v.length ? k - 1 : 0xFF;                              // 2c00:18cb .. 18e1
}

// 2C00:18EE EclVerticalListMenu(title, options, headerColour, normalColour, selColour, left, top, right, bottom, list,
// showExit, var redraw, var index, var item)
export async function EclVerticalListMenu(title, options, cHeader, cItem, cSel, left, top, right, bottom, list, showExit, redraw, index, item) {
  const m = { v: String(options) }, keys = { v: '' };
  MenuHotkeys(m, keys);                                                  // 2c00:191c keys unused
  await VerticalListMenu(String(title).slice(0, 40), m.v, cHeader, cItem, cSel, left, top, right, bottom, list, showExit, redraw, index, item);   // 2c00:192c
}

// 2C00:1B3F StepForward (ECL CALL C01Eh)
export function StepForward() {
  switch (G.party_Dir) {                                                 // 2c00:1b42
    case 0: G.party_MapY = G.party_MapY > 0 ? G.party_MapY - 1 : 15; break;   // 2c00:1b4c
    case 2: G.party_MapX = G.party_MapX < 15 ? G.party_MapX + 1 : 0; break;   // 2c00:1b65
    case 4: G.party_MapY = G.party_MapY < 15 ? G.party_MapY + 1 : 0; break;   // 2c00:1b7e
    case 6: G.party_MapX = G.party_MapX > 0 ? G.party_MapX - 1 : 15; break;   // 2c00:1b97
  }
  G.party_CellAttr = GetCellAttr(G.party_MapX, G.party_MapY);            // 2c00:1ba9
  G.party_Ahead = GetWallType(G.party_MapX, G.party_MapY, G.party_Dir);  // 2c00:1bb9
  G.view_RedrawPos = 1;                                                  // 2c00:1bcd new
}

// 2C00:1BE0 SetupDuel(withOpponent): only the selected character stays active; with an opponent a copy named ROLF joins side 1
export async function SetupDuel(withOpponent) {
  G.DuelActive = 1;                                                      // 2c00:1be6
  view.setMem(0x7EE6, withOpponent & 0xFFFF);                            // 2c00:1beb sign-extended
  const me = G.SelectedChar;                                             // 2c00:1bf8
  const myName = pstr(me.b, 0);
  for (let c = G.PartyList; c; c = c.next) if (pstr(c.b, 0) !== myName) c.b[0x196] = 0;   // 2c00:1c10 .. 1c32
  if (withOpponent === 0) return;                                        // 2c00:1c44
  await LoadCombatIcon('CPIC', 0x0B, G.enc_NextIconSlot);                // 2c00:1c5c
  let c = G.PartyList;                                                   // 2c00:1c68
  while (c.next) c = c.next;                                             // 2c00:1c74 / 1c83
  const r = newChar();                                                   // 2c00:1c95
  r.b.set(me.b);                                                         // 2c00:1ca3 CopyBytes 1A6h
  r.combat = me.combat;                                                  // (the far pointer fields are copied too)
  r.b[0x196] = 1; r.next = null;                                         // 2c00:1cb6 / 1cbf
  setPstr(r.b, 0, 'ROLF', 15);                                           // 2c00:1cce
  r.b[0x198] = 1; r.b[0x197] = 1; r.b[0xF7] = 0xB2;                      // 2c00:1ce1 / 1cea / 1cf3
  r.b[0x143] = G.enc_NextIconSlot;                                       // 2c00:1cfc
  r.effects = null; r.items = null;                                      // 2c00:1d07 / 1d16
  c.next = r;                                                            // 2c00:1d25
  c = c.next;                                                            // 2c00:1d37
  for (let it = me.items; it; it = it.next) {                            // 2c00:1d47 .. 1dfe prepended: reverse order
    const n = newItem(); n.b.set(it.b);
    n.next = c.items; c.items = n;                                       // 2c00:1d71 .. 1de9
  }
}

// 2C00:1E16 RobMoney(f, c): every coin count scaled by f (Real)
export function RobMoney(f, c) {
  for (let k = 0; k <= 6; k++) wrW(c.b, 0xFB + 2 * k, Math.trunc(rdW(c.b, 0xFB + 2 * k) * f));   // 2c00:1e19 .. 1f37
}

// 2C00:1F45 LoseItems(p, c)
export async function LoseItems(p, c) {
  let it = c.items;                                                      // 2c00:1f4b
  while (it) {                                                           // 2c00:1f5b
    const w = rdW(it.b, 0x37);
    if (w > 0xFF) p = p > 0x5A ? p - 0x5A : 0;                           // 2c00:1f66 / 1f8a .. 1fa5
    else if (w > 0x18) p = p > 0x32 ? p - 0x32 : 0;
    const r = await X.Roll(1, 100);                                      // 2c00:1fab
    const nxt = it.next;                                                 // 2c00:1fb9
    if (r <= p) await X.LoseItem(c, it);                                 // 2c00:1fc8 / 1fd0
    it = nxt;                                                            // 2c00:1fe1
  }
}

// 2C00:2137 PartyMoveRange(var maxMove, var minMove)
export async function PartyMoveRange(maxMove, minMove) {
  let c = G.PartyList;                                                   // 2c00:213d
  maxMove.v = c.b[0x1A5]; minMove.v = c.b[0x1A5];                        // 2c00:2149 / 2157 read before the nil test
  for (; c; c = c.next) {                                                // 2c00:2165
    let m = c.b[0x1A5];                                                  // 2c00:2170
    if (await X.HasEffect(c, 0x27, { v: null })) m = (m * 2) & 0xFF;     // 2c00:217b / 2192 haste
    else if (await X.HasEffect(c, 0x2A, { v: null })) m >>= 1;           // 2c00:219e / 21b5 slow
    if (m > maxMove.v) maxMove.v = m;                                    // 2c00:21c3 / 21ce
    if (m < minMove.v) minMove.v = m;                                    // 2c00:21d7 / 21e2
  }
}

// 2C00:2252 ApplyEclDamage(dmg, c)
export async function ApplyEclDamage(dmg, c) {
  if (c.b[0x195] === 6) return;                                          // 2c00:2259 dead
  let clear = 0;                                                         // 2c00:2267
  const num = String(dmg & 0xFFFF).slice(0, 3);                          // 2c00:226c Str(dmg:0, num) string[3]
  const name = pstr(c.b, 0);
  const s = (c.b[0x1A4] + 10 < dmg) ? '  ' + name + ' dies. '           // 2c00:2285 / 2297
    : '  ' + name + ' is hit FOR ' + num + ' points of Damage.';        // 2c00:22cc
  if (text.row > 0x16) {                                                 // 2c00:2314 cursor below the text window
    text.row = 0x11; clear = 1;                                          // 2c00:231b / 2320
    await ShowBottomPromptAndReadKey(15, 0, 'press <enter>/<return> to continue');   // 2c00:233b
  } else clear = 0;                                                      // 2c00:2342
  text.col = 0x26;                                                       // 2c00:2347
  await DrawWrappedText(1, 0x11, 0x26, 0x16, 15, 0, clear, s);           // 2c00:234c
  await X.ApplyDamage(c, dmg & 0xFF);                                    // 2c00:236e damage truncated to a byte
  ClearTextRectangle(0x11, 1, 0x26, 15);                                 // 2c00:237d roster area
  await X.PartySummary(G.SelectedChar);                                  // 2c00:238e
}

// 2C00:0000 ov07_LoadDeps / 2C00:23A1 ov07_init: empty.
