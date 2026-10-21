// Run after: node acceptance/integration/run.mjs game/test/plus/pedia-run.json
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const report=JSON.parse(readFileSync(new URL('../../../acceptance/reports/integration/GBP-PEDIA-1.json',import.meta.url)));
assert.equal(report.steps.length,5);
for(const step of report.steps) {assert.equal(step.ready,true);assert.deepEqual(step.errors,[]);}
const shots=report.steps.slice(2).map(s=>s.sha256);assert.ok(shots[0]);assert.equal(new Set(shots).size,1);
console.log('Pedia Part 1: five idle steps, no errors, explore canvas unchanged.');
