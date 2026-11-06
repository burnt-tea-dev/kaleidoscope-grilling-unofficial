"""Exercise content admission and clearing from the canonical UI data.

Only JSONUI's string subtraction/equality boundary is substituted here. This
checks which factory inputs the declaration skips, not native construction
timing, client rendering or FPS.
"""
import json
from pathlib import Path
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]
UI = ROOT/'projects/grilling/gameplay_core/resource_pack/ui/kg_grilling_hud.json'


class UiText(str):
    def __sub__(self, other):
        return UiText(self.replace(other, ''))


def ignored(expression, text):
    code = expression.replace('$kg_text', 'text').replace(' = ', ' == ')
    return eval(code, {'__builtins__': {}}, {'text': UiText(text)})


class EatingHudAdmission(unittest.TestCase):
    def test_factory_keeps_clearing_packets_and_skips_unrelated_image_subtrees(self):
        data = json.loads(UI.read_text())
        packet = data['kg_eating_packet']
        self.assertNotIn('ignored', packet, 'Every message must still replace the previous factory child')
        self.assertEqual(data['kg_eating_factory']['factory']['control_ids']['hud_actionbar_text'],
                         'kg_eating_packet@kaleidoscope_grilling_hud.kg_eating_packet')
        content = packet['controls'][0]['eating_content']
        expression = content.get('ignored')
        self.assertIsInstance(expression, str, 'Skip unrelated packets before entering the image subtree')
        for text in ['', 'Ordinary actionbar', 'KT_HUD!test;', '!js.message', 'KG_HUD!END;']:
            with self.subTest(text=text):
                self.assertTrue(ignored(expression, text))
                self.assertFalse(ignored(packet['visible'], text), 'Clearing packets remain hidden')
        script = """
import {javaEatingHudFrame,validEatingHudPacket} from './projects/grilling/gameplay_core/behavior_pack/scripts/java_eating_hud_core.js';
const packets=[];
for(const duration of [90,100])for(const elapsed of [0,24,25,duration]){
 const frame=javaEatingHudFrame({id:'kaleidoscope_grilling:grilled_beef_skewer',elapsed,duration});
 if(!validEatingHudPacket(frame.packet))throw Error('Formatter produced an invalid packet');
 packets.push(frame.packet);
}
console.log(JSON.stringify(packets));
"""
        frames = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', script], cwd=ROOT))
        for text in frames:
            with self.subTest(text=text):
                self.assertFalse(ignored(expression, text))


if __name__ == '__main__':
    unittest.main()
