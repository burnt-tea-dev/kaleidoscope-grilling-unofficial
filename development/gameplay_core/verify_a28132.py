"""Retain startup/gameplay gates and check advancement reward ownership failures."""
from pathlib import Path
import os
import subprocess
from verify_a28131 import main as previous
from verification_session import SESSION_ENV, current_source_validation_session

ROOT = Path(__file__).resolve().parents[2]

def main(expected_version=(2, 8, 132)):
    previous(expected_version=expected_version)
    subprocess.run(['node', 'development/gameplay_core/test_advancement_settlement.mjs'], cwd=ROOT, check=True)
    print('G132 advancement at-most-once attempt source gates PASS; native/client acceptance remain separate')

if __name__ == '__main__':
    if os.environ.pop(SESSION_ENV, None) == Path(__file__).name:
        with current_source_validation_session():
            main()
    else:
        main()
