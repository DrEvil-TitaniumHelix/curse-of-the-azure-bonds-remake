// Run after: node acceptance/integration/run.mjs game/test/plus/mods-run.json
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const report=JSON.parse(readFileSync(new URL('../../../acceptance/reports/integration/GBP-MODS.json',import.meta.url)));
assert.equal(report.steps.length,7);
for(const step of report.steps){assert.equal(step.ready,true);assert.deepEqual(step.errors,[]);}
const steps=report.steps;for(const step of steps)assert.ok(step.sha256);
assert.notEqual(steps[3].sha256,steps[4].sha256,'sample did not change the three-PIC atlas');
assert.equal(steps[3].sha256,steps[5].sha256,'disabled/original-mode atlas differs from original');
assert.equal(steps[2].sha256,steps[6].sha256,'explore canvas did not restore exactly');
console.log('Mods: recoloured atlas differs; disabled/original atlas and restored explore canvas are pixel-identical.');
