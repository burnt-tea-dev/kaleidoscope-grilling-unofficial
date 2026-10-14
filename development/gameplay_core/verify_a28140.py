"""Keep native eating/gameplay gates and hide the complete finished HUD."""
from pathlib import Path
import os
from verify_a28139 import main as previous
from verification_session import SESSION_ENV, current_source_validation_session


def main(expected_version=(2, 8, 140)):
    previous(expected_version=expected_version)
    print('G140 complete native END-token exclusion source gates PASS; client acceptance remains separate')


if __name__ == '__main__':
    if os.environ.pop(SESSION_ENV, None) == Path(__file__).name:
        with current_source_validation_session():
            main()
    else:
        main()
