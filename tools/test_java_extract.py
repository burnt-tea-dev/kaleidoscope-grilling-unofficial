"""Java data extraction regressions, independent of retired geometry tests."""
import json
import unittest


class JavaDataExtractionTests(unittest.TestCase):
    """Regression coverage for the pinned Java reference data extractor."""

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
