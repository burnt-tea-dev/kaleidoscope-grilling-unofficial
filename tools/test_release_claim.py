#!/usr/bin/env python3
"""Real Git/worktree and process-race tests; never opens a game world."""
from pathlib import Path
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import unittest

from release_claim import ReleaseClaimError, claim_release


class ReleaseClaimTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.base = Path(self.temporary.name)
        self.root, self.other = self.base / 'repo', self.base / 'other'
        self.root.mkdir()
        self.environment = {key: value for key, value in os.environ.items() if key not in ['GITHUB_REPOSITORY','GITHUB_REPOSITORY_ID','GITHUB_REPOSITORY_OWNER','GITHUB_REPOSITORY_OWNER_ID','GITHUB_EVENT_PATH','GITHUB_ACTIONS','SENLUO_SOURCE_GATE']}
        self.git(self.root, 'init', '-q', '-b', 'main')
        self.git(self.root, 'config', 'user.email', 'fixture@example.invalid')
        self.git(self.root, 'config', 'user.name', 'Release fixture')
        (self.root / 'tools').mkdir()
        for name in ['baseline_gate.py', 'release_claim.py']:
            shutil.copy2(Path(__file__).with_name(name), self.root / 'tools' / name)
        self.config = {'repository': 'fixture/owned', 'repository_id': 1, 'version': [1, 0, 0], 'runtime': {'BP': 'runtime/BP', 'RP': 'runtime/RP'}, 'packs': {}}
        for side in ['BP', 'RP']:
            folder = self.root / 'runtime' / side
            folder.mkdir(parents=True)
            (folder / 'manifest.json').write_text(json.dumps({'header': {'uuid': side.lower(), 'version': [1, 0, 0]}, 'modules': [{'version': [1, 0, 0]}]}))
            (folder / 'content.json').write_text('{}')
            self.config['packs'][side] = {'uuid': side.lower(), 'dependencies': []}
        (self.root / '.repo-target.json').write_text(json.dumps({'repository':'fixture-org/owned','repository_id':1,'owner':{'login':'fixture-org','id':2,'type':'Organization'},'private':False,'logical_runtime_repository':'fixture/owned'}))
        self.config['source_trees'] = self.trees(self.root)
        (self.root / 'baseline.json').write_text(json.dumps(self.config))
        (self.root / 'release-history.json').write_text(json.dumps({'1.0.0': self.config['source_trees']}))
        self.git(self.root, 'add', '.')
        self.git(self.root, 'commit', '-qm', 'Initial canonical baseline')
        self.git(self.root, 'worktree', 'add', '-q', '-b', 'candidate', str(self.other))
        self.first = {'BP': {'sha256': 'a' * 64, 'files': 2}, 'RP': {'sha256': 'b' * 64, 'files': 2}}
        self.second = {'BP': {'sha256': 'c' * 64, 'files': 2}, 'RP': {'sha256': 'b' * 64, 'files': 2}}
        self.claims = self.root / '.git' / 'release-claims' / 'v1'

    def git(self, root, *args):
        return subprocess.check_output(['git', '-C', str(root), *args], text=True, env=self.environment).strip()

    def claim(self, root, trees, version=(1, 0, 1)):
        return claim_release(root, list(version), trees, 'fixture/owned')

    def trees(self, root):
        result = {}
        for side in ['BP', 'RP']:
            folder = root / 'runtime' / side
            rows = {path.relative_to(folder).as_posix(): hashlib.sha256(path.read_bytes()).hexdigest() for path in sorted(folder.rglob('*')) if path.is_file()}
            result[side] = {'sha256': hashlib.sha256(json.dumps(rows, sort_keys=True, separators=(',', ':')).encode()).hexdigest(), 'files': len(rows)}
        return result

    def commit_history(self, root, trees):
        path = root / 'release-history.json'
        history = json.loads(path.read_text())
        history['1.0.1'] = trees
        path.write_text(json.dumps(history))
        self.git(root, 'add', 'release-history.json')
        self.git(root, 'commit', '-qm', 'Record independently frozen release')
        return self.git(root, 'rev-parse', 'HEAD')

    def gate(self, root, *args):
        return subprocess.run([sys.executable, str(root / 'tools' / 'baseline_gate.py'), *args], text=True, capture_output=True, env=self.environment)

    def test_two_worktrees_reuse_identical_claim_without_rewriting(self):
        path = self.claim(self.root, self.first)
        original = path.read_bytes()
        stamp = path.stat().st_mtime_ns
        self.assertEqual(self.claim(self.other, self.first), path)
        self.assertEqual(path.read_bytes(), original)
        self.assertEqual(path.stat().st_mtime_ns, stamp)
        claim = json.loads(original)
        self.assertEqual(claim['branch'], 'main')
        self.assertEqual(claim['commit'], self.git(self.root, 'rev-parse', 'HEAD'))
        self.assertEqual(claim['source_trees'], self.first)
        self.assertNotIn(str(self.base), original.decode())
        self.assertEqual(self.git(self.root, 'status', '--porcelain'), '')
        self.assertEqual(self.git(self.other, 'status', '--porcelain'), '')

    def test_two_worktrees_cannot_claim_same_version_with_different_trees(self):
        path = self.claim(self.root, self.first)
        original = path.read_bytes()
        with self.assertRaisesRegex(ReleaseClaimError, 'already claimed for different content'):
            self.claim(self.other, self.second)
        self.assertEqual(path.read_bytes(), original)

    def test_local_branch_history_blocks_initial_claim(self):
        self.commit_history(self.other, self.second)
        with self.assertRaisesRegex(ReleaseClaimError, 'refs/heads/candidate'):
            self.claim(self.root, self.first)
        self.assertFalse((self.claims / '1.0.1.json').exists())

    def test_remote_tracking_history_blocks_initial_claim(self):
        head = self.commit_history(self.other, self.second)
        self.git(self.root, 'update-ref', 'refs/remotes/origin/other-candidate', head)
        self.git(self.other, 'checkout', '--detach', '-q')
        self.git(self.root, 'branch', '-D', 'candidate')
        with self.assertRaisesRegex(ReleaseClaimError, 'refs/remotes/origin/other-candidate'):
            self.claim(self.root, self.first)
        self.assertFalse((self.claims / '1.0.1.json').exists())

    def test_identical_committed_history_allows_claim(self):
        path = self.claim(self.root, self.config['source_trees'], version=(1, 0, 0))
        self.assertEqual(json.loads(path.read_text())['version'], '1.0.0')

    def test_new_conflicting_ref_is_checked_even_when_claim_already_exists(self):
        path = self.claim(self.root, self.first)
        original = path.read_bytes()
        self.commit_history(self.other, self.second)
        with self.assertRaisesRegex(ReleaseClaimError, 'different content in refs/heads/candidate'):
            self.claim(self.root, self.first)
        self.assertEqual(path.read_bytes(), original)

    def test_uncommitted_other_worktree_does_not_change_committed_history_or_check(self):
        (self.root / 'runtime/BP/content.json').write_text('{"uncommitted":true}')
        path = self.claim(self.other, self.first)
        self.assertTrue(path.is_file())
        clean_check = self.gate(self.other, 'check', '--release')
        self.assertEqual(clean_check.returncode, 0, clean_check.stderr)
        dirty_check = self.gate(self.root, 'check')
        self.assertNotEqual(dirty_check.returncode, 0)
        self.assertIn('runtime changed without a reviewed version/hash update', dirty_check.stderr)

    def test_normal_check_never_creates_claims(self):
        result = self.gate(self.root, 'check', '--release')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(self.claims.exists())

    def test_freeze_conflict_preserves_baseline_and_history(self):
        config_path = self.other / 'baseline.json'
        config = json.loads(config_path.read_text())
        config['version'] = [1, 0, 1]
        config_path.write_text(json.dumps(config))
        for side in ['BP', 'RP']:
            path = self.other / 'runtime' / side / 'manifest.json'
            manifest = json.loads(path.read_text())
            manifest['header']['version'] = [1, 0, 1]
            manifest['modules'][0]['version'] = [1, 0, 1]
            path.write_text(json.dumps(manifest))
        claim = self.claim(self.root, self.first)
        paths = [config_path, self.other / 'release-history.json', claim]
        before = [path.read_bytes() for path in paths]
        result = self.gate(self.other, 'freeze')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('already claimed for different content', result.stderr)
        self.assertEqual([path.read_bytes() for path in paths], before)

    def test_freeze_claims_actual_runtime_then_check_still_requires_commit_for_release(self):
        result = self.gate(self.other, 'freeze')
        self.assertEqual(result.returncode, 0, result.stderr)
        record = json.loads((self.claims / '1.0.0.json').read_text())
        self.assertEqual(record['source_trees'], self.trees(self.other))
        result = self.gate(self.other, 'check', '--release')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('commit reviewed changes', result.stderr)

    def test_incomplete_claim_is_preserved_and_never_overwritten(self):
        self.claims.mkdir(parents=True)
        path = self.claims / '1.0.1.json'
        path.write_bytes(b'{"interrupted":')
        with self.assertRaisesRegex(ReleaseClaimError, 'incomplete or invalid release claim'):
            self.claim(self.other, self.first)
        self.assertEqual(path.read_bytes(), b'{"interrupted":')

    def test_symlink_claim_is_rejected_without_touching_target(self):
        self.claims.mkdir(parents=True)
        target = self.base / 'protected.txt'
        target.write_text('protected')
        (self.claims / '1.0.1.json').symlink_to(target)
        with self.assertRaisesRegex(ReleaseClaimError, 'not a regular file'):
            self.claim(self.other, self.first)
        self.assertEqual(target.read_text(), 'protected')

    def race(self, left, right):
        # Both real processes finish history inspection and stop immediately
        # before the exclusive create, then compete for exactly the same path.
        script = '''import json, os, pathlib, sys, time
sys.path.insert(0, sys.argv[1])
from release_claim import claim_release, ReleaseClaimError
ready, barrier = pathlib.Path(sys.argv[4]), pathlib.Path(sys.argv[5])
original = os.open
def exclusive(path, flags, mode=0o777):
    if flags & os.O_EXCL:
        ready.touch()
        deadline = time.monotonic() + 10
        while not barrier.exists():
            if time.monotonic() > deadline: raise RuntimeError('test barrier timeout')
            time.sleep(.005)
    return original(path, flags, mode)
os.open = exclusive
try:
    claim_release(pathlib.Path(sys.argv[2]), [1,0,1], json.loads(sys.argv[3]), 'fixture/owned')
except ReleaseClaimError as error:
    print(str(error))
    sys.exit(2)
'''
        barrier = self.base / 'go'
        processes = []
        for index, (root, trees) in enumerate([(self.root, left), (self.other, right)]):
            ready = self.base / ('ready-' + str(index))
            processes.append(subprocess.Popen([sys.executable, '-c', script, str(Path(__file__).resolve().parent), str(root), json.dumps(trees), str(ready), str(barrier)], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env=self.environment))
        try:
            deadline = time.monotonic() + 10
            while not all((self.base / ('ready-' + str(index))).exists() for index in range(2)):
                if time.monotonic() > deadline or any(process.poll() is not None for process in processes):
                    self.fail('Concurrent claim processes did not reach O_EXCL barrier')
                time.sleep(.005)
            barrier.touch()
            outputs = [process.communicate(timeout=10) for process in processes]
            self.assertTrue(all(not stderr for _, stderr in outputs), outputs)
            return sorted(process.returncode for process in processes)
        finally:
            for process in processes:
                if process.poll() is None:
                    process.kill()
                process.communicate()

    def test_concurrent_different_content_has_exactly_one_winner(self):
        self.assertEqual(self.race(self.first, self.second), [0, 2])
        record = json.loads((self.claims / '1.0.1.json').read_text())
        self.assertIn(record['source_trees'], [self.first, self.second])
        self.assertEqual(len(list(self.claims.iterdir())), 1)

    def test_concurrent_identical_content_is_idempotent(self):
        self.assertEqual(self.race(self.first, self.first), [0, 0])
        self.assertEqual(json.loads((self.claims / '1.0.1.json').read_text())['source_trees'], self.first)


if __name__ == '__main__':
    unittest.main()
