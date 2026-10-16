import {canonicalFoodId} from './eating_profile_ids.js';
import {failureSourceIndex,failureModelState} from './failure_skewer_visual_core.js';
import {SLIME_ID} from './slime_frame_core.js';
import {PLATE_FAILURE_MODELS} from './plate_special_visual_data.js';

// A plate displays the actual saved stack at bite stage zero. It never owns an
// eating session, and source overrides retain Java's priority over variants.
export function plateSpecialModel(id,source,variants,frame=0){
 id=canonicalFoodId(id);
 if(id===SLIME_ID)return Number.isInteger(frame)&&frame>=0&&frame<5?frame:0;
 const models=PLATE_FAILURE_MODELS[id];if(!models)return undefined;
 const index=failureSourceIndex(source);
 return index?models.sources[index]:models.states[failureModelState(variants)];
}
