"""Reconcile tag-aware books and authored Java hand poses with upstream .29."""
from pathlib import Path
import subprocess,sys
from verify_a2829 import main as baseline
ROOT=Path(__file__).resolve().parents[2]
def main():
    baseline()
    subprocess.run(['node','--test','development/gameplay_core/test_book_ingredient_tags.mjs'],cwd=ROOT,check=True)
    subprocess.run([sys.executable,'development/gameplay_core/test_held_render_contracts.py'],cwd=ROOT,check=True)
    subprocess.run([sys.executable,'development/gameplay_core/test_native_skewer_icons.py'],cwd=ROOT,check=True)
    subprocess.run([sys.executable,'tools/audit_grilling_render.py','--fail-on-error'],cwd=ROOT,check=True,stdout=subprocess.DEVNULL)
    print('A2.8.30 Java hand-frame, tagged books and held resource contracts PASS; client use motion unverified')
if __name__=='__main__':main()
