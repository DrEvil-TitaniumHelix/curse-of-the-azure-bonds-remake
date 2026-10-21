// game/test/plus/hooks_cab.test.mjs (cab-build-engine, S1) — the Curse side of game/plus/hooks.js:
//  - journalRef for every one of the 46 citation sites of decode/ecl/JOURNAL_REFS.md, fed the texts the scripts print
//    there (read from the decode/ecl/scripts listings: the site's PRINT, the PRINT before it, or the PRINT of the shared
//    GOSUB subroutine; the ECL1/80 9A7C table site with each of its three numbers 24 / 35 / 42);
//  - the profile parameters (cab.json "plus": the 422-byte record layout, VM 7F3E / 4BC6 / 4BC5, G.PartyList).
// Run: node --test game/test/plus/hooks_cab.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hooks, charSummary } from '../../plus/hooks.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const DECODE = join(ROOT, 'decode', 'ecl');
const PROFILE = JSON.parse(readFileSync(join(ROOT, 'game', 'profiles', 'cab.json'), 'utf8'));

// listing lines: "9BC5  11 80 ...  PRINT           \" AND YOU ...\"" -> { addr, op, arg }
function listing(file, rec) {
  const name = `ECL${file}_${String(rec).padStart(file === 1 ? 2 : 2, '0')}.ecl.txt`;
  const lines = readFileSync(join(DECODE, 'scripts', name), 'utf8').split(/\r?\n/);
  const out = [];
  for (const l of lines) {
    const m = /^([0-9A-F]{4})  (?:[0-9A-F]{2} )+(?:\.\. )?\s*([A-Z_]+)\s*(.*)$/.exec(l);
    if (m) out.push({ addr: parseInt(m[1], 16), op: m[2], arg: m[3].trim() });
  }
  return out;
}
const str = (arg) => { const m = /^"(.*)"/.exec(arg); return m ? m[1] : null; };

// the 46 rows of JOURNAL_REFS.md
function sites() {
  const md = readFileSync(join(DECODE, 'JOURNAL_REFS.md'), 'utf8');
  const rows = [];
  for (const l of md.split(/\r?\n/)) {
    const m = /^\| (\d+) \| ECL(\d)\/(\d+) \| ([0-9A-F]{4}) \| \**([\d /]+?)\** \|/.exec(l);
    if (m) rows.push({ row: +m[1], file: +m[2], rec: +m[3], addr: parseInt(m[4], 16), entries: m[5].split('/').map((x) => +x.trim()) });
  }
  return rows;
}

// the texts printed up to and including the site, as the VM emits them (textPrinted: { text, clear })
function texts(site) {
  const L = listing(site.file, site.rec);
  const i = L.findIndex((x) => x.addr === site.addr);
  assert.ok(i >= 0, `site ${site.addr.toString(16)} in the listing`);
  const at = L[i];
  const seq = [{ text: 'A SCENE.', clear: true }];
  let j = i - 1;
  if (L[j].op === 'GET_TABLE') j--;                                   // ECL1/80 9A7C: the number comes from the table
  if (L[j].op === 'GOSUB') {                                         // shared " ... JOURNAL ENTRY " subroutine
    const target = parseInt(/\[([0-9A-F]{4})\]/.exec(L[j].arg)[1], 16);
    const sub = L.find((x) => x.addr === target);
    seq.push({ text: str(sub.arg), clear: sub.op === 'PRINTCLEAR' });
  } else if (!/JOURNAL/.test(str(at.arg) || '')) {                   // split: "... AS JOURNAL " / "ENTRY 30."
    seq.push({ text: str(L[j].arg), clear: L[j].op === 'PRINTCLEAR' });
  }
  const last = str(at.arg);
  return site.entries.map((n) => [...seq, { text: last === null ? String(n) : last, clear: at.op === 'PRINTCLEAR', addr: site.addr }]);
}

// the public tree has decode/ecl without the script listings (they hold the game's texts): skip what reads them (plus request #18)
const HAVE_REFS = existsSync(join(DECODE, 'JOURNAL_REFS.md')), HAVE_LISTINGS = existsSync(join(DECODE, 'scripts', 'ECL1_80.ecl.txt'));
test('JOURNAL_REFS.md: 46 sites, 44 distinct entries', { skip: !HAVE_REFS && 'decode/ecl/JOURNAL_REFS.md not in this tree' }, () => {
  const s = sites();
  assert.equal(s.length, 46);
  assert.equal(new Set(s.flatMap((x) => x.entries)).size, 44);
});

test('journalRef: every citation site yields its entry number(s), with the site address and the scene', { skip: !(HAVE_REFS && HAVE_LISTINGS) && 'decode listings not in this tree (public)' }, () => {
  const got = [];
  const off = hooks.on('journalRef', (p) => got.push(p));
  hooks.enabled = true;
  try {
    for (const site of sites()) {
      for (const [k, seq] of texts(site).entries()) {
        got.length = 0;
        for (const t of seq) hooks.emit('textPrinted', { ...t, window: 'text', source: t.clear ? 'PRINTCLEAR' : 'PRINT', block: site.rec, dataset: site.file, addr: t.addr ?? 0 });
        const want = site.entries[k];
        assert.ok(got.some((r) => r.n === want && r.kind === 'entry'), `row ${site.row} ECL${site.file}/${site.rec} ${site.addr.toString(16)}: entry ${want}, got ${JSON.stringify(got.map((r) => r.n))} from ${JSON.stringify(seq.map((t) => t.text))}`);
        const r = got.find((x) => x.n === want);
        assert.equal(r.addr, site.addr); assert.equal(r.block, site.rec); assert.equal(r.dataset, site.file);
        assert.equal(r.scene, seq.filter((t) => t.clear && t.text.trim()).pop().text);   // the last cleared text
        assert.equal(got.length, 1, `row ${site.row}: exactly one reference`);
      }
    }
  } finally { off(); }
});

test('profile "plus": charSummary reads the 422-byte Curse record, state reads VM 7F3E / 4BC6 / 4BC5 and G.PartyList', () => {
  hooks.configure(PROFILE.plus);
  const b = new Uint8Array(422);
  b.set([5, 0x41, 0x4C, 0x50, 0x48, 0x41], 0);                       // 'ALPHA'
  b[0x74] = 2; b[0x75] = 2; b[0x109 + 2] = 5; b[0x1A4] = 44; b[0x78] = 44; b[0x19A] = 52; b[0x199] = 44; b[0x195] = 0;
  b[0x197] = 0; b[0xF7] = 0; b[0x127] = 0x10; b[0x128] = 0x27; b[0xFB + 6] = 300 & 0xFF; b[0xFB + 7] = 300 >> 8;
  const c = { b, next: null };
  const s = charSummary(c, 0, 1);
  assert.deepEqual({ name: s.name, race: s.race, cls: s.cls, fighter: s.levels[2], hp: s.hp, hpMax: s.hpMax, ac: s.ac, thac0: s.thac0, xp: s.xp, gold: s.money[3] },
    { name: 'ALPHA', race: 2, cls: 2, fighter: 5, hp: 44, hpMax: 44, ac: 8, thac0: 16, xp: 10000, gold: 300 });
  const m4B = new Map([[0x4BC5, 2], [0x4BC6, 0], [0x4BC7, 5], [0x4BC8, 1], [0x4BC9, 7]]), m7C = new Map([[0x7F3E, 1]]);
  hooks.bind({ G: { PartyList: c, ecl_Block: 1, DataSet: 2, party_MapX: 7, party_MapY: 13, party_Dir: 2 },
    vm: { m0: (a) => m4B.get(a) ?? 0, m1: (a) => m7C.get(a) ?? 0, is3D: () => true, getMem: () => 0 } });
  assert.equal(hooks.state.partyCount(), 1);
  assert.deepEqual(hooks.state.party().map((p) => p.name), ['ALPHA']);
  assert.equal(hooks.state.clock().text, '07:15');
  assert.equal(hooks.state.position().map3d, 2);
});

test('PER-8 events are known (no unknown-event warning)', () => {
  const seen = [];
  const off = hooks.on('*', (p, n) => seen.push(n));
  hooks.emit('npcLeft', { name: 'X' }); hooks.emit('bigPicShown', { id: 121 }); hooks.emit('characterImported', { source: 1 });
  off();
  assert.deepEqual(seen, ['npcLeft', 'bigPicShown', 'characterImported']);
});
