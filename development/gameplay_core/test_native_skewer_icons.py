"""Small regressions for actual inventory animation routes, not native-client proof."""
import io
import copy
import sys
from unittest.mock import patch
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

    def test_guide_dual_route_rejects_unknown_or_placeable_or_wrong_source(self):
        sys.path.insert(0, str(ROOT/'tools'))
        import check_grilling_guide as guide
        original = guide.load
        for name in SOURCES:
            item = read(BP/'items'/(name+'.json'))['minecraft:item']
            self.assertEqual(guide.guide_item_icon_key(item), name)
            bad=copy.deepcopy(item)
            bad['components']['minecraft:block_placer']['use_on']=[]
            with self.assertRaises(AssertionError):guide.guide_item_icon_key(bad)
            bad=copy.deepcopy(item);bad['description']['identifier']=NS+'secret_skewer'
            with self.assertRaises(AssertionError):guide.guide_item_icon_key(bad)
            def changed(path):
                doc=original(path)
                if path.name=='terrain_texture.json':
                    doc['texture_data']['kg_native_icon_'+name]['textures']='textures/items/secret_skewer'
                return doc
            with patch.object(guide,'load',changed), self.assertRaises(AssertionError):
                guide.guide_item_icon_key(item)
        static=read(BP/'items/raw_slime_skewer.json')['minecraft:item']
        self.assertEqual(guide.guide_item_icon_key(static),'raw_slime_skewer')

    def test_owned_geometry_material_and_flipbook_mutations_reject(self):
        import native_skewer_icons as native
        original=native.read
        cases=[('native_skewer_icon_grilled_slime_skewer.geo.json',lambda d:d['minecraft:geometry'][0]['bones'][0]['cubes'][0]['size'].__setitem__(0,15)),
               ('item_visual_grilled_slime_skewer.json',lambda d:d['minecraft:block']['components']['minecraft:item_visual']['material_instances']['*'].__setitem__('render_method','opaque')),
               ('flipbook_textures.json',lambda d:next(r for r in d if r.get('atlas_tile')=='kg_native_icon_grilled_slime_skewer').__setitem__('ticks_per_frame',5))]
        for filename,mutate in cases:
            def changed(path):
                doc=original(path)
                if path.name==filename:mutate(doc)
                return doc
            with self.subTest(file=filename), patch.object(native,'read',changed), self.assertRaises(ValueError):
                native.check_or_write(SOURCE_ROOT)

    def test_frame_revealed_edges_are_not_lost_to_alpha_union(self):
        first = Image.new('RGBA',(2,1)); first.putpixel((0,0),(255,255,255,255))
        second = Image.new('RGBA',(2,1)); second.putpixel((1,0),(255,255,255,255))
        boundaries = spans([first,second])
        self.assertIn(('west',0), boundaries)  # Interior to union; exposed in first.
        self.assertIn(('east',1), boundaries)  # Interior to union; exposed in second.

if __name__ == '__main__':
    unittest.main(verbosity=2)

