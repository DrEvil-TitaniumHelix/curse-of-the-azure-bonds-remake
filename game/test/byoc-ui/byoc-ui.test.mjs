// game/test/byoc-ui/byoc-ui.test.mjs — the non-DOM parts of the BYOC screens: saves ZIP round trip, BY-4 cause
// classification and the "Copy report" text, word wrap. Run: node --test game/test/byoc-ui/byoc-ui.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeZip, readZip, crc32 } from '../../byoc/ui/zip.js';
import { wrap } from '../../byoc/ui/ega.js';
import { classify, reportText } from '../../byoc/ui/byoc-ui.js';

test('crc32 of "123456789" = CBF43926', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xCBF43926);
});

test('saves ZIP: write stored, read back identical', async () => {
  const files = [{ name: 'SAVGAMA.DAT', bytes: Uint8Array.from({ length: 13137 }, (_, i) => i * 7) },
    { name: 'CHRDATA1.SAV', bytes: new Uint8Array(285).fill(3) }, { name: 'EMPTY.SPC', bytes: new Uint8Array(0) }];
  const back = await readZip(makeZip(files));
  assert.deepEqual(back.map((f) => f.name), files.map((f) => f.name));
  back.forEach((f, i) => assert.deepEqual(f.bytes, files[i].bytes));
});

test('readZip: deflated entries (DecompressionStream) and a non-ZIP', async () => {
  const data = new TextEncoder().encode('A'.repeat(5000));
  const comp = new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
  const z = makeZip([{ name: 'X.TXT', bytes: comp }]);
  const dv = new DataView(z.buffer);                       // patch method 8, real crc and size into both headers
  const cen = z.length - 22 - (46 + 5);
  for (const [o, m, c, s] of [[0, 8, 14, 22], [cen, 10, 16, 24]]) {
    dv.setUint16(o + m, 8, true); dv.setUint32(o + c, crc32(data), true); dv.setUint32(o + s, data.length, true);
  }
  const [f] = await readZip(z);
  assert.equal(f.bytes.length, 5000);
  await assert.rejects(readZip(new Uint8Array(100)), /not a ZIP/);
});

const rep = (over) => {
  const files = Array.from({ length: 115 }, (_, i) => ({ name: i ? `F${i}.DAX` : 'START.EXE', required: true, status: 'ok', size: 10 }));
  over(files);
  const okCount = files.filter((f) => f.status === 'ok').length;
  const hits = files.filter((f) => f.status !== 'missing').length;
  return { ok: okCount === 115, manifestId: 'por-1.3', files, okCount, requiredCount: 115, likelyOtherVersion: okCount < 115 && hits >= 92, gameOvr: 'absent', saves: [] };
};

test('BY-4 causes: zip, no folder, other version, damaged', () => {
  const none = rep((f) => f.forEach((x) => { x.status = 'missing'; }));
  assert.equal(classify(none, [{ name: 'POOLRAD.ZIP' }]), 'zip');
  assert.equal(classify(none, [{ name: 'README.TXT' }]), 'nofolder');
  assert.equal(classify(rep((f) => f.forEach((x, i) => { if (i === 0 || i > 5) x.status = 'missing'; })), []), 'nofolder');   // 5 stray names, no START.EXE
  assert.equal(classify(rep((f) => f.slice(40, 60).forEach((x) => { x.status = 'hash'; })), []), 'other');
  assert.equal(classify(rep((f) => f.slice(40, 70).forEach((x) => { x.status = 'missing'; })), []), 'damaged');
});

test('Copy report lists only the problems, with sizes and hashes', () => {
  const r = rep((f) => { Object.assign(f[3], { status: 'size', size: 4, expectedSize: 10 }); Object.assign(f[9], { status: 'hash', sha256: 'ab'.repeat(32), expectedSize: 10 }); });
  const t = reportText(r, 'damaged');
  assert.match(t, /required files ok: 113 \/ 115/);
  assert.match(t, /F3\.DAX\tsize\t4\t10\t/);
  assert.match(t, new RegExp(`F9\\.DAX\\thash\\t10\\t10\\t${'ab'.repeat(32)}`));
  assert.equal(t.trim().split('\n').length, 6 + 2);
});

test('wrap: 36 columns, long words cut', () => {
  assert.deepEqual(wrap('aaa bbb ccc', 7), ['aaa bbb', 'ccc']);
  assert.deepEqual(wrap('x'.repeat(10), 4), ['xxxx', 'xxxx', 'xx']);
  assert.deepEqual(wrap('a\n\nb', 10), ['a', '', 'b']);
});
