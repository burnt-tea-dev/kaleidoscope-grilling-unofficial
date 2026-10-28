import {
 HOST_FAT_CAPACITY,GRILLING_FLUID_CAPACITY,GRILLING_OIL_BUCKET_POINTS,
 GRILLING_OIL_TYPES,normalizeOilType,oilCapacity,oilTypeForBucketId
} from './oil_contract_core.js';

export {
 HOST_FAT_CAPACITY,GRILLING_FLUID_CAPACITY,GRILLING_OIL_BUCKET_POINTS,
 GRILLING_OIL_TYPES,normalizeOilType,oilCapacity,oilTypeForBucketId
};

export const COOKERY_EMPTY_ID='kaleidoscope_cookery:oil_pot';
export const COOKERY_FILLED_ID='kaleidoscope_cookery:oil_pot_filled';
export const HOST_COUNT_KEY='kc_oil_count';
export const GRILLING_TYPE_KEY='kaleidoscope_grilling:oil_type';

export function normalizeOilCount({
 filled=false,type='',raw=undefined,hasRaw=false,legacyPlacementFallback=false
}={}){
 if(!filled)return 0;
 const cap=oilCapacity(type);
 if(!hasRaw)return legacyPlacementFallback?cap:0;
 const n=Number(raw);
 return Math.max(0,Math.min(cap,Number.isFinite(n)?Math.floor(n):0));
}

export function planOilConsumption(state={},needed=1,requiredType=''){
 if(!state.filled)return {ok:false,reason:'not_pot',count:0};
 const type=normalizeOilType(state.type);
 const count=normalizeOilCount({filled:true,type,raw:state.count,hasRaw:true});
 const required=normalizeOilType(requiredType);
 if(required&&type!==required)return {ok:false,reason:'wrong_oil',type,count};
 const use=Math.max(0,Math.floor(Number(needed)||0));
 if(use<=0)return {ok:false,reason:'invalid_amount',type,count};
 if(count<use)return {ok:false,reason:'insufficient',type,count};
 return {ok:true,type,count,used:use,remaining:count-use,capacity:oilCapacity(type)};
}

export function planTypedOilAddition(state={},incomingType='',points=0){
 const type=normalizeOilType(incomingType);
 const add=Math.max(0,Math.floor(Number(points)||0));
 if(!type||add<=0)return {ok:false,reason:'invalid_input'};
 if(!state.empty&&!state.filled)return {ok:false,reason:'not_pot'};

 const currentType=normalizeOilType(state.type);
 const currentCount=Math.max(0,Math.floor(Number(state.count)||0));
 if(currentType&&currentType!==type)return {ok:false,reason:'different_oil',type:currentType,count:currentCount};
 if(!currentType&&currentCount>0)return {ok:false,reason:'native_fat',type:'',count:currentCount};

 const nextCount=currentCount+add;
 if(nextCount>GRILLING_FLUID_CAPACITY)return {ok:false,reason:'full',type:currentType||type,count:currentCount};
 return {
  ok:true,type:currentType||type,count:currentCount,added:add,nextCount,
  capacity:GRILLING_FLUID_CAPACITY
 };
}
