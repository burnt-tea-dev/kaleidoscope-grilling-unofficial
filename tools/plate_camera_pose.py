"""Read-only held-geometry projection diagnostics, not a Java pose generator.

Coordinates follow Blockbench 5.2.2 Bedrock import and Animate mode. The
community holder/camera model remains unvalidated against native hold-outs.
A screen-bounds fit is neither a Java display transform nor engine acceptance.
See docs/REBUILD-PLAN.md for source identities and limitations.

Reference: Dofes/blockbench-bedrock-attachable@0dbcc4919b2152f81606a7a1bb4e11b292e0ceac,
Apache-2.0, Copyright 2026 Dofes; RENDER and buildHolderBoneMatrices.
Bedrock Wiki's method-two guide independently documents the arm transform.
"""
import argparse
import itertools
import json
import math
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
RP = ROOT / 'projects/grilling/gameplay_core/resource_pack'
POSE = RP / 'animations/plate_held.animation.json'
SCALE = .9375
EYE = 1.62001 * 16
Y_SHIFT = 24.125
HAND_FOV = 70


def multiply(a, b):
    return [[sum(a[i][k] * b[k][j] for k in range(3)) for j in range(3)] for i in range(3)]


def transform(matrix, vector):
    return [sum(row[k] * vector[k] for k in range(3)) for row in matrix]


def rotation(degrees):
    x, y, z = map(math.radians, degrees)
    cx, sx, cy, sy, cz, sz = math.cos(x), math.sin(x), math.cos(y), math.sin(y), math.cos(z), math.sin(z)
    return multiply(multiply([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]],
                             [[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]]),
                    [[1, 0, 0], [0, cx, -sx], [0, sx, cx]])


def layout_value(value, count):
    if isinstance(value, (int, float)):
        return value
    # The layout producer emits only this finite integer-count selector.
    pattern = r'v\.kg_plate_count == (\d) \? (-?[\d.]+) : '
    entries = re.findall(pattern, value)
    terminal = re.sub(pattern, '', value)
    if not entries or not re.fullmatch(r'-?[\d.]+', terminal):
        raise ValueError('Unexpected plate layout expression: ' + value)
    return float(dict(entries).get(str(count), terminal))


def local_points(document):
    layout = document['animations']['animation.kg_plate_held.layout']['bones']
    points = []
    for path in sorted((RP / 'models/entity').glob('plate_held*.geo.json')):
        for model in json.loads(path.read_text())['minecraft:geometry']:
            bones = {bone['name']: bone for bone in model['bones']}
            for bone in bones.values():
                if not bone.get('cubes'):
                    continue
                slot = next((int(n) for n in re.findall(r'(?:slot|fixed|row)_(\d)', bone['name'])), None)
                for count in range(0, 6):
                    if slot is not None and slot >= count:
                        continue
                    for cube in bone['cubes']:
                        inflate = cube.get('inflate', 0)
                        ranges = [(a - inflate, a + size + inflate) for a, size in zip(cube['origin'], cube['size'])]
                        for corner in itertools.product(*ranges):
                            # Work in the same bone coordinates as the public
                            # preview, relative to the bound pivot [0,24,0].
                            def convert(p): return raw_bound_point(p)
                            point = convert(corner)
                            if cube.get('rotation'):
                                pivot = convert(cube.get('pivot', [0, 0, 0]))
                                point = [a + b for a, b in zip(pivot, transform(rotation(cube['rotation']), [a - b for a, b in zip(point, pivot)]))]
                            current = bone
                            while current['name'] not in ('grip', 'plate_pose'):
                                pose = layout.get(current['name'], {})
                                pivot = convert(current.get('pivot', [0, 24, 0]))
                                scale = pose.get('scale', 1)
                                scale = [scale] * 3 if isinstance(scale, (int, float)) else scale
                                angles = [layout_value(v, count) + current.get('rotation', [0, 0, 0])[i] for i, v in enumerate(pose.get('rotation', [0, 0, 0]))]
                                point = transform(rotation(angles), [(point[i] - pivot[i]) * scale[i] for i in range(3)])
                                position = [layout_value(v, count) for v in pose.get('position', [0, 0, 0])]
                                point = [point[i] + pivot[i] + [position[0], -position[1], position[2]][i] for i in range(3)]
                                current = bones[current['parent']]
                            points.append(point)
    # Fit a conservative box containing every count, palette and shape. No
    # ingredient, slot, geometry or authored scale is removed to obtain a fit.
    bounds = [(min(p[i] for p in points), max(p[i] for p in points)) for i in range(3)]
    return list(itertools.product(*bounds))


def holder(hand):
    return (rotation([95, -45, 115]), [8.5, 12, 12], [-1, 7, 0]) if hand == 'right' else (rotation([0, 0, 0]), [6, 9, 0], [0, 0, 0])


def project(points, pose, hand):
    arm, origin, item = holder(hand)
    output = []
    for point in points:
        point = transform(rotation(pose['rotation']), [point[i] * pose['scale'][i] for i in range(3)])
        position = pose['position']
        point = transform(arm, [point[i] + item[i] + [position[0], -position[1], position[2]][i] for i in range(3)])
        point = [point[i] + origin[i] for i in range(3)]
        world = [-SCALE * point[0], SCALE * (Y_SHIFT - point[1]) - EYE, SCALE * point[2]]
        output.append([-world[0] / world[2], world[1] / world[2], world[2]])
    return output


def raw_bound_point(point, pivot=(0, 24, 0)):
    """Raw .geo vertex after BB import and the preview's root conversion.

    BB import mirrors X; the preview subsequently mirrors X/Y. Composing
    both gives (+X, -Y, +Z), NOT the old raw-direct (-X, -Y, +Z).
    """
    return [point[0] - pivot[0], pivot[1] - point[1], point[2] - pivot[2]]


def bound_binding_offset(pivot):
    """Expression-binding offset in the community Animate preview only."""
    return [pivot[0], 24 - pivot[1], pivot[2]]


def project_raw_bound_point(point, pivot, pose, hand):
    """Replay a single bound root; output is proxy x/z, y/z, depth."""
    local = raw_bound_point(point, pivot)
    offset = bound_binding_offset(pivot)
    adjusted = dict(pose)
    position = pose['position']
    adjusted['position'] = [position[0] + offset[0], position[1] - offset[1], position[2] + offset[2]]
    return project([local], adjusted, hand)[0]


def diagnose(document=None, full_catalog=False):
    document = document if document is not None else json.loads(POSE.read_text())
    points = local_points(document) if full_catalog else list(itertools.product([-7, 7], [-2, 0], [-7, 7]))
    return {
        'mode': 'READ_ONLY_DIAGNOSTIC',
        'geometry_scope': 'full-catalog-conservative-box' if full_catalog else 'plate-body-only; excludes contents',
        'coordinate_contract': 'raw-geo-to-BB-5.2.2-Animate-v2',
        'native_acceptance': False,
        'java_equivalence': False,
        'asset_write_permitted': False,
        'scope': 'community holder/camera proxy; native shield hold-out not passed',
        'hands': {hand: project(points, document['animations']['animation.kg_plate_held.fp_' + hand]['bones']['plate_pose'], hand) for hand in ('right', 'left')},
    }


def fitted(document):
    raise RuntimeError('BBox pose generation retired: use diagnose(); Java/engine calibration is required before any new pose asset.')


def generate(check=False):
    raise RuntimeError('Pose writing/regeneration checks retired: use diagnose(); this tool must not rewrite runtime assets.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--diagnose', action='store_true', help='read-only diagnostics (default)')
    parser.add_argument('--full-catalog', action='store_true', help='slow conservative catalog diagnostic; still no acceptance or asset writes')
    parser.add_argument('--check', action='store_true', help='retired regeneration check; exits with an explicit error')
    args = parser.parse_args()
    if args.check:
        parser.error('--check regeneration contract is retired; use --diagnose. No asset was changed.')
    print(json.dumps(diagnose(full_catalog=args.full_catalog)))
