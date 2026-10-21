# MAGIC — temple, combat round loop, camp/spell menus, spell casting and spell handlers (FINAL pseudocode, lane cab-mod-magic, Fable)

Units (herdr/assignments/cab-areas.md, MAGIC table): ov04 (seg 2700, temple), ov08 (2F00, combat round loop + player turn menu — kept here as in Pool, COMBAT.pas.md links to it), ov15 (4000, camp: rest, memorize, scribe, effects display, party options), ov22 (5800, spell lists, casting, spell handlers, spell table init). Pool twin: `PoolRadianceRE/decode/pseudo/MAGIC.pas.md` (+ `MAGIC_VERIFY.md`, build corrections B-1..B-31 applied where the Curse code still matches).
Conventions as in COMBAT.pas.md: **Pascal-order signatures** (first parameter = highest BP offset; Ghidra's `param_n` list is reversed, pushes read from the asm), `{ seg:off }` = first instruction of the statement or the CALL implementing it, `**changed**` / `**new**` against the Pool twin, every routine with a Pool line and shape ratio (`scratch shapematch_magic.py`, difflib over the instruction shapes). Resident note #1 applies: `DrawText(col, row, fg, bg, s)`, `DrawWrappedText(x1, y1, x2, y2, fg, bg, clear, s)`, `ShowBottomPromptAndReadKey(fg, bg, s)`, `AskYesNo(prompt, c1, c2, c3)`, `HorizontalMenu(prompt, options, c1, c2, c3, allowExt, flag, var ext)`, `VerticalListMenu(prompt, options, c1, c2, c3, x1, y1, x2, y2, list, flag, var redraw, var index, var sel)`.
Character record offsets as in COMBAT.pas.md (`status +195h`, `active +196h`, `hp +1A4h`, `maxhp +78h`, `maxhp_base +12Ch`, `con +19h`, `levels +109h..`, `old_level_cap +E6h`, `items +14Dh`, `effects +F2h`, `mem_spell[0..83] +1Eh`, `spell_slots +137h..`, `known_spell[id] +33h+id` (M), item `cursed +36h`, `next +2Ah`).
Other-lane routines by their published names: ov23 `RemoveEffect(c, type, e)` 5F00:010E, `AddEffect` 13EE, `HealCharacter(c, amount, onlyIfHurt)` 23FB, `Roll` 137F, `RecalcAbility(c, n)` 18D8, `SavingThrow` 12EB, `ApplyEffect` 2307, `DamageCharacter` 1FD6, `CallEffectHooks` 03FE; ov24 `ShowCharacterMessage` ShowCharacterMessage(c, msg, row, wait), `ClearCharacterMessage` ClearCharacterMessage, `ShowTimedBottomMessage` ShowTimedBottomMessage(s), `RedrawCurrentMode` RedrawCurrentMode, `WordToStr` WordToStr, `PartySummary`, `HasEffect(c, type, var e)`; ov21 money: `SetCharMoneyGold` SetCharMoneyGold, `MoneyValueInGold` MoneyValueInGold(@pool), `SetPoolMoneyGold` SetPoolMoneyGold, `TreasurePoolStatus` TreasurePoolStatus(var money, var items), `TakeMoney` TakeMoney, `PoolMoney` PoolMoney, `ShareMoney` ShareMoney, `AppraiseGems` Appraise(var changed) (PARTY lane, roles from Pool's twins, M); ov19 `MoneyInGold` 33AB, `ViewMenu` 0B75, `CycleSelectedChar` 32DC; ov26 menus (`NewMenuList(var list, n)`, `FreeMenuList`, `VerticalListMenu`, `HorizontalMenu`, `AskYesNo`); ov07 `MenuSelect`.

---

## ov04 (seg 2700) — temple

Unit: ov04, 1026h bytes, 12 functions + init; entry `Temple` 0DD6 (stub ov04 e1, the ECL opcode with the temple flag — ECL_VM.md). Pool twin ov04 3400 (shape 0.82..1.00; CureWounds 0.68 because of the new `Heal` service). Service names: DS table `TempleService{g_00E4}[k]` = `DS:00BB + k*29h`, k = 1..11 (START.EXE bytes): Cure Blindness, Cure Disease, Cure Light Wounds, Cure Serious Wounds, Cure Critical Wounds, **Heal** (new), Neutralize Poison, Raise Dead, Remove Curse, Stone to Flesh, Exit. Disease effect types `DiseaseEffects{g_00DE}[1..6]` = DS:00DE..00E3 = 1F 22 2B 2C 32 39 (the same list the COMBAT lane named at DS:0828 — two copies). Strings (code segment): 0034 `cast cure anyway: `, 00AA ` will only cost `, 00BB ` gold pieces.`, 00C9 `pay for cure `, 00D7 `Not enough money.`, 00E9 `is cured.`, 0263 `is not blind.`, 0271 `Cure Blindness`, 0306 `is not Diseased.`, 0317 `Cure Disease`, 03FD `Cure Light Wounds`, 040F `Cure Serious Wounds`, 0423 `Cure Critical Wounds`, 0438 `Heal`, 0626 `is not dead.`, 0633 `Raise Dead`, 086F `is not poisoned.`, 0880 `Neutralize Poison`, 095F `is not cursed.`, 096E `Remove Curse`, 0A45 `is not stoned.`, 0A54 `Stone to Flesh`, 0AF0 `, how can we help you?`, 0B07 `` (empty prompt), 0B08 `Heal Exit`, 0D0C `Heal View Take Pool Share Appraise Exit`, 0D34 `Heal View Pool Appraise Exit`, 0D51 `` (empty), 0D52 `~Yes ~No`, 0D5B `As you leave a priest says, "Excuse me but you have left some money here" `, 0DA6 `Do you want to go back and retrieve your money?`.
Globals: `cure_InProgress{g_6F9C}` (COMBAT name), `SpellTargets[1]` g_7435, `TreasureMoney` g_6F70 (1Ch bytes), `view_Mode` g_4FBA (1 = temple/shop), `g_8B54` (set from `Mem[4BE6] = 0` then forced to 1 — M: "2D backdrop" flag read by RedrawCurrentMode), `g_7564` (cleared on entry; L).

### 2700:0000 ov04_LoadDeps (M)
Nine `CALLF` into entry 0 of ov21, ov19, ov26, ov24, ov07, ov34, ov22, ov23, ov25 { 2700:0003 .. 002b }.

### 2700:0047 ConfirmNeedless (H)
`function ConfirmNeedless(msg [BP+6]: string): Char` — RETF 4. Callers: CureBlindness, CureDisease, RaiseDead, NeutralizePoison, RemoveCurseService, StoneToFlesh. Pool: 3400:0013 (1.00), same body (B-1: the message routine prints the name).
```pascal
s := msg;                                                                              { 2700:004e  string[255] }
ShowCharacterMessage(SelectedChar, s, 0, 0);                                                      { 2700:0062  ShowCharacterMessage }
Result := AskYesNo('cast cure anyway: ', 13, 10, 15);                                  { 2700:007b / 008b }
ClearCharacterMessage;                                                                             { 2700:009c  ClearCharacterMessage }
```

### 2700:00F3 PayForCure (H)
`function PayForCure(price [BP+0Ah]: Word; service [BP+6]: string): Char` — RETF 6. Callers: every service. Pool: 3400:00BF (0.99), same body; Pascal order is (price, service): `MOV AX,price; PUSH AX` precedes the string pushes at every call site (e.g. 2700:02de).
```pascal
s := service;                                                                          { 2700:00fa }
msg := s + ' will only cost ' + WordToStr(price) + ' gold pieces.';                    { 2700:010e .. 0150 }
DrawWrappedText(1, $11, $26, $16, 10, 0, 1, msg);                                      { 2700:0155 }
answer := AskYesNo('pay for cure ', 13, 10, 15);                                       { 2700:0175 / 0185 }
if answer = 'Y' then begin                                                             { 2700:0197 }
  gold := MoneyInGold(SelectedChar);                                                   { 2700:01a1  low word only (B-2) }
  if gold >= price then SetCharMoneyGold(gold - price)                                        { 2700:01b2 / 01c2  SetCharMoneyGold }
  else begin
    pool := MoneyValueInGold(@TreasureMoney);                                                 { 2700:01cd  MoneyValueInGold, LongInt }
    if (pool < $10000) and (pool < price) then begin                                   { 2700:01df .. 01f0  signed compare }
      ShowTimedBottomMessage('Not enough money.');  answer := 'N';                                  { 2700:020a / 021a }
    end else SetPoolMoneyGold(Lo(pool - price));                                              { 2700:01ff  SetPoolMoneyGold }
  end;
end;
if answer = 'Y' then begin ClearCharacterMessage; ShowCharacterMessage(SelectedChar, 'is cured.', 0, 1) end;  { 2700:0224 / 022b / 0230 / 0248 }
Result := answer;                                                                      { 2700:0253 }
```

### 2700:0280 CureBlindness (H)
`procedure CureBlindness` — RETF. Caller: HealMenu. Pool: 3400:0249 (1.00), same body.
```pascal
ok := 'Y';                                                                             { 2700:028c }
if not HasEffect(SelectedChar, $21, e) then ok := ConfirmNeedless('is not blind.');    { 2700:0291 / 02aa / 02b5 / 02bb }
if ok = 'Y' then begin                                                                 { 2700:02c2 }
  ok := PayForCure(1000, 'Cure Blindness');                                            { 2700:02c9 / 02d9 }
  if ok = 'Y' then RemoveEffect(SelectedChar, $21, nil);                               { 2700:02e5 / 02ec }
end;
```

### 2700:0324 CureDisease (H)
`procedure CureDisease` — RETF. Caller: HealMenu. Pool: 3400:02ED (1.00), same body (disease list DS:00DE..00E3).
```pascal
diseased := false;  { [BP-104h] := 0, a second flag never named }  ok := 'Y';                                                         { 2700:032b / 0330 / 0335 }
for k := 1 to 6 do if HasEffect(SelectedChar, DiseaseEffects[k], e) then diseased := true;   { 2700:0345 .. 0372  g_00DD + k }
if not diseased then ok := ConfirmNeedless('is not Diseased.');                        { 2700:0374 / 037b / 038c }
if ok = 'Y' then                                                                       { 2700:0393 }
  if PayForCure(1000, 'Cure Disease') = 'Y' then begin                                 { 2700:039a / 03aa / 03bb }
    cure_InProgress := 1;                                                              { 2700:03bd }
    for k := 1 to 6 do RemoveEffect(SelectedChar, DiseaseEffects[k], nil);             { 2700:03c2 .. 03f2 }
    cure_InProgress := 0;                                                              { 2700:03f4 }
  end;
```

### 2700:043D CureWounds (H)
`procedure CureWounds(kind [BP+6]: Byte)` — RETF 2. Caller: HealMenu (1..4). Pool: 3400:0401 (0.68). **changed:** kind 4 = the new `Heal` service (5000 gp): heals everything but 1d4 hit points, removes blindness, the six diseases and effect 44h (feeblemind, M) and recalculates INT and WIS (RecalcAbility 1, 2).
```pascal
case kind of
  1: if PayForCure(100, 'Cure Light Wounds') = 'Y' then                                { 2700:0443 / 044d / 045c / 0467 }
       HealCharacter(SelectedChar, Roll(1, 8), 0);                                     { 2700:046d / 047b }
  2: if PayForCure(350, 'Cure Serious Wounds') = 'Y' then                              { 2700:0495 / 049a / 04a9 / 04b4 }
       HealCharacter(SelectedChar, Roll(2, 8) + 1, 0);                                 { 2700:04ba / 04cb }
  3: if PayForCure(600, 'Cure Critical Wounds') = 'Y' then                             { 2700:04e5 / 04ea / 04f9 / 0504 }
       HealCharacter(SelectedChar, Roll(3, 8) + 3, 0);                                 { 2700:050a / 051d }
  4: if PayForCure(5000, 'Heal') = 'Y' then begin                                      { 2700:0537 / 053f / 054e / 055f  new }
       amount := Byte(SelectedChar^.maxhp - SelectedChar^.hp - Roll(1, 4));            { 2700:0562 .. 058f  +78h, +1A4h }
       dummy := HealCharacter(SelectedChar, amount, 0);                                { 2700:058f }
       RemoveEffect(SelectedChar, $21, nil);                                           { 2700:05a6 }
       for k := 1 to 6 do RemoveEffect(SelectedChar, DiseaseEffects[k], nil);          { 2700:05bc .. 05e8 }
       RemoveEffect(SelectedChar, $44, nil);                                           { 2700:05ea }
       RecalcAbility(SelectedChar, 1);                                                 { 2700:0600  INT }
       RecalcAbility(SelectedChar, 2);                                                 { 2700:0610  WIS }
     end;
end;
```

### 2700:063E RaiseDead (H)
`procedure RaiseDead` — RETF. Caller: HealMenu. Pool: 3400:0510 (0.97). Same body with the Curse record offsets (B-3 formula); **changed:** the hit-point correction also runs when the former fighter level (`old_level_cap +E6h`) is below the current fighter level.
```pascal
c := SelectedChar;  dead := false;  ok := 'Y';                                         { 2700:0645 / 0653 / 065d }
if c^.status in [6, 1] then dead := true;                                              { 2700:0662 .. 067a  Dead, Animated }
if not dead then ok := ConfirmNeedless('is not dead.');                                { 2700:067f / 0686 / 0697 }
if ok = 'Y' then begin                                                                 { 2700:069e }
  ok := PayForCure(5500, 'Raise Dead');                                                { 2700:06a8 / 06b8 }
  if (ok = 'Y') and dead then begin                                                    { 2700:06c4 / 06d5 }
    cure_InProgress := 1;                                                              { 2700:06d8 }
    RemoveEffect(c, $20, nil);                                                         { 2700:06dd  animated }
    RemoveEffect(c, $37, nil);                                                         { 2700:06f3  poisoned }
    cure_InProgress := 0;                                                              { 2700:0709 }
    c^.hp := 1;  c^.status := 0;  c^.active := 1;                                      { 2700:070e / 0718 / 0722 }
    if c^.con <> 0 then c^.con := c^.con - 1;                                          { 2700:072c / 0737  +19h }
    if c^.maxhp_base < c^.maxhp then bonus := c^.maxhp - c^.maxhp_base else bonus := 0;   { 2700:073f .. 076f  +12Ch, +78h }
    sum := 0;                                                                          { 2700:0776 }
    if c^.con > 13 then begin                                                          { 2700:077b }
      for j := 0 to 7 do                                                               { 2700:0789 }
        if ShortInt(c^.level[j]) > 0 then                                              { 2700:0794  +109h + j }
          if j = 2 then sum := sum + (c^.con - 14) * c^.level[2]                       { 2700:07a7 / 07ae  fighter }
          else if c^.con < 16 then sum := sum + c^.level[j]                            { 2700:07d6 / 07e1 }
          else sum := sum + c^.level[j] * 2;                                           { 2700:07fa }
      if sum <> 0 then bonus := bonus div sum;                                         { 2700:0818 }
      if (c^.con < 17) or (ShortInt(c^.level[2]) > 0) or (c^.old_level_cap < c^.level[2]) then   { 2700:0834 .. 085d  +E6h: changed }
        c^.maxhp := c^.maxhp - bonus;                                                  { 2700:085f }
    end;
  end;
end;
```

### 2700:0892 NeutralizePoison (H)
`procedure NeutralizePoison` — RETF. Pool: 3400:0751 (1.00), same body.
```pascal
poisoned := HasEffect(SelectedChar, $37, e);  ok := 'Y';                               { 2700:08a8 / 08c1 }
if not poisoned then ok := ConfirmNeedless('is not poisoned.');                        { 2700:08c6 / 08cd / 08de }
if ok = 'Y' then                                                                       { 2700:08e5 }
  if PayForCure(1000, 'Neutralize Poison') = 'Y' then begin                            { 2700:08ec / 08fc / 090d }
    cure_InProgress := 1;                                                              { 2700:090f }
    RemoveEffect(SelectedChar, $37, nil);                                              { 2700:0914 }
    RemoveEffect(SelectedChar, $16, nil);                                              { 2700:092a }
    RemoveEffect(SelectedChar, $0F, nil);                                              { 2700:0940 }
    cure_InProgress := 0;                                                              { 2700:0956 }
  end;
```

### 2700:097B RemoveCurseService (H)
`procedure RemoveCurseService` — RETF. Pool: 3400:083A (0.92), same body: needless unless an item of SelectedChar is cursed (`+36h`) or effect 24h is present; the cure is the spell handler Spell_RemoveCurse (ov22 3599, stub e9) on `SpellTargets[1] := SelectedChar`.
```pascal
ok := 'Y';  cursed := false;                                                           { 2700:0982 / 0987 }
it := SelectedChar^.items;                                                             { 2700:0990  +14Dh }
while (it <> nil) and not cursed do begin                                              { 2700:09a1 .. 09ad }
  if it^.cursed <> 0 then cursed := true;                                              { 2700:09af / 09b9  +36h }
  it := it^.next;                                                                      { 2700:09bd  +2Ah }
end;
if not cursed then                                                                     { 2700:09ce }
  if not HasEffect(SelectedChar, $24, e) then ok := ConfirmNeedless('is not cursed.'); { 2700:09d4 / 09ed / 09f8 / 09fe }
if ok = 'Y' then                                                                       { 2700:0a05 }
  if PayForCure(3500, 'Remove Curse') = 'Y' then begin                                 { 2700:0a0c / 0a1c / 0a2d }
    SpellTargets[1] := SelectedChar;                                                   { 2700:0a2f .. 0a38  g_7435 }
    Spell_RemoveCurse;                                                                         { 2700:0a3c  Spell_RemoveCurse }
  end;
```

### 2700:0A63 StoneToFlesh (H)
`procedure StoneToFlesh` — RETF. Pool: 3400:0928 (1.00), same body.
```pascal
ok := 'Y';                                                                             { 2700:0a6a }
if SelectedChar^.status <> 7 then ok := ConfirmNeedless('is not stoned.');             { 2700:0a74 / 0a80 / 0a91 }
if ok = 'Y' then                                                                       { 2700:0a98 }
  if (PayForCure(2000, 'Stone to Flesh') = 'Y') and (SelectedChar^.status = 7) then begin   { 2700:0a9f / 0aaf / 0ac0 / 0ac2 }
    SelectedChar^.status := 0;  SelectedChar^.active := 1;  SelectedChar^.hp := 1;     { 2700:0ace / 0ad8 / 0ae2 }
  end;
```

### 2700:0B12 HealMenu (H)
`procedure HealMenu` — RETF. Caller: Temple ('H'). Callees: NewMenuList, @StrAssign, ClearTextRectangle, FUN_01A0_0252 (frame boxes, resident), DrawText, VerticalListMenu, the services, FreeMenuList, RedrawCurrentMode, PartySummary. Pool: 3400:09D7 (0.82). **changed:** 11 services (the `Heal` entry = index 5 → CureWounds(4)); Exit = index 10; the list window is rows 4..15 (VerticalListMenu `2, 4, 26h, 0Fh`).
```pascal
done := false;  NewMenuList(list, 10);  head := list;                                  { 2700:0b22 / 0b2d / 0b3b  11 lines (0..10) }
k := 1;                                                                                { 2700:0b46 }
while list <> nil do begin                                                             { 2700:0b4a }
  list^.text := TempleService[k];  list^.header := 0;                                  { 2700:0b52 / 0b72  string[40] from DS:00BB + k*29h }
  list := list^.next;  k := k + 1;                                                     { 2700:0b7a / 0b83 }
end;
list := head;                                                                          { 2700:0b8e }
ClearTextRectangle(0, $18, $27, $18);                                                  { 2700:0b99 }
redraw := 1;  FUN_01A0_0252;                                                           { 2700:0baa / 0bae  frame boxes (resident) }
repeat
  DrawText(1, 1, 15, 0, SelectedChar^.name + ', how can we help you?');                { 2700:0bb3 .. 0bed }
  key := VerticalListMenu('', 'Heal Exit', 13, 10, 15, 2, 4, $26, $0F, list, 0, redraw, idx, sel);   { 2700:0bf2 / 0c0b / 0c10 }
  if (key = 'H') or (key = #13) then                                                   { 2700:0c45 / 0c50 }
    case idx of                                                                        { 2700:0c53 .. 0cd3 }
      0: CureBlindness;                                                                { 2700:0c5b }
      1: CureDisease;                                                                  { 2700:0c66 }
      2: CureWounds(1);                                                                { 2700:0c71 }
      3: CureWounds(2);                                                                { 2700:0c7f }
      4: CureWounds(3);                                                                { 2700:0c8d }
      5: CureWounds(4);                                                                { 2700:0c9b }
      6: NeutralizePoison;                                                             { 2700:0ca9 }
      7: RaiseDead;                                                                    { 2700:0cb4 }
      8: RemoveCurseService;                                                           { 2700:0cbf }
      9: StoneToFlesh;                                                                 { 2700:0cca }
      10: done := true;                                                                { 2700:0cdb }
    end
  else if key = #0 then done := true;                                                  { 2700:0cdb / 0cdf }
until done;                                                                            { 2700:0ce3 }
FreeMenuList(list);  RedrawCurrentMode;  PartySummary(SelectedChar);                           { 2700:0cec / 0cf6 / 0cfb }
```

### 2700:0DD6 Temple (H)
`procedure Temple` — RETF, entry e1 (ECL COMBAT opcode with the temple flag, ECL_VM.md §4). Callees: RedrawCurrentMode, PartySummary, FillChar, TreasurePoolStatus, HorizontalMenu, HealMenu, ViewMenu, TakeMoney, PoolMoney, ShareMoney, AppraiseGems, DrawWrappedText, MenuSelect, ClearTextRectangle, CycleSelectedChar. Pool: 3400:0D09 (0.98). **changed:** `view_Mode := 1` (Pool game_Mode 1), `g_8B54` is set from the 3D-area flag and then forced to 1, `g_7564 := 0`; otherwise Pool's body (B-5).
```pascal
view_Mode := 1;                                                                        { 2700:0ddc }
g_8B54 := Ord(Mem[4BE6] = 0);                                                          { 2700:0de1 .. 0df3  3D-area flag }
RedrawCurrentMode;                                                                             { 2700:0df6  RedrawCurrentMode }
g_8B54 := 1;                                                                           { 2700:0dfb }
PartySummary(SelectedChar);                                                            { 2700:0e00 }
FillChar(TreasureMoney, $1C, 0);                                                       { 2700:0e0d }
PoolHasMoney := 0;  done := false;                                                           { 2700:0e1e / 0e23 }
repeat
  TreasurePoolStatus(money, items);                                                             { 2700:0e27  TreasurePoolStatus }
  if money then opts := 'Heal View Take Pool Share Appraise Exit'                      { 2700:0e36 / 0e3c }
  else opts := 'Heal View Pool Appraise Exit';                                         { 2700:0e51 }
  key := HorizontalMenu('', opts, 13, 10, 15, 1, 0, ext);                              { 2700:0e64 / 0e8c }
  case key of                                                                          { 2700:0e9b }
    'H': if not ext then HealMenu;                                                     { 2700:0ea1 / 0ea2 }
    'V': ViewMenu(ext);                                                               { 2700:0ea8 / 0eac  ViewMenu }
    'T': TakeMoney;                                                                    { 2700:0eb9 / 0ebd  TakeMoney }
    'P': if not ext then PoolMoney;                                                    { 2700:0ec5 / 0ecd / 0ecf  PoolMoney }
    'S': ShareMoney;                                                                    { 2700:0ed7 / 0edb  ShareMoney }
    'A': AppraiseGems(changed);                                                           { 2700:0ee3 / 0ee7  Appraise }
    'E': begin                                                                         { 2700:0ef4 }
        TreasurePoolStatus(money, items);                                                       { 2700:0efb }
        if not money then done := true                                                 { 2700:0f0a }
        else begin
          opts := '~Yes ~No';                                                          { 2700:0f13 }
          DrawWrappedText(1, $11, $26, $16, 10, 0, 1, 'As you leave a priest says, "Excuse me but you have left some money here" ');   { 2700:0f26 / 0f4a }
          DrawWrappedText(1, $11, $26, $16, 10, 0, 1, 'Do you want to go back and retrieve your money?');   { 2700:0f4f / 0f73 }
          if MenuSelect('', opts, 13, 10, 15, 0, 0) = 1 then done := true              { 2700:0f78 / 0f9b / 0fa9  1 = "No": leave }
          else ClearTextRectangle(1, $11, $26, $16);                                   { 2700:0faf }
        end;
      end;
    'G': CycleSelectedChar(key);  'O': CycleSelectedChar(key);                                         { 2700:0fc8 / 0fcc / 0fdb / 0fdf  CycleSelectedChar }
  end;
  if (key = 'B') or (key = 'T') then RedrawCurrentMode                                         { 2700:0fe4 / 0fed / 0fef }
  else if (key = 'A') and changed then RedrawCurrentMode;                                      { 2700:0ff6 / 1000 / 1000 }
  PartySummary(SelectedChar);                                                          { 2700:1005 }
until done;                                                                            { 2700:1012 }
```

### 2700:101F ov04_init (H)
Empty unit initialiser { 2700:101f }.

---

## ov08 (seg 2F00) — combat round loop and the player's turn menu

Unit: ov08, 136Ch bytes, 13 functions + init; entry `CombatMain` 00F3 (stub ov08 e1, the ECL COMBAT opcode — ECL_VM.md §4; the temple variant goes to ov04). Kept in MAGIC as in Pool's final map; COMBAT.pas.md's routines (ov09 AiCombatTurn, ov13 attacks/targeting, ov23 effects) are called from here. Pool twin ov08 4800 (shape 0.81..1.00; EndCombat 0.64 — two cloud lists). Strings (code segment): 03B0 `Magic On`, 03B9 `Magic Off`, 03C3 `That doesn't work`, 06FF `Move `, 0705 `View Aim `, 070F `Use `, 0714 `Cast `, 071A `Turn `, 0720 `Quick Done`, 072B `` (empty prompt), 096F `Your Teammate is Dying`, 0986 `Continue Battle:`, 0AD4 `Move/Attack, Move Left = `, 0AEE ` `, 0AF0 ``, 0AF1 `Flee:`, 0AF7 `can't go there`, 0ED4 `Not with that weapon`, 0FA1 `Guard `, 0FA8 `Delay Quit `, 0FB4 `Bandage `, 0FBD `Speed Exit`, 0FC9 ``, 11B8 `GameSpeed (`, 11C4 `) :`, 11C8 ` `, 11CA `Slower `, 11D2 `Faster `, 11DA `Exit`. Sets: CS:072C = {10h, 13h, '-', '2', 'G', 'H', 'I', 'K', 'M', 'O', 'P', 'Q'} (extended keys the combat menu accepts), CS:074C = CS:072C + {' ', 'A', 'C', 'D', 'T', 'U', 'V'} (exit set of CombatMenu), CS:0FC8 = CS:1198 = {#0, 'E'}.
Combatant record `cb := c^.combatant` (+18Dh, 16h bytes, fields as COMBAT.pas.md): `castSpell +0`, `mayCast +1`, `initiative +3` (14h = "Quick for all" marker), `moveLeft +6` (half-squares), `+7`, `facing +9`, `target +0Ah` (far ptr), `dyingTurns +0Eh`, `+0Fh`, `turned +11h`, `+12h`.
Globals: `SpellHandlers[0]` = far pointer DS:72A0/72A2 (`SpellHandlers[0] (g_72A0)`, M: the target selector; combat = ov13 CollectSpellTargets 3A00:2220 via stub 00C1:007A, camp = ov22 SelectTargetsCamp 5800:10D2 via stub 011A:0034), `cloud_List{g_755B}` and `cloud9_List{g_755F}` (two linked lists of 1Eh-byte cloud records, +4 next — the second list is new, M: a second cloud type), `cm_Map` g_6E92 (4E9h bytes), `g_75E0` (a picture freed at the end of combat, L), `side_ActiveCount[0..1]` g_6F90/6F91, `CombatRound` g_758D, **`combat_MaxRounds{g_758E}`** (new: the round after which the battle ends regardless of the outcome; written by StartCombat — the COMBAT lane's `foe_List` is the 1-based array starting at 758F), `MagicOn` g_75DA, `combat_Visible` g_75E6, `combat_Shown` g_75E5, `dummy_Done` g_75DB, `menu_Ext` g_7295, `menu_Sel` g_7294, `GameSpeed` g_4FA9, `DemoMode` g_4FBC, `view_Mode` g_4FBA, `TextOutputActive` g_4FC9, ECL cells `Mem[7ECB]` (Pool w[$596], cleared each round) and `Mem[4BE5]` (no-magic area, Pool w[$1CA]).
Other-unit callees: ov10 `StartCombat`, ov13 `StartCombatRound` 0000, `CalcAttacks` 0DD9, `SelectTarget` 3B37, `BeginCast` 275A, `TurnUndead` 1227, `GodsIntervene` 48DC, `Flee` 0D1C, `AttacksOfOpportunity` 095A, `StepCombatant` 074F, `ConfirmAttackAlly` 2F3C, `FighterSweep` 0F46, `FaceAttacker` 194A, `Attack` 19D8, `CalcEnemyHpPct` 2E22; ov09 `AiCombatTurn` 004D; ov19 `ViewMenu` 0B75, `ItemsMenu` 1588; ov22 `CastSpell` 1263; ov23 `Roll`, `CallEffectHooks`, `StinkingCloudCheck(c, poison)` 0E45; ov24 `CountActiveSides` CountActiveSides, `DrawCharacterSummary` DrawCharacterSummary, `ClearCombatantActionFlags` ClearCombatantActionFlags (function: true when the turn is over), `ov24_2E05` DrawCombatLayout, `WeaponIsRanged` WeaponIsRanged, `ov24_305B` HasAmmunition (M), `IsHelpless` IsHelpless (M), `SetGuarding` SetGuarding (M), `BandageDying` AnyoneDying(bandage) (Pool's ov08 AnyoneDying 4800:0FFF moved to the resident ov24 — M), `ByteToStr` ByteToStr, `ShowTimedBottomMessage`, `RecalcItems`; ov20 `AdvanceClock(1, 1)`; ov25 `DualClassActive` (former-class flag); VIEW: `IsVisible`, `FocusCombatant`, `FocusSquare`, `CombatantCol/Row/Index`, `RedrawSquare`, `RestoreTerrain`, `PlaceCombatant`, `ShowCombatant`, `ProbeMove`, `PaletteFlashOff`, `FreePicture`; ov26 `HorizontalMenu`, `AskYesNo`, `ClearMenuLine`.

### 2F00:0000 ov08_LoadDeps (M)
Fourteen `CALLF` into entry 0 of ov19, ov26, ov31, ov32, ov33, ov24, ov22, ov23, ov20, ov34, ov10, ov13 (1D9D), ov09, ov25 { 2f00:0003 .. 0044 }.

### 2F00:004D EndCombat (H)
`procedure EndCombat` — RETF. Caller: CombatMain. Pool: 4800:0000 (0.64). **changed:** two cloud lists of 1Eh-byte records are freed (Pool: one list of 13h); `g_75E0` is freed with FreePicture.
```pascal
while cloud_List <> nil do begin n := cloud_List^.next; FreeMem(cloud_List, $1E); cloud_List := n end;   { 2f00:0053 .. 0075 }
while cloud9_List <> nil do begin n := cloud9_List^.next; FreeMem(cloud9_List, $1E); cloud9_List := n end;   { 2f00:0088 .. 00aa }
FreeMem(cm_Map, $4E9);  cm_Map := nil;                                                 { 2f00:00bd / 00cb }
FreePicture(g_75E0);                                                                   { 2f00:00d3 }
PaletteFlashOff;                                                                       { 2f00:00dd }
SpellHandlers[0] := @SelectTargetsCamp;                                                     { 2f00:00e2 / 00e8  011A:0030 = SelectTargetsCamp }
```

### 2F00:00F3 CombatMain (H)
`procedure CombatMain` — RETF, entry e1 (ECL COMBAT). Callees: StartCombat, CountActiveSides, StartCombatRound, NextToAct, TakeTurn, EndOfRound, EndCombat. Pool: 4800:007A (0.93), same body (`view_Mode := 5`; the ECL cell is `Mem[7ECB]`).
```pascal
view_Mode := 5;                                                                        { 2f00:00f9 }
SpellHandlers[0] := @CollectSpellTargets;                                                   { 2f00:00fe / 0104  00C1:007A = CollectSpellTargets }
StartCombat;                                                                           { 2f00:010b }
over := false;                                                                         { 2f00:0110 }
if (side_ActiveCount[0] = 0) or (side_ActiveCount[1] = 0) then over := true;           { 2f00:0114 / 011b / 0122 }
while not over do begin                                                                { 2f00:0126 }
  CountActiveSides;                                                                           { 2f00:012c  CountActiveSides }
  c := PartyHead;                                                                      { 2f00:0131 }
  while c <> nil do begin StartCombatRound(c); c := c^.next end;                       { 2f00:013d .. 0153 }
  Mem[7ECB] := 0;                                                                      { 2f00:015d }
  NextToAct(c);                                                                        { 2f00:016d }
  while c <> nil do begin TakeTurn(c); NextToAct(c) end;                               { 2f00:0176 / 017e / 0188 }
  EndOfRound(over);                                                                    { 2f00:0193 }
end;
EndCombat;                                                                             { 2f00:019e }
TextOutputActive := 1;                                                                 { 2f00:01a2 }
```

### 2F00:01AB NextToAct (H)
`procedure NextToAct(var who [BP+6]: PChar)` — RETF 4. Caller: CombatMain. Pool: 4800:0131 (0.91), same rule (B-6): the member with the highest `initiative` > 0 wins; on a tie a fresh d100 per candidate decides, an equal roll goes to the later member.
```pascal
best := 0;  bestRoll := 0;  c := PartyHead;                                            { 2f00:01b1 / 01b5 / 01b9 }
while c <> nil do begin                                                                { 2f00:01c5 }
  roll := Roll(1, 100);                                                                { 2f00:01d0 }
  if best < cb^.initiative then bestRoll := roll;                                      { 2f00:01db .. 01e8  +3, signed }
  if (best <= cb^.initiative) and (bestRoll <= roll) then begin                        { 2f00:01de .. 0206 }
    best := cb^.initiative;  who := c;  bestRoll := roll;                              { 2f00:01fc .. 0225 }
  end;
  c := c^.next;                                                                        { 2f00:0222 }
end;
if best = 0 then who := nil;                                                           { 2f00:0253 / 0240 }
```

### 2F00:026B TakeTurn (H)
`procedure TakeTurn(c [BP+6]: PChar)` — RETF 4. Caller: CombatMain. Pool: 4800:01F6 (0.84). **changed:** `combat_Visible` is computed per turn (the party side or a visible monster), `combat_Shown := 1` before the summary, and a new hook event 15h runs when no spell is queued.
```pascal
cb^[$0F] := 0;  cb^[$12] := 0;  cb^[7] := 0;                                           { 2f00:0271 .. 0286 }
CallEffectHooks(7, c);                                                                 { 2f00:0298 }
if cb^.initiative > 0 then begin                                                       { 2f00:02a6 }
  if cb^.initiative = $14 then cb^.initiative := $13;                                  { 2f00:02b8 / 02c7 }
  SelectedChar := c;                                                                   { 2f00:02d4 }
  combat_Visible := Ord((c^.side = 0) or IsVisible(c, 0));                             { 2f00:02e0 .. 0303  +197h }
  FocusCombatant(c, 2, 1);                                                             { 2f00:0306 }
  RecalcItems(c);                                                                      { 2f00:0317 }
  combat_Shown := 1;  DrawCharacterSummary(c);                                                    { 2f00:0322 / 032d  DrawCharacterSummary }
  CallEffectHooks($0F, c);                                                             { 2f00:0332 }
  if cb^.castSpell = 0 then CallEffectHooks($15, c);                                   { 2f00:0340 / 034e  new }
  if cb^.initiative > 0 then                                                           { 2f00:035c }
    if c^.controlled = 0 then PlayerTurn(c) else AiCombatTurn(c);                      { 2f00:036b / 0383 / 0376  +198h }
  RedrawSquare(CombatantCol(c), CombatantRow(c));                                      { 2f00:038d / 039f / 03a5 }
end;
```

### 2F00:03D5 PlayerTurn (H)
`procedure PlayerTurn(c [BP+6]: PChar)` — RETF 4. Caller: TakeTurn. Callees: ClearCombatantActionFlags, CastSpell, CombatMenu, SetQuick, ClearMenuLine, FlushGameKeys, Delay, AiCombatTurn, MoveAttack, ViewMenu, CalcAttacks, ov24_2E05, SelectTarget, ItemsMenu, BeginCast, TurnUndead, DoneMenu, ShowTimedBottomMessage, GodsIntervene, FocusCombatant, DrawCharacterSummary. Pool: 4800:031A (0.81). **changed:** (1) the keypad letters (`G H I K M O P Q`, also as extended keys) start MoveAttack with that key, 'M' starts it with a blank; (2) 'U' opens the items menu (`menu_Sel := 2`, ItemsMenu) instead of UseItem; (3) the Quick command flushes the keyboard; (4) a queued spell is cast with CastSpell(spell, 0, 1, done).
```pascal
if c^.active = 0 then dummy := ClearCombatantActionFlags(c)                                            { 2f00:03db / 03e6 .. 06e9 }
else if cb^.castSpell <> 0 then begin                                                  { 2f00:03e9 / 03f7 }
  s := cb^.castSpell;  cb^.castSpell := 0;                                             { 2f00:03f7 / 0405 }
  CastSpell(s, 0, 1, done);                                                            { 2f00:0411 }
  dummy := ClearCombatantActionFlags(c);                                                               { 2f00:0425 }
end else begin
  done := false;                                                                       { 2f00:0436 }
  while not done do begin                                                              { 2f00:043a }
    CombatMenu(c, key);                                                                { 2f00:0443 }
    if menu_Ext = 0 then                                                               { 2f00:0452 }
      case key of                                                                      { 2f00:045c }
        'Q': begin SetQuick(c); ClearMenuLine; FlushGameKeys; Delay(200); done := true; AiCombatTurn(c) end;   { 2f00:0463 / 046d / 0472 / 0477 / 0480 / 0484 }
        'M': MoveAttack(c, ' ', done);                                                 { 2f00:0492 / 0496 }
        'V': begin ViewMenu(done); CalcAttacks(c); if not done then ov24_2E05 end;     { 2f00:04af / 04b9 / 04c8 / 04ca  DrawCombatLayout }
        'A': SelectTarget(c, $FF, 1, 0, 1, done, tgt);                                 { 2f00:04d6 }
        'U': begin menu_Sel := 2; ItemsMenu(done); CalcAttacks(c); if not done then ov24_2E05 end;   { 2f00:0518 / 0508 / 0513 / 051c / 051e  new }
        'C': BeginCast(0, 0, done);                                                    { 2f00:052a }
        'T': begin TurnUndead(c); done := ClearCombatantActionFlags(c) end;                            { 2f00:0540 / 054b }
        'D': DoneMenu(c, done);                                                        { 2f00:055f }
        ' ': begin p := PartyHead;                                                     { 2f00:0570 / 0574  take back control of the PCs }
               while p <> nil do begin if p^.npc_morale < $80 then p^.controlled := 0; p := p^.next end;   { 2f00:0580 .. 059f }
             end;
      end
    else if key in ['H', 'P', 'M', 'K', 'G', 'O', 'Q', 'I'] then MoveAttack(c, key, done)   { 2f00:05b1 .. 05e4  keypad: move at once }
    else if key = '2' then begin                                                       { 2f00:05ea  Alt-M }
      MagicOn := not MagicOn;                                                           { 2f00:05ee .. 05fb }
      if MagicOn then ShowTimedBottomMessage('Magic On') else ShowTimedBottomMessage('Magic Off');               { 2f00:05fe / 0605 / 0614 / 061b / 062a }
    end else if key = #$10 then begin                                                  { 2f00:0632  Alt-Q: quick for everyone }
      cb^.initiative := $14;                                                           { 2f00:0636 }
      p := PartyHead;  while p <> nil do begin SetQuick(p); p := p^.next end;          { 2f00:0643 .. 0664 }
      ClearMenuLine;  Delay(200);  done := true;                                       { 2f00:0673 / 067c / 0681 }
    end else if key = '-' then                                                         { 2f00:0687  Alt-X }
      if GodsIntervene then begin FocusCombatant(c, 3, 0); done := true end            { 2f00:068b / 0690 / 0694 / 06a5 }
      else ShowTimedBottomMessage('That doesn''t work');                                            { 2f00:06ab / 06ba }
    if not done then begin FocusCombatant(c, 2, 1); combat_Shown := 1; DrawCharacterSummary(c) end;   { 2f00:06bf / 06c5 / 06d6 / 06db }
  end;
end;
```

### 2F00:076C CombatMenu (H)
`procedure CombatMenu(c [BP+0Ah]: PChar; var key [BP+6]: Char)` — RETF 6. Caller: PlayerTurn. Pool: 4800:0666 (0.96). **changed:** `Cast ` scans all 84 memorised-spell slots (`+1Eh..+71h`) and tests the ECL cell `Mem[4BE5]`; `Turn ` also for a former cleric (`old_level[0] > 0` and DualClassActive); the extended-key set CS:072C includes the keypad letters.
```pascal
opts := '';                                                                            { 2f00:0773 }
if cb^.moveLeft <> 0 then opts := opts + 'Move ';                                      { 2f00:0777 / 0786 .. 07a9 }
opts := opts + 'View Aim ';                                                            { 2f00:07ae .. 07d1 }
if c^.item_count <> 0 then opts := opts + 'Use ';                                      { 2f00:07d6 / 07e1 .. 0804  +14Ch }
any := false;                                                                          { 2f00:0809 }
for i := 0 to $53 do if c^.mem_spell[i] <> 0 then any := true;                         { 2f00:0816 .. 0827  +1Eh }
if any and (cb^.mayCast <> 0) and (Mem[4BE5] = 0) then opts := opts + 'Cast ';         { 2f00:082b .. 0850 / 085d .. 0875 }
if (ShortInt(c^.level[0]) > 0) or ((ShortInt(c^.old_level[0]) > 0) and DualClassActive(c)) then   { 2f00:087a .. 0896  +109h, +111h }
  if cb^.turned = 0 then opts := opts + 'Turn ';                                       { 2f00:089f / 08ae .. 08d1  +11h }
opts := opts + 'Quick Done';                                                           { 2f00:08d6 .. 08f9 }
repeat
  key := HorizontalMenu('', opts, 13, 10, 15, 1, 0, ext);                              { 2f00:08fe / 0926 }
  if ext <> 0 then if not (key in CS:072C) then key := #0;                             { 2f00:0931 / 0937 / 094a }
until key in CS:074C;                                                                  { 2f00:0951 / 095d }
ClearMenuLine;                                                                         { 2f00:0964 }
```

### 2F00:0997 EndOfRound (H)
`procedure EndOfRound(var over [BP+6]: Boolean)` — RETF 4. Caller: CombatMain. Pool: 4800:0880 (0.92). **changed:** StinkingCloudCheck gets the `poison` flag 0; the battle also ends when `CombatRound >= combat_MaxRounds`; AnyoneDying lives in ov24.
```pascal
AdvanceClock(1, 1);                                                                    { 2f00:099d }
CombatRound := CombatRound + 1;                                                        { 2f00:09a8 }
CalcEnemyHpPct;                                                                        { 2f00:09ac }
c := PartyHead;  k := 1;                                                               { 2f00:09b1 / 09ba }
while c <> nil do begin                                                                { 2f00:09c1 }
  CallEffectHooks($13, c);                                                             { 2f00:09c9 }
  StinkingCloudCheck(c, 0);                                                            { 2f00:09d7 }
  if c^.status = 5 then begin                                                          { 2f00:09e5  Dying }
    cb^.dyingTurns := cb^.dyingTurns + 1;                                              { 2f00:09f0  +0Eh }
    if cb^.dyingTurns > 9 then c^.status := 6;                                         { 2f00:09fc / 0a0b }
  end;
  k := k + 1;  c := c^.next;                                                           { 2f00:0a14 / 0a17 }
end;
if BandageDying(0) then ShowTimedBottomMessage('Your Teammate is Dying');                              { 2f00:0a29 / 0a35 / 0a3f / 0a44  AnyoneDying(false) }
CountActiveSides;                                                                             { 2f00:0a49  CountActiveSides }
FocusSquare(cm_Map^.viewX + 3, cm_Map^.viewY + 3, $FF, 8);                             { 2f00:0a4e .. 0a6e  +2, +3 }
if (side_ActiveCount[0] = 0) or (side_ActiveCount[1] = 0) or (combat_MaxRounds <= CombatRound) then over := true;   { 2f00:0a73 .. 0a8a  new limit }
if (side_ActiveCount[0] <> 0) and (side_ActiveCount[1] = 0) and (DemoMode = 0) then    { 2f00:0a91 .. 0a9f }
  if AskYesNo('Continue Battle:', 13, 10, 15) = 'Y' then over := false;                { 2f00:0aa6 / 0ab5 / 0ac5 / 0ac7 }
```

### 2F00:0B06 MoveAttack (H)
`procedure MoveAttack(c [BP+0Ch]: PChar; key [BP+0Ah]: Char; var done [BP+6]: Boolean)` — RETF 8. Caller: PlayerTurn ('M' with ' ', keypad letters with the letter). Callees: CombatantCol/Row, ClearRectangle, ByteToStr, HorizontalMenu, CombatantIndex, RestoreTerrain, PlaceCombatant, FocusSquare, ShowCombatant, ProbeMove, AttackTarget, AskYesNo, Flee, ShowTimedBottomMessage, AttacksOfOpportunity, ClearCombatantActionFlags, StepCombatant, StinkingCloudCheck, IsHelpless. Pool: 4800:09DF (0.91). **changed:** the first key may come from the caller (only a blank key asks the menu); the step cost is `CombatTerrain[tile].cost × 2` (orthogonal) or `× 3` (diagonal), FFh = impassable, and the refusal text is `can't go there`; StinkingCloudCheck(c, 1).
```pascal
savedMove := cb^.moveLeft;  savedFacing := cb^.facing;                                 { 2f00:0b0d / 0b1c  +6, +9 }
savedCol := CombatantCol(c);  savedRow := CombatantRow(c);                             { 2f00:0b2b / 0b39 }
k := key;  done := false;  dir := 8;                                                   { 2f00:0b44 / 0b4d / 0b50 }
while (cb^.moveLeft > 1) and (k <> #0) and (k <> #13) do begin                         { 2f00:0b58 .. 0b77 }
  ClearRectangle($18, $18, $27, $18);                                                  { 2f00:0b7c }
  if k = ' ' then                                                                      { 2f00:0b8d }
    k := HorizontalMenu('Move/Attack, Move Left = ' + ByteToStr(cb^.moveLeft div 2) + ' ', '', 10, 10, 15, 1, 0, dummy_Done);   { 2f00:0b93 .. 0bf6 }
  if k = #0 then begin                                                                 { 2f00:0bfe  Esc: undo the move }
    cb^.moveLeft := savedMove;                                                         { 2f00:0c08 }
    RestoreTerrain(0, 0, CombatantIndex(c));                                           { 2f00:0c17 / 0c29 }
    done := not PlaceCombatant(c, savedCol, savedRow, 0);                              { 2f00:0c2e / 0c4e }
    FocusSquare(CombatantCol(c), CombatantRow(c), 0, 8);                               { 2f00:0c54 / 0c66 / 0c72 }
    cb^.facing := savedFacing;  dir := 8;                                              { 2f00:0c77 / 0c86 }
  end else
    case k of 'H': dir := 0; 'I': dir := 1; 'M': dir := 2; 'Q': dir := 3; 'P': dir := 4; 'O': dir := 5; 'K': dir := 6; 'G': dir := 7; else dir := 8 end;   { 2f00:0c90 .. 0cdc }
  if dir < 8 then begin                                                                { 2f00:0ce0 }
    ShowCombatant(c, dir, 0, 0);                                                       { 2f00:0ce9 }
    ProbeMove(c, dir, occ, tile, hit1E, hit1C);                                        { 2f00:0cfe }
    if occ <> 0 then AttackTarget(c, cb_Char[occ], done)                               { 2f00:0d21 / 0d27 }
    else if tile = 0 then begin                                                        { 2f00:0d4c  off the field }
      case AskYesNo('Flee:', 13, 10, 15) of                                            { 2f00:0d52 / 0d61 }
        'Y': done := Flee(c);                                                          { 2f00:0d6f / 0d73 }
        'N': done := false;                                                            { 2f00:0d86 / 0d8a }
      end;
    end else begin
      if Odd(dir) then cost := CombatTerrain[tile].cost * 3 else cost := CombatTerrain[tile].cost * 2;   { 2f00:0d94 .. 0dc1  g_26A2 + tile*4 }
      if CombatTerrain[tile].cost = $FF then cost := $FF;                              { 2f00:0dcc / 0dde }
      if cb^.moveLeft < cost then ShowTimedBottomMessage('can''t go there')                         { 2f00:0de2 / 0df3 / 0e02 }
      else begin
        AttacksOfOpportunity(c, dir);                                                  { 2f00:0e0a }
        if c^.active = 0 then done := ClearCombatantActionFlags(c)                                     { 2f00:0e19 / 0e24 }
        else begin
          if cb^.moveLeft <> 0 then StepCombatant(c, dir);                             { 2f00:0e37 / 0e46 }
          if c^.active = 0 then done := ClearCombatantActionFlags(c);                                  { 2f00:0e55 / 0e60 }
          StinkingCloudCheck(c, 1);                                                    { 2f00:0e71 }
          if IsHelpless(c) then done := ClearCombatantActionFlags(c);                                   { 2f00:0e7f / 0e8e  IsHelpless }
        end;
      end;
    end;
  end;
  if (k <> #0) and (k <> #13) then k := ' ';                                           { 2f00:0e9f / 0ea5 / 0eab }
end;
if cb^.moveLeft < 2 then cb^.moveLeft := 0;                                            { 2f00:0eb2 / 0ec1 }
```

### 2F00:0EE9 AttackTarget (H)
`procedure AttackTarget(c [BP+0Eh], target [BP+0Ah]: PChar; var done [BP+6]: Boolean)` — RETF 0Ch. Caller: MoveAttack. Pool: 4800:0D45 (0.97), same body.
```pascal
if WeaponIsRanged(c) and not ov24_305B(c) then begin ShowTimedBottomMessage('Not with that weapon'); exit end;   { 2f00:0eef / 0efe / 0f04 / 0f0d / 0f17 / 0f1c }
if ConfirmAttackAlly(c, target) then begin                                             { 2f00:0f23 / 0f36 }
  cb^.target := target;                                                                { 2f00:0f38 .. 0f49  +0Ah }
  if FighterSweep(c, target) then done := true                                         { 2f00:0f4d / 0f60 / 0f62 }
  else begin FaceAttacker(c, target); Attack(c, target, 0, nil, done) end;             { 2f00:0f6b / 0f7c }
end;
```

### 2F00:0FE8 DoneMenu (H)
`procedure DoneMenu(c [BP+0Ah]: PChar; var done [BP+6]: Boolean)` — RETF 6. Caller: PlayerTurn ('D'). Pool: 4800:0E45 (0.98), same body (B-10).
```pascal
done := false;  opts := '';                                                            { 2f00:0fef / 0ff2 }
if not WeaponIsRanged(c) or ov24_305B(c) then opts := opts + 'Guard ';                      { 2f00:0ffa / 1009 / 100f / 1018 / 1023 .. 103b }
opts := opts + 'Delay Quit ';                                                          { 2f00:1040 .. 1063 }
if BandageDying(0) then opts := opts + 'Bandage ';                                        { 2f00:1068 / 1074 / 107f .. 1097  AnyoneDying(false) }
opts := opts + 'Speed Exit';                                                           { 2f00:109c .. 10bf }
key := ' ';                                                                            { 2f00:10c4 }
while not (key in [#0, 'E']) and not done do begin                                     { 2f00:10c8 / 10d1 / 10db  set CS:0FC8 }
  key := HorizontalMenu('', opts, 13, 10, 15, 0, 0, dummy_Done);                       { 2f00:10e7 / 110f }
  case key of
    'G': done := SetGuarding(c);                                                         { 2f00:1117 / 111e  SetGuarding }
    'D': begin cb^.initiative := 1; done := true end;                                  { 2f00:1131 / 1135 / 1142 }
    'Q': done := ClearCombatantActionFlags(c);                                                         { 2f00:114b / 114f }
    'B': begin done := BandageDying(1); done := ClearCombatantActionFlags(c) end;                         { 2f00:1162 / 1166 / 1174  AnyoneDying(true): bandage }
    'S': CombatGameSpeedMenu;                                                                { 2f00:1187 / 118b }
  end;
end;
```

### 2F00:11DF CombatGameSpeedMenu (H)
`procedure CombatGameSpeedMenu` — RETF. Caller: DoneMenu ('S'). Pool: 4800:10F6 (1.00), same body (B-11).
```pascal
key := ' ';                                                                            { 2f00:11e2 }
while not (key in [#0, 'E']) do begin                                                  { 2f00:11e6 / 11ea / 11fa  set CS:1198 }
  prompt := 'GameSpeed (' + ByteToStr(GameSpeed) + ') :';                              { 2f00:11fd .. 1234 }
  opts := ' ';                                                                         { 2f00:121c }
  if GameSpeed < 9 then opts := opts + 'Slower ';                                      { 2f00:124c / 1253 .. 1276 }
  if GameSpeed <> 0 then opts := opts + 'Faster ';                                     { 2f00:127b / 1282 .. 12a5 }
  opts := opts + 'Exit';                                                               { 2f00:12aa .. 12cd }
  key := HorizontalMenu(prompt, opts, 13, 10, 15, 0, 0, dummy_Done);                   { 2f00:12d2 }
  if key = 'S' then GameSpeed := GameSpeed + 1                                         { 2f00:12f8 / 12ff }
  else if key = 'F' then GameSpeed := GameSpeed - 1;                                   { 2f00:1305 / 1309 }
end;
```

### 2F00:1314 SetQuick (H)
`procedure SetQuick(c [BP+6]: PChar)` — RETF 4. Callers: PlayerTurn ('Q', Alt-Q). Pool: 4800:122B (0.98), same body.
```pascal
c^.controlled := 1;                                                                    { 2f00:1317  +198h }
if (cb^.target <> nil) and (cb^.target^.side = c^.side) then cb^.target := nil;        { 2f00:1320 .. 134b / 134d .. 135b  +0Ah, +197h }
```

### 2F00:1365 ov08_init (H)
Empty unit initialiser { 2f00:1365 }.

---

## ov15 (seg 4000) — camp: rest, memorize, scribe, effects display, party options, Fix

Unit: ov15, 25E8h bytes, 30 functions + init; entry `Camp` 23FC (stub ov15 e1), `CastMenu` 04CB (stub e2, ExploreCommand 'C'). Pool twin ov15 6B00 (shape 0.67..1.00). **new:** the `Fix` command (Camp 'F'): `Fix` 2309 with its nested helpers `IsOkay` 1EDA, `RollMemorizedCures` 1EFD, `RollRestCures` 1FB9, `MissingHp` 206B, `RestForCures` 20C5, `DistributeHealing` 2255 (Pool had no automatic healing).
Menus (DS strings, START.EXE bytes): `CampMenuText{g_0428}` = `Save View Magic Rest Alter Fix Exit`, `MagicMenuText{g_0451}` = `Cast Memorize Scribe Display Rest Exit`, `AlterMenuText{g_047A}` = `Order Drop Speed Icon Pics Exit`, `OrderMenuText{g_04A4}` = `Select Exit` / `g_04CD` = `Place Exit`. Strings (code segment): 0327 `cannot cast spells in this area`, 0347 `is in no condition to `, 035E `cast any spells`, 036E `memorize spells`, 037E `scribe any scrolls`, 04B3 `has no spells memorized`, 0581 ` `, 0583 `can memorize:`, 0591 `    Cleric Spells:`, 05A4 `     Druid Spells:`, 05B7 `Magic-User Spells:`, 08F7 `Memorize These Spells? `, 090F `cannot memorize any spells`, 092A `Memorize these spells? `, 0AF9 `Scribe These Spells? `, 0B0F `has no copyable scrolls`, 0B27 `You already know that spell`, 0B43 `You are already scibing that spell` (sic), 0B66 `You can not scribe that spell.`, 0B85 `Scribe these spells? `, 0EEC ` `, 0EEE `Funky--`, 0EF6 `Dispel Evil`, 0F02 `Faerie Fire`, 0F0E `Fumbling`, 0F17 `Helpless`, 0F20 `Confused`, 0F29 `Cause Disease`, 0F37 `Hot Fire Shield`, 0F47 `Cold Fire Shield`, 0F58 `Poisoned`, 0F61 `Regenerating`, 0F6E `Fire Resistance`, 0F7E `Minor Globe of Invulnerability`, 0F9D `enfeebled`, 0FA7 `invisible to animals`, 0FBC `Invisible`, 0FC6 `Camouflaged`, 0FD2 `protected from dragon breath`, 0FEF `berserk`, 0FF7 `Displaced`, 1001 ` <No Spell Effects>`, 1015 `` , 14B3 ``, 17F4 `Party Order: `, 1822 `has been selected`, 192E `quit TO DOS: `, 193C `will be gone`, 1949 `Drop from party? `, 195B `bids you farewell`, 196D `is dumped in a ditch`, 1982 `Breathes A sigh of relief`, 1AE6 `Game Speed = `, 1AF4 ` (0=fastest 9=slowest)`, 1B0B ` Faster`, 1B13 ` Slower`, 1B1B ` Exit`, 1B21 `Game Speed:`, 1CC9 `Alter: `, 1CD1 `Pics on  `, 1CDB `Animation on  `, 1CEA `Animation off  `, 1CFA `Pics off  `, 1D05 `Exit`, 1CAA ``, 23AD `The party makes camp...`, 23E5 `Camp:`, 23EB `Quit TO DOS `, 23F8 `PIC`. Sets: CS:14B2, 17D4, 1B2D, 1CA9, 23C5 = {#0, 'E'}; CS:1802 = {#13, 'P', 'S'}.
Character fields (H from this unit): `mem_spell[0..83] +1Eh` (bit 7 = chosen, not yet memorised), `rest_need +72h` (Pool +2Ch: 0 nothing, 4 something, 6 something of level ≥ 3 pending), **`known_spell[id] +78h + id`** (id 1..56: `+79h..+B0h`; ScribeMenu 4000:0cb5 — corrects the `+33h+id` guess in COMBAT.pas.md), **`spell_slots[class, level] +12Ch + class*5 + level`** (class 0 cleric, 1 druid, 2 magic-user; level 1..5; FreeSlots 4000:0309 — the COMBAT note `+137h..` is class 2), items `+14Dh`, scroll spell bytes = item `special[1..3] +3Ch..+3Eh` (bit 7 = being scribed). Spell table `SpellTable{g_37DA}[id*16]`: `+0 class`, `+1 level` (H), `+0Ah effect type` g_37E4 (DisplayEffects), names `SpellNames{g_27BD}[id*29h]` (string[40], id 1..56; DisplayEffects 4000:114b).
Globals: `sp_CampTarget{g_7555}` (far ptr, cleared by CastMenu/Camp — Pool 6DB5), `RestClock{g_7566}` (0Eh bytes: `g_7568` minutes-units, `g_756A` tens, `g_756C` hours — Pool 6DC2/6DC4/6DC6/6DC8), `g_757C` (cleared on entering camp; Pool HealCounter 6DD8, M), `menu_Sel` g_7294, `view_Mode` g_4FBA (2 = camp), `GameSpeed` g_4FA9, `opt_Pics{g_4FBE}` / `opt_Animation{g_4FBF}` (the Pics submenu toggles; g_4FBF is VIEW's "loading/animation" flag), `anim_Name` g_7278 / `anim_Id` g_728A saved into `camp_AnimName{g_7281}` / `camp_AnimId{g_728B}` and reloaded after camp.
Other-unit callees: ov19 `SpellList(mode, flag, var index, var found)` 3474 (0 memorised, 1 spell book, 3 scrolls, 5 pending memorise, 6 pending scribe), `ViewMenu` 0B75, `CycleSelectedChar` 32DC; ov22 `IsScroll` 612E, `CastSpell` 1263; ov20 `RestLoop` RestLoop(flag) (M: Pool 7A00 RestLoop; returns interrupted), `AdvanceClock`; ov16 `SaveGame` (ENGINE name), ov17 `RemovePartyMember(0, 1)`, `IconEditor` (ENGINE names); ov23 `Roll`, `HealCharacter`; ov24 `ShowCharacterMessage`, `ClearCharacterMessage`, `ShowTimedBottomMessage`, `RedrawCurrentMode`, `DrawLocationTimeStatus` DrawLocationTimeStatus (M), `ByteToStr`, `PartySummary`; ov29 `LoadAnimation(name, id, flags, anim)`; `TerminateGame`; ov26 menus.

### 4000:0000 ov15_LoadDeps (M)
Nine `CALLF` into entry 0 of ov34, ov22, ov20, ov24, ov16, ov26, ov19, ov28, ov23 { 4000:0003 .. 002b }.

### 4000:0034 RestTimeNeeded (H)
`function RestTimeNeeded(c [BP+6]: PChar): Word` — RETF 4. Callers: Rest. Pool: 6B00:0000 (0.90), same formula with 84 slots and `rest_need +72h`.
```pascal
maxMem := 0;  maxScr := 0;  lvMem := 0;  lvScr := 0;                                   { 4000:003a .. 0046 }
for i := 0 to $53 do                                                                   { 4000:004a }
  if c^.mem_spell[i] >= $80 then begin                                                 { 4000:0053 }
    lv := SpellTable[c^.mem_spell[i] and $7F].level;                                   { 4000:0064  g_37DB }
    if maxMem < lv then maxMem := lv;                                                  { 4000:0083 }
    lvMem := lvMem + lv;                                                               { 4000:0091 }
  end;
it := c^.items;                                                                        { 4000:009d  +14Dh }
while it <> nil do begin                                                               { 4000:00ad }
  if IsScroll(it) then                                                                 { 4000:00b5 / 00c2 }
    for k := 1 to 3 do                                                                 { 4000:00c4 }
      if it^.special[k] >= $80 then begin                                              { 4000:00cd }
        lv := SpellTable[it^.special[k] and $7F].level;                                { 4000:00de }
        if maxScr < lv then maxScr := lv;                                              { 4000:00fd }
        lvScr := lvScr + lv;                                                           { 4000:010b }
      end;
  it := it^.next;                                                                      { 4000:0117 }
end;
need := 0;                                                                             { 4000:0128 }
if (lvMem <> 0) or (lvScr <> 0) then need := 4;                                        { 4000:012c .. 0138 }
if (maxMem > 2) or (maxScr > 2) then need := 6;                                        { 4000:013c .. 0148 }
c^.rest_need := need;                                                                  { 4000:014c  +72h }
Result := lvScr * 15 + need * 60 + lvMem * 15;                                         { 4000:0156 .. 017c }
```

### 4000:0188 CancelMemorizing (H)
`procedure CancelMemorizing(c [BP+6]: PChar)` — RETF 4. Callers: CancelAllStudy, MemorizeMenu. Pool: 6B00:0159 (1.00). Clears every `mem_spell` slot ≥ 80h { 4000:018e .. 01bb } and `c^.rest_need := 0` { 4000:01bd }.

### 4000:01CB CancelScribing (H)
`procedure CancelScribing(c [BP+6]: PChar)` — RETF 4. Callers: CancelAllStudy, ScribeMenu. Pool: 6B00:019C (0.90), same body: for every scroll item (IsScroll { 4000:01ef }) clear bit 7 of `special[1..3]` { 4000:01fe .. 0225 }.

### 4000:023E CancelAllStudy (H)
`procedure CancelAllStudy` — RETF. Callers: Camp (twice). Pool: 6B00:0214 (0.85): for every party member CancelMemorizing, CancelScribing { 4000:0244 / 025f / 0269 / 026c }.

### 4000:0282 FreeSlots (H)
`function FreeSlots(level [BP+8], class [BP+6]: ShortInt): Byte` — RETF 4. Callers: ShowFreeSlots, MemorizeMenu. Pool: 6B00:025C (0.88). Pascal order (level, class) from the pushes at 4000:0600 and 0a52. Result = `SelectedChar^.spell_slots[class, level]` − number of `mem_spell` entries (any state) of that class and level (byte, B-16).
```pascal
n := 0;                                                                                { 4000:0288 }
for i := 0 to $53 do                                                                   { 4000:028c }
  if (SelectedChar^.mem_spell[i] <> 0) and (SpellTable[id and $7F].level = level) and (SpellTable[id and $7F].class = class) then n := n + 1;   { 4000:0295 .. 02f2  g_37DB, g_37DA }
Result := SelectedChar^[$12C + class*5 + level] - n;                                   { 4000:02f4 .. 0334 }
```

### 4000:0391 CanUseMagic (H)
`function CanUseMagic(what [BP+6]: Byte): Boolean` — RETF 2 (1 cast, 2 memorize, 3 scribe). Callers: CastMenu, MemorizeMenu, ScribeMenu. Pool: 6B00:036C (0.97), same body: `what = 1` and `Mem[4BE5] <> 0` → `cannot cast spells in this area`; else status 1 (Animated) or inactive → `is in no condition to ` + `cast any spells` / `memorize spells` / `scribe any scrolls`; the message goes through ShowCharacterMessage(SelectedChar, msg, 10, 1) { 4000:04a5 }; Result = no message { 4000:048e / 0496 }.

### 4000:04CB CastMenu (H)
`procedure CastMenu` — RETF, entry e2 (ExploreCommand 'C'). Pool: 6B00:04A1 (0.90). **changed:** `menu_Sel := 1` before the list; otherwise B-12.
```pascal
cast := false;  idx := -1;  sp_CampTarget := nil;  menu_Sel := 1;                     { 4000:04d1 / 04d5 / 04da / 04e2 }
if CanUseMagic(1) then repeat                                                          { 4000:04e7 / 04f5  no `ok` variable: the list is offered again until s = 0 }
  s := SpellList(0, 1, idx, found);                                                    { 4000:04f5  idx stays -1: it is only set at 04d5 }
  if s = 0 then begin                                                                  { 4000:050d }
    if not found then ShowCharacterMessage(SelectedChar, 'has no spells memorized', 10, 1)        { 4000:053e / 054a }
    else cast := true;                                                                 { 4000:0544 }
  end else begin
    cast := true;                                                                      { 4000:0513 }
    ClearRectangle(1, $11, $26, $16);                                                  { 4000:0517 }
    CastSpell(s, 0, 1, used);                                                          { 4000:0528 }
  end;
until s = 0;                                                                           { 4000:056c }
if cast then RedrawCurrentMode;                                                                { 4000:0572 / 0578 }
```

### 4000:05CA ShowFreeSlots (H)
`function ShowFreeSlots: Boolean` — RETF. Caller: MemorizeMenu. Pool: 6B00:05A4 (0.83). **changed:** three classes (cleric, druid, magic-user) × five levels; counts at columns 20, 23, 26, 29, 32.
```pascal
any := false;                                                                          { 4000:05cd }
for cls := 0 to 2 do begin                                                             { 4000:05d1 }
  has[cls] := false;                                                                   { 4000:05de }
  for lv := 1 to 5 do begin                                                            { 4000:05e4 }
    txt[cls, lv] := ByteToStr(FreeSlots(lv, cls));                                     { 4000:05f1 / 0604 / 0609  string[2] }
    if SelectedChar^[$12C + cls*5 + lv] = 0 then txt[cls, lv] := ' '                   { 4000:062f / 064e }
    else begin has[cls] := true; any := true end;                                      { 4000:067b / 0681 }
  end;
end;
if any then begin                                                                      { 4000:069b }
  ShowCharacterMessage(SelectedChar, 'can memorize:', 10, 0);                                     { 4000:06bb }
  row := 3;                                                                            { 4000:06c6 }
  for cls := 0 to 2 do                                                                 { 4000:06d3 }
    if has[cls] then begin                                                             { 4000:06df }
      case cls of 0: s := '    Cleric Spells:'; 1: s := '     Druid Spells:'; 2: s := 'Magic-User Spells:' end;   { 4000:06e9 .. 072e }
      DrawText(1, row + $11, 10, 0, s);                                                { 4000:072e }
      col := $13;                                                                      { 4000:074a }
      for lv := 1 to 5 do begin DrawText(col + 1, row + $11, 10, 0, txt[cls, lv]); col := col + 3 end;   { 4000:074e .. 0797 }
      row := row + 1;                                                                  { 4000:0799 }
    end;
end;
Result := any;                                                                         { 4000:07a5 }
```

### 4000:07B2 Rest (H)
`procedure Rest(var interrupted [BP+6]: Boolean)` — RETF 4. Callers: MagicMenu ('R'), Camp ('R'). Pool: 6B00:077A (0.88). **changed:** RestLoop takes a flag (1 = normal rest).
```pascal
t := 0;  c := PartyHead;                                                               { 4000:07b8 / 07bd }
while c <> nil do begin n := RestTimeNeeded(c); if t < n then t := n; c := c^.next end;   { 4000:07c9 .. 07fc }
rest_Hours := t div 60;  rest_Tens := (t mod 60) div 10;  rest_Units := t mod 10;      { 4000:07fe / 080b / 0824  g_756C / 756A / 7568 }
interrupted := RestLoop(1);                                                           { 4000:0832  RestLoop }
FillChar(RestClock, $0E, 0);                                                          { 4000:0840 }
DrawLocationTimeStatus;                                                                             { 4000:0851  DrawLocationTimeStatus }
```

### 4000:085C SortMemorized (H)
`procedure SortMemorized` — RETF. Caller: MemorizeMenu. Pool: 6B00:0824 (1.00): exchange sort of SelectedChar's 84 `mem_spell` bytes by `id and 7Fh` ascending { 4000:0862 .. 08f0 }.

### 4000:0942 MemorizeMenu (H)
`procedure MemorizeMenu` — RETF. Caller: MagicMenu ('M'). Pool: 6B00:090A (0.98), same body (`menu_Sel := 1` added; AskYesNo colours 14/10/15).
```pascal
if not CanUseMagic(2) then exit;                                                       { 4000:0948 / 0953 }
done := false;  idx := -1;  menu_Sel := 1;                                             { 4000:0956 / 095a / 095f }
s := SpellList(5, 0, idx, found);  changed := true;                                    { 4000:0964 / 097c }
if not found then changed := false                                                     { 4000:0980 / 0986 }
else if AskYesNo('Memorize These Spells? ', 14, 10, 15) = 'N' then CancelMemorizing(SelectedChar)   { 4000:0986 / 0995 / 09a7 / 09a7 }
else done := true;                                                                     { 4000:09b5 }
idx := -1;                                                                             { 4000:09bb }
while not done do begin                                                                { 4000:09c4 }
  if not ShowFreeSlots then begin done := true; ShowCharacterMessage(SelectedChar, 'cannot memorize any spells', 10, 1) end   { 4000:09cd / 09d5 / 09fb }
  else begin
    s := SpellList(1, 2, idx, found);  changed := true;                                { 4000:0a09 / 0a21 }
    if s = 0 then done := true                                                         { 4000:0a25 / 0a2b }
    else if FreeSlots(SpellTable[s].level, SpellTable[s].class) <> 0 then begin        { 4000:0a31 / 0a59 }
      k := 0;  while SelectedChar^.mem_spell[k] <> 0 do k := k + 1;                    { 4000:0a59 .. 0a6f }
      SelectedChar^.mem_spell[k] := s or $80;                                          { 4000:0a74 }
      SortMemorized;                                                                   { 4000:0a8d }
    end;
  end;
end;
if idx <> -1 then begin                                                                { 4000:0a94 }
  idx := -1;  s := SpellList(5, 0, idx, found);                                        { 4000:0a9a / 0aaf }
  if found and (AskYesNo('Memorize these spells? ', 14, 10, 15) = 'N') then CancelMemorizing(SelectedChar);   { 4000:0ab7 / 0acc / 0ade / 0ae7 }
end;
if changed then RedrawCurrentMode;                                                             { 4000:0aea / 0af0 }
```

### 4000:0B9B ScribeMenu (H)
`procedure ScribeMenu` — RETF. Caller: MagicMenu ('S'). Pool: 6B00:0B5B (0.95), same structure (B-18) with the Curse offsets (`known_spell +78h+id`, `spell_slots`).
```pascal
if not CanUseMagic(3) then exit;                                                       { 4000:0ba1 / 0bac }
done := false;  idx := -1;                                                             { 4000:0baf / 0bb3 }
s := SpellList(6, 0, idx, found);  changed := true;                                    { 4000:0bb8 / 0bd0 }
if not found then changed := false                                                     { 4000:0bd4 / 0bda }
else if AskYesNo('Scribe These Spells? ', 14, 10, 15) = 'N' then CancelScribing(SelectedChar)   { 4000:0bda / 0be9 / 0bfb / 0bfb }
else done := true;                                                                     { 4000:0c09 }
idx := -1;                                                                             { 4000:0c0f }
while not done do begin                                                                { 4000:0c18 }
  s := SpellList(3, 3, idx, found);                                                    { 4000:0c21 }
  if s = 0 then begin                                                                  { 4000:0c36 }
    done := true;                                                                      { 4000:0c39 }
    if not found then ShowCharacterMessage(SelectedChar, 'has no copyable scrolls', 10, 1) else changed := true;   { 4000:0c43 / 0c60 / 0c6d }
  end else begin
    changed := true;                                                                   { 4000:0c74 }
    if SelectedChar^.known_spell[s] <> 0 then ShowTimedBottomMessage('You already know that spell') { 4000:0c78 / 0c8a / 0c99  +78h + s }
    else begin
      it := SelectedChar^.items;  marked := false;                                     { 4000:0ca1 / 0caa }
      while (it <> nil) and not marked do begin                                        { 4000:0cb6 .. 0cbe }
        if IsScroll(it) then                                                           { 4000:0cc4 / 0cd1 }
          for k := 1 to 3 do                                                           { 4000:0cd3 }
            if (it^.special[k] >= $80) and (it^.special[k] and $7F = s) then begin ShowTimedBottomMessage('You are already scibing that spell'); marked := true end;   { 4000:0cdc .. 0d11 / 0d16 }
        it := it^.next;                                                                { 4000:0d20 }
      end;
      if not marked then                                                               { 4000:0d31 }
        if SelectedChar^[$12C + SpellTable[s].class*5 + SpellTable[s].level] = 0 then ShowTimedBottomMessage('You can not scribe that spell.')   { 4000:0d3a .. 0d69 / 0d7c / 0dfc }
        else begin
          it := SelectedChar^.items;                                                   { 4000:0d71 }
          while (it <> nil) and not marked do begin                                    { 4000:0d82 .. 0d8e }
            k := 1;                                                                    { 4000:0d90 }
            repeat                                                                     { first scroll byte equal to s gets bit 7 (no IsScroll test, B-18) }
              if it^.special[k] = s then begin it^.special[k] := it^.special[k] or $80; marked := true end;   { 4000:0d94 .. 0dc7 }
              k := k + 1;                                                              { 4000:0dcb }
            until (k >= 4) or marked;                                                  { 4000:0dce / 0dd4 }
            it := it^.next;                                                            { 4000:0dda }
          end;
        end;
    end;
  end;
end;
if idx <> -1 then begin                                                                { 4000:0deb }
  idx := -1;  s := SpellList(6, 0, idx, found);                                        { 4000:0ded / 0e0f }
  if found and (AskYesNo('Scribe these spells? ', 14, 10, 15) = 'N') then CancelScribing(SelectedChar);   { 4000:0e27 / 0e3c / 0e4e / 0e57 }
end;
if changed then RedrawCurrentMode;                                                             { 4000:0e5a / 0e60 }
```

### 4000:0E69 AddLine (H) — nested procedure of DisplayEffects
`procedure AddLine(header [BP+0Ch]: Byte; text [BP+8]: string)` (+ static link [BP+6]; parent's list tail at `[BP−0Ch]`) — RETF 8. Pool: 6B00:0E37 (0.87), same body (B-15: Pascal order (header, text)): appends a 2Eh-byte menu node { 4000:0e93 }, links it { 4000:0e9b .. 0ec1 }, `text` (string[40]) { 4000:0edb }, `header` { 4000:0ede }.

### 4000:1016 DisplayEffects (H)
`procedure DisplayEffects` — RETF. Caller: MagicMenu ('D'). Callees: GetMem, AddLine, ByteToStr, DrawScreenFrame, VerticalListMenu, FreeMenuList, RedrawCurrentMode. Pool: 6B00:0FBC (0.79). **changed:** the spell-effect type set and the fixed texts (see the strings above; 20 fixed types), spell names from `SpellNames` (56 spells), list colours 11/10/15, window (1,4)-(38,22).
```pascal
GetMem(list, $2E);  list^.header := 0;  list^.text := ' ';  list^.next := nil;         { 4000:101d .. 1051 }
c := PartyHead;                                                                        { 4000:105e }
while c <> nil do begin                                                                { 4000:106a }
  n := 0;                                                                              { 4000:1075 }
  AddLine(1, c^.name);                                                                 { 4000:1082 }
  e := c^.effects;                                                                     { 4000:1086  +F2h }
  while e <> nil do begin                                                              { 4000:1096 }
    show := true;  t := e^.type;                                                       { 4000:10a1 / 10a5 }
    if t in [1, 2, 5, 8..$0C, $0E, $10, $11, $13..$19, $1C, $1D, $20..$22, $24..$27, $29, $2A, $2D, $2E, $31, $33..$35] then begin   { 4000:10ae .. 1127  spell effects }
      id := 1;  found := false;                                                        { 4000:112c / 1130 }
      while (id < $39) and not found do                                                { 4000:1134 .. 113e }
        if SpellTable[id].effect = t then begin s := SpellNames[id]; found := true end else id := id + 1;   { 4000:1140 / 114b / 1154 / 1166  g_37E4, g_27BD + id*29h }
      if not found then s := 'Funky--' + ByteToStr(t);                                 { 4000:117f / 1185 .. 11b2 }
    end else
      case t of                                                                        { 4000:11ba .. 13c3 }
        4: s := 'Dispel Evil';  7: s := 'Faerie Fire';  $1B: s := 'Fumbling';  $1F: s := 'Helpless';  $23: s := 'Confused';
        $2C: s := 'Cause Disease';  $32: s := 'Hot Fire Shield';  $36: s := 'Cold Fire Shield';  $37: s := 'Poisoned';  $3B: s := 'Regenerating';
        $3D: s := 'Fire Resistance';  $3F: s := 'Minor Globe of Invulnerability';  $44: s := 'enfeebled';  $45: s := 'invisible to animals';  $47: s := 'Invisible';
        $48: s := 'Camouflaged';  $49: s := 'protected from dragon breath';  $4D: s := 'berserk';  $59: s := 'Displaced';
        else show := false;                                                            { 4000:13c3 }
      end;
    if show then begin n := n + 1; AddLine(0, ' ' + s) end;                            { 4000:13c6 / 13cc / 13e1 }
    e := e^.next;                                                                      { 4000:13e5  +5 }
  end;
  if n = 0 then AddLine(0, ' <No Spell Effects>');                                     { 4000:13f7 / 1410 }
  AddLine(0, ' ');                                                                     { 4000:1427 }
  c := c^.next;                                                                        { 4000:142b }
end;
redraw := 1;  idx := 0;                                                                { 4000:143e / 1442 }
DrawScreenFrame;                                                                       { 4000:1447 }
key := VerticalListMenu('', '', 11, 10, 15, 1, 4, $26, $16, list, 1, redraw, idx, sel);   { 4000:146a }
FreeMenuList(list);  RedrawCurrentMode;                                                        { 4000:149f / 14a9 }
```

### 4000:14D2 MagicMenu (H)
`procedure MagicMenu(var done [BP+6]: Boolean)` — RETF 4. Caller: Camp ('M'). Pool: 6B00:13F1 (1.00), same body (B-13).
```pascal
key := ' ';                                                                            { 4000:14d8 }
while not done and not (key in [#0, 'E']) do begin                                     { 4000:14dc .. 14f1  set CS:14B2 }
  key := HorizontalMenu('', MagicMenuText, 13, 10, 15, 1, 1, ext);                     { 4000:14fb  DS:044e }
  if ext <> 0 then begin CycleSelectedChar(key); PartySummary(SelectedChar) end                { 4000:152b / 1531 / 153a }
  else case key of
    'C': CastMenu;  'M': MemorizeMenu;  'S': ScribeMenu;  'D': DisplayEffects;  'R': Rest(done);   { 4000:1550 / 155a / 1564 / 156e / 1578 }
  end;
end;
```

### 4000:158A MoveSelectedDown (M)
`procedure MoveSelectedDown` — RETF. Caller: PartyOrder ('G' = Home in Place mode). Pool: 6B00:14A9 (0.71). List surgery on `PartyHead` (`next +189h`): SelectedChar is unlinked and relinked one place towards the front; when it is the head it goes to the end (B-14, "Down" moves the member up the roster). Finds the predecessor `p` { 4000:1590 .. 1609 }; head case { 4000:161c .. 1665 }: `if SelectedChar^.next <> nil then PartyHead := SelectedChar^.next; last^.next := SelectedChar; SelectedChar^.next := nil`; other case { 4000:1667 .. 17c3 }: `p^.next := SelectedChar^.next; SelectedChar^.next := p; if p = PartyHead then PartyHead := SelectedChar else pp^.next := SelectedChar` (pp = p's predecessor).

### 4000:16CB MoveSelectedUp (M)
`procedure MoveSelectedUp` — RETF. Caller: PartyOrder ('O' = End). Pool: 6B00:1601 (0.67). The mirror operation: SelectedChar swaps with its successor; the last member wraps to the front { 4000:16d1 .. 17d0 }.

### 4000:1834 PartyOrder (H)
`procedure PartyOrder` — RETF. Caller: AlterMenu ('O'). Pool: 6B00:1780 (0.98), same body (B-19).
```pascal
place := false;  key := ' ';                                                           { 4000:183a / 183e }
while not (key in [#0, 'E']) do begin                                                  { 4000:1842 / 184b  set CS:17D4 }
  key := HorizontalMenu('Party Order: ', OrderMenuText[place], 13, 10, 15, 1, 1, ext); { 4000:1864  DS:04A4 + place*29h }
  if ext = 0 then begin                                                                { 4000:1891 }
    if key in [#13, 'P', 'S'] then begin                                               { 4000:18d9  set CS:1802 }
      place := not place;                                                              { 4000:18e9 }
      if place then ShowCharacterMessage(SelectedChar, 'has been selected', 10, 0) else ClearCharacterMessage;   { 4000:18f8 / 1915 / 1922 }
    end;
  end else if not place then begin CycleSelectedChar(key); PartySummary(SelectedChar) end      { 4000:1897 / 189d / 18a6 }
  else begin
    if key = 'G' then MoveSelectedDown else if key = 'O' then MoveSelectedUp;          { 4000:18b5 / 18bc / 18c2 / 18c6 }
    PartySummary(SelectedChar);                                                        { 4000:18ca }
  end;
end;
```

### 4000:199C DropCharacter (H)
`procedure DropCharacter` — RETF. Caller: AlterMenu ('D'). Pool: 6B00:18E5 (0.99), same body (B-20); `RemovePartyMember(0, 1)` (ENGINE name).
```pascal
if (SelectedChar^.next = nil) and (SelectedChar = PartyHead) then begin               { 4000:19a2 .. 19be }
  if AskYesNo('quit TO DOS: ', 14, 10, 15) = 'Y' then begin RemovePartyMember(0, 1); TerminateGame end;   { 4000:19d3 / 19e5 / 19eb / 19f0 }
end else begin
  ShowCharacterMessage(SelectedChar, 'will be gone', 10, 0);                                      { 4000:1a14 }
  if AskYesNo('Drop from party? ', 14, 10, 15) = 'Y' then begin                        { 4000:1a2e / 1a40 }
    if SelectedChar^.active = 0 then ShowCharacterMessage(SelectedChar, 'is dumped in a ditch', 10, 1)   { 4000:1a43 / 1a8a }
    else ShowCharacterMessage(SelectedChar, 'bids you farewell', 10, 1);                          { 4000:1a66 }
    RemovePartyMember(0, 1);                                                           { 4000:1a95 }
    ClearRectangle($11, 1, $26, $0B);  PartySummary(SelectedChar);                     { 4000:1aa0 / 1ab1 }
  end else ShowCharacterMessage(SelectedChar, 'Breathes A sigh of relief', 10, 1);                { 4000:1ad7 }
end;
```

### 4000:1B4D GameSpeedMenu (H)
`procedure GameSpeedMenu` — RETF. Caller: AlterMenu ('S'). Pool: 6B00:1A97 (0.99), same body (B-21).
```pascal
repeat
  DrawText(1, $12, 10, 0, 'Game Speed = ' + ByteToStr(GameSpeed) + ' (0=fastest 9=slowest)');   { 4000:1b54 .. 1b8e }
  opts := '';                                                                          { 4000:1b93 }
  if GameSpeed <> 0 then opts := opts + ' Faster';                                     { 4000:1b97 .. 1bc1 }
  if GameSpeed < 9 then opts := opts + ' Slower';                                      { 4000:1bc6 .. 1bf0 }
  opts := opts + ' Exit';                                                              { 4000:1bcd .. 1c17 }
  key := HorizontalMenu('Game Speed:', opts, 13, 10, 15, 1, 1, ext);                   { 4000:1bf5 }
  if ext = 0 then begin                                                                { 4000:1c4a }
    if key = 'F' then GameSpeed := GameSpeed - 1 else if key = 'S' then GameSpeed := GameSpeed + 1;   { 4000:1c4d .. 1c72 }
  end else if (key = 'P') and (GameSpeed <> 0) then GameSpeed := GameSpeed - 1         { 4000:1c53 / 1c5a / 1c61  down arrow }
  else if (key = 'H') and (GameSpeed < 9) then GameSpeed := GameSpeed + 1;             { 4000:1c67 / 1c6b / 1c89  up arrow }
until key in [#0, 'E'];                                                                { 4000:1c8d  set CS:1B2D }
ClearCharacterMessage;                                                                             { 4000:1ca0 }
```

### 4000:1D0A AlterMenu (H)
`procedure AlterMenu` — RETF. Caller: Camp ('A'). Pool: 6B00:1C59 (0.92). **changed:** the Pics submenu shows the current state and offers `Animation on/off` only while pictures are on (`opt_Pics` g_4FBE, `opt_Animation` g_4FBF); 'I' = IconEditor (ov17) then RedrawCurrentMode.
```pascal
key := ' ';                                                                            { 4000:1d0d }
while not (key in [#0, 'E']) do begin                                                  { 4000:1d11 / 1d15  set CS:1CA9 }
  key := HorizontalMenu('Alter: ', AlterMenuText, 13, 10, 15, 1, 1, ext);              { 4000:1d28  DS:047A }
  if ext <> 0 then begin CycleSelectedChar(key); PartySummary(SelectedChar) end                { 4000:1d58 / 1d5e / 1d67 }
  else case key of
    'O': PartyOrder;  'D': DropCharacter;  'S': GameSpeedMenu;                         { 4000:1d7e / 1d89 / 1d94 }
    'I': begin IconEditor; RedrawCurrentMode end;                                              { 4000:1d9f / 1da4 }
    'P': repeat                                                                        { 4000:1dac }
           if opt_Pics = 0 then opts := 'Pics off  '                                   { 4000:1db3 / 1dba }
           else begin opts := 'Pics on  '; if opt_Animation = 0 then opts := opts + 'Animation off  ' else opts := opts + 'Animation on  ' end;   { 4000:1dba / 1dcd .. 1e2d }
           opts := opts + 'Exit';                                                      { 4000:1e3b .. 1e55 }
           k := HorizontalMenu('', opts, 13, 10, 15, 0, 1, ext);                       { 4000:1e63 }
           if k = 'P' then opt_Pics := Ord(opt_Pics = 0)                               { 4000:1e93 / 1e9a .. 1ea7 }
           else if k = 'A' then opt_Animation := Ord(opt_Animation = 0);               { 4000:1eac / 1eb0 .. 1ebd }
         until k in [#0, 'E'];                                                         { 4000:1ec0 }
  end;
end;
```

### 4000:1EDA IsOkay (M) — nested function of Fix
`function IsOkay(c [BP+8]: PChar): Boolean` (+ static link [BP+6]) — RETF 6: `c^.status = 0` { 4000:1ee0 / 1ee9 }.

### 4000:1EFD RollMemorizedCures (M) — nested procedure of Fix
`procedure RollMemorizedCures` (static link [BP+6]; parent's `total` at `[BP−2]`) — RETF 2. For every Okay party member, every memorised Cure Light Wounds (3), Cure Serious Wounds (3Ah) and Cure Critical Wounds (47h) adds its roll (1d8, 2d8+1, 3d8+3) to `total` — the slots are **not** cleared (the spells are not used up).
```pascal
sum := 0;  c := PartyHead;                                                             { 4000:1f03 / 1f08 }
while c <> nil do begin                                                                { 4000:1f14 }
  if IsOkay(c) then                                                                    { 4000:1f1f / 1f2e }
    for i := 0 to $53 do                                                               { 4000:1f30 }
      case c^.mem_spell[i] of                                                          { 4000:1f39 .. 1f7b }
        3: sum := sum + Roll(1, 8);                                                    { 4000:1f4e }
        $3A: sum := sum + Roll(2, 8) + 1;                                              { 4000:1f65 }
        $47: sum := sum + Roll(3, 8) + 3;                                              { 4000:1f7d }
      end;
  c := c^.next;                                                                        { 4000:1f96 }
end;
total := total + sum;                                                                  { 4000:1fa9 }
```

### 4000:1FB9 RollRestCures (M) — nested procedure of Fix
`procedure RollRestCures` (static link; parent's `n1 [BP−4]`, `n4 [BP−6]`, `n5 [BP−8]`, `total [BP−2]`) — RETF 2: rolls `n1` × 1d8, `n4` × (2d8+1), `n5` × (3d8+3) and adds them to `total` { 4000:1fbf .. 2061 } (the cures the party can memorize while resting, see RestForCures).

### 4000:206B MissingHp (M) — nested function of Fix
`function MissingHp: Word` (static link) — RETF 2: Σ over the party of `maxhp − hp` { 4000:2071 .. 20b4  +78h, +1A4h }.

### 4000:20C5 RestForCures (M) — nested procedure of Fix
`procedure RestForCures` (static link; writes the parent's `n1/n4/n5`) — RETF 2. Counts the party's cleric spell slots of level 1, 4 and 5 (`+12Dh`, `+130h`, `+131h` = `spell_slots[0, 1/4/5]`, Okay members only) and derives the rest time needed to memorize them: per member `15·n1 + 60·n4 + 75·n5` minutes plus 240 when level-1 slots exist, plus 360 when level-4/5 slots exist (replacing the 240); the maximum over the members is the rest time; the expected healing (`27·[n1>0] + 34·[n4>0, n5=0] + 78·[n5>0]` per member) is compared with MissingHp and the time is divided by `expected div missing` when the party needs less; the rest clock is set as in Rest.
```pascal
n1 := 0;  n4 := 0;  n5 := 0;  maxT := 0;  expected := 0;                               { 4000:20d7 .. 20ef }
c := PartyHead;                                                                        { 4000:20cb }
while c <> nil do begin                                                                { 4000:20fd }
  t1 := 0;  t4 := 0;  t5 := 0;  fixed := 0;                                            { 4000:2101 .. 2111 }
  if IsOkay(c) then begin                                                              { 4000:2116 / 2125 }
    n1 := n1 + c^[$12D];  t1 := c^[$12D] * 15;                                         { 4000:2127 / 2138 }
    n4 := n4 + c^[$130];  t4 := c^[$130] * 60;                                         { 4000:214a / 215b }
    n5 := n5 + c^[$131];  t5 := c^[$131] * 75;                                         { 4000:216d / 217e }
  end;
  if t1 <> 0 then begin fixed := 240; expected := expected + 27 end;                   { 4000:2190 / 2196 .. 219b }
  if t4 + t5 <> 0 then begin fixed := 360; if t5 = 0 then expected := expected + 34 else expected := expected + 78 end;   { 4000:219f .. 21be }
  if maxT < fixed + t1 + t4 + t5 then maxT := fixed + t1 + t4 + t5;                    { 4000:21be .. 21d8 }
  c := c^.next;                                                                        { 4000:21d8 }
end;
if MissingHp < expected then maxT := maxT div Lo(expected div MissingHp);              { 4000:21eb / 21f7 / 21fb .. 221b }
rest_Hours := maxT div 60;  rest_Tens := (maxT mod 60) div 10;  rest_Units := maxT mod 10;   { 4000:221b / 2228 / 2241 }
```

### 4000:2255 DistributeHealing (M) — nested procedure of Fix
`procedure DistributeHealing` (static link; parent's `total [BP−2]`) — RETF 2: every hurt member is healed by `min(maxhp − hp, total)` (HealCharacter(c, n, 0)) and `total` is reduced by it { 4000:225b .. 2300 / 22d1 }.

### 4000:2309 Fix (M)
`procedure Fix(var interrupted [BP+6]: Boolean)` — RETF 4. Caller: Camp ('F'). New (no Pool twin): automatic healing — the rolls of the memorised cure spells are pooled, then the party rests long enough to memorize fresh cures (RestForCures / RestLoop(0)), those are rolled too and the pool is distributed.
```pascal
interrupted := false;  total := 0;                                                     { 4000:230f / 2316 }
if MissingHp <> 0 then begin                                                           { 4000:231c / 2324 }
  RollMemorizedCures;                                                                  { 4000:2328 }
  if MissingHp = 0 then begin PartySummary(SelectedChar); DrawLocationTimeStatus end                { 4000:232d / 2335 / 233d / 2342  cannot be true: nothing was healed yet (quirk) }
  else begin
    saved := RestClock;                                                               { 4000:2349  14 bytes }
    RestForCures;                                                                      { 4000:235d }
    interrupted := RestLoop(0);                                                       { 4000:2361  RestLoop(0) }
    if not interrupted then begin                                                      { 4000:2369 / 2378 }
      RollRestCures;  DistributeHealing;                                               { 4000:2379 / 237e }
      PartySummary(SelectedChar);  DrawLocationTimeStatus;                                          { 4000:2382 / 238f }
      RestClock := saved;                                                             { 4000:2394 }
    end;
  end;
end;
```

### 4000:23FC Camp (H)
`procedure Camp(var done [BP+6]: Boolean)` — RETF 4, entry e1. Callees: FillChar, @StrAssign, RedrawCurrentMode, ClearRectangle, DrawText, CancelAllStudy, HorizontalMenu, CycleSelectedChar, PartySummary, SaveGame, AskYesNo, TerminateGame, ViewMenu, MagicMenu, Rest, Fix, AlterMenu, Copy, @StrCompare, LoadAnimation, DrawLocationTimeStatus, ClearCharacterMessage, ClearMenuLine. Pool: 6B00:1E6F (0.86). **changed:** `Fix`; the current animation name/id are saved on entry and a `PIC` animation is reloaded on exit (the encounter picture survives the camp); `menu_Sel := 1` before the sub-menus; the camp flag `g_757C` (Pool HealCounter) is cleared.
```pascal
saved := view_Mode;  view_Mode := 2;  HealCounter := 0;                                     { 4000:2403 / 2409 / 240e }
FillChar(RestClock, $0E, 0);                                                          { 4000:2413 }
camp_AnimName := anim_Name;  camp_AnimId := anim_Id;                                   { 4000:2424 / 2437  string[8], g_7281 / g_728B }
RedrawCurrentMode;                                                                             { 4000:243d }
ClearRectangle(1, $11, $26, $16);                                                      { 4000:2442 }
DrawText(1, $12, 10, 0, 'The party makes camp...');                                    { 4000:246e }
CancelAllStudy;                                                                        { 4000:2473 }
done := false;  key := ' ';                                                            { 4000:2477 / 247e }
while not done and not (key in [#0, 'E']) do begin                                     { 4000:2482 .. 2497  set CS:23C5 }
  key := HorizontalMenu('Camp:', CampMenuText, 13, 10, 15, 1, 1, ext);                 { 4000:24a1  DS:0426 }
  if ext <> 0 then begin CycleSelectedChar(key); PartySummary(SelectedChar) end                { 4000:24d1 / 24d7 / 24e0 }
  else case key of
    'S': begin SaveGame; if AskYesNo('Quit TO DOS ', 14, 10, 15) = 'Y' then TerminateGame end;   { 4000:24f7 / 250b / 251b / 251d }
    'V': begin menu_Sel := 1; ViewMenu(viewExt) end;                                   { 4000:2539 / 2532 }
    'M': begin menu_Sel := 1; MagicMenu(done) end;                                     { 4000:254d / 2548 }
    'R': begin menu_Sel := 1; Rest(done) end;                                          { 4000:2561 / 255c }
    'F': Fix(done);                                                                    { 4000:2565  new }
    'A': begin menu_Sel := 1; AlterMenu end;                                           { 4000:2574 / 257a }
  end;
end;
if Copy(camp_AnimName, 1, 3) = 'PIC' then LoadAnimation(camp_AnimName, camp_AnimId, 0, enc_Anim);   { 4000:2580 / 2598 / 25a4 }
CancelAllStudy;                                                                        { 4000:25ba }
sp_CampTarget := nil;  view_Mode := saved;                                             { 4000:25be / 25c6 }
DrawLocationTimeStatus;  ClearCharacterMessage;  ClearMenuLine;                                                 { 4000:25cc / 25d1 / 25d6 }
```

### 4000:25E1 ov15_init (H)
Empty unit initialiser { 4000:25e1 }.

---

## ov22 (seg 5800) — spell lists, casting, spell handlers, spell table (part A: lists, casting core, targeting helpers)

Unit: ov22, 68ACh bytes, 116 functions + init; stub entries: e1 `ChooseSpell` 0219, e2 `BuildSpellList` 09FC, e3 `SpellRange` 0D67, e4 `SelectTargetsCamp` 10D2, e5 `CastSpell` 1263, e6 `IsScroll` 612E, e7 `UseScrollSpell` 617B, e8 `ShowCasts` 6209, e9 `Spell_RemoveCurse` 3599, e10 `InitSpellTable` 630B, e11 LoadDeps, e12.. the handlers (011A:009D .. 025F). Pool twin ov22 8E00 (shape 0.84..1.00 for the shared routines). **new:** `SpellUsable` 0020 (class/level gate for the spell lists), `AddSpellLineCounted` 05B4 (grouped list lines with a `(xN)` count), the cone/ray helpers `ConeTargets` 175B (+ nested 15FB/163E/168B), `HoldTargets` 1ABF generalised, 45 new handlers (spells 39h..64h of Curse: higher-level cleric/MU spells, druid spells, monster powers, breath weapons as effect handlers).
Spell table `SpellTable{g_37DA}[id*16]` (ids 1..64h, names `SpellNames{g_27BD}[id*29h]`, string[40]; ids 39h, 3Bh..41h, 5Fh..63h have no name = item/monster powers); level headings `LevelHeading{g_0875}[level*29h]` (`1st Level`..`7th Level`). Fields (H from this unit): `+0 class` (0 cleric, 1 druid, 2 magic-user, 3 item/monster power), `+1 level`, `+2 range` (FFh = touch), `+3 range per level`, `+4 duration`, `+5 duration per level`, `+6 area/target code`, `+7 target mode` (0 combat only, 1 caster, 2 one party member, 4 whole party), `+8 save effect` (0 none, 1 negates, 2 half damage), `+9 save type`, `+0Ah effect type`, `+0Bh..+0Fh` AI bytes (COMBAT lane: combat, castTime, aiValue, needsTarget, areaSize). `SpellHandlers{g_72A0}[0..100]` = far pointers (4 bytes each, DS:72A0..7433) filled by InitSpellTable; index 0 = the target selector (camp: SelectTargetsCamp; combat: ov13 CollectSpellTargets, set by ov08 CombatMain).
Globals: `sl_List{g_4B44}` (menu list head), `sl_Counts{g_4B48}[0..83]` (memorised copies per list line, new), `sl_Ids{g_4B9C}[0..83]` (spell id per selectable line), `sl_Items{g_4BF0}[0..30h]` (far ptr per scroll line), `sl_ItemCount{g_4CB4}`, `sp_Str{g_4CB5}` / `sp_StrExc{g_4CB6}` (scratch: strength / exceptional strength for Enlarge; also the sleep budget / dispel chance scratch), `ScrollItem{g_729C}`, `sp_Current{g_6F97}` (spell being executed), `SpellTargetCount{g_7434}`, `SpellTargets{g_7435}[1..]` (far ptrs, Ghidra `g_7430 + k*4 + 1`), `SpellX{g_7559}`, `SpellY{g_755A}`, `sp_CampTarget{g_7555}`, `ItemCast{g_7563}`, `DamageType{g_6F95}`, `DamageAmount{g_6F94}`, `EffectToApply{g_6F93}`, `SpellArea{g_6F9D}`, `cure_InProgress{g_6F9C}`, `ItemsChanged{g_6F9E}`, `cloud_List{g_755B}` (stinking clouds) / `cloud9_List{g_755F}` (cloudkill), `hold_Victim{g_6FA3}`, `item_HookMode{g_7582}`, `g_7746` (the target selector's `ok` result for the breath handlers, L), `gfx_LoopCounter` g_7747 (a loop variable here), `combat_Visible` g_75E6, ECL cell `Mem[4BE6]` (area flag that keeps the aimed target list for area spells, Pool w[$1CC]), sounds `g_25C2` (fireball), `g_25BC` (lightning), `g_25B0` (other spells). Tables: `CloudSquareDir{g_27D7}[1..4]` = 08 02 03 04 (the 2×2 stinking-cloud squares), `CloudDirs9{g_27DB}[1..9]` = 08 00 01 02 03 04 05 06 07 (the 3×3 cloudkill), `BounceDX/DY{g_0A10..}` (lightning-bolt reflection, 4 × 8 signed bytes at DS:0A10/0A18/0A20/0A28), `DS:3E02` = 1 (save effect used by Ice Storm).
Other-unit callees (COMBAT names): ov23 `ApplyEffect(c, type, duration, p3, callOnRemove, negateOnSave, saved, msg)` 2307, `DamageCharacter(c, dmg, saveEffect, saved)` 1FD6, `SavingThrow(c, type, bonus)` 12EB, `AttackRoll(att, tgt, ac)` 123F, `AddEffect` 13EE, `RemoveEffect` 010E, `CureEffect(c, type)` 1643, `CallEffectHandler(type, c, e, mode)` 00C9, `CallEffectHooks(event, c)` 03FE, `Roll` 137F, `RollDice` 13CA, `HealCharacter` 23FB, `ReviveCombatant(c, hp)` 24ED, `KillCombatant(c, status, msg)` 0016, `StrengthFromItem(c, str, exc, var code)` 1720, `RecalcAbility(c, n)` 18D8, `StinkingCloudCheck(c, poison)` 0E45, `ov23_1569` BreakInvisibility; ov24 `SpellCasterLevel` SpellCasterLevel(spell) (Pool 00BA:26C2, M), `ShowCharacterMessage`, `ShowCombatMessageAnimation` ShowCombatMessageAnimation(c, flag, msg), `ShowHealingResult` ShowHealingResult(c) (M), `ForgetMemorizedSpell` ForgetMemorizedSpell(c, spell), `BuildFourAnimationFrames` BuildFourAnimationFrames(n), `AnimateAlongPath` AnimateAlongPath(x1, y1, x2, y2, steps, pause), `IsSideZero` OppositeSide(c) (M), `CollectOppositeSideTargets` CollectOppositeSideTargets(c, range) (M), `TargetDistance` Distance(a, b), `SelectPartyCharacter` SelectPartyCharacter(prompt, flag, var who), `RacialLevelLimitReached` RacialLevelLimitReached(c, class) (M), `DrawCharacterName` DrawCharacterName, `ClearCombatantActionFlags`, `ShowTimedBottomMessage`, `ClearCharacterMessage`, `ByteToStr`, `RecalcItems`, `LoseItem(owner, item)`, `HasEffect`; ov25 `DualClassActive` DualClass(c) (former-class flag, M), `UpdateLevelStats` UpdateLevelStats(c) (M); ov31 `LineInit(var line)`, `LineStep(var line)`, `TraceLine`, `Sign(n)`, `InFrontArc`, `BuildTargetList`; ov32 `CellAt(col, row, var occ, var tile)`, `CombatantCol/Row/Index`, `PlaceCombatant`, `RestoreTerrain`, `FocusSquare`, `ShowCombatant`, `IsVisible`; ov26 menus.

### 5800:0000 ov22_LoadDeps (M)
Five `CALLF` into entry 0 of ov24, ov25, ov23, ov26, ov34 { 5800:0003 .. 0017 }.

### 5800:0020 SpellUsable (H)
`function SpellUsable(c [BP+8]: PChar; id [BP+6]: Byte): Boolean` — RETF 6. Caller: BuildSpellList (every list mode that scans memorised/known spells). New. Whether the character's classes and ability scores let it use spell `id` (bit 7 stripped):
```pascal
id := id and $7F;  Result := false;                                                    { 5800:0026 / 002e }
case SpellTable[id].class of                                                           { 5800:0032 }
  0: Result := (c^.wis > 8) and ((ShortInt(c^.level[0]) > 0) or (DualClass(c) and (ShortInt(c^.old_level[0]) > 0))   { 5800:0045 .. 007c  +15h, +109h, +111h }
               or (ShortInt(c^.level[3]) > 8) or ((ShortInt(c^.old_level[3]) > 8) and DualClass(c)));   { 5800:007e .. 00a1  paladin 9+ }
  1: Result := (c^.wis > 8) and ((ShortInt(c^.level[4]) > 6) or (DualClass(c) and (ShortInt(c^.old_level[4]) > 6)));   { 5800:00b3 .. 00ea  ranger 7+ }
  2: if c^.int < 9 then Result := false                                                { 5800:00ff  +13h }
     else if (c^.race <> 7) or (c^.readied[2] = nil) or (view_Mode <> 5) then Result := true   { 5800:0109 / 0113 / 0122  race 7 (M: human) in armour during combat }
     else Result := (ShortInt(c^.level[4]) > 8) or (DualClass(c) and (ShortInt(c^.old_level[4]) > 8)   { 5800:0129 .. 0146 }
                    and ((ShortInt(c^.level[5]) > 0) or (DualClass(c) and (ShortInt(c^.old_level[5]) > 0))));   { 5800:014e .. 0171 }
  3: Result := false;                                                                  { 5800:021f }
end;
```

### 5800:0219 ChooseSpell (H)
`function ChooseSpell(mode [BP+0Ah]: Byte; var page [BP+6]: Integer): Byte` — RETF 6, entry e1. Caller: ov19 SpellList. Pool: 8E00:008A (0.89), same body (B-23) with the Curse globals.
```pascal
case mode of 1: opt := 'Cast'; 2: opt := 'Memorize'; 3: opt := 'Scribe'; 4: opt := 'Learn'; else opt := '' end;   { 5800:0229 .. 028c }
if mode in [1..4] then prompt := 'Choose Spell: ' else prompt := '';                   { 5800:0290 / 02a0 .. 02b3  set CS:01AA }
if mode = 2 then bottom := $0F else bottom := $16;                                     { 5800:02b9 .. 02d3 }
selectable := mode <> 4;                                                               { 5800:02d5 }
redraw := page < 0;                                                                    { 5800:02dd / 02e6 }
if page < 0 then page := 0;                                                            { 5800:02ea / 02f8 }
if (mode = 4) or (mode = 1) then redraw := true;                                       { 5800:02fe / 0302 }
sel := nil;                                                                            { 5800:0307 }
repeat
  key := VerticalListMenu(prompt, opt, 13, 10, 15, 1, 5, $26, bottom, sl_List, selectable, redraw, page, sel);   { 5800:030a }
until key in [#0, #13, 'C', 'E', 'L', 'M', 'S'];                                       { 5800:034d  set CS:01D9 }
n := 0;  p := sl_List;                                                                 { 5800:0369 / 035d }
while p <> sel do begin if p^.header = 0 then n := n + 1; p := p^.next end;            { 5800:036d .. 0398 }
if key in [#0, 'E'] then Result := 0 else Result := sl_Ids[n];                         { 5800:039a / 03aa / 03b0  set CS:01F9 }
if mode = 3 then ScrollItem := sl_Items[n];                                            { 5800:03be / 03c4 .. 03d8 }
FreeMenuList(sl_List);                                                                 { 5800:03dc }
```

### 5800:03F5 AddSpellLine (H)
`procedure AddSpellLine(id [BP+6]: Byte)` — RETF 2. Caller: AddItemSpells. Pool: 8E00:028D (0.88), same body: appends a 2Eh-byte line; a level heading when the level changes { 5800:0529 / 0530 / 0545 }; `'  '` + name or `' *'` + name (bit 7 = not yet memorised) { 5800:0559 .. 058a }; `sl_Ids[n] := id and 7Fh` { 5800:059f }.

### 5800:05B4 AddSpellLineCounted (H)
`procedure AddSpellLineCounted(id [BP+6]: Byte)` — RETF 2. Caller: BuildSpellList (modes 0, 5, 1, 4). New (AddSpellLine 0.50): the lines are kept sorted by level; a spell already in the list gets its copy count increased (`sl_Counts[n]`) and the line text `'  name (xN)'` instead of a second line.
```pascal
p := sl_List;                                                                          { 5800:05bb }
if p = nil then begin                                                                  { 5800:05c7 }
  FillChar(sl_Counts, $54, 0);  GetMem(p, $2E);  p^.next := nil;  sl_List := p;        { 5800:05d0 / 05e1 / 05ef / 05fc }
  prevLevel := 0;  n := 0;  sl_Counts[0] := 1;                                         { 5800:0608 .. 0614 }
end else begin
  n := 1;  prevLevel := 0;                                                             { 5800:061e / 0622 }
  while (p^.next <> nil) and (prevLevel <= SpellTable[id and $7F].level) do begin      { 5800:0626 .. 0647  insertion point }
    if (p^.header = 0) and (sl_Ids[n-1] <> id and $7F) then n := n + 1;                  { 5800:0649 .. 0667  sl_Ids is [0..83] at DS:4B9C: entry n-1 is the n-th line }
    p := p^.next;  prevLevel := SpellTable[sl_Ids[n]].level;                           { 5800:066c / 0678 }
  end;
  if sl_Ids[n-1] = id and $7F then begin                                                 { 5800:0696 }
    n := n - 1;  prevLevel := SpellTable[id and $7F].level;  sl_Counts[n] := sl_Counts[n] + 1;   { 5800:0747 .. 0764  same spell again }
  end else begin
    prevLevel := SpellTable[sl_Ids[n-1]].level;                                          { 5800:06af }
    GetMem(q, $2E);  q^.next := p^.next;  p^.next := q;  p := q;                       { 5800:06c9 .. 0707  insert after p }
    carry := 1;  for k := n to $53 do begin t := sl_Counts[k]; sl_Counts[k] := carry; carry := t end;   { 5800:070a .. 0745  shift the counts }
  end;
end;
if id < $80 then p^.text := '  ' else p^.text := ' *';                                 { 5800:0768 / 0783 / 076e }
p^.text := p^.text + SpellNames[id and $7F];  p^.header := 0;                          { 5800:0796 .. 07b8 / 07ba }
if sl_Counts[n] > 1 then p^.text := p^.text + ' (' + ByteToStr(sl_Counts[n]) + ')';    { 5800:07cd .. 0829 }
if sl_Ids[n] <> id and $7F then begin                                                  { 5800:082f }
  t := sl_Ids[n];  sl_Ids[n] := id and $7F;                                            { 5800:0844 / 0851 }
  for k := n + 1 to $53 do begin u := sl_Ids[k]; sl_Ids[k] := t; t := u end;           { 5800:0862 .. 0899  shift the ids }
end;
```

### 5800:08A1 AddItemSpells (H)
`procedure AddItemSpells(pendingOnly [BP+6]: Boolean)` — RETF 2. Callers: AddScrollSpells, BuildSpellList (mode 2). Pool: 8E00:044E (0.94). **changed:** the unread flag (`+35h`) is also cleared for a former cleric (`old_level[0] > old_level_cap`).
```pascal
if HasEffect(SelectedChar, $10, e) or                                                  { 5800:08a7 / 08be  Read Magic }
   (((ShortInt(SelectedChar^.level[0]) > 0) or (SelectedChar^.old_level_cap < SelectedChar^.old_level[0])) and (ItemTypeTable[ScrollItem^.itype].slot = $0C)) then   { 5800:08c0 .. 08f5  +109h, +E6h, +111h; g_5CF6: cleric scroll }
  ScrollItem^.identified := 0;                                                         { 5800:08f7  +35h }
if ScrollItem^.identified = 0 then                                                     { 5800:0900 }
  for k := 1 to 3 do                                                                   { 5800:0914 }
    if (pendingOnly and (ScrollItem^.special[k] > $80)) or (not pendingOnly and (ScrollItem^.special[k] <> 0)) then begin   { 5800:091a .. 0942 }
      AddSpellLine(ScrollItem^.special[k]);                                            { 5800:0944 }
      sl_Items[sl_ItemCount] := ScrollItem;  sl_ItemCount := sl_ItemCount + 1;         { 5800:0958 .. 0971 }
    end;
```

### 5800:0981 AddScrollSpells (H)
`procedure AddScrollSpells(pendingOnly [BP+6]: Boolean)` — RETF 2. Caller: BuildSpellList (modes 3, 6). Pool: 8E00:051C (0.91), same body (B-24): clears `sl_Items[0..30h]` and `sl_ItemCount` { 5800:0987 .. 09ab }, walks SelectedChar's items in `ScrollItem` { 5800:09b0 .. 09f4 }, IsScroll → AddItemSpells(pendingOnly) { 5800:09d4 / 09e0 }; `ScrollItem` ends nil.

### 5800:09FC BuildSpellList (H)
`function BuildSpellList(mode [BP+6]: Byte): Boolean` — RETF 2, entry e2. Caller: ov19 SpellList. Pool: 8E00:059C (0.59). **changed:** 84 memorised slots, 100 spell ids, every candidate passes SpellUsable, the counted lines (AddSpellLineCounted) and, for the counted modes, a level heading inserted before every level group at the end.
```pascal
headings := true;  Result := false;  sl_List := nil;                                   { 5800:0a02 / 0a02 / 0a06 }
for i := 0 to $53 do sl_Ids[i] := 0;                                                   { 5800:0a1b .. }
case mode of
  0: for i := 0 to $53 do                                                              { 5800:0a3d  memorised }
       if (SelectedChar^.mem_spell[i] <> 0) and SpellUsable(SelectedChar, id and $7F) and (id < $80) then AddSpellLineCounted(id);   { 5800:0a40 .. 0a97 }
  5: for i := 0 to $53 do                                                              { 5800:0aae  chosen, not yet memorised }
       if (id >= $80) and SpellUsable(SelectedChar, id and $7F) then AddSpellLineCounted(id);   { 5800:0ab1 .. 0af6 }
  1: for id := 1 to 100 do                                                             { 5800:0b0d  spell book }
       if (SelectedChar^.known_spell[id] <> 0) and SpellUsable(SelectedChar, id) then AddSpellLineCounted(id);   { 5800:0b10 .. 0b3b  +78h + id }
  2: begin AddItemSpells(false); headings := false end;                                { 5800:0b4c / 0b53 }
  3: begin AddScrollSpells(false); headings := false end;                              { 5800:0b5f / 0b66 }
  6: begin AddScrollSpells(true); headings := false end;                               { 5800:0b72 / 0b79 }
  4: for id := 1 to 100 do                                                             { 5800:0b8a  Learn: castable but unknown }
       if (SelectedChar^.spell_slots[SpellTable[id].class, SpellTable[id].level] <> 0) and SpellUsable(SelectedChar, id) and (SelectedChar^.known_spell[id] = 0) then AddSpellLineCounted(id);   { 5800:0b8d .. 0bef  +12Ch + class*5 + level }
end;
if sl_List <> nil then begin                                                           { 5800:0bf8 }
  if headings then begin                                                               { 5800:0c04 }
    n := 0;  level := SpellTable[sl_Ids[0]].level;                                     { 5800:0c0d / 0c11 }
    GetMem(h, $2E);  h^.next := sl_List;  sl_List := h;                                { 5800:0c2b .. 0c52  first heading }
    h^.text := LevelHeading[level];  h^.header := 1;                                   { 5800:0c56 / 0c7b }
    p := sl_List;                                                                      { 5800:0c8a }
    repeat
      prev := level;                                                                   { 5800:0c9f }
      if sl_Ids[n] <> 0 then level := SpellTable[sl_Ids[n]].level;                     { 5800:0ca5 / 0cb3 }
      if prev < level then begin                                                       { 5800:0ccd  new level group: heading before this line }
        GetMem(h, $2E);  h^.next := p^.next;  p^.next := h;  p := h;                   { 5800:0cd5 .. 0d0e }
        p^.text := LevelHeading[level];  p^.header := 1;                               { 5800:0d16 / 0d35 }
      end;
      n := n + 1;  p := p^.next;                                                       { 5800:0d3d / 0d40 }
    until p = nil;                                                                     { 5800:0d4f }
  end;
  Result := true;                                                                      { 5800:0d5a }
end;
```

### 5800:0D67 SpellRange (H)
`function SpellRange(spell [BP+6]: Byte): Byte` — RETF 2, entry e3. Callers: ov09, ov13 (aiming). Pool: 8E00:0729 (0.91), same body: `if ItemCast = 0 then r := range + rangePerLvl × SpellCasterLevel(spell) else r := range + rangePerLvl × 6` { 5800:0d6d / 0d78 .. 0dac }; `if (r = 0) and (area <> 0) then r := 1` { 5800:0de0 / 0df2 }; `if r = FFh then r := 1` { 5800:0dfc }.

### 5800:0E11 SpellDuration (H)
`function SpellDuration(spell [BP+6]: Byte): Word` — RETF 2. Callers: ApplySpell, Enlarge, Strength, HoldTargets, the item/monster powers. Pool: 8E00:07D6 (0.84), same special cases: 28h → Roll(1,6)×10 { 5800:0e27 }; 39h, 3Dh → Roll(5,4) { 5800:0e49 }; 3Bh → Roll(1,4)×10 + 40 { 5800:0e61 }; 3Fh → in combat Roll(2,10)×10 else (Roll(1,10) + 10)×10 { 5800:0e7b / 0e88 / 0e9f }; 43h → 1440 { 5800:0eb6 }; else `duration + durPerLvl × SpellCasterLevel(spell)` { 5800:0ec3 .. 0ef0 }.

### 5800:0F06 ApplySpell (H)
`procedure ApplySpell(spell [BP+12h], level [BP+10h], onRemove [BP+0Eh], damage [BP+0Ch], dmgType [BP+0Ah]: Byte; msg [BP+6]: string)` — RETF 10h. Callers: almost every handler. Pool: 8E00:08C3 (0.99), same body (B-25).
```pascal
s := msg;                                                                              { 5800:0f0c }
if damage = 0 then DamageType := 0 else DamageType := dmgType;                         { 5800:0f1f / 0f25 / 0f2c }
if SpellTargetCount = 0 then exit;                                                     { 5800:0f32 }
if level = 0 then level := SpellCasterLevel(spell);                                    { 5800:0f3c / 0f42 }
for k := 1 to SpellTargetCount do                                                      { 5800:0f56 }
  if SpellTargets[k] <> nil then begin                                                 { 5800:0f6e }
    t := SpellTargets[k];                                                              { 5800:0f86 }
    if SpellTable[spell].saveEffect = 0 then saved := false else saved := SavingThrow(t, SpellTable[spell].saveType, 0);   { 5800:0f9d / 0faf / 0fb5  g_37E2, g_37E3 }
    if SpellTable[sp_Current].range = $FF then begin                                   { 5800:0fd6  touch }
      RecalcItems(t);  CallEffectHooks($0B, t);                                        { 5800:0fe8 / 0ff3 }
      if not AttackRoll(SelectedChar, t, t^.ac) then begin damage := 0; saved := true end;   { 5800:1001 / 1021 .. 1025 }
    end;
    if damage <> 0 then DamageCharacter(t, damage, SpellTable[spell].saveEffect, saved);   { 5800:1029 / 102f }
    if SpellTable[spell].effect <> 0 then                                              { 5800:1052 }
      ApplyEffect(t, SpellTable[spell].effect, SpellDuration(spell), level, onRemove, SpellTable[spell].saveEffect, saved, s);   { 5800:1064 / 10a4 }
  end;
DamageType := 0;                                                                       { 5800:10b4 }
```

### 5800:10D2 SelectTargetsCamp (H)
`procedure SelectTargetsCamp(spell [BP+0Ch], auto [BP+0Ah]: Byte; var ok [BP+6]: Boolean)` — RETF 8, entry e4 (`SpellHandlers[0]` outside combat). Pool: 8E00:0A91 (0.87), same body.
```pascal
if sp_CampTarget = nil then sp_CampTarget := SelectedChar;                             { 5800:10d8 / 10e1 }
SpellTargets[1] := SelectedChar;  SpellTargetCount := 1;  ok := true;                  { 5800:10ee .. 10fb / 1100 }
case SpellTable[spell].targetMode of                                                   { 5800:1107  g_37E1 }
  1: ;                                                                                 { the caster }
  2: begin RedrawCurrentMode;                                                                  { 5800:1125 }
       SelectPartyCharacter('Cast Spell on whom', 1, sp_CampTarget);                              { 5800:1139 }
       if sp_CampTarget = nil then begin SpellTargets[1] := nil; SpellTargetCount := 0; ok := false end   { 5800:1146 / 114f .. 115c }
       else SpellTargets[1] := sp_CampTarget;                                          { 5800:1165 }
     end;
  4: begin SpellTargets[1] := PartyHead;                                               { 5800:1179 }
       while SpellTargets[SpellTargetCount]^.next <> nil do begin                      { 5800:1192 .. 11ab }
         SpellTargets[SpellTargetCount + 1] := SpellTargets[SpellTargetCount]^.next;  SpellTargetCount := SpellTargetCount + 1;   { 5800:11ad .. 11d7 }
       end;
     end;
  else ok := false;                                                                    { 5800:11df  combat-only spell }
end;
```

### 5800:1263 CastSpell (H)
`procedure CastSpell(spell [BP+0Eh], auto [BP+0Ch], announce [BP+0Ah]: Byte; var used [BP+6]: Boolean)` — RETF 0Ah, entry e5. Callers: ov08 PlayerTurn, ov09 AiCombatTurn, ov15 CastMenu, ov19 UseItem, ov05 TreasureMenu. Pool: 8E00:0C20 (0.90). **changed:** the combat-only text is `can't be cast here...`; a caster with effect 4Ah (M: silence/confusion) has a 50 % chance to `miscast` (the spell is lost unused); the announce text is `casts` through ShowCasts(c, text, spell).
```pascal
caster := SelectedChar;  again := true;                                                { 5800:1269 / 1275 }
if (view_Mode <> 5) and (SpellTable[spell].targetMode = 0) then begin                  { 5800:1279 / 1283  combat-only outside combat }
  if ItemCast = 0 then begin                                                           { 5800:1298 }
    DrawText(1, $13, 10, 0, SpellNames[spell]);                                        { 5800:129f }
    DrawText(1, $14, 10, 0, 'can''t be cast here...');                                 { 5800:12dd }
    if AskYesNo('Lose it? ', 13, 10, 15) = 'Y' then ForgetMemorizedSpell(caster, spell);          { 5800:12f1 / 1303 / 130d  ForgetMemorizedSpell }
  end else begin
    DrawText(1, $13, 10, 0, 'That Item');  DrawText(1, $14, 10, 0, 'is a combat-only item...');   { 5800:132f / 134f }
    if AskYesNo('Use it? ', 13, 10, 15) = 'Y' then used := true;                       { 5800:1363 / 1373 / 1375 }
  end;
  announce := 0;  again := false;                                                      { 5800:137c / 1380 }
end;
if HasEffect(caster, $4A, e) then                                                      { 5800:1384  new }
  if Roll(1, 2) = 1 then begin ShowCasts(caster, 'miscasts', spell); announce := 0; again := false end;   { 5800:139b / 13a6 / 13c4 / 13cc / 13d0 }
if (announce <> 0) and (ItemCast = 0) then ShowCasts(caster, 'casts', spell);          { 5800:13d4 / 13da / 13f6 }
while again do begin                                                                   { 5800:13fe }
  SpellHandlers[0](spell, auto, used);                                                 { 5800:1407  the target selector }
  if used then begin                                                                   { 5800:1418 }
    again := false;                                                                    { 5800:1424 }
    if view_Mode = 5 then begin                                                        { 5800:1428 }
      BuildFourAnimationFrames($12);                                                                  { 5800:1432  BuildFourAnimationFrames }
      col := CombatantCol(caster);  row := CombatantRow(caster);                       { 5800:143a / 1448 }
      dir := 0;  while not InFrontArc(col, row, SpellX, SpellY, dir) do dir := dir + 1;   { 5800:1453 / 145a .. 147a }
      combat_Visible := 1;  ShowCombatant(caster, dir, 1, 0);                          { 5800:147c / 1491  casting pose }
      if spell = $2F then PlayOrStopSound(g_25C2)                                      { 5800:1496 / 14a0  Fireball }
      else if spell = $33 then PlayOrStopSound(g_25BC)                                 { 5800:14ab / 14b0  Lightning Bolt }
      else PlayOrStopSound(g_25B0);                                                    { 5800:14bb }
      AnimateAlongPath(col, row, SpellX, SpellY, 4, $1E);                                     { 5800:14c4  AnimateAlongPath }
      if IsVisible(caster, 0) then begin                                               { 5800:14e3 }
        ShowCombatant(caster, cb^.facing, 1, 1);                                       { 5800:14f5  +9 }
        ShowCombatant(caster, cb^.facing, 0, 0);                                       { 5800:1513 }
      end;
    end;
    ov23_1569(caster);                                                                 { 5800:1531  BreakInvisibility }
    if ItemCast = 0 then ForgetMemorizedSpell(caster, spell);                                     { 5800:153c / 1543 }
    sp_Current := spell;  SpellHandlers[spell];  sp_Current := 0;  SpellArea := 0;     { 5800:1552 / 1558 / 1567 / 156c }
  end
  else if view_Mode <> 5 then again := false                                           { 5800:1573 / 157a }
  else if (auto <> 0) or (AskYesNo('Abort Spell? ', 14, 10, 15) = 'Y') then begin      { 5800:1580 / 1595 / 15a7 }
    ShowTimedBottomMessage('Spell Aborted');                                                        { 5800:15b6 }
    if ItemCast = 0 then ForgetMemorizedSpell(caster, spell);                                     { 5800:15bb / 15c2 }
    again := false;                                                                    { 5800:15d1 }
  end;
end;
ClearCharacterMessage;                                                                             { 5800:15d8 }
if view_Mode = 5 then ClearRectangle(0, $17, $27, $17);                                { 5800:15dd / 15e4 }
```

### 5800:15FB SetLine (M) — nested procedure of ConeTargets
`procedure SetLine(x1 [BP+0Eh], y1 [BP+0Ch], x2 [BP+0Ah], y2 [BP+8]: ShortInt)` (+ static link [BP+6]; parent's line record at `[BP−1Ch]`) — RETF 0Ah: stores the four coordinates as words into the line record and calls LineInit { 5800:1601 .. 162d / 1633 }.

### 5800:163E ClampXY (M) — nested procedure of ConeTargets
`procedure ClampXY(var col [BP+0Ch], row [BP+8]: ShortInt)` (+ static link [BP+6]) — RETF 0Ah: `col` clamped to 0..31h, `row` to 0..18h { 5800:1644 .. 1678 }.

### 5800:168B CollectLine (M) — nested procedure of ConeTargets
`procedure CollectLine` (static link [BP+6]; parent's line `[BP−1Ch]`, `hits[0..]` at `[BP−72h]`, `done [BP−1Dh]`) — RETF 2: steps the parent's line to its end (LineStep { 5800:169a }); for every square with an occupant (CellAt { 5800:16df }) the occupant index is appended to `hits` unless already present { 5800:16f4 .. 1735 }.

### 5800:175B ConeTargets (M)
`procedure ConeTargets(srcCol [BP+10h], srcRow [BP+0Eh], aimX [BP+0Ch], aimY [BP+0Ah]: ShortInt; width [BP+8], length [BP+6]: Byte)` — RETF 0Ch (pushes at 5800:4ac8: col, row, SpellX, SpellY, width, length). Callers: Spell_Fear (width 3, length 6), Cone of Cold (2, (level+1)/2), the cold cone 62h (1, 3), the breath handlers (1, 6 / 3, 9). New (LightningBolt 0.26 as nearest twin): builds `SpellTargets` from a cone that starts at the caster, points at the aim square and is `length` squares long: the centre line is traced step by step (orthogonal steps cost 2 half-squares, diagonal 3 { 5800:17d4 .. 1841 }), its end is clamped to the field (ClampXY { 5800:1891 }) and TraceLine'd { 5800:18b3 }; the combatants on the centre line are collected (CollectLine { 5800:18ea .. 197e }); with `width > 1` two side lines are drawn from the end square shifted by `BounceDX/DY[dir]` (`DS:0A10/0A18` and `DS:0A20/0A28`, indexed by the last step direction) and collected too { 5800:19a3 .. 1a3d }; `width > 2` adds the second pair { 5800:1a2a .. 1a3d }. Every hit combatant except the caster becomes a target { 5800:1a48 .. 1ab7 }.

### 5800:1ABF HoldTargets (H)
`procedure HoldTargets(bonus [BP+0Ah]: ShortInt; msg [BP+6]: string)` — RETF 6 (the bonus is pushed first: 5800:2436 / 2442). Callers: Spell_HoldPerson (17h/31h/5Eh), Spell_FaerieFire (0), Spell_CharmMonsters (0). Pool: 8E00:1658 (0.74). **changed:** a generic "apply to every target with a missile animation" (the per-target save bonus is a parameter); Hold Monsters (5Eh) affects any creature type.
```pascal
s := msg;                                                                              { 5800:1ac5 }
if SpellTargetCount = 0 then exit;                                                     { 5800:1ad8 }
for k := SpellTargetCount downto 1 do                                                  { 5800:1ae2 .. 1c2e }
  if SpellTargets[k] <> nil then begin                                                 { 5800:1aea }
    t := SpellTargets[k];                                                              { 5800:1b02 }
    if k < SpellTargetCount then begin                                                 { 5800:1b19  the others get a missile animation }
      PlayOrStopSound(g_25B0);  BuildFourAnimationFrames($12);                                        { 5800:1b22 / 1b2b }
      AnimateAlongPath(CombatantCol(SelectedChar), CombatantRow(SelectedChar), CombatantCol(t), CombatantRow(t), 4, $1E);   { 5800:1b33 .. 1b71 }
    end;
    if ((sp_Current = $4F) or (sp_Current = $51)) and (k = SpellTargetCount) then begin saved := true; negate := 1 end   { 5800:1b76 .. 1b8b / 1b8d / 1b91  Faerie Fire / Charm Monsters: first target auto }
    else begin saved := SavingThrow(t, SpellTable[sp_Current].saveType, bonus); negate := SpellTable[sp_Current].saveEffect end;   { 5800:1b97 / 1bb9 }
    if ((t^.creature_type > 1) or (t^.size > 1)) and (sp_Current <> $5E) then saved := true;   { 5800:1bcb .. 1be6 / 1be8  +11Ah, +DEh; not for Hold Monsters }
    ApplyEffect(t, SpellTable[sp_Current].effect, SpellDuration(sp_Current), SpellCasterLevel(sp_Current), 0, negate, saved, s);   { 5800:1bec .. 1c25 }
  end;
```

### 5800:1C39 ApplyToSide (H)
`procedure ApplyToSide(side [BP+0Ah]: Byte; msg [BP+6]: string)` — RETF 6 (side pushed first: 5800:1cff / 1d19). Callers: Spell_Bless, Spell_Curse. Pool: 8E00:0F4F (1.00), same body: drops the targets not on `side` (and, for Bless in combat, those with an enemy within 1 square: `CollectOppositeSideTargets(t, 1) <> 0` { 5800:1ca9 }) { 5800:1c57 .. 1ccd }; `SpellArea := 1` { 5800:1c52 }; ApplySpell(sp_Current, 0, 0, 0, 0, s) { 5800:1ce5 }.

## ov22 (seg 5800) — part B: the spell handlers, scroll helpers, InitSpellTable

Every handler is parameterless (RETF), is reached through `SpellHandlers[sp_Current]` from CastSpell and works on `SpellTargets[1..SpellTargetCount]` (`t` = `SpellTargets[1]`); H unless noted. Message routines: `ShowCharacterMessage(c, msg, 10, 1)` = character message, `ShowCombatMessageAnimation(c, 1, msg)` = message with the effect animation. The seven breath/gaze routines at the end are **effect handlers** (`EffectHandler[type](c, e, mode)`, COMBAT.pas.md ov23 CallEffectHandler) registered by InitSpellTable.

| ids | spell(s) | address | body |
|---|---|---|---|
| 01 | Bless | 5800:1CF9 | ApplyToSide(SelectedChar^.side, 'is Blessed') `{ 5800:1d19 }` |
| 02 | Curse | 5800:1D2A | ApplyToSide(IsSideZero(SelectedChar), 'is Cursed') `{ 5800:1d38 / 1d4e }` (the other side) |
| 03 | Cure Light Wounds | 5800:1D55 | if (SpellTargetCount <> 0) and HealCharacter(t, Roll(1, 8), 0) then ShowHealingResult(t) `{ 5800:1d58 / 1d6f / 1d78 / 1d89 }` (ShowHealingResult) |
| 04 | Cause Light Wounds | 5800:1D93 | ApplySpell(sp_Current, 0, 0, RollDice(1, 8), 8, '') `{ 5800:1da9 / 1dc2 }` (touch) |
| 05, 0B, 12, 16, 1D, 4D | Detect Magic ×3, Read Magic, Find Traps, Detect Invisibility | 5800:1DD5 | ApplySpell(sp_Current, 0, 0, 0, 0, 'is affected') `{ 5800:1dfb }` |
| 06, 07, 10, 11, 34, 35, 36, 45 | Protection from Evil / Good (+ 10' radius), Prot. from Normal Missiles | 5800:1E0F | ApplySpell(…, 'is protected') `{ 5800:1e35 }` |
| 08 | Resist Cold | 5800:1E4E | ApplySpell(…, 'is cold-resistant') `{ 5800:1e74 }` |
| 09 | Burning Hands | 5800:1E7C | ApplySpell(sp_Current, 0, 0, SpellCasterLevel(sp_Current), 9, '') `{ 5800:1e90 / 1ea9 }` |
| 0A | Charm Person | 5800:1EC9 | if (t^.creature_type < 2) and (t^.size < 2) then begin ApplySpell(sp_Current, SelectedChar^.side × 80h + SpellCasterLevel(sp_Current), 1, 0, 0, 'is charmed') `{ 5800:1edb .. 1f4f  +11Ah, +DEh }`; if HasEffect(t, 0Bh, e) then CallEffectHandler(0Bh, t, e, 0) `{ 5800:1f60 / 1f7d }` end else ShowCharacterMessage(t, 'is unaffected', 10, 1) `{ 5800:1f67 .. }` |
| 0C | Enlarge | 5800:1FA0 | sp_Str := 18; sp_StrExc := 0 `{ 5800:1fb2 / 1fb7 }`; by SpellCasterLevel `{ 5800:1fc0 .. 2042 }`: 1 → exc 0, 2 → 1, 3 → 51, 4 → 76, 5 → 91, 6 → 100, 7 → str 19, 8 → 20, 9 → 21, 10..11 → 22; if StrengthFromItem(t, sp_Str, sp_StrExc, code) `{ 5800:2055 }` then begin ShowCharacterMessage(t, 'is stronger', 10, 1) `{ 5800:2079 }`; AddEffect(t, 0Ch, SpellDuration(sp_Current), code, 1) `{ 5800:208c / 2097 }`; RecalcAbility(t, 0) `{ 5800:20a5 }` end else ShowCharacterMessage(t, 'is unaffected', 10, 1) `{ 5800:20c7 }` (**changed:** RecalcAbility instead of Pool's SetStrength) |
| 0D | Reduce | 5800:20E1 | if (t <> nil) and (SpellTargetCount <> 0) and not SavingThrow(t, 4, 0) `{ 5800:20f6 .. 210e }` and HasEffect(t, 0Ch, e) `{ 5800:2125 }` then begin RemoveEffect(t, 0Ch, nil); RecalcAbility(t, 0); ShowCharacterMessage(t, 'has been reduced', 10, 1) end `{ 5800:213d / 214b / 216b }` |
| 0E | Friends | 5800:2180 | ApplySpell(sp_Current, Roll(2, 4), 1, 0, 0, 'is friendly') `{ 5800:2190 / 21af }`; RecalcAbility(SelectedChar, 5) `{ 5800:21bd }` (**changed:** the CHA bonus is the effect's p3, applied by RecalcAbility) |
| 0F | Magic Missile | 5800:21C7 | n := (SpellCasterLevel(sp_Current) + 1) div 2 `{ 5800:21d1 .. 21ec }`; ApplySpell(sp_Current, 0, 0, RollDice(n, 4) + n, 8, '') `{ 5800:21f5 / 221f }` (**changed:** `(level + 1) div 2` missiles) |
| 13 | Shield | 5800:2232 | ApplySpell(…, 'is shielded') `{ 5800:2258 }` |
| 14 | Shocking Grasp | 5800:2260 | ApplySpell(sp_Current, 0, 0, RollDice(1, 8) + SpellCasterLevel(sp_Current), 0Ch, '') `{ 5800:2274 / 2282 / 22a0 }` |
| 15 | Sleep | 5800:22B4 | SpellArea := 1 `{ 5800:22ba }`; sp_Str := Roll(4, 4) (the budget) `{ 5800:22c5 }`; per target the cost by `level_main` (+E5h, signed): 0..1 → 1, 2 → 2, 3 → 4, 4 → 6, 5 → 10 (race 0) / 20, else 20 `{ 5800:22f0 .. 2351 }`; dropped when status = 1, effect 35h present or cost > budget, else budget −= cost `{ 5800:2361 .. 23be }`; ApplySpell(…, 'falls asleep') `{ 5800:23e3 }` |
| 17, 31, 5E | Hold Person (cleric / MU), Hold Monsters | 5800:23F2 | bonus by target count: 1 → −2 (17h) / −3, 2 → −1, 3..4 → 0 `{ 5800:23f8 .. 242e }` (uninitialised for 0 or ≥ 5 targets, B-28); HoldTargets(bonus, 'is held') `{ 5800:2442 }` |
| 18 | Resist Fire | 5800:245B | ApplySpell(…, 'is fire resistant') `{ 5800:2481 }` |
| 19 | Silence, 15' Radius | 5800:2494 | ApplySpell(…, 'is silenced') `{ 5800:24ba }` |
| 1A | Slow Poison | 5800:24CD | if t^.status = 1 then SpellTargets[1] := nil `{ 5800:24e2 / 24e8 }` else if HasEffect(t, 37h, e) `{ 5800:2502 }` then begin if t^.hp = 0 then t^.hp := 1 `{ 5800:250e / 2519 }`; ApplySpell(sp_Current, FFh, 1, 0, 0, 'is affected') `{ 5800:253f }`; CallEffectHandler(4Eh, t, nil, 1) `{ 5800:2554 }`; AddEffect(t, 0Fh, 10, FFh, 1) `{ 5800:256c }` end |
| 1B | Snake Charm | 5800:2580 | budget := SelectedChar^.hp `{ 5800:2586 }`; SpellTargetCount := 0; every party-list member with `creature_type = 0Eh` and hp ≤ budget becomes a target (budget −= hp) `{ 5800:2592 .. 25f5  +11Ah }`; ApplySpell(…, 'is charmed') `{ 5800:2627 }` |
| 1C | Spiritual Hammer | 5800:262F | ApplySpell(sp_Current, 0, 1, 0, 0, '') `{ 5800:2655 }`; CallEffectHandler(17h, t, nil, 0) `{ 5800:266c }` |
| 1E, 32 | Invisibility (10' radius) | 5800:2682 | ApplySpell(…, 'is invisible') `{ 5800:26a8 }` |
| 1F | Knock | 5800:26BB | ApplySpell(…, 'Knock-Knock') `{ 5800:26e1 }` |
| 20 | Mirror Image | 5800:26F6 | ApplySpell(sp_Current, Roll(1, 4) × 16 + SpellCasterLevel(sp_Current), 0, 0, 0, 'is duplicated') `{ 5800:2702 / 2715 / 2741 }` (**changed:** p3 = images × 16 + level) |
| 21 | Ray of Enfeeblement | 5800:2754 | ApplySpell(…, 'is weakened') `{ 5800:277a }` |
| 22 | Stinking Cloud | 5800:2799 | see Spell_StinkingCloud |
| 23 | Strength | 5800:2BF9 | see Spell_Strength |
| 24, 5A | Animate Dead | 5800:2DB6 | see Spell_AnimateDead |
| 25 | Cure Blindness | 5800:2F5E | if CureEffect(t, 21h) then ShowCombatMessageAnimation(t, 1, 'can see') `{ 5800:2f6f / 2f92 }` |
| 26 | Cause Blindness | 5800:2FA4 | ApplySpell(…, 'is blind') `{ 5800:2fca }` |
| 27 | Cure Disease | 5800:3076 | Spell_CureDisease `{ 5800:307d }` |
| 28 | Cause Disease | 5800:3093 | ApplySpell(sp_Current, 0, 1, 0, 0, 'is diseased') `{ 5800:30b9 }` |
| 29, 2E | Dispel Magic | 5800:317E | see Spell_DispelMagic |
| 2A | Prayer | 5800:352D | ApplySpell(sp_Current, SelectedChar^.side × 16 + SpellCasterLevel(sp_Current), 0, 0, 0, 'is praying') `{ 5800:353b / 356f }` |
| 2B, 59 | Remove Curse | 5800:3599 (stub e9, temple) | see Spell_RemoveCurse |
| 2C, 64 | Bestow Curse | 5800:36A7 | ApplySpell(…, 'has been cursed!') `{ 5800:36cd }` |
| 2D | Blink | 5800:36E0 | ApplySpell(…, 'is blinking') `{ 5800:3706 }` |
| 2F, 40 | Fireball (spell, wand) | 5800:370E | see Spell_Fireball |
| 30 | Haste | 5800:391D | HasteSlow(2Ah, SelectedChar^.side, 'is Hasted') `{ 5800:3940 }` |
| 33 | Lightning Bolt | 5800:3C98 | dmg := Roll(SpellCasterLevel(sp_Current), 6) `{ 5800:3ca2 / 3cab }`; BoltHitSquare(SpellX, SpellY, dmg, 4, 0, wall) `{ 5800:3ccb }`; LightningBolt(7, dmg, 4, 1) `{ 5800:3cdc }` (**changed:** length 7, Pool 8) |
| 37 | Slow | 5800:3CED | HasteSlow(27h, IsSideZero(SelectedChar), 'is Slowed') `{ 5800:3cfe / 3d14 }` |
| 38 | Restoration | 5800:3D27 | see Spell_Restoration |
| 39 | (potion: speed) | 5800:3EE2 | unless CureEffect(t, 2Ah) `{ 5800:3ef3 }`: ApplySpell(…, 'is Speedy') `{ 5800:3f1c }` (effect 27h) |
| 3A | Cure Serious Wounds | 5800:3F23 | if count <> 0 and HealCharacter(t, Roll(2, 8) + 1, 0) then ShowHealingResult(t) `{ 5800:3f3d / 3f49 / 3f5a }` |
| 3B | (item: giant strength) | 5800:3F6F | if StrengthFromItem(t, 21, 0, code) then ShowCharacterMessage(t, 'is stronger', 10, 1) `{ 5800:3f88 / 3fae }`; AddEffect(t, 92h, Roll(1, 4) × 10 + 40, code, 1) `{ 5800:3fc4 / 3fdb }`; RecalcAbility(t, 0) `{ 5800:3feb }` (**changed:** effect 92h, inline duration, no SpellDuration) |
| 3C | (lightning, wand/monster) | 5800:3FF4 | BoltHitSquare(SpellX, SpellY, Roll(1, 6) + 20, 4, 0, wall) `{ 5800:4008 / 401f }`; LightningBolt(3, 20, 4, 0) `{ 5800:402f }` |
| 3D | (paralysis) | 5800:4043 | ApplySpell(…, 'is paralyzed') `{ 5800:4069 }` |
| 3E | (potion of healing) | 5800:407A | if HealCharacter(t, Roll(2, 4) + 2, 0) then ShowCombatMessageAnimation(t, 1, 'is Healed') `{ 5800:408e / 409c / 40bf }` |
| 3F | (item invisibility) | 5800:40D5 | ApplySpell(…, 'is invisible') `{ 5800:40fb }` |
| 41 | (magic missile, wand) | 5800:4103 | ApplySpell(sp_Current, 0, 0, RollDice(2, 4) + 2, 8, '') `{ 5800:4119 / 4137 }` |
| 42 | Cause Serious Wounds | 5800:413F | ApplySpell(sp_Current, 0, 0, RollDice(2, 8) + 1, 8, '') `{ 5800:4155 / 4171 }` (touch) |
| 43 | Neutralize Poison | 5800:4194 | if t^.status = 1 then SpellTargets[1] := nil `{ 5800:41a9 / 41af }` else if HasEffect(t, 37h, e) `{ 5800:41ca }` then begin if t^.hp = 0 then t^.hp := 1 `{ 5800:41d6 .. }`; cure_InProgress := 1; RemoveEffect(t, 37h, nil); RemoveEffect(t, 16h, nil); RemoveEffect(t, 0Fh, nil); cure_InProgress := 0 `{ 5800:41ea .. 422b }`; ShowCharacterMessage(t, 'is unpoisoned', 10, 1) `{ 5800:424b }`; t^.active := 1; t^.status := 0 `{ 5800:4250 / 4259 }` end else ShowCharacterMessage(t, 'is unaffected', 10, 1) `{ 5800:427f }` |
| 44 | Poison | 5800:4289 | ApplySpell(sp_Current, 0, 0, 0, 8, '') `{ 5800:42af }`; tgt := SelectedChar^.cb^.target `{ 5800:42b2 }`; EffectToApply := 40h; CallEffectHooks(9, tgt) `{ 5800:42c7 / 42d5 }`; if EffectToApply = 40h then CallEffectHandler(40h, SelectedChar, e, 0) `{ 5800:42da / 42f5 }` (`e` is an uninitialised local, L — the handler of 40h runs the poison attack on the caster's target) |
| 46 | Sticks to Snakes | 5800:4311 | if ShortInt(t^.level_main) < 6 `{ 5800:4317  +E5h }` then begin ApplySpell(sp_Current, SpellCasterLevel(sp_Current), 0, 0, 8, '') `{ 5800:432b / 434a }`; if HasEffect(t, 3, e) then CallEffectHandler(3, t, e, 0) `{ 5800:435d / 437a }` end else ShowCharacterMessage(t, 'smashes them flat', 10, 1) `{ 5800:439e }` |
| 47 | Cure Critical Wounds | 5800:43A7 | if count <> 0 and HealCharacter(t, Roll(3, 8) + 3, 0) then ShowHealingResult(t) `{ 5800:43c1 / 43cf / 43e0 }` |
| 48 | Cause Critical Wounds | 5800:43EA | ApplySpell(sp_Current, 0, 0, RollDice(3, 8) + 3, 8, '') `{ 5800:4400 / 441e }` |
| 49 | Dispel Evil | 5800:4432 | ApplyEffect(SelectedChar, 4, SpellDuration(49h), 0, 0, 0, 0, '') `{ 5800:4447 / 4466 }`; ApplySpell(…, 'is affected') `{ 5800:448b }` |
| 4A | Flame Strike | 5800:4493 | ApplySpell(sp_Current, 0, 0, RollDice(6, 8), 9, '') `{ 5800:44a9 / 44c2 }` |
| 4B | Raise Dead | 5800:44D3 | if (t^.status in [6, 1]) and (t^.base_con <> 0) and (t^.race <> 2) `{ 5800:44e5 .. 4513  +18h, +74h: not for elves }` then begin cure_InProgress := 1; RemoveEffect(t, 20h, nil); RemoveEffect(t, 37h, nil); cure_InProgress := 0 `{ 5800:4518 .. 4545 }`; t^.status := 0; t^.active := 1; t^.base_con := t^.base_con − 1 `{ 5800:454a .. 455c }`; RecalcAbility(t, 4) `{ 5800:456c }`; t^.hp := 1 `{ 5800:4571 }`; ShowCharacterMessage(t, 'is raised', 10, 1) `{ 5800:4595 }` end |
| 4C | Slay Living | 5800:45B5 | DamageType := 40h; DamageAmount := 43h `{ 5800:45c7 / 45cc }`; CallEffectHooks(9, t) `{ 5800:45da }`; if DamageAmount = 0 then ShowCharacterMessage(t, 'is unaffected', 10, 1) `{ 5800:45df / 465c }` else if not SavingThrow(t, 4, 0) then KillCombatant(t, 6, 'is slain') `{ 5800:45f2 / 4613 }` else begin DamageType := 8; DamageCharacter(t, RollDice(2, 8) + 1, 0, 0) end `{ 5800:461a / 462b / 463a }` |
| 4E | Entangle | 5800:4672 | if Mem[4BE6] = 0 then for every target: saved := SavingThrow(t, 4, 0); ApplyEffect(t, 88h, SpellDuration(88h), 0, 0, 1, saved, 'is entangled') `{ 5800:4678 .. 470c }` |
| 4F | Faerie Fire | 5800:472C | HoldTargets(0, 'is highlighted') `{ 5800:4745 }` |
| 50 | Invisibility to Animals | 5800:4759 | ApplySpell(…, 'is invisible') `{ 5800:477f }` (effect 45h) |
| 51 | Charm Monsters | 5800:4791 | HoldTargets(0, 'is charmed') `{ 5800:47aa }`; for every target with HasEffect(t, 0Bh, e): CallEffectHandler(0Bh, t, e, 0) `{ 5800:47b0 .. 4805 }` |
| 52 | Confusion | 5800:4822 | n := Roll(2, 8); if n < SpellTargetCount then SpellTargetCount := n `{ 5800:482e / 4833 / 4839 }`; for every target: saved := SavingThrow(t, 4, 0); ApplyEffect(t, 23h, SpellDuration(52h), 0, 0, 1, saved, 'is confused') `{ 5800:484a .. 48c9 }` |
| 53 | Dimension Door | 5800:48E4 | if HasEffect(SelectedChar, 3Ah, e) `{ 5800:4904 }` then begin BuildTargetList(CombatantCol(c), CombatantRow(c), 1, FFh, 1, cm_Map) `{ 5800:4916 / 4922 / 493a }`; for every listed combatant holding the caster (effect 90h or 8Bh with `cb_Char[e^.p3] = SelectedChar`): RemoveEffect(t, 90h, nil); RemoveEffect(t, 8Bh, nil) `{ 5800:4954 .. 49f6 }` end; RestoreTerrain(0, 0, CombatantIndex(c)) `{ 5800:4a07 / 4a0d }`; ok := PlaceCombatant(c, SpellX, SpellY, 0) `{ 5800:4a23 }`; FocusSquare(CombatantCol(c), CombatantRow(c), 0, 8) `{ 5800:4a31 .. 4a49 }`; ShowCharacterMessage(c, 'teleports', 10, 1) `{ 5800:4a69 }` |
| 54 | Fear | 5800:4A8F | ConeTargets(CombatantCol(c), CombatantRow(c), SpellX, SpellY, 3, 6) `{ 5800:4aa7 / 4ab3 / 4ac8 }`; for every target: saved := SavingThrow(t, 4, 0) `{ 5800:4b06 }`; if not saved then begin ApplyEffect(t, 8Eh, SpellDuration(54h), 1, 1, 0, saved, 'runs in terror') `{ 5800:4b21 / 4b41 }`; cb(t)^.fleeing := 1; t^.controlled := 1; if t^.npc_morale < 80h then t^.npc_morale := B3h; cb(t)^.target := nil `{ 5800:4b46 .. 4b82  +10h, +198h, +F7h, +0Ah }` end else ShowCharacterMessage(t, 'is unaffected', 10, 1) `{ 5800:4b9f }` |
| 55 | Fire Shield | 5800:4BEC | repeat: PC → key := HorizontalMenu('flame type: ', 'Hot Cold', 13, 10, 15, 0, 0, ext) `{ 5800:4c4f }`; computer → if Roll(1, 10) < 6 then 'C' else 'H' `{ 5800:4c08 / 4c0f .. 4c1b }`; 'H': ApplyEffect(SelectedChar, 32h, SpellDuration(55h), 0, 0, 0, 0, 'is protected') + ApplyEffect(SelectedChar, 8Fh, SpellDuration(55h), 0, 0, 0, 0, '') `{ 5800:4c6d / 4c8c / 4ca0 / 4cbf }`; 'C': the same with 36h `{ 5800:4cde / 4cfd / 4d11 / 4d30 }`; else HorizontalMenu('Abort spell? ', 'Yes No', …) = 'Y' ends `{ 5800:4d6d / 4d79 }` until done |
| 56 | Fumble | 5800:4DA0 | DamageType := 40h `{ 5800:4db2 }`; if not SavingThrow(t, 4, 0) `{ 5800:4dc3 }` then begin ApplyEffect(t, 1Bh, SpellDuration(56h), 0, 0, 0, 0, 'is clumsy') `{ 5800:4dd9 / 4df8 }`; if HasEffect(t, 1Bh, e) then CallEffectHandler(1Bh, t, nil, 0) `{ 5800:4e0b / 4e26 }` end else begin ApplyEffect(t, 2Ah, SpellDuration(56h), 0, 0, 0, 0, 'is slowed') `{ 5800:4e3a / 4e59 }`; if HasEffect(t, 2Ah, e) then CallEffectHandler(2Ah, t, nil, 0) `{ 5800:4e6c / 4e87 }` end; ApplySpell(sp_Current, 0, 1, 0, 0, 'is clumsy') `{ 5800:4eac }` |
| 57 | Ice Storm | 5800:4EB4 | ApplySpell(sp_Current, 0, 0, RollDice(3, 10), 10, '') `{ 5800:4eca / 4ee3 }` |
| 58 | Minor Globe of Invulnerability | 5800:4EF7 | ApplySpell(…, 'is protected') `{ 5800:4f1d }` (effect 3Fh) |
| 5B | Cloud Kill | 5800:4F3E | see Spell_CloudKill |
| 5C | Cone of Cold | 5800:54EB | n := (SpellCasterLevel + 1) div 2, at least 1 `{ 5800:5501 / 550d .. 5524 }`; ConeTargets(CombatantCol(c), CombatantRow(c), SpellX, SpellY, 2, n) `{ 5800:552e / 553a / 5550 }`; ApplySpell(sp_Current, 0, 0, SpellCasterLevel + RollDice(SpellCasterLevel, 4), 10, '') `{ 5800:5564 / 5588 }` |
| 5D | Feeblemind | 5800:5590 | saved := t^.save[4] `{ 5800:55a2  +E3h }`; by t^.class (+75h): 0 → save − 1, 5 → + 4, else + 2 `{ 5800:55ad .. 55d1 }`; ApplySpell(…, '') `{ 5800:55fa }`; if HasEffect(t, 44h, e) then CallEffectHandler(44h, t, e, 0) `{ 5800:560b / 5626 }`; t^.save[4] := saved `{ 5800:562e }` |
| 5F, 60, 61 | (item powers: effects 49h, 6Dh, 19h) | 5800:563B / 5669 / 5697 | ApplySpell(…, '') `{ 5800:5661 / 568f / 56bd }` |
| 62 | (breath: cold cone) | 5800:56C4 | ConeTargets(CombatantCol(c), CombatantRow(c), SpellX, SpellY, 1, 3) `{ 5800:56dc / 56e8 / 56fd }`; for every target: DamageCharacter(t, RollDice(6, 6), DS:3E02 (= 1), t^.creature_type <> 12h) `{ 5800:5762 / 5770 }` |
| 63 | (potion of healing) | 5800:578B | if HealCharacter(t, Roll(2, 4) + 2, 0) then ShowCombatMessageAnimation(t, 1, 'is Healed') `{ 5800:579f / 57ad / 57d0 }` |
| E56 | effect handler: Spit Acid | 5800:5974 | see the effect handlers |
| E58 | effect handler: Breath weapon (lightning type) | 5800:57E3 | see the effect handlers |
| E5A / E80 / E83 / E84 / E7E | acid cone / fire cone / short fire breath / lightning / paralysing gaze | 5800:5AA8 / 5C86 / 5E11 / 5F2F / 6022 | see the effect handlers |

### 5800:2799 Spell_StinkingCloud (M)
One routine 2799..2BF8. Pool: 8E00:1B11 (0.50). Cloud records (`cloud_List{g_755B}`, 1Eh bytes, linked at +4): `+0 caster`, `+4 next`, `+8..+0Bh saved tile of square k`, `+10h..+13h placed flag`, `+1Ah col`, `+1Bh row`, `+1Ch index of this caster's cloud`, `+1Dh dispel-tried` (Dispel Magic). Squares k = 1..4 at `aim + (step_dx/dy[CloudSquareDir[k]])` (DS:27D7: 08 02 03 04 = the aim square, E, SE, S).
```pascal
SpellArea := 1;  lvl := SpellCasterLevel(sp_Current);  n := 0;                         { 5800:279f / 27a8 / 27ad }
if cloud_List = nil then begin GetMem(cloud_List, $1E); r := cloud_List end            { 5800:27c0 / 27c9 / 27d7 }
else begin
  r := cloud_List;                                                                     { 5800:27b4 }
  while r^.next <> nil do begin if r^.caster = SelectedChar then n := n + 1; r := r^.next end;   { 5800:27e5 .. 2818  (the last record is not counted, B-31) }
  GetMem(r^.next, $1E);  r := r^.next;                                                 { 5800:281a / 282c }
end;
FillChar(r^, $1E, 0);                                                                  { 5800:283b }
AddEffect(SelectedChar, $28, lvl, lvl + n * 16, 1);                                    { 5800:284c }
r^.caster := SelectedChar;  r^.index := n;  r^.col := SpellX;  r^.row := SpellY;       { 5800:2879 .. 28a0 }
for k := 1 to 4 do begin                                                               { 5800:28a7 }
  d := CloudSquareDir[k];                                                                  { 5800:28b0 }
  CellAt(SpellX + step_dx[d], SpellY + step_dy[d], occ[k], tile);                      { 5800:28be }
  r^.placed[k] := Ord((tile <> 0) and (CombatTerrain[tile].cost <> $FF));              { 5800:2904 / 2916 / 291b / 2927 }
  if tile = $1E then                                                                   { 5800:2936  another cloud: take its saved tile }
    for every other record q covering that square: tile := q^.saved[j]                 { 5800:293f .. 2a33 }
  else if (tile = $1F) and (corpse_Count <> 0) then                                    { 5800:2a39 / 2a42  a corpse: its ground tile }
    for j := 1 to corpse_Count do if corpse_List[j].x/y = the square then tile := corpse_List[j].tile;   { 5800:2a57 .. 2ac6  7-byte records g_6E52: +4 x, +5 y, +6 tile }
  r^.saved[k] := tile;                                                                 { 5800:2ac8 }
  if r^.placed[k] <> 0 then cm_Map^.grid[row * 50 + col] := $1E;                       { 5800:2ad9 / 2aea  cloud ground }
end;
ShowCharacterMessage(SelectedChar, 'Creates a noxious cloud', 10, 0);                             { 5800:2b46 }
FocusSquare(SpellX, SpellY, $FF, 8);  MessageDelay;  ClearCharacterMessage;                        { 5800:2b51 / 2b64 / 2b69 }
for k := 2 to 4 do for j := 1 to 4 do if (occ[k] = occ[j]) and (k <> j) then occ[k] := 0;   { 5800:2b6e .. 2bbb  one check per combatant }
for k := 1 to 4 do if occ[k] <> 0 then StinkingCloudCheck(cb_Char[occ[k]], 1);          { 5800:2bc0 .. 2bf3 }
```

### 5800:2BF9 Spell_Strength (H)
Pool: 8E00:1F41 (0.71). **changed:** the roll class tests include the former classes (`old_level[k] > old_level_cap`); the strength increase is stored as effect 26h with p3 = roll + 100 (a strength code) and applied by RecalcAbility.
```pascal
exc := 0;  t := SpellTargets[1];                                                       { 5800:2bff / 2c03 }
if (ShortInt(t^.level[5]) > 0) or (t^.old_level_cap < t^.old_level[5]) then roll := Roll(1, 4);   { 5800:2c0f .. 2c2a / 2c32  magic-user }
if (ShortInt(t^.level[0]) > 0) or (t^.old_level_cap < t^.old_level[0]) or (ShortInt(t^.level[6]) > 0) or (t^.old_level_cap < t^.old_level[6]) then roll := Roll(1, 6);   { 5800:2c3a .. 2c72 / 2c7a  cleric, thief }
if (ShortInt(t^.level[2]) > 0) or (t^.old_level_cap < t^.old_level[2]) then roll := Roll(1, 8);   { 5800:2c82 .. 2c9d / 2ca5  fighter (B-29: roll undefined without a class) }
s := t^.str + roll;                                                                    { 5800:2cad  +11h }
if s > 18 then                                                                         { 5800:2cc2 }
  if no current or former fighter / paladin / ranger level (level[2..4], old_level[2..4] vs old_level_cap) then s := 18   { 5800:2ccb .. 2d20 / 2d31 }
  else begin exc := t^.str_exc + (s - 18) * 10; if exc > 100 then exc := 100; s := 18 end;   { 5800:2d22 .. 2d4f  +1Ch }
if StrengthFromItem(t, s, exc, code) then begin                                        { 5800:2d53 / 2d6d }
  code := roll + 100;                                                                  { 5800:2d6f }
  AddEffect(t, $26, SpellDuration(sp_Current), code, 1);                               { 5800:2d7a / 2d93 }
  RecalcAbility(t, 0);                                                                 { 5800:2d98 }
end;
```

### 5800:2DB6 Spell_AnimateDead (H)
Pool: 8E00:206F (0.96), same body with the Curse offsets (`creature_type +11Ah`, `undead_type +E9h := 2`, `fighter_lvl_eff +DDh := 0`, `base_move +E4h := 6`, 84 spell slots cleared, `ai_mode` folded into `controlled +198h`).
```pascal
SpellArea := 1;  budget := SpellCasterLevel(sp_Current);  SpellTargetCount := 0;       { 5800:2dbc / 2dc1 / 2dcd }
c := PartyHead;                                                                        { 5800:2dd2 }
while (c <> nil) and (budget <> 0) do begin                                            { 5800:2dde .. 2ded }
  if (c^.status = 6) and (c^.creature_type = 0) then                                   { 5800:2df2 / 2e00 }
    if PlaceCombatant(c, CombatantCol(c), CombatantRow(c), 1) then begin               { 5800:2e0e / 2e26 / 2e2f }
      p3 := c^.side * 16 + SpellCasterLevel(sp_Current);                               { 5800:2e3b .. 2e48 }
      c^.side := SelectedChar^.side;  c^.controlled := 1;  c^.undead_type := 2;        { 5800:2e5b .. 2e75 }
      c^.fighter_lvl_eff := 0;  c^.base_move := 6;  FillChar(c^.mem_spell, 84, 0);     { 5800:2e7e / 2e87 / 2e96 .. 2eac }
      if c^.npc_morale < $80 then c^.npc_morale := $B3 else c^.npc_morale := $B2;      { 5800:2eae .. 2ecd }
      c^.creature_type := 4;                                                           { 5800:2ecd }
      if view_Mode = 5 then cb(c)^.target := nil;                                      { 5800:2ed6 / 2edd }
      budget := budget - 1;                                                            { 5800:2eef }
      if ReviveCombatant(c, c^.maxhp) then begin                                       { 5800:2ef2 / 2f09 }
        ApplyEffect(c, $20, 0, p3, 1, 0, false, 'is animated');  c^.status := 1;       { 5800:2f31 / 2f36 }
      end;
    end;
  c := c^.next;                                                                        { 5800:2f3f }
end;
```

### 5800:2FD1 Spell_CureDisease (H)
`function Spell_CureDisease: Boolean` — RETF. Callers: the 27h wrapper, (not used by the items in Curse). Pool: 8E00:228A (1.00): `cure_InProgress := 1` { 5800:2fd7 }; a := CureEffect(t, 22h) { 5800:2feb }; if CureEffect(t, 2Bh) { 5800:3003 } then RemoveEffect(t, 2Ch, nil), RemoveEffect(t, 1Fh, nil) { 5800:3021 / 3037 }; if CureEffect(t, 32h) { 5800:3047 } then RemoveEffect(t, 39h, nil) { 5800:3065 }; Result = any; `cure_InProgress := 0`.

### 5800:30C0 DispelChance (M) — nested function of Spell_DispelMagic
`function DispelChance(caster [BP+8]: PChar): Boolean` (+ static link [BP+6]; parent's `lvl` at `[BP−2]`) — RETF 6. The cloud caster's effective magic-user level `level[5] + old_level[5] × DualClass(SelectedChar)` (quirk: DualClass of the *dispelling* character) { 5800:30c6 .. 30e1 }; chance 50 + 5 × (lvl − el) when el < lvl, 50 − 2 × (el − lvl) when el > lvl, else 50 { 5800:30ee .. 3138 }; Result := Roll(1, 100) ≤ chance { 5800:3155 / 315a }.

### 5800:317E Spell_DispelMagic (M)
Pool: 8E00:2385 (0.45). **changed:** after the effects, the 3×3 squares around the aim are searched for clouds (stinking cloud tile 1Eh, cloudkill 1Ch) and each cloud is dispelled by DispelChance against its caster.
```pascal
SpellArea := 1;  lvl := SpellCasterLevel(sp_Current);                                  { 5800:3184 / 318d }
for k := 1 to SpellTargetCount do begin                                                { 5800:3195 .. }
  t := SpellTargets[1];  dispelled := false;                                           { 5800:31b1 / 31ad  always the first target (as Pool) }
  e := t^.effects;                                                                     { 5800:31bd }
  while e <> nil do begin                                                              { 5800:31cd }
    nx := e^.next;                                                                     { 5800:31d8 }
    if e^.p3 <> $FF then begin                                                         { 5800:31e7 }
      el := e^.p3 and $0F;                                                             { 5800:31f4  sp_StrExc }
      if el < lvl then chance := 50 + (lvl - el) * 5 else if el > lvl then chance := 50 - (el - lvl) * 2 else chance := 50;   { 5800:3200 .. 3249  sp_Str }
      if Roll(1, 100) <= chance then begin RemoveEffect(t, e^.type, e); dispelled := true end;   { 5800:324e / 325f / 3272 / 3277 }
    end;
    e := nx;                                                                           { 5800:327b }
  end;
  if dispelled then ShowCombatMessageAnimation(t, 1, 'is affected');                                    { 5800:3289 / 32a7 }
end;
for d := 0 to 8 do begin                                                               { 5800:32b7 .. 3514  gfx_LoopCounter: the 3×3 around the aim }
  case d of 0: (x, y) := (SpellX, SpellY); 1: y := SpellY − 1; 2: x := SpellX + 1; 3: y := SpellY; 4: y := SpellY + 1; 5: x := SpellX; 6: x := SpellX − 1; 7: y := SpellY; 8: y := SpellY − 1 end;   { 5800:32c2 .. 3349 }
  CellAt(x, y, occ, tile);                                                             { 5800:3349 }
  if tile in [$1C, $1E] then begin                                                     { 5800:3360 / 336c }
    if tile = $1C then begin list := cloud9_List; squares := 9 end else begin list := cloud_List; squares := 4 end;   { 5800:336f .. 3390 }
    for every record q in list, square j = 1..squares covering (x, y) with q^.dispelTried = 0:   { 5800:3397 .. 3432  +1Ah/+1Bh + CloudDirs, +1Dh }
      if not DispelChance(q^.caster) then q^.dispelTried := 1                          { 5800:342c / 3434 / 34bb }
      else begin                                                                       { find the caster's cloud effect with p3 div 16 = q^.index }
        e := q^.caster^.effects;                                                       { 5800:3437 }
        found := false;                                                                { 5800:344a }
        while (e <> nil) and not found do                                              { 5800:344e / 3456 }
          if ((e^.type = $5B) and (tile = $1C) or (e^.type = $28) and (tile = $1E)) and (e^.p3 div 16 = q^.index) then found := true   { 5800:345c .. 3498 }
          else e := e^.next;                                                           { 5800:349e }
        if found then                                                                  { 5800:34af }
          if tile = $1C then RemoveEffect(q^.caster, $5B, e)                           { 5800:34b5 / 34ce }
          else RemoveEffect(q^.caster, $28, e);                                        { 5800:34d5 }
      end;
  end;
end;
```

### 5800:3599 Spell_RemoveCurse (H)
Pool: 8E00:2540 (0.79), entry e9 (ov04 temple). **changed:** the cursed item is unreadied (`ready := 0`) and its hook run (`item_HookMode`, CallEffectHandler(special[3], t, item, 1)) with all six abilities recalculated; the `cursed` byte is **not** cleared.
```pascal
if CureEffect(t, $24) then ShowCombatMessageAnimation(t, 1, 'is un-cursed')                             { 5800:359f / 35b3 / 35cd }
else begin
  found := false;  it := t^.items;                                                     { 5800:35d5 / 35d9 }
  while (it <> nil) and not found do begin                                             { 5800:35ea .. 35f6 }
    if it^.cursed <> 0 then begin                                                      { 5800:35f8  +36h }
      found := true;  it^.ready := 0;                                                  { 5800:3602 / 3606  +34h }
      if it^.special[3] >= $80 then begin                                              { 5800:360e }
        item_HookMode := 1;  CallEffectHandler(it^.special[3], t, it, 1);              { 5800:3618 / 3636 }
        for n := 0 to 5 do RecalcAbility(t, n);                                        { 5800:3655 .. 3659 }
      end;
    end;
    it := it^.next;                                                                    { 5800:365b }
  end;
  if found then ShowCombatMessageAnimation(t, 1, 'has an item un-cursed');                              { 5800:366d / 368d }
end;
```

### 5800:370E Spell_Fireball (H)
Pool: 8E00:266B (0.96), same body.
```pascal
SpellArea := 1;                                                                        { 5800:3714 }
if sp_Current = $40 then dice := Roll(1, 3) * 2 + 1 else dice := SpellCasterLevel(sp_Current);   { 5800:3719 / 3720 / 3735  wand: 3, 5 or 7 dice }
if Mem[4BE6] = 0 then begin                                                            { 5800:3741  area flag: keep the aimed list }
  BuildTargetList(SpellX, SpellY, 2, $FF, 1, cm_Map);                                  { 5800:374d }
  for k := 1 to tg_Count do SpellTargets[k] := cb_Char[tg_List[k].who];                { 5800:376c .. 37b8  cm_Map^[k*3 + 2] }
  SpellTargetCount := tg_Count;                                                        { 5800:37ba }
end;
FocusSquare(SpellX, SpellY, 0, 8);                                                     { 5800:37c0 }
ApplySpell(sp_Current, 0, 0, RollDice(dice, 6), 9, '');                                { 5800:37d3 / 37fd }
```

### 5800:3804 HasteSlow (H)
`procedure HasteSlow(cancels [BP+0Ch], side [BP+0Ah]: Byte; msg [BP+6]: string)` — RETF 8. Callers: Haste, Slow. Pool: 8E00:2764 (0.96), same body: `SpellArea := 1` { 5800:381d }; budget := SpellCasterLevel { 5800:3826 }; targets of `side` while budget > 0 (budget −1 each) { 5800:3851 .. 3863 }; a target with the opposite effect only loses it (CureEffect(t, cancels) → dropped) { 5800:387f / 3886 }; others dropped { 5800:389f }; ApplySpell(sp_Current, 0, 0, 0, 0, s) { 5800:38d2 }; CallEffectHooks(12h, t) for every target { 5800:38d5 .. 390b }.

### 5800:3947 BoltHitSquare (H)
`procedure BoltHitSquare(col [BP+12h], row [BP+10h], dmg [BP+0Eh], saveType [BP+0Ch], skip [BP+0Ah]: Byte; var wall [BP+6]: Boolean)` — RETF 0Eh. Callers: Spell_LightningBolt, LightningBolt, the 3Ch power, the breath handlers. Pool: 8E00:28BC (0.86). **changed:** `skip` (an occupant index not to hit again) and the wall flag only in 3D areas (`Mem[4BE6] = 1`) and only once (`wall` must be false on entry).
```pascal
CellAt(col, row, tile, occ);                                                           { 5800:394d  (var tile, var occ) }
wall := (tile <> 0) and (CombatTerrain[tile].cost = $FF) and (Mem[4BE6] = 1) and not wall;   { 5800:396a .. 3998 / 399a }
if (occ <> 0) and (occ <> skip) then begin                                             { 5800:39a1 / 39af }
  DamageType := $0C;                                                                   { 5800:39c6 }
  DamageCharacter(cb_Char[occ], dmg, 2, SavingThrow(cb_Char[occ], saveType, 0));       { 5800:39cb / 39eb }
  BuildFourAnimationFrames($13);  DamageType := 0;                                                    { 5800:39f0 / 39f8 }
end;
```

### 5800:3A03 LightningBolt (M)
`procedure LightningBolt(length [BP+0Ch], dmg [BP+0Ah], saveType [BP+8]: Byte; mayBounce [BP+6]: Boolean)` — RETF 8. Callers: Spell_LightningBolt (7), the 3Ch power (3), the breath handlers (10). Pool: 8E00:295B (0.92), same geometry (M): animation frames 13h { 5800:3a10 }; the aim square's occupant is read (CellAt) { 5800:3a27 }; nothing happens when the aim is the caster's own square { 5800:3a61 / 3a6a }; `left := length × 2`, `SpellArea := 1` { 5800:3a72 / 3a79 }; a line from the aim square away from the caster (`aim + (aim − caster) × dirSign × left`, LineInit/LineStep { 5800:3a98 .. 3b21 }) is followed while the square is free or holds the previous occupant, is on the field and its terrain cost < 2, and the step count stays below `left` { 5800:3b3b .. 3b88 }; off the field ends the bolt { 5800:3b8e }; each segment is animated (AnimateAlongPath(prev, cur, 4, 32h)) { 5800:3baa } and BoltHitSquare(cur, dmg, saveType, prevOcc, wall) { 5800:3bc9 }; a wall reflects: the aim becomes the wall square, a line back towards the caster is traced to its end { 5800:3bd6 .. 3c20 }, `mayBounce` with fewer than 9 steps adds 8 half-squares once { 5800:3c2f / 3c35 / 3c3b }, the direction sign flips and `mayBounce` is cleared { 5800:3c45 .. 3c4c }; `left` is reduced by the steps taken { 5800:3c67 .. 3c78 }; until no wall or `left = 0` { 5800:3c7f / 3c85 }; `SpellArea := 0` { 5800:3c8d }.

### 5800:3D27 Spell_Restoration (H)
Pool: 8E00:2C43 (0.94), same algorithm (B-30) with the Curse offsets: `levels_drained +E7h`, `hp_drained +E8h`, `maxhp +78h`, `hp +1A4h`, `maxhp_base +12Ch`, levels `+109h + j`, XP thresholds `XpTable{g_4291}[j*99 + (level+1)*4]` (LongInt, M), RacialLevelLimitReached = RacialLevelLimitReached(c, j) { 5800:3e30 }, UpdateLevelStats = UpdateLevelStats(c) { 5800:3eaf }, message 'is restored' { 5800:3ecf }.
```pascal
if t^.levels_drained <> 0 then begin                                                   { 5800:3d39 }
  n := t^.hp_drained div t^.levels_drained;                                            { 5800:3d47 }
  t^.maxhp := t^.maxhp + n;  t^.hp := t^.hp + n;  t^.maxhp_base := t^.maxhp_base + n;  { 5800:3d63 .. 3d7b }
  t^.hp_drained := t^.hp_drained - n;  t^.levels_drained := t^.levels_drained - 1;     { 5800:3d83 / 3d8e }
  best := 13;  bestXp := 10000000;  pick := (undefined);                               { 5800:3d9a .. 3da4 }
  for j := 0 to 7 do begin                                                             { 5800:3da4 }
    lv := t^.level[j];                                                                 { 5800:3dad }
    if (lv > 0) and (lv <= best) then                                                  { 5800:3dbe / 3dcf }
      if (XpTable[j, lv + 1] > 0) and (XpTable[j, lv + 1] < bestXp) and not RacialLevelLimitReached(t, j) then begin   { 5800:3dd2 .. 3e24 / 3e30 }
        best := lv;  pick := j;  bestXp := XpTable[j, lv + 1];                         { 5800:3e3f .. 3e62 }
      end;
  end;
  t^.level[pick] := t^.level[pick] + 1;                                                { 5800:3e73 }
  if t^.xp < bestXp then t^.xp := bestXp;                                              { 5800:3e81 .. 3e9c  +127h }
  UpdateLevelStats(t);                                                                        { 5800:3ea9 }
  ShowCharacterMessage(t, 'is restored', 10, 1);                                                  { 5800:3ec9 }
end;
```

### 5800:4F3E Spell_CloudKill (M)
New (Spell_StinkingCloud's twin, 0.41): the same construction on `cloud9_List{g_755F}` with nine squares (`CloudDirs9` DS:27DB: the aim and its eight neighbours; records: `+8..+10h saved tiles`, `+11h..+19h placed`), effect 5Bh on the caster { 5800:5019 }, cloud ground tile 1Ch { 5800:53f5 / 545c }, saved tiles taken from stinking clouds (list 1, 4 squares) and other cloudkills (list 2, 9 squares) { 5800:50e8 .. 5310 } or corpses { 5800:531e .. 53a2 }; message 'Creates a poisonous cloud' { 5800:5486 }; FocusSquare(SpellX, SpellY, FFh, 8); MessageDelay; ClearCharacterMessage { 5800:5499 .. 54a3 }; StinkingCloudCheck(cb_Char[occ[k]], 1) for the nine occupants { 5800:54ae .. 54e4 } (no duplicate filter).

### Effect handlers of ov22 (`EffectHandler[type](c [BP+0Ch]: PChar; e [BP+8]: PEffect; mode [BP+6]: Byte)`, RETF 0Ah)

### 5800:57E3 EffBreathWeapon (H) — effect 58h
Pool: 8E00:30D9 BreathWeapon (0.98), same body (B-27): on round 0 or with a 50 % roll { 5800:57e9 / 57f6 }: `DamageType := 24h` { 5800:5802 }; ShowCharacterMessage(c, 'Breathes!', 10, 1) { 5800:583e }; SpellHandlers[0](33h, 1, g_7746) { 5800:584e } (aim as for Lightning Bolt); the aim moves one square away from the breather (Sign { 5800:585f / 587c }; one more step when the new coordinate equals the breather's + 1 { 5800:5893 .. 58ae }); ov23_1569(c) { 5800:58b8 }; BuildFourAnimationFrames(13h) { 5800:58c0 }; AnimateAlongPath(col, row, SpellX, SpellY, 4, 32h) { 5800:58df }; BoltHitSquare(SpellX, SpellY, c^.maxhp, 3, 0, wall) { 5800:5900 }; LightningBolt(10, c^.maxhp, 3, 0) { 5800:5915 }; if e^.p3 < FEh then RemoveEffect(c, 58h, e) else e^.p3 := e^.p3 − 1 { 5800:5918 .. 593a }; ClearCombatantActionFlags(c) { 5800:5945 }.

### 5800:5974 EffSpitAcidRanged (M) — effect 56h
New. SpellHandlers[0](41h, 1, g_7746) { 5800:5985 }; hold_Victim := cb(c)^.target { 5800:5989 .. 599a }; roll := Roll(1, 100) { 5800:59a4 }; if (Distance(hold_Victim, c) < 7) and (hold_Victim <> nil) { 5800:59ba .. 59cd }: roll < 1Fh → ShowCharacterMessage(c, 'Spits Acid', 10, 1) { 5800:59f6 }, BuildFourAnimationFrames(17h), AnimateAlongPath(c → victim, 1, 1Eh) { 5800:59fe .. 5a41 }, DamageCharacter(hold_Victim, c^.maxhp, 2, SavingThrow(hold_Victim, 3, 0)) { 5800:5a67 / 5a6d }; else ShowCharacterMessage(c, 'Spits Acid and Misses', 10, 1) { 5800:5a8f }.

### 5800:5AA8 EffAcidCone (M) — effect 5Ah
New. `g_7746 := 0` { 5800:5aae }; on round 0 `e^.p3 := 3` (three breaths) { 5800:5ab3 / 5aba }; if e^.p3 <> 0 { 5800:5ac2 }: `DamageType := 30h` { 5800:5acf }; SpellHandlers[0](3Dh, 1, g_7746) { 5800:5afb }; if ok then ConeTargets(CombatantCol(c), CombatantRow(c), SpellX, SpellY, 1, 6) { 5800:5aff / 5b1d }; any target not on OppositeSide(c) cancels (`g_7746 := 0`) { 5800:5b20 .. 5b65 }; if ok and targets { 5800:5b67 / 5b71 }: ShowCharacterMessage(c, 'breathes acid', 10, 1) { 5800:5b96 }; BuildFourAnimationFrames(12h); AnimateAlongPath(c → SpellTargets[1], 1, 1Eh) { 5800:5b9e .. 5be1 }; for every target DamageCharacter(t, c^.maxhp, 2, SavingThrow(t, 3, 0)) { 5800:5be6 .. 5c5b }; e^.p3 := e^.p3 − 1 { 5800:5c5d }; ClearCombatantActionFlags(c) { 5800:5c6a }.

### 5800:5C86 EffFireCone (M) — effect 80h
New: as EffAcidCone with `DamageType := 21h` { 5800:5ca8 }, cone (3, 9) { 5800:5cf9 }, message 'breathes fire' { 5800:5d21 }, no side test { 5800:5cd8 .. 5df5 }.

### 5800:5E11 EffFireBreathShort (M) — effect 83h
New. SpellHandlers[0](41h, 1, g_7746) { 5800:5e22 }; hold_Victim := cb(c)^.target { 5800:5e26 .. 5e37 }; if (Roll(1, 100) < 33h) and (Distance(hold_Victim, c) < 2) and (hold_Victim <> nil) { 5800:5e41 .. 5e6e }: `DamageType := 1` { 5800:5e73 }; `g_7746 := ClearCombatantActionFlags(c)` { 5800:5e7e }; ShowCharacterMessage(c, 'Breathes Fire', 10, 1) { 5800:5ea1 }; BuildFourAnimationFrames(17h); AnimateAlongPath(c → victim, 1, 1Eh) { 5800:5ea9 .. 5eec }; DamageCharacter(hold_Victim, 7, 2, SavingThrow(hold_Victim, 3, 0)) { 5800:5f0d / 5f13 }.

### 5800:5F2F EffThrowLightning (M) — effect 84h
New. If CombatRound < 4 { 5800:5f35 }: ShowCharacterMessage(c, 'throws lightning', 10, 1) { 5800:5f76 }; SpellHandlers[0](33h, 1, g_7746) { 5800:5f86 }; ov23_1569(c) { 5800:5f90 }; BuildFourAnimationFrames(13h) { 5800:5f98 }; AnimateAlongPath(col, row, SpellX, SpellY, 4, 32h) { 5800:5fb7 }; BoltHitSquare(SpellX, SpellY, RollDice(16, 6), 4, 0, wall) { 5800:5fca / 5fdc }; LightningBolt(10, RollDice(16, 6), 4, 0) { 5800:5fe8 / 5ff5 } (a second, independent roll); ClearCombatantActionFlags(c) { 5800:5ffe }.

### 5800:6022 EffParalysingGaze (M) — effect 7Eh
New. cb(c)^.target := nil { 5800:6028 .. }; SpellHandlers[0](24h, 1, g_7746) { 5800:6045 }; hold_Victim := cb(c)^.target { 5800:6049 .. 605a }; if hold_Victim <> nil { 5800:605e }: ShowCharacterMessage(c, 'gazes...', 10, 0) { 5800:6085 }; BuildFourAnimationFrames(12h); AnimateAlongPath(c → victim, 4, 2Dh) { 5800:608d .. 60d0 }; if not SavingThrow(hold_Victim, 1, 0) { 5800:60e3 } then begin AddEffect(hold_Victim, 34h, 60, FFh, 0) { 5800:6101 }; ShowCharacterMessage(hold_Victim, 'is paralyzed', 10, 0) { 5800:6123 } end.

### 5800:612E IsScroll (H)
`function IsScroll(item [BP+6]: PItem): Boolean` — RETF 4, entry e6. Callers: ov09, ov15, ov19, ov20, ov22. Pool: 8E00:323D (1.00): `(item <> nil) and (ItemTypeTable[item^.itype].slot in [0Bh..0Dh])` { 5800:6134 .. 616e }.

### 5800:617B UseScrollSpell (H)
`procedure UseScrollSpell(owner [BP+0Ch]: PChar; item [BP+8]: PItem; spell [BP+6]: Byte)` — RETF 0Ah, entry e7. Callers: ov19 UseItem, ov20. Pool: 8E00:328A (0.99), same body: the last k in 1..3 with `item^.special[k] and 7Fh = spell` { 5800:6184 .. 61ac } is cleared { 5800:61bb }; `item^.plussave := item^.plussave − 1` (+30h, the scroll's charge byte, M) { 5800:61c5 }; if it drops below D2h then LoseItem(owner, item) { 5800:61d6 / 61e9 }.

### 5800:6209 ShowCasts (H)
`procedure ShowCasts(c [BP+0Ch]: PChar; msg [BP+8]: string; spell [BP+6]: Byte)` — RETF 0Ah, entry e8. Callers: CastSpell ('casts', 'miscasts'), ov20. Pool: 8E00:331A (0.97), same body: combat → ShowCharacterMessage(c, 'Casts a Spell', 10, 1) { 5800:6245 }, ClearRectangle(0, 17h, 27h, 17h) { 5800:6256 }, DrawText(0, 17h, 10, 0, 'Spell:' + SpellNames[spell]) { 5800:628e }; else ClearRectangle(1, 12h, 26h, 16h) { 5800:62a1 }, DrawCharacterName(c, 1, 13h, 0) { 5800:62b5 }, DrawText(Length(c^.name) + 2, 13h, 10, 0, msg) { 5800:62d3 }, DrawText(1, 14h, 10, 0, SpellNames[spell]) { 5800:62f6 }, MessageDelay, ClearCharacterMessage { 5800:62fb / 6300 }.

### 5800:630B InitSpellTable (H)
`procedure InitSpellTable` — RETF, entry e10. Caller: ov11 (game start). Pool: 8E00:3413 (0.78). `SpellHandlers[0] := @SelectTargetsCamp` { 5800:6311 / 6317 }; `cure_InProgress := 0; ItemCast := 0; sp_CampTarget := nil; ItemsChanged := 1` { 5800:631b .. 632d }; `SpellHandlers[1..100]` := the handlers of the table above (stubs 011A:009D .. 023C; unused ids 2Bh.. share handlers as listed) { 5800:6335 .. 6842 }; the effect handlers `EffectHandler[56h] := @EffSpitAcidRanged`, `[58h] := @EffBreathWeapon`, `[5Ah] := @EffAcidCone`, `[7Eh] := @EffParalysingGaze`, `[80h] := @EffFireCone`, `[83h] := @EffFireBreathShort`, `[84h] := @EffThrowLightning` { 5800:6849 .. 689d  DS:70FE, 7106, 710E, 719E, 71A6, 71B2, 71B6 }.

### 5800:68A5 ov22_init (H)
Empty unit initialiser { 5800:68a5 }.

---

## Spell table

`SpellTable{g_37DA}[id*16]` and `SpellNames{g_27BD}[id*29h]` from START.EXE (DS 0C1C image), ids 1..64h; `cls` C cleric, D druid, M magic-user, I item/monster power; `tgt` 0 combat only, 1 caster, 2 one member, 4 party; `save` 0 none, 1 negates, 2 half; `sv` saving-throw type; `eff` = effect type given (0 none); `+B..+F` the AI bytes (COMBAT lane); `handler` = the ov22 routine `SpellHandlers[id]` jumps to (InitSpellTable). Unnamed ids are item / monster powers (their messages name them in the handler table above).

| id | name | cls | lvl | range | dur | area | tgt | save | sv | eff | +B | +C | +D | +E | +F | handler |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 01 | Bless | C | 1 | 6 | 6 | 0A | 4 | 0 | 4 | 01 | 02 | 0A | 01 | 00 | 00 | ov22_1CF9 |
| 02 | Curse | C | 1 | 6 | 6 | 0A | 0 | 0 | 4 | 02 | 01 | 0A | 03 | 01 | 00 | ov22_1D2A |
| 03 | Cure Light Wounds | C | 1 | 0 | 0 | 04 | 2 | 0 | 4 | 00 | 02 | 05 | 01 | 00 | 00 | ov22_1D55 |
| 04 | Cause Light Wounds | C | 1 | touch | 0 | 04 | 0 | 0 | 4 | 00 | 01 | 05 | 02 | 01 | 00 | ov22_1D93 |
| 05 | Detect Magic | C | 1 | 3 | 10 | 00 | 1 | 0 | 4 | 05 | 02 | 01 | 00 | 00 | 00 | ov22_1DD5 |
| 06 | Protection From Evil | C | 1 | 0 | 0+3/lv | 04 | 2 | 0 | 4 | 08 | 02 | 04 | 01 | 00 | 00 | ov22_1E0F |
| 07 | Protection from Good | C | 1 | 0 | 0+3/lv | 04 | 2 | 0 | 4 | 09 | 02 | 04 | 01 | 00 | 00 | ov22_1E0F |
| 08 | Resist Cold | C | 1 | 0 | 0+10/lv | 04 | 2 | 0 | 4 | 0A | 02 | 0A | 00 | 00 | 00 | ov22_1E4E |
| 09 | Burning Hands | M | 1 | 0 | 0 | 04 | 0 | 0 | 4 | 00 | 01 | 01 | 02 | 01 | 00 | ov22_1E7C |
| 0A | Charm Person | M | 1 | 12 | 0 | 04 | 0 | 1 | 4 | 0B | 01 | 01 | 04 | 01 | 00 | ov22_1EC9 |
| 0B | Detect Magic | M | 1 | 0 | 0+2/lv | 00 | 1 | 0 | 4 | 05 | 02 | 01 | 00 | 00 | 00 | ov22_1DD5 |
| 0C | Enlarge | M | 1 | 0+2/lv | 0+10/lv | 04 | 2 | 0 | 4 | 0C | 02 | 01 | 00 | 00 | 00 | ov22_1FA0 |
| 0D | Reduce | M | 1 | 0+2/lv | 0+10/lv | 04 | 2 | 1 | 4 | 0D | 02 | 01 | 00 | 01 | 00 | ov22_20E1 |
| 0E | Friends | M | 1 | 0 | 0+1/lv | 00 | 1 | 0 | 4 | 0E | 00 | 01 | 00 | 00 | 00 | ov22_2180 |
| 0F | Magic Missile | M | 1 | 6+4/lv | 0 | 04 | 0 | 0 | 4 | 00 | 01 | 01 | 04 | 01 | 00 | ov22_21C7 |
| 10 | Protection From Evil | M | 1 | 0 | 0+2/lv | 04 | 2 | 0 | 4 | 08 | 02 | 01 | 01 | 00 | 00 | ov22_1E0F |
| 11 | Protection From Good | M | 1 | 0 | 0+2/lv | 04 | 2 | 0 | 4 | 09 | 02 | 01 | 01 | 00 | 00 | ov22_1E0F |
| 12 | Read Magic | M | 1 | 0 | 0+2/lv | 00 | 1 | 0 | 4 | 10 | 00 | 0A | 00 | 00 | 00 | ov22_1DD5 |
| 13 | Shield | M | 1 | 0 | 0+5/lv | 00 | 1 | 0 | 4 | 11 | 02 | 01 | 02 | 00 | 00 | ov22_2232 |
| 14 | Shocking Grasp | M | 1 | touch | 0 | 04 | 0 | 0 | 4 | 00 | 01 | 01 | 02 | 01 | 00 | ov22_2260 |
| 15 | Sleep | M | 1 | 3+4/lv | 0+5/lv | 09 | 0 | 0 | 4 | 35 | 01 | 01 | 02 | 01 | 01 | ov22_22B4 |
| 16 | Find Traps | C | 2 | 0 | 30 | 00 | 1 | 0 | 4 | 13 | 00 | 05 | 00 | 00 | 00 | ov22_1DD5 |
| 17 | Hold Person | C | 2 | 6 | 4+1/lv | 06 | 0 | 1 | 4 | 34 | 01 | 05 | 06 | 01 | 00 | ov22_23F2 |
| 18 | Resist Fire | C | 2 | 0 | 0+10/lv | 04 | 2 | 0 | 4 | 14 | 02 | 05 | 01 | 00 | 00 | ov22_245B |
| 19 | Silence, 15' Radius | C | 2 | 12 | 0+2/lv | 1F | 0 | 3 | 4 | 15 | 01 | 05 | 04 | 01 | 01 | ov22_2494 |
| 1A | Slow Poison | C | 2 | 0 | 0+60/lv | 04 | 2 | 0 | 4 | 16 | 02 | 01 | 00 | 00 | 00 | ov22_24CD |
| 1B | Snake Charm | C | 2 | 3 | 0 | F0 | 0 | 0 | 4 | 33 | 01 | 05 | 00 | 01 | 00 | ov22_2580 |
| 1C | Spiritual Hammer | C | 2 | 3 | 0+1/lv | 00 | 1 | 0 | 4 | 17 | 02 | 05 | 01 | 00 | 00 | ov22_262F |
| 1D | Detect Invisibility | M | 2 | 0+4/lv | 0+5/lv | 00 | 1 | 0 | 4 | 18 | 02 | 02 | 01 | 00 | 00 | ov22_1DD5 |
| 1E | Invisibility | M | 2 | 0 | 0 | 04 | 2 | 0 | 4 | 19 | 02 | 02 | 02 | 00 | 00 | ov22_2682 |
| 1F | Knock | M | 2 | 0 | 0 | 00 | 0 | 0 | 4 | 00 | 00 | 01 | 00 | 00 | 00 | ov22_26BB |
| 20 | Mirror Image | M | 2 | 0 | 0+2/lv | 00 | 1 | 0 | 4 | 1C | 02 | 02 | 03 | 00 | 00 | ov22_26F6 |
| 21 | Ray of Enfeeblement | M | 2 | 1+1/lv | 0+1/lv | 04 | 0 | 1 | 4 | 1D | 01 | 02 | 02 | 01 | 00 | ov22_2754 |
| 22 | Stinking Cloud | M | 2 | 3 | 0+1/lv | 09 | 0 | 3 | 0 | 1E | 01 | 02 | 05 | 01 | 01 | Spell_StinkingCloud |
| 23 | Strength | M | 2 | 0 | 0+60/lv | 00 | 2 | 0 | 4 | 26 | 00 | 0A | 00 | 00 | 00 | Spell_Strength |
| 24 | Animate Dead | I | 7 | 4 | 0 | 08 | 4 | 1 | 4 | 00 | 02 | 00 | 02 | 00 | 00 | Spell_AnimateDead |
| 25 | Cure Blindness | C | 3 | 0 | 0 | 04 | 2 | 0 | 4 | 00 | 02 | 0A | 00 | 00 | 00 | ov22_2F5E |
| 26 | Cause Blindness | C | 3 | touch | 0 | 04 | 0 | 1 | 4 | 21 | 01 | 0A | 03 | 01 | 00 | ov22_2FA4 |
| 27 | Cure Disease | C | 3 | 0 | 0 | 00 | 2 | 0 | 4 | 00 | 00 | 64 | 00 | 00 | 00 | ov22_3076 |
| 28 | Cause Disease | C | 3 | touch | 0 | 04 | 0 | 1 | 4 | 22 | 01 | 64 | 04 | 01 | 00 | ov22_3093 |
| 29 | Dispel Magic | C | 3 | 6 | 0 | 09 | 2 | 0 | 4 | 00 | 02 | 04 | 03 | 01 | 01 | Spell_DispelMagic |
| 2A | Prayer | C | 3 | 0 | 0+1/lv | 00 | 4 | 0 | 4 | 31 | 02 | 06 | 05 | 00 | 00 | ov22_352D |
| 2B | Remove Curse | C | 3 | 0 | 0 | 04 | 2 | 0 | 4 | 00 | 02 | 06 | 00 | 00 | 00 | Spell_RemoveCurse |
| 2C | Bestow Curse | C | 3 | touch | 0+10/lv | 04 | 0 | 1 | 4 | 24 | 01 | 06 | 05 | 01 | 00 | ov22_36A7 |
| 2D | Blink | M | 3 | 0 | 0+1/lv | 00 | 0 | 0 | 4 | 25 | 01 | 01 | 02 | 00 | 00 | ov22_36E0 |
| 2E | Dispel Magic | M | 3 | 12 | 0+1/lv | 09 | 2 | 0 | 4 | 00 | 02 | 03 | 02 | 01 | 01 | Spell_DispelMagic |
| 2F | Fireball | M | 3 | 10+1/lv | 0 | 0B | 0 | 2 | 4 | 00 | 01 | 03 | 07 | 01 | 03 | Spell_Fireball |
| 30 | Haste | M | 3 | 6 | 3+1/lv | 0A | 4 | 0 | 4 | 27 | 02 | 03 | 03 | 00 | 00 | ov22_391D |
| 31 | Hold Person | M | 3 | 12 | 0+2/lv | 07 | 0 | 1 | 4 | 34 | 01 | 03 | 06 | 01 | 00 | ov22_23F2 |
| 32 | Invisibility, 10' Radius | M | 3 | 0 | 0 | 09 | 4 | 0 | 4 | 19 | 02 | 03 | 01 | 00 | 00 | ov22_2682 |
| 33 | Lightning Bolt | M | 3 | 4+1/lv | 0 | 08 | 0 | 2 | 4 | 00 | 01 | 03 | 06 | 01 | 00 | ov22_3C98 |
| 34 | Protection From Evil, 10' Radius | M | 3 | 0 | 0+2/lv | 04 | 2 | 0 | 4 | 2D | 02 | 03 | 01 | 00 | 00 | ov22_1E0F |
| 35 | Protection From Good, 10' Radius | M | 3 | 0 | 0+2/lv | 04 | 2 | 0 | 4 | 2E | 02 | 03 | 02 | 00 | 00 | ov22_1E0F |
| 36 | Protection From Normal Missiles | M | 3 | 0 | 0+10/lv | 04 | 2 | 0 | 4 | 29 | 02 | 03 | 03 | 00 | 00 | ov22_1E0F |
| 37 | Slow | M | 3 | 9+1/lv | 3+1/lv | 0A | 0 | 0 | 4 | 2A | 01 | 03 | 04 | 01 | 00 | ov22_3CED |
| 38 | Restoration | C | 7 | 0 | 0 | 04 | 2 | 0 | 4 | 00 | 02 | 06 | 00 | 00 | 00 | Spell_Restoration |
| 39 |  | I | 6 | 0 | 0 | 00 | 1 | 0 | 4 | 27 | 02 | 00 | 03 | 00 | 00 | ov22_3EE2 |
| 3A | Cure Serious Wounds | C | 4 | 0 | 0 | 04 | 2 | 0 | 4 | 00 | 02 | 07 | 01 | 00 | 00 | ov22_3F23 |
| 3B |  | I | 6 | 0 | 0 | 00 | 1 | 0 | 4 | 26 | 02 | 00 | 01 | 00 | 00 | ov22_3F6F |
| 3C |  | I | 6 | 4+4/lv | 0 | 04 | 0 | 2 | 4 | 00 | 01 | 00 | 07 | 01 | 00 | ov22_3FF4 |
| 3D |  | I | 6 | 6 | 0 | 04 | 0 | 1 | 0 | 34 | 01 | 00 | 07 | 01 | 00 | ov22_4043 |
| 3E |  | I | 6 | 0 | 0 | 00 | 1 | 0 | 4 | 27 | 02 | 00 | 01 | 00 | 00 | ov22_407A |
| 3F |  | I | 6 | 0 | 0 | 07 | 4 | 0 | 4 | 47 | 02 | 00 | 02 | 00 | 00 | ov22_40D5 |
| 40 |  | I | 6 | 7 | 0 | 0B | 0 | 2 | 4 | 00 | 01 | 00 | 07 | 01 | 03 | Spell_Fireball |
| 41 |  | I | 6 | 12 | 0 | 04 | 0 | 0 | 4 | 00 | 01 | 00 | 06 | 01 | 00 | ov22_4103 |
| 42 | Cause Serious Wounds | C | 4 | 0 | 0 | 04 | 0 | 0 | 4 | 00 | 01 | 07 | 05 | 01 | 00 | ov22_413F |
| 43 | Neutralize Poison | C | 4 | 0 | 0 | 00 | 2 | 0 | 4 | 00 | 00 | 07 | 00 | 00 | 00 | ov22_4194 |
| 44 | Poison | C | 4 | 0 | 0 | 04 | 0 | 1 | 0 | 00 | 01 | 07 | 06 | 01 | 00 | ov22_4289 |
| 45 | Protection Evil, 10' Radius | C | 4 | 3 | 0+10/lv | 04 | 2 | 0 | 4 | 2D | 02 | 07 | 02 | 00 | 00 | ov22_1E0F |
| 46 | Sticks to Snakes | C | 4 | 3 | 0+2/lv | 04 | 0 | 0 | 4 | 03 | 01 | 07 | 04 | 01 | 00 | ov22_4311 |
| 47 | Cure Critical Wounds | C | 5 | 0 | 0 | 04 | 2 | 0 | 4 | 00 | 02 | 08 | 02 | 00 | 00 | ov22_43A7 |
| 48 | Cause Critical Wounds | C | 5 | touch | 0 | 04 | 0 | 1 | 4 | 00 | 01 | 08 | 06 | 01 | 00 | ov22_43EA |
| 49 | Dispel Evil | C | 5 | 0 | 0+1/lv | 00 | 0 | 0 | 4 | 91 | 01 | 08 | 03 | 00 | 00 | ov22_4432 |
| 4A | Flame Strike | C | 5 | 6 | 0 | 04 | 0 | 2 | 4 | 00 | 01 | 08 | 06 | 01 | 00 | ov22_4493 |
| 4B | Raise Dead | C | 5 | 0 | 0 | 00 | 2 | 0 | 4 | 00 | 00 | 0A | 01 | 00 | 00 | ov22_44D3 |
| 4C | Slay Living | C | 5 | 3 | 0 | 04 | 0 | 1 | 4 | 00 | 01 | 0A | 07 | 01 | 00 | ov22_45B5 |
| 4D | Detect Magic | D | 1 | 3 | 12 | 00 | 1 | 0 | 4 | 05 | 02 | 03 | 01 | 00 | 00 | ov22_1DD5 |
| 4E | Entangle | D | 1 | 8 | 10 | 0B | 0 | 1 | 4 | 88 | 01 | 03 | 03 | 01 | 00 | ov22_4672 |
| 4F | Faerie Fire | D | 1 | 8 | 0+4/lv | 05 | 0 | 1 | 4 | 07 | 01 | 03 | 04 | 01 | 00 | ov22_472C |
| 50 | Invisibility to Animals | D | 1 | touch | 10+1/lv | 04 | 2 | 0 | 4 | 45 | 02 | 04 | 01 | 01 | 00 | ov22_4759 |
| 51 | Charm Monsters | M | 4 | 6 | 0 | 05 | 0 | 1 | 4 | 0B | 01 | 04 | 06 | 01 | 00 | ov22_4791 |
| 52 | Confusion | M | 4 | 12 | 2+1/lv | 0B | 0 | 1 | 4 | 23 | 01 | 04 | 07 | 01 | 00 | ov22_4822 |
| 53 | Dimension Door | M | 4 | 0+3/lv | 0 | 08 | 0 | 0 | 4 | 00 | 01 | 01 | 00 | 01 | 00 | ov22_48E4 |
| 54 | Fear | M | 4 | 6 | 0+1/lv | 08 | 0 | 1 | 4 | 8E | 01 | 04 | 06 | 01 | 00 | ov22_4A8F |
| 55 | Fire Shield | M | 4 | 0 | 2+1/lv | 00 | 1 | 0 | 4 | 00 | 02 | 04 | 08 | 00 | 00 | ov22_4BEC |
| 56 | Fumble | M | 4 | 0+1/lv | 0+1/lv | 04 | 0 | 1 | 4 | 1B | 01 | 04 | 04 | 01 | 00 | ov22_4DA0 |
| 57 | Ice Storm | M | 4 | 0+1/lv | 0 | 0A | 0 | 0 | 4 | 00 | 01 | 04 | 07 | 01 | 00 | ov22_4EB4 |
| 58 | Minor Globe Of Invulnerability | M | 4 | 0+1/lv | 0+1/lv | 00 | 1 | 0 | 4 | 3F | 02 | 04 | 05 | 00 | 00 | ov22_4EF7 |
| 59 | Remove Curse | M | 4 | 0 | 0 | 04 | 2 | 0 | 4 | 00 | 02 | 04 | 00 | 00 | 00 | Spell_RemoveCurse |
| 5A | Animate Dead | I | 5 | 1 | 0 | F0 | 4 | 0 | 4 | 20 | 02 | 05 | 00 | 00 | 00 | Spell_AnimateDead |
| 5B | Cloud Kill | M | 5 | 2 | 0+1/lv | 09 | 0 | 0 | 4 | 00 | 02 | 05 | 05 | 01 | 00 | Spell_CloudKill |
| 5C | Cone of Cold | M | 5 | 6 | 0 | 08 | 0 | 2 | 4 | 00 | 01 | 05 | 06 | 01 | 00 | ov22_54EB |
| 5D | Feeblemind | M | 5 | 16 | 0 | 04 | 0 | 1 | 4 | 44 | 01 | 05 | 06 | 01 | 00 | ov22_5590 |
| 5E | Hold Monsters | M | 5 | 0+1/lv | 0+1/lv | 07 | 0 | 1 | 4 | 34 | 01 | 05 | 07 | 01 | 00 | ov22_23F2 |
| 5F |  | I | 6 | 0 | 0 | 00 | 1 | 0 | 4 | 49 | 02 | 0A | 01 | 00 | 00 | ov22_563B |
| 60 |  | I | 6 | 0 | 0 | 00 | 1 | 0 | 4 | 6D | 02 | 0A | 01 | 00 | 00 | ov22_5669 |
| 61 |  | I | 6 | 0 | 0 | 00 | 1 | 0 | 4 | 19 | 02 | 00 | 01 | 00 | 00 | ov22_5697 |
| 62 |  | I | 6 | 3 | 0 | 0B | 0 | 1 | 4 | 00 | 01 | 00 | 01 | 01 | 00 | ov22_56C4 |
| 63 |  | I | 6 | 0 | 0 | 00 | 1 | 0 | 4 | 00 | 02 | 00 | 01 | 00 | 00 | ov22_578B |
| 64 | Bestow Curse | M | 4 | 0 | 0+10/lv | 04 | 0 | 1 | 4 | 00 | 01 | 04 | 04 | 01 | 00 | ov22_36A7 |


## Self-check
Method: `scratchpad/sample_magic.py` (seed 20261020) drew 83 of the 827 anchored Pascal statements (10 %) at random; each was re-read against the instructions at its address in `decode/listings/ov04|08|15|22.lst` (the statement, operands and offsets, constants, push order, branch sense). Sample (line numbers of this file at the time of the check): ov04 32, 79, 86, 101, 104, 105, 117, 129, 152, 173, 175, 176, 179, 200, 222, 232; ov08 265, 276, 279, 281, 299, 333, 334, 347, 348, 350, 358, 359, 361, 375, 408, 437, 446; ov15 536, 538, 544, 546, 548, 634, 683, 689, 695, 733, 764, 793, 802, 809, 837, 863, 885, 887, 889, 928, 941; ov22 975, 980, 1000, 1022, 1026, 1066, 1076, 1107, 1115, 1146, 1147, 1169, 1171, 1179, 1190, 1214, 1336, 1349, 1356, 1377, 1380, 1398, 1436, 1440, 1445, 1460, 1474, 1485, 1487.
Result: 83/83 agree with the asm in content (e.g. the round limit `CMP AL,[758E]; JC` at 2f00:0a84, `known_spell` at `+78h + id` 4000:0c83, the Remove Curse `ready := 0` at 5800:3609, the Strength exceptional cap at 5800:2d3f). Two cites name the instruction before the statement's first one (L173 2700:0b22 = the previous store, L1066 5800:0b0d = the loop increment); content unchanged. Noted while reading: `cm_Map := nil` (2f00:00cb) zeroes DS:6E92 **and** DS:6E94 — 6E94 is the segment word of the `cm_Map` far pointer, not a separate `tg_List` (VIEW's name for 6E94 should be reviewed by cab-rt).
Anchors: `python -I decode/tools/anchorcheck.py decode/pseudo/MAGIC.pas.md` → 1745 anchors, **0 bad** (the C-export statement addresses were snapped to the start of the instruction containing them by `scratchpad/snap_magic.py`, 112 tokens, as for COMBAT).
Argument order: `python -I decode/tools/argcheck.py MAGIC` → 485 calls, OK 82, **MISMATCH 0**, UNSURE 403 (`MAGIC_ARGCHECK.md`). The first run's 10 MISMATCH were all several calls on one line sharing one anchor (split). Every multi-argument call written new for Curse (SpellUsable, AddSpellLineCounted, ConeTargets and its nested helpers, HoldTargets, BoltHitSquare's `skip`, the Fix helpers, the Heal service, the Pics submenu, the new handlers) was taken from its PUSH sequence; four headers first written in Ghidra order (ApplyToSide, HoldTargets, ConeTargets, ClampXY) were corrected to Pascal order before the argcheck run.
Pool deltas: every routine with a Pool twin carries its shape ratio and a same / **changed** / **new** mark; Pool's build corrections B-1..B-31 were checked against the Curse code and are referenced where the quirk survives (B-2, B-3, B-5, B-6, B-10, B-11, B-12, B-13, B-15, B-16, B-18, B-19, B-20, B-21, B-23, B-24, B-25, B-27, B-28, B-29, B-30, B-31).
Fixes (lane cab-fixes-fable, 2026-10-20): STATUS `MAGIC fix request #verify-32..44` applied — #39 `sl_Ids` is read at entry n-1 in the insertion loop, the same-spell test and the else branch (only 5800:0681 reads entry n); #42 the cloud-effect search is a `found` loop (5800:344a..34af) and the dispel tests `found`; #43 CastMenu is `if CanUseMagic(1) then repeat .. until s = 0` (no `ok`, no `idx := -1` in the loop); #44 MAGIC_SCREENS MAGIC-22-01 shows ` (N)`, not ` (xN)`; #32..38, #40, #41 re-cited, which re-cites the three shifted routines (ov15 ScribeMenu 0d71..0dda, ov22 AddSpellLineCounted 0696..079c, ov15 PartyOrder 188e..18f8). Whole-file cite pass with `scratchpad/verify/citepass4.py` (as for COMBAT): 621 anchors on 469 lines moved to the statement's first instruction (441 back to the first push/load, 142 off a conditional jump, 26 off a preceding store, 12 off a closing JMP); its 13 first-anchor conflicts and 8 review items were settled by hand against the listings (34 cites, e.g. the HealMenu arms 2700:046d/04ba/050a, the TakeTurn initiative block 2f00:02b8..0303, the Flee / miscast / IsVisible then-parts). Checks after the pass: anchorcheck 1744 anchors, **0 bad**; argcheck 486 calls, **0 MISMATCH** (MAGIC_ARGCHECK.md regenerated).
