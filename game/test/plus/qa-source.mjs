import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve,sep} from 'node:path';
const root=process.env.QA_PRODUCTION_ROOT?pathToFileURL(resolve(process.env.QA_PRODUCTION_ROOT)+sep):new URL('../../../',import.meta.url);
export function productionSnapshot(){
 const files=['game/index.html'];
 const walk=path=>{for(const entry of readdirSync(new URL(path+'/',root),{withFileTypes:true})){const name=path+'/'+entry.name;if(entry.isDirectory())walk(name);else if(/\.(js|json|css|html)$/.test(name))files.push(name);}};
 for(const path of ['game/engine','game/areas','game/plus','game/profiles','game/scenarios'])walk(path);
 const hash=createHash('sha256');for(const file of files.sort())hash.update(file+'\0').update(readFileSync(new URL(file,root))).update('\0');
 const head=spawnSync('git',['rev-parse','HEAD'],{cwd:fileURLToPath(root),encoding:'utf8'}).stdout.trim();
 return {head,productionSha256:hash.digest('hex'),files:files.length};
}
if(process.argv[1]===fileURLToPath(import.meta.url))console.log(JSON.stringify(productionSnapshot()));
