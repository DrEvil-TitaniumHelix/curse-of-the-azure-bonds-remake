// game/test/areas/run_all.mjs — runs every cab-build-areas test (import check, link check, VIEW/PARTY/MAGIC/COMBAT units).
// Run: node game/test/areas/run_all.mjs   (exit 1 if any test file fails)
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const T = (p) => fileURLToPath(new URL(p, import.meta.url));
let bad = 0;
for (const f of ['./import_check.mjs', './link_check.mjs', '../view/view_units.test.mjs', '../party/party_units.test.mjs',
  '../magic/magic_units.test.mjs', '../combat/combat_units.test.mjs']) {
  const r = spawnSync(process.execPath, [T(f)], { encoding: 'utf8' });
  const last = (r.stdout.trim().split('\n').pop() || '').trim();
  console.log((r.status === 0 ? 'PASS ' : 'FAIL ') + f + '  ' + last);
  if (r.status !== 0) { bad++; process.stdout.write(r.stdout.split('\n').filter((l) => !l.startsWith('ok')).join('\n') + r.stderr); }
}
process.exit(bad ? 1 : 0);
