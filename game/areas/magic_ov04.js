// game/areas/magic_ov04.js — MAGIC ov04 (2700): the temple.
// Owner: cab-build-areas. Source: decode/pseudo/MAGIC.pas.md ov04 (verified, MAGIC_VERIFY.md #verify-32 applied); Pool
// twin ov04 3400 (structure only). Caution rule 2: Temple's menu loop re-read from decode/listings/ov04.lst
// (2700:0e8c..1012): 'H' and 'P' only without ext, 'V' ViewMenu(var ext), 'A' AppraiseGems(var changed), 'G' / 'O'
// CycleSelectedChar(key); after the case 'B' / 'T' redraw, 'A' redraws only when Appraise changed something; the leave
// question is MenuSelect('', '~Yes ~No', 0Dh, 0Ah, 0Fh, 0, 0) = 1 ("No") to leave.
// Service names: TempleService[k] = string[40] at DS:00BB + k*29h (k = 1..11); disease effect types DS:00DE..00E3.
// Character fields: +78h maxhp, +19h con, +E6h old fighter level cap, +109h levels, +12Ch maxhp_base, +14Dh items
// (item +36h cursed), +195h status, +196h active, +1A4h hp.

import { G, pstr } from '../engine/state.js';
import { DrawText, DrawWrappedText, ClearTextRectangle, FrameWithTextBar } from '../engine/text.js';
import { view } from './view_ov30.js';
import { HorizontalMenu, AskYesNo, VerticalListMenu, NewMenuList, FreeMenuList } from './view_ov26.js';
import { X } from './view_link.js';

const DISEASES = [0x1F, 0x22, 0x2B, 0x2C, 0x32, 0x39];   // DiseaseEffects DS:00DE..00E3 (image)
const disease = (k) => (G.ds ? G.ds[0x00DD + k] : DISEASES[k - 1]);
const dsPstr = (a) => (G.ds ? pstr(G.ds, a) : '');
const sel = () => G.SelectedChar;
const hp = (c) => c.b[0x1A4], setHp = (c, v) => { c.b[0x1A4] = v & 0xFF; };

// 2700:0047 ConfirmNeedless(msg): Char
async function ConfirmNeedless(msg) {
  await X.ShowCharacterMessage(sel(), msg, 0, 0);                        // 2700:0062
  const r = await AskYesNo('cast cure anyway: ', 13, 10, 15);            // 2700:007b / 008b
  await X.ClearCharacterMessage();                                       // 2700:009c
  return r;
}

// 2700:00F3 PayForCure(price, service): Char
async function PayForCure(price, service) {
  const msg = service + ' will only cost ' + (await X.WordToStr(price)) + ' gold pieces.';   // 2700:010e .. 0150
  await DrawWrappedText(1, 0x11, 0x26, 0x16, 10, 0, 1, msg);             // 2700:0155
  let answer = await AskYesNo('pay for cure ', 13, 10, 15);              // 2700:0175 / 0185
  if (answer === 'Y') {                                                  // 2700:0197
    const gold = (await X.MoneyInGold(sel())) & 0xFFFF;                  // 2700:01a1 low word only
    if (gold >= price) await X.SetCharMoneyGold(gold - price);           // 2700:01b2 / 01c2
    else {
      const pool = await X.MoneyValueInGold(G.TreasureMoney);            // 2700:01cd LongInt
      if (pool < 0x10000 && pool < price) {                              // 2700:01df .. 01f0 signed compare
        await X.ShowTimedBottomMessage('Not enough money.'); answer = 'N';   // 2700:020a / 021a
      } else await X.SetPoolMoneyGold((pool - price) & 0xFFFF);          // 2700:01ff Lo(pool - price)
    }
  }
  if (answer === 'Y') { await X.ClearCharacterMessage(); await X.ShowCharacterMessage(sel(), 'is cured.', 0, 1); }   // 2700:0224 .. 0248
  return answer;                                                         // 2700:0253
}

// 2700:0280 CureBlindness
async function CureBlindness() {
  let ok = 'Y';                                                          // 2700:028c
  if (!await X.HasEffect(sel(), 0x21, { v: null })) ok = await ConfirmNeedless('is not blind.');   // 2700:0291 .. 02bb
  if (ok === 'Y') {                                                      // 2700:02c2
    ok = await PayForCure(1000, 'Cure Blindness');                       // 2700:02c9 / 02d9
    if (ok === 'Y') await X.RemoveEffect(sel(), 0x21, null);            // 2700:02e5 / 02ec
  }
}

// 2700:0324 CureDisease
async function CureDisease() {
  let diseased = false, ok = 'Y';                                        // 2700:032b / 0330 / 0335
  for (let k = 1; k <= 6; k++) if (await X.HasEffect(sel(), disease(k), { v: null })) diseased = true;   // 2700:0345 .. 0372
  if (!diseased) ok = await ConfirmNeedless('is not Diseased.');         // 2700:0374 .. 038c
  if (ok === 'Y' && await PayForCure(1000, 'Cure Disease') === 'Y') {    // 2700:0393 / 039a .. 03bb
    G.cure_InProgress = 1;                                               // 2700:03bd
    for (let k = 1; k <= 6; k++) await X.RemoveEffect(sel(), disease(k), null);   // 2700:03c2 .. 03f2
    G.cure_InProgress = 0;                                               // 2700:03f4
  }
}

// 2700:043D CureWounds(kind)
async function CureWounds(kind) {
  const c = sel();
  switch (kind) {
    case 1: if (await PayForCure(100, 'Cure Light Wounds') === 'Y') await X.HealCharacter(c, await X.Roll(1, 8), 0); break;   // 2700:0443 .. 047b
    case 2: if (await PayForCure(350, 'Cure Serious Wounds') === 'Y') await X.HealCharacter(c, ((await X.Roll(2, 8)) + 1) & 0xFF, 0); break;   // 2700:0495 .. 04cb
    case 3: if (await PayForCure(600, 'Cure Critical Wounds') === 'Y') await X.HealCharacter(c, ((await X.Roll(3, 8)) + 3) & 0xFF, 0); break;  // 2700:04e5 .. 051d
    case 4:                                                              // 2700:0537 new: Heal
      if (await PayForCure(5000, 'Heal') === 'Y') {
        const amount = (c.b[0x78] - hp(c) - await X.Roll(1, 4)) & 0xFF;  // 2700:0562 .. 058f
        await X.HealCharacter(c, amount, 0);                             // 2700:058f
        await X.RemoveEffect(c, 0x21, null);                             // 2700:05a6
        for (let k = 1; k <= 6; k++) await X.RemoveEffect(c, disease(k), null);   // 2700:05bc .. 05e8
        await X.RemoveEffect(c, 0x44, null);                             // 2700:05ea
        await X.RecalcAbility(c, 1);                                     // 2700:0600 INT
        await X.RecalcAbility(c, 2);                                     // 2700:0610 WIS
      }
      break;
  }
}

// 2700:063E RaiseDead
async function RaiseDead() {
  const c = sel();
  let dead = false, ok = 'Y';                                            // 2700:0645 .. 065d
  if (c.b[0x195] === 6 || c.b[0x195] === 1) dead = true;                 // 2700:0662 .. 067a
  if (!dead) ok = await ConfirmNeedless('is not dead.');                 // 2700:067f .. 0697
  if (ok !== 'Y') return;                                                // 2700:069e
  ok = await PayForCure(5500, 'Raise Dead');                             // 2700:06a8 / 06b8
  if (ok !== 'Y' || !dead) return;                                       // 2700:06c4 / 06d5
  G.cure_InProgress = 1;                                                 // 2700:06d8
  await X.RemoveEffect(c, 0x20, null);                                   // 2700:06dd animated
  await X.RemoveEffect(c, 0x37, null);                                   // 2700:06f3 poisoned
  G.cure_InProgress = 0;                                                 // 2700:0709
  setHp(c, 1); c.b[0x195] = 0; c.b[0x196] = 1;                           // 2700:070e / 0718 / 0722
  if (c.b[0x19] !== 0) c.b[0x19]--;                                      // 2700:072c / 0737
  const maxhpBase = c.b[0x12C], maxhp = c.b[0x78];
  let bonus = maxhpBase < maxhp ? maxhp - maxhpBase : 0;                 // 2700:073f .. 076f
  let sum = 0;                                                           // 2700:0776
  const con = c.b[0x19];
  if (con > 13) {                                                        // 2700:077b
    for (let j = 0; j <= 7; j++) {                                       // 2700:0789
      const lv = c.b[0x109 + j], slv = (lv ^ 0x80) - 0x80;
      if (slv > 0) {                                                     // 2700:0794
        if (j === 2) sum += (con - 14) * c.b[0x109 + 2];                 // 2700:07a7 / 07ae fighter
        else if (con < 16) sum += lv;                                    // 2700:07d6 / 07e1
        else sum += lv * 2;                                              // 2700:07fa
      }
    }
    if (sum !== 0) bonus = Math.trunc(bonus / sum);                      // 2700:0818
    const f = c.b[0x109 + 2], sf = (f ^ 0x80) - 0x80;
    if (con < 17 || sf > 0 || c.b[0xE6] < f) c.b[0x78] = (c.b[0x78] - bonus) & 0xFF;   // 2700:0834 .. 085f
  }
}

// 2700:0892 NeutralizePoison
async function NeutralizePoison() {
  const poisoned = await X.HasEffect(sel(), 0x37, { v: null });          // 2700:08a8
  let ok = 'Y';                                                          // 2700:08c1
  if (!poisoned) ok = await ConfirmNeedless('is not poisoned.');         // 2700:08c6 .. 08de
  if (ok === 'Y' && await PayForCure(1000, 'Neutralize Poison') === 'Y') {   // 2700:08e5 .. 090d
    G.cure_InProgress = 1;                                               // 2700:090f
    await X.RemoveEffect(sel(), 0x37, null);                             // 2700:0914
    await X.RemoveEffect(sel(), 0x16, null);                             // 2700:092a
    await X.RemoveEffect(sel(), 0x0F, null);                             // 2700:0940
    G.cure_InProgress = 0;                                               // 2700:0956
  }
}

// 2700:097B RemoveCurseService
async function RemoveCurseService() {
  let ok = 'Y', cursed = false;                                          // 2700:0982 / 0987
  for (let it = sel().items; it && !cursed; it = it.next)                // 2700:0990 .. 09bd
    if (it.b[0x36] !== 0) cursed = true;
  if (!cursed && !await X.HasEffect(sel(), 0x24, { v: null })) ok = await ConfirmNeedless('is not cursed.');   // 2700:09ce .. 09fe
  if (ok === 'Y' && await PayForCure(3500, 'Remove Curse') === 'Y') {    // 2700:0a05 .. 0a2d
    if (!Array.isArray(G.SpellTargets)) G.SpellTargets = [];
    G.SpellTargets[1] = sel();                                           // 2700:0a2f .. 0a38
    await X.Spell_RemoveCurse();                                         // 2700:0a3c
  }
}

// 2700:0A63 StoneToFlesh
async function StoneToFlesh() {
  let ok = 'Y';                                                          // 2700:0a6a
  if (sel().b[0x195] !== 7) ok = await ConfirmNeedless('is not stoned.');   // 2700:0a74 .. 0a91
  if (ok === 'Y' && await PayForCure(2000, 'Stone to Flesh') === 'Y' && sel().b[0x195] === 7) {   // 2700:0a98 .. 0ac2
    sel().b[0x195] = 0; sel().b[0x196] = 1; setHp(sel(), 1);             // 2700:0ace / 0ad8 / 0ae2
  }
}

// 2700:0B12 HealMenu
export async function HealMenu() {
  let done = false;
  const L = { v: null }; NewMenuList(L, 10);                             // 2700:0b22 / 0b2d (11 lines)
  let k = 1;                                                             // 2700:0b46
  for (let p = L.v; p; p = p.next) { p.text = dsPstr(0x00BB + k * 0x29); p.isHeader = 0; k++; }   // 2700:0b4a .. 0b83
  ClearTextRectangle(0, 0x18, 0x27, 0x18);                               // 2700:0b99
  const redraw = { v: true }, idx = { v: 0 }, item = { v: null };       // 2700:0baa
  FrameWithTextBar();                                                    // 2700:0bae FUN_01A0_0252
  do {
    DrawText(1, 1, 15, 0, pstr(sel().b, 0) + ', how can we help you?'); // 2700:0bb3 .. 0bed
    const key = await VerticalListMenu('', 'Heal Exit', 13, 10, 15, 2, 4, 0x26, 0x0F, L.v, false, redraw, idx, item);   // 2700:0c10
    if (key === 'H' || key === '\r') {                                   // 2700:0c45 / 0c50
      switch (idx.v) {                                                   // 2700:0c53 .. 0cd3
        case 0: await CureBlindness(); break;
        case 1: await CureDisease(); break;
        case 2: await CureWounds(1); break;
        case 3: await CureWounds(2); break;
        case 4: await CureWounds(3); break;
        case 5: await CureWounds(4); break;
        case 6: await NeutralizePoison(); break;
        case 7: await RaiseDead(); break;
        case 8: await RemoveCurseService(); break;
        case 9: await StoneToFlesh(); break;
        case 10: done = true; break;
      }
    } else if (key === '\0') done = true;                                // 2700:0cdb / 0cdf
  } while (!done);                                                       // 2700:0ce3
  FreeMenuList(L);                                                       // 2700:0cec
  await X.RedrawCurrentMode();                                           // 2700:0cf6
  await X.PartySummary(sel());                                           // 2700:0cfb
}

// 2700:0DD6 Temple
export async function Temple() {
  G.view_Mode = 1;                                                       // 2700:0ddc
  G.g_8B54 = view.mem(0x4BE6) === 0 ? 1 : 0;                             // 2700:0de1 .. 0df3
  await X.RedrawCurrentMode();                                           // 2700:0df6
  G.g_8B54 = 1;                                                          // 2700:0dfb
  await X.PartySummary(sel());                                           // 2700:0e00
  G.TreasureMoney = [0, 0, 0, 0, 0, 0, 0];                               // 2700:0e0d FillChar(TreasureMoney, $1C, 0): 7 LongInts
  G.PoolHasMoney = 0;                                                    // 2700:0e1e
  let done = false;
  do {
    const money = { v: 0 }, items = { v: 0 };
    await X.TreasurePoolStatus(money, items);                            // 2700:0e27
    const opts = money.v ? 'Heal View Take Pool Share Appraise Exit' : 'Heal View Pool Appraise Exit';   // 2700:0e36 / 0e51
    const m = await HorizontalMenu('', opts, 13, 10, 15, true, false);   // 2700:0e8c
    const key = m.key, ext = { v: m.ext };
    const changed = { v: 0 };
    switch (key) {                                                       // 2700:0e94
      case 'H': if (!ext.v) await HealMenu(); break;                     // 2700:0e9b / 0ea2
      case 'V': await X.ViewMenu(ext); break;                            // 2700:0eb1
      case 'T': await X.TakeMoney(); break;                              // 2700:0ebd
      case 'P': if (!ext.v) await X.PoolMoney(); break;                  // 2700:0ec9 / 0ecf
      case 'S': await X.ShareMoney(); break;                             // 2700:0edb
      case 'A': await X.AppraiseGems(changed); break;                    // 2700:0eec
      case 'E': {                                                        // 2700:0ef4
        const mo = { v: 0 }, it = { v: 0 };
        await X.TreasurePoolStatus(mo, it);                              // 2700:0f05
        if (!mo.v) done = true;                                          // 2700:0f0a / 0fc2
        else {
          await DrawWrappedText(1, 0x11, 0x26, 0x16, 10, 0, 1, 'As you leave a priest says, "Excuse me but you have left some money here" ');   // 2700:0f4a
          await DrawWrappedText(1, 0x11, 0x26, 0x16, 10, 0, 1, 'Do you want to go back and retrieve your money?');   // 2700:0f73
          if (await X.MenuSelect('', '~Yes ~No', 13, 10, 15, 0, 0) === 1) done = true;   // 2700:0f9b / 0fa3 1 = "No": leave
          else ClearTextRectangle(1, 0x11, 0x26, 0x16);                  // 2700:0fbb
        }
        break;
      }
      case 'G': case 'O': await X.CycleSelectedChar(key); break;         // 2700:0fd0 / 0fdf
    }
    if (key === 'B' || key === 'T') await X.RedrawCurrentMode();         // 2700:0fe4 .. 0fef
    else if (key === 'A' && changed.v) await X.RedrawCurrentMode();      // 2700:0ff6 .. 1000
    await X.PartySummary(sel());                                         // 2700:100d
  } while (!done);                                                       // 2700:1012
}

// 2700:0000 ov04_LoadDeps / 2700:101F ov04_init: empty.
