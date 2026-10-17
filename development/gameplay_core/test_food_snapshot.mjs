import test from 'node:test';import assert from 'node:assert/strict';
import {foodFacts,ingredientFoodFacts} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/food_snapshot_core.js';
import {secretFood} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a24_skewering_core.js';
import {ingredientBehavior} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a285_ingredient_effects.js';
import {VANILLA_FOOD_NUTRITION as facts} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/vanilla_food_nutrition.js';
for(const [id,expected] of Object.entries(facts))test('vanilla food without native component '+id,()=>assert.deepEqual(foodFacts({typeId:id,getComponent:()=>undefined}),{...expected,edible:true}));
test('real data-driven component overrides fallback',()=>assert.deepEqual(foodFacts({typeId:'minecraft:apple',getComponent:()=>({nutrition:0,saturationModifier:0,usingConvertsTo:'test:container'})}),{nutrition:0,saturation:0,convertTo:'test:container',edible:true}));
test('food tag alone does not invent unknown nutrition',()=>assert.equal(foodFacts({typeId:'test:food',getTags:()=>['minecraft:is_food'],getComponent:()=>undefined}).edible,false));
test('old zero-nutrition vanilla snapshots are repaired at evaluation',()=>{const old={id:'minecraft:potato',edible:false,nutrition:0,saturation:0};assert.equal(ingredientFoodFacts(old).nutrition,1);assert.equal(ingredientFoodFacts(old).edible,true);assert.equal(old.nutrition,0);assert.equal(secretFood([old,{id:'minecraft:beef',edible:false,nutrition:0}],true).nutrition,2)});
test('old honey snapshot inherits its actual bottle remainder',()=>{const out=ingredientBehavior({id:'minecraft:honey_bottle',edible:false,nutrition:0});assert.equal(out.convertTo,'minecraft:glass_bottle');assert.equal(out.clearPoison,true)});
test('explicit edible zero-nutrition component is not overwritten',()=>{const row={id:'minecraft:apple',edible:true,nutrition:0,saturation:0};assert.equal(ingredientFoodFacts(row),row)});
test('ID-only saved vanilla food recovers missing nutrition and its container without changing saved zero',()=>{
 const row={id:'minecraft:honey_bottle'},before=structuredClone(row),out=ingredientFoodFacts(row);
 assert.equal(out.nutrition,6);assert.equal(out.convertTo,'minecraft:glass_bottle');assert.deepEqual(row,before);
 const partial=ingredientFoodFacts({id:'minecraft:apple',edible:true,nutrition:0});assert.equal(partial.nutrition,0);assert.equal(partial.saturation,.3);
 assert.equal(secretFood(['minecraft:apple','minecraft:carrot','minecraft:beef'].map(id=>({id})),true).nutrition,6);
});
test('native smoker outputs have nonzero food values',()=>{for(const id of ['minecraft:cooked_beef','minecraft:cooked_chicken','minecraft:cooked_porkchop','minecraft:cooked_salmon','minecraft:cooked_rabbit','minecraft:baked_potato','minecraft:dried_kelp'])assert.ok(facts[id].nutrition>0,id)});
