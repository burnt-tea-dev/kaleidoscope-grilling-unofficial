"""Client held-content and observer animation regression gate; native evidence separate."""
from pathlib import Path
import subprocess
import sys
from verify_a2860 import main as previous
from verification_session import run_checked_once, session_active

def main():
    previous()
    root=Path(__file__).resolve().parents[2]
    subprocess.run(['python3','development/gameplay_core/test_eating_observer_projection.py'],cwd=root,check=True)
    subprocess.run(['node','--test','development/gameplay_core/test_eating_native_completion.mjs','development/gameplay_core/test_effect_application_merge.mjs'],cwd=root,check=True)
    subprocess.run([sys.executable,'-B','-m','unittest','test_java_dual_eating_frames','test_java_dual_eating_renderer'],cwd=root/'development/gameplay_core',check=True)
    if session_active():
        # Earlier gates have completed these exact standalone commands. Keep
        # the other batch members; standalone historical execution stays below.
        run_checked_once(['node','--test',str(root/'development/gameplay_core/test_seasoning_native_storage.mjs')],cwd=root)
        subprocess.run(['node','--test','development/gameplay_core/test_bottle_held_visual.mjs','development/gameplay_core/test_seasoning_native_hands.mjs'],cwd=root,check=True)
        run_checked_once([sys.executable,str(root/'development/gameplay_core/test_native_bottle_fp.py')],cwd=root)
        subprocess.run(['python3','-B','-m','unittest','test_bottle_visual_assets'],cwd=root/'development/gameplay_core',check=True)
    else:
        subprocess.run(['node','--test','development/gameplay_core/test_bottle_held_visual.mjs','development/gameplay_core/test_seasoning_native_storage.mjs','development/gameplay_core/test_seasoning_native_hands.mjs'],cwd=root,check=True)
        subprocess.run(['python3','-B','-m','unittest','test_bottle_visual_assets','test_native_bottle_fp'],cwd=root/'development/gameplay_core',check=True)
    for generator in ['a2770_placed_visual_assets.py','a2861_bottle_held_visual_assets.py']:
        subprocess.run(['python3','development/gameplay_core/'+generator,'--check'],cwd=root,check=True)
    print('A2.8.61 observer projection and bottle contents regressions PASS; native acceptance separate')

if __name__=='__main__':main()
