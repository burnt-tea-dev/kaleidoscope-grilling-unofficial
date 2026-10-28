import assert from 'node:assert/strict';
import {
 CROP_ID,SWEET_POTATO_ID,COMPONENT_ID,AGE_STATE,MAX_AGE,COMPOST_CHANCE,CROP_DROP_ORDER,
 FARMLAND_MIN_SURVIVAL_LIGHT,MIN_GROWTH_LIGHT,ACQUISITION_CHANCE,MATURE_BONUS_PROBABILITY,
 sweetPotatoSurvive,matureSweetPotatoCount,cropDropPlan,
 selectionHeight,bonemealAgeIncrease,javaCropGrowthSpeed,javaCropGrowthChance,shouldAdvanceAge
} from '../../projects/grilling/gameplay_core/behavior_pack/scripts/world/sweet_potato_crop_core.js';

let n=0;const t=(name,fn)=>{fn();n++;console.log('PASS',name)};
t('ids and ages stay exact',()=>{
 assert.equal(CROP_ID,'kaleidoscope_grilling:sweet_potato_crop');
 assert.equal(SWEET_POTATO_ID,'kaleidoscope_grilling:sweet_potato');
 assert.equal(COMPONENT_ID,'kaleidoscope_grilling:sweet_potato_crop_logic');
 assert.equal(AGE_STATE,'kaleidoscope_grilling:age');assert.equal(MAX_AGE,7);
});
t('crop-drop branch order matches Java handler',()=>assert.deepEqual([...CROP_DROP_ORDER],[
 'kaleidoscope_grilling:canola_seeds','kaleidoscope_grilling:sweet_potato','kaleidoscope_grilling:onion'
]));
t('vanilla crop survival is farmland plus light 8',()=>{
 assert.equal(FARMLAND_MIN_SURVIVAL_LIGHT,8);assert.equal(sweetPotatoSurvive('minecraft:farmland',8),true);
 assert.equal(sweetPotatoSurvive('minecraft:farmland',7),false);assert.equal(sweetPotatoSurvive('minecraft:soul_sand',15),false);
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
t('grass acquisition chance remains Java 12.5 percent',()=>assert.equal(ACQUISITION_CHANCE,.125));
t('mature sweet potato uses base3 plus Fortune+3 binomial trials',()=>{
 assert.equal(MATURE_BONUS_PROBABILITY,.5714286);
 assert.equal(matureSweetPotatoCount(0,[0,0,0]),6);assert.equal(matureSweetPotatoCount(0,[.9,.9,.9]),3);
 assert.equal(matureSweetPotatoCount(3,[0,0,0,0,0,0]),9);assert.equal(matureSweetPotatoCount(3,[.9,.9,.9,.9,.9,.9]),3);
});
t('unified crop drops consume Java branch order and independent chances',()=>{
 const p=cropDropPlan([.999,0,.5,.9,0,0],3);
 assert.deepEqual(p,[{id:'kaleidoscope_grilling:canola_seeds',count:4},{id:'kaleidoscope_grilling:onion',count:1}]);
});
t('Java composter chance is 65 percent',()=>assert.equal(COMPOST_CHANCE,65));
console.log('A2.7.19 sweet potato crop core: '+n+'/'+n);
