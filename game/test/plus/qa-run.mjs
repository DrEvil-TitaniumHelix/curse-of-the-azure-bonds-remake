import {productionSnapshot} from './qa-source.mjs';
import {readFileSync,writeFileSync,mkdirSync,statSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=new URL('../../../',import.meta.url),route=process.argv[2],spec=JSON.parse(readFileSync(route,'utf8'));
const snapshot=productionSnapshot();
const preflight=spawnSync(process.execPath,['--input-type=module','--check'],{input:readFileSync(new URL('game/engine/main.js',root),'utf8'),encoding:'utf8'});
if(preflight.status!==0){process.stderr.write(preflight.stderr);throw Error('Boot module syntax preflight failed; no Chrome started');}
let source=readFileSync(new URL(spec.runner==='acc'?'acceptance/acc/run_at.mjs':'acceptance/integration/run.mjs',root),'utf8');
source=source.replace("const url = `${BASE}?screen=idle&${run.query || ''}`;", "const url = `${BASE}?screen=${run.screen || 'idle'}&${run.query || ''}`;");
source=source.replace('  for (let n = 0; n < run.steps.length; n++) {', `  if(run.bootProbe){await s.send('Page.enable');await s.send('Page.addScriptToEvaluateOnNewDocument',{source:run.bootProbe});await s.send('Page.reload');await new Promise(r=>setTimeout(r,300));}\n  for (let n = 0; n < run.steps.length; n++) {`);
source=source.replace('    if (st.probe) {','    let probeResult=null;\n    if (st.probe) {');
source=source.replace('      console.log(`${run.name} ${n + 1} probe: ${pv}`);',"      try { probeResult=JSON.parse(pv); } catch { probeResult={pass:false,error:pv}; }\n      console.log(`${run.name} ${n + 1} probe: ${pv}`);");
source=source.replace("report.push({ step: n + 1,", "report.push({ probe: probeResult, step: n + 1,");
source=source.replace('    const errs = s.errors.slice(e0);', String.raw`    const errs = s.errors.slice(e0);
    if(n===0 && ready){const rawHealth=await evalv("JSON.stringify((()=>{const c=document.getElementById('screen'),p=c.getContext('2d').getImageData(0,0,c.width,c.height).data;return {dataReady:!!window.E?.G?.ds,visiblePixels:p.some((v,i)=>i%4!==3&&v!==0),bootError:document.getElementById('err')?.textContent||''};})())");const health=rawHealth?JSON.parse(rawHealth):null;if(!health?.dataReady||!health.visiblePixels||health.bootError)errs.push('QA boot health failed: '+JSON.stringify(health));}`);
const capture="return document.getElementById('screen').toDataURL('image/png'); })()`);";
source=source.replaceAll("const data = await evalv(`(() => { const E =", "const data = await evalv(`(async () => { const E =");
source=source.replaceAll(capture,"if(window.__integrateMatchedShot){const shot=window.__integrateMatchedShot;delete window.__integrateMatchedShot;return shot;} const target=${JSON.stringify(st.captureHash||null)},canvas=document.getElementById('screen'); if(target){const deadline=performance.now()+3000;do{if(window.E)window.E.pic.display.present();const snapshot=canvas.toDataURL('image/png'),pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data,hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',pixels))].map(b=>b.toString(16).padStart(2,'0')).join('');if(hash===target)return snapshot;await new Promise(r=>setTimeout(r,40));}while(performance.now()<deadline);} return canvas.toDataURL('image/png'); })()`);");
// PID-only Chrome profiles can be reused by Windows and retain another route's original-mode setting.
const browserTag=Date.now()+'-'+Math.random().toString(16).slice(2);
source=source.replaceAll('por-qa-${process.pid}', 'por-qa-${process.pid}-'+browserTag);
const path=new URL(`acceptance/local/qa-capture-${process.pid}.mjs`,root);mkdirSync(new URL('acceptance/local/',root),{recursive:true});writeFileSync(path,source);
const startedAt=Date.now();
source=source.replace("if (errs.some((e) => /ENGINE ERROR/.test(e))", "if (errs.some((e) => /QA boot health failed/.test(e)) || errs.some((e) => /ENGINE ERROR/.test(e))");
writeFileSync(path,source);
const result=spawnSync(process.execPath,[fileURLToPath(path),route],{cwd:fileURLToPath(root),stdio:'inherit'});
const category=spec.runner==='acc'?'acc':'integration';const report=new URL(`acceptance/reports/${category}/${spec.name}.json`,root);
try {if(statSync(report).mtimeMs<startedAt)throw Error('No fresh report; previous evidence retained');mkdirSync(new URL('acceptance/plus/reports/',root),{recursive:true});const actual=JSON.parse(readFileSync(report,'utf8')),after=productionSnapshot();actual.qa={...snapshot,startedAt:new Date(startedAt).toISOString(),finishedAt:new Date().toISOString(),stableProduction:snapshot.productionSha256===after.productionSha256};writeFileSync(new URL(`acceptance/plus/reports/${spec.name}.json`,root),JSON.stringify(actual,null,1)+'\n');} catch {}
process.exitCode=result.status??1;
