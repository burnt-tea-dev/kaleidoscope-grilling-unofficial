"""Exercise real attachable Molang with distinct player/item inspection contexts."""
from pathlib import Path
import json
import subprocess
import sys
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools'))
from eating_owner_context import PLAYER_SECONDS, ATTACHABLE_SECONDS, augment

RP = ROOT / 'projects/grilling/gameplay_core/resource_pack'


class EatingOwnerContext(unittest.TestCase):
    def test_real_attachable_phase_and_pose_read_the_player_not_item_properties(self):
        cases = []
        for name, profile in [('grilled_fish_skewer', 1), ('grilled_bun_slice_skewer', 2),
                              ('grilled_ender_pearl_skewer', 3), ('secret_skewer_java_three_alt', 4),
                              ('grilled_beef_skewer', 5), ('grilled_caterpillar_skewer', 1)]:
            path = RP / 'attachables' / (name + '.attachable.json')
            d = json.loads(path.read_text())['minecraft:attachable']['description']
            cases.append({'name': name, 'profile': profile, 'pre': d['scripts']['pre_animation'],
                          'animate': d['scripts']['animate']})
        source = r"""
const cases=CASES;
const math={clamp:(n,lo,hi)=>Math.max(lo,Math.min(hi,n)),floor:Math.floor,max:Math.max};
const scoped=text=>text.replaceAll('c.owning_entity->q.','owner.');
for(const row of cases)for(const hand of [1,2]){
 const ticks=row.profile===3?100:90,elapsed=25;
 const props={eat_native_ticks:ticks,eat_elapsed_ticks:elapsed,eat_hand:hand,eat_profile:row.profile,eat_projection:1};
 const owner={property:n=>props[n.split(':')[1]]??0,has_property:n=>Object.hasOwn(props,n.split(':')[1]),is_item_name_any:()=>true};
 // Native item queries are intentionally direct; custom properties are not.
 const q={property:()=>0,has_property:()=>false,is_using_item:true,main_hand_item_use_duration:ticks-20,
  frame_alpha:.5,is_sneaking:0,is_swimming:0,is_gliding:0,is_riding:0,
  is_item_equipped:()=>0,is_item_name_any:()=>true};
 const c={owning_entity:owner,is_first_person:1,item_slot:hand===1?'main_hand':'off_hand'},v={};
 new Function('q','c','owner','math','v',scoped(row.pre.join('\n')))(q,c,owner,math,v);
 const expected=hand===1?19.5/20:elapsed/20;
 if(v.kg_eat_seconds!==expected)throw Error(row.name+' hand '+hand+' wrong owner clock: '+v.kg_eat_seconds);
 const current=row.animate.filter(x=>Object.keys(x).some(k=>k.startsWith('fp_eat_')||k.startsWith('eat_')||k==='probe_one_right'||k==='offhand_projection_left'));
 const evaluate=expr=>Boolean(new Function('q','c','owner','return '+scoped(expr))(q,c,owner));
 if(!current.some(x=>Object.values(x).some(evaluate)))throw Error(row.name+' active owner pose masked');
 if(row.name==='grilled_caterpillar_skewer'&&hand===2){
  const active=current.filter(x=>Object.values(x).some(evaluate)).flatMap(x=>Object.keys(x));
  if(JSON.stringify(active)!==JSON.stringify(['offhand_projection_left']))throw Error('Caterpillar offhand must select only its owned projection');
 }
 owner.property=()=>0;owner.has_property=()=>false;
 if(current.some(x=>Object.values(x).some(evaluate)))throw Error(row.name+' pose borrowed item properties');
}
""".replace('CASES', json.dumps(cases))
        subprocess.run(['node', '--input-type=module'], input=source, text=True, check=True)

    def test_offhand_clock_ignores_mainhand_counter_without_changing_mainhand_clock(self):
        source = r"""
const expressions=EXPRESSIONS;
for(const remaining of [0,17,90,100,72000])for(const elapsed of [0,1,25,70,90,100]){
 const props={eat_native_ticks:100,eat_elapsed_ticks:elapsed,eat_hand:2};
 const owner={property:n=>props[n.split(':')[1]]};
 const q={...owner,is_using_item:true,main_hand_item_use_duration:remaining,frame_alpha:.5};
 const c={owning_entity:owner},math={clamp:(n,lo,hi)=>Math.max(lo,Math.min(hi,n))};
 for(const expression of expressions){
  const actual=new Function('q','c','owner','math','return '+expression.replaceAll('c.owning_entity->q.','owner.'))(q,c,owner,math);
  if(actual!==elapsed/20)throw Error('Offhand borrowed mainhand remaining '+remaining);
 }
 props.eat_hand=1;
 const actual=new Function('q','math','return '+expressions[0])(q,math);
 const expected=Math.max(0,Math.min(5,(100-(remaining-.5+1))/20));
 if(actual!==expected)throw Error('Measured mainhand convention changed');
}
""".replace('EXPRESSIONS', json.dumps([PLAYER_SECONDS, ATTACHABLE_SECONDS]))
        subprocess.run(['node', '--input-type=module'], input=source, text=True, check=True)

    def test_generator_layer_is_idempotent_and_only_declared_eating_documents_change(self):
        paths = [RP / 'attachables' / 'secret_skewer.attachable.json',
                 RP / 'animations' / 'java_eating_projection.animation.json',
                 RP / 'animations' / 'java_eating_player.animation.json']
        current = {path: json.loads(path.read_text()) for path in paths}
        self.assertEqual(augment(current), current)
        self.assertEqual(augment(augment(current)), current)


if __name__ == '__main__':
    unittest.main()
