"""Asset export regression fixtures; no compiler, game or player simulation."""
from pathlib import Path
import json
import shutil
import tempfile
import unittest

from verify_dash_outputs import verify_output


class AssetOutputTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.project = Path(temporary.name)
        self.source = self.project / 'resource_pack'
        self.source.mkdir()
        (self.source / 'manifest.json').write_text(json.dumps({'header': {'uuid': 'fixture', 'version': [1, 0, 0]}}))
        (self.source / 'texture.png').write_bytes(b'fixture image bytes')
        (self.source / 'NOTICE.txt').write_bytes(b'fixture notice bytes')
        self.compiled = self.project / 'builds/dist/assets'
        shutil.copytree(self.source, self.compiled)

    def test_current_asset_export_accepts_json_formatting_and_checks_every_file(self):
        manifest = self.compiled / 'manifest.json'
        manifest.write_text(json.dumps(json.loads(manifest.read_text()), indent=2))
        self.assertEqual(verify_output(self.project)['packs'][0]['checked_files'], 3)

    def test_zero_output_and_missing_current_resource_are_rejected(self):
        for missing in ['manifest.json', 'texture.png']:
            with self.subTest(missing=missing):
                path = self.compiled / missing
                original = path.read_bytes()
                path.unlink()
                with self.assertRaisesRegex(RuntimeError, 'expected one compiled pack|inventory differs'):
                    verify_output(self.project)
                path.write_bytes(original)
        shutil.rmtree(self.compiled)
        with self.assertRaisesRegex(RuntimeError, 'found 0'):
            verify_output(self.project)

    def test_manifest_and_non_json_byte_changes_are_rejected(self):
        for changed in ['manifest.json', 'NOTICE.txt']:
            with self.subTest(changed=changed):
                path = self.compiled / changed
                original = path.read_bytes()
                if changed == 'manifest.json':
                    manifest = json.loads(original)
                    manifest['header']['version'] = [1, 0, 1]
                    path.write_text(json.dumps(manifest))
                else:
                    path.write_bytes(b'changed notice')
                with self.assertRaisesRegex(RuntimeError, 'Unexpected Dash transformation'):
                    verify_output(self.project)
                path.write_bytes(original)


if __name__ == '__main__':
    unittest.main()
