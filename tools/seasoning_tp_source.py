"""G148 exact TP item contributor layer; historical witnesses retain G147 bytes.

The reviewed postimage ledger is code-owned. Neither a caller-supplied ledger nor
an arbitrary new selector can authorize a different runtime. Generator semantics
and the independent relative-matrix regression remain separate requirements.
"""
from functools import lru_cache
from pathlib import Path
from types import MappingProxyType
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]
LEDGER = ROOT / 'tools/fixtures/g148-seasoning-tp-reviewed-delta.json'
LEDGER_SHA256 = '8e8f7ac255839a5d1e0d8f5b44934e764aafb4b3c7249381d70c88807f5f830b'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def ledger(data=None):
    data = LEDGER.read_bytes() if data is None else data
    if sha(data) != LEDGER_SHA256:
        raise ValueError('Unreviewed G148 seasoning TP delta ledger')
    document = json.loads(data)
    if document['schema'] != 1 or document['predecessor_version'] != [2, 8, 147] or document['version'] != [2, 8, 148]:
        raise ValueError('Wrong seasoning TP source identity')
    return document


@lru_cache(maxsize=1)
def expected_files():
    from current_runtime_ownership import PREFIXES, owner_property_expected_files
    from build_seasoning_held import dispatch, tp_sprinkle
    files = dict(owner_property_expected_files())
    for path, data in list(files.items()):
        if path.startswith(PREFIXES[1] + '/attachables/special_seasoning'):
            document = json.loads(data)
            dispatch(document['minecraft:attachable']['description'])
            files[path] = (json.dumps(document, ensure_ascii=False, indent=2) + '\n').encode()
    files[PREFIXES[1] + '/animations/seasoning_tp.animation.json'] = (json.dumps(tp_sprinkle(), ensure_ascii=False, indent=2) + '\n').encode()
    for prefix in PREFIXES:
        path = prefix + '/manifest.json'
        document = json.loads(files[path])
        document['header']['version'] = [2, 8, 148]
        for module in document['modules']:
            module['version'] = [2, 8, 148]
        for dependency in document.get('dependencies', []):
            if dependency.get('uuid') in {'c68005c5-23ff-54e8-a3ff-da6349ad43c2', 'bbbd2d60-52e5-53a6-8b9a-c09b0f516389'}:
                dependency['version'] = [2, 8, 148]
        files[path] = (json.dumps(document, ensure_ascii=False, indent=2) + '\n').encode()
    return MappingProxyType(files)


def predecessor_runtime(actual):
    from current_runtime_ownership import owner_property_expected_files
    before = owner_property_expected_files()
    expected = expected_files()
    document = ledger()
    changes = document['changes']
    if actual != expected:
        raise ValueError('G148 runtime differs from exact TP contributor plus identity')
    changed = {path for path in expected if expected[path] != before.get(path)}
    if set(changes) != changed or set(expected) != set(before) | changed:
        raise ValueError('Unreviewed G148 addition/deletion/scope')
    for path in changed:
        row = changes[path]
        if row != {'operation': 'add' if path not in before else 'modify',
                   'before_sha256': sha(before[path]) if path in before else None,
                   'after_sha256': sha(expected[path])}:
            raise ValueError('G148 reviewed pre/postimage mismatch: ' + path)
    return before


def reference_bytes(path, actual=None):
    """Only exact reviewed SPECIAL postimages may use their historical preimage."""
    from current_runtime_ownership import owner_property_expected_files
    path = Path(path)
    key = path.relative_to(ROOT).as_posix() if path.is_absolute() else path.as_posix()
    actual = (ROOT / key).read_bytes() if actual is None else actual
    row = ledger()['changes'].get(key)
    if row is None or '/attachables/special_seasoning' not in key:
        raise ValueError('Path is not owned by the SPECIAL TP source layer: ' + key)
    before = owner_property_expected_files()[key]
    if sha(actual) != row['after_sha256'] or sha(before) != row['before_sha256'] or actual != expected_files()[key]:
        raise ValueError('Unreviewed SPECIAL TP postimage/preimage: ' + key)
    return before
