"""Exact G155 plate repair over the immutable G154 Cookery162 host layer.

The other G154 plate branch remains historical source, never a second identity
for this runtime. Complete inventory admission precedes every older inverse.
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
PREVIOUS = '7eadfebf370aa3e5927084b8bf2c47272ed006e9'
PREVIOUS_TREE = '2e6bc329356aafb15a3f1a8040006a534ce9a680'
BP = 'projects/grilling/gameplay_core/behavior_pack'
RP = 'projects/grilling/gameplay_core/resource_pack'
GUIDE = 'projects/grilling/guide/catalog.a3.json'
VERSION = [2, 8, 155]
PLATE_SOURCE_BASE = '5a0cf60ae510bc05ee49eb7178aa975a1be59487'
IMPORT_COMMIT = PLATE_SOURCE_BASE
IMPORT_BASE = '686cde5578ae5ddc66632b8e0d24fa9d6d89b656'
IMPORT_TREE = 'b063246da03554e2dd768542b1b7fa0ed4df3a7b'
OWNERS = MappingProxyType({
    BP + '/manifest.json': 'g155_paired_identity',
    RP + '/manifest.json': 'g155_paired_identity',
    BP + '/scripts/a25_plate_recipe_runtime.js': 'plate_transfer_ownership',
    BP + '/scripts/plate_transaction_core.js': 'plate_transfer_ownership',
    BP + '/scripts/guide/payload.js': 'guide155_identity',
    BP + '/scripts/guide/publisher.js': 'guide155_identity',
    GUIDE: 'guide155_identity',
    'config.json': 'paired155_packaging',
    'projects/grilling/gameplay_core/config.json': 'paired155_packaging',
})
PATHS = frozenset(OWNERS)
RUNTIME_PATHS = frozenset(p for p in PATHS if p.startswith((BP + '/', RP + '/')))
IMPORTED = frozenset(p for p, owner in OWNERS.items() if owner == 'plate_transfer_ownership')
LEDGER = ROOT / 'tools/fixtures/g155-plate-reviewed-delta.json'
LEDGER_SHA256 = '9d023eaa6619b42c102d55a7677d3abe2b3aa2cc7369d6013a2a1e71054907f5'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def ledger(data=None):
    data = LEDGER.read_bytes() if data is None else data
    if sha(data) != LEDGER_SHA256:
        raise ValueError('Unreviewed G155 plate ledger')
    doc = json.loads(data)
    if (doc.get('schema') != 1 or doc.get('predecessor_commit') != PREVIOUS
            or doc.get('predecessor_tree') != PREVIOUS_TREE
            or doc.get('predecessor_version') != [2, 8, 154] or doc.get('version') != VERSION
            or set(doc.get('changes', {})) != PATHS or doc.get('evidence_scope') != 'source_only'
            or doc.get('native_acceptance') is not False or doc.get('client_acceptance') is not False
            or doc.get('imported_plate_source') != {'commit': IMPORT_COMMIT, 'base': IMPORT_BASE, 'tree': IMPORT_TREE, 'paths': sorted(IMPORTED)}):
        raise ValueError('Wrong G155 identity, imported source or scope')
    for path, row in doc['changes'].items():
        if row['owner'] != OWNERS[path] or row['operation'] != 'modify':
            raise ValueError('Wrong G155 plate owner or operation: ' + path)
    return doc


@lru_cache(maxsize=1)
def preceding_files():
    tree = subprocess.check_output(['git', 'rev-parse', PREVIOUS + '^{tree}'], cwd=ROOT, text=True).strip()
    if tree != PREVIOUS_TREE:
        raise ValueError('G155 complete G154 predecessor tree differs')
    raw = subprocess.check_output(['git', 'archive', PREVIOUS, BP, RP], cwd=ROOT)
    with tarfile.open(fileobj=io.BytesIO(raw)) as archive:
        return MappingProxyType({m.name: archive.extractfile(m).read() for m in archive if m.isfile()})


@lru_cache(maxsize=None)
def preceding_bytes(path):
    if path not in PATHS:
        raise ValueError('Path outside G155 scope: ' + path)
    if path.startswith((BP + '/', RP + '/')):
        return preceding_files()[path]
    preceding_files()
    return subprocess.check_output(['git', 'show', PREVIOUS + ':' + path], cwd=ROOT)


def key_for(path):
    path = Path(path)
    key = path.relative_to(ROOT).as_posix() if path.is_absolute() else path.as_posix()
    if '..' in Path(key).parts:
        raise ValueError('G155 source path leaves the repository')
    return key


def reference_bytes(path, actual=None):
    key = key_for(path)
    actual = (ROOT / key).read_bytes() if actual is None else actual
    if key not in PATHS:
        return actual
    row = ledger()['changes'][key]
    before = preceding_bytes(key)
    if sha(before) != row['before_sha256'] or (actual != before and sha(actual) != row['after_sha256']):
        raise ValueError('Unreviewed G155 pre/postimage: ' + key)
    return before


def expected_files():
    doc = ledger()
    files = dict(preceding_files())
    for path in PATHS:
        raw = (ROOT / path).read_bytes()
        before = preceding_bytes(path)
        row = doc['changes'][path]
        if sha(before) != row['before_sha256'] or sha(raw) != row['after_sha256'] or raw == before:
            raise ValueError('G155 postimage missing or changed: ' + path)
        if path in RUNTIME_PATHS:
            files[path] = raw
    return MappingProxyType(files)


def predecessor_runtime(actual):
    before = preceding_files()
    if set(actual) != set(before) or actual != expected_files():
        raise ValueError('G155 runtime differs from complete reviewed plate layer')
    if {path for path in actual if actual[path] != before[path]} != RUNTIME_PATHS:
        raise ValueError('G155 runtime path scope differs')
    return before


def active():
    return json.loads((ROOT / BP / 'manifest.json').read_bytes())['header']['version'] == VERSION


def historical_bytes(path, actual=None):
    actual = (ROOT / path).read_bytes() if actual is None else actual
    return reference_bytes(path, actual) if active() else actual


def predecessor_version(version):
    if version != VERSION:
        return version
    return json.loads(reference_bytes(BP + '/manifest.json'))['header']['version']
