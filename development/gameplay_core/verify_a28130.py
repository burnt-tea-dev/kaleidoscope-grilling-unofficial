"""Retain every G129 gate with the isolated graphical title transport identity."""
from pathlib import Path
import os
from verify_a28129 import main as previous
from verification_session import SESSION_ENV, current_source_validation_session

def main(expected_version=(2, 8, 130)):
    previous(expected_version=expected_version)
    print('G130 isolated graphical transport and snapshot source gates PASS; native/client acceptance remain separate')

if __name__ == '__main__':
    if os.environ.pop(SESSION_ENV, None) == Path(__file__).name:
        with current_source_validation_session():
            main()
    else:
        main()
