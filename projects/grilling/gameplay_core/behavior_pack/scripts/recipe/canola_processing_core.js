export const KC_API=1;
export const KC_READY_EVENT='kaleidoscope_cookery:api_ready';
export const KC_REGISTER_EVENT='kaleidoscope_cookery:register_recipe';
export const SOURCE='kaleidoscope_grilling';

export const CANOLA_SEEDS_ID='kaleidoscope_grilling:canola_seeds';
export const CANOLA_POWDER_ID='kaleidoscope_grilling:canola_powder';

const RECIPE=Object.freeze({
 api:KC_API,kind:'millstone',source:SOURCE,
 recipe:Object.freeze({
  id:'kaleidoscope_grilling:millstone/canola_powder',
  input:CANOLA_SEEDS_ID,
  outputs:Object.freeze([Object.freeze({id:CANOLA_POWDER_ID,count:1,chance:1.0})])
 })
});

export function canolaMillstoneRecipe(){return JSON.parse(JSON.stringify(RECIPE))}
export function registrationsForReady(info){
 if(!info||Number(info.api)!==KC_API)return [];
 const caps=new Set(Array.isArray(info.capabilities)?info.capabilities.map(String):[]);
 return caps.has('millstone')?[canolaMillstoneRecipe()]:[];
}
