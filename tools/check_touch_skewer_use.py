"""Expose native eating on touch controls without replacing native use/debit."""
from pathlib import Path
import copy
import json

ROOT = Path(__file__).resolve().parents[1]


def check():
    reference = json.loads((ROOT / 'data/touch-skewer-native-reference.json').read_text())
    items = ROOT / 'projects/grilling/gameplay_core/behavior_pack/items'
    assert 'grilled_caterpillar_skewer.json' in reference['items']
    for name, original in reference['items'].items():
        current = json.loads((items / name).read_text())
        components = current['minecraft:item']['components']
        assert components['minecraft:interact_button'] is True, name
        assert components['minecraft:food']['can_always_eat'] is True, name
        assert components['minecraft:use_animation'] == {'value': 'eat'}, name
        assert components['minecraft:use_modifiers']['start_using'] == 'always', name
        projected = copy.deepcopy(current)
        projected['minecraft:item']['components'].pop('minecraft:interact_button')
        assert projected == original, 'Native nutrition/duration/identity/tags changed: ' + name
    print('Native touch eating action exposed; original servings and consumption definitions conserved')


if __name__ == '__main__':
    check()
