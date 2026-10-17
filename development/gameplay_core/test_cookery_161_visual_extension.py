"""Finite public-dependency evidence; no client rendering acceptance is implied."""
import hashlib
import json
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[2]
FIXTURE = ROOT / 'development/gameplay_core/fixtures'
sys.path.insert(0, str(ROOT / 'tools'))
from import_cookery_161_visuals import ARCHIVE_SHA256, LEGACY_HASHES, SOURCE_URL


class Cookery161VisualExtension(unittest.TestCase):
    def test_original_213_records_keep_exact_reviewed_ids_pixels_outlines_and_provenance(self):
        for name, expected in LEGACY_HASHES.items():
            rows = json.loads((FIXTURE / name).read_text())['items']
            self.assertEqual(len(rows), 217)
            prefix = json.dumps(rows[:213], ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()
            self.assertEqual(hashlib.sha256(prefix).hexdigest(), expected, name)

    def test_only_four_exact_dependency_sprites_are_appended_to_every_visual_projection(self):
        catalog = json.loads((FIXTURE / 'secret-visual-catalog.json').read_text())['items']
        palettes = json.loads((FIXTURE / 'secret-food-palettes.json').read_text())['items']
        outlines = json.loads((FIXTURE / 'secret-helper-sprite-spans.json').read_text())['items']
        sources = [
            ('tea_egg', 'items/tea_egg.json', 'e3852c17398d79a3b5812eb4ed7aa96ed68c5f994ad5a8f33483cf436d54e949'),
            ('butter_tea', 'items/drinks/butter_tea.json', 'b47d9de3bec044406c0560c2be9022262ca03b3efe4eac8ac395a72af47cde3e'),
            ('clay_pot_milk_tea', 'items/drinks/clay_pot_milk_tea.json', '493ccbbcd8a7a7c71a5c578cd3c375a429225de3e0fa1f2c703f60cc46869d3c'),
            ('mystery_tea', 'items/drinks/mystery_tea.json', 'ba3ee47dd6ce50ed5983796f0e98672534b215f9ffffad93f72226ced4cd9d72'),
        ]
        for index, (name, path, digest) in enumerate(sources, 214):
            item, palette, outline = [rows[index - 1] for rows in (catalog, palettes, outlines)]
            identifier = 'kaleidoscope_cookery:' + name
            texture = 'textures/items/kc_' + name
            self.assertEqual([row['id'] for row in (item, palette, outline)], [identifier] * 3)
            self.assertEqual(item['source_path'], path)
            self.assertEqual(item['texture'], texture)
            self.assertEqual(item['texture_sha256'], digest)
            self.assertEqual(item['archive_sha256'], ARCHIVE_SHA256)
            self.assertEqual(item['texture_pack_uuid'], 'c9df2982-d72e-4bbf-a72c-b77de4ea915b')
            for row in (palette, outline):
                self.assertEqual(row['index'], index)
                source = row['source']
                self.assertEqual(source['kind'], 'public_cookery_1.6.1_bedrock_sprite')
                self.assertEqual(source['source_url'], SOURCE_URL)
                self.assertEqual(source['source_path'], texture + '.png')
                self.assertEqual(source['sha256'], digest)
                self.assertEqual(source['archive_sha256'], ARCHIVE_SHA256)
                self.assertEqual(source['license'], 'CC BY-NC-SA 4.0')
                self.assertEqual(source['bedrock_adaptation'], 'Loyallay')
                self.assertIs(source['java_particle_parity'], False)
                self.assertIs(source['native_renderer_accepted'], False)
            self.assertEqual(len(palette['palette']), 16)
            self.assertTrue(outline['spans'])
            self.assertGreater(outline['solid_pixel_count'], 0)
            self.assertFalse((ROOT / 'projects/grilling/gameplay_core/resource_pack' / (texture + '.png')).exists())


if __name__ == '__main__':
    unittest.main()
