"""Regression tests for bridge. authoring/export guards (no simulated players)."""
from pathlib import Path
import copy
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

    def test_current_guide_reference_and_historical_hosts_are_exact(self):
        sys.path.insert(0, str(guard.ROOT / 'development/gameplay_core'))
        from verify_a2828 import verify_host_reference
        catalog = guard.load(guard.ROOT / 'projects/grilling/guide/catalog.a3.json')
        version = guard.load(guard.ROOT / 'baseline.json')['version']
        verify_host_reference(catalog, version)
        reference = guard.ROOT / 'tools/fixtures'
        for older, release in [('161', [2,8,153]), ('160', [2,8,149])]:
            historical = {'host_reference': guard.load(reference / ('cookery-' + older + '-reference.json'))}
            with self.subTest(reference=older):
                verify_host_reference(historical, release)
                with self.assertRaisesRegex(AssertionError, 'reviewed Cookery reference'):
                    verify_host_reference(historical, version)
        for field in ['file_id', 'archive_sha256', 'guide_sha256']:
            changed = copy.deepcopy(catalog)
            changed['host_reference'][field] = 'unreviewed'
            with self.subTest(field=field), self.assertRaisesRegex(AssertionError, 'reviewed Cookery reference'):
                verify_host_reference(changed, version)

    def test_guide_host_guard_imports_without_gameplay_image_dependencies(self):
        # The Windows export job has only Python's standard library. Importing
        # this data guard must not load the historical Pillow gameplay suite.
        code = """import sys
sys.path[:0] = ['tools', 'development/gameplay_core']
from verify_a2828 import verify_host_reference
import bridge_project as guard
verify_host_reference(guard.load(guard.ROOT / 'projects/grilling/guide/catalog.a3.json'),
                      guard.load(guard.ROOT / 'baseline.json')['version'])
assert 'PIL' not in sys.modules and 'verify_a2827' not in sys.modules
"""
        subprocess.run([sys.executable, '-S', '-B', '-c', code], cwd=guard.ROOT,
                       check=True, capture_output=True, text=True)

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
        # Set Git's opt-in before checkout, including the downstream canonical job.
        workflows = guard.ROOT / '.github/workflows'
        for name, setting, checkout in (
            ('bridge-project.yml', 'git config --global core.longpaths true',
             '- uses: actions/checkout@'),
            ('gameplay-core.yml', 'git config core.longpaths true',
             'git checkout --detach'),
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

if __name__ == '__main__':
    unittest.main()
