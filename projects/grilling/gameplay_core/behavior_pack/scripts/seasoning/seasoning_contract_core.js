import {DEFAULT_SEASONING_EFFECTS,seasoningKind,hasSeasoningMapping} from '../seasoning_registry_core.js';
export const SEASONING_CAPACITY=8;
export const SEASONING_MAX_BOTTLES=4;
export const SEASONING_MAX_USES=16;
export const SEASONING_VARIANT_MAX=7;

export const PENDING_SEASONING_ID='kaleidoscope_grilling:pending_seasoning';
export const EMPTY_BOTTLE_ID='kaleidoscope_grilling:empty_seasoning_bottle';
const PARTIAL_FILL=/^kaleidoscope_grilling:partial_seasoning_f[1-8]$/;
const PENDING_FILL=/^kaleidoscope_grilling:pending_seasoning_f[1-8]$/;
export function isEmptySeasoningId(id){return id===EMPTY_BOTTLE_ID||(typeof id==='string'&&PARTIAL_FILL.test(id))}
export function isPendingSeasoningId(id){return id===PENDING_SEASONING_ID||(typeof id==='string'&&PENDING_FILL.test(id))}
export function canonicalSeasoningBottleId(id){return isEmptySeasoningId(id)?EMPTY_BOTTLE_ID:isPendingSeasoningId(id)?PENDING_SEASONING_ID:id}
// A fill proxy records presentation only. Existing PENDING never becomes EMPTY
// because its ingredient list happens to lack a base ingredient.
export function seasoningFillVisualId(id,ingredients=[]){
 const base=canonicalSeasoningBottleId(id),fill=normalizeSeasoningList(ingredients).length;
 if(base!==EMPTY_BOTTLE_ID&&base!==PENDING_SEASONING_ID)return id;
 return fill?'kaleidoscope_grilling:'+(base===PENDING_SEASONING_ID?'pending':'partial')+'_seasoning_f'+fill:base;
}

export const SEASONING_PLACE_BLOCK_ID='kaleidoscope_grilling:seasoning_bottle_1';
export const SEASONING_BLOCK_IDS=Object.freeze([
 'kaleidoscope_grilling:seasoning_bottle',
 'kaleidoscope_grilling:seasoning_bottle_1',
 'kaleidoscope_grilling:seasoning_bottle_2',
 'kaleidoscope_grilling:seasoning_bottle_3',
 'kaleidoscope_grilling:seasoning_bottle_4'
]);

export const SEASONING_LIST_KEY='kaleidoscope_grilling:seasonings';
export const SEASONING_USES_KEY='kaleidoscope_grilling:uses';
export const SEASONING_VARIANT_KEY='kaleidoscope_grilling:variant';

export const BASE_SEASONINGS=Object.freeze([
 'kaleidoscope_grilling:green_chili_powder',
 'kaleidoscope_grilling:sichuan_pepper',
 'kaleidoscope_grilling:onion_powder'
]);

export const SEASONING_KINDS=Object.freeze({
 ...DEFAULT_SEASONING_EFFECTS,
 'kaleidoscope_grilling:green_chili_powder':'base',
 'kaleidoscope_grilling:onion_powder':'base'
});
export function isSeasoningIngredient(id){return BASE_SEASONINGS.includes(id)||hasSeasoningMapping(id);}

const BLOCK_IDS=new Set(SEASONING_BLOCK_IDS);
const EFFECT_ORDER=Object.freeze(['speed','strength','duration','totem','vitality']);

export function isSeasoningBlockId(id){return BLOCK_IDS.has(String(id??''))}

export function normalizeSeasoningList(values){
 if(!Array.isArray(values))return [];
 return values.filter(x=>typeof x==='string').slice(0,SEASONING_CAPACITY);
}

export function hasSeasoningBase(values){
 const list=normalizeSeasoningList(values);
 return BASE_SEASONINGS.every(x=>list.includes(x));
}

export function normalizeBottleData(row={}){
 const kind=['empty','pending','special'].includes(row?.kind)?row.kind:'empty';
 return {
  kind,
  ingredients:normalizeSeasoningList(row?.ingredients),
  uses:Math.max(0,Math.min(SEASONING_MAX_USES,Number(row?.uses)||0))|0,
  variant:Math.max(0,Math.min(SEASONING_VARIANT_MAX,Number(row?.variant)||0))|0
 };
}

export function normalizeBottleStack(rows){
 if(!Array.isArray(rows))return [];
 return rows.slice(0,SEASONING_MAX_BOTTLES).map(normalizeBottleData);
}

export function remainingSeasoningUses(row={}){
 const data=normalizeBottleData(row);
 return data.kind==='special'?Math.max(0,SEASONING_MAX_USES-data.uses):0;
}

export function seasoningEffectCounts(values){
 const out={speed:0,strength:0,duration:0,totem:0,vitality:0,numbness:0};
 for(const id of Array.isArray(values)?values:[]){
  const kind=seasoningKind(id);
  if(Object.hasOwn(out,kind))out[kind]++;
 }
 return out;
}

export function seasoningEffectRows(values){
 const counts=seasoningEffectCounts(values),rows=[];
 for(const kind of EFFECT_ORDER)if(counts[kind]>0)rows.push({kind,count:counts[kind],active:true});
 if(counts.numbness>0)rows.push({kind:'numbness',count:counts.numbness,active:counts.numbness>=4});
 return rows;
}
