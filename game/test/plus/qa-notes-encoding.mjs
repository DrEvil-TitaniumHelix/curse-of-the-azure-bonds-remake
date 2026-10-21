// Synthetic dialogue only; verify the separator produced by the real diary formatter.
import {writeFileSync} from 'node:fs';
import {createNotesTracker} from '../../plus/notes/tracker.js';
let listener;const bus={enabled:true,state:{slot:'A',position:()=>null},on(_name,fn){listener=fn;return()=>{};}};
const tracker=createNotesTracker({bus});listener({text:'Synthetic QA dialogue',choice:'PARLAY'},'npcTalk');await tracker.flush();
const actual=tracker.notes[0].text,expected='Synthetic QA dialogue '+String.fromCodePoint(0x2014)+' PARLAY';
const result={name:'QA-NOTES-ENCODING',pass:actual===expected,actual,expected,source:'Real notes/tracker.js formatter, synthetic event payload; no game text or state involved.'};
writeFileSync(new URL('../../../acceptance/plus/reports/QA-NOTES-ENCODING.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));tracker.dispose();
