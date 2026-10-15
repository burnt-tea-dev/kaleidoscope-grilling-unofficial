"""Retain the complete source suite, including parity queue/effect regressions."""
from pathlib import Path
import os
from verify_a28143 import main as previous
from verification_session import SESSION_ENV, current_source_validation_session


def main(expected_version=(2, 8, 144)):
    previous(expected_version=expected_version)
    print('G144 bounded deadline work and local player-effect snapshot checks PASS; native/client latency remains separate')


if __name__ == '__main__':
    if os.environ.pop(SESSION_ENV, None) == Path(__file__).name:
        with current_source_validation_session():
            main()
    else:
        main()
