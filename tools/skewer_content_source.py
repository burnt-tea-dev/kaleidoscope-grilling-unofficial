"""Exact G151 skewer-content continuation over the complete G150 runtime.

This layer checks source ownership only. Its postimages have no inherited native
or client acceptance. Every previous PUBLIC/G119/G150 witness keeps its original
bytes; only this candidate's sealed files can recover their G150 predecessors.
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
MAIN = BP + '/scripts/main.js'
SKEWER_CONTENT_BASE = 'aa091a1e91035d1510b579af11254a9bc9f86e6b'
PREVIOUS = SKEWER_CONTENT_BASE
PREVIOUS_TREE = '31a4a37c4cdc881548cf7429a6dbfecfc0a3f2ec'
VERSION = [2, 8, 151]
OWNERS = MappingProxyType({
    BP + '/manifest.json': 'g151_paired_identity',
    RP + '/manifest.json': 'g151_paired_identity',
    BP + '/host-extensions/board-api.json': 'typed_board_recipe_match',
    BP + '/scripts/host_api/board_api_core.js': 'typed_board_recipe_match',
    BP + '/scripts/host_api/board_api_runtime.js': 'typed_board_recipe_match',
    BP + '/scripts/a2727_cookery_host_recipes_core.js': 'typed_board_recipe_match',
    BP + '/scripts/a24_skewering_core.js': 'secret_thread_snapshot_match',
    BP + '/scripts/main.js': 'secret_content_lifecycle_and_threading',
    BP + '/scripts/a285_eating_transaction.js': 'secret_content_lifecycle',
    BP + '/scripts/food_snapshot_core.js': 'secret_saved_food_qualification',
    BP + '/scripts/secret_eating_core.js': 'secret_saved_food_qualification',
    RP + '/attachables/secret_skewer_native_plain.attachable.json': 'native_plain_secret_visuals',
    **{BP + '/' + path: 'cookery161_food_visuals' for path in (
        'entities/grill_food_visual.json',
        'entities/plate_food_visual.json',
        'entities/player.json',
        'scripts/held_visual_transport.js',
        'scripts/plate_held_visual_core.js',
        'scripts/secret_gui_color_data.js',
        'scripts/secret_held_runtime.js',
        'scripts/secret_visual_catalog.js',
        'scripts/secret_visual_state_core.js',
    )},
    **{RP + '/' + path: 'cookery161_food_visuals' for path in (
        'attachables/dark_grilling.attachable.json',
        'attachables/dark_grilling_java_three_alt.attachable.json',
        'attachables/dark_grilling_native_plain.attachable.json',
        'attachables/mysterious_skewer.attachable.json',
        'attachables/mysterious_skewer_java_three_alt.attachable.json',
        'attachables/mysterious_skewer_native_plain.attachable.json',
        'attachables/secret_skewer.attachable.json',
        'attachables/secret_skewer_java_three_alt.attachable.json',
        'attachables/skewer_plate.attachable.json',
        'attachables/unfinished_skewer.attachable.json',
        'entity/grill_food_visual.entity.json',
        'entity/plate_food_visual.entity.json',
        'models/entity/secret_helper_sprites.geo.json',
        'render_controllers/failure_skewer_held.render_controllers.json',
        'render_controllers/grill_food_visual.render_controllers.json',
        'render_controllers/plate_held.render_controllers.json',
        'render_controllers/secret_held.render_controllers.json',
    )},
    **{RP + f'/textures/secret_food_palette/food_{food}_{style}.png': 'cookery161_food_visuals'
       for food in (214, 215, 216, 217) for style in (0, 1, 2, 3, 4, 5, 6)},
})
PATHS = frozenset(OWNERS)
RUNTIME_PATHS = frozenset(path for path in PATHS if path.startswith((BP + '/', RP + '/')))
LEDGER = ROOT / 'tools/fixtures/g151-skewer-content-reviewed-delta.json'
LEDGER_SHA256 = '0db91b70a3a137b7921b9ae4f2f6f0fff205929e831f90b4f8824e372eed665f'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def ledger(data=None):
    data = LEDGER.read_bytes() if data is None else data
    if sha(data) != LEDGER_SHA256:
        raise ValueError('Unreviewed G151 skewer-content ledger')
    document = json.loads(data)
    if (document['schema'] != 1 or document['predecessor_commit'] != PREVIOUS
            or document['predecessor_tree'] != PREVIOUS_TREE
            or document['predecessor_version'] != [2, 8, 150]
            or document['version'] != VERSION or set(document['changes']) != PATHS
            or document['evidence_scope'] != 'source_only'
            or document['native_acceptance'] is not False
            or document['client_acceptance'] is not False):
        raise ValueError('Wrong G151 source identity or path scope')
    for path, row in document['changes'].items():
        if row['owner'] != OWNERS[path] or row['operation'] not in {'add', 'modify'}:
            raise ValueError('Wrong G151 path owner or operation: ' + path)
    return document


@lru_cache(maxsize=1)
def preceding_files():
    actual = subprocess.check_output(['git', 'rev-parse', PREVIOUS + '^{tree}'], cwd=ROOT, text=True).strip()
    if actual != PREVIOUS_TREE:
        raise ValueError('G151 predecessor source tree differs')
    data = subprocess.check_output(['git', 'archive', PREVIOUS, BP, RP, GUIDE], cwd=ROOT)
    with tarfile.open(fileobj=io.BytesIO(data)) as archive:
        files = {member.name: archive.extractfile(member).read() for member in archive if member.isfile()}
    return MappingProxyType(files)


def _key(path):
    path = Path(path)
    key = path.relative_to(ROOT).as_posix() if path.is_absolute() else path.as_posix()
    if '..' in Path(key).parts:
        raise ValueError('G151 source path leaves the repository')
    return key


def _validated_change(key, actual):
    if key not in PATHS:
        raise ValueError('Path is outside G151 skewer-content ownership: ' + key)
    row = ledger()['changes'][key]
    before = preceding_files().get(key)
    operation = 'add' if before is None else 'modify'
    if (row['operation'] != operation or row['before_sha256'] != (None if before is None else sha(before))
            or row['after_sha256'] != sha(actual) or before == actual):
        raise ValueError('Unreviewed G151 pre/postimage: ' + key)
    return before


def reference_bytes(path, actual=None):
    """Only a sealed modified postimage can expose its exact G150 preimage."""
    key = _key(path)
    actual = (ROOT / key).read_bytes() if actual is None else actual
    before = _validated_change(key, actual)
    if before is None:
        raise ValueError('A G151 addition has no historical source bytes: ' + key)
    return before


def addition_bytes(path, actual=None):
    """Validate a sealed new source file without inventing a historical proof."""
    key = _key(path)
    actual = (ROOT / key).read_bytes() if actual is None else actual
    if _validated_change(key, actual) is not None:
        raise ValueError('A modified G151 file is not a source addition: ' + key)
    return actual


def historical_bytes(path, actual=None):
    """First source boundary for historical callers; never normalizes bytes.

    Unchanged paths still face their existing witnesses. Modified G151 paths
    must match their complete candidate bytes before any older inverse runs.
    """
    key = _key(path)
    actual = (ROOT / key).read_bytes() if actual is None else actual
    if key not in PATHS:
        return actual
    try:
        version = json.loads((ROOT / BP / 'manifest.json').read_bytes())['header']['version']
    except (KeyError, TypeError, ValueError) as error:
        raise ValueError('Invalid release identity at the G151 source boundary') from error
    if version == VERSION and key in PATHS:
        return reference_bytes(path, actual)
    return actual


def generator_main_source(text):
    """Recover G150 only for this exact supplied G151 generation input.

    Earlier supplied pipeline inputs retain their old compiler contracts.
    Unrecognized current inputs still face those complete-source checks.
    """
    if sha(text.encode()) == ledger()['changes'][MAIN]['after_sha256']:
        return reference_bytes(MAIN, text.encode()).decode()
    return text


def reapply_main(text):
    """Compose sealed main edits after the complete unchanged G150 pipeline.

    Explicit operations retain supplied-input generation without reading main
    from disk or requiring an unpublished candidate commit object.
    """
    row = ledger()['changes'][MAIN]
    if text.encode() != preceding_files()[MAIN]:
        raise ValueError('G151 main reapplication requires its complete G150 predecessor')
    operations = row['operations']
    if (not operations or not all(0 <= op['start'] <= op['end'] <= len(text) for op in operations)
            or not all(a['end'] <= b['start'] for a, b in zip(operations, operations[1:]))):
        raise ValueError('Invalid G151 main operation scope')
    for operation in reversed(operations):
        start, end = operation['start'], operation['end']
        if text[start:end] != operation['before']:
            raise ValueError('G151 main operation has the wrong preimage')
        text = text[:start] + operation['after'] + text[end:]
    _validated_change(MAIN, text.encode())
    return text


def augment(output):
    """Final source-only compiler continuation; no asset or pose decisions."""
    result = dict(output)
    path = ROOT / MAIN
    result[path] = reapply_main(result[path])
    return result


def predecessor_runtime(actual):
    """Validate the entire candidate inventory before restoring G150 input."""
    before = {path: value for path, value in preceding_files().items() if path.startswith((BP + '/', RP + '/'))}
    if set(actual) != set(before) | RUNTIME_PATHS:
        raise ValueError('G151 runtime has an undeclared addition or deletion')
    changed = {path for path in actual if actual[path] != before.get(path)}
    if changed != RUNTIME_PATHS:
        raise ValueError('Unreviewed G151 runtime addition/deletion/scope')
    for path in RUNTIME_PATHS:
        _validated_change(path, actual[path])
    return MappingProxyType(before)
