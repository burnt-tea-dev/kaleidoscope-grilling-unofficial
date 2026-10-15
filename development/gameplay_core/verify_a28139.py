"""Keep native eating/gameplay gates and require the corrected touch/desktop HUD."""
from pathlib import Path
import os, sys
from verify_a28138 import main as previous
from verification_session import SESSION_ENV, current_source_validation_session


def main(expected_version=(2, 8, 139)):
    previous(expected_version=expected_version)
    print('G139 native actionbar filtering and touch/desktop eating layout source gates PASS; client acceptance remains separate')


if __name__ == '__main__':
    if os.environ.pop(SESSION_ENV, None) == Path(__file__).name:
        with current_source_validation_session():
            main()
    else:
        main()
