export const BOARD_ID='kaleidoscope_cookery:chopping_board';
export const CHICKEN_ID='minecraft:chicken';
export const CHICKEN_SKIN_ID='kaleidoscope_grilling:chicken_skin';
export const CHICKEN_WING_ID='kaleidoscope_grilling:chicken_wing';
export const RAW_SMALL_MEATS_ID='kaleidoscope_cookery:raw_cut_small_meats';
export const CUTS=4;

export const KITCHEN_KNIVES=Object.freeze([
 'kaleidoscope_cookery:iron_kitchen_knife',
 'kaleidoscope_cookery:gold_kitchen_knife',
 'kaleidoscope_cookery:diamond_kitchen_knife',
 'kaleidoscope_cookery:netherite_kitchen_knife'
]);

export const KITCHEN_KNIFE_TAG='kaleidoscope_cookery:kitchen_knife';
export function isKitchenKnife(id,tags=[]){
 return KITCHEN_KNIVES.includes(String(id??'')) || (Array.isArray(tags)&&tags.includes(KITCHEN_KNIFE_TAG));
}
// Read only the real ItemStack. Caller retains all existing loot probabilities.
export function isKitchenKnifeStack(stack){
 if(!stack)return false;
 if(isKitchenKnife(stack.typeId))return true;
 try{return typeof stack.hasTag==='function'&&stack.hasTag(KITCHEN_KNIFE_TAG)===true}catch{return false}
}

export function stationKey(dimensionId,x,y,z){
 return `kc_station:${dimensionId}:${x},${y},${z}`;
}

export function chickenSkinCompletionCandidate(state,heldId,isFirstEvent){
 if(isFirstEvent===false||!isKitchenKnife(heldId)||!state)return false;
 const cuts=Number(state.cuts??0),max=Number(state.max??0),count=Number(state.result?.count??0);
 return state.input===CHICKEN_ID
   && state.result?.id===RAW_SMALL_MEATS_ID
   && max===CUTS
   && cuts>=max
   && count===2;
}

export function chickenBoardCompletionCommitted(beforeState,afterState){
 if(!beforeState||beforeState.input!==CHICKEN_ID)return false;
 if(!afterState||!afterState.input)return true;
 if(afterState.input!==CHICKEN_ID)return true;
 const beforeCuts=Number(beforeState.cuts??0),afterCuts=Number(afterState.cuts??0);
 if(afterCuts<beforeCuts)return true;
 if(afterState.result?.id!==beforeState.result?.id)return true;
 return false;
}

function sampleIndex(random01,size){
 const r=Math.max(0,Math.min(0.999999999999,Number(random01)||0));
 return Math.floor(r*Math.max(1,Math.floor(Number(size)||1)));
}

export function chickenSkinDropCount(random01){return 1+sampleIndex(random01,3)}

export function chickenWingDropCount(baseRandom01,lootingRandom01,lootingLevel){
 const level=Math.max(0,Math.floor(Number(lootingLevel)||0));
 return 1+sampleIndex(baseRandom01,2)+(level>0?sampleIndex(lootingRandom01,level+1):0);
}
