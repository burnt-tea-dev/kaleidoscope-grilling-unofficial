"""Actual route predicates and byte-preserving source generation, not native acceptance."""
import copy,hashlib,json,pathlib,subprocess,sys,tempfile,unittest
from unittest.mock import patch
ROOT=pathlib.Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'tools'))
import build_review_three_eating_projection as r
import build_two_route_eating_projection as old
import build_java_eating_projection as g
import eating_owner_context as context
import build_raw_one_eating_projection as raw_one
import build_failure_skewer_held as failure
import build_offhand_eating_projection as offhand
from build_slime_frame_selector import strip_main as strip_slime
from slime_frame_source_witness import reference_bytes as slime_reference
from skewer_content_source import historical_bytes
def route_main_view(text):
 text=historical_bytes(r.MAIN,text.encode()).decode()
 slime_reference(r.MAIN,text.encode())
 return strip_slime(failure.restore_main(text))
BASE="e8da20b1f4f135543c16a604c92c60cfe3093eca"
def current_json(p):return context.legacy_document(json.loads(p.read_text()))
class ReviewThreeTests(unittest.TestCase):
 def test_partial_visibility_layer_is_rejected(self):
  p=r.RP/'render_controllers/java_eating_player.render_controllers.json';raw=json.loads(p.read_text());before=r.historical_document(p,raw)
  rows=raw['render_controllers']['controller.render.player.first_person']['part_visibility'];oldrows=before['render_controllers']['controller.render.player.first_person']['part_visibility']
  for i,row in enumerate(rows):
   if 'rightArm' in row:row['rightArm']=oldrows[i]['rightArm']
  with self.assertRaises(ValueError):r.predecessor_document(p,raw)
  with patch.object(pathlib.Path,'read_bytes',return_value=(json.dumps(raw,ensure_ascii=False,indent=2)+'\n').encode()):
   with self.assertRaises(ValueError):context.reference_bytes(p)
 def test_predecessor_never_rewrites_secret_terminal_layer(self):
  p=r.RP/'attachables/secret_skewer.attachable.json';raw=json.loads(p.read_text())
  self.assertEqual(r.predecessor_document(p,raw),raw)
  p=r.RP/'attachables'/(r.ids()[0].split(':')[1]+'.attachable.json');raw=offhand.strip_document(json.loads(p.read_text()));raw['minecraft:attachable']['description']['materials']['unexpected']='mutated'
  restored=r.predecessor_document(p,raw)
  self.assertEqual(restored['minecraft:attachable']['description']['materials']['unexpected'],'mutated')
  pristine=offhand.strip_document(json.loads(p.read_text()));bad=copy.deepcopy(pristine)
  pre=bad['minecraft:attachable']['description']['scripts']['pre_animation']
  pre[0]=pre[0].replace("c.owning_entity->q.property('kaleidoscope_grilling:eat_native_ticks')","q.property('kaleidoscope_grilling:eat_native_ticks')",1)
  self.assertNotEqual(r.predecessor_document(p,bad),r.predecessor_document(p,pristine))
  with patch.object(pathlib.Path,'read_bytes',return_value=(json.dumps(bad,ensure_ascii=False,indent=2)+'\n').encode()):
   with self.assertRaises(AssertionError):context.reference_bytes(p)

 def test_public_main_witness_still_rejects_unrelated_mutation(self):
  from public_source_witness import assert_public_bytes_with_g71_bottles
  assert_public_bytes_with_g71_bottles(self,r.MAIN)
  original=r.MAIN.read_bytes()
  with patch.object(pathlib.Path,'read_bytes',return_value=original+b'\n// unrelated change\n'):
   with self.assertRaises(AssertionError):assert_public_bytes_with_g71_bottles(self,r.MAIN)
 def test_alt_variant_generation_preserves_every_existing_output(self):
  from build_native_eating_variants import build
  output=build()
  for p,value in output.items():
   self.assertEqual((json.dumps(value,ensure_ascii=False,indent=2)+'\n').encode(),p.read_bytes(),str(p))
   if p.parent==r.RP/'attachables':
    self.assertNotIn(r.ALIAS,value['minecraft:attachable']['description']['animations'])
 def test_actual_owner_context_and_clock_are_preserved(self):
  for item in r.ids():
   p=r.RP/'attachables'/(item.split(':')[1]+'.attachable.json')
   raw=offhand.strip_document(json.loads(p.read_text()))
   self.assertEqual(context.document(current_json(p),attachable=True),raw)
   route=next(x[r.ALIAS]for x in raw['minecraft:attachable']['description']['scripts']['animate']if r.ALIAS in x)
   self.assertEqual(route,context.owner_expression(r.gate([item],True)))
  p=r.RP/'animations/review_three_player.animation.json'
  self.assertEqual(json.loads(p.read_text())['animations'][r.PLAYER]['anim_time_update'],context.PLAYER_SECONDS)
 def test_exact_contract_and_player_channels(self):
  self.assertEqual(len(r.validate_contract(g)),20)
  original=current_json(old.DEDICATED)['animations']['animation.kg_isolated_two_route_v1.player.pearl_three.right']
  actual=current_json(r.RP/'animations/review_three_player.animation.json')['animations'][r.PLAYER]
  self.assertEqual({**actual,'blend_weight':original['blend_weight']},original)
  self.assertEqual(hashlib.sha256(old.encoded(current_json(old.DEDICATED))).hexdigest(),old.NATIVE_CLIPS_SHA256)
 def test_main_delta_reversible_and_incomplete_wrappers_rejected(self):
  current=route_main_view(r.MAIN.read_text());baseline=subprocess.check_output(['git','show',BASE+':'+str(r.MAIN.relative_to(ROOT))],cwd=ROOT,text=True)
  self.assertEqual(r.restore_main(current),baseline);self.assertEqual(r.patch_main(baseline),raw_one.restore_main(current))
  with self.assertRaises(ValueError):r.restore_main(current.replace(r.IMPORT,''))
 def test_every_old_runtime_byte_is_preserved_outside_exact_delta(self):
  paths=[r.MAIN,r.RP/'render_controllers/java_eating_player.render_controllers.json']+[r.RP/'attachables'/(i.split(':')[1]+'.attachable.json')for i in r.ids()]
  for p in paths:
   old_bytes=subprocess.check_output(['git','show',BASE+':'+str(p.relative_to(ROOT))],cwd=ROOT)
   if p==r.MAIN:self.assertEqual(r.restore_main(route_main_view(p.read_text())).encode(),old_bytes)
   else:
    actual=current_json(p);self.assertEqual(r.historical_document(p,actual),context.legacy_document(json.loads(old_bytes)))
    if p.parent==r.RP/'attachables':
     actual['minecraft:attachable']['description']['scripts']['animate'][0]['unexpected']='1'
     self.assertNotEqual(r.historical_document(p,actual),context.legacy_document(json.loads(old_bytes)))
 def test_inverse_rejects_unknown_layer_and_preserves_unrelated_mutations(self):
  p=r.RP/'attachables'/(r.ids()[0].split(':')[1]+'.attachable.json')
  original=current_json(p)
  for field,value in [('geometry','geometry.unreviewed'),('textures','textures/unreviewed')]:
   bad=copy.deepcopy(original);bad['minecraft:attachable']['description'][field]['java_piece']=value
   with self.assertRaises(ValueError):r.historical_document(p,bad)
  bad=copy.deepcopy(original);d=bad['minecraft:attachable']['description']
  next(row for row in d['scripts']['animate']if r.ALIAS in row)[r.ALIAS]='1'
  with self.assertRaises(ValueError):r.historical_document(p,bad)
  from effect_merge_source_witness import restore_main as restore_effect
  main=restore_effect(historical_bytes(r.MAIN).decode());mutation=main+'\n// unrelated mutation retained\n'
  self.assertEqual(r.restore_main(mutation),r.restore_main(main)+'\n// unrelated mutation retained\n')
  ctrl=r.RP/'render_controllers/java_eating_player.render_controllers.json';bad=json.loads(ctrl.read_text())
  rows=bad['render_controllers']['controller.render.player.first_person']['part_visibility'];next(row for row in rows if 'rightArm' in row)['rightArm']='1'
  old=json.loads(subprocess.check_output(['git','show',BASE+':'+str(ctrl.relative_to(ROOT))],cwd=ROOT))
  with self.assertRaises(ValueError):r.historical_document(ctrl,bad)
 def test_drift_fails_closed(self):
  doc=json.loads(r.CONTRACT.read_text());doc['routes'][0]['helper_sha256']='0'*64
  with tempfile.TemporaryDirectory() as d:
   p=pathlib.Path(d)/'contract.json';p.write_text(json.dumps(doc))
   with patch.object(r,'CONTRACT',p),self.assertRaises(ValueError):r.validate_contract(g)
 def test_all_live_routes_and_fallback_profiles(self):
  payload=[]
  player=current_json(r.RP/'animations/review_three_player.animation.json')['animations'][r.PLAYER]['blend_weight']
  self.assertEqual(player,r.gate())
  ctrl=raw_one.historical_document(raw_one.CONTROLLER,failure.predecessor_document(raw_one.CONTROLLER,json.loads(raw_one.CONTROLLER.read_text())))['render_controllers']['controller.render.player.first_person']
  for item in r.ids():
   d=current_json(r.RP/'attachables'/(item.split(':')[1]+'.attachable.json'))['minecraft:attachable']['description']
   routes={k:v for row in d['scripts']['animate']for k,v in row.items()};active=routes[r.ALIAS]
   self.assertEqual(active,r.gate([item],True))
   self.assertIn('v.kg_java_piece_visible = (('+active+'));',d['scripts']['pre_animation'])
   for bone in ['rightArm','rightSleeve','leftArm','leftSleeve']:
    expression=next(row[bone]for row in ctrl['part_visibility']if bone in row)
    self.assertTrue(expression.startswith('('+r.gate()+') ? 1 : ('))
   piece=json.loads((r.RP/'models/entity/java_eating_piece'/(item.split(':')[1]+'.geo.json')).read_text())['minecraft:geometry'][0]
   self.assertEqual(piece['bones'][0]['binding'],"q.item_slot_to_bone_name(context.item_slot == 'main_hand' ? 'off_hand' : 'main_hand')")
   payload.append({'id':item,'routes':routes,'player':player})
  js=r'''
import assert from 'node:assert/strict';import fs from 'node:fs';
const {supportsReviewedThree,reviewedThreeAnimation}=await import(process.argv[1]);
const rows=JSON.parse(fs.readFileSync(0,'utf8'));let cases=0;
for(const row of rows){
 const base={id:row.id,profile:3,hand:1,first:1,slot:'main_hand',using:true,projection:1,sneaking:0,swimming:0,gliding:0,riding:0,helper:0};
 const variants=[{}, {profile:4},{hand:2},{first:0},{slot:'off_hand'},{using:false},{projection:0},{sneaking:1},{swimming:1},{gliding:1},{riding:1},{helper:1},{id:'minecraft:stick'},{id:row.id+'_java_three_alt'},{id:row.id+'_plain'},{missing:true}];
 for(let pass=0;pass<2;pass++)for(let i=0;i<variants.length;i++){
  // Return to the same session after each excluded state; no terminal-stop latching.
  const s={...base,...(pass?{}:variants[i])};const expected=pass?true:i===0;
  const q={is_using_item:s.using,has_property:()=>!s.missing,property:n=>s[{eat_profile:'profile',eat_hand:'hand',eat_projection:'projection'}[n.split(':')[1]]],is_sneaking:s.sneaking,is_swimming:s.swimming,is_gliding:s.gliding,is_riding:s.riding,is_item_equipped:()=>s.helper,is_item_name_any:(slot,...ids)=>ids.includes(s.id)};
  const c={is_first_person:s.first,item_slot:s.slot},variable={is_first_person:s.first};
  const ev=x=>Boolean(Function('q','c','variable','return ('+x+')')(q,c,variable));
  assert.equal(ev(row.routes.review_three_right),expected,JSON.stringify(s));assert.equal(ev(row.player),expected || (!pass&&i===4),JSON.stringify(s));
  if(expected){assert.equal(ev(row.routes.fp_right),false);assert.equal(ev(row.routes.eat_right),false);if(row.routes.eat_alt_right)assert.equal(ev(row.routes.eat_alt_right),false);}
  if(!pass&&i===1&&row.routes.eat_alt_right){assert.equal(ev(row.routes.eat_alt_right),true);assert.equal(ev(row.routes.fp_right),true);}
  cases++;
 }
 assert.equal(supportsReviewedThree(row.id,'THREE','main'),true);
 for(const [p,h]of[['THREE_ALT','main'],['THREE','off'],['ONE','main']]){assert.equal(supportsReviewedThree(row.id,p,h),false);assert.equal(reviewedThreeAnimation(row.id,p,h),null);}
 assert.equal(supportsReviewedThree(row.id+'_java_three_alt','THREE','main'),false);
}
console.log(cases+' exact live route contexts passed; unsupported states retain fallback');
'''
  subprocess.run(['node','--input-type=module','-e',js,r.REGISTRY.as_uri()],input=json.dumps(payload),text=True,check=True)
if __name__=='__main__':unittest.main(verbosity=2)
