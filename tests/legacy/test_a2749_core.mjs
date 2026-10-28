import assert from 'node:assert/strict';
import {
 SUGARED_TOMATO_ID,PEPPER_HONEY_ID,PEPPER_HONEY_NUMB_TICKS,
 A2749_FOODS,pepperHoneyEffectRow,a2749FoodSpec
} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/food/sugared_tomato_pepper_honey_core.js';

assert.equal(SUGARED_TOMATO_ID,'kaleidoscope_grilling:sugared_tomato');
assert.equal(PEPPER_HONEY_ID,'kaleidoscope_grilling:pepper_honey');
assert.equal(PEPPER_HONEY_NUMB_TICKS,1200);
assert.deepEqual(a2749FoodSpec(SUGARED_TOMATO_ID),{nutrition:6,saturation:0.65,maxStack:64});
assert.deepEqual(a2749FoodSpec(PEPPER_HONEY_ID),{nutrition:4,saturation:0.25,maxStack:64});
assert.equal(Object.keys(A2749_FOODS).length,2);
assert.deepEqual(pepperHoneyEffectRow(),{
 itemId:PEPPER_HONEY_ID,
 effects:[{kind:'persistent_fx',effect:'numb',ticks:1200,amplifier:0,stacking:'max_until'}]
});
assert.equal(Object.isFrozen(pepperHoneyEffectRow()),true);
console.log('A2.7.49 Sugared Tomato + Pepper Honey core: PASS');
