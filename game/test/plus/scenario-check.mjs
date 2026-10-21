import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const report=JSON.parse(readFileSync(new URL('../../../acceptance/reports/integration/GBP-SCENARIO.json',import.meta.url)));
assert.equal(report.steps.length,5);for(const step of report.steps){assert.equal(step.ready,true);assert.deepEqual(step.errors,[]);}
assert.ok(report.steps[2].sha256);assert.equal(new Set(report.steps.slice(2).map(s=>s.sha256)).size,1);
console.log('Scenario workshop: five idle steps, no errors; game canvas unchanged.');
