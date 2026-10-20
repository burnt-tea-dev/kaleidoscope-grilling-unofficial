import assert from 'node:assert/strict';
import {
 CROP_ID,HOUTTUYNIA_ID,COMPONENT_ID,AGE_STATE,RED_STATE,MAX_AGE,
 FARMLAND_MIN_SURVIVAL_LIGHT,MIN_GROWTH_LIGHT,RED_PLACEMENT_CHANCE,MATURE_BONUS_PROBABILITY,
 placementRedVariant,canCropSurvive,selectionHeight,bonemealAgeIncrease,wartAgeToCropAge,
 javaCropGrowthSpeed,javaCropGrowthChance,shouldAdvanceAge,matureBonusCount
} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/a2714_houttuynia_crop_core.js';

let n=0;const t=(name,fn)=>{fn();n++;console.log('PASS',name)};
t('ids and states stay exact',()=>{
 assert.equal(CROP_ID,'kaleidoscope_grilling:houttuynia_crop');
 assert.equal(HOUTTUYNIA_ID,'kaleidoscope_grilling:houttuynia');
 assert.equal(COMPONENT_ID,'kaleidoscope_grilling:houttuynia_crop_logic');
 assert.equal(AGE_STATE,'kaleidoscope_grilling:age');assert.equal(RED_STATE,'kaleidoscope_grilling:red_variant');assert.equal(MAX_AGE,7);
});
t('Java placement variant is soul-sand forced or 30 percent',()=>{
 assert.equal(RED_PLACEMENT_CHANCE,.3);
 assert.equal(placementRedVariant('minecraft:soul_sand',.999),true);
 assert.equal(placementRedVariant('minecraft:farmland',.299),true);
 assert.equal(placementRedVariant('minecraft:farmland',.3),false);
});
t('Java survival allows soul sand regardless of light but farmland from light 8',()=>{
 assert.equal(FARMLAND_MIN_SURVIVAL_LIGHT,8);
 assert.equal(canCropSurvive('minecraft:soul_sand',0),true);
 assert.equal(canCropSurvive('minecraft:farmland',7),false);
 assert.equal(canCropSurvive('minecraft:farmland',8),true);
 assert.equal(canCropSurvive('minecraft:dirt',15),false);
});
t('selection shape follows vanilla age heights',()=>assert.deepEqual(Array.from({length:8},(_,i)=>selectionHeight(i)),[2,4,6,8,10,12,14,16]));
t('bonemeal is Java CropBlock +2..5',()=>{
 assert.equal(bonemealAgeIncrease(0),2);assert.equal(bonemealAgeIncrease(.249),2);assert.equal(bonemealAgeIncrease(.25),3);assert.equal(bonemealAgeIncrease(.999),5);
});
t('fortress wart age mapping is 0/1/2 -> 0/3/7',()=>{
 assert.equal(wartAgeToCropAge(0),0);assert.equal(wartAgeToCropAge(1),3);assert.equal(wartAgeToCropAge(2),7);assert.equal(wartAgeToCropAge(3),7);
});
t('dry center farmland growth speed mirrors vanilla CropBlock',()=>{
 const cells=Array.from({length:9},()=>({typeId:'minecraft:air',moisture:0}));cells[4]={typeId:'minecraft:farmland',moisture:0};
 assert.equal(javaCropGrowthSpeed(cells,{}),2);assert.equal(javaCropGrowthChance(2),1/13);
});
t('hydrated 3x3 farmland gets vanilla weighted speed',()=>{
 const cells=Array.from({length:9},()=>({typeId:'minecraft:farmland',moisture:7}));
 assert.equal(javaCropGrowthSpeed(cells,{}),10);assert.equal(javaCropGrowthChance(10),1/3);
});
t('crowding halves vanilla growth speed',()=>{
 const cells=Array.from({length:9},()=>({typeId:'minecraft:farmland',moisture:7}));
 assert.equal(javaCropGrowthSpeed(cells,{west:true,north:true}),5);
 assert.equal(javaCropGrowthSpeed(cells,{northWest:true}),5);
});
t('growth requires light 9 and random threshold',()=>{
 assert.equal(MIN_GROWTH_LIGHT,9);
 assert.equal(shouldAdvanceAge(8,10,0),false);
 assert.equal(shouldAdvanceAge(9,10,.32),true);
 assert.equal(shouldAdvanceAge(9,10,.34),false);
});
t('mature Java bonus is one plus binomial Fortune+1 at 4/7',()=>{
 assert.equal(MATURE_BONUS_PROBABILITY,0.5714286);
 assert.equal(matureBonusCount(0,[0]),2);
 assert.equal(matureBonusCount(0,[.9]),1);
 assert.equal(matureBonusCount(3,[0,0,0,0]),5);
 assert.equal(matureBonusCount(3,[.9,.9,.9,.9]),1);
});
console.log('A2.7.14 houttuynia crop core: '+n+'/'+n);
