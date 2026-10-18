"""Complete G155 admission must preserve both independent repair branches."""
import copy
import json
from pathlib import Path
import subprocess
import unittest
from unittest.mock import patch

import current_runtime_ownership as owner
import g154_host_source as host
import g155_plate_source as plate
import g153_repair_source as repair


class PlateSource(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.actual = owner.runtime_files()

    def test_complete_layer_recovers_exact_host154_then_repair153(self):
        previous = plate.predecessor_runtime(self.actual)
        self.assertEqual(previous, plate.preceding_files())
        self.assertEqual(host.predecessor_runtime(previous), host.preceding_files())
        self.assertEqual(repair.predecessor_runtime(self.actual), repair.preceding_files())
        self.assertEqual(len(self.actual), len(previous))
        with self.assertRaises(ValueError):
            plate.predecessor_runtime(previous)

    def test_plate_sources_are_exact_imports_and_host_helpers_remain_unchanged(self):
        for path in plate.IMPORTED:
            imported = subprocess.check_output(['git', 'show', plate.IMPORT_COMMIT + ':' + path], cwd=plate.ROOT)
            self.assertEqual(self.actual[path], imported)
        for path in [host.BP + '/host-extensions/board-api.json', *host.ADDED,
                     host.BP + '/scripts/host_api/oil_api_host.js']:
            self.assertEqual(self.actual[path], plate.preceding_files()[path])

    def test_mutated_reverted_extra_missing_or_foreign_runtime_is_rejected(self):
        for kind in ['plate', 'revert', 'host', 'extra', 'missing']:
            actual = dict(self.actual)
            path = plate.BP + '/scripts/plate_transaction_core.js'
            if kind == 'plate': actual[path] += b'!'
            if kind == 'revert': actual[path] = plate.preceding_files()[path]
            if kind == 'host': actual[host.BP + '/scripts/host_api/oil_api_host.js'] += b'!'
            if kind == 'extra': actual[plate.BP + '/scripts/unreviewed.js'] = b'new'
            if kind == 'missing': del actual[next(iter(host.ADDED))]
            with self.subTest(kind=kind), self.assertRaises(ValueError):
                plate.predecessor_runtime(actual)

    def test_warm_admission_rechecks_all_owned_runtime_and_metadata(self):
        plate.predecessor_runtime(self.actual)
        read = Path.read_bytes
        for path in plate.PATHS:
            target = plate.ROOT / path
            def changed(p): return read(p) + b'!' if p == target else read(p)
            with self.subTest(path=path), patch.object(Path, 'read_bytes', changed), self.assertRaises(ValueError):
                plate.predecessor_runtime(self.actual)

    def test_reference_accepts_only_exact155_or154_endpoints(self):
        for path in plate.PATHS:
            before, after = plate.preceding_bytes(path), (plate.ROOT / path).read_bytes()
            self.assertEqual(plate.reference_bytes(path, before), before)
            self.assertEqual(plate.reference_bytes(path, after), before)
            with self.assertRaises(ValueError): plate.reference_bytes(path, after + b'!')
        path = plate.BP + '/manifest.json'
        with self.assertRaises(ValueError): plate.reference_bytes(path, host.preceding_files()[path])
        with self.assertRaises(ValueError): plate.reference_bytes('../outside', b'any')

    def test_forged_scope_source_or_native_claim_is_not_authority(self):
        for key, value in [('predecessor_commit', '0' * 40), ('version', [2, 8, 154]),
                           ('native_acceptance', True), ('client_acceptance', True),
                           ('imported_plate_source', {'commit': 'unreviewed'})]:
            forged = copy.deepcopy(plate.ledger()); forged[key] = value
            raw = json.dumps(forged).encode()
            with self.subTest(key=key), patch.object(plate, 'LEDGER_SHA256', plate.sha(raw)), self.assertRaises(ValueError):
                plate.ledger(raw)

    def test_current_main_builder_and_version_inverse_keep_all_prior_guards(self):
        import build_slime_frame_selector as selector
        text = selector.MAIN.read_text()
        self.assertEqual(selector.install_main(text), text)
        with self.assertRaises(ValueError): selector.install_main(text + '\nforeign();\n')
        self.assertEqual(plate.predecessor_version([2, 8, 155]), [2, 8, 154])
        self.assertEqual(repair.predecessor_version([2, 8, 155]), [2, 8, 152])


if __name__ == '__main__':
    unittest.main()
