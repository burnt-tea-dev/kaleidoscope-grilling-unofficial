"""Run focused gameplay checks, or the named test files.

The complete transitional suite runs only when --full is requested.

Only the external Minecraft API boundary is substituted. Engine and client
acceptance are separate from these deterministic behavior tests.
"""
import argparse
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]

# One owner-level smoke test per gameplay domain. Historical characterisation
# tests remain available via --full; they no longer block every feature PR.
SMOKE_TESTS = (
    'tests/scenario/test_skewer_item_snapshot.mjs',
    'tests/scenario/test_secret_inventory_icon.mjs',
    'tests/scenario/test_cold_houttuynia_transaction.mjs',
    'tests/legacy/test_core.mjs',
    'tests/legacy/test_plate_transactions.mjs',
    'tests/legacy/test_oil_transactions.mjs',
    'tests/legacy/test_rack_transactions.mjs',
    'tests/legacy/test_food_finish.mjs',
    'tests/legacy/test_food_snapshot.mjs',
    'tests/legacy/test_bottle_raw_lore.mjs',
    'tests/scenario/test_pending_seasoning_metadata.mjs',
    'tests/legacy/test_java_survival_parity.mjs',
    'tests/legacy/test_java_heat_deadlines.mjs',
    'tests/legacy/test_cookery_output_contract_core.mjs',
    'tests/legacy/test_cuisine_quality_java.mjs',
    'tests/legacy/test_immersion_audio.mjs',
    'tests/scenario/test_heavy_metal_rescue.mjs',
    'tests/scenario/test_warmth_heat_sources.mjs',
    'tests/scenario/test_held_snapshot_recovery.mjs',
    'tests/legacy/test_skewer_compat_core.mjs',
    'tests/legacy/test_secret_compat_core.mjs',
    'tests/legacy/test_rack_aim_hit.mjs',
    'tests/legacy/test_oil_api.mjs',
    'tests/legacy/test_a277_core.mjs',
)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    scope = parser.add_mutually_exclusive_group()
    scope.add_argument('--smoke', action='store_true', help='Run the focused per-PR gameplay checks')
    scope.add_argument('--full', action='store_true', help='Explicitly run all legacy and current gameplay checks')
    parser.add_argument('tests', nargs='*', type=Path, help='Run only these test files instead of the default core checks')
    args = parser.parse_args()
    if args.tests and (args.smoke or args.full):
        parser.error('Choose test files or a suite flag, not both')
    if args.full:
        directories = [ROOT / 'tests' / name for name in ('unit', 'scenario', 'legacy')]
        tests = sorted({path for directory in directories for pattern in ('test_*.mjs', '*.test.mjs') for path in directory.glob(pattern)})
    else:
        tests = [ROOT / name for name in (args.tests or SMOKE_TESTS)]
    missing = [str(path) for path in tests if not path.is_file()]
    if missing:
        raise RuntimeError(f'Test files missing: {missing}')
    if not tests:
        raise RuntimeError('No gameplay tests found')
    subprocess.run(
        ['node', '--import', str(ROOT / 'tests/helpers/register-minecraft-loader.mjs'), '--test', '--test-concurrency=1', *(str(path) for path in tests)],
        cwd=ROOT, check=True,
    )
    print(f'Passed {len(tests)} gameplay test files; no engine or client acceptance claimed')


if __name__ == '__main__':
    try:
        main()
    except subprocess.CalledProcessError as error:
        sys.exit(error.returncode)
