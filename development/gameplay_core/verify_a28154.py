"""G154 author162 adaptation; current semantics and exact historical153 proofs."""
from pathlib import Path
import io
import json
import os
import shutil
import subprocess
import sys
import tarfile
import tempfile

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools'))

from verify_a28152 import main as previous
from verification_session import run_checked_once


def historical153_checks():
    """A temporary exact Git projection, with no ref/worktree or runtime edits.

    Unchanged current runtime bytes are linked only after whole-inventory
    admission. All changed and non-runtime inputs come from exact G153 Git.
    The four source-only historical tests have no native acceptance scope.
    """
    import g154_host_source as host
    import current_runtime_ownership as owner
    current = owner.runtime_files()
    before = host.predecessor_runtime(current)
    inputs = ['tools', 'development', 'projects/grilling/guide', 'config.json',
              'projects/grilling/gameplay_core/config.json', 'baseline.json', 'release-history.json',
              'docs/RELEASE-NOTES-A2.8.151.md', 'docs/RELEASE-NOTES-A2.8.152.md',
              'projects/grilling/resource_pack/models/entity/kg_a1/caterpillar_cooked_piece_1.geo.json',
              'projects/grilling/resource_pack/textures/kg_a1/caterpillar_cooked_piece_1.png']
    # Add only the original snapshot's explicitly pinned Java/asset inputs.
    # Source contracts enumerate these paths; no author tree is copied.
    extra = set()
    for name in ['ordinary-relative-calibration.json', 'raw-one-route-contract.json', 'review-three-route-contract.json']:
        path = 'development/gameplay_core/fixtures/' + name
        doc = json.loads(subprocess.check_output(['git', 'show', host.PREVIOUS + ':' + path], cwd=ROOT))
        extra.update(doc.get('source_pins', {}))
        extra.update(doc.get('source_files', {}))
        for row in doc.get('routes', []):
            extra.update(row.get('helper_source_assets_sha256', {}))
            if 'helper_model' in row:
                namespace, model = row['helper_model'].split(':', 1)
                extra.add('projects/grilling/source_snapshots/common/src/main/resources/assets/' + namespace + '/models/' + model + '.json')
    inputs.extend(sorted(path for path in extra if not path.startswith(('development/', host.BP + '/', host.RP + '/'))))
    raw = subprocess.check_output(['git', 'archive', host.PREVIOUS, *inputs], cwd=ROOT)
    git_dir = subprocess.check_output(['git', 'rev-parse', '--absolute-git-dir'], cwd=ROOT, text=True).strip()
    real_git = shutil.which('git')
    with tempfile.TemporaryDirectory(prefix='.grilling-g153-source-', dir=ROOT.parent) as scratch:
        snapshot = Path(scratch)
        with tarfile.open(fileobj=io.BytesIO(raw)) as archive:
            archive.extractall(snapshot, filter='data')
        for relative, contents in before.items():
            target = snapshot / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            if current[relative] != contents:
                target.write_bytes(contents)
            else:
                # Complete byte equality was checked before any link exists.
                os.link(ROOT / relative, target)
        commands = ['test_g153_repair_source.py', 'test_g153_composition.py',
                    'test_g153_repair_compiler.py', 'test_g153_scoped_builder_boundaries.py']
        binary = snapshot / '.readonly-bin'
        binary.mkdir()
        wrapper = binary / 'git'
        wrapper.write_text('#!' + sys.executable + '\nimport os,sys\n'
                           'if len(sys.argv)<2 or sys.argv[1] not in '+repr(['show', 'archive', 'rev-parse', 'diff', 'ls-tree'])+': raise SystemExit(126)\n'
                           'os.execv('+repr(real_git)+',['+repr(real_git)+',*sys.argv[1:]])\n')
        wrapper.chmod(0o700)
        env = {**os.environ, 'GIT_DIR': git_dir, 'GIT_WORK_TREE': str(snapshot),
               'GIT_OPTIONAL_LOCKS': '0', 'PATH': str(binary) + os.pathsep + os.environ['PATH']}
        for name in commands:
            subprocess.run([sys.executable, '-B', str(snapshot / 'tools' / name)], cwd=snapshot, env=env, check=True)
    # Historical validators may read shared unchanged files; detect mutation.
    host.predecessor_runtime(owner.runtime_files())
    print('Historical G153 source/compile/composition/scoped-builder checks PASS on exact '+host.PREVIOUS+'; no current/native acceptance inherited')


def main(expected_version=(2, 8, 154)):
    assert expected_version == (2, 8, 154)
    semantic_checks(expected_version)


def semantic_checks(expected_version):
    """Current semantics run on the fully admitted exact successor runtime."""
    assert expected_version in ((2, 8, 154), (2, 8, 155))
    import current_runtime_ownership as owner
    owner.verify_current_inventory()
    run_checked_once([sys.executable, '-B', 'tools/test_g154_host_source.py'], cwd=ROOT)
    # Every preceding semantic gate still sees actual G154 runtime. Only four
    # explicitly G153-bound source tests above run on that original snapshot.
    previous(expected_version=expected_version)
    commands = [
        [sys.executable, '-B', 'tools/test_crop_geometry.py'],
        [sys.executable, '-B', 'tools/test_fortress_loot_current.py'],
        [sys.executable, '-B', 'tools/check_grilling_guide.py'],
        [sys.executable, '-B', 'development/gameplay_core/test_oil_brush_assets.py'],
        ['node', '--test', 'development/gameplay_core/test_oil_brush_visual.mjs'],
        ['node', '--experimental-vm-modules', '--test', 'development/tests/runtime/pepper_harvest_conservation.test.mjs'],
        ['node', '--test', 'development/gameplay_core/test_rack_visual_selection.mjs',
         'development/gameplay_core/test_rack_transactions.mjs', 'development/gameplay_core/test_rack_geometry.mjs',
         'development/gameplay_core/test_rack_aim_hit.mjs', 'development/gameplay_core/test_rack_tool_runtime.mjs'],
    ]
    for command in commands:
        run_checked_once(command, cwd=ROOT)
    historical153_checks()
    owner.verify_current_inventory()
    print('Current actual source semantic checks PASS; native/client/rendered acceptance remains separate')


if __name__ == '__main__':
    main()
