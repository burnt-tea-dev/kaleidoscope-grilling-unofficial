"""Scope custom eating state to the owning player and retain the native main clock.

Player animation queries inspect that player. Attachable queries have another
inspection context, so only our declared player properties are redirected. Native
queries keep their existing context. Offhand animation uses the already replicated
server presentation clock rather than borrowing a main-hand native counter.
"""
from pathlib import Path
import re
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'development/gameplay_core'))
from native_eating_clock import SECONDS, OBSERVER_SECONDS

PLAYER_SECONDS = "(q.is_using_item && q.property('kaleidoscope_grilling:eat_hand') == 2 ? " + OBSERVER_SECONDS + ' : ' + SECONDS + ')'
DIRECT = re.compile(r"(?<!->)\bq\.(has_property|property)\(('kaleidoscope_grilling:eat_[a-z_]+')\)")
OWNER = re.compile(r"c\.owning_entity->q\.(has_property|property)\(('kaleidoscope_grilling:eat_[a-z_]+')\)")

def owner_expression(text):
    return DIRECT.sub(r'c.owning_entity->q.\1(\2)', text)

ATTACHABLE_SECONDS = owner_expression(PLAYER_SECONDS)

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
    if isinstance(value, str):
        value = OWNER.sub(r'q.\1(\2)', value)
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
                'java_eating_player.animation.json', 'kg_probe_caterpillar_item.animation.json',
                'kg_probe_caterpillar_player.animation.json', 'kg_isolated_two_route_player.animation.json'}:
            result[path] = document(value, attachable='player' not in path.name)
    return result
