import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const report=JSON.parse(readFileSync(new URL('../../../acceptance/reports/integration/GBP-PEDIA-2.json',import.meta.url)));
assert.equal(report.steps.length,7);
for(const step of report.steps){assert.equal(step.ready,true);assert.deepEqual(step.errors,[]);assert.ok(step.sha256);}
assert.equal(report.steps[5].sha256,report.steps[6].sha256,'Pedia panel changed the combat canvas');
console.log('Pedia Part 2: real load/encounter/combat route idle; panel leaves combat screenshot unchanged.');
