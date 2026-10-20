"""Read-only asset candidate discovery; never authorizes deletion or client parity."""
from __future__ import annotations
import argparse
from collections import defaultdict, deque
import json
import re
from pathlib import Path
import subprocess
import sys

from guards.jsonc import strip_jsonc
from bridge_project import unique_object

ROOT = Path(__file__).resolve().parents[1]
TEXT = {'.json', '.jsonc', '.js', '.mjs', '.cjs', '.ts', '.py', '.molang'}
IMAGES = {'.png', '.tga', '.jpg', '.jpeg'}


def read_json(path):
    return json.loads(strip_jsonc(path.read_text(encoding='utf-8-sig')),
                      object_pairs_hook=unique_object)


def strings(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, list):
        for item in value:
            yield from strings(item)
    elif isinstance(value, dict):
        for key, item in value.items():
            yield key
            yield from strings(item)


def reference_index(needles, sources):
    """Match literal substrings in one pass per source (including overlapping keys)."""
    edges, failures, outputs = [{}], [0], [set()]
    for needle in sorted(needles):
        state = 0
        for char in needle:
            if char not in edges[state]:
                edges[state][char] = len(edges)
                edges.append({})
                failures.append(0)
                outputs.append(set())
            state = edges[state][char]
        outputs[state].add(needle)
    queue = deque(edges[0].values())
    while queue:
        state = queue.popleft()
        for char, child in edges[state].items():
            queue.append(child)
            fallback = failures[state]
            while fallback and char not in edges[fallback]:
                fallback = failures[fallback]
            failures[child] = edges[fallback].get(char, 0)
            outputs[child].update(outputs[failures[child]])
    references = defaultdict(set)
    for name, text in sources:
        state, found = 0, set()
        for char in text:
            while state and char not in edges[state]:
                state = failures[state]
            state = edges[state].get(char, 0)
            if outputs[state]:
                found.update(outputs[state])
        for needle in found:
            references[needle].add(name)
    return references


def scan(root, rp, files, consumers=()):
    """Return candidates, not a safe-delete list. Paths outside roots are rejected."""
    root, rp = root.resolve(), rp.resolve()
    rp.relative_to(root)
    sources = []
    errors = []
    geometries = []
    textures = []
    for label, base, paths in [('repo', root, files), *consumers]:
        base = base.resolve()
        for path in sorted(set(paths)):
            try:
                path = path.absolute()
                if path.is_symlink():
                    raise ValueError('symlink input requires manual review')
                # Canonicalize both sides before containment checks: Windows TEMP
                # may use an 8.3 user alias while base.resolve() uses the long name.
                path = path.resolve()
                rel = path.relative_to(base).as_posix()
                if not path.is_file():
                    raise ValueError('missing or non-file input')
                source = f'{label}:{rel}'
                if label == 'repo' and path.is_relative_to(rp / 'textures') and path.suffix.lower() in IMAGES:
                    textures.append({'path': rel, 'id': path.relative_to(rp).with_suffix('').as_posix(),
                                     'bytes': path.stat().st_size})
                if path.suffix.lower() not in TEXT:
                    continue
                if path.suffix.lower() in {'.json', '.jsonc'}:
                    obj = read_json(path)
                    if label == 'repo' and path.is_relative_to(rp / 'models'):
                        if not isinstance(obj, dict):
                            raise ValueError('geometry root must be an object')
                        if 'minecraft:geometry' not in obj and not any(k.startswith('geometry.') for k in obj):
                            raise ValueError('unsupported geometry schema')
                        modern = obj.get('minecraft:geometry', [])
                        if not isinstance(modern, list):
                            raise ValueError('minecraft:geometry must be an array')
                        for geometry in modern:
                            desc = geometry['description']
                            identifier = desc.pop('identifier')
                            if not isinstance(identifier, str) or not identifier.startswith('geometry.'):
                                raise ValueError('invalid geometry identifier')
                            geometries.append({'id': identifier, 'path': rel, 'bytes': path.stat().st_size})
                        # Legacy keys define geometries; preserve all nested consumer strings.
                        legacy = [key for key in obj if key.startswith('geometry.')]
                        for key in legacy:
                            geometries.append({'id': key, 'path': rel, 'bytes': path.stat().st_size})
                            obj.setdefault('_legacy_geometry_bodies', []).append(obj.pop(key))
                    sources.append((source, '\n'.join(strings(obj))))
                else:
                    # Conservative: include comments and split-expression context as text.
                    text = path.read_text(encoding='utf-8-sig')
                    decoded = re.sub(r'\\u\{([0-9a-fA-F]{1,6})\}|\\u([0-9a-fA-F]{4})|\\x([0-9a-fA-F]{2})',
                                     lambda m: chr(int(next(g for g in m.groups() if g), 16)), text)
                    sources.append((source, text + '\n' + decoded.replace(r'\/', '/')))
            except (ValueError, OSError, KeyError, TypeError) as exc:
                errors.append({'source': f'{label}:{path.name}', 'error': str(exc)})
    definitions = defaultdict(list)
    for item in geometries:
        definitions[item['id']].append(item['path'])
    for identifier, paths in definitions.items():
        if len(paths) > 1:
            errors.append({'geometry': identifier, 'error': 'duplicate geometry definition', 'paths': paths})
    needles_by_asset = []
    for item in geometries + textures:
        # T2.8 matches geometry identifiers and texture paths, not model filenames
        # in generated hash inventories. Such inventories need separate update review.
        local_path = (root / item['path']).relative_to(rp).as_posix()
        needles_by_asset.append({item['id']} if item in geometries else {item['id'], item['path'], local_path})
    references = reference_index(set().union(*needles_by_asset) if needles_by_asset else set(), sources)
    for item, needles in zip(geometries + textures, needles_by_asset):
        item['references'] = sorted(set().union(*(references[n] for n in needles)))
    grouped = defaultdict(list)
    for item in geometries:
        grouped[item['path']].append(item)
    whole = [path for path, items in sorted(grouped.items()) if all(not x['references'] for x in items)]
    return {
        'scope': 'tracked and nonignored working-tree literal-reference candidates only',
        'deletion_authorized': False,
        'external_consumers_complete': False, 'dynamic_references_proven_absent': False,
        'staging_verified': False, 'scanned_text_files': len(sources), 'errors': errors,
        'geometry_definition_count': len(geometries), 'texture_count': len(textures),
        'whole_geometry_file_candidates': whole,
        'geometry_candidates': [x for x in geometries if not x['references']],
        'texture_candidates': [x for x in textures if not x['references']],
        'limits': ['Review dynamically assembled references and all enabled family consumers.',
                   'A candidate identifier in a mixed file does not authorize deleting that file.',
                   'Geometry filename/hash inventories are not identifier consumers; review them separately.',
                   'Require manual samples and before/after Blockbench, bridge. and staging checks.'],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    unused = sub.add_parser('unused-assets', help='print candidates; does not modify files')
    unused.add_argument('--consumer-root', type=Path, action='append', default=[],
                        help='additional authorized pack/source directory; repeat for multiple consumers')
    args = parser.parse_args()
    baseline = read_json(ROOT / 'baseline.json')
    tracked = subprocess.check_output(['git', 'ls-files', '--cached', '--others', '--exclude-standard', '-z'], cwd=ROOT).decode().split('\0')
    consumers = [(f'consumer-{i}', path.resolve(), list(path.resolve().rglob('*')))
                 for i, path in enumerate(args.consumer_root)]
    for _, path, _ in consumers:
        if not path.is_dir():
            parser.error(f'consumer root is not a directory: {path}')
    # Directories are traversal entries, not scanned documents.
    consumers = [(label, path, [p for p in files if not p.is_dir()]) for label, path, files in consumers]
    result = scan(ROOT, ROOT / baseline['runtime']['RP'], [ROOT / p for p in tracked if p], consumers)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if result['errors'] else 0


if __name__ == '__main__':
    sys.exit(main())
