"""Preserve eating gameplay and prune fixed-instance graphical alternatives."""
from pathlib import Path
import os, subprocess, sys
from verify_a28141 import main as previous
from verification_session import SESSION_ENV, current_source_validation_session


def main(expected_version=(2, 8, 142)):
    previous(expected_version=expected_version)
    subprocess.run([sys.executable,str(Path(__file__).with_name('test_review_three_routes.py'))],check=True)
    print('G142 fixed-instance HUD creation pruning source gates PASS; client performance acceptance remains separate')


if __name__ == '__main__':
    if os.environ.pop(SESSION_ENV, None) == Path(__file__).name:
        with current_source_validation_session():
            main()
    else:
        main()
