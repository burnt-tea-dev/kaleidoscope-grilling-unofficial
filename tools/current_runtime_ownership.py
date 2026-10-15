"""One reviewed current-runtime boundary, separate from frozen historical proofs."""
from functools import lru_cache
from pathlib import Path
from types import MappingProxyType
import hashlib,io,json,subprocess,sys,tarfile
ROOT=Path(__file__).resolve().parents[1]
BASE='c7c0bfb047af06a5d1c42d6e31c873dc9ca6992f'
PREFIXES=('projects/grilling/gameplay_core/behavior_pack','projects/grilling/gameplay_core/resource_pack')
MANIFEST=ROOT/'tools/fixtures/current-runtime-ownership.json'
# Reviewed scope/postimages are code-owned, not authority supplied by a manifest.
MANIFEST_SHA256='5bad0bb91a3dfec6aec499485de9ca88b4b38b093942ebe466d4fc95a8402595'
def sha(data):return hashlib.sha256(data).hexdigest()
@lru_cache(maxsize=1)
def frozen_runtime_files():
 data=subprocess.check_output(['git','archive',BASE,*PREFIXES],cwd=ROOT)
 with tarfile.open(fileobj=io.BytesIO(data))as archive:
  return MappingProxyType({m.name:archive.extractfile(m).read()for m in archive if m.isfile()})
def frozen_runtime_bytes(path):
 p=Path(path);key=p.relative_to(ROOT).as_posix()if p.is_absolute()else p.as_posix()
 return frozen_runtime_files()[key]
def manifest(data=None):
 data=MANIFEST.read_bytes()if data is None else data
 if sha(data)!=MANIFEST_SHA256:raise ValueError('Unreviewed runtime ownership manifest')
 doc=json.loads(data)
 if doc['schema']!=1 or doc['baseline_commit']!=BASE:raise ValueError('Wrong runtime baseline')
 return doc

def runtime_files(root=ROOT):
 files={}
 for prefix in PREFIXES:
  if (root/prefix).is_symlink():raise ValueError('Runtime pack root must not be a symlink')
  for p in (root/prefix).rglob('*'):
   if p.is_symlink():raise ValueError('Runtime symlink outside byte ownership: '+str(p))
   if p.is_file():files[p.relative_to(root).as_posix()]=p.read_bytes()
 return files

def validate_inventory(actual,document):
 # Also protect direct callers from dictionaries altered after manifest loading.
 expected=manifest()
 if document!=expected:raise ValueError('Forged runtime delta scope or fingerprints')
 baseline=frozen_runtime_files();changes=document['changes']
 if set(actual)!=set(baseline)|set(changes):raise ValueError('Undeclared runtime addition/deletion')
 changed={p for p in actual if p not in baseline or actual[p]!=baseline[p]}
 if changed!=set(changes):raise ValueError('Missing or undeclared runtime delta')
 for p,row in changes.items():
  path=Path(p)
  if path.is_absolute()or'..'in path.parts or row['owner']!='plate_special_visuals':raise ValueError('Unowned runtime path')
  old=baseline.get(p)
  operation='add'if old is None else'modify'
  if row['operation']!=operation or row['before_sha256']!=(None if old is None else sha(old)):raise ValueError('Runtime predecessor mismatch: '+p)
  if sha(actual[p])!=row['after_sha256']:raise ValueError('Runtime reviewed postimage mismatch: '+p)
 return {'baseline_files':len(baseline),'current_files':len(actual),'owned_changes':len(changes)}

def validate_plate_source():
 # Fixed leaf commands, never commands/imports supplied by manifest content.
 sys.path.insert(0,str(ROOT/'development/gameplay_core'))
 from verification_session import run_checked_once
 commands=[
  [sys.executable,'-B','tools/build_plate_display.py','--check'],
  [sys.executable,'-B','tools/build_plate_held.py','--check'],
  [sys.executable,'-B','development/gameplay_core/test_held_render_contracts.py','PlateSpecialContracts'],
  ['node','--test','development/gameplay_core/test_plate_recipe_visual.mjs','development/gameplay_core/test_plate_food_cache.mjs','development/gameplay_core/test_plate_transactions.mjs'],
 ]
 for command in commands:run_checked_once(command,cwd=ROOT)

def verify_current_runtime():
 result=validate_inventory(runtime_files(),manifest())
 validate_plate_source()
 # Do not let an invoked validator mutate the candidate unnoticed.
 validate_inventory(runtime_files(),manifest())
 return result
if __name__=='__main__':print(json.dumps(verify_current_runtime(),sort_keys=True))
