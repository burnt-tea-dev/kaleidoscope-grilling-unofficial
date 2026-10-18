"""Exact G153 repair admission over immutable public G152, never a wildcard.

The explicit composed owner map and pinned ledger digest admit only reviewed
postimages and recover the exact immutable G152 predecessor.
Historical ledgers and their mutation checks are not rewritten.
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
REPAIR_SOURCE_BASE = '5bc8f43f45a6cd0d287b5557db24e2da4dd2c207'
PREVIOUS = REPAIR_SOURCE_BASE
PREVIOUS_TREE = '568a556b6455188fb7a8fca895c86001380245b6'
BP = 'projects/grilling/gameplay_core/behavior_pack'
RP = 'projects/grilling/gameplay_core/resource_pack'
GUIDE = 'projects/grilling/guide/catalog.a3.json'
# Explicit reviewed runtime paths plus the authored guide catalog.
# No candidate-driven glob, automatic owner inference or ledger-supplied scope.
OWNERS = MappingProxyType({'projects/grilling/gameplay_core/behavior_pack/blocks/onion_crop.json': 'crop_java_geometry',
 'projects/grilling/gameplay_core/behavior_pack/manifest.json': 'release_identity',
 'projects/grilling/gameplay_core/behavior_pack/scripts/a2748_pepper_tree_runtime.js': 'pepper_harvest_conservation',
 'projects/grilling/gameplay_core/behavior_pack/scripts/advanced_rack_layout.js': 'rack_visual_selection',
 'projects/grilling/gameplay_core/behavior_pack/scripts/guide/payload.js': 'guide_processing_flows',
 'projects/grilling/gameplay_core/behavior_pack/scripts/guide/publisher.js': 'guide_processing_flows',
 'projects/grilling/gameplay_core/behavior_pack/scripts/held_visual_transport.js': 'oil_brush_visual',
 'projects/grilling/gameplay_core/behavior_pack/scripts/main.js': 'oil_brush_visual',
 'projects/grilling/gameplay_core/behavior_pack/scripts/oil_brush_visual_core.js': 'oil_brush_visual',
 'projects/grilling/gameplay_core/behavior_pack/scripts/oil_brush_visual_runtime.js': 'oil_brush_visual',
 'projects/grilling/gameplay_core/behavior_pack/scripts/server_config_core.js': 'oil_brush_visual',
 'projects/grilling/gameplay_core/behavior_pack/scripts/server_config_runtime.js': 'oil_brush_visual',
 'projects/grilling/gameplay_core/behavior_pack/scripts/station_contents_visual_runtime.js': 'rack_visual_selection',
 'projects/grilling/gameplay_core/resource_pack/animations/oil_brush.animation.json': 'oil_brush_visual',
 'projects/grilling/gameplay_core/resource_pack/animations/oil_brush_player.animation.json': 'oil_brush_visual',
 'projects/grilling/gameplay_core/resource_pack/attachables/grilling_oil_pot_brush.attachable.json': 'oil_brush_visual',
 'projects/grilling/gameplay_core/resource_pack/attachables/grilling_oil_pot_filled_brush.attachable.json': 'oil_brush_visual',
 'projects/grilling/gameplay_core/resource_pack/manifest.json': 'release_identity',
 'projects/grilling/gameplay_core/resource_pack/models/blocks/canola_crop.geo.json': 'crop_java_geometry',
 'projects/grilling/gameplay_core/resource_pack/models/blocks/houttuynia_crop.geo.json': 'crop_java_geometry',
 'projects/grilling/gameplay_core/resource_pack/models/blocks/onion_crop.geo.json': 'crop_java_geometry',
 'projects/grilling/gameplay_core/resource_pack/models/entity/oil_brush_canola_oil_brush.geo.json': 'oil_brush_visual',
 'projects/grilling/gameplay_core/resource_pack/models/entity/oil_brush_oil_pot_canola.geo.json': 'oil_brush_visual',
 'projects/grilling/gameplay_core/resource_pack/models/entity/oil_brush_oil_pot_premium_chili.geo.json': 'oil_brush_visual',
 'projects/grilling/gameplay_core/resource_pack/models/entity/oil_brush_oil_pot_secret_chili.geo.json': 'oil_brush_visual',
 'projects/grilling/gameplay_core/resource_pack/models/entity/oil_brush_pot_has_oil.geo.json': 'oil_brush_visual',
 'projects/grilling/gameplay_core/resource_pack/models/entity/oil_brush_pot_no_oil.geo.json': 'oil_brush_visual',
 'projects/grilling/gameplay_core/resource_pack/models/entity/oil_brush_premium_chili_oil_brush.geo.json': 'oil_brush_visual',
 'projects/grilling/gameplay_core/resource_pack/models/entity/oil_brush_secret_chili_oil_brush.geo.json': 'oil_brush_visual',
 'projects/grilling/gameplay_core/resource_pack/render_controllers/oil_brush.render_controllers.json': 'oil_brush_visual',
 'projects/grilling/gameplay_core/resource_pack/texts/en_US.lang': 'guide_processing_flows',
 'projects/grilling/gameplay_core/resource_pack/texts/zh_CN.lang': 'guide_processing_flows',
 'projects/grilling/gameplay_core/resource_pack/texts/zh_TW.lang': 'guide_processing_flows',
 'projects/grilling/gameplay_core/resource_pack/textures/held/java_oil_pot_canola.png': 'oil_brush_visual',
 'projects/grilling/gameplay_core/resource_pack/textures/held/java_oil_pot_premium_chili.png': 'oil_brush_visual',
 'projects/grilling/gameplay_core/resource_pack/textures/held/java_oil_pot_secret_chili.png': 'oil_brush_visual',
 'projects/grilling/gameplay_core/resource_pack/textures/held/java_pot_has_oil.png': 'oil_brush_visual',
 'projects/grilling/gameplay_core/resource_pack/textures/held/java_pot_no_oil.png': 'oil_brush_visual',
 'projects/grilling/guide/catalog.a3.json': 'guide_processing_flows'})
OPERATIONS = MappingProxyType({'projects/grilling/gameplay_core/behavior_pack/blocks/onion_crop.json': 'modify',
 'projects/grilling/gameplay_core/behavior_pack/manifest.json': 'modify',
 'projects/grilling/gameplay_core/behavior_pack/scripts/a2748_pepper_tree_runtime.js': 'modify',
 'projects/grilling/gameplay_core/behavior_pack/scripts/advanced_rack_layout.js': 'modify',
 'projects/grilling/gameplay_core/behavior_pack/scripts/guide/payload.js': 'modify',
 'projects/grilling/gameplay_core/behavior_pack/scripts/guide/publisher.js': 'modify',
 'projects/grilling/gameplay_core/behavior_pack/scripts/held_visual_transport.js': 'modify',
 'projects/grilling/gameplay_core/behavior_pack/scripts/main.js': 'modify',
 'projects/grilling/gameplay_core/behavior_pack/scripts/oil_brush_visual_core.js': 'add',
 'projects/grilling/gameplay_core/behavior_pack/scripts/oil_brush_visual_runtime.js': 'add',
 'projects/grilling/gameplay_core/behavior_pack/scripts/server_config_core.js': 'modify',
 'projects/grilling/gameplay_core/behavior_pack/scripts/server_config_runtime.js': 'modify',
 'projects/grilling/gameplay_core/behavior_pack/scripts/station_contents_visual_runtime.js': 'modify',
 'projects/grilling/gameplay_core/resource_pack/animations/oil_brush.animation.json': 'add',
 'projects/grilling/gameplay_core/resource_pack/animations/oil_brush_player.animation.json': 'add',
 'projects/grilling/gameplay_core/resource_pack/attachables/grilling_oil_pot_brush.attachable.json': 'add',
 'projects/grilling/gameplay_core/resource_pack/attachables/grilling_oil_pot_filled_brush.attachable.json': 'add',
 'projects/grilling/gameplay_core/resource_pack/manifest.json': 'modify',
 'projects/grilling/gameplay_core/resource_pack/models/blocks/canola_crop.geo.json': 'modify',
 'projects/grilling/gameplay_core/resource_pack/models/blocks/houttuynia_crop.geo.json': 'modify',
 'projects/grilling/gameplay_core/resource_pack/models/blocks/onion_crop.geo.json': 'add',
 'projects/grilling/gameplay_core/resource_pack/models/entity/oil_brush_canola_oil_brush.geo.json': 'add',
 'projects/grilling/gameplay_core/resource_pack/models/entity/oil_brush_oil_pot_canola.geo.json': 'add',
 'projects/grilling/gameplay_core/resource_pack/models/entity/oil_brush_oil_pot_premium_chili.geo.json': 'add',
 'projects/grilling/gameplay_core/resource_pack/models/entity/oil_brush_oil_pot_secret_chili.geo.json': 'add',
 'projects/grilling/gameplay_core/resource_pack/models/entity/oil_brush_pot_has_oil.geo.json': 'add',
 'projects/grilling/gameplay_core/resource_pack/models/entity/oil_brush_pot_no_oil.geo.json': 'add',
 'projects/grilling/gameplay_core/resource_pack/models/entity/oil_brush_premium_chili_oil_brush.geo.json': 'add',
 'projects/grilling/gameplay_core/resource_pack/models/entity/oil_brush_secret_chili_oil_brush.geo.json': 'add',
 'projects/grilling/gameplay_core/resource_pack/render_controllers/oil_brush.render_controllers.json': 'add',
 'projects/grilling/gameplay_core/resource_pack/texts/en_US.lang': 'modify',
 'projects/grilling/gameplay_core/resource_pack/texts/zh_CN.lang': 'modify',
 'projects/grilling/gameplay_core/resource_pack/texts/zh_TW.lang': 'modify',
 'projects/grilling/gameplay_core/resource_pack/textures/held/java_oil_pot_canola.png': 'add',
 'projects/grilling/gameplay_core/resource_pack/textures/held/java_oil_pot_premium_chili.png': 'add',
 'projects/grilling/gameplay_core/resource_pack/textures/held/java_oil_pot_secret_chili.png': 'add',
 'projects/grilling/gameplay_core/resource_pack/textures/held/java_pot_has_oil.png': 'add',
 'projects/grilling/gameplay_core/resource_pack/textures/held/java_pot_no_oil.png': 'add',
 'projects/grilling/guide/catalog.a3.json': 'modify'})  # Explicit add/modify for exactly the same paths.
PATHS = frozenset(OWNERS)
RUNTIME_PATHS = frozenset(path for path in PATHS if path.startswith((BP+'/', RP+'/')))
LEDGER = ROOT / 'tools/fixtures/g153-repair-reviewed-delta.json'
LEDGER_SHA256 = 'eac80c0a35a7edb50bb23b92349eca1928918116f855c6647acf855c601ccceb'  # Pinned after exact composed source review.


def sha(data):
    return hashlib.sha256(data).hexdigest()


def ledger(data=None):
    if not PATHS or not isinstance(LEDGER_SHA256, str) or len(LEDGER_SHA256) != 64:
        raise ValueError('G153 repair admission has not been finalized')
    data = LEDGER.read_bytes() if data is None else data
    if sha(data) != LEDGER_SHA256:
        raise ValueError('Unreviewed G153 repair ledger')
    doc = json.loads(data)
    if (doc['schema'] != 1 or doc['predecessor_commit'] != PREVIOUS
            or doc['predecessor_tree'] != PREVIOUS_TREE
            or doc['predecessor_version'] != [2, 8, 152]
            or doc['version'] != [2, 8, 153] or set(doc['changes']) != PATHS
            or set(OPERATIONS) != PATHS
            or doc.get('evidence_scope') != 'source_only'
            or doc.get('native_acceptance') is not False or doc.get('client_acceptance') is not False):
        raise ValueError('Wrong G153 repair identity or scope')
    for path, row in doc['changes'].items():
        if (Path(path).is_absolute() or '..' in Path(path).parts
                or not (path == GUIDE or path.startswith((BP+'/', RP+'/')))
                or row['owner'] != OWNERS[path]
                or OPERATIONS[path] not in {'add','modify'} or row['operation'] != OPERATIONS[path]):
            raise ValueError('Wrong G153 repair owner or operation: '+path)
    return doc


@lru_cache(maxsize=1)
def preceding_files():
    tree = subprocess.check_output(['git', 'rev-parse', PREVIOUS+'^{tree}'], cwd=ROOT, text=True).strip()
    if tree != PREVIOUS_TREE:
        raise ValueError('G152 complete predecessor tree differs')
    data = subprocess.check_output(['git', 'archive', PREVIOUS, BP, RP], cwd=ROOT)
    with tarfile.open(fileobj=io.BytesIO(data)) as archive:
        files = {entry.name: archive.extractfile(entry).read() for entry in archive if entry.isfile()}
    return MappingProxyType(files)


@lru_cache(maxsize=None)
def preceding_bytes(path):
    if path not in PATHS:
        raise ValueError('Path outside G153 repair scope: '+path)
    if path == GUIDE:
        # preceding_files validates full tree even when this non-runtime path
        # is the first witness called in a standalone historical validator.
        preceding_files()
        return subprocess.check_output(['git', 'show', PREVIOUS+':'+path], cwd=ROOT)
    before = preceding_files().get(path)
    if OPERATIONS[path] == 'add':
        if before is not None:
            raise ValueError('G153 added path already exists in predecessor: '+path)
        return None
    if before is None:
        raise ValueError('G153 modified path has no predecessor: '+path)
    return before


def reference_bytes(path, actual=None):
    """Historical read boundary: untouched bytes pass through, owned bytes verify.

    An already recovered exact G152 preimage is allowed for composed witnesses;
    the complete inventory entry point still requires every G153 postimage.
    """
    path = Path(path)
    key = path.relative_to(ROOT).as_posix() if path.is_absolute() else path.as_posix()
    if '..' in Path(key).parts:
        raise ValueError('G153 source path leaves the repository')
    actual = (ROOT/key).read_bytes() if actual is None else actual
    from g155_plate_source import historical_bytes as outer_history
    if key in PATHS and actual == preceding_bytes(key):
        return actual
    # A composed witness may already hold the exact G153 postimage. Every
    # successor byte string must cross its own sealed boundary first.
    if key not in PATHS or sha(actual) != ledger()['changes'][key]['after_sha256']:
        actual = outer_history(key, actual)
    from g154_host_source import applies as host_active, PATHS as HOST_PATHS, reference_bytes as host_reference
    if key not in PATHS:
        return host_reference(key, actual) if host_active(ROOT) and key in HOST_PATHS else actual
    before = preceding_bytes(key)
    if host_active(ROOT) and key in HOST_PATHS:
        # Composed witnesses may already supply the exact G152 preimage.
        # Every other G154-owned input must cross its own exact boundary first.
        if actual != before:
            actual = host_reference(key, actual)
    if before is None:
        # There is no historical byte witness for a new resource. Only the
        # complete runtime inverse can remove its exact admitted postimage.
        raise ValueError('Added G153 path has no historical byte preimage: '+key)
    if actual == before:
        return before
    row = ledger()['changes'][key]
    if sha(before) != row['before_sha256'] or sha(actual) != row['after_sha256']:
        raise ValueError('Unreviewed G153 repair pre/postimage: '+key)
    return before


def expected_files():
    # Working postimages and the ledger must be revalidated on every admission.
    # Cache only immutable Git predecessors, never mutable candidate evidence.
    doc = ledger()
    files = dict(preceding_files())
    for path in PATHS:
        actual = (ROOT/path).read_bytes()
        from g154_host_source import applies as host_active, reference_bytes as host_reference
        if host_active(ROOT): actual = host_reference(path, actual)
        row = doc['changes'][path]
        before = preceding_bytes(path)
        if ((None if before is None else sha(before)) != row['before_sha256'] or sha(actual) != row['after_sha256']
                or actual == before):
            raise ValueError('G153 repair postimage missing or changed: '+path)
        if path in RUNTIME_PATHS:
            files[path] = actual
    return MappingProxyType(files)


def predecessor_runtime(actual):
    if json.loads(actual.get(BP+'/manifest.json', b'{}')).get('header', {}).get('version') == [2,8,155]:
        from g155_plate_source import predecessor_runtime as outer_predecessor
        actual = outer_predecessor(actual)
    if json.loads(actual.get(BP+'/manifest.json', b'{}')).get('header', {}).get('version') == [2,8,154]:
        from g154_host_source import predecessor_runtime as host_predecessor
        actual = host_predecessor(actual)
    before = preceding_files()
    additions = {path for path in RUNTIME_PATHS if OPERATIONS[path] == 'add'}
    if actual != expected_files() or set(actual) != set(before) | additions:
        raise ValueError('G153 runtime differs from complete reviewed repair layer')
    if {path for path in actual if path not in before or actual[path] != before[path]} != RUNTIME_PATHS:
        raise ValueError('G153 repair runtime path scope changed')
    return before


def reapply_bytes(path, historical):
    """Keep an admitted successor only when a legacy builder reproduces its exact preimage."""
    path = Path(path)
    key = path.relative_to(ROOT).as_posix() if path.is_absolute() else path.as_posix()
    if '..' in Path(key).parts:
        raise ValueError('G153 source path leaves the repository')
    if key not in PATHS:
        return historical
    before = preceding_bytes(key)
    if before is None or historical != before:
        raise ValueError('Legacy builder changed G153 predecessor: '+key)
    actual = (ROOT/key).read_bytes()
    reference_bytes(key, actual)
    from g155_plate_source import historical_bytes as outer_history
    from g154_host_source import applies as host_active, PATHS as HOST_PATHS, reference_bytes as host_reference
    admitted = outer_history(key, actual)
    if host_active(ROOT) and key in HOST_PATHS:
        admitted = host_reference(key, admitted)
    if sha(admitted) != ledger()['changes'][key]['after_sha256']:
        raise ValueError('Missing admitted G153 postimage: '+key)
    return actual


def historical_bytes(path, actual=None):
    """Admit the current live G153 source before any immutable older inverse."""
    actual = (ROOT / path).read_bytes() if actual is None else actual
    try:
        version = json.loads((ROOT / BP / 'manifest.json').read_bytes())['header']['version']
    except (KeyError, TypeError, ValueError) as error:
        raise ValueError('Invalid release identity at the G153 repair boundary') from error
    from g155_plate_source import predecessor_version as outer_version
    return reference_bytes(path, actual) if outer_version(version) in ([2, 8, 153], [2, 8, 154]) else actual


def predecessor_version(version):
    from g155_plate_source import predecessor_version as outer_version
    version = outer_version(version)
    if version == [2,8,154]:
        from g154_host_source import reference_bytes as host_reference
        version = json.loads(host_reference(BP+'/manifest.json'))['header']['version']
    if version != [2, 8, 153]:
        return version
    return json.loads(reference_bytes(BP + '/manifest.json'))['header']['version']
