"""Small regressions for actual inventory animation routes, not native-client proof."""
import io
import json
import os
from pathlib import Path
import unittest
from PIL import Image
from native_skewer_icons import ROOT, PROJECT, NS, SOURCES, check_or_write, spans

SOURCE_ROOT = Path(os.environ.get('KG_ICON_TEST_ROOT', str(ROOT)))
BP = SOURCE_ROOT / PROJECT / 'behavior_pack'
RP = SOURCE_ROOT / PROJECT / 'resource_pack'

def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))

class NativeSkewerIcons(unittest.TestCase):
    def test_committed_sources_match_reviewed_native_route(self):
        routed = check_or_write(SOURCE_ROOT)
        self.assertEqual(set(routed), {
            'grilled_slime_skewer.json', 'grilled_slime_skewer_native_plain.json',
            'mysterious_skewer.json', 'mysterious_skewer_native_plain.json',
            'mysterious_skewer_java_three_alt.json'})

    def test_food_semantics_and_disabled_placement_survive_every_alias(self):
        rows = [('grilled_slime_skewer', '', 4.5, 4),
                ('grilled_slime_skewer', '_native_plain', 1.25, 4),
                ('mysterious_skewer', '', 5.0, 2),
                ('mysterious_skewer', '_native_plain', 1.25, 2),
                ('mysterious_skewer', '_java_three_alt', 4.5, 2)]
        for name, suffix, duration, nutrition in rows:
            with self.subTest(item=name+suffix):
                item = read(BP / 'items' / (name+suffix+'.json'))['minecraft:item']
                c = item['components']
                self.assertEqual(item['description']['identifier'], NS+name+suffix)
                self.assertEqual(c['minecraft:use_modifiers'], {
                    'start_using':'always', 'use_duration':duration, 'movement_modifier':.35})
                self.assertEqual(c['minecraft:food'], {
                    'can_always_eat':True, 'nutrition':nutrition, 'saturation_modifier':0})
                self.assertEqual(c['minecraft:tags']['tags'], ['minecraft:is_food', NS+'food_'+name])
                self.assertEqual(c['minecraft:use_animation'], {'value':'eat'})
                self.assertEqual(c['minecraft:max_stack_size'], 64)
                self.assertIs(c['minecraft:allow_off_hand'], True)
                self.assertIs(c['minecraft:interact_button'], True)
                self.assertNotIn('minecraft:icon', c)
                self.assertEqual(c['minecraft:block_placer'], {
                    'block':NS+'item_visual_'+name, 'use_on':[{'tags':'0'}]})
        for name in SOURCES:
            block = read(BP / 'blocks' / ('item_visual_'+name+'.json'))['minecraft:block']
            self.assertNotIn('menu_category', block['description'])
            self.assertIs(block['components']['minecraft:collision_box'], False)
            self.assertIs(block['components']['minecraft:selection_box'], False)
            self.assertNotIn('minecraft:tick', block['components'])
        self.assertEqual(read(BP/'loot_tables/native_item_visual_empty.json'), {'pools':[]})

    def test_animation_uses_all_original_pixels_and_only_original_animated_foods(self):
        flipbooks = read(RP/'textures/flipbook_textures.json')
        for name, (stem, _) in SOURCES.items():
            rows = [f for f in flipbooks if f.get('atlas_tile') == 'kg_native_icon_'+name]
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0]['frames'], [0,1,2,3,4])
            self.assertEqual(rows[0]['ticks_per_frame'], 4)
            self.assertIs(rows[0]['blend_frames'], False)
            with Image.open(RP/(rows[0]['flipbook_texture']+'.png')) as sheet:
                self.assertEqual(sheet.size, (16,80))
                for index in range(5):
                    with Image.open(RP/f'textures/ui/kg_java/{stem}_frame_{index}.png') as source:
                        self.assertEqual(sheet.crop((0,index*16,16,(index+1)*16)).convert('RGBA').tobytes(),
                                         source.convert('RGBA').tobytes())
        for name in ('raw_slime_skewer', 'raw_slime_skewer_native_plain',
                     'unfinished_skewer', 'secret_skewer'):
            c = read(BP/f'items/{name}.json')['minecraft:item']['components']
            self.assertIn('minecraft:icon', c)
            self.assertNotIn('minecraft:block_placer', c)

    def test_frame_revealed_edges_are_not_lost_to_alpha_union(self):
        first = Image.new('RGBA',(2,1)); first.putpixel((0,0),(255,255,255,255))
        second = Image.new('RGBA',(2,1)); second.putpixel((1,0),(255,255,255,255))
        boundaries = spans([first,second])
        self.assertIn(('west',0), boundaries)  # Interior to union; exposed in first.
        self.assertIn(('east',1), boundaries)  # Interior to union; exposed in second.

if __name__ == '__main__':
    unittest.main(verbosity=2)
