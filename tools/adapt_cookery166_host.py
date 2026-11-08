"""Reproduce the reviewed public Cookery 1.6.6 hooks from an owner's clean archive.

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
ARCHIVE_SHA256 = '4bd85c214d063e07ea66639edcff367337db12d59b430b26595c71d1b61b3b64'
HOST_UUID = '9944f731-cc4c-4299-bdd5-f8799c1d832e'
RESOURCE_UUID = '1bf09f60-7e0f-450c-9e09-81850b40db4d'
REVIEW_EXPIRES = '2026-12-09'
PREFIX = 'Kaleidoscope Cookery v1.6.6 [BP]/'
ORIGINALS = {
    'scripts/api/extensionRegistry.js': 'd1a2a364ed817a2b2f95a0bd6a7c394b7eed3f9933fd6cf8767c3ec0e0a27c89',
    'scripts/custom_components/blocks/directStation.js': '2be90f873cbf780e5a8d32151242af2b41239a985ad9c9bf74a3fe5779bc3620',
    'scripts/custom_components/blocks/oilPot.js': 'c34d1cb0c6f125db7ebbe4e7dc1d251efd92a261dac964e4bf9d09d6e981222c',
    'items/kitchen/oil_pot.json': 'f881cc3144f2b46fe075339a0713af8f627dbdb80c31a33a32cea3e7a4010b17',
    'items/kitchen/oil_pot_filled.json': '12eacddb8ad48c8f8d3510f78f0e6489244e7bc1d4ff7ca4aa0d73c44776f1f2',
    'scripts/events/guidebook.js': '06a8bd85610479cc3cf1bf1b135eaf1555a6b4b687a2b05a2131474abc2e4e3a',
    'scripts/events/foodItemReturns.js': '4b02c6ba37e41a311ebfc9fbac3dbbbbb6c36c33658ab2588e169e63ff1604fe',
    'scripts/data/foodEffects.js': 'f0a1750a2f22ee9335e15ef17a0d0f5791435564aad8e85aea69cfbc764b2149',
    'scripts/api/guidebookExtensionRegistry.js': '5ed1002fcece629df140da5fc480f43af6109fefef09457cfa8a88b5e9a83f12',
    'scripts/custom_components/blocks/millstone.js': '24a348ac26c379d4e9d6726d169a88f943e2c0e649ee7e69dd11bfb8bcd2340f',
}


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def generate(archive, declaration=None):
    raw = archive.read_bytes()
    if digest(raw) != ARCHIVE_SHA256:
        raise ValueError('Cookery 1.6.6 archive differs from the reviewed author release')
    spec = json.loads(SPEC.read_text()) if declaration is None else json.loads(json.dumps(declaration))
    # The canonical declaration owns the current SDK identity. Reproduction
    # must not silently downgrade a newer reviewed declaration to an old ID.
    spec.update(host_uuid=HOST_UUID, archive_sha256=ARCHIVE_SHA256, expires=REVIEW_EXPIRES,
                original_files=ORIGINALS)
    # The author now accepts extension recipes by hand. Keep only the worker
    # and dropped-item admission hooks that the clean release still lacks.
    spec['insertions'] = [op for op in spec['insertions']
                          if not (op['path'] == 'scripts/custom_components/blocks/millstone.js'
                                  and op['anchor'] == '    if(held&&RECIPES[held.typeId]){')]
    # Preserve the author's new plain-meat multi-output result before recording
    # the existing output epoch used by the owned collection contract.
    for op in spec['insertions']:
        if (op['path'] == 'scripts/custom_components/blocks/directStation.js'
                and op['text'] == 'd.grillingOutputEpoch=nextCuisineBatch(b);'
                and 'd.recipe.result' in op['anchor']):
            op['anchor'] = '    d.result=d.recipe.plainMeat?{outputs:[...d.recipe.outputs],carrier:""}:{id:d.recipe.result,count:d.recipe.count,carrier:d.recipe.carrier};'
    spec['removal_condition'] = spec['removal_condition'].replace('Cookery 1.6.2', 'Cookery 1.6.6')
    spec['authorization'] = 'Owner standing S1 repair/deployment authorization, continued 2026-11-03: re-review existing public host hooks against the exact clean Cookery1.6.6 archive before adoption. Preserve author ownership and all original preimages; full-family/save/rollback gates and actual client acceptance remain separate.'
    completed = {}
    with zipfile.ZipFile(archive) as z:
        manifest = json.loads(z.read(PREFIX + 'manifest.json'))
        if manifest['header']['uuid'] != HOST_UUID or manifest['header']['version'] != [1, 6, 6]:
            raise ValueError('Cookery 1.6.6 host identity differs')
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
        raise SystemExit('Public Cookery 1.6.6 declaration differs from the reviewed transformation')
    print(json.dumps({'id': spec['id'], 'archive_sha256': ARCHIVE_SHA256,
                      'original_files': ORIGINALS, 'patched_files': spec['patched_files'],
                      'owned_helpers': {name: digest((BP / name).read_bytes()) for name in spec['copies']},
                      'client': False, 'native_loading': False}))


if __name__ == '__main__':
    main()
