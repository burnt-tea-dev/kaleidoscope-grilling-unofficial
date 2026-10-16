"""Bounded scene visuals from pinned Java GUI masks and Mojang fluid sprites.

Writes only the listed display assets. This is not a pack builder or a native
inventory renderer. --check compares the same canonical assets without edits.
"""
from pathlib import Path
from io import BytesIO
import argparse
import hashlib
import json
import re
from PIL import Image
from java_custom_skewer_gui import TEMPLATES, ingredient_color
from secret_food_palette import FALLBACK

ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / 'projects/grilling/gameplay_core'
BP, RP = PACK / 'behavior_pack', PACK / 'resource_pack'
FLUID_SOURCE = ROOT / 'development/gameplay_core/fixtures/bedrock-fluids-1.26.50.4'
NS = 'kaleidoscope_grilling:'
TINTS = {'canola': 0xC08A24, 'secret_chili': 0xE04B2A, 'premium_chili': 0x9E1B16}


def dump(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode()


def png(image):
    output = BytesIO()
    image.save(output, format='PNG')
    return output.getvalue()


def property_int(maximum):
    return {'type': 'int', 'range': [0, maximum], 'default': 0, 'client_sync': True}


def helper(name, properties):
    template = json.loads((BP / 'entities/recipe_icon_visual.json').read_text())
    desc = template['minecraft:entity']['description']
    desc['identifier'] = NS + name
    desc['properties'] = {NS + 'ready': {'type': 'bool', 'default': False, 'client_sync': True},
                          **{NS + key: value for key, value in properties.items()}}
    return template


def gui_assets():
    output, textures, controllers = {}, {}, {}
    prefix = 'textures/ui/kg_java/custom_layers/'
    masks = [[Image.open(TEMPLATES / f'food_{slot + 1}_{variant + 1}.png').convert('RGBA')
              for variant in range(2)] for slot in range(3)]
    stick = Image.open(TEMPLATES / 'stick.png').convert('RGBA')

    def add(name, image):
        textures[name] = prefix + name
        output[RP / (prefix + name + '.png')] = png(image)

    # Remove covered pixels before rendering. Layers are disjoint, so exact
    # Java front-slot precedence does not depend on GPU draw order or Z offsets.
    for count in range(4):
        for bits in range(1 << count):
            image = stick.copy()
            for slot in range(count):
                mask = masks[slot][bits >> slot & 1]
                for y in range(16):
                    for x in range(16):
                        if mask.getpixel((x, y))[3]:
                            image.putpixel((x, y), (0, 0, 0, 0))
            add(f'stick_{(1 << count) - 1 + bits}', image)
    for slot in range(3):
        for bits in range(1 << (slot + 1)):
            mask = masks[slot][bits >> slot & 1]
            for tone in range(5):
                image = Image.new('RGBA', (16, 16))
                for y in range(16):
                    for x in range(16):
                        marker, _, _, alpha = mask.getpixel((x, y))
                        if alpha and (marker - 48) // 48 == tone and not any(
                                masks[front][bits >> front & 1].getpixel((x, y))[3]
                                for front in range(slot)):
                            image.putpixel((x, y), (255, 255, 255, alpha))
                add(f'food_{slot}_{tone}_{bits}', image)
    common = {'geometry': 'Geometry.default', 'materials': [{'*': 'Material.default'}]}
    bits = "q.property('kaleidoscope_grilling:gui_bits')"
    count = "q.property('kaleidoscope_grilling:gui_count')"
    controllers['controller.render.kg_station.custom_stick'] = {
        **common, 'arrays': {'textures': {'Array.stick': [f'Texture.stick_{i}' for i in range(15)]}},
        'textures': [f'Array.stick[math.pow(2,{count})-1+math.mod({bits},math.pow(2,{count}))]'],
    }
    renderers = [{'controller.render.kg_station.custom_stick': "q.property('kaleidoscope_grilling:ready')"}]
    for slot in range(3):
        rgb = f"q.property('kaleidoscope_grilling:gui_color_{slot}')"
        for tone in range(5):
            color = {}
            for channel, divisor in [('r', 65536), ('g', 256), ('b', 1)]:
                value = f'math.mod(math.floor({rgb}/{divisor}),256)'
                if tone < 2:
                    value = f'math.round(({value})*{[0.56, 0.76][tone]})'
                elif tone > 2:
                    value = f'math.round(({value})+(255-({value}))*{[0.18, 0.36][tone - 3]})'
                color[channel] = f'({value})/255'
            color['a'] = 1
            name = f'controller.render.kg_station.custom_food_{slot}_{tone}'
            controllers[name] = {
                **common, 'color': color,
                'arrays': {'textures': {'Array.mask': [f'Texture.food_{slot}_{tone}_{i}' for i in range(1 << (slot + 1))]}},
                'textures': [f'Array.mask[math.mod({bits},{1 << (slot + 1)})]'],
            }
            renderers.append({name: f"q.property('kaleidoscope_grilling:ready') && {count} > {slot}"})
    output[BP / 'entities/custom_recipe_icon_visual.json'] = dump(helper('custom_recipe_icon_visual', {
        'gui_count': property_int(3), 'gui_bits': property_int(7),
        **{f'gui_color_{slot}': property_int(0xFFFFFF) for slot in range(3)},
    }))
    output[RP / 'entity/custom_recipe_icon_visual.entity.json'] = dump({'format_version': '1.10.0', 'minecraft:client_entity': {'description': {
        'identifier': NS + 'custom_recipe_icon_visual', 'materials': {'default': 'entity_alphatest_one_sided'},
        'textures': textures, 'geometry': {'default': 'geometry.kg_station.recipe_icon'},
        'render_controllers': renderers,
    }}})
    output[RP / 'render_controllers/custom_recipe_icon_visual.render_controllers.json'] = dump({'format_version': '1.8.0', 'render_controllers': controllers})
    palette_rows = json.loads((ROOT / 'development/gameplay_core/fixtures/secret-food-palettes.json').read_text())['items']
    palettes = {row['id']: row['palette'] for row in palette_rows}
    catalog = json.loads((ROOT / 'development/gameplay_core/fixtures/secret-visual-catalog.json').read_text())['items']
    rows = [[FALLBACK] * 16] + [palettes[row['id']] for row in catalog]
    colors = [[sum(c << shift for c, shift in zip(ingredient_color(palette, 4 if style == 6 else style, style == 6), (16, 8, 0)))
               for style in range(7)] for palette in rows]
    output[BP / 'scripts/secret_gui_color_data.js'] = (
        '// Generated by tools/build_scene_visuals.py from the pinned Java GUI palette sampler.\n'
        '// Index is the existing secret visual catalog slot, then Java visual style 0..6.\n'
        'export const SECRET_GUI_COLORS=Object.freeze(' + json.dumps(colors, separators=(',', ':')) + '.map(Object.freeze));\n'
    ).encode()
    return output


def oil_assets():
    output, flipbooks = {}, []
    manifest = json.loads((FLUID_SOURCE / 'source-manifest.json').read_text())
    for row in manifest['files']:
        assert hashlib.sha256((FLUID_SOURCE / row['path']).read_bytes()).hexdigest() == row['sha256'], f"changed Mojang fluid source: {row['path']}"
    source_meta = json.loads(re.sub(r'//[^\n]*', '', (FLUID_SOURCE / 'resource_pack/textures/flipbook_textures.json').read_text()))
    source_meta = {row['atlas_tile']: row for row in source_meta}
    for oil, tint in TINTS.items():
        native = 'lava' if oil == 'premium_chili' else 'water'
        channels = [(tint >> shift) & 255 for shift in (16, 8, 0)]
        for form in ('still', 'flow'):
            name = f'{native}_{form}' + ('_grey' if native == 'water' else '')
            image = Image.open(FLUID_SOURCE / f'resource_pack/textures/blocks/{name}.png').convert('RGBA')
            # Java vertex tint multiplies the native sprite, including its alpha.
            pixels = image.load()
            image.putdata([tuple(pixels[x, y][i] * channels[i] // 255 for i in range(3)) + (pixels[x, y][3],)
                           for y in range(image.height) for x in range(image.width)])
            path = f'textures/blocks/java_oil/{oil}_{form}'
            output[RP / (path + '.png')] = png(image)
            output[RP / (path + '_first.png')] = png(image.crop((0, 0, image.width, image.width)))
            native_key = ('still_' if form == 'still' else 'flowing_') + native + ('_grey' if native == 'water' else '')
            meta = dict(source_meta[native_key])
            meta['atlas_tile'] = f'kg_a23_{oil}_oil' + ('_flow' if form == 'flow' else '')
            meta['flipbook_texture'] = path
            flipbooks.append(meta)
    # Fluid ownership remains exact. Append only the separately verified GUI rows.
    if any((BP/'blocks'/('item_visual_'+name+'.json')).exists() for name in ('grilled_slime_skewer','mysterious_skewer')):
        import sys
        sys.path.insert(0,str(ROOT/'development/gameplay_core'))
        from native_skewer_icons import check_or_write, planned
        check_or_write(ROOT)
        expected=json.loads(planned(ROOT)[0][RP/'textures/flipbook_textures.json'])
        tiles={'kg_native_icon_'+name for name in ('grilled_slime_skewer','mysterious_skewer')}
        rows=[row for row in expected if row.get('atlas_tile') in tiles]
        assert len(rows)==2 and {row['atlas_tile'] for row in rows}==tiles
        flipbooks.extend(rows)
    output[RP / 'textures/flipbook_textures.json'] = dump(flipbooks)
    return output


def vat_assets():
    # The base block surface remains a fallback when a transient renderer is
    # unavailable. This overlay brightens only the premium liquid, never bricks
    # or nearby blocks. Its 1..15 UV inset and four heights follow BigVatRenderer.
    output = {BP / 'entities/vat_premium_visual.json': dump(helper('vat_premium_visual', {'level': property_int(4), 'frame': property_int(31)}))}
    geometries = []
    for level in range(1, 5):
        geometries.append({'description': {'identifier': f'geometry.kg_station.vat_premium_{level}', 'texture_width': 16, 'texture_height': 16,
                                          'visible_bounds_width': 2, 'visible_bounds_height': 2, 'visible_bounds_offset': [0, .5, 0]},
                           'bones': [{'name': 'root', 'pivot': [0, 0, 0], 'cubes': [{'origin': [-6, 2 + 3 * level + .016, -6], 'size': [12, 0, 12],
                            'uv': {'up': {'uv': [1, 1], 'uv_size': [14, 14]}}}]}]})
    output[RP / 'models/entity/vat_premium_visual.geo.json'] = dump({'format_version': '1.12.0', 'minecraft:geometry': geometries})
    output[RP / 'entity/vat_premium_visual.entity.json'] = dump({'format_version': '1.10.0', 'minecraft:client_entity': {'description': {
        'identifier': NS + 'vat_premium_visual', 'materials': {'default': 'entity_emissive_alpha'},
        'textures': {'default': 'textures/blocks/java_oil/premium_chili_still'},
        'geometry': {f'level{i}': f'geometry.kg_station.vat_premium_{i}' for i in range(1, 5)},
        'render_controllers': [{'controller.render.kg_station.vat_premium': "q.property('kaleidoscope_grilling:ready') && q.property('kaleidoscope_grilling:level') > 0"}],
    }}})
    output[RP / 'render_controllers/vat_premium_visual.render_controllers.json'] = dump({'format_version': '1.8.0', 'render_controllers': {'controller.render.kg_station.vat_premium': {
        'arrays': {'geometries': {'Array.levels': ['Geometry.level1'] + [f'Geometry.level{i}' for i in range(1, 5)]}},
        'geometry': "Array.levels[q.property('kaleidoscope_grilling:level')]", 'materials': [{'*': 'Material.default'}],
        'textures': ['Texture.default'], 'ignore_lighting': True,
        'uv_anim': {'offset': [0, "q.property('kaleidoscope_grilling:frame')/32"], 'scale': [1, 1 / 32]},
    }}})
    return output


def build():
    return {**gui_assets(), **oil_assets(), **vat_assets()}


def assert_generated(path, data):
    assert path.is_file() and path.read_bytes() == data, f'stale scene visual: {path.relative_to(ROOT)}'


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    output = build()
    for path, data in output.items():
        if args.check:
            assert_generated(path, data)
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
    print(f'scene visual assets {"current" if args.check else "written"}: {len(output)}; no native/client acceptance implied')
