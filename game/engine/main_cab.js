// main_cab.js — the Curse boot (engine.id 'cab-1.0' entry; profile game/profiles/cab.json engine.entryModule).
// Same order as Pool's engine/main.js MainProgram: profile -> manifest -> BYOC (imported copy / dev import / import screens)
// -> input -> DS image -> the program body (areas/startup.js MainProgram 0000:002F). Every shared engine module is configured
// from the profile here (BUILD_PLAN §1a: profile parameters + PER-n adapter switches). Gold Box Plus is not mounted yet
// (BUILD_PLAN §6: after the faithful build passes its regression table), so the Plus hooks are switched off.

import { Display } from './display.js';
import { state as pic, configurePictures } from './pictures.js';
import { attachKeyboard, attachPointer, startGamepadPolling, keyState, script, ReadGameKey, gamepad, setInputPauseGate } from './input.js';
import { useByoc, daxConfig } from './dax.js';
import { params } from './tp.js';
import { setSpeedFactor } from './timer.js';
import { G, initState, configureState } from './state.js';
import { configureFiles } from './files.js';
import { dev } from './dev.js';
import { installErrorTrap, reportError, errorKeys } from './errors.js';
import { PlayOrStopSound, soundKey } from './audio_cab.js';
import { hooks } from '../plus/hooks.js';

async function optionalImport(path) {
  try { return await import(path); } catch (e) {
    if (!/Failed to fetch|Cannot find|404|error loading|Importing a module script failed/i.test(String(e && e.message))) console.warn(path, e);
    return null;
  }
}

// BYOC boot (docs/BYOC.md §3, §6), as Pool: imported copy / session -> dev import (serve.py --dev) -> the import screens
// GBP W8 (plus request #11, Pool hooks request #16): `hooks.engine.save(key)` / `.load(key)` = the original SaveGame
// 4300:3EDD / LoadGame 4300:3748 with a preset slot letter K..Z (Plus: Q quick save, X / Y / Z autosave; the player's menus
// offer A..J only, so a Plus save never shows up there or overwrites one of the player's games).
// save: only while the explore menu waits (hooks.safePointArmed, ecl_cab.js gameLoop); input is paused while it writes.
//   SaveGame draws only on row 24 (ClearMenuLine + 'Saving...Please Wait'), which is put back, and it writes live cells
//   before the file (GameSpeed VM 4B00 +1F8h, options +1FEh, data set 7C00 +624h = VM 7F12; GameSaved; ImportSource):
//   the file gets them as the original writes them, the live values are put back, so an autosave never changes the game.
// load: a job for the explore loop's safe point (ecl_cab.js plusSafePoint): the party list is emptied (as at the top
//   menu), LoadGame reads the slot, the top menu's Begin for a resumed game is done (4800:05f3 .. 060b), and the game loop
//   starts again; its areaEntered then carries `plusLoad: <letter>`, so an autosave on area entry can skip the entry its
//   own quick load caused (PLUS_LAYER.md trap).
let plusBusy = false;
const jobs = [];                                                       // Plus jobs for the explore loop's safe point (#11, #13)
function installPlusSaves() {
  const wanted = hooks.safePointWanted, take = hooks.takeSafePoint.bind(hooks);
  hooks.safePointWanted = () => (hooks.enabled && hooks.safePointArmed && jobs.length > 0) || wanted();
  hooks.takeSafePoint = () => { const p = take(); return jobs.length ? { ...(p || {}), job: jobs.shift() } : p; };
  const slot = (key) => { key = String(key || '').toUpperCase(); if (!/^[K-Z]$/.test(key)) throw new Error('Plus save slots are K..Z (A..J belong to the player)'); return key; };
  hooks.engine = {
    async save(key) {
      const k = slot(key);
      if (!hooks.enabled) throw new Error('Plus is off');
      if (!hooks.safePointArmed || plusBusy) throw new Error('not at the explore menu');
      const { SaveGame } = await import('../areas/engine_ov16.js');
      const d = pic.display, ROW = 24 * 8 * 320, line = d.pix.slice(ROW, ROW + 8 * 320);
      const m4B = G.ecl_Mem4B00, m7C = G.ecl_Mem7C00;
      const live = [m4B[0x1F8 >> 1], m4B[0x1FE >> 1], m7C[0x624 >> 1], G.GameSaved, G.ImportSource];
      plusBusy = true;
      try { await SaveGame(k); }
      finally {
        [m4B[0x1F8 >> 1], m4B[0x1FE >> 1], m7C[0x624 >> 1], G.GameSaved, G.ImportSource] = live;
        d.pix.set(line, ROW); d.touch(); plusBusy = false;
      }
      return true;
    },
    load(key) {
      const k = slot(key);
      return new Promise((resolve, reject) => {
        if (!hooks.enabled) { reject(new Error('Plus is off')); return; }
        jobs.push(async () => {
          try {
            const { LoadGame } = await import('../areas/engine_ov16.js');
            const { FrameExplore } = await import('./text.js');
            const { ClearMenuLine } = await import('./menus_cab.js');
            const head = G.PartyList, sel = G.SelectedChar;
            G.PartyList = null; G.SelectedChar = null;
            if ((await LoadGame(k)) === false) { G.PartyList = head; G.SelectedChar = sel; throw new Error(`no saved game ${k}`); }
            if (G.ecl_Mem4B00[0x1E4 >> 1] === 0) FrameExplore();     // the top menu's Begin for a resumed game, 4800:05f3 .. 060b
            ClearMenuLine();
            G.ecl_Mem7C00[0x550 >> 1] = 0;
            G.PlusLoad = k;                                           // read (and cleared) by the next areaEntered
            resolve(true); return 'restart';
          } catch (e) { reject(e); return null; }
        });
      });
    },
  };
}

// GBP W11 (plus request #13): `hooks.dev` — dev-only state entry for the cheats / scenario pages. It exists only with
// ?dev=1 or STING and only while Plus is on: `null` in player mode and in original mode. Every call returns a promise.
//   createCharacter(spec)  the real CreateCharacter 4800:0782 with the spec in place of the menu picks (engine_ov17_create.js
//                          `spec`), then gold / hp / cheat levels; runs at once (top menu or explore), the screen is put back
//   setMember(i, {...}), warp({...}), setFlag(addr, v), setClock([7])   jobs at the explore loop's safe point (#11)
//   startScenario({...})   at the explore safe point (a job) or at the top menu (the party set, then 'B' Begin is typed)
let devApi = null;
function jobAt(fn) {
  return new Promise((resolve, reject) => {
    jobs.push(async (vm) => { try { const r = await fn(vm); resolve(true); return r; } catch (e) { reject(e); return null; } });
  });
}
function installDevHooks() {
  const wrW = (b, o, v) => { b[o] = v & 0xFF; b[o + 1] = (v >> 8) & 0xFF; };
  const X = async () => (await import('../areas/view_link.js')).X;
  const atTopMenu = () => hooks.regions().some((r) => r.id === 'hmenu' && r.draw && r.draw.prompt === 'Choose a function ');
  async function partyFrom(records) {                                  // as LoadGame 4300:3ae8 .. 3c87 builds the party
    const x = await X(), { newChar } = await import('./state.js');
    G.PartyList = null; G.SelectedChar = null; G.ecl_Mem7C00[0x33E] = 0;   // VM 7F3E party size: AddToParty counts again
    for (const r of records) { const c = newChar(); c.b.set(Uint8Array.from(r).subarray(0, 0x1A6)); await x.AddToParty(c); }
    for (G.SelectedChar = G.PartyList; G.SelectedChar; G.SelectedChar = G.SelectedChar.next)
      if (G.SelectedChar.b[0xF7] < 0x80) await x.LoadCharacterIcon(1);
    G.SelectedChar = G.PartyList;
  }
  async function place(vm, { dataset = null, block = null, x, y, facing = 0 }) {   // the NEW_ECL way (op20 2200:0BBB)
    const h = vm.host, newDs = dataset !== null && dataset !== G.DataSet;
    if (newDs) G.DataSet = dataset & 0xFF;
    G.party_MapX = x & 0xFF; G.party_MapY = y & 0xFF; G.party_Dir = (facing & 3) * 2;
    if (newDs || (block !== null && block !== G.ecl_Block)) {
      vm.setM0(0x4BF2, G.ecl_Block); G.ecl_Block = (block ?? G.ecl_Block) & 0xFF;
      await vm.loadEclBlock(G.ecl_Block); vm.initVM();
      G.ecl_Restart = 1; G.enc_Shown = [false, false];
      await vm.runAfterNewBlock();
    } else {
      G.party_CellAttr = await h.GetCellAttr(G.party_MapX, G.party_MapY);
      G.party_Ahead = await h.GetWallType(G.party_MapX, G.party_MapY, G.party_Dir);
      G.view_Redraw = 1; await h.RefreshView();
    }
  }
  const api = {
    async createCharacter(spec) {
      if (!spec || !spec.name) throw new Error('createCharacter: spec.name is required');
      const { CreateCharacter } = await import('../areas/engine_ov17_create.js');
      const d = pic.display, screen = d.pix.slice(), sel = G.SelectedChar, x = await X();
      try {
        const ch = await CreateCharacter(spec);
        const b = ch.b;
        if (spec.cheat && Array.isArray(spec.levels)) {                // over the legal record, then the level stats
          for (let cls = 0; cls <= 7; cls++) if ((spec.levels[cls] | 0) > 0) b[0x109 + cls] = spec.levels[cls] & 0xFF;
          G.SelectedChar = ch; await x.UpdateLevelStats(ch); G.SelectedChar = sel;
        }
        if (spec.gold !== undefined && spec.gold !== null) wrW(b, 0xFB + 6, spec.gold);   // money word 3 = gold
        if (spec.hp !== undefined && spec.hp !== null) {
          if (spec.hp > b[0x78] && !spec.cheat) throw new Error(`createCharacter: hp ${spec.hp} > rolled maximum ${b[0x78]} (use cheat)`);
          if (spec.hp > b[0x78]) b[0x78] = spec.hp & 0xFF;
          b[0x1A4] = spec.hp & 0xFF;
        }
        return b.slice();
      } finally { G.SelectedChar = sel; d.pix.set(screen); d.touch(); }
    },
    setMember(i, { hp, gold, cls, level, cheat } = {}) {
      return jobAt(async () => {
        let c = G.PartyList; for (let k = 0; k < i && c; k++) c = c.next;
        if (!c) throw new Error(`setMember: no member ${i}`);
        const b = c.b;
        if (hp !== undefined) {
          if (hp > b[0x78] && !cheat) throw new Error(`setMember: hp ${hp} > maximum ${b[0x78]} (use cheat)`);
          if (hp > b[0x78]) b[0x78] = hp & 0xFF;
          b[0x1A4] = hp & 0xFF;
        }
        if (gold !== undefined) wrW(b, 0xFB + 6, gold);
        if (cls !== undefined && level !== undefined) {
          if (!cheat) throw new Error('setMember: a level change is a cheat (cheat: true)');
          b[0x109 + (cls & 7)] = level & 0xFF;
          const x = await X(), sel = G.SelectedChar; G.SelectedChar = c; await x.UpdateLevelStats(c); G.SelectedChar = sel;
        }
      });
    },
    warp(w) { return jobAt((vm) => place(vm, w)); },
    setFlag(addr, value) { return jobAt((vm) => vm.setMem(addr, value)); },
    setClock(cells) { return jobAt((vm) => { for (let i = 0; i < 7; i++) vm.setM0(0x4BC6 + i, cells[i] | 0); }); },
    async startScenario({ records, dataset = 2, block = 1, x, y, facing = 0, flags = [], clock = null }) {
      if (!Array.isArray(records) || !records.length) throw new Error('startScenario: records needed');
      const setup = async (vm) => {
        await partyFrom(records);
        for (const [a, v] of flags) await vm.setMem(a, v);
        if (clock) for (let i = 0; i < 7; i++) vm.setM0(0x4BC6 + i, clock[i] | 0);
        G.DataSet = dataset & 0xFF; G.ecl_Block = block & 0xFF; vm.setM0(0x4BF2, block & 0xFF);
        G.party_MapX = x & 0xFF; G.party_MapY = y & 0xFF; G.party_Dir = (facing & 3) * 2;
        G.Resuming = 0;                                                // gameLoop loads the block (2200:3802)
      };
      if (hooks.safePointArmed) return jobAt(async (vm) => { await setup(vm); return 'restart'; });
      if (!atTopMenu()) throw new Error('startScenario: only at the top menu or the explore menu');
      await setup((await import('../areas/ecl_host.js')).bindEclHost());
      script.keys.push([0x42, 0x30]);                                  // 'B' Begin, typed into the waiting top menu
      return true;
    },
  };
  devApi = api;
  Object.defineProperty(hooks, 'dev', { configurable: true, get: () => (hooks.enabled ? devApi : null) });
}

async function openGameFiles(byoc) {
  try {
    if (byoc.sessionActive() || await byoc.isImported()) { if (!byoc.sessionActive()) await byoc.preload(); useByoc(byoc.get); return true; }
    if (await byoc.devImport()) { useByoc(byoc.get); return true; }
    const ui = await optionalImport('../byoc/ui/byoc-ui.js');
    if (ui && ui.ensureGameFiles) {
      await ui.ensureGameFiles(byoc);
      if (byoc.sessionActive() || await byoc.isImported()) { if (!byoc.sessionActive()) await byoc.preload(); useByoc(byoc.get); return true; }
    }
  } catch (e) { console.warn('BYOC: ' + (e && e.message)); throw e; }
  return false;
}

// 06EA:0000 TerminateGame (Curse): SoundDevice restored, sound shut down, the start-up video mode back, the debug log closed,
// the BIOS keyboard flags restored, Halt(0). Browser: the DOS text screen, then the program body ends ('TerminateGame').
async function TerminateGameCab() {
  G.SoundDevice = G.SoundDeviceSaved ?? G.SoundDevice;          // 06ea:0006
  await PlayOrStopSound(0xFF);                                  // 06ea:000c
  pic.display.setTextMode();                                    // 06ea:0015 / 0020
  if (G.DebugFlag) G.DebugLog = null;                           // 06ea:002d  Close(DebugLog)
  window.__screenReady = true; window.__terminated = true;      // a stopped program is the final screen for headless runs
}

// 06EA:013C .. 021E the Curse key hooks of ReadGameKey: ^S sound; STING ^D debug log, ^Z effect dump, ^C terminate
async function keyHook(ch) {
  if (ch === '\x13') await soundKey();                          // 06ea:013c
  if (params.sting) {                                           // 06ea:017e
    if (ch === '\x04') {                                        // 06ea:019c
      G.DebugFlag = G.DebugFlag ? 0 : 1;                        // 06ea:01a3
      G.DebugLog = G.DebugFlag ? [] : null;                     // 06ea:01b3 / 01d5  'debug.txt' (kept in memory, also console)
    } else if (ch === '\x1a' && G.DebugFlag) {                  // 06ea:01e1  ^Z: one line per effect of every member
      for (let c = G.PartyList; c; c = c.next)
        for (let e = c.effects; e; e = e.next) {
          const name = String.fromCharCode(...c.b.subarray(1, 1 + c.b[0]));
          const line = `who: ${name}  sp#: ${e.b[0]}`;           // 06ea:0081 .. 00c1
          G.DebugLog.push(line); console.log('[debug.txt] ' + line);
        }
    } else if (ch === '\x03') {                                 // 06ea:021e
      const { TerminateGame } = await import('./input.js');
      await TerminateGame();
    }
  }
}

export async function MainProgram(canvas, { profile } = {}) {
  pic.display = new Display(canvas);
  errorKeys.prefix = 'cab';
  installErrorTrap();
  try {
    if (!profile) profile = await (await import('../plus/games.js')).loadProfile('cab');
    const { profileResource } = await import('../plus/games.js');
    // profile parameters and adapter switches (BUILD_PLAN §1a)
    configureState(profile.engine.state, profile.recordSizes);
    configurePictures({ symbolMax: 0x127, curseBlits: true, flushAfterLoad: true });   // cab: PER-7
    daxConfig.curse = true;                                                            // cab: PER-10
    daxConfig.onBeforeRead = () => { PlayOrStopSound(0); };                            //   0636:090c SndStop
    daxConfig.onAfterRead = () => { PlayOrStopSound(1); };                             //   0636:094e SndOutputOn
    if (dev.params.get('freshsaves') === '1')                                          // dev route: an empty save store (as the
      await new Promise((r) => { try { const q = indexedDB.deleteDatabase(profile.engine.storage.saves); q.onsuccess = q.onerror = q.onblocked = () => r(); } catch { r(); } });   //   DOSBox scratch copy)
    configureFiles(profile.engine.storage.saves);                                      // cab: PER-4
    if (dev.params.get('loadsaves') === '1') {                                         // dev route: serve.py --saves DIR files
      const { writeFile } = await import('./files.js');                                //   into the save store (a player's own
      const names = await (await fetch('/devsaves/?list')).json();                     //   SAVE folder at import, BYOC)
      for (const n of names) writeFile(n, new Uint8Array(await (await fetch('/devsaves/' + encodeURIComponent(n))).arrayBuffer()));
    }
    const byoc = await import('./byoc.js');
    byoc.configure(profile);                                                           // cab: PER-5
    const response = await fetch(profileResource(profile, profile.manifest.url));
    if (!response.ok) throw new Error('Profile manifest unavailable');
    byoc.setManifest(await response.json());
    keyState.curse = true; keyState.demo = () => !!G.DemoMode;                        // cab: PER-9
    keyState.onKeyHook = keyHook; keyState.onTerminateGame = TerminateGameCab;
    hooks.configure(profile.plus);                                                     // cab: param — record layout, VM cells
    hooks.enabled = false;                                                             // off until Plus is mounted below
    attachKeyboard(window);
    if (pic.display.canvas) attachPointer(pic.display.canvas);
    startGamepadPolling();
    keyState.sting = dev.sting; params.sting = dev.sting; params.second = dev.wooden ? 'Wooden' : '';
    setSpeedFactor(dev.fast || 1);
    script.keys = dev.keys.slice(); script.readyWhenIdle = dev.target === 'idle';
    window.E = { pic, G, dev, profile, input: await import('./input.js'), files: await import('./files.js') };   // dev inspection (headless runs)
    if (!(await openGameFiles(byoc))) throw new Error('The game files are not imported (BYOC).');
    const ui = await optionalImport('../byoc/ui/byoc-ui.js');                          // BY-5 gear + gamepad Menu
    if (ui && ui.mountSettings) { try { ui.mountSettings(byoc); } catch (e) { console.warn('BYOC ui: ' + e.message); } }
    // Gold Box Plus (plus request #5, cab-plus-shell; as Pool engine/main.js 152..159): the panel (F12 / gear / pad Menu)
    // and the always-on F12 hint outside the frame; the master switch "Play the original game" (?plus=0) = hooks off
    const { mountPlus } = await import('../plus/plus.js');
    const plus = mountPlus({ canvas: pic.display.canvas, input: gamepad, profile: profile.id, dev: dev.sting || dev.params.get('dev') === '1' });
    await plus.ready;
    if (dev.params.get('plus') === '0') await plus.setSetting('original', true);
    hooks.enabled = !plus.settings.original;
    window.addEventListener('por-plus-settings', () => { hooks.enabled = !plus.settings.original; });
    setInputPauseGate(() => plus.isOpen || plusBusy);                                 // + a Plus save writing (#11)
    installPlusSaves();                                                                //   quick / auto save entry (#11)
    try { (await import('../plus/click/index.js')).mountClickLayer({ canvas: pic.display.canvas, profile: profile.id }); }   // S3 click (W3)
    catch (e) { console.warn('Plus click layer: ' + e.message); }
    if (dev.sting || dev.params.get('dev') === '1') installDevHooks();                //   dev state entry (#13)
    else Object.defineProperty(hooks, 'dev', { configurable: true, value: null });   //   player mode: none
    await initState();                                                                 // DS image + global names
    if (dev.trace) G.TraceEcl = true;
    const startup = await import('../areas/startup.js');
    await startup.MainProgram(profile.engine.configuration);
  } catch (e) {
    if (e && e.fatalText !== undefined) {                        // original fatal data error (errors.js fatal)
      pic.display.setTextMode();
      pic.display.writeLn(e.fatalText);
      if (e.fatalWait) { script.readyWhenIdle = true; await ReadGameKey(); pic.display.setTextMode(); }
      window.__screenReady = true;
      return;
    }
    if (String(e && e.message) !== 'TerminateGame') reportError(e, 'MainProgram');
    throw e;
  }
}
