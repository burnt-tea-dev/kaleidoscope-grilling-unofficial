"""Regression tests for bridge. authoring/export guards (no simulated players)."""
from pathlib import Path
import copy
import json
import validate as assets
import sys
import subprocess
import tempfile
import unittest
from unittest.mock import patch
import zipfile
import bridge_project as guard

class BridgeProjectTests(unittest.TestCase):
    def test_current_project(self):
        self.assertEqual(len(guard.check()['packs']), 2)

    def test_current_project_rejects_invalid_executable_declarations(self):
        load = guard.load
        baseline = load(guard.ROOT / 'baseline.json')
        cases = [
            ('BP', 'missing-entry'), ('BP', 'unsafe-entry'),
            ('BP', 'missing-script'), ('BP', 'duplicate-data'),
            ('BP', 'language'), ('BP', 'header-float'),
            ('RP', 'module-float'), ('RP', 'pbr'), ('RP', 'engine'),
        ]
        for side, damage in cases:
            manifest_path = guard.ROOT / baseline['runtime'][side] / 'manifest.json'
            def invalid(path):
                value = load(path)
                if path != manifest_path:
                    return value
                if damage in ('missing-entry', 'unsafe-entry', 'missing-script', 'language'):
                    script = next(module for module in value['modules'] if module['type'] == 'script')
                    if damage == 'missing-entry': script['entry'] = 'scripts/does-not-exist.js'
                    elif damage == 'unsafe-entry': script['entry'] = '../resource_pack/manifest.json'
                    elif damage == 'missing-script': script['type'] = 'data'
                    else: script['language'] = 'python'
                elif damage == 'duplicate-data': value['modules'].append(copy.deepcopy(value['modules'][0]))
                elif damage == 'header-float': value['header']['version'] = list(map(float, baseline['version']))
                elif damage == 'module-float': value['modules'][0]['version'] = list(map(float, baseline['version']))
                elif damage == 'pbr': value['capabilities'] = []
                else: value['header']['min_engine_version'] = [1, 21, 119]
                return value
            with self.subTest(side=side, damage=damage), patch.object(guard, 'load', invalid):
                with self.assertRaises(AssertionError):
                    guard.check()

    def test_pack_rejects_missing_relative_script_import(self):
        baseline = guard.load(guard.ROOT / 'baseline.json')
        manifest = guard.load(guard.ROOT / baseline['runtime']['BP'] / 'manifest.json')
        with tempfile.TemporaryDirectory() as temporary:
            folder = Path(temporary)
            (folder / 'scripts').mkdir()
            (folder / 'scripts/main.js').write_text("import './core.js';")
            (folder / 'scripts/core.js').write_text('export const ready = true;')
            guard.check_pack_structure(folder, manifest, 'BP', baseline['version'])
            (folder / 'scripts/core.js').unlink()
            with self.assertRaisesRegex(AssertionError, 'missing or unsafe relative import'):
                guard.check_pack_structure(folder, manifest, 'BP', baseline['version'])

    def test_pack_rejects_platform_specific_entry_paths(self):
        baseline = guard.load(guard.ROOT / 'baseline.json')
        folder = guard.ROOT / baseline['runtime']['BP']
        manifest = guard.load(folder / 'manifest.json')
        script = next(module for module in manifest['modules'] if module['type'] == 'script')
        for entry in ['C:/scripts/main.js', 'scripts/main.js:stream', 'scripts\\main.js']:
            script['entry'] = entry
            with self.subTest(entry=entry), self.assertRaisesRegex(AssertionError, 'unsafe script entry'):
                guard.check_pack_structure(folder, manifest, 'BP', baseline['version'])

    def test_project_rejects_stale_export_name_at_each_authoring_entry(self):
        load = guard.load
        for relative in ['config.json', 'projects/grilling/gameplay_core/config.json']:
            config_path = guard.ROOT / relative
            def stale(path):
                value = load(path)
                if path == config_path:
                    value['compiler']['plugins'][0][1]['packName'] = 'Kaleidoscope_Grilling_2_8_154_Canonical'
                return value
            with self.subTest(config=relative), patch.object(guard, 'load', stale):
                with self.assertRaisesRegex(AssertionError, 'bridge build name|nested bridge compiler'):
                    guard.check()

    def test_current_project_rejects_stale_cookery_description_on_either_pack(self):
        load = guard.load
        baseline = load(guard.ROOT / 'baseline.json')
        for side in ['BP', 'RP']:
            manifest_path = guard.ROOT / baseline['runtime'][side] / 'manifest.json'
            def stale(path):
                value = load(path)
                if path == manifest_path:
                    value['header']['description'] = value['header']['description'].replace('Cookery 1.6.2', 'Cookery 1.6.1')
                return value
            with self.subTest(side=side), patch.object(guard, 'load', stale):
                with self.assertRaisesRegex(AssertionError, 'stale displayed Cookery requirement'):
                    guard.check()



    def test_workflow_propagates_native_failures(self):
        # A later successful command must not mask a failed export/baseline guard
        # under PowerShell (ErrorActionPreference alone does not ensure this).
        workflow = guard.ROOT / '.github/workflows/bridge-project.yml'
        lines = workflow.read_text(encoding='utf-8').splitlines()
        commands = [i for i, line in enumerate(lines)
                    if line.strip().startswith(('python ', 'git diff ', '& '))]
        self.assertTrue(commands, 'expected native validation commands')
        for i in commands:
            with self.subTest(command=lines[i].strip()):
                self.assertLess(i + 1, len(lines))
                self.assertEqual(lines[i + 1].strip(),
                                 'if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }')

    def test_required_windows_checkouts_enable_long_paths(self):
        # Java source fixtures exceed MAX_PATH under the hosted runner prefix.
        # Set Git's opt-in before checkout, for the retained bridge export job.
        workflows = guard.ROOT / '.github/workflows'
        for name, setting, checkout in (
            ('bridge-project.yml', 'git config --global core.longpaths true',
             '- uses: actions/checkout@'),
        ):
            with self.subTest(workflow=name):
                windows = (workflows / name).read_text(encoding='utf-8').split(
                    'runs-on: windows-latest', 1)[1]
                self.assertIn(setting, windows)
                self.assertLess(windows.index(setting), windows.index(checkout))

    def test_duplicate_json_key(self):
        with self.assertRaises(ValueError):
            guard.parse('{"version":1,"version":2}')

    def test_byte_identical(self):
        self.assertTrue(guard.compare_pack({'x.png': b'abc'}, {'x.png': b'abc'}, 'RP')['content_matches'])

    def test_json_whitespace(self):
        self.assertEqual(guard.compare_pack({'a.json': b'{"a":1}'}, {'a.json': b'{ "a": 1 }'}, 'BP')['json_formatting_only'], ['a.json'])

    def test_missing_file(self):
        with self.assertRaises(AssertionError):
            guard.compare_pack({'a.png': b'a'}, {}, 'RP')

    def test_extra_file(self):
        with self.assertRaises(AssertionError):
            guard.compare_pack({}, {'a.png': b'a'}, 'RP')

    def test_binary_drift(self):
        with self.assertRaises(AssertionError):
            guard.compare_pack({'a.png': b'a'}, {'a.png': b'b'}, 'RP')

    def test_version_drift(self):
        with self.assertRaises(AssertionError):
            guard.compare_pack({'manifest.json': b'{"version":[1,0,0]}'}, {'manifest.json': b'{"version":[1,0,1]}'}, 'BP')

    def test_metadata_drift(self):
        with self.assertRaises(AssertionError):
            guard.compare_pack({'manifest.json': b'{}'}, {'manifest.json': b'{"metadata":{"generated_with":{}}}'}, 'BP')

    def test_project_archive(self):
        with tempfile.TemporaryDirectory() as tmp:
            dest = Path(tmp) / 'test.brproject'
            guard.build_project(dest)
            baseline = guard.load(guard.ROOT / 'baseline.json')
            with zipfile.ZipFile(dest) as z:
                self.assertIsNone(z.testzip())
                self.assertEqual(guard.parse(z.read('config.json')), guard.load(guard.ROOT / 'config.json'))
                expected = {'config.json'}
                for rel in baseline['runtime'].values():
                    for name, data in guard.inventory(guard.ROOT / rel).items():
                        item = rel + '/' + name
                        expected.add(item)
                        self.assertEqual(z.read(item), data)
                self.assertEqual(set(z.namelist()), expected)

class UnusedAssetCandidateTests(unittest.TestCase):
    def test_candidates_preserve_arrays_same_file_and_external_references(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            rp = root / 'rp'
            def write(rel, value):
                path = root / rel
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(json.dumps(value))
                return path
            mixed = write('rp/models/mixed.geo.json', {'minecraft:geometry': [
                {'description': {'identifier': 'geometry.test.live'}, 'bones': []},
                {'description': {'identifier': 'geometry.test.dead'}, 'bones': []},
                {'description': {'identifier': 'geometry.test.self'}, 'consumer': 'geometry.test.self'},
            ]})
            write('rp/controllers.json', {'arrays': {'geometries': {'array.g': ['geometry.test.live']}}})
            write('rp/models/old.geo.json', {'geometry.test.legacy': {'bones': []}})
            texture = rp / 'textures/dead.png'
            texture.parent.mkdir()
            texture.write_bytes(b'fixture')
            files = [p for p in root.rglob('*') if p.is_file()]
            result = assets.scan(root, rp, files)
            self.assertEqual(result['errors'], [])
            self.assertEqual({x['id'] for x in result['geometry_candidates']},
                             {'geometry.test.dead', 'geometry.test.legacy'})
            self.assertNotIn('rp/models/mixed.geo.json', result['whole_geometry_file_candidates'])
            self.assertEqual(result['whole_geometry_file_candidates'], ['rp/models/old.geo.json'])
            self.assertEqual(len(result['texture_candidates']), 1)
            self.assertFalse(result['deletion_authorized'])
            consumer = root / 'family'
            external = write('family/consumer.json', {'g': 'geometry.test.dead', 't': 'textures/dead'})
            result = assets.scan(root, rp, files, [('family', consumer, [external])])
            self.assertEqual([x['id'] for x in result['geometry_candidates']], ['geometry.test.legacy'])
            self.assertEqual(result['texture_candidates'], [])

    def test_candidate_scan_retains_historical_identifiers_and_escaped_script_strings(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            rp = root / 'rp'
            (rp / 'models').mkdir(parents=True)
            model = rp / 'models/old.geo.json'
            model.write_text('{' + '"minecraft:geometry": [{"description": {"identifier": "geometry.test.old"}}]}')
            history = root / 'history.json'
            history.write_text('{"negative_reference": "geometry.test.old"}')
            (rp / 'textures').mkdir()
            texture = rp / 'textures/test.png'
            texture.write_bytes(b'fixture')
            script = root / 'consumer.js'
            script.write_text(r'const t = "textures\/te\u0073t";')
            result = assets.scan(root, rp, [model, history, texture, script])
            self.assertEqual(result['geometry_candidates'], [])
            self.assertEqual(result['texture_candidates'], [])

    def test_reference_index_keeps_overlapping_substrings(self):
        needles = {'geometry.x', 'geometry.x.contents', 'textures/a', 'a', 'missing'}
        sources = [('one', 'geometry.x.contents textures/a.png'), ('two', 'baaa')]
        found = assets.reference_index(needles, sources)
        for needle in needles:
            self.assertEqual(found[needle], {name for name, text in sources if needle in text})

    def test_cli_rejects_directory_and_file_consumer_symlinks(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / 'rp').mkdir()
            (root / 'baseline.json').write_text(json.dumps({'runtime': {'RP': 'rp'}}))
            consumer, outside = root / 'family', root / 'outside'
            consumer.mkdir()
            outside.mkdir()
            reference = outside / 'reference.json'
            reference.write_text('{"geometry": "geometry.external"}')
            try:
                (consumer / 'linked-directory').symlink_to(outside, target_is_directory=True)
                (consumer / 'linked-file.json').symlink_to(reference)
            except OSError as exc:
                if getattr(exc, 'winerror', None) == 1314:
                    self.skipTest('Windows symlink creation privilege is unavailable')
                raise
            with patch.object(assets, 'ROOT', root), \
                    patch.object(assets.subprocess, 'check_output', return_value=b''), \
                    patch.object(sys, 'argv', ['validate.py', 'unused-assets',
                                              '--consumer-root', str(consumer)]), \
                    patch('builtins.print') as output:
                self.assertEqual(assets.main(), 1)
            output.assert_called_once()
            result = json.loads(output.call_args.args[0])
            self.assertEqual({entry['source'] for entry in result['errors']},
                             {'consumer-0:linked-directory', 'consumer-0:linked-file.json'})
            self.assertTrue(all(entry['error'] == 'symlink input requires manual review'
                                for entry in result['errors']))
            self.assertEqual(result['scanned_text_files'], 0)
            self.assertFalse(result['deletion_authorized'])

    def test_candidate_scan_reports_parse_duplicates_and_missing_sources(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            rp = root / 'rp'
            rp.mkdir()
            broken = root / 'broken.json'
            broken.write_text('{"a": 1, "a": 2}')
            result = assets.scan(root, rp, [broken, root / 'absent.js'])
            self.assertEqual(len(result['errors']), 2)
            models = rp / 'models'
            models.mkdir()
            data = {'minecraft:geometry': [{'description': {'identifier': 'geometry.duplicate'}}]}
            first, second = models / 'a.json', models / 'b.json'
            first.write_text(json.dumps(data))
            second.write_text(json.dumps(data))
            duplicate = assets.scan(root, rp, [first, second])
            self.assertTrue(any(x['error'] == 'duplicate geometry definition' for x in duplicate['errors']))
            first.write_text('{"format_version": "unknown"}')
            unknown = assets.scan(root, rp, [first])
            self.assertTrue(any(x['error'] == 'unsupported geometry schema' for x in unknown['errors']))
            self.assertFalse(result['deletion_authorized'])


if __name__ == '__main__':
    unittest.main()
