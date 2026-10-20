"""Run the retained, directly imported gameplay rules during the P2 transition.

T2.5 will move these tests into tests/legacy and finish classifying the remaining
legacy tests. Do not discover the retired source-shape and geometry suites.
"""
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
# Pre-existing failures awaiting T2.5 classification: a2740_core expects an old
# localization key; a2769_core requires a Minecraft server import/harness.
# Remaining unclassified tests are not claimed as passing by this runner.
TESTS = '''
a23_hot_merge a26_core a2710_core a2711_core a2712_core a2713_core
a2714_core a2715_core a2716_core a2717_core a2718_core a2719_core
a271_core a2720_core a2722_core a2724_core a272_core a2730_core
a2731_core a2738_integrated a2738_shared_core a2739_core a2741_core
a2742_core a2744_core a2745_core a2747_core a2748_core a2749_core
a2752_core a2752_host_core a2753_core a2756_core a2758_core a2759_core
a275_core a2762_core a2766_core a276_core a2770_core a278_core a279_core
a285_core book_ingredient_tags cookery_output_contract_core dragon_health
food_snapshot immersion_audio localized_heat_lore oil_api oil_source_registry_core
plant_fertilizer_storage plate_food_cache projectile_dodge_ground_composition
projectile_dodge_native_alias projectile_dodge_owned_ground secret_compat_core
secret_visual_state skewer_compat_core
'''.split()


def main():
    for name in TESTS:
        path = ROOT / 'development/gameplay_core' / f'test_{name}.mjs'
        print(f'Running {path.relative_to(ROOT)}', flush=True)
        subprocess.run(['node', str(path)], cwd=ROOT, check=True)
    print(f'Passed {len(TESTS)} retained gameplay test files')


if __name__ == '__main__':
    try:
        main()
    except subprocess.CalledProcessError as error:
        sys.exit(error.returncode)
