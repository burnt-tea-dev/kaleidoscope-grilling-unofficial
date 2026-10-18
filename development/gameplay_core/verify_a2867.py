"""Integrated parity repairs; source verification never asserts client acceptance."""
from pathlib import Path
import json,subprocess,sys
from verify_a2862 import main as previous
from verification_session import run_checked_once
ROOT=Path(__file__).resolve().parents[2]
VERSION=(2,8,67)
def main(expected_version=VERSION):
    sys.path.insert(0,str(ROOT/'tools'))
    from source_provenance import ensure_provenance
    ensure_provenance()
    previous(expected_version=expected_version)
    # G66's immutable local-native receipt remains historical evidence. Its
    # current-tree equality gate is not applicable to this changed release.
    for name in ('test_held_motion_expression.py','test_seasoning_animation.py','test_seasoning_sprinkle_anchor.py','test_secret_held_owner_context.py'):
        subprocess.run([sys.executable,str(ROOT/'development/gameplay_core'/name)],cwd=ROOT,check=True)
    for name in ('build_seasoning_held.py','build_player_extensions.py','build_secret_held.py','build_eating_motion.py','build_plain_eating_variants.py','build_grilling_guide.py'):
        if name in ('build_eating_motion.py','build_secret_held.py','build_player_extensions.py'):
            run_checked_once([sys.executable,str(ROOT/'tools'/name),'--check'],cwd=ROOT)
        else:
            subprocess.run([sys.executable,str(ROOT/'tools'/name),'--check'],cwd=ROOT,check=True)
    subprocess.run(['node','--test',*[str(ROOT/'development/gameplay_core'/name) for name in ('test_seasoning_motion_runtime.mjs','test_oil_registry_rollback.mjs','test_oil_flow_native_reads.mjs','test_grill_tick_native_reads.mjs','test_oil_ambient.mjs','test_heavy_metal_deferred.mjs','test_family_oil_food_api.mjs','test_integration_interfaces.mjs','test_pepper_contact_budget.mjs')]],cwd=ROOT,check=True)
    print('A'+'.'.join(map(str,expected_version))+' source repairs PASS; native, full-family migration and human acceptance remain separate')
if __name__=='__main__':main()
