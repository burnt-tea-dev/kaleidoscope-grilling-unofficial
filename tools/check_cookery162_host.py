"""Exercise actual reviewed Cookery 1.6.2 modules without installing or publishing them."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import urllib.request
import zipfile

from adapt_cookery162_host import ARCHIVE_SHA256, BP, PREFIX, ROOT, SPEC, generate
from check_cookery160_host import check_guide_locale_registry, check_tavern_guide_bridge


def check_archive(archive):
    declaration = json.loads(SPEC.read_text())
    generated, completed = generate(archive)
    assert generated == declaration, 'Public declaration differs from reviewed author hooks'
    with tempfile.TemporaryDirectory(prefix='cookery162-host-') as tmp:
        base = Path(tmp)
        for name, raw in completed.items():
            if name.endswith('.js'):
                target = base / (Path(name).stem + '.mjs')
                target.write_bytes(raw)
                subprocess.run(['node', '--check', str(target)], check=True)
        with zipfile.ZipFile(archive) as z:
            original = z.read(PREFIX + 'scripts/api/guidebookExtensionRegistry.js').decode()
            (base / 'oilContainers.js').write_bytes(z.read(PREFIX + 'scripts/api/oilContainers.js'))
            (base / 'millstone.clean.js').write_bytes(z.read(PREFIX + 'scripts/custom_components/blocks/millstone.js'))
            for name in ['stationRecipes.js', 'stockpotJavaRecipes.js']:
                (base / name).write_bytes(z.read(PREFIX + 'scripts/data/' + name))
        check_guide_locale_registry(original, completed['scripts/api/guidebookExtensionRegistry.js'].decode(), base, author_fixed=True, author_version='1.6.2')
        (base / 'oilPot.js').write_bytes(completed['scripts/custom_components/blocks/oilPot.js'])
        (base / 'millstone.js').write_bytes(completed['scripts/custom_components/blocks/millstone.js'])
        (base / 'extensionRegistry.js').write_bytes(completed['scripts/api/extensionRegistry.js'])
        subprocess.run(['node', 'development/gameplay_core/test_cookery_oil_placement.mjs'],
                       cwd=ROOT, env={**os.environ, 'COOKERY_OIL_PLACEMENT_FIXTURE': str(base)}, check=True)
        subprocess.run(['node', 'development/gameplay_core/test_cookery_millstone_admission.mjs'],
                       cwd=ROOT, env={**os.environ, 'COOKERY_MILLSTONE_FIXTURE': str(base)}, check=True)
        check_tavern_guide_bridge()
    proof = {'schema': 1, 'archive_sha256': ARCHIVE_SHA256, 'public_api': declaration['id'],
             'spec_sha256': hashlib.sha256(SPEC.read_bytes()).hexdigest(),
             'original_files': declaration['original_files'], 'patched_files': declaration['patched_files'],
             'owned_helpers': {name: hashlib.sha256((BP / name).read_bytes()).hexdigest() for name in declaration['copies']},
             'actual_author_oil_callbacks': True, 'unknown_legacy_quantity_still_rejected': True,
             'seven_powders_actual_author_three_gates': True,
             'author_millstone_timing_and_capacity_retained': True,
             'canonical_guide_locales_retained': True, 'native_loading': False,
             'client': False, 'production_ready': False}
    print('COOKERY162_PUBLIC_HOST ' + json.dumps(proof))
    return proof


def check(archive=None):
    archive = archive or os.environ.get('COOKERY_162_ARCHIVE')
    if archive:
        return check_archive(Path(archive))
    with tempfile.TemporaryDirectory(prefix='cookery162-author-') as tmp:
        archive = Path(tmp) / 'author.mcaddon'
        url = 'https://edge.forgecdn.net/files/9227/406/Kaleidoscope%20Cookery%20v1.6.2.mcaddon'
        with urllib.request.urlopen(url, timeout=60) as response:
            archive.write_bytes(response.read())
        return check_archive(archive)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', type=Path, default=os.environ.get('COOKERY_162_ARCHIVE'))
    args = parser.parse_args()
    check(args.archive)
