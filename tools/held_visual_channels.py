"""Owned hand-channel definitions shared by the three held asset generators.

The server transport retains all current property names. Values are selected
from a mutually exclusive item kind; no extra player property is introduced.
"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
NS = 'kaleidoscope_grilling:'
WORD_A_MAX, WORD_B_MAX = 521433, 683220
# SECRET_MAX is the legacy owner-marker ceiling, not the extended food count.
SECRET_MAX, INVALID, BOTTLE, PLATE = 213, 254, 214, 255
FAILURE = 220  #215..219 are reserved by the independent slime frame owner.
FOOD_COUNT, SECRET_VISUAL_MAX = 217, 5337
SECRET_EXT_MIN, SECRET_EXT_MAX = 221, 224
OIL_BRUSH, OIL_POT_IDLE = 225, 226  # G153: disjoint from extended secret helpers.


def verify_server_constants():
    bp = ROOT / 'projects/grilling/gameplay_core/behavior_pack/scripts'
    sources = (bp / 'held_visual_transport.js').read_text() + (bp / 'plate_held_visual_core.js').read_text()
    for name, value in [('HELD_VISUAL_INVALID', INVALID), ('HELD_VISUAL_BOTTLE', BOTTLE),
                        ('HELD_VISUAL_PLATE', PLATE), ('HELD_VISUAL_WORD_MAX', WORD_B_MAX),
                        ('PLATE_HELD_WORD_A_MAX', WORD_A_MAX), ('PLATE_HELD_WORD_B_MAX', WORD_B_MAX)]:
        assert re.search(r'export const ' + name + '=' + str(value) + r';', sources), name


def verify_oil_server_constants():
    source = (ROOT / 'projects/grilling/gameplay_core/behavior_pack/scripts/oil_brush_visual_core.js').read_text()
    for name, value in [('OIL_BRUSH_MARKER', OIL_BRUSH), ('OIL_POT_IDLE_MARKER', OIL_POT_IDLE)]:
        assert re.search(r'export const ' + name + '=' + str(value) + r';', source), name


def verify_owner_marker_allocation():
    owners = {'secret': set(range(SECRET_MAX + 1)) | set(range(SECRET_EXT_MIN, SECRET_EXT_MAX + 1)),
              'bottle': {BOTTLE}, 'slime': set(range(215, 220)), 'failure': {FAILURE},
              'oil_brush': {OIL_BRUSH}, 'oil_pot': {OIL_POT_IDLE}, 'invalid': {INVALID}, 'plate': {PLATE}}
    assigned = {}
    for owner, markers in owners.items():
        for marker in markers:
            assert 0 <= marker <= 255, (owner, marker)
            assert marker not in assigned, (owner, assigned.get(marker), marker)
            assigned[marker] = owner
    return owners


def channel_name(hand, index):
    assert hand in ('main', 'off') and 0 <= index < 12
    return NS + (f'bottle_{hand}_{index}' if index < 8 else
                 f'secret_{hand}_{index - 8}' if index < 11 else f'secret_{hand}_piece')


def property_read(hand, index):
    name = channel_name(hand, index)
    return f"(c.owning_entity->q.has_property('{name}') ? c.owning_entity->q.property('{name}') : 0)"


def hand_channel(index):
    return f"(c.item_slot == 'off_hand' ? {property_read('off', index)} : {property_read('main', index)})"


def hand_owner(identifier):
    return ("((c.item_slot == 'main_hand' && c.owning_entity->q.is_item_name_any('slot.weapon.mainhand','" + identifier +
            "')) || (c.item_slot == 'off_hand' && c.owning_entity->q.is_item_name_any('slot.weapon.offhand','" + identifier + "')))")


def secret_bank_ready():
    marker = hand_channel(11)
    return f'(({marker} >= 0 && {marker} <= {SECRET_MAX}) || ({marker} >= {SECRET_EXT_MIN} && {marker} <= {SECRET_EXT_MAX}))'


def secret_helper_index():
    marker = hand_channel(11)
    return f'({marker} >= {SECRET_EXT_MIN} && {marker} <= {SECRET_EXT_MAX} ? {marker} - 7 : ({marker} >= 0 && {marker} <= {SECRET_MAX} ? {marker} : 0))'


def bottle_bank_ready(identifier):
    return f'{hand_owner(identifier)} && {hand_channel(11)} == {BOTTLE}'
