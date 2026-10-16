"""Exact pending FP offhand contributor removal; preserve G148 history.

Only the nine reviewed pending attachable postimages can be reversed. The
unchanged static hold remains explicit; this is not native host-frame parity.
"""
from functools import lru_cache
from pathlib import Path
from types import MappingProxyType
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]
PREFIX = 'projects/grilling/gameplay_core/resource_pack/attachables/'
NAMES = ('pending_seasoning', *(f'pending_seasoning_f{i}' for i in range(1, 9)))
PATHS = frozenset(PREFIX + name + '.attachable.json' for name in NAMES)
LEDGER = ROOT / 'tools/fixtures/g149-pending-offhand-reviewed-delta.json'
LEDGER_SHA256 = '191c96f5f7c556f0511fc67109b91a572b5e25c8094f9c4e21289df7095a4ef8'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def ledger(data=None):
    data = LEDGER.read_bytes() if data is None else data
    if sha(data) != LEDGER_SHA256:
        raise ValueError('Unreviewed G149 pending offhand delta ledger')
    document = json.loads(data)
    if (document['schema'] != 1 or document['predecessor_version'] != [2, 8, 148]
            or document['version'] != [2, 8, 149]):
        raise ValueError('Wrong pending offhand source identity')
    return document


@lru_cache(maxsize=1)
def expected_files():
    from current_runtime_ownership import PREFIXES
    from seasoning_tp_source import expected_files as preceding_files
    from build_seasoning_held import dispatch
    files = dict(preceding_files())
    for path in PATHS:
        document = json.loads(files[path])
        description = document['minecraft:attachable']['description']
        if description['identifier'] != 'kaleidoscope_grilling:' + Path(path).name.removesuffix('.attachable.json'):
            raise ValueError('Pending identity does not match exact owned path')
        dispatch(description)
        files[path] = (json.dumps(document, ensure_ascii=False, indent=2) + '\n').encode()
    for prefix in PREFIXES:
        path = prefix + '/manifest.json'
        document = json.loads(files[path])
        document['header']['version'] = [2, 8, 149]
        for module in document['modules']:
            module['version'] = [2, 8, 149]
        for dependency in document.get('dependencies', []):
            if dependency.get('uuid') in {'c68005c5-23ff-54e8-a3ff-da6349ad43c2', 'bbbd2d60-52e5-53a6-8b9a-c09b0f516389'}:
                dependency['version'] = [2, 8, 149]
        files[path] = (json.dumps(document, ensure_ascii=False, indent=2) + '\n').encode()
    return MappingProxyType(files)


def predecessor_runtime(actual):
    from current_runtime_ownership import PREFIXES
    from seasoning_tp_source import expected_files as preceding_files
    before = preceding_files()
    expected = expected_files()
    changes = ledger()['changes']
    allowed = PATHS | {prefix + '/manifest.json' for prefix in PREFIXES}
    if actual != expected or set(expected) != set(before):
        raise ValueError('G149 runtime differs from exact pending offhand removal plus identity')
    changed = {path for path in expected if expected[path] != before[path]}
    if set(changes) != changed or changed != allowed:
        raise ValueError('Unreviewed G149 pending offhand scope')
    for path in changed:
        if changes[path] != {'operation': 'modify', 'before_sha256': sha(before[path]),
                             'after_sha256': sha(expected[path])}:
            raise ValueError('G149 reviewed pre/postimage mismatch: ' + path)
    return before


def reference_bytes(path, actual=None):
    """Exact nine pending postimages only; no arbitrary historical substitution."""
    from seasoning_tp_source import expected_files as preceding_files
    path = Path(path)
    key = path.relative_to(ROOT).as_posix() if path.is_absolute() else path.as_posix()
    if key not in PATHS:
        raise ValueError('Path is not owned by the pending offhand source layer: ' + key)
    actual = (ROOT / key).read_bytes() if actual is None else actual
    row = ledger()['changes'][key]
    before = preceding_files()[key]
    if (sha(actual) != row['after_sha256'] or sha(before) != row['before_sha256']
            or actual != expected_files()[key]):
        raise ValueError('Unreviewed pending offhand postimage/preimage: ' + key)
    return before
