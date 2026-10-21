// game/areas/magic_ov08.js — MAGIC ov08 (2F00): the combat round loop and the player's turn menu.
// Owner: cab-build-areas. Source: decode/pseudo/MAGIC.pas.md ov08 (verified); Pool twin ov08 4800 (structure only).
// Kept in MAGIC as in Pool's final map; it drives the COMBAT units (ov09 AI, ov13 attacks/targeting, ov23 effects) through
// view_link `X`. Caution rule 2: PlayerTurn's key handling re-read from decode/listings/ov08.lst (2f00:043a..06e9): the
// plain-key case runs only when menu_Ext = 0; the keypad letters, '2' (Alt-M), #10h (Alt-Q) and '-' (Alt-X) are the
// extended-key branch; CombatMenu maps an extended key outside CS:072C to #0 and loops until the key is in CS:074C.
// Combatant record c.combat.b (16h bytes): +0 castSpell, +1 mayCast, +3 initiative (14h = "Quick for all"), +6 moveLeft
// (half squares), +7, +9 facing, +0Ah target (far pointer = c.combat.target), +0Eh dyingTurns, +0Fh, +11h turned, +12h.
// Character fields: +1Eh.. memorised spells (84), +109h levels, +111h former-class levels, +14Ch item count,
// +195h status, +196h active, +197h side, +198h controlled (AI), +F7h NPC morale.
// SpellHandlers[0] (DS:72A0, the spell-target selector) is kept as a routine name: G.SpellHandlers[0] = 'CollectSpellTargets'
// in combat / 'SelectTargetsCamp' in camp; MAGIC ov22 calls X[G.SpellHandlers[0]](...).

import { G } from '../engine/state.js';
import { ClearRectangle } from '../engine/text.js';
import { FlushGameKeys } from '../engine/input.js';
import { Delay } from '../engine/timer.js';
import { FreePicture } from '../engine/pictures.js';
import { hooks } from '../plus/hooks.js';   // GBP W1 (docs/PLUS_HOOKS.md)
import { view, sx8 } from './view_ov30.js';
import { HorizontalMenu, AskYesNo, ClearMenuLine } from './view_ov26.js';
import { StartCombat } from './view_ov10.js';
import { IsVisible, FocusCombatant, FocusSquare, CombatantCol, CombatantRow, CombatantIndex, RedrawSquare, RestoreTerrain,
  PlaceCombatant, ShowCombatant, ProbeMove, PaletteFlashOff } from './view_ov32.js';
import { X } from './view_link.js';

const CB = (c) => c.combat.b;
const sb = (v) => ((v & 0xFF) ^ 0x80) - 0x80;
const EXT_OK = new Set(['\x10', '\x13', '-', '2', 'G', 'H', 'I', 'K', 'M', 'O', 'P', 'Q']);      // set CS:072C
const EXIT_SET = new Set([...EXT_OK, ' ', 'A', 'C', 'D', 'T', 'U', 'V']);                      // set CS:074C
const terrCost = (t) => G.ds[0x26A2 + t * 4];                            // CombatTerrain[t].cost
const handlers = () => { if (!Array.isArray(G.SpellHandlers)) G.SpellHandlers = [null]; return G.SpellHandlers; };

// 2F00:004D EndCombat
export function EndCombat() {
  G.cloud_List = null;                                                   // 2f00:0053 .. 0075 FreeMem($1E) each
  G.cloud9_List = null;                                                  // 2f00:0088 .. 00aa
  G.cm_Map = null;                                                       // 2f00:00bd / 00cb FreeMem($4E9)
  G.g_75E0 = FreePicture(G.g_75E0) ?? null;                              // 2f00:00d3
  PaletteFlashOff();                                                     // 2f00:00dd
  handlers()[0] = 'SelectTargetsCamp';                                   // 2f00:00e2 / 00e8
}

// 2F00:00F3 CombatMain (ECL COMBAT)
export async function CombatMain() {
  G.view_Mode = 5;                                                       // 2f00:00f9
  handlers()[0] = 'CollectSpellTargets';                                 // 2f00:00fe / 0104
  await StartCombat();                                                   // 2f00:010b
  const over = { v: false };                                             // 2f00:0110
  const act = () => G.side_ActiveCount || [0, 0];
  if (act()[0] === 0 || act()[1] === 0) over.v = true;                   // 2f00:0114 .. 0122
  while (!over.v) {                                                      // 2f00:0126
    await X.CountActiveSides();                                          // 2f00:012c
    for (let c = G.PartyList; c; c = c.next) await X.StartCombatRound(c);   // 2f00:013d .. 0153
    view.setMem(0x7ECB, 0);                                              // 2f00:015d
    const who = { v: null };
    await NextToAct(who);                                                // 2f00:016d
    while (who.v) { await TakeTurn(who.v); await NextToAct(who); }       // 2f00:0176 / 017e / 0188
    await EndOfRound(over);                                              // 2f00:0193
  }
  EndCombat();                                                           // 2f00:019e
  G.TextOutputActive = 1;                                                // 2f00:01a2
}

// 2F00:01AB NextToAct(var who): highest initiative > 0; ties go to a fresh d100, an equal roll to the later member
export async function NextToAct(who) {
  let best = 0, bestRoll = 0;                                            // 2f00:01b1 / 01b5
  for (let c = G.PartyList; c; c = c.next) {                             // 2f00:01b9 / 01c5
    const roll = await X.Roll(1, 100);                                   // 2f00:01d0
    const ini = sb(CB(c)[3]);
    if (best < ini) bestRoll = roll;                                     // 2f00:01db .. 01e8
    if (best <= ini && bestRoll <= roll) { best = ini; who.v = c; bestRoll = roll; }   // 2f00:01de .. 0225
  }
  if (best === 0) who.v = null;                                          // 2f00:0240 / 0253
}

// 2F00:026B TakeTurn(c)
export async function TakeTurn(c) {
  const cb = CB(c);
  cb[0x0F] = 0; cb[0x12] = 0; cb[7] = 0;                                 // 2f00:0271 .. 0286
  await X.CallEffectHooks(7, c);                                         // 2f00:0298
  if (sb(cb[3]) > 0) {                                                   // 2f00:02a6
    if (cb[3] === 0x14) cb[3] = 0x13;                                    // 2f00:02b8 / 02c7
    G.SelectedChar = c;                                                  // 2f00:02d4
    G.combat_Visible = (c.b[0x197] === 0 || IsVisible(c, false)) ? 1 : 0;   // 2f00:02e0 .. 0303
    FocusCombatant(c, 2, true);                                          // 2f00:0306
    await X.RecalcItems(c);                                              // 2f00:0317
    G.combat_Shown = 1; await X.DrawCharacterSummary(c);                 // 2f00:0322 / 032d
    await X.CallEffectHooks(0x0F, c);                                    // 2f00:0332
    if (cb[0] === 0) await X.CallEffectHooks(0x15, c);                   // 2f00:0340 / 034e new
    if (sb(cb[3]) > 0) {                                                 // 2f00:035c
      if (c.b[0x198] === 0) await PlayerTurn(c); else await X.AiCombatTurn(c);   // 2f00:036b / 0383 / 0376
    }
    RedrawSquare(CombatantCol(c), CombatantRow(c));                      // 2f00:038d .. 03a5
  }
}

// 2F00:03D5 PlayerTurn(c)
export async function PlayerTurn(c) {
  const cb = CB(c);
  if (c.b[0x196] === 0) { await X.ClearCombatantActionFlags(c); return; }   // 2f00:03db / 03e6
  if (cb[0] !== 0) {                                                     // 2f00:03e9 queued spell
    const s = cb[0]; cb[0] = 0;                                          // 2f00:03f7 / 0405
    const done = { v: false };
    await X.CastSpell(s, 0, 1, done);                                    // 2f00:0411
    await X.ClearCombatantActionFlags(c);                                // 2f00:0425
    return;
  }
  const done = { v: false };                                             // 2f00:0436
  while (!done.v) {                                                      // 2f00:043a
    const key = { v: '\0' };
    await CombatMenu(c, key);                                            // 2f00:044f
    const k = key.v;
    if (!G.menu_Ext) {                                                   // 2f00:0452
      switch (k) {                                                       // 2f00:045c
        case 'Q':                                                        // 2f00:0463
          SetQuick(c); ClearMenuLine(); await FlushGameKeys(); await Delay(200); done.v = true;   // 2f00:046a .. 0480
          await X.AiCombatTurn(c);                                       // 2f00:0484
          break;
        case 'M': await MoveAttack(c, ' ', done); break;                 // 2f00:04a5
        case 'V':                                                        // 2f00:04af
          await X.ViewMenu(done); await X.CalcAttacks(c);                // 2f00:04b4 / 04bf
          if (!done.v) await X.ov24_2E05();                              // 2f00:04ca
          break;
        case 'A': { const tgt = { v: null }; await X.SelectTarget(c, 0xFF, 1, 0, 1, done, tgt); break; }   // 2f00:04f2
        case 'U':                                                        // new: the items menu
          G.menu_Sel = 2; await X.ItemsMenu(done); await X.CalcAttacks(c);   // 2f00:0508 / 0513
          if (!done.v) await X.ov24_2E05();                              // 2f00:051e
          break;
        case 'C': await X.BeginCast(0, 0, done); break;                  // 2f00:0535
        case 'T': await X.TurnUndead(c); done.v = !!(await X.ClearCombatantActionFlags(c)); break;   // 2f00:0546 / 0551
        case 'D': await DoneMenu(c, done); break;                        // 2f00:056b
        case ' ':                                                        // 2f00:0570 take back control of the PCs
          for (let p = G.PartyList; p; p = p.next) if (p.b[0xF7] < 0x80) p.b[0x198] = 0;   // 2f00:0580 .. 059f
          break;
      }
    } else if ('HPMKGOQI'.includes(k)) await MoveAttack(c, k, done);     // 2f00:05b1 .. 05e4 keypad: move at once
    else if (k === '2') {                                                // 2f00:05ea Alt-M
      G.MagicOn = G.MagicOn ? 0 : 1;                                     // 2f00:05ee .. 05fb
      await X.ShowTimedBottomMessage(G.MagicOn ? 'Magic On' : 'Magic Off');   // 2f00:0614 / 062a
    } else if (k === '\x10') {                                           // 2f00:0632 Alt-Q: quick for everyone
      cb[3] = 0x14;                                                      // 2f00:0636
      for (let p = G.PartyList; p; p = p.next) SetQuick(p);              // 2f00:0643 .. 0664
      ClearMenuLine(); await Delay(200); done.v = true;                  // 2f00:0673 / 067c / 0681
    } else if (k === '-') {                                              // 2f00:0687 Alt-X
      if (await X.GodsIntervene()) { FocusCombatant(c, 3, false); done.v = true; }   // 2f00:068b .. 06a5
      else await X.ShowTimedBottomMessage("That doesn't work");          // 2f00:06ba
    }
    if (!done.v) { FocusCombatant(c, 2, true); G.combat_Shown = 1; await X.DrawCharacterSummary(c); }   // 2f00:06bf .. 06e1
  }
}

// 2F00:076C CombatMenu(c, var key)
export async function CombatMenu(c, key) {
  const cb = CB(c);
  let opts = '';                                                         // 2f00:0773
  if (cb[6] !== 0) opts += 'Move ';                                      // 2f00:0777
  opts += 'View Aim ';                                                   // 2f00:07ae
  if (c.b[0x14C] !== 0) opts += 'Use ';                                  // 2f00:07d6
  let any = false;                                                       // 2f00:0809
  for (let i = 0; i <= 0x53; i++) if (c.b[0x1E + i] !== 0) any = true;   // 2f00:0816 .. 0827
  if (any && cb[1] !== 0 && view.mem(0x4BE5) === 0) opts += 'Cast ';     // 2f00:082b .. 0875
  if (sb(c.b[0x109]) > 0 || (sb(c.b[0x111]) > 0 && await X.DualClassActive(c)))   // 2f00:087a .. 0896
    if (cb[0x11] === 0) opts += 'Turn ';                                 // 2f00:089f
  opts += 'Quick Done';                                                  // 2f00:08d6
  let k;
  do {
    hooks.emit('combatTurn', () => ({ ...hooks.state.combatant(c), menu: opts.trim() }));   // Plus (plus request #17)
    const m = await HorizontalMenu('', opts, 13, 10, 15, true, false);   // 2f00:0926
    k = m.key;
    if (m.ext && !EXT_OK.has(k)) k = '\0';                               // 2f00:0931 .. 094a
  } while (!EXIT_SET.has(k));                                            // 2f00:0951 / 095d
  key.v = k;
  ClearMenuLine();                                                       // 2f00:0964
}

// 2F00:0997 EndOfRound(var over)
export async function EndOfRound(over) {
  await X.AdvanceClock(1, 1);                                            // 2f00:099d
  G.CombatRound = (G.CombatRound + 1) & 0xFF;                            // 2f00:09a8
  await X.CalcEnemyHpPct();                                              // 2f00:09ac
  for (let c = G.PartyList; c; c = c.next) {                             // 2f00:09b1 .. 0a17
    await X.CallEffectHooks(0x13, c);                                    // 2f00:09c9
    await X.StinkingCloudCheck(c, 0);                                    // 2f00:09d7
    if (c.b[0x195] === 5) {                                              // 2f00:09e5 dying
      CB(c)[0x0E] = (CB(c)[0x0E] + 1) & 0xFF;                            // 2f00:09f0
      if (CB(c)[0x0E] > 9) c.b[0x195] = 6;                               // 2f00:09fc / 0a0b
    }
  }
  if (await X.BandageDying(0)) await X.ShowTimedBottomMessage('Your Teammate is Dying');   // 2f00:0a29 .. 0a44
  await X.CountActiveSides();                                            // 2f00:0a49
  FocusSquare(sx8(G.cm_Map.b[2]) + 3, sx8(G.cm_Map.b[3]) + 3, 0xFF, 8);  // 2f00:0a4e .. 0a6e
  const act = G.side_ActiveCount || [0, 0];
  if (act[0] === 0 || act[1] === 0 || G.combat_MaxRounds <= G.CombatRound) over.v = true;   // 2f00:0a73 .. 0a8a new limit
  if (act[0] !== 0 && act[1] === 0 && G.DemoMode === 0)                  // 2f00:0a91 .. 0a9f
    if (await AskYesNo('Continue Battle:', 13, 10, 15) === 'Y') over.v = false;   // 2f00:0aa6 .. 0ac7
}

// 2F00:0B06 MoveAttack(c, key, var done)
export async function MoveAttack(c, key, done) {
  const cb = CB(c);
  const savedMove = cb[6], savedFacing = cb[9];                          // 2f00:0b0d / 0b1c
  const savedCol = CombatantCol(c), savedRow = CombatantRow(c);          // 2f00:0b2b / 0b39
  let k = key; done.v = false; let dir = 8;                              // 2f00:0b44 .. 0b50
  while (cb[6] > 1 && k !== '\0' && k !== '\r') {                        // 2f00:0b58 .. 0b77
    ClearRectangle(0x18, 0x18, 0x27, 0x18);                              // 2f00:0b7c
    if (k === ' ') {                                                     // 2f00:0b8d
      hooks.emit('combatCursor', () => ({ mode: 'move', ...hooks.state.combatant(c), col: CombatantCol(c), row: CombatantRow(c), moveLeft: cb[6] >> 1 }));   // Plus (#17)
      const m = await HorizontalMenu('Move/Attack, Move Left = ' + (await X.ByteToStr(cb[6] >> 1)) + ' ', '', 10, 10, 15, true, false);   // 2f00:0bf6
      k = m.key; G.dummy_Done = m.ext ? 1 : 0;
    }
    if (k === '\0') {                                                    // 2f00:0bfe Esc: undo the move
      cb[6] = savedMove;                                                 // 2f00:0c08
      RestoreTerrain(0, 0, CombatantIndex(c));                           // 2f00:0c29
      done.v = !PlaceCombatant(c, savedCol, savedRow, false);            // 2f00:0c4e
      FocusSquare(CombatantCol(c), CombatantRow(c), 0, 8);               // 2f00:0c72
      cb[9] = savedFacing; dir = 8;                                      // 2f00:0c77 / 0c86
    } else dir = { H: 0, I: 1, M: 2, Q: 3, P: 4, O: 5, K: 6, G: 7 }[k] ?? 8;   // 2f00:0c90 .. 0cdc
    if (dir < 8) {                                                       // 2f00:0ce0
      ShowCombatant(c, dir, 0, false);                                   // 2f00:0ce9
      const occ = { v: 0 }, tile = { v: 0 }, h1 = { v: 0 }, h2 = { v: 0 };
      ProbeMove(c, dir, occ, tile, h1, h2);                              // 2f00:0cfe
      if (occ.v !== 0) await AttackTarget(c, G.cb_Char[occ.v], done);   // 2f00:0d21 / 0d27
      else if (tile.v === 0) {                                           // 2f00:0d4c off the field
        const a = await AskYesNo('Flee:', 13, 10, 15);                   // 2f00:0d61
        if (a === 'Y') done.v = !!(await X.Flee(c));                     // 2f00:0d73
        else if (a === 'N') done.v = false;                              // 2f00:0d8a
      } else {
        let cost = (dir & 1) ? terrCost(tile.v) * 3 : terrCost(tile.v) * 2;   // 2f00:0d94 .. 0dc1
        cost &= 0xFF;                                                    // byte arithmetic
        if (terrCost(tile.v) === 0xFF) cost = 0xFF;                      // 2f00:0dcc / 0dde
        if (cb[6] < cost) await X.ShowTimedBottomMessage("can't go there");   // 2f00:0de2 .. 0e02
        else {
          await X.AttacksOfOpportunity(c, dir);                          // 2f00:0e0a
          if (c.b[0x196] === 0) done.v = !!(await X.ClearCombatantActionFlags(c));   // 2f00:0e19 / 0e24
          else {
            if (cb[6] !== 0) await X.StepCombatant(c, dir);              // 2f00:0e37 / 0e46
            if (c.b[0x196] === 0) done.v = !!(await X.ClearCombatantActionFlags(c));   // 2f00:0e55 / 0e60
            await X.StinkingCloudCheck(c, 1);                            // 2f00:0e71
            if (await X.IsHelpless(c)) done.v = !!(await X.ClearCombatantActionFlags(c));   // 2f00:0e7f / 0e8e
          }
        }
      }
    }
    if (k !== '\0' && k !== '\r') k = ' ';                               // 2f00:0e9f .. 0eab
  }
  if (cb[6] < 2) cb[6] = 0;                                              // 2f00:0eb2 / 0ec1
}

// 2F00:0EE9 AttackTarget(c, target, var done)
export async function AttackTarget(c, target, done) {
  if (await X.WeaponIsRanged(c) && !await X.ov24_305B(c)) { await X.ShowTimedBottomMessage('Not with that weapon'); return; }   // 2f00:0eef .. 0f1c
  if (await X.ConfirmAttackAlly(c, target)) {                            // 2f00:0f23 / 0f36
    c.combat.target = target;                                            // 2f00:0f38 .. 0f49 +0Ah
    if (await X.FighterSweep(c, target)) done.v = true;                  // 2f00:0f4d .. 0f62
    else { await X.FaceAttacker(c, target); await X.Attack(c, target, 0, null, done); }   // 2f00:0f6b / 0f7c
  }
}

// 2F00:0FE8 DoneMenu(c, var done)
export async function DoneMenu(c, done) {
  done.v = false; let opts = '';                                         // 2f00:0fef / 0ff2
  if (!await X.WeaponIsRanged(c) || await X.ov24_305B(c)) opts += 'Guard ';   // 2f00:0ffa .. 103b
  opts += 'Delay Quit ';                                                 // 2f00:1040
  if (await X.BandageDying(0)) opts += 'Bandage ';                       // 2f00:1068 .. 1097
  opts += 'Speed Exit';                                                  // 2f00:109c
  let key = ' ';                                                         // 2f00:10c4
  while (key !== '\0' && key !== 'E' && !done.v) {                       // 2f00:10c8 .. 10db set CS:0FC8
    const m = await HorizontalMenu('', opts, 13, 10, 15, false, false);  // 2f00:110f
    key = m.key; G.dummy_Done = m.ext ? 1 : 0;
    switch (key) {
      case 'G': done.v = !!(await X.SetGuarding(c)); break;              // 2f00:1117 / 111e
      case 'D': CB(c)[3] = 1; done.v = true; break;                      // 2f00:1131 .. 1142
      case 'Q': done.v = !!(await X.ClearCombatantActionFlags(c)); break;   // 2f00:114b / 114f
      case 'B': done.v = !!(await X.BandageDying(1)); done.v = !!(await X.ClearCombatantActionFlags(c)); break;   // 2f00:1162 .. 1174
      case 'S': await CombatGameSpeedMenu(); break;                      // 2f00:118b
    }
  }
}

// 2F00:11DF CombatGameSpeedMenu
export async function CombatGameSpeedMenu() {
  let key = ' ';                                                         // 2f00:11e2
  while (key !== '\0' && key !== 'E') {                                  // 2f00:11e6 .. 11fa set CS:1198
    const prompt = 'GameSpeed (' + (await X.ByteToStr(G.GameSpeed)) + ') :';   // 2f00:11fd .. 1234
    let opts = ' ';                                                      // 2f00:121c
    if (G.GameSpeed < 9) opts += 'Slower ';                              // 2f00:124c
    if (G.GameSpeed !== 0) opts += 'Faster ';                            // 2f00:127b
    opts += 'Exit';                                                      // 2f00:12aa
    const m = await HorizontalMenu(prompt, opts, 13, 10, 15, false, false);   // 2f00:12d2
    key = m.key; G.dummy_Done = m.ext ? 1 : 0;
    if (key === 'S') G.GameSpeed = (G.GameSpeed + 1) & 0xFF;             // 2f00:12f8 / 12ff
    else if (key === 'F') G.GameSpeed = (G.GameSpeed - 1) & 0xFF;        // 2f00:1305 / 1309
  }
}

// 2F00:1314 SetQuick(c)
export function SetQuick(c) {
  c.b[0x198] = 1;                                                        // 2f00:1317
  const t = c.combat.target;
  if (t && t.b[0x197] === c.b[0x197]) c.combat.target = null;            // 2f00:1320 .. 135b
}

// 2F00:0000 ov08_LoadDeps / 2F00:1365 ov08_init: empty.
