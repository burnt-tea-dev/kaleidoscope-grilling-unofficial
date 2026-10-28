export const KC_API=1;
export const KC_READY_EVENT='kaleidoscope_cookery:api_ready';
export const KC_PING_EVENT='kaleidoscope_cookery:api_ping';
export const KC_REGISTER_EVENT='kaleidoscope_cookery:register_recipe';
export const SOURCE='kaleidoscope_grilling';

export const SWEET_POTATO_ID='kaleidoscope_grilling:sweet_potato';
export const POWDER_ID='kaleidoscope_grilling:sweet_potato_powder';
export const SHEET_ID='kaleidoscope_grilling:raw_sweet_potato_sheet';
export const BOARD_CUTS=4;

const RECIPES=Object.freeze([
 Object.freeze({
  capability:'chopping_board',
  payload:Object.freeze({
   api:KC_API,kind:'chopping_board',source:SOURCE,
   recipe:Object.freeze({
    id:'kaleidoscope_grilling:chopping_board/raw_sweet_potato_sheet',
    input:POWDER_ID,result:SHEET_ID,count:1,cuts:BOARD_CUTS
   })
  })
 }),
 Object.freeze({
  capability:'millstone',
  payload:Object.freeze({
   api:KC_API,kind:'millstone',source:SOURCE,
   recipe:Object.freeze({
    id:'kaleidoscope_grilling:millstone/sweet_potato_powder',
    input:SWEET_POTATO_ID,
    outputs:Object.freeze([Object.freeze({id:POWDER_ID,count:1,chance:1.0})])
   })
  })
 })
]);

export function recipeTable(){
 return RECIPES.map(x=>({capability:x.capability,payload:JSON.parse(JSON.stringify(x.payload))}));
}

export function recipesForReady(info){
 if(!info||Number(info.api)!==KC_API)return [];
 const caps=new Set(Array.isArray(info.capabilities)?info.capabilities.map(String):[]);
 return RECIPES.filter(x=>caps.has(x.capability)).map(x=>JSON.parse(JSON.stringify(x.payload)));
}
