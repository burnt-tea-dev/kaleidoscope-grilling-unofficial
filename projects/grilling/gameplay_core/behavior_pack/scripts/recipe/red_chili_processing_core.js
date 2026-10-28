export const KC_API=1;
export const KC_READY_EVENT='kaleidoscope_cookery:api_ready';
export const KC_REGISTER_EVENT='kaleidoscope_cookery:register_recipe';
export const SOURCE='kaleidoscope_grilling';

export const RED_CHILI_ID='kaleidoscope_cookery:red_chili';
export const RED_CHILI_POWDER_ID='kaleidoscope_grilling:red_chili_powder';
export const CANOLA_OIL_BUCKET_ID='kaleidoscope_grilling:canola_oil_bucket';
export const SECRET_CHILI_OIL_BUCKET_ID='kaleidoscope_grilling:secret_chili_oil_bucket';

const MILLSTONE_RECIPE=Object.freeze({
 api:KC_API,kind:'millstone',source:SOURCE,
 recipe:Object.freeze({
  id:'kaleidoscope_grilling:millstone/red_chili_powder',
  input:RED_CHILI_ID,
  outputs:Object.freeze([Object.freeze({id:RED_CHILI_POWDER_ID,count:1,chance:1.0})])
 })
});

export function redChiliMillstoneRecipe(){return JSON.parse(JSON.stringify(MILLSTONE_RECIPE))}
export function registrationsForReady(info){
 if(!info||Number(info.api)!==KC_API)return [];
 const caps=new Set(Array.isArray(info.capabilities)?info.capabilities.map(String):[]);
 return caps.has('millstone')?[redChiliMillstoneRecipe()]:[];
}
export function secretChiliOilRecipe(){
 return {
  format_version:'1.20.10',
  'minecraft:recipe_shapeless':{
   description:{identifier:'kaleidoscope_grilling:secret_chili_oil'},
   tags:['crafting_table'],
   ingredients:[
    {item:CANOLA_OIL_BUCKET_ID},
    {item:RED_CHILI_POWDER_ID},
    {item:RED_CHILI_POWDER_ID},
    {item:RED_CHILI_POWDER_ID}
   ],
   result:{item:SECRET_CHILI_OIL_BUCKET_ID,count:1}
  }
 };
}
