import assert from 'node:assert/strict';
import {recipeTable,recipesForReady} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/recipe/cookery_host_recipes_core.js';
import {TAVERN_VINEGAR_IDS} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/food/stockpot_food_core.js';

const rows=recipeTable();
const stock=rows.filter(x=>['stockpot_exact','stockpot_flex'].includes(x.capability));
assert.equal(stock.filter(x=>x.capability==='stockpot_exact').length,3);
assert.equal(stock.filter(x=>x.capability==='stockpot_flex').length,3);
const conditional=stock.filter(x=>x.requiresItems.length>0);
assert.equal(conditional.length,2);
for(const row of conditional)assert.deepEqual(row.requiresItems,TAVERN_VINEGAR_IDS);

const info={api:1,capabilities:['stockpot_exact','stockpot_flex']};
const withoutTavern=recipesForReady(info);
assert.equal(withoutTavern.length,4);
assert.equal(withoutTavern.some(x=>x.recipe?.result==='kaleidoscope_grilling:sour_spicy_noodles'),false);

const withTavern=recipesForReady(info,{availableItems:TAVERN_VINEGAR_IDS});
assert.equal(withTavern.length,6);
assert.equal(withTavern.filter(x=>x.recipe?.result==='kaleidoscope_grilling:sour_spicy_noodles').length,2);
const sour=withTavern.find(x=>x.recipe?.result==='kaleidoscope_grilling:sour_spicy_noodles');
assert.deepEqual(sour.recipe.ingredients[0],TAVERN_VINEGAR_IDS);

console.log('A2.7.52 host recipe condition core: PASS');
