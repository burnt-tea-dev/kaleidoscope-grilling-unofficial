"""Run gameplay unit and runtime scenarios, including remaining transition tests.

Only the external Minecraft API boundary is substituted. Engine and client
acceptance are separate from these deterministic behavior tests.
"""
import argparse
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def main():
    argparse.ArgumentParser(description=__doc__).parse_args()
    directories = [ROOT / 'tests' / name for name in ('unit', 'scenario', 'legacy')]
    tests = sorted({path for directory in directories for pattern in ('test_*.mjs', '*.test.mjs') for path in directory.glob(pattern)})
    if not tests:
        raise RuntimeError('No gameplay tests found')
    subprocess.run(
        ['node', '--import', str(ROOT / 'tests/helpers/register-minecraft-loader.mjs'), '--test', '--test-concurrency=1', *(str(path) for path in tests)],
        cwd=ROOT, check=True,
    )
    print(f'Passed {len(tests)} gameplay test files; no engine or client acceptance claimed')


if __name__ == '__main__':
    try:
        main()
    except subprocess.CalledProcessError as error:
        sys.exit(error.returncode)
