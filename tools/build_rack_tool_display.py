#!/usr/bin/env python3
"""Author the six known rack tools from Java FIXED and original sprites.

Inputs are read only. This command writes only the rack projection assets;
it does not package, release, run checks, or operate a server.
Cookery's four knives and kitchen_shovel_no_oil inherit item/handheld, which
inherits item/generated's FIXED frame. Source: KaleidoscopeCookery commit
4d39e36cfa749939ba5f9d6d3b715ef9a984cb9c, src/generated/resources/assets/
kaleidoscope_cookery/models/item/. The shovel's oil variant has a separate ID.
"""
import argparse
from io import BytesIO
import json
import math
from pathlib import Path
import re
from zipfile import ZipFile

from PIL import Image
from compact_geometry import bank_bytes
from generated_food_sprite import main_faces, span_cubes, spans_from_alpha

ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / 'projects/grilling/gameplay_core'
BP, RP = PACK / 'behavior_pack', PACK / 'resource_pack'
NS = 'kaleidoscope_grilling:'
TOOLS = ('iron_kitchen_knife', 'gold_kitchen_knife', 'diamond_kitchen_knife',
         'netherite_kitchen_knife', 'kitchen_shovel', 'flint_and_steel')


def multiply(a, b):
    return [[sum(a[i][k] * b[k][j] for k in range(3)) for j in range(3)] for i in range(3)]


def rotation(axis, degrees):
    a = math.radians(degrees)
    c, s = math.cos(a), math.sin(a)
    result = [[float(i == j) for j in range(3)] for i in range(3)]
    i, j = {'x': (1, 2), 'y': (2, 0), 'z': (0, 1)}[axis]
    result[i][i] = result[j][j] = c
    result[i][j], result[j][i] = -s, s
    return result


def bedrock_angles(matrix):
    # Java composes X/Y/Z matrices; Bedrock bone channels apply Z*Y*X.
    # Reflect X for the entity model basis, as in the existing sprite converter.
    y = math.asin(max(-1, min(1, -matrix[2][0])))
    x = math.atan2(matrix[2][1], matrix[2][2])
    z = math.atan2(matrix[1][0], matrix[0][0])
    return [round(v, 10) for v in (-math.degrees(x), -math.degrees(y), math.degrees(z))]


def sprite(data):
    with Image.open(BytesIO(data)) as image:
        alpha = image.convert('RGBA').getchannel('A')
        width, height = image.size
        rows = [[alpha.getpixel((x, y)) for x in range(width)] for y in range(height)]
    cubes = [main_faces(), *span_cubes(spans_from_alpha(rows), width, height)]
    for cube in cubes:
        cube['origin'][1] -= 32
    return cubes


def build(grilling_java, cookery_archive, minecraft_client, branch):
    caller = (grilling_java / branch / 'src/main/java/cn/breezeth/kaleidoscope_grilling/rack/AdvancedRackRenderer.java').read_text()
    scale = float(re.search(r'pose\.scale\(([\d.]+)F,', caller)[1])
    anchor = re.search(r'pose\.translate\(HOOK_X\[hook\], ([-\d.]+)D, ([-\d.]+)D\)', caller)
    y, z = map(float, anchor.groups())
    with ZipFile(minecraft_client) as vanilla:
        fixed = json.loads(vanilla.read('assets/minecraft/models/item/generated.json'))['display']['fixed']
        flint = vanilla.read('assets/minecraft/textures/item/flint_and_steel.png')
    transform = [[float(i == j) for j in range(3)] for i in range(3)]
    for axis, degrees in re.findall(r'Axis\.([XYZ])N\.rotationDegrees\(([-\d.]+)F\)', caller):
        transform = multiply(transform, rotation(axis.lower(), -float(degrees)))
    for axis, degrees in zip('xyz', fixed.get('rotation', [0, 0, 0])):
        transform = multiply(transform, rotation(axis, degrees))

    geometries, textures, models, indices = [], {}, {}, {}
    with ZipFile(cookery_archive) as cookery:
        for index, name in enumerate(TOOLS):
            texture = 'textures/items/' + ('flint_and_steel' if index == 5 else 'kc_' + name)
            if index == 5:
                image = flint
            else:
                entry = next(n for n in cookery.namelist() if n.endswith('/' + texture + '.png'))
                image = cookery.read(entry)
            cubes = sprite(image)
            # Identical knife silhouettes share one mesh; colors stay in textures.
            existing = next((g for g in geometries if g['bones'][1]['cubes'] == cubes), None)
            if existing is None:
                existing = {'description': {'identifier': 'geometry.kg_station.rack_tool.s' + str(index),
                    'texture_width': 16, 'texture_height': 16, 'visible_bounds_width': 2,
                    'visible_bounds_height': 2, 'visible_bounds_offset': [0, 0, 0]},
                    'bones': [{'name': 'root', 'pivot': [0, 0, 0]},
                              {'name': 'sprite_basis', 'parent': 'root', 'pivot': [0, 0, 0],
                               # Original generated-item U opposes our sprite UV convention.
                               'rotation': [0, 180, 0], 'cubes': cubes}]}
                geometries.append(existing)
            alias = 's' + str(index)
            textures[alias] = texture
            models[alias] = existing['description']['identifier']
            indices[('minecraft:' if index == 5 else 'kaleidoscope_cookery:') + name] = index

    fixed_scale = fixed.get('scale', [1, 1, 1])
    translation = fixed.get('translation', [0, 0, 0])
    # generated.FIXED has no translation in either maintained publisher version.
    if any(translation):
        raise ValueError('A translated FIXED parent needs its translation composed before authoring')
    values = [scale * value for value in fixed_scale]
    pose = {'rotation': bedrock_angles(transform), 'scale': values[0] if len(set(values)) == 1 else values}
    return {
        RP / 'models/entity/rack_tool_visual.geo.json': bank_bytes({'format_version': '1.12.0'}, geometries),
        RP / 'animations/rack_tool_visual.animation.json': {'format_version': '1.8.0', 'animations': {
            'animation.kg_station.rack_tool': {'loop': True, 'bones': {'root': pose}}}},
        RP / 'entity/rack_tool_visual.entity.json': {'format_version': '1.10.0', 'minecraft:client_entity': {'description': {
            'identifier': NS + 'rack_tool_visual', 'materials': {'default': 'entity_alphatest_one_sided'},
            'textures': textures, 'geometry': models, 'animations': {'pose': 'animation.kg_station.rack_tool'},
            'scripts': {'animate': ['pose']}, 'render_controllers': [
                {'controller.render.kg_station.rack_tool': "q.property('kaleidoscope_grilling:ready')"}]}}},
        BP / 'scripts/rack_tool_visual_data.js': (
            '// Generated by tools/build_rack_tool_display.py from Java FIXED and original tool sprites.\n'
            'export const RACK_TOOL_VISUAL_TYPE=' + json.dumps(NS + 'rack_tool_visual') + ';\n'
            # Java caller is south-based; the north rack model is rotated by 180 degrees.
            'export const RACK_TOOL_VISUAL_Y=' + str(y) + ';\n'
            'export const RACK_TOOL_VISUAL_Z=' + str(-z) + ';\n'
            'export const RACK_TOOL_MODEL_INDEX=Object.freeze(' + json.dumps(indices, separators=(',', ':')) + ');\n'
            'export function rackToolVisualModel(typeId){return Object.hasOwn(RACK_TOOL_MODEL_INDEX,typeId)?RACK_TOOL_MODEL_INDEX[typeId]:undefined;}\n')
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--grilling-java', type=Path, required=True)
    parser.add_argument('--cookery-archive', type=Path, required=True)
    parser.add_argument('--minecraft-client', type=Path, required=True)
    parser.add_argument('--branch', choices=['forge-1.20.1', 'neoforge-1.21.1'], required=True)
    args = parser.parse_args()
    for path, value in build(args.grilling_java, args.cookery_archive, args.minecraft_client, args.branch).items():
        if isinstance(value, bytes):
            path.write_bytes(value)
        else:
            path.write_text(value if isinstance(value, str) else json.dumps(value, ensure_ascii=False, indent=2) + '\n')
        print(path.relative_to(ROOT))


if __name__ == '__main__':
    main()
