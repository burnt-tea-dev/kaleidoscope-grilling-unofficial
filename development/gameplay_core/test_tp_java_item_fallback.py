"""Scoped source tests; no runtime progress measurement or complete TP parity claim."""
import pathlib,sys,json,copy,unittest,subprocess,hashlib
ROOT=pathlib.Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'tools'))
import build_tp_java_item_fallback as layer
class TPJavaItemFallback(unittest.TestCase):
 def test_exact_source_owned_inventory(self):
  foods=('beef','bun_slice','caterpillar','chicken_skin','ender_pearl','fish','fried_egg','gluten','golden','lamb','meat_and_bone','meatball','mid_wing','mushroom','pork_belly','potato_slice','slime','squid_tentacle','sweet_potato_sheet')
  base=['kaleidoscope_grilling:'+state+'_'+f+'_skewer'for state in ('raw','grilled')for f in foods]+['kaleidoscope_grilling:'+f+'_skewer'for f in ('ordinary','secret','mysterious')]
  random=('gluten','golden','lamb','meat_and_bone','meatball','mid_wing','mushroom','potato_slice','squid_tentacle')
  alt=['kaleidoscope_grilling:'+s+'_'+f+'_skewer_java_three_alt'for s in ('raw','grilled')for f in random]+['kaleidoscope_grilling:'+f+'_skewer_java_three_alt'for f in ('ordinary','secret','mysterious')]
  self.assertEqual(layer.contract()['owned_ids'],sorted(base+alt));self.assertEqual(len(base+alt),62)
  b=subprocess.check_output(['git','show',layer.contract()['base_commit']+':'+str(layer.PLAYER.relative_to(ROOT))],cwd=ROOT)
  self.assertEqual(hashlib.sha256(b).hexdigest(),layer.contract()['predecessor_sha256']);self.assertEqual(json.loads(b),layer.contract()['predecessor'])
 def test_runtime_is_exact_scoped_output(self):self.assertEqual(layer.encoded(json.loads(layer.PLAYER.read_text())),layer.encoded(layer.expected()))
 def test_strict_inverse_idempotence_and_negative_mutations(self):
  before=layer.contract()['predecessor'];after=layer.transform(before)
  self.assertEqual(layer.transform(after),after);self.assertEqual(layer.transform(after,True),before)
  for key in after['animations']:
   for mutate in [lambda a:a.update(override_previous_animation=True),lambda a:a.update(loop=1),lambda a:a.update(animation_length=6),lambda a:a.update(blend_weight=a['blend_weight'].replace('mainhand','offhand').replace('offhand','wrongslot')),lambda a:a['bones'][next(iter(a['bones']))]['rotation'].__setitem__(0,0)]:
    bad=copy.deepcopy(after);mutate(bad['animations'][key])
    with self.assertRaises(ValueError):layer.transform(bad,True)
 def test_actual_gate_strings_all_ids_and_context_negatives(self):
  data={'ids':layer.contract()['owned_ids'],'clips':json.loads(layer.PLAYER.read_text())['animations'],'before':layer.contract()['predecessor']['animations']}
  js=r'''const d=JSON.parse(process.argv[1]);let n=0;
function ev(expr,q,v){return Boolean(Function('query','variable','return ('+expr+')')(q,v));}
for(const hand of ['right','left']){const key='animation.kg_eating.player.native_'+hand,slot='slot.weapon.'+(hand==='right'?'mainhand':'offhand');
for(const id of [...d.ids,'minecraft:apple','kaleidoscope_grilling:future_skewer','kaleidoscope_grilling:dark_grilling',null,17,true])for(const actualSlot of [slot,'wrongslot'])for(let f=0;f<16;f++){
 const q={is_using_item:!(f&1),is_item_name_any:(s,...ids)=>s===actualSlot&&typeof id==='string'&&ids.includes(id)},v={is_first_person:!!(f&2),use_item_startup_progress:f&4?.5:0,use_item_interval_progress:f&8?.5:0};
 const old=ev(d.before[key].blend_weight,q,v),expected=old&&!(actualSlot===slot&&d.ids.includes(id));if(ev(d.clips[key].blend_weight,q,v)!==expected)throw Error(JSON.stringify({hand,id,actualSlot,f}));n++;}}
console.log(n);'''
  count=int(subprocess.check_output(['node','-e',js,json.dumps(data)],text=True));self.assertEqual(count,68*2*2*16)
 def test_historical_tp_scope_and_exact_current_runtime_ownership(self):
  from current_runtime_ownership import BASE,verify_current_inventory
  verify_current_inventory()
  # Retain the frozen TP/offhand proof; later plate/performance/identity deltas
  # must pass the shared immutable current-runtime inventory, not a path allowance.
  base=layer.contract()['base_commit'];changed=subprocess.check_output(['git','diff','--name-only',base,BASE],cwd=ROOT,text=True).splitlines()
  import build_offhand_eating_projection as offhand
  from eating_owner_properties import reference_bytes as owner_property_reference
  from g153_repair_source import reference_bytes as repair_reference
  owned=offhand.augment({offhand.MAIN:repair_reference(offhand.MAIN,offhand.MAIN.read_bytes()).decode()})
  for path,expected in owned.items():
   actual=owner_property_reference(path)
   if path==offhand.MAIN:actual=repair_reference(path,actual)
   expected=expected if isinstance(expected,bytes)else(expected if isinstance(expected,str)else json.dumps(expected,ensure_ascii=False,indent=2)+'\n').encode();self.assertEqual(actual,expected,str(path))
  from eating_route_extraction import validate_resolver
  owned[ROOT/validate_resolver()]=(ROOT/validate_resolver()).read_bytes()
  self.assertLessEqual({p for p in changed if '/behavior_pack/'in p or'/resource_pack/'in p},{str(layer.PLAYER.relative_to(ROOT))}|{str(p.relative_to(ROOT))for p in owned})
if __name__=='__main__':unittest.main()
