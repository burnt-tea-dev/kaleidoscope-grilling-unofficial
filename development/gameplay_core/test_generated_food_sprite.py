"""Source/geometry regressions, not rendered Minecraft or Java-pixel proof."""
import hashlib
import json
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools'))
from generated_food_sprite import FIXTURE, helper_assets, main_faces, span_cubes, spans_from_alpha


class GeneratedFoodSprite(unittest.TestCase):
    def test_transparent_and_single_pixel_source_contract(self):
        self.assertEqual(spans_from_alpha([[0, 0], [0, 0]]), [])
        # Java only rejects alpha zero: alpha 1 is occupied as alpha 255 is.
        expected = [['up', 0, 0, 0], ['down', 0, 0, 0], ['left', 0, 0, 0], ['right', 0, 0, 0]]
        self.assertEqual(spans_from_alpha([[1]]), expected)
        self.assertEqual(spans_from_alpha([[255]]), expected)

    def test_java_span_merge_crosses_disjoint_runs_and_keeps_hole_boundaries(self):
        spans = spans_from_alpha([[255, 0, 255]])
        self.assertIn(['up', 0, 0, 2], spans)
        self.assertIn(['down', 0, 0, 2], spans)
        self.assertIn(['right', 0, 0, 0], spans)
        self.assertIn(['left', 2, 0, 0], spans)
        hole = spans_from_alpha([[255] * 3, [255, 0, 255], [255] * 3])
        for span in [['down', 0, 1, 1], ['up', 2, 1, 1], ['right', 0, 1, 1], ['left', 2, 1, 1]]:
            self.assertIn(span, hole)

    def test_unique_frames_are_merged_like_java(self):
        frames = [[[255, 0], [0, 0]], [[0, 255], [0, 0]]]
        self.assertEqual(spans_from_alpha(frames)[:2], [['up', 0, 0, 1], ['down', 0, 0, 1]])

    def test_source_side_positions_normals_and_boundary_uvs(self):
        actual = span_cubes([['up', 2, 3, 5], ['down', 2, 3, 5], ['left', 3, 2, 5], ['right', 3, 2, 5]], 16, 16)
        expected = [
            {'origin': [-5, 38, -0.5], 'size': [3, 0, 1], 'uv': {'up': {'uv': [3, 2], 'uv_size': [3, 1]}}},
            {'origin': [-5, 37, -0.5], 'size': [3, 0, 1], 'uv': {'down': {'uv': [3, 2], 'uv_size': [3, 1]}}},
            {'origin': [-5, 34, -0.5], 'size': [0, 4, 1], 'uv': {'east': {'uv': [3, 2], 'uv_size': [1, 4]}}},
            {'origin': [-4, 34, -0.5], 'size': [0, 4, 1], 'uv': {'west': {'uv': [3, 2], 'uv_size': [1, 4]}}},
        ]
        self.assertEqual(actual, expected)
        # Higher resolution changes pixel strip width, never the 16-unit model.
        highres = span_cubes([['up', 8, 12, 23]], 64, 64)[0]
        self.assertEqual(highres['origin'], expected[0]['origin'])
        self.assertEqual(highres['size'], expected[0]['size'])
        self.assertEqual(highres['uv'], {'up': {'uv': [3, 2], 'uv_size': [3, 0.25]}})

    def test_front_back_have_one_unit_thickness_with_original_uv_footprint(self):
        face = main_faces()
        self.assertEqual(face['origin'], [-8, 24, -0.5])
        self.assertEqual(face['size'], [16, 16, 1])
        self.assertEqual(face['uv'], {'north': {'uv': [0, 0], 'uv_size': [16, 16]}, 'south': {'uv': [16, 0], 'uv_size': [-16, 16]}})
        self.assertEqual(set(face['uv']), {'north', 'south'})

    def test_all_actual_catalog_sources_have_verified_derived_spans(self):
        proof = json.loads(FIXTURE.read_text())
        catalog = json.loads((ROOT / 'development/gameplay_core/fixtures/secret-visual-catalog.json').read_text())['items']
        self.assertEqual(len(proof['items']), 217)
        counts = {'installed_bedrock_1.26.52.3': 40, 'catalog_hash_verified_cookery_1.0.8_sprite': 113, 'canonical_grilling_runtime_sprite': 60, 'public_cookery_1.6.1_bedrock_sprite': 4}
        self.assertEqual({kind: sum(row['source']['kind'] == kind for row in proof['items']) for kind in counts}, counts)
        for row, source in zip(proof['items'], catalog):
            self.assertEqual(row['texture'], source['texture'])
            self.assertEqual(row['id'], source['id'])
            if row['id'].startswith('kaleidoscope_cookery:'):
                self.assertEqual(row['source']['sha256'], source['texture_sha256'])
            if row['id'].startswith('kaleidoscope_grilling:'):
                raw = (ROOT / 'projects/grilling/gameplay_core/resource_pack' / (row['texture'] + '.png')).read_bytes()
                self.assertEqual(hashlib.sha256(raw).hexdigest(), row['source']['sha256'])
            for direction, anchor, first, last in row['spans']:
                horizontal = direction in ('up', 'down')
                self.assertTrue(0 <= anchor < (row['height'] if horizontal else row['width']))
                self.assertTrue(0 <= first <= last < (row['width'] if horizontal else row['height']))

    def test_selected_geometry_and_texture_use_same_raw_last_index_one_pass(self):
        rp = ROOT / 'projects/grilling/gameplay_core/resource_pack'
        geometries, selected = helper_assets()
        by_id = {row['description']['identifier']: row for row in geometries}
        actual = json.loads((rp / 'models/entity/secret_helper_sprites.geo.json').read_text())['minecraft:geometry']
        self.assertEqual(actual, geometries[1:])
        controllers = json.loads((rp / 'render_controllers/secret_held.render_controllers.json').read_text())['render_controllers']
        controller = controllers['controller.render.kg_secret_held.piece']
        self.assertEqual(controller['geometry'], 'Array.pieces[v.kg_secret_piece_index]')
        self.assertEqual(controller['textures'], ['Array.food[v.kg_secret_piece_index]'])
        arrays = controller['arrays']
        self.assertEqual(len(arrays['geometries']['Array.pieces']), 218)
        self.assertEqual(len(arrays['textures']['Array.food']), 218)
        for name in ('secret_skewer', 'secret_skewer_java_three_alt'):
            desc = json.loads((rp / 'attachables' / (name + '.attachable.json')).read_text())['minecraft:attachable']['description']
            self.assertEqual(desc['render_controllers'].count('controller.render.kg_secret_held.piece'), 1)
            for index, (geo, texture) in enumerate(zip(arrays['geometries']['Array.pieces'], arrays['textures']['Array.food'])):
                self.assertEqual(desc['geometry'][geo.removeprefix('Geometry.')], selected[index])
                self.assertIn(selected[index], by_id)
                if index:
                    self.assertEqual(texture, 'Texture.food_' + str(index))
        self.assertEqual(len(geometries), 170)
        self.assertLess(len(geometries), 218, 'Duplicate silhouettes should not expand rendering work')

    def test_beef_is_actual_alpha_outline_not_rectangle_background_walls(self):
        proof = json.loads(FIXTURE.read_text())
        beef = next(row for row in proof['items'] if row['id'] == 'minecraft:beef')
        self.assertEqual(beef['alpha_values'], [0, 255])
        self.assertLess(beef['solid_pixel_count'], 256)
        cubes = span_cubes(beef['spans'], beef['width'], beef['height'])
        self.assertGreater(len(cubes), 4)
        for row in cubes:
            self.assertEqual(row['origin'][2], -0.5)
            self.assertEqual(row['size'][2], 1)
            self.assertEqual(len(row['uv']), 1)
            self.assertTrue(row['size'][0] == 0 or row['size'][1] == 0)
            self.assertLess(max(row['size'][:2]), 16)

    def test_native_admission_requires_both_exact_mesh_documents(self):
        from copy import deepcopy
        import build_java_eating_projection as projection
        rp = projection.RP
        desc = json.loads((rp / 'attachables/secret_skewer.attachable.json').read_text())['minecraft:attachable']['description']
        self.assertTrue(projection.secret_geometry(desc))
        helper_path = rp / 'models/entity/secret_helper_sprites.geo.json'
        helper = json.loads(helper_path.read_text())
        broken = deepcopy(helper)
        broken['minecraft:geometry'][0]['bones'][1]['cubes'][1]['origin'][2] = 0
        self.assertFalse(projection.secret_geometry(desc, {helper_path: broken}))
        self.assertFalse(projection.secret_geometry(desc, {helper_path: {'format_version': '1.21.0', 'minecraft:geometry': []}}))
        broken_desc = deepcopy(desc)
        broken_desc['geometry']['piece_1'] = 'geometry.other_food'
        self.assertFalse(projection.secret_geometry(broken_desc))


if __name__ == '__main__':
    unittest.main()
