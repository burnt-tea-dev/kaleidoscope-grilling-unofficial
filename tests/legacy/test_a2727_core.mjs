import assert from 'node:assert/strict';
import {
 KC_API,KC_READY_EVENT,KC_PING_EVENT,KC_REGISTER_EVENT,SOURCE,
 recipeTable,recipesForReady
} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a2727_cookery_host_recipes_core.js';

let n=0;const t=(name,fn)=>{fn();n++;console.log('PASS',name)};

t('Cookery host API constants stay centralized and exact',()=>{
 assert.equal(KC_API,1);
 assert.equal(KC_READY_EVENT,'kaleidoscope_cookery:api_ready');
 assert.equal(KC_PING_EVENT,'kaleidoscope_cookery:api_ping');
 assert.equal(KC_REGISTER_EVENT,'kaleidoscope_cookery:register_recipe');
 assert.equal(SOURCE,'kaleidoscope_grilling');
});

t('registry exposes distinct recipes for every supported station capability',()=>{
 const rows=recipeTable();
 assert.equal(rows.length,23);
 assert.equal(rows.filter(x=>x.capability==='chopping_board').length,5);
 assert.equal(rows.filter(x=>x.capability==='millstone').length,7);
 assert.equal(rows.filter(x=>x.capability==='chopping_board_v2').length,2);
 for(const capability of ['wok','stockpot_exact','stockpot_flex'])assert.equal(rows.filter(x=>x.capability===capability).length,3);
 assert.equal(new Set(rows.map(x=>x.payload.recipe.id)).size,23);
});

t('historical recipe payloads are preserved',()=>{
 const byId=Object.fromEntries(recipeTable().map(x=>[x.payload.recipe.id,x.payload.recipe]));
 assert.deepEqual(byId['kaleidoscope_grilling:chopping_board/raw_sweet_potato_sheet'],{
  id:'kaleidoscope_grilling:chopping_board/raw_sweet_potato_sheet',
  input:'kaleidoscope_grilling:sweet_potato_powder',
  result:'kaleidoscope_grilling:raw_sweet_potato_sheet',count:1,cuts:4
 });
 assert.deepEqual(byId['kaleidoscope_grilling:chopping_board/carrot_dice'],{
  id:'kaleidoscope_grilling:chopping_board/carrot_dice',
  input:'minecraft:carrot',result:'kaleidoscope_grilling:carrot_dice',count:3,cuts:4
 });
 assert.deepEqual(byId['kaleidoscope_grilling:chopping_board/potato_slice'],{
  id:'kaleidoscope_grilling:chopping_board/potato_slice',
  input:'minecraft:potato',result:'kaleidoscope_grilling:potato_slice',count:3,cuts:4
 });
 assert.deepEqual(byId['kaleidoscope_grilling:chopping_board/raw_mantou_slice'],{
  id:'kaleidoscope_grilling:chopping_board/raw_mantou_slice',
  input:'kaleidoscope_cookery:mantou',result:'kaleidoscope_grilling:raw_mantou_slice',count:3,cuts:4
 });
 assert.deepEqual(byId['kaleidoscope_grilling:chopping_board/minced_houttuynia'],{
  id:'kaleidoscope_grilling:chopping_board/minced_houttuynia',
  input:'kaleidoscope_grilling:houttuynia',result:'kaleidoscope_grilling:minced_houttuynia',count:1,cuts:4
 });
 for(const [id,input,output] of [
  ['kaleidoscope_grilling:millstone/sweet_potato_powder','kaleidoscope_grilling:sweet_potato','kaleidoscope_grilling:sweet_potato_powder'],
  ['kaleidoscope_grilling:millstone/canola_powder','kaleidoscope_grilling:canola_seeds','kaleidoscope_grilling:canola_powder'],
  ['kaleidoscope_grilling:millstone/onion_powder','kaleidoscope_grilling:onion','kaleidoscope_grilling:onion_powder'],
  ['kaleidoscope_grilling:millstone/red_chili_powder','kaleidoscope_cookery:red_chili','kaleidoscope_grilling:red_chili_powder']
 ]){
  assert.deepEqual(byId[id],{id,input,outputs:[{id:output,count:1,chance:1}]});
 }
});

t('capability filtering delegates station availability to Cookery host',()=>{
 assert.equal(recipesForReady({api:1,capabilities:['chopping_board']}).length,5);
 assert.equal(recipesForReady({api:1,capabilities:['millstone']}).length,7);
 assert.equal(recipesForReady({api:1,capabilities:['chopping_board','millstone']}).length,12);
 assert.deepEqual(recipesForReady({api:2,capabilities:['chopping_board','millstone']}),[]);
 assert.deepEqual(recipesForReady({api:1,capabilities:[]}),[]);
});

t('returned rows are defensive copies',()=>{
 const a=recipeTable(),id='kaleidoscope_grilling:chopping_board/raw_sweet_potato_sheet';
 a.find(row=>row.payload.recipe.id===id).payload.recipe.count=99;
 assert.equal(recipeTable().find(row=>row.payload.recipe.id===id).payload.recipe.count,1);
});

console.log('A2.7.27 Cookery host recipe registry: '+n+'/'+n);
