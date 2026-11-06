"""Check the native renderer contract of the actual generated UI.

This catches the reported missing-type/base failure without pretending to run
Minecraft's UI engine or measure client rendering performance.
"""
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FIX = ROOT/'tools/fixtures/secret-gui'
UI = ROOT/'projects/grilling/gameplay_core/resource_pack/ui'


class NativeItemRenderer(unittest.TestCase):
    def test_generated_hook_keeps_the_native_renderer_and_bindings(self):
        hook = json.loads((UI/'kg_secret_gui_common.json').read_text())
        native = json.loads((FIX/'native-item-renderer.json').read_text())['item_renderer']
        generated = hook['item_renderer']
        # Vanilla selected-item, hotbar and bundle definitions inherit this
        # base and often replace its bindings. They still need its actual type.
        for name, value in native.items():
            self.assertEqual(generated.get(name), value, name)


if __name__ == '__main__':
    unittest.main()
