import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const report=JSON.parse(readFileSync(new URL('../../../acceptance/reports/integration/GBP-MAP-2.json',import.meta.url)));
assert.equal(report.steps.length,6);for(const step of report.steps){assert.equal(step.ready,true);assert.deepEqual(step.errors,[]);assert.ok(step.sha256);}
assert.equal(report.steps[2].sha256,report.steps[3].sha256);assert.equal(report.steps[4].sha256,report.steps[5].sha256);
console.log('Map Part 2: real load/movement route idle; panel roundtrips preserve both game screenshots.');
