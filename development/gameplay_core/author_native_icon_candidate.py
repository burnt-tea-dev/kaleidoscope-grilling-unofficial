"""One-shot maintainer authoring, not a packager or an installer.

Generate already-reviewed canonical sources, claim a fresh version using the
existing release guard, and commit to a NEW review branch only. No merge,
release, main update or deployment is performed. Retire with its one-shot
workflow after normal canonical verification owns the resulting candidate.
"""
from pathlib import Path
import json
import os
import subprocess
import sys
from native_skewer_icons import check_or_write

ROOT = Path(__file__).resolve().parents[2]
REPO = 'casama233/kaleidoscope-grilling-unofficial'
BASE = '23031fc67ac96542d47d4a99295427e3a69af5c5'
OUTPUT_BRANCH = 'work/native-skewer-icons-g144-20261015'
OLD = [2, 8, 143]
NEW = [2, 8, 144]
PROJECT = ROOT/'projects/grilling/gameplay_core'

def run(*args):
    return subprocess.check_output(args, cwd=ROOT, text=True).strip()

def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))

def write(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')

def main():
    target = read(ROOT/'.repo-target.json')
    assert target['repository'] == REPO and target['repository_id'] == 1377218440
    assert os.environ.get('GITHUB_REPOSITORY') == REPO
    assert os.environ.get('GITHUB_REPOSITORY_ID') == '1377218440'
    assert os.environ.get('GITHUB_ACTOR') == 'casama233'
    assert run('git','remote','get-url','origin').removesuffix('.git') == 'https://github.com/'+REPO
    assert run('git','rev-parse','origin/main') == BASE, 'main advanced; reconcile instead of overwriting'
    assert not run('git','status','--porcelain'), 'authoring requires a clean exact input'
    existing = subprocess.run(['git','ls-remote','--exit-code','--heads','origin',OUTPUT_BRANCH],
                              cwd=ROOT, text=True, capture_output=True)
    assert existing.returncode == 2 and not existing.stdout.strip(), 'output branch exists or lookup failed'
    config = read(ROOT/'baseline.json')
    assert config['version'] == OLD
    history = read(ROOT/'release-history.json')
    assert '.'.join(map(str,NEW)) not in history, 'version already claimed'
    authored_from = run('git','rev-parse','HEAD')
    # Exact Java pixels and every supported existing food alias are validated.
    check_or_write(ROOT, write=True)
    run(sys.executable,'-B','development/gameplay_core/test_native_skewer_icons.py')
    run(sys.executable,'-B','development/gameplay_core/test_visible_block_shapes.py')
    for side, relative in config['runtime'].items():
        path = ROOT/relative/'manifest.json'; manifest = read(path)
        assert manifest['header']['version'] == OLD
        manifest['header']['version'] = NEW[:]
        for module in manifest['modules']:
            assert module['version'] == OLD; module['version'] = NEW[:]
        for dependency in manifest.get('dependencies',[]):
            if dependency.get('uuid') in {p['uuid'] for p in config['packs'].values()}:
                assert dependency['version'] == OLD; dependency['version'] = NEW[:]
        config['packs'][side]['dependencies'] = manifest.get('dependencies',[])
        write(path, manifest)
    config['version'] = NEW[:]; write(ROOT/'baseline.json', config)
    old = '.'.join(map(str,OLD)); new = '.'.join(map(str,NEW))
    for path in (ROOT/'README.md', ROOT/'README.zh-TW.md'):
        if not path.exists(): continue
        content = path.read_text(encoding='utf-8')
        for prefix in ('## Current maintained baseline: ', '## 當前維護基線：'):
            content = content.replace(prefix+old, prefix+new)
        path.write_text(content, encoding='utf-8')
    for path in (ROOT/'config.json', PROJECT/'config.json'):
        if path.exists():
            content = path.read_text(encoding='utf-8').replace(old,new).replace(old.replace('.','_'),new.replace('.','_'))
            path.write_text(content, encoding='utf-8')
    path = ROOT/'development/gameplay_core/verify_current.py'
    content = path.read_text(encoding='utf-8')
    anchor = '    (2, 8, 143): "verify_a28143.py",'
    assert content.count(anchor) == 1 and '(2, 8, 144):' not in content
    path.write_text(content.replace(anchor, anchor+'\n    (2, 8, 144): "verify_a28144.py",'), encoding='utf-8')
    verifier = ROOT/'development/gameplay_core/verify_a28144.py'
    assert not verifier.exists()
    verifier.write_text('''"""G144 retains the complete G143 suite and adds native GUI / shape checks."""
from pathlib import Path
import os
import subprocess
import sys
from verify_a28143 import main as previous
from verification_session import SESSION_ENV, current_source_validation_session
ROOT = Path(__file__).resolve().parents[2]
def main(expected_version=(2, 8, 144)):
    previous(expected_version=expected_version)
    for script in ('test_native_skewer_icons.py', 'test_visible_block_shapes.py'):
        subprocess.run([sys.executable, '-B', 'development/gameplay_core/'+script], cwd=ROOT, check=True)
    print('G144 native GUI source and Java shapes PASS; native client acceptance remains pending')
if __name__ == '__main__':
    if os.environ.pop(SESSION_ENV, None) == Path(__file__).name:
        with current_source_validation_session(): main()
    else: main()
''', encoding='utf-8')
    # Stage only the reviewed source and release metadata; never add runner files.
    run('git','add','projects/grilling/gameplay_core/behavior_pack',
        'projects/grilling/gameplay_core/resource_pack','development/gameplay_core/verify_current.py',
        'development/gameplay_core/verify_a28144.py','baseline.json')
    for relative in ('README.md','README.zh-TW.md','config.json','projects/grilling/gameplay_core/config.json'):
        if (ROOT/relative).exists(): run('git','add',relative)
    # Existing freeze checks shared worktrees and known remote histories. A
    # collision aborts; no historical hash is rewritten and no guard is relaxed.
    run(sys.executable,'-B','tools/baseline_gate.py','freeze')
    run('git','add','baseline.json','release-history.json')
    run('git','commit','-m','G144: native animated GUI sprites and Java-visible grill/rack shapes')
    run(sys.executable,'-B','tools/baseline_gate.py','check','--release','--history-base',BASE)
    assert not run('git','status','--porcelain')
    run('git','push','origin','HEAD:refs/heads/'+OUTPUT_BRANCH)
    receipt = {'repository':REPO,'base':BASE,'authored_from':authored_from,
               'commit':run('git','rev-parse','HEAD'),'branch':OUTPUT_BRANCH,'version':NEW,
               'source_trees':read(ROOT/'baseline.json')['source_trees'],
               'acceptance':{'targeted_source':True,'complete_ci':False,'bds':False,'client':False}}
    out = Path(os.environ['RUNNER_TEMP'])/'native-icon-authored'; out.mkdir(exist_ok=True)
    write(out/'authoring-receipt.json',receipt)
    run('git','archive','--format=zip','--output='+str(out/'review-source.zip'),'HEAD')
    print(json.dumps(receipt,indent=2))

if __name__ == '__main__': main()
