import {foodFacts,ingredientFoodFacts} from './food_snapshot_core.js';
import {readPublicFoodLore} from './host_api/food_api_core.js';
import {cuisineQualityPayloadMatches} from './host_api/cuisine_quality_core.js';

// Admission follows saved ingredients, never the held model's palette. A valid
// three-item combination may contain configured nonfood or zero-nutrition food.
// Resolve only missing legacy facts from the installed item definition; explicit
// saved zero values and the original metadata/duplicate identity remain intact.
export function secretEatingRows(rows,createItem){
 try{
  if(!Array.isArray(rows)||rows.length!==3)return undefined;
  return rows.map(row=>{
   if(!row||typeof row!=='object'||Array.isArray(row)||typeof row.id!=='string'||!/^[a-z0-9_.-]+:[a-z0-9_./-]+$/.test(row.id)||row.id==='minecraft:air')throw Error('Invalid secret ingredient');
   if(row.native!==undefined&&(!row.native||row.native.version!==1||row.native.id!==row.id))throw Error('Invalid secret ingredient snapshot');
   for(const key of ['nutrition','saturation'])if(row[key]!==undefined&&(!Number.isFinite(row[key])||row[key]<0))throw Error('Invalid saved food value');
   if(row.edible!==undefined&&typeof row.edible!=='boolean')throw Error('Invalid saved food eligibility');
   if(row.convertTo!==undefined&&typeof row.convertTo!=='string')throw Error('Invalid saved food remainder');
   const item=createItem(row.id);
   if(!item||item.typeId==='minecraft:air')throw Error('Unavailable secret ingredient');
   const rawLore=row.native?.rawLore??row.lore??[];
   if(!cuisineQualityPayloadMatches(row.id,readPublicFoodLore(rawLore)))throw Error('Invalid saved cuisine quality');
   const saved=ingredientFoodFacts(row);
   if(saved.nutrition!==undefined&&saved.saturation!==undefined&&saved.edible!==undefined&&saved.convertTo!==undefined)return saved;
   const defaults=foodFacts({typeId:row.id,getComponent:id=>item.getComponent(id),getRawLore:()=>rawLore});
   const result={...saved,nutrition:saved.nutrition??defaults.nutrition,saturation:saved.saturation??defaults.saturation,edible:saved.edible??defaults.edible,convertTo:saved.convertTo??defaults.convertTo};
   if(!Number.isFinite(result.nutrition)||result.nutrition<0||!Number.isFinite(result.saturation)||result.saturation<0)throw Error('Unreadable ingredient food definition');
   return result;
  });
 }catch{return undefined;}
}
