"""Hostile successor-layer tests, independent of final candidate fingerprints."""
import copy
import json
import tempfile
import unittest
from pathlib import Path
from types import MappingProxyType
from unittest.mock import patch
import g153_repair_source as repair

class RepairAdmission(unittest.TestCase):
    def setUp(self):
        self.directory=tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root=Path(self.directory.name)
        self.a=repair.BP+'/scripts/a.js'
        self.b=repair.RP+'/textures/b.bin'
        self.guide=repair.GUIDE
        self.c=repair.RP+'/models/new.geo.json'
        self.before={self.a:b'old a',self.b:b'unchanged'}
        self.after={self.a:b'new a',self.b:b'unchanged',self.c:b'new resource'}
        self.owners={self.a:'test_behavior',self.guide:'test_guide',self.c:'test_added_geometry'}
        self.operations={self.a:'modify',self.guide:'modify',self.c:'add'}
        self.preimages={**self.before,self.guide:b'old guide'}
        self.postimages={**self.after,self.guide:b'new guide'}
        for path,data in self.postimages.items():
            target=self.root/path;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
        self.doc={'schema':1,'predecessor_commit':repair.PREVIOUS,'predecessor_tree':repair.PREVIOUS_TREE,
                  'predecessor_version':[2,8,152],'version':[2,8,153],
                  'evidence_scope':'source_only','native_acceptance':False,'client_acceptance':False,
                  'changes':{path:{'owner':owner,'operation':self.operations[path],'before_sha256':repair.sha(self.preimages[path]) if path in self.preimages else None,
                                   'after_sha256':repair.sha(self.postimages[path])}for path,owner in self.owners.items()}}
        self.raw=(json.dumps(self.doc,indent=2)+'\n').encode()
        self.ledger_path=self.root/'ledger.json';self.ledger_path.write_bytes(self.raw)
        self.context=patch.multiple(repair,ROOT=self.root,OWNERS=MappingProxyType(self.owners),PATHS=frozenset(self.owners),
            RUNTIME_PATHS=frozenset({self.a,self.c}),OPERATIONS=MappingProxyType(self.operations),LEDGER=self.ledger_path,LEDGER_SHA256=repair.sha(self.raw))
        self.context.start();self.addCleanup(self.context.stop)
        self.previous=patch.object(repair,'preceding_files',return_value=MappingProxyType(self.before))
        self.previous.start();self.addCleanup(self.previous.stop)
        self.bytes=patch.object(repair,'preceding_bytes',side_effect=lambda path:self.preimages.get(path))
        self.bytes.start();self.addCleanup(self.bytes.stop)

    def test_exact_full_predecessor_recovery_and_immutable_result(self):
        self.assertEqual(repair.predecessor_runtime(self.after),self.before)
        self.assertEqual(repair.reference_bytes(self.a,self.after[self.a]),self.before[self.a])
        self.assertEqual(repair.reference_bytes(self.a,self.before[self.a]),self.before[self.a])
        self.assertEqual(repair.reference_bytes(self.guide,b'new guide'),b'old guide')
        self.assertEqual(repair.reference_bytes(self.b,b'unchanged'),b'unchanged')
        with self.assertRaises(TypeError):repair.expected_files()['new']=b''
        with self.assertRaises(ValueError):repair.reference_bytes(self.c,b'new resource')
        self.assertNotIn(self.c,repair.predecessor_runtime(self.after))

    def test_changed_added_deleted_or_reverted_runtime_fails(self):
        for operation in ('owned','unowned','addition','deletion','delete_owned_addition','mutate_owned_addition','revert'):
            files=dict(self.after)
            if operation=='owned':files[self.a]+=b'!'
            elif operation=='unowned':files[self.b]+=b'!'
            elif operation=='addition':files[repair.BP+'/unknown']=b'new'
            elif operation=='deletion':del files[self.b]
            elif operation=='delete_owned_addition':del files[self.c]
            elif operation=='mutate_owned_addition':files[self.c]+=b'!'
            else:files[self.a]=self.before[self.a]
            with self.subTest(operation=operation),self.assertRaises(ValueError):repair.predecessor_runtime(files)

    def test_changed_working_postimage_or_authored_guide_fails(self):
        for path in self.owners:
            target=self.root/path;target.write_bytes(self.postimages[path]+b'!')
            with self.subTest(path=path),self.assertRaises(ValueError):repair.predecessor_runtime(self.after)
            with self.subTest(path=path),self.assertRaises(ValueError):repair.reference_bytes(path,target.read_bytes())
            target.write_bytes(self.postimages[path])

    def test_warm_admission_rechecks_authored_guide_and_ledger(self):
        self.assertEqual(repair.predecessor_runtime(self.after),self.before)
        guide=self.root/self.guide
        guide.write_bytes(self.postimages[self.guide]+b'!')
        with self.assertRaises(ValueError):repair.predecessor_runtime(self.after)
        guide.write_bytes(self.postimages[self.guide])
        self.assertEqual(repair.predecessor_runtime(self.after),self.before)
        self.ledger_path.write_bytes(self.raw+b' ')
        with self.assertRaises(ValueError):repair.predecessor_runtime(self.after)

    def test_forged_recomputed_hashes_scope_identity_and_owner_are_not_authority(self):
        for change in ('hash','scope','owner','operation','predecessor','tree','version'):
            doc=copy.deepcopy(self.doc)
            if change=='hash':doc['changes'][self.a]['after_sha256']=repair.sha(b'forged')
            elif change=='scope':doc['changes'][repair.BP+'/extra']={**doc['changes'][self.a]}
            elif change=='owner':doc['changes'][self.a]['owner']='other'
            elif change=='operation':doc['changes'][self.a]['operation']='delete'
            elif change=='predecessor':doc['predecessor_commit']='0'*40
            elif change=='tree':doc['predecessor_tree']='0'*40
            else:doc['version']=[2,8,154]
            data=(json.dumps(doc,indent=2)+'\n').encode()
            with self.subTest(change=change),self.assertRaises(ValueError):repair.ledger(data)

    def test_explicit_schema_scope_checks_survive_trusted_digest_injection(self):
        for key,value in [('predecessor_tree','0'*40),('version',[2,8,154])]:
            doc=copy.deepcopy(self.doc);doc[key]=value;data=json.dumps(doc).encode()
            with patch.object(repair,'LEDGER_SHA256',repair.sha(data)),self.assertRaises(ValueError):repair.ledger(data)
        doc=copy.deepcopy(self.doc);doc['changes'][self.a]['owner']='unreviewed';data=json.dumps(doc).encode()
        with patch.object(repair,'LEDGER_SHA256',repair.sha(data)),self.assertRaises(ValueError):repair.ledger(data)

    def test_added_resource_requires_absent_preimage_even_with_matching_ledger_hash(self):
        self.bytes.stop()
        repair.preceding_bytes.cache_clear()
        self.addCleanup(repair.preceding_bytes.cache_clear)
        self.assertIsNone(repair.preceding_bytes(self.c))
        repair.preceding_bytes.cache_clear()
        with patch.object(repair,'preceding_files',return_value={**self.before,self.c:b'preexisting resource'}),self.assertRaises(ValueError):
            repair.preceding_bytes(self.c)
        wrong_before={**self.preimages,self.c:b'preexisting resource'}
        with patch.object(repair,'preceding_bytes',side_effect=lambda path:wrong_before.get(path)):
            with self.assertRaises(ValueError):repair.predecessor_runtime(self.after)
        doc=copy.deepcopy(self.doc);doc['changes'][self.c]['operation']='modify';raw=json.dumps(doc).encode()
        with patch.object(repair,'LEDGER_SHA256',repair.sha(raw)),self.assertRaises(ValueError):repair.ledger(raw)

    def test_outside_paths_cannot_gain_source_admission(self):
        for path in ('../outside',self.root.parent/'outside'):
            with self.subTest(path=path),self.assertRaises(ValueError):repair.reference_bytes(path,b'anything')
            with self.subTest(path=path),self.assertRaises(ValueError):repair.reapply_bytes(path,b'anything')

    def test_unfinalized_layer_cannot_admit_runtime(self):
        with patch.object(repair,'LEDGER_SHA256',None),self.assertRaises(ValueError):repair.predecessor_runtime(self.after)

if __name__=='__main__':unittest.main()
