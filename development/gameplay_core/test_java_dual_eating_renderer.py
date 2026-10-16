"""Committed runtime renderer and subscriber contracts; no native pixel proof."""
import itertools
import json
from pathlib import Path
import re
import sys
import unittest
from PIL import Image
import java_dual_eating_frames as dual
from held_pose_frames import chain, translate, rotate, bone_matrix
from java_active_eating_frames import REFLECT
from test_eating_observer_projection import node

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools'))
import build_java_eating_projection as generator
from build_java_dual_eating_projection import REPRESENTATIVES,PIECE_BINDING,PIECE_CONTROLLER,one_right_vertical_alignment
RP=generator.RP

def load(path):return json.loads(path.read_text())

def value(expression,pivots,slim):
    if not isinstance(expression,str):return expression
    # This contract checks the original fixed representatives, whose exact
    # identity never enables the owned Secret calibration in a shared clip.
    expression=re.sub(r"\(q.is_item_name_any\('slot.weapon.(?:mainhand|offhand)','kaleidoscope_grilling:secret_skewer'\) \? 3\.41 : 0\)",'0',expression)
    expression=re.sub(r"q.get_default_bone_pivot\('([^']+)',\s*(\d)\)",lambda m:str(pivots[m[1]][int(m[2])]),expression)
    expression=re.sub(r"\(math.abs\(.*?\) < 0.01 \? ([^ ]+) : 0\)",lambda m:m[1] if slim else '0',expression)
    if not re.fullmatch(r'[\d.+\- ()]+',expression):raise ValueError(expression)
    return eval(expression,{'__builtins__':{}})

class DualEatingRenderer(unittest.TestCase):
    def test_one_right_alignment_is_pinned_view_plane_only(self):
        fixture=load(ROOT/'development/gameplay_core/fixtures/fish-one-vertical-alignment-g66-private.json')
        actual=one_right_vertical_alignment(generator)
        for a,b in zip(actual,fixture['expected_alignment']):self.assertAlmostEqual(a,b,places=8)
        self.assertEqual(actual[0],0)
        self.assertEqual(actual[2],0)
        self.assertTrue(fixture['retained_depth'])

    def test_one_serialized_helper_remains_constant_after_source_last_knot(self):
        items=load(RP/'animations/java_eating_projection.animation.json')['animations']
        players=load(RP/'animations/java_eating_player.animation.json')['animations']
        for hand in ('right','left'):
            piece=items[generator.item_animation_id('ONE',hand)]['bones']['dual_piece']
            helper='left' if hand=='right' else 'right'
            bones=players[generator.player_animation_id('ONE',hand)]['bones']
            for channels in (piece,bones[helper+'arm'],bones[helper+'item']):
                for name,values in channels.items():
                    if not isinstance(values,dict):continue
                    self.assertIn('2.75',values)
                    for key,value in values.items():
                        if float(key)>=2.75:self.assertEqual(value,values['2.75'],(hand,name,key))
            self.assertEqual(piece['scale'],['v.kg_eat_seconds >= 1.16667 ? 1 : 0']*3)

    def test_serialized_both_arms_sockets_and_meshes_match_java(self):
        items=load(RP/'animations/java_eating_projection.animation.json')['animations']
        players=load(RP/'animations/java_eating_player.animation.json')['animations']
        camera=chain(translate([0,24,0]),rotate('y',180))
        alignment=load(ROOT/'development/gameplay_core/fixtures/fish-one-vertical-alignment-g66-private.json')['expected_alignment']
        cases=0
        for profile,hand,slim in itertools.product(dual.PROFILES,('right','left'),(False,True)):
            sign=1 if hand=='right' else -1
            pivots={'rightarm':[-5,21.5 if slim else 22,0], 'leftarm':[5,21.5 if slim else 22,0],
                    'rightitem':[-6,15,1], 'leftitem':[6,15,1]}
            mesh=items[generator.item_animation_id(profile,hand)]['bones']
            bones=players[generator.player_animation_id(profile,hand)]['bones']
            for active,name,side,child in [(True,hand,sign,'skewer_pose'),(False,'left' if hand=='right' else 'right',-sign,'dual_piece')]:
                arm=name+'arm';socket=name+'item'
                self.assertEqual(set(bones),{'rightarm','leftarm','rightitem','leftitem'})
                for key,positions in mesh[child]['position'].items():
                    t=float(key)
                    arm_position=[value(v,pivots,slim)+p for v,p in zip(bones[arm]['position'][key],pivots[arm])]
                    arm_matrix=bone_matrix({'position':arm_position,'rotation':bones[arm]['rotation'][key]})
                    local=[value(v,pivots,slim)+p-a for v,p,a in zip(bones[socket]['position'][key],pivots[socket],pivots[arm])]
                    socket_matrix=bone_matrix({'position':local,'rotation':bones[socket]['rotation'],'scale':bones[socket]['scale']})
                    size=([1 if t>=1.16667 else 0]*3 if profile=='ONE' else mesh[child]['scale'][key]) if not active else mesh[child]['scale']
                    child_matrix=bone_matrix({'position':positions,'rotation':mesh[child]['rotation'][key],'scale':size})
                    actual=chain(arm_matrix,socket_matrix,child_matrix,translate([0,-24,0]))
                    expected=chain(camera,translate([0,-16*1.62,0]),REFLECT,translate([0,-24.016,0]),
                                   dual.java_arm(profile,t,side,active,slim),dual.java_item_child(profile,t,side,active),translate([0,-32,0]))
                    if profile == 'ONE' and hand == 'right':
                        expected=chain(translate(alignment),expected)
                    error=max(abs(actual[i][j]-expected[i][j]) for i in range(4) for j in range(4))
                    self.assertLess(error,3e-6,(profile,hand,slim,active,t))
                    cases+=1
        self.assertGreater(cases,4000)

    def test_exact_java_piece_assets_and_main_bite_assets_preserved(self):
        eligibility=json.loads(re.search(r'Object.freeze\((\[.*\])\)',(generator.BP/'scripts/java_eating_projection_items.js').read_text())[1])
        self.assertEqual(set(eligibility),{item for rows in generator.projection_items().values() for item in rows})
        self.assertTrue(set(REPRESENTATIVES).issubset(eligibility))
        for identifier,profile in REPRESENTATIVES.items():
            name=identifier.split(':')[1]
            desc=load(RP/'attachables'/(name+'.attachable.json'))['minecraft:attachable']['description']
            self.assertEqual(desc['render_controllers'],['controller.render.kg_a22.bite',PIECE_CONTROLLER])
            self.assertEqual(set(desc['geometry'])-{'java_piece'},{'stage0','stage1','stage2','stage3','stage4'})
            piece=load(RP/'models/entity/java_eating_piece'/(name+'.geo.json'))['minecraft:geometry'][0]
            self.assertEqual(piece['bones'][0],{'name':'grip','pivot':[0,24,0],'binding':PIECE_BINDING})
            self.assertEqual(piece['bones'][1]['parent'],'grip')
            # Exact vertices of the pinned Java representative pieces, with the
            # existing converter's reflected X and translated hand pivot.
            expected=([-1,31.25,-1],[2,1.5,2]) if profile=='ONE' else ([-1.5,30.5,-1.5],[3,3,3])
            self.assertEqual([(c['origin'],c['size']) for c in piece['bones'][1]['cubes']],[expected])
            texture=ROOT/'projects/grilling/source_snapshots/common/src/main/resources/assets/kaleidoscope_grilling/textures/item/fixed_skewers'
            folder='fish' if profile=='ONE' else 'ender_pearl'
            with Image.open(RP/'textures/java_eating_piece'/(name+'.png')) as actual, Image.open(texture/(folder+'_skewer_cooked.png')) as source:
                self.assertEqual(actual.convert('RGBA').tobytes(),source.convert('RGBA').tobytes())

    def test_piece_rendering_is_local_exact_and_fails_closed_on_cancel_swap_and_other_hand(self):
        descriptions={name:load(RP/'attachables'/(name.split(':')[1]+'.attachable.json'))['minecraft:attachable']['description'] for name in REPRESENTATIVES}
        node('''
const descriptions='''+json.dumps(descriptions)+''';
for(const [id,d] of Object.entries(descriptions))for(const hand of [1,2]){
 let held=id,using=true,first=1,helper=false,profile=id.includes('fish')?1:3,projection=1,eatHand=hand;
 const properties=()=>({eat_profile:profile,eat_hand:eatHand,eat_projection:projection,eat_native_ticks:64,eat_elapsed_ticks:20});
 const slot=hand===1?'main_hand':'off_hand',other=hand===1?'off_hand':'main_hand';
 const c={get is_first_person(){return first},item_slot:slot};
 const q={get is_using_item(){return using},is_sneaking:0,is_swimming:0,is_gliding:0,is_riding:0,
 main_hand_item_use_duration:44,frame_alpha:0,
 has_property:name=>Object.hasOwn(properties(),name.split(':')[1]),
 property:name=>properties()[name.split(':')[1]],
 is_item_name_any:(_slot,...names)=>names.includes(held),is_item_equipped:s=>s===other&&helper?1:0};
 c.owning_entity=q;
 const math={clamp:(value,min,max)=>Math.max(min,Math.min(max,value))};
 const v={}; const evaluate=()=>{evaluatePreAnimation(d.scripts.pre_animation,q,c,math,v);return Boolean(v.kg_java_piece_visible)};
 if(!evaluate())throw Error('Representative piece not wired');
 for(const change of [()=>using=false,()=>first=0,()=>held='minecraft:apple',()=>helper=true,()=>profile=4,()=>projection=0,()=>eatHand=0]){
  change();if(evaluate())throw Error('Piece leaked after changed state');
  held=id;using=true;first=1;helper=false;profile=id.includes('fish')?1:3;projection=1;eatHand=hand;
 }
}
''')
        controller=load(RP/'render_controllers/java_eating_piece.render_controllers.json')['render_controllers'][PIECE_CONTROLLER]
        self.assertEqual(controller['geometry'],'Geometry.java_piece')
        self.assertEqual(controller['textures'],['Texture.java_piece'])
        self.assertEqual(controller['part_visibility'],[{'*':'v.kg_java_piece_visible == 1'}])
        for name in REPRESENTATIVES:
            d=descriptions[name]
            for hand in ('right','left'):
                self.assertEqual(d['animations']['fp_eat_'+hand],generator.item_animation_id(REPRESENTATIVES[name],hand))
        anim=load(RP/'animations/java_eating_projection.animation.json')['animations']
        for hand in ('right','left'):
            self.assertEqual(anim[generator.item_animation_id('ONE',hand)]['bones']['dual_piece']['scale'],['v.kg_eat_seconds >= 1.16667 ? 1 : 0']*3)

if __name__=='__main__':unittest.main()
