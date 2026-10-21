// Run after: node acceptance/integration/run.mjs game/test/profiles/profile-run.json
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const report = JSON.parse(readFileSync(new URL('../../../acceptance/reports/integration/GBP-PROFILE.json',import.meta.url)));
assert.equal(report.steps.length,5);
for (const step of report.steps) { assert.equal(step.ready,true); assert.deepEqual(step.errors,[]); }
const shots = report.steps.slice(2).map(s => s.sha256);
assert.ok(shots[0]); assert.equal(new Set(shots).size,1);
console.log('GBP profile acceptance: five idle steps, no errors, explore before/selector/after screenshots identical.');
