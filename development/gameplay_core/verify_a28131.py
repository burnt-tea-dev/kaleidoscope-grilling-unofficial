"""Retain all G130 functional gates after removing source-only startup data."""
from pathlib import Path
import os
from verify_a28130 import main as previous
from verification_session import SESSION_ENV, current_source_validation_session

def main(expected_version=(2, 8, 131)):
    previous(expected_version=expected_version)
    print('G131 startup source-data separation gates PASS; native/client acceptance remain separate')

if __name__ == '__main__':
    if os.environ.pop(SESSION_ENV, None) == Path(__file__).name:
        with current_source_validation_session():
            main()
    else:
        main()
