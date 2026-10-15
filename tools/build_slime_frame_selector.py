"""Generate exact 3x5 cooked-slime held states; preserve eating/pose dispatch.

Source candidate only: native world-clock/client phase validation remains pending.
"""
from copy import deepcopy
import argparse
import json
from pathlib import Path
from held_visual_channels import hand_channel, hand_owner

ROOT = Path(__file__).resolve().parents[1]
P = ROOT / 'projects/grilling'
RP = P / 'gameplay_core/resource_pack'
ATT = RP / 'attachables/grilled_slime_skewer.attachable.json'
MAIN = P / 'gameplay_core/behavior_pack/scripts/main.js'
MAIN_IMPORT = "import {readSlimeWorldFrame,syncSlimeHeld} from './slime_frame_runtime.js';\n"
MAIN_SAMPLE = ' const slimeFrame=readSlimeWorldFrame(world);\n'
MAIN_SYNC = '  syncSlimeHeld(p,slimeFrame);\n'
MAIN_LOOP = 'system.runInterval(()=>{\n for(const p of world.getAllPlayers()){try{\n'
CONTROLLER = 'controller.render.kg_slime.frame'
ID = 'kaleidoscope_grilling:grilled_slime_skewer'

def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))

def candidate(stage, frame):
    return f'slime_frame_{frame}' if stage == 0 else (f'slime_bite_{stage}' if frame == 0 else f'slime_frame_{frame}_bite_{stage}')

def frame_aliases():
    return {f'slime_s{stage}_f{frame}': f'geometry.kg_slime.stage{stage}.frame{frame}'
            for stage in range(3) for frame in range(5)}

def owned_frame_aliases(description):
    aliases = {k: v for k, v in description.get('geometry', {}).items() if k.startswith('slime_')}
    if description.get('identifier') != ID or aliases != frame_aliases():
        return False
    for stage in range(3):
        for frame in range(5):
            path = RP / f'models/entity/slime_frames/stage{stage}_frame{frame}.geo.json'
            if not path.is_file():
                return False
            rows = read(path).get('minecraft:geometry', [])
            if len(rows) != 1 or rows[0].get('description', {}).get('identifier') != aliases[f'slime_s{stage}_f{frame}']:
                return False
    return True

def strip_main(text):
    lines = (MAIN_IMPORT, MAIN_SAMPLE, MAIN_SYNC)
    counts = [text.count(line) for line in lines]
    if counts == [0, 0, 0]:
        return text
    if counts != [1, 1, 1] or not text.startswith(MAIN_IMPORT):
        raise ValueError('Slime main wrapper is incomplete or duplicated')
    if MAIN_LOOP.replace(' for(', MAIN_SAMPLE+' for(')+MAIN_SYNC not in text:
        raise ValueError('Slime main wrapper moved outside the existing player loop')
    for line in lines:
        text = text.replace(line, '', 1)
    return text

def install_main(text):
    from effect_merge_source_witness import restore_main as restore_effect, reapply_main
    restored = restore_effect(text)
    effects = restored != text
    text = strip_main(restored)
    if text.count(MAIN_LOOP) != 1:
        raise ValueError('Slime requires exactly one existing one-tick player loop')
    text = MAIN_IMPORT + text.replace(MAIN_LOOP, MAIN_LOOP.replace(' for(', MAIN_SAMPLE+' for(')+MAIN_SYNC, 1)
    return reapply_main(text) if effects else text

def augment(output):
    result = dict(output)
    result[MAIN] = install_main(result.get(MAIN, MAIN.read_text()))
    doc = deepcopy(result.get(ATT, read(ATT)))
    d = doc['minecraft:attachable']['description']
    assert d['identifier'] == ID
    specs = {s['name']: s for s in read(P / 'config/asset_specs.json')['candidates']}
    baseline = read(RP / 'models/entity/a287_hand/kg_a22.grilled_slime_skewer.stage0.geo.json')['minecraft:geometry'][0]
    geometries, textures = [], []
    for stage in range(3):
        for frame in range(5):
            name = candidate(stage, frame)
            source = read(P / f'resource_pack/models/entity/kg_a1/{name}.geo.json')['minecraft:geometry'][0]
            cubes = []
            for bone in source['bones']:
                assert bone['pivot'] == [0, 0, 0] and not any(bone.get('rotation', []))
                cubes.extend(deepcopy(bone.get('cubes', [])))
            for cube in cubes:
                cube['origin'][1] += 24
                if 'pivot' in cube:
                    cube['pivot'][1] += 24
            geo = deepcopy(baseline)
            geo['description'].update(identifier=f'geometry.kg_slime.stage{stage}.frame{frame}',
                                      texture_width=source['description']['texture_width'],
                                      texture_height=source['description']['texture_height'])
            geo['bones'][2]['cubes'] = cubes
            alias = f'slime_s{stage}_f{frame}'
            d['geometry'][alias] = geo['description']['identifier']
            atlas = specs[name]['atlas_name']
            d['textures'][alias] = f'textures/slime_frames/{atlas}'
            result[RP / f'models/entity/slime_frames/stage{stage}_frame{frame}.geo.json'] = {'format_version': '1.16.0', 'minecraft:geometry': [geo]}
            result[RP / f'textures/slime_frames/{atlas}.png'] = (P / f'resource_pack/textures/kg_a1/{atlas}.png').read_bytes()
            geometries.append('Geometry.' + alias)
            textures.append('Texture.' + alias)
    d['render_controllers'] = [CONTROLLER if r == 'controller.render.kg_a22.bite' else r for r in d['render_controllers']]
    assert d['render_controllers'].count(CONTROLLER) == 1
    rows = [r for r in d['scripts']['pre_animation'] if not r.startswith('v.kg_slime_')]
    # Owner context and exact equipment identity guard against a stale bank from
    # a bottle, plate, secret skewer, other hand or unsupported display context.
    rows += [f'v.kg_slime_marker = {hand_channel(11)};',
             f'v.kg_slime_frame = ({hand_owner(ID)} && v.kg_slime_marker >= 215 && v.kg_slime_marker <= 219) ? v.kg_slime_marker - 215 : 0;',
             'v.kg_slime_index = math.clamp(math.floor(v.kg_bite_stage), 0, 2) * 5 + v.kg_slime_frame;']
    d['scripts']['pre_animation'] = rows
    result[ATT] = doc
    result[RP / 'render_controllers/slime_frame.render_controllers.json'] = {
        'format_version': '1.8.0', 'render_controllers': {CONTROLLER: {
            'arrays': {'geometries': {'Array.kg_slime_geo': geometries}, 'textures': {'Array.kg_slime_tex': textures}},
            'geometry': 'Array.kg_slime_geo[v.kg_slime_index]',
            'materials': [{'*': 'Material.default'}],
            'textures': ['Array.kg_slime_tex[v.kg_slime_index]']}}}
    return result

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    for path, value in augment({}).items():
        data = value if isinstance(value, bytes) else (value.encode() if isinstance(value, str) else (json.dumps(value, ensure_ascii=False, indent=2)+'\n').encode())
        if args.check:
            assert path.read_bytes() == data, path
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
    print('Slime held selector: 15 exact states; native clock/client acceptance pending')

if __name__ == '__main__':
    main()
