"""Immutable public repaired-source conservation, not private before/after proof."""
from functools import lru_cache
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_SOURCE_BASE = 'a2656e08d97a6b4c31ef3667b2c957e18c80c8fd'
PUBLIC_SOURCE_TREE = '7d2c9c91d9d3be7713d893c76d64aa458b2cb1db'

@lru_cache(maxsize=1)
def witness():
    meta = json.loads((ROOT / 'tools/fixtures/g69-public-source-witness.json').read_text())
    assert meta['schema'] == 1 and meta['commit'] == PUBLIC_SOURCE_BASE
    assert meta['tree'] == PUBLIC_SOURCE_TREE
    actual = subprocess.check_output(['git', 'rev-parse', PUBLIC_SOURCE_BASE + '^{tree}'], cwd=ROOT, text=True).strip()
    assert actual == PUBLIC_SOURCE_TREE, 'Public repaired-source tree mismatch'
    return meta


def public_bytes(relative_path):
    path = Path(relative_path)
    if path.is_absolute():
        path = path.relative_to(ROOT)
    assert '..' not in path.parts, 'Source path must remain inside repository'
    key = path.as_posix()
    meta = witness()
    assert key in meta['files'], 'Public source witness path absent: ' + key
    data = subprocess.check_output(['git', 'show', PUBLIC_SOURCE_BASE + ':' + key], cwd=ROOT)
    assert hashlib.sha256(data).hexdigest() == meta['files'][key], 'Public source bytes mismatch: ' + key
    return data


def public_json(relative_path):
    return json.loads(public_bytes(relative_path))


REVIEWED_HELD_CHANNEL_BASE = 'b37ec0d78b75f61e441a97fe31746dab5aac7fef'
HELD_CHANNEL_PATHS = frozenset({
    'projects/grilling/gameplay_core/behavior_pack/entities/player.json',
    'projects/grilling/gameplay_core/behavior_pack/scripts/secret_held_runtime.js',
    'projects/grilling/gameplay_core/resource_pack/attachables/secret_skewer.attachable.json',
    'projects/grilling/gameplay_core/resource_pack/attachables/secret_skewer_java_three_alt.attachable.json',
    'projects/grilling/gameplay_core/resource_pack/attachables/unfinished_skewer.attachable.json',
})


def _held_channel_delta():
    return json.loads((ROOT / 'tools/fixtures/g119-held-channel-reviewed-delta.json').read_text())


def reviewed_held_bytes(relative_path):
    # The G69 manifest and public_bytes/public_json keep their original meaning.
    # Only these five reviewed G119 files may continue from their exact preimage.
    path = Path(relative_path)
    if path.is_absolute():
        path = path.relative_to(ROOT)
    key = path.as_posix()
    assert key in HELD_CHANNEL_PATHS, 'Reviewed G119 held path outside scope'
    delta = _held_channel_delta()
    assert delta['schema'] == 1 and delta['release'] == [2, 8, 119]
    assert delta['previous_public_commit'] == PUBLIC_SOURCE_BASE
    assert delta['reviewed_commit'] == REVIEWED_HELD_CHANNEL_BASE
    assert set(delta['changes']) == HELD_CHANNEL_PATHS, 'Reviewed G119 held scope changed'
    row = delta['changes'][key]
    assert hashlib.sha256(public_bytes(key)).hexdigest() == row['before_sha256'], 'Reviewed G119 held has wrong public preimage'
    repaired = subprocess.check_output(['git', 'show', REVIEWED_HELD_CHANNEL_BASE + ':' + key], cwd=ROOT)
    assert hashlib.sha256(repaired).hexdigest() == row['after_sha256'], 'Reviewed G119 held source bytes mismatch'
    return repaired


PEPPER_PATH = 'projects/grilling/gameplay_core/behavior_pack/scripts/a2748_pepper_tree_runtime.js'
REVIEWED_PEPPER_BASE = 'dccbe92aca2973d498614653b4bda8b7f736e80c'


def _pepper_delta():
    return json.loads((ROOT / 'development/gameplay_core/fixtures/pepper-growth-2.8.118.json').read_text())


@lru_cache(maxsize=1)
def _pepper_preimage():
    # The selected G69 witness does not list pepper; keep that manifest frozen
    # and read only this path from the already pinned complete public commit.
    return subprocess.check_output(['git', 'show', PUBLIC_SOURCE_BASE + ':' + PEPPER_PATH], cwd=ROOT)


@lru_cache(maxsize=1)
def _reviewed_pepper_source():
    return subprocess.check_output(['git', 'show', REVIEWED_PEPPER_BASE + ':' + PEPPER_PATH], cwd=ROOT)


def reviewed_pepper_bytes(before_sha256):
    # Continue the G60/G67/G68 chain from its exact public preimage. The full
    # reviewed candidate file, not an editable fixture hash, defines G118 bytes.
    delta = _pepper_delta()
    assert delta['schema'] == 1 and delta['release'] == [2, 8, 118]
    assert delta['source_commit'] == REVIEWED_PEPPER_BASE
    assert delta['previous_public_commit'] == PUBLIC_SOURCE_BASE
    assert set(delta['changes']) == {PEPPER_PATH}, 'Reviewed G118 pepper scope changed'
    row = delta['changes'][PEPPER_PATH]
    assert row['before_sha256'] == before_sha256 == hashlib.sha256(_pepper_preimage()).hexdigest(), 'Reviewed G118 pepper has wrong public preimage'
    repaired = _reviewed_pepper_source()
    assert hashlib.sha256(repaired).hexdigest() == row['after_sha256'], 'Reviewed G118 pepper source bytes mismatch'
    return repaired


MAIN_PATH = 'projects/grilling/gameplay_core/behavior_pack/scripts/main.js'
REVIEWED_NUTRITION_BASE = '88e44dcd3815a52b5393adef5733a9abbca4e0c6'
REVIEWED_CONSERVATION_BASE = '0e23c65e74100a8b4171fc214d77f2241477a1e9'
REVIEWED_PARITY_BASE = '4a75af7ca1b54d30a2f877593c55a0f535423baf'
REVIEWED_REMAINING_BASE = '1e8011e1f71833739ea12097e80c0f69a21c844e'
CUISINE_CANDIDATE_BASE = 'f27d40a7c1bab951398e3fc3d3906bcc416c5c3f'
REVIEWED_CUISINE_BASE = '9fd92988f872ec1128aa071f2e045d54dbcdd4f4'
REVIEWED_SEASONING_DATA_BASE = '469441bc6556b5e91adedfd44876ac072572012a'
REVIEWED_SCENE_INTERACTION_BASE = '2ef4b7b6ffa782316378dc5d8fef3f9217b098bf'
REVIEWED_CATERPILLAR_CAMERA_BASE = '488b4402434447f516dfa5bf87f1d5e7e1e9f483'
NUTRITION_G114 = b"""function addSecretNutrition(player,stack,meta){
 const d=dynamicFood(stack),h=player.getComponent('minecraft:player.hunger'),sat=player.getComponent('minecraft:player.saturation');if(!d||!h||!sat)return;
 const hunger=Math.min(h.effectiveMax,h.currentValue+d.nutrition);h.setCurrentValue(hunger);
 const gain=d.nutrition*d.saturation*2*(meta?.hot?grillingConfig().saturationMultiplier:1);sat.setCurrentValue(Math.min(hunger,sat.currentValue+gain));
}
"""
NUTRITION_G115 = b"""function addSecretNutrition(player,stack,meta){
 const d=dynamicFood(stack),h=player.getComponent('minecraft:player.hunger'),sat=player.getComponent('minecraft:player.saturation');if(!d||!h||!sat)return;
 const hunger=Math.min(h.effectiveMax,h.currentValue+d.nutrition);h.setCurrentValue(hunger);
 // Hunger updates can leave the earlier saturation view with stale bounds.
 // Use the live native cap; a failed refresh must roll back the plate debit.
 const currentSat=player.getComponent('minecraft:player.saturation');
 if(!currentSat)throw new Error('Grilling: saturation component unavailable after nutrition update');
 const gain=d.nutrition*d.saturation*2*(meta?.hot?grillingConfig().saturationMultiplier:1);currentSat.setCurrentValue(Math.min(hunger,currentSat.effectiveMax,currentSat.currentValue+gain));
}
"""


@lru_cache(maxsize=1)
def _reviewed_nutrition_source():
    return subprocess.check_output(['git', 'show', REVIEWED_NUTRITION_BASE + ':' + MAIN_PATH], cwd=ROOT)


def _g115_nutrition_bytes(expected):
    # Only the already reviewed G114 -> public G115 function is admitted.
    # Neither current checkout bytes nor a caller-supplied hash defines truth.
    assert expected.count(NUTRITION_G114) == 1, 'Reviewed nutrition preimage changed'
    repaired = expected.replace(NUTRITION_G114, NUTRITION_G115, 1)
    assert repaired == _reviewed_nutrition_source(), 'Reviewed G115 source differs outside nutrition delta'
    return repaired


def _main_delta(filename):
    delta = json.loads((ROOT / 'tools/fixtures' / filename).read_text())
    assert delta['schema'] == 1
    return delta


def _apply_main_operations(expected, delta):
    assert hashlib.sha256(expected).hexdigest() == delta['before_sha256'], 'Reviewed main delta has wrong public preimage'
    text = expected.decode('utf-8')
    operations = delta['operations']
    assert operations and all(0 <= op['start'] <= op['end'] <= len(text) for op in operations)
    assert all(a['end'] <= b['start'] for a, b in zip(operations, operations[1:])), 'Reviewed edits overlap'
    for op in reversed(operations):
        assert text[op['start']:op['end']] == op['before'], 'Reviewed edit preimage changed'
        text = text[:op['start']] + op['after'] + text[op['end']:]
    expected = text.encode('utf-8')
    assert hashlib.sha256(expected).hexdigest() == delta['after_sha256'], 'Reviewed main delta is incomplete'
    return expected


@lru_cache(maxsize=1)
def _reviewed_conservation_source():
    return subprocess.check_output(['git', 'show', REVIEWED_CONSERVATION_BASE + ':' + MAIN_PATH], cwd=ROOT)


def _g117_conservation_bytes(expected):
    # Append the two reviewed G116 -> G117 repairs; retain every earlier preimage.
    # As with G115, an editable delta/hash cannot admit bytes outside the public commit.
    delta = _main_delta('g117-main-reviewed-delta.json')
    assert delta['path'] == MAIN_PATH and delta['release'] == [2, 8, 117]
    assert delta['reviewed_commit'] == REVIEWED_CONSERVATION_BASE
    assert len(delta['operations']) == 2, 'Reviewed G117 source requires exactly two repairs'
    repaired = _apply_main_operations(expected, delta)
    assert repaired == _reviewed_conservation_source(), 'Reviewed G117 source differs outside conservation deltas'
    return repaired


@lru_cache(maxsize=1)
def _reviewed_parity_source():
    return subprocess.check_output(['git', 'show', REVIEWED_PARITY_BASE + ':' + MAIN_PATH], cwd=ROOT)


def _g118_parity_bytes(expected):
    # Append only the reviewed F10/F15/F16 main.js changes to the exact G117
    # source. The immutable commit remains authoritative if a fixture is edited.
    delta = _main_delta('g118-main-reviewed-delta.json')
    assert delta['path'] == MAIN_PATH and delta['release'] == [2, 8, 118]
    assert delta['reviewed_commit'] == REVIEWED_PARITY_BASE
    assert len(delta['operations']) == 7, 'Reviewed G118 source requires exactly seven edits'
    repaired = _apply_main_operations(expected, delta)
    assert repaired == _reviewed_parity_source(), 'Reviewed G118 source differs outside parity deltas'
    return repaired


@lru_cache(maxsize=1)
def _reviewed_remaining_source():
    return subprocess.check_output(['git', 'show', REVIEWED_REMAINING_BASE + ':' + MAIN_PATH], cwd=ROOT)


def _g119_remaining_bytes(expected):
    # Preserve the complete G118 preimage. The five reviewed main edits only
    # route held plates and the acknowledged Heavy Metal settlement/cleanup.
    delta = _main_delta('g119-main-reviewed-delta.json')
    assert delta['path'] == MAIN_PATH and delta['release'] == [2, 8, 119]
    assert delta['reviewed_commit'] == REVIEWED_REMAINING_BASE
    assert len(delta['operations']) == 5, 'Reviewed G119 source requires exactly five edits'
    repaired = _apply_main_operations(expected, delta)
    assert repaired == _reviewed_remaining_source(), 'Reviewed G119 source differs outside remaining deltas'
    return repaired


@lru_cache(maxsize=1)
def _cuisine_candidate_source():
    return subprocess.check_output(['git', 'show', CUISINE_CANDIDATE_BASE + ':' + MAIN_PATH], cwd=ROOT)


def _cuisine_candidate_bytes(expected):
    # Preserve the exact, unmerged cuisine proposal and its original fixture.
    # Its G121 label is candidate history: the released G121 retained G120.
    delta = _main_delta('g121-main-reviewed-delta.json')
    assert delta['path'] == MAIN_PATH and delta['release'] == [2, 8, 121]
    assert delta['previous_public_commit'] == REVIEWED_REMAINING_BASE
    assert delta['reviewed_commit'] == CUISINE_CANDIDATE_BASE
    assert len(delta['operations']) == 7, 'Reviewed cuisine candidate requires exactly seven edits'
    repaired = _apply_main_operations(expected, delta)
    assert repaired == _cuisine_candidate_source(), 'Reviewed cuisine candidate differs outside cuisine deltas'
    return repaired


def cuisine_release_link():
    link = json.loads((ROOT / 'tools/fixtures/g122-cuisine-release-link.json').read_text())
    assert link['schema'] == 1 and link['release'] == [2, 8, 122]
    assert link['previous_release'] == [2, 8, 121]
    assert link['candidate_status'] == 'unmerged'
    assert link['candidate_commit'] == CUISINE_CANDIDATE_BASE
    assert link['candidate_fixtures'] == {
        'main': 'g121-main-reviewed-delta.json',
        'language': 'g121-guide-reviewed-delta.json',
    }, 'G122 candidate fixture scope changed'
    assert link['reviewed_commit'] == REVIEWED_CUISINE_BASE
    assert not REVIEWED_CUISINE_BASE.startswith('PENDING'), 'G122 public cuisine witness is pending publication'
    return link


@lru_cache(maxsize=1)
def _reviewed_cuisine_source():
    link = cuisine_release_link()
    return subprocess.check_output(['git', 'show', link['reviewed_commit'] + ':' + MAIN_PATH], cwd=ROOT)


def _g122_cuisine_bytes(expected):
    repaired = _cuisine_candidate_bytes(expected)
    cuisine_release_link()
    assert repaired == _reviewed_cuisine_source(), 'G122 public source differs from the exact cuisine candidate'
    return repaired


def _g124_seasoning_data_bytes(expected):
    delta = _main_delta('g124-main-reviewed-delta.json')
    assert delta['path'] == MAIN_PATH and delta['release'] == [2, 8, 124]
    assert delta['reviewed_commit'] == REVIEWED_SEASONING_DATA_BASE
    assert len(delta['operations']) == 3, 'G124 seasoning main scope changed'
    repaired = _apply_main_operations(expected, delta)
    reviewed = subprocess.check_output(['git', 'show', REVIEWED_SEASONING_DATA_BASE + ':' + MAIN_PATH], cwd=ROOT)
    assert repaired == reviewed, 'G124 public source differs outside exact seasoning resolver delta'
    return repaired


def _g125_scene_interaction_bytes(expected):
    # Continue from the exact G124 preimage. An editable operation/hash cannot
    # admit source beyond the independently published, reviewed repair commit.
    delta = _main_delta('g125-main-reviewed-delta.json')
    assert delta['path'] == MAIN_PATH and delta['release'] == [2, 8, 125]
    assert delta['previous_public_commit'] == REVIEWED_SEASONING_DATA_BASE
    assert delta['reviewed_commit'] == REVIEWED_SCENE_INTERACTION_BASE
    assert len(delta['operations']) == 17, 'G125 reviewed main scope changed'
    repaired = _apply_main_operations(expected, delta)
    reviewed = subprocess.check_output(['git', 'show', REVIEWED_SCENE_INTERACTION_BASE + ':' + MAIN_PATH], cwd=ROOT)
    assert repaired == reviewed, 'G125 public source differs outside exact scene/interaction deltas'
    return repaired


def _g126_caterpillar_camera_bytes(expected):
    # Exactly two routing expressions, continuing the complete G125 preimage.
    # The independently reviewed immutable runtime commit remains authoritative.
    delta = _main_delta('g126-main-reviewed-delta.json')
    assert delta['path'] == MAIN_PATH and delta['release'] == [2, 8, 126]
    assert delta['previous_public_commit'] == REVIEWED_SCENE_INTERACTION_BASE
    assert delta['reviewed_commit'] == REVIEWED_CATERPILLAR_CAMERA_BASE
    assert len(delta['operations']) == 2, 'G126 caterpillar main scope changed'
    repaired = _apply_main_operations(expected, delta)
    reviewed = subprocess.check_output(['git', 'show', REVIEWED_CATERPILLAR_CAMERA_BASE + ':' + MAIN_PATH], cwd=ROOT)
    assert repaired == reviewed, 'G126 public source differs outside exact caterpillar routing delta'
    return repaired


def _local_bottle_main_bytes(expected, version):
    # These are local candidate identities, distinct from published G72/G73.
    for patch_version, filename in (
        (71, 'g71-bottle-main-delta.json'),
        (72, 'g72-bottle-main-delta.json'),
        (73, 'g73-plate-alias-main-delta.json'),
    ):
        if version < (2, 8, patch_version):
            break
        delta = _main_delta(filename)
        assert delta['path'] == MAIN_PATH
        assert delta['release'] == [2, 8, patch_version]
        assert hashlib.sha256(expected).hexdigest() == delta['before_sha256'], 'Reviewed bottle delta has wrong preimage'
        lines = expected.decode('utf-8').splitlines(keepends=True)
        cursor, result = 0, []
        assert delta['edits'], 'Reviewed bottle delta has no edits'
        for edit in delta['edits']:
            start, end = edit['start'], edit['end']
            assert cursor <= start <= end <= len(lines), 'Reviewed bottle edits overlap or exceed source'
            assert ''.join(lines[start:end]) == edit['before'], 'Reviewed bottle edit preimage changed'
            result.extend(lines[cursor:start]); result.append(edit['after']); cursor = end
        result.extend(lines[cursor:])
        expected = ''.join(result).encode('utf-8')
        assert hashlib.sha256(expected).hexdigest() == delta['after_sha256'], 'Reviewed bottle delta is incomplete'
    return expected


def expected_main_bytes(version, *, local_bottles=False, proposal=None):
    """Published G73/G74 and local G71-G73 remain distinct; G75 adds one plate fix."""
    version = tuple(version)
    original = public_bytes(MAIN_PATH)
    if version in [(2,8,75),(2,8,76)]:
        assert proposal in ['plate_alias','seasoning'], 'Conflicting unpublished proposals require an explicit source lineage'
        if proposal=='seasoning':
            return _apply_main_operations(original, _main_delta('g74-main-reviewed-delta.json'))
    if version == (2,8,80):
        assert proposal in ["checkpoint_stop","jar_projection"], "Conflicting G80 proposals require explicit source lineage"
    if version >= (2, 8, 74):
        expected = _apply_main_operations(original, _main_delta('g74-main-reviewed-delta.json'))
        if version >= (2, 8, 77) or proposal=='plate_alias':
            delta = _main_delta('g75-main-reviewed-delta.json')
            assert delta['path'] == MAIN_PATH and delta['release'] == [2, 8, 75]
            local = _main_delta('g73-plate-alias-main-delta.json')['edits']
            assert len(delta['operations']) == len(local) == 1
            assert [(op['before'], op['after']) for op in delta['operations']] == [(op['before'], op['after']) for op in local]
            expected = _apply_main_operations(expected, delta)
        if version >= (2, 8, 81) or (version==(2,8,80) and proposal=="checkpoint_stop"):
            delta = _main_delta('g80-main-reviewed-delta.json')
            assert delta['path'] == MAIN_PATH and delta['release'] == [2, 8, 80]
            expected = _apply_main_operations(expected, delta)
        if version >= (2, 8, 83):
            delta = _main_delta('g83-main-reviewed-delta.json')
            assert delta['path'] == MAIN_PATH and delta['release'] == [2, 8, 83]
            expected = _apply_main_operations(expected, delta)
        if version >= (2, 8, 84):
            delta = _main_delta('g84-main-reviewed-delta.json')
            assert delta['path'] == MAIN_PATH and delta['release'] == [2, 8, 84]
            expected = _apply_main_operations(expected, delta)
        if version >= (2, 8, 85):
            delta = _main_delta('g85-main-reviewed-delta.json')
            assert delta['path'] == MAIN_PATH and delta['release'] == [2, 8, 85]
            expected = _apply_main_operations(expected, delta)
        if version >= (2, 8, 86):
            delta = _main_delta('g86-main-reviewed-delta.json')
            assert delta['path'] == MAIN_PATH and delta['release'] == [2, 8, 86]
            expected = _apply_main_operations(expected, delta)
        if version >= (2, 8, 94):
            delta = _main_delta('g94-main-reviewed-delta.json')
            assert delta['path'] == MAIN_PATH and delta['release'] == [2, 8, 94]
            expected = _apply_main_operations(expected, delta)
        if version >= (2, 8, 100):
            delta = _main_delta('g100-main-reviewed-delta.json')
            assert delta['path'] == MAIN_PATH and delta['release'] == [2, 8, 100]
            expected = _apply_main_operations(expected, delta)
        if version >= (2, 8, 105):
            delta = _main_delta('g105-main-reviewed-delta.json')
            assert delta['path'] == MAIN_PATH and delta['release'] == [2, 8, 105]
            expected = _apply_main_operations(expected, delta)
        if version >= (2, 8, 110):
            delta = _main_delta('g110-main-reviewed-delta.json')
            assert delta['path'] == MAIN_PATH and delta['release'] == [2, 8, 110]
            expected = _apply_main_operations(expected, delta)
        if version >= (2, 8, 111):
            delta = _main_delta('g111-main-reviewed-delta.json')
            assert delta['path'] == MAIN_PATH and delta['release'] == [2, 8, 111]
            expected = _apply_main_operations(expected, delta)
        if version >= (2, 8, 113):
            delta = _main_delta('g113-main-reviewed-delta.json')
            assert delta['path'] == MAIN_PATH and delta['release'] == [2, 8, 113]
            expected = _apply_main_operations(expected, delta)
        if version >= (2, 8, 114):
            delta = _main_delta('g114-main-reviewed-delta.json')
            assert delta['path'] == MAIN_PATH and delta['release'] == [2, 8, 114]
            expected = _apply_main_operations(expected, delta)
        if version >= (2, 8, 115):
            expected = _g115_nutrition_bytes(expected)
        if version >= (2, 8, 117):
            expected = _g117_conservation_bytes(expected)
        if version >= (2, 8, 118):
            expected = _g118_parity_bytes(expected)
        if version >= (2, 8, 119):
            expected = _g119_remaining_bytes(expected)
        # Released G121 adds the shared Tavern entrance and retains G120 main.
        # The separately reviewed cuisine candidate first enters release G122.
        if version >= (2, 8, 122):
            expected = _g122_cuisine_bytes(expected)
        if version >= (2, 8, 124):
            expected = _g124_seasoning_data_bytes(expected)
        if version >= (2, 8, 125):
            expected = _g125_scene_interaction_bytes(expected)
        if version >= (2, 8, 126):
            expected = _g126_caterpillar_camera_bytes(expected)
        return expected
    if local_bottles:
        return _local_bottle_main_bytes(original, version)
    if version >= (2, 8, 73):
        return _apply_main_operations(original, _main_delta('g73-main-reviewed-delta.json'))
    return original


def assert_public_bytes(testcase, path):
    path = Path(path)
    if not path.is_absolute():
        path = ROOT / path
    expected = public_bytes(path)
    relative = path.relative_to(ROOT).as_posix()
    if relative == MAIN_PATH:
        version = json.loads((ROOT / 'baseline.json').read_text())['version']
        expected = expected_main_bytes(version)
    elif relative in HELD_CHANNEL_PATHS:
        version = json.loads((ROOT / 'baseline.json').read_text())['version']
        if tuple(version) >= (2, 8, 119):
            expected = reviewed_held_bytes(relative)
    testcase.assertEqual(path.read_bytes(), expected, 'Repaired public-source bytes changed outside reviewed scope: ' + str(path.relative_to(ROOT)))


def assert_public_bytes_with_g71_bottles(testcase, path):
    """Conserve local bottle/plate repairs plus the exact published G73/G74 in G75."""
    path = Path(path)
    if not path.is_absolute():
        path = ROOT / path
    relative = path.relative_to(ROOT).as_posix()
    if relative != MAIN_PATH:
        return assert_public_bytes(testcase, path)
    version = json.loads((ROOT / 'baseline.json').read_text())['version']
    expected = expected_main_bytes(version, local_bottles=True)
    testcase.assertEqual(path.read_bytes(), expected, 'Source differs outside exact reviewed bottle, plate-alias and published G73 deltas')
