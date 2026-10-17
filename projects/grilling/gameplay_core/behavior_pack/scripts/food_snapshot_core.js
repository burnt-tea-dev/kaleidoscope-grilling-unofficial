import {VANILLA_FOOD_NUTRITION} from './vanilla_food_nutrition.js';
import {readPublicFood,readPublicFoodLore} from './host_api/food_api_core.js';
import {isQualityCuisineFood,cuisineQualityOfItem,cuisineQualityPayloadMatches,cuisineQualityFoodSpec} from './host_api/cuisine_quality_core.js';
// ItemFoodComponent is only exposed for data-driven foods. Native vanilla foods
// use the pinned Mojang definition fallback, never an invented tag-derived value.
export function foodFacts(stack){
 if(isQualityCuisineFood(stack?.typeId)&&!cuisineQualityPayloadMatches(stack.typeId,readPublicFood(stack)))return {edible:false,nutrition:0,saturation:0,convertTo:''};
 const food=stack?.getComponent('minecraft:food');
 if(food)return {edible:true,nutrition:Number(food.nutrition)||0,saturation:Number(food.saturationModifier)||0,convertTo:String(food.usingConvertsTo??'')};
 const known=VANILLA_FOOD_NUTRITION[stack?.typeId];
 return known?{...known,edible:true}:{edible:false,nutrition:0,saturation:0,convertTo:''};
}
export function ingredientFoodFacts(row){
 if(isQualityCuisineFood(row?.id)&&row?.native&&!cuisineQualityPayloadMatches(row.id,readPublicFoodLore(row.native.rawLore??[])))return {...row,edible:false,nutrition:0,saturation:0,convertTo:''};
 if(cuisineQualityOfItem(row?.id)!==undefined){
  // Quality dishes did not exist in legacy snapshots. Require their complete
  // native envelope: cached nutrition alone cannot certify a saved quality.
  const native=row?.native,portable=readPublicFoodLore(native?.rawLore??[]);
  if(native?.version!==1||native.id!==row.id||!cuisineQualityPayloadMatches(row.id,portable))return {...row,edible:false,nutrition:0,saturation:0,convertTo:''};
  const food=cuisineQualityFoodSpec(row.id);
  return {...row,edible:true,nutrition:food.nutrition,saturation:food.saturation,convertTo:''};
 }
 // Repair old snapshots captured before vanilla foods were queryable. Explicit
 // data-driven food snapshots remain authoritative, including zero-nutrition food.
 const known=VANILLA_FOOD_NUTRITION[row?.id];
 if(known&&!row?.edible&&row?.nutrition===0)return {...row,...known,edible:true};
 // Older ID-only saves can recover their food facts from the same pinned
 // definition. Missing fields are distinct from an explicitly saved zero.
 if(known&&(row.nutrition===undefined||row.saturation===undefined||row.edible===undefined))return {...row,nutrition:row.nutrition??known.nutrition,saturation:row.saturation??known.saturation,edible:row.edible??true,convertTo:row.convertTo??known.convertTo};
 return row??{};
}
