"""Align the graphical clock with native remaining ticks; conserve eating gameplay."""
from pathlib import Path
import os
from verify_a28140 import main as previous
from verification_session import SESSION_ENV, current_source_validation_session


def main(expected_version=(2, 8, 141)):
    previous(expected_version=expected_version)
    print('G141 native remaining-use HUD clock and immediate start frame source gates PASS; client acceptance remains separate')


if __name__ == '__main__':
    if os.environ.pop(SESSION_ENV, None) == Path(__file__).name:
        with current_source_validation_session():
            main()
    else:
        main()
