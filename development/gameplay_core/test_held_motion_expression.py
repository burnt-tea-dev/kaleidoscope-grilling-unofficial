"""Exact selector evaluator coverage; API/source checks do not accept a client."""
import itertools
import json
import unittest

from verify_a287 import RP, expression


class HeldMotionExpression(unittest.TestCase):
    def evaluate(self, source, **kwargs):
        return expression(source, 1, 'main_hand', 'rightitem', **kwargs)

    def test_exact_owning_player_use_query(self):
        source = 'c.owning_entity->q.is_using_item'
        self.assertFalse(self.evaluate(source))
        self.assertTrue(self.evaluate(source, using=True))

    def test_exact_projection_property_and_scoped_fallback(self):
        source = "q.has_property('kaleidoscope_grilling:eat_projection')"
        self.assertTrue(self.evaluate(source))
        self.assertFalse(self.evaluate(source, has_projection=False))
        with self.assertRaises(AssertionError):
            self.evaluate("q.has_property('kaleidoscope_grilling:unknown')")
        description = json.loads((RP / 'attachables/grilled_caterpillar_skewer.attachable.json').read_text())['minecraft:attachable']['description']
        for state, expected in (({}, ['probe_one_right']),
                                ({'has_projection': False}, ['fp_right', 'eat_right']),
                                ({'offhand': 1}, ['fp_right', 'eat_right'])):
            selected = [key for row in description['scripts']['animate'] for key, query in row.items()
                        if self.evaluate(query, using=True, eat_profile=1, **state)]
            self.assertEqual(selected, expected)

    def test_legacy_use_query_and_default_inactive_motion(self):
        self.assertTrue(self.evaluate('q.is_using_item', using=True))
        self.assertFalse(self.evaluate('q.is_using_item'))
        for name in ('season_hand', 'season_phase', 'pending_hand'):
            self.assertTrue(self.evaluate('v.kg_season_' + name + ' == 0'))

    def test_explicit_known_motion_inputs(self):
        self.assertTrue(self.evaluate('v.kg_season_season_hand == 1 && v.kg_season_season_phase != 0',
                                      season_hand=1, season_phase=10))
        self.assertTrue(self.evaluate('c.owning_entity->q.is_using_item && v.kg_season_pending_hand == 2',
                                      using=True, pending_hand=2))

    def test_unknown_owner_contexts_remain_rejected(self):
        for source in ('context.owning_entity->q.is_using_item',
                       'c.other_entity->q.is_using_item',
                       'c.owning_entity->q.is_sleeping',
                       'c.owning_entity->q.property(\'unknown\')'):
            with self.subTest(source=source), self.assertRaises((AssertionError, SyntaxError)):
                self.evaluate(source)

    def test_unknown_or_similar_variables_remain_rejected(self):
        for source in ('v.kg_season_unknown == 0', 'v.kg_season_season_hand_extra == 0',
                       'variable.kg_season_season_hand == 0', 'other.v.kg_season_season_hand == 0'):
            with self.subTest(source=source), self.assertRaises((AssertionError, SyntaxError)):
                self.evaluate(source)

    def test_unsupported_ast_nodes_remain_rejected(self):
        for source in ('1 + 1 == 2', 'not False', '__import__(\'os\')', '[1][0] == 1',
                       'v.kg_season_season_phase > 0', '(lambda: True)()'):
            with self.subTest(source=source), self.assertRaises((AssertionError, SyntaxError)):
                self.evaluate(source)

    def test_motion_inputs_reject_out_of_domain_values(self):
        for name, values in (('season_hand', (-1, 3, 1.0, True)),
                             ('pending_hand', (-1, 3, 1.0, True)),
                             ('season_phase', (-1, 11, 1.0, True))):
            for value in values:
                with self.subTest(name=name, value=value), self.assertRaises(AssertionError):
                    self.evaluate('1 == 1', **{name: value})

    def test_all_owned_bottle_routes_select_exactly_one_active_pose(self):
        paths = [RP / 'attachables/pending_seasoning.attachable.json']
        paths += sorted((RP / 'attachables').glob('special_seasoning*.json'))
        self.assertEqual(len(paths), 66)
        for path in paths:
            description = json.loads(path.read_text())['minecraft:attachable']['description']
            pending = description['identifier'].endswith(':pending_seasoning')
            for first, hand_row, using, season_hand, season_phase, pending_hand in itertools.product(
                    (0, 1), (('main_hand', 'right', 1), ('off_hand', 'left', 2)),
                    (False, True), (0, 1, 2), (0, 1, 10), (0, 1, 2)):
                slot, hand, code = hand_row
                selected = [key for row in description['scripts']['animate'] for key, source in row.items()
                            if expression(source, first, slot, hand + 'item', using=using,
                                          season_hand=season_hand, season_phase=season_phase,
                                          pending_hand=pending_hand)]
                expected = ('tp_' + hand if not first else
                            'season_' + hand if season_hand == code and season_phase else
                            'shake_' + hand if pending and using and pending_hand == code else
                            'fp_' + hand)
                self.assertEqual(selected, [expected], (path.name, first, slot, using,
                                                       season_hand, season_phase, pending_hand))


if __name__ == '__main__':
    unittest.main()
