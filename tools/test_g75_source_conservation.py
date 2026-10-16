"""G75 combines two distinct G73 identities without relaxing byte conservation."""
import copy
import hashlib
import json
import unittest
from pathlib import Path
from unittest.mock import patch

import public_source_witness as public


class G75SourceConservationTests(unittest.TestCase):
    def test_historical_published_and_local_main_identities_stay_distinct(self):
        cases = (
            ((2, 8, 70), False, '42a4096faada55381ffd0af37a8c46064dfc34d4e5875a325a21e477f0caace2'),
            ((2, 8, 71), True, '74d1e8b16018d6a9b495a84134ff05c7c025186d5f6fc13ffbba0c1a598dea60'),
            ((2, 8, 72), True, '9070dc08eade5351114c23a576dcd426b885889af4b6398e0b03ce6d9cf2d295'),
            ((2, 8, 73), True, '2a742d2634fdf28d49ba7dc627b2210d44d6a169cf8cc56963801ad507fb9c9d'),
            ((2, 8, 73), False, '14eb1a4b778241a7590c09ecc53b12abfe516d303dc90c0de9258ddc53f893cb'),
        )
        for version, local_bottles, digest in cases:
            with self.subTest(version=version, local_bottles=local_bottles):
                source = public.expected_main_bytes(version, local_bottles=local_bottles)
                self.assertEqual(hashlib.sha256(source).hexdigest(), digest)

    def test_both_conservation_entrypoints_expect_the_same_combined_g75(self):
        self.assertEqual(hashlib.sha256(public.expected_main_bytes((2,8,78))).hexdigest(), 'c01d01737c5124df0eacb032817c25c271bfa905b55a140c80efe39bb42d1727')
        current=json.loads((public.ROOT/'baseline.json').read_text())['version']
        expected=public.expected_main_bytes(current)
        self.assertEqual(expected,public.expected_main_bytes(current,local_bottles=True))
        path = public.ROOT / public.MAIN_PATH
        from eating_owner_context import reference_bytes
        self.assertEqual(reference_bytes(path), expected)
        public.assert_public_bytes(self, path)
        public.assert_public_bytes_with_g71_bottles(self, path)

    def test_combined_source_rejects_regressions_in_either_lineage_and_unrelated_bytes(self):
        path = public.ROOT / public.MAIN_PATH
        source = path.read_bytes()
        version=tuple(json.loads((public.ROOT/'baseline.json').read_text())['version'])
        metal_import=(b"import {handleHeavyMetalBeforeHurt,forgetHeavyMetalRescue} from './heavy_metal_damage_runtime.js';\n"
                      if version>=(2,8,119) else b"import {definitelyLethalProvisionalHealth} from './heavy_metal_damage_core.js';\n")
        mutations = (
            (metal_import, b''),
            (b"import {retargetBottleFillStack,prepareBottleFillItems} from './bottle_fill_item_runtime.js';\n", b''),
            (b' ordinaryFatalFeedback(player);\n', b''),
            (b' const id=canonicalFoodId(eaten.typeId);dangerousPreservation(player,id);', b' const id=eaten.typeId;dangerousPreservation(player,id);'),
            (b'MINIMUM_EAT_TICKS=25', b'MINIMUM_EAT_TICKS=1'),
            (b'used+1<a.nativeDuration',b'used<a.nativeDuration'),
            (b'e.useDuration>0',b'e.useDuration>=0'),
        )
        changed_sources = [source + b'\n']
        for before, after in mutations:
            self.assertEqual(source.count(before), 1)
            changed_sources.append(source.replace(before, after))
        for changed in changed_sources:
            with self.subTest(digest=hashlib.sha256(changed).hexdigest()):
                with patch.object(Path, 'read_bytes', return_value=changed):
                    with self.assertRaises(AssertionError):
                        public.assert_public_bytes(self, path)
                    with self.assertRaises(AssertionError):
                        public.assert_public_bytes_with_g71_bottles(self, path)

    def test_conflicting_g75_proposals_are_never_inferred_from_version_alone(self):
        with self.assertRaises(AssertionError):public.expected_main_bytes((2,8,75))
        seasoning=public.expected_main_bytes((2,8,75),proposal='seasoning')
        plate=public.expected_main_bytes((2,8,75),proposal='plate_alias')
        self.assertEqual(hashlib.sha256(seasoning).hexdigest(),'7788ca0e01d497e22e96a11991c6f33a96cfce6b08f1d0c93778d17d87850838')
        self.assertEqual(hashlib.sha256(plate).hexdigest(),'c01d01737c5124df0eacb032817c25c271bfa905b55a140c80efe39bb42d1727')
        self.assertNotEqual(seasoning,plate)

    def test_conflicting_g80_proposals_keep_distinct_main_source(self):
        with self.assertRaises(AssertionError):public.expected_main_bytes((2,8,80))
        jar=public.expected_main_bytes((2,8,80),proposal='jar_projection')
        stop=public.expected_main_bytes((2,8,80),proposal='checkpoint_stop')
        self.assertEqual(jar,public.expected_main_bytes((2,8,79)))
        self.assertEqual(stop,public.expected_main_bytes((2,8,81)))
        self.assertNotEqual(jar,stop)
        delta=public._main_delta('g80-main-reviewed-delta.json')
        self.assertEqual(public._apply_main_operations(jar,delta),stop)

    def test_g75_bridge_is_only_the_reviewed_plate_alias_line(self):
        published = public._main_delta('g74-main-reviewed-delta.json')
        bridge = public._main_delta('g75-main-reviewed-delta.json')
        local = public._main_delta('g73-plate-alias-main-delta.json')
        self.assertEqual(bridge['before_sha256'], published['after_sha256'])
        self.assertEqual(len(bridge['operations']), 1)
        self.assertEqual([(op['before'], op['after']) for op in bridge['operations']], [(op['before'], op['after']) for op in local['edits']])
        self.assertEqual(hashlib.sha256(public.expected_main_bytes((2,8,74))).hexdigest(), published['after_sha256'])

    def test_bridge_rejects_missing_extra_changed_or_misplaced_operations(self):
        load = public._main_delta
        original = load('g75-main-reviewed-delta.json')
        mutations = []
        changed = copy.deepcopy(original); changed['operations'].pop(); mutations.append(changed)
        changed = copy.deepcopy(original); changed['operations'].append(dict(changed['operations'][0])); mutations.append(changed)
        changed = copy.deepcopy(original); changed['operations'][0]['after'] += '\n'; mutations.append(changed)
        changed = copy.deepcopy(original); changed['operations'][0]['start'] += 1; mutations.append(changed)
        changed = copy.deepcopy(original); changed['operations'][0]['end'] += 1; mutations.append(changed)
        for key in ('before_sha256', 'after_sha256'):
            changed = copy.deepcopy(original); changed[key] = '0' * 64; mutations.append(changed)
        for changed in mutations:
            with self.subTest(delta=changed):
                with patch.object(public, '_main_delta', side_effect=lambda name: changed if name == 'g75-main-reviewed-delta.json' else load(name)):
                    with self.assertRaises(AssertionError):
                        public.expected_main_bytes((2, 8, 78))


if __name__ == '__main__':
    unittest.main()
