"""G154 owns only reviewed plate transfers and retains every G153 repair."""
import copy
import json
from pathlib import Path
import subprocess
import unittest
from unittest.mock import patch
import g154_plate_source as plate
import g153_repair_source as repair
import current_runtime_ownership as ownership

ROOT = plate.ROOT

def source(path):
    return subprocess.check_output(['git', 'show', plate.PREVIOUS + ':' + path], cwd=ROOT)


class Composition(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.actual = ownership.runtime_files()
        cls.g153 = plate.predecessor_runtime(cls.actual)

    def test_exact_runtime_inverse_preserves_every_g153_repair(self):
        self.assertEqual(self.g153, plate.preceding_files())
        self.assertEqual({p for p in self.actual if self.actual[p] != self.g153[p]}, plate.PATHS)
        self.assertEqual(repair.predecessor_runtime(self.g153), repair.preceding_files())
        result = ownership.verify_current_inventory()
        self.assertEqual(result['current_files'], 4552)
        self.assertEqual(result['g153_repair_layer_changes'], 38)
        self.assertEqual(result['g154_plate_layer_changes'], len(plate.PATHS))
        for path in ('projects/grilling/guide/catalog.a3.json',
                     plate.BP + '/scripts/guide/payload.js', plate.BP + '/scripts/guide/publisher.js'):
            self.assertEqual((ROOT / path).read_bytes(), source(path), path)

    def test_older_ledgers_and_release_history_stay_immutable(self):
        for path in ('tools/fixtures/g153-repair-reviewed-delta.json',
                     'tools/fixtures/g152-guide-recipe-reviewed-delta.json',
                     'tools/fixtures/g151-skewer-content-reviewed-delta.json'):
            self.assertEqual((ROOT / path).read_bytes(), source(path), path)
        current = json.loads((ROOT / 'release-history.json').read_bytes())
        previous = json.loads(source('release-history.json'))
        self.assertEqual({key: current[key] for key in previous}, previous)
        self.assertLessEqual(set(current) - set(previous), {'2.8.154'})
        if '2.8.154' in current:
            from baseline_gate import fingerprint
            self.assertEqual(current['2.8.154'], {side: fingerprint(ROOT / prefix)[0]
                                               for side, prefix in (('BP', plate.BP), ('RP', plate.RP))})

    def test_paired_metadata_changes_only_reviewed_identity_fields(self):
        paired = {json.loads(source(prefix + '/manifest.json'))['header']['uuid']
                  for prefix in (plate.BP, plate.RP)}
        for prefix in (plate.BP, plate.RP):
            path = prefix + '/manifest.json'
            expected = json.loads(source(path))
            expected['header']['version'] = plate.VERSION
            for module in expected['modules']: module['version'] = plate.VERSION
            for dependency in expected.get('dependencies', []):
                if dependency.get('uuid') in paired: dependency['version'] = plate.VERSION
            self.assertEqual(json.loads((ROOT / path).read_bytes()), expected)
        for path in ('config.json', 'projects/grilling/gameplay_core/config.json'):
            expected = source(path).replace(b'Kaleidoscope Grilling 2.8.153 Canonical Baseline', b'Kaleidoscope Grilling 2.8.154 Canonical Baseline').replace(b'Kaleidoscope_Grilling_2_8_153_Canonical', b'Kaleidoscope_Grilling_2_8_154_Canonical')
            self.assertEqual((ROOT / path).read_bytes(), expected)
        path = 'baseline.json'
        expected = json.loads(source(path))
        expected['version'] = plate.VERSION
        for pack in expected['packs'].values():
            for dependency in pack['dependencies']:
                if dependency.get('uuid') in paired: dependency['version'] = plate.VERSION
        current = json.loads((ROOT / path).read_bytes())
        # Before an authorized freeze the old tree remains; afterward only the
        # exact independently computed runtime fingerprint may replace it.
        from baseline_gate import fingerprint
        actual_trees = {side: fingerprint(ROOT / prefix)[0]
                        for side, prefix in (('BP', plate.BP), ('RP', plate.RP))}
        self.assertIn(current['source_trees'], (expected['source_trees'], actual_trees))
        current['source_trees'] = expected['source_trees']
        self.assertEqual(current, expected)

    def test_real_scope_mutations_reversion_and_forged_ledger_fail(self):
        for path in plate.PATHS | {plate.BP + '/scripts/main.js', plate.RP + '/animations/oil_brush.animation.json'}:
            changed = dict(self.actual); changed[path] += b'\n'
            with self.subTest(path=path), self.assertRaises(ValueError):
                ownership.validate_inventory(changed, ownership.manifest())
        for operation in ('add', 'delete', 'revert', 'double_inverse'):
            changed = dict(self.actual); path = plate.BP + '/scripts/plate_transaction_core.js'
            if operation == 'add': changed[plate.RP + '/unowned.json'] = b'{}'
            elif operation == 'delete': del changed[path]
            elif operation == 'revert': changed[path] = self.g153[path]
            else: changed = dict(self.g153)
            with self.subTest(operation=operation), self.assertRaises(ValueError):
                plate.predecessor_runtime(changed)
        forged = copy.deepcopy(plate.ledger())
        path = plate.BP + '/scripts/plate_transaction_core.js'
        forged['changes'][path]['after_sha256'] = plate.sha(self.actual[path] + b'\n')
        with self.assertRaises(ValueError): plate.ledger(json.dumps(forged).encode())
        with patch.object(plate, 'PREVIOUS_TREE', '0' * 40), self.assertRaises(ValueError):
            plate.preceding_files.__wrapped__()

    def test_g154_keeps_exact_g153_compiler_stages(self):
        import eating_compiler_pipeline as pipeline
        main = ROOT / plate.BP / 'scripts/main.js'
        context = pipeline.Context((2, 8, 154), {}, ROOT / plate.RP, main)
        g153 = pipeline.Context((2, 8, 153), {}, ROOT / plate.RP, main)
        self.assertEqual([s.name for s in pipeline.STAGES if pipeline.enabled(s, context)],
                         [s.name for s in pipeline.STAGES if pipeline.enabled(s, g153)])
        stage = pipeline.STAGES[-1]
        self.assertEqual(stage.name, 'skewer_content')
        self.assertTrue(pipeline.enabled(stage, context))
        future = pipeline.Context((2, 8, 155), {}, ROOT / plate.RP, main)
        self.assertFalse(pipeline.enabled(stage, future))
        bad = dict(self.actual); bad[plate.BP + '/scripts/plate_transaction_core.js'] += b'\n'
        with patch.object(ownership, 'runtime_files', return_value=bad), self.assertRaises(ValueError):
            pipeline.run({}, context)


if __name__ == '__main__':
    unittest.main()
