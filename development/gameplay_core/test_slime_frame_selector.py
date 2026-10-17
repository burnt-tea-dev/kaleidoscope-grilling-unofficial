"""Source-only held slime selector checks. No native clock/renderer claim."""
import copy
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
P = ROOT / 'projects/grilling'
RP = P / 'gameplay_core/resource_pack'

def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))

def candidate(stage, frame):
    return f'slime_frame_{frame}' if stage == 0 else (f'slime_bite_{stage}' if frame == 0 else f'slime_frame_{frame}_bite_{stage}')

def expected_cubes(stage, frame):
    g = read(P / f'resource_pack/models/entity/kg_a1/{candidate(stage, frame)}.geo.json')['minecraft:geometry'][0]
    cubes = [copy.deepcopy(c) for b in g['bones'] for c in b.get('cubes', [])]
    for c in cubes:
        c['origin'][1] += 24
        if 'pivot' in c:
            c['pivot'][1] += 24
    return cubes

class SlimeFrameSelector(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.att = read(RP / 'attachables/grilled_slime_skewer.attachable.json')['minecraft:attachable']['description']
        cls.geos = {g['description']['identifier']: g for p in (RP / 'models').rglob('*.json') for g in read(p).get('minecraft:geometry', [])}

    def test_historical_negative_control_five_effective_wrong_bodies(self):
        # Historical files remain provenance; actual repaired attachable must stop selecting them.
        wrong = []
        for stage in range(3):
            g = self.geos[f'geometry.kg_a287.kg_a22.grilled_slime_skewer.stage{stage}']
            body = [c for b in g['bones'] for c in b.get('cubes', [])]
            for frame in range(5):
                if body != expected_cubes(stage, frame):
                    wrong.append((stage, frame))
        self.assertEqual(wrong, [(0, 0), (0, 1), (0, 2), (0, 3), (1, 2)])

    def test_actual_attachable_selects_every_stage_frame(self):
        self.assertIn('controller.render.kg_slime.frame', self.att['render_controllers'])
        rc = read(RP / 'render_controllers/slime_frame.render_controllers.json')['render_controllers']['controller.render.kg_slime.frame']
        self.assertEqual(rc['geometry'], 'Array.kg_slime_geo[v.kg_slime_index]')
        self.assertEqual(rc['textures'], ['Array.kg_slime_tex[v.kg_slime_index]'])
        specs = {s['name']: s for s in read(P / 'config/asset_specs.json')['candidates']}
        for stage in range(3):
            for frame in range(5):
                with self.subTest(stage=stage, frame=frame):
                    i = stage * 5 + frame
                    alias = rc['arrays']['geometries']['Array.kg_slime_geo'][i].split('.')[1]
                    g = self.geos[self.att['geometry'][alias]]
                    self.assertEqual([c for b in g['bones'] for c in b.get('cubes', [])], expected_cubes(stage, frame))
                    self.assertEqual([b['name'] for b in g['bones']], ['grip', 'skewer_pose', 'skewer_model'])
                    self.assertEqual(g['bones'][0]['binding'], 'q.item_slot_to_bone_name(context.item_slot)')
                    alias = rc['arrays']['textures']['Array.kg_slime_tex'][i].split('.')[1]
                    tex = RP / (self.att['textures'][alias] + '.png')
                    source = P / ('resource_pack/textures/kg_a1/' + specs[candidate(stage, frame)]['atlas_name'] + '.png')
                    self.assertEqual(tex.read_bytes(), source.read_bytes())

    def test_java_ordered_overrides_resolve_all_fifteen_source_models(self):
        path = P / 'source_snapshots/common/src/main/resources/assets/kaleidoscope_grilling/models/item/grilled_slime_skewer.json'
        model = read(path)
        specs = {s['name']: s for s in read(P / 'config/asset_specs.json')['candidates']}
        for stage in range(3):
            for frame in range(5):
                state = {'kaleidoscope_grilling:skewer_bite_stage': stage / 4,
                         'kaleidoscope_grilling:slime_skewer_frame': frame / 4}
                selected = model['parent']
                for override in model['overrides']:
                    if all(state.get(k, 0) >= threshold for k, threshold in override['predicate'].items()):
                        selected = override['model']
                self.assertEqual(selected, specs[candidate(stage, frame)]['source_model'])

    def test_main_wrapper_is_exact_reversible_and_rejects_moved_or_duplicate_rows(self):
        import sys
        sys.path.insert(0, str(ROOT / 'tools'))
        from build_slime_frame_selector import strip_main, install_main, MAIN_SAMPLE, MAIN_SYNC
        current = (P / 'gameplay_core/behavior_pack/scripts/main.js').read_text()
        self.assertEqual(install_main(current), current)
        from effect_merge_source_witness import restore_main as restore_effect
        from skewer_content_source import historical_bytes
        current = restore_effect(historical_bytes(P / 'gameplay_core/behavior_pack/scripts/main.js', current.encode()).decode())
        plain = strip_main(current)
        self.assertEqual(install_main(plain), current)
        self.assertEqual(install_main(current), current)
        for bad in (current + MAIN_SYNC, current.replace(MAIN_SAMPLE, ''),
                    current.replace(MAIN_SAMPLE, '') + MAIN_SAMPLE):
            with self.assertRaises(ValueError):
                strip_main(bad)

    def test_historical_witness_rejects_unreviewed_bytes_before_recovery(self):
        import sys
        sys.path.insert(0, str(ROOT / 'tools'))
        from slime_frame_source_witness import reference_bytes, pinned_bytes, PREVIOUS_SLIME_BASE, MAIN_PATH, ATTACHABLE_PATH
        from skewer_content_source import historical_bytes
        for relative in (MAIN_PATH, ATTACHABLE_PATH):
            path = ROOT / relative
            current = historical_bytes(path)
            self.assertEqual(reference_bytes(path, current), pinned_bytes(PREVIOUS_SLIME_BASE, relative))
            for corrupted in (current + b' ', pinned_bytes(PREVIOUS_SLIME_BASE, relative)):
                with self.assertRaisesRegex(AssertionError, 'reviewed complete bytes'):
                    reference_bytes(path, corrupted)
        doc = read(ROOT / ATTACHABLE_PATH)
        d = doc['minecraft:attachable']['description']
        for key in ('fp_right', 'tp_right'):
            changed = copy.deepcopy(doc)
            changed['minecraft:attachable']['description']['animations'][key] = 'animation.unrelated'
            with self.assertRaises(AssertionError):
                reference_bytes(ROOT / ATTACHABLE_PATH, (json.dumps(changed, indent=2)+'\n').encode())

    def test_guarded_continuation_preserves_frozen_slime_postimage(self):
        import sys
        sys.path.insert(0, str(ROOT / 'tools'))
        from eating_owner_properties import document
        from slime_frame_source_witness import reference_bytes, pinned_bytes, REVIEWED_SLIME_BASE, PREVIOUS_SLIME_BASE, ATTACHABLE_PATH
        path = ROOT / ATTACHABLE_PATH
        historical = pinned_bytes(REVIEWED_SLIME_BASE, ATTACHABLE_PATH)
        guarded = document(json.loads(historical))
        encoded = lambda doc: (json.dumps(doc, ensure_ascii=False, indent=2)+'\n').encode()
        self.assertEqual(reference_bytes(path, encoded(guarded)), pinned_bytes(PREVIOUS_SLIME_BASE, ATTACHABLE_PATH))
        self.assertEqual(reference_bytes(path, historical), pinned_bytes(PREVIOUS_SLIME_BASE, ATTACHABLE_PATH))
        for mutation in ('missing_guard', 'wrong_fallback', 'unrelated'):
            bad = copy.deepcopy(guarded)
            description = bad['minecraft:attachable']['description']
            if mutation == 'missing_guard':
                description['scripts']['pre_animation'].pop(0)
            elif mutation == 'wrong_fallback':
                description['scripts']['pre_animation'][0] = description['scripts']['pre_animation'][0].replace(': 0)', ': 1)')
            else:
                description['materials']['default'] = 'unrelated'
            with self.subTest(mutation=mutation), self.assertRaisesRegex(AssertionError, 'reviewed complete bytes'):
                reference_bytes(path, encoded(bad))
        with self.assertRaisesRegex(AssertionError, 'reviewed complete bytes'):
            reference_bytes(path, encoded(guarded)+b' ')

    def test_projection_admission_preserved_and_extra_alias_mutations_rejected(self):
        import sys
        sys.path.insert(0, str(ROOT / 'tools'))
        from build_java_eating_projection import fixed_geometry
        self.assertTrue(fixed_geometry(self.att))
        for mutation in ('missing', 'wrong', 'foreign', 'extra'):
            d = copy.deepcopy(self.att)
            if mutation == 'missing':
                del d['geometry']['slime_s2_f4']
            elif mutation == 'wrong':
                d['geometry']['slime_s0_f0'] = d['geometry']['slime_s0_f1']
            elif mutation == 'foreign':
                d['identifier'] = 'kaleidoscope_grilling:raw_slime_skewer'
            else:
                d['geometry']['slime_s3_f0'] = d['geometry']['slime_s0_f0']
            self.assertFalse(fixed_geometry(d), mutation)

    def test_frame_input_is_global_and_independent_of_eating(self):
        rows = self.att['scripts']['pre_animation']
        frame = next(row for row in rows if row.startswith('v.kg_slime_frame = '))
        self.assertIn('v.kg_slime_marker >= 215 && v.kg_slime_marker <= 219', frame)
        self.assertIn('c.owning_entity->q.is_item_name_any', frame)
        self.assertIn('v.kg_slime_marker - 215 : 0;', frame)
        self.assertNotIn('q.is_using_item', frame)
        self.assertNotIn('c.is_first_person', frame)
        self.assertNotIn('q.time_stamp', str(rows))
        self.assertIn('v.kg_slime_index = math.clamp(math.floor(v.kg_bite_stage), 0, 2) * 5 + v.kg_slime_frame;', rows)
        # These test the formula's contract, not the native query's semantics.
        for tick, expected in [(0,0),(3,0),(4,1),(7,1),(8,2),(11,2),(12,3),(15,3),(16,4),(19,4),(20,0)]:
            self.assertEqual((tick // 4) % 5, expected)
        self.assertEqual(len(read(P / 'gameplay_core/behavior_pack/entities/player.json')['minecraft:entity']['description']['properties']), 32)

if __name__ == '__main__':
    unittest.main()
