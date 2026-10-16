"""Pinned volumetric ingredient cells on the existing bound hand rig.

Food surfaces use sampled particle palettes and source face/stage tint atlases.
The separate authored helper still uses the original raw-last-item icon.
"""
from pathlib import Path
import argparse,copy,json
from secret_skewer_assets import held_geometries,partial_geometries,PARTIAL_STATES,COMPLETE_STATES,palette_refs,palette_keys
from build_secret_palettes import build as build_palettes
from secret_idle_calibration import augment as augment_idle
from secret_terminal_visibility import augment as augment_terminal
from generated_food_sprite import helper_assets
from held_visual_channels import secret_bank_ready
ROOT=Path(__file__).resolve().parents[1];P=ROOT/'projects/grilling/gameplay_core';RP=P/'resource_pack';BP=P/'behavior_pack'
FIX=ROOT/'development/gameplay_core/fixtures/secret-visual-catalog.json'
PIECE_BINDING="q.item_slot_to_bone_name(context.item_slot == 'main_hand' ? 'off_hand' : 'main_hand')"
def owner_occupancy(identifier):
 occupied="c.item_slot == 'off_hand' ? c.owning_entity->q.is_item_name_any('slot.weapon.offhand','"+identifier+"') : c.owning_entity->q.is_item_name_any('slot.weapon.mainhand','"+identifier+"')"
 if identifier!='kaleidoscope_grilling:unfinished_skewer':
  occupied='('+occupied+") && (v.kg_secret_ingredient_0 > 0 || v.kg_secret_ingredient_1 > 0 || v.kg_secret_ingredient_2 > 0)"
 # This hand's bank may still contain a plate/bottle payload while native
 # equipment changes propagate. Retain the existing item/empty/terminal gates.
 return 'v.kg_secret_owner_occupied = ('+occupied+') && '+secret_bank_ready()+';'
def build():
 rows=json.loads(FIX.read_text())['items'];assert len(rows)==213,'Update property encoding/tests for a changed visual catalog'
 textures={'stick':'textures/secret_skewer_stick',**palette_refs(len(rows))}
 geometries=held_geometries();refs={};controllers={};table={}
 for geo in geometries:
  identifier=geo['description']['identifier'];alias=identifier.rsplit('.',1)[1]
  refs['java_secret_piece' if alias=='piece' else alias]=identifier
 for index,row in enumerate(rows,1):textures['food_'+str(index)]=row['texture'];table[row['id']]=index
 for slot in range(3):
  food='v.kg_secret_food_'+str(slot);shape='v.kg_secret_shape_'+str(slot);style='v.kg_secret_style_'+str(slot)
  controllers['controller.render.kg_secret_held.'+str(slot)]={'arrays':{
    'geometries':{'Array.states':['Geometry.state_'+str(i)+'_'+str(slot)if i in COMPLETE_STATES else 'Geometry.part_'+str(slot)+'_0'for i in range(64)]},
    'textures':{'Array.food':['Texture.'+key for key in palette_keys(len(rows))]}},
    'geometry':'Array.states['+food+' == 0 ? 0 : v.kg_secret_state]','materials':[{'*':'Material.default'}],
    'textures':['Array.food['+food+' + '+style+' * '+str(len(rows)+1)+']'],
    'part_visibility':[{'skewer_model':'v.kg_secret_owner_occupied == 1 && v.kg_bite_stage < '+str(3-slot)}]}
 controllers['controller.render.kg_secret_held.stick']={'geometry':'Geometry.stick','materials':[{'*':'Material.default'}],'textures':['Texture.stick'],'part_visibility':[{'skewer_model':'v.kg_secret_owner_occupied == 1'}]}
 # The source helper is a raw-last-item generated sprite. Its socket and the
 # authored THREE child/scale channels are independent of the food cells.
 # One selected mesh, sharing the exact raw-last index with the original texture.
 # Verified alpha outlines are deduplicated; do not draw 213 ingredient passes.
 helper_models=['Geometry.java_secret_piece' if name.endswith('.piece') else 'Geometry.'+name.rsplit('.',1)[1] for name in helper_assets()[1]]
 controllers['controller.render.kg_secret_held.piece']={'arrays':{'geometries':{'Array.pieces':helper_models},'textures':{'Array.food':['Texture.stick']+['Texture.food_'+str(i) for i in range(1,len(rows)+1)]}},'geometry':'Array.pieces[v.kg_secret_piece_index]','materials':[{'*':'Material.default'}],'textures':['Array.food[v.kg_secret_piece_index]'],'part_visibility':[{'dual_piece':'v.kg_secret_piece_visible == 1'}]}
 # Match the ordered vanilla armor pattern: each pass admits only its own
 # mesh bone. Never let the shaft/ingredient passes draw the helper (or vice
 # versa) through default visibility on another geometry's bones.
 for controller in controllers.values():controller['part_visibility'].insert(0,{'*':0})
 attach={'format_version':'1.26.0','minecraft:attachable':{'description':{'identifier':'kaleidoscope_grilling:secret_skewer','materials':{'default':'entity_alphatest_one_sided'},'textures':textures,'geometry':refs,'scripts':{'pre_animation':[],'animate':[{key:"c.is_first_person == "+str(int(key.startswith('fp')))+" && c.item_slot == '"+('main_hand' if key.endswith('right') else 'off_hand')+"'"} for key in ['fp_right','fp_left','tp_right','tp_left']]},'animations':{key:'animation.kg_a287.skewer_'+key for key in ['fp_right','fp_left','tp_right','tp_left']},'render_controllers':['controller.render.kg_secret_held.stick']+['controller.render.kg_secret_held.'+str(slot) for slot in range(3)]}}}
 # Eating aliases/dispatch are added by the one shared motion generator.
 target=RP/'attachables/secret_skewer.attachable.json'
 if target.exists():
  from eating_owner_context import legacy_document
  existing=legacy_document(json.loads(target.read_text()))['minecraft:attachable']['description']
  for key,value in existing.get('animations',{}).items():
   if key.startswith(('eat_','fp_eat_')):attach['minecraft:attachable']['description']['animations'][key]=value
  # Shared motion owns first-person projection guards as well as eat aliases.
  # Preserve those exact routes when this geometry/catalog generator is rerun.
  routes=existing.get('scripts',{}).get('animate',[])
  if any(any(k.startswith('fp_eat_') for k in row) for row in routes):
   attach['minecraft:attachable']['description']['scripts']['animate']=[row for row in routes if all(k in ('fp_right','fp_left','tp_right','tp_left') or k.startswith(('eat_','fp_eat_')) for k in row)]
  else:attach['minecraft:attachable']['description']['scripts']['animate'] += [row for row in routes if any(k.startswith('eat_') for k in row)]
  attach['minecraft:attachable']['description']['scripts']['pre_animation']=[s for s in existing.get('scripts',{}).get('pre_animation',[]) if not s.startswith('v.kg_secret_')]
 scripts=attach['minecraft:attachable']['description']['scripts']
 attach['minecraft:attachable']['description']['render_controllers'].append('controller.render.kg_secret_held.piece')
 scripts['initialize']=['v.kg_secret_off_hand = 0;']
 scripts['pre_animation'].append("v.kg_secret_off_hand = c.item_slot == 'off_hand';")
 for slot in range(3):
  var='v.kg_secret_ingredient_'+str(slot)
  reads=[]
  for hand in ['off','main']:
   name='kaleidoscope_grilling:secret_'+hand+'_'+str(slot)
   reads.append("(c.owning_entity->q.has_property('"+name+"') ? c.owning_entity->q.property('"+name+"') : 0)")
  scripts['initialize'].append(var+' = 0;')
  scripts['pre_animation'].append(var+' = math.floor(math.clamp((v.kg_secret_off_hand ? '+reads[0]+' : '+reads[1]+'), 0, 5333));')
  food='v.kg_secret_food_'+str(slot);shape='v.kg_secret_shape_'+str(slot);style='v.kg_secret_style_'+str(slot)
  scripts['initialize'] += [food+' = 0;',shape+' = 1;',style+' = 0;']
  scripts['pre_animation'] += [food+' = '+var+' - math.floor('+var+'/256)*256;',
    food+' = '+food+' <= '+str(len(rows))+' ? '+food+' : 0;',
    shape+' = math.floor('+var+'/256) - 3*math.floor('+var+'/768) + 1;',
    style+' = math.floor('+var+'/768);']
 scripts['initialize'].append('v.kg_secret_state = 21;')
 scripts['pre_animation'].append('v.kg_secret_state = v.kg_secret_shape_0*16 + v.kg_secret_shape_1*4 + v.kg_secret_shape_2;')
 scripts['initialize'] += ['v.kg_secret_piece_index = 0;','v.kg_secret_owner_occupied = 0;','v.kg_secret_piece_visible = 0;']
 reads=[]
 for hand in ['off','main']:
  name='kaleidoscope_grilling:secret_'+hand+'_piece';reads.append("(c.owning_entity->q.has_property('"+name+"') ? c.owning_entity->q.property('"+name+"') : 0)")
 scripts['pre_animation'].append('v.kg_secret_piece_index = math.floor(math.clamp((v.kg_secret_off_hand ? '+reads[0]+' : '+reads[1]+'), 0, '+str(len(rows))+'));')
 scripts['pre_animation'].append(owner_occupancy('kaleidoscope_grilling:secret_skewer'))
 # Motion owns this derived projection guard; preserve it for direct --check.
 visible=[row for row in existing.get('scripts',{}).get('pre_animation',[]) if row.startswith('v.kg_secret_piece_visible = ')] if target.exists() else []
 scripts['pre_animation'].append(visible[0] if visible else 'v.kg_secret_piece_visible = 0;')
 output={RP/'models/entity/secret_held.geo.json':{'format_version':'1.21.0','minecraft:geometry':geometries},RP/'render_controllers/secret_held.render_controllers.json':{'format_version':'1.8.0','render_controllers':controllers},target:attach,BP/'scripts/secret_visual_catalog.js':'// Generated public visual catalog; helper indices and sampled food palettes share slots.\nexport const SECRET_VISUAL_SLOTS=Object.freeze('+json.dumps(table,separators=(',',':'),sort_keys=True)+');\n'}
 # Partial threading is an idle-only renderer. It shares the exact shaft,
 # palette slots and hand clips, with no eating alias or second-piece helper.
 partial=copy.deepcopy(attach);d=partial['minecraft:attachable']['description'];d['identifier']='kaleidoscope_grilling:unfinished_skewer'
 d['geometry']={k:v for k,v in d['geometry'].items()if k=='stick'or k.startswith('part_')}
 new_geometries=partial_geometries();geometries.extend(new_geometries)
 d['geometry'].update({g['description']['identifier'].rsplit('.',1)[1]:g['description']['identifier']for g in new_geometries})
 d['textures']={key:value for key,value in d['textures'].items()if not key.startswith('food_')or '_s'in key}
 d['animations']={key:'animation.kg_a287.skewer_'+key for key in ['fp_right','fp_left','tp_right','tp_left']}
 d['scripts']['animate']=[{key:"c.is_first_person == "+str(int(key.startswith('fp')))+" && c.item_slot == '"+('main_hand'if key.endswith('right')else 'off_hand')+"'"}for key in ['fp_right','fp_left','tp_right','tp_left']]
 excludes=('v.kg_secret_piece_','v.kg_secret_owner_occupied = ','v.kg_secret_state = ')
 d['scripts']['initialize']=[row for row in scripts['initialize']if not row.startswith(excludes)]+['v.kg_secret_owner_occupied = 0;','v.kg_secret_partial_count = 0;','v.kg_secret_partial_state = 0;','v.kg_bite_stage = 0;']
 d['scripts']['pre_animation']=[row for row in scripts['pre_animation']if row.startswith('v.kg_secret_')and not row.startswith(excludes)]
 d['scripts']['pre_animation'] += ['v.kg_secret_partial_count = math.max(v.kg_secret_style_0,v.kg_secret_style_1);',
  'v.kg_secret_partial_state = v.kg_secret_partial_count > 0 ? v.kg_secret_shape_0*16 + (v.kg_secret_partial_count > 1 ? v.kg_secret_shape_1*4 : 0) : 0;',
  owner_occupancy(d['identifier']),'v.kg_bite_stage = 0;']
 d['render_controllers']=['controller.render.kg_secret_held.stick']+['controller.render.kg_partial_held.'+str(slot)for slot in range(2)]
 for slot in range(2):
  models=[]
  for state in range(64):
   exists=state in PARTIAL_STATES and (slot==0 or state not in (16,32,48))
   models.append('Geometry.partial_state_'+str(state)+'_'+str(slot)if exists else 'Geometry.part_'+str(slot)+'_0')
  controllers['controller.render.kg_partial_held.'+str(slot)]={'arrays':{
   'geometries':{'Array.states':models},'textures':{'Array.food':['Texture.food_'+str(i)+'_s0'for i in range(len(rows)+1)]}},
   'geometry':'Array.states[v.kg_secret_food_'+str(slot)+' == 0 ? 0 : v.kg_secret_partial_state]',
   'materials':[{'*':'Material.default'}],'textures':['Array.food[v.kg_secret_food_'+str(slot)+']'],
   'part_visibility':[{'*':0},{'skewer_model':'v.kg_secret_owner_occupied == 1'}]}
 output[RP/'attachables/unfinished_skewer.attachable.json']=partial
 # Keep the existing ALT attachable's geometry/catalog/owner decoding coherent
 # before shared motion eligibility is recomputed. Its own authored routes and
 # absent THREE helper remain unchanged; this avoids a stale one-pass generator.
 alt_target=RP/'attachables/secret_skewer_java_three_alt.attachable.json'
 if alt_target.exists():
  from eating_owner_context import legacy_document
  alt=legacy_document(json.loads(alt_target.read_text()));ad=alt['minecraft:attachable']['description'];ad['geometry']=copy.deepcopy(attach['minecraft:attachable']['description']['geometry']);ad['textures']=copy.deepcopy(textures)
  ad['render_controllers']=copy.deepcopy(attach['minecraft:attachable']['description']['render_controllers']);ad['scripts']['initialize']=copy.deepcopy(scripts['initialize'])
  ad['scripts']['pre_animation']=[r for r in ad['scripts']['pre_animation']if not r.startswith('v.kg_secret_')]+[r for r in scripts['pre_animation']if r.startswith('v.kg_secret_')and not r.startswith(('v.kg_secret_owner_occupied = ','v.kg_secret_piece_visible = '))]+[owner_occupancy(ad['identifier']),'v.kg_secret_piece_visible = 0;']
  output[alt_target]=alt
 # Keep the existing meal-state file readable and the derived sprite outlines
 # compact: one geometry per line, loaded once, one selected mesh per frame.
 helper_variants=[geo for geo in geometries if geo['description']['identifier'].startswith('geometry.kg_secret_held.piece_')]
 geometries[:]=[geo for geo in geometries if geo not in helper_variants]
 output[RP/'models/entity/secret_helper_sprites.geo.json']='{"format_version":"1.21.0","minecraft:geometry":[\n'+',\n'.join(json.dumps(geo,separators=(',',':'))for geo in helper_variants)+'\n]}\n'
 output.update(build_palettes())
 from eating_owner_context import augment as current_context
 return current_context(augment_terminal(augment_idle(output)))

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args()
 output=build()
 if tuple(json.loads((BP/'manifest.json').read_text())['header']['version']) >= (2,8,147):
  from eating_owner_properties import augment as guard_owner_properties
  output=guard_owner_properties(output)
 for path,value in output.items():
  data=value if isinstance(value,(str,bytes)) else json.dumps(value,ensure_ascii=False,indent=2)+'\n'
  data=data.encode() if isinstance(data,str) else data
  if args.check:assert path.read_bytes()==data,path
  else:path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
 print('Pinned27 complete +12 partial state meshes, shared palettes and original raw helper generated; client rendering acceptance separate')
if __name__=='__main__':main()
