import assert from 'node:assert/strict';
import {
 DEFAULT_SECRET_SMOKING_ITEMS,registerSecretSmoking,resolveSecretSmokedId,
 registerSecretIngredientBehavior,registerSecretCompatBundle,secretCompatSnapshot,resetSecretCompatRegistry
} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/secret_compat_core.js';
import {ingredientBehavior} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a285_ingredient_effects.js';

resetSecretCompatRegistry();
assert.equal(resolveSecretSmokedId('minecraft:beef'),'minecraft:cooked_beef');
assert.equal(resolveSecretSmokedId('kaleidoscope_grilling:chicken_wing'),'kaleidoscope_grilling:roasted_chicken_wing');
assert.equal(resolveSecretSmokedId({id:'other:wing',tags:['kaleidoscope_grilling:ingredients/chicken_wings']}),'kaleidoscope_grilling:roasted_chicken_wing');
assert.equal(Object.keys(DEFAULT_SECRET_SMOKING_ITEMS).length,11);

assert(registerSecretSmoking({input:'example:raw_fish',output:'example:smoked_fish'}));
assert.equal(resolveSecretSmokedId({id:'example:raw_fish'}),'example:smoked_fish');
assert(registerSecretSmoking({tag:'example:smokable',output:'example:smoked_generic'}));
assert.equal(resolveSecretSmokedId({id:'example:root',tags:['example:smokable']}),'example:smoked_generic');
assert.equal(registerSecretSmoking({input:'bad id',output:'example:ok'}),false);
assert.equal(registerSecretSmoking({input:'example:x',tag:'example:y',output:'example:z'}),false);

assert(registerSecretIngredientBehavior({
 input:'example:berry',
 behavior:{effects:[{effect:'speed',ticks:200,amplifier:1,chance:.5}],remainder:{id:'minecraft:bowl'},clearPoison:true}
}));
let behavior=ingredientBehavior({id:'example:berry',edible:true,nutrition:2});
assert.equal(behavior.effects.at(-1).effect,'speed');
assert.equal(behavior.effects.at(-1).chance,.5);
assert.equal(behavior.remainder.id,'minecraft:bowl');
assert.equal(behavior.clearPoison,true);

assert(registerSecretIngredientBehavior({
 tag:'example:magic_food',
 behavior:{mode:'replace',effects:[{kind:'persistent_fx',effect:'warmth',ticks:400}],convertTo:'minecraft:glass_bottle'}
}));
behavior=ingredientBehavior({id:'example:tonic',tags:['example:magic_food'],edible:true,nutrition:1});
assert.deepEqual(behavior.effects.map(x=>x.effect),['warmth']);
assert.equal(behavior.convertTo,'minecraft:glass_bottle');
assert.equal(behavior.remainder.id,'minecraft:glass_bottle');

const bundle=registerSecretCompatBundle({
 smoking:[{input:'example:raw_meat',output:'example:cooked_meat'}],
 behaviors:[{input:'example:cooked_meat',behavior:{effects:[{effect:'strength',ticks:100}]}}]
});
assert.deepEqual(bundle,{smoking:1,behaviors:1});
assert.equal(resolveSecretSmokedId('example:raw_meat'),'example:cooked_meat');
assert(secretCompatSnapshot().behaviorItems.includes('example:cooked_meat'));

resetSecretCompatRegistry();
assert.equal(resolveSecretSmokedId('example:raw_meat'),'');
assert.equal(resolveSecretSmokedId('minecraft:beef'),'minecraft:cooked_beef');
assert.deepEqual(ingredientBehavior({id:'unknown:custom_food',edible:true,nutrition:1}).effects,[]);
console.log('Secret-skewer smoking/finish-use compatibility registry: PASS');
