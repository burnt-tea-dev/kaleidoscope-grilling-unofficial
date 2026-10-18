"""The actual G154 source boundary rejects mutation and exact predecessor reuse."""
import copy
import json
from pathlib import Path
import unittest
import sys
from unittest.mock import patch
import g154_host_source as host
import current_runtime_ownership as owner


class HostSource(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.actual = owner.runtime_files()

    def test_complete_exact_recovery_preserves_g153_bytes(self):
        self.assertEqual(host.predecessor_runtime(self.actual), host.preceding_files())
        self.assertEqual(len(self.actual), len(host.preceding_files()) + 1)
        with self.assertRaises(TypeError):
            host.preceding_files()['new'] = b'new'

    def test_owned_unowned_added_missing_or_reverted_runtime_is_rejected(self):
        for operation in ['owned', 'unowned', 'extra', 'missing', 'missing_helper', 'changed_helper', 'revert']:
            actual = dict(self.actual)
            path = host.BP + '/host-extensions/board-api.json'
            if operation == 'owned': actual[path] += b'!'
            if operation == 'unowned': actual[host.BP + '/scripts/main.js'] += b'!'
            if operation == 'extra': actual[host.BP + '/scripts/unreviewed.js'] = b'new'
            if operation == 'missing': del actual[host.BP + '/scripts/main.js']
            if operation == 'missing_helper': del actual[next(iter(host.ADDED))]
            if operation == 'changed_helper': actual[next(iter(host.ADDED))] += b'!'
            if operation == 'revert': actual[path] = host.preceding_files()[path]
            with self.subTest(operation=operation), self.assertRaises(ValueError):
                host.predecessor_runtime(actual)

    def test_warm_admission_checks_guide_config_and_live_postimages_again(self):
        host.predecessor_runtime(self.actual)
        read = Path.read_bytes
        for path in host.PATHS:
            target = host.ROOT / path
            def changed(p): return read(p) + b'!' if p == target else read(p)
            with self.subTest(path=path), patch.object(Path, 'read_bytes', changed), self.assertRaises(ValueError):
                host.predecessor_runtime(self.actual)

    def test_ledger_scope_hash_identity_and_false_native_claims_are_not_editable_authority(self):
        for field, value in [('predecessor_commit', '0' * 40), ('predecessor_tree', '0' * 40),
                             ('version', [2, 8, 155]), ('native_acceptance', True), ('client_acceptance', True)]:
            forged = copy.deepcopy(host.ledger()); forged[field] = value
            raw = json.dumps(forged).encode()
            with self.subTest(field=field), patch.object(host, 'LEDGER_SHA256', host.sha(raw)), self.assertRaises(ValueError):
                host.ledger(raw)
        forged = copy.deepcopy(host.ledger())
        forged['changes'][host.BP + '/unknown.js'] = next(iter(forged['changes'].values()))
        raw = json.dumps(forged).encode()
        with patch.object(host, 'LEDGER_SHA256', host.sha(raw)), self.assertRaises(ValueError): host.ledger(raw)

    def test_historical_bytes_accept_only_exact_endpoints_and_no_added_preimage(self):
        for path in host.PATHS - host.ADDED:
            before, after = host.preceding_bytes(path), (host.ROOT / path).read_bytes()
            with self.subTest(path=path):
                self.assertEqual(host.reference_bytes(path, after), before)
                self.assertEqual(host.reference_bytes(path, before), before)
                with self.assertRaises(ValueError): host.reference_bytes(path, after + b'!')
        with self.assertRaisesRegex(ValueError, 'no historical byte preimage'):
            host.reference_bytes(next(iter(host.ADDED)))
        with self.assertRaises(ValueError): host.reference_bytes('../outside', b'anything')

    def test_eating_compiler_keeps_skewer_content_stage_for_both_current_and_historical_repair(self):
        import eating_compiler_pipeline as pipeline
        for version in [(2, 8, 153), (2, 8, 154)]:
            context = pipeline.Context(version, {}, host.ROOT / host.RP, host.ROOT / host.BP / 'scripts/main.js')
            stage = next(s for s in pipeline.STAGES if s.name == 'skewer_content')
            self.assertTrue(pipeline.enabled(stage, context))

    def test_partial_legacy_builders_cannot_overwrite_actual154(self):
        import build_caterpillar_eating_projection as caterpillar
        import build_two_route_eating_projection as two_route
        for module in [caterpillar, two_route]:
            with self.subTest(module=module.__name__), patch.object(sys, 'argv', [module.__name__]), \
                    patch.object(Path, 'write_bytes', side_effect=AssertionError('Unexpected runtime write')):
                with self.assertRaisesRegex(ValueError, 'cannot overwrite G153 or G154'):
                    module.main()


if __name__ == '__main__':
    unittest.main()
