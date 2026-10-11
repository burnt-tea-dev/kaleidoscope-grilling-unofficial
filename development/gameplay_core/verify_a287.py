"""All held binding paths and pose dispatch. Does not simulate a Minecraft client."""
from pathlib import Path
import ast,json,re,subprocess,sys
import a287_binding_repair as repair
import importlib.util
from verification_session import run_checked_once
_spec=importlib.util.spec_from_file_location('tools_build_eating',Path(__file__).resolve().parents[2]/'tools/build_eating_motion.py')
_motion=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(_motion)
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'tools'))
from verify_a285 import survival_gate
from verify_a284 import eating_gate
from verify_a283 import main as previous_gate
RP=repair.RP;BP=repair.BP
def load(p):return json.loads(p.read_text())
def expression(expr,first,slot,bone,using=False,eat_profile=3,eat_hand=None,projection=None,posture=None,season_hand=0,season_phase=0,pending_hand=0,has_projection=True,offhand=0):
 # Only the simple boolean Molang subset used by held pose dispatch is accepted.
 expr=expr.replace('q.item_slot_to_bone_name(context.item_slot)',repr(bone))
 for prefix in ('context','c'):
  expr=expr.replace(prefix+'.is_first_person',str(int(first))).replace(prefix+'.item_slot',repr(slot))
 if eat_hand is None:eat_hand=1 if slot=='main_hand' else 2
 expr=expr.replace("q.property('kaleidoscope_grilling:eat_hand')",str(eat_hand))
 # The bottle selectors read use state from their owning player. Resolve only
 # this exact context before the unqualified query; unknown contexts still
 # fail the existing restricted AST gate. Legacy calls keep motion inactive.
 expr=expr.replace('c.owning_entity->q.is_using_item',str(bool(using)))
 for name,value,maximum in [('season_hand',season_hand,2),('season_phase',season_phase,10),('pending_hand',pending_hand,2)]:
  assert type(value) is int and 0 <= value <= maximum,(name,value)
  expr=re.sub(r'\bv\.kg_season_'+name+r'\b',str(value),expr)
 assert type(has_projection) is bool and type(offhand) is int and offhand in (0,1)
 expr=expr.replace("q.has_property('kaleidoscope_grilling:eat_projection')",str(has_projection))
 expr=expr.replace('q.is_using_item',str(bool(using))).replace("q.property('kaleidoscope_grilling:eat_profile')",str(eat_profile))
 expr=expr.replace("q.property('kaleidoscope_grilling:eat_projection')",str(int(using and eat_profile in (1,2,3,4,5) if projection is None else projection)))
 expr=re.sub(r"q\.is_item_name_any\([^)]*\)",'True',expr)
 expr=re.sub(r"q\.is_item_equipped\([^)]*\)",str(offhand),expr)
 for state in ('is_sneaking','is_swimming','is_gliding','is_riding'):expr=expr.replace('q.'+state,str(int(state==posture)))
 expr=expr.replace('&&',' and ').replace('||',' or ')
 tree=ast.parse(expr,mode='eval')
 assert all(isinstance(n,(ast.Expression,ast.BoolOp,ast.And,ast.Or,ast.Compare,ast.Eq,ast.NotEq,ast.Constant,ast.Load)) for n in ast.walk(tree)),expr
 return bool(eval(compile(tree,'<pose-condition>','eval'),{'__builtins__':{}},{}))
def idle_pose_alias(version,identifier,first,hand):
 calibrated=version>=(2,8,68) and first and identifier in ('kaleidoscope_grilling:secret_skewer','kaleidoscope_grilling:unfinished_skewer')
 return 'fp_idle_calibrated_'+hand if calibrated else ('fp_' if first else 'tp_')+hand

def secret_helper_binding_gate(path,description,reference,geometry):
 from build_java_dual_eating_projection import PIECE_BINDING
 assert description['identifier'] in ('kaleidoscope_grilling:secret_skewer','kaleidoscope_grilling:secret_skewer_java_three_alt'),(path,reference)
 grip=geometry['bones'][0]
 assert grip['binding']==PIECE_BINDING and 'parent' not in grip,(path,reference)
 assert len(geometry['bones'])==2 and not grip.get('cubes'),(path,reference)
 piece=geometry['bones'][1]
 assert piece['name']=='dual_piece' and piece['parent']=='grip' and piece['pivot']==[0,24,0] and piece['cubes'],(path,reference)

def binding_assets():
 idx={};animations={};controllers={};rows=[];refs=set();cases=0
 version=tuple(load(BP/'manifest.json')['header']['version'])
 for p in (RP/'models').rglob('*.geo.json'):
  for g in load(p)['minecraft:geometry']:
   ref=g['description']['identifier'];assert ref not in idx,ref;idx[ref]=g
 for p in (RP/'animations').glob('*.json'):
  for key,a in load(p).get('animations',{}).items():assert key not in animations,key;animations[key]=a
 for p in (RP/'render_controllers').glob('*.json'):
  for key,body in load(p).get('render_controllers',{}).items():assert key not in controllers,key;controllers[key]=body
 for p in sorted((RP/'attachables').glob('*.json')):
  if p.stem.endswith('_java_three_alt.attachable'):continue
  d=load(p)['minecraft:attachable']['description'];selected=[]
  scoped_caterpillar=version>=(2,8,126) and d['identifier']=='kaleidoscope_grilling:grilled_caterpillar_skewer'
  if scoped_caterpillar:
   # A reviewed immutable payload, not a broad exemption from legacy bindings.
   from public_source_witness import REVIEWED_CATERPILLAR_CAMERA_BASE
   from build_caterpillar_eating_projection import ACTIVE,ANIMATION,PIECE,piece_assets
   relative=p.relative_to(Path(__file__).resolve().parents[2]).as_posix()
   assert p.read_bytes()==subprocess.check_output(['git','show',REVIEWED_CATERPILLAR_CAMERA_BASE+':'+relative]),p
   assert d['animations']['probe_one_right']==ANIMATION,p
   assert controllers[PIECE]=={'geometry':'Geometry.probe_piece','materials':[{'*':'Material.default'}],'textures':['Texture.probe_piece'],'part_visibility':[{'*':'v.kg_probe_piece_visible == 1'}]},p
  pose_routes=d['scripts']['animate']
  if d['identifier']=='kaleidoscope_grilling:skewer_plate':
   # One explicit new family: compare the entire source-derived payload before
   # selecting the four hand poses. The always-active layout is not a pose.
   from build_plate_held import build as build_held_plate
   assert version>=(2,8,119),p
   for target,content in build_held_plate().items():assert target.read_bytes()==content,target
   assert len(pose_routes)==5 and pose_routes[-1]=='layout',p
   pose_routes=pose_routes[:-1]
  for first in (0,1):
   for slot,hand in [('main_hand','right'),('off_hand','left')]:
    for bone in (hand+'item',hand+'Item','custom_'+hand+'_grip'):
     matches=[key for row in pose_routes for key,expr in row.items() if expression(expr,first,slot,bone)]
     expected=('fp_' if first else 'tp_')+hand
     idle_expected=idle_pose_alias(version,d['identifier'],first,hand)
     assert matches==[idle_expected],(p,first,slot,bone,matches)
     for profile in (1,2,3,4,5):
      using_matches=[key for row in pose_routes for key,expr in row.items() if expression(expr,first,slot,bone,True,profile)]
      eating='eat_alt_'+hand if profile==4 and 'eat_alt_'+hand in d['animations'] else 'eat_'+hand
      projected='fp_eat_'+hand
      projected_code={'one':1,'two':2,'three':3,'three_alt':4,'four':5}.get(d['animations'].get(projected,'').split('.')[-2] if projected in d['animations'] else '')
      if scoped_caterpillar and hand=='right':projected='probe_one_right';projected_code=1
      # .61 corrects the renderer context: Java renderArmWithItem curves are
      # first-person-only. Older immutable candidates retain their old guard.
      local_eating=[eating] if eating in d['animations'] and (first or version<(2,8,61)) else []
      expected_using=([projected] if first and profile==projected_code else [expected]+local_eating) if version>=(2,8,58) else [expected]+local_eating
      assert using_matches==expected_using,(p,profile,using_matches,expected_using)
      if scoped_caterpillar:
       for omitted in ({'has_projection':False},{'offhand':1}):
        blocked=[key for row in pose_routes for key,expr in row.items() if expression(expr,first,slot,bone,True,profile,**omitted)]
        assert blocked==[expected]+local_eating,(p,profile,omitted,blocked)
      # Projection is independently synchronized, and every excluded posture
      # falls back to the native display. Local authored motion is FP-only in
      # .61; third-person never inherits a camera-space item displacement.
      for projection,posture in [(False,None)]+[(True,s) for s in ('is_sneaking','is_swimming','is_gliding','is_riding')]:
       fallback=[key for row in pose_routes for key,expr in row.items() if expression(expr,first,slot,bone,True,profile,projection=projection,posture=posture)]
       assert fallback==[expected]+local_eating,(p,profile,projection,posture,fallback)
      for inactive in (0,2 if slot=='main_hand' else 1):
       inactive_matches=[key for row in pose_routes for key,expr in row.items() if expression(expr,first,slot,bone,True,profile,inactive)]
       assert inactive_matches==[idle_expected],(p,profile,inactive,inactive_matches)
     cases+=1
    selected.append(expected)
  if d['animations'].get('fp_right')=='animation.kg_a286.bottle_fp_right' and version>=(2,8,61):
   # Production bottles use one renderer instance; old multi-pass controller
   # definitions may remain as unused source, but no item can reference them.
   assert set(d['geometry'])=={'default'},p
   assert len(d['render_controllers'])==1 and isinstance(d['render_controllers'][0],str),p
   assert controllers[d['render_controllers'][0]]['geometry']=='Geometry.default',p
   assert d['geometry']['default'].startswith('geometry.kg_bottle_held.'),p
  for ref in d['geometry'].values():
   refs.add(ref);g=idx[ref]
   b=g['bones'][0];assert b['name']=='grip' and b['pivot']==[0,24,0]
   if ref=='geometry.kg_probe_caterpillar.piece':
    assert scoped_caterpillar and ref==d['geometry']['probe_piece'],(p,ref)
    assert g==piece_assets()[0]['minecraft:geometry'][0],(p,ref)
    continue
   if ref.startswith('geometry.kg_java_dual.piece.'):
    from build_java_dual_eating_projection import PIECE_BINDING,REPRESENTATIVES
    assert d['identifier'] in REPRESENTATIVES and ref==d['geometry']['java_piece']
    assert b['binding']==PIECE_BINDING and 'parent' not in b
    assert len(g['bones'])==2 and not b.get('cubes')
    assert g['bones'][1]['name']=='dual_piece' and g['bones'][1]['parent']=='grip' and g['bones'][1]['pivot']==[0,24,0] and g['bones'][1]['cubes']
    continue
   if ref.startswith('geometry.kg_secret_held.piece') and version>=(2,8,68):
    secret_helper_binding_gate(p,d,ref,g)
    continue
   assert b['binding']=='q.item_slot_to_bone_name(context.item_slot)' and 'parent' not in b,(p,ref,b)
   if ref.startswith('geometry.kg_plate_held.'):
    assert d['identifier']=='kaleidoscope_grilling:skewer_plate' and not b.get('cubes'),ref
    assert g['bones'][1]=={'name':'plate_pose','parent':'grip','pivot':[0,24,0]},ref
    if ref=='geometry.kg_plate_held.body':
     assert len(g['bones'])==3 and g['bones'][-1]['name']=='plate_body',ref
    else:
     assert len(g['bones'])==5,ref
     row=g['bones'][-1]['name'].removeprefix('plate_row_')
     assert row in ('0','1','2','3','4'),ref
     assert g['bones'][2]=={'name':'plate_slot_'+row,'parent':'plate_pose','pivot':[0,24,0]},ref
     assert g['bones'][3]=={'name':'plate_fixed_'+row,'parent':'plate_slot_'+row,'pivot':[0,24,0]},ref
     assert g['bones'][-1]['parent']=='plate_fixed_'+row,ref
    assert set(animations[d['animations']['layout']]['bones'])=={f'plate_{kind}_{i}' for kind in ('slot','fixed') for i in range(5)},ref
    for alias in ('fp_right','fp_left','tp_right','tp_left'):assert set(animations[d['animations'][alias]]['bones'])=={'plate_pose'},ref
   elif ref.startswith('geometry.kg_a287.'):
    # A2.8.14 splits binding, display pose and handle-origin correction.
    assert len(g['bones'])==3 and not b.get('cubes'),ref
    pose,model=g['bones'][1:]
    assert pose=={'name':'skewer_pose','parent':'grip','pivot':[0,24,0]},ref
    assert model['name']=='skewer_model' and model['parent']=='skewer_pose' and model['pivot']==[0,24,0]
    for alias,anim in d['animations'].items():
     expected_bones={'skewer_model'} if alias.startswith('eat_') else {'skewer_pose','skewer_model'}
     if alias.startswith('fp_eat_') and 'java_piece' in d['geometry']:expected_bones.add('dual_piece')
     if scoped_caterpillar and alias=='probe_one_right':expected_bones.add('dual_piece')
     assert set(animations[anim]['bones'])==expected_bones,anim
    oldref=ref.replace('kg_a287.','kg_a283.');old=idx[oldref]
    assert model['cubes']==[c for bone in old['bones'] for c in bone.get('cubes',[])],ref
   elif ref.startswith('geometry.kg_secret_held.'):
    assert len(g['bones'])==3 and not b.get('cubes'),ref
    pose,model=g['bones'][1:]
    assert pose=={'name':'skewer_pose','parent':'grip','pivot':[0,24,0]},ref
    assert model['name']=='skewer_model' and model['parent']=='skewer_pose',ref
   elif ref=='geometry.kg_bottle_held.combined':
    assert len(g['bones'])==146 and not b.get('cubes'),ref
    assert {child['name'] for child in g['bones'][1:]}=={'shell'}|{f'pending_{tint}_color_{value}' for tint in range(16) for value in range(1,10)},ref
    for child in g['bones'][1:]:
     assert child['parent']=='grip' and child['pivot']==[0,24,0] and 'binding' not in child and child.get('cubes'),ref
    for anim in d['animations'].values():assert set(animations[anim]['bones'])=={'grip'},anim
   elif ref.startswith('geometry.kg_bottle_held.fixed.'):
    assert re.fullmatch(r'geometry\.kg_bottle_held\.fixed\.r[1-8]\.v[0-7]',ref),ref
    assert len(g['bones'])==3 and not b.get('cubes'),ref
    assert {child['name'] for child in g['bones'][1:]}=={'shell','contents'},ref
    for child in g['bones'][1:]:
     assert child['parent']=='grip' and child['pivot']==[0,24,0] and 'binding' not in child and child.get('cubes'),ref
    for anim in d['animations'].values():assert set(animations[anim]['bones'])=={'grip'},anim
   elif ref=='geometry.kg_a286.kg_a2763.advanced_rack_hand':
    assert len(g['bones'])==3 and not b.get('cubes'),ref
    pose,model=g['bones'][1:]
    assert pose=={'name':'rack_pose','parent':'grip','pivot':[0,24,0]}
    assert model['name']=='rack_model' and model['parent']=='rack_pose' and model['pivot']==[0,24,0]
    for anim in d['animations'].values():assert set(animations[anim]['bones'])=={'rack_pose','rack_model'},anim
   else:
    assert len(g['bones'])==1 and b.get('cubes'),ref
    for anim in d['animations'].values():assert set(animations[anim]['bones'])=={'grip'},anim
  if p.name.endswith('_skewer.attachable.json') and d['identifier']!='kaleidoscope_grilling:secret_skewer' and not (version>=(2,8,68) and d['identifier']=='kaleidoscope_grilling:unfinished_skewer'):
   old=repair.source(p);old=old['minecraft:attachable']['description']
   profiles=json.loads(re.search(r'PROFILE_BY_ITEM=Object.freeze\((\{.*?\})\)',(BP/'scripts/data.js').read_text()).group(1))
   from native_eating_clock import VARIABLE,ASSIGNMENT
   pre=d['scripts']['pre_animation']
   if scoped_caterpillar:
    assert pre[-1]=='v.kg_probe_piece_visible = '+ACTIVE+';',p
    pre=pre[:-1]
   if 'java_piece' in d['geometry']:
    assert pre[-1].startswith('v.kg_java_piece_visible = ') and pre[-1].endswith(';')
    pre=pre[:-1]
   if tuple(load(BP/'manifest.json')['header']['version'])>=(2,8,58):
    assert pre[0]==ASSIGNMENT
    pre=[row.replace(VARIABLE,'q.item_in_use_duration') for row in pre[1:]]
   if profiles.get(d['identifier'])=='THREE_RANDOM':assert "q.property('kaleidoscope_grilling:eat_profile')" in pre[0]
   else:
    assert [row.replace(_motion.ACTIVE_HAND,'q.is_using_item') for row in pre]==old['scripts']['pre_animation']
   if scoped_caterpillar:
    assert d['render_controllers']==old['render_controllers']+[PIECE],p
    assert {k:v for k,v in d['textures'].items() if k!='probe_piece'}==old['textures'],p
    assert set(d['geometry'])==set(old['geometry'])|{'probe_piece'},p
   elif 'java_piece' in d['geometry']:
    from build_java_dual_eating_projection import PIECE_CONTROLLER
    assert d['render_controllers']==old['render_controllers']+[PIECE_CONTROLLER]
    assert {k:v for k,v in d['textures'].items() if k!='java_piece'}==old['textures']
    assert set(d['geometry'])==set(old['geometry'])|{'java_piece'}
   else:
    assert d['render_controllers']==old['render_controllers'] and d['textures']==old['textures']
    assert set(d['geometry'])==set(old['geometry'])
  rows.append({'item':d['identifier'],'geometries':list(d['geometry'].values()),'poses':selected,'bound_bone':'grip'})
 expected_count=125 if version>=(2,8,119) else 124 if version>=(2,8,71) else 108 if version>=(2,8,68) else 107 if (RP/'attachables/secret_skewer.attachable.json').exists() else 106 if version >= (2,8,32) else 107
 assert len(rows)==expected_count and cases==expected_count*12,(len(rows),cases)
 # Regression reproduction: old dispatch can select zero poses for a normalized bone name.
 old=repair.source(RP/'attachables/empty_seasoning_bottle.attachable.json')['minecraft:attachable']['description']
 assert not any(expression(expr,0,'main_hand','rightitem') for row in old['scripts']['animate'] for expr in row.values())
 # World entities and native block items must never inherit a player hand binding.
 entities=0;native=0
 for p in (RP/'entity').glob('*.json'):
  d=load(p).get('minecraft:client_entity',{}).get('description',{})
  for ref in d.get('geometry',{}).values():
   if ref in idx:assert not any('binding' in b for b in idx[ref]['bones']),(p,ref)
  entities+=1
 for p in (BP/'blocks').glob('*.json'):
  c=load(p)['minecraft:block']['components'];v=c.get('minecraft:item_visual')
  if v:
   ref=v['geometry'];ref=ref.get('identifier') if isinstance(ref,dict) else ref
   assert not any('binding' in b for b in idx[ref]['bones']),ref;native+=1
 assert native==3
 return idx,refs,{'attachables':len(rows),'pose_cases':cases,'native_item_visuals':native,'client_entities':entities,'items':rows}
def plant_gate():
 count=0;plant_refs=set()
 idx={g['description']['identifier']:g for p in (RP/'models').rglob('*.geo.json') for g in load(p)['minecraft:geometry']}
 for name in repair.PLANTS:
  b=load(BP/f'blocks/{name}.json')['minecraft:block'];before=repair.source(BP/f'blocks/{name}.json')['minecraft:block']
  for c in [b['components']]+[p['components'] for p in b.get('permutations',[])]:
   ref=c.get('minecraft:geometry');ref=ref.get('identifier') if isinstance(ref,dict) else ref
   if ref:plant_refs.add(ref)
   for m in c.get('minecraft:material_instances',{}).values():
    if isinstance(m,dict):assert m['render_method']=='alpha_test_single_sided';count+=1
  # Gameplay state, collision and component logic are not part of the material fix.
  def strip(value):
   if isinstance(value,dict):return {k:strip(v) for k,v in value.items() if k!='render_method'}
   if isinstance(value,list):return [strip(v) for v in value]
   return value
  assert strip(b)==strip(before),name
 for ref in plant_refs:
  for bone in idx[ref]['bones']:
   for cube in bone.get('cubes',[]):
    if isinstance(cube['uv'],list):continue  # Box UV emits all six directions.
    for axis,size in enumerate(cube['size']):
     if size==0:assert all(face in cube['uv'] for face in [('east','west'),('up','down'),('north','south')][axis]),ref
 # Third-person interaction gestures must not translate arms out of their joints.
 animations=load(RP/'animations/player_binding.animation.json')['animations']
 for key,a in animations.items():
  if not any(key.startswith('animation.kg_imm.player.'+kind+'.') for kind in ('reach','brush','season')):continue
  for b in a['bones'].values():
   p=b.get('position',[]);vectors=p.values() if isinstance(p,dict) else [p]
   for vector in vectors:
    assert all(v==0 or isinstance(v,str) and v.endswith(' : 0.0') for v in vector),key
 print('A287 single-sided plant material instances:',count)
def secret_compat_gate():
 main=(BP/'scripts/main.js').read_text()
 assert 'VANILLA_SMOKED' not in main
 assert 'resolveSecretSmokedId(row)' in main
 assert "emitSecretIngredientConsumed(player,row)" in main
 runtime=(BP/'scripts/secret_compat_runtime.js').read_text()
 for event in (
  'kaleidoscope_grilling:register_secret_smoking',
  'kaleidoscope_grilling:register_secret_food_behavior',
  'kaleidoscope_grilling:register_secret_compat',
  'kaleidoscope_grilling:secret_ingredient_consumed',
 ):
  assert event in runtime,event
 subprocess.run(['node',str(Path(__file__).with_name('test_secret_compat_core.mjs'))],check=True)
 print('A287 secret-skewer extensible smoking/finish-use compatibility: PASS')

def parity_batch2_gate():
 main=(BP/'scripts/main.js').read_text()
 assert 'compactMatchingHotFood' in main and 'isFoodStack(e.itemStack)' in main
 cuisine=(BP/'scripts/a2750_cookery_cuisine_runtime.js').read_text()
 assert 'kaleidoscope_grilling:cookery_output_ready' not in cuisine  # event constant stays in the contract module
 assert 'COOKERY_OUTPUT_READY_EVENT' in cuisine and 'applyAuthoritativeCookeryOutput' in cuisine
 run_checked_once(['node','--experimental-vm-modules',str(Path(__file__).with_name('test_hot_food_manual_merge.mjs'))])
 subprocess.run(['node',str(Path(__file__).with_name('test_cookery_output_contract_core.mjs'))],check=True)
 print('A287 generic hot-food manual merge and authoritative Cookery output contract: PASS')

def parity_batch3_gate():
 oil=(BP/'scripts/a23_oil_world.js').read_text()
 assert 'MAX_SOURCES' not in oil and 'slice(0,MAX_SOURCES)' not in oil
 assert 'getDynamicPropertyIds' in oil and 'FLOW_SOURCE_BUDGET' in oil and 'heightRange' in oil
 main=(BP/'scripts/main.js').read_text()
 assert 'skewerIngredientDecision' in main and 'customSkewerCookedId' in main and 'isCompatRawSkewer' in main
 plate=(BP/'scripts/a25_plate_recipe_runtime.js').read_text()
 assert 'RAW_SKEWER_TAG' in plate and 'GRILLED_SKEWER_TAG' in plate
 subprocess.run(['node',str(Path(__file__).with_name('test_oil_source_registry_core.mjs'))],check=True)
 subprocess.run(['node',str(Path(__file__).with_name('test_skewer_compat_core.mjs'))],check=True)
 print('A287 per-source oil registry and declarative SkewerCompat parity: PASS')

if __name__=='__main__':
 plant_gate();secret_compat_gate();parity_batch2_gate();parity_batch3_gate();eating_gate();survival_gate();previous_gate()
