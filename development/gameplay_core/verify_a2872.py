"""G72 author Cookery 1.6.0 adaptation; retain the complete G69 repair chain."""
from verify_a2868 import main as previous
from pathlib import Path
import json,subprocess,sys
ROOT=Path(__file__).resolve().parents[2]
def main(expected_version=(2,8,72)):
 previous(expected_version=expected_version)
 sys.path.insert(0,str(ROOT/'tools'))
 if tuple(expected_version)>=(2,8,150):
  from check_cookery161_host import check
 else:
  from check_cookery160_host import check
 check()
if __name__=='__main__':main()
