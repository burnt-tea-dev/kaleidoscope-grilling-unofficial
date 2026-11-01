import hashlib, json, os, shutil, subprocess, sys, tempfile, unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[3]
TOOL=ROOT/'tools/qa/held_status_observer.py'
BP=ROOT/'projects/grilling/gameplay_core/behavior_pack'

def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()

class HeldStatusToolTests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
  self.parent=Path(self.temp.name)/'copy';self.parent.mkdir()
  self.live_root=self.parent/'declared-live';self.live_root.mkdir()
  self.pack=self.parent/'behavior_packs'/'c68005c5-23ff-54e8-a3ff-da6349ad43c2';self.pack.parent.mkdir();shutil.copytree(BP,self.pack)
 def run_tool(self,operation,path=None):
  return subprocess.run([sys.executable,str(TOOL),operation,'--pack',str(path or self.pack),'--bds-stopped','--live-root',str(self.live_root)],capture_output=True,text=True)
 def test_install_restore_exact_original_and_refusals(self):
  original=self.pack/'scripts/held_visual_transport.js';before=digest(original)
  result=self.run_tool('install');self.assertEqual(result.returncode,0,result.stderr)
  receipt=json.loads((self.pack.parent/'.held-status-qa-receipt.json').read_text())
  self.assertEqual(receipt['files']['scripts/held_visual_transport.js']['original_sha256'],before)
  self.assertEqual(receipt['bds_stopped'],'caller_assertion_only; verify independently with assert_quiet')
  self.assertNotEqual(digest(original),before)
  backup=self.pack.parent/'.held-status-qa-original/scripts/held_visual_transport.js'
  self.assertEqual(digest(backup),before)
  after_install=digest(original)
  self.assertNotEqual(self.run_tool('install').returncode,0)
  self.assertEqual(digest(original),after_install)
  self.assertNotEqual(self.run_tool('install',str(self.live_root/'behavior_packs/c68005c5-23ff-54e8-a3ff-da6349ad43c2')).returncode,0)
  alias=Path(self.temp.name)/'live-alias';alias.symlink_to(self.live_root,target_is_directory=True)
  self.assertNotEqual(self.run_tool('install',str(alias/'behavior_packs/c68005c5-23ff-54e8-a3ff-da6349ad43c2')).returncode,0)
  self.assertNotEqual(self.run_tool('install',str(BP)).returncode,0)
  self.assertEqual(digest(original),after_install)
  result=self.run_tool('restore');self.assertEqual(result.returncode,0,result.stderr)
  report=json.loads(result.stdout)
  self.assertTrue(report['instrumentation_restored']);self.assertTrue(report['full_baseline_restored'])
  self.assertEqual(digest(original),before)
  self.assertFalse((self.pack.parent/'.held-status-qa-receipt.json').exists())
 def test_changed_instrumented_file_is_preserved_on_restore(self):
  self.assertEqual(self.run_tool('install').returncode,0)
  target=self.pack/'scripts/held_visual_transport.js';target.write_text(target.read_text()+'// operator edit\n')
  changed=digest(target);result=self.run_tool('restore')
  self.assertNotEqual(result.returncode,0);self.assertEqual(digest(target),changed)
  self.assertTrue((self.pack.parent/'.held-status-qa-original').exists())
 def test_other_file_change_survives_transport_restore_and_is_reported(self):
  self.assertEqual(self.run_tool('install').returncode,0)
  changed_file=self.pack/'manifest.json';changed_file.write_text(changed_file.read_text()+'\n')
  saved=changed_file.read_bytes()
  result=self.run_tool('restore');self.assertEqual(result.returncode,0,result.stderr)
  report=json.loads(result.stdout)
  self.assertTrue(report['instrumentation_restored']);self.assertFalse(report['full_baseline_restored'])
  self.assertTrue(report['other_files_preserved']);self.assertEqual(changed_file.read_bytes(),saved)
 def test_observer_reads_actual_cache_items_and_frame_via_system_event(self):
  self.assertEqual(self.run_tool('install').returncode,0)
  env=os.environ.copy();env['HELD_STATUS_QA_PACK']=str(self.pack)
  result=subprocess.run(['node','--import',str(ROOT/'tests/helpers/register-minecraft-loader.mjs'),'--test',str(ROOT/'tests/native/held-status/observer_live_readback.test.mjs')],cwd=ROOT,env=env,capture_output=True,text=True)
  self.assertEqual(result.returncode,0,result.stdout+'\n'+result.stderr)
 def test_g194_zip_profile_install_readback_restore_when_fixture_archive_exists(self):
  archive_value=os.environ.get('SENLUO_QA_CONTROL_ARCHIVE')
  if not archive_value:self.skipTest('set SENLUO_QA_CONTROL_ARCHIVE for the local A pack integration test')
  archive=Path(archive_value).resolve()
  if not archive.is_file():self.skipTest('SENLUO_QA_CONTROL_ARCHIVE does not name a readable file')
  import zipfile
  self.temp.cleanup();self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
  self.parent=Path(self.temp.name)/'copy';self.parent.mkdir()
  self.live_root=self.parent/'declared-live';self.live_root.mkdir()
  self.pack=self.parent/'behavior_packs'/'c68005c5-23ff-54e8-a3ff-da6349ad43c2';self.pack.mkdir(parents=True)
  prefix='behavior_packs/c68005c5-23ff-54e8-a3ff-da6349ad43c2/'
  with zipfile.ZipFile(archive) as bundle:
   for name in bundle.namelist():
    if name.startswith(prefix) and not name.endswith('/'):
     relative=Path(name[len(prefix):]);target=self.pack/relative;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(bundle.read(name))
  result=self.run_tool('install');self.assertEqual(result.returncode,0,result.stdout+'\n'+result.stderr)
  receipt=json.loads((self.pack.parent/'.held-status-qa-receipt.json').read_text());self.assertEqual(receipt['profile'],'g194-native32')
  env=os.environ.copy();env['HELD_STATUS_QA_PACK']=str(self.pack)
  result=subprocess.run(['node','--import',str(ROOT/'tests/helpers/register-minecraft-loader.mjs'),'--test',str(ROOT/'tests/native/held-status/legacy_live_readback.test.mjs')],cwd=ROOT,env=env,capture_output=True,text=True)
  self.assertEqual(result.returncode,0,result.stdout+'\n'+result.stderr)
  result=self.run_tool('restore');self.assertEqual(result.returncode,0,result.stderr)
  report=json.loads(result.stdout);self.assertTrue(report['instrumentation_restored']);self.assertFalse(report['g206_transport_restored']);self.assertTrue(report['full_baseline_restored'])
 def test_baseline_mismatch_rejected_without_writes(self):
  target=self.pack/'scripts/held_visual_transport.js';target.write_text(target.read_text()+'// drift\n')
  changed=digest(target);result=self.run_tool('install')
  self.assertNotEqual(result.returncode,0);self.assertEqual(digest(target),changed)
  self.assertFalse((self.pack.parent/'.held-status-qa-receipt.json').exists())

if __name__=='__main__':unittest.main()
