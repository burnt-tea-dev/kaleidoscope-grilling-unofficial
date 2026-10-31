"""Generate the player controls declaration and guarded Molang readers.

core/player_props.js owns the schema. This updates existing consumers in place;
packing only exports the resulting canonical BP/RP without runtime transforms.
"""
import argparse
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'projects/grilling/gameplay_core'
PREFIX = 'kaleidoscope_grilling:'
PROPERTIES = ('eat_profile', 'eat_hand', 'eat_projection', 'eat_native_ticks', 'eat_elapsed_ticks')
VARIABLE_PREFIX = 'v.kg_owner_'
OWNER = 'c.owning_entity->q.'


def schema():
    module = (BASE / 'behavior_pack/scripts/core/player_props.js').as_uri()
    return json.loads(subprocess.check_output(['node', '--input-type=module', '-e',
        'import {CONTROL_FIELDS,CONTROLS_PROPERTY,CONTROLS_MAX} from ' + json.dumps(module) +
        ';process.stdout.write(JSON.stringify({fields:CONTROL_FIELDS,property:CONTROLS_PROPERTY,max:CONTROLS_MAX}));'], text=True))


SCHEMA = schema()
FIELDS = SCHEMA['fields']
READ = re.compile(r"((?:c\.owning_entity->)?(?:q|query))\.(property|has_property)\('kaleidoscope_grilling:(" + '|'.join(FIELDS) + r")'\)")


def property_read(name, owner='q'):
    key = SCHEMA['property'] if name in FIELDS else PREFIX + name
    guarded = '(' + owner + ".has_property('" + key + "') ? " + owner + ".property('" + key + "') : 0)"
    if name not in FIELDS:
        return guarded
    f = FIELDS[name]
    return '(math.mod(math.floor(' + guarded + ' / ' + str(2 ** f['shift']) + '), ' + str(2 ** f['bits']) + '))'


def initialization():
    return [VARIABLE_PREFIX + name + ' = ' + property_read(name, 'c.owning_entity->q') + ';' for name in PROPERTIES]


def document(value):
    if isinstance(value, str):
        return READ.sub(lambda m: m[1] + ".has_property('" + SCHEMA['property'] + "')" if m[2] == 'has_property' else property_read(m[3], m[1]), value)
    if isinstance(value, list):
        return [document(row) for row in value]
    if isinstance(value, dict):
        return {key: document(row) for key, row in value.items()}
    return value


def augment(output):
    return {path: document(value) if path.suffix == '.json' else value for path, value in output.items()}


def generate(check=False):
    changes = []
    player = BASE / 'behavior_pack/entities/player.json'
    paths = [player, *sorted((BASE / 'resource_pack').rglob('*.json'))]
    for path in paths:
        original = path.read_text()
        result = document(original) if path != player else json.loads(original)
        if path == player:
            props = result['minecraft:entity']['description']['properties']
            for name in FIELDS:
                props.pop(PREFIX + name, None)
            props[SCHEMA['property']] = {'type': 'int', 'range': [0, SCHEMA['max']], 'default': 0, 'client_sync': True}
            if len(props) > 27:
                raise ValueError('Player property budget exceeds 27')
            result = json.dumps(result, ensure_ascii=False, indent=2) + '\n'
        if result != original:
            changes.append(str(path.relative_to(ROOT)))
            if not check:
                path.write_text(result)
    if check and changes:
        raise ValueError('Player controls consumers need regeneration: ' + ', '.join(changes))
    return changes


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    print('Player controls: ' + str(len(generate(args.check))) + ' files require changes')
