import {
 MAX_AGE as VANILLA_MAX_AGE,FARMLAND_MIN_SURVIVAL_LIGHT,MIN_GROWTH_LIGHT,
 ACQUISITION_CHANCE,MATURE_BONUS_PROBABILITY,STRAW_HATS,SEEDS_ID as CANOLA_SEEDS_ID,
 acquisitionSeedCount,shouldDropAcquisition,
 selectionHeight,bonemealAgeIncrease,javaCropGrowthSpeed,javaCropGrowthChance,shouldAdvanceAge
} from './canola_crop_core.js';
import {ONION_ID} from './onion_crop_core.js';

export const CROP_ID='kaleidoscope_grilling:sweet_potato_crop';
export const SWEET_POTATO_ID='kaleidoscope_grilling:sweet_potato';
export const COMPONENT_ID='kaleidoscope_grilling:sweet_potato_crop_logic';
export const AGE_STATE='kaleidoscope_grilling:age';
export const MAX_AGE=VANILLA_MAX_AGE;
export const COMPOST_CHANCE=65;
export const CROP_DROP_ORDER=Object.freeze([CANOLA_SEEDS_ID,SWEET_POTATO_ID,ONION_ID]);

function clamp01(v){
 const n=Number(v);
 return Math.max(0,Math.min(0.999999999999,Number.isFinite(n)?n:0));
}
export function sweetPotatoSurvive(groundId,light){
 return groundId==='minecraft:farmland'&&Number(light)>=FARMLAND_MIN_SURVIVAL_LIGHT;
}
export function matureSweetPotatoCount(fortuneLevel,randomValues=[]){
 const fortune=Math.max(0,Math.floor(Number(fortuneLevel)||0));
 let count=3;
 for(let i=0;i<fortune+3;i++)if(clamp01(randomValues[i]??0)<MATURE_BONUS_PROBABILITY)count++;
 return count;
}
export function cropDropPlan(randomValues,fortuneLevel){
 const values=Array.from(randomValues??[]);
 const out=[];
 for(let i=0;i<CROP_DROP_ORDER.length;i++){
  const count=acquisitionSeedCount(values[i*2]??0,fortuneLevel);
  if(shouldDropAcquisition(values[i*2+1]??0))out.push({id:CROP_DROP_ORDER[i],count});
 }
 return out;
}

export {
 FARMLAND_MIN_SURVIVAL_LIGHT,MIN_GROWTH_LIGHT,ACQUISITION_CHANCE,MATURE_BONUS_PROBABILITY,STRAW_HATS,
 selectionHeight,bonemealAgeIncrease,javaCropGrowthSpeed,javaCropGrowthChance,shouldAdvanceAge
};
