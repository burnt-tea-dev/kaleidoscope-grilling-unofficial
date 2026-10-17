"""G151 skewer-content source repair, retaining every preceding gate."""
from pathlib import Path
import sys
from verify_a28150 import main as previous
from verification_session import run_checked_once

ROOT = Path(__file__).resolve().parents[2]


def main(expected_version=(2, 8, 151)):
    # Retain lifecycle, generated assets and exact inventory checks, then add
    # the new catalog/owner boundary coverage once in this source invocation.
    previous(expected_version=expected_version)
    run_checked_once([sys.executable, '-B', 'development/gameplay_core/test_cookery_161_visual_extension.py'], cwd=ROOT)
    run_checked_once(['node', '--test', 'development/gameplay_core/test_secret_catalog_transport.mjs'], cwd=ROOT)
    print('G151 skewer-content source checks PASS; native/client acceptance remains separate')


if __name__ == '__main__':
    main()
