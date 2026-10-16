"""Mutation guards for exact threaded G68+ audit contracts; static evidence only."""
from copy import deepcopy
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('render_audit',ROOT/'tools/audit_grilling_render.py');audit=importlib.util.module_from_spec(spec);spec.loader.exec_module(audit)
class ThreadedAuditContracts(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.geometries=audit.collect_geometries([]);cls.animations=audit.collect_animations()
 def check(self,change=None,geometry=None,animation=None,version=None,food=False,bottle=None,attachables=None):
  loader=audit.load_json
  def modified(path):
   d=loader(path)
   if path.name=='secret_skewer.attachable.json' and change:change(d['minecraft:attachable']['description'])
   if path.name=='pending_seasoning_f8.attachable.json' and bottle:bottle(d['minecraft:attachable']['description'])
   if attachables and path.name in attachables:attachables[path.name](d['minecraft:attachable']['description'])
   if path.name=='manifest.json' and path.parent==audit.BP and version:d['header']['version']=version
   if path.name=='unfinished_skewer.json' and food:d['minecraft:item']['components']['minecraft:food']={'nutrition':1,'saturation_modifier':.1}
   return d
  geos=deepcopy(self.geometries);anims=deepcopy(self.animations)
  if geometry:geometry(geos)
  if animation:animation(anims)
  findings=[]
  with patch.object(audit,'load_json',modified):audit.check_current_display_contracts(findings,geos,anims)
  return {r['code']for r in findings if r['severity']=='error'}
 def test_current(self):self.assertEqual(self.check(),set())
 def test_unknown_fill_id_cannot_replace_an_expected_proxy_at_same_count(self):
  self.assertIn('held_inventory_contract',self.check(bottle=lambda d:d.update(identifier='kaleidoscope_grilling:pending_seasoning_f9')))
 def test_wrong_helper_hand(self):
  def mutate(geos):geos['geometry.kg_secret_held.piece_1']['geo']['bones'][0]['binding']='q.item_slot_to_bone_name(context.item_slot)'
  self.assertIn('held_binding_contract',self.check(geometry=mutate))
 def test_missing_idle_calibration(self):
  self.assertIn('held_pose_selectors',self.check(change=lambda d:d['animations'].pop('fp_idle_calibrated_right')))
 def test_wrong_idle_hand_selector(self):
  def mutate(d):
   for row in d['scripts']['animate']:
    if 'fp_idle_calibrated_right' in row:row['fp_idle_calibrated_right']=row['fp_idle_calibrated_right'].replace("c.item_slot == 'main_hand'","c.item_slot == 'off_hand'")
  self.assertIn('held_pose_selectors',self.check(change=mutate))
 def test_drifted_calibration_clip(self):
  def mutate(anims):anims['animation.kg_secret_held.fp_idle_calibrated_1_26_52_3_right']['body']['bones']['skewer_pose']['position'][0]+=1
  self.assertIn('held_pose_frame_drift',self.check(animation=mutate))
 def test_nonsecret_helper_owner(self):
  self.assertIn('held_binding_contract',self.check(change=lambda d:d.update(identifier='kaleidoscope_grilling:raw_beef_skewer')))
 def test_unfinished_cannot_become_food(self):self.assertIn('held_partial_contract',self.check(food=True))
 def test_historical_versions_do_not_inherit_new_exemptions(self):self.assertIn('held_pose_selectors',self.check(version=[2,8,67]))
 def test_offhand_projection_requires_exact_profile_alias(self):
  for name in ('grilled_caterpillar_skewer','raw_gluten_skewer'):
   with self.subTest(item=name):
    self.assertIn('held_pose_selectors',self.check(attachables={name+'.attachable.json':lambda d:d['animations'].update(offhand_projection_left='animation.kg_java_eating.item.one.right')}))
 def test_offhand_projection_retains_owner_context(self):
  def mutate(d):
   for row in d['scripts']['animate']:
    if 'offhand_projection_left' in row:row['offhand_projection_left']=row['offhand_projection_left'].replace('c.owning_entity->q.','q.')
  self.assertIn('held_pose_selectors',self.check(attachables={'raw_gluten_skewer.attachable.json':mutate}))
 def test_offhand_projection_requires_both_left_fallback_guards(self):
  for alias in ('fp_left','eat_left'):
   def mutate(d):
    for row in d['scripts']['animate']:
     if alias in row:row[alias]=row[alias].rsplit(') && (',1)[0][1:]
   with self.subTest(alias=alias):
    self.assertIn('held_pose_selectors',self.check(attachables={'grilled_caterpillar_skewer.attachable.json':mutate}))
 def test_offhand_route_cannot_claim_an_unowned_item(self):
  self.assertIn('held_pose_selectors',self.check(attachables={'grilled_caterpillar_skewer.attachable.json':lambda d:d.update(identifier='kaleidoscope_grilling:grilled_beef_skewer')}))
 def test_offhand_helper_requires_exact_owner_reference(self):
  for name in ('grilled_caterpillar_skewer','raw_gluten_skewer'):
   for replacement in (None,'geometry.kg_java_dual.piece.grilled_fish_skewer'):
    def mutate(d):
     if replacement is None:d['geometry'].pop('java_piece')
     else:d['geometry']['java_piece']=replacement
    with self.subTest(item=name,replacement=replacement):
     self.assertIn('held_binding_contract',self.check(attachables={name+'.attachable.json':mutate}))
 def test_offhand_helper_binding_and_bone_union_still_checked(self):
  def wrong_binding(geos):geos['geometry.kg_java_dual.piece.grilled_caterpillar_skewer']['geo']['bones'][0]['binding']="q.item_slot_to_bone_name('off_hand')"
  self.assertIn('held_binding_contract',self.check(geometry=wrong_binding))
  def missing_bones(geos):
   for ref in ('geometry.kg_java_dual.piece.grilled_caterpillar_skewer','geometry.kg_probe_caterpillar.piece'):
    geos[ref]['geo']['bones']=[b for b in geos[ref]['geo']['bones'] if b['name']!='dual_piece']
  self.assertTrue({'held_hierarchy_contract','held_animation_missing_bone'}<=self.check(geometry=missing_bones))
 def test_pre_g145_does_not_admit_offhand_layer(self):self.assertIn('held_pose_selectors',self.check(version=[2,8,144]))
if __name__=='__main__':unittest.main()
