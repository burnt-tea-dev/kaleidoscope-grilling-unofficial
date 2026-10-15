"""Exact21 left-source routes. No occupied-opposite/preferred-left/client acceptance."""
import pathlib,sys,json,copy,subprocess,hashlib,re,unittest,io
ROOT=pathlib.Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'tools'))
import build_offhand_eating_projection as layer
from test_failure_relative_calibration import EVALUATOR,node
class OffhandProjection(unittest.TestCase):
 def test_exact_ids_sources_and_left_clip_payloads(self):
  layer.validate();expected=sorted(['kaleidoscope_grilling:ordinary_skewer','kaleidoscope_grilling:raw_ender_pearl_skewer']+['kaleidoscope_grilling:'+s+'_'+f+'_skewer'for s in ['raw','grilled']for f in ['gluten','golden','lamb','meat_and_bone','meatball','mid_wing','mushroom','potato_slice','squid_tentacle']]);self.assertEqual(sorted(layer.ids('THREE')),expected);self.assertEqual(layer.ids('ONE'),['kaleidoscope_grilling:grilled_caterpillar_skewer'])
  actual=json.loads(layer.PLAYER.read_text());self.assertEqual(set(actual['animations']),{layer.player_id(p)for p in ['ONE','THREE']})
  donor=json.loads(layer.DONOR.read_text())['animations']
  rows=[]
  for p in ['ONE','THREE']:
   a=actual['animations'][layer.player_id(p)];d=donor['animation.kg_java_eating.player.'+p.lower()+'.left'];self.assertIs(a['override_previous_animation'],True)
   for key in d:
    if key not in ['blend_weight','bones']:self.assertEqual(a[key],d[key])
   for bone,b in d['bones'].items():
    for channel,v in b.items():
     if p=='THREE'and bone.endswith('arm')and channel=='position':continue
     self.assertEqual(a['bones'][bone][channel],v)
   rows.append({'profile':p,'hand':'left','slot':'slot.weapon.offhand','ids':layer.ids(p),'donor':d,'actual':a})
  node(EVALUATOR+r'''for(const r of rows)for(const id of r.ids)for(const slim of [false,true]){const before=query(r,'kaleidoscope_grilling:secret_skewer',slim),after=query(r,id,slim);function walk(a,b){if(Array.isArray(a)){a.forEach((v,i)=>walk(v,b[i]));return}if(a&&typeof a==='object'){for(const k of Object.keys(a))walk(a[k],b[k]);return}if(Math.abs(evaluate(a,before)-evaluate(b,after))>1e-9)throw Error(id)}walk(r.donor.bones,r.actual.bones)}console.log('pass');''',rows)
 def test_actual_production_subscribers_and_control_routes(self):
  f=ROOT/'development/gameplay_core/test_eating_native_completion.mjs';s=f.read_text().split("test('inclusive native boundary",1)[0]
  s=re.sub(r"(['\"])(\.\.?/[^'\"]+)\1",lambda m:"'"+(f.parent/m[2]).resolve().as_uri()+"'",s)
  s+='const rows='+json.dumps(layer.contract()['routes'])+r''';let count=0;for(const r of rows){const duration=r.profile==='THREE'?100:90;for(const empty of [true,false]){const f=fixture({mealId:r.id,hand:'off',duration,helperEmpty:empty});f.startUse();const own=f.animations.filter(([n])=>n.startsWith('animation.kg_offhand_projection.'));if(own.length!==(empty?1:0))throw Error(JSON.stringify({r,empty,calls:f.animations}));if(own.length){if(own[0][0]!=='animation.kg_offhand_projection.player.'+r.profile.toLowerCase()+'.left')throw Error('profile');if(own[0][1].controller!=='kg_java_eating_first_person'||!own[0][1].stopExpression.includes("slot.weapon.offhand"))throw Error('owner/stop');}count++;}const p=fixture({mealId:r.id+'_native_plain',hand:'off',duration:25,helperEmpty:true});p.startUse();if(p.animations.length)throw Error('plain');const m=fixture({mealId:r.id,hand:'main',duration,helperEmpty:true});m.startUse();if(m.animations.some(([n])=>n.startsWith('animation.kg_offhand_projection.')))throw Error('main claimed');count+=2;}console.log(count);'''
  r=subprocess.run(['node','--input-type=module'],input=s,capture_output=True,text=True,cwd=ROOT);self.assertEqual(r.returncode,0,r.stderr);self.assertEqual(r.stdout.strip(),'84')
 def test_serialized_gates_and_owner_context(self):
  rows=[]
  for r in layer.contract()['routes']:
   d=json.loads((layer.RP/'attachables'/(r['id'].split(':')[1]+'.attachable.json')).read_text())['minecraft:attachable']['description'];expr=next(x[layer.ALIAS]for x in d['scripts']['animate']if layer.ALIAS in x)
   rows.append({**r,'item_gate':expr,'player_gate':json.loads(layer.PLAYER.read_text())['animations'][layer.player_id(r['profile'])]['blend_weight']})
  js=r'''let count=0;function ev(s,q,owner,c,v){s=s.replaceAll('c.owning_entity->q.','owner.');return !!Function('q','owner','c','variable','return ('+s+')')(q,owner,c,v)}
for(const r of rows)for(let flags=0;flags<1024;flags++){const props={eat_projection:1,eat_profile:r.profile==='ONE'?1:3,eat_hand:2};const owner={has_property:()=>!(flags&1),property:n=>props[n.split(':')[1]]};const q={...owner,is_using_item:!(flags&2),is_sneaking:!!(flags&4),is_swimming:!!(flags&8),is_gliding:!!(flags&16),is_riding:!!(flags&32),is_item_equipped:s=>!!(flags&64),is_item_name_any:(s,...ids)=>s==='slot.weapon.offhand'&&!(flags&128)&&ids.includes(r.id)};const c={is_first_person:!(flags&256),item_slot:flags&512?'main_hand':'off_hand'},v={is_first_person:!(flags&256)};const expected=flags===0;if(ev(r.item_gate,q,owner,c,v)!==expected)throw Error('item gate '+flags);const playerExpected=(flags&511)===0;if(ev(r.player_gate,q,owner,c,v)!==playerExpected)throw Error('player gate '+flags);count++;}
for(const r of rows){const good={has_property:()=>true,property:n=>({eat_projection:1,eat_profile:r.profile==='ONE'?1:3,eat_hand:2})[n.split(':')[1]]},bad={has_property:()=>false,property:()=>0},q={...bad,is_using_item:1,is_sneaking:0,is_swimming:0,is_gliding:0,is_riding:0,is_item_equipped:()=>0,is_item_name_any:(s,...ids)=>s==='slot.weapon.offhand'&&ids.includes(r.id)},c={is_first_person:1,item_slot:'off_hand'},v={is_first_person:1};if(!ev(r.item_gate,q,good,c,v))throw Error('owner not used');Object.assign(q,good);if(ev(r.item_gate,q,bad,c,v))throw Error('local owner leak');for(const prop of ['eat_projection','eat_profile','eat_hand']){const owner={...good,property:n=>n.endsWith(':'+prop)?99:good.property(n)};if(ev(r.item_gate,q,owner,c,v))throw Error('wrong owner property');}}console.log(count);'''
  self.assertEqual(int(node(js,rows)),21*1024)
 def test_strict_inverse_and_mutations(self):
  for rel,base in layer.contract()['predecessors'].items():
   p=ROOT/rel;actual=json.loads(p.read_text());self.assertEqual(layer.strip_document(actual),base);self.assertEqual(layer.expected_document(p),actual)
   bad=copy.deepcopy(actual)
   if 'minecraft:attachable'in bad:bad['minecraft:attachable']['description']['materials']['default']='unrelated'
   else:bad['render_controllers']['controller.render.player.first_person']['part_visibility'][0]['unrelated']=True
   with self.assertRaises(ValueError):layer.strip_document(bad)
  text=layer.MAIN.read_text();old=layer.restore_main(text);self.assertEqual(layer.patch_main(old),text);self.assertEqual(layer.patch_main(text),text)
  with self.assertRaises(ValueError):layer.restore_main(text.replace('selectEatingProjection(e,profile,hand,heldByHand)','selectEatingProjection(e,profile,hand,undefined)',1))
 def test_helpers_pinned_java_geometry_texture_and_all_stages(self):
  import build_java_eating_projection as g,build_java_dual_eating_projection as dual
  from PIL import Image
  for r in layer.contract()['routes']:
   assets,geo,texture=dual.piece_assets(g,r['id'],r['profile'])
   for path,expected in assets.items():
    if isinstance(expected,bytes):self.assertEqual(Image.open(io.BytesIO(expected)).convert('RGBA').tobytes(),Image.open(path).convert('RGBA').tobytes())
    else:
     actual=json.loads(path.read_text());self.assertEqual(actual,expected)
     for stage in range(3 if r['profile']=='ONE' else 4):
      # Java fixedModel chooses by item+profile, never bite stage; all stages retain this source helper.
      self.assertEqual(actual['minecraft:geometry'][0]['bones'][0]['binding'],"q.item_slot_to_bone_name(context.item_slot == 'main_hand' ? 'off_hand' : 'main_hand')")
 def test_all_other_runtime_blobs_unchanged_after_inverse(self):
  base=layer.contract()['base_commit'];owned={str(layer.PLAYER.relative_to(ROOT)),'projects/grilling/gameplay_core/resource_pack/models/entity/java_eating_piece/grilled_caterpillar_skewer.geo.json','projects/grilling/gameplay_core/resource_pack/textures/java_eating_piece/grilled_caterpillar_skewer.png'}
  for line in subprocess.check_output(['git','ls-tree','-r',base,'projects/grilling/gameplay_core/behavior_pack','projects/grilling/gameplay_core/resource_pack'],cwd=ROOT,text=True).splitlines():
   meta,p=line.split('\t');data=(ROOT/p).read_bytes()
   if p==str(layer.MAIN.relative_to(ROOT)):data=layer.restore_main(data.decode()).encode()
   elif p in layer.contract()['predecessors']:data=(json.dumps(layer.strip_document(json.loads(data)),ensure_ascii=False,indent=2)+'\n').encode()
   actual=hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest();self.assertEqual(actual,meta.split()[2],p)
  from eating_route_extraction import validate_resolver
  owned.add(validate_resolver())
  untracked=subprocess.check_output(['git','ls-files','--others','--exclude-standard'],cwd=ROOT,text=True).splitlines();self.assertLessEqual({p for p in untracked if '/resource_pack/'in p or'/behavior_pack/'in p},owned)
if __name__=='__main__':unittest.main()
