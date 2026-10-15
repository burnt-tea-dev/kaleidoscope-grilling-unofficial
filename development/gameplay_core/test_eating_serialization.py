"""Cross-platform serialization guards; no native rendering acceptance implied."""
from pathlib import Path
import json
import math
import sys
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools'))
import build_java_eating_projection as generator
from eating_owner_context import reference_bytes


class EatingSerialization(unittest.TestCase):
    def test_signed_zero_is_canonical_after_rounding(self):
        for n in (0.0,-0.0,1e-12,-1e-12):
            value=generator.rounded_channel(n)
            self.assertEqual(repr(value),'0.0')
        self.assertEqual(generator.rounded_channel(-0.001),-0.001)

    def test_initial_branch_and_later_continuity(self):
        for n in (180,-180,540,-540,180-1e-12,-180+1e-12):
            self.assertEqual(generator.initial_euler(n),-180)
        for n in (180-2e-8,-180+2e-8):
            self.assertAlmostEqual(generator.initial_euler(n),n,places=10)
        previous=generator.unwrap([0,0,179],None)
        following=generator.unwrap([0,0,-179],previous)
        self.assertEqual(following,[0,0,181])
        self.assertEqual((previous[2]+following[2])/2,180)

    def test_source_curves_keep_constant_euler_offsets_and_no_spins(self):
        item,player=generator.animations()
        for profile in generator.PROFILES:
            for hand,sign in [('right',1),('left',-1)]:
                for document,animation_id,bone,source in [
                    (item,generator.item_animation_id(profile,hand),'skewer_pose',lambda t:generator.active_child_bone(profile,t,sign,False)['rotation']),
                    (player,generator.player_animation_id(profile,hand),hand+'arm',lambda t:generator.bedrock_rotation(generator.native_arm_target(profile,t,sign)))
                ]:
                    last_old=None;last_new=None;offset=None
                    for t in generator.sample_times():
                        old=source(t)
                        if last_old is not None:old=[v+360*round((p-v)/360) for v,p in zip(old,last_old)]
                        new=document[animation_id]['bones'][bone]['rotation'][generator.number(t)]
                        delta=[round((a-b)/360) for a,b in zip(new,old)]
                        if offset is None:offset=delta
                        self.assertEqual(delta,offset)
                        for a,b,k in zip(new,old,offset):self.assertAlmostEqual(a,b+360*k,places=7)
                        if last_new is not None:
                            for a,b in zip(new,last_new):self.assertLess(abs(a-b),180)
                            # A constant 360-degree offset also preserves each
                            # interpolated midpoint, not merely endpoint matrices.
                            for a,b,c,d,k in zip(new,last_new,old,last_old,offset):
                                self.assertAlmostEqual((a+b)/2,(c+d)/2+360*k,places=7)
                        last_old=old;last_new=new

    def test_round_trip_matches_every_committed_curve(self):
        item,player=generator.animations()
        def check_zero(value):
            if isinstance(value,dict):
                for child in value.values():check_zero(child)
            elif isinstance(value,(list,tuple)):
                for child in value:check_zero(child)
            elif isinstance(value,float) and value==0:
                self.assertEqual(math.copysign(1,value),1)
        check_zero((item,player))
        for name,animations in [('java_eating_projection',item),('java_eating_player',player)]:
            path=ROOT/f'projects/grilling/gameplay_core/resource_pack/animations/{name}.animation.json'
            expected=json.dumps({'format_version':'1.8.0','animations':animations},ensure_ascii=False,indent=2)+'\n'
            self.assertEqual(reference_bytes(path).decode(),expected)

    def test_one_ulp_trig_variation_keeps_exact_serialization(self):
        expected=json.dumps(generator.animations())
        for name in ('sin','cos','asin','atan2'):
            original=getattr(math,name)
            for direction in (-math.inf,math.inf):
                def perturbed(*args):
                    value=original(*args)
                    return value if value in (-1.0,0.0,1.0) else math.nextafter(value,direction)
                with patch('math.'+name,perturbed):
                    self.assertEqual(json.dumps(generator.animations()),expected)


if __name__=='__main__':unittest.main()
