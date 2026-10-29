import {PERSISTED_KEY as PersistedKey} from './core/persist_keys.js';
// Pinned SkeweringHandler: stored 4..9 values carry shape and GUI-variant bits.
// Low-byte food indices preserve old client properties during migration.
export const SECRET_MODEL_VARIANTS_KEY=PersistedKey.MODEL_VARIANTS;
export const SECRET_FOOD_COUNT=225;
export const SECRET_VISUAL_MAX=5345; // 225 foods + 256*(2 shapes + 3*6 stage styles)
// Preserve old helpers 0..213 and 221..224. Markers 214..220 and
// 225..226 belong to other hand-bank owners; new foods use 227..234.
export function secretHeldMarker(food){
 if(!Number.isInteger(food)||food<0||food>SECRET_FOOD_COUNT)throw Error('Grilling: invalid secret helper index');
 return food<=213?food:food<=217?food+7:food+9;
}
export function modelVariant(value){
 return Number.isInteger(value)&&value>=4&&value<=9?(value-4)%3+1:Number.isInteger(value)&&value>=1&&value<=3?value:0;
}
export function readModelVariants(raw,count=3){
 let values;try{values=typeof raw==='string'?JSON.parse(raw):raw}catch{}
 // Pre-repair Bedrock stacks never stored Java variants. Use stable shape1;
 // do not mutate an old stack or pretend its lost random values were recovered.
 return Array.from({length:Math.max(0,Math.min(3,count))},(_,i)=>modelVariant(values?.[i])?values[i]:4);
}
export function appendedModelVariants(raw,count,random=Math.random){
 return [...readModelVariants(raw,count),4+Math.min(5,Math.max(0,Math.floor(random()*6)))].slice(0,3);
}
export function encodeSecretVisual(foodIndex,variant=4,stage=0,cookedSnapshot=false){
 if(!Number.isInteger(foodIndex)||foodIndex<1||foodIndex>SECRET_FOOD_COUNT)return 0;
 const shape=modelVariant(variant)||1,visualStage=Math.min(5,Math.max(0,Math.floor(Number(stage)||0)));
 const style=visualStage===4&&cookedSnapshot?6:visualStage;
 return foodIndex+256*(shape-1+3*style);
}
export function decodeSecretVisual(value){
 const packed=Math.min(SECRET_VISUAL_MAX,Math.max(0,Math.floor(Number(value)||0))),food=packed%256;
 return {food:food<=SECRET_FOOD_COUNT?food:0,shape:Math.floor(packed/256)%3+1,style:Math.floor(packed/768)};
}

// Partial attachables reuse the stage field for actual ingredient count (0–2).
// Their own palette controller always selects raw style0, never cooking glaze.
export function encodePartialVisual(foodIndex,variant,count){
 const food=Number.isInteger(foodIndex)&&foodIndex>=1&&foodIndex<=SECRET_FOOD_COUNT?foodIndex:0;
 const shape=modelVariant(variant)||1;
 return count>=1&&count<=2?food+256*(shape-1+3*count):0;
}
