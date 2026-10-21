// Sequential replay batch; each child acquires the shared one-browser lock itself.
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=new URL('../../../',import.meta.url),args=process.argv.slice(2),routes=[];
if(args.includes('--original')){
 const coverage=JSON.parse(readFileSync(new URL('acceptance/plus/original/coverage.json',root),'utf8'));
 for(const name of new Set(Object.values(coverage.rows)))routes.push('acceptance/plus/original/'+name+'.json');
}else routes.push(...args);
if(!routes.length)throw Error('Specify route paths or --original');
for(const route of routes){
 console.log('QA replay: '+route);
 const result=spawnSync(process.execPath,['game/test/plus/qa-run.mjs',route],{cwd:fileURLToPath(root),stdio:'inherit'});
 if(result.status!==0)process.exit(result.status||1);
}
