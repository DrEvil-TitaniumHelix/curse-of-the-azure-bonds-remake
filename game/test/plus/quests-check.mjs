// Run after: node acceptance/integration/run.mjs game/test/plus/quests-run.json  (probe failures are console errors -> step errors)
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const report = JSON.parse(readFileSync(new URL('../../../acceptance/reports/integration/GBP-QUESTS-1.json', import.meta.url)));
assert.equal(report.steps.length, 12);
for (const step of report.steps) { assert.equal(step.ready, true, step.name); assert.deepEqual(step.errors, [], step.name); assert.ok(step.sha256); }
console.log('Quests: 12 idle steps, no errors (install, offer-within-one-event and final tab probes passed).');
