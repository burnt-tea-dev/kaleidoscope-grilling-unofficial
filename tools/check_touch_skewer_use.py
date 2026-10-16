"""Expose native eating on touch controls without replacing native use/debit."""
from pathlib import Path
import copy
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'development/gameplay_core'))
from native_skewer_icons import NS, SOURCES, check_or_write


def native_icon_preimages(reference):
    """Bind the reviewed visual routes to the frozen touch-item preimages."""
    routes = {}
    for name, original in reference.items():
        item = original['minecraft:item']
        components = item['components']
        tags = components.get('minecraft:tags', {}).get('tags', [])
        sources = [source for source in SOURCES if NS + 'food_' + source in tags]
        if not sources:
            continue
        assert len(sources) == 1, 'Ambiguous native icon preimage: ' + name
        source = sources[0]
        assert item['description']['identifier'] == NS + Path(name).stem, name
        assert components['minecraft:icon'] == {'textures': {'default': source}}, name
        assert 'minecraft:block_placer' not in components, name
        routes[name] = source
    # Validate the existing canonical assets and exact non-placeable route before
    # undoing anything. Current tags cannot expand the frozen set of identities.
    assert set(check_or_write(ROOT)) == set(routes), 'Native icon route identities changed'
    return routes


def check():
    reference = json.loads((ROOT / 'data/touch-skewer-native-reference.json').read_text())
    items = ROOT / 'projects/grilling/gameplay_core/behavior_pack/items'
    assert 'grilled_caterpillar_skewer.json' in reference['items']
    native_icons = native_icon_preimages(reference['items'])
    for name, original in reference['items'].items():
        current = json.loads((items / name).read_text())
        components = current['minecraft:item']['components']
        assert components['minecraft:interact_button'] is True, name
        assert components['minecraft:food']['can_always_eat'] is True, name
        assert components['minecraft:use_animation'] == {'value': 'eat'}, name
        assert components['minecraft:use_modifiers']['start_using'] == 'always', name
        projected = copy.deepcopy(current)
        projected_components = projected['minecraft:item']['components']
        projected_components.pop('minecraft:interact_button')
        if name in native_icons:
            # Reverse only the exact reviewed GUI component substitution. All
            # other fields still participate in the original whole-item check.
            assert 'minecraft:icon' not in components, name
            assert components['minecraft:block_placer'] == {
                'block': NS + 'item_visual_' + native_icons[name],
                'use_on': [{'tags': '0'}],
            }, 'Native icon placement contract changed: ' + name
            projected_components.pop('minecraft:block_placer')
            projected_components['minecraft:icon'] = copy.deepcopy(
                original['minecraft:item']['components']['minecraft:icon'])
        assert projected == original, 'Native nutrition/duration/identity/tags changed: ' + name
    print('Native touch eating action exposed; original servings and consumption definitions conserved')


if __name__ == '__main__':
    check()
