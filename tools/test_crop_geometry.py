"""Crop regression: Java plane topology, in-bounds UV and every stage material.

The crop/tall_crop/cross parents are pinned source snapshots. Java coordinates
are reflected on X and centered horizontally for Bedrock; cross rescale is
baked into the plane extent, not dropped or applied to the vertical axis.
"""
import json
import math
import unittest
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
RP = ROOT / 'projects/grilling/gameplay_core/resource_pack'
BP = ROOT / 'projects/grilling/gameplay_core/behavior_pack'
SOURCE = ROOT / 'projects/grilling/source_snapshots/common/src/main/resources/assets'


def load(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


class CropGeometry(unittest.TestCase):
    def test_java_crop_and_tall_crop_planes(self):
        for name, parent, height in (
            ('houttuynia_crop', 'minecraft/models/block/crop.json', 16),
            ('canola_crop', 'kaleidoscope_grilling/models/block/tall_crop.json', 28),
        ):
            with self.subTest(name=name):
                geo = load(RP / f'models/blocks/{name}.geo.json')['minecraft:geometry'][0]
                cubes = geo['bones'][0]['cubes']
                elements = load(SOURCE / parent)['elements']
                self.assertEqual(len(cubes), len(elements))
                self.assertEqual(geo['description']['texture_height'], height)
                for cube, element in zip(cubes, elements):
                    a, b = element['from'], element['to']
                    self.assertEqual(cube['origin'], [8-b[0], a[1], a[2]-8])
                    self.assertEqual(cube['size'], [b[i]-a[i] for i in range(3)])
                    self.assertEqual(cube.get('rotation', [0, 0, 0]), [0, 0, 0])
                    self.assertEqual(set(cube['uv']), set(element['faces']))
                    for side, face in element['faces'].items():
                        u, v, U, V = face['uv']
                        self.assertEqual(cube['uv'][side], {
                            'uv': [u, v*height/16], 'uv_size': [U-u, (V-v)*height/16]})

    def test_onion_uses_java_rescaled_cross(self):
        block = load(BP / 'blocks/onion_crop.json')['minecraft:block']
        self.assertEqual(block['components']['minecraft:geometry'], 'geometry.kaleidoscope_grilling.onion_crop')
        geo = load(RP / 'models/blocks/onion_crop.geo.json')['minecraft:geometry'][0]
        elements = load(SOURCE / 'minecraft/models/block/cross.json')['elements']
        cubes = geo['bones'][0]['cubes']
        self.assertEqual(len(cubes), 2)
        for cube, element in zip(cubes, elements):
            a, b = element['from'], element['to']
            expected = [(b[i]-a[i]) * (math.sqrt(2) if i != 1 else 1) for i in range(3)]
            for actual, want in zip(cube['size'], expected):
                self.assertAlmostEqual(actual, want)
            self.assertEqual(cube['rotation'], [0, -45, 0])
            self.assertEqual(cube['pivot'], [0, 8, 0])
            for actual, want in zip(cube['origin'], [-expected[0]/2, 0, -expected[2]/2]):
                self.assertAlmostEqual(actual, want)
            self.assertEqual(set(cube['uv']), set(element['faces']))
            for face in cube['uv'].values():
                self.assertEqual(face, {'uv': [0, 0], 'uv_size': [16, 16]})

    def test_every_growth_stage_has_bounded_cutout_uv(self):
        atlas = load(RP / 'textures/terrain_texture.json')['texture_data']
        total = 0
        for species in ('houttuynia', 'sweet_potato', 'onion', 'canola'):
            block = load(BP / f'blocks/{species}_crop.json')['minecraft:block']
            self.assertEqual(block['description']['states']['kaleidoscope_grilling:age'], list(range(8)))
            gid = block['components']['minecraft:geometry'].split('.')[-1]
            geo = load(RP / f'models/blocks/{gid}.geo.json')['minecraft:geometry'][0]
            for permutation in block['permutations']:
                material = permutation['components']['minecraft:material_instances']['*']
                self.assertEqual(material['render_method'], 'alpha_test_single_sided')
                path = RP / (atlas[material['texture']]['textures'] + '.png')
                with Image.open(path) as image:
                    self.assertEqual(image.size, (geo['description']['texture_width'], geo['description']['texture_height']))
                    alpha = image.convert('RGBA').getchannel('A')
                    self.assertEqual(set(alpha.tobytes()), {0, 255})
                    w, h = image.size
                for cube in geo['bones'][0]['cubes']:
                    self.assertIsInstance(cube['uv'], dict, 'box UV stretches the reverse face outside the crop texture')
                    for face in cube['uv'].values():
                        u, v = face['uv']; du, dv = face['uv_size']
                        self.assertTrue(0 <= min(u, u+du) < max(u, u+du) <= w)
                        self.assertTrue(0 <= min(v, v+dv) < max(v, v+dv) <= h)
                total += 1
        self.assertEqual(total, 35)


if __name__ == '__main__':
    unittest.main()
