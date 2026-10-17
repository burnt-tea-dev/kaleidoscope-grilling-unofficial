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
MANIFEST_SHA256='69376a192431ab04d25ae03193ede570b5ead3b54aa05ba935456617a227e2b0'
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

OWNER_PROPERTY_BASE = '58f2fc72a286b1ddf210128017c36f14dad759a9'

@lru_cache(maxsize=1)
def owner_property_predecessor_files():
 data=subprocess.check_output(['git','archive',OWNER_PROPERTY_BASE,*PREFIXES],cwd=ROOT)
 with tarfile.open(fileobj=io.BytesIO(data))as archive:
  return MappingProxyType({m.name:archive.extractfile(m).read()for m in archive if m.isfile()})

@lru_cache(maxsize=1)
def owner_property_expected_files():
 from eating_owner_properties import document as guard_document
 files=dict(owner_property_predecessor_files())
 for name,data in list(files.items()):
  if name.startswith(PREFIXES[1]+'/attachables/')or name.startswith(PREFIXES[1]+'/animations/'):
   before=json.loads(data);after=guard_document(before)
   if after!=before:files[name]=(json.dumps(after,ensure_ascii=False,indent=2)+'\n').encode()
 for prefix in PREFIXES:
  name=prefix+'/manifest.json';value=json.loads(files[name]);value['header']['version']=[2,8,147]
  for module in value['modules']:module['version']=[2,8,147]
  for dependency in value.get('dependencies',[]):
   if dependency.get('uuid') in {'c68005c5-23ff-54e8-a3ff-da6349ad43c2','bbbd2d60-52e5-53a6-8b9a-c09b0f516389'}:dependency['version']=[2,8,147]
  files[name]=(json.dumps(value,ensure_ascii=False,indent=2)+'\n').encode()
 return MappingProxyType(files)

def validate_inventory(actual,document):
 # Also protect direct callers from dictionaries altered after manifest loading.
 expected=manifest()
 if document!=expected:raise ValueError('Forged runtime delta scope or fingerprints')
 version=json.loads(actual[PREFIXES[0]+'/manifest.json'])['header']['version']
 owner_property_changes=0
 seasoning_tp_changes=0
 pending_offhand_changes=0
 stable_host_changes=0
 skewer_content_changes=0
 guide_recipe_changes=0
 current_count=len(actual)
 if version==[2,8,152]:
  from guide_recipe_source import predecessor_runtime, RUNTIME_PATHS
  actual=predecessor_runtime(actual)
  guide_recipe_changes=len(RUNTIME_PATHS)
  version=[2,8,151]
 if version==[2,8,151]:
  from skewer_content_source import predecessor_runtime, RUNTIME_PATHS
  actual=predecessor_runtime(actual)
  skewer_content_changes=len(RUNTIME_PATHS)
  version=[2,8,150]
 if version==[2,8,150]:
  from stable_host_source import predecessor_runtime, RUNTIME_PATHS
  actual=predecessor_runtime(actual)
  stable_host_changes=len(RUNTIME_PATHS)
  version=[2,8,149]
 if version==[2,8,149]:
  from pending_offhand_source import predecessor_runtime, ledger as pending_ledger
  actual=predecessor_runtime(actual)
  pending_offhand_changes=len(pending_ledger()['changes'])
  version=[2,8,148]
 if version==[2,8,148]:
  from seasoning_tp_source import predecessor_runtime, ledger as seasoning_ledger
  actual=predecessor_runtime(actual)
  seasoning_tp_changes=len(seasoning_ledger()['changes'])
  version=[2,8,147]
 if version==[2,8,147]:
  guarded=owner_property_expected_files()
  if actual!=guarded:raise ValueError('G147 runtime differs from exact guarded G146 source plus identity')
  predecessor=owner_property_predecessor_files()
  owner_property_changes=sum(actual[p]!=predecessor[p] for p in actual)
  actual=predecessor
 baseline=frozen_runtime_files();changes=document['changes']
 if set(actual)!=set(baseline)|set(changes):raise ValueError('Undeclared runtime addition/deletion')
 changed={p for p in actual if p not in baseline or actual[p]!=baseline[p]}
 if changed!=set(changes):raise ValueError('Missing or undeclared runtime delta')
 for p,row in changes.items():
  path=Path(p)
  if path.is_absolute()or'..'in path.parts or row['owner'] not in {'plate_special_visuals','g144_performance','g146_identity','plate_use_arm_visibility'}:raise ValueError('Unowned runtime path')
  old=baseline.get(p)
  operation='add'if old is None else'modify'
  if row['operation']!=operation or row['before_sha256']!=(None if old is None else sha(old)):raise ValueError('Runtime predecessor mismatch: '+p)
  if sha(actual[p])!=row['after_sha256']:raise ValueError('Runtime reviewed postimage mismatch: '+p)
 result={'baseline_files':len(baseline),'current_files':current_count,'owned_changes':len(changes),'owner_property_layer_changes':owner_property_changes}
 if seasoning_tp_changes:result['seasoning_tp_layer_changes']=seasoning_tp_changes
 if pending_offhand_changes:result['pending_offhand_layer_changes']=pending_offhand_changes
 if stable_host_changes:result['stable_host_layer_changes']=stable_host_changes
 if skewer_content_changes:result['skewer_content_layer_changes']=skewer_content_changes
 if guide_recipe_changes:result['guide_recipe_layer_changes']=guide_recipe_changes
 return result

def validate_plate_source():
 # Fixed leaf commands, never commands/imports supplied by manifest content.
 sys.path.insert(0,str(ROOT/'development/gameplay_core'))
 from verification_session import run_checked_once
 commands=[
  [sys.executable,'-B','tools/test_plate_use_arm_visibility.py'],
  [sys.executable,'-B','tools/build_plate_display.py','--check'],
  [sys.executable,'-B','tools/build_plate_held.py','--check'],
  [sys.executable,'-B','development/gameplay_core/test_held_render_contracts.py','PlateSpecialContracts'],
  ['node','--test','development/gameplay_core/test_plate_recipe_visual.mjs','development/gameplay_core/test_plate_food_cache.mjs','development/gameplay_core/test_plate_transactions.mjs'],
 ]
 for command in commands:run_checked_once(command,cwd=ROOT)

def validate_merged_performance_and_identity():
 # Independent source semantics for the two additional exact owners.
 from public_source_witness import apply_performance_source, REVIEWED_PERFORMANCE_BASE
 from skewer_content_source import historical_bytes
 main=PREFIXES[0]+'/scripts/main.js';queue=PREFIXES[0]+'/scripts/timed_work_queue.js'
 assert historical_bytes(ROOT/main)==apply_performance_source(frozen_runtime_bytes(main).decode()).encode()
 reviewed_queue=subprocess.check_output(['git','show',REVIEWED_PERFORMANCE_BASE+':'+queue],cwd=ROOT)
 assert (ROOT/queue).read_bytes()==reviewed_queue
 for prefix in PREFIXES:
  path=prefix+'/manifest.json';before=json.loads(frozen_runtime_bytes(path));raw=historical_bytes(ROOT/path)
  if json.loads(raw)['header']['version']==[2,8,150]:
   from stable_host_source import reference_bytes
   raw=reference_bytes(path,raw)
  after=json.loads(raw)
  version=after['header']['version']
  assert version in ([2,8,146],[2,8,147],[2,8,148],[2,8,149]),'Unknown composed release identity'
  before['header']['version']=version
  for module in before['modules']:module['version']=version
  for dependency in before.get('dependencies',[]):
   if dependency.get('uuid') in {'c68005c5-23ff-54e8-a3ff-da6349ad43c2','bbbd2d60-52e5-53a6-8b9a-c09b0f516389'}:dependency['version']=version
  assert after==before,'G146 identity changes fields outside exact owned versions: '+path


def verify_current_inventory():
 """Byte ownership only; standalone historical proofs do not claim source acceptance."""
 return validate_inventory(runtime_files(),manifest())

def verify_current_runtime():
 result=verify_current_inventory()
 validate_plate_source()
 validate_merged_performance_and_identity()
 # Do not let an invoked validator mutate the candidate unnoticed.
 verify_current_inventory()
 return result
if __name__=='__main__':print(json.dumps(verify_current_runtime(),sort_keys=True))
