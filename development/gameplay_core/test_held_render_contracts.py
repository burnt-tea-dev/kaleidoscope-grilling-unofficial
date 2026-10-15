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
    if 'fp_eat_right' in row:row['fp_eat_right']=row['fp_eat_right'].replace("c.owning_entity->q.property('kaleidoscope_grilling:eat_projection') == 1",'1')
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
 def test_current(self):self.assertEqual(self.check(),(set(),{'item_visuals':3}))
 def test_missing_geometry(self):self.assertIn('missing_item_visual_geometry',self.check(lambda v:v.update(geometry='geometry.missing'))[0])
 def test_missing_material(self):self.assertIn('missing_item_visual_material',self.check(lambda v:v.update(material_instances={}))[0])
 def test_missing_texture(self):self.assertIn('missing_item_visual_texture',self.check(lambda v:v['material_instances']['*'].update(texture='missing'))[0])
if __name__=='__main__':unittest.main()
