/** Actual production award adapter with API fault doubles, not native/player acceptance. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {MOUNTAIN_FRAGRANCE,advancementAwardPlan} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a2753_advancement_core.js';
import {advancementFrameTranslationKeys} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a2758_advancement_challenge_core.js';
const source=fs.readFileSync(new URL('../../projects/grilling/gameplay_core/behavior_pack/scripts/a2753_advancement_runtime.js',import.meta.url),'utf8');
const body=source.replace(/^import[\s\S]*?;\n/gm,'').replaceAll('export ','');
function load(){const context={MOUNTAIN_FRAGRANCE,advancementAwardPlan,advancementFrameTranslationKeys,world:{sendMessage(){}}};vm.runInNewContext(body,context);return context.awardMountainFragrance;}
function fixture(initial){
 const state={value:initial,xp:0,xpCalls:0,commands:0,announcements:0,reads:0,writes:0,readFault:false,claimFault:'',completionFault:'',xpFault:'',events:[]};
 const carrier={name:'fixture',getDynamicProperty(key){assert.equal(key,MOUNTAIN_FRAGRANCE.propertyKey);state.reads++;if(state.readFault)throw Error('Unreadable claim');return state.value;},setDynamicProperty(key,value){assert.equal(key,MOUNTAIN_FRAGRANCE.propertyKey);state.writes++;const fault=value===true?state.completionFault:state.claimFault;state.events.push(value===true?'complete':'claim');if(fault==='before')throw Error('Write rejected');state.value=value;if(fault==='after')throw Error('Applied write then failure');if(fault==='readback')state.readFault=true;},addExperience(amount){state.xpCalls++;state.events.push('xp');assert.equal(JSON.parse(state.value).state,'pending','XP requires acknowledged prior ownership');if(state.onXp)state.onXp();if(state.xpFault==='before')throw Error('XP rejected');state.xp+=amount;if(state.xpFault==='after')throw Error('XP applied then failure');},runCommand(){state.commands++;throw Error('Unknown XP must never trigger a command fallback');},sendMessage(){state.announcements++;}};
 return {state,carrier,award:load(),reload:()=>load()(carrier)};
}
test('25 XP follows persisted ownership once and preserves legacy completion',()=>{
 const f=fixture();assert.equal(f.award(f.carrier),true);assert.deepEqual(f.state.events,['claim','xp','complete']);assert.equal(f.state.xp,25);assert.equal(f.state.value,true);assert.equal(f.state.announcements,1);assert.equal(f.reload(),false);assert.equal(f.state.xpCalls,1);
 const legacy=fixture(true);assert.equal(legacy.award(legacy.carrier),false);assert.equal(legacy.state.xpCalls,0);assert.equal(legacy.state.writes,0);
 const reset=fixture(false);assert.equal(reset.award(reset.carrier),true);assert.equal(reset.state.xp,25);
});
test('unreadable and unknown saved fields cannot authorize a fresh reward',()=>{
 const f=fixture();f.state.readFault=true;assert.equal(f.award(f.carrier),false);assert.equal(f.state.xpCalls,0);assert.equal(f.state.writes,0);
 const unknown=fixture('{"version":2,"state":"pending"}');assert.equal(unknown.award(unknown.carrier),false);assert.equal(unknown.state.xpCalls,0);assert.equal(unknown.state.writes,0);
});
test('a rejected claim gives no XP and can retry; applied-then-thrown claim needs exact readback',()=>{
 const f=fixture();f.state.claimFault='before';assert.equal(f.award(f.carrier),false);assert.equal(f.state.xpCalls,0);assert.equal(f.state.value,undefined);f.state.claimFault='';assert.equal(f.reload(),true);assert.equal(f.state.xp,25);
 const applied=fixture();applied.state.claimFault='after';assert.equal(applied.award(applied.carrier),true);assert.equal(applied.state.xp,25);assert.equal(applied.state.value,true);
});
test('unknown claim readback does not issue XP or automatically replay across reload',()=>{
 const f=fixture();f.state.claimFault='readback';assert.equal(f.award(f.carrier),false);assert.equal(f.state.xpCalls,0);f.state.readFault=false;f.state.claimFault='';assert.equal(f.reload(),false);assert.equal(f.state.xpCalls,0);assert.equal(JSON.parse(f.state.value).state,'pending');
});
test('XP failures before or after mutation keep a pending claim with no command fallback or replay',()=>{
 for(const phase of ['before','after']){const f=fixture();f.state.xpFault=phase;assert.equal(f.award(f.carrier),false);assert.equal(f.state.xp,phase==='after'?25:0);assert.equal(f.state.commands,0);assert.equal(f.state.announcements,0);assert.equal(JSON.parse(f.state.value).state,'pending');f.state.xpFault='';assert.equal(f.reload(),false);assert.equal(f.state.xpCalls,1);}
});
test('failed completion cannot duplicate paid XP; applied completion is acknowledged by readback',()=>{
 const f=fixture();f.state.completionFault='before';assert.equal(f.award(f.carrier),false);assert.equal(f.state.xp,25);assert.equal(JSON.parse(f.state.value).state,'pending');f.state.completionFault='';assert.equal(f.reload(),false);assert.equal(f.state.xpCalls,1);assert.equal(f.state.announcements,0);
 const applied=fixture();applied.state.completionFault='after';assert.equal(applied.award(applied.carrier),true);assert.equal(applied.state.value,true);assert.equal(applied.state.xp,25);assert.equal(applied.reload(),false);
});
test('a changed claim is not overwritten after native XP returns',()=>{
 const f=fixture();f.state.onXp=()=>f.state.value='external change';assert.equal(f.award(f.carrier),false);assert.equal(f.state.value,'external change');assert.equal(f.state.writes,1);assert.equal(f.state.xp,25);assert.equal(f.reload(),false);assert.equal(f.state.xpCalls,1);
});
test('a nested trigger observes the pending claim and cannot issue a second award',()=>{
 const f=fixture();f.state.onXp=()=>assert.equal(f.reload(),false);assert.equal(f.award(f.carrier),true);assert.equal(f.state.xpCalls,1);assert.equal(f.state.xp,25);
});
