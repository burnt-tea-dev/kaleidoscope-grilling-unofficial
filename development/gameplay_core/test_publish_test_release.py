"""No network or remote mutations: host notes and G66 publication/retry regressions."""
from contextlib import redirect_stdout
import copy
import hashlib
import io
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import tarfile
import unittest
from unittest.mock import call, patch

import publish_test_release as publish
import package_current
import verify_current

# Final public G66 tree; later runtime versions must never be repackaged as G66.
SOURCE_BASE = '1517ce1b21b25701df0e1b94bf8c4657b99ad096'


def host_baseline(host='1.6.0', version=(2, 8, 73)):
    # Independent fixtures from the reviewed public host dependency metadata.
    pair = {
        '1.0.8': ('d322809c-a51e-4742-bfc4-16d3c1491c9d', '8e2c6318-2f5f-4907-aad0-31d10610e405'),
        '1.6.0': ('5df753c9-3436-4fba-87f1-a2da3651cfcf', 'f1d333ca-2d6b-4566-8005-e6c309816324'),
    }[host]
    return {
        'schema': 1, 'repository': publish.REPO, 'repository_id': publish.REPO_ID,
        'version': list(version),
        'runtime': {'BP': 'projects/grilling/gameplay_core/behavior_pack',
                    'RP': 'projects/grilling/gameplay_core/resource_pack'},
        'packs': {
            'BP': {'uuid': 'c68005c5-23ff-54e8-a3ff-da6349ad43c2', 'dependencies': [
                {'uuid': 'bbbd2d60-52e5-53a6-8b9a-c09b0f516389', 'version': list(version)},
                {'uuid': pair[0], 'version': list(map(int, host.split('.')))},
                {'module_name': '@minecraft/server', 'version': '2.9.0'}]},
            'RP': {'uuid': 'bbbd2d60-52e5-53a6-8b9a-c09b0f516389', 'dependencies': [
                {'uuid': pair[1], 'version': list(map(int, host.split('.')))}]},
        },
    }


def write_host_baseline(root, baseline):
    (root / 'baseline.json').write_text(json.dumps(baseline))
    for side in ('BP', 'RP'):
        path = root / baseline['runtime'][side] / 'manifest.json'
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps({'header': {'uuid': baseline['packs'][side]['uuid'],
            'version': baseline['version']}, 'dependencies': baseline['packs'][side]['dependencies']}))


class HostRequirementTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.asset = self.root / 'review.mcaddon'
        self.asset.write_bytes(b'fixture')
        self.enterContext(patch.object(publish, 'ROOT', self.root))
        self.enterContext(patch.dict(publish.os.environ, {'GITHUB_RUN_NUMBER': '73', 'GITHUB_RUN_ATTEMPT': '1'}))
        self.command = self.enterContext(patch.object(publish, 'run'))
        self.enterContext(redirect_stdout(io.StringIO()))

    def generate(self, baseline):
        write_host_baseline(self.root, baseline)
        publish.publish_legacy('A2.8.73', 'a' * 40, [self.asset])
        return (self.root / 'release-notes.md').read_text()

    def test_notes_follow_reviewed_host_not_grilling_version_or_dependency_order(self):
        for host in ('1.6.0', '1.0.8'):
            with self.subTest(host=host):
                baseline = host_baseline(host)
                baseline['packs']['BP']['dependencies'].reverse()
                notes = self.generate(baseline)
                self.assertIn(f'需要公開版 Cookery {host}（私人版 UUID 不可直接替換）', notes)
                other = '1.0.8' if host == '1.6.0' else '1.6.0'
                self.assertNotIn('Cookery ' + other, notes)
                self.assertIn('尚未驗收', notes)
                self.assertIn('A2.8.73-test.73.1', self.command.call_args.args)

    def test_mixed_unknown_and_duplicate_host_pairs_fail_before_publication(self):
        for side, dependencies in (
            ('RP', host_baseline('1.0.8')['packs']['RP']['dependencies']),
            ('RP', [{'uuid': '00000000-0000-0000-0000-000000000001', 'version': [1, 6, 0]}]),
            ('RP', []),
            ('RP', host_baseline()['packs']['RP']['dependencies'] * 2),
        ):
            with self.subTest(dependencies=dependencies):
                baseline = host_baseline()
                baseline['packs'][side]['dependencies'] = dependencies
                with self.assertRaisesRegex(ValueError, 'dependency pair|exactly one'):
                    self.generate(baseline)
                self.command.assert_not_called()
                self.assertFalse((self.root / 'release-notes.md').exists())

    def test_host_versions_must_match_each_other_and_reviewed_pair(self):
        for bp, rp in (([1, 6, 0], [1, 0, 8]), ([1, 0, 8], [1, 6, 0]),
                       ([1, 0, 8], [1, 0, 8]), ([1, 6, 1], [1, 6, 1]),
                       ('1.6.0', [1, 6, 0]), ([True, 6, 0], [1, 6, 0])):
            with self.subTest(bp=bp, rp=rp):
                baseline = host_baseline()
                baseline['packs']['BP']['dependencies'][1]['version'] = bp
                baseline['packs']['RP']['dependencies'][0]['version'] = rp
                with self.assertRaisesRegex(ValueError, 'Cookery.*version'):
                    self.generate(baseline)
                self.command.assert_not_called()

    def test_manifest_drift_fails_before_publication(self):
        for side in ('BP', 'RP'):
            with self.subTest(side=side):
                baseline = host_baseline()
                write_host_baseline(self.root, baseline)
                path = self.root / baseline['runtime'][side] / 'manifest.json'
                manifest = json.loads(path.read_text())
                manifest['dependencies'] = host_baseline('1.0.8')['packs'][side]['dependencies']
                path.write_text(json.dumps(manifest))
                with self.assertRaisesRegex(ValueError, f'{side} release manifest/baseline mismatch'):
                    publish.publish_legacy('A2.8.73', 'a' * 40, [self.asset])
                self.command.assert_not_called()

    def test_missing_or_wrong_baseline_never_falls_back_to_legacy_requirement(self):
        with self.assertRaises(FileNotFoundError):
            publish.publish_legacy('A2.8.73', 'a' * 40, [self.asset])
        for key, value in (('schema', 2), ('repository_id', 1), ('version', [2, 8, 65])):
            with self.subTest(key=key):
                baseline = host_baseline()
                baseline[key] = value
                with self.assertRaises(ValueError):
                    self.generate(baseline)
        self.command.assert_not_called()

    def test_frozen_g66_notes_retain_historical_host(self):
        write_host_baseline(self.root, host_baseline())
        notes = publish.g66_notes('a' * 40, 'historical snapshot')
        self.assertIn('public Cookery 1.0.8', notes)
        self.assertNotIn('Cookery 1.6.0', notes)


class RequestTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Fresh CI has no ignored artifacts/review yet. Rebuild only in an
        # isolated fixture, never require or mutate the frozen local artifacts.
        cls.cache = tempfile.TemporaryDirectory()
        cls.addClassCleanup(cls.cache.cleanup)
        cls.cached = Path(cls.cache.name)
        historical = cls.cached / 'source'
        historical.mkdir()
        archive = subprocess.check_output(['git', 'archive', '--format=tar', SOURCE_BASE,
                                          'projects/grilling/gameplay_core'], cwd=publish.ROOT)
        with tarfile.open(fileobj=io.BytesIO(archive), mode='r:') as frozen:
            frozen.extractall(historical, filter='data')
        project = historical / 'projects/grilling/gameplay_core'
        bp, rp = project / 'behavior_pack', project / 'resource_pack'
        for side in (bp, rp):
            assert json.loads((side / 'manifest.json').read_text())['header']['version'] == [2, 8, 66]
        request = json.loads((publish.ROOT / publish.REQUEST).read_text())
        cls.fixture_report = {'schema': 1, 'version': publish.G66, 'git_sha': 'a' * 40,
                              'source_tree_sha256': request['expected_source_tree_sha256'],
                              'minecraft_tested': False, 'bds_tested': False, 'client_visuals_tested': False}
        for key, roots, excluded in (
            ('mcaddon', [('behavior_pack', bp), ('resource_pack', rp)], False),
            ('brproject', [('', project)], True),
        ):
            expected = request['expected_artifacts'][key]
            path = cls.cached / expected['name']
            package_current.make_zip(path, roots, exclude_project_builds=excluded)
            cls.fixture_report[key] = {'path': expected['name'], 'sha256': expected['sha256']}
        (cls.cached / 'build-report.json').write_text(json.dumps(cls.fixture_report))
        (cls.cached / 'SHA256SUMS.txt').write_text(''.join(
            f"{request['expected_artifacts'][key]['sha256']}  {request['expected_artifacts'][key]['name']}\n"
            for key in ('mcaddon', 'brproject')), newline='\n')

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for relative in (publish.REQUEST, *publish.EVIDENCE):
            path = self.root / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes((publish.ROOT / relative).read_bytes())
        out = self.root / 'artifacts/review'
        out.mkdir(parents=True)
        self.report = copy.deepcopy(self.fixture_report)
        self.assets = []
        for key in ('mcaddon', 'brproject'):
            source = self.cached / self.report[key]['path']
            target = out / source.name
            shutil.copyfile(source, target)
            self.assets.append(target)
        for name in ('SHA256SUMS.txt', 'build-report.json'):
            target = out / name
            shutil.copyfile(self.cached / name, target)
            self.assets.append(target)

    def change(self, key, value):
        path = self.root / publish.REQUEST
        request = json.loads(path.read_text())
        request[key] = value
        path.write_text(json.dumps(request))

    def validate(self, version=publish.G66):
        return publish.validate_request(version, self.report, self.assets, self.root)

    def test_known_frozen_request(self):
        self.assertEqual(self.validate()['tag'], 'A2.8.66-test')

    def test_missing_request_is_not_implicit_permission(self):
        (self.root / publish.REQUEST).unlink()
        with self.assertRaisesRegex(ValueError, 'explicit root'):
            self.validate()

    def test_wrong_version_cannot_be_authorized(self):
        with self.assertRaisesRegex(ValueError, 'another version'):
            self.validate('A2.8.65')
        self.change('version', 'A2.8.67')
        with self.assertRaisesRegex(ValueError, 'version/tag'):
            self.validate()

    def test_missing_hashes_or_wrong_repository_rejected(self):
        for key, value in (('expected_artifacts', {}), ('repository_id', 1),
                           ('expected_source_tree_sha256', '0' * 64), ('evidence_sha256', {})):
            with self.subTest(key=key):
                original = (self.root / publish.REQUEST).read_bytes()
                self.change(key, value)
                with self.assertRaises(ValueError):
                    self.validate()
                (self.root / publish.REQUEST).write_bytes(original)

    def test_archive_and_evidence_tamper_rejected(self):
        for path in (self.assets[0], self.assets[1], self.root / publish.EVIDENCE[1]):
            with self.subTest(path=path.name):
                original = path.read_bytes()
                path.write_bytes(original + b'tamper')
                with self.assertRaisesRegex(ValueError, 'hash mismatch|evidence changed'):
                    self.validate()
                path.write_bytes(original)

    def test_checksum_crlf_drift_rejected(self):
        path = self.assets[2]
        path.write_bytes(path.read_bytes().replace(b'\n', b'\r\n'))
        with self.assertRaisesRegex(ValueError, 'checksum manifest'):
            self.validate()

    def test_admission_or_latest_promotion_rejected(self):
        for key, value in (('prerelease', False), ('make_latest', 'true'),
                           ('require_functional_source_receipt', False),
                           ('complete_client_acceptance', True), ('java_all_view_parity', True),
                           ('production_ready', True), ('saved_world_migration', True)):
            with self.subTest(key=key):
                original = (self.root / publish.REQUEST).read_bytes()
                self.change(key, value)
                with self.assertRaises(ValueError):
                    self.validate()
                (self.root / publish.REQUEST).write_bytes(original)

    def test_packaging_report_cannot_promote_client_or_bds(self):
        for key in ('minecraft_tested', 'bds_tested', 'client_visuals_tested'):
            self.report[key] = True
            with self.assertRaisesRegex(ValueError, 'packaging report'):
                self.validate()
            self.report[key] = False

    def test_no_unbounded_evidence_asset_allowed(self):
        expected = self.validate()['evidence_sha256']
        expected['worlds/private.zip'] = 'a' * 64
        self.change('evidence_sha256', expected)
        with self.assertRaisesRegex(ValueError, 'bounded allowlist'):
            self.validate()

    def test_notes_disclose_bounded_acceptance_and_scope(self):
        notes = publish.g66_notes('a' * 40, 'historical snapshot')
        for phrase in ('500 ms', 'cropped', 'inconclusive', 'ALT is static-only', 'Continuous/full-use',
                       'device', 'full Java', 'cooked save was not reloaded', '8-pack', '16-pack',
                       'no Tavern/World Liquor (T/L) release', 'no live deployment', 'production readiness remain false'):
            self.assertIn(phrase, notes)


class FakeGitHub:
    def __init__(self, sha, title, notes, assets):
        self.sha = sha
        self.title = title
        self.notes = notes
        self.assets = {p.name: p for p in assets}
        self.release = None
        self.tag_sha = None
        self.head = sha
        self.identity = {'full_name': publish.REPO, 'id': publish.REPO_ID}
        self.commit_sha = sha
        self.remote_assets = {}
        self.events = []
        self.corrupt = None

    def metadata(self):
        return {'id': 123, 'tag_name': 'A2.8.66-test', 'target_commitish': self.sha,
                'name': self.title, 'body': self.notes, 'draft': True, 'prerelease': True}

    def add_assets(self, names):
        for name in names:
            path = self.assets[name]
            self.remote_assets[name] = {'id': len(self.remote_assets) + 1, 'name': name,
                'state': 'uploaded', 'size': path.stat().st_size, 'digest': 'sha256:' + publish.sha256(path)}

    def api(self, endpoint, *, method='GET', payload=None, allow_missing=False):
        self.events.append((method, endpoint, payload))
        base = f'repos/{publish.REPO}'
        if endpoint == base:
            return copy.deepcopy(self.identity)
        if endpoint == base + '/commits/' + self.sha:
            return {'sha': self.commit_sha}
        if endpoint == base + '/git/ref/heads/main':
            return {'object': {'sha': self.head, 'type': 'commit'}}
        if endpoint == base + '/git/ref/tags/A2.8.66-test':
            return None if self.tag_sha is None else {'ref': 'refs/tags/A2.8.66-test', 'object': {'sha': self.tag_sha, 'type': 'commit'}}
        if endpoint == base + '/releases/tags/A2.8.66-test':
            # GitHub's by-tag endpoint hides drafts even after asset upload.
            if self.release is None or self.release['draft']:
                return None
            return copy.deepcopy(self.release)
        if endpoint == base + '/releases?per_page=100&page=1' and method == 'GET':
            return [] if self.release is None else [copy.deepcopy(self.release)]
        if endpoint == base + '/releases/123' and method == 'GET':
            return copy.deepcopy(self.release)
        if endpoint == base + '/releases/123/assets?per_page=100':
            return copy.deepcopy(list(self.remote_assets.values()))
        if endpoint == base + '/git/refs' and method == 'POST':
            self.tag_sha = payload['sha']
            return {'ref': payload['ref'], 'object': {'sha': self.tag_sha}}
        if endpoint == base + '/releases/123' and method == 'PATCH':
            self.release.update({k: v for k, v in payload.items() if k != 'make_latest'})
            return copy.deepcopy(self.release)
        if endpoint == base + '/releases/latest':
            return {'id': 42}
        raise AssertionError((endpoint, method, payload))

    def run(self, *args):
        self.events.append(('RUN', args))
        if args[:3] == ('gh', 'release', 'create'):
            self.release = self.metadata()
            self.add_assets(self.assets)
        elif args[:3] == ('gh', 'release', 'upload'):
            self.add_assets(Path(p).name for p in args[4:-2])
        else:
            raise AssertionError(args)

    def download(self, asset_id):
        asset = next(p for p in self.remote_assets.values() if p['id'] == asset_id)
        self.events.append(('DOWNLOAD', asset['name']))
        return b'corrupt' if self.corrupt == asset['name'] else self.assets[asset['name']].read_bytes()

    def writes(self):
        return [e for e in self.events if e[0] in ('RUN', 'POST', 'PATCH')]


class PublicationTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        (root / '.repo-target.json').write_text(json.dumps({'repository': publish.REPO, 'repository_id': publish.REPO_ID}))
        self.assets = []
        for name in ('g66.mcaddon', 'g66.brproject', 'SHA256SUMS.txt', 'build-report.json', 'bounded-evidence.json'):
            path = root / name
            path.write_bytes((name + '\n').encode())
            self.assets.append(path)
        self.sha = 'a' * 40
        self.notes = root / 'release-notes.md'
        self.notes.write_text('G66 bounded native evidence only\n')
        self.assets.append(self.notes)
        self.source = root / 'source.json'
        self.source.write_text('{}')
        copied = root / 'grilling-source-validation.json'
        copied.write_bytes(self.source.read_bytes())
        self.assets.append(copied)
        title = 'Kaleidoscope Grilling A2.8.66 Integrated Test'
        self.remote = FakeGitHub(self.sha, title, self.notes.read_text(), self.assets)
        self.enterContext(patch.object(publish, 'ROOT', root))
        self.enterContext(patch.object(publish, 'api', side_effect=self.remote.api))
        self.enterContext(patch.object(publish, 'run', side_effect=self.remote.run))
        self.enterContext(patch.object(publish, 'download_asset', side_effect=self.remote.download))
        self.enterContext(patch.object(publish, 'prepare_g66_assets', return_value=({'tag': 'A2.8.66-test'}, self.assets, self.notes)))
        self.validate = self.enterContext(patch.object(verify_current, 'require_source_validation',
            return_value={'version': [2, 8, 66], 'source': {'head': self.sha}}))
        self.enterContext(redirect_stdout(io.StringIO()))

    def publish(self):
        publish.publish_g66(self.sha, {}, self.assets, self.source)

    def test_draft_readback_and_exact_tag_before_publish(self):
        self.publish()
        self.assertFalse(self.remote.release['draft'])
        writes = self.remote.writes()
        self.assertEqual([p[0] for p in writes], ['RUN', 'POST', 'PATCH'])
        self.assertIn('--draft', writes[0][1])
        self.assertIn('--prerelease', writes[0][1])
        self.assertIn('--latest=false', writes[0][1])
        self.assertEqual(writes[-1][2], {'draft': False, 'prerelease': True, 'make_latest': 'false'})
        patch_index = self.remote.events.index(writes[-1])
        before_publish = self.remote.events[:patch_index]
        downloaded = [event[1] for event in before_publish if event[0] == 'DOWNLOAD']
        self.assertEqual(set(downloaded), {p.name for p in self.assets})
        self.assertEqual(len(downloaded), len(self.assets) * 2)
        self.assertEqual(self.remote.tag_sha, self.sha)
        self.validate.assert_called_once_with(self.source)

    def test_published_matching_release_is_never_overwritten(self):
        self.remote.release = self.remote.metadata()
        self.remote.release['draft'] = False
        with self.assertRaisesRegex(ValueError, 'published'):
            self.publish()
        self.assertEqual(self.remote.writes(), [])

    def test_differing_draft_metadata_refused(self):
        for key, value in (('body', 'other notes'), ('target_commitish', 'b' * 40), ('name', 'another release'), ('prerelease', False)):
            with self.subTest(key=key):
                self.remote.release = self.remote.metadata()
                self.remote.release[key] = value
                with self.assertRaises(ValueError):
                    self.publish()
                self.assertEqual(self.remote.writes(), [])

    def test_differing_draft_asset_refused_before_upload(self):
        self.remote.release = self.remote.metadata()
        self.remote.add_assets([self.assets[0].name])
        self.remote.corrupt = self.assets[0].name
        with self.assertRaisesRegex(ValueError, 'readback SHA256'):
            self.publish()
        self.assertEqual(self.remote.writes(), [])

    def test_matching_partial_draft_fills_only_missing_assets_without_clobber(self):
        self.remote.release = self.remote.metadata()
        self.remote.add_assets([self.assets[0].name])
        self.publish()
        upload = self.remote.writes()[0][1]
        self.assertEqual(upload[:3], ('gh', 'release', 'upload'))
        self.assertNotIn(str(self.assets[0]), upload)
        self.assertNotIn('--clobber', upload)
        self.assertFalse(self.remote.release['draft'])

    def test_corrupted_readback_never_publishes_or_creates_tag(self):
        self.remote.corrupt = self.assets[1].name
        with self.assertRaisesRegex(ValueError, 'readback SHA256'):
            self.publish()
        self.assertEqual([p[0] for p in self.remote.writes()], ['RUN'])
        self.assertTrue(self.remote.release['draft'])
        self.assertIsNone(self.remote.tag_sha)

    def test_wrong_remote_identity_head_commit_or_tag_never_writes(self):
        for key, value in (('identity', {'full_name': publish.REPO, 'id': 1}),
                           ('head', 'b' * 40), ('commit_sha', 'b' * 40), ('tag_sha', 'b' * 40)):
            with self.subTest(key=key):
                original = getattr(self.remote, key)
                setattr(self.remote, key, value)
                with self.assertRaises(ValueError):
                    self.publish()
                self.assertEqual(self.remote.writes(), [])
                setattr(self.remote, key, original)

    def test_source_receipt_changed_before_publish_leaves_draft(self):
        self.validate.side_effect = AssertionError('source/HEAD changed')
        with self.assertRaisesRegex(AssertionError, 'source/HEAD'):
            self.publish()
        self.assertTrue(self.remote.release['draft'])
        self.assertNotIn('PATCH', [p[0] for p in self.remote.writes()])

    def test_local_asset_changed_during_readback_never_publishes(self):
        def mutate_receipt_check(*args):
            self.assets[0].write_bytes(b'changed after upload')
            return {'version': [2, 8, 66], 'source': {'head': self.sha}}
        self.validate.side_effect = mutate_receipt_check
        with self.assertRaisesRegex(ValueError, 'Local staged release assets changed'):
            self.publish()
        self.assertTrue(self.remote.release['draft'])
        self.assertNotIn('PATCH', [p[0] for p in self.remote.writes()])

    def test_functional_receipt_bytes_changed_during_staging_keeps_draft(self):
        def changed_receipt(*args):
            self.source.write_bytes(b'{"changed": true}')
            return {'version': [2, 8, 66], 'source': {'head': self.sha}}
        self.validate.side_effect = changed_receipt
        with self.assertRaisesRegex(ValueError, 'receipt bytes changed'):
            self.publish()
        self.assertTrue(self.remote.release['draft'])
        self.assertNotIn('PATCH', [p[0] for p in self.remote.writes()])

    def test_main_moving_during_staging_keeps_draft(self):
        original = self.remote.run
        def moved_main(*args):
            original(*args)
            self.remote.head = 'b' * 40
        with patch.object(publish, 'run', side_effect=moved_main):
            with self.assertRaisesRegex(ValueError, 'main changed'):
                self.publish()
        self.assertTrue(self.remote.release['draft'])
        self.assertNotIn('PATCH', [p[0] for p in self.remote.writes()])

    def test_unknown_or_extra_draft_asset_is_refused(self):
        self.remote.release = self.remote.metadata()
        self.remote.remote_assets['private-world.zip'] = {'name': 'private-world.zip'}
        with self.assertRaisesRegex(ValueError, 'Differing or duplicate'):
            self.publish()
        self.assertEqual(self.remote.writes(), [])


class PreparationTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.assets = []
        for name in ('G66.mcaddon', 'G66.brproject', 'SHA256SUMS.txt', 'build-report.json'):
            path = self.root / 'artifacts/review' / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(name.encode())
            self.assets.append(path)
        for relative in (*publish.EVIDENCE, publish.REQUEST):
            path = self.root / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text('bounded snapshot')
        self.sha = 'a' * 40
        self.source = self.root / 'external-source-validation.json'
        self.source.write_bytes(b'{"bound": "functional receipt"}\n')
        self.enterContext(patch.object(publish, 'ROOT', self.root))
        self.enterContext(patch.object(publish, 'validate_request', return_value={'tag': 'A2.8.66-test'}))
        self.receipt = self.enterContext(patch.object(verify_current, 'require_source_validation',
            return_value={'version': [2, 8, 66], 'source': {'head': self.sha}}))

    def test_all_bounded_assets_receipt_and_notes_have_hash_manifest(self):
        request, assets, notes = publish.prepare_g66_assets(self.sha, {}, self.assets, self.source)
        self.receipt.assert_called_once_with(self.source)
        by_name = {p.name: p for p in assets}
        self.assertEqual(len(assets), 13)
        self.assertEqual(by_name['grilling-source-validation.json'].read_bytes(), self.source.read_bytes())
        manifest = by_name['RELEASE-ASSET-SHA256SUMS.txt'].read_text()
        for name, path in by_name.items():
            if name != 'RELEASE-ASSET-SHA256SUMS.txt':
                self.assertIn(publish.sha256(path) + '  ' + name + '\n', manifest)
        self.assertIn(self.sha, notes.read_text())
        self.assertNotIn(b'\r', notes.read_bytes())
        self.assertNotIn(b'\r', by_name['RELEASE-ASSET-SHA256SUMS.txt'].read_bytes())

    def test_missing_receipt_refused_before_any_publication(self):
        self.source.unlink()
        with self.assertRaisesRegex(ValueError, 'receipt is missing'):
            publish.prepare_g66_assets(self.sha, {}, self.assets, self.source)
        self.receipt.assert_not_called()

    def test_wrong_receipt_version_or_head_refused(self):
        for receipt in ({'version': [2, 8, 65], 'source': {'head': self.sha}},
                        {'version': [2, 8, 66], 'source': {'head': 'b' * 40}}):
            self.receipt.return_value = receipt
            with self.assertRaisesRegex(ValueError, 'receipt version/HEAD'):
                publish.prepare_g66_assets(self.sha, {}, self.assets, self.source)


class ApiTests(unittest.TestCase):
    def test_release_lookup_uses_by_tag_result_or_reports_absence(self):
        tag = 'A2.8.128-beta.1'
        base = f'repos/{publish.REPO}/releases'
        published = {'id': 123, 'tag_name': tag, 'draft': False}
        for result, responses, expected_calls in (
            (published, [published], [call(f'{base}/tags/{tag}', allow_missing=True)]),
            (None, [None, []], [call(f'{base}/tags/{tag}', allow_missing=True),
                               call(f'{base}?per_page=100&page=1')]),
        ):
            with self.subTest(result=result), patch.object(publish, 'api', side_effect=responses) as api:
                self.assertEqual(publish.release_by_tag(tag), result)
                self.assertEqual(api.call_args_list, expected_calls)

    def test_draft_lookup_paginates_and_reads_exact_release_by_id(self):
        tag = 'A2.8.128-beta.1'
        base = f'repos/{publish.REPO}/releases'
        unrelated = [{'id': i, 'tag_name': f'{tag}-other-{i}', 'draft': True} for i in range(100)]
        draft = {'id': 123, 'tag_name': tag, 'draft': True}
        readback = {**draft, 'body': 'Full release readback', 'assets': [{'id': 456}]}
        with patch.object(publish, 'api', side_effect=[None, unrelated, [draft], readback]) as api:
            self.assertEqual(publish.release_by_tag(tag), readback)
        self.assertEqual(api.call_args_list, [
            call(f'{base}/tags/{tag}', allow_missing=True),
            call(f'{base}?per_page=100&page=1'),
            call(f'{base}?per_page=100&page=2'),
            call(f'{base}/123'),
        ])

    def test_ambiguous_or_non_draft_inventory_fails_before_id_readback(self):
        tag = 'A2.8.128-beta.1'
        base = f'repos/{publish.REPO}/releases'
        draft = {'id': 123, 'tag_name': tag, 'draft': True}
        first_page = [draft] + [{'id': i, 'tag_name': f'other-{i}'} for i in range(99)]
        for pages, message in (
            ([first_page, [{**draft, 'id': 456}]], 'Ambiguous release tag inventory'),
            ([[{**draft, 'draft': False}]], 'non-draft or unidentified'),
        ):
            with self.subTest(message=message), patch.object(publish, 'api', side_effect=[None, *pages]) as api:
                with self.assertRaisesRegex(ValueError, message):
                    publish.release_by_tag(tag)
                self.assertEqual(api.call_args_list, [
                    call(f'{base}/tags/{tag}', allow_missing=True),
                    *[call(f'{base}?per_page=100&page={page}') for page in range(1, len(pages) + 1)],
                ])

    def test_draft_id_readback_must_retain_identity_tag_and_draft_state(self):
        tag = 'A2.8.128-beta.1'
        base = f'repos/{publish.REPO}/releases'
        draft = {'id': 123, 'tag_name': tag, 'draft': True}
        for key, value in (('id', 456), ('tag_name', tag + '-other'), ('draft', False)):
            with self.subTest(key=key), patch.object(publish, 'api',
                    side_effect=[None, [draft], {**draft, key: value}]) as api:
                with self.assertRaisesRegex(ValueError, 'Draft release changed during ID readback'):
                    publish.release_by_tag(tag)
                self.assertEqual(api.call_args_list, [
                    call(f'{base}/tags/{tag}', allow_missing=True),
                    call(f'{base}?per_page=100&page=1'),
                    call(f'{base}/123'),
                ])

    def test_only_http_404_is_absence(self):
        for stderr, absent in (('gh: Not Found (HTTP 404)\n', True), ('gh: Forbidden (HTTP 403)\n', False), ('network unavailable', False)):
            result = subprocess.CompletedProcess([], 1, '', stderr)
            with self.subTest(stderr=stderr), patch.object(publish.subprocess, 'run', return_value=result):
                if absent:
                    self.assertIsNone(publish.api('repos/example', allow_missing=True))
                else:
                    with self.assertRaises(RuntimeError):
                        publish.api('repos/example', allow_missing=True)

    def test_annotated_tag_resolves_actual_commit(self):
        responses = [{'ref': 'refs/tags/A2.8.66-test', 'object': {'sha': 'b' * 40, 'type': 'tag'}},
                     {'object': {'sha': 'a' * 40, 'type': 'commit'}}]
        with patch.object(publish, 'api', side_effect=responses):
            self.assertEqual(publish.tag_target('A2.8.66-test'), 'a' * 40)

    def test_cyclic_or_noncommit_tag_refused(self):
        ref = {'ref': 'refs/tags/A2.8.66-test', 'object': {'sha': 'b' * 40, 'type': 'tag'}}
        with patch.object(publish, 'api', side_effect=[ref, {'object': ref['object']}]), self.assertRaisesRegex(ValueError, 'Cyclic'):
            publish.tag_target('A2.8.66-test')
        ref['object']['type'] = 'tree'
        with patch.object(publish, 'api', return_value=ref), self.assertRaisesRegex(ValueError, 'commit'):
            publish.tag_target('A2.8.66-test')

    def test_older_version_keeps_historical_unique_attempt_path(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            write_host_baseline(root, host_baseline('1.0.8', (2, 8, 65)))
            asset = root / 'review.mcaddon'
            asset.write_bytes(b'fixture')
            with patch.object(publish, 'ROOT', root), patch.dict(publish.os.environ, {'GITHUB_RUN_NUMBER': '72', 'GITHUB_RUN_ATTEMPT': '3'}), patch.object(publish, 'run') as command, redirect_stdout(io.StringIO()):
                publish.publish_legacy('A2.8.65', 'a' * 40, [asset])
            args = command.call_args.args
            self.assertIn('A2.8.65-test.72.3', args)
            self.assertIn('--prerelease', args)
            self.assertNotIn('--draft', args)


class CurrentPublicationTests(unittest.TestCase):
    """Exercise CI reuse and publication boundaries with tiny local artifacts."""

    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.main, self.head, self.checkout, self.tree = (letter * 40 for letter in 'abcd')
        self.trees = {self.main: self.tree, self.head: self.tree, self.checkout: self.tree}
        self.selected = {
            'id': 123, 'repository': {'full_name': publish.REPO, 'id': publish.REPO_ID},
            'path': publish.CANONICAL_WORKFLOW, 'head_sha': self.head,
            'status': 'completed', 'conclusion': 'success', 'run_attempt': 1,
        }
        self.jobs = {'total_count': 2, 'jobs': [
            {'name': name, 'status': 'completed', 'conclusion': 'success'}
            for name in ('source', 'canonical')]}
        self.artifact = {'id': 456, 'name': publish.REVIEW_ARTIFACT, 'expired': False,
                         'workflow_run': {'id': 123, 'head_sha': self.head}}
        self.api = self.enterContext(patch.object(publish, 'api', side_effect=self.github))
        self.enterContext(patch.object(publish, 'ROOT', self.root))
        self.request = {'version': 'A2.8.128', 'tag': 'A2.8.128-beta.1',
                        'expected_source_tree_sha256': 'e' * 64, 'expected_artifacts': {}}
        self.report = {'version': 'A2.8.128', 'git_sha': self.checkout,
                       'source_tree_sha256': 'e' * 64, 'minecraft_tested': False,
                       'bds_tested': False, 'client_visuals_tested': False}
        self.assets = []
        for kind in ('mcaddon', 'brproject'):
            asset = self.root / f'Kaleidoscope_Grilling_A2.8.128_Review.{kind}'
            asset.write_bytes(kind.encode())
            expected = {'name': asset.name, 'sha256': hashlib.sha256(asset.read_bytes()).hexdigest()}
            self.request['expected_artifacts'][kind] = expected
            self.report[kind] = {'sha256': expected['sha256']}
            self.assets.append(asset)
        sums = self.root / 'SHA256SUMS.txt'
        sums.write_text(''.join(f"{v['sha256']}  {v['name']}\n"
                               for v in self.request['expected_artifacts'].values()), newline='\n')
        report = self.root / 'build-report.json'
        report.write_text(json.dumps(self.report))
        self.assets += [sums, report]
        for relative in (publish.CURRENT_REQUEST, publish.CURRENT_NOTES):
            path = self.root / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text('{}' if relative.endswith('.json') else 'Current release notes')

    def github(self, endpoint, **kwargs):
        self.assertEqual(kwargs.get('method', 'GET'), 'GET', 'Preflight must not mutate GitHub')
        prefix = f'repos/{publish.REPO}'
        if endpoint.startswith(prefix + '/git/commits/'):
            sha = endpoint.rsplit('/', 1)[1]
            return {'sha': sha, 'tree': {'sha': self.trees[sha]}}
        if endpoint == prefix + '/actions/runs/123':
            return self.selected
        if endpoint.endswith('/attempts/1/jobs?per_page=100'):
            return self.jobs
        if endpoint.endswith(f'/artifacts?name={publish.REVIEW_ARTIFACT}&per_page=100'):
            return {'total_count': 1, 'artifacts': [self.artifact]}
        self.fail('Unexpected endpoint: ' + endpoint)

    def test_different_commit_shas_require_the_same_complete_tree(self):
        validation = publish.require_publication_run(123, self.main)
        self.assertEqual(validation, {'run_id': 123, 'attempt': 1, 'artifact_id': 456,
            'publication_head': self.main, 'run_head': self.head, 'git_tree': self.tree})
        self.assertEqual(publish.require_current_artifacts(self.request, self.report, self.assets, self.main), self.tree)
        self.assertEqual(self.report['git_sha'], self.checkout)

    def test_other_repository_tree_skipped_job_and_stale_artifact_fail_closed(self):
        cases = [(self.selected['repository'], 'id', 1),
                 (self.trees, self.head, 'f' * 40),
                 (self.selected, 'conclusion', 'failure'),
                 (self.jobs['jobs'][1], 'conclusion', 'skipped'),
                 (self.artifact, 'expired', True),
                 (self.artifact['workflow_run'], 'head_sha', self.main),
                 (self.artifact['workflow_run'], 'id', 124)]
        for target, key, value in cases:
            with self.subTest(key=key, value=value):
                original = target[key]
                target[key] = value
                with self.assertRaises(ValueError):
                    publish.require_publication_run(123, self.main)
                target[key] = original

    def test_report_tree_or_archive_tampering_rejected(self):
        self.trees[self.checkout] = 'f' * 40
        with self.assertRaisesRegex(ValueError, 'report full Git tree'):
            publish.require_current_artifacts(self.request, self.report, self.assets, self.main)
        self.trees[self.checkout] = self.tree
        self.assets[0].write_bytes(b'changed')
        with self.assertRaisesRegex(ValueError, 'mcaddon hash mismatch'):
            publish.require_current_artifacts(self.request, self.report, self.assets, self.main)

    def test_publication_binding_preserves_the_original_archive_report(self):
        original = self.assets[-1].read_bytes()
        validation = publish.require_publication_run(123, self.main)
        with patch.object(publish, 'publish_exact') as publish_exact:
            publish.publish_current(self.main, self.report, self.assets, self.request, validation)
        binding = json.loads((self.root / 'publication-binding.json').read_text())
        self.assertEqual(binding['publication_commit'], self.main)
        self.assertEqual(binding['archive_report_commit'], self.checkout)
        self.assertEqual(binding['validation']['run_head'], self.head)
        self.assertEqual(binding['archive_report_sha256'], hashlib.sha256(original).hexdigest())
        self.assertEqual(self.assets[-1].read_bytes(), original)
        self.assertFalse(binding['client'])
        self.assertFalse(binding['production_ready'])
        self.assertIn(self.root / 'publication-binding.json', publish_exact.call_args.args[4])
        publish_exact.call_args.args[5]({})

    def test_main_push_cannot_invoke_current_publication(self):
        environment = {'GITHUB_REPOSITORY': publish.REPO, 'GITHUB_REPOSITORY_ID': str(publish.REPO_ID),
                       'GITHUB_REF': 'refs/heads/main', 'GITHUB_SHA': self.main, 'GITHUB_EVENT_NAME': 'push'}
        with patch.dict(publish.os.environ, environment), patch.object(publish, 'call', return_value=self.main), \
                patch('sys.argv', ['publish_test_release.py', '--publication', 'publish']), \
                self.assertRaisesRegex(ValueError, 'explicit manual dispatch'):
            publish.main()
        self.api.assert_not_called()


if __name__ == '__main__':
    unittest.main()
