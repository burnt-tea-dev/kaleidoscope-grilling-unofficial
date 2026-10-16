"""Mutation tests ensure broken dispatch and hierarchy fail static inspection."""
import copy
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('render_audit',ROOT/'tools/audit_grilling_render.py')
audit=importlib.util.module_from_spec(spec);spec.loader.exec_module(audit)
class HeldRenderContracts(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.geometries=audit.collect_geometries([]);cls.animations=audit.collect_animations()
 def check(self,change=None,geometry_change=None):
  loader=audit.load_json
  def modified(path):
   doc=loader(path)
   if path.name=='raw_beef_skewer.attachable.json' and change:change(doc['minecraft:attachable']['description'])
   return doc
  geometry=copy.deepcopy(self.geometries)
  if geometry_change:geometry_change(geometry[next(iter(loader(audit.RP/'attachables/raw_beef_skewer.attachable.json')['minecraft:attachable']['description']['geometry'].values()))]['geo'])
  findings=[]
  with patch.object(audit,'load_json',modified):audit.check_current_display_contracts(findings,geometry,self.animations)
  return {row['code'] for row in findings}
 def test_current(self):self.assertEqual(self.check(),set())
 def test_wrong_alias_mapping(self):self.assertIn('held_pose_selectors',self.check(lambda d:d['animations'].update(fp_right=d['animations']['fp_left'])))
 def test_missing_dispatch(self):self.assertIn('held_pose_selectors',self.check(lambda d:d['scripts'].pop('animate')))
 def test_wrong_view(self):self.assertIn('held_pose_selectors',self.check(lambda d:d['scripts']['animate'][3].update(tp_left="c.is_first_person == 1 && c.item_slot == 'off_hand'")))
 def test_duplicate_dispatch(self):self.assertIn('held_pose_selectors',self.check(lambda d:d['scripts']['animate'].append(d['scripts']['animate'][0])))
 def test_wrong_parent(self):self.assertIn('held_hierarchy_contract',self.check(geometry_change=lambda g:g['bones'][2].update(parent='grip')))
 def test_missing_animation_bone(self):self.assertIn('held_animation_missing_bone',self.check(geometry_change=lambda g:g['bones'][2].update(name='wrong_model')))
 def test_wrong_pivot(self):self.assertIn('held_hierarchy_contract',self.check(geometry_change=lambda g:g['bones'][1].update(pivot=[0,0,0])))
 def test_active_pose_requires_eligibility(self):
  def mutate(d):
   for row in d['scripts']['animate']:
    if 'fp_eat_right' in row:
     before=row['fp_eat_right']
     eligibility="v.kg_owner_eat_projection == 1" if 'v.kg_owner_eat_projection' in before else "c.owning_entity->q.property('kaleidoscope_grilling:eat_projection') == 1"
     row['fp_eat_right']=before.replace(eligibility,'1')
     self.assertNotEqual(row['fp_eat_right'],before,'eligibility mutation must change the actual current selector')
  if any('fp_eat_right' in row for row in audit.load_json(audit.RP/'attachables/raw_beef_skewer.attachable.json')['minecraft:attachable']['description']['scripts']['animate']):
   self.assertIn('held_pose_selectors',self.check(mutate))
 def test_active_and_idle_cannot_layer(self):
  def mutate(d):
   for row in d['scripts']['animate']:
    if 'fp_right' in row:row['fp_right']="c.is_first_person == 1 && c.item_slot == 'main_hand'"
  if 'fp_eat_right' in audit.load_json(audit.RP/'attachables/raw_beef_skewer.attachable.json')['minecraft:attachable']['description']['animations']:
   self.assertIn('held_pose_selectors',self.check(mutate))
class ItemVisualContracts(unittest.TestCase):
 def check(self,change=None):
  loader=audit.load_json
  def modified(path):
   doc=loader(path)
   if path.name=='grill.json' and change:change(doc['minecraft:block']['components']['minecraft:item_visual'])
   return doc
  findings=[]
  with patch.object(audit,'load_json',modified):
   stats=audit.check_item_visuals(findings,audit.collect_geometries([]))
  return {row['code'] for row in findings},stats
 def test_current(self):
  expected={'kaleidoscope_grilling:'+name for name in ('big_vat','oil_press','grill')}
  native={'kaleidoscope_grilling:item_visual_'+name for name in ('grilled_slime_skewer','mysterious_skewer')}
  actual={doc['minecraft:block']['description']['identifier'] for path in (audit.BP/'blocks').glob('*.json')
          if (doc:=audit.load_json(path))['minecraft:block']['components'].get('minecraft:item_visual')}
  if actual & native:
   from native_skewer_icons import check_or_write
   check_or_write(ROOT)
   expected|=native
  self.assertEqual(actual,expected)
  self.assertEqual(self.check(),(set(),{'item_visuals':len(expected)}))
 def test_missing_geometry(self):self.assertIn('missing_item_visual_geometry',self.check(lambda v:v.update(geometry='geometry.missing'))[0])
 def test_missing_material(self):self.assertIn('missing_item_visual_material',self.check(lambda v:v.update(material_instances={}))[0])
 def test_missing_texture(self):self.assertIn('missing_item_visual_texture',self.check(lambda v:v['material_instances']['*'].update(texture='missing'))[0])
class PlateSpecialContracts(unittest.TestCase):
 """Actual plate selection/geometry against independent pinned uneaten inputs."""
 @classmethod
 def setUpClass(cls):
  import json,re
  cls.json=json
  cls.held=audit.load_json(audit.RP/'attachables/skewer_plate.attachable.json')['minecraft:attachable']['description']
  cls.world=audit.load_json(audit.RP/'entity/plate_food_visual.entity.json')['minecraft:client_entity']['description']
  cls.geos={g['description']['identifier']:g for p in ['plate_held','plate_special','failure_skewer_held','grill_display'] for g in audit.load_json(audit.RP/f'models/entity/{p}.geo.json')['minecraft:geometry']}
  cls.controllers=audit.load_json(audit.RP/'render_controllers/plate_held.render_controllers.json')['render_controllers']
  text=(audit.BP/'scripts/plate_special_visual_data.js').read_text()
  cls.mapping=json.loads(re.search(r'PLATE_FAILURE_MODELS=Object.freeze\((.*)\);',text).group(1))
 def source_cubes(self,geo):return [c for b in geo['bones'] for c in b.get('cubes',[])]
 def assert_model(self,ordinal,name,source,texture):
  expected=self.source_cubes(source)
  for row in range(5):
   controller=self.controllers[f'controller.render.kg_plate_held.fixed_{row}']
   alias=controller['arrays']['geometries']['Array.models'][40+ordinal].split('.',1)[1]
   actual=self.geos[self.held['geometry'][alias]]
   self.assertEqual(self.source_cubes(actual),expected)
   self.assertEqual(actual['bones'][-1]['parent'],f'plate_fixed_{row}')
   tex=controller['arrays']['textures']['Array.items'][40+ordinal].split('.',1)[1]
   self.assertEqual(self.held['textures'][tex],texture)
  actual=self.geos[self.world['geometry']['s'+str(115+ordinal)]]
  cubes=copy.deepcopy(self.source_cubes(actual))
  for cube in cubes:
   cube['origin'][1]+=25
   if 'pivot' in cube:cube['pivot'][1]+=25
  # Float addition may differ at the last bit after the inverse basis shift.
  for original,recovered in zip(expected,cubes,strict=True):
   for key in ('origin','pivot'):
    if key in original:
     for a,b in zip(original[key],recovered[key]):self.assertAlmostEqual(a,b,places=12)
     recovered[key]=original[key]
   self.assertEqual(original,recovered)
  self.assertEqual(self.world['textures']['s'+str(115+ordinal)],texture)
 def test_every_failure_source_state_has_exact_model_geometry_texture_and_order(self):
  fixture=ROOT/'development/gameplay_core/fixtures/java-failure-skewer-9a1acdab/common/src/main/resources/assets/kaleidoscope_grilling/models/item'
  for name in ('mysterious_skewer','dark_grilling'):
   root=audit.load_json(fixture/(name+'.json'));tables=self.mapping['kaleidoscope_grilling:'+name]
   desc=audit.load_json(audit.RP/f'attachables/{name}.attachable.json')['minecraft:attachable']['description']
   checked=set()
   for source in range(20):
    for state in range(64):
     values={'kaleidoscope_grilling:failed_skewer_source':source/32,'kaleidoscope_grilling:skewer_state':state/64,'kaleidoscope_grilling:skewer_bite_stage':0}
     selected=0
     for i,entry in enumerate(root['overrides'],1):
      if all(values.get(k,float('-inf'))>=v for k,v in entry['predicate'].items()):selected=i
     ordinal=tables['sources'][source] if source else tables['states'][state]
     expected_name=f'{name}_{selected}'
     self.assertEqual(ordinal,(5 if name=='mysterious_skewer' else 61)+selected)
     if selected in checked:continue
     checked.add(selected);alias='model_'+str(selected)
     self.assert_model(ordinal,expected_name,self.geos[desc['geometry'][alias]],desc['textures'][alias])
   self.assertEqual(len(checked),56)
 def test_all_five_slime_frames_are_shared_uneaten_models_not_eating_frames(self):
  for frame in range(5):
   source=audit.load_json(audit.RP/f'models/entity/slime_frames/stage0_frame{frame}.geo.json')['minecraft:geometry'][0]
   self.assert_model(frame,f'slime_{frame}',source,'textures/slime_frames/slime_frame_0')
  self.assertEqual(len(self.controllers),26)
  for row in range(5):self.assertEqual(len(self.controllers[f'controller.render.kg_plate_held.fixed_{row}']['arrays']['geometries']['Array.models']),157)
 def test_wrong_failure_model_or_slime_cell_is_detected(self):
  geo=self.geos[self.world['geometry']['s115']]
  with patch.dict(geo,{'bones':copy.deepcopy(geo['bones'])}):
   geo['bones'][1]['cubes'][0]['origin'][0]+=1
   with self.assertRaises(AssertionError):self.test_all_five_slime_frames_are_shared_uneaten_models_not_eating_frames()
  table=self.mapping['kaleidoscope_grilling:mysterious_skewer']
  with patch.dict(table,{'sources':table['sources'][:]}):
   table['sources'][1]=table['sources'][2]
   with self.assertRaises(AssertionError):self.test_every_failure_source_state_has_exact_model_geometry_texture_and_order()

if __name__=='__main__':unittest.main()
