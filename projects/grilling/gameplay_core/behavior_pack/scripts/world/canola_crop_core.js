import {
 MAX_AGE as VANILLA_MAX_AGE,FARMLAND_MIN_SURVIVAL_LIGHT,MIN_GROWTH_LIGHT,
 selectionHeight,bonemealAgeIncrease,javaCropGrowthSpeed,javaCropGrowthChance,shouldAdvanceAge
} from './houttuynia_crop_core.js';

export const CROP_ID='kaleidoscope_grilling:canola_crop';
export const SEEDS_ID='kaleidoscope_grilling:canola_seeds';
export const COMPONENT_ID='kaleidoscope_grilling:canola_crop_logic';
export const AGE_STATE='kaleidoscope_grilling:age';
export const MAX_AGE=VANILLA_MAX_AGE;
export const ACQUISITION_CHANCE=0.125;
export const MATURE_BONUS_PROBABILITY=0.5714286;
export const COMPOST_CHANCE=30;
export const STRAW_HATS=Object.freeze([
 'kaleidoscope_cookery:straw_hat',
 'kaleidoscope_cookery:straw_hat_flower'
]);

function clamp01(v){
 const n=Number(v);
 return Math.max(0,Math.min(0.999999999999,Number.isFinite(n)?n:0));
}
function sampleIndex(random01,size){
 return Math.floor(clamp01(random01)*Math.max(1,Math.floor(Number(size)||1)));
}
export function isStrawHat(id){return STRAW_HATS.includes(String(id??''))}
export function canolaSurvive(groundId,light){
 return groundId==='minecraft:farmland'&&Number(light)>=FARMLAND_MIN_SURVIVAL_LIGHT;
}
export function acquisitionSeedCount(random01,fortuneLevel){
 const fortune=Math.max(0,Math.floor(Number(fortuneLevel)||0));
 return 1+sampleIndex(random01,fortune+1);
}
export function shouldDropAcquisition(random01){return clamp01(random01)<ACQUISITION_CHANCE}
export function matureCanolaCount(fortuneLevel,randomValues=[]){
 const fortune=Math.max(0,Math.floor(Number(fortuneLevel)||0));
 let count=2;
 for(let i=0;i<fortune+2;i++)if(clamp01(randomValues[i]??0)<MATURE_BONUS_PROBABILITY)count++;
 return count;
}

export {
 FARMLAND_MIN_SURVIVAL_LIGHT,MIN_GROWTH_LIGHT,
 selectionHeight,bonemealAgeIncrease,javaCropGrowthSpeed,javaCropGrowthChance,shouldAdvanceAge
};
