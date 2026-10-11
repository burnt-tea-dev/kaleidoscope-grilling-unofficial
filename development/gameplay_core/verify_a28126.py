"""Retain G125/HUD gates; add the bounded caterpillar camera regression."""
from pathlib import Path
import os,subprocess,sys
from verify_a28125 import main as previous
from verification_session import SESSION_ENV,current_source_validation_session
ROOT=Path(__file__).resolve().parents[2]
def main(expected_version=(2,8,126)):
    previous(expected_version=expected_version)
    subprocess.run([sys.executable,'development/gameplay_core/test_caterpillar_eating_projection.py'],cwd=ROOT,check=True)
    subprocess.run([sys.executable,'tools/build_caterpillar_eating_projection.py','--check'],cwd=ROOT,check=True)
    print('G126 scoped camera and bounded HUD source PASS; near-mouth and full client acceptance remain separate')
if __name__=='__main__':
    if os.environ.pop(SESSION_ENV,None)==Path(__file__).name:
        with current_source_validation_session():main()
    else:main()
