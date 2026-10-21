// acceptance/trace.mjs (cab-build-engine; the owner 10/21: verify the LOGIC without screenshots) — the whole game in plain node,
// no browser: the real start-up (areas/startup.js MainProgram: titles, Play/Demo prompt, rune wheel, top menu, game loop)
// over the player's own files (read-only, BYOC through fs), the save store in memory, a seeded RandSeed, and a key route
// typed through the engine's own key script. At each checkpoint (the route segment is typed and the game waits) it dumps
// the position / block / view mode / clock / party / key VM cells and the Plus hook events of the segment (textPrinted,
// menuDrawn, listDrawn, flagSet, combatStart / combatEnd, areaEntered, journalRef, saves). Then it checks:
//   - every textPrinted (PRINT / PRINTCLEAR / VERTICAL MENU / ENCOUNTER) against the instruction at its address in the
//     decoded listing decode/ecl/scripts/ECL<ds>_<block>.ecl.txt (same opcode; a string operand = the same text);
//   - every flagSet of a script instruction against that instruction (the written cell is one of its memory operands);
//   - the saved files against the DOSBox saves of the same route (acceptance/local/saves/camp, local).
// Usage: node acceptance/trace.mjs [run1|run1-inn|run2|run2-g|all] -> acceptance/local/trace/<route>.json (full, local) and
// acceptance/reports/trace/<route>.json (summary: counts and states, committed)
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = process.env.CAB_DEV_DATA || join(ROOT, '..', 're-targets', 'goldbox', 'cotab', 'curazure');
const CAMP = join(ROOT, 'acceptance', 'local', 'saves', 'camp');
const LISTINGS = join(ROOT, 'decode', 'ecl', 'scripts');
const OUT = join(ROOT, 'acceptance', 'local', 'trace');               // local: the events quote the game's texts
const SUMMARY = join(ROOT, 'acceptance', 'reports', 'trace');      // committed: counts and states only
const which = process.argv[2] || 'all';

// ---- routes (keys as the dev ?keys= syntax; each segment ends at a checkpoint) ----------------------------------------
const TITLES = '{Space}{Space}{Space}{Space}Pa{Enter}';               // titles, P at the Play Demo prompt, rune wheel (any key)
const ALPHA = 'C{Enter}{Enter}{Enter}{Enter}NALPHA{Enter}EYYA{Enter}A{Esc}';
let SIX = ''; for (const n of ['ALPHA', 'BETA', 'GAMMA', 'DELTA', 'EPSI']) SIX += `C{Enter}{Enter}{Enter}{Enter}N${n}{Enter}EYY`;
SIX += 'C{End}{End}{End}{End}{End}{Enter}{Enter}{End}{End}{Enter}{Enter}NZETA{Enter}EYYA{Enter}A{End}A{End}A{End}A{End}A{End}A{Esc}';
const ROUTES = {
  // RUN-1 step 19 (= the DOSBox camp run): ALPHA, Begin, area map on / off, Encamp, Save B
  run1: { seed: 169084438, saves: false, segments: [
    ['top menu', TITLES], ['party of one', ALPHA], ['begin: start room 7,13 E', 'B{Enter}{Enter}'],
    ['area map on / off', 'AA'], ['camp', 'E'], ['save B', 'SB'] ], compare: ['SAVGAMB.DAT', 'CHRDATB1.SAV', 'CHRDATB1.FX'] },
  // RUN-1 steps 3..7: the party of six, the innkeeper (journal entry 31), the tavern, the bar, PUNCH BARKEEP (the brawl)
  'run1-inn': { seed: 169084438, saves: false, segments: [
    ['top menu', TITLES], ['party of six', SIX], ['begin', 'B{Enter}{Enter}'], ['into the inn (6,13 W)', '{Down}{Up}'],
    ["the innkeeper's story", '{Enter}'], ['to the tavern sign (5,10)', '{Enter}{Right}{Up}{Enter}{Left}{Up}{Right}{Up}{Up}'],
    ['into the bar (6,10 E)', '{Enter}{Right}{Up}'], ['PUNCH BARKEEP: the brawl', 'P'] ] },   // the keys of RUN-1 r1-a .. r1-e
  // RUN-2 step 3a (short, deterministic part): load the DOSBox save D (camp run), begin = the saved square / party / clock
  // (expect = save D's own bytes), into the inn and its story. The walk on to the shop / temple passes random crowd
  // lines (Random, the browser run was unseeded), so it is not a fixed key route.
  run2: { seed: 169084438, saves: 'camp', segments: [
    ['top menu', TITLES], ['load D, begin', 'LDB'], ['into the inn (6,13 W)', '{Down}{Up}'], ["the innkeeper's story", '{Enter}'] ],
    expect: { 'load D, begin': { block: 1, dataset: 2, x: 7, y: 13, dir: 2, party: ['ALPHA hp 44/44 AC 8'] } } },
  // RUN-2 step 2: load the patched overland save G (data set 1, ECL1 block 50h, view mode 3): the 2D BIGPIC area
  'run2-g': { seed: 169084438, saves: 'overland', segments: [
    ['top menu', TITLES], ['load G, begin: the overland', 'LGB'], ['continue', '{Enter}'] ],
    expect: { 'load G, begin: the overland': { block: 0x50, dataset: 1 } } },
};

// ---- node shims: no window / document / IndexedDB; fetch of file: URLs ---------------------------------------------
globalThis.window = globalThis;
const realFetch = globalThis.fetch;
globalThis.fetch = async (u, ...r) => {
  const s = String(u);
  if (s.startsWith('file:')) { const p = fileURLToPath(s); return existsSync(p) ? new Response(readFileSync(p)) : new Response(null, { status: 404 }); }
  return realFetch(u, ...r);
};

function parseKeys(s) {
  const EXT = { Up: 0x48, Down: 0x50, Left: 0x4B, Right: 0x4D, Home: 0x47, End: 0x4F, PgUp: 0x49, PgDn: 0x51 };
  const out = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '{') {
      const j = s.indexOf('}', i); const t = s.slice(i + 1, j); i = j;
      if (t === 'Enter') out.push([13, 0x1C]); else if (t === 'Esc') out.push([27, 1]); else if (t === 'Space') out.push([32, 0x39]);
      else if (t === 'wait') out.push(null); else if (EXT[t]) out.push([0, EXT[t]]);
    } else out.push([s.charCodeAt(i), 0]);
  }
  return out;
}

// ---- listings: address -> { op, args } per ECL<ds>_<block> ------------------------------------------------------------
const listingCache = new Map();
function listing(ds, block) {
  const name = `ECL${ds}_${String(block).padStart(2, '0')}.ecl.txt`;
  if (listingCache.has(name)) return listingCache.get(name);
  const m = new Map();
  const p = join(LISTINGS, name);
  if (existsSync(p)) for (const l of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const x = /^([0-9A-F]{4})  (?:[0-9A-F]{2} )+(?:\.\. )?\s*([A-Z_]+)\s*(.*)$/.exec(l);
    if (x) m.set(parseInt(x[1], 16), { op: x[2], args: x[3].trim() });
  }
  listingCache.set(name, m.size ? m : null);
  return m.size ? m : null;
}
// VM cells that engine routines write through ecl_SetMem while an instruction runs (not an operand of it)
const ENGINE_CELLS = {
  0x4BC5: '4BC5 3D map id: LOAD FILES 2200:0C15',
  0x4CFF: '4CFF force-animation cell: HorizontalMenu 6800:07a8',
  0x7EC9: '7EC9: ExploreCommand 3f00:0911',
  0x7ED5: '7ED5 walked-off-the-map flag: StepForward 3f00:07aa',
  0x7F33: '7F33 ally-attacked flag: combat set-up 3300:1ce7 / 3a00:2f99',
  0x7ECB: '7ECB: CombatMain round loop 2f00:015d',
};
for (let i = 0; i < 7; i++) ENGINE_CELLS[0x4BC6 + i] = '4BC6..4BCC clock: AdvanceClock 5400:041e';
const OPS = { PRINT: ['PRINT'], PRINTCLEAR: ['PRINTCLEAR'], VERTICAL_MENU: ['VERTICAL_MENU'], ENCOUNTER: ['ENCOUNTER_MENU'] };

async function run(name) {
  const R = ROUTES[name];
  const { G, configureState, initState } = await import('../game/engine/state.js');
  const { state: pic, configurePictures } = await import('../game/engine/pictures.js');
  const { Display } = await import('../game/engine/display.js');
  const { useByoc, daxConfig } = await import('../game/engine/dax.js');
  const files = await import('../game/engine/files.js');
  const input = await import('../game/engine/input.js');
  const { setSpeedFactor } = await import('../game/engine/timer.js');
  const { dev } = await import('../game/engine/dev.js');
  const { hooks } = await import('../game/plus/hooks.js');
  const { params } = await import('../game/engine/tp.js');
  let profile = JSON.parse(readFileSync(join(ROOT, 'game', 'profiles', 'cab.json'), 'utf8'));
  // cab: v13-1 — CAB_PROFILE=cab-1.3 traces a v1.3 copy (CAB_DEV_DATA = the CD folder or its scratch copy): the overlay
  // game/profiles/cab-1.3.json over cab.json (ST.EXE unpacked, dsMap, audio constants, the v1.3 behaviour switch);
  // the reports get the suffix -v13 so the v1.0 reports stay what they are
  if (process.env.CAB_PROFILE && process.env.CAB_PROFILE !== 'cab') {
    const { applyOverlay } = await import('../game/plus/games.js');
    const { variant } = await import('../game/engine/variant.js');
    const { configureAudio } = await import('../game/engine/audio_cab.js');
    const o = JSON.parse(readFileSync(join(ROOT, 'game', 'profiles', process.env.CAB_PROFILE + '.json'), 'utf8'));
    profile = applyOverlay({ ...profile, url: 'file:///cab.json' }, { ...o, url: 'file:///' + process.env.CAB_PROFILE + '.json' });
    variant.set(profile.engine.behaviour && profile.engine.behaviour.id);
    configureAudio(profile.engine.audio);
  }

  // the engine set-up of main_cab.js MainProgram, without the browser parts
  configureState(profile.engine.state, profile.recordSizes);
  configurePictures({ symbolMax: 0x127, curseBlits: true, flushAfterLoad: true });
  daxConfig.curse = true;
  files.configureFiles(profile.engine.storage.saves);
  const names = Object.fromEntries(readdirSync(DATA).map((f) => [f.toUpperCase(), f]));
  useByoc(async (n) => { const k = String(n).toUpperCase().replace(/^.*[\\/]/, ''); return names[k] ? new Uint8Array(readFileSync(join(DATA, names[k]))) : null; });
  if (R.saves) { const dir = join(ROOT, 'acceptance', 'local', 'saves', R.saves);   // DOSBox-made saves (local), as ?loadsaves=1
    for (const f of readdirSync(dir)) files.writeFile(f.toUpperCase(), new Uint8Array(readFileSync(join(dir, f)))); }
  input.keyState.curse = true; input.keyState.demo = () => !!G.DemoMode;
  pic.display = new Display(null);
  dev.seed = R.seed; dev.wheelMode = 'any'; dev.fast = 1; dev.target = null;   // real speed, as the RUN-1 browser routes (the key script types one key per 250 ms idle)
  params.sting = false; params.second = '';
  setSpeedFactor(1);
  hooks.configure(profile.plus); hooks.enabled = true; hooks.startLog();
  input.script.readyWhenIdle = true;
  await initState();
  const startup = await import('../game/areas/startup.js');
  let ended = null;
  startup.MainProgram(profile.engine.configuration).then(() => { ended = 'returned'; }, (e) => { ended = String(e && e.message || e); });

  const vm = () => G.ecl_VM;
  const cells = () => { const v = vm(); if (!v) return null; const m = (a) => v.getMem(a);
    return { '4BF2 block': m(0x4BF2), '4BE6 3D': m(0x4BE6), '4BC5 map': m(0x4BC5), '7F3E party': m(0x7F3E), '7F12 dataset': m(0x7F12) }; };
  const snapshot = () => ({
    block: G.ecl_Block, dataset: G.DataSet, x: G.party_MapX, y: G.party_MapY, dir: G.party_Dir, viewMode: G.view_Mode,
    clock: hooks.state.clock()?.text ?? null, party: hooks.state.party().map((p) => `${p.name} hp ${p.hp}/${p.hpMax} AC ${p.ac}`),
    cells: cells(),
  });
  const waitIdle = async (ms = 300000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { if (globalThis.__screenReady || ended) return true; await new Promise((r) => setTimeout(r, 50)); }
    return false;
  };
  const out = { route: name, seed: R.seed, data: 'the player\'s curazure folder (read-only)', checkpoints: [], checks: {} };
  let from = 0;
  for (const [label, keys] of R.segments) {
    globalThis.__screenReady = false;
    input.script.keys.push(...parseKeys(keys));
    const idle = await waitIdle();
    const L = hooks.log.slice(from); from = hooks.log.length;
    const pick = (e) => L.filter((x) => x.event === e);
    out.checkpoints.push({ label, keys, idle, ended, state: snapshot(),
      areaEntered: pick('areaEntered').map((e) => `${e.source} ds ${e.dataset} block ${e.block} ${e.x},${e.y}`),
      text: pick('textPrinted').map((e) => ({ addr: e.addr?.toString(16), source: e.source, text: e.text })),
      journal: pick('journalRef').map((e) => `entry ${e.n} at ECL${e.dataset}/${e.block} ${e.addr?.toString(16)}`),
      menus: pick('menuDrawn').map((e) => (e.prompt || '') + '[' + (e.items || []).map((i) => i.label.trim()).join(' ') + ']').filter((v, i, a) => a.indexOf(v) === i),
      lists: pick('listDrawn').map((e) => (e.items || []).slice(0, 3).map((i) => i.text.trim()).join(' / ')),
      flags: pick('flagSet').length, combat: [...pick('combatStart').map((e) => `start: ${e.monsters.length} monsters`), ...pick('combatEnd').map((e) => `end partyDead ${e.partyDead}`)],
      saves: [...pick('gameSaved').map((e) => `saved ${e.slot}`), ...pick('saveLoaded').map((e) => `loaded ${e.slot}`)] });
    const want = R.expect && R.expect[label];
    if (want) { const st = snapshot(), bad = Object.entries(want).filter(([k, v]) => JSON.stringify(st[k]) !== JSON.stringify(v));
      out.checkpoints[out.checkpoints.length - 1].expect = bad.length ? { FAIL: bad.map(([k, v]) => `${k}: ${JSON.stringify(st[k])} != ${JSON.stringify(v)}`) } : 'PASS';
      (out.checks.expect ||= []).push(`${label}: ${bad.length ? 'FAIL' : 'PASS'}`); }
    console.log(`${name} | ${label}: ${idle ? 'idle' : 'TIMEOUT'} ${JSON.stringify(snapshot()).slice(0, 220)}`);
    if (!idle) break;
  }

  // ---- checks against the decoded listings ----
  const log = hooks.log;
  const txt = { checked: 0, same: 0, computed: 0, mismatch: [], noListing: 0 };
  for (const e of log.filter((x) => x.event === 'textPrinted' && x.addr !== undefined)) {
    const L = listing(e.dataset, e.block);
    if (!L) { txt.noListing++; continue; }
    const ins = L.get(e.addr);
    txt.checked++;
    const ok = ins && (OPS[e.source] || []).includes(ins.op);
    const lit = ins && /^"(.*)"/.exec(ins.args);
    if (ok && lit && e.source !== 'ENCOUNTER') { if (lit[1] === e.text) txt.same++; else txt.mismatch.push({ at: `ECL${e.dataset}_${e.block} ${e.addr.toString(16)}`, listing: lit[1], game: e.text }); }
    else if (ok) txt.computed++;
    else txt.mismatch.push({ at: `ECL${e.dataset}_${e.block} ${e.addr.toString(16)}`, listing: ins ? ins.op + ' ' + ins.args.slice(0, 60) : 'no instruction', game: `${e.source} ${e.text}` });
  }
  const flg = { checked: 0, operand: 0, engine: 0, engineRoutine: {}, mismatch: [] };
  for (const e of log.filter((x) => x.event === 'flagSet')) {
    const L = listing(G.DataSet, G.ecl_Block);
    const blockAt = e.block ?? null;
    void blockAt;
    if (e.pc === undefined) { flg.engine++; continue; }
    flg.checked++;
    // the instruction that wrote: look it up in every listing of the data set the run visited (the block may have changed since)
    let hit = null;
    for (const [nm, m] of listingCache) if (m && m.has(e.pc) && m.get(e.pc).args.toUpperCase().includes(`[${e.addr.toString(16).toUpperCase().padStart(4, '0')}]`)) hit = nm;
    if (hit) { flg.operand++; continue; }
    const why = ENGINE_CELLS[e.addr];
    if (why) { flg.engineRoutine[why] = (flg.engineRoutine[why] || 0) + 1; continue; }
    flg.mismatch.push({ pc: e.pc.toString(16), addr: e.addr.toString(16), value: e.value });
    void L;
  }
  out.checks.text = { ...txt, mismatch: txt.mismatch.slice(0, 40) };
  out.checks.flags = { ...flg, mismatch: flg.mismatch.slice(0, 40), mismatchCount: flg.mismatch.length };
  // ---- saves vs DOSBox ----
  if (R.compare) {
    out.checks.saves = {};
    for (const f of R.compare) {
      const a = await files.readFile(f), refp = join(CAMP, f);
      if (!a || !existsSync(refp)) { out.checks.saves[f] = a ? 'no DOSBox file' : 'not written'; continue; }
      const b = readFileSync(refp); const diff = [];
      for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) diff.push(i);
      out.checks.saves[f] = { size: [a.length, b.length], differing: diff.length, first: diff.slice(0, 12).map((x) => x.toString(16)) };
    }
  }
  out.summary = { expect: out.checks.expect || null, checkpoints: out.checkpoints.length, idle: out.checkpoints.every((c) => c.idle), events: log.length,
    text: `${txt.same} same + ${txt.computed} computed of ${txt.checked}, ${txt.mismatch.length} mismatches`,
    flags: `${flg.operand} of ${flg.checked} writes on an operand of their instruction, ${Object.values(flg.engineRoutine).reduce((a, b) => a + b, 0)} by engine routines during it (${Object.keys(flg.engineRoutine).join('; ')}), ${flg.mismatch.length} unexplained` };
  mkdirSync(OUT, { recursive: true });
  const sfx = process.env.CAB_PROFILE && process.env.CAB_PROFILE !== 'cab' ? '-' + process.env.CAB_PROFILE.replace(/^cab-/, 'v').replace('.', '') : '';   // cab: v13-1 '-v13'
  writeFileSync(join(OUT, `${name}${sfx}.json`), JSON.stringify(out, null, 1) + '\n');
  mkdirSync(SUMMARY, { recursive: true });
  writeFileSync(join(SUMMARY, `${name}${sfx}.json`), JSON.stringify({ route: name, profile: process.env.CAB_PROFILE || 'cab', seed: R.seed, summary: out.summary, saves: out.checks.saves || null,
    checkpoints: out.checkpoints.map((c) => ({ label: c.label, idle: c.idle, state: c.state, expect: c.expect || null })) }, null, 1) + '\n');
  console.log(`${name} SUMMARY ${JSON.stringify(out.summary)}${out.checks.saves ? ' saves ' + JSON.stringify(out.checks.saves) : ''}`);
  return out;
}

// one route per process (the engine modules keep their state); `all` runs them one after the other in child processes
if (which === 'all') {
  const { execFileSync } = await import('node:child_process');
  for (const r of Object.keys(ROUTES)) {
    try { process.stdout.write(execFileSync(process.execPath, [fileURLToPath(import.meta.url), r], { encoding: 'utf8', timeout: 900000 })); }
    catch (e) { console.log(`${r}: FAILED ${String(e.stdout || e.message).slice(-600)}`); }
  }
  process.exit(0);
} else {
  await run(which);
  process.exit(0);
}
void pathToFileURL;
