"""Current conservation, independently reviewed owner scope, and hostile deltas."""
import copy,json,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
import current_runtime_ownership as owner
class RuntimeOwnership(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.actual=owner.runtime_files();cls.doc=owner.manifest()
  from stable_host_source import predecessor_runtime
  cls.g149=predecessor_runtime(cls.actual)
 def test_reviewed_candidate_and_independent_source_validators(self):
  self.assertEqual(owner.verify_current_runtime(),{'baseline_files':4496,'current_files':4501,'owned_changes':19,'owner_property_layer_changes':70,'seasoning_tp_layer_changes':68,'pending_offhand_layer_changes':11,'stable_host_layer_changes':6})
 def test_stable_host_layer_rejects_changed_scope_postimage_and_predecessor(self):
  import stable_host_source as stable
  import pending_offhand_source as pending
  self.assertEqual(self.g149,pending.expected_files())
  self.assertEqual(stable.preceding_host_spec(),json.loads(self.g149[stable.BP+'/host-extensions/board-api.json']))
  with self.assertRaises(ValueError):stable.preceding_host_spec((stable.ROOT/stable.BP/'host-extensions/board-api.json').read_bytes()+b'\n')
  for path in stable.RUNTIME_PATHS:
   files=dict(self.actual);files[path]+=b'\n'
   with self.subTest(path=path),self.assertRaises(ValueError):stable.predecessor_runtime(files)
   self.assertEqual(stable.reference_bytes(path),self.g149[path])
  for operation in ('add','delete','old_postimage'):
   files=dict(self.actual);path=next(iter(stable.RUNTIME_PATHS))
   if operation=='add':files[owner.PREFIXES[0]+'/unknown.json']=b'{}'
   elif operation=='delete':del files[path]
   else:files[path]=self.g149[path]
   with self.subTest(operation=operation),self.assertRaises(ValueError):stable.predecessor_runtime(files)
  with self.assertRaises(ValueError):stable.reference_bytes(stable.GUIDE,(stable.ROOT/stable.GUIDE).read_bytes()+b'\n')
  forged=copy.deepcopy(stable.ledger());path=next(iter(stable.RUNTIME_PATHS))
  forged['changes'][path]['after_sha256']=owner.sha(self.actual[path]+b'\n')
  with self.assertRaises(ValueError):stable.ledger((json.dumps(forged,indent=2)+'\n').encode())
  forged=copy.deepcopy(stable.ledger());forged['predecessor_commit']='0'*40
  with self.assertRaises(ValueError):stable.ledger((json.dumps(forged,indent=2)+'\n').encode())
  with self.assertRaises(ValueError):stable.reference_bytes(owner.PREFIXES[0]+'/scripts/main.js')
  with self.assertRaises(TypeError):stable.expected_files()['new']=b''
 def test_pending_offhand_layer_rejects_mutations_and_preserves_exact_predecessor(self):
  import pending_offhand_source as pending
  import seasoning_tp_source as tp
  changes=pending.ledger()['changes']
  self.assertEqual(set(changes),pending.PATHS|{prefix+'/manifest.json'for prefix in owner.PREFIXES})
  self.assertEqual(pending.predecessor_runtime(self.g149),tp.expected_files())
  for path in changes:
   files=dict(self.g149);files[path]+=b'\n'
   with self.subTest(path=path),self.assertRaises(ValueError):pending.predecessor_runtime(files)
  for path in pending.PATHS:
   self.assertEqual(pending.reference_bytes(path),tp.expected_files()[path])
   with self.subTest(path=path),self.assertRaises(ValueError):pending.reference_bytes(path,self.actual[path]+b'\n')
  path=next(iter(pending.PATHS));forged=copy.deepcopy(pending.ledger())
  forged['changes'][path]['after_sha256']=owner.sha(self.actual[path]+b'\n')
  with self.assertRaises(ValueError):pending.ledger((json.dumps(forged,indent=2)+'\n').encode())
  for path in (owner.PREFIXES[0]+'/manifest.json',owner.PREFIXES[1]+'/attachables/special_seasoning.attachable.json'):
   with self.assertRaises(ValueError):pending.reference_bytes(path)
  with self.assertRaises(TypeError):pending.expected_files()['new']=b''
 def test_seasoning_layer_rejects_mutated_postimages_and_forged_ledger(self):
  import seasoning_tp_source as tp
  from pending_offhand_source import predecessor_runtime
  actual=predecessor_runtime(self.g149)
  self.assertEqual(tp.predecessor_runtime(actual),owner.owner_property_expected_files())
  changes=tp.ledger()['changes']
  self.assertEqual(len(changes),68)
  for path in changes:
   files=dict(actual);files[path]+=b'\n'
   with self.subTest(path=path),self.assertRaises(ValueError):tp.predecessor_runtime(files)
  path=next(p for p in changes if '/attachables/' in p)
  self.assertEqual(tp.reference_bytes(path),owner.owner_property_expected_files()[path])
  with self.assertRaises(ValueError):tp.reference_bytes(path,self.actual[path]+b'\n')
  forged=copy.deepcopy(tp.ledger());forged['changes'][path]['after_sha256']=owner.sha(self.actual[path]+b'\n')
  with self.assertRaises(ValueError):tp.ledger((json.dumps(forged,indent=2)+'\n').encode())
  with self.assertRaises(ValueError):tp.reference_bytes(owner.PREFIXES[0]+'/manifest.json')
  with self.assertRaises(TypeError):tp.expected_files()['new']=b''
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
 def test_five_historical_proofs_check_inventory_without_spawning_leaves(self):
  import importlib,sys
  sys.path.insert(0,str(owner.ROOT/'development/gameplay_core'))
  cases=[('test_eating_route_extraction','Extraction','test_all_other_runtime_bytes_and_owned_inventory'),
   ('test_eating_compiler_pipeline','PipelineTests','test_every_runtime_blob_remains_baseline'),
   ('test_offhand_eating_projection','OffhandProjection','test_all_other_runtime_blobs_unchanged_after_inverse'),
   ('test_ordinary_relative_calibration','OrdinaryRelativeCalibration','test_only_owned_runtime_files_changed'),
   ('test_composed_skewer_witnesses','ComposedWitnessTests','test_effect_postimages_inverse_and_mutations_are_exact')]
  tests=[]
  for module,klass,method in cases:
   tests.append(getattr(importlib.import_module(module),klass)(method))
  with patch.object(owner,'validate_plate_source',side_effect=AssertionError('Historical byte proof must not spawn leaves'))as leaves,patch.object(owner,'verify_current_inventory',wraps=owner.verify_current_inventory)as inventory:
   result=unittest.TestResult();unittest.TestSuite(tests).run(result)
   self.assertEqual(result.testsRun,5);self.assertEqual(result.errors,[]);self.assertEqual(result.failures,[])
   self.assertEqual(inventory.call_count,5);leaves.assert_not_called()
 def test_full_gate_requires_inventory_before_and_after_one_leaf_phase(self):
  calls=[]
  with patch.object(owner,'verify_current_inventory',side_effect=lambda:calls.append('inventory')or{'ok':True}),patch.object(owner,'validate_plate_source',side_effect=lambda:calls.append('leaves')):
   self.assertEqual(owner.verify_current_runtime(),{'ok':True})
  self.assertEqual(calls,['inventory','leaves','inventory'])
  import sys
  sys.path.insert(0,str(owner.ROOT/'development/gameplay_core'));import verification_session
  with patch.object(owner,'verify_current_inventory',return_value={'ok':True}),patch.object(verification_session,'run_checked_once')as run:
   owner.verify_current_runtime()
  self.assertEqual(run.call_count,5)
  commands=[c.args[0]for c in run.call_args_list]
  self.assertEqual([Path(c[2]).name for c in commands[:4]],['test_plate_use_arm_visibility.py','build_plate_display.py','build_plate_held.py','test_held_render_contracts.py'])
  self.assertEqual(commands[3][-1],'PlateSpecialContracts')
  self.assertEqual(commands[4][0:2],['node','--test'])
 def test_new_owner_semantics_reject_performance_queue_and_manifest_drift(self):
  read=Path.read_bytes
  main=owner.ROOT/owner.PREFIXES[0]/'scripts/main.js'
  queue=owner.ROOT/owner.PREFIXES[0]/'scripts/timed_work_queue.js'
  manifest=owner.ROOT/owner.PREFIXES[0]/'manifest.json'
  changed=json.loads(read(manifest));changed['header']['uuid']='unowned'
  cases=[(main,read(main).replace(b'const fx=readFx(p);',b'const fx={};',1)),
         (queue,read(queue)+b'\n'),(manifest,json.dumps(changed).encode())]
  for path,data in cases:
   with self.subTest(path=path),patch.object(Path,'read_bytes',side_effect=lambda p: data if p==path else read(p),autospec=True):
    with self.assertRaises((AssertionError,ValueError)):owner.validate_merged_performance_and_identity()
 def test_frozen_preimage_inventory_is_immutable(self):
  with self.assertRaises(TypeError):owner.frozen_runtime_files()['new']=b''
if __name__=='__main__':unittest.main()
