// game/areas/party_ov06.js — PARTY ov06 (2B00): the shop (Pool ov06 3E00).
// Owner: cab-build-areas. Source: decode/pseudo/PARTY.pas.md ## ov06; structure as Pool's areas/party_ov06-style shop code.
// Caution rule 2 — the Shop menu loop re-read from decode/listings/ov06.lst (2b00:06f6..096c):
//  - HorizontalMenu(prompt '', opts, 0Dh, 0Ah, 0Fh, allowExt 1, animate 0, var ext) (2b00:07e9); the case runs on the
//    returned character only — ext is tested for 'P' alone (2b00:0820), so Del / F8 / F7 (scan 53h 'S', 42h 'B', 41h 'A')
//    act like the letters, and Home / End (47h 'G' / 4Fh 'O') reach CycleSelectedChar as well as the plain letters.
//  - Exit with money in the pool: the options string '~Yes ~No' is assigned before the two DrawWrappedText calls, then
//    MenuSelect(prompt, '~Yes ~No', 0Dh, 0Ah, 0Fh, 0, 0) (2b00:08e9); result 1 (No) leaves (money in the pool is lost).
//  - After the case: 'B' or 'T' -> RedrawCurrentMode; 'A' with `appraised` -> RedrawCurrentMode; PartySummary always.
// Shop price factor: VM word 7F6D (ecl_Mem7C00^.w[6DAh div 2]). Item record: +0 name string[40], +2Ah next, +3Ah value.

import { G, rdW, wrW } from '../engine/state.js';
import { DrawWrappedText, ClearTextRectangle, DrawScreenFrame } from '../engine/text.js';
import { HorizontalMenu, VerticalListMenu } from './view_ov26.js';
import { view } from './view_ov30.js';
import { MoneyValueInGold, SetCharMoneyGold, SetPoolMoneyGold, TreasurePoolStatus, TakeMoney, PoolMoney, ShareMoney,
  AppraiseGems, IT } from './party_ov21.js';
import { X } from './view_link.js';

const word = (v) => v & 0xFFFF;
const value = (it) => rdW(it.b, IT.value);
const nameOf = (it) => { let s = ''; for (let i = 1; i <= it.b[0]; i++) s += String.fromCharCode(it.b[i]); return s; };

const FACTORS = [1, 2, 4, 8, 0x20, 0x40, 0x80];
// price scaled by the shop factor VM word 7F6D (ShopItemsMenu 2b00:0093 .. 01bd, ShopBuy 2b00:04cc .. 0573)
function shopPrice(it) {
  const v = value(it);
  switch (view.mem(0x7F6D)) {
    case 1: return v >>> 4;
    case 2: return v >>> 3;
    case 4: return v >>> 2;
    case 8: return v >>> 1;
    case 0x20: return v * 2;
    case 0x40: return v * 4;
    case 0x80: return v * 8;
    default: return v;
  }
}

// 2B00:0050 ShopItemsMenu(var key, var chosen, var cur, var index)
async function ShopItemsMenu(key, chosen, cur, index) {
  for (let item = G.TreasureItems; item; item = item.next) {             // 2b00:0056 / 0062
    const line = new Array(30).fill(' ');                                // 2b00:006d string[30]
    if (value(item) === 0) wrW(item.b, IT.value, 1);                     // 2b00:0080 quirk: written into the item
    const num = String(shopPrice(item));                                 // 2b00:0093 .. 01bd Str(LongInt(..))
    for (let k = 1; k <= num.length; k++) line[30 - num.length + k - 1] = num[k - 1];   // 2b00:01d9
    const name = nameOf(item);
    for (let k = 1; k <= name.length; k++) line[k - 1] = name[k - 1];    // 2b00:021b quirk: > 30 characters overwrite the price
    item.b[0] = 30; for (let k = 0; k < 30; k++) item.b[1 + k] = line[k].charCodeAt(0) & 0xFF;   // 2b00:025d name[0] := Chr(30)
  }
  const list = G.TreasureItems;                                          // 2b00:0289
  G.menu_Sel = 0;                                                        // 2b00:0295
  const redraw = { v: !!G.g_47EE };
  key.v = await VerticalListMenu('Items: ', 'Buy', 0x0D, 0x0A, 0x0F, 1, 1, 0x26, 0x16, list, true, redraw, index, cur);   // 2b00:029a
  G.g_47EE = redraw.v ? 1 : 0;
  chosen.v = cur.v;                                                      // 2b00:02ea
  for (let item = G.TreasureItems; item; item = item.next) await X.BuildItemName(null, item, 0, 0, false, false);   // 2b00:030e / 0316
}

// 2B00:0355 AddItemToChar(item, var failed)
export async function AddItemToChar(item, failed) {
  const c = G.SelectedChar;
  if (await X.ItemOverloads(c, item)) {                                  // 2b00:0355
    await X.ShowTimedBottomMessage('OverLoaded');                        // 2b00:0372
    failed.v = true; return;                                             // 2b00:0386 / 038d
  }
  failed.v = false;                                                      // 2b00:0390
  const q = { b: new Uint8Array(item.b), next: null };                   // GetMem($3F); q^ := item^; q^.next := nil
  let p = c.items;                                                       // 2b00:0397 +14Dh
  if (!p) c.items = q;                                                   // 2b00:03b0 .. 03d1
  else { while (p.next) p = p.next; p.next = q; }                        // 2b00:03f3 .. 0432
  await X.RecalcItems(c);                                                // 2b00:044f
}

// 2B00:0474 ShopBuy
async function ShopBuy() {
  const key = { v: '\0' }, chosen = { v: null }, cur = { v: G.TreasureItems }, index = { v: 0 };   // 2b00:047a / 0482 / 048e
  DrawScreenFrame(); G.g_47EE = 1;                                       // 2b00:0493 / 0498
  let leave;
  // [BP-8] price: assigned only for the factors 1, 2, 4, 8, 20h, 40h, 80h (2b00:04cc .. 0570; no default branch, unlike
  // the list's display 2b00:01bd). Otherwise it keeps the stack residue: ShopBuy is far-called from Shop's loop, so
  // [BP-8] = Shop's SP - 0Eh = the 5th word pushed for Shop's HorizontalMenu(prompt, opts, 0Dh, 0Ah, 0Fh, ...) at
  // 2b00:07d5..07e9 (PUSH CS; CALL 0474 -> PUSH BP: BP = SP - 6), i.e. 0Fh (pushed as AX after MOV AL,0Fh: the high byte
  // is AH's residue, 0 in the DOSBox run); the local keeps its last value over the purchases of this call. DOSBox walk3 (factor 10h,
  // the weapon shop ECL2/1 83F8): battle axe 5 + hand axe 1 cost 2 x 15 gold (290 -> 284 platinum).
  let price = 0x0F;
  do {
    await ShopItemsMenu(key, chosen, cur, index);                        // 2b00:049d
    if (key.v !== 'B' && key.v !== '\r') leave = true;                   // 2b00:04b5
    else {
      leave = false;
      if (FACTORS.includes(view.mem(0x7F6D))) price = word(shopPrice(chosen.v));   // 2b00:04cc .. 0573 word
      const gold = word(await X.MoneyInGold(G.SelectedChar));            // 2b00:0573 low word only (quirk)
      const failed = { v: false };
      if (price <= gold) {
        await AddItemToChar(chosen.v, failed);                           // 2b00:058b
        if (!failed.v) SetCharMoneyGold(gold - price);                   // 2b00:059a / 05a0
      } else {
        const pool = MoneyValueInGold(G.TreasureMoney || [0, 0, 0, 0, 0, 0, 0]);   // 2b00:05b3
        if (price <= pool) {
          await AddItemToChar(chosen.v, failed);                         // 2b00:05d4
          if (!failed.v) SetPoolMoneyGold(word(pool - price));           // 2b00:05e9
        } else await X.ShowTimedBottomMessage('Not enough Money.');      // 2b00:060b
      }
    }
  } while (!leave);                                                      // 2b00:060e
}

// 2B00:06F6 Shop
export async function Shop() {
  G.view_Mode = 1;                                                       // 2b00:06fd
  G.g_8B54 = view.mem(0x4BE6) === 0 ? 1 : 0;                             // 2b00:0702 .. 0714
  await X.RedrawCurrentMode();                                           // 2b00:0717
  G.g_8B54 = 1;                                                          // 2b00:071c
  await X.PartySummary(G.SelectedChar);                                  // 2b00:0729
  G.TreasureMoney = [0, 0, 0, 0, 0, 0, 0];                               // 2b00:073a FillChar(TreasureMoney, 1Ch, 0)
  const prompt = ''; G.PoolHasMoney = 0; let leave = false;
  const appraised = { v: false };                                        // [BP-32h], kept across passes              // 2b00:073f / 0743 / 0748
  for (let item = G.TreasureItems; item; item = item.next) await X.BuildItemName(null, item, 0, 0, false, false);   // 2b00:074c / 0778
  do {
    const hasMoney = { v: false }, hasItems = { v: false };
    TreasurePoolStatus(hasMoney, hasItems);                              // 2b00:0798
    const opts = hasMoney.v ? 'Buy View Take Pool Share Appraise Exit' : 'Buy View Pool Appraise Exit';   // 2b00:079d / 07b8
    const m = await HorizontalMenu(prompt, opts, 0x0D, 0x0A, 0x0F, true, false);   // 2b00:07e9
    const key = m.key, ext = { v: m.ext };
    switch (key) {
      case 'B': await ShopBuy(); break;                                  // 2b00:07f9
      case 'V': await X.ViewMenu(ext); break;                            // 2b00:0808 quirk: ext passed as turnUsed
      case 'T': await TakeMoney(); break;                                // 2b00:0814
      case 'P': if (!ext.v) PoolMoney(); break;                          // 2b00:0820 / 0826
      case 'S': await ShareMoney(); break;                               // 2b00:0832
      case 'A': await AppraiseGems(appraised); break;                    // 2b00:0843
      case 'E': {                                                        // 2b00:084b
        TreasurePoolStatus(hasMoney, hasItems);                          // 2b00:085c
        if (!hasMoney.v) leave = true;                                   // 2b00:0861 / 0910
        else {
          const yesNo = '~Yes ~No';                                      // 2b00:086a
          await DrawWrappedText(1, 0x11, 0x26, 0x16, 0x0A, 0, 1,
            'As you Leave the Shopkeeper says, "Excuse me but you have Left Some Money here."  ');   // 2b00:08a2
          await DrawWrappedText(1, 0x11, 0x26, 0x16, 0x0F, 0, 0, 'Do you want to go back and get your Money?');   // 2b00:08cb
          if (await X.MenuSelect(prompt, yesNo, 0x0D, 0x0A, 0x0F, 0, 0) === 1) leave = true;   // 2b00:08e9 / 08f1 1 = No
          else ClearTextRectangle(1, 0x11, 0x26, 0x16);                  // 2b00:0909
        }
        break;
      }
      case 'G': case 'O': await X.CycleSelectedChar(key); break;         // 2b00:091e / 092d
    }
    if (key === 'B' || key === 'T') await X.RedrawCurrentMode();         // 2b00:0932 .. 093d
    else if (key === 'A' && appraised.v) await X.RedrawCurrentMode();    // 2b00:0944 .. 094e
    await X.PartySummary(G.SelectedChar);                                // 2b00:095b
  } while (!leave);                                                      // 2b00:0960
}

// 2B00:0000 ov06_0000 / 2B00:096D ov06_init: empty.
