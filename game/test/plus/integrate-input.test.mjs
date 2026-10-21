import test from 'node:test';
import assert from 'node:assert/strict';
import {setInputPauseGate,pushChar,pushExt,ReadKey,KeyPressed,script} from '../../engine/input.js';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
test('Plus pause preserves queued BIOS keys, pending extended scans and script keys',async()=>{
 let paused=false;setInputPauseGate(()=>paused);pushChar('A');paused=true;
 assert.equal(KeyPressed(),false);let done=false;const pending=ReadKey().then(c=>{done=true;return c;});await delay(160);assert.equal(done,false);
 pushChar('B');paused=false;assert.equal(await pending,'A');assert.equal(KeyPressed(),false);
 pushExt(0x48);assert.equal(await ReadKey(),'\0');paused=true;assert.equal(KeyPressed(),false);paused=false;assert.equal((await ReadKey()).charCodeAt(0),0x48);
 script.keys=[[65,0]];script.idleSince=performance.now()-1000;paused=true;assert.equal(KeyPressed(),false);assert.deepEqual(script.keys,[[65,0]]);paused=false;script.keys=[];setInputPauseGate(null);
});
