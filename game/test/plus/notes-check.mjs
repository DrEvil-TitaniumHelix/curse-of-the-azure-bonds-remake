import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const report=JSON.parse(readFileSync(new URL('../../../acceptance/reports/integration/GBP-NOTES.json',import.meta.url)));
assert.equal(report.steps.length,36);
for(const step of report.steps){assert.equal(step.ready,true,step.name);assert.deepEqual(step.errors,[]);}
assert.equal(report.steps.at(-1).sha256,report.steps.at(-2).sha256);
console.log('Notes: complete camp route idle, no browser errors; Journal roundtrip preserves final game canvas. Inspect final probe for diary and IndexedDB assertions.');
