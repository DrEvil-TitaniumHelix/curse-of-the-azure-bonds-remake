"""Audit QA reports against exact RGB references; writes metadata only, never pixels."""
import json
import hashlib
import re
from pathlib import Path
from PIL import Image, ImageChops
ROOT = Path(__file__).resolve().parents[3]
PLUS = ROOT/'acceptance/plus'

def read(path): return json.loads(path.read_text(encoding='utf-8'))
def raster(path):
    image = Image.open(path).convert('RGB')
    if image.size == (640,400):
        small = image.resize((320,200),Image.Resampling.NEAREST)
        if small.resize(image.size,Image.Resampling.NEAREST).tobytes() != image.tobytes(): raise ValueError('not exact nearest double')
        image = small
    if image.size not in [(320,200),(640,350)]: raise ValueError('unexpected native raster')
    return image

reports = {}
for route in sorted((PLUS/'original').glob('*.json')):
    spec = read(route)
    if 'name' not in spec: continue
    name = spec['name']; path = PLUS/'reports'/f'{name}.json'
    if not path.exists(): continue
    report = read(path); reports[route.stem] = report
    category = 'acc' if spec.get('runner') == 'acc' else 'integration'
    for step in report['steps']:
        ref = step.get('ref')
        if not ref: continue
        reference = ROOT/'acceptance/local/ref'/f'{ref}.png'
        if not reference.exists(): reference = ROOT/'acceptance/ref'/f'{ref}.png'
        shot = ROOT/'acceptance/local'/category/name/step['file']
        step.pop('comparison_error',None)
        step.pop('mismatch_pixels',None)
        try:
            if hashlib.sha256(shot.read_bytes()).hexdigest() != step.get('sha256'): raise ValueError('capture replaced by an unfinished replay; wait for the matching report')
            a,b = raster(reference),raster(shot)
            if a.size != b.size: raise ValueError('native raster sizes differ')
            difference = ImageChops.difference(a,b); pixels = difference.tobytes()
            step['mismatch_pixels'] = sum(pixels[i:i+3] != b'\0\0\0' for i in range(0,len(pixels),3))
            step['bbox'] = difference.getbbox()
        except Exception as error: step['comparison_error'] = str(error)
    path.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')

coverage = read(PLUS/'original/coverage.json'); rows = {}
for row,route in coverage['rows'].items():
    report = reports.get(route)
    if not report: rows[row]={'result':'PENDING','route':route}; continue
    steps = report['steps']; required = coverage['references'].get(row)
    if required is None:
        required = sorted({s['ref'] for s in steps if s.get('ref') and re.match('^'+re.escape(row)+r'(?:-|$)',s['ref'])})
    comparisons = {}
    for reference in required:
        candidates = [s.get('mismatch_pixels') for s in steps if s.get('ref')==reference and s.get('ready') and not s.get('errors')]
        candidates = [n for n in candidates if n is not None]
        comparisons[reference] = min(candidates) if candidates else None
    ok = bool(comparisons) and all(n==0 for n in comparisons.values()) and all(s.get('ready') and not s.get('errors') for s in steps)
    rows[row]={'result':'PASS' if ok else 'FAIL','route':route,'references':comparisons,'timeouts':[s['name'] for s in steps if not s.get('ready')],'browserErrors':sum(len(s.get('errors',[])) for s in steps)}

features = {}
for name in ['QA-FEATURES','QA-TABS']:
    path=PLUS/'reports'/f'{name}.json'
    if path.exists():
        for step in read(path)['steps']:
            value=step.get('probe')
            if not isinstance(value,dict): continue
            if 'pass' in value: features[step['name']]=value
            else: features.update({key:result for key,result in value.items() if isinstance(result,dict) and 'pass' in result})
for key,name in [('quests','QA-QUESTS'),('monster-reveal','QA-COMBAT'),('mods','QA-MODS'),('zip-pad','QA-ZIP-PAD')]:
    path = PLUS/'reports'/f'{name}.json'
    if path.exists():
        values = [s['probe'] for s in read(path)['steps'] if isinstance(s.get('probe'),dict) and 'pass' in s['probe'] and (key!='monster-reveal' or s['name']=='actual-monster-and-visited-reveal')]
        if values:
            features[key] = values[-1]
            if key == 'monster-reveal' and isinstance(values[-1].get('fog'),dict): features['fog-entered-cells'] = values[-1]['fog']
helper_path=PLUS/'reports/QA-HELPERS.json'
if helper_path.exists():
    for step in read(helper_path)['steps']:
        value=step.get('probe',{})
        if isinstance(value,dict): features.update({k:{**v,'pending':True,'reason':'Historical mount failure; post-integration runtime replay awaits owner q-7 APPLIED handoff'} for k,v in value.items() if isinstance(v,dict) and 'pass' in v and k.startswith('helper-')})
runtime_path=PLUS/'reports/QA-HELPERS-RUNTIME.json'
if runtime_path.exists():
    runtime=read(runtime_path)
    healthy=all(step.get('ready') and not step.get('errors') for step in runtime['steps'])
    for step in runtime['steps']:
        value=step.get('probe')
        if not isinstance(value,dict): continue
        if 'pass' in value and step['name'].startswith('helper-'): features[step['name']]={**value,'pass':value['pass'] and healthy}
        else:
            for key,result in value.items():
                if isinstance(result,dict) and 'pass' in result: features[key]={**result,'pass':result['pass'] and healthy}
saves_path=PLUS/'reports/QA-HELPER-SAVES.json'
if saves_path.exists():
    saves=read(saves_path); healthy=all(step.get('ready') and not step.get('errors') for step in saves['steps'])
    probes={step['name']:step.get('probe',{}) for step in saves['steps']}
    saved,loaded=probes.get('quick-save',{}),probes.get('quick-load',{})
    features['helper-quicksave']={'pass':healthy and saved.get('pass',False) and loaded.get('pass',False),'save':saved,'load':loaded}
    features['helper-autosave']={'pass':healthy and saved.get('autosaveX',False),'autosaveX':saved.get('autosaveX',False)}
    if 'plus-reserved-slot-state' in probes: features['reserved-slot-ledgers']=probes['plus-reserved-slot-state']
combat_path=PLUS/'reports/QA-COMBAT.json'
if combat_path.exists():
    for step in read(combat_path)['steps']:
        if step['name']=='map-travel-combat-guard': features['map-travel-combat-guard']=step.get('probe',{'pass':False})
click_path=PLUS/'reports/QA-CLICK-SUMMARY.json'
if click_path.exists(): features.update(read(click_path)['features'])
notes_encoding_path=PLUS/'reports/QA-NOTES-ENCODING.json'
if notes_encoding_path.exists(): features['notes-encoding']={'pass':read(notes_encoding_path)['pass']}

frontdoor_path=PLUS/'reports/QA-FRONTDOOR.json'
if frontdoor_path.exists(): features['frontdoor']={'pass':read(frontdoor_path)['pass']}

run_gates = {}
expected = read(ROOT/'game/test/plus/integrate-expected.json')
for key,name in [('run1','QA-ORIG-RUN1'),('p1f','QA-ORIG-P1f')]:
    path = PLUS/'reports'/f'{name}.json'
    if not path.exists(): run_gates[key]={'result':'PENDING'}; continue
    steps = read(path)['steps']; hashes = [s.get('sha256') for s in steps]
    mismatches = [i+1 for i,(a,b) in enumerate(zip(hashes,expected[key]['sha256'])) if a!=b]
    ok = hashes == expected[key]['sha256'] and all(s.get('ready') and not s.get('errors') for s in steps)
    run_gates[key]={'result':'PASS' if ok else 'FAIL','frames':len(steps),'mismatchingFrames':mismatches}
deferred=[]
if not click_path.exists(): deferred.append('W3 click')
if not (runtime_path.exists() and saves_path.exists()): deferred.append('W8 post-integration runtime: owner q-7 APPLIED handoff pending')
import subprocess
current=json.loads(subprocess.check_output(['node',str(ROOT/'game/test/plus/qa-source.mjs')],text=True))
required={f"QA-ORIG-{value['route']}" for value in rows.values()}
required.update(['QA-ORIG-RUN1','QA-ORIG-P1f','QA-FRONTDOOR','QA-FEATURES','QA-TABS','QA-QUESTS','QA-COMBAT','QA-MODS','QA-ZIP-PAD','QA-HELPERS-RUNTIME','QA-HELPER-SAVES','QA-CLICK-MENUS','QA-CLICK-TRAVEL','QA-CLICK-COMBAT','QA-CLICK-INPUT','QA-CLICK-AUTOMAP','QA-CLICK-OVERLAND','QA-CLICK-TITLE','QA-CLICK-TITLE-03','QA-CLICK-TITLE-04'])
unverified=[]
for name in sorted(required):
    path=PLUS/'reports'/f'{name}.json'
    meta=read(path).get('qa',{}) if path.exists() else {}
    if not meta.get('stableProduction') or meta.get('productionSha256')!=current['productionSha256']: unverified.append(name)
source_gate={**current,'pass':not unverified,'unverifiedReports':unverified}
summary={'sourceGate':source_gate,'runGates':run_gates,'deferred':deferred,'originalRows':rows,'featureResults':features,'originalCounts':{k:sum(r['result']==k for r in rows.values()) for k in ['PASS','FAIL','PENDING']},'featureCounts':{'PASS':sum(r['pass'] and not r.get('pending',False) for r in features.values()),'FAIL':sum(not r['pass'] and not r.get('pending',False) for r in features.values()),'PENDING':sum(r.get('pending',False) for r in features.values())},'releaseGate':'PASS' if all(r['result']=='PASS' for r in rows.values()) and all(r['result']=='PASS' for r in run_gates.values()) and features and all(r['pass'] for r in features.values()) and not deferred and source_gate['pass'] else 'BLOCKED'}
(PLUS/'reports/QA-SUMMARY.json').write_text(json.dumps(summary,indent=2)+'\n',encoding='utf-8')
print(json.dumps({key:summary[key] for key in ['originalCounts','featureCounts','releaseGate']}))
for row,result in rows.items():
    if result['result']=='FAIL': print(row,json.dumps(result['references']))
