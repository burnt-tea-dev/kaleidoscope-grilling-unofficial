"""Current runtime gate. Historical byte/pose locks are superseded by A283.
Retains the previous gameplay/transaction/data regressions. No client QA claim.
"""
from pathlib import Path
from copy import deepcopy
import argparse, json, subprocess, sys
from PIL import Image
import a283_render_repair as repair
from verify_current import generic_gate, verify_compiled_exact

ROOT=repair.ROOT; BP=repair.BP; RP=repair.RP; DEV=Path(__file__).parent
def run(*cmd): subprocess.run(cmd,cwd=ROOT,check=True)
def load(p):return repair.load(p)

def assets():
 if tuple(load(BP/"manifest.json")["header"]["version"]) >= (2,8,6):
  from verify_a286 import render_assets
  return render_assets()
 index={g['description']['identifier']:g for p in (RP/'models').rglob('*.geo.json') for g in load(p)['minecraft:geometry']}
 refs=set();attachables=list((RP/'attachables').glob('*.json'))
 assert len(attachables)==107
 for p in attachables:
  d=load(p)['minecraft:attachable']['description']
  assert len(d['scripts']['animate'])==4,p
  for ref in d['geometry'].values():
   refs.add(ref);assert ref.startswith('geometry.kg_a283.'),p
   g=index[ref];old_id='geometry.'+ref.removeprefix('geometry.kg_a283.')
   expected=deepcopy(index[old_id]);repair.deduplicate(expected);expected=repair.shifted(expected)
   assert g==expected,ref
   root=next(b for b in g['bones'] if b.get('binding'))
   assert root['pivot']==[0,24,0] and root['binding']=='q.item_slot_to_bone_name(context.item_slot)'
   assert not repair.deduplicate(deepcopy(g)),ref
  if p.name.endswith('_skewer.attachable.json') or p.stem=='advanced_rack.attachable':
   assert d['materials']['default']=='entity_alphatest_one_sided'
 assert len(refs)==194
 atlas=load(RP/'textures/item_texture.json')['texture_data']
 for key,row in atlas.items():
  paths=row['textures'];paths=[paths] if isinstance(paths,str) else paths
  for path in paths:
   im=Image.open(RP/(path+'.png'));assert im.width==im.height,(key,im.size)
 assert Image.open(RP/'textures/items/advanced_rack.png').convert('RGBA').tobytes()==Image.open(DEV/'fixtures/a283/advanced_rack.png').convert('RGBA').tobytes()
 for name in ('advanced_rack','skewer_plate','special_seasoning','empty_seasoning_bottle','pending_seasoning'):
  item=Image.open(RP/(atlas[name]['textures']+'.png')).convert('RGBA')
  assert item.getchannel('A').getextrema()==(0,255),name
 assert not (RP/'attachables/big_vat.attachable.json').exists()
 for name in repair.STATIONS:
  d=load(BP/f'blocks/{name}.json')['minecraft:block']
  assert d['components']['minecraft:material_instances']['*']['render_method'] in ('alpha_test_single_sided','blend'),name
 for name in ('grill','oil_press'):
  g=load(RP/f'models/blocks/a283_item_{name}.geo.json')['minecraft:geometry'][0]
  assert g['item_display_transforms']==load(DEV/f'fixtures/a283/{name}.json')['display']
  assert not any(b.get('binding') for b in g['bones'])
 for n in range(1,5):
  g=load(RP/f'models/blocks/big_vat_{n}.geo.json')['minecraft:geometry'][0]
  assert all(set(c['uv'])=={'up'} for b in g['bones'] if b['name']=='fluid_surface' for c in b['cubes'])
 return {'items':len(list((BP/'items').glob('*.json'))),'item_atlas_entries':len(atlas),'attachables':len(attachables),'hand_geometries':len(refs)}

def feedback():
 hud=(BP/'scripts/a2739_crosshair_hud_runtime.js').read_text()
 assert 'runInterval' not in hud and 'setActionBar' not in hud
 owners=[p.name for p in (BP/'scripts').rglob('*.js') if 'setActionBar' in p.read_text()]
 version=tuple(load(BP/'manifest.json')['header']['version'])
 expected=['a283_interaction_feedback.js','graphical_actionbar_transport_core.js'] if version >= (2,8,137) else ['a283_interaction_feedback.js'] if version >= (2,8,130) else (['a283_interaction_feedback.js','java_eating_hud_runtime.js'] if (BP/'scripts/java_eating_hud_runtime.js').exists() else ['a283_interaction_feedback.js'])
 assert sorted(owners)==expected,owners
 if version >= (2,8,130):
  assert 'sendFormattingHud' in (BP/'scripts/java_eating_hud_runtime.js').read_text()
  assert 'setActionBar' not in (BP/'scripts/formatting_hud_runtime.js').read_text()
 main=(BP/'scripts/main.js').read_text()
 assert 'world.beforeEvents.playerPlaceBlock' not in main
 assert "registerCustomComponent('senluo:grilling_bottle_place'" in main
 if tuple(load(BP/'manifest.json')['header']['version']) >= (2,8,71):
  assert "import {readNativeBottles,isNativeBottleItem} from './seasoning_native_storage.js';" in main
  assert 'if(isNativeBottleItem(held)){pushBottle(block,player,held,hand);return}' in main
  assert 'const isBottle=isNativeBottleItem;' in main
  native=(BP/'scripts/seasoning_native_storage.js').read_text()
  assert 'export const isNativeBottleItem=stack=>!!stack&&(isEmptySeasoningId(stack.typeId)||isPendingSeasoningId(stack.typeId)||isSpecialSeasoningId(stack.typeId));' in native
 else:
  assert 'isSpecialSeasoningId(held.typeId)' in main
 for p in (BP/'blocks').glob('seasoning_bottle*.json'):
  assert 'senluo:grilling_bottle_place' in load(p)['minecraft:block']['components']

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--compiled',action='store_true');args=parser.parse_args()
 version=generic_gate()[:3]
 assert version in ((2,8,3),(2,8,4),(2,8,5),(2,8,6),(2,8,7),(2,8,8),(2,8,10),(2,8,11),(2,8,12))
 result=assets();feedback()
 run(sys.executable,str(DEV/'test_a283_geometry.py'))
 run('node',str(DEV/'test_a283_feedback.mjs'))
 for script in ('test_a275_core.mjs','test_a276_core.mjs','test_a277_core.mjs','test_a2762_core.mjs','test_a2769_core.mjs','test_a2770_core.mjs','test_a280_integrated.mjs'):
  run('node',str(DEV/script))
 run(sys.executable,str(DEV/'test_vibrant_gate.py'))
 run(sys.executable,str(DEV/'test_a2771_catalog.py'))
 run(sys.executable,str(ROOT/'tools/check_grilling_guide.py'))
 for p in (BP/'scripts').rglob('*.js'):run('node','--check',str(p))
 if args.compiled:verify_compiled_exact()
 print(json.dumps({'version':'A'+'.'.join(map(str,version)),'assets':result,'static_checks':'PASS','client_visuals_tested':False},indent=2))
if __name__=='__main__':main()
