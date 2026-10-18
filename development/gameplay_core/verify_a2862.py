"""Integrated development source gate; freeze and native acceptance are separate."""
from pathlib import Path
import json
import subprocess
import sys
from verify_a2861 import main as previous
from verification_session import run_checked_once

ROOT = Path(__file__).resolve().parents[2]
BP = ROOT / 'projects/grilling/gameplay_core/behavior_pack'


def native_variants_gate(expected_version=(2, 8, 62)):
    for config_path in (ROOT / 'config.json', BP.parent / 'config.json'):
        config = json.loads(config_path.read_text())
        names = [entry[1]['packName'] for entry in config['compiler']['plugins']
                 if isinstance(entry, list) and entry[0] == 'simpleRewrite']
        assert names == ['Kaleidoscope_Grilling_' + '_'.join(map(str, expected_version)) + '_Canonical'], config_path
    # PR124's final .55 invariants supplement the independent .61 verifier chain.
    # Historical verifiers from the other release lineage remain unchanged.
    for generator in ('build_native_eating_variants.py', 'build_eating_motion.py'):
        if generator == 'build_eating_motion.py':
            run_checked_once([sys.executable, str(ROOT / 'tools' / generator), '--check'], cwd=ROOT)
        else:
            subprocess.run([sys.executable, str(ROOT / 'tools' / generator), '--check'], check=True)
    variants = list((BP / 'items').glob('*_java_three_alt.json'))
    assert len(variants) == 22, len(variants)
    for path in variants:
        alt = json.loads(path.read_text())['minecraft:item']
        base = json.loads(path.with_name(path.name.replace('_java_three_alt', '')).read_text())['minecraft:item']
        a, b = json.loads(json.dumps(alt['components'])), json.loads(json.dumps(base['components']))
        assert a['minecraft:use_modifiers'].pop('use_duration') == 4.5, path
        assert b['minecraft:use_modifiers'].pop('use_duration') == 5, path
        assert a == b, path
        assert 'menu_category' not in alt['description'], path
        assert alt['components']['minecraft:display_name'] == base['components']['minecraft:display_name'], path


def main(expected_version=(2, 8, 62)):
    previous()
    native_variants_gate(expected_version)
    subprocess.run([sys.executable, '-B', 'development/gameplay_core/test_java_eating_projection_admission.py'], cwd=ROOT, check=True)
    subprocess.run([sys.executable, str(ROOT / 'tools/audit_grilling_render.py'), '--fail-on-error'], cwd=ROOT, check=True)
    subprocess.run([sys.executable, str(ROOT / 'tools/audit_java_eating_contracts.py')], cwd=ROOT, check=True)
    # API doubles certify source transactions, never rendered client parity.
    subprocess.run(['node', '--test', 'development/gameplay_core/test_eating_item_runtime.mjs', 'development/gameplay_core/test_native_variant_ingredient_effects.mjs'], cwd=ROOT, check=True)
    print('A2.8.62 integrated native variants, effects, metadata, guide and preserved bottle source PASS; unfreeze/native acceptance pending')


if __name__ == '__main__':
    main()
