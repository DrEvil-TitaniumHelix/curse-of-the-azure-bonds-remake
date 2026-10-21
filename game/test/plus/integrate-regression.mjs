// Reuse the locked acceptance runner. An animation probe captures its matching natural
// frame atomically; retaining that PNG prevents the runner's later 300ms delay selecting
// another fire frame. No framebuffer writes, masking or palette substitutions.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=new URL('../../../',import.meta.url),source=readFileSync(new URL('acceptance/integration/run.mjs',root),'utf8');
const original="return document.getElementById('screen').toDataURL('image/png'); })()`);";
if(!source.includes(original))throw Error('acceptance capture boundary changed');
const patched=source.replace(original,"const snapshot=window.__integrateMatchedShot || document.getElementById('screen').toDataURL('image/png'); delete window.__integrateMatchedShot; return snapshot; })()`);");
const location=new URL('acceptance/local/integrate-capture.mjs',root);mkdirSync(new URL('acceptance/local/',root),{recursive:true});writeFileSync(location,patched);
const result=spawnSync(process.execPath,[fileURLToPath(location),process.argv[2]||'game/test/plus/gbp-integrate-run-1.json'],{cwd:fileURLToPath(root),stdio:'inherit'});process.exitCode=result.status??1;
