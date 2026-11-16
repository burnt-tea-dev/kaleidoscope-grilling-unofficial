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
        renderer = self.view['slot_renderer']['controls'][1]['native_icon']
        for name, value in self.native.items():
            actual = renderer.get(name)
            if name == 'bindings':
                actual = actual[:len(value)]
            self.assertEqual(actual, value, name)

    def test_noncollection_cursor_skips_the_recipe_source_without_guessing_a_slot(self):
        callers = json.loads((FIX/'native-item-callers.json').read_text())['definitions']
        default = callers['inventory_selected_icon@common.item_renderer'].get('$item_collection_name', '')
        self.assertEqual(default, '', 'The cursor has no collection; never substitute inventory_items')
        expression = self.hook['container_item']['$item_renderer|default']
        self.assertIsInstance(expression, str, 'The collection owner selects its renderer by reference')
        for name, caller in callers.items():
            with self.subTest(caller=name):
                # Resolve the same native caller bases; the global cursor does
                # not inherit the collection-slot replacement.
                collection = caller.get('$item_collection_name', default)
                base = name.split('@', 1)[1].split('.', 1)[1]
                skipped = base not in self.hook and not collection
                self.assertEqual(skipped, name.startswith('inventory_selected_icon@'))
        selected = callers['inventory_selected_icon@common.item_renderer']
        renderer = {**self.native, **selected}
        self.assertEqual(renderer['renderer'], 'inventory_item_renderer')
        self.assertEqual(renderer['bindings'], selected['bindings'],
                         'The cursor keeps its native global data, not a fabricated slot binding')
        self.assertNotIn('modifications', renderer)

    def test_alpha_is_a_direct_binding_on_the_complete_native_definition(self):
        renderer = self.view['slot_renderer']['controls'][1]['native_icon']
        self.assertNotIn('modifications', renderer,
                         'A complete custom renderer must not emit the unsupported patch property')
        visibility = renderer['bindings'][len(self.native['bindings']):]
        self.assertEqual(visibility, [{
            'binding_type': 'view', 'source_control_name': 'kg_secret_recipe_source',
            'resolve_sibling_scope': True,
            'source_property_name': '(not #kg_secret_active)', 'target_property_name': '#visible'
        }])
        source = self.view['slot_renderer']['controls'][0]
        self.assertEqual(list(source), ['kg_secret_recipe_source'])
        self.assertFalse(renderer.get('controls'), 'The hidden native drawing must not own the sibling recipe layers')
        self.assertEqual(self.view['slot_renderer'].get('alpha'), None, 'The wrapper must not fade the recipe layers')
        self.assertEqual(self.hook['container_item']['$item_renderer|default'], 'kg_secret_gui.slot_renderer')
        # Substitute only the boolean view-binding boundary; the expression
        # and its source/target above come from the actual generator.
        expression = visibility[0]['source_property_name'].replace('#kg_secret_active', 'active')
        for active, expected in [(False, True), (True, False)]:
            self.assertEqual(eval(expression, {'__builtins__': {}}, {'active': active}), expected)
        layers = [next(iter(control.values()))['layer'] for control in self.view['slot_renderer']['controls'][2:]]
        self.assertEqual(layers, [0, 3, 3, 2, 2, 1, 1], 'Keep the Java stick/food draw order')


if __name__ == '__main__':
    unittest.main()
