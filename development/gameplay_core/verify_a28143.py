"""Keep the complete prior suite and check the current owner-context repair."""
from pathlib import Path
import os
import subprocess
import sys
from verify_a28142 import main as previous
from verification_session import SESSION_ENV, current_source_validation_session

ROOT = Path(__file__).resolve().parents[2]

def main(expected_version=(2, 8, 143)):
    previous(expected_version=expected_version)
    subprocess.run([sys.executable, '-B', 'development/gameplay_core/test_eating_owner_context.py'], cwd=ROOT, check=True)
    subprocess.run([sys.executable, '-B', 'development/gameplay_core/test_offhand_eating_clock.py'], cwd=ROOT, check=True)
    print('G143 owning-player eating context and isolated preparation source checks PASS; client visuals remain separate')

if __name__ == '__main__':
    if os.environ.pop(SESSION_ENV, None) == Path(__file__).name:
        with current_source_validation_session():
            main()
    else:
        main()
