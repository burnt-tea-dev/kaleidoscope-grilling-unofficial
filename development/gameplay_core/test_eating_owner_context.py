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
 const evaluate=expr=>Boolean(new Function('q','c','owner','v','return '+scoped(expr))(q,c,owner,v));
 if(!current.some(x=>Object.values(x).some(evaluate)))throw Error(row.name+' active owner pose masked');
 if(row.name==='grilled_caterpillar_skewer'&&hand===2){
  const active=current.filter(x=>Object.values(x).some(evaluate)).flatMap(x=>Object.keys(x));
  if(JSON.stringify(active)!==JSON.stringify(['offhand_projection_left']))throw Error('Caterpillar offhand must select only its owned projection');
 }
 owner.property=()=>0;owner.has_property=()=>false;
 new Function('q','c','owner','math','v',scoped(row.pre.join('\n')))(q,c,owner,math,v);
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



    def test_missing_properties_fail_closed_and_present_values_match_predecessor(self):
        from eating_owner_properties import predecessor_document
        rows = []
        for name in ('raw_gluten_skewer', 'grilled_fish_skewer', 'grilled_beef_skewer', 'secret_skewer', 'dark_grilling'):
            current = json.loads((RP / 'attachables' / (name + '.attachable.json')).read_text())
            rows.append({'current': current['minecraft:attachable']['description'],
                         'before': predecessor_document(current)['minecraft:attachable']['description']})
        source = r"""
const rows=ROWS, keys=['eat_profile','eat_hand','eat_projection','eat_native_ticks','eat_elapsed_ticks'];
const math={clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),floor:Math.floor};
function run(d,missing,first,hand,strict=true){
 const props={eat_profile:3,eat_hand:hand,eat_projection:1,eat_native_ticks:100,eat_elapsed_ticks:25};
 if(missing==='all')for(const key of keys)delete props[key];else if(missing)delete props[missing];
 const owner={has_property:n=>Object.hasOwn(props,n.split(':')[1]),property:n=>{
  const key=n.split(':')[1];if(!Object.hasOwn(props,key)){if(strict)throw Error('Missing '+key);return 0}return props[key];},is_item_name_any:()=>false};
 const q={is_using_item:true,main_hand_item_use_duration:75,frame_alpha:.5,is_sneaking:0,is_swimming:0,is_gliding:0,is_riding:0,is_item_equipped:()=>0,is_item_name_any:()=>true};
 const c={is_first_person:first,item_slot:hand===1?'main_hand':'off_hand'},v={};
 const scoped=s=>s.replaceAll('c.owning_entity->q.','owner.');
 new Function('q','c','owner','math','v',scoped(d.scripts.pre_animation.join('\n')))(q,c,owner,math,v);
 const active=d.scripts.animate.filter(row=>typeof row==='string'||Object.values(row).some(s=>new Function('q','c','owner','v','return '+scoped(s))(q,c,owner,v))).map(row=>typeof row==='string'?row:Object.keys(row)[0]);
 for(const key of keys)delete v['kg_owner_'+key];
 return {active,v};
}
for(const row of rows)for(const first of [0,1])for(const hand of [1,2]){
 const before=run(row.before,null,first,hand),after=run(row.current,null,first,hand);
 if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Valid owner behavior changed');
 for(const missing of ['all',...keys]){
  const expected=run(row.before,missing,first,hand,false),actual=run(row.current,missing,first,hand);
  if(JSON.stringify(expected)!==JSON.stringify(actual))throw Error('Zero fallback changed '+missing);
 }
}
""".replace('ROWS', json.dumps(rows))
        subprocess.run(['node', '--input-type=module'], input=source, text=True, check=True)

    def test_every_cached_item_clip_has_initialized_attachable_consumers(self):
        import re
        from eating_owner_properties import CACHED, initialization, predecessor_document, document
        animations = {name: body for path in (RP / 'animations').glob('*.json')
                      for name, body in json.loads(path.read_text()).get('animations', {}).items()}
        consumers = {name: [] for name, body in animations.items() if CACHED.search(json.dumps(body))}
        for path in (RP / 'attachables').glob('*.json'):
            current = json.loads(path.read_text())
            desc = current['minecraft:attachable']['description']
            needs = [name for name in desc.get('animations', {}).values() if name in consumers]
            if needs or CACHED.search(json.dumps(desc)):
                self.assertEqual(desc['scripts']['pre_animation'][:5], initialization(), path.name)
                self.assertEqual(document(predecessor_document(current)), current)
                for name in needs:
                    consumers[name].append(desc['identifier'])
        self.assertTrue(consumers)
        self.assertTrue(all(consumers.values()), 'Cached clip lacks a current attachable initializer')


if __name__ == '__main__':
    unittest.main()
