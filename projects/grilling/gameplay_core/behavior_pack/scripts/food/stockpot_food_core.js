export const POTATO_BEEF_STEW_ID='kaleidoscope_grilling:potato_beef_stew';
export const RED_SWEET_POTATO_PORRIDGE_ID='kaleidoscope_grilling:red_sweet_potato_porridge';
export const SOUR_SPICY_NOODLES_ID='kaleidoscope_grilling:sour_spicy_noodles';
export const TAVERN_VINEGAR_IDS=Object.freeze([
 'kaleidoscope_tavern:vinegar_q1','kaleidoscope_tavern:vinegar_q2','kaleidoscope_tavern:vinegar_q3',
 'kaleidoscope_tavern:vinegar_q4','kaleidoscope_tavern:vinegar_q5','kaleidoscope_tavern:vinegar_q6'
]);

export const STOCKPOT_FOOD_IDS=Object.freeze([
 POTATO_BEEF_STEW_ID,RED_SWEET_POTATO_PORRIDGE_ID,SOUR_SPICY_NOODLES_ID
]);

export const STOCKPOT_FOODS=Object.freeze({
 [POTATO_BEEF_STEW_ID]:Object.freeze({nutrition:12,saturation:0.9,maxStack:16}),
 [RED_SWEET_POTATO_PORRIDGE_ID]:Object.freeze({nutrition:14,saturation:0.071429,maxStack:16}),
 [SOUR_SPICY_NOODLES_ID]:Object.freeze({nutrition:10,saturation:0.6,maxStack:16})
});

function row(kind,id,ingredients,result,{requiresItems=[],time=300,base='minecraft:water',carrier='minecraft:bowl',finishedKind='default'}={}){
 return Object.freeze({
  kind,id,ingredients:Object.freeze(ingredients.map(slot=>Object.freeze(Array.isArray(slot)?[...slot]:[slot]))),
  result,count:1,time,base,carrier,finishedKind,requiresItems:Object.freeze([...requiresItems])
 });
}

const RECIPES=Object.freeze([
 row('stockpot_exact','kaleidoscope_grilling:stockpot/potato_beef_stew',[
  'kaleidoscope_grilling:beef_chunks','kaleidoscope_grilling:beef_chunks','minecraft:potato',
  'kaleidoscope_grilling:carrot_dice','kaleidoscope_grilling:onion'
 ],POTATO_BEEF_STEW_ID),
 row('stockpot_flex','kaleidoscope_grilling:flex_stockpot/potato_beef_stew',[
  'kaleidoscope_grilling:beef_chunks','minecraft:potato','kaleidoscope_grilling:carrot_dice','kaleidoscope_grilling:onion'
 ],POTATO_BEEF_STEW_ID),
 row('stockpot_exact','kaleidoscope_grilling:stockpot/red_sweet_potato_porridge',[
  'kaleidoscope_grilling:sweet_potato','kaleidoscope_grilling:sweet_potato','kaleidoscope_grilling:sweet_potato',
  'kaleidoscope_cookery:rice','kaleidoscope_cookery:rice','kaleidoscope_cookery:rice'
 ],RED_SWEET_POTATO_PORRIDGE_ID),
 row('stockpot_flex','kaleidoscope_grilling:flex_stockpot/red_sweet_potato_porridge',[
  'kaleidoscope_grilling:sweet_potato','kaleidoscope_cookery:rice'
 ],RED_SWEET_POTATO_PORRIDGE_ID),
 row('stockpot_exact','kaleidoscope_grilling:stockpot/sour_spicy_noodles',[
  TAVERN_VINEGAR_IDS,'kaleidoscope_cookery:red_chili','kaleidoscope_cookery:red_chili',
  'kaleidoscope_grilling:raw_sweet_potato_sheet','kaleidoscope_grilling:raw_sweet_potato_sheet',
  'kaleidoscope_cookery:lettuce'
 ],SOUR_SPICY_NOODLES_ID,{requiresItems:TAVERN_VINEGAR_IDS}),
 row('stockpot_flex','kaleidoscope_grilling:flex_stockpot/sour_spicy_noodles',[
  TAVERN_VINEGAR_IDS,'kaleidoscope_cookery:red_chili',
  'kaleidoscope_grilling:raw_sweet_potato_sheet','kaleidoscope_cookery:lettuce'
 ],SOUR_SPICY_NOODLES_ID,{requiresItems:TAVERN_VINEGAR_IDS})
]);

export function stockpotFoodSpec(id){return STOCKPOT_FOODS[String(id??'')]}
export function stockpotRecipes(){
 return RECIPES.map(x=>({
  kind:x.kind,id:x.id,ingredients:x.ingredients.map(slot=>[...slot]),
  result:x.result,count:x.count,time:x.time,base:x.base,carrier:x.carrier,finishedKind:x.finishedKind,
  requiresItems:[...x.requiresItems]
 }));
}
export function stockpotEffectRows(){
 return [
  Object.freeze({
   itemId:RED_SWEET_POTATO_PORRIDGE_ID,
   effects:Object.freeze([
    Object.freeze({kind:'persistent_fx',effect:'flatulence',ticks:900,amplifier:0,stacking:'max_until'}),
    Object.freeze({kind:'persistent_fx',effect:'warmth',ticks:900,amplifier:0,stacking:'max_until'})
   ])
  }),
  Object.freeze({
   itemId:SOUR_SPICY_NOODLES_ID,
   effects:Object.freeze([
    Object.freeze({kind:'persistent_fx',effect:'warmth',ticks:900,amplifier:0,stacking:'max_until'})
   ])
  })
 ];
}
