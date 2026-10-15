"""Independent relative-pose/dispatch tests for39exact ordinary routes."""
import unittest,json,pathlib,sys,copy,subprocess
ROOT=pathlib.Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'tools'))
import build_ordinary_relative_calibration as layer
from test_failure_relative_calibration import EVALUATOR,node,slot,secret_identity,arms
BASE='40a855f2742a17287c8204fd932329a33f7aa41d';RP=ROOT/'projects/grilling/gameplay_core/resource_pack';BP=ROOT/'projects/grilling/gameplay_core/behavior_pack/scripts'
def donor(p,h):return json.loads((RP/'animations/java_eating_player.animation.json').read_text())['animations']['animation.kg_java_eating.player.'+p.lower()+'.'+h]
def rows():
 actual=json.loads(layer.PLAYER.read_text())['animations']if layer.PLAYER.exists()else{}
 return [dict(profile=p,hand=h,slot=slot(h),secret=secret_identity(p),ids=layer.ids(p,h),arms=arms(p,h),donor=donor(p,h),actual=actual.get(layer.player_id(p,h),donor(p,h)))for p,h in layer.CONTEXTS]
def exact_expected(p,h):
 c=copy.deepcopy(donor(p,h));before=' + ('+layer.predicate(p,h,False)+' ? 3.41 : 0)';after=' + ('+layer.predicate(p,h,True)+' ? 3.41 : 0)'
 for arm in arms(p,h):
  for xyz in c['bones'][arm]['position'].values():
   assert xyz[1].endswith(before);xyz[1]=xyz[1][:-len(before)]+after
 c['blend_weight']='('+c['blend_weight']+') && ('+layer.predicate(p,h,True)+')';return c
class OrdinaryRelativeCalibration(unittest.TestCase):
 def test_exact39route_contract_and_frozen_source_pin(self):
  import hashlib
  expected=sorted(['kaleidoscope_grilling:ordinary_skewer_java_three_alt']+['kaleidoscope_grilling:'+state+'_'+food+'_skewer_java_three_alt'for state in ('raw','grilled')for food in ('gluten','golden','lamb','meat_and_bone','meatball','mid_wing','mushroom','potato_slice','squid_tentacle')])
  self.assertEqual(layer.contract()['three_alt_ids'],expected)
  self.assertEqual(layer.contract()['three_left_ids'],['kaleidoscope_grilling:grilled_ender_pearl_skewer'])
  base=subprocess.check_output(['git','show',BASE+':'+str(layer.DONOR.relative_to(ROOT))],cwd=ROOT)
  self.assertEqual(layer.contract()['donor_sha256'],hashlib.sha256(base).hexdigest())
  self.assertEqual(sum(len(layer.ids(p,h))for p,h in layer.CONTEXTS),39)
 def test_39_routes_every_authored_key_both_rigs_relative_equal(self):
  result=node(EVALUATOR+r'''
let count=0;for(const row of rows)for(const id of row.ids)for(const slim of [false,true]){
 const before=query(row,row.secret,slim),after=query(row,id,slim);
 for(const[bone,channels]of Object.entries(row.donor.bones))for(const[channel,track]of Object.entries(channels)){
  const other=row.actual.bones[bone][channel];
  function walk(a,b){if(Array.isArray(a)){a.forEach((v,i)=>walk(v,b[i]));return}if(a&&typeof a==='object'){for(const k of Object.keys(a))walk(a[k],b[k]);return}const x=evaluate(a,before),y=evaluate(b,after);if(Math.abs(x-y)>1e-9)throw Error(JSON.stringify({id,bone,channel,x,y}));count++}walk(track,other);
 }if(evaluate(row.donor.anim_time_update,before)!==evaluate(row.actual.anim_time_update,after))throw Error('clock');}
console.log(count);''',rows());self.assertGreater(int(result),100000)
 def test_exact_owned_inventory_and_inverse_both_clock_forms(self):
  doc=json.loads(layer.PLAYER.read_text());self.assertEqual(set(doc),{'format_version','animations'});self.assertEqual(set(doc['animations']),{layer.player_id(p,h)for p,h in layer.CONTEXTS})
  from eating_owner_context import legacy_document,document
  for p,h in layer.CONTEXTS:
   actual=doc['animations'][layer.player_id(p,h)];self.assertEqual(json.dumps(actual,sort_keys=True),json.dumps(exact_expected(p,h),sort_keys=True))
   for d in [donor(p,h),legacy_document(donor(p,h))]:
    d['blend_weight']='preserved';owned=layer.transform(d,p,h);self.assertEqual(layer.transform(owned,p,h,True),d);self.assertEqual(owned['blend_weight'],'preserved')
    self.assertEqual(document(owned,attachable=False)['bones'],actual['bones'])
 def test_actual_selector_39_routes_and_pearl_right_exclusion(self):
  main=(BP/'main.js').read_text();line=next(l for l in main.splitlines()if 'e.source.playAnimation('in l and 'failureEatingAnimation(e.itemStack'in l);selector=line.split('e.source.playAnimation(',1)[1].rsplit(',{',1)[0]
  pre="import {failureEatingAnimation} from './projects/grilling/gameplay_core/behavior_pack/scripts/failure_skewer_projection.js';import {rawOneAnimation} from './projects/grilling/gameplay_core/behavior_pack/scripts/raw_one_projection.js';import {reviewedThreeAnimation} from './projects/grilling/gameplay_core/behavior_pack/scripts/review_three_projection.js';"
  cases=[{'id':i,'profile':p,'hand':'main'if h=='right'else'off','expected':layer.player_id(p,h)}for p,h in layer.CONTEXTS for i in layer.ids(p,h)]
  cases += [{'id':'kaleidoscope_grilling:grilled_ender_pearl_skewer','profile':'THREE','hand':'main','expected':'animation.kg_isolated_two_route_v1.player.pearl_three.right'},{'id':'kaleidoscope_grilling:secret_skewer_java_three_alt','profile':'THREE_ALT','hand':'main','expected':'animation.kg_java_eating.player.three_alt.right'},{'id':'kaleidoscope_grilling:raw_fish_skewer','profile':'ONE','hand':'off','expected':'animation.kg_raw_one.player.one.left'},{'id':'kaleidoscope_grilling:dark_grilling','profile':'THREE','hand':'main','expected':'animation.kg_failure_held.player.three.right'}]
  script=pre+'const cases='+json.dumps(cases)+";for(const c of cases){const e={itemStack:{typeId:c.id},source:{}},profile=c.profile,hand=c.hand,heldByHand=()=>null;const actual="+selector+";if(actual!==c.expected)throw Error(JSON.stringify({c,actual}));}console.log(cases.length);"
  self.assertEqual(subprocess.check_output(['node','--input-type=module','-e',script],cwd=ROOT,text=True).strip(),'43')
 def test_original_gate_domain_preserved_for_owned_ids_and_negative_states(self):
  node(EVALUATOR+r'''
for(const row of rows)for(const id of row.ids)for(let flags=0;flags<128;flags++){
 const q=query(row,id,false);q.is_using_item=!(flags&1);q.is_sneaking=!!(flags&2);q.is_swimming=!!(flags&4);q.is_gliding=!!(flags&8);q.is_riding=!!(flags&16);q.is_item_equipped=()=>!!(flags&32);const variable={is_first_person:!(flags&64)};
 if(Boolean(evaluate(row.donor.blend_weight,q,variable))!==Boolean(evaluate(row.actual.blend_weight,q,variable)))throw Error('eligibility broadened');
}for(const row of rows)for(const id of row.ids)for(const mode of ['missing','wrong_profile','wrong_hand','wrong_slot']){
 const q=query(row,id,false),original=q.property;
 if(mode==='missing'){q.has_property=()=>false;q.property=()=>0;}
 if(mode==='wrong_profile')q.property=n=>n.endsWith(':eat_profile')?99:original(n);
 if(mode==='wrong_hand')q.property=n=>n.endsWith(':eat_hand')?99:original(n);
 if(mode==='wrong_slot')q.is_item_name_any=()=>false;
 if(evaluate(row.actual.blend_weight,q))throw Error('invalid state admitted:'+mode);
}for(const row of rows)for(const id of [row.secret,'kaleidoscope_grilling:raw_fish_skewer','kaleidoscope_grilling:ordinary_skewer_native_plain','kaleidoscope_grilling:ordinary_skewer']){
 const q=query(row,id,false);if(evaluate(row.actual.blend_weight,q))throw Error('unowned ID');
}console.log('pass');''',rows())
 def test_inverse_rejects_mutations_and_selector_partial_layers(self):
  for p,h in layer.CONTEXTS:
   good=layer.transform(donor(p,h),p,h);arm=arms(p,h)[0];time=next(iter(good['bones'][arm]['position']))
   mutations=[lambda c:c.update(override_previous_animation=1),lambda c:c.update(anim_time_update='0'),lambda c:c.update(animation_length=6),lambda c:c['bones'][arm]['position'][time].__setitem__(1,'0'),lambda c:c['bones'][arm].update(scale=[2,2,2])]
   for f in mutations:
    bad=copy.deepcopy(good);f(bad)
    with self.assertRaises(ValueError):layer.transform(bad,p,h,True)
   for old,new in [('3.41','3.40'),('slot.weapon.','wrong.slot.'),(layer.ids(p,h)[0],'kaleidoscope_grilling:unrelated')]:
    bad=copy.deepcopy(good);bad['bones'][arm]['position'][time][1]=bad['bones'][arm]['position'][time][1].replace(old,new)
    with self.assertRaises(ValueError):layer.transform(bad,p,h,True)
  from build_offhand_eating_projection import restore_main as restore_offhand
  main=restore_offhand((BP/'main.js').read_text());self.assertEqual(layer.patch_main(main),main);self.assertEqual(layer.patch_main(layer.restore_main(main)),main)
  with self.assertRaises(ValueError):layer.restore_main(main.replace('animation.kg_ordinary_relative.player.','animation.kg_ordinary_relative.player.broken',1))
 def test_only_owned_runtime_files_changed(self):
  import hashlib
  import build_tp_java_item_fallback as tp
  import build_offhand_eating_projection as offhand
  offhand_paths={str(p.relative_to(ROOT))for p in offhand.augment({})}
  changed=subprocess.check_output(['git','diff','--name-only',BASE],cwd=ROOT,text=True).splitlines();runtime=[p for p in changed if '/behavior_pack/'in p or'/resource_pack/'in p]
  self.assertLessEqual(set(runtime),{str(layer.MAIN.relative_to(ROOT)),str(layer.PLAYER.relative_to(ROOT)),str(tp.PLAYER.relative_to(ROOT))}|offhand_paths)
  untracked=subprocess.check_output(['git','ls-files','--others','--exclude-standard'],cwd=ROOT,text=True).splitlines()
  self.assertLessEqual({p for p in untracked if '/behavior_pack/'in p or'/resource_pack/'in p},{str(layer.PLAYER.relative_to(ROOT))}|offhand_paths)
  paths=subprocess.check_output(['git','ls-tree','-r',BASE,'projects/grilling/gameplay_core/behavior_pack','projects/grilling/gameplay_core/resource_pack'],cwd=ROOT,text=True).splitlines()
  for row in paths:
   meta,p=row.split('\t');expected=meta.split()[2]
   if p==str(layer.MAIN.relative_to(ROOT)):continue
   data=(ROOT/p).read_bytes()
   if p in offhand.contract()['predecessors']:
    data=(json.dumps(offhand.strip_document(json.loads(data)),ensure_ascii=False,indent=2)+'\n').encode()
   if p==str(tp.PLAYER.relative_to(ROOT)):
    restored=tp.transform(json.loads(data),inverse=True);data=(json.dumps(restored,indent=2)+'\n').encode()
   actual=hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest();self.assertEqual(actual,expected,p)
if __name__=='__main__':unittest.main()
