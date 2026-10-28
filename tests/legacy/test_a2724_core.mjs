import assert from 'node:assert/strict';
import {
 KC_API,KC_READY_EVENT,KC_REGISTER_EVENT,SOURCE,
 RED_CHILI_ID,RED_CHILI_POWDER_ID,CANOLA_OIL_BUCKET_ID,SECRET_CHILI_OIL_BUCKET_ID,
 redChiliMillstoneRecipe,registrationsForReady,secretChiliOilRecipe
} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/recipe/red_chili_processing_core.js';

let n=0;const t=(name,fn)=>{fn();n++;console.log('PASS',name)};
t('Cookery extension constants stay exact',()=>{
 assert.equal(KC_API,1);
 assert.equal(KC_READY_EVENT,'kaleidoscope_cookery:api_ready');
 assert.equal(KC_REGISTER_EVENT,'kaleidoscope_cookery:register_recipe');
 assert.equal(SOURCE,'kaleidoscope_grilling');
});
t('red chili input and powder output ids stay exact',()=>{
 assert.equal(RED_CHILI_ID,'kaleidoscope_cookery:red_chili');
 assert.equal(RED_CHILI_POWDER_ID,'kaleidoscope_grilling:red_chili_powder');
});
t('millstone recipe matches locked Java 1.1.1',()=>assert.deepEqual(redChiliMillstoneRecipe(),{
 api:1,kind:'millstone',source:'kaleidoscope_grilling',
 recipe:{
  id:'kaleidoscope_grilling:millstone/red_chili_powder',
  input:'kaleidoscope_cookery:red_chili',
  outputs:[{id:'kaleidoscope_grilling:red_chili_powder',count:1,chance:1}]
 }
}));
t('wrong API or missing millstone capability registers nothing',()=>{
 assert.deepEqual(registrationsForReady({api:2,capabilities:['millstone']}),[]);
 assert.deepEqual(registrationsForReady({api:1,capabilities:['chopping_board']}),[]);
});
t('millstone capability registers exactly one defensive recipe',()=>{
 const rows=registrationsForReady({api:1,capabilities:['millstone']});assert.equal(rows.length,1);
 rows[0].recipe.outputs[0].count=99;assert.equal(redChiliMillstoneRecipe().recipe.outputs[0].count,1);
});
t('secret chili oil consumes one canola bucket and exactly three powders',()=>{
 assert.equal(CANOLA_OIL_BUCKET_ID,'kaleidoscope_grilling:canola_oil_bucket');
 assert.equal(SECRET_CHILI_OIL_BUCKET_ID,'kaleidoscope_grilling:secret_chili_oil_bucket');
 const r=secretChiliOilRecipe()['minecraft:recipe_shapeless'];
 assert.deepEqual(r.tags,['crafting_table']);
 assert.deepEqual(r.ingredients,[
  {item:'kaleidoscope_grilling:canola_oil_bucket'},
  {item:'kaleidoscope_grilling:red_chili_powder'},
  {item:'kaleidoscope_grilling:red_chili_powder'},
  {item:'kaleidoscope_grilling:red_chili_powder'}
 ]);
 assert.deepEqual(r.result,{item:'kaleidoscope_grilling:secret_chili_oil_bucket',count:1});
});
console.log('A2.7.24 red chili processing core: '+n+'/'+n);
