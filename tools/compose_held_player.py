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

TACZ_SHA256 = '1b78db6269be419eb2593c981df4beb88f7f9e0509c59221077ae2e965d86486'
TACZ_BP = 'TACZBehavi/entities/plalyer.json'
TACZ_RP = 'TACZResour/entity/player.entity.json'
FP = 'controller.render.player.first_person'
ASSIGNMENT = re.compile(r'^\s*(?:v|variable)\.([\w]+)\s*=')


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
    gun_bp = gun_rp = None
    if args.tacz:
        if hashlib.sha256(args.tacz.read_bytes()).hexdigest() != TACZ_SHA256:
            parser.error('TACZ archive differs from the reviewed release')
        with zipfile.ZipFile(args.tacz) as archive:
            gun_bp = json.loads(archive.read(TACZ_BP))
            gun_rp = json.loads(archive.read(TACZ_RP))
    bp, rp = compose(behavior, json.loads(raw), gun_bp, gun_rp)
    args.output.mkdir(parents=True)
    files = {'BP/entities/player.json': bp, 'RP/entity/player.entity.json': rp}
    hashes = {}
    for name, value in files.items():
        path = args.output / name; path.parent.mkdir(parents=True, exist_ok=True)
        data = (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode()
        path.write_bytes(data); hashes[name] = hashlib.sha256(data).hexdigest()
    receipt = {'schema': 1, 'host_player_sha256': args.host_sha256,
               'tacz_archive_sha256': TACZ_SHA256 if args.tacz else None,
               'player_properties': len(bp['minecraft:entity']['description']['properties']),
               'outputs': hashes, 'client': False, 'production_ready': False}
    (args.output / 'receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps(receipt))


if __name__ == '__main__':
    main()
