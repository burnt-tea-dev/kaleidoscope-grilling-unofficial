"""Compose the selected host player with Grilling and an optional TACZ input.

Owned rules only. Complete author definitions are supplied locally and remain
local. This produces reviewable source output; it never installs or admits it.
"""
import argparse
import copy
import hashlib
import json
from pathlib import Path
import re
import zipfile

from held_snapshot_properties import BASE, configure_player
from guards.jsonc import strip_jsonc

TACZ_SHA256 = '1b78db6269be419eb2593c981df4beb88f7f9e0509c59221077ae2e965d86486'
TACZ_BP = 'TACZBehavi/entities/plalyer.json'
TACZ_RP = 'TACZResour/entity/player.entity.json'
FP = 'controller.render.player.first_person'
ASSIGNMENT = re.compile(r'^\s*(?:v|variable)\.([\w]+)\s*=')
OFFHAND_RESERVED = "q.is_item_equipped('off_hand')"
BROKEN_MODEL = 'models/entity/7sf3y8pgug/5q9tvlnhgh/lmkxjsnrit/jfgkkrr92y/y7rwInQT2sq3l6gu.json'
BROKEN_MODEL_SHA256 = '265db68ca89f6da9bb661d8f6d2ba7e515ad0a43fac1c83767b210590d92ddc0'


def normalize(statement):
    return re.sub(r'\s+', '', statement.replace('variable.', 'v.').replace('query.', 'q.')).lower()


def merge_identical(left, right, path=''):
    result = copy.deepcopy(left)
    for key, value in right.items():
        if key not in result:
            result[key] = copy.deepcopy(value)
        elif isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = merge_identical(result[key], value, path + '/' + key)
        elif result[key] != value:
            raise ValueError('Conflicting player definition: ' + path + '/' + key)
    return result


def merge_script_lines(host, gun, phase):
    # A duplicated hand_bob assignment advances the same state twice per frame.
    # Match native assignment owners, not just differently spaced source text.
    native = {m[1]: line for line in host if isinstance(line, str) and (m := ASSIGNMENT.match(line))}
    output = []
    seen = set()
    attack = None
    for line in gun:
        m = ASSIGNMENT.match(line) if isinstance(line, str) else None
        if m and m[1] in native:
            name = m[1]
            if phase == 'pre_animation' and name == 'attack_body_rot_y':
                attack = ('variable.attack_body_rot_y = variable.holding_all_guns ? (' + line.partition('=')[2].rstrip('; ') +
                          ') : (' + native[name].partition('=')[2].rstrip('; ') + ');')
                continue
            # The selected 26.60 host owns native animation state. In particular
            # its duration-zero guard must survive TACZ's older vanilla copy.
            line = native[name]
        token = normalize(line) if isinstance(line, str) else json.dumps(line, sort_keys=True)
        if token not in seen:
            output.append(copy.deepcopy(line)); seen.add(token)
    for line in host:
        m = ASSIGNMENT.match(line) if isinstance(line, str) else None
        if attack and m and m[1] == 'attack_body_rot_y':
            continue
        token = normalize(line) if isinstance(line, str) else json.dumps(line, sort_keys=True)
        if token not in seen:
            output.append(copy.deepcopy(line)); seen.add(token)
    if attack:
        output.append(attack)
    return output


def compose(behavior, host_player, tacz_behavior=None, tacz_player=None):
    bp = copy.deepcopy(behavior)
    rp = configure_player(host_player)
    if tacz_behavior is None and tacz_player is None:
        return bp, rp
    if tacz_behavior is None or tacz_player is None:
        raise ValueError('TACZ needs paired behavior and resource player definitions')
    before = bp['minecraft:entity']
    gun = tacz_behavior['minecraft:entity']
    if before['description']['identifier'] != 'minecraft:player' or gun['description']['identifier'] != 'minecraft:player':
        raise ValueError('Expected paired player identifiers')
    # Keep the current engine format; every other overlap must be equal or an
    # additive dictionary. This retains gun events, scripts and all 24 fields.
    bp['minecraft:entity'] = merge_identical(before, gun)
    props = bp['minecraft:entity']['description']['properties']
    if len(props) > 32:
        raise ValueError('Effective player property limit exceeded: ' + str(len(props)))
    host = rp['minecraft:client_entity']['description']
    gun = tacz_player['minecraft:client_entity']['description']
    for key, value in gun.items():
        if key in ('scripts', 'render_controllers'):
            continue
        if key not in host:
            host[key] = copy.deepcopy(value)
        elif isinstance(host[key], dict) and isinstance(value, dict):
            host[key] = merge_identical(host[key], value, '/client/' + key)
        elif host[key] != value:
            raise ValueError('Conflicting client player: ' + key)
    scripts = host['scripts']
    for key, value in gun['scripts'].items():
        if key in ('initialize', 'pre_animation', 'animate'):
            scripts[key] = merge_script_lines(scripts.get(key, []), value, key)
        elif isinstance(value, dict):
            scripts[key] = merge_identical(scripts.get(key, {}), value, '/scripts/' + key)
        elif key not in scripts or scripts[key] == value:
            scripts[key] = copy.deepcopy(value)
        else:
            raise ValueError('Conflicting client player script: ' + key)
    controllers = copy.deepcopy(host['render_controllers'])
    aliases = {next(iter(row)) if isinstance(row, dict) else row for row in controllers}
    matched = 0
    for row in controllers:
        if isinstance(row, dict) and FP in row:
            row[FP] = '(' + row[FP] + ') && !variable.holding_all_guns'; matched += 1
    if matched != 1:
        raise ValueError('Expected exactly one host first-person route')
    for row in gun['render_controllers']:
        alias = next(iter(row)) if isinstance(row, dict) else row
        if alias not in aliases:
            # Gun controllers in the source include TP routes. Keep each source
            # condition; do not incorrectly restrict every gun model to FP.
            controllers.append(copy.deepcopy(row)); aliases.add(alias)
    host['render_controllers'] = controllers
    return bp, rp


def reserve_offhand(animation):
    """Separate the left arm so its weight can change without changing curves.

    Native cubic interpolation precomputes constant keyframes. Putting an
    equipment query in those keyframes makes the client reject the animation.
    Keep the curves numeric and gate this arm's animation with blend_weight.
    """
    result = copy.deepcopy(animation)
    arm = {key: copy.deepcopy(value) for key, value in animation.items()
           if key not in ('bones', 'sound_effects', 'particle_effects', 'timeline')}
    arm['bones'] = {}
    for bone, pose in list(result.get('bones', {}).items()):
        if bone.lower() == 'leftarm':
            if result.get('override_previous_animation') or set(pose) - {'position', 'rotation', 'scale'}:
                raise ValueError('Unreviewed TACZ left-arm composition')
            arm['bones'][bone] = result['bones'].pop(bone)
    if not arm['bones']:
        return result, None
    arm['blend_weight'] = '(' + str(animation.get('blend_weight', 1)) + ') * (!' + OFFHAND_RESERVED + ')'
    return result, arm


def extend_arm_routes(rows, aliases):
    """Start both halves in the same controller state with the same weight."""
    result = []
    for row in rows:
        result.append(copy.deepcopy(row))
        if isinstance(row, str):
            if row in aliases:
                result.append(aliases[row])
        else:
            companion = {aliases[key]: value for key, value in row.items() if key in aliases}
            if companion:
                result.append(companion)
    return result


def compose_arm_routes(player, controllers, split):
    description = player['minecraft:client_entity']['description']
    aliases = {}
    for alias, animation in list(description['animations'].items()):
        if animation not in split:
            continue
        companion = alias + '_kg_left_arm'
        if companion in description['animations']:
            raise ValueError('Unreviewed TACZ left-arm composition')
        description['animations'][companion] = split[animation]
        aliases[alias] = companion
    scripts = description['scripts']
    scripts['animate'] = extend_arm_routes(scripts.get('animate', []), aliases)
    for document in controllers.values():
        for controller in document.get('animation_controllers', {}).values():
            for state in controller['states'].values():
                if 'animations' in state:
                    state['animations'] = extend_arm_routes(state['animations'], aliases)


def repair_model(raw):
    # The reviewed release accidentally appends an exact duplicate of its own
    # trailing limb fragment after a complete 53-bone model. Accept only that
    # exact input and duplicate suffix, never discard arbitrary trailing data.
    if hashlib.sha256(raw).hexdigest() != BROKEN_MODEL_SHA256:
        raise ValueError('TACZ model preimage differs')
    text = raw.decode('utf-8-sig').lstrip()
    value, end = json.JSONDecoder().raw_decode(text)
    tail = text[end:].strip()
    if not tail or not text[:end].rstrip().endswith(tail):
        raise ValueError('Expected exact duplicated model suffix')
    return value


def compose_files(behavior, host_player, tacz_archive=None):
    """One entry for CLI, local installer and private source generation."""
    overrides = {}
    controllers = {}
    split = {}
    gun_bp = gun_rp = None
    if tacz_archive is not None:
        if hashlib.sha256(Path(tacz_archive).read_bytes()).hexdigest() != TACZ_SHA256:
            raise ValueError('TACZ archive differs from the reviewed release')
        with zipfile.ZipFile(tacz_archive) as archive:
            gun_bp = json.loads(archive.read(TACZ_BP))
            gun_rp = json.loads(archive.read(TACZ_RP))
            # These four source controllers refer to undeclared walking
            # aliases. Use the author's existing common pistol pose (also
            # selected by M9) before splitting and routing its left arm.
            gun_rp['minecraft:client_entity']['description']['animations'].update({
                name + '_fp_walk': 'animation.default.fp.walk'
                for name in ('g17', 'g18', 'deagle', 'm1911')})
            for name in archive.namelist():
                if name.startswith('TACZResour/animation_controllers/') and name.endswith('.json'):
                    controllers['RP/' + name.removeprefix('TACZResour/')] = json.loads(strip_jsonc(archive.read(name).decode('utf-8-sig')))
                if not name.startswith('TACZResour/animations/') or not name.endswith('.json'):
                    continue
                original = json.loads(strip_jsonc(archive.read(name).decode('utf-8-sig')))
                changed = copy.deepcopy(original)
                for key, value in original.get('animations', {}).items():
                    body, arm = reserve_offhand(value)
                    if arm is None:
                        continue
                    companion = key + '.kg_left_arm'
                    if companion in original['animations']:
                        raise ValueError('TACZ companion animation already exists')
                    changed['animations'][key] = body
                    changed['animations'][companion] = arm
                    split[key] = companion
                if changed != original:
                    overrides['RP/' + name.removeprefix('TACZResour/')] = changed
            overrides['RP/' + BROKEN_MODEL] = repair_model(archive.read('TACZResour/' + BROKEN_MODEL))
    bp, rp = compose(behavior, host_player, gun_bp, gun_rp)
    if tacz_archive is not None:
        before = copy.deepcopy(controllers)
        compose_arm_routes(rp, controllers, split)
        overrides.update({name: value for name, value in controllers.items() if value != before[name]})
    return {'BP/entities/player.json': bp, 'RP/entity/player.entity.json': rp, **overrides}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--host-player', type=Path, required=True)
    parser.add_argument('--host-sha256', required=True)
    parser.add_argument('--tacz', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    raw = args.host_player.read_bytes()
    if hashlib.sha256(raw).hexdigest() != args.host_sha256:
        parser.error('Selected host player hash differs')
    if args.output.exists():
        parser.error('Choose a new local output directory')
    behavior = json.loads((BASE / 'behavior_pack/entities/player.json').read_text())
    files = compose_files(behavior, json.loads(raw), args.tacz)
    args.output.mkdir(parents=True)
    hashes = {}
    for name, value in files.items():
        path = args.output / name; path.parent.mkdir(parents=True, exist_ok=True)
        data = (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode()
        path.write_bytes(data); hashes[name] = hashlib.sha256(data).hexdigest()
    receipt = {'schema': 1, 'host_player_sha256': args.host_sha256,
               'tacz_archive_sha256': TACZ_SHA256 if args.tacz else None,
               'player_properties': len(files['BP/entities/player.json']['minecraft:entity']['description']['properties']),
               'tacz_resource_overrides': [name for name in files if name not in ('BP/entities/player.json', 'RP/entity/player.entity.json')],
               'outputs': hashes, 'client': False, 'production_ready': False}
    (args.output / 'receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps(receipt))


if __name__ == '__main__':
    main()
