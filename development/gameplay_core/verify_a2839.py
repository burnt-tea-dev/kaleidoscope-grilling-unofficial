"""Immersion contract: silent ordinary interactions and eating, bounded failures."""
from pathlib import Path
import json,subprocess
from verify_a2837 import main as baseline
ROOT=Path(__file__).resolve().parents[2]
def main():
 baseline()
 subprocess.run(['node','development/gameplay_core/test_a283_feedback.mjs'],cwd=ROOT,check=True)
 subprocess.run(['node','--test','development/gameplay_core/test_java_hud.mjs'],cwd=ROOT,check=True)
 scripts=ROOT/'projects/grilling/gameplay_core/behavior_pack/scripts'
 writers=[p.name for p in scripts.rglob('*.js') if 'setActionBar' in p.read_text()]
 version=tuple(json.loads((scripts.parent/'manifest.json').read_text())['header']['version'])
 expected=['a283_interaction_feedback.js'] if version >= (2,8,130) else ['a283_interaction_feedback.js','java_eating_hud_runtime.js']
 assert sorted(writers)==expected,writers
 assert 'eatingProgress' not in (scripts/'main.js').read_text()
 print('A2.8.39 immersion source contract PASS; no real-client acceptance claim')
if __name__=='__main__':main()
