#!/usr/bin/env python3
"""Generate Grilling's native creative menu from its reviewed purpose groups."""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATEGORIES = ('construction', 'equipment', 'items', 'nature')
CATALOG = 'item_catalog/crafting_item_catalog.json'


def encoded(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode()


def planned(root=ROOT):
    root = Path(root)
    baseline = json.loads((root / 'baseline.json').read_bytes())
    bp, rp = (root / baseline['runtime'][side] for side in ('BP', 'RP'))
    rules = json.loads((root / 'data/creative-groups.json').read_bytes())
    groups = rules['groups']
    by_name = {spec['name']: alias for alias, spec in groups.items()}
    catalog = json.loads((bp / CATALOG).read_bytes())
    membership, identifiers = {}, {}
    for category in catalog['minecraft:crafting_items_catalog']['categories']:
        for group in category['groups']:
            identifier = group.get('group_identifier', {})
            key = (category['category_name'], identifier.get('name'))
            identifiers[key] = identifier
            for item in group['items']:
                membership.setdefault(item, key)
    definitions = {}
    for folder, kind in (('items', 'minecraft:item'), ('blocks', 'minecraft:block')):
        for path in sorted((bp / folder).rglob('*.json')):
            document = json.loads(path.read_bytes())
            description = document[kind]['description']
            if description.get('menu_category', {}).get('category') in CATEGORIES:
                item = description['identifier']
                definitions.setdefault(item, []).append((path, document, kind))
                membership.setdefault(item, (description['menu_category']['category'],
                                             description['menu_category'].get('group')))
    output, buckets, used = {}, {}, set()
    for item, (category, name) in membership.items():
        rows = definitions.get(item, [])
        if not rows:
            continue  # Hidden eating/fill variants must never become creative items.
        alias = (rules['items'].get(item) or rules['group_moves'].get(name)
                 or by_name.get(name))
        if alias:
            spec = groups[alias]
            category, name = spec['category'], spec['name']
            identifiers[(category, name)] = {'name': name, 'icon': spec['icon']}
            used.add(alias)
            for path, document, kind in rows:
                menu = document[kind]['description']['menu_category']
                desired = {**menu, 'category': category, 'group': name}
                if menu != desired:
                    document[kind]['description']['menu_category'] = desired
                    output[path] = encoded(document)
        buckets.setdefault((category, name), []).append(item)
    catalog['minecraft:crafting_items_catalog']['categories'] = [
        {'category_name': category, 'groups': [
            {'group_identifier': identifiers[key], 'items': items}
            for key, items in buckets.items() if key[0] == category]}
        for category in CATEGORIES if any(key[0] == category for key in buckets)]
    output[bp / CATALOG] = encoded(catalog)
    for locale in ('en_US', 'zh_CN', 'zh_TW'):
        path = rp / 'texts' / (locale + '.lang')
        labels = {spec['name']: spec['labels'][locale]
                  for alias, spec in groups.items() if alias in used}
        lines = path.read_text(encoding='utf-8').splitlines()
        pending = dict(labels)
        for index, line in enumerate(lines):
            key = line.split('=', 1)[0]
            if key in labels:
                lines[index] = key + '=' + labels[key]
                pending.pop(key, None)
        lines.extend(key + '=' + label for key, label in pending.items())
        output[path] = ('\n'.join(lines) + '\n').encode()
    return {path: raw for path, raw in output.items() if raw != path.read_bytes()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    changes = planned()
    if args.check and changes:
        parser.exit(1, 'Regenerate creative data: ' + ', '.join(str(p.relative_to(ROOT)) for p in changes) + '\n')
    if not args.check:
        for path, raw in changes.items():
            path.write_bytes(raw)
    print(f'Creative catalog: {len(changes)} changed files')


if __name__ == '__main__':
    main()
