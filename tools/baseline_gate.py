#!/usr/bin/env python3
"""Fail closed on a changed runtime, reused release identity or uncommitted build.

freeze is an explicit maintainer operation; packaging and CI only run check.
The receipt inventories every exported file and never certifies client behaviour.
"""
from pathlib import Path
import argparse,hashlib,json,subprocess,sys,zipfile,os,datetime,re,time
ROOT=Path(__file__).resolve().parents[1]

def fail(message):raise SystemExit('BASELINE: '+message)
def read(path):return json.loads(path.read_text(encoding='utf-8-sig'))
def fingerprint(root):
 rows={}
 for p in sorted(root.rglob('*')):
  if p.is_symlink():fail('symlink in runtime: '+str(p))
  if p.is_file():rows[p.relative_to(root).as_posix()]=hashlib.sha256(p.read_bytes()).hexdigest()
 digest=hashlib.sha256(json.dumps(rows,sort_keys=True,separators=(',',':')).encode()).hexdigest()
 return {'sha256':digest,'files':len(rows)},rows

def validate(config):
 if not isinstance(config.get('version'),list) or len(config['version'])!=3 or any(type(x) is not int or x<0 for x in config['version']):fail('invalid release version')
 for name in ['README.md','README.zh-TW.md']:
  path=ROOT/name
  if path.exists():
   for line in path.read_text(encoding='utf-8').splitlines():
    for prefix in ['## Current maintained baseline: ','## 當前維護基線：']:
     if line.startswith(prefix) and line[len(prefix):]!='.'.join(map(str,config['version'])):fail(name+' maintained version differs from release version')
 # Authoring metadata must match the post-bump identity before freeze creates
 # its immutable claim. Minimal non-authoring fixture repos have no config.
 if (ROOT/'config.json').exists():
  from bridge_project import check_export_version
  try:check_export_version(ROOT,config['version'])
  except (AssertionError,KeyError,IndexError,TypeError,ValueError,OSError) as error:fail(str(error))
 manifests={};trees={};files={}
 for side,relative in config['runtime'].items():
  root=ROOT/relative;manifests[side]=m=read(root/'manifest.json')
  if m['header']['uuid']!=config['packs'][side]['uuid']:fail(side+' UUID changed')
  version=m['header']['version']
  if version!=config['version']:fail(side+' version differs from release version')
  if not all(x['version']==version for x in m['modules']):fail(side+' module versions differ')
  expected=config['packs'][side]['dependencies']
  if m.get('dependencies',[])!=expected:fail(side+' dependencies differ from reviewed lock')
  trees[side],files[side]=fingerprint(root)
 if len(set(p['uuid'] for p in config['packs'].values()))!=len(config['packs']):fail('duplicate own pack UUID')
 for side,m in manifests.items():
  for dep in m.get('dependencies',[]):
   for other in manifests.values():
    if dep.get('uuid')==other['header']['uuid'] and dep['version']!=other['header']['version']:fail('own BP/RP pair mismatch')
 return trees,files

def verify_export(config,archive,files):
 with zipfile.ZipFile(archive) as z:
  if len(z.namelist())!=len(set(z.namelist())):fail('duplicate archive entries')
  actual={n:hashlib.sha256(z.read(n)).hexdigest() for n in z.namelist() if not n.endswith('/')}
  expected={side+'/'+p:h for side,rows in files.items() for p,h in rows.items()}
  # Both established layouts are supported; both are exact, with no extra files.
  grilling={('behavior_pack' if k.startswith('BP/') else 'resource_pack')+'/'+k.split('/',1)[1]:v for k,v in expected.items()}
  if actual!=expected and actual!=grilling:fail('archive differs from canonical runtime (missing, extra or patched file)')

def validate_repository(config):
 # A transfer changes the authenticated source name, never the runtime identity.
 target_path=ROOT/'.repo-target.json'
 if target_path.is_symlink() or not target_path.is_file():fail('reviewed repository target missing')
 target=read(target_path);owner=target.get('owner',{})
 if (target.get('repository_id')!=config.get('repository_id') or type(target.get('repository_id')) is not int
     or target.get('logical_runtime_repository')!=config.get('repository')
     or target.get('private') is not False or not isinstance(owner,dict)
     or owner.get('type')!='Organization' or type(owner.get('id')) is not int or owner['id']<=0
     or not isinstance(owner.get('login'),str) or not owner['login']
     or target.get('repository')!=owner['login']+'/'+config['repository'].split('/')[-1]):fail('reviewed repository target mismatch')
 if config.get('repository')=='casama233/kaleidoscope-grilling-unofficial':
  if (config.get('repository_id')!=1377218440 or type(config.get('repository_id')) is not int
      or target.get('repository')!='burnt-tea-dev/kaleidoscope-grilling-unofficial'
      or target.get('repository_id')!=1377218440
      or owner!={'login':'burnt-tea-dev','id':344456559,'type':'Organization'}
      or target.get('private') is not False):fail('canonical repository target mismatch')
 ci=any(os.getenv(key) for key in ['GITHUB_ACTIONS','GITHUB_REPOSITORY','GITHUB_REPOSITORY_ID'])
 if not ci:return
 if os.getenv('GITHUB_REPOSITORY')!=target['repository']:fail('wrong repository')
 if os.getenv('GITHUB_REPOSITORY_ID')!=str(target['repository_id']):fail('wrong repository ID')
 if (os.getenv('GITHUB_REPOSITORY_OWNER')!=owner['login']
     or os.getenv('GITHUB_REPOSITORY_OWNER_ID')!=str(owner['id'])):fail('wrong repository owner')
 try:event=read(Path(os.environ['GITHUB_EVENT_PATH']));actual=event['repository']
 except (KeyError,OSError,ValueError,TypeError):fail('repository event identity missing')
 if not isinstance(actual,dict):fail('repository event identity missing')
 actual_owner=actual.get('owner',{})
 expected_name,expected_id,expected_private=target['repository'],target['repository_id'],False
 if os.getenv('SENLUO_SOURCE_GATE')=='1' and actual.get('full_name')!=expected_name:
  # A reviewed family parent may check a pinned public peer in a subprocess.
  # Both the child target and actual parent stay bound to fixed numeric IDs.
  parents={'burnt-tea-dev/kaleidoscope-tavern-unofficial':(1377171148,False),
           'burnt-tea-dev/kaleidoscope-grilling-unofficial':(1377218440,False),
           'burnt-tea-dev/kaleidoscope-world-liquor-unofficial':(1385218112,False),
           'burnt-tea-dev/senluo-family-integration-private':(1406868911,True)}
  if (parents.get(expected_name)!=(expected_id,False) or owner!={'login':'burnt-tea-dev','id':344456559,'type':'Organization'}
      or actual.get('full_name') not in parents):fail('unreviewed cross-repository source gate')
  expected_name=actual['full_name'];expected_id,expected_private=parents[expected_name]
 if (actual.get('full_name')!=expected_name or type(actual.get('id')) is not int
     or actual['id']!=expected_id or actual.get('private') is not expected_private
     or not isinstance(actual_owner,dict)
     or any(actual_owner.get(key)!=owner[key] for key in ['login','id','type'])
     or type(actual_owner.get('id')) is not int):fail('repository event identity mismatch')

def check(config,release=False,archive=None,history_base=None):
 validate_repository(config)
 trees,files=validate(config)
 if trees!=config['source_trees']:fail('runtime changed without a reviewed version/hash update')
 history=read(ROOT/'release-history.json')
 if history_base and set(history_base)!={'0'}:
  valid=subprocess.run(['git','rev-parse','--verify',history_base+'^{commit}'],cwd=ROOT,capture_output=True)
  if valid.returncode:fail('history base is not a commit')
  previous=subprocess.run(['git','show',history_base+':release-history.json'],cwd=ROOT,capture_output=True,text=True)
  if previous.returncode==0:
   for key,value in json.loads(previous.stdout).items():
    if history.get(key)!=value:fail('historical release changed or removed: '+key)
 version='.'.join(map(str,config['version']))
 if history.get(version)!=trees:fail('release identity differs from append-only release history')
 tracked=set(subprocess.check_output(['git','ls-files','-z'],cwd=ROOT).decode().split('\0'))
 for side,rows in files.items():
  for p in rows:
   if config['runtime'][side]+'/'+p not in tracked:fail('untracked runtime file: '+p)
 if release:
  status=subprocess.check_output(['git','status','--porcelain','--untracked-files=no'],cwd=ROOT,text=True)
  if status.strip():fail('commit reviewed changes before release packaging')
 if archive:verify_export(config,archive,files)
 return trees,files

# Version reservations belong to this gate, not a separate source-witness layer.
# They coordinate local worktrees and never certify a PR, publication or client.
class ReleaseClaimError(RuntimeError):
    """A conflicting or unverifiable identity must remain available for review."""


def _git(root, *args):
    result = subprocess.run(['git', '-C', str(root), *args], capture_output=True, text=True)
    if result.returncode:
        raise ReleaseClaimError('cannot inspect Git release history: ' + result.stderr.strip())
    return result.stdout.strip()


def _unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ReleaseClaimError('duplicate key in release record: ' + key)
        result[key] = value
    return result


def _json(text, origin):
    try:
        value = json.loads(text, object_pairs_hook=_unique_object)
    except (ValueError, UnicodeError) as error:
        raise ReleaseClaimError('invalid release record at ' + origin) from error
    if not isinstance(value, dict):
        raise ReleaseClaimError('release record must be an object: ' + origin)
    return value


def _identity(version, trees):
    if not isinstance(version, (list, tuple)) or len(version) != 3 or any(type(n) is not int or n < 0 for n in version):
        raise ReleaseClaimError('release version must contain three nonnegative integers')
    if not isinstance(trees, dict) or not trees:
        raise ReleaseClaimError('source_trees must contain exported runtime fingerprints')
    for side, row in trees.items():
        if not isinstance(side, str) or not side or not isinstance(row, dict) or set(row) != {'sha256', 'files'}:
            raise ReleaseClaimError('invalid source_trees fingerprint')
        if not isinstance(row['sha256'], str) or not re.fullmatch('[0-9a-f]{64}', row['sha256']) or type(row['files']) is not int or row['files'] < 0:
            raise ReleaseClaimError('invalid source_trees hash or file count')
    return '.'.join(map(str, version))


def _check_histories(root, version, trees, head):
    # Snapshot refs to immutable commits so ref updates cannot change the file
    # between ls-tree and cat-file. Duplicate history blobs need only one read.
    refs = [('HEAD', head)]
    for line in _git(root, 'for-each-ref', '--format=%(refname)%09%(objectname)', 'refs/heads', 'refs/remotes').splitlines():
        refs.append(tuple(line.split('\t', 1)))
    seen_commits, seen_blobs = set(), set()
    for ref, commit in refs:
        if commit in seen_commits:
            continue
        seen_commits.add(commit)
        entry = _git(root, 'ls-tree', '--format=%(objectmode)\t%(objecttype)\t%(objectname)', commit, '--', 'release-history.json')
        if not entry:
            continue  # Older branches may predate the baseline gate.
        mode, kind, blob = entry.split('\t')
        if kind != 'blob' or mode not in ['100644', '100755']:
            raise ReleaseClaimError('release-history.json is not a regular file at ' + ref)
        if blob in seen_blobs:
            continue
        seen_blobs.add(blob)
        history = _json(_git(root, 'cat-file', 'blob', blob), ref + ':release-history.json')
        if version in history and history[version] != trees:
            raise ReleaseClaimError('version ' + version + ' already has different content in ' + ref + ' (' + commit + '); bump the version and preserve the conflicting history')


def _existing_claim(path):
    if path.is_symlink() or not path.is_file():
        raise ReleaseClaimError('release claim is not a regular file: ' + str(path))
    # A simultaneous O_EXCL winner may still be flushing its small JSON file.
    # Wait briefly for valid JSON, but never repair or remove an incomplete claim.
    for attempt in range(51):
        try:
            return _json(path.read_text(encoding='utf-8'), str(path))
        except (ReleaseClaimError, OSError, UnicodeError) as error:
            if attempt == 50:
                raise ReleaseClaimError('incomplete or invalid release claim; preserve it for review: ' + str(path)) from error
            time.sleep(.01)


def claim_release(root, version, source_trees, repository):
    """Create an immutable claim, or reuse identical trees without rewriting it.

    ``commit`` identifies HEAD at the time of the claim. Runtime changes being
    frozen may still be uncommitted; the actual claimed content is source_trees.
    Conflicting refs are checked even on reuse, including refs fetched later.
    """
    root = Path(root).resolve()
    version_text = _identity(version, source_trees)
    if not isinstance(repository, str) or not repository:
        raise ReleaseClaimError('repository identity is required')
    head = _git(root, 'rev-parse', '--verify', 'HEAD^{commit}')
    _check_histories(root, version_text, source_trees, head)
    common = Path(_git(root, 'rev-parse', '--git-common-dir'))
    if not common.is_absolute():
        common = root / common
    directory = common.resolve() / 'release-claims' / 'v1'
    if directory.is_symlink() or directory.parent.is_symlink():
        raise ReleaseClaimError('release claim directory must not be a symlink')
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / (version_text + '.json')
    record = {
        'schema': 1, 'repository': repository, 'version': version_text,
        'source_trees': source_trees, 'branch': _git(root, 'rev-parse', '--abbrev-ref', 'HEAD'),
        'commit': head, 'commit_role': 'HEAD_at_claim_time_runtime_may_be_uncommitted',
        'recorded_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }
    try:
        descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o644)
    except FileExistsError:
        previous = _existing_claim(path)
        identity = ['schema', 'repository', 'version', 'source_trees']
        if any(previous.get(key) != record[key] for key in identity):
            raise ReleaseClaimError('version ' + version_text + ' is already claimed for different content; bump the version and preserve ' + str(path))
        return path
    # Never unlink on failure: an interrupted write reserves the identity until
    # explicit review. A later freeze must not silently take that identity over.
    with os.fdopen(descriptor, 'w', encoding='utf-8') as output:
        output.write(json.dumps(record, ensure_ascii=False, sort_keys=True, indent=2) + '\n')
        output.flush()
        os.fsync(output.fileno())
    return path


def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('operation',choices=['check','freeze']);parser.add_argument('--release',action='store_true');parser.add_argument('--history-base');parser.add_argument('--archive',type=Path);parser.add_argument('--receipt',type=Path);args=parser.parse_args()
 config=read(ROOT/'baseline.json')
 if args.operation=='freeze':
  validate_repository(config)
  trees,_=validate(config);history_path=ROOT/'release-history.json';history=read(history_path) if history_path.exists() else {};version='.'.join(map(str,config['version']))
  if version in history and history[version]!=trees:fail('version already used; bump the release version')
  if version not in history and history and tuple(config['version'])<=max(tuple(map(int,v.split('.'))) for v in history):fail('release version must advance')
  try:claim_release(ROOT,config['version'],trees,config['repository'])
  except ReleaseClaimError as error:fail(str(error))
  history[version]=trees;config['source_trees']=trees
  history_path.write_text(json.dumps(history,indent=2)+'\n');(ROOT/'baseline.json').write_text(json.dumps(config,indent=2)+'\n')
  print('Frozen '+version);return
 trees,files=check(config,args.release,args.archive,args.history_base)
 if args.receipt:
  payload={'schema':1,'repository':config['repository'],'source_commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'version':config['version'],'source_trees':trees,'files':files,'archive_sha256':hashlib.sha256(args.archive.read_bytes()).hexdigest() if args.archive else None,'acceptance':{'static':True,'bds':False,'client':False}}
  args.receipt.parent.mkdir(parents=True,exist_ok=True);args.receipt.write_text(json.dumps(payload,indent=2)+'\n')
 print('Canonical baseline verified: '+'.'.join(map(str,config['version'])))
if __name__=='__main__':main()
