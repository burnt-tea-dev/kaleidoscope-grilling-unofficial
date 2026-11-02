"""Generate the four-property readers and the owned player extension.

The caller supplies the selected client player definition. Never replace it
with a stale vanilla sample or publish an author's complete player definition.
"""
import argparse
import copy
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'projects/grilling/gameplay_core'


def schema():
    scripts = BASE / 'behavior_pack/scripts'
    source = ('import * as s from ' + json.dumps((scripts / 'held_visual_transport.js').as_uri()) + ';'
              'import {heldVisualPropertyNames} from ' + json.dumps((scripts / 'held_visual_transport.js').as_uri()) + ';'
              "const fields=Object.fromEntries(['main','off'].flatMap(hand=>heldVisualPropertyNames(hand).map((key,i)=>[key,{variable:s.variableName(hand,i),read:s.heldWordMolang(hand,i),ownerRead:s.heldWordMolang(hand,i,'c.owning_entity->q')}])));"
              'process.stdout.write(JSON.stringify({fields,frame:s.FRAME_PROPERTY,max:s.FRAME_MAX,frameVariable:s.FRAME_VARIABLE,animation:s.SNAPSHOT_ANIMATION,controller:s.SNAPSHOT_CONTROLLER}));')
    return json.loads(subprocess.check_output(['node', '--input-type=module', '-e', source], text=True))


SCHEMA = schema()
READ = re.compile(r"((?:c\.owning_entity->)?(?:q|query))\.(property|has_property)\('(" + '|'.join(map(re.escape, SCHEMA['fields'])) + r")'\)")


def document(value):
    if isinstance(value, str):
        def replace(match):
            owner, operation, key = match.groups()
            if operation == 'has_property':
                prop = owner + ".property('" + SCHEMA['frame'] + "')"
                scope = 'c.owning_entity->' if owner.startswith('c.') else ''
                return '(' + owner + ".has_property('" + SCHEMA['frame'] + "') && " + prop + ' > 0 && ' + scope + SCHEMA['frameVariable'] + ' == ' + prop + ')'
            return SCHEMA['fields'][key]['ownerRead' if owner.startswith('c.') else 'read'].replace('q.', 'query.') if owner.endswith('query') else SCHEMA['fields'][key]['ownerRead' if owner.startswith('c.') else 'read']
        return READ.sub(replace, value)
    if isinstance(value, list):
        return [document(row) for row in value]
    if isinstance(value, dict):
        return {key: document(row) for key, row in value.items()}
    return value


def player_extension():
    variables = [row['variable'].replace('v.', 'variable.', 1) for row in SCHEMA['fields'].values()]
    variables.append(SCHEMA['frameVariable'].replace('v.', 'variable.', 1))
    animate = []
    animations = {SCHEMA['animation']: SCHEMA['animation'], SCHEMA['controller']: SCHEMA['controller']}
    for hand, slot in [('main', 'mainhand'), ('off', 'offhand')]:
        alias = 'kg_held_oil_brush_' + hand
        animations[alias] = 'animation.kg_oil_brush.player.' + hand
        marker = SCHEMA['fields']['kaleidoscope_grilling:secret_' + hand + '_piece']['read']
        animate.append({alias: marker + " == 225 && q.is_item_name_any('slot.weapon." + slot + "','kaleidoscope_cookery:oil_pot','kaleidoscope_cookery:oil_pot_filled')"})
    return {'schema': 1, 'identifier': 'minecraft:player',
            'scripts': {'variables': {name: 'public' for name in variables},
                        'initialize': [name + ' = 0;' for name in variables], 'animate': animate},
            'animations': animations}



def configure_player(player, extension=None):
    result = copy.deepcopy(player)
    description = result['minecraft:client_entity']['description']
    extension = player_extension() if extension is None else extension
    if description.get('identifier') != extension['identifier']:
        raise ValueError('Player extension needs the selected minecraft:player')
    scripts = description.setdefault('scripts', {})
    for name, access in extension['scripts']['variables'].items():
        previous = scripts.setdefault('variables', {}).get(name)
        if previous is not None and previous != access:
            raise ValueError('Conflicting player variable: ' + name)
        scripts['variables'][name] = access
    for statement in extension['scripts']['initialize']:
        if statement not in scripts.setdefault('initialize', []):
            scripts['initialize'].append(statement)
    for entry in extension['scripts']['animate']:
        # Skin previews also run pre_animation without a gameplay actor. UI
        # models keep the native arm pose; only world rendering reads held data.
        # Initialized local weights also keep the animation phase actor-free.
        for alias, condition in entry.items():
            weight = 'v.' + alias + '_active'
            initial = weight + ' = 0;'
            update = weight + ' = q.is_in_ui ? 0 : (' + condition + ');'
            if initial not in scripts['initialize']:
                scripts['initialize'].append(initial)
            if update not in scripts.setdefault('pre_animation', []):
                scripts['pre_animation'].append(update)
            cached = {alias: weight}
            if cached not in scripts.setdefault('animate', []):
                scripts['animate'].append(cached)
    for alias, animation in extension['animations'].items():
        previous = description.setdefault('animations', {}).get(alias)
        if previous is not None and previous != animation:
            raise ValueError('Conflicting player animation: ' + alias)
        description['animations'][alias] = animation
    return result


def generate(check=False):
    changes = []
    player = BASE / 'behavior_pack/entities/player.json'
    value = json.loads(player.read_text())
    props = value['minecraft:entity']['description']['properties']
    for key in SCHEMA['fields']:
        props.pop(key, None)
    props[SCHEMA['frame']] = {'type': 'int', 'range': [0, SCHEMA['max']], 'default': 0, 'client_sync': True}
    if len(props) != 4:
        raise ValueError('Expected controls, two clocks and held frame')
    output = {player: value,
              BASE / 'behavior_pack/host-extensions/player-presentation.json': player_extension(),
              BASE / 'resource_pack/animations/held_snapshot.animation.json': {
                  'format_version': '1.8.0', 'animations': {SCHEMA['animation']: {'loop': True, 'animation_length': 1}}},
              BASE / 'resource_pack/animation_controllers/held_snapshot.controller.json': {
                  'format_version': '1.10.0', 'animation_controllers': {SCHEMA['controller']: {'initial_state': 'default', 'states': {'default': {}}}}}}
    for path in sorted((BASE / 'resource_pack').rglob('*.json')):
        text = path.read_text()
        changed = document(text)
        if changed != text:
            output[path] = changed
    for path, value in output.items():
        text = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False, indent=2) + '\n'
        if path.exists() and path.read_text() == text:
            continue
        changes.append(str(path.relative_to(ROOT)))
        if not check:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text)
    if check and changes:
        raise ValueError('Held snapshot regeneration required: ' + ', '.join(changes))
    return changes


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--player-template', type=Path)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    if args.player_template:
        if not args.output or args.output.exists() or args.output.resolve() == args.player_template.resolve():
            parser.error('Choose a new --output for the selected player template')
        args.output.write_text(json.dumps(configure_player(json.loads(args.player_template.read_text())), ensure_ascii=False, indent=2) + '\n')
    else:
        print(json.dumps(generate(args.check)))
