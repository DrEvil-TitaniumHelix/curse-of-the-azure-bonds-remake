#!/bin/sh
# acceptance/areas_shots.sh <group> [WAIT_S] (cab-build-areas) — build shots of the Areas rows of ACCEPTANCE.md against their
# DOSBox-X references. Each route replays the DOSBox run's keys (acceptance/ref/scripts/runs/*.txt) from the RUN-1 base: the
# camp run's seed (06:22:10.20 = 169084438), empty save store, titles -> Play -> wheel -> create ALPHA (first entry of every
# list, keep the roll) -> add -> Begin. Shots land in acceptance/local/shoot/<name>.png (idle = the screen when the keys are
# done and the game waits), then acceptance/cmp.mjs compares each with acceptance/local/ref/REF-<id>.png (exact RGB).
# One group = one shoot.mjs (about a minute per shot: each replays the route), sized to fit a 10-minute call.
# Runs in the foreground under the shared run lock (acceptance/ref/scripts/locked_cmd.sh, bounded wait WAIT_S, default 300).
# Starts its own dev server (tools/serve.py 8190 --dev --saves $SAVES, default acceptance/local/run2saves) per call.
#   camp1, camp2 = camp.txt (fresh ALPHA: map, camp menu, alter/speed, view/drop coins (-> save D state), magic and rest menus)
#   saveD  = areas1.txt (from the save D state: party summary + location line, display, order, pictures, drop, view)
#   refs WAIT_S ID... = any references whose run loaded a DOSBox save: the route is the reference's own steps
#          (acceptance/areas_route.py), unseeded as RUN-2, with ?loadsaves=1. The shared server (8189) serves
#          cab-build-engine's acceptance/local/run2saves (B C D); with SAVES=<dir> (e.g. acceptance/local/saves/walk5 for
#          save E) a private server on 8190 serves that folder for this call only.
cd "$(dirname "$0")/.." || exit 1
B='seed=169084438&wheel=1&freshsaves=1&keys={Space}{Space}{Space}{Space}Pa{Enter}C{Enter}{Enter}{Enter}{Enter}NALPHA{Enter}EYYA{Enter}A{Esc}B{Enter}{Enter}'
C1="AAESBNASSEESCNV"                   # camp.txt: map, back, camp, save B, alter speed slower, exits, save C, view
D="${C1}D{Enter}10{Enter}EESDN"         # drop 10 platinum, exits, save D (camp.txt) = the state areas1.txt loads
A="${D}E"                               # leave camp: the 3D view, as areas1's Load D + Begin
# cleric = walk10..13 (human cleric BETA: race 5x End, first class/alignment; camp, memorize, rest, cast). The DOSBox runs
# were not seeded like the camp run, so the rolled abilities (and what follows from them: HP, spell slots) may differ.
CB=$(printf '%s' "$B" | sed 's/C{Enter}{Enter}{Enter}{Enter}NALPHA/C{End}{End}{End}{End}{End}{Enter}{Enter}{Enter}{Enter}NBETA/')
# seed method (acceptance/seedfind.mjs: DOS-clock RandSeed recovered from the rolled BETA): walk10 10:22:33.22, walk11
# 10:39:57.24, walk12 10:46:50.23 (walk13 loaded walk12's save F, so its BETA is walk12's)
C10=$(printf '%s' "$CB" | sed 's/seed=169084438/seed=555092502/'); C11=$(printf '%s' "$CB" | sed 's/seed=169084438/seed=957876775/')
C12=$(printf '%s' "$CB" | sed 's/seed=169084438/seed=840370734/')
H6='{Home}{Home}{Home}{Home}{Home}{Home}'
M2="EMM${H6}{Enter}{Enter}"                # walk11: camp, magic, memorize CURE LIGHT WOUNDS twice
W24=$(printf '{wait}%.0s' $(seq 24))       # 24 idle ticks of 250 ms: the rest runs out before the next key (a key
                                         # typed while resting asks STOP RESTING?, as in the original)
M3="${M2}{Home}{Home}{Enter}EEYRR${W24}"   # walk12/13: + BLESS, exit, exit, Yes; Rest from the magic menu, Rest
WAIT=${2:-300}
case "$1" in
  refs) shift 2; L=""
        # SEED=<n>: fixed RandSeed (the script's random town texts and fights; unseeded otherwise, as RUN-2); TAG names the shots
        for i in "$@"; do L="$L d${TAG}-$i:$i=idle?${SEED:+seed=$SEED&}wheel=1&freshsaves=1&loadsaves=1&keys=$(python -I acceptance/areas_route.py "$i")"; done
        set -- $L ;;
  camp1) set -- "b-S049:S049=idle?$B" "b-S050:S050=idle?${B}A" "b-S077:S077=idle?${B}AAE" "b-S082:S082=idle?${B}AAESBNA" \
          "b-S086:S086=idle?${B}AAESBNAS" "b-S086-SLOWER:S086-SLOWER=idle?${B}AAESBNASS" ;;
  camp2) set -- "b-S095:S095=idle?${B}$C1" "b-S105:S105=idle?${B}${C1}D" "b-S105-AMOUNT:S105-AMOUNT=idle?${B}${C1}D{Enter}" "b-S078:S078=idle?${B}${D}M" \
          "b-S089:S089=idle?${B}${D}MER" ;;
  saveD) set -- "b-S060:S060=idle?${B}$A" "b-S060:S062=" "b-S083:S083=idle?${B}${A}EMCMSD" \
          "b-S084:S084=idle?${B}${A}EMCMSDEEAO" "b-S088:S088=idle?${B}${A}EMCMSDEEAOEP" \
          "b-S085:S085=idle?${B}${A}EMCMSDEEAOEPED" "b-S096:S096=idle?${B}${A}EMCMSDEEAOEPEDNEV" ;;
  cleric) set -- "c-S080:S080=idle?${C10}EMM" "c-S093:S093=idle?${C11}EMM${H6}" "c-S080-LIST:S080-LIST=idle?${C11}${M2}E" \
          "c-S080-CONFIRM:S080-CONFIRM=idle?${C11}${M2}EE" ;;
  cleric2) set -- "c-S079:S079=idle?${C12}${M3}C" "c-S094:S094=idle?${C12}${M3}C{Enter}" \
          "c-S106:S106=idle?${C12}${M3}EVS" ;;
  cleric3) set -- "c-S091:S091=S091?${C11}${M2}EEYRR" "c-S091:S090=" "c-S079-CASTS:S079-CASTS=S079-CASTS?${C12}${M3}C{Enter}" \
          "c-S132:S132=S132?${C12}${M3}C{Enter}{Enter}" ;;   # timed lines: shot hooks dev.screenSoon (magic_ov22 ShowCasts,
                                                           # party_ov24 ShowHealingResult) instead of idle
  *) echo "usage: $0 camp1|camp2|saveD|cleric|cleric2|cleric3 [WAIT_S] | refs WAIT_S ID..."; exit 2 ;;
esac
shots=""; pairs=""
for r in "$@"; do
  name=${r%%:*}; rest=${r#*:}; id=${rest%%=*}; url=${rest#*=}
  [ -n "$url" ] && shots="$shots
$name=$url"
  pairs="$pairs REF-$id=$name"
done
printf '%s\n' "$shots" | sed '/^$/d' > "${TMPDIR:-/tmp}/areas_shots.$$"
SPID=""
SAVES=${SAVES:-acceptance/local/run2saves}
if true; then                             # private dev server for this call (port 8190, the saves of SAVES; stopped below)
  python -I tools/serve.py 8190 --dev --saves "$SAVES" > /dev/null 2>&1 &
  SPID=$!; export GAME_URL=http://127.0.0.1:8190/index.html
  for i in $(seq 40); do curl -s -o /dev/null http://127.0.0.1:8190/index.html && break; sleep 0.5; done
fi
# one shoot.mjs per group (one Chrome); the URLs carry & and {}, so they go through xargs -d '\n' unchanged
LIMIT_MS=${LIMIT_MS:-120000} xargs -d '\n' -a "${TMPDIR:-/tmp}/areas_shots.$$" bash acceptance/ref/scripts/locked_cmd.sh "$WAIT" node acceptance/shoot.mjs > "${TMPDIR:-/tmp}/areas_shots.$$.log" 2>&1
rc=$?; grep -v '^runlock' "${TMPDIR:-/tmp}/areas_shots.$$.log"
rm -f "${TMPDIR:-/tmp}/areas_shots.$$" "${TMPDIR:-/tmp}/areas_shots.$$.log"
[ -n "$SPID" ] && { taskkill //F //PID "$(cat /proc/$SPID/winpid 2>/dev/null || echo $SPID)" > /dev/null 2>&1 || kill "$SPID"; }
[ "$rc" -ne 0 ] && { echo "no comparison: the shots did not run or failed (exit $rc)"; exit "$rc"; }
node acceptance/cmp.mjs --pairs $pairs
