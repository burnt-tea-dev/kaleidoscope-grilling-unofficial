import assert from 'node:assert/strict';
import {
 KC_API,KC_READY_EVENT,KC_REGISTER_EVENT,SOURCE,
 HOUTTUYNIA_ID,MINCED_HOUTTUYNIA_ID,CUTS,OUTPUT_COUNT,
 houttuyniaChoppingRecipe,registrationsForReady
} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/recipe/houttuynia_processing_core.js';

let n=0;const t=(name,fn)=>{fn();n++;console.log('PASS',name)};
t('Cookery public API constants stay exact',()=>{
 assert.equal(KC_API,1);
 assert.equal(KC_READY_EVENT,'kaleidoscope_cookery:api_ready');
 assert.equal(KC_REGISTER_EVENT,'kaleidoscope_cookery:register_recipe');
 assert.equal(SOURCE,'kaleidoscope_grilling');
});
t('item ids stay exact',()=>{
 assert.equal(HOUTTUYNIA_ID,'kaleidoscope_grilling:houttuynia');
 assert.equal(MINCED_HOUTTUYNIA_ID,'kaleidoscope_grilling:minced_houttuynia');
});
t('Java cut/yield stay exact',()=>{assert.equal(CUTS,4);assert.equal(OUTPUT_COUNT,1)});
t('recipe matches Java 1.1.1 semantics',()=>assert.deepEqual(houttuyniaChoppingRecipe(),{
 api:1,kind:'chopping_board',source:'kaleidoscope_grilling',
 recipe:{
  id:'kaleidoscope_grilling:chopping_board/minced_houttuynia',
  input:'kaleidoscope_grilling:houttuynia',
  result:'kaleidoscope_grilling:minced_houttuynia',
  count:1,cuts:4
 }
}));
t('wrong API registers nothing',()=>assert.deepEqual(registrationsForReady({api:2,capabilities:['chopping_board']}),[]));
t('missing capability registers nothing',()=>assert.deepEqual(registrationsForReady({api:1,capabilities:['millstone']}),[]));
t('chopping capability registers exactly one',()=>assert.equal(registrationsForReady({api:1,capabilities:['chopping_board']}).length,1));
t('returned recipe is defensive copy',()=>{
 const a=houttuyniaChoppingRecipe();a.recipe.count=99;
 assert.equal(houttuyniaChoppingRecipe().recipe.count,1);
});
console.log('A2.7.13 houttuynia processing core: '+n+'/'+n);
