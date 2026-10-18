"""Verify the cumulative asset project; the product guide lives in canonical BP/RP.

The standalone Cookery106 chapter was retired in a0218906. Canonical product
compilation and its integrated guide are checked by bridge-project/gameplay CI.
This older asset-project job must still reject an empty or incomplete export.
"""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]


def load(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def inventory(folder):
    return {p.relative_to(folder).as_posix(): p for p in sorted(folder.rglob('*')) if p.is_file()}


def verify_output(project):
    source = project / 'resource_pack'
    original = inventory(source)
    if 'manifest.json' not in original or len(original) < 2:
        raise RuntimeError('Asset source must contain a manifest and pack content')
    manifest = load(original['manifest.json'])
    uuid = manifest.get('header', {}).get('uuid')
    if not isinstance(uuid, str) or not uuid:
        raise RuntimeError('Asset source manifest has no UUID')
    matches = [p.parent for p in (project / 'builds/dist').rglob('manifest.json')
               if load(p).get('header', {}).get('uuid') == uuid]
    if len(matches) != 1:
        raise RuntimeError(f'resource_pack: expected one compiled pack, found {len(matches)}')
    compiled = inventory(matches[0])
    if compiled.keys() != original.keys():
        raise RuntimeError('Dash file inventory differs: missing=' + str(sorted(original.keys() - compiled.keys())[:8])
                           + ', extra=' + str(sorted(compiled.keys() - original.keys())[:8]))
    for name, path in original.items():
        dest = compiled[name]
        # Dash may reformat JSON. Its full manifest and other JSON data must
        # remain identical; every other exported file keeps its exact bytes.
        equal = load(path) == load(dest) if path.suffix == '.json' else path.read_bytes() == dest.read_bytes()
        if not equal:
            raise RuntimeError('Unexpected Dash transformation: ' + name)
    return {'compiler': 'bridge. standalone Dash v1.2.0',
            'packs': [{'pack': 'resource_pack', 'uuid': uuid,
                       'checked_files': len(original), 'matches_source': True}],
            'editor_ui_tested': False, 'minecraft_tested': False,
            'scope': 'Cumulative asset RP only; exact file inventory, JSON data and other file bytes compared with source'}


if __name__ == '__main__':
    print(json.dumps(verify_output(ROOT / 'projects/grilling'), ensure_ascii=False, indent=2))
