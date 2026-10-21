// Validate the report emitted by: node acceptance/integration/run.mjs game/test/plus/shell-run.json
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const report = JSON.parse(readFileSync(new URL('../../../acceptance/reports/integration/GBP-SHELL.json', import.meta.url)));
assert.equal(report.steps.length, 5);
for (const step of report.steps) { assert.equal(step.ready, true); assert.deepEqual(step.errors, []); }
const shots = report.steps.slice(2).map(s => s.sha256);
assert.ok(shots[0]); assert.equal(new Set(shots).size, 1, 'explore canvas changed across panel roundtrip');
console.log('GBP shell: all steps idle, no errors, before/roundtrip/after screenshots identical.');
