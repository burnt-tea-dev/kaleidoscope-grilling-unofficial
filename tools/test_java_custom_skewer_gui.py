import hashlib
import json
import unittest
from PIL import Image
import java_custom_skewer_gui as gui
import build_scene_visuals as scene

class JavaCustomGuiTests(unittest.TestCase):
    def test_pinned_source_and_templates(self):
        for row in json.loads((gui.FIXTURE / 'source-manifest.json').read_text())['files']:
            self.assertEqual(hashlib.sha256((gui.FIXTURE / row['path']).read_bytes()).hexdigest(), row['sha256'])

    def test_empty_exact_stick(self):
        with Image.open(gui.TEMPLATES / 'stick.png') as image:
            self.assertEqual(gui.compose([]).tobytes(), image.convert('RGBA').tobytes())

    def test_mask_tones_and_rounding(self):
        self.assertEqual([gui.mask_tone((100, 100, 100), marker)[0] for marker in (48, 96, 144, 192, 240)], [56, 76, 100, 128, 156])
        self.assertEqual(gui.mask_tone((1, 1, 1), 48), (1, 1, 1))

    def test_missing_slots_and_variant_bits(self):
        red = [0xFF0000] * 16
        self.assertEqual(gui.compose([red], 0).tobytes(), gui.compose([red], 6).tobytes())
        self.assertNotEqual(gui.compose([red], 0).tobytes(), gui.compose([red], 1).tobytes())
        self.assertNotEqual(gui.compose([red], 0).tobytes(), gui.compose([red, red], 0).tobytes())

    def test_front_slot_overwrites_back_slot(self):
        rows = [[0xFF0000] * 16, [0x00FF00] * 16, [0x0000FF] * 16]
        result = gui.compose(rows)
        with Image.open(gui.TEMPLATES / 'food_1_1.png') as image:
            mask = image.convert('RGBA')
        for y in range(16):
            for x in range(16):
                pixel = mask.getpixel((x, y))
                if pixel[3]:
                    self.assertEqual(result.getpixel((x, y)), (*gui.mask_tone(gui.ingredient_color(rows[0]), pixel[0]), pixel[3]))

    def test_cooked_snapshot_differs_from_raw_and_legacy(self):
        row = [0xCC7722] * 16
        self.assertNotEqual(gui.ingredient_color(row), gui.ingredient_color(row, 4, True))
        self.assertNotEqual(gui.ingredient_color(row, 4, False), gui.ingredient_color(row, 4, True))
        self.assertEqual(row, [0xCC7722] * 16)

    def test_native_scene_layers_recompose_the_source_icon_without_overlap(self):
        # Exercise the real former failure: different ingredient slots and GUI
        # variants must remain visible, in Java front-slot order, after cooking.
        # This checks bounded masks against the existing source reference. It
        # cannot certify client shaders, texture filtering or world lighting.
        from io import BytesIO
        output = scene.gui_assets()
        palettes = [[0xC83D28] * 16, [0x4C9A35] * 16, [0xBBA244] * 16]
        prefix = scene.RP / 'textures/ui/kg_java/custom_layers'
        for count, bits, stage, snapshot in [(1, 1, 0, False), (3, 0, 0, False), (3, 5, 4, True)]:
            image = Image.open(BytesIO(output[prefix / f'stick_{(1 << count) - 1 + bits}.png'])).convert('RGBA')
            coverage = [bool(p[3]) for p in image.getdata()]
            for slot in range(count):
                base = gui.ingredient_color(palettes[slot], stage, snapshot)
                for tone in range(5):
                    mask = Image.open(BytesIO(output[prefix / f'food_{slot}_{tone}_{bits % (1 << (slot + 1))}.png'])).convert('RGBA')
                    color = gui.mask_tone(base, 48 + tone * 48)
                    for position, pixel in enumerate(mask.getdata()):
                        if pixel[3]:
                            self.assertFalse(coverage[position], 'coplanar mask overlap could depend on GPU ordering')
                            coverage[position] = True
                            image.putpixel((position % 16, position // 16), (*color, pixel[3]))
            self.assertEqual(image.tobytes(), gui.compose(palettes[:count], bits, stage, snapshot).tobytes())

    def test_invalid_shape(self):
        with self.assertRaises(ValueError): gui.compose([[0] * 16] * 4)
        with self.assertRaises(ValueError): gui.compose([], 8)
        with self.assertRaises(ValueError): gui.compose([[0] * 15])



class JavaDataExtractionTests(unittest.TestCase):
    """Data extraction cases, alongside the existing upstream asset reader tests."""

    def test_literal_arithmetic_does_not_execute_source(self):
        from java_extract.common import number
        self.assertEqual(number('5L * 20L'), 100)
        self.assertEqual(number('-7 / 2'), -3)
        self.assertEqual(number('0xFF'), 255)
        self.assertEqual(number('0xFFL'), 255)
        self.assertEqual(number('90F / 20F'), 4.5)
        self.assertEqual(number('-7 % 3'), -1)
        self.assertEqual(number('0xFFFFFFFF'), -1)
        with self.assertRaises(ValueError): number('(int)1.75F')
        with self.assertRaises(ValueError): number('2147483647 + 1')
        with self.assertRaises(ValueError): number('1 << 32')
        self.assertEqual(number('0.95833F'), 0.95833)
        with self.assertRaises(ValueError):
            number('__import__("os").system("echo unexpected")')
        with self.assertRaises(ValueError):
            number('Math.random() * 20')

    def test_numeric_reader_handles_comments_strings_arrays_and_symbols(self):
        from java_extract.domains import numeric_declarations, numeric_rules
        source = """class Sample {
          // int fake = 99;
          private static final int TICKS = 5L * 20L;
          private static final float[] KEYS = {0F, .5F, 1F};
          private static final int SYMBOLIC = TICKS * 2;
          public void draw() {
            String label = "item/100 // still a string";
            String example = "int notAField = 99;";
            int width = 102;
          }
        }"""
        rows = {row['name']: row for row in numeric_declarations(source)}
        self.assertEqual(set(rows), {'TICKS', 'KEYS', 'SYMBOLIC', 'width'})
        self.assertEqual(rows['TICKS']['value'], 100)
        self.assertEqual(rows['KEYS']['value'], [0, .5, 1])
        self.assertNotIn('value', rows['SYMBOLIC'])
        rules = numeric_rules(source)
        self.assertFalse(any('label' in row['expression'] or 'example' in row['expression'] for row in rules))
        self.assertEqual(next(row['method'] for row in rules if 'width' in row['expression']), 'draw')
        changed = {row['name']: row for row in numeric_declarations(source.replace('102', '174'))}
        self.assertEqual(changed['width']['value'], 174)

    def test_balanced_calls_keep_nested_arguments_and_strings(self):
        from java_extract.common import calls
        source = 'register("a,b", make(1, nested(2, 3)), new int[] {4, 5}); // register("fake")'
        rows = list(calls(source, 'register'))
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0][1], ['"a,b"', 'make(1, nested(2, 3))', 'new int[] {4, 5}'])

    def test_generated_tables_keep_units_and_loader_identity(self):
        from pathlib import Path
        folder = Path(__file__).resolve().parents[1] / 'data/java'
        foods = json.loads((folder/'foods.json').read_text())
        profiles = json.loads((folder/'eating_profiles.json').read_text())
        heat = json.loads((folder/'heat.json').read_text())
        hud = json.loads((folder/'hud.json').read_text())
        for loader in ('forge-1.20.1', 'neoforge-1.21.1'):
            items = foods['loaders'][loader]['items']
            self.assertEqual(items['kaleidoscope_grilling:raw_beef_skewer']['nutrition'], 2)
            raw = items['kaleidoscope_grilling:raw_caterpillar_skewer']
            self.assertEqual(raw['authored_effects'], [{'id': 'minecraft:nausea', 'duration_ticks': 60}])
            self.assertEqual(raw['effective_effects'], [])
            self.assertEqual(items['kaleidoscope_grilling:grilled_beef_skewer']['saturation_modifier'], .6)
            self.assertEqual(profiles['loaders'][loader]['profiles']['THREE']['duration_ticks'], 100)
            self.assertEqual(profiles['loaders'][loader]['profiles']['FOUR']['bite_seconds'], [.95833, 2.33333, 3.45833, 4.08333])
            self.assertEqual(heat['parameters'][loader]['heat_bucket_ticks']['value'], 100)
            self.assertEqual(heat['parameters'][loader]['oil_heat_ticks']['values'], {'secret_chili': 12000, 'premium_chili': 24000, 'default': 1200})
            self.assertEqual(hud['parameters'][loader]['eating_bar_width']['value'], 102)
            self.assertEqual(hud['parameters'][loader]['offset_from_screen_center_x_and_bottom_y']['x']['value'], -1)
        recipes = json.loads((folder/'recipes.json').read_text())['resources']
        self.assertEqual(sum('/recipe/' in name for name in recipes), sum('/recipes/' in name for name in recipes))
        self.assertTrue(any('/mixing/' in name for name in recipes))
        shapes = json.loads((folder/'collision_shapes.json').read_text())['classes']
        bottle = next(row for name, row in shapes.items() if name.endswith('seasoning/SeasoningBottleBlock.java'))
        self.assertEqual(len(bottle['boxes']), 4)
        self.assertTrue(any(12.25 in row.get('bounds', []) for row in bottle['boxes']))

    def test_external_values_keep_publisher_provenance(self):
        from pathlib import Path
        folder = Path(__file__).resolve().parents[1] / 'data/java'
        dims = json.loads((folder/'minecraft_dimensions.json').read_text())
        self.assertIsNone(dims['source_commit'])
        for version in ('1.20.1', '1.21.1'):
            data = dims['versions'][version]['dimensions']
            self.assertEqual((data['overworld']['min_y'], data['overworld']['logical_max_y']), (-64, 319))
            self.assertEqual(data['the_nether']['height'], 256)
            self.assertEqual(data['the_nether']['logical_max_y'], 127)
            self.assertEqual(data['the_end']['logical_max_y'], 255)
        assets = json.loads((folder/'minecraft_assets.json').read_text())
        self.assertEqual(len(assets['events']), 7)
        self.assertEqual(len(assets['particle_sprites']), 9)
        palette = json.loads((folder/'seasoning_colors.json').read_text())
        self.assertEqual(palette['ingredients']['minecraft:redstone']['rgb'], [11144961, 4261120])
        self.assertEqual(palette['ingredients']['kaleidoscope_grilling:dragon_egg_powder']['rgb'], [263178, 1639723])
        index = json.loads((folder/'external_sources.json').read_text())
        self.assertEqual(len(index['fixtures']), 21)
        self.assertTrue(all('preserved_content' not in row for row in index['fixtures']))

    def test_output_check_detects_missing_changed_and_extra_files(self):
        from pathlib import Path
        from tempfile import TemporaryDirectory
        from java_extract.extract import write_or_check
        with TemporaryDirectory() as directory:
            path = Path(directory)
            expected = {'values.json': b'{"value": 25}\n'}
            write_or_check(expected, path)
            write_or_check(expected, path, True)
            (path/'values.json').write_text('{"value": 24}\n')
            with self.assertRaises(ValueError): write_or_check(expected, path, True)
            (path/'values.json').unlink()
            with self.assertRaises(ValueError): write_or_check(expected, path, True)
            (path/'unrelated.json').write_text('{}')
            with self.assertRaises(ValueError): write_or_check(expected, path)

if __name__ == '__main__': unittest.main()
