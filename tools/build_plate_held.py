"""Generate held plates from current meshes/palettes and Java 1.1.1 frames.

The item's renderer retains FIXED's Z -180 rotation. The placed renderer's
additional Z +180 cancellation is deliberately absent. These files project
five saved rows through the existing hand rig; they do not alter plate storage,
item identity, inventory icons, player geometry or authoritative interactions.
Reference and coordinate checks are separate from native/client acceptance.
"""
from copy import deepcopy
from pathlib import Path
import argparse
import hashlib
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
PROJECT = ROOT / 'projects/grilling/gameplay_core'
RP, BP = PROJECT / 'resource_pack', PROJECT / 'behavior_pack'
sys.path.insert(0, str(ROOT / 'development/gameplay_core'))
from held_pose_frames import (chain, translate, xyz, rotate, scale, mul,
                             rigid_inverse, point, bedrock_rotation, native_skewer_calibration)
from secret_skewer_assets import COMPLETE_STATES, state_slot_cubes, shaft_cubes, palette_refs
from plate_special_models import catalog, lifted_cubes, geometry_key, HELD_START
from held_visual_channels import (WORD_A_MAX, WORD_B_MAX, PLATE, hand_channel,
                                  hand_owner, verify_server_constants, FOOD_COUNT, SECRET_VISUAL_MAX)

NS = 'kaleidoscope_grilling:'
SOURCE_PIN = '9a1acdab27698457bec16c9362678e574895a28c'
SOURCE_FILES = {
    'common/src/main/resources/assets/kaleidoscope_grilling/models/item/skewer_plate.json':
        '02f7e718b4c4e3b1a71e27c6ece5e297126a7ad08259fc783e9442402c85aba8',
    'neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/skewer/SkewerPlateItemRenderer.java':
        '15019243a15415dae465d56ccb480f4a0c34168f39b705fb24a5b166fd7ed5a9',
    'neoforge-1.21.1/src/main/java/cn/breezeth/kaleidoscope_grilling/skewer/SkewerPlateRenderer.java':
        '81afc858b3eb2d347af3ba9c228178519931d1091c17eb2b884df721be426f93',
}
PLATE_DISPLAY = {
    'thirdperson_righthand': {'rotation': [-119.08, -36.32, -178.63], 'translation': [0, 3.25, 2], 'scale': [.375]*3},
    'thirdperson_lefthand': {'rotation': [-119.08, -36.32, -178.63], 'translation': [0, 3.25, 2], 'scale': [.375]*3},
    'firstperson_righthand': {'rotation': [0, -135, 0], 'translation': [0, 3.75, 0], 'scale': [.4]*3},
    'firstperson_lefthand': {'rotation': [0, -135, 0], 'translation': [0, 3.75, 0], 'scale': [.4]*3},
}
# This is the already established canonical grip coordinate basis, not a new
# visual offset. The inverse hand matrix removes it when deriving the pose.
HAND_PIVOT = [0, 24, 0]
BINDING = 'q.item_slot_to_bone_name(context.item_slot)'


def dump(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode()


def layouts():
    source = (BP / 'scripts/plate_recipe_visual_core.js').read_text()
    literal = source.split('export const PLATE_LAYOUTS=Object.freeze(', 1)[1].split('.map(rows=>', 1)[0]
    return json.loads(literal)


def verify_java_source(source_root):
    for relative, digest in SOURCE_FILES.items():
        assert hashlib.sha256((source_root / relative).read_bytes()).hexdigest() == digest, relative
    doc = json.loads((source_root / next(iter(SOURCE_FILES))).read_text())
    assert {key: doc['display'][key] for key in PLATE_DISPLAY} == PLATE_DISPLAY
    renderer = (source_root / list(SOURCE_FILES)[1]).read_text()
    assert 'Axis.ZP' not in renderer
    assert 'Axis.YP.rotationDegrees(slot[3])' in renderer and 'Axis.XP.rotationDegrees(90F)' in renderer
    source = (source_root / list(SOURCE_FILES)[2]).read_text()
    values = re.findall(r'(-?\d+(?:\.\d+)?)F', source.split('LAYOUTS = {', 1)[1].split('\n  };', 1)[0])
    assert list(map(float, values)) == [v for rows in layouts() for row in rows for v in row]


def plate_pose(view, hand):
    """Translate the current pinned native hand basis into Java's item frame."""
    pose = PLATE_DISPLAY[('firstperson_' if view == 'fp' else 'thirdperson_') + hand + 'hand']
    sign = 1 if hand == 'right' else -1
    r = pose['rotation']; r = [r[0], r[1]*sign, r[2]*sign]
    tr = pose['translation']; tr = [tr[0]*sign, tr[1], tr[2]]
    size = pose['scale']; source_offset = [8, -HAND_PIVOT[1], 8]
    if view == 'tp':
        arm = rotate('x', 15)
        base = chain(translate([5*sign, 22, 0]), arm, translate([sign, -31, 1]))
        target = chain(translate([6*sign, 22, 0]), arm, translate([0, -10, -2]),
                       rotate('x', -90), translate(tr), xyz(r), scale(size),
                       translate([-8, -8, -8]), translate(source_offset))
        local = mul(rigid_inverse(base), target)
    else:
        base, camera = native_skewer_calibration(hand)
        java = chain(translate([9.039*sign, 15.682, 20.8]), translate(tr), xyz(r),
                     scale(size), translate([-8, -8, -8]))
        target = chain(camera, translate([0, -24, -32.4]), java, translate(source_offset))
        local = mul(rigid_inverse(base), target)
    position = point(local, HAND_PIVOT); position[1] -= HAND_PIVOT[1]; position[0] *= -1
    rotation = mul(local, scale([1/x for x in size]))
    return {'position': [round(v, 8) for v in position],
            'rotation': [round(v, 8) for v in bedrock_rotation(rotation)], 'scale': size}


def select_count(values):
    expression = str(values[-1])
    for count in reversed(range(len(values)-1)):
        expression = f'v.kg_plate_count == {count} ? {values[count]} : ' + expression
    return expression


def animations():
    clips = {f'animation.kg_plate_held.{view}_{hand}': {'loop': True,
             'bones': {'plate_pose': plate_pose(view, hand)}}
             for view in ('fp', 'tp') for hand in ('right', 'left')}
    bones = {}; slots = layouts()
    for row in range(5):
        cells = [slots[count][row] if row < count else [8, 0, 8, 0] for count in range(6)]
        bones[f'plate_slot_{row}'] = {
            'position': [select_count([8-cell[0] for cell in cells]),
                         select_count([cell[1] for cell in cells]),
                         select_count([cell[2]-8 for cell in cells])],
            'rotation': [0, select_count([-cell[3] for cell in cells]), 0],
        }
        # Ry(slot) Rx90 S.8 T(0,2.25,9.75) Rx-90 Rz-180 S1.5
        # T(-8,-8,-8). Source cubes center X/Z already. The remaining local
        # transform is Rz-180 S1.2 + (0,1.8,1.8), unlike the placed renderer.
        bones[f'plate_fixed_{row}'] = {'position': [0, 1.8, 1.8],
                                     'rotation': [0, 0, -180], 'scale': 1.2}
    clips['animation.kg_plate_held.layout'] = {'loop': True, 'bones': bones}
    return {'format_version': '1.8.0', 'animations': clips}


def geometry(alias, cubes, width=16, height=16, row=None):
    bones = [{'name': 'grip', 'pivot': HAND_PIVOT, 'binding': BINDING},
             {'name': 'plate_pose', 'parent': 'grip', 'pivot': HAND_PIVOT}]
    if row is None:
        bone = {'name': 'plate_body', 'parent': 'plate_pose', 'pivot': HAND_PIVOT}
    else:
        bones += [{'name': f'plate_slot_{row}', 'parent': 'plate_pose', 'pivot': HAND_PIVOT},
                  {'name': f'plate_fixed_{row}', 'parent': f'plate_slot_{row}', 'pivot': HAND_PIVOT}]
        bone = {'name': f'plate_row_{row}', 'parent': f'plate_fixed_{row}', 'pivot': HAND_PIVOT}
    if cubes: bone['cubes'] = deepcopy(cubes)
    bones.append(bone)
    return {'description': {'identifier': 'geometry.kg_plate_held.' + alias,
            'texture_width': width, 'texture_height': height, 'visible_bounds_width': 4,
            'visible_bounds_height': 4, 'visible_bounds_offset': [0, 1.5, 0]}, 'bones': bones}


def lift_cubes(source, amount):
    result = []
    for bone in source['bones']:
        assert not bone.get('rotation') and not bone.get('position') and not bone.get('scale'), 'Unreviewed source bone transform'
        for original in bone.get('cubes', []):
            cube = deepcopy(original); cube['origin'][1] += amount
            if 'pivot' in cube: cube['pivot'][1] += amount
            result.append(cube)
    return result


def decoder_scripts():
    initialize = []; pre = []
    def variable(name, expression):
        initialize.append(name + ' = 0;'); pre.append(name + ' = ' + expression + ';')
    variable('v.kg_plate_item_owner', hand_owner(NS + 'skewer_plate'))
    variable('v.kg_plate_owner', f'v.kg_plate_item_owner && {hand_channel(11)} == {PLATE}')
    variable('v.kg_plate_count', hand_channel(10))
    pre.append('v.kg_plate_owner = v.kg_plate_owner && v.kg_plate_count >= 0 && v.kg_plate_count <= 5 && v.kg_plate_count == math.floor(v.kg_plate_count);')
    pre.append('v.kg_plate_count = v.kg_plate_owner ? v.kg_plate_count : 0;')
    for row in range(5):
        a, b = f'v.kg_plate_a_{row}', f'v.kg_plate_b_{row}'
        variable(a, hand_channel(row*2)); variable(b, hand_channel(row*2+1))
        valid = f'{a} >= 0 && {a} <= {WORD_A_MAX} && {a} == math.floor({a})'
        valid += f' && {b} >= 0 && {b} <= {WORD_B_MAX} && {b} == math.floor({b})'
        expressions = [f'{a} - math.floor({a}/8192)*8192',
                       f'math.floor({a}/8192) + (({b}-1) - math.floor(({b}-1)/128)*128)*64',
                       f'math.floor(({b}-1)/128)']
        shape_vars = []
        for slot, expression in enumerate(expressions):
            cell = f'v.kg_plate_cell_{row}_{slot}'; variable(cell, f'{b} > 0 ? {expression} : 0')
            food, shape, style = [f'v.kg_plate_{field}_{row}_{slot}' for field in ('food', 'shape', 'style')]
            variable(food, f'{cell} - math.floor({cell}/256)*256')
            code = f'v.kg_plate_shape_style_{row}_{slot}'; variable(code, f'math.floor({cell}/256)')
            # The old radix3 style quotient is not needed. This small lookup
            # uses only exact integer comparisons, even at a style boundary.
            variable(shape, '(' + ' || '.join(f'{code} == {n}' for n in range(1, 21, 3)) + ') ? 2 : (' +
                     ' || '.join(f'{code} == {n}' for n in range(2, 21, 3)) + ') ? 3 : 1')
            variable(style, ' : '.join(f'{code} >= {s*3} ? {s}' for s in reversed(range(1, 7))) + ' : 0')
            valid += f' && ({b} == 0 || ({cell} >= 0 && {cell} <= {SECRET_VISUAL_MAX} && {food} <= {FOOD_COUNT}))'
            shape_vars.append(shape)
        variable(f'v.kg_plate_state_{row}', f'{shape_vars[0]}*16 + {shape_vars[1]}*4 + {shape_vars[2]}')
        variable(f'v.kg_plate_visible_{row}', f'v.kg_plate_owner && v.kg_plate_count > {row} && {valid} && ({b} > 0 || {a} < {HELD_START + len(catalog()[0])})')
    return {'initialize': initialize, 'pre_animation': pre,
            'animate': [{key: "c.is_first_person == " + str(int(key.startswith('fp'))) +
                         " && c.item_slot == '" + ('main_hand' if key.endswith('right') else 'off_hand') + "'"}
                        for key in ('fp_right', 'fp_left', 'tp_right', 'tp_left')] + ['layout']}


def build():
    verify_server_constants()
    client = json.loads((RP / 'entity/grill_food_visual.entity.json').read_text())['minecraft:client_entity']['description']
    sources = {g['description']['identifier']: g for g in json.loads((RP / 'models/entity/grill_display.geo.json').read_text())['minecraft:geometry']}
    index = json.loads(re.search(r'GRILL_MODEL_INDEX=Object.freeze\((\{.*\})\)', (BP / 'scripts/grill_visual_data.js').read_text()).group(1))
    assert len(index) == 19 and sorted(index.values()) == list(range(19))
    ordered = sorted(index, key=index.get)
    body = json.loads((RP / 'models/blocks/skewer_plate.geo.json').read_text())['minecraft:geometry'][0]
    geometries = [geometry('body', lift_cubes(body, HAND_PIVOT[1]), body['description']['texture_width'], body['description']['texture_height'])]
    textures = {'body': 'textures/blocks/skewer_plate', 'stick': 'textures/secret_skewer_stick', **palette_refs(FOOD_COUNT)}
    controllers = {'controller.render.kg_plate_held.body': {'geometry': 'Geometry.body',
        'materials': [{'*': 'Material.default'}], 'textures': ['Texture.body'],
        'part_visibility': [{'*': 0}, {'plate_body': 'v.kg_plate_item_owner == 1'}]}}
    routes = ['controller.render.kg_plate_held.body']
    for row in range(5):
        empty = f'empty_{row}'; geometries.append(geometry(empty, [], row=row))
        models, fixed_textures = ['Geometry.' + empty], ['Texture.stick']
        for name in ordered:
            slot = index[name]; source = sources[client['geometry']['s' + str(slot*6)]]
            alias = f'fixed_{row}_{slot}'
            # Canonical grill cells have sourceY-1. Undo only that existing
            # translation, then express the same cells in the hand basis.
            geometries.append(geometry(alias, lift_cubes(source, 1 + HAND_PIVOT[1]),
                                       source['description']['texture_width'], source['description']['texture_height'], row=row))
            for stage in (0, 4):
                texture = f'fixed_{slot}_{stage}'
                textures[texture] = client['textures']['s' + str(slot*6 + stage)]
                models.append('Geometry.' + alias); fixed_textures.append('Texture.' + texture)
        ordinary = json.loads((RP / 'models/entity/a22_bites/ordinary_skewer_stage0.geo.json').read_text())['minecraft:geometry'][0]
        alias = f'ordinary_{row}'; geometries.append(geometry(alias, lift_cubes(ordinary, HAND_PIVOT[1]),
                     ordinary['description']['texture_width'], ordinary['description']['texture_height'], row=row))
        textures['ordinary'] = 'textures/a22_bites/ordinary_skewer_stage0'
        models.append('Geometry.' + alias); fixed_textures.append('Texture.ordinary')
        # Exact cube/UV equality, separately from texture selection. Reuse
        # current fixed meshes and dark/mysterious shared shapes per row.
        shared = {geometry_key(g): g['description']['identifier'].rsplit('.', 1)[1]
                  for g in geometries if g['bones'][-1]['name'] == f'plate_row_{row}'}
        for special in catalog()[0]:
            alias = f'special_{row}_{special["name"]}'
            source = special['geometry']['description']
            candidate = geometry(alias, lifted_cubes(special), source['texture_width'], source['texture_height'], row=row)
            key = geometry_key(candidate)
            if key in shared:
                alias = shared[key]
            else:
                geometries.append(candidate); shared[key] = alias
            texture = 'special_' + special['name']
            textures[texture] = special['texture']
            models.append('Geometry.' + alias); fixed_textures.append('Texture.' + texture)
        fixed_limit = len(models)
        visible, a, b = f'v.kg_plate_visible_{row}', f'v.kg_plate_a_{row}', f'v.kg_plate_b_{row}'
        def controller(alias, model, texture, condition, arrays=None):
            identifier = 'controller.render.kg_plate_held.' + alias
            value = {'geometry': model, 'materials': [{'*': 'Material.default'}], 'textures': [texture],
                     'part_visibility': [{'*': 0}, {f'plate_row_{row}': visible + ' && ' + condition}]}
            if arrays: value['arrays'] = arrays
            controllers[identifier] = value
            routes.append({identifier: visible + ' && ' + condition})
        controller(f'fixed_{row}', f'Array.models[{b} == 0 && {a} < {fixed_limit} ? {a} : 0]',
                   f'Array.items[{b} == 0 && {a} < {fixed_limit} ? {a} : 0]', f'{b} == 0 && {a} > 0',
                   {'geometries': {'Array.models': models}, 'textures': {'Array.items': fixed_textures}})
        shaft = f'shaft_{row}'; geometries.append(geometry(shaft, shaft_cubes(True), row=row))
        controller(shaft, 'Geometry.' + shaft, 'Texture.stick', f'{b} > 0')
        for slot in range(3):
            references = ['Geometry.' + empty for _ in range(64)]
            for state in COMPLETE_STATES:
                alias = f'secret_{row}_{state}_{slot}'; references[state] = 'Geometry.' + alias
                geometries.append(geometry(alias, state_slot_cubes(state, slot, True), 256, 96, row=row))
            food, style = f'v.kg_plate_food_{row}_{slot}', f'v.kg_plate_style_{row}_{slot}'
            controller(f'secret_{row}_{slot}', 'Array.states[v.kg_plate_state_' + str(row) + ']',
                       f'Array.palette[{food} + {style}*{FOOD_COUNT+1}]', f'{b} > 0 && {food} > 0',
                       {'geometries': {'Array.states': references}, 'textures': {'Array.palette':
                        [f'Texture.food_{i}_s{style}' for style in range(7) for i in range(FOOD_COUNT+1)]}})
    references = {g['description']['identifier'].rsplit('.', 1)[1]: g['description']['identifier'] for g in geometries}
    attach = {'format_version': '1.26.0', 'minecraft:attachable': {'description': {
        'identifier': NS + 'skewer_plate', 'materials': {'default': 'entity_alphatest_one_sided'},
        'textures': textures, 'geometry': references, 'scripts': decoder_scripts(),
        'animations': {key: 'animation.kg_plate_held.' + key for key in ('fp_right', 'fp_left', 'tp_right', 'tp_left', 'layout')},
        'render_controllers': routes}}}
    compact = ('{"format_version":"1.21.0","minecraft:geometry":[\n' +
               ',\n'.join(json.dumps(g, separators=(',', ':')) for g in geometries) + '\n]}\n').encode()
    return {RP / 'models/entity/plate_held.geo.json': compact,
            RP / 'attachables/skewer_plate.attachable.json': dump(attach),
            RP / 'animations/plate_held.animation.json': dump(animations()),
            RP / 'render_controllers/plate_held.render_controllers.json': dump({'format_version': '1.8.0', 'render_controllers': controllers})}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true'); parser.add_argument('--java-source', type=Path)
    args = parser.parse_args()
    if args.java_source: verify_java_source(args.java_source)
    output = build()
    for path, data in output.items():
        if args.check: assert path.read_bytes() == data, 'Held plate source drift: ' + str(path.relative_to(ROOT))
        else: path.parent.mkdir(parents=True, exist_ok=True); path.write_bytes(data)
    print(f'held plate source {"check" if args.check else "build"}: {len(output)} assets; native/client rendering not simulated')


if __name__ == '__main__': main()
