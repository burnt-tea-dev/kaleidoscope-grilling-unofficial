"""Public oil/food APIs, native contents and source-backed eating/health regressions."""
from pathlib import Path
import json,subprocess,sys
from verify_a2836 import main as baseline
from verify_a2831 import historical_host_spec
ROOT=Path(__file__).resolve().parents[2]
def main():
 baseline()
 subprocess.run(['node','--test','development/gameplay_core/test_oil_api.mjs','development/gameplay_core/test_family_oil_food_api.mjs','development/gameplay_core/test_world_oil_transfers.mjs','development/gameplay_core/test_dragon_health.mjs'],cwd=ROOT,check=True)
 subprocess.run([sys.executable,'tools/build_eating_motion.py','--check'],cwd=ROOT,check=True)
 spec=historical_host_spec()
 assert spec['version']==([0,2,10] if tuple(json.loads((ROOT/'baseline.json').read_text())['version'])>=(2,8,123) else [0,2,9] if tuple(json.loads((ROOT/'baseline.json').read_text())['version'])>=(2,8,122) else [0,2,8] if tuple(json.loads((ROOT/'baseline.json').read_text())['version'])>=(2,8,121) else [0,2,7] if tuple(json.loads((ROOT/'baseline.json').read_text())['version'])>=(2,8,120) else [0,2,6] if tuple(json.loads((ROOT/'baseline.json').read_text())['version'])>=(2,8,74) else [0,2,5] if tuple(json.loads((ROOT/'baseline.json').read_text())['version'])>=(2,8,72) else [0,2,4] if tuple(json.loads((ROOT/'baseline.json').read_text())['version'])>=(2,8,67) else [0,2,3] if tuple(json.loads((ROOT/'baseline.json').read_text())['version'])>=(2,8,41) else [0,2,2] if tuple(json.loads((ROOT/'baseline.json').read_text())['version'])>=(2,8,40) else [0,2,1] if tuple(json.loads((ROOT/'baseline.json').read_text())['version'])>=(2,8,38) else [0,2,0]) and len(spec['original_files'])==(9 if tuple(json.loads((ROOT/'baseline.json').read_text())['version'])>=(2,8,123) else 8) and len(spec['copies'])==(12 if tuple(json.loads((ROOT/'baseline.json').read_text())['version'])>=(2,8,122) else 8)
 assert set(spec['original_files'])==set(spec['patched_files'])
 assert all('/manifest.json' not in path for path in spec['original_files'])
 assert len(spec['json_updates'])==2
 for op in spec['json_updates']:
  assert op['pointer']==['minecraft:item','components','minecraft:allow_off_hand'] and op['value'] is True
 assert any('handleSharedStationOil' in op['text'] for op in spec['insertions'])
 if tuple(json.loads((ROOT/'baseline.json').read_text())['version'])>=(2,8,120):
  assert any('consumeCuisineCarrier' in op['text'] for op in spec['insertions'])
  assert any('prepareCuisineBurn' in op['text'] for op in spec['insertions'])
  assert any('giveBurntCuisineOutput' in op['text'] for op in spec['insertions'])
 else:
  assert any('beginCuisineCarrier' in op['text'] for op in spec['insertions'])
 print('A2.8.37 public oil/food/guide APIs and fault recovery PASS; native/client evidence remains separate')
if __name__=='__main__':main()
