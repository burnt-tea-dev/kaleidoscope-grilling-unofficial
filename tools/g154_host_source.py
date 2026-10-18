"""Exact G154 host162 layer over complete immutable G153 source.

Only reviewed postimages recover historical153 bytes. Native/client acceptance
and client caches are not inferred from this source inventory boundary.
"""
from functools import lru_cache
from pathlib import Path
from types import MappingProxyType
import hashlib
import io
import json
import subprocess
import tarfile

ROOT = Path(__file__).resolve().parents[1]
PREVIOUS = '686cde5578ae5ddc66632b8e0d24fa9d6d89b656'
PREVIOUS_TREE = 'd21ee853aa5a86e51656ee1b8f8afcb7406a8e3f'
BP = 'projects/grilling/gameplay_core/behavior_pack'
RP = 'projects/grilling/gameplay_core/resource_pack'
GUIDE = 'projects/grilling/guide/catalog.a3.json'
OWNERS = MappingProxyType({
    BP + '/manifest.json': 'host162_paired_identity',
    RP + '/manifest.json': 'host162_paired_identity',
    BP + '/host-extensions/board-api.json': 'host162_public_api13',
    BP + '/scripts/host_api/oil_api_host.js': 'host162_native_placed_oil',
    BP + '/scripts/host_api/millstone_api_core.js': 'host162_public_millstone_admission',
    BP + '/scripts/guide/payload.js': 'guide154_identity',
    BP + '/scripts/guide/publisher.js': 'guide154_identity',
    GUIDE: 'host162_guide_reference',
    'config.json': 'paired154_packaging',
    'projects/grilling/gameplay_core/config.json': 'paired154_packaging',
})
PATHS = frozenset(OWNERS)
RUNTIME_PATHS = frozenset(p for p in PATHS if p.startswith((BP + '/', RP + '/')))
ADDED = frozenset({BP + '/scripts/host_api/millstone_api_core.js'})
LEDGER = ROOT / 'tools/fixtures/g154-host-reviewed-delta.json'
LEDGER_SHA256 = 'e5418749b15c52f0227371e536b1314a8d37700974a36c605b3a7d0e82e6b128'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def ledger(data=None):
    data = LEDGER.read_bytes() if data is None else data
    if sha(data) != LEDGER_SHA256:
        raise ValueError('Unreviewed G154 host ledger')
    doc = json.loads(data)
    if (doc.get('schema') != 1 or doc.get('predecessor_commit') != PREVIOUS
            or doc.get('predecessor_tree') != PREVIOUS_TREE or doc.get('predecessor_version') != [2, 8, 153]
            or doc.get('version') != [2, 8, 154] or set(doc.get('changes', {})) != PATHS
            or doc.get('evidence_scope') != 'source_only' or doc.get('native_acceptance') is not False
            or doc.get('client_acceptance') is not False):
        raise ValueError('Wrong G154 host identity or scope')
    for path, row in doc['changes'].items():
        if row['owner'] != OWNERS[path] or row['operation'] != ('add' if path in ADDED else 'modify'):
            raise ValueError('Wrong G154 host owner or operation: ' + path)
    return doc


@lru_cache(maxsize=1)
def preceding_files():
    tree = subprocess.check_output(['git', 'rev-parse', PREVIOUS + '^{tree}'], cwd=ROOT, text=True).strip()
    if tree != PREVIOUS_TREE:
        raise ValueError('G153 complete predecessor tree differs')
    raw = subprocess.check_output(['git', 'archive', PREVIOUS, BP, RP], cwd=ROOT)
    with tarfile.open(fileobj=io.BytesIO(raw)) as archive:
        files = {m.name: archive.extractfile(m).read() for m in archive if m.isfile()}
    return MappingProxyType(files)


@lru_cache(maxsize=None)
def preceding_bytes(path):
    if path not in PATHS:
        raise ValueError('Path outside G154 scope: ' + path)
    if path.startswith((BP + '/', RP + '/')):
        return preceding_files().get(path)
    preceding_files()
    return subprocess.check_output(['git', 'show', PREVIOUS + ':' + path], cwd=ROOT)


def key_for(path):
    path = Path(path)
    try:
        key = path.relative_to(ROOT).as_posix() if path.is_absolute() else path.as_posix()
    except ValueError as error:
        raise ValueError('G154 path outside repository') from error
    if '..' in Path(key).parts:
        raise ValueError('G154 path outside repository')
    return key


def reference_bytes(path, actual=None):
    key = key_for(path)
    actual = (ROOT / key).read_bytes() if actual is None else actual
    if key not in PATHS:
        return actual
    row = ledger()['changes'][key]
    before = preceding_bytes(key)
    if key in ADDED:
        raise ValueError('Added G154 path has no historical byte preimage: ' + key)
    if sha(before) != row['before_sha256']:
        raise ValueError('G154 immutable preimage differs: ' + key)
    if actual != before and sha(actual) != row['after_sha256']:
        raise ValueError('Unreviewed G154 host pre/postimage: ' + key)
    return before


def expected_files():
    doc = ledger()
    files = dict(preceding_files())
    for path in PATHS:
        raw = (ROOT / path).read_bytes()
        before = preceding_bytes(path)
        row = doc['changes'][path]
        if row['before_sha256'] != (None if before is None else sha(before)) or row['after_sha256'] != sha(raw) or raw == before:
            raise ValueError('G154 host postimage missing or changed: ' + path)
        if path in RUNTIME_PATHS:
            files[path] = raw
    return MappingProxyType(files)


def predecessor_runtime(actual):
    before = preceding_files()
    if actual != expected_files() or set(actual) != set(before) | ADDED:
        raise ValueError('G154 runtime differs from complete reviewed host layer')
    if {p for p in actual if p not in before or actual[p] != before[p]} != RUNTIME_PATHS:
        raise ValueError('G154 runtime path scope differs')
    return before


def active(root=ROOT):
    if root != ROOT:
        return False
    try:
        return json.loads((ROOT / BP / 'manifest.json').read_bytes())['header']['version'] == [2, 8, 154]
    except FileNotFoundError:
        return False


def historical_bytes(path, actual=None):
    actual = (ROOT / path).read_bytes() if actual is None else actual
    return reference_bytes(path, actual) if active() else actual
