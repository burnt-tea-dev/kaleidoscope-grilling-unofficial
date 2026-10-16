"""Pinned Java motion contracts; static math is not native client acceptance."""
import hashlib
import json
import math
import re
import subprocess
import unittest
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
RP = ROOT / 'projects/grilling/gameplay_core/resource_pack'
BP = ROOT / 'projects/grilling/gameplay_core/behavior_pack'
SOURCE = json.loads((Path(__file__).parent / 'fixtures/java-seasoning-animation-1.1.1.json').read_text())
sys.path.insert(0, str(ROOT / 'tools'))
from bottle_pose_review import historical_bytes


def load(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def evaluate(expression, seconds):
    expression = expression.replace('q.anim_time', str(seconds)).replace('q.life_time', str(seconds))
    return eval(expression, {'__builtins__': {}}, {'math': type('M', (), {
        'sin': staticmethod(lambda x: math.sin(math.radians(x))),
        'cos': staticmethod(lambda x: math.cos(math.radians(x))),
        'clamp': staticmethod(lambda x, a, b: max(a, min(b, x)))})})


class SeasoningAnimationTests(unittest.TestCase):
    def test_pinned_source_blobs_and_timing(self):
        self.assertEqual(SOURCE['commit'], '9a1acdab27698457bec16c9362678e574895a28c')
        for name, row in SOURCE['files'].items():
            data = row['content'].encode()
            self.assertEqual(hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest(), row['blob'], name)
        self.assertIn('DURATION_TICKS = 10;', SOURCE['files']['SeasoningAnimation.java']['content'])
        self.assertIn('return 80;', SOURCE['files']['PendingSeasoningItem.java']['content'])
        self.assertIn('UseAnim.NONE', SOURCE['files']['PendingSeasoningItem.java']['content'])
        fp = SOURCE['files']['SeasoningFirstPersonAnimation.java']['content']
        self.assertIn('event.getHand() != InteractionHand.MAIN_HAND', fp)
        self.assertIn('if (!shaking) pose.mulPose(Axis.ZP.rotationDegrees(180.0F));', fp)

    def test_pending_tp_matches_java_age_formula_and_scope(self):
        poses = load(RP / 'animations/a21_shake.animation.json')['animations']
        for hand, side, arm in [('main', 1, 'rightarm'), ('off', -1, 'leftarm')]:
            pose = poses['animation.kg_a21.player.shake.' + hand]
            self.assertEqual(set(pose['bones']), {arm})
            self.assertEqual(set(pose['bones'][arm]), {'rotation'})
            self.assertTrue(pose['blend_weight'].startswith('!variable.is_first_person && q.is_using_item'))
            for t in [0, .01, .15, 1.7, 3.95]:
                wave, cross = math.sin(t * 20 * 1.7), math.cos(t * 20 * 1.7)
                expected = [-1.35 + wave * .35, side * (.30 + wave * .65), side * (.45 + cross * .55)]
                actual = [evaluate(v, t) for v in pose['bones'][arm]['rotation']]
                for a, b in zip(actual, expected):
                    self.assertAlmostEqual(a, math.degrees(b), places=7)

    def test_sprinkle_tp_ten_ticks_and_no_camera_space_limbs(self):
        poses = load(RP / 'animations/player_binding.animation.json')['animations']
        for hand, side, arm in [('main', 1, 'rightarm'), ('off', -1, 'leftarm')]:
            pose = poses['animation.kg_imm.player.season.' + hand]
            self.assertEqual(pose['animation_length'], .5)
            self.assertEqual(set(pose['bones']), {arm})
            self.assertEqual(set(pose['bones'][arm]), {'rotation'})
            self.assertTrue(pose['blend_weight'].startswith('!variable.is_first_person'))
            for t in [0, .0625, .125, .25, .375, .5]:
                p = t / .5
                wave, arc = math.sin(p * math.tau * 2), math.sin(p * math.pi)
                expected = [-1.75 - .35 * arc + .18 * wave, side * (.35 + .95 * wave), side * (.55 + .55 * arc + .25 * wave)]
                actual = [evaluate(v, t) for v in pose['bones'][arm]['rotation']]
                for a, b in zip(actual, expected):
                    self.assertAlmostEqual(a, math.degrees(b), places=7)

    def test_other_player_animations_and_idle_bottles_unchanged(self):
        relative = 'projects/grilling/gameplay_core/resource_pack/animations/player_binding.animation.json'
        before = json.loads(subprocess.check_output(['git', 'show', '604a91b0:' + relative], cwd=ROOT))['animations']
        after = load(ROOT / relative)['animations']
        changed = {n for n in before if before[n] != after[n]}
        self.assertEqual(changed, {'animation.kg_imm.player.season.main', 'animation.kg_imm.player.season.off'})
        relative = 'projects/grilling/gameplay_core/resource_pack/animations/a286_held.animation.json'
        self.assertEqual(historical_bytes(ROOT / relative), subprocess.check_output(['git', 'show', '604a91b0:' + relative], cwd=ROOT))

    def test_pending_release_and_swap_stop_expression(self):
        script = (BP / 'scripts/main.js').read_text()
        branch = script.split('if(isPendingSeasoningId(id)){const hand=', 1)[1].split('if(id===PLATE_ID)', 1)[0]
        self.assertIn("controller:'kg_seasoning_shake'", branch)
        self.assertIn('!q.is_using_item || !q.is_item_name_any(', branch)
        self.assertIn("'slot.weapon.offhand':'slot.weapon.mainhand'", branch)

    def test_combined_bottle_assets_and_item_definitions_are_preserved(self):
        proxy_pattern = re.compile(r'(partial|pending)_seasoning_f[1-8]')
        for path in sorted((RP / 'attachables').glob('*seasoning*.json')):
            name = path.name.removesuffix('.attachable.json')
            proxy = proxy_pattern.fullmatch(name)
            prior_path = path.with_name(('empty_seasoning_bottle' if proxy.group(1) == 'partial' else 'pending_seasoning')+'.attachable.json') if proxy else path
            relative = prior_path.relative_to(ROOT).as_posix()
            before = json.loads(subprocess.check_output(['git', 'show', '604a91b0:' + relative], cwd=ROOT))['minecraft:attachable']['description']
            if proxy:
                before['identifier'] = 'kaleidoscope_grilling:'+name
            after = load(path)['minecraft:attachable']['description']
            for field in ['identifier', 'geometry', 'textures', 'materials', 'render_controllers']:
                self.assertEqual(after[field], before[field], (path.name, field))
        paths = [RP / 'models/entity/bottle_held_contents.geo.json', RP / 'textures/held/bottle_shell_palette.png']
        paths += list((RP / 'models/entity/a286_hand').glob('*seasoning*.json'))
        paths += list((BP / 'items').glob('*seasoning*.json'))
        for path in paths:
            proxy = proxy_pattern.fullmatch(path.stem) if path.parent == BP / 'items' else None
            prior_path = path.with_name(('empty_seasoning_bottle' if proxy.group(1) == 'partial' else 'pending_seasoning')+'.json') if proxy else path
            before = subprocess.check_output(['git', 'show', '604a91b0:' + prior_path.relative_to(ROOT).as_posix()], cwd=ROOT)
            state = re.fullmatch(r'special_seasoning_r[1-8]_v[0-7]', path.stem)
            if path.name == 'bottle_held_contents.geo.json':
                # G71 reflects only the pending halves through Java-to-Bedrock X.
                expected = json.loads(before)
                for geometry in expected['minecraft:geometry']:
                    for bone in geometry['bones']:
                        if bone['name'].startswith('pending_'):
                            for cube in bone['cubes']:
                                cube['origin'][0] = -cube['origin'][0]-cube['size'][0]
                self.assertEqual(load(path), expected, path)
            elif proxy or state:
                expected = json.loads(before)
                if proxy:
                    expected['minecraft:item']['description'].update(identifier='kaleidoscope_grilling:'+path.stem,menu_category={'category':'none'})
                expected['minecraft:item']['components']['minecraft:icon']['textures']['default'] = path.stem
                self.assertEqual(load(path), expected, path)
            else:
                self.assertEqual(path.read_bytes(), before, path)

    def test_motion_dispatch_is_exclusive_and_owning_entity_safe(self):
        import build_seasoning_held as held
        names = ['pending_seasoning'] + [p.name.removesuffix('.attachable.json')
            for p in sorted((RP / 'attachables').glob('special_seasoning*.json'))]
        for name in names:
            d = load(RP / f'attachables/{name}.attachable.json')['minecraft:attachable']['description']
            for expression in d['scripts']['pre_animation'][-3:]:
                self.assertIn('c.owning_entity->q.has_property', expression)
                self.assertIn('c.owning_entity->q.property', expression)
            for first in [0, 1]:
                for slot, code, hand in [('main_hand', 1, 'right'), ('off_hand', 2, 'left')]:
                    for using in [0, 1]:
                        for phase in [0, 1, 10]:
                            for active in [0, 1, 2]:
                                for pending in [0, 1, 2]:
                                    selected = []
                                    for row in d['scripts']['animate']:
                                        alias, expression = next(iter(row.items()))
                                        replacements = {'c.is_first_person': str(first), 'c.item_slot': repr(slot),
                                            'c.owning_entity->q.is_using_item': str(using),
                                            'v.kg_season_season_hand': str(active), 'v.kg_season_season_phase': str(phase),
                                            'v.kg_season_pending_hand': str(pending)}
                                        for token, value in replacements.items():
                                            expression = expression.replace(token, value)
                                        if eval(expression.replace('&&', ' and '), {'__builtins__': {}}, {}):
                                            selected.append(alias)
                                    expected = ('tp_season_right' if not first and name.startswith('special_seasoning') and hand == 'right' and phase and active == code
                                        else 'tp_' + hand if not first else 'season_' + hand if phase and active == code
                                        else 'shake_' + hand if name == 'pending_seasoning' and using and pending == code else 'fp_' + hand)
                                    self.assertEqual(selected, [expected], (name, first, slot, using, phase, active, pending))
        for path, expected in held.build().items():
            self.assertEqual(load(path), expected, path)

    def test_bound_motion_preserves_idle_anchor_and_is_finite_visible_candidate(self):
        from test_native_bottle_fp import projected, visible
        from held_pose_frames import bone_matrix
        import build_seasoning_held as held
        geometry = load(RP / 'models/entity/bottle_held_contents.geo.json')['minecraft:geometry'][0]
        idle = load(RP / 'animations/a286_held.animation.json')['animations']
        for hand in ['right', 'left']:
            seed = idle['animation.kg_a286.bottle_fp_' + hand]['bones']['grip']
            initial = held.motion(hand, 0, True)
            for first, second in zip(bone_matrix(seed), bone_matrix(initial)):
                for a, b in zip(first, second):
                    self.assertAlmostEqual(a, b, places=7)
            for shaking in [False, True]:
                duration = 2 * math.pi / 1.8 / 20 if shaking else .5
                for i in range(101):
                    pose = held.motion(hand, duration * i / 100, shaking)
                    self.assertTrue(all(math.isfinite(v) for values in pose.values() for v in values))
                    self.assertTrue(visible(projected(geometry, {'bones': {'grip': pose}}, hand)), (hand, shaking, i))


if __name__ == '__main__':
    unittest.main()
