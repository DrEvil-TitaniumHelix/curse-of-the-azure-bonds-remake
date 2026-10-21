// main.js — program body (0000:0006 MainProgram) and start-up configuration (042B:00A4 InitConfiguration).

import { Display } from './display.js';
import { state as pic } from './pictures.js';
import { attachKeyboard, attachPointer, startGamepadPolling, keyState, script, TerminateGame, ReadGameKey, gamepad, setInputPauseGate } from './input.js';
import { useByoc } from './dax.js';
import { setRandSeed, params } from './tp.js';
import { setSpeedFactor } from './timer.js';
import { G, initState } from './state.js';
import { importSaveSet } from './files.js';
import { dev } from './dev.js';
import { installErrorTrap, reportError } from './errors.js';
import { ClearScreen, DrawText } from './text.js';
import { ResetSound, SetSoundTimerMode, toggleSound } from './audio.js';
import { InitGameState, ShowTitle, CodeWheelCheck, PartyCreationMenuM1 } from '../areas/startup.js';

// 042B:00A4 InitConfiguration: POOL.CFG lines 1 video, 2 sound, 3 data path, 4 save path, 5 flag 'F'. The file is written
// by an installer/starter (here the third-party CFG.EXE), not part of the game: the engine supplies the lines the build
// supports, as `cfg.exe EGA PCsound F` writes them (docs/BYOC.md §2).
export const POOL_CFG = 'E\r\nP\r\nC:\\POOLRAD\\\r\nC:\\POOLRAD\\SAVE\\\r\nF\r\n';
async function InitConfiguration() {
  const lines = POOL_CFG.split(/\r?\n/);                                    // 042B:0153 'Unable to find POOL.CFG': cannot happen
  // line 1 'E' -> EGA (the only mode built); line 2 sound: 'T' Tandy 0, 'P' speaker 1, else none 2 (042b:02c7)
  G.VideoMode = 1;                                                           // 042b:019b  'E': g_4A1E := 1 = EGA (fix request #a-8: was 0 = CGA)
  const s = (lines[1] || '')[0];
  G.SoundDevice = s === 'T' ? 0 : s === 'P' ? 1 : 2;
  ResetSound();                                                              // 042b:0302
  G.cfg_FullIntro = (lines[4] || '')[0] === 'F' ? 1 : 0;                    // 042b:036f
  G.DataDrive = (lines[2] || 'C')[0];                                       // line 3 data path: DataPath[1] (DS:547D) = drive letter of the disk prompt
}

// BYOC boot (docs/BYOC.md §3, §6): 1. the player's copy already imported (IndexedDB 'por-data') or served from memory for
// this tab (F7 session) -> use it; 2. dev mode (`serve.py --dev`) -> byoc.devImport() imports the local copy through the same
// pipeline, saves included; 3. the import screens BY-1..BY-5: game/byoc/ui/byoc-ui.js `ensureGameFiles(byoc)` (por-byoc-ui)
// when present; 4. the legacy /data/ route (until the screens replace it). Returns true when the game runs from byoc.
async function openGameFiles() {
  let byoc;
  try { byoc = await import('./byoc.js'); } catch (e) { console.warn('BYOC: ' + e.message); return false; }
  try {
    if (byoc.sessionActive() || await byoc.isImported()) { if (!byoc.sessionActive()) await byoc.preload(); useByoc(byoc.get); return true; }
    if (await byoc.devImport()) { useByoc(byoc.get); return true; }
    const ui = await optionalImport('../byoc/ui/byoc-ui.js');
    if (ui && ui.ensureGameFiles) {
      await ui.ensureGameFiles(byoc);
      if (byoc.sessionActive() || await byoc.isImported()) { if (!byoc.sessionActive()) await byoc.preload(); useByoc(byoc.get); return true; }
      return false;
    }
  } catch (e) { console.warn('BYOC: ' + (e && e.message)); }
  return false;                                                              // the legacy /data/ route
}

// 0899:0000 TerminateGame lives in input.js (engine request #qa-1)
const terminate = () => TerminateGame();

async function optionalImport(path) {
  try { return await import(path); } catch (e) {
    if (!/Failed to fetch|Cannot find|404|error loading/i.test(String(e && e.message))) console.warn(path, e);
    return null;
  }
}

export async function MainProgram(canvas, { profile } = {}) {
  pic.display = new Display(canvas);
  installErrorTrap();                                                        // owner P1: errors visible + kept (errors.js)
  try {
    if (!profile) profile = await (await import('../plus/games.js')).loadProfile('por');
    const { profileResource } = await import('../plus/games.js');
    const response = await fetch(profileResource(profile, profile.manifest.url));
    if (!response.ok) throw new Error('Profile manifest unavailable');
    (await import('./byoc.js')).setManifest(await response.json());
    await mainBody(profile);
  }
  catch (e) {
    if (e && e.fatalText !== undefined) {                                    // original fatal data error (#a-10, errors.js fatal)
      pic.display.setTextMode();                                             // RestorePreviousVideoMode
      pic.display.writeLn(e.fatalText);                                      // WriteLn(msg)
      if (e.fatalWait) { script.readyWhenIdle = true; await ReadGameKey(); pic.display.setTextMode(); }   // ReadGameKey; RestorePreviousVideoMode
      try { await TerminateGame(); } catch { /* Halt */ }
      return;
    }
    if (String(e && e.message) !== 'TerminateGame') reportError(e, 'MainProgram');
    throw e;
  }
}

// GBP W8 (hooks request #16): `hooks.engine.save(key)` / `.load(key)` — the original SaveGame 7500:1D58 / LoadGame
// 7500:1602 with a preset slot letter (Plus uses Q and X/Y/Z; the A..J menus never offer them).
// save: only while the explore menu waits (hooks.safePointArmed); input is paused while it writes, and the menu line
// (row 24, the only place SaveGame draws: ClearMenuLine + 'Saving...Please Wait') is put back afterwards, so the
// waiting menu looks unchanged. Only that row: the game may redraw the rest of the screen meanwhile. SaveGame also
// writes live state before writing the file (7500:1e8a..1f0f: wall-set slots m49 +3F4h..+3FEh, GameSpeed +1F8h,
// options +1FEh, data set m6B +624h = ECL 6E12) and sets GameSaved (7500:22a9): the file gets them as the original
// writes them, the live values are put back so an autosave never changes the game (GBP-BISECT runs: 6E12 et al.).
// load: a job for the explore loop's safe point (ecl.js gameLoop, GBP #14): the party list is emptied (as at the party
// menu, where it is empty), LoadGame reads the slot and the game loop restarts as after 7000:040b.
let plusBusy = false;
function installPlusSaves(hooks, vm, view) {
  const jobs = [];
  const wanted = hooks.safePointWanted, take = hooks.takeSafePoint.bind(hooks);
  hooks.safePointWanted = () => (hooks.enabled && hooks.safePointArmed && jobs.length > 0) || wanted();
  hooks.takeSafePoint = () => { const p = take(); return jobs.length ? { ...(p || {}), job: jobs.shift() } : p; };
  const slot = (key) => { key = String(key || '').toUpperCase(); if (!/^[K-Z]$/.test(key)) throw new Error('Plus save slots are K..Z (A..J belong to the player)'); return key; };
  hooks.engine = {
    async save(key) {
      const k = slot(key);
      if (!hooks.enabled) throw new Error('Plus is off');
      if (!hooks.safePointArmed || plusBusy) throw new Error('not at the explore menu');
      const { SaveGame } = await import('../areas/party_ov17.js');
      const d = pic.display, ROW = 24 * 8 * 320, line = d.pix.slice(ROW, ROW + 8 * 320);
      const m49 = vm.mem4900.slice(0xFC, 0x100), slots = vm.mem4900.slice(0x1FA, 0x200), ds = vm.mem6B00[0x312], saved = G.GameSaved;
      plusBusy = true;
      try { await SaveGame(vm, view, k); }
      finally {
        vm.mem4900.set(m49, 0xFC); vm.mem4900.set(slots, 0x1FA); vm.mem6B00[0x312] = ds; G.GameSaved = saved;
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
            const { LoadGame } = await import('../areas/party_ov17.js');
            const head = G.PartyHead, sel = G.SelectedChar;
            G.PartyHead = null; G.SelectedChar = null;
            if ((await LoadGame(vm, view, k)) === false) { G.PartyHead = head; G.SelectedChar = sel; throw new Error(`no saved game ${k}`); }
            resolve(true); return 'restart';
          } catch (e) { reject(e); return null; }
        });
      });
    },
  };
}

async function mainBody(profile) {
  attachKeyboard(window);
  if (pic.display.canvas) attachPointer(pic.display.canvas);              // mouse layer (input.js; injects keys only)
  startGamepadPolling();
  keyState.sting = dev.sting; params.sting = dev.sting;
  keyState.onTerminate = terminate;
  keyState.onSoundToggle = toggleSound;                                      // 0899:0068 ^S
  keyState.onDebugToggle = () => { G.DebugFlag = G.DebugFlag === 0 ? 1 : 0; };   // 0899:00c1 STING ^D: g_49F7 := Ord(g_49F7 = 0) (#a-1)
  setSpeedFactor(dev.fast || 1);
  script.keys = dev.keys.slice(); script.readyWhenIdle = dev.target === 'idle';
  window.E = { pic, G, dev };
  if (await openGameFiles()) {                                               // BYOC (docs/BYOC.md §3, §6)
    const ui = await optionalImport('../byoc/ui/byoc-ui.js');                 // BY-5 gear + gamepad Menu (byoc api #3)
    if (ui && ui.mountSettings) { try { ui.mountSettings(await import('./byoc.js')); } catch (e) { console.warn('BYOC ui: ' + e.message); } }
  }
  const { mountPlus } = await import('../plus/plus.js');
  const plus = mountPlus({ canvas: pic.display.canvas, input: gamepad, profile: profile.id, dev: dev.sting || dev.params.get('dev') === '1' });
  await plus.ready;
  if (dev.params.get('plus') === '0') await plus.setSetting('original', true);
  const { hooks } = await import('../plus/hooks.js');
  hooks.enabled = !plus.settings.original;
  window.addEventListener('por-plus-settings', () => { hooks.enabled = !plus.settings.original; });
  setInputPauseGate(() => plus.isOpen || plusBusy);                         // + a Plus save writing (W8 #16)
  try { (await import('../plus/click/index.js')).mountClickLayer({ canvas: pic.display.canvas }); }   // GBP W3 (gbp-click boot request)
  catch (e) { console.warn('Plus click layer: ' + e.message); }
  const registrations = {};
  for (const [name, file, method] of [
    ['games', 'games.js', 'registerGamesTab'], ['pedia', 'tabs/pedia.js', 'registerPediaTab'],
    ['map', 'tabs/map.js', 'registerMapTab'], ['journal', 'tabs/journal.js', 'registerJournalTab'],
    ['quests', 'tabs/quests.js', 'registerQuestsTab'], ['mods', 'tabs/mods.js', 'registerModsTab'],
    ['scenario', 'tabs/scenario.js', 'registerScenarioTab'], ['cheats', 'tabs/cheats.js', 'registerCheatsTab'],
  ]) {
    const module = await import('../plus/' + file);
    registrations[name] = module[method](plus, { profile: profile.id });
  }
  window.goldBoxPlusTabs = registrations;
  const { plusMods } = await import('../plus/mods/manager.js');               // GBP W9 (fix request #q-4): mod skins reach LoadDaxRecord
  hooks.setDaxResolver((name, id, raw) => plusMods.resolve(name, id, raw));  //   (hooks.daxResolver is null in original mode)
  try { await (await import('../plus/helpers/index.js')).startHelpers(plus, { profile: profile.id }); }   // GBP W8 (hooks request #17)
  catch (e) { console.warn('Plus helpers: ' + e.message); }
  await initState();                                                         // DS image + global names (engine request #1)
  if (dev.save) await importSaveSet(dev.save, dev.force);                    // ?save=<name>[&force=1] (testparty)
  if (dev.params.get('testparty') === '1')                                   // ?testparty=1: generate the test party (slot C) from the
    await (await import('../areas/testparty.js')).installTestParty();        //   player's own files (BYOC step 6, areas/testparty.js)
  if (dev.params.get('scenario') && !plus.settings.original) await (await import('../plus/cheats/scenario.js')).bootScenario(dev.params.get('scenario'));
  await InitConfiguration();
  await InitGameState();                                                     // 0000:00fd
  if (dev.params.get('throwtest') === '1') {                                 // acceptance test of the error trap
    if (dev.params.get('async') === '1') Promise.reject(new Error('throwtest: deliberate unhandled rejection'));
    else throw new Error('throwtest: deliberate engine error for the error trap (?throwtest=1)');
  }
  SetSoundTimerMode(0x64);                                                   // 5700:0464 (InitGameState)
  const res = await optionalImport('../areas/res_00ba.js');                  // engine request #4: unit init chain 0000:0074
  if (res && res.initRes00ba) await res.initRes00ba();
  await (await import('../areas/flow.js')).BindAllAreas();                  // engine request #qa-7: bind every area in order (CROSSREF §4c)
  if (dev.seed !== null) setRandSeed(dev.seed);
  if (!dev.sting) {                                                          // 0000:0102
    await ShowTitle(G.cfg_FullIntro);                                        // 0000:011d
    // 0000:0122 CodeWheelCheck — bypassed by default (BUILD_PLAN §2: as STING for the wheel); ?wheel=1 shows it
    if (dev.wheel && !(await CodeWheelCheck())) await terminate();
  }
  const ecl = await import('../areas/ecl_host.js');
  const vm = await ecl.bindEclHost();
  const view = await import('../areas/view.js');
  G.ecl_Mem4900 = vm.mem4900; G.ecl_Mem6B00 = vm.mem6B00; G.ecl_Mem9700 = vm.mem9700;   // engine request #3 (word arrays)
  installPlusSaves(hooks, vm, view);                                         // GBP W8 quick/auto save (hooks request #16)
  const party = await optionalImport('../areas/party.js');
  if (party && party.PartyCreationMenu) await party.PartyCreationMenu();     // 0000:0127 (build-party)
  else {
    const { LoadGame } = await import('../areas/party_ov17.js');
    const r = await PartyCreationMenuM1({
      L: async () => {                                                       // 7000:03ff
        await LoadGame(vm, view);                                            // 7000:0406
        if (G.game_Mode !== 0) { G.g_49F8 = 1; return 'begin'; }             // 7000:040b  a game was loaded
      },
      V: async () => {                                                       // 7000:0398
        const combat = await import('../areas/combat.js');
        await combat.ensureCombatBound();
        await combat.ViewMenu({ v: false });                                 // 7000:03a4  ViewMenu(turnUsed) (COMBAT ov19)
      },
      B: async () => {                                                       // 7000:043d
        if (G.PartyHead !== null) { G.game_Mode = 4; return 'begin'; }       // 7000:0450
      },
    });
    if (r === 'quit') await terminate();
  }
  view.SetBackdropColours(0x0B, 0, 7, 6);                                    // 0000:0138
  await ecl.EclGameLoop();                                                   // 0000:013d
  await terminate();                                                         // 0000:0142
}
