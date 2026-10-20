"""Rack-only generated sprites, from reviewed source facts and external textures.

No native held-item matrix is guessed. The two Bedrock native item/tool classes
are bypassed only for the six known rack items. Generic tagged items retain the
native fallback. This authoring tool never runs during packaging/deployment.
"""
from copy import deepcopy
import argparse
import hashlib
import json
from pathlib import Path
import sys
import subprocess
from generated_food_sprite import main_faces, span_cubes, spans_from_alpha

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'development/gameplay_core'))
from held_pose_frames import chain, rotate, scale, point, bedrock_rotation
FIXTURE = ROOT / 'development/gameplay_core/fixtures/rack-tool-display.json'
FIT_REPORT = ROOT / 'artifacts/rack-tool-display-fit.json'
PROJECT = ROOT / 'projects/grilling/gameplay_core'
BP, RP = PROJECT / 'behavior_pack', PROJECT / 'resource_pack'
NS = 'kaleidoscope_grilling:'
ENTITY = NS + 'rack_tool_visual'


def dump(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode()


def alpha_rows(row):
    rows = [[255 if int(hexrow, 16) & (1 << (15 - x)) else 0 for x in range(16)] for hexrow in row['alpha_rows_hex']]
    assert len(rows) == 16
    assert hashlib.sha256(bytes(v for line in rows for v in line)).hexdigest() == row['alpha_sha256']
    return rows


def fixed_display(proof, name):
    """Resolve the reviewed generated/handheld inheritance, including shovel override."""
    if name == 'minecraft:flint_and_steel':
        current = proof['vanilla_java']['models']['flint_and_steel']['model']
    else:
        key = name.split(':')[1]
        # Bedrock no-oil and oiled shovels are distinct item identifiers. This
        # projection only matches the six canonical IDs accepted by the rack.
        if key == 'kitchen_shovel':
            key = 'kitchen_shovel_no_oil'
        models = {Path(r['path']).stem: r['data'] for r in proof['cookery_java']['models']}
        current = models[key]
    seen = set()
    while 'fixed' not in current.get('display', {}):
        parent = current['parent'].split(':')[-1].removeprefix('item/')
        assert parent in ('handheld', 'generated') and parent not in seen
        seen.add(parent)
        current = proof['vanilla_java']['models'][parent]['model']
    return current['display']['fixed']


def layout_contract():
    module = (BP / 'scripts/advanced_rack_layout.js').as_uri()
    return json.loads(subprocess.check_output(['node', '--input-type=module', '-e',
        f"import {{RACK_HALF_WIDTH,RACK_TOOL_X,RACK_TOOL_ROW_MIN,RACK_ROW_BOUNDARY,RACK_TOOL_VISUAL_Y,RACK_TOOL_VISUAL_GAP}} from '{module}';"
        "process.stdout.write(JSON.stringify({cellWidth:2*RACK_HALF_WIDTH/RACK_TOOL_X.length,rowMin:RACK_TOOL_ROW_MIN,rowMax:RACK_ROW_BOUNDARY,centerY:RACK_TOOL_VISUAL_Y,gap:RACK_TOOL_VISUAL_GAP}));"], text=True))


def fit_item(row, target, layout):
    # Actual opaque texel corners, including the generated one-pixel depth.
    points = [point(target, [u-8, 8-v, z]) for y, line in enumerate(alpha_rows(row))
              for x, alpha in enumerate(line) if alpha for u in (x, x+1)
              for v in (y, y+1) for z in (-.5, .5)]
    bounds = [[min(p[i] for p in points), max(p[i] for p in points)] for i in range(3)]
    center = [(lo+hi)/2 for lo, hi in bounds]
    fit = min(1, (layout['cellWidth']-layout['gap'])*16/(bounds[0][1]-bounds[0][0]),
              (layout['rowMax']-layout['rowMin']-layout['gap'])*16/(bounds[1][1]-bounds[1][0]))
    return {'id': row['id'], 'uniform_fit': fit, 'source_bounds_pixels': bounds,
            'center_pixels': center, 'fitted_size_blocks': [(hi-lo)*fit/16 for lo, hi in bounds]}


def select(values):
    # Explicit model-only expression: no extra client state or engine item basis.
    out = str(round(values[-1], 10))
    for index in reversed(range(len(values)-1)):
        out = f"q.property('{NS}model') == {index} ? {round(values[index], 10)} : " + out
    return out


def build():
    proof = json.loads(FIXTURE.read_text())
    source = proof['grilling_java']
    assert len(proof['items']) == 6
    fixed = [fixed_display(proof, row['id']) for row in proof['items']]
    assert all(value == {'rotation': [0, 180, 0], 'scale': [1, 1, 1]} for value in fixed)
    target = chain(*(rotate(r['axis'], r['degrees']) for r in source['rotation_chain']), rotate('y', 180))
    layout = layout_contract()
    fits = [fit_item(row, chain(scale([source['scale']]*3), target), layout) for row in proof['items']]
    geometries, textures, ids = [], {}, {}
    for index, row in enumerate(proof['items']):
        cubes = [main_faces(), *span_cubes(spans_from_alpha(alpha_rows(row)), 16, 16)]
        # Reuse the audited generated-sprite UV convention, centered at the
        # rack anchor. Its U axis opposes Java's generated-item U axis. The
        # explicit 180-degree Y basis change below corrects U and swaps the
        # equivalent front/back planes before applying Java FIXED.
        for cube in cubes:
            cube['origin'][1] -= 32
        alias = 's' + str(index)
        identifier = 'geometry.kg_station.rack_tool.' + alias
        geometries.append({'description': {'identifier': identifier, 'texture_width': 16, 'texture_height': 16,
                            'visible_bounds_width': 2, 'visible_bounds_height': 2, 'visible_bounds_offset': [0, 0, 0]},
                           'bones': [{'name': 'root', 'pivot': [0, 0, 0]},
                                     {'name': 'sprite_basis', 'parent': 'root', 'pivot': [0, 0, 0],
                                      'rotation': [0, 180, 0], 'cubes': cubes}]})
        textures[alias] = row['texture']
        ids[row['id']] = index
    prop = lambda name: "q.property('" + NS + name + "')"
    output = {
        RP / 'models/entity/rack_tool_visual.geo.json': dump({'format_version': '1.12.0', 'minecraft:geometry': geometries}),
        RP / 'animations/rack_tool_visual.animation.json': dump({'format_version': '1.8.0', 'animations': {
            'animation.kg_station.rack_tool': {'loop': True, 'bones': {'root': {
                'rotation': [round(v, 10) for v in bedrock_rotation(target)],
                'scale': select([source['scale']*f['uniform_fit'] for f in fits]),
                'position': [select([f['center_pixels'][axis]*f['uniform_fit']*(1 if axis == 0 else -1) for f in fits]) for axis in range(3)]}}}}}),
        RP / 'entity/rack_tool_visual.entity.json': dump({'format_version': '1.10.0', 'minecraft:client_entity': {'description': {
            'identifier': ENTITY, 'materials': {'default': 'entity_alphatest_one_sided'}, 'textures': textures,
            'geometry': {'s' + str(i): geo['description']['identifier'] for i, geo in enumerate(geometries)},
            'animations': {'pose': 'animation.kg_station.rack_tool'}, 'scripts': {'animate': ['pose']},
            'render_controllers': [{'controller.render.kg_station.rack_tool': prop('ready')}]}}}),
        RP / 'render_controllers/rack_tool_visual.render_controllers.json': dump({'format_version': '1.8.0', 'render_controllers': {
            'controller.render.kg_station.rack_tool': {'arrays': {
                'geometries': {'Array.models': ['Geometry.s' + str(i) for i in range(6)]},
                'textures': {'Array.items': ['Texture.s' + str(i) for i in range(6)]}},
                'geometry': 'Array.models[' + prop('model') + ']', 'materials': [{'*': 'Material.default'}],
                'textures': ['Array.items[' + prop('model') + ']']}}}),
    }
    output[FIT_REPORT] = dump({'kind': 'uniform_four_cell_adaptation_not_client_acceptance', 'layout': layout, 'previous_native_anchor_y': .35, 'known_sprite_anchor_y': layout['centerY'], 'items': fits})
    entity = deepcopy(json.loads((BP / 'entities/grill_food_visual.json').read_text()))
    description = entity['minecraft:entity']['description']
    description['identifier'] = ENTITY
    description['properties'] = {NS + 'ready': {'type': 'bool', 'default': False, 'client_sync': True},
                                 NS + 'model': {'type': 'int', 'range': [0, 5], 'default': 0, 'client_sync': True}}
    output[BP / 'entities/rack_tool_visual.json'] = dump(entity)
    output[BP / 'scripts/rack_tool_visual_data.js'] = (
        '// Generated by tools/build_rack_tool_display.py. Known original-texture rack sprites only.\n'
        'export const RACK_TOOL_VISUAL_TYPE=' + json.dumps(ENTITY) + ';\n'
        'export const RACK_TOOL_MODEL_INDEX=Object.freeze(' + json.dumps(ids, separators=(',', ':')) + ');\n'
        'export function rackToolVisualModel(typeId){return Object.hasOwn(RACK_TOOL_MODEL_INDEX,typeId)?RACK_TOOL_MODEL_INDEX[typeId]:undefined;}\n').encode()
    return output


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    for path, data in build().items():
        if args.check and path == FIT_REPORT:
            continue  # Optional local diagnostics; all canonical pack outputs remain checked.
        if args.check:
            assert path.read_bytes() == data, 'rack visual source drift: ' + str(path.relative_to(ROOT))
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
    print('Rack six-item projection source ' + ('check' if args.check else 'build') + ' PASS; native/client acceptance separate')


if __name__ == '__main__':
    main()
