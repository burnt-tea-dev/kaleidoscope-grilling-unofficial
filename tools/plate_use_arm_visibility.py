"""Narrow FP generic-use arm exclusion. No pose, map, or owned-route changes."""
import copy

GENERIC_USE = '(!query.item_is_charged && (variable.item_use_normalized > 0 && variable.item_use_normalized < 1.0))'
PLATE_USE = "variable.is_first_person == 1 && q.is_using_item && q.is_item_name_any('slot.weapon.mainhand','kaleidoscope_grilling:skewer_plate') && q.is_item_equipped('off_hand') == 0"
CORRECTED_USE = '(' + GENERIC_USE + ' && (' + PLATE_USE + ') == 0)'

def apply(document):
    """Accept only the unpatched generic leaf, exactly once in each left part.

    The calling producer owns and validates the complete document. This function
    deliberately has no legacy/current inverse or permissive idempotence mode.
    """
    result = copy.deepcopy(document)
    rows = result['render_controllers']['controller.render.player.first_person']['part_visibility']
    for bone in ('leftArm', 'leftSleeve'):
        fields = [row for row in rows if bone in row]
        if len(fields) != 1 or fields[0][bone].count(GENERIC_USE) != 1 or PLATE_USE in fields[0][bone]:
            raise ValueError('Unexpected plate arm generic-use predecessor: ' + bone)
        fields[0][bone] = fields[0][bone].replace(GENERIC_USE, CORRECTED_USE, 1)
    return result
