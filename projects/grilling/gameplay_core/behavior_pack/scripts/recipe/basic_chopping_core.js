export const KC_API=1;
export const KC_READY_EVENT='kaleidoscope_cookery:api_ready';
export const KC_PING_EVENT='kaleidoscope_cookery:api_ping';
export const KC_REGISTER_EVENT='kaleidoscope_cookery:register_recipe';
export const SOURCE='kaleidoscope_grilling';

export const CARROT_DICE_ID='kaleidoscope_grilling:carrot_dice';
export const POTATO_SLICE_ID='kaleidoscope_grilling:potato_slice';
export const CUTS=4;

const RECIPES=Object.freeze([
 Object.freeze({
  api:KC_API,kind:'chopping_board',source:SOURCE,
  recipe:Object.freeze({
   id:'kaleidoscope_grilling:chopping_board/carrot_dice',
   input:'minecraft:carrot',result:CARROT_DICE_ID,count:3,cuts:CUTS
  })
 }),
 Object.freeze({
  api:KC_API,kind:'chopping_board',source:SOURCE,
  recipe:Object.freeze({
   id:'kaleidoscope_grilling:chopping_board/potato_slice',
   input:'minecraft:potato',result:POTATO_SLICE_ID,count:3,cuts:CUTS
  })
 })
]);

export function choppingRecipes(){
 return RECIPES.map(x=>JSON.parse(JSON.stringify(x)));
}
export function registrationsForReady(info){
 if(!info||Number(info.api)!==KC_API)return [];
 const caps=new Set(Array.isArray(info.capabilities)?info.capabilities.map(String):[]);
 return caps.has('chopping_board')?choppingRecipes():[];
}
