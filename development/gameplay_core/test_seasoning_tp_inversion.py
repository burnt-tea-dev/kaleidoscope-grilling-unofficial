"""Missing TP item contributor regression; source matrix checks, not client parity.

Java1.1.1 ItemInHandLayerAnvilPressMixin inserts Z180 before renderItem,
therefore before the handed display translation/rotation/scale. Derive the
relative correction from the existing hold, independently of make_pose's
upstream hand/socket projection. Native float/render acceptance is separate.
"""
import itertools
import json
import math
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools'))
import build_seasoning_held as held
from held_pose_frames import (FAMILIES, RP, bone_matrix, chain, identity,
    make_pose, point, rotate, scale, translate, xyz)


def load(path):
    return json.loads(path.read_text())


def inverse(matrix):
    """Independent general inverse, including display scale/translation."""
    rows = [row[:] + identity()[i] for i, row in enumerate(matrix)]
    for column in range(4):
        pivot = max(range(column, 4), key=lambda i: abs(rows[i][column]))
        rows[column], rows[pivot] = rows[pivot], rows[column]
        divisor = rows[column][column]
        if abs(divisor) < 1e-12:
            raise ValueError('Singular display transform')
        rows[column] = [value / divisor for value in rows[column]]
        for i in range(4):
            if i != column:
                factor = rows[i][column]
                rows[i] = [a - factor * b for a, b in zip(rows[i], rows[column])]
    return [row[4:] for row in rows]


def pivoted(channels):
    return chain(translate([0, 24, 0]), bone_matrix(channels), translate([0, -24, 0]))


class SeasoningTPInversion(unittest.TestCase):
    def test_pre_display_half_turn_changes_item_local_matrix(self):
        java = load(ROOT / 'projects/grilling/source_snapshots/common/src/main/resources/assets/'
            'kaleidoscope_grilling/models/item/seasoning_special_states/remaining_1_variant_0.json')
        geometries = load(RP / 'models/entity/bottle_held_contents.geo.json')['minecraft:geometry']
        geometry = next(g for g in geometries if g['description']['identifier'] == 'geometry.kg_bottle_held.fixed.r1.v0')
        markers = [[0, 24, 0], [1.25, 21.75, -2.5], [0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]]
        for bone in geometry['bones']:
            for cube in bone.get('cubes', []):
                self.assertFalse(any(cube.get('rotation', [0, 0, 0])))
                for corner in itertools.product([0, 1], repeat=3):
                    p = [cube['origin'][i] + corner[i] * cube['size'][i] for i in range(3)]
                    markers.append([-p[0], p[1], p[2]])
        idle = load(RP / 'animations/a286_held.animation.json')['animations']
        for hand, sign in [('right', 1), ('left', -1)]:
            display = java['display']['thirdperson_' + hand + 'hand']
            rotation = display['rotation']; translation = display['translation']
            suffix = chain(translate([translation[0] * sign, *translation[1:]]),
                xyz([rotation[0], rotation[1] * sign, rotation[2] * sign]),
                scale(display['scale']), translate([-8, -8, -8]), translate([8, -18, 8]))
            before = idle['animation.kg_a286.bottle_tp_' + hand]['bones']['grip']
            # The unchanged upstream prefix cancels: L1 = L0 D^-1 J D.
            expected = chain(pivoted(before), inverse(suffix), rotate('z', 180), suffix)
            actual = pivoted(make_pose('bottle', 'tp', hand, tp_item_inversion=True)['grip'])
            for p in markers:
                # Existing eight-decimal pose export is not bit-exact Java/JOML.
                self.assertLess(math.dist(point(expected, p), point(actual, p)), 2e-8)
            wrong = dict(before, rotation=before['rotation'][:])
            wrong['rotation'][2] += 180
            self.assertGreater(math.dist(point(expected, markers[1]), point(pivoted(wrong), markers[1])), 1)

        document = load(RP / 'animations/seasoning_tp.animation.json')
        self.assertEqual(document, held.tp_sprinkle())
        self.assertEqual(set(document['animations']), {'animation.kg_seasoning.item.sprinkle.tp.right'})
        clip = next(iter(document['animations'].values()))
        self.assertEqual(set(clip), {'loop', 'bones'})
        self.assertTrue(clip['loop'])
        self.assertEqual(clip['bones'], make_pose('bottle', 'tp', 'right', tp_item_inversion=True))

    def test_default_pose_api_keeps_existing_frames_and_rejects_other_inversion_scopes(self):
        existing = {}
        for name in ['a286_held.animation.json', 'a287_skewer_held.animation.json']:
            existing.update(load(RP / 'animations' / name)['animations'])
        for family, view, hand in itertools.product(FAMILIES, ['fp', 'tp'], ['right', 'left']):
            prefix = 'kg_a287.skewer' if family == 'skewer' else 'kg_a286.' + family
            expected = existing['animation.' + prefix + '_' + view + '_' + hand]['bones']
            self.assertEqual(make_pose(family, view, hand), expected)
            self.assertEqual(make_pose(family, view, hand, tp_item_inversion=False), expected)
        for args in [('skewer', 'tp', 'right'), ('bottle', 'fp', 'right'), ('rack', 'tp', 'right'), ('bottle', 'tp', 'unknown')]:
            with self.assertRaises(ValueError):
                make_pose(*args, tp_item_inversion=True)


if __name__ == '__main__':
    unittest.main()
