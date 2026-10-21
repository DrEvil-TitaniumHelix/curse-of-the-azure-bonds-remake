// dev.js — acceptance hooks (not game behaviour): ?screen=<SCREENS_INDEX id> stops the program when that screen is
// por-only: Pool title/code-wheel/party/explore test routes (whole module) (profile: engine.id (decoded adapter); game/profiles/PORONLY.md)
// complete and sets window.__screenReady (the headless screenshot script waits for it); ?seed=n fixes RandSeed after
// Randomize; ?fast=n shortens delays; ?sting=1 = START.EXE STING; ?wheel=1 shows the code wheel (default: bypassed as STING
// does for the wheel, BUILD_PLAN §2).

const q = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
// cab: dev route ?screen=t<seconds>: the screen is ready after that many (real) seconds (demo / long runs)
if (/^t\d+$/.test(q.get('screen') || '') && typeof window !== 'undefined')
  setTimeout(() => { window.__screenReady = true; window.__screenId = q.get('screen'); }, Number(q.get('screen').slice(1)) * 1000);

export const dev = {
  target: q.get('screen'),
  seed: q.has('seed') ? Number(q.get('seed')) : null,
  fast: q.has('fast') ? Number(q.get('fast')) : 1,
  sting: q.get('sting') === '1',
  wheel: q.get('wheel') === '1',
  // cab: adapter routes (BUILD_PLAN §2 dev row, §2a): ?wheel=1 / ?wheel=retail (rune wheel; default bypass), ?wooden=1 =
  // START.EXE x Wooden (ParamStr(2) = CopyProtWord: skips the start-up wheel), ?demo=1 = 'D' typed at the Play Demo
  // prompt, ?trace=1 = ECL opcode trace on the console (ov34 names; dev only)
  wheelMode: q.get('wheel') === 'retail' ? 'retail' : q.get('wheel') === '1' ? 'any' : 'bypass',
  wooden: q.get('wooden') === '1',
  demo: q.get('demo') === '1',
  trace: q.get('trace') === '1',
  wheelEntry: q.has('wheelentry') ? Number(q.get('wheelentry')) : null,
  params: q,
  // ?keys=LA{Enter}{Up}: typed one at a time whenever the game waits for a key with an empty buffer (input.js idle hook)
  keys: parseKeys(q.get('keys') || ''),
  save: q.get('save'),
  force: q.get('force') === '1',

  // called when screen `id` is fully drawn; if it is the target, freeze here
  async screen(id) {
    if (this.target !== id) return;
    window.__screenReady = true;
    window.__screenId = id;
    await new Promise(() => {});
  },
  // for screens that wait for input right after drawing: signal without blocking
  screenSoon(id) {
    if (this.target === id) { window.__screenReady = true; window.__screenId = id; }
  },
};

// key script: plain characters, {Enter} {Esc} {Up} {Down} {Left} {Right} {Home} {End} {PgUp} {PgDn} {Space}, {Ctrl-A}..{Ctrl-Z} (ASCII 1..26, as Crt.ReadKey), {wait} = one idle tick
function parseKeys(s) {
  const EXT = { Up: 0x48, Down: 0x50, Left: 0x4B, Right: 0x4D, Home: 0x47, End: 0x4F, PgUp: 0x49, PgDn: 0x51 };
  const out = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '{') {
      const j = s.indexOf('}', i); const t = s.slice(i + 1, j); i = j;
      if (t === 'Enter') out.push([13, 0x1C]); else if (t === 'Esc') out.push([27, 1]); else if (t === 'Space') out.push([32, 0x39]);
      else if (t === 'wait') out.push(null); else if (EXT[t]) out.push([0, EXT[t]]);
      else if (/^Ctrl-[A-Z]$/i.test(t)) out.push([t.toUpperCase().charCodeAt(5) - 64, 0]);
    } else out.push([s.charCodeAt(i), 0]);
  }
  return out;
}
