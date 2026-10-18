"""Exact G154 plate-transaction continuation over immutable public G153.

Only the transaction owner and paired pack identities may change. The sealed
ledger admits source bytes only; native and client acceptance remain separate.
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
PLATE_SOURCE_BASE = '686cde5578ae5ddc66632b8e0d24fa9d6d89b656'
PREVIOUS = PLATE_SOURCE_BASE
PREVIOUS_TREE = 'd21ee853aa5a86e51656ee1b8f8afcb7406a8e3f'
BP = 'projects/grilling/gameplay_core/behavior_pack'
RP = 'projects/grilling/gameplay_core/resource_pack'
PREVIOUS_VERSION = [2, 8, 153]
VERSION = [2, 8, 154]
OWNERS = MappingProxyType({
    BP + '/manifest.json': 'g154_paired_identity',
    RP + '/manifest.json': 'g154_paired_identity',
    BP + '/scripts/plate_transaction_core.js': 'plate_transfer_ownership',
    BP + '/scripts/a25_plate_recipe_runtime.js': 'plate_transfer_ownership',
})
PATHS = frozenset(OWNERS)
RUNTIME_PATHS = PATHS
LEDGER = ROOT / 'tools/fixtures/g154-plate-reviewed-delta.json'
# Set only after the exact runtime postimages are final and independently tested.
LEDGER_SHA256 = 'f70402a9e49c65615a81971e4d12d5d22f2dec3b99e15e7ae819ec00b5c49a7a'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def ledger(data=None):
    if not isinstance(LEDGER_SHA256, str) or len(LEDGER_SHA256) != 64:
        raise ValueError('G154 plate admission has not been finalized')
    data = LEDGER.read_bytes() if data is None else data
    if sha(data) != LEDGER_SHA256:
        raise ValueError('Unreviewed G154 plate ledger')
    document = json.loads(data)
    if (document['schema'] != 1 or document['predecessor_commit'] != PREVIOUS
            or document['predecessor_tree'] != PREVIOUS_TREE
            or document['predecessor_version'] != PREVIOUS_VERSION
            or document['version'] != VERSION or set(document['changes']) != PATHS
            or document.get('evidence_scope') != 'source_only'
            or document.get('native_acceptance') is not False
            or document.get('client_acceptance') is not False):
        raise ValueError('Wrong G154 plate identity or scope')
    for path, row in document['changes'].items():
        if row['owner'] != OWNERS[path] or row['operation'] != 'modify':
            raise ValueError('Wrong G154 plate owner or operation: ' + path)
    return document


@lru_cache(maxsize=1)
def preceding_files():
    tree = subprocess.check_output(['git', 'rev-parse', PREVIOUS + '^{tree}'], cwd=ROOT, text=True).strip()
    if tree != PREVIOUS_TREE:
        raise ValueError('G154 complete G153 predecessor tree differs')
    data = subprocess.check_output(['git', 'archive', PREVIOUS, BP, RP], cwd=ROOT)
    with tarfile.open(fileobj=io.BytesIO(data)) as archive:
        return MappingProxyType({member.name: archive.extractfile(member).read()
                                 for member in archive if member.isfile()})


def _key(path):
    path = Path(path)
    key = path.relative_to(ROOT).as_posix() if path.is_absolute() else path.as_posix()
    if '..' in Path(key).parts:
        raise ValueError('G154 source path leaves the repository')
    return key


def reference_bytes(path, actual=None):
    """Recover one exact G153 preimage; caller-supplied bytes are never replaced."""
    key = _key(path)
    if key not in PATHS:
        raise ValueError('Path is outside G154 plate ownership: ' + key)
    actual = (ROOT / key).read_bytes() if actual is None else actual
    before = preceding_files()[key]
    row = ledger()['changes'][key]
    if (row['before_sha256'] != sha(before) or row['after_sha256'] != sha(actual)
            or before == actual):
        raise ValueError('Unreviewed G154 plate pre/postimage: ' + key)
    return before


def expected_files():
    """Recheck mutable ledger and postimages on every admission."""
    doc = ledger()
    files = dict(preceding_files())
    for path in PATHS:
        actual = (ROOT / path).read_bytes()
        row = doc['changes'][path]
        before = files[path]
        if (sha(before) != row['before_sha256'] or sha(actual) != row['after_sha256']
                or actual == before):
            raise ValueError('G154 plate postimage missing or changed: ' + path)
        files[path] = actual
    return MappingProxyType(files)


def predecessor_runtime(actual):
    before = preceding_files()
    if set(actual) != set(before) or actual != expected_files():
        raise ValueError('G154 runtime differs from complete reviewed plate layer')
    if {path for path in actual if actual[path] != before[path]} != RUNTIME_PATHS:
        raise ValueError('G154 plate runtime path scope changed')
    return before


def historical_bytes(path, actual=None):
    """Outer current-source boundary; G153 and older inverses run afterward."""
    key = _key(path)
    actual = (ROOT / key).read_bytes() if actual is None else actual
    if key not in PATHS:
        return actual
    try:
        version = json.loads((ROOT / BP / 'manifest.json').read_bytes())['header']['version']
    except (KeyError, TypeError, ValueError) as error:
        raise ValueError('Invalid release identity at the G154 plate boundary') from error
    return reference_bytes(key, actual) if version == VERSION else actual


def predecessor_version(version):
    if version != VERSION:
        return version
    return json.loads(reference_bytes(BP + '/manifest.json'))['header']['version']
