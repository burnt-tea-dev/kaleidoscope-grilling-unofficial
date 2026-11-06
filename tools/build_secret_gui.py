"""Generate inventory presentation from the pinned Java masks and GUI palette.

The hook decorates the existing item renderer; it owns no inventory buttons or
gameplay input. Missing per-slot cache leaves the native item renderer visible.
"""
from pathlib import Path
import argparse
import io
import json
import subprocess

ROOT = Path(__file__).resolve().parents[1]
BP = ROOT/'projects/grilling/gameplay_core/behavior_pack'
RP = ROOT/'projects/grilling/gameplay_core/resource_pack'
FIX = ROOT/'tools/fixtures/secret-gui'
TEXTURES = 'textures/items/secret_gui'
STYLES = (0, 4, 6)


def source_data():
    script = """
import {SECRET_GUI_HEADER,secretGuiDigitMarker} from './projects/grilling/gameplay_core/behavior_pack/scripts/secret_gui_core.js';
import {SECRET_GUI_COLORS} from './projects/grilling/gameplay_core/behavior_pack/scripts/secret_gui_color_data.js';
console.log(JSON.stringify({header:SECRET_GUI_HEADER,markers:Array.from({length:8},(_,i)=>Array.from({length:16},(_,n)=>secretGuiDigitMarker(i,n))),colors:SECRET_GUI_COLORS}));
"""
    return json.loads(subprocess.check_output(['node', '--input-type=module', '-e', script], cwd=ROOT))


def toned(color, marker):
    from secret_food_palette import _f32, _round
    tone = max(0, min(4, _round(_f32((marker-0x30)/48))))
    channels = [(color >> shift) & 255 for shift in (16, 8, 0)]
    if tone < 2:
        factor = _f32(.56 if tone == 0 else .76)
        channels = [_round(_f32(c*factor)) for c in channels]
    elif tone > 2:
        amount = _f32(.18 if tone == 3 else .36)
        channels = [_round(_f32(c+_f32((255-c)*amount))) for c in channels]
    return tuple(channels)


def painted(mask, color):
    from PIL import Image
    image = Image.new('RGBA', mask.size)
    for y in range(16):
        for x in range(16):
            r, _, _, alpha = mask.getpixel((x, y))
            if alpha:
                image.putpixel((x, y), (*toned(color, r), alpha))
    return image


def png(image):
    out = io.BytesIO()
    image.save(out, format='PNG', compress_level=9)
    return out.getvalue()


def present(text):
    return "not ((#kg_secret_recipe - '"+text+"') = #kg_secret_recipe)"


def digit(markers, field):
    return '('+' + '.join('('+present(markers[field][value])+') * '+str(value)
                         for value in range(1, 16))+')'


def bindings():
    return [
        {'binding_type':'collection_details', 'binding_collection_name':'$item_collection_name'},
        {'binding_name':'#hover_text', 'binding_type':'collection', 'binding_collection_name':'$item_collection_name',
         'binding_name_override':'#kg_secret_recipe', 'binding_condition':'visible'}
    ]


def ui(data):
    active = present(data['header'])
    controls = [{'stick':{'type':'image', 'texture':TEXTURES+'/stick', 'size':['100%', '100%'],
                         'bilinear':False, 'layer':0}}]
    for slot in range(3):
        # Decode small numeric properties first. Do not expand the complete
        # recipe arithmetic into each texture-path expression.
        style = '('+' + '.join('('+present(data['markers'][7][n])+') * '+str(n) for n in STYLES if n)+')'
        for variant in range(2):
            choices = [n for n in range(8) if ((n >> slot) & 1) == variant]
            chosen = '('+' or '.join(present(data['markers'][6][n]) for n in choices)+')'
            texture = "('"+TEXTURES+"/food_' + #kg_style + '_' + (#kg_food_hi * 16 + #kg_food_lo))"
            controls.append({'food_'+str(slot)+'_'+str(variant):{
                'type':'image', 'size':['100%', '100%'], 'texture':'#texture',
                'uv':[(slot*2+variant)*16,0], 'uv_size':[16,16],
                'allow_debug_missing_texture':False, 'bilinear':False, 'layer':3-slot,
                'property_bag':{'#kg_secret_recipe':'', '#kg_food_hi':0, '#kg_food_lo':0, '#kg_style':0},
                'bindings':[
                    {'binding_type':'view', 'source_control_name':'kg_secret_recipe_source', 'source_property_name':'#kg_secret_recipe', 'target_property_name':'#kg_secret_recipe'},
                    {'binding_type':'view', 'source_property_name':digit(data['markers'], 2*slot), 'target_property_name':'#kg_food_hi'},
                    {'binding_type':'view', 'source_property_name':digit(data['markers'], 2*slot+1), 'target_property_name':'#kg_food_lo'},
                    {'binding_type':'view', 'source_property_name':style, 'target_property_name':'#kg_style'},
                    {'binding_type':'view', 'source_property_name':chosen, 'target_property_name':'#visible'},
                    {'binding_type':'view', 'source_property_name':texture, 'target_property_name':'#texture'}
                ]
            }})
    view = {'namespace':'kg_secret_gui', 'icon':{
        'type':'panel', 'size':['100%', '100%'], 'alpha':1.0, 'controls':controls
    }, 'slot_overlay':{
        'type':'stack_panel', 'size':['100%', '100%'],
        'collection_name':'$item_collection_name',
        # The native collection-factory pattern creates zero icon subtrees for
        # unmarked slots and one for a marked secret. The source stays present
        # so replacing a normal item with a secret updates without hovering.
        'factory':{'name':'kg_secret_icon_factory', 'control_name':'kg_secret_gui.icon'},
        'property_bag':{'#kg_secret_recipe':'', '#kg_secret_active':False},
        'bindings':bindings()+[
            {'binding_type':'view', 'source_property_name':'('+active+')', 'target_property_name':'#kg_secret_active'},
            {'binding_type':'view', 'source_property_name':'(#kg_secret_active * 1)', 'target_property_name':'#collection_length'}
        ]
    }}
    # Retain the native renderer contract; derived callers may replace bindings.
    # Only its own drawing becomes transparent for a marked secret; the child
    # icon keeps its alpha. This does not replace container controls or inputs.
    # This is a complete same-name definition, not an inheritance patch.
    # Emit the alpha view binding directly: a custom renderer rejects the
    # modifications property and passes that error to its derived controls.
    renderer = json.loads((FIX/'native-item-renderer.json').read_text())['item_renderer']
    renderer.update({
        'propagate_alpha':False,
        'controls':[{'kg_secret_recipe_source@kg_secret_gui.slot_overlay':{}}]
    })
    renderer['bindings'].append({
        'binding_type':'view', 'source_control_name':'kg_secret_recipe_source',
        'source_property_name':'(not #kg_secret_active)', 'target_property_name':'#alpha'
    })
    hook = {'namespace':'common', 'item_renderer':renderer}
    return view, hook


def outputs():
    from PIL import Image
    data = source_data()
    result = {RP/(TEXTURES+'/stick.png'):(FIX/'stick.png').read_bytes()}
    masks = [Image.open(FIX/f'food_{slot+1}_{variant+1}.png').convert('RGBA')
             for slot in range(3) for variant in range(2)]
    for style in STYLES:
        for food, colors in enumerate(data['colors']):
            # Six fixed UV cells share one food texture; slots keep independent
            # recipe bindings without thousands of duplicate texture files.
            atlas = Image.new('RGBA', (96,16))
            for cell, mask in enumerate(masks):
                atlas.paste(painted(mask, colors[style]), (cell*16,0))
            result[RP/(TEXTURES+f'/food_{style}_{food}.png')] = png(atlas)
    view, hook = ui(data)
    for name, content in [('kg_secret_gui.json', view), ('kg_secret_gui_common.json', hook)]:
        result[RP/'ui'/name] = (json.dumps(content, ensure_ascii=False, indent=2)+'\n').encode()
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    generated = outputs()
    different = [str(p.relative_to(ROOT)) for p, value in generated.items() if not p.exists() or p.read_bytes() != value]
    if args.check:
        if different:
            raise SystemExit('Secret GUI generation differs: '+', '.join(different[:5]))
    else:
        for path in (RP/TEXTURES).glob('*.png'):
            if path not in generated:
                path.unlink()
        for path, value in generated.items():
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(value)
    print(json.dumps({'generated_files':len(generated), 'different':len(different), 'check':args.check}))


if __name__ == '__main__':
    main()
