import assert from 'node:assert/strict';
import {
 COOKERY_EMPTY_ID,COOKERY_FILLED_ID,HOST_COUNT_KEY,GRILLING_TYPE_KEY,
 HOST_FAT_CAPACITY,GRILLING_FLUID_CAPACITY,
 normalizeOilCount,oilCapacity,planOilConsumption,planTypedOilAddition
} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a2734_cookery_oil_pot_core.js';

let n=0;const t=(name,fn)=>{fn();n++;console.log('PASS',name)};

t('host IDs and metadata keys remain exact',()=>{
 assert.equal(COOKERY_EMPTY_ID,'kaleidoscope_cookery:oil_pot');
 assert.equal(COOKERY_FILLED_ID,'kaleidoscope_cookery:oil_pot_filled');
 assert.equal(HOST_COUNT_KEY,'kc_oil_count');
 assert.equal(GRILLING_TYPE_KEY,'kaleidoscope_grilling:oil_type');
});

t('capacity contract remains 256 native fat and 64 typed Grilling oil',()=>{
 assert.equal(HOST_FAT_CAPACITY,256);assert.equal(GRILLING_FLUID_CAPACITY,64);
 assert.equal(oilCapacity(''),256);assert.equal(oilCapacity('canola'),64);
});

t('normal hand-held read treats missing count as zero',()=>{
 assert.equal(normalizeOilCount({filled:true,type:'',hasRaw:false}),0);
 assert.equal(normalizeOilCount({filled:true,type:'canola',hasRaw:false}),0);
});

t('legacy placement read alone may treat missing filled count as full',()=>{
 assert.equal(normalizeOilCount({filled:true,type:'',hasRaw:false,legacyPlacementFallback:true}),256);
 assert.equal(normalizeOilCount({filled:true,type:'premium_chili',hasRaw:false,legacyPlacementFallback:true}),64);
});

t('consumption never fabricates oil from a missing count',()=>{
 assert.equal(planOilConsumption({filled:true,type:'premium_chili',count:0},2,'premium_chili').reason,'insufficient');
 assert.deepEqual(planOilConsumption({filled:true,type:'premium_chili',count:2},2,'premium_chili'),{
  ok:true,type:'premium_chili',count:2,used:2,remaining:0,capacity:64
 });
});

t('typed oil addition rejects native Cookery fat instead of retyping it',()=>{
 assert.equal(planTypedOilAddition({filled:true,empty:false,type:'',count:8},'canola',8).reason,'native_fat');
});

t('typed oil addition preserves type separation and 64 point cap',()=>{
 assert.equal(planTypedOilAddition({filled:true,empty:false,type:'secret_chili',count:8},'premium_chili',8).reason,'different_oil');
 assert.deepEqual(planTypedOilAddition({filled:true,empty:false,type:'secret_chili',count:56},'secret_chili',8),{
  ok:true,type:'secret_chili',count:56,added:8,nextCount:64,capacity:64
 });
 assert.equal(planTypedOilAddition({filled:true,empty:false,type:'secret_chili',count:64},'secret_chili',8).reason,'full');
});

t('empty Cookery pot accepts the first typed oil bucket',()=>{
 assert.deepEqual(planTypedOilAddition({filled:false,empty:true,type:'',count:0},'canola',8),{
  ok:true,type:'canola',count:0,added:8,nextCount:8,capacity:64
 });
});

console.log('A2.7.34 Cookery oil-pot contract core: '+n+'/'+n);
