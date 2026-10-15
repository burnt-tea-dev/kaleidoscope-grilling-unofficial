"""Exact raw ONE routing extension. Generic basis inherited; camera parity unaccepted.

Run after historical calibrated layers. Never broaden their admission or hashes.
"""
import copy, hashlib, json, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'development/gameplay_core'))
P=ROOT/'projects/grilling/gameplay_core';BP=P/'behavior_pack';RP=P/'resource_pack'
CONTRACT=ROOT/'development/gameplay_core/fixtures/raw-one-route-contract.json'
MAIN=BP/'scripts/main.js';REGISTRY=BP/'scripts/raw_one_projection.js'
CLIPS=RP/'animations/raw_one_player.animation.json'
CONTROLLER=RP/'render_controllers/java_eating_player.render_controllers.json'
IMPORT="import {supportsRawOne,rawOneAnimation} from './raw_one_projection.js';\n"
ANCHOR="import {supportsJavaEatingProjection} from './java_eating_projection_items.js';\n"
ADMIT='supportsJavaEatingProjection(e.itemStack.typeId,profile)'
NEW_ADMIT='('+ADMIT+'||supportsRawOne(e.itemStack.typeId,profile,hand))'
ARMS=('rightArm','rightSleeve','leftArm','leftSleeve')
PIECE='controller.render.kg_java_eating.piece'

def encoded(v):return json.dumps(v,sort_keys=True,separators=(',',':')).encode()
def sha(v):return hashlib.sha256(v if isinstance(v,bytes) else encoded(v)).hexdigest()
def contract():return json.loads(CONTRACT.read_text())
def ids():return [r['id'] for r in contract()['routes']]
def player_id(hand):return 'animation.kg_raw_one.player.one.'+hand

def gate(hand,items=None,attachable=False):
 if hand not in ('right','left'):raise ValueError('Unknown raw ONE hand')
 items=ids() if items is None else items
 if not items or any(i not in ids() for i in items):raise ValueError('Unknown raw ONE item')
 right=hand=='right';slot='main_hand' if right else 'off_hand';other='off_hand' if right else 'main_hand'
 prefix=("c.is_first_person == 1 && c.item_slot == '"+slot+"' && " if attachable else 'variable.is_first_person == 1 && ')
 return (prefix+"q.is_using_item && q.has_property('kaleidoscope_grilling:eat_projection') && q.has_property('kaleidoscope_grilling:eat_profile') && q.has_property('kaleidoscope_grilling:eat_hand') && q.property('kaleidoscope_grilling:eat_projection') == 1 && q.property('kaleidoscope_grilling:eat_profile') == 1 && q.property('kaleidoscope_grilling:eat_hand') == "+str(1 if right else 2)+" && q.is_sneaking == 0 && q.is_swimming == 0 && q.is_gliding == 0 && q.is_riding == 0 && q.is_item_equipped('"+other+"') == 0 && q.is_item_name_any('slot.weapon."+('mainhand' if right else 'offhand')+"',"+','.join("'"+i+"'" for i in items)+')')
def visibility_gate():return '('+gate('right')+') || ('+gate('left')+')'
def pairs():
 from build_review_three_eating_projection import selector_pair
 old=selector_pair()[1];new='(rawOneAnimation(e.itemStack.typeId,profile,hand)||('+old+'))'
 return [(ANCHOR,ANCHOR+IMPORT),(ADMIT,NEW_ADMIT),('e.source.playAnimation('+old+',{','e.source.playAnimation('+new+',{')]
def restore_main(text):
 if IMPORT not in text:
  if 'supportsRawOne(' in text or 'rawOneAnimation(' in text:raise ValueError('Partial raw ONE main wrapper')
  return text
 for before,after in pairs():
  if text.count(after)!=1:raise ValueError('Ambiguous raw ONE main wrapper')
  text=text.replace(after,before,1)
 return text

def patch_main(text):
 text=restore_main(text)
 for before,after in pairs():
  if text.count(before)!=1:raise ValueError('Unknown raw ONE main anchor')
  text=text.replace(before,after,1)
 return text

def historical_document(path,value,*,owned=False):
 """Strict inverse of only this layer; reject partial or conflicting additions."""
 from eating_owner_context import owner_expression
 doc=copy.deepcopy(value)
 if path.parent==RP/'attachables':
  d=doc['minecraft:attachable']['description']
  aliases=['raw_one_'+h for h in ('right','left')]
  present=[a in d['animations'] for a in aliases]
  unexpected=any(str(k).startswith('raw_one_') for row in d['scripts']['animate'] for k in row)
  if not any(present):
   if unexpected:raise ValueError('Partial raw ONE alias')
   return doc
  if not all(present) or d['identifier'] not in ids():raise ValueError('Conflicting raw ONE admission')
  active=[]
  for hand,alias in zip(('right','left'),aliases):
   expr=gate(hand,[d['identifier']],True);expr=owner_expression(expr) if owned else expr;active.append(expr)
   if d['animations'].pop(alias)!='animation.kg_java_eating.item.one.'+hand:raise ValueError('Raw ONE item clip drift')
   row={alias:expr}
   if d['scripts']['animate'].count(row)!=1:raise ValueError('Raw ONE gate drift')
   d['scripts']['animate'].remove(row)
   for old in ('fp_'+hand,'eat_'+hand):
    rows=[r for r in d['scripts']['animate'] if old in r]
    if len(rows)!=1:raise ValueError('Raw ONE fallback row drift')
    value=rows[0][old];suffix=') && ('+expr+') == 0'
    if not(value.startswith('(') and value.endswith(suffix)):raise ValueError('Raw ONE suppression drift')
    rows[0][old]=value[1:-len(suffix)]
  visibility='v.kg_java_piece_visible = ('+' || '.join('('+c+')' for c in active)+');'
  if d['scripts']['pre_animation'].count(visibility)!=1:raise ValueError('Raw ONE piece visibility drift')
  d['scripts']['pre_animation'].remove(visibility)
  name=d['identifier'].split(':')[1]
  for field,expected in [('geometry','geometry.kg_java_dual.piece.'+name),('textures','textures/java_eating_piece/'+name)]:
   if d[field].pop('java_piece',None)!=expected:raise ValueError('Raw ONE helper alias drift')
  if d['render_controllers'].count(PIECE)!=1:raise ValueError('Raw ONE helper controller drift')
  d['render_controllers'].remove(PIECE)
 elif path==CONTROLLER:
  prefix='('+visibility_gate()+') ? 1 : ('
  fields=[(r,b) for r in doc['render_controllers']['controller.render.player.first_person']['part_visibility'] for b in ARMS if b in r]
  wrapped=[(r,b) for r,b in fields if r[b].startswith(prefix) and r[b].endswith(')')]
  if wrapped and (len(fields)!=4 or len(wrapped)!=4):raise ValueError('Partial raw ONE visibility')
  for r,b in wrapped:r[b]=r[b][len(prefix):-1]
 return doc

def validate_sources():
 from java_eating_piece_resolver import available_fixed_piece
 c=contract()
 if ids()!=['kaleidoscope_grilling:raw_fish_skewer','kaleidoscope_grilling:raw_caterpillar_skewer']:raise ValueError('Raw ONE scope changed')
 for relative,digest in c['source_files'].items():
  if sha((ROOT/relative).read_bytes())!=digest:raise ValueError('Raw ONE source drift: '+relative)
 for row in c['routes']:
  if available_fixed_piece(ROOT,row['id'],'ONE')!=row['helper_model']:raise ValueError('Raw helper resolution drift')
 return c

def augment(output):
 import build_java_eating_projection as g
 import build_java_dual_eating_projection as dual
 from eating_owner_context import legacy_document
 c=validate_sources();output=dict(output)
 def get(path):return copy.deepcopy(output.get(path) if path in output else json.loads(path.read_text()))
 donor=legacy_document(get(RP/'animations/java_eating_player.animation.json'))
 if sha(donor)!=c['base_sha256']['resource_pack/animations/java_eating_player.animation.json']:raise ValueError('Raw ONE donor changed')
 clips={}
 for hand in ('right','left'):
  clip=copy.deepcopy(donor['animations']['animation.kg_java_eating.player.one.'+hand]);clip['blend_weight']=gate(hand);clips[player_id(hand)]=clip
 output[CLIPS]={'format_version':donor['format_version'],'animations':clips}
 for item in ids():
  name=item.split(':')[1];p=RP/'attachables'/(name+'.attachable.json')
  doc=historical_document(p,legacy_document(get(p)));d=doc['minecraft:attachable']['description']
  if sha(doc)!=c['base_sha256'][p.relative_to(P).as_posix()] or not g.fixed_geometry(d):raise ValueError('Raw ONE base attachable drift: '+item)
  active=[]
  for hand in ('right','left'):
   expr=gate(hand,[item],True);active.append(expr)
   for old in ('fp_'+hand,'eat_'+hand):
    rows=[r for r in d['scripts']['animate'] if old in r]
    if len(rows)!=1:raise ValueError('Missing raw ONE fallback')
    rows[0][old]='('+rows[0][old]+') && ('+expr+') == 0'
   alias='raw_one_'+hand;d['animations'][alias]='animation.kg_java_eating.item.one.'+hand;d['scripts']['animate'].append({alias:expr})
  dual.attach_piece(output,g,d,'ONE',active);output[p]=doc
 doc=historical_document(CONTROLLER,legacy_document(get(CONTROLLER)))
 if sha(doc)!=c['base_sha256'][CONTROLLER.relative_to(P).as_posix()]:raise ValueError('Raw ONE visibility predecessor drift')
 fields=[(r,b) for r in doc['render_controllers']['controller.render.player.first_person']['part_visibility'] for b in ARMS if b in r]
 if len(fields)!=4:raise ValueError('Raw ONE arm visibility shape changed')
 for r,b in fields:r[b]='('+visibility_gate()+') ? 1 : ('+r[b]+')'
 output[CONTROLLER]=doc
 output[REGISTRY]=( '// Exact raw ONE scope; inherited generic basis, no camera parity claim.\nexport const RAW_ONE_IDS=Object.freeze('+json.dumps(ids())+');\n'
 "export function supportsRawOne(id,profile,hand){return profile==='ONE'&&(hand==='main'||hand==='off')&&RAW_ONE_IDS.includes(id);}\n"
 "export function rawOneAnimation(id,profile,hand){return supportsRawOne(id,profile,hand)?'animation.kg_raw_one.player.one.'+(hand==='off'?'left':'right'):null;}\n")
 output[MAIN]=patch_main(output.get(MAIN) or MAIN.read_text())
 return output
