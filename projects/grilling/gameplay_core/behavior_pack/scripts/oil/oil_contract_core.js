export const HOST_FAT_CAPACITY=256;
export const GRILLING_FLUID_CAPACITY=64;
export const GRILLING_OIL_BUCKET_POINTS=8;

export const GRILLING_OIL_TYPES=Object.freeze([
 'canola','secret_chili','premium_chili'
]);

const GRILLING_TYPES=new Set(GRILLING_OIL_TYPES);

export function normalizeOilType(value){
 const type=String(value??'');
 return GRILLING_TYPES.has(type)?type:'';
}

export function oilCapacity(type){
 return normalizeOilType(type)?GRILLING_FLUID_CAPACITY:HOST_FAT_CAPACITY;
}

export function oilTypeForBucketId(itemId,oilTypes={}){
 for(const [type,row] of Object.entries(oilTypes??{})){
  if(row?.bucket===itemId)return normalizeOilType(type);
 }
 return '';
}
