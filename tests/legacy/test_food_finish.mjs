import test from 'node:test';import assert from 'node:assert/strict';

import {createFixture} from '../helpers/minecraft-fixture.mjs';
import {finishedFoodMeta} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/food_finish_core.js';
import {eatingProfile} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/player_presentation_core.js';
test('hot dishes crossing the completion boundary lose hot seasoning/saturation eligibility',()=>{
 const started={hot:true,hotUntil:100,seasonings:['salt'],origin:'wok'};
 assert.equal(finishedFoodMeta(started,99).hot,true);
 for(const finish of [100,101,190])assert.equal(finishedFoodMeta(started,finish).hot,false);
 assert.deepEqual(started,{hot:true,hotUntil:100,seasonings:['salt'],origin:'wok'});
 assert.deepEqual(finishedFoodMeta(started,101).seasonings,['salt']);
});
test('cold food never reacquires heat from a stale stored timestamp',()=>assert.equal(finishedFoodMeta({hot:false,hotUntil:300},50).hot,false));
test('both random branches select one shared curve, checkpoint duration and code',()=>{
 assert.deepEqual(eatingProfile('THREE_RANDOM',0),{profile:'THREE',code:3,duration:100});
 assert.deepEqual(eatingProfile('THREE_RANDOM',.4999),{profile:'THREE',code:3,duration:100});
 assert.deepEqual(eatingProfile('THREE_RANDOM',.5),{profile:'THREE_ALT',code:4,duration:90});
 assert.deepEqual(eatingProfile('THREE_RANDOM',.999),{profile:'THREE_ALT',code:4,duration:90});
 assert.throws(()=>eatingProfile('BAD'));
});

// Native subscribers take the start snapshots, run every intervening runtime
// tick, and settle the hot-food reward only on the matching completion event.
async function hotFoodFixture(t,id='kaleidoscope_grilling:grilled_bun_slice_skewer'){
 const f=createFixture({currentTick:1000});t.after(()=>f.dispose());await f.load('main.js');
 const data=await f.load('itemData.js'),state=await f.load('effect_state_runtime.js');
 const stack=f.item(id);data.setItemProperty(stack,'kaleidoscope_grilling:hot_until',5000);
 const player=f.player({main:stack});
 return {f,player,state,start(){f.emit('world.afterEvents.itemStartUse',{source:player,itemStack:stack.clone(),useDuration:90});},
  finish(){player.main=undefined;f.emit('world.afterEvents.itemCompleteUse',{source:player,itemStack:stack.clone(),useDuration:0});}};
}
test('hot completion compares custom and native effects against their start durations',async t=>{
 const {f,player,state,start,finish}=await hotFoodFixture(t);
 state.writeEffects(player,{warmth:{until:1800,amp:2},unchanged:{until:2000,amp:0},invincible:{until:1200,amp:1}});
 player.addEffect('strength',800,{amplifier:2});start();f.tick(90);
 state.writeEffects(player,{warmth:{until:1990,amp:2},unchanged:{until:2000,amp:0},invincible:{until:1290,amp:1},vigor:{until:1690,amp:0}});
 player.addEffect('strength',900,{amplifier:2});finish();
 const fx=state.readEffects(player);
 assert.equal(player.getEffect('strength').duration,1000);assert.equal(player.getEffect('strength').amplifier,2);
 assert.equal(fx.warmth.until-f.world.getAbsoluteTime(),1000);assert.equal(fx.warmth.amp,2);
 assert.equal(fx.unchanged.until,2000);assert.equal(fx.invincible.until,1290);
 assert.equal(fx.vigor.until-f.world.getAbsoluteTime(),1200);
});
test('an effect expiring during eating retains its original start-duration comparison',async t=>{
 const {f,player,state,start,finish}=await hotFoodFixture(t,'kaleidoscope_grilling:grilled_lamb_skewer_java_three_alt');
 state.writeEffects(player,{warmth:{until:1040,amp:0}});start();f.tick(90);
 assert.equal(state.readEffects(player).warmth,undefined,'the original effect really expired during scheduled runtime ticks');
 finish();
 assert.equal(state.readEffects(player).warmth.until-f.world.getAbsoluteTime(),1760);
 assert.equal(state.readEffects(player).warmth.amp,0);
});
