import assert from 'node:assert/strict';
import {
 POTATO_BEEF_STEW_ID,RED_SWEET_POTATO_PORRIDGE_ID,SOUR_SPICY_NOODLES_ID,
 TAVERN_VINEGAR_IDS,STOCKPOT_FOOD_IDS,STOCKPOT_FOODS,stockpotRecipes,stockpotEffectRows
} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a2752_stockpot_food_core.js';

let n=0;const t=(name,fn)=>{fn();n++;console.log('PASS',name)};

t('three Stockpot foods keep Java values',()=>{
 assert.deepEqual(STOCKPOT_FOOD_IDS,[POTATO_BEEF_STEW_ID,RED_SWEET_POTATO_PORRIDGE_ID,SOUR_SPICY_NOODLES_ID]);
 assert.deepEqual(STOCKPOT_FOODS[POTATO_BEEF_STEW_ID],{nutrition:12,saturation:0.9,maxStack:16});
 assert.deepEqual(STOCKPOT_FOODS[RED_SWEET_POTATO_PORRIDGE_ID],{nutrition:14,saturation:0.071429,maxStack:16});
 assert.deepEqual(STOCKPOT_FOODS[SOUR_SPICY_NOODLES_ID],{nutrition:10,saturation:0.6,maxStack:16});
});

t('exact and flex Stockpot rows are both retained',()=>{
 const rows=stockpotRecipes();
 assert.equal(rows.filter(x=>x.kind==='stockpot_exact').length,3);
 assert.equal(rows.filter(x=>x.kind==='stockpot_flex').length,3);
 for(const row of rows){assert.equal(row.base,'minecraft:water');assert.equal(row.carrier,'minecraft:bowl');assert.equal(row.time,300)}
});

t('potato beef stew maps stable Grilling ingredients',()=>{
 const rows=stockpotRecipes().filter(x=>x.result===POTATO_BEEF_STEW_ID);
 assert.deepEqual(rows[0].ingredients,[
  ['kaleidoscope_grilling:beef_chunks'],['kaleidoscope_grilling:beef_chunks'],['minecraft:potato'],
  ['kaleidoscope_grilling:carrot_dice'],['kaleidoscope_grilling:onion']
 ]);
 assert.deepEqual(rows[1].ingredients,[
  ['kaleidoscope_grilling:beef_chunks'],['minecraft:potato'],['kaleidoscope_grilling:carrot_dice'],['kaleidoscope_grilling:onion']
 ]);
});

t('red sweet potato porridge exact and flex counts are preserved',()=>{
 const rows=stockpotRecipes().filter(x=>x.result===RED_SWEET_POTATO_PORRIDGE_ID);
 assert.equal(rows[0].ingredients.length,6);assert.equal(rows[1].ingredients.length,2);
 assert.equal(rows[0].ingredients.filter(x=>x[0]==='kaleidoscope_grilling:sweet_potato').length,3);
 assert.equal(rows[0].ingredients.filter(x=>x[0]==='kaleidoscope_cookery:rice').length,3);
});

t('Tavern vinegar uses all six Bedrock quality IDs as one ingredient alternative slot',()=>{
 assert.equal(TAVERN_VINEGAR_IDS.length,6);
 const rows=stockpotRecipes().filter(x=>x.result===SOUR_SPICY_NOODLES_ID);
 for(const row of rows){
  assert.deepEqual(row.ingredients[0],TAVERN_VINEGAR_IDS);
  assert.deepEqual(row.requiresItems,TAVERN_VINEGAR_IDS);
 }
});

t('Java food effects keep exact durations',()=>{
 const map=Object.fromEntries(stockpotEffectRows().map(x=>[x.itemId,x.effects]));
 assert.deepEqual(map[RED_SWEET_POTATO_PORRIDGE_ID].map(x=>[x.effect,x.ticks]),[['flatulence',900],['warmth',900]]);
 assert.deepEqual(map[SOUR_SPICY_NOODLES_ID].map(x=>[x.effect,x.ticks]),[['warmth',900]]);
});

console.log('A2.7.52 Stockpot Cuisine core: '+n+'/'+n);
