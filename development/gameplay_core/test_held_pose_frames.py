"""Independent frame/visibility checks; client rendering remains a separate gate."""
import itertools
import json
import math
import re
import sys
import unittest
from held_pose_frames import (RP, expected_animations, make_pose, bone_matrix, chain,
    translate, rotate, point, rigid_inverse, calibration, native_skewer_calibration, zyx)
sys.path.insert(0,str(RP.parents[3]/'tools'))
from build_plate_held import animations as plate_animations

def plate_layout_value(value,count):
    """Read the generated count selector, without simulating any player API."""
    if isinstance(value,(int,float)):return value
    while True:
        branch=re.fullmatch(r'v\.kg_plate_count == ([0-5]) \? (-?\d+(?:\.\d+)?) : (.+)',value)
        if not branch:return float(value)
        if int(branch[1])==count:return float(branch[2])
        value=branch[3]

def plate_child_matrix(combined,geometry,layout,count):
    if geometry['description']['identifier']=='geometry.kg_plate_held.body':return combined
    result=chain(combined,translate([0,24,0]))
    # These are the actual generated ancestor bones, in their declared order.
    for bone in geometry['bones'][2:-1]:
        pose=layout[bone['name']]
        resolved={key:[plate_layout_value(x,count) for x in value] if isinstance(value,list)
                  else plate_layout_value(value,count) for key,value in pose.items()}
        result=chain(result,bone_matrix(resolved))
    return chain(result,translate([0,-24,0]))

class HeldPoseFrameTests(unittest.TestCase):
    def test_runtime_is_reproducible_and_not_raw_java_euler(self):
        expected=expected_animations()
        for filename in ('a287_skewer_held.animation.json','a286_held.animation.json'):
            for name,body in json.loads((RP/'animations'/filename).read_text())['animations'].items():
                self.assertEqual(body,expected[name])
        # Independent values obtained from native Blockbench Java and Bedrock
        # frame comparison, not from the old copied-Euler implementation.
        rot=expected['animation.kg_a287.skewer_tp_right']['bones']['skewer_pose']['rotation']
        for a,b in zip(rot,[171.60178562,-2.24451015,174.78346239]):self.assertAlmostEqual(a,b,places=7)

    def test_skewer_points_forward_instead_of_up_the_arm(self):
        for hand in ('right','left'):
            pose=make_pose('skewer','tp',hand)['skewer_pose']
            m=chain(rotate('x',15),bone_matrix(pose))
            direction=[m[i][2]/.8 for i in range(3)]
            self.assertLess(direction[2],-.9)
            self.assertLess(abs(direction[1]),.35)
        old={'rotation':[-98.57,1.45,-174.51],'scale':[.8]*3}
        matrix=chain(rotate('x',15),bone_matrix(old))
        self.assertGreater(matrix[1][2]/.8,.95) # reproduces arm occlusion

    def test_every_held_geometry_has_finite_visible_first_person_bounds(self):
        index={g['description']['identifier']:g for p in (RP/'models').rglob('*.json')
               for g in json.loads(p.read_text()).get('minecraft:geometry',[])}
        expected=expected_animations();checked=0
        plate=plate_animations()['animations']
        plate_file=RP/'animations/plate_held.animation.json'
        if plate_file.exists():
            self.assertEqual(json.loads(plate_file.read_text())['animations'],plate)
            expected.update(plate)
        for p in (RP/'attachables').glob('*.json'):
            desc=json.loads(p.read_text())['minecraft:attachable']['description']
            for hand in ('right','left'):
                bones=expected[desc['animations']['fp_'+hand]]['bones']
                base,camera=(native_skewer_calibration(hand) if desc['animations']['fp_'+hand].startswith(('animation.kg_a287.skewer','animation.kg_a286.bottle','animation.kg_plate_held.')) else calibration(hand))
                combined=chain(rigid_inverse(camera),base,translate([0,24,0]))
                for bone in bones.values():combined=chain(combined,bone_matrix(bone))
                combined=chain(combined,translate([0,-24,0]))
                for ref in set(desc['geometry'].values()):
                    if ref=='geometry.kg_probe_caterpillar.piece':
                        # The exact new helper is use-only, never an idle mesh.
                        from build_caterpillar_eating_projection import ACTIVE,PIECE
                        from verify_a287 import expression
                        self.assertEqual(desc['identifier'],'kaleidoscope_grilling:grilled_caterpillar_skewer')
                        self.assertEqual(desc['geometry']['probe_piece'],ref)
                        self.assertIn(PIECE,desc['render_controllers'])
                        self.assertEqual(desc['scripts']['pre_animation'][-1],'v.kg_probe_piece_visible = '+ACTIVE+';')
                        self.assertFalse(expression(ACTIVE,1,'main_hand','rightitem',using=False,eat_profile=1))
                        controller=json.loads((RP/'render_controllers/kg_probe_caterpillar_piece.render_controllers.json').read_text())['render_controllers'][PIECE]
                        self.assertEqual(controller['geometry'],'Geometry.probe_piece')
                        self.assertEqual(controller['part_visibility'],[{'*':'v.kg_probe_piece_visible == 1'}])
                        continue
                    if ref.startswith('geometry.kg_java_dual.piece.'):
                        # The second RC hides food pieces while idle. Their use
                        # frame, helper socket and visibility are checked by the
                        # dedicated dual renderer suite, not the idle display.
                        self.assertEqual(ref,desc['geometry']['java_piece'])
                        self.assertEqual(ref,'geometry.kg_java_dual.piece.'+desc['identifier'].split(':')[1])
                        self.assertIn('controller.render.kg_java_eating.piece',desc['render_controllers'])
                        self.assertTrue(desc['scripts']['pre_animation'][-1].startswith('v.kg_java_piece_visible = '))
                        self.assertIn('q.is_using_item',desc['scripts']['pre_animation'][-1])
                        continue
                    geometry=index[ref];counts=[None]
                    if ref.startswith('geometry.kg_plate_held.'):
                        self.assertEqual(desc['identifier'],'kaleidoscope_grilling:skewer_plate')
                        # A row is checked only in source layouts in which it is
                        # present; body coordinates do not depend on the count.
                        counts=[0] if ref.endswith('.body') else range(int(geometry['bones'][-1]['name'].rsplit('_',1)[1])+1,6)
                    for count in counts:
                        local=combined if count is None else plate_child_matrix(combined,geometry,plate['animation.kg_plate_held.layout']['bones'],count)
                        positions=[]
                        for bone in geometry['bones']:
                            for cube in bone.get('cubes',[]):
                                origin=cube['origin'];size=cube['size']
                                pivot=cube.get('pivot',[0,0,0]);pivot=[-pivot[0],pivot[1],pivot[2]]
                                rotation=cube.get('rotation',[0,0,0])
                                cm=chain(local,translate(pivot),zyx([-rotation[0],-rotation[1],rotation[2]]),translate([-x for x in pivot]))
                                for corner in itertools.product((0,1),repeat=3):
                                    v=[origin[i]+corner[i]*size[i]for i in range(3)];v[0]*=-1
                                    positions.append(point(cm,v))
                        if (ref.startswith('geometry.kg_secret_held.part_') and ref.endswith('_0')) or ref.startswith('geometry.kg_plate_held.empty_'):
                            self.assertFalse(positions,ref) # Empty fallback models deliberately contain no cubes.
                            continue
                        self.assertTrue(positions,ref)
                        self.assertTrue(all(math.isfinite(v)for pnt in positions for v in pnt),ref)
                        visible=[v for v in positions if v[2]<-.1 and abs(v[0]/v[2])<1.3 and abs(v[1]/v[2])<.75]
                        self.assertTrue(visible,(desc['identifier'],hand,ref,count))
                        checked+=1
        self.assertGreater(checked,400)

    def test_single_bound_root_and_no_player_override(self):
        self.assertFalse((RP/'entity/player.entity.json').exists())
        self.assertFalse((RP/'entity/player.json').exists())
        for p in (RP/'models/entity/a287_hand').glob('*.json'):
            bones=json.loads(p.read_text())['minecraft:geometry'][0]['bones']
            self.assertEqual(sum(bool(b.get('binding'))for b in bones),1)

if __name__=='__main__':unittest.main()
