import {PERSISTED_KEY as PersistedKey} from '../core/persist_keys.js';
import {
 HOST_FAT_CAPACITY,GRILLING_FLUID_CAPACITY,GRILLING_OIL_BUCKET_POINTS,normalizeOilType,planTypedOilAddition
} from './cookery_oil_pot_core.js';

export const HOST_BLOCK_ID='kaleidoscope_cookery:oil_pot';
export const HOST_FAT_ITEM_ID='kaleidoscope_cookery:oil';
export const HOST_BLOCK_COUNT_PREFIX=PersistedKey.COOKERY_OIL_BLOCK_PREFIX;
export const TYPE_KEY_PREFIX=PersistedKey.A2736_OILPOT_TYPE_PREFIX;
export const OIL_BUCKET_POINTS=GRILLING_OIL_BUCKET_POINTS;

const FACE_OFFSET=Object.freeze({
 Up:[0,1,0],Down:[0,-1,0],East:[1,0,0],West:[-1,0,0],North:[0,0,-1],South:[0,0,1]
});

function enc(n){return n<0?'m'+Math.abs(n):'p'+n}
function dimKey(id){return String(id??'').replace(/[^a-z0-9]/gi,'_')}

export function hostBlockCountKey(dimensionId,x,y,z){
 return HOST_BLOCK_COUNT_PREFIX+String(dimensionId)+':'+x+','+y+','+z;
}

export function typedOilBlockKey(dimensionId,x,y,z){
 return TYPE_KEY_PREFIX+dimKey(dimensionId)+'_'+enc(x)+'_'+enc(y)+'_'+enc(z);
}

export function placementCandidateLocations(location,face){
 const base={x:location.x,y:location.y,z:location.z};
 const o=FACE_OFFSET[String(face)]??[0,1,0];
 return [base,{x:base.x+o[0],y:base.y+o[1],z:base.z+o[2]}];
}

export function normalizePlacedOilCount(type,raw){
 const t=normalizeOilType(type);
 const cap=t?GRILLING_FLUID_CAPACITY:HOST_FAT_CAPACITY;
 const n=Number(raw);
 return Math.max(0,Math.min(cap,Number.isFinite(n)?Math.floor(n):0));
}

export function planPlacedTypedOilAddition(type,count,incomingType,points=OIL_BUCKET_POINTS){
 const currentType=normalizeOilType(type);
 const currentCount=normalizePlacedOilCount(currentType,count);
 return planTypedOilAddition({filled:true,empty:false,type:currentType,count:currentCount},incomingType,points);
}

export function blocksNativeCookeryInteraction(type,itemId){
 return !!normalizeOilType(type)&&(itemId===undefined||itemId===null||itemId===''||itemId===HOST_FAT_ITEM_ID);
}
