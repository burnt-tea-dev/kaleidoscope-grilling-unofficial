"""Scope custom eating state to the owning player and retain the native main clock.

Player animation queries inspect that player. Attachable queries have another
inspection context, so only our declared player properties are redirected. Native
queries keep their existing context. Offhand animation uses the already replicated
server presentation clock rather than borrowing a main-hand native counter.
"""
from pathlib import Path
from functools import lru_cache
import json
import re
import subprocess
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'development/gameplay_core'))
from native_eating_clock import SECONDS, OBSERVER_SECONDS

PLAYER_SECONDS = "(q.is_using_item && q.property('kaleidoscope_grilling:eat_hand') == 2 ? " + OBSERVER_SECONDS + ' : ' + SECONDS + ')'
DIRECT = re.compile(r"(?<!->)\bq\.(has_property|property)\(('kaleidoscope_grilling:eat_[a-z_]+')\)")
OWNER = re.compile(r"c\.owning_entity->q\.(has_property|property)\(('kaleidoscope_grilling:eat_[a-z_]+')\)")

def owner_expression(text):
    return DIRECT.sub(r'c.owning_entity->q.\1(\2)', text)

ATTACHABLE_SECONDS = owner_expression(PLAYER_SECONDS)
ROOT = Path(__file__).resolve().parents[1]
REVIEWED_EATING_CONTEXT_BASE = '83a22bbfca4ceae9c5267a282ad0a1d4b375658a'
PREVIOUS_EATING_CONTEXT_BASE = 'ce340a7d7f13cd5be0c0ff95e6556ed3187c81a8'

def expression(text, *, attachable):
    # The new expression contains the old main-hand branch. Protect the complete
    # new expression first so regeneration never nests another hand selector.
    marker = '\x00owned_eating_clock\x00'
    text = text.replace(PLAYER_SECONDS, marker).replace(SECONDS, PLAYER_SECONDS).replace(marker, PLAYER_SECONDS)
    return owner_expression(text) if attachable else text

def document(value, *, attachable):
    if isinstance(value, str):
        return expression(value, attachable=attachable)
    if isinstance(value, list):
        return [document(v, attachable=attachable) for v in value]
    if isinstance(value, dict):
        return {key: document(v, attachable=attachable) for key, v in value.items()}
    return value

def legacy_document(value):
    """Recover the exact historical generator input before its immutable check.

    Only this layer's property qualification and complete clock expression are
    reversed. Existing native/source hashes continue to reject unrelated changes.
    """
    if isinstance(value, dict):
        from eating_owner_properties import predecessor_document
        value = predecessor_document(value)
        from build_offhand_eating_projection import strip_document
        value = strip_document(value)
    if isinstance(value, str):
        value = OWNER.sub(r'q.\1(\2)', value)
        if value.startswith('v.kg_secret_terminal_'):
            state = value.split(' = ', 1)[0]
            if re.fullmatch(r'v\.kg_secret_terminal_(regular|alt)_seen_(main|off)', state):
                retained = '(' + state + ' ?? 0)'
                hand = state.rsplit('_', 1)[1]
                prefix = state.rsplit('_seen_', 1)[0] + '_snapshot_'
                values = ['v.kg_secret_ingredient_' + str(i) for i in range(3)] + ['v.kg_secret_piece_index']
                present = '(' + ' || '.join(v + ' > 0' for v in values[:3]) + ')'
                unchanged = '(' + ' && '.join(v + ' == (' + prefix + str(i) + '_' + hand + ' ?? 0)' for i, v in enumerate(values)) + ')'
                value = value.replace(' ? (' + present + ' && ' + unchanged + ' && ' + retained + ' == 2 ? 2 : 1) : (', ' ? 1 : (')
                value = value.replace(retained + ' > 0 &&', retained + ' == 1 &&').replace(' ? 2 : 0)', ' ? 1 : 0)')
            elif state == 'v.kg_secret_terminal_wait':
                value = value.replace(' || (v.kg_secret_terminal_seen ?? 0) == 2', '').replace('(v.kg_secret_terminal_seen ?? 0) > 0;', '(v.kg_secret_terminal_seen ?? 0) == 1;')
        return value.replace(PLAYER_SECONDS, SECONDS)
    if isinstance(value, list):
        return [legacy_document(v) for v in value]
    if isinstance(value, dict):
        return {key: legacy_document(v) for key, v in value.items()}
    return value

def augment(output):
    result = dict(output)
    for path, value in result.items():
        if not isinstance(value, dict):
            continue
        if path.parent.name == 'attachables':
            result[path] = document(value, attachable=True)
        elif path.parent.name == 'animations' and path.name in {
                'eating_motion.animation.json', 'java_eating_projection.animation.json',
                'java_eating_player.animation.json', 'offhand_eating_player.animation.json', 'ordinary_relative_player.animation.json', 'failure_skewer_player.animation.json', 'kg_probe_caterpillar_item.animation.json',
                'kg_probe_caterpillar_player.animation.json', 'kg_isolated_two_route_player.animation.json', 'review_three_player.animation.json', 'raw_one_player.animation.json'}:
            result[path] = document(value, attachable='player' not in path.name)
    return result

@lru_cache(maxsize=1)
def reviewed_changes():
    ledger = json.loads((ROOT / 'tools/fixtures/g143-eating-context-reviewed-delta.json').read_text())
    assert ledger['release'] == [2, 8, 143]
    assert ledger['reviewed_commit'] == REVIEWED_EATING_CONTEXT_BASE
    assert ledger['previous_public_commit'] == PREVIOUS_EATING_CONTEXT_BASE
    assert len(ledger['changes']) == 71
    return ledger['changes']

def reference_bytes(path):
    """Validate the exact current continuation before checking historical assets.

    Old native-capture hashes remain checks on old captured bytes. The current
    file must first equal the independently reviewed source, then reverse only
    this context/clock layer to its complete predecessor. This is source scope,
    never an assertion that the new file inherited native/client acceptance.
    """
    path = Path(path)
    path = path if path.is_absolute() else ROOT / path
    from skewer_content_source import historical_bytes
    current = historical_bytes(path)
    from eating_owner_properties import reference_bytes as owner_property_reference
    current = owner_property_reference(path, current)
    from public_source_witness import performance_witness_source, apply_performance_source
    performance = path.name == "main.js" and performance_witness_source(current.decode()) != current.decode()
    from build_offhand_eating_projection import contract as offhand_contract, strip_document as strip_offhand
    if path.relative_to(ROOT).as_posix() in offhand_contract()['predecessors']:
        current = (json.dumps(strip_offhand(json.loads(current)),ensure_ascii=False,indent=2)+'\n').encode()
    from effect_merge_source_witness import reference_bytes as effect_reference
    current = effect_reference(path,current)
    if path.suffix == '.js':
        from build_failure_skewer_held import predecessor_script
        current = predecessor_script(path,current.decode()).encode()
    from build_review_three_eating_projection import MAIN, restore_main
    if path == MAIN:current = restore_main(current.decode('utf-8')).encode('utf-8')
    from build_review_three_eating_projection import predecessor_document, ids, RP
    from build_raw_one_eating_projection import ids as raw_one_ids
    route_paths = {RP/'attachables'/(item.split(':')[1]+'.attachable.json') for item in ids()+raw_one_ids()} | {RP/'render_controllers/java_eating_player.render_controllers.json'}
    if path in route_paths:
        current = (json.dumps(predecessor_document(path,json.loads(current)),ensure_ascii=False,indent=2)+'\n').encode()
    from slime_frame_source_witness import reference_bytes as slime_reference_bytes
    current = slime_reference_bytes(path,current)
    relative = path.relative_to(ROOT).as_posix()
    if performance:current = apply_performance_source(current.decode()).encode()
    if relative not in reviewed_changes() or '/resource_pack/' not in relative:
        return current
    reviewed = subprocess.check_output(['git', 'show', REVIEWED_EATING_CONTEXT_BASE + ':' + relative], cwd=ROOT)
    assert current == reviewed, 'Current eating context differs from independently reviewed source: ' + relative
    before = subprocess.check_output(['git', 'show', PREVIOUS_EATING_CONTEXT_BASE + ':' + relative], cwd=ROOT)
    restored = (json.dumps(legacy_document(json.loads(current)), ensure_ascii=False, indent=2) + '\n').encode()
    assert restored == before, 'Eating context continuation changes historical curves/assets: ' + relative
    return before
