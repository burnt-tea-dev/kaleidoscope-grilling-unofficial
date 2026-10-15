"""G144 retains the complete G143 suite and adds native GUI / shape checks."""
from pathlib import Path
import os
import subprocess
import sys
from verify_a28143 import main as previous
from verification_session import SESSION_ENV, current_source_validation_session
ROOT = Path(__file__).resolve().parents[2]
def main(expected_version=(2, 8, 144)):
    previous(expected_version=expected_version)
    for script in ('test_native_skewer_icons.py', 'test_visible_block_shapes.py'):
        subprocess.run([sys.executable, '-B', 'development/gameplay_core/'+script], cwd=ROOT, check=True)
    print('G144 native GUI source and Java shapes PASS; native client acceptance remains pending')
if __name__ == '__main__':
    if os.environ.pop(SESSION_ENV, None) == Path(__file__).name:
        with current_source_validation_session(): main()
    else: main()
