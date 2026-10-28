import {
 COOKERY_EMPTY_ID,COOKERY_FILLED_ID,planTypedOilAddition
} from './cookery_oil_pot_core.js';
import {GRILLING_OIL_BUCKET_POINTS,oilTypeForBucketId} from './oil_contract_core.js';

export const ITEM_FILL_POINTS=GRILLING_OIL_BUCKET_POINTS;
export {oilTypeForBucketId};

export function isCookeryOilPotItemId(itemId){
 return itemId===COOKERY_EMPTY_ID||itemId===COOKERY_FILLED_ID;
}

export function planOffhandOilFill(state={},bucketType=''){
 if(!bucketType)return {handled:false,reason:'not_grilling_bucket'};
 if(!state.empty&&!state.filled)return {handled:false,reason:'not_oil_pot'};
 const plan=planTypedOilAddition(state,bucketType,ITEM_FILL_POINTS);
 return {handled:true,...plan};
}
