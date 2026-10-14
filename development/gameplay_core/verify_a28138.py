"""Keep prior gameplay gates and require an explicit native touch eat action."""
from pathlib import Path
import os, subprocess, sys
from verify_a28137 import main as previous
from verification_session import SESSION_ENV, current_source_validation_session


def main(expected_version=(2, 8, 138)):
    previous(expected_version=expected_version)
    subprocess.run([sys.executable, str(Path(__file__).resolve().parents[2] / 'tools/check_touch_skewer_use.py')], check=True)
    print('G138 native touch eating action source checks PASS; actual eating remains unverified')


if __name__ == '__main__':
    if os.environ.pop(SESSION_ENV, None) == Path(__file__).name:
        with current_source_validation_session():
            main()
    else:
        main()
