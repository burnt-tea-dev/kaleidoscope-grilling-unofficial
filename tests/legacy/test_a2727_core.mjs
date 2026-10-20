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

t('chopping and milling keep their ingredient, output and quantity rules',()=>{
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
 const known={
  chopping_board:['raw_sweet_potato_sheet','carrot_dice','potato_slice','raw_mantou_slice','minced_houttuynia'],
  millstone:['sweet_potato_powder','canola_powder','onion_powder','red_chili_powder']
 };
 for(const capability of ['chopping_board','millstone']){
  const rows=recipesForReady({api:1,capabilities:[capability]});
  assert.ok(rows.every(row=>row.kind===capability));
  for(const name of known[capability])
   assert.ok(rows.some(row=>row.recipe.id===`kaleidoscope_grilling:${capability}/${name}`));
 }
 assert.deepEqual(recipesForReady({api:2,capabilities:['chopping_board','millstone']}),[]);
 assert.deepEqual(recipesForReady({api:1,capabilities:[]}),[]);
});

t('returned rows are defensive copies',()=>{
 const id='kaleidoscope_grilling:chopping_board/raw_sweet_potato_sheet';
 const row=()=>recipeTable().find(x=>x.payload.recipe.id===id);
 const a=row();a.payload.recipe.count=99;
 assert.equal(row().payload.recipe.count,1);
});

console.log('A2.7.27 Cookery host recipe registry: '+n+'/'+n);
