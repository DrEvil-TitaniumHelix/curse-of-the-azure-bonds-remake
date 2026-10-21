// Actual index.html selector / ?dev=1 / persisted Helpers gate. Uses the shared acceptance lock.
import {spawn} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {acquireLock,setLockChild,onRelease,releaseLock} from '../../../acceptance/runlock.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),port=9700+process.pid%200;
await acquireLock('gbp-integrate frontdoor');
const chrome=spawn(process.env.CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new',`--remote-debugging-port=${port}`,`--user-data-dir=${join(tmpdir(),'por-integrate-'+process.pid)}`,'--autoplay-policy=no-user-gesture-required','about:blank'],{stdio:'ignore'});
setLockChild(chrome.pid,'por-integrate-'+process.pid);onRelease(()=>chrome.kill());
let socket;
try{
 let tab;for(let i=0;i<150;i++){try{tab=await(await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json();break;}catch{await sleep(100);}}
 assert.ok(tab,'Chrome started');socket=new WebSocket(tab.webSocketDebuggerUrl);await new Promise(r=>socket.onopen=r);
 let seq=0;const pending=new Map();socket.onmessage=e=>{const m=JSON.parse(e.data);if(pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}};
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq,t=setTimeout(()=>reject(Error(method+' timeout')),20000);pending.set(id,m=>{clearTimeout(t);resolve(m);});socket.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const m=await send('Runtime.evaluate',{expression,awaitPromise:true});if(m.result?.exceptionDetails)throw Error(m.result.exceptionDetails.text);return m.result?.result?.value;};
 async function wait(expression){for(let i=0;i<200;i++){if(await evaluate(expression))return;await sleep(100);}throw Error('wait timeout: '+expression);}
 await send('Page.navigate',{url:'http://127.0.0.1:8188/index.html?dev=1'});
 await wait(`!!document.querySelector('[aria-label="Choose a game"] button')`);
 assert.equal(await evaluate('!!window.E'),false,'game waits for explicit Start');
 await evaluate(`document.querySelector('[aria-label="Choose a game"] button').click()`);
 await wait("!!window.goldBoxPlusTabs && 'cheats' in window.goldBoxPlusTabs");
 assert.equal(await evaluate(`!document.querySelector('[data-tab="cheats"]').hidden`),true,'?dev=1 button');
 await send('Page.navigate',{url:'http://127.0.0.1:8188/index.html?profile=por'});
 await wait("!!window.goldBoxPlusTabs && 'cheats' in window.goldBoxPlusTabs");
 assert.equal(await evaluate(`document.querySelector('[data-tab="cheats"]').hidden`),true,'default dev tools off');
 await evaluate(`goldBoxPlus.open();goldBoxPlus.selectTab('helpers');const box=document.querySelector('[data-setting="devTools"]');box.checked=true;box.dispatchEvent(new Event('change'));`);
 await wait(`!document.querySelector('[data-tab="cheats"]').hidden`);
 await evaluate(`goldBoxPlus.selectTab('cheats')`);assert.equal(await evaluate(`document.getElementById('por-plus-content').textContent.includes('Cheats (developer tools)')`),true);
 await evaluate(`goldBoxPlus.setSetting('original',true)`);assert.equal(await evaluate(`document.querySelector('[data-tab="cheats"]').hidden`),true);
 await evaluate(`goldBoxPlus.setSetting('original',false)`);
 console.log('PASS: index waits for selection; dev=1 and Helpers enable Cheats; original mode hides it.');
}finally{socket?.close();chrome.kill();releaseLock();}
