"""Raw routing contracts; no native camera/render acceptance."""
import copy,itertools,json,subprocess,sys,unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
import build_raw_one_eating_projection as r
from eating_owner_context import legacy_document,document

class RawOneTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.output=r.augment({})
 def test_sources_and_exact_scope(self):
  c=r.validate_sources();self.assertEqual(len(c['routes']),2)
  for hand in ['bad','main','off','']:
   with self.assertRaises(ValueError):r.gate(hand)
  with self.assertRaises(ValueError):r.gate('right',['kaleidoscope_grilling:raw_fish_skewer_java_three_alt'])
 def test_roundtrip_and_idempotence(self):
  for name in ['raw_fish_skewer','raw_caterpillar_skewer']:
   p=r.RP/'attachables'/(name+'.attachable.json');current=json.loads(p.read_text())
   before=r.historical_document(p,legacy_document(current))
   expected=json.loads(subprocess.check_output(['git','show',r.contract()['base_commit']+':'+p.relative_to(r.ROOT).as_posix()],cwd=r.ROOT))
   self.assertEqual(before,legacy_document(expected))
   self.assertEqual(r.historical_document(p,current,owned=True),expected)
  for p in [r.CONTROLLER]:
   current=json.loads(p.read_text());expected=json.loads(subprocess.check_output(['git','show',r.contract()['base_commit']+':'+p.relative_to(r.ROOT).as_posix()],cwd=r.ROOT))
   self.assertEqual(r.historical_document(p,current),expected)
  text=r.MAIN.read_text();expected=subprocess.check_output(['git','show',r.contract()['base_commit']+':'+r.MAIN.relative_to(r.ROOT).as_posix()],cwd=r.ROOT).decode()
  self.assertEqual(r.restore_main(text),expected);self.assertEqual(r.patch_main(text),text)
  # Preserve unrelated independent main layers through exact inverse.
  other='// other independent layer\n'+expected
  self.assertEqual(r.restore_main(r.patch_main(other)),other)
  self.assertEqual(self.output,r.augment(self.output))
 def test_donor_payload_and_unchanged_files(self):
  donor=json.loads((r.RP/'animations/java_eating_player.animation.json').read_text())['animations']
  clips=json.loads(r.CLIPS.read_text())['animations']
  for hand in ['right','left']:
   x=copy.deepcopy(donor['animation.kg_java_eating.player.one.'+hand]);y=copy.deepcopy(clips[r.player_id(hand)])
   x.pop('blend_weight');y.pop('blend_weight');self.assertEqual(x,y);self.assertIs(y['override_previous_animation'],True)
  protected=['animations/java_eating_player.animation.json','animations/java_eating_projection.animation.json','animations/kg_probe_caterpillar_player.animation.json','animations/kg_isolated_two_route_player.animation.json','animations/review_three_player.animation.json','attachables/grilled_fish_skewer.attachable.json','attachables/grilled_caterpillar_skewer.attachable.json']
  for name in protected:
   p=r.RP/name;self.assertEqual(p.read_bytes(),subprocess.check_output(['git','show',r.contract()['base_commit']+':'+p.relative_to(r.ROOT).as_posix()],cwd=r.ROOT))
 def test_gate_truth_table(self):
  count=0
  for item,hand in itertools.product(r.ids(),['right','left']):
   slot='main_hand' if hand=='right' else 'off_hand';code=1 if hand=='right' else 2
   for fp,using,projection,sneak,swim,glide,ride,occupied in itertools.product([0,1],repeat=8):
    for profile,heldhand,held in [(1,code,item),(3,code,item),(4,code,item),(1,3-code,item),(1,code,'other')]:
     props={'kaleidoscope_grilling:eat_projection':projection,'kaleidoscope_grilling:eat_profile':profile,'kaleidoscope_grilling:eat_hand':heldhand}
     q=SimpleNamespace(is_using_item=using,is_sneaking=sneak,is_swimming=swim,is_gliding=glide,is_riding=ride,has_property=lambda k:k in props,property=lambda k:props[k],is_item_equipped=lambda s:occupied,is_item_name_any=lambda s,*names:held in names)
     for attachable in [False,True]:
      expr=r.gate(hand,[item],attachable).replace('&&',' and ').replace('||',' or ')
      actual=bool(eval(expr,{'__builtins__':{}},{'q':q,'c':SimpleNamespace(is_first_person=fp,item_slot=slot),'variable':SimpleNamespace(is_first_person=fp)}))
      expected=bool(fp and using and projection and not(sneak or swim or glide or ride or occupied) and profile==1 and heldhand==code and held==item)
      self.assertEqual(actual,expected);count+=1
  self.assertEqual(count,10240)
 def test_helper_assets_and_threshold(self):
  for item in r.ids():
   name=item.split(':')[1];p=r.RP/'models/entity/java_eating_piece'/(name+'.geo.json');g=json.loads(p.read_text())['minecraft:geometry'][0]
   self.assertEqual(g['bones'][0]['binding'],"q.item_slot_to_bone_name(context.item_slot == 'main_hand' ? 'off_hand' : 'main_hand')")
   self.assertEqual(g['bones'][0]['pivot'],[0,24,0]);self.assertEqual(g['bones'][1]['name'],'dual_piece')
   self.assertTrue((r.RP/'textures/java_eating_piece'/(name+'.png')).is_file())
  items=json.loads((r.RP/'animations/java_eating_projection.animation.json').read_text())['animations']
  for hand in ['right','left']:
   self.assertEqual(items['animation.kg_java_eating.item.one.'+hand]['bones']['dual_piece']['scale'],['v.kg_eat_seconds >= 1.16667 ? 1 : 0']*3)
 def test_fail_closed_donor_mutations(self):
  p=r.RP/'animations/java_eating_player.animation.json';donor=json.loads(p.read_text())
  for mutate in ['override','position','clock','scale']:
   x=copy.deepcopy(donor);clip=x['animations']['animation.kg_java_eating.player.one.right']
   if mutate=='override':clip['override_previous_animation']=False
   elif mutate=='clock':clip['anim_time_update']='query.anim_time'
   elif mutate=='scale':clip['bones']['rightarm']['scale']=[2,2,2]
   else:clip['bones']['rightarm']['position']['0'][0]='0'
   with self.assertRaisesRegex(ValueError,'donor changed'):r.augment({p:x})
 def test_fail_closed_partial_and_conflicting_layers(self):
  p=r.RP/'attachables/raw_fish_skewer.attachable.json';base=json.loads(p.read_text())
  for mutate in ['alias','gate','fallback','texture','controller','identity']:
   x=copy.deepcopy(base);d=x['minecraft:attachable']['description']
   if mutate=='alias':del d['animations']['raw_one_left']
   elif mutate=='gate':next(row for row in d['scripts']['animate'] if 'raw_one_right'in row)['raw_one_right']='1'
   elif mutate=='fallback':next(row for row in d['scripts']['animate'] if 'fp_right'in row)['fp_right']='1'
   elif mutate=='texture':d['textures']['java_piece']='textures/cooked'
   elif mutate=='controller':d['render_controllers'].append(r.PIECE)
   else:d['identifier']='kaleidoscope_grilling:raw_fish_skewer_java_three_alt'
   with self.assertRaises(ValueError):r.historical_document(p,x,owned=True)
  with self.assertRaises(ValueError):r.restore_main(r.MAIN.read_text().replace(r.IMPORT,''))
  x=json.loads(r.CONTROLLER.read_text());rows=x['render_controllers']['controller.render.player.first_person']['part_visibility'];next(row for row in rows if 'rightArm'in row)['rightArm']='1'
  with self.assertRaises(ValueError):r.historical_document(r.CONTROLLER,x)
 def test_source_hash_fail_closed(self):
  original=Path.read_bytes;source=r.ROOT/next(iter(r.contract()['source_files']))
  def mutated(path):return original(path)+b' ' if path==source else original(path)
  with patch.object(Path,'read_bytes',mutated):
   with self.assertRaisesRegex(ValueError,'source drift'):r.validate_sources()

if __name__=='__main__':unittest.main()
