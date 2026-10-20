import test from 'node:test';import assert from 'node:assert/strict';
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
