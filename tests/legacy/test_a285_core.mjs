import assert from 'node:assert/strict';
import test from 'node:test';
import {createFixture} from '../helpers/minecraft-fixture.mjs';
import {commitEating,captureEatingIdentity,eatingStillCurrent} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/core/eating_transaction.js';
import {ingredientBehavior,rolledIngredientEffects} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/effect/ingredient_effects.js';
import {overlappedBlockPositions} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/effect/contact_core.js';
import {secretFood} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/skewer/skewering_core.js';
import {rackSlotAtHit} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/rack/rack_quick_pick.js';

// Fault-injected storage transaction: reward must never survive a failed debit/write.
for(const failure of ['debit','reward',null]){
 let food=2,hunger=10,rewards=0;
 const ok=commitEating({debit(){if(failure==='debit')throw Error('unavailable');food--},reward(){rewards++;hunger=14;if(failure==='reward')throw Error('write failed')},restoreFood(){food=2},restoreNutrition(){hunger=10}});
 assert.equal(ok,!failure);assert.equal(food,failure?2:1);assert.equal(hunger,failure?10:14);
 if(failure==='debit')assert.equal(rewards,0);
}
function item({lore=['§c🔥 1:00'],ingredients='apple',amount=2}={}){
 return {typeId:'kaleidoscope_grilling:secret_skewer',amount,nameTag:'',getLore:()=>lore,getDynamicPropertyIds:()=>['ingredients'],getDynamicProperty:()=>ingredients};
}
const use=captureEatingIdentity(item(),'main',3);
assert(eatingStillCurrent(use,item({lore:['§c🔥 0:59']}),3));
assert(!eatingStillCurrent(use,item(),4));
assert(!eatingStillCurrent(use,item({ingredients:'poison'}),3));
assert(!eatingStillCurrent(use,item({amount:1}),3));
assert(!eatingStillCurrent(use,null,3));

const food=id=>({id,edible:true,nutrition:1});
assert.deepEqual(ingredientBehavior(food('minecraft:golden_apple')).effects.map(x=>x.effect),['regeneration','absorption']);
assert.equal(rolledIngredientEffects(food('minecraft:poisonous_potato'),()=>.59).effects.length,1);
assert.equal(rolledIngredientEffects(food('minecraft:poisonous_potato'),()=>.61).effects.length,0);
assert.equal(ingredientBehavior(food('minecraft:mushroom_stew')).convertTo,'minecraft:bowl');
assert.equal(ingredientBehavior(food('minecraft:honey_bottle')).clearPoison,true);
assert.equal(ingredientBehavior(food('minecraft:chorus_fruit')).teleport,true);
assert.equal(ingredientBehavior(food('kaleidoscope_grilling:cold_houttuynia')).effects[0].effect,'fire_resistance');
assert.equal(ingredientBehavior(food('kaleidoscope_grilling:grilled_beef_skewer')).effects[0].effect,'strength');
assert.equal(ingredientBehavior({id:'minecraft:golden_apple',edible:false}).effects.length,0);
assert.deepEqual(ingredientBehavior(food('unknown:custom_food')).effects,[]);
assert(ingredientBehavior(food('minecraft:enchanted_golden_apple')).effects.length>=4);
const cooked=[{id:'cooked',nutrition:6,saturation:.5},{id:'cooked',nutrition:6,saturation:.5}];
assert.equal(secretFood(cooked,true,[{id:'raw_a'},{id:'raw_b'}]).duplicate,false);
assert.equal(secretFood(cooked,true,[{id:'raw_a'},{id:'raw_a'}]).duplicate,true);

// Body crosses into leaves at x=1 even while its feet stay in x=0.
const blocks=overlappedBlockPositions({center:{x:.9,y:1,z:.5},extent:{x:.3,y:.9,z:.3}});
assert(blocks.some(p=>p.x===1));assert(blocks.some(p=>p.y===1));
assert.deepEqual(overlappedBlockPositions({center:{x:.5,y:.5,z:.5},extent:{x:.5,y:.5,z:.5}}),[{x:0,y:0,z:0}]);
assert.equal(rackSlotAtHit('north',{x:.1,y:.8,z:.8}),0);
assert.equal(rackSlotAtHit('north',{x:.9,y:.8,z:.8}),4);
assert.equal(rackSlotAtHit('south',{x:.9,y:.8,z:.2}),0);
assert.equal(rackSlotAtHit('west',{x:.2,y:.8,z:.9}),0);
assert.equal(rackSlotAtHit('east',{x:.8,y:.8,z:.1}),0);
assert.equal(rackSlotAtHit('north',{x:.9,y:.4,z:.8}),8);
console.log('A285 transaction failures, eating identity, ingredient effects and leaf contact: PASS (pure logic; no client/player simulation)');

// Official Minecraft Java 1.21.1 Foods.ENCHANTED_GOLDEN_APPLE, mapped from
// cps.<clinit> offsets 457-468 in client SHA-1 30c73b1c5da787909b2f73340419fdf13b9def88.
// SecretSkewerItem @9a1acdab replays edible ingredients' finishUsingItem effects.
const enchantedAppleEffects=[['regeneration',400,1],['absorption',2400,3],['resistance',6000,0],['fire_resistance',6000,0]];
test('enchanted apple ingredient effects follow Java durations for both supported identifiers',()=>{
 for(const id of ['minecraft:enchanted_golden_apple','minecraft:appleEnchanted']){
  const effects=rolledIngredientEffects(food(id),()=>0).effects;
  assert.deepEqual(effects.map(e=>[e.effect,e.ticks,e.amplifier]),enchantedAppleEffects);
 }
 assert.deepEqual(rolledIngredientEffects(food('minecraft:golden_apple'),()=>0).effects.map(e=>[e.effect,e.ticks,e.amplifier]),[['regeneration',100,1],['absorption',2400,0]]);
});
for(const hand of ['main','off'])test(`Secret completion applies Java enchanted-apple effects once from ${hand} hand`,async t=>{
 const f=createFixture();t.after(()=>f.dispose());await f.load('main.js');
 const data=await f.load('core/persist.js');
 const stack=f.item('kaleidoscope_grilling:secret_skewer_java_three_alt');
 const rows=[{id:'minecraft:enchanted_golden_apple',edible:true,nutrition:4,saturation:1.2},
  {id:'minecraft:carrot',edible:true,nutrition:3,saturation:.6},
  {id:'minecraft:potato',edible:true,nutrition:1,saturation:.3}];
 const key='kaleidoscope_grilling:skewer_ingredients',saved=JSON.stringify(rows);
 data.setItemProperty(stack,key,saved);
 const p=f.player({[hand]:stack});
 f.emit('world.afterEvents.itemStartUse',{source:p,itemStack:stack.clone(),useDuration:90});f.tick(90);
 p[hand]=undefined; // Explicit API input: the engine consumed the single serving.
 const complete=()=>f.emit('world.afterEvents.itemCompleteUse',{source:p,itemStack:stack.clone(),useDuration:0});
 complete();
 const effects=()=>f.effects.filter(e=>e.source===p).map(e=>[e.effect,e.duration,e.options.amplifier]);
 assert.deepEqual(effects(),enchantedAppleEffects);
 complete();assert.deepEqual(effects(),enchantedAppleEffects,'duplicate completion must not grant another effect batch');
 assert.equal(data.getItemProperty(stack,key),saved);assert.equal(p[hand],undefined);
});
