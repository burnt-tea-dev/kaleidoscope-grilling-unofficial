import {
 MAX_AGE as VANILLA_MAX_AGE,FARMLAND_MIN_SURVIVAL_LIGHT,MIN_GROWTH_LIGHT,
 ACQUISITION_CHANCE,MATURE_BONUS_PROBABILITY,STRAW_HATS,
 acquisitionSeedCount,shouldDropAcquisition,
 selectionHeight,bonemealAgeIncrease,javaCropGrowthSpeed,javaCropGrowthChance,shouldAdvanceAge
} from './canola_crop_core.js';

export const CROP_ID='kaleidoscope_grilling:onion_crop';
export const ONION_ID='kaleidoscope_grilling:onion';
export const COMPONENT_ID='kaleidoscope_grilling:onion_crop_logic';
export const AGE_STATE='kaleidoscope_grilling:age';
export const MAX_AGE=VANILLA_MAX_AGE;
export const COMPOST_CHANCE=65;

function clamp01(v){
 const n=Number(v);
 return Math.max(0,Math.min(0.999999999999,Number.isFinite(n)?n:0));
}
export function onionSurvive(groundId,light){
 return groundId==='minecraft:farmland'&&Number(light)>=FARMLAND_MIN_SURVIVAL_LIGHT;
}
export function onionAcquisitionCount(random01,fortuneLevel){
 return acquisitionSeedCount(random01,fortuneLevel);
}
export function shouldDropOnionAcquisition(random01){
 return shouldDropAcquisition(random01);
}
export function matureOnionCount(fortuneLevel,randomValues=[]){
 const fortune=Math.max(0,Math.floor(Number(fortuneLevel)||0));
 let count=2;
 for(let i=0;i<fortune+2;i++)if(clamp01(randomValues[i]??0)<MATURE_BONUS_PROBABILITY)count++;
 return count;
}

export {
 FARMLAND_MIN_SURVIVAL_LIGHT,MIN_GROWTH_LIGHT,ACQUISITION_CHANCE,MATURE_BONUS_PROBABILITY,STRAW_HATS,
 selectionHeight,bonemealAgeIncrease,javaCropGrowthSpeed,javaCropGrowthChance,shouldAdvanceAge
};
