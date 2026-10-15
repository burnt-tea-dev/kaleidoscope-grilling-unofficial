"""Source-level Java/Bedrock shape contracts; not a native physics or visual test.

Oracle: breezeth-CN/KaleidoscopeGrilling @
9a1acdab27698457bec16c9362678e574895a28c, in both forge-1.20.1 and
neoforge-1.21.1: grill/GrillBlock.java and rack/AdvancedRackBlock.java.
Java boxes use 0..16; Bedrock X/Z origins are centered at 0. The grill
LEGS_* additions are entirely contained by FLAT_*, so their unions are
exactly the FLAT_* rectangle. No mesh-bounds approximation is used.
"""
from __future__ import annotations

import argparse
import itertools
import json
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[2]
BLOCKS = ROOT / 'projects/grilling/gameplay_core/behavior_pack/blocks'
FACING = 'minecraft:cardinal_direction'
KINDS = ('minecraft:collision_box', 'minecraft:selection_box')
# Explicit, independent Java source values in (minX,minY,minZ,maxX,maxY,maxZ).
GRILL = {
    'north': (0, 0, 2, 16, 4, 14), 'south': (0, 0, 2, 16, 4, 14),
    'east': (2, 0, 0, 14, 4, 16), 'west': (2, 0, 0, 14, 4, 16),
}
RACK = {
    'north': (1, 5, 11, 15, 14, 16), 'south': (1, 5, 0, 15, 14, 5),
    'east': (0, 5, 1, 5, 14, 15), 'west': (11, 5, 1, 16, 14, 15),
}
ATOM = re.compile(r"(?:q|query)\.block_state\('([^']+)'\)\s*==\s*('[^']*'|true|false|-?\d+)")


def load(name: str) -> dict:
    return json.loads((BLOCKS / name).read_text(encoding='utf-8-sig'))['minecraft:block']


def matches(condition: str, states: dict) -> bool:
    """Only the equality/conjunction grammar used here; unknown syntax fails."""
    results = []
    for text in condition.split('&&'):
        match = ATOM.fullmatch(text.strip())
        if not match:
            raise ValueError('Unsupported permutation condition: ' + condition)
        key, literal = match.groups()
        value = literal[1:-1] if literal.startswith("'") else json.loads(literal)
        results.append(states[key] == value)
    return all(results)


def components(block: dict, states: dict) -> dict:
    result = dict(block['components'])
    for permutation in block.get('permutations', []):
        if matches(permutation['condition'], states):
            result.update(permutation['components'])
    return result


def states_for(block: dict):
    declared = dict(block['description'].get('states', {}))
    declared[FACING] = list(GRILL)
    for values in itertools.product(*declared.values()):
        yield dict(zip(declared, values))


def rotate(point: tuple, degrees: int) -> tuple:
    x, y, z = point
    for _ in range((degrees % 360) // 90):
        x, z = z, -x
    return x, y, z


def resolved_box(comp: dict, kind: str) -> tuple:
    box = comp[kind]
    if not isinstance(box, dict):
        raise ValueError('Expected explicit reviewed box: ' + kind)
    origin, size = box['origin'], box['size']
    if len(origin) != 3 or len(size) != 3 or any(v <= 0 for v in size):
        raise ValueError('Invalid box')
    transform = comp.get('minecraft:transformation', {})
    for key, default in (('translation', [0, 0, 0]), ('scale', [1, 1, 1]),
                         ('rotation_pivot', [0, 0, 0]), ('scale_pivot', [0, 0, 0])):
        if transform.get(key, default) != default:
            raise ValueError('Unreviewed transform: ' + key)
    rotation = transform.get('rotation', [0, 0, 0])
    if len(rotation) != 3 or rotation[0] or rotation[2] or rotation[1] % 90:
        raise ValueError('Expected a cardinal Y rotation')
    corners = [rotate(p, rotation[1]) for p in itertools.product(
        *((origin[i], origin[i] + size[i]) for i in range(3)))]
    return tuple(min(p[i] for p in corners) for i in range(3)) + tuple(
        max(p[i] for p in corners) for i in range(3))


def centered(java: tuple) -> tuple:
    return tuple(v - (8 if i % 3 != 1 else 0) for i, v in enumerate(java))


def segment_hits(box: tuple, start: tuple, end: tuple) -> bool:
    """Slab intersection for a finite segment; source math, not engine input."""
    lo, hi = 0.0, 1.0
    for i in range(3):
        delta = end[i] - start[i]
        if delta == 0:
            if not box[i] <= start[i] <= box[i + 3]:
                return False
        else:
            a, b = sorted(((box[i] - start[i]) / delta,
                           (box[i + 3] - start[i]) / delta))
            lo, hi = max(lo, a), min(hi, b)
            if lo > hi:
                return False
    return True


class VisibleBlockShapes(unittest.TestCase):
    def check_states(self, name: str, oracle: dict, expected_count: int):
        block = load(name)
        failures = []
        count = 0
        for states in states_for(block):
            count += 1
            comp = components(block, states)
            for kind in KINDS:
                actual = resolved_box(comp, kind)
                expected = centered(oracle[states[FACING]])
                if actual != expected:
                    failures.append((states, kind, actual, expected))
        self.assertEqual(count, expected_count, 'State inventory changed; review coverage')
        self.assertEqual(len(failures), 0, f'{len(failures)} mismatches; first: {failures[:2]}')

    def test_grill_both_boxes_all_facing_lit_and_legged_states(self):
        self.check_states('grill.json', GRILL, 16)

    def test_rack_both_boxes_all_facing_spice_and_occupancy_states(self):
        self.check_states('advanced_rack_block.json', RACK, 640)

    def test_grill_space_above_four_is_not_a_phantom_hit(self):
        block = load('grill.json')
        states = next(s for s in states_for(block) if s[FACING] == 'north')
        comp = components(block, states)
        for kind in KINDS:
            with self.subTest(kind=kind):
                box = resolved_box(comp, kind)
                self.assertFalse(segment_hits(box, (-12, 5, 0), (12, 5, 0)))
                self.assertTrue(segment_hits(box, (-12, 2, 0), (12, 2, 0)))

    def test_rack_empty_front_is_clear_and_rear_strip_is_targetable(self):
        block = load('advanced_rack_block.json')
        for facing, angle in (('north', 0), ('west', 90), ('south', 180), ('east', 270)):
            states = next(s for s in states_for(block) if s[FACING] == facing)
            comp = components(block, states)
            for kind in KINDS:
                with self.subTest(facing=facing, kind=kind):
                    box = resolved_box(comp, kind)
                    self.assertFalse(segment_hits(box, rotate((-12, 9, -4), angle), rotate((12, 9, -4), angle)))
                    self.assertTrue(segment_hits(box, rotate((-12, 9, 7.5), angle), rotate((12, 9, 7.5), angle)))

    def test_plate_selection_keeps_java_seven_not_mesh_height(self):
        # Selection only: do not infer collision from getShape or visual mesh.
        block = load('skewer_plate_block.json')
        for states in states_for(block):
            self.assertEqual(resolved_box(components(block, states), KINDS[1]),
                             centered((1, 0, 1, 15, 7, 15)))

    def test_unreviewed_condition_or_transform_is_rejected(self):
        with self.assertRaises(ValueError):
            matches('q.is_sneaking', {})
        with self.assertRaises(ValueError):
            resolved_box({KINDS[0]: {'origin': [0, 0, 0], 'size': [1, 1, 1]},
                          'minecraft:transformation': {'scale': [2, 1, 1]}}, KINDS[0])


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--blocks-dir', type=Path, default=BLOCKS)
    args, remaining = parser.parse_known_args()
    BLOCKS = args.blocks_dir
    unittest.main(argv=[__file__, *remaining], verbosity=2)
