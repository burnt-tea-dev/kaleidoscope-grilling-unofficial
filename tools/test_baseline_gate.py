#!/usr/bin/env python3
"""Adversarial release tests in disposable Git repositories, never a game world."""
import copy,importlib.util,json,os,subprocess,tempfile,unittest,zipfile,hashlib,shutil,sys,time
from pathlib import Path
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('gate',Path(__file__).with_name('baseline_gate.py'))
gate=importlib.util.module_from_spec(spec);spec.loader.exec_module(gate)
ReleaseClaimError,claim_release=gate.ReleaseClaimError,gate.claim_release
json_spec=importlib.util.spec_from_file_location('json_check',Path(__file__).with_name('check_json.py'))
json_check=importlib.util.module_from_spec(json_spec);json_spec.loader.exec_module(json_check)
class BaselineGateTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name);self.previous=gate.ROOT;gate.ROOT=self.root
  self.config={'repository':'fixture/owned','repository_id':1,'version':[1,0,0],'runtime':{'BP':'runtime/BP','RP':'runtime/RP'},'packs':{'BP':{'uuid':'bp','dependencies':[]},'RP':{'uuid':'rp','dependencies':[]}}}
  for side in ['BP','RP']:
   root=self.root/'runtime'/side;root.mkdir(parents=True)
   (root/'manifest.json').write_text(json.dumps({'header':{'uuid':side.lower(),'version':[1,0,0]},'modules':[{'version':[1,0,0]}]}));(root/'content.json').write_text('{}')
  self.target={'repository':'fixture-org/owned','repository_id':1,'owner':{'login':'fixture-org','id':2,'type':'Organization'},'private':False,'logical_runtime_repository':'fixture/owned'}
  (self.root/'.repo-target.json').write_text(json.dumps(self.target))
  self.config['source_trees'],self.files=gate.validate(self.config)
  (self.root/'release-history.json').write_text(json.dumps({'1.0.0':self.config['source_trees']}))
  self.git('init','-q');self.git('config','user.email','fixture@example.invalid');self.git('config','user.name','Fixture');self.git('add','.');self.git('commit','-qm','Fixture')
  self.base=self.git('rev-parse','HEAD').strip()
  self.env={k:os.environ.pop(k) for k in ['GITHUB_REPOSITORY','GITHUB_REPOSITORY_ID','GITHUB_REPOSITORY_OWNER','GITHUB_REPOSITORY_OWNER_ID','GITHUB_EVENT_PATH','GITHUB_ACTIONS','SENLUO_SOURCE_GATE'] if k in os.environ}
 def tearDown(self):
  gate.ROOT=self.previous
  for key in ['GITHUB_REPOSITORY','GITHUB_REPOSITORY_ID','GITHUB_REPOSITORY_OWNER','GITHUB_REPOSITORY_OWNER_ID','GITHUB_EVENT_PATH','GITHUB_ACTIONS','SENLUO_SOURCE_GATE']:os.environ.pop(key,None)
  os.environ.update(self.env);self.tmp.cleanup()
 def git(self,*args):return subprocess.check_output(['git',*args],cwd=self.root,text=True)
 def reject(self,part,fn):
  with self.assertRaises(SystemExit) as caught:fn()
  self.assertIn(part,str(caught.exception))
 def test_valid_clean_release(self):gate.check(self.config,release=True,history_base=self.base)
 def test_readme_version_rejected(self):
  (self.root/'README.md').write_text('## Current maintained baseline: 0.0.1\n')
  self.reject('maintained version',lambda:gate.validate(self.config))
 def test_runtime_edit_rejected(self):
  (self.root/'runtime/BP/content.json').write_text('{"silent":"patch"}')
  self.reject('runtime changed',lambda:gate.check(self.config))
 def test_reused_version_rejected(self):
  (self.root/'runtime/BP/content.json').write_text('{"silent":"patch"}')
  config=copy.deepcopy(self.config);config['source_trees'],_=gate.validate(config)
  self.reject('release identity',lambda:gate.check(config))
 def test_history_tampering_rejected(self):
  (self.root/'release-history.json').write_text('{}')
  self.reject('historical release changed',lambda:gate.check(self.config,history_base=self.base))
 def test_bad_history_reference_rejected(self):self.reject('not a commit',lambda:gate.check(self.config,history_base='unknown-base'))
 def test_untracked_runtime_rejected(self):
  (self.root/'runtime/BP/hidden.json').write_text('{}');config=copy.deepcopy(self.config);config['source_trees'],_=gate.validate(config)
  (self.root/'release-history.json').write_text(json.dumps({'1.0.0':config['source_trees']}))
  self.reject('untracked runtime',lambda:gate.check(config))
 def test_dirty_release_rejected(self):
  (self.root/'release-history.json').write_text(json.dumps({'1.0.0':self.config['source_trees']},indent=2))
  self.reject('commit reviewed',lambda:gate.check(self.config,release=True))
 def test_patched_export_rejected(self):
  archive=self.root/'bad.mcaddon'
  with zipfile.ZipFile(archive,'w') as z:
   for side,rows in self.files.items():
    for path in rows:z.writestr(side+'/'+path,(self.root/self.config['runtime'][side]/path).read_bytes())
   z.writestr('BP/install-only.js','hidden patch')
  self.reject('archive differs',lambda:gate.verify_export(self.config,archive,self.files))
 def ci_identity(self):
  event=self.root/'event.json';event.write_text(json.dumps({'repository':{'full_name':self.target['repository'],'id':1,'owner':self.target['owner'],'private':False}}))
  os.environ.update({'GITHUB_REPOSITORY':self.target['repository'],'GITHUB_REPOSITORY_ID':'1','GITHUB_REPOSITORY_OWNER':'fixture-org','GITHUB_REPOSITORY_OWNER_ID':'2','GITHUB_EVENT_PATH':str(event)})
  return event
 def test_transferred_repository_preserves_logical_release_identity(self):
  before=copy.deepcopy(self.config);self.ci_identity();gate.check(self.config)
  self.assertEqual(self.config,before)
 def test_wrong_owner_visibility_or_repository_event_rejected(self):
  event=self.ci_identity();original=json.loads(event.read_text())
  for key,value in [('id',99),('full_name','other/owned'),('private',True),('owner',{'login':'fixture-org','id':3,'type':'Organization'}),('owner',{'login':'fixture-org','id':2,'type':'User'})]:
   changed=copy.deepcopy(original);changed['repository'][key]=value;event.write_text(json.dumps(changed))
   with self.subTest(key=key,value=value):self.reject('event identity',lambda:gate.check(self.config))
  event.write_text(json.dumps(original));os.environ['GITHUB_REPOSITORY_OWNER_ID']='3'
  self.reject('wrong repository owner',lambda:gate.check(self.config))
 def test_cross_repository_marker_requires_fixed_parent_and_child_identity(self):
  target=json.loads((Path(__file__).resolve().parents[1]/'.repo-target.json').read_text())
  (self.root/'.repo-target.json').write_text(json.dumps(target));config=copy.deepcopy(self.config)
  config.update(repository=target['logical_runtime_repository'],repository_id=target['repository_id'])
  event=self.root/'parent-event.json';actual={'full_name':'burnt-tea-dev/kaleidoscope-tavern-unofficial','id':1377171148,'owner':target['owner'],'private':False}
  event.write_text(json.dumps({'repository':actual}))
  values={'GITHUB_REPOSITORY':target['repository'],'GITHUB_REPOSITORY_ID':str(target['repository_id']),'GITHUB_REPOSITORY_OWNER':'burnt-tea-dev','GITHUB_REPOSITORY_OWNER_ID':'344456559','GITHUB_EVENT_PATH':str(event),'SENLUO_SOURCE_GATE':'1'}
  saved={key:os.environ.get(key) for key in values};os.environ.update(values)
  try:
   gate.validate_repository(config)
   actual['id']=99;event.write_text(json.dumps({'repository':actual}))
   self.reject('event identity',lambda:gate.validate_repository(config))
   actual['id']=1377171148;actual['full_name']='fork/kaleidoscope-tavern-unofficial';event.write_text(json.dumps({'repository':actual}))
   self.reject('unreviewed cross-repository',lambda:gate.validate_repository(config))
  finally:
   for key,value in saved.items():
    if value is None:os.environ.pop(key,None)
    else:os.environ[key]=value
 def test_canonical_target_pins_organization_and_repository_id(self):
  target=json.loads((Path(__file__).resolve().parents[1]/'.repo-target.json').read_text());config=copy.deepcopy(self.config)
  config.update(repository=target['logical_runtime_repository'],repository_id=target['repository_id']);path=self.root/'.repo-target.json'
  path.write_text(json.dumps(target));gate.validate_repository(config)
  for change in ['organization','owner_id','repository_id']:
   changed=copy.deepcopy(target);current=copy.deepcopy(config)
   if change=='organization':changed['owner']['login']='another-org';changed['repository']='another-org/'+target['repository'].split('/')[-1]
   elif change=='owner_id':changed['owner']['id']=99
   else:changed['repository_id']=current['repository_id']=99
   path.write_text(json.dumps(changed))
   with self.subTest(change=change):self.reject('canonical repository target mismatch',lambda:gate.validate_repository(current))
 def test_missing_or_unreviewed_target_rejected(self):
  path=self.root/'.repo-target.json';path.unlink();self.reject('target missing',lambda:gate.check(self.config))
  for key,value in [('repository_id',99),('logical_runtime_repository','other/owned'),('private',True)]:
   target=copy.deepcopy(self.target);target[key]=value;path.write_text(json.dumps(target))
   with self.subTest(key=key):self.reject('target mismatch',lambda:gate.check(self.config))
 def test_wrong_repository_rejected(self):
  os.environ['GITHUB_REPOSITORY']='wrong/repo'
  try:self.reject('wrong repository',lambda:gate.check(self.config))
  finally:os.environ.pop('GITHUB_REPOSITORY')

class JsonValidationTests(unittest.TestCase):
 def test_official_reference_header_parses_without_rewriting_original_bytes(self):
  path=json_check.ROOT/json_check.REFERENCE;before=path.read_bytes()
  parsed=json_check.load_json(path)
  self.assertEqual(len(parsed),83);self.assertEqual(parsed[0]['atlas_tile'],'fire_0');self.assertEqual(path.read_bytes(),before)
 def test_ordinary_json_is_strict_and_renamed_reference_comments_reject(self):
  with tempfile.TemporaryDirectory() as directory:
   root=Path(directory);ordinary=root/'runtime.json';ordinary.write_text('{"label":"// literal"}')
   self.assertEqual(json_check.load_json(ordinary),{'label':'// literal'})
   ordinary.write_text('// unregistered comment\n{"valid":true}')
   with self.assertRaises(json.JSONDecodeError):json_check.load_json(ordinary)
   renamed=root/'renamed.json';renamed.write_bytes((json_check.ROOT/json_check.REFERENCE).read_bytes())
   with self.assertRaises(json.JSONDecodeError):json_check.load_json(renamed)
 def test_reference_byte_hash_and_registered_source_identity_are_required(self):
  raw=(json_check.ROOT/json_check.REFERENCE).read_bytes();source=json.loads((json_check.ROOT/json_check.FIXTURE/'source-manifest.json').read_text())
  with tempfile.TemporaryDirectory() as directory:
   root=Path(directory);path=root/json_check.REFERENCE;path.parent.mkdir(parents=True);manifest=root/json_check.FIXTURE/'source-manifest.json';manifest.write_text(json.dumps(source))
   with patch.object(json_check,'ROOT',root):
    path.write_bytes(raw+b'\n')
    with self.assertRaisesRegex(ValueError,'fixture bytes changed'):json_check.load_json(path)
    path.write_bytes(raw);wrong=copy.deepcopy(source);wrong['minecraft_bedrock']='1.26.51.1';manifest.write_text(json.dumps(wrong))
    with self.assertRaisesRegex(ValueError,'source identity changed'):json_check.load_json(path)
    wrong=copy.deepcopy(source);next(row for row in wrong['files'] if row['path']=='resource_pack/textures/flipbook_textures.json')['sha256']='unregistered';manifest.write_text(json.dumps(wrong))
    with self.assertRaisesRegex(ValueError,'fixture record changed'):json_check.load_json(path)
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
        for name in ['baseline_gate.py']:
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
from baseline_gate import claim_release, ReleaseClaimError
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



if __name__=='__main__':unittest.main()
