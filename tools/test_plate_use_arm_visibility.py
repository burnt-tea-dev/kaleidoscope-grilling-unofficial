"""Current generic-use repair, immutable historical producer, and real predicates.

Source evaluation only; neither these tests nor historical evidence certify pixels.
"""
import copy,json,subprocess,unittest
from pathlib import Path
import build_offhand_eating_projection as current
from frozen_offhand_source import producer
import plate_use_arm_visibility as repair
from eating_owner_properties import predecessor_document

class PlateUseArmVisibility(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.old=producer().expected_document(current.CONTROL)
  cls.new=json.loads(current.CONTROL.read_text())
 def test_only_two_generic_leaves_change(self):
  self.assertEqual(self.new,repair.apply(self.old))
  self.assertEqual(self.new,current.expected_document(current.CONTROL))
  self.assertEqual(current.strip_document(self.new),producer().strip_document(self.old))
  item=json.loads((current.ROOT/'projects/grilling/gameplay_core/behavior_pack/items/skewer_plate.json').read_text())
  self.assertEqual(item['minecraft:item']['description']['identifier'],'kaleidoscope_grilling:skewer_plate')
 def test_current_and_historical_producers_cross_reject(self):
  with self.assertRaises(ValueError):current.strip_document(self.old)
  with self.assertRaises(ValueError):producer().strip_document(self.new)
  with self.assertRaises(ValueError):repair.apply(self.new)
 def test_full_payload_mutations_rejected_by_both_producers(self):
  for factory,doc in ((current,self.new),(producer(),self.old)):
   mutations=[]
   for bone in ('rightArm','rightSleeve','leftArm','leftSleeve'):
    bad=copy.deepcopy(doc)
    row=next(r for r in bad['render_controllers']['controller.render.player.first_person']['part_visibility']if bone in r)
    row[bone]+=' || 1';mutations.append(bad)
   bad=copy.deepcopy(doc);bad['unrelated']=True;mutations.append(bad)
   bad=copy.deepcopy(doc);bad['render_controllers']['controller.render.player.first_person']['part_visibility'].append({'unrelated':True});mutations.append(bad)
   for bad in mutations:
    with self.assertRaises(ValueError):factory.strip_document(bad)
  # A half-applied repair cannot enter production or masquerade as history.
  bad=copy.deepcopy(self.new)
  next(r for r in bad['render_controllers']['controller.render.player.first_person']['part_visibility']if 'leftArm'in r)['leftArm']=next(r['leftArm'] for r in self.old['render_controllers']['controller.render.player.first_person']['part_visibility']if 'leftArm'in r)
  for factory in (current,producer()):
   with self.assertRaises(ValueError):factory.strip_document(bad)
 def test_all_frozen_documents_require_their_full_original_payload(self):
  from current_runtime_ownership import frozen_runtime_bytes
  historical=producer()
  self.assertEqual(len(historical.contract()['predecessors']),22)
  for relative,base in historical.contract()['predecessors'].items():
   path=current.ROOT/relative
   old=json.loads(frozen_runtime_bytes(relative))
   self.assertEqual(historical.expected_document(path),old)
   self.assertEqual(historical.strip_document(old),base)
   bad=copy.deepcopy(old);bad['unrelated']=True
   with self.subTest(path=relative),self.assertRaises(ValueError):historical.strip_document(bad)
   actual=json.loads(path.read_text())
   self.assertEqual(current.strip_document(actual),base)
   if path==current.CONTROL:
    with self.assertRaises(ValueError):current.strip_document(old)
    with self.assertRaises(ValueError):historical.strip_document(actual)
   else:self.assertEqual(predecessor_document(actual),old)
 def test_exported_molang_preserves_adjacent_branches(self):
  def expressions(doc):return {k:v for row in doc['render_controllers']['controller.render.player.first_person']['part_visibility']for k,v in row.items()if k in ('rightArm','rightSleeve','leftArm','leftSleeve')}
  data={'old':expressions(self.old),'new':expressions(self.new)}
  script='const rows='+json.dumps(data)+';'+r'''
const evaluate=(s,q,v)=>!!Function('q','query','variable','return ('+s+')')(q,q,v);
const names=['kaleidoscope_grilling:skewer_plate','minecraft:filled_map','kaleidoscope_grilling:raw_gluten_skewer','kaleidoscope_grilling:grilled_fish_skewer','kaleidoscope_grilling:mysterious_skewer','minecraft:apple'];
const offs=['','minecraft:filled_map','minecraft:shield','kaleidoscope_grilling:raw_gluten_skewer','minecraft:apple'];
let cases=0,changed=0;
for(const fp of [0,1])for(const using of [0,1])for(const charged of [0,1])for(const progress of [0,.001,.5,.999,1])for(const main of names)for(const off of offs)for(const [projection,profile,hand] of [[0,0,0],[1,1,1],[1,3,1],[1,3,2],[1,4,1],[1,4,2],[1,5,1]]){
 const props={eat_projection:projection,eat_profile:profile,eat_hand:hand};
 const q={is_using_item:using,item_is_charged:charged,is_sneaking:0,is_swimming:0,is_gliding:0,is_riding:0,
 has_property:()=>true,property:n=>props[n.split(':')[1]]??0,
 is_item_equipped:s=>!!(s==='off_hand'?off:main),
 is_item_name_any:(s,...ids)=>ids.includes(s==='slot.weapon.offhand'?off:main),
 get_equipped_item_name:(s)=>((s==='off_hand'?off:main).split(':')[1]??'')};
 const v={is_first_person:fp,item_use_normalized:progress};
 const target=fp===1&&using===1&&main==='kaleidoscope_grilling:skewer_plate'&&off===''&&!charged&&progress>0&&progress<1;
 for(const bone of Object.keys(rows.old)){
  const before=evaluate(rows.old[bone],q,v),after=evaluate(rows.new[bone],q,v);
  if(target&&bone.startsWith('left')){if(!before||after)throw Error('Missing repair '+JSON.stringify({bone,props,v}));changed++;}
  else if(before!==after)throw Error('Adjacent behavior changed '+JSON.stringify({bone,main,off,props,v,using,charged}));
 }
 cases++;
}
if(changed===0)throw Error('No positive repair cases');
console.log(JSON.stringify({cases,changed}));
'''
  result=subprocess.run(['node'],input=script,text=True,capture_output=True,cwd=current.ROOT)
  self.assertEqual(result.returncode,0,result.stderr)
  self.assertEqual(json.loads(result.stdout),{'cases':8400,'changed':42})

if __name__=='__main__':unittest.main()
