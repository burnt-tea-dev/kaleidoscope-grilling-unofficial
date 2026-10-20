import assert from 'node:assert/strict';
import {
 COLD_ID,HOUTTUYNIA_ID,CRAFTING_TABLE_ID,COOKERY_EMPTY_ID,COOKERY_FILLED_ID,
 REQUIRED_OIL_TYPE,REQUIRED_HOUTTUYNIA,REQUIRED_OIL,FIRE_RESISTANCE_TICKS,
 NUTRITION,SATURATION_MODIFIER,planColdHouttuynia,nextOilPotId
} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a2722_cold_houttuynia_core.js';

let n=0;const t=(name,fn)=>{fn();n++;console.log('PASS',name)};
const base={blockId:CRAFTING_TABLE_ID,sneaking:true,mainId:HOUTTUYNIA_ID,mainCount:3,offId:COOKERY_FILLED_ID,oilType:REQUIRED_OIL_TYPE,oilCount:2};

t('Java base food and effect values stay exact',()=>{
 assert.equal(COLD_ID,'kaleidoscope_grilling:cold_houttuynia');
 assert.equal(NUTRITION,6);assert.equal(SATURATION_MODIFIER,1.0);
 assert.equal(FIRE_RESISTANCE_TICKS,1200);
});
t('scripted craft consumes exactly three houttuynia and two premium chili oil points',()=>{
 const p=planColdHouttuynia(base);
 assert.deepEqual(p,{ok:true,output:COLD_ID,houttuyniaUsed:3,oilUsed:2,nextHouttuyniaCount:0,nextOilCount:0});
 assert.equal(REQUIRED_HOUTTUYNIA,3);assert.equal(REQUIRED_OIL,2);
});
t('remaining ingredients and oil are preserved',()=>{
 const p=planColdHouttuynia({...base,mainCount:7,oilCount:64});
 assert.equal(p.nextHouttuyniaCount,4);assert.equal(p.nextOilCount,62);
});
t('wrong oil type is rejected',()=>assert.deepEqual(planColdHouttuynia({...base,oilType:'canola'}),{ok:false,reason:'wrong_oil'}));
t('insufficient oil is rejected',()=>assert.deepEqual(planColdHouttuynia({...base,oilCount:1}),{ok:false,reason:'need_oil'}));
t('fewer than three houttuynia are rejected',()=>assert.deepEqual(planColdHouttuynia({...base,mainCount:2}),{ok:false,reason:'need_houttuynia'}));
t('gesture cannot accidentally trigger away from a crafting table',()=>assert.deepEqual(planColdHouttuynia({...base,blockId:'minecraft:chest'}),{ok:false,reason:'not_crafting_table'}));
t('gesture requires sneak',()=>assert.deepEqual(planColdHouttuynia({...base,sneaking:false}),{ok:false,reason:'not_sneaking'}));
t('empty remainder converts the Bedrock Cookery filled-pot shim to the empty pot',()=>{
 assert.equal(nextOilPotId(1),COOKERY_FILLED_ID);assert.equal(nextOilPotId(0),COOKERY_EMPTY_ID);
});
console.log('A2.7.22 cold houttuynia core: '+n+'/'+n);
