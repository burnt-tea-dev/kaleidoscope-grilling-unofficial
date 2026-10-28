export const CROP_ID='kaleidoscope_grilling:houttuynia_crop';
export const HOUTTUYNIA_ID='kaleidoscope_grilling:houttuynia';
export const COMPONENT_ID='kaleidoscope_grilling:houttuynia_crop_logic';
export const AGE_STATE='kaleidoscope_grilling:age';
export const RED_STATE='kaleidoscope_grilling:red_variant';
export const MAX_AGE=7;
export const FARMLAND_MIN_SURVIVAL_LIGHT=8;
export const MIN_GROWTH_LIGHT=9;
export const RED_PLACEMENT_CHANCE=0.3;
export const MATURE_BONUS_PROBABILITY=0.5714286;

function clamp01(v){
 const n=Number(v);
 return Math.max(0,Math.min(0.999999999999,Number.isFinite(n)?n:0));
}
export function placementRedVariant(groundId,random01){
 return groundId==='minecraft:soul_sand'||clamp01(random01)<RED_PLACEMENT_CHANCE;
}
export function canCropSurvive(groundId,light){
 if(groundId==='minecraft:soul_sand')return true;
 return groundId==='minecraft:farmland'&&Number(light)>=FARMLAND_MIN_SURVIVAL_LIGHT;
}
export function selectionHeight(age){
 return Math.max(2,Math.min(16,2+Math.max(0,Math.min(MAX_AGE,Math.floor(Number(age)||0)))*2));
}
export function bonemealAgeIncrease(random01){
 return 2+Math.floor(clamp01(random01)*4);
}
export function wartAgeToCropAge(wartAge){
 const n=Math.max(0,Math.floor(Number(wartAge)||0));
 return n<=0?0:n===1?3:7;
}
export function javaCropGrowthSpeed(cells,neighbors={}){
 let speed=1;
 const list=Array.isArray(cells)?cells:[];
 for(let i=0;i<9;i++){
  const row=list[i]??{};
  let add=0;
  if(row.typeId==='minecraft:farmland')add=Number(row.moisture)>0?3:1;
  if(i!==4)add/=4;
  speed+=add;
 }
 const sameX=!!neighbors.west||!!neighbors.east;
 const sameZ=!!neighbors.north||!!neighbors.south;
 const diagonal=!!neighbors.northWest||!!neighbors.northEast||!!neighbors.southWest||!!neighbors.southEast;
 if((sameX&&sameZ)||diagonal)speed/=2;
 return speed;
}
export function javaCropGrowthChance(speed){
 const s=Math.max(0.000001,Number(speed)||1);
 return 1/(Math.floor(25/s)+1);
}
export function shouldAdvanceAge(light,speed,random01){
 return Number(light)>=MIN_GROWTH_LIGHT&&clamp01(random01)<javaCropGrowthChance(speed);
}
export function matureBonusCount(fortuneLevel,randomValues=[]){
 const fortune=Math.max(0,Math.floor(Number(fortuneLevel)||0));
 let bonus=1;
 for(let i=0;i<fortune+1;i++){
  if(clamp01(randomValues[i]??0)<MATURE_BONUS_PROBABILITY)bonus++;
 }
 return bonus;
}
