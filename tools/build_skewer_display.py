"""Generate threaded-skewer item-space poses from the original Java display.

The Java display frame and Bedrock item-slot binding frame are different.
Threaded skewers use the same Java display and mesh conversion as the existing
native skewer poses. Reuse that shared owner rather than applying Java display
in the wrong coordinate system. No geometry, camera fit or engine offset changes.
"""
import argparse
import json
import copy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RP = ROOT / 'projects/grilling/gameplay_core/resource_pack'
ITEMS = ('unfinished_skewer', 'secret_skewer', 'secret_skewer_native_plain',
         'secret_skewer_java_three_alt')
PREFIX = 'animation.kg_secret_held.display_'


def display_pose(display, reference_display, native_pose):
    """Reuse the native frame shared by fixed and threaded Java skewers.

    The referenced Java model has the same display transform and the same
    converted mesh coordinates. Java display is not a Bedrock binding-local
    transform: the holder basis and origin must also be accounted for. The
    existing native skewer poses already own that conversion for each hand.
    Do not apply Java display a second time or recenter its mesh again.
    """
    if display != reference_display:
        raise ValueError('Java skewer display changed; derive and preview its native holder frame')
    return copy.deepcopy(native_pose)


def outputs(java_root):
    models = java_root / 'common/src/main/resources/assets/kaleidoscope_grilling/models/item'
    frames = json.loads((ROOT / 'data/java/model_frames.json').read_text())['models']
    reference = frames['common/src/main/resources/assets/kaleidoscope_grilling/models/item/secret_skewer.json']['data']['display']
    native = json.loads((RP / 'animations/a287_skewer_held.animation.json').read_text())['animations']
    animations = {}
    result = {}
    for item in ITEMS:
        source = 'unfinished_skewer' if item == 'unfinished_skewer' else 'secret_skewer'
        display = json.loads((models / (source + '.json')).read_text())['display']
        for view, java_view in [('fp', 'firstperson'), ('tp', 'thirdperson')]:
            for hand, java_hand in [('right', 'righthand'), ('left', 'lefthand')]:
                name = PREFIX + source + '_' + view + '_' + hand
                animations[name] = display_pose(
                    display[java_view + '_' + java_hand],
                    reference[java_view + '_' + java_hand],
                    native['animation.kg_a287.skewer_' + view + '_' + hand])
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
    # Its four consumers use the shared native skewer frame above.
    (RP / 'animations/secret_idle_fp_calibration.animation.json').unlink(missing_ok=True)


if __name__ == '__main__':
    main()
