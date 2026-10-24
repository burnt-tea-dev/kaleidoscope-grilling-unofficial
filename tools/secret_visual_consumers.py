"""Update existing secret-skewer consumers without changing persisted encoding.

Called by the palette generator. Food indices remain eight-bit values; helper
owners skip bottle/slime/failure and oil markers. No entity property is added.
"""
import json
import re
from pathlib import Path

FOOD_COUNT = 225
VISUAL_MAX = FOOD_COUNT + 256 * 20
WORD_A_MAX = VISUAL_MAX + 8192 * 63
WORD_B_MAX = 1 + VISUAL_MAX // 64 + 128 * VISUAL_MAX


def update_consumers(root, check=False):
    root = Path(root)
    base = root / 'projects/grilling/gameplay_core'
    bp, rp = base / 'behavior_pack', base / 'resource_pack'
    changes = []
    def write(path, text):
        if path.suffix == '.json' and json.loads(path.read_text()) == json.loads(text):
            return
        if path.read_text() != text:
            if not check:
                path.write_text(text)
            changes.append(str(path.relative_to(root)))
    replacements = {5337: VISUAL_MAX, 521433: WORD_A_MAX, 683220: WORD_B_MAX}
    for name in ['secret_visual_state_core.js', 'held_visual_transport.js', 'plate_held_visual_core.js']:
        p = bp / 'scripts' / name
        s = p.read_text()
        for old, new in replacements.items():
            s = re.sub(r'\b' + str(old) + r'\b', str(new), s)
        if name == 'secret_visual_state_core.js':
            s = s.replace('SECRET_FOOD_COUNT=217', 'SECRET_FOOD_COUNT=225')
            s = s.replace('217 foods', '225 foods')
            s = s.replace('// Retain every old food index; 214..220 are other hand-bank owners. The four\n// added Cookery helper indices use unused discriminants 221..224 instead.', '// Preserve old helpers 0..213 and 221..224. Markers 214..220 and\n// 225..226 belong to other hand-bank owners; new foods use 227..234.')
            s = s.replace('return food<=213?food:food+7;', 'return food<=213?food:food<=217?food+7:food+9;')
        elif name == 'held_visual_transport.js':
            s = s.replace('values[2]<=217', 'values[2]<=225')
            s = s.replace('(marker>=221&&marker<=224)', '(marker>=221&&marker<=224)||(marker>=227&&marker<=234)') if '(marker>=227&&marker<=234)' not in s else s
        write(p, s)
    for name in ['player', 'grill_food_visual', 'plate_food_visual']:
        p = bp / 'entities' / (name + '.json')
        d = json.loads(p.read_text())
        for prop in d['minecraft:entity']['description']['properties'].values():
            if prop.get('type') == 'int' and prop.get('range', [0, 0])[1] in replacements:
                prop['range'][1] = replacements[prop['range'][1]]
        write(p, json.dumps(d, indent=2, ensure_ascii=False) + '\n')
    marker = "(c.item_slot == 'off_hand' ? (c.owning_entity->q.has_property('kaleidoscope_grilling:secret_off_piece') ? c.owning_entity->q.property('kaleidoscope_grilling:secret_off_piece') : 0) : (c.owning_entity->q.has_property('kaleidoscope_grilling:secret_main_piece') ? c.owning_entity->q.property('kaleidoscope_grilling:secret_main_piece') : 0))"
    valid = '((v.kg_secret_marker >= 0 && v.kg_secret_marker <= 213) || (v.kg_secret_marker >= 221 && v.kg_secret_marker <= 224) || (v.kg_secret_marker >= 227 && v.kg_secret_marker <= 234))'
    names = ['secret_skewer', 'secret_skewer_native_plain', 'secret_skewer_java_three_alt', 'unfinished_skewer', 'skewer_plate'] + [x + y for x in ['mysterious_skewer', 'dark_grilling'] for y in ['', '_native_plain', '_java_three_alt']]
    paths = [rp / 'attachables' / (n + '.attachable.json') for n in names] + [rp / 'entity' / (n + '.entity.json') for n in ['grill_food_visual', 'plate_food_visual']]
    for p in paths:
        d = json.loads(p.read_text())
        desc = d['minecraft:attachable' if 'attachables' in p.parts else 'minecraft:client_entity']['description']
        for key, lines in desc.get('scripts', {}).items():
            if not isinstance(lines, list):
                continue
            for i, s in enumerate(lines):
                if not isinstance(s, str):
                    continue
                for old, new in {**replacements, 217: FOOD_COUNT}.items():
                    s = re.sub(r'\b' + str(old) + r'\b', str(new), s)
                if s.startswith('v.kg_secret_piece_index =') and 'v.kg_secret_marker' not in s:
                    s = 'v.kg_secret_piece_index = math.floor(v.kg_secret_marker >= 227 && v.kg_secret_marker <= 234 ? v.kg_secret_marker - 9 : (v.kg_secret_marker >= 221 && v.kg_secret_marker <= 224 ? v.kg_secret_marker - 7 : (v.kg_secret_marker >= 0 && v.kg_secret_marker <= 213 ? v.kg_secret_marker : 0)));'
                if s.startswith('v.kg_secret_owner_occupied =') and ' && (((' in s:
                    prefix = s.split(' && (((', 1)[0]
                    terminal = ' && (v.kg_secret_terminal_wait ?? 0) == 0' if '(v.kg_secret_terminal_wait ?? 0) == 0;' in s else ''
                    s = prefix + ' && ' + valid + terminal + ';'
                lines[i] = s
        if p.stem in [n + '.attachable' for n in names[:4]]:
            lines = desc['scripts']['pre_animation']
            if not any(isinstance(s,str) and s.startswith('v.kg_secret_marker =') for s in lines):
                lines.insert(0, 'v.kg_secret_marker = ' + marker + ';')
        write(p, json.dumps(d, indent=2, ensure_ascii=False) + '\n')
    for name in ['secret_held', 'grill_food_visual', 'plate_held']:
        p = rp / 'render_controllers' / (name + '.render_controllers.json')
        d = json.loads(p.read_text())
        for controller in d['render_controllers'].values():
            if isinstance(controller.get('textures'), list):
                controller['textures'] = [re.sub(r'\b218\b', '226', s) for s in controller['textures']]
        write(p, json.dumps(d, indent=2, ensure_ascii=False) + '\n')
    return changes

if __name__ == '__main__':
    import sys
    print('\n'.join(update_consumers(Path(sys.argv[1]) if len(sys.argv)>1 else Path(__file__).resolve().parents[1])))
