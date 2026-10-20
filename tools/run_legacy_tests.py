"""Run the classified legacy rules against the canonical runtime exports.

Only tests/legacy contains runnable transition tests. Retired source-evaluated
scenarios and pending engine work are listed in its classification.json.
"""
import argparse
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def main():
    argparse.ArgumentParser(description=__doc__).parse_args()
    directory = ROOT / 'tests/legacy'
    tests = sorted(set(directory.glob('test_*.mjs')) | set(directory.glob('*.test.mjs')))
    if not tests:
        raise RuntimeError('No classified legacy tests found')
    subprocess.run(
        ['node', '--test', '--test-concurrency=1', *(str(path) for path in tests)],
        cwd=ROOT, check=True,
    )
    print(f'Passed {len(tests)} legacy test files; no engine or client acceptance claimed')


if __name__ == '__main__':
    try:
        main()
    except subprocess.CalledProcessError as error:
        sys.exit(error.returncode)
