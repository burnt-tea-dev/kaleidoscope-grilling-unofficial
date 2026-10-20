"""Extract authored data and numeric rules without importing the game or running Java."""
from __future__ import annotations
import json
import re
from pathlib import Path
from .common import COMMIT, JAVA, LOADERS, balanced, calls, envelope, number, source_info, split_args, strip_comments, mask_strings

NUMBER = re.compile(r'(?<![\w$])(?:0[xX][0-9a-fA-F]+|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)[fFdDlL]?(?![\w$])')


def numeric_declarations(text):
    """Read scalar/array declarations; symbolic expressions remain explicit."""
    clean = strip_comments(text)
    result = []
    pattern = r'\b(int|long|float|double|boolean)(\s*\[\s*\])?\s+(\w+)\s*=\s*'
    for match in re.finditer(pattern, mask_strings(clean)):
        start = match.end()
        end = clean.find(';', start)
        if end < 0: raise ValueError('Unterminated numeric declaration')
        expression = clean[start:end].strip()
        if not expression: continue
        row = {'name': match[3], 'java_type': match[1] + ('[]' if match[2] else ''),
               'line': clean.count('\n', 0, match.start()) + 1, 'expression': expression}
        try:
            if match[2]:
                brace = expression.index('{')
                inside, after = balanced(expression, brace, '{', '}')
                if expression[after:].strip(): raise ValueError('Array suffix')
                row['value'] = [number(arg) for arg in split_args(inside)]
            elif expression in ('true', 'false'): row['value'] = expression == 'true'
            else: row['value'] = number(expression)
        except (ValueError, ZeroDivisionError):
            row['evaluation'] = 'symbolic; expression retained, not executed'
        result.append(row)
    return result


def method_regions(clean):
    pattern = r'\b(?:public|private|protected)\s+(?:(?:static|final|synchronized|abstract)\s+)*(?:[\w.<>?\[\],]+\s+)?(\w+)\s*\([^;{}]*\)\s*(?:throws\s+[\w., ]+)?\s*\{'
    regions = []
    for match in re.finditer(pattern, mask_strings(clean)):
        start = clean.index('{', match.start())
        _, end = balanced(clean, start, '{', '}')
        regions.append((start, end, match[1]))
    return regions


def numeric_rules(text):
    """Preserve numeric source expressions and their containing method.

    These are source rules, not evaluated gameplay outputs. String/comment
    digits are excluded; operators, conditions, and units are not inferred.
    """
    clean = strip_comments(text)
    regions = method_regions(clean)
    rows, offset = [], 0
    for line_number, line in enumerate(clean.splitlines(keepends=True), 1):
        unquoted = re.sub(r'"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'', ' ', line)
        literals = NUMBER.findall(unquoted)
        if literals:
            owners = [(end-start, name) for start, end, name in regions if start <= offset < end]
            method = min(owners)[1] if owners else '<class initializer>'
            rows.append({'line': line_number, 'method': method, 'expression': line.strip(),
                         'numeric_literals': [{'java': item, 'value': number(item)} for item in literals]})
        offset += len(line)
    return rows


def class_data(upstream, path):
    text = (upstream / path).read_text()
    return {'source': source_info(upstream, path), 'declarations': numeric_declarations(text),
            'rules': numeric_rules(text)}


def extract_resources(upstream):
    recipes, tags, worldgen = {}, {}, {}
    for path in sorted((upstream / 'common/src/main/resources/data').rglob('*.json')):
        rel = path.relative_to(upstream).as_posix()
        row = {'source': source_info(upstream, rel), 'data': json.loads(path.read_text(encoding="utf-8-sig"))}
        if '/recipe/' in rel or '/recipes/' in rel or '/grilling/' in rel: recipes[rel] = row
        elif '/tags/' in rel: tags[rel] = row
        else: worldgen[rel] = row
    return {
        'recipes.json': envelope('Parse complete upstream recipe/, recipes/ and grilling/ JSON without merging loader-specific paths.', resources=recipes),
        'tags.json': envelope('Parse upstream tags/item and tags/items JSON, preserving tag references and loader paths.', resources=tags),
        'world_data.json': envelope('Parse authored loot tables, advancements, worldgen and damage types; preserve original namespace and path.', resources=worldgen),
    }


def extract_domains(upstream):
    domains = {'heat': {}, 'effects': {}, 'hud': {}, 'animation_curves': {}, 'gameplay_rules': {}}
    collisions, sounds = {}, {}
    for loader in LOADERS:
        root = upstream / loader / JAVA
        for file in sorted(root.rglob('*.java')):
            rel = file.relative_to(upstream).as_posix()
            short = file.relative_to(root).as_posix()
            text = file.read_text()
            clean = strip_comments(text)
            # Keep every source numeric rule indexed, including helpers and
            # non-constant formula operands. Do not fabricate evaluation results.
            if short.endswith('Animation.java'):
                domain = 'animation_curves'
            elif 'Hud' in short:
                domain = 'hud'
            elif short.startswith(('food/', 'grill/', 'oil/')):
                domain = 'heat'
            elif short.startswith(('effect/', 'seasoning/')) or short in ('skewer/SecretSkewerItem.java', 'skewer/GoldenSkewerItem.java', 'skewer/CursedSkewerItem.java'):
                domain = 'effects'
            else:
                domain = 'gameplay_rules'
            data = class_data(upstream, rel)
            if data['declarations'] or data['rules']:
                domains[domain][rel] = data
            boxes = []
            for function in ('Block.box', 'Shapes.box', 'box'):
                for pos, args in calls(clean, function):
                    # Avoid counting qualified Block.box again as bare box.
                    if function == 'box' and pos and clean[pos-1] == '.': continue
                    if len(args) != 6: continue
                    row = {'line': clean.count('\n', 0, pos)+1, 'call': function, 'arguments': args,
                           'units': 'block units' if function == 'Shapes.box' else 'sixteenths of a block'}
                    try: row['bounds'] = [number(arg) for arg in args]
                    except ValueError: row['evaluation'] = 'parameterized; source arguments retained'
                    boxes.append(row)
            if boxes:
                definitions = [{'name': match[1], 'expression': match[2].strip(), 'line': clean.count('\n', 0, match.start())+1}
                               for match in re.finditer(r'\bVoxelShape(?:\[\])?\s+(\w+)\s*=\s*([\s\S]*?);', clean)]
                selections = [{'method': name, 'line': clean.count('\n', 0, start)+1, 'body': clean[start:end]}
                              for start, end, name in method_regions(clean) if name in ('getShape', 'getCollisionShape')]
                collisions[rel] = {'source': source_info(upstream, rel), 'boxes': boxes,
                                   'shape_definitions': definitions, 'shape_selection': selections,
                                   'note': 'Declared primitives, unions and facing/count selection are source rules, not a native collision verdict. See block_registrations for noCollission properties.'}
            audio = []
            for call in ('playSound', 'playLocalSound', 'playSeededSound', 'SimpleSoundInstance.forUI'):
                for pos, args in calls(clean, call):
                    audio.append({'line': clean.count('\n', 0, pos)+1, 'call': call, 'arguments': args})
            if audio: sounds[rel] = {'source': source_info(upstream, rel), 'calls': audio}
    output = extract_resources(upstream)
    for name, classes in domains.items():
        output[name+'.json'] = envelope('Lex Java scalar/array declarations and numeric source expressions; evaluate literal arithmetic only. Preserve method, line, formula and original loader; symbolic rules are not gameplay execution.', classes=classes)
    registrations = {}
    for loader in LOADERS:
        path = loader + '/' + JAVA + 'registry/ModBlocks.java'
        clean = strip_comments((upstream/path).read_text())
        rows = [{'name': m[1], 'expression': m[2].strip(), 'line': clean.count('\n', 0, m.start())+1}
                for m in re.finditer(r'public\s+static\s+final\s+[\w<>?,. ]+\s+(\w+)\s*=\s*([\s\S]*?);', clean)]
        registrations[path] = {'source': source_info(upstream, path), 'registrations': rows}
    output['collision_shapes.json'] = envelope('Read every six-argument Block.box/Shapes.box call and its numeric operands. Preserve complete shape definitions, getShape/getCollisionShape selection bodies and ModBlocks registrations, including noCollission properties.', classes=collisions, block_registrations=registrations)
    resources = {}
    for path in sorted(upstream.glob('**/src/main/resources/assets/kaleidoscope_grilling/sounds.json')):
        rel = path.relative_to(upstream).as_posix()
        resources[rel] = {'source': source_info(upstream, rel), 'events': json.loads(path.read_text(encoding="utf-8-sig"))}
    output['sounds.json'] = envelope('Parse authored sounds.json files and all source playSound/playLocalSound/playSeededSound/UI call arguments, retaining per-call volume and pitch expressions.', resources=resources, calls=sounds)
    return output


def extract_model_frames(upstream):
    models = {}
    base = upstream / 'common/src/main/resources/assets/kaleidoscope_grilling/models'
    for path in sorted(base.rglob('*.json')):
        obj = json.loads(path.read_text(encoding="utf-8-sig"))
        # Data needed to understand model framing; geometry remains in the
        # upstream/source_snapshots assets, not a new generated geometry layer.
        data = {key: obj[key] for key in ('parent', 'display', 'gui_light', 'ambientocclusion') if key in obj}
        # Retain detailed slot framing only for the reference secret-skewer
        # surfaces. Other geometry is already preserved in source_snapshots.
        reference = (path.name == 'secret_skewer.json' or
                     path.parent.name == 'skewer_states' and path.stem in ('state_21', 'state_42', 'state_63') or
                     path.stem in ('skewer_states_state_21_bite_1', 'skewer_states_state_21_bite_2'))
        if not reference: continue
        if reference:
            bounds = [{key: part[key] for key in ('from', 'to', 'rotation') if key in part} for part in obj.get('elements', [])]
            if bounds: data['element_bounds'] = bounds
            data['tint_slots'] = sorted({face['tintindex'] for part in obj.get('elements', []) for face in part.get('faces', {}).values() if 'tintindex' in face})
        if not data: continue
        rel = path.relative_to(upstream).as_posix()
        models[rel] = {'source': source_info(upstream, rel), 'data': data}
    return {'model_frames.json': envelope('Parse model parent/display and detailed bounds/rotation/tint slots for the six original secret-framing reference models. Other geometry and texture pixels remain in licensed source assets; these bounds are visual, not collision shapes.', models=models)}


def enrich_named_parameters(output, upstream):
    """Expose the commonly consumed values without losing source expressions."""
    heat, hud = {}, {}
    for loader in LOADERS:
        prefix = loader + '/' + JAVA
        def scalar(path, name):
            text = (upstream / (prefix+path)).read_text()
            rows = [r for r in numeric_declarations(text) if r['name'] == name]
            if len(rows) != 1 or 'value' not in rows[0]:
                raise ValueError(f'Expected one literal declaration for {path}:{name}')
            row = rows[0]
            return {'value': row['value'], 'source': source_info(upstream, prefix+path, row['line'], name), 'expression': row['expression']}
        heat[loader] = {
            'heat_bucket_ticks': scalar('food/FoodState.java', 'HEAT_BUCKET_TICKS'),
            'finished_ticks': scalar('grill/GrillBlockEntity.java', 'FINISHED_TICKS'),
            'burnt_ticks': scalar('grill/GrillBlockEntity.java', 'BURNT_TICKS'),
            'fluid_capacity': scalar('oil/OilPotCompat.java', 'FLUID_CAPACITY'),
        }
        path = prefix + 'oil/OilPotCompat.java'
        text = strip_comments((upstream/path).read_text())
        cases = re.findall(r'(?:case\s+"([^"]+)"|(default))\s*->\s*(\d+)\s*;', text)
        if len(cases) != 3: raise ValueError('Expected three oil heat-duration branches')
        heat[loader]['oil_heat_ticks'] = {'values': {key or fallback: int(value) for key, fallback, value in cases},
                                        'source': source_info(upstream, path, method='heatDuration'),
                                        'note': 'Oil pot semantics. Java oil brush items are unobtainable DescriptionItem placeholders; Bedrock brush behavior is a port adaptation.'}
        path = prefix + 'food/HotFoodConfig.java'
        text = (upstream/path).read_text()
        config = {}
        for pos, args in calls(text, 'defineInRange'):
            if len(args) != 4 or not args[0].startswith('"'): continue
            try: values = [number(arg) for arg in args[1:]]
            except ValueError: continue
            config[json.loads(args[0])] = {'default': values[0], 'min': values[1], 'max': values[2],
                                        'source': source_info(upstream, path, text.count('\n', 0, pos)+1, 'static config builder')}
        heat[loader]['config'] = config
        path = prefix + 'skewer/SkewerEatingHud.java'
        text = (upstream/path).read_text()
        width = scalar('skewer/SkewerEatingHud.java', 'WIDTH')
        height = scalar('skewer/SkewerEatingHud.java', 'HEIGHT')
        icon = scalar('skewer/SkewerEatingHud.java', 'ICON_SIZE')
        declarations = {row['name']: row for row in numeric_declarations(text)}
        offsets = {}
        for name, screen in (('x', 'screenWidth'), ('y', 'screenHeight')):
            expression = declarations[name]['expression']
            resolved = expression.replace(screen, '0').replace('WIDTH', str(width['value'])).replace('HEIGHT', str(height['value']))
            offsets[name] = {'value': number(resolved), 'expression': expression,
                             'source': source_info(upstream, path, declarations[name]['line'], 'draw')}
        colors = list(calls(text, 'RenderSystem.setShaderColor'))
        hud[loader] = {'eating_bar_width': width, 'eating_bar_height': height,
                       'icon_size': icon, 'offset_from_screen_center_x_and_bottom_y': offsets,
                       'pending_rgba': {'value': [number(arg) for arg in colors[0][1]],
                                        'source': source_info(upstream, path, text.count('\n', 0, colors[0][0])+1, 'draw')}}
    output['heat.json']['parameters'] = heat
    output['hud.json']['parameters'] = hud
    return output
