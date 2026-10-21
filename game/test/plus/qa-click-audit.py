"""Independent assertions over normal-boot W3 click replay probes."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
DIR=ROOT/'acceptance/plus/reports'
features={}
def load(name):
 p=DIR/(name+'.json')
 if not p.exists(): return None,{}
 v=json.loads(p.read_text(encoding='utf-8'))
 return v,{step['name']:step.get('probe') for step in v['steps']}
def healthy(v): return bool(v) and all(s.get('ready') and not s.get('errors') for s in v['steps'])
def check(key,ok,**details): features[key]={'pass':bool(ok),**details}
v,p=load('QA-CLICK-MENUS')
if v:
 good=healthy(v); first=p.get('party-menu') or {}; explore=p.get('explore') or {}; after=p.get('after-turn') or {}; item=p.get('items-list') or []; bypass=p.get('original-mode') or {}
 check('click-menus',good and first.get('mounted') and first.get('cursor')=='context-menu' and any('Load Saved Game' in s for s in first.get('list',[])) and (p.get('pick-load') or {}).get('key')=='L' and (p.get('load-menu') or {}).get('key')=='A')
 check('click-view',good and any('Forward' in s for s in explore.get('list',[])) and after.get('facing')==(explore.get('pos',{}).get('facing',0)+1)%4)
 check('click-roster',good and (p.get('view-member') or {}).get('picked','').startswith('View:') and any('Items' in s for s in p.get('sheet',[])))
 check('click-lists',good and all(any(s.startswith(word+':') for s in item) for word in ['Ready','Use','Trade','Drop']) and (p.get('items') or {}).get('key')=='I')
 check('click-original-bypass',good and bypass.get('list')==[] and bypass.get('cursor')!='context-menu')
v,p=load('QA-CLICK-TRAVEL')
if v:
 w=p.get('walk') or {};target=w.get('target',{});at=w.get('at',{})
 check('click-area-travel',healthy(v) and (p.get('party-menu') or {}).get('mounted') and w.get('walking') is False and at.get('x')==target.get('x') and at.get('y')==target.get('y') and len(w.get('path',[]))==target.get('n') and target.get('n',0)>0,path=w.get('path'),target=target,at=at)
v,p=load('QA-CLICK-COMBAT')
if v:
 good=healthy(v) and (p.get('menu') or {}).get('mounted'); info=p.get('fight-info') or {};attack=p.get('move-attack') or {};after=p.get('after-attack') or {};move=p.get('after-move') or {};want=move.get('want',{});actor=(p.get('next-turn') or {}).get('fight',{}).get('name');cast=p.get('after-cast') or {};aim=p.get('aim-mode') or {};target=aim.get('t',{}).get('enemy') or {};cursor=(p.get('after-aim') or {}).get('cursor') or {}
 check('click-combat-attack',good and attack.get('driving') is False and bool(after.get('pip')) and (after['pip'].get('col'),after['pip'].get('row'))!=(info.get('t',{}).get('me',{}).get('col'),info.get('t',{}).get('me',{}).get('row')),picked=attack.get('picked'))
 check('click-combat-move',good and (p.get('move-free') or {}).get('driving') is False and f"{actor}@{want.get('col')},{want.get('row')}" in move.get('map',[]),target=want)
 spells=p.get('spell-list') or []
 check('click-combat-cast',good and isinstance(spells,list) and any('Magic Missile' in s for s in spells) and (p.get('choose-spell') or {}).get('driving') is False and cast.get('enemy')==[],remainingTarget=cast.get('enemy'))
 check('click-combat-aim',good and (p.get('aim-target') or {}).get('driving') is False and cursor.get('valid') is True and cursor.get('col')==target.get('col') and cursor.get('row')==target.get('row'),target=target,cursor=cursor)
for name,key,step in [('QA-CLICK-INPUT','click-typed-input','name-prompt'),('QA-CLICK-AUTOMAP','click-plus-automap','click-visited-automap-cell')]:
 v,p=load(name)
 if v:
  result=p.get(step) or {}; ok=healthy(v) and result.get('pass',False)
  if key=='click-typed-input':
   ok=ok and (p.get('left-click-focus') or {}).get('focused') is True and (p.get('type-in-field') or {}).get('value')=='ROLAND' and (p.get('list-backspace') or {}).get('value')=='ROLAN' and (p.get('list-clear') or {}).get('value')=='' and (p.get('retype') or {}).get('value')=='ALDRIC' and (p.get('after-name') or {}).get('active') is None and (p.get('after-name') or {}).get('visibleTextInputs')==0 and bool((p.get('after-name') or {}).get('letters'))
  check(key,ok,evidence=p if key=='click-typed-input' else result)
v,p=load('QA-CLICK-OVERLAND')
w=p.get('travel') or {}; target=w.get('target') or {}; at=w.get('at') or {}; initial=p.get('load-C') or {}
overland=healthy(v) and 'plus-overland' in initial.get('regions',[]) and w.get('walking') is False and target.get('n',0)>0 and len(w.get('path',[]))==target.get('n') and at.get('x')==target.get('x') and at.get('y')==target.get('y') and all(any(word in label for label in w.get('list',[])) for word in ['North','East','South','West'])
check('click-overland',overland,evidence=w)
title=True; titleEvidence={}
for suffix,screen in [('-03','SU-03'),('-04','SU-04'),('','SU-05')]:
 v,p=load('QA-CLICK-TITLE'+suffix); t=p.get('titles-to-party-menu') or {}; screens=t.get('screens',[])
 ok=healthy(v) and any(s.get('screen')==screen and s.get('region') and s.get('clicked') and any('Continue' in label for label in s.get('list',[])) for s in screens) and 'pmenu' in t.get('regions',[])
 title=title and ok;titleEvidence[screen]=t
check('click-title',title,evidence=titleEvidence)
check('click-complete-coverage',overland and title and features.get('click-typed-input',{}).get('pass',False),issue='W3 fix request #q-11',evidence='Independent normal-boot title/credits, overland and name-entry replays')
(DIR/'QA-CLICK-SUMMARY.json').write_text(json.dumps({'features':features},indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:v['pass'] for k,v in features.items()}))
