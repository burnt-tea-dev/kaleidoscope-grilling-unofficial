"""Reproduce the reviewed public Cookery 1.6.2 hooks from an owner's clean archive.

Only the owned declaration is written. Author modules are returned in memory or
written by the caller to temporary diagnostic storage, never to this repository.
"""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
BP = ROOT / 'projects/grilling/gameplay_core/behavior_pack'
SPEC = BP / 'host-extensions/board-api.json'
ARCHIVE_SHA256 = 'f994f8aa3b3aa4ab323c021f871f05291a827e7957aa265e17e91a085ba85b81'
HOST_UUID = '439d9798-118a-43ad-8a91-aab3161d9cb5'
RESOURCE_UUID = '01ba9a7f-877e-46c7-8583-6c0441366b55'
PREFIX = 'Kaleidoscope Cookery v1.6.2 [BP]/'
ORIGINALS = {
    'scripts/api/extensionRegistry.js': 'edeecd66d82d8bab6299717d8424133971bb47f26aacda0892d5e7ae9261b497',
    'scripts/custom_components/blocks/directStation.js': 'd107c42f21b394e1273f0e8dcf3701fb97a97a7775d26da0010a447a9c085c57',
    'scripts/custom_components/blocks/oilPot.js': 'c34d1cb0c6f125db7ebbe4e7dc1d251efd92a261dac964e4bf9d09d6e981222c',
    'items/kitchen/oil_pot.json': 'f881cc3144f2b46fe075339a0713af8f627dbdb80c31a33a32cea3e7a4010b17',
    'items/kitchen/oil_pot_filled.json': '12eacddb8ad48c8f8d3510f78f0e6489244e7bc1d4ff7ca4aa0d73c44776f1f2',
    'scripts/events/guidebook.js': 'aae402d3fc7ed52db9cda72459fbd8207f86689adc86c379cc79ccca6b9cf169',
    'scripts/events/foodItemReturns.js': '4b02c6ba37e41a311ebfc9fbac3dbbbbb6c36c33658ab2588e169e63ff1604fe',
    'scripts/data/foodEffects.js': 'f0a1750a2f22ee9335e15ef17a0d0f5791435564aad8e85aea69cfbc764b2149',
    'scripts/api/guidebookExtensionRegistry.js': 'a273bc82dc64c6899957ab51a52a08f0177292a334c8b5bbf81e823360135cd9',
    'scripts/custom_components/blocks/millstone.js': '5922c65c0c9b945371a560b97ee774c6c97b2ebc7b019a484ca00241cf297a5f',
}


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def generate(archive, declaration=None):
    raw = archive.read_bytes()
    if digest(raw) != ARCHIVE_SHA256:
        raise ValueError('Cookery 1.6.2 archive differs from the reviewed author release')
    spec = json.loads(SPEC.read_text()) if declaration is None else json.loads(json.dumps(declaration))
    spec.update(id='kaleidoscope_grilling:family-api-0.2.13', version=[0, 2, 13],
                host_uuid=HOST_UUID, archive_sha256=ARCHIVE_SHA256,
                original_files=ORIGINALS)
    completed = {}
    with zipfile.ZipFile(archive) as z:
        manifest = json.loads(z.read(PREFIX + 'manifest.json'))
        if manifest['header']['uuid'] != HOST_UUID or manifest['header']['version'] != [1, 6, 2]:
            raise ValueError('Cookery 1.6.2 host identity differs')
        for name, expected in ORIGINALS.items():
            original = z.read(PREFIX + name)
            if digest(original) != expected:
                raise ValueError('Reviewed author preimage differs: ' + name)
            text = spec['imports'].get(name, '') + original.decode('utf-8')
            if name.endswith('.json'):
                data = json.loads(text)
                for op in spec['json_updates']:
                    if op['path'] != name:
                        continue
                    if op['pointer'] != ['minecraft:item', 'components', 'minecraft:allow_off_hand'] or op['value'] is not True:
                        raise ValueError('Unexpected host item capability')
                    components = data['minecraft:item']['components']
                    if 'minecraft:allow_off_hand' in components:
                        raise ValueError('Host already owns the added capability')
                    components['minecraft:allow_off_hand'] = True
                text = json.dumps(data, ensure_ascii=False, indent=2) + '\n'
            for op in spec['insertions']:
                if op['path'] != name:
                    continue
                anchor = op['anchor']
                if not anchor or text.count(anchor) != 1 or op['position'] not in ['before', 'after']:
                    raise ValueError('Reviewed insertion anchor differs: ' + name)
                text = text.replace(anchor, op['text'] + anchor if op['position'] == 'before' else anchor + op['text'])
            completed[name] = text.encode('utf-8') if text != original.decode('utf-8') else original
    spec['patched_files'] = {name: digest(raw) for name, raw in completed.items()}
    return spec, completed


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', required=True, type=Path)
    parser.add_argument('--write', action='store_true')
    args = parser.parse_args()
    spec, _ = generate(args.archive)
    if args.write:
        SPEC.write_text(json.dumps(spec, ensure_ascii=False, indent=2) + '\n')
    elif json.loads(SPEC.read_text()) != spec:
        raise SystemExit('Public Cookery 1.6.2 declaration differs from the reviewed transformation')
    print(json.dumps({'id': spec['id'], 'archive_sha256': ARCHIVE_SHA256,
                      'original_files': ORIGINALS, 'patched_files': spec['patched_files'],
                      'owned_helpers': {name: digest((BP / name).read_bytes()) for name in spec['copies']},
                      'client': False, 'native_loading': False}))


if __name__ == '__main__':
    main()
