"""Source/export and state-selection regressions; not engine-renderer emulation."""
import json,subprocess,unittest,math,re
from pathlib import Path
from build_oil_brush_visuals import ROOT,RP,outputs,IDLE,TYPES,SOURCE,generated_pose,display_bones
from held_pose_frames import chain,translate,xyz,zyx,scale,rotate,mul,bone_matrix,native_skewer_calibration
from native_skewer_icons import encode
class OilBrushAssets(unittest.TestCase):
 def test_shared_allocation_matches_server_and_property_bounds(self):
  from held_visual_channels import verify_owner_marker_allocation,verify_server_constants,verify_oil_server_constants,OIL_BRUSH,OIL_POT_IDLE
  owners=verify_owner_marker_allocation();verify_server_constants();verify_oil_server_constants()
  self.assertEqual((OIL_BRUSH,OIL_POT_IDLE),(225,226))
  self.assertEqual(owners['secret'] & {221,222,223,224},{221,222,223,224})
  props=json.loads((ROOT/'projects/grilling/gameplay_core/behavior_pack/entities/player.json').read_text())['minecraft:entity']['description']['properties']
  for hand in ('main','off'):
   self.assertEqual(props[f'kaleidoscope_grilling:secret_{hand}_piece']['range'],[0,255])
   self.assertEqual(props[f'kaleidoscope_grilling:bottle_{hand}_1']['range'],[0,683220])

 def test_exact_generated_sources_and_no_player_replacement(self):
  for path,data in outputs().items():self.assertEqual((ROOT/path).read_bytes(),encode(data),str(path))
  self.assertFalse((ROOT/RP/'entity/player.entity.json').exists())
  self.assertEqual(len(json.loads((ROOT/'projects/grilling/gameplay_core/behavior_pack/entities/player.json').read_text())['minecraft:entity']['description']['properties']),32)
 def test_generated_molang_has_no_scientific_notation_literals(self):
  scientific=re.compile(r'(?<![A-Za-z_])[+-]?(?:\d+\.?\d*|\.\d+)[eE][+-]?\d+')
  def check(value,path):
   if isinstance(value,str):self.assertIsNone(scientific.search(value),path+': '+value)
   elif isinstance(value,dict):
    for key,item in value.items():check(item,path+'/'+key)
   elif isinstance(value,list):
    for index,item in enumerate(value):check(item,path+'/'+str(index))
  for path,value in outputs().items():check(value,str(path))
 def test_geometry_uv_thickness_and_bound_scope(self):
  for path,g in outputs().items():
   if 'minecraft:geometry' not in g:continue
   g=g['minecraft:geometry'][0];self.assertEqual(g['description']['texture_width'],16)
   grip=g['bones'][0];b=g['bones'][-1];self.assertEqual(grip['binding'],'q.item_slot_to_bone_name(context.item_slot)');self.assertEqual(b['parent'],'source_z');self.assertTrue(all(n['pivot']==[0,0,0] for n in g['bones'][1:]))
   shell=b['cubes'][0];self.assertEqual(shell['size'],[16,16,1]);self.assertEqual(shell['origin'],[-8,16,-.5]);self.assertEqual(shell['uv']['north']['uv_size'],[-16,16]);self.assertEqual(shell['uv']['south']['uv_size'],[16,16])
 def test_idle_and_brush_use_same_static_association_and_complete_render_arrays(self):
  for name in ('oil_pot','oil_pot_filled'):
   d=json.loads((ROOT/RP/'attachables'/f'grilling_{name}_brush.attachable.json').read_text())['minecraft:attachable']['description']
   self.assertEqual(d['item'],{d['identifier']:"q.is_owner_identifier_any('minecraft:player')"})
   self.assertEqual(len(d['geometry']),8);self.assertEqual(len(d['textures']),8)
   self.assertEqual(set(d['animations']),{'fp_right','fp_left','tp_right','tp_left'})
   self.assertEqual(d['render_controllers'],['controller.render.kg_oil_brush'])
 def test_actual_molang_selection_all_types_hands_and_invalid_frames(self):
  files=[str(ROOT/RP/'attachables'/f'grilling_{n}_brush.attachable.json') for n in ('oil_pot','oil_pot_filled')]
  code=r"""
const fs=require('fs');let cases=0;Math.mod=(a,b)=>a%b;Math.clamp=(a,l,h)=>Math.max(l,Math.min(h,a));
for(const [fallback,file] of JSON.parse(process.argv[1]).entries()){
 const d=JSON.parse(fs.readFileSync(file))['minecraft:attachable'].description;
 const source=d.scripts.pre_animation.join('\n').replaceAll('c.owning_entity->q.','owner.').replaceAll('math.','Math.');
 const run=Function('c','owner','v','const q={delta_time:0};'+source+'return v.kg_oil_brush_model;');
 for(const hand of ['main','off'])for(const marker of Array.from({length:256},(_,i)=>i))for(let word=-1;word<=61;word++){
  const props={};props['kaleidoscope_grilling:secret_'+hand+'_piece']=marker;props['kaleidoscope_grilling:bottle_'+hand+'_0']=word;
  // Opposite hand is valid-but-different and must never be selected.
  const opposite=hand==='main'?'off':'main';props['kaleidoscope_grilling:secret_'+opposite+'_piece']=225;props['kaleidoscope_grilling:bottle_'+opposite+'_0']=60;
  const actual=run({item_slot:hand+'_hand'},{has_property:k=>k in props,property:k=>props[k]},{});
  const expected=marker===225&&word>=1&&word<=60?5+Math.floor((word-1)/20):marker===226&&word>=0&&word<=4?word:fallback;
  if(actual!==expected)throw Error(JSON.stringify({hand,marker,word,actual,expected}));cases++;
 }
 if(run({item_slot:'main_hand'},{has_property:()=>false,property:()=>{throw Error('unguarded')}},{})!==fallback)throw Error('missing property fallback');
}process.stdout.write(String(cases));
"""
  self.assertEqual(subprocess.check_output(['node','-e',code,json.dumps(files)],text=True),'64512')
 def test_shared_packet_phase_delays_skips_and_stale_bound(self):
  files=[str(ROOT/RP/'attachables/grilling_oil_pot_brush.attachable.json'),str(ROOT/RP/'animations/oil_brush_player.animation.json')]
  code=r"""
const fs=require('fs');const files=JSON.parse(process.argv[1]);const d=JSON.parse(fs.readFileSync(files[0]))['minecraft:attachable'].description;
const source=d.scripts.pre_animation.join('\n').replaceAll('c.owning_entity->q.','owner.');
const clips=JSON.parse(fs.readFileSync(files[1])).animations;
const math={floor:Math.floor,mod:(a,b)=>a%b,min:Math.min,clamp:(a,l,h)=>Math.max(l,Math.min(h,a)),sin:a=>Math.sin(a*Math.PI/180)};
const run=Function('c','owner','v','q','math',source);let cases=0;
for(const hand of ['main','off'])for(let type=0;type<3;type++){
 let v={},marker=225,word=1+type*20;
 const owner={has_property:()=>true,property:k=>k.includes('piece')?marker:word};
 const step=dt=>run({item_slot:hand+'_hand'},owner,v,{delta_time:dt},math);
 const side=hand==='main'?1:-1,arm=hand==='main'?'rightarm':'leftarm';
 const clip=clips['animation.kg_oil_brush.player.'+hand];if(clip.loop!==false||clip.animation_length!==2)throw Error('unbounded player');
 // Repeat, skip forward, delay and restart authoritative values. Both visual
 // components must read exactly this word rather than separate local clocks.
 for(const tick of [0,0,1,1,4,5,5,9,13,19,0,1,7,19]){
  word=1+20*type+tick;step(.12);
  const swing=Math.sin(tick/20*2*Math.PI);if(Math.abs(v.kg_oil_brush_sine-swing)>1e-10)throw Error('attachable source phase');
  const expected=[-1.32,side*.18+swing*.70,side*(.1+swing*.42)];
  clip.bones[arm].rotation.forEach((expr,i)=>{
   const actual=Function('v','q','math','return '+expr)({is_first_person:0},owner,math);
   if(Math.abs(actual-expected[i]*180/Math.PI)>1e-9)throw Error('player phase mismatch');cases++;
  });
 }
 step(2.1);if(v.kg_oil_brush_active||v.kg_oil_brush_model!==0)throw Error('stale brush leak');
 word=1+20*type;step(.01);if(!v.kg_oil_brush_active||Math.abs(v.kg_oil_brush_sine)>1e-10)throw Error('restart');
 marker=226;word=2;step(.01);if(v.kg_oil_brush_active||v.kg_oil_brush_model!==2)throw Error('authoritative restore');
}process.stdout.write(String(cases));
"""
  self.assertEqual(subprocess.check_output(['node','-e',code,json.dumps(files)],text=True),'252')
 def test_source_motion_matches_java_matrices_both_hands(self):
  display=json.loads((SOURCE/'generated.json').read_text())['display']
  def evaluate(expr,swing,active=True):
   if not isinstance(expr,str):return expr
   if ' ? ' in expr:
    yes,no=expr.split(' ? ',1)[1].split(' : ',1);expr=yes if active else no
   expr=expr.replace('v.kg_oil_brush_sine',str(swing))
   for f in ('sin','cos'):expr=expr.replace('math.'+f,f)
   return eval(expr,{'__builtins__':{}},{'sin':lambda v:math.sin(math.radians(v)),'cos':lambda v:math.cos(math.radians(v))})
  for view,context in [('fp','firstperson_righthand'),('tp','thirdperson_righthand')]:
   pose=display[context]
   for side in (1,-1):
    bones=display_bones(pose,view,side)
    tr=[side*pose['translation'][0],*pose['translation'][1:]];r=[pose['rotation'][0],side*pose['rotation'][1],side*pose['rotation'][2]]
    suffix=chain(translate(tr),xyz(r),scale(pose['scale']),translate([-8,-8,-8]),translate([8,-16,8]))
    for i in range(201):
     swing=math.sin(i/200*math.tau)
     matrices=[bone_matrix({c:[evaluate(v,swing) for v in values] for c,values in b.items()}) for b in bones.values()]
     if view=='fp':
      base,camera=native_skewer_calibration('right' if side==1 else 'left')
      expected=chain(camera,translate([side*8.32+swing*4,-7.68,-12.48]),rotate('x',-24),rotate('y',180),rotate('z',side*(32+swing*34)),suffix)
     else:
      arm=zyx([1.32*180/math.pi,-(side*.18+swing*.70)*180/math.pi,side*(.10+swing*.42)*180/math.pi])
      base=chain(translate([5*side,22,0]),arm,translate([side,-31,1]))
      expected=chain(translate([6*side,22,0]),arm,translate([0,-10,-2]),rotate('x',-90),rotate('z',side*swing*16),suffix)
     actual=chain(base,*matrices)
     for row1,row2 in zip(actual,expected):
      for x,y in zip(row1,row2):self.assertAlmostEqual(x,y,places=6)
    # Inactive hierarchy preserves the previous exact source-generated idle.
    idle=chain(*(bone_matrix({c:[evaluate(v,0,False) for v in values]for c,values in b.items()})for b in bones.values()))
    old=generated_pose(pose,view,side)
    original=chain(translate([-old['position'][0],old['position'][1],old['position'][2]]),translate([0,24,0]),bone_matrix({'rotation':old['rotation'],'scale':old['scale']}),translate([0,-24,0]))
    for a,b in zip(idle,original):
     for x,y in zip(a,b):self.assertAlmostEqual(x,y,places=6)
 def test_dedicated_source_sine_clip_and_legacy_unchanged(self):
  animations=json.loads((ROOT/RP/'animations/oil_brush_player.animation.json').read_text())['animations']
  for hand,side in [('main',1),('off',-1)]:
   new=animations['animation.kg_oil_brush.player.'+hand];self.assertEqual(new['animation_length'],2.0);self.assertFalse(new['loop'])
   arm='rightarm' if side==1 else 'leftarm';item='rightitem' if side==1 else 'leftitem'
   self.assertEqual(set(new['bones']),{arm,item});self.assertTrue(new['override_previous_animation'])
   self.assertNotIn('q.anim_time',json.dumps(new));self.assertIn('q.property',json.dumps(new))
   self.assertEqual(new['bones'][item]['rotation'],[0,0,0])
  prior=subprocess.check_output(['git','show','aa091a1e91035d1510b579af11254a9bc9f86e6b:'+str(RP/'animations/player_binding.animation.json')],cwd=ROOT)
  self.assertEqual(prior,(ROOT/RP/'animations/player_binding.animation.json').read_bytes())
if __name__=='__main__':unittest.main()
