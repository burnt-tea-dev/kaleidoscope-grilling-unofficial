#!/usr/bin/env python3
"""Adversarial release tests in disposable Git repositories, never a game world."""
import copy,importlib.util,json,os,subprocess,tempfile,unittest,zipfile
from pathlib import Path
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('gate',Path(__file__).with_name('baseline_gate.py'))
gate=importlib.util.module_from_spec(spec);spec.loader.exec_module(gate)
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
if __name__=='__main__':unittest.main()
