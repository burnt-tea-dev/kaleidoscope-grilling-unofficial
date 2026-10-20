/** Pure recipe planning tests; no native client acceptance claim. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {bookIngredientSlots,planInventoryConsumption,selectorMatches} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a25_plate_recipe_core.js';
import {recipeTable,SECRET_ID} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a24_skewering_core.js';
const N='kaleidoscope_grilling:';
for(const recipe of recipeTable()){
 test('canonical book '+recipe.id,()=>{
  const slots=bookIngredientSlots({resultId:recipe.id});
  const inventory=recipe.slots.map(s=>({id:s[0],count:1}));
  assert.equal(planInventoryConsumption(inventory,slots).ok,true);
 });
 const slots=bookIngredientSlots({resultId:recipe.id});
 if(slots.some(s=>s.some(x=>x.startsWith('#'))))test('tag substitute book '+recipe.id,()=>{
  const inventory=slots.map((s,i)=>{const tag=s.find(x=>x.startsWith('#'));return tag?{id:'example:ingredient_'+i,count:1,tags:[tag.slice(1)]}:{id:s[0],count:1}});
  assert.equal(planInventoryConsumption(inventory,slots).ok,true);
  const tagged=inventory.find(s=>s.tags);tagged.tags=['example:wrong'];
  assert.deepEqual(planInventoryConsumption(inventory,slots).plan,[]);
  assert.equal(planInventoryConsumption(inventory,slots).ok,false);
 });
}
test('tag matching preserves old ID calls and rejects missing tags',()=>{
 assert.equal(selectorMatches('minecraft:apple','minecraft:apple'),true);
 assert.equal(selectorMatches({id:'x:y'},'#x:t'),false);
 assert.equal(selectorMatches({id:'x:y',tags:['x:t']},'#x:t'),true);
 assert.equal(selectorMatches({id:'x:y',tags:'x:t'},'#x:t'),false);
});
test('duplicate tagged ingredients reserve total stack count and honor excluded slot',()=>{
 const slots=[['#x:wing'],['#x:wing'],['minecraft:carrot']];
 const rows=[{id:'example:wing',count:2,tags:['x:wing']},{id:'minecraft:carrot',count:1}];
 assert.deepEqual(planInventoryConsumption(rows,slots),{ok:true,plan:[{slot:0,count:2},{slot:1,count:1}]});
 assert.equal(planInventoryConsumption(rows,slots,[0]).ok,false);
 rows[0].count=1;assert.equal(planInventoryConsumption(rows,slots).ok,false);assert.deepEqual(planInventoryConsumption(rows,slots).plan,[]);
});
test('secret recipes remain exact-ID even for tagged substitutes',()=>{
 const slots=bookIngredientSlots({resultId:SECRET_ID,customIngredients:[N+'chicken_wing','minecraft:apple','minecraft:carrot']});
 const rows=[{id:'example:wing',count:2,tags:[N+'ingredients/chicken_wings']},{id:'minecraft:apple',count:1},{id:'minecraft:carrot',count:1}];
 assert.equal(planInventoryConsumption(rows,slots).ok,false);
 assert.equal(bookIngredientSlots({resultId:SECRET_ID,customIngredients:['#x:wing','minecraft:apple','minecraft:carrot']}),null);
});
