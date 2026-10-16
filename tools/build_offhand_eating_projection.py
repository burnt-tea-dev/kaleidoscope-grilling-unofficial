"""Exact21 actual-left projection routes; existing generic left basis retained."""
import pathlib,json,copy,hashlib,argparse,sys
ROOT=pathlib.Path(__file__).resolve().parents[1];P=ROOT/'projects/grilling/gameplay_core';RP=P/'resource_pack';MAIN=P/'behavior_pack/scripts/main.js'
sys.path.insert(0,str(ROOT/'development/gameplay_core'))
FIX=ROOT/'development/gameplay_core/fixtures/offhand-projection-contract.json'
PLAYER=RP/'animations/offhand_eating_player.animation.json';DONOR=RP/'animations/java_eating_player.animation.json'
CONTROL=RP/'render_controllers/java_eating_player.render_controllers.json'
MARK='kg_offhand_projection';ALIAS='offhand_projection_left';ADMIT='supportsJavaEatingProjection(e.itemStack.typeId,profile)'
def canonical(v):return json.dumps(v,sort_keys=True,separators=(',',':'))
def contract():return json.loads(FIX.read_text())
def ids(profile):return [r['id']for r in contract()['routes']if r['profile']==profile]
def player_id(profile):return 'animation.kg_offhand_projection.player.'+profile.lower()+'.left'
def condition():
 return "hand==='off'&&("+'||'.join("(profile==='"+p+"'&&"+json.dumps(ids(p),separators=(',',':'))+".includes(e.itemStack.typeId))"for p in ['ONE','THREE'])+')'
def pairs():
 old=contract()['old_selector'];new='('+condition()+"?'animation.kg_offhand_projection.player.'+profile.toLowerCase()+'.left':"+old+')'
 return [(ADMIT,'('+ADMIT+'||('+condition()+'))'),('e.source.playAnimation('+old+',{','e.source.playAnimation('+new+',{')]
def restore_main(text):
 from eating_route_extraction import restore_main as restore_extraction
 text=restore_extraction(text)
 if MARK not in text:return text
 for old,new in reversed(pairs()):
  if text.count(new)!=1:raise ValueError('Partial or ambiguous offhand main layer')
  text=text.replace(new,old,1)
 if MARK in text:raise ValueError('Unknown offhand main namespace')
 return text
def patch_main(text):
 text=restore_main(text)
 for old,new in pairs():
  if text.count(old)!=1:raise ValueError('Unknown offhand main predecessor')
  text=text.replace(old,new,1)
 from eating_route_extraction import extract_main
 return extract_main(text)
def gate(profile,items=None,attachable=False):
 items=ids(profile)if items is None else items
 if profile not in ['ONE','THREE']or not items or any(i not in ids(profile)for i in items):raise ValueError('Unowned offhand route')
 s=("c.is_first_person == 1 && c.item_slot == 'off_hand' && "if attachable else'variable.is_first_person == 1 && ')+"q.is_using_item && q.has_property('kaleidoscope_grilling:eat_projection') && q.has_property('kaleidoscope_grilling:eat_profile') && q.has_property('kaleidoscope_grilling:eat_hand') && q.property('kaleidoscope_grilling:eat_projection') == 1 && q.property('kaleidoscope_grilling:eat_profile') == "+str(1 if profile=='ONE' else 3)+" && q.property('kaleidoscope_grilling:eat_hand') == 2 && q.is_sneaking == 0 && q.is_swimming == 0 && q.is_gliding == 0 && q.is_riding == 0 && q.is_item_equipped('main_hand') == 0 && q.is_item_name_any('slot.weapon.offhand',"+','.join("'"+i+"'"for i in items)+')'
 if attachable:
  from eating_owner_context import owner_expression
  s=owner_expression(s)
 return s
def visibility():return '('+gate('ONE')+') || ('+gate('THREE')+')'
def clip(profile):
 data=DONOR.read_bytes()
 if hashlib.sha256(data).hexdigest()!=contract()['source_pins'][str(DONOR.relative_to(ROOT))]:raise ValueError('Offhand donor changed')
 c=copy.deepcopy(json.loads(data)['animations']['animation.kg_java_eating.player.'+profile.lower()+'.left'])
 if profile=='THREE':
  old="q.is_item_name_any('slot.weapon.offhand','kaleidoscope_grilling:secret_skewer')";new="q.is_item_name_any('slot.weapon.offhand',"+','.join("'"+i+"'"for i in ids(profile))+')';count=0
  for name,bone in c['bones'].items():
   if not name.endswith('arm'):continue
   for xyz in bone['position'].values():
    if xyz[1].count(old)!=1:raise ValueError('Offhand THREE relative source predicate changed')
    xyz[1]=xyz[1].replace(old,new);count+=1
  if count!=698:raise ValueError('Offhand THREE key inventory')
 c['blend_weight']=gate(profile);return c
def expected_document(path):
 key=str(path.relative_to(ROOT));base=contract()['predecessors'].get(key)
 if base is None:raise ValueError('Unowned offhand document')
 d=copy.deepcopy(base)
 if path==CONTROL:
  count=0
  for row in d['render_controllers']['controller.render.player.first_person']['part_visibility']:
   for bone in ['rightArm','rightSleeve','leftArm','leftSleeve']:
    if bone in row:row[bone]='('+visibility()+') ? 1 : ('+row[bone]+')';count+=1
  if count!=4:raise ValueError('Offhand visibility shape')
 else:
  desc=d['minecraft:attachable']['description'];item=desc['identifier'];profile=next(r['profile']for r in contract()['routes']if r['id']==item);active=gate(profile,[item],True)
  for alias in ['fp_left','eat_left']:
   rows=[r for r in desc['scripts']['animate']if alias in r]
   if len(rows)!=1:raise ValueError('Offhand fallback shape')
   rows[0][alias]='('+rows[0][alias]+') && ('+active+') == 0'
  desc['animations'][ALIAS]='animation.kg_java_eating.item.'+profile.lower()+'.left';desc['scripts']['animate'].append({ALIAS:active})
  if profile=='THREE':
   rows=[i for i,s in enumerate(desc['scripts']['pre_animation'])if s.startswith('v.kg_java_piece_visible = ')]
   if len(rows)!=1:raise ValueError('Offhand THREE helper visibility shape')
   i=rows[0];old=desc['scripts']['pre_animation'][i];desc['scripts']['pre_animation'][i]='v.kg_java_piece_visible = ('+old[len('v.kg_java_piece_visible = '):-1]+') || ('+active+');'
  else:
   desc['geometry']['java_piece']='geometry.kg_java_dual.piece.grilled_caterpillar_skewer';desc['textures']['java_piece']='textures/java_eating_piece/grilled_caterpillar_skewer'
   desc['render_controllers'].append('controller.render.kg_java_eating.piece');desc['scripts']['pre_animation'].append('v.kg_java_piece_visible = ('+active+');')
 if path==CONTROL:
  from plate_use_arm_visibility import apply
  d=apply(d)
 return d
def strip_document(value):
 """Called before historical owner/context decoding; reject entire mutated payloads."""
 if not isinstance(value,dict):return value
 if 'minecraft:attachable'in value:
  desc=value['minecraft:attachable']['description']
  if ALIAS not in canonical(value):return value
  path=RP/'attachables'/(desc['identifier'].split(':')[1]+'.attachable.json')
 elif 'render_controllers'in value and 'controller.render.player.first_person'in value['render_controllers']:
  if visibility()not in canonical(value):return value
  path=CONTROL
 else:return value
 if canonical(value)!=canonical(expected_document(path)):raise ValueError('Offhand document inverse requires exact owned payload: '+str(path))
 return copy.deepcopy(contract()['predecessors'][str(path.relative_to(ROOT))])
def validate():
 c=contract()
 for rel,digest in c['source_pins'].items():
  if hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()!=digest:raise ValueError('Offhand source pin changed:'+rel)
 from java_eating_piece_resolver import available_fixed_piece
 for row in c['routes']:
  if available_fixed_piece(ROOT,row['id'],row['profile'])!=c['helper_models'][row['id']]:raise ValueError('Offhand helper source selection changed')
def augment(output):
 validate();out=dict(output)
 for rel,base in contract()['predecessors'].items():
  path=ROOT/rel;actual=out[path] if path in out else json.loads(path.read_text());actual=strip_document(actual)
  if canonical(actual)!=canonical(base):raise ValueError('Offhand predecessor changed:'+rel)
  out[path]=expected_document(path)
 out[PLAYER]={'format_version':'1.8.0','animations':{player_id(p):clip(p)for p in ['ONE','THREE']}}
 out[MAIN]=patch_main(out[MAIN] if MAIN in out else MAIN.read_text())
 import build_java_eating_projection as g,build_java_dual_eating_projection as dual
 assets,_,_=dual.piece_assets(g,ids('ONE')[0],'ONE');out.update(assets)
 return out
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--check',action='store_true');a=p.parse_args()
 for path,v in augment({}).items():
  data=v if isinstance(v,bytes)else(v if isinstance(v,str)else json.dumps(v,ensure_ascii=False,indent=2)+'\n').encode()
  if a.check:assert path.read_bytes()==data,path
  else:path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
 print('21 actual-left routes; generic left basis; native acceptance false')
