"""Actual generated terminal gates, not a native-client acceptance claim."""
from pathlib import Path
from copy import deepcopy
import json
import re
import sys
import unittest

ROOT = Path(__file__).resolve().parents[2]
RP = ROOT / 'projects/grilling/gameplay_core/resource_pack'
sys.path.insert(0, str(ROOT / 'tools'))
from public_source_witness import public_json, assert_public_bytes
import secret_terminal_visibility as terminal
from test_eating_observer_projection import node


class SecretTerminalVisibility(unittest.TestCase):
    def test_retained_reads_have_explicit_defaults_without_shared_initialization(self):
        descriptions = [json.loads((RP / 'attachables' / (item.split(':')[1] + '.attachable.json')).read_text())['minecraft:attachable']['description'] for item in terminal.OWNED]
        for description in descriptions:
            for row in description['scripts']['initialize'] + description['scripts']['pre_animation']:
                rhs = row.split(' = ', 1)[1] if ' = ' in row else row
                for match in re.finditer(r'v\.kg_secret_terminal_[a-z0-9_]+', rhs):
                    self.assertTrue(rhs[match.end():].startswith(' ?? 0)'), row)
        node('const descriptions=' + json.dumps(descriptions) + r''';
for(const d of descriptions)for(const hand of ['main_hand','off_hand']){
 const code=d.identifier.endsWith('_java_three_alt')?4:3,ticks=code===4?90:100;
 const owner={has_property:()=>true,property:n=>n.endsWith('_piece')?176:n.endsWith('_0')?174:n.endsWith('_1')?180:184,is_item_name_any:()=>true};
 const q={is_using_item:false,main_hand_item_use_duration:ticks,frame_alpha:1,is_sneaking:0,is_swimming:0,is_gliding:0,is_riding:0,is_item_equipped:()=>0,property:n=>({eat_hand:hand==='main_hand'?1:2,eat_profile:code,eat_native_ticks:ticks,eat_elapsed_ticks:0,eat_projection:1})[n.split(':')[1]],is_item_name_any:()=>true};
 const c={is_first_person:1,item_slot:hand,owning_entity:owner},math={clamp:(n,a,b)=>Math.max(a,Math.min(b,n)),floor:Math.floor};
 // Bare objects intentionally return undefined for missing reads. Do not use
 // the general harness's implicit-zero proxy for this startup regression.
 const run=(rows,v)=>new Function('q','c','math','v','owner',rows.join('\n').replaceAll('c.owning_entity->q.','owner.'))(q,c,math,v,owner);
 const initialized={};run(d.scripts.initialize,initialized);
 const separatePreAnimation={};run(d.scripts.pre_animation,separatePreAnimation);
 for(const state of [initialized,separatePreAnimation])for(const [key,value]of Object.entries(state))if(key.startsWith('kg_secret_terminal_')&&!Number.isFinite(Number(value)))throw Error('Missing startup default '+key);
 if(separatePreAnimation.kg_secret_terminal_wait||!separatePreAnimation.kg_secret_owner_occupied)throw Error('Fresh startup serving was hidden');
}
''')

    def test_public_repaired_terminal_scripts_are_conserved_and_generator_is_idempotent(self):
        # PR134 already contains the repair. This freezes those public source
        # bytes plus the exact G119 owner row, retaining the full terminal mask.
        from build_secret_held import owner_occupancy
        for item in terminal.OWNED:
            path = RP / 'attachables' / (item.split(':')[1] + '.attachable.json')
            assert_public_bytes(self, path)
            source = public_json(path)
            after = json.loads(path.read_text())
            description = source['minecraft:attachable']['description']
            from offhand_clock_witness import OLD_ASSIGNMENT
            from native_eating_clock import ASSIGNMENT
            description['scripts']['pre_animation'] = [ASSIGNMENT if row == OLD_ASSIGNMENT else row for row in description['scripts']['pre_animation']]
            rows = description['scripts']['pre_animation']
            self.assertEqual(sum(row.startswith('v.kg_secret_owner_occupied = ') for row in rows), 1)
            description['scripts']['pre_animation'] = [owner_occupancy(description['identifier']) if row.startswith('v.kg_secret_owner_occupied = ') else row for row in rows]
            terminal.apply(description)
            self.assertEqual(after, source)
            self.assertEqual(terminal.apply(deepcopy(after['minecraft:attachable']['description'])), after['minecraft:attachable']['description'])
        assert_public_bytes(self, RP / 'render_controllers/secret_held.render_controllers.json')

    def test_terminal_use_gate_gap_and_all_authoritative_or_fresh_serving_exits(self):
        descriptions = [json.loads((RP / 'attachables' / (item.split(':')[1] + '.attachable.json')).read_text())['minecraft:attachable']['description'] for item in terminal.OWNED]
        controllers = json.loads((RP / 'render_controllers/secret_held.render_controllers.json').read_text())['render_controllers']
        node('const descriptions=' + json.dumps(descriptions) + ';const controllers=' + json.dumps(controllers) + r''';
for(const d of descriptions)for(const hand of ['main_hand','off_hand']){
 const code=d.identifier.endsWith('_java_three_alt')?4:3,ticks=code===4?90:100;
 let using=true,held=d.identifier,clear=false,first=1,changed=false;
 const props={eat_native_ticks:ticks,eat_elapsed_ticks:ticks-1,eat_profile:code,eat_hand:hand==='main_hand'?1:2,eat_projection:1};
 const owner={has_property:()=>true,property:n=>clear?0:n.endsWith('_piece')?176:n.endsWith('_0')?(changed?173:174):n.endsWith('_1')?180:184,
  is_item_name_any:(slot,...ids)=>slot===(hand==='main_hand'?'slot.weapon.mainhand':'slot.weapon.offhand')&&ids.includes(held)};
 const q={get is_using_item(){return using},main_hand_item_use_duration:0,frame_alpha:1,is_sneaking:0,is_swimming:0,is_gliding:0,is_riding:0,is_item_equipped:()=>0,
  property:n=>props[n.split(':')[1]],is_item_name_any:(slot,...ids)=>owner.is_item_name_any(slot,...ids)};
 const c={get is_first_person(){return first},item_slot:hand,owning_entity:owner},math={clamp:(n,a,b)=>Math.max(a,Math.min(b,n))};let v={};
 const update=()=>evaluatePreAnimation(d.scripts.pre_animation,q,c,math,v);
 const shaft=()=>Boolean(new Function('v','return '+controllers['controller.render.kg_secret_held.stick'].part_visibility[1].skewer_model)(v));
 const beginTerminal=()=>{v={};using=true;clear=false;held=d.identifier;first=1;changed=false;props.eat_hand=hand==='main_hand'?1:2;props.eat_native_ticks=ticks;props.eat_elapsed_ticks=ticks-1;q.main_hand_item_use_duration=0;update();};
 beginTerminal();if(v.kg_bite_stage!==3||v.kg_secret_terminal_seen!==1)throw Error('Terminal source stage missing');
 using=false;update();if(v.kg_bite_stage!==3||!v.kg_secret_terminal_wait||v.kg_secret_owner_occupied||shaft())throw Error('Local stop redrew terminal meal');
 for(let frame=0;frame<10;frame++){update();if(shaft()||v.kg_bite_stage!==3)throw Error('Pending terminal hold leaked');}
 // Reproduce the remaining one-frame hole: the local counter/use flag
 // restarts while the server still reports the just-finished terminal phase.
 using=true;q.main_hand_item_use_duration=ticks;update();
 if(!v.kg_secret_terminal_wait||v.kg_bite_stage!==3||shaft()||v.kg_secret_owner_occupied)throw Error('Unacknowledged local restart redrew the old serving');
 props.eat_elapsed_ticks=1;update();
 if(v.kg_secret_terminal_wait||v.kg_bite_stage!==0||!shaft())throw Error('Acknowledged fresh same-ID session remained hidden');
 // Acknowledgment can precede the local counter restart. Do not reacquire
 // terminal state from the new server phase plus the old local end clock.
 beginTerminal();props.eat_elapsed_ticks=1;update();
 if(v.kg_secret_terminal_seen)throw Error('Fresh server acknowledgment reacquired old terminal state');
 q.main_hand_item_use_duration=ticks;props.eat_elapsed_ticks=2;update();
 if(v.kg_secret_terminal_wait||!shaft())throw Error('Acknowledged session hidden after delayed local restart');
 beginTerminal();using=false;update();
 clear=true;props.eat_hand=0;props.eat_native_ticks=0;update();if(v.kg_secret_terminal_wait||shaft())throw Error('Authoritative empty did not settle');
 // Creative or a retained/new identical serving stays nonzero when the
 // authoritative phase clears. No new property or arbitrary timeout needed.
 clear=false;update();if(v.kg_secret_terminal_wait||!shaft()||v.kg_bite_stage!==0)throw Error('Retained/Creative/same-ID serving remained hidden');
 for(const reset of ['fresh-use','snapshot-change','owner-change','hand-change','phase-clear','third-person','fresh-instance']){
  beginTerminal();using=false;update();
  if(reset==='fresh-use'){using=true;q.main_hand_item_use_duration=ticks;props.eat_elapsed_ticks=1;}
  if(reset==='snapshot-change')changed=true;
  if(reset==='owner-change')held='minecraft:apple';
  if(reset==='hand-change')props.eat_hand=hand==='main_hand'?2:1;
  if(reset==='phase-clear')props.eat_native_ticks=0;
  if(reset==='third-person')first=0;
  if(reset==='fresh-instance')v={};
  update();if(v.kg_secret_terminal_wait)throw Error('Completion ownership survived '+reset);
  if(['fresh-use','snapshot-change','phase-clear','fresh-instance'].includes(reset)&&!shaft())throw Error('Fresh serving hidden '+reset);
 }
 // A pre-25-tick interruption has not reached terminal stage and must resume idle.
 beginTerminal();q.main_hand_item_use_duration=ticks-10;props.eat_elapsed_ticks=10;update();using=false;update();
 if(v.kg_secret_terminal_wait||v.kg_bite_stage!==0||!shaft())throw Error('Early interruption hid untouched serving');
}

// Alternate main/off draw contexts using one shared variable store. The
// inactive hand must not overwrite the active hand's retained terminal state.
for(const d of descriptions){
 let hand='main_hand',using=true;const code=d.identifier.endsWith('_java_three_alt')?4:3,ticks=code===4?90:100;
 const props={eat_hand:1,eat_profile:code,eat_native_ticks:ticks,eat_elapsed_ticks:ticks-1,eat_projection:1};
 const owner={has_property:()=>true,property:n=>n.endsWith('_piece')?176:n.endsWith('_0')?174:n.endsWith('_1')?180:184,is_item_name_any:()=>true};
 const q={get is_using_item(){return using},main_hand_item_use_duration:0,frame_alpha:1,is_sneaking:0,is_swimming:0,is_gliding:0,is_riding:0,is_item_equipped:()=>0,property:n=>props[n.split(':')[1]],is_item_name_any:()=>true};
 const c={is_first_person:1,get item_slot(){return hand},owning_entity:owner},v={},math={clamp:(n,a,b)=>Math.max(a,Math.min(b,n))};
 const update=()=>evaluatePreAnimation(d.scripts.pre_animation,q,c,math,v);
 update();hand='off_hand';update();using=false;hand='main_hand';update();
 if(!v.kg_secret_terminal_wait)throw Error('Offhand context erased main terminal state');
 hand='off_hand';update();if(v.kg_secret_terminal_wait||!v.kg_secret_owner_occupied)throw Error('Main terminal state hid idle offhand');
 hand='main_hand';update();if(!v.kg_secret_terminal_wait)throw Error('Main terminal state was not retained');
}
''')


if __name__ == '__main__':
    unittest.main()
