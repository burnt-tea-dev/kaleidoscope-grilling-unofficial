from pathlib import Path
import subprocess,json,sys
from verification_session import run_checked_once
from verify_a2843 import main as previous
def main():
 previous()
 root=Path(__file__).resolve().parents[2]
 subprocess.run(['node','development/gameplay_core/test_food_finish.mjs'],cwd=root,check=True)
 for generator in ('build_player_extensions.py','build_eating_motion.py','build_secret_held.py'):
  run_checked_once([sys.executable,str(root/'tools'/generator),'--check'],cwd=root)
 version=tuple(json.loads((root/'projects/grilling/gameplay_core/behavior_pack/manifest.json').read_text())['header']['version'])
 assert len(json.loads((root/'projects/grilling/gameplay_core/resource_pack/models/entity/secret_held.geo.json').read_text())['minecraft:geometry'])==(107 if version>=(2,8,68) else 7)
 print('A2845 shared eating, heat, native health and preserved player-frame contracts PASS; client separate')
if __name__=='__main__':main()
