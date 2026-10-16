from pathlib import Path
import hashlib,json,shutil,subprocess,tempfile,unittest
from source_provenance import ensure_provenance,ROOT
class SelectedSourceProvenanceTests(unittest.TestCase):
 def fixture(self):
  t=tempfile.TemporaryDirectory();self.addCleanup(t.cleanup);r=Path(t.name);(r/'tools/fixtures').mkdir(parents=True);subprocess.run(['git','init','-q',str(r)],check=True)
  for name in ('g66-selected-source.pack','g66-selected-source.json'):shutil.copy2(ROOT/'tools/fixtures'/name,r/'tools/fixtures'/name)
  return r
 def test_selected_original_blobs_import_exactly_without_refs(self):
  r=self.fixture();result=ensure_provenance(r);self.assertEqual(result['commits'],2+3);self.assertEqual(result['objects'],93+31);self.assertFalse(result['refs_changed']);self.assertEqual(subprocess.run(['git','-C',str(r),'show-ref'],capture_output=True).stdout,b'');self.assertEqual(ensure_provenance(r),result)
 def test_changed_pack_rejected_before_import(self):
  r=self.fixture();p=r/'tools/fixtures/g66-selected-source.pack';p.write_bytes(p.read_bytes()+b'X')
  with self.assertRaisesRegex(AssertionError,'Corrupt'):ensure_provenance(r)
 def test_wrong_object_inventory_rejected(self):
  r=self.fixture();p=r/'tools/fixtures/g66-selected-source.json';x=json.loads(p.read_text());x['object_count']+=1;p.write_text(json.dumps(x))
  with self.assertRaisesRegex(AssertionError,'Wrong source object inventory'):ensure_provenance(r)
 def test_wrong_selected_blob_hash_rejected(self):
  r=self.fixture();p=r/'tools/fixtures/g66-selected-source.json';x=json.loads(p.read_text());row=next(iter(next(iter(x['selected_blobs'].values())).values()));row['sha256']='0'*64;p.write_text(json.dumps(x))
  with self.assertRaises(AssertionError):ensure_provenance(r)
 def test_exact_object_set_rejected_if_metadata_would_hide_an_object(self):
  r=self.fixture();p=r/'tools/fixtures/g66-selected-source.json';x=json.loads(p.read_text());x['exact_object_ids'][0]='0'*40;p.write_text(json.dumps(x))
  with self.assertRaisesRegex(AssertionError,'Unexpected selected source objects'):ensure_provenance(r)
 def test_selected_tree_ids_resolve_without_full_runtime_or_parent_history(self):
  r=self.fixture();ensure_provenance(r);meta=json.loads((r/'tools/fixtures/g66-selected-source.json').read_text())
  commit='3bcb1639fad515f12e119c83b915d452a655a4ed'
  expected={'projects/grilling/gameplay_core/behavior_pack':'814457eb0b9a4b7f952eb0b8569e6f25ba753f61','projects/grilling/gameplay_core/resource_pack':'4b3173bf961ef19ba01c470f51fcf42307ab1947'}
  self.assertEqual(meta['selected_trees'],{commit:expected});self.assertEqual(meta['selected_blobs'][commit],{})
  for path,sha in expected.items():
   self.assertEqual(subprocess.check_output(['git','-C',str(r),'rev-parse',commit+':'+path],text=True).strip(),sha)
   self.assertNotEqual(subprocess.run(['git','-C',str(r),'cat-file','-e',sha],capture_output=True).returncode,0)
  # Guide/effect comparisons require only the eight selected runtime blobs.
  for ref,count in [('a092a9971ada91f16a973b01db4a3c9488f7ec1c',5),('b38e6be99e4d1aba474ce857f3db64aa4f2b7086',3)]:
   self.assertEqual(len(meta['selected_blobs'][ref]),count)
   self.assertNotEqual(subprocess.run(['git','-C',str(r),'show',ref+':baseline.json'],capture_output=True).returncode,0)
  for parent in ('b66f9655ccdedbb78f0fa306973501299f3578a7','fd47371e553219852689dd1323b96f3d659e5dd8','c7c0bfb047af06a5d1c42d6e31c873dc9ca6992f'):
   self.assertNotEqual(subprocess.run(['git','-C',str(r),'cat-file','-e',parent+'^{commit}'],capture_output=True).returncode,0)
 def test_forged_selected_tree_id_rejected(self):
  r=self.fixture();p=r/'tools/fixtures/g66-selected-source.json';x=json.loads(p.read_text());rows=next(iter(x['selected_trees'].values()));rows[next(iter(rows))]='0'*40;p.write_text(json.dumps(x))
  with self.assertRaisesRegex(AssertionError,'Selected tree identity mismatch'):ensure_provenance(r)
 def test_blob_cannot_be_misdeclared_as_selected_tree(self):
  r=self.fixture();p=r/'tools/fixtures/g66-selected-source.json';x=json.loads(p.read_text());commit='b38e6be99e4d1aba474ce857f3db64aa4f2b7086';path='projects/grilling/gameplay_core/behavior_pack/scripts/main.js';x['selected_trees'][commit]={path:x['selected_blobs'][commit][path]['git_blob_sha1']};p.write_text(json.dumps(x))
  with self.assertRaisesRegex(AssertionError,'Selected tree identity mismatch'):ensure_provenance(r)
 def test_missing_selected_blob_rejected_even_with_matching_pack_inventory(self):
  r=self.fixture();p=r/'tools/fixtures/g66-selected-source.json';x=json.loads(p.read_text());commit='b38e6be99e4d1aba474ce857f3db64aa4f2b7086';path='projects/grilling/gameplay_core/behavior_pack/scripts/main.js';missing=x['selected_blobs'][commit][path]['git_blob_sha1'];x['exact_object_ids'].remove(missing)
  raw=subprocess.check_output(['git','-C',str(ROOT),'pack-objects','--stdout','--window=0'],input=('\n'.join(x['exact_object_ids'])+'\n').encode())
  x.update(pack_bytes=len(raw),pack_sha256=hashlib.sha256(raw).hexdigest(),object_count=len(x['exact_object_ids']));p.with_suffix('.pack').write_bytes(raw);p.write_text(json.dumps(x))
  with self.assertRaises(subprocess.CalledProcessError):ensure_provenance(r)
  self.assertEqual(subprocess.run(['git','-C',str(r),'show-ref'],capture_output=True).stdout,b'')
if __name__=='__main__':unittest.main()
