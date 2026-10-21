"""Write only the GBP section of ACCEPTANCE.md from auditable QA metadata."""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[3]
summary = json.loads((ROOT/'acceptance/plus/reports/QA-SUMMARY.json').read_text(encoding='utf-8'))
features = summary['featureResults']
def state(keys):
    found = [features.get(k) for k in keys]
    if any(r is not None and r.get('pending') for r in found): return 'DEFERRED'
    if any(r is not None and not r['pass'] for r in found): return 'FAIL'
    return 'PASS' if all(r is not None for r in found) else 'PENDING'
rows = [
 ('W2 panel / F12 / Esc',['panel','panel-roundtrip','f12-escape'],'features.json','Open/close retains the game canvas and input isolation',''),
 ('Status',['status'],'tabs.json','Party, place, facing, clock, slot and active helpers','W2 q-1'),
 ('Quests',['quests'],'quests.json','The clerk offers three commissions and the mounted tab shows Offered',''),
 ('Journal / personal notes / pins',['notes','personal-pin','notes-encoding'],'features.json','Observed diary plus readable dialogue, personal note and current-cell pin in the current slot','W4 q-6'),
 ('Journal import gating',['journal-paste','journal-gate'],'features.json','Paste imported locally; an unreferenced synthetic entry stays hidden (PDF adapter also covered by Node tests)',''),
 ('Notes in saves ZIP',['zip-pad'],'zip-pad.json','Actual BYOC ZIP contains the active slot notes sidecar with the new note',''),
 ('Pedia reveal / search',['pedia-reveal','pedia-search','monster-reveal'],'combat.json','Real area/spells/three encountered monsters are revealed; unseen search is empty',''),
 ('Map / visited fog / facing',['map-fog','real-movement-fog','fog-entered-cells'],'features.json','Real movement grows fog and the current initialized area-entry cell has been recorded','W7 q-5'),
 ('Helpers configuration / master',['helper-settings','master','settings-persist'],'features.json','Settings persist and original mode disables hooks/additions; runtime helpers audited separately',''),
 ('Mods sample on/off',['mods'],'mods.json','Normal engine loading changes PIC3/1 while enabled and restores original on disable/master','W9 q-4'),
 ('Keys',['keys'],'tabs.json','Shows the current screen/menu key actions','W2 q-2'),
 ('Cheats dev gate + scenario URL',['cheats','scenario-url'],'features.json','Visible with dev=1; six level-5 members at Sokal Keep via normal boot',''),
 ('Scenario workshop',['scenario','scenario-text-encoding'],'features.json','Open imported GEO, edit/export 256 cells, readable UTF-8 labels','W12 q-3'),
 ('Games selector',['games','frontdoor'],'features.json','Pool is listed with Start; no-profile front door waits for Start',''),
 ('About / Credits',['about'],'features.json','Credits text and full credits link are present',''),
]
for key,label in [('tooltips','Tooltips'),('combatLog','Combat log'),('quicksave','Quick save/load'),('autosave','Autosave'),('spellPresets','Spell presets'),('margins','Margins'),('crispFont','Crisp font')]:
    rows.append(('W8 '+label,['helper-'+key],('helpers-saves.json' if key in ['quicksave','autosave'] else 'helpers-runtime.json'),'Normal boot helper works visibly and switches off; saves/presets use original engine actions','W8/W9 q-7; hooks #16/#17'))
rows += [
 ('W8 quick-load Plus slot state',['reserved-slot-ledgers'],'helpers-saves.json','Map, Pedia, Journal and Quests follow slot Q; Q notes sidecar is exported','W5 q-8'),
 ('W3 menus / cursor hints',['click-menus'],'click-menus.json','Normal boot mounts click layer; menu clicks type the offered hotkeys',''),
 ('W3 lists / roster / view',['click-lists','click-roster','click-view'],'click-menus.json','Item actions and member View work; view turn changes facing',''),
 ('W3 area-map path travel',['click-area-travel'],'click-travel.json','Walk eight original steps around walls and arrive at the clicked cell',''),
 ('W3 Plus automap travel / guards',['click-plus-automap','map-travel-combat-guard'],'click-automap.json','Visited-cell click closes panel and walks; hidden cells and combat cannot start travel','W7 q-10'),
 ('W3 combat attack / move / cast',['click-combat-attack','click-combat-move','click-combat-cast'],'click-combat.json','Context actions perform original moves/attacks; aimed spell removes its target',''),
 ('W3 combat aim cursor',['click-combat-aim'],'click-combat.json','Cell click steers a valid aim cursor to the enemy and completes the action',''),
 ('W3 original-mode mouse bypass',['click-original-bypass'],'click-menus.json','No Plus context list or cursor hint in original mode',''),
 ('W3 complete mouse coverage',['click-typed-input','click-complete-coverage'],'click-input.json','Name entry types, edits and accepts; overland movement and title continuation are mouse reachable','W3 q-11'),
]
lines = ['## GBP','', f'**GBP acceptance: {sum(state(keys)=="PASS" for _,keys,_,_,_ in rows)}/{len(rows)}; original gate {summary["originalCounts"]["PASS"]}/70.**', '', 'QA scope: all W2-W12 tabs plus W3 click and W8 runtime helpers, mounted by normal boot. Every required automated row is audited; native OS pickers, physical gamepads and a player-specific PDF remain manual. Historical diagnostics are retained separately. Current production fingerprint and stale-report checks prevent a prior revision from passing the final gate.','', '| Feature | Route | Expected | Result | Issue |','|---|---|---|---|---|']
for label,keys,route,expected,issue in rows:
    result = state(keys)
    lines.append(f'| {label} | [QA route](acceptance/plus/{route}) | {expected} | **{result}** | {issue if result=="FAIL" else ""} |')
lines += ['', 'W3 complete coverage additionally replays [overland travel](acceptance/plus/click-overland.json) and three independent normal boots for [SU-03](acceptance/plus/click-title-03.json), [SU-04](acceptance/plus/click-title-04.json), and [SU-05 credits](acceptance/plus/click-title.json). Each target receives a real canvas mouse event with its live region and context actions present.',f'**Release gate: {summary["releaseGate"]}.** [Structured summary](acceptance/plus/reports/QA-SUMMARY.json). All screenshots remain under ignored acceptance/local; committed artifacts contain routes, hashes and comparison metadata only.','', '### Original-game regression gate','', '| Gate | Expected | Result |','|---|---|---|']
source=summary['sourceGate'];lines.append(f'| Production source revision | All required replays match current code SHA-256 | **{"PASS" if source["pass"] else "STALE"}** ({source["productionSha256"][:12]}) |')
for key,title in [('run1','RUN-1'),('p1f','P1-f generated test party')]:
    value = summary['runGates'][key]; lines.append(f'| {title} | All historical full PNG hashes identical | **{value["result"]}** |')
counts = summary['originalCounts'];lines.append(f'| Every routed pre-GBP PASS row | 70 rows; strict native RGB, zero tolerance | {counts["PASS"]} PASS / {counts["FAIL"]} FAIL / {counts["PENDING"]} PENDING |')
lines += ['', 'Capture policy: documented timing series and bounded natural full-frame matching may retain an exact existing animation frame atomically. No palette substitution, framebuffer editing, image reconstruction or pixel masks are used. If no exact frame occurs, the real unmatched capture remains a failure. Error paths use read-only browser data-provider substitution after a valid BYOC import, avoiding edits to the player files.','', '### Per-row replay results','', '| Existing PASS row | Replay | Result | Required references / pixels |','|---|---|---|---|']
for row,value in summary['originalRows'].items():
    refs = ', '.join(f'{name}: {count if count is not None else "missing"}' for name,count in value.get('references',{}).items())
    lines.append(f'| {row} | [{value["route"]}](acceptance/plus/original/{value["route"]}.json) | {value["result"]} | {refs} |')
lines += ['', '### Reproduction','', 'Run a route through `node game/test/plus/qa-run.mjs acceptance/plus/<route>.json`. It reuses the self-locking acceptance driver and records probe results in the report. Compare/audit with `python -B game/test/plus/qa-audit.py`; regenerate this section with `python -B game/test/plus/qa-table.py`. `node game/test/plus/qa-check.mjs` is the strict release gate; `--audit-only` checks completed coverage while preserving a BLOCKED result.','', 'The regression inventory is [coverage.json](acceptance/plus/original/coverage.json). Each pre-GBP PASS row has one documented replay, with explicit stable aliases where the original row names multiple states. Repeated timing captures of the same reference are accepted only when a full captured frame matches exactly. Legacy variants already labelled DIFF remain visible in detailed reports and are not silently reclassified. The initial all-black FIRE3 capture is retained as QA-INITIAL-FIRE3-BLANK.json; the healthy replay passes, with no claimed root cause. Native pads, OS pickers and a player-specific journal PDF remain manual checks.','']
path = ROOT/'ACCEPTANCE.md'; text = path.read_text(encoding='utf-8'); start = text.find('\n## GBP\n')
section = '\n'.join(lines)
if start < 0: text = text.rstrip()+'\n\n'+section
else:
    end = text.find('\n## ',start+8)
    text = text[:start+1]+section+(text[end:] if end>=0 else '')
path.write_text(text,encoding='utf-8')
