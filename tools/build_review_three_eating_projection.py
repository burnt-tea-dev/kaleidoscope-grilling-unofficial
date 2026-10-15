"""Exact fixed-mesh THREE review routes. No blanket profile admission or new basis."""
import copy, hashlib, json, re, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'development/gameplay_core'))
P=ROOT/'projects/grilling/gameplay_core';BP=P/'behavior_pack';RP=P/'resource_pack'
CONTRACT=ROOT/'development/gameplay_core/fixtures/review-three-route-contract.json'
MAIN=BP/'scripts/main.js';REGISTRY=BP/'scripts/review_three_projection.js'
PLAYER='animation.kg_review_three.player.three.right'
ALIAS='review_three_right'
IMPORT="import {supportsReviewedThree,reviewedThreeAnimation} from './review_three_projection.js';\n"
ANCHOR="import {supportsJavaEatingProjection} from './java_eating_projection_items.js';\n"
OLD_ADMIT='supportsJavaEatingProjection(e.itemStack.typeId,profile)'
NEW_ADMIT='('+OLD_ADMIT+'||supportsReviewedThree(e.itemStack.typeId,profile,hand))'

def ids():return [r['item_id'] for r in json.loads(CONTRACT.read_text())['routes']]
def gate(items=None,attachable=False):
 items=ids() if items is None else items
 return (('c.is_first_person == 1 && c.item_slot == \'main_hand\' && ' if attachable else 'variable.is_first_person == 1 && ')+
 "q.is_using_item && q.has_property('kaleidoscope_grilling:eat_projection') && q.has_property('kaleidoscope_grilling:eat_profile') && q.has_property('kaleidoscope_grilling:eat_hand') && q.property('kaleidoscope_grilling:eat_projection') == 1 && q.property('kaleidoscope_grilling:eat_profile') == 3 && q.property('kaleidoscope_grilling:eat_hand') == 1 && q.is_sneaking == 0 && q.is_swimming == 0 && q.is_gliding == 0 && q.is_riding == 0 && q.is_item_equipped('off_hand') == 0 && q.is_item_name_any('slot.weapon.mainhand',"+','.join("'"+i+"'" for i in items)+')')
def selector_pair():
 from build_two_route_eating_projection import new_selector
 old=new_selector();return old,"(reviewedThreeAnimation(e.itemStack.typeId,profile,hand)||("+old+"))"
def restore_main(text):
 if IMPORT not in text:
  if 'supportsReviewedThree(' in text or 'reviewedThreeAnimation(' in text:raise ValueError('Partial reviewed THREE wrapper')
  return text
 old,new=selector_pair()
 for before,after in [(ANCHOR,ANCHOR+IMPORT),(OLD_ADMIT,NEW_ADMIT),('e.source.playAnimation('+old+',{','e.source.playAnimation('+new+',{')]:
  if text.count(after)!=1:raise ValueError('Ambiguous reviewed THREE wrapper')
  text=text.replace(after,before,1)
 return text

def patch_main(text):
 text=restore_main(text);old,new=selector_pair()
 for before,after in [(ANCHOR,ANCHOR+IMPORT),(OLD_ADMIT,NEW_ADMIT),('e.source.playAnimation('+old+',{','e.source.playAnimation('+new+',{')]:
  if text.count(before)!=1:raise ValueError('Unknown canonical THREE dispatch anchor')
  text=text.replace(before,after,1)
 return text

def strip_attachable(doc):
 d=doc['minecraft:attachable']['description']
 if ALIAS in d['animations']:
  if d['identifier'] not in ids() or d['animations'][ALIAS]!='animation.kg_java_eating.item.three.right':raise ValueError('Unknown reviewed attachable alias')
  expected={ALIAS:gate([d['identifier']],True)}
  if d['scripts']['animate'].count(expected)!=1:raise ValueError('Unknown reviewed attachable route')
  del d['animations'][ALIAS]
  d['scripts']['animate'].remove(expected)
 elif any(ALIAS in row for row in d['scripts']['animate']):raise ValueError('Partial reviewed attachable route')
 return doc

def validate_contract(g):
 from java_eating_piece_resolver import available_fixed_piece,model_path
 table=json.loads(re.search(r'PROFILE_BY_ITEM=Object.freeze\((\{.*?\})\)',(BP/'scripts/data.js').read_text()).group(1))
 rows=json.loads(CONTRACT.read_text())['routes']
 if len(rows)!=20 or len(set(ids()))!=20:raise ValueError('Exact reviewed THREE list changed')
 for row in rows:
  item=row['item_id'];p=BP/'items'/(item.split(':')[1]+'.json');doc=json.loads(p.read_text())['minecraft:item']
  if table.get(item)!=row['source_profile'] or doc['components']['minecraft:use_modifiers']['use_duration']!=5:raise ValueError('Profile/duration drift: '+item)
  piece=available_fixed_piece(ROOT,item,'THREE')
  if piece!=row['helper_model'] or hashlib.sha256(model_path(ROOT,piece).read_bytes()).hexdigest()!=row['helper_sha256']:raise ValueError('Pinned helper drift: '+item)
  for path,sha in {**row['geometry_sha256'],**row['helper_source_assets_sha256']}.items():
   if hashlib.sha256((ROOT/path).read_bytes()).hexdigest()!=sha:raise ValueError('Pinned geometry drift: '+path)
 return rows

def augment(output):
 import build_java_eating_projection as g
 import build_java_dual_eating_projection as dual
 from build_two_route_eating_projection import DEDICATED,NATIVE_CLIPS_SHA256,encoded
 output=dict(output);rows=validate_contract(g)
 source=output.get(DEDICATED) or json.loads(DEDICATED.read_text())
 if hashlib.sha256(encoded(source)).hexdigest()!=NATIVE_CLIPS_SHA256:raise ValueError('Immutable G127 clip changed')
 clip=copy.deepcopy(source['animations']['animation.kg_isolated_two_route_v1.player.pearl_three.right'])
 # All pose/socket/timing/scale bytes stay identical. Only exact gate expands.
 clip['blend_weight']=gate()
 output[RP/'animations/review_three_player.animation.json']={'format_version':'1.8.0','animations':{PLAYER:clip}}
 for row in rows:
  item=row['item_id'];p=RP/'attachables'/(item.split(':')[1]+'.attachable.json')
  doc=copy.deepcopy(output.get(p) or json.loads(p.read_text()));d=doc['minecraft:attachable']['description']
  if not g.fixed_geometry(d):raise ValueError('Non-owned fixed geometry: '+item)
  active=gate([item],True);strip_attachable(doc)
  for route in d['scripts']['animate']:
   for alias in ['fp_right','eat_right','eat_alt_right']:
    if alias in route:
     suffix=') && ('+active+') == 0';old=route[alias]
     if old.startswith('(') and old.endswith(suffix):old=old[1:-len(suffix)]
     route[alias]='('+old+') && ('+active+') == 0'
  d['animations'][ALIAS]='animation.kg_java_eating.item.three.right';d['scripts']['animate'].append({ALIAS:active})
  d['render_controllers']=[x for x in d['render_controllers']if x!=dual.PIECE_CONTROLLER]
  d['scripts']['pre_animation']=[x for x in d['scripts']['pre_animation']if not x.startswith('v.kg_java_piece_visible = ')]
  dual.attach_piece(output,g,d,'THREE',[active]);output[p]=doc
 p=RP/'render_controllers/java_eating_player.render_controllers.json';doc=copy.deepcopy(output.get(p)or json.loads(p.read_text()));prefix='('+gate()+') ? 1 : (';count=0
 for row in doc['render_controllers']['controller.render.player.first_person']['part_visibility']:
  for bone in ['rightArm','rightSleeve','leftArm','leftSleeve']:
   if bone in row:
    old=row[bone]
    if old.startswith(prefix)and old.endswith(')'):old=old[len(prefix):-1]
    row[bone]=prefix+old+')';count+=1
 if count!=4:raise ValueError('FP arm visibility contract changed')
 output[p]=doc
 output[REGISTRY]='// Generated exact review scope. Other profiles/hands retain existing routing.\nexport const REVIEWED_THREE_IDS=Object.freeze('+json.dumps(ids())+');\nexport function supportsReviewedThree(id,profile,hand){return profile===\'THREE\'&&hand===\'main\'&&REVIEWED_THREE_IDS.includes(id);}\nexport function reviewedThreeAnimation(id,profile,hand){return supportsReviewedThree(id,profile,hand)?\''+PLAYER+'\':null;}\n'
 output[MAIN]=patch_main(output.get(MAIN)or MAIN.read_text());return output

def historical_document(path,document,*,owned=False):
 """Invert only this generator's exact current route delta for older witnesses."""
 doc=copy.deepcopy(document)
 if path.parent==RP/'attachables':
  d=doc['minecraft:attachable']['description'];item=d['identifier']
  if item not in ids() or ALIAS not in d['animations']:return doc
  active=gate([item],True)
  if owned:
   from eating_owner_context import owner_expression
   active=owner_expression(active)
  if d['animations'].pop(ALIAS)!='animation.kg_java_eating.item.three.right':raise ValueError('Unknown reviewed item clip')
  row={ALIAS:active}
  if d['scripts']['animate'].count(row)!=1:raise ValueError('Unknown reviewed item gate')
  d['scripts']['animate'].remove(row)
  for route in d['scripts']['animate']:
   for alias in ['fp_right','eat_right','eat_alt_right']:
    if alias in route:
     expr=route[alias];suffix=') && ('+active+') == 0'
     if not(expr.startswith('(')and expr.endswith(suffix)):raise ValueError('Unknown reviewed fallback suppression')
     route[alias]=expr[1:-len(suffix)]
  variable='v.kg_java_piece_visible = (('+active+'));'
  if d['scripts']['pre_animation'].count(variable)!=1:raise ValueError('Unknown reviewed piece gate')
  d['scripts']['pre_animation'].remove(variable)
  if d['geometry'].pop('java_piece')!='geometry.kg_java_dual.piece.'+item.split(':')[1]:raise ValueError('Unknown reviewed helper geometry')
  if d['textures'].pop('java_piece')!='textures/java_eating_piece/'+item.split(':')[1]:raise ValueError('Unknown reviewed helper texture')
  d['render_controllers'].remove('controller.render.kg_java_eating.piece')
 elif path==RP/'render_controllers/java_eating_player.render_controllers.json':
  prefix='('+gate()+') ? 1 : ('
  rows=doc['render_controllers']['controller.render.player.first_person']['part_visibility']
  fields=[(row,bone)for row in rows for bone in ['rightArm','rightSleeve','leftArm','leftSleeve']if bone in row]
  wrapped=[(row,bone)for row,bone in fields if row[bone].startswith(prefix)and row[bone].endswith(')')]
  if wrapped and (len(fields)!=4 or len(wrapped)!=4):raise ValueError('Partial reviewed arm visibility layer')
  for row,bone in wrapped:row[bone]=row[bone][len(prefix):-1]
 return doc

def predecessor_document(path, value):
 """Invert exact owner-qualified route strings, never normalize unrelated fields."""
 return historical_document(path,value,owned=path.parent == RP/'attachables')
