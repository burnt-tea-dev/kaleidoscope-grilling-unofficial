"""Current conservation, independently reviewed owner scope, and hostile deltas."""
import copy,json,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
import current_runtime_ownership as owner
class RuntimeOwnership(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.actual=owner.runtime_files();cls.doc=owner.manifest()
 def test_reviewed_candidate_and_independent_source_validators(self):
  self.assertEqual(owner.verify_current_runtime(),{'baseline_files':4496,'current_files':4500,'owned_changes':14})
 def test_unrelated_mutation_addition_and_deletions(self):
  unchanged=next(p for p in self.actual if p not in self.doc['changes'])
  for operation in ('mutate','add','delete','delete_owned','revert_owned'):
   files=dict(self.actual);p=next(iter(self.doc['changes']))
   if operation=='mutate':files[unchanged]+=b'\n'
   elif operation=='add':files[owner.PREFIXES[0]+'/untracked_unknown.json']=b'{}'
   elif operation=='delete':del files[unchanged]
   elif operation=='delete_owned':del files[p]
   else:files[p]=owner.frozen_runtime_bytes(p)
   with self.subTest(operation=operation),self.assertRaises(ValueError):owner.validate_inventory(files,self.doc)
 def test_owned_payload_with_recomputed_hash_is_not_authority(self):
  for p in self.doc['changes']:
   files=dict(self.actual);doc=copy.deepcopy(self.doc);files[p]+=b'\n';doc['changes'][p]['after_sha256']=owner.sha(files[p])
   with self.subTest(path=p),self.assertRaises(ValueError):owner.validate_inventory(files,doc)
 def test_manifest_baseline_scope_owner_operations_and_path_mutations(self):
  p=next(iter(self.doc['changes']));mutations=[]
  for key,value in [('baseline_commit','0'*40),('schema',2)]:
   d=copy.deepcopy(self.doc);d[key]=value;mutations.append(d)
  for key,value in [('owner','arbitrary_module'),('operation','delete'),('before_sha256','0'*64),('after_sha256','f'*64)]:
   d=copy.deepcopy(self.doc);d['changes'][p][key]=value;mutations.append(d)
  for bad in ('../escape','/absolute','projects/grilling/gameplay_core/resource_pack/*'):
   d=copy.deepcopy(self.doc);d['changes'][bad]=d['changes'].pop(p);mutations.append(d)
  d=copy.deepcopy(self.doc);del d['changes'][p];mutations.append(d)
  for d in mutations:
   with self.assertRaises(ValueError):owner.validate_inventory(self.actual,d)
   with self.assertRaises(ValueError):owner.manifest((json.dumps(d,indent=2)+'\n').encode())
 def test_untracked_files_and_symlinks_are_in_inventory(self):
  with tempfile.TemporaryDirectory()as directory:
   root=Path(directory);p=root/owner.PREFIXES[0]/'new.json';p.parent.mkdir(parents=True);p.write_bytes(b'{}')
   self.assertIn(p.relative_to(root).as_posix(),owner.runtime_files(root))
   p.with_name('link').symlink_to(p)
   with self.assertRaises(ValueError):owner.runtime_files(root)
 def test_runtime_pack_root_symlink_rejected(self):
  with tempfile.TemporaryDirectory()as directory:
   root=Path(directory);target=root/'elsewhere';target.mkdir();pack=root/owner.PREFIXES[0];pack.parent.mkdir(parents=True);pack.symlink_to(target,target_is_directory=True)
   with self.assertRaises(ValueError):owner.runtime_files(root)
 def test_validator_failure_is_not_cached_or_ignored(self):
  import sys
  sys.path.insert(0,str(owner.ROOT/'development/gameplay_core'));import verification_session
  with patch.object(verification_session,'run_checked_once',side_effect=RuntimeError('source validator failed')):
   with self.assertRaises(RuntimeError):owner.verify_current_runtime()
 def test_validator_cannot_change_candidate_during_validation(self):
  bad=dict(self.actual);bad[next(iter(bad))]+=b'changed'
  with patch.object(owner,'runtime_files',side_effect=[self.actual,bad]),patch.object(owner,'validate_plate_source'):
   with self.assertRaises(ValueError):owner.verify_current_runtime()
 def test_frozen_preimage_inventory_is_immutable(self):
  with self.assertRaises(TypeError):owner.frozen_runtime_files()['new']=b''
if __name__=='__main__':unittest.main()
