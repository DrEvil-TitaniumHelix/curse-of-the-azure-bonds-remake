// Run after: node acceptance/integration/run.mjs game/test/plus/cheats-run.json  (probe failures are console errors -> step errors)
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const report = JSON.parse(readFileSync(new URL('../../../acceptance/reports/integration/GBP-CHEAT-1.json', import.meta.url)));
assert.equal(report.steps.length, 6);
for (const step of report.steps) { assert.equal(step.ready, true, step.name); assert.deepEqual(step.errors, [], step.name); assert.ok(step.sha256); }
console.log('Cheats: 6 idle steps, no errors (sokal-gate loaded at 4/21 (8,14) N with six level-5 members; tab edits, flag, teleport, original-mode off).');
