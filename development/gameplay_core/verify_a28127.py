"""Continue every G126 gate with the exact two-route and Atlas source scope."""
from pathlib import Path
import os,subprocess,sys
from verify_a28126 import main as previous
from verification_session import SESSION_ENV,current_source_validation_session
ROOT=Path(__file__).resolve().parents[2]
def main(expected_version=(2,8,127)):
    previous(expected_version=expected_version)
    subprocess.run([sys.executable,'development/gameplay_core/test_two_route_eating_projection.py'],cwd=ROOT,check=True)
    subprocess.run([sys.executable,'tools/build_two_route_eating_projection.py','--check'],cwd=ROOT,check=True)
    print('G127 exact two-route and Atlas functional source PASS; combined native/full-family/client acceptance remain open')
if __name__=='__main__':
    if os.environ.pop(SESSION_ENV,None)==Path(__file__).name:
        with current_source_validation_session():main()
    else:main()
