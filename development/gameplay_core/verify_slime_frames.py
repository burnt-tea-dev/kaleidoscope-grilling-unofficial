"""Current source-only slime checks, invoked by canonical verify_current/CI."""
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]

def main():
    for command in (
        [sys.executable, 'tools/build_slime_frame_selector.py', '--check'],
        [sys.executable, 'development/gameplay_core/test_slime_frame_selector.py'],
        [sys.executable, 'development/gameplay_core/test_slime_clock_precision.py'],
        ['node', '--experimental-vm-modules', '--test', 'development/tests/runtime/slime_frame_transport.test.mjs'],
    ):
        subprocess.run(command, cwd=ROOT, check=True)
    print('Slime selector source checks PASS; native clock/rendering acceptance pending')

if __name__ == '__main__':
    main()
