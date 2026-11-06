"""Exercise the real UI generator and its selected native renderer contract.

These data/binding checks catch the reported unsupported property and lost
native base. They do not run Minecraft's UI parser or measure client frames.
"""
import json
import unittest
from pathlib import Path

from build_secret_gui import source_data, ui

ROOT = Path(__file__).resolve().parents[1]
FIX = ROOT/'tools/fixtures/secret-gui'
UI = ROOT/'projects/grilling/gameplay_core/resource_pack/ui'


class NativeItemRenderer(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.view, cls.hook = ui(source_data())
        cls.native = json.loads((FIX/'native-item-renderer.json').read_text())['item_renderer']

    def test_exported_ui_is_the_real_generator_output(self):
        for name, content in [('kg_secret_gui.json', self.view), ('kg_secret_gui_common.json', self.hook)]:
            with self.subTest(name=name):
                self.assertEqual(json.loads((UI/name).read_text()), content)

    def test_generated_hook_keeps_the_native_renderer_and_bindings(self):
        renderer = self.hook['item_renderer']
        for name, value in self.native.items():
            actual = renderer.get(name)
            if name == 'bindings':
                actual = actual[:len(value)]
            self.assertEqual(actual, value, name)

    def test_alpha_is_a_direct_binding_on_the_complete_native_definition(self):
        renderer = self.hook['item_renderer']
        self.assertNotIn('modifications', renderer,
                         'A complete custom renderer must not emit the unsupported patch property')
        alpha = renderer['bindings'][len(self.native['bindings']):]
        self.assertEqual(alpha, [{
            'binding_type': 'view', 'source_control_name': 'kg_secret_recipe_source',
            'source_property_name': '(not #kg_secret_active)', 'target_property_name': '#alpha'
        }])
        source = renderer['controls'][0]
        self.assertEqual(list(source), ['kg_secret_recipe_source@kg_secret_gui.slot_overlay'])
        self.assertFalse(renderer['propagate_alpha'], 'Only the native drawing may become transparent')
        self.assertEqual(self.view['icon']['alpha'], 1.0, 'The marked recipe keeps its own opaque layers')
        self.assertEqual(self.view['slot_overlay']['factory']['control_name'], 'kg_secret_gui.icon')
        # Substitute only the boolean view-binding boundary; the expression
        # and its source/target above come from the actual generator.
        expression = alpha[0]['source_property_name'].replace('#kg_secret_active', 'active')
        for active, expected in [(False, True), (True, False)]:
            self.assertEqual(eval(expression, {'__builtins__': {}}, {'active': active}), expected)
        layers = [next(iter(control.values()))['layer'] for control in self.view['icon']['controls']]
        self.assertEqual(layers, [0, 3, 3, 2, 2, 1, 1], 'Keep the Java stick/food draw order')


if __name__ == '__main__':
    unittest.main()
