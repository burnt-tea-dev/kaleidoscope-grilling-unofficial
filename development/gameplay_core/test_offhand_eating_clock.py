"""Selected-hand clock isolation, evaluated against actual exported Molang.

The documented main-hand query cannot provide an offhand timer. This test uses
independent clocks rather than assuming both hands have the same countdown.
"""
import json
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RP = ROOT / 'projects/grilling/gameplay_core/resource_pack'

class OffhandEatingClock(unittest.TestCase):
    def test_offhand_is_independent_of_mainhand_countdown(self):
        clips = json.loads((RP / 'animations/java_eating_player.animation.json').read_text())['animations']
        expressions = [v['anim_time_update'] for k, v in clips.items() if k.endswith('.left')]
        self.assertTrue(expressions)
        subprocess.run(['node', '--input-type=module'], input='''
const expressions = ''' + json.dumps(expressions) + ''';
const math={clamp:(x,a,b)=>Math.max(a,Math.min(b,x))};
for(const expression of expressions) for(const ticks of [90,100]) {
 for(const elapsed of [0,1,20,60,ticks]) for(const remaining of [0,17,90,100,72000]) {
  const props={eat_native_ticks:ticks,eat_elapsed_ticks:elapsed,eat_hand:2};
  const q={is_using_item:true,main_hand_item_use_duration:remaining,frame_alpha:.5,
   property:name=>props[name.split(':')[1]]};
  const scoped=expression.replaceAll('c.owning_entity->q.','owner.');
  const evaluate=()=>new Function('q','owner','math','return '+scoped)(q,q,math);
  const actual=evaluate(),expected=elapsed/20;
  if(actual!==expected)throw Error(JSON.stringify({elapsed,remaining,actual,expected}));
  q.is_using_item=false;if(evaluate()!==0)throw Error('Cancelled offhand clock persisted');
 }
}
''', text=True, check=True)

if __name__ == '__main__':
    unittest.main()
