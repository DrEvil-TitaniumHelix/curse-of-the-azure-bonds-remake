#!/bin/sh
# acceptance/run1_savecmp.sh — RUN-1 save byte compare (cab-build-engine): the DOSBox camp run's route in the build
# (titles, P, wheel, create ALPHA, add, Begin, A, A (map on/off), Encamp, Save B) with that run's seed, then SAVGAMB.DAT /
# CHRDATB1.SAV / .FX from the browser save store vs acceptance/local/saves/camp/ (DOSBox-made, local only).
cd "$(dirname "$0")/.."
K="{Space}{Space}{Space}{Space}Pa{Enter}C{Enter}{Enter}{Enter}{Enter}NALPHA{Enter}EYYA{Enter}A{Esc}B{Enter}{Enter}AAESB"
EV="(async()=>{const o={};for(const n of ['SAVGAMB.DAT','CHRDATB1.SAV','CHRDATB1.FX']){const b=await E.files.readFile(n);o[n]=b?btoa(String.fromCharCode(...b)):null}return JSON.stringify(o)})()"
mkdir -p acceptance/local/savecmp
LIMIT_MS=300000 EVAL="$EV" node acceptance/shoot.mjs "r1-saveB=idle?seed=169084438&wheel=1&freshsaves=1&keys=$K" 2>&1 | grep -v runlock > acceptance/local/savecmp/eval.txt
head -c 300 acceptance/local/savecmp/eval.txt; echo
node --input-type=module -e "
import {readFileSync,writeFileSync} from 'fs';
const t=readFileSync('acceptance/local/savecmp/eval.txt','utf8');const j=JSON.parse(JSON.parse(t.slice(t.indexOf('EVAL = ')+7,t.indexOf('\n'))));
for(const [n,b64] of Object.entries(j)){ if(!b64){console.log(n,'missing in the build');continue}
 const a=Buffer.from(b64,'base64'); writeFileSync('acceptance/local/savecmp/'+n,a);
 const r=readFileSync('acceptance/local/saves/camp/'+n); let d=[];
 for(let i=0;i<Math.max(a.length,r.length);i++) if(a[i]!==r[i]) d.push(i);
 console.log(n,'build',a.length,'dosbox',r.length,'differing bytes',d.length, d.slice(0,40).map(x=>x.toString(16)).join(' '));}"
