import {getItemProperty} from '../core/persist.js';
import {canonicalFoodId} from '../eating_profile_ids.js';
import {SECRET_ID,SKEWER_INGREDIENTS_KEY,SECRET_COOKED_KEY,SECRET_COOKED_INGREDIENTS_KEY} from './skewering_core.js';

export function readRowsFromKey(stack,key){
 const raw=getItemProperty(stack,key);if(raw===undefined)return [];
 if(typeof raw!=='string')throw Error('Grilling: invalid ingredient data');
 const rows=JSON.parse(raw);
 if(!Array.isArray(rows)||rows.length>3||rows.some(x=>!x||typeof x.id!=='string'))throw Error('Grilling: invalid ingredient rows');
 return rows;
}
export function readSkewerRows(stack){return readRowsFromKey(stack,SKEWER_INGREDIENTS_KEY)}
export function isSecretCooked(stack){try{return canonicalFoodId(stack?.typeId)===SECRET_ID&&getItemProperty(stack,SECRET_COOKED_KEY)===true}catch{return false}}
// Display owners may request the cooked snapshot before cooking is committed.
export function readEffectiveSkewerRows(stack,preferCookedSnapshot=isSecretCooked(stack)){
 if(preferCookedSnapshot){const cooked=readRowsFromKey(stack,SECRET_COOKED_INGREDIENTS_KEY);if(cooked.length)return cooked}
 return readSkewerRows(stack);
}
