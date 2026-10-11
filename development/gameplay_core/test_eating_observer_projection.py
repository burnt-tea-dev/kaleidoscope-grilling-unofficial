"""Evaluate real generated Molang gates; native observer pixels are separate."""
from pathlib import Path
import json
import re
import subprocess
import sys
import unittest

ROOT=Path(__file__).resolve().parents[2]
BP=ROOT/'projects/grilling/gameplay_core/behavior_pack'
RP=ROOT/'projects/grilling/gameplay_core/resource_pack'
sys.path.insert(0,str(ROOT/'tools'))
import build_java_eating_projection as generator



OWNER_CONTEXT_HARNESS = r"""
function evaluatePreAnimation(rows,q,c,math,v){
 const owner={has_property:()=>false,property:()=>0,is_item_name_any:()=>false,...(c.owning_entity??{})};
 const text=rows.join('\n').replaceAll('c.owning_entity->q.','owner.');
 if(text.includes('->'))throw Error('Unsupported Molang entity context');
 const numericMath={...math,floor:Math.floor};
 return new Function('q','c','owner','math','v',text)(q,c,owner,numericMath,v);
}
"""

def node(source):
    # Large generated Molang tables exceed Windows' command-line limit.
    subprocess.run(['node','--input-type=module'],input=OWNER_CONTEXT_HARNESS+source,text=True,check=True)


class EatingObserverProjection(unittest.TestCase):
    def test_camera_space_item_channels_never_run_in_third_person(self):
        documents=[]
        for path in (RP/'attachables').glob('*_skewer.attachable.json'):
            d=json.loads(path.read_text())['minecraft:attachable']['description']
            documents.append(d['scripts']['animate'])
        self.assertEqual(len(documents),41)
        node('''
const documents='''+json.dumps(documents)+''';
const q={is_using_item:true,property:name=>name.endsWith('eat_hand')?1:name.endsWith('eat_profile')?5:1,
is_sneaking:0,is_swimming:0,is_gliding:0,is_riding:0};
const c={is_first_person:0,item_slot:'main_hand'};
for(const rows of documents)for(const row of rows)for(const [alias,expr] of Object.entries(row)){
 const active=Boolean(new Function('q','c','return '+expr)(q,c));
 if((alias.startsWith('eat_')||alias.startsWith('fp_eat_')||alias==='probe_one_right')&&active)throw Error('FP displacement in TP: '+alias);
 if(alias==='tp_right'&&!active)throw Error('Native TP display suppressed');
}
''')

    def test_observer_bites_do_not_use_owner_countdown(self):
        paths=['raw_beef_skewer','raw_bun_slice_skewer','raw_fish_skewer','raw_ender_pearl_skewer','raw_gluten_skewer','secret_skewer']
        scripts=[json.loads((RP/'attachables'/f'{name}.attachable.json').read_text())['minecraft:attachable']['description']['scripts']['pre_animation'] for name in paths]
        node('''
const scripts='''+json.dumps(scripts)+''';
const math={clamp:(x,lo,hi)=>Math.max(lo,Math.min(hi,x))};
for(const profile of [1,2,3,4,5])for(const elapsed of [0,5,20,25,40,65,85,90,100]){
 const ticks=profile===3?100:90,props={eat_native_ticks:ticks,eat_elapsed_ticks:elapsed,eat_hand:1,eat_profile:profile};
 for(const remaining of [0,17,90,100,72000])for(const rows of scripts){
  const q={is_using_item:true,main_hand_item_use_duration:remaining,frame_alpha:.5,property:name=>props[name.split(':')[1]]};
  const c={is_first_person:0,item_slot:'main_hand'},v={};
  evaluatePreAnimation(rows,q,c,math,v);
  if(v.kg_eat_seconds!==Math.min(elapsed,ticks)/20)throw Error('Observer borrowed owner timer');
  if(elapsed===0&&v.kg_bite_stage!==0)throw Error('Observer starts already bitten');
 }
}
// First person retains the measured native countdown convention unchanged.
for(const rows of scripts){
 const q={is_using_item:true,main_hand_item_use_duration:70,frame_alpha:.5,property:name=>({eat_native_ticks:90,eat_elapsed_ticks:85,eat_hand:1,eat_profile:5})[name.split(':')[1]]};
 const c={is_first_person:1,item_slot:'main_hand'},v={};
 evaluatePreAnimation(rows,q,c,math,v);
 if(v.kg_eat_seconds!==19.5/20)throw Error('Owner clock changed');
}
''')

    def test_secret_owner_context_is_distinct_from_attachable_queries(self):
        scripts=json.loads((RP/'attachables/secret_skewer.attachable.json').read_text())['minecraft:attachable']['description']['scripts']['pre_animation']
        reads=[s for s in scripts if s.startswith('v.kg_secret_')]
        node('const rows='+json.dumps(reads)+r""";
const props={'kaleidoscope_grilling:secret_main_0':174,'kaleidoscope_grilling:secret_main_1':180,'kaleidoscope_grilling:secret_main_2':184,
 'kaleidoscope_grilling:secret_off_0':-7,'kaleidoscope_grilling:secret_off_1':214,'kaleidoscope_grilling:secret_off_2':180.9};
const owner={has_property:n=>Object.hasOwn(props,n),property:n=>props[n]},q={property:()=>99,has_property:()=>true};
for(const [slot,expected] of [['main_hand',[174,180,184]],['off_hand',[0,214,180]]]){
 const c={item_slot:slot,owning_entity:owner},v={};evaluatePreAnimation(rows,q,c,{clamp:(n,lo,hi)=>Math.max(lo,Math.min(hi,n))},v);
 const actual=[0,1,2].map(i=>v['kg_secret_ingredient_'+i]);if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error('Wrong owner/hand indices');
 if(slot==='off_hand'&&v.kg_secret_food_1!==0)throw Error('Unsupported low byte must hide, not borrow last catalog food');
}
const v={};evaluatePreAnimation(rows,q,{item_slot:'main_hand'},{clamp:(n,lo,hi)=>Math.max(lo,Math.min(hi,n))},v);
if([0,1,2].some(i=>v['kg_secret_ingredient_'+i]!==0))throw Error('Absent owner borrowed attachable properties');
""")

    def test_unknown_molang_entity_context_remains_rejected(self):
        node(r"""
let rejected=false;try{evaluatePreAnimation(['v.x=c.other_entity->q.property(\'x\');'],{},{},{},{});}catch(e){rejected=String(e).includes('Unsupported Molang entity context');}
if(!rejected)throw Error('Unknown context accepted');
""")

    def test_stale_projection_cannot_draw_arm_on_another_item(self):
        _,players=generator.animations()
        expressions={name:row['blend_weight'] for name,row in players.items()}
        node('''
const expressions='''+json.dumps(expressions)+''',items='''+json.dumps(generator.projection_items())+''';
for(const [profile,names] of Object.entries(items))for(const hand of ['right','left']){
 const code={ONE:1,TWO:2,THREE:3,THREE_ALT:4,FOUR:5}[profile],handCode=hand==='right'?1:2;
 const expression=expressions['animation.kg_java_eating.player.'+profile.toLowerCase()+'.'+hand];
 let held=names[0];
 const q={is_using_item:true,is_sneaking:0,is_swimming:0,is_gliding:0,is_riding:0,
 property:name=>({eat_projection:1,eat_profile:code,eat_hand:handCode})[name.split(':')[1]],is_item_equipped:()=>0,
 is_item_name_any:(slot,...ids)=>slot===(hand==='right'?'slot.weapon.mainhand':'slot.weapon.offhand')&&ids.includes(held)};
 const variable={is_first_person:true},evaluate=()=>Boolean(new Function('q','variable','return '+expression)(q,variable));
 if(!evaluate())throw Error('Valid selected profile masked');
 for(const other of ['kaleidoscope_tavern:shaker','kaleidoscope_tavern:shaker_active','kaleidoscope_tavern:shaker_pouring','minecraft:apple','kaleidoscope_grilling:empty_seasoning_bottle','kaleidoscope_grilling:raw_fish_skewer']){
  held=other;if(evaluate())throw Error('Stale Grilling projection on '+other);
 }
 for(const otherProfile of Object.keys(items).filter(x=>x!==profile)){
  held=items[otherProfile][0];if(evaluate())throw Error('Previous profile remained on another skewer');
 }
 held=names[0];q.is_using_item=false;if(evaluate())throw Error('Released pose remained');q.is_using_item=true;
 for(const posture of ['is_sneaking','is_swimming','is_gliding','is_riding']){
  q[posture]=1;if(evaluate())throw Error('Guarded posture projected');q[posture]=0;
 }
}
''')

    def test_all_observer_bite_boundaries_match_pinned_java_profiles(self):
        java=(ROOT/'projects/grilling/integration/immersion_lab/sources/forge-1.20.1/src/main/java/cn/breezeth/kaleidoscope_grilling/skewer/MultiBiteSkewerItem.java').read_text()
        boundaries={}
        for profile in ('ONE','TWO','THREE','THREE_ALT','FOUR'):
            match=re.search(r'\b'+profile+r'\((\d+),\s*([^)]*)\)',java)
            boundaries[profile]=[float(value.strip().rstrip('F')) for value in match[2].split(',')]
        table=json.loads(re.search(r'PROFILE_BY_ITEM=Object.freeze\((\{.*?\})\)',(BP/'scripts/data.js').read_text()).group(1))
        cases=[]
        for path in (RP/'attachables').glob('*_skewer.attachable.json'):
            d=json.loads(path.read_text())['minecraft:attachable']['description']
            if d['identifier']=='kaleidoscope_grilling:unfinished_skewer':
                self.assertFalse(any(k.startswith(('eat_','fp_eat_'))for k in d['animations']))
                continue
            requested=table.get(d['identifier'],'THREE_RANDOM')
            profiles=('THREE','THREE_ALT') if requested=='THREE_RANDOM' else (requested,)
            for profile in profiles:
                cases.append({'id':d['identifier'],'profile':profile,'script':d['scripts']['pre_animation'],'boundaries':boundaries[profile]})
        self.assertEqual(len(cases),60)
        node('''
const cases='''+json.dumps(cases)+''',math={clamp:(x,lo,hi)=>Math.max(lo,Math.min(hi,x))};
for(const row of cases)for(const hand of [1,2]){
 const maximum=row.profile==='THREE'?100:90;
 // The replicated property is an integer native tick, not a fractional knot.
 const times=[0,...row.boundaries.flatMap(x=>[Math.ceil(x*20)/20-0.05,Math.ceil(x*20)/20]),maximum/20];
 for(const seconds of times){
  const props={eat_native_ticks:maximum,eat_elapsed_ticks:Math.round(seconds*20),eat_hand:hand,eat_profile:{ONE:1,TWO:2,THREE:3,THREE_ALT:4,FOUR:5}[row.profile]};
  const q={is_using_item:true,main_hand_item_use_duration:0,frame_alpha:.5,property:name=>props[name.split(':')[1]]};
  const c={is_first_person:0,item_slot:hand===1?'main_hand':'off_hand'},v={};
  evaluatePreAnimation(row.script,q,c,math,v);
  const expected=row.boundaries.filter(x=>x<=Math.round(seconds*20)/20).length;
  if(v.kg_bite_stage!==expected)throw Error(row.id+' '+row.profile+' bite boundary at '+seconds);
  c.item_slot=hand===1?'off_hand':'main_hand';
  evaluatePreAnimation(row.script,q,c,math,v);
  if(v.kg_bite_stage!==0)throw Error('Inactive hand borrowed eater stage');
 }
}
''')

    def test_native_visibility_fallback_is_preserved_outside_owned_projection(self):
        original=json.loads((ROOT/'development/gameplay_core/fixtures/native-first-person-controller-1.26.50.4.json').read_text())['controller']
        current=json.loads((RP/'render_controllers/java_eating_player.render_controllers.json').read_text())['render_controllers']['controller.render.player.first_person']
        for old,new in zip(original['part_visibility'],current['part_visibility']):
            for bone,expression in old.items():
                if bone in ('rightArm','rightSleeve','leftArm','leftSleeve'):
                    current_expression=new[bone]
                    version=tuple(json.loads((BP/'manifest.json').read_text())['header']['version'])
                    if version>=(2,8,126):
                        from build_caterpillar_eating_projection import GATE
                        prefix='('+GATE+') ? 1 : ('
                        self.assertTrue(current_expression.startswith(prefix) and current_expression.endswith(')'))
                        current_expression=current_expression[len(prefix):-1]
                    self.assertTrue(current_expression.endswith(' : ('+expression+')'))
                    self.assertIn('q.is_item_name_any',current_expression)
                    self.assertIn("q.property('kaleidoscope_grilling:eat_profile')",current_expression)
                else:self.assertEqual(new[bone],expression)

    def test_replicated_elapsed_property_and_lifecycle(self):
        properties=json.loads((BP/'entities/player.json').read_text())['minecraft:entity']['description']['properties']
        self.assertEqual(properties['kaleidoscope_grilling:eat_elapsed_ticks'],{'type':'int','range':[0,72000],'default':0,'client_sync':True})
        module=BP/'scripts/player_presentation_core.js'
        node("import {eatingElapsedTicks} from "+json.dumps(module.as_uri())+";"+'''
for(const [start,tick,duration,expected] of [[50,50,90,0],[50,75,90,25],[50,250,90,90],[50,0,90,0],[50,75,100,25],[50,75,0,0],[50,75,NaN,0],[50,75.5,90,0],[undefined,75,90,0]]){
 if(eatingElapsedTicks(start,tick,duration)!==expected)throw Error('Invalid presentation tick');
}
''')
        source=(BP/'scripts/main.js').read_text()
        for event in ('itemStartUse','itemCompleteUse','itemStopUse','playerSpawn'):
            section=source.split('world.afterEvents.'+event+'.subscribe',1)[1].split('world.',1)[0]
            self.assertIn('setProperty(EAT_ELAPSED_TICKS_PROPERTY,0)',section)
        tick=source.split('const active=ACTIVE_EATS.get(p.id);',1)[1].split('writeFx(p,readFx(p))',1)[0]
        self.assertIn('eatingStillCurrent',tick)
        self.assertIn('eatingElapsedTicks(active.start,system.currentTick,active.nativeDuration)',tick)
        self.assertNotIn('hungerSettle(',tick)


if __name__=='__main__':unittest.main()
