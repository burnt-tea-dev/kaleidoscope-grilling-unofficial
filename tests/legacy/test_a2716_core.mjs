import assert from 'node:assert/strict';
import {
 KC_API,KC_READY_EVENT,KC_REGISTER_EVENT,SOURCE,
 CANOLA_SEEDS_ID,CANOLA_POWDER_ID,
 canolaMillstoneRecipe,registrationsForReady
} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/recipe/canola_processing_core.js';

let n=0;const t=(name,fn)=>{fn();n++;console.log('PASS',name)};
t('Cookery API constants stay exact',()=>{
 assert.equal(KC_API,1);
 assert.equal(KC_READY_EVENT,'kaleidoscope_cookery:api_ready');
 assert.equal(KC_REGISTER_EVENT,'kaleidoscope_cookery:register_recipe');
 assert.equal(SOURCE,'kaleidoscope_grilling');
});
t('input and output ids stay exact',()=>{
 assert.equal(CANOLA_SEEDS_ID,'kaleidoscope_grilling:canola_seeds');
 assert.equal(CANOLA_POWDER_ID,'kaleidoscope_grilling:canola_powder');
});
t('recipe matches Java 1.1.1',()=>assert.deepEqual(canolaMillstoneRecipe(),{
 api:1,kind:'millstone',source:'kaleidoscope_grilling',
 recipe:{
  id:'kaleidoscope_grilling:millstone/canola_powder',
  input:'kaleidoscope_grilling:canola_seeds',
  outputs:[{id:'kaleidoscope_grilling:canola_powder',count:1,chance:1}]
 }
}));
t('wrong API version registers nothing',()=>assert.deepEqual(registrationsForReady({api:2,capabilities:['millstone']}),[]));
t('missing capability registers nothing',()=>assert.deepEqual(registrationsForReady({api:1,capabilities:['chopping_board']}),[]));
t('millstone capability registers exactly one',()=>assert.equal(registrationsForReady({api:1,capabilities:['millstone']}).length,1));
t('returned recipe is defensive copy',()=>{
 const a=canolaMillstoneRecipe();a.recipe.outputs[0].count=99;
 assert.equal(canolaMillstoneRecipe().recipe.outputs[0].count,1);
});
console.log('A2.7.16 canola processing core: '+n+'/'+n);
