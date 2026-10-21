// ecl_host.js — binds the Curse ECL VM (engine/ecl_cab.js) to the engine and the area units (BUILD_PLAN §3 ECL row).
// Owner: cab-build-engine. The VM calls every routine outside ov02 / ov07-VM by its decode name; this host answers with the
// engine's own routines (text, menus, DAX, sound, frames, rune wheel) and otherwise with the areas' late-binding proxy
// (areas/view_link.js X: the first area module exporting the name). engine request #3: bindView({ mem, setMem, setEclPC,
// eclPC, vecB }) for the VIEW units.

import { G } from '../engine/state.js';
import { EclVM, HOST_METHODS } from '../engine/ecl_cab.js';
import { LoadDaxRecord, SetDataSet } from '../engine/dax.js';
import { DrawText, ClearMenuLine, DrawWrappedText, ClearTextRectangle, ShowBottomPromptAndReadKey, MessageDelay,
  ReadBottomLine, ReadWordNumber, DrawScreenFrame, FrameExplore } from '../engine/text.js';
import { AskYesNo } from '../engine/menus_cab.js';
import { Random } from '../engine/tp.js';
import { Delay } from '../engine/timer.js';
import { TerminateGame } from '../engine/input.js';
import { PlayOrStopSound } from '../engine/audio_cab.js';
import { LoadCombatIcon } from '../engine/tiles_cab.js';
import { dev } from '../engine/dev.js';
import { X, bind } from './view_link.js';
import { bindView, view as view30, GetPassage } from './view_ov30.js';
import { RuneWheelCheck } from './engine_ov03.js';
import { hooks } from '../plus/hooks.js';   // GBP W1: read-only state for Plus (hooks.state)

// engine routines the VM reaches (Curse signatures)
const ENGINE = {
  ClearMenuLine, DrawText, LoadDaxRecord, FrameExplore, DrawWrappedText, ClearTextRectangle, ShowBottomPromptAndReadKey,
  MessageDelay, ReadBottomLine, ReadWordNumber, DrawScreenFrame, AskYesNo, Delay, TerminateGame, PlayOrStopSound,
  LoadCombatIcon, SetDataSet,
  Random: (n) => Random(n),
  // 2200:3243 op 3C PROTECTION -> RuneWheelCheck; the flag (BUILD_PLAN §2a): bypass = as if answered (no screen)
  RuneWheelCheckOp3C: async () => { if (dev.wheelMode !== 'bypass') await RuneWheelCheck(dev.wheelMode); },
};
bind(ENGINE);   // the engine's Curse routines win over same-named exports elsewhere (view_link lists Pool's audio/menus)

let vm = null;
export function eclVM() { return vm; }

// the VM + its host; idempotent
export function bindEclHost() {
  if (vm) return vm;
  const host = new Proxy({}, {
    get(_, name) {
      if (name in ENGINE) return ENGINE[name];
      return X[name];                                                    // areas: by published name, unbound -> warn, 0
    },
  });
  vm = new EclVM(host);
  bindView({                                                             // engine request #3
    mem: (a) => vm.getMem(a),
    setMem: (a, v) => vm.setMem(a, v),
    setEclPC: (pc) => { vm.pc = pc; },
    eclPC: () => vm.pc,
    vecB: () => G.ecl_VecB,
  });
  G.ecl_VM = vm;
  hooks.bind({ G, vm, view: { map: view30.map, GetPassage } });         // GBP W1: hooks.state.* reads G, the VM memory, the 3D map (#10)
  return vm;
}

// 2200:3772 ecl_GameLoop (stub ov02 e1), called by MainProgram 0000:02a6
export async function ecl_GameLoop() { await bindEclHost().gameLoop(); }
// 2200:3073 ecl_CampCheck / 2200:3691 ecl_RunAfterNewBlock / 2C00:0380 LoadEclBlock / 2C00:01FC ecl_InitVM for other units
export async function ecl_CampCheck() { await bindEclHost().campCheck(); }
export async function ecl_RunAfterNewBlock() { await bindEclHost().runAfterNewBlock(); }
export async function LoadEclBlock(n) { await bindEclHost().loadEclBlock(n); }
export function ecl_InitVM() { bindEclHost().initVM(); }
export function ecl_GetMem(a) { return bindEclHost().getMem(a); }
export async function ecl_SetMem(a, v) { await bindEclHost().setMem(a, v); }

export { HOST_METHODS };
