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



if __name__ == '__main__': unittest.main()
