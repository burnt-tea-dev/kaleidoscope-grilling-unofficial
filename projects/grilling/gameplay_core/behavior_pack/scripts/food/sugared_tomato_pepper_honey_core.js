export const SUGARED_TOMATO_ID='kaleidoscope_grilling:sugared_tomato';
export const PEPPER_HONEY_ID='kaleidoscope_grilling:pepper_honey';
export const PEPPER_HONEY_NUMB_TICKS=1200;

export const A2749_FOODS=Object.freeze({
 [SUGARED_TOMATO_ID]:Object.freeze({nutrition:6,saturation:0.65,maxStack:64}),
 [PEPPER_HONEY_ID]:Object.freeze({nutrition:4,saturation:0.25,maxStack:64})
});

export function pepperHoneyEffectRow(){
 return Object.freeze({
  itemId:PEPPER_HONEY_ID,
  effects:Object.freeze([
   Object.freeze({
    kind:'persistent_fx',
    effect:'numb',
    ticks:PEPPER_HONEY_NUMB_TICKS,
    amplifier:0,
    stacking:'max_until'
   })
  ])
 });
}

export function a2749FoodSpec(id){
 return A2749_FOODS[String(id??'')];
}
