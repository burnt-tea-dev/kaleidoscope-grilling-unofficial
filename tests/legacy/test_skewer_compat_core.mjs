import assert from 'node:assert/strict';
import {
 SKEWERABLE_TAG,UNSKEWERABLE_TAG,RAW_SKEWER_TAG,
 registerSkewerIngredientRule,registerSkewerCookingRule,registerSkewerCompatBundle,
 skewerIngredientDecision,customSkewerCookedId,isCompatRawSkewer,resetSkewerCompatRegistry
} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/skewer_compat_core.js';

resetSkewerCompatRegistry();
assert.equal(skewerIngredientDecision({id:'example:food',tags:[SKEWERABLE_TAG]}),'allow');
assert.equal(skewerIngredientDecision({id:'example:food',tags:[UNSKEWERABLE_TAG,SKEWERABLE_TAG]}),'deny');
assert(registerSkewerIngredientRule({input:'example:metal',decision:'allow'}));
assert.equal(skewerIngredientDecision({id:'example:metal',tags:[]}),'allow');
assert(registerSkewerIngredientRule({tag:'example:ban',decision:'deny'}));
assert.equal(skewerIngredientDecision({id:'example:food',tags:['example:ban']}),'deny');
assert(registerSkewerCookingRule({input:'example:raw_skewer',output:'example:grilled_skewer'}));
assert.equal(customSkewerCookedId('example:raw_skewer'),'example:grilled_skewer');
assert.equal(isCompatRawSkewer({id:'example:raw_skewer',tags:[]}),true);
assert.equal(isCompatRawSkewer({id:'example:tagged_raw',tags:[RAW_SKEWER_TAG]}),true);
assert.deepEqual(registerSkewerCompatBundle({
 ingredientRules:[{tag:'example:allow',decision:'allow'}],
 cooking:[{input:'example:raw2',output:'example:cooked2'}]
}),{ingredientRules:1,cooking:1});
assert.equal(skewerIngredientDecision({id:'x:y',tags:['example:allow']}),'allow');
assert.equal(customSkewerCookedId('example:raw2'),'example:cooked2');
assert.equal(registerSkewerCookingRule({input:'bad id',output:'example:x'}),false);
console.log('SkewerCompat declarative item/tag/cooking registry: PASS');
