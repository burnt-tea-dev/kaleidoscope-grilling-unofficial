import assert from 'node:assert/strict';
import {KC_API,KC_READY_EVENT,KC_PING_EVENT,KC_REGISTER_EVENT,SOURCE,CARROT_DICE_ID,POTATO_SLICE_ID,CUTS,choppingRecipes,registrationsForReady} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/recipe/basic_chopping_core.js';

let n=0;const t=(name,fn)=>{fn();n++;console.log('PASS',name)};
const rows=choppingRecipes();
t('Cookery public API v1 constants stay exact',()=>{assert.equal(KC_API,1);assert.equal(KC_READY_EVENT,'kaleidoscope_cookery:api_ready');assert.equal(KC_PING_EVENT,'kaleidoscope_cookery:api_ping');assert.equal(KC_REGISTER_EVENT,'kaleidoscope_cookery:register_recipe');assert.equal(SOURCE,'kaleidoscope_grilling')});
t('slice has exactly two conflict-free board recipes',()=>assert.equal(rows.length,2));
const carrot=rows.find(x=>x.recipe.input==='minecraft:carrot');
const potato=rows.find(x=>x.recipe.input==='minecraft:potato');
t('carrot matches Java 4-cut x3 recipe',()=>assert.deepEqual(carrot.recipe,{id:'kaleidoscope_grilling:chopping_board/carrot_dice',input:'minecraft:carrot',result:CARROT_DICE_ID,count:3,cuts:4}));
t('potato matches Java 4-cut x3 recipe',()=>assert.deepEqual(potato.recipe,{id:'kaleidoscope_grilling:chopping_board/potato_slice',input:'minecraft:potato',result:POTATO_SLICE_ID,count:3,cuts:4}));
t('all recipes use chopping_board kind and source',()=>{for(const r of rows){assert.equal(r.kind,'chopping_board');assert.equal(r.source,SOURCE);assert.equal(r.api,1)}});
t('wrong API registers nothing',()=>assert.deepEqual(registrationsForReady({api:2,capabilities:['chopping_board']}),[]));
t('missing capability registers nothing',()=>assert.deepEqual(registrationsForReady({api:1,capabilities:['millstone']}),[]));
t('chopping_board capability registers both',()=>assert.equal(registrationsForReady({api:1,capabilities:['chopping_board']}).length,2));
t('returned recipes are defensive copies',()=>{const a=choppingRecipes();a[0].recipe.count=99;assert.equal(choppingRecipes()[0].recipe.count,3)});
console.log('A2.7.8 basic chopping core: '+n+'/'+n);
