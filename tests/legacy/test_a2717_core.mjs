import assert from 'node:assert/strict';
import {
 CROP_ID,ONION_ID,COMPONENT_ID,AGE_STATE,MAX_AGE,COMPOST_CHANCE,
 FARMLAND_MIN_SURVIVAL_LIGHT,MIN_GROWTH_LIGHT,ACQUISITION_CHANCE,MATURE_BONUS_PROBABILITY,STRAW_HATS,
 onionSurvive,onionAcquisitionCount,shouldDropOnionAcquisition,matureOnionCount,
 selectionHeight,bonemealAgeIncrease,javaCropGrowthSpeed,javaCropGrowthChance,shouldAdvanceAge
} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/world/onion_crop_core.js';

let n=0;const t=(name,fn)=>{fn();n++;console.log('PASS',name)};
t('ids and ages stay exact',()=>{
 assert.equal(CROP_ID,'kaleidoscope_grilling:onion_crop');assert.equal(ONION_ID,'kaleidoscope_grilling:onion');
 assert.equal(COMPONENT_ID,'kaleidoscope_grilling:onion_crop_logic');assert.equal(AGE_STATE,'kaleidoscope_grilling:age');assert.equal(MAX_AGE,7);
});
t('reuses exact Cookery straw hats',()=>assert.deepEqual([...STRAW_HATS],['kaleidoscope_cookery:straw_hat','kaleidoscope_cookery:straw_hat_flower']));
t('vanilla crop survival is farmland plus light 8',()=>{
 assert.equal(FARMLAND_MIN_SURVIVAL_LIGHT,8);assert.equal(onionSurvive('minecraft:farmland',8),true);assert.equal(onionSurvive('minecraft:farmland',7),false);assert.equal(onionSurvive('minecraft:soul_sand',15),false);
});
t('growth requires light 9',()=>{assert.equal(MIN_GROWTH_LIGHT,9);assert.equal(shouldAdvanceAge(8,10,0),false);assert.equal(shouldAdvanceAge(9,10,.32),true)});
t('selection and bonemeal reuse vanilla CropBlock helpers',()=>{
 assert.deepEqual(Array.from({length:8},(_,i)=>selectionHeight(i)),[2,4,6,8,10,12,14,16]);
 assert.equal(bonemealAgeIncrease(0),2);assert.equal(bonemealAgeIncrease(.999),5);
});
t('growth speed keeps 3x3 farmland weighting',()=>{
 const cells=Array.from({length:9},()=>({typeId:'minecraft:farmland',moisture:7}));
 assert.equal(javaCropGrowthSpeed(cells,{}),10);assert.equal(javaCropGrowthChance(10),1/3);
});
t('grass acquisition chance is Java 12.5 percent',()=>{
 assert.equal(ACQUISITION_CHANCE,.125);assert.equal(shouldDropOnionAcquisition(.124999),true);assert.equal(shouldDropOnionAcquisition(.125),false);
});
t('grass acquisition count is 1 + random 0..Fortune',()=>{
 assert.equal(onionAcquisitionCount(0,0),1);assert.equal(onionAcquisitionCount(.999,0),1);assert.equal(onionAcquisitionCount(0,3),1);assert.equal(onionAcquisitionCount(.999,3),4);
});
t('mature onion formula equals Java extra=2 binomial loot',()=>{
 assert.equal(MATURE_BONUS_PROBABILITY,.5714286);
 assert.equal(matureOnionCount(0,[0,0]),4);assert.equal(matureOnionCount(0,[.9,.9]),2);
 assert.equal(matureOnionCount(3,[0,0,0,0,0]),7);assert.equal(matureOnionCount(3,[.9,.9,.9,.9,.9]),2);
});
t('Java composter chance is 65 percent',()=>assert.equal(COMPOST_CHANCE,65));
console.log('A2.7.17 onion crop core: '+n+'/'+n);
