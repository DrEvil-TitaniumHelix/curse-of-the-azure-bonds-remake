import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const root=new URL('../../../',import.meta.url),read=path=>JSON.parse(readFileSync(new URL(path,root),'utf8'));
const expected=read('game/test/plus/integrate-expected.json');
for(const [key,name] of [['run1','GBP-INTEGRATE-RUN-1'],['p1f','GBP-INTEGRATE-P1-f']]){
 const report=read('acceptance/reports/integration/'+name+'.json');assert.deepEqual(report.steps.map(s=>s.sha256),expected[key].sha256,name);
 for(const s of report.steps){assert.equal(s.ready,true);assert.deepEqual(s.errors,[]);}
}
let references=0;
for(const name of ['GBP-INTEGRATE-LG1','GBP-INTEGRATE-SH1'])for(const s of read('acceptance/reports/acc/'+name+'.json').steps){assert.equal(s.ready,true);assert.deepEqual(s.errors,[]);if(s.ref){assert.equal(s.mismatch_pixels,0,s.ref);references++;}}
assert.equal(references,5);
for(const name of ['GBP-INTEGRATE','GBP-INTEGRATE-COMBAT','GBP-INTEGRATE-SCENARIO'])for(const s of read('acceptance/reports/integration/'+name+'.json').steps){assert.equal(s.ready,true);assert.deepEqual(s.errors,[]);}
console.log('PASS: RUN-1 13/13 identical, P1-f 11/11 identical, five sampled reference rows 0 px; mounted routes idle without browser errors.');
