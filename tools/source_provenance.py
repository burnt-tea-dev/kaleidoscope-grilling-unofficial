"""Import selected checksum-pinned historical source objects without moving refs."""
from pathlib import Path
import hashlib,json,re,subprocess
ROOT=Path(__file__).resolve().parents[1]
def ensure_provenance(root=ROOT):
 root=Path(root).resolve();meta=json.loads((root/'tools/fixtures/g66-selected-source.json').read_text());raw=(root/'tools/fixtures/g66-selected-source.pack').read_bytes()
 assert type(meta['schema']) is int and meta['schema']==1 and meta['format']=='selected_git_source_objects_no_ref_updates'
 assert len(raw)==meta['pack_bytes'] and hashlib.sha256(raw).hexdigest()==meta['pack_sha256'],'Corrupt selected source pack'
 assert raw[:4]==b'PACK' and int.from_bytes(raw[8:12],'big')==meta['object_count'],'Wrong source object inventory'
 assert set(meta['commits'])==set(meta['selected_blobs']) and all(re.fullmatch(r'[0-9a-f]{40}',c) for c in meta['commits'])
 trees=meta.get('selected_trees',{})
 assert isinstance(trees,dict) and set(trees)<=set(meta['commits']),'Invalid selected tree commits'
 imported=subprocess.run(['git','-C',str(root),'index-pack','--stdin'],input=raw,check=True,capture_output=True)
 pack_id=imported.stdout.decode().strip().split()[-1];assert re.fullmatch(r'[0-9a-f]{40}',pack_id)
 idx=Path(subprocess.check_output(['git','-C',str(root),'rev-parse','--git-path','objects/pack/pack-'+pack_id+'.idx'],text=True).strip())
 if not idx.is_absolute():idx=root/idx
 inventory=subprocess.check_output(['git','-C',str(root),'verify-pack','-v',str(idx)],text=True)
 actual=set(re.findall(r'(?m)^([0-9a-f]{40}) ',inventory))
 assert len(meta['exact_object_ids'])==meta['object_count'] and actual==set(meta['exact_object_ids']),'Unexpected selected source objects'
 for commit,rows in meta['selected_blobs'].items():
  subprocess.run(['git','-C',str(root),'cat-file','-e',commit+'^{commit}'],check=True,capture_output=True)
  for path,expected in rows.items():
   sha=subprocess.check_output(['git','-C',str(root),'rev-parse',commit+':'+path],text=True).strip();raw=subprocess.check_output(['git','-C',str(root),'show',commit+':'+path]);assert sha==expected['git_blob_sha1'] and len(raw)==expected['bytes'] and hashlib.sha256(raw).hexdigest()==expected['sha256'],path
 for commit,rows in trees.items():
  assert isinstance(rows,dict) and rows,'Invalid selected tree paths'
  for path,expected in rows.items():
   assert isinstance(path,str) and path and not any(part in ('','.','..') for part in path.split('/')) and not re.search(r'[\x00-\x1f\\]',path),'Invalid selected tree path'
   assert isinstance(expected,str) and re.fullmatch(r'[0-9a-f]{40}',expected),'Invalid selected tree ID'
   # The containing original tree proves this exact subtree ID. Its descendants
   # are deliberately absent: frozen equality needs identities, not full packs.
   entry=subprocess.check_output(['git','-C',str(root),'ls-tree','-z',commit,'--',path])
   assert entry==('040000 tree '+expected+'\t'+path+'\0').encode(),'Selected tree identity mismatch: '+path
 return {'pack_sha256':meta['pack_sha256'],'objects':meta['object_count'],'commits':len(meta['commits']),'refs_changed':False}
if __name__=='__main__':print(json.dumps(ensure_provenance()))
