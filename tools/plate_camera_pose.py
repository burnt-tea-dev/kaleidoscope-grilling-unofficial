"""Fit complete held plates using the published bound-bone camera model.

Reference: Dofes/blockbench-bedrock-attachable@0dbcc4919b2152f81606a7a1bb4e11b292e0ceac,
Apache-2.0, Copyright 2026 Dofes; RENDER and buildHolderBoneMatrices.
Bedrock Wiki's method-two guide independently documents the arm transform.
This is a geometric preview, never a rendered-client acceptance result.
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
                            def convert(p): return [-p[0], 24 - p[1], p[2]]
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


def fitted(document):
    result = json.loads(json.dumps(document))
    points = local_points(document)
    tangent = math.tan(math.radians(HAND_FOV / 2))
    # Reserve the center for aiming and the bottom for the HUD. Use 4:3 for
    # horizontal fitting, which also covers dot's 1180x792 and 16:9 viewports.
    for step in range(36, 161):
        depth = step / 2
        valid = True
        for hand, sign in [('right', 1), ('left', -1)]:
            pose = result['animations']['animation.kg_plate_held.fp_' + hand]['bones']['plate_pose']
            target = [-sign * .45 * tangent * (4 / 3) * depth, EYE - .25 * tangent * depth, depth]
            q = [-target[0] / SCALE, Y_SHIFT - target[1] / SCALE, target[2] / SCALE]
            arm, origin, item = holder(hand)
            inverse = [list(row) for row in zip(*arm)]
            local = transform(inverse, [q[i] - origin[i] for i in range(3)])
            local = [local[i] - item[i] for i in range(3)]
            pose['position'] = [round(local[0], 8), round(-local[1], 8), round(local[2], 8)]
            for x, y, z in project(points, pose, hand):
                valid &= z > .4 and .08 * tangent * (4 / 3) <= sign * x <= .9 * tangent * (4 / 3) and -.65 * tangent <= y <= .25 * tangent
        if valid:
            return result, {'scope': 'published-camera geometric preview; real client pending', 'depth': depth, 'points': len(points)}
    raise ValueError('Complete plate catalog cannot fit the reserved hand regions')


def generate(check=False):
    original = json.loads(POSE.read_text())
    result, report = fitted(original)
    if result != original:
        if check:
            raise ValueError('Plate camera poses need regeneration')
        POSE.write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    print(json.dumps(generate(parser.parse_args().check)))
