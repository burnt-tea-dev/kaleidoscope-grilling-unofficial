"""Ordered secret slot placement; mathematical checks are not client acceptance."""
import json
import re
import unittest
from pathlib import Path
from test_native_skewer_fp import vertices

ROOT = Path(__file__).resolve().parents[2]
RP = ROOT / 'projects/grilling/gameplay_core/resource_pack'
FIX = json.loads((Path(__file__).parent / 'fixtures/java-secret-framing-1.1.1.json').read_text())


def load(path):
    return json.loads(path.read_text())


class SecretSlotOrderTests(unittest.TestCase):
    def test_secret_java_hand_transforms_equal_the_existing_fixed_skewer_reference(self):
        expected = load(ROOT / 'projects/grilling/reports/java_display_transforms/beef_raw.json')['java_display']
        self.assertEqual(FIX['pin'], '9a1acdab27698457bec16c9362678e574895a28c')
        for source in FIX['sources']:
            for key, pose in source['display'].items():
                self.assertEqual(pose, expected[key], (source['path'], key))

    def test_all_three_pinned_variant_families_have_increasing_ingredient_slot_z(self):
        for source in FIX['sources'][1:]:
            rows = source['slot_bounds_after_element_rotation']
            self.assertEqual([r['slot'] for r in rows], [0, 1, 2])
            centers = [(r['min'][2] + r['max'][2]) / 2 for r in rows]
            self.assertEqual(centers, sorted(centers))
            self.assertLess(centers[0], 5)
            self.assertGreater(centers[2], 10)

    def test_volumetric_shapes_follow_stored_ingredient_order(self):
        geos = load(RP / 'models/entity/secret_held.geo.json')['minecraft:geometry']
        for shape in range(1,4):
            centers=[]
            for slot in range(3):
                geo=next(g for g in geos if g['description']['identifier']==f'geometry.kg_secret_held.state_{shape*21}_{slot}')
                cubes=geo['bones'][2]['cubes']
                self.assertTrue(all(all(size>0 for size in cube['size'])for cube in cubes))
                centers.append(sum(c['origin'][2]+c['size'][2]/2+8 for c in cubes)/len(cubes))
            self.assertEqual(centers,sorted(centers))
            self.assertLess(centers[0],5);self.assertGreater(centers[2],10)

    def test_third_ingredient_projects_above_first_without_changing_the_hand_pose(self):
        geos = load(RP / 'models/entity/secret_held.geo.json')['minecraft:geometry']
        animations = load(RP / 'animations/a287_skewer_held.animation.json')['animations']
        for hand in ('right', 'left'):
            values = []
            for geo in geos:
                identifier = geo['description']['identifier']
                if '.state_21_' not in identifier:
                    continue
                points = vertices(geo, animations['animation.kg_a287.skewer_fp_' + hand], hand)[0]
                values.append(sum(p[1] / -p[2] for p in points) / len(points))
            self.assertEqual(values, sorted(values), hand)
            # Only ordering is required. Fitting every pixel at FOV60 is not.
            self.assertLess(values[0], values[2])

    def test_bite_stages_keep_java_tip_first_remaining_slots_without_remapping_textures(self):
        self.assertEqual([row['remaining_tint_slots'] for row in FIX['bite_models']], [[0, 1], [0]])
        controllers = load(RP / 'render_controllers/secret_held.render_controllers.json')['render_controllers']
        thresholds = []
        for slot in range(3):
            row = controllers[f'controller.render.kg_secret_held.{slot}']
            gate = next(part['skewer_model'] for part in row['part_visibility'] if 'skewer_model' in part)
            thresholds.append(int(re.fullmatch(r'v\.kg_secret_owner_occupied == 1 && v\.kg_bite_stage < (\d+)', gate)[1]))
            self.assertEqual(row['textures'], [f'Array.food[v.kg_secret_food_{slot} + v.kg_secret_style_{slot} * 218]'])
        for stage, expected in enumerate(([0, 1, 2], [0, 1], [0], [])):
            self.assertEqual([slot for slot, limit in enumerate(thresholds) if stage < limit], expected)


if __name__ == '__main__':
    unittest.main()
