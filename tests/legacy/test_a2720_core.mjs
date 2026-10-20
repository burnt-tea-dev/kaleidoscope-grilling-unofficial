import assert from 'node:assert/strict';
import {
 ROASTED_ID,INPUT_ID,WARMTH_EFFECT,WARMTH_TICKS,NUTRITION,SATURATION_MODIFIER,STATION_TAGS,
 roastedRecipe,nextWarmthUntil
} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a2720_roasted_sweet_potato_core.js';

let n=0;const t=(name,fn)=>{fn();n++;console.log('PASS',name)};
t('ids and food values stay exact',()=>{
 assert.equal(ROASTED_ID,'kaleidoscope_grilling:roasted_sweet_potato');
 assert.equal(INPUT_ID,'kaleidoscope_grilling:sweet_potato');
 assert.equal(NUTRITION,6);assert.equal(SATURATION_MODIFIER,.2);
});
t('Java base warmth duration is 600 ticks',()=>{assert.equal(WARMTH_EFFECT,'warmth');assert.equal(WARMTH_TICKS,600)});
t('station tags cover furnace smoker and both campfires',()=>assert.deepEqual([...STATION_TAGS],['furnace','smoker','campfire','soul_campfire']));
t('Bedrock recipe uses native furnace recipe container',()=>assert.deepEqual(roastedRecipe(),{
 format_version:'1.20.10',
 'minecraft:recipe_furnace':{
  description:{identifier:'kaleidoscope_grilling:roasted_sweet_potato'},
  tags:['furnace','smoker','campfire','soul_campfire'],
  input:'kaleidoscope_grilling:sweet_potato',
  output:'kaleidoscope_grilling:roasted_sweet_potato'
 }
}));
t('warmth extends but never shortens an existing longer effect',()=>{
 assert.equal(nextWarmthUntil(100,0),700);
 assert.equal(nextWarmthUntil(100,1200),1200);
 assert.equal(nextWarmthUntil(100,500),700);
});
console.log('A2.7.20 roasted sweet potato core: '+n+'/'+n);
