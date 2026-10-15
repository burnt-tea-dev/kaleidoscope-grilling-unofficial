"""Scoped third-person fallback; mathematical/source checks, not client proof."""
from pathlib import Path
import json
import unittest
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'tools'))
import build_tp_java_item_fallback as tp_item

ROOT = Path(__file__).resolve().parents[2]
RP = ROOT / 'projects/grilling/gameplay_core/resource_pack'
BP = ROOT / 'projects/grilling/gameplay_core/behavior_pack'
SOURCE = json.loads((Path(__file__).parent / 'fixtures/native-third-person-eating.source.json').read_text())


class EatingArms(unittest.TestCase):
    def test_only_the_selected_arm_rotation_can_change(self):
        animations = tp_item.transform(json.loads((RP / 'animations/eating_arms.animation.json').read_text()),inverse=True)['animations']
        self.assertEqual(set(animations), {'animation.kg_eating.player.native_right',
                                          'animation.kg_eating.player.native_left'})
        for hand, sign in [('right', 1), ('left', -1)]:
            animation = animations['animation.kg_eating.player.native_' + hand]
            self.assertFalse(animation.get('override_previous_animation', False))
            self.assertEqual(list(animation['bones']), [hand + 'arm'])
            bone = animation['bones'][hand + 'arm']
            self.assertEqual(set(bone), {'rotation'})
            native = SOURCE['native_startup_rotation']
            self.assertEqual(bone['rotation'], [native[0], native[1]*sign, native[2]*sign])

    def test_native_progress_and_first_person_keep_control(self):
        animations = tp_item.transform(json.loads((RP / 'animations/eating_arms.animation.json').read_text()),inverse=True)['animations']
        expected = ('!variable.is_first_person && query.is_using_item && '
                    'variable.use_item_startup_progress <= 0.0 && variable.use_item_interval_progress <= 0.0')
        for animation in animations.values():
            self.assertEqual(animation['blend_weight'], expected)
        # These are the four independent guards on the fallback's activation.
        for first_person, using, startup, interval, enabled in [
            (True, True, 0, 0, False), (False, False, 0, 0, False),
            (False, True, .5, 0, False), (False, True, 0, .5, False),
            (False, True, 0, 0, True)]:
            self.assertEqual(not first_person and using and startup<=0 and interval<=0, enabled)

    def test_playback_is_event_scoped_and_cancels_on_item_change(self):
        code = (BP / 'scripts/main.js').read_text()
        start = code.split('world.afterEvents.itemStartUse.subscribe', 1)[1].split('world.afterEvents.itemCompleteUse.subscribe', 1)[0]
        self.assertIn('if(id.endsWith("_skewer"))', start)
        self.assertIn("slot.weapon.offhand", start)
        self.assertIn("slot.weapon.mainhand", start)
        self.assertIn("stopExpression:", start)
        self.assertIn("!q.is_using_item || !q.is_item_name_any", start)
        self.assertEqual(code.count("playAnimation('animation.kg_eating.player.native_"), 1)
        self.assertNotIn("playAnimation('animation.kg_imm.player.eat", code)
        self.assertFalse((RP / 'entity/player.entity.json').exists())


if __name__ == '__main__':
    unittest.main()
