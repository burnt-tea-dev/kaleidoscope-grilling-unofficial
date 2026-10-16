"""Review the canonical additive chopping-board API extension."""
from pathlib import Path
import json,subprocess,sys
from verify_a2830 import main as baseline
ROOT=Path(__file__).resolve().parents[2]
def historical_host_spec():
 path=ROOT/'projects/grilling/gameplay_core/behavior_pack/host-extensions/board-api.json'
 if tuple(json.loads((ROOT/'baseline.json').read_text())['version'])>=(2,8,150):
  sys.path.insert(0,str(ROOT/'tools'))
  from stable_host_source import preceding_host_spec
  return preceding_host_spec(path.read_bytes())
 return json.loads(path.read_text())
def main():
 baseline()
 subprocess.run(['node','--test','development/gameplay_core/test_board_api.mjs'],cwd=ROOT,check=True)
 spec=historical_host_spec()
 current=json.loads((ROOT/'baseline.json').read_text())['version']
 if tuple(current)>=(2,8,37):
  assert spec['version']==([0,2,10] if tuple(current)>=(2,8,123) else [0,2,9] if tuple(current)>=(2,8,122) else [0,2,8] if tuple(current)>=(2,8,121) else [0,2,7] if tuple(current)>=(2,8,120) else [0,2,6] if tuple(current)>=(2,8,74) else [0,2,5] if tuple(current)>=(2,8,72) else [0,2,4] if tuple(current)>=(2,8,67) else [0,2,3] if tuple(current)>=(2,8,41) else [0,2,2] if tuple(current)>=(2,8,40) else [0,2,1] if tuple(current)>=(2,8,38) else [0,2,0]) and len(spec['original_files'])==(9 if tuple(current)>=(2,8,123) else 8) and len(spec['copies'])==(12 if tuple(current)>=(2,8,122) else 8)
 else:
  assert spec['version']==[0,1,0] and len(spec['original_files'])==2 and len(spec['copies'])==2
 assert all('/manifest.json' not in p for p in spec['patched_files'])
 print('A2.8.31 pinned host API, additive outputs and transaction regressions PASS')
if __name__=='__main__':main()
