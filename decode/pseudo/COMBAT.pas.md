# COMBAT — Pascal-style pseudocode (lane cab-mod-combat)

Units (herdr/assignments/cab-areas.md): **ov05** (2900: after combat — outcome, XP, treasure), **ov07** (2C00: ECL VM support + encounter/duel/damage helpers), **ov09** (3100: computer-controlled combat turn), **ov13** (3A00: attacks, targeting, turn undead, flee), **ov18** (4E00: finale sequence), **ov19** (5000: character sheet, items, trade, coins), **ov23** (5F00: effects, saving throws, to-hit, damage, healing).
Pool twin: `PoolRadianceRE/decode/pseudo/COMBAT.pas.md` (Pool ov05/ov07/ov09/ov13/ov18/ov19/ov24; Curse ov23 = Pool ov24). Every routine below was started from the shape-matched Pool twin (scratch `shapematch_combat.txt`, ratios quoted as `Pool: SSSS:OOOO (r)`) and then re-read against the Curse listing; deltas are marked **changed** / **new**.
Sources: `decode/listings/<unit>.lst` (evidence), `<unit>.c` (Ghidra aid); `decode/ecl/ECL_VM.md` (the VM spec — cited, not repeated, for the ov07 VM routines); `decode/pseudo/VIEW.pas.md`, `RESIDENT.pas.md`, `ECL.pas.md` (names of the routines called). Screens: `COMBAT_SCREENS.md`. Names: `decode/names/combat_names.json`. Argument-order check: `COMBAT_ARGCHECK.md` (`python -I decode/tools/argcheck.py COMBAT`).

Conventions (as VIEW.pas.md)
- **Signatures in Pascal order**: first parameter = highest BP offset (pushed first); Ghidra's `param_1` is the last push (`[BP+6]`). Every call with arguments was read from the push sequence in the `.lst`, not from the C.
- `{ seg:off }` = first instruction of the statement (or of the call implementing it). Globals `g_XXXX` = DS:XXXX (DS = 0C1C); names introduced here are written `Name{g_XXXX}` at first use and listed in combat_names.json (`"DS:XXXX"` keys; globals request in STATUS.md for cab-rt).
- `Mem[a]` = ECL VM cell at ECL address `a` (ECL_VM.md §3): region 0 (`g_4F99^`, 4B00..4EFF) and region 1 (`g_4F9D^`, 7C00..7FFF) are word arrays, so a Ghidra byte offset `o` in `g_4F9D` is `Mem[7C00h + o div 2]` (e.g. `+58Eh` = `Mem[7EC7]`). The Pool byte offset is quoted at first use so the Pool text can be followed.
- Character record (422 bytes, `c^`; PARTY/saves lanes own the full map — offsets used here, with the Pool field they replace): `name +0` (string[15]), `str +11h`, `int +13h`, `wis +15h`, `dex +17h`, `con +19h`, `cha +1Bh`, `mem_spell[0..83] +1Eh..`, `class +75h`, `maxhp +78h`, `level +E5h` (M, by the duel-XP formula; Pool `level_main +73h`), `thief_skill +EAh..`, `effects +F2h`, `npc_morale +F7h` (bit 7 = NPC), `npc_shares +F8h` (low 3 bits), `money[0..6] +FBh..+107h` (words: copper, silver, electrum, gold, platinum, gems, jewelry), `gender +119h` (M: 0 = "his"), `xp +127h` (LongInt), `hp_rolled +12Ch`, `xp_value +13Ch` (word), `xp_per_hp +13Eh`, `icon_slot +143h`, `items +14Dh`, `combatant +18Dh`, `next +189h`, `status +195h` (0 Okay, 1 Animated, 3 Running, 4 Unconscious, 5 Dying, 6 Dead, 7 Stoned), `active +196h`, `side +197h` (1 = monster side), `controlled +198h`, `hp +1A4h`, `move +1A5h`.
- Item record (63 bytes): `next +2Ah`, `plus +32h`, `readied +34h`, `weight +37h` (word). Effect record (9 bytes, `type +0`, `next +5`). Combat record `cb = c^.combatant^` (22 bytes, FreeMem 16h): `cb^[13h] = 1` marks a combatant that is **not a party member** (monsters are appended behind the party in the `PartyHead` list); other fields in the ov09 table.
- Resident/VIEW/ECL callees by their published names (RESIDENT.pas.md, VIEW.pas.md, ECL.pas.md, eclview_names.json, res_names.json, ecl_names.json); every text routine carries a background colour (cab-rt resident note #1): `DrawText(col, row, fg, bg, s)`, `DrawWrappedText(x1, y1, x2, y2, fg, bg, clear, s)`, `ShowBottomPromptAndReadKey(fg, bg, s)`, `ClearTextRectangle(x1, y1, x2, y2)`, `DrawScreenFrame` (01A0:0000, no arguments — Pool's `DrawTitledFrame(1, 1, 38, 22, 0, 15, title)`), `HorizontalMenu(prompt, options, promptColour, textColour, hotColour, allowExt, animate, var ext)`, `VerticalListMenu(prompt, options, headerColour, normalColour, selColour, left, top, right, bottom, list, showExit, var redraw, var index, var item)`, `MenuSelect(title, items, promptColour, textColour, hotColour, acceptEnter, animate)`, `Roll(count, sides)` = Roll, `HasEffect(c, type, var e)`, `LoseItem(c, item)`, `RecalcItems(c)`, `PartySummary(c)` (Pool DrawPartyRoster), `RemovePartyMember(keepCount, freeIcon)` (4800:3A56, Pool RemoveFromParty).
- Routines of other areas without a published name keep their `ovNN_XXXX` name and get the Pool twin's role in a comment (M): `BuildItemName` = BuildItemName(c, item, col, row, withReady, draw) (Pool 00BA:0442), `RedrawCurrentMode` = RedrawCurrentMode (Pool 00BA:27D9), `ApplyDamage` = ApplyDamage(c, dmg) (Pool 9800:1344 DamageCharacter's caller twin), `AddItemToChar` = AddItemToChar(item, var refused), `TakeMoney` = TakeMoney, `PoolMoney` = PoolMoney, `ShareMoney` = ShareMoney, `TreasurePoolStatus` = TreasurePoolStatus(var money, var items), `CastSpell` = CastSpell(spell, 0, 0, var ext), `LoadMonster` = LoadMonster(id, var rec), `ViewMenu` = ViewMenu(var ext) and `CycleSelectedChar` = CycleSelectedChar(key) (both ov19, this file).

---

## ov05 (seg 2900) — after combat: outcome, duel, experience, treasure

Unit: ov05, analysis segment 2900, 1900h bytes, 13 functions (functions.tsv), entry `AfterCombat` (stub e1) + `ov05_init` (e0) + `ov05_LoadDeps`. Pool twin: ov05 3900 (shape 0.64..1.00 per routine).
Role: everything between the last combat round and the return to the ECL script — won / fled / destroyed, XP, NPC shares, the treasure screen (`View Take Pool Share Detect Exit`), the loot list, "The monsters rejoice..." when the party is destroyed. Caller: `ecl_op24_Combat` (2200:179A, ECL_VM.md §4.4) after the combat loop and directly for treasure-only encounters.
Strings (code segment, exact bytes from `decode/bin/ghidra/ov05.bin`): 2900:09A4 `The party has fled.`, 09B8 `You have lost the fight.`, 09D1 `You have won the duel.`, 09E8 `The party has won.`, 09FB `The party has found Treasure!`, 0A19 `The duelist receives `, 0A2F `Each character receives `, 0A48 `experience points.`, 0A5B `press <enter>/<return> to continue`, 0CD9 `Items: `, 0CE1 `Take`, 0EBF `Take: `, 0EC6 `Money Items Exit`, 0FCD `View Pool Exit`, 0FDC ` Exit`, 0FE2 ` Detect Exit`, 0FEF `View Take Pool Share`, 1004 `View Take Pool`, 1013 `~Yes ~No`, 101C `There is still treasure left.  `, 103C `Do you want to go back and claim your treasure?`, 1466 ` takes and hides `, 1478 `his`, 147C ` share.`, 1484 `her`, 1489 `press <enter>/<return> to continue`, 16E6 `The monsters rejoice for the party has been destroyed`, 171C `Press any key to continue`. ("You have lost the fight." replaces Pool's "You have lost the duel."; the duel-won text is kept.)
Globals (Pool name where the role is the same, GLOBALS.md alignment in brackets): `DuelActive{g_8B56}` (Pool 84D4), `NonSharing{g_8B57}`, `CombatXP{g_8B58}` (LongInt), `PartyWon{g_8B5C}`, `EnemiesFought{g_47EC}`, `PartyFled{g_47ED}`, `PartyDead` g_4FC7, `TreasureMoney` g_6F70 (7 LongInts), `TreasureItems` g_6F8C, `treasure_Mark{g_650E}` (far pointer, Pool g_5D9A: item-list mark written by StartCombat / Attack — L), `DemoMode` g_4FBC, `view_Mode` g_4FBA, `TextOutputActive` g_4FC9, `SelectedChar` g_6506, `PartyHead` g_650A, `combat_EndEffects{g_02A8}` (19 effect types in the data segment, table below).

### 2900:0000 ov05_LoadDeps (M)
`procedure ov05_LoadDeps` — ten `CALLF` into entry 0 of ov19, ov07, ov21, ov26, ov06, ov24, ov34, ov22, ov23, ov33 { 2900:0003 .. 0030 }: touches the units ov05 calls so the overlay manager loads them (same shape as `ov02_LoadDeps`, ECL.pas.md §2). No Pool twin (Pool ov05 has no dependency touch; 0.32 vs ov04).

### 2900:0039 ComputeCombatXP (H)
`procedure ComputeCombatXP(var xp [BP+6]: LongInt)` — RETF 4. Callers: ResolveCombatOutcome (2×, with `CombatXP`). Callees: GetMem, BuildItemName, @CopyBytes, @LongDivMod, @LongMul. Pool: 3900:0000 ComputeCombatXP (0.81).
Duel: the duelist's level × 100. Otherwise every enemy that is neither Okay nor Running adds its XP value and `hp_rolled × xp_per_hp`, its money goes into the treasure pool and **all of its items** go into the treasure list; the pool's value (coins → gp, gems 250, jewelry 2200, magic items 400 per plus) counts as XP too; the sum is divided by the sharing party members.
```pascal
if DuelActive <> 0 then begin                                                          { 2900:003f }
  xp := SmallInt(ShortInt(SelectedChar^.level) * 100);                                 { 2900:0046  +E5h, IMUL 64h, CWD }
  exit;
end;
total := 0;                                                                            { 2900:0063 }
c := PartyHead;                                                                        { 2900:006b }
n := 0;                                                                                { 2900:0077  items moved (counted, never tested) }
while c <> nil do begin                                                                { 2900:007b }
  it := c^.items;                                                                      { 2900:0086 }
  if (c^.side = 1) and (c^.status <> 0) and (c^.status <> 3) then begin                { 2900:0096  changed: Okay enemies (status 0) give nothing }
    EnemiesFought := 1;                                                                { 2900:00c0 }
    for k := 0 to 6 do                                                                 { 2900:00c5 }
      TreasureMoney[k] := TreasureMoney[k] + c^.money[k];                              { 2900:00ce  word zero-extended }
    total := total + c^.xp_value + LongInt(SmallInt(c^.hp_rolled * c^.xp_per_hp));     { 2900:00fc  +13Ch, +12Ch × +13Eh (8-bit MUL, CWD) }
    if Mem[7EE3] <> 1 then                                                             { 2900:0133  Pool w[$5C6]: 1 = enemies' items are not looted }
      while it <> nil do begin                                                         { 2900:0142 }
        n := n + 1;                                                                    { 2900:014d }
        old := TreasureItems;                                                          { 2900:0150 / 01b1 }
        GetMem(TreasureItems, $3F);                                                    { 2900:0159 / 01bd }
        BuildItemName(c, it, 0, 0, 0, 0);                                                  { 2900:0167 / 01cb  BuildItemName }
        TreasureItems^ := it^;                                                         { 2900:0184 / 01e8  63-byte copy }
        TreasureItems^.readied := 0;                                                   { 2900:0198 / 01fc }
        TreasureItems^.next := old;                                                    { 2900:01a1 / 0205  pushed at the head }
        it := it^.next;                                                                { 2900:0216 }
      end;                                                                             { changed: no "value > 0 or 30 % while < 8 taken" test — every item is looted }
  end;
  c := c^.next;                                                                        { 2900:0228 }
end;
total := total + TreasureMoney[0] div 200;                                             { 2900:023b  copper (C8h) }
total := total + TreasureMoney[1] div 20;                                              { 2900:0251  silver }
total := total + TreasureMoney[2] div 2;                                               { 2900:0267  electrum }
total := total + TreasureMoney[3];                                                     { 2900:027d  gold }
total := total + TreasureMoney[4] * 5;                                                 { 2900:0289  platinum }
total := total + TreasureMoney[5] * 250;                                               { 2900:029f  gems (FAh) }
total := total + TreasureMoney[6] * 2200;                                              { 2900:02b5  jewelry (898h) }
it := TreasureItems;                                                                   { 2900:02cb }
while (it <> nil) and (it <> treasure_Mark) do begin                                   { 2900:02d7  g_650E:g_6510 }
  if it^.plus > 0 then total := total + LongInt(SmallInt(it^.plus * 400));             { 2900:02f0 / 02fa  signed, 190h }
  it := it^.next;                                                                      { 2900:030e }
end;
xp := total div Word(Mem[7F3E] - NonSharing);                                          { 2900:031f  Pool w[$67C] = party member count; 0 → runtime error 200 }
```
Notes (H): the duel formula no longer tests `Mem[7EE6]` (Pool `w[$5CC]`); the loot condition of Pool (`value > 0 or (taken < 8 and Roll(1,10) <= 3)`) is gone — `n` is still counted at 2900:014d but never read. `hp_rolled × xp_per_hp` above 32767 goes negative (CWD of an unsigned product) as in Pool.

### 2900:0351 AwardXP (H)
`procedure AwardXP(xp [BP+6]: LongInt)` — RETF 4 (value parameter). Caller: ResolveCombatOutcome. Callee: @LongDivMod. Pool: 3900:0355 AwardXP (0.64 — the case list grew).
Adds the share to every active member that is not Animated: +10 % when the prime requisites of a single-class character are ≥ 16 (now including paladin STR+WIS and ranger STR+INT+WIS); two-class characters get xp/2, three-class xp/3.
```pascal
c := PartyHead;                                                                        { 2900:0357 }
while c <> nil do begin                                                                { 2900:0363 }
  if (c^.active <> 0) and (c^.status <> 1) then begin                                  { 2900:036e }
    share := xp;                                                                       { 2900:038a }
    case c^.class of                                                                   { 2900:0395 }
      0: if c^.wis > 15 then share := xp div 10 + xp;                                  { 2900:03a2  cleric }
      2: if c^.str > 15 then share := xp div 10 + xp;                                  { 2900:03cf  fighter }
      3: if (c^.str > 15) and (c^.wis > 15) then share := xp div 10 + xp;              { 2900:03fc  paladin — new }
      4: if (c^.str > 15) and (c^.int > 15) and (c^.wis > 15) then share := xp div 10 + xp;   { 2900:0433  ranger — new }
      5: if c^.int > 15 then share := xp div 10 + xp;                                  { 2900:0474  magic-user }
      6: if c^.dex > 15 then share := xp div 10 + xp;                                  { 2900:04a0  thief }
      8, 10..14, 16: share := xp div 2;                                                { 2900:04c7  two classes }
      9, 15:         share := xp div 3;                                                { 2900:04f2  three classes }
    end;                                                                               { druid 1, monk 7: share = xp }
    c^.xp := c^.xp + share;                                                            { 2900:0511  +127h }
  end;
  c := c^.next;                                                                        { 2900:0523 }
end;
```

### 2900:053C ResolveCombatOutcome (M)
`procedure ResolveCombatOutcome` — RETF. Caller: AfterCombat (unless DemoMode). Callees: ComputeCombatXP, AwardXP, RemovePartyMember, RemoveEffect (RemoveEffect, ov23 below). Pool: 3900:04C9 (0.75).
Decides destroyed / fled / won, counts the members that do not share, awards XP, strips the end-of-combat effects, then repairs the party (runners return, dying become unconscious, unconscious with hp recover) or, after a flight, removes everyone who did not run; a destroyed party is emptied. **changed:** a second scan (`anyUp`) lets `Mem[7EE6]` (Pool `w[$5CC]`, the "nobody dies" script flag) keep the party alive; `Mem[7EE6]` also revives dying/unconscious members with 1 hp; 19 effect types are removed from every member; the separate duel branch now runs only in DemoMode.
```pascal
NonSharing := 0;  PartyDead := 1;  PartyFled := 0;                                     { 2900:0542 .. 054c }
c := PartyHead;                                                                        { 2900:0551 }
while (c <> nil) and (c^.combatant^[$13] <> 1) do begin                                { 2900:055d }
  if c^.status = 3 then PartyFled := 1;                                                { 2900:0574 }
  c := c^.next;                                                                        { 2900:0584 }
end;
anyUp := false;                                                                        { 2900:05a2  new }
c := PartyHead;                                                                        { 2900:0596 }
while (c <> nil) and not anyUp do begin                                                { 2900:05a6 }
  if (c^.active <> 0) or (c^.status in [4, 3, 5]) then anyUp := true;                  { 2900:05b4 }
  c := c^.next;                                                                        { 2900:05e4 }
end;
if (DuelActive <> 0) or ((Mem[7EE6] <> 0) and anyUp) then PartyDead := 0;              { 2900:05f6 }
PartyWon := 0;                                                                         { 2900:0614 }
c := PartyHead;                                                                        { 2900:0619 }
if (DuelActive = 0) or (DemoMode = 0) then begin                                       { 2900:0625  changed: the duel branch below is DemoMode-only }
  while (c <> nil) and (c^.combatant^[$13] <> 1) do begin                              { 2900:0636 }
    if (c^.status in [3, 1, 0]) and (c^.side = 0) and (c^.npc_morale < $80) then       { 2900:0653  a PC still standing / fled }
      PartyDead := 0;                                                                  { 2900:068a }
    if c^.status in [1, 0] then begin PartyWon := 1; PartyFled := 0 end;               { 2900:068f / 06a5 }
    if (c^.active = 0) or (c^.status = 1) then NonSharing := NonSharing + 1;           { 2900:06af / 06c5 }
    for i := 1 to 19 do RemoveEffect(c, combat_EndEffects[i], nil);                       { 2900:06ef / 06ea  new: RemoveEffect(c, type, nil) }
    c := c^.next;                                                                      { 2900:06f5 }
  end;
  if PartyWon <> 0 then begin                                                          { 2900:0708 }
    ComputeCombatXP(CombatXP);                                                         { 2900:070f }
    AwardXP(CombatXP);                                                                 { 2900:0718 }
  end;
  c := PartyHead;                                                                      { 2900:0724 }
  if PartyDead = 0 then begin                                                          { 2900:0730 }
    while (c <> nil) and (c^.combatant^[$13] <> 1) do begin                            { 2900:073a }
      if PartyFled = 0 then begin                                                      { 2900:0757 }
        case c^.status of                                                              { 2900:0761 }
          3: begin c^.status := 0; c^.active := 1 end;                                 { 2900:076d  Running → Okay }
          5: if Mem[7EE6] = 0 then c^.status := 4                                      { 2900:0786 / 0792  Dying → Unconscious }
             else begin c^.status := 0; c^.active := 1; c^.hp := 1 end;                { 2900:07af ..  new: revived with 1 hp }
          4: if c^.hp <> 0 then begin c^.status := 0; c^.active := 1 end               { 2900:07be / 07c9 }
             else if Mem[7EE6] <> 0 then begin c^.status := 0; c^.active := 1; c^.hp := 1 end;   { 2900:07dd / 07e9  new }
        end;
        c := c^.next;                                                                  { 2900:0804 }
      end else begin
        Mem[7EC7] := $81;                                                              { 2900:0816  Pool w[$58E]: combat result for the script = fled }
        if c^.status = 3 then begin c^.status := 0; c^.active := 1; c := c^.next end   { 2900:0821 / 083e }
        else begin
          SelectedChar := c;                                                           { 2900:0850 }
          c := c^.next;                                                                { 2900:085c  read before the record is freed (changed vs Pool) }
          RemovePartyMember(0, 1);                                                     { 2900:086c  left behind: removed from the party }
        end;
      end;
    end;
  end else begin
    c := PartyHead;  stop := false;                                                    { 2900:087c }
    while (c <> nil) and not stop do begin                                             { 2900:088c }
      if c^.combatant^[$13] = 1 then stop := true                                      { 2900:089a }
      else begin SelectedChar := c; RemovePartyMember(0, 1) end;                       { 2900:08a9 / 08b5 }
      c := c^.next;                                                                    { 2900:08c6  read after the free (as Pool) }
    end;
    Mem[7F3E] := 0;                                                                    { 2900:08d8  no party members }
  end;
end else begin                                                                         { DemoMode duel }
  while c <> nil do begin                                                              { 2900:08f2 }
    if (c^.active = 1) and (c^.status = 0) and (c^.side <> 1) then begin               { 2900:08fa }
      PartyWon := 1;                                                                   { 2900:091b }
      ComputeCombatXP(CombatXP);  AwardXP(CombatXP);                                   { 2900:0920 / 0929 }
    end;
    c := c^.next;                                                                      { 2900:0935 }
  end;
  c := PartyHead;                                                                      { 2900:0947 }
  while c <> nil do begin                                                              { 2900:0953 }
    if c^.status in [0, 1] then c^.active := 1;                                        { 2900:095b / 0971 }
    if c^.status = 5 then c^.status := 4;                                              { 2900:097a / 0985 }
    c := c^.next;                                                                      { 2900:098e }
  end;
end;
```
`combat_EndEffects` (DS:02A8..02BA, read as `[DI+2A7h]` with DI = 1..19; bytes from START.EXE): 03 0B 0D 15 17 1B 23 28 33 34 35 3A 5B 88 89 8B 8E 90 1F — the effect types that do not outlive a battle (names: ov23 / MAGIC lane). Note the loop reads the table through DS (no segment override at 2900:06df), GLOBALS.md lists it as `g_02A7`.

### 2900:0A7E ShowCombatResult (H)
`procedure ShowCombatResult(xp [BP+6]: LongInt)` — RETF 4. Caller: AfterCombat (with CombatXP). Callees: DrawScreenFrame, DrawText, @StrLong, FreeMem, FillChar, HorizontalMenu. Pool: 3900:0916 (0.82).
The result screen (COMBAT-05-01). `xp` is a value parameter: zeroing it only changes the number shown. **changed:** a fled party loses the whole treasure here (items freed, money cleared); "lost the fight" is shown (and `Mem[7EC7] := 80h`) when nobody won and `Mem[7EE6]` is set.
```pascal
DrawScreenFrame;                                                                       { 2900:0a8a }
if (EnemiesFought = 0) and (DuelActive = 0) then                                       { 2900:0a8f }
  DrawText(1, 3, 10, 0, 'The party has found Treasure!')                               { 2900:0bd4 }
else if PartyFled = 0 then begin                                                       { 2900:0aa0 }
  if ((DuelActive <> 0) and (PartyWon = 0)) or ((PartyWon = 0) and (Mem[7EE6] <> 0)) then begin   { 2900:0b30 .. 0b4f }
    Mem[7EC7] := $80;                                                                  { 2900:0b51  Pool w[$58E] }
    DrawText(1, 3, 10, 0, 'You have lost the fight.');                                 { 2900:0b5c }
    xp := 0;                                                                           { 2900:0b7d }
  end else if DuelActive <> 0 then DrawText(1, 3, 10, 0, 'You have won the duel.')     { 2900:0b87 / 0b8e }
  else DrawText(1, 3, 10, 0, 'The party has won.');                                    { 2900:0bb1 }
end else begin
  DrawText(1, 3, 10, 0, 'The party has fled.');                                        { 2900:0aaa }
  xp := 0;                                                                             { 2900:0acb }
  it := TreasureItems;                                                                 { 2900:0ad3  new: the treasure is lost }
  while it <> nil do begin n := it^.next; FreeMem(it, $3F); it := n end;               { 2900:0ae1 .. 0b1a }
  FillChar(TreasureMoney, $1C, 0);                                                     { 2900:0b1c }
end;
Str(xp:0, n);                                                                          { 2900:0bf5  string[10] }
if DuelActive <> 0 then s := 'The duelist receives ' + n                               { 2900:0c0c / 0c13 }
else s := 'Each character receives ' + n;                                              { 2900:0c3e }
DrawText(1, 5, 10, 0, s);                                                              { 2900:0c67 }
DrawText(1, 7, 10, 0, 'experience points.');                                           { 2900:0c7e }
HorizontalMenu('', 'press <enter>/<return> to continue', 15, 15, 15, 1, 0, ext);      { 2900:0c9f / 0cb5  result unused }
```

### 2900:0CE6 ChooseLootItem (M)
`procedure ChooseLootItem(var key [BP+12h]: Char; var sel [BP+0Eh]: PItem; var cur [BP+0Ah]: PItem; var index [BP+6]: Word)` — RETF 10h. Caller: TakeLootItems. Callees: DrawScreenFrame, BuildItemName, VerticalListMenu. Pool: 3900:0B14 (0.82).
```pascal
redraw := 1;                                                                           { 2900:0cec }
DrawScreenFrame;                                                                       { 2900:0cf0  changed: no 'Loot' title }
it := TreasureItems;                                                                   { 2900:0cf5 }
while it <> nil do begin                                                               { 2900:0d01 }
  BuildItemName(nil, it, 0, 0, 0, 0);                                                      { 2900:0d09  BuildItemName — refresh the names }
  it := it^.next;                                                                      { 2900:0d26 }
end;
list := TreasureItems;                                                                 { 2900:0d37 }
key := VerticalListMenu('Items: ', 'Take', 13, 10, 15, 1, 1, 38, 22, list, 1, redraw, index, cur);   { 2900:0d43 / 0d61  changed: top row 1 (Pool 4) }
sel := cur;                                                                            { 2900:0d99 }
```

### 2900:0DB1 TakeLootItems (M)
`procedure TakeLootItems` — RETF. Callers: TakeTreasureMenu (2×). Callees: ChooseLootItem, AddItemToChar, FreeMem, RedrawCurrentMode. Pool: 3900:0C06 (0.84), same body.
```pascal
sel := nil;  cur := TreasureItems;  index := 0;                                        { 2900:0db7 .. 0dcb }
repeat
  ChooseLootItem(key, sel, cur, index);                                                { 2900:0dd0 }
  if (key <> 'T') and (key <> #13) then done := true                                   { 2900:0de8 / 0df4 }
  else begin
    done := false;                                                                     { 2900:0dfb }
    AddItemToChar(sel, refused);                                                           { 2900:0dff  give to SelectedChar }
    if not refused then begin                                                          { 2900:0e0f }
      if TreasureItems = sel then TreasureItems := sel^.next                           { 2900:0e18 / 0e33 }
      else begin
        p := TreasureItems;                                                            { 2900:0e24 }
        while p^.next <> sel do p := p^.next;                                          { 2900:0e45 / 0e58 }
        p^.next := sel^.next;                                                          { 2900:0e69 }
      end;
      sel^.next := nil;                                                                { 2900:0e7d }
      if sel <> nil then FreeMem(sel, $3F);                                            { 2900:0e8a / 0e92  AddItemToChar keeps its own copy }
      if TreasureItems = nil then done := true;                                        { 2900:0ea0 }
    end;
  end;
until done;                                                                            { 2900:0ead }
RedrawCurrentMode;                                                                             { 2900:0eb6  RedrawCurrentMode }
```

### 2900:0ED7 TakeTreasureMenu (M)
`procedure TakeTreasureMenu(var money [BP+0Ah], items [BP+6]: Boolean)` — RETF 8. Caller: TreasureMenu (key `T`). Callees: TakeLootItems, TakeMoney, RedrawCurrentMode, HorizontalMenu, CycleSelectedChar, PartySummary, TreasurePoolStatus. Pool: 3900:0D38 (1.00).
```pascal
done := false;                                                                         { 2900:0edd }
if not money then begin TakeLootItems; exit end;                                       { 2900:0ee1 / 0fc3 }
if not items then begin TakeMoney; RedrawCurrentMode; exit end;                                { 2900:0eed / 0fb7 }
repeat
  key := HorizontalMenu('Take: ', 'Money Items Exit', 13, 10, 15, 1, 1, ext);          { 2900:0ef9 / 0f17 }
  case key of                                                                          { 2900:0f33 }
    'M': begin TakeMoney; RedrawCurrentMode end;                                               { 2900:0f3a }
    'I': TakeLootItems;                                                                { 2900:0f4a }
    'E', #0: done := true;                                                             { 2900:0f5e }
    'G', 'O': CycleSelectedChar(key);                                                          { 2900:0f62 / 0f71  47h/4Fh: select character }
  end;
  PartySummary(SelectedChar);                                                          { 2900:0f7a }
  TreasurePoolStatus(money, items);                                                             { 2900:0f87 }
  if (not money) or (not items) then done := true;                                     { 2900:0f96 }
until done;                                                                            { 2900:0fac }
```

### 2900:106C TreasureMenu (M)
`procedure TreasureMenu` — RETF. Caller: AfterCombat. Callees: RedrawCurrentMode, TreasurePoolStatus, HorizontalMenu, ViewMenu, TakeTreasureMenu, PoolMoney, ShareMoney, CastSpell, DrawWrappedText, MenuSelect, ClearTextRectangle, CycleSelectedChar, PartySummary. Pool: 3900:0ECD (0.98).
The treasure screen (COMBAT-05-03). **changed:** the Detect Magic scan covers all 84 memorised-spell slots, accepts spell 4Dh as well as 5 / 0Bh, and requires the character to be active.
```pascal
done := false;                                                                         { 2900:1078 }
RedrawCurrentMode;                                                                             { 2900:107d }
repeat
  money := false;                                                                      { 2900:1082 }
  TreasurePoolStatus(money, items);                                                             { 2900:1086 }
  menu := 'View Pool Exit';  i := 0;  tail := ' Exit';  detect := false;               { 2900:1095 .. 10c2 }
  while items and (i < 84) and not detect do begin                                     { 2900:10c7 }
    if (SelectedChar^.mem_spell[i] in [5, $0B, $4D]) and (SelectedChar^.active <> 0) then begin   { 2900:10db .. 111e }
      detect := true;  spell := SelectedChar^.mem_spell[i];                            { 2900:1125 / 112b }
    end;
    i := i + 1;                                                                        { 2900:1139 }
  end;
  if detect then tail := ' Detect Exit';                                               { 2900:113f / 1146 }
  if money then menu := 'View Take Pool Share' + tail                                  { 2900:115a / 1160 }
  else if items then menu := 'View Take Pool' + tail;                                  { 2900:118c / 1192 }
  key := HorizontalMenu('', menu, 13, 10, 15, 1, 1, ext);                              { 2900:11bc }
  case key of                                                                          { 2900:11e6 }
    'V': ViewMenu(ext);                                                               { 2900:11ee }
    'T': TakeTreasureMenu(money, items);                                               { 2900:1200 }
    'P': if not ext then PoolMoney;                                                    { 2900:1215 / 121c }
    'S': ShareMoney;                                                                    { 2900:1228 }
    'D': CastSpell(spell, 0, 0, ext);                                                  { 2900:1234 }
    'E', #0: begin                                                                     { 2900:124d }
        TreasurePoolStatus(money, items);                                                       { 2900:1258 }
        if (not money) and (not items) then done := true                               { 2900:1267 / 1323 }
        else begin
          menu := '~Yes ~No';                                                          { 2900:1276 }
          DrawWrappedText(1, 17, 38, 22, 10, 0, 1, 'There is still treasure left.  ');   { 2900:128a }
          DrawWrappedText(1, 17, 38, 22, 15, 0, 0, 'Do you want to go back and claim your treasure?');   { 2900:12b4 }
          if MenuSelect('', menu, 13, 10, 15, 0, 0) = 1 then done := true              { 2900:12de / 1302  "No" }
          else ClearTextRectangle(1, 17, 38, 22);                                      { 2900:1310 }
        end;
      end;
    'G', 'O': begin CycleSelectedChar(key); PartySummary(SelectedChar) end;                    { 2900:132e / 134b }
  end;
until done;                                                                            { 2900:1362 }
```

### 2900:1370 RemoveMonstersAfterCombat (M)
`procedure RemoveMonstersAfterCombat` — RETF. Caller: AfterCombat. Callees: RemovePartyMember, FreeMem. Pool: 3900:11AC (0.78). **changed:** sets `EnemiesFought := 1` when any non-party combatant or enemy-side member is found (so "The party has found Treasure!" needs a monster-free list).
```pascal
Mem[7EC8] := 0;                                                                        { 2900:1376  Pool w[$590]: defeated enemies }
c := PartyHead;                                                                        { 2900:1381 }
while c <> nil do                                                                      { 2900:138d }
  if (c^.combatant^[$13] = 1) or (c^.side = 1) then begin                              { 2900:1398 / 13a7 }
    EnemiesFought := 1;                                                                { 2900:13b2  new }
    if c^.active <> 1 then Mem[7EC8] := Mem[7EC8] + 1;                                 { 2900:13b7 / 13c2 }
    n := c^.next;                                                                      { 2900:13cb }
    SelectedChar := c;                                                                 { 2900:13db }
    RemovePartyMember(Ord(c^.combatant^[$13] = 1), 1);                                 { 2900:13e7 / 13fc }
    c := n;                                                                            { 2900:1405 }
  end else begin
    if c^.combatant <> nil then begin                                                  { 2900:1412 }
      FreeMem(c^.combatant, $16);                                                      { 2900:1421 }
      c^.combatant := nil;                                                             { 2900:1433 }
    end;
    c := c^.next;                                                                      { 2900:1442 }
  end;
SelectedChar := PartyHead;                                                             { 2900:1455 }
```

### 2900:14AC NpcTakesShare (H)
`procedure NpcTakesShare` — RETF. Caller: AfterCombat. Callees: @LongDivMod, DrawScreenFrame, DrawWrappedText, HorizontalMenu. Pool: 3900:12E8 (0.74). **changed:** "his" / "her" by `c^.gender` (+119h).
```pascal
hid := false;  npcShares := 0;  total := 0;                                            { 2900:14af .. 14c3 }
c := PartyHead;                                                                        { 2900:14b7 }
while c <> nil do begin                                                                { 2900:14cb }
  if (c^.npc_morale >= $80) and (c^.status = 0) then begin                             { 2900:14d3 / 14de }
    npcShares := npcShares + (c^.npc_shares and 7);                                    { 2900:14e9 }
    total := total + (c^.npc_shares and 7);                                            { 2900:14f6 }
  end else total := total + 1;                                                         { 2900:1505 }
  c := c^.next;                                                                        { 2900:1508 }
end;
if npcShares <> 0 then                                                                 { 2900:151a }
  for k := 0 to 6 do                                                                   { 2900:1526 }
    if TreasureMoney[k] > 0 then begin                                                 { 2900:1529  signed 32-bit }
      per := Byte(TreasureMoney[k] div total);                                         { 2900:1543  quotient truncated to a byte }
      TreasureMoney[k] := TreasureMoney[k] - LongInt(SmallInt(npcShares * per));       { 2900:1563 }
      hid := true;                                                                     { 2900:1587 }
    end;
if hid then begin                                                                      { 2900:158f }
  DrawScreenFrame;                                                                     { 2900:159e }
  c := PartyHead;  row := 0;                                                           { 2900:15a3 }
  while c <> nil do begin                                                              { 2900:15b3 }
    if (c^.npc_morale > $7F) and (c^.status = 0) and (c^.npc_shares <> 0) then begin   { 2900:15be .. 15da }
      if c^.gender = 0 then                                                            { 2900:15e8 }
        DrawWrappedText(5, row + 5, 34, 22, 10, 0, 1, c^.name + ' takes and hides his share.')   { 2900:15f3 / 163c }
      else DrawWrappedText(5, row + 5, 34, 22, 10, 0, 1, c^.name + ' takes and hides her share.');   { 2900:1643 / 168c }
      row := row + 2;                                                                  { 2900:1691 }
    end;
    c := c^.next;                                                                      { 2900:1695 }
  end;
  HorizontalMenu('', 'press <enter>/<return> to continue', 15, 15, 15, 1, 0, ext);    { 2900:16a8 / 16c6 }
end;
```

### 2900:1736 AfterCombat (H)
`procedure AfterCombat` — RETF, entry (stub e1). Caller: ecl_op24_Combat. Callees: ResolveCombatOutcome, RemoveMonstersAfterCombat, RecalcItems, NpcTakesShare, ShowCombatResult, TreasureMenu, FreeMem, DrawScreenFrame, DrawWrappedText, ShowBottomPromptAndReadKey. Pool: 3900:1527 (0.66). **changed:** DemoMode skips the outcome, the NPC/result/treasure screens and the cleanup; every member's item slots are recalculated; a fled party's items are freed before the screens.
```pascal
Mem[7EC7] := 0;                                                                        { 2900:173c  combat result for the script }
EnemiesFought := 0;                                                                    { 2900:1747 }
if DemoMode = 0 then ResolveCombatOutcome;                                             { 2900:174c / 1753 }
view_Mode := 6;                                                                        { 2900:1757  "after combat" mode (Pool game_Mode := 6) }
RemoveMonstersAfterCombat;                                                             { 2900:175c }
if DemoMode = 0 then begin                                                             { 2900:1760 }
  c := PartyHead;                                                                      { 2900:176a }
  while c <> nil do begin RecalcItems(c); c := c^.next end;                            { 2900:1776 / 177e  new }
  if (PartyDead = 0) or (DuelActive <> 0) then begin                                   { 2900:179b }
    if PartyFled <> 0 then begin                                                       { 2900:17ac  new }
      it := TreasureItems;                                                             { 2900:17b3 }
      while it <> nil do begin n := it^.next; FreeMem(it, $3F); it := n end;           { 2900:17bf .. 17ef }
      TreasureItems := nil;                                                            { 2900:17f1 }
    end;
    if DemoMode = 0 then begin                                                         { 2900:17f9 }
      NpcTakesShare;                                                                   { 2900:1800 }
      ShowCombatResult(CombatXP);                                                      { 2900:1804 }
      TreasureMenu;                                                                    { 2900:1810 }
    end;
    it := TreasureItems;                                                               { 2900:1814  unclaimed items are lost }
    while it <> nil do begin n := it^.next; FreeMem(it, $3F); it := n end;             { 2900:1820 .. 1850 }
    TreasureItems := nil;                                                              { 2900:1852 }
  end else begin
    Mem[7EC7] := $80;                                                                  { 2900:185c  party destroyed }
    DrawScreenFrame;                                                                   { 2900:1867 }
    text_Col := 2;  text_Row := 6;                                                     { 2900:186c }
    DrawWrappedText(2, 5, 37, 22, 10, 0, 1, 'The monsters rejoice for the party has been destroyed');   { 2900:1876 / 189a }
    ShowBottomPromptAndReadKey(13, 0, 'Press any key to continue');                   { 2900:189f / 18b4 }
  end;
  TextOutputActive := 1;                                                               { 2900:18b9 }
  Mem[7F70] := 0;  Mem[7F71] := 0;  Mem[7F72] := 0;                                    { 2900:18be ..  Pool w[$6E0..$6E4]: side to-hit modifiers }
  Mem[7EE3] := 0;                                                                      { 2900:18df  "no loot" flag }
  Mem[7EE6] := 0;                                                                      { 2900:18ea  "nobody dies" flag }
end;
```

### 2900:18F9 ov05_init (H)
Empty unit initialiser (`PUSH BP; MOV BP,SP; POP BP; RETF`) { 2900:18f9 }.

---

## ov07 (seg 2C00) — ECL VM support and the encounter / duel / damage helpers

Unit: ov07, analysis segment 2C00, 23A8h bytes, 34 functions, 33 overlay entries (layout.txt). Pool twin: ov07 4300 (shape 0.80..1.00 everywhere; `ecl_SkipInstruction` 0.65 because the skip table grew with the new opcodes).
**The VM routines are specified in `decode/ecl/ECL_VM.md` and are not repeated here** (names from ecl_names.json, confirmed against the asm by the ECL lane):

| address | name | spec |
|---|---|---|
| 2C00:0034 | ecl_ReadOperands(n) | ECL_VM.md §2 (operand decoder) |
| 2C00:0173 | ecl_OperandValue(i) | §2 |
| 2C00:01FC | ecl_InitVM | §1 table (flags, 3D colours, stack) |
| 2C00:0380 | LoadEclBlock(n) | §1 table (ECL record load, 1E00h buffer) |
| 2C00:070D | ecl_SixBitChar | §2.2 (packed text) |
| 2C00:0735 | ecl_MemRegion(a) | §3 |
| 2C00:07F1 / 0B6D | ecl_GetCharField / ecl_SetCharField | §3.1 (region-1 character overlay) |
| 2C00:0D70 / 0F3A | ecl_SetMem(v, a) / ecl_GetMem(a) | §3, §3.2 |
| 2C00:108D / 145C | ecl_SetMemString / ecl_GetMemString | §3 (strings) |
| 2C00:12AE | ecl_UnpackString | §2.2 |
| 2C00:197B / 1A51 | ecl_CompareStrings / ecl_CompareWords | §1 table (condition flags DS:75F8..75FD) |
| 2C00:1AB9 | ecl_Gosub(i) | §4.1 GOSUB |
| 2C00:1FF5 | ecl_SkipInstruction | §2.4 (IF skip table) |

The remaining routines (encounter picture, approach distance, menus, duel, rob, damage) follow. Globals: `pic_HeadId{g_4FC5}`, `pic_BodyId{g_4FC6}` (Pool 49FD/49FE), `enc_Anim` g_722C (TAnim; `enc_Anim.pic[1]` = g_7232:7234), `enc_SpriteOnScreen` g_8B65, `enc_LastHeadId` g_8B6C, `enc_MenuActive` g_8B6B, `opt_MonsterPics{g_4FC0}` (Pool 49F6, M), `view_RedrawPicture` g_8B62, `view_RedrawPos` g_8B68, `g_8B63` (Pool g_84E1, picture-shown flag of the game loop, unnamed), `enc_NextIconSlot` g_7603, `text_Col/text_Row` g_65A0/g_65A1.

### 2C00:0000 ov07_LoadDeps (M)
Nine `CALLF` into entry 0 of ov16, ov29, ov23, ov28, ov19, ov24, ov34, ov26, ov33 { 2c00:0003 .. 002f } (dependency touch, as ov05_LoadDeps).

### 2C00:0456 LoadMonsterRecord (H)
`procedure LoadMonsterRecord(id [BP+12h]: Byte; var rec [BP+0Eh]: PChar; var items [BP+0Ah], effects [BP+6]: Pointer)` — RETF 0Eh. Caller: ecl_op0B_LoadMonster. Callees: GetMem, LoadMonster (LoadMonster, PARTY lane). Pool: 4300:0411 ecl_LoadMonsterRec (0.81).
```pascal
rec := nil;                                                                            { 2c00:045c }
GetMem(rec, $1A6);                                                                     { 2c00:0468  one 422-byte character (Pool 11Dh) }
LoadMonster(id, rec^);                                                                   { 2c00:0476  load monster id into rec^ }
items := rec^.items;                                                                   { 2c00:0489  +14Dh }
effects := rec^.effects;                                                               { 2c00:04a0  +F2h }
```

### 2C00:04BD ApproachDistance (H)
`function ApproachDistance(x [BP+0Ah], y [BP+8]: ShortInt; dir [BP+6]: Byte): Byte` — RETF 6. Callers: ecl_op0C_SetupMonster, ecl_op24_Combat, ecl_op29_EncounterMenu. Callee: GetWallType (VIEW). Pool: 4300:0482 (0.91), same body. Open squares (0..2) in front of the party; 2 outside 3D areas.
```pascal
steps := 0;  blocked := false;  Result := 0;                                           { 2c00:04c3 .. 04cb }
if Mem[4BE6] = 0 then begin                                                            { 2c00:04cf  3D-area flag }
  Result := 2;  Mem[7EC1] := 2;                                                        { 2c00:04db / 04df  Pool w[$582]: encounter distance }
end else
  while (steps < 2) and not blocked do                                                 { 2c00:04ec }
    if GetWallType(x, y, dir) = 0 then begin                                           { 2c00:04f8 }
      steps := steps + 1;  Result := steps;                                            { 2c00:050d / 0510 }
      case dir of 0: y := y - 1; 2: x := x + 1; 4: y := y + 1; 6: x := x - 1 end;      { 2c00:0516 .. 053e }
    end else blocked := true;                                                          { 2c00:0543 }
```

### 2C00:0552 ShowHeadBodyPicture (H)
`procedure ShowHeadBodyPicture(head [BP+8], body [BP+6]: Byte)` — RETF 4. Callers: ShowEncounter, ecl_op0E_Picture. Callees: LoadPortrait, DrawPortrait (VIEW). Pool: 4300:0511 (0.98).
```pascal
g_8B63 := 0;                                                                           { 2c00:0555 }
pic_HeadId := head;  pic_BodyId := body;                                               { 2c00:055a / 0560 }
LoadPortrait(head, body);                                                              { 2c00:0566 }
DrawPortrait(3, 3, true);                                                              { 2c00:0573  head at (3,3), body below }
```

### 2C00:0591 ShowEncounter (H)
`procedure ShowEncounter(sprite [BP+0Eh], pic [BP+0Ch], dist [BP+0Ah]: Byte; var shown [BP+6]: array[0..1] of Boolean)` — RETF 0Ah. Callers: ecl_op0C_SetupMonster, ecl_op0D_Approach, ecl_op29_EncounterMenu. Callees: RefreshView, LoadAnimation, Show3DSprite, DrawPictureScreenOrView, ShowHeadBodyPicture. Pool: 4300:054E (0.91). `shown[0]` = sprite shown, `shown[1]` = picture shown (the caller's `enc_SpriteShown`/`enc_PictureShown`). **changed:** the sprite is only loaded in 3D areas (`Mem[4BE6]`), the refresh is gated by `view_Redraw`, "3D" is `view_Mode = 4` (no travel mode), and the sprite is drawn only in 3D (Pool drew frame 2 elsewhere).
```pascal
size := dist + 1;                                                                      { 2c00:0597  frame 1..3 }
if not shown[1] then begin                                                             { 2c00:05a0 }
  if not shown[0] then begin                                                           { 2c00:05aa }
    if view_AreaMap <> 0 then begin                                                    { 2c00:05b3 }
      view_AreaMap := 0;  view_Redraw := 1;  RefreshView;                              { 2c00:05ba .. 05c4 }
    end;
    if Mem[4BE6] <> 0 then begin                                                       { 2c00:05c9  3D area }
      LoadAnimation('SPRIT', sprite, 1, enc_Anim);                                     { 2c00:05d5 / 05e4 }
      shown[0] := true;  enc_SpriteOnScreen := 1;                                      { 2c00:05f5 / 05fc }
    end;
  end else begin view_Redraw := 1; RefreshView end;                                    { 2c00:0603 / 0608  erase the old sprite }
  if view_Mode = 4 then Show3DSprite(size, enc_Anim);                                  { 2c00:060d / 0614 }
end;
if shown[1] and (enc_LastHeadId = Lo(Mem[7EE1])) then exit;                            { 2c00:0622 .. 063a  Pool w[$5C2] = head id }
if dist <> 0 then exit;                                                                { 2c00:063f }
if view_Mode <> 4 then exit;                                                           { 2c00:0648 }
if (enc_MenuActive <> 0) and (opt_MonsterPics = 0) then exit;                          { 2c00:0652 / 0659 }
enc_LastHeadId := Lo(Mem[7EE1]);                                                       { 2c00:0663 }
view_RedrawPicture := 1;                                                               { 2c00:066f }
if Mem[7EE1] = $FF then begin                                                          { 2c00:0674  no head: full picture }
  LoadAnimation('PIC', pic, 0, enc_Anim);                                              { 2c00:0681 / 0690 }
  shown[1] := true;                                                                    { 2c00:06a1 }
  DrawPictureScreenOrView(3, 3, true, enc_Anim.pic[1]);                                { 2c00:06a9  g_7232 }
end else begin
  ShowHeadBodyPicture(Lo(Mem[7EE1]), pic);                                             { 2c00:06c3 / 06d2 }
  shown[1] := true;  g_8B63 := 0;                                                      { 2c00:06d5 / 06dd }
end;
```

### 2C00:06E8 MakeWord (H)
`function MakeWord(lo [BP+8], hi [BP+6]: Byte): Word` — `Result := hi * 256 + lo` { 2c00:06ee }. Pool: 4300:06AF (0.94).

### 2C00:0790 PartyIndexOf (H)
`function PartyIndexOf(c [BP+6]: PChar): Byte` — RETF 4. Caller: ecl_GetCharField (§3.1, cells 7EB1/7EB4). Pool: 4300:0756 (0.83). 0-based list position of `c` (list length when absent).
```pascal
p := PartyHead;  found := false;  n := 0;                                              { 2c00:0796 .. 07a6 }
while (p <> nil) and not found do                                                      { 2c00:07aa }
  if p = c then found := true                                                          { 2c00:07b8 / 07c7 }
  else begin n := n + 1; p := p^.next end;                                             { 2c00:07cd / 07d0 }
Result := n;                                                                           { 2c00:07e2 }
```

### 2C00:16D3 MenuHotkeys (H)
`procedure MenuHotkeys(var s [BP+0Ah]: String; var keys [BP+6]: String[40])` — RETF 8. Callers: MenuSelect, EclVerticalListMenu. Pool: 4300:156D (1.00). Set constant CS:16B3 (`['0'..'9', 'A'..'Z']`, 32 bytes). Lower-cases a `~`-marked menu text and collects the letter after each `~` as a hot key.
```pascal
keys := '';                                                                            { 2c00:16da }
n := Length(s);                                                                        { 2c00:16e1  taken once }
for i := 1 to n do begin                                                               { 2c00:16ea }
  if s[i] in ['0'..'9', 'A'..'Z'] then s[i] := Chr(Ord(s[i]) + $20);                   { 2c00:16fc / 1716 }
  if s[i] = '~' then begin                                                             { 2c00:1737 }
    Delete(s, i, 1);                                                                   { 2c00:1747 }
    s[i] := UpCase(s[i]);                                                              { 2c00:175b }
    keys := keys + s[i];                                                               { 2c00:177d .. 17b4  StrAssign(40) }
  end;
end;
```
Quirks as Pool: digits become `P..Y` unless they follow a `~`; after a `Delete` the loop still runs to the original length.

### 2C00:17EA MenuSelect (H)
`function MenuSelect(title [BP+14h]: String[40]; items [BP+10h]: String; promptColour [BP+0Eh], textColour [BP+0Ch], hotColour [BP+0Ah]: Byte; acceptEnter [BP+8], animate [BP+6]: Boolean): Byte` — RETF 12h. Callers: ecl_op29_EncounterMenu, ecl_op2B_HorizontalMenu, ecl_op2C_Parlay, ov05 TreasureMenu and other units via stub ov07 e20. Callees: MenuHotkeys, HorizontalMenu, CycleSelectedChar, PartySummary. Pool: 4300:1684 (1.00).
Bottom-line hot-key menu; returns the 0-based index of the chosen item, 0 for Enter, FFh for a letter/digit that is no hot key.
```pascal
t := title;  m := items;                                                               { 2c00:17f1 / 1804 }
MenuHotkeys(m, keys);                                                                  { 2c00:1818 }
repeat
  key := HorizontalMenu(t, m, promptColour, textColour, hotColour, true, animate, ext);   { 2c00:1828 }
  if ext then begin                                                                    { 2c00:1855 }
    CycleSelectedChar(key);  PartySummary(SelectedChar);  key := #0;                           { 2c00:185c / 1866 / 1873 }
  end;
until (key in ['0'..'9', 'A'..'Z']) or ((key = #13) and acceptEnter);                  { 2c00:1878 .. 1894  set CS:17CA }
if key = #13 then Result := 0                                                          { 2c00:1896 / 189e }
else begin
  k := 1;                                                                              { 2c00:18a4 }
  while (k <= Length(keys)) and (keys[k] <> key) do k := k + 1;                        { 2c00:18a9 .. 18c9 }
  if k <= Length(keys) then Result := k - 1 else Result := $FF;                        { 2c00:18cb / 18d5 / 18e1 }
end;
```

### 2C00:18EE EclVerticalListMenu (M)
`procedure EclVerticalListMenu(title [BP+2Ah]: String[40]; options [BP+26h]: String; headerColour [BP+24h], normalColour [BP+22h], selColour [BP+20h], left [BP+1Eh], top [BP+1Ch], right [BP+1Ah], bottom [BP+18h]: Byte; list [BP+14h]: Pointer; showExit [BP+12h]: Boolean; var redraw [BP+0Eh]: Boolean; var index [BP+0Ah]: Integer; var item [BP+6]: Pointer)` — RETF 28h. Caller: ecl_op15_VerticalMenu. Callees: MenuHotkeys, VerticalListMenu (VIEW 6800:0DF9). Pool: 4300:1788 (1.00).
```pascal
t := title;  m := options;                                                             { 2c00:18f5 / 1908 }
MenuHotkeys(m, keys);                                                                  { 2c00:191c  keys unused }
VerticalListMenu(t, m, headerColour, normalColour, selColour, left, top, right, bottom, list, showExit, redraw, index, item);   { 2c00:192c  key result dropped }
```

### 2C00:1B3F StepForward (H)
`procedure StepForward` — RETF. Caller: ecl_op2D_Call (CALL C01Eh). Callees: GetCellAttr, GetWallType (VIEW). Pool: 4300:19DB (0.89). **changed:** sets `view_RedrawPos`.
```pascal
case party_Dir of                                                                      { 2c00:1b42 }
  0: if party_MapY > 0 then party_MapY := party_MapY - 1 else party_MapY := 15;        { 2c00:1b4c .. 1b59 }
  2: if party_MapX < 15 then party_MapX := party_MapX + 1 else party_MapX := 0;        { 2c00:1b65 .. 1b72 }
  4: if party_MapY < 15 then party_MapY := party_MapY + 1 else party_MapY := 0;        { 2c00:1b7e .. 1b8b }
  6: if party_MapX > 0 then party_MapX := party_MapX - 1 else party_MapX := 15;        { 2c00:1b97 .. 1ba4 }
end;
party_CellAttr := GetCellAttr(party_MapX, party_MapY);                                 { 2c00:1ba9 / 1bb1 }
party_Ahead := GetWallType(party_MapX, party_MapY, party_Dir);                         { 2c00:1bb9 / 1bc5 }
view_RedrawPos := 1;                                                                   { 2c00:1bcd  new }
```

### 2C00:1BE0 SetupDuel (M)
`procedure SetupDuel(withOpponent [BP+6]: ShortInt)` — RETF 2. Caller: ecl_op2D_Call (CALL 8000h → 1, 8001h → 0). Callees: @StrCompare, LoadCombatIcon (VIEW), GetMem, @CopyBytes, @StrAssign. Pool: 4300:1A6F (0.84), same logic with the 422-byte record. Leaves only the selected character active and, with `withOpponent`, appends a copy of them named ROLF on side 1 (computer-controlled → ov09 plays it).
```pascal
DuelActive := 1;                                                                       { 2c00:1be6 }
Mem[7EE6] := withOpponent;                                                             { 2c00:1beb  Pool w[$5CC], sign-extended }
me := SelectedChar;                                                                    { 2c00:1bf8 }
c := PartyHead;                                                                        { 2c00:1c04 }
while c <> nil do begin                                                                { 2c00:1c10 }
  if c^.name <> me^.name then c^.active := 0;                                          { 2c00:1c18 / 1c29 }
  c := c^.next;                                                                        { 2c00:1c32 }
end;
if withOpponent = 0 then exit;                                                         { 2c00:1c44 }
LoadCombatIcon('CPIC', $0B, enc_NextIconSlot);                                         { 2c00:1c4d / 1c5c }
c := PartyHead;                                                                        { 2c00:1c68 }
while c^.next <> nil do c := c^.next;                                                  { 2c00:1c74 / 1c83 }
GetMem(r, $1A6);                                                                       { 2c00:1c95 }
r^ := me^;                                                                             { 2c00:1ca3  CopyBytes 1A6h }
r^.active := 1;  r^.next := nil;                                                       { 2c00:1cb6 / 1cbf }
r^.name := 'ROLF';                                                                     { 2c00:1cce  StrAssign(15) }
r^.controlled := 1;  r^.side := 1;  r^.npc_morale := $B2;                              { 2c00:1ce1 / 1cea / 1cf3 }
r^.icon_slot := enc_NextIconSlot;                                                      { 2c00:1cfc  +143h }
r^.effects := nil;  r^.items := nil;                                                   { 2c00:1d07 / 1d16 }
c^.next := r;                                                                          { 2c00:1d25 }
c := c^.next;                                                                          { 2c00:1d37 }
it := me^.items;                                                                       { 2c00:1d47 }
while it <> nil do begin                                                               { 2c00:1d57 }
  if c^.items = nil then begin                                                         { 2c00:1d62 }
    GetMem(c^.items, $3F);  c^.items^ := it^;  c^.items^.next := nil;                  { 2c00:1d71 / 1d83 / 1d9b }
  end else begin
    old := c^.items;                                                                   { 2c00:1daf }
    GetMem(c^.items, $3F);  c^.items^ := it^;  c^.items^.next := old;                  { 2c00:1dbf / 1dd1 / 1de9  prepended: reverse order }
  end;
  it := it^.next;                                                                      { 2c00:1dfe }
end;
```
Quirks (as Pool): members with the selected character's name stay active; `enc_NextIconSlot` is not incremented; ROLF's effects are not copied.

### 2C00:1E16 RobMoney (H)
`procedure RobMoney(f [BP+0Ah]: Real; c [BP+6]: PChar)` — RETF 0Ah. Caller: ecl_op28_Rob. Pool: 4300:1CC3 ScaleMoney (0.99).
```pascal
for k := 0 to 6 do c^.money[k] := Trunc(c^.money[k] * f);                              { 2c00:1e19 .. 1f37  unrolled: +FBh, +FDh, +FFh, +101h, +103h, +105h, +107h; word → LongToReal, RealMul, Trunc }
```

### 2C00:1F45 LoseItems (H)
`procedure LoseItems(p [BP+0Ah]: Byte; c [BP+6]: PChar)` — RETF 6. Caller: ecl_op28_Rob (p = ROB operand 2). Callees: Roll, LoseItem. Pool: 4300:1DF0 LoseItemsChance (0.90), same body (weight now at +37h).
```pascal
it := c^.items;                                                                        { 2c00:1f4b }
while it <> nil do begin                                                               { 2c00:1f5b }
  if it^.weight > $FF then begin if p > $5A then p := p - $5A else p := 0 end           { 2c00:1f66 / 1f8a .. 1fa5 }
  else if it^.weight > $18 then begin if p > $32 then p := p - $32 else p := 0 end;     { 2c00:1f66 .. 1f88 }
  r := Roll(1, 100);                                                                   { 2c00:1fab }
  nxt := it^.next;                                                                     { 2c00:1fb9 }
  if r <= p then LoseItem(c, it);                                                      { 2c00:1fc8 / 1fd0 }
  it := nxt;                                                                           { 2c00:1fe1 }
end;
```

### 2C00:2137 PartyMoveRange (H)
`procedure PartyMoveRange(var maxMove [BP+0Ah], minMove [BP+6]: Byte)` — RETF 8. Caller: ecl_op29_EncounterMenu. Callee: HasEffect. Pool: 4300:1FB1 (0.92), same body (move at +1A5h).
```pascal
c := PartyHead;                                                                        { 2c00:213d }
maxMove := c^.move;  minMove := c^.move;                                               { 2c00:2149 / 2157  read before the nil test }
while c <> nil do begin                                                                { 2c00:2165 }
  m := c^.move;                                                                        { 2c00:2170 }
  if HasEffect(c, $27, e) then m := Byte(m * 2)                                        { 2c00:217b / 2192  haste }
  else if HasEffect(c, $2A, e) then m := m shr 1;                                      { 2c00:219e / 21b5  slow }
  if m > maxMove then maxMove := m;                                                    { 2c00:21c3 / 21ce }
  if m < minMove then minMove := m;                                                    { 2c00:21d7 / 21e2 }
  c := c^.next;                                                                        { 2c00:21eb }
end;
```

### 2C00:2252 ApplyEclDamage (H)
`procedure ApplyEclDamage(dmg [BP+0Ah]: Word; c [BP+6]: PChar)` — RETF 6. Caller: ecl_op2E_Damage. Callees: @StrLong, ShowBottomPromptAndReadKey, DrawWrappedText, ApplyDamage, ClearTextRectangle, PartySummary. Pool: 4300:20CC (0.98). Strings: CS:2204 `'  '`, 2207 ` dies. `, 220F ` is hit FOR `, 221C ` points of Damage.`, 222F `press <enter>/<return> to continue`.
```pascal
if c^.status = 6 then exit;                                                            { 2c00:2259  Dead }
clear := 0;                                                                            { 2c00:2267 }
Str(dmg:0, num);                                                                       { 2c00:226c  string[3] }
if c^.hp + 10 < dmg then s := '  ' + c^.name + ' dies. '                               { 2c00:2285 / 2297  +1A4h }
else s := '  ' + c^.name + ' is hit FOR ' + num + ' points of Damage.';                { 2c00:22cc }
if text_Row > $16 then begin                                                           { 2c00:2314  cursor below the text window }
  text_Row := $11;  clear := 1;                                                        { 2c00:231b / 2320 }
  ShowBottomPromptAndReadKey(15, 0, 'press <enter>/<return> to continue');             { 2c00:2325 / 233b }
end else clear := 0;                                                                   { 2c00:2342 }
text_Col := $26;                                                                       { 2c00:2347 }
DrawWrappedText(1, $11, $26, $16, 15, 0, clear, s);                                    { 2c00:234c }
ApplyDamage(c, Lo(dmg));                                                                 { 2c00:236e  ApplyDamage — damage truncated to a byte }
ClearTextRectangle($11, 1, $26, 15);                                                   { 2c00:237d  roster area }
PartySummary(SelectedChar);                                                            { 2c00:238e }
```

### 2C00:23A1 ov07_init (H)
Empty unit initialiser { 2c00:23a1 }.

---

## ov09 (seg 3100) — combat AI: the computer-controlled combatant turn

Unit: ov09, analysis segment 3100, 1BCDh bytes, 16 functions, entry `AiCombatTurn` (stub e1) + `ov09_init` (e0) + `ov09_LoadDeps`. Pool twin: ov09 4D00 (shape 0.88..1.00; AiCanStep 0.62 and AreaHitsFriend 0.66 grew).
Role: the turn of every combatant the computer plays — monsters and party members in Quick mode (`c^.controlled` +198h <> 0). Morale/flight, turn undead, magic items, spell choice, weapon choice, step-by-step movement and the attack. Callers: ov08 (the combat round / player turn, PARTY-COMBAT lane; stub ov09 e1).
Strings (code segment): 3100:003E `flees in panic`, 09AB `Move/Attack, Move Left = `, 09C5 ` `, 1260 `Magic On`, 1269 `Magic Off`, 136B `is forced to flee`, 137D `Surrenders`.
Combat record `cb = c^.combatant^` (+18Dh), fields as Pool (ov13 owns the record): `castingSpell +0`, `mayCast +1`, `mayUseItems +2`, `initiative +3` (signed; 14h = handed back to the player), `moveLeft +6` (half squares), `guarding +7`, `facing +9`, `target +0Ah` (far ptr), `turned +10h`, `hasTurned +11h`, `fleeing +14h`, `movePattern +15h` (1..6).
Tables: `ITEMS[t]` = 16 bytes at `ItemTypeTable (g_5CF6, ENGINE name) + t*16` (`slot +0`, `hands +1`, `range +0Ch` g_5D02, `usable_by +0Dh` g_5D03, `wflags2 +0Eh` g_5D04 — Pool DS:5582 layout, M); spell table `spells_Table{g_37DA} + s*16` (`harmless +8` g_37E2, `saveType +9` g_37E3, `aiValue +0Dh` g_37E7, `needsTarget +0Eh` g_37E8, `areaSize +0Fh` g_37E9 — Pool DS:31FA +0Dh..+0Fh; the +8/+9 fields are new here, names M); `ai_DirOffsets{g_02BB}` (DS:02BC..02D9, `[pattern*5 + try]`, pattern 1..6, try 1..5; bytes from START.EXE: pattern 1 `08 07 06 01 02`, 2 `08 01 02 07 06`, 3 `07 01 08 06 02`, 4 `01 07 08 02 06`, 5 `08 07 06 05 04`, 6 `08 01 02 03 04` — added to the base direction mod 8, so 8 = straight on); `CombatTerrain` g_26A2 (`[tile*4]` = move cost, FFh = impassable).
Globals: `ai_LastStepDir{g_47F0}`, `ai_StuckCount{g_47F1}`, `g_47F2` (cleared, never read), `ai_InReach{g_75E4}` (Pool's local `canHit`, now also the display gate of AiMove), `MagicOn` g_75DA, `enemy_HpPercent{g_75D9}` (Pool 6E2F, written by CalcEnemyHpPct CalcEnemyHpPct), `morale_Value{g_6FA2}` (Pool g_6825), `side_ActiveCount{g_6F90}` (Pool 6814, `[Ord(IsSideZero(c))]` = opponents still active), `foe_List{g_758E}` (Pool foe_List g_6DE4: combatant indices from CollectOppositeSideTargets — GLOBALS.md's alignment "6822 AttackRollValue" is wrong for this cell), `cb_Char` g_6D35, `cb_Col/cb_Row` g_66A3/g_66A4, `tg_List/tg_Count` g_6E94/g_6E96, `cm_Map` g_6E92, `combat_Visible` g_75E6, `party_Dir` g_7211.
Other-unit callees (Pool role in brackets, names M unless published): `ClearCharacterMessage` (ClearCharacterMessage), `ClearCombatantActionFlags` (ClearCombatantActionFlags(c): Boolean, always true), `ShowCharacterMessage` (ShowCharacterMessage(c, msg, row, wait)), `IsSideZero` (IsSideZero(c)), `CollectOppositeSideTargets` (CollectOppositeSideTargets(c, range): count into foe_List), `ByteToStr` (ByteToStr), `WeaponIsRanged` (WeaponIsRanged(c)), `ov24_305B` (Pool FUN_00ba_2e46: throwable-melee test), `TargetDistance` (TargetDistance(c, t)), `GetMissileAmmo` (GetMissileAmmo(c, var ammo)), `IsHelpless` (IsHelpless(c)), `SetGuarding` (SetGuarding(c)), `ShowTimedBottomMessage` (ShowTimedBottomMessage(s)), `DrawCharacterSummary` (DrawCharacterSummary(c)), `BandageDying` (new, L), `CastSpell` (CastSpell), `SpellRange` (SpellRange(spell)), `IsScroll` (IsScroll(item)), `UseItem` UseItem(item, var x) and `ReadyItem` ReadyItem(item) (ov19, this file), ov13 routines by the names given in the ov13 section, ov23 routines (CallEffectHooks(event, c) = CallEffectHooks, SavingThrow(c, type, bonus) = SavingThrow, RemoveEffect = RemoveEffect, RemoveFromCombat(c, status, msg) = RemoveFromCombat, StinkingCloudCheck(c, flag) = StinkingCloudCheck, ov23_1603 = remove effects 4Ah/4Bh).

### 3100:0000 ov09_LoadDeps (M)
Eleven `CALLF` into entry 0 of ov19, ov31, ov32, ov30, ov26, ov24, ov22, ov23, ov13 (ov13_LoadDeps), ov34, ov25 { 3100:0003 .. 0035 }.

### 3100:004D AiCombatTurn (H)
`procedure AiCombatTurn(c [BP+6]: PChar)` — RETF 4, entry e1. Callees: CheckCombatHotkeys, ClearMenuLine, ClearCharacterMessage, ClearCombatantActionFlags, Roll, AiMoraleCheck, ShowCharacterMessage, AiTryUseMagicItem, CastSpell, AiTryTurnUndead, AiTryCastSpell, AiReadyBestWeapon, AutoTarget, AiMoveAttack, AiEndTurn. Pool: 4D00:000F (0.99). **changed:** the move/attack loop also stops when the combatant is no longer active.
```pascal
done := CheckCombatHotkeys(c);                                                         { 3100:0053 }
ClearMenuLine;                                                                         { 3100:0060 }
ClearCharacterMessage;                                                                             { 3100:0065  ClearCharacterMessage }
if c^.active = 0 then done := ClearCombatantActionFlags(c);                                            { 3100:006a / 0075  ClearCombatantActionFlags }
pat := cb^.movePattern;                                                                { 3100:0083 }
if (pat = 0) or (pat > 4) or (Roll(1, 4) = 1) then begin                               { 3100:0092 / 009e }
  pat := Roll(1, 8);                                                                   { 3100:00ad }
  if pat = 8 then pat := Roll(1, 2) + 4                                                { 3100:00bb / 00c1 }
  else pat := Roll(1, 4);                                                              { 3100:00d6 }
end;
cb^.movePattern := pat;                                                                { 3100:00e4 }
if not done then done := AiMoraleCheck(c);                                             { 3100:00f3 / 00f9 }
if (cb^.fleeing <> 0) and (cb^.turned = 0) then                                        { 3100:0106 / 0115 }
  ShowCharacterMessage(c, 'flees in panic', 10, 1);                                               { 3100:0124 / 0139  ShowCharacterMessage }
if done then exit;                                                                     { 3100:0144 }
if AiTryUseMagicItem(c) then done := ClearCombatantActionFlags(c)                                      { 3100:014d / 015b }
else if cb^.castingSpell <> 0 then begin                                               { 3100:016c }
  CastSpell(cb^.castingSpell, 1, 1, done);                                             { 3100:017a  CastSpell(spell, 1, 1, var done) }
  done := ClearCombatantActionFlags(c);                                                                { 3100:0196 }
end
else if AiTryTurnUndead(c) then done := ClearCombatantActionFlags(c)                                   { 3100:01a7 / 01b5 }
else if not AiTryCastSpell(c) then begin                                               { 3100:01c6 }
  AiReadyBestWeapon(c);                                                                { 3100:01da }
  done := CheckCombatHotkeys(c);                                                       { 3100:01e4 }
  while not done do                                                                    { 3100:01f1 }
    if AutoTarget(c, $FF, 1, 0) and (cb^.initiative > 0) and (c^.active <> 0) then      { 3100:01f7 / 020f / 021e  AutoTarget; new: active test }
      done := AiMoveAttack(c)                                                          { 3100:0229 }
    else done := AiEndTurn(c);                                                         { 3100:0238 }
end;
```

### 3100:024D AiTryTurnUndead (H)
`function AiTryTurnUndead(c [BP+6]: PChar): Boolean` — RETF 4. Caller: AiCombatTurn. Callees: FindTurnTarget, TurnUndead. Pool: 4D00:0203 (0.92). **changed:** a dual-class character may also turn with the former cleric level.
```pascal
if (cb^.hasTurned = 0) and ((c^.level[0] > 0) or (c^.b0E6 < c^.old_level[0])) and       { 3100:0253 .. 0275  +109h cleric level; +111h former level vs +E6h (M) }
   FindTurnTarget(c, u) then begin                                                          { 3100:027f  FindTurnTarget(c, var u) }
  Result := true;                                                                      { 3100:0293 }
  TurnUndead(c);                                                                        { 3100:0297  TurnUndead }
end else Result := false;                                                              { 3100:02a4 }
```

### 3100:02B1 AreaHitsFriend (M)
`function AreaHitsFriend(x [BP+0Ch], y [BP+0Ah], spell [BP+8]: Byte): Boolean` — nested in AiSpellUseful (static link `[BP+6]`); RETF 8. Callees: BuildTargetList, IsSideZero, SavingThrow. Pool: 4D00:0255 (0.66). **changed:** a friend inside the area only counts when the spell is not marked harmless (`spells_Table[spell].harmless <> 1`) and the friend **fails** a saving throw of the spell's save type (bonus −2 for a party-side caster, +8 for a monster caster).
```pascal
Result := false;                                                                       { 3100:02b7 }
if SelectedChar^.side = 0 then bonus := -2 else bonus := 8;                            { 3100:02bb / 02c7 / 02cd  FEh / 8 }
BuildTargetList(x, y, spells_Table[spell].areaSize, $FF, 1, cm_Map);                   { 3100:02d1  g_37E9[spell*16]; dir FFh = all }
for i := 1 to tg_Count do begin                                                        { 3100:02fe .. 030e }
  who := tg_List[i].who;                                                               { 3100:0325 }
  if (cb_Char[who]^.side <> Ord(IsSideZero(SelectedChar))) and                          { 3100:0316 / 0346  IsSideZero }
     (spells_Table[spell].harmless <> 1) and                                           { 3100:034a  g_37E2 }
     not SavingThrow(cb_Char[who], spells_Table[spell].saveType, bonus) then           { 3100:035c  g_37E3 }
    Result := true;                                                                    { 3100:0399 }
end;
```

### 3100:03B1 AiSpellUseful (M)
`function AiSpellUseful(c [BP+0Ah]: PChar; spell [BP+8], minValue [BP+6]: Byte): Boolean` — RETF 8. Callers: AiTryUseMagicItem, AiTryCastSpell. Callees: FindHealTarget, SpellRange, CollectOppositeSideTargets, AreaHitsFriend. Pool: 4D00:02EB (1.00), same body with the table at g_37DA.
```pascal
Result := false;                                                                       { 3100:03b7 }
if spells_Table[spell].aiValue < minValue then exit;                                   { 3100:03bb  g_37E7 }
if ((spell = 3) or (spells_Table[spell].needsTarget <> 0)) and                         { 3100:03d2 / 03d8  g_37E8 }
   ((spell <> 3) or not FindHealTarget(c, f)) then begin                                    { 3100:03ea / 03f0  FindHealTarget }
  n := CollectOppositeSideTargets(c, SpellRange(spell));                                                 { 3100:040b / 041b  CollectOppositeSideTargets(c, SpellRange(spell)) }
  if n <> 0 then                                                                       { 3100:0420 }
    if spells_Table[spell].areaSize = 0 then Result := true                            { 3100:0429 / 043b }
    else begin
      for i := 1 to n do                                                               { 3100:0441 }
        if AreaHitsFriend(cb_Col[foe_List[i]], cb_Row[foe_List[i]], spell) then exit;  { 3100:048b / 0493 }
      Result := true;                                                                  { 3100:049d }
    end;
end else Result := true;                                                               { 3100:0404  no target needed, or Cure Light Wounds with a wounded friend }
```

### 3100:04AA AiTryUseMagicItem (M)
`function AiTryUseMagicItem(c [BP+6]: PChar): Boolean` — RETF 4. Caller: AiCombatTurn. Callees: Roll, IsSideZero, IsScroll, AiSpellUseful, UseItem. Pool: 4D00:03E4 (0.95), same logic.
```pascal
Result := false;  chosen := nil;  minValue := 7;                                       { 3100:04b0 .. 04c2 }
passes := Roll(1, 7);                                                                  { 3100:04c0 }
if (cb^.mayUseItems <> 0) and (side_ActiveCount[Ord(IsSideZero(c))] <> 0) and           { 3100:04ce / 04e0 }
   (Mem[4BE5] = 0) and (passes <> 0) then                                              { 3100:04f8 / 0504  Pool w[$1CA] of region 0 }
  for pass := 1 to passes do begin                                                     { 3100:050d }
    it := c^.items;                                                                    { 3100:051f }
    while (it <> nil) and (chosen = nil) do begin                                      { 3100:052f }
      sp := it^.power1;                                                                { 3100:0545  +3Dh }
      slot := ITEMS[it^.itype].slot;                                                   { 3100:054f  stored, never used }
      if not IsScroll(it) and (it^.power2 < $80) and (it^.readied <> 0) and (sp <> 0) then begin   { 3100:0565 .. 0594  +3Eh, +34h }
        if sp > $38 then sp := sp - $17;                                               { 3100:058e / 0594 }
        if AiSpellUseful(c, sp, minValue) then chosen := it;                           { 3100:059f / 05b5 }
      end;
      it := it^.next;                                                                  { 3100:05c0 }
    end;
    minValue := minValue - 1;                                                          { 3100:05d2 }
  end;
if chosen <> nil then begin                                                            { 3100:05e0 }
  UseItem(chosen, dummy);                                                            { 3100:05e8  UseItem }
  Result := true;                                                                      { 3100:05f8 }
end;
```

### 3100:0605 AiTryCastSpell (M)
`function AiTryCastSpell(c [BP+6]: PChar): Boolean` — RETF 4. Caller: AiCombatTurn. Callees: Roll, IsSideZero, AiSpellUseful, BeginCast. Pool: 4D00:0545 (1.00). **changed:** gathers the 83 memorised-spell slots `+1Fh..+71h` (Pool: 21 at +17h).
```pascal
cnt := 0;                                                                              { 3100:060b }
if cb^.mayCast <> 0 then                                                               { 3100:060f }
  for k := 1 to 83 do                                                                  { 3100:061e }
    if c^.mem_spell[k] <> 0 then begin list[cnt] := c^.mem_spell[k]; cnt := cnt + 1 end;   { 3100:0627 .. 0650  +1Eh+k }
chosen := 0;  minValue := 7;                                                           { 3100:0659 / 065d }
passes := Roll(1, 7);                                                                  { 3100:0661 }
pass := 1;                                                                             { 3100:066f }
if (cnt <> 0) and ((c^.npc_morale > $7F) or (MagicOn <> 0)) and                        { 3100:0673 / 067c / 0687 }
   (side_ActiveCount[Ord(IsSideZero(c))] <> 0) then                                     { 3100:068e }
  while (pass <= passes) and (chosen = 0) do begin                                     { 3100:06a3 }
    k := 1;                                                                            { 3100:06b1 }
    while (k < 4) and (chosen = 0) do begin                                            { 3100:06b5 }
      pick := list[Roll(1, cnt) - 1];                                                  { 3100:06c1 }
      if AiSpellUseful(c, pick, minValue) then chosen := pick;                         { 3100:06e0 / 06f6 }
      k := k + 1;                                                                      { 3100:06fc }
    end;
    minValue := minValue - 1;  pass := pass + 1;                                       { 3100:0701 / 0704 }
  end;
if chosen = 0 then Result := false                                                     { 3100:0709 / 070f }
else begin BeginCast(chosen, 1, r); Result := r end;                                   { 3100:070f  BeginCast(spell, 1, var r) }
```

### 3100:0735 AiCanStep (M)
`function AiCanStep(c [BP+0Eh]: PChar; try [BP+0Ch], baseDir [BP+0Ah]: Byte; var blocked [BP+6]: Boolean): Boolean` — RETF 0Ch. Caller: AiMove. Callees: ProbeMove, HasEffect, SavingThrow. Pool: 4D00:0675 (0.62). **changed:** impassable terrain (cost FFh) returns false without `blocked`; the two ProbeMove flags replace Pool's `terrain = 1Eh` test: a cloud square (`hit1E`) is avoided unless the combatant has one of six effects, is turned, or passes a saving throw; a `hit1C` square is avoided below level 7 unless one of four effects or turned.
```pascal
blocked := false;  Result := false;                                                    { 3100:073b / 073e }
dir := (ai_DirOffsets[cb^.movePattern * 5 + try] + baseDir) mod 8;                     { 3100:0742 / 0762 }
ProbeMove(c, dir, occupant, tile, hit1E, hit1C);                                       { 3100:0783 }
if tile = 0 then begin blocked := true; exit end;                                      { 3100:07a6 / 07ac }
if CombatTerrain[tile] = $FF then exit;                                                { 3100:07b6  new: impassable }
if Odd(dir) then cost := Byte(CombatTerrain[tile] * 3) else cost := Byte(CombatTerrain[tile] * 2);   { 3100:07c8 .. 07ef }
if (occupant = 0) and (cost < cb^.moveLeft) then begin                                 { 3100:0807 / 0810 }
  if hit1E and not HasEffect(c, $20, e)                                                { 3100:0824 / 082d }
     and not HasEffect(c, $1E, e)                                                      { 3100:0847 }
     and not HasEffect(c, $6F, e)                                                      { 3100:0861 }
     and not HasEffect(c, $7D, e)                                                      { 3100:0878 }
     and not HasEffect(c, $81, e)                                                      { 3100:088f }
     and not HasEffect(c, $3F, e)                                                      { 3100:08a6 }
     (cb^.turned = 0) and not SavingThrow(c, 0, 0) then                                { 3100:08bd / 08cc }
    cost := Byte(cb^.moveLeft + 1);                                                    { 3100:08e1 }
  if hit1C and (c^.level < 7) and not HasEffect(c, $81, e)                             { 3100:08f3 / 08fc / 090a  +E5h }
     and not HasEffect(c, $6F, e)                                                      { 3100:0921 }
     and not HasEffect(c, $85, e)                                                      { 3100:0938 }
     and (cb^.turned = 0) and not HasEffect(c, $7D, e) then                            { 3100:094f / 095e }
    cost := Byte(cb^.moveLeft + 1);                                                    { 3100:0975 }
  if cost <= cb^.moveLeft then Result := true;                                         { 3100:0987 / 0998 }
end;
```

### 3100:09C7 AiMove (M)
`procedure AiMove(c [BP+6]: PChar)` — RETF 4. Caller: AiMoveAttack (2×). Callees: ByteToStr, DrawText, CheckCombatHotkeys, Roll, DirectionTo, AiCanStep, Flee, ClearCombatantActionFlags, AutoTarget, AiEndTurn, IsVisible, ShowCombatant, AttacksOfOpportunity, StepCombatant, StinkingCloudCheck. Pool: 4D00:07F2 (0.88). **changed:** (1) an NPC/monster on the party side whose morale + d100 is below the enemy HP percentage ends the turn instead of moving; (2) a Magic-User only stays put when no weapon is readied; (3) `combat_Visible` is set per step (in reach, visible, or party side); (4) StepCombatant only when move points remain; (5) StinkingCloudCheck gets a flag.
```pascal
DrawText(0, 24, 10, 0, 'Move/Attack, Move Left = ' + ByteToStr(cb^.moveLeft div 2) + ' ');   { 3100:09ce .. 0a19 }
if CheckCombatHotkeys(c) then exit;                                                    { 3100:0a1e }
if (cb^.moveLeft div 2 > 0) and (cb^.initiative > 0) and                               { 3100:0a2f / 0a4a }
   ((c^.npc_morale < $80) or (enemy_HpPercent <= morale_Value + Roll(1, 100)) or (c^.side = 1)) and   { 3100:0a5c .. 0a9c  new }
   not ((cb^.fleeing = 0) and (c^.readied[2] = nil) and (c^.class = 5)) then begin     { 3100:0aa1 .. 0acc  +159h; Pool: class 5 alone }
  if cb^.fleeing = 0 then dir := DirectionTo(c, cb^.target)                              { 3100:0acc / 0adb  DirectionTo }
  else begin
    cb^.movePattern := Roll(1, 2);                                                     { 3100:0afb }
    dir := Byte(party_Dir - ((party_Dir + 2) mod 4) div 2);                            { 3100:0b12 }
    if c^.side = 0 then dir := dir + 4;                                                { 3100:0b33 / 0b3e }
    dir := dir mod 8;                                                                  { 3100:0b49 }
  end;
  blocked := false;  stop := false;  i := 1;                                           { 3100:0b58 .. 0b60 }
  while (i < 6) and not stop and not AiCanStep(c, i, dir, blocked) do                  { 3100:0b64 / 0b70 }
    if (cb^.fleeing <> 0) and blocked then stop := Flee(c)                        { 3100:0b8b / 0ba0  Flee }
    else i := i + 1;                                                                   { 3100:0bb0 }
  if stop then begin                                                                   { 3100:0bb5 }
    cb^.moveLeft := 0;  cb^.fleeing := 0;                                              { 3100:0bbb / 0bc8 }
    stop := ClearCombatantActionFlags(c);                                                              { 3100:0bd5 }
  end else begin
    newDir := (ai_DirOffsets[cb^.movePattern * 5 + i] + dir) mod 8;                    { 3100:0be6 }
    if (i = 6) or ((newDir + 4) mod 8 = ai_LastStepDir) then begin                     { 3100:0c1d / 0c23 }
      ai_StuckCount := ai_StuckCount + 1;                                              { 3100:0c40 }
      cb^.movePattern := cb^.movePattern mod 6 + 1;                                    { 3100:0c44 }
      if ai_StuckCount > 1 then begin                                                  { 3100:0c66 }
        cb^.target := nil;                                                             { 3100:0c6d }
        if ai_StuckCount < 3 then begin                                                { 3100:0c7f }
          if not AutoTarget(c, $FF, 1, 0) then stop := AiEndTurn(c);                    { 3100:0c99 / 0cb1 }
        end else begin cb^.moveLeft := 0; stop := true end;                            { 3100:0c86 / 0c93 }
      end;
    end;
    if i < 6 then ai_LastStepDir := newDir else stop := true;                          { 3100:0cbe / 0cc4 / 0ccc }
  end;
  if not stop then begin                                                               { 3100:0cd0 }
    combat_Visible := Ord((ai_InReach <> 0) or IsVisible(c, false) or (c^.side = 0));  { 3100:0cd9 .. 0d03  new }
    ShowCombatant(c, newDir, 0, false);                                                { 3100:0d06 }
    AttacksOfOpportunity(c, cb^.facing);                                                          { 3100:0d1b  AttacksOfOpportunity }
    if c^.active = 0 then ClearCombatantActionFlags(c)                                                 { 3100:0d33 / 0d3e }
    else begin
      if cb^.moveLeft <> 0 then StepCombatant(c, cb^.facing);                              { 3100:0d4e / 0d5d  StepCombatant (new guard) }
      if c^.active = 0 then stop := ClearCombatantActionFlags(c);                                      { 3100:0d75 / 0d80 }
      StinkingCloudCheck(c, 1);                                                                 { 3100:0d8e  StinkingCloudCheck(c, 1) }
    end;
  end;
end else AiEndTurn(c);                                                                 { 3100:0d9e }
```

### 3100:0DB1 AiMoveAttack (M)
`function AiMoveAttack(c [BP+6]: PChar): Boolean` — RETF 4. Caller: AiCombatTurn. Callees: CallEffectHooks, BandageDying, AiMove, AiEndTurn, CanAttack, CombatantCol/Row, TraceLine, CollectOppositeSideTargets, AutoTarget, Roll, WeaponIsRanged, ov24_305B, AiReadyBestWeapon, TargetDistance, FocusSquare, DirectionTo, FighterSweep, ClearCombatantActionFlags, FaceAttacker, GetMissileAmmo, Attack. Pool: 4D00:0B3C (0.92). **changed:** a party-side combatant loses its initiative when `BandageDying(1)` is true (role L); `cm_Map^[6] := 0` before the line trace; the "in reach" flag is the global `ai_InReach`.
```pascal
ai_LastStepDir := 8;  ai_StuckCount := 0;  g_47F2 := 0;                                { 3100:0db7 .. 0dc1 }
steps := 0;  going := true;  done := false;                                            { 3100:0dc6 .. 0dce }
CallEffectHooks($0E, c);                                                                     { 3100:0dd2  CallEffectHooks(event 0Eh, c) }
if (c^.side = 0) and BandageDying(1) then cb^.initiative := 0;                            { 3100:0de0 / 0deb / 0df7  new }
if cb^.initiative = 0 then going := false;                                             { 3100:0e04 }
while not done and going do begin                                                      { 3100:0e17 / 0e20 }
  if cb^.fleeing <> 0 then                                                             { 3100:0e20 }
    while (cb^.moveLeft <> 0) and (cb^.initiative > 0) and (cb^.initiative < $14) do AiMove(c);   { 3100:0e29 .. 0e6c }
  if (cb^.initiative = 0) or (cb^.initiative = $14) then going := false else done := false;   { 3100:0e71 .. 0e9d }
  if done or not going then continue;                                                  { 3100:0e99 }
  steps := steps + 1;                                                                  { 3100:0eab }
  if steps > 20 then begin done := true; going := not AiEndTurn(c) end;                { 3100:0eae / 0eb4 / 0eb8 }
  ai_InReach := 0;                                                                     { 3100:0ecf }
  range := 1;                                                                          { 3100:0ed4 }
  if c^.readied[0] <> nil then range := ITEMS[c^.readied[0]^.itype].range - 1;         { 3100:0ed8 / 0ee7  +151h, g_5D02 }
  if (range = 0) or (range = $FF) then range := 1;                                     { 3100:0f05 / 0f0b }
  tgt := cb^.target;                                                                   { 3100:0f15 }
  if (tgt^.active = 0) or (tgt^.side = 0) then tgt := nil;                             { 3100:0f29 / 0f34 / 0f3f  fields read even when nil }
  if (tgt <> nil) and CanAttack(c, tgt) then begin                                     { 3100:0f47 / 0f52  CanAttack }
    tx := CombatantCol(tgt);  ty := CombatantRow(tgt);                                 { 3100:0f6a / 0f78 }
    dist := range;                                                                     { 3100:0f86 }
    cm_Map^[6] := 0;                                                                   { 3100:0f8e  new }
    if TraceLine(CombatantCol(c), CombatantRow(c), tx, ty, dist, cm_Map) and (dist div 2 <= range) then   { 3100:0f97 .. 0fd9 }
      ai_InReach := 1;                                                                 { 3100:0fe4 }
  end;
  if ai_InReach = 0 then begin                                                         { 3100:0fe9 }
    n := CollectOppositeSideTargets(c, range);                                                          { 3100:0ff3  CollectOppositeSideTargets }
    if n = 0 then begin
      if AutoTarget(c, $FF, 0, 0) then AiMove(c) else done := AiEndTurn(c);             { 3100:100b / 1023 / 102f }
    end else begin
      k := Roll(1, n);                                                                 { 3100:103f }
      tgt := cb_Char[foe_List[k]];                                                     { 3100:104e }
      if WeaponIsRanged(c) and not ov24_305B(c) and (CollectOppositeSideTargets(c, 1) <> 0) then begin       { 3100:106d / 107c / 108b  ranged weapon, enemy adjacent }
        AiReadyBestWeapon(c);  done := true;                                           { 3100:109d / 10a7 }
      end else if (TargetDistance(c, tgt) = 1) or CanAttack(c, tgt) then                    { 3100:10ad / 10c2  TargetDistance, CanAttack }
        ai_InReach := 1;                                                               { 3100:10d7 }
    end;
  end;
  if ai_InReach <> 0 then begin                                                        { 3100:10dc }
    FocusSquare(CombatantCol(c), CombatantRow(c), 2, DirectionTo(c, tgt));               { 3100:10e3 .. 1110 }
    if FighterSweep(c, tgt) then done := ClearCombatantActionFlags(c)                                     { 3100:111f / 1134  FighterSweep }
    else begin
      FaceAttacker(c, tgt);                                                               { 3100:1145  FaceAttacker }
      ammo := nil;                                                                     { 3100:1156 }
      if WeaponIsRanged(c) then begin                                                       { 3100:115e  WeaponIsRanged }
        ai_InReach := GetMissileAmmo(c, ammo);                                              { 3100:116d  GetMissileAmmo }
        if ov24_305B(c) and (TargetDistance(c, tgt) = 1) then ammo := nil;                  { 3100:1180 / 118f }
      end;
      Attack(c, tgt, 0, ammo, done);                                                { 3100:11ac  Attack }
      if done then going := false                                                      { 3100:11cb / 11d7 }
      else if tgt^.active = 0 then done := true;                                       { 3100:11d7 / 11e9 }
    end;
  end;
end;
Result := not going;                                                                   { 3100:11e9 .. 11f5 }
```

### 3100:1201 AiEndTurn (M)
`function AiEndTurn(c [BP+6]: PChar): Boolean` — RETF 4. Callers: AiCombatTurn, AiMove, AiMoveAttack. Callees: ClearCharacterMessage, IsHelpless, WeaponIsRanged, SetGuarding, ClearCombatantActionFlags. Pool: 4D00:0F4F (1.00).
```pascal
ClearCharacterMessage;                                                                             { 3100:1207  ClearCharacterMessage }
if not IsHelpless(c) and not WeaponIsRanged(c) and (cb^.initiative <> 0) then                { 3100:120c / 121b / 122a }
  Result := SetGuarding(c)                                                               { 3100:1249  "Guarding" }
else Result := ClearCombatantActionFlags(c);                                                           { 3100:1239 }
```

### 3100:1273 CheckCombatHotkeys (M)
`function CheckCombatHotkeys(c [BP+6]: PChar): Boolean` — RETF 4. Callers: AiCombatTurn, AiMove. Callees: Crt.KeyPressed, ReadGameKey, ShowTimedBottomMessage, GodsIntervene, FlushGameKeys. Pool: 4D00:0FC1 (0.92). **changed:** the keyboard buffer is really flushed at the end (Pool called a no-op); the Quick flag is `c^.controlled` (+198h).
```pascal
Result := false;                                                                       { 3100:1279 }
if KeyPressed then begin                                                               { 3100:127d }
  key := ReadGameKey;                                                                  { 3100:1289 }
  if key = #0 then key := ReadGameKey;                                                 { 3100:1291 / 1297 }
  if key = '2' then begin                                                              { 3100:129f  32h (also the scan code of M) }
    MagicOn := not MagicOn;                                                            { 3100:12a6 }
    if MagicOn then ShowTimedBottomMessage('Magic On') else ShowTimedBottomMessage('Magic Off');                 { 3100:12bd / 12cc / 12d3 / 12e2 }
  end else if key = ' ' then begin                                                     { 3100:12e7 }
    p := PartyHead;                                                                    { 3100:12ed }
    while p <> nil do begin                                                            { 3100:12f9 }
      if (p^.npc_morale < $80) and (p^.status <> 1) then p^.controlled := 0;           { 3100:1301 / 130c / 1317 }
      p := p^.next;                                                                    { 3100:1320 }
    end;
    if c^.controlled = 0 then begin cb^.initiative := $14; Result := true end;         { 3100:1332 / 133d / 134a }
  end else if key = '-' then GodsIntervene;                                                { 3100:134e / 1354  GodsIntervene }
end;
FlushGameKeys;                                                                         { 3100:135d }
```

### 3100:1388 AiMoraleCheck (M)
`function AiMoraleCheck(c [BP+6]: PChar): Boolean` — RETF 4. Caller: AiCombatTurn. Callees: ov23_1603, ShowCharacterMessage, CallEffectHooks, MaxEnemyMove, CalcMove, RemoveEffect, RemoveFromCombat, ClearCombatantActionFlags. Pool: 4D00:10D7 (0.96), same logic (own HP at +1A4h/+78h, INT at +13h).
```pascal
Result := false;                                                                       { 3100:138e }
cb^.fleeing := 0;                                                                      { 3100:1392 }
ov23_1603(c);                                                                          { 3100:139f  remove effects 4Ah, 4Bh }
if cb^.turned <> 0 then begin                                                          { 3100:13aa }
  cb^.fleeing := 1;                                                                    { 3100:13b9 }
  ShowCharacterMessage(c, 'is forced to flee', 10, 1);                                            { 3100:13c6 / 13db }
  exit;
end;
if c^.npc_morale <= $7F then exit;                                                     { 3100:13e9 }
morale_Value := Byte(c^.npc_morale shl 1);                                             { 3100:13f7 }
if morale_Value > $66 then morale_Value := 0;                                          { 3100:1408 / 140f }
CallEffectHooks($11, c);                                                                     { 3100:1414  CallEffectHooks(11h, c): may change morale_Value }
if (morale_Value >= 100 - c^.hp * 100 div c^.maxhp) and (morale_Value <> 0) then exit; { 3100:1422 .. 1451  signed compare }
saved := morale_Value;                                                                 { 3100:145b  never read }
morale_Value := enemy_HpPercent;                                                       { 3100:145b }
CallEffectHooks($11, c);                                                                     { 3100:1467 }
if (morale_Value >= 100 - Mem[7EC6]) and (morale_Value <> 0) and (c^.side <> 0) then exit;   { 3100:1475 .. 1496  Pool w[$58C]; unsigned }
if MaxEnemyMove(c) > CalcMove(c) div 2 then begin                                        { 3100:14a1 / 14af  MaxEnemyMove > CalcMove div 2 }
  if c^.int > 5 then begin                                                             { 3100:14ba  +13h }
    RemoveFromCombat(c, 4, 'Surrenders');                                                     { 3100:150e / 1526  RemoveFromCombat(c, Unconscious, msg) }
    Result := ClearCombatantActionFlags(c);                                                            { 3100:152b }
  end;
end else begin
  cb^.fleeing := 1;                                                                    { 3100:14cd }
  RemoveEffect(c, $4A, nil);                                                              { 3100:14da }
  RemoveEffect(c, $4B, nil);                                                              { 3100:14ee }
end;
```

### 3100:1542 AiWeaponScore (M)
`function AiWeaponScore(c [BP+0Ah]: PChar; it [BP+6]: PItem): Byte` — RETF 8. Caller: AiReadyBestWeapon. Pool: 4D00:128D (0.98), same body (16-byte ITEMS copy; `hands_used +185h`, `alignment +11Bh`, target `undead +E9h` M).
```pascal
t := ITEMS[it^.itype];                                                                 { 3100:1548  CopyBytes 16 }
s := Byte(t.dice * t.sides);                                                           { 3100:156b }
if it^.plus > 0 then s := Byte(s + it^.plus * 8);                                      { 3100:157c / 1586 }
if t.dmg_bonus > 0 then s := Byte(s + t.dmg_bonus * 2);                                { 3100:159f / 15a5 }
if (it^.itype = $55) and (cb^.target <> nil) and (cb^.target^.undead > 0) then s := 8; { 3100:159f .. 15df  Holy Water vs undead }
if (t.wflags2 and 8) <> 0 then s := Byte(s + (t.rof - 1) * 2);                         { 3100:15eb / 15f4 }
if t.hands <= 1 then s := Byte(s + 3);                                                 { 3100:1608 / 160e }
if c^.hands_used + t.hands > 3 then s := 0;                                            { 3100:1619 / 1631 }
if (it^.power2 = $84) and ((it^.power1 and $0F) <> c^.alignment) then s := 0;          { 3100:1635 .. 164b }
if it^.power1 = $53 then s := 0;                                                       { 3100:163f / 1656 }
if it^.magic_flag <> 0 then s := 0;                                                    { 3100:1660 / 1664  +36h }
Result := s;                                                                           { 3100:166e }
```

### 3100:1681 AiReadyBestWeapon (M)
`procedure AiReadyBestWeapon(c [BP+6]: PChar)` — RETF 4. Callers: AiCombatTurn, AiMoveAttack. Callees: AiWeaponScore, CollectOppositeSideTargets, ReadyItem, RecalcItems, CalcAttacks, DrawCharacterSummary. Pool: 4D00:13CA (0.94), same logic with Curse offsets: `readied[0] +151h` (weapon), `[1] +155h` (shield), `[2] +159h`, `[11] +17Dh` (arrows), `[12] +181h` (quarrels), `hands_used +185h`, `class_mask +12Bh`, base damage `+11Eh × +120h + 2 × +122h`; Pool's RecalcCharacter is `RecalcItems` (6200:0C28).
```pascal
if c^.readied[0] <> nil then c^.hands_used := c^.hands_used - ITEMS[c^.readied[0]^.itype].hands;   { 3100:1687 / 1696 }
if c^.readied[1] <> nil then c^.hands_used := c^.hands_used - ITEMS[c^.readied[1]^.itype].hands;   { 3100:16c6 / 16d5 }
bestMissile := nil;  bestMelee := nil;  bestShield := nil;                             { 3100:1705 .. 1715 }
missileScore := 1;                                                                     { 3100:171d }
meleeScore := Byte(c^.base_dmg_sides * c^.base_dmg_dice);                              { 3100:1721  +120h × +11Eh }
if c^.base_dmg_bonus > 0 then meleeScore := Byte(meleeScore + c^.base_dmg_bonus * 2);  { 3100:173c / 1747  +122h }
shieldScore := 0;                                                                      { 3100:175e }
it := c^.items;                                                                        { 3100:1762 }
while it <> nil do begin                                                               { 3100:1772 }
  t := it^.itype;                                                                      { 3100:177d }
  if (ITEMS[t].slot = 0) and ((ITEMS[t].usable_by and c^.class_mask) <> 0) then begin  { 3100:1787 / 179c }
    s := AiWeaponScore(c, it);                                                         { 3100:17ba }
    if ((ITEMS[t].wflags2 and 8) <> 0) or ((ITEMS[t].wflags2 and $10) <> 0) then       { 3100:17cd / 17e2 }
      if s > missileScore then begin bestMissile := it; missileScore := s end;         { 3100:17f7 / 17ff }
    if ((ITEMS[t].wflags2 and 8) = 0) and (s > meleeScore) then begin bestMelee := it; meleeScore := s end;   { 3100:1810 / 182d }
  end;
  if (ITEMS[t].slot = 1) and ((ITEMS[t].usable_by and c^.class_mask) <> 0) then begin  { 3100:183e / 1850 }
    if it^.plus < 0 then s := 0 else s := it^.plus + 1;                                { 3100:186b .. 1883 }
    if s > shieldScore then begin bestShield := it; shieldScore := s end;              { 3100:1887 / 188f }
  end;
  it := it^.next;                                                                      { 3100:18a0 }
end;
throwable := (bestMissile <> nil) and (ITEMS[bestMissile^.itype].range >= 2) and       { 3100:18b2 .. 18f3 }
             ((ITEMS[bestMissile^.itype].wflags2 and $14) = $14);
canShoot := false;  ammo := nil;  fl := 0;                                             { 3100:18f7 .. 18ff }
if bestMissile <> nil then begin                                                       { 3100:1903 }
  fl := ITEMS[bestMissile^.itype].wflags2;                                             { 3100:190b }
  if (fl and $10) <> 0 then ammo := bestMissile;                                       { 3100:1921 / 192a }
  if (fl and 8) <> 0 then begin                                                        { 3100:1935 }
    if (fl and 1) <> 0 then ammo := c^.readied[11];                                    { 3100:193e / 1947  +17Dh }
    if (fl and $80) <> 0 then ammo := c^.readied[12];                                  { 3100:1957 / 1960  +181h }
  end;
end;
if (ammo <> nil) or (fl = $0A) then canShoot := true;                                  { 3100:1970 / 197e }
if (bestMissile <> nil) and (missileScore > meleeScore div 2) and canShoot and         { 3100:1982 .. 19a6 }
   (throwable or (CollectOppositeSideTargets(c, 1) = 0)) then chosen := bestMissile                     { 3100:19ac / 19cb }
else chosen := bestMelee;                                                              { 3100:19be }
changed := false;  ok := true;                                                         { 3100:19d6 / 19d6 }
if (c^.readied[0] <> nil) and ((c^.readied[0] = chosen) or (c^.readied[0]^.magic_flag <> 0)) then ok := false;   { 3100:19de .. 1a14 }
if ok then begin                                                                       { 3100:1a14 }
  if c^.readied[0] <> nil then ReadyItem(c^.readied[0]);                               { 3100:1a1d / 1a2c  ReadyItem (un-ready) }
  RecalcItems(c);                                                                      { 3100:1a3e }
  if (c^.readied[1] <> nil) and (c^.readied[1]^.magic_flag = 0) then                   { 3100:1a49 / 1a58 }
    c^.hands_used := c^.hands_used - ITEMS[c^.readied[1]^.itype].hands;                { 3100:1a67 }
  if chosen <> nil then ReadyItem(chosen);                                             { 3100:1a97 / 1a9f }
  changed := true;                                                                     { 3100:1aaa }
end;
RecalcItems(c);                                                                        { 3100:1aae }
CalcAttacks(c);                                                                          { 3100:1ab9  CalcAttacks }
ok := true;                                                                            { 3100:1ac4 }
if (c^.readied[1] <> nil) and ((c^.readied[1] = bestShield) or (c^.readied[1]^.magic_flag <> 0)) then ok := false;   { 3100:1ac8 .. 1afe }
if c^.hands_used < 3 then begin                                                        { 3100:1afe }
  if (c^.hands_used < 2) and ok then begin                                             { 3100:1b50 / 1b5b }
    if c^.readied[1] <> nil then ReadyItem(c^.readied[1]);                             { 3100:1b61 / 1b70 }
    RecalcItems(c);                                                                    { 3100:1b82 }
    if bestShield <> nil then ReadyItem(bestShield);                                   { 3100:1b8d / 1b95 }
    changed := true;                                                                   { 3100:1ba0 }
  end;
end else begin
  if (c^.readied[1] = nil) or (c^.readied[1]^.magic_flag <> 0) then ReadyItem(chosen)  { 3100:1b09 .. 1b27 }
  else ReadyItem(c^.readied[1]);                                                       { 3100:1b38 }
  changed := true;                                                                     { 3100:1b32 / 1b4a }
end;
RecalcItems(c);                                                                        { 3100:1ba4 }
if changed then DrawCharacterSummary(c);                                                          { 3100:1baf / 1bb5  DrawCharacterSummary }
```

### 3100:1BC6 ov09_init (H)
Empty unit initialiser { 3100:1bc6 }.

---

## ov13 (seg 3A00) — melee / missile attacks, attack messages, targeting, turn undead, flee, monster special attacks

Unit: ov13, analysis segment 3A00, 49B9h bytes, 45 functions (+ init). Pool twin: ov13 6100 (34 routines; shape 0.76..1.00 except DirectionTo 0.19 — rewritten — and the 8 Curse-only routines 3A00:403F..4811, which shape-match MAGIC's ov12 effect handlers 0.32..0.67 and are monster special attacks: engulf, hug, eye rays).
Role: the per-combatant attack engine — round start, attack sequence and its text, facing bookkeeping, free attacks, fighter sweeps, step movement, Flee, Turn Undead, the "Aim:" target UI with the manual cursor, AI target choice, spell target collection, "Attack Ally:", Begin casting, and the cheat "The Gods intervene!".
Entries: stub ov13 e1 = StartCombatRound 0000, e2 CalcMove 0124, e5 StepCombatant 074F, e6 AttacksOfOpportunity 095A, e7 Flee 0D1C, e8 CalcAttacks 0DD9, e10 FighterSweep 0F46, e11 CanAttack 1144, e12 TurnUndead 1227, e13 FindTurnTarget 1433, e14 FaceAttacker 194A, e15 Attack 19D8, e17 FindHealTarget 1DF6, e19 BeginCast 275A, e23 DirectionTo 29A2, e26 MaxEnemyMove 2EAC, e27 AutoTarget 3E56, e33 GodsIntervene 48DC, e34 ov13_LoadDeps 1D9D (callers: ov08, ov09, ov22, ov12 per functions.tsv).
Strings (code segment): 0256 `-Backstabs-`, 0262 `slays helpless`, 0271 `Attacks`, 0279 `(from behind) `, 0288 `with one cruel blow`, 029C `Hitting for `, 02A9 ` point `, 02B1 ` points `, 02BA `of damage`, 02C4 `and Misses`, 02CF `lost a spell`, 02DC `goes down`, 02E6 `and is Dying`, 0313 `is killed`, 0D01 `Got Away`, 0D0A `Escape is blocked`, 0F3F `sweeps`, 11ED `turns undead...`, 11FD `is turned`, 1207 `Is destroyed`, 1214 `Nothing Happens...`, 220A `Already been targeted`, 273B `Camp Only Spell`, 274B `Begins Casting`, 2F2E `Attack Ally: `, 3009 `Range = `, 3015 `Target `, 301D `Next Prev Manual `, 302F `Center Exit`, 303B `Aim:`, 3379 `Range = `, 3385 `Center Exit`, 3391 `Target `, 3399 `(Use Cursor keys) `, 4036 `engulfs `, 4286 `fires a disintegrate ray`, 429F `is disintergrated` (sic), 42B1 `fires a stone to flesh ray`, 42CC `is Stoned`, 42D6 `fires a death ray`, 42E8 `is killed`, 42F2 `wounds you`, 480B `hugs `, 48C8 `The Gods intervene!`. Sets: CS:02F3 and CS:1DD6 = {6, 7, 8} (Dead, Stoned, Gone), CS:3AF7 = {#0, 'E'}, CS:3B17 = {'G','H','I','K','M','O','P','Q'} (cursor-key letters), CS:3359 = {#0, #13, 'E', 'T'}.
Character fields beyond the file header: `attacks +11Ch` (half-attacks slot 1, Pool +A1h), `attacks2 +11Dh` (slot 2, Pool +A2h), `attacks_left[k] +19Bh+k`, `dmg_dice[k] +19Dh+k`, `dmg_sides[k] +19Fh+k`, `dmg_bonus[k] +1A1h+k` (k = 1, 2), `ac +19Ah`, `ac_rear +19Bh`, `fighter_lvl_eff +DDh`, `level[0] +109h` (cleric), `level[6] +10Fh` (thief), `old_level[0] +111h`, `old_level[6] +117h` (former class, dual-class), `undead +E9h` (undead type 1..12, M), `readied[0] +151h`, `readied[2] +159h`. `DualClassActive(c)` = 0/1 "former-class levels count" (ECL_VM.md §3.1, M).
Combat record `cb` fields (as ov09 plus): `attackSlot +4`, `sweepLeft +5`, `freeAttack +7`, `attacked +8`, `timesAttacked +0Fh`, `rotation +12h`; `cb^[1]`, `cb^[2]` set at round start (+1 = `mayCast`, +2 = `mayUseItems` per ov09).
Tables: `step_dx{g_2694}[dir]` = {0,1,1,1,0,−1,−1,−1,0}, `step_dy{g_269D}[dir]` = {−1,−1,0,1,1,1,0,−1,0} (START.EXE bytes, H; dir 8 = no move); `TurnUndeadTable{g_0367}[type*10 + col]` (signed bytes, read from START.EXE: identical to Pool's 10×10 table at DS:0447 for every cell — rows 1..10: `10 7 4 T T D D D* D* D*`, `13 10 7 T T D D D D* D*`, `16 13 10 4 T T D D D D*`, `19 16 13 7 4 T T D D D*`, `20 19 16 10 7 4 T T D D`, `99 20 19 13 10 7 4 T T D`, `99 99 20 16 13 10 7 4 T D`, `99 99 99 20 16 13 10 7 4 T`, `99 99 99 99 20 16 13 10 7 T`, `99 99 99 99 99 20 16 13 10 4` with T = 1, D = 0, D* = −1); `HelplessEffectIds{g_27C9}[1..4]` = 33h, 34h, 35h, 1Fh (Pool g_286C); spell table fields used here: `target +6` (g_37E0), `effect +0Ah` (g_37E4), `combat +0Bh` (g_37E5), `castTime +0Ch` (g_37E6), `needsTarget +0Eh` (g_37E8); ITEMS fields: `dice_L +2`, `sides_L +3`, `bonus_L +4`, `rof +5` (g_5CFB), `dmg_bonus +0Bh`, `range +0Ch`.
Globals: `AttackRollValue{g_6F9F}` (Pool 6822; GLOBALS.md's "BodyCount" alignment is wrong), `SlotHits{g_6FA0}[k]` (= byte 6F9F+k, Pool 6823), `SlotSwings{g_75D7}[k]` (= 75D6+k, Pool 6E2D), `DamageAmount` g_6F94, `g_6F95` (Pool g_6819, cleared before the damage hooks), `StatValue` g_6F96, `StatKind{g_6F9A}` (Pool 681D), `AttackBlocked{g_6F9B}` (Pool 681E), `SpellArea{g_6F9D}` (Pool 6820), `hold_Victim{g_6FA3}` (Pool g_6826), `SpellTargets{g_7435}[i]` (far ptrs at 7431+4i, Pool 6C95), `SpellTargetCount{g_7434}` (Pool 6C94), `SpellX{g_7559}`/`SpellY{g_755A}` (Pool 6DB9/6DBA), `AllyAttacked{g_758C}` (Pool 6DE2), `CombatRound{g_758D}` (Pool 6DE3), `g_758F` = `foe_List[1]`, `dummy_Done{g_75DB}` (Pool g_6E31; also the `ext` of the manual-aim menu), `enemy_HpPercent` g_75D9, `combat_Shown{g_75E5}` (new: set to 1 together with `combat_Visible` before anything is drawn; read by DrawCharacterSummary — L), `combat_Visible` g_75E6, `menu_Ext` g_7295, `corpse_List` g_6E52 (7-byte records: char +0, x +4 g_6E56, y +5 g_6E57), `corpse_Count` g_6E91, `cm_Map` g_6E92 (+2 viewX, +3 viewY, +4/+5 cursor flags, +6 scan flag, +7 grid 50×25), `CopyProtWord` g_8C80; sound ids `g_25BA` (hit), `g_25BE` (miss), `g_25C0` (step), `g_25C4` (missile), `g_25B8`.
Other-unit callees (Pool role, M unless published): `DexMissileAdj` (DexMissileAdj(c)), `DrawCharacterName` (DrawCharacterName(c, col, row, space)), `ForgetMemorizedSpell` (ForgetMemorizedSpell(c, spell) — Pool took only the spell), `ApplyDamage` (ApplyDamage(c, dmg)), `ShowCombatMessageAnimation` (ShowCombatMessageAnimation(c, flag, s)), `CountActiveSides` (CountActiveSides), `WordToStr` (WordToStr), `CopyCombatAnimationFrame` (CopyCombatAnimationFrame(frame, a, b, mirror)), `BuildFourAnimationFrames` (BuildFourAnimationFrames(frame)), `AnimateAlongPath` (AnimateAlongPath(x0, y0, x1, y1, steps, pause)), `ov24_2E05` (DrawCombatLayout), `SpellCasterLevel(spell)` (new: hit-dice budget of spell 4Fh, L), `SpellList` SpellList(mode, flag, var w, var f) (ov19, this file), ov23: `AttackRoll` AttackRoll(att, tgt, ac), `RollDice` RollDice(n, s), `SavingThrow` SavingThrow(c, type, bonus), `RemoveCombatEffects` RemoveCombatEffects(c), `ov23_1569` (remove every effect 19h of c), `RemoveFromCombat` RemoveFromCombat(c, status, msg), `KillCombatant` (remove permanently: status 6/7/8, M — ov23 section), `AddEffect` AddEffect(c, type, duration, p3, callOnRemove), `CallEffectHandler` CallEffectHandler(type, c, e, mode), `DamageCharacter` DamageCharacter(c, dmg, 0, 0) (ov23 section), `SpellRange` SpellRange, `CastSpell` CastSpell, VIEW routines by name.

### 3A00:0000 StartCombatRound (M)
`procedure StartCombatRound(c [BP+6]: PChar)` — RETF 4, entry e1 (ov08). Callees: CalcAttacks, CallEffectHooks, HalfRound, DexMissileAdj, Roll, CalcMove. Pool: 6100:0000 (1.00), same body.
```pascal
cb^.castSpell := 0;  cb^[1] := 1;  cb^[2] := 1;  cb^.attacked := 0;  cb^.attackSlot := 2;        { 3a00:0006 .. 0036 }
CalcAttacks(c);                                                                        { 3a00:003b }
StatValue := c^.attacks2;                                                              { 3a00:0045  +11Dh }
StatKind := 0;                                                                         { 3a00:0050 }
CallEffectHooks($12, c);                                                                     { 3a00:0055  CallEffectHooks }
c^.attacks_left[2] := HalfRound(StatValue);                                            { 3a00:0063 / 0068 }
cb^.sweepLeft := c^.fighter_lvl_eff;                                                   { 3a00:0073 / 007e  +DDh }
if c^.active <> 0 then begin                                                           { 3a00:0082 }
  cb^.initiative := DexMissileAdj(c) + Roll(1, 6);                                         { 3a00:008d / 00a0  DexMissileAdj; ShortInt }
  if cb^.initiative < 1 then cb^.initiative := 1;                                      { 3a00:00b1 }
  if ((c^.side + 1) and Lo(Mem[7ECB])) <> 0 then cb^.initiative := cb^.initiative - 6; { 3a00:00c3  Pool w[$596]: SURPRISE bits }
  if (cb^.initiative < 0) or (cb^.initiative > 20) then cb^.initiative := 0;           { 3a00:00e2 }
end else cb^.initiative := 0;                                                          { 3a00:00fe }
cb^.moveLeft := CalcMove(c);                                                           { 3a00:0108 }
```

### 3A00:0124 CalcMove (M)
`function CalcMove(c [BP+6]: PChar): Byte` — RETF 4, entry e2 (ov09). Pool: 6100:0123 (1.00).
```pascal
m := c^.move;                                                                          { 3a00:012a  +1A5h }
if c^.side = 0 then m := Byte(m + Lo(Mem[7F72]));                                      { 3a00:0135 / 0140  Pool w[$6E4] }
StatKind := 1;                                                                         { 3a00:0151 }
if (m = 0) or (m > $60) then m := 1;                                                   { 3a00:0156 }
StatValue := m * 2;                                                                    { 3a00:0162 }
CallEffectHooks($12, c);                                                                     { 3a00:0170 }
StatKind := 0;                                                                         { 3a00:017e }
Result := StatValue;                                                                   { 3a00:0183 }
```

### 3A00:0192 RollDamage (H)
`procedure RollDamage(att [BP+0Ch], tgt [BP+8]: PChar; k [BP+6]: Byte)` — RETF 0Ah. Caller: MeleeAttack. Callees: RollDice, CanBackstab, DualClassActive, CallEffectHooks. Pool: 6100:0191 (0.83). **changed:** the backstab multiplier is `(thiefLevel − 1) div 4 + 2` with the thief level taken from the current or former class.
```pascal
DamageAmount := RollDice(att^.dmg_dice[k], att^.dmg_sides[k]) + ShortInt(att^.dmg_bonus[k]);   { 3a00:0195 / 01ba  8-bit add }
{ 3a00:01d3  "if DamageAmount < 0 then DamageAmount := 0" compiled as an unsigned compare: never true (Pool quirk kept) }
if CanBackstab(att, tgt) then                                                          { 3a00:01df }
  DamageAmount := Byte(DamageAmount * ((att^.level[6] + att^.old_level[6] * DualClassActive(att) - 1) div 4 + 2));   { 3a00:01f3 .. 022c  +10Fh, +117h }
DamageType := 0;                                                                           { 3a00:022f }
CallEffectHooks(4, att);                                                                     { 3a00:0234 }
CallEffectHooks(5, tgt);                                                                     { 3a00:0242 }
```

### 3A00:031D ShowAttackResult (H)
`procedure ShowAttackResult(att [BP+12h], tgt [BP+0Eh]: PChar; kind [BP+0Ch], dmgApplied [BP+0Ah], dmgShown [BP+8], hit [BP+6]: Byte)` — RETF 10h. Caller: MeleeAttack. Callees: ShowCharacterMessage, DrawCharacterName, ByteToStr, ApplyDamage, DrawWrappedText, MessageDelay, ForgetMemorizedSpell, DrawText, RemoveCombatEffects, CallEffectHooks, RemoveCombatant, ClearCharacterMessage. Pool: 6100:02F9 (0.98). **changed:** the result text is skipped for a target with status 8 (Gone); "lost a spell" is forgotten from the **target** (Pool erased it from SelectedChar).
```pascal
case kind of 2: s := '-Backstabs-'; 3: s := 'slays helpless'; else s := 'Attacks' end;  { 3a00:032e / 0348 / 035d }
ShowCharacterMessage(att, s, 10, 0);                                                              { 3a00:0370  ShowCharacterMessage }
row := $0C;                                                                            { 3a00:0386 }
DrawCharacterName(tgt, $17, row, 0);                                                           { 3a00:038a  DrawCharacterName }
row := row + 1;                                                                        { 3a00:039f }
if kind = 1 then s := '(from behind) ' else s := '';                                   { 3a00:03a2 / 03a8 / 03c1 }
if hit <> 0 then begin                                                                 { 3a00:03c7 }
  if kind = 3 then s := 'with one cruel blow'                                          { 3a00:03ca / 03d0 }
  else begin
    s := s + 'Hitting for ' + ByteToStr(dmgShown);                                     { 3a00:03e6 .. 041d }
    if dmgShown = 1 then s := s + ' point ' else s := s + ' points ';                  { 3a00:0422 / 0428 / 0452 }
    s := s + 'of damage';                                                              { 3a00:047a }
  end;
  ApplyDamage(tgt, dmgApplied);                                                          { 3a00:04a2  ApplyDamage }
end else s := s + 'and Misses';                                                        { 3a00:04b3 }
if tgt^.status <> 8 then DrawWrappedText($17, row, $26, row + 3, 10, 0, 1, s);         { 3a00:04db / 04e6  new guard }
row := text_Row + 1;                                                                   { 3a00:050c }
if dmgApplied <> 0 then begin                                                          { 3a00:0515 }
  cb(tgt)^[1] := 0;                                                                    { 3a00:051b }
  if cb(tgt)^.castSpell <> 0 then begin                                                { 3a00:0528 }
    MessageDelay;                                                                      { 3a00:0536 }
    ShowCharacterMessage(tgt, 'lost a spell', $0C, 1);                                            { 3a00:053b / 0550 }
    ForgetMemorizedSpell(tgt, cb(tgt)^.castSpell);                                                { 3a00:055b  ForgetMemorizedSpell(tgt, spell) }
    cb(tgt)^.castSpell := 0;                                                           { 3a00:0572 }
  end else MessageDelay;                                                               { 3a00:0580 }
end else MessageDelay;                                                                 { 3a00:0587 }
if tgt^.active = 0 then begin                                                          { 3a00:058c }
  ShowCharacterMessage(tgt, 'goes down', row, 0);                                                 { 3a00:059a / 05af }
  row := row + 2;                                                                      { 3a00:05bb }
  if tgt^.status = 5 then DrawText($17, row, 10, 0, 'and is Dying');                   { 3a00:05bf / 05e6 }
  if tgt^.status in [6, 7, 8] then ShowCharacterMessage(tgt, 'is killed', row, 0);                { 3a00:05eb / 0615  set CS:02F3 }
  row := row + 2;                                                                      { 3a00:0621 }
  RemoveCombatEffects(tgt);                                                                      { 3a00:0625  RemoveCombatEffects }
  CallEffectHooks($0D, tgt);                                                                 { 3a00:0630 }
  if tgt^.active = 0 then RemoveCombatant(tgt) else MessageDelay;                      { 3a00:063e / 0649 / 0656 }
end;
ClearCharacterMessage;                                                                             { 3a00:065b  ClearCharacterMessage }
```

### 3A00:0666 FreeAttacksOnMover (M)
`procedure FreeAttacksOnMover(c [BP+6]: PChar)` — RETF 4. Caller: StepCombatant. Callees: CollectOppositeSideTargets, IsHelpless, CombatantCol/Row, FocusSquare, FaceAttacker, Attack. Pool: 6100:0627 (0.98), same body.
```pascal
n := CollectOppositeSideTargets(c, 1);                                                                  { 3a00:066c  adjacent enemies }
for i := 1 to n do                                                                     { 3a00:0683 }
  if c^.active <> 0 then begin                                                         { 3a00:0695 }
    e := cb_Char[foe_List[i]];                                                         { 3a00:06a3 }
    if (cb(e)^.freeAttack <> 0) and not IsHelpless(e) then begin                        { 3a00:06c2 / 06d1 }
      FocusSquare(CombatantCol(c), CombatantRow(c), 2, 8);                             { 3a00:06e0 .. 06fe }
      cb(e)^.freeAttack := 0;                                                          { 3a00:0703 }
      FaceAttacker(e, c);                                                              { 3a00:0710 }
      Attack(e, c, 0, nil, dummy);                                                     { 3a00:0720 }
    end;
  end;
```

### 3A00:074F StepCombatant (M)
`procedure StepCombatant(c [BP+8]: PChar; dir [BP+6]: Byte)` — RETF 6, entry e5. Callees: CombatantIndex, InWindow, FocusSquare, RestoreTerrain, RebuildOccupancy, PlayOrStopSound, FreeAttacksOnMover, IsHelpless. Pool: 6100:0712 (0.76). **changed:** the step costs `CombatTerrain[destination tile] × 2 / 3` (Pool: 2 / 3); a step that costs more than the allowance zeroes the allowance **and is still taken**; all drawing is gated by `combat_Visible`.
```pascal
idx := CombatantIndex(c);                                                              { 3a00:0755 }
ox := cb_Col[idx];  oy := cb_Row[idx];                                                 { 3a00:0763 / 0775 }
nx := ox + step_dx[dir];  ny := oy + step_dy[dir];                                     { 3a00:0787 / 079e }
cost := CombatTerrain[cm_Map^.grid[ny, nx]];                                           { 3a00:07bc .. 081a  +7 + ny*50 + nx }
if Odd(dir) then cost := Byte(cost * 3) else cost := Byte(cost * 2);                   { 3a00:07b5 / 07e5 / 0818 }
if cb^.moveLeft < cost then cb^.moveLeft := 0 else cb^.moveLeft := cb^.moveLeft - cost;   { 3a00:081d .. 083d }
mode := 1;                                                                             { 3a00:07ef }
if c^.controlled <> 0 then begin                                                       { 3a00:080c  +198h }
  mode := 3;                                                                           { 3a00:0816 }
  if not InWindow(nx - cm_Map^.viewX, ny - cm_Map^.viewY) and (combat_Visible <> 0) then   { 3a00:081d .. 088c }
    FocusSquare(ox, oy, 2, 8);                                                         { 3a00:0893 }
end;
if combat_Visible <> 0 then RestoreTerrain(0, 0, idx);                                 { 3a00:08a6 / 08ad }
cb_Col[idx] := nx;  cb_Row[idx] := ny;                                                 { 3a00:08bc / 08ce }
RebuildOccupancy;                                                                      { 3a00:08e0 }
if combat_Visible <> 0 then FocusSquare(nx, ny, mode, 8);                              { 3a00:08e5 / 08ec }
cb^.timesAttacked := 0;  cb^.rotation := 0;                                            { 3a00:0900 / 090d }
PlayOrStopSound(snd_Step);                                                               { 3a00:091a }
FreeAttacksOnMover(c);                                                                 { 3a00:0923 }
if (c^.active = 0) or IsHelpless(c) then cb^.moveLeft := 0;                             { 3a00:092d / 0938 / 0947 }
```

### 3A00:095A AttacksOfOpportunity (M)
`procedure AttacksOfOpportunity(c [BP+8]: PChar; dir [BP+6]: Byte)` — RETF 6, entry e6. Callees: FillChar, CombatantIndex, CollectOppositeSideTargets, IsHelpless, CanAttack, HasEffect, CombatantCol/Row, InFrontArc, Attack, DrawCharacterSummary. Pool: 6100:08B2 (0.98). **changed:** the display is switched on (`combat_Shown := 1; combat_Visible := 1`) before each free attack.
```pascal
FillChar(L, 12, 0);                                                                    { 3a00:0960 }
idx := CombatantIndex(c);                                                              { 3a00:0971 }
n := CollectOppositeSideTargets(c, 1);                                                                  { 3a00:097f }
if n = 0 then exit;                                                                    { 3a00:0990 }
for i := 1 to n do L[i] := foe_List[i];                                                { 3a00:099f }
cb_Col[idx] := cb_Col[idx] + step_dx[dir];  cb_Row[idx] := cb_Row[idx] + step_dy[dir]; { 3a00:09ae / 09cb  tentative step }
m := CollectOppositeSideTargets(c, 1);                                                                  { 3a00:09ff }
cb_Col[idx] := cb_Col[idx] - step_dx[dir];  cb_Row[idx] := cb_Row[idx] - step_dy[dir]; { 3a00:0a10 / 0a2a  undo }
for i := 1 to n do begin                                                               { 3a00:0a4a }
  still := false;                                                                      { 3a00:0a59 }
  for j := 1 to m do if foe_List[j] = L[i] then still := true;                         { 3a00:0a63 .. 0a7f }
  if still then L[i] := 0;                                                             { 3a00:0a8f }
end;
for i := 1 to n do                                                                     { 3a00:0aa8 }
  if (L[i] <> 0) and (c^.active <> 0) then begin                                       { 3a00:0ab6 / 0ac0 }
    combat_Shown := 1;  combat_Visible := 1;                                           { 3a00:0ae6 / 0aeb  new }
    done := false;                                                                     { 3a00:0af0 }
    e := cb_Char[L[i]];                                                                { 3a00:0af4 }
    if not IsHelpless(e) and CanAttack(c, e)                                            { 3a00:0b12 / 0b24 }
       and not HasEffect(e, $4B, p)                                                    { 3a00:0b3b }
       and not HasEffect(e, $4A, p) then                                               { 3a00:0b55 }
      for k := cb(e)^.facing + 6 to cb(e)^.facing + 10 do                              { 3a00:0b6f .. 0b94 }
        if not done then                                                               { 3a00:0ba1 }
          if (cb(e)^.initiative > 0) or (cb(e)^.timesAttacked = 0) or                  { 3a00:0ba4 / 0bad }
             InFrontArc(CombatantCol(e), CombatantRow(e), CombatantCol(c), CombatantRow(c), k mod 8) then begin   { 3a00:0bcb .. 0c08 }
            slot := 1;                                                                 { 3a00:0c14 }
            if e^.attacks = 0 then slot := 2;                                          { 3a00:0c18  +11Ch }
            for j := 1 to 2 do if e^.attacks_left[j] <> 0 then slot := j;              { 3a00:0c30 .. 0c3a }
            if e^.attacks_left[slot] = 0 then e^.attacks_left[slot] := 1;              { 3a00:0c48 }
            cb(e)^.attackSlot := slot;                                                 { 3a00:0c60 }
            saved := cb(e)^.target;                                                    { 3a00:0c7f }
            Attack(e, c, 1, nil, dummy_Done);                                          { 3a00:0c93 }
            done := true;                                                              { 3a00:0cb1 }
            cb(e)^.target := saved;                                                    { 3a00:0cb5 }
            if c^.active <> 0 then begin combat_Shown := 1; DrawCharacterSummary(c) end;          { 3a00:0cca / 0cd5 / 0cda  DrawCharacterSummary }
          end;
  end;
```

### 3A00:0D1C Flee (M)
`function Flee(c [BP+6]: PChar): Byte` — RETF 4, entry e7. Callees: CollectOppositeSideTargets, CalcMove, MaxEnemyMove, Roll, RemoveFromCombat, ShowTimedBottomMessage, ClearCombatantActionFlags. Pool: 6100:0C6A (0.97), same body.
```pascal
escaped := false;                                                                      { 3a00:0d22 }
if CollectOppositeSideTargets(c, $FF) = 0 then escaped := true                                          { 3a00:0d26 / 0d38 }
else begin
  mine := CalcMove(c) div 2;                                                           { 3a00:0d3e }
  theirs := MaxEnemyMove(c);                                                           { 3a00:0d53 }
  if theirs < mine then escaped := true                                                { 3a00:0d60 }
  else if (theirs = mine) and (Roll(1, 2) = 1) then escaped := true;                   { 3a00:0d6e / 0d76 }
end;
if escaped then RemoveFromCombat(c, 3, 'Got Away')                                            { 3a00:0d89 / 0da7  RemoveFromCombat(c, Running, msg) }
else ShowTimedBottomMessage('Escape is blocked');                                                   { 3a00:0dbd }
Result := ClearCombatantActionFlags(c);                                                                { 3a00:0dc2 }
```

### 3A00:0DD9 CalcAttacks (H)
`procedure CalcAttacks(c [BP+6]: PChar)` — RETF 4, entry e8. Callees: WeaponIsRanged, GetMissileAmmo, CallEffectHooks, HalfRound. Pool: 6100:0D23 (0.99). **changed:** the ammunition limit applies only when the stack count is not 0.
```pascal
missile := false;                                                                      { 3a00:0ddf }
old := c^.attacks_left[1];                                                             { 3a00:0de3  +19Ch }
c^.attacks_left[1] := c^.attacks;                                                      { 3a00:0dee  +11Ch }
if WeaponIsRanged(c) and GetMissileAmmo(c, ammo) then begin                                      { 3a00:0dfe / 0e0d }
  missile := true;                                                                     { 3a00:0e21 }
  rof := ITEMS[c^.readied[0]^.itype].rof;                                              { 3a00:0e25  g_5CFB }
  if rof < 2 then rof := 2;                                                            { 3a00:0e40 }
  StatValue := rof;                                                                    { 3a00:0e4a }
end else StatValue := c^.attacks_left[1];                                              { 3a00:0e52 }
StatKind := 0;                                                                         { 3a00:0e5d }
CallEffectHooks($12, c);                                                                     { 3a00:0e62 }
n := HalfRound(StatValue);                                                             { 3a00:0e70 / 0e75 }
if missile and (ammo <> nil) then begin                                                { 3a00:0e7b }
  k := 1;                                                                              { 3a00:0e89 }
  if ammo^.count > 1 then k := ammo^.count;                                            { 3a00:0e8d  +39h }
  if (k < n) and (ammo^.count <> 0) then n := k;                                       { 3a00:0eab / 0eb3 }
end;
if (cb^.attacked = 0) or (n < old) or ((n < 2 * old) and not missile) then             { 3a00:0ec3 .. 0efb }
  c^.attacks_left[1] := n;                                                             { 3a00:0f01 }
```

### 3A00:0F12 HalfRound (H)
`function HalfRound(v [BP+6]: Byte): Byte` — RETF 2. Callers: StartCombatRound, CalcAttacks. Pool: 6100:0E52 (0.89).
```pascal
t := v;  if Odd(CombatRound) then t := t + 1;  Result := t div 2;                      { 3a00:0f18 / 0f1e / 0f28 }
```

### 3A00:0F46 FighterSweep (M)
`function FighterSweep(att [BP+0Ah], tgt [BP+6]: PChar): Boolean` — RETF 8, entry e10. Callees: TargetDistance, CollectOppositeSideTargets, ShowCharacterMessage, CombatantIndex, FaceAttacker, Attack. Pool: 6100:0E82 (0.95), same logic (`level` +E5h = 0 marks a sub-1-HD creature).
```pascal
Result := false;                                                                       { 3a00:0f4c }
if att^.attacks_left[1] >= cb(att)^.sweepLeft then exit;                               { 3a00:0f50 }
if (tgt^.level <> 0) or (TargetDistance(att, tgt) <> 1) then exit;                          { 3a00:0f69 / 0f77 }
n := CollectOppositeSideTargets(att, 1);                                                                { 3a00:0f8f }
cnt := 0;                                                                              { 3a00:0fa0 }
for i := 1 to n do begin                                                               { 3a00:0faa }
  e := cb_Char[foe_List[i]];                                                           { 3a00:0fb6 }
  if e = tgt then pos := i;                                                            { 3a00:0fd8  pos uninitialised when tgt is not adjacent }
  if e^.level = 0 then cnt := cnt + 1;                                                 { 3a00:0fe2 }
end;
if cnt <= att^.attacks_left[1] then exit;                                              { 3a00:1003 }
if cnt > cb(att)^.sweepLeft then cnt := cb(att)^.sweepLeft;                            { 3a00:1013 }
ShowCharacterMessage(att, 'sweeps', 10, 1);                                                       { 3a00:1033 / 1048 }
if cb_Char[foe_List[1]] <> tgt then begin                                              { 3a00:1053 }
  foe_List[pos] := foe_List[1];                                                        { 3a00:1079 }
  foe_List[1] := CombatantIndex(tgt);                                                  { 3a00:1088 }
end;
for i := 1 to n do                                                                     { 3a00:109c }
  if (cnt <> 0) and (cb_Char[foe_List[i]]^.level = 0) then begin                       { 3a00:10ab / 10b4 }
    e := cb_Char[foe_List[i]];                                                         { 3a00:10d3 }
    FaceAttacker(att, e);                                                              { 3a00:10f2 }
    att^.attacks_left[1] := 1;                                                         { 3a00:1102 }
    Attack(att, e, 0, nil, dummy_Done);                                                { 3a00:110b }
    cnt := cnt - 1;                                                                    { 3a00:1129 }
  end;
Result := true;                                                                        { 3a00:1137 }
```

### 3A00:1144 CanAttack (M)
`function CanAttack(att [BP+0Ah], tgt [BP+6]: PChar): Boolean` — RETF 8, entry e11. Callee: CallEffectHooks. Pool: 6100:1085 (0.81), same body.
```pascal
Result := false;                                                                       { 3a00:114a }
if tgt = nil then exit;                                                                { 3a00:114e }
if att = tgt then begin Result := true; exit end;                                      { 3a00:1159 / 1168 }
AttackBlocked := 0;                                                                    { 3a00:116e }
CallEffectHooks(1, tgt);                                                                     { 3a00:1173 }
if AttackBlocked = 0 then begin                                                        { 3a00:1181 }
  saved := cb(att)^.target;  cb(att)^.target := tgt;                                   { 3a00:1188 / 119c }
  CallEffectHooks(0, att);                                                                   { 3a00:11b1 }
  cb(att)^.target := saved;                                                            { 3a00:11bf }
end;
Result := AttackBlocked = 0;                                                           { 3a00:11d4 }
```

### 3A00:1227 TurnUndead (H)
`procedure TurnUndead(c [BP+6]: PChar)` — RETF 4, entry e12 (ov08 "Turn", ov09). Callees: ShowCharacterMessage, ClearMenuLine, MessageDelay, Roll, DualClassActive, FindTurnTarget, FocusCombatant, DrawCharacterSummary, ShowCombatMessageAnimation, RemoveCombatant, ClearCharacterMessage, ShowTimedBottomMessage, CountActiveSides, ClearCombatantActionFlags. Pool: 6100:116A (0.95). **changed:** the table column comes from the effective cleric level `level[0] + old_level[0] × DualClassActive(c)` — but for levels 1..8 the raw current cleric level is used as the column (quirk); the table itself is Pool's.
```pascal
ShowCharacterMessage(c, 'turns undead...', 10, 0);                                                { 3a00:122d / 1242 }
ClearMenuLine;  MessageDelay;                                                          { 3a00:124d / 1252 }
any := false;  stop := false;                                                          { 3a00:1257 / 125b }
cb^.hasTurned := 1;                                                                    { 3a00:125f }
extra := 6;                                                                            { 3a00:126c }
count := Roll(1, 12);                                                                  { 3a00:1270 }
d20 := Roll(1, 20);                                                                    { 3a00:127e }
lv := c^.level[0] + c^.old_level[0] * DualClassActive(c);                                    { 3a00:128c .. 12a7  +109h, +111h }
if (lv >= 1) and (lv <= 8) then col := c^.level[0]                                     { 3a00:1297 / 12cf  quirk: the raw cleric level }
else if (lv >= 9) and (lv <= 13) then col := 9 else col := 10;                         { 3a00:12c7 .. 12d5 }
while FindTurnTarget(c, u) and (count <> 0) and not stop do begin                      { 3a00:12d9 .. 12fe }
  v := TurnUndeadTable[u^.undead * 10 + col];                                          { 3a00:1301  +E9h; DS:0367 }
  if d20 < Abs(v) then stop := true                                                    { 3a00:1320 .. 1333 }
  else begin
    any := true;                                                                       { 3a00:1335 }
    FocusCombatant(u, 3, 0);                                                           { 3a00:133c }
    combat_Shown := 1;  DrawCharacterSummary(u);                                                  { 3a00:134d / 1358 }
    if v < 1 then begin                                                                { 3a00:135d }
      ShowCharacterMessage(u, 'Is destroyed', 10, 0);                                             { 3a00:138f / 13a4 }
      RemoveCombatant(u);                                                              { 3a00:13af }
      u^.status := 8;  u^.active := 0;                                                 { 3a00:13ba / 13c3  Gone }
    end else begin
      cb(u)^.turned := 1;                                                              { 3a00:1363 }
      ShowCombatMessageAnimation(u, 1, 'is turned');                                                    { 3a00:1370 / 1388  ShowCombatMessageAnimation }
    end;
    if extra <> 0 then extra := extra - 1;                                             { 3a00:13cc }
    count := count - 1;                                                                { 3a00:13d2 }
    if (count = 0) and (extra <> 0) and (v < 0) then count := count + 1;               { 3a00:13d8 .. 13e4 }
    ClearCharacterMessage;                                                                         { 3a00:13ed }
  end;
end;
if not any then ShowTimedBottomMessage('Nothing Happens...');                                       { 3a00:13f4 / 1410 }
CountActiveSides;                                                                             { 3a00:1415  CountActiveSides }
dummy_Done := ClearCombatantActionFlags(c);                                                            { 3a00:141a }
ClearCharacterMessage;                                                                             { 3a00:1428 }
```

### 3A00:1433 FindTurnTarget (H)
`function FindTurnTarget(c [BP+0Ah]: PChar; var u [BP+6]: PChar): Boolean` — RETF 8, entry e13. Callee: CollectOppositeSideTargets. Pool: 6100:1351 (0.94), same body (undead type at +E9h).
```pascal
best := $0D;  u := nil;                                                                { 3a00:1439 / 143d }
n := CollectOppositeSideTargets(c, $FF);                                                                { 3a00:1449 }
Result := false;                                                                       { 3a00:1457 }
for i := 1 to n do begin                                                               { 3a00:145e }
  e := cb_Char[foe_List[i]];                                                           { 3a00:1473 }
  if (cb(e)^.turned = 0) and (e^.undead > 0) and (e^.undead < best) then begin         { 3a00:1492 .. 14a4 }
    best := e^.undead;  u := e;  Result := true;                                       { 3a00:14ac / 14b9 / 14c4 }
  end;
end;
```

### 3A00:14E8 MeleeAttack (H)
`procedure MeleeAttack(att [BP+14h], tgt [BP+10h]: PChar; behind [BP+0Eh]: Byte; var done [BP+0Ah]: Byte; missile [BP+6]: PItem)` — RETF 12h. Caller: Attack. Callees: IsHelpless, PlayOrStopSound, ShowAttackResult, ov23_1569, @CopyBytes, RecalcItems, CallEffectHooks, CanBackstab, DirectionTo, RangePenalty, AttackRoll, RollDamage, ClearCombatantActionFlags. Pool: 6100:1406 (0.95). **changed:** (1) a fifth parameter `missile` — when the missile stack is empty and its type is 64h, all remaining swings are cancelled; (2) a backstab uses `ac_rear − 4` (Pool −2); (3) swings of slot k stop when the attacker itself becomes inactive; (4) `done` is forced when the attacker is inactive.
```pascal
backstab := behind;                                                                    { 3a00:14ee }
done := 0;                                                                             { 3a00:14f4 }
SlotHits[1] := 0;  SlotHits[2] := 0;  SlotSwings[1] := 0;  SlotSwings[2] := 0;         { 3a00:14fb .. 150a }
anyHit := false;  stop := false;                                                       { 3a00:150f / 1513 }
DamageAmount := 0;                                                                     { 3a00:1517 }
cb(att)^.attacked := 1;                                                                { 3a00:151c }
if IsHelpless(tgt) then begin                                                           { 3a00:1529  IsHelpless }
  PlayOrStopSound(g_25BA);                                                             { 3a00:153b }
  while att^.attacks_left[cb(att)^.attackSlot] = 0 do cb(att)^.attackSlot := cb(att)^.attackSlot - 1;   { 3a00:1544 .. 1562 }
  SlotSwings[cb(att)^.attackSlot] := SlotSwings[cb(att)^.attackSlot] + 1;              { 3a00:156d }
  ShowAttackResult(att, tgt, 3, tgt^.hp + 5, 1, 1);                                    { 3a00:1581  "slays helpless … with one cruel blow" }
  ov23_1569(att);                                                                      { 3a00:15a8  remove effects 19h }
  for k := 1 to 2 do att^.attacks_left[k] := 0;                                        { 3a00:15cc }
  anyHit := true;  done := 1;                                                          { 3a00:15d2 / 15d6 }
end else begin
  if (att^.readied[0] <> nil) and ((tgt^.size > $80) or ((tgt^.size and 7) > 1)) then begin   { 3a00:15e0 .. 15f8  +DEh }
    it := ITEMS[att^.readied[0]^.itype];                                               { 3a00:1608  16-byte copy }
    att^.dmg_dice[1] := it.dice_L;  att^.dmg_sides[1] := it.sides_L;                   { 3a00:1630 / 163b }
    att^.dmg_bonus[1] := att^.dmg_bonus[1] - it.dmg_bonus + it.bonus_L;                { 3a00:1646 }
  end;
  RecalcItems(tgt);                                                                    { 3a00:1667 }
  CallEffectHooks($0B, tgt);                                                                 { 3a00:1672 }
  if CanBackstab(att, tgt) then ac := tgt^.ac_rear - 4                                 { 3a00:1684 / 1698  changed: −4 }
  else begin
    if (cb(tgt)^.timesAttacked > 1) and (DirectionTo(att, tgt) = cb(tgt)^.facing) and (cb(tgt)^.rotation > 4) then   { 3a00:16aa .. 16e4 }
      backstab := 1;                                                                   { 3a00:16ea }
    ac := tgt^[$19A + Ord(backstab <> 0)];                                             { 3a00:16f0  ac / ac_rear }
  end;
  RangePenalty(att, tgt, ac);                                                          { 3a00:1705 }
  kind := Ord(backstab <> 0);                                                          { 3a00:171a }
  if CanBackstab(att, tgt) then kind := 2;                                             { 3a00:1728 }
  for k := cb(att)^.attackSlot downto 1 do                                             { 3a00:1740 .. }
    while (att^.attacks_left[k] <> 0) and not stop do begin                            { 3a00:175e }
      att^.attacks_left[k] := att^.attacks_left[k] - 1;                                { 3a00:1776 }
      cb(att)^.attackSlot := k;                                                        { 3a00:177f }
      SlotSwings[k] := SlotSwings[k] + 1;                                              { 3a00:178e }
      if AttackRoll(att, tgt, ac) or IsHelpless(tgt) then begin                          { 3a00:17a8 / 17c1  AttackRoll }
        SlotHits[k] := SlotHits[k] + 1;                                                { 3a00:17d3 }
        PlayOrStopSound(g_25BA);                                                       { 3a00:17de }
        anyHit := true;                                                                { 3a00:17e7 }
        RollDamage(att, tgt, k);                                                       { 3a00:17eb }
        ShowAttackResult(att, tgt, kind, DamageAmount, DamageAmount, 1);               { 3a00:17ff }
        if tgt^.active <> 0 then CallEffectHooks(k + 1, att);                                { 3a00:181e / 1829  event 2 / 3 }
        if tgt^.active = 0 then stop := true;                                          { 3a00:183b }
        if att^.active = 0 then att^.attacks_left[k] := 0;                             { 3a00:184a  new }
      end;
    end;
  if (missile <> nil) and (missile^.count = 0) and (missile^.itype = $64) then         { 3a00:1875 .. 188a  new }
    for k := 1 to 2 do att^.attacks_left[k] := 0;                                      { 3a00:1891 }
  if not anyHit then begin                                                             { 3a00:18aa }
    PlayOrStopSound(g_25BE);                                                           { 3a00:18b6 }
    ShowAttackResult(att, tgt, kind, 0, 0, 0);                                         { 3a00:18bf  "… and Misses" }
  end;
  done := 1;                                                                           { 3a00:18dc }
  for k := 1 to 2 do if att^.attacks_left[k] <> 0 then done := 0;                      { 3a00:18ec .. }
  cb(att)^.sweepLeft := 0;                                                             { 3a00:1905 }
end;
if att^.active = 0 then done := 1;                                                     { 3a00:1918  new }
if done <> 0 then done := ClearCombatantActionFlags(att);                                              { 3a00:1923 / 1933 }
```

### 3A00:194A FaceAttacker (M)
`procedure FaceAttacker(att [BP+0Ah], def [BP+6]: PChar)` — RETF 8, entry e14. Callee: DirectionTo. Pool: 6100:17F6 (1.00).
```pascal
cb(def)^.timesAttacked := cb(def)^.timesAttacked + 1;                                  { 3a00:1950 }
d := DirectionTo(def, att);                                                            { 3a00:195c }
diff := (d - cb(def)^.facing + 8) mod 8;                                               { 3a00:196f }
if diff > 4 then diff := 8 - diff;                                                     { 3a00:1993 }
cb(def)^.rotation := (cb(def)^.rotation + diff) mod 8;                                 { 3a00:1999 }
```

### 3A00:19D8 Attack (M)
`procedure Attack(att [BP+14h], tgt [BP+10h]: PChar; behind [BP+0Eh]: Byte; missile [BP+0Ah]: PItem; var done [BP+6]: Byte)` — RETF 12h, entry e15 (ov08, ov09). Callees: DirectionTo, IsVisible, ShowCombatant, DrawCharacterSummary, Crt.Delay, MissileAnim, MeleeAttack, ov24_305B, GetMem, Move, LoseItem, RecalcItems, ClearCombatantActionFlags. Pool: 6100:1884 (0.83). **changed:** (1) the display is switched on and `g_758E := CombatRound + 15` (L); (2) the defender's facing: a target attacked fewer than 2 times (Pool 3) and not from behind gets `facing := DirectionTo(tgt, att) + 4`, otherwise a visible target turns 180° unless attacked from behind — then `ShowCombatant(tgt, d, 0, 0)` draws it with `d` (the direction to the attacker, or its previous facing), so the +4 only survives when the target is off-screen (M); (3) a sling or weapon type 65h animates a stone; (4) `MeleeAttack` receives the missile item.
```pascal
combat_Visible := 1;  combat_Shown := 1;                                               { 3a00:19de / 19e3 }
combat_MaxRounds := Byte(CombatRound + $0F);                                                     { 3a00:19e8 }
if (cb(tgt)^.timesAttacked < 2) and (behind = 0) then begin                            { 3a00:19f3 .. 1a0b }
  d := DirectionTo(tgt, att);                                                          { 3a00:1a08 }
  cb(tgt)^.facing := (d + 4) mod 8;                                                    { 3a00:1a18 }
end else if IsVisible(tgt, false) then begin                                           { 3a00:1a38 }
  d := cb(tgt)^.facing;                                                                { 3a00:1a46 }
  if behind = 0 then cb(tgt)^.facing := (d + 4) mod 8;                                 { 3a00:1a59 / 1a5f }
end;
if IsVisible(tgt, false) then ShowCombatant(tgt, d, 0, false);                         { 3a00:1a7a / 1a8c }
d := DirectionTo(att, tgt);                                                            { 3a00:1aa1 }
DrawCharacterSummary(att);                                                                        { 3a00:1ab4  DrawCharacterSummary }
ShowCombatant(att, d, 1, false);                                                       { 3a00:1abf  attack pose }
cb(att)^.target := tgt;                                                                { 3a00:1ad4 }
Delay(100);                                                                            { 3a00:1ae9 }
if missile <> nil then MissileAnim(att, tgt, missile);                                 { 3a00:1af2 / 1afa }
if att^.readied[0]^.itype in [$2F, $65] then MissileAnim(att, tgt, att^.readied[0]);   { 3a00:1b10 .. 1b48  no nil test }
done := 1;                                                                             { 3a00:1b4b }
if (att^.attacks_left[1] <> 0) or (att^.attacks_left[2] <> 0) then begin               { 3a00:1b52 }
  savedSel := SelectedChar;  SelectedChar := att;                                      { 3a00:1b6b / 1b77 }
  MeleeAttack(att, tgt, behind, done, missile);                                        { 3a00:1b83 }
  if missile <> nil then begin                                                         { 3a00:1ba2 }
    if missile^.count <> 0 then missile^.count := missile^.count - SlotSwings[1];      { 3a00:1bad / 1bb7  +39h }
    if missile^.count = 0 then                                                         { 3a00:1bc1 }
      if ov24_305B(att) and (missile^.power2 <> $89) then begin                        { 3a00:1bce / 1bdd }
        GetMem(copy, $3F);  Move(missile^, copy^, $3F);                                { 3a00:1be7 / 1bf5 }
        copy^.next := TreasureItems;  TreasureItems := copy;  copy^.readied := 0;      { 3a00:1c08 / 1c19 / 1c25 }
        LoseItem(att, missile);                                                        { 3a00:1c2d }
        treasure_Mark := copy;                                                         { 3a00:1c3e  g_650E }
      end else LoseItem(att, missile);                                                 { 3a00:1c4c }
  end;
  RecalcItems(att);                                                                    { 3a00:1c5d }
  SelectedChar := savedSel;                                                            { 3a00:1c68 }
end;
if done <> 0 then done := ClearCombatantActionFlags(att);                                              { 3a00:1c74 / 1c7d }
if IsVisible(att, false) then begin                                                    { 3a00:1c8e }
  ShowCombatant(att, cb(att)^.facing, 1, true);                                        { 3a00:1ca0 }
  ShowCombatant(att, cb(att)^.facing, 0, false);                                       { 3a00:1cbe }
end;
```

### 3A00:1CE2 RangePenalty (M)
`procedure RangePenalty(att [BP+0Eh], tgt [BP+0Ah]: PChar; var ac [BP+6]: Byte)` — RETF 0Ch. Caller: MeleeAttack. Callees: TargetDistance, WeaponIsRanged. Pool: 6100:1B1E (0.97), same body.
```pascal
dist := TargetDistance(att, tgt);                                                           { 3a00:1ce8 }
if WeaponIsRanged(att) then band := (ITEMS[att^.readied[0]^.itype].range - 1) div 3         { 3a00:1cfc / 1d0b  g_5D02 }
else band := dist;                                                                     { 3a00:1d31 }
if ShortInt(dist) - ShortInt(band) > 0 then begin dist := dist - band; ac := ac + 2 end;   { 3a00:1d37 .. 1d5c }
if ShortInt(dist) - ShortInt(band) > 0 then ac := ac + 3;                              { 3a00:1d67 .. 1d8e }
```

### 3A00:1D9D ov13_LoadDeps (M)
Ten `CALLF` into entry 0 of ov19, ov31, ov32, ov33, ov24, ov22, ov23, ov26, ov34, ov25 { 3a00:1da0 .. 1dcd }; entry e34, called by ov09_LoadDeps.

### 3A00:1DF6 FindHealTarget (M)
`function FindHealTarget(c [BP+0Ah]: PChar; var t [BP+6]: PChar): Boolean` — RETF 8, entry e17 (ov09). Callees: CombatantCol/Row, CellAt. Pool: 6100:1BF8 (0.94), same body (corpse list g_6E52, status set CS:1DD6 = {6, 7, 8}).
```pascal
best := nil;  body := 0;  minHp := $FF;                                                { 3a00:1dfc .. 1e08 }
for d := 0 to 8 do begin                                                               { 3a00:1e0c }
  x := CombatantCol(c) + step_dx[d];  y := CombatantRow(c) + step_dy[d];               { 3a00:1e15 / 1e34 }
  CellAt(x, y, occ, ground);                                                           { 3a00:1e53 }
  if occ <> 0 then begin                                                               { 3a00:1e6a }
    t := cb_Char[occ];                                                                 { 3a00:1e73 }
    if (t^.side = c^.side) and (t^.hp < t^.maxhp) and                                  { 3a00:1e8e / 1ea3 }
       ((t^.hp < minHp) or ((t = c) and (t^.hp < t^.maxhp div 2))) then begin          { 3a00:1eba .. 1ef3 }
      best := t;  minHp := t^.hp;                                                      { 3a00:1f01 / 1f0f }
    end;
  end else if (ground = $1F) and (corpse_Count <> 0) then                              { 3a00:1f20 / 1f29 }
    for k := 1 to corpse_Count do                                                      { 3a00:1f2f }
      if (corpse_List[k].char <> nil) and not (corpse_List[k].char^.status in [6, 7, 8]) and   { 3a00:1f3e / 1f54 }
         (corpse_List[k].x = x) and (corpse_List[k].y = y) then body := k;             { 3a00:1f76 .. 1f9b }
end;
if (minHp < 8) or (body = 0) then t := best else t := corpse_List[body].char;          { 3a00:1fae .. 1fe0 }
Result := t <> nil;                                                                    { 3a00:1ff0 }
```

### 3A00:200F ChooseSpellTarget (M)
`function ChooseSpellTarget(spell [BP+0Eh], auto [BP+0Ch], allowEmpty [BP+0Ah]: Byte; var tgt [BP+6]: TTargetRec): Boolean` — RETF 0Ah. Caller: CollectSpellTargets. Callees: SpellRange, SelectTarget, FindHealTarget, CombatantCol/Row, AutoTarget, IsHelpless, FillChar. Pool: 6100:1E16 (0.79). `TTargetRec` = 7 bytes (`char +0`, `x +4`, `y +5`). **changed:** (1) the player path passes `Ord(spell <> 53h)` as SelectTarget's "may target a combatant" flag (spell 53h only aims at squares); (2) the AI path makes a **single** attempt (Pool 20) and no longer rejects area picks that contain a friend — only helpless targets of helpless-effect spells are refused.
```pascal
found := false;                                                                        { 3a00:2015 }
if auto = 0 then begin                                                                 { 3a00:2019 }
  SelectTarget(SelectedChar, SpellRange(spell), 0, allowEmpty, Ord(spell <> $53), found, tgt);   { 3a00:202e / 2056 }
  cb(SelectedChar)^.target := tgt.char;                                                { 3a00:2059 }
end else if spells_Table[spell].needsTarget = 0 then begin                             { 3a00:2075  g_37E8 }
  tgt.char := SelectedChar;                                                            { 3a00:2087 }
  if (spell <> 3) or FindHealTarget(SelectedChar, tgt.char) then begin                 { 3a00:2097 / 209d }
    tgt.x := CombatantCol(tgt.char);  tgt.y := CombatantRow(tgt.char);                 { 3a00:20b2 / 20c8 }
    found := true;                                                                     { 3a00:20e5 }
  end;
end else begin
  tries := 1;                                                                          { 3a00:20de  changed: one attempt }
  while (tries <> 0) and not found do begin                                            { 3a00:20f2 }
    ok := true;                                                                        { 3a00:20fb }
    if AutoTarget(SelectedChar, SpellRange(spell), 0, 1) then begin                     { 3a00:20ff / 211b }
      t := cb(SelectedChar)^.target;                                                   { 3a00:2122 }
      if IsHelpless(t) then                                                             { 3a00:2137  IsHelpless }
        for k := 1 to 4 do if spells_Table[spell].effect = HelplessEffectIds[k] then ok := false;   { 3a00:2146 .. 215f  g_37E4, g_27C9 }
      if ok then begin                                                                 { 3a00:2171 }
        tgt.char := cb(SelectedChar)^.target;                                          { 3a00:217d }
        tgt.x := CombatantCol(tgt.char);  tgt.y := CombatantRow(tgt.char);             { 3a00:2196 / 21ac }
        found := true;                                                                 { 3a00:21c2 }
      end;
    end;
    tries := tries - 1;                                                                { 3a00:21c6 }
  end;
end;
if found then begin Result := true; SpellX := tgt.x; SpellY := tgt.y end               { 3a00:21cc .. 21e7 }
else begin Result := false; FillChar(tgt, 7, 0) end;                                   { 3a00:21ec / 21fc }
```

### 3A00:2220 CollectSpellTargets (M)
`procedure CollectSpellTargets(spell [BP+0Ch], auto [BP+0Ah]: Byte; var ok [BP+6]: Byte)` — RETF 8. Caller: MAGIC (procedure variable / ov22). Callees: CombatantCol/Row, SpellCasterLevel, Roll, ChooseSpellTarget, ShowTimedBottomMessage, RedrawSquare, BuildTargetList. Pool: 6100:20C3 (0.69). Fills `SpellTargets[1..n]` / `SpellTargetCount` by the target code `spells_Table[spell].target and 0Fh`: 0 = caster; 0Fh = one chosen combatant or the chosen square; 8..0Eh = area of radius `code and 7`; **5 (new) = as many distinct combatants as a hit-dice budget allows** (budget = `SpellCasterLevel(4Fh)` for spell 4Fh, else 2d4; each target costs 1/2/4/8 by its level 0-1/2/3/4+, or by its size 1/2-3/4 → 1/2/4 for spell 4Fh); 1..4, 6, 7 = `(code and 3) + 1` distinct combatants.
```pascal
ok := 1;  SpellTargetCount := 0;  SpellArea := 0;                                      { 3a00:2226 .. 2232 }
SpellX := CombatantCol(SelectedChar);  SpellY := CombatantRow(SelectedChar);           { 3a00:2237 / 2247 }
code := spells_Table[spell].target and $0F;                                            { 3a00:2257  g_37E0 }
case code of
  0: begin SpellTargets[1] := SelectedChar; SpellTargetCount := 1 end;                 { 3a00:226f / 227c }
  5: begin                                                                             { 3a00:2284  new }
      sum := 0;  n := 0;                                                               { 3a00:228c / 2290 }
      if spell = $4F then budget := SpellCasterLevel($4F) else budget := Roll(2, 4);          { 3a00:2294 / 229a / 22a7 }
      stop := false;                                                                   { 3a00:22b5 }
      repeat
        if not ChooseSpellTarget(spell, auto, 0, t) then stop := true                  { 3a00:22b9 / 22d4 }
        else begin
          dup := false;                                                                { 3a00:22d8 }
          for j := 1 to n do if SpellTargets[j] = t.char then dup := true;             { 3a00:22de .. 2303 }
          if not dup then begin                                                        { 3a00:230c }
            n := n + 1;  SpellTargets[n] := t.char;                                    { 3a00:2314 / 2314 }
            SpellX := CombatantCol(t.char);  SpellY := CombatantRow(t.char);           { 3a00:2338 / 2346 }
            SpellTargetCount := SpellTargetCount + 1;                                  { 3a00:2354 }
            if spell = $4F then                                                        { 3a00:2358 }
              case t.char^.size of 1: sum := sum + 1; 2, 3: sum := sum + 2; 4: sum := sum + 4 end   { 3a00:235e .. 2397  +DEh }
            else case t.char^.level of 0, 1: sum := sum + 1; 2: sum := sum + 2; 3: sum := sum + 4; else sum := sum + 8 end;   { 3a00:2399 .. 23de  +E5h }
            if (n > 1) and (sum > budget) then stop := true;                           { 3a00:23e6 / 23ec }
          end else if auto = 0 then ShowTimedBottomMessage('Already been targeted')                 { 3a00:23f1 / 2400 }
          else budget := budget - 1;                                                   { 3a00:2405 }
          RedrawSquare(CombatantCol(t.char), CombatantRow(t.char));                    { 3a00:240b .. 241d }
        end;
      until stop or (budget = 0);                                                      { 3a00:2422 }
    end;
  $0F: if ChooseSpellTarget(spell, auto, 0, t) then begin                              { 3a00:2442 }
      if cb(SelectedChar)^.target <> nil then begin                                    { 3a00:245d }
        SpellTargets[1] := cb(SelectedChar)^.target;  SpellTargetCount := 1;           { 3a00:2470 / 2486 }
      end else begin
        BuildTargetList(SpellX, SpellY, (spells_Table[spell].target and $0F) shr 4, $FF, 1, cm_Map);   { 3a00:248e  radius always 0 (Pool quirk kept) }
        for i := 1 to tg_Count do SpellTargets[i] := cb_Char[tg_List[i].who];          { 3a00:24c2 .. 2508 }
        SpellTargetCount := tg_Count;  SpellArea := 1;                                 { 3a00:2510 / 2516 }
      end;
    end else ok := 0;                                                                  { 3a00:251d }
  8..$0E: if ChooseSpellTarget(spell, auto, 1, t) then begin                           { 3a00:2537 }
      BuildTargetList(SpellX, SpellY, spells_Table[spell].target and 7, $FF, 1, cm_Map);   { 3a00:2552 }
      for i := 1 to tg_Count do SpellTargets[i] := cb_Char[tg_List[i].who];            { 3a00:2581 .. 25c7 }
      SpellTargetCount := tg_Count;  SpellArea := 1;                                   { 3a00:25cf / 25d5 }
    end else ok := 0;                                                                  { 3a00:25dc }
  else begin                                                                           { 1..4, 6, 7 }
    left := (spells_Table[spell].target and 3) + 1;  n := 0;                           { 3a00:25e6 / 25f5 }
    while left <> 0 do                                                                 { 3a00:2601 }
      if ChooseSpellTarget(spell, auto, 0, t) then begin                               { 3a00:260a }
        dup := false;                                                                  { 3a00:2625 }
        for j := 1 to n do if SpellTargets[j] = t.char then dup := true;               { 3a00:262f .. }
        if not dup then begin                                                          { 3a00:2665 }
          n := n + 1;  SpellTargets[n] := t.char;  left := left - 1;                   { 3a00:266b .. 2686 }
          SpellX := CombatantCol(t.char);  SpellY := CombatantRow(t.char);             { 3a00:2689 / 2697 }
        end else if auto = 0 then ShowTimedBottomMessage('Already been targeted')                   { 3a00:26a5 / 26bc }
        else left := left - 1;                                                         { 3a00:26c3 }
        RedrawSquare(CombatantCol(t.char), CombatantRow(t.char));                      { 3a00:26c6 .. 26de }
      end else left := 0;                                                              { 3a00:26e5 }
    SpellTargetCount := n;                                                             { 3a00:26ec }
    if n = 0 then ok := 0;                                                             { 3a00:26f2 }
    SpellX := CombatantCol(SpellTargets[n]);  SpellY := CombatantRow(SpellTargets[n]); { 3a00:26ff / 271a  new; n = 0 reads SpellTargets[0] }
  end;
end;
```

### 3A00:275A BeginCast (M)
`procedure BeginCast(spell [BP+0Ch], auto [BP+0Ah]: Byte; var done [BP+6]: Byte)` — RETF 8, entry e19 (ov08 "Cast", ov09). Callees: SpellList, ShowTimedBottomMessage, ov24_2E05, FocusCombatant, DrawCharacterSummary, CastSpell, ClearCombatantActionFlags, ShowCharacterMessage. Pool: 6100:2414 (0.97). **changed:** the display is switched on before the player's layout redraw.
```pascal
caster := SelectedChar;  f := 1;  w := $FFFF;  done := 0;  sp := spell;               { 3a00:2760 .. 277c }
if sp = 0 then sp := SpellList(0, 1, w, f);                                            { 3a00:2782 / 2788  SpellList }
if (sp <> 0) and (spells_Table[sp].combat = 0) then begin                              { 3a00:27a0 / 27a6  g_37E5 }
  ShowTimedBottomMessage('Camp Only Spell');  sp := 0;                                              { 3a00:27b8 / 27c7 / 27cc }
end;
if auto = 0 then begin                                                                 { 3a00:27d0 }
  ov24_2E05;                                                                           { 3a00:27d6  DrawCombatLayout }
  combat_Visible := 1;  combat_Shown := 1;                                             { 3a00:27db / 27e0  new }
  FocusCombatant(caster, 3, 1);  DrawCharacterSummary(caster);                                    { 3a00:27e5 / 27f6 }
end;
if sp <> 0 then begin                                                                  { 3a00:2801 }
  ct := spells_Table[sp].castTime div 3;                                               { 3a00:280a  g_37E6 }
  if ct = 0 then begin                                                                 { 3a00:2824 }
    CastSpell(sp, auto, 1, done);                                                      { 3a00:282a  CastSpell }
    done := ClearCombatantActionFlags(caster);                                                         { 3a00:283f }
  end else begin
    done := 1;                                                                         { 3a00:2852 }
    ShowCharacterMessage(caster, 'Begins Casting', 10, 1);                                        { 3a00:2859 / 286e }
    cb(caster)^.castSpell := sp;                                                       { 3a00:2879 }
    if cb(caster)^.initiative > ct then cb(caster)^.initiative := cb(caster)^.initiative - ct   { 3a00:2887 / 289f }
    else cb(caster)^.initiative := 1;                                                  { 3a00:28b0 }
  end;
end;
```

### 3A00:28C3 CanBackstab (H)
`function CanBackstab(att [BP+0Ah], tgt [BP+6]: PChar): Boolean` — RETF 8. Callers: RollDamage, MeleeAttack. Callees: DualClassActive, DirectionTo. Pool: 6100:2574 (0.80). **changed:** a current or former thief; no armour test; weapon type 61h added; the target must be small or medium (`size and 7Fh < 2`).
```pascal
ok := false;                                                                           { 3a00:28c9 }
w := att^.readied[0];                                                                  { 3a00:28cd }
if w <> nil then wt := w^.itype;                                                       { 3a00:28dd }
if ((att^.level[6] > 0) or ((att^.old_level[6] > 0) and (DualClassActive(att) <> 0))) and    { 3a00:28ef .. 291b  +10Fh, +117h }
   ((w = nil) or (wt in [$61, 7, 8]) or ((wt > $22) and (wt < $26))) then ok := true;  { 3a00:2924 .. 294e }
Result := ok and (cb(tgt)^.timesAttacked > 1) and ((tgt^.size and $7F) < 2) and        { 3a00:2954 .. 2977  +DEh }
          (DirectionTo(att, tgt) = cb(tgt)^.facing);                                   { 3a00:2971 }
```

### 3A00:29A2 DirectionTo (H)
`function DirectionTo(a [BP+0Ah], b [BP+6]: PChar): Byte` — RETF 8, entry e23. Callees: CombatantCol/Row. Pool: 6100:263D (0.19 — **rewritten**: no InFrontArc loop; pure arithmetic sectors with 22.5° boundaries).
Direction 0..7 from `a` to `b`: with `dx := |bx − ax|`, `dy := |by − ay|`, `steep := dx * 26Ah div 256` (≈ 2.414·dx, tan 67.5°) and `flat := dx * 6Ah div 256` (≈ 0.414·dx, tan 22.5°): 0 (N) when `by ≤ ay` and `dy ≥ steep`; 2 (E) when `bx ≥ ax` and `dy ≤ flat`; 4 (S) when `by ≥ ay` and `dy ≥ steep`; 6 (W) when `bx ≤ ax` and `dy ≤ flat`; the diagonals 1/3/5/7 need the two half-plane tests of their quadrant and `flat ≤ dy ≤ steep`. The first matching direction in the order 0, 1, 2, … 7 is returned (a = b gives 0); the loop has no exit when nothing matches (impossible for the sectors above).
```pascal
ax := CombatantCol(a);  ay := CombatantRow(a);  bx := CombatantCol(b);  by := CombatantRow(b);   { 3a00:29a8 .. 29db }
dx := Abs(bx - ax);  dy := Abs(by - ay);                                               { 3a00:29e4 .. 2a06 }
d := 0;  found := false;                                                               { 3a00:2a02 / 2a06 }
while not found do begin                                                               { 3a00:2a0a }
  case d of                                                                            { 3a00:2a13 .. 2be0 }
    0: found := (by <= ay) and (dy >= dx * $26A div 256);
    2: found := (bx >= ax) and (dy <= dx * $6A div 256);
    4: found := (by >= ay) and (dy >= dx * $26A div 256);
    6: found := (bx <= ax) and (dy <= dx * $6A div 256);
    1: found := (by <= ay) and (bx >= ax) and (dy <= dx * $26A div 256) and (dy >= dx * $6A div 256);
    3: found := (by >= ay) and (bx >= ax) and (dy <= dx * $26A div 256) and (dy >= dx * $6A div 256);
    5: found := (by >= ay) and (bx <= ax) and (dy <= dx * $26A div 256) and (dy >= dx * $6A div 256);
    7: found := (by <= ay) and (bx <= ax) and (dy <= dx * $26A div 256) and (dy >= dx * $6A div 256);
  end;
  if not found then d := d + 1;                                                        { 3a00:2be0 }
end;
Result := d;                                                                           { 3a00:2bec }
```

### 3A00:2BFB MissileAnim (M)
`procedure MissileAnim(att [BP+0Eh], tgt [BP+0Ah]: PChar; it [BP+6]: PItem)` — RETF 0Ch. Caller: Attack. Callees: PlayOrStopSound, DirectionTo, CopyCombatAnimationFrame, BuildFourAnimationFrames, CombatantCol/Row, AnimateAlongPath. Pool: 6100:26B0 (0.76). **changed:** absolute frame numbers (Pool base 0Dh), a new class of types 65h/2Fh/62h (frame 15h), per-class sounds, no sound-timer calls.
```pascal
PlayOrStopSound(g_25C4);                                                               { 3a00:2c01 }
d := DirectionTo(att, tgt);                                                            { 3a00:2c0a }
steps := 1;  pause := 10;                                                              { 3a00:2c1a / 2c1d }
t := it^.itype;                                                                        { 3a00:2c21 }
if t in [9, $15, $64, $1C, $1F, $49] then begin                                        { 3a00:2c29 .. 2c5b }
  if Odd(d) then                                                                       { 3a00:2c5e }
    if (d = 3) or (d = 5) then CopyCombatAnimationFrame($0E, 1, 0, Ord(d = 5))                        { 3a00:2c65 / 2c8a  CopyCombatAnimationFrame }
    else CopyCombatAnimationFrame($0E, 0, 0, Ord(d = 7))                                              { 3a00:2cab }
  else CopyCombatAnimationFrame($0D + d mod 4, d div 4, 0, 0);                                        { 3a00:2cb3 }
  PlayOrStopSound(g_25C4);                                                             { 3a00:2ce0 }
end else if t in [2, 7, $14] then begin                                                { 3a00:2ce9 }
  BuildFourAnimationFrames($10);  steps := 4;  pause := $32;  PlayOrStopSound(g_25BE);                { 3a00:2cfb .. 2d15 }
end else if t in [$55, $56] then begin                                                 { 3a00:2d1a }
  BuildFourAnimationFrames($11);  steps := 4;  pause := $32;  PlayOrStopSound(g_25B8);                { 3a00:2d27 .. 2d41 }
end else if t in [$65, $2F, $62] then begin                                            { 3a00:2d46 .. 2d5e  new class }
  CopyCombatAnimationFrame($15, 0, 0, 0);                                                             { 3a00:2d5b  d + 7 with d = 0Eh }
  CopyCombatAnimationFrame($15, 1, 1, 0);  steps := 2;  pause := 10;  PlayOrStopSound(g_25B8);        { 3a00:2d72 .. 2d95 }
end else begin
  CopyCombatAnimationFrame($14, 0, 0, 0);                                                             { 3a00:2d9c  d + 7 with d = 0Dh }
  CopyCombatAnimationFrame($14, 1, 1, 0);  steps := 2;  pause := $14;  PlayOrStopSound(g_25BE);       { 3a00:2db3 .. 2dd6 }
end;
AnimateAlongPath(CombatantCol(att), CombatantRow(att), CombatantCol(tgt), CombatantRow(tgt), steps, pause);   { 3a00:2ddb .. 2e17  AnimateAlongPath }
```

### 3A00:2E22 CalcEnemyHpPct (M)
`procedure CalcEnemyHpPct` — RETF. Callers: ov08 (per round), StartCombat. Pool: 6100:2879 (0.81), same body.
```pascal
sumMax := 0;  sumHp := 0;                                                              { 3a00:2e28 / 2e2a }
p := PartyHead;                                                                        { 3a00:2e32 }
while p <> nil do begin                                                                { 3a00:2e3e }
  if p^.side = 1 then begin                                                            { 3a00:2e46 }
    if p^.active <> 0 then sumHp := sumHp + p^.hp;                                     { 3a00:2e51 / 2e5c }
    sumMax := sumMax + p^.maxhp;                                                       { 3a00:2e6c }
  end;
  p := p^.next;                                                                        { 3a00:2e7b }
end;
if sumMax <> 0 then enemy_HpPercent := Byte((Word($14 * sumHp) div sumMax) * 5);       { 3a00:2e8d / 2e93 }
```

### 3A00:2EAC MaxEnemyMove (M)
`function MaxEnemyMove(c [BP+6]: PChar): Byte` — RETF 4, entry e26. Callees: IsSideZero, CalcMove. Pool: 6100:2908 (0.87), same body.
```pascal
best := 0;                                                                             { 3a00:2eb2 }
p := PartyHead;                                                                        { 3a00:2eb6 }
while p <> nil do begin                                                                { 3a00:2ec2 }
  if (p^.side = Ord(IsSideZero(c))) and (p^.active <> 0) then begin                     { 3a00:2eca / 2ed5 }
    m := CalcMove(p) div 2;                                                            { 3a00:2eea }
    if m > best then best := m;                                                        { 3a00:2eff }
  end;
  p := p^.next;                                                                        { 3a00:2f0d }
end;
Result := best;                                                                        { 3a00:2f25 }
```

### 3A00:2F3C ConfirmAttackAlly (M)
`function ConfirmAttackAlly(att [BP+0Ah], tgt [BP+6]: PChar): Boolean` — RETF 8. Caller: ConfirmTarget. Callees: IsSideZero, AskYesNo, CountActiveSides. Pool: 6100:2998 (0.94), same body (ECL flag `Mem[7F33]`).
```pascal
if (att^.side = Ord(IsSideZero(tgt))) or (att^.controlled <> 0) then begin Result := true; exit end;   { 3a00:2f42 .. 2f66 }
if AskYesNo('Attack Ally: ', 13, 10, 15) <> 'Y' then Result := false                   { 3a00:2f69 / 2f78 / 2f8a }
else begin
  Result := true;  AllyAttacked := 1;  Mem[7F33] := 1;                                 { 3a00:2f90 / 2f94 / 2f99 }
  p := PartyHead;                                                                      { 3a00:2fa4 }
  while p <> nil do begin                                                              { 3a00:2fb0 }
    if (p^.status = 0) and (p^.npc_morale > $7F) then begin p^.side := 1; cb(p)^.target := nil end;   { 3a00:2fb8 .. 2fdf }
    p := p^.next;                                                                      { 3a00:2fe9 }
  end;
  CountActiveSides;                                                                           { 3a00:2ffb  CountActiveSides }
end;
```

### 3A00:3040 TargetMenu (M)
`function TargetMenu(att [BP+12h], t [BP+0Eh]: PChar; maxRange [BP+0Ch], showRange [BP+0Ah], allowEmpty [BP+8], canTargetChar [BP+6]: Byte): Char` — RETF 10h. Caller: SelectTarget. Callees: TargetDistance, DirectionTo, ByteToStr, DrawText, WeaponIsRanged, GetMissileAmmo, CollectOppositeSideTargets, ov24_305B, FocusCombatant, DrawCharacterSummary, HorizontalMenu. Pool: 6100:2AA0 (0.97). **changed:** a sixth parameter `canTargetChar` (spell 53h passes 0: no "Target" for spells on combatants); `allowEmpty` is not read; the menu allows extended keys.
```pascal
menu := '';                                                                            { 3a00:3047 }
dist := TargetDistance(att, t);                                                             { 3a00:304b }
dir := DirectionTo(att, t);                                                            { 3a00:305f  unused }
if showRange <> 0 then DrawText(0, $17, 10, 0, 'Range = ' + ByteToStr(dist) + '  ');   { 3a00:3072 .. 30b2 }
if dist <= maxRange then                                                               { 3a00:30b7 }
  if showRange = 0 then begin if canTargetChar <> 0 then menu := 'Target ' end         { 3a00:30c2 / 30c8 / 30ce }
  else if att <> t then                                                                { 3a00:30e9 }
    if not WeaponIsRanged(att) then menu := 'Target '                                       { 3a00:30f8 / 3107 }
    else if GetMissileAmmo(att, ammo) then                                                  { 3a00:311c }
      if (CollectOppositeSideTargets(att, 1) = 0) or ov24_305B(att) then menu := 'Target ';             { 3a00:3130 / 3142 / 3151 }
menu := 'Next Prev Manual ' + menu + 'Center Exit';                                    { 3a00:3164 .. 3191 }
FocusCombatant(t, 3, 1);                                                               { 3a00:3196 }
combat_Shown := 1;  DrawCharacterSummary(t);                                                      { 3a00:31a7 / 31b2 }
Result := HorizontalMenu('Aim:', menu, 13, 10, 15, 1, 0, ext);                         { 3a00:31b7 / 31df  changed: allowExt = 1 }
```

### 3A00:31F0 ConfirmTarget (M)
`procedure ConfirmTarget(att [BP+14h], t [BP+10h]: PChar; mode [BP+0Eh]: Byte; var ok [BP+0Ah]: Byte; var tgt [BP+6]: TTargetRec)` — RETF 12h. Callers: ManualAim, SelectTarget. Callees: ConfirmAttackAlly, CombatantCol/Row, FocusSquare, FighterSweep, ClearCombatantActionFlags, FaceAttacker, WeaponIsRanged, GetMissileAmmo, ov24_305B, TargetDistance, Attack, FillChar. Pool: 6100:2C3D (0.98), same body.
```pascal
ammo := nil;  ok := 1;                                                                 { 3a00:31f6 / 31fe }
if (mode = 1) and not ConfirmAttackAlly(att, t) then ok := 0;                          { 3a00:3205 / 320b / 321f }
if ok <> 0 then begin                                                                  { 3a00:3226 }
  tgt.char := t;  tgt.x := CombatantCol(t);  tgt.y := CombatantRow(t);                 { 3a00:3232 / 3241 / 3253 }
  cm_Map^[4] := 0;                                                                     { 3a00:3265 }
  FocusSquare(cm_Map^.viewX + 3, cm_Map^.viewY + 3, 3, 8);                             { 3a00:326e .. 328e }
  if mode = 1 then                                                                     { 3a00:3293 }
    if FighterSweep(att, t) then ok := ClearCombatantActionFlags(att)                                  { 3a00:329c / 32b0 }
    else begin
      FaceAttacker(att, t);                                                            { 3a00:32c3 }
      if WeaponIsRanged(att) and GetMissileAmmo(att, ammo) and ov24_305B(att) and (TargetDistance(att, t) = 1) then ammo := nil;   { 3a00:32d3 .. 331a }
      Attack(att, t, 0, ammo, ok);                                                     { 3a00:3322 }
    end;
end else FillChar(tgt, 7, 0);                                                          { 3a00:3342 }
```

### 3A00:33AC ManualAim (M)
`procedure ManualAim(att [BP+1Ah], start [BP+16h]: PChar; maxRange [BP+14h], mode [BP+12h], allowEmpty [BP+10h], canTargetChar [BP+0Eh]: Byte; var ok [BP+0Ah]: Byte; var tgt [BP+6]: TTargetRec)` — RETF 18h. Caller: SelectTarget. Callees: FillChar, CombatantCol/Row, FocusSquare, CellAt, FlushGameKeys, TraceLine, WordToStr, DrawText, ClearRectangle, DrawCharacterSummary, CanAttack, WeaponIsRanged, GetMissileAmmo, CollectOppositeSideTargets, ov24_305B, HorizontalMenu, ConfirmTarget, RedrawSquare. Pool: 6100:2DFA (0.97). **changed:** the `canTargetChar` flag (a combatant under the cursor is a valid target only when it is set); the keyboard is flushed each pass; the menu's `ext` is the global `dummy_Done`.
```pascal
FillChar(tgt, 7, 0);                                                                   { 3a00:33b3 }
cx := CombatantCol(start);  cy := CombatantRow(start);                                 { 3a00:33c4 / 33d2 }
key := ' ';  dir := 8;  ok := 0;                                                       { 3a00:33dd .. 33e4 }
cm_Map^[4] := 1;  cm_Map^[5] := 1;                                                     { 3a00:33ef / 33f8 }
while not (key in [#0, #13, 'E', 'T']) do begin                                        { 3a00:3401  set CS:3359 }
  FocusSquare(cx, cy, 3, dir);                                                         { 3a00:3414 }
  cx := cx + step_dx[dir];  cy := cy + step_dy[dir];                                   { 3a00:3428 / 3436 }
  if cx < 0 then cx := 0;  if cy < 0 then cy := 0;  if cx > $31 then cx := $31;  if cy > $18 then cy := $18;   { 3a00:3444 .. 3468 }
  CellAt(cx, cy, occ, ground);                                                         { 3a00:346c }
  FlushGameKeys;                                                                       { 3a00:3483 }
  valid := false;  rng := $FF;  tx := cx;  ty := cy;                                   { 3a00:3488 .. 3494 }
  if TraceLine(CombatantCol(att), CombatantRow(att), tx, ty, rng, cm_Map) then begin   { 3a00:349d .. 34cc }
    valid := true;                                                                     { 3a00:34d5 }
    if mode <> 0 then DrawText(0, $17, 10, 0, 'Range = ' + WordToStr(rng div 2) + '  ');   { 3a00:34d9 / 34df .. 3520 }
  end else if mode <> 0 then ClearRectangle(0, $17, $27, $17);                         { 3a00:34d5 / 352d }
  rng := rng div 2;                                                                    { 3a00:3527 }
  under := nil;                                                                        { 3a00:354b }
  if valid then                                                                        { 3a00:354d }
    if occ <> 0 then under := cb_Char[occ]                                             { 3a00:3553 / 3562 }
    else if (ground = $1F) and (corpse_Count <> 0) then                                { 3a00:357b / 3581 }
      for k := 1 to corpse_Count do                                                    { 3a00:3587 }
        if (corpse_List[k].x = cx) and (corpse_List[k].y = cy) then under := corpse_List[k].char;   { 3a00:3596 .. 35cc }
  if under <> nil then begin combat_Shown := 1; DrawCharacterSummary(under) end                   { 3a00:35e0 / 35e8 / 35ed }
  else ClearRectangle($17, 1, $26, $15);                                               { 3a00:35fa }
  if (maxRange < rng) or (CombatTerrain[ground] = $FF) then valid := false;            { 3a00:360b / 3615 / 3627 }
  if under <> nil then begin                                                           { 3a00:362b }
    if not CanAttack(att, under) or (canTargetChar = 0) then valid := false;           { 3a00:3636 / 364a / 3650 }
    if mode = 1 then                                                                   { 3a00:3654 }
      if (att = under) or ((occ = 0) and (ground = $1F)) then valid := false           { 3a00:365a .. 367b }
      else if WeaponIsRanged(att) then                                                      { 3a00:367b }
        if not GetMissileAmmo(att, ammo) then valid := false                                { 3a00:368a / 36bf }
        else if (CollectOppositeSideTargets(att, 1) <> 0) and not ov24_305B(att) then valid := false;   { 3a00:369e / 36b0 }
  end else if allowEmpty = 0 then valid := false;                                      { 3a00:36c5 / 36cb }
  menu := 'Center Exit';                                                               { 3a00:36cf }
  if valid then menu := 'Target ' + menu;                                              { 3a00:36e2 / 36e8 }
  key := HorizontalMenu('(Use Cursor keys) ', menu, 13, 10, 15, 1, 0, dummy_Done);     { 3a00:3710 / 3738 }
  case key of                                                                          { 3a00:3747 }
    #13, 'T': begin                                                                    { 3a00:374b }
        cm_Map^[4] := 0;                                                               { 3a00:374e }
        if valid then begin                                                            { 3a00:3757 }
          tgt.x := cx;  tgt.y := cy;                                                   { 3a00:375d / 3760 }
          if under <> nil then tgt.char := under else tgt.char := nil;                 { 3a00:3767 .. 3796 }
          if mode = 1 then ConfirmTarget(att, tgt.char, 1, ok, tgt) else ok := 1;      { 3a00:379c / 37bb / 37c0 }
        end;
        if (not valid) or (ok = 0) then begin RedrawSquare(cx, cy); ok := 0; FillChar(tgt, 7, 0) end;   { 3a00:37c7 .. 37f6 }
      end;
    'H': dir := 0;  'I': dir := 1;  'M': dir := 2;  'Q': dir := 3;  'P': dir := 4;  'O': dir := 5;  'K': dir := 6;  'G': dir := 7;   { 3a00:37fe .. 3847 }
    #0, 'E': begin RedrawSquare(cx, cy); FillChar(tgt, 7, 0); ok := 0 end;             { 3a00:3851 .. 3872 }
    'C': begin FocusSquare(cx, cy, 0, 8); dir := 8 end;                                { 3a00:3877 / 3884 / 3897 }
    else dir := 8;                                                                     { 3a00:389d }
  end;
end;
```

### 3A00:38AA CombatBuildTargetList (M) — nested procedure of SelectTarget
`procedure CombatBuildTargetList(c [BP+8]: PChar)` (+ static link [BP+6]) — RETF 6. Callees: CombatantCol/Row, CombatantSize, BuildTargetList, @CopyBytes. Pool: 6100:32E6 (0.92), same body: all combatants within 7Fh of c into SelectTarget's `L[1..n]` (3-byte entries from `tg_List`; `n` at the parent's `[BP−0DAh]`).
```pascal
BuildTargetList(CombatantCol(c), CombatantRow(c), $7F, $FF, CombatantSize(c), cm_Map); { 3a00:38b0 .. 38e3 }
n := tg_Count;                                                                         { 3a00:38e8 }
for i := 1 to n do L[i] := tg_List[i];                                                 { 3a00:38f3 .. 3938  CopyBytes 3 }
```

### 3A00:394B NextTarget (M) — nested function of SelectTarget
`function NextTarget(step [BP+0Ah]: ShortInt; draw [BP+8]: Byte): PChar` (+ static link [BP+6]) — RETF 6. Callees: RedrawSquare, AnimateAlongPath. Pool: 6100:3389 (0.88), same body (parent locals `cur [BP−0DBh]`, `px/py [BP−0DEh/−0DFh]`, `nx/ny [BP−0E0h/−0E1h]`).
```pascal
if draw <> 0 then begin px := cb_Col[L[cur].who]; py := cb_Row[L[cur].who] end         { 3a00:3951 / 3957 / 3984 }
else RedrawSquare(px, py);                                                             { 3a00:39b3 }
cur := cur + step;                                                                     { 3a00:39ca }
if cur = 0 then cur := n;                                                              { 3a00:39d5 }
if cur > n then cur := 1;                                                              { 3a00:39f0 }
t := cb_Char[L[cur].who];                                                              { 3a00:3a0b }
nx := cb_Col[L[cur].who];  ny := cb_Row[L[cur].who];                                   { 3a00:3a38 / 3a65 }
if draw <> 0 then begin                                                                { 3a00:3a65 }
  AnimateAlongPath(px, py, nx, ny, 1, 0);                                                     { 3a00:3a98  AnimateAlongPath: move the cursor }
  px := nx;  py := ny;                                                                 { 3a00:3acb / 3adb }
end;
Result := t;                                                                           { 3a00:3aeb }
```

### 3A00:3B37 SelectTarget (M)
`procedure SelectTarget(att [BP+16h]: PChar; range [BP+14h], mode [BP+12h], allowEmpty [BP+10h], canTargetChar [BP+0Eh]: Byte; var ok [BP+0Ah]: Byte; var tgt [BP+6]: TTargetRec)` — RETF 14h, entry (ov08 "Aim"). Callees: CopyCombatAnimationFrame, FillChar, CombatBuildTargetList, NextTarget, CanAttack, TargetMenu, ManualAim, ConfirmTarget, FocusSquare, CombatantCol/Row, RedrawSquare, ClearRectangle. Pool: 6100:3558 (0.88). **changed:** the `canTargetChar` flag is passed through; a cursor-key letter (set CS:3B17) or an extended key from the Aim menu goes straight into ManualAim.
```pascal
CopyCombatAnimationFrame($19, 0, 0, 0);                                                               { 3a00:3b3e  cursor frame }
FillChar(tgt, 7, 0);  ok := 0;                                                         { 3a00:3b4f / 3b60 }
maxR := range;                                                                         { 3a00:3b67 }
if maxR = $FF then                                                                     { 3a00:3b6e }
  if att^.readied[0] = nil then maxR := 1 else maxR := ITEMS[att^.readied[0]^.itype].range - 1;   { 3a00:3b75 .. 3b9f }
if (maxR = 0) or (maxR = $FF) then maxR := 1;                                          { 3a00:3baa }
CombatBuildTargetList(att);                                                            { 3a00:3bc4 }
cur := 1;                                                                              { 3a00:3bc8 }
t := NextTarget(0, 1);                                                                 { 3a00:3bdb }
skip := 1;  key := ' ';                                                                { 3a00:3be7 / 3bec }
while (ok = 0) and not (key in [#0, 'E']) do begin                                     { 3a00:3bf1 .. 3c07  set CS:3AF7 }
  if not CanAttack(att, t) then t := NextTarget(skip, 0)                               { 3a00:3c11 / 3c30 }
  else begin
    key := TargetMenu(att, t, maxR, mode, allowEmpty, canTargetChar);                  { 3a00:3c3f }
    if menu_Ext = 0 then                                                               { 3a00:3c66 }
      case key of
        'N': begin skip := 1; move := 1 end;                                           { 3a00:3c70 }
        'P': begin skip := -1; move := -1 end;                                         { 3a00:3c85 .. 3c8e }
        'M', 'H', 'K', 'G', 'O', 'Q', 'I': begin                                       { 3a00:3c96 .. 3cc4 }
            ManualAim(att, t, maxR, mode, allowEmpty, canTargetChar, ok, tgt);         { 3a00:3cba }
            CopyCombatAnimationFrame($19, 0, 0, 0);  CombatBuildTargetList(att);  move := 0;          { 3a00:3ce7 / 3cff / 3d03 }
          end;
        'T': begin                                                                     { 3a00:3d0a }
            ConfirmTarget(att, t, mode, ok, tgt);                                      { 3a00:3d0e }
            CopyCombatAnimationFrame($19, 0, 0, 0);  CombatBuildTargetList(att);  move := 0;          { 3a00:3d2e / 3d46 / 3d4a }
          end;
        'C': begin FocusSquare(CombatantCol(t), CombatantRow(t), 0, 8); move := 0 end; { 3a00:3d51 .. 3d7c }
      end
    else if key in ['G', 'H', 'I', 'K', 'M', 'O', 'P', 'Q'] then begin                 { 3a00:3d83  set CS:3B17: extended cursor keys }
      ManualAim(att, t, maxR, mode, allowEmpty, canTargetChar, ok, tgt);               { 3a00:3d94 }
      CopyCombatAnimationFrame($19, 0, 0, 0);  CombatBuildTargetList(att);  move := 0;                { 3a00:3dc1 / 3dd9 / 3ddd }
    end;
    RedrawSquare(CombatantCol(t), CombatantRow(t));                                    { 3a00:3de2 .. 3dfe }
    t := NextTarget(move, Ord((ok = 0) and not (key in [#0, 'E'])));                   { 3a00:3e03 .. 3e2b }
  end;
end;
if mode <> 0 then ClearRectangle(0, $17, $27, $17);                                    { 3a00:3e39 / 3e3f }
```

### 3A00:3E56 AutoTarget (M)
`function AutoTarget(c [BP+0Ch]: PChar; range [BP+0Ah], ignoreBlock [BP+8], fresh [BP+6]: Byte): Boolean` — RETF 0Ah, entry e27 (ov09). Callees: CanAttack, CollectOppositeSideTargets, Roll. Pool: 6100:37E4 (0.96), same body.
```pascal
pass := 0;  found := false;  last := 0;                                                { 3a00:3e5c .. }
t := cb(c)^.target;                                                                    { 3a00:3e68 }
if (fresh <> 0) or ((t <> nil) and ((t^.side = c^.side) or (t^.active = 0) or not CanAttack(c, t))) then   { 3a00:3e7c .. 3eb4 }
  cb(c)^.target := nil;                                                                { 3a00:3ebb }
if cb(c)^.target <> nil then found := true;                                            { 3a00:3ecd }
while not found and (last = 0) do begin                                                { 3a00:3eec }
  last := pass;                                                                        { 3a00:3ef5 }
  if (pass <> 0) and (fresh = 0) then cm_Map^[6] := 1;                                 { 3a00:3efb / 3f07 }
  tries := 20;                                                                         { 3a00:3f10 }
  n := CollectOppositeSideTargets(c, range);                                                            { 3a00:3f14 }
  while (tries <> 0) and not found and (n <> 0) do begin                               { 3a00:3f26 }
    tries := tries - 1;                                                                { 3a00:3f41 }
    r := Roll(1, n);                                                                   { 3a00:3f44 }
    if foe_List[r] <> 0 then begin                                                     { 3a00:3f53 }
      e := cb_Char[foe_List[r]];                                                       { 3a00:3f64 }
      if ((ignoreBlock <> 0) and (cm_Map^[6] <> 0)) or CanAttack(c, e) then begin      { 3a00:3f83 .. 3fa1 }
        found := true;  cb(c)^.target := e;                                            { 3a00:3fbd / 3fc3 }
      end else begin
        foe_List[r] := 0;                                                              { 3a00:3fd5 }
        for k := 1 to n do if foe_List[k] <> 0 then found := true;                     { 3a00:3fe4 .. }
        if found then found := false else n := 0;                                      { 3a00:3ffe .. }
      end;
    end;
  end;
  if pass = 0 then pass := 1;                                                          { 3a00:4011 }
end;
cm_Map^[6] := 0;                                                                       { 3a00:401e }
Result := found;                                                                       { 3a00:4027 }
```

### 3A00:403F EffEngulf (M)
`procedure EffEngulf(c [BP+0Ch]: PChar; eff [BP+8]: PEffect; event [BP+6]: Byte)` — RETF 0Ah; effect handler (registered by the MAGIC lane's handler table; called through CallEffectHandler). Callees: HasEffect, ShowCharacterMessage, CombatantIndex, AddEffect, CallEffectHandler, Roll. New in Curse (Pool twin by shape: ov12 EffSpitAcid 0.45). When both slot-1 swings of this round hit (`SlotHits[1] = 2`) and the target is up, has neither effect 3Ah nor 0Dh: "engulfs <name>", the target gets effect 3Ah (p3 = its own combatant index) with its handler run once, and effect 0Dh with p3 = 2d4; the engulfer gets effect 8Bh (p3 = the victim's index, callOnRemove) whose handler is EffEngulfHold.
```pascal
tgt := cb(c)^.target;                                                                  { 3a00:4046 }
if (SlotHits[1] = 2) and (tgt^.active <> 0) and                                        { 3a00:405a / 4064 }
   not HasEffect(tgt, $3A, e)                                                          { 3a00:4072 }
   and not HasEffect(tgt, $0D, e) then begin                                           { 3a00:408c }
  ShowCharacterMessage(c, 'engulfs ' + tgt^.name, $0C, 1);                                        { 3a00:40ba .. 40e0 }
  AddEffect(tgt, $3A, 0, CombatantIndex(tgt), 0);                                      { 3a00:40e5 / 4100  AddEffect }
  CallEffectHandler($3A, tgt, nil, 0);                                                         { 3a00:4105  CallEffectHandler }
  AddEffect(tgt, $0D, 0, Roll(2, 4), 0);                                               { 3a00:411c / 4137 }
  AddEffect(c, $8B, 0, CombatantIndex(tgt), 1);                                        { 3a00:413c / 4157 }
end;
```

### 3A00:4162 RayAnim (M) — nested procedure of EffEyeRays
`procedure RayAnim(n [BP+8]: Byte)` (+ static link [BP+6]) — RETF 4. Callees: BuildFourAnimationFrames, CombatantCol/Row, AnimateAlongPath. Builds the four frames of sprite `n + 0Dh` and flies them from the monster (parent's `c`) to its target (parent local) with 1 step and a 1Eh pause.
```pascal
BuildFourAnimationFrames(n + $0D);                                                                    { 3a00:4165 }
AnimateAlongPath(CombatantCol(c), CombatantRow(c), CombatantCol(tgt), CombatantRow(tgt), 1, $1E);   { 3a00:4173 .. 41c1 }
```

### 3A00:41CC AcquireRayTarget (M) — nested procedure of EffEyeRays
`procedure AcquireRayTarget(fresh [BP+8]: Byte)` (+ static link [BP+6]) — RETF 4. Callees: AutoTarget, CombatantCol/Row, TraceLine. Sets the parent's `blocked` flag, picks a target with `AutoTarget(c, FFh, 0, fresh)` and clears `blocked` when the line to it is free (`TraceLine` with the parent's `range`).
```pascal
blocked := 1;                                                                          { 3a00:41d2 }
if AutoTarget(c, $FF, 0, fresh) then begin                                             { 3a00:41da }
  tx := CombatantCol(cb(c)^.target);  ty := CombatantRow(cb(c)^.target);               { 3a00:41fa / 4216 }
  if TraceLine(CombatantCol(c), CombatantRow(c), tx, ty, range, cm_Map) then blocked := 0;   { 3a00:4232 .. 426f / 4278 }
end;
```

### 3A00:42FD EffEyeRays (M)
`procedure EffEyeRays(c [BP+0Ch]: PChar; eff [BP+8]: PEffect; event [BP+6]: Byte)` — RETF 0Ah; effect handler (new; the beholder's eye attacks, name M from the strings). Callees: AcquireRayTarget, TargetDistance, ShowCharacterMessage, RayAnim, SavingThrow, KillCombatant, RollDice, DamageCharacter, CastSpell. Up to 4 rays per call, each kind once (`used` bits): at distance < 3 a disintegrate ray (save vs. type 3 or removed as Gone, "is disintergrated"), < 4 a stone to flesh ray (save vs. 1 or Stoned), < 5 a death ray (save vs. 0 or killed), < 6 "wounds you" for 2d8+1; otherwise the spells 54h, 37h, 15h in turn (CastSpell, auto).
```pascal
used := 0;  tries := 4;                                                                { 3a00:4303 / 4307 }
cb(c)^.target := nil;                                                                  { 3a00:430f }
AcquireRayTarget(1);                                                                   { 3a00:4325 }
repeat
  tgt := cb(c)^.target;                                                                { 3a00:4329 }
  dist := TargetDistance(tgt, c);                                                           { 3a00:433d  TargetDistance }
  tries := tries - 1;                                                                  { 3a00:4353 }
  if tgt <> nil then                                                                   { 3a00:4356 }
    if (dist < 3) and ((used and 1) = 0) then begin                                    { 3a00:4361 / 4367 }
      used := used or 1;                                                               { 3a00:4370 }
      ShowCharacterMessage(c, 'fires a disintegrate ray', 10, 1);                                 { 3a00:4378 / 438d }
      RayAnim(5);                                                                      { 3a00:439c }
      if not SavingThrow(tgt, 3, 0) then KillCombatant(tgt, 8, 'is disintergrated');       { 3a00:43a0 / 43b5 / 43cd }
      AcquireRayTarget(0);                                                             { 3a00:43d6 }
    end else if (dist < 4) and ((used and 2) = 0) then begin                           { 3a00:43da .. }
      used := used or 2;                                                               { 3a00:43e3 }
      ShowCharacterMessage(c, 'fires a stone to flesh ray', 10, 1);                               { 3a00:43f4 / 4409 }
      RayAnim(10);                                                                     { 3a00:4418 }
      if not SavingThrow(tgt, 1, 0) then KillCombatant(tgt, 7, 'is Stoned');               { 3a00:441c / 4431 / 4449 }
      AcquireRayTarget(0);                                                             { 3a00:4452 }
    end else if (dist < 5) and ((used and 4) = 0) then begin                           { 3a00:4456 .. }
      used := used or 4;                                                               { 3a00:445f }
      ShowCharacterMessage(c, 'fires a death ray', 10, 1);                                        { 3a00:4470 / 4485 }
      RayAnim(5);                                                                      { 3a00:4494 }
      if not SavingThrow(tgt, 0, 0) then KillCombatant(tgt, 6, 'is killed');               { 3a00:4498 / 44ad / 44c5 }
      AcquireRayTarget(0);                                                             { 3a00:44ce }
    end else if (dist < 6) and ((used and 8) = 0) then begin                           { 3a00:44d2 .. }
      used := used or 8;                                                               { 3a00:44db }
      ShowCharacterMessage(c, 'wounds you', 10, 1);                                               { 3a00:44ec / 4501 }
      RayAnim(5);                                                                      { 3a00:4510 }
      DamageCharacter(tgt, RollDice(2, 8) + 1, 0, 0);                                       { 3a00:4514 / 4525  DamageCharacter }
      AcquireRayTarget(0);                                                             { 3a00:4538 }
    end else if (used and $10) = 0 then begin CastSpell($54, 1, 1, x); used := used or $10 end   { 3a00:453e / 4547 / 455a }
    else if (used and $20) = 0 then begin CastSpell($37, 1, 1, x); used := used or $20 end       { 3a00:4564 / 456d / 4580 }
    else if (used and $40) = 0 then begin CastSpell($15, 1, 1, x); used := used or $40 end;      { 3a00:458a / 4593 / 45a6 }
until (tries = 0) or (cb(c)^.target = nil);                                            { 3a00:45ae .. 45c0 }
```

### 3A00:45CF EffEngulfHold (M)
`procedure EffEngulfHold(c [BP+0Ch]: PChar; eff [BP+8]: PEffect; event [BP+6]: Byte)` — RETF 0Ah; handler of effect **8Bh** (Pool twin EffHold 4Ah, 0.81). Callees: Attack, ClearCombatantActionFlags, RemoveEffect. The engulfed victim is `cb_Char[eff^.p3]`; event 0 with both up: two 2d8 swings (slot 1, `behind = 1`) on the victim; when the victim drops, c loses 8Bh and the victim 3Ah / 0Dh. Any other event, or a party down: the victim loses 3Ah and 0Dh, and for event 0 c loses this 8Bh record (`eff^.p4 := 0` first).
```pascal
hold_Victim := cb_Char[eff^.p3];                                                       { 3a00:45d5  +3 }
if (event = 0) and (c^.active <> 0) and (hold_Victim^.active <> 0) then begin          { 3a00:45f1 .. 4606 }
  c^.attacks_left[1] := 2;  c^.attacks_left[2] := 0;  c^.dmg_dice[1] := 2;  c^.dmg_sides[1] := 8;   { 3a00:460e .. 463a }
  Attack(c, hold_Victim, 1, nil, d);                                                   { 3a00:4683 }
  d := ClearCombatantActionFlags(c);                                                                   { 3a00:46a3 }
  if hold_Victim^.active = 0 then begin                                                { 3a00:46b1 }
    RemoveEffect(c, $8B, nil);                                                            { 3a00:46bd }
    RemoveEffect(hold_Victim, $3A, nil);                                                  { 3a00:46d1 }
    RemoveEffect(hold_Victim, $0D, nil);                                                  { 3a00:46e7 }
  end;
end else begin
  RemoveEffect(hold_Victim, $3A, nil);                                                    { 3a00:460e }
  RemoveEffect(hold_Victim, $0D, nil);                                                    { 3a00:4624 }
  if event = 0 then begin eff^.p4 := 0; RemoveEffect(c, $8B, eff) end;                    { 3a00:4640 / 4643 / 4648 }
end;
```

### 3A00:4703 EffHugHold (M)
`procedure EffHugHold(c [BP+0Ch]: PChar; eff [BP+8]: PEffect; event [BP+6]: Byte)` — RETF 0Ah; handler of effect **90h** (Pool EffHold 0.89): as EffEngulfHold with one 2d8 swing per round and only effect 3Ah on the victim.
```pascal
hold_Victim := cb_Char[eff^.p3];                                                       { 3a00:4709 }
if (event = 0) and (c^.active <> 0) and (hold_Victim^.active <> 0) then begin          { 3a00:4725 .. 473a }
  c^.attacks_left[1] := 1;  c^.attacks_left[2] := 0;  c^.dmg_dice[1] := 2;  c^.dmg_sides[1] := 8;   { 3a00:4742 .. 476f }
  Attack(c, hold_Victim, 1, nil, d);                                                   { 3a00:47a1 }
  d := ClearCombatantActionFlags(c);                                                                   { 3a00:47c1 }
  if hold_Victim^.active = 0 then begin                                                { 3a00:47cf }
    RemoveEffect(c, $90, nil);                                                            { 3a00:47db }
    RemoveEffect(hold_Victim, $3A, nil);                                                  { 3a00:47ef }
  end;
end else begin
  RemoveEffect(hold_Victim, $3A, nil);                                                    { 3a00:4742 }
  if event = 0 then begin eff^.p4 := 0; RemoveEffect(c, $90, eff) end;                    { 3a00:475e / 4761 / 4766 }
end;
```

### 3A00:4811 EffHug (M)
`procedure EffHug(c [BP+0Ch]: PChar; eff [BP+8]: PEffect; event [BP+6]: Byte)` — RETF 0Ah; effect handler (new; Pool twin EffGrab 0.67): when the last attack roll exceeded 17, "hugs <target>": the target gets effect 3Ah (handler run once) and c gets 90h (p3 = target index, callOnRemove) — see EffHugHold.
```pascal
if AttackRollValue > $11 then begin                                                    { 3a00:4818 }
  hold_Victim := cb(c)^.target;                                                        { 3a00:4822 }
  ShowCharacterMessage(c, 'hugs ' + hold_Victim^.name, $0C, 1);                                   { 3a00:4837 .. 485e }
  AddEffect(hold_Victim, $3A, 0, CombatantIndex(hold_Victim), 0);                      { 3a00:4863 / 4882 }
  CallEffectHandler($3A, hold_Victim, nil, 0);                                                 { 3a00:4887 }
  AddEffect(c, $90, 0, CombatantIndex(hold_Victim), 1);                                { 3a00:48a0 / 48bd }
end;
```

### 3A00:48DC GodsIntervene (H)
`function GodsIntervene: Boolean` — RETF, entry e33 (ov08, ov09 '-'). Callees: ParamStr, @StrCompare, ShowTimedBottomMessage, CombatantIndex, ClearCombatantActionFlags, FocusSquare. Pool: 6100:3B93 (0.93). **changed:** the cheat is armed when the **second** command-line word equals `CopyProtWord` (Pool: `ParamStr(1) = 'STING'`).
```pascal
Result := false;                                                                       { 3a00:48e3 }
if ParamStr(2) = CopyProtWord then begin                                               { 3a00:48e7 / 48f6 }
  Result := true;                                                                      { 3a00:4905 }
  ShowTimedBottomMessage('The Gods intervene!');                                                    { 3a00:4909 / 4918 }
  p := PartyHead;                                                                      { 3a00:491d }
  while p <> nil do begin                                                              { 3a00:4929 }
    if p^.side = 1 then begin                                                          { 3a00:4931 }
      p^.active := 0;  p^.status := 6;                                                 { 3a00:493c / 4945 }
      cb_Size[CombatantIndex(p)] := 0;                                                 { 3a00:494e }
    end;
    ClearCombatantActionFlags(p);                                                                      { 3a00:4966 }
    p := p^.next;                                                                      { 3a00:4974 }
  end;
  FocusSquare(cm_Map^.viewX + 3, cm_Map^.viewY + 3, $FF, 8);                           { 3a00:4986 .. 49a6 }
end;
```

### 3A00:49B2 ov13_init (H)
Empty unit initialiser { 3a00:49b2 }.

---

## ov18 (seg 4E00) — the end sequence: Tyranthraxus' defeat, the PIC animations, the fireworks

Unit: ov18, analysis segment 4E00, 15F7h bytes, 11 functions (+ init); entry `EndSequence` 10FF (stub e1, called by ECL `PROGRAM 8`, ECL_VM.md §4.6). Pool twin: ov18 7A00 — only `PlayFinaleAnimation` survives (0.94); Pool's DragonFinale is replaced by `EndSequence` (0.31) and Pool's overland recolouring by a **fireworks particle show** drawn with BIOS pixel calls (4E00:0000..0B5E, no Pool twin).
Role: the victory text in the bottom window (rows 17..22), three PIC animations (records 4Ah, 4Bh, 4Dh), the portrait 41h, BIGPIC 7Ah and the fireworks until a key is pressed.
Strings (code segment 4E00:0B5B `PIC`; 0C6A..10F7 the story text, quoted in COMBAT_SCREENS.md COMBAT-18-01..04).
Globals: `Regs` DS:4FCA (Turbo Pascal `Registers`: AL 4FCA, AH 4FCB, BH 4FCD, CX 4FCE, DX 4FD0), `VideoMode` g_4FE6, `GameSpeed` g_4FA9, `view_Pic` g_4FE8, `view_Mode/view_PrevMode` g_4FBA/4FBB; fireworks state: `fw_Buf{g_4ACE}` (far ptr, 3 × 40 particle records of 17h bytes, 0AC8h bytes), `fw_MaxTime{g_4AD2}`, `fw_Ramp{g_4AD3}` (3 × 5 colour bytes, phase 1..5 of shell s at `DS:4ACD + 5s + phase`), `fw_Key{g_4AE2}`, `fw_Colours{g_4AE3}` (3 bytes), `fw_Shells{g_4AF3}`, `fw_X{g_4AE7}`, `fw_Y{g_4AE9}`, `fw_VX{g_4AEB}`, `fw_VY{g_4AED}`, `fw_VX0{g_4AEF}`, `fw_VY0{g_4AF1}` (words). Particle record (17h bytes, M from the arithmetic): `x +0`, `y +2` (words), `nx +4`, `ny +6`, `fx +8`, `fy +0Ah` (position × 32), `vx +0Ch`, `vy +0Eh`, `phase +10h` (1..5), `saved +11h` (pixel under the particle), `t[1..4] +12h..+15h` (phase end times; `t[1]` = 1).

### 4E00:0000 WritePixel (H)
`procedure WritePixel(x [BP+0Ah], y [BP+8]: Integer; colour [BP+6]: Byte)` — RETF 6. Callers: StepFireworks, RunFireworks, LaunchRocket. BIOS INT 10h function 0Ch (write graphics pixel, page 0).
```pascal
Regs.AH := $0C;  Regs.AL := colour;  Regs.BH := 0;  Regs.CX := x;  Regs.DX := y;         { 4e00:0003 .. 001c }
Intr($10, Regs);                                                                       { 4e00:001f }
```

### 4E00:0032 ReadPixel (H)
`function ReadPixel(x [BP+8], y [BP+6]: Integer): Byte` — RETF 4. Callers: InitFireworks, StepFireworks, LaunchRocket. BIOS INT 10h function 0Dh (read pixel) → `Regs.AL`.
```pascal
Regs.AH := $0D;  Regs.BH := 0;  Regs.CX := x;  Regs.DX := y;                            { 4e00:0038 .. 004b }
Intr($10, Regs);                                                                       { 4e00:004e }
Result := Regs.AL;                                                                     { 4e00:005b }
```

### 4E00:006A FlashPalette (H)
`procedure FlashPalette` — RETF. Callers: StepFireworks, LaunchRocket. Palette register 9 is set to white for one tick and back to 9 (EGA `VideoMode = 1` via SetEgaPaletteRegister, `VideoMode = 2` via SetEgaPaletteRegisterRaw; nothing on CGA).
```pascal
if VideoMode = 1 then begin                                                            { 4e00:006d }
  SetEgaPaletteRegister(9, 15);  Delay(1);                                             { 4e00:0074 / 007f }
  SetEgaPaletteRegister(9, 9);                                                         { 4e00:0088 }
end else if VideoMode = 2 then begin                                                   { 4e00:0088 }
  SetEgaPaletteRegisterRaw(9, 15);  Delay(1);                                          { 4e00:0099 / 00a4 }
  SetEgaPaletteRegisterRaw(9, 9);                                                      { 4e00:00ad }
end;
```

### 4E00:00BC InitFireworks (M)
`procedure InitFireworks(x0 [BP+10h], y0 [BP+0Eh], vx0 [BP+0Ch], vy0 [BP+0Ah]: Integer; colours [BP+6]: ^array[1..3] of Byte)` — RETF 0Ch. Caller: FireworksShow (with `fw_X`, `fw_Y`, `fw_VX`, `fw_VY` at the rocket's apex and `@fw_Colours`). Callees: @CopyBytes, FillChar, RandomWord, RandomReal, Cos, Sin, Trunc, ReadPixel.
Builds the colour ramps and 3 shells of 40 particles at (x, y): every shell gets a random overall velocity (`RandomReal`, `Cos`/`Sin`, `Random(10)`) added to the rocket's (vx, vy), every particle its own random direction and radius on top (the exact Real formulas at 4e00:021f..02f5 and 033a..0428 are not transcribed — M), and three phase times. `fw_MaxTime` = the longest shell time `Random(20) + 25`.
```pascal
c := colours^;                                                                         { 4e00:00c2  3 bytes }
fw_MaxTime := 0;                                                                       { 4e00:00d5 }
FillChar(fw_Ramp, 15, 1);                                                              { 4e00:00da }
for s := 1 to 3 do begin                                                               { 4e00:00eb }
  if VideoMode = 0 then begin                                                          { 4e00:00f4  CGA ramp }
    if c[s] > 1 then begin ramp[s] := (2, 3, 3, 3, 2) end;                             { 4e00:00fb .. }
  end else begin                                                                       { EGA/Tandy ramp }
    if c[s] > 1 then ramp[s][1] := 15;                                                 { 4e00:0160 .. }
    ramp[s][2] := 15;                                                                  { }
    if c[s] > 1 then ramp[s][3] := c[s] + 8;                                           { }
    ramp[s][4] := c[s];  ramp[s][5] := 1;                                              { }
  end;
  maxT := Random(20) + 25;                                                             { 4e00:01e8 }
  if fw_MaxTime < maxT then fw_MaxTime := maxT;                                        { 4e00:01f7 / 01ff }
  r := Random(5);                                                                      { 4e00:0205 }
  shellVX := Trunc(…);  shellVY := Trunc(…);                                           { 4e00:021f .. 02f5  RandomReal × Random(10) along a random angle (Cos / Sin) }
  for p := 1 to 40 do begin                                                            { 4e00:02fa }
    with fw_Buf^[s, p] do begin
      x := x0;  y := y0;  fx := x shl 5;  fy := y shl 5;                                { 4e00:0312 .. }
      vx := vx0 + shellVX + Trunc(…);  vy := vy0 + shellVY + Trunc(…);                  { 4e00:033a .. 0428  per-particle random angle / radius }
      phase := 1;  t[1] := 1;                                                          { }
      t[2] := r + Random(7) + 1;  t[3] := r + Random(11) + 14;  t[4] := maxT - Random(7);   { 4e00:0450 / 046c / 0488 }
      saved := ReadPixel(x, y);                                                        { 4e00:04af }
    end;
  end;
end;
```

### 4E00:04DF StepFireworks (M) — nested procedure of RunFireworks
`procedure StepFireworks(frame [BP+0Ch]: Byte; buf [BP+8]: Pointer)` (+ static link [BP+6]) — RETF 8. Callees: WritePixel, ReadPixel, FlashPalette. One frame: move every particle (gravity every 6th frame of the parent's counter, horizontal drag by 1 per frame), advance its phase when `t` passes `t[phase]`, erase, re-read the background, redraw with the shell's ramp colour; flash the palette when the first particle of shell 1 has just entered phase 2.
```pascal
for s := 1 to 3 do for p := 1 to 40 do with buf^[s, p] do begin                        { 4e00:04e5 .. }
  fx := fx + vx;  fy := fy + vy;  nx := fx div 32;  ny := fy div 32;                   { }
  if parentT mod 6 = 0 then vy := vy + 1;                                              { 4e00:054d .. }
  if vx > 0 then vx := vx - 1 else if vx < 0 then vx := vx + 1;                        { }
  if (t[phase] < frame) and (phase < 5) then phase := phase + 1;                       {  }
end;
for p := 1 to 40 do for s := 1 to 3 do with buf^[s, p] do                              { }
  if (y > 8) and (y < $41) then WritePixel(x, y, saved);                               { 4e00:062d }
for p := 1 to 40 do for s := 1 to 3 do with buf^[s, p] do begin                        { }
  x := nx;  y := ny;                                                                   { }
  if (y > 8) and (y < $41) then saved := ReadPixel(x, y);                              { 4e00:06ba }
end;
for p := 1 to 40 do for s := 1 to 3 do with buf^[s, p] do                              { }
  if (y > 8) and (y < $41) then WritePixel(x, y, fw_Ramp[s, phase]);                   { 4e00:072e  DS:4ACD + 5s + phase }
if buf^[1, 1].phase = 2 then FlashPalette;                                             { 4e00:076c / 0776 }
```

### 4E00:0780 RunFireworks (M)
`procedure RunFireworks(x0 [BP+10h], y0 [BP+0Eh], vx0 [BP+0Ch], vy0 [BP+0Ah]: Integer; colours [BP+6]: Pointer)` — RETF 0Ch (same list as InitFireworks; only `colours` is read, into a dead local). Caller: FireworksShow. Callees: StepFireworks, WritePixel. Plays `fw_MaxTime` frames, then erases every particle.
```pascal
c := colours^;                                                                         { 4e00:0786 }
for frame := 1 to fw_MaxTime do StepFireworks(frame, fw_Buf);                          { 4e00:0799 / 07be }
for p := 1 to 40 do for s := 1 to 3 do with fw_Buf^[s, p] do                           { 4e00:07c2 .. }
  if (y > 8) and (y < $41) then WritePixel(x, y, saved);                               { 4e00:0818 }
```

### 4E00:0843 LaunchRocket (M)
`procedure LaunchRocket(px [BP+16h], py [BP+12h], pvx [BP+0Eh], pvy [BP+0Ah]: ^Integer; steps [BP+8]: Integer; draw [BP+6]: Boolean)` — RETF 14h (the four are Turbo Pascal `var` parameters, written as pointers because every read goes through `LES DI,[BP+xx]`). Caller: FireworksShow (twice: once silently to find the apex, once drawing). Callees: FlashPalette, ReadPixel, WritePixel, RandomWord, Delay. Flies a point from (x, y) with velocity (vx, vy) and gravity (+1 per step) for `steps` steps, drawing a bright pixel (colour `Random(7) + 8`) over the saved background when `draw` and `8 < y < 41h`; afterwards one more unseen step.
```pascal
if draw then FlashPalette;                                                             { 4e00:0849 / 084f }
fx := px^ shl 5;  fy := py^ shl 5;                                                     { 4e00:0853 / 0861 }
if draw and (py^ > 8) and (py^ < $41) then saved := ReadPixel(px^, py^);               { 4e00:086f .. 0894 }
for i := 1 to steps do begin                                                           { 4e00:08a0 }
  fx := fx + pvx^;  fy := fy + pvy^ + 1;                                               { 4e00:08ab / 08b3 }
  nx := fx div 32;  ny := fy div 32;                                                   { 4e00:08bf / 08cc }
  pvy^ := pvy^ + 1;                                                                    { 4e00:08d8 }
  if draw and (py^ > 8) and (py^ < $41) then begin                                     { 4e00:08ea .. }
    WritePixel(px^, py^, saved);                                                       { 4e00:0902 }
    saved := ReadPixel(nx, ny);                                                        { 4e00:0916 }
    WritePixel(nx, ny, Random(7) + 8);                                                 { 4e00:0923 / 0932 }
  end;
  Delay(15);                                                                           { 4e00:093a }
  py^ := ny;  px^ := nx;                                                               { 4e00:0943 / 0949 }
end;
if draw and (py^ > 8) and (py^ < $41) then WritePixel(px^, py^, saved);                { 4e00:0978 }
px^ := (fx + pvx^) div 32;  py^ := (fy + pvy^ + 1) div 32;  pvy^ := pvy^ + 1;          { 4e00:0998 .. 09d2 }
```

### 4E00:09DB FireworksShow (M)
`procedure FireworksShow` — RETF. Caller: EndSequence. Callees: GetMem, RandomWord, FillChar, LaunchRocket, InitFireworks, RunFireworks, KeyPressed, ReadKey, FreeMem. Loops until a key is pressed; each pass has a 1 in 10000 chance to launch a rocket from (65, 65) with a random velocity, burst it (1 or 2 shells of a random colour 2..6) and play the fireworks.
```pascal
GetMem(fw_Buf, $0AC8);                                                                 { 4e00:09e1 }
fw_Key := #0;                                                                          { 4e00:09ef }
repeat
  if (fw_Key = #0) and (Random(10000) = 0) then begin                                  { 4e00:09f4 / 09fe }
    FillChar(fw_Colours, 3, 1);                                                        { 4e00:0a0f }
    fw_Shells := Random(2) + 1;                                                        { 4e00:0a20 }
    for i := 1 to fw_Shells do fw_Colours[i] := Random(5) + 2;                         { 4e00:0a5c .. 0a51 }
    fw_X := $41;  fw_Y := $41;                                                         { 4e00:0a64 / 0a6a }
    fw_VX := Random(20) + $23;  fw_VY := -(Random(5) + $32);                           { 4e00:0a70 / 0a7f }
    fw_VX0 := fw_VX;  fw_VY0 := fw_VY;                                                 { 4e00:0a9a / 0aa0 }
    LaunchRocket(@fw_X, @fw_Y, @fw_VX, @fw_VY, 60, false);                             { 4e00:0aa6  find the apex }
    InitFireworks(fw_X, fw_Y, fw_VX, fw_VY, @fw_Colours);                              { 4e00:0ac5 }
    fw_VX := fw_VX0;  fw_VY := fw_VY0;  fw_X := $41;  fw_Y := $41;                     { 4e00:0ade .. 0af0 }
    LaunchRocket(@fw_X, @fw_Y, @fw_VX, @fw_VY, 60, true);                              { 4e00:0af6 }
    RunFireworks(fw_X, fw_Y, fw_VX, fw_VY, @fw_Colours);                               { 4e00:0b15 }
    if KeyPressed then fw_Key := ReadKey;                                              { 4e00:0b2e / 0b37 }
  end;
until fw_Key <> #0;                                                                    { 4e00:0b3f }
FreeMem(fw_Buf, $0AC8);                                                                { 4e00:0b49 }
```
Note: the key is only polled after a rocket has been played; with `Random(10000)` per pass the wait between rockets is a busy loop.

### 4E00:0B5F PlayFinaleAnimation (M)
`procedure PlayFinaleAnimation(col [BP+0Ch], row [BP+0Ah]: Integer; animId [BP+8], cycles [BP+6]: Byte)` — RETF 8. Caller: EndSequence (3×). Callees: TimeInHundredths, FillChar, LoadAnimation, DrawPicture, FlushViewDirtyLines, DrawPictureScreenOrView, @LongMul, FreeAnimation. Pool: 7A00:0006 (0.94). **changed:** the animation comes from the `PIC` file (Pool `FINAL`) with LoadAnimation flags 2; the first frame is blitted into `view_Pic`.
```pascal
done := 0;                                                                             { 4e00:0b65 }
t0 := TimeInHundredths;                                                                { 4e00:0b69 }
FillChar(anim, $42, 0);                                                                { 4e00:0b74 }
LoadAnimation('PIC', animId, 2, anim);                                                 { 4e00:0b85 / 0b94 }
DrawPicture(col - 1, row - 1, 0, 0, anim.frame[1].pic, view_Pic);                      { 4e00:0ba5 }
FlushViewDirtyLines;                                                                   { 4e00:0bc8 }
repeat
  DrawPictureScreenOrView(col, row, true, anim.frame[anim.cur].pic);                   { 4e00:0bcd }
  t := TimeInHundredths;                                                               { 4e00:0bec }
  if t - t0 > LongInt(GameSpeed + 3) * anim.frame[anim.cur].delay then begin           { 4e00:0bf7 .. 0c14  signed 32-bit }
    anim.cur := anim.cur + 1;                                                          { 4e00:0c2c }
    if anim.cur > anim.count then begin anim.cur := 1; done := done + 1 end;           { 4e00:0c35 .. }
    t0 := t;                                                                           { 4e00:0c44 }
  end;
until done = cycles;                                                                   { 4e00:0c4f }
FreeAnimation(anim);                                                                   { 4e00:0c5a }
```

### 4E00:10FF EndSequence (H)
`procedure EndSequence` — RETF, entry e1 (ECL PROGRAM 8). Callees: DrawWrappedText, ShowBottomPromptAndReadKey, ClearMenuLine, PlayFinaleAnimation, LoadPortrait, DrawPortrait, LoadBigPic, DrawBigPic, FireworksShow, RedrawCurrentMode. Pool: 7A00:02A4 DragonFinale (0.31 — new story, new pictures). Every text goes to the bottom window with `DrawWrappedText(1, 17, 38, 22, 10, 0, clear, s)` (clear = 1 for the first line of a page, else 0); the continue prompt is `ShowBottomPromptAndReadKey(13, 0, 'Press any key to continue.')` followed by `ClearMenuLine`. The texts are listed in COMBAT_SCREENS.md (COMBAT-18-01..04).
```pascal
view_PrevMode := view_Mode;  view_Mode := 7;                                           { 4e00:1105 / 110b }
page 1: 'Tyranthraxus'' spirit coalesces over the slain ' … 'Still I can escape through the pool.'   { 4e00:1134 .. 11af  4 lines }
ShowBottomPromptAndReadKey(13, 0, 'Press any key to continue.');                       { 4e00:11c9 }
page 2: 'As you reach for the Pool of Radiance, he cries ' … 'it contracts and shatters it.'        { 4e00:11f2 .. 126d  4 lines }
PlayFinaleAnimation(3, 3, $4A, 1);                                                     { 4e00:1272 }
ShowBottomPromptAndReadKey(13, 0, 'Press any key to continue.');  ClearMenuLine;       { 4e00:1299 / 129e }
page 3: '''I am trapped without escape, you have succeeded ' … 'nothingness.'                       { 4e00:12c7 .. 1342  4 lines }
PlayFinaleAnimation(3, 3, $4B, 1);                                                     { 4e00:1347 }
ShowBottomPromptAndReadKey(13, 0, 'Press any key to continue.');  ClearMenuLine;       { 4e00:136e / 1373 }
page 4: 'You are certain he is destroyed because your ' … 'last!'                                  { 4e00:139c .. 1417  4 lines }
Mem[4CFF] := 1;                                                                        { 4e00:141c  red tint on (VIEW-08) }
PlayFinaleAnimation(3, 3, $4D, (10 - GameSpeed) * 2);                                  { 4e00:1427 / 1442 }
Mem[4CFF] := 0;                                                                        { 4e00:1445 }
LoadPortrait($41, $41);  DrawPortrait(3, 3, true);                                     { 4e00:1450 / 145b }
page 5: 'The Knights of Myth Drannor rush in, '' … 'this  foul place, to a fine feast.'''            { 4e00:148d .. 1508  4 lines }
ShowBottomPromptAndReadKey(13, 0, 'Press any key to continue.');  ClearMenuLine;       { 4e00:1522 / 1527 }
LoadBigPic($7A);  DrawBigPic;                                                          { 4e00:152c / 1534 }
page 6: 'You are teleported to Shadowdale, where festivities ' … 'from the nearby stands. ''You have won!'''   { 4e00:155d .. 15d8  4 lines }
FireworksShow;                                                                         { 4e00:15dd }
view_Mode := view_PrevMode;                                                            { 4e00:15e1 }
RedrawCurrentMode;                                                                             { 4e00:15e7  RedrawCurrentMode }
```

### 4E00:15F0 ov18_init (H)
Empty unit initialiser { 4e00:15f0 }.

---

## ov19 (seg 5000) — character sheet, View menu, items menu, trade/drop/sell/identify, coins, spell list, paladin Heal/Cure

Unit: ov19, analysis segment 5000, 396Ah bytes, 29 functions (+ init). Pool twin: ov19 7F00 (0.77..1.00 for the 22 shared routines); **new:** an item-record debug dump (10AB), the item ready/unready effects (1B00) and the paladin lay-on-hands / cure-disease commands (35F1, 3656, 36D8, 37EC). As in Pool this unit is mostly party/inventory UI; the Foreman may move it to PARTY (cab-areas.md) — written here as assigned.
Entries (stub ov19): e5 ViewMenu 0B75, e7 ReadyItem 1EE9, e8 UseItem 248D, e10 CycleSelectedChar 32DC, e12 SpellList 3474, e18 ov19_LoadDeps 0000 (+ the character-sheet pieces for character creation, ov16/ov17, and e9 ItemOverloads for the shop).
Strings (code segment): 0039 `(NPC)`, 003F `Age `, 0044..005D `STR `..`CHA `, 0062 `Level`, 0068 `/`, 006A `Exp `, 006F `Weapon`, 0076 `Armor`, 007C `Status`, 064E `AC    `, 0655 `HP    `, 065C `THAC0   `, 0665 `d`, 0667 `+`, 0669 `-`, 066B `Damage        `, 067A `Encumbrance      `, 068C `Movement   `, 09AA `0`, 09AC `00`, 09AF `(`, 09B1 `)`, 0B09 `View:`, 0B28 `Items `, 0B2F `Spells `, 0B37 `Trade `, 0B3E `Drop `, 0B44 `Heal `, 0B4A `Cure `, 0B50 `Exit`, 0E75 `Must be unreadied`, 0E87 ` was going to scribe from that scroll`, 0EAD `is it Okay to lose it? `, 0FBC..109F the debug labels (`itemptr:`, `namenum(1):`.. `namenum(3):`, `plus:`, `plussave:`, `ready:`, `identified:`, `cursed:`, `value:`, `special(1):`..`special(3):`, `dice large:`, `sides large:`, `press a key`), 14F4 `Items:` (list prompt), 1513 `Ready`, 1519 ` Use`, 151E ` Trade`, 1525 ` Drop`, 152B ` Halve`, 1532 ` Join`, 1538 ` Sell`, 153E ` Id`, 1542 `Items`, 1548 `Ready Item`, 1553 `Must be Readied`, 1563 `Your `, 1569 `will be gone forever`, 157E `Drop It? `, 1EAD `It's Cursed`, 1EB9 `Wrong Class`, 1EC5 `already using `, 1ED4 `Your hands are full!`, 2120 `Trade with Whom?`, 2131 `Overloaded`, 21E2 `Can't halve that`, 2474 `uses an item`, 2481 `Item:`, 2487 `oops!`, 2773 `I'll give you `, 2782 ` gold pieces for your `, 2799 `Is It a Deal? `, 27A8 `Sold!`, 27AE `Overloaded.  Money will be put in pool.`, 29B8 `For 200 gold pieces I'll identify your `, 29E0 `Is It a Deal? `, 29EF `Not Enough Money`, 2A00 `I can't tell anything new about your `, 2A26 `It looks like some sort of `, 2C13 `Trade to?`, 2C1F `Select type of coin `, 2C34 ` Select`, 2C3C `How much `, 2C46 `will you trade? `, 2F72 `Select type of coin `, 2F87 ` Select`, 2F8F `How much `, 2F99 `will you drop? `, 3421 `in Memory`, 342B `in Grimoire`, 3437 `on Scroll`, 3441 `on Scrolls`, 344C `to Choose`, 3456 `to Memorize`, 3462 `to Scribe`, 346C `Spells `, 36AF `Heal whom? `, 36BB ` feels better`, 36C9 ` is unaffected`, 37B8 `Cure whom? `, 37C4 `is not diseased`, 37D4 `cure anyway: `, 37E2 ` is cured`. Sets: CS:0B08 = CS:14F3 = {#0, 'E'}, CS:0B55 = {'I', 'S', 'T'}.
Item record names (the debug dump 5000:10AB prints SSI's own labels, so these are H): `namenum[1..3] +2Fh..+31h`, `plus +32h`, `plussave +33h`, `ready +34h`, `identified +35h` (non-zero = the real name is hidden; cleared by IdentifyItem — Pool called it `hidden`), `cursed +36h` (Pool `magic_flag`), `value +3Ah` (word), `special[1..3] +3Ch..+3Eh` (Pool `power[1..3]`: charges / spell / hook id), plus `itype +2Eh`, `weight +37h`, `count +39h`, `next +2Ah`.
Character fields: `race +74h`, `age +76h` (word), `gender +119h`, `alignment +11Bh`, `xp +127h`, `class_mask +12Bh`, `item_count +14Ch`, `readied[k] +151h + 4k` (0 weapon, 2 armour, 9/10 rings, 11 arrows +17Dh, 12 quarrels +181h), `hands_used +185h`, `encumbrance +187h` (word), `cures_left +191h` (paladin cure disease uses, M), `thac0 +199h` (stored as 60 − THAC0), `levels +109h..` (0 cleric, 3 paladin, 5 magic-user, 6 thief), `old_levels +111h..`, `spell_slots[1..5] +137h..+13Bh` (M, written by ItemReadyEffect kind 1).
Tables (DS): `GenderName{g_0F85}` (7 bytes per entry), `RaceName{g_0E9C}` (10), `AlignmentName{g_0EEC}` (17), `ClassName{g_0CB6}` (27), `StatusName{g_0FE0}` (13), `CoinName{g_0F93}` (11), `CoinValue{g_0CA2}` (5 LongInts: 1, 10, 100, 200, 1000 — copper units; `g_0CAE` = 200), `DiseaseEffects{g_0828}[1..6]` = 1Fh 22h 2Bh 2Ch 32h 39h, `SpellSlotTable{g_44A9}` (5 bytes per level, `[level*5 + k]`), spell table bytes `g_37DA` (+0 class? = 2 for magic-user spells, M) and `g_37DB` (+1 spell level), `g_37E5` (combat-usable).
Globals: `ViewChar` g_4AF4, `TradePartner{g_4AF8}` (Pool 471A), `ItemCast` g_7563, `ScrollItem{g_729C}` (Pool 6B80), `ItemsChanged{g_6F9E}` (Pool g_6821), `cure_InProgress{g_6F9C}` (Pool 681F), `g_7582` (set 1 before an item's effect handler, read by ov23 CallEffectHandler — M), `g_7747` (`gfx_LoopCounter` in GLOBALS.md; here just the loop variable of PaladinCureDisease), `text_Col/text_Row` g_65A0/65A1, `view_Mode` g_4FBA (1 = shop, 5 = combat), `view_LineDirty` (a DS address Ghidra shows as the segment operand of StrAssign — not a real use).
Other-unit callees: `DrawCharacterName` DrawCharacterName(c, col, row, withApos), `WordToStr` WordToStr, `ByteToStr` ByteToStr, `LongToStr` LongToStr, `BuildItemName` BuildItemName(owner, item, col, row, withReady, draw), `DrawAC` DrawAC(c, col, row), `DrawHP` DrawHP(c, col, row, flag), `StrWeightAllowance` StrWeightAllowance(c), `AppendItemCopy` AppendItemCopy(c, item), `SelectPartyCharacter` SelectPartyCharacter(prompt, flag, var who), `ov24_2E05` DrawCombatLayout, `ShowCharacterMessage` ShowCharacterMessage, `ClearCharacterMessage` ClearCharacterMessage, `ShowTimedBottomMessage` ShowTimedBottomMessage, `ClearCombatantActionFlags` ClearCombatantActionFlags, `RedrawCurrentMode` RedrawCurrentMode, `CurrentClassLevel(c)` / `DualClassActive(c)` (level helpers, ECL_VM.md §3.1), `FormerClass(c)` / `CurrentClass(c)` (current / former class id, M), `UpdateThiefSkills(c)` (recalculate, L), `IsScroll` IsScroll, `BuildSpellList` BuildSpellList(mode), `ChooseSpell` ChooseSpell(flag, var index), `CastSpell` CastSpell(spell, controlled, 0, var done), `UseScrollSpell` UseScrollSpell(c, item, spell), ov21: `WouldOverload` WouldOverload(c, amount, var room), `MoneyValueInGold` MoneyValueInGold(@money), `SetCharMoneyGold` SetCharMoneyGold(gold), `SetPoolMoneyGold` SetPoolMoneyGold(gold), `InputNumber` InputNumber(max, prompt, colour), `TransferCoins` TransferCoins(var from, var to, amount, coin), `DropCoinsToPool` DropCoinsToPool(c, amount, coin), `CoinFromText` CoinFromText(item, var coinName), ov23: `CallEffectHandler` CallEffectHandler, `RemoveEffect` RemoveEffect, `AddEffect` AddEffect, `RecalcAbility(c, n)` (apply item bonus kind n — ov23 section), `DamageCharacter` DamageCharacter, `HealCharacter` HealCharacter(c, hp, flag); resident `FUN_01A0_048D` (frame + bar at row 2), `FUN_01A0_0292` (upper frame redraw), `DrawScreenFrame`, VIEW `PaletteFlashOn/Off`.

### 5000:0000 ov19_LoadDeps (M)
Ten `CALLF` into entry 0 of ov26, ov29, ov22, ov23, ov21, ov20, ov28, ov24, ov34, ov25 { 5000:0003 .. 0030 }; entry e18.

### 5000:0083 DrawCharacterSheet (H)
`procedure DrawCharacterSheet` — RETF. Callers: ViewMenu, TradeCoins, LayOnHands, PaladinCureDisease; character creation (ov16/ov17 via the stub). Callees: DrawScreenFrame, DrawCharacterName, DrawText, WordToStr, DrawAbility, DrawMoney, CurrentClassLevel, ByteToStr, LongToStr, DrawCombatStats, BuildItemName. Pool: 7F00:004A (0.92). **changed:** a dual-class character's former levels are shown (`level + old_level` when the old class counts); no portrait.
```pascal
ViewChar := SelectedChar;                                                              { 5000:008a }
DrawScreenFrame;                                                                       { 5000:0097 }
DrawCharacterName(ViewChar, 1, 1, 0);                                                          { 5000:009c  DrawCharacterName }
if ViewChar^.npc_morale > $7F then DrawText(Length(ViewChar^.name) + 3, 1, 10, 0, '(NPC)');   { 5000:00b2 / 00e4 }
x := 1;                                                                                { 5000:00e9 }
s := GenderName[ViewChar^.gender];                                                     { 5000:00ed  g_0F85 + 7*gender }
DrawText(x, 3, 15, 0, s);  x := x + Length(s) + 1;                                     { 5000:0113 / 012b }
s := RaceName[ViewChar^.race];                                                         { 5000:013e  g_0E9C + 10*race }
DrawText(x, 3, 15, 0, s);  x := x + Length(s) + 1;                                     { 5000:0163 / 017b }
DrawText(x, 3, 15, 0, 'Age ' + WordToStr(ViewChar^.age));                              { 5000:018e .. 01c3 }
DrawText(1, 4, 15, 0, AlignmentName[ViewChar^.alignment]);                             { 5000:01c8 / 01ee  g_0EEC + 17*al }
DrawText(1, 5, 15, 0, ClassName[ViewChar^.class]);                                     { 5000:0205 / 022a  g_0CB6 + 27*class }
for i := 0 to 5 do begin                                                               { 5000:024a }
  case i of 0: s := 'STR '; 1: s := 'INT '; 2: s := 'WIS '; 3: s := 'DEX '; 4: s := 'CON '; 5: s := 'CHA ' end;   { 5000:0251 .. 02e3 }
  DrawText(1, i + 7, 10, 0, s);                                                        { 5000:02e8 }
  DrawAbility(i, 0);                                                                   { 5000:0304 }
end;
DrawMoney;                                                                             { 5000:0318 }
DrawText(1, 15, 15, 0, 'Level');                                                       { 5000:031c / 0338 }
any := false;  s := '';                                                                { 5000:033d / 0342 }
for i := 0 to 7 do                                                                     { 5000:0342 }
  if (ViewChar^.level[i] > 0) or ((ViewChar^.old_level[i] > 0) and (ViewChar^.old_level[i] < CurrentClassLevel(ViewChar))) then begin   { 5000:0350 .. 0399  +109h+i, +111h+i }
    if any then s := s + '/';                                                          { 5000:039c / 03a3 }
    s := s + ByteToStr(ViewChar^.level[i] + ViewChar^.old_level[i]);                   { 5000:03cd .. 041d }
    any := true;                                                                       { 5000:0422 }
  end;
DrawText(7, 15, 15, 0, s);                                                             { 5000:0430 }
DrawText(17, 15, 15, 0, 'Exp ' + LongToStr(ViewChar^.xp));                             { 5000:0447 .. 0481 }
DrawCombatStats;                                                                       { 5000:0486 }
row := 20;                                                                             { 5000:048a }
if ViewChar^.readied[0] <> nil then begin                                              { 5000:048e }
  DrawText(1, row, 15, 0, 'Weapon');                                                   { 5000:049e / 04bb }
  BuildItemName(ViewChar, ViewChar^.readied[0], 8, row, 0, 1);                             { 5000:04c0  BuildItemName }
end;
row := row + 1;                                                                        { 5000:04e8 }
if ViewChar^.readied[2] <> nil then begin                                              { 5000:04eb }
  DrawText(2, row, 15, 0, 'Armor');                                                    { 5000:04fb / 0518 }
  BuildItemName(ViewChar, ViewChar^.readied[2], 8, row, 0, 1);                             { 5000:051d }
end;
row := row + 1;                                                                        { 5000:0545 }
DrawText(1, row, 15, 0, 'Status');                                                     { 5000:0548 / 0565 }
DrawText(8, row, 10, 0, StatusName[ViewChar^.status]);                                 { 5000:056a  g_0FE0 + 13*status }
```

### 5000:0597 DrawMoney (H)
`procedure DrawMoney` — RETF. Callers: DrawCharacterSheet, ViewMenu ('D'), TradeCoins, DropCoins. Callees: ClearRectangle, DrawText, WordToStr. Pool: 7F00:050D (0.97), same body (`SelectedChar`, not ViewChar).
```pascal
ClearRectangle(12, 7, 26, 14);                                                         { 5000:059e }
row := 7;                                                                              { 5000:05af }
for i := 6 downto 0 do                                                                 { 5000:05b3 }
  if SelectedChar^.money[i] <> 0 then begin                                            { 5000:05bc }
    s := CoinName[i];                                                                  { 5000:05d0  g_0F93 + 11*i }
    DrawText(20 - Length(s), row, 10, 0, s);                                           { 5000:05ef }
    DrawText(21, row, 10, 0, WordToStr(SelectedChar^.money[i]));                       { 5000:0610 / 0639 }
    row := row + 1;                                                                    { 5000:063e }
  end;
```

### 5000:0698 DrawCombatStats (H)
`procedure DrawCombatStats` — RETF. Callers: DrawCharacterSheet; character creation. Callees: RecalcItems, DrawText, DrawAC, DrawHP, ByteToStr, WordToStr, HasEffect. Pool: 7F00:0608 (0.95), same layout.
```pascal
c := SelectedChar;                                                                     { 5000:069f }
RecalcItems(c);                                                                        { 5000:06ab }
row := 17;                                                                             { 5000:06b6 }
DrawText(1, row, 15, 0, 'AC    ');                                                     { 5000:06ba / 06d6 }
DrawAC(c, 4, row);                                                                  { 5000:06db  DrawAC }
DrawText(1, row + 1, 15, 0, 'HP    ');                                                 { 5000:06ed / 070c }
DrawHP(c, 4, row + 1, 0);                                                           { 5000:0711  DrawHP }
col := 8;                                                                              { 5000:0729 }
DrawText(col + 1, row, 15, 0, 'THAC0   ');                                             { 5000:072d / 074d }
DrawText(col + 7, row, 10, 0, ByteToStr(60 - c^.thac0));                               { 5000:0752 / 0782  +199h }
s := ByteToStr(c^.dmg_dice[1]) + 'd' + ByteToStr(c^.dmg_sides[1]);                     { 5000:0787 .. 07c7 }
if c^.dmg_bonus[1] > 0 then s := s + '+' + ByteToStr(c^.dmg_bonus[1]);                 { 5000:07cc .. 0813 }
if c^.dmg_bonus[1] < 0 then s := s + '-' + ByteToStr(Abs(c^.dmg_bonus[1]));            { 5000:0818 .. 0866 }
DrawText(col, row + 1, 15, 0, 'Damage        ');                                       { 5000:086b / 088b }
DrawText(col + 7, row + 1, 10, 0, s);                                                  { 5000:0890 }
col := 22;                                                                             { 5000:08b0 }
DrawText(col, row, 15, 0, 'Encumbrance      ');                                        { 5000:08b4 / 08d1 }
DrawText(col + 12, row, 10, 0, WordToStr(c^.encumbrance));                             { 5000:08d6 / 08fc  +187h }
mv := c^.move;                                                                         { 5000:0901 }
if HasEffect(c, $2A, e) then mv := Byte(mv * 2);                                       { 5000:090c / 0923 }
if HasEffect(c, $27, e) then mv := mv div 2;                                           { 5000:092d / 0944 }
DrawText(col + 3, row + 1, 15, 0, 'Movement   ');                                      { 5000:0952 / 0977 }
DrawText(col + 12, row + 1, 10, 0, ByteToStr(mv));                                     { 5000:097c / 09a1 }
```

### 5000:09B3 DrawAbility (H)
`procedure DrawAbility(stat [BP+8]: ShortInt; highlight [BP+6]: Boolean)` — RETF 4. Callers: DrawCharacterSheet; character creation. Callees: ClearRectangle, ByteToStr, DrawText. Pool: 7F00:0901 (0.98). **changed:** the abilities are two bytes apart (`+11h + 2*stat`); exceptional strength at `+1Ch`.
```pascal
if highlight then colour := 13 else colour := 10;                                      { 5000:09b6 .. 09c4 }
col := 5;                                                                              { 5000:09ca }
ClearRectangle(5, stat + 7, 11, stat + 7);                                             { 5000:09ce }
if SelectedChar^.abil[stat] < 10 then col := col + 1;                                  { 5000:09ea / 09fd  +11h + 2*stat }
DrawText(col, stat + 7, colour, 0, ByteToStr(SelectedChar^.abil[stat]));               { 5000:0a00 / 0a2f }
if (stat = 0) and (SelectedChar^.str = 18) and (SelectedChar^.str_exc <> 0) then begin { 5000:0a34 .. 0a59  +11h, +1Ch }
  s := ByteToStr(SelectedChar^.str_exc);                                               { 5000:0a59 / 0a6d }
  if SelectedChar^.str_exc < 10 then s := '0' + s;                                     { 5000:0a7b / 0a86 }
  if SelectedChar^.str_exc = 100 then s := '00';                                       { 5000:0aae / 0ab9 }
  DrawText(7, 7, colour, 0, '(' + s + ')');                                            { 5000:0acc .. 0afd }
end;
```

### 5000:0B75 ViewMenu (H)
`procedure ViewMenu(var turnUsed [BP+6]: Boolean)` — RETF 4, entry e5 (treasure, combat, temple, shop, explore, camp, top level). Callees: PaletteFlashOff/On, DrawCharacterSheet, HorizontalMenu, ItemsMenu, SpellList, TradeCoins, DropCoins, DrawMoney, CanLayHands, CanCureDisease, LayOnHands, PaladinCureDisease, RedrawCurrentMode. Pool: 7F00:0AB3 (0.88). **changed:** two paladin commands `Heal` and `Cure` (new menu words and routines); 84 memorised-spell slots are scanned.
```pascal
if view_Mode = 5 then PaletteFlashOff;                                                 { 5000:0b7c / 0b83 }
key := ' ';  turnUsed := false;                                                        { 5000:0b88 / 0b8c }
TradePartner := SelectedChar;                                                          { 5000:0b93 }
DrawCharacterSheet;                                                                    { 5000:0ba0 }
while not (key in [#0, 'E']) and not turnUsed do begin                                 { 5000:0ba4  set CS:0B08 }
  menu := '';  hasSpells := false;  hasMoney := false;                                 { 5000:0bc3 .. 0bcb }
  for i := 0 to 83 do if ViewChar^.mem_spell[i] <> 0 then hasSpells := true;           { 5000:0bd8 .. 0bf4  +1Eh+i }
  for i := 0 to 6 do if ViewChar^.money[i] <> 0 then hasMoney := true;                 { 5000:0bf4 .. 0c15 }
  if ViewChar^.items <> nil then menu := menu + 'Items ';                              { 5000:0c1b / 0c2b }
  if hasSpells then menu := menu + 'Spells ';                                          { 5000:0c53 / 0c59 }
  if ((ViewChar^.npc_morale < $80) or (ViewChar^.active = 0) or (ViewChar^.status = 1)) and hasMoney and (view_Mode <> 5) then   { 5000:0c81 .. 0cab }
    menu := menu + 'Trade ';                                                           { 5000:0cb2 }
  if hasMoney then menu := menu + 'Drop ';                                             { 5000:0cda / 0ce0 }
  if CanLayHands(SelectedChar) then menu := menu + 'Heal ';                            { 5000:0d08 / 0d18  new }
  if CanCureDisease(SelectedChar) then menu := menu + 'Cure ';                         { 5000:0d40 / 0d50  new }
  menu := menu + 'Exit';                                                               { 5000:0d78 }
  key := HorizontalMenu('', menu, 13, 10, 15, 0, 0, ext);                         { 5000:0da0 / 0dc8  prompt = cs:0B09 = #0 (empty); no 'View:' in the binary; }
  spellIdx := -1;                                                                      { 5000:0dcd }
  case key of                                                                          { 5000:0dd0 }
    'I': ItemsMenu(turnUsed);                                                          { 5000:0ddc }
    'S': SpellList(0, 0, spellIdx, hasSpells);                                         { 5000:0deb  result unused }
    'T': TradeCoins;                                                                   { 5000:0e08 }
    'D': begin DropCoins; DrawMoney end;                                               { 5000:0e12 / 0e16 }
    'H': LayOnHands(SelectedChar);                                                     { 5000:0e20  new }
    'C': PaladinCureDisease(SelectedChar);                                                    { 5000:0e32  new }
  end;
  if not turnUsed and (key in ['I', 'S', 'T']) then DrawCharacterSheet;                { 5000:0e3e / 0e47 / 0e57  set CS:0B55 }
end;
if view_Mode = 5 then PaletteFlashOn;                                                  { 5000:0e5e / 0e65 }
RedrawCurrentMode;                                                                             { 5000:0e6a  RedrawCurrentMode }
```

### 5000:0EC5 MayLoseItem (H)
`function MayLoseItem(item [BP+6]: PItem): Boolean` — RETF 4. Callers: ItemsMenu (Trade, Drop, Sell). Callees: ShowTimedBottomMessage, IsScroll, DrawCharacterName, DrawWrappedText, AskYesNo, ClearRectangle. Pool: 7F00:0D70 (0.98), same body.
```pascal
Result := false;                                                                       { 5000:0ecb }
if item^.ready <> 0 then ShowTimedBottomMessage('Must be unreadied')                                { 5000:0ecf / 0ed9 / 0ee8 }
else if not IsScroll(item) then Result := true                                        { 5000:0ef0 / 0f06 }
else if (item^.special[1] > $7F) or (item^.special[2] > $7F) or (item^.special[3] > $7F) then begin   { 5000:0f06 .. 0f1d }
  DrawCharacterName(SelectedChar, 1, 21, 0);                                                   { 5000:0f24  DrawCharacterName }
  text_Col := Length(SelectedChar^.name) + 2;  text_Row := 21;                         { 5000:0f3a / 0f49 }
  DrawWrappedText(1, 21, 38, 22, 14, 0, 0, ' was going to scribe from that scroll');   { 5000:0f4e / 0f72 }
  if AskYesNo('is it Okay to lose it? ', 13, 10, 15) = 'Y' then Result := true;        { 5000:0f77 / 0f8f / 0f98 }
end else Result := true;                                                               { 5000:0f9e }
ClearRectangle(1, 21, 38, 22);                                                         { 5000:0fa2 }
```

### 5000:10AB ItemDebugView (H)
`procedure ItemDebugView(item [BP+6]: PItem)` — RETF 4. Caller: ItemsMenu (key `V`, not in the menu text). Callees: DrawScreenFrame, DrawText, ByteToStr, WordToStr, ShowBottomPromptAndReadKey. New (no Pool twin): a developer dump of the item record — 15 labels in column 1 rows 1..15 (colour 10) and the values in column 20: `itype`, `namenum[1..3]`, `plus`, `plussave`, `ready`, `identified`, `cursed`, `value`, `special[1..3]`, `ITEMS[itype].dice_L` (g_5CF8), `ITEMS[itype].sides_L` (g_5CF9); then `ShowBottomPromptAndReadKey(10, 0, 'press a key')`.
```pascal
DrawScreenFrame;                                                                       { 5000:10b2 }
DrawText(1, 1, 10, 0, 'itemptr:      ');  … DrawText(1, 15, 10, 0, 'sides large:   ');  { 5000:10db .. 129b  15 labels }
DrawText(20, 1, 10, 0, ByteToStr(item^.itype));                                        { 5000:12a0 / 12bf }
DrawText(20, 2..4, 10, 0, ByteToStr(item^.namenum[k]));                                { 5000:12c4 .. 132b }
DrawText(20, 5, 10, 0, ByteToStr(item^.plus));  DrawText(20, 6, …, plussave);  DrawText(20, 7, …, ready);   { 5000:1330 .. 1397 }
DrawText(20, 8, …, identified);  DrawText(20, 9, …, cursed);                            { 5000:139c .. 13df }
DrawText(20, 10, 10, 0, WordToStr(item^.value));                                       { 5000:13e4 / 1402 }
DrawText(20, 11..13, 10, 0, ByteToStr(item^.special[k]));                              { 5000:1407 .. 146e }
DrawText(20, 14, 10, 0, ByteToStr(ITEMS[item^.itype].dice_L));                         { 5000:1473 / 149e }
DrawText(20, 15, 10, 0, ByteToStr(ITEMS[item^.itype].sides_L));                        { 5000:14a3 / 14ce }
ShowBottomPromptAndReadKey(10, 0, 'press a key');                                      { 5000:14d3 / 14e8 }
```

### 5000:1588 ItemsMenu (H)
`procedure ItemsMenu(var turnUsed [BP+6]: Boolean)` — RETF 4. Callers: ViewMenu ('I'), combat (ov08). Callees: BuildItemName, FUN_01A0_048D, DrawCharacterName, DrawText, VerticalListMenu, ItemDebugView, ReadyItem, ShowTimedBottomMessage, IsScroll, UseItem, MayLoseItem, TradeItem, DrawWrappedText, AskYesNo, LoseItem, ClearRectangle, HalveItem, JoinItems, SellItem, IdentifyItem, RecalcItems. Pool: 7F00:0EF8 (0.94). **changed:** a hidden `V` key opens ItemDebugView; the screen is rebuilt with the resident frame FUN_01A0_048D (no inner titled frame); an empty inventory exits at once.
```pascal
c := SelectedChar;  key := ' ';  sel := c^.items;  index := 0;  redraw := 1;  fullRedraw := 1;   { 5000:158f .. 15b1 }
while not (key in [#0, 'E']) and not turnUsed do begin                                 { 5000:15bc .. 15cf  set CS:14F3 }
  if c^.item_count = 0 then exit;                                                      { 5000:15db  +14Ch }
  oldCount := c^.item_count;                                                           { 5000:15e6 }
  if c^.items <> nil then begin                                                        { 5000:15e9 }
    menu := 'Ready';                                                                   { 5000:1606 }
    if (c^.active <> 0) and (Mem[4BE5] = 0) and ((view_Mode in [2, 3, 4]) or ((view_Mode = 5) and (cb^.mayUseItems <> 0))) then   { 5000:1619 .. 1659 }
      menu := menu + ' Use';                                                           { 5000:165b .. 167e }
    if ((c^.npc_morale < $80) or (c^.active = 0) or (c^.status = 1)) and (view_Mode <> 5) then   { 5000:1683 .. 16a4 }
      menu := menu + ' Trade';                                                         { 5000:16ab .. 16ce }
    menu := menu + ' Drop';                                                            { 5000:16d3 .. 16f6 }
    if c^.item_count < 16 then menu := menu + ' Halve';                                { 5000:16fb / 1706 .. 1729 }
    menu := menu + ' Join';                                                            { 5000:172e .. 1751 }
    if ((c^.npc_morale < $80) or (c^.active = 0) or (c^.status = 1)) and (view_Mode = 1) then   { 5000:1756 .. 1777 }
      menu := menu + ' Sell';                                                          { 5000:177e .. 17a1 }
    if view_Mode = 1 then menu := menu + ' Id';                                        { 5000:17a6 / 17ad .. 17d0 }
    p := c^.items;                                                                     { 5000:17d5 }
    while p <> nil do begin BuildItemName(c, p, 0, 0, 1, 0); p := p^.next end;             { 5000:17e5 / 17ed / 180a  names with the Yes/No prefix }
    if (fullRedraw <> 0) or (ItemsChanged <> 0) then begin                             { 5000:181b / 1821 }
      FUN_01A0_048D;                                                                   { 5000:1828 }
      DrawCharacterName(c, 1, 1, 1);                                                           { 5000:182d  "<name>'s" }
      DrawText(Length(c^.name) + 4, 1, 10, 0, 'Items');                                { 5000:1841 / 1865 }
      DrawText(1, 3, 15, 0, 'Ready Item');                                             { 5000:186a / 1885 }
      redraw := 1;  fullRedraw := 0;  ItemsChanged := 0;                               { 5000:188a / 188e / 1892 }
    end;
    key := VerticalListMenu('', menu, 13, 10, 15, 1, 5, 38, 22, c^.items, 1, redraw, index, sel);   { 5000:1897 / 18df  list prompt = cs:14F4 = #0 (empty); }
    if sel <> nil then                                                                 { 5000:18e7 }
      case key of                                                                      { 5000:18f2 }
        'V': begin ItemDebugView(sel); redraw := 1; fullRedraw := 1 end;               { 5000:18f9 / 1903 / 1907  new }
        'R': ReadyItem(sel);                                                           { 5000:1912 }
        'U': if sel^.ready = 0 then begin ShowTimedBottomMessage('Must be Readied'); key := ' ' end  { 5000:191f / 192d / 193c / 1941 }
             else if IsScroll(sel) or ((sel^.special[2] <> 0) and (sel^.special[3] < $80)) then begin   { 5000:1947 .. 1963 }
               UseItem(sel, turnUsed);                                                 { 5000:196a }
               if view_Mode <> 5 then turnUsed := false;                               { 5000:1979 / 1980 }
               if not turnUsed then fullRedraw := 1;                                   { 5000:1987 / 198a }
             end;
        'T': begin if MayLoseItem(sel) then TradeItem(sel) else key := ' '; fullRedraw := 1 end;   { 5000:199b / 19a9 / 19b5 / 19b9 }
        'D': if MayLoseItem(sel) then begin                                            { 5000:19c7 }
               BuildItemName(c, sel, 0, 0, 0, 0);                                          { 5000:19d8 }
               DrawWrappedText(1, 21, 38, 22, 14, 0, 1, 'Your ' + sel^.name + 'will be gone forever');   { 5000:19f5 .. 1a2e }
               if AskYesNo('Drop It? ', 13, 10, 15) = 'Y' then begin LoseItem(SelectedChar, sel); redraw := 1 end;   { 5000:1a33 / 1a42 / 1a54 / 1a67 }
               ClearRectangle(1, 21, 38, 22);                                          { 5000:1a6b }
             end else key := ' ';                                                      { 5000:1a7e }
        'H': HalveItem(sel);                                                           { 5000:1a88 }
        'J': JoinItems(sel);                                                           { 5000:1a98 }
        'S': if MayLoseItem(sel) then SellItem(sel) else key := ' ';                   { 5000:1aa8 / 1ab6 / 1ac2 }
        'I': IdentifyItem(sel, redraw);                                                { 5000:1acc }
      end;
    RecalcItems(c);                                                                    { 5000:1adb }
  end;
  if c^.item_count <> oldCount then redraw := 1;                                       { 5000:1ae6 / 1af3 }
end;
```

### 5000:1B00 ItemReadyEffect (M)
`procedure ItemReadyEffect(item [BP+8]: PItem; onReady [BP+6]: Boolean)` — RETF 6. Caller: ReadyItem (items whose `special[3] > 7Fh`: `(item, 1)` when readied, `(item, 0)` when unreadied). Callees: CallEffectHandler, DualClassActive, FillChar, RecalcAbility, UpdateThiefSkills, ov24_2E05, DamageCharacter, RemoveEffect. New (Pool called the effect handler directly). The hook kind `special[3] and 7Fh` selects: 0 = an effect handler (`CallEffectHandler(special[3], c, item, Ord(not onReady))` with `g_7582 := 1` first); 1 = magic-user spell slots: on unready the slots `+137h..+13Bh` are rebuilt from `SpellSlotTable` for the effective level and excess memorised spells are forgotten, on ready the slots of levels 1..3 are doubled; 2, 5, 6, 8, 0Ah, 0Ch, 0Dh = `RecalcAbility(c, n)` bonus kinds (plus `UpdateThiefSkills` for 2 and 0Bh); 4 = an alignment-bound item: a wrong alignment unreadies it and deals `special[2] div 16` damage; 9 = unready removes effect 17h.
```pascal
c := SelectedChar;                                                                     { 5000:1b06 }
kind := item^.special[3] and $7F;                                                      { 5000:1b12 }
case kind of                                                                           { 5000:1b1e }
  0: begin item_HookMode := 1; CallEffectHandler(item^.special[3], c, item, Ord(not onReady)) end;    { 5000:1b2d / 1b4d  CallEffectHandler }
  1: if not onReady then begin                                                         { 5000:1b56 / 1b5e }
       lv := c^.level[5] + c^.old_level[5] * DualClassActive(c);                             { 5000:1b92 .. 1bb6  +10Eh, +116h magic-user }
       for k := 1 to 5 do c^.spell_slots[k] := 0;  c^.spell_slots[1] := 1;             { 5000:1bbb .. 1bd3  +137h.. }
       if lv > 1 then for L := 2 to lv do for k := 1 to 5 do c^.spell_slots[k] := c^.spell_slots[k] + SpellSlotTable[L*5 + k];   { 5000:1bdf .. 1c2b  g_44A9 }
       cnt[0] := lv;  FillChar(cnt[1], 5, 0);                                          { 5000:1c31 / 1c39 }
       for d := 0 to 83 do                                                             { 5000:1c4a }
         if (c^.mem_spell[d] <> 0) and (spells_Table[c^.mem_spell[d]].b0 = 2) then begin   { 5000:1c53 .. 1c69  g_37DA }
           L := spells_Table[c^.mem_spell[d]].level;                                   { 5000:1c64  g_37DB }
           cnt[L] := cnt[L] + 1;                                                       { 5000:1c81 }
           if c^.spell_slots[L] < cnt[L] then c^.mem_spell[d] := 0;                    { 5000:1ca8 .. 1cc2  forget the excess }
         end;
     end else for k := 1 to 3 do c^.spell_slots[k] := c^.spell_slots[k] * 2;           { 5000:1b64 .. 1b8d }
  2: begin RecalcAbility(c, 3); UpdateThiefSkills(c) end;                                          { 5000:1ce4 / 1cf2 }
  4: if (item^.special[2] and $0F) <> c^.alignment then begin                          { 5000:1d05 .. 1d11  +3Dh, +11Bh }
       item^.ready := 0;                                                               { 5000:1d18 }
       dmg := item^.special[2] div 16;                                                 { 5000:1d20 }
       DamageType := 8;                                                                    { 5000:1d32 }
       if view_Mode = 5 then ov24_2E05;                                                { 5000:1d37 / 1d3e  DrawCombatLayout }
       DamageCharacter(c, dmg, 0, 0);                                                        { 5000:1d43  DamageCharacter }
       ItemsChanged := 1;                                                              { 5000:1d58 }
     end;
  5: RecalcAbility(c, 0);                                                                  { 5000:1d65 }
  6: begin RecalcAbility(c, 4);                                                            { 5000:1d7b }
            RecalcAbility(c, 5) end;                                                       { 5000:1d89 }
  8: if item^.special[2] in [0..5] then RecalcAbility(c, item^.special[2]);                { 5000:1da2 .. 1e22 }
  9: if not onReady then RemoveEffect(c, $17, nil);                                       { 5000:1e29 / 1e34 }
  $0A: RecalcAbility(c, 3);                                                                { 5000:1e4f }
  $0B: UpdateThiefSkills(c);                                                                   { 5000:1e64 }
  $0C: RecalcAbility(c, 1);                                                                { 5000:1e76 }
  $0D: begin RecalcAbility(c, 0);                                                          { 5000:1e8b }
              RecalcAbility(c, 1) end;                                                     { 5000:1e99 }
end;
```

### 5000:1EE9 ReadyItem (H)
`procedure ReadyItem(item [BP+6]: PItem)` — RETF 4, entry e7 (ItemsMenu 'R', ov09 AiReadyBestWeapon). Callees: ShowTimedBottomMessage, ItemReadyEffect, BuildItemName. Pool: 7F00:14D0 (0.89). **changed:** the hook goes through ItemReadyEffect; the "cursed" test reads `+36h`.
```pascal
hasHook := item^.special[3] > $7F;                                                     { 5000:1ef0 }
c := SelectedChar;                                                                     { 5000:1f03 }
if item^.ready <> 0 then begin                                                         { 5000:1f0f }
  if item^.cursed <> 0 then ShowTimedBottomMessage('It''s Cursed')                                  { 5000:1f19 .. 1f32 }
  else begin item^.ready := 0; if hasHook then ItemReadyEffect(item, 0) end;           { 5000:1f39 / 1f41 / 1f47 }
end else begin
  err := 0;                                                                            { 5000:1f57 }
  if c^.hands_used + ITEMS[item^.itype].hands > 2 then err := 3;                       { 5000:1f5b .. 1f83  +185h, g_5CF7 }
  slot := ITEMS[item^.itype].slot;                                                     { 5000:1f87 .. 1f9a  g_5CF6 }
  if slot < 9 then begin if c^.readied[slot] <> nil then err := 2 end                  { 5000:1f9d .. 1fc5 }
  else if (slot = 9) and (c^.readied[10] <> nil) then err := 2;                        { 5000:1fcb .. 1fdf  +179h }
  if (item^.itype = $49) and (c^.readied[11] <> nil) then begin err := 2; slot := 11 end;   { 5000:1fe3 .. 2000  +17Dh }
  if (item^.itype = $1C) and (c^.readied[12] <> nil) then begin err := 2; slot := 12 end;   { 5000:2004 .. 2021  +181h }
  if (ITEMS[item^.itype].usable_by and c^.class_mask) = 0 then err := 1;               { 5000:2025 .. 2044  g_5D03, +12Bh }
  case err of                                                                          { 5000:2048 }
    0: begin item^.ready := 1; if hasHook then ItemReadyEffect(item, 1) end;           { 5000:2052 / 205a / 2060 }
    1: ShowTimedBottomMessage('Wrong Class');                                                       { 5000:2070 .. 2084 }
    2: begin BuildItemName(c, c^.readied[slot], 0, 0, 0, 0); ShowTimedBottomMessage('already using ' + c^.readied[slot]^.name) end;   { 5000:2091 / 20bf .. 20e8 }
    3: if (view_Mode <> 5) or (c^.controlled = 0) then ShowTimedBottomMessage('Your hands are full!');   { 5000:20f4 / 2106 / 2115 }
  end;
end;
```

### 5000:213C TradeItem (H)
`procedure TradeItem(item [BP+6]: PItem)` — RETF 4. Caller: ItemsMenu ('T'). Callees: RedrawCurrentMode, SelectPartyCharacter, ItemOverloads, ShowTimedBottomMessage, AppendItemCopy, LoseItem, RecalcItems. Pool: 7F00:1734 (0.93), same body.
```pascal
whom := TradePartner;                                                                  { 5000:2142 }
RedrawCurrentMode;                                                                             { 5000:214e }
SelectPartyCharacter('Trade with Whom?', 1, whom);                                                { 5000:2153 / 2162  SelectPartyCharacter }
if whom <> nil then begin                                                              { 5000:216f }
  TradePartner := whom;                                                                { 5000:2177 }
  if ItemOverloads(whom, item) then ShowTimedBottomMessage('Overloaded')                            { 5000:2183 / 2197 / 21a6 }
  else begin AppendItemCopy(whom, item); LoseItem(SelectedChar, item); RecalcItems(whom) end;   { 5000:21ad / 21be / 21d1 }
end;
```

### 5000:21F3 HalveItem (H)
`procedure HalveItem(item [BP+6]: PItem)` — RETF 4. Caller: ItemsMenu ('H'). Pool: 7F00:17ED (0.87), same body.
```pascal
half := item^.count div 2;                                                             { 5000:21f9 }
if half = 0 then ShowTimedBottomMessage('Can''t halve that')                                        { 5000:220b / 2289 / 2298 }
else begin
  rest := item^.count - half;                                                          { 5000:2211 }
  GetMem(p, $3F);  Move(item^, p^, $3F);                                               { 5000:2226 / 2234 }
  p^.count := half;  p^.ready := 0;  p^.next := item^.next;                            { 5000:2247 / 2251 / 2259 }
  item^.count := rest;  item^.next := p;                                               { 5000:2269 / 2277 }
end;
```

### 5000:22A3 JoinItems (M)
`procedure JoinItems(item [BP+6]: PItem)` — RETF 4. Caller: ItemsMenu ('J'). Callee: LoseItem. Pool: 7F00:189D (0.92), same body including the self-comparison of `special[1..3]` (`p` compared with `p`, 5000:23b0 ..) so only `p^.special[1] < 2` restricts a join.
```pascal
target := item;  total := target^.count;                                               { 5000:22a9 / 22b1 }
p := SelectedChar^.items;                                                              { 5000:22be }
while p <> nil do begin                                                                { 5000:22cf }
  nxt := p^.next;                                                                      { 5000:22da }
  if (p <> target) and (p^.count <> 0) and (p^.namenum[1..3] = target^.namenum[1..3]) and (p^.itype = target^.itype) and   { 5000:22e9 .. }
     (p^.plus = target^.plus) and (p^.plussave = target^.plussave) and (p^.cursed = target^.cursed) and (p^.weight = target^.weight) and
     (p^.special[1] < 2) then                                                          { 5000:23d0  (the special[k] self-compares are always true) }
    if total + p^.count < 256 then begin total := total + p^.count; LoseItem(SelectedChar, p) end   { 5000:23e3 / 23fa / 2404 }
    else begin target^.count := 255; p^.count := p^.count - (255 - total); total := p^.count; target := p end;   { 5000:2421 .. 2456 }
  p := nxt;
end;
target^.count := total;                                                                { 5000:2464 }
```

### 5000:248D UseItem (H)
`procedure UseItem(item [BP+0Ah]: PItem; var done [BP+6]: Boolean)` — RETF 8, entry e8 (ItemsMenu 'U', ov09 AiTryUseMagicItem). Callees: IsScroll, SpellList, ov24_2E05, ShowCharacterMessage, DrawText, BuildItemName, MessageDelay, ClearCharacterMessage, CastSpell, FormerClass, CurrentClass, Roll, ClearCombatantActionFlags, UseScrollSpell, LoseItem. Pool: 7F00:1A8A (0.79). **changed:** the item spell is `special[2] and 7Fh` (no `−17h` mapping); scrolls: a character who is neither a magic-user nor a cleric (current or former class, no such levels) can only read a scroll as a thief of level 10+ with a 75 % chance ("oops!" otherwise).
```pascal
spellIdx := -1;  ItemCast := 0;  spell := 0;                                           { 5000:2493 .. 249d }
if IsScroll(item) then begin                                                          { 5000:24a1  IsScroll }
  ScrollItem := item;                                                                  { 5000:24b0 }
  spell := SpellList(2, 1, spellIdx, n);                                               { 5000:24bc }
end else if (item^.special[2] <> 0) and (item^.special[3] < $80) then begin            { 5000:24d5 .. 24e2 }
  ItemCast := 1;  spell := item^.special[2] and $7F;                                   { 5000:24e9 / 24ee }
end;
if spell = 0 then begin done := false; exit end;                                       { 5000:24fa / 2500 }
if (view_Mode = 5) and (SelectedChar^.controlled = 0) then ov24_2E05;                  { 5000:250a / 2511 / 251d }
if ItemCast <> 0 then begin                                                            { 5000:2522 }
  ShowCharacterMessage(SelectedChar, 'uses an item', 10, 0);                                      { 5000:252c / 2543 }
  if view_Mode = 5 then begin                                                          { 5000:254e }
    DrawText(0, 23, 10, 0, 'Item:');                                                   { 5000:2555 / 2570 }
    BuildItemName(SelectedChar, item, 5, 23, 0, 1);                                        { 5000:2575 }
  end else BuildItemName(SelectedChar, item, 1, 22, 0, 1);                                 { 5000:2596 }
  MessageDelay;  ClearCharacterMessage;                                                            { 5000:25b5 / 25ba }
end;
ItemCast := 1;                                                                         { 5000:25bf }
if not IsScroll(item) then CastSpell(spell, SelectedChar^.controlled, 0, done)        { 5000:25c4 / 2632  CastSpell }
else if (FormerClass(SelectedChar) <> 5) and (CurrentClass(SelectedChar) <> 5) and (FormerClass(SelectedChar) <> 0) and (CurrentClass(SelectedChar) <> 0) and   { 5000:25d6 .. 2611 }
        (SelectedChar^.level[5] < 1) and (SelectedChar^.level[0] < 1) then begin       { 5000:261a / 2626 }
  if (SelectedChar^.level[6] > 9) and (Roll(1, 100) < 76) then                         { 5000:264f / 265b / 2666  thief }
    CastSpell(spell, SelectedChar^.controlled, 0, done)                                { 5000:266a }
  else ShowCharacterMessage(SelectedChar, 'oops!', text_Row + 1, 1);                              { 5000:2687 / 269e }
end else CastSpell(spell, SelectedChar^.controlled, 0, done);                          { 5000:26af }
ItemCast := 0;                                                                         { 5000:26ca }
if (view_Mode = 5) and (spells_Table[spell].combat <> 0) then done := ClearCombatantActionFlags(SelectedChar);   { 5000:26cf / 26d6 / 26e8 }
if done then                                                                           { 5000:26fb }
  if IsScroll(item) then UseScrollSpell(SelectedChar, item, spell)                         { 5000:2704 / 2713  UseScrollSpell }
  else if item^.special[1] <> 0 then                                                   { 5000:272c }
    if item^.count < 2 then begin                                                      { 5000:2736 }
      item^.special[1] := item^.special[1] - 1;                                        { 5000:2740 }
      if item^.special[1] = 0 then LoseItem(SelectedChar, item);                       { 5000:2749 / 275a }
    end else item^.count := item^.count - 1;                                           { 5000:2750 }
```

### 5000:27D6 SellItem (H)
`procedure SellItem(item [BP+6]: PItem)` — RETF 4. Caller: ItemsMenu ('S', shop). Callees: BuildItemName, WordToStr, DrawWrappedText, AskYesNo, ShowTimedBottomMessage, LoseItem, WouldOverload, ClearRectangle. Pool: 7F00:1CEE (0.98), same body (the stack price is always `count × half div 20`: the test `(itype = 49h) and (itype = 1Ch)` can never hold).
```pascal
price := 0;                                                                            { 5000:27d9 }
if item^.value <> 0 then price := item^.value div 2;                                   { 5000:27e2 / 27ec }
if item^.count > 1 then                                                                { 5000:27fd }
  if (item^.itype = $49) and (item^.itype = $1C) then price := item^.count * price     { 5000:27fd .. 2814  unreachable }
  else price := Word(item^.count * price) div 20;                                      { 5000:281b }
BuildItemName(ViewChar, item, 0, 0, 0, 0);                                                 { 5000:2842 }
DrawWrappedText(1, 21, 38, 22, 14, 0, 1, 'I''ll give you ' + WordToStr(price) + ' gold pieces for your ' + item^.name);   { 5000:2861 .. 28ad }
if AskYesNo('Is It a Deal? ', 13, 10, 15) = 'Y' then begin                             { 5000:28b2 / 28c1 / 28d3 }
  ShowTimedBottomMessage('Sold!');                                                                  { 5000:28d6 / 28e5 }
  LoseItem(SelectedChar, item);                                                        { 5000:28ea }
  plat := price div 5;  gold := price mod 5;                                           { 5000:28fd / 290a }
  if WouldOverload(SelectedChar, gold + plat, room) then begin                             { 5000:2918  WouldOverload }
    ShowTimedBottomMessage('Overloaded.  Money will be put in pool.');                       { 5000:2935 / 2944 }
    if plat < room then SelectedChar^.money[4] := SelectedChar^.money[4] + plat        { 5000:2949 / 2951 }
    else begin SelectedChar^.money[4] := SelectedChar^.money[4] + room; TreasureMoney[4] := TreasureMoney[4] + (plat - room) end;   { 5000:295f / 296b }
    SelectedChar^.money[3] := SelectedChar^.money[3] + gold;                           { 5000:297b }
  end else begin
    SelectedChar^.money[4] := SelectedChar^.money[4] + plat;  SelectedChar^.money[3] := SelectedChar^.money[3] + gold;   { 5000:2989 / 2995 }
  end;
end;
ClearRectangle(1, 21, 38, 22);                                                         { 5000:29a1 }
```

### 5000:2A42 IdentifyItem (H)
`procedure IdentifyItem(item [BP+0Ah]: PItem; var redraw [BP+6]: Boolean)` — RETF 8. Caller: ItemsMenu ('I', shop). Callees: BuildItemName, DrawWrappedText, AskYesNo, MoneyInGold, SetCharMoneyGold, MoneyValueInGold, SetPoolMoneyGold, ShowTimedBottomMessage, MessageDelay, ClearRectangle. Pool: 7F00:1F52 (0.98), same body.
```pascal
paid := false;                                                                         { 5000:2a45 }
BuildItemName(ViewChar, item, 0, 0, 0, 0);                                                 { 5000:2a4d }
DrawWrappedText(1, 21, 38, 22, 14, 0, 1, 'For 200 gold pieces I''ll identify your ' + item^.name);   { 5000:2a6c .. 2a9b }
if AskYesNo('Is It a Deal? ', 13, 10, 15) = 'Y' then begin                             { 5000:2aa0 / 2ab8 / 2abd }
  m := MoneyInGold(SelectedChar);                                                      { 5000:2ac4 }
  if m >= 200 then begin paid := true; SetCharMoneyGold(Word(m - 200)) end                    { 5000:2ad6 .. 2af5  SetCharMoneyGold }
  else begin
    m := MoneyValueInGold(@TreasureMoney);                                                    { 5000:2afc  MoneyValueInGold }
    if m >= 200 then begin paid := true; SetPoolMoneyGold(Word(m - 200)) end                  { 5000:2b0c .. 2b2b  SetPoolMoneyGold }
    else ShowTimedBottomMessage('Not Enough Money');                                                { 5000:2b32 / 2b41 }
  end;
end;
if paid then                                                                           { 5000:2b46 }
  if item^.identified = 0 then DrawWrappedText(1, 21, 38, 22, 14, 0, 1, 'I can''t tell anything new about your ' + item^.name)   { 5000:2b4f / 2b59 .. 2b88 }
  else begin
    item^.identified := 0;                                                             { 5000:2b8f }
    BuildItemName(ViewChar, item, 0, 0, 0, 0);                                             { 5000:2b97 }
    DrawWrappedText(1, 21, 38, 22, 14, 0, 1, 'It looks like some sort of ' + item^.name);   { 5000:2bb6 .. 2be5 }
    redraw := true;                                                                    { 5000:2bea }
  end;
if paid then MessageDelay;                                                             { 5000:2bf1 / 2bf7 }
ClearRectangle(1, 21, 38, 22);                                                         { 5000:2bfc }
```

### 5000:2C57 TradeCoins (H)
`procedure TradeCoins` — RETF. Caller: ViewMenu ('T'). Callees: RedrawCurrentMode, SelectPartyCharacter, DrawCharacterSheet, DrawMoney, GetMem, @StrLong, VerticalListMenu, CoinFromText, InputNumber, TransferCoins, FreeMenuList. Pool: 7F00:2156 (0.94), same structure. **changed:** the coin list menu offers ` Select` (Pool: no options).
```pascal
repeat                                                                                 { outer loop }
  whom := TradePartner;                                                                { 5000:2c5e }
  RedrawCurrentMode;                                                                           { 5000:2c6a }
  SelectPartyCharacter('Trade to?', 1, whom);                                                     { 5000:2c6f / 2c7f }
  if whom = nil then noMoney := true                                                   { 5000:2c8c / 2c94 }
  else begin
    DrawCharacterSheet;                                                                { 5000:2c9c }
    repeat                                                                             { inner loop }
      DrawMoney;                                                                       { 5000:2ca0 }
      TradePartner := whom;                                                            { 5000:2ca4 }
      head := nil;  prev := nil;  list := nil;  kinds := 0;                            { 5000:2cb0 .. 2cca }
      for i := 0 to 6 do                                                               { 5000:2ccd }
        if SelectedChar^.money[i] <> 0 then begin                                      { 5000:2cd6 }
          kinds := kinds + 1;                                                          { 5000:2cf0 }
          if head = nil then begin GetMem(head, $2E); head^.next := nil end            { 5000:2cf6 / 2d01 / 2d0f }
          else begin prev := head; GetMem(head, $2E); head^.next := prev end;          { 5000:2d1d / 2d29 / 2d2e }
          Str(LongInt(SelectedChar^.money[i]):0, num);                                 { 5000:2d3e  string[15] }
          pad := 8 - Length(CoinName[i]);  blanks := Chr(pad) + pad × ' ';             { 5000:2d64 .. 2d9b }
          head^.text := blanks + CoinName[i] + ' ' + num;                              { 5000:2db4 .. 2df7 }
          head^.flag29 := 0;                                                           { 5000:2e04 }
        end;
      list := head;  index := 0;  redraw := 1;                                         { 5000:2e0d .. 2e1d }
      key := VerticalListMenu('Select type of coin ', ' Select', 13, 10, 15, 12, 7, 25, 13, list, 1, redraw, index, sel);   { 5000:2e22 / 2e3d / 2e42 }
      if sel = nil then done := true                                                   { 5000:2e79 / 2e7c }
      else begin
        coinName := '';                                                                { 5000:2e81 }
        coin := CoinFromText(sel, coinName);                                              { 5000:2e8e  CoinFromText }
        coinName := 'How much ' + coinName + 'will you trade? ';                       { 5000:2ea1 .. 2ed0 }
        amount := InputNumber(SelectedChar^.money[coin], coinName, 10);                  { 5000:2ed5  InputNumber }
        TransferCoins(SelectedChar, whom, amount, coin);                                   { 5000:2ef8  TransferCoins }
        done := true;  noMoney := true;                                                { 5000:2f0f / 2f14 }
        for i := 0 to 6 do if SelectedChar^.money[i] <> 0 then begin noMoney := false; done := false end;   { 5000:2f22 .. 2f44 }
      end;
      if list <> nil then FreeMenuList(list);                                          { 5000:2f46 / 2f4e }
    until done;                                                                        { 5000:2f58 }
  end;
until noMoney;                                                                         { 5000:2f62 }
```

### 5000:2FA9 DropCoins (H)
`procedure DropCoins` — RETF. Caller: ViewMenu ('D'). Callees: DrawMoney, GetMem, @StrLong, VerticalListMenu, CoinFromText, InputNumber, DropCoinsToPool, FreeMenuList. Pool: 7F00:24A7 (0.96), same body as TradeCoins' inner loop with `DropCoinsToPool(SelectedChar, amount, coin)` { 5000:3209 } and the prompt `'How much ' + coinName + 'will you drop? '` { 5000:31ad .. 31d1 }; list menu at { 5000:3172 } (` Select`), FreeMenuList { 5000:3246 }, loop while money remains { 5000:3221 .. 3252 }.

### 5000:3258 ItemOverloads (H)
`function ItemOverloads(c [BP+0Ah]: PChar; item [BP+6]: PItem): Boolean` — RETF 8, entry e9 (shop Buy). Callees: RecalcItems, StrWeightAllowance. Pool: 7F00:275B (1.00).
```pascal
RecalcItems(c);                                                                        { 5000:325e }
over := c^.item_count > 15;                                                            { 5000:3269 }
w := item^.weight;                                                                     { 5000:327c }
if item^.count <> 0 then w := Word(item^.count * w);                                   { 5000:3286 / 3290 }
if LongInt(Word(c^.encumbrance + w)) > LongInt(StrWeightAllowance(c) + 1500) then over := true; { 5000:329f .. 32cd  StrWeightAllowance }
Result := over;                                                                        { 5000:32cd }
```

### 5000:32DC CycleSelectedChar (M)
`procedure CycleSelectedChar(key [BP+6]: Char)` — RETF 2, entry e10 (every menu's extended keys). Pool: 7F00:27DF (0.77), same logic.
```pascal
p := PartyHead;                                                                        { 5000:32e2 }
if p <> nil then                                                                       { 5000:32ee }
  if key = 'G' then begin                                                              { 5000:32f9 }
    if p = SelectedChar then while p^.next <> nil do p := p^.next                      { 5000:3300 .. 332d  wrap to the last }
    else while (p <> nil) and (p^.next <> SelectedChar) do p := p^.next;               { 5000:3332 .. 335f  predecessor }
  end else if (key = 'O') and (SelectedChar^.next <> nil) then p := SelectedChar^.next; { 5000:3366 .. 337e }
SelectedChar := p;                                                                     { 5000:3399 }
```

### 5000:33AB MoneyInGold (H)
`function MoneyInGold(c [BP+6]: PChar): LongInt` — RETF 4. Callers: IdentifyItem; temple/shop/training. Pool: 7F00:28BE (0.86), same formula.
```pascal
total := 0;                                                                            { 5000:33b1 }
for i := 0 to 4 do total := total + LongInt(c^.money[i]) * CoinValue[i];               { 5000:33b9 .. 33f9  g_0CA2 }
Result := (total + 100) div CoinValue[3];                                              { 5000:33f9 .. 340a  g_0CAE = 200 }
```

### 5000:3474 SpellList (H)
`function SpellList(mode [BP+10h], flag [BP+0Eh]: Byte; var index [BP+0Ah]: Integer; var count [BP+6]: Byte): Byte` — RETF 0Ch, entry e12 (ViewMenu 'S', UseItem, BeginCast, camp memorise/scribe). Callees: BuildSpellList, DrawScreenFrame, FUN_01A0_0292, FUN_01A0_048D, DrawCharacterName, DrawText, ChooseSpell. Pool: 7F00:299C (0.86). **changed:** header texts (`in Grimoire`, `to Choose`, `to Memorize`, `to Scribe`); the header is also redrawn when `flag = 1`, with a frame chosen by the mode (`view_Mode = 5` → DrawScreenFrame, `flag = 2` → FUN_01A0_0292, else FUN_01A0_048D).
```pascal
case mode of 0: s := 'in Memory'; 1: s := 'in Grimoire'; 2: s := 'on Scroll'; 3: s := 'on Scrolls'; 4: s := 'to Choose'; 5: s := 'to Memorize'; 6: s := 'to Scribe'; else s := '' end;   { 5000:347b .. 3536 }
count := BuildSpellList(mode);                                                              { 5000:353c  BuildSpellList }
if count = 0 then Result := 0                                                          { 5000:354b / 354e }
else begin
  if (index < 0) or (flag = 1) then                                                    { 5000:3557 / 3560 }
    if view_Mode = 5 then DrawScreenFrame else if flag = 2 then FUN_01A0_0292 else FUN_01A0_048D;   { 5000:3566 .. 3581 }
  DrawCharacterName(SelectedChar, 1, 1, 1);                                                    { 5000:3586  "<name>'s" }
  DrawText(Length(SelectedChar^.name) + 4, 1, 10, 0, 'Spells ' + s);                   { 5000:359c .. 35cc }
  Result := ChooseSpell(flag, index);                                                    { 5000:35d1  ChooseSpell }
end;
```

### 5000:35F1 CanLayHands (M)
`function CanLayHands(c [BP+6]: PChar): Boolean` — RETF 4. Caller: ViewMenu. Callees: DualClassActive, HasEffect. New: a paladin (class 3, or a former paladin whose old level counts) out of combat, Okay, who has not used lay-on-hands today (effect 8Ch).
```pascal
Result := ((c^.class = 3) or ((c^.old_level[3] > 0) and (DualClassActive(c) <> 0))) and      { 5000:35f7 .. 3612  +75h, +114h }
          (view_Mode <> 5) and (c^.status = 0) and not HasEffect(c, $8C, e);           { 5000:361b / 3622 / 362d }
```

### 5000:3656 CanCureDisease (M)
`function CanCureDisease(c [BP+6]: PChar): Boolean` — RETF 4. Caller: ViewMenu. Callee: DualClassActive. New: as CanLayHands but requires `c^.cures_left <> 0` (+191h) instead of the effect test.
```pascal
Result := ((c^.class = 3) or ((c^.old_level[3] > 0) and (DualClassActive(c) <> 0))) and (view_Mode <> 5) and (c^.status = 0) and (c^.cures_left <> 0);   { 5000:365c .. 369f }
```

### 5000:36D8 LayOnHands (M)
`procedure LayOnHands(c [BP+6]: PChar)` — RETF 4. Caller: ViewMenu ('H'). Callees: RedrawCurrentMode, SelectPartyCharacter, DrawCharacterSheet, DualClassActive, HealCharacter, ShowTimedBottomMessage, AddEffect. New: heals the chosen member by twice the paladin level (current + former) and marks the paladin with effect 8Ch for 1440 minutes (one day).
```pascal
RedrawCurrentMode;                                                                             { 5000:36df }
whom := PartyHead;                                                                     { 5000:36e4 }
SelectPartyCharacter('Heal whom? ', 1, whom);                                                     { 5000:36f0 / 36ff  SelectPartyCharacter }
if whom = nil then DrawCharacterSheet                                                  { 5000:370c / 3714 }
else begin
  lv := c^.level[3] + c^.old_level[3] * DualClassActive(c);                                  { 5000:371b .. 3745  +10Ch, +114h }
  if HealCharacter(whom, lv * 2, 0) then ShowTimedBottomMessage(whom^.name + ' feels better')           { 5000:372c / 3777 .. 3791  HealCharacter }
  else ShowTimedBottomMessage(whom^.name + ' is unaffected');                                       { 5000:3756 .. 3770 }
  AddEffect(c, $8C, $5A0, 0, 0);                                                       { 5000:3796  AddEffect, 1440 min }
  DrawCharacterSheet;                                                                  { 5000:37ae }
end;
```

### 5000:37EC PaladinCureDisease (M)
`procedure PaladinCureDisease(c [BP+6]: PChar)` — RETF 4. Caller: ViewMenu ('C'). Callees: RedrawCurrentMode, SelectPartyCharacter, DrawCharacterSheet, HasEffect, ShowCharacterMessage, AskYesNo, ClearCharacterMessage, RemoveEffect, AddEffect, ShowTimedBottomMessage. New: removes the six disease effects (`DiseaseEffects` 1Fh 22h 2Bh 2Ch 32h 39h) from the chosen member (asking "cure anyway: " when none is present), spends one of the paladin's `cures_left` and, unless already present, adds effect 8Dh for 10080 minutes (one week).
```pascal
RedrawCurrentMode;                                                                             { 5000:37f3 }
whom := PartyHead;                                                                     { 5000:37f8 }
SelectPartyCharacter('Cure whom? ', 1, whom);                                                     { 5000:3804 / 3813 }
if whom = nil then DrawCharacterSheet                                                  { 5000:3820 / 3828 }
else begin
  diseased := false;                                                                   { 5000:382f }
  for k := 1 to 6 do if HasEffect(whom, DiseaseEffects[k], e) then diseased := true;   { 5000:383e .. 3866  loop variable g_7747 }
  ans := 'Y';                                                                          { 5000:3868 }
  if not diseased then begin                                                           { 5000:386c }
    ShowCharacterMessage(whom, 'is not diseased', 0, 0);                                          { 5000:3872 / 3887 }
    ans := AskYesNo('cure anyway: ', 13, 10, 15);                                      { 5000:3892 / 38a1 }
    ClearCharacterMessage;                                                                         { 5000:38b2 }
  end;
  if ans = 'Y' then begin                                                              { 5000:38b7 }
    cure_InProgress := 1;                                                              { 5000:38c0 }
    for gfx_LoopCounter := 1 to 6 do RemoveEffect(whom, DiseaseEffects[gfx_LoopCounter], nil);                        { 5000:38c5 .. 38ec  loop variable = the global DS:7747 (gfx_LoopCounter: MOV [7747],1 / INC [7747] / CMP [7747],6), left = 6; }
    cure_InProgress := 0;                                                              { 5000:38f3 }
    if c^.cures_left <> 0 then c^.cures_left := c^.cures_left - 1;                     { 5000:38f8 / 3903  +191h }
    if not HasEffect(c, $8D, e) then AddEffect(c, $8D, $2760, 0, 1);                   { 5000:390b / 3922  10080 min }
    ShowTimedBottomMessage(whom^.name + ' is cured');                                               { 5000:393a .. 3954 }
  end;
  DrawCharacterSheet;                                                                  { 5000:3959 }
end;
```

### 5000:3963 ov19_init (H)
Empty unit initialiser { 5000:3963 }.

---

## ov23 (seg 5F00) — effects (conditions), effect hooks, saving throw, to-hit roll, damage, healing, ability recalculation

Unit: ov23, analysis segment 5F00, 25BDh bytes, 30 functions (+ init). Pool twin: ov24 9800 (shape 0.71..1.00 for the 19 shared routines; CallEffectHooks 0.43 — the hook lists grew to 23 events; StinkingCloudCheck 0.54 — poison from the cloud is new). **new:** `KillCombatant` 0016, `NearestCloudSource` 0D07, `StrengthFromItem` 1720, `RaiseStrength` 1769, `HpPerLevel` 17B8, `RecalcAbility` 18D8 (ability scores and hit points from base values, readied items and effects — Pool kept this in the resident 00BA unit).
Role: the active-effect list of a character (`effects +F2h`, 9-byte records), the effect-handler dispatcher (table `EffectHandler{g_6FA6}` = far procedure at `DS:6FA6 + 4*type`, filled by the MAGIC lane; `g_71F2` is used instead while `g_7582` is set — the item-hook dispatcher of ReadyItem), the "effect hook" events, the d20 saving throw and to-hit rolls, damage with its message, healing, revival and strength effects.
Strings (code segment): 0E03 `starts to cough`, 0E13 `chokes and gags from nausea`, 0E2F `is Poisoned`, 0E3B `is killed`, 163A `is Cured`, 1F19 `takes `, 1F20 ` points of damage `, 1F33 `takes 1 point of damage `, 1F4C `from Fire`, 1F56 `from Cold`, 1F60 `from Electricity`, 1F71 `from Acid`, 1F7B `from Magic`, 1F86 `lost a spell`, 1F93 `Goes Down`, 1F9D `, and is Dying`, 1FCC `is killed`, 22F9 `is Unaffected`, 24CC `stands up and grins`, 24E0 `gets back up`. Sets: CS:0249 = {15h, 2Dh, 2Eh, 31h}, CS:1FAC = {6, 7, 8}, CS:23DB = {0, 1, 4, 5}.
Effect record: `type +0`, `duration +1` (word), `p3 +3`, `callOnRemove +4`, `next +5`. Character fields used here: `base_abil[n] +10h + 2n` / `abil[n] +11h + 2n` (STR, INT, WIS, DEX, CON, CHA), `base_str_exc +1Dh` / `str_exc +1Ch`, `maxhp_base +12Ch` / `maxhp +78h`, `hp +1A4h`, `save[k] +DFh + k`, `ac_item_bonus +186h` (M), `levels +109h..`, `old_levels +111h..`, `old_level_cap +E6h` (the level a former class stopped at, M), `thac0 +199h`, `ac +19Ah`.
Tables (DS, bytes from START.EXE): `CombatEffectTypes{g_0A30}[1..19]` = 07 0B 0D 15 17 1E 1F 20 33 34 35 3A 3B 5F 62 88 89 8B 90; `MoraleEffectTypes{g_0A44}[1..4]` = 0D 3A 8B 90; `CloudSearchDirs{g_27D8}[1..4]` = 08 02 03 04 (direction steps tried around a cloud square); `LevelCap{g_3EB9}[class 0..7]` = 0Ah 0Fh 0Ah 0Ah 0Bh 0Ch 0Bh 13h (hit-dice cap per class).
Globals: `AttackRollValue` g_6F9F, `SaveRoll{g_6F92}`, `SaveType{g_6FA7}`, `SaveResult{g_6FA8}`, `EffectToApply{g_6F93}`, `DamageType{g_6F95}` (1 Fire, 2 Cold, 4 Electricity, 10h Acid, 8 Magic), `LastDiceCount{g_6F98}`, `DamageAmount` g_6F94, `g_7582` (item-hook mode), `cloud_List{g_755B}` (far ptr to the list of cloud sources: 1Ch bytes each, `owner +0`, `next +4`, `cells +10h..` and `x/y +1Ah/+1Bh`, M — written by MAGIC's cloud spells), `tg_List` copy area `g_6E97` (D8h bytes), `view_Mode` g_4FBA.
Other-unit callees: `ShowCharacterMessage` ShowCharacterMessage(c, msg, row, wait), `ClearCharacterMessage` ClearCharacterMessage, `ShowCombatMessageAnimation` ShowCombatMessageAnimation(c, flag, msg), `ApplyDamage` ApplyDamage(c, n), `ForgetMemorizedSpell` ForgetMemorizedSpell(c, spell), `ByteToStr` ByteToStr, `CountActiveSides` CountActiveSides, `ClearCombatantActionFlags` ClearCombatantActionFlags, `PartySummary`, VIEW: CombatantIndex/Col/Row/Size, ProbeMove, BuildTargetList, FocusCombatant, RestoreTerrain, RebuildOccupancy, PlaceCombatant(c, col, row, restore), RemoveCombatant.

### 5F00:0000 ov23_LoadDeps (M)
Three `CALLF` into entry 0 of ov24, ov34, ov25 { 5f00:0003 .. 000d }.

### 5F00:0016 KillCombatant (M)
`procedure KillCombatant(c [BP+0Ch]: PChar; newStatus [BP+0Ah]: Byte; msg [BP+6]: string)` — RETF 0Ah. Callers: StinkingCloudCheck ("is killed", 6); ov13 EffEyeRays (8 / 7 / 6); ov12 (MAGIC: "Suffocates", "dies from poison", "collapses", "Falls dead", "is Stoned" …). New (Pool twin by shape: RemoveFromCombat 0.52). Shows `msg`, and unless the character is already Dead/Stoned/Gone sets the new status, deactivates it with 0 hp, strips the combat effects, runs hook 0Dh and removes the icon.
```pascal
s := msg;                                                                              { 5f00:001c  string[40] }
ShowCharacterMessage(c, s, 10, 0);                                                                { 5f00:002f }
if not (c^.status in [7, 6, 8]) then begin                                             { 5f00:0045 .. 0059 }
  c^.status := newStatus;  c^.active := 0;  c^.hp := 0;                                { 5f00:005b / 0066 / 006f }
  RemoveCombatEffects(c);                                                              { 5f00:0078 }
  CallEffectHooks($0D, c);                                                             { 5f00:0082 }
  if c^.active = 0 then RemoveCombatant(c);                                            { 5f00:008f / 009a }
  MessageDelay;  ClearCharacterMessage;                                                            { 5f00:00a5 / 00aa }
  if view_Mode <> 5 then PartySummary(SelectedChar);                                   { 5f00:00af / 00b6 }
end;
```

### 5F00:00C9 CallEffectHandler (H)
`procedure CallEffectHandler(type [BP+10h]: Byte; c [BP+0Ch]: PChar; e [BP+8]: PEffect; mode [BP+6]: Byte)` — RETF 0Ch. Callers: RemoveEffect, RunEffectIfActive, StinkingCloudCheck, HealCharacter; ov13 EffEngulf/EffHug, ov19 ItemReadyEffect, MAGIC. Pool: 9800:0000 (0.74). **changed:** while `g_7582 <> 0` (set by ItemReadyEffect kind 0) the call goes to the procedure variable `g_71F2` instead of the table.
```pascal
if item_HookMode = 0 then EffectHandler[type](c, e, mode)                                     { 5f00:00cc / 00e9  CALLF [type*4 + 6FA6h] }
else item_HookProc(c, e, mode);                                                               { 5f00:00d3 }
```

### 5F00:010E RemoveEffect (H)
`procedure RemoveEffect(c [BP+0Ch]: PChar; type [BP+0Ah]: Byte; e [BP+6]: PEffect)` — RETF 0Ah. Callers: ov23_1569, RemoveCombatEffects, ov23_1603, CureEffect, RecalcAbility, ApplyEffect; ov05, ov09, ov13, ov19, MAGIC. Pool: 9800:0026 (0.71). **changed:** after freeing an effect of type 0Eh the charisma is recalculated, after 0Ch / 26h / 92h the strength (`RecalcAbility(c, 5)` / `(c, 0)`).
```pascal
p := e;                                                                                { 5f00:0114 }
if p = nil then begin                                                                  { 5f00:011f }
  p := c^.effects;                                                                     { 5f00:0127 }
  while (p <> nil) and (p^.type <> type) do p := p^.next;                              { 5f00:0137 .. 014d }
end;
if p = nil then exit;                                                                  { 5f00:015b }
if p^.callOnRemove <> 0 then CallEffectHandler(type, c, p, 1);                         { 5f00:0166 / 0170 }
if c^.effects = p then c^.effects := p^.next                                           { 5f00:0187 / 019b }
else begin
  q := c^.effects;                                                                     { 5f00:01b3 }
  while (q <> nil) and (q^.next <> p) do q := q^.next;                                 { 5f00:01c3 .. 01e1 }
  q^.next := p^.next;                                                                  { 5f00:01ef }
end;
FreeMem(p, 9);                                                                         { 5f00:0203 }
if type = $0E then RecalcAbility(c, 5);                                                { 5f00:0211 / 0217  new }
if type in [$0C, $26, $92] then RecalcAbility(c, 0);                                   { 5f00:0224 .. 0240  new }
```

### 5F00:0269 RunEffectIfActive (M)
`procedure RunEffectIfActive(c [BP+8]: PChar; type [BP+6]: Byte)` — RETF 6. Caller: CallEffectHooks. Pool: 9800:0160 (0.94), same body (area types 15h, 2Dh, 2Eh, 31h; range 6 for 31h, else 1; the target list is saved in `g_6E97`).
```pascal
found := false;  m := PartyHead;                                                       { 5f00:026c / 0275 }
if HasEffect(c, type, e) then found := true                                            { 5f00:0283 / 029c }
else if type in [$15, $2D, $2E, $31] then begin                                        { 5f00:02a4  set CS:0249 }
  Move(tg_List, saved, $D8);                                                           { 5f00:02b7 }
  while (m <> nil) and not found do begin                                              { 5f00:02cb .. }
    if HasEffect(m, type, e) then                                                      { 5f00:02e2 }
      if view_Mode = 5 then begin                                                      { 5f00:0300 }
        if type = $31 then range := 6 else range := 1;                                 { 5f00:030a .. 0310 }
        BuildTargetList(CombatantCol(m), CombatantRow(m), range, $FF, CombatantSize(m), cm_Map);   { 5f00:031c .. 0358 }
        for i := 1 to tg_Count do if tg_List[i].who = CombatantIndex(c) then found := true;   { 5f00:035d .. 0389 }
      end else found := true;                                                          { 5f00:03a9 }
    m := m^.next;                                                                      { 5f00:03ae }
  end;
  Move(saved, tg_List, $D8);                                                           { 5f00:03c4 }
end;
if found then CallEffectHandler(type, c, e, 0);                                        { 5f00:03d8 / 03df }
```

### 5F00:03FE CallEffectHooks (M)
`procedure CallEffectHooks(event [BP+0Ah]: Byte; c [BP+6]: PChar)` — RETF 6. Callers: KillCombatant (0Dh), AttackRollVsAC (10h), AttackRoll (0Ah, 10h), SavingThrow (0Ch), DamageCharacter (06h, 14h, 0Dh), ApplyEffect (09h); ov09 (0Eh, 11h), ov13 (00h, 01h, 04h, 05h, 0Bh, 0Dh, 12h, k+1), ov08/ov12/ov22. Pool: 9800:02FA (0.43 — the lists changed and events 14h..17h are new). For each event the effect types below are run through RunEffectIfActive, in this order (case chain 5f00:0405..0d04, every list as in the asm):
```pascal
case event of
  $01: [25, 19, 47, 45];                                                               { 5f00:0416 }
  $02: [4F, 50, 91, 39, 60, 7A, 7B];                                                   { 5f00:0452 }
  $03: [40, 41, 42, 43, 46, 4F, 57];                                                   { 5f00:04b5 }
  $04: [1D, 06, 67, 4B, 4C, 86];                                                       { 5f00:0518 }
  $05: [1C, 29, 68, 78, 65, 73, 74, 77, 5E, 75, 3C, 51, 52, 55, 82, 8F];               { 5f00:0571 }
  $06: [71, 3D, 0A, 14, 69, 6A, 70, 72, 76, 11, 5D, 65, 1C, 6E, 49, 52, 54, 81, 85, 87, 3F];   { 5f00:064c  damage taken }
  $07: [33, 34, 35, 1F, 03, 1B, 88];                                                   { 5f00:0765 }
  $08: [63, 52, 59, 48, 38];                                                           { 5f00:07c8 }
  $09: [69, 6A, 6B, 6C, 6D, 6E, 6F, 70, 7C, 7D, 3F, 81];                               { 5f00:0814  new effect about to be applied }
  $0A: [01, 02, 21, 24, 31, 06, 12, 1A, 4B, 4C];                                       { 5f00:08bb  attacker's to-hit }
  $0B: [21, 11, 08, 09, 2D, 2E, 1E, 07];                                               { 5f00:0945 }
  $0C: [08, 09, 0A, 11, 14, 21, 24, 2D, 2E, 31, 3D, 6F, 7D, 61, 32, 36];               { 5f00:09b8  saving throw }
  $0D: [63, 64, 4B];                                                                   { 5f00:0a90  character went down }
  $0E: [53, 58, 79, 56, 57, 5A, 7E, 80, 83, 84, 8B];                                   { 5f00:0ac2 }
  $0F: [15, 1E, 0B, 0D, 4D];                                                           { 5f00:0b59 }
  $10: [19, 47, 25, 2F, 30, 59, 04];                                                   { 5f00:0ba2  target of a to-hit roll }
  $11: [01, 02, 0B];                                                                   { 5f00:0c05  morale }
  $12: [27, 2A, 3A];                                                                   { 5f00:0c34  stat recalculation }
  $13: [62, 17, 48, 38, 0B];                                                           { 5f00:0c63 }
  $14: [32, 36];                                                                       { 5f00:0cab  new: unsaved damage }
  $15: [23];                                                                           { 5f00:0ccc  new }
  $16: [8A];                                                                           { 5f00:0ce0  new }
  $17: [4A];                                                                           { 5f00:0cf4  new }
end;                                                                                   { event 0 and others: nothing — Pool's event 00 list [7E] is gone }
```
(All numbers hexadecimal; the handlers communicate through the globals above.)

### 5F00:0D07 NearestCloudSource (M)
`function NearestCloudSource(dirs [BP+0Ch]: ^array of Byte; n [BP+0Ah]: Byte; list [BP+6+?]: PCloud; y [BP+8], x [BP+6]: ShortInt): PChar` — RETF 0Eh (pushes at 5f00:0f46: `@g_27D8, 4, cloud_List, y, x`). Caller: StinkingCloudCheck. New. Walks the cloud list and returns the owner (`+0`) of the first cloud that has a cell (`+10h + k`, k = 1..n, direction index into `step_dx/step_dy` added to the cloud's `+1Ah/+1Bh`) on (x, y); `PartyHead` when none matches — so the cloud's caster becomes `SelectedChar` for the message.
```pascal
p := list;  found := false;                                                            { 5f00:0d0d / 0d18 }
while (p <> nil) and not found do begin                                                { 5f00:0d1c .. }
  for k := 1 to n do                                                                   { 5f00:0d40 }
    if (p^.cells[k] <> 0) and (p^.x + step_dx[dirs^[k]] = x) and (p^.y + step_dy[dirs^[k]] = y) then found := true;   { 5f00:0d48 .. 0db5 }
  if not found then p := p^.next;                                                      { 5f00:0dc3 }
end;
if found then Result := p^.owner else Result := PartyHead;                             { 5f00:0dd5 .. 0deb }
```

### 5F00:0E45 StinkingCloudCheck (M)
`procedure StinkingCloudCheck(c [BP+8]: PChar; poison [BP+6]: Boolean)` — RETF 6. Callers: ov09 AiMove `(c, 1)`, ov08/ov22. Pool: 9800:0AE7 (0.54). **changed:** a second parameter; the cloud's caster is made `SelectedChar` while the effect is applied (NearestCloudSource); a failed save also poisons: an unconscious/coughing combatant of level 0..4 (or 5 with a failed save at −4, or 6 with a failed save) "is Poisoned" (effect 37h) and "is killed".
```pascal
if c^.active = 0 then exit;                                                            { 5f00:0e4b }
ProbeMove(c, 8, occupant, tile, hit1E, hit1C);                                         { 5f00:0e59 }
if (tile = 0) or not poison then exit;                                                 { 5f00:0e7b / 0e84 }
if HasEffect(c, $1F, e)                                                                { 5f00:0e8d }
   or HasEffect(c, $20, e)                                                             { 5f00:0ea7 }
   or HasEffect(c, $6F, e)                                                             { 5f00:0ec1 }
   or HasEffect(c, $7D, e) then exit;                                                  { 5f00:0edb }
saved := SavingThrow(c, 0, 0);                                                         { 5f00:0ef5 }
if saved then begin                                                                    { 5f00:0f08 }
  sel := SelectedChar;                                                                 { 5f00:0f11 }
  SelectedChar := NearestCloudSource(@CloudSearchDirs, 4, cloud_List, CombatantRow(c), CombatantCol(c));   { 5f00:0f1d .. 0f46 }
  ApplyEffect(c, $1E, 1, $FF, 0, 0, saved, 'starts to cough');                         { 5f00:0f50 / 0f7a }
  if HasEffect(c, $1E, e) then CallEffectHandler($1E, c, e, 0);                        { 5f00:0f85 / 0f9c }
  SelectedChar := sel;                                                                 { 5f00:0fb2 }
  exit;
end;
sel := SelectedChar;                                                                   { 5f00:0fc1 }
SelectedChar := NearestCloudSource(@CloudSearchDirs, 4, cloud_List, CombatantRow(c), CombatantCol(c));   { 5f00:0fcd .. 0ff6 }
ApplyEffect(c, $1F, Roll(1, 4) + 1, $FF, 0, 0, saved, 'chokes and gags from nausea');  { 5f00:1000 / 1013 }
if HasEffect(c, $1F, e) then CallEffectHandler($1F, c, e, 0);                          { 5f00:1037 / 104e }
SelectedChar := sel;                                                                   { 5f00:1064 }
if hit1E and (c^.active <> 0) then                                                     { 5f00:1070 / 1079  new: poison }
  case c^.level of                                                                     { 5f00:1084  +E5h }
    0..4: begin ShowCharacterMessage(c, 'is Poisoned', 10, 0); MessageDelay; AddEffect(c, $37, 0, $FF, 0); KillCombatant(c, 6, 'is killed') end;   { 5f00:1097 .. 10eb }
    5: if not SavingThrow(c, 0, $FC) then begin (same) end;                            { 5f00:10f5 .. 115d  bonus −4 }
    6: if not SavingThrow(c, 0, 0) then begin (same) end;                              { 5f00:1166 .. 11ce }
  end;
```

### 5F00:11D7 AttackRollVsAC (M)
`function AttackRollVsAC(target [BP+8]: PChar; toHit [BP+6]: Byte): Boolean` — RETF 6. Caller: ECL DAMAGE (ecl_op2E_Damage). Pool: 9800:0C4F (1.00).
```pascal
Result := false;                                                                       { 5f00:11dd }
AttackRollValue := Roll(1, 20);                                                        { 5f00:11e1 }
if AttackRollValue <= 1 then exit;                                                     { 5f00:11ee }
if AttackRollValue = 20 then AttackRollValue := 100;                                   { 5f00:11f5 / 11fc }
CallEffectHooks($10, target);                                                          { 5f00:1201 }
if (AttackRollValue >= 0) and (AttackRollValue + toHit > target^.ac) then Result := true;   { 5f00:120e .. 1232  +19Ah }
```

### 5F00:123F AttackRoll (M)
`function AttackRoll(attacker [BP+0Ch], target [BP+8]: PChar; targetAC [BP+6]: Byte): Boolean` — RETF 0Ah. Callers: ov13 MeleeAttack, MAGIC. Pool: 9800:0CB7 (1.00). Side to-hit modifiers from the ECL cells `Mem[7F71]` (party) / `Mem[7F70]` (monsters) (Pool `w[$6E2]`/`w[$6E0]`).
```pascal
Result := false;                                                                       { 5f00:1245 }
ov23_1569(attacker);                                                                   { 5f00:1249  remove every effect 19h }
AttackRollValue := Roll(1, 20);                                                        { 5f00:1253 }
if AttackRollValue <= 1 then exit;                                                     { 5f00:1260 }
if AttackRollValue = 20 then AttackRollValue := 100;                                   { 5f00:1267 / 126e }
CallEffectHooks($0A, attacker);  CallEffectHooks($10, target);                         { 5f00:1273 / 1280 }
if attacker^.side = 0 then sideBonus := ShortInt(Lo(Mem[7F71])) else sideBonus := ShortInt(Lo(Mem[7F70]));   { 5f00:128d .. 12aa }
if (AttackRollValue >= 0) and (AttackRollValue + attacker^.thac0 + sideBonus >= targetAC) then Result := true;   { 5f00:12b2 .. 12dc  +199h }
```

### 5F00:12EB SavingThrow (H)
`function SavingThrow(c [BP+0Ah]: PChar; saveType [BP+8], bonus [BP+6]: ShortInt): Boolean` — RETF 8. Callers: StinkingCloudCheck; ov09 AreaHitsFriend/AiCanStep, ov13 EffEyeRays, MAGIC. Pool: 9800:0D63 (0.85). **changed:** the result is kept in the global `SaveResult`; the item bonus is read from `+186h`.
```pascal
SaveResult := 1;                                                                       { 5f00:12f1 }
SaveRoll := Roll(1, 20);                                                               { 5f00:12f6 }
if SaveRoll = 1 then SaveResult := 0                                                   { 5f00:1303 / 130d }
else if SaveRoll = 20 then SaveResult := 1                                             { 5f00:1314 / 1319 }
else begin
  SaveRoll := Byte(SaveRoll + ShortInt(c^.ac_item_bonus) + bonus);                     { 5f00:1320 .. 133a  +186h }
  SaveType := saveType;                                                                { 5f00:133d }
  CallEffectHooks($0C, c);                                                             { 5f00:1343 }
  if SaveRoll < c^.save[saveType] then SaveResult := 0 else SaveResult := 1;           { 5f00:1350 .. 136b  +DFh + type }
end;
Result := SaveResult;                                                                  { 5f00:1370 }
```

### 5F00:137F Roll (H)
`function Roll(count [BP+8], sides [BP+6]: Byte): Byte` — RETF 4 (ecl_names.json). Pool: 9800:0DE3 (1.00).
```pascal
sum := 0;                                                                              { 5f00:1385 }
if count <> 0 then for i := 1 to count do sum := Byte(sum + Random(sides) + 1);        { 5f00:1389 .. 13aa }
Result := sum;                                                                         { 5f00:13bb }
```

### 5F00:13CA RollDice (M)
`function RollDice(count [BP+8], sides [BP+6]: Byte): Byte` — RETF 4. Callers: ov13 RollDamage, EffEyeRays, MAGIC. Pool: 9800:0E2E (1.00). `LastDiceCount := count; Result := Roll(count, sides)` { 5f00:13d3 / 13df }.

### 5F00:13EE AddEffect (H)
`procedure AddEffect(c [BP+0Eh]: PChar; type [BP+0Ch]: Byte; duration [BP+0Ah]: Word; p3 [BP+8], callOnRemove [BP+6]: Byte)` — RETF 0Ch. Callers: StinkingCloudCheck, RecalcAbility, ApplyEffect; ov13, ov19, MAGIC. Pool: 9800:0E52 (0.82), same body (list head `+F2h`).
```pascal
GetMem(e, 9);                                                                          { 5f00:13f4 }
if c^.effects = nil then c^.effects := e                                               { 5f00:1402 / 1411 }
else begin q := c^.effects; while q^.next <> nil do q := q^.next; q^.next := e end;    { 5f00:1425 .. 1453 }
e^.next := nil;  e^.type := type;  e^.duration := duration;  e^.callOnRemove := callOnRemove;  e^.p3 := p3;   { 5f00:1463 .. 1493 }
```

### 5F00:149D RemoveFromCombat (M)
`procedure RemoveFromCombat(c [BP+0Ch]: PChar; newStatus [BP+0Ah]: Byte; msg [BP+6]: string)` — RETF 0Ah. Callers: ov13 Flee, ov09 AiMoraleCheck, MAGIC. Pool: 9800:0F06 (1.00), same body.
```pascal
s := msg;                                                                              { 5f00:14a3 }
if c^.active = 0 then exit;                                                            { 5f00:14b6 }
i := CombatantIndex(c);                                                                { 5f00:14c4 }
FocusCombatant(c, 3, 0);                                                               { 5f00:14d2 }
ShowCharacterMessage(c, s, 10, 1);                                                                { 5f00:14e3 }
c^.active := 0;  c^.status := newStatus;                                               { 5f00:14f9 / 1502 }
if c^.status <> 3 then c^.hp := 0;                                                     { 5f00:150d / 1518 }
RestoreTerrain(0, 0, i);                                                               { 5f00:1521 }
FlushViewDirtyLines;                                                                   { 5f00:1530 }
cb_Size[i] := 0;                                                                       { 5f00:1535 }
RebuildOccupancy;                                                                      { 5f00:1545 }
if ClearCombatantActionFlags(c) then RemoveCombatEffects(c);                                           { 5f00:154a / 1559 }
```

### 5F00:1569 ov23_1569 — remove all effects 19h (L: BreakInvisibility)
`procedure ov23_1569(c [BP+6]: PChar)` — RETF 4. Callers: AttackRoll, ov13 MeleeAttack, MAGIC. Pool: 9800:0FD2 (1.00). `while HasEffect(c, $19, e) do RemoveEffect(c, $19, e)` { 5f00:157d / 1596 }.

### 5F00:15A1 RemoveCombatEffects (M)
`procedure RemoveCombatEffects(c [BP+6]: PChar)` — RETF 4. Callers: KillCombatant, RemoveFromCombat, DamageCharacter, ov13 ShowAttackResult, MAGIC. Pool: 9800:100A (0.76). **changed:** 19 types (Pool 16); an NPC with `npc_morale = B3h` that still has effect 4Dh is moved back to side 0.
```pascal
for k := 1 to 19 do RemoveEffect(c, CombatEffectTypes[k], nil);                        { 5f00:15a7 .. 15c9  g_0A2F + k }
if HasEffect(c, $4D, e) and (c^.npc_morale = $B3) then c^.side := 0;                   { 5f00:15d2 / 15e9 / 15f4  new }
```

### 5F00:1603 ov23_1603 — remove the morale effects (L)
`procedure ov23_1603(c [BP+6]: PChar)` — RETF 4. Caller: ov09 AiMoraleCheck. Pool: 9800:1041 (1.00). `for k := 1 to 4 do RemoveEffect(c, MoraleEffectTypes[k], nil)` { 5f00:1609 .. 162b } — types 0Dh, 3Ah, 8Bh, 90h (Pool: 4Ah, 4Bh).

### 5F00:1643 CureEffect (H)
`function CureEffect(c [BP+8]: PChar; type [BP+6]: Byte): Boolean` — RETF 6. Callers: MAGIC cure spells. Pool: 9800:1081 (1.00).
```pascal
Result := false;                                                                       { 5f00:1649 }
if HasEffect(c, type, e) then begin                                                    { 5f00:164d }
  ShowCharacterMessage(c, 'is Cured', 10, 1);                                                     { 5f00:1665 / 167a }
  RemoveEffect(c, type, e);                                                            { 5f00:1685 }
  Result := true;                                                                      { 5f00:1699 }
end;
```

### 5F00:16A6 StrengthCode (M)
`function StrengthCode(str [BP+8], strExc [BP+6]: Byte): Byte` — RETF 4. Callers: StrengthFromItem; MAGIC. Pool: 9800:10E4 (1.00). `code := str + 100; if str = 18 then code := strExc + 1` { 5f00:16ac / 16b7 }.

### 5F00:16CF DecodeStrength (M)
`procedure DecodeStrength(e [BP+0Eh]: PEffect; var str [BP+0Ah], strExc [BP+6]: Byte)` — RETF 0Ch. Callers: RecalcAbility; MAGIC. Pool: 9800:110D (0.98).
```pascal
strExc := 0;  str := e^.p3 and $7F;                                                    { 5f00:16d2 / 16d9 }
if str <= $65 then begin strExc := str - 1; str := 18 end else str := str - 100;       { 5f00:16e8 .. 170c }
```

### 5F00:1720 StrengthFromItem (M)
`function StrengthFromItem(c [BP+0Eh]: PChar; str [BP+0Ch], strExc [BP+0Ah]: Byte; var code [BP+6]: Byte): Boolean` — RETF 0Ch. Caller: MAGIC (ItemGiantStrength twin). New (Pool SetStrength 0.64). True (and `code` := StrengthCode(str, strExc)) when the given strength is higher than the character's base strength (`+10h`, exceptional `+1Dh`).
```pascal
if (c^.base_str < str) or ((str = 18) and (c^.base_str_exc < strExc)) then begin       { 5f00:1726 .. 1742 }
  Result := true;  code := StrengthCode(str, strExc);                                  { 5f00:1744 / 1751 }
end else Result := false;                                                              { 5f00:175c }
```

### 5F00:1769 RaiseStrength (M) — nested helper of RecalcAbility
`procedure RaiseStrength` (static link [BP+6]; parent locals `cur [BP−1]`, `new [BP−2]`, `curExc [BP−3]`, `newExc [BP−4]`) — RETF 2. Takes the candidate strength when it is higher than the current one (18 compares the exceptional part).
```pascal
if (cur < new) or ((new = 18) and (curExc < newExc)) then begin cur := new; curExc := newExc end;   { 5f00:176c .. 17a7 }
```

### 5F00:17B8 HpPerLevel (M) — nested helper of RecalcAbility
`procedure HpPerLevel(levels [BP+0Ah], class [BP+8]: Byte)` (static link [BP+6]; parent `c` and `hp [BP−0Ah]`, `con [BP−1]`) — RETF 6. Adds the hit points of `levels` levels of class `class` to the parent's `hp`: levels above `LevelCap[class]` count as cap−1 (+1 for a ranger whose former-class cap applies); fighter-type classes (2, 3, 4) get the CON bonus per level (15..19: con−14, 20: 5, 21..23: 6, 24..25: 7), the others +1 per level for CON 15 and +2 above.
```pascal
if LevelCap[class] <= levels then levels := LevelCap[class] - 1;                       { 5f00:17bb .. }
if (class = 4) and ((c^.old_level_cap = 0) or (c^.old_level[4] = c^.old_level_cap)) then levels := levels + 1;   { 5f00:17e0 .. }
if class in [2, 3, 4] then                                                             { }
  case con of 15..19: hp := hp + (con - 14) * levels; 20: hp := hp + levels * 5; 21..23: hp := hp + levels * 6; 24..25: hp := hp + levels * 7 end   { }
else if con = 15 then hp := hp + levels else if con > 15 then hp := hp + levels * 2;   { .. 18d2 }
```

### 5F00:18D8 RecalcAbility (M)
`procedure RecalcAbility(c [BP+8]: PChar; n [BP+6]: Byte)` — RETF 6. Callers: RemoveEffect (0, 5), ov19 ItemReadyEffect (0..5), ov04 (temple), MAGIC. New: computes the current ability `n` (0 STR, 1 INT, 2 WIS, 3 DEX, 4 CON — and with it the hit points, 5 CHA) from the base value `+10h + 2n`, the readied items whose hook kind (`special[3] and 7Fh`) is 5 (girdle/gauntlets: STR 18/00 .. 24 by `special[2]`), 8 (+1 to ability `special[2]` while the base is below 18), 0Dh (INT 3), 0Ch (INT 7), 6 (+1 CON, −1 CHA), 2 (DEX by CON: +4 / +2 / +1), 0Ah (−2 DEX), and the effects 26h / 92h / 0Ch (strength codes, `RaiseStrength`), 44h (INT/WIS 3 unless already lower), 0Eh (CHA + p3). For `n = 4` the maximum hit points are rebuilt from `maxhp_base` plus HpPerLevel over all current and former classes, the current hp moved by the difference, and effect 3Eh (regeneration, duration 3Ch) kept iff CON ≥ 20.
```pascal
new := 0;  newExc := 0;  fixed := $FF;                                                 { 5f00:18de .. 18e6 }
cur := c^.base_abil[n];  curExc := c^.base_str_exc;                                    { 5f00:18fe / 1910  +10h + 2n, +1Dh }
it := c^.items;                                                                        { 5f00:18ee }
while it <> nil do begin                                                               { 5f00:191a }
  if (it^.special[3] > $80) and (it^.ready <> 0) then begin                            { 5f00:1925 / 1932 }
    kind := it^.special[3] and $7F;                                                    { 5f00:193f }
    case n of
      0: begin                                                                         { 5f00:194b }
           if kind = 5 then case it^.special[2] of 0: begin new := 18; newExc := 100 end; 1: new := 19; 2: new := 20; 3: new := 21; 4: new := 22; 5: new := 23; 6: new := 24 end   { 5f00:1955 .. 19b3 }
           else if (kind = 8) and (c^.base_str < 18) and (it^.special[2] = 0) then begin new := c^.base_str + 1; newExc := 0 end   { 5f00:19b9 .. 19df }
           else if kind = $0D then fixed := 3;                                         { 5f00:19e5 / 19ea }
           RaiseStrength;                                                              { 5f00:19ef }
         end;
      4: if kind = 6 then cur := cur + 1                                               { 5f00:19f6 / 1a05 }
         else if (kind = 8) and (c^.base_abil[4] < 18) and (it^.special[2] = 4) then cur := cur + 1;   { 5f00:1a0b .. 1a29 }
      1: if (kind = 8) and (c^.base_abil[1] < 18) and (it^.special[2] = 1) then cur := cur + 1   { 5f00:1a33 .. 1a51 }
         else if kind = $0C then fixed := 7 else if kind = $0D then fixed := 3;        { 5f00:1a57 .. 1a6b }
      2: if (kind = 8) and (it^.special[2] = 2) and (c^.base_abil[2] < 18) then cur := cur + 1;   { 5f00:1a6d .. 1a93 }
      3: if kind = 2 then begin if c^.base_abil[3] < 7 then cur := cur + 4 else if c^.base_abil[3] <= 13 then cur := cur + 2 else cur := cur + 1 end   { 5f00:1a95 .. 1acb }
         else if (kind = 8) and (c^.base_abil[3] < 18) and (it^.special[2] = 3) then cur := cur + 1   { 5f00:1ad2 .. 1af0 }
         else if kind = $0A then cur := cur - 2;                                       { 5f00:1af0 / 1aff }
      5: if kind = 6 then cur := cur - 1                                               { 5f00:1b04 / 1b0e }
         else if (kind = 8) and (c^.base_abil[5] < 18) and (it^.special[2] = 5) then cur := cur + 1;   { 5f00:1b18 .. 1b37 }
    end;
  end;
  it := it^.next;                                                                      { 5f00:1b1b }
end;
case n of
  0: begin                                                                             { 5f00:1b2d }
       if HasEffect(c, $26, e) then begin                                              { 5f00:1b37 }
         DecodeStrength(e, new, newExc);                                               { 5f00:1b51 }
         if (cur < 19) and (curExc < 100) then begin                                   { 5f00:1b65 / 1b6e }
           new := cur + new;                                                           { 5f00:1b77 }
           if new > 18 then                                                            { 5f00:1b88 }
             if (c^.level[2] < 1) and (c^.old_level[2] < 1) and (c^.level[3] < 1) and (c^.old_level[3] < 1) and (c^.level[4] < 1) and (c^.old_level[4] < 1) then new := 18   { 5f00:1b88 .. 1bc3  no fighter class: capped at 18 }
             else begin newExc := c^.str_exc + (new - 18) * 10; if newExc > 100 then newExc := 100; new := 18 end;   { 5f00:1bc5 .. 1bfd }
         end;
         RaiseStrength;                                                                { 5f00:1c02 }
       end;
       if HasEffect(c, $92, e) then begin DecodeStrength(e, new, newExc); RaiseStrength end;   { 5f00:1c06 / 1c1d / 1c32 }
       if HasEffect(c, $0C, e) then begin DecodeStrength(e, new, newExc); RaiseStrength end;   { 5f00:1c36 / 1c4d / 1c62 }
       if fixed = $FF then begin c^.str := cur; c^.str_exc := curExc end               { 5f00:1c66 .. 1c80  +11h, +1Ch }
       else begin c^.str := fixed; c^.str_exc := 0 end;                                { 5f00:1c80 .. 1c94 }
     end;
  4: begin                                                                             { 5f00:1c9e }
       oldMax := c^.maxhp;                                                             { 5f00:1ca2 }
       c^.maxhp := c^.maxhp_base;                                                      { 5f00:1cac  +12Ch }
       for k := 0 to 7 do begin                                                        { 5f00:1cbb }
         if c^.old_level[k] <> 0 then HpPerLevel(c^.old_level[k], k);                  { 5f00:1cd5 / 1ce4 }
         lv := c^.level[k];  if lv > LevelCap[k] then lv := LevelCap[k];               { 5f00:1ce8 .. 1d08 }
         if lv > c^.old_level_cap then HpPerLevel(lv - c^.old_level_cap, k);           { 5f00:1d11 / 1d3f  +E6h }
       end;
       if oldMax < c^.maxhp then c^.hp := c^.hp + (c^.maxhp - oldMax)                  { 5f00:1d68 .. 1d86 }
       else if c^.maxhp < oldMax then if oldMax - c^.maxhp < c^.hp then c^.hp := c^.hp - (oldMax - c^.maxhp) else c^.hp := 0;   { 5f00:1d8e .. 1dcc }
       c^.con := cur;                                                                  { 5f00:1de1 / 1de7  +19h }
       if c^.con < 20 then RemoveEffect(c, $3E, nil)                                   { 5f00:1deb / 1e25 }
       else if not HasEffect(c, $3E, e) then AddEffect(c, $3E, $3C, $FF, 1);           { 5f00:1df5 / 1e0c }
     end;
  1: begin if HasEffect(c, $44, e) and (fixed > 7) then fixed := 3; if fixed = $FF then c^.int := cur else c^.int := fixed end;   { 5f00:1e3f .. 1e7c  +13h }
  2: begin if HasEffect(c, $44, e) and (fixed > 7) then fixed := 3; if fixed = $FF then c^.wis := cur else c^.wis := fixed end;   { 5f00:1e83 .. 1ec0  +15h }
  3: if fixed = $FF then c^.dex := cur else c^.dex := fixed;                           { 5f00:1ec6 .. 1ee2  +17h }
  5: begin if HasEffect(c, $0E, e) then cur := cur + e^.p3; c^.cha := cur end;         { 5f00:1ee8 .. 1f0f  +1Bh }
end;
```

### 5F00:1FD6 DamageCharacter (H)
`procedure DamageCharacter(c [BP+0Ch]: PChar; dmg [BP+0Ah], saveEffect [BP+8]: Byte; saved [BP+6]: Boolean)` — RETF 0Ah. Callers: ov13 EffEyeRays, ov19 ItemReadyEffect, MAGIC. Pool: 9800:1344 (0.96). **changed:** without a successful save the hooks of the new event 14h run (effects 32h, 36h); "lost a spell" is forgotten from `c`; out of combat the going-down text is followed by MessageDelay only.
```pascal
DamageAmount := dmg;                                                                   { 5f00:1fdd }
CallEffectHooks($06, c);                                                               { 5f00:1fe3 }
if not saved then CallEffectHooks($14, c)                                              { 5f00:1ff0 / 2018  new }
else case saveEffect of 1: DamageAmount := 0; 2: DamageAmount := DamageAmount div 2 end;   { 5f00:1ff6 .. 2013 }
if DamageAmount = 0 then exit;                                                         { 5f00:2025 }
if DamageAmount = 1 then s := 'takes 1 point of damage '                               { 5f00:202f / 2075 }
else s := 'takes ' + ByteToStr(DamageAmount) + ' points of damage ';                   { 5f00:2036 .. 206e }
case DamageType and $F7 of 1: s := s + 'from Fire'; 2: s := s + 'from Cold'; 4: s := s + 'from Electricity'; $10: s := s + 'from Acid' end;   { 5f00:2089 .. 211d }
if (DamageType and 8) = DamageType then s := s + 'from Magic';                         { 5f00:2153 .. 2183  true for 8 and for 0 }
ShowCombatMessageAnimation(c, 0, s);                                                                    { 5f00:2188  ShowCombatMessageAnimation }
ApplyDamage(c, DamageAmount);                                                            { 5f00:219c  ApplyDamage }
if view_Mode = 5 then begin                                                            { 5f00:21ab }
  cb^[1] := 0;                                                                         { 5f00:21b2 }
  if cb^.castSpell <> 0 then begin                                                     { 5f00:21bf }
    ShowCharacterMessage(c, 'lost a spell', 12, 1);                                               { 5f00:21cd / 21e3 }
    ForgetMemorizedSpell(c, cb^.castSpell);                                                       { 5f00:21ee  ForgetMemorizedSpell(c, spell) }
    cb^.castSpell := 0;                                                                { 5f00:2205 }
  end;
end;
if c^.active = 0 then begin                                                            { 5f00:2211 }
  s := 'Goes Down';                                                                    { 5f00:221f }
  if c^.status = 5 then s := s + ', and is Dying';                                     { 5f00:2233 / 223e .. 2263 }
  if c^.status in [6, 7, 8] then s := 'is killed';                                     { 5f00:2268 / 227d  set CS:1FAC }
  ShowCharacterMessage(c, s, text_Row + 1, 0);                                                    { 5f00:2291 }
  if view_Mode = 5 then begin                                                          { 5f00:22ac }
    RemoveCombatEffects(c);  CallEffectHooks($0D, c);                                  { 5f00:22ba / 22c4 }
    if c^.active = 0 then RemoveCombatant(c) else MessageDelay;                        { 5f00:22d1 / 22dc / 22e9 }
  end else MessageDelay;                                                               { 5f00:22b3 }
end;
ClearCharacterMessage;                                                                             { 5f00:22ee }
```

### 5F00:2307 ApplyEffect (M)
`procedure ApplyEffect(c [BP+16h]: PChar; type [BP+14h]: Byte; duration [BP+12h]: Word; p3 [BP+10h], callOnRemove [BP+0Eh], negateOnSave [BP+0Ch]: Byte; saved [BP+0Ah]: Boolean; msg [BP+6]: string)` — RETF 14h. Callers: StinkingCloudCheck; MAGIC. Pool: 9800:1656 (0.97). **changed:** an existing effect of the same type is replaced only when it has a non-zero duration (the new duration is not compared).
```pascal
s := msg;                                                                              { 5f00:230d }
EffectToApply := type;                                                                 { 5f00:2320 }
CallEffectHooks($09, c);                                                               { 5f00:2326 }
if (EffectToApply = 0) or (saved and (negateOnSave = 1)) then ShowCharacterMessage(c, 'is Unaffected', 10, 1)   { 5f00:2333 .. 2361 }
else begin
  if HasEffect(c, type, e) and (e^.duration <> 0) then RemoveEffect(c, type, e);       { 5f00:2368 / 2380 / 238a }
  AddEffect(c, type, duration, p3, callOnRemove);                                      { 5f00:239e }
  if s <> '' then begin ShowCombatMessageAnimation(c, 1, s); ClearCharacterMessage end;                             { 5f00:23b7 / 23bd / 23d0 }
end;
```

### 5F00:23FB HealCharacter (M)
`function HealCharacter(c [BP+0Ah]: PChar; amount [BP+8]: Byte; onlyIfHurt [BP+6]: Boolean): Boolean` — RETF 8. Callers: ov19 LayOnHands, ov04, MAGIC. Pool: 9800:175D (0.93). **changed:** no effect-32h test; heals when hurt (or always when `onlyIfHurt` = 0).
```pascal
Result := false;                                                                       { 5f00:2401 }
if (c^.status in [0, 1, 4, 5]) and (((c^.hp < c^.maxhp) and onlyIfHurt) or not onlyIfHurt) then begin   { 5f00:2405 .. 2442  set CS:23DB }
  c^.hp := Byte(c^.hp + amount);                                                       { 5f00:243d }
  if c^.hp > c^.maxhp then c^.hp := c^.maxhp;                                          { 5f00:2458 / 2469 }
  if c^.active = 0 then begin                                                          { 5f00:2478 }
    if c^.status = 5 then c^.status := 4;                                              { 5f00:2483 / 248e }
    if (c^.status = 4) and (view_Mode <> 5) then CallEffectHandler($4E, c, nil, 1);    { 5f00:2497 / 24a2 / 24a9 }
  end;
  Result := true;                                                                      { 5f00:24bf }
end;
```

### 5F00:24ED ReviveCombatant (M)
`function ReviveCombatant(c [BP+8]: PChar; hp [BP+6]: Byte): Boolean` — RETF 6. Callers: MAGIC (revive effects). Pool: 9800:1869 (1.00).
```pascal
if not PlaceCombatant(c, CombatantCol(c), CombatantRow(c), 1) then begin Result := false; exit end;   { 5f00:24f3 .. 2519 }
c^.status := 0;  c^.active := 1;  c^.hp := hp;                                         { 5f00:2520 / 2529 / 2532 }
if view_Mode = 5 then FocusCombatant(c, 3, 0);                                         { 5f00:253d / 2544 }
if c^.side = 1 then s := 'stands up and grins' else s := 'gets back up';               { 5f00:2555 / 2560 / 2575 }
ShowCharacterMessage(c, s, 10, 1);                                                                { 5f00:2588 }
CountActiveSides;                                                                             { 5f00:259e  CountActiveSides }
Result := true;                                                                        { 5f00:25a3 }
```

### 5F00:25B6 ov23_init (H)
Empty unit initialiser { 5f00:25b6 }.


## Self-check
Method: `scratchpad/sample.py` (seed 20261020) drew 216 of the 2155 anchored Pascal statements (10 %) at random; each was re-read against the instructions at its address in `decode/listings/ov05|07|09|13|18|19|23.lst` (the statement, the operands and offsets, the constants, the push order of calls, the sense of the branch). Sample (line numbers of this file at the time of the check): ov05 45, 63, 89, 116, 120, 130, 134, 146, 155, 165, 197, 204, 217, 244, 254, 263, 298, 303, 325, 327, 331, 342, 350, 362, 381, 390, 399, 400, 401, 406; ov07 455, 501, 580, 585, 590, 627, 629, 637, 638, 642, 652, 653, 660, 662; ov09 727, 736, 739, 772, 775, 796, 804, 811, 830, 833, 847, 879, 885, 888, 927, 933, 957, 971, 990, 998, 1023, 1042, 1045, 1047, 1054, 1058, 1068, 1088; ov13 1127, 1130, 1140, 1143, 1153, 1157, 1165, 1184, 1188, 1249, 1252, 1254, 1261, 1272, 1314, 1315, 1318, 1337, 1339, 1340, 1351, 1371, 1377, 1390, 1392, 1393, 1400, 1408, 1428, 1439, 1446, 1454, 1520, 1555, 1559, 1618, 1634, 1641, 1677, 1689, 1696, 1731, 1734, 1783, 1799, 1831, 1832, 1863, 1873, 1885, 1889, 1904, 1920, 1954, 1962, 1974, 1995, 2005, 2020, 2028, 2085, 2094, 2101, 2118, 2131, 2136, 2150; ov18 2191, 2194, 2203, 2216, 2279, 2292, 2294, 2342, 2347; ov19 2380, 2386, 2395, 2417, 2429, 2430, 2446, 2484, 2486, 2493, 2507, 2516, 2522, 2531, 2533, 2534, 2549, 2558, 2559, 2580, 2608, 2636, 2656, 2658, 2700, 2717, 2718, 2723, 2741, 2747, 2764, 2783, 2796, 2800, 2824, 2835, 2864, 2890, 2913, 2915, 2926, 2940, 2947; ov23 2972, 2976, 3026, 3037, 3041, 3046, 3055, 3070, 3097, 3116, 3152, 3171, 3182, 3223, 3250, 3257, 3266, 3276, 3279, 3319, 3321, 3328, 3338, 3350, 3356.
Result: 216/216 agree with the asm in content (fields and offsets, constants, string literals, push order, branch sense; e.g. `AttackRollValue > $11` = `CMP [6F9F],12h; JGE`, `SlotSwings[slot]` = `INC [75D6h + slot]`, the hook lists of CallEffectHooks = the `MOV AL,xx` before each RunEffectIfActive call, `(10 − GameSpeed) × 2` at 4e00:1432). 13 of the 216 cited an instruction one statement away from the one described (the store or jump that precedes the test); corrected in place: 3100:145b, 3a00:0076/007e, 0530, 0e7b, 0fa0, 3be7/3bec, 3c85, 45f1, 2c00:1fc8, 5000:1b89, 24d5, 033d/0342, 5f00:1928/1935. ReadyItem's error-detection block (5000:1f57..2048) was re-cited from the listing: the original cites were those of the unready path, and `Wrong Class` / `It's Cursed` had swapped cites — found by argcheck (ItemReadyEffect(item, 1) at 206a is the *ready* path).
Anchors: `python -I decode/tools/anchorcheck.py decode/pseudo/COMBAT.pas.md` → 2856 anchors, **0 bad**. The first run found 478 anchors 1..5 bytes inside an instruction (Ghidra statement addresses carried over from the C export); `scratchpad/snap.py` moved every such anchor to the start of the instruction that contains it (567 tokens incl. `..`/`/` follow-ups); the sample above was drawn after that step, so its 13 corrections bound the residual error of the snapped anchors (≈ 6 % one statement off, none wrong in content).
Argument order: `python -I decode/tools/argcheck.py COMBAT` → 1213 calls, OK 147, **MISMATCH 0**, UNSURE 1066 (`COMBAT_ARGCHECK.md`). The first run had 33 MISMATCH: 24 were several calls on one line sharing one anchor (split into one anchored call per line); the real ones were the ov18 fireworks signatures written in push order instead of Pascal order (InitFireworks / RunFireworks / StepFireworks / LaunchRocket — now `(x, y, vx, vy, colours)` etc., LaunchRocket's `var` parameters shown as pointers), StrengthFromItem's parameter order (`c [BP+0Eh], str [BP+0Ch], strExc [BP+0Ah], var code [BP+6]`), `SavingThrow(c, 0, $FC)` (−4 as a byte) and the ReadyItem cites above. Every multi-argument call written new for Curse (ov18, KillCombatant, NearestCloudSource, StinkingCloudCheck's second parameter, RecalcAbility, ItemReadyEffect, LayOnHands, PaladinCureDisease, TargetMenu/SelectTarget's `canTargetChar`) was taken from its PUSH sequence.
Pool deltas: every routine with a Pool twin carries its shape ratio and a "same body" / **changed** / **new** mark; the new routines (ov05 none; ov07 none; ov09 none; ov13 EffEngulfHold/EffHugHold/EffHug as new effect ids; ov18 WritePixel..FireworksShow, EndSequence; ov19 ItemDebugView, ItemReadyEffect, CanLayHands, CanCureDisease, LayOnHands, PaladinCureDisease; ov23 KillCombatant, NearestCloudSource, StrengthFromItem, RaiseStrength, HpPerLevel, RecalcAbility) have no Pool line.
Fixes (lane cab-fixes-fable, 2026-10-20): STATUS `COMBAT fix request #verify-1..31` applied — #24 the loop variable is the global DS:7747 (`gfx_LoopCounter`), #30/#31 the View / Items menu prompts are the empty string (cs:0B09 / cs:14F4; pseudocode and COMBAT_SCREENS.md COMBAT-19-02/03), the other 28 re-cited to the statement's first instruction. Whole-file cite pass: `scratchpad/verify/citepass4.py` flags anchors that sit on a closing JMP, a conditional jump, an epilogue or the previous statement's store, and walks every other anchor back over its own argument/expression setup to the statement's first instruction (stops at a store, a jump, a statement-level call, a label or the previous anchored line); it moved 1397 anchors on 1174 lines (1220 to the first push/load of their statement, 71 conditional statements off a preceding store, 57 off a conditional jump, 49 off a closing JMP). Its 45 conflicts, 27 review items and 23 out-of-order anchors were settled by hand against the listings (101 cites, e.g. the readied/ok branches of 3100:1B09..1BA0, the cost / Odd(dir) block 3a00:07B5..081A, NextTarget 3a00:3951..3A92, the MayLoseItem / Gods-intervene branches, `Result := not going` 3100:11E9). Checks after the pass: anchorcheck 2862 anchors, **0 bad**; argcheck 1213 calls, **0 MISMATCH** (COMBAT_ARGCHECK.md regenerated).
