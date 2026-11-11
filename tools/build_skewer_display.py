"""Generate threaded-skewer item-space poses from the original Java display.

The native item-slot binding supplies the holder and camera. No fitted camera,
engine-version offset, player skeleton, gameplay code or test is run here.
Java ItemTransform.apply uses rotationXYZ and mirrors Y/Z angles and X
translation for the left hand. Bedrock channels apply X then Y then Z.
"""
import argparse
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RP = ROOT / 'projects/grilling/gameplay_core/resource_pack'
ITEMS = ('unfinished_skewer', 'secret_skewer', 'secret_skewer_native_plain',
         'secret_skewer_java_three_alt')
PREFIX = 'animation.kg_secret_held.display_'


def display_pose(display, left):
    sign = -1 if left else 1
    x, y, z = map(math.radians, display['rotation'])
    y, z = y * sign, z * sign
    cx, sx, cy, sy, cz, sz = math.cos(x), math.sin(x), math.cos(y), math.sin(y), math.cos(z), math.sin(z)
    # Java Rx*Ry*Rz, resolved as Bedrock Rz*Ry*Rx. The existing Java element
    # converter reflects X in geometry and X/Y in rotation channels (CONVERSION).
    r00, r10 = cy * cz, cx * sz + sx * sy * cz
    r20, r21, r22 = sx * sz - cx * sy * cz, sx * cz + cx * sy * sz, cx * cy
    rotation = [-math.degrees(math.atan2(r21, r22)),
                -math.degrees(math.asin(max(-1, min(1, -r20)))),
                math.degrees(math.atan2(r10, r00))]
    tx, ty, tz = display['translation']
    return {'loop': True, 'bones': {
        'skewer_pose': {'position': [-sign * tx, ty, tz],
                        'rotation': [round(v, 10) for v in rotation],
                        'scale': display['scale']},
        # Java's item renderer centers [0,16]^3 at [8,8,8]. The current bound
        # mesh is [8-x,24+y,z-8], with pivot [0,24,0]: recenter Y before display.
        'skewer_model': {'position': [0, -8, 0]}}}


def outputs(java_root):
    models = java_root / 'common/src/main/resources/assets/kaleidoscope_grilling/models/item'
    animations = {}
    result = {}
    for item in ITEMS:
        source = 'unfinished_skewer' if item == 'unfinished_skewer' else 'secret_skewer'
        display = json.loads((models / (source + '.json')).read_text())['display']
        for view, java_view in [('fp', 'firstperson'), ('tp', 'thirdperson')]:
            for hand, java_hand in [('right', 'righthand'), ('left', 'lefthand')]:
                name = PREFIX + source + '_' + view + '_' + hand
                animations[name] = display_pose(display[java_view + '_' + java_hand], hand == 'left')
        path = RP / 'attachables' / (item + '.attachable.json')
        doc = json.loads(path.read_text())
        desc = doc['minecraft:attachable']['description']
        renamed = {}
        for alias, name in list(desc['animations'].items()):
            if alias in ('fp_right', 'fp_left', 'tp_right', 'tp_left'):
                desc['animations'][alias] = PREFIX + source + '_' + alias
            elif alias in ('fp_idle_calibrated_right', 'fp_idle_calibrated_left'):
                hand = alias.rsplit('_', 1)[1]
                replacement = 'fp_idle_' + hand
                del desc['animations'][alias]
                desc['animations'][replacement] = PREFIX + source + '_fp_' + hand
                renamed[alias] = replacement
        desc['scripts']['animate'] = [
            {renamed.get(k, k): v for k, v in row.items()} if isinstance(row, dict) else row
            for row in desc['scripts']['animate']]
        result[path] = doc
    result[RP / 'animations/secret_held_display.animation.json'] = {
        'format_version': '1.8.0', 'animations': animations}
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--java-root', type=Path, required=True)
    args = parser.parse_args()
    for path, value in outputs(args.java_root).items():
        path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
        print(path.relative_to(ROOT))
    # Its four consumers now use the Java-derived item-space display above.
    (RP / 'animations/secret_idle_fp_calibration.animation.json').unlink(missing_ok=True)


if __name__ == '__main__':
    main()
