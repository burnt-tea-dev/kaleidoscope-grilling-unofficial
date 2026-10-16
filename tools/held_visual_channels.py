"""Owned hand-channel definitions shared by the three held asset generators.

The server transport retains all current property names. Values are selected
from a mutually exclusive item kind; no extra player property is introduced.
"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
NS = 'kaleidoscope_grilling:'
WORD_A_MAX, WORD_B_MAX = 521429, 682708
SECRET_MAX, INVALID, BOTTLE, PLATE = 213, 254, 214, 255
FAILURE = 220  #215..219 are reserved by the independent slime frame owner.


def verify_server_constants():
    bp = ROOT / 'projects/grilling/gameplay_core/behavior_pack/scripts'
    sources = (bp / 'held_visual_transport.js').read_text() + (bp / 'plate_held_visual_core.js').read_text()
    for name, value in [('HELD_VISUAL_INVALID', INVALID), ('HELD_VISUAL_BOTTLE', BOTTLE),
                        ('HELD_VISUAL_PLATE', PLATE), ('HELD_VISUAL_WORD_MAX', WORD_B_MAX),
                        ('PLATE_HELD_WORD_A_MAX', WORD_A_MAX), ('PLATE_HELD_WORD_B_MAX', WORD_B_MAX)]:
        assert re.search(r'export const ' + name + '=' + str(value) + r';', sources), name


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
    return f'({marker} >= 0 && {marker} <= {SECRET_MAX})'


def bottle_bank_ready(identifier):
    return f'{hand_owner(identifier)} && {hand_channel(11)} == {BOTTLE}'
