"""Bounded G127 bun TWO / pearl THREE camera projection.

Derive dedicated clips from unchanged maintained Java clips. The native-tested
IDs are retained for exact byte comparison; they do not assign a pack identity.
No shared, item, socket, helper or render-controller channel is rewritten.
"""
from pathlib import Path
from decimal import Decimal
import argparse
import copy
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[1]
P = ROOT / 'projects/grilling/gameplay_core'
BP, RP = P / 'behavior_pack', P / 'resource_pack'
SHARED = RP / 'animations/java_eating_player.animation.json'
DEDICATED = RP / 'animations/kg_isolated_two_route_player.animation.json'
MAIN = BP / 'scripts/main.js'
# Immutable native inputs, independent of this generator's implementation.
SHARED_SHA256 = '4ef03575f562e32f159ebfb9ba35e5bd05047a758b7e6a6004092d17e43d72e4'
NATIVE_CLIPS_SHA256 = 'a14a8333f6abb9eed55db1e7fa2aaa291ec83cc7dd6b0c924efe0dcdc823ef2d'
G126_MAIN_SHA256 = 'fe80e92759e63dd791586734a749f06d7386fb55eaaa4a6c29e4e885252fa4ce'
OLD_SELECTOR = "((e.itemStack.typeId==='kaleidoscope_grilling:grilled_caterpillar_skewer'&&profile==='ONE'&&hand!=='off')?'animation.kg_probe_caterpillar.player.one.right':('animation.kg_java_eating.player.'+profile.toLowerCase()+'.'+(hand==='off'?'left':'right')))"
ROUTES = (
    {'item_id': 'kaleidoscope_grilling:grilled_bun_slice_skewer', 'profile': 'TWO', 'code': 2,
     'original_clip': 'animation.kg_java_eating.player.two.right',
     'dedicated_clip': 'animation.kg_isolated_two_route_v1.player.bun_two.right', 'arms': ('rightarm',)},
    {'item_id': 'kaleidoscope_grilling:grilled_ender_pearl_skewer', 'profile': 'THREE', 'code': 3,
     'original_clip': 'animation.kg_java_eating.player.three.right',
     'dedicated_clip': 'animation.kg_isolated_two_route_v1.player.pearl_three.right', 'arms': ('rightarm', 'leftarm')},
)
SECRET_SUFFIX = " + (q.is_item_name_any('slot.weapon.mainhand','kaleidoscope_grilling:secret_skewer') ? 3.41 : 0)"


def encoded(value):
    if isinstance(value, bytes):
        return value
    if isinstance(value, str):
        return value.encode('utf-8')
    return (json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + '\n').encode('utf-8')


def route_gate(route):
    return (
        "variable.is_first_person == 1 && q.is_using_item && "
        "q.has_property('kaleidoscope_grilling:eat_projection') && "
        "q.has_property('kaleidoscope_grilling:eat_profile') && "
        "q.has_property('kaleidoscope_grilling:eat_hand') && "
        "q.property('kaleidoscope_grilling:eat_projection') == 1 && "
        f"q.property('kaleidoscope_grilling:eat_profile') == {route['code']} && "
        "q.property('kaleidoscope_grilling:eat_hand') == 1 && "
        "q.is_sneaking == 0 && q.is_swimming == 0 && "
        "q.is_gliding == 0 && q.is_riding == 0 && "
        "q.is_item_equipped('off_hand') == 0 && "
        f"q.is_item_name_any('slot.weapon.mainhand','{route['item_id']}')"
    )


def target_position(expression, arm, axis, route):
    pivot = f"q.get_default_bone_pivot('{arm}', {axis})"
    match = re.fullmatch(r'(-?\d+(?:\.\d+)?) - ' + re.escape(pivot) + r'(.*)', expression)
    suffix = SECRET_SUFFIX if route['code'] == 3 and axis == 1 else ''
    if match is None or match.group(2) != suffix:
        raise ValueError('Unexpected shared arm position or compensation: ' + expression)
    # S=.9375/E=25.92 remains a scoped tested mapping, not measured engine data.
    corrected = (Decimal(match.group(1)) + (Decimal('1.92') if axis == 1 else 0)) / Decimal('.9375')
    literal = format(corrected.quantize(Decimal('0.000000000001')), 'f').rstrip('0').rstrip('.')
    return f"{literal if literal and literal != '-0' else '0'} - {pivot}"


def animations(source):
    if hashlib.sha256(encoded(source)).hexdigest() != SHARED_SHA256:
        raise ValueError('Native-reviewed shared clip source drift')
    source = json.loads(encoded(source))
    result = {'format_version': source['format_version'], 'animations': {}}
    for route in ROUTES:
        clip = copy.deepcopy(source['animations'][route['original_clip']])
        clip['blend_weight'] = '(' + clip['blend_weight'] + ') && (' + route_gate(route) + ')'
        for arm in route['arms']:
            bone = clip['bones'][arm]
            if set(bone) != {'position', 'rotation'}:
                raise ValueError('Unexpected shared arm channels')
            bone['position'] = {time: [target_position(value, arm, axis, route)
                                     for axis, value in enumerate(values)]
                                for time, values in bone['position'].items()}
            bone['scale'] = ['1.0 / 0.9375'] * 3
        result['animations'][route['dedicated_clip']] = clip
    if hashlib.sha256(encoded(result)).hexdigest() != NATIVE_CLIPS_SHA256:
        raise ValueError('Generated dedicated clips differ from native-tested bytes')
    return result


def new_selector():
    expression = OLD_SELECTOR
    for route in reversed(ROUTES):
        condition = (f"e.itemStack.typeId==='{route['item_id']}'&&profile==='{route['profile']}'"
                     "&&hand==='main'&&!heldByHand(e.source,'off')")
        expression = f"(({condition})?'{route['dedicated_clip']}':{expression})"
    return expression


def restore_main(text):
    """Reverse only this exact wrapper, then verify the entire G126 witness.

    This is composition, not an exemption: extra edits, partial wrappers,
    duplicate calls or altered fallback routes always fail closed.
    """
    old_call = 'e.source.playAnimation(' + OLD_SELECTOR + ',{'
    new_call = 'e.source.playAnimation(' + new_selector() + ',{'
    if text.count(new_call) == 1:
        restored = text.replace(new_call, old_call, 1)
    elif text.count(old_call) == 1:
        restored = text
    else:
        raise ValueError('Unsupported or ambiguous canonical eating dispatch')
    if hashlib.sha256(restored.encode('utf-8')).hexdigest() != G126_MAIN_SHA256:
        raise ValueError('Main differs outside the exact two-route dispatch wrapper')
    return restored


def patch_main(text):
    restored = restore_main(text)
    return restored.replace('e.source.playAnimation(' + OLD_SELECTOR + ',{',
                            'e.source.playAnimation(' + new_selector() + ',{', 1)


def augment(output):
    output = dict(output)
    source = output.get(SHARED)
    if source is None:
        source = SHARED.read_bytes()
    output[DEDICATED] = animations(source)
    # Run after the G126 augment so its exact caterpillar wrapper is retained.
    text = output.get(MAIN)
    if text is None:
        text = MAIN.read_text()
    if not isinstance(text, str):
        raise ValueError('Canonical main must be text')
    output[MAIN] = patch_main(text)
    return output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    for path, value in augment({}).items():
        data = encoded(value)
        if args.check:
            if path.read_bytes() != data:
                raise AssertionError(path)
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
    print('Exact two-route source verified; release identity unassigned, native/full-family acceptance separate')


if __name__ == '__main__':
    main()
