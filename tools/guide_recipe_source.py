"""Exact G152 guide correction over the complete, published G151 source.

Only the paired identity and five guide files belong to this continuation.
Runtime behavior, G151 ledgers and every older source oracle remain unchanged.
The new guide is source-only evidence, with no inherited client acceptance.
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
BP = 'projects/grilling/gameplay_core/behavior_pack'
RP = 'projects/grilling/gameplay_core/resource_pack'
GUIDE = 'projects/grilling/guide/catalog.a3.json'
GUIDE_RECIPE_BASE = 'ba49ee55b67ab4f679c37fa833039857443a47f2'
PREVIOUS = GUIDE_RECIPE_BASE
PREVIOUS_TREE = '75243da7f072114f580fcf28e4151d285e5b06a7'
PREVIOUS_VERSION = [2, 8, 151]
VERSION = [2, 8, 152]
OWNERS = MappingProxyType({
    BP + '/manifest.json': 'g152_paired_identity',
    RP + '/manifest.json': 'g152_paired_identity',
    GUIDE: 'cookery161_board_guide',
    BP + '/scripts/guide/payload.js': 'cookery161_board_guide',
    **{RP + '/texts/' + locale + '.lang': 'cookery161_board_guide'
       for locale in ('en_US', 'zh_CN', 'zh_TW')},
})
PATHS = frozenset(OWNERS)
RUNTIME_PATHS = PATHS - {GUIDE}
LEDGER = ROOT / 'tools/fixtures/g152-guide-recipe-reviewed-delta.json'
LEDGER_SHA256 = '771f6d8b45a1c916684508452c413bd6ea52625edf18d9d8477b8ec4a7bbf3df'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def ledger(data=None):
    data = LEDGER.read_bytes() if data is None else data
    if sha(data) != LEDGER_SHA256:
        raise ValueError('Unreviewed G152 guide delta ledger')
    document = json.loads(data)
    if (document['schema'] != 1 or document['predecessor_commit'] != PREVIOUS
            or document['predecessor_tree'] != PREVIOUS_TREE
            or document['predecessor_version'] != PREVIOUS_VERSION
            or document['version'] != VERSION or set(document['changes']) != PATHS
            or document['evidence_scope'] != 'source_only'
            or document['native_acceptance'] is not False
            or document['client_acceptance'] is not False):
        raise ValueError('Wrong G152 guide source identity or path scope')
    for path, row in document['changes'].items():
        if row['owner'] != OWNERS[path] or row['operation'] != 'modify':
            raise ValueError('Wrong G152 guide path owner or operation: ' + path)
    return document


@lru_cache(maxsize=1)
def preceding_files():
    tree = subprocess.check_output(['git', 'rev-parse', PREVIOUS + '^{tree}'], cwd=ROOT, text=True).strip()
    if tree != PREVIOUS_TREE:
        raise ValueError('G152 predecessor full source tree differs')
    data = subprocess.check_output(['git', 'archive', PREVIOUS, BP, RP, GUIDE], cwd=ROOT)
    with tarfile.open(fileobj=io.BytesIO(data)) as archive:
        files = {member.name: archive.extractfile(member).read() for member in archive if member.isfile()}
    return MappingProxyType(files)


def _key(path):
    path = Path(path)
    key = path.relative_to(ROOT).as_posix() if path.is_absolute() else path.as_posix()
    if '..' in Path(key).parts:
        raise ValueError('G152 source path leaves the repository')
    return key


def reference_bytes(path, actual=None):
    """Admit one complete G152 postimage, then return its exact G151 bytes.

    A supplied G151 preimage is rejected: this boundary cannot run twice or
    replace a supplied candidate with an unrelated file read from disk.
    """
    key = _key(path)
    if key not in PATHS:
        raise ValueError('Path is outside G152 guide ownership: ' + key)
    actual = (ROOT / key).read_bytes() if actual is None else actual
    row = ledger()['changes'][key]
    before = preceding_files()[key]
    if (row['before_sha256'] != sha(before) or row['after_sha256'] != sha(actual)
            or before == actual):
        raise ValueError('Unreviewed G152 guide pre/postimage: ' + key)
    return before


def predecessor_version(version):
    """Map only the exact current G152 manifest to its sealed G151 identity."""
    from g153_repair_source import predecessor_version as repair_version
    version = repair_version(version)
    if version != VERSION:
        return version
    from g153_repair_source import historical_bytes as repair_history
    return json.loads(reference_bytes(BP + '/manifest.json', repair_history(BP + '/manifest.json')))['header']['version']


def historical_bytes(path, actual=None):
    """The outer guide boundary for both guide and gameplay source callers."""
    key = _key(path)
    actual = (ROOT / key).read_bytes() if actual is None else actual
    from g153_repair_source import historical_bytes as repair_history, predecessor_version as repair_version
    actual = repair_history(path, actual)
    if key not in PATHS:
        return actual
    try:
        version = json.loads((ROOT / BP / 'manifest.json').read_bytes())['header']['version']
    except (KeyError, TypeError, ValueError) as error:
        raise ValueError('Invalid release identity at the G152 guide boundary') from error
    version = repair_version(version)
    return reference_bytes(key, actual) if version == VERSION else actual


def predecessor_runtime(actual):
    """Keep the entire G151 runtime, with exactly six G152 changed files."""
    before = {path: value for path, value in preceding_files().items()
              if path.startswith((BP + '/', RP + '/'))}
    if set(actual) != set(before):
        raise ValueError('G152 guide runtime has an undeclared addition or deletion')
    changed = {path for path in actual if actual[path] != before[path]}
    if changed != RUNTIME_PATHS:
        raise ValueError('Unreviewed G152 guide runtime path scope')
    for path in RUNTIME_PATHS:
        reference_bytes(path, actual[path])
    return MappingProxyType(before)
