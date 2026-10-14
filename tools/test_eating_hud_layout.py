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

def bounds(control, viewport):
    width,height=control['size']
    source=ANCHORS[control['anchor_from']]
    target=ANCHORS[control['anchor_to']]
    x,y=control['offset']
    return (viewport[0]*target[0]+x-width*source[0],
            viewport[1]*target[1]+y-height*source[1],width,height)

class EatingHudLayout(unittest.TestCase):
    def test_base_fill_and_checkpoint_share_original_java_landmarks(self):
        hud=json.loads((RP/'ui/kg_grilling_hud.json').read_text())
        rows={name:value for row in hud['kg_eating_packet']['controls'] for name,value in row.items()}
        reference=json.loads((ROOT/'development/gameplay_core/fixtures/java-hud-1.1.1.json').read_text())['bar']
        self.assertEqual(hud['kg_eating_packet']['size'],['100%','100%'])
        viewport=(320,180)
        left=viewport[0]/2+reference['left_from_center']
        top=viewport[1]+reference['top_from_bottom']
        self.assertEqual(bounds(rows['base'],viewport),(left,top,102,5))
        self.assertEqual(bounds(rows['fill_0_51'],viewport),(left,top,51,5))
        icon=bounds(rows['icon_90_0_0'],viewport)
        checkpoint=left+round(reference['width']*reference['ready_ticks']/90)
        self.assertEqual(icon[0]+icon[2]/2,checkpoint)
        self.assertGreaterEqual(icon[0],0)
        self.assertLessEqual(icon[0]+icon[2],viewport[0])

if __name__=='__main__':
    unittest.main()
