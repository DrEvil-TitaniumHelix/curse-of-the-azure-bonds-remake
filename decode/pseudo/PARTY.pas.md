# PARTY — shop, effect handlers, clock and rest, money and treasure, character stats and display, class change (FINAL pseudocode, lane cab-mod-party = cab-rt, Opus)

Units (herdr/assignments/cab-areas.md, PARTY): ov06, ov12, ov20, ov21, ov24, ov25. Screens: `PARTY_SCREENS.md`. Names:
`decode/names/party_names.json`. Character creation is ov17 = `ENGINE.pas.md` (cited, not repeated); save files and the
import map are ENGINE ov16. The proven character-record field map is `## Character record` at the end (for the saves lane).
Pool twins (shape pairing, `decode/tools/pooltrans.py --shape` and a whole-program shape search): ov06 = Pool ov06 (3E00),
ov12 = Pool ov12 (5C00), ov20 = Pool ov20 (8400), ov21 = Pool ov21 (8900) — all in PoolRadianceRE `PARTY.pas.md`;
**ov24 = Pool's resident unit 00BA** (Pool `ENGINE.pas.md` res_00BA parts U/V: 45 of 53 routines match, most at ratio
0.8..1.0 — Curse moved it into an overlay); ov25 = Pool ov23 (9300, VIEW.pas.md) for 2 of 14 routines, the rest is new
(class change). Every routine has a `Pool:` line (same / changed / new; "a/b" = instructions aligned by difflib). Caution
rules of PoolRadianceRE `FABLE_CONFIRM.md` applied: the bytes were read first, Pool text only where the alignment holds.
Evidence: `decode/listings/ovNN.lst`; arguments from the PUSH sequences (`decode/tools/callsites.py --starts`).

Conventions (as ENGINE.pas.md)
- **Signatures in Pascal order**: first parameter = highest BP offset = pushed first; parameters as `name [BP+xx]`.
- `{ seg:off }` = first instruction of the statement (analysis segments ov06 2B00, ov12 3600, ov20 5400, ov21 5500,
  ov24 6200, ov25 6600); `{ quirk: ... }` = behaviour a faithful port must copy.
- Resident callees by RESIDENT.pas.md names with **Curse signatures** (text routines carry a background colour:
  `DrawText(col, row, fg, bg, s)`, `DrawWrappedText(x1, y1, x2, y2, fg, bg, clear, s)`, ...); ENGINE / ECL / VIEW / COMBAT
  routines by their names or `ovNN_XXXX` with the Pool equivalent in parentheses.
- Globals by `decode/GLOBALS.md` names. ECL VM regions are word-indexed (`ecl_Mem7C00^.w[o div 2]` = VM word 7C00h + o/2).
- Character record offsets are **Curse** (1A6h record; `## Character record`); `ch.field` names follow Pool SAVES.md §3 where
  the Curse field is proven to be the same field (ConvertPoolCharacter map, ENGINE ov16, and the readers cited here).

---

## ov06 (2B00) — shop

Pool twin: Pool ov06 (3E00) "shop" (PoolRadianceRE PARTY.pas.md) — **changed**: prices are scaled by a shop factor (VM word
7F6D), no titled frame (DrawScreenFrame), the list index / redraw flag is the DS byte g_47EE, the HorizontalMenu / text calls
carry Curse's background colour. CS literals: 30 blanks 2B00:0025, `'Items: '` `'Buy'`, `'OverLoaded'`, `'Not enough Money.'`,
`'Buy View Take Pool Share Appraise Exit'`, `'Buy View Pool Appraise Exit'`, the shopkeeper texts, `'~Yes ~No'`.
Item record (63 bytes, ENGINE ov16): +0 name string[40], +2Ah next, +3Ah value (word, gold pieces).

### 2B00:0000 ov06_0000 — pre-load overlay units (H)
Calls the empty entries of ov21, ov19, ov26, ov24, ov07, ov34 `{ 2b00:0000 }`. Pool: — **new**.

### 2B00:0050 ShopItemsMenu (H)
`procedure ShopItemsMenu(var key [BP+12h]; var chosen [BP+0Eh]: PItem; var cur [BP+0Ah]: PItem; var index [BP+6]: Integer)`
— caller: ShopBuy. Pool: 3E00:0030 — **changed** (177/323: price factor, no frame).
```pascal
item := TreasureItems;                                           { 2b00:0056 }
while item <> nil do begin                                       { 2b00:0062 }
  line := '                              ';                      { 2b00:006d  string[30] }
  if item^.value = 0 then item^.value := 1;                      { 2b00:0080  quirk (as Pool): written into the item }
  case ecl_Mem7C00^.w[$6DA div 2] of                             { 2b00:0093  VM word 7F6D = price factor }
    1: Str(LongInt(item^.value div 16), num);                    { 2b00:00a1 }
    2: Str(LongInt(item^.value div 8), num);                     { 2b00:00c7 }
    4: Str(LongInt(item^.value div 4), num);                     { 2b00:00f2 }
    8: Str(LongInt(item^.value div 2), num);                     { 2b00:011d }
    $20: Str(LongInt(item^.value * 2), num);                     { 2b00:0148 }
    $40: Str(LongInt(item^.value * 4), num);                     { 2b00:016d }
    $80: Str(LongInt(item^.value * 8), num);                     { 2b00:0195 }
  else Str(LongInt(item^.value), num);                           { 2b00:01bd }
  end;
  for k := 1 to Length(num) do line[30 - Length(num) + k] := num[k];   { 2b00:01d9 }
  for k := 1 to Length(item^.name) do line[k] := item^.name[k];  { 2b00:021b }
  item^.name := line;  item^.name[0] := Chr(30);                 { 2b00:025d }
  item := item^.next;                                            { 2b00:027a }
end;
list := TreasureItems;                                           { 2b00:0289 }
menu_Sel := 0;                                                   { 2b00:0295 }
key := VerticalListMenu('Items: ', 'Buy', $0D, $0A, $0F, 1, 1, $26, $16, list, 1, g_47EE, index, cur);   { 2b00:029a }
chosen := cur;                                                   { 2b00:02ea }
item := TreasureItems;                                           { 2b00:0302 }
while item <> nil do begin BuildItemName(nil, item, 0, 0, 0, 0); item := item^.next end;   { 2b00:030e / 0316 / 0336 }
```
`{ quirk (as Pool): a name longer than 30 characters overwrites the price. }`

### 2B00:0355 AddItemToChar (H)
`procedure AddItemToChar(item [BP+0Ah]: PItem; var failed [BP+6]: Boolean)` (far, stub ov06 e2) — callers: ShopBuy, other
lanes. Pool: 3E00:0239 — **same** (82/96; pointer loads only).
```pascal
if ItemOverloads(SelectedChar, item) then begin                  { 2b00:0355  COMBAT ov19 }
  ShowTimedBottomMessage('OverLoaded');                          { 2b00:0372 }
  failed := true;  Exit;                                         { 2b00:0386 / 038d }
end;
failed := false;                                                 { 2b00:0390 }
p := SelectedChar^.items;                                        { 2b00:0397  +14Dh }
if p = nil then begin
  GetMem(p, $3F);  p^ := item^;  p^.next := nil;  SelectedChar^.items := p;   { 2b00:03b0 / 03be / 03c6 / 03d1 }
end else begin
  while p^.next <> nil do p := p^.next;                          { 2b00:03f3 }
  GetMem(q, $3F);  q^ := item^;  q^.next := nil;  p^.next := q;  { 2b00:0411 / 041f / 0427 / 0432 }
end;
RecalcItems(SelectedChar);                                       { 2b00:044f }
```

### 2B00:0474 ShopBuy (H)
`procedure ShopBuy` — caller: Shop 'B'. Pool: 3E00:0361 — **changed** (101/166: price factor, screen frame).
```pascal
chosen := nil;  cur := TreasureItems;                            { 2b00:047a / 0482 }
index := 0;  DrawScreenFrame;  g_47EE := 1;                      { 2b00:048e / 0493 / 0498 }
repeat
  ShopItemsMenu(key, chosen, cur, index);                        { 2b00:049d }
  if (key <> 'B') and (key <> #13) then leave := true            { 2b00:04b5 }
  else begin
    leave := false;
    price := chosen^.value scaled by VM word 7F6D as in ShopItemsMenu;   { 2b00:04cc .. 0573  word }
    gold := Word(MoneyInGold(SelectedChar));                     { 2b00:0573  COMBAT ov19; low word }
    if price <= gold then begin
      AddItemToChar(chosen, failed);                             { 2b00:058b }
      if not failed then SetCharMoneyGold(gold - price);         { 2b00:059a / 05a0 }
    end else begin
      pool := MoneyValueInGold(TreasureMoney);                   { 2b00:05b3 }
      if price <= pool then begin
        AddItemToChar(chosen, failed);                           { 2b00:05d4 }
        if not failed then SetPoolMoneyGold(Word(pool - price)); { 2b00:05e9 }
      end else ShowTimedBottomMessage('Not enough Money.');      { 2b00:060b }
    end;
  end;
until leave;                                                     { 2b00:060e }
```
`{ quirk (as Pool): only the low word of MoneyInGold is compared; the payer's coins are re-minted as platinum + gold. }`

### 2B00:06F6 Shop (H)
`procedure Shop` (far, stub ov06 e1) — caller: ECL (combat / shop opcode, ECL.pas.md). Pool: 3E00:053E — **same** (254/270)
except the view flag g_8B54 around the first redraw and the Curse text colours.
```pascal
view_Mode := 1;                                                  { 2b00:06f6 }
g_8B54 := (ecl_Mem4B00^.w[$1CC div 2] = 0);                      { 2b00:0702  VM 4BE6 (3D area flag) = 0 }
RedrawCurrentMode;                                               { 2b00:0717 }
g_8B54 := 1;                                                     { 2b00:071c }
PartySummary(SelectedChar);                                      { 2b00:0721 }
FillChar(TreasureMoney, $1C, 0);                                 { 2b00:072e  empty money pool }
prompt := '';  PoolHasMoney := 0;  leave := false;                     { 2b00:073f / 0743 / 0748 }
item := TreasureItems;
while item <> nil do begin BuildItemName(nil, item, 0, 0, 0, 0); item := item^.next end;   { 2b00:074c / 0760 }
repeat
  TreasurePoolStatus(hasMoney, hasItems);                        { 2b00:078e }
  if hasMoney then opts := 'Buy View Take Pool Share Appraise Exit'   { 2b00:079d }
  else opts := 'Buy View Pool Appraise Exit';                    { 2b00:07b8 }
  key := HorizontalMenu(prompt, opts, $0D, $0A, $0F, 1, 0, ext); { 2b00:07cb }
  case key of
    'B': ShopBuy;                                                { 2b00:07f4 / 07f9 }
    'V': ViewMenu(ext);                                          { 2b00:07ff  COMBAT ov19; quirk: ext as turnUsed }
    'T': TakeMoney;                                              { 2b00:0810 }
    'P': if not ext then PoolMoney;                              { 2b00:081c / 0820 }
    'S': ShareMoney;                                             { 2b00:082e }
    'A': AppraiseGems(appraised);                                { 2b00:083a }
    'E': begin                                                   { 2b00:084b }
           TreasurePoolStatus(hasMoney, hasItems);               { 2b00:0852 }
           if not hasMoney then leave := true                    { 2b00:0861 }
           else begin
             DrawWrappedText(1, $11, $26, $16, $0A, 0, 1,
               'As you Leave the Shopkeeper says, "Excuse me but you have Left Some Money here."  ');   { 2b00:087d }
             DrawWrappedText(1, $11, $26, $16, $0F, 0, 0, 'Do you want to go back and get your Money?');   { 2b00:08a7 }
             if MenuSelect(prompt, '~Yes ~No', $0D, $0A, $0F, 0, 0) = 1 then leave := true   { 2b00:086a / 08d0  1 = No }
             else ClearTextRectangle(1, $11, $26, $16);          { 2b00:08fd }
           end;
         end;
    'G', 'O': CycleSelectedChar(key);                                    { 2b00:091a / 0929  previous / next member }
  end;
  if (key = 'B') or (key = 'T') then RedrawCurrentMode           { 2b00:0932 / 093d }
  else if (key = 'A') and appraised then RedrawCurrentMode;      { 2b00:0944 / 094e }
  PartySummary(SelectedChar);                                    { 2b00:0953 }
until leave;                                                     { 2b00:0960 }
```
`{ quirk (as Pool): the extended-key flag is ignored except for 'P' (Del = 'S' Share, F8 = 'B' Buy, F7 = 'A' Appraise);
money left in the pool is lost when the party answers No. }`

### 2B00:096D ov06_init — empty (H)

---

## ov12 (3600) — active-effect handlers

Pool twin: Pool ov12 (5C00) effect handlers (PoolRadianceRE PARTY.pas.md "Helpers", "Effect handlers") — **changed**: Curse
keeps the handler-table mechanism (InstallEffectHandlers fills `EffectHandler` DS:6FAA.., entry of type t at DS:6FA6+4t;
called through CallEffectHandler, COMBAT ov23) and Pool's type numbers 01h..8Bh, but **redefines many types** (e.g. 03h is
"is fighting with snakes", 04h a to-hit penalty) and adds 8Ch..93h. Each handler below was written from the Curse asm; the
Pool name is kept only where the bytes do the same thing (`Pool:` same), otherwise the routine is named by its behaviour.
Types handled by other units: 39h EffEngulf, 57h EffEyeRays, 60h EffHug, 8Bh EffEngulfHold, 90h EffHugHold (COMBAT);
nil slots 56h, 58h, 5Ah, 80h, 83h, 84h (a dispatch would call 0000:0000, as Pool's 58h).
**Handler signature** (all, `RETF 0Ah`): `procedure EffXxx(c [BP+0Ch]: PChar; e [BP+8]: PEffect; mode [BP+6]: Byte)` — `c` the
effect's owner, `e` the 9-byte effect (`type +0, duration +1 (word), p3 +3, callOnRemove +4, next +5`), `mode` 0 = hook event,
1 = removed. Hook events are those of CallEffectHooks (COMBAT CallEffectHooks); they are not repeated per handler.
Hook globals (names of COMBAT.pas.md; Curse = Pool + 77Ch/77Dh, proven by 24 aligned handler pairs): SaveRoll 6F92,
EffectToApply 6F93, DamageAmount 6F94, DamageType 6F95 (1 fire, 2 cold, 4 electricity, 8 magic, 10h acid), StatValue 6F96,
sp_Current 6F97 (spell being cast), LastDiceCount 6F98, StatKind 6F9A, AttackBlocked 6F9B, cure_InProgress 6F9C, SpellArea
6F9D, AttackRollValue 6F9F, SlotHits 6FA0, morale_Value 6FA2, hold_Victim 6FA3 (far ptr), SaveType 6FA7.
`cr(c)` = `c^.combatant` (+18Dh): `+1 mayCast`, `+2 mayUseItems`, `+0Ah target`. Combat-side callees by COMBAT names:
KillCombatant (KillCombatant, Pool ApplyFatalStatus), CallEffectHandler (00C9), RemoveEffect (010E), AddEffect (13EE), Roll (137F),
RollDice (13CA), DamageCharacter (1FD6), HealCharacter (23FB), ReviveCombatant (24ED), ReadyItem.

### 3600:0000 ov12_0000 — pre-load overlay units (H)
Calls the empty entries of ov24, ov25, ov34, ov23 `{ 3600:0000 }`. Pool: — **new**.

### 3600:001B CancelDamageAndEffect (H)
`procedure CancelDamageAndEffect(type [BP+6]: Byte)` (`RETF 2`). Pool: 5C00:0000 — **same**.
```pascal
if (type = 0) or (EffectToApply = type) then begin               { 3600:001e / 0024 }
  DamageAmount := 0;  EffectToApply := 0;                        { 3600:002c / 0031 }
end;
```

### 3600:003C AddEffectUnlessCuring (H)
`function AddEffectUnlessCuring(c [BP+0Ch]; type [BP+0Ah], p3 [BP+8]: Byte; duration [BP+6]: Word): Boolean`. Pool: 5C00:001F — **same**.
```pascal
if cure_InProgress <> 0 then result := false                     { 3600:0042 }
else begin result := true;  AddEffect(c, type, duration, p3, 1) end;   { 3600:004f / 0053 }
```

### 3600:0075 EffHelpless (M)
Types 1Bh, 1Fh, 33h, 34h, 35h. Pool: 5C00:133F EffHelpless — **same** (Pool's 1Bh was EffNop).
```pascal
ClearCombatantActionFlags(c);                                    { 3600:0078  result tested at 0083 but both paths return }
```

### 3600:008D EffPlusOne (M)
Not in the table (called by EffPrayer). Pool: 5C00:0C06 — **same**.
```pascal
SaveRoll := SaveRoll + 1;  AttackRollValue := AttackRollValue + 1;   { 3600:0090 / 0094 }
```

### 3600:009E EffBless (H)
Type 01h. Pool: 5C00:010D — **same**.
```pascal
morale_Value := morale_Value + 5;  AttackRollValue := AttackRollValue + 1;   { 3600:00a1 / 00a6 }
```

### 3600:00B0 EffCurse (H)
Type 02h. Pool: 5C00:011D — **same**.
```pascal
if morale_Value < 5 then morale_Value := 0 else morale_Value := morale_Value - 5;   { 3600:00b3 / 00ba / 00c1 }
AttackRollValue := AttackRollValue - 1;                          { 3600:00c6 }
```

### 3600:00E8 EffSnakes (M)
Type 03h — "is fighting with snakes": `e^.p3` snake attacks absorb the owner's attacks. Pool: 5C00:013B EffBonusVsUndead —
**new** behaviour (0.16). Name M (string; AD&D Sticks to Snakes).
```pascal
n := c^.attacks_left[2] + c^.attacks_left[1];                    { 3600:00ee  +19Dh + +19Ch }
if e^.p3 > n then e^.p3 := e^.p3 - n                             { 3600:0109 / 0115 }
else RemoveEffect(c, 3, nil);                                    { 3600:0121 }
ShowCombatMessageAnimation(c, 1, 'is fighting with snakes');     { 3600:0135 }
ClearCharacterMessage;                                           { 3600:0152 }
ClearCombatantActionFlags(c);                                    { 3600:0157  the owner loses its turn }
```

### 3600:016B EffHitPenaltyVsFlag1 (L)
Type 04h. Pool: 5C00:017F EffStartsToTrain — **new** behaviour.
```pascal
if SelectedChar^.b[$14B] and 1 <> 0 then AttackRollValue := AttackRollValue - 7;   { 3600:016e / 017d }
```
`+14Bh` is a monster-kind bit set (bits 0, 1, 2 tested by types 04h, 12h, 1Ah; meaning L).

### 3600:0188 EffFlameTongue (H)
Type 06h. Pool: 5C00:01C3 — **same** (the creature type is `+11Ah`).
```pascal
hold_Victim := cr(c)^.target;                                   { 3600:018e }
case hold_Victim^.creature_type of                              { 3600:01a3 }
  $0A: b := 1;  9, $0C: b := 2;  4: b := 3;  else b := 0;        { 3600:01ae .. 01d4 }
end;
AttackRollValue := AttackRollValue + b;  DamageAmount := DamageAmount + b;   { 3600:01d8 / 01df }
DamageType := 9;                                                 { 3600:01e6  fire + magic }
```

### 3600:01F1 EffAcBonus2 (M)
Type 07h. Pool: 5C00:0233 EffHardier — **new** behaviour.
```pascal
if c^.ac < $3A then c^.ac := c^.ac + 2 else c^.ac := $3C;        { 3600:01f4 / 0202 / 020d  AC 2 better, at most AC 0 }
if c^.ac_rear < $3A then c^.ac_rear := c^.ac_rear + 2 else c^.ac_rear := $3C;   { 3600:0213 / 0221 / 022c }
```

### 3600:0238 EffProtFromEvil (H) / 3600:026F EffProtFromGood (H)
Types 08h, 2Dh / 09h, 2Eh. Pool: 5C00:0377 / 03AC — **same** (alignment `+11Bh`).
```pascal
if SelectedChar^.alignment in [2, 5, 8] then begin               { 3600:023b  (026F: [0, 3, 6] 0272) }
  SaveRoll := SaveRoll + 2;  AttackRollValue := AttackRollValue - 2;   { 3600:025f / 0264  (0296 / 029b) }
end;
```

### 3600:02A6 EffResistCold (H)
Type 0Ah. Pool: 5C00:03E1 — **same**.
```pascal
if DamageType and 2 <> 0 then begin                              { 3600:02a9 }
  DamageAmount := DamageAmount div 2;  SaveRoll := SaveRoll + 3; { 3600:02b2 / 02c0 }
end;
```

### 3600:02CB EffCharm (H)
Type 0Bh. Pool: 5C00:0400 — **same** (side `+197h`, controlled `+198h`, npc_morale `+F7h`).
```pascal
if mode <> 0 then begin                                          { 3600:02ce }
  c^.side := (e^.p3 and $40) div $40;                            { 3600:02d4 }
  if c^.npc_morale = $B3 then c^.npc_morale := 0;                { 3600:02ed }
  Exit;                                                          { 3600:0301 }
end;
if e^.p3 and $20 = 0 then begin                                  { 3600:0304 }
  e^.p3 := e^.p3 + $20 + (c^.side shl 6);                        { 3600:0311 }
  c^.side := e^.p3 div $80;  c^.controlled := 1;                 { 3600:0336 / 034d }
  if c^.npc_morale <= $7F then c^.npc_morale := $B3;             { 3600:0356 }
  cr(c)^.target := nil;                                          { 3600:036a }
  CountActiveSides;                                              { 3600:037c }
end;
morale_Value := 100;                                              { 3600:0381 }
```

### 3600:038C EffNop0C (H)
Types 0Ch, 26h — empty body `{ 3600:038c }`. Pool: 5C00:04BA EffStrengthEnd — **changed** (empty in Curse).

### 3600:03A0 EffSuffocate (M)
Type 0Dh. Pool: EffNop — **new**. Name M (string).
```pascal
if e^.p3 = 0 then KillCombatant(c, 6, 'Suffocates')              { 3600:03a6 / 03b0  6 = Dead }
else e^.p3 := e^.p3 - 1;                                         { 3600:03cf }
```

### 3600:03DC EffNop0E (H)
Type 0Eh — empty body `{ 3600:03dc }`. Pool: 5C00:05D6 EffSetCharisma — **changed** (empty).

### 3600:03E5 EffHpLossTick (H)
Type 0Fh. Pool: 5C00:05EB — **same** (hp `+1A4h`).
```pascal
if AddEffectUnlessCuring(c, $0F, e^.p3, 10) then                 { 3600:03e8 }
  if c^.hp > 1 then begin                                        { 3600:0405 }
    DamageType := 0;                                             { 3600:0410 }
    DamageCharacter(c, 1, 0, 0);                                 { 3600:0415 }
    if view_Mode <> 5 then PartySummary(SelectedChar);           { 3600:0429 / 0430 }
  end;
```

### 3600:0443 EffNop10 (H)
Type 10h — empty `{ 3600:0443 }`. Pool: 5C00:0647 — **same**.

### 3600:044C EffShield (M)
Type 11h. Pool: 5C00:064E EffShield — **changed** (0.45).
```pascal
if c^.ac < $39 then c^.ac := $39;                                { 3600:044f / 045a  at least AC 3 }
SaveRoll := SaveRoll + 1;                                        { 3600:0463 }
if sp_Current = $0F then DamageAmount := 0;                      { 3600:0467 / 046e  spell 0Fh (magic missile, M) has no effect }
```

### 3600:0479 EffHitBonusVsFlag2 (L) / 3600:0727 EffHitBonusVsFlag4 (L)
Types 12h / 1Ah. Pool: 5C00:0679 EffGnomeAttackBonus / 0947 EffDwarfAttackBonus — **changed** (a flag bit instead of names).
```pascal
hold_Victim := cr(c)^.target;                                   { 3600:047f  (072d) }
if hold_Victim^.b[$14B] and 2 <> 0 then AttackRollValue := AttackRollValue + 1;   { 3600:0494 / 04a3  (bit 4: 0742 / 0751) }
```

### 3600:04AD EffResistFire (H)
Type 14h. Pool: 5C00:06E4 — **changed** (only in mode 0).
```pascal
if (mode = 0) and (DamageType and 1 <> 0) then begin             { 3600:04b0 / 04b6 }
  DamageAmount := DamageAmount div 2;  SaveRoll := SaveRoll + 3; { 3600:04bf / 04cd }
end;
```

### 3600:04E4 EffSilence (H)
Type 15h. Pool: 5C00:070F — **same**.
```pascal
if cr(c)^.mayUseItems <> 0 then ShowCharacterMessage(c, 'is silenced', $0A, 1);   { 3600:04ea / 04f9 }
cr(c)^.mayUseItems := 0;  cr(c)^.mayCast := 0;                   { 3600:0519 / 0526 }
```

### 3600:054A EffSlowPoisonEnd (H)
Type 16h. Pool: 5C00:0775 — **same**.
```pascal
if HasEffect(c, $37, p) then KillCombatant(c, 6, 'dies from poison');   { 3600:0550 / 0567 }
cure_InProgress := 1;                                            { 3600:0584 }
RemoveEffect(c, $0F, nil);                                       { 3600:0589 }
cure_InProgress := 0;                                            { 3600:059d }
```

### 3600:05B6 EffSpiritualHammer (H)
Type 17h. Pool: 5C00:07E0 — **changed**: the hammer gets power byte A0h (Pool 89h) and is readied.
```pascal
p := c^.items;  found := false;                                  { 3600:05bc / 05cc }
while (p <> nil) and not found do                                { 3600:05d0 }
  if (p^.type = $14) and (p^.b[$31] = $F3) then found := true    { 3600:05de / 05f2 }
  else p := p^.next;                                             { 3600:05f8 }
if (mode <> 0) and (p <> nil) then LoseItem(c, p);               { 3600:0609 / 0617 }
if (mode = 0) and not found and (c^.item_count < 16) then begin  { 3600:0628 / 0631 / 063a }
  GetMem(p, $3F);  FillChar(p^, $3F, 0);                         { 3600:0648 / 0656 }
  p^.type := $14;  p^.b[$30] := $14;  p^.b[$31] := $F3;  p^.plus := 1;   { 3600:0667 .. 0682  "Spiritual Hammer" +1 }
  p^.b[$3D] := $17;  p^.b[$3E] := $A0;                           { 3600:0687 / 068f }
  AppendItemCopy(c, p);                                          { 3600:0697 }
  ReadyItem(p);                                                  { 3600:06a8  (COMBAT ReadyItem; on the template, M) }
  FreeMem(p, $3F);                                               { 3600:06b3 }
  ShowCharacterMessage(c, 'Gains an item', $0A, 1);              { 3600:06c1 }
end;
RecalcItems(c);                                                  { 3600:06e1 }
```
`{ quirk: ReadyItem runs on the freed template, not on the appended copy (the copy is not readied, M). }`

### 3600:06F2 EffInvisible (H)
Type 19h. Pool: 5C00:0918 — **changed** (only in mode 0).
```pascal
if (mode = 0) and not HasEffect(SelectedChar, $18, p) then begin { 3600:06f8 / 06fe }
  AttackBlocked := 1;  AttackRollValue := AttackRollValue - 4;   { 3600:0717 / 071c }
end;
```
`{ quirk (vs Pool): with Detect Invisibility (18h) the −4 does not apply either. }`

### 3600:0769 EffMirrorImage (H)
Type 1Ch. Pool: 5C00:09C0 — **changed**: the image count is the high nibble of `p3`.
```pascal
if (Roll(1, e^.p3 div 16 + 1) > 1) and (sp_Current > 0) and (SpellArea = 0) then begin   { 3600:076f / 0788 / 078c / 0793 }
  CancelDamageAndEffect(0);                                      { 3600:079a }
  ShowCharacterMessage(c, 'lost an image', $0A, 1);              { 3600:07a1 }
  e^.p3 := e^.p3 - 1;                                            { 3600:07c1 }
  if e^.p3 = 0 then RemoveEffect(c, $1C, nil);                   { 3600:07c8 / 07d2 }
end;
```
`{ quirk: the chance uses p3 div 16 but one is subtracted from the whole byte, so the effect ends only when p3 reaches 0. }`

### 3600:07EC EffDamageMinusQuarter (M)
Type 1Dh. Pool: 5C00:0A3D EffEnfeebled — **changed** (0.79).
```pascal
DamageAmount := DamageAmount - DamageAmount div 4;               { 3600:07ef / 0803 }
```

### 3600:0818 EffCoughing (H)
Type 1Eh. Pool: 5C00:0A65 — **same** (ac `+19Ah`, ac_rear `+19Bh`).
```pascal
if cr(c)^.mayUseItems <> 0 then ShowCharacterMessage(c, 'is coughing', $0A, 1);   { 3600:081e / 082d }
cr(c)^.mayUseItems := 0;  cr(c)^.mayCast := 0;                   { 3600:084d / 085a }
RecalcItems(c);                                                  { 3600:0867 }
if c^.ac_rear > $34 then c^.ac_rear := c^.ac_rear - 2 else c^.ac_rear := $32;   { 3600:0872 / 087d / 0888 }
c^.ac := c^.ac_rear;                                             { 3600:0891 }
if c = SelectedChar then DrawCharacterSummary(c);                { 3600:08a1 / 08b2 }
```

### 3600:08CD EffAnimatedEnd (H)
Type 20h. Pool: 5C00:0B1B — **changed** (dual-class fighter level).
```pascal
e^.callOnRemove := 0;                                            { 3600:08d3 }
if cure_InProgress = 0 then KillCombatant(c, 6, 'collapses');    { 3600:08db / 08e2 }
c^.side := e^.p3 div 16;  c^.controlled := 1;  c^.undead := 0;   { 3600:08ff / 0916 / 091f  +197h, +198h, +E9h }
c^.fighter_lvl_eff := c^.level[2] + c^.old_level[2] * DualClassActive(c);   { 3600:0928  +DDh := +10Bh + +113h × (0/1) }
c^.base_move := 12;                                              { 3600:0956  +E4h }
if c^.npc_morale = $B3 then c^.npc_morale := 0;                  { 3600:095f / 096a }
c^.creature_type := 0;                                           { 3600:0973 }
```

### 3600:0982 EffPenaltyAll4 (M)
Type 21h. Pool: 5C00:0BAC — **same**.
```pascal
AttackRollValue := AttackRollValue - 4;  c^.ac := c^.ac - 4;  c^.ac_rear := c^.ac_rear - 4;   { 3600:0985 / 098a / 0993 }
SaveRoll := SaveRoll - 4;                                        { 3600:099c }
```

### 3600:09A7 EffWeaknessAndDrain (M)
Type 22h. Pool: 5C00:0BCF — **same**.
```pascal
CallEffectHandler($2B, c, e, mode);                              { 3600:09aa }
CallEffectHandler($2C, c, e, mode);                              { 3600:09c2 }
```

### 3600:0A0E EffConfusion (M)
Type 23h — each turn: d100 1..10 runs away, 11..60 confused (loses the turn), 61..80 goes berserk, 81..100 enraged; ends on a
save. Pool: 5C00:0C06 EffPlusOne — **new** behaviour. Name M (strings; AD&D Confusion table).
```pascal
r := Roll(1, 100);                                               { 3600:0a14 }
case r of
  1..10: begin                                                   { 3600:0a22 }
    RemoveEffect(c, $23, nil);                                   { 3600:0a37 }
    cr(c)^.b[$10] := 1;  c^.controlled := 1;                     { 3600:0a4b / 0a58  turned (flees, COMBAT) }
    if c^.npc_morale <= $7F then c^.npc_morale := $B3;           { 3600:0a61 / 0a6c }
    cr(c)^.target := nil;                                        { 3600:0a75 }
    ApplyEffect(c, $8E, 10, 0, 1, 1, false, 'runs away');        { 3600:0a87 }
  end;
  11..60: begin                                                  { 3600:0ab7 }
    ShowCombatMessageAnimation(c, 1, 'is confused');  ClearCharacterMessage;   { 3600:0ac1 / 0ade }
    EffHelpless(c, e, 0);                                        { 3600:0ae3 }
  end;
  61..80: begin                                                  { 3600:0af9 }
    ApplyEffect(c, $89, 1, c^.side, 1, 1, false, 'goes berserk');   { 3600:0b03 }
    CallEffectHandler($89, c, nil, 0);                           { 3600:0b36 }
  end;
  81..100: begin                                                 { 3600:0b4f }
    ShowCombatMessageAnimation(c, 1, 'is enraged');  ClearCharacterMessage;   { 3600:0b59 / 0b76 }
  end;
end;
if SavingThrow(c, 4, $FE) then                                   { 3600:0b7b  save vs spell, bonus FEh = -2 }
  RemoveEffect(c, $23, nil);                                     { 3600:0b95 }
```

### 3600:0BAF EffPenalty4 (M)
Type 24h. Pool: 5C00:0C15 — **same**.
```pascal
AttackRollValue := AttackRollValue - 4;  SaveRoll := SaveRoll - 4;   { 3600:0bb2 / 0bb7 }
```

### 3600:0BC2 EffUntouchableAfterTurn (L)
Type 25h. Pool: 5C00:0C26 EffUntouchableBeforeTurn — **changed**: the test is inverted.
```pascal
if cr(c)^.initiative = 0 then begin                              { 3600:0bc5 / 0bcd }
  AttackBlocked := 1;  AttackRollValue := -1;                    { 3600:0bd4 / 0bd9 }
end;
```

### 3600:0BE9 EffHaste (H)
Type 27h. Pool: 5C00:0C4B — **same** (age `+76h` word).
```pascal
if e^.p3 and $10 = 0 then begin                                  { 3600:0bef }
  e^.p3 := e^.p3 + $10;                                          { 3600:0bfc }
  ShowCharacterMessage(c, 'ages', $0A, 1);                       { 3600:0c0f }
  c^.age := c^.age + 1;                                          { 3600:0c2f }
end;
StatValue := StatValue shl 1;                                    { 3600:0c36 }
```

### 3600:0C61 EffCloudRemoved (H)
Type 28h. Pool: 5C00:0CC3 — **same** with a larger cloud node (1Eh bytes): `+0 owner, +4 next, +7+k ground[k],
+10h+k active[k], +1Ah x, +1Bh y, +1Ch id` (k = 1..4). Lists: `cloud_List` DS:755B (cloud nodes; GLOBALS' Pool vote for 755F is
wrong, aligned here), bodies `corpse_List` DS:6E52 (7-byte entries `+0 char, +4 x, +5 y`, count `corpse_Count` DS:6E91),
square steps `CloudSearchDirs` DS:27D8 (k = 1..4) with step_dx / step_dy DS:2694 / DS:269D, combat map `cm_Map` (stride 50).
```pascal
id := e^.p3 div 16;  found := false;  a := cloud_List;              { 3600:0c67 / 0c79 / 0c7d }
while (a <> nil) and not found do                                { 3600:0c89 }
  if (a^.owner = c) and (a^.id = id) then found := true          { 3600:0c97 / 0ca9 }
  else a := a^.next;                                             { 3600:0cbb }
if not found then Exit;                                          { 3600:0ccc }
ShowTimedBottomMessage('The air clears a little...');            { 3600:0cd5 }
for k := 1 to 4 do                                               { 3600:0ce9 }
  if a^.active[k] <> 0 then begin                                { 3600:0cf2 }
    x := a^.x + step_dx[CloudSearchDirs[k]];  y := a^.y + step_dy[CloudSearchDirs[k]];   { 3600:0d06 / 0d29 }
    body := false;                                               { 3600:0d4c }
    for i := 1 to corpse_Count do                                { 3600:0d50 }
      if (corpse_List[i].char <> nil) and (corpse_List[i].x = x) and (corpse_List[i].y = y) then body := true;   { 3600:0d65 / 0db3 }
    if body then cm_Map^[7 + y*50 + x] := $1F                    { 3600:0dbf / 0dc5 }
    else cm_Map^[7 + y*50 + x] := a^.ground[k];                  { 3600:0de5 }
  end;
p := cloud_List;                                                    { 3600:0e19 }
if p = a then cloud_List := a^.next                                 { 3600:0e25 / 0e34 }
else while p^.next <> a do p := p^.next;                         { 3600:0e46 / 0e59 }
p^.next := a^.next;                                              { 3600:0e6a }
FreeMem(a, $1E);                                                 { 3600:0e7e }
p := cloud_List;                                                    { 3600:0e8c }
while p <> nil do begin                                          { 3600:0e98 }
  for k := 1 to 4 do                                             { 3600:0ea3 }
    if p^.active[k] <> 0 then cm_Map^[7 + (p^.y + dy[..])*50 + p^.x + dx[..]] := $1E;   { 3600:0eac / 0ebd }
  p := p^.next;                                                  { 3600:0f17 }
end;
```
(as Pool: when a was the head the final `p^.next := a^.next` is a no-op.)

### 3600:0F39 AvoidRangedAttack (H)
`procedure AvoidRangedAttack(c [BP+8]: PChar; chance [BP+6]: Byte)` (`RETF 6`). Pool: 5C00:0FAC — **same** (readied[0] `+151h`).
```pascal
if SelectedChar^.readied[0] <> nil then                          { 3600:0f3f }
  if TargetDistance(SelectedChar, c) > 1 then                    { 3600:0f4f }
    if Roll(1, 100) <= chance then begin                         { 3600:0f66 }
      ShowCharacterMessage(c, 'Avoids it', $0A, 1);              { 3600:0f76 }
      DamageAmount := 0;  AttackRollValue := -1;  SlotHits := SlotHits - 1;   { 3600:0f96 / 0f9b / 0fa0 }
    end;
```

### 3600:0FAA CurrentAttackItem (H)
`function CurrentAttackItem(c [BP+6]: PChar): PItem` (`RETF 4`). Pool: 5C00:101D — **same**.
```pascal
p := nil;                                                        { 3600:0fb0 }
if c^.readied[0] <> nil then begin                               { 3600:0fb8 }
  ok := GetMissileAmmo(c, p);                                    { 3600:0fc7 }
  if not ok or (p = nil) then p := c^.readied[0];                { 3600:0fda / 0fe8 }
end;
CurrentAttackItem := p;                                          { 3600:0ff8 }
```

### 3600:100F EffMagicWeaponOnly (H)
Type 29h. Pool: 5C00:1086 — **same**.
```pascal
if CurrentAttackItem(SelectedChar) <> nil then                   { 3600:1012 }
  if CurrentAttackItem(SelectedChar)^.plus = 0 then AvoidRangedAttack(c, 100);   { 3600:1022 / 1032 / 1039  plus +32h }
```

### 3600:104C EffSlow (H)
Type 2Ah. Pool: 5C00:10C1 — **same**.
```pascal
StatValue := StatValue div 2;                                    { 3600:104f }
```

### 3600:106F EffWeakness (H)
Type 2Bh. Pool: 5C00:10DE — **same** (current STR `+11h`).
```pascal
if AddEffectUnlessCuring(c, $2B, e^.p3, $3C) then                { 3600:1072 }
  if c^.str > 3 then begin                                       { 3600:1092 }
    ShowCharacterMessage(c, 'is weakened', $0A, 1);              { 3600:109c }
    c^.str := c^.str - 1;                                        { 3600:10bc }
  end
  else if not HasEffect(c, $1F, p) then AddEffect(c, $1F, 0, $FF, 0);   { 3600:10c5 / 10dc }
```

### 3600:10F9 EffHpDrainTick (H)
Type 2Ch. Pool: 5C00:1168 — **same**.
```pascal
if AddEffectUnlessCuring(c, $2C, e^.p3, 10) then                 { 3600:10fc }
  if c^.hp > 1 then begin                                        { 3600:111c }
    DamageType := 0;  DamageCharacter(c, 1, 0, 0);               { 3600:1127 / 112c }
    if view_Mode <> 5 then PartySummary(SelectedChar);           { 3600:1140 / 1147 }
  end
  else if not HasEffect(c, $1F, p) then AddEffect(c, $1F, 0, $FF, 0);   { 3600:1156 / 116d }
```

### 3600:118A EffDefenceVsLargeGiants (M)
Type 2Fh. Pool: 5C00:11F9 EffDwarfGiantDefence — **changed**: creature type and size instead of the name list.
```pascal
hold_Victim := cr(c)^.target;                                   { 3600:1190  (unused) }
if (SelectedChar^.creature_type in [2, $0A]) and (SelectedChar^.size and $7F = 2) then   { 3600:11a5 / 11bd  +11Ah, +DEh }
  AttackRollValue := AttackRollValue - 4;                        { 3600:11cc }
```

### 3600:11D7 EffDefenceVsLargeType1 (M)
Type 30h. Pool: 5C00:1276 EffGnomeGiantDefence — **changed** (as 2Fh with creature type 1).
```pascal
if (SelectedChar^.creature_type = 1) and (SelectedChar^.size and $7F = 2) then   { 3600:11da / 11e6 }
  AttackRollValue := AttackRollValue - 4;                        { 3600:11f5 }
```

### 3600:1200 EffPrayer (H)
Type 31h. Pool: 5C00:12B2 — **same**.
```pascal
side := (e^.p3 and $10) div $10;                                 { 3600:1206 }
if c^.side = side then EffPlusOne(c, e, mode)                    { 3600:121a / 122d }
else begin AttackRollValue := AttackRollValue - 1;  SaveRoll := SaveRoll - 1 end;   { 3600:123d / 1241 }
```

### 3600:124B EffFireVulnerable (M)
Type 32h. Pool: 5C00:12FB EffSlowHeal — **new** behaviour.
```pascal
if DamageType and 2 <> 0 then SaveRoll := SaveRoll + 2           { 3600:124e / 1257  cold: +2 save }
else if (DamageType and 1 <> 0) and (SaveResult = 0) then        { 3600:125e / 1267  fire, not saved (COMBAT g_6FA8) }
  DamageAmount := DamageAmount shl 1;                            { 3600:126e }
```

### 3600:127E EffColdVulnerable (M)
Type 36h. Pool: 5C00:1355 EffNop36 — **new** behaviour.
```pascal
if DamageType and 1 <> 0 then SaveRoll := SaveRoll + 2           { 3600:1281 / 128a  fire: +2 save }
else if (DamageType and 2 <> 0) and (GameSaved = 0) then         { 3600:1291 / 129a }
  DamageAmount := DamageAmount shl 1;                            { 3600:12a1 }
```
`{ quirk: the mirror of 32h tests DS:5CF1 (GameSaved) where 32h tests SaveResult DS:6FA8; DS:5CF1 is 0 after every
non-save command, so the double damage applies even on a successful save (H bytes, L intent). }`

### 3600:12B1 EffNop37 (H)
Type 37h — empty `{ 3600:12b1 }` (the poison marker tested by EffSlowPoisonEnd). Pool: 5C00:135C — **same**.

### 3600:12BA EffGrantInvisible (H)
Type 38h. Pool: 5C00:1363 — **same**.
```pascal
AddEffect(c, $19, 1, $0C, 0);                                    { 3600:12ba }
```

### 3600:12DB EffHeld (H)
Type 3Ah. Pool: 5C00:1452 — **same**.
```pascal
cr(c)^.moveLeft := 0;                                            { 3600:12de }
if StatKind <> 0 then StatValue := 0;                            { 3600:12eb / 12f2 }
```

### 3600:12FD EffBecome62 (M)
Type 3Bh. Pool: 5C00:1472 — **same**.
```pascal
AddEffect(c, $62, 0, $FF, 0);                                    { 3600:12fd }
```

### 3600:131D EffNeedMagicWeaponHalf (M)
Type 3Ch. Pool: EffNop — **new** behaviour.
```pascal
p := CurrentAttackItem(SelectedChar);                            { 3600:1323 }
if (p = nil) or (p^.plus = 0) then DamageAmount := 0             { 3600:1335 / 1347 }
else if p^.plus < 3 then DamageAmount := DamageAmount div 2;     { 3600:134e / 1360  signed }
```

### 3600:1374 EffFireResistance (H)
Type 3Dh. Pool: 5C00:1490 — **same**.
```pascal
if DamageType and 1 <> 0 then begin                              { 3600:137a }
  for i := 1 to LastDiceCount do begin                           { 3600:1383 / 1395 }
    DamageAmount := DamageAmount - 2;                            { 3600:1398  −2 per die }
    if DamageAmount < LastDiceCount then DamageAmount := LastDiceCount;   { 3600:139d / 13a6  at least 1 per die }
  end;
  SaveRoll := SaveRoll + 4;                                      { 3600:13b4 }
  if DamageType and 8 = 0 then CancelDamageAndEffect(0);         { 3600:13b9 / 13c2  normal fire: no effect }
end;
```

### 3600:13CF EffRegenerate (H)
Type 3Eh. Pool: 5C00:14EB — **same**.
```pascal
if AddEffectUnlessCuring(c, $3E, e^.p3, $3C) then                { 3600:13d2 }
  if HealCharacter(c, 1, 1) then ShowHealingResult(c);           { 3600:13ef / 1404 }
```

### 3600:1415 EffMinorGlobe (M)
Type 3Fh. Pool: EffNop — **new**.
```pascal
if (sp_Current > 0) and (spells_Table[sp_Current].b[0] < 4) then CancelDamageAndEffect(0);   { 3600:1418 / 141f / 1431  DS:37DB + 16·sp, signed; spell level M }
```

### 3600:1454 PoisonOpponent (H)
`procedure PoisonOpponent(c [BP+8]: PChar; bonus [BP+6]: ShortInt)` (`RETF 6`). Pool: 5C00:1545 — **same**.
```pascal
hold_Victim := cr(c)^.target;                                   { 3600:145a }
if not SavingThrow(hold_Victim, 0, bonus) then begin            { 3600:146f }
  ShowCharacterMessage(hold_Victim, 'is Poisoned', $0A, 0);     { 3600:1487 }
  MessageDelay;                                                  { 3600:14a9 }
  AddEffect(hold_Victim, $37, 0, $FF, 0);                       { 3600:14ae }
  KillCombatant(hold_Victim, 6, 'is killed');                   { 3600:14c7 }
end;
```

### 3600:14F9 ParalyzeOpponent (H)
`procedure ParalyzeOpponent(c [BP+0Ah]: PChar; duration [BP+8]: Word; unused [BP+6])` (`RETF 8`). Pool: 5C00:15EB — **same**.
```pascal
hold_Victim := cr(c)^.target;                                   { 3600:14ff }
if not SavingThrow(hold_Victim, 0, 0) then begin                { 3600:1514 }
  ShowCombatMessageAnimation(hold_Victim, 1, 'is Paralyzed');   { 3600:152b }
  AddEffect(hold_Victim, $34, duration, $0C, 0);                { 3600:154a }
end;
```

### 3600:1569 EffPoisonHit (H) / 157F EffPoisonHitP4 (H) / 1595 EffPoisonHitP2 (H) / 16C2 EffPoisonHitM2 (H)
Types 40h / 41h / 42h / 46h. Pool: 5C00:165D / 1671 / 1685 / 170B — **same**.
```pascal
PoisonOpponent(c, 0);                                            { 3600:1569  (157f: +4, 1595: +2, 16c2: −2) }
```

### 3600:15AB EffParalyzeHit2d8 (H)
Type 43h. Pool: 5C00:1699 — **same**.
```pascal
ParalyzeOpponent(c, Roll(2, 8), 0);                              { 3600:15ab }
```

### 3600:15E6 EffFeeblemind (M)
Type 44h. Pool: 5C00:16BB EffGhoulParalysis — **new** behaviour. Name M ("is stupid", INT and WIS 7, a memorised spell lost).
```pascal
c^.int := 7;  c^.wis := 7;                                       { 3600:15ec / 15f4  current +13h, +15h }
ShowCharacterMessage(c, 'is stupid', $0A, 1);                    { 3600:15fc }
if view_Mode = 5 then begin                                      { 3600:161c  in combat }
  cr(c)^.mayCast := 0;                                           { 3600:1623 }
  if cr(c)^.b[0] > 0 then begin                                  { 3600:1630  the spell being prepared (M) }
    ShowCharacterMessage(c, 'lost a spell', $0C, 1);             { 3600:163e }
    ForgetMemorizedSpell(c, cr(c)^.b[0]);                        { 3600:165e }
    cr(c)^.b[0] := 0;                                            { 3600:1675 }
  end;
end;
```

### 3600:1687 EffInvisibleToType13 (L)
Type 45h. Pool: 5C00:16E6 EffParalyzeHitLong — **new** behaviour.
```pascal
if SelectedChar^.creature_type = $13 then begin                  { 3600:168d }
  if not HasEffect(SelectedChar, $18, p) then AttackBlocked := 1;   { 3600:1699 / 16b2 }
  AttackRollValue := AttackRollValue - 4;                        { 3600:16b7 }
end;
```

### 3600:16D8 EffUnattackable (M)
Type 47h. Pool: 5C00:171F — **same**.
```pascal
AttackBlocked := 1;  AttackRollValue := AttackRollValue - 4;     { 3600:16db / 16e0 }
```

### 3600:16EB EffGrantInvisible95 (H)
Type 48h. Pool: 5C00:1730 — **same**.
```pascal
if Roll(1, 100) <= 95 then AddEffect(c, $19, 1, $0C, 0);         { 3600:16ee / 16fd }
```

### 3600:1729 EffImmuneDamage20 (L)
Type 49h. Pool: ov13 EffRake — **new** here.
```pascal
if DamageType and $20 <> 0 then begin                            { 3600:172f }
  CancelDamageAndEffect(0);                                      { 3600:1738 }
  ShowCharacterMessage(c, 'is unaffected', $0A, 1);              { 3600:173f }
end;
```

### 3600:1765 EffNop4A (H)
Type 4Ah — empty body (a 2-byte local only) `{ 3600:1765 }`. Pool: type 4Ah was ov13 — **changed**.

### 3600:1771 EffBonusVsType3 (L)
Type 4Bh. Pool: 5C00:176F EffBloodDrain — **new** behaviour.
```pascal
hold_Victim := cr(c)^.target;                                   { 3600:1774 }
if hold_Victim^.creature_type = 3 then begin                    { 3600:1789 }
  DamageAmount := Roll(1, 12) * 3 + 4 + StrDamageAdj(c);         { 3600:1795 / 17ba }
  AttackRollValue := AttackRollValue + 2;                        { 3600:17bd }
end;
```

### 3600:17C8 EffBonusVsType8 (L)
Type 4Ch. Pool: 5C00:18B5 EffStirgeAttach — **new** behaviour.
```pascal
hold_Victim := cr(c)^.target;                                   { 3600:17cb }
if hold_Victim^.creature_type = 8 then begin                    { 3600:17e0 }
  AttackRollValue := AttackRollValue + 3;  DamageAmount := DamageAmount + 3;   { 3600:17ec / 17f1 }
end;
```

### 3600:1809 EffBerserk (M)
Type 4Dh. Pool: 5C00:1935 EffGrab — **new** behaviour. Name M ("goes berzerk").
```pascal
if mode = 0 then begin                                           { 3600:180f }
  c^.controlled := 1;                                            { 3600:1818 }
  if (c^.npc_morale <= $7F) or (c^.npc_morale = $B3) then c^.npc_morale := $B3   { 3600:1821 / 1837 }
  else c^.npc_morale := $B2;                                     { 3600:1842 }
  if view_Mode = 5 then begin                                    { 3600:184b }
    cr(c)^.target := nil;                                        { 3600:1855 }
    BuildTargetList(CombatantCol(c), CombatantRow(c), $FF, $FF, CombatantSize(c), cm_Map);   { 3600:1867 / 189a }
    cr(c)^.target := TargetChars[g_6E9A];                        { 3600:189f  DS:6D35 + 4·g_6E9A (VIEW target list) }
    cr(c)^.mayCast := 0;                                         { 3600:18c0 }
    c^.side := cr(c)^.target^.side xor 1;                        { 3600:18cd  fights against its target's side }
    ShowCharacterMessage(c, 'goes berzerk', $0A, 1);             { 3600:18e8 }
  end;
end else begin
  if c^.npc_morale = $B3 then c^.npc_morale := 0;                { 3600:190a / 1915 }
  c^.side := 0;                                                  { 3600:191e }
end;
```

### 3600:192D EffReviveCheck (H)
Type 4Eh. Pool: 5C00:19D9 — **same**.
```pascal
if not ReviveCombatant(c, c^.hp) then AddEffectUnlessCuring(c, $4E, e^.p3, 1);   { 3600:1933 / 194b }
```

### 3600:196D EffFireDamage (H) / 3600:19A2 EffAcidDamage (H)
Types 4Fh / 50h. Pool: 5C00:1A19 / 1A4C — **same**.
```pascal
DamageType := 9;                                                 { 3600:1970  (19a5: 10h acid) }
DamageCharacter(cr(c)^.target, RollDice(2, 10), 0, 0);           { 3600:1975  (19aa: RollDice(1, 4)) }
```

### 3600:19D7 EffHalveDamage (M)
Type 51h. Pool: 5C00:1AAA EffFearAura — **new** behaviour.
```pascal
DamageAmount := DamageAmount div 2;                              { 3600:19da }
```

### 3600:19EE EffEvadeFireCold (M)
Type 52h. Pool: 5C00:1BA8 EffFearOnce — **new** behaviour.
```pascal
if DamageType and 3 <> 0 then                                    { 3600:19f1 / 19fa  fire or cold }
  if SavingThrow(c, 4, 0) and (spells_Table[sp_Current].b[7] <> 0) then DamageAmount := 0   { 3600:1a03 / 1a18 / 1a2a  DS:37E2 = half-on-save flag (M) }
  else DamageAmount := DamageAmount div 2;                       { 3600:1a31 }
```

### 3600:1A65 EffStoneGaze (H)
Type 53h. Pool: 5C00:1CAD — **same** (items `+14Dh`; item `+34h readied`, name words `+2Fh..+31h`, 76h = "Mirror").
```pascal
hold_Victim := cr(c)^.target;                                   { 3600:1a6b }
ShowCharacterMessage(c, 'gazes...', $0A, 0);                     { 3600:1a80 }
BuildFourAnimationFrames($12);                                   { 3600:1aa0 }
AnimateAlongPath(CombatantCol(c), CombatantRow(c), CombatantCol(hold_Victim), CombatantRow(hold_Victim), 4, $2D);   { 3600:1aa8 .. 1ae6 }
if HasEffect(c, $7F, p) then begin                               { 3600:1aeb }
  reflected := false;  it := hold_Victim^.items;                { 3600:1b05 / 1b09 }
  while (it <> nil) and not reflected do begin                   { 3600:1b1a / 1b25 }
    if (it^.readied <> 0) and ((it^.b[$2F] = $76) or (it^.b[$30] = $76) or (it^.b[$31] = $76)) then begin   { 3600:1b2e / 1b3b }
      ShowCharacterMessage(hold_Victim, 'reflects it!', $0C, 0);   { 3600:1b59 }
      AnimateAlongPath(CombatantCol(hold_Victim), CombatantRow(hold_Victim), CombatantCol(c), CombatantRow(c), 4, $2D);   { 3600:1b7b .. 1bb9 }
      reflected := true;  hold_Victim := c;                     { 3600:1bbe / 1bc2 }
    end;
    it := it^.next;                                              { 3600:1bce }
  end;
end;
if not SavingThrow(hold_Victim, 1, 0) then KillCombatant(hold_Victim, 7, 'is Stoned');   { 3600:1be0 / 1bf7 }
```

### 3600:1C1C EffElectricityHeals (M)
Type 54h. Pool: 5C00:1E77 EffCharmGaze — **new** behaviour.
```pascal
if DamageType and 4 <> 0 then begin                              { 3600:1c22 }
  CancelDamageAndEffect(0);                                      { 3600:1c2b }
  n := Roll(1, 8);                                               { 3600:1c32  unused }
  c^.hp := c^.hp + 8;                                            { 3600:1c40 }
end;
```
`{ quirk: the 1d8 roll is discarded; the creature always gains 8 HP, without a maximum. }`

### 3600:1C4F EffOneDamageFromWflag1 (L)
Type 55h. Pool: 5C00:23A4 EffDrainOne — **new** behaviour.
```pascal
p := CurrentAttackItem(SelectedChar);                            { 3600:1c55 }
if (p <> nil) and (ItemTypeTable[p^.type].wflags = 1) then DamageAmount := 1;   { 3600:1c67 / 1c6f / 1c85  DS:5CFD + 16·type }
```

### 3600:1C90 EffDisplacement (H)
Type 59h. Pool: 5C00:2490 — **same**.
```pascal
if (CombatRound = 0) and (AttackRollValue = 0) then e^.p3 := e^.p3 and $0F   { 3600:1c93 / 1c9a / 1ca1  CombatRound (Pool vote) }
else if e^.p3 and $10 = 0 then begin                             { 3600:1cb3 }
  AttackRollValue := -1;  e^.p3 := e^.p3 or $10;                 { 3600:1cc0 / 1cc5  the first attack misses }
end;
```

### 3600:1CF6 EffCloud9Removed (M)
Type 5Bh. Pool: 5C00:064E EffShield — **new** behaviour: EffCloudRemoved for the second cloud list `g_755F` (3×3
clouds: squares k = 1..9 with steps DS:27DB+k, remaining clouds re-marked with tile 1Ch).
```pascal
id := e^.p3 div 16;  found := false;  a := cloud9_List;               { 3600:1cfc / 1d0e / 1d12 }
{ search, restore 9 squares (bodies → 1Fh), unlink, FreeMem(a, 1Eh), re-mark: as EffCloudRemoved }   { 3600:1d1e .. 1fbb }
ShowTimedBottomMessage('The air clears a little...');            { 3600:1d6a }
FreeMem(a, $1E);                                                 { 3600:1f13 }
```

### 3600:1FC4 EffHalveFire (H)
Type 5Dh. Pool: 5C00:25A2 — **same**.
```pascal
if DamageType and 1 <> 0 then DamageAmount := DamageAmount div 2;   { 3600:1fc7 / 1fd0 }
```

### 3600:1FE4 EffHalveWeapon (H)
Type 5Eh. Pool: 5C00:25BC — **same** (ItemTypeTable `wflags` +7, DS:5CFD + 16·type).
```pascal
p := CurrentAttackItem(SelectedChar);                            { 3600:1fea }
if (p <> nil) and (ItemTypeTable[p^.type].wflags and $81 <> 0) then DamageAmount := DamageAmount div 2;   { 3600:1ffc / 2004 / 201d }
```

### 3600:203C EffFallsDead (H)
Type 5Fh. Pool: 5C00:2610 — **same** (active `+196h`).
```pascal
e^.callOnRemove := 0;                                            { 3600:2042 }
if c^.active <> 0 then KillCombatant(c, 6, 'Falls dead');        { 3600:204a / 2055 }
```

### 3600:2078 EffConSaveBonusMagic (H)
Type 61h. Pool: 5C00:268A — **same** (current CON `+19h`).
```pascal
if (SaveType = 4) or (SaveType = 2) then begin                   { 3600:207e / 2085 }
  case c^.con of 4..6: b := 1; 7..10: b := 2; 11..13: b := 3; 14..17: b := 4; 18..20: b := 5 end;   { 3600:208c .. 20df }
  SaveRoll := SaveRoll + b;                                      { 3600:20e3 }
end;
```
`{ quirk (as Pool): for CON outside 4..20 the local b is uninitialised. }`

### 3600:20FA EffRegenerate3 (H)
Type 62h. Pool: 5C00:2700 — **same**.
```pascal
c^.hp := c^.hp + 3;  if c^.hp > c^.hp_max then c^.hp := c^.hp_max;   { 3600:20fd / 2106 / 2117 }
```

### 3600:212C EffReviveOnce (H)
Type 63h. Pool: 5C00:2730 — **same** (status `+195h`; combat record `+0Eh` dying counter).
```pascal
n := 0;                                                          { 3600:2132 }
if (c^.status = 5) and (cr(c)^.b[$0E] < 6) then n := 6 - cr(c)^.b[$0E];   { 3600:2136 / 2141 / 2150 }
if c^.status = 4 then n := 6;                                    { 3600:2168 / 2173 }
if (n > 0) and ReviveCombatant(c, n) then begin                  { 3600:2177 / 217d }
  AddEffect(c, $5F, Roll(1, 4) + 1, $FF, 1);                     { 3600:2190 }
  e^.callOnRemove := 0;                                          { 3600:21b3 }
  RemoveEffect(c, $63, e);                                       { 3600:21bb }
end;
```

### 3600:21D5 EffTrollDown (H)
Type 64h. Pool: 5C00:27D9 — **same**.
```pascal
if (DamageType and 1 = 0) and (DamageType and $10 = 0) then AddEffect(c, $66, Roll(3, 6), $FF, 1);   { 3600:21d8 / 21e1 / 21e8 }
```

### 3600:2212 EffStartRegenerating (H)
Type 65h. Pool: 5C00:2814 — **same**.
```pascal
if not HasEffect(c, $62, p)                                      { 3600:2218 }
   and not HasEffect(c, $3B, p) then                             { 3600:222f }
  AddEffect(c, $3B, 3, $FF, 1);                                  { 3600:2246 }
```

### 3600:2264 EffTrollRise (H)
Type 66h. Pool: 5C00:2866 — **same**.
```pascal
if not ReviveCombatant(c, c^.hp_max) then AddEffectUnlessCuring(c, $66, e^.p3, 1);   { 3600:226a / 2281 }
```

### 3600:22A3 EffFireBonusD6 (M)
Type 67h. Pool: 5C00:28BF EffGaseousEscape — **new** behaviour.
```pascal
hold_Victim := cr(c)^.target;                                   { 3600:22a9 }
if not HasEffect(hold_Victim, $14, p)                            { 3600:22be }
   and not HasEffect(hold_Victim, $36, p)                        { 3600:22d7 }
   and not HasEffect(hold_Victim, $3D, p) then                   { 3600:22f0 }
  DamageAmount := DamageAmount + Roll(1, 6);                     { 3600:2309 }
```

### 3600:231E EffAvoidMissiles60 (H)
Type 68h. Pool: 5C00:2901 — **same**.
```pascal
AvoidRangedAttack(c, 60);                                        { 3600:2321 }
```

### 3600:2334 MagicResistance (H)
`procedure MagicResistance(pct [BP+6]: Byte)` (`RETF 2`, near). Pool: 5C00:2915 — **changed**: the level term is added.
```pascal
lvl := SpellCasterLevel(sp_Current);                             { 3600:233a  the caster's level for this spell (ov24) }
chance := (11 - lvl) * 5 + pct;                                  { 3600:2346  byte }
if (EffectToApply <> 0) or (DamageType and 8 <> 0) then          { 3600:2363 / 236a }
  if Roll(1, 100) <= chance then CancelDamageAndEffect(0);       { 3600:2375 / 2385 }
```
`{ quirk: Pool subtracted the level term; Curse adds it, so spells of low-level casters are resisted more often; chance is a byte
(lvl > 11 wraps). }`

### 3600:2392 EffMagicRes50 (H) / 3600:23A2 EffMagicRes15 (H)
Types 69h / 6Ah. Pool: 5C00:2976 / 2984 — **same** (with Curse's MagicResistance).
```pascal
MagicResistance(50);                                             { 3600:2395  (23a5: 15) }
```

### 3600:23B2 EffResistSleepCharm90 (H) / 3600:282F EffResistSleepCharm30 (H)
Types 6Bh / 7Ch. Pool: 5C00:2992 / 2DE4 — **same**.
```pascal
if Roll(1, 100) <= 90 then begin                                 { 3600:23b5  (2832: 30) }
  CancelDamageAndEffect($35);                                    { 3600:23c4  (282F: 0Bh at 2841) }
  CancelDamageAndEffect($0B);                                    { 3600:23cb  (282F: 35h at 2848) }
end;
```

### 3600:23D8 EffImmuneSleepCharm (H)
Type 6Ch. Pool: 5C00:29B6 — **same**.
```pascal
CancelDamageAndEffect($0B);                                      { 3600:23db }
CancelDamageAndEffect($35);                                      { 3600:23e2 }
```

### 3600:23EF EffImmuneHold (H)
Type 6Dh. Pool: 5C00:29CB — **same**.
```pascal
CancelDamageAndEffect($34);                                      { 3600:23f2 }
```

### 3600:23FF EffImmuneCold (H) / 3600:243B EffImmuneFire (H) / 3600:2B0F EffImmuneElectricity (M)
Types 6Eh / 70h / 87h. Pool: 5C00:29D9 / 2A11 — **same**; 87h Pool ItemNeedsGiantStrength — **new** behaviour.
```pascal
if DamageType and 2 <> 0 then CancelDamageAndEffect(0);          { 3600:2402 / 240b  (243e: and 1; 2b12: and 4) }
```

### 3600:2418 EffImmunePoisonParalysis (H)
Type 6Fh. Pool: 5C00:29F0 — **same**.
```pascal
CancelDamageAndEffect($37);                                      { 3600:241b }
CancelDamageAndEffect($34);                                      { 3600:2422 }
if SaveType = 0 then SaveRoll := 100;                            { 3600:2429 / 2430 }
```

### 3600:2454 EffFireMinusOnePerDie (H)
Type 71h. Pool: 5C00:2A28 — **same**.
```pascal
if DamageType and 1 <> 0 then                                    { 3600:245a }
  for i := 1 to LastDiceCount do begin                           { 3600:2463 / 2475 }
    DamageAmount := DamageAmount - 1;                            { 3600:2478 }
    if DamageAmount < LastDiceCount then DamageAmount := LastDiceCount;   { 3600:247c / 2485 }
  end;
```

### 3600:2499 EffHalveElectricity (H) / 3600:259A EffHalveCold (H)
Types 72h / 76h. Pool: 5C00:2A6D / 2B63 — **same**.
```pascal
if DamageType and 4 <> 0 then DamageAmount := DamageAmount div 2;   { 3600:249c / 24a5  (259d: and 2) }
```

### 3600:24B9 EffHalveEdged (H)
Type 73h. Pool: 5C00:2A87 — **same**.
```pascal
p := CurrentAttackItem(SelectedChar);                            { 3600:24bf }
if (p <> nil) and ((ItemTypeTable[p^.type].wflags = 0) or (ItemTypeTable[p^.type].wflags and 1 <> 0)) then   { 3600:24d1 / 24d9 / 24ef }
  DamageAmount := DamageAmount div 2;                            { 3600:2508 }
```

### 3600:251C EffHalveMagicWeapon (H)
Type 74h. Pool: 5C00:2AE6 — **same**.
```pascal
p := CurrentAttackItem(SelectedChar);                            { 3600:2522 }
if (p <> nil) and (p^.plus > 0) then DamageAmount := DamageAmount div 2;   { 3600:2534 / 253c / 2546  signed }
```

### 3600:255A EffHolyWater (H)
Type 75h. Pool: 5C00:2B20 — **same**.
```pascal
p := SelectedChar^.readied[0];                                   { 3600:2560 }
if (p <> nil) and (p^.type = $55) then DamageAmount := RollDice(1, 6) + 1;   { 3600:2571 / 2579 / 2583 }
```

### 3600:25BA EffNeedMagicWeapon (H)
Type 77h. Pool: 5C00:2B7D — **same** (race `+74h`, level_main `+E5h`).
```pascal
p := CurrentAttackItem(SelectedChar);                            { 3600:25c0 }
if (p = nil) or (p^.plus = 0) then                               { 3600:25d2 / 25da }
  if (SelectedChar^.race > 0) or (SelectedChar^.level_main < 4) then DamageAmount := 0;   { 3600:25e4 / 25ef / 25fb  signed: monsters of 4+ HD hit }
```

### 3600:2606 EffAvoidBoulders (H)
Type 78h. Pool: 5C00:2BC8 — **same**.
```pascal
p := SelectedChar^.readied[0];                                   { 3600:260c }
if (p <> nil) and (p^.type in [$57, $58]) then AvoidRangedAttack(c, 50);   { 3600:261d / 2625 / 263c }
```

### 3600:2657 EffSpitAcid (H)
Type 79h. Pool: 5C00:2C1C — **same**.
```pascal
hold_Victim := cr(c)^.target;                                   { 3600:265d }
if Roll(1, 100) <= 25 then                                       { 3600:2672 }
  if TargetDistance(c, hold_Victim) < 4 then begin              { 3600:2684 }
    ClearCombatantActionFlags(c);                                { 3600:269e }
    ShowCharacterMessage(c, 'Spits Acid', $0A, 1);               { 3600:26a9 }
    BuildFourAnimationFrames($17);                               { 3600:26cc }
    AnimateAlongPath(CombatantCol(c), CombatantRow(c), CombatantCol(hold_Victim), CombatantRow(hold_Victim), 1, $1E);   { 3600:26d4 .. 2712 }
    DamageCharacter(hold_Victim, RollDice(8, 4), 2, SavingThrow(hold_Victim, 3, 0));   { 3600:2717 / 2742  half on a save }
    RemoveEffect(c, $79, e);                                     { 3600:2747 }
    RemoveEffect(c, $50, nil);                                   { 3600:275b }
  end;
```

### 3600:2782 EffParalyzeOnHit (M)
Type 7Ah. Pool: 5C00:2D38 EffOilFlask — **new** behaviour.
```pascal
hold_Victim := cr(c)^.target;                                   { 3600:2788 }
if not SavingThrow(hold_Victim, 0, 0) then begin                { 3600:279d / 27b3 }
  AddEffect(hold_Victim, $34, 0, $FF, 0);                       { 3600:27b9 }
  ShowCharacterMessage(hold_Victim, 'is paralyzed', $0A, 1);    { 3600:27d2 }
end;
```

### 3600:27FA EffColdDamage2d8 (M)
Type 7Bh. Pool: 5C00:2D88 EffNeedMagicSilverHalf — **new** behaviour.
```pascal
DamageType := $0A;                                               { 3600:27fd  cold + magic }
DamageCharacter(cr(c)^.target, RollDice(2, 8), 0, 0);            { 3600:2802 }
```

### 3600:2855 EffUndeadImmunities (H)
Type 7Dh. Pool: 5C00:2E08 — **same**.
```pascal
CancelDamageAndEffect($0B);                                      { 3600:2858 }
CancelDamageAndEffect($35);                                      { 3600:285f }
CancelDamageAndEffect($34);                                      { 3600:2866 }
CancelDamageAndEffect($37);                                      { 3600:286d }
if SaveType = 0 then SaveRoll := 100;                            { 3600:2874 / 287b }
```

### 3600:289C EffParalyzingGaze (M)
Type 7Eh. Pool: 5C00:2E37 EffWardedByItem — **new** behaviour (EffStoneGaze without the mirror, paralysis instead of stone).
```pascal
hold_Victim := cr(c)^.target;                                   { 3600:28a2 }
ShowCharacterMessage(c, 'gazes...', $0A, 0);                     { 3600:28b7 }
BuildFourAnimationFrames($12);                                   { 3600:28d7 }
AnimateAlongPath(CombatantCol(c), CombatantRow(c), CombatantCol(hold_Victim), CombatantRow(hold_Victim), 4, $2D);   { 3600:28df .. 291d }
if not SavingThrow(hold_Victim, 1, 0) then begin                { 3600:2922 }
  AddEffect(hold_Victim, $34, 0, $FF, 0);                       { 3600:2939 }
  ShowCharacterMessage(hold_Victim, 'is paralyzed', $0A, 0);    { 3600:2952 }
end;
```

### 3600:297A EffImmuneMagic (M)
Type 81h. Pool: ItemGrantsEffect — **new** behaviour.
```pascal
if (EffectToApply <> 0) or (DamageType and 8 <> 0) then CancelDamageAndEffect(0);   { 3600:297d / 2984 / 298f }
```

### 3600:299C EffSlainBySpecialArrow (L)
Type 82h. Pool: ItemGrantsEffect — **new** behaviour: the creature dies when hit by an arrow-type item 1Ch with name word
87h (meaning L).
```pascal
p := nil;                                                        { 3600:29a2 }
if GetMissileAmmo(SelectedChar, p) and (p^.type = $1C) and (p <> nil) and (p^.b[$31] = $87) then begin   { 3600:29aa / 29c0 / 29ca / 29d2 }
  c^.status := 8;  c^.active := 0;  c^.hp := 0;                  { 3600:29dc / 29e5 / 29ee  8 = Gone }
  RemoveCombatEffects(c);                                        { 3600:29f7 }
  CallEffectHooks($0D, c);                                       { 3600:2a02  event 0Dh "went down" }
  if c^.active = 0 then RemoveCombatant(c);                      { 3600:2a10 / 2a1b }
end;
```

### 3600:2A2C ItemGrantsEffect (H)
Type 93h (an item power; `e` is the item). Pool: 5C00:2EDA — **same** (Curse moved it from types 80h..8Bh to 93h).
```pascal
item_HookMode := 0;  it := PItem(e);                                    { 3600:2a32 / 2a37 }
if mode <> 0 then RemoveEffect(c, it^.b[$3D], nil)               { 3600:2a42 / 2a48 }
else begin
  AddEffect(c, it^.b[$3D], 0, $FF, 1);                           { 3600:2a63 }
  if view_Mode <> 5 then CallEffectHandler(it^.b[$3D], c, nil, 0);   { 3600:2a7f / 2a86 }
end;
```

### 3600:2AA8 EffImmuneFearWeakness (L)
Type 85h. Pool: ItemGrantsEffect — **new** behaviour.
```pascal
CancelDamageAndEffect($8E);                                      { 3600:2aab }
CancelDamageAndEffect($1D);                                      { 3600:2ab2 }
CancelDamageAndEffect($44);                                      { 3600:2ab9 }
if DamageType and $40 <> 0 then CancelDamageAndEffect(0);        { 3600:2ac0 / 2ac9 }
```

### 3600:2AD6 EffRangerBonusVsFlag8 (M)
Type 86h. Pool: ItemGrantsEffect — **new** behaviour (AD&D ranger damage bonus vs giant-class foes, M).
```pascal
hold_Victim := cr(c)^.target;                                   { 3600:2ad9 }
if hold_Victim^.b[$14B] and 8 <> 0 then DamageAmount := DamageAmount + c^.level[4];   { 3600:2aee / 2afd  +10Dh }
```

### 3600:2B28 EffNoMove (M)
Type 88h. Pool: ItemGrantsEffect — **new** behaviour.
```pascal
cr(c)^.moveLeft := 0;                                            { 3600:2b2b }
```

### 3600:2B3E EffTurnOnAllies (M)
Type 89h (set by EffConfusion "goes berserk"). Pool: 5C00:317A ItemRemove17 — **new** behaviour (EffBerserk without the
message and the combat test).
```pascal
if mode = 0 then begin                                           { 3600:2b41 }
  c^.controlled := 1;                                            { 3600:2b4a }
  if (c^.npc_morale <= $7F) or (c^.npc_morale = $B3) then c^.npc_morale := $B3 else c^.npc_morale := $B2;   { 3600:2b53 / 2b69 / 2b74 }
  cr(c)^.target := nil;                                          { 3600:2b7d }
  BuildTargetList(CombatantCol(c), CombatantRow(c), $FF, $FF, CombatantSize(c), cm_Map);   { 3600:2b8f / 2bc2 }
  cr(c)^.target := TargetChars[g_6E9A];                          { 3600:2bc7 }
  c^.side := cr(c)^.target^.side xor 1;                          { 3600:2be8 }
end else begin
  if c^.npc_morale = $B3 then c^.npc_morale := 0;                { 3600:2c05 / 2c10 }
  c^.side := e^.p3;                                              { 3600:2c19 }
end;
```

### 3600:2C2E EffPermanentInvisibility (M)
Type 8Ah. Pool: ItemGrantsEffect — **new** behaviour.
```pascal
AddEffect(c, $19, $FF, $FF, 0);                                  { 3600:2c31 }
```

### 3600:2C4F EffPaladinCuresReset (M)
Type 8Dh (new). Pool: — **new**. When removed: the paladin's cure-disease uses `+191h` are reset from the paladin level.
```pascal
if mode <> 0 then                                                { 3600:2c52 }
  c^.cures_left := (c^.level[3] + c^.old_level[3] * DualClassActive(c) - 1) div 5 + 1;   { 3600:2c58 / 2c86  +10Ch, +114h }
```

### 3600:2C94 EffRunsAwayEnd (M)
Type 8Eh (new; set by EffConfusion "runs away"). Pool: — **new**.
```pascal
if mode <> 0 then begin                                          { 3600:2c97 }
  if c^.npc_morale = $B3 then begin c^.npc_morale := 0;  c^.controlled := 0 end;   { 3600:2c9d / 2ca8 / 2cb1 }
  cr(c)^.b[$10] := 0;                                            { 3600:2cba  no longer fleeing }
end;
```

### 3600:2CD9 EffZapAttacker (M)
Type 8Fh (new). Pool: — **new** (shape 0.65 to EffStartsToTrain, unrelated).
```pascal
if TargetDistance(SelectedChar, c) < 2 then begin                { 3600:2cdf }
  oldDmg := DamageAmount;  DamageAmount := DamageAmount shl 1;   { 3600:2cf6 / 2cfc }
  oldType := DamageType;  DamageType := 8;                       { 3600:2d06 / 2d0c }
  ShowCharacterMessage(SelectedChar, 'gets zapped', $0A, 1);     { 3600:2d11 }
  DamageCharacter(SelectedChar, DamageAmount, 0, 0);             { 3600:2d33  the melee attacker takes double, magic }
  DamageAmount := oldDmg;  DamageType := oldType;                { 3600:2d4a / 2d50 }
end;
```

### 3600:2D7D EffDispelEvil (H)
Type 91h (new). Pool: — **new**. Name H (strings).
```pascal
hold_Victim := cr(c)^.target;                                   { 3600:2d83 }
if (hold_Victim^.b[$14B] and 1 <> 0) and not SavingThrow(hold_Victim, 4, 0) then begin   { 3600:2d98 / 2da7 }
  KillCombatant(hold_Victim, 8, 'is dispelled');                { 3600:2dbe  8 = Gone }
  RemoveEffect(SelectedChar, 4, nil);                            { 3600:2ddd  the spell ends }
  RemoveEffect(SelectedChar, $91, nil);                          { 3600:2df3 }
end
else ShowCharacterMessage(hold_Victim, 'resists dispel evil', $0A, 1);   { 3600:2e0b }
```
`+14Bh` bit 0 = an "evil / summoned" creature flag (M from this handler and type 04h, which gives −7 to its attacks).

### 3600:2E33 EffNop (H)
Types 05h, 13h, 18h, 5Ch, 7Fh, 8Ch, 92h — empty `{ 3600:2e33 }`. Pool: 5C00:319B — **same**.

### 3600:2E3C InstallEffectHandlers (H)
`procedure InstallEffectHandlers` (far, stub ov12 e1) — caller: ov11_0056 (ENGINE). Pool: 5C00:31A2 — **same** mechanism
(556/569 aligned). Stores far pointers (stub entries, segment 0094h) into `EffectHandler[t]` = DS:6FA6+4t for t = 01h..93h
(141 stores `{ 3600:2e3f .. 3568 }`); slots 56h, 58h, 5Ah, 80h, 83h, 84h are never written (nil). The table:
| | | | | | |
|---|---|---|---|---|---|
| 01h EffBless | 02h EffCurse | 03h EffSnakes | 04h EffHitPenaltyVsFlag1 | 05h EffNop | 06h EffFlameTongue |
| 07h EffAcBonus2 | 08h EffProtFromEvil | 09h EffProtFromGood | 0Ah EffResistCold | 0Bh EffCharm | 0Ch EffNop0C |
| 0Dh EffSuffocate | 0Eh EffNop0E | 0Fh EffHpLossTick | 10h EffNop10 | 11h EffShield | 12h EffHitBonusVsFlag2 |
| 13h EffNop | 14h EffResistFire | 15h EffSilence | 16h EffSlowPoisonEnd | 17h EffSpiritualHammer | 18h EffNop |
| 19h EffInvisible | 1Ah EffHitBonusVsFlag4 | 1Bh EffHelpless | 1Ch EffMirrorImage | 1Dh EffDamageMinusQuarter | 1Eh EffCoughing |
| 1Fh EffHelpless | 20h EffAnimatedEnd | 21h EffPenaltyAll4 | 22h EffWeaknessAndDrain | 23h EffConfusion | 24h EffPenalty4 |
| 25h EffUntouchableAfterTurn | 26h EffNop0C | 27h EffHaste | 28h EffCloudRemoved | 29h EffMagicWeaponOnly | 2Ah EffSlow |
| 2Bh EffWeakness | 2Ch EffHpDrainTick | 2Dh EffProtFromEvil | 2Eh EffProtFromGood | 2Fh EffDefenceVsLargeGiants | 30h EffDefenceVsLargeType1 |
| 31h EffPrayer | 32h EffFireVulnerable | 33h EffHelpless | 34h EffHelpless | 35h EffHelpless | 36h EffColdVulnerable |
| 37h EffNop37 | 38h EffGrantInvisible | 39h EffEngulf (COMBAT) | 3Ah EffHeld | 3Bh EffBecome62 | 3Ch EffNeedMagicWeaponHalf |
| 3Dh EffFireResistance | 3Eh EffRegenerate | 3Fh EffMinorGlobe | 40h EffPoisonHit | 41h EffPoisonHitP4 | 42h EffPoisonHitP2 |
| 43h EffParalyzeHit2d8 | 44h EffFeeblemind | 45h EffInvisibleToType13 | 46h EffPoisonHitM2 | 47h EffUnattackable | 48h EffGrantInvisible95 |
| 49h EffImmuneDamage20 | 4Ah EffNop4A | 4Bh EffBonusVsType3 | 4Ch EffBonusVsType8 | 4Dh EffBerserk | 4Eh EffReviveCheck |
| 4Fh EffFireDamage | 50h EffAcidDamage | 51h EffHalveDamage | 52h EffEvadeFireCold | 53h EffStoneGaze | 54h EffElectricityHeals |
| 55h EffOneDamageFromWflag1 | 56h nil | 57h EffEyeRays (COMBAT) | 58h nil | 59h EffDisplacement | 5Ah nil |
| 5Bh EffCloud9Removed | 5Ch EffNop | 5Dh EffHalveFire | 5Eh EffHalveWeapon | 5Fh EffFallsDead | 60h EffHug (COMBAT) |
| 61h EffConSaveBonusMagic | 62h EffRegenerate3 | 63h EffReviveOnce | 64h EffTrollDown | 65h EffStartRegenerating | 66h EffTrollRise |
| 67h EffFireBonusD6 | 68h EffAvoidMissiles60 | 69h EffMagicRes50 | 6Ah EffMagicRes15 | 6Bh EffResistSleepCharm90 | 6Ch EffImmuneSleepCharm |
| 6Dh EffImmuneHold | 6Eh EffImmuneCold | 6Fh EffImmunePoisonParalysis | 70h EffImmuneFire | 71h EffFireMinusOnePerDie | 72h EffHalveElectricity |
| 73h EffHalveEdged | 74h EffHalveMagicWeapon | 75h EffHolyWater | 76h EffHalveCold | 77h EffNeedMagicWeapon | 78h EffAvoidBoulders |
| 79h EffSpitAcid | 7Ah EffParalyzeOnHit | 7Bh EffColdDamage2d8 | 7Ch EffResistSleepCharm30 | 7Dh EffUndeadImmunities | 7Eh EffParalyzingGaze |
| 7Fh EffNop | 80h nil | 81h EffImmuneMagic | 82h EffSlainBySpecialArrow | 83h nil | 84h nil |
| 85h EffImmuneFearWeakness | 86h EffRangerBonusVsFlag8 | 87h EffImmuneElectricity | 88h EffNoMove | 89h EffTurnOnAllies | 8Ah EffPermanentInvisibility |
| 8Bh EffEngulfHold (COMBAT) | 8Ch EffNop | 8Dh EffPaladinCuresReset | 8Eh EffRunsAwayEnd | 8Fh EffZapAttacker | 90h EffHugHold (COMBAT) |
| 91h EffDispelEvil | 92h EffNop | 93h ItemGrantsEffect |

### 3600:356C ov12_init — empty (H)

---

## ov20 (5400) — game clock, rest clock, resting (healing, memorising, scribing, rest encounters)

Pool twin: Pool ov20 (8400) (PoolRadianceRE PARTY.pas.md) — **changed**: RestLoop and DailyHealing take a `show` flag
(resting without the rest screen), the study timer no longer wraps, the effect count-down no longer re-walks the list, menu
letters `Rest Days Hours Mins Add Subtract Exit`, a new interruption message. Globals: game clock = VM words 4BC6..4BCC
(`ecl_Mem4B00`, digits 0..6 = minutes, ten-minutes, hours, days, months?, ..., years; ClockLimits DS:3E2A, words), `RestClock`
DS:7566 (7 words, [1] minutes .. [4] days at DS:756E, [5] months DS:7570), `EffectsPending` DS:4AFC ([i] at DS:4AFB+i, 72
bytes), `StudyTimer` DS:7574 ([i] at DS:7573+i), `HealCounter` DS:757C, `RestActive` DS:757E, `RestEncCounter` DS:4FC3.
Record fields: `rest_need +72h` (Pool +2Ch), `mem_spell[k] +1Eh+k` (k = 0..83, Pool +17h, 21 slots), `known_spell[s] +78h+s`
(Pool +32h+s), effects `+F2h`, age `+76h`, next `+189h`; spells_Table level = byte 0 of the 16-byte entry DS:37DB + 16·id.

### 5400:0000 ov20_0000 — pre-load overlay units (H)
Calls the empty entries of ov34, ov22, ov23, ov24, ov26 `{ 5400:0000 }`. Pool: — **new**.

### 5400:0020 TickEffects (H)
`procedure TickEffects(count [BP+8], unit [BP+6]: Byte)` (`RETF 4`) — caller: AdvanceClock. Pool: 8400:0000 — **changed**
(204/248): after an expired effect the walk continues with `prev^.next` (Pool used the saved `next`, and read it even for an
empty list).
```pascal
if view_Mode = 2 then begin                                      { 5400:0026  camp }
  any := false;  i := 1;                                         { 5400:0040 / 0044 }
  repeat if EffectsPending[i] <> 0 then any := true;  Inc(i)     { 5400:0048 / 005a }
  until any or (i > ecl_Mem7C00^.w[$67C div 2]);                 { 5400:005d / 0063  party size, VM 7F3E }
  if not any then Exit;                                          { 5400:0073 }
end else FillChar(EffectsPending, $48, 1);                       { 5400:002d }
minutes := count;  u := unit;                                    { 5400:007c / 0084 }
while u > 1 do begin minutes := ClockLimits[u - 1] * minutes; u := u - 1 end;   { 5400:008a / 0090 / 00a4 }
while minutes > 0 do begin                                       { 5400:00ae }
  if minutes > 10 then chunk := 10 else chunk := minutes;        { 5400:00b7 }
  i := 1;  c := PartyList;                                       { 5400:00c9 / 00cd }
  while c <> nil do begin                                        { 5400:00d9 }
    if EffectsPending[i] <> 0 then begin                         { 5400:00e4 }
      EffectsPending[i] := 0;                                    { 5400:00f5 }
      e := c^.effects;  last := c^.effects;  prev := c^.effects; { 5400:0101 / 0111 / 0121 }
      if c^.effects <> nil then while last^.next <> nil do last := last^.next;   { 5400:0131 / 0140 / 014d }
      done := false;                                             { 5400:015e }
      while (e <> nil) and not done do begin                     { 5400:0162 / 016d }
        if e = last then done := true;                           { 5400:0176 / 0185 }
        if e^.duration = 0 then e := e^.next                     { 5400:0189 / 0193 }
        else if chunk < e^.duration then begin                   { 5400:01a5 }
          e^.duration := e^.duration - chunk;  EffectsPending[i] := 1;  e := e^.next;   { 5400:01b3 / 01bf / 01cb }
        end else begin
          RemoveEffect(c, e^.type, e);                           { 5400:01dc }
          if prev = c^.effects then e := c^.effects else e := prev^.next;   { 5400:01f4 / 020a / 021c }
        end;
        prev := c^.effects;                                      { 5400:022b }
        while (prev <> nil) and (prev <> e) and (prev^.next <> e) do prev := prev^.next;   { 5400:023b / 0243 / 0252 / 0265 }
      end;
      while e <> nil do begin                                    { 5400:0279 }
        if e^.duration > 0 then EffectsPending[i] := 1;          { 5400:0281 / 028b }
        e := e^.next;                                            { 5400:0297 }
      end;
    end;
    Inc(i);  c := c^.next;                                       { 5400:02a8 / 02ab }
  end;
  if minutes > 10 then minutes := minutes - 10 else minutes := 0;   { 5400:02be / 02c4 / 02ca }
end;
```
`{ quirk (as Pool): when the expired effect was the head's successor the walk restarts at the head, so earlier effects
are counted down twice in the same chunk. }`

### 5400:02D8 CarryClock (H)
`procedure CarryClock(var clk [BP+6]: array[0..6] of Word)` (`RETF 4`). Pool: 8400:02F2 — **same** (age `+76h`).
```pascal
for i := 0 to 6 do                                               { 5400:02de }
  if clk[i] >= ClockLimits[i] then                               { 5400:02e7 / 0301 }
    if i = 6 then begin                                          { 5400:0305 }
      c := PartyList;  while c <> nil do begin c^.age := c^.age + 1;  c := c^.next end;   { 5400:0349 / 035d / 0364 }
    end else begin
      clk[i + 1] := clk[i + 1] + 1;                              { 5400:030b }
      clk[i] := clk[i] - ClockLimits[i];                         { 5400:031b }
    end;
```

### 5400:0385 NormalizeRestClock (H)
`procedure NormalizeRestClock`. Pool: 8400:03A3 — **same**.
```pascal
CarryClock(RestClock);                                           { 5400:0388 }
if RestClock[5] > 0 then begin                                   { 5400:0391 }
  RestClock[4] := RestClock[4] + ClockLimits[4] * RestClock[5];  { 5400:0398 }
  RestClock[5] := 0;                                             { 5400:03a3 }
  if RestClock[4] > 99 then RestClock[4] := 99;                  { 5400:03a8 / 03af }
end;
```

### 5400:03B9 AdvanceClock (H)
`procedure AdvanceClock(count [BP+8], unit [BP+6]: Byte)` (far, stub ov20 e2) — callers: ExploreCommand, StepForward3D, ecl_op34_EclClock, EndOfRound. Pool: 8400:03D5 — **same** (VM 4BC6..4BCC).
```pascal
for i := 0 to 6 do clk[i] := ecl_Mem4B00^.w[$C6 + i];            { 5400:03bf / 03c8 }
for k := 1 to count do begin clk[unit] := clk[unit] + 1;  CarryClock(clk) end;   { 5400:03ed / 0402 / 040d }
for i := 0 to 6 do ecl_Mem4B00^.w[$C6 + i] := clk[i];            { 5400:041e / 0427 }
TickEffects(count, unit);                                        { 5400:044c }
```

### 5400:045E DecRestClock (H)
`procedure DecRestClock(amount [BP+8], unit [BP+6]: Byte)` (`RETF 4`). Pool: 8400:047A — **same**.
```pascal
if (RestClock[4] = 0) and (RestClock[3] = 0) and (RestClock[2] = 0) and (RestClock[1] = 0) then Exit;   { 5400:0464 .. 0480 }
while amount > RestClock[unit] do begin                          { 5400:0483 }
  k := unit + 1;                                                 { 5400:049b }
  while (RestClock[k] = 0) and (k < 5) do k := k + 1;            { 5400:04a3 / 04b8 }
  if k = 5 then begin FillChar(RestClock, $0E, 0);  amount := 0 end   { 5400:04c2 / 04c8 / 04d9 }
  else if k >= unit + 1 then                                     { 5400:04df }
    for j := k downto unit + 1 do begin                          { 5400:04ef }
      RestClock[j] := RestClock[j] - 1;                          { 5400:04f7 }
      RestClock[j - 1] := RestClock[j - 1] + ClockLimits[j - 1]; { 5400:0503 }
    end;
end;
RestClock[unit] := RestClock[unit] - amount;                     { 5400:052a }
NormalizeRestClock;                                              { 5400:053e }
```

### 5400:0549 TwoDigits (H)
`function TwoDigits(v [BP+6]: Byte): String[40]`. Pool: 8400:0565 — **same**.
```pascal
s := ByteToStr(v);                                               { 5400:0550 }
if v < 10 then s := '0' + s;                                     { 5400:056d / 0573 }
TwoDigits := Copy(s, 1, 2);                                      { 5400:059b }
```

### 5400:05D4 DrawRestTime (H)
`procedure DrawRestTime(sel [BP+6]: ShortInt)`. Pool: 8400:05F0 — **same** (Curse colours: fg, bg 0).
```pascal
for i := 0 to 6 do colour[i] := $0A;  colour[sel] := $0F;        { 5400:05db / 05f7 }
DrawText(1, $11, $0A, 0, 'Rest Time:');                          { 5400:0604 }
col := $0B;                                                      { 5400:0624 }
for i := 4 downto 3 do begin                                     { 5400:0628 }
  DrawText(col + 1, $11, colour[i], 0, TwoDigits(Lo(RestClock[i])));   { 5400:0631 }
  DrawText(col + 3, $11, $0A, 0, ':');                           { 5400:0666 }
  col := col + 3;                                                { 5400:068d }
end;
DrawText(col + 1, $11, colour[2], 0, TwoDigits(10 * RestClock[2] + RestClock[1]));   { 5400:0697 }
```

### 5400:0712 RestMenu (H)
`function RestMenu: Boolean`. Pool: 8400:0721 — **changed** (menu letters).
```pascal
start := false;  sel := 2;                                       { 5400:0718 / 071c }
repeat
  DrawRestTime(sel);                                             { 5400:0720 }
  key := HorizontalMenu('', 'Rest Days Hours Mins Add Subtract Exit', $0D, $0A, $0F, 1, 0, ext);   { 5400:0728 }
  if ext then                                                    { 5400:0762 }
    case key of
      'H': key := 'A';  'P': key := 'S';                         { 5400:0768 / 0775  cursor up / down }
      'K': begin sel := sel + 1; if sel > 4 then sel := 2; key := 'X' end;   { 5400:077f }
      'M': begin sel := sel - 1; if sel < 2 then sel := 4; key := 'X' end;   { 5400:0796 }
    else key := 'X';                                             { 5400:07ad }
    end;
  if key = #13 then key := 'R';                                  { 5400:07b1 }
  case key of
    'R': start := true;                                          { 5400:07bb }
    'D': sel := 4;  'H': sel := 3;  'M': sel := 2;               { 5400:07c8 / 07d2 / 07dc }
    'A': begin if sel = 2 then RestClock[1] := RestClock[1] + 5 else RestClock[sel] := RestClock[sel] + 1;   { 5400:07e6 / 07f0 / 07f7 }
              NormalizeRestClock end;                            { 5400:0804 }
    'S': begin if sel = 2 then DecRestClock(5, 1)                { 5400:0809 / 0813 }
              else DecRestClock(1, sel);                         { 5400:081f }
              NormalizeRestClock end;                            { 5400:082b }
  end;
until key in [#0, 'E', 'R'];                                     { 5400:082e  CS:06F2 }
RestMenu := start;                                               { 5400:0841 }
```

### 5400:0862 DailyHealing (H)
`procedure DailyHealing(show [BP+6]: Boolean)` (`RETF 2`). Pool: 8400:0871 — **changed** (`show`).
```pascal
HealCounter := HealCounter + 1;                                  { 5400:0868 }
if HealCounter >= $120 then begin                                { 5400:086c }
  any := false;  c := PartyList;                                 { 5400:0877 / 087b }
  while c <> nil do begin                                        { 5400:0887 }
    if HealCharacter(c, 1, false) then any := true;              { 5400:088f / 08a4 }
    c := c^.next;                                                { 5400:08a8 }
  end;
  if show then DrawRestTime(0);                                  { 5400:08ba / 08c0 }
  DrawText(1, $13, $0A, 0, 'The Whole Party Is Healed');         { 5400:08c7 }
  if any then PartySummary(SelectedChar);                        { 5400:08e7 / 08ed }
  MessageDelay;  ClearCharacterMessage;                          { 5400:08fa / 08ff }
  HealCounter := 0;                                              { 5400:0904 }
end;
```

### 5400:091D FinishMemorize (H)
`function FinishMemorize(c [BP+0Ah]: PChar; var learnt [BP+6]: Boolean): Byte` (`RETF 8`). Pool: 8400:0925 — **changed**: 84
memorisation slots (`+1Eh+k`, k = 0..83).
```pascal
result := 0;  k := 0;                                            { 5400:0923 / 0927 }
while (k <= $53) and (result = 0) do begin                       { 5400:092b / 0934 }
  if c^.mem_spell[k] > $7F then                                  { 5400:093d }
    if learnt then result := spells_Table[c^.mem_spell[k] and $7F].level   { 5400:094e / 0957 }
    else begin
      c^.mem_spell[k] := c^.mem_spell[k] - $80;                  { 5400:0978 }
      DrawRestTime(0);                                           { 5400:0987 }
      ShowCasts(c, 'has memorized', c^.mem_spell[k]);            { 5400:098e  ShowCasts (MAGIC ov22) }
      learnt := true;                                            { 5400:09b7 }
    end;
  k := k + 1;                                                    { 5400:09be }
end;
FinishMemorize := result;                                        { 5400:09c4 }
```

### 5400:09DF FinishScribe (H)
`function FinishScribe(c [BP+0Ah]: PChar; var learnt [BP+6]: Boolean): Byte` (`RETF 8`). Pool: 8400:09E7 — **same** (items
`+14Dh`, known_spell `+78h+s`).
```pascal
result := 0;  found := false;  item := c^.items;                 { 5400:09e5 / 09e9 / 09ed }
while (item <> nil) and (result = 0) do begin                    { 5400:09fd / 0a08 }
  k := 1;                                                        { 5400:0a11 }
  if IsScroll(item) then                                        { 5400:0a15  IsScroll (MAGIC) }
    while (k <= 3) and (result = 0) do begin                     { 5400:0a27 / 0a30 }
      if item^.power[k] > $80 then begin                         { 5400:0a39  +3Bh+k }
        found := true;                                           { 5400:0a4d  (unused) }
        if learnt then result := spells_Table[item^.power[k] and $7F].level   { 5400:0a51 / 0a5a }
        else begin
          s := item^.power[k] and $7F;                           { 5400:0a7b }
          c^.known_spell[s] := 1;                                { 5400:0a8e }
          UseScrollSpell(c, item, s);                                 { 5400:0a9d  UseScrollSpell (MAGIC) }
          DrawRestTime(0);                                       { 5400:0ab2 }
          ShowCasts(c, 'has scribed', s);                        { 5400:0ab9 }
          learnt := true;                                        { 5400:0ad7 }
        end;
      end;
      k := k + 1;                                                { 5400:0ade }
    end;
  item := item^.next;                                            { 5400:0ae4  quirk (as Pool): after UseScrollSpell may have freed it }
end;
FinishScribe := result;                                          { 5400:0af6 }
```

### 5400:0B05 StudyTick (H)
`procedure StudyTick`. Pool: 8400:0B0A — **changed**: the timer stops at 0 (Pool wrapped to 255).
```pascal
i := 1;  c := PartyList;                                         { 5400:0b0b / 0b0f }
while c <> nil do begin                                          { 5400:0b1b }
  if StudyTimer[i] > 0 then StudyTimer[i] := StudyTimer[i] - 1;  { 5400:0b26 / 0b34 }
  if (StudyTimer[i] = 0) and (c^.rest_need = 0) then begin       { 5400:0b3f / 0b4d }
    learnt := false;                                             { 5400:0b57 }
    lvl := FinishScribe(c, learnt);                              { 5400:0b5b }
    if lvl = 0 then lvl := FinishMemorize(c, learnt);            { 5400:0b6d / 0b73 }
    StudyTimer[i] := lvl * 3;                                    { 5400:0b85 }
  end;
  c := c^.next;  Inc(i);                                         { 5400:0b9c / 0bac }
end;
```
`{ quirk (changed from Pool): a member with nothing to study tries every step (Pool: every 256 steps). }`

### 5400:0BB6 StudyHourTick (H)
`procedure StudyHourTick(var tick [BP+6]: Byte)` (`RETF 4`). Pool: 8400:0BB2 — **same**.
```pascal
tick := tick + 1;                                                { 5400:0bbc }
if tick >= 12 then begin                                         { 5400:0bc2 }
  tick := 0;  i := 1;  c := PartyList;                           { 5400:0bce / 0bd5 / 0bd9 }
  while c <> nil do begin                                        { 5400:0be5 }
    if c^.rest_need > 0 then begin                               { 5400:0bed  signed }
      c^.rest_need := c^.rest_need - 1;                          { 5400:0bf7 }
      if c^.rest_need = 0 then begin                             { 5400:0bfe }
        learnt := true;                                          { 5400:0c08 }
        lvl := FinishScribe(c, learnt);                          { 5400:0c0c }
        if lvl = 0 then lvl := FinishMemorize(c, learnt);        { 5400:0c1e / 0c24 }
        StudyTimer[i] := lvl * 3;                                { 5400:0c36 }
      end;
    end;
    c := c^.next;  Inc(i);                                       { 5400:0c4d / 0c5d }
  end;
end;
```

### 5400:0C9C RestLoop (H)
`function RestLoop(show [BP+6]: Boolean): Boolean` (far, stub ov20; `RETF 2`) — callers: Rest, Fix.
Pool: 8400:0C9A — **changed** (`show`: without it no rest screen, no menu, no key check; new message).
```pascal
interrupted := false;  unused := 0;                              { 5400:0ca2 / 0ca6 }
i := 1;  c := PartyList;                                         { 5400:0caa / 0cae }
while c <> nil do begin StudyTimer[i] := 0;  Inc(i);  c := c^.next end;   { 5400:0cba / 0cc2 / 0cce / 0cd1 }
FillChar(EffectsPending, $48, 1);                                { 5400:0ce3 }
hourTick := 0;  redrawTick := 0;                                 { 5400:0cf4 / 0cf8 }
if show then begin ClearTextRectangle(1, $11, $26, $16);  DrawRestTime(0) end;   { 5400:0cfc / 0d02 / 0d13 }
RestActive := 1;                                                 { 5400:0d1a }
if show then stop := not RestMenu else stop := false;            { 5400:0d1f / 0d26 / 0d38 }
while not stop and ((RestClock[4] > 0) or (RestClock[3] > 0) or (RestClock[2] > 0) or (RestClock[1] > 0)) do begin   { 5400:0d3c / 0d45 .. 0d5a }
  if show and KeyPressed then begin                              { 5400:0d64 / 0d6a }
    DrawRestTime(0);                                             { 5400:0d73 }
    if AskYesNo('Stop Resting? ', $0D, $0A, $0F) = 'Y' then stop := true   { 5400:0d7a / 0d9b }
    else ClearMenuLine;                                          { 5400:0da1 }
  end;
  if not stop then begin                                         { 5400:0da6 }
    DecRestClock(5, 1);                                          { 5400:0daf }
    redrawTick := redrawTick + 1;                                { 5400:0db9 }
    if show and (redrawTick >= 5) then begin DrawRestTime(0);  redrawTick := 0 end;   { 5400:0dbc / 0dc8 / 0dcf }
    AdvanceClock(5, 1);                                          { 5400:0dd3 }
    DailyHealing(show);                                          { 5400:0ddd }
    StudyTick;  StudyHourTick(hourTick);                         { 5400:0de6 / 0de9 }
    if ecl_Mem7C00^.w[$5A4 div 2] > 0 then begin                 { 5400:0df2  VM 7ED2: steps between encounter checks }
      RestEncCounter := RestEncCounter + 1;                      { 5400:0dfe }
      if RestEncCounter >= ecl_Mem7C00^.w[$5A4 div 2] then begin { 5400:0e02 }
        RestEncCounter := 0;                                     { 5400:0e10 }
        if Roll(1, 100) <= ecl_Mem7C00^.w[$5A6 div 2] then begin { 5400:0e15  VM 7ED3: chance in % }
          ClearCharacterMessage;  DrawRestTime(0);               { 5400:0e2d / 0e32 }
          DrawText(1, $13, $0F, 0, 'Your repose is suddenly interrupted!');   { 5400:0e39 }
          stop := true;  interrupted := true;                    { 5400:0e59 / 0e5d }
          MessageDelay;                                          { 5400:0e61 }
        end;
      end;
    end;
  end;
end;
ClearTextRectangle(1, $11, $26, $16);                            { 5400:0e69 }
RestActive := 0;                                                 { 5400:0e7a }
RestLoop := interrupted;                                         { 5400:0e7f }
```
`{ quirk: the interruption (DrawRestTime, message) and the final ClearTextRectangle run even when show = false. }`

### 5400:0E88 ov20_init — empty (H)

---

## ov21 (5500) — encumbrance, coins, treasure-pool money, number input, random treasure items, gem/jewel appraisal

Pool twin: Pool ov21 (8900) (PoolRadianceRE PARTY.pas.md) — 22 of 22 routines paired, most instruction for instruction; the
Pool text was ported onto Curse addresses (`pooltrans.py`) and every routine re-checked against the Curse asm with a
constant-level diff (immediates and offsets of aligned instructions): differences are only Curse's record offsets, DS
addresses and text-background pushes, except where a routine says **changed**. Curse names: `money[k] +FBh+2k` (copper,
silver, electrum, gold, platinum, gems +105h, jewelry +107h), `encumbrance +187h`, `item_count +14Ch`, `items +14Dh`,
`npc_morale +F7h`, `next +189h`; `TreasureMoney` DS:6F70 (7 LongInts), `TreasureItems` DS:6F8C, `PoolHasMoney` DS:7564,
`CoinValue` DS:0CA2 (LongInt 1, 10, 100, 200, 1000), `MagicItemTable` DS:082C, `CoinName` / item words: the CS / DS strings
of the routines. MaxCarryWeight uses StrWeightAllowance.

### 5500:0000 ov21_0000 — pre-load overlay units (H)
Calls the empty entries of ov26, ov24, ov23, ov34 `{ 5500:0000 }`. Pool: — **new**.

### 5500:001B MaxCarryWeight (H)
Pool: 8900:0000 MaxCarryWeight — **same** (12/12; Curse offsets and text colours).
`function MaxCarryWeight(c [BP+6]: ^TChar): Word` — RETF 4. 
Curse callers: WouldOverload, TransferCoins, ShareMoney. Callees: StrWeightAllowance.
```pascal
MaxCarryWeight := StrWeightAllowance(c) + 1500;                        { 5500:0021 }
```

### 5500:003B SubEncumbrance (H)
Pool: 8900:0020 SubEncumbrance — **same** (9/10; Curse offsets and text colours).
`procedure SubEncumbrance(c [BP+8]: ^TChar; amount [BP+6]: Word)` — RETF 6. 
Curse callers: TransferCoins, PoolMoney, DropCoinsToPool. Callees: -.
```pascal
c^.encumbrance := c^.encumbrance - amount;                             { 5500:003e }
```

### 5500:0057 AddEncumbrance (H)
Pool: 8900:003A AddEncumbrance — **same** (9/10; Curse offsets and text colours).
`procedure AddEncumbrance(c [BP+8]: ^TChar; amount [BP+6]: Word)` — RETF 6. 
Curse callers: AddPlatinumOrPool, TransferCoins, ShareMoney, TakeCoins. Callees: -.
```pascal
c^.encumbrance := c^.encumbrance + amount;                             { 5500:005a }
```

### 5500:0073 WouldOverload (H) — stub ov21 e1
Pool: 8900:0054 WouldOverload — **same** (31/31; Curse offsets and text colours).
`function WouldOverload(c [BP+0Ch]: ^TChar; amount [BP+0Ah]: Word; var room [BP+6]: Word): Boolean` — RETF 0Ah. 
Curse callers: AddPlatinumOrPool, ShareMoney, TakeCoins, AppraiseGems. Callees: MaxCarryWeight.
```pascal
if c^.encumbrance + amount > MaxCarryWeight(c) then begin              { 5500:0079  unsigned compare }
  WouldOverload := True;                                               { 5500:0094 }
  room := MaxCarryWeight(c) - c^.encumbrance;                          { 5500:0098 }
end else begin
  WouldOverload := False;                                              { 5500:00b2 }
  room := 0;                                                           { 5500:00b6 }
end;
```

### 5500:00C7 MoneyValueInGold (H) — stub ov21 e12
Pool: 8900:00A8 MoneyValueInGold — **same** (43/51; Curse offsets and text colours).
`function MoneyValueInGold(money [BP+6]: array[0..6] of LongInt): LongInt` — RETF 4 (28-byte value parameter, passed by reference and copied to a local by the callee). 
Curse callers: -. Callees: System.@CopyBytes, System.@LongDivMod, System.@LongMul.
```pascal
m := money;                                                            { 5500:00cd  @CopyBytes 1Ch }
sum := 0;                                                              { 5500:00e0 }
for k := 0 to 4 do                                                     { 5500:00e8  copper..platinum; gems/jewelry not counted }
  sum := sum + m[k] * CoinValue[k];                                    { 5500:00f1 }
MoneyValueInGold := (sum + 100) div CoinValue[3];                      { 5500:0121  CoinValue[3] = 200 (g_?0D30): rounded to gold }
```

### 5500:0149 SetCharMoneyGold (M) — stub ov21 e10
Pool: 8900:0130 SetCharMoneyGold — **same** (31/31; Curse offsets and text colours).
`procedure SetCharMoneyGold(gold [BP+6]: Word)` — RETF 2. 
Curse callers: -. Callees: -.
```pascal
for k := 0 to 4 do SelectedChar^.money[k] := 0;                        { 5500:014f }
SelectedChar^.money[4] := gold div 5;                                  { 5500:0171  platinum }
SelectedChar^.money[3] := gold mod 5;                                  { 5500:0184  gold }
```
`{ quirk: encumbrance is not updated here; callers rely on a later RecalcItems. }`

### 5500:019E SetPoolMoneyGold (M) — stub ov21 e11
Pool: 8900:0185 SetPoolMoneyGold — **same** (34/34; Curse offsets and text colours).
`procedure SetPoolMoneyGold(gold [BP+6]: Word)` — RETF 2. 
Curse callers: -. Callees: -.
```pascal
for k := 0 to 4 do TreasureMoney[k] := 0;                              { 5500:01a4 }
TreasureMoney[4] := gold div 5;                                        { 5500:01c7  g_?6804 }
TreasureMoney[3] := gold mod 5;                                        { 5500:01da  g_?6800 }
```

### 5500:021C AddPlatinumOrPool (M)
Pool: 8900:0203 AddPlatinumOrPool — **same** (53/53; Curse offsets and text colours).
`procedure AddPlatinumOrPool(n [BP+6]: Word)` — RETF 2 (called near with PUSH CS). 
Curse callers: AppraiseGems. Callees: System.@StrCopy, AddEncumbrance, WouldOverload, ShowTimedBottomMessage.
```pascal
if WouldOverload(SelectedChar, n, room) then begin                     { 5500:0222 }
  ShowTimedBottomMessage('Overloaded.  Money will be put in Pool.');   { 5500:023a }
  SelectedChar^.money[4] := SelectedChar^.money[4] + room;             { 5500:024e }
  AddEncumbrance(SelectedChar, room);                                  { 5500:025a }
  TreasureMoney[4] := n + TreasureMoney[4] - room;                     { 5500:0269 }
end else begin
  SelectedChar^.money[4] := SelectedChar^.money[4] + n;                { 5500:028c }
  AddEncumbrance(SelectedChar, n);                                     { 5500:0298 }
end;
```

### 5500:02AD InputNumber (H) — stub ov21 e6
Pool: 8900:0294 InputNumber — **same** (188/192; Curse offsets and text colours).
`function InputNumber(max [BP+0Ch]: Word; prompt [BP+8]: string[40]; colour [BP+6]: Byte): Word` — RETF 8. 
Locals: `p` string[40] [bp-2Bh], `len` [bp-2Eh], `col` [bp-2Ch], `maxStr` string[5] [bp-34h], `num` string[6] [bp-3Bh], `k` [bp-3Ch].
Curse callers: TakeMoney. Callees: ClearGlyphRun, DrawText, ReadGameKey, System.@CharToStr, System.@StrAppend, System.@StrAssign, System.@StrCopy, System.@StrLong, System.@ValLong, System.Copy.
```pascal
p := prompt;                                                           { 5500:02b4 }
ClearGlyphRun(0, 24, 0, 40);                                           { 5500:02c7  bottom line }
DrawText(0, 24, colour, 0, p);                                            { 5500:02d8 }
len := Length(p);  col := len;                                         { 5500:02ef }
Str(max, maxStr);                                                      { 5500:02fb }
num := '';                                                             { 5500:0313 }
repeat
  k := ReadGameKey;                                                    { 5500:0317 }
  if (k >= '0') and (k <= '9') then begin                              { 5500:031f }
    num := num + k;                                                    { 5500:0330  truncated to 6 characters }
    v := Val(num, code);                                               { 5500:0362  LongInt }
    if v <= max then Inc(col)                                          { 5500:0377 }
    else begin
      num := maxStr;                                                   { 5500:038d  too large: clamp to max }
      col := len + Length(maxStr);                                     { 5500:03a0 }
    end;
    DrawText(len, 24, $0F, 0, num);                                       { 5500:03b1 }
  end
  else if (k = #8) and (Length(num) > 0) then begin                    { 5500:03ca }
    num := Copy(num, 1, Length(num) - 1);                              { 5500:03d4 }
    ClearGlyphRun(col, 24, 0, 1);                                      { 5500:03fd }
    Dec(col);                                                          { 5500:040f }
  end;
until (k = #13) or (k = #27);                                          { 5500:0412 }
ClearGlyphRun(0, 24, 0, 40);                                           { 5500:0421 }
if k = #27 then InputNumber := 0                                       { 5500:0432 }
else InputNumber := Val(num, code);                                    { 5500:043f  low word }
```
`{ quirk: col points one cell past the last digit (digits are drawn from column len), so Backspace blanks the cell after the last digit — the deleted digit stays visible until the next redraw. }`

### 5500:046B TransferCoins (H) — stub ov21 e7
Pool: 8900:044C TransferCoins — **same** (71/71; Curse offsets and text colours).
`procedure TransferCoins(var src [BP+0Eh], dst [BP+0Ah]: ^TChar; amount [BP+8]: Word; coin [BP+6]: ShortInt)` — RETF 0Ch. 
Curse callers: -. Callees: System.@StrCopy, MaxCarryWeight, SubEncumbrance, AddEncumbrance, ShowTimedBottomMessage.
```pascal
if dst^.encumbrance + amount <= MaxCarryWeight(dst) then begin         { 5500:0471 }
  src^.money[coin] := src^.money[coin] - amount;                       { 5500:0493 }
  SubEncumbrance(src, amount);                                         { 5500:04be }
  dst^.money[coin] := dst^.money[coin] + amount;                       { 5500:04cf }
  AddEncumbrance(src, amount);                                         { 5500:04fa  quirk: src again, not dst }
end else
  ShowTimedBottomMessage('Overloaded');                                { 5500:050d }
```
`{ quirk: the encumbrance update adds back to the giver instead of the receiver (both calls push [BP+0Eh]); the stored encumbrances stay stale until the next RecalcItems. }`

### 5500:0527 PoolMoney (H) — stub ov21 e2
Pool: 8900:0508 PoolMoney — **same** (73/79; Curse offsets and text colours).
`procedure PoolMoney` — RETF. 
Curse callers: -. Callees: System.FillChar, SubEncumbrance.
```pascal
p := PartyList;                                                        { 5500:052d }
PoolHasMoney := 1;                                                     { 5500:0539  g_?6DC0 }
while p <> nil do begin                                                { 5500:053e }
  if (p^.npc_morale = 0) or (p^.npc_morale = $B3) then begin           { 5500:0549  PCs and animated dead; NPCs keep their money }
    for k := 0 to 6 do begin                                           { 5500:0562 }
      TreasureMoney[k] := TreasureMoney[k] + p^.money[k];              { 5500:0571 }
      SubEncumbrance(p, p^.money[k]);                                  { 5500:05ad }
    end;
    FillChar(p^.money, 14, 0);                                         { 5500:05cd }
  end;
  p := p^.next;                                                        { 5500:05e2 }
end;
```

### 5500:05F9 CountMoneySharers (M)
Pool: 8900:05E0 CountMoneySharers — **same** (26/30; Curse offsets and text colours).
`function CountMoneySharers: Byte` — RETF. Caller: ShareMoney.
Curse callers: ShareMoney. Callees: -.
```pascal
p := PartyList;  n := 0;                                               { 5500:05ff }
while p <> nil do begin                                                { 5500:060f }
  if (p^.npc_morale = 0) or (p^.npc_morale = $B3) then Inc(n);         { 5500:0617 }
  p := p^.next;                                                        { 5500:0630 }
end;
CountMoneySharers := n;                                                { 5500:0642 }
```

### 5500:064F ShareMoney (H) — stub ov21 e3
Pool: 8900:063A ShareMoney — **changed** (368/385): the remainder coin test checks 1 coin.
`procedure ShareMoney` — RETF. 
Locals: `share[0..6]` words [bp-1Ah], `rest[0..6]` words [bp-28h], `room` [bp-0Ch], `n` [bp-9], `k` [bp-29h]; byte [bp-0Ah] is set to 0 and never read.
Curse callers: -. Callees: System.@LongDivMod, System.FillChar, MaxCarryWeight, AddEncumbrance, WouldOverload, CountMoneySharers.
```pascal
p := PartyList;                                                        { 5500:0655 }
n := CountMoneySharers;                                                { 5500:0665 }
FillChar(share, 14, 0);  FillChar(rest, 14, 0);                        { 5500:066c }
for k := 0 to 6 do                                                     { 5500:068e }
  if TreasureMoney[k] > 0 then begin                                   { 5500:06a1 }
    share[k] := TreasureMoney[k] div n;                                { 5500:06b1  quirk: n = 0 (no sharer) → runtime error 200 }
    rest[k]  := TreasureMoney[k] mod n;                                { 5500:06de }
  end else begin
    share[k] := 0;  rest[k] := 0;                                      { 5500:0711 }
  end;
{ pass 1: everyone with npc_morale < 80h gets a share, highest coin first }
while p <> nil do begin                                                { 5500:0734 }
  if p^.npc_morale < $80 then                                          { 5500:073f  quirk: other test than CountMoneySharers (B3h excluded, 1..7Fh included) }
    for k := 6 downto 0 do                                             { 5500:074d }
      if not WouldOverload(p, share[k], room) then begin               { 5500:0756 }
        p^.money[k] := p^.money[k] + share[k];                         { 5500:0777 }
        AddEncumbrance(p, share[k]);                                   { 5500:07a6 }
        if rest[k] > 0 then                                            { 5500:07bb }
          if not WouldOverload(p, 1, room) then begin                  { 5500:07c9  Curse tests the 1 it adds (Pool: the whole rest) }
            p^.money[k] := p^.money[k] + 1;                            { 5500:07e0 }
            AddEncumbrance(p, 1);                                      { 5500:0803 }
            Dec(rest[k]);                                              { 5500:0811 }
          end;
      end else begin
        p^.money[k] := p^.money[k] + room;                             { 5500:081e  takes what fits }
        rest[k] := share[k] + rest[k] - room;                          { 5500:0843 }
        AddEncumbrance(p, room);                                       { 5500:086b }
      end;
  p := p^.next;                                                        { 5500:0881 }
end;
{ pass 2: hand the remainder to anyone with room, NPCs included }
for k := 6 downto 0 do                                                 { 5500:0894 }
  if rest[k] > 0 then begin                                            { 5500:089d }
    p := PartyList;                                                    { 5500:08ae }
    while p <> nil do begin                                            { 5500:08ba }
      room := MaxCarryWeight(p) - p^.encumbrance;                      { 5500:08c5 }
      if room > 0 then                                                 { 5500:08da  unsigned }
        if rest[k] > room then begin                                   { 5500:08e3 }
          p^.money[k] := p^.money[k] + room;                           { 5500:08f3 }
          AddEncumbrance(p, room);                                     { 5500:0918 }
          rest[k] := rest[k] - room;                                   { 5500:0925 }
        end else begin
          p^.money[k] := p^.money[k] + rest[k];                        { 5500:0942 }
          AddEncumbrance(p, rest[k]);                                  { 5500:0971 }
          rest[k] := 0;                                                { 5500:0986 }
        end;
      p := p^.next;                                                    { 5500:0993 }
    end;
  end;
PoolHasMoney := 0;                                                     { 5500:09af }
for k := 0 to 6 do begin                                               { 5500:09b4 }
  TreasureMoney[k] := rest[k];                                         { 5500:09bd }
  if TreasureMoney[k] <> 0 then PoolHasMoney := 1;                     { 5500:09e0 }
end;
```

### 5500:0A03 DropCoinsToPool (M) — stub ov21 e8
Pool: 8900:0A01 DropCoinsToPool — **same** (47/50; Curse offsets and text colours).
`procedure DropCoinsToPool(c [BP+0Ah]: ^TChar; amount [BP+8]: Word; coin [BP+6]: ShortInt)` — RETF 8. 
Curse callers: -. Callees: SubEncumbrance.
```pascal
c^.money[coin] := c^.money[coin] - amount;                             { 5500:0a06 }
SubEncumbrance(c, amount);                                             { 5500:0a2b }
if (view_Mode = 6) or (view_Mode = 1) then                             { 5500:0a38  otherwise the coins are simply lost }
  TreasureMoney[coin] := TreasureMoney[coin] + amount;                 { 5500:0a46 }
```

### 5500:0A8A TakeCoins (H)
Pool: 8900:0A88 TakeCoins — **same** (83/87; Curse offsets and text colours).
`procedure TakeCoins(c [BP+0Ah]: ^TChar; amount [BP+8]: Word; coin [BP+6]: ShortInt)` — RETF 8 (near call with PUSH CS). Caller: TakeMoney.
Curse callers: TakeMoney. Callees: System.@StrCopy, AddEncumbrance, WouldOverload, ShowTimedBottomMessage.
```pascal
if WouldOverload(c, amount, room) then                                 { 5500:0a90 }
  ShowTimedBottomMessage('Overloaded')                                 { 5500:0aa6 nothing is taken (no partial take) }
else begin
  if amount > TreasureMoney[coin] then amount := TreasureMoney[coin];  { 5500:0abd  low word }
  TreasureMoney[coin] := TreasureMoney[coin] - amount;                 { 5500:0aed }
  c^.money[coin] := c^.money[coin] + amount;                           { 5500:0b20 }
  AddEncumbrance(c, amount);                                           { 5500:0b45 }
end;
```

### 5500:0B91 CoinFromText (H) — stub ov21 e5
Pool: 8900:0B93 CoinFromText — **same** (125/125; Curse offsets and text colours).
`function CoinFromText(text [BP+0Ah]: String; var coinName [BP+6]: String): ShortInt` — RETF 8.  `text` is a list line "Copper 123" … "Jewelry 2" (CoinName + ' ' + amount).
Curse callers: TakeMoney. Callees: System.@StrAssign, System.UpCase.
```pascal
t := text;                                                             { 5500:0b98  string[255] }
i := 1;  while t[i] = ' ' do Inc(i);                                   { 5500:0bac }
case t[i] of                                                           { 5500:0bc6 }
  'G': if UpCase(t[i+1]) = 'E' then begin result := 5; coinName := 'Gems ' end      { 5500:0bd6 }
       else begin coinName := 'Gold '; result := 3 end;                { 5500:0c06 }
  'P': begin coinName := 'Platinum '; result := 4 end;                 { 5500:0c20 }
  'E': begin coinName := 'electrum '; result := 2 end;                 { 5500:0c3d }
  'S': begin coinName := 'silver '; result := 1 end;                   { 5500:0c5a }
  'C': begin coinName := 'Copper '; result := 0 end;                   { 5500:0c77 }
  'J': begin coinName := 'Jewelry '; result := 6 end;                  { 5500:0c94 }
end;                                                                   { other first letters: result = uninitialised local [bp-1] }
CoinFromText := result;                                                { 5500:0caf }
```

### 5500:0CF0 TakeMoney (H) — stub ov21 e4
Pool: 8900:0CEB TakeMoney — **changed** (229/260): screen frame instead of the titled frame.
`procedure TakeMoney` — RETF. 
Locals: `list` [bp-8], `item`/`prev` [bp-0Ch], `head` [bp-10h], `index` [bp-14h], `redraw` [bp-118h], `done` [bp-117h], `coin` [bp-2], `amount` [bp-116h], `s` string[255] [bp-114h].
Curse callers: -. Callees: DrawScreenFrame, FreeMenuList, System.@StrAppend, System.@StrAssign, System.@StrCopy, System.@StrLong, System.GetMem, VerticalListMenu, InputNumber, TakeCoins, CoinFromText.
```pascal
DrawScreenFrame;                                                       { 5500:0cf7  (Pool: a titled frame) }
index := 0;                                                            { 5500:0cfc }
repeat
  redraw := True;  list := nil;  prev := nil;                          { 5500:0d01 }
  for k := 6 downto 0 do                                               { 5500:0d16 }
    if TreasureMoney[k] > 0 then begin                                 { 5500:0d1f }
      Inc(cnt);                                                        { 5500:0d3f  uninitialised local [bp-12h], never read }
      if list = nil then begin
        GetMem(list, 46);  list^.next := nil;                          { 5500:0d4f }
      end else begin
        prev := list;  GetMem(list, 46);  list^.next := prev;          { 5500:0d67  prepend: the list ends up copper first }
      end;
      Str(TreasureMoney[k], s);                                        { 5500:0d90 }
      list^.text := CoinName[k] + ' ' + s;                             { 5500:0db4 }
      list^.isHeader := 0;                                             { 5500:0df3 }
    end;
  item := list;  head := list;                                         { 5500:0e04 }
  key := VerticalListMenu('Select type of coin ', 'Select', $0D, $0A, $0F,
                          2, 2, $0F, 8, list, True, redraw, index, item);   { 5500:0e1a }
  if (item = nil) or (key = #0) then done := True                      { 5500:0e71  quirk: the list is not freed on exit }
  else begin
    done := False;                                                     { 5500:0e88 }
    coin := CoinFromText(item^.text, s);                               { 5500:0e8d }
    s := 'How much ' + s + 'will you take? ';                          { 5500:0e9f }
    amount := InputNumber(TreasureMoney[coin], s, $0A);                { 5500:0ed3  max = low word of the pool amount }
    TakeCoins(SelectedChar, amount, coin);                             { 5500:0ef2 }
    FreeMenuList(head);                                                { 5500:0f06 }
    PoolHasMoney := 0;  done := True;                                  { 5500:0f10 }
    for k := 0 to 6 do                                                 { 5500:0f1a }
      if TreasureMoney[k] > 0 then begin PoolHasMoney := 1; done := False end;   { 5500:0f23 }
  end;
until done;                                                            { 5500:0f4d }
```

### 5500:0F5B TreasurePoolStatus (H) — stub ov21 e9
Pool: 8900:0F7E TreasurePoolStatus — **same** (30/30; Curse offsets and text colours).
`procedure TreasurePoolStatus(var hasMoney [BP+0Ah], hasItems [BP+6]: Boolean)` — RETF 8. 
Curse callers: -. Callees: -.
```pascal
hasMoney := False;  hasItems := False;                                 { 5500:0f61 }
for k := 0 to 6 do                                                     { 5500:0f6f }
  if TreasureMoney[k] <> 0 then hasMoney := True;                      { 5500:0f78 }
if TreasureItems <> nil then hasItems := True;                         { 5500:0f99 }
```

### 5500:0FAF RollMagicPlus (M)
Pool: 8900:0FD2 RollMagicPlus — **changed** (17/27): no +3.
`function RollMagicPlus: Byte` — RETF. Caller: MakeTreasureItem.
Curse callers: MakeTreasureItem. Callees: Roll.
```pascal
r := Roll(1, 20);                                                      { 5500:0fb5 }
if (r >= 1) and (r <= 14) then RollMagicPlus := 1                      { 5500:0fc3 / 0fd2  70 % }
else if (r >= 15) and (r <= 20) then RollMagicPlus := 2;               { 5500:0fd8 / 0fe2  30 %; Pool had +3 for 20 }
```

### 5500:0FED MakeTreasureItem (H) — stub ov21 e13
Pool: 8900:1010 MakeTreasureItem — **changed** (596/826): weapons, armour, weights and values as Pool; the javelin chance
uses record 31h, bracers +8 get no "AC" word, scrolls hold spells of levels 1..5, and the magic-item cases are Curse's own
(MagicItemTable DS:082C, words; record = 8 words: word1..3, weight, value, power1..3).
`procedure MakeTreasureItem(typ [BP+0Ah]: Byte; var it [BP+6]: TItem)` (`RETF 6`). Local `rec` [BP-4].
```pascal
FillChar(it, 63, 0);  rec := 0;                                        { 5500:0ff3 / 1004 }
FillChar(it.power, 3, 0);  it.next := nil;                             { 5500:1008 / 1026 }
it.readied := 0;  it.hidden := 6;  it.magic_flag := 0;                 { 5500:1033 / 103b / 1043 }
it.type := typ;                                                        { 5500:104b }
FillChar(it.word, 3, 0);                                               { 5500:1055 }
if (typ in [1..59]) or (typ = 73) or (typ = 77) or (typ = 93) then begin   { 5500:106a }
  it.plus := RollMagicPlus;                                            { 5500:108f }
  case typ of                                                          { 5500:109a }
    21: begin                                                          { javelin }
          if Roll(1, 5) = 5 then rec := $31;                           { 5500:10a8 / 10b6 / 10bc }
          it.word[3] := $15;  it.word[2] := it.plus + $A1;             { 5500:10c0 / 10c8 }
        end;
    28: begin it.word[3] := $1C;  it.word[2] := it.plus + $A1 end;     { 5500:10e2 }
    50, 51: begin it.word[3] := typ;  it.word[2] := $31;  it.word[1] := it.plus + $A1;  it.hidden := 4 end;   { 5500:1109 }
    52: begin it.word[3] := typ;  it.word[2] := $32;  it.word[1] := it.plus + $A1;  it.hidden := 4 end;       { 5500:1141 }
    53..58: begin it.word[3] := typ;  it.word[2] := $30;  it.word[1] := it.plus + $A1;  it.hidden := 4 end;   { 5500:117e }
    73: begin it.word[3] := $3D;  it.word[2] := it.plus + $A1 end;     { 5500:11b6 }
    77: begin                                                          { bracers }
          it.word[3] := $4F;  it.word[2] := $A7;                       { 5500:11d8 / 11e0 }
          it.plus := it.plus * 2 + 2;                                  { 5500:11e8 }
          if it.plus = 4 then it.word[1] := $DD                        { 5500:11fc / 1209 }
          else if it.plus = 6 then it.word[1] := $DE;                  { 5500:1213 / 1218 }
        end;
    93: begin it.word[3] := $42;  it.word[2] := $E0;  it.word[1] := it.plus + $A1 end;   { 5500:1227 }
  else begin it.word[3] := typ;  it.word[2] := it.plus + $A1 end;      { 5500:124b }
  end;
  it.plus2 := 0;  it.count := 0;                                       { 5500:126b / 1273 }
  { weight by type (+37h): the Pool table unchanged (75 / 50 / 125 / 100 / 150 / 15 / 30 / 10 / darts 25 × 5 / 60 / 80 / 175 /
    20 / 40 / 35 / 250 / 200 / 400 / 300 / 350 / 450 / ring 1; else 40 with count 10) }   { 5500:127b .. 14b4 }
  { value by type (+3Ah): plus × 2500 shield, × 150 arrows/quarrels, × 3000 / 3500 / 4000 / 5000 armour, × 3000 bracers,
    else × 2000 — as Pool }                                            { 5500:14c5 .. 159d }
end
else if (typ = 61) or (typ = 62) then begin                            { 5500:15b4  scrolls }
  n := Roll(1, 3);                                                     { 5500:15c1 }
  if typ = 61 then it.word[3] := $D1 else it.word[3] := $D0;           { 5500:15cf / 15d9 / 15e3 }
  it.word[2] := n + $D1;  it.word[1] := 0;  it.plus := 1;              { 5500:15eb / 15fa / 1602 }
  it.weight := 25;  it.count := 0;  it.value := 0;                     { 5500:160a / 1613 / 161b }
  for k := 1 to n do begin                                             { 5500:1624 }
    lvl := Roll(1, 5);                                                 { 5500:163c  spell level 1..5 (Pool 1..3) }
    if typ = 61 then case lvl of                                       { 5500:164a  magic-user }
      1: sp := Roll(1, 13) + 8;                                  { 5500:1657 }
      2: sp := Roll(1, 7) + 28;                                  { 5500:1676 }
      3: sp := Roll(1, 11) + 44;                                 { 5500:1690 }
      4: sp := Roll(1, 9) + $50;                                 { 5500:16aa  new: ids 81..89 }
      5: sp := Roll(1, 4) + $5A;                                 { 5500:16c4  91..94 }
    end
    else case lvl of                                                   { 5500:16df  cleric }
      1: sp := Roll(1, 8);                                       { 5500:16e4 }
      2: sp := Roll(1, 7) + 21;                                  { 5500:16f9 }
      3: sp := Roll(1, 8) + 36;                                  { 5500:1713 }
      4: sp := Roll(1, 5) + $41;                                 { 5500:172d  new: ids 66..70 }
      5: sp := Roll(1, 6) + $46;                                 { 5500:1747  71..76 }
    end;
    it.power[k] := sp;                                                 { 5500:175f }
    it.value := it.value + lvl * 300;                                  { 5500:1770 }
  end;
end
else case typ of                                                       { 5500:1795  magic items }
  63, 67: rec := $29;                                                  { 5500:1795 / 179f }
  78, 79: rec := $21;                                                  { 5500:17a5 / 17af }
  84, 92: rec := $09;                                                  { 5500:17b5 / 17bf }
  71: begin r := Roll(1, 8);                                           { 5500:17c5 / 17ca }
        if r in [1..5] then rec := $11                                 { 5500:17d8 / 17e7 }
        else if r in [6..8] then rec := $01;                           { 5500:17ed / 17f7 }
      end;
end;
if rec <> 0 then begin                                                 { 5500:17fb }
  for k := 0 to 2 do it.word[k + 1] := Lo(MagicItemTable[rec + k]);   { 5500:1804 / 180d }
  it.plus := 1;  it.plus2 := 1;                                        { 5500:1838 / 1840 }
  it.weight := MagicItemTable[rec + 3];  it.count := 0;                { 5500:1848 / 185f }
  it.value := MagicItemTable[rec + 4];                                 { 5500:1867 }
  for k := 1 to 3 do it.power[k] := Lo(MagicItemTable[rec + 4 + k]);  { 5500:187e / 1887 }
end;
```
`{ quirk: the javelin "special" uses record 31h of MagicItemTable (Pool's misaligned 90h is gone); +8 bracers keep an empty
first name word. }` The table contents (DS:082C) are data for cab-data / the items lane.

### 5500:198C AppraiseGems (H) — stub ov21 e14
Pool: 8900:19B2 AppraiseGems — **same** (740/823; Curse offsets and text colours).
`procedure AppraiseGems(var changed [BP+6]: Boolean)` — RETF 4. 
Locals: `gemStr` string[40] [bp-29h], `jewStr` string[40] [bp-52h], `opts` string[40] [bp-7Ch], `key` [bp-53h], `done` [bp-0B3h], `noKeep` [bp-0B5h], `ext` [bp-0B4h], `it` [bp-0B2h], `p` [bp-0AEh], `room` [bp-0AAh], `value` word [bp-0A8h], `r` [bp-0A6h].
Curse callers: -. Callees: ClearTextRectangle, DrawText, HorizontalMenu, RecalcItems, System.@LongToReal, System.@StrAppend, System.@StrAssign, System.@StrCopy, System.@StrLong, System.FillChar, System.GetMem, System.RandomWord, System.Trunc, WouldOverload.
```pascal
changed := True;                                                       { 5500:1993 }
if (SelectedChar^.money[5] = 0) and (SelectedChar^.money[6] = 0) then begin   { 5500:199a  gems, jewelry }
  ShowTimedBottomMessage('No Gems or Jewelry');                        { 5500:19b2 }
  changed := False;                                                    { 5500:19c7 }
  exit;
end;
repeat
  if (SelectedChar^.money[5] = 0) and (SelectedChar^.money[6] = 0) then done := True   { 5500:19d1  leaves without RecalcItems }
  else begin
    done := False;                                                     { 5500:19f1 }
    Str(SelectedChar^.money[5], gemStr);                               { 5500:19f6 }
    Str(SelectedChar^.money[6], jewStr);                               { 5500:1a14 }
    case SelectedChar^.money[5] of                                     { 5500:1a32 }
      0: gemStr := '';
      1: gemStr := gemStr + ' Gem';                                    { 5500:1a4b }
    else gemStr := gemStr + ' Gems';                                   { 5500:1a75 }
    end;
    case SelectedChar^.money[6] of                                     { 5500:1a9d }
      0: jewStr := '';
      1: jewStr := jewStr + ' piece of Jewelry';                       { 5500:1ab6 }
    else jewStr := jewStr + ' pieces of Jewelry';                      { 5500:1ae0 }
    end;
    ClearTextRectangle(1, 1, $26, $16);                                { 5500:1b08 }
    DrawCharacterName(SelectedChar, 1, 1, 0);                      { 5500:1b19 }
    DrawText(1, 7, $0F, 0, 'You have a fine collection of:');             { 5500:1b2f }
    DrawText(1, 9, $0F, 0, gemStr);                                       { 5500:1b50 }
    DrawText(1, $0A, $0F, 0, jewStr);                                     { 5500:1b69 }
    opts := '';                                                        { 5500:1b7c }
    if SelectedChar^.money[5] <> 0 then opts := '  Gems';              { 5500:1b80 }
    if SelectedChar^.money[6] <> 0 then opts := opts + '  Jewelry';    { 5500:1b9f }
    opts := opts + ' Exit';                                            { 5500:1bd3 }
    key := HorizontalMenu('Appraise : ', opts, $0D, $0A, $0F, True, False, ext);   { 5500:1bfb }
    if key = 'G' then begin                                            { 5500:1c2d }
      if SelectedChar^.money[5] <> 0 then begin                        { 5500:1c37 }
        Dec(SelectedChar^.money[5]);                                   { 5500:1c46 }
        r := Roll(1, 100);                                             { 5500:1c4f }
        case r of                                                      { 5500:1c5e }
          1..25:  value := 10;
          26..50: value := 50;
          51..70: value := 100;
          71..90: value := 500;
          91..99: value := 1000;
          100:    value := 5000;
        end;
        Str(value, gemStr);                                            { 5500:1cc9 }
        gemStr := 'The Gem is Valued at ' + gemStr + ' gp.';           { 5500:1ce2 }
        DrawText(1, $0C, $0F, 0, gemStr);                                 { 5500:1d17 }
        if WouldOverload(SelectedChar, 1, room) or (SelectedChar^.item_count >= 16) then begin   { 5500:1d2a }
          opts := 'Sell';  noKeep := True;                             { 5500:1d50 }
        end else begin
          opts := 'Sell Keep';  noKeep := False;                       { 5500:1d6b }
        end;
        key := HorizontalMenu('You can : ', opts, $0D, $0A, $0F, True, False, ext);    { 5500:1d84 }
        if (key = 'K') and not noKeep then begin                       { 5500:1db7 }
          GetMem(it, 63);  FillChar(it^, 63, 0);                       { 5500:1dd0 }
          it^.next := nil;  it^.readied := 0;                          { 5500:1deb }
          it^.word[3] := $65;  it^.word[2] := 0;  it^.word[1] := 0;    { 5500:1e02  "Gem" }
          it^.type := 70;  it^.value := value;  it^.weight := 1;  it^.hidden := 0;   { 5500:1e1d }
          p := SelectedChar^.items;                                    { 5500:1e45 }
          if p = nil then p := it                                      { 5500:1e58  quirk: only the local is set — the gem is lost when the character has no items }
          else begin
            while p^.next <> nil do p := p^.next;                      { 5500:1e72 }
            p^.next := it;                                             { 5500:1e94 }
          end;
        end else begin
          value := value div 5;                                        { 5500:1ea8  sold for platinum (5 gp each) }
          AddPlatinumOrPool(value);                                    { 5500:1eb7 }
        end;
      end;
    end
    else if key = 'J' then begin                                       { 5500:1ec2 }
      if SelectedChar^.money[6] <> 0 then begin                        { 5500:1ec9 }
        Dec(SelectedChar^.money[6]);                                   { 5500:1ed8 }
        r := Roll(1, 100);                                             { 5500:1ee1 }
        case r of                                                      { 5500:1ef0  Trunc(Random(n)) + base }
          1..10:   value := Random(900)  + 100;
          11..20:  value := Random(1000) + 200;
          21..40:  value := Random(1500) + 300;
          41..50:  value := Random(2500) + 500;
          51..70:  value := Random(5000) + 1000;
          71..90:  value := Random(6000) + 2000;
          91..100: value := Random(10000) + 2000;
        end;
        Str(value, jewStr);                                            { 5500:2025 }
        gemStr := 'The Jewel is Valued at ' + jewStr + ' gp.';         { 5500:203e }
        DrawText(1, $0C, $0F, 0, gemStr);                                 { 5500:2073 }
        if WouldOverload(SelectedChar, 1, room) or (SelectedChar^.item_count >= 16) then begin   { 5500:2086 }
          opts := 'Sell';  noKeep := True;                             { 5500:20ac }
        end else begin
          opts := 'Sell Keep';  noKeep := False;                       { 5500:20c7 }
        end;
        key := HorizontalMenu('You can : ', opts, $0D, $0A, $0F, True, False, ext);    { 5500:20e0 }
        if (key = 'K') and not noKeep then begin                       { 5500:2113 }
          { same item construction as for a gem, with it^.word[3] := $D6 ("Jewelry") }  { 5500:212c .. 2211 (same quirk) }
        end else begin
          value := value div 5;                                        { 5500:2204 }
          AddPlatinumOrPool(value);                                    { 5500:2213 }
        end;
      end;
    end
    else if (key = 'E') or (key = #0) then done := True;               { 5500:221d }
    RecalcItems(SelectedChar);                                     { 5500:222a }
  end;
until done;                                                            { 5500:2237 }
```
Note: any key other than K at "You can :" (including Esc / #0) sells.


### 5500:2247 ov21_init — empty (H)

---

## ov24 (6200) — character derived stats, item names, roster and summary, number strings, ability tables, messages, combat animation, damage, status line, party picker

Pool twin: **Pool's resident unit 00BA** (PoolRadianceRE ENGINE.pas.md "res_00BA part U/V"): Curse moved it into an overlay;
45 of 53 routines pair by shape (most 0.8..1.0) and were ported with `pooltrans.py` onto Curse addresses, then re-checked
with a constant-level diff (immediates and offsets of aligned instructions). Unless a routine says **changed**, the
differences are Curse's record offsets, DS addresses and the text-background pushes. New in Curse: ov24_0000 (pre-load),
DexDefenseAdj / DexMissileAdj / StrToHitAdj split, AnimateAlongPath (rewritten), SpellCasterLevel (spell level), ov24_2E05,
MakeItem (make item), BandageDying.
Record offsets (Curse; Pool in brackets where the port renamed them): readied[k] `+151h+4k` [+CCh], base_thac0 `+73h`
[+2Dh], thac0 `+199h` [+110h], ac `+19Ah`, ac_rear `+19Bh`, dmg_dice/sides/bonus[1] `+19Eh/+1A0h/+1A2h` [+115h/117h/119h],
hp `+1A4h` [+11Bh], move `+1A5h` [+11Ch], base_move `+E4h` [+72h], hp_max `+78h` [+32h], race `+74h` [+2Eh], status `+195h`
[+10Ch], active `+196h`, ac_item_bonus `+186h` [+101h], encumbrance `+187h` [+102h], next `+189h` [+104h], readied[11]
arrows `+17Dh` [+F8h], readied[12] quarrels `+181h` [+FCh]. `ItemTypeTable` DS:5CF6 (16 bytes per type, Pool `ITEMS`
DS:5582, same layout: +0 slot, +6 ac_value, +7 wflags, +9 dice, +0Ah sides, +0Bh dmg_bonus, +0Eh wflags2).

### 6200:0000 ov24_0000 — pre-load overlay units (H)
Calls the empty entries of ov33, ov34, ov29, ov28, ov26, ov25 `{ 6200:0000 }`. Pool: — **new** (00BA was resident).

### 6200:0025 RecalcWeaponStats (H)
`procedure RecalcWeaponStats(c [BP+6]: PChar)` (`RETF 4`) — caller: RecalcItems. Pool: 00BA:0000 — **same** (177/179).
```pascal
w := c^.readied[0];                                              { 6200:002b }
if w = nil then Exit;                                            { 6200:003b }
t := w^.type;                                                    { 6200:0046 }
c^.thac0 := c^.base_thac0;                                       { 6200:0050 }
if ItemTypeTable[t].wflags2 and 2 <> 0 then c^.thac0 := c^.thac0 + DexMissileAdj(c);   { 6200:005f / 0074 }
c^.dmg_bonus[1] := ItemTypeTable[t].dmg_bonus;                   { 6200:0095 }
if ItemTypeTable[t].wflags2 and 4 <> 0 then begin                { 6200:00ac }
  c^.thac0 := c^.thac0 + StrToHitAdj(c);                         { 6200:00c1 }
  c^.dmg_bonus[1] := c^.dmg_bonus[1] + StrDamageAdj(c);          { 6200:00e2 }
end;
plus := w^.plus;                                                 { 6200:0102 }
if (ItemTypeTable[t].wflags2 > $7F) and (c^.readied[12] <> nil) then plus := plus + c^.readied[12]^.plus;   { 6200:010c / 012d  quarrels }
if (ItemTypeTable[t].wflags2 and 1 <> 0) and (c^.readied[11] <> nil) then plus := plus + c^.readied[11]^.plus;   { 6200:0145 / 0169  arrows }
c^.dmg_bonus[1] := c^.dmg_bonus[1] + plus;                       { 6200:0181 }
if (c^.race = 2) and (((w^.type > $28) and (w^.type < $2D)) or (w^.type = $25) or (w^.type = $24)) then plus := plus + 1;   { 6200:019a / 01cc  elf }
c^.thac0 := c^.thac0 + plus;                                     { 6200:01cf }
c^.dmg_dice[1] := ItemTypeTable[t].dice;  c^.dmg_sides[1] := ItemTypeTable[t].sides;   { 6200:01e9 / 0200 }
```
`{ quirk (as Pool): the elf bonus goes to THAC0 only. }`

### 6200:021D ArmourMoveLimit (H)
`procedure ArmourMoveLimit(c [BP+0Ah]: PChar; item [BP+6]: PItem)` (`RETF 8`). Pool: 00BA:01FB — **same**.
```pascal
if ItemTypeTable[item^.type].slot = 2 then begin                 { 6200:0220 }
  w := item^.weight;                                             { 6200:0236 }
  if w <= 150 then c^.move := c^.base_move                       { 6200:023d }
  else if (w >= 151) and (w <= 399) then c^.move := 9            { 6200:0259 }
  else c^.move := 6;                                             { 6200:026e }
  if (item^.plus <> 0) and (c^.move <= 9) then c^.move := c^.move + 3;   { 6200:0277 / 028c }
end;
```

### 6200:02A7 AddItemAC (H)
`procedure AddItemAC(c [BP+12h]: PChar; item [BP+0Eh]: PItem; var part [BP+0Ah]: array[0..4] of ShortInt; var magicArmour [BP+6]: Boolean)` (`RETF 10h`). Pool: 00BA:0282 — **same**.
```pascal
acv := ItemTypeTable[item^.type].ac_value;                       { 6200:02ad }
if acv <= $7F then Exit;                                         { 6200:02c3 }
acv := acv and $7F;  slot := ItemTypeTable[item^.type].slot;     { 6200:02cc / 02d4 }
if slot = 1 then part[1] := acv + item^.plus                     { 6200:02ea / 02f0  shield }
else if acv = 0 then begin                                       { 6200:030b  protection item }
  if slot = 9 then begin if item^.plus > part[3] then part[3] := item^.plus end   { 6200:0311 / 0317  best ring }
  else part[2] := part[2] + item^.plus;                          { 6200:0337 }
  c^.ac_item_bonus := c^.ac_item_bonus + item^.plus2;            { 6200:0352 }
end else if acv + item^.plus > part[4] then begin                { 6200:0371  armour }
  part[4] := acv + item^.plus;                                   { 6200:0390 }
  if (item^.plus > 0) and (slot = 2) then magicArmour := true;   { 6200:03a8 }
end;
```

### 6200:03C5 EncumbranceMoveLimit (H)
`procedure EncumbranceMoveLimit(c [BP+6]: PChar)` (`RETF 4`). Pool: 00BA:03A0 — **same**.
```pascal
e := LongInt(c^.encumbrance) - StrWeightAllowance(c);            { 6200:03cb }
if e < 0 then e := 0;                                            { 6200:03eb }
if (e >= 0) and (e <= 512) then m := c^.move                     { 6200:03f9 }
else if (e >= 513) and (e <= 768) then m := 9                    { 6200:0410 }
else if (e >= 769) and (e <= 1024) then m := 6                   { 6200:0420 }
else m := 3;                                                     { 6200:0430 }
if m < c^.move then c^.move := m;                                { 6200:0434 }
```

### 6200:0467 BuildItemName (H)
`procedure BuildItemName(c [BP+12h]: PChar; item [BP+0Eh]: PItem; col [BP+0Ch], row [BP+0Ah]: Byte; withReady [BP+8], draw [BP+6]: Boolean)` (far, stub ov24 e1; `RETF 10h`). Pool: 00BA:0442 — **changed**: arrows/quarrels whose first word is 87h are not pluralised.
`ItemWord[w]` = string[20] at DS:1040 + 21·w. CS literals 6200:0452 `' Yes  '`, 0459 `' No   '`, 0460 `'*'`, 0462 `' '`, 0464 `'s '`.
```pascal
item^.name := '';                                                { 6200:046e }
if withReady then                                                { 6200:0475 }
  if item^.readied <> 0 then item^.name := ' Yes  ' else item^.name := ' No   ';   { 6200:047b / 049a }
detect := false;  p := PartyList;                                { 6200:04ad / 04b1 }
while (p <> nil) and not detect do begin                         { 6200:04bd }
  if HasEffect(p, 5, node) then detect := true;                  { 6200:04cb  Detect Magic }
  p := p^.next;                                                  { 6200:04e5 }
end;
if detect and ((item^.plus > 0) or (item^.plus2 > 0) or (item^.magic_flag <> 0)) then   { 6200:04f7 }
  item^.name := item^.name + '*' + ' ';                          { 6200:051b }
if item^.count > 0 then item^.name := item^.name + ByteToStr(item^.count) + ' ';   { 6200:054d / 0557 }
shown := 0;                                                      { 6200:0596 }
for k := 1 to 3 do                                               { 6200:059a }
  if (item^.word[k] <> 0) and (((item^.hidden shr (3 - k)) and 1) = 0) then shown := shown + (1 shl (k - 1));   { 6200:05a3 / 05d6 }
plural := false;                                                 { 6200:05ee }
for k := 3 downto 1 do                                           { 6200:05f2 }
  if (shown shr (k - 1)) and 1 > 0 then begin                    { 6200:05fb }
    item^.name := item^.name + ItemWord[item^.word[k]];          { 6200:0616 }
    if (item^.count < 2) or plural then item^.name := item^.name + ' '   { 6200:0656 / 0666 }
    else if ((1 shl (k - 1)) = shown) or ((k = 1) and (shown > 4) and (item^.type <> $56))
         or ((k = 2) and not Odd(shown)) or ((k = 3) and (item^.type = $56))   { 6200:0691 .. 06d4 }
         or ((item^.word[3] <> $87) and (item^.type in [$49, $1C]) and (item^.word[3] <> $B1)) then begin   { 6200:06de / 06e8 / 06fc }
      item^.name := item^.name + 's ';  plural := true;          { 6200:0706 / 072e }
    end else item^.name := item^.name + ' ';                     { 6200:0734 }
  end;
if draw then DrawText(col, row, $0A, 0, item^.name);             { 6200:0765 }
```

### 6200:0795 PartySummary (H)
`procedure PartySummary(sel [BP+6]: PChar)` (far, stub ov24 e2; name from eclview_names.json) — Pool: 00BA:0767
DrawPartyRoster — **changed**: nothing is drawn in view mode 3; the column test and colours are Curse's.
```pascal
if view_Mode = 3 then Exit;                                      { 6200:079b }
if view_Mode = 0 then x0 := 1 else x0 := $11;                    { 6200:07a5 }
y := 2;                                                          { 6200:07b6 }
DrawText(x0, y, $0F, 0, 'Name');                                 { 6200:07ba }
DrawText($21, y, $0F, 0, 'AC  HP');                              { 6200:07dc }
y := y + 2;  p := PartyList;                                     { 6200:07fd / 0801 }
while p <> nil do begin                                          { 6200:080d }
  ClearRectangle(x0, y, $26, y);                                 { 6200:0818 }
  if p = sel then DrawText(x0, y, $0F, 0, p^.name)               { 6200:082c / 083b }
  else DrawCharacterName(p, x0, y, 0);                           { 6200:0855 }
  case p^.ac of $00..$32: dx := 1;  $33..$3C: dx := 2;  $3D..$45: dx := 1;  else dx := 0 end;   { 6200:086a }
  DrawAC(p, $20 + dx, y);                                        { 6200:08a4 }
  case p^.hp of 0..9: dx := 2;  10..99: dx := 1;  else dx := 0 end;   { 6200:08bf }
  DrawHP(p, $24 + dx, y, 0);                                     { 6200:08e9 }
  y := y + 1;  p := p^.next;                                     { 6200:0907 / 090a }
end;
ClearRectangle(x0, y, $26, y);                                   { 6200:091d }
```

### 6200:0939 DrawAC (H)
`procedure DrawAC(c [BP+0Ah]: PChar; col [BP+8], row [BP+6]: Byte)` (`RETF 8`). Pool: 00BA:08EF — **same**.
```pascal
s := ByteToStr(Abs(c^.ac - 60));                                 { 6200:0939 }
if c^.ac > 60 then s := '-' + s;                                 { 6200:096d }
DrawText(col, row, $0A, 0, s);                                   { 6200:09a2 }
```

### 6200:09C1 DrawHP (H)
`procedure DrawHP(c [BP+0Ch]: PChar; col [BP+0Ah], row [BP+8]: Byte; highlight [BP+6]: Boolean)` (`RETF 0Ah`). Pool: 00BA:0973 — **same**.
```pascal
if c^.hp < c^.hp_max then colour := $0E else colour := $0A;      { 6200:09c8 }
if highlight then colour := $0D;                                 { 6200:09e3 }
DrawText(col, row, colour, 0, ByteToStr(c^.hp));                 { 6200:09ed }
```

### 6200:0A34 DrawCharacterSummary (H)
`procedure DrawCharacterSummary(c [BP+6]: PChar)` (far, stub ov24). Pool: 00BA:09E3 — **changed**: runs only when the flag
combat_Shown is set, and clears it (one redraw per request).
```pascal
if combat_Shown = 0 then Exit;                                         { 6200:0a3a }
combat_Shown := 0;                                                     { 6200:0a44 }
ClearRectangle($17, 1, $26, $15);                                { 6200:0a49 }
y := 1;                                                          { 6200:0a5a }
ShowCharacterMessage(c, ' ', y, 0);                              { 6200:0a5e  the name line }
y := y + 1;                                                      { 6200:0a7e }
DrawText($17, y + 1, $0A, 0, 'Hitpoints');  DrawHP(c, $21, y + 1, 0);   { 6200:0a81 / 0aa5 }
y := y + 2;                                                      { 6200:0abc }
DrawText($17, y + 1, $0A, 0, 'AC');  DrawAC(c, $1A, y + 1);      { 6200:0ac0 / 0ae4 }
text_Row := y + 1;                                               { 6200:0af8 }
if c^.readied[0] <> nil then begin                               { 6200:0b01 }
  y := y + 2;                                                    { 6200:0b10 }
  BuildItemName(c, c^.readied[0], 0, 0, 0, 0);                   { 6200:0b18 }
  DrawWrappedText($17, y + 1, $26, y + 3, $0A, 0, 1, c^.readied[0]^.name);   { 6200:0b3b }
end;
y := text_Row + 1;                                               { 6200:0b6a }
if c^.active = 0 then DrawText($17, y + 1, $0F, 0, StatusName[c^.status])   { 6200:0b73 / 0b7e  string[12] table DS:0FE0 + 13·s }
else if IsHelpless(c) then DrawText($17, y + 1, $0F, 0, '(Helpless)');   { 6200:0bab / 0bb9 }
```

### 6200:0BE3 IsHelpless (M)
`function IsHelpless(c [BP+6]: PChar): Boolean` (`RETF 4`). Pool: 00BA:0B73 — **same** (HelplessEffectIds DS:27C9, k = 1..4).
```pascal
r := false;                                                      { 6200:0be9 }
for k := 1 to 4 do if HasEffect(c, HelplessEffectIds[k], node) then r := true;   { 6200:0bed / 0bf6 }
IsHelpless := r;                                                 { 6200:0c1f }
```

### 6200:0C28 RecalcItems (H)
`procedure RecalcItems(c [BP+6]: PChar)` (far, stub ov24 e7; name from other lanes) — the character's derived stats.
Pool: 00BA:0BB8 RecalcCharacter — **changed** (345/391): no Bag-of-Holding word test (the flag is never set), the
dual-class fighter level. Locals: `f[0..4]` AC parts [BP-0Dh..-9], `magicArmour` [BP-7], `holding` [BP-8].
```pascal
for k := 0 to 12 do c^.readied[k] := nil;                        { 6200:0c2e }
holding := false;  c^.item_count := 0;  it := c^.items;          { 6200:0c56 / 0c5a / 0c63 }
c^.hands_used := 0;  c^.encumbrance := 0;  ReadiedWeight := 0;          { 6200:0c73 / 0c7c / 0c86  weight of the readied items (M) }
while it <> nil do begin                                         { 6200:0c8b }
  c^.item_count := c^.item_count + 1;                            { 6200:0c96 }
  w := it^.weight;  if it^.count > 0 then w := it^.count * w;    { 6200:0c9e / 0ca8 }
  c^.encumbrance := c^.encumbrance + w;                          { 6200:0cc1 }
  if it^.readied <> 0 then begin                                 { 6200:0ccc }
    ReadiedWeight := ReadiedWeight + w;                                        { 6200:0cd9 }
    s := ItemTypeTable[it^.type].slot;                           { 6200:0ce0 }
    if s <= 8 then c^.readied[s] := it                           { 6200:0cf6 }
    else if s = 9 then                                           { 6200:0d23  rings: readied[9] +175h, then [10] +179h }
      if c^.readied[9] <> nil then begin if c^.readied[10] = nil then c^.readied[10] := it end   { 6200:0d28 / 0d37 }
      else c^.readied[9] := it;                                  { 6200:0d5a }
    if it^.type = $49 then c^.readied[11] := it;                 { 6200:0d6c  arrows }
    if it^.type = $1C then c^.readied[12] := it;                 { 6200:0d88  quarrels }
    c^.hands_used := c^.hands_used + ItemTypeTable[it^.type].hands;   { 6200:0da4  +1 }
  end;
  it := it^.next;                                                { 6200:0dcf }
end;
for k := 0 to 6 do c^.encumbrance := c^.encumbrance + c^.money[k];   { 6200:0de1 }
for k := 1 to 2 do begin                                         { 6200:0e10 }
  c^.dmg_dice[k] := c^.base_dmg_dice[k];                         { 6200:0e19  +19Dh+k := +11Dh+k }
  c^.dmg_sides[k] := c^.base_dmg_sides[k];                       { 6200:0e37  +19Fh+k := +11Fh+k }
  c^.dmg_bonus[k] := c^.base_dmg_bonus[k];                       { 6200:0e55  +1A1h+k := +121h+k }
end;
for k := 0 to 4 do f[k] := 0;                                    { 6200:0e79 }
magicArmour := false;  c^.ac_item_bonus := 0;                    { 6200:0e92 / 0e96 }
c^.ac := c^.base_ac;  c^.move := c^.base_move;  c^.thac0 := c^.base_thac0;   { 6200:0e9f / 0eaf / 0ebf  +124h, +E4h, +73h }
f[0] := DexDefenseAdj(c);                                        { 6200:0ece }
if c^.readied[0] = nil then begin                                { 6200:0edb }
  c^.thac0 := c^.thac0 + StrToHitAdj(c);                         { 6200:0eea }
  c^.dmg_bonus[1] := c^.dmg_bonus[1] + StrDamageAdj(c);          { 6200:0f0b }
end;
RecalcWeaponStats(c);                                            { 6200:0f2b }
it := c^.items;                                                  { 6200:0f35 }
while it <> nil do begin                                         { 6200:0f45 }
  if it^.readied <> 0 then begin ArmourMoveLimit(c, it);  AddItemAC(c, it, f, magicArmour) end;   { 6200:0f4d / 0f57 / 0f67 }
  it := it^.next;                                                { 6200:0f81 }
end;
if magicArmour then f[3] := 0;                                   { 6200:0f92 }
if holding then begin                                            { 6200:0f9c  dead: holding stays false }
  if c^.encumbrance < 5000 then c^.encumbrance := 0 else c^.encumbrance := c^.encumbrance - 5000;   { 6200:0fa2 / 0fba }
  if c^.encumbrance < ReadiedWeight then c^.encumbrance := ReadiedWeight;      { 6200:0fc4 }
end;
EncumbranceMoveLimit(c);                                         { 6200:0fdd }
if f[4] < c^.ac then f[4] := c^.ac;                              { 6200:0fe7 }
c^.ac := 0;  for k := 0 to 4 do c^.ac := c^.ac + f[k];           { 6200:1006 / 100f }
c^.ac_rear := f[4] + f[2] + f[3] - 2;                            { 6200:103e }
if ((c^.level[2] > 0) or ((c^.old_level[2] > 0) and DualClassActive(c))) and (c^.race > 0) then   { 6200:105d / 1068 / 1073 / 1082 }
  c^.fighter_lvl_eff := c^.level[2] + c^.old_level[2] * DualClassActive(c)   { 6200:108c }
else c^.fighter_lvl_eff := 1;                                    { 6200:10bc }
```
`{ quirks (as Pool): ac_item_bonus is recomputed but not added to ac; f[4] < ac is a signed compare. }` g_4CB8 = Pool g_4846.

### 6200:10CB ByteToStr (H) / 6200:1107 WordToStr (H) / 6200:1141 LongToStr (H)
`function ByteToStr(v [BP+6]: Byte): String` / `WordToStr(v: Word)` / `LongToStr(v [BP+6]: LongInt)`. Pool: 00BA:1037 /
1073 / 10AD — **same**.
```pascal
Str(LongInt(v), result);                                         { 6200:10cb  (1107, 1141) }
```

### 6200:117A DexDefenseAdj (H)
`function DexDefenseAdj(c [BP+6]: PChar): ShortInt` (`RETF 4`). Pool: 00BA:10E6 — **same** (current DEX `+17h`).
```pascal
case c^.dex of 1..3: r := -4;  4..6: r := c^.dex - 7;  15..18: r := c^.dex - 14;  19..20: r := 4;  21..23: r := 5;  24..25: r := 6;
else r := 0 end;                                                 { 6200:1180 }
```

### 6200:120A DexMissileAdj (H)
`function DexMissileAdj(c [BP+6]: PChar): ShortInt` (`RETF 4`) — caller: RecalcWeaponStats. Pool: 00BA:1168 DexMissileAdj
(paired to 117A by shape; this one is called in its place) — **changed** values.
```pascal
case c^.dex of                                                   { 6200:1210 }
  0..2: r := -4;  3..5: r := c^.dex - 6;  16..18: r := c^.dex - 15;   { 6200:121f / 122f / 1246 }
  19..20: r := 3;  21..23: r := 4;  24..25: r := 5;              { 6200:125d / 126d / 127d }
else r := 0 end;                                                 { 6200:128d }
```

### 6200:129A StrengthIndex (H)
`function StrengthIndex(c [BP+6]: PChar): Byte` (`RETF 4`). Pool: 00BA:11EA — **same** (current STR `+11h`, exceptional `+1Ch`).
```pascal
if c^.str <= 17 then r := c^.str                                 { 6200:12a3 }
else if c^.str = 18 then case c^.str_exc of 0: r := 18;  1..50: r := 19;  51..75: r := 20;  76..90: r := 21;  91..99: r := 22;  100: r := 23 end   { 6200:12b6 / 12c7 }
else if (c^.str >= 19) and (c^.str <= 25) then r := c^.str + 5;  { 6200:1330 }
```
`{ quirk (as Pool): STR > 25 or str_exc > 100 leave r uninitialised. }`

### 6200:1345 StrToHitAdj (H)
`function StrToHitAdj(c [BP+6]: PChar): ShortInt` (`RETF 4`) — callers: RecalcItems, RecalcWeaponStats. Pool: 00BA:1282
StrToHitAdj — **changed** (not paired by shape; AD&D STR to-hit table by StrengthIndex).
```pascal
r := 0;  i := StrengthIndex(c);                                  { 6200:134b / 134f }
if c^.b[$125] <> 0 then                                          { 6200:135c  the STR-bonus flag (Pool unk_AA) }
  case i of 1..3: r := -3;  4..5: r := -2;  6..7: r := -1;  17..19: r := 1;  20..22: r := 2;  23..25: r := 3;   { 6200:136a .. 13c9 }
            26..27: r := 4;  28..30: r := i - 23 end;            { 6200:13cf / 13df }
```

### 6200:13FD StrDamageAdj (H)
`function StrDamageAdj(c [BP+6]: PChar): ShortInt` (`RETF 4`). Pool: 00BA:1325 — **same** (flag `+125h`).
```pascal
r := 0;  i := StrengthIndex(c);                                  { 6200:1403 / 1407 }
if c^.b[$125] <> 0 then case i of 1..2: r := -2;  3..5: r := -1;  16: r := 1;  17..19: r := i - 16;  20..29: r := i - 17;  30: r := 14 end;   { 6200:1414 }
```

### 6200:148F StrWeightAllowance (H)
`function StrWeightAllowance(c [BP+6]: PChar): Integer` (`RETF 4`). Pool: 00BA:13AB — **same**.
```pascal
case StrengthIndex(c) of 1..3: r := -350;  4..5: r := -250;  6..7: r := -150;  12..13: r := 100;  14..15: r := 200;  16: r := 350;
  17..21: r := (i - 17) * 250 + 500;  22..26: r := (i - 22) * 1000 + 2000;  27: r := 7500;  28..30: r := (i - 28) * 3000 + 9000;
else r := 0 end;                                                 { 6200:148f / 1495 }
```

### 6200:1583 ForgetMemorizedSpell (H)
`procedure ForgetMemorizedSpell(c [BP+8]: PChar; id [BP+6]: Byte)` (`RETF 6`) — caller: EffFeeblemind (ov12). Pool:
00BA:148B — **changed**: the character is a parameter (Pool used SelectedChar), 84 slots.
```pascal
k := 0;                                                          { 6200:1589 }
while k <= $53 do begin                                          { 6200:158d }
  if c^.mem_spell[k] = id then begin c^.mem_spell[k] := 0;  k := $54 end;   { 6200:1593 / 15ab / 15b5 }
  k := k + 1;                                                    { 6200:15b9 }
end;
```

### 6200:15FF LoseItem (H)
`procedure LoseItem(c [BP+0Ah]: PChar; item [BP+6]: PItem)` (far, stub ov24; `RETF 8`). Pool: 00BA:1509 — **same**.
```pascal
if item = nil then begin ShowBottomPromptAndReadKey($0E, 0, 'Nil Item pointer...');  Exit end;   { 6200:1605 / 160d }
p := c^.items;                                                   { 6200:162a }
if p = item then c^.items := item^.next                          { 6200:163a / 1649 }
else begin
  while (p <> nil) and (p^.next <> item) do p := p^.next;        { 6200:1661 }
  if p = nil then begin ShowBottomPromptAndReadKey($0E, 0, 'Tried to Lose item & couldn''t find it!');  Exit end;   { 6200:168d / 1695 }
  p^.next := item^.next;                                         { 6200:16b1 }
end;
item^.next := nil;                                               { 6200:16c5 }
FreeMem(item, $3F);                                              { 6200:16d2 }
```

### 6200:16E6 AppendItemCopy (H)
`procedure AppendItemCopy(c [BP+0Ah]: PChar; item [BP+6]: PItem)` (`RETF 8`). Pool: 00BA:15F7 — **same**.
```pascal
GetMem(n, $3F);  Move(item^, n^, $3F);  n^.next := nil;          { 6200:16e6 / 16fa / 170d }
p := c^.items;                                                   { 6200:171a }
if p = nil then c^.items := n                                    { 6200:172a }
else begin while p^.next <> nil do p := p^.next;  p^.next := n end;   { 6200:1746 / 1764 }
```

### 6200:177A ShowTimedBottomMessage (H)
`procedure ShowTimedBottomMessage(s [BP+6]: string[40])` (far, stub ov24 e19; `RETF 4`). Pool: 00BA:1693 — **same**.
```pascal
ClearRectangle(0, $18, $27, $18);                                { 6200:1793 }
DrawText(0, $18, $0A, 0, s);                                     { 6200:17a4 }
MessageDelay;                                                    { 6200:17ba }
ClearRectangle(0, $18, $27, $18);                                { 6200:17bf }
```

### 6200:17D6 ShowCharacterMessage (H)
`procedure ShowCharacterMessage(c [BP+0Eh]: PChar; s [BP+0Ah]: string; combatRow [BP+8]: Byte; wait [BP+6]: Boolean)`
(`RETF 0Ch`). Pool: 00BA:16EC — **changed**: no frame is drawn outside combat; the row switch is RestActive (DS:757E).
```pascal
t := s;                                                          { 6200:17d6 }
if view_Mode = 5 then begin                                      { 6200:17f1 }
  ClearRectangle($17, combatRow, $26, $15);                      { 6200:17f8 }
  DrawCharacterName(c, $17, combatRow, 0);                       { 6200:180a }
  DrawWrappedText($17, combatRow + 1, $26, $15, $0A, 0, 1, t);   { 6200:181e }
end else begin
  if RestActive <> 0 then row := $12 else row := $11;            { 6200:1844 / 184b / 1852 }
  ClearRectangle(1, row, $26, $16);                              { 6200:1857 }
  DrawCharacterName(c, 1, row + 1, 0);                           { 6200:186a }
  DrawWrappedText(1, row + 2, $26, $16, $0A, 0, 1, t);           { 6200:1882 }
end;
if wait then begin MessageDelay;  ClearCharacterMessage end;     { 6200:18a9 / 18af / 18b4 }
```

### 6200:18BE ClearCharacterMessage (H)
`procedure ClearCharacterMessage` (far, stub ov24). Pool: 00BA:17E3 — **same**.
```pascal
if view_Mode = 5 then ClearRectangle($17, $0A, $26, $15)         { 6200:18be }
else ClearRectangle(1, $12, $26, $16);                           { 6200:18db }
```

### 6200:18F3 DrawCharacterName (H)
`procedure DrawCharacterName(c [BP+0Ch]: PChar; col [BP+0Ah], row [BP+8]: Byte; possessive [BP+6]: Boolean)` (`RETF 0Ah`). Pool: 00BA:1816 — **same**.
```pascal
if c^.active = 0 then colour := $0C else if c^.side = 1 then colour := $0E else colour := $0B;   { 6200:18f9 / 190a / 191b }
DrawText(col, row, colour, 0, c^.name);                          { 6200:191f }
if possessive then DrawText(col + Length(c^.name), row, colour, 0, '''s');   { 6200:193e }
```

### 6200:1975 CopyCombatAnimationFrame (M)
`procedure CopyCombatAnimationFrame(icon [BP+0Ch], part [BP+0Ah], frame [BP+8]: Byte; mirror [BP+6]: Boolean)` (`RETF 8`).
Pool: 00BA:1892 — **changed**: the second plane is copied with the full frame size (Pool quartered it in CGA). Animation
picture `g_75E0` (Pool g_6E36), icons `icon_Pic` DS:65D6 (far pointers, icon×8 + part×4).
```pascal
size := g_75E0^.w[$11];                                          { 6200:197b }
if mirror then begin                                             { 6200:1986 }
  AllocPicture($18, 3, 1, 1, tmp);                               { 6200:198f }
  MirrorPicture(icon_Pic[icon, part], tmp);                   { 6200:19a7 }
  Move(tmp^.data[$17], g_75E0^.data[$17 + frame * size], size);  { 6200:19d2 }
  Move(tmp^.plane2^, g_75E0^.plane2^[frame * size], size);       { 6200:19f7 }
  FreePicture(tmp);                                              { 6200:1a1c }
end else begin
  Move(icon_Pic[icon, part]^.data[$17], g_75E0^.data[$17 + frame * size], size);   { 6200:1a28 }
  Move(icon_Pic[icon, part]^.plane2^, g_75E0^.plane2^[frame * size], size);        { 6200:1a66 }
end;
```

### 6200:1AAA BuildFourAnimationFrames (M)
`procedure BuildFourAnimationFrames(icon [BP+6]: Byte)` (far, stub ov24). Pool: 00BA:19DE — **same**.
```pascal
CopyCombatAnimationFrame(icon, 0, 0, 0);                         { 6200:1aaa }
CopyCombatAnimationFrame(icon, 0, 1, 1);                         { 6200:1abe }
CopyCombatAnimationFrame(icon, 1, 2, 1);                         { 6200:1acf }
CopyCombatAnimationFrame(icon, 1, 3, 0);                         { 6200:1ae0 }
```

### 6200:1AF7 AnimateAlongPath (M)
`procedure AnimateAlongPath(x0 [BP+10h], y0 [BP+0Eh], x1 [BP+0Ch], y1 [BP+0Ah]: ShortInt; frames [BP+8], delay [BP+6]: Byte)`
(far, stub ov24; `RETF 0Ch`) — callers: EffStoneGaze, EffSpitAcid, EffParalyzingGaze (ov12), COMBAT / MAGIC missiles. Pool:
00BA:1A29 — **changed** (shape 0.50, rewritten): the same algorithm (a VIEW Bresenham line in thirds of a square, a 7×7
window that scrolls with FocusSquare, the 4-frame picture g_75E0 drawn into `view_Pic` and restored from `PicSaveBuf`),
with Curse's VIEW routines and a 18h-byte line record. Statement-level body not repeated here (Unknowns); the anchors of the
main steps:
```pascal
FillChar(path, $94, 8);                                          { 6200:1af7 }
FillChar(L, $18, 0);                                             { 6200:1b1e }
n := 0;  frame := 0;  L := (x0*3, y0*3, x1*3, y1*3);             { 6200:1b30 / 1b35 / 1b3a }
LineInit(L);  repeat more := LineStep(L);  path[n] := L.dir;  Inc(n) until not more;   { 6200:1b70 / 1b75 / 1b8e / 1ba2 }
count := n - 2;  if (count < 2) or (n < 2) then Exit;            { 6200:1ba9 / 1bb6 / 1bbd }
{ window choice (both ends visible / |dx|,|dy| <= 6 / else) and FocusSquare(cx, cy, $FF, 8) as Pool }   { 6200:1bc7 .. 1c9f }
{ per step: DrawPicture(px, py, frame, 5, g_75E0, view_Pic); FlushViewDirtyLines; Delay(delay);
  DrawPicture(px, py, 0, 0, PicSaveBuf, view_Pic); scrolling with Sign / FocusSquare }   { 6200:1d9d .. 1f40, 2097 .. 20ce }
{ arrival: if not InWindow(x1, y1) then FocusSquare(x1, y1, 3, 8); last frame; restore when delay > 0 }   { 6200:20f5 .. 21a5 }
FlushViewDirtyLines;                                             { 6200:21d2 }
```

### 6200:21DD ShowCombatMessageAnimation (M)
`procedure ShowCombatMessageAnimation(c [BP+0Ch]: PChar; spell [BP+0Ah]: Boolean; s [BP+6]: string)` (far, stub ov24;
`RETF 0Ah`). Pool: 00BA:1FEB — **changed**: no sound-timer switching; the message string is string[255].
```pascal
t := s;                                                          { 6200:21dd }
if view_Mode = 5 then begin                                      { 6200:21f8 }
  if spell then icon := $16 else icon := $17;                    { 6200:2202 / 2208 / 220f }
  BuildFourAnimationFrames(icon);                                { 6200:2214 }
  if not IsVisible(c, 1) then FocusSquare(CombatantCol(c), CombatantRow(c), 3, 8);   { 6200:221d / 222f }
  if spell then PlayOrStopSound(g_25B4)                          { 6200:2252 / 2258  effect 4-1 }
  else PlayOrStopSound(g_25B2);                                  { 6200:2263  effect 3-1 }
  ShowCharacterMessage(c, t, $0A, 0);                            { 6200:226c }
  if spell then reps := GameSpeed else reps := 0;                { 6200:2282 / 2288 / 2291 }
  k := CombatantIndex(c);                                        { 6200:2296 }
  px := cb_ScrCol[k] * 3;  py := cb_ScrRow[k] * 3;               { 6200:22a1 / 22be  DS:67C6 / 680E }
  for r := 0 to reps do                                          { 6200:22d0 }
    for f := 0 to 3 do begin                                     { 6200:22e9 }
      DrawPicture(px, py, f, 5, g_75E0, view_Pic);               { 6200:22f8 }
      FlushViewDirtyLines;  Delay(70);                           { 6200:2321 / 2326 }
      DrawPicture(px, py, 0, 0, PicSaveBuf, view_Pic);           { 6200:232f }
    end;
  FlushViewDirtyLines;                                           { 6200:2367 }
  if reps = 0 then MessageDelay;                                 { 6200:236c / 2373 }
end
else ShowCharacterMessage(c, t, $0A, 1);                         { 6200:237a }
```

### 6200:2396 HasEffect (H)
`function HasEffect(c [BP+0Ch]: PChar; id [BP+0Ah]: Byte; var e [BP+6]: PEffect): Boolean` (far, stub ov24; `RETF 0Ah`). Pool: 00BA:2199 — **same** (effects `+F2h`).
```pascal
found := false;  e := c^.effects;                                { 6200:239c / 23a0 }
while (e <> nil) and not found do                                { 6200:23b4 }
  if e^.type = id then found := true else e := e^.next;          { 6200:23c6 / 23da }
HasEffect := found;                                              { 6200:23f2 }
```

### 6200:2421 ApplyDamage (H)
`procedure ApplyDamage(c [BP+8]: PChar; dmg [BP+6]: Byte)` (`RETF 6`). Pool: 00BA:2228 — **same** (status `+195h`, the
per-side counts DS:6F90/6F91, set constant CS:2401 = [0, 1]).
```pascal
over := 0;  left := 0;                                           { 6200:2427 }
if c^.hp >= dmg then left := c^.hp - dmg else over := dmg - c^.hp;   { 6200:242f / 2454 }
if (over > 9) or ((left = 0) and (c^.status = 1)) then c^.status := 6   { 6200:246a / 2481  Dead }
else if over > 0 then begin                                      { 6200:248c }
  c^.status := 5;                                                { 6200:2492  Dying }
  if view_Mode = 5 then cr(c)^.b[$0E] := over;                   { 6200:249b }
end else if left = 0 then c^.status := 4;                        { 6200:24b9  Unconscious }
if c^.status in [0, 1] then c^.hp := left                        { 6200:24c5 / 250e }
else begin
  c^.active := 0;  c^.hp := 0;                                   { 6200:24d7 / 24e0 }
  if view_Mode = 5 then begin Dec(side_ActiveCount[c^.side]);  cr(c)^.b[3] := 0 end;   { 6200:24e9 / 24f3 / 2502 }
end;
```

### 6200:2543 ShowHealingResult (H)
`procedure ShowHealingResult(c [BP+6]: PChar)` (`RETF 4`). Pool: 00BA:234A — **same**.
```pascal
if c^.hp = c^.hp_max then s := 'is fully healed' else s := 'is partially healed';   { 6200:2549 / 256f }
ShowCharacterMessage(c, s, $0A, 1);                              { 6200:2582 }
if view_Mode <> 5 then PartySummary(SelectedChar);               { 6200:2597 / 259e }
```

### 6200:25B0 IsSideZero (H) / 6200:25D4 CountActiveSides (H)
Pool: 00BA:23B7 / 23DB — **same** (side `+197h`, active `+196h`).
```pascal
IsSideZero := c^.side = 0;                                       { 6200:25b6 }
side_ActiveCount[0] := 0;  side_ActiveCount[1] := 0;  c := PartyList;                      { 6200:25da  (CountActiveSides) }
while c <> nil do begin if c^.active <> 0 then Inc(side_ActiveCount[c^.side]);  c := c^.next end;   { 6200:25f0 / 25f8 / 2612 }
```

### 6200:2628 CollectOppositeSideTargets (M)
`function CollectOppositeSideTargets(c [BP+8]: PChar; range [BP+6]: Byte): Byte` (`RETF 6`). Pool: 00BA:2433 — **same**
(VIEW target list `tg_List` DS:6E94, 3-byte entries; `cb_Char` DS:6D35; result array foe_List DS:758E+i).
```pascal
BuildTargetList(CombatantCol(c), CombatantRow(c), range, $FF, CombatantSize(c), cm_Map);   { 6200:2628 / 265a }
n := tg_Count;  kept := 0;                                       { 6200:2668 }
if n > 0 then begin                                              { 6200:2672 }
  for i := 1 to n do                                             { 6200:2681 }
    if cb_Char[tg_List[i].idx]^.side = Ord(IsSideZero(c)) then begin Inc(kept);  Move(tg_List[i], tg_List[kept], 3) end;   { 6200:2697 / 26c1 }
  n := kept;  tg_Count := kept;                                  { 6200:26f9 }
end;
for i := 1 to n do foe_List[i] := tg_List[i].idx;                  { 6200:2711 }
CollectOppositeSideTargets := n;                                 { 6200:2743 }
```

### 6200:274C TargetDistance (M)
`function TargetDistance(c [BP+0Ah], target [BP+6]: PChar): Byte` (far, stub ov24; `RETF 8`). Pool: 00BA:255B — **same** (saved list DS:6E97, D8h bytes).
```pascal
Move(tg_List, save, $D8);  cm_Map^.b[6] := 1;                     { 6200:274c / 2767 }
BuildTargetList(CombatantCol(c), CombatantRow(c), $FF, $FF, CombatantSize(c), cm_Map);   { 6200:2770 / 279a }
cm_Map^.b[6] := 0;  i := 1;                                      { 6200:27a8 / 27b1 }
while (cb_Char[tg_List[i].idx] <> target) and (i < tg_Count) do i := i + 1;   { 6200:27b6 }
d := tg_List[i].dist div 2;                                      { 6200:27ef }
Move(save, tg_List, $D8);                                        { 6200:280b / 281a  tg_List = DS:6E97 (globals request #3) }
TargetDistance := d;
```
`{ quirk (as Pool): a target not in the list gives the last entry's distance. }`

### 6200:2828 ClearCombatantActionFlags (M) / 6200:2877 SetGuarding (H)
Pool: 00BA:2637 / 2686 — **same** (combatant `+18Dh`).
```pascal
cr(c)^.b[3] := 0;  cr(c)^.b[0] := 0;  cr(c)^.b[7] := 0;  cr(c)^.b[6] := 0;  ClearCombatantActionFlags := true;   { 6200:282e .. 2861 }
r := ClearCombatantActionFlags(c);  cr(c)^.b[7] := 1;  ShowTimedBottomMessage('Guarding');   { 6200:2877 / 288a / 2897  (SetGuarding) }
```

### 6200:28B3 SpellCasterLevel (M)
`function SpellCasterLevel(sp [BP+6]: Byte): Byte` (`RETF 2`) — the casting level of SelectedChar for spell `sp`; callers:
MagicResistance (ov12), MAGIC. Pool: 00BA:26C2 SpellCasterLevel — **changed** (not paired; dual-class levels, paladins and
rangers). spells_Table entry DS:37DA + 16·sp: +0 class (0 cleric, 1 druid, 2 magic-user, 3 other), +1 level.
```pascal
c := SelectedChar;  k := DualClassActive(c);                           { 6200:28b9 }
if (c^.level[0] = 0) and (c^.level[5] = 0) and (c^.level[3] < 9) and (c^.level[4] < 8) then r := 6   { 6200:28b9 .. 28e9  a monster / non-caster: 6 }
else case spells_Table[sp].class of                                { 6200:28f0 }
  0: r := Max(c^.level[0] + c^.old_level[0] * k, c^.level[3] + c^.old_level[3] * k - 8);   { 6200:2903 .. 2976  cleric / paladin }
  1: r := Max(c^.level[4] + c^.old_level[4] * k - 7, 0);         { 6200:297d .. 29bf  ranger (druid spells) }
  2: r := Max(c^.level[5] + c^.old_level[5] * k, c^.level[4] + c^.old_level[4] * k - 8);   { 6200:29c6 .. 2a39  magic-user / ranger }
  3: r := 12;                                                    { 6200:2a3f }
end;
if (ItemCast <> 0) and (spells_Table[sp].class <> 3) then r := 6;    { 6200:2a43 / 2a5c }
SpellCasterLevel := r;                                           { 6200:2a60 }
```

### 6200:2A6D RedrawCurrentMode (H)
`procedure RedrawCurrentMode` (far, stub ov24 e37). Pool: 00BA:27D9 — **changed**: Curse's screen layouts (FUN_01A0_0136),
the big-picture case (anim_Id 'P'), the portrait mode test g_8B54, view_Redraw set.
```pascal
view_Redraw := 1;                                                { 6200:2a73 }
case view_Mode of                                                { 6200:2a78 }
  0: DrawScreenFrame;                                            { 6200:2a7f }
  1: begin                                                       { 6200:2a87 }
       if g_8B54 <> 0 then FUN_01A0_0136;                        { 6200:2a8b / 2a92  layout with the side panels (RESIDENT) }
       if anim_Id = $50 then DrawPictureScreenOrView(3, 3, 1, g_7232)   { 6200:2a97 / 2a9e }
       else begin LoadPortrait(pic_HeadId, pic_BodyId);  DrawPortrait(3, 3, 1) end;   { 6200:2ab8 / 2ac5 }
       PartySummary(SelectedChar);  DrawLocationTimeStatus;       { 6200:2ad3 / 2ae0 }
     end;
  2: begin FUN_01A0_0136;  LoadAnimation('PIC', $1D, 0, enc_Anim);   { 6200:2aea / 2aef  camp picture }
       PartySummary(SelectedChar);  DrawLocationTimeStatus end;   { 6200:2b0e / 2b1b }
  4: begin FUN_01A0_0136;  RefreshView;  PartySummary(SelectedChar);  DrawLocationTimeStatus;   { 6200:2b24 / 2b29 / 2b2e / 2b3b }
       g_8B6E := 0 end;                                          { 6200:2b3e }
  3: if anim_Id <> $50 then RefreshView;                         { 6200:2b45 / 2b49 / 2b50 }
  6: begin FUN_01A0_0136;  LoadAnimation('PIC', 1, 0, enc_Anim);  PartySummary(SelectedChar) end;   { 6200:2b5b / 2b60 / 2b7f }
end;
```

### 6200:2BAA DrawLocationTimeStatus (H)
`procedure DrawLocationTimeStatus`. Pool: 00BA:290B — **changed**: no overland coordinates (no travel modes), a `*` in
debug mode, nothing in view mode 3. VM words: clock 4BC7/4BC8/4BC9 (`ecl_Mem4B00` +18Eh/+190h/+192h), hide-coordinates
4BFB (+1F6h), search flag 7ECA (`ecl_Mem7C00` +594h). Direction names DS:2540 (string[2]: N NE E SE S SW W NW).
```pascal
if view_Mode = 3 then Exit;                                      { 6200:2bb1 }
s := '';  x := party_MapX;  y := party_MapY;                     { 6200:2bbb / 2bbf / 2bc5 }
hh := WordToStr(VM[$4BC9]);  if Length(hh) < 2 then hh := '0' + hh;   { 6200:2bcb / 2bec }
mm := WordToStr(10 * VM[$4BC8] + VM[$4BC7]);  if Length(mm) < 2 then mm := '0' + mm;   { 6200:2c1a / 2c4a }
if VM[$4BFB] = 0 then s := ByteToStr(x) + ',' + ByteToStr(y) + ' ';   { 6200:2c78 / 2c84 }
s := s + DirName[party_Dir] + ' ';                               { 6200:2cc7 }
s := s + hh + ':' + mm;                                          { 6200:2d06 }
if DebugFlag <> 0 then s := s + '*';                             { 6200:2d42 / 2d49 }
if view_Mode = 2 then s := s + ' camping'                        { 6200:2d71 / 2d78 }
else if VM[$7ECA] and 1 > 0 then s := s + ' search';             { 6200:2da2 / 2db2 }
ClearRectangle($11, $0F, $26, $0F);                              { 6200:2dda }
DrawText($11, $0F, $0A, 0, s);                                   { 6200:2deb }
```

### 6200:2E05 ov24_2E05 — combat view refresh (M)
`procedure ov24_2E05` (far, stub ov24) — Pool: — **new**.
```pascal
PaletteFlashOn;                                                  { 6200:2e05 }
FUN_01A0_0397;                                                   { 6200:2e0d  combat screen layout (RESIDENT) }
FocusSquare(cm_Map^.x0 + 3, cm_Map^.y0 + 3, $FF, 8);             { 6200:2e12  re-centre the 7×7 window }
```

### 6200:2E6A SelectPartyCharacter (H)
`procedure SelectPartyCharacter(prompt [BP+0Ch]: string[40]; allowExit [BP+0Ah]: Boolean; var sel [BP+6]: PChar)` (far, stub ov24; `RETF 0Ah`). Pool: 00BA:2C48 — **changed**: Exit / Esc clear `sel` only when allowExit.
```pascal
p := prompt;  key := ' ';  exitItem := '';                       { 6200:2e6a / 2e84 }
if allowExit then exitItem := ' Exit';                           { 6200:2e8c / 2e92 }
while not (key in [#13, #27, 'E', 'S']) do begin                 { 6200:2ea5  CS:2E41 }
  PartySummary(sel);                                             { 6200:2eb8 }
  anim := (view_Mode = 2) or (view_Mode = 6);                    { 6200:2ec6 }
  key := HorizontalMenu(p + ' ', 'Select' + exitItem, $0D, $0A, $0F, 1, anim, ext);   { 6200:2ede / 2f12 }
  c := sel;                                                      { 6200:2f2f }
  if ext then begin                                              { 6200:2f3d }
    if key = 'O' then begin c := c^.next;  if c = nil then c := PartyList end   { 6200:2f46 }
    else if key = 'G' then begin                                 { 6200:2f73 }
      c := PartyList;
      if sel = PartyList then while c^.next <> nil do c := c^.next   { 6200:2fc3 }
      else while c^.next <> sel do c := c^.next;                 { 6200:2f97 }
    end;
  end
  else if allowExit and ((key = 'E') or (key = #0)) then c := nil;   { 6200:2fe6 / 2fec / 2ff8 }
  sel := c;                                                      { 6200:3000 }
end;
```

### 6200:3018 WeaponIsRanged (M) / 6200:305B ov24_305B (L)
Pool: 00BA:2E03 / 2E46 — **same**.
```pascal
WeaponIsRanged := (c^.readied[0] <> nil) and (ItemTypeTable[c^.readied[0]^.type].range > 1);   { 6200:301e  +0Ch (DS:5D02) }
ov24_305B := WeaponIsRanged(c) and (ItemTypeTable[c^.readied[0]^.type].wflags2 and $14 = $14);   { 6200:305b }
```

### 6200:30A0 GetMissileAmmo (M)
`function GetMissileAmmo(c [BP+0Ah]: PChar; var ammo [BP+6]: PItem): Boolean` (far, stub ov24; `RETF 8`). Pool: 00BA:2E8B — **same**.
```pascal
ok := false;  w := c^.readied[0];  ammo := nil;  f := 0;         { 6200:30a6 / 30aa / 30ba }
if w <> nil then begin                                           { 6200:30ca }
  f := ItemTypeTable[w^.type].wflags2;                           { 6200:30d2 }
  if f and $10 <> 0 then ammo := w;                              { 6200:30e8 }
  if f and $08 <> 0 then begin
    if f and $01 <> 0 then ammo := c^.readied[11];               { 6200:3109 }
    if f and $80 <> 0 then ammo := c^.readied[12];               { 6200:3126 }
  end;
end;
if (ammo <> nil) or (f = $0A) then ok := true;                   { 6200:3143 }
GetMissileAmmo := ok;
```

### 6200:3162 RacialLevelLimitReached (M)
`function RacialLevelLimitReached(c [BP+8]: PChar; cls [BP+6]: ShortInt): Boolean` (`RETF 6`). Pool: 00BA:2F57 — **same**
(levels `+109h`, race `+74h`, current STR `+11h`): the Pool fighter / half-elf cleric limits.
```pascal
r := false;  lvl := c^.level[cls];                               { 6200:3168 / 3175 }
if lvl > 0 then case c^.race of                                  { 6200:3186 / 318f }
  1: if cls = 2 then r := ((lvl = 8) and (c^.str = 17)) or ((lvl = 7) and (c^.str < 17));   { 6200:319a }
  2: if cls = 2 then r := (lvl = 7) or ((lvl = 6) and (c^.str = 17)) or ((lvl = 5) and (c^.str < 17));   { 6200:31cb }
  3: if cls = 2 then r := (lvl = 6) or ((lvl = 5) and (c^.str < 18));   { 6200:3202 }
  4: if (cls = 0) and (lvl = 5) then r := true else if cls = 2 then r := (lvl = 8) or ((lvl = 7) and (c^.str = 17)) or ((lvl = 6) and (c^.str < 17));   { 6200:3228 / 323a }
  5: if cls = 2 then r := (lvl = 6) or ((lvl = 5) and (c^.str = 17)) or ((lvl = 4) and (c^.str < 17));   { 6200:3270 }
end;
RacialLevelLimitReached := r;
```

### 6200:32A9 MakeItem (M)
`function MakeItem(type [BP+22h], w1 [BP+20h], w2 [BP+1Eh], w3 [BP+1Ch], plus [BP+1Ah], plus2 [BP+18h], readied [BP+16h],
hidden [BP+14h], magic [BP+12h]: Byte; weight [BP+10h]: Word; count [BP+0Eh]: Byte; value [BP+0Ch]: Word; p1 [BP+0Ah],
p2 [BP+8], p3 [BP+6]: Byte): PItem` (far, stub ov24; `RETF 1Eh`) — caller: ReadCharacter (ENGINE ov16, Hillsfar
starting items). Pool: — **new**.
```pascal
GetMem(it, $3F);  FillChar(it^, $3F, 0);                         { 6200:32a9 / 32bd }
it^.type := type;  it^.word[1] := w1;  it^.word[2] := w2;  it^.word[3] := w3;   { 6200:32ce .. 32ec  +2Eh..+31h }
it^.plus := plus;  it^.plus2 := plus2;  it^.readied := readied;  it^.hidden := hidden;  it^.magic_flag := magic;   { 6200:32f6 .. 331e }
it^.weight := weight;  it^.count := count;  it^.value := value;  { 6200:3328 / 3332 / 333c }
it^.power[1] := p1;  it^.power[2] := p2;  it^.power[3] := p3;    { 6200:3346 / 3350 / 335a }
MakeItem := it;                                                  { 6200:3364 }
```

### 6200:3387 BandageDying (M)
`function BandageDying(doIt [BP+6]: Boolean): Boolean` (far, stub ov24; `RETF 2`) — true when a party member is dying; with
`doIt` the first one is bandaged (Unconscious). Pool: 4800:0FFF AnyoneDying (0.88) — **changed** (bandaging).
```pascal
r := false;  p := PartyList;                                     { 6200:338d / 3391 }
while p <> nil do begin                                          { 6200:339d }
  if (cr(p)^.b[$13] = 0) and (p^.side = 0) and (p^.status = 5) then begin   { 6200:33a5 / 33b4 / 33bf }
    r := true;                                                   { 6200:33ca }
    if doIt then begin                                           { 6200:33ce }
      p^.status := 4;  cr(p)^.b[$0E] := 0;                       { 6200:33d4 / 33dd }
      ShowCharacterMessage(p, 'is bandaged', $0A, 1);            { 6200:33ea }
      doIt := false;                                             { 6200:3409 }
    end;
  end;
  p := p^.next;                                                  { 6200:340d }
end;
BandageDying := r;                                               { 6200:3420 }
```

### 6200:342F ov24_init — empty (H)

---

## ov25 (6600) — level statistics, spell slots, saving throws, thief skills, human dual-class change

Pool twin: Pool ov23 (9300, PoolRadianceRE VIEW.pas.md: UpdateLevelStats, WisdomBonusSpells, UpdateSaves,
UpdateThiefSkills) — **changed / new**: only WisdomBonusSpells (0.58) and UpdateThiefSkills (0.59) pair by shape; Curse adds
the dual-class rules (former-class levels `old_level[c] +111h+c`, the level at the change `+E6h`), five spell levels, paladin /
ranger spells and the "Human Change Classes" menu. Tables (START.EXE image): BaseThac0 DS:3E38 (13 per class), ClassBit
DS:3EA0, spell slots per level DS:42BA (cleric) / 43E3 (paladin) / 4446 (ranger) / 44A9 (magic-user, SpellSlotTable) (5 per level), SaveTable
DS:45BC (60 per class, 5 per level), ThiefBase DS:3EBE (8 per level), RaceSkillAdj DS:3F1E (8 per race), DexSkillAdj DS:3F31
(5 per DEX), ClassPrimeReq DS:4172 (6 per class), RaceClasses DS:3FF8, ClassAligns DS:41D8, ClassName DS:0CB6, spells_Table
DS:37DA (16 per spell: +0 class, +1 level). Spell slots: cleric `+12Dh..+131h` (levels 1..5), druid `+132h..+134h` (M),
magic-user `+137h..+13Bh`; known spells `+78h+id`; memorised `+1Eh` (84 bytes); saves `+DFh..+E3h`.

### 6600:0000 ov25_0000 — pre-load (H)
Calls the empty entry of ov23 `{ 6600:0000 }`. Pool: — **new**.

### 6600:0011 RecalcSpellSlots (M)
`procedure RecalcSpellSlots(c [BP+6]: PChar)` (`RETF 4`) — caller: UpdateLevelStats. Pool: — **new**.
```pascal
FillChar(c^.b[$12D], $0F, 0);                                    { 6600:0017  all spell slots }
for cls := 0 to 7 do begin                                       { 6600:0035 }
  if DualClassActive(c) and (c^.old_level[cls] <> 0) then lvl := c^.old_level[cls] else lvl := c^.level[cls];   { 6600:003b / 0070 }
  if lvl > 0 then case cls of                                    { 6600:0081 }
    0: begin c^.b[$12D] := c^.b[$12D] + 1;                       { 6600:0094  cleric: one level-1 slot at level 1 }
         for L := 2 to lvl do for k := 1 to 5 do c^.b[$12C + k] := c^.b[$12C + k] + ClericSlots[L * 5 + k];   { 6600:009c / 00da }
         WisdomBonusSpells(c, 0);                                { 6600:00ed }
         for sp := 1 to 100 do                                   { 6600:00fa }
           if (spells_Table[sp].class = 0) and (c^.b[$12C + spells_Table[sp].level] > 0) and (sp <> $24) then c^.known_spell[sp] := 1;   { 6600:0118 / 0146  every cleric spell of a castable level }
       end;
    3: if lvl > 8 then begin                                     { 6600:015b  paladin from level 9 }
         for L := 9 to lvl do for k := 1 to 5 do c^.b[$12C + k] := c^.b[$12C + k] + PaladinSlots[L * 5 + k];   { 6600:0164 / 01a2 }
         for sp := 1 to 100 do if (spells_Table[sp].class = 0) and (c^.b[$12C + spells_Table[sp].level] > 0) then c^.known_spell[sp] := 1;   { 6600:01b5 / 01fb }
       end;
    4: if lvl > 7 then begin                                     { 6600:0210  ranger from level 8 }
         for L := 8 to lvl do begin
           for k := 1 to 3 do c^.b[$131 + k] := c^.b[$131 + k] + RangerSlots[L * 5 + k];   { 6600:025a  druid slots }
           for k := 4 to 5 do c^.b[$136 + k - 3] := c^.b[$136 + k - 3] + RangerSlots[L * 5 + k];   { 6600:0298  magic-user 1..2 }
         end;
         for sp := 1 to 100 do if spells_Table[sp].class = 1 then c^.known_spell[sp] := 1;   { 6600:02bf / 02d0 }
       end;
    5: begin c^.b[$137] := c^.b[$137] + 1;                       { 6600:02e4  magic-user }
         for L := 2 to lvl do for k := 1 to 5 do c^.b[$136 + k] := c^.b[$136 + k] + SpellSlotTable[L * 5 + k];   { 6600:02e9 / 0327 }
       end;
  end;
end;
it := c^.items;                                                  { 6600:0343 }
while it <> nil do begin                                         { 6600:0353 }
  if (it^.b[$3E] = $81) and (it^.readied <> 0) then              { 6600:035b / 0365 }
    for k := 1 to 3 do c^.b[$136 + k] := c^.b[$136 + k] * 2;     { 6600:036f / 038f  item power 81h doubles magic-user slots 1..3 (Ring of Wizardry, M) }
  it := it^.next;                                                { 6600:039a }
end;
```
`{ quirk: cleric spell 24h is never added to the spell book (M: a spell not for clerics of this game). }`

### 6600:03B1 UpdateLevelStats (H)
`procedure UpdateLevelStats(c [BP+6]: PChar)` (far, stub ov25 e1) — after loading, training, class change. Pool: 9300:0000
UpdateLevelStats — **changed** (not paired: 0.39).
```pascal
c^.base_thac0 := 0;                                              { 6600:03b7 }
for cls := 0 to 7 do begin                                       { 6600:03bf }
  lvl := c^.level[cls];                                          { 6600:03c8 }
  if BaseThac0[cls * 13 + lvl] > c^.base_thac0 then c^.base_thac0 := BaseThac0[cls * 13 + lvl];   { 6600:03d9 / 03f9 }
  if c^.level_main < lvl then c^.level_main := lvl;              { 6600:0417 / 0424 }
  if ((cls = 2) and (lvl > 6)) or ((cls = 4) and (lvl > 7)) or ((cls = 3) and (lvl > 6)) then c^.attacks := 3;   { 6600:042f .. 0469  3/2 attacks }
end;
RecalcSpellSlots(c);  UpdateSaves(c);                            { 6600:0478 / 0482 }
if c^.level[6] > 0 then UpdateThiefSkills(c);                    { 6600:048c / 0497 }
c^.class_mask := 0;                                              { 6600:04a1 }
for cls := 0 to 7 do                                             { 6600:04aa }
  if (c^.level[cls] > 0) or ((c^.old_level[cls] > 0) and (c^.old_level[cls] < c^.level_main)) then   { 6600:04b3 / 04c4 / 04d5 }
    c^.class_mask := c^.class_mask + ClassBit[cls];              { 6600:04ed }
for k := 0 to 12 do                                              { 6600:0505 }
  if (c^.readied[k] <> nil) and (ItemTypeTable[c^.readied[k]^.type].classes and c^.class_mask = 0) and (c^.readied[k]^.b[$36] = 0) then   { 6600:050e / 0527 / 0555 }
    c^.readied[k]^.readied := 0;                                 { 6600:056e  items the classes cannot use are unreadied (not cursed ones, +36h, M) }
if DualClassActive(c) then begin                                 { 6600:058b }
  for cls := 0 to 7 do begin                                     { 6600:059c }
    lvl := c^.old_level[cls];                                    { 6600:05a5 }
    if ((cls in [2, 3]) and (lvl > 6)) or ((cls = 4) and (lvl > 7)) then c^.attacks := 3;   { 6600:05b6 .. 05df }
    if BaseThac0[cls * 13 + lvl] > c^.base_thac0 then c^.base_thac0 := BaseThac0[cls * 13 + lvl];   { 6600:05e5 / 0605 }
  end;
  if (c^.old_level[2] > 6) or (c^.old_level[4] > 7) or (c^.old_level[3] > 6) then c^.attacks := 3;   { 6600:062c / 0637 / 0642 / 064d }
  if c^.old_level[6] > 0 then UpdateThiefSkills(c);              { 6600:0656 / 0661 }
end;
```

### 6600:0671 WisdomBonusSpells (H)
`procedure WisdomBonusSpells(c [BP+8]: PChar; rebuild [BP+6]: Boolean)` (`RETF 6`). Pool: 9300:01AF — **changed**: dual-class
cleric level, an optional rebuild of the slots, WIS 18 adds a level-4 slot.
```pascal
lvl := c^.level[0] + c^.old_level[0] * DualClassActive(c);       { 6600:0674 }
if lvl <= 0 then Exit;                                           { 6600:069f }
if rebuild then begin                                            { 6600:06b1 }
  for k := 2 to 5 do c^.b[$12C + k] := 0;  c^.b[$12D] := 1;      { 6600:06b7 / 06d5 }
  for L := 2 to lvl do for k := 1 to 5 do c^.b[$12C + k] := c^.b[$12C + k] + ClericSlots[L * 5 + k];   { 6600:06de / 071c }
end;
if (c^.wis > 12) and (c^.b[$12D] > 0) then Inc(c^.b[$12D]);      { 6600:072f  current WIS +15h }
if (c^.wis > 13) and (c^.b[$12D] > 0) then Inc(c^.b[$12D]);      { 6600:074c }
if (c^.wis > 14) and (c^.b[$12E] > 0) then Inc(c^.b[$12E]);      { 6600:0769 }
if (c^.wis > 15) and (c^.b[$12E] > 0) then Inc(c^.b[$12E]);      { 6600:0786 }
if (c^.wis > 16) and (c^.b[$12F] > 0) then Inc(c^.b[$12F]);      { 6600:07a3 }
if (c^.wis > 17) and (c^.b[$130] > 0) then Inc(c^.b[$130]);      { 6600:07c0  new }
```

### 6600:07E3 UpdateSaves (H)
`procedure UpdateSaves(c [BP+6]: PChar)` (far, stub ov25 e3). Pool: 9300:0255 UpdateSaves — **changed** (not paired).
```pascal
ring := false;  it := c^.items;                                  { 6600:07e9 / 07ed }
while (it <> nil) and not ring do begin                          { 6600:07fd / 0805 }
  if (it^.b[$3E] > $80) and (it^.readied <> 0) then ring := (it^.b[$3E] and $7F) = 6;   { 6600:080b / 0815 / 081f  item power 6 (M) }
  it := it^.next;                                                { 6600:083a }
end;
for s := 0 to 4 do begin                                         { 6600:084b }
  c^.save[s] := 20;                                              { 6600:0854  +DFh+s }
  for cls := 0 to 7 do                                           { 6600:0863 }
    if (c^.level[cls] > 0) and (c^.save[s] > SaveTable[cls * 60 + c^.level[cls] * 5 + s]) then   { 6600:086c / 0880 }
      c^.save[s] := SaveTable[cls * 60 + c^.level[cls] * 5 + s]; { 6600:08c1 }
  if (c^.level[cls] > c^.old_level[cls]) and (c^.save[s] > SaveTable[cls * 60 + c^.old_level[cls] * 5 + s]) then   { 6600:0907 / 092a  cls = 7 after the loop }
    c^.save[s] := SaveTable[cls * 60 + c^.old_level[cls] * 5 + s];   { 6600:096b }
  if (s = 0) and ((c^.race in [1, 5]) or ring) then              { 6600:09a8 / 09b1 / 09c5 }
    case c^.con of 4..6: Inc(c^.save[s], 1);  7..10: Inc(c^.save[s], 2);  11..13: Inc(c^.save[s], 3);   { 6600:09d1 .. 0a1f  current CON +19h }
      14..17: Inc(c^.save[s], 4);  18: Inc(c^.save[s], 5) end;   { 6600:0a27 / 0a42 }
  if s = 0 then case c^.con of 19, 20: Inc(c^.save[s], 1);  21, 22: Inc(c^.save[s], 2);  23, 24: Inc(c^.save[s], 3);  25: Inc(c^.save[s], 4) end;   { 6600:0a56 .. 0ab5 }
end;
```
`{ quirk: the former-class check runs once after the class loop, so only class 7's former level is looked at — former
classes never improve the saves (H: 0907 follows the loop end at 0904). }` `{ quirk: the CON bonus of dwarves / halflings
(and power 6) is applied to save 0 only, although the AD&D rule also covers save 4. }`

### 6600:0AD8 UpdateThiefSkills (H)
`procedure UpdateThiefSkills(c [BP+6]: PChar)` (far, stub ov25 e4). Pool: 9300:0329 — **changed** (103/225): dual-class
level, readied item powers 0Bh (M: Elven boots/cloak) and 02h (M), skill +E9h+k.
```pascal
elven := false;  power2 := false;  it := c^.items;               { 6600:0ae7 / 0aeb / 0aef }
while (it <> nil) and not elven and not power2 do begin          { 6600:0aff }
  if (it^.b[$3E] > $80) and (it^.readied <> 0) then begin        { 6600:0b13 / 0b1d }
    elven := (it^.b[$3E] and $7F) = $0B;  power2 := (it^.b[$3E] and $7F) = 2;   { 6600:0b27 / 0b42 }
  end;
  it := it^.next;                                                { 6600:0b51 }
end;
lvl := c^.level[6] + c^.old_level[6] * DualClassActive(c);       { 6600:0b62 }
if (lvl < 4) and power2 then begin lvl := 4;  power2 := false end;   { 6600:0b8a / 0b96 }
saved := lvl;                                                    { 6600:0b9e }
for k := 1 to 8 do begin                                         { 6600:0ba4 }
  if elven then                                                  { 6600:0bad }
    if k = 1 then begin if lvl < 5 then begin lvl := 5;  bonus := 0 end else bonus := 5 end   { 6600:0bb3 .. 0bcd }
    else if k = 2 then begin if lvl < 7 then begin lvl := 7;  bonus := 0 end else bonus := 5 end;   { 6600:0bd3 .. 0be8 }
  adj := RaceSkillAdj[c^.race * 8 + k];                          { 6600:0bec }
  if (adj < 0) and (Abs(adj) + bonus > ThiefBase[lvl * 8 + k]) then c^.thief_skill[k] := 0   { 6600:0c03 / 0c0a / 0c54 }
  else begin
    c^.thief_skill[k] := ThiefBase[lvl * 8 + k] + adj + bonus;   { 6600:0c67 }
    if k < 6 then c^.thief_skill[k] := c^.thief_skill[k] + DexSkillAdj[c^.dex * 5 + k];   { 6600:0cba / 0cc0  current DEX +17h }
  end;
  if power2 then c^.thief_skill[k] := c^.thief_skill[k] + 10;    { 6600:0d04 / 0d0a }
  lvl := saved;                                                  { 6600:0d1a }
end;
```
`{ quirk: bonus (local [BP-2]) is only assigned for skills 1 and 2 with the elven item; otherwise it keeps an earlier value
or stack garbage. }`

### 6600:0D2F MayChangeTo (M) *nested in ChangeClass*
`function MayChangeTo(cls [BP+8]: Byte): Boolean` (`RETF 4`, parent frame [BP+6]) — the AD&D human dual-class rule.
Pool: — **new**.
```pascal
ok := RaceClasses[c^.race][gfx_LoopCounter] <> CurrentClass(c);           { 6600:0d35 / 0d61  DS:7747 (gfx_LoopCounter) = the caller's loop index }
k := 0;  while (k <= 5) and ((ClassPrimeReq[CurrentClass(c) * 6 + k] < 9) or (c^.stat_max[k] > 14)) do Inc(k);   { 6600:0d72 / 0d7c  15+ in the current prime requisites }
ok := ok and (k > 5);                                            { 6600:0dc0 }
k := 0;  while (k <= 5) and ((ClassPrimeReq[cls * 6 + k] < 9) or (c^.stat_max[k] > 16)) do Inc(k);   { 6600:0dd5 / 0ddf  17+ in the new ones }
ok := ok and (k > 5);                                            { 6600:0e17 }
k := 1;  while (ClassAligns[cls * 10] >= k) and (ClassAligns[cls * 10 + k] <> c^.alignment) do Inc(k);   { 6600:0e2c / 0e30 }
ok := ok and (ClassAligns[cls * 10] >= k);                       { 6600:0e6f  the alignment is allowed }
MayChangeTo := ok;                                               { 6600:0e92 }
```
`stat_max[k]` = `+10h+2k`. ClassPrimeReq entries < 9 mean "no requirement".

### 6600:0EE1 ChangeClass (H)
`procedure ChangeClass(c [BP+6]: PChar)` (far, stub ov25 e5) — caller: PartyCreationMenu 'H' (ENGINE). Pool: — **new**. Name H
(strings `'Pick New Class'`, `' doesn''t qualify.'`, `' is now a 1st level '`).
```pascal
n := RaceClasses[c^.race][0];                                    { 6600:0ee8 }
GetMem(list, $2E);  item := list;  item^.next := nil;  item^.isHeader := 1;  item^.text := 'Pick New Class';   { 6600:0efe .. 0f2c }
count := 1;                                                      { 6600:0f3f }
for gfx_LoopCounter := 1 to n do begin                                    { 6600:0f44 / 0f54 }
  cls := RaceClasses[c^.race][gfx_LoopCounter];                           { 6600:0f5d }
  if MayChangeTo(cls) then begin                                 { 6600:0f7b }
    GetMem(item^.next, $2E);  item := item^.next;  item^.next := nil;  item^.isHeader := 0;   { 6600:0f88 .. 0fb6 }
    item^.text := ClassName[cls];  Inc(count);                   { 6600:0fbe / 0fdd }
  end;
end;
if count = 1 then begin                                          { 6600:0feb }
  ShowTimedBottomPrompt(c^.name + ' doesn''t qualify.', 4, $0F); { 6600:0ff1 }
  FreeMenuList(list);  Exit;                                     { 6600:1016 }
end;
item := list;  index := 1;  showExit := 1;  redraw := 1;         { 6600:1023 / 102e / 1033 / 1037 }
repeat
  key := VerticalListMenu('', 'Select', $0D, $0A, $0F, 1, 2, $26, $16, list, showExit, redraw, index, item);   { 6600:103b / 1087 }
  if key = #0 then Exit;                                         { 6600:108f  quirk: the list is not freed }
until key = 'S';                                                 { 6600:1098 }
c^.xp := 0;  c^.attacks := 2;                                    { 6600:109e / 10ad }
cls := 0;  while (cls <= 7) and (ClassName[cls] <> item^.text) do Inc(cls);   { 6600:10b6 / 10c0 }
FreeMenuList(list);                                              { 6600:10e2 }
c^.old_level[CurrentClass(c)] := CurrentClassLevel(c);           { 6600:10ec / 1108 }
c^.b[$E6] := c^.level_main;  c^.level_main := 1;                 { 6600:110d / 111d  level at the change }
c^.level[CurrentClass(c)] := 0;  c^.level[cls] := 1;             { 6600:1126 / 113c }
FillChar(c^.b[$12D], $0F, 0);                                    { 6600:114b  spell slots }
if cls = 0 then c^.b[$12D] := 1                                  { 6600:1160 / 1167 }
else if cls = 5 then begin                                       { 6600:1172 }
  c^.b[$137] := 1;                                               { 6600:1176 }
  c^.known_spell[$0B] := 1;  c^.known_spell[$12] := 1;  c^.known_spell[$0C] := 1;  c^.known_spell[$15] := 1;   { 6600:117f .. 119a  +83h, +8Ah, +84h, +8Dh }
end;
c^.class := cls;                                                 { 6600:11a3 }
ShowTimedBottomPrompt(c^.name + ' is now a 1st level ' + ClassName[cls] + '.', $0A, 0);   { 6600:11ad }
FillChar(c^.b[$1E], $54, 0);                                     { 6600:11f2  memorised spells }
UpdateLevelStats(c);  WisdomBonusSpells(c, 1);  UpdateSaves(c);  UpdateThiefSkills(c);   { 6600:1207 / 1211 / 121e / 1228 }
it := c^.items;                                                  { 6600:1232 }
while it <> nil do begin                                         { 6600:1242 }
  if (ItemTypeTable[it^.type].classes and c^.class_mask = 0) and (it^.b[$36] = 0) then it^.readied := 0;   { 6600:124a / 1269 / 1273 }
  it := it^.next;                                                { 6600:127b }
end;
```
The magic-user starting spells 0Bh, 12h, 0Ch, 15h are those of CreateCharacter (ENGINE ov17, flags +83h/+84h/+8Ah/+8Dh).

### 6600:1292 FormerClass (M) / 6600:12EE CurrentClass (M) / 6600:134A CurrentClassLevel (M)
`function FormerClass(c [BP+6]: PChar): Byte` / `CurrentClass` / `CurrentClassLevel` (`RETF 4`) — human dual-class helpers;
non-humans give 11h (no class) / 0. Pool: — **new**.
```pascal
if c^.race <> 7 then Exit(11h);                                  { 6600:1298  (12f4 / 1350: 0) }
k := 0;  while (k < 7) and (c^.old_level[k] = 0) do Inc(k);      { 6600:12a8  (12EE: level[k] +109h, 1304) }
if c^.old_level[k] > 0 then FormerClass := k else FormerClass := $11;   { 6600:12c8  (CurrentClassLevel: level[k], 1380) }
```

### 6600:139A IsHuman (H) / 6600:13BC DualClassActive (M)
Pool: — **new**.
```pascal
IsHuman := c^.race = 7;                                          { 6600:13a0 }
DualClassActive := CurrentClassLevel(c) > c^.b[$E6];             { 6600:13bc  former-class levels count once the new class passes them }
```
(ECL_VM.md §3.1 and COMBAT use DualClassActive as "former-class levels count", 0/1.)

### 6600:13E8 ov25_init — empty (H)

---

## Character record

The Curse character record, 1A6h = 422 bytes, in memory and in `.guy` / `CHRDAT*.sav` files (ENGINE ov16). Pool offset =
the field of Pool's 285-byte TChar it was converted from by ConvertPoolCharacter (ENGINE 4300:1490) or that the same routine
uses in Pool (PoolRadianceRE SAVES.md §3 names). Evidence = Curse routines (this file unless noted) and ECL_VM.md §3.1
(region-1 overlay). Conf: H = read and written by code with a clear meaning; M = code-proven, meaning partly inferred;
L = only copied / constant.

| off | size | name | Pool | evidence | conf |
|---|---|---|---|---|---|
| 00 | 16 | name string[15] | 00 | DrawCharacterName, WriteCharacter file name, ConvertPool | H |
| 10+2i | 1 | ability max i = 0..5 (STR INT WIS DEX CON CHA) | 10+i | ConvertPool (clamped by race/sex tables), CreateCharacter end (`+10h+2i := +11h+2i`), MayChangeTo (prime requisites) | H |
| 11+2i | 1 | ability current | 10+i | StrengthIndex (+11h), DexDefenseAdj / DexMissileAdj (+17h), WisdomBonusSpells (+15h), UpdateSaves / ConHpBonus (+19h), EffWeakness (+11h), EffFeeblemind (+13h, +15h), ECL 7C15/7C18 | H |
| 1C / 1D | 1+1 | str_exc max / current | 16 | StrengthIndex (+1Ch), CreateCharacter (+1Dh := +1Ch) | H |
| 1E | 84 | mem_spell[0..83] (bit 7 = still to memorise) | 17 (21 bytes) | FinishMemorize, ForgetMemorizedSpell, ChangeClass FillChar(+1Eh, 54h) | H |
| 72 | 1 | rest_need (hours of study) | 2C | StudyTick, StudyHourTick | H |
| 73 | 1 | base_thac0 (60 − THAC0) | 2D | UpdateLevelStats, RecalcItems, CreateCharacter | H |
| 74 | 1 | race (0 monster .. 7 human) | 2E | everywhere (RaceName DS:0E9C) | H |
| 75 | 1 | class (0..16) | 2F | CreateCharacter, ChangeClass, EffBerserk | H |
| 76 | 2 | age (word) | 30 | CarryClock, EffHaste, CreateCharacter | H |
| 78 | 1 | hp_max | 32 | DrawHP, ShowHealingResult, EffRegenerate3, TrollRise | H |
| 79..DC | 100 | known_spell[id] (= +78h+id, id 1..100) | 33.. (56) | RecalcSpellSlots, FinishScribe, ChangeClass (+83h..), CreateCharacter | H |
| DD | 1 | fighter_lvl_eff | 6B | RecalcItems, EffAnimatedEnd | H |
| DE | 1 | size (and 7Fh: 2 = large) | 6C | EffDefenceVsLargeGiants / Type1 | H |
| DF..E3 | 5 | save[0..4] | 6D | UpdateSaves, ECL 7C9B | H |
| E4 | 1 | base_move | 72 | RecalcItems, ArmourMoveLimit, EffAnimatedEnd | H |
| E5 | 1 | level_main (highest level) | 73 | UpdateLevelStats, ChangeClass, EffNeedMagicWeapon, ECL 7CA0 | H |
| E6 | 1 | level_main at the class change | — (ConvertPool: := +E5h) | ChangeClass, DualClassActive | H |
| E7, E8 | 1+1 | levels_drained, hp_drained | 74, 75 | ConvertPool only | L |
| E9 | 1 | undead / ai type | 76 | EffAnimatedEnd (:= 0), COMBAT "undead" | M |
| EA..F1 | 8 | thief_skill[1..8] (= +E9h+k) | 77..7E | UpdateThiefSkills, ECL 7CA5..7CAC | H |
| F2 | 4 | effects (far ptr, 9-byte list) — stale on disk | 7F | HasEffect, TickEffects, RemoveEffect | H |
| F6 | 1 | ? | 83 | ConvertPool | L |
| F7 | 1 | npc_morale (≥ 80h NPC; B3h charmed / animated, B2h berserk) | 84 | EffCharm, EffBerserk, PoolMoney, ENGINE ov16 list filter, ECL 7CB8 | H |
| F8..FA | 3 | ? | 85..87 | ConvertPool | L |
| FB..108 | 14 | money[0..6] words (copper, silver, electrum, gold, platinum, gems, jewelry) | 88 | ov21 (all), ECL 7CBB..7CC3, CreateCharacter (+103h := 300) | H |
| 109..110 | 8 | level[0..7] (cleric, druid, fighter, paladin, ranger, magic-user, thief, monk) | 96 | everywhere | H |
| 111..118 | 8 | old_level[0..7] (former class of a human dual-class) | — | ChangeClass, UpdateLevelStats, RecalcSpellSlots, COMBAT | H |
| 119 | 1 | gender | 9E | CreateCharacter, ECL 7CD6 | H |
| 11A | 1 | creature_type | 9F | EffFlameTongue, EffBonusVsType3/8, EffDefence* | H |
| 11B | 1 | alignment | A0 | EffProtFromEvil/Good, MayChangeTo, ECL 7CD8 | H |
| 11C / 11D | 1+1 | attacks / attacks2 (half attacks per round) | A1 / A2 | UpdateLevelStats (:= 3), ChangeClass (:= 2), COMBAT | H |
| 11E..123 | 6 | base_dmg_dice[1..2], base_dmg_sides[1..2], base_dmg_bonus[1..2] | A3..A8 | RecalcItems | H |
| 124 | 1 | base_ac (60 − AC) | A9 | RecalcItems, CreateCharacter (:= 32h) | H |
| 125 | 1 | STR bonus flag (STR adjustments apply when ≠ 0) | AA | StrToHitAdj, StrDamageAdj, CreateCharacter (:= 1) | H (code) / M (meaning) |
| 126 | 1 | id (random / monster number) | AB | CreateCharacter (Random 256), AddNpcToParty | M |
| 127 | 4 | xp (LongInt) | AC | CreateCharacter, ChangeClass (:= 0), TrainCharacter | H |
| 12B | 1 | class_mask (ClassBit DS:3EA0) | B0 | UpdateLevelStats, item usability | H |
| 12C | 1 | hp_rolled | B1 | CreateCharacter (RollHitDice), ENGINE ov16 | H |
| 12D..131 | 5 | cleric spell slots, levels 1..5 | B2..B4 (3 levels) | RecalcSpellSlots, WisdomBonusSpells, ChangeClass | H |
| 132..134 | 3 | druid spell slots 1..3 (ranger) | — | RecalcSpellSlots | M |
| 135, 136 | 2 | ? (cleared with the slots) | — | RecalcSpellSlots FillChar | L |
| 137..13B | 5 | magic-user spell slots 1..5 | B5..B7 (3) | RecalcSpellSlots, ChangeClass, COMBAT spell_slots | H |
| 13C | 2 | xp_value (monster XP) | B8 | ECL 7CF7, ConvertPool | H |
| 13E | 1 | xp_per_hp | BA | ECL 7CF9 | M |
| 13F..142 | 4 | head_pic, body_pic, icon_head, icon_body | BB..BE | ConvertPool, ENGINE ov16 LoadCharacterIcon | M |
| 143 | 1 | ? (:= 0Ah for new characters) | — | CreateCharacter | L |
| 144 | 1 | icon_size (1 small, 2 large) | C0 | CreateCharacter, icon editor | H |
| 145..14A | 6 | icon_colours | C1..C6 | CreateCharacter, LoadCharacterIcon | H |
| 14B | 1 | monster-kind flags (bit 0 evil / summoned, bit 1, bit 2, bit 3 giant-class) | — | Eff 04h, 12h, 1Ah, 86h, 91h | M |
| 14C | 1 | item_count | C7 | RecalcItems, AddItemToChar limit 16 | H |
| 14D | 4 | items (far ptr, 63-byte list) — stale on disk | C8 | everywhere | H |
| 151..184 | 52 | readied[0..12] (far ptrs; 0 weapon, 1 shield, 2 armour, 9/10 rings, 11 arrows, 12 quarrels) | CC..FF | RecalcItems | H |
| 185 | 1 | hands_used | 100 | RecalcItems | H |
| 186 | 1 | ac_item_bonus | 101 | AddItemAC, RecalcItems | H |
| 187 | 2 | encumbrance (word) | 102 | RecalcItems, ov21 | H |
| 189 | 4 | next (party list) — stale on disk | 104 | everywhere | H |
| 18D | 4 | combatant (far ptr to the combat record) | 108 | ov12 handlers, ApplyDamage | H |
| 191 | 1 | cures_left (paladin) | — | EffPaladinCuresReset, COMBAT | M |
| 192 | 1 | (bit 0 = ECL 7CE4) | — | ENGINE ov16 (Hillsfar +26h) | L |
| 195 | 1 | status (0 okay .. 8 gone; StatusName DS:0FE0) | 10C | ApplyDamage, DrawCharacterSummary, EffSlainBySpecialArrow | H |
| 196 | 1 | active | 10D | DrawCharacterName, CountActiveSides, EffFallsDead | H |
| 197 | 1 | side | 10E | EffCharm, EffBerserk, CountActiveSides | H |
| 198 | 1 | controlled | 10F | EffCharm, EffConfusion | H |
| 199 | 1 | thac0 (current) | 110 | RecalcWeaponStats | H |
| 19A / 19B | 1+1 | ac / ac_rear (current) | 111 / 112 | RecalcItems, EffCoughing, EffAcBonus2 | H |
| 19C / 19D | 1+1 | attacks_left[1..2] | 113 / 114 | EffSnakes, COMBAT | H |
| 19E..1A3 | 6 | dmg_dice[1..2], dmg_sides[1..2], dmg_bonus[1..2] (current) | 115..11A | RecalcItems, RecalcWeaponStats | H |
| 1A4 | 1 | hp (current) | 11B | DrawHP, ApplyDamage, EffHpLossTick | H |
| 1A5 | 1 | move (current) | 11C | ArmourMoveLimit, EncumbranceMoveLimit, ECL 7D1B | H |

Combat record (`combatant`, COMBAT owns it; fields used here): +0 spell being prepared (M), +1 mayCast, +2 mayUseItems,
+3 initiative / acted, +6 moveLeft, +7 guarding, +0Ah target (far ptr), +0Eh dying counter, +10h turned / fleeing,
+13h (BandageDying: 0 = may be bandaged, M).
Item record (63 bytes): +0 name string[40], +2Ah next, +2Eh type, +2Fh..+31h word[1..3] (ItemWord DS:1040 + 21·w, shown
word 3, 2, 1), +32h plus, +33h plus2, +34h readied, +35h hidden (bit per word), +36h magic / cursed flag (M), +37h weight
(word), +39h count, +3Ah value (word, gold), +3Bh+k power[k] k = 1..3 (+3Dh the effect type of an item power, +3Eh ≥ 80h a
readied-item power kind: 2, 6, 0Bh, 81h used by ov25).
Effect record (9 bytes): +0 type, +1 duration (word), +3 p3, +4 callOnRemove, +5 next.

## Unknowns

- ov24 AnimateAlongPath (6200:1AF7) is written at step level, not statement level (missile / spell path animation; the
  per-pixel plane copies are summarised).
- Meanings only (code is decoded): +14Bh flag bits 1 and 2; effect types 04h, 12h, 1Ah, 4Bh, 4Ch, 55h, 82h are M (named
  after what the handler does, not what triggers them); item power kinds 2, 6, 0Bh at item +3Eh; ShopItemsMenu flag
  g_47EE; spells_Table class 3 entries; combat record +13h (only BandageDying reads it).
- Character record bytes with no proven meaning: +E7h/+E8h (copied from Pool levels/hp drained, never read), +F6h,
  +F8h..+FAh, +135h/+136h, +143h, +192h (bit 0 only, via ECL 7CE4); +125h is code-proven as the STR-adjustment switch,
  meaning M.
- MakeItem (6200:32A9) callers outside ov24 not enumerated here (stub ov24, many lanes).
- UpdateSaves (6600:07E3): the former-class check after the class loop only sees class 7's former level (documented quirk,
  H); whether SSI intended dual-class saves to improve is unknown.
- UpdateThiefSkills (6600:0AD8): local bonus [BP-2] keeps an earlier value for skills other than 1 and 2 (documented
  quirk); whether any caller path leaves it truly uninitialised for skill 1 is not traced (L).

## Self-check

Method: `scratchpad/sample_par.py` (seed 20261020) took every `{ seg:off }`-anchored statement line of this file (1448),
sampled 10 % (144 lines, file lines 47 .. 3074, all six units) and printed each with the asm from its anchor to the next
9 instructions; each was re-read against the listing.

Result: 144 / 144 agree (constants, offsets, comparison sense / signedness, call arguments and order). One comment was
sharpened: EffHelpless 3600:0078 — the ClearCombatantActionFlags result *is* tested (0083 `OR AL,AL / JZ`) but both
branches return, so the statement is unchanged. Sampled lines include 207, 286, 489, 885, 1373, 1597, 1697, 1870, 2195,
2229, 2589, 2913, 2979, 3029. anchorcheck: 0 bad anchors; argcheck PARTY: 0 MISMATCH (see PARTY_ARGCHECK.md).
