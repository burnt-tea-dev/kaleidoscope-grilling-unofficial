"""Run the explicitly retained T2.5 behavior tests against canonical modules.

Each file gets a fresh Node process. The resolver substitutes Minecraft's native
API only; runtime modules are imported normally without source transformations.
"""
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
TEST_DIR = ROOT / 'tests/legacy'
REGISTER = ROOT / 'tests/helpers/register-minecraft-loader.mjs'


def main():
    tests = [ROOT / 'tests/helpers/minecraft-fixture.test.mjs']
    tests += sorted(TEST_DIR.glob('test_*.mjs')) + sorted(TEST_DIR.glob('*.test.mjs'))
    if len(tests) == 1:
        raise RuntimeError('No retained behavior tests found')
    failed = []
    for path in tests:
        print(f'Running {path.relative_to(ROOT)}', flush=True)
        result = subprocess.run(['node', '--import', str(REGISTER), str(path)], cwd=ROOT)
        if result.returncode:
            failed.append(path.relative_to(ROOT))
    if failed:
        print('Failed test files:', *failed, sep='\n', file=sys.stderr)
        return 1
    print(f'Passed {len(tests)} retained behavior and harness test files')
    return 0


if __name__ == '__main__':
    sys.exit(main())
