"""G155 retains the exact G154 host layer and adds reviewed plate ownership."""
from pathlib import Path
import sys
from verify_a28154 import semantic_checks
from verification_session import run_checked_once

ROOT = Path(__file__).resolve().parents[2]


def main(expected_version=(2, 8, 155)):
    assert expected_version == (2, 8, 155)
    semantic_checks(expected_version)
    run_checked_once([sys.executable, '-B', 'tools/test_g155_plate_source.py'], cwd=ROOT)
    print('G155 exact plate continuation over host154 PASS; native/client acceptance separate')


if __name__ == '__main__':
    main()
