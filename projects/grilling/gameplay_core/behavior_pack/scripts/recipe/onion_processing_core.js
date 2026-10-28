export const KC_API=1;
export const KC_READY_EVENT='kaleidoscope_cookery:api_ready';
export const KC_REGISTER_EVENT='kaleidoscope_cookery:register_recipe';
export const SOURCE='kaleidoscope_grilling';

export const ONION_ID='kaleidoscope_grilling:onion';
export const ONION_POWDER_ID='kaleidoscope_grilling:onion_powder';

const RECIPE=Object.freeze({
 api:KC_API,kind:'millstone',source:SOURCE,
 recipe:Object.freeze({
  id:'kaleidoscope_grilling:millstone/onion_powder',
  input:ONION_ID,
  outputs:Object.freeze([Object.freeze({id:ONION_POWDER_ID,count:1,chance:1.0})])
 })
});

export function onionMillstoneRecipe(){return JSON.parse(JSON.stringify(RECIPE))}
export function registrationsForReady(info){
 if(!info||Number(info.api)!==KC_API)return [];
 const caps=new Set(Array.isArray(info.capabilities)?info.capabilities.map(String):[]);
 return caps.has('millstone')?[onionMillstoneRecipe()]:[];
}
