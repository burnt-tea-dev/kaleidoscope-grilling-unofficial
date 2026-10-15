"""Public repaired-source conservation; native mouth/transition acceptance is separate."""
from copy import deepcopy
import json
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[2]
RP = ROOT / 'projects/grilling/gameplay_core/resource_pack'
BP = ROOT / 'projects/grilling/gameplay_core/behavior_pack'
sys.path.insert(0, str(ROOT / 'tools'))
import secret_idle_calibration as calibration
from public_source_witness import assert_public_bytes_with_g71_bottles as assert_public_bytes, public_json
from test_eating_observer_projection import node
from eating_owner_context import document,legacy_document
from secret_terminal_visibility import apply as terminal_continuation


def load(path):
    return json.loads(path.read_text())


class SecretIdleCalibration(unittest.TestCase):
    def test_exact_calibration_preserves_source_rotation_scale_and_shared_files(self):
        current = load(calibration.TARGET)
        self.assertEqual(current, calibration.animation_document())
        assert_public_bytes(self, calibration.TARGET)
        shared_path = RP / 'animations/a287_skewer_held.animation.json'
        assert_public_bytes(self, shared_path)
        source = public_json(shared_path)['animations']
        expected_positions = {
            'right': [-8.44353417, .51001839, -8.65064748],
            'left': [-11.88255811, 10.91077069, 10.76686643],
        }
        for hand in ('right', 'left'):
            clip = deepcopy(current['animations'][calibration.clip_id(hand)])
            self.assertEqual(clip['bones']['skewer_pose']['position'], expected_positions[hand])
            clip['bones']['skewer_pose']['position'] = source['animation.kg_a287.skewer_fp_' + hand]['bones']['skewer_pose']['position']
            self.assertEqual(clip, source['animation.kg_a287.skewer_fp_' + hand])

    def test_exact_three_owned_attachables_keep_idempotent_idle_aliases(self):
        self.assertEqual(set(calibration.OWNED), {
            'kaleidoscope_grilling:secret_skewer',
            'kaleidoscope_grilling:secret_skewer_java_three_alt',
            'kaleidoscope_grilling:unfinished_skewer',
        })
        for identifier in calibration.OWNED:
            path = RP / 'attachables' / (identifier.split(':')[1] + '.attachable.json')
            assert_public_bytes(self, path)
            actual = load(path)['minecraft:attachable']['description']
            # The public witness already contains the repair. Re-running the
            # current generator must conserve it, not apply a historical delta.
            once = document(terminal_continuation(calibration.apply_idle_calibration(legacy_document(deepcopy(actual)))),attachable=True)
            self.assertEqual(once, actual)
            self.assertEqual(document(terminal_continuation(calibration.apply_idle_calibration(legacy_document(deepcopy(once)))),attachable=True), actual)
            self.assertEqual({key for key in actual['animations'] if key.startswith('fp_idle_calibrated_')},
                             {'fp_idle_calibrated_right', 'fp_idle_calibrated_left'})
            for hand in ('right', 'left'):
                alias = 'fp_idle_calibrated_' + hand
                self.assertEqual(actual['animations'][alias], calibration.clip_id(hand))
                self.assertEqual(sum(alias in row for row in actual['scripts']['animate']), 1)
        for path in (RP / 'attachables').glob('*.json'):
            description = load(path)['minecraft:attachable']['description']
            if description['identifier'] not in calibration.OWNED:
                self.assertNotIn('fp_idle_calibrated_', json.dumps(description))
                self.assertEqual(calibration.apply_idle_calibration(deepcopy(description)), description)

    def test_reviewed_owned_runtime_and_active_helper_source_bytes_are_conserved(self):
        # Check relevant immutable runtime bytes directly. Release metadata and
        # guide updates are outside this repaired-source conservation guard.
        for path in (
            BP / 'scripts/main.js',
            BP / 'scripts/secret_held_runtime.js',
            RP / 'animations/java_eating_player.animation.json',
            RP / 'animations/java_eating_projection.animation.json',
        ):
            assert_public_bytes(self, path)

    def test_idle_active_helper_and_third_person_have_independent_admission_guards(self):
        descriptions = [load(RP / 'attachables' / (identifier.split(':')[1] + '.attachable.json'))['minecraft:attachable']['description']
                        for identifier in calibration.OWNED]
        node('const descriptions = ' + json.dumps(descriptions) + r''';
for (const d of descriptions) {
 const complete = !d.identifier.endsWith(':unfinished_skewer');
 const ownProfile = d.identifier.endsWith('_java_three_alt') ? 4 : 3;
 const routes = Object.fromEntries(d.scripts.animate.flatMap(row => Object.entries(row)).map(([alias, expression]) =>
  [alias, new Function('q', 'c', 'return ' + expression.replaceAll('c.owning_entity->q.','c.owning_entity.'))]));
 for (const hand of ['right', 'left']) for (const itemSlot of ['main_hand', 'off_hand'])
 for (const first of [0, 1]) for (const using of [false, true]) for (const eatHand of [0, 1, 2])
 for (const projection of [0, 1]) for (const profile of [3, 4]) for (const held of [d.identifier, 'minecraft:apple'])
 for (const oppositeEquipped of [0, 1]) for (const posture of ['', 'sneaking', 'swimming', 'gliding', 'riding']) {
  const slot = hand === 'right' ? 'main_hand' : 'off_hand';
  const weapon = hand === 'right' ? 'slot.weapon.mainhand' : 'slot.weapon.offhand';
  const handCode = hand === 'right' ? 1 : 2;
  const q = {is_using_item: using, is_sneaking: posture === 'sneaking', is_swimming: posture === 'swimming',
   is_gliding: posture === 'gliding', is_riding: posture === 'riding', is_item_equipped: () => oppositeEquipped,
   property: name => ({eat_hand: eatHand, eat_profile: profile, eat_projection: projection})[name.split(':')[1]],
   is_item_name_any: (selected, ...ids) => selected === weapon && ids.includes(held)};
  const c = {is_first_person: first, item_slot: itemSlot, owning_entity: q};
  const active = alias => routes[alias] ? Boolean(routes[alias](q, c)) : false;
  const fpSlot = Boolean(first && itemSlot === slot);
  const ownUsing = using && eatHand === handCode;
  const projected = Boolean(complete && fpSlot && ownUsing && projection === 1 && profile === ownProfile &&
   held === d.identifier && oppositeEquipped === 0 && posture === '');
  const expected = {
   ['fp_idle_calibrated_' + hand]: fpSlot && !ownUsing,
   ['fp_' + hand]: fpSlot && ownUsing && !projected,
   ['fp_eat_' + hand]: projected,
   ['eat_' + hand]: complete && fpSlot && ownUsing && profile !== 4 && !projected,
   ['eat_alt_' + hand]: complete && fpSlot && ownUsing && profile === 4 && !projected,
   ['tp_' + hand]: !first && itemSlot === slot,
  };
  for (const [alias, admitted] of Object.entries(expected))
   if (active(alias) !== admitted) throw Error('Wrong independent admission: ' + d.identifier + ' ' + alias);
  if (active('fp_idle_calibrated_' + hand) && active('fp_' + hand)) throw Error('Idle drew both bases');
 }
}
''')


if __name__ == '__main__':
    unittest.main()
