import assert from 'node:assert/strict';
import {
 ITEM_FILL_POINTS,oilTypeForBucketId,isCookeryOilPotItemId,planOffhandOilFill
} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a2737_offhand_oil_fill_core.js';

const OIL_TYPES={
 canola:{bucket:'kaleidoscope_grilling:canola_oil_bucket'},
 secret_chili:{bucket:'kaleidoscope_grilling:secret_chili_oil_bucket'},
 premium_chili:{bucket:'kaleidoscope_grilling:premium_chili_oil_bucket'}
};

let n=0;const t=(name,fn)=>{fn();n++;console.log('PASS',name)};

t('Java item fill quantum is eight points',()=>assert.equal(ITEM_FILL_POINTS,8));

t('bucket type lookup reuses caller oil registry instead of hardcoding a second table',()=>{
 assert.equal(oilTypeForBucketId('kaleidoscope_grilling:canola_oil_bucket',OIL_TYPES),'canola');
 assert.equal(oilTypeForBucketId('kaleidoscope_grilling:secret_chili_oil_bucket',OIL_TYPES),'secret_chili');
 assert.equal(oilTypeForBucketId('kaleidoscope_grilling:premium_chili_oil_bucket',OIL_TYPES),'premium_chili');
 assert.equal(oilTypeForBucketId('minecraft:water_bucket',OIL_TYPES),'');
});

t('Bedrock split empty and filled Cookery pot item IDs are both recognized',()=>{
 assert.equal(isCookeryOilPotItemId('kaleidoscope_cookery:oil_pot'),true);
 assert.equal(isCookeryOilPotItemId('kaleidoscope_cookery:oil_pot_filled'),true);
 assert.equal(isCookeryOilPotItemId('minecraft:bucket'),false);
});

t('unrelated item use is not intercepted',()=>{
 assert.deepEqual(planOffhandOilFill({empty:true,filled:false,type:'',count:0},''),{
  handled:false,reason:'not_grilling_bucket'
 });
 assert.deepEqual(planOffhandOilFill({empty:false,filled:false,type:'',count:0},'canola'),{
  handled:false,reason:'not_oil_pot'
 });
});

t('empty offhand pot accepts the first bucket',()=>{
 assert.deepEqual(planOffhandOilFill({empty:true,filled:false,type:'',count:0},'canola'),{
  handled:true,ok:true,type:'canola',count:0,added:8,nextCount:8,capacity:64
 });
});

t('same oil stacks in eight point steps to 64',()=>{
 assert.deepEqual(planOffhandOilFill({empty:false,filled:true,type:'secret_chili',count:56},'secret_chili'),{
  handled:true,ok:true,type:'secret_chili',count:56,added:8,nextCount:64,capacity:64
 });
 assert.equal(planOffhandOilFill({empty:false,filled:true,type:'secret_chili',count:64},'secret_chili').reason,'full');
});

t('native Cookery fat and different Grilling oil are rejected',()=>{
 assert.equal(planOffhandOilFill({empty:false,filled:true,type:'',count:8},'canola').reason,'native_fat');
 assert.equal(planOffhandOilFill({empty:false,filled:true,type:'canola',count:8},'premium_chili').reason,'different_oil');
});

console.log('A2.7.37 offhand Cookery oil-pot fill core: '+n+'/'+n);
