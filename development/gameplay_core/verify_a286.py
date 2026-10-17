"""Geometry invariants are regression evidence, not client visual certification."""
import json
from pathlib import Path
from copy import deepcopy
from PIL import Image
import a283_render_repair as old
import a286_render_repair as repair
from verify_a285 import survival_gate
from verify_a284 import eating_gate
from verify_a283 import main as previous_gate
RP=repair.RP;BP=old.BP
def load(p):return json.loads(p.read_text())
def index():return {g['description']['identifier']:g for p in (RP/'models').rglob('*.geo.json') for g in load(p)['minecraft:geometry']}
def bottle_chain():
 idx=index();ids=[];fill=[]
 if tuple(load(BP/'manifest.json')['header']['version']) >= (2,8,61):
  from test_bottle_visual_assets import BottleVisualAssets
  checks=BottleVisualAssets()
  checks.test_held_layers_share_shell_socket_without_changing_native_id()
  checks.test_placed_bounds_and_opaque_palette_match_source()
  checks.test_generator_is_reproducible_and_player_budget_fits()
  special=load(RP/'attachables/special_seasoning.attachable.json')['minecraft:attachable']['description']
  assert special['textures']=={'default':'textures/held/bottle_shell_palette'}
  assert special['geometry']=={'default':'geometry.kg_bottle_held.fixed.r8.v0'}
  assert len(special['render_controllers'])==1
  bones=idx[special['geometry']['default']]['bones']
  assert len(bones)==3 and not bones[0].get('cubes')
  assert {b['name'] for b in bones[1:]}=={'shell','contents'}
  assert all(b.get('cubes') and b['parent']=='grip' and b['pivot']==[0,24,0] and 'binding' not in b for b in bones[1:])
  return
 for name in ('empty_seasoning_bottle','pending_seasoning','special_seasoning'):
  d=load(RP/f'attachables/{name}.attachable.json')['minecraft:attachable']['description'];ref=d['geometry']['default'];ids.append(ref)
  g=idx[ref];assert len(g['bones'])==1
  cubes=idx[d['geometry']['contents']]['bones'][0]['cubes'] if 'contents' in d['geometry'] else [];fill.append(cubes)
  if cubes:assert d['render_controllers'][0]=='controller.render.kg_a286.contents' and d['materials']['contents']=='entity_alphatest_one_sided'
  assert d['textures']=={'default':'textures/blocks/seasoning_bottle'}
 assert len(set(ids))==3 and not fill[0] and fill[1] and fill[2]
 assert fill[1][0]['size'][1] < fill[2][0]['size'][1]
def render_assets():
 if tuple(load(BP/'manifest.json')['header']['version']) >= (2,8,7):
  from verify_a287 import binding_assets
  idx,refs,audit=binding_assets();changed=audit['attachables']
 else:
  idx=index();refs=set();changed=0
  for p in (RP/'attachables').glob('*.json'):
   d=load(p)['minecraft:attachable']['description'];assert len(d['scripts']['animate'])==4
   if any(ref.startswith('geometry.kg_a286.') for ref in d['geometry'].values()):changed+=1
   for ref in d['geometry'].values():
    refs.add(ref);g=idx[ref]
    if ref.startswith('geometry.kg_a286.'):
     assert len(g['bones'])==1
     b=g['bones'][0];assert b['name']=='grip' and b['pivot']==[0,24,0] and b['binding']=='q.item_slot_to_bone_name(context.item_slot)'
     assert b.get('cubes') and 'parent' not in b
     for anim in d['animations'].values():assert anim.startswith('animation.kg_a286.')
    else:
     assert ref.startswith('geometry.kg_a283.')
     expected=deepcopy(idx['geometry.'+ref.removeprefix('geometry.kg_a283.')]);old.deduplicate(expected);assert g==old.shifted(expected)
  assert changed==68,changed
 bottle_chain()
 # Tests of the physical opening independent of generator byte output.
 for name in ['grill_flat','grill_flat_lit','grill_legged','grill_legged_lit','a283_item_grill']+[f'big_vat_{i}' for i in range(5)]:
  g=load(RP/f'models/blocks/{name}.geo.json')['minecraft:geometry'][0]
  vat=name.startswith('big_vat');face='down' if vat else 'up';hx,hz=(6,6) if vat else (7,5)
  bones={b['name']:b for b in g['bones']}
  rim=[c for c in bones['instance_0_element_0_0']['cubes'] if face in c['uv']]
  assert len(rim)==4
  assert sum(c['size'][0]*c['size'][2] for c in rim)==(256-144 if vat else 192-140)
  for c in rim:
   x,y,z=c['origin'];sx,sy,sz=c['size'];assert not(x<hx and x+sx>-hx and z<hz and z+sz>-hz)
  for b in g['bones']:
   for c in b.get('cubes',[]):
    if 'inward_east' in b['name']:assert set(c['uv'])=={'east'} and c['origin'][0]>0
    if 'inward_west' in b['name']:assert set(c['uv'])=={'west'} and c['origin'][0]<0
  if not vat:
   assert not bones['instance_0_source_1_inward_down_6']['cubes']
   for c in bones['instance_0_element_7_7']['cubes']:assert c['origin']==[-7,3.98438,-5] and c['size']==[14,0,10]
  elif 'fluid_surface' in bones:
   for c in bones['fluid_surface']['cubes']:assert set(c['uv'])=={'up'} and c['origin'][1]>2 and c['origin'][1]+c['size'][1]<16
 block=load(BP/'blocks/big_vat.json')['minecraft:block']
 assert block['components']['minecraft:material_instances']['*']['render_method']=='alpha_test_single_sided'
 for p in block['permutations']:
  mats=p['components'].get('minecraft:material_instances',{})
  expected='blend' if "== 'water'" in p['condition'] else 'alpha_test_single_sided'
  assert all(m['render_method']==expected for m in mats.values())
 atlas=load(RP/'textures/item_texture.json')['texture_data']
 for key,row in atlas.items():
  paths=row['textures'];paths=[paths] if isinstance(paths,str) else paths
  for path in paths:
   im=Image.open(RP/(path+'.png'));assert im.width==im.height,(key,im.size)
 version=tuple(load(BP/'manifest.json')['header']['version'])
 expected_count=125 if version>=(2,8,119) else 124 if version>=(2,8,71) else 108 if version>=(2,8,68) else 107 if (RP/'attachables/secret_skewer.attachable.json').exists() else 106 if version >= (2,8,32) else 107
 expected_count+=int((RP/'attachables/secret_skewer_native_plain.attachable.json').is_file())
 from verify_failure_skewer import admit_attachable
 assert len([p for p in (RP/'attachables').glob('*.json') if not p.stem.endswith('_java_three_alt.attachable') and not admit_attachable(p)])==expected_count
 assert not (RP/'attachables/big_vat.attachable.json').exists()
 for name in ('grill','oil_press'):
  g=load(RP/f'models/blocks/a283_item_{name}.geo.json')['minecraft:geometry'][0]
  assert g['item_display_transforms']==load(Path(__file__).parent/f'fixtures/a283/{name}.json')['display']
 return {'attachables':expected_count,'single_bone_attachables':changed,'hand_geometries':len(refs),'openings_checked':10,'client_visuals_tested':False}
if __name__=='__main__':
 eating_gate();survival_gate();previous_gate()
