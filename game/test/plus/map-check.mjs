// Run after: node acceptance/integration/run.mjs game/test/plus/map-run.json
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const report=JSON.parse(readFileSync(new URL('../../../acceptance/reports/integration/GBP-MAP-1.json',import.meta.url)));
assert.equal(report.steps.length,5);
for(const step of report.steps){assert.equal(step.ready,true);assert.deepEqual(step.errors,[]);assert.ok(step.sha256);}
assert.equal(new Set(report.steps.slice(2).map(s=>s.sha256)).size,1,'Map tab changed the explore canvas');
console.log('Map Part 1: five idle steps, no errors, explore canvas unchanged.');
