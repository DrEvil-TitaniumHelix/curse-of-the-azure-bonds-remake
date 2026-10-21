// game/areas/party_ov21.js — PARTY ov21 (5500): encumbrance, coins, treasure-pool money, number input, random treasure
// items, gem / jewel appraisal (Pool ov21 8900).
// Owner: cab-build-areas. Source: decode/pseudo/PARTY.pas.md ## ov21 (22 routines paired with Pool, re-checked against the
// Curse asm); structure as Pool's areas/party_ov21.js. Re-read from decode/listings/ov21.lst:
//  - MakeTreasureItem (5500:0fed, ~2.4 KB): the magic-item record copy reads WORDS of MagicItemTable at DS:082C +
//    2*(rec + k) (5500:180d `MOV DL,[DI+82Ch]` with DI = (k + rec)*2) — names k = 0..2 into +2Fh..+31h, weight rec+3,
//    value rec+4, powers rec+5..rec+7 into +3Ch..+3Eh. The weight / value case tables (5500:127b .. 159d) are Pool's
//    (PARTY.pas.md: constant-level diff identical); javelin special = record 31h (Pool 90h).
//  - CoinName is string[10] at DS:0F93 + 11*k (image: Copper Silver Electrum Gold Platinum Gems Jewelry).
// Records: money[k] word +FBh+2k (copper .. platinum, gems +105h, jewelry +107h), encumbrance word +187h, item_count
// +14Ch, items +14Dh (c.items), npc_morale +F7h, next +189h (c.next). TreasureMoney DS:6F70 = G.TreasureMoney[0..6]
// (LongInt), TreasureItems DS:6F8C = G.TreasureItems (item list), PoolHasMoney DS:7564.
// Item record (63 bytes): +0 name string[40], +2Eh type, +2Fh..+31h word[1..3], +32h plus, +33h plus2, +34h readied,
// +35h hidden, +36h cursed, +37h weight (word), +39h count, +3Ah value (word), +3Bh+k power[k] (k = 1..3).

import { G, newItem, rdW, wrW } from '../engine/state.js';
import { DrawText, ClearGlyphRun, ClearTextRectangle, DrawScreenFrame } from '../engine/text.js';
import { ReadGameKey } from '../engine/input.js';
import { Random } from '../engine/tp.js';
import { HorizontalMenu, VerticalListMenu, FreeMenuList } from './view_ov26.js';
import { X } from './view_link.js';

export const IT = { next: 0x2A, type: 0x2E, word: 0x2E /* +k, k = 1..3 */, plus: 0x32, plus2: 0x33, readied: 0x34,
  hidden: 0x35, cursed: 0x36, weight: 0x37, count: 0x39, value: 0x3A, power: 0x3B /* +k, k = 1..3 */ };
const MONEY = 0xFB, ENC = 0x187, ITEMCOUNT = 0x14C, MORALE = 0xF7;
const word = (v) => v & 0xFFFF;
const money = (c, k) => rdW(c.b, MONEY + 2 * k);
const setMoney = (c, k, v) => wrW(c.b, MONEY + 2 * k, word(v));
const enc = (c) => rdW(c.b, ENC);
const TM = () => { if (!Array.isArray(G.TreasureMoney)) G.TreasureMoney = [0, 0, 0, 0, 0, 0, 0]; return G.TreasureMoney; };
const COIN_VALUE = [1, 10, 100, 200, 1000];              // CoinValue DS:0CA2 (LongInt)
const coinValue = (k) => (G.ds ? (G.ds[0xCA2 + 4 * k] | (G.ds[0xCA3 + 4 * k] << 8) | (G.ds[0xCA4 + 4 * k] << 16)) : COIN_VALUE[k]);
const COIN_NAME = ['Copper', 'Silver', 'Electrum', 'Gold', 'Platinum', 'Gems', 'Jewelry'];
export function CoinName(k) {                            // DS:0F93 + 11*k, string[10]
  if (!G.ds) return COIN_NAME[k];
  const a = 0xF93 + 11 * k; let s = ''; for (let i = 1; i <= G.ds[a]; i++) s += String.fromCharCode(G.ds[a + i]);
  return s;
}
const inRange = (v, lo, hi) => v >= lo && v <= hi;
const roll = async (n, s) => (await X.Roll(n, s)) & 0xFF;

// 5500:001B MaxCarryWeight(c)
export async function MaxCarryWeight(c) { return word((await X.StrWeightAllowance(c)) + 1500); }   // 5500:0021

// 5500:003B SubEncumbrance(c, amount) / 5500:0057 AddEncumbrance(c, amount)
export function SubEncumbrance(c, amount) { wrW(c.b, ENC, word(enc(c) - amount)); }   // 5500:003e
export function AddEncumbrance(c, amount) { wrW(c.b, ENC, word(enc(c) + amount)); }   // 5500:005a

// 5500:0073 WouldOverload(c, amount, var room)
export async function WouldOverload(c, amount, room) {
  if (enc(c) + word(amount) > await MaxCarryWeight(c)) {                 // 5500:0079 unsigned
    room.v = word(await MaxCarryWeight(c) - enc(c));                     // 5500:0098
    return true;                                                         // 5500:0094
  }
  room.v = 0;                                                            // 5500:00b6
  return false;                                                          // 5500:00b2
}

// 5500:00C7 MoneyValueInGold(money[0..6]): LongInt (gems / jewelry not counted)
export function MoneyValueInGold(m) {
  let sum = 0;                                                           // 5500:00e0
  for (let k = 0; k <= 4; k++) sum = (sum + m[k] * coinValue(k)) | 0;    // 5500:00f1
  return Math.trunc((sum + 100) / coinValue(3));                         // 5500:0121 rounded to gold
}

// 5500:0149 SetCharMoneyGold(gold)
export function SetCharMoneyGold(gold) {
  const c = G.SelectedChar;
  for (let k = 0; k <= 4; k++) setMoney(c, k, 0);                        // 5500:014f
  setMoney(c, 4, Math.trunc(word(gold) / 5));                            // 5500:0171 platinum
  setMoney(c, 3, word(gold) % 5);                                        // 5500:0184 gold (quirk: encumbrance not updated)
}

// 5500:019E SetPoolMoneyGold(gold)
export function SetPoolMoneyGold(gold) {
  const t = TM();
  for (let k = 0; k <= 4; k++) t[k] = 0;                                 // 5500:01a4
  t[4] = Math.trunc(word(gold) / 5);                                     // 5500:01c7
  t[3] = word(gold) % 5;                                                 // 5500:01da
}

// 5500:021C AddPlatinumOrPool(n)
export async function AddPlatinumOrPool(n) {
  const c = G.SelectedChar, room = { v: 0 };
  if (await WouldOverload(c, n, room)) {                                 // 5500:0222
    await X.ShowTimedBottomMessage('Overloaded.  Money will be put in Pool.');   // 5500:023a
    setMoney(c, 4, money(c, 4) + room.v);                                // 5500:024e
    AddEncumbrance(c, room.v);                                           // 5500:025a
    TM()[4] = word(n) + TM()[4] - room.v;                                // 5500:0269
  } else {
    setMoney(c, 4, money(c, 4) + word(n));                               // 5500:028c
    AddEncumbrance(c, n);                                                // 5500:0298
  }
}

// 5500:02AD InputNumber(max, prompt, colour): Word
export async function InputNumber(max, prompt, colour) {
  const p = String(prompt).slice(0, 40);                                 // 5500:02b4
  ClearGlyphRun(0, 24, 0, 40);                                           // 5500:02c7
  DrawText(0, 24, colour, 0, p);                                         // 5500:02d8
  const len = p.length; let col = len;                                   // 5500:02ef
  const maxStr = String(word(max)).slice(0, 5);                          // 5500:02fb
  let num = '', k;                                                       // 5500:0313
  do {
    k = await ReadGameKey();                                             // 5500:0317
    if (k >= '0' && k <= '9') {                                          // 5500:031f
      num = (num + k).slice(0, 6);                                       // 5500:0330 string[6]
      const v = parseInt(num, 10);                                       // 5500:0362 Val (LongInt)
      if (v <= word(max)) col++;                                         // 5500:0377
      else { num = maxStr; col = len + maxStr.length; }                  // 5500:038d / 03a0 clamp to max
      DrawText(len, 24, 0x0F, 0, num);                                   // 5500:03b1
    } else if (k === '\b' && num.length > 0) {                           // 5500:03ca
      num = num.slice(0, num.length - 1);                                // 5500:03d4
      ClearGlyphRun(col, 24, 0, 1);                                      // 5500:03fd quirk: blanks the cell after the last digit
      col--;                                                             // 5500:040f
    }
  } while (k !== '\r' && k !== '\x1b');                                  // 5500:0412
  ClearGlyphRun(0, 24, 0, 40);                                           // 5500:0421
  if (k === '\x1b') return 0;                                            // 5500:0432
  return word(num === '' ? 0 : parseInt(num, 10));                       // 5500:043f low word (Val of '' = 0)
}

// 5500:046B TransferCoins(var src, var dst, amount, coin)
export async function TransferCoins(src, dst, amount, coin) {
  const s = src.v ?? src, d = dst.v ?? dst;
  if (enc(d) + word(amount) <= await MaxCarryWeight(d)) {                // 5500:0471
    setMoney(s, coin, money(s, coin) - amount);                          // 5500:0493
    SubEncumbrance(s, amount);                                           // 5500:04be
    setMoney(d, coin, money(d, coin) + amount);                          // 5500:04cf
    AddEncumbrance(s, amount);                                           // 5500:04fa quirk: src again, not dst
  } else await X.ShowTimedBottomMessage('Overloaded');                   // 5500:050d
}

// 5500:0527 PoolMoney
export function PoolMoney() {
  G.PoolHasMoney = 1;                                                    // 5500:0539
  for (let p = G.PartyList; p; p = p.next) {                             // 5500:053e
    if (p.b[MORALE] === 0 || p.b[MORALE] === 0xB3) {                     // 5500:0549 PCs and animated dead
      for (let k = 0; k <= 6; k++) {                                     // 5500:0562
        TM()[k] = TM()[k] + money(p, k);                                 // 5500:0571
        SubEncumbrance(p, money(p, k));                                  // 5500:05ad
      }
      p.b.fill(0, MONEY, MONEY + 14);                                    // 5500:05cd
    }
  }
}

// 5500:05F9 CountMoneySharers: Byte
export function CountMoneySharers() {
  let n = 0;                                                             // 5500:05ff
  for (let p = G.PartyList; p; p = p.next) if (p.b[MORALE] === 0 || p.b[MORALE] === 0xB3) n++;   // 5500:0617
  return n & 0xFF;                                                       // 5500:0642
}

// 5500:064F ShareMoney
export async function ShareMoney() {
  let p = G.PartyList;                                                   // 5500:0655
  const n = CountMoneySharers();                                         // 5500:0665
  const share = [0, 0, 0, 0, 0, 0, 0], rest = [0, 0, 0, 0, 0, 0, 0];     // 5500:066c FillChar
  const room = { v: 0 };
  for (let k = 0; k <= 6; k++) {                                         // 5500:068e
    if (TM()[k] > 0) {                                                   // 5500:06a1
      if (n === 0) throw new Error('Runtime error 200 (division by zero) in ShareMoney 5500:06b1');   // quirk: no sharer
      share[k] = word(Math.trunc(TM()[k] / n));                          // 5500:06b1
      rest[k] = word(TM()[k] % n);                                       // 5500:06de
    } else { share[k] = 0; rest[k] = 0; }                                // 5500:0711
  }
  while (p) {                                                            // 5500:0734 pass 1
    if (p.b[MORALE] < 0x80) {                                            // 5500:073f quirk: other test than CountMoneySharers
      for (let k = 6; k >= 0; k--) {                                     // 5500:074d
        if (!await WouldOverload(p, share[k], room)) {                   // 5500:0756
          setMoney(p, k, money(p, k) + share[k]);                        // 5500:0777
          AddEncumbrance(p, share[k]);                                   // 5500:07a6
          if (rest[k] > 0)                                               // 5500:07bb
            if (!await WouldOverload(p, 1, room)) {                      // 5500:07c9 (Curse: tests the 1 it adds)
              setMoney(p, k, money(p, k) + 1);                           // 5500:07e0
              AddEncumbrance(p, 1);                                      // 5500:0803
              rest[k] = word(rest[k] - 1);                               // 5500:0811
            }
        } else {
          setMoney(p, k, money(p, k) + room.v);                          // 5500:081e takes what fits
          rest[k] = word(share[k] + rest[k] - room.v);                   // 5500:0843
          AddEncumbrance(p, room.v);                                     // 5500:086b
        }
      }
    }
    p = p.next;                                                          // 5500:0881
  }
  for (let k = 6; k >= 0; k--) {                                         // 5500:0894 pass 2
    if (rest[k] > 0) {                                                   // 5500:089d
      for (p = G.PartyList; p; p = p.next) {                             // 5500:08ae
        const r = word(await MaxCarryWeight(p) - enc(p));                // 5500:08c5
        if (r > 0) {                                                     // 5500:08da unsigned
          if (rest[k] > r) {                                             // 5500:08e3
            setMoney(p, k, money(p, k) + r);                             // 5500:08f3
            AddEncumbrance(p, r);                                        // 5500:0918
            rest[k] = word(rest[k] - r);                                 // 5500:0925
          } else {
            setMoney(p, k, money(p, k) + rest[k]);                       // 5500:0942
            AddEncumbrance(p, rest[k]);                                  // 5500:0971
            rest[k] = 0;                                                 // 5500:0986
          }
        }
      }
    }
  }
  G.PoolHasMoney = 0;                                                    // 5500:09af
  for (let k = 0; k <= 6; k++) {                                         // 5500:09b4
    TM()[k] = rest[k];                                                   // 5500:09bd
    if (TM()[k] !== 0) G.PoolHasMoney = 1;                               // 5500:09e0
  }
}

// 5500:0A03 DropCoinsToPool(c, amount, coin)
export function DropCoinsToPool(c, amount, coin) {
  setMoney(c, coin, money(c, coin) - amount);                            // 5500:0a06
  SubEncumbrance(c, amount);                                             // 5500:0a2b
  if (G.view_Mode === 6 || G.view_Mode === 1) TM()[coin] = TM()[coin] + word(amount);   // 5500:0a38 / 0a46 else lost
}

// 5500:0A8A TakeCoins(c, amount, coin)
export async function TakeCoins(c, amount, coin) {
  const room = { v: 0 };
  if (await WouldOverload(c, amount, room)) await X.ShowTimedBottomMessage('Overloaded');   // 5500:0a90 / 0aa6 no partial take
  else {
    if (word(amount) > TM()[coin]) amount = word(TM()[coin]);            // 5500:0abd low word
    TM()[coin] = TM()[coin] - word(amount);                              // 5500:0aed
    setMoney(c, coin, money(c, coin) + amount);                          // 5500:0b20
    AddEncumbrance(c, amount);                                           // 5500:0b45
  }
}

// 5500:0B91 CoinFromText(text, var coinName): ShortInt
export function CoinFromText(text, coinName) {
  const t = String(text);                                                // 5500:0b98
  let i = 1; while (t[i - 1] === ' ') i++;                               // 5500:0bac
  let result = 0;                                                        // TODO(decode): other first letters return the uninitialised local [bp-1]
  switch (t[i - 1]) {                                                    // 5500:0bc6
    case 'G':
      if ((t[i] ?? '').toUpperCase() === 'E') { result = 5; coinName.v = 'Gems '; }   // 5500:0bd6
      else { coinName.v = 'Gold '; result = 3; }                         // 5500:0c06
      break;
    case 'P': coinName.v = 'Platinum '; result = 4; break;               // 5500:0c20
    case 'E': coinName.v = 'electrum '; result = 2; break;               // 5500:0c3d
    case 'S': coinName.v = 'silver '; result = 1; break;                 // 5500:0c5a
    case 'C': coinName.v = 'Copper '; result = 0; break;                 // 5500:0c77
    case 'J': coinName.v = 'Jewelry '; result = 6; break;                // 5500:0c94
  }
  return result;                                                         // 5500:0caf
}

// 5500:0CF0 TakeMoney
export async function TakeMoney() {
  DrawScreenFrame();                                                     // 5500:0cf7
  const index = { v: 0 };                                                // 5500:0cfc
  let done;
  do {
    const redraw = { v: true }; let list = null;                         // 5500:0d01
    for (let k = 6; k >= 0; k--) {                                       // 5500:0d16
      if (TM()[k] > 0) {                                                 // 5500:0d1f
        const prev = list;                                               // 5500:0d4f / 0d67 prepend: copper ends up first
        list = { text: '', isHeader: 0, next: prev };
        list.text = (CoinName(k) + ' ' + String(TM()[k])).slice(0, 40);  // 5500:0d90 / 0db4
        list.isHeader = 0;                                               // 5500:0df3
      }
    }
    const item = { v: list }, head = list;                               // 5500:0e04
    const key = await VerticalListMenu('Select type of coin ', 'Select', 0x0D, 0x0A, 0x0F,
      2, 2, 0x0F, 8, list, true, redraw, index, item);                   // 5500:0e1a
    if (!item.v || key === '\0') done = true;                            // 5500:0e71 quirk: the list is not freed
    else {
      done = false;                                                      // 5500:0e88
      const s = { v: '' };
      const coin = CoinFromText(item.v.text, s);                         // 5500:0e8d
      const prompt = 'How much ' + s.v + 'will you take? ';              // 5500:0e9f
      const amount = await InputNumber(word(TM()[coin]), prompt, 0x0A);  // 5500:0ed3 max = low word of the pool amount
      await TakeCoins(G.SelectedChar, amount, coin);                     // 5500:0ef2
      FreeMenuList({ v: head });                                         // 5500:0f06
      G.PoolHasMoney = 0; done = true;                                   // 5500:0f10
      for (let k = 0; k <= 6; k++) if (TM()[k] > 0) { G.PoolHasMoney = 1; done = false; }   // 5500:0f1a / 0f23
    }
  } while (!done);                                                       // 5500:0f4d
}

// 5500:0F5B TreasurePoolStatus(var hasMoney, var hasItems)
export function TreasurePoolStatus(hasMoney, hasItems) {
  hasMoney.v = false; hasItems.v = false;                                // 5500:0f61
  for (let k = 0; k <= 6; k++) if (TM()[k] !== 0) hasMoney.v = true;     // 5500:0f78
  if (G.TreasureItems) hasItems.v = true;                                // 5500:0f99
}

// 5500:0FAF RollMagicPlus: Byte (no +3 in Curse)
export async function RollMagicPlus() {
  const r = await roll(1, 20);                                           // 5500:0fb5
  if (inRange(r, 1, 14)) return 1;                                       // 5500:0fc3 70 %
  if (inRange(r, 15, 20)) return 2;                                      // 5500:0fd8 30 %
  return 0;                                                              // unreachable (Roll is 1..20)
}

// weight table of MakeTreasureItem 5500:127b .. 14b4 (Pool's, unchanged)
function weaponWeight(it, typ) {
  const W = (w) => wrW(it.b, IT.weight, w);
  if ([1, 13, 14, 35].includes(typ)) W(75);
  else if ([2, 20, 29, 31, 32, 33, 39, 42, 44, 46, 59].includes(typ)) W(50);
  else if ([3, 24, 40].includes(typ)) W(125);
  else if ([4, 15, 23, 34, 43, 45, 51].includes(typ)) W(100);
  else if ([5, 12, 17, 19, 50].includes(typ)) W(150);
  else if (typ === 6) W(15);
  else if (typ === 7) W(30);
  else if (typ === 8 || typ === 77) W(10);
  else if (typ === 9) { W(25); it.b[IT.count] = 5; }                    // darts
  else if ([10, 26, 36].includes(typ)) W(60);
  else if ([11, 16, 25, 27, 41, 47].includes(typ)) W(80);
  else if (typ === 18) W(175);
  else if (typ === 21) W(20);
  else if (typ === 22 || typ === 30) W(40);
  else if (typ === 37) W(35);
  else if (typ === 38 || typ === 53) W(250);
  else if (typ === 52) W(200);
  else if (typ === 54 || typ === 56) W(400);
  else if (typ === 55) W(300);
  else if (typ === 57) W(350);
  else if (typ === 58) W(450);
  else if (typ === 93) W(1);                                             // ring
  else { W(40); it.b[IT.count] = 10; }                                  // e.g. 28 quarrels, 73 arrows
}
const magicItem = (i) => (G.ds ? rdW(G.ds, 0x82C + 2 * i) : 0);          // MagicItemTable DS:082C (words)

// 5500:0FED MakeTreasureItem(typ, var it): `it` = item record { b, next } filled in place (returned for convenience)
export async function MakeTreasureItem(typ, it = newItem()) {
  typ &= 0xFF;
  const b = it.b;
  b.fill(0, 0, 63); let rec = 0;                                         // 5500:0ff3 / 1004
  b.fill(0, IT.power + 1, IT.power + 4); it.next = null;                 // 5500:1008 / 1026
  b[IT.readied] = 0; b[IT.hidden] = 6; b[IT.cursed] = 0;                 // 5500:1033 / 103b / 1043
  b[IT.type] = typ;                                                      // 5500:104b
  b.fill(0, IT.word + 1, IT.word + 4);                                   // 5500:1055
  const plus = () => b[IT.plus];
  const wd = (k, v) => { b[IT.word + k] = v & 0xFF; };
  if (inRange(typ, 1, 59) || typ === 73 || typ === 77 || typ === 93) {   // 5500:106a
    b[IT.plus] = await RollMagicPlus();                                  // 5500:108f
    switch (typ) {                                                       // 5500:109a
      case 21:                                                           // javelin
        if (await roll(1, 5) === 5) rec = 0x31;                          // 5500:10a8 / 10bc (Pool: misaligned 90h)
        wd(3, 0x15); wd(2, plus() + 0xA1);                               // 5500:10c0 / 10c8
        break;
      case 28: wd(3, 0x1C); wd(2, plus() + 0xA1); break;                 // 5500:10e2
      case 50: case 51: wd(3, typ); wd(2, 0x31); wd(1, plus() + 0xA1); b[IT.hidden] = 4; break;   // 5500:1109
      case 52: wd(3, typ); wd(2, 0x32); wd(1, plus() + 0xA1); b[IT.hidden] = 4; break;             // 5500:1141
      case 53: case 54: case 55: case 56: case 57: case 58:
        wd(3, typ); wd(2, 0x30); wd(1, plus() + 0xA1); b[IT.hidden] = 4; break;                    // 5500:117e
      case 73: wd(3, 0x3D); wd(2, plus() + 0xA1); break;                 // 5500:11b6
      case 77:                                                           // bracers
        wd(3, 0x4F); wd(2, 0xA7);                                        // 5500:11d8 / 11e0
        b[IT.plus] = (plus() * 2 + 2) & 0xFF;                            // 5500:11e8
        if (plus() === 4) wd(1, 0xDD);                                   // 5500:11fc / 1209
        else if (plus() === 6) wd(1, 0xDE);                              // 5500:1213 / 1218 (+8: no AC word, quirk)
        break;
      case 93: wd(3, 0x42); wd(2, 0xE0); wd(1, plus() + 0xA1); break;    // 5500:1227
      default: wd(3, typ); wd(2, plus() + 0xA1);                         // 5500:124b
    }
    b[IT.plus2] = 0; b[IT.count] = 0;                                    // 5500:126b / 1273
    weaponWeight(it, typ);                                               // 5500:127b
    const V = (v) => wrW(b, IT.value, word(v));                          // 5500:14c5 .. 159d
    if (typ === 59) V(plus() * 2500);                                    // shield
    else if (typ === 73 || typ === 28) V(plus() * 150);
    else if (typ === 53 || typ === 54) V(plus() * 3000);
    else if (typ === 55 || typ === 56) V(plus() * 3500);
    else if (typ === 57) V(plus() * 4000);
    else if (typ === 58) V(plus() * 5000);
    else if (typ === 77) V(plus() * 3000);                               // bracers
    else V(plus() * 2000);
  } else if (typ === 61 || typ === 62) {                                 // 5500:15b4 scrolls
    const n = await roll(1, 3);                                          // 5500:15c1
    wd(3, typ === 61 ? 0xD1 : 0xD0);                                     // 5500:15cf / 15d9 / 15e3
    wd(2, n + 0xD1); wd(1, 0); b[IT.plus] = 1;                           // 5500:15eb / 15fa / 1602
    wrW(b, IT.weight, 25); b[IT.count] = 0; wrW(b, IT.value, 0);         // 5500:160a / 1613 / 161b
    for (let k = 1; k <= n; k++) {                                       // 5500:1624
      const lvl = await roll(1, 5);                                      // 5500:163c spell level 1..5
      let sp = 0;
      if (typ === 61) {                                                  // 5500:164a magic-user
        if (lvl === 1) sp = (await roll(1, 13)) + 8;                     // 5500:1657
        else if (lvl === 2) sp = (await roll(1, 7)) + 28;                // 5500:1676
        else if (lvl === 3) sp = (await roll(1, 11)) + 44;               // 5500:1690
        else if (lvl === 4) sp = (await roll(1, 9)) + 0x50;              // 5500:16aa
        else if (lvl === 5) sp = (await roll(1, 4)) + 0x5A;              // 5500:16c4
      } else {                                                           // 5500:16df cleric
        if (lvl === 1) sp = await roll(1, 8);                            // 5500:16e4
        else if (lvl === 2) sp = (await roll(1, 7)) + 21;                // 5500:16f9
        else if (lvl === 3) sp = (await roll(1, 8)) + 36;                // 5500:1713
        else if (lvl === 4) sp = (await roll(1, 5)) + 0x41;              // 5500:172d
        else if (lvl === 5) sp = (await roll(1, 6)) + 0x46;              // 5500:1747
      }
      b[IT.power + k] = sp & 0xFF;                                       // 5500:175f
      wrW(b, IT.value, word(rdW(b, IT.value) + lvl * 300));              // 5500:1770
    }
  } else {
    switch (typ) {                                                       // 5500:1795 magic items
      case 63: case 67: rec = 0x29; break;
      case 78: case 79: rec = 0x21; break;                               // 5500:17a5
      case 84: case 92: rec = 0x09; break;                               // 5500:17b5
      case 71: {                                                         // 5500:17c5
        const r = await roll(1, 8);
        if (inRange(r, 1, 5)) rec = 0x11;                                // 5500:17d8
        else if (inRange(r, 6, 8)) rec = 0x01;                           // 5500:17ed
        break;
      }
    }
  }
  if (rec !== 0) {                                                       // 5500:17fb
    for (let k = 0; k <= 2; k++) b[IT.word + k + 1] = magicItem(rec + k) & 0xFF;   // 5500:1804 / 180d
    b[IT.plus] = 1; b[IT.plus2] = 1;                                     // 5500:1838 / 1840
    wrW(b, IT.weight, magicItem(rec + 3)); b[IT.count] = 0;              // 5500:1848 / 185f
    wrW(b, IT.value, magicItem(rec + 4));                                // 5500:1867
    for (let k = 1; k <= 3; k++) b[IT.power + k] = magicItem(rec + 4 + k) & 0xFF;   // 5500:187e / 1887
  }
  return it;
}

// the "Keep" branch of AppraiseGems (5500:1dd0 .. 1e94 gem, 212c .. 2211 jewel)
function keepAsItem(c, value, word3) {
  const it = newItem();                                                  // GetMem(63) + FillChar
  it.next = null; it.b[IT.readied] = 0;                                  // 5500:1deb
  it.b[IT.word + 3] = word3; it.b[IT.word + 2] = 0; it.b[IT.word + 1] = 0;   // 5500:1e02
  it.b[IT.type] = 70; wrW(it.b, IT.value, value); wrW(it.b, IT.weight, 1); it.b[IT.hidden] = 0;   // 5500:1e1d
  let p = c.items;                                                       // 5500:1e45
  if (!p) p = it;                                                        // 5500:1e58 quirk: only the local is set (the item is lost)
  else { while (p.next) p = p.next; p.next = it; }                       // 5500:1e72 / 1e94
}

// 5500:198C AppraiseGems(var changed)
export async function AppraiseGems(changed) {
  const c = G.SelectedChar, room = { v: 0 };
  changed.v = true;                                                      // 5500:1993
  if (money(c, 5) === 0 && money(c, 6) === 0) {                          // 5500:199a
    await X.ShowTimedBottomMessage('No Gems or Jewelry');                // 5500:19b2
    changed.v = false;                                                   // 5500:19c7
    return;
  }
  let done;
  do {
    if (money(c, 5) === 0 && money(c, 6) === 0) done = true;             // 5500:19d1 leaves without RecalcItems
    else {
      done = false;                                                      // 5500:19f1
      let gemStr = String(money(c, 5)), jewStr = String(money(c, 6));    // 5500:19f6 / 1a14
      gemStr = money(c, 5) === 0 ? '' : money(c, 5) === 1 ? gemStr + ' Gem' : gemStr + ' Gems';   // 5500:1a32 .. 1a75
      jewStr = money(c, 6) === 0 ? '' : money(c, 6) === 1 ? jewStr + ' piece of Jewelry' : jewStr + ' pieces of Jewelry';   // 5500:1a9d .. 1ae0
      ClearTextRectangle(1, 1, 0x26, 0x16);                              // 5500:1b08
      await X.DrawCharacterName(c, 1, 1, false);                         // 5500:1b19
      DrawText(1, 7, 0x0F, 0, 'You have a fine collection of:');         // 5500:1b2f
      DrawText(1, 9, 0x0F, 0, gemStr);                                   // 5500:1b50
      DrawText(1, 0x0A, 0x0F, 0, jewStr);                                // 5500:1b69
      let opts = '';                                                     // 5500:1b7c
      if (money(c, 5) !== 0) opts = '  Gems';                            // 5500:1b80
      if (money(c, 6) !== 0) opts = opts + '  Jewelry';                  // 5500:1b9f
      opts = opts + ' Exit';                                             // 5500:1bd3
      let key = (await HorizontalMenu('Appraise : ', opts, 0x0D, 0x0A, 0x0F, true, false)).key;   // 5500:1bfb
      if (key === 'G') {                                                 // 5500:1c2d
        if (money(c, 5) !== 0) {                                         // 5500:1c37
          setMoney(c, 5, money(c, 5) - 1);                               // 5500:1c46
          const r = await roll(1, 100);                                  // 5500:1c4f
          let value = 0;                                                 // 5500:1c5e
          if (inRange(r, 1, 25)) value = 10;
          else if (inRange(r, 26, 50)) value = 50;
          else if (inRange(r, 51, 70)) value = 100;
          else if (inRange(r, 71, 90)) value = 500;
          else if (inRange(r, 91, 99)) value = 1000;
          else if (r === 100) value = 5000;
          gemStr = 'The Gem is Valued at ' + String(value) + ' gp.';     // 5500:1cc9 / 1ce2
          DrawText(1, 0x0C, 0x0F, 0, gemStr);                            // 5500:1d17
          let noKeep;
          if (await WouldOverload(c, 1, room) || c.b[ITEMCOUNT] >= 16) { opts = 'Sell'; noKeep = true; }   // 5500:1d2a / 1d50
          else { opts = 'Sell Keep'; noKeep = false; }                   // 5500:1d6b
          key = (await HorizontalMenu('You can : ', opts, 0x0D, 0x0A, 0x0F, true, false)).key;   // 5500:1d84
          if (key === 'K' && !noKeep) keepAsItem(c, value, 0x65);        // 5500:1db7 .. 1e94 "Gem"
          else { value = Math.trunc(value / 5); await AddPlatinumOrPool(value); }   // 5500:1ea8 / 1eb7
        }
      } else if (key === 'J') {                                          // 5500:1ec2
        if (money(c, 6) !== 0) {                                         // 5500:1ec9
          setMoney(c, 6, money(c, 6) - 1);                               // 5500:1ed8
          const r = await roll(1, 100);                                  // 5500:1ee1
          let value = 0;                                                 // 5500:1ef0 Trunc(Random(n)) + base
          if (inRange(r, 1, 10)) value = Random(900) + 100;
          else if (inRange(r, 11, 20)) value = Random(1000) + 200;
          else if (inRange(r, 21, 40)) value = Random(1500) + 300;
          else if (inRange(r, 41, 50)) value = Random(2500) + 500;
          else if (inRange(r, 51, 70)) value = Random(5000) + 1000;
          else if (inRange(r, 71, 90)) value = Random(6000) + 2000;
          else if (inRange(r, 91, 100)) value = Random(10000) + 2000;
          value = word(value);
          gemStr = 'The Jewel is Valued at ' + String(value) + ' gp.';   // 5500:2025 / 203e
          DrawText(1, 0x0C, 0x0F, 0, gemStr);                            // 5500:2073
          let noKeep;
          if (await WouldOverload(c, 1, room) || c.b[ITEMCOUNT] >= 16) { opts = 'Sell'; noKeep = true; }   // 5500:2086 / 20ac
          else { opts = 'Sell Keep'; noKeep = false; }                   // 5500:20c7
          key = (await HorizontalMenu('You can : ', opts, 0x0D, 0x0A, 0x0F, true, false)).key;   // 5500:20e0
          if (key === 'K' && !noKeep) keepAsItem(c, value, 0xD6);        // 5500:2113 .. 2211 "Jewelry"
          else { value = Math.trunc(value / 5); await AddPlatinumOrPool(value); }   // 5500:2204 / 2213
        }
      } else if (key === 'E' || key === '\0') done = true;               // 5500:221d
      await X.RecalcItems(c);                                            // 5500:222a
    }
  } while (!done);                                                       // 5500:2237
}

// 5500:0000 ov21_0000 / 5500:2247 ov21_init: empty.
