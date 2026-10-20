import assert from 'node:assert/strict';
import {
 COOKERY_EMPTY_ID,COOKERY_FILLED_ID,HOST_COUNT_KEY,GRILLING_TYPE_KEY,
 HOST_FAT_CAPACITY,GRILLING_FLUID_CAPACITY,GRILLING_OIL_TYPES,
 normalizeOilType,oilCapacity,normalizeOilCount,planOilConsumption
} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a2730_cookery_oil_pot_core.js';

let n=0;const t=(name,fn)=>{fn();n++;console.log('PASS',name)};

t('host ids and metadata keys remain exact',()=>{
 assert.equal(COOKERY_EMPTY_ID,'kaleidoscope_cookery:oil_pot');
 assert.equal(COOKERY_FILLED_ID,'kaleidoscope_cookery:oil_pot_filled');
 assert.equal(HOST_COUNT_KEY,'kc_oil_count');
 assert.equal(GRILLING_TYPE_KEY,'kaleidoscope_grilling:oil_type');
});

t('Cookery native fat and Grilling typed oil capacities remain distinct',()=>{
 assert.equal(HOST_FAT_CAPACITY,256);
 assert.equal(GRILLING_FLUID_CAPACITY,64);
 assert.equal(oilCapacity(''),256);
 for(const type of GRILLING_OIL_TYPES)assert.equal(oilCapacity(type),64);
 assert.equal(normalizeOilType('unknown_oil'),'');
});

t('missing host count uses one shared full-pot fallback',()=>{
 assert.equal(normalizeOilCount({filled:true,type:'',hasRaw:false}),256);
 assert.equal(normalizeOilCount({filled:true,type:'canola',hasRaw:false}),64);
 assert.equal(normalizeOilCount({filled:false,type:'canola',raw:50,hasRaw:true}),0);
});

t('counts clamp to the correct capacity',()=>{
 assert.equal(normalizeOilCount({filled:true,type:'',raw:999,hasRaw:true}),256);
 assert.equal(normalizeOilCount({filled:true,type:'premium_chili',raw:999,hasRaw:true}),64);
 assert.equal(normalizeOilCount({filled:true,type:'canola',raw:-2,hasRaw:true}),0);
});

t('normal consumption preserves type and decrements exact points',()=>{
 assert.deepEqual(planOilConsumption({filled:true,type:'secret_chili',count:12},3),{
  ok:true,type:'secret_chili',count:12,used:3,remaining:9,capacity:64
 });
});

t('required oil type is enforced for cold houttuynia',()=>{
 assert.equal(planOilConsumption({filled:true,type:'canola',count:20},2,'premium_chili').reason,'wrong_oil');
 assert.deepEqual(planOilConsumption({filled:true,type:'premium_chili',count:2},2,'premium_chili'),{
  ok:true,type:'premium_chili',count:2,used:2,remaining:0,capacity:64
 });
});

t('invalid and insufficient states fail without consumption',()=>{
 assert.equal(planOilConsumption({filled:false},1).reason,'not_pot');
 assert.equal(planOilConsumption({filled:true,type:'canola',count:1},2).reason,'insufficient');
 assert.equal(planOilConsumption({filled:true,type:'canola',count:5},0).reason,'invalid_amount');
});

console.log('A2.7.30 Cookery oil-pot core: '+n+'/'+n);
