"""Reproduce configured Grilling ingredient visuals without changing saved indices.

Run after editing the explicit source manifest, then use --check in CI. Existing
217 palette assets and all existing geometry identifiers remain byte-preserved.
No external pack, network fetch, runtime item ID, or player channel is added.
"""
from pathlib import Path
import argparse
import hashlib
import io
import json
import re
from PIL import Image
from secret_food_palette import sample_grid, color_at
from generated_food_sprite import spans_from_alpha, span_cubes, main_faces, piece_geometry

ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / 'projects/grilling/gameplay_core'
BP, RP = PACK/'behavior_pack', PACK/'resource_pack'
FIX = ROOT/'tools/fixtures/secret-visual'


def dump(value):
    return (json.dumps(value, ensure_ascii=False, indent=2)+'\n').encode()


def atlas(palette, white, style):
    image = Image.new('RGBA', (256, 96))
    tiles = {}
    for face in range(6):
        for cell in range(16):
            color = color_at(palette, face, cell, 4 if style == 6 else style, style == 6)
            if color not in tiles:
                factors = [color >> shift & 255 for shift in (16, 8, 0)]
                channels = [white.getchannel(i).point([(v*f+127)//255 for v in range(256)])
                            for i, f in enumerate(factors)]
                tiles[color] = Image.merge('RGBA', (*channels, white.getchannel('A')))
            image.paste(tiles[color], (cell*16, face*16))
    stream = io.BytesIO()
    image.save(stream, format='PNG', compress_level=9)
    return stream.getvalue()


def gui_color(palette, style):
    colors = [color_at(palette, 0, cell, 4 if style == 6 else style, style == 6)
              for cell in (5, 6, 9, 10)]
    return sum((sum(c >> shift & 255 for c in colors)//4) << shift for shift in (16,8,0))


def build():
    manifest = json.loads((FIX/'ingredients.json').read_text())
    rows = manifest['items']
    assert [r['index'] for r in rows] == list(range(218,226))
    white_raw = (FIX/'white_concrete.png').read_bytes()
    assert hashlib.sha256(white_raw).hexdigest() == manifest['base_texture_sha256']
    white = Image.open(io.BytesIO(white_raw)).convert('RGBA')
    assert white.size == (16,16)
    output = {}
    catalog_path = BP/'scripts/secret_visual_catalog.js'
    source = catalog_path.read_text()
    catalog = json.loads(source.split('Object.freeze(',1)[1].rsplit(')',1)[0].rstrip(';'))
    gui_path = BP/'scripts/secret_gui_color_data.js'
    gui_source = gui_path.read_text()
    colors = json.loads(gui_source.split('Object.freeze(',1)[1].split('.map(Object.freeze)',1)[0])
    geometry_path = RP/'models/entity/secret_helper_sprites.geo.json'
    geometry = json.loads(geometry_path.read_text())
    geometries = geometry['minecraft:geometry']
    selected = {}
    for row in rows:
        index = row['index']
        texture_raw = (RP/(row['texture']+'.png')).read_bytes()
        assert hashlib.sha256(texture_raw).hexdigest() == row['texture_sha256'], row['id']
        sprite = Image.open(io.BytesIO(texture_raw)).convert('RGBA')
        assert sprite.size == (16,16), row['id']
        palette = sample_grid(sprite)
        if row['id'] in catalog:
            assert catalog[row['id']] == index
        catalog[row['id']] = index
        for style in range(7):
            output[RP/f'textures/secret_food_palette/food_{index}_{style}.png'] = atlas(palette,white,style)
        new_colors = [gui_color(palette,s) for s in range(7)]
        if len(colors) == index: colors.append(new_colors)
        else:
            assert len(colors)>index
            colors[index]=new_colors
        alpha = sprite.getchannel('A')
        pixels = [alpha.getpixel((x,y)) for y in range(16) for x in range(16)]
        spans = spans_from_alpha([pixels[y*16:(y+1)*16] for y in range(16)])
        # Stable, food-specific identifier; does not renumber legacy deduplicated outlines.
        identifier = 'geometry.kg_secret_held.food_piece_'+str(index)
        new_geo = piece_geometry(identifier,[main_faces(),*span_cubes(spans,16,16)])
        existing = next((i for i,g in enumerate(geometries) if g['description']['identifier']==identifier),None)
        if existing is None: geometries.append(new_geo)
        else: geometries[existing]=new_geo
        selected[index]='food_piece_'+str(index)
    assert len(colors)==226 and len(catalog)==225
    output[catalog_path]=(source.split('Object.freeze(',1)[0]+'Object.freeze('+json.dumps(catalog,separators=(',',':'))+');\n').encode()
    output[gui_path]=(gui_source.split('Object.freeze(',1)[0]+'Object.freeze('+json.dumps(colors,separators=(',',':'))+'.map(Object.freeze));\n').encode()
    output[geometry_path]=('{"format_version":"1.21.0","minecraft:geometry":[\n'+',\n'.join(json.dumps(g,separators=(',',':')) for g in geometries)+'\n]}\n').encode()
    # Only consumers already owning the relevant arrays/maps are extended.
    for folder in ('attachables','entity'):
        for path in (RP/folder).glob('*.json'):
            data=json.loads(path.read_text());changed=False
            for kind in ('minecraft:attachable','minecraft:client_entity'):
                if kind not in data: continue
                desc=data[kind]['description'];textures=desc.get('textures',{});geos=desc.get('geometry',{})
                if 'food_217_s6' in textures:
                    for row in rows:
                        for style in range(7):textures[f"food_{row['index']}_s{style}"]=f"textures/secret_food_palette/food_{row['index']}_{style}"
                    changed=True
                if 'food_217' in textures:
                    for row in rows:textures[f"food_{row['index']}"]=row['texture']
                    if not any(k.startswith('piece_') for k in geos):raise ValueError(str(path)+' missing helper geometry owner')
                    for index,key in selected.items():geos[key]='geometry.kg_secret_held.'+key
                    changed=True
            if changed:output[path]=dump(data)
    for path in (RP/'render_controllers').glob('*.json'):
        data=json.loads(path.read_text());changed=False
        for controller_name,controller in data.get('render_controllers',{}).items():
            if controller_name in ('controller.render.kg_secret_held.piece',
                                   'controller.render.kg_failure_held.helper'):
                # Helper slot zero is the shaft fallback, not food_0/piece_0.
                # Select by the owned controller contract instead of guessing
                # from every array entry's prefix (which skipped both arrays).
                pieces=controller['arrays']['geometries']['Array.pieces']
                foods=controller['arrays']['textures']['Array.food']
                assert len(pieces)>=218 and pieces[0]=='Geometry.java_secret_piece'
                assert foods[:218]==['Texture.stick']+[f'Texture.food_{i}' for i in range(1,218)]
                controller['arrays']['geometries']['Array.pieces']=pieces[:218]+['Geometry.'+selected[i] for i in range(218,226)]
                controller['arrays']['textures']['Array.food']=foods[:218]+[f'Texture.food_{i}' for i in range(218,226)]
                changed=True
            for kind,arrays in controller.get('arrays',{}).items():
                for key,values in arrays.items():
                    if kind=='textures' and values in [[f'Texture.food_{i}_s{s}' for s in range(7) for i in range(n)] for n in (218,226)]:
                        arrays[key]=[f'Texture.food_{i}_s{s}' for s in range(7) for i in range(226)];changed=True
                    elif kind=='textures' and values in [[f'Texture.food_{i}_s0' for i in range(n)] for n in (218,226)]:
                        arrays[key]=[f'Texture.food_{i}_s0' for i in range(226)];changed=True
                    elif kind=='textures' and values in [[f'Texture.food_{i}' for i in range(n)] for n in (218,226)]:
                        arrays[key]=[f'Texture.food_{i}' for i in range(226)];changed=True
                    elif kind=='geometries' and len(values) in (218,226) and all(v.startswith('Geometry.piece') or v.startswith('Geometry.food_piece_') for v in values):
                        arrays[key]=values[:218]+['Geometry.'+selected[i] for i in range(218,226)];changed=True
        if changed:
            rendered=dump(data)
            if path.name=='plate_held.render_controllers.json':
                # These already-edited repeated palette arrays dominate JSON
                # whitespace. Compact only their values to keep the main-branch
                # RP byte budget without deleting assets or changing pixels.
                text=rendered.decode()
                text=re.sub(r'("Array\.palette": )\[\s*("Texture\.food_0_s0"[^]]*)\]',
                            lambda m:m[1]+json.dumps(json.loads('['+m[2]+']'),separators=(',',':')),text)
                rendered=text.encode()
            output[path]=rendered
    return output


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check',action='store_true');args=parser.parse_args()
    output=build()
    # Consumer expression updater is deliberately separate from asset sampling.
    from secret_visual_consumers import update_consumers
    mismatches=[]
    for path,data in output.items():
        if path.exists() and path.read_bytes()==data:continue
        if args.check:mismatches.append(str(path.relative_to(ROOT)))
        else:path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
    if args.check:mismatches.extend(update_consumers(ROOT, check=True))
    else:update_consumers(ROOT)
    if mismatches:raise SystemExit('Out-of-date secret visuals: '+', '.join(mismatches))
    print(f'{len(output)} generated/updated outputs; '+('check passed' if args.check else 'written'))

if __name__=='__main__':main()
