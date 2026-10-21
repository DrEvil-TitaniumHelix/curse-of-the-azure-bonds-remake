#!/bin/sh
# acceptance/plus/hooklog.sh <name> <extra keys> — the RUN-1 key route (acceptance/run1.sh: titles, rune wheel, party of six,
# Begin) with Plus on (the default boot) and the event log (?hooklog=1); prints a summary of window.__hookLog (count per
# event, every journalRef / areaEntered / monsterShown / npcTalk / combat / save payload) and writes the whole log to
# acceptance/local/plus/<name>.hooklog.json (local: the payloads quote game text). cab-build-engine, S1 hooks.
C=""; for n in ALPHA BETA GAMMA DELTA EPSI; do C="${C}C{Enter}{Enter}{Enter}{Enter}N${n}{Enter}EYY"; done
C="${C}C{End}{End}{End}{End}{End}{Enter}{Enter}{End}{End}{Enter}{Enter}NZETA{Enter}EYY"
K="{Space}{Space}{Space}{Space}Pa{Enter}${C}A{Enter}A{End}A{End}A{End}A{End}A{End}A{Esc}B{Enter}{Enter}"
EV="(() => { const L = window.__hookLog || []; const n = {}; for (const e of L) n[e.event] = (n[e.event] || 0) + 1;
  const pick = (ev, f) => L.filter((e) => e.event === ev).map(f);
  return JSON.stringify({ count: L.length, perEvent: n,
    areaEntered: pick('areaEntered', (e) => [e.source, e.dataset, e.block, e.x, e.y, e.facing]),
    journalRef: pick('journalRef', (e) => [e.n, e.kind, e.dataset, e.block, (e.addr ?? 0).toString(16), e.clock, (e.scene || '').slice(0, 40)]),
    monsterShown: pick('monsterShown', (e) => [e.id, e.name, e.count, e.pic]),
    npcTalk: pick('npcTalk', (e) => [e.kind, e.choice]),
    combat: pick('combatStart', (e) => ['start', e.partyCount, e.monsters.length]).concat(pick('combatEnd', (e) => ['end', e.partyDead])),
    saves: pick('saveLoaded', (e) => ['loaded', e.slot]).concat(pick('gameSaved', (e) => ['saved', e.slot])),
    party: (window.__hooks && window.__hooks.state.party().map((p) => p.name + ' ' + p.hp + '/' + p.hpMax + ' AC' + p.ac)) || null,
    clock: window.__hooks && window.__hooks.state.clock(), pos: window.__hooks && window.__hooks.state.position(),
    full: L.length }); })()"
cd "$(dirname "$0")/../.." && mkdir -p acceptance/local/plus && LIMIT_MS=${LIMIT_MS:-300000} EVAL="$EV" \
  node acceptance/shoot.mjs "$1=${SCREEN:-idle}?seed=169084438&wheel=1&freshsaves=1&hooklog=1&keys=$K$2" 2>&1 | grep -v runlock
