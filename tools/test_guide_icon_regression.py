"""Reject atlas-as-icon regressions from the user's 2026-10-01 screenshots."""
import copy,unittest
from check_grilling_guide import check_hidden_bottle_fill,GAME,NS
from build_grilling_guide import LOCALES,SOURCE,build_payload,load,validate_source
class GuideIconRegression(unittest.TestCase):
 def test_payload_names_cover_every_entry(self):
  d=load(SOURCE);validate_source(d);payload=build_payload(d)
  for entry in d['entries']:
   for locale in LOCALES:
    expected=d['names'][locale].get(entry['id'],entry['title'][locale])
    self.assertEqual(payload['names'][locale].get(entry['id']),expected,entry['id']+' '+locale)
  self.assertEqual(payload['names']['zh_TW']['kg_a1:guide_millstone'],'石磨與磨粉')
 def test_correct_icons(self):
  d=load(SOURCE);validate_source(d);self.assertEqual(d['icon'],'textures/ui/kg_grilling/grill_legged_lit')
  roots={c['id']:c for c in d['categories']};self.assertEqual(roots['workstations']['icon'],d['icon']);self.assertEqual(roots['tools_gear']['icon'],'textures/ui/kg_grilling/catalog/special_seasoning')
 def test_hidden_fill_proxies_retain_canonical_guide_and_mechanics(self):
  owner={NS+'empty_seasoning_bottle':{},NS+'pending_seasoning':{}}
  for kind in ['partial','pending']:
   for fill in range(1,9):
    item=load(GAME/'items'/f'{kind}_seasoning_f{fill}.json')['minecraft:item']
    self.assertTrue(check_hidden_bottle_fill(item,owner))
    for field in ['display','visibility','use']:
     bad=copy.deepcopy(item)
     if field=='display':bad['components']['minecraft:display_name']['value']='wrong'
     elif field=='visibility':bad['description']['menu_category']={'category':'equipment'}
     else:bad['components']['minecraft:max_stack_size']=64
     with self.assertRaises(AssertionError):check_hidden_bottle_fill(bad,owner)
  for invalid in ['pending_seasoning_f0','pending_seasoning_f9','partial_seasoning_f11']:
   self.assertFalse(check_hidden_bottle_fill({'description':{'identifier':NS+invalid}},owner))
 def test_raw_atlas_is_rejected_in_every_menu_layer(self):
  for icon in ['textures/ui/kg_grilling/guide_grill','textures/ui/kg_grilling/guide_seasoning']:
   for layer in ['root','category','entry']:
    d=copy.deepcopy(load(SOURCE))
    if layer=='root':d['icon']=icon
    elif layer=='category':d['categories'][0]['icon']=icon
    else:d['entries'][0]['icon']=icon
    with self.assertRaisesRegex(ValueError,'Raw material atlas'):validate_source(d)
if __name__=='__main__':unittest.main()
