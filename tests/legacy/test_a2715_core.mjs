import assert from 'node:assert/strict';
import {
 CROP_ID,SEEDS_ID,COMPONENT_ID,AGE_STATE,MAX_AGE,
 FARMLAND_MIN_SURVIVAL_LIGHT,MIN_GROWTH_LIGHT,ACQUISITION_CHANCE,MATURE_BONUS_PROBABILITY,COMPOST_CHANCE,STRAW_HATS,
 isStrawHat,canolaSurvive,acquisitionSeedCount,shouldDropAcquisition,matureCanolaCount,
 selectionHeight,bonemealAgeIncrease,javaCropGrowthSpeed,javaCropGrowthChance,shouldAdvanceAge
} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a2715_canola_crop_core.js';

let n=0;const t=(name,fn)=>{fn();n++;console.log('PASS',name)};
t('ids and ages stay exact',()=>{
 assert.equal(CROP_ID,'kaleidoscope_grilling:canola_crop');assert.equal(SEEDS_ID,'kaleidoscope_grilling:canola_seeds');
 assert.equal(COMPONENT_ID,'kaleidoscope_grilling:canola_crop_logic');assert.equal(AGE_STATE,'kaleidoscope_grilling:age');assert.equal(MAX_AGE,7);
});
t('Cookery straw hats stay exact',()=>assert.deepEqual([...STRAW_HATS],['kaleidoscope_cookery:straw_hat','kaleidoscope_cookery:straw_hat_flower']));
t('straw hat predicate rejects unrelated helmets',()=>{assert.equal(isStrawHat(STRAW_HATS[0]),true);assert.equal(isStrawHat('minecraft:leather_helmet'),false)});
t('vanilla crop survival is farmland plus light 8',()=>{
 assert.equal(FARMLAND_MIN_SURVIVAL_LIGHT,8);assert.equal(canolaSurvive('minecraft:farmland',8),true);assert.equal(canolaSurvive('minecraft:farmland',7),false);assert.equal(canolaSurvive('minecraft:soul_sand',15),false);
});
t('growth requires light 9',()=>{assert.equal(MIN_GROWTH_LIGHT,9);assert.equal(shouldAdvanceAge(8,10,0),false);assert.equal(shouldAdvanceAge(9,10,.32),true)});
t('selection and bonemeal reuse A2.7.14 vanilla CropBlock helpers',()=>{
 assert.deepEqual(Array.from({length:8},(_,i)=>selectionHeight(i)),[2,4,6,8,10,12,14,16]);
 assert.equal(bonemealAgeIncrease(0),2);assert.equal(bonemealAgeIncrease(.999),5);
});
t('growth speed reuses exact 3x3 farmland weighting',()=>{
 const cells=Array.from({length:9},()=>({typeId:'minecraft:farmland',moisture:7}));
 assert.equal(javaCropGrowthSpeed(cells,{}),10);assert.equal(javaCropGrowthChance(10),1/3);
});
t('grass acquisition chance is Java 12.5 percent',()=>{
 assert.equal(ACQUISITION_CHANCE,.125);assert.equal(shouldDropAcquisition(.124999),true);assert.equal(shouldDropAcquisition(.125),false);
});
t('grass acquisition count is 1 + random 0..Fortune',()=>{
 assert.equal(acquisitionSeedCount(0,0),1);assert.equal(acquisitionSeedCount(.999,0),1);assert.equal(acquisitionSeedCount(0,3),1);assert.equal(acquisitionSeedCount(.999,3),4);
});
t('mature canola chance literal and Fortune formula stay exact',()=>{
 assert.equal(MATURE_BONUS_PROBABILITY,.5714286);
 assert.equal(matureCanolaCount(0,[0,0]),4);assert.equal(matureCanolaCount(0,[.9,.9]),2);
 assert.equal(matureCanolaCount(3,[0,0,0,0,0]),7);assert.equal(matureCanolaCount(3,[.9,.9,.9,.9,.9]),2);
});
t('Java composter chance is 30 percent',()=>assert.equal(COMPOST_CHANCE,30));
console.log('A2.7.15 canola crop core: '+n+'/'+n);
