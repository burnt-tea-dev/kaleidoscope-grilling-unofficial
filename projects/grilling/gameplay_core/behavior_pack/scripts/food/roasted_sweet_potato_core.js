export const ROASTED_ID='kaleidoscope_grilling:roasted_sweet_potato';
export const INPUT_ID='kaleidoscope_grilling:sweet_potato';
export const WARMTH_EFFECT='warmth';
export const WARMTH_TICKS=600;
export const NUTRITION=6;
export const SATURATION_MODIFIER=0.2;
export const STATION_TAGS=Object.freeze(['furnace','smoker','campfire','soul_campfire']);

export function roastedRecipe(){
 return {
  format_version:'1.20.10',
  'minecraft:recipe_furnace':{
   description:{identifier:'kaleidoscope_grilling:roasted_sweet_potato'},
   tags:[...STATION_TAGS],
   input:INPUT_ID,
   output:ROASTED_ID
  }
 };
}

export function nextWarmthUntil(nowTick,currentUntil=0,duration=WARMTH_TICKS){
 const now=Math.max(0,Math.floor(Number(nowTick)||0));
 const current=Math.max(0,Math.floor(Number(currentUntil)||0));
 const candidate=now+Math.max(1,Math.floor(Number(duration)||WARMTH_TICKS));
 return Math.max(current,candidate);
}
