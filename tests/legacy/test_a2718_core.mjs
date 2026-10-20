import assert from 'node:assert/strict';
import {
 KC_API,KC_READY_EVENT,KC_REGISTER_EVENT,SOURCE,
 ONION_ID,ONION_POWDER_ID,onionMillstoneRecipe,registrationsForReady
} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a2718_onion_processing_core.js';

let n=0;const t=(name,fn)=>{fn();n++;console.log('PASS',name)};
t('Cookery API constants stay exact',()=>{
 assert.equal(KC_API,1);
 assert.equal(KC_READY_EVENT,'kaleidoscope_cookery:api_ready');
 assert.equal(KC_REGISTER_EVENT,'kaleidoscope_cookery:register_recipe');
 assert.equal(SOURCE,'kaleidoscope_grilling');
});
t('input and output ids stay exact',()=>{
 assert.equal(ONION_ID,'kaleidoscope_grilling:onion');
 assert.equal(ONION_POWDER_ID,'kaleidoscope_grilling:onion_powder');
});
t('recipe matches locked Java baseline resolution',()=>assert.deepEqual(onionMillstoneRecipe(),{
 api:1,kind:'millstone',source:'kaleidoscope_grilling',
 recipe:{
  id:'kaleidoscope_grilling:millstone/onion_powder',
  input:'kaleidoscope_grilling:onion',
  outputs:[{id:'kaleidoscope_grilling:onion_powder',count:1,chance:1}]
 }
}));
t('wrong API registers nothing',()=>assert.deepEqual(registrationsForReady({api:2,capabilities:['millstone']}),[]));
t('missing capability registers nothing',()=>assert.deepEqual(registrationsForReady({api:1,capabilities:['chopping_board']}),[]));
t('millstone capability registers exactly one',()=>assert.equal(registrationsForReady({api:1,capabilities:['millstone']}).length,1));
t('returned recipe is a defensive copy',()=>{
 const a=onionMillstoneRecipe();a.recipe.outputs[0].count=99;
 assert.equal(onionMillstoneRecipe().recipe.outputs[0].count,1);
});
console.log('A2.7.18 onion processing core: '+n+'/'+n);
