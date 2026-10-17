"""Exact G150 Cookery/collision layer over the complete public G149 runtime.

Only enumerated reviewed postimages can recover their immutable preimages.
Historical G149 and earlier layers keep their own ledgers and acceptance rules.
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
STABLE_HOST_BASE = 'aa7431f9ea729338f75f134a9c9be8194298b968'
PREVIOUS = STABLE_HOST_BASE
PREVIOUS_TREE = '37470053c4c45dfe8e358daa8c6c0ec7f6af8f0d'
BP = 'projects/grilling/gameplay_core/behavior_pack'
RP = 'projects/grilling/gameplay_core/resource_pack'
GUIDE = 'projects/grilling/guide/catalog.a3.json'
OWNERS = MappingProxyType({
    BP + '/manifest.json': 'cookery161_paired_identity',
    RP + '/manifest.json': 'cookery161_paired_identity',
    BP + '/host-extensions/board-api.json': 'cookery161_public_family_api',
    BP + '/blocks/grill.json': 'java_collision_boxes',
    BP + '/blocks/advanced_rack_block.json': 'java_collision_boxes',
    BP + '/scripts/rack_aim_hit.js': 'directional_rack_hit',
    GUIDE: 'cookery161_guide_provenance',
})
PATHS = frozenset(OWNERS)
RUNTIME_PATHS = PATHS - {GUIDE}
LEDGER = ROOT / 'tools/fixtures/g150-stable-host-reviewed-delta.json'
LEDGER_SHA256 = '9e08cba445c42ecfd7b86b76540ad87bdc5b5e48a03738a55f63e0c0191dac17'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def ledger(data=None):
    data = LEDGER.read_bytes() if data is None else data
    if sha(data) != LEDGER_SHA256:
        raise ValueError('Unreviewed G150 stable-host delta ledger')
    document = json.loads(data)
    if (document['schema'] != 1 or document['predecessor_commit'] != PREVIOUS
            or document['predecessor_tree'] != PREVIOUS_TREE
            or document['predecessor_version'] != [2, 8, 149]
            or document['version'] != [2, 8, 150]
            or set(document['changes']) != PATHS):
        raise ValueError('Wrong G150 stable-host identity or path scope')
    for path, row in document['changes'].items():
        if row['owner'] != OWNERS[path] or row['operation'] != 'modify':
            raise ValueError('Wrong G150 stable-host path owner: ' + path)
    return document


@lru_cache(maxsize=1)
def preceding_files():
    tree = subprocess.check_output(['git', 'rev-parse', PREVIOUS + '^{tree}'], cwd=ROOT, text=True).strip()
    if tree != PREVIOUS_TREE:
        raise ValueError('G149 predecessor full tree differs')
    data = subprocess.check_output(['git', 'archive', PREVIOUS, BP, RP], cwd=ROOT)
    with tarfile.open(fileobj=io.BytesIO(data)) as archive:
        files = {member.name: archive.extractfile(member).read() for member in archive if member.isfile()}
    return MappingProxyType(files)


@lru_cache(maxsize=None)
def preceding_bytes(path):
    if path not in PATHS:
        raise ValueError('Path is outside G150 stable-host ownership: ' + path)
    if path == GUIDE:
        return subprocess.check_output(['git', 'show', PREVIOUS + ':' + path], cwd=ROOT)
    return preceding_files()[path]


def reference_bytes(path, actual=None):
    path = Path(path)
    key = path.relative_to(ROOT).as_posix() if path.is_absolute() else path.as_posix()
    if key not in PATHS:
        raise ValueError('Path is outside G150 stable-host ownership: ' + key)
    row = ledger()['changes'][key]
    if actual is None:
        from skewer_content_source import historical_bytes
        actual = historical_bytes(ROOT / key)
    before = preceding_bytes(key)
    if sha(actual) != row['after_sha256'] or sha(before) != row['before_sha256']:
        raise ValueError('Unreviewed G150 stable-host pre/postimage: ' + key)
    return before


def preceding_host_spec(actual=None):
    """Historical API gates inspect G149 only after exact G150 admission."""
    return json.loads(reference_bytes(BP + '/host-extensions/board-api.json', actual))


@lru_cache(maxsize=1)
def expected_files():
    files = dict(preceding_files())
    for path in RUNTIME_PATHS:
        from skewer_content_source import historical_bytes
        actual = historical_bytes(ROOT / path)
        reference_bytes(path, actual)
        files[path] = actual
    return MappingProxyType(files)


def predecessor_runtime(actual):
    if actual != expected_files() or set(actual) != set(preceding_files()):
        raise ValueError('G150 runtime differs from exact stable-host/collision layer')
    changed = {path for path in actual if actual[path] != preceding_files()[path]}
    if changed != RUNTIME_PATHS:
        raise ValueError('Unreviewed G150 runtime path scope')
    return preceding_files()
