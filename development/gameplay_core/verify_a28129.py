"""Retain G128 checks with the G129 catalog and release identity."""
from pathlib import Path
import os
from verify_a28128 import main as previous
from verification_session import SESSION_ENV, current_source_validation_session


def main(expected_version=(2, 8, 129)):
    previous(expected_version=expected_version)
    print('G129 independent eating HUD catalog source gates PASS; full-family and client rendering remain separate')


if __name__ == '__main__':
    if os.environ.pop(SESSION_ENV, None) == Path(__file__).name:
        with current_source_validation_session():
            main()
    else:
        main()
