// Run after: node acceptance/integration/run.mjs game/test/plus/helpers-run.json  (probe failures are console errors -> step errors)
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const report = JSON.parse(readFileSync(new URL('../../../acceptance/reports/integration/GBP-HELPERS-1.json', import.meta.url)));
assert.equal(report.steps.length, 23);
for (const step of report.steps) { assert.equal(step.ready, true, step.name); assert.deepEqual(step.errors, [], step.name); assert.ok(step.sha256); }
console.log('Helpers: 23 idle steps, no errors (toggles on/off with the game canvas unchanged, spell preset typed in camp, combat log of a real fight up to its treasure).');
