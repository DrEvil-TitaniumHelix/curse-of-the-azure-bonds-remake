// acceptance/seedfind.mjs (cab-build-areas) — recover the DOS-clock RandSeed of an unseeded DOSBox-X reference run from the
// character it created (the seed method of cab-build-engine's S034). Randomize (tp.js) takes the DOS time: low word
// hours*256 + minutes, high word seconds*256 + hundredths. On the route titles -> P -> rune wheel -> top menu exactly 4
// draws are made before C (measured in the build: seed 169084438 -> 2781287506 after 4 LCG steps), so each candidate time
// is advanced 4 steps and the build's own CreateCharacter (engine_ov17_create.js) rolls the character headlessly (canvas-
// less Display, the owner's files read-only); a candidate matches when age, the six abilities and HP equal the run's.
// Usage: node acceptance/seedfind.mjs HH:MM:SS.hh SPAN_S race classKeys "age STR INT WIS DEX CON CHA HP"
//   e.g. node acceptance/seedfind.mjs 10:22:33.65 3 human '' "21 15 15 16 15 16 15 36"   (race list: End x n; class: first)
// The DOS clock of a run ~ the DOSBox window start (sidecar captured_utc - t_since_window_s) + 1.8 s, local time (UTC-6).
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// headless speed-up for this search process only: timers fire at once and the clock steps 100 ms per read, so the key
// script (input.js: one key per 250 ms of idle) and the message delays do not wait in real time
const realTimeout = globalThis.setTimeout;
globalThis.setTimeout = (f, ms, ...a) => realTimeout(f, 0, ...a);
{ let fake = 0; globalThis.performance.now = () => (fake += 100); }
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = process.env.CAB_DEV_DATA || join(ROOT, '..', 're-targets', 'goldbox', 'cotab', 'curazure');
const [, , at, span = '3', race = 'human', , want] = process.argv;
const target = want.split(/\s+/).map(Number);

const { G, configureState } = await import('../game/engine/state.js');
const { state: pic, configurePictures, AllocPicture, Load8x8Set } = await import('../game/engine/pictures.js');
const { Display } = await import('../game/engine/display.js');
const { useByoc } = await import('../game/engine/dax.js');
const { LoadTextFont } = await import('../game/engine/text.js');
const { setRandSeed } = await import('../game/engine/tp.js');
const input = await import('../game/engine/input.js');
const files = await import('../game/engine/files.js');
const { bind } = await import('../game/areas/view_link.js');
const ov17 = await import('../game/areas/engine_ov17_create.js');

configureState({ exepack: false, dsImageOffset: 0xC1C0, dsBytes: 0x8F00 }, { TChar: 0x1A6, item: 0x3F, effect: 9, combat: 0x16 });
const names = Object.fromEntries(readdirSync(DATA).map((f) => [f.toUpperCase(), f]));
useByoc(async (n) => (names[n.toUpperCase()] ? new Uint8Array(readFileSync(join(DATA, names[n.toUpperCase()]))) : null));
const exe = new Uint8Array(readFileSync(join(DATA, names['START.EXE'])));
const u16 = (o) => exe[o] | (exe[o + 1] << 8);
const img = exe.slice(u16(8) * 16, u16(2) ? (u16(4) - 1) * 512 + u16(2) : u16(4) * 512);
const ds = new Uint8Array(0x8F00); ds.set(img.subarray(0xC1C0, 0xC1C0 + 0x8F00));
G.ds = ds; G.image = img;
pic.display = new Display(null);
configurePictures({ symbolMax: 0x127, curseBlits: true, flushAfterLoad: true });
G.DataSet = 1;
pic.symbolPic = AllocPicture(8, 1, 1, 0); pic.viewPic = AllocPicture(0xA8, 0x15, 1, 0);
await LoadTextFont();
await Load8x8Set(0xCA, 4); await Load8x8Set(0xCB, 0);
G.ecl_Mem4B00 = new Uint16Array(0x400); G.ecl_Mem7C00 = new Uint16Array(0x400); G.ecl_Mem7A00 = new Uint16Array(0x200);
G.GameSpeed = 0; G.TextOutputActive = 0;
bind({ IconEditor: async () => {} });

const RACE_DOWN = { dwarf: 0, elf: 1, gnome: 2, 'half-elf': 3, halfling: 4, human: 5 }[race];
const lcg = (s) => (Math.imul(s, 0x08088405) + 1) >>> 0;
const [hms, hh = '0'] = at.split('.'); const [H, M, S] = hms.split(':').map(Number);
const t0 = ((H * 60 + M) * 60 + S) * 100 + Number(hh.padEnd(2, '0'));
const hits = [];
for (let t = t0 - Number(span) * 100; t <= t0 + Number(span) * 100; t++) {
  const h = Math.floor(t / 360000), m = Math.floor(t / 6000) % 60, s = Math.floor(t / 100) % 60, c = t % 100;
  const seed = (((s << 8 | c) << 16) | (h << 8 | m)) >>> 0;
  let st = seed; for (let i = 0; i < 4; i++) st = lcg(st);
  G.SelectedChar = null; G.PartyList = null; G.FreeTraining = 0; G.g_8B6F = 0; G.g_4FC8 = 0;
  input.script.keys.length = 0; await files.eraseFile('BETA.GUY');              // a second BETA would ask to overwrite
  for (let i = 0; i < RACE_DOWN; i++) input.script.keys.push([0, 0x4F]);           // End = one row down
  for (const ch of 'SSSSNBETA\rY') input.script.keys.push(ch === '\r' ? [13, 0x1C] : [ch.charCodeAt(0), 0]);
  setRandSeed(st);
  await ov17.CreateCharacter();
  const b = await files.readFile('BETA.GUY');
  const got = [b[0x76] | (b[0x77] << 8), b[0x11], b[0x13], b[0x15], b[0x17], b[0x19], b[0x1B], b[0x78]];
  if (process.env.DEBUG) console.log(t, got.join(" "));
  if (got.every((v, i) => v === target[i])) {
    hits.push(seed);
    console.log(`MATCH ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')} seed ${seed}`);
  }
}
console.log(`${hits.length} match(es) in ${2 * Number(span)} s around ${at}`);
process.exit(hits.length ? 0 : 1);
