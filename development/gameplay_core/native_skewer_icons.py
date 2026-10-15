"""Native animated inventory sprites, using Tavern's reviewed item-visual route.

Authoring only: --write updates canonical sources; neither packaging nor install
runs a gameplay transformer. --check is read-only. No per-tick item replacement,
HUD overlay, inventory polling or new food IDs are used.

Sprite shell conversion is adapted from casama233/kaleidoscope-tavern-unofficial
/tools/animated_item_render_contract.py, blob 6abe52081363b5f6964a4d3e20ef0e7092a89ea1
(BSD-3-Clause; see docs/licenses/tavern-native-item-rendering.txt).
Java GUI authority: breezeth-CN/KaleidoscopeGrilling @ 9a1acdab27698457bec16c9362678e574895a28c,
SkewerGuiIconCache.fixedIcon/failedIcon: five GUI frames, gameTime / 4 % 5.
This is not a per-stack custom-skewer compositor or rendered-client acceptance.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import io
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
PROJECT = Path('projects/grilling/gameplay_core')
NS = 'kaleidoscope_grilling:'
SOURCES = {
    'grilled_slime_skewer': ('grilled_slime_skewer_cooked', (
        '9ca49b428d49c498d50f23e2937ca357016ff66b',
        'afcf81f4d5464d4154a7f1852c62405ad43f4d02',
        'bc2235432a8e26feb833d0e3a879196b786bf310',
        '9ca49b428d49c498d50f23e2937ca357016ff66b',
        '9154e3d3487276f83f55f6efba1322051bc30d76')),
    'mysterious_skewer': ('mysterious_skewer', (
        'bec4837ffa879d4e98ff30632beda7d96ebdada8',
        '54893372a39f472b28f32fff194604f403451929',
        '9d775d6a186e0b1185bea8a375ca8ec2c48c8673',
        '8e7da42549eaad41e8a08d730594d841d8f2f5e2',
        'a092a7af914d3444d539f7c433c293c51f315174')),
}
CONTEXTS = ('gui', 'ground', 'fixed', 'head', 'firstperson_righthand',
            'firstperson_lefthand', 'thirdperson_righthand', 'thirdperson_lefthand')
# Same generated-sprite fallback poses used by the Tavern route. Existing
# Grilling attachables and player/eating clips remain untouched and authoritative.
FALLBACK_DISPLAY = {
    'ground': {'translation': [0, 2, 0], 'scale': [.5, .5, .5]},
    'head': {'rotation': [0, 180, 0], 'translation': [0, 13, 7]},
    'fixed': {'rotation': [0, 180, 0]},
    'thirdperson_righthand': {'translation': [0, 3, 1], 'scale': [.55, .55, .55]},
    'firstperson_righthand': {'rotation': [0, -90, 25],
                            'translation': [1.13, 3.2, 1.13], 'scale': [.68, .68, .68]},
}


def read(path: Path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def encode(value) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode('utf-8')


def source_frames(rp: Path, name: str) -> list[Image.Image]:
    stem, hashes = SOURCES[name]
    frames = []
    for index, expected in enumerate(hashes):
        data = (rp / f'textures/ui/kg_java/{stem}_frame_{index}.png').read_bytes()
        actual = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
        if actual != expected:
            raise ValueError(f'{stem} frame {index}: original Java source changed')
        with Image.open(io.BytesIO(data)) as image:
            frame = image.convert('RGBA')
        if frame.size != (16, 16):
            raise ValueError(f'{stem} frame {index}: expected original 16x16 pixels')
        frames.append(frame)
    return frames


def spans(frames):
    # Merge each frame's visible boundary, NOT the alpha union. Later frames
    # reveal edges that are interior to the union. This is Tavern's reviewed fix.
    result = {}
    for frame in frames:
        alpha = frame.getchannel('A'); width, height = frame.size
        for y in range(height):
            for x in range(width):
                if not alpha.getpixel((x, y)):
                    continue
                for facing, dx, dy in [('up', 0, -1), ('down', 0, 1),
                                       ('east', -1, 0), ('west', 1, 0)]:
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < width and 0 <= ny < height and alpha.getpixel((nx, ny)):
                        continue
                    anchor, value = (y, x) if dy else (x, y)
                    key = (facing, anchor)
                    low, high = result.get(key, (value, value))
                    result[key] = (min(low, value), max(high, value))
    return result


def face(uv, vertical=False):
    u1, v1, u2, v2 = uv
    return {'uv': [u2, v2] if vertical else [u1, v1],
            'uv_size': [u1-u2, v1-v2] if vertical else [u2-u1, v2-v1]}


def geometry(name, frames):
    cubes = [{'origin': [-8, 0, -.5], 'size': [16, 16, 1],
              'uv': {'north': face([16, 0, 0, 16]), 'south': face([0, 0, 16, 16])}}]
    for (direction, anchor), (low, high) in spans(frames).items():
        if direction in ('up', 'down'):
            origin = [low-8, 16-anchor-(direction == 'down'), -.5]
            size = [high-low+1, 0, 1]; uv = [low, anchor, high+1, anchor+1]
        else:
            origin = [anchor+(direction == 'west')-8, 15-high, -.5]
            size = [0, high-low+1, 1]; uv = [anchor, low, anchor+1, high+1]
        surface = face(uv, direction in ('up', 'down'))
        if direction == 'up':
            surface['uv'][0] += surface['uv_size'][0]
            surface['uv_size'][0] *= -1
        facing = {'east': 'west', 'west': 'east'}.get(direction, direction)
        cubes.append({'origin': origin, 'size': size, 'uv': {facing: surface}})
    transforms = {}
    for context in CONTEXTS:
        pose = FALLBACK_DISPLAY.get(context, FALLBACK_DISPLAY.get(
            context.replace('_lefthand', '_righthand'), {}) if context.endswith('_lefthand') else {})
        transforms[context] = {key: copy.deepcopy(pose.get(key, default)) for key, default in
                               [('rotation', [0, 0, 0]), ('translation', [0, 0, 0]), ('scale', [1, 1, 1])]}
    transforms['gui']['fit_to_frame'] = False
    return {'format_version': '1.21.0', 'minecraft:geometry': [{
        'description': {'identifier': f'geometry.kg_native_icon.{name}',
                        'texture_width': 16, 'texture_height': 16,
                        'visible_bounds_width': 2, 'visible_bounds_height': 2,
                        'visible_bounds_offset': [0, .5, 0]},
        'bones': [{'name': 'root', 'pivot': [0, 8, 0], 'cubes': cubes}],
        'item_display_transforms': transforms}]}


def planned(root: Path):
    bp = root / PROJECT / 'behavior_pack'; rp = root / PROJECT / 'resource_pack'
    terrain = read(rp / 'textures/terrain_texture.json')
    flipbooks = read(rp / 'textures/flipbook_textures.json')
    result = {}; routed = []
    for name, (stem, _) in SOURCES.items():
        frames = source_frames(rp, name)
        sheet = Image.new('RGBA', (16, 80))
        for index, frame in enumerate(frames):
            sheet.paste(frame, (0, index*16))
        stream = io.BytesIO(); sheet.save(stream, format='PNG')
        result[rp / f'textures/native_skewer_icons/{name}.png'] = stream.getvalue()
        geo = geometry(name, frames)
        result[rp / f'models/entity/native_skewer_icon_{name}.geo.json'] = encode(geo)
        block_id = NS + 'item_visual_' + name
        tile = 'kg_native_icon_' + name
        visual = {
            'geometry': {'identifier': geo['minecraft:geometry'][0]['description']['identifier']},
            'material_instances': {'*': {'texture': tile, 'render_method': 'alpha_test_single_sided',
                                         'ambient_occlusion': 0.0, 'face_dimming': False}}}
        result[bp / f'blocks/item_visual_{name}.json'] = encode({
            'format_version': '1.26.50', 'minecraft:block': {
                'description': {'identifier': block_id},
                'components': {
                    'minecraft:geometry': copy.deepcopy(visual['geometry']),
                    'minecraft:material_instances': copy.deepcopy(visual['material_instances']),
                    'minecraft:collision_box': False, 'minecraft:selection_box': False,
                    'minecraft:light_dampening': 0,
                    'minecraft:loot': 'loot_tables/native_item_visual_empty.json',
                    'minecraft:item_visual': visual}}})
        # Food-tag discovery also covers native_plain and java_three_alt routes,
        # without changing their IDs, callbacks, durations, stacks or saved data.
        found = []
        for path in sorted((bp / 'items').glob('*.json')):
            item = read(path); components = item['minecraft:item']['components']
            tags = components.get('minecraft:tags', {}).get('tags', [])
            if NS + 'food_' + name not in tags:
                continue
            placer = {'block': block_id, 'use_on': [{'tags': '0'}]}
            if 'minecraft:block_placer' in components and components['minecraft:block_placer'] != placer:
                raise ValueError(f'{path.name}: refusing to replace another placement contract')
            components.pop('minecraft:icon', None)
            components['minecraft:block_placer'] = placer
            result[path] = encode(item); found.append(path.name)
        if not found:
            raise ValueError(f'No existing food items found for {name}')
        routed.extend(found)
        terrain['texture_data'][tile] = {'textures': f'textures/ui/kg_java/{stem}_frame_0'}
        row = {'flipbook_texture': f'textures/native_skewer_icons/{name}', 'atlas_tile': tile,
               'ticks_per_frame': 4, 'frames': [0, 1, 2, 3, 4], 'blend_frames': False}
        indices = [i for i, value in enumerate(flipbooks) if value.get('atlas_tile') == tile]
        if len(indices) > 1:
            raise ValueError(f'Duplicate native flipbook: {tile}')
        if indices:
            flipbooks[indices[0]] = row
        else:
            flipbooks.append(row)
    result[bp / 'loot_tables/native_item_visual_empty.json'] = encode({'pools': []})
    result[rp / 'textures/terrain_texture.json'] = encode(terrain)
    result[rp / 'textures/flipbook_textures.json'] = encode(flipbooks)
    return result, routed


def check_or_write(root: Path, write=False):
    result, routed = planned(root); errors = []
    for path, expected in result.items():
        same = False
        if path.exists():
            if path.suffix == '.png':
                with Image.open(path) as a, Image.open(io.BytesIO(expected)) as b:
                    same = a.size == b.size and a.convert('RGBA').tobytes() == b.convert('RGBA').tobytes()
            else:
                same = read(path) == json.loads(expected)
        if not same:
            if write:
                path.parent.mkdir(parents=True, exist_ok=True); path.write_bytes(expected)
            else:
                errors.append(path.relative_to(root).as_posix())
    if errors:
        raise ValueError('Native animated skewer source drift:\n' + '\n'.join(errors))
    return routed


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(); mode.add_argument('--write', action='store_true')
    mode.add_argument('--check', action='store_true')
    parser.add_argument('--root', type=Path, default=ROOT)
    args = parser.parse_args()
    routed = check_or_write(args.root.resolve(), args.write)
    print('Native animated GUI routes:', ', '.join(routed))
    print('Source/pixels only; Minecraft placement/use/rendering acceptance remains pending.')

