"""Project shipped controls into a viewport and compare Java HUD landmarks.

This catches misplaced/clipped fills independently of the atlas pixel gates.
It is a layout calculation, not a Minecraft client rendering test.
"""
from pathlib import Path
import json
import unittest

ROOT=Path(__file__).resolve().parents[1]
RP=ROOT/'projects/grilling/gameplay_core/resource_pack'
ANCHORS={'bottom_left':(0,1),'bottom_middle':(.5,1)}

def bounds(control, viewport, parent_offset=(0,0)):
    width,height=control['size']
    # Bedrock anchor_from is the parent's point; anchor_to is the control's.
    parent=ANCHORS[control['anchor_from']]
    own=ANCHORS[control['anchor_to']]
    x,y=control['offset']
    return (parent_offset[0]+viewport[0]*parent[0]+x-width*own[0],
            parent_offset[1]+viewport[1]*parent[1]+y-height*own[1],width,height)

class EatingHudLayout(unittest.TestCase):
    def test_base_fill_and_checkpoint_share_original_java_landmarks(self):
        hud=json.loads((RP/'ui/kg_grilling_hud.json').read_text())
        rows={name:value for row in hud['kg_eating_packet']['controls'] for name,value in row.items()}
        reference=json.loads((ROOT/'development/gameplay_core/fixtures/java-hud-1.1.1.json').read_text())['bar']
        self.assertEqual(hud['kg_eating_packet']['size'],['100%','100%'])
        for viewport in [(320,180),(640,360),(854,480)]:
            with self.subTest(viewport=viewport):
                left=viewport[0]/2+reference['left_from_center']
                top=viewport[1]+reference['top_from_bottom']
                self.assertEqual(bounds(rows['base'],viewport),(left,top,102,5))
                for ready in [0,1]:
                    for width in [1,51,102]:
                        self.assertEqual(bounds(rows[f'fill_{ready}_{width}'],viewport),
                                         (left,top,width,5))
                    for duration in [90,100]:
                        icon=bounds(rows[f'icon_{duration}_{ready}_0'],viewport)
                        checkpoint=left+round(reference['width']*reference['ready_ticks']/duration)
                        self.assertEqual(icon[0]+icon[2]/2,checkpoint)
                        self.assertGreaterEqual(icon[0],0)
                        self.assertLessEqual(icon[0]+icon[2],viewport[0])

    def test_native_touch_lifts_the_complete_packet_clear_of_use_item(self):
        packet=json.loads((RP/'ui/kg_grilling_hud.json').read_text())['kg_eating_packet']
        # Native Mojang ui_common.json uses this predicate, not a custom input key.
        self.assertEqual(packet['offset'],'$kg_hud_offset')
        desktop=packet['$kg_hud_offset|default']
        self.assertEqual(desktop,[0,0])
        self.assertEqual(packet['variables'],[{'requires':'$touch','$kg_hud_offset':[0,-26]}])
        touch=packet['variables'][0]['$kg_hud_offset']
        for viewport in [(320,180),(640,360),(854,480)]:
            for row in packet['controls']:
                for name,control in row.items():
                    with self.subTest(viewport=viewport,control=name):
                        original=bounds(control,viewport,desktop)
                        lifted=bounds(control,viewport,touch)
                        self.assertEqual(lifted,(original[0],original[1]-26,*original[2:]))
                        self.assertGreaterEqual(lifted[1],0)
                        self.assertLessEqual(lifted[1]+lifted[3],viewport[1])

if __name__=='__main__':
    unittest.main()
