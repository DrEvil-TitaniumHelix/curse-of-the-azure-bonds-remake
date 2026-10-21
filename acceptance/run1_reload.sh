#!/bin/sh
# acceptance/run1_reload.sh — RUN-1 save/quit/reload (cab-build-engine): tab 1 = acceptance/run1.sh's chain + camp, memorize,
# rest, Save A, Quit to DOS Y; tab 2 (same Chrome profile = same save store, no freshsaves) = titles, P, wheel, L, A, Begin.
cd "$(dirname "$0")/.."
C=""; for n in ALPHA BETA GAMMA DELTA EPSI; do C="${C}C{Enter}{Enter}{Enter}{Enter}N${n}{Enter}EYY"; done
C="${C}C{End}{End}{End}{End}{End}{Enter}{Enter}{End}{End}{Enter}{Enter}NZETA{Enter}EYY"
K="{Space}{Space}{Space}{Space}Pa{Enter}${C}A{Enter}A{End}A{End}A{End}A{End}A{End}A{Esc}B{Enter}{Enter}"
CAMP="E{End}{End}{End}{End}{End}{End}MMMMMEEYRR{wait}{wait}{wait}{wait}ESA"
EV="JSON.stringify({x:E.G.party_MapX,y:E.G.party_MapY,d:E.G.party_Dir,vm:E.G.view_Mode,blk:E.G.ecl_Block,clock:[...E.G.ecl_Mem4B00.slice(0x63,0x6a)],party:(()=>{const o=[];for(let c=E.G.PartyList;c;c=c.next)o.push(String.fromCharCode(...c.b.subarray(1,1+c.b[0]))+':'+c.b[0x1A4]+':'+[...c.b.subarray(0x1E,0x26)].join('.'));return o.join(',')})(),term:!!window.__terminated,zeta:(()=>{let c=E.G.PartyList;while(c&&String.fromCharCode(...c.b.subarray(1,1+c.b[0]))!=='ZETA')c=c.next;if(!c)return null;const o=[];for(let i=0x1E;i<0x72;i++)if(c.b[i])o.push(i.toString(16)+'='+c.b[i].toString(16));return o.join(' ')})(),err:window.__engineError&&window.__engineError.message})"
LIMIT_MS=${LIMIT_MS:-400000} EVAL="$EV" node acceptance/shoot.mjs \
  "r1-save=idle?seed=169084438&wheel=1&freshsaves=1&keys=$K${CAMP}" \
  "r1-quit=idle?seed=169084438&wheel=1&freshsaves=1&keys=$K${CAMP}Y" \
  "r1-reload=idle?wheel=1&keys={Space}{Space}{Space}{Space}Pa{Enter}LAB" 2>&1 | grep -v runlock
