#!/bin/sh
# acceptance/run1.sh <name> <extra keys> — RUN-1 key route replay (cab-build-engine; acceptance/integration/RUN-1.md).
# The chain from index.html: titles (Space x4, as the DOSBox route) -> P at the Play Demo prompt -> rune wheel (?wheel=1,
# any key) -> create five dwarf fighters ALPHA..EPSI and a human magic-user ZETA (Enter = first entry of each list, N = keep the roll, icon E/Y, save Y)
# -> Add all six -> Begin; then the extra keys. Seed = the DOSBox camp run's (06:22:10.20), empty save store.
# Shot when the key script is done and the game idles (SCREEN=idle, default) or after SCREEN=t<s> seconds.
C=""; for n in ALPHA BETA GAMMA DELTA EPSI; do C="${C}C{Enter}{Enter}{Enter}{Enter}N${n}{Enter}EYY"; done
C="${C}C{End}{End}{End}{End}{End}{Enter}{Enter}{End}{End}{Enter}{Enter}NZETA{Enter}EYY"   # ZETA: human magic-user (caster for camp/memorize)
K="{Space}{Space}{Space}{Space}Pa{Enter}${C}A{Enter}A{End}A{End}A{End}A{End}A{End}A{Esc}B{Enter}{Enter}"
EV="JSON.stringify({x:E.G.party_MapX,y:E.G.party_MapY,d:E.G.party_Dir,vm:E.G.view_Mode,blk:E.G.ecl_Block,ds:E.G.DataSet,clock:[...E.G.ecl_Mem4B00.slice(0x63,0x6a)],party:(()=>{const o=[];for(let c=E.G.PartyList;c;c=c.next)o.push(String.fromCharCode(...c.b.subarray(1,1+c.b[0]))+':'+c.b[0x1A4]);return o.join(',')})(),err:window.__engineError&&window.__engineError.message})"
cd "$(dirname "$0")/.." && LIMIT_MS=${LIMIT_MS:-300000} EVAL="$EV" node acceptance/shoot.mjs "$1=${SCREEN:-idle}?seed=169084438&wheel=1&freshsaves=1&keys=$K$2" 2>&1 | grep -v runlock
