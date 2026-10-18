"""Exact G154 inverse, hostile deltas, and immutable G153 composition."""
import copy
import json
import tempfile
import unittest
from pathlib import Path
from types import MappingProxyType
from unittest.mock import patch
import g154_plate_source as plate


class PlateAdmission(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.a = plate.BP + '/scripts/a.js'
        self.b = plate.RP + '/untouched.bin'
        self.manifest = plate.BP + '/manifest.json'
        self.before = {self.a: b'old a', self.b: b'untouched',
                       self.manifest: json.dumps({'header': {'version': [2, 8, 153]}}).encode()}
        self.after = {**self.before, self.a: b'new a',
                      self.manifest: json.dumps({'header': {'version': [2, 8, 154]}}).encode()}
        self.owners = {self.a: 'test_plate_owner', self.manifest: 'test_identity'}
        for path, data in self.after.items():
            target = self.root / path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
        self.doc = {'schema': 1, 'predecessor_commit': plate.PREVIOUS,
                    'predecessor_tree': plate.PREVIOUS_TREE,
                    'predecessor_version': [2, 8, 153], 'version': [2, 8, 154],
                    'evidence_scope': 'source_only', 'native_acceptance': False,
                    'client_acceptance': False,
                    'changes': {path: {'owner': owner, 'operation': 'modify',
                                      'before_sha256': plate.sha(self.before[path]),
                                      'after_sha256': plate.sha(self.after[path])}
                                for path, owner in self.owners.items()}}
        self.raw = (json.dumps(self.doc, indent=2) + '\n').encode()
        self.ledger = self.root / 'ledger.json'
        self.ledger.write_bytes(self.raw)
        self.context = patch.multiple(plate, ROOT=self.root,
                                      OWNERS=MappingProxyType(self.owners), PATHS=frozenset(self.owners),
                                      RUNTIME_PATHS=frozenset(self.owners), LEDGER=self.ledger,
                                      LEDGER_SHA256=plate.sha(self.raw))
        self.context.start()
        self.addCleanup(self.context.stop)
        previous = patch.object(plate, 'preceding_files', return_value=MappingProxyType(self.before))
        previous.start()
        self.addCleanup(previous.stop)

    def test_exact_inverse_is_immutable_and_version_is_admitted(self):
        self.assertEqual(plate.predecessor_runtime(self.after), self.before)
        self.assertEqual(plate.reference_bytes(self.a, b'new a'), b'old a')
        self.assertEqual(plate.historical_bytes(self.a), b'old a')
        self.assertEqual(plate.predecessor_version([2, 8, 154]), [2, 8, 153])
        self.assertEqual(plate.predecessor_version([2, 8, 155]), [2, 8, 155])
        with self.assertRaises(TypeError):
            plate.expected_files()['unknown'] = b''

    def test_owned_unowned_added_deleted_reverted_and_double_inverse_fail(self):
        for operation in ('owned', 'unowned', 'addition', 'deletion', 'revert', 'double_inverse'):
            files = dict(self.after)
            if operation == 'owned': files[self.a] += b'!'
            elif operation == 'unowned': files[self.b] += b'!'
            elif operation == 'addition': files[plate.BP + '/unknown'] = b'new'
            elif operation == 'deletion': del files[self.b]
            elif operation == 'revert': files[self.a] = self.before[self.a]
            else: files = self.before
            with self.subTest(operation=operation), self.assertRaises(ValueError):
                plate.predecessor_runtime(files)
        with self.assertRaises(ValueError):
            plate.reference_bytes(self.a, self.before[self.a])

    def test_supplied_bytes_never_fall_back_to_live_source(self):
        real = Path.read_bytes
        def read(path):
            if path == self.root / self.a:
                raise AssertionError('Supplied postimage fell back to disk')
            return real(path)
        with patch.object(Path, 'read_bytes', read):
            self.assertEqual(plate.reference_bytes(self.a, self.after[self.a]), self.before[self.a])
            with self.assertRaises(ValueError):
                plate.reference_bytes(self.a, b'forged')

    def test_warm_admission_rechecks_working_postimage_and_ledger(self):
        self.assertEqual(plate.predecessor_runtime(self.after), self.before)
        target = self.root / self.a
        target.write_bytes(b'forged')
        with self.assertRaises(ValueError): plate.predecessor_runtime(self.after)
        target.write_bytes(self.after[self.a])
        self.assertEqual(plate.predecessor_runtime(self.after), self.before)
        self.ledger.write_bytes(self.raw + b' ')
        with self.assertRaises(ValueError): plate.predecessor_runtime(self.after)

    def test_recomputed_candidate_hashes_are_not_authority(self):
        forged = copy.deepcopy(self.doc)
        forged['changes'][self.a]['after_sha256'] = plate.sha(b'forged')
        with self.assertRaises(ValueError): plate.ledger(json.dumps(forged).encode())
        for key, value in [('predecessor_commit', '0' * 40), ('predecessor_tree', '0' * 40),
                           ('version', [2, 8, 155]), ('predecessor_version', [2, 8, 152]),
                           ('native_acceptance', True), ('client_acceptance', True),
                           ('evidence_scope', 'native')]:
            forged = copy.deepcopy(self.doc); forged[key] = value
            raw = json.dumps(forged).encode()
            with self.subTest(key=key), patch.object(plate, 'LEDGER_SHA256', plate.sha(raw)), self.assertRaises(ValueError):
                plate.ledger(raw)
        for change in ('owner', 'operation', 'scope'):
            forged = copy.deepcopy(self.doc)
            if change == 'scope': forged['changes'][plate.BP + '/unknown'] = forged['changes'].pop(self.a)
            else: forged['changes'][self.a][change] = 'unreviewed'
            raw = json.dumps(forged).encode()
            with self.subTest(change=change), patch.object(plate, 'LEDGER_SHA256', plate.sha(raw)), self.assertRaises(ValueError):
                plate.ledger(raw)

    def test_unowned_and_escaping_paths_have_no_inverse(self):
        for path in (self.b, '../outside', self.root.parent / 'outside'):
            with self.subTest(path=path), self.assertRaises(ValueError):
                plate.reference_bytes(path, b'anything')

    def test_unsealed_layer_cannot_admit_runtime_or_current_version(self):
        with patch.object(plate, 'LEDGER_SHA256', None):
            with self.assertRaises(ValueError): plate.predecessor_runtime(self.after)
            with self.assertRaises(ValueError): plate.predecessor_version([2, 8, 154])


if __name__ == '__main__':
    unittest.main()
