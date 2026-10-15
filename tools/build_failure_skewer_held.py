"""Pinned failure-skewer body selection; existing owner/socket projection is separate.

Author assets CC BY-NC-SA4.0. No vanilla reference textures are redistributed.
"""
from pathlib import Path
from functools import lru_cache
import argparse,copy,hashlib,importlib.util,json,tempfile
from held_visual_channels import hand_channel,hand_owner,FAILURE
ROOT=Path(__file__).resolve().parents[1];P=ROOT/'projects/grilling/gameplay_core';RP=P/'resource_pack';BP=P/'behavior_pack'
FIX=ROOT/'development/gameplay_core/fixtures/java-failure-skewer-9a1acdab';ASSETS=FIX/'common/src/main/resources/assets'
NS='kaleidoscope_grilling:';NAMES=('mysterious_skewer','dark_grilling');IDS=tuple(NS+n for n in NAMES)
PROFILES={i+s:p for i in IDS for s,p in [('', 'THREE'),('_java_three_alt','THREE_ALT')]}
HELPER='controller.render.kg_failure_held.helper'

def exporter():
 spec=importlib.util.spec_from_file_location('failure_asset_export',ROOT/'projects/grilling/tools/build_assets.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m

@lru_cache(maxsize=1)
def source():
 manifest=json.loads((FIX/'source-manifest.json').read_text())
 assert manifest['commit']=='9a1acdab27698457bec16c9362678e574895a28c'
 for name,row in manifest['files'].items():
  data=(FIX/name).read_bytes();assert hashlib.sha256(data).hexdigest()==row['sha256'],name
 return manifest

@lru_cache(maxsize=2)
def root_doc(name):return json.loads((ASSETS/'kaleidoscope_grilling/models/item'/f'{name}.json').read_text())
def model_ids(name):return [NS+'item/'+name]+[r['model']for r in root_doc(name)['overrides']]
def selection(name,state,source_index,bite):
 values={NS+'skewer_state':state/64,NS+'failed_skewer_source':source_index/32,NS+'skewer_bite_stage':bite/4};selected=0
 for index,row in enumerate(root_doc(name)['overrides'],1):
  if all(values.get(k,float('-inf'))>=v for k,v in row['predicate'].items()):selected=index
 return selected

@lru_cache(maxsize=2)
def selectors(name):
 # Prove compression against every reachable input. Source overrides win only
 # because this pinned ordered model says so, not because the port assumes it.
 states=[selection(name,s,0,b)for s in range(64)for b in range(4)]
 sources=[selection(name,0,s,b)for s in range(20)for b in range(4)]
 for s in range(20):
  for st in range(64):
   for b in range(4):assert selection(name,st,s,b)==(sources[s*4+b]if s else states[st*4+b])
 return states,sources

def model_alias(index):return 'model_'+str(index)
def controller_id(name):return 'controller.render.kg_failure_held.'+name

def base_assets():
 source();e=exporter();out={};all_geo=[];controllers={};secret=json.loads((RP/'attachables/secret_skewer.attachable.json').read_text())['minecraft:attachable']['description']
 helper_refs={k:v for k,v in secret['geometry'].items()if k=='java_secret_piece'or k.startswith('piece_')}
 helper_textures={k:v for k,v in secret['textures'].items()if k=='stick'or(k.startswith('food_')and k[5:].isdigit())}
 expected_display={k:root_doc(NAMES[0])['display'][k]for k in ['firstperson_righthand','firstperson_lefthand','thirdperson_righthand','thirdperson_lefthand']}
 for name in NAMES:
  refs={};textures={};states,sources=selectors(name)
  for index,mid in enumerate(model_ids(name)):
   m=e.resolve_model(mid,ASSETS)
   assert {k:m['display'][k]for k in expected_display}==expected_display,(mid,'held display changed')
   with tempfile.TemporaryDirectory()as tmp:
    atlas=Path(tmp)/'atlas.png';placements=e.build_atlas(m,atlas,ASSETS);png=atlas.read_bytes()
   digest=hashlib.sha256(png).hexdigest()[:20];tex=RP/'textures/failure_skewer'/f'{digest}.png';out[tex]=png
   geo=e.geometry(m,name+'_'+str(index),placements,[[0,0]],allow_native_uv_rotation=True)['minecraft:geometry'][0]
   geo['description']['identifier']='geometry.kg_failure_held.'+name+'_'+str(index);geo['description']['visible_bounds_height']=8;geo['description']['visible_bounds_width']=8
   cubes=[c for b in geo['bones']for c in b.get('cubes',[])]
   for c in cubes:
    c['origin'][1]+=24
    if 'pivot'in c:c['pivot'][1]+=24
   geo['bones']=[{'name':'grip','pivot':[0,24,0],'binding':'q.item_slot_to_bone_name(context.item_slot)'},{'name':'skewer_pose','parent':'grip','pivot':[0,24,0]},{'name':'skewer_model','parent':'skewer_pose','pivot':[0,24,0],'cubes':cubes}]
   all_geo.append(geo);refs[model_alias(index)]=geo['description']['identifier'];textures[model_alias(index)]=tex.relative_to(RP).with_suffix('').as_posix()
  arrays={}
  for kind,prefix in [('geometries','Geometry'),('textures','Texture')]:
   arrays[kind]={'Array.states':[prefix+'.'+model_alias(i)for i in states],'Array.sources':[prefix+'.'+model_alias(i)for i in sources]}
  selector="v.kg_failure_source > 0 ? Array.sources[v.kg_failure_source*4+v.kg_bite_stage] : Array.states[v.kg_failure_state*4+v.kg_bite_stage]"
  controllers[controller_id(name)]={'arrays':arrays,'geometry':selector,'materials':[{'*':'Material.default'}],'textures':[selector],'part_visibility':[{'*':0},{'skewer_model':'v.kg_failure_ready == 1'}]}
  for suffix in ('','_java_three_alt','_native_plain'):
   identifier=NS+name+suffix;plain=suffix=='_native_plain'
   init=['v.kg_failure_source = 0;','v.kg_failure_state = 0;','v.kg_failure_helper_index = 0;','v.kg_failure_ready = 0;','v.kg_failure_helper_visible = 0;','v.kg_bite_stage = 0;']
   pre=[f'v.kg_failure_source = math.floor(math.clamp({hand_channel(0)},0,19));',f'v.kg_failure_state = math.floor(math.clamp({hand_channel(1)},0,63));',f'v.kg_failure_helper_index = math.floor(math.clamp({hand_channel(2)},0,213));',f'v.kg_failure_ready = {hand_owner(identifier)} && {hand_channel(11)} == {FAILURE};','v.kg_failure_helper_visible = 0;']
   aliases={key:'animation.kg_a287.skewer_'+key for key in ['fp_right','fp_left','tp_right','tp_left']}
   animate=[{key:"c.is_first_person == "+str(int(key.startswith('fp')))+" && c.item_slot == '"+('main_hand'if key.endswith('right')else'off_hand')+"'"}for key in aliases]
   d={'identifier':identifier,'materials':{'default':'entity_alphatest_one_sided'},'textures':{**textures,**({}if plain else helper_textures)},'geometry':{**refs,**({}if plain else helper_refs)},'animations':aliases,'scripts':{'initialize':init,'pre_animation':pre+(['v.kg_bite_stage = 0;']if plain else []),'animate':animate},'render_controllers':[controller_id(name)]+([]if plain else[HELPER])}
   out[RP/'attachables'/f'{name}{suffix}.attachable.json']={'format_version':'1.26.0','minecraft:attachable':{'description':d}}
 helper=copy.deepcopy(json.loads((RP/'render_controllers/secret_held.render_controllers.json').read_text())['render_controllers']['controller.render.kg_secret_held.piece'])
 def variables(v):
  if isinstance(v,str):return v.replace('v.kg_secret_piece_index','v.kg_failure_helper_index').replace('v.kg_secret_piece_visible','v.kg_failure_helper_visible')
  if isinstance(v,list):return [variables(x)for x in v]
  if isinstance(v,dict):return {k:variables(x)for k,x in v.items()}
  return v
 controllers[HELPER]=variables(helper)
 out[RP/'models/entity/failure_skewer_held.geo.json']={'format_version':'1.21.0','minecraft:geometry':all_geo}
 out[RP/'render_controllers/failure_skewer_held.render_controllers.json']={'format_version':'1.8.0','render_controllers':controllers}
 return out

def apply_projection(d,conditions,profile):
 rows=[r for r in d['scripts']['pre_animation']if not r.startswith('v.kg_failure_helper_visible = ')]
 rows.append('v.kg_failure_helper_visible = '+('v.kg_failure_ready == 1 && v.kg_failure_helper_index > 0 && ('+' || '.join('('+c+')'for c in conditions)+')'if profile=='THREE'else'0')+';')
 # Pose interpolates; source geometry advances at integer tick boundaries only.
 active="q.is_using_item && ((c.item_slot == 'main_hand' && q.property('kaleidoscope_grilling:eat_hand') == 1) || (c.item_slot == 'off_hand' && q.property('kaleidoscope_grilling:eat_hand') == 2))"
 ticks="q.property('kaleidoscope_grilling:eat_elapsed_ticks')";thresholds=(20,47,71)if profile=='THREE'else(20,44,70)
 a,b,c=thresholds
 rows.append(f'v.kg_bite_stage = ({active}) ? ({ticks} >= {c} ? 3 : ({ticks} >= {b} ? 2 : ({ticks} >= {a} ? 1 : 0))) : 0;')
 d['scripts']['pre_animation']=rows


MAIN=BP/'scripts/main.js';REGISTRY=BP/'scripts/failure_skewer_projection.js';PLAYER_FILE=RP/'animations/failure_skewer_player.animation.json';PLAYER_CONTROLLER=RP/'render_controllers/java_eating_player.render_controllers.json'
STATE_IMPORT="import {createFailedSkewer,isFailureSkewer} from './failure_skewer_visual_core.js';\n"
PROJECTION_IMPORT="import {supportsFailureEating,failureEatingAnimation} from './failure_skewer_projection.js';\n"

def main_changes(raw_one=False):
 from build_review_three_eating_projection import selector_pair
 selector=selector_pair()[1]
 if raw_one:selector="(rawOneAnimation(e.itemStack.typeId,profile,hand)||("+selector+"))"
 return [("import {supportsJavaEatingProjection} from './java_eating_projection_items.js';\n","import {supportsJavaEatingProjection} from './java_eating_projection_items.js';\n"+PROJECTION_IMPORT),
 ('supportsJavaEatingProjection(e.itemStack.typeId,profile)','(supportsJavaEatingProjection(e.itemStack.typeId,profile)||supportsFailureEating(e.itemStack.typeId,profile))'),
 ('e.source.playAnimation('+selector+',{','e.source.playAnimation((failureEatingAnimation(e.itemStack.typeId,profile,hand)||('+selector+')),{')]

def state_changes():
 return [('if(!out)return new ItemStack(MYSTERIOUS_ID,1);','if(!out)return failedStack(raw,MYSTERIOUS_ID);'),
 ('function failedStack(raw,id){const stack=new ItemStack(id,1);return copyCustomData(raw,stack)}','function failedStack(raw,id){return createFailedSkewer(raw,id,(type,amount)=>new ItemStack(type,amount),type=>new EnchantmentType(type))}'),
 ('if(id===SECRET_ID)try{syncSecretHeld(e.source,{completedUse:a.use})}','if(id===SECRET_ID||isFailureSkewer(id))try{syncSecretHeld(e.source,{completedUse:a.use})}'),
 ('if(a.id===SECRET_ID)try{syncSecretHeld(e.source)}','if(a.id===SECRET_ID||isFailureSkewer(a.id))try{syncSecretHeld(e.source)}')]

def restore_main(text):
 if PROJECTION_IMPORT in text:
  for before,after in reversed(main_changes("import {supportsRawOne,rawOneAnimation}" in text)):
   if text.count(after)!=1:raise ValueError('Failure projection wrapper changed')
   text=text.replace(after,before,1)
 if STATE_IMPORT in text:
  if text.count(STATE_IMPORT)!=1:raise ValueError('Duplicate failure state import')
  text=text.replace(STATE_IMPORT,'',1)
  for before,after in state_changes():
   if text.count(after)!=1:raise ValueError('Failure state conversion changed')
   text=text.replace(after,before,1)
 return text

def patch_main(text):
 text=restore_main(text)
 for before,after in state_changes()+main_changes("import {supportsRawOne,rawOneAnimation}" in text):
  if text.count(before)!=1:raise ValueError('Failure exact main anchor missing')
  text=text.replace(before,after,1)
 from build_slime_frame_selector import MAIN_IMPORT
 return text.replace(MAIN_IMPORT,MAIN_IMPORT+STATE_IMPORT,1) if text.startswith(MAIN_IMPORT) else STATE_IMPORT+text

def gate(profile,hand,identifier=None,attachable=False):
 import build_java_eating_projection as g
 items=[identifier]if identifier else [i for i,p in PROFILES.items()if p==profile]
 scope=g.held_profile_condition(profile,hand,{profile:items})
 # Match the safe source projection's other-hand exclusion for these new routes.
 if profile=='THREE_ALT':scope+=' && '+g.dual_renderer.empty_helper(hand)
 prefix=("c.is_first_person == 1 && c.item_slot == '"+('main_hand'if hand=='right'else'off_hand')+"' && "if attachable else'variable.is_first_person == 1 && ')
 return prefix+g.CONTEXT+' && '+scope

def player_id(profile,hand):return 'animation.kg_failure_held.player.'+profile.lower()+'.'+hand

def controller_prefix(bone):
 branches=[]
 for profile in ['THREE','THREE_ALT']:
  for hand in ['right','left']:
   visible='1'if profile=='THREE'or bone.startswith(hand)else'0'
   branches.append('('+gate(profile,hand)+') ? '+visible+' : (')
 return ''.join(branches),')'*len(branches)

def predecessor_document(path,doc):
 if path!=PLAYER_CONTROLLER:return doc
 doc=copy.deepcopy(doc)
 fields=[(row,bone)for row in doc['render_controllers']['controller.render.player.first_person']['part_visibility']for bone in ['rightArm','rightSleeve','leftArm','leftSleeve']if bone in row]
 present=[]
 for row,bone in fields:
  before,after=controller_prefix(bone);value=row[bone];matches=value.startswith(before)and value.endswith(after);present.append(matches)
  if matches:row[bone]=value[len(before):-len(after)]
 if any(present)and(not all(present)or len(fields)!=4):raise ValueError('Partial failure controller wrapper')
 return doc

def augment(output):
 import build_java_eating_projection as g
 out=dict(output);source_clip=out.get(RP/'animations/java_eating_player.animation.json')or json.loads((RP/'animations/java_eating_player.animation.json').read_text())
 clips={}
 for profile in ['THREE','THREE_ALT']:
  for hand in ['right','left']:
   clip=copy.deepcopy(source_clip['animations'][g.player_animation_id(profile,hand)])
   clip['blend_weight']=gate(profile,hand);clips[player_id(profile,hand)]=clip
 out[PLAYER_FILE]={'format_version':'1.8.0','animations':clips}
 for identifier,profile in PROFILES.items():
  path=RP/'attachables'/(identifier.split(':')[1]+'.attachable.json');doc=copy.deepcopy(out[path]);d=doc['minecraft:attachable']['description'];conditions=[]
  for hand in ['right','left']:
   active=gate(profile,hand,identifier,True);conditions.append(active)
   for route in d['scripts']['animate']:
    for alias in ['fp_'+hand,'eat_'+hand,'eat_alt_'+hand]:
     if alias in route:route[alias]='('+route[alias]+') && ('+active+') == 0'
   alias='failure_eat_'+hand;d['animations'][alias]=g.item_animation_id(profile,hand);d['scripts']['animate'].append({alias:active})
  apply_projection(d,conditions,profile);out[path]=doc
 doc=predecessor_document(PLAYER_CONTROLLER,out.get(PLAYER_CONTROLLER)or json.loads(PLAYER_CONTROLLER.read_text()))
 for row in doc['render_controllers']['controller.render.player.first_person']['part_visibility']:
  for bone in ['rightArm','rightSleeve','leftArm','leftSleeve']:
   if bone in row:
    prefix,suffix=controller_prefix(bone);row[bone]=prefix+row[bone]+suffix
 out[PLAYER_CONTROLLER]=doc
 out[REGISTRY]="// Exact failure-item projection admission; source-derived, client acceptance separate.\nconst profiles=Object.freeze("+json.dumps(PROFILES,separators=(',',':'))+");\nexport function supportsFailureEating(id,profile){return Object.hasOwn(profiles,id)&&profiles[id]===profile;}\nexport function failureEatingAnimation(id,profile,hand){return supportsFailureEating(id,profile)?'animation.kg_failure_held.player.'+profile.toLowerCase()+'.'+(hand==='off'?'left':'right'):null;}\n"
 out[MAIN]=patch_main(out.get(MAIN)or MAIN.read_text());return out


def predecessor_script(path,text):
 """Undo only exact failure changes; older source checks still compare every byte."""
 name=Path(path).name
 if name=='main.js':return restore_main(text)
 if name=='secret_held_runtime.js':
  import_line="import {isFailureSkewer,failureHeldPayload} from './failure_skewer_visual_core.js';\n"
  changes=[("canonicalFoodId(before.id)==='kaleidoscope_grilling:secret_skewer'","(canonicalFoodId(before.id)==='kaleidoscope_grilling:secret_skewer'||isFailureSkewer(before.id))"),
   ("  if(kind!=='secret')continue;","  if(kind==='failure'){\n   if(completed?.has(hand))invalidateHeldVisual(player,hand);\n   else writeHeldVisual(player,hand,'failure',failureHeldPayload(current,rawReader));\n   continue;\n  }\n  if(kind!=='secret')continue;")]
 elif name=='held_visual_transport.js':
  import_line="import {isFailureSkewer,FAILURE_VISUAL_MARKER} from './failure_skewer_visual_core.js';\n"
  changes=[(" const id=canonicalFoodId(typeId);"," const id=canonicalFoodId(typeId);\n if(isFailureSkewer(id))return 'failure';"),
   ("(kind==='bottle'&&marker===HELD_VISUAL_BOTTLE)||","(kind==='bottle'&&marker===HELD_VISUAL_BOTTLE)||\n      (kind==='failure'&&marker===FAILURE_VISUAL_MARKER&&values[0]<=19&&values[1]<=63&&values[2]<=213&&values.slice(3,11).every(v=>v===0))||")]
 else:return text
 if import_line not in text:return text
 if text.count(import_line)!=1:raise ValueError('Duplicate failure provider import')
 text=text.replace(import_line,'',1)
 for before,after in changes:
  if text.count(after)!=1:raise ValueError('Failure provider exact predecessor changed: '+name)
  text=text.replace(after,before,1)
 return text

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args()
 from build_eating_motion import build
 output=build(review_three_routes=True)
 paths=set(base_assets())|{MAIN,REGISTRY,PLAYER_FILE,PLAYER_CONTROLLER}
 for p in paths:
  value=output[p];data=value if isinstance(value,bytes)else (value if isinstance(value,str)else json.dumps(value,ensure_ascii=False,indent=2)+'\n').encode()
  if args.check:assert p.read_bytes()==data,p
  else:p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
 print('Failure body selection generated; native-client acceptance remains separate')
