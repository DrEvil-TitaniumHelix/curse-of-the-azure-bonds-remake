#!/bin/bash
# Build (or re-export) the overlay-aware Ghidra project for Curse of the Azure Bonds. Run from Windows (PowerShell):
#   wsl.exe -d Ubuntu -- bash $HOME/IdeaProjects/CurseAzureBondsRE/decode/tools/ghidra_build.sh [build|export]
# build  = prep inputs + import + CabBuild (analysis) + CabExport
# export = CabExport only (after editing decode/names/*.json)
# Only one Ghidra at a time on this machine (any project): refuses if an analyzeHeadless JVM is running.
set -e
R=$HOME/IdeaProjects/CurseAzureBondsRE
export GHIDRA_INSTALL_DIR=$HOME/tools/ghidra_12.1.4_PUBLIC
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
H=$GHIDRA_INSTALL_DIR/support/analyzeHeadless
P=$R/ghidra_proj
B=$R/decode/bin/ghidra
mkdir -p "$P" "$R/decode/names" "$R/decode/listings"
mode=${1:-build}
if pgrep -f "headless.AnalyzeHeadless" > /dev/null; then echo "Ghidra already running - not starting"; exit 2; fi
if [ "$mode" = build ]; then
  python3 -I "$R/decode/tools/ghidra_prep.py" "$R/decode/bin/START.EXE" "$R/decode/bin/GAME.OVR" "$B" > /dev/null
  "$H" "$P" cab -import "$B/resident.bin" -overwrite -loader BinaryLoader -processor "x86:LE:16:Real Mode" \
    -noanalysis -scriptPath "$R/decode/ghidra_scripts" -postScript CabBuild.java "$B" > "$P/build.log" 2>&1 || true
  grep -E "CabBuild.java>|ERROR|Exception" "$P/build.log" | grep -v "^INFO  REPORT" || true
  if ! grep -q CABBUILD_OK "$P/build.log"; then echo "BUILD FAILED - export skipped (listings unchanged)"; exit 1; fi
fi
"$H" "$P" cab -process resident.bin -noanalysis -scriptPath "$R/decode/ghidra_scripts" \
  -postScript CabExport.java "$R/decode/names" "$R/decode/listings" > "$P/export.log" 2>&1 || true
grep -E "CabExport|ERROR|Exception|exported|names" "$P/export.log" || true
