import assert from 'node:assert/strict';
import {
 HOST_FAT_CAPACITY,GRILLING_FLUID_CAPACITY,GRILLING_OIL_BUCKET_POINTS,
 GRILLING_OIL_TYPES,normalizeOilType,oilCapacity,oilTypeForBucketId
} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a2738_oil_contract_core.js';

let n=0;const t=(name,fn)=>{fn();n++;console.log('PASS',name)};

t('Java and Cookery capacities are centralized',()=>{
 assert.equal(HOST_FAT_CAPACITY,256);
 assert.equal(GRILLING_FLUID_CAPACITY,64);
 assert.equal(GRILLING_OIL_BUCKET_POINTS,8);
 assert.equal(oilCapacity(''),256);
 assert.equal(oilCapacity('canola'),64);
});

t('only the three Java typed oils normalize',()=>{
 assert.deepEqual([...GRILLING_OIL_TYPES],['canola','secret_chili','premium_chili']);
 assert.equal(normalizeOilType('canola'),'canola');
 assert.equal(normalizeOilType('secret_chili'),'secret_chili');
 assert.equal(normalizeOilType('premium_chili'),'premium_chili');
 assert.equal(normalizeOilType('fat'),'');
});

t('bucket lookup derives from the caller registry',()=>{
 const registry={
  canola:{bucket:'kaleidoscope_grilling:canola_oil_bucket'},
  secret_chili:{bucket:'kaleidoscope_grilling:secret_chili_oil_bucket'},
  premium_chili:{bucket:'kaleidoscope_grilling:premium_chili_oil_bucket'}
 };
 assert.equal(oilTypeForBucketId(registry.canola.bucket,registry),'canola');
 assert.equal(oilTypeForBucketId(registry.secret_chili.bucket,registry),'secret_chili');
 assert.equal(oilTypeForBucketId(registry.premium_chili.bucket,registry),'premium_chili');
 assert.equal(oilTypeForBucketId('minecraft:water_bucket',registry),'');
});

console.log('A2.7.38 shared oil contract: '+n+'/'+n);
