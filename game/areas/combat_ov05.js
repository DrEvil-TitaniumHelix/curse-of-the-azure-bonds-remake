// game/areas/combat_ov05.js — COMBAT ov05 (2900): after combat — outcome, duel, experience, NPC shares, treasure.
// Owner: cab-build-areas. Source: decode/pseudo/COMBAT.pas.md ov05 (2900:0039..18F9; screens COMBAT-05-01..03); Pool twin
// ov05 3900 (structure only). Caution rule 2: TreasureMenu / TakeTreasureMenu re-read from decode/listings/ov05.lst
// (2900:0ef9..0fac, 11bc..1362): both menus call HorizontalMenu(.., 13, 10, 15, allowExt 1, animate 1, var ext); only 'P'
// tests ext; 'G' / 'O' (Home / End scan codes) select a character; the leave question is MenuSelect('', '~Yes ~No',
// 13, 10, 15, 0, 0) = 1 ("No") to leave; the two warnings are DrawWrappedText(1, 17, 38, 22, 10 / 15, 0, 1 / 0, ..).
// Character fields: +0 name, +11h str, +13h int, +15h wis, +17h dex, +75h class, +E5h level, +F7h npc_morale,
// +F8h npc_shares (low 3 bits), +FBh.. money words, +119h gender, +127h xp (LongInt), +12Ch hp_rolled, +13Ch xp_value
// (word), +13Eh xp_per_hp, +14Dh items, +195h status, +196h active, +197h side, +1A4h hp; combat record +13h = not a
// party member. Item: +32h plus (signed), +34h readied.
// Shapes: G.TreasureMoney = 7 LongInts (party_ov21.js), G.TreasureItems = item list { b, next }, treasure_Mark = item ref.
// A treasure-only encounter reaches this unit without combat records (c.combat = null): the original reads the nil
// pointer's byte 13h (interrupt-vector memory); read as 0 here (TODO(decode)).

import { G, newItem, rdW, wrW, pstr } from '../engine/state.js';
import { DrawText, DrawWrappedText, ShowBottomPromptAndReadKey, ClearTextRectangle, DrawScreenFrame, text } from '../engine/text.js';
import { view } from './view_ov30.js';
import { HorizontalMenu, VerticalListMenu } from './view_ov26.js';
import { MenuSelect } from './combat_ov07.js';
import { X } from './view_link.js';
import { hooks, itemSummary } from '../plus/hooks.js';

const END_EFFECTS = [0x03, 0x0B, 0x0D, 0x15, 0x17, 0x1B, 0x23, 0x28, 0x33, 0x34, 0x35, 0x3A, 0x5B, 0x88, 0x89, 0x8B, 0x8E, 0x90, 0x1F];
const endEffect = (i) => (G.ds ? G.ds[0x02A7 + i] : END_EFFECTS[i - 1]);   // combat_EndEffects DS:02A8..02BA ([DI+2A7h])
const rdL = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24));
const wrL = (b, o, v) => { wrW(b, o, v & 0xFFFF); wrW(b, o + 2, (v >>> 16) & 0xFFFF); };
const sb = (v) => ((v & 0xFF) ^ 0x80) - 0x80;
const sw = (v) => ((v & 0xFFFF) ^ 0x8000) - 0x8000;
const notMember = (c) => (c.combat ? c.combat.b[0x13] : 0);             // cb^[13h] (nil combatant: see the header)
const TM = () => { if (!Array.isArray(G.TreasureMoney)) G.TreasureMoney = [0, 0, 0, 0, 0, 0, 0]; return G.TreasureMoney; };
const freeTreasureItems = () => { G.TreasureItems = null; };            // FreeMem($3F) per item

// 2900:0039 ComputeCombatXP(var xp)
export async function ComputeCombatXP(xp) {
  if (G.DuelActive !== 0) { xp.v = sw(sb(G.SelectedChar.b[0xE5]) * 100); return; }   // 2900:003f / 0046
  let total = 0;                                                         // 2900:0063
  let n = 0;                                                             // 2900:0077 counted, never tested
  for (let c = G.PartyList; c; c = c.next) {                             // 2900:006b / 007b
    let it = c.items;                                                    // 2900:0086
    if (c.b[0x197] === 1 && c.b[0x195] !== 0 && c.b[0x195] !== 3) {      // 2900:0096
      G.EnemiesFought = 1;                                               // 2900:00c0
      for (let k = 0; k <= 6; k++) TM()[k] = (TM()[k] + rdW(c.b, 0xFB + 2 * k)) | 0;   // 2900:00ce
      total = (total + rdW(c.b, 0x13C) + sw((c.b[0x12C] * c.b[0x13E]) & 0xFFFF)) | 0;   // 2900:00fc
      if (view.mem(0x7EE3) !== 1)                                        // 2900:0133 1 = enemies' items not looted
        while (it) {                                                     // 2900:0142
          n++;                                                           // 2900:014d
          const old = G.TreasureItems;                                   // 2900:0150
          const t = newItem();                                           // 2900:0159 GetMem($3F)
          await X.BuildItemName(c, it, 0, 0, 0, 0);                      // 2900:0167
          t.b.set(it.b);                                                 // 2900:0184 63-byte copy
          t.b[0x34] = 0;                                                 // 2900:0198 not readied
          t.next = old; G.TreasureItems = t;                             // 2900:01a1 pushed at the head
          it = it.next;                                                  // 2900:0216
        }
    }
  }
  const m = TM();
  total = (total + Math.trunc(m[0] / 200)) | 0;                          // 2900:023b copper
  total = (total + Math.trunc(m[1] / 20)) | 0;                           // 2900:0251 silver
  total = (total + Math.trunc(m[2] / 2)) | 0;                            // 2900:0267 electrum
  total = (total + m[3]) | 0;                                            // 2900:027d gold
  total = (total + m[4] * 5) | 0;                                        // 2900:0289 platinum
  total = (total + m[5] * 250) | 0;                                      // 2900:029f gems
  total = (total + m[6] * 2200) | 0;                                     // 2900:02b5 jewelry
  for (let it = G.TreasureItems; it && it !== G.treasure_Mark; it = it.next)   // 2900:02cb / 02d7
    if (sb(it.b[0x32]) > 0) total = (total + sw(sb(it.b[0x32]) * 400)) | 0;   // 2900:02f0 / 02fa
  const d = (view.mem(0x7F3E) - G.NonSharing) & 0xFFFF;                  // 2900:031f party member count
  if (d === 0) throw new Error('Runtime error 200 (division by zero) at 2900:031f');
  xp.v = Math.trunc(total / d) | 0;
}

// 2900:0351 AwardXP(xp)
export function AwardXP(xp) {
  for (let c = G.PartyList; c; c = c.next) {                             // 2900:0357 / 0363
    if (c.b[0x196] === 0 || c.b[0x195] === 1) continue;                  // 2900:036e
    let share = xp;                                                      // 2900:038a
    const plus = (Math.trunc(xp / 10) + xp) | 0;
    const str = c.b[0x11], int = c.b[0x13], wis = c.b[0x15], dex = c.b[0x17];
    switch (c.b[0x75]) {                                                 // 2900:0395
      case 0: if (wis > 15) share = plus; break;                         // 2900:03a2 cleric
      case 2: if (str > 15) share = plus; break;                         // 2900:03cf fighter
      case 3: if (str > 15 && wis > 15) share = plus; break;             // 2900:03fc paladin
      case 4: if (str > 15 && int > 15 && wis > 15) share = plus; break; // 2900:0433 ranger
      case 5: if (int > 15) share = plus; break;                         // 2900:0474 magic-user
      case 6: if (dex > 15) share = plus; break;                         // 2900:04a0 thief
      case 8: case 10: case 11: case 12: case 13: case 14: case 16: share = Math.trunc(xp / 2); break;   // 2900:04c7
      case 9: case 15: share = Math.trunc(xp / 3); break;                // 2900:04f2
    }
    wrL(c.b, 0x127, (rdL(c.b, 0x127) + share) | 0);                      // 2900:0511
  }
}

// 2900:053C ResolveCombatOutcome
export async function ResolveCombatOutcome() {
  G.NonSharing = 0; G.PartyDead = 1; G.PartyFled = 0;                    // 2900:0542 .. 054c
  for (let c = G.PartyList; c && notMember(c) !== 1; c = c.next)         // 2900:0551 / 055d
    if (c.b[0x195] === 3) G.PartyFled = 1;                               // 2900:0574
  let anyUp = false;                                                     // 2900:05a2
  for (let c = G.PartyList; c && !anyUp; c = c.next)                     // 2900:0596 / 05a6
    if (c.b[0x196] !== 0 || [4, 3, 5].includes(c.b[0x195])) anyUp = true;   // 2900:05b4
  if (G.DuelActive !== 0 || (view.mem(0x7EE6) !== 0 && anyUp)) G.PartyDead = 0;   // 2900:05f6
  G.PartyWon = 0;                                                        // 2900:0614
  let c = G.PartyList;                                                   // 2900:0619
  const xp = { v: G.CombatXP | 0 };
  if (G.DuelActive === 0 || G.DemoMode === 0) {                          // 2900:0625
    for (; c && notMember(c) !== 1; c = c.next) {                        // 2900:0636
      if ([3, 1, 0].includes(c.b[0x195]) && c.b[0x197] === 0 && c.b[0xF7] < 0x80) G.PartyDead = 0;   // 2900:0653 / 068a
      if (c.b[0x195] === 1 || c.b[0x195] === 0) { G.PartyWon = 1; G.PartyFled = 0; }   // 2900:068f / 06a5
      if (c.b[0x196] === 0 || c.b[0x195] === 1) G.NonSharing = (G.NonSharing + 1) & 0xFF;   // 2900:06af / 06c5
      for (let i = 1; i <= 19; i++) await X.RemoveEffect(c, endEffect(i), null);   // 2900:06ea / 06ef
    }
    if (G.PartyWon !== 0) {                                              // 2900:0708
      await ComputeCombatXP(xp); G.CombatXP = xp.v;                      // 2900:070f
      AwardXP(G.CombatXP);                                               // 2900:0718
    }
    c = G.PartyList;                                                     // 2900:0724
    if (G.PartyDead === 0) {                                             // 2900:0730
      while (c && notMember(c) !== 1) {                                  // 2900:073a
        if (G.PartyFled === 0) {                                         // 2900:0757
          switch (c.b[0x195]) {                                          // 2900:0761
            case 3: c.b[0x195] = 0; c.b[0x196] = 1; break;               // 2900:076d running -> okay
            case 5:                                                      // 2900:0786 dying
              if (view.mem(0x7EE6) === 0) c.b[0x195] = 4;                // 2900:0792
              else { c.b[0x195] = 0; c.b[0x196] = 1; c.b[0x1A4] = 1; }   // 2900:07af
              break;
            case 4:                                                      // 2900:07be unconscious
              if (c.b[0x1A4] !== 0) { c.b[0x195] = 0; c.b[0x196] = 1; }  // 2900:07c9
              else if (view.mem(0x7EE6) !== 0) { c.b[0x195] = 0; c.b[0x196] = 1; c.b[0x1A4] = 1; }   // 2900:07dd / 07e9
              break;
          }
          c = c.next;                                                    // 2900:0804
        } else {
          view.setMem(0x7EC7, 0x81);                                     // 2900:0816 fled
          if (c.b[0x195] === 3) { c.b[0x195] = 0; c.b[0x196] = 1; c = c.next; }   // 2900:0821 / 083e
          else {
            G.SelectedChar = c;                                          // 2900:0850
            c = c.next;                                                  // 2900:085c read before the record is freed
            await X.RemovePartyMember(0, 1);                             // 2900:086c left behind
          }
        }
      }
    } else {
      let stop = false;                                                  // 2900:087c
      for (c = G.PartyList; c && !stop; c = c.next) {                    // 2900:088c
        if (notMember(c) === 1) stop = true;                             // 2900:089a
        else { G.SelectedChar = c; await X.RemovePartyMember(0, 1); }    // 2900:08a9 / 08b5
      }                                                                  // 2900:08c6 next read after the free (as Pool)
      view.setMem(0x7F3E, 0);                                            // 2900:08d8 no party members
    }
  } else {                                                               // DemoMode duel
    for (; c; c = c.next)                                                // 2900:08f2
      if (c.b[0x196] === 1 && c.b[0x195] === 0 && c.b[0x197] !== 1) {    // 2900:08fa
        G.PartyWon = 1;                                                  // 2900:091b
        await ComputeCombatXP(xp); G.CombatXP = xp.v; AwardXP(G.CombatXP);   // 2900:0920 / 0929
      }
    for (c = G.PartyList; c; c = c.next) {                               // 2900:0947 / 0953
      if (c.b[0x195] === 0 || c.b[0x195] === 1) c.b[0x196] = 1;          // 2900:095b / 0971
      if (c.b[0x195] === 5) c.b[0x195] = 4;                              // 2900:097a / 0985
    }
  }
}

// 2900:0A7E ShowCombatResult(xp) — xp is a value parameter
export async function ShowCombatResult(xp) {
  DrawScreenFrame();                                                     // 2900:0a8a
  if (G.EnemiesFought === 0 && G.DuelActive === 0)                       // 2900:0a8f
    DrawText(1, 3, 10, 0, 'The party has found Treasure!');              // 2900:0bd4
  else if (G.PartyFled === 0) {                                          // 2900:0aa0
    if ((G.DuelActive !== 0 && G.PartyWon === 0) || (G.PartyWon === 0 && view.mem(0x7EE6) !== 0)) {   // 2900:0b30 .. 0b4f
      view.setMem(0x7EC7, 0x80);                                         // 2900:0b51
      DrawText(1, 3, 10, 0, 'You have lost the fight.');                 // 2900:0b5c
      xp = 0;                                                            // 2900:0b7d
    } else if (G.DuelActive !== 0) DrawText(1, 3, 10, 0, 'You have won the duel.');   // 2900:0b87 / 0b8e
    else DrawText(1, 3, 10, 0, 'The party has won.');                    // 2900:0bb1
  } else {
    DrawText(1, 3, 10, 0, 'The party has fled.');                        // 2900:0aaa
    xp = 0;                                                              // 2900:0acb
    freeTreasureItems();                                                 // 2900:0ad3 .. 0b1a the treasure is lost
    G.TreasureMoney = [0, 0, 0, 0, 0, 0, 0];                             // 2900:0b1c FillChar($1C)
  }
  const n = String(xp | 0).slice(0, 10);                                 // 2900:0bf5 Str(xp:0, n) string[10]
  const s = G.DuelActive !== 0 ? 'The duelist receives ' + n : 'Each character receives ' + n;   // 2900:0c0c / 0c3e
  DrawText(1, 5, 10, 0, s);                                              // 2900:0c67
  DrawText(1, 7, 10, 0, 'experience points.');                           // 2900:0c7e
  await HorizontalMenu('', 'press <enter>/<return> to continue', 15, 15, 15, true, false);   // 2900:0cb5 result unused
}

// 2900:0CE6 ChooseLootItem(var key, var sel, var cur, var index)
export async function ChooseLootItem(key, sel, cur, index) {
  const redraw = { v: true };                                            // 2900:0cec
  DrawScreenFrame();                                                     // 2900:0cf0
  for (let it = G.TreasureItems; it; it = it.next) await X.BuildItemName(null, it, 0, 0, 0, 0);   // 2900:0d01 .. 0d26
  const list = G.TreasureItems;                                          // 2900:0d37
  key.v = await VerticalListMenu('Items: ', 'Take', 13, 10, 15, 1, 1, 38, 22, list, true, redraw, index, cur);   // 2900:0d61
  sel.v = cur.v;                                                         // 2900:0d99
}

// 2900:0DB1 TakeLootItems
export async function TakeLootItems() {
  const sel = { v: null }, cur = { v: G.TreasureItems }, index = { v: 0 }, key = { v: '\0' };   // 2900:0db7 .. 0dcb
  let done;
  do {
    await ChooseLootItem(key, sel, cur, index);                          // 2900:0dd0
    if (key.v !== 'T' && key.v !== '\r') done = true;                    // 2900:0de8 / 0df4
    else {
      done = false;                                                      // 2900:0dfb
      const refused = { v: false };
      await X.AddItemToChar(sel.v, refused);                             // 2900:0dff
      if (!refused.v) {                                                  // 2900:0e0f
        const s = sel.v;
        if (G.TreasureItems === s) G.TreasureItems = s.next;             // 2900:0e18 / 0e33
        else {
          let p = G.TreasureItems;                                       // 2900:0e24
          while (p.next !== s) p = p.next;                               // 2900:0e45 / 0e58
          p.next = s.next;                                               // 2900:0e69
        }
        s.next = null;                                                   // 2900:0e7d (FreeMem 2900:0e92: AddItemToChar keeps its own copy)
        if (!G.TreasureItems) done = true;                               // 2900:0ea0
      }
    }
  } while (!done);                                                       // 2900:0ead
  await X.RedrawCurrentMode();                                           // 2900:0eb6
}

// 2900:0ED7 TakeTreasureMenu(var money, var items)
export async function TakeTreasureMenu(money, items) {
  let done = false;                                                      // 2900:0edd
  if (!money.v) { await TakeLootItems(); return; }                       // 2900:0ee1 / 0fc4
  if (!items.v) { await X.TakeMoney(); await X.RedrawCurrentMode(); return; }   // 2900:0eed / 0fb7
  do {
    const key = (await HorizontalMenu('Take: ', 'Money Items Exit', 13, 10, 15, true, true)).key;   // 2900:0f2b
    switch (key) {                                                       // 2900:0f33
      case 'M': await X.TakeMoney(); await X.RedrawCurrentMode(); break; // 2900:0f3a / 0f3f
      case 'I': await TakeLootItems(); break;                            // 2900:0f4b
      case 'E': case '\0': done = true; break;                           // 2900:0f58
      case 'G': case 'O': await X.CycleSelectedChar(key); break;         // 2900:0f66 / 0f75
    }
    await X.PartySummary(G.SelectedChar);                                // 2900:0f82
    await X.TreasurePoolStatus(money, items);                            // 2900:0f91
    if (!money.v || !items.v) done = true;                               // 2900:0f96 / 0fa8
  } while (!done);                                                       // 2900:0fac
}

// 2900:106C TreasureMenu
export async function TreasureMenu() {
  let done = false;                                                      // 2900:1078
  await X.RedrawCurrentMode();                                           // 2900:107d
  const money = { v: false }, items = { v: false };
  let spell = 0;
  do {
    money.v = false;                                                     // 2900:1082
    await X.TreasurePoolStatus(money, items);                            // 2900:1086
    hooks.emit('treasure', () => { const it = []; for (let p = G.TreasureItems; p; p = p.next) it.push(itemSummary(p)); return { items: it, money: [...(G.TreasureMoney || [])], afterCombat: G.view_Mode === 5 || !!G.g_8B56 }; });   // Plus (plus request #2)
    let menu = 'View Pool Exit', i = 0, tail = ' Exit', detect = false;  // 2900:1095 .. 10c2
    const me = G.SelectedChar;
    while (items.v && i < 84 && !detect) {                               // 2900:10c7
      const s = me.b[0x1E + i];
      if ((s === 5 || s === 0x0B || s === 0x4D) && me.b[0x196] !== 0) { detect = true; spell = s; }   // 2900:10db .. 112b
      i++;                                                               // 2900:1139
    }
    if (detect) tail = ' Detect Exit';                                   // 2900:113f / 1146
    if (money.v) menu = 'View Take Pool Share' + tail;                   // 2900:115a / 1160
    else if (items.v) menu = 'View Take Pool' + tail;                    // 2900:118c / 1192
    const m = await HorizontalMenu('', menu, 13, 10, 15, true, true);    // 2900:11dd
    const key = m.key, ext = { v: m.ext };
    switch (key) {                                                       // 2900:11e6
      case 'V': await X.ViewMenu(ext); break;                            // 2900:11f4
      case 'T': await TakeTreasureMenu(money, items); break;             // 2900:120b
      case 'P': if (!ext.v) await X.PoolMoney(); break;                  // 2900:1215 / 121c
      case 'S': await X.ShareMoney(); break;                             // 2900:1228
      case 'D': await X.CastSpell(spell, 0, 0, ext); break;              // 2900:1245
      case 'E': case '\0': {                                             // 2900:124d
        await X.TreasurePoolStatus(money, items);                        // 2900:1262
        if (!money.v && !items.v) done = true;                           // 2900:1267 / 1323
        else {
          await DrawWrappedText(1, 17, 38, 22, 10, 0, 1, 'There is still treasure left.  ');   // 2900:12af
          await DrawWrappedText(1, 17, 38, 22, 15, 0, 0, 'Do you want to go back and claim your treasure?');   // 2900:12d9
          if (await MenuSelect('', '~Yes ~No', 13, 10, 15, 0, 0) === 1) done = true;   // 2900:12f9 / 1302 "No"
          else ClearTextRectangle(1, 17, 38, 22);                        // 2900:131c
        }
        break;
      }
      case 'G': case 'O': await X.CycleSelectedChar(key); await X.PartySummary(G.SelectedChar); break;   // 2900:1333 .. 135d
    }
  } while (!done);                                                       // 2900:1362
}

// 2900:1370 RemoveMonstersAfterCombat
export async function RemoveMonstersAfterCombat() {
  view.setMem(0x7EC8, 0);                                                // 2900:1376 defeated enemies
  let c = G.PartyList;                                                   // 2900:1381
  while (c) {                                                            // 2900:138d
    if (notMember(c) === 1 || c.b[0x197] === 1) {                        // 2900:1398 / 13a7
      G.EnemiesFought = 1;                                               // 2900:13b2
      if (c.b[0x196] !== 1) view.setMem(0x7EC8, view.mem(0x7EC8) + 1);   // 2900:13b7 / 13c2
      const n = c.next;                                                  // 2900:13cb
      G.SelectedChar = c;                                                // 2900:13db
      await X.RemovePartyMember(notMember(c) === 1 ? 1 : 0, 1);          // 2900:13e7 / 13fc
      c = n;                                                             // 2900:1405
    } else {
      if (c.combat) c.combat = null;                                     // 2900:1412 .. 1433 FreeMem($16)
      c = c.next;                                                        // 2900:1442
    }
  }
  G.SelectedChar = G.PartyList;                                          // 2900:1455
}

// 2900:14AC NpcTakesShare
export async function NpcTakesShare() {
  let hid = false, npcShares = 0, total = 0;                             // 2900:14af .. 14c3
  for (let c = G.PartyList; c; c = c.next) {                             // 2900:14b7 / 14cb
    if (c.b[0xF7] >= 0x80 && c.b[0x195] === 0) {                         // 2900:14d3 / 14de
      npcShares += c.b[0xF8] & 7;                                        // 2900:14e9
      total += c.b[0xF8] & 7;                                            // 2900:14f6
    } else total++;                                                      // 2900:1505
  }
  npcShares &= 0xFF; total &= 0xFF;
  if (npcShares !== 0)                                                   // 2900:151a
    for (let k = 0; k <= 6; k++)                                         // 2900:1526
      if (TM()[k] > 0) {                                                 // 2900:1529 signed 32-bit
        const per = Math.trunc(TM()[k] / total) & 0xFF;                  // 2900:1543 quotient truncated to a byte
        TM()[k] = (TM()[k] - sw(npcShares * per)) | 0;                   // 2900:1563
        hid = true;                                                      // 2900:1587
      }
  if (hid) {                                                             // 2900:158f
    DrawScreenFrame();                                                   // 2900:159e
    let row = 0;                                                         // 2900:15a3
    for (let c = G.PartyList; c; c = c.next) {                           // 2900:15b3
      if (c.b[0xF7] > 0x7F && c.b[0x195] === 0 && c.b[0xF8] !== 0) {     // 2900:15be .. 15da
        const pron = c.b[0x119] === 0 ? 'his' : 'her';                   // 2900:15e8
        await DrawWrappedText(5, row + 5, 34, 22, 10, 0, 1, pstr(c.b, 0) + ' takes and hides ' + pron + ' share.');   // 2900:163c / 168c
        row += 2;                                                        // 2900:1691
      }
    }
    await HorizontalMenu('', 'press <enter>/<return> to continue', 15, 15, 15, true, false);   // 2900:16c6
  }
}

// 2900:1736 AfterCombat (entry e1; ECL COMBAT after the round loop, or treasure-only encounters)
export async function AfterCombat() {
  view.setMem(0x7EC7, 0);                                                // 2900:173c combat result for the script
  G.EnemiesFought = 0;                                                   // 2900:1747
  if (G.DemoMode === 0) await ResolveCombatOutcome();                    // 2900:174c / 1753
  G.view_Mode = 6;                                                       // 2900:1757
  await RemoveMonstersAfterCombat();                                     // 2900:175c
  if (G.DemoMode === 0) {                                                // 2900:1760
    for (let c = G.PartyList; c; c = c.next) await X.RecalcItems(c);     // 2900:176a .. 177e
    if (G.PartyDead === 0 || G.DuelActive !== 0) {                       // 2900:179b
      if (G.PartyFled !== 0) freeTreasureItems();                        // 2900:17ac .. 17f1
      if (G.DemoMode === 0) {                                            // 2900:17f9
        await NpcTakesShare();                                           // 2900:1800
        await ShowCombatResult(G.CombatXP | 0);                          // 2900:1804
        await TreasureMenu();                                            // 2900:1810
      }
      freeTreasureItems();                                               // 2900:1814 .. 1852 unclaimed items are lost
    } else {
      view.setMem(0x7EC7, 0x80);                                         // 2900:185c party destroyed
      DrawScreenFrame();                                                 // 2900:1867
      text.col = 2; text.row = 6;                                        // 2900:186c
      await DrawWrappedText(2, 5, 37, 22, 10, 0, 1, 'The monsters rejoice for the party has been destroyed');   // 2900:189a
      await ShowBottomPromptAndReadKey(13, 0, 'Press any key to continue');   // 2900:18b4
    }
    G.TextOutputActive = 1;                                              // 2900:18b9
    view.setMem(0x7F70, 0); view.setMem(0x7F71, 0); view.setMem(0x7F72, 0);   // 2900:18be .. side to-hit modifiers
    view.setMem(0x7EE3, 0);                                              // 2900:18df "no loot"
    view.setMem(0x7EE6, 0);                                              // 2900:18ea "nobody dies"
  }
}

// 2900:0000 ov05_LoadDeps / 2900:18F9 ov05_init: empty.
