"""Source contracts only: no native renderer or observer acceptance."""
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'development/gameplay_core'))
import java_dual_eating_frames as dual
from java_eating_piece_resolver import SOURCE, available_fixed_piece
import build_java_eating_projection as generator


def read(path):
    return json.loads(path.read_text())


def audit():
    bp, rp = generator.BP, generator.RP
    profiles = json.loads(re.search(r'PROFILE_BY_ITEM=Object.freeze\((\{.*?\})\)',
                                   (bp/'scripts/data.js').read_text())[1])
    admitted = generator.projection_items()
    from build_raw_one_eating_projection import ids as raw_one_ids
    admitted['ONE'] = sorted(set(admitted['ONE']) | set(raw_one_ids()))
    rows = []
    for path in sorted((bp/'items').glob('*.json')):
        item = read(path)['minecraft:item']
        identifier = item['description']['identifier']
        suffix = '_java_three_alt'
        if identifier.endswith('_native_plain'):
            canonical=identifier.removesuffix('_native_plain')
            assert canonical in profiles or canonical=='kaleidoscope_grilling:secret_skewer'
            assert item['components']['minecraft:use_modifiers']['use_duration']==1.25
            assert item['components']['minecraft:use_animation']=={'value':'eat'}
            rows.append({'item':identifier,'canonical_food_id':canonical,'requested':'VANILLA','native_ticks':25,'resolved_profile':'VANILLA','projection_admitted':False,'resolved_piece':None})
            continue
        canonical = identifier.removesuffix(suffix)
        if canonical not in profiles and canonical != 'kaleidoscope_grilling:secret_skewer':
            continue
        requested = profiles.get(canonical, 'THREE_RANDOM')
        ticks = round(item['components']['minecraft:use_modifiers']['use_duration'] * 20)
        actual = ('THREE_ALT' if identifier.endswith(suffix) else 'THREE') if requested == 'THREE_RANDOM' else requested
        assert ticks == (100 if actual == 'THREE' else 90), (identifier, actual, ticks)
        piece = available_fixed_piece(ROOT, canonical, actual) if actual in dual.PROFILES else None
        rows.append({'item': identifier, 'canonical_food_id': canonical, 'requested': requested, 'native_ticks': ticks,
                     'resolved_profile': actual, 'projection_admitted': identifier in admitted[actual],
                     'resolved_piece': piece})
    mesh_index = {}
    for path in (rp/'models').rglob('*.json'):
        for geo in read(path).get('minecraft:geometry', []):
            mesh_index[geo['description']['identifier']] = geo
    renderer = []
    for name in ('grilled_fish_skewer', 'grilled_ender_pearl_skewer', 'raw_fish_skewer', 'raw_caterpillar_skewer'):
        desc = read(rp/'attachables'/f'{name}.attachable.json')['minecraft:attachable']['description']
        main = mesh_index[desc['geometry']['stage0']]['bones'][0]
        piece = mesh_index[desc['geometry']['java_piece']]['bones'][0]
        renderer.append({'item': desc['identifier'], 'controllers': desc['render_controllers'],
                         'main_root': main, 'piece_root': piece,
                         'same_named_root_different_binding': main['name'] == piece['name'] and main['binding'] != piece['binding'],
                         'native_cross_pass_collision_proven': False})
    item_animations = read(rp/'animations/java_eating_projection.animation.json')['animations']
    player_animations = read(rp/'animations/java_eating_player.animation.json')['animations']
    late = []
    for hand in ('right', 'left'):
        helper = 'left' if hand == 'right' else 'right'
        piece = item_animations[generator.item_animation_id('ONE', hand)]['bones']['dual_piece']
        bones = player_animations[generator.player_animation_id('ONE', hand)]['bones']
        stable = all(value == values['2.75'] for channels in (piece, bones[helper+'arm'], bones[helper+'item'])
                     for values in channels.values() if isinstance(values, dict)
                     for key, value in values.items() if float(key) >= 2.75)
        assert stable
        late.append({'active_hand': hand, 'helper_channels_constant_from_seconds': 2.75,
                     'serialized_channels_stable': stable, 'piece_scale': piece['scale']})
    piece_files = list((ROOT/'projects/grilling/source_snapshots/common/src/main/resources/assets/kaleidoscope_grilling/models').rglob('*_piece_*.json'))
    return {'scope': 'source/static; no BDS or native client acceptance',
            'resolver_source_commit': SOURCE['source_commit'], 'resolver_source_sha256': SOURCE['sha256'],
            'curve_source_sha256': dual.SOURCE['sha256'], 'piece_asset_files': len(piece_files),
            'native_profile_routes': rows, 'representative_renderer_bindings': renderer,
            'one_late_helper': late,
            'duration_limitation': 'PR124 selects an owned 90/100-tick food variant before native use, preserving exposed metadata with readback; this selection still needs native acceptance. Unsupported actual ID/profile geometry remains on the existing fallback.',
            'inventory_policy': 'No detached piece ItemStack. Food variants may be prepared before use with verified exposed metadata; no variant swap while using. Bottle stacks always retain their native IDs and metadata.',
            'visual_parameters_changed': False, 'native_acceptance': False}


if __name__ == '__main__':
    print(json.dumps(audit(), ensure_ascii=False, indent=2))
