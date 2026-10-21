#!/bin/sh
# acceptance/plus/gate.sh <off|on> [id ...] — Gold Box Plus original-mode gate (cab-build-engine; acceptance/plus/GATE.md).
# the owner 10/21: the gate runs on the spot-check screens (ACCEPTANCE.md "Spot check", picked by cab-build-areas) + RUN-1;
# the game logic is proven without pictures by acceptance/TRACE.md.
#   off  = Plus mounted, master switch "Play the original game" on (?plus=0): hooks off; shots g0-<id>
#   on   = Plus mounted and on (the default boot) with the event log (?hooklog=1), no Plus UI open; shots g1-<id>
# Each shot is compared with its reference (acceptance/cmp.mjs; S054 / S053 = the two phases of the blinking party
# marker, either phase counts) and, for the explained-DIFF row S113, with the recorded build shot (same pixels as before).
# Needs: python -I tools/serve.py 8189 --dev --saves acceptance/local/gatesaves (the DOSBox saves B C D (camp run),
# E (walk7) and G (patched overland), local).
cd "$(dirname "$0")/../.."
MODE=$1; shift
case "$MODE" in off) P="&plus=0"; T=g0 ;; on) P="&hooklog=1"; T=g1 ;; *) echo "usage: gate.sh off|on [id ...]"; exit 2 ;; esac
IDS="$*"
T4="{Space}{Space}{Space}{Space}Pa{Enter}"
A1="${T4}C{Enter}{Enter}{Enter}{Enter}NALPHA{Enter}EYYA{Enter}A{Esc}B{Enter}{Enter}"   # RUN-1 step 1 / the camp run
cmpq() { node acceptance/cmp.mjs --pairs "$1=$2" 2>&1 | tail -1; }
row() {   # <id> <shoot target?query> <ref ...>
  id=$1; q=$2; shift 2
  case " $IDS " in *" $id "*|"  ") ;; *) return ;; esac
  LIMIT_MS=${LIMIT_MS:-300000} node acceptance/shoot.mjs "$T-$id=$q$P" 2>&1 | grep -v runlock
  for r in "$@"; do
    case "$r" in
      build:*) node --input-type=module -e "
        import { decodePng } from './acceptance/cmp.mjs'; import { readFileSync } from 'node:fs';
        const a = decodePng(readFileSync('acceptance/local/shoot/${r#build:}.png')), b = decodePng(readFileSync('acceptance/local/shoot/$T-$id.png'));
        let d = 0; for (let i = 0; i < a.rgb.length; i += 3) if (a.rgb[i] !== b.rgb[i] || a.rgb[i + 1] !== b.rgb[i + 1] || a.rgb[i + 2] !== b.rgb[i + 2]) d++;
        console.log('build ${r#build:} vs $T-$id: ' + d + '/64000 px');" ;;
      *) cmpq "$r" "$T-$id" ;;
    esac
  done
}
row S049 "idle?seed=169084438&wheel=1&freshsaves=1&keys=$A1" REF-S049                        # 1 3D view (= RUN-1 step 1)
row S053 "t50?wheel=1&freshsaves=1&loadsaves=1&keys=${T4}LGB" REF-S053 REF-S054               # 2 BIGPIC 121 (RUN-2 step 2)
row S054 "idle?wheel=1&freshsaves=1&loadsaves=1&keys=${T4}LGB" REF-S054 REF-S054-B            # 3 overland + party marker
row S095 "idle?seed=169084438&wheel=1&freshsaves=1&keys=${A1}AAESBNASSEESCNV" REF-S095         # 4 text: character sheet
row S066 "idle?wheel=1&freshsaves=1&loadsaves=1&keys=${T4}LDB{Left}{Left}{Up}{Enter}{Enter}{Right}{Up}{Enter}{Left}{Up}{Up}{Up}{Enter}{Up}YB" REF-S066   # 5 shop list
row S113 "idle?seed=4&wheel=1&freshsaves=1&loadsaves=1&keys=$(python -I acceptance/areas_route.py S113)" build:sd4 REF-S113   # 6 combat board
row r1-map "idle?seed=169084438&wheel=1&freshsaves=1&keys=${A1}A" REF-S050                     # RUN-1 step 2: area map
