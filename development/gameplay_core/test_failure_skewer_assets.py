"""Independent source/selector/UV oracle and executable owner-expression tests.
No converter import for asset verification. No claim of native renderer acceptance.
"""
from pathlib import Path
from functools import lru_cache
import copy,hashlib,json,re,subprocess,sys,unittest
from PIL import Image
ROOT=Path(__file__).resolve().parents[2];RP=ROOT/'projects/grilling/gameplay_core/resource_pack';FIX=ROOT/'development/gameplay_core/fixtures/java-failure-skewer-9a1acdab';ASSETS=FIX/'common/src/main/resources/assets'
N='kaleidoscope_grilling:';NAMES=('mysterious_skewer','dark_grilling')
def read(p):return json.loads(p.read_text())
def resource(ref,kind):
 ns,name=ref.split(':',1);return ASSETS/ns/kind/(name+('.json'if kind=='models'else'.png'))
@lru_cache(maxsize=None)
def resolve(ref):
 own=read(resource(ref,'models'));parent=copy.deepcopy(resolve(own['parent']))if 'parent'in own else{}
 for k,v in own.items():
  if k!='parent':parent[k]={**parent.get(k,{}),**v}if k in ('textures','display')else v
 return parent

def texture(ref,aliases):
 seen=set()
 while ref.startswith('#'):
  assert ref not in seen;seen.add(ref);ref=aliases[ref[1:]]
 return ref

def selected(root,source,state,bite):
 values={N+'failed_skewer_source':source/32,N+'skewer_state':state/64,N+'skewer_bite_stage':bite/4}
 return next((row['model']for row in reversed(resolve(root)['overrides'])if all(values[k]>=v for k,v in row['predicate'].items())),root)

def check_selector(name,controller,description):
 root=N+'item/'+name;models=[root]+[r['model']for r in resolve(root)['overrides']]
 for source in range(20):
  for state in range(64):
   for bite in range(4):
    key='Array.sources'if source else'Array.states';ix=(source if source else state)*4+bite
    model=selected(root,source,state,bite);expected=models.index(model)
    assert controller['arrays']['geometries'][key][ix]=='Geometry.model_'+str(expected),(source,state,bite)
    assert controller['arrays']['textures'][key][ix]=='Texture.model_'+str(expected),(source,state,bite)
    assert description['geometry']['model_'+str(expected)]=='geometry.kg_failure_held.'+name+'_'+str(expected)

class FailureAssets(unittest.TestCase):
 def test_exact_source_manifest_and_no_vanilla_redistribution(self):
  manifest=read(FIX/'source-manifest.json');self.assertEqual(manifest['commit'],'9a1acdab27698457bec16c9362678e574895a28c')
  for path,row in manifest['files'].items():
   data=(FIX/path).read_bytes();self.assertEqual(hashlib.sha256(data).hexdigest(),row['sha256'],path);self.assertEqual(hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest(),row['git_blob_sha1'])
  self.assertFalse((ASSETS/'minecraft').exists());self.assertTrue((FIX/'LICENSE-ASSETS').is_file());self.assertTrue((FIX/'LICENSE-CODE').is_file())
  attribution=(ROOT/'projects/grilling/ATTRIBUTION.md').read_text();self.assertIn('Failure-skewer source alignment candidate',attribution);self.assertIn('java-failure-skewer-9a1acdab',attribution);self.assertIn('BSD 3-Clause',attribution);self.assertIn('https://creativecommons.org/licenses/by-nc-sa/4.0/',attribution)
  self.assertEqual({p.relative_to(FIX).as_posix()for p in FIX.rglob('*')if p.is_file()},set(manifest['files'])|{'source-manifest.json'})
 def test_runtime_source_list_matches_pinned_registry_order(self):
  java=(FIX/'forge-1.20.1/src/main/java/cn/breezeth/kaleidoscope_grilling/registry/ModItems.java').read_text().split('  static {',1)[1].split('\n  private static',1)[0]
  expected=[N+x for x in re.findall(r'(?:rawSkewer|animatedRawSkewer)\(\s*"([^"]+)"',java)+['raw_lamb_skewer','raw_golden_skewer']]
  runtime=(ROOT/'projects/grilling/gameplay_core/behavior_pack/scripts/failure_skewer_visual_core.js').read_text()
  actual=json.loads(re.search(r'FAILURE_RAW_SOURCES=Object.freeze\((\[.*?\])\)',runtime).group(1));self.assertEqual(actual,expected)
 def test_all_selected_models_and_mutated_selector_rejected(self):
  controllers=read(RP/'render_controllers/failure_skewer_held.render_controllers.json')['render_controllers']
  for name in NAMES:
   c=controllers['controller.render.kg_failure_held.'+name];d=read(RP/'attachables'/f'{name}.attachable.json')['minecraft:attachable']['description'];check_selector(name,c,d)
   bad=copy.deepcopy(c);bad['arrays']['geometries']['Array.sources'][19*4]='Geometry.model_0'
   with self.assertRaises(AssertionError):check_selector(name,bad,d)
 def test_every_mesh_and_full_atlas_rgba_against_independent_source_projection(self):
  geometries={g['description']['identifier']:g for g in read(RP/'models/entity/failure_skewer_held.geo.json')['minecraft:geometry']};faces=0
  for name in NAMES:
   d=read(RP/'attachables'/f'{name}.attachable.json')['minecraft:attachable']['description'];root=N+'item/'+name
   for index,mid in enumerate([root]+[r['model']for r in resolve(root)['overrides']]):
    model=resolve(mid);g=geometries[d['geometry']['model_'+str(index)]];cubes=[c for b in g['bones']for c in b.get('cubes',[])];self.assertEqual(len(cubes),len(model['elements']),mid)
    self.assertEqual(g['bones'][0]['binding'],'q.item_slot_to_bone_name(context.item_slot)')
    with Image.open(RP/(d['textures']['model_'+str(index)]+'.png'))as im:atlas=im.convert('RGBA')
    refs=sorted({texture(f['texture'],model['textures'])for e in model['elements']for f in e['faces'].values()});rect={};x=0
    for ref in refs:
     with Image.open(resource(ref,'textures'))as im:source=im.convert('RGBA')
     rect[ref]=(x,source.width,source.height);self.assertEqual(atlas.crop((x,0,x+source.width,source.height)).tobytes(),source.tobytes(),mid);x+=source.width
    self.assertEqual(atlas.size,(x,max(v[2]for v in rect.values())))
    for e,c in zip(model['elements'],cubes):
     a,b=e['from'],e['to'];self.assertEqual(c['origin'],[8-b[0],a[1]+24,a[2]-8]);self.assertEqual(c['size'],[b[k]-a[k]for k in range(3)])
     rot=e.get('rotation',{});angles=[0,0,0]
     if rot.get('angle'):
      ax='xyz'.index(rot['axis']);angles[ax]=rot['angle']*(-1 if ax<2 else 1);p=rot['origin'];self.assertEqual(c['pivot'],[8-p[0],p[1]+24,p[2]-8])
     self.assertEqual(c.get('rotation',[0,0,0]),angles);self.assertFalse(rot.get('rescale'));self.assertEqual(set(c['uv']),set(e['faces']))
     for side,f in e['faces'].items():
      faces+=1;x,w,h=rect[texture(f['texture'],model['textures'])];u0,v0,u1,v1=f['uv']
      if side in ('up','down'):u0,v0,u1,v1=u1,v1,u0,v0
      expected={'uv':[x+u0*w/16,v0*h/16],'uv_size':[(u1-u0)*w/16,(v1-v0)*h/16]}
      if f.get('rotation'):expected['uv_rotation']=f['rotation']
      self.assertEqual(c['uv'][side],expected,(mid,side))
  self.assertGreater(faces,1000)
 def test_exact_predecessor_and_main_mutation_cannot_gain_old_source_acceptance(self):
  sys.path.insert(0,str(ROOT/'tools'));from build_failure_skewer_held import restore_main,patch_main,predecessor_document,PLAYER_CONTROLLER
  main=ROOT/'projects/grilling/gameplay_core/behavior_pack/scripts/main.js';base=subprocess.check_output(['git','show','b938359b:'+main.relative_to(ROOT).as_posix()],cwd=ROOT,text=True)
  from build_failure_skewer_held import predecessor_script
  from build_slime_frame_selector import strip_main as strip_slime
  from slime_frame_source_witness import reference_bytes as slime_reference
  import build_raw_one_eating_projection as raw_one
  for name in ['secret_held_runtime.js','held_visual_transport.js']:
   p=main.with_name(name);prior=subprocess.check_output(['git','show','b938359b:'+p.relative_to(ROOT).as_posix()],cwd=ROOT,text=True);self.assertEqual(slime_reference(p,predecessor_script(p,p.read_text()).encode()).decode(),prior)
  current=main.read_text();slime_reference(main,current.encode())
  from effect_merge_source_witness import restore_main as restore_effect
  predecessor=raw_one.restore_main(restore_main(strip_slime(restore_effect(current))))
  self.assertEqual(predecessor,base)
  failure_only=patch_main(predecessor)
  self.assertEqual(restore_main(failure_only),base);self.assertEqual(patch_main(failure_only),failure_only)
  self.assertEqual(patch_main(current),current)
  with self.assertRaises(ValueError):restore_main(main.read_text().replace('if(!out)return failedStack(raw,MYSTERIOUS_ID);','if(!out)return failedStack(raw,DARK_ID);'))
  controller=read(PLAYER_CONTROLLER);expected=json.loads(subprocess.check_output(['git','show','b938359b:'+PLAYER_CONTROLLER.relative_to(ROOT).as_posix()],cwd=ROOT,text=True))
  self.assertEqual(raw_one.historical_document(PLAYER_CONTROLLER,predecessor_document(PLAYER_CONTROLLER,controller)),expected)
 def test_actual_owner_scripts_boundaries_plain_cancel_and_helper(self):
  cases=[read(RP/'attachables'/f'{name}{suffix}.attachable.json')['minecraft:attachable']['description']for name in NAMES for suffix in ['','_java_three_alt','_native_plain']]
  script=r'''
const cases=CASES;
const math={floor:Math.floor,clamp:(n,a,b)=>Math.min(b,Math.max(a,n))};
const scoped=s=>s.replaceAll('c.owning_entity->q.','owner.');
for(const d of cases)for(const slot of ['main_hand','off_hand'])for(const fp of [0,1])for(const using of [false,true])for(const tick of [0,19,20,43,44,46,47,69,70,71,100])for(const marker of [220,254,214,215,219,255]){
 const plain=d.identifier.endsWith('_native_plain'),alt=d.identifier.endsWith('_java_three_alt'),profile=plain?0:alt?4:3,hand=slot==='main_hand'?1:2;
 const props={eat_profile:profile,eat_projection:1,eat_hand:hand,eat_native_ticks:alt?90:100,eat_elapsed_ticks:tick};
 for(const h of ['main','off']){for(let i=0;i<8;i++)props['bottle_'+h+'_'+i]=i===0?19:i===1?21:i===2?5:0;props['secret_'+h+'_piece']=marker;}
 const owner={has_property:n=>Object.hasOwn(props,n.split(':')[1]),property:n=>props[n.split(':')[1]]??0,is_item_name_any:(s,...ids)=>s===(hand===1?'slot.weapon.mainhand':'slot.weapon.offhand')&&ids.includes(d.identifier)};
 const q={is_using_item:using,is_sneaking:0,is_swimming:0,is_gliding:0,is_riding:0,is_item_equipped:()=>0,is_item_name_any:owner.is_item_name_any,main_hand_item_use_duration:100-tick,frame_alpha:.7};
 const c={item_slot:slot,is_first_person:fp},v={};new Function('q','c','owner','math','v',scoped([...d.scripts.initialize,...d.scripts.pre_animation].join('\n')))(q,c,owner,math,v);
 const thresholds=alt?[20,44,70]:[20,47,71],expected=plain||!using?0:thresholds.filter(t=>tick>=t).length;
 if(v.kg_bite_stage!==expected)throw Error(d.identifier+' stage '+tick+' '+v.kg_bite_stage+' expected '+expected);
 if(Boolean(v.kg_failure_ready)!==(marker===220))throw Error('owner readiness');
 if(Boolean(v.kg_failure_helper_visible)!==(!plain&&!alt&&using&&!!fp&&marker===220))throw Error('helper gate');
 const active=d.scripts.animate.filter(row=>Object.keys(row).some(k=>k.startsWith('failure_eat_'))).flatMap(Object.values).filter(expr=>new Function('q','c','owner','v','return '+scoped(expr))(q,c,owner,v));
 if(active.length!==(!plain&&using&&fp?1:0))throw Error('active/idle route overlap');
}
'''.replace('CASES',json.dumps(cases))
  subprocess.run(['node','--input-type=module'],input=script,text=True,check=True)

if __name__=='__main__':unittest.main()
