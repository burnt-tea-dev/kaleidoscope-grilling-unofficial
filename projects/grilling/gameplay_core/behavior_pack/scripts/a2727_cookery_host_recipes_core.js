import {wokRecipes} from './a2750_wok_food_core.js';
import {stockpotRecipes} from './a2752_stockpot_food_core.js';

export const KC_API=1;
export const KC_READY_EVENT='kaleidoscope_cookery:api_ready';
export const KC_PING_EVENT='kaleidoscope_cookery:api_ping';
export const KC_REGISTER_EVENT='kaleidoscope_cookery:register_recipe';
export const SOURCE='kaleidoscope_grilling';

function board(id,input,result,count=1,cuts=4){
 return Object.freeze({
  capability:'chopping_board',
  payload:Object.freeze({
   api:KC_API,kind:'chopping_board',source:SOURCE,
   recipe:Object.freeze({id,input,result,count,cuts})
  })
 });
}
function millstone(id,input,result,count=1,chance=1.0){
 return Object.freeze({
  capability:'millstone',
  payload:Object.freeze({
   api:KC_API,kind:'millstone',source:SOURCE,
   recipe:Object.freeze({
    id,input,
    outputs:Object.freeze([Object.freeze({id:result,count,chance})])
   })
  })
 });
}

function wok(recipe){
 return Object.freeze({
  capability:'wok',
  payload:Object.freeze({
   api:KC_API,kind:'wok',source:SOURCE,
   recipe:Object.freeze({
    id:recipe.id,ingredients:Object.freeze([...recipe.ingredients]),
    result:recipe.result,count:recipe.count,carrier:recipe.carrier,time:recipe.time,stirs:recipe.stirs
   })
  })
 });
}

function stockpot(recipe){
 return Object.freeze({
  capability:recipe.kind,
  requiresItems:Object.freeze([...(recipe.requiresItems??[])]),
  payload:Object.freeze({
   api:KC_API,kind:recipe.kind,source:SOURCE,
   recipe:Object.freeze({
    id:recipe.id,
    ingredients:Object.freeze(recipe.ingredients.map(slot=>Object.freeze([...slot]))),
    result:recipe.result,count:recipe.count,time:recipe.time,base:recipe.base,
    carrier:recipe.carrier,finishedKind:recipe.finishedKind
   })
  })
 });
}

export const BOARD_V2_RECIPES=Object.freeze([
 {api:1,kind:'chopping_board_v2',source:'kaleidoscope_grilling:board_api',recipe:{id:'kaleidoscope_grilling:chopping_board/beef_chunks',input:'minecraft:beef',builtin:{result:'kaleidoscope_cookery:raw_cow_offal',count:3,cuts:4},mode:'replace',result:'kaleidoscope_grilling:beef_chunks',count:2}},
 {api:1,kind:'chopping_board_v2',source:'kaleidoscope_grilling:board_api',recipe:{id:'kaleidoscope_grilling:chopping_board/chicken_skin',input:'minecraft:chicken',builtin:{outputs:[{id:'kaleidoscope_cookery:raw_cut_small_meats',count:3},{id:'minecraft:bone',count:1}],cuts:4},mode:'supplement',bonusOutputs:[{id:'kaleidoscope_grilling:chicken_skin',min:1,max:3}]}}
]);
const RECIPES=Object.freeze([
 ...BOARD_V2_RECIPES.map(payload=>({capability:'chopping_board_v2',payload})),
 board('kaleidoscope_grilling:chopping_board/raw_sweet_potato_sheet',
  'kaleidoscope_grilling:sweet_potato_powder','kaleidoscope_grilling:raw_sweet_potato_sheet',1,4),
 millstone('kaleidoscope_grilling:millstone/sweet_potato_powder',
  'kaleidoscope_grilling:sweet_potato','kaleidoscope_grilling:sweet_potato_powder',1,1.0),
 board('kaleidoscope_grilling:chopping_board/carrot_dice',
  'minecraft:carrot','kaleidoscope_grilling:carrot_dice',3,4),
 board('kaleidoscope_grilling:chopping_board/potato_slice',
  'minecraft:potato','kaleidoscope_grilling:potato_slice',3,4),
 board('kaleidoscope_grilling:chopping_board/raw_mantou_slice',
  'kaleidoscope_cookery:mantou','kaleidoscope_grilling:raw_mantou_slice',3,4),
 board('kaleidoscope_grilling:chopping_board/minced_houttuynia',
  'kaleidoscope_grilling:houttuynia','kaleidoscope_grilling:minced_houttuynia',1,4),
 millstone('kaleidoscope_grilling:millstone/canola_powder',
  'kaleidoscope_grilling:canola_seeds','kaleidoscope_grilling:canola_powder',1,1.0),
 millstone('kaleidoscope_grilling:millstone/onion_powder',
  'kaleidoscope_grilling:onion','kaleidoscope_grilling:onion_powder',1,1.0),
 millstone('kaleidoscope_grilling:millstone/red_chili_powder',
  'kaleidoscope_cookery:red_chili','kaleidoscope_grilling:red_chili_powder',1,1.0),
 millstone('kaleidoscope_grilling:millstone/green_chili_powder',
  'kaleidoscope_cookery:green_chili','kaleidoscope_grilling:green_chili_powder',1,1.0),
 millstone('kaleidoscope_grilling:millstone/houttuynia_powder',
  'kaleidoscope_grilling:houttuynia','kaleidoscope_grilling:houttuynia_powder',1,1.0),
 millstone('kaleidoscope_grilling:millstone/totem_powder',
  'minecraft:totem_of_undying','kaleidoscope_grilling:totem_powder',1,1.0),
 ...wokRecipes().map(wok),
 ...stockpotRecipes().map(stockpot),
]);

export function recipeTable(){
 return RECIPES.map(x=>({
  capability:x.capability,
  requiresItems:[...(x.requiresItems??[])],
  payload:JSON.parse(JSON.stringify(x.payload))
 }));
}
export function recipesForReady(info,{availableItems=[]}={}){
 if(!info||Number(info.api)!==KC_API)return [];
 const caps=new Set(Array.isArray(info.capabilities)?info.capabilities.map(String):[]);
 const available=new Set(Array.isArray(availableItems)?availableItems.map(String):[]);
 return RECIPES.filter(x=>
  caps.has(x.capability)&&(x.requiresItems??[]).every(id=>available.has(id))
 ).map(x=>JSON.parse(JSON.stringify(x.payload)));
}
