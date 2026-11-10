#!/usr/bin/env python3
"""Author only Grilling's placed oil details and oil/brush state readers.

The Cookery block owns the pot shell. Oil helpers draw the changed source
pixels, not a second pot. --cookery-model is the original Java oil_pot.json:
https://github.com/KaleidoscopeMods/KaleidoscopeCookery/blob/4d39e36cfa749939ba5f9d6d3b715ef9a984cb9c/src/main/resources/assets/kaleidoscope_cookery/models/block/oil_pot.json
Read-only source inputs; no packaging, release, server operation or checks.
"""
import argparse
from io import BytesIO
import json
import math
from pathlib import Path
from zipfile import ZipFile

from PIL import Image
from compact_geometry import bank_bytes
from held_snapshot_properties import SCHEMA, player_extension

ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / 'projects/grilling/gameplay_core'
BP, RP = PACK / 'behavior_pack', PACK / 'resource_pack'
NS = 'kaleidoscope_grilling:'
IDLE = ('pot_no_oil', 'pot_has_oil', 'oil_pot_canola', 'oil_pot_secret_chili', 'oil_pot_premium_chili')
BRUSHES = ('canola_oil_brush', 'secret_chili_oil_brush', 'premium_chili_oil_brush')


def oil_word(hand, index, owner=False):
    key = NS + ('secret_' + hand + '_piece' if index == 11 else 'bottle_' + hand + '_0')
    return SCHEMA['fields'][key]['ownerRead' if owner else 'read']


def sine(word):
    return f'math.sin(math.mod(math.clamp(({word}) - 1, 0, 59), 20) * 18)'


def held_assets():
    output = {}
    names = IDLE + BRUSHES
    for pot, fallback in [('oil_pot', 0), ('oil_pot_filled', 1)]:
        identifier = 'kaleidoscope_cookery:' + pot
        reader = lambda i: "(c.item_slot == 'off_hand' ? " + oil_word('off', i, True) + ' : ' + oil_word('main', i, True) + ')'
        output[RP / 'attachables' / ('grilling_' + pot + '_brush.attachable.json')] = {
            'format_version': '1.20.30', 'minecraft:attachable': {'description': {
                'identifier': identifier, 'item': {identifier: "q.is_owner_identifier_any('minecraft:player')"},
                'materials': {'default': 'entity_alphatest'},
                'textures': {n: ('textures/items/' + n if n in BRUSHES else 'textures/held/java_' + n) for n in names},
                'geometry': {n: 'geometry.kg_oil_brush.' + ('canola_oil_brush' if n in BRUSHES else 'oil_pot_canola') for n in names},
                'scripts': {'pre_animation': [
                    'v.kg_oil_brush_owner = ' + reader(11) + ';',
                    'v.kg_oil_brush_word = ' + reader(0) + ';',
                    'v.kg_oil_brush_model = (v.kg_oil_brush_owner == 225 && v.kg_oil_brush_word >= 1 && v.kg_oil_brush_word <= 60) ? 5 + math.floor((v.kg_oil_brush_word - 1) / 20) : ((v.kg_oil_brush_owner == 226 && v.kg_oil_brush_word >= 0 && v.kg_oil_brush_word <= 4) ? v.kg_oil_brush_word : ' + str(fallback) + ');',
                    'v.kg_oil_brush_active = v.kg_oil_brush_owner == 225 && v.kg_oil_brush_word >= 1 && v.kg_oil_brush_word <= 60;',
                    'v.kg_oil_brush_stale = (v.kg_oil_brush_word == (v.kg_oil_brush_previous_word ?? -1) && v.kg_oil_brush_owner == (v.kg_oil_brush_previous_owner ?? -1)) ? math.min((v.kg_oil_brush_stale ?? 0) + q.delta_time, 2) : 0;',
                    'v.kg_oil_brush_previous_word = v.kg_oil_brush_word;',
                    'v.kg_oil_brush_previous_owner = v.kg_oil_brush_owner;',
                    'v.kg_oil_brush_active = v.kg_oil_brush_active && v.kg_oil_brush_stale < 2;',
                    'v.kg_oil_brush_model = (v.kg_oil_brush_owner == 225 && !v.kg_oil_brush_active) ? ' + str(fallback) + ' : v.kg_oil_brush_model;',
                    'v.kg_oil_brush_sine = ' + sine('v.kg_oil_brush_word') + ';'
                ], 'animate': [{view + '_' + hand: "c.is_first_person == " + str(int(view == 'fp')) + " && c.item_slot == '" + slot + "'"}
                    for view in ('fp', 'tp') for hand, slot in [('right', 'main_hand'), ('left', 'off_hand')]]},
                'animations': {view + '_' + hand: 'animation.kg_oil_brush.display.' + view + '.' + hand for view in ('fp', 'tp') for hand in ('right', 'left')},
                'render_controllers': ['controller.render.kg_oil_brush']}}}
    animations = {}
    degrees = 180 / math.pi
    for hand, side in [('main', 1), ('off', -1)]:
        swing = sine(oil_word(hand, 0))
        fp_pos = [13.5, -10, 12] if side == 1 else [0, 0, 0]
        fp_rot = [95, -45, 115] if side == 1 else [0, 0, 0]
        # Java HumanoidAnvilPressMixin and ItemInHandLayerAnvilPressMixin.
        tp_rot = [-1.32 * degrees, f'({side} * 0.18 + {swing} * 0.70) * {degrees}',
                  f'{side} * (0.10 + {swing} * 0.42) * {degrees}']
        animations['animation.kg_oil_brush.player.' + hand] = {
            'animation_length': 2.0, 'loop': False, 'override_previous_animation': True, 'bones': {
                'rightarm' if side == 1 else 'leftarm': {
                    'position': [f'v.is_first_person ? {v} : 0' for v in fp_pos],
                    'rotation': [f'v.is_first_person ? {a} : ({b})' for a, b in zip(fp_rot, tp_rot)]},
                'rightitem' if side == 1 else 'leftitem': {'position': [0, 0, 'v.is_first_person ? -1 : 0'], 'rotation': [0, 0, 0]}}}
    output[RP / 'animations/oil_brush_player.animation.json'] = {'format_version': '1.8.0', 'animations': animations}
    output[BP / 'host-extensions/player-presentation.json'] = player_extension()
    return output


def changed_pixels(image, base):
    result = image.copy()
    for y in range(image.height):
        for x in range(image.width):
            if image.getpixel((x, y)) == base.getpixel((x, y)):
                result.putpixel((x, y), (0, 0, 0, 0))
    return result


def placed_mesh(model, image, identifier, clearance=0):
    cubes, patches = [], []
    for element in model['elements']:
        start, end = element['from'], element['to']
        # The host's native block reflects Java X, including its asymmetric
        # handle/spout. Helpers must use that same model basis.
        cube = {'origin': [8 - end[0], start[1], start[2] - 8],
                'size': [end[i] - start[i] for i in range(3)], 'uv': {}}
        if clearance:
            cube['inflate'] = clearance
        for face, spec in element['faces'].items():
            u0, v0, u1, v1 = spec['uv']
            sx, sy = image.width / 16, image.height / 16
            patch = image.crop((round(min(u0, u1) * sx), round(min(v0, v1) * sy),
                                round(max(u0, u1) * sx), round(max(v0, v1) * sy)))
            if not patch.getchannel('A').getbbox():
                continue
            if u1 < u0:
                patch = patch.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
            if v1 < v0:
                patch = patch.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
            if spec.get('rotation', 0):
                patch = patch.rotate(-spec['rotation'], expand=True)
            index = len(patches)
            x, y = (index % 8) * 32, (index // 8) * 32
            patches.append((patch.resize((32, 32), Image.Resampling.NEAREST), x, y))
            cube['uv'][face] = {'uv': [x + 32, y + 32], 'uv_size': [-32, -32]} if face in ('up', 'down') else {'uv': [x, y], 'uv_size': [32, 32]}
        if cube['uv']:
            cubes.append(cube)
    height = max(32, 1 << ((max(1, (len(patches) + 7) // 8) * 32 - 1).bit_length()))
    atlas = Image.new('RGBA', (256, height), (0, 0, 0, 0))
    for patch, x, y in patches:
        atlas.paste(patch, (x, y))
    geometry = {'description': {'identifier': identifier, 'texture_width': 256, 'texture_height': height,
                'visible_bounds_width': 3, 'visible_bounds_height': 2, 'visible_bounds_offset': [0, .5, 0]},
                'bones': [{'name': 'root', 'pivot': [0, 0, 0], 'cubes': cubes}]}
    stream = BytesIO()
    atlas.save(stream, format='PNG', compress_level=9)
    return geometry, stream.getvalue()


def placed_assets(java_root, cookery_model, cookery_archive):
    model = json.loads(cookery_model.read_text())
    resources = java_root / 'common/src/main/resources/assets/kaleidoscope_grilling'
    with ZipFile(cookery_archive) as archive:
        name = next(n for n in archive.namelist() if n.endswith('/textures/blocks/kc_oil_pot_with_oil.png'))
        base = Image.open(BytesIO(archive.read(name))).convert('RGBA')
    output, geometries = {}, []
    for name in ('oil_pot_canola', 'oil_pot_secret_chili'):
        source = Image.open(resources / 'textures/block' / (name + '.png')).convert('RGBA')
        # Only oil-specific pixels survive. The source glow sits 0.01 model
        # units above the shell; color details use half that existing spacing.
        mesh, png = placed_mesh(model, changed_pixels(source, base), 'geometry.kg_a2770.oil_skin', .005)
        if not geometries:
            geometries.append(mesh)
        output[RP / 'textures/a2770_placed' / (name + '.png')] = png
    # Preserve the authored emissive model's exact 0.01-unit bounds and alpha;
    # do not turn its black/transparent pixels into another opaque shell.
    glow = json.loads((java_root / 'forge-1.20.1/src/main/resources/assets/kaleidoscope_grilling/models/block/oil_pot_premium_glow.json').read_text())
    image = Image.open(resources / 'textures/block/oil_pot_premium_glow.png').convert('RGBA')
    mesh, png = placed_mesh(glow, image, 'geometry.kg_a2770.oil_glow')
    geometries.append(mesh)
    output[RP / 'textures/a2770_placed/oil_pot_premium_glow.png'] = png
    output[RP / 'models/entity/a2770_placed/oil.geo.json'] = bank_bytes({'format_version': '1.16.0'}, geometries)
    return output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--grilling-java', type=Path, required=True)
    parser.add_argument('--cookery-model', type=Path, required=True)
    parser.add_argument('--cookery-archive', type=Path, required=True)
    args = parser.parse_args()
    output = {**held_assets(), **placed_assets(args.grilling_java, args.cookery_model, args.cookery_archive)}
    for path, value in output.items():
        raw = value if isinstance(value, bytes) else (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode()
        path.write_bytes(raw)
        print(path.relative_to(ROOT))


if __name__ == '__main__':
    main()
