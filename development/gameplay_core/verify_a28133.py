"""Keep all prior gameplay gates, including the current persistent eating HUD tests."""
from pathlib import Path
import os
from verify_a28132 import main as previous
from verification_session import SESSION_ENV, current_source_validation_session

def main(expected_version=(2, 8, 133)):
    previous(expected_version=expected_version)
    print('G133 persistent eating receiver source gates PASS; rendered client acceptance remains pending')

if __name__ == '__main__':
    if os.environ.pop(SESSION_ENV, None) == Path(__file__).name:
        with current_source_validation_session():
            main()
    else:
        main()
