#!/usr/bin/env python3
"""Generate Grilling's native creative catalog from its literal Java tab plan."""
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
    plan = json.loads((root / 'data/creative-groups.json').read_bytes())
    previous = json.loads((bp / CATALOG).read_bytes())
    previous_labels = {group.get('group_identifier', {}).get('name')
                       for category in previous['minecraft:crafting_items_catalog']['categories']
                       for group in category['groups']}
    definitions = {}
    for folder, kind in (('items', 'minecraft:item'), ('blocks', 'minecraft:block')):
        for path in (bp / folder).rglob('*.json'):
            document = json.loads(path.read_bytes())
            description = document[kind]['description']
            definitions.setdefault(description['identifier'], []).append((path, document, kind))
    output, categories = {}, []
    for tab in plan['tabs']:
        members = []
        for entry in tab['entries']:
            item = entry.get('bedrock')
            if not item or entry.get('unavailable'):
                continue
            visible = [row for row in definitions.get(item, [])
                       if row[1][row[2]]['description'].get('menu_category', {}).get('category') in CATEGORIES]
            if not visible:
                continue  # Prepared secret-skewer states remain a recorded platform gap.
            members.append(item)
            for path, document, kind in visible:
                description = document[kind]['description']
                menu = {**description['menu_category'], 'category': tab['category'], 'group': tab['group']}
                description['menu_category'] = menu
                output[path] = encoded(document)
        categories.append({'category_name': tab['category'], 'groups': [{
            'group_identifier': {'name': tab['group'], 'icon': tab['icon']}, 'items': members}]})
    # Java's exclusions change creative visibility only, never persisted IDs or metadata.
    for entry in plan.get('hidden', []):
        for path, document, kind in definitions.get(entry['bedrock'], []):
            description = document[kind]['description']
            description['menu_category'] = {**description.get('menu_category', {}), 'category': 'none'}
            description['menu_category'].pop('group', None)
            output[path] = encoded(document)
    output[bp / CATALOG] = encoded({'format_version': '1.21.60',
        'minecraft:crafting_items_catalog': {'categories': categories}})
    for locale in ('en_US', 'zh_CN', 'zh_TW'):
        path = rp / 'texts' / (locale + '.lang')
        labels = {tab['group']: tab['labels'][locale] for tab in plan['tabs']}
        lines = [line for line in path.read_text(encoding='utf-8').splitlines()
                 if line.split('=', 1)[0] not in previous_labels | labels.keys()]
        lines.extend(key + '=' + value for key, value in labels.items())
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
