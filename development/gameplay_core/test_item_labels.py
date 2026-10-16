"""Cover inventory attribution without polluting plain names or item behaviour."""
from pathlib import Path
import json
import subprocess
from copy import deepcopy
import re
import struct
import sys
PROFILE_SOURCE=json.loads(re.search(r"PROFILE_BY_ITEM=Object.freeze\((\{.*?\})\)",subprocess.check_output(["git","show","d795c0e:projects/grilling/gameplay_core/behavior_pack/scripts/data.js"],cwd=Path(__file__).resolve().parents[2]).decode()).group(1))
ALL_EATING_ITEMS={k.split(':')[1] for k in PROFILE_SOURCE}|{'secret_skewer'}
RANDOM_ITEMS={k.split(":")[1] for k,v in PROFILE_SOURCE.items() if v=="THREE_RANDOM"}|{"secret_skewer"}
from test_bottle_item_offhand_sources import BOTTLES, check_authoring

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools'))
from bottle_clear_guide_source_witness import reference_bytes as bottle_guide_reference
from public_source_witness import CUISINE_CANDIDATE_BASE, REVIEWED_SCENE_INTERACTION_BASE, cuisine_release_link
PROJECT = ROOT / 'projects/grilling/gameplay_core'
BASE='1cf16f39f449ee5ce95190ef9088e575d133f928'  # Merged 2.8.45 runtime, including the prior repairs.
LABEL_BASE='49159e9d4dc9a88ad59dfda618146c0d7a3b9fc0'
PREVIOUS_GUIDE_BASE='f7bd2d26367c113ab8881bc67e9f5e69624917ff'
REVIEWED_GUIDE_BASE='8099dc2d211e79c881548a2abc90c06e6c876dc5'
CURRENT_GUIDE_BASE='187e179d58f48fbc9b4d57b5f01cff90b7489ee6'
QUALITY_CUISINE_ITEMS = frozenset({'houttuynia_stir_fried_pork', 'green_pepper_squid_tentacles', 'braised_chicken_wings'})
QUALITY_TOOLTIP_KEYS = frozenset('tooltip.kaleidoscope_grilling.cuisine_quality.' + name for name in ('superb', 'excellent', 'standard', 'poor'))
LABELS = {'en_US': 'Kaleidoscope Grilling', 'zh_CN': '森罗物语烟火',
          'zh_TW': '森羅物語煙火'}


def prior(path, source_base=BASE):
    return subprocess.check_output(['git', 'show', source_base + ':' +
                                   path.relative_to(ROOT).as_posix()], cwd=ROOT)


def language(data):
    rows = [line.split('=', 1) for line in data.decode('utf-8-sig').splitlines()
            if '=' in line and not line.startswith('#')]
    assert len(rows) == len(dict(rows)), 'Duplicate translation key'
    return dict(rows)


def current_behavior_expectation(before, kind, stem, version):
    expected = deepcopy(before)
    if version >= (2, 8, 62) and kind == 'item' and stem in RANDOM_ITEMS:
        c=expected['minecraft:item']['components']
        c['minecraft:use_modifiers']['use_duration']=5.0
        tags=c.setdefault('minecraft:tags',{'tags':[]})['tags']
        tag='kaleidoscope_grilling:food_'+stem
        if tag not in tags:tags.append(tag)
    if version >= (2, 8, 67) and kind == 'item' and stem in ALL_EATING_ITEMS:
        tags=expected['minecraft:item']['components'].setdefault('minecraft:tags',{'tags':[]})['tags']
        tag='kaleidoscope_grilling:food_'+stem
        if tag not in tags:tags.append(tag)
    if version >= (2, 8, 61) and kind == 'item' and stem in BOTTLES:
        expected['minecraft:item']['components']['minecraft:allow_off_hand'] = True
    if version >= (2, 8, 71) and kind == 'item' and stem in {
            f'special_seasoning_r{r}_v{v}' for r in range(1, 9) for v in range(8)}:
        expected['minecraft:item']['components']['minecraft:icon'] = {'textures': {'default': stem}}
    if version >= (2,8,68) and kind=='block' and stem=='pepper_leaves':
        expected['minecraft:block']['components']['minecraft:tick']={'interval_range':[5,5],'looping':True}
    if version >= (2,8,75) and kind == 'block' and stem == 'advanced_rack_block':
        block = expected['minecraft:block']
        block['description']['states']['kaleidoscope_grilling:seasoning_occupancy'] = list(range(32))
        visible = {f'rack_seasoning_{i}':
            f"math.floor(q.block_state('kaleidoscope_grilling:seasoning_occupancy') / {1 << i}) - 2 * math.floor(q.block_state('kaleidoscope_grilling:seasoning_occupancy') / {2 << i}) == 1"
            for i in range(5)}
        for components in [block['components'], *[row['components'] for row in block['permutations']]]:
            geometry = components.get('minecraft:geometry')
            if geometry is not None:
                assert isinstance(geometry, str) and geometry.startswith('geometry.kg_a1.advanced_rack_')
                components['minecraft:geometry'] = {'identifier': geometry, 'bone_visibility': deepcopy(visible)}
    if version >= (2,8,76) and kind == 'block' and stem == 'advanced_rack_block':
        block = expected['minecraft:block']
        block['description']['states']['kaleidoscope_grilling:seasoning_occupancy'] = list(range(16))
        block['description']['states']['kaleidoscope_grilling:seasoning_occupancy_high'] = [0, 1]
        for components in [block['components'], *[row['components'] for row in block['permutations']]]:
            geometry = components.get('minecraft:geometry')
            if geometry is not None:
                geometry['bone_visibility']['rack_seasoning_4'] = "q.block_state('kaleidoscope_grilling:seasoning_occupancy_high') == 1"
    if version >= (2,8,118) and kind == 'item' and stem in ('houttuynia', 'pepper_sapling'):
        expected['minecraft:item']['components']['minecraft:compostable'] = {
            'composting_chance': 65 if stem == 'houttuynia' else 30,
        }
    if version >= (2,8,118) and kind == 'block' and stem == 'skewer_recipe':
        c = expected['minecraft:block']['components']
        c['minecraft:selection_box'] = {'origin': [-5, 1.5, 7.75], 'size': [10, 13, 0.25]}
        c['kaleidoscope_grilling:recipe_support'] = {}
        c['minecraft:tick'] = {'interval_range': [20, 20], 'looping': True}
        c['minecraft:movable'] = {'movement_type': 'immovable'}
    if version >= (2,8,125) and kind == 'block' and stem in (
            'canola_oil', 'secret_chili_oil', 'premium_chili_oil', 'grill'):
        # Admit only the four reviewed G125 block deltas. Earlier versions
        # retain their exact preimages, including the old grill light of 13.
        block = expected['minecraft:block']
        if stem == 'grill':
            for index, legged in ((1, 'false'), (3, 'true')):
                row = block['permutations'][index]
                assert row['condition'] == (
                    f"q.block_state('kaleidoscope_grilling:legged') == {legged} && "
                    "q.block_state('kaleidoscope_grilling:lit') == true")
                assert row['components']['minecraft:light_emission'] == 13, 'G125 grill preimage drift'
                row['components']['minecraft:light_emission'] = 7
        else:
            materials = block['components']['minecraft:material_instances']
            assert set(materials) == {'*'}, 'G125 oil material preimage drift'
            materials['flow'] = {
                'texture': 'kg_a23_' + stem + '_flow',
                'render_method': 'blend',
                'ambient_occlusion': 0.0,
                'face_dimming': False,
            }
        reviewed = json.loads(prior(PROJECT / 'behavior_pack/blocks' / (stem + '.json'),
                                    REVIEWED_SCENE_INTERACTION_BASE))
        # The caller checks the label separately. Every non-display field,
        # including unchanged materials/permutations, must match public source.
        reviewed['minecraft:block']['components']['minecraft:display_name'] = block['components']['minecraft:display_name']
        assert reviewed == expected, 'G125 block witness differs outside reviewed delta: ' + stem
    if version >= (2, 8, 138) and kind == 'item':
        touch = json.loads((ROOT / 'data/touch-skewer-native-reference.json').read_text())['items']
        if stem + '.json' in touch:
            expected['minecraft:item']['components']['minecraft:interact_button'] = True
    if kind == 'item' and stem in ('grilled_slime_skewer','mysterious_skewer'):
        current=json.loads((PROJECT/'behavior_pack/items'/(stem+'.json')).read_bytes())
        if 'minecraft:block_placer' in current['minecraft:item']['components']:
            from native_skewer_icons import check_or_write
            check_or_write(ROOT)
            c=expected['minecraft:item']['components']
            c.pop('minecraft:icon')
            c['minecraft:block_placer']={'block':'kaleidoscope_grilling:item_visual_'+stem,'use_on':[{'tags':'0'}]}
    return expected


def main():
    aliases = {}
    version = tuple(json.loads((PROJECT / 'behavior_pack/manifest.json').read_bytes())['header']['version'])
    counts = {}
    bottle_eligibility = set()
    quality_aliases = set()
    quality_food = {}
    if version >= (2,8,122):
        cuisine_link = cuisine_release_link()
        cuisine_source = cuisine_link['reviewed_commit']
        oracle = json.loads((ROOT / 'development/gameplay_core/fixtures/java-cuisine-quality-160.json').read_text())
        quality_food = {(row['baseId'].split(':',1)[1],row['quality']): row for row in oracle['neoforge_nutrition']}
        assert len(oracle['neoforge_nutrition']) == len(quality_food) == 12
        assert set(quality_food) == {(stem,quality) for stem in QUALITY_CUISINE_ITEMS for quality in range(4)}
    for folder, kind in [('items', 'item'), ('blocks', 'block')]:
        count = 0
        for path in sorted((PROJECT / 'behavior_pack' / folder).glob('*.json')):
            if kind == 'block' and path.stem in ('item_visual_grilled_slime_skewer','item_visual_mysterious_skewer'):
                from native_skewer_icons import check_or_write, planned
                check_or_write(ROOT)
                assert json.loads(path.read_bytes()) == json.loads(planned(ROOT)[0][path]), path
                continue
            cuisine = re.fullmatch(r'(.+)_cuisine_q([0-3])', path.stem) if kind == 'item' else None
            if cuisine:
                assert version >= (2,8,122) and cuisine.group(1) in QUALITY_CUISINE_ITEMS, 'Unreviewed cuisine alias: ' + str(path)
                stem,quality = cuisine.group(1),int(cuisine.group(2))
                expected = json.loads(path.with_name(stem+'.json').read_bytes())
                item = expected['minecraft:item']
                item['description']['identifier'] += '_cuisine_q' + str(quality)
                item['description'].pop('menu_category',None)
                food = quality_food[(stem,quality)]
                item['components']['minecraft:food']['nutrition'] = food['nutrition']
                # NeoForge's observed float saturation gain is represented as
                # a native Bedrock modifier. The item still keeps all base
                # names/assets/use/stack/remainder fields exactly.
                item['components']['minecraft:food']['saturation_modifier'] = struct.unpack('!f',struct.pack('!f',food['saturationGain']/(2*food['nutrition'])))[0]
                actual = json.loads(path.read_bytes())
                assert actual == expected, 'Cuisine alias changed unrelated base behaviour: ' + str(path)
                assert path.read_bytes() == prior(path,CUISINE_CANDIDATE_BASE) == prior(path,cuisine_source), 'Cuisine alias differs from its exact candidate/public release source: ' + str(path)
                quality_aliases.add(path.stem)
                continue
            if kind == 'item' and path.stem == 'pepper_leaves':
                assert version >= (2,8,118)
                # G118 exposes the existing block item to native composting;
                # its label reuses the historical block alias without adding one.
                assert json.loads(path.read_bytes()) == {
                    'format_version': '1.26.50',
                    'minecraft:item': {
                        'description': {
                            'identifier': 'kaleidoscope_grilling:pepper_leaves',
                            'menu_category': {'category': 'equipment', 'group': 'kaleidoscope_cookery:itemGroup.name.other_blocks'},
                        },
                        'components': {
                            'minecraft:display_name': {'value': 'kaleidoscope_grilling.display.block.pepper_leaves'},
                            'minecraft:max_stack_size': 64,
                            'minecraft:block_placer': {'block': 'kaleidoscope_grilling:pepper_leaves', 'replace_block_item': True},
                            'minecraft:compostable': {'composting_chance': 30},
                        },
                    },
                }, path
                continue
            if kind == 'item' and path.stem.endswith('_native_plain'):
                assert version >= (2,8,67) and path.stem.removesuffix('_native_plain') in ALL_EATING_ITEMS
                plain=json.loads(path.read_bytes())['minecraft:item']
                expected=json.loads(path.with_name(path.name.replace('_native_plain','')).read_bytes())['minecraft:item']
                expected['description']['identifier']+='_native_plain';expected['description'].pop('menu_category',None)
                expected['components']['minecraft:use_modifiers']['use_duration']=1.25
                expected['components']['minecraft:use_animation']={'value':'eat'}
                assert plain==expected,path
                continue
            if kind == 'item' and path.stem.endswith('_java_three_alt'):
                assert version >= (2, 8, 62) and path.stem.removesuffix('_java_three_alt') in RANDOM_ITEMS
                alt=json.loads(path.read_bytes())['minecraft:item']
                base=json.loads(path.with_name(path.name.replace('_java_three_alt','')).read_bytes())['minecraft:item']
                assert alt['components']['minecraft:display_name']==base['components']['minecraft:display_name'],path
                assert 'menu_category' not in alt['description'],path
                continue
            if path.name == 'pepper_worldgen_seed.json':
                assert folder == 'blocks' and version >= (2, 8, 60)
                seed = json.loads(path.read_bytes())['minecraft:block']
                assert seed['description'] == {'identifier':'kaleidoscope_grilling:pepper_worldgen_seed'}
                assert seed['components']['minecraft:display_name'] == 'kaleidoscope_grilling.display.block.pepper_log'
                assert not (PROJECT / 'behavior_pack/items/pepper_worldgen_seed.json').exists()
                # This later hidden worldgen carrier reuses an existing label;
                # it is not part of the historical label-only release count.
                continue
            proxy = re.fullmatch(r'(partial|pending)_seasoning_f([1-8])', path.stem) if kind == 'item' else None
            if proxy:
                assert version >= (2,8,71)
                base = 'empty_seasoning_bottle' if proxy.group(1) == 'partial' else 'pending_seasoning'
                expected = json.loads(path.with_name(base+'.json').read_bytes())
                expected['minecraft:item']['description'].update(identifier='kaleidoscope_grilling:'+path.stem,menu_category={'category':'none'})
                expected['minecraft:item']['components']['minecraft:icon']['textures']['default']=path.stem
                assert json.loads(path.read_bytes()) == expected, path
                continue
            before = json.loads(prior(path))
            after = json.loads(path.read_bytes())
            old = before['minecraft:' + kind]['components'].get('minecraft:display_name')
            if old is None:
                assert after == current_behavior_expectation(before, kind, path.stem, version), path
                continue
            value = old['value'] if isinstance(old, dict) else old
            key = ('kaleidoscope_grilling.display.' +
                   ('item' if value.startswith('item.') else 'block') + '.' +
                   value.split(':', 1)[1].removesuffix('.name'))
            display = after['minecraft:' + kind]['components']['minecraft:display_name']
            assert (display['value'] if isinstance(display, dict) else display) == key, path
            after['minecraft:' + kind]['components']['minecraft:display_name'] = old
            # Keep the historical label-only release fully immutable. Its
            # item/block gate still allows no non-display differences at all.
            historical = json.loads(subprocess.check_output(['git', 'show', LABEL_BASE + ':' + path.relative_to(ROOT).as_posix()], cwd=ROOT))
            historical['minecraft:' + kind]['components']['minecraft:display_name'] = old
            assert historical == before, 'Historical label release changed non-display behaviour: ' + str(path)
            expected = current_behavior_expectation(before, kind, path.stem, version)
            if version >= (2, 8, 61) and kind == 'item' and path.stem in BOTTLES:
                assert after['minecraft:item']['components']['minecraft:allow_off_hand'] is True, path
                bottle_eligibility.add(path.stem)
            assert after == expected, 'Non-display item/block behaviour changed: ' + str(path)
            aliases[key] = value
            count += 1
        counts[kind] = count
    assert counts == {'item': 156, 'block': 18}, counts
    assert quality_aliases == ({f'{stem}_cuisine_q{quality}' for stem in QUALITY_CUISINE_ITEMS for quality in range(4)} if version >= (2,8,122) else set()), 'Missing/unexpected cuisine quality aliases'
    if version >= (2, 8, 61):
        assert bottle_eligibility == BOTTLES, 'Missing/unexpected bottle eligibility route'
        assert check_authoring() == 67
    version = tuple(json.loads((PROJECT / 'behavior_pack/manifest.json').read_bytes())['header']['version'])
    public_keys = {'senluo.public.projection.v1'} if version >= (2, 8, 49) else set()
    for locale, label in LABELS.items():
        path = PROJECT / 'resource_pack/texts' / (locale + '.lang')
        old = language(prior(path))
        current = language(bottle_guide_reference(path,path.read_bytes()))
        previous_guide = language(prior(path, PREVIOUS_GUIDE_BASE)) if version >= (2,8,119) else current
        approved = {}
        guide_added = set()
        quality_added = set()
        if version >= (2,8,74):
            name = 'g75-guide-reviewed-delta.json' if version >= (2,8,75) else 'g74-guide-reviewed-delta.json'
            approved = json.loads((ROOT / 'tools/fixtures' / name).read_text())['locales'][locale]
            expected_keys = {'guide.kg.body.kaleidoscope_grilling:special_seasoning.3', 'guide.kg.body.kg_a1:guide_hot_food.1'}
            if version >= (2,8,75):
                expected_keys |= {'ui.kaleidoscope_grilling.advanced_rack.hint', *{f'guide.kg.body.kaleidoscope_grilling:advanced_rack.{n}' for n in (1,3,6)}}
            assert set(approved) == expected_keys
            for key, change in approved.items():
                assert old[key] == change['before'] and current[key] == change['after'], 'Reviewed guide delta drift'
        if version >= (2,8,118):
            delta = json.loads((ROOT / 'tools/fixtures/g118-guide-reviewed-delta.json').read_text())
            assert delta['schema'] == 1 and delta['release'] == [2,8,118]
            changes = delta['locales'][locale]
            expected_keys = {f'guide.kg.body.kaleidoscope_grilling:{entry}.{n}'
                for entry, paragraphs in {
                    'big_vat': (2,5), 'houttuynia': (2,), 'oil_press': (2,5,6),
                    'oil_residue': (1,2,3,4), 'pepper_sapling': (1,5,6),
                }.items() for n in paragraphs}
            assert set(changes) == expected_keys and not (set(changes) & set(approved))
            for key, change in changes.items():
                # G118 remains an immutable historical step; later reviewed
                # paragraphs must chain from its exact text, not replace it.
                assert old.get(key) == change['before'] and previous_guide[key] == change['after'], 'Reviewed G118 guide delta drift'
                if change['before'] is None:
                    assert key not in old
                    guide_added.add(key)
            assert len(guide_added) == 7
            approved.update(changes)
        if version >= (2,8,119):
            delta = json.loads((ROOT / 'tools/fixtures/g119-guide-reviewed-delta.json').read_text())
            assert delta['schema'] == 1 and delta['release'] == [2,8,119]
            assert delta['previous_public_commit'] == PREVIOUS_GUIDE_BASE
            assert delta['reviewed_commit'] == REVIEWED_GUIDE_BASE
            assert set(delta['locales']) == set(LABELS)
            changes = delta['locales'][locale]
            expected_keys = {f'guide.kg.body.kaleidoscope_grilling:{entry}.{n}'
                for entry, paragraphs in {
                    'oil_residue': (2,3,4,5,6,7), 'skewer_plate': (6,),
                    'totem_powder': (2,4),
                }.items() for n in paragraphs}
            assert set(changes) == expected_keys, 'Reviewed G119 guide scope changed'
            reviewed = language(prior(path, REVIEWED_GUIDE_BASE))
            assert {key for key in set(previous_guide) | set(reviewed)
                if previous_guide.get(key) != reviewed.get(key)} == expected_keys, 'G119 guide witness changed outside reviewed scope'
            for key, change in changes.items():
                assert set(change) == {'before', 'after'}
                assert previous_guide.get(key) == change['before'], 'Reviewed G119 guide preimage drift'
                assert reviewed[key] == change['after'], 'Reviewed G119 guide delta drift'
                if change['before'] is None:
                    assert key not in old and key not in approved
                    guide_added.add(key)
            assert len(guide_added) == 12
            approved.update(changes)
        if version >= (2,8,120):
            delta = json.loads((ROOT / 'tools/fixtures/g120-guide-reviewed-delta.json').read_text())
            assert delta['schema'] == 1 and delta['release'] == [2,8,120]
            assert delta['previous_public_commit'] == REVIEWED_GUIDE_BASE
            assert delta['reviewed_commit'] == CURRENT_GUIDE_BASE
            assert set(delta['locales']) == set(LABELS)
            changes = delta['locales'][locale]
            expected_keys = {f'guide.kg.body.kaleidoscope_grilling:oil_residue.{n}' for n in (3,8)}
            assert set(changes) == expected_keys, 'Reviewed G120 guide scope changed'
            latest_reviewed = language(prior(path, CURRENT_GUIDE_BASE))
            assert {key for key in set(reviewed) | set(latest_reviewed)
                if reviewed.get(key) != latest_reviewed.get(key)} == expected_keys, 'G120 guide witness changed outside reviewed scope'
            for key, change in changes.items():
                assert set(change) == {'before', 'after'}
                assert reviewed.get(key) == change['before'], 'Reviewed G120 guide preimage drift'
                assert latest_reviewed[key] == change['after'], 'Reviewed G120 guide delta drift'
                if change['before'] is None:
                    assert key not in old and key not in approved
                    guide_added.add(key)
            assert len(guide_added) == 13
            approved.update(changes)
        if version >= (2,8,122):
            # This unchanged fixture records an unmerged proposal labeled G121.
            # Its exact text becomes active only in the linked G122 release.
            delta = json.loads((ROOT / 'tools/fixtures' / cuisine_link['candidate_fixtures']['language']).read_text())
            assert delta['schema'] == 1 and delta['release'] == [2,8,121]
            assert delta['previous_public_commit'] == CURRENT_GUIDE_BASE
            assert delta['reviewed_commit'] == CUISINE_CANDIDATE_BASE
            assert set(delta['locales']) == set(LABELS)
            changes = delta['locales'][locale]
            expected_keys = {f'guide.kg.body.kaleidoscope_grilling:{stem}.{n}' for stem in QUALITY_CUISINE_ITEMS for n in range(1,8)}
            expected_keys |= {f'guide.kg.body.kaleidoscope_grilling:oil_residue.{n}' for n in (3,6)} | QUALITY_TOOLTIP_KEYS
            assert set(changes) == expected_keys, 'Reviewed cuisine candidate language scope changed'
            cuisine_reviewed = language(prior(path,CUISINE_CANDIDATE_BASE))
            published = prior(path,cuisine_source)
            assert language(published) == cuisine_reviewed, 'G122 changed the exact reviewed cuisine language values'
            assert bottle_guide_reference(path,path.read_bytes()) == published, 'G122 language differs from its published source bytes'
            assert {key for key in set(latest_reviewed) | set(cuisine_reviewed)
                if latest_reviewed.get(key) != cuisine_reviewed.get(key)} == expected_keys, 'Cuisine candidate language witness changed outside reviewed scope'
            for key, change in changes.items():
                assert set(change) == {'before', 'after'}
                assert latest_reviewed.get(key) == change['before'], 'Reviewed cuisine candidate language preimage drift'
                assert cuisine_reviewed[key] == change['after'] and current[key] == change['after'], 'Reviewed G122 cuisine language delta drift'
                if change['before'] is None:
                    assert key not in old and key not in approved
                    (quality_added if key in QUALITY_TOOLTIP_KEYS else guide_added).add(key)
            assert len(guide_added) == 31 and quality_added == QUALITY_TOOLTIP_KEYS
            approved.update(changes)
        assert all(current[key] == change['after'] for key, change in approved.items()), 'Reviewed guide final text drift'
        assert all(current.get(k) == v for k, v in old.items() if k not in approved), 'Plain names/guide text changed'
        config_keys=set(['guide.kg.body.kaleidoscope_grilling:skewer_plate.5', 'guide.kg.body.kaleidoscope_grilling:special_seasoning.8', 'guide.kg.body.kaleidoscope_grilling:grill.8', 'message.kaleidoscope_grilling.cookery_integration_disabled']) if version >= (2,8,67) else set()
        assert set(current) - set(old) == set(aliases) | public_keys | config_keys | guide_added | quality_added, 'Unexpected localization override'
        assert all(current[k] == '' for k in public_keys), 'Public metadata must remain invisible'
        released = language(subprocess.check_output(['git','show',LABEL_BASE+':'+path.relative_to(ROOT).as_posix()],cwd=ROOT))
        assert set(released) - set(old) == set(aliases), 'Historical label-only release drift'
        for key, plain in aliases.items():
            assert current[key] == old[plain] + r'\n' + '§9§o' + label + '§r', key
            assert current[key].count(r'\n') == 1, 'Malformed tooltip newline'
    # All bottle states, existing stacks and block items resolve declaratively;
    # no inventory polling, scripted lore rewriting or host translations.
    # Check the historical label-only release itself. Later releases may add
    # scripts, which did not exist at LABEL_BASE and must not be queried there.
    released_paths = subprocess.check_output([
        'git', 'ls-tree', '-r', '--name-only', LABEL_BASE, '--',
        'projects/grilling/gameplay_core/behavior_pack/scripts',
    ], cwd=ROOT, text=True).splitlines()
    for relative in released_paths:
        path = ROOT / relative
        if path.suffix != '.js':
            continue
        if path.relative_to(PROJECT / 'behavior_pack').as_posix() in (
                'scripts/guide/payload.js', 'scripts/guide/publisher.js'):
            continue
        released = subprocess.check_output(['git', 'show', LABEL_BASE + ':' + path.relative_to(ROOT).as_posix()], cwd=ROOT)
        assert released == prior(path), 'Label release changed runtime script: ' + str(path)
    print(json.dumps({'inventory_items': counts['item'], 'named_blocks': counts['block'],
                      'display_aliases': len(aliases), 'locales': list(LABELS),
                      'plain_names_preserved': True, 'label_release_runtime_behaviour_preserved': True,
                      'client_rendering_accepted': False}, ensure_ascii=False))


if __name__ == '__main__':
    main()
