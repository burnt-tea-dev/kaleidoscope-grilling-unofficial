"""Append the four installed Cookery 1.6.1 foods without reindexing old stacks.

Read explicit dependency packs, record their exact bytes, and retain only
derived palette/alpha facts. Food artwork remains in the required Cookery RP.
These Bedrock sprites do not claim Java dynamic-particle or client acceptance.
"""
import argparse
import hashlib
import io
import json
from pathlib import Path
import zipfile

from PIL import Image
from generated_food_sprite import spans_from_alpha
from secret_food_palette import sample_grid

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / 'development/gameplay_core/fixtures'
NAMES = ('tea_egg', 'butter_tea', 'clay_pot_milk_tea', 'mystery_tea')
LEGACY_COUNT = 213
SOURCE_URL = 'https://www.curseforge.com/minecraft-bedrock/addons/kaleidoscope-cookery-unofficial/files/9123386'
ARCHIVE_SHA256 = '5b01865d4dd9a455cd80dae4ddc94dc45964e074025f7d24c6f0c5e35f0fbe52'
LEGACY_HASHES = {
    'secret-visual-catalog.json': '1cd04bb4a4692c8031be649f59386f8cf897c14ae2b91c4e466cda09377f5664',
    'secret-food-palettes.json': '8e0c847a402f8b691c66617b7c2033168cc59fa6ae12bd5baf0ac65a6c217868',
    'secret-helper-sprite-spans.json': 'acc7b078cf4f50265e7ebc61975d87ab2bc3d14192e1405bf1ae92df496e0c23',
}


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bp', type=Path, required=True)
    parser.add_argument('--rp', type=Path, required=True)
    parser.add_argument('--archive', type=Path, required=True)
    args = parser.parse_args()
    archive_raw = args.archive.read_bytes()
    archive_sha = sha(archive_raw)
    assert archive_sha == ARCHIVE_SHA256, 'The dependency archive is not the reviewed file 9123386'
    archive = zipfile.ZipFile(io.BytesIO(archive_raw))

    def verified(root, relative):
        data = (root / relative).read_bytes()
        member = ('Kaleidoscope Cookery v1.6.1 [BP]/' if root == args.bp else
                  'Kaleidoscope Cookery v1.6.1 [RP]/') + relative
        assert archive.read(member) == data, member
        return data

    for root in (args.bp, args.rp):
        verified(root, 'manifest.json')
    bp, rp = [read(root / 'manifest.json')['header'] for root in (args.bp, args.rp)]
    assert bp['version'] == rp['version'] == [1, 6, 1]
    assert bp['uuid'] == 'd0ca7a68-2877-4bd5-bc82-6c7b325cccf2'
    assert rp['uuid'] == 'c9df2982-d72e-4bbf-a72c-b77de4ea915b'
    catalog_path = FIXTURE / 'secret-visual-catalog.json'
    samples_path = FIXTURE / 'secret-food-palettes.json'
    spans_path = FIXTURE / 'secret-helper-sprite-spans.json'
    catalog, samples, outlines = map(read, (catalog_path, samples_path, spans_path))
    ids = [row['id'] for row in catalog['items'][:LEGACY_COUNT]]
    assert len(ids) == LEGACY_COUNT and len(set(ids)) == LEGACY_COUNT
    for path, document in zip((catalog_path, samples_path, spans_path), (catalog, samples, outlines)):
        assert [row['id'] for row in document['items'][:LEGACY_COUNT]] == ids
        prefix = json.dumps(document['items'][:LEGACY_COUNT], ensure_ascii=False,
                            sort_keys=True, separators=(',', ':')).encode()
        assert sha(prefix) == LEGACY_HASHES[path.name], 'An existing food record changed: ' + path.name
        assert all(row['id'] in ['kaleidoscope_cookery:' + name for name in NAMES]
                   for row in document['items'][LEGACY_COUNT:])
        document['items'] = document['items'][:LEGACY_COUNT]
    atlas = json.loads(verified(args.rp, 'textures/item_texture.json'))['texture_data']
    for index, name in enumerate(NAMES, LEGACY_COUNT + 1):
        identifier = 'kaleidoscope_cookery:' + name
        paths = [path for path in (args.bp / 'items').rglob('*.json')
                 if read(path).get('minecraft:item', {}).get('description', {}).get('identifier') == identifier]
        assert len(paths) == 1, identifier
        source_path = paths[0]
        verified(args.bp, source_path.relative_to(args.bp).as_posix())
        item = read(source_path)['minecraft:item']
        assert 'minecraft:food' in item['components']
        icon = item['components']['minecraft:icon']
        assert isinstance(icon, str)
        texture = atlas[icon]['textures']
        assert isinstance(texture, str)
        texture_path = args.rp / (texture + '.png')
        raw = verified(args.rp, texture_path.relative_to(args.rp).as_posix())
        image = Image.open(io.BytesIO(raw)).convert('RGBA')
        origin = {'kind': 'public_cookery_1.6.1_bedrock_sprite',
                  'source_url': SOURCE_URL,
                  'archive_sha256': archive_sha, 'source_path': texture + '.png',
                  'sha256': sha(raw), 'license': 'CC BY-NC-SA 4.0',
                  'attribution': 'Kaleidoscope Official Production Team',
                  'bedrock_adaptation': 'Loyallay',
                  'java_particle_parity': False, 'native_renderer_accepted': False}
        catalog['items'].append({'id': identifier, 'texture': texture,
                                 'source': 'pinned Cookery 1.6.1 public icon reference',
                                 'source_path': source_path.relative_to(args.bp).as_posix(),
                                 'source_sha256': sha(source_path.read_bytes()),
                                 'texture_sha256': sha(raw), 'texture_pack_uuid': rp['uuid'],
                                 'archive_sha256': archive_sha, 'license': origin['license']})
        samples['items'].append({'id': identifier, 'index': index,
                                 'palette': sample_grid(image), 'source': origin})
        alpha = image.getchannel('A').tobytes()
        width, height = image.size
        rows = [list(alpha[y * width:(y + 1) * width]) for y in range(height)]
        outlines['items'].append({'id': identifier, 'index': index, 'texture': texture,
                                  'width': width, 'height': height, 'source': origin,
                                  'alpha_sha256': sha(alpha), 'alpha_values': sorted(set(alpha)),
                                  'solid_pixel_count': sum(value != 0 for value in alpha),
                                  'spans': spans_from_alpha(rows)})
    write(catalog_path, catalog)
    outlines['catalog_sha256'] = sha(catalog_path.read_bytes())
    write(samples_path, samples)
    write(spans_path, outlines)
    print('Cookery 1.6.1: appended exact public foods 214..217; external artwork copied: 0')


if __name__ == '__main__':
    main()
