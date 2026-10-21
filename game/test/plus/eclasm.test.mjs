// eclasm.test.mjs (cab-plus-shell, S7 W12): the ECL assembler round trip. Every listing of decode/ecl/scripts (written by
// decode/tools/ecldis.py) assembles back to the record bytes of the player's own ECLn.DAX, byte for byte (25/25), and a
// small edited listing assembles to the expected bytes. Needs the player's folder (CAB_DATA, default
// ../re-targets/goldbox/cotab/curazure next to the repo) for the round trip.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { assemble, packString, unpackString, encodeOperand } from '../../plus/scenario/eclasm.js';
import { archiveRecords } from '../../plus/pedia/build.js';
const root = new URL('../../../', import.meta.url);
const folder = process.env.CAB_DATA || fileURLToPath(new URL('../re-targets/goldbox/cotab/curazure/', root));
const scripts = fileURLToPath(new URL('decode/ecl/scripts/', root));
// the listings hold the game's texts: private workspace only (not in the public tree, where this test skips)
const listings = existsSync(scripts) ? readdirSync(scripts).filter((f) => /^ECL\d_\d+\.ecl\.txt$/.test(f)).sort() : [];

test('operands and six-bit strings encode as ecldis.py reads them', () => {
 assert.deepEqual(encodeOperand('#09'), [0, 9]); assert.deepEqual(encodeOperand('#0109'), [2, 9, 1]);
 assert.deepEqual(encodeOperand('[4BFE]'), [1, 0xFE, 0x4B]); assert.deepEqual(encodeOperand("[4BFE]'"), [3, 0xFE, 0x4B]);
 assert.deepEqual(encodeOperand('$[7C00]'), [0x81, 0, 0x7C]); assert.deepEqual(encodeOperand('?t05:11'), [5, 0x11]);
 for (const t of ['YOU AWAKEN IN A SMALL ROOM.', 'A', 'ENTRY 4.', "'PLEASE CALM DOWN'"]) assert.equal(unpackString(packString(t)), t);
 assert.throws(() => packString('@'), /except @/);
});
test('a scenario listing assembles to the expected bytes', () => {
 const listing = ['; record header (skipped by LoadEclBlock): 88 13 ; code 8000..801D (30 bytes)',
  '8000  01 01 14 80              GOTO 8014        ; header vector 1', '8004  01 01 14 80              GOTO 8014        ; header vector 2',
  '8008  01 01 14 80              GOTO 8014        ; header vector 3', '800C  01 01 14 80              GOTO 8014        ; header vector 4',
  '8010  01 01 14 80              GOTO 8014        ; header vector 5', '8014  09 00 07 01 4B C0        SAVE            #07, [C04B]',
  '801A  12 80 01 04            PRINTCLEAR      "A"', '801E  00                       EXIT'].join('\n');
 assert.throws(() => assemble(listing), /outside record extent/);
 const ok = assemble(listing.replace('801D (30 bytes)', '801E (31 bytes)'));
 assert.deepEqual([...ok.slice(0, 2)], [0x88, 0x13]); assert.equal(ok.length, 2 + 0x1F);
 assert.deepEqual([...ok.slice(2 + 0x14)], [0x09, 0, 7, 1, 0x4B, 0xC0, 0x12, 0x80, 1, 0x04, 0x00]);
});
test(`round trip: the ${listings.length} decode listings assemble to the player's ECL records byte for byte`, { skip: !existsSync(folder) ? 'local player copy unavailable' : !listings.length ? 'decode listings not in this tree (public)' : false }, () => {
 assert.equal(listings.length, 25);
 const archives = new Map(), failed = [];
 for (const file of listings) {
  const [, set, rec] = /^ECL(\d)_(\d+)/.exec(file);
  if (!archives.has(set)) archives.set(set, archiveRecords(new Uint8Array(readFileSync(path.join(folder, `ECL${set}.DAX`)))));
  const want = archives.get(set).get(Number(rec));
  try { const got = assemble(readFileSync(path.join(scripts, file), 'utf8')); if (!want || Buffer.compare(Buffer.from(got), Buffer.from(want)) !== 0) failed.push(`${file}: ${got.length} vs ${want?.length}`); }
  catch (e) { failed.push(`${file}: ${e.message}`); }
 }
 assert.deepEqual(failed, [], `${listings.length - failed.length}/${listings.length} identical`);
});
