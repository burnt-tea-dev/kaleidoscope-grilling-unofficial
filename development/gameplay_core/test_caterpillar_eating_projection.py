"""Regress the actual missing route, overwritten generation and native camera scope."""
from pathlib import Path
import copy,hashlib,json,subprocess,sys,unittest
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools'))
import build_caterpillar_eating_projection as scoped
import build_eating_motion as motion
FIX=json.loads((ROOT/'development/gameplay_core/fixtures/caterpillar-camera-native-20261009.json').read_text())
SOURCE_PREDECESSOR_BASE='d10d3b12b6cbbf922b0e940fbf174c7b24edf223'
assert FIX['source_predecessor']==SOURCE_PREDECESSOR_BASE
P=ROOT/'projects/grilling/gameplay_core'
def encoded(x):return x if isinstance(x,bytes)else x.encode()if isinstance(x,str)else (json.dumps(x,ensure_ascii=False,indent=2)+'\n').encode()
class CaterpillarProjectionTests(unittest.TestCase):
 def test_complete_native_reviewed_runtime_and_only_two_main_edits(self):
  for relative,sha in FIX['runtime_file_sha256'].items():
   self.assertEqual(hashlib.sha256((P/relative).read_bytes()).hexdigest(),sha,relative)
  original=subprocess.check_output(['git','show',FIX['source_predecessor']+':projects/grilling/gameplay_core/behavior_pack/scripts/main.js'],cwd=ROOT).decode()
  current=(scoped.BP/'scripts/main.js').read_text()
  self.assertEqual(scoped.patch_main(original),current)
  self.assertEqual(scoped.patch_main(current),current)
  for bad in ('',original+original,current+current):
   with self.assertRaises(ValueError):scoped.patch_main(bad)
 def test_full_generator_twice_is_idempotent_and_other_outputs_unchanged(self):
  path=scoped.RP/'attachables/grilled_caterpillar_skewer.attachable.json'
  source=json.loads(subprocess.check_output(['git','show',FIX['source_predecessor']+':'+path.relative_to(ROOT).as_posix()],cwd=ROOT))
  first=motion.build({path:source});second=motion.build(first)
  self.assertEqual({str(k):encoded(v)for k,v in first.items()},{str(k):encoded(v)for k,v in second.items()})
  for k,v in first.items():self.assertEqual(k.read_bytes(),encoded(v),str(k))
  # Remove only the final new augment, retaining every earlier shared builder.
  original=scoped.augment
  try:
   scoped.augment=lambda output:output
   previous=motion.build({path:source})
  finally:scoped.augment=original
  closure={P/relative for relative in FIX['runtime_closure']}
  delta={p for p in set(previous)|set(first)if p not in previous or p not in first or encoded(previous[p])!=encoded(first[p])}
  self.assertEqual(delta,closure)
 def test_player_item_visibility_gate_has_exact_target_and_safe_rejections(self):
  player=scoped.animations()[1]['animations'][scoped.PLAYER]
  self.assertEqual(player['blend_weight'],'variable.is_first_person && '+scoped.GATE)
  script='''const gate=EXPRESSION;
const item='kaleidoscope_grilling:grilled_caterpillar_skewer';
let state={id:item,profile:1,hand:1,projection:1,use:true,fp:1,off:0,sneak:0,swim:0,glide:0,ride:0,has:true};
const q={has_property:()=>state.has,is_item_name_any:(slot,...ids)=>slot==='slot.weapon.mainhand'&&ids.includes(state.id),is_item_equipped:()=>state.off,property:n=>state[n.split(':')[1].replace('eat_','')]};
for(const [name,key]of [['is_using_item','use'],['is_sneaking','sneak'],['is_swimming','swim'],['is_gliding','glide'],['is_riding','ride']])Object.defineProperty(q,name,{get:()=>state[key]});
const variable={get is_first_person(){return state.fp;}};
const evaluate=()=>Boolean(new Function('q','variable','return '+gate)(q,variable));
if(!evaluate())throw Error('Canonical route absent');
for(const [key,value]of [['id','kaleidoscope_grilling:raw_caterpillar_skewer'],['id',item+'_native_plain'],['id','kaleidoscope_grilling:grilled_fish_skewer'],['profile',4],['hand',2],['projection',0],['use',false],['fp',0],['off',1],['sneak',1],['swim',1],['glide',1],['ride',1],['has',false]]){let old=state[key];state[key]=value;if(evaluate())throw Error('Gate leaked '+key+':'+value);state[key]=old;}
'''.replace('EXPRESSION',json.dumps(player['blend_weight']))
  subprocess.run(['node','--input-type=module','-e',script],cwd=ROOT,check=True)
 def test_socket_helper_and_java_rotations_are_not_recalibrated(self):
  item,player=scoped.animations();bones=player['animations'][scoped.PLAYER]['bones']
  for arm in ['rightarm','leftarm']:self.assertEqual(bones[arm]['scale'],['1.0 / 0.9375']*3)
  for socket in ['rightitem','leftitem']:self.assertEqual(bones[socket]['scale'],[1,1,1]);self.assertEqual(bones[socket]['rotation'],[0,0,0])
  geo,_=scoped.piece_assets();g=geo['minecraft:geometry'][0]
  self.assertEqual(g['bones'][0]['binding'],"q.item_slot_to_bone_name('off_hand')")
  self.assertEqual(item['animations'][scoped.ANIMATION]['bones']['dual_piece']['scale'],['v.kg_eat_seconds >= 1.16667 ? 1 : 0']*3)
  # These native-reviewed hash goldens cover all sampled rotations, not one angle.
  for relative in ['resource_pack/animations/kg_probe_caterpillar_item.animation.json','resource_pack/animations/kg_probe_caterpillar_player.animation.json']:
   doc=item if '_item.'in relative else player
   self.assertEqual(hashlib.sha256(encoded(doc)).hexdigest(),FIX['runtime_file_sha256'][relative])
if __name__=='__main__':unittest.main(verbosity=2)
