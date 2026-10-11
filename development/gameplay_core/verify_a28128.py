"""Retain G127 gates; add the concrete Cookery Uses lore regression."""
from pathlib import Path
import os
import subprocess
from verify_a28127 import main as previous
from verification_session import SESSION_ENV, current_source_validation_session

ROOT = Path(__file__).resolve().parents[2]

def main(expected_version=(2, 8, 128)):
    previous(expected_version=expected_version)
    subprocess.run(['node', '--test', 'development/gameplay_core/test_cookery_seasoning_uses_lore.mjs'], cwd=ROOT, check=True)
    print('G128 Uses lore and inherited Numb schema source gates PASS; combined native/full-family acceptance remain pending')

if __name__ == '__main__':
    if os.environ.pop(SESSION_ENV, None) == Path(__file__).name:
        with current_source_validation_session():
            main()
    else:
        main()
