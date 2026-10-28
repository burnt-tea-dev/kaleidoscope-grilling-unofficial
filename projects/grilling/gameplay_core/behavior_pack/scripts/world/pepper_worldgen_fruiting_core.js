export const PEPPER_LEAVES_ID='kaleidoscope_grilling:pepper_leaves';
export const PEPPER_WORLDGEN_FRUITING_BRIDGE_ID='kaleidoscope_grilling:pepper_leaves_fruiting_bridge';
export const PEPPER_WORLDGEN_FRUITING_COMPONENT_ID='kaleidoscope_grilling:pepper_worldgen_fruiting_bridge';
export const PEPPER_HAS_STATE='kaleidoscope_grilling:has_pepper';
export const PEPPER_PERSISTENT_STATE='kaleidoscope_grilling:persistent';

export const PEPPER_WORLDGEN_NORMAL_WEIGHT=3;
export const PEPPER_WORLDGEN_FRUITING_WEIGHT=1;

export function worldgenFruitingProbability(){
 return PEPPER_WORLDGEN_FRUITING_WEIGHT/(PEPPER_WORLDGEN_NORMAL_WEIGHT+PEPPER_WORLDGEN_FRUITING_WEIGHT);
}

export function worldgenLeafWeights(){
 return [
  [PEPPER_LEAVES_ID,PEPPER_WORLDGEN_NORMAL_WEIGHT],
  [PEPPER_WORLDGEN_FRUITING_BRIDGE_ID,PEPPER_WORLDGEN_FRUITING_WEIGHT]
 ];
}
