export const KC_API=1;
export const KC_READY_EVENT='kaleidoscope_cookery:api_ready';
export const KC_REGISTER_EVENT='kaleidoscope_cookery:register_recipe';
export const SOURCE='kaleidoscope_grilling';

export const HOUTTUYNIA_ID='kaleidoscope_grilling:houttuynia';
export const MINCED_HOUTTUYNIA_ID='kaleidoscope_grilling:minced_houttuynia';
export const CUTS=4;
export const OUTPUT_COUNT=1;

const RECIPE=Object.freeze({
 api:KC_API,kind:'chopping_board',source:SOURCE,
 recipe:Object.freeze({
  id:'kaleidoscope_grilling:chopping_board/minced_houttuynia',
  input:HOUTTUYNIA_ID,result:MINCED_HOUTTUYNIA_ID,count:OUTPUT_COUNT,cuts:CUTS
 })
});

export function houttuyniaChoppingRecipe(){
 return JSON.parse(JSON.stringify(RECIPE));
}
export function registrationsForReady(info){
 if(!info||Number(info.api)!==KC_API)return [];
 const caps=new Set(Array.isArray(info.capabilities)?info.capabilities.map(String):[]);
 return caps.has('chopping_board')?[houttuyniaChoppingRecipe()]:[];
}
