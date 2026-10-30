"""Copy or verify the SDK from the exact reviewed public Core checkout."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def sync(sdk_root, *, write=False):
    lock = json.loads((ROOT / 'core-sdk.lock.json').read_text())
    sdk_root = sdk_root.resolve()
    commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=sdk_root, text=True).strip()
    if commit != lock['commit']:
        raise ValueError('Core checkout differs from the reviewed commit')
    manifest = (sdk_root / 'sdk.json').read_bytes()
    if hashlib.sha256(manifest).hexdigest() != lock['manifest_sha256']:
        raise ValueError('Core SDK manifest differs')
    sdk = json.loads(manifest)
    if sdk['version'] != lock['version'] or sdk['files'] != lock['files']:
        raise ValueError('Core exports differ from the consumer lock')
    target = ROOT / json.loads((ROOT / 'baseline.json').read_text())['runtime']['BP']
    for relative, row in sdk['files'].items():
        raw = (sdk_root / row['source']).read_bytes()
        if hashlib.sha256(raw).hexdigest() != row['sha256']:
            raise ValueError('Core source differs: ' + relative)
        path = target / relative
        if write:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(raw)
        elif path.read_bytes() != raw:
            raise ValueError('Regenerate SDK consumer: ' + relative)
    return sdk['version']


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--sdk-root', required=True, type=Path)
    parser.add_argument('--write', action='store_true')
    args = parser.parse_args()
    print('Core SDK verified: ' + sync(args.sdk_root, write=args.write))
