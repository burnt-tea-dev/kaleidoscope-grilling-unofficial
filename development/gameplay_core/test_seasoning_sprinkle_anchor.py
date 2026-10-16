"""Narrow source/math gate after native G64 clipping; candidate is unaccepted."""
import json
import re
import math
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools'))
sys.path.insert(0, str(ROOT / 'development/gameplay_core'))
import build_seasoning_held as held
from a2861_bottle_held_visual_assets import update_numeric_scripts
from held_visual_channels import WORD_A_MAX, WORD_B_MAX, channel_name
from bottle_pose_review import historical_pose, historical_bytes
from test_native_bottle_fp import projected

def admit_shared_bottle_owner(description):
    # Replace only the historical contiguous nine-row numeric block, keeping
    # every unrelated script row and its position byte-for-byte equivalent.
    previous={phase:list(description['scripts'][phase]) for phase in ('initialize','pre_animation')}
    update_numeric_scripts(description)
    for phase,rows in previous.items():
        owned=[i for i,row in enumerate(rows) if row.startswith('v.kg_bottle_')]
        assert len(owned)==9 and owned==list(range(owned[0],owned[-1]+1)),phase
        numeric=[row for row in description['scripts'][phase] if row.startswith('v.kg_bottle_')]
        assert len(numeric)==10,phase
        description['scripts'][phase]=rows[:owned[0]]+numeric+rows[owned[-1]+1:]


class SprinkleAnchor(unittest.TestCase):
    def test_only_main_sprinkle_positions_change_and_pending_remains_exact(self):
        path = held.RP / 'animations/seasoning_held.animation.json'
        before = json.loads(subprocess.check_output(['git', 'show', 'cba67124:' + path.relative_to(ROOT).as_posix()], cwd=ROOT))['animations']
        after = historical_pose(path)['animations']
        changed = {key for key in after if before[key] != after[key]}
        self.assertEqual(changed, {'animation.kg_seasoning.item.sprinkle.right'})
        key = next(iter(changed))
        for channel in ['rotation', 'scale']:
            self.assertEqual(after[key]['bones']['grip'][channel], before[key]['bones']['grip'][channel])
        self.assertEqual(after[key]['animation_length'], .5)
        self.assertFalse(after[key]['loop'])
        offsets = []
        for time, position in after[key]['bones']['grip']['position'].items():
            offsets.append([a - b for a, b in zip(position, before[key]['bones']['grip']['position'][time])])
        for offset in offsets:
            for first, second in zip(offset, offsets[0]):
                self.assertAlmostEqual(first, second, places=8)

    def test_exact_native_empty_hand_basis_and_strict_action_scope(self):
        source = json.loads((ROOT / 'development/gameplay_core/fixtures/seasoning-native-sprinkle-frame-1.26.50.4.json').read_text())
        self.assertEqual(source['sources']['player_firstperson']['blob'], '1b664aa21eae5f2bd994a2fad53a7f42f235af50')
        path = held.RP / 'animations/seasoning_sprinkle_anchor.animation.json'
        clips = json.loads(path.read_text())['animations']
        self.assertEqual(set(clips), {'animation.kg_seasoning.player.sprinkle_anchor.right'})
        clip = next(iter(clips.values()))
        self.assertEqual(clip['animation_length'], .5)
        self.assertNotIn('loop', clip)
        self.assertTrue(clip['override_previous_animation'])
        self.assertEqual(set(clip['bones']), {'rightarm', 'rightitem'})
        for bone, data in clip['bones'].items():
            self.assertEqual(data, source['empty_hand']['bones'][bone])
            self.assertNotIn('scale', data)
        gate = clip['blend_weight']
        self.assertTrue(gate.startswith('variable.is_first_person && '))
        self.assertIn("q.property('kaleidoscope_grilling:season_hand') == 1", gate)
        self.assertIn("q.property('kaleidoscope_grilling:season_phase') > 0", gate)
        self.assertIn("q.is_item_name_any('slot.weapon.mainhand',", gate)
        self.assertNotIn('pending_seasoning', gate)
        self.assertNotIn('empty_seasoning_bottle', gate)
        self.assertNotIn('offhand', gate)
        self.assertNotIn('eat_', gate)
        self.assertIn('q.is_sneaking == 0', gate)
        self.assertIn('q.is_swimming == 0', gate)
        self.assertIn('variable.is_using_vr == 0', gate)

    def test_historical_g64_inverted_complete_mesh_fits_fov60_math_with_hud_clearance(self):
        # This is the historical G64 finite settled frame after exact G105
        # reversal, not current-candidate clearance or a rendered client test.
        geometries = json.loads((held.RP / 'models/entity/bottle_held_contents.geo.json').read_text())['minecraft:geometry']
        largest = geometries[0]
        original = historical_pose(held.RP / 'animations/seasoning_held.animation.json')['animations']['animation.kg_seasoning.item.sprinkle.right']['bones']['grip']['position']['0.0']
        current = held.motion('right', 0, False)['position']
        for i in range(61):
            pose = held.motion('right', i / 120, False)
            pose['position'] = [value - (new - old) for value, new, old in zip(pose['position'], current, original)]
            points = projected(largest, {'bones': {'grip': pose}}, 'right')
            for x, y, z in points:
                self.assertLess(z, -.1)
                self.assertLess(abs(x / -z), 1.489 * math.tan(math.radians(30)))
                self.assertGreater(y / -z, -.45)
                self.assertLess(y / -z, .52)

    def test_existing_native_player_and_idle_assets_remain_unchanged(self):
        paths = [held.BP / 'entities/player.json', held.RP / 'animations/a286_held.animation.json',
                 held.RP / 'animations/a21_shake.animation.json', held.RP / 'animations/player_binding.animation.json']
        paths += list((held.RP / 'attachables').glob('*seasoning*.json'))
        version=tuple(json.loads((held.BP/'manifest.json').read_text())['header']['version'])
        for path in paths:
            proxy=re.fullmatch(r'(partial|pending)_seasoning_f[1-8]\.attachable',path.stem) if path.parent==held.RP/'attachables' else None
            if proxy:
                self.assertGreaterEqual(version,(2,8,71))
                base='empty_seasoning_bottle' if proxy.group(1)=='partial' else 'pending_seasoning'
                original=path.with_name(base+'.attachable.json')
                before=json.loads(subprocess.check_output(['git','show','cba67124:'+original.relative_to(ROOT).as_posix()],cwd=ROOT))
                before['minecraft:attachable']['description']['identifier']='kaleidoscope_grilling:'+path.name.removesuffix('.attachable.json')
                if version>=(2,8,119):admit_shared_bottle_owner(before['minecraft:attachable']['description'])
                self.assertEqual(json.loads(path.read_bytes()),before,path)
                continue
            prior=subprocess.check_output(['git','show','cba67124:'+path.relative_to(ROOT).as_posix()],cwd=ROOT)
            if version>=(2,8,68) and path==held.BP/'entities/player.json':
                before=json.loads(prior)
                props=before['minecraft:entity']['description']['properties']
                for hand in ('main','off'):
                    for index in range(3):
                        row=props['kaleidoscope_grilling:secret_'+hand+'_'+str(index)]
                        self.assertEqual(row,{'type':'int','range':[0,255],'default':0,'client_sync':True})
                        row['range']=[0,5333]
                    props['kaleidoscope_grilling:secret_'+hand+'_piece']={'type':'int','range':[0,255],'default':0,'client_sync':True}
                    if version>=(2,8,119):
                        # Same property names, type/default/sync and native
                        # player bytes; only ten owned hand ranges are wider.
                        for index in range(10):props[channel_name(hand,index)]['range']=[0,WORD_A_MAX if index%2==0 else WORD_B_MAX]
                self.assertEqual(json.loads(path.read_bytes()),before,path)
            elif version>=(2,8,119) and path.parent==held.RP/'attachables' and path.name in ('empty_seasoning_bottle.attachable.json','pending_seasoning.attachable.json'):
                # The exact owner marker/decoder delta cannot alter the old
                # animation, pose, texture, material or renderer selections.
                before=json.loads(prior);admit_shared_bottle_owner(before['minecraft:attachable']['description'])
                self.assertEqual(json.loads(path.read_bytes()),before,path)
            elif path.name == 'a286_held.animation.json':self.assertEqual(historical_bytes(path),prior,path)
            elif version>=(2,8,148) and path.parent==held.RP/'attachables' and path.name.startswith('special_seasoning'):
                from seasoning_tp_source import reference_bytes
                self.assertEqual(reference_bytes(path),prior,path)
            else:self.assertEqual(path.read_bytes(),prior,path)


if __name__ == '__main__':
    unittest.main()
