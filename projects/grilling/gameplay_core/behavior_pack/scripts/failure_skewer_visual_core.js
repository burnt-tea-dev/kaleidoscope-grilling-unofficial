// Pinned Java FailedSkewerData + SkeweringHandler,9a1acdab. Presentation reads never mutate stacks.
import {canonicalFoodId} from './eating_profile_ids.js';
import {getItemProperty} from './itemDataCore.js';
import {captureSkewerMetadata,restoreSkewerMetadata} from './skewer_item_snapshot.js';
import {modelVariant,SECRET_MODEL_VARIANTS_KEY} from './secret_visual_state_core.js';
import {secretVisualIndex} from './integration_registry_core.js';
export const FAILED_SOURCE_KEY='kaleidoscope_grilling:failed_skewer_source';
export const FAILURE_VISUAL_MARKER=220;
export const FAILURE_IDS=Object.freeze(['kaleidoscope_grilling:mysterious_skewer','kaleidoscope_grilling:dark_grilling']);
export const FAILURE_RAW_SOURCES=Object.freeze(["kaleidoscope_grilling:raw_beef_skewer","kaleidoscope_grilling:raw_pork_belly_skewer","kaleidoscope_grilling:raw_chicken_skin_skewer","kaleidoscope_grilling:raw_mid_wing_skewer","kaleidoscope_grilling:raw_squid_tentacle_skewer","kaleidoscope_grilling:raw_fish_skewer","kaleidoscope_grilling:raw_sweet_potato_sheet_skewer","kaleidoscope_grilling:raw_potato_slice_skewer","kaleidoscope_grilling:raw_caterpillar_skewer","kaleidoscope_grilling:raw_mushroom_skewer","kaleidoscope_grilling:raw_bun_slice_skewer","kaleidoscope_grilling:raw_ender_pearl_skewer","kaleidoscope_grilling:raw_meatball_skewer","kaleidoscope_grilling:raw_slime_skewer","kaleidoscope_grilling:raw_meat_and_bone_skewer","kaleidoscope_grilling:raw_fried_egg_skewer","kaleidoscope_grilling:raw_gluten_skewer","kaleidoscope_grilling:raw_lamb_skewer","kaleidoscope_grilling:raw_golden_skewer"]);
export function isFailureSkewer(id){return FAILURE_IDS.includes(canonicalFoodId(id));}
export function failureSourceIndex(source){return FAILURE_RAW_SOURCES.indexOf(source)+1;}
export function failureModelState(value){
 let rows;try{rows=typeof value==='string'?JSON.parse(value):value}catch{}
 // Failure output IDs have no built-in display recipe. Missing variants retain
 // Java state0; never manufacture the secret renderer's legacy shape1 defaults.
 if(!Array.isArray(rows))return 0;
 return modelVariant(rows[0])*16+modelVariant(rows[1])*4+modelVariant(rows[2]);
}
export function failureHeldPayload(stack,readRaw){
 const source=failureSourceIndex(getItemProperty(stack,FAILED_SOURCE_KEY));
 const state=failureModelState(getItemProperty(stack,SECRET_MODEL_VARIANTS_KEY));
 const raw=readRaw?.(stack)??[];
 const helper=secretVisualIndex(raw[raw.length-1]?.id);
 return [source,state,helper,...Array(8).fill(0),FAILURE_VISUAL_MARKER];
}
export function createFailedSkewer(input,resultId,create,enchantmentType){
 if(!FAILURE_IDS.includes(resultId))throw Error('Grilling: invalid failed output');
 const snapshot=captureSkewerMetadata(input);
 snapshot.id=resultId;
 const source=canonicalFoodId(input.typeId)==='kaleidoscope_grilling:secret_skewer'?'custom':canonicalFoodId(input.typeId);
 snapshot.props={...snapshot.props,[FAILED_SOURCE_KEY]:source};
 // Existing fail-closed serializer preserves every accessible custom field and
 // verifies the output before the station/inventory transaction can commit it.
 return restoreSkewerMetadata(snapshot,create,enchantmentType);
}
