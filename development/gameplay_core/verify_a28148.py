"""G148 source-owned TP seasoning item contribution, retaining every prior gate."""
from pathlib import Path
import subprocess,sys
from verify_a28147 import main as previous
ROOT=Path(__file__).resolve().parents[2]

def main(expected_version=(2,8,148)):
    previous(expected_version=expected_version)
    subprocess.run([sys.executable,'-B','development/gameplay_core/test_seasoning_tp_inversion.py'],cwd=ROOT,check=True)
    print('G148 relative TP seasoning item source correction PASS; absolute/native/client parity remains open')

if __name__=='__main__':main()
