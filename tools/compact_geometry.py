"""Share identical meshes and keep canonical geometry banks below 512 KiB.

Only the identifier is ignored when comparing definitions. Bones, pivots, UVs,
render bounds and format version must match. Textures and material bindings stay
with their consumers. Run after authoring model changes; no second source pack
or export-time gameplay transform is involved.
"""
from pathlib import Path
import argparse
import copy
import json
import re

ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / 'projects/grilling/gameplay_core'
LIMIT = 512 * 1024


def encoded(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':')).encode()


def generated_identifier(identifier):
    # These identifiers are an authoring API used by the existing sprite/icon
    # generators. Their meshes stay independent even if currently identical.
    return (identifier.startswith('geometry.kg_native_icon.') or
            identifier in {'geometry.kg_secret_held.food_piece_'+str(i) for i in range(218, 226)})


def bank_bytes(header, geometries):
    prefix = encoded(header)[:-1]
    return prefix + b',"minecraft:geometry":[\n' + b',\n'.join(map(encoded, geometries)) + b'\n]}\n'


def plan(pack):
    resource = pack / 'resource_pack'
    models = resource / 'models'
    definitions, groups, original = {}, {}, {}
    for path in sorted(models.rglob('*.json')):
        raw = path.read_bytes()
        value = json.loads(raw)
        if 'minecraft:geometry' not in value:
            continue
        original[path] = raw
        base = path.with_name(re.sub(r'\.part-\d+(?=\.geo\.json$)', '', path.name))
        header = {k: v for k, v in value.items() if k != 'minecraft:geometry'}
        group = groups.setdefault(base, {'header': header, 'rows': []})
        if group['header'] != header:
            raise ValueError('Geometry bank format mismatch: '+str(base))
        for geometry in value['minecraft:geometry']:
            identifier = geometry['description']['identifier']
            if identifier in definitions:
                raise ValueError('Duplicate geometry identifier: '+identifier)
            definitions[identifier] = geometry
            group['rows'].append(geometry)

    aliases, seen, output = {}, {}, {}
    before_count = len(definitions)
    for base, group in groups.items():
        kept = []
        for geometry in group['rows']:
            identifier = geometry['description']['identifier']
            shape = copy.deepcopy(geometry)
            del shape['description']['identifier']
            fingerprint = json.dumps([group['header'], shape], sort_keys=True, separators=(',', ':'))
            if not generated_identifier(identifier) and fingerprint in seen:
                aliases[identifier] = seen[fingerprint]
                continue
            seen.setdefault(fingerprint, identifier)
            kept.append(geometry)
        # Keep the existing sprite generator's eight inputs in its original
        # file. Older helper meshes can be read normally from sibling banks.
        if base.name == 'secret_helper_sprites.geo.json':
            primary = [g for g in kept if generated_identifier(g['description']['identifier'])]
            pending = [g for g in kept if g not in primary]
        else:
            primary, pending = [], kept
        banks = [primary] if primary else []
        current = []
        for geometry in pending:
            if len(bank_bytes(group['header'], [geometry])) > LIMIT:
                raise ValueError('A single geometry exceeds 512 KiB: '+geometry['description']['identifier'])
            if current and len(bank_bytes(group['header'], current+[geometry])) > LIMIT:
                banks.append(current)
                current = []
            current.append(geometry)
        if current:
            banks.append(current)
        for index, rows in enumerate(banks):
            path = base if index == 0 else base.with_name(base.name.removesuffix('.geo.json')+f'.part-{index:03}.geo.json')
            output[path] = bank_bytes(group['header'], rows)

    def references(value):
        if isinstance(value, str):
            return aliases.get(value, value)
        if isinstance(value, list):
            return [references(v) for v in value]
        if isinstance(value, dict):
            return {k: references(v) for k, v in value.items()}
        return value

    for side in ('behavior_pack', 'resource_pack'):
        for path in sorted((pack/side).rglob('*.json')):
            if path in original:
                continue
            raw = path.read_bytes()
            value = json.loads(raw)
            changed = references(value)
            if changed != value:
                output[path] = (json.dumps(changed, ensure_ascii=False, indent=2)+'\n').encode()
    changes = {p: raw for p, raw in output.items() if not p.exists() or p.read_bytes() != raw}
    removed = set(original)-set(output)
    return changes, removed, {
        'definitions_before': before_count, 'identical_definitions_removed': len(aliases),
        'geometry_bytes_before': sum(map(len, original.values())),
        'geometry_bytes_after': sum(len(raw) for p, raw in output.items() if p.is_relative_to(models)),
        'largest_geometry_file_bytes': max(len(raw) for p, raw in output.items() if p.is_relative_to(models)),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--write', action='store_true')
    args = parser.parse_args()
    changes, removed, report = plan(PACK)
    if args.write:
        for path, raw in changes.items():
            path.write_bytes(raw)
        for path in removed:
            path.unlink()
    print(json.dumps({**report, 'changed_files': len(changes), 'removed_files': len(removed)}, indent=2))
    if not args.write and (changes or removed):
        raise SystemExit('Run tools/compact_geometry.py --write to update canonical assets')


if __name__ == '__main__':
    main()
