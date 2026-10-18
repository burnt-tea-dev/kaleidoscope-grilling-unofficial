"""Historical scoped CLIs validate exact G153 reads without overwriting it."""
import sys
import unittest
from pathlib import Path
from unittest.mock import patch
import build_caterpillar_eating_projection as caterpillar
import build_two_route_eating_projection as two_route

class ScopedBuilderBoundaries(unittest.TestCase):
    def test_check_commands_accept_exact_successor_without_writes(self):
        for module in (caterpillar,two_route):
            with self.subTest(module=module.__name__), patch.object(sys,'argv',[module.__name__,'--check']), patch.object(Path,'write_bytes',side_effect=AssertionError('Check attempted a write')):
                module.main()

    def test_partial_historical_write_mode_cannot_overwrite_successor(self):
        for module in (caterpillar,two_route):
            with self.subTest(module=module.__name__), patch.object(sys,'argv',[module.__name__]), patch.object(Path,'write_bytes',side_effect=AssertionError('Historical overwrite attempted')):
                with self.assertRaisesRegex(ValueError,'cannot overwrite G153'):
                    module.main()

    def test_mutated_live_main_is_rejected_before_historical_comparison(self):
        main=two_route.MAIN
        real=Path.read_bytes
        bad=real(main)+b'\n// unreviewed successor\n'
        def read(path):return bad if path==main else real(path)
        for module in (caterpillar,two_route):
            with self.subTest(module=module.__name__), patch.object(sys,'argv',[module.__name__,'--check']), patch.object(Path,'read_bytes',read), patch.object(Path,'write_bytes',side_effect=AssertionError('Check attempted a write')):
                with self.assertRaisesRegex(ValueError,'Unreviewed G153 repair pre/postimage'):
                    module.main()

if __name__=='__main__':unittest.main()
