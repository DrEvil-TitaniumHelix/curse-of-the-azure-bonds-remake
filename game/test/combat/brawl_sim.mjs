// game/test/combat/brawl_sim.mjs — headless reproduction of fix request #run1-1 (cab-build-areas): the ECL2/1 bar brawl
// (8A9B: LOAD_MONSTER #04 x10 BAR PATRON, COMBAT) with six level-5 dwarf fighters (DOSBox save D's ALPHA, copied) on Quick.
// Engine set-up as game/test/engine/*.test.mjs (player's files read-only, canvas-less Display, scripted keys).
// Run: node game/test/combat/brawl_sim.mjs [seed]   — prints the attacks and the outcome; exit 1 when the #run1-1 symptoms
// return (a combatant helpless / a PC down). Env TRACE=1 (callers of ApplyDamage / RemoveFromCombat ...), SHOT=<file>
// (raw palette-index frame at the first combat turn), GRID=1 (the 7x7 window tiles), DIST (encounter distance).
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const DATA = process.env.CAB_DEV_DATA || join(ROOT, '..', 're-targets', 'goldbox', 'cotab', 'curazure');
const seed = Number(process.argv[2] ?? 12345), maxRounds = Number(process.argv[3] ?? 15);

const { G, configureState, newChar, pstr } = await import('../../engine/state.js');
const { state: pic, configurePictures, AllocPicture, Load8x8Set } = await import('../../engine/pictures.js');
const { Display } = await import('../../engine/display.js');
const { useByoc } = await import('../../engine/dax.js');
const { LoadTextFont } = await import('../../engine/text.js');
const { setRandSeed } = await import('../../engine/tp.js');
const input = await import('../../engine/input.js');
const { setSpeedFactor } = await import('../../engine/timer.js');
const { X, bind } = await import('../../areas/view_link.js');
const V30 = await import('../../areas/view_ov30.js');

configureState({ exepack: false, dsImageOffset: 0xC1C0, dsBytes: 0x8F00 }, { TChar: 0x1A6, item: 0x3F, effect: 9, combat: 0x16 });
const names = Object.fromEntries(readdirSync(DATA).map((f) => [f.toUpperCase(), f]));
useByoc(async (n) => (names[n.toUpperCase()] ? new Uint8Array(readFileSync(join(DATA, names[n.toUpperCase()]))) : null));
const exe = new Uint8Array(readFileSync(join(DATA, names['START.EXE'])));
const u16 = (o) => exe[o] | (exe[o + 1] << 8);
const img = exe.slice(u16(8) * 16, u16(2) ? (u16(4) - 1) * 512 + u16(2) : u16(4) * 512);
const ds = new Uint8Array(0x8F00); ds.set(img.subarray(0xC1C0, 0xC1C0 + 0x8F00));
const items = readFileSync(join(DATA, names.ITEMS)); ds.set(items.subarray(0, 0x810), 0x5CF6);
G.ds = ds; G.image = img;
pic.display = new Display(null);
configurePictures({ symbolMax: 0x127, curseBlits: true, flushAfterLoad: true });
pic.symbolPic = AllocPicture(8, 1, 1, 0); pic.viewPic = AllocPicture(0xA8, 0x15, 1, 0);
const { tiles } = await import('../../engine/tiles_cab.js');
tiles.set = AllocPicture(24, 3, 0x30, 1);                               // tile_Set g_65CE (ENGINE ov11 allocates 48 frames)
await LoadTextFont();
G.DataSet = 1; await Load8x8Set(0xCA, 4); await Load8x8Set(0xCB, 0);
G.DataSet = 2;
const mem = new Map();
V30.bindView({ mem: (a) => mem.get(a) ?? 0, setMem: (a, v) => mem.set(a, v & 0xFFFF), setEclPC: () => {}, eclPC: () => 0, vecB: () => 0 });
await X.InitSpellTable(); await X.InstallEffectHandlers();
await V30.Load3DMap(1); mem.set(0x4BE6, 1);                               // 3D area (GEO2/1, the start map)
G.ecl_Block = 1; G.party_MapX = 6; G.party_MapY = 10; G.party_Dir = 6; G.view_Mode = 4;
G.VideoMode = 1;                                                        // EGA, as startup.js sets it from CURSE.CFG line 1 (020f:06b0)
G.GameSpeed = 0; G.TextOutputActive = 0; G.DemoMode = 0; G.opt_Animation = 0;
setSpeedFactor(1000);

// party: six copies of ALPHA (decode/data/SAVES.md save D: dwarf fighter 5, 44 hp, THAC0 15, AC 8)
const save = readFileSync(join(ROOT, 'acceptance/local/saves/camp/CHRDATD1.SAV'));
let last = null;
for (let i = 0; i < 6; i++) {
  const c = newChar(); c.b.set(save.subarray(0, 0x1A6)); c.b[1] = 0x41 + i;   // ALPHA, BLPHA, ... (first letter)
  c.readied = new Array(13).fill(null); c.b[0x197] = 0; c.b[0x196] = 1; c.b[0x195] = 0;
  if (last) last.next = c; else G.PartyList = c; last = c;
}
G.SelectedChar = G.PartyList; mem.set(0x7F3E, 6);
mem.set(0x7EC0, 2); mem.set(0x7EC1, Number(process.env.DIST ?? 2));   // SETUP_MONSTER #02, #02, #02 (ECL2/1 8AB4): encounter distance
// monsters: LOAD_MONSTER #04, #10 (ecl_cab.js op0B: one record, copies appended at the end of the list)
const rec = { v: null }, it = { v: null }, ef = { v: null };
await X.LoadMonsterRecord(4, rec, it, ef);
G.g_7603 = 1;
for (let k = 1; k <= 10; k++) {
  const n = k === 1 ? rec.v : newChar();
  if (k > 1) n.b.set(rec.v.b);
  n.b[0x143] = 1; n.next = null; last.next = n; last = n;
}
const all = []; for (let c = G.PartyList; c; c = c.next) all.push(c);
const nm = (c) => pstr(c.b, 0);
console.log('monster record: name', nm(rec.v), 'side', rec.v.b[0x197], 'controlled', rec.v.b[0x198], 'hp', rec.v.b[0x1A4],
  'thac0', rec.v.b[0x199], 'ac', rec.v.b[0x19A], 'dmg', rec.v.b[0x19E] + 'd' + rec.v.b[0x1A0] + '+' + rec.v.b[0x1A2], 'status', rec.v.b[0x195], 'active', rec.v.b[0x196]);

// log every attack through the published names (calls inside a unit stay direct; ov08/ov09 reach ov13 through X)
const C13 = await import('../../areas/combat_ov13.js');
let attacks = 0;
bind({ Attack: async (a, t, ...r) => { attacks++; const hp0 = t.b[0x1A4]; const res = await C13.Attack(a, t, ...r);
  console.log(`  ${nm(a)} -> ${nm(t)}: hp ${hp0} -> ${t.b[0x1A4]}`); return res; } });

const C23 = await import('../../areas/combat_ov23.js');
const caller = () => new Error().stack.split(String.fromCharCode(10)).slice(3, 6).map((l) => l.trim().replace(/^at /, '').replace(/[(]file:.*areas[/]/, '(')).join(' < ');
const P24m = await import('../../areas/party_ov24.js');
let helpless = 0;
bind({ IsHelpless: (c) => { const r = P24m.IsHelpless(c); if (r) helpless++; return r; } });
if (process.env.TRACE) bind({
  IsHelpless: (c) => { const r = P24m.IsHelpless(c); if (r) helpless++; if (r) console.log(`  IsHelpless ${nm(c)} = true :: effects ${(() => { const t = []; for (let e = c.effects; e; e = e.next) t.push(e.b[0].toString(16)); return t.join(','); })()}`); return r; },
  ApplyDamage: (c, d) => { console.log(`  ApplyDamage ${nm(c)} hp ${c.b[0x1A4]} dmg ${d} :: ${caller()}`); return P24m.ApplyDamage(c, d); },
  RemoveFromCombat: async (c, st, msg) => { console.log(`  RemoveFromCombat ${nm(c)} status ${st} '${msg}' hp ${c.b[0x1A4]} :: ${caller()}`); return C23.RemoveFromCombat(c, st, msg); },
  KillCombatant: async (c, st, msg) => { console.log(`  KillCombatant ${nm(c)} status ${st} '${msg}' :: ${caller()}`); return C23.KillCombatant(c, st, msg); },
  Flee: async (c) => { const r = await C13.Flee(c); console.log(`  Flee ${nm(c)} -> ${r} :: ${caller()}`); return r; },
});
const P24s = await import('../../areas/party_ov24.js');
const { writeFileSync } = await import('node:fs');
let shot = 0;
if (process.env.SHOT) bind({ DrawCharacterSummary: async (c) => { const r = await P24s.DrawCharacterSummary(c);
  if (shot === 0 && process.env.GRID) { const m = G.cm_Map.b, x0 = m[2], y0 = m[3];
    for (let r = 0; r < 7; r++) console.log(Array.from({ length: 7 }, (_, c) => { const t = m[7 + (y0 + r) * 50 + x0 + c]; return t.toString(16).padStart(2) + '/' + G.ds[0x26A5 + t * 4].toString(16).padStart(2); }).join(' '));
    const fpx = tiles.set.height * tiles.set.width8 * 8; console.log('tiles.set', tiles.set.height, tiles.set.width8, tiles.set.count, 'nonzero px per frame', Array.from({ length: 0x30 }, (_, f) => tiles.set.px.subarray(f * fpx, f * fpx + fpx).some((v) => v)).map((v) => v ? 1 : 0).join('')); }
  if (shot === 0) console.log('palette regs at the first combat turn', Array.from(pic.display.palette).join(','), 'VideoMode', G.VideoMode);
  if (shot++ === 0) { pic.display.flush?.(); writeFileSync(process.env.SHOT, Buffer.from(pic.display.pix)); console.log('frame (palette indices) written to', process.env.SHOT); }
  return r; } });
setRandSeed(seed);
let rounds = 0;
const origEnd = (await import('../../areas/magic_ov08.js'));
const watchdog = setInterval(() => {
  if (input.script.keys.length < 4) for (let i = 0; i < 8; i++) input.script.keys.push([0x51, 0], [13, 0x1C]);   // Q, Enter
}, 50);
const t0 = Date.now();
await Promise.race([origEnd.CombatMain(), new Promise((r) => setTimeout(r, 120000))]);
clearInterval(watchdog);
console.log(`combat ended after ${((Date.now() - t0) / 1000).toFixed(1)} s, rounds ${G.CombatRound}, attacks ${attacks}`);
for (const c of all) console.log(nm(c).padEnd(12), 'side', c.b[0x197], 'hp', String(c.b[0x1A4]).padStart(3), 'status', c.b[0x195]);
// regression (#run1-1): nobody may become helpless in this fight (no stinking cloud is cast), and six level-5 fighters
// must not lose a man to ten 1d2 bar patrons
const down = all.filter((c) => c.b[0x197] === 0 && c.b[0x195] !== 0).length;
const ok = helpless === 0 && down === 0;
console.log(ok ? 'PASS brawl' : `FAIL brawl: ${helpless} helpless checks true, ${down} PCs down`);
process.exit(ok ? 0 : 1);
